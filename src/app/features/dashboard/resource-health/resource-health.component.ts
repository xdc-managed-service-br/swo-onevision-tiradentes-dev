
// src/app/features/dashboard/resource-health/resource-health.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ErrorService } from '../../../core/services/error.service';

interface HealthCounts {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  inactive?: number;
}

interface ResourceHealthItem {
  type: string;
  displayName: string;
  routeLink: string;
  count: HealthCounts;
  healthPercentage: number;
  healthDetails?: {
    systemChecks: string;
    instanceChecks: string;
    ebsChecks: string;
  };
}

@Component({
  selector: 'app-resource-health',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './resource-health.component.html',
  styleUrls: ['./resource-health.component.css']
})
export class ResourceHealthComponent implements OnInit, OnDestroy {
  loading = true;
  resourceHealth: ResourceHealthItem[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}

  ngOnInit(): void {
    this.loadResourceHealth();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Data loading ----------
  private loadResourceHealth(): void {
    this.resourceService.getAllResources()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resources) => {
          if (!resources || resources.length === 0) {
            this.loading = false;
            return;
          }

          // EC2
          const ec2Instances = resources.filter(r => r.resourceType === 'EC2Instance');
          const runningInstances = ec2Instances.filter(r => r.instanceState === 'running');
          const stoppedInstances = ec2Instances.filter(r => r.instanceState === 'stopped');

          const ec2Health = this.calculateResourceHealth(runningInstances, (resource) => {
            // Prefer new health fields if presentes
            if (resource.healthStatus === 'Healthy') return 'healthy';
            if (resource.healthStatus === 'Impaired') return 'warning';
            if (resource.healthStatus === 'Unhealthy') return 'critical';

            // Fallback simples
            if (resource.ssmStatus !== 'Connected') return 'critical';
            return 'healthy';
          });

          // Ajustes de contagem EC2
          ec2Health.counts.inactive = stoppedInstances.length;
          ec2Health.counts.total = ec2Instances.length;

          const ec2HealthDetails = {
            systemChecks: this.getHealthCheckSummary(runningInstances, 'systemStatus'),
            instanceChecks: this.getHealthCheckSummary(runningInstances, 'instanceStatus'),
            ebsChecks: this.getHealthCheckSummary(runningInstances, 'ebsStatus')
          };

          // RDS
          const rdsInstances = resources.filter(r => r.resourceType === 'RDSInstance');
          const rdsHealth = this.calculateResourceHealth(rdsInstances, (resource) => {
            return resource.status !== 'available' ? 'critical' : 'healthy';
          });

          // EBS
          const ebsVolumes = resources.filter(r => r.resourceType === 'EBSVolume');
          const ebsHealth = this.calculateResourceHealth(ebsVolumes, () => 'healthy');

          // S3
          const s3Buckets = resources.filter(r => r.resourceType === 'S3Bucket');
          const s3Health = this.calculateResourceHealth(s3Buckets, () => 'healthy');

          this.resourceHealth = [
            {
              type: 'EC2Instance',
              displayName: 'EC2 Instances',
              routeLink: '/resources/ec2',
              count: ec2Health.counts,
              healthPercentage: ec2Health.healthPercentage,
              healthDetails: ec2HealthDetails
            },
            {
              type: 'RDSInstance',
              displayName: 'RDS Instances',
              routeLink: '/resources/rds',
              count: rdsHealth.counts,
              healthPercentage: rdsHealth.healthPercentage
            },
            {
              type: 'EBSVolume',
              displayName: 'EBS Volumes',
              routeLink: '/resources/ebs',
              count: ebsHealth.counts,
              healthPercentage: ebsHealth.healthPercentage
            },
            {
              type: 'S3Bucket',
              displayName: 'S3 Buckets',
              routeLink: '/resources/s3',
              count: s3Health.counts,
              healthPercentage: s3Health.healthPercentage
            }
          ];

          this.loading = false;
        },
        error: (error) => {
          this.errorService.handleError({
            message: 'Failed to load resource health',
            details: error
          });
          this.loading = false;
        }
      });
  }

  // ---------- Helpers ----------
  private calculateResourceHealth(
    resources: any[],
    healthFn: (resource: any) => 'healthy' | 'warning' | 'critical'
  ): { counts: HealthCounts; healthPercentage: number } {
    const counts: HealthCounts = {
      total: resources.length,
      healthy: 0,
      warning: 0,
      critical: 0
    };

    for (const r of resources) {
      counts[healthFn(r)]++;
    }

    const active = this.getActiveCount(counts);
    const healthPercentage = active > 0
      ? Math.round((counts.healthy / active) * 100)
      : 0;

    return { counts, healthPercentage };
  }

  private getHealthCheckSummary(resources: any[], statusField: string): string {
    const total = resources.length;
    if (total === 0) return 'N/A';

    const passed = resources.filter(r => {
      const value = r?.[statusField];
      if (!value) return false;
      const s = String(value).toLowerCase();
      return s === 'ok' || s === 'passed' || s === 'healthy' || s === 'available' || s === 'running';
    }).length;

    return `${passed}/${total}`;
    }

  // widths dos segmentos da barra (considera somente ativos)
  getSegmentWidth(segmentCount: number, counts: HealthCounts): number {
    const totalActive = this.getActiveCount(counts);
    if (totalActive === 0) return 0;
    return (segmentCount / totalActive) * 100;
  }

  // cor do percentual
  getHealthClass(percentage: number): string {
    if (percentage >= 90) return 'rh-health--ok';
    if (percentage >= 70) return 'rh-health--warn';
    return 'rh-health--crit';
  }

  getActiveCount(counts: HealthCounts): number {
    return (counts.healthy || 0) + (counts.warning || 0) + (counts.critical || 0);
  }
}