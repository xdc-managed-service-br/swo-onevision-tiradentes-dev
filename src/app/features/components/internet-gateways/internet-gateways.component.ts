// src/app/features/components/internet-gateways/internet-gateways.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { InternetGateway } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: InternetGateway) => string;
}

type ColumnKey =
  | 'internetGatewayName'
  | 'internetGatewayId'
  | 'attachmentCount'
  | 'attachedVpcs'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-internet-gateways',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './internet-gateways.component.html'
})
export class InternetGatewaysComponent implements OnInit, OnDestroy {
  resources: InternetGateway[] = [];
  filteredResources: InternetGateway[] = [];
  paginatedResources: InternetGateway[] = [];
  loading = true;
  selectedResource: InternetGateway | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  attachmentFilter: '' | 'attached' | 'detached' = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  private readonly LS_KEY = 'internet-gateways-columns';
  private readonly destroy$ = new Subject<void>();
  private readonly columnMinWidths: Record<string, number> = {
    internetGatewayName: 180,
    internetGatewayId: 170,
    attachmentCount: 140,
    attachedVpcs: 240,
    region: 140,
    accountName: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  availableColumns: ColumnDefinition[] = [
    {
      key: 'internetGatewayName',
      label: 'Name',
      sortable: true,
      transform: (resource) => resource.internetGatewayName || 'Unnamed Gateway'
    },
    { key: 'internetGatewayId', label: 'Gateway ID', sortable: true },
    {
      key: 'attachmentCount',
      label: 'Attachments',
      sortable: true,
      transform: (resource) => this.formatNumber(this.getAttachmentCount(resource))
    },
    {
      key: 'attachedVpcs',
      label: 'Attached VPCs',
      sortable: false,
      transform: (resource) => this.formatVpcList(resource)
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

  defaultColumns: ColumnKey[] = [
    'internetGatewayName',
    'internetGatewayId',
    'attachmentCount',
    'attachedVpcs',
    'region',
    'accountName',
    'createdAt'
  ];

  requiredColumns: ColumnKey[] = ['internetGatewayId'];

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
      .getResourcesByType('InternetGateway')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as InternetGateway[]) || []).map((resource) => {
            const attachedVpcs = this.normalizeAttachedVpcs((resource as any).attachedVpcs);
            const attachmentCount = this.normalizeAttachmentCount((resource as any).attachmentCount, attachedVpcs);
            return {
              ...resource,
              attachedVpcs,
              attachmentCount
            };
          });

          this.filteredResources = [...this.resources];
          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn); // apply existing sort state
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Internet Gateways:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // === Columns ==============================================================
  openColumnCustomizer(): void { this.showColumnCustomizer = true; }
  closeColumnCustomizer(): void { this.showColumnCustomizer = false; }

  toggleColumn(key: ColumnKey): void {
    if (this.isRequiredColumn(key)) return;
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

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((column) => this.selectedColumns.has(column.key));
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save Internet Gateway column preferences:', error);
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
      console.warn('Could not load Internet Gateway column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search & Filters =====================================================
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

  filterByAttachmentState(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as '' | 'attached' | 'detached';
    this.attachmentFilter = value;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.attachmentFilter = '';
    this.searchTerm = '';
    const searchInput = document.getElementById('internetGatewaySearch') as HTMLInputElement | null;
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
          resource.internetGatewayId,
          resource.internetGatewayName,
          this.getAccountLabel(resource),
          this.formatVpcList(resource)
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;

      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;

      if (this.attachmentFilter === 'attached' && this.getAttachmentCount(resource) === 0) return false;
      if (this.attachmentFilter === 'detached' && this.getAttachmentCount(resource) > 0) return false;

      return true;
    });

    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.updatePaginationAfterChange();
    }
  }

  // === Sorting ==============================================================
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);

      if (valueA === valueB) return 0;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      const stringA = String(valueA ?? '').toLowerCase();
      const stringB = String(valueB ?? '').toLowerCase();
      return stringA.localeCompare(stringB) * direction;
    });

    this.updatePaginationAfterChange();
  }

  private getSortValue(resource: InternetGateway, column: ColumnKey): string | number {
    switch (column) {
      case 'attachmentCount':
        return this.getAttachmentCount(resource);
      case 'attachedVpcs':
        return resource.attachedVpcs?.length ?? 0;
      case 'accountName':
        return this.getAccountLabel(resource);
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      case 'internetGatewayName':
        return (resource.internetGatewayName || '').toLowerCase();
      default:
        const value = resource[column];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return value.toLowerCase();
        return value ? 1 : 0;
    }
  }

  // === Pagination ==========================================================
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

  // === Modals ==============================================================
  showDetails(resource: InternetGateway): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // === Render helpers ======================================================
  getColumnValue(column: ColumnDefinition, resource: InternetGateway): string {
    if (column.transform) return column.transform(resource);
    const value = resource[column.key as keyof InternetGateway];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getColumnClass(key: ColumnKey, resource: InternetGateway): string {
    if (key === 'attachmentCount') {
      return this.getAttachmentCount(resource) > 0 ? 'status-running' : 'status-stopped';
    }
    return '';
  }

  getAttachmentBadgeClass(resource: InternetGateway): string {
    return this.getAttachmentCount(resource) > 0 ? 'status-running' : 'status-stopped';
  }

  getAttachmentLabel(resource: InternetGateway): string {
    const count = this.getAttachmentCount(resource);
    return count > 0 ? `${count} attached` : 'Not attached';
  }

  // === Export ==============================================================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: InternetGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'internet-gateways.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: InternetGateway) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'internet-gateways.xlsx');
  }

  // === Utils ===============================================================
  private normalizeAttachedVpcs(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
          }
        } catch (error) {
          console.warn('Could not parse attached VPCs JSON string:', error);
        }
      }
      return [trimmed];
    }

    return [];
  }

  private normalizeAttachmentCount(value: unknown, attachedVpcs: string[]): number {
    if (typeof value === 'number' && !isNaN(value)) return value;
    return attachedVpcs.length;
  }

  formatVpcList(resource: InternetGateway): string {
    const list = resource.attachedVpcs ?? [];
    if (!list.length) return 'No VPC attachments';
    return list.join(', ');
  }

  getAttachmentCount(resource: InternetGateway): number {
    if (typeof resource.attachmentCount === 'number') {
      return resource.attachmentCount;
    }
    return resource.attachedVpcs?.length ?? 0;
  }

  getAccountLabel(resource: InternetGateway): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  private buildUniqueList(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))].sort();
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  }

  formatNumber(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0';
    try {
      return new Intl.NumberFormat().format(value);
    } catch {
      return String(value);
    }
  }
}
