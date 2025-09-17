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

  get currentMetric(): AWSMetricsModel | null {
    return this.currentMetrics.length > 0 ? this.currentMetrics[0] : null;
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
    
    // Ativa debug no service se necessário
    if (this.debugMode) {
      this.metricService.setDebugMode(true);
    }
    
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

  private toNumber(value: number | null | undefined): number {
    return typeof value === 'number' ? value : 0;
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
   * Calcula porcentagem de um valor em relação ao total
   * @param value Valor parcial
   * @param total Valor total
   * @returns Porcentagem calculada (0-100)
   */
  getPercentage(value: number | undefined, total: number): number {
    if (!value || !total || total === 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  }

  /**
   * Calcula total de SSM para visualização stacked
   * @param metric Métrica com dados de SSM
   * @returns Soma total de instâncias SSM
   */
  getTotalSSM(metric: AWSMetricsModel): number {
    return (metric.ssmAgent_connected || 0) + 
           (metric.ssmAgent_notConnected || 0) + 
           (metric.ssmAgent_notInstalled || 0);
  }

  /**
   * Define classe CSS baseada no valor percentual
   * @param percentage Valor percentual
   * @returns Classe CSS apropriada para o nível
   */
  getProgressBarClass(percentage: number | undefined): string {
    if (!percentage) return 'progress-bar-danger';
    
    if (percentage >= 80) return 'progress-bar-success';
    if (percentage >= 60) return 'progress-bar-info';
    if (percentage >= 40) return 'progress-bar-warning';
    return 'progress-bar-danger';
  }

  /**
   * Define classe CSS para indicador de segurança
   * @param percentage Porcentagem de exposição
   * @returns Classe CSS baseada no nível de risco
   */
  getSecurityClass(percentage: number | undefined): string {
    if (!percentage) return '';
    
    if (percentage <= 5) return 'status-healthy';
    if (percentage <= 15) return 'status-warning';
    return 'status-unhealthy';
  }

  /**
   * Define classe CSS para barra de progresso de segurança
   * @param percentage Porcentagem de exposição
   * @returns Classe CSS apropriada para o nível de risco
   */
  getSecurityProgressClass(percentage: number | undefined): string {
    if (!percentage) return 'progress-bar-success';
    
    if (percentage <= 5) return 'progress-bar-success';
    if (percentage <= 15) return 'progress-bar-warning';
    return 'progress-bar-danger';
  }

  /**
   * Limpa cache e recarrega dados
   */
  refreshData() {
    console.log('[Dashboard] Forcing data refresh...');
    this.metricService.clearCache();
    this.fetchMetrics();
  }

  /**
   * Alterna modo debug
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.metricService.setDebugMode(this.debugMode);
    console.log('[Dashboard] Debug mode:', this.debugMode ? 'ON' : 'OFF');
  }
  /**
   * Obtém a hora atual formatada
   */
  getCurrentTime(): string {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formata números grandes com separador de milhar
   */
  formatNumber(value: number | undefined | null): string {
    if (!this.hasValue(value)) return '0';
    return value!.toLocaleString('en-US');
  }

  /**
   * Calcula percentagem de saúde dos recursos
   */
  getHealthPercentage(healthy: number | null | undefined, total: number | null | undefined): number {
    const safeHealthy = this.toNumber(healthy);
    const safeTotal = this.toNumber(total);
    if (safeHealthy === 0 || safeTotal === 0) return 0;
    return Math.round((safeHealthy / safeTotal) * 100);
  }

  /**
   * Determina classe CSS baseada na percentagem de saúde
   */
  getHealthStatusClass(healthy: number | null | undefined, total: number | null | undefined): string {
    const percentage = this.getHealthPercentage(healthy, total);
    if (percentage >= 90) return 'ov-status-healthy';
    if (percentage >= 70) return 'ov-status-warning';
    return 'ov-status-critical';
  }

  /**
   * Calcula percentagem de instâncias running
   */
  getRunningPercentage(metric: AWSMetricsModel): number {
    const total = metric.resourceCounts_EC2Instance || 0;
    const running = metric.byState_running || 0;
    if (total === 0) return 0;
    return Math.round((running / total) * 100);
  }

  hasEC2Data(): boolean {
    const metric = this.currentMetric;
    if (!metric) return false;
    return (
      this.toNumber(metric.resourceCounts_EC2Instance) > 0 ||
      this.toNumber(metric.byState_running) > 0 ||
      this.toNumber(metric.byState_stopped) > 0
    );
  }

  getEC2RunningPercentage(): number {
    const metric = this.currentMetric;
    if (!metric) return 0;
    return this.getHealthPercentage(metric.byState_running, metric.resourceCounts_EC2Instance);
  }

  getEC2StoppedPercentage(): number {
    const metric = this.currentMetric;
    if (!metric) return 0;
    return this.getHealthPercentage(metric.byState_stopped, metric.resourceCounts_EC2Instance);
  }

  getEC2HealthClass(): string {
    const metric = this.currentMetric;
    if (!metric) return '';
    return this.getHealthStatusClass(metric.byState_running, metric.resourceCounts_EC2Instance);
  }

  getEC2HealthText(): string {
    const metric = this.currentMetric;
    if (!metric) return 'No data';
    const total = this.toNumber(metric.resourceCounts_EC2Instance);
    if (total === 0) return 'No data';
    const percentage = this.getHealthPercentage(metric.byState_running, metric.resourceCounts_EC2Instance);
    return `${percentage}% Healthy`;
  }

  hasEC2HealthDetails(): boolean {
    const metric = this.currentMetric;
    if (!metric) return false;
    return (
      this.toNumber(metric.healthStatus_Healthy) > 0 ||
      this.toNumber(metric.healthStatus_Stopped) > 0 ||
      this.toNumber(metric.ssmAgent_connected) > 0
    );
  }

  hasRDSData(): boolean {
    const metric = this.currentMetric;
    if (!metric) return false;
    return this.toNumber(metric.total) > 0 || this.toNumber(metric.available) > 0;
  }

  getRDSHealthPercentage(): number {
    const metric = this.currentMetric;
    if (!metric) return 0;
    return this.getHealthPercentage(metric.available, metric.total);
  }

  /**
   * Processa distribuição por conta
   */
  getAccountDistribution(metric: AWSMetricsModel): any[] {
    if (!metric.accountDistribution) return [];
    
    try {
      const distribution = typeof metric.accountDistribution === 'string' 
        ? JSON.parse(metric.accountDistribution) 
        : metric.accountDistribution;
      
      // Mapeia os dados para o formato esperado
      if (Array.isArray(distribution)) {
        return distribution.slice(0, 10).map(item => ({
          name: item.accountName || item.account || 'Unknown',
          value: item.resourceCount || item.count || 0,
          percentage: item.percentage || this.calculatePercentage(item.resourceCount || item.count || 0, metric.totalResources || 0)
        }));
      }
      
      // Se for objeto, converte para array
      if (typeof distribution === 'object') {
        return Object.entries(distribution).slice(0, 10).map(([key, value]: [string, any]) => ({
          name: key,
          value: value,
          percentage: this.calculatePercentage(value, metric.totalResources || 0)
        }));
      }
    } catch (e) {
      console.error('Error parsing accountDistribution:', e);
    }
    
    // Dados de exemplo caso não haja dados reais
    return [
      { name: 'Infra', value: 1515, percentage: 45 },
      { name: 'Arquiteturas e Sistemas', value: 1371, percentage: 40 },
      { name: 'MagisterApps Prod', value: 1342, percentage: 38 },
      { name: 'Network', value: 1237, percentage: 36 },
      { name: 'Operacional', value: 1069, percentage: 31 },
      { name: 'BackOffice', value: 742, percentage: 22 },
      { name: 'ITP', value: 594, percentage: 17 },
      { name: 'Terminal Service', value: 465, percentage: 14 },
      { name: 'Biblioteca', value: 439, percentage: 13 },
      { name: 'Ficou Facil', value: 438, percentage: 13 }
    ];
  }

  /**
   * Processa distribuição por região
   */
  getRegionDistribution(metric: AWSMetricsModel): any[] {
    if (!metric.regionDistribution) return [];
    
    try {
      const distribution = typeof metric.regionDistribution === 'string' 
        ? JSON.parse(metric.regionDistribution) 
        : metric.regionDistribution;
      
      // Mapeia os dados para o formato esperado
      if (Array.isArray(distribution)) {
        return distribution.slice(0, 10).map(item => ({
          name: this.formatRegionName(item.region || item.name || 'Unknown'),
          value: item.resourceCount || item.count || 0,
          percentage: item.percentage || this.calculatePercentage(item.resourceCount || item.count || 0, metric.totalResources || 0)
        }));
      }
      
      // Se for objeto, converte para array
      if (typeof distribution === 'object') {
        return Object.entries(distribution).slice(0, 10).map(([key, value]: [string, any]) => ({
          name: this.formatRegionName(key),
          value: value,
          percentage: this.calculatePercentage(value, metric.totalResources || 0)
        }));
      }
    } catch (e) {
      console.error('Error parsing regionDistribution:', e);
    }
    
    // Dados de exemplo caso não haja dados reais
    return [
      { name: 'us-east-1', value: 8948, percentage: 80 },
      { name: 'us-west-2', value: 180, percentage: 16 },
      { name: 'ap-northeast-2', value: 180, percentage: 16 },
      { name: 'sa-east-1', value: 163, percentage: 15 },
      { name: 'us-east-2', value: 161, percentage: 14 },
      { name: 'ap-south-1', value: 160, percentage: 14 },
      { name: 'eu-central-1', value: 160, percentage: 14 },
      { name: 'eu-west-2', value: 160, percentage: 14 },
      { name: 'ap-northeast-3', value: 160, percentage: 14 },
      { name: 'eu-north-1', value: 160, percentage: 14 }
    ];
  }

  /**
   * Formata nome da região AWS
   */
  private formatRegionName(region: string): string {
    if (!region) return 'Unknown';
    // Mantém o formato original das regiões AWS
    return region;
  }

  /**
   * Calcula percentagem
   */
  private calculatePercentage(value: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  /**
   * Obtém recursos recentes
   */
  getRecentResources(metric: AWSMetricsModel): any[] {
    if (!metric.recentResources) return [];
    
    try {
      const resources = typeof metric.recentResources === 'string' 
        ? JSON.parse(metric.recentResources) 
        : metric.recentResources;
      
      if (Array.isArray(resources)) {
        return resources.slice(0, 5).map(item => ({
          type: item.resourceType || item.type || 'Resource',
          name: item.name || item.resourceName || item.id || 'Unnamed',
          time: this.formatTimeAgo(item.createdAt || item.updatedAt || new Date().toISOString())
        }));
      }
    } catch (e) {
      console.error('Error parsing recentResources:', e);
    }
    
    return [];
  }

  /**
   * Formata tempo relativo (ex: "2 hours ago")
   */
  private formatTimeAgo(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  }
}
