import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { TransitGateway } from '../../../models/resource.model';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-transit-gateways',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './transit-gateways.component.html',
  styleUrls: ['./transit-gateways.component.css']
})
export class TransitGatewaysComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  transitGateways: TransitGateway[] = [];
  filteredTransitGateways: TransitGateway[] = [];
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
    this.loadTransitGateways();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadTransitGateways() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'TransitGateway' } }
      });

      const parseJson = <T>(val: unknown, fb: T): T => {
        if (Array.isArray(fb) && Array.isArray(val)) return val as T;
        if (typeof val === 'string' && val) {
          try { return JSON.parse(val) as T; } catch { return fb; }
        }
        return (val ?? fb) as T;
      };

      this.transitGateways = data.map((item: any) => ({
        id: item.id,
        resourceType: item.resourceType || '',
        accountId: item.accountId,
        accountName: item.accountName ?? '',
        region: item.region,
        lastUpdated: item.lastUpdated ?? '',

        transitGatewayId: item.transitGatewayId ?? '',
        transitGatewayArn: item.transitGatewayArn ?? '',
        amazonSideAsn: item.amazonSideAsn64 ?? 0,

        autoAcceptSharedAttachments: item.autoAcceptSharedAttachments ?? '',
        defaultRouteTableAssociation: item.defaultRouteTableAssociation ?? '',
        defaultRouteTablePropagation: item.defaultRouteTablePropagation ?? '',

        state: item.state ?? '',
        tags: parseJson<Record<string, string>>(item.tags, {})
      }));

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading transit gateways:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [
      ...new Set(this.transitGateways.map(tgw => tgw.accountName || tgw.accountId).filter((v): v is string => !!v))
    ];
    this.uniqueRegions = [
      ...new Set(this.transitGateways.map(tgw => tgw.region).filter((v): v is string => !!v))
    ];
    this.uniqueStates = [
      ...new Set(this.transitGateways.map(tgw => tgw.state).filter((v): v is string => !!v))
    ];
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredTransitGateways = this.transitGateways.filter(tgw => {
      const matchesSearch =
        !term ||
        tgw.transitGatewayId.toLowerCase().includes(term) ||
        (tgw.tags && JSON.stringify(tgw.tags).toLowerCase().includes(term));

      const matchesAccount =
        !this.selectedAccount ||
        tgw.accountName === this.selectedAccount ||
        tgw.accountId === this.selectedAccount;

      const matchesRegion = !this.selectedRegion || tgw.region === this.selectedRegion;
      const matchesState = !this.selectedState || tgw.state === this.selectedState;

      return matchesSearch && matchesAccount && matchesRegion && matchesState;
    });
  }

  onSearchChange() { this.applyFilters(); }
  onFilterChange() { this.applyFilters(); }

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
      case 'modifying': return 'state-modifying';
      case 'deleting':  return 'state-deleting';
      case 'deleted':   return 'state-deleted';
      default:          return 'state-unknown';
    }
  }

  getTransitGatewayName(tgw: TransitGateway): string {
    return tgw.tags?.['Name'] || tgw.transitGatewayId;
  }

  getSettingClass(setting?: string): string {
    switch (setting?.toLowerCase()) {
      case 'enable':  // alguns retornam 'enable'
      case 'enabled': // outros 'enabled'
        return 'setting-enabled';
      case 'disable':
      case 'disabled':
        return 'setting-disabled';
      default:
        return 'setting-unknown';
    }
  }

  trackByTransitGatewayId(_index: number, tgw: TransitGateway): string {
    return tgw.transitGatewayId;
  }
}
