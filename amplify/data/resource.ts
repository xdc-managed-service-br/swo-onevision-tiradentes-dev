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
    tags: a.json(),                 // DynamoDB 'tags' pode vir como JSON/obj
    metrics: a.json(),              // <- NOVO: guarda objeto 'metrics' dos coletores
    availabilityZones: a.string().array(), // Load Balancer and ASG

    // ===== GENERIC FIELDS =====
    volumeId: a.string(),           // EBS Volume and Snapshot
    encrypted: a.boolean(),         // EBS Volume and Snapshot
    instanceId: a.string(),         // EC2 Instance and Elastic IP
    securityGroups: a.integer(),    // Security Metric and Load Balancer
    vpcId: a.string(),              // VPC, Load Balancer, Security Group and Network ACL
    associationCount: a.integer(),  // Network ACL and Route Table
    associatedSubnets: a.string().array(), // Network ACL and Route Table
    description: a.string(),        // AMI and Security Group
    ingressRuleCount: a.integer(),  // Security Group and Network ACL
    egressRuleCount: a.integer(),   // Security Group and Network ACL
    state: a.string(),              // Load Balancer and Subnet
    transitGatewayId: a.string(),   // VPN, Transit Gateway Attachment and Transit Gateway
    cidrBlock: a.string(),          // VPC and Subnet
    isDefault: a.boolean(),         // VPC and Network ACL
    type: a.string(),               // Load Balancer and VPN

    // ===== AMI FIELDS =====
    imageId: a.string(),
    imageName: a.string(),
    imageNameTag: a.string(),
    imageState: a.string(),
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

    // ===== Direct Connect Virtual Interface FIELDS =====
    virtualInterfaceId: a.string(),
    virtualInterfaceName: a.string(),
    virtualInterfaceType: a.string(),
    virtualInterfaceState: a.string(),
    directConnectGatewayId: a.string(),
    virtualGatewayId: a.string(),
    amazonAddress: a.string(),
    customerAddress: a.string(),
    customerRouterConfig: a.string(),
    mtu: a.integer(),
    jumboFrameCapable: a.boolean(),
    bgpStatus: a.string(),
    bgpStatusIpv4: a.string(),
    bgpStatusIpv6: a.string(),
    bgpAllUp: a.boolean(),
    bgpAnyUp: a.boolean(),
    bgpPeers: a.json(),
    routeFilterPrefixes: a.json(),

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
    ipAddressType: a.string(),
    targetGroups: a.string().array(),

    // ===== Network ACL FIELDS =====
    networkAclId: a.string(),
    networkAclName: a.string(),
    customDenyRuleCount: a.integer(),

    // ===== RDS Cluster Snapshot FIELDS =====
    snapshotArn: a.string(),
    snapshotType: a.string(),
    clusterId: a.string(),
    engine: a.string(),
    status: a.string(),
    allocatedStorage: a.integer(),

    // ===== RDS Instance FIELDS =====
    dbInstanceArn: a.string(),
    dbInstanceId: a.string(),
    dbInstanceName: a.string(),
    engineVersion: a.string(),
    instanceClass: a.string(),
    storageType: a.string(),

    // ===== Route Table FIELDS =====
    routeTableId: a.string(),
    routeTableName: a.string(),
    routeCount: a.integer(),
    hasInternetRoute: a.boolean(),
    hasNatRoute: a.boolean(),
    hasVpcPeeringRoute: a.boolean(),
    isMain: a.boolean(),

    // ===== S3 Bucket FIELDS =====
    bucketName: a.string(),
    bucketNameTag: a.string(),
    hasLifecycleRules: a.boolean(),
    objectCount: a.integer(),  // opcional: pode ficar nulo se vier apenas via metrics
    storageBytes: a.string(),  // idem
    encryption: a.string(),           // <- NOVO
    versioning: a.string(),           // <- NOVO
    publicAccessBlock: a.boolean(),   // <- NOVO

    // ===== EFS File System FIELDS =====
    fileSystemId: a.string(),
    performanceMode: a.string(),
    throughputMode: a.string(),
    provisionedThroughputInMibps: a.integer(),
    lifecyclePolicies: a.string().array(),
    backupPolicyEnabled: a.boolean(),
    mountTargetsCount: a.integer(),
    sizeInBytes: a.string(), // human-readable (ex.: "59.28 TB")

    // ===== FSx File System FIELDS =====
    fileSystemType: a.string(),                // WINDOWS | ONTAP | LUSTRE | OPENZFS
    deploymentType: a.string(),
    storageCapacity: a.integer(),
    throughputCapacity: a.integer(),
    automaticBackupRetentionDays: a.integer(),
    dailyAutomaticBackupStartTime: a.string(),
    copyTagsToBackups: a.boolean(),
    lifecycle: a.string(),

    // ===== Security Group FIELDS =====
    groupId: a.string(),
    groupName: a.string(),
    groupNameTag: a.string(),

    // ===== Subnet FIELDS =====
    subnetId: a.string(),
    subnetName: a.string(),
    availabilityZone: a.string(),
    availabilityZoneId: a.string(),
    availableIpAddressCount: a.integer(),

    // ===== Transit Gateway FIELDS =====
    transitGatewayName: a.string(),
    amazonSideAsn: a.integer(),
    defaultRouteTableAssociation: a.string(),
    defaultRouteTablePropagation: a.string(),
    dnsSupport: a.string(),
    multicastSupport: a.string(),
    vpnEcmpSupport: a.string(),
    ownerId: a.string(),

    // ===== Transit Gateway Attachment FIELDS =====
    transitGatewayAttachmentId: a.string(),
    attachmentName: a.string(),
    attachedResourceId: a.string(),
    attachedResourceType: a.string(),
    association: a.json(),
    resourceOwnerId: a.string(),
    transitGatewayOwnerId: a.string(),

    // ===== VPC Endpoint FIELDS =====
    vpcEndpointId: a.string(),
    vpcEndpointName: a.string(),
    vpcEndpointType: a.string(),
    serviceName: a.string(),
    policyDocument: a.json(),
    privateDnsEnabled: a.boolean(),
    routeTableIds: a.string().array(),
    subnetIds: a.string().array(),
    securityGroupIds: a.string().array(),

    // ===== VPC FIELDS =====
    vpcName: a.string(),
    enableDnsHostnames: a.boolean(),
    enableDnsSupport: a.boolean(),
    flowLogsEnabled: a.boolean(),
    instanceTenancy: a.string(),

    // ===== VPN Connection FIELDS =====
    vpnConnectionId: a.string(),
    vpnConnectionName: a.string(),
    vpnGatewayId: a.string(),
    customerGatewayId: a.string(),
    category: a.string(),
    tunnelCount: a.integer(),
    tunnelsUp: a.integer(),

    // ===== AWS Backup - Plan =====
    backupPlanId: a.string(),
    backupPlanName: a.string(),
    schedules: a.string().array(),
    selectionResourceTypes: a.string().array(),
    targetBackupVault: a.string(),
    lastExecutionDate: a.datetime(),
    windowStart: a.integer(),    // minutos
    windowDuration: a.integer(), // minutos

    // ===== AWS Backup - Vault =====
    backupVaultName: a.string(),
    encryptionKeyArn: a.string(),
    numberOfRecoveryPoints: a.integer(),
    latestRecoveryPointAgeDays: a.integer(),
    locked: a.boolean(),
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

  AWSMetrics: a.model({
    id: a.string().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    resourceType: a.string().required(),
    accountId: a.string().required(),
    region: a.string().required(),

    isMetric: a.boolean(),
    metricDate: a.string(),
    processingDurationSeconds: a.float(), // <- NOVO

    potentialMonthlySavings: a.float(),
    unassociatedElasticIPs: a.integer(),
    unattachedEBSVolumes: a.integer(),

    // EC2 health
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

    // RDS
    available: a.integer(),
    engines_aurora_mysql: a.integer(),
    multiAZ: a.integer(),
    percentageMultiAZ: a.integer(),
    performanceInsights: a.integer(),
    percentageWithPerfInsights: a.integer(),

    // Security
    exposedSecurityGroups: a.integer(),
    percentageExposed: a.integer(),

    // Storage aggregates
    amiSnapshots: a.integer(),
    ebsSnapshots: a.integer(),
    ebsVolumes: a.integer(),
    s3Buckets: a.integer(),
    s3WithLifecycle: a.integer(),

    // NOVOS agregados de storage/backup
    efsFileSystems: a.integer(),
    fsxFileSystems: a.integer(),
    backupPlans: a.integer(),
    backupVaults: a.integer(),
    backupRecoveryPoints: a.integer(),

    // Global
    totalResources: a.integer(),
    resourceRegionsFound: a.integer(),
    regionsCollected: a.integer(),
    accountDistribution: a.json(),
    regionDistribution: a.json(),
    recentResources: a.json(),

    // resourceCounts_* (topo do dicionário flatten)
    resourceCounts_AMI: a.integer(),
    resourceCounts_AutoScalingGroup: a.integer(),
    resourceCounts_DirectConnectConnection: a.integer(),
    resourceCounts_DirectConnectVirtualInterface: a.integer(),
    resourceCounts_EBSSnapshot: a.integer(),
    resourceCounts_EBSVolume: a.integer(),
    resourceCounts_EC2Instance: a.integer(),
    resourceCounts_ElasticIP: a.integer(),
    resourceCounts_InternetGateway: a.integer(),
    resourceCounts_LoadBalancer: a.integer(),
    resourceCounts_NetworkACL: a.integer(),
    resourceCounts_RDSClusterSnapshot: a.integer(),
    resourceCounts_RDSInstance: a.integer(),
    resourceCounts_RouteTable: a.integer(),
    resourceCounts_S3Bucket: a.integer(),
    resourceCounts_SecurityGroup: a.integer(),
    resourceCounts_Subnet: a.integer(),
    resourceCounts_TransitGateway: a.integer(),
    resourceCounts_TransitGatewayAttachment: a.integer(),
    resourceCounts_VPC: a.integer(),
    resourceCounts_VPCEndpoint: a.integer(),
    resourceCounts_VPNConnection: a.integer(),

    // NOVOS resourceCounts_* para storage/backup
    resourceCounts_EFSFileSystem: a.integer(),
    resourceCounts_FSxFileSystem: a.integer(),
    resourceCounts_BackupPlan: a.integer(),
    resourceCounts_BackupVault: a.integer(),
    resourceCounts_BackupRecoveryPoint: a.integer(),

    // Network health aggregates flattened by lambda
    networkHealth_directConnectConnections_total: a.integer(),
    networkHealth_directConnectConnections_healthy: a.integer(),
    networkHealth_directConnectConnections_unhealthy: a.integer(),
    networkHealth_directConnectConnections_healthyPercentage: a.integer(),
    networkHealth_directConnectVirtualInterfaces_total: a.integer(),
    networkHealth_directConnectVirtualInterfaces_healthy: a.integer(),
    networkHealth_directConnectVirtualInterfaces_unhealthy: a.integer(),
    networkHealth_directConnectVirtualInterfaces_healthyPercentage: a.integer(),
    networkHealth_vpnConnections_total: a.integer(),
    networkHealth_vpnConnections_healthy: a.integer(),
    networkHealth_vpnConnections_unhealthy: a.integer(),
    networkHealth_vpnConnections_healthyPercentage: a.integer(),
    networkHealth_transitGateways_total: a.integer(),
    networkHealth_transitGateways_healthy: a.integer(),
    networkHealth_transitGateways_unhealthy: a.integer(),
    networkHealth_transitGateways_healthyPercentage: a.integer(),
  })
  .authorization(allow => [
    allow.authenticated().to(['read']),
    allow.group('Admins').to(['read','create', 'update', 'delete']),
    allow.publicApiKey().to(['create', 'update'])
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
