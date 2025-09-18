// src/app/features/components/route-tables/route-tables.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { RouteTable } from '../../../models/resource.model';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: NormalizedRouteTable) => string;
}

type ColumnKey =
  | 'routeTableName'
  | 'routeTableId'
  | 'vpcId'
  | 'routeCount'
  | 'hasInternetRoute'
  | 'hasNatRoute'
  | 'hasVpcPeeringRoute'
  | 'isMain'
  | 'associationCount'
  | 'region'
  | 'accountName'
  | 'createdAt'
  | 'updatedAt';

type BooleanFilter = '' | 'yes' | 'no';

type NormalizedRouteTable = RouteTable & {
  associatedSubnetsList: string[];
  normalizedRouteCount: number;
};

@Component({
  selector: 'app-route-tables',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './route-tables.component.html'
})
export class RouteTablesComponent implements OnInit, OnDestroy {
  resources: NormalizedRouteTable[] = [];
  filteredResources: NormalizedRouteTable[] = [];
  paginatedResources: NormalizedRouteTable[] = [];
  loading = true;
  selectedResource: NormalizedRouteTable | null = null;

  // Filters
  searchTerm = '';
  regionFilter = '';
  accountFilter = '';
  vpcFilter = '';
  internetFilter: BooleanFilter = '';
  natFilter: BooleanFilter = '';
  peeringFilter: BooleanFilter = '';
  mainFilter: BooleanFilter = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  uniqueVpcs: string[] = [];

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Column customization
  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();
  private readonly requiredColumns: ColumnKey[] = ['routeTableId'];
  private readonly defaultColumns: ColumnKey[] = [
    'routeTableName',
    'routeTableId',
    'vpcId',
    'routeCount',
    'hasInternetRoute',
    'hasNatRoute',
    'hasVpcPeeringRoute',
    'isMain',
    'region',
    'accountName',
    'createdAt'
  ];

  readonly availableColumns: ColumnDefinition[] = [
    {
      key: 'routeTableName',
      label: 'Name',
      sortable: true,
      transform: (resource) => resource.routeTableName || 'Unnamed Route Table'
    },
    { key: 'routeTableId', label: 'Route Table ID', sortable: true },
    { key: 'vpcId', label: 'VPC ID', sortable: true },
    {
      key: 'routeCount',
      label: 'Routes',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.normalizedRouteCount)
    },
    {
      key: 'hasInternetRoute',
      label: 'Internet Route',
      sortable: true,
      transform: (resource) => this.formatBoolean(resource.hasInternetRoute)
    },
    {
      key: 'hasNatRoute',
      label: 'NAT Route',
      sortable: true,
      transform: (resource) => this.formatBoolean(resource.hasNatRoute)
    },
    {
      key: 'hasVpcPeeringRoute',
      label: 'Peering Route',
      sortable: true,
      transform: (resource) => this.formatBoolean(resource.hasVpcPeeringRoute)
    },
    {
      key: 'isMain',
      label: 'Main Table',
      sortable: true,
      transform: (resource) => this.formatBoolean(resource.isMain)
    },
    {
      key: 'associationCount',
      label: 'Associations',
      sortable: true,
      transform: (resource) => this.formatNumber(resource.associationCount ?? resource.associatedSubnetsList.length)
    },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (resource) => this.getAccountLabel(resource)
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      transform: (resource) => this.formatDate(resource.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      transform: (resource) => this.formatDate(resource.updatedAt)
    }
  ];

  private readonly LS_KEY = 'route-tables-columns';
  private readonly destroy$ = new Subject<void>();

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

  // Data loading ---------------------------------------------------------------
  loadResources(): void {
    this.loading = true;
    this.resourceService
      .getResourcesByType('RouteTable')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = ((data as RouteTable[]) || []).map((item) => this.normalizeRouteTable(item));
          this.filteredResources = [...this.resources];

          this.uniqueRegions = this.buildUniqueList(this.resources.map((item) => item.region));
          this.uniqueAccounts = this.buildUniqueList(this.resources.map((item) => this.getAccountLabel(item)));
          this.uniqueVpcs = this.buildUniqueList(this.resources.map((item) => item.vpcId));

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.sortData(this.sortColumn);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading Route Tables:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  // Column customization -------------------------------------------------------
  openColumnCustomizer(): void { this.showColumnCustomizer = true; }
  closeColumnCustomizer(): void { this.showColumnCustomizer = false; }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((column) => this.selectedColumns.has(column.key));
  }

  toggleColumn(key: ColumnKey): void {
    if (this.requiredColumns.includes(key)) return;
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

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save Route Table column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length) {
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((column) => this.selectedColumns.add(column));
      }
    } catch (error) {
      console.warn('Could not load Route Table column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  // Filters -------------------------------------------------------------------
  searchRouteTables(event: Event): void {
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

  filterByVpc(event: Event): void {
    this.vpcFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByInternet(event: Event): void {
    this.internetFilter = (event.target as HTMLSelectElement).value as BooleanFilter;
    this.applyFilters();
  }

  filterByNat(event: Event): void {
    this.natFilter = (event.target as HTMLSelectElement).value as BooleanFilter;
    this.applyFilters();
  }

  filterByPeering(event: Event): void {
    this.peeringFilter = (event.target as HTMLSelectElement).value as BooleanFilter;
    this.applyFilters();
  }

  filterByMain(event: Event): void {
    this.mainFilter = (event.target as HTMLSelectElement).value as BooleanFilter;
    this.applyFilters();
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.vpcFilter = '';
    this.internetFilter = '';
    this.natFilter = '';
    this.peeringFilter = '';
    this.mainFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('routeTableSearch') as HTMLInputElement | null;
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
          resource.routeTableId,
          resource.routeTableName,
          resource.vpcId,
          this.getAccountLabel(resource),
          resource.associatedSubnetsList.join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && this.getAccountLabel(resource) !== this.accountFilter) return false;
      if (this.vpcFilter && (resource.vpcId || '') !== this.vpcFilter) return false;

      if (!this.matchesBooleanFilter(resource.hasInternetRoute, this.internetFilter)) return false;
      if (!this.matchesBooleanFilter(resource.hasNatRoute, this.natFilter)) return false;
      if (!this.matchesBooleanFilter(resource.hasVpcPeeringRoute, this.peeringFilter)) return false;
      if (!this.matchesBooleanFilter(resource.isMain, this.mainFilter)) return false;

      return true;
    });

    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.updatePaginationAfterChange();
    }
  }

  private matchesBooleanFilter(value: boolean | undefined | null, filter: BooleanFilter): boolean {
    if (!filter) return true;
    const bool = !!value;
    return filter === 'yes' ? bool : !bool;
  }

  // Sorting --------------------------------------------------------------------
  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const valueA = this.getSortValue(a, column);
      const valueB = this.getSortValue(b, column);

      if (valueA === valueB) return 0;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * dir;
      }

      const stringA = String(valueA ?? '').toLowerCase();
      const stringB = String(valueB ?? '').toLowerCase();
      return stringA.localeCompare(stringB) * dir;
    });

    this.updatePaginationAfterChange();
  }

  private getSortValue(resource: NormalizedRouteTable, column: ColumnKey): string | number {
    switch (column) {
      case 'routeCount':
        return resource.normalizedRouteCount;
      case 'associationCount':
        return resource.associationCount ?? resource.associatedSubnetsList.length;
      case 'hasInternetRoute':
      case 'hasNatRoute':
      case 'hasVpcPeeringRoute':
      case 'isMain':
        return resource[column] ? 1 : 0;
      case 'accountName':
        return this.getAccountLabel(resource).toLowerCase();
      case 'createdAt':
      case 'updatedAt':
        return resource[column] ? new Date(resource[column] as string).getTime() : 0;
      default: {
        const value = resource[column];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return value;
        return value ? 1 : 0;
      }
    }
  }

  // Pagination -----------------------------------------------------------------
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

  // Detail modal ---------------------------------------------------------------
  showDetails(resource: NormalizedRouteTable): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  // View helpers ----------------------------------------------------------------
  getColumnValue(column: ColumnDefinition, resource: NormalizedRouteTable): string {
    if (column.transform) return column.transform(resource);
    const value = resource[column.key as keyof NormalizedRouteTable];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return this.formatBoolean(value);
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  getBooleanClass(value: boolean | undefined | null): string {
    return value ? 'status-running' : 'status-stopped';
  }

  getAccountLabel(resource: RouteTable): string {
    return resource.accountName || resource.accountId || 'Unknown Account';
  }

  getAssociatedSubnets(resource: NormalizedRouteTable): string {
    if (!resource.associatedSubnetsList.length) return 'None';
    return resource.associatedSubnetsList.join(', ');
  }

  // Export ---------------------------------------------------------------------
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedRouteTable) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToCSV(this.filteredResources, columns, 'route-tables.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visible = this.getVisibleColumns();
    const columns: ExportColumn[] = visible.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform ?? ((resource: NormalizedRouteTable) => (resource as any)[column.key] ?? '')
    }));
    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'route-tables.xlsx');
  }

  // Normalization --------------------------------------------------------------
  private normalizeRouteTable(item: RouteTable | any): NormalizedRouteTable {
    const resource: NormalizedRouteTable = {
      ...item,
      routeTableName: item?.routeTableName || item?.name || this.extractNameFromTags(item?.tags),
      vpcId: item?.vpcId || item?.vpcID || item?.vpc,
      associatedSubnetsList: this.normalizeSubnetAssociations(item?.associatedSubnets ?? item?.subnetAssociations),
      normalizedRouteCount: this.normalizeNumber(item?.routeCount, item?.routes?.length)
    } as NormalizedRouteTable;

    if (resource.associationCount == null) {
      resource.associationCount = resource.associatedSubnetsList.length;
    }

    return resource;
  }

  private normalizeSubnetAssociations(value: unknown): string[] {
    if (!value) return [];

    const parseEntry = (entry: any): string | null => {
      if (!entry) return null;
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object') {
        const subnetId = entry.subnetId || entry.SubnetId || entry.subnet || entry.resourceId;
        return typeof subnetId === 'string' && subnetId.trim().length ? subnetId : null;
      }
      return null;
    };

    if (Array.isArray(value)) {
      return value.map(parseEntry).filter((subnet): subnet is string => !!subnet);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeSubnetAssociations(parsed);
        } catch {
          return trimmed
            .split(/[;,]/)
            .map((part) => part.trim())
            .filter((subnet) => subnet.length > 0);
        }
      }
      return trimmed
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter((subnet) => subnet.length > 0);
    }

    if (typeof value === 'object') {
      const parsed = parseEntry(value);
      return parsed ? [parsed] : [];
    }

    return [];
  }

  private normalizeNumber(value: unknown, fallback?: number): number {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (typeof fallback === 'number' && !Number.isNaN(fallback)) return fallback;
    return 0;
  }

  private extractNameFromTags(tags: any): string | undefined {
    if (!tags || typeof tags !== 'object') return undefined;
    const name = tags.Name || tags.name || tags.NAME;
    return typeof name === 'string' && name.trim().length ? name : undefined;
  }

  private buildUniqueList(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))].sort();
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  }

  formatBoolean(value: boolean | undefined | null): string {
    return value ? 'Yes' : 'No';
  }

  formatNumber(value: number | undefined | null): string {
    const num = typeof value === 'number' ? value : 0;
    try {
      return new Intl.NumberFormat().format(num);
    } catch {
      return String(num);
    }
  }
}
