// src/app/features/components/backup-vaults/backup-vaults.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { BackupVault } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: BackupVault) => string;
}

type ColumnKey =
  | 'backupVaultName'
  | 'numberOfRecoveryPoints'
  | 'latestRecoveryPointAgeDays'
  | 'locked'
  | 'encryptionKeyArn'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-backup-vaults',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './backup-vaults.component.html'
})
export class BackupVaultsComponent implements OnInit, OnDestroy {
  resources: BackupVault[] = [];
  filteredResources: BackupVault[] = [];
  paginatedResources: BackupVault[] = [];
  loading = true;
  selectedResource: BackupVault | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  lockFilter: '' | 'locked' | 'unlocked' = '';
  hasPointsFilter: '' | 'yes' | 'no' = '';
  kmsFilter: '' | 'present' | 'absent' = '';

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

  private readonly LS_KEY = 'backup-vaults-columns';
  private readonly destroy$ = new Subject<void>();
  private readonly columnMinWidths: Record<string, number> = {
    backupVaultName: 200,
    numberOfRecoveryPoints: 170,
    latestRecoveryPointAgeDays: 220,
    locked: 150,
    encryptionKeyArn: 260,
    region: 140,
    accountName: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  availableColumns: ColumnDefinition[] = [
    {
      key: 'backupVaultName',
      label: 'Name',
      sortable: true,
      transform: (r) => this.getDisplayName(r)
    },
    { key: 'numberOfRecoveryPoints', label: 'Recovery Points', sortable: true },
    {
      key: 'latestRecoveryPointAgeDays',
      label: 'Latest Recovery Age (days)',
      sortable: true,
      transform: (r) => this.formatAgeDays(r.latestRecoveryPointAgeDays)
    },
    {
      key: 'locked',
      label: 'Locked',
      sortable: true,
      transform: (r) => (r.locked ? 'Yes' : 'No')
    },
    { key: 'encryptionKeyArn', label: 'KMS Key ARN', sortable: true },
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

  defaultColumns: ColumnKey[] = [
    'backupVaultName',
    'numberOfRecoveryPoints',
    'latestRecoveryPointAgeDays',
    'locked',
    'encryptionKeyArn',
    'region',
    'accountName',
    'createdAt'
  ];

  requiredColumns: ColumnKey[] = ['backupVaultName'];

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
      .getResourcesByType('BackupVault')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as BackupVault[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((i) => i.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((i) => this.getAccountLabel(i)));

          this.loading = false;
          this.currentPage = 1;

          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Backup Vaults:', error);
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
      console.warn('Could not save Backup Vaults column preferences:', error);
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
      console.warn('Could not load Backup Vaults column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search & Filters =====================================================
  searchVaults(event: Event): void {
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

  filterByLock(event: Event): void {
    this.lockFilter = (event.target as HTMLSelectElement).value as '' | 'locked' | 'unlocked';
    this.applyFilters();
  }

  filterByHasPoints(event: Event): void {
    this.hasPointsFilter = (event.target as HTMLSelectElement).value as '' | 'yes' | 'no';
    this.applyFilters();
  }

  filterByKms(event: Event): void {
    this.kmsFilter = (event.target as HTMLSelectElement).value as '' | 'present' | 'absent';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.lockFilter = '';
    this.hasPointsFilter = '';
    this.kmsFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('bvSearch') as HTMLInputElement | null;
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
          resource.backupVaultName,
          this.getAccountLabel(resource),
          resource.region,
          resource.encryptionKeyArn,
          nameTag
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;

      if (this.lockFilter === 'locked' && !resource.locked) return false;
      if (this.lockFilter === 'unlocked' && !!resource.locked) return false;

      if (this.hasPointsFilter === 'yes' && (resource.numberOfRecoveryPoints ?? 0) === 0) return false;
      if (this.hasPointsFilter === 'no' && (resource.numberOfRecoveryPoints ?? 0) > 0) return false;

      const hasKms = !!(resource.encryptionKeyArn && resource.encryptionKeyArn.trim().length > 0);
      if (this.kmsFilter === 'present' && !hasKms) return false;
      if (this.kmsFilter === 'absent' && hasKms) return false;

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

  private getSortValue(resource: BackupVault, column: ColumnKey): string | number {
    switch (column) {
      case 'numberOfRecoveryPoints':
        return resource.numberOfRecoveryPoints ?? 0;
      case 'latestRecoveryPointAgeDays':
        return this.normalizeAgeSort(resource.latestRecoveryPointAgeDays);
      case 'locked':
        return resource.locked ? 1 : 0;
      case 'accountName':
        return this.getAccountLabel(resource);
      case 'createdAt':
      case 'updatedAt':
        return (resource as any)[column] ? new Date((resource as any)[column] as string).getTime() : 0;
      case 'backupVaultName':
        return (resource.backupVaultName || '').toLowerCase();
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
  showDetails(resource: BackupVault): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // === Render helpers ======================================================
  getColumnValue(column: ColumnDefinition, resource: BackupVault): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return this.formatNumber(value);
    return String(value);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getColumnClass(key: ColumnKey, resource: BackupVault): string {
    if (key === 'numberOfRecoveryPoints') {
      return (resource.numberOfRecoveryPoints ?? 0) > 0 ? 'status-running' : 'status-stopped';
    }
    if (key === 'locked') {
      return resource.locked ? 'status-running' : '';
    }
    return '';
  }

  getBadgeClass(resource: BackupVault): string {
    if (resource.locked) return 'status-running';
    if ((resource.numberOfRecoveryPoints ?? 0) === 0) return 'status-stopped';
    return '';
  }

  getBadgeLabel(resource: BackupVault): string {
    if (resource.locked) return 'Locked';
    const pts = resource.numberOfRecoveryPoints ?? 0;
    return pts > 0 ? `${this.formatNumber(pts)} points` : 'Empty';
  }

  getDisplayName(resource: BackupVault): string {
    const tagName = this.extractNameTag(resource.tags);
    return tagName || resource.backupVaultName || 'Unnamed Vault';
  }

  // === Export ==============================================================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: BackupVault) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'backup-vaults.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: BackupVault) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'backup-vaults.xlsx');
  }

  // === Utils ===============================================================
  getAccountLabel(resource: BackupVault): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
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

  formatAgeDays(value?: number | null): string {
    if (value === null || value === undefined || value < 0) return 'None';
    if (value === 0) return 'Today';
    return `${this.formatNumber(value)} day${value === 1 ? '' : 's'}`;
  }

  normalizeAgeSort(value?: number | null): number {
    // Para ordenação: trate -1 (None) como muito grande para ir ao final.
    if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;
    if (value < 0) return Number.MAX_SAFE_INTEGER;
    return value;
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
