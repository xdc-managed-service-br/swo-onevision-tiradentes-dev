// src/app/features/dashboard/dashboard.component.ts
// Version: schema-key counts as top-level fields (no nested resourceCounts object)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { ResourceService } from '../../core/services/resource.service';
import { ErrorService } from '../../core/services/error.service';

import {
  MetricGlobalSummary,
  MetricEC2Health,
  MetricCostOptimization,
  MetricSecurity,
  MetricRDS,
  MetricStorage,
  AWSMetric
} from '../../models/resource.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css', '../../shared/styles/onevision-base.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Loading state
  loading = true;
  error: string | null = null;

  // Global summary
  totalResources = 0;
  resourcesProcessed = 0;
  lastUpdated = '';
  collectionDuration = 0;

  // === Resource counts — flat keys to match the interface ===
  resourceCounts_AMI = 0;
  resourceCounts_AutoScalingGroup = 0;
  resourceCounts_DirectConnectConnection = 0;
  resourceCounts_DirectConnectVirtualInterface = 0;
  resourceCounts_EBSSnapshot = 0;
  resourceCounts_EBSVolume = 0;
  resourceCounts_EC2Instance = 0;
  resourceCounts_ElasticIP = 0;
  resourceCounts_InternetGateway = 0;
  resourceCounts_LoadBalancer = 0;
  resourceCounts_NetworkACL = 0;
  resourceCounts_RDSClusterSnapshot = 0;
  resourceCounts_RDSInstance = 0;
  resourceCounts_RouteTable = 0;
  resourceCounts_S3Bucket = 0;
  resourceCounts_SecurityGroup = 0;
  resourceCounts_Subnet = 0;
  resourceCounts_TransitGateway = 0;
  resourceCounts_TransitGatewayAttachment = 0;
  resourceCounts_VPC = 0;
  resourceCounts_VPCEndpoint = 0;
  resourceCounts_VPNConnection = 0;

  // EC2 Health metrics
  ec2Health = {
    total: 0,
    running: 0,
    stopped: 0,
    healthy: 0,
    memoryMonitoring: 0,
    diskMonitoring: 0,
    bothMonitoring: 0,
    noneMonitoring: 0,
    percentageWithMemory: 0,
    percentageWithDisk: 0,
    ssmConnected: 0,
    ssmNotConnected: 0,
    percentageSSMConnected: 0
  };

  // Cost optimization
  costSavings = 0;
  unattachedVolumes = 0;
  unassociatedElasticIPs = 0;

  // Security
  exposedSecurityGroups = 0;
  percentageExposed = 0;

  // RDS metrics
  rdsMetrics = {
    total: 0,
    available: 0,
    multiAZ: 0,
    percentageMultiAZ: 0,
    performanceInsights: 0,
    percentageWithPerfInsights: 0
  };

  // Storage metrics
  storageMetrics = {
    amiSnapshots: 0,
    ebsSnapshots: 0,
    ebsVolumes: 0,
    s3Buckets: 0,
    s3WithLifecycle: 0
  };

  // Distributions & recent
  accountDistribution: { account: string; accountName?: string; count: number }[] = [];
  regionDistribution: { region: string; count: number }[] = [];
  recentResources: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMetrics(): void {
    this.loading = true;
    this.error = null;

    this.resourceService
      .getMetricsOnly()
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('[Dashboard] Error loading metrics:', err);
          this.error = 'Failed to load dashboard metrics. Please try again later.';
          this.errorService.handleError({ message: 'Failed to load dashboard metrics', details: err });
          return of([]);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe((metrics: AWSMetric[]) => {
        // Debug: verify METRIC_SUMMARY presence and key counts
        const summary = metrics.find(m => m.resourceType === 'METRIC_SUMMARY') as MetricGlobalSummary | undefined;
        console.log('DBG summary counts:', {
          present: !!summary,
          ec2: summary?.resourceCounts_EC2Instance,
          s3: summary?.resourceCounts_S3Bucket,
          vpc: summary?.resourceCounts_VPC,
          rds: summary?.resourceCounts_RDSInstance,
          ebs: summary?.resourceCounts_EBSVolume,
          sg: summary?.resourceCounts_SecurityGroup,
          totalResources: summary?.totalResources,
        });

        this.processMetrics(metrics);
      });
  }

  private processMetrics(metrics: AWSMetric[]): void {
    if (!Array.isArray(metrics)) return;

    for (const metric of metrics) {
      switch (metric.resourceType) {
        case 'METRIC_SUMMARY':
          this.processGlobalSummary(metric as MetricGlobalSummary);
          break;
        case 'METRIC_EC2_HEALTH':
          this.processEC2Health(metric as MetricEC2Health);
          break;
        case 'METRIC_COST':
          this.processCostOptimization(metric as MetricCostOptimization);
          break;
        case 'METRIC_SECURITY':
          this.processSecurityMetrics(metric as MetricSecurity);
          break;
        case 'METRIC_RDS':
          this.processRDSMetrics(metric as MetricRDS);
          break;
        case 'METRIC_STORAGE':
          this.processStorageMetrics(metric as MetricStorage);
          break;
      }
    }
  }

  private processGlobalSummary(summary: MetricGlobalSummary): void {
    // Main fields
    this.totalResources = summary.totalResources ?? 0;
    this.lastUpdated = summary.lastUpdated ?? summary.metricDate ?? new Date().toISOString();

    // === Resource counts (map 1:1 to keys) ===
    this.resourceCounts_AMI = summary.resourceCounts_AMI ?? 0;
    this.resourceCounts_AutoScalingGroup = summary.resourceCounts_AutoScalingGroup ?? 0;
    this.resourceCounts_DirectConnectConnection = summary.resourceCounts_DirectConnectConnection ?? 0;
    this.resourceCounts_DirectConnectVirtualInterface = summary.resourceCounts_DirectConnectVirtualInterface ?? 0;
    this.resourceCounts_EBSSnapshot = summary.resourceCounts_EBSSnapshot ?? 0;
    this.resourceCounts_EBSVolume = summary.resourceCounts_EBSVolume ?? 0;
    this.resourceCounts_EC2Instance = summary.resourceCounts_EC2Instance ?? 0;
    this.resourceCounts_ElasticIP = summary.resourceCounts_ElasticIP ?? 0;
    this.resourceCounts_InternetGateway = summary.resourceCounts_InternetGateway ?? 0;
    this.resourceCounts_LoadBalancer = summary.resourceCounts_LoadBalancer ?? 0;
    this.resourceCounts_NetworkACL = summary.resourceCounts_NetworkACL ?? 0;
    this.resourceCounts_RDSClusterSnapshot = summary.resourceCounts_RDSClusterSnapshot ?? 0;
    this.resourceCounts_RDSInstance = summary.resourceCounts_RDSInstance ?? 0;
    this.resourceCounts_RouteTable = summary.resourceCounts_RouteTable ?? 0;
    this.resourceCounts_S3Bucket = summary.resourceCounts_S3Bucket ?? 0;
    this.resourceCounts_SecurityGroup = summary.resourceCounts_SecurityGroup ?? 0;
    this.resourceCounts_Subnet = summary.resourceCounts_Subnet ?? 0;
    this.resourceCounts_TransitGateway = summary.resourceCounts_TransitGateway ?? 0;
    this.resourceCounts_TransitGatewayAttachment = summary.resourceCounts_TransitGatewayAttachment ?? 0;
    this.resourceCounts_VPC = summary.resourceCounts_VPC ?? 0;
    this.resourceCounts_VPCEndpoint = summary.resourceCounts_VPCEndpoint ?? 0;
    this.resourceCounts_VPNConnection = summary.resourceCounts_VPNConnection ?? 0;

    // Distributions / recent (already parsed in service; but guard if strings)
    let acc: any = (summary as any).accountDistribution;
    if (typeof acc === 'string') {
      try { acc = JSON.parse(acc); } catch { acc = []; }
    }
    this.accountDistribution = Array.isArray(acc)
      ? acc.map((a: any) => ('accountId' in a ? { account: a.accountId, accountName: a.accountName, count: a.count } : a))
      : [];

    let reg: any = (summary as any).regionDistribution;
    if (typeof reg === 'string') {
      try { reg = JSON.parse(reg); } catch { reg = []; }
    }
    this.regionDistribution = Array.isArray(reg) ? reg : [];

    this.recentResources = Array.isArray((summary as any).recentResources)
      ? (summary as any).recentResources
      : [];
  }

  private processEC2Health(health: MetricEC2Health): void {
    this.ec2Health.total = health.total ?? 0;
    this.ec2Health.running = health.byState_running ?? 0;
    this.ec2Health.stopped = health.byState_stopped ?? 0;
    this.ec2Health.healthy = health.healthStatus_Healthy ?? 0;

    // CloudWatch Agent
    this.ec2Health.memoryMonitoring = health.cloudwatchAgent_memoryMonitoring ?? 0;
    this.ec2Health.diskMonitoring = health.cloudwatchAgent_diskMonitoring ?? 0;
    this.ec2Health.bothMonitoring = health.cloudwatchAgent_bothEnabled ?? 0;
    this.ec2Health.noneMonitoring = health.cloudwatchAgent_noneEnabled ?? 0;
    this.ec2Health.percentageWithMemory = health.cloudwatchAgent_percentageWithMemory ?? 0;
    this.ec2Health.percentageWithDisk = health.cloudwatchAgent_percentageWithDisk ?? 0;

    // SSM Agent
    this.ec2Health.ssmConnected = health.ssmAgent_connected ?? 0;
    this.ec2Health.ssmNotConnected = health.ssmAgent_notConnected ?? 0;
    this.ec2Health.percentageSSMConnected = health.ssmAgent_percentageConnected ?? 0;
  }

  private processCostOptimization(cost: MetricCostOptimization): void {
    this.costSavings = cost.potentialMonthlySavings ?? 0;
    this.unattachedVolumes = cost.unattachedEBSVolumes ?? 0;
    this.unassociatedElasticIPs = cost.unassociatedElasticIPs ?? 0;
  }

  private processSecurityMetrics(security: MetricSecurity): void {
    this.exposedSecurityGroups = security.exposedSecurityGroups ?? 0;
    this.percentageExposed = security.percentageExposed ?? 0;
  }

  private processRDSMetrics(rds: MetricRDS): void {
    this.rdsMetrics.total = rds.total ?? 0;
    this.rdsMetrics.available = rds.available ?? 0;
    this.rdsMetrics.multiAZ = rds.multiAZ ?? 0;
    this.rdsMetrics.percentageMultiAZ = rds.percentageMultiAZ ?? 0;
    this.rdsMetrics.performanceInsights = rds.performanceInsights ?? 0;
    this.rdsMetrics.percentageWithPerfInsights = rds.percentageWithPerfInsights ?? 0;
  }

  private processStorageMetrics(storage: MetricStorage): void {
    this.storageMetrics.amiSnapshots = storage.amiSnapshots ?? 0;
    this.storageMetrics.ebsSnapshots = storage.ebsSnapshots ?? 0;
    this.storageMetrics.ebsVolumes = storage.ebsVolumes ?? 0;
    this.storageMetrics.s3Buckets = storage.s3Buckets ?? 0;
    this.storageMetrics.s3WithLifecycle = storage.s3WithLifecycle ?? 0;
  }

  // Template helpers
  getTimeSinceCollection(): string {
    if (!this.lastUpdated) return 'Unknown';
    const last = new Date(this.lastUpdated);
    const diffMs = Date.now() - last.getTime();
    const hours = Math.floor(diffMs / 36e5);
    if (hours < 1) return 'Less than 1 hour ago';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  formatDuration(seconds: number): string {
    if (seconds === null || seconds === undefined) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  isMetricsStale(): boolean {
    if (!this.lastUpdated) return true;
    const diffHours = (Date.now() - new Date(this.lastUpdated).getTime()) / 36e5;
    return diffHours > 24;
  }

  refreshMetrics(): void {
    // Bust cache to force fresh fetch from backend
    try { this.resourceService.clearCache(); } catch {}
    this.loadMetrics();
  }

  getBarWidth(count: number, maxCount: number): number {
    if (!maxCount) return 0;
    return Math.round((count / maxCount) * 100);
  }

  get accountMaxCount(): number {
    return Math.max(...this.accountDistribution.map(a => a.count), 1);
  }

  get regionMaxCount(): number {
    return Math.max(...this.regionDistribution.map(r => r.count), 1);
  }

  get ramMonitoredPercentage(): number { return this.ec2Health.percentageWithMemory; }
  get diskMonitoredPercentage(): number { return this.ec2Health.percentageWithDisk; }
  get ssmConnectedPercentage(): number { return this.ec2Health.percentageSSMConnected; }
}
