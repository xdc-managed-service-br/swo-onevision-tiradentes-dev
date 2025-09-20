// src/app/features/components/backup-plans/backup-plans.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { BackupPlan } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: BackupPlan) => string;
}

type ColumnKey =
  | 'backupPlanName'
  | 'backupPlanId'
  | 'targetBackupVault'
  | 'schedules'
  | 'selectionTypesCount'
  | 'windowStart'
  | 'windowDuration'
  | 'lastExecutionDate'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-backup-plans',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './backup-plans.component.html'
})
export class BackupPlansComponent implements OnInit, OnDestroy {
  resources: BackupPlan[] = [];
  filteredResources: BackupPlan[] = [];
  paginatedResources: BackupPlan[] = [];
  loading = true;
  selectedResource: BackupPlan | null = null;

  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  vaultFilter = '';
  schedulePresence: '' | 'with' | 'without' = '';
  selectionTypeFilter = '';
  lastExecutionFilter: '' | 'recent' | 'stale' | 'never' = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueVaults: string[] = [];
  uniqueSelectionTypes: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  private readonly LS_KEY = 'backup-plans-columns';
  private readonly destroy$ = new Subject<void>();
  private readonly columnMinWidths: Record<string, number> = {
    backupPlanName: 200,
    backupPlanId: 180,
    targetBackupVault: 180,
    schedules: 240,
    selectionTypesCount: 150,
    windowStart: 150,
    windowDuration: 150,
    lastExecutionDate: 180,
    region: 140,
    accountName: 170,
    createdAt: 180,
    updatedAt: 180,
  };

  availableColumns: ColumnDefinition[] = [
    {
      key: 'backupPlanName',
      label: 'Name',
      sortable: true,
      transform: (resource) => this.getDisplayName(resource)
    },
    { key: 'backupPlanId', label: 'Plan ID', sortable: true },
    { key: 'targetBackupVault', label: 'Target Vault', sortable: true },
    {
      key: 'schedules',
      label: 'Schedules',
      sortable: false,
      transform: (r) => this.formatSchedules(r.schedules)
    },
    {
      key: 'selectionTypesCount',
      label: 'Resource Types',
      sortable: true,
      transform: (r) => this.formatNumber(this.normalizeStringArray(r.selectionResourceTypes).length)
    },
    { key: 'windowStart', label: 'Start Window (min)', sortable: true },
    { key: 'windowDuration', label: 'Duration (min)', sortable: true },
    {
      key: 'lastExecutionDate',
      label: 'Last Execution',
      sortable: true,
      transform: (r) => this.formatDate(r.lastExecutionDate)
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

  defaultColumns: ColumnKey[] = [
    'backupPlanName',
    'backupPlanId',
    'targetBackupVault',
    'schedules',
    'selectionTypesCount',
    'windowStart',
    'windowDuration',
    'region',
    'accountName',
    'createdAt'
  ];

  requiredColumns: ColumnKey[] = ['backupPlanId'];

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
      .getResourcesByType('BackupPlan')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as BackupPlan[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((i) => i.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((i) => this.getAccountLabel(i)));
          this.uniqueVaults = this.buildUniqueList(this.resources.map((i) => i.targetBackupVault));
          // coletar todos os tipos definidos nos planos
          const allTypes = this.resources.flatMap((i) => this.normalizeStringArray(i.selectionResourceTypes));
          this.uniqueSelectionTypes = this.buildUniqueList(allTypes);

          this.loading = false;
          this.currentPage = 1;

          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Backup Plans:', error);
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
      console.warn('Could not save Backup Plans column preferences:', error);
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
      console.warn('Could not load Backup Plans column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search & Filters =====================================================
  searchPlans(event: Event): void {
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

  filterByVault(event: Event): void {
    this.vaultFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterBySchedulePresence(event: Event): void {
    this.schedulePresence = (event.target as HTMLSelectElement).value as '' | 'with' | 'without';
    this.applyFilters();
  }

  filterByResourceType(event: Event): void {
    this.selectionTypeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByLastExecution(event: Event): void {
    this.lastExecutionFilter = (event.target as HTMLSelectElement).value as '' | 'recent' | 'stale' | 'never';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.vaultFilter = '';
    this.schedulePresence = '';
    this.selectionTypeFilter = '';
    this.lastExecutionFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('bpSearch') as HTMLInputElement | null;
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
          resource.backupPlanId,
          resource.backupPlanName,
          this.getAccountLabel(resource),
          resource.region,
          resource.targetBackupVault,
          this.formatSchedules(resource.schedules)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.vaultFilter && resource.targetBackupVault !== this.vaultFilter) return false;

      const hasSchedule = this.normalizeStringArray(resource.schedules).length > 0;
      if (this.schedulePresence === 'with' && !hasSchedule) return false;
      if (this.schedulePresence === 'without' && hasSchedule) return false;

      if (this.selectionTypeFilter) {
        const types = this.normalizeStringArray(resource.selectionResourceTypes);
        if (!types.includes(this.selectionTypeFilter)) return false;
      }

      if (this.lastExecutionFilter) {
        const rec = this.getExecutionRecency(resource);
        if (rec !== this.lastExecutionFilter) return false;
      }

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

  private getSortValue(resource: BackupPlan, column: ColumnKey): string | number {
    switch (column) {
      case 'selectionTypesCount':
        return this.normalizeStringArray(resource.selectionResourceTypes).length;
      case 'windowStart':
      case 'windowDuration':
        return (resource as any)[column] ?? 0;
      case 'lastExecutionDate':
        return resource.lastExecutionDate ? new Date(resource.lastExecutionDate).getTime() : 0;
      case 'accountName':
        return this.getAccountLabel(resource);
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date((resource as any)[column] as string).getTime() : 0;
      case 'backupPlanName':
        return (resource.backupPlanName || '').toLowerCase();
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
  showDetails(resource: BackupPlan): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // === Render helpers ======================================================
  getColumnValue(column: ColumnDefinition, resource: BackupPlan): string {
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

  getColumnClass(key: ColumnKey, resource: BackupPlan): string {
    if (key === 'lastExecutionDate') {
      const rec = this.getExecutionRecency(resource);
      return rec === 'recent' ? 'status-running' : rec === 'never' ? 'status-stopped' : '';
    }
    return '';
  }

  getDisplayName(resource: BackupPlan): string {
    return resource.backupPlanName || resource.backupPlanId || 'Unnamed Plan';
  }

  getExecutionBadgeClass(resource: BackupPlan): string {
    const rec = this.getExecutionRecency(resource);
    if (rec === 'recent') return 'status-running';
    if (rec === 'never') return 'status-stopped';
    return '';
  }

  getExecutionBadgeLabel(resource: BackupPlan): string {
    const rec = this.getExecutionRecency(resource);
    if (rec === 'recent') return 'Recent Run';
    if (rec === 'never') return 'Never Ran';
    return 'No Run in 24h';
  }

  getExecutionRecency(resource: BackupPlan): 'recent' | 'stale' | 'never' {
    if (!resource.lastExecutionDate) return 'never';
    const ts = new Date(resource.lastExecutionDate).getTime();
    if (Number.isNaN(ts)) return 'never';
    const now = Date.now();
    const diffMs = Math.max(0, now - ts);
    return diffMs <= 24 * 60 * 60 * 1000 ? 'recent' : 'stale';
  }

  // === Export ==============================================================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: BackupPlan) => {
        const v = (resource as any)[column.key];
        if (column.key === 'schedules') return this.formatSchedules(resource.schedules);
        if (column.key === 'selectionTypesCount') return String(this.normalizeStringArray(resource.selectionResourceTypes).length);
        return v ?? '';
      })
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'backup-plans.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: BackupPlan) => {
        const v = (resource as any)[column.key];
        if (column.key === 'schedules') return this.formatSchedules(resource.schedules);
        if (column.key === 'selectionTypesCount') return String(this.normalizeStringArray(resource.selectionResourceTypes).length);
        return v ?? '';
      })
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'backup-plans.xlsx');
  }

  // === Utils ===============================================================
  getAccountLabel(resource: BackupPlan): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  normalizeStringArray(value: unknown): string[] {
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
        } catch {
          // se veio uma string simples não-JSON, trate como único item
        }
      }
      return [trimmed];
    }
    return [];
  }

  formatSchedules(value: unknown): string {
    const list = this.normalizeStringArray(value);
    return list.length ? list.join(', ') : 'None';
  }

  formatSelectionTypes(value: unknown): string {
    const list = this.normalizeStringArray(value);
    return list.length ? list.join(', ') : 'None';
  }

  formatMinutes(value?: number | null): string {
    if (value === null || value === undefined) return 'N/A';
    return `${this.formatNumber(value)} min`;
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
