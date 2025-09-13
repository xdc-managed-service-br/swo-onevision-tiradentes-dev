import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.exceptions import ClientError
from .base import ResourceCollector, format_aws_datetime, batch_write_to_dynamodb, MAX_WORKERS
from datetime import datetime, timedelta

logger = logging.getLogger()

def bytes_to_human_readable(size_bytes):
    """Convert bytes to a human-readable format (e.g., KB, MB, GB, TB)."""
    if size_bytes == 0:
        return "0 B"
    units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    unit_index = 0
    size = float(size_bytes)
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    return f"{size:.2f} {units[unit_index]}"

class S3Collector(ResourceCollector):
    """Collects S3 bucket information from all regions."""
    
    def __init__(self, account_id, account_name, credentials, tables):
        """Initialize S3Collector with 'global' as the conceptual region."""
        # Use 'global' as a placeholder region for the collector itself
        super().__init__(account_id, account_name, 'global', credentials, tables)
        logger.info(f"Initializing S3Collector for account {self.account_id}")

    def collect(self):
        """Collect all S3 buckets for the account."""
        logger.info(f"Starting S3 bucket collection for account {self.account_id}")
        collected_count = 0
        
        try:
            # Use us-east-1 client for list_buckets (global endpoint)
            s3_global_client = self.get_client('s3', region='us-east-1')
            
            try:
                response = s3_global_client.list_buckets()
            except ClientError as e:
                logger.error(f"Failed to list buckets for account {self.account_id}: {e}", exc_info=True)
                return []
            except Exception as e:
                logger.error(f"Unexpected error listing buckets for account {self.account_id}: {e}", exc_info=True)
                return []

            buckets = response.get('Buckets', [])
            if not buckets:
                logger.info(f"No S3 buckets found for account {self.account_id}")
                return []

            logger.info(f"Found {len(buckets)} S3 buckets. Fetching details concurrently...")

            # Use a thread pool to process buckets concurrently
            s3_workers = min(MAX_WORKERS, 10)  # Limit S3 workers
            with ThreadPoolExecutor(max_workers=s3_workers) as executor:
                # Map future back to bucket info for logging on error
                future_to_bucket = {
                    executor.submit(self._process_bucket, s3_global_client, bucket): bucket
                    for bucket in buckets
                }
                
                for future in as_completed(future_to_bucket):
                    bucket_info = future_to_bucket[future]
                    bucket_name_for_log = bucket_info.get('Name', 'Unknown Bucket')
                    
                    try:
                        # _process_bucket now calls add_item itself
                        processed = future.result()  # Result indicates success (True) or failure (False/None)
                        if processed:
                            collected_count += 1
                    except Exception as e:
                        logger.error(f"Error processing S3 bucket '{bucket_name_for_log}': {str(e)}", exc_info=True)

            logger.info(f"Finished S3 collection for account {self.account_id}. Processed details for {collected_count} buckets and added to item list.")
            return self.items
        except Exception as e:
            logger.error(f"General error during S3 collection for account {self.account_id}: {str(e)}", exc_info=True)
            return []

    def _get_bucket_size(self, bucket_name, bucket_region):
        """Get the bucket size in bytes from CloudWatch metrics."""
        try:
            cloudwatch_client = self.get_client('cloudwatch', region=bucket_region)
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=2)
            response = cloudwatch_client.get_metric_statistics(
                Namespace='AWS/S3',
                MetricName='BucketSizeBytes',
                Dimensions=[
                    {'Name': 'BucketName', 'Value': bucket_name},
                    {'Name': 'StorageType', 'Value': 'StandardStorage'}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=['Average']
            )
            datapoints = response.get('Datapoints', [])
            if not datapoints:
                return 0
            # Return the Average of the most recent datapoint
            most_recent = max(datapoints, key=lambda x: x['Timestamp'])
            return int(most_recent.get('Average', 0))
        except Exception as e:
            logger.warning(f"Failed to get bucket size for {bucket_name} in region {bucket_region}: {e}")
            return 0

    def _get_bucket_object_count(self, bucket_name, bucket_region):
        """Get the number of objects in the bucket from CloudWatch metrics."""
        try:
            cloudwatch_client = self.get_client('cloudwatch', region=bucket_region)
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=2)
            response = cloudwatch_client.get_metric_statistics(
                Namespace='AWS/S3',
                MetricName='NumberOfObjects',
                Dimensions=[
                    {'Name': 'BucketName', 'Value': bucket_name},
                    {'Name': 'StorageType', 'Value': 'AllStorageTypes'}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=['Average']
            )
            datapoints = response.get('Datapoints', [])
            if not datapoints:
                return 0
            most_recent = max(datapoints, key=lambda x: x['Timestamp'])
            return int(most_recent.get('Average', 0))
        except Exception as e:
            logger.warning(f"Failed to get object count for {bucket_name} in region {bucket_region}: {e}")
            return 0

    def _process_bucket(self, s3_global_client, bucket):
        """Fetch details for a single S3 bucket and add it using self.add_item."""
        bucket_name = bucket['Name']
        creation_date = bucket.get('CreationDate')
        formatted_creation_date = format_aws_datetime(creation_date) if creation_date else None

        # 1. Determine Bucket Region
        bucket_region = 'us-east-1'  # Default
        try:
            location = s3_global_client.get_bucket_location(Bucket=bucket_name)
            region_constraint = location.get('LocationConstraint')
            # Note: A LocationConstraint of None or 'us-east-1' means us-east-1
            # A LocationConstraint of 'EU' means 'eu-west-1' (legacy)
            if region_constraint:
                bucket_region = region_constraint
                if bucket_region == 'EU':
                    bucket_region = 'eu-west-1'
            logger.debug(f"Region for bucket {bucket_name}: {bucket_region}")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code == 'NoSuchBucket':
                logger.warning(f"Bucket {bucket_name} not found or access denied during location check (Code: {error_code}). Skipping.")
                return False
            elif error_code == 'AccessDenied':
                logger.warning(f"Access denied getting location for bucket {bucket_name}. Assuming us-east-1.")
            else:
                logger.warning(f"ClientError determining region for bucket {bucket_name}: {e}. Assuming us-east-1.")
        except Exception as e:
            logger.warning(f"Unexpected error determining region for {bucket_name}: {e}. Assuming us-east-1.")

        # Create region-specific client if needed
        try:
            bucket_s3_client = s3_global_client if bucket_region == 'us-east-1' else self.get_client('s3', region=bucket_region)
        except Exception as e:
            logger.error(f"Failed to get S3 client for determined region {bucket_region} for bucket {bucket_name}: {e}. Skipping bucket.")
            return False

        # 2. Get Bucket Lifecycle Rules
        has_lifecycle_rules = False
        try:
            lifecycle = bucket_s3_client.get_bucket_lifecycle_configuration(Bucket=bucket_name)
            has_lifecycle_rules = bool(lifecycle.get('Rules'))
            logger.debug(f"Lifecycle rules found for bucket {bucket_name}: {has_lifecycle_rules}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchLifecycleConfiguration':
                logger.debug(f"No lifecycle configuration found for bucket {bucket_name}.")
                has_lifecycle_rules = False
            else:
                logger.warning(f"ClientError getting lifecycle config for bucket {bucket_name}: {e}")
        except Exception as e:
            logger.warning(f"Unexpected error getting lifecycle for bucket {bucket_name}: {e}")

        # 3. Get Bucket Tagging
        tags = []
        try:
            tagging = bucket_s3_client.get_bucket_tagging(Bucket=bucket_name)
            tags = tagging.get('TagSet', [])
            logger.debug(f"Tags found for bucket {bucket_name}: {len(tags)}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchTaggingConfiguration':
                logger.debug(f"No tags found for bucket {bucket_name}.")
                tags = []
            elif e.response['Error']['Code'] == 'NoSuchBucket':
                logger.warning(f"Bucket {bucket_name} not found or access denied during tagging check. Skipping.")
                return False
            else:
                logger.warning(f"ClientError getting tags for bucket {bucket_name}: {e}")
        except Exception as e:
            logger.warning(f"Unexpected error getting tags for bucket {bucket_name}: {e}")

        tags_json = json.dumps(tags) if tags else '[]'
        bucket_name_tag = 'N/A'
        for tag in tags:
            if tag.get('Key') == 'Name':
                bucket_name_tag = tag.get('Value', 'N/A')
                break

        # Get bucket size from CloudWatch and convert to human-readable format
        bucket_size = self._get_bucket_size(bucket_name, bucket_region)
        bucket_size_readable = bytes_to_human_readable(bucket_size)

        # Get bucket object count from CloudWatch
        object_count = self._get_bucket_object_count(bucket_name, bucket_region)

        # 4. Add item using the base class method
        try:
            self.add_item('S3Bucket', bucket_name, {
                'bucketName': bucket_name,
                'bucketNameTag': bucket_name_tag,
                'region': bucket_region,  # Explicitly set the determined region
                'createdAt': formatted_creation_date,
                'hasLifecycleRules': has_lifecycle_rules,
                'tags': tags_json,
                'storageBytes': bucket_size_readable,
                'objectCount': object_count
            })
            return True
        except Exception as e:
            logger.error(f"Error calling add_item for bucket {bucket_name}: {e}", exc_info=True)
            return False

    def save(self):
        """Save all collected S3 bucket items to DynamoDB tables."""
        if not self.items:
            logger.info(f"No S3 bucket items to save for account {self.account_id}")
            return 0
        
        if not self.tables:
            logger.error(f"No DynamoDB tables configured for saving S3 items.")
            return 0

        items_to_save = self.items
        self.items = []
        
        try:
            count = batch_write_to_dynamodb(self.tables, items_to_save)
            if count > 0:
                logger.info(f"Saved {count} S3 bucket items for account {self.account_id} to DynamoDB.")
            return count
        except Exception as e:
            logger.error(f"Failed to save S3 bucket items for account {self.account_id}: {e}", exc_info=True)
            return 0