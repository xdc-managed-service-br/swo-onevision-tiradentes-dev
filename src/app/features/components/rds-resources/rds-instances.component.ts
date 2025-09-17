import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { RDSInstance } from '../../../models/resource.model';

interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  transform?: (row: any) => string;
  required?: boolean;
}

@Component({
  selector: 'app-rds-instances',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceTagsComponent],
  // ✅ corrige o caminho do template:
  templateUrl: './rds-instances.component.html',
})
export class RDSInstancesComponent implements OnInit, OnDestroy {
  resources: RDSInstance[] = [];
  filteredResources: RDSInstance[] = [];
  paginatedResources: RDSInstance[] = [];
  loading = true;
  selectedResource: RDSInstance | null = null;

  // Filtros
  regionFilter = '';
  accountFilter = '';
  engineFilter = '';
  statusFilter = '';
  storageTypeFilter = '';
  searchTerm = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueEngines: string[] = [];
  uniqueStatuses: string[] = [];
  uniqueStorageTypes: string[] = [];

  // Ordenação
  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Colunas
  availableColumns: ColumnDefinition[] = [
    { key: 'dbInstanceId', label: 'DB Identifier', required: true },
    { key: 'dbInstanceName', label: 'Name' },
    { key: 'engine', label: 'Engine' },
    { key: 'engineVersion', label: 'Engine Version' },
    { key: 'instanceClass', label: 'Class' },
    { key: 'status', label: 'Status' },
    { key: 'allocatedStorage', label: 'Allocated (GiB)' },
    { key: 'storageType', label: 'Storage Type' },
    { key: 'region', label: 'Region' },
    { key: 'accountName', label: 'Account' },
    { key: 'createdAt', label: 'Created', transform: (r) => this.formatDate(r.createdAt) },
  ];
  defaultColumns = [
    'dbInstanceId','dbInstanceName','engine','engineVersion',
    'instanceClass','status','allocatedStorage','region','accountName','createdAt'
  ];
  requiredColumns = ['dbInstanceId'];
  selectedColumns = new Set<string>(this.defaultColumns);

  // Paginação (padrão AMI)
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

  ngOnInit(): void { this.loadResources(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadResources(): void {
    this.loading = true;
    this.resourceService.getResourcesByType('RDSInstance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map((r: any) => ({
            ...r,
            dbInstanceId: r.dbInstanceId || r.id,
            dbInstanceName: r.dbInstanceName || r.name || 'N/A',
            status: r.status,
            engine: r.engine,
            engineVersion: r.engineVersion,
            instanceClass: r.instanceClass,
            allocatedStorage: r.allocatedStorage,
            storageType: r.storageType,
            region: r.region,
            accountId: r.accountId,
            accountName: r.accountName,
            createdAt: r.createdAt,
            tags: r.tags
          }));

          const nonEmpty = (value: string | null | undefined): value is string => !!value && value.trim().length > 0;

          this.uniqueRegions = [...new Set(this.resources.map(x => x.region))].filter(nonEmpty).sort();
          this.uniqueAccounts = [...new Set(this.resources.map(x => x.accountName || x.accountId))].filter(nonEmpty).sort();
          this.uniqueEngines = [...new Set(this.resources.map(x => x.engine))].filter(nonEmpty).sort();
          this.uniqueStatuses = [...new Set(this.resources.map(x => x.status))].filter(nonEmpty).sort();
          this.uniqueStorageTypes = [...new Set(this.resources.map(x => x.storageType))].filter(nonEmpty).sort();

          this.applyFilters();
          this.loading = false;
        },
        error: (err) => { console.error('Failed to load RDS instances:', err); this.loading = false; }
      });
  }

  // ===== helpers de célula/estilo (evita 'as string' no HTML) =====
  getCellValue(column: ColumnDefinition, row: any): string {
    if (column.transform) return column.transform(row);
    const v = (row as any)[column.key];
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }
  getColumnClass(key: string, r: any): string {
    if (key === 'status') return this.getStatusClass(r.status);
    return '';
  }

  // ===== Filtros & busca =====
  applyFilters(): void {
    const term = (this.searchTerm || '').trim().toLowerCase();

    this.filteredResources = this.resources
      .filter(r => !this.regionFilter || r.region === this.regionFilter)
      .filter(r => !this.accountFilter || r.accountName === this.accountFilter || r.accountId === this.accountFilter)
      .filter(r => !this.engineFilter || r.engine === this.engineFilter)
      .filter(r => !this.statusFilter || r.status === this.statusFilter)
      .filter(r => !this.storageTypeFilter || r.storageType === this.storageTypeFilter)
      .filter(r => {
        if (!term) return true;
        const id = (r.dbInstanceId || '').toLowerCase();
        const name = (r.dbInstanceName || '').toLowerCase();
        return id.includes(term) || name.includes(term);
      });

    this.sortData(this.sortColumn, false);
    this.updatePaginationAfterChange();
  }

  filterByRegion(e: Event){ this.regionFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByAccount(e: Event){ this.accountFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByEngine(e: Event){ this.engineFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByStatus(e: Event){ this.statusFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByStorageType(e: Event){ this.storageTypeFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  clearSearch(input: HTMLInputElement){ input.value = ''; this.searchTerm = ''; this.applyFilters(); }

  resetFilters(): void {
    this.regionFilter = this.accountFilter = this.engineFilter = this.statusFilter = this.storageTypeFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('rdsSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    document.querySelectorAll<HTMLSelectElement>('select').forEach((selectEl) => {
      selectEl.value = '';
    });
    this.filteredResources = [...this.resources];
    this.updatePaginationAfterChange();
  }

  // ===== Ordenação =====
  sortData(column: string, toggleDir = true): void {
    if (toggleDir) {
      if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      else { this.sortColumn = column; this.sortDirection = 'asc'; }
    } else {
      this.sortColumn = this.sortColumn || column;
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources.sort((a: any, b: any) => {
      const va = a[column];
      const vb = b[column];

      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);

      if (column.toLowerCase().includes('date') || column === 'createdAt' || column === 'updatedAt') {
        const ta = va ? new Date(va).getTime() : 0;
        const tb = vb ? new Date(vb).getTime() : 0;
        return dir * (ta - tb);
      }

      const sa = (va ?? '').toString().toLowerCase();
      const sb = (vb ?? '').toString().toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });

    this.recomputePagination();
  }

  // ===== Paginação =====
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
    const maxVisible = 7, half = Math.floor(maxVisible / 2);
    if (this.totalPages <= maxVisible) return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    let start = Math.max(1, this.currentPage - half);
    let end   = Math.min(this.totalPages, this.currentPage + half);
    if (this.currentPage <= half) end = Math.min(this.totalPages, maxVisible);
    else if (this.currentPage >= this.totalPages - half) start = Math.max(1, this.totalPages - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
  goToPage(p: number){ const c = Math.min(Math.max(p,1), this.totalPages); if (c!==this.currentPage){ this.currentPage=c; this.recomputePagination(); } }
  goToFirstPage(){ if (this.currentPage!==1){ this.currentPage=1; this.recomputePagination(); } }
  goToLastPage(){ if (this.currentPage!==this.totalPages){ this.currentPage=this.totalPages; this.recomputePagination(); } }
  goToPreviousPage(){ if (this.currentPage>1){ this.currentPage--; this.recomputePagination(); } }
  goToNextPage(){ if (this.currentPage<this.totalPages){ this.currentPage++; this.recomputePagination(); } }

  // ===== Helpers =====
  formatDate(v?: string | number | Date){ if(!v) return 'N/A'; const d = new Date(v); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString(); }
  getStatusClass(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'available') return 'status-running';
    if (['creating','modifying','rebooting','backing-up','starting','maintenance'].includes(s)) return 'status-pending';
    if (['stopped','failed','deleting'].includes(s)) return 'status-stopped';
    return 'status-unknown';
  }

  // Colunas (modal simples – se for usar o customizer)
  openColumnCustomizer() {}
  closeColumnCustomizer() {}
  toggleColumn(key: string){ if (this.isRequiredColumn(key)) return; this.selectedColumns.has(key) ? this.selectedColumns.delete(key) : this.selectedColumns.add(key); }
  isColumnSelected(key: string){ return this.selectedColumns.has(key); }
  isRequiredColumn(key: string){ return this.requiredColumns.includes(key); }
  selectAllColumns(){ this.availableColumns.forEach(c => this.selectedColumns.add(c.key)); }
  deselectAllColumns(){ this.selectedColumns.clear(); this.requiredColumns.forEach(k => this.selectedColumns.add(k)); }
  applyColumnSelection(){ this.closeColumnCustomizer(); }

  getVisibleColumns(): ColumnDefinition[] { return this.availableColumns.filter(c => this.selectedColumns.has(c.key)); }

  // Export
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(c => ({
      key: c.key, label: c.label, transform: c.transform || ((row:any)=> row[c.key])
    }));
    this.exportService.exportDataToCSV(this.filteredResources, cols, 'rds-instances.csv');
  }
  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const cols: ExportColumn[] = visible.map(c => ({
      key: c.key, label: c.label, transform: c.transform || ((row:any)=> row[c.key])
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, cols, 'rds-instances.xlsx');
  }

  showDetails(r: RDSInstance){ this.selectedResource = r; }
  closeDetails(){ this.selectedResource = null; }
}
