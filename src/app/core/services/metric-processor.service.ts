// src/app/core/services/metric-processor.service.ts
import { Injectable } from '@angular/core';
import type { AWSMetricsModel } from '../../models/metric.model';

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
   * Processa dados de métrica com suporte completo a formato DynamoDB
   */
  public processMetricData(metric: any): AWSMetricsModel {
    console.log('[MetricProcessor] Raw metric data:', metric);
    
    // Primeiro, processa todos os campos para extrair valores do DynamoDB
    const processed: any = {};
    
    for (const key in metric) {
      if (metric.hasOwnProperty(key)) {
        processed[key] = this.extractDynamoValue(metric[key]);
      }
    }

    console.log('[MetricProcessor] After DynamoDB extraction:', processed);

    // Agora aplica conversões específicas de tipo
    
    // Converter campos de data
    const dateFields = ['createdAt', 'updatedAt', 'metricDate', 'lastUpdated'];
    dateFields.forEach(field => {
      if (processed[field]) {
        if (typeof processed[field] === 'string') {
          processed[field] = new Date(processed[field]);
        } else if (typeof processed[field] === 'number') {
          // Se for timestamp Unix
          processed[field] = new Date(processed[field] * 1000);
        }
      }
    });

    // Lista completa de campos numéricos baseada no modelo
    const numericFields = [
      // Summary fields
      'total', 'totalResources', 'resourceRegionsFound', 'regionsCollected',
      
      // EC2 Health fields
      'byState_running', 'byState_stopped', 'byState_pending', 'byState_terminated',
      'healthStatus_Healthy', 'healthStatus_Stopped', 'healthStatus_Unhealthy',
      
      // CloudWatch Agent fields
      'cloudwatchAgent_bothEnabled', 'cloudwatchAgent_diskMonitoring',
      'cloudwatchAgent_memoryMonitoring', 'cloudwatchAgent_noneEnabled',
      'cloudwatchAgent_percentageWithDisk', 'cloudwatchAgent_percentageWithMemory',
      
      // SSM Agent fields
      'ssmAgent_connected', 'ssmAgent_notConnected', 'ssmAgent_notInstalled',
      'ssmAgent_percentageConnected',
      
      // Cost Optimization fields
      'potentialMonthlySavings', 'unassociatedElasticIPs', 'unattachedEBSVolumes',
      
      // Security fields
      'exposedSecurityGroups', 'percentageExposed',
      
      // RDS fields
      'available', 'engines_aurora_mysql', 'multiAZ', 'percentageMultiAZ',
      'performanceInsights', 'percentageWithPerfInsights',
      
      // Storage fields
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

    // Força conversão numérica para todos os campos numéricos
    numericFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        const value = processed[field];
        if (typeof value === 'string') {
          processed[field] = parseFloat(value) || 0;
        } else if (typeof value !== 'number') {
          console.warn(`[MetricProcessor] Unexpected type for ${field}:`, typeof value, value);
          processed[field] = 0;
        }
      }
    });

    // Processa campos JSON (arrays/objetos)
    const jsonFields = ['accountDistribution', 'regionDistribution', 'recentResources'];
    jsonFields.forEach(field => {
      if (processed[field]) {
        if (typeof processed[field] === 'string') {
          try {
            processed[field] = JSON.parse(processed[field]);
          } catch (error) {
            console.error(`[MetricProcessor] Failed to parse JSON for ${field}:`, error);
            // Mantém como string se falhar o parse
          }
        }
      }
    });

    console.log('[MetricProcessor] Final processed metric:', processed);
    
    return processed as AWSMetricsModel;
  }

  /**
   * Método auxiliar para debug - lista todos os campos com seus tipos
   */
  public debugMetricTypes(metric: any): void {
    console.group('[MetricProcessor] Debug Field Types');
    for (const key in metric) {
      if (metric.hasOwnProperty(key)) {
        const value = metric[key];
        const type = typeof value;
        const isObject = type === 'object';
        const isDynamoFormat = isObject && value && ('N' in value || 'S' in value || 'BOOL' in value);
        
        console.log(`${key}:`, {
          type,
          isDynamoFormat,
          rawValue: value,
          extractedValue: this.extractDynamoValue(value)
        });
      }
    }
    console.groupEnd();
  }
}