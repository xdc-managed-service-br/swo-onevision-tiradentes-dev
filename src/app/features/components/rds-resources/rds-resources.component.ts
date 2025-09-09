import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';

@Component({
  selector: 'app-rds-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './rds-resources.component.html',
  styleUrls: ['./rds-resources.component.css']
})
export class RdsResourcesComponent implements OnInit, OnDestroy {
  resources: any[] = [];
  filteredResources: any[] = [];
  loading = true;
  selectedResource: any = null;
  
  // Search functionality
  searchTerm: string = '';
  
  // Unique values for filters
  uniqueEngines: string[] = [];
  uniqueClasses: string[] = [];
  uniqueRegions: string[] = [];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Current filter values
  engineFilter: string = '';
  classFilter: string = '';
  regionFilter: string = '';
  
  // Define export columns for RDS instances
  exportColumns: ExportColumn[] = [
    { key: 'dbInstanceId', label: 'Instance ID' },
    { key: 'dbName', label: 'Database Name' },
    { key: 'engine', label: 'Engine' },
    { key: 'engineVersion', label: 'Engine Version' },
    { key: 'status', label: 'Status' },
    { 
      key: 'allocatedStorage', 
      label: 'Storage',
      transform: (resource) => this.formatStorage(resource.allocatedStorage)
    },
    { key: 'storageType', label: 'Storage Type' },
    { key: 'instanceClass', label: 'Instance Class' },
    { 
      key: 'multiAZ', 
      label: 'Multi-AZ',
      transform: (resource) => resource.multiAZ ? 'Yes' : 'No'
    },
    { key: 'region', label: 'Region' },
    { 
      key: 'accountId', 
      label: 'Account',
      transform: (resource) => resource.accountName || resource.accountId
    }
  ];
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {}
  
  ngOnInit(): void {
    this.loadResources();
  }
  
  loadResources(): void {
    this.loading = true;
    
    this.resourceService.getResourcesByType('RDSInstance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data;
          this.filteredResources = [...this.resources];
          
          // Extract unique values for filters
          this.uniqueEngines = [...new Set(data.map(r => r.engine).filter(Boolean))].sort();
          this.uniqueClasses = [...new Set(data.map(r => r.instanceClass).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(data.map(r => r.region).filter(Boolean))].sort();
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading RDS instances:', error);
          this.loading = false;
        }
      });
  }
  
  // Search functionality
  searchInstances(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }
  
  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }
  
  // Filter by engine
  filterByEngine(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.engineFilter = value;
    this.applyFilters();
  }
  
  // Filter by instance class
  filterByClass(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.classFilter = value;
    this.applyFilters();
  }
  
  // Filter by region
  filterByRegion(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.regionFilter = value;
    this.applyFilters();
  }
  
  // Apply all filters
  applyFilters(): void {
    this.filteredResources = this.resources.filter(resource => {
      // Apply search filter
      if (this.searchTerm) {
        const instanceId = resource.dbInstanceId ? resource.dbInstanceId.toLowerCase() : '';
        const dbName = resource.dbName ? resource.dbName.toLowerCase() : '';
        
        if (!instanceId.includes(this.searchTerm) && !dbName.includes(this.searchTerm)) {
          return false;
        }
      }
      
      // Apply engine filter
      if (this.engineFilter && resource.engine !== this.engineFilter) {
        return false;
      }
      
      // Apply instance class filter
      if (this.classFilter && resource.instanceClass !== this.classFilter) {
        return false;
      }
      
      // Apply region filter
      if (this.regionFilter && resource.region !== this.regionFilter) {
        return false;
      }
      
      return true;
    });
    
    // Reapply sorting if active
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
  }
  
  // Reset all filters
  resetFilters(): void {
    this.engineFilter = '';
    this.classFilter = '';
    this.regionFilter = '';
    this.searchTerm = '';
    
    // Reset select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    // Reset search input
    const searchInput = document.getElementById('instanceSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.filteredResources = [...this.resources];
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
      if (column === 'startTime') {
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
  
  // Helper: Format storage size
  formatStorage(size?: number): string {
    if (size === undefined || size === null) return 'N/A';
    return `${size} GB`;
  }
  
  // Helper: Get status CSS class
  getStatusClass(status?: string): string {
    if (!status) return 'status-unknown';
    
    status = status.toLowerCase();
    if (status === 'available') return 'status-available';
    if (status === 'creating') return 'status-creating';
    if (status === 'deleting') return 'status-stopped';
    if (status === 'backing-up') return 'status-pending';
    if (status === 'failed') return 'status-stopped';
    
    return 'status-unknown';
  }
  
  // Export to CSV
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    
    const filename = 'rds-instances.csv';
    this.exportService.exportDataToCSV(
      this.filteredResources, 
      this.exportColumns,
      filename
    );
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}