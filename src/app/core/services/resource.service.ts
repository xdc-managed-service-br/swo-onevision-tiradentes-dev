// src/app/core/services/resource.service.ts
// Clean, schema-aligned version for Amplify Gen 2 + Angular 17
// All code and comments in English per Renan's preference.

import { Injectable } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private resourcesCache = new Map<string, any[]>();
  private resourcesLoading = new BehaviorSubject<boolean>(false);
  public loading$ = this.resourcesLoading.asObservable();

  constructor() {}

  // =====================================================
  // Public API
  // =====================================================

  getAllResources(): Observable<any[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get('all') || []);
    }

    return from(this.loadAllResourcesWithPagination()).pipe(
      tap((resources) => {
        this.resourcesCache.set('all', resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error('Error fetching all resources:', error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  getResourcesByType(resourceType: string): Observable<any[]> {
    console.log(`[ResourceService] load by type: ${resourceType}`);
    if (resourceType.startsWith('METRIC')) {
      console.warn(`Attempted to load metric type ${resourceType} as resource. Returning empty.`);
      return of([]);
    }

    this.resourcesLoading.next(true);
    const cacheKey = `type:${resourceType}`;
    if (this.resourcesCache.has(cacheKey)) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get(cacheKey) || []);
    }

    return from(this.loadResourcesByTypeWithPagination(resourceType)).pipe(
      tap((resources) => {
        this.resourcesCache.set(cacheKey, resources);
        this.resourcesLoading.next(false);
        console.log(`[ResourceService] ${resourceType} count:`, resources.length);
      }),
      catchError((error) => {
        console.error(`Error fetching ${resourceType} resources:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  getResourcesByRegion(region: string): Observable<any[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      const filtered = (this.resourcesCache.get('all') || []).filter((r) => r.region === region);
      this.resourcesLoading.next(false);
      return of(filtered);
    }

    return from(
      client.models.AWSResource.list({
        filter: {
          and: [
            { region: { eq: region } },
            {
              or: [
                { isMetric: { eq: false } },
                { isMetric: { attributeExists: false } },
              ],
            },
          ],
        },
        limit: 1000,
      })
    ).pipe(
      map((response: any) => {
        const filtered = response.data.filter((item: any) => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        return filtered.map((item: any) => this.processResourceData(item));
      }),
      tap((resources) => {
        this.resourcesCache.set(`region:${region}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error(`Error fetching resources in region ${region}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }

  getResourcesByAccount(accountId: string): Observable<any[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      const filtered = (this.resourcesCache.get('all') || []).filter((r) => r.accountId === accountId);
      this.resourcesLoading.next(false);
      return of(filtered);
    }

    return from(this.loadResourcesByAccountWithPagination(accountId)).pipe(
      tap((resources) => {
        this.resourcesCache.set(`account:${accountId}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error(`Error fetching resources for account ${accountId}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }

  getMetricsOnly(): Observable<any[]> {
    this.resourcesLoading.next(true);

    const cacheKey = 'metrics';
    if (this.resourcesCache.has(cacheKey)) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get(cacheKey) || []);
    }

    return from(this.loadMetricsWithPagination()).pipe(
      tap((metrics) => {
        this.resourcesCache.set(cacheKey, metrics);
        this.resourcesLoading.next(false);
        console.log('[ResourceService] metrics loaded:', metrics.length);
      }),
      catchError((error) => {
        console.error('Error fetching metrics:', error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  clearCache(): void {
    this.resourcesCache.clear();
    console.log('[ResourceService] cache cleared');
  }

  // =====================================================
  // Private helpers
  // =====================================================

  private async loadAllResourcesWithPagination(): Promise<any[]> {
    let all: any[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: {
              or: [
                { isMetric: { eq: false } },
                { isMetric: { attributeExists: false } },
              ],
            },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] loaded ${processed.length} (total ${all.length})`);
      } catch (error) {
        console.error('Error in pagination (all resources):', error);
        break;
      }
    } while (nextToken);

    console.log(`[ResourceService] total resources loaded (excl. metrics): ${all.length}`);
    return all;
  }

  private async loadResourcesByTypeWithPagination(resourceType: string): Promise<any[]> {
    let all: any[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: { resourceType: { eq: resourceType } },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] type ${resourceType} batch: ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error(`Error in pagination (type ${resourceType}):`, error);
        break;
      }
    } while (nextToken);

    return all;
  }

  private async loadResourcesByAccountWithPagination(accountId: string): Promise<any[]> {
    let all: any[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: { accountId: { eq: accountId } },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] account ${accountId} batch: ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error(`Error in pagination (account ${accountId}):`, error);
        break;
      }
    } while (nextToken);

    return all;
  }

  private async loadMetricsWithPagination(): Promise<any[]> {
    let all: any[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: { resourceType: { beginsWith: 'METRIC-' } },
            limit: 100, // metrics are few
            nextToken,
          });

        const processed = response.data.map((item) => this.processMetricData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] metrics batch: ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error('Error in metrics pagination (beginsWith failed). Trying fallback...', error);

        // Fallback: list everything then filter client-side
        try {
          const alternative = await client.models.AWSResource.list({ limit: 1000, nextToken });
          const metricItems = alternative.data.filter((item: any) =>
            item.resourceType && item.resourceType.startsWith('METRIC-')
          );
          const processed = metricItems.map((item: any) => this.processMetricData(item));
          all = [...all, ...processed];
          console.log(`[ResourceService] metrics fallback batch: ${processed.length}, total ${all.length}`);
          break; // Exit loop after fallback pass
        } catch (altError) {
          console.error('Metrics fallback also failed:', altError);
          break;
        }
      }
    } while (nextToken);

    console.log(`[ResourceService] total metrics loaded: ${all.length}`);
    return all;
  }

  // Shape resource items as needed without changing unrelated fields
  private processResourceData(resource: any): any {
    const processed = { ...resource };

    // Example: fix null launchTime for EC2Instance using other timestamps
    if (processed.resourceType === 'EC2Instance') {
      if (processed.launchTime === null) {
        if (processed.lastUpdated) processed.launchTime = processed.lastUpdated;
        else if (processed.createdAt) processed.launchTime = processed.createdAt;
      }
    }

    return processed;
  }

  /**
   * STRICT schema-aligned metric processing.
   * Only fields present in your Amplify schema / Angular interfaces are coerced.
   */
  private processMetricData(metric: any): any {
    const processed: any = { ...metric };

    // --- Global Summary ---
    const globalSummaryNumeric = [
      'collectionDuration',
      'resourcesProcessed',
      'totalResources',
      'resourceRegionsFound',
      'regionsCollected',
    ];

    // --- Resource Counts ---
    const resourceCountsNumeric = [
      'resourceCounts_AMI',
      'resourceCounts_AutoScalingGroup',
      'resourceCounts_DirectConnectConnection',
      'resourceCounts_DirectConnectVirtualInterface',
      'resourceCounts_EBSSnapshot',
      'resourceCounts_EBSVolume',
      'resourceCounts_EC2Instance',
      'resourceCounts_ElasticIP',
      'resourceCounts_InternetGateway',
      'resourceCounts_LoadBalancer',
      'resourceCounts_NetworkACL',
      'resourceCounts_RDSClusterSnapshot',
      'resourceCounts_RDSInstance',
      'resourceCounts_RouteTable',
      'resourceCounts_S3Bucket',
      'resourceCounts_SecurityGroup',
      'resourceCounts_Subnet',
      'resourceCounts_TransitGateway',
      'resourceCounts_TransitGatewayAttachment',
      'resourceCounts_VPC',
      'resourceCounts_VPCEndpoint',
      'resourceCounts_VPNConnection',
    ];

    // --- EC2 Health ---
    const ec2HealthNumeric = [
      'total',
      'byState_running',
      'byState_stopped',
      'healthStatus_Healthy',
      'healthStatus_Stopped',
      'cloudwatchAgent_bothEnabled',
      'cloudwatchAgent_diskMonitoring',
      'cloudwatchAgent_memoryMonitoring',
      'cloudwatchAgent_noneEnabled',
      'cloudwatchAgent_percentageWithDisk',
      'cloudwatchAgent_percentageWithMemory',
      'ssmAgent_connected',
      'ssmAgent_notConnected',
      'ssmAgent_notInstalled',
      'ssmAgent_percentageConnected',
    ];

    // --- Cost ---
    const costNumeric = [
      'potentialMonthlySavings',
      'unassociatedElasticIPs',
      'unattachedEBSVolumes',
    ];

    // --- Security ---
    const securityNumeric = ['exposedSecurityGroups', 'percentageExposed'];

    // --- RDS ---
    const rdsNumeric = [
      'total',
      'available',
      'engines_aurora_mysql',
      'multiAZ',
      'percentageMultiAZ',
      'performanceInsights',
      'percentageWithPerfInsights',
    ];

    // --- Storage ---
    const storageNumeric = ['amiSnapshots', 'ebsSnapshots', 'ebsVolumes', 's3Buckets', 's3WithLifecycle'];

    const numericFields = [
      ...globalSummaryNumeric,
      ...resourceCountsNumeric,
      ...ec2HealthNumeric,
      ...costNumeric,
      ...securityNumeric,
      ...rdsNumeric,
      ...storageNumeric,
    ];

    numericFields.forEach((field) => {
      if (processed[field] !== undefined) {
        processed[field] = this.toNumber(processed[field]);
      }
    });

    // Fallback for totalResources
    if (!processed.totalResources || processed.totalResources === 0) {
      const rp = this.toNumber(processed.resourcesProcessed);
      if (rp > 0) processed.totalResources = rp;
    }

    // Normalize lastUpdated for UI badges
    if (!processed.lastUpdated) {
      processed.lastUpdated = processed.updatedAt || processed.metricDate || processed.createdAt || null;
    }

    // Parse JSON-like strings if necessary
    ['accountDistribution', 'regionDistribution', 'recentResources'].forEach((key) => {
      const v = processed[key];
      if (typeof v === 'string') {
        try { processed[key] = JSON.parse(v); } catch { /* keep as-is */ }
      }
    });

    return processed;
  }

  // DynamoDB AttributeValue → number coercion
  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (typeof value === 'object' && value.N) return parseFloat(value.N) || 0;
    return 0;
  }
}
