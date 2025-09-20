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
  private debugMode = true; // Ativar para debug detalhado

  constructor(private metricProcessor: MetricProcessorService) {}

  /**
   * Busca todas as métricas com processamento e validação
   */
  getAllMetrics(): Observable<AWSMetricsModel[]> {
    console.log('[MetricService] Fetching all metrics');
    
    if (this.metricsCache.has('all')) {
      const cached = this.metricsCache.get('all') as AWSMetricsModel[];
      console.log('[MetricService] Returning cached metrics:', cached.length);
      return of(cached);
    }

    return from(this.loadAllMetricsWithPagination()).pipe(
      map((metrics) => {
        console.log('[MetricService] Processing metrics, raw count:', metrics.length);
        
        // Debug do primeiro item antes do processamento
        if (this.debugMode && metrics.length > 0) {
          console.group('[MetricService] Sample RAW metric before processing');
          console.log('First metric raw:', metrics[0]);
          console.log('Type of byState_running:', typeof metrics[0].byState_running);
          console.log('Type of cloudwatchAgent_memoryMonitoring:', typeof metrics[0].cloudwatchAgent_memoryMonitoring);
          console.groupEnd();
        }
        
        // Processa cada métrica
        const processed = metrics.map((m, index) => {
          const result = this.metricProcessor.processMetricData(m);
          
          // Debug do primeiro item após processamento
          if (this.debugMode && index === 0) {
            console.group('[MetricService] Sample PROCESSED metric');
            console.log('First metric processed:', result);
            console.log('Type of byState_running:', typeof result.byState_running);
            console.log('Type of cloudwatchAgent_memoryMonitoring:', typeof result.cloudwatchAgent_memoryMonitoring);
            this.validateMetricData(result);
            console.groupEnd();
          }
          
          return result;
        });
        
        return processed;
      }),
      tap((metrics) => {
        this.metricsCache.set('all', metrics);
        console.log('[MetricService] Cached metrics count:', metrics.length);
        
        // Sumário dos tipos de métricas
        if (this.debugMode) {
          this.logMetricsSummary(metrics);
        }
      }),
      catchError((error) => {
        console.error('[MetricService] Error fetching metrics:', error);
        return of([] as AWSMetricsModel[]);
      }),
      shareReplay(1)
    );
  }

  /**
   * Carrega métricas com paginação e debug detalhado
   */
  private async loadAllMetricsWithPagination(): Promise<AWSMetricsModel[]> {
    let all: AWSMetricsModel[] = [];
    let nextToken: string | null | undefined = null;
    let pageCount = 0;

    do {
      try {
        pageCount++;
        console.log(`[MetricService] Loading page ${pageCount}...`);
        
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSMetrics.list({
            limit: 1000,
            nextToken,
          });

        // Debug da estrutura da resposta
        if (this.debugMode && pageCount === 1 && response.data.length > 0) {
          console.group('[MetricService] Amplify Response Structure');
          console.log('Response data type:', typeof response.data);
          console.log('First item structure:', response.data[0]);
          console.log('Keys in first item:', Object.keys(response.data[0]));
          console.groupEnd();
        }

        all = [...all, ...response.data];
        nextToken = response.nextToken;
        
        console.log(`[MetricService] Page ${pageCount}: loaded ${response.data.length} items, total: ${all.length}`);
      } catch (error) {
        console.error(`[MetricService] Error in pagination at page ${pageCount}:`, error);
        break;
      }
    } while (nextToken);

    console.log(`[MetricService] Pagination complete. Total pages: ${pageCount}, Total items: ${all.length}`);
    return all;
  }

  /**
   * Busca métricas atuais (sufixo -CURRENT)
   */
  getCurrentMetrics(): Observable<AWSMetricsModel[]> {
    console.log('[MetricService] Getting current metrics');
    
    return this.getAllMetrics().pipe(
      map(metrics => {
        const current = metrics.filter(m => m.id && m.id.endsWith('-CURRENT'));
        console.log('[MetricService] Current metrics found:', current.length);
        
        if (this.debugMode && current.length > 0) {
          console.group('[MetricService] Current Metrics Sample');
          current.forEach(metric => {
            console.log(`Metric ID: ${metric.id}`);
            console.log(`- totalResources: ${metric.totalResources}`);
            console.log(`- byState_running: ${metric.byState_running}`);
            console.log(`- cloudwatchAgent_memoryMonitoring: ${metric.cloudwatchAgent_memoryMonitoring}`);
          });
          console.groupEnd();
        }
        
        return current;
      })
    );
  }

  /**
   * Busca métricas históricas por data
   */
  getHistoricalMetricsByDate(date: string): Observable<AWSMetricsModel[]> {
    console.log('[MetricService] Getting historical metrics for date:', date);
    
    return this.getAllMetrics().pipe(
      map(metrics => {
        const historical = metrics.filter(m => m.id && m.id.endsWith(date));
        console.log('[MetricService] Historical metrics found for', date, ':', historical.length);
        return historical;
      })
    );
  }

  /**
   * Busca métricas históricas em um intervalo de datas
   */
  getHistoricalMetricsRange(start: string, end: string): Observable<AWSMetricsModel[]> {
    console.log('[MetricService] Getting historical metrics range:', start, 'to', end);
    
    return this.getAllMetrics().pipe(
      map(metrics => {
        const range = metrics.filter(m => {
          const dateMatch = m.id ? m.id.match(/-(\d{4}-\d{2}-\d{2})$/) : null;
          if (!dateMatch) return false;
          const metricDate = dateMatch[1];
          return metricDate >= start && metricDate <= end;
        });
        console.log('[MetricService] Metrics in range:', range.length);
        return range;
      })
    );
  }

  /**
   * Valida dados de uma métrica para debug
   */
  private validateMetricData(metric: AWSMetricsModel): void {
    const issues: string[] = [];
    
    // Verifica campos numéricos críticos
    const criticalNumericFields = [
      'totalResources', 'byState_running', 'byState_stopped',
      'cloudwatchAgent_memoryMonitoring', 'ssmAgent_connected'
    ];
    
    criticalNumericFields.forEach(field => {
      const value = (metric as any)[field];
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number') {
          issues.push(`${field} is not a number (type: ${typeof value})`);
        }
      }
    });
    
    if (issues.length > 0) {
      console.warn('[MetricService] Validation issues found:', issues);
    } else {
      console.log('[MetricService] Metric validation passed ✓');
    }
  }

  /**
   * Log de sumário das métricas para debug
   */
  private logMetricsSummary(metrics: AWSMetricsModel[]): void {
    console.group('[MetricService] Metrics Summary');
    
    const summary = {
      total: metrics.length,
      current: metrics.filter(m => m.id?.endsWith('-CURRENT')).length,
      historical: metrics.filter(m => !m.id?.endsWith('-CURRENT')).length,
      types: new Set<string>(),
      dates: new Set<string>()
    };
    
    metrics.forEach(m => {
      if (m.id) {
        // Extrai tipo de métrica
        const typeMatch = m.id.match(/^METRICS-([^-]+)/);
        if (typeMatch) summary.types.add(typeMatch[1]);
        
        // Extrai data se for histórica
        const dateMatch = m.id.match(/-(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch) summary.dates.add(dateMatch[1]);
      }
    });
    
    console.log('Summary:', {
      ...summary,
      types: Array.from(summary.types),
      dates: Array.from(summary.dates).sort()
    });
    
    console.groupEnd();
  }

  /**
   * Limpa o cache de métricas
   */
  clearCache(): void {
    this.metricsCache.clear();
    console.log('[MetricService] Cache cleared');
  }

  /**
   * Habilita/desabilita modo debug
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log('[MetricService] Debug mode:', enabled ? 'ENABLED' : 'DISABLED');
  }
}