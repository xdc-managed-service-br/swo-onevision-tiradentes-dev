// src/app/features/components/s3-resources/s3-resources.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService } from '../../../core/services/export.service';
import { TagFormatter } from '../../../shared/utils/tag-formatter';

// Interface for the S3Bucket data structure
interface S3Bucket {
  id: string;
  bucketName: string;
  region: string;
  accountId: string;
  accountName?: string;
  createdAt: string;
  storageClass?: string;
  hasLifecycleRules?: boolean;
  tags?: string;
  lastUpdated?: string;
}

@Component({
  selector: 'app-s3-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './s3-resources.component.html',
  styleUrls: ['./s3-resources.component.css']
})
export class S3ResourcesComponent implements OnInit, OnDestroy {
  // Resource data
  resources: S3Bucket[] = [];
  filteredResources: S3Bucket[] = [];
  selectedResource: S3Bucket | null = null;
  loading = true;
  
  // Search functionality
  searchTerm: string = '';
  
  // Filter values
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Current filter values
  regionFilter: string = '';
  accountFilter: string = '';
  lifecycleFilter: string = '';
  
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
    this.resourceService.getResourcesByType('S3Bucket')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Process resources if needed
          this.resources = data.map(resource => {
            return {
              ...resource,
              // Convert string 'true'/'false' to actual booleans if needed
              hasLifecycleRules: typeof resource.hasLifecycleRules === 'string' 
                ? resource.hasLifecycleRules === 'true' 
                : Boolean(resource.hasLifecycleRules)
            };
          });
          
          this.filteredResources = [...this.resources];
          
          // Extract unique values for filters
          this.uniqueRegions = [...new Set(data.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(data.map(r => r.accountName || r.accountId).filter(Boolean))].sort();
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading S3 buckets:', error);
          this.loading = false;
        }
      });
  }
  
  // Search functionality
  searchBuckets(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
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
  
  // Filter by account
  filterByAccount(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.accountFilter = value;
    this.applyFilters();
  }
  
  // Filter by lifecycle rules
  filterByLifecycleRules(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.lifecycleFilter = value;
    this.applyFilters();
  }
  
  // Apply all filters
  applyFilters(): void {
    this.filteredResources = this.resources.filter(resource => {
      // Apply search filter
      if (this.searchTerm) {
        const bucketName = resource.bucketName ? resource.bucketName.toLowerCase() : '';
        
        if (!bucketName.includes(this.searchTerm)) {
          return false;
        }
      }
      
      // Apply region filter
      if (this.regionFilter && resource.region !== this.regionFilter) {
        return false;
      }
      
      // Apply account filter
      if (this.accountFilter && (resource.accountName || resource.accountId) !== this.accountFilter) {
        return false;
      }
      
      // Apply lifecycle rules filter
      if (this.lifecycleFilter) {
        const isEnabled = this.lifecycleFilter === 'true';
        if (resource.hasLifecycleRules !== isEnabled) {
          return false;
        }
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
    this.regionFilter = '';
    this.accountFilter = '';
    this.lifecycleFilter = '';
    this.searchTerm = '';
    
    // Reset select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    // Reset search input
    const searchInput = document.getElementById('bucketSearch') as HTMLInputElement;
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
      const valueA = a[column as keyof S3Bucket];
      const valueB = b[column as keyof S3Bucket];
      
      // Handle null/undefined values
      if (valueA === undefined || valueA === null) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueB === undefined || valueB === null) return this.sortDirection === 'asc' ? 1 : -1;
      
      // Special handling for dates
      if (column === 'createdAt') {
        const dateA = new Date(valueA as string).getTime();
        const dateB = new Date(valueB as string).getTime();
        
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Handle booleans
      if (typeof valueA === 'boolean') {
        return this.sortDirection === 'asc' 
          ? (valueA === valueB ? 0 : valueA ? 1 : -1)
          : (valueA === valueB ? 0 : valueA ? -1 : 1);
      }
      
      // Default string comparison
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      return this.sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }
  
  // Show bucket details
  showDetails(resource: S3Bucket): void {
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
  
  // Helper: Calculate bucket age
  getBucketAge(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const createdAt = new Date(dateString);
      const now = new Date();
      
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = diffDays % 30;
      
      if (years > 0) {
        return `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}`;
      } else if (months > 0) {
        return `${months} month${months > 1 ? 's' : ''}, ${days} day${days > 1 ? 's' : ''}`;
      } else {
        return `${days} day${days > 1 ? 's' : ''}`;
      }
    } catch (e) {
      return 'N/A';
    }
  }
  
  // Helper: Generate S3 bucket URL
  getBucketUrl(bucketName: string, region: string): string {
    return `https://${bucketName}.s3.${region}.amazonaws.com`;
  }
  
  // Export to CSV
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    
    const filename = 's3-buckets.csv';
    
    // Define the columns to export
    const exportColumns = [
      { key: 'bucketName', label: 'Bucket Name' },
      { key: 'region', label: 'Region' },
      { key: 'accountName', label: 'Account', 
        transform: (resource: any) => resource.accountName || resource.accountId },
      { key: 'createdAt', label: 'Creation Date', 
        transform: (resource: any) => this.formatDate(resource.createdAt) },
      { key: 'storageClass', label: 'Storage Class' },
      { key: 'hasLifecycleRules', label: 'Lifecycle Rules', 
        transform: (resource: any) => resource.hasLifecycleRules ? 'Enabled' : 'Disabled' }
    ];
    
    this.exportService.exportDataToCSV(
      this.filteredResources,
      exportColumns,
      filename
    );
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}