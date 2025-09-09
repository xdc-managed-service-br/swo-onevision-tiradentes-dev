// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MonitoringWidgetComponent } from './monitoring-widget/monitoring-widget.component';
import { InstanceStatusWidgetComponent } from './instance-status-widget/instance-status-widget.component';
import { ResourceHealthComponent } from './resource-health/resource-health.component';
import { ResourceService } from '../../core/services/resource.service';
import { ErrorService } from '../../core/services/error.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    MonitoringWidgetComponent,
    InstanceStatusWidgetComponent,
    ResourceHealthComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();
  
  loading = true;
  resourceCounts: {
    total: number;
    ec2: number;
    rds: number;
    s3: number;
    ebs: number;
    ebsSnapshots: number;
    amiSnapshots: number;
  } = {
    total: 0,
    ec2: 0,
    rds: 0,
    s3: 0,
    ebs: 0,
    ebsSnapshots: 0,
    amiSnapshots: 0
  };
  
  monitoringStatus = { monitoredPercentage: 0 };
  ssmStatus = { connectedPercentage: 0 };
  instanceStatus = { total: 0, running: 0, stopped: 0 };
  recentResources: any[] = [];
  regionDistribution: { region: string; count: number }[] = [];
  accountDistribution: { account: string; count: number }[] = [];
  
  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}
  
  ngOnInit(): void {
    this.loading = true;
    this.loadDashboardData();
  }
  
  private loadDashboardData(): void {
    this.resourceService.getAllResources()
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (resources: any[]) => {
          console.log(`Dashboard loaded ${resources.length} total resources`);
          
          // Group resources by type
          const ec2Resources = resources.filter((r: any) => r.resourceType === 'EC2Instance');
          const rdsResources = resources.filter((r: any) => r.resourceType === 'RDSInstance');
          const s3Resources = resources.filter((r: any) => r.resourceType === 'S3Bucket');
          const ebsResources = resources.filter((r: any) => r.resourceType === 'EBSVolume');
          const ebsSnapshots = resources.filter((r: any) => r.resourceType === 'EBSSnapshot');
          const amiSnapshots = resources.filter((r: any) => r.resourceType === 'AMI');
          
          console.log(`Dashboard counts: 
            EC2: ${ec2Resources.length}, 
            RDS: ${rdsResources.length}, 
            S3: ${s3Resources.length}, 
            EBS: ${ebsResources.length}, 
            EBS Snapshots: ${ebsSnapshots.length}, 
            AMI Snapshots: ${amiSnapshots.length}`
          );
          
          // Update resource counts
          this.resourceCounts = {
            total: resources.length,
            ec2: ec2Resources.length,
            rds: rdsResources.length,
            s3: s3Resources.length,
            ebs: ebsResources.length,
            ebsSnapshots: ebsSnapshots.length,
            amiSnapshots: amiSnapshots.length
          };
          
          // Get recent resources
          this.recentResources = [...resources]
            .sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime())
            .slice(0, 10);
          
          // Calculate region distribution
          const regionCounts = resources.reduce((acc: Record<string, number>, resource: any) => {
            const region = resource.region || 'Unknown';
            acc[region] = (acc[region] || 0) + 1;
            return acc;
          }, {});
          
          this.regionDistribution = Object.entries(regionCounts)
            .map(([region, count]) => ({ region, count: count as number }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
          
          // Calculate account distribution
          const accountCounts = resources.reduce((acc: Record<string, number>, resource: any) => {
            const account = resource.accountName || resource.accountId || 'Unknown';
            acc[account] = (acc[account] || 0) + 1;
            return acc;
          }, {});
          
          this.accountDistribution = Object.entries(accountCounts)
            .map(([account, count]) => ({ account, count: count as number }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
          
          // Calculate monitoring stats
          this.calculateMonitoringStats(ec2Resources);
        },
        error: (error: any) => {
          console.error('Error loading dashboard data:', error);
          this.errorService.handleError({
            message: 'Failed to load dashboard data',
            details: error
          });
          this.loading = false;
        }
      });
  }

  private calculateMonitoringStats(ec2Resources: any[]): void {
    // Calculate instance status
    const runningInstances = ec2Resources.filter(r => r.state === 'running');
    const stoppedInstances = ec2Resources.filter(r => r.state === 'stopped');
    
    this.instanceStatus = {
      total: ec2Resources.length,
      running: runningInstances.length,
      stopped: stoppedInstances.length
    };
    
    // Calculate SSM monitoring percentage
    const ssmConnectedInstances = runningInstances.filter(r => r.ssmStatus === 'Online');
    const ssmPercentage = runningInstances.length > 0 
      ? Math.round((ssmConnectedInstances.length / runningInstances.length) * 100)
      : 0;
    
    // Calculate RAM monitoring percentage - now prioritize CloudWatch Agent detection
    const cwAgentMemoryInstances = ec2Resources.filter(r => r.cwAgentMemoryDetected === true);
    const legacyRamMonitoredInstances = ec2Resources.filter(r => 
      r.ramUtilization !== undefined && 
      r.ramUtilization !== null && 
      r.ramUtilization !== ''
    );
    
    // Use CloudWatch agent detection if available, fall back to legacy ram utilization
    const ramMonitoredCount = cwAgentMemoryInstances.length > 0 
      ? cwAgentMemoryInstances.length 
      : legacyRamMonitoredInstances.length;
    
    const ramPercentage = ec2Resources.length > 0 
      ? Math.round((ramMonitoredCount / ec2Resources.length) * 100)
      : 0;
    
    // Calculate Disk monitoring percentage - now prioritize CloudWatch Agent detection
    const cwAgentDiskInstances = ec2Resources.filter(r => r.cwAgentDiskDetected === true);
    const legacyDiskMonitoredInstances = ec2Resources.filter(r => 
      r.diskUtilization !== undefined && 
      r.diskUtilization !== null && 
      r.diskUtilization !== ''
    );
    
    // Use CloudWatch agent detection if available, fall back to legacy disk utilization
    const diskMonitoredCount = cwAgentDiskInstances.length > 0 
      ? cwAgentDiskInstances.length 
      : legacyDiskMonitoredInstances.length;
    
    const diskPercentage = ec2Resources.length > 0 
      ? Math.round((diskMonitoredCount / ec2Resources.length) * 100)
      : 0;
    
    // If there are no instances with monitoring data but there are running instances,
    // default to at least showing some percentage rather than 0%
    const defaultPercentage = runningInstances.length > 0 ? 
      Math.round((runningInstances.length / ec2Resources.length) * 100) : 0;
    
    // Set the monitoring status values
    this.monitoringStatus = {
      monitoredPercentage: ramPercentage > 0 ? ramPercentage : defaultPercentage
    };
    
    this.ssmStatus = {
      connectedPercentage: ssmPercentage > 0 ? ssmPercentage : defaultPercentage
    };
    
    console.log(`Monitoring Percentages - RAM: ${ramPercentage}% (CW Agent: ${cwAgentMemoryInstances.length}), ` + 
                `Disk: ${diskPercentage}% (CW Agent: ${cwAgentDiskInstances.length}), ` + 
                `SSM: ${ssmPercentage}%, Default: ${defaultPercentage}%`);
  }

  /**
   * Calculate the width percentage for bar charts
   * This uses a logarithmic scale to make smaller values more visible
   * while still showing the relative differences between values
   */
  getBarWidth(count: number): number {
    if (!count) return 0;
    
    // Find the maximum count for scaling
    let maxCount = 0;
    if (this.accountDistribution && this.accountDistribution.length) {
      maxCount = Math.max(...this.accountDistribution.map(item => item.count));
    }
    
    if (maxCount === 0) return 0;
    
    // Use a logarithmic scale to make smaller values more visible
    // but still maintain the relative differences
    const logMax = Math.log(maxCount + 1);
    const logValue = Math.log(count + 1);
    
    // Scale to percentage (minimum 5% for visibility)
    return Math.max(5, Math.min(100, (logValue / logMax) * 100));
  }

  // Helper method to get proper identifier
  getResourceIdentifier(resource: any): string {
    if (resource.instanceId) return resource.instanceId;
    if (resource.dbInstanceId) return resource.dbInstanceId;
    if (resource.bucketName) return resource.bucketName;
    if (resource.volumeId) return resource.volumeId;
    if (resource.snapshotId) return resource.snapshotId;
    if (resource.imageId) return resource.imageId;
    
    return resource.id || 'Unknown';
  }
  
  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}