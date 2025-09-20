// src/app/features/components/subnets/subnets.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { Subnet } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (item: Subnet) => string;
}

type ColumnKey = keyof Subnet | 'accountName' | 'vpcId';

@Component({
  selector: 'app-subnets',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './subnets.component.html'
})
export class SubnetsComponent implements OnInit, OnDestroy {
  resources: Subnet[] = [];
  filteredResources: Subnet[] = [];
  paginatedResources: Subnet[] = [];
  loading = true;
  selectedResource: Subnet | null = null;

  searchTerm = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueZones: string[] = [];
  uniqueStates: string[] = [];
  uniqueVpcIds: string[] = [];

  regionFilter = '';
  accountFilter = '';
  zoneFilter = '';
  stateFilter = '';
  vpcFilter = '';
  hasIpsFilter: '' | 'has' | 'none' = '';

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  private readonly LS_KEY = 'subnets-columns';
  selectedColumns: Set<string> = new Set();
  private readonly columnMinWidths: Record<string, number> = {
    subnetName: 180,
    subnetId: 160,
    cidrBlock: 180,
    availabilityZone: 140,
    availabilityZoneId: 150,
    availableIpAddressCount: 150,
    state: 130,
    region: 140,
    accountName: 170,
    vpcId: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  availableColumns: ColumnDefinition[] = [
    { key: 'subnetName', label: 'Subnet Name', sortable: true },
    { key: 'subnetId', label: 'Subnet ID', sortable: true },
    { key: 'cidrBlock', label: 'CIDR Block', sortable: true },
    { key: 'availabilityZone', label: 'Availability Zone', sortable: true },
    { key: 'availabilityZoneId', label: 'AZ ID', sortable: true },
    {
      key: 'availableIpAddressCount',
      label: 'Available IPs',
      sortable: true,
      transform: (item) => this.formatNumber(item.availableIpAddressCount)
    },
    { key: 'state', label: 'State', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (item) => item.accountName || item.accountId
    },
    { key: 'vpcId', label: 'VPC ID', sortable: true },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      transform: (item) => this.formatDate(item.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      transform: (item) => this.formatDate(item.updatedAt)
    }
  ];

  defaultColumns = [
    'subnetName',
    'subnetId',
    'cidrBlock',
    'availabilityZone',
    'availableIpAddressCount',
    'state',
    'region',
    'accountName',
    'vpcId',
    'createdAt'
  ];

  requiredColumns = ['subnetId'];

  private destroy$ = new Subject<void>();

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
      .getResourcesByType('Subnet')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as Subnet[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = [...new Set(this.resources.map((item) => item.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(this.resources.map((item) => item.accountName || item.accountId).filter(Boolean))].sort();
          this.uniqueZones = [...new Set(this.resources.map((item) => item.availabilityZone).filter((zone): zone is string => typeof zone === 'string'))].sort();
          this.uniqueStates = [...new Set(this.resources.map((item) => item.state).filter((state): state is string => typeof state === 'string'))].sort();
          this.uniqueVpcIds = [...new Set(this.resources.map((item) => (item as any).vpcId).filter(Boolean))].sort();

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.applySorting(false);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading subnets:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  searchResources(event: Event): void {
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

  filterByZone(event: Event): void {
    this.zoneFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByState(event: Event): void {
    this.stateFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByVpc(event: Event): void {
    this.vpcFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAvailableIps(event: Event): void {
    this.hasIpsFilter = (event.target as HTMLSelectElement).value as typeof this.hasIpsFilter;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredResources = this.resources.filter((resource) => {
      if (this.searchTerm) {
        const haystacks = [
          resource.subnetId,
          resource.subnetName,
          resource.cidrBlock,
          (resource as any).vpcId,
          resource.accountName,
          resource.accountId,
          resource.region
        ]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());

        const matchesSearch = haystacks.some((value) => value.includes(this.searchTerm));
        if (!matchesSearch) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && (resource.accountName || resource.accountId) !== this.accountFilter) return false;
      if (this.zoneFilter && resource.availabilityZone !== this.zoneFilter) return false;
      if (this.stateFilter && resource.state !== this.stateFilter) return false;
      if (this.vpcFilter && (resource as any).vpcId !== this.vpcFilter) return false;

      if (this.hasIpsFilter) {
        const hasAvailable = (resource.availableIpAddressCount ?? 0) > 0;
        if (this.hasIpsFilter === 'has' && !hasAvailable) return false;
        if (this.hasIpsFilter === 'none' && hasAvailable) return false;
      }

      return true;
    });

    this.currentPage = 1;
    if (this.sortColumn) {
      this.applySorting(false);
    } else {
      this.recomputePagination();
    }
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.zoneFilter = '';
    this.stateFilter = '';
    this.vpcFilter = '';
    this.hasIpsFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('subnetSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    this.filteredResources = [...this.resources];
    this.currentPage = 1;
    if (this.sortColumn) {
      this.applySorting(false);
    } else {
      this.recomputePagination();
    }
  }

  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applySorting();
  }

  private applySorting(resetPage: boolean = true): void {
    if (!this.sortColumn) {
      if (resetPage) this.currentPage = 1;
      this.recomputePagination();
      return;
    }

    const column = this.sortColumn;
    const direction = this.sortDirection === 'asc' ? 1 : -1;

    const sorted = [...this.filteredResources].sort((a, b) => {
      const valueA = this.getSortableValue(a, column);
      const valueB = this.getSortableValue(b, column);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      const strA = valueA.toString();
      const strB = valueB.toString();
      return strA.localeCompare(strB) * direction;
    });

    this.filteredResources = sorted;
    if (resetPage) this.currentPage = 1;
    this.recomputePagination();
  }

  private getSortableValue(resource: Subnet, column: ColumnKey): string | number {
    if (column === 'accountName') {
      return (resource.accountName || resource.accountId || '').toLowerCase();
    }

    const raw = resource[column as keyof Subnet];
    if (raw === null || raw === undefined) return '';

    if (column === 'createdAt' || column === 'updatedAt') {
      const timestamp = Date.parse(String(raw));
      return isNaN(timestamp) ? 0 : timestamp;
    }

    if (typeof raw === 'number') return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    return raw.toString().toLowerCase();
  }

  private recomputePagination(): void {
    const total = this.filteredResources.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = this.filteredResources.slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  getPageNumbers(): number[] {
    const maxVisible = 7;
    const half = Math.floor(maxVisible / 2);

    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, this.currentPage + half);

    if (this.currentPage <= half) {
      end = Math.min(this.totalPages, maxVisible);
    } else if (this.currentPage >= this.totalPages - half) {
      start = Math.max(1, this.totalPages - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages);
    if (clamped !== this.currentPage) {
      this.currentPage = clamped;
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

  openColumnCustomizer(): void {
    this.showColumnCustomizer = true;
  }

  closeColumnCustomizer(): void {
    this.showColumnCustomizer = false;
  }

  toggleColumn(key: string): void {
    if (this.isRequiredColumn(key)) return;
    if (this.selectedColumns.has(key)) {
      this.selectedColumns.delete(key);
    } else {
      this.selectedColumns.add(key);
    }
  }

  isColumnSelected(key: string): boolean {
    return this.selectedColumns.has(key);
  }

  isRequiredColumn(key: string): boolean {
    return this.requiredColumns.includes(key);
  }

  selectAllColumns(): void {
    this.availableColumns.forEach((column) => this.selectedColumns.add(column.key));
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach((key) => this.selectedColumns.add(key));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
    this.recomputePagination();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((column) => this.selectedColumns.has(column.key));
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((key) => this.selectedColumns.add(key));
      }
    } catch (error) {
      console.warn('Could not load column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  getColumnValue(column: ColumnDefinition, resource: Subnet): string {
    if (column.transform) return column.transform(resource);
    const raw = resource[column.key as keyof Subnet];
    if (raw === null || raw === undefined) return 'N/A';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return this.formatBoolean(raw);
    if (typeof raw === 'number') return this.formatNumber(raw);
    return String(raw);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getColumnClass(key: ColumnKey, resource: Subnet): string {
    if (key === 'subnetId' || key === 'cidrBlock' || key === 'vpcId') return 'ov-text--mono';
    if (key === 'state') return this.getStateClass(resource.state);
    return '';
  }

  private getStateClass(state?: string): string {
    const value = (state || '').toLowerCase();
    if (value === 'available' || value === 'active') return 'status-running';
    if (value === 'pending' || value === 'pending-acceptance') return 'status-pending';
    if (value === 'deleted' || value === 'deleting') return 'status-terminated';
    if (value === 'failed') return 'status-stopped';
    return 'status-unknown';
  }

  formatBoolean(value?: boolean | null): string {
    if (value === null || value === undefined) return 'N/A';
    return value ? 'Yes' : 'No';
  }

  formatNumber(value?: number | null): string {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString();
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
  }

  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const columns: ExportColumn[] = this.getVisibleColumns().map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform
        ? (item: Subnet) => column.transform!(item)
        : (item: Subnet) => {
            const raw = item[column.key as keyof Subnet];
            if (raw === null || raw === undefined) return '';
            if (Array.isArray(raw)) return raw.join('; ');
            if (typeof raw === 'boolean') return this.formatBoolean(raw);
            if (typeof raw === 'number') return this.formatNumber(raw);
            return String(raw);
          }
    }));

    this.exportService.exportDataToCSV(this.filteredResources, columns, 'subnets.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const columns: ExportColumn[] = this.getVisibleColumns().map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform
        ? (item: Subnet) => column.transform!(item)
        : (item: Subnet) => {
            const raw = item[column.key as keyof Subnet];
            if (raw === null || raw === undefined) return '';
            if (Array.isArray(raw)) return raw.join('; ');
            if (typeof raw === 'boolean') return this.formatBoolean(raw);
            if (typeof raw === 'number') return this.formatNumber(raw);
            return String(raw);
          }
    }));

    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'subnets.xlsx');
  }

  showDetails(resource: Subnet): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }
}
