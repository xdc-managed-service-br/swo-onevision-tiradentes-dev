// src/app/features/components/ebs-volumes/ebs-volumes.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { EBSVolume } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (r: EBSVolume) => string;
}

type ColumnKey =
  | keyof EBSVolume
  | 'attachedInstances'; // exibição amigável (join)

@Component({
  selector: 'app-ebs-volumes',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './ebs-volumes.component.html',
})
export class EBSVolumesComponent implements OnInit, OnDestroy {
  // Data
  resources: EBSVolume[] = [];
  filteredResources: EBSVolume[] = [];
  paginatedResources: EBSVolume[] = [];
  loading = true;
  selectedResource: EBSVolume | null = null;

  // Filtros/busca
  searchTerm = '';
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  stateFilter = '';
  typeFilter = '';
  regionFilter = '';
  accountFilter = '';
  encryptedFilter: '' | 'true' | 'false' = '';
  attachedFilter: '' | 'true' | 'false' = '';

  // Ordenação
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Paginação
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Customização de colunas
  showColumnCustomizer = false;
  private readonly LS_KEY = 'ebs-columns';
  selectedColumns: Set<string> = new Set();

  availableColumns: ColumnDefinition[] = [
    { key: 'volumeId', label: 'Volume ID', sortable: true },
    { key: 'volumeName', label: 'Name', sortable: true },
    { key: 'volumeType', label: 'Type', sortable: true },
    { key: 'volumeState', label: 'State', sortable: true },
    { key: 'size', label: 'Size', sortable: true }, // vem do backend, não vou converter unidade
    { key: 'encrypted', label: 'Encrypted', sortable: true, transform: (r) => (r.encrypted ? 'Yes' : 'No') },
    { key: 'attachedInstances', label: 'Attached Instances', sortable: false, transform: (r) => (r.attachedInstances?.join(', ') || 'N/A') },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'accountId', label: 'Account ID', sortable: true },
    { key: 'accountName', label: 'Account Name', sortable: true },
    { key: 'createdAt', label: 'Created', sortable: true, transform: (r) => this.formatDate(r.createdAt) },
    { key: 'updatedAt', label: 'Updated', sortable: true, transform: (r) => this.formatDate(r.updatedAt) },
  ];

  defaultColumns = [
    'volumeId',
    'volumeName',
    'volumeType',
    'volumeState',
    'size',
    'encrypted',
    'attachedInstances',
    'region',
    'accountName',
    'createdAt',
  ];

  requiredColumns = ['volumeId'];

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

  // ===== Data =====
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('EBSVolume')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any[]) => {
          // Map API response to EBSVolume, converting null volumeName to undefined
          this.resources = data.map(item => ({
            ...item,
            volumeName: item.volumeName === null ? undefined : item.volumeName
          }));

          this.filteredResources = [...this.resources];
          this.uniqueStates = [...new Set(this.resources.map(r => r.volumeState).filter(Boolean))].sort();
          this.uniqueTypes  = [...new Set(this.resources.map(r => r.volumeType).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(this.resources.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(this.resources.map(r => r.accountName || r.accountId).filter(Boolean))].sort();

          this.recomputePagination();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading EBS volumes', err);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // ===== Colunas =====
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
    } catch (e) {
      console.warn('Could not save column preferences:', e);
    }
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

  // ===== Busca & Filtros =====
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

  filterByState(e: Event): void { this.stateFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByType(e: Event): void  { this.typeFilter  = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByRegion(e: Event): void{ this.regionFilter= (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByAccount(e: Event): void { this.accountFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByEncrypted(e: Event): void { this.encryptedFilter = ((e.target as HTMLSelectElement).value as any); this.applyFilters(); }
  filterByAttached(e: Event): void { this.attachedFilter = ((e.target as HTMLSelectElement).value as any); this.applyFilters(); }

  private recomputePagination(): void {
    const total = this.filteredResources?.length ?? 0;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);
    this.paginatedResources = (this.filteredResources ?? []).slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  updatePaginationAfterChange(): void { this.currentPage = 1; this.recomputePagination(); }

  applyFilters(): void {
    this.filteredResources = this.resources.filter(r => {
      if (this.searchTerm) {
        const id = r.volumeId?.toLowerCase() ?? '';
        const name = r.volumeName?.toLowerCase() ?? '';
        if (!id.includes(this.searchTerm) && !name.includes(this.searchTerm)) return false;
      }
      if (this.stateFilter && r.volumeState !== this.stateFilter) return false;
      if (this.typeFilter && r.volumeType !== this.typeFilter) return false;
      if (this.regionFilter && r.region !== this.regionFilter) return false;
      if (this.accountFilter && (r.accountName || r.accountId) !== this.accountFilter) return false;

      if (this.encryptedFilter) {
        const want = this.encryptedFilter === 'true';
        if (Boolean(r.encrypted) !== want) return false;
      }
      if (this.attachedFilter) {
        const wantAttached = this.attachedFilter === 'true';
        const isAttached = (r.attachedInstances?.length ?? 0) > 0;
        if (isAttached !== wantAttached) return false;
      }
      return true;
    });

    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  resetFilters(): void {
    this.stateFilter = this.typeFilter = this.regionFilter = this.accountFilter = '';
    this.encryptedFilter = this.attachedFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('ebsSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    this.filteredResources = [...this.resources];
    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  // ===== Ordenação =====
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortColumn = column; this.sortDirection = 'asc'; }

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const va = (a as any)[column];
      const vb = (b as any)[column];

      if (typeof va === 'number' && typeof vb === 'number') {
        return this.sortDirection === 'asc' ? va - vb : vb - va;
      }
      if (typeof va === 'boolean' && typeof vb === 'boolean') {
        return this.sortDirection === 'asc' ? (va === vb ? 0 : va ? 1 : -1) : (va === vb ? 0 : va ? -1 : 1);
      }
      const sa = (va ?? '').toString().toLowerCase();
      const sb = (vb ?? '').toString().toLowerCase();
      return this.sortDirection === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    this.updatePaginationAfterChange();
  }

  // ===== Helpers UI =====
  formatDate(d?: string): string {
    if (!d) return 'N/A';
    const date = new Date(d);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  }

  getStatusClass(state?: string): string {
    const s = (state || '').toLowerCase();
    if (s === 'in-use' || s === 'available') return 'status-running';
    if (s === 'creating' || s === 'attaching' || s === 'detaching') return 'status-pending';
    if (s === 'deleting' || s === 'deleted') return 'status-terminated';
    if (s === 'error') return 'status-stopped';
    return 'status-unknown';
  }

  getColumnValue(col: ColumnDefinition, r: EBSVolume): string {
    if (col.transform) return col.transform(r);
    const value = (r as any)[col.key as keyof EBSVolume];
    if (value === null || value === undefined) return 'N/A';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  getColumnClass(key: ColumnKey, r: EBSVolume): string {
    if (key === 'volumeState') return this.getStatusClass(r.volumeState);
    return '';
  }

  // ===== Export =====
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const filename = 'ebs-volumes.csv';
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: EBSVolume) => {
        if (col.key === 'attachedInstances') return r.attachedInstances?.join('; ') ?? '';
        return (r as any)[col.key] ?? '';
      })
    }));
    this.exportService.exportDataToCSV(this.filteredResources, cols, filename);
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const filename = 'ebs-volumes.xlsx';
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: EBSVolume) => {
        if (col.key === 'attachedInstances') return r.attachedInstances?.join('; ') ?? '';
        return (r as any)[col.key] ?? '';
      })
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, cols, filename);
  }

  // ==== Pagination helpers for template ====
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
}