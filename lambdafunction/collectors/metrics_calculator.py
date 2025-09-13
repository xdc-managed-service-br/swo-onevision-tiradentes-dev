# lambdafunction/collectors/metrics_calculator.py
import json
import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Any

logger = logging.getLogger()

class MetricsAccumulator:
    """Accumulates metrics during processing without keeping all items in memory."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """Reset all counters for a new collection run."""
        self.resource_counts = defaultdict(int)
        self.account_counts = defaultdict(int)
        self.region_counts = defaultdict(int)
        
        # EC2 specific counters
        self.ec2_states = defaultdict(int)
        self.ec2_health = defaultdict(int)
        self.ec2_cw_memory = 0
        self.ec2_cw_disk = 0
        self.ec2_ssm_connected = 0
        self.ec2_total = 0
        self.ec2_running = 0
        
        # Track top accounts/regions
        self.account_names = {}  # account_id -> account_name mapping
        
    def add_resource(self, item: Dict[str, Any]):
        """Add a single resource to the accumulator."""
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
        
        # Count by region
        region = item.get('region')
        if region and region != 'global':
            self.region_counts[region] += 1
        
        # Process EC2 specific metrics
        if resource_type == 'EC2Instance':
            self._process_ec2_item(item)
    
    def _process_ec2_item(self, item: Dict):
        """Process EC2-specific metrics."""
        self.ec2_total += 1
        
        # State
        state = item.get('instanceState', 'unknown').lower()
        self.ec2_states[state] += 1
        if state == 'running':
            self.ec2_running += 1
        
        # Health
        health_status = item.get('healthStatus', 'Unknown')
        self.ec2_health[health_status] += 1
        
        # CloudWatch Agent (only for running instances)
        if state == 'running':
            if item.get('cwAgentMemoryDetected'):
                self.ec2_cw_memory += 1
            if item.get('cwAgentDiskDetected'):
                self.ec2_cw_disk += 1
            
            # SSM
            ssm_status = item.get('ssmStatus', '').lower()
            if ssm_status in ['connected', 'online']:
                self.ec2_ssm_connected += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get accumulated metrics formatted for DynamoDB."""
        total_resources = sum(self.resource_counts.values())
        
        # Format account distribution with names
        account_dist = []
        for account_id, count in sorted(
            self.account_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]:  # Top 10
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
            )[:10]  # Top 10
        ]
        
        # Global metrics
        global_metrics = {
            'totalResources': total_resources,
            'resourceCounts': dict(self.resource_counts),
            'accountDistribution': account_dist,
            'regionDistribution': region_dist
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
                    'percentageWithMemory': round((self.ec2_cw_memory / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1),
                    'percentageWithDisk': round((self.ec2_cw_disk / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1)
                },
                'ssmAgent': {
                    'connected': self.ec2_ssm_connected,
                    'percentageConnected': round((self.ec2_ssm_connected / self.ec2_running * 100) if self.ec2_running > 0 else 0, 1)
                }
            }
        
        return {
            'global': global_metrics,
            'ec2': ec2_metrics
        }

def save_metrics_to_dynamodb(tables, metrics: Dict, processing_duration: float):
    """Save calculated metrics as DynamoDB items."""
    from collectors.base import batch_write_to_dynamodb, format_aws_datetime
    
    timestamp = datetime.now(timezone.utc)
    date_str = timestamp.strftime('%Y-%m-%d')
    iso_timestamp = format_aws_datetime(timestamp)
    
    items_to_save = []
    
    # Global metrics item - both current and historical
    global_item_current = {
        'id': f'METRICS-GLOBAL-CURRENT',
        'resourceType': 'METRIC_SUMMARY',
        'accountId': 'GLOBAL',
        'accountName': 'Global Metrics',
        'region': 'global',
        'metricType': 'GLOBAL_SUMMARY',
        'metricDate': date_str,
        'metricData': json.dumps(metrics['global']),
        'isMetric': True,
        'collectionDuration': processing_duration,
        'resourcesProcessed': metrics['global']['totalResources'],
        'lastUpdated': iso_timestamp,
        'createdAt': iso_timestamp,
        'updatedAt': iso_timestamp
    }
    items_to_save.append(global_item_current)
    
    # Historical global metrics
    global_item_historical = {
        **global_item_current,
        'id': f'METRICS-GLOBAL-{date_str}'
    }
    items_to_save.append(global_item_historical)
    
    # EC2 metrics if available
    if metrics.get('ec2'):
        ec2_item_current = {
            'id': f'METRICS-EC2-CURRENT',
            'resourceType': 'METRIC_EC2_HEALTH',
            'accountId': 'GLOBAL',
            'accountName': 'EC2 Health Metrics',
            'region': 'global',
            'metricType': 'EC2_HEALTH',
            'metricDate': date_str,
            'metricData': json.dumps(metrics['ec2']),
            'isMetric': True,
            'lastUpdated': iso_timestamp,
            'createdAt': iso_timestamp,
            'updatedAt': iso_timestamp
        }
        items_to_save.append(ec2_item_current)
        
        # Historical EC2 metrics
        ec2_item_historical = {
            **ec2_item_current,
            'id': f'METRICS-EC2-{date_str}'
        }
        items_to_save.append(ec2_item_historical)
    
    # Save to all tables
    total_saved = 0
    for table in tables:
        try:
            count = batch_write_to_dynamodb([table], items_to_save)
            total_saved = count  # Track based on primary table
            logger.info(f"Saved {len(items_to_save)} metric items to table {table.name}")
        except Exception as e:
            logger.error(f"Error saving metrics to table: {e}", exc_info=True)
    
    return total_saved