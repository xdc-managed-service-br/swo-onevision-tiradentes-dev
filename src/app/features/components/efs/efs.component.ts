// src/app/features/components/efs-file-systems/efs.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { EFSFileSystem } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: EFSFileSystem) => string;
}

type ColumnKey =
  | 'fileSystemId'
  | 'performanceMode'
  | 'throughputMode'
  | 'provisionedThroughputInMibps'
  | 'mountTargetsCount'
  | 'sizeInBytes'
  | 'lifecyclePolicies'
  | 'backupPolicyEnabled'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-efs-file-systems',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './efs.component.html'
})
export class EFSFileSystemsComponent implements OnInit, OnDestroy {
  resources: EFSFileSystem[] = [];
  filteredResources: EFSFileSystem[] = [];
  paginatedResources: EFSFileSystem[] = [];
  loading = true;
  selectedResource: EFSFileSystem | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  perfFilter = '';
  throughputFilter = '';
  backupFilter: '' | 'enabled' | 'disabled' = '';
  lifecycleFilter: '' | 'has' | 'none' = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniquePerformanceModes: string[] = [];
  uniqueThroughputModes: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  private readonly LS_KEY = 'efs-filesystems-columns';
  private readonly destroy$ = new Subject<void>();

  availableColumns: ColumnDefinition[] = [
    {
      key: 'fileSystemId',
      label: 'Name',
      sortable: true,
      transform: (resource) => this.getDisplayName(resource)
    },
    { key: 'fileSystemId', label: 'FileSystem ID', sortable: true },
    { key: 'performanceMode', label: 'Performance', sortable: true },
    {
      key: 'throughputMode',
      label: 'Throughput',
      sortable: true,
      transform: (resource) => this.formatThroughput(resource)
    },
    {
      key: 'mountTargetsCount',
      label: 'Mount Targets',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.mountTargetsCount ?? 0)
    },
    {
      key: 'sizeInBytes',
      label: 'Size',
      sortable: true
    },
    {
      key: 'lifecyclePolicies',
      label: 'Lifecycle Policies',
      sortable: false,
      transform: (resource) => this.formatLifecycle(resource.lifecyclePolicies)
    },
    {
      key: 'backupPolicyEnabled',
      label: 'Backup',
      sortable: true,
      transform: (resource) => (resource.backupPolicyEnabled ? 'Enabled' : 'Disabled')
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
    'fileSystemId',
    'performanceMode',
    'throughputMode',
    'mountTargetsCount',
    'sizeInBytes',
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
      .getResourcesByType('EFSFileSystem')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as EFSFileSystem[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((i) => i.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((i) => this.getAccountLabel(i)));
          this.uniquePerformanceModes = this.buildUniqueList(this.resources.map((i) => i.performanceMode));
          this.uniqueThroughputModes = this.buildUniqueList(this.resources.map((i) => i.throughputMode));

          this.loading = false;
          this.currentPage = 1;

          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading EFS file systems:', error);
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
      console.warn('Could not save EFS column preferences:', error);
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
      console.warn('Could not load EFS column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search & Filters =====================================================
  searchEFS(event: Event): void {
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

  filterByPerformanceMode(event: Event): void {
    this.perfFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByThroughputMode(event: Event): void {
    this.throughputFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByBackupPolicy(event: Event): void {
    this.backupFilter = (event.target as HTMLSelectElement).value as '' | 'enabled' | 'disabled';
    this.applyFilters();
  }

  filterByLifecyclePresence(event: Event): void {
    this.lifecycleFilter = (event.target as HTMLSelectElement).value as '' | 'has' | 'none';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.perfFilter = '';
    this.throughputFilter = '';
    this.backupFilter = '';
    this.lifecycleFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('efsSearch') as HTMLInputElement | null;
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
          nameTag,
          (resource.lifecyclePolicies || []).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.perfFilter && resource.performanceMode !== this.perfFilter) return false;
      if (this.throughputFilter && resource.throughputMode !== this.throughputFilter) return false;

      if (this.backupFilter === 'enabled' && !resource.backupPolicyEnabled) return false;
      if (this.backupFilter === 'disabled' && !!resource.backupPolicyEnabled) return false;

      const hasLifecycle = (resource.lifecyclePolicies?.length ?? 0) > 0;
      if (this.lifecycleFilter === 'has' && !hasLifecycle) return false;
      if (this.lifecycleFilter === 'none' && hasLifecycle) return false;

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

  private getSortValue(resource: EFSFileSystem, column: ColumnKey): string | number {
    switch (column) {
      case 'sizeInBytes':
        return this.parseHumanSizeToBytes(resource.sizeInBytes) || 0;
      case 'provisionedThroughputInMibps':
        return resource.provisionedThroughputInMibps ?? 0;
      case 'mountTargetsCount':
        return resource.mountTargetsCount ?? 0;
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
  showDetails(resource: EFSFileSystem): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // === Render helpers ======================================================
  getColumnValue(column: ColumnDefinition, resource: EFSFileSystem): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getColumnClass(key: ColumnKey, resource: EFSFileSystem): string {
    if (key === 'backupPolicyEnabled') {
      return resource.backupPolicyEnabled ? 'status-running' : 'status-stopped';
    }
    return '';
  }

  getBackupBadgeClass(resource: EFSFileSystem): string {
    return resource.backupPolicyEnabled ? 'status-running' : 'status-stopped';
    }

  getBackupBadgeLabel(resource: EFSFileSystem): string {
    return resource.backupPolicyEnabled ? 'Backup: Enabled' : 'Backup: Disabled';
  }

  // === Export ==============================================================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: EFSFileSystem) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'efs-file-systems.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: EFSFileSystem) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'efs-file-systems.xlsx');
  }

  // === Utils ===============================================================
  getDisplayName(resource: EFSFileSystem): string {
    const tagName = this.extractNameTag(resource.tags);
    return tagName || resource.fileSystemId || 'Unknown FS';
  }

  extractNameTag(tags: any): string {
    try {
      // aceita objetos {'Name': '...'} ou listas [{Key:'Name',Value:'...'}]
      if (!tags) return '';
      if (Array.isArray(tags)) {
        const nameTag = tags.find((t) => (t?.Key || t?.key) === 'Name');
        return nameTag?.Value || nameTag?.value || '';
      }
      if (typeof tags === 'object') {
        return tags['Name'] || tags['name'] || '';
      }
      if (typeof tags === 'string') {
        // pode vir string JSON
        const parsed = JSON.parse(tags);
        return this.extractNameTag(parsed);
      }
      return '';
    } catch {
      return '';
    }
  }

  formatLifecycle(policies?: string[] | null): string {
    const list = policies ?? [];
    return list.length ? list.join(', ') : 'None';
  }

  formatThroughput(resource: EFSFileSystem): string {
    const mode = resource.throughputMode || 'N/A';
    if (mode?.toLowerCase() === 'provisioned') {
      const v = resource.provisionedThroughputInMibps;
      return v ? `${mode} (${v} MiB/s)` : mode;
    }
    return mode;
  }

  getAccountLabel(resource: EFSFileSystem): string {
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

  parseHumanSizeToBytes(value?: string | null): number {
    if (!value) return 0;
    // espera formatos como "59.28 TB", "123 GB", "789 MB", etc.
    const m = String(value).trim().match(/^([0-9]+(?:\\.[0-9]+)?)\\s*(B|KB|MB|GB|TB|PB)$/i);
    if (!m) return 0;
    const num = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const power = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4, PB: 5 }[unit] ?? 0;
    return Math.round(num * Math.pow(1024, power));
  }
}