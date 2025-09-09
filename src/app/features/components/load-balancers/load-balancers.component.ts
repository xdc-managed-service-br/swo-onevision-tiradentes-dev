// src/app/features/components/load-balancers/load-balancers.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../../../../amplify/data/resource';
import { ElasticLoadBalancer } from '../../../models/resource.model';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-load-balancers',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './load-balancers.component.html',
  styleUrl: './load-balancers.component.css'
})


export class LoadBalancersComponent implements OnInit, OnDestroy {
  private client = generateClient<Schema>();
  private destroy$ = new Subject<void>();
  private getTypeFromArn(arn: string | null | undefined): 'application' | 'network' | 'gateway' | '' {
    if (!arn) return '';
    if (arn.includes('/app/')) return 'application';
    if (arn.includes('/net/')) return 'network';
    if (arn.includes('/gwy/')) return 'gateway';
    return '';
  }

  loadBalancers: ElasticLoadBalancer[] = [];
  filteredLoadBalancers: ElasticLoadBalancer[] = [];
  loading = false;
  searchTerm = '';
  selectedAccount = '';
  selectedRegion = '';
  selectedState = '';
  selectedType = '';
  selectedScheme = '';
  
  // Filtros únicos
  uniqueAccounts: string[] = [];
  uniqueRegions: string[] = [];
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];
  uniqueSchemes: string[] = [];

  ngOnInit() {
    this.loadLoadBalancers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @NgModule({
  declarations: [LoadBalancersComponent],
  imports: [CommonModule, FormsModule],
  providers: [DatePipe]
  })

  async loadLoadBalancers() {
    this.loading = true;
    try {
      const { data } = await this.client.models.AWSResource.list({
        filter: { resourceType: { eq: 'LoadBalancer' } }
      });

      this.loadBalancers = data.map(item => {
        // tags: segura tanto string quanto objeto
        const rawTags: unknown = (item as any).tags;
        const tags =
          typeof rawTags === 'string'
            ? (() => { try { return JSON.parse(rawTags); } catch { return {}; } })()
            : (rawTags ?? {});

        return {
          id: item.id,
          resourceType: item.resourceType || '',
          accountId: item.accountId,
          accountName: item.accountName || '',
          region: item.region,
          lastUpdated: item.lastUpdated || '',
          loadBalancerArn: item.loadBalancerArn || '',
          loadBalancerName: item.loadBalancerName || '',
          dnsName: item.dnsName ?? '',
          canonicalHostedZoneId: item.canonicalHostedZoneId || '',
          scheme: item.scheme || '',
          ipAddressType: item.ipAddressType || '',
          state: item.lbState || '',
          loadBalancerType: this.getTypeFromArn(item.loadBalancerArn),

          vpcId: (item as any).vpcId || '',   // se tiver no schema geral
          tags
        } as ElasticLoadBalancer;
      });

      this.extractUniqueValues();
      this.applyFilters();
    } catch (err) {
      console.error('Error loading load balancers:', err);
    } finally {
      this.loading = false;
    }
  }

  extractUniqueValues() {
    this.uniqueAccounts = [
      ...new Set(this.loadBalancers.map(lb => lb.accountName || lb.accountId).filter(Boolean))
    ];

    this.uniqueRegions = [
      ...new Set(this.loadBalancers.map(lb => lb.region).filter((r): r is string => !!r))
    ];

    this.uniqueStates = [
      ...new Set(this.loadBalancers.map(lb => lb.state).filter((s): s is string => !!s))
    ];

    this.uniqueTypes = [
      ...new Set(this.loadBalancers.map(lb => lb.loadBalancerType).filter((t): t is string => !!t))
    ];

    this.uniqueSchemes = [
      ...new Set(this.loadBalancers.map(lb => lb.scheme).filter((sc): sc is string => !!sc))
    ];
  }

  applyFilters() {
    this.filteredLoadBalancers = this.loadBalancers.filter(lb => {
      const matchesSearch = !this.searchTerm || 
        lb.loadBalancerName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        lb.dnsName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (lb.tags && JSON.stringify(lb.tags).toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      const matchesAccount = !this.selectedAccount || 
        lb.accountName === this.selectedAccount || 
        lb.accountId === this.selectedAccount;
      
      const matchesRegion = !this.selectedRegion || lb.region === this.selectedRegion;
      const matchesState = !this.selectedState || lb.state === this.selectedState;
      const matchesType = !this.selectedType || lb.loadBalancerType === this.selectedType;
      const matchesScheme = !this.selectedScheme || lb.scheme === this.selectedScheme;
      
      return matchesSearch && matchesAccount && matchesRegion && matchesState && matchesType && matchesScheme;
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
    this.selectedType = '';
    this.selectedScheme = '';
    this.applyFilters();
  }

  getStateClass(state: string): string {
    switch (state?.toLowerCase()) {
      case 'active':
        return 'state-active';
      case 'provisioning':
        return 'state-provisioning';
      case 'failed':
        return 'state-failed';
      default:
        return 'state-unknown';
    }
  }

  getTypeClass(type: string): string {
    switch (type?.toLowerCase()) {
      case 'application':
        return 'type-application';
      case 'network':
        return 'type-network';
      case 'gateway':
        return 'type-gateway';
      default:
        return 'type-unknown';
    }
  }

  getSchemeClass(scheme: string): string {
    switch (scheme?.toLowerCase()) {
      case 'internet-facing':
        return 'scheme-public';
      case 'internal':
        return 'scheme-internal';
      default:
        return 'scheme-unknown';
    }
  }

  truncateDnsName(dnsName: string): string {
    if (!dnsName) return 'N/A';
    return dnsName.length > 40 ? dnsName.substring(0, 40) + '...' : dnsName;
  }

  trackByLoadBalancerArn(index: number, lb: ElasticLoadBalancer): string {
    return lb.loadBalancerArn;
  }
}