// src/app/features/components/transit-gateways/transit-gateways.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { TransitGateway } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedTransitGateway) => string;
}

type ColumnKey =
  | 'displayName'
  | 'transitGatewayId'
  | 'amazonSideAsn'
  | 'ownerId'
  | 'defaultRouteTableAssociation'
  | 'defaultRouteTablePropagation'
  | 'dnsSupport'
  | 'multicastSupport'
  | 'vpnEcmpSupport'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

type NormalizedTransitGateway = TransitGateway & {
  displayName: string;
  transitGatewayId: string;
  ownerId?: string;
  amazonSideAsn?: number;
  defaultRouteTableAssociation?: string;
  defaultRouteTablePropagation?: string;
  dnsSupport?: string;
  multicastSupport?: string;
  vpnEcmpSupport?: string;
};

@Component({
  selector: 'app-transit-gateways',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './transit-gateways.component.html'
})
export class TransitGatewaysComponent implements OnInit, OnDestroy {
  resources: NormalizedTransitGateway[] = [];
  filteredResources: NormalizedTransitGateway[] = [];
  paginatedResources: NormalizedTransitGateway[] = [];
  loading = true;
  selectedResource: NormalizedTransitGateway | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  associationFilter = '';
  propagationFilter = '';
  dnsFilter = '';
  multicastFilter = '';
  vpnFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueAssociationStates: string[] = [];
  uniquePropagationStates: string[] = [];
  uniqueDnsStates: string[] = [];
  uniqueMulticastStates: string[] = [];
  uniqueVpnStates: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();
  private readonly requiredColumns: ColumnKey[] = ['transitGatewayId'];
  private readonly defaultColumns: ColumnKey[] = [
    'displayName',
    'transitGatewayId',
    'amazonSideAsn',
    'ownerId',
    'defaultRouteTableAssociation',
    'defaultRouteTablePropagation',
    'dnsSupport',
    'multicastSupport',
    'vpnEcmpSupport',
    'region',
    'accountName',
    'createdAt'
  ];

  private readonly columnMinWidths: Record<string, number> = {
    displayName: 200,
    transitGatewayId: 190,
    amazonSideAsn: 150,
    ownerId: 170,
    defaultRouteTableAssociation: 220,
    defaultRouteTablePropagation: 220,
    dnsSupport: 160,
    multicastSupport: 160,
    vpnEcmpSupport: 160,
    region: 140,
    accountName: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  readonly availableColumns: ColumnDefinition[] = [
    { key: 'displayName', label: 'Name', sortable: true, transform: (r) => r.displayName },
    { key: 'transitGatewayId', label: 'Transit Gateway ID', sortable: true },
    {
      key: 'amazonSideAsn',
      label: 'Amazon ASN',
      sortable: true,
      transform: (r) => (r.amazonSideAsn != null ? String(r.amazonSideAsn) : 'N/A')
    },
    { key: 'ownerId', label: 'Owner Account', sortable: true, transform: (r) => r.ownerId || 'N/A' },
    {
      key: 'defaultRouteTableAssociation',
      label: 'Default Association',
      sortable: true,
      transform: (r) => this.formatTitle(r.defaultRouteTableAssociation)
    },
    {
      key: 'defaultRouteTablePropagation',
      label: 'Default Propagation',
      sortable: true,
      transform: (r) => this.formatTitle(r.defaultRouteTablePropagation)
    },
    {
      key: 'dnsSupport',
      label: 'DNS Support',
      sortable: true,
      transform: (r) => this.formatTitle(r.dnsSupport)
    },
    {
      key: 'multicastSupport',
      label: 'Multicast',
      sortable: true,
      transform: (r) => this.formatTitle(r.multicastSupport)
    },
    {
      key: 'vpnEcmpSupport',
      label: 'VPN ECMP',
      sortable: true,
      transform: (r) => this.formatTitle(r.vpnEcmpSupport)
    },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (r) => this.getAccountLabel(r)
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      transform: (r) => this.formatDate(r.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      transform: (r) => this.formatDate(r.updatedAt)
    }
  ];

  private readonly LS_KEY = 'transit-gateways-columns';
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

  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('TransitGateway')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as TransitGateway[]) || []).map((item) => this.normalizeTransitGateway(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueAssociationStates = this.buildUniqueList(this.resources.map((item) => item.defaultRouteTableAssociation));
          this.uniquePropagationStates = this.buildUniqueList(this.resources.map((item) => item.defaultRouteTablePropagation));
          this.uniqueDnsStates = this.buildUniqueList(this.resources.map((item) => item.dnsSupport));
          this.uniqueMulticastStates = this.buildUniqueList(this.resources.map((item) => item.multicastSupport));
          this.uniqueVpnStates = this.buildUniqueList(this.resources.map((item) => item.vpnEcmpSupport));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Transit Gateways:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // Column customizer ---------------------------------------------------------
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
      console.warn('Could not save Transit Gateway column preferences:', error);
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
      console.warn('Could not load Transit Gateway column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // Filters -------------------------------------------------------------------
  searchTransitGateways(event: Event): void {
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

  filterByAssociation(event: Event): void {
    this.associationFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByPropagation(event: Event): void {
    this.propagationFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByDns(event: Event): void {
    this.dnsFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByMulticast(event: Event): void {
    this.multicastFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByVpn(event: Event): void {
    this.vpnFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.associationFilter = '';
    this.propagationFilter = '';
    this.dnsFilter = '';
    this.multicastFilter = '';
    this.vpnFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('transitGatewaySearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    this.resetSelectElement('transitGatewayRegionFilter');
    this.resetSelectElement('transitGatewayAccountFilter');
    this.resetSelectElement('transitGatewayAssociationFilter');
    this.resetSelectElement('transitGatewayPropagationFilter');
    this.resetSelectElement('transitGatewayDnsFilter');
    this.resetSelectElement('transitGatewayMulticastFilter');
    this.resetSelectElement('transitGatewayVpnFilter');

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
          resource.transitGatewayId,
          resource.ownerId,
          this.getAccountLabel(resource)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.associationFilter && (resource.defaultRouteTableAssociation || '') !== this.associationFilter) return false;
      if (this.propagationFilter && (resource.defaultRouteTablePropagation || '') !== this.propagationFilter) return false;
      if (this.dnsFilter && (resource.dnsSupport || '') !== this.dnsFilter) return false;
      if (this.multicastFilter && (resource.multicastSupport || '') !== this.multicastFilter) return false;
      if (this.vpnFilter && (resource.vpnEcmpSupport || '') !== this.vpnFilter) return false;

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

  private getSortValue(resource: NormalizedTransitGateway, column: ColumnKey): string | number {
    switch (column) {
      case 'amazonSideAsn':
        return resource.amazonSideAsn ?? 0;
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
  showDetails(resource: NormalizedTransitGateway): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // Export ---------------------------------------------------------------------
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedTransitGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'transit-gateways.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedTransitGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'transit-gateways.xlsx');
  }

  // Helpers --------------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedTransitGateway): string {
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

  getStateClass(resource: NormalizedTransitGateway): string {
    const state = (resource.defaultRouteTableAssociation || '').toLowerCase();
    switch (state) {
      case 'enable':
      case 'enabled':
        return 'status-running';
      case 'disable':
      case 'disabled':
        return 'status-stopped';
      default:
        return 'status-neutral';
    }
  }

  getAccountLabel(resource: TransitGateway): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
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

  private normalizeTransitGateway(item: TransitGateway | any): NormalizedTransitGateway {
    const id = item?.transitGatewayId || item?.transitGatewayID || item?.id || item?.resourceId || 'unknown';
    const displayName =
      item?.transitGatewayName ||
      item?.name ||
      this.extractNameFromTags(item?.tags) ||
      id;

    const normalized: NormalizedTransitGateway = {
      ...item,
      displayName,
      transitGatewayId: id,
      ownerId: item?.ownerId || item?.OwnerId || item?.accountId,
      amazonSideAsn: this.normalizeNumber(item?.amazonSideAsn ?? item?.AmazonSideAsn),
      defaultRouteTableAssociation: this.normalizeState(item?.defaultRouteTableAssociation ?? item?.DefaultRouteTableAssociation),
      defaultRouteTablePropagation: this.normalizeState(item?.defaultRouteTablePropagation ?? item?.DefaultRouteTablePropagation),
      dnsSupport: this.normalizeState(item?.dnsSupport ?? item?.DnsSupport),
      multicastSupport: this.normalizeState(item?.multicastSupport ?? item?.MulticastSupport),
      vpnEcmpSupport: this.normalizeState(item?.vpnEcmpSupport ?? item?.VpnEcmpSupport ?? item?.vpnECMPSupport)
    } as NormalizedTransitGateway;

    return normalized;
  }

  private extractNameFromTags(tags: any): string | undefined {
    if (!tags || typeof tags !== 'object') return undefined;
    const name = tags.Name || tags.name || tags.NAME;
    return typeof name === 'string' && name.trim().length ? name : undefined;
  }

  private normalizeState(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed.toLowerCase() : undefined;
    }
    if (typeof value === 'boolean') {
      return value ? 'enable' : 'disable';
    }
    return undefined;
  }

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
  }

  private buildUniqueList(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))]
      .map((v) => v.trim())
      .sort((a, b) => a.localeCompare(b));
  }

  private resetSelectElement(id: string): void {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) {
      el.value = '';
      if (el.options.length) el.selectedIndex = 0;
    }
  }
}
