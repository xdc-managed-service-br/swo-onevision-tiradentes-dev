// src/app/core/services/resource-query.service.ts
import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { Observable, from } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import type { Schema } from '../../../../amplify/data/resource';

export interface QueryOptions {
  resourceType?: string;
  region?: string;
  accountId?: string;
  filters?: Record<string, any>;
  limit?: number;
  nextToken?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface QueryResult {
  items: any[];
  nextToken?: string;
  count: number;
  scannedCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceQueryService {
  private client = generateClient<Schema>();
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  loading$ = this.loadingSubject.asObservable();
  
  queryResources(options: QueryOptions): Observable<QueryResult> {
    this.loadingSubject.next(true);
    
    const filter: any = {};
    
    if (options.resourceType) {
      filter.resourceType = { eq: options.resourceType };
    }
    
    if (options.region) {
      filter.region = { eq: options.region };
    }
    
    if (options.accountId) {
      filter.accountId = { eq: options.accountId };
    }
    
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          filter[key] = { eq: value };
        }
      });
    }
    
    return from(this.client.models['AWSResource']['list']({
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      limit: options.limit || 20,
      nextToken: options.nextToken
    }).finally(() => {
      this.loadingSubject.next(false);
    }).then(response => {
      return {
        items: response.data,
        nextToken: response.nextToken ?? undefined,
        count: response.data.length,
        scannedCount: response.data.length
      };
    }));
  }
  
  loadNextPage(previousResult: QueryResult, options: QueryOptions): Observable<QueryResult> {
    if (!previousResult.nextToken) {
      return from(Promise.resolve({
        items: [],
        count: 0,
        scannedCount: 0
      }));
    }
    
    return this.queryResources({
      ...options,
      nextToken: previousResult.nextToken
    });
  }
}