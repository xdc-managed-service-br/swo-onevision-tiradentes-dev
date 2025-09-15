// src/app/models/resource.model.ts

// ========================================
// METRICS INTERFACES
// ========================================

export interface BaseMetric {
  id: string;
  resourceType: string;
  isMetric?: boolean;
  metricDate?: string;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MetricGlobalSummary extends BaseMetric {
  // Campos principais
  totalResources?: number;
  resourceRegionsFound?: number;
  regionsCollected?: number;
  
  // Distribuições (JSON fields)
  accountDistribution?: any;  // JSON field
  regionDistribution?: any;   // JSON field
  recentResources?: any;      // JSON field
  
  // Resource counts
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
  // Totais e estados
  total?: number;
  byState_running?: number;
  byState_stopped?: number;
  
  // Health status
  healthStatus_Healthy?: number;
  healthStatus_Stopped?: number;
  
  // CloudWatch Agent
  cloudwatchAgent_bothEnabled?: number;
  cloudwatchAgent_diskMonitoring?: number;
  cloudwatchAgent_memoryMonitoring?: number;
  cloudwatchAgent_noneEnabled?: number;
  cloudwatchAgent_percentageWithDisk?: number;
  cloudwatchAgent_percentageWithMemory?: number;
  
  // SSM Agent
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

export type AWSMetric = 
  | MetricGlobalSummary
  | MetricEC2Health
  | MetricCostOptimization
  | MetricSecurity
  | MetricRDS
  | MetricStorage;

export type MetricByType<T extends string> = 
  T extends 'METRIC_SUMMARY' ? MetricGlobalSummary :
  T extends 'METRIC_EC2_HEALTH' ? MetricEC2Health :
  T extends 'METRIC_COST' ? MetricCostOptimization :
  T extends 'METRIC_SECURITY' ? MetricSecurity :
  T extends 'METRIC_RDS' ? MetricRDS :
  T extends 'METRIC_STORAGE' ? MetricStorage :
  BaseMetric;
export interface BaseResource {
  // Base fields
  id: string;
  resourceType: string;
  accountId: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  
  // Base optional fields
  accountName?: string;
  tags?: any; // JSON object
  availabilityZones?: string[];
  resourceTypeRegionId?: string; // Mantido para compatibilidade
}

// AMI
export interface AMI extends BaseResource {
  imageId: string;
  imageName: string;
  imageNameTag?: string;
  imageState: string;
  platform?: string;
  description?: string; // Generic field
}

// Auto Scaling Group
export interface AutoScalingGroup extends BaseResource {
  autoScalingGroupARN?: string;
  autoScalingGroupArn?: string;
  autoScalingGroupName: string;
  autoScalingGroupNameTag?: string;
  currentSize?: number;
  desiredCapacity?: number;
  healthCheckGracePeriod?: number;
  healthCheckType?: string;
  healthyInstances?: number;
  instanceIds?: string[];
  loadBalancerNames?: string[];
  targetGroupARNs?: string[];
  launchTemplate?: any; // JSON object
  maxSize?: number;
  minSize?: number;
  serviceLinkedRoleArn?: string;
  vpcZoneIdentifier?: string;
}

// Direct Connect Connection
export interface DirectConnectConnection extends BaseResource {
  connectionId: string;
  connectionName?: string;
  connectionState: string;
  location?: string;
  bandwidth?: string;
  vlan?: number;
  partnerName?: string;
  awsDevice?: string;
  awsDeviceV2?: string;
  hasLogicalRedundancy?: string;
  macSecCapable?: boolean;
  portEncryptionStatus?: string;
  encryptionMode?: string;
}

// EBS Snapshot
export interface EBSSnapshot extends BaseResource {
  snapshotId: string;
  snapshotName?: string;
  snapshotState: string;
  volumeSize?: number;
  volumeId?: string; // Generic field
  encrypted?: boolean; // Generic field
}

// EBS Volume
export interface EBSVolume extends BaseResource {
  volumeName?: string;
  volumeState: string;
  volumeType: string;
  size?: number;
  attachedInstances?: string[];
  volumeId?: string; // Generic field
  encrypted?: boolean; // Generic field
}

// EC2 Instance
export interface EC2Instance extends BaseResource {
  instanceName?: string;
  instanceType: string;
  instanceState: string;
  platformDetails?: string;
  amiName?: string;
  iamRole?: string;
  isWindows?: boolean;
  patchGroup?: string;
  
  // Networking
  instancePrivateIps?: string[];
  instancePublicIps?: string[];
  
  // Health
  healthStatus?: string;
  healthChecksPassed?: number;
  healthChecksTotal?: number;
  systemStatus?: string;
  instanceStatus?: string;
  ebsStatus?: string;
  
  // SSM
  ssmStatus?: string;
  ssmPingStatus?: string;
  ssmVersion?: string;
  ssmLastPingTime?: string;
  
  // CloudWatch Agent
  cwAgentMemoryDetected?: boolean;
  cwAgentDiskDetected?: boolean;
  
  // SWO
  swoMonitor?: string;
  swoPatch?: string;
  swoBackup?: string;
  swoRiskClass?: string;
  
  // Generic field
  instanceId?: string;
  autoStart?: number;
  autoShutdown?: number;
  saturday?: string;
  sunday?: string;
}

// Elastic IP
export interface ElasticIP extends BaseResource {
  allocationId: string;
  associationId?: string;
  domain?: string;
  eipName?: string;
  networkBorderGroup?: string;
  networkInterfaceId?: string;
  networkInterfaceOwnerId?: string;
  privateIpAddress?: string;
  publicIp: string;
  instanceId?: string; // Generic field
}

// Internet Gateway
export interface InternetGateway extends BaseResource {
  internetGatewayId: string;
  internetGatewayName?: string;
  attachedVpcs?: string[];
  attachmentCount?: number;
}

// Load Balancer
export interface LoadBalancer extends BaseResource {
  loadBalancerArn: string;
  loadBalancerName: string;
  loadBalancerNameTag?: string;
  dnsName?: string;
  canonicalHostedZoneId?: string;
  scheme?: string;
  ipAddressType?: string;
  targetGroups?: string[];
  securityGroups?: number; // Generic field
  vpcId?: string; // Generic field
  state?: string; // Generic field
  type?: string; // Generic field
}

// Network ACL
export interface NetworkACL extends BaseResource {
  networkAclId: string;
  networkAclName?: string;
  customDenyRuleCount?: number;
  associationCount?: number; // Generic field
  associatedSubnets?: string[]; // Generic field
  ingressRuleCount?: number; // Generic field
  egressRuleCount?: number; // Generic field
  vpcId?: string; // Generic field
  isDefault?: boolean; // Generic field
}

// RDS Cluster Snapshot
export interface RDSClusterSnapshot extends BaseResource {
  snapshotArn?: string;
  snapshotType?: string;
  clusterId?: string;
  engine?: string;
  status?: string;
  allocatedStorage?: number;
}

// RDS Instance
export interface RDSInstance extends BaseResource {
  dbInstanceArn?: string;
  dbInstanceId: string;
  dbInstanceName?: string;
  engine?: string;
  engineVersion?: string;
  instanceClass?: string;
  status?: string;
  allocatedStorage?: number;
  storageType?: string;
}

// Route Table
export interface RouteTable extends BaseResource {
  routeTableId: string;
  routeTableName?: string;
  routeCount?: number;
  hasInternetRoute?: boolean;
  hasNatRoute?: boolean;
  hasVpcPeeringRoute?: boolean;
  isMain?: boolean;
  associationCount?: number; // Generic field
  associatedSubnets?: string[]; // Generic field
}

// S3 Bucket
export interface S3Bucket extends BaseResource {
  bucketName: string;
  bucketNameTag?: string;
  hasLifecycleRules?: boolean;
  objectCount?: number;
  storageBytes?: string;
}

// Security Group
export interface SecurityGroup extends BaseResource {
  groupId: string;
  groupName: string;
  groupNameTag?: string;
  description?: string; // Generic field
  ingressRuleCount?: number; // Generic field
  egressRuleCount?: number; // Generic field
  vpcId?: string; // Generic field
}

// Subnet
export interface Subnet extends BaseResource {
  subnetId: string;
  subnetName?: string;
  availabilityZone?: string;
  availabilityZoneId?: string;
  availableIpAddressCount?: number;
  state?: string; // Generic field
  cidrBlock?: string; // Generic field
}

// Transit Gateway
export interface TransitGateway extends BaseResource {
  transitGatewayName?: string;
  amazonSideAsn?: number;
  defaultRouteTableAssociation?: string;
  defaultRouteTablePropagation?: string;
  dnsSupport?: string;
  multicastSupport?: string;
  vpnEcmpSupport?: string;
  ownerId?: string;
  transitGatewayId?: string; // Generic field
}

// Transit Gateway Attachment
export interface TransitGatewayAttachment extends BaseResource {
  transitGatewayAttachmentId: string;
  attachmentName?: string;
  attachedResourceId?: string;
  attachedResourceType?: string;
  association?: any; // JSON object
  resourceOwnerId?: string;
  transitGatewayOwnerId?: string;
  transitGatewayId?: string; // Generic field
}

// VPC
export interface VPC extends BaseResource {
  vpcName?: string;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  flowLogsEnabled?: boolean;
  instanceTenancy?: string;
  vpcId?: string; // Generic field
  cidrBlock?: string; // Generic field
  isDefault?: boolean; // Generic field
}

// VPC Endpoint
export interface VPCEndpoint extends BaseResource {
  vpcEndpointId: string;
  vpcEndpointName?: string;
  vpcEndpointType?: string;
  serviceName?: string;
  policyDocument?: any; // JSON object
  privateDnsEnabled?: boolean;
  routeTableIds?: string[];
  subnetIds?: string[];
  securityGroupIds?: string[];
}

// VPN Connection
export interface VPNConnection extends BaseResource {
  vpnConnectionId: string;
  vpnConnectionName?: string;
  vpnGatewayId?: string;
  customerGatewayId?: string;
  category?: string;
  tunnelCount?: number;
  tunnelsUp?: number;
  transitGatewayId?: string; // Generic field
  type?: string; // Generic field
}

// Additional models
export interface PatchRequest {
  id: string;
  instanceId: string;
  action: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface ResourceComment {
  id: string;
  resourceId: string;
  author: string;
  text: string;
  createdAt: string;
}

export type AWSResource =
  | AMI
  | AutoScalingGroup
  | DirectConnectConnection
  | EBSSnapshot
  | EBSVolume
  | EC2Instance
  | ElasticIP
  | InternetGateway
  | LoadBalancer
  | NetworkACL
  | RDSClusterSnapshot
  | RDSInstance
  | RouteTable
  | S3Bucket
  | SecurityGroup
  | Subnet
  | TransitGateway
  | TransitGatewayAttachment
  | VPC
  | VPCEndpoint
  | VPNConnection