// src/app/models/resource.model.ts
import { Schema } from "../../../amplify/data/resource";

// ========================================
// RESOURCE INTERFACES
// ========================================
export interface BaseResource {
  id: string;
  resourceType: string;
  accountId: string;
  region: string;
  createdAt: string;
  updatedAt: string;

  accountName?: string;
  tags?: any; // JSON object
  metrics?: any; // JSON object (coletado pelos coletores)
  availabilityZones?: string[];
  resourceTypeRegionId?: string; // helper calculado no frontend, se usado
}
export interface TagKV {
  Key: string;
  Value: string;
}
// AMI
export interface AMI extends BaseResource {
  imageId: string;
  imageNameTag?: string;
  imageName: string;
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
  instanceName?: string | null;
  instanceType: string;
  instanceState: string;
  platformDetails?: string;
  amiName?: string;
  iamRole?: string;
  isWindows?: boolean;
  patchGroup?: string;

  instancePrivateIps?: string[];
  instancePublicIps?: string[];

  healthStatus?: string;
  healthChecksPassed?: number;
  healthChecksTotal?: number;
  systemStatus?: string;
  instanceStatus?: string;
  ebsStatus?: string;

  ssmStatus?: string;
  ssmPingStatus?: string;
  ssmVersion?: string;
  ssmLastPingTime?: string;

  cwAgentMemoryDetected?: boolean;
  cwAgentDiskDetected?: boolean;

  swoMonitor?: string;
  swoPatch?: string;
  swoBackup?: string;
  swoRiskClass?: string;

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

// NAT Gateway
export interface NATGateway extends BaseResource {
  natGatewayId: string;
  natGatewayName?: string;
  state?: string;
  natGatewayType?: string;
  connectivityType?: string;
  subnetId?: string;
  vpcId?: string;
  elasticIpAllocationId?: string;
  publicIp?: string;
  privateIp?: string;
  natGatewayAddresses?: string[];
  networkInterfaceIds?: string[];
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
  vpcId?: string; // Generic field
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
  encryption?: string;         // NOVO
  versioning?: string;         // NOVO
  publicAccessBlock?: boolean; // NOVO
}

// EFS File System
export interface EFSFileSystem extends BaseResource {
  fileSystemId?: string;
  performanceMode?: string;
  throughputMode?: string;
  provisionedThroughputInMibps?: number;
  lifecyclePolicies?: string[];
  backupPolicyEnabled?: boolean;
  mountTargetsCount?: number;
  sizeInBytes?: string; // human-readable
}

// FSx File System
export interface FSxFileSystem extends BaseResource {
  fileSystemId?: string;
  fileSystemType?: string; // WINDOWS | ONTAP | LUSTRE | OPENZFS
  deploymentType?: string;
  storageCapacity?: number;
  throughputCapacity?: number;
  automaticBackupRetentionDays?: number;
  dailyAutomaticBackupStartTime?: string;
  copyTagsToBackups?: boolean;
  lifecycle?: string;
}

// AWS Backup - Plan
export interface BackupPlan extends BaseResource {
  backupPlanId?: string;
  backupPlanName?: string;
  schedules?: string[];
  selectionResourceTypes?: string[];
  targetBackupVault?: string;
  lastExecutionDate?: string; // datetime
  windowStart?: number;       // minutos
  windowDuration?: number;    // minutos
}

// AWS Backup - Vault
export interface BackupVault extends BaseResource {
  backupVaultName?: string;
  encryptionKeyArn?: string;
  numberOfRecoveryPoints?: number;
  latestRecoveryPointAgeDays?: number;
  locked?: boolean;
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
  state?: string; // Generic field
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

// VPN Gateway
export interface VPNGateway extends BaseResource {
  vpnGatewayId: string;
  vpnGatewayName?: string;
  type?: string;
  state?: string;
  amazonSideAsn?: number;
  availabilityZone?: string;
  attachedVpcIds?: string[];
  attachmentCount?: number;
  vpcId?: string; // For normalized attachments
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

export type AWSResourceModel = Schema['AWSResource']['type'];

export type AWSResource =
  | AMI
  | AutoScalingGroup
  | DirectConnectConnection
  | EBSSnapshot
  | EBSVolume
  | EC2Instance
  | ElasticIP
  | InternetGateway
  | NATGateway
  | LoadBalancer
  | NetworkACL
  | RDSClusterSnapshot
  | RDSInstance
  | RouteTable
  | S3Bucket
  | EFSFileSystem
  | FSxFileSystem
  | BackupPlan
  | BackupVault
  | SecurityGroup
  | Subnet
  | TransitGateway
  | TransitGatewayAttachment
  | VPC
  | VPCEndpoint
  | VPNConnection
  | VPNGateway