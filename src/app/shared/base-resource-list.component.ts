// src/app/shared/base-resource-list.component.ts
import { Directive, OnInit, OnDestroy, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ResourceService } from '../core/services/resource.service';
import { ErrorService } from '../core/services/error.service';
import { ExportService } from '../core/services/export.service';
import { ExportFields } from './utils/export-fields';

// Define the structure for table columns
export interface ResourceColumn {
  key: string;
  label: string;
  sortable?: boolean;
  transform?: (resource: any) => string | number | boolean; // Optional data transformation function
  format?: 'date' | 'currency' | string; // Optional formatting instruction
  templateRef?: string; // Optional template reference name for custom cell rendering
}

export interface ResourceFilter {
  key: string;
  label: string;
  options?: string[];
  type?: 'select' | 'text';
}

@Directive()
export abstract class BaseResourceListComponent implements OnInit, OnDestroy {
  // Common properties for all resource list components
  @Input() title: string = 'Resources';
  
  resources: any[] = [];
  filteredResources: any[] = [];
  loading = true;
  selectedResource: any = null;
  
  // Sorting properties
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtering properties
  filterValues: Record<string, string> = {};
  
  // Resource-specific configuration
  abstract resourceType: string;
  abstract columns: ResourceColumn[];
  abstract filters: ResourceFilter[];
  
  protected destroy$ = new Subject<void>();
  
  constructor(
    protected resourceService: ResourceService,
    protected errorService: ErrorService,
    protected exportService: ExportService
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
    
    this.resourceService.getResourcesByType(this.resourceType)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (data) => {
          this.resources = data;
          this.filteredResources = [...this.resources];
          this.initializeFilters();
        },
        error: (error) => {
          console.error(`Error fetching ${this.resourceType} resources:`, error);
          this.errorService.handleError({
            message: `Failed to load ${this.resourceType} resources`,
            details: error
          });
        }
      });
  }
  
  initializeFilters(): void {
    // Initialize any filters that need data from the resources
    // This method can be overridden by child components if needed
  }
  
  applyFilter(key: string, value: string): void {
    this.filterValues[key] = value;
    this.applyFilters();
  }
  
  applyFilters(): void {
    this.filteredResources = this.resources.filter(resource => {
      // Check if resource passes all active filters
      return Object.entries(this.filterValues).every(([key, value]) => {
        if (!value) return true; // Skip empty filters
        
        const resourceValue = this.getResourceValue(resource, key);
        if (!resourceValue) return false;
        
        if (typeof resourceValue === 'string') {
          return resourceValue.toLowerCase().includes(value.toLowerCase());
        }
        
        return resourceValue === value;
      });
    });
    
    // Re-apply sorting if active
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
  }
  
  getResourceValue(resource: any, key: string): any {
    // Handle nested properties with dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      let value = resource;
      for (const part of parts) {
        if (!value) return null;
        value = value[part];
      }
      return value;
    }
    
    return resource[key];
  }
  
  resetFilters(): void {
    this.filterValues = {};
    this.filteredResources = [...this.resources];
  }
  
  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredResources.sort((a, b) => {
      // Handle special numeric and date cases
      const valueA = this.getResourceValue(a, column);
      const valueB = this.getResourceValue(b, column);
      
      return this.compare(valueA, valueB, this.sortDirection);
    });
  }
  
  compare(valueA: any, valueB: any, direction: 'asc' | 'desc'): number {
    if (valueA === valueB) return 0;
    
    // Handle null/undefined values
    if (valueA == null) return direction === 'asc' ? -1 : 1;
    if (valueB == null) return direction === 'asc' ? 1 : -1;
    
    // Handle numbers
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }
    
    // Handle dates
    if (valueA instanceof Date && valueB instanceof Date) {
      return direction === 'asc' ? valueA.getTime() - valueB.getTime() : valueB.getTime() - valueA.getTime();
    }
    
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      // Try to parse dates
      const dateA = new Date(valueA);
      const dateB = new Date(valueB);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }
      
      return direction === 'asc' 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    }
    
    // Default string comparison
    const strA = String(valueA);
    const strB = String(valueB);
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  }
  
  showDetails(resource: any): void {
    this.selectedResource = resource;
  }
  
  closeDetails(): void {
    this.selectedResource = null;
  }
  
  formatValue(value: any, format: string = 'default'): string {
    if (value === undefined || value === null) return '';
    
    switch (format) {
      case 'date':
        return this.formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'size':
        return `${value} GB`;
      default:
        return String(value);
    }
  }
  
  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  }
  
  getStatusClass(status: string): string {
    if (!status) return '';
    
    status = status.toLowerCase();
    if (['running', 'available', 'active'].includes(status)) return 'status-running';
    if (['stopped', 'stopping'].includes(status)) return 'status-stopped';
    if (['pending', 'creating'].includes(status)) return 'status-pending';
    if (['terminated', 'deleted'].includes(status)) return 'status-terminated';
    
    return 'status-unknown';
  }
  
// Then replace the exportToCSV method with this updated version
exportToCSV(): void {
  if (!this.filteredResources.length) return;
  
  const filename = `${this.resourceType.toLowerCase()}-inventory.csv`;
  
  // Get the field definitions for this resource type from the existing ExportFields
  const fields = ExportFields[this.resourceType] || [];
  
  if (fields.length > 0) {
    // If we have field definitions, filter the data before export
    const exportData = this.filteredResources.map(resource => {
      const filteredResource: any = {};
      fields.forEach(field => {
        if (resource[field] !== undefined) {
          filteredResource[field] = resource[field];
        }
      });
      return filteredResource;
    });
    
    // Create export columns from fields
    const exportColumns = fields.map(field => ({
      key: field,
      label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')
    }));
    
    this.exportService.exportDataToCSV(exportData, exportColumns, filename);
  } else {
    // Fall back to exporting all fields using the component's columns configuration
    this.exportService.exportDataToCSV(this.filteredResources, this.columns, filename);
  }
}
}