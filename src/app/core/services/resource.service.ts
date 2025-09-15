// src/app/core/services/resource.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import type { AWSResourceModel } from '../../models/resource.model';
import type { AWSMetric } from '../../models/resource.model';

const client = generateClient<Schema>();

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private resourcesCache = new Map<string, any[]>();
  private resourcesLoading = new BehaviorSubject<boolean>(false);
  public loading$ = this.resourcesLoading.asObservable();

  constructor() {}

  // =====================================================
  // Public API
  // =====================================================

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
    if (resourceType.startsWith('METRIC')) {
      console.warn(`Attempted to load metric type ${resourceType} as resource. Returning empty.`);
      return of([]);
    }

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
          and: [
            { region: { eq: region } },
            {
              or: [
                { isMetric: { eq: false } },
                { isMetric: { attributeExists: false } },
              ],
            },
          ],
        },
        limit: 1000,
      })
    ).pipe(
      map((response: any) => {
        const filtered = response.data.filter((item: any) => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });
        return filtered.map((item: any) => this.processResourceData(item)) as AWSResourceModel[];
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

  getMetricsOnly(): Observable<AWSMetric[]> {
    console.info('[ResourceService] getMetricsOnly(): start');
    return from(this.loadMetricsWithPagination()).pipe(
      tap((metrics) => {
        const types = Array.isArray(metrics) ? metrics.map((m: any) => m?.resourceType).filter(Boolean) : [];
        console.info('[ResourceService] getMetricsOnly(): received metrics', {
          count: Array.isArray(metrics) ? metrics.length : 'not-array',
          sample: (Array.isArray(metrics) ? metrics.slice(0, 3) : metrics) as any,
          types,
          hasSummary: Array.isArray(metrics) && metrics.some((m: any) => m?.resourceType === 'METRIC_SUMMARY')
        });
      }),
      catchError((error) => {
        console.error('[ResourceService] getMetricsOnly(): error', error);
        return of([] as AWSMetric[]);
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
            filter: {
              or: [
                { isMetric: { eq: false } },
                { isMetric: { attributeExists: false } },
              ],
            },
            limit: 1000,
            nextToken,
          });

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.resourceType?.startsWith('METRIC')) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.log(`[ResourceService] loaded ${processed.length} (total ${all.length})`);
      } catch (error) {
        console.error('Error in pagination (all resources):', error);
        break;
      }
    } while (nextToken);

    console.log(`[ResourceService] total resources loaded (excl. metrics): ${all.length}`);
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

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
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

        const filtered = response.data.filter((item) => {
          if (item.isMetric === true) return false;
          if (item.id?.startsWith('METRICS-')) return false;
          return true;
        });

        const processed = filtered.map((item) => this.processResourceData(item));
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

  private async loadMetricsWithPagination(): Promise<AWSMetric[]> {
    let all: AWSMetric[] = [];
    let nextToken: string | null | undefined = null;

    do {
      try {
        console.debug('[ResourceService] loadMetricsWithPagination(): listing with beginsWith METRIC_ ...', { nextToken });
        const response: { data: any[]; nextToken?: string | null | undefined } = await client.models.AWSResource.list({
          filter: { resourceType: { beginsWith: 'METRIC_' } },
          limit: 100,
          nextToken,
        });

        console.debug('[ResourceService] list result', {
          batchSize: response?.data?.length,
          nextToken: response?.nextToken,
          firstKeys: Array.isArray(response?.data) && response.data.length ? Object.keys(response.data[0]) : []
        });
        const processed = (response.data || []).map((item: any) => this.processMetricData(item));
        all = [...all, ...processed];
        nextToken = response.nextToken;
        console.info('[ResourceService] metrics batch', { batch: processed.length, total: all.length });
      } catch (error) {
        console.error('[ResourceService] beginsWith METRIC_ failed. Trying fallback(s)...', error);

        // Fallback: list everything then filter client-side
        try {
          const alternative = await client.models.AWSResource.list({ limit: 1000, nextToken });
          console.debug('[ResourceService] fallback list all result', { size: alternative?.data?.length });
          // Accept both METRIC_ and METRIC- just in case
          const metricItems = (alternative.data || []).filter((item: any) => {
            const t = item?.resourceType ?? '';
            return typeof t === 'string' && (t.startsWith('METRIC_') || t.startsWith('METRIC-') || t.startsWith('METRIC'));
          });
          const processed = metricItems.map((item: any) => this.processMetricData(item));
          all = [...all, ...processed];
          console.info('[ResourceService] metrics fallback batch', { batch: processed.length, total: all.length });
          break; // Exit loop after fallback pass
        } catch (altError) {
          console.error('[ResourceService] fallback also failed', altError);
          break;
        }
      }
    } while (nextToken);

    console.info('[ResourceService] total metrics loaded', { total: all.length, types: all.map((m: any) => m?.resourceType) });
    return all;
  }

    // Shape resource items as needed without changing unrelated fields
  private processResourceData(resource: any): AWSResourceModel {
    const processed: any = { ...resource };

    if (processed.resourceType === 'EC2Instance') {
      // 1) Nullables → undefined (para casar com a sua interface)
      const strFields = [
        'instanceName', 'instanceType', 'instanceState', 'platformDetails',
        'amiName', 'iamRole', 'patchGroup', 'healthStatus',
        'systemStatus', 'instanceStatus', 'ebsStatus',
        'ssmStatus', 'ssmPingStatus', 'ssmVersion',
        'swoMonitor', 'swoPatch', 'swoBackup', 'swoRiskClass', 'instanceId'
      ];
      for (const f of strFields) {
        if (processed[f] === null) processed[f] = undefined;
      }

      // 2) Campos obrigatórios da sua interface que podem vir vazios do schema
      if (!processed.instanceType) processed.instanceType = 'unknown'; // evita o erro de "string" obrigatório

      // 3) Arrays sempre definidos
      if (!Array.isArray(processed.instancePrivateIps)) {
        processed.instancePrivateIps = Array.isArray(processed.privateIpArray) ? processed.privateIpArray : [];
      }
      if (!Array.isArray(processed.instancePublicIps)) {
        processed.instancePublicIps = Array.isArray(processed.publicIpArray) ? processed.publicIpArray : [];
      }

      // 4) Booleans coerentes
      processed.cwAgentMemoryDetected = !!processed.cwAgentMemoryDetected;
      processed.cwAgentDiskDetected   = !!processed.cwAgentDiskDetected;

      // 5) launchTime fallback (usar updatedAt, não lastUpdated)
      if (processed.launchTime == null) {
        if (processed.updatedAt) processed.launchTime = processed.updatedAt;
        else if (processed.createdAt) processed.launchTime = processed.createdAt;
      }
    }

    return processed as AWSResourceModel;
  }

  /**
   * STRICT schema-aligned metric processing.
   * Only fields present in your Amplify schema / Angular interfaces are coerced.
   */
  private processMetricData(metric: any): AWSMetric {
    const processed: any = { ...metric };
    if (!processed || typeof processed !== 'object') {
      console.warn('[ResourceService] processMetricData(): metric is not an object', { metric });
      return processed as AWSMetric;
    }
    const rawKeys = Object.keys(metric || {});
    // Normalize resourceType (hyphen → underscore) so the UI can look up by a single value
    const originalType = processed?.resourceType;
    if (typeof originalType === 'string') {
      const normalized = originalType.replace(/-/g, '_');
      processed.resourceType = normalized;
    }
    console.debug('[ResourceService] processMetricData(): in', {
      id: processed?.id,
      type: processed?.resourceType,
      originalType,
      rawKeys,
      hasDataField: 'data' in (metric || {}),
      dataType: typeof (metric as any)?.data
    });

    // --- Global Summary ---
    const globalSummaryNumeric = [
      'totalResources',
    ];

    // --- Resource Counts ---
    const resourceCountsNumeric = [
      'resourceCounts_AMI',
      'resourceCounts_AutoScalingGroup',
      'resourceCounts_DirectConnectConnection',
      'resourceCounts_DirectConnectVirtualInterface',
      'resourceCounts_EBSSnapshot',
      'resourceCounts_EBSVolume',
      'resourceCounts_EC2Instance',
      'resourceCounts_ElasticIP',
      'resourceCounts_InternetGateway',
      'resourceCounts_LoadBalancer',
      'resourceCounts_NetworkACL',
      'resourceCounts_RDSClusterSnapshot',
      'resourceCounts_RDSInstance',
      'resourceCounts_RouteTable',
      'resourceCounts_S3Bucket',
      'resourceCounts_SecurityGroup',
      'resourceCounts_Subnet',
      'resourceCounts_TransitGateway',
      'resourceCounts_TransitGatewayAttachment',
      'resourceCounts_VPC',
      'resourceCounts_VPCEndpoint',
      'resourceCounts_VPNConnection',
    ];

    // --- EC2 Health ---
    const ec2HealthNumeric = [
      'total',
      'byState_running',
      'byState_stopped',
      'healthStatus_Healthy',
      'healthStatus_Stopped',
      'cloudwatchAgent_bothEnabled',
      'cloudwatchAgent_diskMonitoring',
      'cloudwatchAgent_memoryMonitoring',
      'cloudwatchAgent_noneEnabled',
      'cloudwatchAgent_percentageWithDisk',
      'cloudwatchAgent_percentageWithMemory',
      'ssmAgent_connected',
      'ssmAgent_notConnected',
      'ssmAgent_notInstalled',
      'ssmAgent_percentageConnected',
    ];

    // --- Cost ---
    const costNumeric = [
      'potentialMonthlySavings',
      'unassociatedElasticIPs',
      'unattachedEBSVolumes',
    ];

    // --- Security ---
    const securityNumeric = ['exposedSecurityGroups', 'percentageExposed'];

    // --- RDS ---
    const rdsNumeric = [
      'total',
      'available',
      'engines_aurora_mysql',
      'multiAZ',
      'percentageMultiAZ',
      'performanceInsights',
      'percentageWithPerfInsights',
    ];

    // --- Storage ---
    const storageNumeric = ['amiSnapshots', 'ebsSnapshots', 'ebsVolumes', 's3Buckets', 's3WithLifecycle'];

    const numericFields = [
      ...globalSummaryNumeric,
      ...resourceCountsNumeric,
      ...ec2HealthNumeric,
      ...costNumeric,
      ...securityNumeric,
      ...rdsNumeric,
      ...storageNumeric,
    ];

    const coerceNumericFields = (obj: any) => {
      numericFields.forEach((field) => {
        if (obj[field] !== undefined) {
          obj[field] = this.toNumber(obj[field]);
        }
      });
    };

    // Coerce direct fields first
    coerceNumericFields(processed);

    // If provider stored a JSON payload under `data`, try to extract from it too
    let payload: any = (processed as any).data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = undefined; }
    }
    if (payload && typeof payload === 'object') {
      coerceNumericFields(payload);
      // If direct fields are missing/undefined, hydrate from payload
      const setIfUndef = (k: string) => {
        if (processed[k] === undefined && payload[k] !== undefined) processed[k] = payload[k];
      };
      numericFields.forEach(setIfUndef);

      // Some producers may use nested `resourceCounts` object, e.g. { resourceCounts: { EC2Instance: 12 } }
      const rc = payload.resourceCounts || payload.resource_counts || undefined;
      if (rc && typeof rc === 'object') {
        const map: Record<string, string> = {
          EC2Instance: 'resourceCounts_EC2Instance',
          S3Bucket: 'resourceCounts_S3Bucket',
          RDSInstance: 'resourceCounts_RDSInstance',
          RDSClusterSnapshot: 'resourceCounts_RDSClusterSnapshot',
          VPC: 'resourceCounts_VPC',
          SecurityGroup: 'resourceCounts_SecurityGroup',
          AMI: 'resourceCounts_AMI',
          AutoScalingGroup: 'resourceCounts_AutoScalingGroup',
          DirectConnectConnection: 'resourceCounts_DirectConnectConnection',
          DirectConnectVirtualInterface: 'resourceCounts_DirectConnectVirtualInterface',
          EBSSnapshot: 'resourceCounts_EBSSnapshot',
          EBSVolume: 'resourceCounts_EBSVolume',
          ElasticIP: 'resourceCounts_ElasticIP',
          InternetGateway: 'resourceCounts_InternetGateway',
          LoadBalancer: 'resourceCounts_LoadBalancer',
          NetworkACL: 'resourceCounts_NetworkACL',
          RouteTable: 'resourceCounts_RouteTable',
          Subnet: 'resourceCounts_Subnet',
          TransitGateway: 'resourceCounts_TransitGateway',
          TransitGatewayAttachment: 'resourceCounts_TransitGatewayAttachment',
          VPCEndpoint: 'resourceCounts_VPCEndpoint',
          VPNConnection: 'resourceCounts_VPNConnection'
        };
        for (const [short, full] of Object.entries(map)) {
          if (processed[full] === undefined && rc[short] !== undefined) {
            processed[full] = this.toNumber(rc[short]);
          }
        }
      }
    }

    // Fallbacks for totals: prefer explicit totalResources → resourcesProcessed
    processed.totalResources = this.toNumber(processed.totalResources);
    if (!processed.totalResources) {
      const rp = this.toNumber((processed as any).resourcesProcessed ?? (payload?.resourcesProcessed));
      if (rp) processed.totalResources = rp;
    }

    // Normalize updatedAt for UI badges
    if (!processed.updatedAt) {
      processed.updatedAt = processed.metricDate || processed.createdAt || null;
    }

    // Parse JSON-like strings if necessary
    ['accountDistribution', 'regionDistribution', 'recentResources'].forEach((key) => {
      const v = processed[key];
      if (typeof v === 'string') {
        try { processed[key] = JSON.parse(v); } catch { /* keep as-is */ }
      }
    });

    if (processed.resourceType === 'METRIC_SUMMARY') {
      console.info('[ResourceService] METRIC_SUMMARY processed', {
        id: processed.id,
        totalResources: processed.totalResources,
        EC2: processed.resourceCounts_EC2Instance,
        RDS: processed.resourceCounts_RDSInstance,
        S3: processed.resourceCounts_S3Bucket,
        SG: processed.resourceCounts_SecurityGroup,
        VPC: processed.resourceCounts_VPC
      });
    }

    return processed as AWSMetric;
  }

  // DynamoDB AttributeValue → number coercion
  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (typeof value === 'object' && value.N) return parseFloat(value.N) || 0;
    return 0;
  }
}
