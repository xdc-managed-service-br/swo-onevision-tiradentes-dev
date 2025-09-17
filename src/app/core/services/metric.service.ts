// src/app/core/services/metric.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, tap, shareReplay, map } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import type { AWSMetricsModel } from '../../models/metric.model';
import { MetricProcessorService } from './metric-processor.service';

const client = generateClient<Schema>();

@Injectable({ providedIn: 'root' })
export class MetricService {
  private metricsCache = new Map<string, any[]>();

  constructor(private metricProcessor: MetricProcessorService) {}

  getAllMetrics(): Observable<AWSMetricsModel[]> {
    console.log('[MetricService] Fetching all metrics');
    if (this.metricsCache.has('all')) {
      return of(this.metricsCache.get('all') as AWSMetricsModel[]);
    }

    return from(this.loadAllMetricsWithPagination()).pipe(
      map((metrics) => metrics.map(m => this.metricProcessor.processMetricData(m))),
      tap((metrics) => {
        this.metricsCache.set('all', metrics);
        console.log('[MetricService] Total metrics:', metrics.length);
      }),
      catchError((error) => {
        console.error('[MetricService] Error fetching metrics:', error);
        return of([] as AWSMetricsModel[]);
      }),
      shareReplay(1)
    );
  }

  private async loadAllMetricsWithPagination(): Promise<AWSMetricsModel[]> {
    let all: AWSMetricsModel[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSMetrics.list({
            limit: 1000,
            nextToken,
          });

        const processed = response.data.map(m => this.metricProcessor.processMetricData(m));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[MetricService] loaded ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error('[MetricService] Error in pagination (metrics):', error);
        break;
      }
    } while (nextToken);

    return all;
  }
}