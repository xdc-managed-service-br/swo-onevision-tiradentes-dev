// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css', '../../shared/styles/onevision-base.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Loading state
  loading = true;
  error: string | null = null;

  // Distributions & recent
  accountDistribution: { account: string; accountName?: string; count: number }[] = [];
  regionDistribution: { region: string; count: number }[] = [];
  recentResources: any[] = [];

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
    this.fetchDashboardData();
  }

  private fetchDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Implement your dashboard data fetching logic here
    // For example:
    // this.resourceService.getDashboardData()
    //   .pipe(
    //     takeUntil(this.destroy$),
    //     finalize(() => this.loading = false),
    //     catchError((error) => {
    //       this.error = this.errorService.handleError(error);
    //       return of(null);
    //     })
    //   )
    //   .subscribe(data => {
    //     // Handle the dashboard data
    //   });
  }
}
