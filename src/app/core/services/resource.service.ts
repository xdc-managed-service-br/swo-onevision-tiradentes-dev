// src/app/core/services/resource.service.ts

import { Injectable } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '.../../../amplify/data/resource';

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
   */
  private async loadAllResourcesWithPagination(): Promise<any[]> {
    let allResources: any[] = [];
    let nextToken: string | null | undefined = null;
    
    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } = await client.models.AWSResource.list({
          limit: 1000, // Maximum allowed limit per request
          nextToken: nextToken
        });
        
        // Process each resource to fix any issues
        const processedData = response.data.map(item => this.processResourceData(item));
        
        allResources = [...allResources, ...processedData];
        nextToken = response.nextToken;
        
        console.log(`Loaded batch of ${response.data.length} resources. Total: ${allResources.length}`);
      } catch (error) {
        console.error('Error in pagination batch:', error);
        break; // Exit the loop on error
      }
    } while (nextToken);
    
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
   */
  getResourcesByType(resourceType: string): Observable<any[]> {
    console.log(`Attempting to load resources of type: ${resourceType}`);
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
   */
  private async loadResourcesByTypeWithPagination(resourceType: string): Promise<any[]> {
    let resources: any[] = [];
    let nextToken: string | null | undefined = null;
    
    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } = await client.models.AWSResource.list({
          filter: {
            resourceType: {
              eq: resourceType
            }
          },
          limit: 1000, // Maximum allowed limit per request
          nextToken: nextToken
        });
        
        // Process each resource to fix any issues
        const processedData = response.data.map(item => this.processResourceData(item));
        
        resources = [...resources, ...processedData];
        nextToken = response.nextToken;
        
        console.log(`Loaded batch of ${response.data.length} ${resourceType} resources. Total: ${resources.length}`);
      } catch (error) {
        console.error(`Error in ${resourceType} pagination batch:`, error);
        break; // Exit the loop on error
      }
    } while (nextToken);
    
    return resources;
  }
  
  /**
   * Get resources by region
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
        region: {
          eq: region
        }
      },
      limit: 1000
    })).pipe(
      map(response => {
        // Process each resource to fix any issues
        return response.data.map(item => this.processResourceData(item));
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
   */
  getResourcesByAccount(accountId: string): Observable<any[]> {
    this.resourcesLoading.next(true);
    
    // Check if we have all resources cached
    if (this.resourcesCache.has('all')) {
      const filteredResources = (this.resourcesCache.get('all') || []).filter(r => r.accountId === accountId);
      this.resourcesLoading.next(false);
      return of(filteredResources);
    }
    
    // Otherwise fetch from API
    return from(client.models.AWSResource.list({
      filter: {
        accountId: {
          eq: accountId
        }
      },
      limit: 1000
    })).pipe(
      map(response => {
        // Process each resource to fix any issues
        return response.data.map(item => this.processResourceData(item));
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
  }
}