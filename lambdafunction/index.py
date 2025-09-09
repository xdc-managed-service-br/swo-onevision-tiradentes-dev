# index.py
import boto3
import os
import json
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.config import Config
from botocore.exceptions import ClientError

# Import from collectors module
from collectors.base import (
    get_dynamodb_table, 
    get_all_organization_accounts, 
    batch_write_to_dynamodb,
    get_available_regions,
    BOTO3_CONFIG,
    MAX_WORKERS,
    DEFAULT_REGIONS
)
from collectors.ec2_collector import EC2Collector
from collectors.rds_collector import RDSCollector
from collectors.s3_collector import S3Collector
from collectors.networking_collector import NetworkingCollector

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def process_region(account_id, account_name, region, credentials, tables):
    """Processes a single region for an account, running all regional collectors."""
    start_time = datetime.now(timezone.utc)
    logger.info(f"Processing region {region} for account {account_id} ({account_name})")
    region_total_items_saved = 0
    
    # List of regional collector classes to run
    regional_collectors = [EC2Collector, RDSCollector, NetworkingCollector]  # Add other regional collectors here

    all_collected_items = []  # Accumulate items from all collectors in this region

    for collector_class in regional_collectors:
        collector_name = collector_class.__name__
        try:
            logger.info(f"Running collector {collector_name} in region {region}...")
            # Instantiate collector for this specific region/account/creds
            collector_instance = collector_class(account_id, account_name, region, credentials, tables)
            # Collect returns the list of items added by this collector instance
            collected_items = collector_instance.collect()
            
            if collected_items:
                logger.debug(f"{collector_name} collected {len(collected_items)} items in region {region}.")
                all_collected_items.extend(collected_items)
            else:
                logger.info(f"No resources found by {collector_name} in region {region}")

        except NotImplementedError:
            logger.error(f"Collector {collector_name} does not implement collect(). Skipping.")
        except Exception as e:
            logger.error(f"Error in collector {collector_name} for region {region}: {str(e)}", exc_info=True)

    # Save all items collected from this region after all collectors have run
    if all_collected_items:
        try:
            logger.info(f"Attempting to save {len(all_collected_items)} items collected from region {region}...")
            # Need a ResourceCollector instance to call save, let's reuse the last one
            if 'collector_instance' in locals() and collector_instance:
                # Temporarily assign all collected items to the instance for saving
                collector_instance.items = all_collected_items
                region_total_items_saved = collector_instance.save()
            else:
                logger.error(f"Cannot save items for region {region}: No valid collector instance available.")

        except Exception as e:
            logger.error(f"Error saving collected items for region {region}: {str(e)}", exc_info=True)

    total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
    logger.info(f"Region {region} processed in {total_time:.2f}s. Saved approx {region_total_items_saved} resources.")
    return region_total_items_saved


def process_account(account_id, account_name, tables):
    """Processes a single account: assumes role, collects S3, processes regions concurrently."""
    account_start_time = datetime.now(timezone.utc)
    logger.info(f"=== Starting collection for account {account_name} ({account_id}) ===")
    total_items_saved_for_account = 0
    
    try:
        # 1. Assume Role
        logger.info(f"Assuming role 'OneVisionDataCollectorRole' in account {account_id}...")
        sts = boto3.client('sts', config=BOTO3_CONFIG)
        
        try:
            assumed_role = sts.assume_role(
                RoleArn=f'arn:aws:iam::{account_id}:role/OneVisionDataCollectorRole',
                RoleSessionName='OneVisionResourceCollector',
                DurationSeconds=3600  # 1 hour session
            )
            credentials = assumed_role['Credentials']
            logger.info(f"Successfully assumed role in account {account_id}.")
        except ClientError as e:
            logger.error(f"Failed to assume role in account {account_id}: {str(e)}. Skipping account.")
            return 0
        except Exception as e:
            logger.error(f"Unexpected error assuming role in account {account_id}: {str(e)}. Skipping account.", exc_info=True)
            return 0

        # 2. Collect S3 Buckets (Global Resource)
        s3_items_saved = 0
        logger.info(f"Collecting S3 buckets for account {account_name}...")
        
        try:
            s3_collector = S3Collector(account_id, account_name, credentials, tables)
            s3_collected_items = s3_collector.collect()
            
            if s3_collected_items:
                s3_items_saved = s3_collector.save()
                total_items_saved_for_account += s3_items_saved
                logger.info(f"Collected and saved {s3_items_saved} S3 buckets for account {account_name}.")
            else:
                logger.info(f"No S3 buckets found or saved for account {account_name}.")
        except Exception as e:
            logger.error(f"Error during S3 collection for account {account_id}: {str(e)}", exc_info=True)

        # 3. Get Available Regions for this Account
        regions = get_available_regions(credentials)
        if not regions or regions == DEFAULT_REGIONS:
            logger.warning(f"Using default or potentially limited region list for account {account_id}.")
        sorted_regions = sorted(regions)

        # 4. Process Regions Concurrently
        logger.info(f"Processing {len(sorted_regions)} regions for account {account_name} using up to {MAX_WORKERS} workers...")
        region_results = {}
        
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_region = {
                executor.submit(process_region, account_id, account_name, region, credentials, tables): region
                for region in sorted_regions
            }
            
            for future in as_completed(future_to_region):
                region = future_to_region[future]
                try:
                    region_items_saved_count = future.result()
                    region_results[region] = region_items_saved_count
                    total_items_saved_for_account += region_items_saved_count
                    
                    if region_items_saved_count > 0:
                        logger.info(f"Completed region {region} for account {account_name}, saved {region_items_saved_count} regional resources.")
                    else:
                        logger.debug(f"Completed region {region} for account {account_name}, no regional resources saved.")
                except Exception as e:
                    logger.error(f"Error processing region {region} future for account {account_id}: {str(e)}", exc_info=True)
                    region_results[region] = 'Error'

        # 5. Log Summary for the Account
        account_duration = (datetime.now(timezone.utc) - account_start_time).total_seconds()
        logger.info(f"--- Account {account_name} ({account_id}) processing summary ---")
        successful_regions = sum(1 for count in region_results.values() if isinstance(count, int))
        error_regions = len(region_results) - successful_regions
        logger.info(f"Successfully processed {successful_regions}/{len(sorted_regions)} regions.")
        
        if error_regions > 0:
            logger.warning(f"{error_regions} regions encountered errors.")
        
        # Log details of regions and counts
        for region, count in sorted(region_results.items()):
            logger.debug(f"  - Region {region}: {count} items saved")

        logger.info(f"Total resources saved for account {account_name}: {total_items_saved_for_account}")
        logger.info(f"Account processing time: {account_duration:.2f} seconds")
        logger.info(f"=== Finished collection for account {account_name} ({account_id}) ===")

        return total_items_saved_for_account

    except Exception as e:
        logger.error(f"Critical error processing account {account_id}: {str(e)}", exc_info=True)
        account_duration = (datetime.now(timezone.utc) - account_start_time).total_seconds()
        logger.info(f"Account {account_name} processing aborted after {account_duration:.2f} seconds due to error.")
        return 0


def lambda_handler(event, context):
    """Main Lambda handler function."""
    overall_start_time = datetime.now(timezone.utc)
    logger.info(f"Lambda execution started at {overall_start_time.isoformat()}")
    logger.info(f"Log stream name: {context.log_stream_name}")
    logger.info(f"Remaining time (ms): {context.get_remaining_time_in_millis()}")

    # 1. Get Accounts
    try:
        accounts = get_all_organization_accounts()
        if not accounts:
            logger.warning("No active accounts found in AWS Organizations. Exiting.")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No active accounts found.'})
            }
        logger.info(f"Found {len(accounts)} accounts to process.")
    except Exception as e:
        logger.error(f"Failed to retrieve accounts from AWS Organizations: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Failed to retrieve accounts',
                'error': str(e)
            })
        }

    # 2. Configure DynamoDB Tables
    try:
        primary_table_name = os.environ.get('PROD_TABLE_NAME')
        secondary_table_name = os.environ.get('DEV_TABLE_NAME')
        
        if not primary_table_name:
            raise ValueError("PROD_TABLE_NAME env var not set.")
        if not secondary_table_name:
            raise ValueError("DEV_TABLE_NAME env var not set.")

        primary_table = get_dynamodb_table(primary_table_name)
        secondary_table = get_dynamodb_table(secondary_table_name)
        
        if not primary_table or not secondary_table:
            raise ConnectionError("Failed to init DynamoDB tables.")

        tables_to_write = [primary_table, secondary_table]
        logger.info(f"DynamoDB tables configured for writing: {primary_table_name}, {secondary_table_name}")
    except (ValueError, ConnectionError, Exception) as e:
        logger.error(f"DynamoDB configuration error: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'DynamoDB configuration error',
                'error': str(e)
            })
        }

    # 3. Process Accounts in Parallel
    logger.info("Starting resource collection process for accounts in parallel...")
    total_resources_collected_across_accounts = 0
    accounts_processed_count = 0
    accounts_with_errors = []
    sorted_accounts = sorted(accounts, key=lambda x: x[1])  # Sort by name

    # Define optimal max workers based on testing
    max_account_workers = 5  # Adjust based on performance testing
    
    account_results = {}
    
    with ThreadPoolExecutor(max_workers=max_account_workers) as executor:
        future_to_account = {
            executor.submit(process_account, account_id, account_name, tables_to_write): (account_id, account_name)
            for account_id, account_name in sorted_accounts
        }
        
        for future in as_completed(future_to_account):
            account_id, account_name = future_to_account[future]
            
            # Check remaining time before processing next future result
            remaining_time_ms = context.get_remaining_time_in_millis()
            if remaining_time_ms < 15000:  # 15 seconds remaining
                logger.warning(f"Approaching Lambda timeout ({remaining_time_ms / 1000:.1f}s). "
                              f"Stopping future result processing, will report partial results.")
                break
                
            try:
                account_resources_saved = future.result()
                account_results[(account_id, account_name)] = account_resources_saved
                total_resources_collected_across_accounts += account_resources_saved
                accounts_processed_count += 1
                logger.info(f"Processed account {account_name} with {account_resources_saved} resources")
            except Exception as e:
                logger.error(f"Unhandled error from process_account for {account_name}: {str(e)}", exc_info=True)
                accounts_with_errors.append(f"{account_name} ({account_id})")
                account_results[(account_id, account_name)] = 'Error'

    # 4. Final Summary and Return
    overall_end_time = datetime.now(timezone.utc)
    overall_duration = (overall_end_time - overall_start_time).total_seconds()

    processed_ratio = f"{accounts_processed_count}/{len(accounts)}"
    summary_message = f"Collection finished in {overall_duration:.2f}s. Processed {processed_ratio} accounts."
    
    if accounts_processed_count < len(accounts):
        summary_message += " Stopped early due to time limits."

    logger.info(summary_message)
    logger.info(f"Total resources saved across processed accounts: {total_resources_collected_across_accounts}")
    
    if accounts_with_errors:
        logger.warning(f"Critical errors occurred processing accounts: {', '.join(accounts_with_errors)}")

    # Return success, indicating completed (or partially completed) run
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': summary_message,
            'totalResourcesSaved': total_resources_collected_across_accounts,
            'accountsProcessedCount': accounts_processed_count,
            'totalAccountsInOrg': len(accounts),
            'accountsWithCriticalErrors': accounts_with_errors,
            'executionTimeSeconds': round(overall_duration, 2),
            'startTime': overall_start_time.isoformat(),
            'endTime': overall_end_time.isoformat()
        })
    }