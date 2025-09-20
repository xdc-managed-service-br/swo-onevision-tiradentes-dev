import json
import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Any, DefaultDict, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# -----------------------------
# Helpers
# -----------------------------

def _safe_pct(numer: int, denom: int) -> int:
    """Return integer percentage, guarding divide-by-zero."""
    if not denom:
        return 0
    try:
        return int(round((numer / denom) * 100))
    except Exception:
        return 0


def _parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 string into an aware datetime (UTC) when possible."""
    if not value:
        return None
    try:
        # Accept already-UTC strings or naive strings
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


# -----------------------------
# MetricsAccumulator
# -----------------------------

class MetricsAccumulator:
    """
    Accumulates metrics during Lambda processing without keeping all items in memory.
    Designed for incremental updates during multi-region/multi-account processing.
    """

    # ---- Properties expected by other modules (e.g., index.py) ----
    # Provide attributes/properties so Pylance doesn't complain and we keep backward-compat.
    @property
    def s3_buckets(self) -> int:
        return self.resource_counts.get('S3Bucket', 0)

    @property
    def ebs_volumes(self) -> int:
        return self.resource_counts.get('EBSVolume', 0)

    @property
    def efs_filesystems(self) -> int:
        return self.resource_counts.get('EFSFileSystem', 0)

    @property
    def fsx_filesystems(self) -> int:
        return self.resource_counts.get('FSxFileSystem', 0)

    def __init__(self) -> None:
        """Initialize the metrics accumulator with empty counters."""
        self.reset()

    def reset(self) -> None:
        """Reset all counters for a new collection run."""
        # Global counters
        self.resource_counts: DefaultDict[str, int] = defaultdict(int)
        self.account_counts: DefaultDict[str, int] = defaultdict(int)
        self.region_counts: DefaultDict[str, int] = defaultdict(int)
        self.account_names: Dict[str, str] = {}  # account_id -> account_name mapping

        # Track collected regions
        self.regions_collected: set[str] = set()

        # EC2 specific counters
        self.ec2_states: DefaultDict[str, int] = defaultdict(int)
        self.ec2_health: DefaultDict[str, int] = defaultdict(int)
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
        self.rds_engines: DefaultDict[str, int] = defaultdict(int)
        self.rds_multiaz = 0
        self.rds_performance_insights = 0

        # S3 specific counters
        self.s3_total = 0
        self.s3_with_lifecycle = 0

        # Storage (novos recursos)
        self.efs_total = 0
        self.fsx_total = 0
        self.backup_plans = 0
        self.backup_vaults = 0
        self.backup_recovery_points = 0

        # Networking counters
        self.sg_total = 0
        self.sg_with_exposed_ports = 0
        self.vpc_total = 0
        self.subnet_total = 0

        # Cost optimization opportunities
        self.ebs_unattached = 0
        self.eip_unassociated = 0
        self.snapshots_orphaned = 0


    # -----------------------------
    # Adders
    # -----------------------------

    def add_collected_region(self, region: str) -> None:
        """Mark a region as collected."""
        if region:
            self.regions_collected.add(region)

    def add_resource(self, item: Dict[str, Any]) -> None:
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
        elif resource_type == 'EFSFileSystem':
            self.efs_total += 1
        elif resource_type == 'FSxFileSystem':
            self.fsx_total += 1
        elif resource_type == 'BackupPlan':
            self.backup_plans += 1
        elif resource_type == 'BackupVault':
            self.backup_vaults += 1
        elif resource_type == 'BackupRecoveryPoint':
            self.backup_recovery_points += 1

    # -----------------------------
    # Type-specific processors
    # -----------------------------

    def _get_resource_identifier(self, item: Dict[str, Any]) -> str:
        """Get a human-readable identifier for a resource."""
        resource_type = item.get('resourceType', '')

        if resource_type == 'EC2Instance':
            return item.get('instanceName') or item.get('instanceId', 'Unknown')
        if resource_type == 'S3Bucket':
            return item.get('bucketName', 'Unknown')
        if resource_type == 'RDSInstance':
            return item.get('dbInstanceId', 'Unknown')
        if resource_type == 'EBSVolume':
            return item.get('volumeName') or item.get('volumeId', 'Unknown')
        if resource_type == 'VPC':
            return item.get('vpcName') or item.get('vpcId', 'Unknown')
        if resource_type == 'SecurityGroup':
            return item.get('groupName', item.get('groupId', 'Unknown'))
        if resource_type == 'EFSFileSystem':
            return item.get('fileSystemId', 'Unknown')
        if resource_type == 'FSxFileSystem':
            return item.get('fileSystemId', 'Unknown')
        if resource_type.startswith('Backup'):
            return item.get('id', 'Unknown')
        # Generic fallback
        return item.get('id', 'Unknown')

    def _process_ec2_item(self, item: Dict[str, Any]) -> None:
        """Process EC2-specific metrics."""
        self.ec2_total += 1

        # State counting
        state = (item.get('instanceState') or 'unknown').lower()
        self.ec2_states[state] += 1

        if state == 'running':
            self.ec2_running += 1

            # CloudWatch Agent detection (only for running instances)
            has_memory = bool(item.get('cwAgentMemoryDetected', False))
            has_disk = bool(item.get('cwAgentDiskDetected', False))

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

    def _process_rds_item(self, item: Dict[str, Any]) -> None:
        """Process RDS-specific metrics."""
        self.rds_total += 1

        status = (item.get('status') or '').lower()
        if status == 'available':
            self.rds_available += 1

        engine = item.get('engine', 'unknown')
        self.rds_engines[engine] += 1

        if bool(item.get('multiAZ')):
            self.rds_multiaz += 1

        if bool(item.get('performanceInsightsEnabled')):
            self.rds_performance_insights += 1

    def _process_s3_item(self, item: Dict[str, Any]) -> None:
        """Process S3-specific metrics."""
        self.s3_total += 1
        if item.get('hasLifecycleRules'):
            self.s3_with_lifecycle += 1

    def _process_ebs_item(self, item: Dict[str, Any]) -> None:
        """Process EBS Volume metrics for cost optimization."""
        # Unattached logic robust to different shapes (None / [] / '[]' / json string)
        attached_instances = item.get('attachedInstances')
        try:
            if attached_instances is None:
                self.ebs_unattached += 1
                return
            if isinstance(attached_instances, str):
                if attached_instances.strip() in ('', '[]', 'null', 'None'):
                    self.ebs_unattached += 1
                    return
                attached_list = json.loads(attached_instances)
            else:
                attached_list = attached_instances
            if not attached_list:
                self.ebs_unattached += 1
        except Exception:
            # If parsing fails, do not crash the run
            pass

    def _process_eip_item(self, item: Dict[str, Any]) -> None:
        """Process Elastic IP metrics for cost optimization."""
        if not item.get('instanceId') and not item.get('networkInterfaceId'):
            self.eip_unassociated += 1

    def _process_sg_item(self, item: Dict[str, Any]) -> None:
        """Process Security Group metrics."""
        self.sg_total += 1
        if item.get('hasExposedIngressPorts'):
            self.sg_with_exposed_ports += 1

    def _process_snapshot_item(self, item: Dict[str, Any]) -> None:
        """Placeholder for snapshot heuristics (kept minimal)."""
        # Real orphan detection would need cross-referencing volumes/images
        return

    # -----------------------------
    # Output
    # -----------------------------

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get accumulated metrics formatted for DynamoDB storage.
        """
        total_resources = sum(self.resource_counts.values())

        # Format account distribution with names (Top 10)
        account_dist: List[Dict[str, Any]] = []
        for account_id, count in sorted(self.account_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            account_dist.append({
                'accountId': account_id,
                'accountName': self.account_names.get(account_id, account_id),
                'count': count
            })

        # Format region distribution (Top 10)
        region_dist: List[Dict[str, Any]] = [
            {'region': region, 'count': count}
            for region, count in sorted(self.region_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Global metrics
        global_metrics = {
            'totalResources': total_resources,
            'resourceCounts': dict(self.resource_counts),
            'accountDistribution': account_dist,
            'regionDistribution': region_dist,
            'regionsCollected': len(self.regions_collected),
            'resourceRegionsFound': len(self.region_counts),
        }

        # EC2 Health metrics
        ec2_metrics: Optional[Dict[str, Any]] = None
        if self.ec2_total > 0:
            ec2_metrics = {
                'total': self.ec2_total,
                'byState': dict(self.ec2_states),
                'healthStatus': dict(self.ec2_health),
                'cloudwatchAgent': {
                    'memoryMonitoring': self.ec2_cw_memory,
                    'diskMonitoring': self.ec2_cw_disk,
                    'bothEnabled': self.ec2_cw_both,
                    'noneEnabled': max(self.ec2_running - max(self.ec2_cw_memory, self.ec2_cw_disk), 0),
                    'percentageWithMemory': _safe_pct(self.ec2_cw_memory, self.ec2_running),
                    'percentageWithDisk': _safe_pct(self.ec2_cw_disk, self.ec2_running),
                },
                'ssmAgent': {
                    'connected': self.ec2_ssm_connected,
                    'notConnected': self.ec2_ssm_notconnected,
                    'notInstalled': self.ec2_ssm_notinstalled,
                    'percentageConnected': _safe_pct(self.ec2_ssm_connected, self.ec2_running),
                },
            }

        # RDS metrics
        rds_metrics: Optional[Dict[str, Any]] = None
        if self.rds_total > 0:
            rds_metrics = {
                'total': self.rds_total,
                'available': self.rds_available,
                'engines': dict(self.rds_engines),
                'multiAZ': self.rds_multiaz,
                'performanceInsights': self.rds_performance_insights,
                'percentageMultiAZ': _safe_pct(self.rds_multiaz, self.rds_total),
                'percentageWithPerfInsights': _safe_pct(self.rds_performance_insights, self.rds_total),
            }

        # Storage metrics (inclui EFS/FSx/Backup)
        storage_metrics: Dict[str, Any] = {
            's3Buckets': self.s3_total,
            's3WithLifecycle': self.s3_with_lifecycle,
            'ebsVolumes': self.resource_counts.get('EBSVolume', 0),
            'ebsSnapshots': self.resource_counts.get('EBSSnapshot', 0),
            'amiSnapshots': self.resource_counts.get('AMI', 0),
            'efsFileSystems': self.efs_total,
            'fsxFileSystems': self.fsx_total,
            'backupPlans': self.backup_plans,
            'backupVaults': self.backup_vaults,
            'backupRecoveryPoints': self.backup_recovery_points,
        }

        # Cost optimization opportunities
        cost_metrics = {
            'unattachedEBSVolumes': self.ebs_unattached,
            'unassociatedElasticIPs': self.eip_unassociated,
            'potentialMonthlySavings': self._estimate_savings(),
        }

        # Security metrics
        security_metrics = {
            'securityGroups': self.sg_total,
            'exposedSecurityGroups': self.sg_with_exposed_ports,
            'percentageExposed': _safe_pct(self.sg_with_exposed_ports, self.sg_total),
        }

        return {
            'global': global_metrics,
            'ec2': ec2_metrics,
            'rds': rds_metrics,
            'storage': storage_metrics,
            'cost': cost_metrics,
            'security': security_metrics,
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


# -----------------------------
# Flatten helper (renamed arg to avoid Pylance warning)
# -----------------------------

def flatten_metric(target: Dict[str, Any], data: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    """
    Flattens nested dictionaries/lists into target dict.
    Example:
      {"ssmAgent": {"connected": 97, "notConnected": 7}}
    Becomes:
      {"ssmAgent_connected": 97, "ssmAgent_notConnected": 7}
    Lists are expanded into numbered keys.
    """
    for k, v in (data or {}).items():
        new_key = f"{prefix}_{k}" if prefix else k
        if isinstance(v, dict):
            flatten_metric(target, v, new_key)
        elif isinstance(v, list):
            for i, elem in enumerate(v):
                indexed_key = f"{new_key}_{i}"
                if isinstance(elem, dict):
                    flatten_metric(target, elem, indexed_key)
                elif isinstance(elem, list):
                    # Handle nested lists recursively
                    flatten_metric(target, {str(i): elem}, new_key)
                else:
                    target[indexed_key] = elem
        else:
            target[new_key] = v
    return target


# -----------------------------
# Persistence
# -----------------------------

def save_metrics_to_dynamodb(metrics_tables: List, metrics: Dict, processing_duration: float) -> int:
    from collectors.base import batch_write_to_dynamodb, format_aws_datetime

    timestamp = datetime.now(timezone.utc)
    date_str = timestamp.strftime('%Y-%m-%d')
    iso_timestamp = format_aws_datetime(timestamp)

    items_to_save: List[Dict[str, Any]] = []

    # Global metrics item - current snapshot
    global_item_current: Dict[str, Any] = {
        'id': 'METRICS-GLOBAL-CURRENT',
        'resourceType': 'METRIC_SUMMARY',
        'accountId': 'GLOBAL',
        'accountName': 'Global Metrics',
        'region': 'global',
        'metricDate': date_str,
        'isMetric': True,
        'createdAt': iso_timestamp,
        'updatedAt': iso_timestamp,
        'processingDurationSeconds': round(float(processing_duration), 3),
    }
    global_item_current.update({
        'accountDistribution': metrics['global'].get('accountDistribution', []),
        'regionDistribution': metrics['global'].get('regionDistribution', []),
    })
    global_flat = flatten_metric({}, {
        'totalResources': metrics['global'].get('totalResources', 0),
        'resourceCounts': metrics['global'].get('resourceCounts', {}),
        'regionsCollected': metrics['global'].get('regionsCollected', 0),
        'resourceRegionsFound': metrics['global'].get('resourceRegionsFound', 0),
    })
    global_item_current.update(global_flat)
    items_to_save.append(global_item_current)

    # Historical global metrics (for trend analysis)
    global_item_historical = {
        **global_item_current,
        'id': f'METRICS-GLOBAL-{date_str}'
    }
    items_to_save.append(global_item_historical)

    # EC2 Health metrics
    if metrics.get('ec2'):
        ec2_item_current: Dict[str, Any] = {
            'id': 'METRICS-EC2-CURRENT',
            'resourceType': 'METRIC_EC2_HEALTH',
            'accountId': 'GLOBAL',
            'accountName': 'EC2 Health Metrics',
            'region': 'global',
            'metricDate': date_str,
            'isMetric': True,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp,
            'processingDurationSeconds': round(float(processing_duration), 3),
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
        rds_item_current: Dict[str, Any] = {
            'id': 'METRICS-RDS-CURRENT',
            'resourceType': 'METRIC_RDS',
            'accountId': 'GLOBAL',
            'accountName': 'RDS Metrics',
            'region': 'global',
            'metricDate': date_str,
            'isMetric': True,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp,
            'processingDurationSeconds': round(float(processing_duration), 3),
        }
        rds_item_current = flatten_metric(rds_item_current, metrics['rds'])
        items_to_save.append(rds_item_current)

    # Storage metrics (inclui S3/EBS/EFS/FSx/Backup)
    if metrics.get('storage'):
        storage_item_current: Dict[str, Any] = {
            'id': 'METRICS-STORAGE-CURRENT',
            'resourceType': 'METRIC_STORAGE',
            'accountId': 'GLOBAL',
            'accountName': 'Storage Metrics',
            'region': 'global',
            'metricDate': date_str,
            'isMetric': True,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp,
            'processingDurationSeconds': round(float(processing_duration), 3),
        }
        storage_item_current = flatten_metric(storage_item_current, metrics['storage'])
        items_to_save.append(storage_item_current)

    # Cost optimization metrics
    if metrics.get('cost'):
        cost_item_current: Dict[str, Any] = {
            'id': 'METRICS-COST-CURRENT',
            'resourceType': 'METRIC_COST',
            'accountId': 'GLOBAL',
            'accountName': 'Cost Optimization',
            'region': 'global',
            'metricDate': date_str,
            'isMetric': True,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp,
            'processingDurationSeconds': round(float(processing_duration), 3),
        }
        cost_item_current = flatten_metric(cost_item_current, metrics['cost'])
        items_to_save.append(cost_item_current)

    # Security metrics
    if metrics.get('security'):
        security_item_current: Dict[str, Any] = {
            'id': 'METRICS-SECURITY-CURRENT',
            'resourceType': 'METRIC_SECURITY',
            'accountId': 'GLOBAL',
            'accountName': 'Security Metrics',
            'region': 'global',
            'metricDate': date_str,
            'isMetric': True,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp,
            'processingDurationSeconds': round(float(processing_duration), 3),
        }
        security_item_current = flatten_metric(security_item_current, metrics['security'])
        items_to_save.append(security_item_current)

    # Save to all configured metrics tables
    total_saved = 0
    for table in metrics_tables:
        try:
            count = batch_write_to_dynamodb([table], items_to_save)
            total_saved = count  # Track based on primary metrics table
            logger.info(
                "Successfully saved %s metric items to metrics table %s",
                len(items_to_save), getattr(table, 'name', 'unknown')
            )
        except Exception:
            logger.exception(
                "Error saving metrics to metrics table %s",
                getattr(table, 'name', 'unknown')
            )

    return total_saved