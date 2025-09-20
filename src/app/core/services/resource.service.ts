// src/app/core/services/resource.service.ts
import { Injectable } from '@angular/core';
import { ResourceProcessorService } from './resource-processor.service';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import type { AWSResourceModel } from '../../models/resource.model';

const client = generateClient<Schema>();

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private resourcesCache = new Map<string, any[]>();
  private resourcesLoading = new BehaviorSubject<boolean>(false);
  public loading$ = this.resourcesLoading.asObservable();

  constructor(private resourceProcessor: ResourceProcessorService) {}

  getAllResources(): Observable<AWSResourceModel[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get('all') as AWSResourceModel[] || []);
    }

    return from(this.loadAllResourcesWithPagination()).pipe(
      tap((resources) => {
        this.resourcesCache.set('all', resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error('Error fetching all resources:', error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  getResourcesByType(resourceType: string): Observable<AWSResourceModel[]> {
    console.log(`[ResourceService] load by type: ${resourceType}`);
    this.resourcesLoading.next(true);
    const cacheKey = `type:${resourceType}`;
    if (this.resourcesCache.has(cacheKey)) {
      this.resourcesLoading.next(false);
      return of(this.resourcesCache.get(cacheKey) as AWSResourceModel[] || []);
    }

    return from(this.loadResourcesByTypeWithPagination(resourceType)).pipe(
      tap((resources) => {
        this.resourcesCache.set(cacheKey, resources);
        this.resourcesLoading.next(false);
        console.log(`[ResourceService] ${resourceType} count:`, resources.length);
      }),
      catchError((error) => {
        console.error(`Error fetching ${resourceType} resources:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  getResourcesByRegion(region: string): Observable<AWSResourceModel[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      const filtered = (this.resourcesCache.get('all') as AWSResourceModel[] || []).filter((r) => r.region === region);
      this.resourcesLoading.next(false);
      return of(filtered);
    }

    return from(
      client.models.AWSResource.list({
        filter: {
          region: { eq: region }
        },
        limit: 1000,
      })
    ).pipe(
      map((response: any) => {
        const filtered = response.data;
        return filtered.map((item: any) => this.resourceProcessor.processResourceData(item)) as AWSResourceModel[];
      }),
      tap((resources) => {
        this.resourcesCache.set(`region:${region}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error(`Error fetching resources in region ${region}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }

  getResourcesByAccount(accountId: string): Observable<AWSResourceModel[]> {
    this.resourcesLoading.next(true);

    if (this.resourcesCache.has('all')) {
      const filtered = (this.resourcesCache.get('all') as AWSResourceModel[] || []).filter((r) => r.accountId === accountId);
      this.resourcesLoading.next(false);
      return of(filtered);
    }

    return from(this.loadResourcesByAccountWithPagination(accountId)).pipe(
      tap((resources) => {
        this.resourcesCache.set(`account:${accountId}`, resources);
        this.resourcesLoading.next(false);
      }),
      catchError((error) => {
        console.error(`Error fetching resources for account ${accountId}:`, error);
        this.resourcesLoading.next(false);
        return of([]);
      })
    );
  }


  clearCache(): void {
    this.resourcesCache.clear();
    console.log('[ResourceService] cache cleared');
  }

  // =====================================================
  // Private helpers
  // =====================================================

  private async loadAllResourcesWithPagination(): Promise<AWSResourceModel[]> {
    let all: AWSResourceModel[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            limit: 1000,
            nextToken,
          });

        const filtered = response.data;
        const processed = filtered.map((item) => this.resourceProcessor.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] loaded ${processed.length} (total ${all.length})`);
      } catch (error) {
        console.error('Error in pagination (all resources):', error);
        break;
      }
    } while (nextToken);

    console.log(`[ResourceService] total resources loaded: ${all.length}`);
    return all;
  }

  private async loadResourcesByTypeWithPagination(resourceType: string): Promise<AWSResourceModel[]> {
    let all: AWSResourceModel[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: { resourceType: { eq: resourceType } },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data;
        const processed = filtered.map((item) => this.resourceProcessor.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] type ${resourceType} batch: ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error(`Error in pagination (type ${resourceType}):`, error);
        break;
      }
    } while (nextToken);

    return all;
  }

  private async loadResourcesByAccountWithPagination(accountId: string): Promise<AWSResourceModel[]> {
    let all: AWSResourceModel[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        const response: { data: any[]; nextToken?: string | null | undefined } =
          await client.models.AWSResource.list({
            filter: { accountId: { eq: accountId } },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data;
        const processed = filtered.map((item) => this.resourceProcessor.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] account ${accountId} batch: ${processed.length}, total ${all.length}`);
      } catch (error) {
        console.error(`Error in pagination (account ${accountId}):`, error);
        break;
      }
    } while (nextToken);

    return all;
  }
}
