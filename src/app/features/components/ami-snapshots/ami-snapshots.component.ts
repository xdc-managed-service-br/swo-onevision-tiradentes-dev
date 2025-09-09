// src/app/features/resources/ami-snapshots/ami-snapshots.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ExportService } from '../../../core/services/export.service';
import { ErrorService } from '../../../core/services/error.service';

interface AMISnapshot {
  id?: string;
  imageId: string;
  nameTag?: string;
  amiName: string;
  platform: string;
  region: string;
  accountId: string;
  accountName?: string;
  creationTime: string;
  state?: string;
  description?: string;
  architecture?: string;
  virtualizationType?: string;
  hypervisor?: string;
  tags?: any;
}

interface FilterState {
  platform: string;
  region: string;
  account: string;
}

@Component({
  selector: 'app-ami-snapshots',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ami-snapshots.component.html',
  styleUrls: [
    './ami-snapshots.component.css',
    '../../../shared/styles/onevision-base.css' // Import the shared header styles
  ]
})
export class AMISnapshotsComponent implements OnInit, OnDestroy {
  // Data properties
  resources: AMISnapshot[] = [];
  filteredResources: AMISnapshot[] = [];
  paginatedResources: AMISnapshot[] = [];
  selectedResource: AMISnapshot | null = null;
  
  // Filter properties
  filters: FilterState = {
    platform: '',
    region: '',
    account: ''
  };
  
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  
  // Available options for filters
  availableAccounts = [
    { id: 'acc-001', name: 'Production Account' },
    { id: 'acc-002', name: 'Development Account' },
    { id: 'acc-003', name: 'Staging Account' }
  ];
  
  availableRegions: string[] = [];
  availablePlatforms: string[] = [];
  
  // Sorting properties
  sortColumn: string = 'creationTime';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 20;
  totalPages: number = 0;
  startIndex: number = 0;
  endIndex: number = 0;
  
  // State properties
  loading: boolean = true;
  error: string | null = null;
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService,
    private errorService: ErrorService
  ) {}
  
  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadResources();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Setup search with debounce
  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }
  
  // Load resources from service
  loadResources(): void {
    this.loading = true;
    this.error = null;
    
    this.resourceService.getResourcesByType('AMISnapshot')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data as AMISnapshot[];
          this.extractFilterOptions();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load AMI Snapshots';
          this.errorService.handleError({
            message: this.error,
            details: error
          });
          this.loading = false;
        }
      });
  }
  
  // Extract unique values for filter dropdowns
  private extractFilterOptions(): void {
    const regions = new Set<string>();
    const platforms = new Set<string>();
    
    this.resources.forEach(resource => {
      if (resource.region) regions.add(resource.region);
      if (resource.platform) platforms.add(resource.platform);
    });
    
    this.availableRegions = Array.from(regions).sort();
    this.availablePlatforms = Array.from(platforms).sort();
  }
  
  // Apply all filters and search
  applyFilters(): void {
    let filtered = [...this.resources];
    
    // Apply platform filter
    if (this.filters.platform) {
      filtered = filtered.filter(r => 
        r.platform.toLowerCase().includes(this.filters.platform.toLowerCase())
      );
    }
    
    // Apply region filter
    if (this.filters.region) {
      filtered = filtered.filter(r => 
        r.region === this.filters.region
      );
    }
    
    // Apply account filter
    if (this.filters.account) {
      filtered = filtered.filter(r => 
        r.accountId === this.filters.account
      );
    }
    
    // Apply search term
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.imageId?.toLowerCase().includes(search) ||
        r.nameTag?.toLowerCase().includes(search) ||
        r.amiName?.toLowerCase().includes(search)
      );
    }
    
    this.filteredResources = filtered;
    this.sortData();
    this.updatePagination();
  }
  
  // Handle search input
  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }
  
  // Reset all filters
  resetFilters(): void {
    this.filters = {
      platform: '',
      region: '',
      account: ''
    };
    this.searchTerm = '';
    this.currentPage = 1;
    this.applyFilters();
  }
  
  // Check if any filters are active
  hasActiveFilters(): boolean {
    return !!(
      this.filters.platform ||
      this.filters.region ||
      this.filters.account ||
      this.searchTerm
    );
  }
  
  // Sort data by column
  sortData(column?: string): void {
    if (column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    }
    
    this.filteredResources.sort((a, b) => {
      const valueA = this.getValueForSort(a, this.sortColumn);
      const valueB = this.getValueForSort(b, this.sortColumn);
      
      if (valueA === valueB) return 0;
      
      const comparison = valueA < valueB ? -1 : 1;
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    this.updatePagination();
  }
  
  // Get value for sorting
  private getValueForSort(resource: any, column: string): any {
    const value = resource[column];
    
    // Handle dates
    if (column.includes('Time') || column.includes('Date')) {
      return new Date(value).getTime();
    }
    
    // Handle strings
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    
    return value;
  }
  
  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredResources.length / this.itemsPerPage);
    
    // Reset to page 1 if current page is out of bounds
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(
      this.startIndex + this.itemsPerPage,
      this.filteredResources.length
    );
    
    this.paginatedResources = this.filteredResources.slice(
      this.startIndex,
      this.endIndex
    );
  }
  
  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePagination();
    
    // Scroll to top of content area
    const contentArea = document.querySelector('.resource-content');
    if (contentArea) {
      contentArea.scrollTop = 0;
    }
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let end = Math.min(this.totalPages, start + maxPages - 1);
    
    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  // View resource details
  viewDetails(resource: AMISnapshot): void {
    this.selectedResource = resource;
    // You can implement a modal or navigate to a detail page
    console.log('View details for:', resource);
  }
  
  // Export data
  exportData(): void {
    const filename = `ami-snapshots-${new Date().toISOString().split('T')[0]}.csv`;
    
    const columns = [
      { key: 'imageId', label: 'Image ID' },
      { key: 'nameTag', label: 'Name Tag' },
      { key: 'amiName', label: 'AMI Name' },
      { key: 'platform', label: 'Platform' },
      { key: 'region', label: 'Region' },
      { key: 'accountId', label: 'Account ID' },
      { key: 'creationTime', label: 'Creation Time' }
    ];
    
    this.exportService.exportDataToCSV(
      this.filteredResources,
      columns,
      filename
    );
  }
  
  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return dateString;
    }
  }
  
  // Get platform CSS class
  getPlatformClass(platform: string): string {
    if (!platform) return '';
    
    const p = platform.toLowerCase();
    if (p.includes('linux') || p.includes('unix')) return 'status-running';
    if (p.includes('windows')) return 'status-available';
    
    return 'status-pending';
  }
}