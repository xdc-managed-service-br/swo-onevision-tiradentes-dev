import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';

@Component({
  selector: 'app-cloudwatch-monitoring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cloudwatch-status-card">
      <h3>CloudWatch Agent Status</h3>
      
      <div *ngIf="loading" class="loading">
        Loading monitoring data...
      </div>
      
      <div *ngIf="!loading" class="metrics-container">
        <div class="metric-group">
          <h4>Memory Monitoring</h4>
          <div class="metric-bar-container">
            <div class="metric-bar" [style.width.%]="memoryPercentage">
              <span class="metric-value">{{ memoryMonitoredCount }}/{{ totalRunningInstances }}</span>
            </div>
          </div>
          <div class="metric-label">{{ memoryPercentage }}% of instances have CloudWatch Memory monitoring</div>
        </div>
        
        <div class="metric-group">
          <h4>Disk Monitoring</h4>
          <div class="metric-bar-container">
            <div class="metric-bar" [style.width.%]="diskPercentage">
              <span class="metric-value">{{ diskMonitoredCount }}/{{ totalRunningInstances }}</span>
            </div>
          </div>
          <div class="metric-label">{{ diskPercentage }}% of instances have CloudWatch Disk monitoring</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cloudwatch-status-card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }
    
    h3 {
      margin-top: 0;
      margin-bottom: 20px;
      color: #333;
    }
    
    .loading {
      text-align: center;
      color: #666;
      padding: 20px;
      font-style: italic;
    }
    
    .metrics-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .metric-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .metric-group h4 {
      margin: 0;
      font-size: 1rem;
      color: #555;
    }
    
    .metric-bar-container {
      height: 30px;
      background-color: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .metric-bar {
      height: 100%;
      background-color: #4caf50;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      min-width: 40px;
      transition: width 0.5s ease;
    }
    
    .metric-label {
      font-size: 0.9rem;
      color: #666;
    }
  `]
})
export class CloudWatchMonitoringComponent implements OnInit, OnDestroy {
  loading = true;
  
  // Metrics data
  totalInstances = 0;
  totalRunningInstances = 0;
  memoryMonitoredCount = 0;
  diskMonitoredCount = 0;
  memoryPercentage = 0;
  diskPercentage = 0;
  
  private destroy$ = new Subject<void>();
  
  constructor(private resourceService: ResourceService) {}
  
  ngOnInit(): void {
    this.loadInstanceData();
  }
  
  loadInstanceData(): void {
    this.resourceService.getResourcesByType('EC2Instance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (instances) => {
          this.totalInstances = instances.length;
          
          // Filter for only running instances
          const runningInstances = instances.filter(instance => instance.state === 'running');
          this.totalRunningInstances = runningInstances.length;
          
          // Count instances with CloudWatch Agent memory metrics
          this.memoryMonitoredCount = instances.filter(instance => 
            instance.cwAgentMemoryDetected === true
          ).length;
          
          // Count instances with CloudWatch Agent disk metrics
          this.diskMonitoredCount = instances.filter(instance => 
            instance.cwAgentDiskDetected === true
          ).length;
          
          // Calculate percentages
          this.memoryPercentage = this.totalRunningInstances > 0 
            ? Math.round((this.memoryMonitoredCount / this.totalRunningInstances) * 100)
            : 0;
            
          this.diskPercentage = this.totalRunningInstances > 0 
            ? Math.round((this.diskMonitoredCount / this.totalRunningInstances) * 100)
            : 0;
            
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading instance data:', error);
          this.loading = false;
        }
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}