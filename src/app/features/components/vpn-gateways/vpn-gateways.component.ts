// src/app/features/components/vpn-gateways/vpn-gateways.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { VPNGateway } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedVpnGateway) => string;
}

type ColumnKey =
  | 'displayName'
  | 'vpnGatewayId'
  | 'type'
  | 'state'
  | 'amazonSideAsn'
  | 'availabilityZone'
  | 'attachedVpcCount'
  | 'attachedVpcSummary'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

type AttachmentFilter = '' | 'attached' | 'detached';

type NormalizedVpnGateway = VPNGateway & {
  displayName: string;
  type?: string;
  state?: string;
  availabilityZone?: string;
  attachedVpcList: string[];
  attachedVpcCount: number;
  attachedVpcSummary: string;
};

@Component({
  selector: 'app-vpn-gateways',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './vpn-gateways.component.html'
})
export class VpnGatewaysComponent implements OnInit, OnDestroy {
  resources: NormalizedVpnGateway[] = [];
  filteredResources: NormalizedVpnGateway[] = [];
  paginatedResources: NormalizedVpnGateway[] = [];
  loading = true;
  selectedResource: NormalizedVpnGateway | null = null;

  // Filters
  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  typeFilter = '';
  stateFilter = '';
  attachmentFilter: AttachmentFilter = '';
  availabilityZoneFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueTypes: string[] = [];
  uniqueStates: string[] = [];
  uniqueAvailabilityZones: string[] = [];

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Columns
  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();
  private readonly requiredColumns: ColumnKey[] = ['vpnGatewayId'];
  private readonly defaultColumns: ColumnKey[] = [
    'displayName',
    'vpnGatewayId',
    'type',
    'state',
    'availabilityZone',
    'attachedVpcCount',
    'region',
    'accountName',
    'createdAt'
  ];

  readonly availableColumns: ColumnDefinition[] = [
    {
      key: 'displayName',
      label: 'Name',
      sortable: true,
      transform: (resource) => resource.displayName
    },
    { key: 'vpnGatewayId', label: 'Gateway ID', sortable: true },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.type)
    },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.state)
    },
    {
      key: 'amazonSideAsn',
      label: 'Amazon ASN',
      sortable: true,
      transform: (resource) => resource.amazonSideAsn ? String(resource.amazonSideAsn) : 'N/A'
    },
    {
      key: 'availabilityZone',
      label: 'Availability Zone',
      sortable: true,
      transform: (resource) => resource.availabilityZone || 'N/A'
    },
    {
      key: 'attachedVpcCount',
      label: 'Attached VPCs',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.attachedVpcCount)
    },
    {
      key: 'attachedVpcSummary',
      label: 'VPC Attachments',
      sortable: false,
      transform: (resource) => resource.attachedVpcSummary || 'None'
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

  private readonly LS_KEY = 'vpn-gateways-columns';
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
      .getResourcesByType('VPNGateway')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as VPNGateway[]) || []).map((item) => this.normalizeVpnGateway(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueTypes = this.buildUniqueList(this.resources.map((item) => item.type));
          this.uniqueStates = this.buildUniqueList(this.resources.map((item) => item.state));
          this.uniqueAvailabilityZones = this.buildUniqueList(this.resources.map((item) => item.availabilityZone));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading VPN Gateways:', error);
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
      console.warn('Could not save VPN Gateway column preferences:', error);
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
      console.warn('Could not load VPN Gateway column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // Filters -------------------------------------------------------------------
  searchVpnGateways(event: Event): void {
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

  filterByType(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByState(event: Event): void {
    this.stateFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAvailabilityZone(event: Event): void {
    this.availabilityZoneFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAttachment(event: Event): void {
    this.attachmentFilter = (event.target as HTMLSelectElement).value as AttachmentFilter;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.typeFilter = '';
    this.stateFilter = '';
    this.attachmentFilter = '';
    this.availabilityZoneFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('vpnGatewaySearch') as HTMLInputElement | null;
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
          resource.vpnGatewayId,
          this.getAccountLabel(resource),
          resource.attachedVpcSummary
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.typeFilter && (resource.type || '').toLowerCase() !== this.typeFilter.toLowerCase()) return false;
      if (this.stateFilter && (resource.state || '').toLowerCase() !== this.stateFilter.toLowerCase()) return false;
      if (this.availabilityZoneFilter && (resource.availabilityZone || '') !== this.availabilityZoneFilter) return false;

      if (this.attachmentFilter === 'attached' && resource.attachedVpcCount === 0) return false;
      if (this.attachmentFilter === 'detached' && resource.attachedVpcCount > 0) return false;

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

  private getSortValue(resource: NormalizedVpnGateway, column: ColumnKey): string | number {
    switch (column) {
      case 'attachedVpcCount':
        return resource.attachedVpcCount;
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
  showDetails(resource: NormalizedVpnGateway): void {
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
      transform: column.transform ?? ((resource: NormalizedVpnGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'vpn-gateways.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedVpnGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'vpn-gateways.xlsx');
  }

  // Helpers --------------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedVpnGateway): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return this.formatBoolean(value);
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getStateClass(resource: NormalizedVpnGateway): string {
    const state = (resource.state || '').toLowerCase();
    switch (state) {
      case 'available':
        return 'status-running';
      case 'pending':
        return 'status-warning';
      case 'deleted':
      case 'deleting':
      case 'failed':
        return 'status-stopped';
      default:
        return 'status-neutral';
    }
  }

  getAccountLabel(resource: VPNGateway): string {
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

  formatNumber(value: number | undefined | null): string {
    const num = typeof value === 'number' ? value : 0;
    try {
      return new Intl.NumberFormat().format(num);
    } catch {
      return String(num);
    }
  }

  private normalizeVpnGateway(item: VPNGateway | any): NormalizedVpnGateway {
    const displayName =
      item?.vpnGatewayName ||
      item?.name ||
      this.extractNameFromTags(item?.tags) ||
      item?.vpnGatewayId ||
      'VPN Gateway';

    const attachedVpcList = this.normalizeAttachedVpcs(
      item?.attachedVpcIds ?? item?.attachedVpcId ?? item?.vpcAttachments ?? item?.attachments
    );

    const normalized: NormalizedVpnGateway = {
      ...item,
      displayName,
      type: item?.type || item?.VpnType || item?.vpnType,
      state: item?.state || item?.VpnState || item?.status,
      amazonSideAsn: this.normalizeNumber(item?.amazonSideAsn ?? item?.AmazonSideAsn),
      availabilityZone: item?.availabilityZone || item?.AvailabilityZone || item?.az,
      attachedVpcList,
      attachedVpcCount: attachedVpcList.length,
      attachedVpcSummary: attachedVpcList.length ? attachedVpcList.join(', ') : 'None'
    } as NormalizedVpnGateway;

    if (normalized.attachedVpcCount && !normalized.vpcId) {
      normalized.vpcId = normalized.attachedVpcList[0];
    }

    if (normalized.attachmentCount == null) {
      normalized.attachmentCount = normalized.attachedVpcCount;
    }

    return normalized;
  }

  private normalizeAttachedVpcs(value: unknown): string[] {
    if (!value) return [];

    const push = (input: string, target: string[]) => {
      const trimmed = input.trim();
      if (trimmed) target.push(trimmed);
    };

    const result: string[] = [];

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          push(entry, result);
        } else if (entry && typeof entry === 'object') {
          const vpcId = entry.vpcId || entry.VpcId || entry.vpc || entry.resourceId;
          if (typeof vpcId === 'string') push(vpcId, result);
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
          return this.normalizeAttachedVpcs(parsed);
        } catch {
          // fallback
        }
      }
      trimmed.split(/[;,]/).forEach((part) => push(part, result));
      return [...new Set(result)];
    }

    if (typeof value === 'object') {
      const vpcId = (value as any).vpcId || (value as any).VpcId;
      if (typeof vpcId === 'string') return [vpcId.trim()];
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

  private normalizeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
  }
}
