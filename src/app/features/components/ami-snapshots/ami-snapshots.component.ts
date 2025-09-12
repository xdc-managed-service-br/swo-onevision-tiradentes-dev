import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { TagFormatter } from '../../../shared/utils/tag-formatter';

interface Tag {
  Key: string;
  Value: string;
}
interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  transform?: (row: any) => string;
  required?: boolean;
}

@Component({
  selector: 'app-ami-snapshots',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceTagsComponent],
  templateUrl: './ami-snapshots.component.html',
  styleUrls: [
    '../../../shared/styles/onevision-base.css'
  ]
})
export class AMISnapshotsComponent implements OnInit, OnDestroy {
  resources: any[] = [];
  filteredResources: any[] = [];
  loading = true;
  selectedResource: any = null;
  showColumnCustomizer = false;

  // Filtros padrão (para TODOS os componentes)
  regionFilter = '';
  accountFilter = '';
  searchTerm = '';
  
  // === Pagination state ===
  pageSize = 50;                 
  currentPage = 1;
  totalPages = 1;
  paginatedResources: any[] = []; 
  pageStartIndex = 0;            
  pageEndIndex = 0;              
  
  // Filtro opcional específico do AMI
  platformFilter = '';

  // Opções únicas (sem mock — derivadas do dataset)
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniquePlatforms: string[] = [];

  // Ordenação
  sortColumn: string = 'creationTime';
  sortDirection: 'asc' | 'desc' = 'desc';

  // ======= AMI FIELDS =======
  availableColumns: ColumnDefinition[] = [
    { key: 'imageId', label: 'Image ID', required: true },
    { key: 'nameTag', label: 'Name Tag' },
    { key: 'amiName', label: 'AMI Name' },
    { key: 'imageName', label: 'Image Name' },
    { key: 'imageState', label: 'State' },
    { key: 'platform', label: 'Platform' },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'region', label: 'Region' },
    { key: 'accountId', label: 'Account ID' },
    { key: 'accountName', label: 'Account Name' },
    { key: 'creationTime', label: 'Creation Time',
      transform: (r) => this.formatDate(r.creationTime) }
  ];
  
  // Default columns to show
  defaultColumns = ['imageId', 'nameTag', 'amiName', 'platform', 'region', 'creationTime', 'accountName'];
  private readonly LS_KEY = 'amiSelectedColumns';
  selectedColumns = new Set<string>();
  
  // Required columns that cannot be deselected
  requiredColumns = ['imageId'];
  
  private destroy$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {
    // Initialize selected columns with defaults
    this.selectedColumns = new Set(this.defaultColumns);
    
    // Load saved column preferences from localStorage
    this.loadColumnPreferences();
  }

  ngOnInit(): void {
    this.loadResources();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadResources(): void {
    this.loading = true;

    this.resourceService.getResourcesByType('AMI')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map(resource => {
            const parsedTagsObj = TagFormatter.parseTags(resource.tags);
            const parsedTagsArray: Tag[] = Object.entries(parsedTagsObj).map(([key, value]) => ({
              Key: key,
              Value: value
            }));
            
            return {
              imageId: resource.imageId || resource.id || resource.resourceId,
              amiName: resource.amiName || resource.name || resource.imageName,
              imageName: resource.imageName || resource.amiName || resource.name,
              nameTag: parsedTagsObj['Name'] || '',
              imageState: resource.imageState || resource.state || resource.status,
              description: resource.description || '',
              platform: resource.platform || resource.platformDetails || 'Unknown',
              region: resource.region,
              accountId: resource.accountId,
              accountName: resource.accountName,
              parsedTags: parsedTagsArray,
              tagObject: parsedTagsObj,
              tags: resource.tags, // Keep original tags for ResourceTagsComponent
              creationTime: resource.creationTime || resource.createdAt || resource.lastUpdated
            };
          });

          // opções de filtro (derivadas dos dados carregados)
          this.uniqueRegions = Array.from(new Set(this.resources.map(r => r.region))).filter(Boolean).sort();
          this.uniqueAccounts = Array.from(new Set(this.resources.map(r => r.accountName || r.accountId))).filter(Boolean).sort();
          this.uniquePlatforms = Array.from(new Set(this.resources.map(r => r.platform))).filter(Boolean).sort();

          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load AMI snapshots:', err);
          this.loading = false;
        }
      });
  }

  // Recalcula cortes/páginas sempre que a lista ou a página mudarem
  private recomputePagination(): void {
    const total = this.filteredResources?.length ?? 0;

    // garante pelo menos 1 página mesmo com lista vazia
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));

    // clamp da página atual
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = (this.filteredResources ?? []).slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  // Use quando filtros/busca/sort mudarem a lista
  updatePaginationAfterChange(): void {
    this.currentPage = 1;
    this.recomputePagination();
  }

  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  // Filter by region
  filterByRegion(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.regionFilter = value;
    this.applyFilters();
  }

  // Filter by platform
  filterByPlatform(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.platformFilter = value;
    this.applyFilters();
  }

  // Filter by account ID
  filterByAccount(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.accountFilter = value;
    this.applyFilters();
  }

  // ------- filtros & busca -------
  applyFilters(): void {
    const term = (this.searchTerm || '').toLowerCase();

    this.filteredResources = this.resources
      .filter(r => !this.regionFilter || r.region === this.regionFilter)
      .filter(r => !this.accountFilter || r.accountName === this.accountFilter || r.accountId === this.accountFilter)
      .filter(r => !this.platformFilter || r.platform === this.platformFilter)
      .filter(r => {
        if (!term) return true;
        return (r.imageId || '').toLowerCase().includes(term)
            || (r.nameTag || '').toLowerCase().includes(term)
            || (r.amiName || '').toLowerCase().includes(term)
            || (r.imageName || '').toLowerCase().includes(term)
            || (r.description || '').toLowerCase().includes(term);
      });

    this.sortData(this.sortColumn, false);
    this.updatePaginationAfterChange(); // Add pagination update
  }

  resetFilters(): void {
    this.platformFilter = '';
    this.regionFilter = '';
    this.accountFilter = '';
    this.searchTerm = '';

    // Reset select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    // Reset search input
    const searchInput = document.getElementById('amiSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.filteredResources = [...this.resources];
    this.updatePaginationAfterChange(); // Add pagination update
  }

  // ------- ordenação -------
  sortData(column: string, toggleDir = true): void {
    if (toggleDir) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
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
    
    this.recomputePagination(); // Add pagination update
  }

  showDetails(r: any): void {
    this.selectedResource = r;
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // Close details modal
  closeDetails(): void {
    this.selectedResource = null;
  }

  // ------- columns modal -------
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
    this.availableColumns.forEach(col => {
      this.selectedColumns.add(col.key);
    });
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    // Keep required columns selected
    this.requiredColumns.forEach(key => {
      this.selectedColumns.add(key);
    });
  }

  shouldBeFullWidth(key: string): boolean {
    // Determine which fields should take full width in mobile cards
    return ['instanceName', 'platformDetails', 'amiName', 'privateIps', 'publicIps'].includes(key);
  }

  // Save and load column preferences
  saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.warn('Could not save column preferences:', e);
    }
  }

  loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (saved) {
        const preferences = JSON.parse(saved);
        this.selectedColumns = new Set(preferences);
        // Ensure required columns are always included
        this.requiredColumns.forEach(key => {
          this.selectedColumns.add(key);
        });
      }
    } catch (e) {
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  applyColumnSelection(): void {
    // Save preferences to localStorage
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter(col => this.selectedColumns.has(col.key));
  }

  getColumnValue(column: ColumnDefinition, resource: any): string {
    if (column.transform) {
      return column.transform(resource);
    }
    
    const value = resource[column.key];
    
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  }

  // ------- helpers -------
  formatDate(value?: string | number | Date): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
  }

  getPlatformClass(platform: string): string {
    if (!platform) return '';
    return `ov-badge ov-badge--${platform.toLowerCase()}`;
  }

  getColumnClass(columnKey: string, resource: any): string {
    if (columnKey === 'platform') {
      return this.getPlatformClass(resource.platform);
    }
    return '';
  }

  // Updated Export to CSV method using only visible columns
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    
    const filename = 'ami-snapshots.csv';
    
    // Get only the visible columns for export
    const visibleColumns = this.getVisibleColumns();
    const exportColumns: ExportColumn[] = visibleColumns.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform || ((resource) => resource[col.key])
    }));
    
    this.exportService.exportDataToCSV(
      this.filteredResources,
      exportColumns,
      filename
    );
  }

  // Helpers de navegação
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    const halfVisible = Math.floor(maxVisible / 2);
    
    // If total pages is less than maxVisible, show all
    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }
    
    // Calculate start and end of visible page numbers
    let start = Math.max(1, this.currentPage - halfVisible);
    let end = Math.min(this.totalPages, this.currentPage + halfVisible);
    
    // Adjust if we're near the beginning or end
    if (this.currentPage <= halfVisible) {
      end = Math.min(this.totalPages, maxVisible);
    } else if (this.currentPage >= this.totalPages - halfVisible) {
      start = Math.max(1, this.totalPages - maxVisible + 1);
    }
    
    // Generate the page numbers
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
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