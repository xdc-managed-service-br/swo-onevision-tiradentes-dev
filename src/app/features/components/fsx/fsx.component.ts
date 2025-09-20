// src/app/features/components/fsx-file-systems/fsx.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { FSxFileSystem } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: FSxFileSystem) => string;
}

type ColumnKey =
  | 'fileSystemId'
  | 'fileSystemType'
  | 'deploymentType'
  | 'storageCapacity'
  | 'throughputCapacity'
  | 'automaticBackupRetentionDays'
  | 'dailyAutomaticBackupStartTime'
  | 'copyTagsToBackups'
  | 'lifecycle'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-fsx-file-systems',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './fsx.component.html'
})
export class FSXFileSystemsComponent implements OnInit, OnDestroy {
  resources: FSxFileSystem[] = [];
  filteredResources: FSxFileSystem[] = [];
  paginatedResources: FSxFileSystem[] = [];
  loading = true;
  selectedResource: FSxFileSystem | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  typeFilter = '';
  deploymentFilter = '';
  retentionFilter: '' | 'none' | 'retained' = '';
  copyTagsFilter: '' | 'true' | 'false' = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueTypes: string[] = [];
  uniqueDeployments: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  private readonly LS_KEY = 'fsx-filesystems-columns';
  private readonly destroy$ = new Subject<void>();

  availableColumns: ColumnDefinition[] = [
    {
      key: 'fileSystemId',
      label: 'Name',
      sortable: true,
      transform: (resource) => this.getDisplayName(resource)
    },
    { key: 'fileSystemId', label: 'FileSystem ID', sortable: true },
    { key: 'fileSystemType', label: 'Type', sortable: true },
    { key: 'deploymentType', label: 'Deployment', sortable: true },
    {
      key: 'storageCapacity',
      label: 'Storage (GB)',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.storageCapacity ?? 0)
    },
    {
      key: 'throughputCapacity',
      label: 'Throughput',
      sortable: true,
      transform: (resource) => this.formatThroughput(resource)
    },
    {
      key: 'automaticBackupRetentionDays',
      label: 'Retention (days)',
      sortable: true,
      transform: (r) => this.formatRetention(r.automaticBackupRetentionDays)
    },
    {
      key: 'dailyAutomaticBackupStartTime',
      label: 'Backup Window',
      sortable: true
    },
    {
      key: 'copyTagsToBackups',
      label: 'Copy Tags',
      sortable: true,
      transform: (r) => (r.copyTagsToBackups ? 'Yes' : 'No')
    },
    { key: 'lifecycle', label: 'Lifecycle', sortable: true },
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
    'fileSystemId',
    'fileSystemType',
    'deploymentType',
    'storageCapacity',
    'throughputCapacity',
    'automaticBackupRetentionDays',
    'region',
    'accountName',
    'createdAt'
  ];

  requiredColumns: ColumnKey[] = ['fileSystemId'];

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

  // === Data ================================================================
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('FSxFileSystem')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as FSxFileSystem[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((i) => i.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((i) => this.getAccountLabel(i)));
          this.uniqueTypes = this.buildUniqueList(this.resources.map((i) => i.fileSystemType));
          this.uniqueDeployments = this.buildUniqueList(this.resources.map((i) => i.deploymentType));

          this.loading = false;
          this.currentPage = 1;

          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading FSx file systems:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // === Columns =============================================================
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
      console.warn('Could not save FSx column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length) {
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((c) => this.selectedColumns.add(c));
      }
    } catch (error) {
      console.warn('Could not load FSx column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search & Filters =====================================================
  searchFSx(event: Event): void {
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

  filterByDeployment(event: Event): void {
    this.deploymentFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByRetention(event: Event): void {
    this.retentionFilter = (event.target as HTMLSelectElement).value as '' | 'none' | 'retained';
    this.applyFilters();
  }

  filterByCopyTags(event: Event): void {
    this.copyTagsFilter = (event.target as HTMLSelectElement).value as '' | 'true' | 'false';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.typeFilter = '';
    this.deploymentFilter = '';
    this.retentionFilter = '';
    this.copyTagsFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('fsxSearch') as HTMLInputElement | null;
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
        const nameTag = this.extractNameTag(resource.tags);
        const haystack = [
          resource.fileSystemId,
          this.getAccountLabel(resource),
          resource.region,
          resource.fileSystemType,
          resource.deploymentType,
          nameTag
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.typeFilter && resource.fileSystemType !== this.typeFilter) return false;
      if (this.deploymentFilter && resource.deploymentType !== this.deploymentFilter) return false;

      if (this.retentionFilter === 'none' && (resource.automaticBackupRetentionDays ?? 0) > 0) return false;
      if (this.retentionFilter === 'retained' && (resource.automaticBackupRetentionDays ?? 0) === 0) return false;

      if (this.copyTagsFilter === 'true' && !resource.copyTagsToBackups) return false;
      if (this.copyTagsFilter === 'false' && !!resource.copyTagsToBackups) return false;

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

  private getSortValue(resource: FSxFileSystem, column: ColumnKey): string | number {
    switch (column) {
      case 'storageCapacity':
        return resource.storageCapacity ?? 0;
      case 'throughputCapacity':
        return resource.throughputCapacity ?? 0;
      case 'automaticBackupRetentionDays':
        return resource.automaticBackupRetentionDays ?? 0;
      case 'accountName':
        return this.getAccountLabel(resource);
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      case 'fileSystemId':
        return (resource.fileSystemId || '').toLowerCase();
      default:
        const value = (resource as any)[column];
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
  showDetails(resource: FSxFileSystem): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // === Render helpers ======================================================
  getColumnValue(column: ColumnDefinition, resource: FSxFileSystem): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getColumnClass(key: ColumnKey, resource: FSxFileSystem): string {
    if (key === 'lifecycle') {
      // Destaque simples: AVAILABLE = running; outros = stopped
      return (resource.lifecycle || '').toUpperCase() === 'AVAILABLE' ? 'status-running' : 'status-stopped';
    }
    return '';
  }

  getLifecycleBadgeClass(resource: FSxFileSystem): string {
    return (resource.lifecycle || '').toUpperCase() === 'AVAILABLE' ? 'status-running' : 'status-stopped';
  }

  // === Export ==============================================================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: FSxFileSystem) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'fsx-file-systems.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: FSxFileSystem) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'fsx-file-systems.xlsx');
  }

  // === Utils ===============================================================
  getDisplayName(resource: FSxFileSystem): string {
    const tagName = this.extractNameTag(resource.tags);
    return tagName || resource.fileSystemId || 'Unknown FS';
  }

  extractNameTag(tags: any): string {
    try {
      if (!tags) return '';
      if (Array.isArray(tags)) {
        const nameTag = tags.find((t) => (t?.Key || t?.key) === 'Name');
        return nameTag?.Value || nameTag?.value || '';
      }
      if (typeof tags === 'object') {
        return tags['Name'] || tags['name'] || '';
      }
      if (typeof tags === 'string') {
        const parsed = JSON.parse(tags);
        return this.extractNameTag(parsed);
      }
      return '';
    } catch {
      return '';
    }
  }

  formatThroughput(resource: FSxFileSystem): string {
    // Em geral FSx expõe throughput em MB/s (Windows/ONTAP) ou MiB/s; aqui só exibimos o número com sufixo
    const v = resource.throughputCapacity;
    if (v === null || v === undefined) return 'N/A';
    return `${this.formatNumber(v)} MB/s`;
  }

  formatRetention(days?: number | null): string {
    if (days === null || days === undefined) return 'N/A';
    if (days === 0) return 'None';
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  getAccountLabel(resource: FSxFileSystem): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  private buildUniqueList(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))].sort();
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