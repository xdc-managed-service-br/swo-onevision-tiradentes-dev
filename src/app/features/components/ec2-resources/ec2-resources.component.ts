import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { TagFormatter } from '../../../shared/utils/tag-formatter';
import { EC2Instance } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: any) => string;
}

type ColumnKey = keyof EC2Instance | 'instancePrivateIps' | 'instancePublicIps' | 'autoStart' | 'autoShutdown' | 'saturday' | 'sunday';

@Component({
  selector: 'app-ec2-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './ec2-resources.component.html',
})
export class EC2ResourcesComponent implements OnInit, OnDestroy {
  // Data
  resources: EC2Instance[] = [];
  filteredResources: EC2Instance[] = [];
  paginatedResources: EC2Instance[] = [];
  loading = true;
  selectedResource: any = null;

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Search & filters
  searchTerm = '';
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  stateFilter = '';
  typeFilter = '';
  regionFilter = '';
  cwAgentFilter = '';
  accountFilter = '';
  swoPatchFilter: string[] = ['0', '1', '2', '3', 'N/A'];
  selectedSWOPatch: string = '';

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Columns customization
  showColumnCustomizer = false;
  selectedColumns: Set<string> = new Set();

  availableColumns: ColumnDefinition[] = [
    { key: 'instanceId', label: 'Instance ID', sortable: true },
    { key: 'instanceName', label: 'Name', sortable: true },
    { key: 'instanceType', label: 'Type', sortable: true },
    { key: 'instanceState', label: 'State', sortable: true },
    { key: 'healthStatus', label: 'Health Status', sortable: true, transform: (r) => this.getHealthStatusText(r) },
    { key: 'cwAgentMemoryDetected', label: 'CW Monitoring', sortable: true, transform: (r) => r.cwAgentMemoryDetected ? 'Enabled' : 'Disabled' },
    { key: 'instancePrivateIps', label: 'Private IPs', sortable: false, transform: (r) => r.instancePrivateIps?.join(', ') || 'N/A' },
    { key: 'instancePublicIps', label: 'Public IPs', sortable: false, transform: (r) => r.instancePublicIps?.join(', ') || 'N/A' },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'accountId', label: 'Account ID', sortable: true },
    { key: 'accountName', label: 'Account Name', sortable: true },
    { key: 'platformDetails', label: 'Platform', sortable: true },
    { key: 'amiName', label: 'AMI Name', sortable: true },
    { key: 'iamRole', label: 'IAM Role', sortable: true },
    { key: 'ssmStatus', label: 'SSM Status', sortable: true },
    { key: 'ssmPingStatus', label: 'SSM Ping Status', sortable: true },
    { key: 'ssmVersion', label: 'SSM Version', sortable: true },
    { key: 'ssmLastPingTime', label: 'Last Ping Time', sortable: true, transform: (r) => this.formatDate(r.ssmLastPingTime) },
    { key: 'swoMonitor', label: 'SWO Monitor', sortable: true },
    { key: 'swoPatch', label: 'SWO Patch', sortable: true },
    { key: 'swoBackup', label: 'SWO Backup', sortable: true },
    { key: 'swoRiskClass', label: 'Risk Class', sortable: true },
    { key: 'patchGroup', label: 'Patch Group', sortable: true },
    { key: 'autoStart', label: 'Auto Start', sortable: true },
    { key: 'autoShutdown', label: 'Auto Shutdown', sortable: true },
    { key: 'saturday', label: 'Saturday Schedule', sortable: true },
    { key: 'sunday', label: 'Sunday Schedule', sortable: true },
  ];

  defaultColumns = [
    'instanceId',
    'instanceName',
    'instanceType',
    'instanceState',
    'healthStatus',
    'cwAgentMemoryDetected',
    'instancePrivateIps',
    'instancePublicIps',
    'region',
    'accountId',
    'accountName',
    'updatedAt'
  ];

  requiredColumns = ['instanceId'];

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

  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('EC2Instance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map((r: any) => {
            const privateIpArray = TagFormatter.parseIpList(r.instancePrivateIps ?? r.instancePrivateIps);
            const publicIpArray = TagFormatter.parseIpList(r.instancePublicIps ?? r.instancePublicIps);
            return {
              ...r,
              privateIpArray,
              publicIpArray,
              cwAgentMemoryDetected: typeof r.cwAgentMemoryDetected === 'string' ? r.cwAgentMemoryDetected === 'true' : Boolean(r.cwAgentMemoryDetected),
              cwAgentDiskDetected: typeof r.cwAgentDiskDetected === 'string' ? r.cwAgentDiskDetected === 'true' : Boolean(r.cwAgentDiskDetected)
            };
          });

          this.filteredResources = [...this.resources];
          this.uniqueStates = [...new Set(this.resources.map(r => r.instanceState).filter(Boolean))].sort();
          this.uniqueTypes = [...new Set(this.resources.map(r => r.instanceType).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(this.resources.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(this.resources.map(r => r.accountName || r.accountId).filter(Boolean))].sort();
          this.recomputePagination();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading EC2 resources:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

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

  getVisibleColumns(): ColumnDefinition[] { return this.availableColumns.filter(col => this.selectedColumns.has(col.key)); }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem('ec2-columns', JSON.stringify(preferences));
    } catch (e) { console.warn('Could not save column preferences:', e); }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('ec2-columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach(k => this.selectedColumns.add(k));
      }
    } catch {
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  searchInstances(event: Event): void { this.searchResources(event); }

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
  filterByType(e: Event): void { this.typeFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByRegion(e: Event): void { this.regionFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByCWAgent(e: Event): void { this.cwAgentFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterByAccount(e: Event): void { this.accountFilter = (e.target as HTMLSelectElement).value; this.applyFilters(); }
  filterBySWOPatch(e: Event): void {
  this.selectedSWOPatch = ((e.target as HTMLSelectElement).value ?? '').trim();
  this.applyFilters();
}

  applyFilters(): void {
    this.filteredResources = this.resources.filter(r => {
      if (this.searchTerm) {
        const id = r.instanceId?.toLowerCase() ?? '';
        const name = r.instanceName?.toLowerCase() ?? '';
        if (!id.includes(this.searchTerm) && !name.includes(this.searchTerm)) return false;
      }
      if (this.stateFilter && r.instanceState !== this.stateFilter) return false;
      if (this.typeFilter && r.instanceType !== this.typeFilter) return false;
      if (this.regionFilter && r.region !== this.regionFilter) return false;
      if (this.cwAgentFilter) {
        const isEnabled = this.cwAgentFilter === 'true';
        if (r.cwAgentMemoryDetected !== isEnabled) return false;
      }
      if (this.accountFilter && (r.accountName || r.accountId) !== this.accountFilter) return false;
      if (this.selectedSWOPatch) {
        if (this.selectedSWOPatch === 'N/A') {
          if (r.swoPatch !== null && r.swoPatch !== undefined) return false;
        } else {
          if (String(r.swoPatch) !== this.selectedSWOPatch) return false;
        }
      }
      return true;
    });

    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  resetFilters(): void {
    this.stateFilter = this.typeFilter = this.regionFilter = this.cwAgentFilter = this.accountFilter = '';
    this.searchTerm = '';
    const searchInput = document.getElementById('instanceSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    this.filteredResources = [...this.resources];
    if (this.sortColumn) this.sortData(this.sortColumn);
    else this.updatePaginationAfterChange();
  }

  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortColumn = column; this.sortDirection = 'asc'; }

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];
      if (column.toLowerCase().includes('date') || column.toLowerCase().includes('time')) {
        const dateA = (valueA && (typeof valueA === 'string' || typeof valueA === 'number' || valueA instanceof Date)) ? new Date(valueA).getTime() : 0;
        const dateB = (valueB && (typeof valueB === 'string' || typeof valueB === 'number' || valueB instanceof Date)) ? new Date(valueB).getTime() : 0;
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (typeof valueA === 'number' && typeof valueB === 'number') return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      if (typeof valueA === 'boolean' && typeof valueB === 'boolean') return this.sortDirection === 'asc' ? (valueA === valueB ? 0 : valueA ? 1 : -1) : (valueA === valueB ? 0 : valueA ? -1 : 1);
      if (typeof valueA === 'string' && typeof valueB === 'string') return this.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      return 0;
    });

    this.updatePaginationAfterChange();
  }

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

  showDetails(r: any): void { this.selectedResource = r; }
  closeDetails(): void { this.selectedResource = null; }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s === 'running') return 'status-running';
    if (s === 'stopped') return 'status-stopped';
    if (s === 'pending') return 'status-pending';
    if (s === 'terminated') return 'status-terminated';
    return 'status-unknown';
  }

  getHealthStatusText(r: any): string {
    if (r.instanceState !== 'running') return 'N/A';
    if (typeof r.healthChecksPassed === 'number' && typeof r.healthChecksTotal === 'number') return `${r.healthChecksPassed} / ${r.healthChecksTotal}`;
    let passed = 0, total = 0;
    if (r.systemStatus) { total++; if (r.systemStatus === 'Ok') passed++; }
    if (r.instanceStatus) { total++; if (r.instanceStatus === 'Ok') passed++; }
    if (r.ebsStatus) { total++; if (r.ebsStatus === 'Ok') passed++; }
    if (total > 0) return `${passed} / ${total}`;
    return 'No Health Data';
  }

  getHealthStatusClass(r: any): string {
    if (r.instanceState !== 'running') return 'status-unknown';
    const fullyHealthy = (r.healthChecksPassed === r.healthChecksTotal && (r.healthChecksTotal ?? 0) > 0) || (r.systemStatus === 'Ok' && r.instanceStatus === 'Ok' && r.ebsStatus === 'Ok');
    if (fullyHealthy) return 'status-running';
    const failing = (typeof r.healthChecksPassed === 'number' && typeof r.healthChecksTotal === 'number' && r.healthChecksPassed < r.healthChecksTotal) || r.systemStatus === 'failed' || r.instanceStatus === 'failed' || r.ebsStatus === 'failed';
    return failing ? 'status-warning' : 'status-warning';
  }

  shouldBeFullWidth(key: string): boolean {
    return ['instanceName', 'platformDetails', 'amiName', 'privateIpArray', 'publicIpArray'].includes(key);
  }


  getColumnValue(column: ColumnDefinition, resource: EC2Instance): string {
    if (column.transform) return column.transform(resource);
    const value = (resource as any)[column.key as keyof EC2Instance];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getColumnClass(key: ColumnKey, resource: EC2Instance): string {
    if (key === 'instanceState') return this.getStatusClass(resource.instanceState);
    if (key === 'healthStatus') return this.getHealthStatusClass(resource);
    if (key === 'cwAgentMemoryDetected') return resource.cwAgentMemoryDetected ? 'status-running' : 'status-stopped';
    if (key === 'instancePrivateIps' || key === 'instancePublicIps') return 'ip-address-column';
    return '';
  }

  // ==== Export ====
  exportToCSV(): void {
    if (!this.filteredResources.length) return;

    const filename = 'ec2-resources.csv';
    const visibleColumns = this.getVisibleColumns();

    const exportColumns: ExportColumn[] = visibleColumns.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: EC2Instance) => {
        if (col.key === 'instancePrivateIps') return r.instancePrivateIps?.join('; ') ?? '';
        if (col.key === 'instancePublicIps') return r.instancePublicIps?.join('; ') ?? '';
        return (r as any)[col.key] ?? '';
      })
    }));

    this.exportService.exportDataToCSV(this.filteredResources, exportColumns, filename);
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;

    const filename = 'ec2-resources.xlsx';
    const visibleColumns = this.getVisibleColumns();

    const exportColumns: ExportColumn[] = visibleColumns.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform ?? ((r: EC2Instance) => {
        if (col.key === 'instancePrivateIps') return r.instancePrivateIps?.join('; ') ?? '';
        if (col.key === 'instancePublicIps') return r.instancePublicIps?.join('; ') ?? '';
        return (r as any)[col.key] ?? '';
      })
    }));

    this.exportService.exportDataToXLSX(this.filteredResources, exportColumns, filename);
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
