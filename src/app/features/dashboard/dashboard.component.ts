// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceHealthComponent } from './resource-health/resource-health.component';
import { SharedModule } from '../../shared/shared.module';
import { InstanceStatusWidgetComponent } from './instance-status-widget/instance-status-widget.component';
import { MonitoringWidgetComponent } from './monitoring-widget/monitoring-widget.component';
import { MetricsService, DashboardMetrics } from '../../core/services/metrics.service';
import { ErrorService } from '../../core/services/error.service';

// Interfaces
interface ResourceCounts {
  total: number;
  ec2: number;
  rds: number;
  s3: number;
  ebs: number;
  ebsSnapshots: number;
  amiSnapshots: number;
}

interface MonitoringStatus {
  ramMonitoredPercentage: number;
  diskMonitoredPercentage: number;
}

interface InstanceStatus {
  total: number;
  running: number;
  stopped: number;
  pending: number;
  terminated: number;
}

interface SSMStatus {
  connectedPercentage: number;
  connected: number;
  total: number;
}

interface DistributionItem {
  account?: string;
  accountId?: string;
  accountName?: string;
  region?: string;
  count: number;
}

interface RecentResource {
  resourceType: string;
  region: string;
  lastUpdated: string;
  identifier: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ResourceHealthComponent,
    InstanceStatusWidgetComponent,
    MonitoringWidgetComponent,
    SharedModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Estado de carregamento
  loading = true;
  metricsStale = false;
  lastCollectionTime: string | null = null;
  collectionDuration: number | null = null;
  
  // Subject para cleanup das subscriptions
  private destroy$ = new Subject<void>();

  // Dados do dashboard
  resourceCounts: ResourceCounts = {
    total: 0,
    ec2: 0,
    rds: 0,
    s3: 0,
    ebs: 0,
    ebsSnapshots: 0,
    amiSnapshots: 0,
  };

  monitoringStatus: MonitoringStatus = { 
    ramMonitoredPercentage: 0,
    diskMonitoredPercentage: 0 
  };

  instanceStatus: InstanceStatus = { 
    total: 0, 
    running: 0, 
    stopped: 0, 
    pending: 0, 
    terminated: 0 
  };

  ssmStatus: SSMStatus = { 
    connectedPercentage: 0,
    connected: 0,
    total: 0
  };

  accountDistribution: DistributionItem[] = [];
  regionDistribution: DistributionItem[] = [];
  recentResources: RecentResource[] = [];
  accountMaxCount = 1;
  regionMaxCount = 1;

  // Cost optimization insights
  costSavings = 0;
  unattachedVolumes = 0;
  unassociatedEIPs = 0;

  // Security insights
  exposedSecurityGroups = 0;
  totalSecurityGroups = 0;

  constructor(
    private metricsService: MetricsService,
    private errorService: ErrorService
  ) {}

  ngOnInit(): void {
    console.log('Dashboard - Iniciando carregamento das métricas otimizadas...');
    this.loadDashboardMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load pre-calculated metrics from DynamoDB
   * This is much faster than loading all resources
   */
  private loadDashboardMetrics(): void {
    this.loading = true;
    
    this.metricsService.getDashboardMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics: DashboardMetrics) => {
          console.log('Dashboard - Métricas carregadas com sucesso');
          
          // Process global metrics
          this.processGlobalMetrics(metrics);
          
          // Process EC2 specific metrics
          if (metrics.ec2Health) {
            this.processEC2Metrics(metrics.ec2Health);
          }
          
          // Process cost optimization metrics
          if (metrics.cost) {
            this.processCostMetrics(metrics.cost);
          }
          
          // Process security metrics
          if (metrics.security) {
            this.processSecurityMetrics(metrics.security);
          }
          
          // Check if metrics are stale (older than 24 hours)
          this.lastCollectionTime = metrics.lastUpdated;
          this.collectionDuration = metrics.collectionDuration || null;
          this.metricsStale = this.metricsService.areMetricsStale(metrics.lastUpdated, 24);
          
          this.loading = false;
          console.log('Dashboard - Processamento completo. Tempo de carga < 1s');
        },
        error: (error) => {
          console.error('Dashboard - Erro ao carregar métricas:', error);
          this.errorService.handleError({
            message: 'Failed to load dashboard metrics',
            details: error
          });
          this.loading = false;
        }
      });
  }

  /**
   * Process global metrics
   */
  private processGlobalMetrics(metrics: DashboardMetrics): void {
    const global = metrics.global;
    
    // Resource counts
    this.resourceCounts = {
      total: global.totalResources,
      ec2: global.resourceCounts['EC2Instance'] || 0,
      rds: global.resourceCounts['RDSInstance'] || 0,
      s3: global.resourceCounts['S3Bucket'] || 0,
      ebs: global.resourceCounts['EBSVolume'] || 0,
      ebsSnapshots: global.resourceCounts['EBSSnapshot'] || 0,
      amiSnapshots: global.resourceCounts['AMI'] || 0
    };
    
    // Account distribution
    this.accountDistribution = global.accountDistribution.map(item => ({
      account: item.accountName,
      accountId: item.accountId,
      accountName: item.accountName,
      count: item.count
    }));
    this.accountMaxCount = Math.max(...this.accountDistribution.map(i => i.count), 1);
    
    // Region distribution
    this.regionDistribution = global.regionDistribution.map(item => ({
      region: item.region,
      count: item.count
    }));
    this.regionMaxCount = Math.max(...this.regionDistribution.map(i => i.count), 1);
    
    // Recent resources
    this.recentResources = global.recentResources || [];
    
    console.log('Dashboard - Métricas globais processadas:', {
      total: this.resourceCounts.total,
      accounts: this.accountDistribution.length,
      regions: this.regionDistribution.length
    });
  }

  /**
   * Process EC2 health metrics
   */
  private processEC2Metrics(ec2Metrics: any): void {
    // Instance status
    this.instanceStatus = {
      total: ec2Metrics.total,
      running: ec2Metrics.byState?.running || 0,
      stopped: ec2Metrics.byState?.stopped || 0,
      pending: ec2Metrics.byState?.pending || 0,
      terminated: ec2Metrics.byState?.terminated || 0
    };
    
    // CloudWatch monitoring
    const cwAgent = ec2Metrics.cloudwatchAgent;
    if (cwAgent) {
      this.monitoringStatus = {
        ramMonitoredPercentage: cwAgent.percentageWithMemory || 0,
        diskMonitoredPercentage: cwAgent.percentageWithDisk || 0
      };
    }
    
    // SSM status
    const ssmAgent = ec2Metrics.ssmAgent;
    if (ssmAgent) {
      this.ssmStatus = {
        connectedPercentage: ssmAgent.percentageConnected || 0,
        connected: ssmAgent.connected || 0,
        total: this.instanceStatus.running
      };
    }
    
    console.log('Dashboard - Métricas EC2 processadas:', {
      total: this.instanceStatus.total,
      running: this.instanceStatus.running,
      cwMemory: this.monitoringStatus.ramMonitoredPercentage + '%',
      ssmConnected: this.ssmStatus.connectedPercentage + '%'
    });
  }

  /**
   * Process cost optimization metrics
   */
  private processCostMetrics(costMetrics: any): void {
    this.unattachedVolumes = costMetrics.unattachedEBSVolumes || 0;
    this.unassociatedEIPs = costMetrics.unassociatedElasticIPs || 0;
    this.costSavings = costMetrics.potentialMonthlySavings || 0;
    
    console.log('Dashboard - Métricas de custo processadas:', {
      savings: `$${this.costSavings}`,
      unattachedVolumes: this.unattachedVolumes,
      unassociatedEIPs: this.unassociatedEIPs
    });
  }

  /**
   * Process security metrics
   */
  private processSecurityMetrics(securityMetrics: any): void {
    this.totalSecurityGroups = securityMetrics.securityGroups || 0;
    this.exposedSecurityGroups = securityMetrics.exposedSecurityGroups || 0;
    
    console.log('Dashboard - Métricas de segurança processadas:', {
      total: this.totalSecurityGroups,
      exposed: this.exposedSecurityGroups
    });
  }

  /**
   * Force refresh metrics
   */
  refreshMetrics(): void {
    console.log('Dashboard - Forçando atualização das métricas...');
    this.loading = true;
    
    this.metricsService.refreshMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics) => {
          this.processGlobalMetrics(metrics);
          if (metrics.ec2Health) this.processEC2Metrics(metrics.ec2Health);
          if (metrics.cost) this.processCostMetrics(metrics.cost);
          if (metrics.security) this.processSecurityMetrics(metrics.security);
          
          this.lastCollectionTime = metrics.lastUpdated;
          this.metricsStale = false;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error refreshing metrics:', error);
          this.loading = false;
        }
      });
  }

  // ========== MÉTODOS AUXILIARES PARA O TEMPLATE ==========

  /**
   * Calcula a largura percentual das barras de distribuição
   */
  getBarWidth(count: number, max?: number): number {
    if (typeof max === 'number' && isFinite(max) && max > 0) {
      return Math.round((count / max) * 100);
    }
    
    // Fallback to global max
    const allCounts = [
      ...this.accountDistribution.map(item => item.count),
      ...this.regionDistribution.map(item => item.count)
    ];
    const globalMax = Math.max(...allCounts, 1);
    return Math.round((count / globalMax) * 100);
  }

  /**
   * Retorna um identificador amigável para cada tipo de recurso
   */
  getResourceIdentifier(resource: RecentResource): string {
    return resource.identifier || 'Unnamed Resource';
  }

  /**
   * Format date for display
   */
  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
  }

  /**
   * Get time since last collection
   */
  getTimeSinceCollection(): string {
    if (!this.lastCollectionTime) return 'Unknown';
    
    const lastUpdate = new Date(this.lastCollectionTime);
    const now = new Date();
    const hours = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Less than 1 hour ago';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  /**
   * Format collection duration
   */
  formatDuration(seconds?: number | null): string {
    if (!seconds) return 'N/A';
    
    if (seconds < 60) return `${Math.round(seconds)}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (minutes < 60) {
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByResourceId(index: number, resource: RecentResource): string {
    return `${resource.resourceType}-${resource.identifier}-${index}`;
  }
  
  trackByAccount(index: number, item: DistributionItem): string {
    return item.accountId || item.account || `account-${index}`;
  }
  
  trackByRegion(index: number, item: DistributionItem): string {
    return item.region || `region-${index}`;
  }
}