// src/app/components/dashboard/account-distribution-card.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountDistribution } from '../../core/services/metric-processor.service';

@Component({
  selector: 'app-account-distribution-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-card">
      <div class="card-header">
        <h3>Resources by Account</h3>
        <span class="total-count">{{ totalResources }} resources</span>
      </div>
      
      <div class="distribution-list">
        <div *ngFor="let account of accountDistribution" 
             class="distribution-item">
          <div class="item-info">
            <span class="item-name">{{ account.accountName }}</span>
            <span class="item-count">{{ account.count }}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" 
                 [style.width.%]="account.percentage"
                 [attr.data-percentage]="account.percentage + '%'">
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
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 14px;
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      position: relative;
    }

    .progress-bar::after {
      content: attr(data-percentage);
      color: #fff;
      font-size: 12px;
      font-weight: 500;
    }
  `]
})
export class AccountDistributionCardComponent implements OnInit {
  @Input() accountDistribution: AccountDistribution[] = [];
  totalResources: number = 0;

  ngOnInit() {
    this.totalResources = this.accountDistribution.reduce(
      (sum, account) => sum + account.count, 0
    );
  }
}