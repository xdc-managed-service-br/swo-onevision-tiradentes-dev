// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css', '../../shared/styles/onevision-base.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Loading state
  loading = true;
  error: string | null = null;

  // Metrics data
  globalSummary: MetricGlobalSummary | null = null;
  ec2Health: MetricEC2Health | null = null;
  costOptimization: MetricCostOptimization | null = null;
  security: MetricSecurity | null = null;
  rds: MetricRDS | null = null;
  storage: MetricStorage | null = null;

  // Distributions & recent
  accountDistribution: { account: string; accountName?: string; count: number }[] = [];
  regionDistribution: { region: string; count: number }[] = [];
  recentResources: any[] = [];

  // Chart data
  resourceDistributionChart: any = {};
  healthStatusChart: any = {};
  costSavingsChart: any = {};
  securityChart: any = {};
  rdsChart: any = {};
  storageChart: any = {};

  private destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    console.info('[Dashboard] ngOnInit');
    this.fetchDashboardData();
  }

  fetchDashboardData(): void {
    console.info('[Dashboard] fetchDashboardData(): start');
    this.loading = true;
    this.error = null;

    this.resourceService.getMetricsOnly()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.loading = false; console.info('[Dashboard] fetchDashboardData(): finalize'); }),
        catchError((error) => {
          console.error('[Dashboard] fetchDashboardData(): error', error);
          this.errorService.handleError(error);
          this.error = error?.message || 'Failed to load dashboard metrics. Please try again later.';
          return of([]);
        })
      )
      .subscribe((metrics: any) => {
        console.info('[Dashboard] fetchDashboardData(): subscribe', {
          isArray: Array.isArray(metrics),
          length: Array.isArray(metrics) ? metrics.length : 'n/a',
          types: Array.isArray(metrics) ? metrics.map((m: any) => m?.resourceType) : 'n/a',
          sample: Array.isArray(metrics) ? metrics.slice(0, 3) : metrics
        });
        try {
          this.processMetrics(metrics as AWSMetric[]);
        } catch (e) {
          console.error('[Dashboard] processMetrics() threw', e);
        }
      });
  }

  private processMetrics(metrics: AWSMetric[]): void {
    console.debug('[Dashboard] processMetrics(): in', { count: metrics?.length });
    // Separate metrics by type
    this.globalSummary = metrics.find(m => m.resourceType === 'METRIC_SUMMARY') as MetricGlobalSummary;
    this.ec2Health = metrics.find(m => m.resourceType === 'METRIC_EC2_HEALTH') as MetricEC2Health;
    this.costOptimization = metrics.find(m => m.resourceType === 'METRIC_COST') as MetricCostOptimization;
    this.security = metrics.find(m => m.resourceType === 'METRIC_SECURITY') as MetricSecurity;
    this.rds = metrics.find(m => m.resourceType === 'METRIC_RDS') as MetricRDS;
    this.storage = metrics.find(m => m.resourceType === 'METRIC_STORAGE') as MetricStorage;

    console.info('[Dashboard] metrics resolved', {
      hasSummary: !!this.globalSummary,
      summaryKeys: this.globalSummary ? Object.keys(this.globalSummary) : null,
      totalResources: this.globalSummary?.totalResources,
      resourceCounts: this.globalSummary ? {
        EC2: this.globalSummary.resourceCounts_EC2Instance,
        S3: this.globalSummary.resourceCounts_S3Bucket,
        RDS: this.globalSummary.resourceCounts_RDSInstance,
        VPC: this.globalSummary.resourceCounts_VPC,
        SG: this.globalSummary.resourceCounts_SecurityGroup,
      } : null,
      ec2Health: this.ec2Health,
      cost: this.costOptimization,
      security: this.security,
      rds: this.rds,
      storage: this.storage
    });

    // Process distributions
    if (this.globalSummary) {
      this.accountDistribution = this.processDistribution(this.globalSummary.accountDistribution, 'account');
      this.regionDistribution = this.processDistribution(this.globalSummary.regionDistribution, 'region');
      this.recentResources = this.globalSummary.recentResources || [];
      console.debug('[Dashboard] distributions', {
        accounts: this.accountDistribution?.length,
        regions: this.regionDistribution?.length,
        recent: this.recentResources?.length
      });
    }

    // Prepare chart data
    this.prepareCharts();
  }

  private processDistribution(distribution: any, type: 'account' | 'region'): any[] {
    if (!distribution) return [];
    
    if (Array.isArray(distribution)) {
      return distribution;
    }
    
    if (typeof distribution === 'object') {
      return Object.entries(distribution).map(([key, value]) => {
        if (type === 'account') {
          return { account: key, count: Number(value) };
        } else {
          return { region: key, count: Number(value) };
        }
      });
    }
    
    try {
      const parsed = JSON.parse(distribution);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('[Dashboard] processDistribution(): JSON.parse failed', { type, value: distribution });
    }

    return [];
  }

  private prepareCharts(): void {
    // Resource Distribution Chart (Pie)
    this.resourceDistributionChart = {
      type: 'doughnut',
      data: {
        labels: ['EC2', 'S3', 'RDS', 'VPC', 'Security Groups', 'Others'],
        datasets: [{
          data: [
            this.globalSummary?.resourceCounts_EC2Instance || 0,
            this.globalSummary?.resourceCounts_S3Bucket || 0,
            (this.globalSummary?.resourceCounts_RDSInstance || 0) + (this.globalSummary?.resourceCounts_RDSClusterSnapshot || 0),
            this.globalSummary?.resourceCounts_VPC || 0,
            this.globalSummary?.resourceCounts_SecurityGroup || 0,
            (this.globalSummary?.totalResources || 0) - 
            ((this.globalSummary?.resourceCounts_EC2Instance || 0) + 
             (this.globalSummary?.resourceCounts_S3Bucket || 0) +
             (this.globalSummary?.resourceCounts_RDSInstance || 0) + 
             (this.globalSummary?.resourceCounts_RDSClusterSnapshot || 0) +
             (this.globalSummary?.resourceCounts_VPC || 0) +
             (this.globalSummary?.resourceCounts_SecurityGroup || 0))
          ],
          backgroundColor: [
            '#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#9ca3af'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--ov-text)',
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    // EC2 Health Status Chart (Doughnut)
    this.healthStatusChart = {
      type: 'doughnut',
      data: {
        labels: ['Running', 'Stopped', 'Other'],
        datasets: [{
          data: [
            this.ec2Health?.byState_running || 0,
            this.ec2Health?.byState_stopped || 0,
            (this.ec2Health?.total || 0) - 
            ((this.ec2Health?.byState_running || 0) + 
             (this.ec2Health?.byState_stopped || 0))
          ],
          backgroundColor: [
            '#10b981', '#6b7280', '#f59e0b'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--ov-text)',
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    // Cost Savings Chart (Bar)
    this.costSavingsChart = {
      type: 'bar',
      data: {
        labels: ['Potential Savings', 'Unassociated EIPs', 'Unattached Volumes'],
        datasets: [{
          label: 'Cost Optimization',
          data: [
            this.costOptimization?.potentialMonthlySavings || 0,
            this.costOptimization?.unassociatedElasticIPs || 0,
            this.costOptimization?.unattachedEBSVolumes || 0
          ],
          backgroundColor: [
            '#3b82f6',
            '#f59e0b',
            '#ef4444'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'var(--ov-border)'
            },
            ticks: {
              color: 'var(--ov-text-secondary)'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: 'var(--ov-text-secondary)'
            }
          }
        }
      }
    };

    // Security Chart (Pie)
    this.securityChart = {
      type: 'pie',
      data: {
        labels: ['Exposed', 'Secure'],
        datasets: [{
          data: [
            this.security?.exposedSecurityGroups || 0,
            (this.globalSummary?.resourceCounts_SecurityGroup || 0) - 
            (this.security?.exposedSecurityGroups || 0)
          ],
          backgroundColor: [
            '#ef4444', '#10b981'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--ov-text)',
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    // RDS Chart (Doughnut)
    this.rdsChart = {
      type: 'doughnut',
      data: {
        labels: ['Multi-AZ', 'Single-AZ'],
        datasets: [{
          data: [
            this.rds?.multiAZ || 0,
            (this.rds?.total || 0) - (this.rds?.multiAZ || 0)
          ],
          backgroundColor: [
            '#10b981', '#3b82f6'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--ov-text)',
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    // Storage Chart (Bar)
    this.storageChart = {
      type: 'bar',
      data: {
        labels: ['AMI Snapshots', 'EBS Snapshots', 'EBS Volumes', 'S3 Buckets'],
        datasets: [{
          label: 'Storage Resources',
          data: [
            this.storage?.amiSnapshots || 0,
            this.storage?.ebsSnapshots || 0,
            this.storage?.ebsVolumes || 0,
            this.storage?.s3Buckets || 0
          ],
          backgroundColor: '#6366f1',
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'var(--ov-border)'
            },
            ticks: {
              color: 'var(--ov-text-secondary)'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: 'var(--ov-text-secondary)'
            }
          }
        }
      }
    };
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getPercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }
}
