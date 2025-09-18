// src/app/components/dashboard/account-distribution-card.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountDistribution } from '../../../core/services/metric-processor.service';

@Component({
  selector: 'app-account-distribution-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./account-distribuition-card.component.html`,
  styleUrls: ['./account-distribuition-card.component.css']
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