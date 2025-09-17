import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';

interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  transform?: (row: any) => string;
  required?: boolean;
}

@Component({
  selector: 'app-ebs-snapshots',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceTagsComponent],
  templateUrl: './ebs-snapshots.component.html',
})
export class EBSSnapshotsComponent implements OnInit, OnDestroy {
  resources: any[] = [];
  filteredResources: any[] = [];
  paginatedResources: any[] = [];
  loading = true;
  selectedResource: any = null;

  // Filtros
  regionFilter = '';
  accountFilter = '';
  stateFilter = '';
  encryptedFilter = '';
  searchTerm = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueStates: string[] = [];

  // Ordenação
  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Colunas
  availableColumns: ColumnDefinition[] = [
    { key: 'snapshotId', label: 'Snapshot ID', required: true },
    { key: 'snapshotName', label: 'Name' },
    { key: 'snapshotState', label: 'State' },
    { key: 'volumeSize', label: 'Volume Size (GiB)' },
    { key: 'region', label: 'Region' },
    { key: 'accountName', label: 'Account Name' },
    { key: 'createdAt', label: 'Created', transform: (r) => this.formatDate(r.createdAt) },
    { key: 'encrypted', label: 'Encrypted', transform: (r) => (r.encrypted ? 'Yes' : 'No') },
  ];
  defaultColumns = ['snapshotId', 'snapshotName', 'snapshotState', 'volumeSize', 'region', 'accountName', 'createdAt'];
  selectedColumns = new Set<string>(this.defaultColumns);
  requiredColumns = ['snapshotId'];

  // ===== PAGINAÇÃO (igual AMI) =====
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {}

  ngOnInit(): void {
    this.loadResources();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadResources(): void {
    this.loading = true;
    this.resourceService.getResourcesByType('EBSSnapshot')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map(r => ({
            snapshotId: r.snapshotId || r.id,
            snapshotName: r.snapshotName || 'N/A',
            snapshotState: r.snapshotState || r.state || r.status,
            volumeSize: r.volumeSize,
            region: r.region,
            accountId: r.accountId,
            accountName: r.accountName,
            createdAt: r.createdAt,
            encrypted: typeof r.encrypted === 'string' ? r.encrypted === 'true' : !!r.encrypted,
            tags: r.tags
          }));

          this.uniqueRegions = Array.from(new Set(this.resources.map(x => x.region))).filter(Boolean).sort();
          this.uniqueAccounts = Array.from(new Set(this.resources.map(x => x.accountName || x.accountId))).filter(Boolean).sort();
          this.uniqueStates = Array.from(new Set(this.resources.map(x => x.snapshotState))).filter(Boolean).sort();

          this.applyFilters();
          this.loading = false;
        },
        error: (err) => { console.error('Failed to load EBS snapshots:', err); this.loading = false; }
      });
  }

  // ===== FILTROS & BUSCA =====
  applyFilters(): void {
    const term = (this.searchTerm || '').trim().toLowerCase();

    this.filteredResources = this.resources
      .filter(r => !this.regionFilter || r.region === this.regionFilter)
      .filter(r => !this.accountFilter || r.accountName === this.accountFilter || r.accountId === this.accountFilter)
      .filter(r => !this.stateFilter || r.snapshotState === this.stateFilter)
      .filter(r => {
        if (this.encryptedFilter === '') return true;
        const isEnc = this.encryptedFilter === 'true';
        return r.encrypted === isEnc;
      })
      .filter(r => {
        if (!term) return true;
        const id = (r.snapshotId || '').toLowerCase();
        const name = (r.snapshotName || '').toLowerCase();
        return id.includes(term) || name.includes(term);
      });

    this.sortData(this.sortColumn, false);
    this.updatePaginationAfterChange();
  }

  filterByRegion(e: Event)  { this.regionFilter = (e.target as HTMLSelectElement).value;  this.applyFilters(); }
  filterByAccount(e: Event) { this.accountFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByState(e: Event)   { this.stateFilter = (e.target as HTMLSelectElement).value;   this.applyFilters(); }
  filterByEncrypted(e: Event){ this.encryptedFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = this.accountFilter = this.stateFilter = this.encryptedFilter = '';
    this.searchTerm = '';
    const searchInput = document.getElementById('ebsSnapSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('select').forEach(s => s.value = '');
    this.filteredResources = [...this.resources];
    this.updatePaginationAfterChange();
  }

  // ===== ORDENAÇÃO =====
  sortData(column: string, toggleDir = true): void {
    if (toggleDir) {
      if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      else { this.sortColumn = column; this.sortDirection = 'asc'; }
    } else {
      this.sortColumn = this.sortColumn || column;
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredResources.sort((a, b) => {
      const va = (a[column] ?? '').toString().toLowerCase();
      const vb = (b[column] ?? '').toString().toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    this.recomputePagination();
  }

  // ===== PAGINAÇÃO (mesmo algoritmo do AMI) =====
  private recomputePagination(): void {
    const total = this.filteredResources?.length ?? 0;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end   = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = (this.filteredResources ?? []).slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex   = end;
  }

  updatePaginationAfterChange(): void { this.currentPage = 1; this.recomputePagination(); }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 7;
    const half = Math.floor(maxVisible / 2);

    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, this.currentPage - half);
    let end   = Math.min(this.totalPages, this.currentPage + half);

    if (this.currentPage <= half) {
      end = Math.min(this.totalPages, maxVisible);
    } else if (this.currentPage >= this.totalPages - half) {
      start = Math.max(1, this.totalPages - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages);
    if (clamped !== this.currentPage) { this.currentPage = clamped; this.recomputePagination(); }
  }
  goToFirstPage(): void   { if (this.currentPage !== 1) { this.currentPage = 1; this.recomputePagination(); } }
  goToLastPage(): void    { if (this.currentPage !== this.totalPages) { this.currentPage = this.totalPages; this.recomputePagination(); } }
  goToPreviousPage(): void{ if (this.currentPage > 1) { this.currentPage--; this.recomputePagination(); } }
  goToNextPage(): void    { if (this.currentPage < this.totalPages) { this.currentPage++; this.recomputePagination(); } }

  // ===== Colunas =====
  openColumnCustomizer(){ /* opcional */ }
  closeColumnCustomizer(){ /* opcional */ }
  toggleColumn(key: string){ if (this.requiredColumns.includes(key)) return; this.selectedColumns.has(key) ? this.selectedColumns.delete(key) : this.selectedColumns.add(key); }
  isColumnSelected(key: string){ return this.selectedColumns.has(key); }
  isRequiredColumn(key: string){ return this.requiredColumns.includes(key); }
  selectAllColumns(){ this.availableColumns.forEach(c => this.selectedColumns.add(c.key)); }
  deselectAllColumns(){ this.selectedColumns.clear(); this.requiredColumns.forEach(k => this.selectedColumns.add(k)); }
  applyColumnSelection(){ this.closeColumnCustomizer(); }

  getVisibleColumns(): ColumnDefinition[] { return this.availableColumns.filter(c => this.selectedColumns.has(c.key)); }

  getColumnValue(col: ColumnDefinition, r: any): string {
    if (col.transform) return col.transform(r);
    const v = r[col.key];
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }

  getSnapshotStateClass(state?: string): string {
    const s = (state || '').toLowerCase();
    if (s === 'completed' || s === 'available') return 'status-running';
    if (s === 'pending') return 'status-pending';
    if (s === 'error' || s === 'failed') return 'status-stopped';
    return 'status-unknown';
  }

  getColumnClass(key: string, r: any): string {
    if (key === 'snapshotState') return this.getSnapshotStateClass(r.snapshotState);
    return '';
  }

  formatDate(value?: string | number | Date): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
  }

  // ===== Export =====
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(c => ({
      key: c.key, label: c.label, transform: c.transform || ((r) => r[c.key])
    }));
    this.exportService.exportDataToCSV(this.filteredResources, cols, 'ebs-snapshots.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(c => ({
      key: c.key, label: c.label, transform: c.transform || ((r) => r[c.key])
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, cols, 'ebs-snapshots.xlsx');
  }

  // Modal
  showDetails(r:any){ this.selectedResource = r; }
  closeDetails(){ this.selectedResource = null; }
}