// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MetricService } from '../../core/services/metric.service';
import { MetricProcessorService, ProcessedMetricData } from '../../core/services/metric-processor.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./dashboard.component.html`,
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isLoading = false;
  dashboardData: ProcessedMetricData | null = null;
  resourceTypes: { name: string; count: number }[] = [];

  constructor(
    private metricService: MetricService,
    private metricProcessor: MetricProcessorService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData() {
    this.isLoading = true;
    
    this.metricService.getCurrentMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics) => {
          console.log('[Dashboard] Processing metrics:', metrics.length);
          
          // Processa os dados para o dashboard
          this.dashboardData = this.metricProcessor.processMetricsForDashboard(metrics);
          
          // Extrai tipos de recursos
          this.extractResourceTypes();
          
          console.log('[Dashboard] Data processed:', this.dashboardData);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('[Dashboard] Error loading metrics:', error);
          this.isLoading = false;
        }
      });
  }

  refreshData() {
    this.metricService.clearCache();
    this.loadDashboardData();
  }

  private extractResourceTypes() {
    if (!this.dashboardData?.resourceCounts) {
      this.resourceTypes = [];
      return;
    }

    this.resourceTypes = Array.from(this.dashboardData.resourceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter(type => type.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12); // Top 12 resource types
  }

  // Métodos auxiliares para o template
  getFormattedDate(date: Date | undefined): string {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number | undefined): string {
    if (!value) return '$0.00';
    return `$${value.toFixed(2)}`;
  }

  getPercentage(value: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  getAccountTotal(): number {
    if (!this.dashboardData?.accountDistribution) return 0;
    return this.dashboardData.accountDistribution.reduce((sum, acc) => sum + acc.count, 0);
  }

  getTopRegions() {
    if (!this.dashboardData?.regionDistribution) return [];
    return this.dashboardData.regionDistribution.slice(0, 10);
  }

  getRecentResources() {
    if (!this.dashboardData?.recentResources) return [];
    return this.dashboardData.recentResources.slice(0, 10);
  }

  getResourceIcon(resourceType: string): string {
    const iconMap: { [key: string]: string } = {
      'VPC': 'fas fa-network-wired',
      'EC2 Instance': 'fas fa-server',
      'S3 Bucket': 'fas fa-database',
      'Security Group': 'fas fa-shield-alt',
      'Load Balancer': 'fas fa-balance-scale',
      'RDS Instance': 'fas fa-database',
      'Route Table': 'fas fa-route',
      'Subnet': 'fas fa-project-diagram',
      'Internet Gateway': 'fas fa-globe',
      'VPN Connection': 'fas fa-key',
      'Network ACL': 'fas fa-list',
      'Transit Gateway': 'fas fa-exchange-alt',
      'Direct Connect': 'fas fa-link',
      'EBS Volume': 'fas fa-hdd',
      'EBS Snapshot': 'fas fa-camera',
      'AMI': 'fas fa-compact-disc'
    };

    return iconMap[resourceType] || 'fas fa-cube';
  }

  getRelativeTime(date: Date | string): string {
    const now = new Date();
    const targetDate = new Date(date);
    const diff = now.getTime() - targetDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  get summaryTiles() {
    return [
      {
        label: 'Total Resources',
        value: this.formatNumber(this.dashboardData?.summary?.totalResources || 0)
      },
      {
        label: 'EC2 Instances',
        value: this.formatNumber(this.getResourceCount('EC2Instance'))
      },
      {
        label: 'RDS Instances',
        value: this.formatNumber(this.getResourceCount('RDSInstance'))
      },
      {
        label: 'S3 Buckets',
        value: this.formatNumber(this.getResourceCount('S3Bucket'))
      },
      {
        label: 'EBS Volumes',
        value: this.formatNumber(this.getResourceCount('EBSVolume'))
      },
      {
        label: 'Snapshots',
        value: this.formatNumber(
          this.dashboardData?.storage?.totalSnapshots ||
          (this.getResourceCount('EBSSnapshot') + this.getResourceCount('AMI'))
        )
      }
    ];
  }

  get resourceHealthCards() {
    const ec2 = this.dashboardData?.ec2Health;
    const ec2Total = ec2?.total || this.getResourceCount('EC2Instance');
    const ec2Running = ec2?.running || 0;
    const ec2Stopped = ec2?.stopped || 0;
    const ec2Other = Math.max(ec2Total - ec2Running - ec2Stopped, 0);

    const cards = [
      {
        key: 'ec2',
        title: 'EC2 Instances',
        total: ec2Total,
        badge: ec2Total,
        segments: [
          { value: ec2Running, color: 'good' },
          { value: ec2Other, color: 'warn' },
          { value: ec2Stopped, color: 'critical' }
        ],
        status: ec2Total > 0 ? `${this.getPercentage(ec2Running, ec2Total)}% Running` : 'No data',
        description: ec2Total > 0 ? `${ec2Running} running / ${ec2Stopped} stopped` : 'No instances found'
      },
      {
        key: 'rds',
        title: 'RDS Instances',
        total: this.getResourceCount('RDSInstance'),
        badge: this.getResourceCount('RDSInstance'),
        segments: [
          { value: this.getResourceCount('RDSInstance'), color: 'good' }
        ],
        status: this.getResourceCount('RDSInstance') ? '100% Healthy' : 'No data',
        description: 'RDS fleet overview'
      },
      {
        key: 'ebs',
        title: 'EBS Volumes',
        total: this.getResourceCount('EBSVolume'),
        badge: this.getResourceCount('EBSVolume'),
        segments: [
          { value: this.getResourceCount('EBSVolume'), color: 'good' }
        ],
        status: this.getResourceCount('EBSVolume') ? '100% Healthy' : 'No data',
        description: 'Volume health overview'
      },
      {
        key: 's3',
        title: 'S3 Buckets',
        total: this.getResourceCount('S3Bucket'),
        badge: this.getResourceCount('S3Bucket'),
        segments: [
          { value: this.getResourceCount('S3Bucket'), color: 'good' }
        ],
        status: this.getResourceCount('S3Bucket') ? '100% Healthy' : 'No buckets',
        description: 'Storage overview'
      }
    ];
    return cards;
  }

  get monitoringMetrics() {
    const coverage = this.dashboardData?.ec2Health?.cloudwatchAgentCoverage || 0;
    return [
      {
        label: 'RAM Monitoring',
        value: coverage,
        description: 'Active monitoring on resources'
      },
      {
        label: 'Disk Monitoring',
        value: coverage,
        description: 'Active monitoring on resources'
      }
    ];
  }

  get ec2InstanceStatus() {
    const ec2 = this.dashboardData?.ec2Health;
    return {
      total: ec2?.total || 0,
      running: ec2?.running || 0,
      stopped: ec2?.stopped || 0,
      runningPercent: ec2 ? this.getPercentage(ec2.running, ec2.total) : 0
    };
  }

  get ssmCoverage(): number {
    return this.dashboardData?.ec2Health?.ssmAgentCoverage || 0;
  }

  getResourceCount(type: string): number {
    return this.dashboardData?.resourceCounts?.get(type) || 0;
  }

  formatNumber(value: number | undefined): string {
    const formatter = new Intl.NumberFormat('en-US');
    return formatter.format(value || 0);
  }
}
