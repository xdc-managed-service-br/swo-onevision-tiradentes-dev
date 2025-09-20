import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { OvResizableColDirective } from '../../../shared/directives/ov-resizable-col.directive';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent, OvResizableColDirective],
  templateUrl: './all-resources.component.html',
})
export class ResourcesComponent implements OnInit, OnDestroy {
  resources: any[] = [];
  filteredResources: any[] = [];
  paginatedResources: any[] = [];
  loading = true;
  selectedResource: any = null;
  isExporting = false;
  
  // Search functionality
  searchTerm: string = '';
  
  // Unique values for filters
  uniqueResourceTypes: string[] = [];
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Current filter values
  resourceTypeFilter: string = '';
  regionFilter: string = '';
  accountFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 50;
  totalPages: number = 1;
  
  // Math for template
  Math = Math;
  
  // Define export columns for all resources
  exportColumns: ExportColumn[] = [
    { key: 'resourceType', label: 'Type' },
    { 
      key: 'identifier', 
      label: 'Identifier',
      transform: (resource) => this.getResourceIdentifier(resource)
    },
    { key: 'resourceName', label: 'Name' },
    { key: 'region', label: 'Region' },
    { 
      key: 'accountId', 
      label: 'Account',
      transform: (resource) => resource.accountName || resource.accountId
    },
    { 
      key: 'createdAt', 
      label: 'Created',
      transform: (resource) => this.formatDate(resource.createdAt)
    },
    { key: 'state', label: 'State' }
  ];
  
  private destroy$ = new Subject<void>();

  private readonly columnMinWidths: Record<string, number> = {
    type: 150,
    identifier: 200,
    name: 200,
    region: 140,
    account: 170,
    created: 180,
    state: 150,
    actions: 140,
  };
  
  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {}
  
  ngOnInit(): void {
    this.loadResources();
  }

  getColumnMinWidth(key: string): number {
    return this.columnMinWidths[key] ?? 120;
  }
  
  loadResources(): void {
    this.loading = true;
    
    this.resourceService.getAllResources()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data;
          this.filteredResources = [...this.resources];
          
          // Extract unique values for filters
          this.uniqueResourceTypes = [...new Set(data.map(r => r.resourceType).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(data.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(data.map(r => r.accountName || r.accountId).filter(Boolean))].sort();
          
          this.loading = false;
          this.updatePagination();
        },
        error: (error) => {
          console.error('Error loading resources:', error);
          this.loading = false;
        }
      });
  }
  
  // Search functionality
  searchResources(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }
  
  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }
  
  // Filter by resource type
  filterByResourceType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resourceTypeFilter = value;
    this.applyFilters();
  }
  
  // Filter by region
  filterByRegion(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.regionFilter = value;
    this.applyFilters();
  }
  
  // Filter by account
  filterByAccount(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.accountFilter = value;
    this.applyFilters();
  }
  
  // Apply all filters
  applyFilters(): void {
    this.filteredResources = this.resources.filter(resource => {
      // Apply search filter
      if (this.searchTerm) {
        const resourceId = resource.resourceId ? resource.resourceId.toLowerCase() : '';
        const resourceName = resource.resourceName ? resource.resourceName.toLowerCase() : '';
        const resourceType = resource.resourceType ? resource.resourceType.toLowerCase() : '';
        
        if (!resourceId.includes(this.searchTerm) && 
            !resourceName.includes(this.searchTerm) &&
            !resourceType.includes(this.searchTerm)) {
          return false;
        }
      }
      
      // Apply resource type filter
      if (this.resourceTypeFilter && resource.resourceType !== this.resourceTypeFilter) {
        return false;
      }
      
      // Apply region filter
      if (this.regionFilter && resource.region !== this.regionFilter) {
        return false;
      }
      
      // Apply account filter
      if (this.accountFilter && 
          (resource.accountName || resource.accountId) !== this.accountFilter) {
        return false;
      }
      
      return true;
    });
    
    // Reset to first page when applying filters
    this.currentPage = 1;
    
    // Reapply sorting if active
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
    
    // Update pagination
    this.updatePagination();
  }
  
  // Reset all filters
  resetFilters(): void {
    this.resourceTypeFilter = '';
    this.regionFilter = '';
    this.accountFilter = '';
    this.searchTerm = '';
    
    // Reset select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    // Reset search input
    const searchInput = document.getElementById('resourceSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.filteredResources = [...this.resources];
    this.currentPage = 1;
    this.updatePagination();
  }
  
  // Sort table by column
  sortData(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if already sorting by this column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredResources.sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];
      
      // Handle null/undefined values
      if (valueA === undefined || valueA === null) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueB === undefined || valueB === null) return this.sortDirection === 'asc' ? 1 : -1;
      
      // Special handling for dates
      if (column === 'createdAt') {
        const dateA = valueA ? new Date(valueA) : new Date(0);
        const dateB = valueB ? new Date(valueB) : new Date(0);
        return this.sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime() 
          : dateB.getTime() - dateA.getTime();
      }
      
      // Default string comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // Default numeric comparison
      return this.sortDirection === 'asc'
        ? valueA - valueB
        : valueB - valueA;
    });
    
    // Update pagination after sorting
    this.updatePaginatedResources();
  }
  
  // Show resource details
  showDetails(resource: any): void {
    this.selectedResource = resource;
  }
  
  // Close details modal
  closeDetails(): void {
    this.selectedResource = null;
  }
  
  // Helper: Format date
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  }
  
  // Helper: Get resource type display name
  getResourceTypeDisplay(resourceType: string): string {
    const typeMap: { [key: string]: string } = {
      'EC2Instance': 'EC2 Instance',
      'S3Bucket': 'S3 Bucket',
      'RDSInstance': 'RDS Instance',
      'EBSVolume': 'EBS Volume',
      'EBSSnapshot': 'EBS Snapshot',
      'AMISnapshot': 'AMI Snapshot',
      'VPC': 'VPC',
      'SecurityGroup': 'Security Group',
      'LoadBalancer': 'Load Balancer'
    };
    return typeMap[resourceType] || resourceType;
  }
  
// === Export columns (CSV → strings formatadas) ===
exportColumnsCsv: ExportColumn[] = [
  { key: 'resourceType', label: 'Type' },
  {
    key: 'identifier',
    label: 'Identifier',
    transform: (r) => this.getResourceIdentifier(r)
  },
  { key: 'resourceName', label: 'Name' },
  { key: 'region', label: 'Region' },
  {
    key: 'accountId',
    label: 'Account',
    transform: (r) => r.accountName || r.accountId
  },
  {
    key: 'createdAt',
    label: 'Created',
    transform: (r) => this.formatDate(r.createdAt)
  },
  { key: 'state', label: 'State' }
];

  // === Export columns (XLSX → valores “crus” quando possível) ===
  exportColumnsXlsx: ExportColumn[] = [
    { key: 'resourceType', label: 'Type' },
    { key: 'identifier', label: 'Identifier', transform: (r) => this.getResourceIdentifier(r) },
    { key: 'resourceName', label: 'Name' },
    { key: 'region', label: 'Region' },
    { key: 'accountId', label: 'Account', transform: (r) => r.accountName || r.accountId },
    // passe uma data parseável por Excel; ISO é seguro
    { key: 'createdAt', label: 'Created', transform: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : '') },
    { key: 'state', label: 'State' }
  ];

  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    const filename = 'all-resources.csv';
    this.exportService.exportDataToCSV(this.filteredResources, this.exportColumnsCsv, filename);
  }

  exportToXLSX(): void {
    if (!this.filteredResources.length) return;
    const filename = 'all-resources.xlsx';
    this.exportService.exportDataToXLSX(this.filteredResources, this.exportColumnsXlsx, filename);
  }
  
  // Pagination methods
  updatePagination(): void {
    const total = this.filteredResources.length;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    this.updatePaginatedResources();
  }
  
  updatePaginatedResources(): void {
    const total = this.filteredResources.length;
    const startIndex = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const endIndex = total === 0 ? 0 : Math.min(startIndex + this.pageSize, total);
    this.paginatedResources = this.filteredResources.slice(startIndex, endIndex);
  }
  
  goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages);
    if (clamped !== this.currentPage) {
      this.currentPage = clamped;
      this.updatePaginatedResources();
    }
  }
  
  goToFirstPage(): void {
    this.goToPage(1);
  }
  
  goToLastPage(): void {
    this.goToPage(this.totalPages);
  }
  
  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  
  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
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
  
  // Helper: Get route for resource type
  getResourceTypeRoute(type: string): string {
    switch (type) {
      case 'EC2Instance': return 'ec2';
      case 'RDSInstance': return 'rds';
      case 'S3Bucket': return 's3';
      case 'EBSVolume': return 'ebs';
      case 'EBSSnapshot': return 'ebs-snapshots';
      case 'AMI': return 'ami-snapshots';
      default: return '';
    }
  }
  
  // Helper: Get resource identifier based on type
  getResourceIdentifier(resource: any): string {
    if (!resource) return 'Unknown';
    
    switch (resource.resourceType) {
      case 'EC2Instance': return resource.instanceId || 'Unknown';
      case 'S3Bucket': return resource.bucketName || 'Unknown';
      case 'EBSVolume': return resource.volumeId || 'Unknown';
      case 'RDSInstance': return resource.dbInstanceId || 'Unknown';
      case 'EBSSnapshot': return resource.snapshotId || 'Unknown';
      case 'AMI': return resource.imageId || 'Unknown';
      default: return resource.id || 'Unknown';
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
