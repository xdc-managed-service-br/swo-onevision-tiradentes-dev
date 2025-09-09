// src/app/features/components/internet-gateways/internet-gateways.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { InternetGateway } from '../../../models/resource.model';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-internet-gateways',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './internet-gateways.component.html',
  styleUrls: ['./internet-gateways.component.css']
})

export class InternetGatewaysComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();

  internetGateways: InternetGateway[] = [];
  filteredInternetGateways: InternetGateway[] = [];
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
    this.loadInternetGateways();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadInternetGateways() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: {
          resourceType: { eq: 'InternetGateway' }
        }
      });

      this.internetGateways = data.map(item => ({
        id: item.id,
        resourceType: item.resourceType || '',
        accountId: item.accountId,
        accountName: item.accountName || '',
        region: item.region,
        lastUpdated: item.lastUpdated || '',
        internetGatewayId: item.internetGatewayId || '',
        internetGatewayName: item.internetGatewayName || '',
        attachedVpcs: item.attachedVpcs ? JSON.parse(item.attachedVpcs as string) : [],
        attachmentCount: item.attachmentCount || 0,
        tags: item.tags ? JSON.parse(item.tags as string) : {}
      }));

      this.extractUniqueValues();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading internet gateways:', error);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [...new Set(this.internetGateways.map(igw => igw.accountName || igw.accountId).filter(Boolean))];
    this.uniqueRegions = [...new Set(this.internetGateways.map(igw => igw.region).filter(Boolean))];
  }

  applyFilters() {
    this.filteredInternetGateways = this.internetGateways.filter(igw => {
      const matchesSearch = !this.searchTerm || 
        igw.internetGatewayId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (igw.tags && JSON.stringify(igw.tags).toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      const matchesAccount = !this.selectedAccount || 
        igw.accountName === this.selectedAccount || 
        igw.accountId === this.selectedAccount;
      
      const matchesRegion = !this.selectedRegion || igw.region === this.selectedRegion;
      
      return matchesSearch && matchesAccount && matchesRegion;
    });
  }

  onSearchChange() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedAccount = '';
    this.selectedRegion = '';
    this.selectedState = '';
    this.applyFilters();
  }

  getStateClass(state: string): string {
    switch (state?.toLowerCase()) {
      case 'available':
        return 'state-available';
      case 'attached':
        return 'state-attached';
      case 'detached':
        return 'state-detached';
      case 'attaching':
        return 'state-attaching';
      case 'detaching':
        return 'state-detaching';
      default:
        return 'state-unknown';
    }
  }

  getInternetGatewayName(igw: InternetGateway): string {
    return igw.internetGatewayName || igw.tags?.['Name'] || igw.internetGatewayId;
  }

  getAttachedVpcs(igw: InternetGateway): string[] {
    return igw.attachedVpcs || [];
  }

  getAttachmentCount(igw: InternetGateway): number {
    return igw.attachmentCount || 0;
  }

  trackByInternetGatewayId(index: number, igw: InternetGateway): string {
    return igw.internetGatewayId;
  }
}