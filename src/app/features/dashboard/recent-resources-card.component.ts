// src/app/components/dashboard/recent-resources-card.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecentResource } from '../../core/services/metric-processor.service';

@Component({
  selector: 'app-recent-resources-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-card">
      <div class="card-header">
        <h3>Recent Resources</h3>
        <span class="total-count">Last 10 created</span>
      </div>
      
      <div class="resources-list">
        <div *ngFor="let resource of recentResources" 
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
        
        <div *ngIf="recentResources.length === 0" class="no-resources">
          <p>No recent resources found</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
      font-size: 14px;
      color: #888;
    }

    .resources-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 450px;
      overflow-y: auto;
    }

    .resources-list::-webkit-scrollbar {
      width: 4px;
    }

    .resources-list::-webkit-scrollbar-track {
      background: #2a2a3e;
      border-radius: 2px;
    }

    .resources-list::-webkit-scrollbar-thumb {
      background: #4a4a5e;
      border-radius: 2px;
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
  `]
})
export class RecentResourcesCardComponent {
  @Input() recentResources: RecentResource[] = [];

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

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
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