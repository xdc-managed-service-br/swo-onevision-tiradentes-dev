// src/app/features/components/vpcs/vpcs.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { VPC } from '../../../models/resource.model';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-vpcs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './vpcs.component.html',
  styleUrls: ['./vpcs.component.css']
})
export class VpcsComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  vpcs: VPC[] = [];
  filteredVpcs: VPC[] = [];
  loading = false;

  searchTerm = '';
  selectedAccount = '';
  selectedRegion = '';
  selectedState = '';

  // Filtros únicos
  uniqueAccounts: string[] = [];
  uniqueRegions: string[] = [];
  uniqueStates: string[] = [];

  ngOnInit() {
    this.loadVpcs();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadVpcs() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'VPC' } }
      });

      const parseJson = <T>(val: unknown, fb: T): T => {
        if (Array.isArray(fb) && Array.isArray(val)) return val as T;
        if (typeof val === 'string' && val) { try { return JSON.parse(val) as T; } catch { return fb; } }
        return (val ?? fb) as T;
      };

      this.vpcs = data.map((item: any) => ({
        id: item.id,
        resourceType: item.resourceType ?? '',
        accountId: item.accountId,
        accountName: item.accountName ?? '',
        region: item.region,
        lastUpdated: item.lastUpdated ?? '',

        vpcId: item.vpcId ?? '',
        cidrBlock: item.cidrBlock ?? '',
        // estes campos podem não existir no schema -> acessar via any + fallback
        dhcpOptionsId: (item as any).dhcpOptionsId ?? '',
        tenancy: (item as any).instanceTenancy ?? (item as any).tenancy ?? '',
        isDefault: item.isDefault ?? false,
        enableDnsHostnames: item.enableDnsHostnames ?? false,
        enableDnsSupport: item.enableDnsSupport ?? false,

        // alguns schemas usam vpcState ao invés de state
        state: (item as any).vpcState ?? item.state ?? '',

        tags: parseJson<Record<string, string>>((item as any).tags, {})
      }));

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading VPCs:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [
      ...new Set(this.vpcs.map(v => v.accountName || v.accountId).filter((x): x is string => !!x))
    ];
    this.uniqueRegions = [
      ...new Set(this.vpcs.map(v => v.region).filter((x): x is string => !!x))
    ];
    this.uniqueStates = [
      ...new Set(this.vpcs.map(v => v.state).filter((x): x is string => !!x))
    ];
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredVpcs = this.vpcs.filter(vpc => {
      const matchesSearch =
        !term ||
        vpc.vpcId.toLowerCase().includes(term) ||
        vpc.cidrBlock?.toLowerCase().includes(term) ||
        (vpc.tags && JSON.stringify(vpc.tags).toLowerCase().includes(term));

      const matchesAccount =
        !this.selectedAccount ||
        vpc.accountName === this.selectedAccount ||
        vpc.accountId === this.selectedAccount;

      const matchesRegion = !this.selectedRegion || vpc.region === this.selectedRegion;
      const matchesState  = !this.selectedState  || vpc.state  === this.selectedState;

      return matchesSearch && matchesAccount && matchesRegion && matchesState;
    });
  }

  onSearchChange() { this.applyFilters(); }
  onFilterChange()  { this.applyFilters(); }

  clearFilters() {
    this.searchTerm = '';
    this.selectedAccount = '';
    this.selectedRegion = '';
    this.selectedState = '';
    this.applyFilters();
  }

  getStateClass(state?: string): string {
    switch (state?.toLowerCase()) {
      case 'available': return 'state-available';
      case 'pending':   return 'state-pending';
      default:          return 'state-unknown';
    }
  }

  getVpcName(vpc: VPC): string {
    return vpc.tags?.['Name'] || vpc.vpcId;
  }

  trackByVpcId(_index: number, vpc: VPC): string {
    return vpc.vpcId;
  }
}
