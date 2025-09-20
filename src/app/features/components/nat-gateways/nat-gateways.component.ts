// src/app/features/components/nat-gateways/nat-gateways.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { NATGateway } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedNatGateway) => string;
}

type ColumnKey =
  | 'natGatewayName'
  | 'natGatewayId'
  | 'state'
  | 'natGatewayType'
  | 'connectivityType'
  | 'vpcId'
  | 'subnetId'
  | 'publicIp'
  | 'privateIp'
  | 'elasticIpAllocationId'
  | 'addressSummary'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

type AttachmentFilter = '' | 'attached' | 'detached';
type ConnectivityFilter = '' | 'public' | 'private';

type NormalizedNatGateway = NATGateway & {
  normalizedAddresses: NatGatewayAddress[];
  primaryPublicIp?: string;
  primaryPrivateIp?: string;
  primaryAllocationId?: string;
  addressSummary?: string;
};

interface NatGatewayAddress {
  publicIp?: string;
  privateIp?: string;
  allocationId?: string;
  networkInterfaceId?: string;
}

@Component({
  selector: 'app-nat-gateways',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './nat-gateways.component.html'
})
export class NatGatewaysComponent implements OnInit, OnDestroy {
  resources: NormalizedNatGateway[] = [];
  filteredResources: NormalizedNatGateway[] = [];
  paginatedResources: NormalizedNatGateway[] = [];
  loading = true;
  selectedResource: NormalizedNatGateway | null = null;

  // Filters
  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  stateFilter = '';
  connectivityFilter: ConnectivityFilter = '';
  attachmentFilter: AttachmentFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueStates: string[] = [];
  uniqueConnectivity: string[] = [];

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
  private readonly requiredColumns: ColumnKey[] = ['natGatewayId'];
  private readonly defaultColumns: ColumnKey[] = [
    'natGatewayName',
    'natGatewayId',
    'state',
    'natGatewayType',
    'connectivityType',
    'vpcId',
    'subnetId',
    'addressSummary',
    'region',
    'accountName',
    'createdAt'
  ];

  private readonly columnMinWidths: Record<string, number> = {
    natGatewayName: 200,
    natGatewayId: 180,
    state: 150,
    natGatewayType: 170,
    connectivityType: 170,
    vpcId: 180,
    subnetId: 180,
    publicIp: 170,
    privateIp: 170,
    elasticIpAllocationId: 200,
    addressSummary: 220,
    region: 140,
    accountName: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  readonly availableColumns: ColumnDefinition[] = [
    {
      key: 'natGatewayName',
      label: 'Name',
      sortable: true,
      transform: (resource) => resource.natGatewayName || 'Unnamed NAT Gateway'
    },
    { key: 'natGatewayId', label: 'Gateway ID', sortable: true },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      transform: (resource) => resource.state ? this.formatCapitalized(resource.state) : 'Unknown'
    },
    {
      key: 'natGatewayType',
      label: 'Type',
      sortable: true,
      transform: (resource) => resource.natGatewayType ? this.formatCapitalized(resource.natGatewayType) : 'N/A'
    },
    {
      key: 'connectivityType',
      label: 'Connectivity',
      sortable: true,
      transform: (resource) => resource.connectivityType ? this.formatCapitalized(resource.connectivityType) : 'N/A'
    },
    { key: 'vpcId', label: 'VPC', sortable: true },
    { key: 'subnetId', label: 'Subnet', sortable: true },
    {
      key: 'publicIp',
      label: 'Public IP',
      sortable: true,
      transform: (resource) => resource.primaryPublicIp || resource.publicIp || 'N/A'
    },
    {
      key: 'privateIp',
      label: 'Private IP',
      sortable: true,
      transform: (resource) => resource.primaryPrivateIp || resource.privateIp || 'N/A'
    },
    {
      key: 'elasticIpAllocationId',
      label: 'Elastic IP Allocation',
      sortable: true,
      transform: (resource) => resource.primaryAllocationId || resource.elasticIpAllocationId || 'N/A'
    },
    {
      key: 'addressSummary',
      label: 'Elastic IPs',
      sortable: false,
      transform: (resource) => resource.addressSummary || 'No Elastic IPs'
    },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (resource) => this.getAccountLabel(resource)
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

  private readonly LS_KEY = 'nat-gateways-columns';
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

  // Data loading ----------------------------------------------------------------
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('NATGateway')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as NATGateway[]) || []).map((item) => this.normalizeNatGateway(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueStates = this.buildUniqueList(this.resources.map((item) => item.state));
          this.uniqueConnectivity = this.buildUniqueList(this.resources.map((item) => item.connectivityType));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading NAT Gateways:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // Column customizer -----------------------------------------------------------
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
      console.warn('Could not save NAT Gateway column preferences:', error);
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
      console.warn('Could not load NAT Gateway column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // Filters ---------------------------------------------------------------------
  searchGateways(event: Event): void {
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

  filterByState(event: Event): void {
    this.stateFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByConnectivity(event: Event): void {
    this.connectivityFilter = (event.target as HTMLSelectElement).value as ConnectivityFilter;
    this.applyFilters();
  }

  filterByAttachmentState(event: Event): void {
    this.attachmentFilter = (event.target as HTMLSelectElement).value as AttachmentFilter;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.stateFilter = '';
    this.connectivityFilter = '';
    this.attachmentFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('natGatewaySearch') as HTMLInputElement | null;
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
          resource.natGatewayId,
          resource.natGatewayName,
          resource.vpcId,
          resource.subnetId,
          resource.primaryPublicIp,
          resource.primaryPrivateIp,
          resource.primaryAllocationId,
          this.getAccountLabel(resource),
          resource.addressSummary
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.stateFilter && (resource.state || '').toLowerCase() !== this.stateFilter.toLowerCase()) return false;
      if (this.connectivityFilter && (resource.connectivityType || '').toLowerCase() !== this.connectivityFilter.toLowerCase()) return false;

      const attachmentCount = this.getAttachmentCount(resource);
      if (this.attachmentFilter === 'attached' && attachmentCount === 0) return false;
      if (this.attachmentFilter === 'detached' && attachmentCount > 0) return false;

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

  private getSortValue(resource: NormalizedNatGateway, column: ColumnKey): string | number {
    switch (column) {
      case 'state':
        return resource.state ? resource.state.toLowerCase() : '';
      case 'natGatewayType':
        return resource.natGatewayType ? resource.natGatewayType.toLowerCase() : '';
      case 'connectivityType':
        return resource.connectivityType ? resource.connectivityType.toLowerCase() : '';
      case 'publicIp':
        return resource.primaryPublicIp || resource.publicIp || '';
      case 'privateIp':
        return resource.primaryPrivateIp || resource.privateIp || '';
      case 'elasticIpAllocationId':
        return resource.primaryAllocationId || resource.elasticIpAllocationId || '';
      case 'addressSummary':
        return resource.addressSummary || '';
      case 'accountName':
        return this.getAccountLabel(resource).toLowerCase();
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      default: {
        const value = resource[column];
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
  showDetails(resource: NormalizedNatGateway): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // View helpers ----------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedNatGateway): string {
    if (column.transform) return column.transform(resource);
    const value = resource[column.key as keyof NormalizedNatGateway];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getStateClass(resource: NormalizedNatGateway): string {
    const state = (resource.state || '').toLowerCase();
    switch (state) {
      case 'available':
        return 'status-running';
      case 'pending':
      case 'pending-connectivity':
        return 'status-warning';
      case 'deleting':
      case 'deleted':
      case 'failed':
        return 'status-stopped';
      default:
        return 'status-neutral';
    }
  }

  getAttachmentCount(resource: NormalizedNatGateway): number {
    return resource.normalizedAddresses.length;
  }

  getAttachmentLabel(resource: NormalizedNatGateway): string {
    const count = this.getAttachmentCount(resource);
    return count > 0 ? `${count} Elastic IP${count > 1 ? 's' : ''}` : 'No Elastic IPs';
  }

  getAccountLabel(resource: NATGateway): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  // Exports ---------------------------------------------------------------------
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedNatGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'nat-gateways.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedNatGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'nat-gateways.xlsx');
  }

  // Normalization ---------------------------------------------------------------
  private normalizeNatGateway(item: NATGateway | any): NormalizedNatGateway {
    const resource: NormalizedNatGateway = {
      ...item,
      normalizedAddresses: []
    } as NormalizedNatGateway;

    resource.natGatewayName = resource.natGatewayName || item?.name || this.extractNameFromTags(resource.tags);
    resource.state = resource.state || item?.status || item?.natGatewayState;
    resource.natGatewayType = resource.natGatewayType || item?.type || item?.natType;
    resource.connectivityType = resource.connectivityType || item?.natGatewayConnectivityType || item?.connectivity;
    resource.vpcId = resource.vpcId || item?.vpc || item?.vpcID; // fallback variations
    resource.subnetId = resource.subnetId || item?.subnet || item?.subnetID;

    const addresses = this.normalizeNatAddresses(
      item?.natGatewayAddresses ?? item?.natGatewayAddress ?? item?.addresses ?? item?.natGatewayAddressesJson
    );

    resource.normalizedAddresses = addresses;
    resource.primaryPublicIp = resource.publicIp || addresses.find((addr) => addr.publicIp)?.publicIp;
    resource.primaryPrivateIp = resource.privateIp || addresses.find((addr) => addr.privateIp)?.privateIp;
    resource.primaryAllocationId = resource.elasticIpAllocationId || addresses.find((addr) => addr.allocationId)?.allocationId;
    resource.addressSummary = addresses.length ? addresses.map((addr) => this.formatAddressSummary(addr)).join(', ') : 'No Elastic IPs';

    if (!resource.elasticIpAllocationId && resource.primaryAllocationId) {
      resource.elasticIpAllocationId = resource.primaryAllocationId;
    }
    if (!resource.publicIp && resource.primaryPublicIp) {
      resource.publicIp = resource.primaryPublicIp;
    }
    if (!resource.privateIp && resource.primaryPrivateIp) {
      resource.privateIp = resource.primaryPrivateIp;
    }

    const networkInterfaces = this.normalizeNetworkInterfaces(item?.networkInterfaceIds ?? item?.networkInterfaces);
    if (networkInterfaces.length) {
      resource.networkInterfaceIds = networkInterfaces;
    }

    return resource;
  }

  private normalizeNatAddresses(value: unknown): NatGatewayAddress[] {
    if (!value) return [];

    const parseAddress = (input: any): NatGatewayAddress | null => {
      if (!input || typeof input !== 'object') return null;
      const address: NatGatewayAddress = {
        publicIp: input.publicIp || input.PublicIp || input.publicIP,
        privateIp: input.privateIp || input.PrivateIp || input.privateIP,
        allocationId: input.allocationId || input.AllocationId || input.allocationID || input.eipAllocationId,
        networkInterfaceId: input.networkInterfaceId || input.NetworkInterfaceId || input.networkInterfaceID
      };

      if (!address.publicIp && typeof input === 'object' && 'ip' in input) {
        address.publicIp = input.ip;
      }

      const hasAny = address.publicIp || address.privateIp || address.allocationId;
      return hasAny ? address : null;
    };

    if (Array.isArray(value)) {
      const flattened: NatGatewayAddress[] = [];
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          flattened.push({ publicIp: entry });
          return;
        }
        const parsed = parseAddress(entry);
        if (parsed) flattened.push(parsed);
      });
      return flattened;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeNatAddresses(parsed);
        } catch (error) {
          console.warn('Could not parse NAT Gateway addresses JSON string:', error);
        }
      }

      return trimmed.split(/[;,]/).map((part) => ({ publicIp: part.trim() })).filter((addr) => addr.publicIp);
    }

    if (typeof value === 'object') {
      const parsed = parseAddress(value);
      return parsed ? [parsed] : [];
    }

    return [];
  }

  private normalizeNetworkInterfaces(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            return entry.id || entry.networkInterfaceId || entry.NetworkInterfaceId || entry.resourceId;
          }
          return undefined;
        })
        .filter((id): id is string => !!id && id.trim().length > 0);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeNetworkInterfaces(parsed);
        } catch {
          return [trimmed];
        }
      }
      return trimmed.split(/[;,]/).map((part) => part.trim()).filter((id) => id.length > 0);
    }
    if (typeof value === 'object') {
      const id = (value as any).id || (value as any).networkInterfaceId;
      return id ? [id] : [];
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

  private formatAddressSummary(address: NatGatewayAddress): string {
    const parts: string[] = [];
    if (address.publicIp) parts.push(address.publicIp);
    if (address.allocationId) parts.push(`(${address.allocationId})`);
    if (!parts.length && address.privateIp) parts.push(address.privateIp);
    return parts.join(' ');
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  }

  formatCapitalized(value: string): string {
    if (!value) return 'N/A';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}
