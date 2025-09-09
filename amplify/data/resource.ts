// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  AWSResource: a.model({
    id: a.string().required(),
    resourceTypeRegionId: a.string(),
    accountId: a.string().required(),
    accountName: a.string(),
    resourceType: a.string().required(),
    region: a.string().required(),
    lastUpdated: a.datetime(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(), 
    
    // ======= EC2 INSTANCE FIELDS =======
    instanceId: a.string(),
    instanceName: a.string(),
    instanceType: a.string(),
    instanceState: a.string(),
    launchTime: a.datetime(),
    tags: a.json(),

    // EC2 IP addresses
    instancePrivateIps: a.json(),
    instancePublicIps: a.json(),

    // CloudWatch agent fields
    cwAgentMemoryDetected: a.boolean(),
    cwAgentDiskDetected: a.boolean(),

    // EC2 platform and system fields
    platformDetails: a.string(),
    amiName: a.string(),
    iamRole: a.string(),
    isWindows: a.boolean(),

    // SSM fields
    ssmStatus: a.string(),
    ssmPingStatus: a.string(),
    ssmVersion: a.string(),
    ssmLastPingTime: a.datetime(),

    // Utilization fields
    ramUtilization: a.string(),
    diskUtilization: a.string(),

    // SWO configuration fields
    swoMonitor: a.string(),
    swoPatch: a.string(),
    swoBackup: a.string(),
    swoRiskClass: a.string(),
    patchGroup: a.string(),

    // Auto scheduling fields
    startStop: a.string(),
    autoStart: a.string(),
    autoShutdown: a.string(),
    saturday: a.string(),
    sunday: a.string(),

    // EC2 health check fields
    healthStatus: a.string(),
    healthChecksPassed: a.integer(),
    healthChecksTotal: a.integer(),
    systemStatus: a.string(),
    instanceStatus: a.string(),
    ebsStatus: a.string(),

    // ======= EBS VOLUME FIELDS =======
    volumeId: a.string(),
    volumeName: a.string(),
    volumeState: a.string(),
    size: a.float(),
    volumeType: a.string(),
    encrypted: a.boolean(),
    attachedInstances: a.json(),

    // ======= EBS SNAPSHOT FIELDS =======
    snapshotId: a.string(),
    snapshotName: a.string(),
    snapshotState: a.string(),
    volumeSize: a.float(),
    startTime: a.string(),

    // ======= AMI FIELDS =======
    imageId: a.string(),
    imageName: a.string(),
    imageState: a.string(),
    description: a.string(),
    platform: a.string(),

    // ======= S3 BUCKET FIELDS =======
    bucketName: a.string(),
    creationDate: a.datetime(),
    hasLifecycleRules: a.boolean(),
    storageClass: a.string(),

    // ======= RDS INSTANCE FIELDS =======
    dbInstanceId: a.string(),
    engine: a.string(),
    engineVersion: a.string(),
    status: a.string(),
    storageType: a.string(),
    allocatedStorage: a.float(),
    multiAZ: a.boolean(),
    instanceClass: a.string(),
    performanceInsightsEnabled: a.boolean(),

    // ======= RDS SNAPSHOT FIELDS =======
    snapshotType: a.string(),
    snapshotCreateTime: a.string(),

    // ======= NETWORKING: VPC FIELDS =======
    vpcId: a.string(),
    vpcName: a.string(),
    vpcState: a.string(),
    cidrBlock: a.string(),
    isDefault: a.boolean(),
    enableDnsHostnames: a.boolean(),
    enableDnsSupport: a.boolean(),
    instanceTenancy: a.string(),
    flowLogsEnabled: a.boolean(),

    // ======= NETWORKING: SECURITY GROUP FIELDS =======
    groupId: a.string(),
    groupName: a.string(),
    groupNameTag: a.string(),
    sgingressRuleCount: a.integer(),
    sgegressRuleCount: a.integer(),
    hasExposedIngressPorts: a.boolean(),
    exposedIngressPorts: a.json(),
    allIngressPortsExposed: a.boolean(),
    riskyIngressRules: a.json(),
    hasExposedEgressPorts: a.boolean(),
    exposedEgressPorts: a.json(),

    // ======= NETWORKING: SUBNET FIELDS =======
    subnetId: a.string(),
    subnetName: a.string(),
    subnetState: a.string(),
    availabilityZone: a.string(),
    availabilityZoneId: a.string(),
    availableIpAddressCount: a.integer(),
    mapPublicIpOnLaunch: a.boolean(),
    defaultForAz: a.boolean(),
    assignIpv6AddressOnCreation: a.boolean(),

    // ======= NETWORKING: NAT GATEWAY FIELDS =======
    natGatewayId: a.string(),
    natGatewayName: a.string(),
    natGatewayState: a.string(),
    natPublicIps: a.json(),
    connectivityType: a.string(),

    // ======= NETWORKING: INTERNET GATEWAY FIELDS =======
    internetGatewayId: a.string(),
    internetGatewayName: a.string(),
    attachedVpcs: a.json(),
    attachmentCount: a.integer(),

    // ======= NETWORKING: ELASTIC IP FIELDS =======
    allocationId: a.string(),
    eipName: a.string(),
    publicIp: a.string(),
    privateIpAddress: a.string(),
    associationId: a.string(),
    networkInterfaceId: a.string(),
    networkInterfaceOwnerId: a.string(),
    domain: a.string(),
    networkBorderGroup: a.string(),
    customerOwnedIp: a.string(),
    customerOwnedIpv4Pool: a.string(),
    carrierIp: a.string(),

    // ======= NETWORKING: ROUTE TABLE FIELDS =======
    routeTableId: a.string(),
    routeTableName: a.string(),
    routeCount: a.integer(),
    hasInternetRoute: a.boolean(),
    hasNatRoute: a.boolean(),
    hasVpcPeeringRoute: a.boolean(),
    associatedSubnets: a.json(),
    associationCount: a.integer(),
    isMain: a.boolean(),

    // ======= NETWORKING: NETWORK ACL FIELDS =======
    networkAclId: a.string(),
    networkAclName: a.string(),
    naclingressRuleCount: a.integer(),
    naclegressRuleCount: a.integer(),
    customDenyRuleCount: a.integer(),

    // ======= NETWORKING: VPC ENDPOINT FIELDS =======
    vpcEndpointId: a.string(),
    vpcEndpointName: a.string(),
    vpcEndpointType: a.string(),
    endpointState: a.string(),
    serviceName: a.string(),
    policyDocument: a.string(),
    routeTableIds: a.json(),
    subnetIds: a.json(),
    securityGroupIds: a.json(),
    privateDnsEnabled: a.boolean(),

    // ======= NETWORKING: VPC PEERING CONNECTION FIELDS =======
    vpcPeeringConnectionId: a.string(),
    peeringConnectionName: a.string(),
    peeringStatus: a.string(),
    statusMessage: a.string(),
    accepterVpcId: a.string(),
    accepterRegion: a.string(),
    accepterOwnerId: a.string(),
    requesterVpcId: a.string(),
    requesterRegion: a.string(),
    requesterOwnerId: a.string(),

    // ======= NETWORKING: VPN CONNECTION FIELDS =======
    vpnConnectionId: a.string(),
    vpnConnectionName: a.string(),
    vpnState: a.string(),
    type: a.string(),
    customerGatewayId: a.string(),
    vpnGatewayId: a.string(),
    category: a.string(),
    tunnelCount: a.integer(),
    tunnelsUp: a.integer(),

    // ======= NETWORKING: TRANSIT GATEWAY FIELDS =======
    transitGatewayId: a.string(),
    transitGatewayName: a.string(),
    tgwState: a.string(),
    ownerId: a.string(),
    amazonSideAsn: a.string(),
    dnsSupport: a.string(),
    vpnEcmpSupport: a.string(),
    multicastSupport: a.string(),
    defaultRouteTableAssociation: a.string(),
    defaultRouteTablePropagation: a.string(),

    // ======= NETWORKING: TRANSIT GATEWAY ATTACHMENT FIELDS =======
    transitGatewayAttachmentId: a.string(),
    attachmentName: a.string(),
    attachmentState: a.string(),
    transitGatewayOwnerId: a.string(),
    attachmentResourceType: a.string(),
    attachmentResourceId: a.string(),
    resourceOwnerId: a.string(),
    association: a.json(),

    // ======= NETWORKING: LOAD BALANCER FIELDS =======
    loadBalancerArn: a.string(),
    loadBalancerName: a.string(),
    loadBalancerNameTag: a.string(),
    dnsName: a.string(),
    canonicalHostedZoneId: a.string(),
    scheme: a.string(),
    lbState: a.string(),
    ipAddressType: a.string(),
    targetGroups: a.json(),
    availabilityZones: a.json(),
    securityGroups: a.json(),

    // ======= NETWORKING: CLASSIC LOAD BALANCER FIELDS =======
    canonicalHostedZoneName: a.string(),
    canonicalHostedZoneNameID: a.string(),
    subnets: a.json(),
    instanceCount: a.integer(),
    instances: a.json(),
    healthCheck: a.json(),

    // ======= NETWORKING: AUTO SCALING GROUP FIELDS =======
    autoScalingGroupName: a.string(),
    autoScalingGroupNameTag: a.string(),
    autoScalingGroupARN: a.string(),
    launchConfigurationName: a.string(),
    launchTemplate: a.json(),
    minSize: a.integer(),
    maxSize: a.integer(),
    desiredCapacity: a.integer(),
    currentSize: a.integer(),
    healthyInstances: a.integer(),
    loadBalancerNames: a.json(),
    targetGroupARNs: a.json(),
    healthCheckType: a.string(),
    healthCheckGracePeriod: a.integer(),
    vpcZoneIdentifier: a.string(),
    serviceLinkedRoleARN: a.string(),

    // ======= NETWORKING: DIRECT CONNECT FIELDS =======
    connectionId: a.string(),
    connectionName: a.string(),
    connectionState: a.string(),
    location: a.string(),
    bandwidth: a.string(),
    vlan: a.integer(),
    partnerName: a.string(),
    loaIssueTime: a.datetime(),
    lagId: a.string(),
    awsDevice: a.string(),
    awsDeviceV2: a.string(),
    hasLogicalRedundancy: a.string(),
    macSecCapable: a.boolean(),
    portEncryptionStatus: a.string(),
    encryptionMode: a.string(),

    // ======= NETWORKING: DIRECT CONNECT VIRTUAL INTERFACE FIELDS =======
    virtualInterfaceId: a.string(),
    virtualInterfaceName: a.string(),
    virtualInterfaceType: a.string(),
    virtualInterfaceState: a.string(),
    customerAddress: a.string(),
    amazonAddress: a.string(),
    asn: a.integer(),
    vifAmazonSideAsn: a.integer(),
    authKey: a.string(),
    routeFilterPrefixes: a.json(),
    bgpPeers: a.json(),
    customerRouterConfig: a.string(),
    mtu: a.integer(),
    jumboFrameCapable: a.boolean(),
    virtualGatewayId: a.string(),
    directConnectGatewayId: a.string(),
  })
  .authorization(allow => [
    allow.authenticated('userPools'),
    allow.publicApiKey()
  ])
  .secondaryIndexes(index => [
    index('accountId'),
    index('resourceType')
  ])
})

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { 
      expiresInDays: 30 
    }
  }
});