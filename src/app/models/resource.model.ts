// src/app/models/resource.model.ts

export interface BaseResource {
  id: string;                        // Ex: "accountId-region-ResourceType-resourceId"
  resourceType: string;              // AMI | EBSSnapshot | EBSVolume | EC2Instance | RDSInstance | S3Bucket
  accountId: string;
  accountName?: string;
  region: string;
  createdAt?: string;
  lastUpdated?: string;
  updatedAt?: string;
  tags?: string;                     // JSON string vinda do DynamoDB
  resourceTypeRegionId?: string;     // Combinação ResourceType#region#id
}

// AMI
export interface AMI extends BaseResource {
  imageId: string;
  imageName: string;
  imageState: string;
  description?: string;
  platform?: string;                 // Ex: "Linux/UNIX"
}

// EBS Snapshot
export interface EBSSnapshot extends BaseResource {
  snapshotId: string;
  snapshotName: string;
  snapshotState: string;
  volumeId: string;
  volumeSize: number;
  encrypted: boolean;
}

// EBS Volume
export interface EBSVolume extends BaseResource {
  volumeId: string;
  volumeName: string;
  volumeState: string;
  volumeType: string;
  size: number;
  encrypted: boolean;
  attachedInstances?: string[];      // JSON string → convertido para array
}

// EC2 Instance
export interface EC2Instance extends BaseResource {
  instanceId: string;
  instanceName: string;
  instanceType: string;
  instanceState: string;
  platformDetails: string;
  amiName?: string;
  iamRole?: string;
  isWindows: boolean;
  patchGroup?: string;

  // Networking
  instancePrivateIps?: string[];      // JSON string → convertido para array
  instancePublicIps?: string[];       // JSON string → convertido para array
  privateIpArray?: string[];
  publicIpArray?: string[];
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

  // CW Agent
  cwAgentMemoryDetected: boolean;
  cwAgentDiskDetected: boolean;

  // SWO
  swoMonitor?: string;
  swoPatch?: string;
  swoBackup?: string;
  swoRiskClass?: string;

  // Scheduling
  startStop?: string;
  autoStart?: string;
  autoShutdown?: string;
  saturday?: string;
  sunday?: string;
}

// RDS Instance
export interface RDSInstance extends BaseResource {
  dbInstanceId: string;
  dbInstanceName: string;
  dbInstanceArn: string;
  engine: string;
  engineVersion: string;
  instanceClass: string;
  status: string;
  allocatedStorage: number;
  storageType: string;
  multiAZ: boolean;
  performanceInsightsEnabled: boolean;
}

// S3 Bucket
export interface S3Bucket extends BaseResource {
  bucketName: string;
  bucketNameTag?: string;
  hasLifecycleRules: boolean;
}

// União de todos os tipos de recurso
export type AWSResource =
  | AMI
  | EBSSnapshot
  | EBSVolume
  | EC2Instance
  | RDSInstance
  | S3Bucket;