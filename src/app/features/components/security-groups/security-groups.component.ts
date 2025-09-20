// src/app/features/components/security-groups/security-groups.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { SecurityGroup } from '../../../models/resource.model';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (item: SecurityGroup) => string;
}

type ColumnKey = keyof SecurityGroup;

@Component({
  selector: 'app-security-groups',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './security-groups.component.html'
})
export class SecurityGroupsComponent implements OnInit, OnDestroy {
  resources: SecurityGroup[] = [];
  filteredResources: SecurityGroup[] = [];
  paginatedResources: SecurityGroup[] = [];
  loading = true;
  selectedResource: SecurityGroup | null = null;

  searchTerm = '';

  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];

  regionFilter = '';
  accountFilter = '';
  ingressFilter: '' | 'has' | 'none' = '';
  egressFilter: '' | 'has' | 'none' = '';

  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  showColumnCustomizer = false;
  private readonly LS_KEY = 'security-groups-columns';
  selectedColumns: Set<string> = new Set();
  private readonly columnMinWidths: Record<string, number> = {
    groupName: 200,
    groupNameTag: 200,
    groupId: 180,
    description: 240,
    vpcId: 180,
    region: 140,
    accountName: 170,
    ingressRuleCount: 150,
    egressRuleCount: 150,
    createdAt: 180,
    updatedAt: 180,
  };

  availableColumns: ColumnDefinition[] = [
    { key: 'groupName', label: 'Group Name', sortable: true },
    { key: 'groupNameTag', label: 'Name Tag', sortable: true },
    { key: 'groupId', label: 'Group ID', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    { key: 'vpcId', label: 'VPC ID', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'accountName',
      label: 'Account',
      sortable: true,
      transform: (sg) => sg.accountName || sg.accountId
    },
    {
      key: 'ingressRuleCount',
      label: 'Ingress Rules',
      sortable: true,
      transform: (sg) =>
        sg.ingressRuleCount !== undefined && sg.ingressRuleCount !== null
          ? String(sg.ingressRuleCount)
          : 'N/A'
    },
    {
      key: 'egressRuleCount',
      label: 'Egress Rules',
      sortable: true,
      transform: (sg) =>
        sg.egressRuleCount !== undefined && sg.egressRuleCount !== null
          ? String(sg.egressRuleCount)
          : 'N/A'
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      transform: (sg) => this.formatDate(sg.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      transform: (sg) => this.formatDate(sg.updatedAt)
    }
  ];

  defaultColumns = [
    'groupName',
    'groupId',
    'vpcId',
    'region',
    'accountName',
    'ingressRuleCount',
    'egressRuleCount',
    'createdAt'
  ];

  requiredColumns = ['groupId'];

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
      .getResourcesByType('SecurityGroup')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = (data as SecurityGroup[]) || [];
          this.filteredResources = [...this.resources];

          this.uniqueRegions = [...new Set(this.resources.map((sg) => sg.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(this.resources.map((sg) => sg.accountName || sg.accountId).filter(Boolean))].sort();

          this.loading = false;
          this.currentPage = 1;
          if (this.sortColumn) {
            this.applySorting(false);
          } else {
            this.recomputePagination();
          }
        },
        error: (error) => {
          console.error('Error loading security groups:', error);
          this.loading = false;
        }
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

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

  filterByRegion(event: Event): void {
    this.regionFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAccount(event: Event): void {
    this.accountFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByIngress(event: Event): void {
    this.ingressFilter = (event.target as HTMLSelectElement).value as typeof this.ingressFilter;
    this.applyFilters();
  }

  filterByEgress(event: Event): void {
    this.egressFilter = (event.target as HTMLSelectElement).value as typeof this.egressFilter;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredResources = this.resources.filter((resource) => {
      if (this.searchTerm) {
        const haystacks = [
          resource.groupId,
          resource.groupName,
          resource.groupNameTag,
          resource.vpcId,
          resource.description
        ]
          .filter(Boolean)
          .map((value) => value!.toLowerCase());

        const matchesSearch = haystacks.some((value) => value.includes(this.searchTerm));
        if (!matchesSearch) return false;
      }

      if (this.regionFilter && resource.region !== this.regionFilter) return false;
      if (this.accountFilter && (resource.accountName || resource.accountId) !== this.accountFilter) return false;

      if (this.ingressFilter) {
        const hasIngress = (resource.ingressRuleCount ?? 0) > 0;
        if (this.ingressFilter === 'has' && !hasIngress) return false;
        if (this.ingressFilter === 'none' && hasIngress) return false;
      }

      if (this.egressFilter) {
        const hasEgress = (resource.egressRuleCount ?? 0) > 0;
        if (this.egressFilter === 'has' && !hasEgress) return false;
        if (this.egressFilter === 'none' && hasEgress) return false;
      }

      return true;
    });

    this.currentPage = 1;
    if (this.sortColumn) {
      this.applySorting(false);
    } else {
      this.recomputePagination();
    }
  }

  resetFilters(): void {
    this.regionFilter = '';
    this.accountFilter = '';
    this.ingressFilter = '';
    this.egressFilter = '';
    this.searchTerm = '';

    const searchInput = document.getElementById('securityGroupSearch') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';

    this.filteredResources = [...this.resources];
    this.currentPage = 1;
    if (this.sortColumn) {
      this.applySorting(false);
    } else {
      this.recomputePagination();
    }
  }

  sortData(column: ColumnKey): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applySorting();
  }

  private applySorting(resetPage: boolean = true): void {
    if (!this.sortColumn) {
      if (resetPage) this.currentPage = 1;
      this.recomputePagination();
      return;
    }

    const column = this.sortColumn;
    const direction = this.sortDirection === 'asc' ? 1 : -1;

    const sorted = [...this.filteredResources].sort((a, b) => {
      const valueA = this.getSortableValue(a, column);
      const valueB = this.getSortableValue(b, column);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      const strA = valueA.toString();
      const strB = valueB.toString();
      return strA.localeCompare(strB) * direction;
    });

    this.filteredResources = sorted;
    if (resetPage) this.currentPage = 1;
    this.recomputePagination();
  }

  private getSortableValue(resource: SecurityGroup, column: ColumnKey): string | number {
    if (column === 'accountName') {
      return (resource.accountName || resource.accountId || '').toLowerCase();
    }

    const raw = resource[column as keyof SecurityGroup];
    if (raw === null || raw === undefined) return '';

    if (column === 'createdAt' || column === 'updatedAt') {
      const timestamp = Date.parse(String(raw));
      return isNaN(timestamp) ? 0 : timestamp;
    }

    if (typeof raw === 'number') return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    return raw.toString().toLowerCase();
  }

  private recomputePagination(): void {
    const total = this.filteredResources.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = this.filteredResources.slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  getPageNumbers(): number[] {
    const maxVisible = 7;
    const half = Math.floor(maxVisible / 2);

    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, this.currentPage + half);

    if (this.currentPage <= half) {
      end = Math.min(this.totalPages, maxVisible);
    } else if (this.currentPage >= this.totalPages - half) {
      start = Math.max(1, this.totalPages - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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
    this.availableColumns.forEach((column) => this.selectedColumns.add(column.key));
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach((key) => this.selectedColumns.add(key));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
    this.recomputePagination();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((column) => this.selectedColumns.has(column.key));
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem(this.LS_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Could not save column preferences:', error);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem(this.LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.selectedColumns = new Set(parsed);
        this.requiredColumns.forEach((key) => this.selectedColumns.add(key));
      }
    } catch (error) {
      console.warn('Could not load column preferences:', error);
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  getColumnValue(column: ColumnDefinition, resource: SecurityGroup): string {
    if (column.transform) return column.transform(resource);
    const raw = resource[column.key as keyof SecurityGroup];
    if (raw === null || raw === undefined) return 'N/A';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    if (typeof raw === 'number') return raw.toLocaleString();
    return String(raw);
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }

  getColumnClass(key: ColumnKey): string {
    if (key === 'groupId' || key === 'vpcId') return 'ov-text--mono';
    return '';
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
  }

  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const visibleColumns = this.getVisibleColumns();
    const columns: ExportColumn[] = visibleColumns.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform
        ? (item: SecurityGroup) => column.transform!(item)
        : (item: SecurityGroup) => {
            const raw = item[column.key];
            if (raw === null || raw === undefined) return '';
            if (Array.isArray(raw)) return raw.join('; ');
            return String(raw);
          }
    }));

    this.exportService.exportDataToCSV(this.filteredResources, columns, 'security-groups.csv');
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const visibleColumns = this.getVisibleColumns();
    const columns: ExportColumn[] = visibleColumns.map((column) => ({
      key: column.key,
      label: column.label,
      transform: column.transform
        ? (item: SecurityGroup) => column.transform!(item)
        : (item: SecurityGroup) => {
            const raw = item[column.key];
            if (raw === null || raw === undefined) return '';
            if (Array.isArray(raw)) return raw.join('; ');
            return String(raw);
          }
    }));

    this.exportService.exportDataToXLSX(this.filteredResources, columns, 'security-groups.xlsx');
  }

  showDetails(resource: SecurityGroup): void {
    this.selectedResource = resource;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }
}
