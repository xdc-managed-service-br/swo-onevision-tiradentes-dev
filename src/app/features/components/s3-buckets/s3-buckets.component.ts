// src/app/features/components/s3-buckets/s3-buckets.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { S3Bucket } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  // transform recebe o recurso e retorna string formatada para render/export
  transform?: (resource: S3Bucket) => string;
}

// chaves das colunas (inclui 'displayName' virtual)
type ColumnKey =
  | 'displayName'
  | 'bucketName'
  | 'hasLifecycleRules'
  | 'objectCount'
  | 'storageBytes'
  | 'encryption'
  | 'versioning'
  | 'publicAccessBlock'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

@Component({
  selector: 'app-s3-buckets',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './s3-buckets.component.html'
})
export class S3BucketsComponent implements OnInit, OnDestroy {
  resources: S3Bucket[] = [];
  filteredResources: S3Bucket[] = [];
  paginatedResources: S3Bucket[] = [];
  loading = true;
  selectedResource: S3Bucket | null = null;

  // filtros
  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  lifecycleFilter: '' | 'yes' | 'no' = '';
  encryptionFilter = ''; // '', 'AES256', 'aws:kms', 'None'
  versioningFilter = ''; // '', 'Enabled', 'Suspended', 'None'
  pabFilter: '' | 'enabled' | 'disabled' = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueEncryptions: string[] = [];
  uniqueVersioning: string[] = [];

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  private readonly LS_KEY = 's3-buckets-columns';
  private readonly destroy$ = new Subject<void>();

  // definição de colunas
  availableColumns: ColumnDefinition[] = [
    {
      key: 'displayName',
      label: 'Name',
      sortable: true,
      transform: (r) => this.getDisplayName(r)
    },
    { key: 'bucketName', label: 'Bucket', sortable: true },
    {
      key: 'hasLifecycleRules',
      label: 'Lifecycle',
      sortable: true,
      transform: (r) => this.boolToYesNo(r.hasLifecycleRules)
    },
    {
      key: 'objectCount',
      label: 'Objects',
      sortable: true,
      transform: (r) => this.formatNumber(r.objectCount)
    },
    {
      key: 'storageBytes',
      label: 'Storage',
      sortable: true, // ordena usando parse pra bytes
      transform: (r) => r.storageBytes ?? 'N/A'
    },
    { key: 'encryption', label: 'Encryption', sortable: true },
    { key: 'versioning', label: 'Versioning', sortable: true },
    {
      key: 'publicAccessBlock',
      label: 'Public Access Block',
      sortable: true,
      transform: (r) => this.boolToYesNo(r.publicAccessBlock)
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

  // colunas default (podem ser ajustadas)
  defaultColumns: ColumnKey[] = [
    'displayName',
    'bucketName',
    'hasLifecycleRules',
    'objectCount',
    'storageBytes',
    'encryption',
    'publicAccessBlock',
    'region',
    'accountName',
    'createdAt'
  ];

  // bucketName é essencial para identificar
  requiredColumns: ColumnKey[] = ['bucketName'];

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

  // ================== Data ==================
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('S3Bucket')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const list = (data as S3Bucket[]) || [];
          // já vem normalizado pelo ResourceProcessorService
          this.resources = list.map((r) => ({
            ...r,
            // normalizações adicionais defensivas
            encryption: r.encryption ?? 'None',
            versioning: r.versioning ?? 'None',
            publicAccessBlock: r.publicAccessBlock ?? false
          }));

          this.filteredResources = [...this.resources];
          this.uniqueRegions = this.buildUniqueList(this.resources.map((i) => i.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((i) => this.getAccountLabel(i)));
          this.uniqueEncryptions = this.buildUniqueList(this.resources.map((i) => i.encryption || 'None'));
          this.uniqueVersioning = this.buildUniqueList(this.resources.map((i) => i.versioning || 'None'));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading S3 Buckets:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // ================== Columns ==================
  openColumnCustomizer(): void { this.showColumnCustomizer = true; }
  closeColumnCustomizer(): void { this.showColumnCustomizer = false; }

  toggleColumn(key: ColumnKey): void {
    if (this.isRequiredColumn(key)) return;
    if (this.selectedColumns.has(key)) this.selectedColumns.delete(key);
    else this.selectedColumns.add(key);
  }

  isColumnSelected(key: ColumnKey): boolean {
    return this.selectedColumns.has(key);
  }

  isRequiredColumn(key: ColumnKey): boolean {
    return this.requiredColumns.includes(key);
  }

  selectAllColumns(): void {
    this.availableColumns.forEach((c) => this.selectedColumns.add(c.key));
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach((c) => this.selectedColumns.add(c));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((c) => this.selectedColumns.has(c.key));
  }

  private saveColumnPreferences(): void {
    try {
      localStorage.setItem(this.LS_KEY, JSON.stringify(Array.from(this.selectedColumns)));
    } catch (e) {
      console.warn('Could not save S3 column preferences:', e);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length) {
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((k) => this.selectedColumns.add(k));
      }
    } catch (e) {
      console.warn('Could not load S3 column preferences:', e);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // ================== Search & Filters ==================
  searchBuckets(event: Event): void {
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

  filterByLifecycle(event: Event): void {
    this.lifecycleFilter = (event.target as HTMLSelectElement).value as '' | 'yes' | 'no';
    this.applyFilters();
  }

  filterByEncryption(event: Event): void {
    this.encryptionFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByVersioning(event: Event): void {
    this.versioningFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByPAB(event: Event): void {
    this.pabFilter = (event.target as HTMLSelectElement).value as '' | 'enabled' | 'disabled';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.lifecycleFilter = '';
    this.encryptionFilter = '';
    this.versioningFilter = '';
    this.pabFilter = '';
    this.searchTerm = '';
    const searchInput = document.getElementById('s3BucketSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    this.filteredResources = [...this.resources];

    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  private applyFilters(): void {
    const term = this.searchTerm;

    this.filteredResources = this.resources.filter((r) => {
      if (term) {
        const haystack = [
          this.getDisplayName(r),
          r.bucketName,
          this.getAccountLabel(r),
          r.encryption || 'None',
          r.versioning || 'None'
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && r.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(r) !== this.accountFilter) return false;

      if (this.lifecycleFilter === 'yes' && !r.hasLifecycleRules) return false;
      if (this.lifecycleFilter === 'no' && !!r.hasLifecycleRules) return false;

      if (this.encryptionFilter && (r.encryption || 'None') !== this.encryptionFilter) return false;
      if (this.versioningFilter && (r.versioning || 'None') !== this.versioningFilter) return false;

      if (this.pabFilter === 'enabled' && !r.publicAccessBlock) return false;
      if (this.pabFilter === 'disabled' && !!r.publicAccessBlock) return false;

      return true;
    });

    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  // ================== Sorting ==================
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

  private getSortValue(resource: S3Bucket, column: ColumnKey): string | number {
    switch (column) {
      case 'displayName':
        return this.getDisplayName(resource).toLowerCase();
      case 'objectCount':
        return resource.objectCount ?? 0;
      case 'storageBytes':
        return this.parseHumanSizeToBytes(resource.storageBytes);
      case 'accountName':
        return this.getAccountLabel(resource);
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      default:
        const value = (resource as any)[column];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return value.toLowerCase();
        if (typeof value === 'boolean') return value ? 1 : 0;
        return 0;
    }
  }

  // ================== Pagination ==================
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
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages);
    if (target !== this.currentPage) {
      this.currentPage = target;
      this.recomputePagination();
    }
  }
  goToFirstPage(): void { if (this.currentPage !== 1) { this.currentPage = 1; this.recomputePagination(); } }
  goToLastPage(): void { if (this.currentPage !== this.totalPages) { this.currentPage = this.totalPages; this.recomputePagination(); } }
  goToPreviousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.recomputePagination(); } }
  goToNextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.recomputePagination(); } }

  // ================== Modals ==================
  showDetails(resource: S3Bucket): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // ================== Render helpers ==================
  getColumnValue(column: ColumnDefinition, resource: S3Bucket): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getBooleanStatusClass(value: boolean | undefined | null): string {
    return value ? 'status-available' : 'status-terminated';
  }

  getColumnClass(key: ColumnKey, resource: S3Bucket): string {
    if (key === 'publicAccessBlock') {
      return resource.publicAccessBlock ? 'status-running' : 'status-stopped';
    }
    if (key === 'hasLifecycleRules') {
      return resource.hasLifecycleRules ? 'status-running' : 'status-stopped';
    }
    return '';
  }

  getDisplayName(r: S3Bucket): string {
    return r.bucketNameTag || r.bucketName || 'Unnamed Bucket';
    }

  getAccountLabel(resource: S3Bucket): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  // ================== Export ==================
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((r: S3Bucket) => (r as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 's3-buckets.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((r: S3Bucket) => (r as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 's3-buckets.xlsx');
  }

  // ================== Utils ==================
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

  boolToYesNo(v: boolean | undefined | null): string {
    if (v === undefined || v === null) return 'N/A';
    return v ? 'Yes' : 'No';
  }

  // Converte "59.28 TB" -> bytes para sort
  private parseHumanSizeToBytes(s?: string | null): number {
    if (!s) return 0;
    const str = String(s).trim();
    const m = str.match(/^([\d.,]+)\s*([A-Za-z]+)$/);
    if (!m) {
      // pode estar em bytes numéricos direto
      const num = Number(str.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    }
    const value = Number(m[1].replace(',', ''));
    const unit = m[2].toUpperCase();
    const map: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
      PB: 1024 ** 5
    };
    const mult = map[unit] ?? 1;
    return value * mult;
  }
}