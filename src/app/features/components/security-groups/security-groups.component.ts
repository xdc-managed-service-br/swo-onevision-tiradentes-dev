// src/app/features/components/security-groups/security-groups.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { SecurityGroup } from '../../../models/resource.model';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-security-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './security-groups.component.html',
  styleUrls: ['./security-groups.component.css']
})
export class SecurityGroupsComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  securityGroups: SecurityGroup[] = [];
  filteredSecurityGroups: SecurityGroup[] = [];

  loading = false;
  searchTerm = '';
  selectedAccount = '';
  selectedRegion = '';

  // Filters
  uniqueAccounts: string[] = [];
  uniqueRegions: string[] = [];

  ngOnInit(): void {
    this.loadSecurityGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadSecurityGroups(): Promise<void> {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'SecurityGroup' } }
      });

      const parseJson = <T>(val: unknown, fb: T): T => {
        if (Array.isArray(fb) && Array.isArray(val)) return val as T;
        if (typeof val === 'string' && val) {
          try { return JSON.parse(val) as T; } catch { return fb; }
        }
        return (val ?? fb) as T;
      };

      this.securityGroups = data.map((it: any) => {
        const sg: SecurityGroup = {
          // BaseResource
          id: it.id,
          resourceType: it.resourceType ?? 'SecurityGroup',
          accountId: it.accountId,
          accountName: it.accountName ?? '',
          region: it.region,
          lastUpdated: it.lastUpdated ?? '',
          tags: typeof it.tags === 'string' ? parseJson<Record<string, string>>(it.tags, {}) : (it.tags ?? {}),

          // SG specifics (aligned to Amplify schema you shared)
          groupId: it.groupId ?? it.securityGroupId ?? '',
          groupName: it.groupName ?? '',
          groupNameTag: it.groupNameTag ?? '',
          description: it.description ?? '',
          vpcId: it.vpcId ?? '',
          ownerId: it.ownerId ?? '',

          // From schema: counters and risk flags
          ingressRuleCount: it.sgingressRuleCount ?? 0,
          egressRuleCount: it.sgegressRuleCount ?? 0,
          hasExposedIngressPorts: it.hasExposedIngressPorts ?? false,
          exposedIngressPorts: parseJson<number[]>(it.exposedIngressPorts, []),
          allIngressPortsExposed: it.allIngressPortsExposed ?? false,
          riskyIngressRules: parseJson<any[]>(it.riskyIngressRules, []),
          hasExposedEgressPorts: it.hasExposedEgressPorts ?? false,
          exposedEgressPorts: parseJson<number[]>(it.exposedEgressPorts, []),

          // Optional (future): inboundRules/outboundRules can be added when backend exposes them
        } as SecurityGroup;

        return sg;
      });

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading security groups:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues(): void {
    this.uniqueAccounts = [
      ...new Set(
        this.securityGroups
          .map(sg => sg.accountName || sg.accountId)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    ];

    this.uniqueRegions = [
      ...new Set(
        this.securityGroups
          .map(sg => sg.region)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    ];
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredSecurityGroups = this.securityGroups.filter(sg => {
      const matchesSearch =
        !term ||
        sg.groupName?.toLowerCase().includes(term) ||
        sg.groupId?.toLowerCase().includes(term) ||
        sg.description?.toLowerCase().includes(term);

      const matchesAccount =
        !this.selectedAccount ||
        sg.accountName === this.selectedAccount ||
        sg.accountId === this.selectedAccount;

      const matchesRegion = !this.selectedRegion || sg.region === this.selectedRegion;

      return matchesSearch && matchesAccount && matchesRegion;
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedAccount = '';
    this.selectedRegion = '';
    this.applyFilters();
  }

  getRuleCount(rules: any[] | undefined): number {
    return Array.isArray(rules) ? rules.length : 0;
  }

  getVpcDisplayName(vpcId?: string): string {
    return vpcId || 'N/A';
  }

  trackByGroupId(_idx: number, sg: SecurityGroup): string {
    return sg.groupId;
  }
}
