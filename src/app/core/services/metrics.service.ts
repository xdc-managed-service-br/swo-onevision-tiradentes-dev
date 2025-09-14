// src/app/core/services/metrics.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

// Interface definitions for metrics
export interface GlobalMetrics {
  totalResources: number;
  resourceCounts: { [key: string]: number };
  accountDistribution: Array<{
    accountId: string;
    accountName: string;
    count: number;
  }>;
  regionDistribution: Array<{
    region: string;
    count: number;
  }>;
  recentResources?: Array<{
    resourceType: string;
    region: string;
    lastUpdated: string;
    identifier: string;
  }>;
}

export interface EC2HealthMetrics {
  total: number;
  byState: {
    running?: number;
    stopped?: number;
    pending?: number;
    terminated?: number;
    [key: string]: number | undefined;
  };
  healthStatus: {
    Healthy?: number;
    Impaired?: number;
    Unknown?: number;
    [key: string]: number | undefined;
  };
  cloudwatchAgent: {
    memoryMonitoring: number;
    diskMonitoring: number;
    bothEnabled: number;
    noneEnabled: number;
    percentageWithMemory: number;
    percentageWithDisk: number;
  };
  ssmAgent: {
    connected: number;
    notConnected: number;
    notInstalled: number;
    percentageConnected: number;
  };
}

export interface RDSMetrics {
  total: number;
  available: number;
  engines: { [key: string]: number };
  multiAZ?: number;
  performanceInsights: number;
  percentageMultiAZ: number;
  percentageWithPerfInsights: number;
}

export interface StorageMetrics {
  s3Buckets: number;
  s3WithLifecycle: number;
  ebsVolumes: number;
  ebsSnapshots: number;
  amiSnapshots: number;
}

export interface CostMetrics {
  unattachedEBSVolumes: number;
  unassociatedElasticIPs: number;
  potentialMonthlySavings: number;
}

export interface SecurityMetrics {
  securityGroups: number;
  exposedSecurityGroups: number;
  percentageExposed: number;
}

export interface DashboardMetrics {
  global: GlobalMetrics;
  ec2Health?: EC2HealthMetrics;
  rds?: RDSMetrics;
  storage?: StorageMetrics;
  cost?: CostMetrics;
  security?: SecurityMetrics;
  lastUpdated: string;
  collectionDuration?: number;
}

export interface MetricHistoryItem {
  date: string;
  totalResources: number;
  ec2Count?: number;
  rdsCount?: number;
  s3Count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private client = generateClient<Schema>();
  
  // Cache management
  private metricsCache: DashboardMetrics | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  
  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  
  constructor() {
    console.log('MetricsService initialized');
  }

  /**
   * Get current dashboard metrics (cached)
   */
  getDashboardMetrics(): Observable<DashboardMetrics> {
    // Check cache validity
    if (this.metricsCache && (Date.now() - this.cacheTimestamp < this.CACHE_DURATION)) {
      console.log('Returning cached metrics');
      return of(this.metricsCache);
    }

    console.log('Fetching fresh metrics from DynamoDB');
    this.loadingSubject.next(true);

    // Query for current metrics only
    return from(this.client.models.AWSResource.list({
      filter: {
        isMetric: { eq: true },
        id: { contains: 'CURRENT' }
      },
      limit: 20 // Should be enough for all current metric types
    })).pipe(
      map(response => {
        console.log(`Fetched ${response.data.length} metric items`);
        const metrics = this.processMetricsResponse(response.data);
        
        // Update cache
        this.metricsCache = metrics;
        this.cacheTimestamp = Date.now();
        
        return metrics;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError(error => {
        console.error('Error fetching metrics:', error);
        this.loadingSubject.next(false);
        return of(this.getDefaultMetrics());
      }),
      shareReplay(1) // Share the result among multiple subscribers
    );
  }

  /**
   * Get historical metrics for trend analysis
   */
  getMetricsHistory(days: number = 7): Observable<MetricHistoryItem[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`Fetching metrics history from ${startDateStr}`);

    return from(this.client.models.AWSResource.list({
      filter: {
        isMetric: { eq: true },
        metricType: { eq: 'GLOBAL_SUMMARY' },
        metricDate: { ge: startDateStr }
      },
      limit: days + 1
    })).pipe(
      map(response => {
        const history: MetricHistoryItem[] = [];
        
        response.data.forEach(item => {
          if (item.metricDate && item.metricData) {
            try {
              // CORREÇÃO: Verificar o tipo antes de fazer parse
              let data: any;
              if (typeof item.metricData === 'string') {
                data = JSON.parse(item.metricData);
              } else if (typeof item.metricData === 'object') {
                data = item.metricData;
              } else {
                console.warn('metricData em formato inesperado:', typeof item.metricData);
                return;
              }
              
              history.push({
                date: item.metricDate,
                totalResources: data.totalResources || 0,
                ec2Count: data.resourceCounts?.EC2Instance || 0,
                rdsCount: data.resourceCounts?.RDSInstance || 0,
                s3Count: data.resourceCounts?.S3Bucket || 0
              });
            } catch (e) {
              console.error('Error parsing historical metric:', e);
            }
          }
        });

        return history.sort((a, b) => a.date.localeCompare(b.date));
      }),
      catchError(error => {
        console.error('Error fetching metrics history:', error);
        return of([]);
      })
    );
  }

  /**
   * Force refresh metrics (bypass cache)
   */
  refreshMetrics(): Observable<DashboardMetrics> {
    console.log('Force refreshing metrics');
    this.metricsCache = null;
    this.cacheTimestamp = 0;
    return this.getDashboardMetrics();
  }

  /**
   * Process raw metric items from DynamoDB
   */
  private processMetricsResponse(data: any[]): DashboardMetrics {
    const metrics: DashboardMetrics = {
      global: this.getDefaultGlobalMetrics(),
      lastUpdated: new Date().toISOString()
    };

    data.forEach(item => {
      if (!item.metricData) return;

      try {
        // CORREÇÃO: Verificação de tipo robusta
        let metricData: any;
        
        if (typeof item.metricData === 'string') {
          metricData = JSON.parse(item.metricData);
        } else if (typeof item.metricData === 'object' && item.metricData !== null) {
          metricData = item.metricData;
        } else {
          console.warn(`Unexpected metricData type for ${item.metricType}:`, typeof item.metricData);
          return;
        }

        switch (item.metricType) {
          case 'GLOBAL_SUMMARY':
            metrics.global = metricData;
            metrics.lastUpdated = item.lastUpdated || metrics.lastUpdated;
            metrics.collectionDuration = item.collectionDuration;
            break;
            
          case 'EC2_HEALTH':
            metrics.ec2Health = metricData;
            break;
            
          case 'RDS_METRICS':
            metrics.rds = metricData;
            break;
            
          case 'STORAGE_METRICS':
            metrics.storage = metricData;
            break;
            
          case 'COST_OPTIMIZATION':
            metrics.cost = metricData;
            break;
            
          case 'SECURITY_METRICS':
            metrics.security = metricData;
            break;
        }
      } catch (error) {
        console.error(`Error parsing metric data for type ${item.metricType}:`, error);
      }
    });

    return metrics;
  }

  /**
   * Get default metrics structure
   */
  private getDefaultMetrics(): DashboardMetrics {
    return {
      global: this.getDefaultGlobalMetrics(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get default global metrics
   */
  private getDefaultGlobalMetrics(): GlobalMetrics {
    return {
      totalResources: 0,
      resourceCounts: {},
      accountDistribution: [],
      regionDistribution: [],
      recentResources: []
    };
  }

  /**
   * Utility method to check if metrics are stale
   */
  areMetricsStale(lastUpdated: string, hoursThreshold: number = 24): boolean {
    const lastUpdateTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
    return hoursSinceUpdate > hoursThreshold;
  }

  /**
   * Get specific resource count from metrics
   */
  getResourceCount(metrics: DashboardMetrics, resourceType: string): number {
    return metrics.global.resourceCounts[resourceType] || 0;
  }

  /**
   * Calculate percentage change between two values
   */
  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}