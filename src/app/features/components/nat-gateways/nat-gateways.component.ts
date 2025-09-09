// src/app/features/components/nat-gateways/nat-gateways.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { Subject } from 'rxjs';
import { NATGateway } from '../../../models/resource.model';

@Component({
  selector: 'app-nat-gateways',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './nat-gateways.component.html',
  styleUrls: ['./nat-gateways.component.css']
})
export class NatGatewaysComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  natGateways: NATGateway[] = [];
  filteredNatGateways: NATGateway[] = [];
  loading = false;
  searchTerm = '';
  selectedAccount = '';
  selectedRegion = '';
  selectedState = '';
  
  uniqueAccounts: string[] = [];
  uniqueRegions: string[] = [];
  uniqueStates: string[] = [];

  ngOnInit() {
    this.loadNatGateways();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadNatGateways() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'NATGateway' } }
      });

      this.natGateways = data.map(item => ({
        id: item.id,
        resourceType: item.resourceType ?? '',
        accountId: item.accountId,
        accountName: item.accountName ?? '',
        region: item.region,
        lastUpdated: item.lastUpdated ?? '',
        vpcId: (item as any).vpcId ?? '',
        subnetId: (item as any).subnetId ?? '',

        natGatewayId: item.natGatewayId ?? '',
        natGatewayName: item.natGatewayName ?? '',
        state: item.natGatewayState ?? '',
        connectivityType: item.connectivityType ?? '',
      }));

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading NAT gateways:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [...new Set(this.natGateways.map(ngw => ngw.accountName || ngw.accountId))];
    this.uniqueRegions = [...new Set(this.natGateways.map(ngw => ngw.region))];
    this.uniqueStates = [
  ...new Set(this.natGateways.map(ngw => ngw.state).filter(s => s))
];
  }

  applyFilters() {
    this.filteredNatGateways = this.natGateways.filter(ngw => {
      const matchesSearch = !this.searchTerm || 
        ngw.natGatewayId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (ngw.tags && JSON.stringify(ngw.tags).toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      const matchesAccount = !this.selectedAccount || 
        ngw.accountName === this.selectedAccount || 
        ngw.accountId === this.selectedAccount;
      
      const matchesRegion = !this.selectedRegion || ngw.region === this.selectedRegion;
      const matchesState = !this.selectedState || ngw.state === this.selectedState;
      
      return matchesSearch && matchesAccount && matchesRegion && matchesState;
    });
  }

  getConnectivityClass(conn?: string): string {
    switch ((conn ?? '').toLowerCase()) {
      case 'public':  return 'conn-public';
      case 'private': return 'conn-private';
      default:        return 'conn-unknown';
    }
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

  getStateClass(state: string): string {
    switch (state?.toLowerCase()) {
      case 'available': return 'state-available';
      case 'pending': return 'state-pending';
      case 'failed': return 'state-failed';
      case 'deleting': return 'state-deleting';
      default: return 'state-unknown';
    }
  }

  getNatGatewayName(ngw: NATGateway): string {
    return ngw.tags?.['Name'] || ngw.natGatewayId;
  }

  trackByNatGatewayId(index: number, ngw: NATGateway): string {
    return ngw.natGatewayId;
  }
}