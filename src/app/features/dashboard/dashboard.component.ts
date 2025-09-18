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
}
