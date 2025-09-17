// src/app/shared/components/resource-list/resource-list.component.ts
import { Component, Input, ContentChild, TemplateRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ResourceService } from '../../../core/services/resource.service';
import { ExportService } from '../../../core/services/export.service';
import { ErrorService } from '../../../core/services/error.service';
import { ResourceTagsComponent } from '../resource-tags/resource-tags.component';

export interface ResourceColumn {
  key: string;
  label: string;
  sortable?: boolean;
  format?: 'text' | 'date' | 'boolean' | 'size' | 'status' | 'json' | 'url';
  transform?: (resource: any) => any;
  templateRef?: string; // Name of the template reference to use
}

export interface ResourceFilter {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

export interface DetailField {
  key: string;
  label: string;
  format?: 'text' | 'date' | 'boolean' | 'size' | 'status' | 'json' | 'url';
  transform?: (resource: any) => any;
}

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ResourceTagsComponent],
  templateUrl: './resource-list.component.html',
})
export class ResourceListComponent implements OnInit {
  @Input() title: string = 'Resources';
  @Input() resourceType: string = '';
  @Input() columns: ResourceColumn[] = [];
  @Input() filters: ResourceFilter[] = [];
  @Input() detailSections: DetailSection[] = [];
  @Input() identifierKey?: string;
  @Input() graphqlQueryName?: string;

  // ContentChild for custom templates
  @ContentChild('resourceTypeTemplate') resourceTypeTemplate?: TemplateRef<any>;
  @ContentChild('resourceIdentifierTemplate') resourceIdentifierTemplate?: TemplateRef<any>;
  @ContentChild('customDetailTemplate') customDetailTemplate?: TemplateRef<any>;
  @ContentChild('exportActions') exportActionsTemplate?: TemplateRef<any>;

  // ViewChild references
  @ViewChild(ResourceTagsComponent) detailComponent?: ResourceTagsComponent;

  // Component state
  resources: any[] = [];
  filteredResources: any[] = [];
  selectedResource: any = null;
  loading: boolean = true;
  error: string | null = null;

  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Filter values
  filterValues: Record<string, any> = {};

  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService,
    private errorService: ErrorService
  ) {}

  ngOnInit(): void {
    this.loadResources();
  }

  // Load resources based on resource type
  loadResources(): void {
    this.loading = true;
    
    if (this.resourceType === 'AWSResource') {
      // Load all resources
      this.resourceService.getAllResources().subscribe({
        next: (data) => {
          this.resources = data;
          this.filteredResources = [...this.resources];
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error);
          this.loading = false;
        }
      });
    } else if (this.resourceType) {
      // Load specific resource type
      this.resourceService.getResourcesByType(this.resourceType).subscribe({
        next: (data) => {
          this.resources = data;
          this.filteredResources = [...this.resources];
          this.loading = false;
        },
        error: (error) => {
          this.handleError(error);
          this.loading = false;
        }
      });
    }
  }

  // Apply a filter
  applyFilter(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filterValues[key] = value;
    this.applyFilters();
  }

  // Apply all active filters
  applyFilters(): void {
    this.filteredResources = this.resources.filter(resource => {
      // Check if resource passes all active filters
      return Object.entries(this.filterValues).every(([key, value]) => {
        if (!value) return true; // Skip empty filters
        
        const resourceValue = this.getResourceValue(resource, key);
        if (resourceValue === undefined || resourceValue === null) return false;
        
        if (typeof resourceValue === 'boolean') {
          return String(resourceValue) === value;
        }
        
        if (typeof resourceValue === 'string') {
          return resourceValue.toLowerCase().includes(String(value).toLowerCase());
        }
        
        return String(resourceValue) === String(value);
      });
    });
    
    // Re-apply sorting if active
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
  }

  // Reset all filters
  resetFilters(): void {
    this.filterValues = {};
    this.filteredResources = [...this.resources];
    
    // Reset the select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    const inputs = document.querySelectorAll('input[type="text"]');
    inputs.forEach(input => (input as HTMLInputElement).value = '');
  }

  // Sort data by column
  sortData(column: string): void {
    // If clicking the same column, toggle direction
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    // Find the column definition
    const columnDef = this.columns.find(c => c.key === column);
    
    this.filteredResources.sort((a, b) => {
      // Get values, applying transform if specified
      let valueA = this.getResourceValue(a, column);
      let valueB = this.getResourceValue(b, column);
      
      // If transform function exists, apply it
      if (columnDef?.transform) {
        valueA = columnDef.transform(a);
        valueB = columnDef.transform(b);
      }
      
      return this.compare(valueA, valueB, this.sortDirection);
    });
  }

  // Compare values for sorting
  private compare(valueA: any, valueB: any, direction: 'asc' | 'desc'): number {
    // Handle undefined/null values
    if (valueA === undefined || valueA === null) return direction === 'asc' ? -1 : 1;
    if (valueB === undefined || valueB === null) return direction === 'asc' ? 1 : -1;
    
    // For dates
    if (valueA instanceof Date && valueB instanceof Date) {
      return direction === 'asc' 
        ? valueA.getTime() - valueB.getTime() 
        : valueB.getTime() - valueA.getTime();
    }
    
    // Try parsing dates from strings
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      const dateA = new Date(valueA);
      const dateB = new Date(valueB);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return direction === 'asc' 
          ? dateA.getTime() - dateB.getTime() 
          : dateB.getTime() - dateA.getTime();
      }
    }
    
    // For numbers
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }
    
    // Default string comparison
    const strA = String(valueA).toLowerCase();
    const strB = String(valueB).toLowerCase();
    
    return direction === 'asc' 
      ? strA.localeCompare(strB) 
      : strB.localeCompare(strA);
  }

  // Show resource details
  showDetails(resource: any): void {
    this.selectedResource = resource;
  }

  // Close resource details
  closeDetails(): void {
    this.selectedResource = null;
  }

  // Export to CSV using column definitions
  exportToCSV(): void {
    if (!this.filteredResources.length || !this.columns.length) return;
    
    const filename = `${this.resourceType.toLowerCase()}-export.csv`;
    
    // Filter out columns with templateRef (these are UI-specific)
    const exportColumns = this.columns
      .filter(col => !col.templateRef) // Remove template columns
      .map(col => ({
        key: col.key,
        label: col.label,
        transform: (item: any) => {
          // Handle special formatting based on column format
          const value = this.getResourceValue(item, col.key);
          
          if (col.transform) {
            return col.transform(item); // Use column's transform function if available
          }
          
          // Apply formatting based on column format
          switch (col.format) {
            case 'date':
              return this.formatDate(value);
            case 'boolean':
              return value ? 'Yes' : 'No';
            case 'size':
              return `${value} GB`;
            case 'status':
              return value; // Just return the status value without formatting
            default:
              return value;
          }
        }
      }));
    
    this.exportService.exportDataToCSV(this.filteredResources, exportColumns, filename);
  }

  // Handle errors
  private handleError(error: any): void {
    console.error(`Error loading ${this.resourceType} resources:`, error);
    this.error = `Failed to load ${this.resourceType} resources`;
    this.errorService.handleError({
      message: this.error,
      details: error
    });
  }

  // Get a value from a resource, handling nested properties
  getResourceValue(resource: any, key: string): any {
    if (!resource) return undefined;
    
    // Handle nested properties with dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      let value = resource;
      for (const part of parts) {
        if (value === undefined || value === null) return undefined;
        value = value[part];
      }
      return value;
    }
    
    // Handle special case for "identifier" virtual property
    if (key === 'identifier') {
      if (this.identifierKey) {
        return resource[this.identifierKey];
      }
      
      // Try to determine the identifier based on resource type
      if (resource.instanceId) return resource.instanceId;
      if (resource.bucketName) return resource.bucketName;
      if (resource.volumeId) return resource.volumeId;
      if (resource.dbInstanceId) return resource.dbInstanceId;
      if (resource.snapshotId) return resource.snapshotId;
      if (resource.imageId) return resource.imageId;
      
      return resource.id || 'Unknown';
    }
    
    return resource[key];
  }

  // Format a value based on format type
  formatValue(value: any, format?: string): string {
    if (value === undefined || value === null) return '';
    
    if (!format) return String(value);
    
    switch (format) {
      case 'date':
        return this.formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'size':
        return `${value} GB`;
      case 'json':
        try {
          const json = typeof value === 'string' ? JSON.parse(value) : value;
          return JSON.stringify(json, null, 2);
        } catch (e) {
          return String(value);
        }
      default:
        return String(value);
    }
  }

  // Format a date
  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  }

  // Get CSS class for status
  getStatusClass(status: string): string {
    if (!status) return '';
    
    status = status.toLowerCase();
    if (['running', 'available', 'active'].includes(status)) return 'status-running';
    if (['stopped', 'stopping'].includes(status)) return 'status-stopped';
    if (['pending', 'creating'].includes(status)) return 'status-pending';
    if (['terminated', 'deleted'].includes(status)) return 'status-terminated';
    
    return 'status-unknown';
  }
}