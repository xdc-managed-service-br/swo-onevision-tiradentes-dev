// src/app/features/components/subnets/subnets.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { Subnet } from '../../../models/resource.model';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-subnets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './subnets.component.html',
  styleUrls: ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  subnets: Subnet[] = [];
  filteredSubnets: Subnet[] = [];
  loading = false;
  searchTerm = '';
  selectedAccount = '';
  selectedRegion = '';
  selectedState = '';
  selectedVpc = '';

  // Filtros únicos
  uniqueAccounts: string[] = [];
  uniqueRegions: string[] = [];
  uniqueStates: string[] = [];
  uniqueVpcs: string[] = [];

  ngOnInit() {
    this.loadSubnets();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadSubnets() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'Subnet' } }
      });

      const parseJson = <T>(val: unknown, fb: T): T => {
        if (Array.isArray(fb) && Array.isArray(val)) return val as T;
        if (typeof val === 'string' && val) { try { return JSON.parse(val) as T; } catch { return fb; } }
        return (val ?? fb) as T;
      };

      this.subnets = data.map((item: any) => ({
        id: item.id,
        resourceType: item.resourceType || '',
        accountId: item.accountId,
        accountName: item.accountName ?? '',
        region: item.region,
        lastUpdated: item.lastUpdated ?? '',

        subnetId: item.subnetId ?? '',
        vpcId: item.vpcId ?? '',
        cidrBlock: item.cidrBlockSubnet ?? '',      // conforme seu schema
        availabilityZone: item.availabilityZone ?? '',
        availabilityZoneId: item.availabilityZoneId ?? '',
        availableIpAddressCount: item.availableIpAddressCount ?? 0,
        mapPublicIpOnLaunch: item.mapPublicIpOnLaunch ?? false,
        subnetState: item.subnetState ?? '',
        tags: parseJson<Record<string, string>>(item.tags, {})
      }));

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading subnets:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [...new Set(
      this.subnets.map(s => s.accountName || s.accountId).filter((v): v is string => !!v)
    )];
    this.uniqueRegions = [...new Set(
      this.subnets.map(s => s.region).filter((v): v is string => !!v)
    )];
    this.uniqueStates = [...new Set(
      this.subnets.map(s => s.subnetState).filter((v): v is string => !!v)
    )];
    this.uniqueVpcs = [...new Set(
      this.subnets.map(s => s.vpcId).filter((v): v is string => !!v)
    )];
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredSubnets = this.subnets.filter(subnet => {
      const matchesSearch =
        !term ||
        subnet.subnetId.toLowerCase().includes(term) ||
        subnet.cidrBlock?.toLowerCase().includes(term) ||
        subnet.availabilityZone?.toLowerCase().includes(term) ||
        (subnet.tags && JSON.stringify(subnet.tags).toLowerCase().includes(term));

      const matchesAccount =
        !this.selectedAccount ||
        subnet.accountName === this.selectedAccount ||
        subnet.accountId === this.selectedAccount;

      const matchesRegion = !this.selectedRegion || subnet.region === this.selectedRegion;
      const matchesState = !this.selectedState || subnet.subnetState === this.selectedState;
      const matchesVpc = !this.selectedVpc || subnet.vpcId === this.selectedVpc;

      return matchesSearch && matchesAccount && matchesRegion && matchesState && matchesVpc;
    });
  }

  onSearchChange() { this.applyFilters(); }
  onFilterChange() { this.applyFilters(); }

  clearFilters() {
    this.searchTerm = '';
    this.selectedAccount = '';
    this.selectedRegion = '';
    this.selectedState = '';
    this.selectedVpc = '';
    this.applyFilters();
  }

  getStateClass(subnetState?: string): string {
    switch (subnetState?.toLowerCase()) {
      case 'available': return 'state-available';
      case 'pending':   return 'state-pending';
      default:          return 'state-unknown';
    }
  }

  getSubnetName(subnet: Subnet): string {
    return subnet.tags?.['Name'] || subnet.subnetId;
  }

  isPublicSubnet(subnet: Subnet): boolean {
    return !!subnet.mapPublicIpOnLaunch;
  }

  getPublicBadgeClass(subnet: Subnet): string {
    return this.isPublicSubnet(subnet) ? 'pub-yes' : 'pub-no';
  }

  trackBySubnetId(_index: number, subnet: Subnet): string {
    return subnet.subnetId;
  }
}
