import json
import logging
from .base import ResourceCollector, format_aws_datetime

logger = logging.getLogger()

def flatten_metric(item: dict, metric: dict, parent_key: str = "") -> dict:
    """
    Flattens nested dictionaries/lists into item.
    Example:
      {"ssmAgent": {"connected": 97, "notConnected": 7}}
    Becomes:
      {"ssmAgent_connected": 97, "ssmAgent_notConnected": 7}
    Lists are expanded into numbered keys.
    """
    for k, v in metric.items():
        new_key = f"{parent_key}_{k}" if parent_key else k
        if isinstance(v, dict):
            flatten_metric(item, v, new_key)
        elif isinstance(v, list):
            for i, elem in enumerate(v):
                indexed_key = f"{new_key}_{i}"
                if isinstance(elem, dict):
                    flatten_metric(item, elem, indexed_key)
                else:
                    item[indexed_key] = elem
        else:
            item[new_key] = v
    return item

def to_dynamodb_format(data: dict) -> dict:
    """
    Convert a dictionary with raw values to DynamoDB format (flat, no nested maps).
    Example: {"key": "value"} -> {"key": "value"}
    """
    dynamodb_item = {}
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            # Flatten dicts/lists before storing
            flat = {}
            flatten_metric(flat, {key: value})
            for fk, fv in flat.items():
                if isinstance(fv, bool):
                    dynamodb_item[fk] = fv
                elif isinstance(fv, (int, float)):
                    dynamodb_item[fk] = fv
                elif fv is None:
                    dynamodb_item[fk] = None
                else:
                    dynamodb_item[fk] = str(fv)
        else:
            if isinstance(value, bool):
                dynamodb_item[key] = value
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = value
            elif value is None:
                dynamodb_item[key] = None
            else:
                dynamodb_item[key] = str(value)
    return dynamodb_item

class NetworkingCollector(ResourceCollector):
    """
    Collects networking and VPC resources including security analysis.
    Resources: VPCs, Security Groups, Subnets, NAT Gateways, Internet Gateways,
    Load Balancers, Auto Scaling Groups, Network ACLs, Route Tables, 
    Transit Gateways, Direct Connect, VPN Connections, VPC Endpoints, and more.
    """
    
    def collect(self):
        """
        Orchestrates the collection of all networking resource types.
        
        Returns:
            list[dict]: The list of all networking items collected.
        """
        logger.info(f"Starting Networking collection for account {self.account_id} in region {self.region}")
        total_collected_count = 0
        
        try:
            # Get necessary clients
            ec2 = self.get_client('ec2')
            elbv2 = self.get_client('elbv2')
            elb = self.get_client('elb')
            autoscaling = self.get_client('autoscaling')
            directconnect = self.get_client('directconnect')
            
            # Collect VPC resources
            total_collected_count += self._collect_vpcs(ec2)
            total_collected_count += self._collect_security_groups(ec2)
            total_collected_count += self._collect_subnets(ec2)
            total_collected_count += self._collect_nat_gateways(ec2)
            total_collected_count += self._collect_internet_gateways(ec2)
            total_collected_count += self._collect_elastic_ips(ec2)
            total_collected_count += self._collect_route_tables(ec2)
            total_collected_count += self._collect_network_acls(ec2)
            total_collected_count += self._collect_vpc_endpoints(ec2)
            total_collected_count += self._collect_vpc_peering_connections(ec2)
            total_collected_count += self._collect_vpn_connections(ec2)
            total_collected_count += self._collect_transit_gateways(ec2)
            total_collected_count += self._collect_transit_gateway_attachments(ec2)
            
            # Collect Load Balancers
            total_collected_count += self._collect_application_load_balancers(elbv2)
            total_collected_count += self._collect_classic_load_balancers(elb)
            
            # Collect Auto Scaling Groups
            total_collected_count += self._collect_auto_scaling_groups(autoscaling)
            
            # Collect Direct Connect (global, but check regional virtual interfaces)
            total_collected_count += self._collect_direct_connect_connections(directconnect)
            total_collected_count += self._collect_direct_connect_virtual_interfaces(directconnect)
            
            logger.info(f"Finished Networking collection for account {self.account_id} in region {self.region}. "
                       f"Added {total_collected_count} resources to the item list.")
            return self.items
        except Exception as e:
            logger.error(f"Critical error during Networking collection in region {self.region}: {str(e)}", exc_info=True)
            return []
    
    def _analyze_security_group_rules(self, rules, rule_type='ingress'):
        """
        Analyze security group rules for potential security issues.
        
        Returns:
            dict: Analysis results including exposed ports and risky rules.
        """
        exposed_ports = []
        risky_rules = []
        all_ports_exposed = False
        
        for rule in rules:
            # Check for 0.0.0.0/0 or ::/0 exposure
            is_exposed_ipv4 = any(
                ip_range.get('CidrIp') == '0.0.0.0/0' 
                for ip_range in rule.get('IpRanges', [])
            )
            is_exposed_ipv6 = any(
                ip_range.get('CidrIpv6') == '::/0' 
                for ip_range in rule.get('Ipv6Ranges', [])
            )
            
            if is_exposed_ipv4 or is_exposed_ipv6:
                from_port = rule.get('FromPort', -1)
                to_port = rule.get('ToPort', -1)
                protocol = rule.get('IpProtocol', 'all')
                
                # Check if all ports are exposed
                if protocol == '-1' or (from_port == 0 and to_port == 65535):
                    all_ports_exposed = True
                    risky_rules.append({
                        'type': 'all_ports_exposed',
                        'protocol': protocol,
                        'source': '0.0.0.0/0' if is_exposed_ipv4 else '::/0'
                    })
                # Check for commonly risky ports
                elif from_port != -1:
                    risky_ports = {
                        22: 'SSH',
                        3389: 'RDP',
                        1433: 'MSSQL',
                        3306: 'MySQL',
                        5432: 'PostgreSQL',
                        27017: 'MongoDB',
                        6379: 'Redis',
                        9200: 'Elasticsearch',
                        5984: 'CouchDB',
                        11211: 'Memcached'
                    }
                    
                    for port in range(from_port, to_port + 1):
                        if port in risky_ports:
                            exposed_ports.append(port)
                            risky_rules.append({
                                'type': 'risky_port_exposed',
                                'port': port,
                                'service': risky_ports[port],
                                'protocol': protocol,
                                'source': '0.0.0.0/0' if is_exposed_ipv4 else '::/0'
                            })
                        elif from_port == to_port:
                            # Single port exposed
                            exposed_ports.append(port)
        
        return {
            'hasExposedPorts': len(exposed_ports) > 0,
            'exposedPorts': exposed_ports,
            'allPortsExposed': all_ports_exposed,
            'riskyRules': risky_rules,
            'ruleCount': len(rules)
        }
    
    def _collect_vpcs(self, ec2):
        """Collect VPC information."""
        vpc_count = 0
        try:
            response = ec2.describe_vpcs()
            for vpc in response.get('Vpcs', []):
                vpc_id = vpc['VpcId']
                tags = vpc.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                vpc_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        vpc_name = tag.get('Value', 'N/A')
                        break
                
                # Check if it's the default VPC
                is_default = vpc.get('IsDefault', False)
                
                # Get flow logs status
                flow_logs_enabled = False
                try:
                    flow_logs = ec2.describe_flow_logs(
                        Filters=[
                            {'Name': 'resource-id', 'Values': [vpc_id]}
                        ]
                    )
                    flow_logs_enabled = len(flow_logs.get('FlowLogs', [])) > 0
                except Exception as e:
                    logger.warning(f"Error checking flow logs for VPC {vpc_id}: {e}")
                
                item_data = {
                    'vpcId': vpc_id,
                    'vpcName': vpc_name,
                    'cidrBlock': vpc.get('CidrBlock', 'N/A'),
                    'state': vpc.get('State', 'N/A'),
                    'isDefault': is_default,
                    'enableDnsHostnames': vpc.get('EnableDnsHostnames', False),
                    'enableDnsSupport': vpc.get('EnableDnsSupport', True),
                    'flowLogsEnabled': flow_logs_enabled,
                    'instanceTenancy': vpc.get('InstanceTenancy', 'default'),
                    'tags': tags_json
                }
                self.add_item('VPC', vpc_id, to_dynamodb_format(item_data))
                vpc_count += 1
            
            if vpc_count > 0:
                logger.debug(f"Added {vpc_count} VPCs from region {self.region} to the item list.")
            return vpc_count
        except Exception as e:
            logger.error(f"Error collecting VPCs in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_security_groups(self, ec2):
        """Collect Security Groups with security analysis."""
        sg_count = 0
        try:
            paginator = ec2.get_paginator('describe_security_groups')
            for page in paginator.paginate():
                for sg in page.get('SecurityGroups', []):
                    sg_id = sg['GroupId']
                    tags = sg.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    sg_name_tag = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            sg_name_tag = tag.get('Value', 'N/A')
                            break
                    
                    # Analyze ingress rules for security issues
                    ingress_analysis = self._analyze_security_group_rules(
                        sg.get('IpPermissions', []), 
                        'ingress'
                    )
                    
                    # Analyze egress rules
                    egress_analysis = self._analyze_security_group_rules(
                        sg.get('IpPermissionsEgress', []), 
                        'egress'
                    )
                    
                    # Flatten analysis results
                    flat_ingress_ports = {}
                    flatten_metric(flat_ingress_ports, {'ExposedIngressPorts': ingress_analysis['exposedPorts']})
                    flat_egress_ports = {}
                    flatten_metric(flat_egress_ports, {'ExposedEgressPorts': egress_analysis['exposedPorts']})
                    flat_risky_rules = {}
                    flatten_metric(flat_risky_rules, {'RiskyIngressRules': ingress_analysis['riskyRules']})
                    
                    item_data = {
                        'groupId': sg_id,
                        'groupName': sg.get('GroupName', 'N/A'),
                        'groupNameTag': sg_name_tag,
                        'description': sg.get('Description', ''),
                        'vpcId': sg.get('VpcId', 'N/A'),
                        'ingressRuleCount': ingress_analysis['ruleCount'],
                        'egressRuleCount': egress_analysis['ruleCount'],
                        'hasExposedIngressPorts': ingress_analysis['hasExposedPorts'],
                        'allIngressPortsExposed': ingress_analysis['allPortsExposed'],
                        'hasExposedEgressPorts': egress_analysis['hasExposedPorts'],
                        'tags': tags_json,
                        **flat_ingress_ports,
                        **flat_egress_ports,
                        **flat_risky_rules
                    }
                    self.add_item('SecurityGroup', sg_id, to_dynamodb_format(item_data))
                    sg_count += 1
            
            if sg_count > 0:
                logger.debug(f"Added {sg_count} Security Groups from region {self.region} to the item list.")
            return sg_count
        except Exception as e:
            logger.error(f"Error collecting Security Groups in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_subnets(self, ec2):
        """Collect Subnet information."""
        subnet_count = 0
        try:
            paginator = ec2.get_paginator('describe_subnets')
            for page in paginator.paginate():
                for subnet in page.get('Subnets', []):
                    subnet_id = subnet['SubnetId']
                    tags = subnet.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    subnet_name = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            subnet_name = tag.get('Value', 'N/A')
                            break
                    
                    item_data = {
                        'subnetId': subnet_id,
                        'subnetName': subnet_name,
                        'vpcId': subnet.get('VpcId', 'N/A'),
                        'cidrBlock': subnet.get('CidrBlock', 'N/A'),
                        'availabilityZone': subnet.get('AvailabilityZone', 'N/A'),
                        'availabilityZoneId': subnet.get('AvailabilityZoneId', 'N/A'),
                        'state': subnet.get('State', 'N/A'),
                        'availableIpAddressCount': subnet.get('AvailableIpAddressCount', 0),
                        'defaultForAz': subnet.get('DefaultForAz', False),
                        'mapPublicIpOnLaunch': subnet.get('MapPublicIpOnLaunch', False),
                        'assignIpv6AddressOnCreation': subnet.get('AssignIpv6AddressOnCreation', False),
                        'tags': tags_json
                    }
                    self.add_item('Subnet', subnet_id, to_dynamodb_format(item_data))
                    subnet_count += 1
            
            if subnet_count > 0:
                logger.debug(f"Added {subnet_count} Subnets from region {self.region} to the item list.")
            return subnet_count
        except Exception as e:
            logger.error(f"Error collecting Subnets in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_nat_gateways(self, ec2):
        """Collect NAT Gateway information."""
        nat_count = 0
        try:
            paginator = ec2.get_paginator('describe_nat_gateways')
            for page in paginator.paginate():
                for nat in page.get('NatGateways', []):
                    nat_id = nat['NatGatewayId']
                    tags = nat.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    nat_name = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            nat_name = tag.get('Value', 'N/A')
                            break
                    
                    create_time = nat.get('CreateTime')
                    formatted_create_time = format_aws_datetime(create_time) if create_time else None
                    
                    # Get public IP addresses
                    public_ips = [addr['PublicIp'] for addr in nat.get('NatGatewayAddresses', []) if addr.get('PublicIp')]
                    flat_public_ips = {}
                    flatten_metric(flat_public_ips, {'PublicIps': public_ips})
                    
                    item_data = {
                        'natGatewayId': nat_id,
                        'natGatewayName': nat_name,
                        'state': nat.get('State', 'N/A'),
                        'vpcId': nat.get('VpcId', 'N/A'),
                        'subnetId': nat.get('SubnetId', 'N/A'),
                        'connectivityType': nat.get('ConnectivityType', 'public'),
                        'createdAt': formatted_create_time,
                        'tags': tags_json,
                        **flat_public_ips
                    }
                    self.add_item('NATGateway', nat_id, to_dynamodb_format(item_data))
                    nat_count += 1
            
            if nat_count > 0:
                logger.debug(f"Added {nat_count} NAT Gateways from region {self.region} to the item list.")
            return nat_count
        except Exception as e:
            logger.error(f"Error collecting NAT Gateways in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_internet_gateways(self, ec2):
        """Collect Internet Gateway information."""
        igw_count = 0
        try:
            response = ec2.describe_internet_gateways()
            for igw in response.get('InternetGateways', []):
                igw_id = igw['InternetGatewayId']
                tags = igw.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                igw_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        igw_name = tag.get('Value', 'N/A')
                        break
                
                # Get attached VPCs
                attached_vpcs = [att['VpcId'] for att in igw.get('Attachments', [])]
                flat_attached_vpcs = {}
                flatten_metric(flat_attached_vpcs, {'AttachedVpcs': attached_vpcs})
                
                item_data = {
                    'internetGatewayId': igw_id,
                    'internetGatewayName': igw_name,
                    'attachmentCount': len(attached_vpcs),
                    'tags': tags_json,
                    **flat_attached_vpcs
                }
                self.add_item('InternetGateway', igw_id, to_dynamodb_format(item_data))
                igw_count += 1
            
            if igw_count > 0:
                logger.debug(f"Added {igw_count} Internet Gateways from region {self.region} to the item list.")
            return igw_count
        except Exception as e:
            logger.error(f"Error collecting Internet Gateways in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_elastic_ips(self, ec2):
        """Collect Elastic IP information (moved from EC2Collector)."""
        eip_count = 0
        try:
            addresses_response = ec2.describe_addresses()
            for address in addresses_response.get('Addresses', []):
                eip_id = address.get('AllocationId', address.get('PublicIp'))
                if not eip_id:
                    logger.warning(f"Skipping EIP with no AllocationId or PublicIp: {address}")
                    continue
                
                tags = address.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                eip_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        eip_name = tag.get('Value', 'N/A')
                        break
                
                item_data = {
                    'allocationId': address.get('AllocationId'),
                    'eipName': eip_name,
                    'publicIp': address.get('PublicIp', 'N/A'),
                    'privateIpAddress': address.get('PrivateIpAddress'),
                    'instanceId': address.get('InstanceId'),
                    'networkInterfaceId': address.get('NetworkInterfaceId'),
                    'networkInterfaceOwnerId': address.get('NetworkInterfaceOwnerId'),
                    'associationId': address.get('AssociationId'),
                    'domain': address.get('Domain', 'standard'),
                    'networkBorderGroup': address.get('NetworkBorderGroup', 'N/A'),
                    'customerOwnedIp': address.get('CustomerOwnedIp'),
                    'customerOwnedIpv4Pool': address.get('CustomerOwnedIpv4Pool'),
                    'carrierIp': address.get('CarrierIp'),
                    'tags': tags_json
                }
                self.add_item('ElasticIP', eip_id, to_dynamodb_format(item_data))
                eip_count += 1
            
            if eip_count > 0:
                logger.debug(f"Added {eip_count} Elastic IPs from region {self.region} to the item list.")
            return eip_count
        except Exception as e:
            logger.error(f"Error collecting Elastic IPs in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_route_tables(self, ec2):
        """Collect Route Table information."""
        rt_count = 0
        try:
            response = ec2.describe_route_tables()
            for rt in response.get('RouteTables', []):
                rt_id = rt['RouteTableId']
                tags = rt.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                rt_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        rt_name = tag.get('Value', 'N/A')
                        break
                
                # Count route types
                routes = rt.get('Routes', [])
                route_count = len(routes)
                internet_route = any(r.get('GatewayId', '').startswith('igw-') for r in routes)
                nat_route = any(r.get('NatGatewayId') for r in routes)
                vpc_peering_route = any(r.get('VpcPeeringConnectionId') for r in routes)
                
                # Get associated subnets
                associations = rt.get('Associations', [])
                associated_subnets = [a.get('SubnetId') for a in associations if a.get('SubnetId')]
                flat_associated_subnets = {}
                flatten_metric(flat_associated_subnets, {'associatedSubnets': associated_subnets})
                is_main = any(a.get('Main', False) for a in associations)
                
                item_data = {
                    'routeTableId': rt_id,
                    'routeTableName': rt_name,
                    'vpcId': rt.get('VpcId', 'N/A'),
                    'routeCount': route_count,
                    'hasInternetRoute': internet_route,
                    'hasNatRoute': nat_route,
                    'hasVpcPeeringRoute': vpc_peering_route,
                    'associationCount': len(associations),
                    'isMain': is_main,
                    'tags': tags_json,
                    **flat_associated_subnets
                }
                self.add_item('RouteTable', rt_id, to_dynamodb_format(item_data))
                rt_count += 1
            
            if rt_count > 0:
                logger.debug(f"Added {rt_count} Route Tables from region {self.region} to the item list.")
            return rt_count
        except Exception as e:
            logger.error(f"Error collecting Route Tables in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_network_acls(self, ec2):
        """Collect Network ACL information."""
        nacl_count = 0
        try:
            response = ec2.describe_network_acls()
            for nacl in response.get('NetworkAcls', []):
                nacl_id = nacl['NetworkAclId']
                tags = nacl.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                nacl_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        nacl_name = tag.get('Value', 'N/A')
                        break
                
                # Count rules
                entries = nacl.get('Entries', [])
                ingress_rules = [e for e in entries if not e.get('Egress', False)]
                egress_rules = [e for e in entries if e.get('Egress', False)]
                
                # Check for deny rules (excluding default deny all)
                custom_deny_rules = [e for e in entries if e.get('RuleAction') == 'deny' and e.get('RuleNumber') != 32767]
                
                # Get associated subnets
                associations = nacl.get('Associations', [])
                associated_subnets = [a.get('SubnetId') for a in associations if a.get('SubnetId')]
                flat_associated_subnets = {}
                flatten_metric(flat_associated_subnets, {'associatedSubnets': associated_subnets})
                
                item_data = {
                    'networkAclId': nacl_id,
                    'networkAclName': nacl_name,
                    'vpcId': nacl.get('VpcId', 'N/A'),
                    'isDefault': nacl.get('IsDefault', False),
                    'ingressRuleCount': len(ingress_rules),
                    'egressRuleCount': len(egress_rules),
                    'customDenyRuleCount': len(custom_deny_rules),
                    'associationCount': len(associations),
                    'tags': tags_json,
                    **flat_associated_subnets
                }
                self.add_item('NetworkACL', nacl_id, to_dynamodb_format(item_data))
                nacl_count += 1
            
            if nacl_count > 0:
                logger.debug(f"Added {nacl_count} Network ACLs from region {self.region} to the item list.")
            return nacl_count
        except Exception as e:
            logger.error(f"Error collecting Network ACLs in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_vpc_endpoints(self, ec2):
        """Collect VPC Endpoint information."""
        endpoint_count = 0
        try:
            paginator = ec2.get_paginator('describe_vpc_endpoints')
            for page in paginator.paginate():
                for endpoint in page.get('VpcEndpoints', []):
                    endpoint_id = endpoint['VpcEndpointId']
                    tags = endpoint.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    endpoint_name = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            endpoint_name = tag.get('Value', 'N/A')
                            break
                    
                    creation_timestamp = endpoint.get('CreationTimestamp')
                    formatted_creation = format_aws_datetime(creation_timestamp) if creation_timestamp else None
                    
                    # Flatten route tables, subnets, and security groups
                    flat_route_tables = {}
                    flatten_metric(flat_route_tables, {'RouteTableIds': endpoint.get('RouteTableIds', [])})
                    flat_subnets = {}
                    flatten_metric(flat_subnets, {'SubnetIds': endpoint.get('SubnetIds', [])})
                    flat_security_groups = {}
                    flatten_metric(flat_security_groups, {'SecurityGroupIds': [g['GroupId'] for g in endpoint.get('Groups', [])]})
                    
                    item_data = {
                        'vpcEndpointId': endpoint_id,
                        'vpcEndpointName': endpoint_name,
                        'vpcId': endpoint.get('VpcId', 'N/A'),
                        'serviceName': endpoint.get('ServiceName', 'N/A'),
                        'vpcEndpointType': endpoint.get('VpcEndpointType', 'N/A'),
                        'state': endpoint.get('State', 'N/A'),
                        'policyDocument': endpoint.get('PolicyDocument', '{}'),
                        'privateDnsEnabled': endpoint.get('PrivateDnsEnabled', False),
                        'createdAt': formatted_creation,
                        'tags': tags_json,
                        **flat_route_tables,
                        **flat_subnets,
                        **flat_security_groups
                    }
                    self.add_item('VPCEndpoint', endpoint_id, to_dynamodb_format(item_data))
                    endpoint_count += 1
            
            if endpoint_count > 0:
                logger.debug(f"Added {endpoint_count} VPC Endpoints from region {self.region} to the item list.")
            return endpoint_count
        except Exception as e:
            logger.error(f"Error collecting VPC Endpoints in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_vpc_peering_connections(self, ec2):
        """Collect VPC Peering Connection information."""
        peering_count = 0
        try:
            response = ec2.describe_vpc_peering_connections()
            for peering in response.get('VpcPeeringConnections', []):
                peering_id = peering['VpcPeeringConnectionId']
                tags = peering.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                peering_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        peering_name = tag.get('Value', 'N/A')
                        break
                
                # Get accepter and requester VPC info
                accepter_vpc = peering.get('AccepterVpcInfo', {})
                requester_vpc = peering.get('RequesterVpcInfo', {})
                
                item_data = {
                    'vpcPeeringConnectionId': peering_id,
                    'peeringConnectionName': peering_name,
                    'status': peering.get('Status', {}).get('Code', 'N/A'),
                    'statusMessage': peering.get('Status', {}).get('Message', ''),
                    'accepterVpcId': accepter_vpc.get('VpcId', 'N/A'),
                    'accepterRegion': accepter_vpc.get('Region', 'N/A'),
                    'accepterOwnerId': accepter_vpc.get('OwnerId', 'N/A'),
                    'requesterVpcId': requester_vpc.get('VpcId', 'N/A'),
                    'requesterRegion': requester_vpc.get('Region', 'N/A'),
                    'requesterOwnerId': requester_vpc.get('OwnerId', 'N/A'),
                    'tags': tags_json
                }
                self.add_item('VPCPeeringConnection', peering_id, to_dynamodb_format(item_data))
                peering_count += 1
            
            if peering_count > 0:
                logger.debug(f"Added {peering_count} VPC Peering Connections from region {self.region} to the item list.")
            return peering_count
        except Exception as e:
            logger.error(f"Error collecting VPC Peering Connections in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_vpn_connections(self, ec2):
        """Collect VPN Connection information."""
        vpn_count = 0
        try:
            response = ec2.describe_vpn_connections()
            for vpn in response.get('VpnConnections', []):
                vpn_id = vpn['VpnConnectionId']
                tags = vpn.get('Tags', [])
                tags_json = json.dumps(tags) if tags else '[]'
                
                vpn_name = 'N/A'
                for tag in tags:
                    if tag.get('Key') == 'Name':
                        vpn_name = tag.get('Value', 'N/A')
                        break
                
                # Get tunnel status
                vgw_telemetry = vpn.get('VgwTelemetry', [])
                tunnels_up = sum(1 for t in vgw_telemetry if t.get('Status') == 'UP')
                
                item_data = {
                    'vpnConnectionId': vpn_id,
                    'vpnConnectionName': vpn_name,
                    'state': vpn.get('State', 'N/A'),
                    'type': vpn.get('Type', 'N/A'),
                    'customerGatewayId': vpn.get('CustomerGatewayId', 'N/A'),
                    'vpnGatewayId': vpn.get('VpnGatewayId', 'N/A'),
                    'transitGatewayId': vpn.get('TransitGatewayId', 'N/A'),
                    'category': vpn.get('Category', 'N/A'),
                    'tunnelCount': len(vgw_telemetry),
                    'tunnelsUp': tunnels_up,
                    'tags': tags_json
                }
                self.add_item('VPNConnection', vpn_id, to_dynamodb_format(item_data))
                vpn_count += 1
            
            if vpn_count > 0:
                logger.debug(f"Added {vpn_count} VPN Connections from region {self.region} to the item list.")
            return vpn_count
        except Exception as e:
            logger.error(f"Error collecting VPN Connections in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_transit_gateways(self, ec2):
        """Collect Transit Gateway information."""
        tgw_count = 0
        try:
            paginator = ec2.get_paginator('describe_transit_gateways')
            for page in paginator.paginate():
                for tgw in page.get('TransitGateways', []):
                    tgw_id = tgw['TransitGatewayId']
                    tags = tgw.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    tgw_name = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            tgw_name = tag.get('Value', 'N/A')
                            break
                    
                    creation_time = tgw.get('CreationTime')
                    formatted_creation = format_aws_datetime(creation_time) if creation_time else None
                    
                item_data = {
                    'transitGatewayId': tgw_id,
                    'transitGatewayName': tgw_name,
                    'state': tgw.get('State', 'N/A'),
                    'ownerId': tgw.get('OwnerId', 'N/A'),
                    'description': tgw.get('Description', ''),
                    'amazonSideAsn': tgw.get('Options', {}).get('AmazonSideAsn', 'N/A'),
                    'dnsSupport': tgw.get('Options', {}).get('DnsSupport', 'N/A'),
                    'vpnEcmpSupport': tgw.get('Options', {}).get('VpnEcmpSupport', 'N/A'),
                    'defaultRouteTableAssociation': tgw.get('Options', {}).get('DefaultRouteTableAssociation', 'N/A'),
                    'defaultRouteTablePropagation': tgw.get('Options', {}).get('DefaultRouteTablePropagation', 'N/A'),
                    'multicastSupport': tgw.get('Options', {}).get('MulticastSupport', 'N/A'),
                    'createdAt': formatted_creation,
                    'tags': tags_json
                }
                self.add_item('TransitGateway', tgw_id, to_dynamodb_format(item_data))
                tgw_count += 1
            
            if tgw_count > 0:
                logger.debug(f"Added {tgw_count} Transit Gateways from region {self.region} to the item list.")
            return tgw_count
        except Exception as e:
            logger.error(f"Error collecting Transit Gateways in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_transit_gateway_attachments(self, ec2):
        """Collect Transit Gateway Attachment information."""
        tgw_attach_count = 0
        try:
            paginator = ec2.get_paginator('describe_transit_gateway_attachments')
            for page in paginator.paginate():
                for attachment in page.get('TransitGatewayAttachments', []):
                    attachment_id = attachment['TransitGatewayAttachmentId']
                    tags = attachment.get('Tags', [])
                    tags_json = json.dumps(tags) if tags else '[]'
                    
                    attachment_name = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            attachment_name = tag.get('Value', 'N/A')
                            break
                    
                    creation_time = attachment.get('CreationTime')
                    formatted_creation = format_aws_datetime(creation_time) if creation_time else None
                    
                    # Flatten association
                    flat_association = {}
                    flatten_metric(flat_association, {'association': attachment.get('Association', {})})
                    
                item_data = {
                    'transitGatewayAttachmentId': attachment_id,
                    'attachmentName': attachment_name,
                    'transitGatewayId': attachment.get('TransitGatewayId', 'N/A'),
                    'transitGatewayOwnerId': attachment.get('TransitGatewayOwnerId', 'N/A'),
                    'attachedResourceType': attachment.get('ResourceType', 'N/A'),
                    'attachedResourceId': attachment.get('ResourceId', 'N/A'),
                    'resourceOwnerId': attachment.get('ResourceOwnerId', 'N/A'),
                    'state': attachment.get('State', 'N/A'),
                    'createdAt': formatted_creation,
                    'tags': tags_json,
                    **flat_association
                }
                self.add_item('TransitGatewayAttachment', attachment_id, to_dynamodb_format(item_data))
                tgw_attach_count += 1
            
            if tgw_attach_count > 0:
                logger.debug(f"Added {tgw_attach_count} Transit Gateway Attachments from region {self.region} to the item list.")
            return tgw_attach_count
        except Exception as e:
            logger.error(f"Error collecting Transit Gateway Attachments in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_application_load_balancers(self, elbv2):
        """Collect Application and Network Load Balancer information."""
        alb_count = 0
        try:
            paginator = elbv2.get_paginator('describe_load_balancers')
            for page in paginator.paginate():
                for lb in page.get('LoadBalancers', []):
                    lb_arn = lb['LoadBalancerArn']
                    lb_name = lb['LoadBalancerName']
                    
                    # Get tags
                    tags = []
                    tags_json = '[]'
                    try:
                        tag_response = elbv2.describe_tags(ResourceArns=[lb_arn])
                        tag_descriptions = tag_response.get('TagDescriptions', [])
                        if tag_descriptions:
                            tags = tag_descriptions[0].get('Tags', [])
                            tags_json = json.dumps(tags) if tags else '[]'
                    except Exception as e:
                        logger.warning(f"Could not get tags for load balancer {lb_name}: {str(e)}")
                    
                    lb_name_tag = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            lb_name_tag = tag.get('Value', 'N/A')
                            break
                    
                    creation_time = lb.get('CreatedTime')
                    formatted_creation = format_aws_datetime(creation_time) if creation_time else None
                    
                    # Get target groups
                    target_groups = []
                    try:
                        tg_response = elbv2.describe_target_groups(LoadBalancerArn=lb_arn)
                        target_groups = [tg['TargetGroupArn'] for tg in tg_response.get('TargetGroups', [])]
                    except Exception as e:
                        logger.warning(f"Could not get target groups for load balancer {lb_name}: {str(e)}")
                    
                    # Flatten availability zones, security groups, and target groups
                    flat_availability_zones = {}
                    flatten_metric(flat_availability_zones, {'AvailabilityZones': [az['ZoneName'] for az in lb.get('AvailabilityZones', [])]})
                    flat_security_groups = {}
                    flatten_metric(flat_security_groups, {'SecurityGroups': lb.get('SecurityGroups', [])})
                    flat_target_groups = {}
                    flatten_metric(flat_target_groups, {'TargetGroups': target_groups})
                    
                    item_data = {
                        'loadBalancerArn': lb_arn,
                        'loadBalancerName': lb_name,
                        'loadBalancerNameTag': lb_name_tag,
                        'dnsName': lb.get('DNSName', 'N/A'),
                        'canonicalHostedZoneId': lb.get('CanonicalHostedZoneId', 'N/A'),
                        'scheme': lb.get('Scheme', 'N/A'),
                        'state': lb.get('State', {}).get('Code', 'N/A'),
                        'type': lb.get('Type', 'N/A'),
                        'vpcId': lb.get('VpcId', 'N/A'),
                        'ipAddressType': lb.get('IpAddressType', 'N/A'),
                        'createdAt': formatted_creation,
                        'tags': tags_json,
                        **flat_availability_zones,
                        **flat_security_groups,
                        **flat_target_groups
                    }
                    self.add_item('LoadBalancer', lb_arn, to_dynamodb_format(item_data))
                    alb_count += 1
            
            if alb_count > 0:
                logger.debug(f"Added {alb_count} Load Balancers from region {self.region} to the item list.")
            return alb_count
        except Exception as e:
            logger.error(f"Error collecting Application/Network Load Balancers in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_classic_load_balancers(self, elb):
        """Collect Classic Load Balancer information."""
        clb_count = 0
        try:
            paginator = elb.get_paginator('describe_load_balancers')
            for page in paginator.paginate():
                for lb in page.get('LoadBalancerDescriptions', []):
                    lb_name = lb['LoadBalancerName']
                    
                    # Get tags
                    tags = []
                    tags_json = '[]'
                    try:
                        tag_response = elb.describe_tags(LoadBalancerNames=[lb_name])
                        tag_descriptions = tag_response.get('TagDescriptions', [])
                        if tag_descriptions:
                            tags = tag_descriptions[0].get('Tags', [])
                            tags_json = json.dumps(tags) if tags else '[]'
                    except Exception as e:
                        logger.warning(f"Could not get tags for classic load balancer {lb_name}: {str(e)}")
                    
                    lb_name_tag = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            lb_name_tag = tag.get('Value', 'N/A')
                            break
                    
                    creation_time = lb.get('CreatedTime')
                    formatted_creation = format_aws_datetime(creation_time) if creation_time else None
                    
                    # Flatten availability zones, subnets, security groups, instances, and health check
                    flat_availability_zones = {}
                    flatten_metric(flat_availability_zones, {'AvailabilityZones': lb.get('AvailabilityZones', [])})
                    flat_subnets = {}
                    flatten_metric(flat_subnets, {'Subnets': lb.get('Subnets', [])})
                    flat_security_groups = {}
                    flatten_metric(flat_security_groups, {'SecurityGroups': lb.get('SecurityGroups', [])})
                    flat_instances = {}
                    flatten_metric(flat_instances, {'Instances': [i['InstanceId'] for i in lb.get('Instances', [])]})
                    flat_health_check = {}
                    flatten_metric(flat_health_check, {'HealthCheck': lb.get('HealthCheck', {})})
                    
                    item_data = {
                        'loadBalancerName': lb_name,
                        'loadBalancerNameTag': lb_name_tag,
                        'dnsName': lb.get('DNSName', 'N/A'),
                        'canonicalHostedZoneName': lb.get('CanonicalHostedZoneName', 'N/A'),
                        'canonicalHostedZoneNameId': lb.get('CanonicalHostedZoneNameID', 'N/A'),
                        'scheme': lb.get('Scheme', 'N/A'),
                        'vpcId': lb.get('VPCId', 'N/A'),
                        'instanceCount': len(lb.get('Instances', [])),
                        'createdAt': formatted_creation,
                        'tags': tags_json,
                        **flat_availability_zones,
                        **flat_subnets,
                        **flat_security_groups,
                        **flat_instances,
                        **flat_health_check
                    }
                    self.add_item('ClassicLoadBalancer', lb_name, to_dynamodb_format(item_data))
                    clb_count += 1
            
            if clb_count > 0:
                logger.debug(f"Added {clb_count} Classic Load Balancers from region {self.region} to the item list.")
            return clb_count
        except Exception as e:
            logger.error(f"Error collecting Classic Load Balancers in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_auto_scaling_groups(self, autoscaling):
        """Collect Auto Scaling Group information."""
        asg_count = 0
        try:
            paginator = autoscaling.get_paginator('describe_auto_scaling_groups')
            for page in paginator.paginate():
                for asg in page.get('AutoScalingGroups', []):
                    asg_name = asg['AutoScalingGroupName']
                    
                    # Process tags
                    tags = asg.get('Tags', [])
                    # Convert ASG tag format to standard format
                    standard_tags = [{'Key': t.get('Key'), 'Value': t.get('Value')} for t in tags]
                    tags_json = json.dumps(standard_tags) if standard_tags else '[]'
                    
                    asg_name_tag = 'N/A'
                    for tag in tags:
                        if tag.get('Key') == 'Name':
                            asg_name_tag = tag.get('Value', 'N/A')
                            break
                    
                    creation_time = asg.get('CreatedTime')
                    formatted_creation = format_aws_datetime(creation_time) if creation_time else None
                    
                    # Get current instance info
                    instances = asg.get('Instances', [])
                    instance_ids = [i['InstanceId'] for i in instances]
                    healthy_instances = sum(1 for i in instances if i.get('HealthStatus') == 'Healthy')
                    
                    # Flatten instance IDs, availability zones, load balancer names, target groups, and launch template
                    flat_instance_ids = {}
                    flatten_metric(flat_instance_ids, {'InstanceIds': instance_ids})
                    flat_availability_zones = {}
                    flatten_metric(flat_availability_zones, {'AvailabilityZones': asg.get('AvailabilityZones', [])})
                    flat_load_balancer_names = {}
                    flatten_metric(flat_load_balancer_names, {'LoadBalancerNames': asg.get('LoadBalancerNames', [])})
                    flat_target_group_arns = {}
                    flatten_metric(flat_target_group_arns, {'TargetGroupARNs': asg.get('TargetGroupARNs', [])})
                    flat_launch_template = {}
                    flatten_metric(flat_launch_template, {'LaunchTemplate': asg.get('LaunchTemplate', {})})
                    
                    item_data = {
                        'autoScalingGroupName': asg_name,
                        'autoScalingGroupNameTag': asg_name_tag,
                        'autoScalingGroupARN': asg.get('AutoScalingGroupARN', 'N/A'),
                        'launchConfigurationName': asg.get('LaunchConfigurationName'),
                        'minSize': asg.get('MinSize', 0),
                        'maxSize': asg.get('MaxSize', 0),
                        'desiredCapacity': asg.get('DesiredCapacity', 0),
                        'currentSize': len(instances),
                        'healthyInstances': healthy_instances,
                        'healthCheckType': asg.get('HealthCheckType', 'N/A'),
                        'healthCheckGracePeriod': asg.get('HealthCheckGracePeriod', 0),
                        'vpcZoneIdentifier': asg.get('VPCZoneIdentifier', ''),
                        'serviceLinkedRoleARN': asg.get('ServiceLinkedRoleARN', 'N/A'),
                        'createdAt': formatted_creation,
                        'tags': tags_json,
                        **flat_instance_ids,
                        **flat_availability_zones,
                        **flat_load_balancer_names,
                        **flat_target_group_arns,
                        **flat_launch_template
                    }
                    self.add_item('AutoScalingGroup', asg_name, to_dynamodb_format(item_data))
                    asg_count += 1
            
            if asg_count > 0:
                logger.debug(f"Added {asg_count} Auto Scaling Groups from region {self.region} to the item list.")
            return asg_count
        except Exception as e:
            logger.error(f"Error collecting Auto Scaling Groups in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_direct_connect_connections(self, directconnect):
        """Collect Direct Connect Connection information."""
        dx_count = 0
        try:
            response = directconnect.describe_connections()
            for conn in response.get('connections', []):
                conn_id = conn['connectionId']
                conn_name = conn.get('connectionName', 'N/A')
                
                # Direct Connect doesn't support tags in the same way
                tags = []
                tags_json = '[]'
                try:
                    tag_response = directconnect.describe_tags(resourceArns=[conn.get('connectionArn', '')])
                    tags = tag_response.get('resourceTags', [])[0].get('tags', []) if tag_response.get('resourceTags') else []
                    tags_json = json.dumps(tags) if tags else '[]'
                except Exception as e:
                    logger.debug(f"Could not get tags for Direct Connect connection {conn_id}: {str(e)}")
                
                item_data = {
                    'connectionId': conn_id,
                    'connectionName': conn_name,
                    'connectionState': conn.get('connectionState', 'N/A'),
                    'region': conn.get('region', self.region),
                    'location': conn.get('location', 'N/A'),
                    'bandwidth': conn.get('bandwidth', 'N/A'),
                    'vlan': conn.get('vlan', 0),
                    'partnerName': conn.get('partnerName', 'N/A'),
                    'loaIssueTime': format_aws_datetime(conn.get('loaIssueTime')) if conn.get('loaIssueTime') else None,
                    'lagId': conn.get('lagId'),
                    'awsDevice': conn.get('awsDevice', 'N/A'),
                    'awsDeviceV2': conn.get('awsDeviceV2', 'N/A'),
                    'hasLogicalRedundancy': conn.get('hasLogicalRedundancy', 'N/A'),
                    'macSecCapable': conn.get('macSecCapable', False),
                    'portEncryptionStatus': conn.get('portEncryptionStatus', 'N/A'),
                    'encryptionMode': conn.get('encryptionMode', 'N/A'),
                    'tags': tags_json
                }
                self.add_item('DirectConnectConnection', conn_id, to_dynamodb_format(item_data))
                dx_count += 1
            
            if dx_count > 0:
                logger.debug(f"Added {dx_count} Direct Connect Connections from region {self.region} to the item list.")
            return dx_count
        except Exception as e:
            logger.error(f"Error collecting Direct Connect Connections in region {self.region}: {str(e)}", exc_info=True)
            return 0
    
    def _collect_direct_connect_virtual_interfaces(self, directconnect):
        """Collect Direct Connect Virtual Interface information."""
        vif_count = 0
        try:
            response = directconnect.describe_virtual_interfaces()
            for vif in response.get('virtualInterfaces', []):
                vif_id = vif['virtualInterfaceId']
                vif_name = vif.get('virtualInterfaceName', 'N/A')
                
                # Flatten route filter prefixes and BGP peers
                flat_route_filter_prefixes = {}
                flatten_metric(flat_route_filter_prefixes, {'RouteFilterPrefixes': vif.get('routeFilterPrefixes', [])})
                flat_bgp_peers = {}
                flatten_metric(flat_bgp_peers, {'BgpPeers': vif.get('bgpPeers', [])})
                
                item_data = {
                    'virtualInterfaceId': vif_id,
                    'virtualInterfaceName': vif_name,
                    'connectionId': vif.get('connectionId', 'N/A'),
                    'virtualInterfaceType': vif.get('virtualInterfaceType', 'N/A'),
                    'virtualInterfaceState': vif.get('virtualInterfaceState', 'N/A'),
                    'customerAddress': vif.get('customerAddress', 'N/A'),
                    'amazonAddress': vif.get('amazonAddress', 'N/A'),
                    'vlan': vif.get('vlan', 0),
                    'asn': vif.get('asn', 0),
                    'amazonSideAsn': vif.get('amazonSideAsn', 0),
                    'authKey': 'REDACTED' if vif.get('authKey') else 'N/A',
                    'customerRouterConfig': 'Available' if vif.get('customerRouterConfig') else 'N/A',
                    'mtu': vif.get('mtu', 1500),
                    'jumboFrameCapable': vif.get('jumboFrameCapable', False),
                    'virtualGatewayId': vif.get('virtualGatewayId'),
                    'directConnectGatewayId': vif.get('directConnectGatewayId'),
                    'tags': json.dumps(vif.get('tags', [])) if vif.get('tags') else '[]',
                    **flat_route_filter_prefixes,
                    **flat_bgp_peers
                }
                self.add_item('DirectConnectVirtualInterface', vif_id, to_dynamodb_format(item_data))
                vif_count += 1
            
            if vif_count > 0:
                logger.debug(f"Added {vif_count} Direct Connect Virtual Interfaces from region {self.region} to the item list.")
            return vif_count
        except Exception as e:
            logger.error(f"Error collecting Direct Connect Virtual Interfaces in region {self.region}: {str(e)}", exc_info=True)
            return 0