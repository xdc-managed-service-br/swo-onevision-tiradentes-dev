import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { ErrorService } from '../../core/services/error.service';
import { MetricService } from '../../core/services/metric.service';
import { AWSMetricsModel } from '../../models/metric.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css', '../../shared/styles/onevision-base.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = false;
  error: string | null = null;

  metrics: AWSMetricsModel[] = [];

  constructor(
    private metricService: MetricService,
    private errorService: ErrorService
  ) {}

  ngOnInit() {
    console.info('[Dashboard] ngOnInit');
    this.fetchMetrics();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchMetrics() {
    console.info('[Dashboard] fetchMetrics(): start');
    this.loading = true;
    this.metricService.getAllMetrics()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          console.info('[Dashboard] fetchMetrics(): finalize');
        }),
        catchError((error) => {
          console.error('[Dashboard] fetchMetrics(): error', error);
          this.errorService.handleError(error);
          this.error = error?.message || 'Failed to load metrics';
          return of([]);
        })
      )
      .subscribe((metrics) => {
        console.info('[Dashboard] fetchMetrics(): received', {
          count: metrics?.length,
          sample: metrics?.slice(0, 3)
        });
        this.metrics = metrics;
      });
  }
}
