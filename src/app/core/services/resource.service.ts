// src/app/core/services/resource.service.ts

import { Injectable } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  private resourcesCache = new Map<string, any[]>();
  private resourcesLoading = new BehaviorSubject<boolean>(false);
  
  // Expose loading state as an observable
  public loading$ = this.resourcesLoading.asObservable();
  
  constructor() { }
  
  /**
   * Get all resources from the database with proper pagination
   * IMPORTANT: Now filters out metric items to avoid mixing with resources
   */
  getAllResources(): Observable<any[]> {
    this.resourcesLoading.next(true);
    
    // Check if we have a cached result
    if (this.resourcesCache.has('all')) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get('all') || []);
    }
    
    return from(this.loadAllResourcesWithPagination()).pipe(
      tap(resources => {
        // Cache the result
        this.resourcesCache.set('all', resources);
        this.resourcesLoading.next(false);
      }),
      catchError(error => {
        console.error('Error fetching all resources:', error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1) // Share the result with all subscribers
    );
  }
  
  /**
   * Load all resources with pagination to handle large datasets
   * IMPORTANT: Filters out metric items (isMetric !== true)
   */
  private async loadAllResourcesWithPagination(): Promise<any[]> {
    let allResources: any[] = [];
    let nextToken: string | null | undefined = null;
    
    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } = await client.models.AWSResource.list({
          // CRITICAL: Filter out metric items to avoid mixing with resources
          filter: {
            or: [
              { isMetric: { eq: false } },
              { isMetric: { attributeExists: false } }
            ]
          },
          limit: 1000, // Maximum allowed limit per request
          nextToken: nextToken
        });
        
        // Additional safety check: filter out any metric items that might slip through
        const filteredData = response.data.filter(item => {
          // Exclude items that are metrics
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        
        // Process each resource to fix any issues
        const processedData = filteredData.map(item => this.processResourceData(item));
        
        allResources = [...allResources, ...processedData];
        nextToken = response.nextToken;
        
        console.log(`Loaded batch of ${processedData.length} resources. Total: ${allResources.length}`);
      } catch (error) {
        console.error('Error in pagination batch:', error);
        break; // Exit the loop on error
      }
    } while (nextToken);
    
    console.log(`Total resources loaded (excluding metrics): ${allResources.length}`);
    return allResources;
  }
  
  /**
   * Process resource data to fix common issues
   * @param resource The resource data to process
   * @returns The processed resource data
   */
  private processResourceData(resource: any): any {
    // Create a clone to avoid modifying the original
    const processed = { ...resource };
    
    // Check if the launchTime should be fixed
    // This happens when the data in DynamoDB doesn't match what's in the resource
    if (processed.resourceType === 'EC2Instance') {
      // If launchTime is null but exists elsewhere (like in additional fields), try to use that
      if (processed.launchTime === null) {
        // Check if we have a lastUpdated field we can use as a fallback
        if (processed.lastUpdated) {
          processed.launchTime = processed.lastUpdated;
          console.log(`Fixed null launchTime for instance ${processed.instanceId} using lastUpdated`);
        } else if (processed.createdAt) {
          processed.launchTime = processed.createdAt;
          console.log(`Fixed null launchTime for instance ${processed.instanceId} using createdAt`);
        }
      }
    }
    
    return processed;
  }
  
  /**
   * Get resources by specific type with proper pagination
   * IMPORTANT: Filters out metric items
   */
  getResourcesByType(resourceType: string): Observable<any[]> {
    console.log(`Attempting to load resources of type: ${resourceType}`);
    
    // Prevent loading metric types as resources
    if (resourceType.startsWith('METRIC')) {
      console.warn(`Attempted to load metric type ${resourceType} as resource. Returning empty.`);
      return of([]);
    }
    
    this.resourcesLoading.next(true);
    
    // Check if we have a cached result
    const cacheKey = `type:${resourceType}`;
    if (this.resourcesCache.has(cacheKey)) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get(cacheKey) || []);
    }
    
    return from(this.loadResourcesByTypeWithPagination(resourceType)).pipe(
      tap(resources => {
        // Cache the result
        this.resourcesCache.set(cacheKey, resources);
        this.resourcesLoading.next(false);
        console.log(`${resourceType} resources loaded:`, resources.length);
      }),
      catchError(error => {
        console.error(`Error fetching ${resourceType} resources:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1) // Share the result with all subscribers
    );
  }
  
  /**
   * Load resources by type with pagination
   * IMPORTANT: Filters out metric items
   */
  private async loadResourcesByTypeWithPagination(resourceType: string): Promise<any[]> {
    let resources: any[] = [];
    let nextToken: string | null | undefined = null;
    
    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } = await client.models.AWSResource.list({
          filter: {
            and: [
              { resourceType: { eq: resourceType } },
              { or: [
                { isMetric: { eq: false } },
                { isMetric: { attributeExists: false } }
              ]}
            ]
          },
          limit: 1000, // Maximum allowed limit per request
          nextToken: nextToken
        });
        
        // Additional safety check
        const filteredData = response.data.filter(item => {
          if (item.isMetric === true) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        
        // Process each resource to fix any issues
        const processedData = filteredData.map(item => this.processResourceData(item));
        
        resources = [...resources, ...processedData];
        nextToken = response.nextToken;
        
        console.log(`Loaded batch of ${processedData.length} ${resourceType} resources. Total: ${resources.length}`);
      } catch (error) {
        console.error(`Error in ${resourceType} pagination batch:`, error);
        break; // Exit the loop on error
      }
    } while (nextToken);
    
    return resources;
  }
  
  /**
   * Get resources by region
   * IMPORTANT: Filters out metric items
   */
  getResourcesByRegion(region: string): Observable<any[]> {
    this.resourcesLoading.next(true);
    
    // Check if we have all resources cached
    if (this.resourcesCache.has('all')) {
      const filteredResources = (this.resourcesCache.get('all') || []).filter(r => r.region === region);
      this.resourcesLoading.next(false);
      return of(filteredResources);
    }
    
    // Otherwise fetch from API
    return from(client.models.AWSResource.list({
      filter: {
        and: [
          { region: { eq: region } },
          { or: [
            { isMetric: { eq: false } },
            { isMetric: { attributeExists: false } }
          ]}
        ]
      },
      limit: 1000
    })).pipe(
      map(response => {
        // Additional safety check
        const filteredData = response.data.filter(item => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        
        // Process each resource to fix any issues
        return filteredData.map(item => this.processResourceData(item));
      }),
      tap(resources => {
        // Cache the result
        this.resourcesCache.set(`region:${region}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError(error => {
        console.error(`Error fetching resources in region ${region}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }
  
  /**
   * Get resources by account ID
   * IMPORTANT: Filters out metric items
   */
  getResourcesByAccount(accountId: string): Observable<any[]> {
    this.resourcesLoading.next(true);
    
    // Check if we have all resources cached
    if (this.resourcesCache.has('all')) {
      const filteredResources = (this.resourcesCache.get('all') || []).filter(r => r.accountId === accountId);
      this.resourcesLoading.next(false);
      return of(filteredResources);
    }
    
    // Otherwise fetch from API using GSI
    return from(client.models.AWSResource.list({
      filter: {
        and: [
          { accountId: { eq: accountId } },
          { or: [
            { isMetric: { eq: false } },
            { isMetric: { attributeExists: false } }
          ]}
        ]
      },
      limit: 1000
    })).pipe(
      map(response => {
        // Additional safety check
        const filteredData = response.data.filter(item => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        
        // Process each resource to fix any issues
        return filteredData.map(item => this.processResourceData(item));
      }),
      tap(resources => {
        // Cache the result
        this.resourcesCache.set(`account:${accountId}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError(error => {
        console.error(`Error fetching resources for account ${accountId}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }
  
  /**
   * Clear the cache to force fresh data on next request
   */
  clearCache(): void {
    this.resourcesCache.clear();
    console.log('Resource cache cleared');
  }
}