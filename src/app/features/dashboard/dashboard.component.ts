// src/app/features/dashboard/dashboard.component.ts
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
  debugMode = true; // Ativa modo debug

  currentMetrics: AWSMetricsModel[] = [];
  historicalMetrics: AWSMetricsModel[] = [];
  
  // Métricas agrupadas por tipo para melhor visualização
  metricsByType: Map<string, AWSMetricsModel> = new Map();

  get metrics(): AWSMetricsModel[] {
    return [...this.currentMetrics, ...this.historicalMetrics];
  }

  selectedDate = new FormControl<string | null>(null);

  // Estatísticas para debug
  debugStats = {
    totalMetrics: 0,
    currentMetrics: 0,
    historicalMetrics: 0,
    fieldsWithData: 0,
    fieldsEmpty: 0,
    numericFieldsCount: 0,
    stringFieldsCount: 0
  };

  constructor(
    private metricService: MetricService,
    private errorService: ErrorService,
    private collectorService: CollectorService
  ) {}

  ngOnInit() {
    console.info('[Dashboard] ngOnInit - Debug mode:', this.debugMode);
    
    this.fetchMetrics();
    
    // Observa mudanças na data selecionada
    this.selectedDate.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        if (date) {
          this.fetchHistoricalMetrics(date);
        } else {
          this.historicalMetrics = [];
          this.updateMetricsByType();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Dispara o coletor Lambda
   */
  onTriggerCollector() {
    console.log('[Dashboard] Triggering collector...');
    this.collectorService.triggerCollector()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('[Dashboard] Failed to trigger collector', error);
          alert('Failed to trigger collector: ' + error.message);
          return of(null);
        })
      )
      .subscribe((res) => {
        if (res !== null) {
          console.log('[Dashboard] Collector triggered successfully:', res);
          alert('Collector triggered successfully! Refreshing metrics in 5 seconds...');
          
          // Aguarda 5 segundos e recarrega métricas
          setTimeout(() => {
            this.metricService.clearCache();
            this.fetchMetrics();
          }, 5000);
        }
      });
  }

  /**
   * Busca métricas atuais
   */
  fetchMetrics() {
    console.info('[Dashboard] fetchMetrics(): start');
    this.loading = true;
    this.error = null;
    
    this.metricService.getCurrentMetrics()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          console.info('[Dashboard] fetchMetrics(): complete');
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
          sample: metrics?.slice(0, 1)
        });
        
        this.currentMetrics = metrics;
        this.updateMetricsByType();
        
        if (this.debugMode) {
          this.analyzeMetricsData(metrics);
        }
      });
  }

  /**
   * Busca métricas históricas
   */
  fetchHistoricalMetrics(date: string) {
    if (!date) {
      this.historicalMetrics = [];
      this.updateMetricsByType();
      return;
    }
    
    console.log('[Dashboard] Fetching historical metrics for:', date);
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
        console.log('[Dashboard] Historical metrics received:', metrics.length);
        this.historicalMetrics = metrics;
        this.updateMetricsByType();
      });
  }

  /**
   * Organiza métricas por tipo
   */
  private updateMetricsByType() {
    this.metricsByType.clear();
    
    const allMetrics = [...this.currentMetrics, ...this.historicalMetrics];
    
    allMetrics.forEach(metric => {
      if (metric.id) {
        // Extrai o tipo da métrica do ID
        const typeMatch = metric.id.match(/^METRICS-([^-]+)/);
        if (typeMatch) {
          const type = typeMatch[1];
          this.metricsByType.set(type, metric);
        }
      }
    });
    
    console.log('[Dashboard] Metrics by type:', Array.from(this.metricsByType.keys()));
  }

  /**
   * Analisa dados das métricas para debug
   */
  private analyzeMetricsData(metrics: AWSMetricsModel[]) {
    console.group('[Dashboard] Metrics Analysis');
    
    // Reset stats
    this.debugStats = {
      totalMetrics: metrics.length,
      currentMetrics: metrics.filter(m => m.id?.endsWith('-CURRENT')).length,
      historicalMetrics: metrics.filter(m => !m.id?.endsWith('-CURRENT')).length,
      fieldsWithData: 0,
      fieldsEmpty: 0,
      numericFieldsCount: 0,
      stringFieldsCount: 0
    };
    
    if (metrics.length > 0) {
      const firstMetric = metrics[0];
      const allFields = Object.keys(firstMetric);
      
      allFields.forEach(field => {
        const value = (firstMetric as any)[field];
        
        if (value !== null && value !== undefined && value !== '') {
          this.debugStats.fieldsWithData++;
        } else {
          this.debugStats.fieldsEmpty++;
          console.warn(`[Dashboard] Empty field: ${field}`);
        }
        
        if (typeof value === 'number') {
          this.debugStats.numericFieldsCount++;
        } else if (typeof value === 'string') {
          this.debugStats.stringFieldsCount++;
        }
      });
      
      console.log('Debug Stats:', this.debugStats);
      
      // Log campos numéricos críticos
      console.group('Critical Numeric Fields Check');
      const criticalFields = [
        'totalResources', 'byState_running', 'byState_stopped',
        'cloudwatchAgent_memoryMonitoring', 'cloudwatchAgent_diskMonitoring',
        'ssmAgent_connected', 'resourceCounts_EC2Instance', 'resourceCounts_S3Bucket'
      ];
      
      criticalFields.forEach(field => {
        const value = (firstMetric as any)[field];
        console.log(`${field}:`, {
          value,
          type: typeof value,
          isNumber: typeof value === 'number',
          isEmpty: value === null || value === undefined || value === ''
        });
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Formata valor para exibição
   */
  formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      return JSON.stringify(value, null, 2);
    }
    
    if (typeof value === 'number') {
      // Formata números grandes com separadores
      if (value >= 1000) {
        return value.toLocaleString();
      }
      // Formata porcentagens
      if (value > 0 && value < 1) {
        return (value * 100).toFixed(2) + '%';
      }
      return value.toString();
    }
    
    return String(value);
  }

  /**
   * Verifica se um campo tem valor válido
   */
  hasValue(value: any): boolean {
    return value !== null && value !== undefined && value !== '' && value !== 0;
  }

  /**
   * Obtém classe CSS baseada no tipo de métrica
   */
  getMetricTypeClass(metricId: string): string {
    if (!metricId) return '';
    
    if (metricId.includes('EC2HEALTH')) return 'metric-ec2';
    if (metricId.includes('COST')) return 'metric-cost';
    if (metricId.includes('SECURITY')) return 'metric-security';
    if (metricId.includes('RDS')) return 'metric-rds';
    if (metricId.includes('STORAGE')) return 'metric-storage';
    if (metricId.includes('SUMMARY')) return 'metric-summary';
    
    return 'metric-default';
  }

  /**
   * Força refresh dos dados
   */
  refreshData() {
    console.log('[Dashboard] Forcing data refresh...');
    this.metricService.clearCache();
    this.fetchMetrics();
  }

  /**
   * Toggle modo debug
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.metricService.setDebugMode(this.debugMode);
    console.log('[Dashboard] Debug mode:', this.debugMode ? 'ON' : 'OFF');
  }
}