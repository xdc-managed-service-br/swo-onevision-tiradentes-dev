// src/app/components/dashboard/region-distribution-card.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegionDistribution } from '../../core/services/metric-processor.service';

@Component({
  selector: 'app-region-distribution-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-card">
      <div class="card-header">
        <h3>Resources by Region</h3>
        <span class="total-count">{{ regionDistribution.length }} regions</span>
      </div>
      
      <div class="distribution-list">
        <div *ngFor="let region of regionDistribution" 
             class="distribution-item">
          <div class="item-info">
            <span class="item-name">{{ region.region }}</span>
            <span class="item-count">{{ region.count }}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" 
                 [style.width.%]="region.percentage"
                 [attr.data-percentage]="region.percentage + '%'">
            </div>
          </div>
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

    .distribution-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
    }

    .distribution-list::-webkit-scrollbar {
      width: 4px;
    }

    .distribution-list::-webkit-scrollbar-track {
      background: #2a2a3e;
      border-radius: 2px;
    }

    .distribution-list::-webkit-scrollbar-thumb {
      background: #4a4a5e;
      border-radius: 2px;
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
      font-size: 13px;
      color: #ccc;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-count {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .progress-bar-container {
      height: 24px;
      background: #2a2a3e;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #14b8a6);
      border-radius: 12px;
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      position: relative;
    }

    .progress-bar::after {
      content: attr(data-percentage);
      color: #fff;
      font-size: 11px;
      font-weight: 500;
    }
  `]
})
export class RegionDistributionCardComponent implements OnInit {
  @Input() regionDistribution: RegionDistribution[] = [];

  ngOnInit() {
    // Limita a 10 principais regiões se houver muitas
    if (this.regionDistribution.length > 10) {
      this.regionDistribution = this.regionDistribution.slice(0, 10);
    }
  }
}