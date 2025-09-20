// src/app/features/components/vpn-connections/vpn-connections.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { VPNConnection } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedVpnConnection) => string;
}

type ColumnKey =
  | 'displayName'
  | 'vpnConnectionId'
  | 'state'
  | 'type'
  | 'category'
  | 'tunnelStatus'
  | 'tunnelsUp'
  | 'tunnelCount'
  | 'transitGatewayId'
  | 'vpnGatewayId'
  | 'customerGatewayId'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

type NormalizedVpnConnection = VPNConnection & {
  displayName: string;
  state?: string;
  tunnelStatus: string;
  tunnelsDown: number;
};

@Component({
  selector: 'app-vpn-connections',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './vpn-connections.component.html'
})
export class VpnConnectionsComponent implements OnInit, OnDestroy {
  resources: NormalizedVpnConnection[] = [];
  filteredResources: NormalizedVpnConnection[] = [];
  paginatedResources: NormalizedVpnConnection[] = [];
  loading = true;
  selectedResource: NormalizedVpnConnection | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  stateFilter = '';
  typeFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();
  private readonly requiredColumns: ColumnKey[] = ['vpnConnectionId'];
  private readonly defaultColumns: ColumnKey[] = [
    'displayName',
    'vpnConnectionId',
    'state',
    'tunnelStatus',
    'tunnelsUp',
    'tunnelCount',
    'transitGatewayId',
    'region',
    'accountName',
    'createdAt'
  ];

  private readonly columnMinWidths: Record<string, number> = {
    displayName: 200,
    vpnConnectionId: 190,
    state: 150,
    type: 150,
    category: 150,
    tunnelStatus: 220,
    tunnelsUp: 150,
    tunnelCount: 160,
    transitGatewayId: 200,
    vpnGatewayId: 200,
    customerGatewayId: 200,
    region: 140,
    accountName: 170,
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
    { key: 'vpnConnectionId', label: 'Connection ID', sortable: true },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.state)
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.type)
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      transform: (resource) => this.formatTitle(resource.category)
    },
    {
      key: 'tunnelStatus',
      label: 'Tunnels (Up/Total)',
      sortable: true,
      transform: (resource) => resource.tunnelStatus
    },
    {
      key: 'tunnelsUp',
      label: 'Tunnels Up',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.tunnelsUp)
    },
    {
      key: 'tunnelCount',
      label: 'Tunnel Count',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.tunnelCount)
    },
    {
      key: 'transitGatewayId',
      label: 'Transit Gateway',
      sortable: true,
      transform: (resource) => resource.transitGatewayId || 'N/A'
    },
    {
      key: 'vpnGatewayId',
      label: 'VPN Gateway',
      sortable: true,
      transform: (resource) => resource.vpnGatewayId || 'N/A'
    },
    {
      key: 'customerGatewayId',
      label: 'Customer Gateway',
      sortable: true,
      transform: (resource) => resource.customerGatewayId || 'N/A'
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

  private readonly LS_KEY = 'vpn-connections-columns';
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
      .getResourcesByType('VPNConnection')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as VPNConnection[]) || []).map((item) => this.normalizeVpnConnection(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueStates = this.buildUniqueList(this.resources.map((item) => item.state));
          this.uniqueTypes = this.buildUniqueList(this.resources.map((item) => item.type));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading VPN Connections:', error);
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
      const values = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(values));
    } catch (error) {
      console.warn('[VPN Connections] Failed to save column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const stored = localStorage.getItem(this.LS_KEY);
      if (!stored) return;
      const parsed: ColumnKey[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((column) => this.selectedColumns.add(column));
      }
    } catch (error) {
      console.warn('[VPN Connections] Failed to load column preferences:', error);
    }
  }

  // Filtering -----------------------------------------------------------------
  searchVpnConnections(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
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

  filterByType(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.regionFilter = '';
    this.accountFilter = '';
    this.stateFilter = '';
    this.typeFilter = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredResources = this.resources.filter((resource) => {
      if (this.searchTerm) {
        const haystack = [
          resource.vpnConnectionId,
          resource.displayName,
          resource.transitGatewayId,
          resource.vpnGatewayId,
          resource.customerGatewayId
        ]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());

        if (!haystack.some((value) => value.includes(this.searchTerm))) {
          return false;
        }
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.stateFilter && this.normalizeState(resource.state) !== this.normalizeState(this.stateFilter)) return false;
      if (this.typeFilter && this.normalizeState(resource.type) !== this.normalizeState(this.typeFilter)) return false;

      return true;
    });

    this.currentPage = 1;
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.recomputePagination();
    }
  }

  // Sorting -------------------------------------------------------------------
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources.sort((a, b) => {
      const left = this.getSortValue(a, column);
      const right = this.getSortValue(b, column);

      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });

    this.recomputePagination();
  }

  private getSortValue(resource: NormalizedVpnConnection, column: ColumnKey): any {
    switch (column) {
      case 'tunnelsUp':
      case 'tunnelCount':
        return resource[column] ?? 0;
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      case 'state':
      case 'type':
      case 'category':
        return this.formatTitle(resource[column] as string | undefined).toLowerCase();
      case 'accountName':
        return this.getAccountLabel(resource).toLowerCase();
      case 'displayName':
        return (resource.displayName || '').toLowerCase();
      case 'tunnelStatus': {
        const [up, total] = resource.tunnelStatus.split('/').map((value) => parseInt(value, 10));
        return Number.isNaN(up) || Number.isNaN(total) ? 0 : up / Math.max(total, 1);
      }
      default: {
        const value = (resource as any)[column];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return value.toLowerCase();
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
  showDetails(resource: NormalizedVpnConnection): void {
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
      transform: column.transform ?? ((resource: NormalizedVpnConnection) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'vpn-connections.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedVpnConnection) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'vpn-connections.xlsx');
  }

  // Helpers --------------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedVpnConnection): string {
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

  getStateClass(resource: NormalizedVpnConnection): string {
    const state = (resource.state || '').toLowerCase();
    switch (state) {
      case 'available':
        return 'status-running';
      case 'pending':
      case 'modifying':
        return 'status-warning';
      case 'down':
      case 'deleted':
      case 'deleting':
      case 'failed':
        return 'status-stopped';
      default:
        return 'status-neutral';
    }
  }

  getAccountLabel(resource: VPNConnection): string {
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

  private normalizeVpnConnection(item: VPNConnection | any): NormalizedVpnConnection {
    const displayName =
      item?.vpnConnectionName ||
      item?.name ||
      this.extractNameFromTags(item?.tags) ||
      item?.vpnConnectionId ||
      'VPN Connection';

    const tunnelCount = this.normalizeNumber(item?.tunnelCount ?? item?.tunnelsTotal ?? item?.tunnels_total);
    const tunnelsUp = this.normalizeNumber(item?.tunnelsUp ?? item?.tunnels_up ?? item?.tunnelsHealthy);
    const resolvedTunnelCount = tunnelCount ?? tunnelsUp ?? 0;
    const resolvedTunnelsUp = tunnelsUp ?? resolvedTunnelCount;
    const tunnelsDown = Math.max(resolvedTunnelCount - resolvedTunnelsUp, 0);

    const normalized: NormalizedVpnConnection = {
      ...item,
      displayName,
      vpnConnectionId: item?.vpnConnectionId || item?.VpnConnectionId || item?.id,
      state: item?.state || item?.status,
      type: item?.type || item?.vpnConnectionType || item?.VpnConnectionType,
      category: item?.category,
      tunnelCount: resolvedTunnelCount,
      tunnelsUp: resolvedTunnelsUp,
      tunnelsDown,
      tunnelStatus: resolvedTunnelCount > 0 ? `${resolvedTunnelsUp}/${resolvedTunnelCount}` : `${resolvedTunnelsUp}`
    } as NormalizedVpnConnection;

    return normalized;
  }

  private extractNameFromTags(tags: any): string | undefined {
    if (!tags) return undefined;

    if (Array.isArray(tags)) {
      const nameTag = tags.find((tag) => tag?.Key === 'Name' || tag?.key === 'Name');
      if (nameTag && typeof nameTag.Value === 'string' && nameTag.Value.trim()) {
        return nameTag.Value.trim();
      }
      const normalized = tags.find((tag) => tag?.Key === 'name');
      if (normalized && typeof normalized.Value === 'string' && normalized.Value.trim()) {
        return normalized.Value.trim();
      }
      return undefined;
    }

    if (typeof tags === 'string') {
      const trimmed = tags.trim();
      if (!trimmed.length) return undefined;
      if (trimmed.startsWith('[')) {
        try {
          return this.extractNameFromTags(JSON.parse(trimmed));
        } catch {
          return undefined;
        }
      }
      return undefined;
    }

    if (typeof tags === 'object') {
      const candidate = tags.Name || tags.name || tags.NAME;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return undefined;
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

  private normalizeState(value: string | undefined | null): string {
    return value ? value.trim().toLowerCase() : '';
  }
}
