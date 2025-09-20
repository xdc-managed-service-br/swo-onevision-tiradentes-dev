// src/app/core/services/metric-processor.service.ts
import { Injectable } from '@angular/core';
import type { AWSMetricsModel } from '../../models/metric.model';

// Interfaces para dados estruturados
export interface AccountDistribution {
  accountId: string;
  accountName: string;
  count: number;
  percentage?: number;
}

export interface RegionDistribution {
  region: string;
  count: number;
  percentage?: number;
}

export interface RecentResource {
  resourceType: string;
  region: string;
  createdAt: Date;
  identifier: string;
  accountId?: string;
  resourceName?: string;
}

export interface ProcessedMetricData {
  summary: {
    totalResources: number;
    totalAccounts: number;
    totalRegions: number;
    lastUpdated: Date;
  };
  accountDistribution: AccountDistribution[];
  regionDistribution: RegionDistribution[];
  recentResources: RecentResource[];
  resourceCounts: Map<string, number>;
  ec2Health?: {
    total: number;
    running: number;
    stopped: number;
    healthy: number;
    cloudwatchAgentCoverage: number;
    ssmAgentCoverage: number;
  };
  costOptimization?: {
    potentialSavings: number;
    unassociatedIPs: number;
    unattachedVolumes: number;
  };
  security?: {
    totalGroups: number;
    exposedGroups: number;
    exposurePercentage: number;
  };
  storage?: {
    totalSnapshots: number;
    totalVolumes: number;
    s3Buckets: number;
    s3WithLifecycle: number;
    lifecyclePercentage: number;
  };
}

@Injectable({ providedIn: 'root' })
export class MetricProcessorService {
  constructor() {}

  /**
   * Converte valor DynamoDB para tipo apropriado
   * Suporta tanto formato raw {"N": "123"} quanto valores diretos
   */
  private extractDynamoValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Se for objeto DynamoDB format
    if (typeof value === 'object' && !Array.isArray(value)) {
      if ('N' in value) return parseFloat(value.N);
      if ('S' in value) return value.S;
      if ('BOOL' in value) return value.BOOL;
      if ('NULL' in value) return null;
      if ('M' in value) return this.processDynamoMap(value.M);
      if ('L' in value) return value.L.map((item: any) => this.extractDynamoValue(item));
      if ('SS' in value) return value.SS;
      if ('NS' in value) return value.NS.map((n: string) => parseFloat(n));
    }

    return value;
  }

  /**
   * Processa um Map do DynamoDB recursivamente
   */
  private processDynamoMap(map: any): any {
    const result: any = {};
    for (const key in map) {
      if (map.hasOwnProperty(key)) {
        result[key] = this.extractDynamoValue(map[key]);
      }
    }
    return result;
  }

  /**
   * Parse seguro de JSON com fallback
   */
  private safeJsonParse(value: string, fallback: any = []): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('[MetricProcessor] Failed to parse JSON:', error);
      return fallback;
    }
  }

  /**
   * Processa dados de métrica com suporte completo a formato DynamoDB
   */
  public processMetricData(metric: any): AWSMetricsModel {
    // Primeiro, processa todos os campos para extrair valores do DynamoDB
    const processed: any = {};
    
    for (const key in metric) {
      if (metric.hasOwnProperty(key)) {
        processed[key] = this.extractDynamoValue(metric[key]);
      }
    }

    // Processa campos JSON complexos
    this.processJsonFields(processed);
    
    // Converte campos de data
    this.processDateFields(processed);
    
    // Converte campos numéricos
    this.processNumericFields(processed);
    
    return processed as AWSMetricsModel;
  }

  /**
   * Processa campos JSON (arrays/objetos)
   */
  private processJsonFields(processed: any): void {
    const jsonFields = ['accountDistribution', 'regionDistribution', 'recentResources'];
    
    jsonFields.forEach(field => {
      if (processed[field] && typeof processed[field] === 'string') {
        processed[field] = this.safeJsonParse(processed[field], []);
      }
    });
  }

  /**
   * Processa campos de data
   */
  private processDateFields(processed: any): void {
    const dateFields = ['createdAt', 'updatedAt', 'metricDate', 'lastUpdated'];
    
    dateFields.forEach(field => {
      if (processed[field]) {
        if (typeof processed[field] === 'string') {
          processed[field] = new Date(processed[field]);
        } else if (typeof processed[field] === 'number') {
          processed[field] = new Date(processed[field] * 1000);
        }
      }
    });
  }

  /**
   * Processa campos numéricos
   */
  private processNumericFields(processed: any): void {
    const numericFields = [
      // Summary fields
      'total', 'totalResources', 'resourceRegionsFound', 'regionsCollected',
      
      // EC2 Health fields
      'byState_running', 'byState_stopped', 'byState_pending', 'byState_terminated',
      'healthStatus_Healthy', 'healthStatus_Stopped', 'healthStatus_Unhealthy',
      'cloudwatchAgent_bothEnabled', 'cloudwatchAgent_diskMonitoring',
      'cloudwatchAgent_memoryMonitoring', 'cloudwatchAgent_noneEnabled',
      'cloudwatchAgent_percentageWithDisk', 'cloudwatchAgent_percentageWithMemory',
      'ssmAgent_connected', 'ssmAgent_notConnected', 'ssmAgent_notInstalled',
      'ssmAgent_percentageConnected',
      
      // Cost, Security, RDS, Storage fields
      'potentialMonthlySavings', 'unassociatedElasticIPs', 'unattachedEBSVolumes',
      'exposedSecurityGroups', 'percentageExposed', 'securityGroups',
      'available', 'engines_aurora_mysql', 'multiAZ', 'percentageMultiAZ',
      'performanceInsights', 'percentageWithPerfInsights',
      'amiSnapshots', 'ebsSnapshots', 'ebsVolumes', 's3Buckets', 's3WithLifecycle',
      
      // Resource Count fields
      'resourceCounts_AMI', 'resourceCounts_AutoScalingGroup',
      'resourceCounts_DirectConnectConnection', 'resourceCounts_DirectConnectVirtualInterface',
      'resourceCounts_EBSSnapshot', 'resourceCounts_EBSVolume', 'resourceCounts_EC2Instance',
      'resourceCounts_ElasticIP', 'resourceCounts_InternetGateway', 'resourceCounts_LoadBalancer',
      'resourceCounts_NetworkACL', 'resourceCounts_RDSClusterSnapshot', 'resourceCounts_RDSInstance',
      'resourceCounts_RouteTable', 'resourceCounts_S3Bucket', 'resourceCounts_SecurityGroup',
      'resourceCounts_Subnet', 'resourceCounts_TransitGateway', 'resourceCounts_TransitGatewayAttachment',
      'resourceCounts_VPC', 'resourceCounts_VPCEndpoint', 'resourceCounts_VPNConnection'
    ];

    numericFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        if (typeof processed[field] === 'string') {
          processed[field] = parseFloat(processed[field]) || 0;
        }
      }
    });
  }

  /**
   * Normaliza distribuição de contas com cálculo de percentagem
   */
  public normalizeAccountDistribution(metric: AWSMetricsModel): AccountDistribution[] {
    const distribution = metric.accountDistribution;
    
    if (!distribution || !Array.isArray(distribution)) {
      return [];
    }

    const total = distribution.reduce((sum, item) => sum + (item.count || 0), 0);
    
    return distribution.map(item => ({
      accountId: item.accountId || 'Unknown',
      accountName: this.getAccountDisplayName(item.accountName, item.accountId),
      count: item.count || 0,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Normaliza distribuição de regiões com cálculo de percentagem
   */
  public normalizeRegionDistribution(metric: AWSMetricsModel): RegionDistribution[] {
    const distribution = metric.regionDistribution;
    
    if (!distribution || !Array.isArray(distribution)) {
      return [];
    }

    const total = distribution.reduce((sum, item) => sum + (item.count || 0), 0);
    
    return distribution.map(item => ({
      region: this.getRegionDisplayName(item.region),
      count: item.count || 0,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Normaliza recursos recentes
   */
  public normalizeRecentResources(metric: AWSMetricsModel): RecentResource[] {
    const resources = metric.recentResources;
    
    if (!resources || !Array.isArray(resources)) {
      return [];
    }

    return resources.map(resource => {
      const identifier = resource.identifier || '';
      const parts = identifier.split('-');
      const accountId = parts[0] || '';
      
      return {
        resourceType: this.formatResourceType(resource.resourceType),
        region: this.getRegionDisplayName(resource.region),
        createdAt: new Date(resource.createdAt),
        identifier: identifier,
        accountId: accountId,
        resourceName: this.extractResourceName(identifier)
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Extrai contagens de recursos para um Map
   * CORREÇÃO: Não formatar as chaves, manter como estão no DynamoDB
   */
  public extractResourceCounts(metric: AWSMetricsModel): Map<string, number> {
    const counts = new Map<string, number>();
    
    Object.keys(metric).forEach(key => {
      if (key.startsWith('resourceCounts_')) {
        const resourceType = key.replace('resourceCounts_', '');
        const value = (metric as any)[key];
        if (typeof value === 'number' && value > 0) {
          // IMPORTANTE: Não formatar a chave, manter como está
          counts.set(resourceType, value);
        }
      }
    });
    
    return counts;
  }

  /**
   * Processa todas as métricas em um objeto consolidado para dashboard
   */
  public processMetricsForDashboard(metrics: AWSMetricsModel[]): ProcessedMetricData {
    // Encontra métricas específicas
    const globalMetric = metrics.find(m => m.id === 'METRICS-GLOBAL-CURRENT');
    const ec2Metric = metrics.find(m => m.id === 'METRICS-EC2-CURRENT');
    const costMetric = metrics.find(m => m.id === 'METRICS-COST-CURRENT');
    const securityMetric = metrics.find(m => m.id === 'METRICS-SECURITY-CURRENT');
    const storageMetric = metrics.find(m => m.id === 'METRICS-STORAGE-CURRENT');
    
    const result: ProcessedMetricData = {
      summary: {
        totalResources: globalMetric?.totalResources || 0,
        totalAccounts: 0,
        totalRegions: globalMetric?.resourceRegionsFound || 0,
        lastUpdated: globalMetric?.updatedAt ? new Date(globalMetric.updatedAt) : new Date()
      },
      accountDistribution: [],
      regionDistribution: [],
      recentResources: [],
      resourceCounts: new Map()
    };
    
    // Processa distribuições
    if (globalMetric) {
      result.accountDistribution = this.normalizeAccountDistribution(globalMetric);
      result.regionDistribution = this.normalizeRegionDistribution(globalMetric);
      result.recentResources = this.normalizeRecentResources(globalMetric);
      result.resourceCounts = this.extractResourceCounts(globalMetric);
      result.summary.totalAccounts = result.accountDistribution.length;
    }
    
    // Processa EC2 Health
    if (ec2Metric) {
      result.ec2Health = {
        total: ec2Metric.total || 0,
        running: ec2Metric.byState_running || 0,
        stopped: ec2Metric.byState_stopped || 0,
        healthy: ec2Metric.healthStatus_Healthy || 0,
        cloudwatchAgentCoverage: ec2Metric.cloudwatchAgent_percentageWithMemory || 0,
        ssmAgentCoverage: ec2Metric.ssmAgent_percentageConnected || 0
      };
    }
    
    // Processa Cost Optimization
    if (costMetric) {
      result.costOptimization = {
        potentialSavings: costMetric.potentialMonthlySavings || 0,
        unassociatedIPs: costMetric.unassociatedElasticIPs || 0,
        unattachedVolumes: costMetric.unattachedEBSVolumes || 0
      };
    }
    
    // Processa Security
    if (securityMetric) {
      result.security = {
        totalGroups: securityMetric.resourceCounts_SecurityGroup || 0,
        exposedGroups: securityMetric.exposedSecurityGroups || 0,
        exposurePercentage: securityMetric.percentageExposed || 0
      };
    }
    
    // Processa Storage
    if (storageMetric) {
      const totalBuckets = storageMetric.s3Buckets || 0;
      const withLifecycle = storageMetric.s3WithLifecycle || 0;
      
      result.storage = {
        totalSnapshots: (storageMetric.amiSnapshots || 0) + (storageMetric.ebsSnapshots || 0),
        totalVolumes: storageMetric.ebsVolumes || 0,
        s3Buckets: totalBuckets,
        s3WithLifecycle: withLifecycle,
        lifecyclePercentage: totalBuckets > 0 ? Math.round((withLifecycle / totalBuckets) * 100) : 0
      };
    }
    
    return result;
  }

  /**
   * Helpers para formatação
   */
  private getAccountDisplayName(accountName: string | undefined, accountId: string): string {
    const accountMap: { [key: string]: string } = {
      '767398083881': 'Infra',
      '905418331872': 'Arquiteturas e Sistemas', 
      '058264393294': 'MagisterApps Prod',
      '533267337185': 'Network',
      '123456789012': 'Operacional',
      '234567890123': 'BackOffice',
      '345678901234': 'ITP',
      '456789012345': 'Terminal Service',
      '567890123456': 'Biblioteca',
      '678901234567': 'Ficou Facil'
    };
    
    if (accountName && accountName !== 'CustomAccount') {
      return accountName;
    }
    
    return accountMap[accountId] || `Account ${accountId.slice(-4)}`;
  }

  private getRegionDisplayName(region: string | undefined): string {
    if (!region) return 'Unknown';
    
    const regionMap: { [key: string]: string } = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-central-1': 'EU (Frankfurt)',
      'eu-west-1': 'EU (Ireland)',
      'eu-west-2': 'EU (London)',
      'eu-north-1': 'EU (Stockholm)',
      'ap-south-1': 'Asia Pacific (Mumbai)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      'ap-northeast-2': 'Asia Pacific (Seoul)',
      'ap-northeast-3': 'Asia Pacific (Osaka)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'sa-east-1': 'South America (São Paulo)'
    };
    
    return regionMap[region] || region;
  }

  private formatResourceType(type: string): string {
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, str => str.toUpperCase());
  }

  private extractResourceName(identifier: string): string {
    const parts = identifier.split('-');
    return parts.length > 3 ? parts.slice(-1)[0] : identifier;
  }
}