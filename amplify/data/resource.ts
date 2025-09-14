// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  AWSResource: a.model({
    // ===== BASE FIELDS =====
    id: a.string().required(),
    resourceType: a.string().required(),
    accountId: a.string().required(),
    region: a.string().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    
    // ===== BASE OPTIONAL FIELDS =====
    accountName: a.string(),
    tags: a.json(),
    availabilityZones: a.string().array(), // Load Balancer and ASG

    // ===== GENERIC FIELDS =====
    volumeId: a.string(),   // EBS Volume and Snapshot
    encrypted: a.boolean(), // EBS Volume and Snapshot
    instanceId: a.string(), // EC2 Instance and Elastic IP

    // ===== AMI FIELDS =====
    imageId: a.string(),
    imageName: a.string(),
    imageNameTag: a.string(),
    imageState: a.string(),
    description: a.string(),
    platform: a.string(),

    // ===== EC2 Instance FIELDS =====
    amiName: a.string(),
    cwAgentDiskDetected: a.boolean(),
    cwAgentMemoryDetected: a.boolean(),
    ebsStatus: a.string(),
    healthChecksPassed: a.integer(),
    healthChecksTotal: a.integer(),
    healthStatus: a.string(),
    iamRole: a.string(),
    instanceName: a.string(),
    instancePrivateIps: a.string().array(),
    instancePublicIps: a.string().array(),
    instanceState: a.string(),
    instanceStatus: a.string(),
    instanceType: a.string(),
    isWindows: a.boolean(),
    patchGroup: a.string(),
    platformDetails: a.string(),
    ssmLastPingTime: a.datetime(),
    ssmPingStatus: a.string(),
    ssmStatus: a.string(),
    ssmVersion: a.string(),
    swoBackup: a.string(),
    swoMonitor: a.string(),
    swoPatch: a.string(),
    swoRiskClass: a.string(),
    systemStatus: a.string(),

    // ===== ASG FIELDS =====
    autoScalingGroupARN: a.string(),
    autoScalingGroupArn: a.string(),
    autoScalingGroupName: a.string(),
    autoScalingGroupNameTag: a.string(),
    currentSize: a.integer(),
    desiredCapacity: a.integer(),
    healthCheckGracePeriod: a.integer(),
    healthCheckType: a.string(),
    healthyInstances: a.integer(),
    instanceIds: a.string().array(),
    loadBalancerNames: a.string().array(),
    targetGroupARNs: a.string().array(),
    launchTemplate: a.json(),
    maxSize: a.integer(),
    minSize: a.integer(),
    serviceLinkedRoleArn: a.string(),
    vpcZoneIdentifier: a.string(),

    // ===== Direct Connect Connection FIELDS =====
    connectionId: a.string(),
    connectionName: a.string(),
    connectionState: a.string(),
    location: a.string(),
    bandwidth: a.string(),
    vlan: a.integer(),
    partnerName: a.string(),
    awsDevice: a.string(),
    awsDeviceV2: a.string(),
    hasLogicalRedundancy: a.string(),
    macSecCapable: a.boolean(),
    portEncryptionStatus: a.string(),
    encryptionMode: a.string(),

    // ===== EBS Snapshot FIELDS =====
    snapshotId: a.string(),
    snapshotName: a.string(),
    snapshotState: a.string(),
    volumeSize: a.integer(),

    // ===== EBS Volume FIELDS =====
    volumeName: a.string(),
    volumeState: a.string(),
    volumeType: a.string(),
    size: a.integer(),
    attachedInstances: a.string().array(),

    // ===== Elastic IP FIELDS =====
    allocationId: a.string(),
    associationId: a.string(),
    domain: a.string(),
    eipName: a.string(),
    networkBorderGroup: a.string(),
    networkInterfaceId: a.string(),
    networkInterfaceOwnerId: a.string(),
    privateIpAddress: a.string(),
    publicIp: a.string(),

    // ===== Internet Gateway FIELDS =====
    internetGatewayId: a.string(),
    internetGatewayName: a.string(),
    attachedVpcs: a.string().array(),
    attachmentCount: a.integer(),

    // ===== Load Balancer FIELDS =====
    loadBalancerArn: a.string(),
    loadBalancerName: a.string(),
    loadBalancerNameTag: a.string(),
    dnsName: a.string(),
    canonicalHostedZoneId: a.string(),
    scheme: a.string(),
    state: a.string(),
    type: a.string(),
    vpcId: a.string(),
    ipAddressType: a.string(),
    securityGroups: a.string().array(),
    targetGroups: a.string().array(),

    // ===== Metric Cost FIELDS =====
    isMetric: a.boolean(),
    metricDate: a.string(),
    metricType: a.string(),
    potentialMonthlySavings: a.float(),
    unassociatedElasticIPs: a.integer(),
    unattachedEBSVolumes: a.integer(),

    // ===== Metric EC2 Health FIELDS =====
    total: a.integer(),
    byState_running: a.integer(),
    byState_stopped: a.integer(),
    healthStatus_Healthy: a.integer(),
    healthStatus_Stopped: a.integer(),
    cloudwatchAgent_bothEnabled: a.integer(),
    cloudwatchAgent_diskMonitoring: a.integer(),
    cloudwatchAgent_memoryMonitoring: a.integer(),
    cloudwatchAgent_noneEnabled: a.integer(),
    cloudwatchAgent_percentageWithDisk: a.integer(),
    cloudwatchAgent_percentageWithMemory: a.integer(),
    ssmAgent_connected: a.integer(),
    ssmAgent_notConnected: a.integer(),
    ssmAgent_notInstalled: a.integer(),
    ssmAgent_percentageConnected: a.integer(),
  })
  .authorization(allow => [
    allow.authenticated().to(['read']),
    allow.group('Admins').to(['read','create', 'update', 'delete']),
    allow.publicApiKey().to(['create', 'update'])
  ])
  .secondaryIndexes(index => [
    index('resourceType')
      .queryField('listByResourceType')
      .sortKeys(['createdAt']),
    index('accountId')
      .queryField('listByAccountId')
      .sortKeys(['resourceType'])
  ]),

  PatchRequest: a.model({
    id: a.string().required(),
    instanceId: a.string().required(),
    action: a.string().required(),
    status: a.string().required(),
    requestedBy: a.string().required(),
    requestedAt: a.datetime().required(),
    approvedBy: a.string(),
    approvedAt: a.datetime(),
    notes: a.string()
  })
  .authorization(allow => [
    allow.authenticated().to(['create', 'read']),
    allow.group('Admins').to(['create', 'update', 'delete', 'read'])
  ]),

  ResourceComment: a.model({
    id: a.string().required(),
    resourceId: a.string().required(),
    author: a.string().required(),
    text: a.string().required(),
    createdAt: a.datetime().required()
  })
  .authorization(allow => [
    allow.authenticated().to(['create', 'read']),
    allow.group('Admins').to(['create', 'update', 'delete', 'read']),
    allow.owner().to(['delete'])
  ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  }
});