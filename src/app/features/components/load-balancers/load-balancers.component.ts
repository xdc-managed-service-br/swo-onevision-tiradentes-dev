// src/app/features/components/load-balancers/load-balancers.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { LoadBalancer } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedLoadBalancer) => string;
}

type ColumnKey =
  | 'displayName'
  | 'loadBalancerArn'
  | 'dnsName'
  | 'type'
  | 'scheme'
  | 'ipAddressType'
  | 'state'
  | 'vpcId'
  | 'region'
  | 'accountName'
  | 'targetGroupCount'
  | 'securityGroupCount'
  | 'availabilityZoneCount'
  | 'createdAt'
  | 'updatedAt';

type NormalizedLoadBalancer = LoadBalancer & {
  displayName: string;
  dnsName?: string;
  type?: string;
  scheme?: string;
  ipAddressType?: string;
  state?: string;
  vpcId?: string;
  targetGroupsList: string[];
  targetGroupCount: number;
  securityGroupsList: string[];
  securityGroupCount: number;
  availabilityZonesList: string[];
  availabilityZoneCount: number;
};

@Component({
  selector: 'app-load-balancers',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './load-balancers.component.html'
})
export class LoadBalancersComponent implements OnInit, OnDestroy {
  resources: NormalizedLoadBalancer[] = [];
  filteredResources: NormalizedLoadBalancer[] = [];
  paginatedResources: NormalizedLoadBalancer[] = [];
  loading = true;
  selectedResource: NormalizedLoadBalancer | null = null;

  // Filters
  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  vpcFilter = '';
  typeFilter = '';
  schemeFilter = '';
  ipTypeFilter = '';
  stateFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueVpcs: string[] = [];
  uniqueTypes: string[] = [];
  uniqueSchemes: string[] = [];
  uniqueIpTypes: string[] = [];
  uniqueStates: string[] = [];

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Column customization
  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();
  private readonly requiredColumns: ColumnKey[] = ['displayName'];
  private readonly defaultColumns: ColumnKey[] = [
    'displayName',
    'loadBalancerArn',
    'type',
    'scheme',
    'ipAddressType',
    'state',
    'vpcId',
    'region',
    'accountName',
    'targetGroupCount',
    'securityGroupCount',
    'createdAt'
  ];

  private readonly columnMinWidths: Record<string, number> = {
    displayName: 200,
    loadBalancerArn: 220,
    dnsName: 220,
    type: 150,
    scheme: 150,
    ipAddressType: 160,
    state: 150,
    vpcId: 180,
    region: 140,
    accountName: 170,
    targetGroupCount: 160,
    securityGroupCount: 160,
    availabilityZoneCount: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  readonly availableColumns: ColumnDefinition[] = [
    {
      key: 'displayName',
      label: 'Name',
      sortable: true,
      transform: (resource) => resource.displayName
    },
    {
      key: 'loadBalancerArn',
      label: 'ARN',
      sortable: true
    },
    {
      key: 'dnsName',
      label: 'DNS Name',
      sortable: true
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.type)
    },
    {
      key: 'scheme',
      label: 'Scheme',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.scheme)
    },
    {
      key: 'ipAddressType',
      label: 'IP Type',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.ipAddressType)
    },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.state)
    },
    {
      key: 'vpcId',
      label: 'VPC',
      sortable: true
    },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (resource) => this.getAccountLabel(resource)
    },
    {
      key: 'targetGroupCount',
      label: 'Target Groups',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.targetGroupCount)
    },
    {
      key: 'securityGroupCount',
      label: 'Security Groups',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.securityGroupCount)
    },
    {
      key: 'availabilityZoneCount',
      label: 'Availability Zones',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.availabilityZoneCount)
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      transform: (resource) => this.formatDate(resource.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      transform: (resource) => this.formatDate(resource.updatedAt)
    }
  ];

  private readonly LS_KEY = 'load-balancers-columns';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {}

  ngOnInit(): void {
    this.selectedColumns = new Set(this.defaultColumns);
    this.loadColumnPreferences();
    this.loadResources();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Data loading ---------------------------------------------------------------
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('LoadBalancer')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as LoadBalancer[]) || []).map((item) => this.normalizeLoadBalancer(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueVpcs = this.buildUniqueList(this.resources.map((item) => item.vpcId));
          this.uniqueTypes = this.buildUniqueList(this.resources.map((item) => item.type));
          this.uniqueSchemes = this.buildUniqueList(this.resources.map((item) => item.scheme));
          this.uniqueIpTypes = this.buildUniqueList(this.resources.map((item) => item.ipAddressType));
          this.uniqueStates = this.buildUniqueList(this.resources.map((item) => item.state));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Load Balancers:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // Column customization -------------------------------------------------------
  openColumnCustomizer(): void { this.showColumnCustomizer = true; }
  closeColumnCustomizer(): void { this.showColumnCustomizer = false; }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((column) => this.selectedColumns.has(column.key));
  }

  toggleColumn(key: ColumnKey): void {
    if (this.requiredColumns.includes(key)) return;
    if (this.selectedColumns.has(key)) {
      this.selectedColumns.delete(key);
    } else {
      this.selectedColumns.add(key);
    }
  }

  isColumnSelected(key: ColumnKey): boolean {
    return this.selectedColumns.has(key);
  }

  isRequiredColumn(key: ColumnKey): boolean {
    return this.requiredColumns.includes(key);
  }

  selectAllColumns(): void {
    this.availableColumns.forEach((column) => this.selectedColumns.add(column.key));
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach((column) => this.selectedColumns.add(column));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save Load Balancer column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length) {
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((column) => this.selectedColumns.add(column));
      }
    } catch (error) {
      console.warn('Could not load Load Balancer column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // Filters -------------------------------------------------------------------
  searchLoadBalancers(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  filterByRegion(event: Event): void {
    this.regionFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAccount(event: Event): void {
    this.accountFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByVpc(event: Event): void {
    this.vpcFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByType(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByScheme(event: Event): void {
    this.schemeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByIpType(event: Event): void {
    this.ipTypeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByState(event: Event): void {
    this.stateFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.vpcFilter = '';
    this.typeFilter = '';
    this.schemeFilter = '';
    this.ipTypeFilter = '';
    this.stateFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('loadBalancerSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    this.filteredResources = [...this.resources];
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.updatePaginationAfterChange();
    }
  }

  private applyFilters(): void {
    const term = this.searchTerm;
    this.filteredResources = this.resources.filter((resource) => {
      if (term) {
        const haystack = [
          resource.displayName,
          resource.loadBalancerName,
          resource.loadBalancerArn,
          resource.dnsName,
          resource.vpcId,
          this.getAccountLabel(resource)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.vpcFilter && (resource.vpcId || '') !== this.vpcFilter) return false;
      if (this.typeFilter && (resource.type || '').toLowerCase() !== this.typeFilter.toLowerCase()) return false;
      if (this.schemeFilter && (resource.scheme || '').toLowerCase() !== this.schemeFilter.toLowerCase()) return false;
      if (this.ipTypeFilter && (resource.ipAddressType || '').toLowerCase() !== this.ipTypeFilter.toLowerCase()) return false;
      if (this.stateFilter && (resource.state || '').toLowerCase() !== this.stateFilter.toLowerCase()) return false;

      return true;
    });

    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.updatePaginationAfterChange();
    }
  }

  // Sorting --------------------------------------------------------------------
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);

      if (valueA === valueB) return 0;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * dir;
      }

      const stringA = String(valueA ?? '').toLowerCase();
      const stringB = String(valueB ?? '').toLowerCase();
      return stringA.localeCompare(stringB) * dir;
    });

    this.updatePaginationAfterChange();
  }

  private getSortValue(resource: NormalizedLoadBalancer, column: ColumnKey): string | number {
    switch (column) {
      case 'targetGroupCount':
        return resource.targetGroupCount;
      case 'securityGroupCount':
        return resource.securityGroupCount;
      case 'availabilityZoneCount':
        return resource.availabilityZoneCount;
      case 'accountName':
        return this.getAccountLabel(resource).toLowerCase();
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      default: {
        const value = (resource as any)[column];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return value;
        return value ? 1 : 0;
      }
    }
  }

  // Pagination -----------------------------------------------------------------
  recomputePagination(): void {
    const total = this.filteredResources.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = this.filteredResources.slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  updatePaginationAfterChange(): void {
    this.currentPage = 1;
    this.recomputePagination();
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages);
    if (target !== this.currentPage) {
      this.currentPage = target;
      this.recomputePagination();
    }
  }

  goToFirstPage(): void {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.recomputePagination();
    }
  }

  goToLastPage(): void {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.recomputePagination();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.recomputePagination();
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.recomputePagination();
    }
  }

  // Detail modal ---------------------------------------------------------------
  showDetails(resource: NormalizedLoadBalancer): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // View helpers ----------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedLoadBalancer): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return this.formatBoolean(value);
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getStateClass(resource: NormalizedLoadBalancer): string {
    const state = (resource.state || '').toLowerCase();
    switch (state) {
      case 'active':
      case 'provisioning':
        return 'status-running';
      case 'failed':
      case 'deleted':
      case 'inactive':
        return 'status-stopped';
      case 'pending':
      case 'modifying':
        return 'status-warning';
      default:
        return 'status-neutral';
    }
  }

  getAccountLabel(resource: LoadBalancer): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  formatList(list: string[]): string {
    if (!list.length) return 'None';
    return list.join(', ');
  }

  formatTitle(value?: string): string {
    if (!value) return 'N/A';
    const cleaned = value.replace(/_/g, ' ').toLowerCase();
    return cleaned
      .replace(/\b[a-z]/g, (char) => char.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  }

  formatBoolean(value: boolean | undefined | null): string {
    return value ? 'Yes' : 'No';
  }

  formatNumber(value: number | undefined | null): string {
    const num = typeof value === 'number' ? value : 0;
    try {
      return new Intl.NumberFormat().format(num);
    } catch {
      return String(num);
    }
  }

  // Normalization --------------------------------------------------------------
  private normalizeLoadBalancer(item: LoadBalancer | any): NormalizedLoadBalancer {
    const displayName =
      item?.loadBalancerNameTag ||
      item?.loadBalancerName ||
      item?.name ||
      this.extractNameFromTags(item?.tags) ||
      'Unnamed Load Balancer';

    const normalized: NormalizedLoadBalancer = {
      ...item,
      displayName,
      dnsName: item?.dnsName || item?.DNSName,
      type: item?.type || item?.loadBalancerType,
      scheme: item?.scheme || item?.Scheme,
      ipAddressType: item?.ipAddressType || item?.ipType,
      state: item?.state || item?.State || item?.status,
      vpcId: item?.vpcId || item?.vpcID || item?.vpc,
      targetGroupsList: this.normalizeStringArray(item?.targetGroups ?? item?.targetGroupArns ?? item?.targetGroupNames),
      targetGroupCount: 0,
      securityGroupsList: this.normalizeStringArray(item?.securityGroups ?? item?.securityGroupIds ?? item?.securityGroupArns),
      securityGroupCount: 0,
      availabilityZonesList: this.normalizeAvailabilityZones(item?.availabilityZones ?? item?.AvailabilityZones ?? item?.zones),
      availabilityZoneCount: 0
    } as NormalizedLoadBalancer;

    normalized.targetGroupCount = normalized.targetGroupsList.length;
    normalized.securityGroupCount = normalized.securityGroupsList.length;
    normalized.availabilityZoneCount = normalized.availabilityZonesList.length;

    return normalized;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!value) return [];

    const pushString = (input: string, target: string[]): void => {
      const trimmed = input.trim();
      if (trimmed) target.push(trimmed);
    };

    const result: string[] = [];

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          pushString(entry, result);
        } else if (entry && typeof entry === 'object') {
          const candidate =
            entry.name || entry.arn || entry.id || entry.targetGroupArn || entry.securityGroupId || entry.SecurityGroupId;
          if (typeof candidate === 'string') pushString(candidate, result);
        }
      });
      return [...new Set(result)];
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeStringArray(parsed);
        } catch {
          // fall through to simple split
        }
      }
      trimmed.split(/[;,]/).forEach((part) => pushString(part, result));
      return [...new Set(result)];
    }

    if (typeof value === 'object') {
      const candidate = (value as any).name || (value as any).arn || (value as any).id;
      if (typeof candidate === 'string') pushString(candidate, result);
    }

    return [...new Set(result)];
  }

  private normalizeAvailabilityZones(value: unknown): string[] {
    if (!value) return [];

    const zones: string[] = [];

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          if (trimmed) zones.push(trimmed);
          return;
        }
        if (entry && typeof entry === 'object') {
          const zone = entry.zoneName || entry.ZoneName || entry.availabilityZone || entry.AvailabilityZone;
          const subnet = entry.subnetId || entry.SubnetId;
          const text = zone || subnet;
          if (typeof text === 'string' && text.trim().length) zones.push(text.trim());
        }
      });
      return [...new Set(zones)];
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeAvailabilityZones(parsed);
        } catch {
          // fallback to splitting
        }
      }
      return [...new Set(trimmed.split(/[;,]/).map((part) => part.trim()).filter(Boolean))];
    }

    if (typeof value === 'object') {
      const zone = (value as any).zoneName || (value as any).availabilityZone;
      if (typeof zone === 'string' && zone.trim().length) return [zone.trim()];
    }

    return [];
  }

  private extractNameFromTags(tags: any): string | undefined {
    if (!tags || typeof tags !== 'object') return undefined;
    const name = tags.Name || tags.name || tags.NAME;
    return typeof name === 'string' && name.trim().length ? name : undefined;
  }

  private buildUniqueList(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))].sort();
  }

  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedLoadBalancer) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'load-balancers.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedLoadBalancer) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'load-balancers.xlsx');
  }
}
