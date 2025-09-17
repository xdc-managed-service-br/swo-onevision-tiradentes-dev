

// src/app/core/services/metric-processor.service.ts
import { Injectable } from '@angular/core';
import type { AWSMetricsModel } from '../../models/metric.model';

@Injectable({ providedIn: 'root' })
export class MetricProcessorService {
  constructor() {}

  public processMetricData(metric: any): AWSMetricsModel {
    const processed: any = { ...metric };

    // Convert dates
    if (processed.createdAt && typeof processed.createdAt === 'string') {
      processed.createdAt = new Date(processed.createdAt);
    }
    if (processed.updatedAt && typeof processed.updatedAt === 'string') {
      processed.updatedAt = new Date(processed.updatedAt);
    }
    if (processed.metricDate && typeof processed.metricDate === 'string') {
      processed.metricDate = new Date(processed.metricDate);
    }

    // Coerce numeric fields
    const numericFields = [
      'total', 'byState_running', 'byState_stopped',
      'totalResources', 'resourceCounts_EC2Instance', 'resourceCounts_S3Bucket',
      'resourceCounts_VPC', 'resourceCounts_SecurityGroup', 'resourceCounts_RDSInstance',
      'healthStatus_Healthy', 'healthStatus_Stopped',
      'cloudwatchAgent_bothEnabled', 'cloudwatchAgent_diskMonitoring',
      'cloudwatchAgent_memoryMonitoring', 'cloudwatchAgent_noneEnabled',
      'cloudwatchAgent_percentageWithDisk', 'cloudwatchAgent_percentageWithMemory',
      'ssmAgent_connected', 'ssmAgent_notConnected', 'ssmAgent_notInstalled',
      'ssmAgent_percentageConnected', 'potentialMonthlySavings',
      'unassociatedElasticIPs', 'unattachedEBSVolumes',
      'exposedSecurityGroups', 'percentageExposed'
    ];

    numericFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        if (typeof processed[field] !== 'number') {
          processed[field] = parseFloat(processed[field]) || 0;
        }
      }
    });

    // Parse JSON fields if they are strings
    ['accountDistribution', 'regionDistribution', 'recentResources'].forEach(key => {
      if (typeof processed[key] === 'string') {
        try {
          processed[key] = JSON.parse(processed[key]);
        } catch {
          // keep as string
        }
      }
    });

    return processed as AWSMetricsModel;
  }
}