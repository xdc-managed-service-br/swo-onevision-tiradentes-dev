// src/app/shared/utils/export-fields.ts

/**
 * Field definitions for CSV exports by resource type
 */
export const ExportFields: Record<string, string[]> = {
  // EC2 Instance fields
  'EC2Instance': [
    'instanceId',
    'instanceName',
    'instanceType',
    'state',
    'platformDetails',
    'amiName',
    'region',
    'accountId',
    'accountName',
    'launchTime',
    'createdAt',
    'cwAgentMemoryDetected',
    'cwAgentDiskDetected',
    'healthStatus',
    'systemStatus',
    'instanceStatus',
    'ebsStatus',
    'swoMonitor',
    'swoBackup'
  ],
  
  // S3 Bucket fields
  'S3Bucket': [
    'bucketName',
    'creationDate',
    'region',
    'accountId',
    'accountName',
    'storageClass',
    'hasLifecycleRules'
  ],
  
  // EBS Volume fields
  'EBSVolume': [
    'volumeId',
    'size',
    'volumeType',
    'encrypted',
    'region',
    'accountId',
    'accountName'
  ],
  
  // RDS Instance fields
  'RDSInstance': [
    'dbInstanceId',
    'engine',
    'engineVersion',
    'status',
    'allocatedStorage',
    'instanceClass',
    'region',
    'accountId',
    'accountName'
  ],
  
  // EBS Snapshot fields
  'EBSSnapshot': [
    'snapshotId',
    'volumeId',
    'volumeSize',
    'startTime',
    'state',
    'encrypted',
    'region',
    'accountId'
  ],
  
  // AMI Snapshot fields
  'AMISnapshot': [
    'imageId',
    'name',
    'platform',
    'startTime',
    'region',
    'accountId'
  ]
};