# lambdafunction/collectors/metrics_calculator.py
import json
import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class MetricsAccumulator:
    """
    Accumulates metrics during Lambda processing without keeping all items in memory.
    Designed for incremental updates during multi-region/multi-account processing.
    """
    
    def __init__(self):
        """Initialize the metrics accumulator with empty counters."""
        self.reset()
    
    def reset(self):
        """Reset all counters for a new collection run."""
        # Global counters
        self.resource_counts = defaultdict(int)
        self.account_counts = defaultdict(int)
        self.region_counts = defaultdict(int)
        self.account_names = {}  # account_id -> account_name mapping
        
        # EC2 specific counters
        self.ec2_states = defaultdict(int)
        self.ec2_health = defaultdict(int)
        self.ec2_cw_memory = 0
        self.ec2_cw_disk = 0
        self.ec2_cw_both = 0
        self.ec2_ssm_connected = 0
        self.ec2_ssm_notconnected = 0
        self.ec2_ssm_notinstalled = 0
        self.ec2_total = 0
        self.ec2_running = 0
        self.ec2_stopped = 0
        
        # RDS specific counters
        self.rds_total = 0
        self.rds_available = 0
        self.rds_engines = defaultdict(int)
        self.rds_multiaz = 0
        self.rds_performance_insights = 0
        
        # S3 specific counters
        self.s3_total = 0
        self.s3_with_lifecycle = 0
        
        # Networking counters
        self.sg_total = 0
        self.sg_with_exposed_ports = 0
        self.vpc_total = 0
        self.subnet_total = 0
        
        # Cost optimization opportunities
        self.ebs_unattached = 0
        self.eip_unassociated = 0
        self.snapshots_orphaned = 0
        
        # Recent resources tracking
        self.recent_resources = []  # Keep last 10 created/updated resources
        
    def add_resource(self, item: Dict[str, Any]):
        """
        Add a single resource to the accumulator.
        
        Args:
            item: Resource dictionary from collectors
        """
        resource_type = item.get('resourceType')
        if not resource_type:
            return
            
        # Count by type
        self.resource_counts[resource_type] += 1
        
        # Count by account
        account_id = item.get('accountId')
        if account_id:
            self.account_counts[account_id] += 1
            account_name = item.get('accountName')
            if account_name:
                self.account_names[account_id] = account_name
        
        # Count by region (excluding global resources)
        region = item.get('region')
        if region and region != 'global':
            self.region_counts[region] += 1
        
        # Track recent resources (keep only last 10)
        if item.get('createdAt'):
            self.recent_resources.append({
                'resourceType': resource_type,
                'region': region,
                'createdAt': item.get('createdAt'),
                'identifier': self._get_resource_identifier(item)
            })
            # Keep only the 10 most recent
            self.recent_resources = sorted(
                self.recent_resources, 
                key=lambda x: x['createdAt'], 
                reverse=True
            )[:10]
        
        # Process type-specific metrics
        if resource_type == 'EC2Instance':
            self._process_ec2_item(item)
        elif resource_type == 'RDSInstance':
            self._process_rds_item(item)
        elif resource_type == 'S3Bucket':
            self._process_s3_item(item)
        elif resource_type == 'EBSVolume':
            self._process_ebs_item(item)
        elif resource_type == 'ElasticIP':
            self._process_eip_item(item)
        elif resource_type == 'SecurityGroup':
            self._process_sg_item(item)
        elif resource_type in ['EBSSnapshot', 'AMI']:
            self._process_snapshot_item(item)
        elif resource_type == 'VPC':
            self.vpc_total += 1
        elif resource_type == 'Subnet':
            self.subnet_total += 1
    
    def _get_resource_identifier(self, item: Dict) -> str:
        """Get a human-readable identifier for a resource."""
        resource_type = item.get('resourceType', '')
        
        # Try to get the most descriptive identifier
        if resource_type == 'EC2Instance':
            return item.get('instanceName') or item.get('instanceId', 'Unknown')
        elif resource_type == 'S3Bucket':
            return item.get('bucketName', 'Unknown')
        elif resource_type == 'RDSInstance':
            return item.get('dbInstanceId', 'Unknown')
        elif resource_type == 'EBSVolume':
            return item.get('volumeName') or item.get('volumeId', 'Unknown')
        elif resource_type == 'VPC':
            return item.get('vpcName') or item.get('vpcId', 'Unknown')
        elif resource_type == 'SecurityGroup':
            return item.get('groupName', 'Unknown')
        else:
            # Generic fallback
            return item.get('id', 'Unknown')
    
    def _process_ec2_item(self, item: Dict):
        """Process EC2-specific metrics."""
        self.ec2_total += 1
        
        # State counting
        state = (item.get('instanceState') or 'unknown').lower()
        self.ec2_states[state] += 1
        
        if state == 'running':
            self.ec2_running += 1
            
            # CloudWatch Agent detection (only for running instances)
            has_memory = item.get('cwAgentMemoryDetected', False)
            has_disk = item.get('cwAgentDiskDetected', False)
            
            if has_memory:
                self.ec2_cw_memory += 1
            if has_disk:
                self.ec2_cw_disk += 1
            if has_memory and has_disk:
                self.ec2_cw_both += 1
            
            # SSM Agent status (only for running instances)
            ssm_status = (item.get('ssmStatus') or '').lower()
            if ssm_status in ['connected', 'online']:
                self.ec2_ssm_connected += 1
            elif ssm_status == 'notinstalled' or not ssm_status:
                self.ec2_ssm_notinstalled += 1
            else:
                self.ec2_ssm_notconnected += 1
                
        elif state == 'stopped':
            self.ec2_stopped += 1
        
        # Health status
        health_status = item.get('healthStatus', 'Unknown')
        self.ec2_health[health_status] += 1
    
    def _process_rds_item(self, item: Dict):
        """Process RDS-specific metrics."""
        self.rds_total += 1
        
        # Status
        status = (item.get('status') or '').lower()
        if status == 'available':
            self.rds_available += 1
        
        # Engine type
        engine = item.get('engine', 'unknown')
        self.rds_engines[engine] += 1
        
        # Multi-AZ
        if item.get('multiAZ'):
            self.rds_multiaz += 1
        
        # Performance Insights
        if item.get('performanceInsightsEnabled'):
            self.rds_performance_insights += 1
    
    def _process_s3_item(self, item: Dict):
        """Process S3-specific metrics."""
        self.s3_total += 1
        
        # Lifecycle rules
        if item.get('hasLifecycleRules'):
            self.s3_with_lifecycle += 1
    
    def _process_ebs_item(self, item: Dict):
        """Process EBS Volume metrics for cost optimization."""
        # Check for unattached volumes
        attached_instances = item.get('attachedInstances')
        if attached_instances:
            try:
                # Handle both string and list formats
                if isinstance(attached_instances, str):
                    attached_list = json.loads(attached_instances) if attached_instances != '[]' else []
                else:
                    attached_list = attached_instances
                    
                if not attached_list:
                    self.ebs_unattached += 1
            except:
                pass
    
    def _process_eip_item(self, item: Dict):
        """Process Elastic IP metrics for cost optimization."""
        # Check for unassociated EIPs
        if not item.get('instanceId') and not item.get('networkInterfaceId'):
            self.eip_unassociated += 1
    
    def _process_sg_item(self, item: Dict):
        """Process Security Group metrics."""
        self.sg_total += 1
        
        # Check for exposed ports
        if item.get('hasExposedIngressPorts'):
            self.sg_with_exposed_ports += 1
    
    def _process_snapshot_item(self, item: Dict):
        """Process snapshot metrics for cost optimization."""
        # Simple heuristic: snapshots older than 90 days might be orphaned
        # This is a simplified check - real orphan detection would need more logic
        pass
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get accumulated metrics formatted for DynamoDB storage.
        
        Returns:
            Dictionary with formatted metrics
        """
        total_resources = sum(self.resource_counts.values())
        
        # Format account distribution with names
        account_dist = []
        for account_id, count in sorted(
            self.account_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]:  # Top 10 accounts
            account_dist.append({
                'accountId': account_id,
                'accountName': self.account_names.get(account_id, account_id),
                'count': count
            })
        
        # Format region distribution
        region_dist = [
            {'region': region, 'count': count}
            for region, count in sorted(
                self.region_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]  # Top 10 regions
        ]
        
        # Global metrics
        global_metrics = {
            'totalResources': total_resources,
            'resourceCounts': dict(self.resource_counts),
            'accountDistribution': account_dist,
            'regionDistribution': region_dist,
            'recentResources': self.recent_resources[:10]
        }
        
        # EC2 Health metrics
        ec2_metrics = None
        if self.ec2_total > 0:
            ec2_metrics = {
                'total': self.ec2_total,
                'byState': dict(self.ec2_states),
                'healthStatus': dict(self.ec2_health),
                'cloudwatchAgent': {
                    'memoryMonitoring': self.ec2_cw_memory,
                    'diskMonitoring': self.ec2_cw_disk,
                    'bothEnabled': self.ec2_cw_both,
                    'noneEnabled': self.ec2_running - max(self.ec2_cw_memory, self.ec2_cw_disk) if self.ec2_running > 0 else 0,
                    'percentageWithMemory': round((self.ec2_cw_memory / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1),
                    'percentageWithDisk': round((self.ec2_cw_disk / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1)
                },
                'ssmAgent': {
                    'connected': self.ec2_ssm_connected,
                    'notConnected': self.ec2_ssm_notconnected,
                    'notInstalled': self.ec2_ssm_notinstalled,
                    'percentageConnected': round((self.ec2_ssm_connected / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1)
                }
            }
        
        # RDS metrics
        rds_metrics = None
        if self.rds_total > 0:
            rds_metrics = {
                'total': self.rds_total,
                'available': self.rds_available,
                'engines': dict(self.rds_engines),
                'multiAZ': self.rds_multiaz,
                'performanceInsights': self.rds_performance_insights,
                'percentageMultiAZ': round((self.rds_multiaz / self.rds_total * 100), 1),
                'percentageWithPerfInsights': round((self.rds_performance_insights / self.rds_total * 100), 1)
            }
        
        # Storage metrics
        storage_metrics = {
            's3Buckets': self.s3_total,
            's3WithLifecycle': self.s3_with_lifecycle,
            'ebsVolumes': self.resource_counts.get('EBSVolume', 0),
            'ebsSnapshots': self.resource_counts.get('EBSSnapshot', 0),
            'amiSnapshots': self.resource_counts.get('AMI', 0)
        }
        
        # Cost optimization opportunities
        cost_metrics = {
            'unattachedEBSVolumes': self.ebs_unattached,
            'unassociatedElasticIPs': self.eip_unassociated,
            'potentialMonthlySavings': self._estimate_savings()
        }
        
        # Security metrics
        security_metrics = {
            'securityGroups': self.sg_total,
            'exposedSecurityGroups': self.sg_with_exposed_ports,
            'percentageExposed': round((self.sg_with_exposed_ports / self.sg_total * 100) if self.sg_total > 0 else 0, 1)
        }
        
        return {
            'global': global_metrics,
            'ec2': ec2_metrics,
            'rds': rds_metrics,
            'storage': storage_metrics,
            'cost': cost_metrics,
            'security': security_metrics
        }
    
    def _estimate_savings(self) -> float:
        """
        Estimate potential monthly savings from unused resources.
        These are rough estimates for demonstration.
        """
        savings = 0.0
        
        # Unattached EBS volumes (~$0.10/GB/month, assume 100GB average)
        savings += self.ebs_unattached * 10.0
        
        # Unassociated Elastic IPs (~$3.60/month each)
        savings += self.eip_unassociated * 3.60
        
        return round(savings, 2)


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
            # For each item in the list, expand recursively if dict, else assign directly
            for i, elem in enumerate(v):
                indexed_key = f"{new_key}_{i}"
                if isinstance(elem, dict):
                    flatten_metric(item, elem, indexed_key)
                elif isinstance(elem, list):
                    # Handle nested lists recursively
                    flatten_metric(item, {str(i): elem}, new_key)
                else:
                    item[indexed_key] = elem
        else:
            item[new_key] = v
    return item


def save_metrics_to_dynamodb(tables: List, metrics: Dict, processing_duration: float) -> int:
    """
    Save calculated metrics as DynamoDB items.
    
    Args:
        tables: List of DynamoDB table objects
        metrics: Dictionary of calculated metrics
        processing_duration: Total processing time in seconds
    
    Returns:
        Number of items saved
    """
    from collectors.base import batch_write_to_dynamodb, format_aws_datetime
    
    timestamp = datetime.now(timezone.utc)
    date_str = timestamp.strftime('%Y-%m-%d')
    iso_timestamp = format_aws_datetime(timestamp)
    
    items_to_save = []
    
    # Global metrics item - current snapshot
    global_item_current = {
        'id': f'METRICS-GLOBAL-CURRENT',
        'resourceType': 'METRIC_SUMMARY',
        'accountId': 'GLOBAL',
        'accountName': 'Global Metrics',
        'region': 'global',
        'metricType': 'GLOBAL_SUMMARY',
        'metricDate': date_str,
        'isMetric': True,
        'collectionDuration': processing_duration,
        'resourcesProcessed': metrics['global']['totalResources'],
        'lastUpdated': iso_timestamp,
        'createdAt': iso_timestamp,
        'updatedAt': iso_timestamp
    }
    global_item_current = flatten_metric(global_item_current, metrics['global'])
    items_to_save.append(global_item_current)

    # Historical global metrics (for trend analysis)
    global_item_historical = {
        **global_item_current,
        'id': f'METRICS-GLOBAL-{date_str}'
    }
    items_to_save.append(global_item_historical)

    # EC2 Health metrics
    if metrics.get('ec2'):
        ec2_item_current = {
            'id': f'METRICS-EC2-CURRENT',
            'resourceType': 'METRIC_EC2_HEALTH',
            'accountId': 'GLOBAL',
            'accountName': 'EC2 Health Metrics',
            'region': 'global',
            'metricType': 'EC2_HEALTH',
            'metricDate': date_str,
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        ec2_item_current = flatten_metric(ec2_item_current, metrics['ec2'])
        items_to_save.append(ec2_item_current)

        # Historical EC2 metrics
        ec2_item_historical = {
            **ec2_item_current,
            'id': f'METRICS-EC2-{date_str}'
        }
        items_to_save.append(ec2_item_historical)

    # RDS metrics
    if metrics.get('rds'):
        rds_item_current = {
            'id': f'METRICS-RDS-CURRENT',
            'resourceType': 'METRIC_RDS',
            'accountId': 'GLOBAL',
            'accountName': 'RDS Metrics',
            'region': 'global',
            'metricType': 'RDS_METRICS',
            'metricDate': date_str,
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        rds_item_current = flatten_metric(rds_item_current, metrics['rds'])
        items_to_save.append(rds_item_current)

    # Storage metrics
    if metrics.get('storage'):
        storage_item_current = {
            'id': f'METRICS-STORAGE-CURRENT',
            'resourceType': 'METRIC_STORAGE',
            'accountId': 'GLOBAL',
            'accountName': 'Storage Metrics',
            'region': 'global',
            'metricType': 'STORAGE_METRICS',
            'metricDate': date_str,
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        storage_item_current = flatten_metric(storage_item_current, metrics['storage'])
        items_to_save.append(storage_item_current)

    # Cost optimization metrics
    if metrics.get('cost'):
        cost_item_current = {
            'id': f'METRICS-COST-CURRENT',
            'resourceType': 'METRIC_COST',
            'accountId': 'GLOBAL',
            'accountName': 'Cost Optimization',
            'region': 'global',
            'metricType': 'COST_OPTIMIZATION',
            'metricDate': date_str,
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        cost_item_current = flatten_metric(cost_item_current, metrics['cost'])
        items_to_save.append(cost_item_current)

    # Security metrics
    if metrics.get('security'):
        security_item_current = {
            'id': f'METRICS-SECURITY-CURRENT',
            'resourceType': 'METRIC_SECURITY',
            'accountId': 'GLOBAL',
            'accountName': 'Security Metrics',
            'region': 'global',
            'metricType': 'SECURITY_METRICS',
            'metricDate': date_str,
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        security_item_current = flatten_metric(security_item_current, metrics['security'])
        items_to_save.append(security_item_current)
    
    # Save to all configured tables
    total_saved = 0
    for table in tables:
        try:
            count = batch_write_to_dynamodb([table], items_to_save)
            total_saved = count  # Track based on primary table
            logger.info(f"Successfully saved {len(items_to_save)} metric items to table {table.name}")
        except Exception as e:
            logger.error(f"Error saving metrics to table {table.name}: {e}", exc_info=True)
    
    return total_saved