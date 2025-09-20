// src/app/core/services/resource-processor.service.ts
import { Injectable } from '@angular/core';
import {
  BaseResource,
  EFSFileSystem,
  S3Bucket,
  EBSVolume,
  FSxFileSystem,
  BackupPlan,
  BackupVault
} from '../../models/resource.model';

// Defino localmente para não exigir mudança imediata no model
type TagKV = { Key: string; Value: string };



type DdbAttr =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { M: Record<string, DdbAttr> }
  | { L: DdbAttr[] }
  | null
  | undefined;

@Injectable({ providedIn: 'root' })
export class ResourceProcessorService {

  // =====================================================
  // API PÚBLICA (compat com o ResourceService)
  // =====================================================
  /**
   * Mantido para compatibilidade com ResourceService.
   * Normaliza um item de recurso, despachando por resourceType.
   */
  processResourceData(item: any): any {
    // Alguns itens podem vir já “planos” do AppSync; outros podem estar no formato AttributeValue
    const resourceType = this.toString(item?.resourceType) ?? this.toString((item as any)?.resource_type) ?? '';

    switch (resourceType) {
      case 'EFSFileSystem':
        return this.normalizeEfs(item);
      case 'S3Bucket':
        return this.normalizeS3(item);
      case 'EBSVolume':
        return this.normalizeEbs(item);
      case 'FSxFileSystem':
        return this.normalizeFsx(item);
      case 'BackupPlan':
        return this.normalizeBackupPlan(item);
      case 'BackupVault':
        return this.normalizeBackupVault(item);
      default:
        // Fallback genérico: “des-AttributeValue-izar” e aplicar base
        return this.normalizeGeneric(item);
    }
  }

  // =====================================================
  // NORMALIZADORES ESPECÍFICOS
  // =====================================================

  normalizeEfs(raw: any): EFSFileSystem {
    const base = this.normalizeBase(raw);

    const fileSystemId = this.toString(raw.fileSystemId);
    const performanceMode = this.toString(raw.performanceMode);
    const throughputMode = this.toString(raw.throughputMode);
    const provisionedThroughputInMibps = this.toNumber(raw.provisionedThroughputInMibps) ?? 0;
    const lifecyclePolicies = this.toStringArray(raw.lifecyclePolicies) ?? [];
    const backupPolicyEnabled = this.toBoolean(raw.backupPolicyEnabled) ?? false;
    const mountTargetsCount = this.toNumber(raw.mountTargetsCount) ?? 0;

    // “sizeInBytes” pode vir como string pronta (“59.28 TB”) ou como número (bytes)
    const sizeStr = this.toString(raw.sizeInBytes);
    const sizeNum = this.toNumber(raw.sizeInBytes);
    const sizeInBytes = sizeStr ?? (sizeNum !== undefined ? this.bytesToHuman(sizeNum) : undefined);

    // Métricas (AttributeValue M -> objeto)
    const metrics = this.unwrap<Record<string, any>>(raw.metrics) || {};
    const nameTag = this.extractNameTag(base.tags);

    return {
      ...base,
      resourceType: 'EFSFileSystem',
      fileSystemId,
      performanceMode,
      throughputMode,
      provisionedThroughputInMibps,
      lifecyclePolicies,
      backupPolicyEnabled,
      mountTargetsCount,
      sizeInBytes,
      metrics,
      // helper de exibição (se no teu model existir esse campo, ótimo; se não, segue no objeto solto)
      nameTag
    } as EFSFileSystem & { nameTag?: string };
  }

  normalizeS3(raw: any): S3Bucket {
    const base = this.normalizeBase(raw);

    const bucketName = this.toString(raw.bucketName) ?? '';
    const bucketNameTag = this.toString(raw.bucketNameTag) ?? this.extractNameTag(base.tags) ?? '';
    const hasLifecycleRules = this.toBoolean(raw.hasLifecycleRules);
    const objectCount = this.toNumber(raw.objectCount);
    const storageBytes = this.toString(raw.storageBytes);

    // extras (se vierem)
    const encryption = this.toString(raw.encryption);
    const versioning = this.toString(raw.versioning);
    const publicAccessBlock = this.toBoolean(raw.publicAccessBlock);

    return {
      ...base,
      resourceType: 'S3Bucket',
      bucketName,
      bucketNameTag,
      hasLifecycleRules: hasLifecycleRules ?? undefined,
      objectCount: objectCount ?? undefined,
      storageBytes: storageBytes ?? undefined,
      encryption: encryption ?? undefined,
      versioning: versioning ?? undefined,
      publicAccessBlock: publicAccessBlock ?? undefined
    } as S3Bucket;
  }

  normalizeEbs(raw: any): EBSVolume {
    const base = this.normalizeBase(raw);

    const volumeId = this.toString(raw.volumeId);
    const volumeName = this.toString(raw.volumeName);
    const volumeState = this.toString(raw.volumeState) ?? '';
    const volumeType = this.toString(raw.volumeType) ?? '';
    const size = this.toNumber(raw.size);
    const encrypted = this.toBoolean(raw.encrypted);
    const attachedInstances = this.toStringArray(raw.attachedInstances) ?? [];

    return {
      ...base,
      resourceType: 'EBSVolume',
      volumeId,
      volumeName: volumeName ?? undefined,
      volumeState,
      volumeType,
      size: size ?? undefined,
      encrypted: encrypted ?? undefined,
      attachedInstances
    } as EBSVolume;
  }

  normalizeFsx(raw: any): FSxFileSystem {
    const base = this.normalizeBase(raw);

    const fileSystemId = this.toString(raw.fileSystemId);
    const fileSystemType = this.toString(raw.fileSystemType);
    const deploymentType = this.toString(raw.deploymentType);
    const storageCapacity = this.toNumber(raw.storageCapacity);
    const throughputCapacity = this.toNumber(raw.throughputCapacity);
    const automaticBackupRetentionDays = this.toNumber(raw.automaticBackupRetentionDays);
    const dailyAutomaticBackupStartTime = this.toString(raw.dailyAutomaticBackupStartTime);
    const copyTagsToBackups = this.toBoolean(raw.copyTagsToBackups);
    const lifecycle = this.toString(raw.lifecycle);

    return {
      ...base,
      resourceType: 'FSxFileSystem',
      fileSystemId,
      fileSystemType,
      deploymentType,
      storageCapacity: storageCapacity ?? undefined,
      throughputCapacity: throughputCapacity ?? undefined,
      automaticBackupRetentionDays: automaticBackupRetentionDays ?? undefined,
      dailyAutomaticBackupStartTime: dailyAutomaticBackupStartTime ?? undefined,
      copyTagsToBackups: copyTagsToBackups ?? undefined,
      lifecycle: lifecycle ?? undefined
    } as FSxFileSystem;
  }

  normalizeBackupPlan(raw: any): BackupPlan {
    const base = this.normalizeBase(raw);

    const backupPlanId = this.toString(raw.backupPlanId);
    const backupPlanName = this.toString(raw.backupPlanName);
    const schedules = this.toStringArray(raw.schedules) ?? [];
    const selectionResourceTypes = this.toStringArray(raw.selectionResourceTypes) ?? [];
    const targetBackupVault = this.toString(raw.targetBackupVault);
    const lastExecutionDate = this.toString(raw.lastExecutionDate);
    const windowStart = this.toNumber(raw.windowStart);
    const windowDuration = this.toNumber(raw.windowDuration);

    return {
      ...base,
      resourceType: 'BackupPlan',
      backupPlanId,
      backupPlanName,
      schedules,
      selectionResourceTypes,
      targetBackupVault: targetBackupVault ?? undefined,
      lastExecutionDate: lastExecutionDate ?? undefined,
      windowStart: windowStart ?? undefined,
      windowDuration: windowDuration ?? undefined
    } as BackupPlan;
  }

  normalizeBackupVault(raw: any): BackupVault {
    const base = this.normalizeBase(raw);

    const backupVaultName = this.toString(raw.backupVaultName);
    const encryptionKeyArn = this.toString(raw.encryptionKeyArn);
    const numberOfRecoveryPoints = this.toNumber(raw.numberOfRecoveryPoints);
    const latestRecoveryPointAgeDays = this.toNumber(raw.latestRecoveryPointAgeDays);
    const locked = this.toBoolean(raw.locked);

    return {
      ...base,
      resourceType: 'BackupVault',
      backupVaultName: backupVaultName ?? undefined,
      encryptionKeyArn: encryptionKeyArn ?? undefined,
      numberOfRecoveryPoints: numberOfRecoveryPoints ?? undefined,
      latestRecoveryPointAgeDays: latestRecoveryPointAgeDays ?? undefined,
      locked: locked ?? undefined
    } as BackupVault;
  }

  normalizeGeneric(raw: any): BaseResource {
    // Tenta “des-attributeValue-izar” tudo e retorna o objeto resultante
    const flat = this.unwrapDeep(raw) as Record<string, any>;

    // Garante o shape mínimo de BaseResource
    const base = this.normalizeBase(flat);
    return {
      ...flat,
      ...base
    };
  }

  // =====================================================
  // BASE / COMUNS
  // =====================================================

  private normalizeBase(raw: any): BaseResource & { tags?: TagKV[] } {
    const obj = this.unwrapDeep(raw) as Record<string, any>;

    const base: BaseResource = {
      id: this.toString(obj['id']) ?? '',
      resourceType: this.toString(obj['resourceType']) ?? '',
      accountId: this.toString(obj['accountId']) ?? '',
      region: this.toString(obj['region']) ?? '',
      createdAt: this.toString(obj['createdAt']) ?? '',
      updatedAt: this.toString(obj['updatedAt']) ?? '',
      accountName: this.toString(obj['accountName']) ?? undefined,
      metrics: this.unwrap(obj['metrics']) ?? undefined,
      availabilityZones: this.toStringArray(obj['availabilityZones']) ?? undefined
    };

    // resourceTypeRegionId opcional
    if (base['resourceType'] && base['region']) {
      (base as any).resourceTypeRegionId = `${base['resourceType']}:${base['region']}`;
    }

    // tags normalizadas
    const tags = this.normalizeTags(obj['tags']);

    return { ...base, tags };
  }

  // =====================================================
  // DYNAMODB ATTRIBUTEVALUE HELPERS
  // =====================================================

  unwrap<T = any>(value: any): T {
    if (value === null || value === undefined) return value as T;

    // Já “plano”?
    if (typeof value !== 'object' || Array.isArray(value)) return value as T;

    // AttributeValue forms:
    if ('S' in value) return (value.S as unknown) as T;
    if ('N' in value) return (Number(value.N) as unknown) as T;
    if ('BOOL' in value) return (value.BOOL as unknown) as T;
    if ('L' in value && Array.isArray(value.L)) {
      return (value.L.map((v: DdbAttr) => this.unwrap(v)) as unknown) as T;
    }
    if ('M' in value && value.M && typeof value.M === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value.M)) out[k] = this.unwrap(v as DdbAttr);
      return (out as unknown) as T;
    }

    // Objeto “plano”
    return value as T;
  }

  unwrapDeep(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // AttributeValue de nível superior
    if (typeof obj === 'object' && (('S' in obj) || ('N' in obj) || ('BOOL' in obj) || ('M' in obj) || ('L' in obj))) {
      return this.unwrap(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(v => this.unwrapDeep(v));
    }

    if (typeof obj === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = this.unwrapDeep(v);
      }
      return out;
    }

    return obj;
  }

  // =====================================================
  // CONVERSORES COMUNS
  // =====================================================

  toString(val: any): string | undefined {
    const un = this.unwrap(val);
    if (un === null || un === undefined) return undefined;
    if (typeof un === 'string') return un;
    if (typeof un === 'number' || typeof un === 'boolean') return String(un);
    try { return JSON.stringify(un); } catch { return String(un); }
  }

  toNumber(val: any): number | undefined {
    const un = this.unwrap(val);
    if (un === null || un === undefined) return undefined;
    if (typeof un === 'number') return un;
    if (typeof un === 'string' && un.trim() !== '' && !Number.isNaN(Number(un))) return Number(un);
    return undefined;
  }

  toBoolean(val: any): boolean | undefined {
    const un = this.unwrap(val);
    if (typeof un === 'boolean') return un;
    if (typeof un === 'string') {
      const s = un.toLowerCase().trim();
      if (s === 'true') return true;
      if (s === 'false') return false;
    }
    return undefined;
  }

  toStringArray(val: any): string[] | undefined {
    const un = this.unwrap<any>(val);
    if (Array.isArray(un)) {
      return un
        .map(x => this.toString(x))
        .filter((s): s is string => !!s && s.trim().length > 0);
    }
    if (typeof un === 'string') {
      const trimmed = un.trim();
      if (!trimmed) return undefined;
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .map(x => (typeof x === 'string' ? x : this.toString(x)))
              .filter((s): s is string => !!s && s.trim().length > 0);
          }
        } catch { /* ignore */ }
      }
      return [trimmed];
    }
    return undefined;
  }

  // =====================================================
  // TAGS
  // =====================================================

  normalizeTags(val: any): TagKV[] | undefined {
    const un = this.unwrap(val);
    if (!un) return undefined;

    // Array de {Key/Value}?
    if (Array.isArray(un) && un.every(t => typeof t === 'object')) {
      return un
        .map((t: any) => ({
          Key: t.Key ?? t.key ?? t.name ?? undefined,
          Value: t.Value ?? t.value ?? ''
        }))
        .filter((t: TagKV) => !!t.Key);
    }

    // Objeto simples { Name: 'x', Env: 'y' }
    if (typeof un === 'object' && !Array.isArray(un)) {
      return Object.entries(un).map(([k, v]) => ({ Key: k, Value: this.toString(v) ?? '' }));
    }

    // String JSON (ex.: "[{ \"Key\": \"Name\", \"Value\": \"Oracle Support\" }]")
    if (typeof un === 'string') {
      try {
        const parsed = JSON.parse(un);
        return this.normalizeTags(parsed);
      } catch { /* ignore */ }
    }
    return undefined;
  }

  extractNameTag(tags?: TagKV[] | null): string | undefined {
    if (!tags || !tags.length) return undefined;
    const name = tags.find(t => (t.Key || '').toLowerCase() === 'name');
    return name?.Value ?? undefined;
  }

  // =====================================================
  // FORMATAÇÃO
  // =====================================================

  bytesToHuman(bytes?: number): string {
    if (!bytes || bytes < 0) return 'N/A';
    const units = ['B','KB','MB','GB','TB','PB'];
    let u = 0;
    let v = bytes;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(2)} ${units[u]}`;
  }

  performanceLabel(perf?: string): string {
    if (!perf) return 'N/A';
    if (perf === 'generalPurpose') return 'General Purpose';
    if (perf === 'maxIO') return 'Max I/O';
    return this.capitalize(perf);
  }

  throughputLabelEfs(efs: EFSFileSystem & { metrics?: any }): string {
    if (efs.throughputMode?.toLowerCase() === 'provisioned' && efs.provisionedThroughputInMibps) {
      return `${efs.provisionedThroughputInMibps} MiB/s (Provisioned)`;
    }
    const bps = efs.metrics?.permittedThroughput_avg ?? 0;
    if (bps > 0) {
      const mibps = bps / (1024 * 1024);
      return `${mibps.toFixed(0)} MiB/s (Elastic)`;
    }
    return efs.throughputMode ? this.capitalize(efs.throughputMode) : 'Elastic';
  }

  lifecycleLabel(list?: string[]): string {
    if (!list || list.length === 0) return 'None';
    const map: Record<string, string> = {
      AFTER_7_DAYS: 'After 7 days',
      AFTER_14_DAYS: 'After 14 days',
      AFTER_30_DAYS: 'After 30 days',
      AFTER_60_DAYS: 'After 60 days',
      AFTER_90_DAYS: 'After 90 days'
    };
    return list.map(x => map[x] ?? x).join(', ');
  }

  capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
}