// src/app/models/resource.model.ts
export interface BaseResource {
  id: string;
  resourceType: string;
  accountId: string;
  accountName?: string;
  region: string;
  lastUpdated?: string;
  tags?: any;
}

export interface EC2Instance extends BaseResource {
  instanceId: string;
  instanceType: string;
  instanceState: string;
  launchTime?: string;
  platformDetails?: string;
  amiName?: string; 
  iamRole?: string;
  ssmStatus?: string;
  ssmPingStatus?: string;
  ssmVersion?: string;
  ssmLastPingTime?: string;
  ramUtilization?: string;
  diskUtilization?: string;
  cwAgentMemoryDetected?: boolean;
  cwAgentDiskDetected?: boolean;
  swoMonitor?: string;
  swoPatch?: string;
  swoBackup?: string;
  swoRiskClass?: string;
  autoStart?: string;
  autoShutdown?: string;
  saturday?: string;
  sunday?: string;
  healthStatus?: string;
  healthChecksPassed?: number;
  healthChecksTotal?: number;
  systemStatus?: string;
  instanceStatus?: string;
  ebsStatus?: string;
  instancePrivateIps?: string[];
  instancePublicIps?: string[];
}

export interface S3Bucket extends BaseResource {
  bucketName: string;
  creationDate?: string;
  hasLifecycleRules?: boolean;
  storageClass?: string;
}

export interface EBSVolume extends BaseResource {
  volumeId: string;
  size?: number;
  volumeType?: string;
  encrypted?: boolean;
  attachedInstances?: string;
}

export interface RDSInstance extends BaseResource {
  dbInstanceId: string;
  engine?: string;
  engineVersion?: string;
  status?: string;
  storageType?: string;
  allocatedStorage?: number;
  multiAZ?: boolean;
  instanceClass?: string;
}

export interface EBSSnapshot extends BaseResource {
  snapshotId: string;
  volumeId?: string;
  volumeSize?: number;
  startTime?: string;
}

export interface AMISnapshot extends BaseResource {
  imageId: string;
  name?: string;
  platform?: string;
  startTime?: string;
}

// ======= NETWORKING RESOURCES =======

export interface SecurityGroupRule {
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  cidrBlocks?: string[];
  sourceSecurityGroupId?: string;
  description?: string;
}

export interface SecurityGroup extends BaseResource {
  groupId: string;
  groupName: string;
  groupNameTag?: string;
  description?: string;
  vpcId?: string;
  ownerId?: string;
  ingressRuleCount: number;
  egressRuleCount: number;
  hasExposedIngressPorts?: boolean;
  exposedIngressPorts: number[];
  allIngressPortsExposed?: boolean;
  riskyIngressRules: any[];
  hasExposedEgressPorts?: boolean;
  exposedEgressPorts: number[];

  // opcionais (para futuro, apos adc no backend)
  inboundRules?: SecurityGroupRule[];
  outboundRules?: SecurityGroupRule[];
}

export interface VPC extends BaseResource {
  vpcId: string;
  cidrBlock?: string;
  dhcpOptionsId?: string;
  tenancy?: string;
  isDefault?: boolean;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  state?: string;
}

export interface VPNGateway extends BaseResource {
  vpnGatewayId: string;
  vpnGatewayType?: string;
  amazonSideAsn?: number;
  state?: string;
  availabilityZone?: string;
  vpcAttachments?: any[];
}

export interface VPNConnection extends BaseResource {
  vpnConnectionId: string;
  vpnGatewayId?: string;
  customerGatewayId?: string;
  vpnConnectionType?: string;
  state?: string;
  customerGatewayConfiguration?: string;
}

export interface TransitGateway extends BaseResource {
  transitGatewayId: string;
  transitGatewayArn?: string;
  amazonSideAsn?: number;
  autoAcceptSharedAttachments?: string;
  defaultRouteTableAssociation?: string;
  defaultRouteTablePropagation?: string;
  state?: string;
}

export interface TransitGatewayAttachment extends BaseResource {
  transitGatewayAttachmentId: string;
  transitGatewayId?: string;
  resourceId?: string;
  resourceType: string;
  state?: string;
}

export interface InternetGateway extends BaseResource {
internetGatewayId: string;
// Optional, derived from tags["Name"] if present
internetGatewayName?: string;
// Raw AWS attachments (VpcId/State)
attachments?: Array<{ vpcId?: string; state?: string }>;
// Convenience fields used by the component
attachedVpcs?: string[];
attachmentCount?: number;
state?: string;
}

export interface NATGateway extends BaseResource {
  natGatewayId: string;
  vpcId?: string;
  subnetId?: string;
  natGatewayAddresses?: any[];
  connectivityType?: string;
  state: string;
}

export interface RouteTable extends BaseResource {
  routeTableId: string;
  vpcId?: string;
  routes?: any[];
  associations?: any[];
}

export interface NetworkACL extends BaseResource {
  networkAclId: string;
  vpcId?: string;
  isDefault?: boolean;
  entries?: any[];
}

export interface Subnet extends BaseResource {
  subnetId: string;
  vpcId?: string;
  cidrBlock?: string;
  availabilityZone?: string;
  availabilityZoneId?: string;
  availableIpAddressCount?: number;
  mapPublicIpOnLaunch?: boolean;
  subnetState?: string;
}

export interface ElasticLoadBalancer extends BaseResource {
  loadBalancerArn: string;
  loadBalancerName: string;
  dnsName: string;
  canonicalHostedZoneId?: string;
  scheme?: string;
  loadBalancerType?: string;
  ipAddressType?: string;
  state: string;
  vpcId?: string;
}

export interface TargetGroup extends BaseResource {
  targetGroupArn: string;
  targetGroupName: string;
  protocol?: string;
  port?: number;
  vpcId?: string;
  healthCheckProtocol?: string;
  healthCheckPath?: string;
  healthCheckPort?: string;
  targetType?: string;
}

export interface NetworkInterface extends BaseResource {
  networkInterfaceId: string;
  interfaceType?: string;
  macAddress?: string;
  privateIpAddress?: string;
  sourceDestCheck?: boolean;
  status?: string;
  subnetId?: string;
  vpcId?: string;
}

export interface VPCEndpoint extends BaseResource {
  vpcEndpointId: string;
  vpcId?: string;
  serviceName?: string;
  vpcEndpointType?: string;
  state?: string;
  routeTableIds?: string[];
}

export interface CustomerGateway extends BaseResource {
  customerGatewayId: string;
  bgpAsn?: number;
  ipAddress?: string;
  type?: string;
  state?: string;
  certificateArn?: string;
}

// Union type for all networking resources
export type NetworkingResource = 
  | SecurityGroup
  | VPC
  | VPNGateway
  | VPNConnection
  | TransitGateway
  | TransitGatewayAttachment
  | InternetGateway
  | NATGateway
  | RouteTable
  | NetworkACL
  | Subnet
  | ElasticLoadBalancer
  | TargetGroup
  | NetworkInterface
  | VPCEndpoint
  | CustomerGateway;

// Union type for all resources
export type AWSResource = 
  | EC2Instance
  | S3Bucket
  | EBSVolume
  | RDSInstance
  | EBSSnapshot
  | AMISnapshot
  | NetworkingResource;