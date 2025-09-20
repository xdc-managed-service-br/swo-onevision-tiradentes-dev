// src/app/models/metric.model.ts
import { Schema } from "../../../amplify/data/resource";

// ========================================
// METRICS INTERFACES
// ========================================
export interface BaseMetric {
  id: string;

  // Do backend
  resourceType?: string; // e.g., METRIC_SUMMARY, METRIC_EC2_HEALTH, etc.
  accountId?: string;    // normalmente "GLOBAL"
  region?: string;       // normalmente "global"

  // Carimbos de data
  metricDate?: string;
  createdAt?: string;
  updatedAt?: string;

  // Extras úteis
  isMetric?: boolean;
  processingDurationSeconds?: number;
}

// ---------- GLOBAL SUMMARY ----------
export interface MetricGlobalSummary extends BaseMetric {
  totalResources?: number;
  resourceRegionsFound?: number;
  regionsCollected?: number;

  // JSON blobs (mantidos como any)
  accountDistribution?: any;  // [{ accountId, accountName, count }, ...]
  regionDistribution?: any;   // [{ region, count }, ...]
  recentResources?: any;      // últimos recursos vistos

  // Resource counts (flatten)
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

  // Novos resourceCounts para storage/backup
  resourceCounts_EFSFileSystem?: number;
  resourceCounts_FSxFileSystem?: number;
  resourceCounts_BackupPlan?: number;
  resourceCounts_BackupVault?: number;
  resourceCounts_BackupRecoveryPoint?: number;

  // Network health aggregates (flattened keys)
  networkHealth_directConnectConnections_total?: number;
  networkHealth_directConnectConnections_healthy?: number;
  networkHealth_directConnectConnections_unhealthy?: number;
  networkHealth_directConnectConnections_healthyPercentage?: number;
  networkHealth_directConnectVirtualInterfaces_total?: number;
  networkHealth_directConnectVirtualInterfaces_healthy?: number;
  networkHealth_directConnectVirtualInterfaces_unhealthy?: number;
  networkHealth_directConnectVirtualInterfaces_healthyPercentage?: number;
  networkHealth_vpnConnections_total?: number;
  networkHealth_vpnConnections_healthy?: number;
  networkHealth_vpnConnections_unhealthy?: number;
  networkHealth_vpnConnections_healthyPercentage?: number;
  networkHealth_transitGateways_total?: number;
  networkHealth_transitGateways_healthy?: number;
  networkHealth_transitGateways_unhealthy?: number;
  networkHealth_transitGateways_healthyPercentage?: number;
}

// ---------- EC2 HEALTH ----------
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

// ---------- COST OPTIMIZATION ----------
export interface MetricCostOptimization extends BaseMetric {
  potentialMonthlySavings?: number;
  unassociatedElasticIPs?: number;
  unattachedEBSVolumes?: number;
}

// ---------- SECURITY ----------
export interface MetricSecurity extends BaseMetric {
  exposedSecurityGroups?: number;
  percentageExposed?: number;
}

// ---------- RDS ----------
export interface MetricRDS extends BaseMetric {
  total?: number;
  available?: number;
  engines_aurora_mysql?: number;
  multiAZ?: number;
  percentageMultiAZ?: number;
  performanceInsights?: number;
  percentageWithPerfInsights?: number;
}

// ---------- STORAGE (S3/EBS/EFS/FSx/Backup) ----------
export interface MetricStorage extends BaseMetric {
  // já existiam
  amiSnapshots?: number;
  ebsSnapshots?: number;
  ebsVolumes?: number;
  s3Buckets?: number;
  s3WithLifecycle?: number;

  // novos agregados
  efsFileSystems?: number;
  fsxFileSystems?: number;
  backupPlans?: number;
  backupVaults?: number;
  backupRecoveryPoints?: number;
}

// Tipos derivados do schema Amplify
export type AWSMetricsModel = Schema['AWSMetrics']['type'];

// União útil para telas/consumo
export type AWSMetric =
  | MetricGlobalSummary
  | MetricEC2Health
  | MetricCostOptimization
  | MetricSecurity
  | MetricRDS
  | MetricStorage;
