// src/app/models/resource.model.ts
import { Schema } from "../../../amplify/data/resource";
// ========================================
// METRICS INTERFACES
// ========================================
export interface BaseMetric {
  id: string;
  metricDate?: string;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MetricGlobalSummary extends BaseMetric {
  totalResources?: number;
  resourceRegionsFound?: number;
  regionsCollected?: number;
  
  accountDistribution?: any;  // JSON field
  regionDistribution?: any;   // JSON field
  recentResources?: any;      // JSON field
  
  resourceCounts_AMI?: number;
  resourceCounts_AutoScalingGroup?: number;
  resourceCounts_DirectConnectConnection?: number;
  resourceCounts_DirectConnectVirtualInterface?: number;
  resourceCounts_EBSSnapshot?: number;
  resourceCounts_EBSVolume?: number;
  resourceCounts_EC2Instance?: number;
  resourceCounts_ElasticIP?: number;
  resourceCounts_InternetGateway?: number;
  resourceCounts_LoadBalancer?: number;
  resourceCounts_NetworkACL?: number;
  resourceCounts_RDSClusterSnapshot?: number;
  resourceCounts_RDSInstance?: number;
  resourceCounts_RouteTable?: number;
  resourceCounts_S3Bucket?: number;
  resourceCounts_SecurityGroup?: number;
  resourceCounts_Subnet?: number;
  resourceCounts_TransitGateway?: number;
  resourceCounts_TransitGatewayAttachment?: number;
  resourceCounts_VPC?: number;
  resourceCounts_VPCEndpoint?: number;
  resourceCounts_VPNConnection?: number;
}

export interface MetricEC2Health extends BaseMetric {
  total?: number;
  byState_running?: number;
  byState_stopped?: number;
  
  healthStatus_Healthy?: number;
  healthStatus_Stopped?: number;
  
  cloudwatchAgent_bothEnabled?: number;
  cloudwatchAgent_diskMonitoring?: number;
  cloudwatchAgent_memoryMonitoring?: number;
  cloudwatchAgent_noneEnabled?: number;
  cloudwatchAgent_percentageWithDisk?: number;
  cloudwatchAgent_percentageWithMemory?: number;
  
  ssmAgent_connected?: number;
  ssmAgent_notConnected?: number;
  ssmAgent_notInstalled?: number;
  ssmAgent_percentageConnected?: number;
}

export interface MetricCostOptimization extends BaseMetric {
  potentialMonthlySavings?: number;
  unassociatedElasticIPs?: number;
  unattachedEBSVolumes?: number;
}

export interface MetricSecurity extends BaseMetric {
  exposedSecurityGroups?: number;
  percentageExposed?: number;
}

export interface MetricRDS extends BaseMetric {
  total?: number;
  available?: number;
  engines_aurora_mysql?: number;
  multiAZ?: number;
  percentageMultiAZ?: number;
  performanceInsights?: number;
  percentageWithPerfInsights?: number;
}

export interface MetricStorage extends BaseMetric {
  amiSnapshots?: number;
  ebsSnapshots?: number;
  ebsVolumes?: number;
  s3Buckets?: number;
  s3WithLifecycle?: number;
}

export type AWSMetricsModel = Schema['AWSMetrics']['type'];

export type AWSMetric = 
  | MetricGlobalSummary
  | MetricEC2Health
  | MetricCostOptimization
  | MetricSecurity
  | MetricRDS
  | MetricStorage;
