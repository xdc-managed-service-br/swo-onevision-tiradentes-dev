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
  template: `
    <div class="dashboard-container">
      <!-- Header Section -->
      <div class="dashboard-header">
        <h1>AWS Resources Dashboard</h1>
        <div class="header-actions">
          <button class="btn-refresh" (click)="refreshData()">
            <i class="fas fa-sync-alt" [class.spinning]="isLoading"></i>
            Refresh
          </button>
          <span class="last-updated">
            Last updated: {{ getFormattedDate(dashboardData?.summary?.lastUpdated) }}
          </span>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon total-resources">
            <i class="fas fa-server"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ dashboardData?.summary?.totalResources || 0 }}</div>
            <div class="card-label">Total Resources</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon total-accounts">
            <i class="fas fa-users"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ dashboardData?.summary?.totalAccounts || 0 }}</div>
            <div class="card-label">AWS Accounts</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon total-regions">
            <i class="fas fa-globe-americas"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ dashboardData?.summary?.totalRegions || 0 }}</div>
            <div class="card-label">Active Regions</div>
          </div>
        </div>

        <div class="summary-card" *ngIf="dashboardData?.costOptimization as costOptimization">
          <div class="card-icon savings">
            <i class="fas fa-dollar-sign"></i>
          </div>
          <div class="card-content">
            <div class="card-value">
              {{ formatCurrency(costOptimization.potentialSavings) }}
            </div>
            <div class="card-label">Potential Monthly Savings</div>
          </div>
        </div>
      </div>

      <!-- Distribution Cards -->
      <div class="distribution-grid">
        <!-- Account Distribution Card -->
        <div class="dashboard-card">
          <div class="card-header">
            <h3>Resources by Account</h3>
            <span class="total-count">{{ getAccountTotal() }} resources</span>
          </div>
          
          <div class="distribution-list">
            <div *ngFor="let account of dashboardData?.accountDistribution || []" 
                 class="distribution-item">
              <div class="item-info">
                <span class="item-name">{{ account.accountName }}</span>
                <span class="item-count">{{ account.count }}</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar account-bar" 
                     [style.width.%]="account.percentage">
                  <span class="progress-label">{{ account.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Region Distribution Card -->
        <div class="dashboard-card">
          <div class="card-header">
            <h3>Resources by Region</h3>
            <span class="total-count">{{ dashboardData?.regionDistribution?.length || 0 }} regions</span>
          </div>
          
          <div class="distribution-list">
            <div *ngFor="let region of getTopRegions()" 
                 class="distribution-item">
              <div class="item-info">
                <span class="item-name">{{ region.region }}</span>
                <span class="item-count">{{ region.count }}</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar region-bar" 
                     [style.width.%]="region.percentage">
                  <span class="progress-label">{{ region.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resources Section -->
      <div class="resources-section">
        <!-- Recent Resources Card -->
        <div class="dashboard-card recent-resources-card">
          <div class="card-header">
            <h3>Recent Resources</h3>
            <span class="total-count">Last 10 created</span>
          </div>
          
          <div class="resources-list">
            <div *ngFor="let resource of getRecentResources()" 
                 class="resource-item">
              <div class="resource-icon">
                <i [class]="getResourceIcon(resource.resourceType)"></i>
              </div>
              <div class="resource-details">
                <div class="resource-name">{{ resource.resourceName }}</div>
                <div class="resource-info">
                  <span class="resource-type">{{ resource.resourceType }}</span>
                  <span class="separator">•</span>
                  <span class="resource-region">{{ resource.region }}</span>
                  <span class="separator">•</span>
                  <span class="resource-time">{{ getRelativeTime(resource.createdAt) }}</span>
                </div>
              </div>
            </div>
            
            <div *ngIf="!(dashboardData?.recentResources?.length)" 
                 class="no-resources">
              <p>No recent resources found</p>
            </div>
          </div>
        </div>

        <!-- Resource Types Distribution -->
        <div class="dashboard-card resource-types-card">
          <div class="card-header">
            <h3>Resource Types</h3>
            <span class="total-count">{{ resourceTypes.length }} types</span>
          </div>
          
          <div class="resource-types-grid">
            <div *ngFor="let type of resourceTypes" class="resource-type-item">
              <span class="type-name">{{ type.name }}</span>
              <span class="type-count">{{ type.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Health & Security Section -->
      <div class="health-security-grid" *ngIf="dashboardData?.ec2Health || dashboardData?.security">
        <!-- EC2 Health Card -->
        <div class="dashboard-card" *ngIf="dashboardData?.ec2Health as ec2Health">
          <div class="card-header">
            <h3>EC2 Health</h3>
          </div>
          
          <div class="health-metrics">
            <div class="health-metric">
              <div class="metric-label">Running Instances</div>
              <div class="metric-value">{{ ec2Health.running }}</div>
              <div class="metric-bar">
                <div class="bar-fill running" 
                     [style.width.%]="getPercentage(ec2Health.running, ec2Health.total)">
                </div>
              </div>
            </div>

            <div class="health-metric">
              <div class="metric-label">CloudWatch Agent Coverage</div>
              <div class="metric-value">{{ ec2Health.cloudwatchAgentCoverage }}%</div>
              <div class="metric-bar">
                <div class="bar-fill coverage" 
                     [style.width.%]="ec2Health.cloudwatchAgentCoverage">
                </div>
              </div>
            </div>

            <div class="health-metric">
              <div class="metric-label">SSM Agent Connected</div>
              <div class="metric-value">{{ ec2Health.ssmAgentCoverage }}%</div>
              <div class="metric-bar">
                <div class="bar-fill ssm" 
                     [style.width.%]="ec2Health.ssmAgentCoverage">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security Card -->
        <div class="dashboard-card" *ngIf="dashboardData?.security as security">
          <div class="card-header">
            <h3>Security Groups</h3>
          </div>
          
          <div class="security-metrics">
            <div class="security-stat">
              <span class="stat-label">Total Groups</span>
              <span class="stat-value">{{ security.totalGroups }}</span>
            </div>
            <div class="security-stat">
              <span class="stat-label">Exposed to Internet</span>
              <span class="stat-value danger">{{ security.exposedGroups }}</span>
            </div>
            <div class="security-stat">
              <span class="stat-label">Exposure Rate</span>
              <span class="stat-value" 
                    [class.danger]="security.exposurePercentage">
                {{ security.exposurePercentage }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading metrics data...</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      background: #0f0f1e;
      min-height: 100vh;
      color: #fff;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .dashboard-header h1 {
      font-size: 28px;
      font-weight: 600;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .btn-refresh {
      padding: 8px 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s;
    }

    .btn-refresh:hover {
      transform: scale(1.05);
    }

    .btn-refresh i.spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .last-updated {
      font-size: 13px;
      color: #888;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .summary-card {
      background: #1e1e2e;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .card-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .card-icon.total-resources {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }

    .card-icon.total-accounts {
      background: linear-gradient(135deg, #ec4899, #f43f5e);
    }

    .card-icon.total-regions {
      background: linear-gradient(135deg, #10b981, #14b8a6);
    }

    .card-icon.savings {
      background: linear-gradient(135deg, #f59e0b, #fbbf24);
    }

    .card-content {
      flex: 1;
    }

    .card-value {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .card-label {
      font-size: 14px;
      color: #888;
    }

    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .dashboard-card {
      background: #1e1e2e;
      border-radius: 12px;
      padding: 20px;
      color: #fff;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    .total-count {
      font-size: 13px;
      color: #888;
    }

    .distribution-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
    }

    .distribution-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .item-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .item-name {
      font-size: 14px;
      color: #ccc;
    }

    .item-count {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .progress-bar-container {
      height: 28px;
      background: #2a2a3e;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      border-radius: 14px;
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      position: relative;
    }

    .progress-bar.account-bar {
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
    }

    .progress-bar.region-bar {
      background: linear-gradient(90deg, #10b981, #14b8a6);
    }

    .progress-label {
      color: #fff;
      font-size: 12px;
      font-weight: 500;
    }

    .resources-section {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 32px;
    }

    .resources-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 450px;
      overflow-y: auto;
    }

    .resource-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #2a2a3e;
      border-radius: 8px;
      transition: background 0.2s ease;
      cursor: pointer;
    }

    .resource-item:hover {
      background: #323246;
    }

    .resource-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .resource-icon i {
      font-size: 20px;
      color: #fff;
    }

    .resource-details {
      flex: 1;
      min-width: 0;
    }

    .resource-name {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resource-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #888;
    }

    .resource-type {
      color: #a78bfa;
    }

    .resource-region {
      color: #60a5fa;
    }

    .resource-time {
      color: #10b981;
    }

    .separator {
      color: #4a4a5e;
    }

    .no-resources {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .resource-types-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }

    .resource-type-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: #2a2a3e;
      border-radius: 8px;
      font-size: 13px;
    }

    .type-name {
      color: #ccc;
    }

    .type-count {
      font-weight: 600;
      color: #8b5cf6;
    }

    .health-security-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .health-metrics {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .health-metric {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .metric-label {
      font-size: 13px;
      color: #888;
    }

    .metric-value {
      font-size: 20px;
      font-weight: 600;
    }

    .metric-bar {
      height: 8px;
      background: #2a2a3e;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .bar-fill.running {
      background: #10b981;
    }

    .bar-fill.coverage {
      background: #3b82f6;
    }

    .bar-fill.ssm {
      background: #8b5cf6;
    }

    .security-metrics {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .security-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #2a2a3e;
      border-radius: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: #888;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
    }

    .stat-value.danger {
      color: #ef4444;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid #2a2a3e;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @media (max-width: 768px) {
      .resources-section {
        grid-template-columns: 1fr;
      }

      .distribution-grid {
        grid-template-columns: 1fr;
      }

      .health-security-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
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
