import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { ErrorService } from '../../core/services/error.service';
import { MetricService } from '../../core/services/metric.service';
import { AWSMetricsModel } from '../../models/metric.model';
import { CollectorService } from '../../core/services/collector.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css', '../../shared/styles/onevision-base.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = false;
  error: string | null = null;

  currentMetrics: AWSMetricsModel[] = [];
  historicalMetrics: AWSMetricsModel[] = [];

  get metrics(): AWSMetricsModel[] {
    return [...this.currentMetrics, ...this.historicalMetrics];
  }

  selectedDate = new FormControl<string | null>(null);

  constructor(
    private metricService: MetricService,
    private errorService: ErrorService,
    private collectorService: CollectorService
  ) {}

  ngOnInit() {
    console.info('[Dashboard] ngOnInit');
    this.fetchMetrics();
    this.selectedDate.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        if (date) {
          this.fetchHistoricalMetrics(date);
        } else {
          this.historicalMetrics = [];
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTriggerCollector() {
    this.collectorService.triggerCollector()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Failed to trigger collector', error);
          alert('Failed to trigger collector');
          // Return empty observable so subscribe still completes
          return of(null);
        })
      )
      .subscribe((res) => {
        if (res !== null) {
          console.log('Collector triggered:', res);
          alert('Collector triggered successfully!');
        }
      });
  }

  fetchMetrics() {
    console.info('[Dashboard] fetchMetrics(): start');
    this.loading = true;
    this.metricService.getCurrentMetrics()
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
        this.currentMetrics = metrics;
      });
  }

  fetchHistoricalMetrics(date: string) {
    if (!date) {
      this.historicalMetrics = [];
      return;
    }
    this.loading = true;
    this.metricService.getHistoricalMetricsByDate(date)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
        catchError((error) => {
          console.error('[Dashboard] fetchHistoricalMetrics(): error', error);
          this.errorService.handleError(error);
          this.error = error?.message || 'Failed to load historical metrics';
          return of([]);
        })
      )
      .subscribe((metrics) => {
        this.historicalMetrics = metrics;
      });
  }
}
