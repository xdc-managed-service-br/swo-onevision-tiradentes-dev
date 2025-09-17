import { Component, OnInit, OnDestroy } from '@angular/core';
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
  transform?: (resource: S3Bucket) => string;
}

type ColumnKey = keyof S3Bucket;

@Component({
  selector: 'app-s3-buckets',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './s3-buckets.component.html',
})
export class S3BucketsComponent implements OnInit, OnDestroy {
  // Data
  resources: S3Bucket[] = [];
  filteredResources: S3Bucket[] = [];
  paginatedResources: S3Bucket[] = [];
  loading = true;
  selectedResource: S3Bucket | null = null;

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Search & filters
  searchTerm = '';
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  regionFilter = '';
  accountFilter = '';
  lifecycleFilter = ''; // '', 'true', 'false'

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Columns customization
  showColumnCustomizer = false;
  selectedColumns: Set<string> = new Set();

  availableColumns: ColumnDefinition[] = [
    { key: 'bucketName',        label: 'Bucket Name',  sortable: true },
    { key: 'bucketNameTag',     label: 'Name Tag',     sortable: true },
    { key: 'hasLifecycleRules', label: 'Lifecycle',    sortable: true, transform: (r) => r.hasLifecycleRules ? 'Enabled' : 'Disabled' },
    { key: 'objectCount',       label: 'Objects',      sortable: true, transform: (r) => this.formatNumber(r.objectCount ?? 0) },
    // ⬇️ AGORA É STRING PURA (sem conversão)
    { key: 'storageBytes',      label: 'Storage Used', sortable: true, transform: (r) => r.storageBytes || 'N/A' },
    { key: 'region',            label: 'Region',       sortable: true },
    { key: 'accountId',         label: 'Account ID',   sortable: true },
    { key: 'accountName',       label: 'Account Name', sortable: true },
    { key: 'createdAt',         label: 'Created',      sortable: true, transform: (r) => this.formatDate(r.createdAt) },
  ];

  defaultColumns = [
    'bucketName',
    'bucketNameTag',
    'hasLifecycleRules',
    'objectCount',
    'storageBytes',
    'region',
    'accountName',
    'createdAt',
  ];

  requiredColumns = ['bucketName'];
  private readonly LS_KEY = 's3-columns';

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

  // === Load ===
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('S3Bucket')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Nada de parse/conversão aqui — mantemos storageBytes como veio
          this.resources = (data || []) as S3Bucket[];

          const nonEmpty = (value: string | null | undefined): value is string => !!value && value.trim().length > 0;

          this.filteredResources = [...this.resources];
          this.uniqueRegions = [...new Set(this.resources.map(r => r.region).filter(nonEmpty))].sort();
          this.uniqueAccounts = [...new Set(this.resources.map(r => r.accountName || r.accountId).filter(nonEmpty))].sort();
          this.recomputePagination();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading S3 buckets:', err);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // === Columns modal ===
  openColumnCustomizer(): void { this.showColumnCustomizer = true; }
  closeColumnCustomizer(): void { this.showColumnCustomizer = false; }

  toggleColumn(key: string): void {
    if (this.isRequiredColumn(key)) return;
    if (this.selectedColumns.has(key)) this.selectedColumns.delete(key);
    else this.selectedColumns.add(key);
  }

  isColumnSelected(key: string): boolean { return this.selectedColumns.has(key); }
  isRequiredColumn(key: string): boolean { return this.requiredColumns.includes(key); }

  selectAllColumns(): void { this.availableColumns.forEach(col => this.selectedColumns.add(col.key)); }
  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach(k => this.selectedColumns.add(k));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter(col => this.selectedColumns.has(col.key));
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (e) { console.warn('Could not save column preferences:', e); }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach(k => this.selectedColumns.add(k));
      }
    } catch {
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // === Search / Filters ===
  searchBuckets(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  filterByRegion(e: Event): void    { this.regionFilter    = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByAccount(e: Event): void   { this.accountFilter   = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByLifecycle(e: Event): void { this.lifecycleFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }

  applyFilters(): void {
    this.filteredResources = this.resources.filter(r => {
      // busca: só bucketName e bucketNameTag
      if (this.searchTerm) {
        const name = r.bucketName?.toLowerCase() ?? '';
        const tag  = r.bucketNameTag?.toLowerCase() ?? '';
        if (!name.includes(this.searchTerm) && !tag.includes(this.searchTerm)) return false;
      }
      if (this.regionFilter && r.region !== this.regionFilter) return false;
      if (this.accountFilter && (r.accountName || r.accountId) !== this.accountFilter) return false;
      if (this.lifecycleFilter) {
        const expected = this.lifecycleFilter === 'true';
        if (Boolean(r.hasLifecycleRules) !== expected) return false;
      }
      return true;
    });

    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  resetFilters(): void {
    this.regionFilter = this.accountFilter = this.lifecycleFilter = '';
    this.searchTerm = '';
    const searchInput = document.getElementById('s3Search') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    this.filteredResources = [...this.resources];
    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  // === Sorting ===
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortColumn = column; this.sortDirection = 'asc'; }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const A = (a as any)[column];
      const B = (b as any)[column];

      if (column === 'createdAt') {
        const da = A ? new Date(A).getTime() : 0;
        const db = B ? new Date(B).getTime() : 0;
        return (da - db) * dir;
      }
      if (column === 'objectCount') {
        const na = typeof A === 'number' ? A : parseInt(A ?? '0', 10) || 0;
        const nb = typeof B === 'number' ? B : parseInt(B ?? '0', 10) || 0;
        return (na - nb) * dir;
      }
      // storageBytes agora é STRING: ordena alfabeticamente
      if (typeof A === 'string' && typeof B === 'string') {
        return A.localeCompare(B) * dir;
      }
      if (typeof A === 'boolean' && typeof B === 'boolean') {
        const va = A ? 1 : 0, vb = B ? 1 : 0;
        return (va - vb) * dir;
      }
      return 0;
    });

    this.updatePaginationAfterChange();
  }

  // === Pagination ===
  recomputePagination(): void {
    const total = this.filteredResources?.length ?? 0;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end   = total === 0 ? 0 : Math.min(start + this.pageSize, total);
    this.paginatedResources = (this.filteredResources ?? []).slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  updatePaginationAfterChange(): void { this.currentPage = 1; this.recomputePagination(); }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages);
    if (clamped !== this.currentPage) {
      this.currentPage = clamped;
      this.recomputePagination();
    }
  }

  goToFirstPage(): void { if (this.currentPage !== 1) { this.currentPage = 1; this.recomputePagination(); } }
  goToLastPage(): void  { if (this.currentPage !== this.totalPages) { this.currentPage = this.totalPages; this.recomputePagination(); } }
  goToPreviousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.recomputePagination(); } }
  goToNextPage(): void     { if (this.currentPage < this.totalPages) { this.currentPage++; this.recomputePagination(); } }

  // === Modal ===
  showDetails(r: S3Bucket): void { this.selectedResource = r; }
  closeDetails(): void { this.selectedResource = null; }

  // === Cell helpers ===
  getColumnValue(column: ColumnDefinition, resource: S3Bucket): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key as keyof S3Bucket];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  getColumnClass(key: ColumnKey, resource: S3Bucket): string {
    if (key === 'hasLifecycleRules') return resource.hasLifecycleRules ? 'status-running' : 'status-stopped';
    return '';
  }

  // === Export ===
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const filename = 's3-buckets.csv';
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: S3Bucket) => (r as any)[col.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, cols, filename);
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const filename = 's3-buckets.xlsx';
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: S3Bucket) => (r as any)[col.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, cols, filename);
  }

  // === Utils ===
  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
  }

  formatNumber(n: number): string {
    try { return new Intl.NumberFormat().format(n); } catch { return String(n); }
  }
}
