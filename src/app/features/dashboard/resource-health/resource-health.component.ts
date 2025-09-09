// src/app/dashboard/resource-health/resource-health.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ErrorService } from '../../../core/services/error.service';

interface ResourceHealth {
  type: string;
  displayName: string;
  routeLink: string;
  count: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    inactive?: number; // New property to track inactive/stopped instances
  };
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
  template: `
    <div class="health-container">
      <h3 class="health-title">Resource Health</h3>
      
      <div *ngIf="loading" class="loading-message">
        Loading resource health...
      </div>
      
      <div *ngIf="!loading" class="health-grid">
        <div *ngFor="let resource of resourceHealth" class="health-card" [routerLink]="[resource.routeLink]">
          <div class="health-header">
            <span class="resource-name">{{ resource.displayName }}</span>
            <span class="resource-count">{{ resource.count.total }}</span>
          </div>
          
          <div class="health-bars">
            <div class="health-bar-container">
              <div class="health-bar">
                <div class="bar-segment healthy" 
                     [style.width.%]="getSegmentWidth(resource.count.healthy, getActiveCount(resource.count))">
                  <span *ngIf="resource.count.healthy > 0" class="bar-label">{{ resource.count.healthy }}</span>
                </div>
                
                <div class="bar-segment warning" 
                     [style.width.%]="getSegmentWidth(resource.count.warning, getActiveCount(resource.count))">
                  <span *ngIf="resource.count.warning > 0" class="bar-label">{{ resource.count.warning }}</span>
                </div>
                <div class="bar-segment critical" 
                     [style.width.%]="getSegmentWidth(resource.count.critical, getActiveCount(resource.count))">
                  <span *ngIf="resource.count.critical > 0" class="bar-label">{{ resource.count.critical }}</span>
                </div>
              </div>
            </div>
            
            <div class="health-status">
              <span [ngClass]="getHealthClass(resource.healthPercentage)">
                {{ resource.healthPercentage }}% Healthy
              </span>
              <span *ngIf="resource.count.inactive && resource.count.inactive > 0" class="inactive-info">
                ({{ resource.count.inactive }} stopped)
              </span>
            </div>
            
            <div *ngIf="resource.type === 'EC2Instance' && resource.healthDetails" class="health-details">
              <span class="detail-item">System: {{ resource.healthDetails.systemChecks }}</span>
              <span class="detail-item">Instance: {{ resource.healthDetails.instanceChecks }}</span>
              <span class="detail-item">EBS: {{ resource.healthDetails.ebsChecks }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .health-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }
    
    .health-title {
      margin-top: 0;
      margin-bottom: 15px;
      color: #333;
      font-size: 1.2rem;
    }
    
    .loading-message {
      text-align: center;
      color: #666;
      padding: 20px;
      font-style: italic;
    }
    
    .health-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 15px;
    }
    
    .health-card {
      background-color: #f9f9f9;
      border-radius: 6px;
      padding: 15px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .health-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .health-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .resource-name {
      font-weight: 500;
      color: #333;
    }
    
    .resource-count {
      background-color: #6b45c7;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 0.9em;
    }
    
    .health-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .health-bar-container {
      width: 100%;
    }
    
    .health-bar {
      height: 24px;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      background-color: #e0e0e0;
    }
    
    .bar-segment {
      display: flex;
      justify-content: center;
      align-items: center;
      transition: width 0.5s ease;
      min-width: 24px;
    }
    
    .bar-segment.healthy {
      background-color: #4caf50;
    }
    
    .bar-segment.warning {
      background-color: #ff9800;
    }
    
    .bar-segment.critical {
      background-color: #f44336;
    }
    
    .bar-label {
      color: white;
      font-size: 0.85em;
      font-weight: 500;
    }
    
    .health-status {
      text-align: right;
      font-size: 0.9em;
    }
    
    .health-status .healthy {
      color: #2e7d32;
    }
    
    .health-status .warning {
      color: #e65100;
    }
    
    .health-status .critical {
      color: #b71c1c;
    }
    
    .inactive-info {
      color: #757575;
      margin-left: 8px;
      font-size: 0.9em;
      font-style: italic;
    }
    
    .health-details {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      font-size: 0.8em;
    }
    
    .detail-item {
      background-color: #e8eaf6;
      padding: 4px 8px;
      border-radius: 4px;
      color: #3949ab;
    }
  `]
})
export class ResourceHealthComponent implements OnInit, OnDestroy {
  loading = true;
  resourceHealth: ResourceHealth[] = [];
  private destroy$ = new Subject<void>();
  
  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}
  
  ngOnInit(): void {
    this.loadResourceHealth();
  }
  
  loadResourceHealth(): void {
    // Get all resources
    this.resourceService.getAllResources()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resources) => {
          if (!resources || resources.length === 0) {
            this.loading = false;
            return;
          }
          
          // Process EC2 instances health
          const ec2Instances = resources.filter(r => r.resourceType === 'EC2Instance');
          
          // Separate running and stopped instances
          const runningInstances = ec2Instances.filter(r => r.instanceState === 'running');
          const stoppedInstances = ec2Instances.filter(r => r.instanceState === 'stopped');
          const otherInstances = ec2Instances.filter(r => r.instanceState !== 'running' && r.instanceState !== 'stopped');
          
          // Calculate health only for running instances
          const ec2Health = this.calculateResourceHealth(runningInstances, (resource) => {
            // Use the new health check fields if available
            if (resource.healthStatus === 'Healthy') return 'healthy';
            if (resource.healthStatus === 'Impaired') return 'warning';
            if (resource.healthStatus === 'Unhealthy') return 'critical';
            
            // Fall back to existing checks if the new fields aren't populated yet
            if (resource.ssmStatus !== 'Connected') return 'critical';
            return 'healthy'; // Default to healthy if running and connected
          });
          
          // Add stopped instances count (but don't include in health calculation)
          ec2Health.counts.inactive = stoppedInstances.length;
          ec2Health.counts.total = ec2Instances.length; // Set total to include all instances
          
          // Calculate detailed health check summary for EC2 (only for running instances)
          const ec2HealthDetails = {
            systemChecks: this.getHealthCheckSummary(runningInstances, 'systemStatus'),
            instanceChecks: this.getHealthCheckSummary(runningInstances, 'instanceStatus'),
            ebsChecks: this.getHealthCheckSummary(runningInstances, 'ebsStatus')
          };
          
          // Process RDS instances health
          const rdsInstances = resources.filter(r => r.resourceType === 'RDSInstance');
          const rdsHealth = this.calculateResourceHealth(rdsInstances, (resource) => {
            if (resource.status !== 'available') return 'critical';
            return 'healthy';
          });
          
          // Process EBS volumes health
          const ebsVolumes = resources.filter(r => r.resourceType === 'EBSVolume');
          const ebsHealth = this.calculateResourceHealth(ebsVolumes, (resource) => {
            return 'healthy'; // Default all volumes to healthy for now
          });
          
          // Process S3 buckets health
          const s3Buckets = resources.filter(r => r.resourceType === 'S3Bucket');
          const s3Health = this.calculateResourceHealth(s3Buckets, (resource) => {
            return 'healthy'; // Default all buckets to healthy for now
          });
          
          // Set resource health
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
  
  /**
   * Calculate health metrics for a resource type
   */
  private calculateResourceHealth(resources: any[], healthFunction: (resource: any) => 'healthy' | 'warning' | 'critical') {
    const counts: {
      total: number;
      healthy: number;
      warning: number;
      critical: number;
      inactive?: number; // Add optional inactive property
    } = {
      total: resources.length,
      healthy: 0,
      warning: 0,
      critical: 0
    };
    
    resources.forEach(resource => {
      const health = healthFunction(resource);
      counts[health]++;
    });
    
    const healthPercentage = counts.total > 0 
      ? Math.round((counts.healthy / counts.total) * 100)
      : 0;
    
    return {
      counts,
      healthPercentage
    };
  }
  
  /**
   * Get a summary of health check status
   */
  private getHealthCheckSummary(resources: any[], statusField: string): string {
    const total = resources.length;
    if (total === 0) return 'N/A';
    
    // Check for various possible "healthy" status values with case insensitivity
    const passed = resources.filter(r => {
      const statusValue = r[statusField];
      if (!statusValue) return false;
      
      // Convert to lowercase for case-insensitive comparison
      const status = String(statusValue).toLowerCase();
      return status === 'ok' || 
             status === 'passed' || 
             status === 'healthy' || 
             status === 'available' ||
             status === 'running';
    }).length;
    
    return `${passed}/${total}`;
  }
  
  /**
   * Get the width percentage for a segment in the health bar
   */
  getSegmentWidth(segmentCount: number, total: number): number {
    if (total === 0) return 0;
    return (segmentCount / total) * 100;
  }
  
  /**
   * Get CSS class based on health percentage
   */
  getHealthClass(percentage: number): string {
    if (percentage >= 90) return 'healthy';
    if (percentage >= 70) return 'warning';
    return 'critical';
  }
  
  /**
   * Get count of active resources (excluding inactive ones)
   */
  getActiveCount(counts: any): number {
    return counts.healthy + counts.warning + counts.critical;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}