import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { TagFormatter } from '../../../shared/utils/tag-formatter';

interface AMITag {
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
  imports: [CommonModule, FormsModule],
  templateUrl: './ami-snapshots.component.html',
  styleUrls: ['./ami-snapshots.component.css'] // pode ficar vazio; DS cobre quase tudo
})
export class AMISnapshotsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  resources: any[] = [];
  filteredResources: any[] = [];
  loading = false;
  selectedResource: any = null;
  showColumnCustomizer = false;

  // Filtros padrão (para TODOS os componentes)
  regionFilter = '';
  accountFilter = '';
  searchTerm = '';

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
  // imageId, imageName, imageState, description, platform, amiName
  availableColumns: ColumnDefinition[] = [
    { key: 'imageId',    label: 'Image ID', required: true },
    { key: 'nameTag',    label: 'Name Tag' },
    { key: 'amiName',    label: 'AMI Name' },
    { key: 'imageName',  label: 'Image Name' },
    { key: 'imageState', label: 'State' },
    { key: 'platform',   label: 'Platform' },
    { key: 'description',label: 'Description', sortable: false },
    { key: 'region',     label: 'Region' },
    { key: 'accountId',  label: 'Account ID' },
    { key: 'accountName',label: 'Account Name' },
    { key: 'creationTime', label: 'Creation Time',
      transform: (r) => this.formatDate(r.creationTime) }
  ];
  // Default columns to show
  defaultColumns = ['amiName', 'imageName', 'platform', 'description'];
  private readonly LS_KEY = 'amiSelectedColumns';
  selectedColumns = new Set<string>();

  constructor(private resourceService: ResourceService) {
    // carrega preferências salvas das colunas
    const fromLS = localStorage.getItem(this.LS_KEY);
    if (fromLS) {
      try { JSON.parse(fromLS).forEach((k: string) => this.selectedColumns.add(k)); } catch {}
    }
    // garante colunas obrigatórias
    this.availableColumns.filter(c => c.required).forEach(c => this.selectedColumns.add(c.key));
    if (this.selectedColumns.size === 0) {
      ['imageId','amiName','platform','region','creationTime','accountName']
        .forEach(k => this.selectedColumns.add(k));
    }
  }

  ngOnInit(): void { this.loadResources(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadResources(): void {
    this.loading = true;

    this.resourceService.getResourcesByType('AMI')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map(resource => {
            const parsedTagsObj = TagFormatter.parseTags(resource.tags);
            const parsedTagsArray: AMITag[] = Object.entries(parsedTagsObj).map(([key, value]) => ({
              Key: key,
              Value: value
            }));
            return {
              imageId: resource.imageId || resource.id || resource.resourceId,
              amiName: resource.amiName || resource.name || resource.imageName,
              imageName: resource.imageName || resource.amiName || resource.name,
              imageState: resource.imageState || resource.state || resource.status,
              description: resource.description || '',
              platform: resource.platform || resource.platformDetails || 'Unknown',

              region: resource.region,
              accountId: resource.accountId,
              accountName: resource.accountName,

              parsedTags: parsedTagsArray,
              tagObject: parsedTagsObj,

              creationTime: resource.creationTime || resource.createdAt || resource.lastUpdated
            };
          });

          // opções de filtro (derivadas dos dados carregados)
          this.uniqueRegions   = Array.from(new Set(this.resources.map(r => r.region))).filter(Boolean).sort();
          this.uniqueAccounts  = Array.from(new Set(this.resources.map(r => r.accountName || r.accountId))).filter(Boolean).sort();
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
      .filter(r => !this.regionFilter   || r.region === this.regionFilter)
      .filter(r => !this.accountFilter  || r.accountName === this.accountFilter || r.accountId === this.accountFilter)
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
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.platformFilter = '';
    this.searchTerm = '';
    this.applyFilters();
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
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  showDetails(r: any) {
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
  requiredColumns = ['snapshotId'];
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
      localStorage.setItem('ec2-columns', JSON.stringify(preferences));
    } catch (e) {
      console.warn('Could not save column preferences:', e);
    }
  }
  
  loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('ec2-columns');
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

detailsTags: Array<{ Key: string; Value: string }> = [];

// util – accepts array or JSON string (like in DynamoDB sample)
private safeParseTags(tags: any): Array<{ Key: string; Value: string }> {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags as Array<{ Key: string; Value: string }>;
  if (typeof tags === 'string') {
    try {
      const arr = JSON.parse(tags);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  return [];
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
}