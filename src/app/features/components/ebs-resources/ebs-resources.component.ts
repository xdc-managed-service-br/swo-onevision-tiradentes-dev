// src/app/features/components/ebs-resources/ebs-resources.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';

// Interface for type safety
interface EBSVolume {
  volumeId: string;
  size?: number;
  volumeType?: string;
  state?: string;
  encrypted?: boolean;
  attachedInstances?: string; // JSON string of attached instances
  region: string;
  accountId: string;
  accountName?: string;
  tags?: string;
}

// Interface for attached instance
interface AttachedInstance {
  instanceId: string;
  device: string;
  state: string;
}

@Component({
  selector: 'app-ebs-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './ebs-resources.component.html',
  styleUrls: ['./ebs-resources.component.css']
})

export class EbsResourcesComponent implements OnInit, OnDestroy {
  // Resource data
  resources: EBSVolume[] = [];
  filteredResources: EBSVolume[] = [];
  selectedResource: EBSVolume | null = null;
  loading = true;

  uniqueStates: string[] = [];
  stateFilter: string = '';
  
  // Search functionality
  searchTerm: string = '';
  
  // Filter values
  uniqueTypes: string[] = [];
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Current filter values
  typeFilter: string = '';
  encryptedFilter: string = '';
  regionFilter: string = '';
  accountFilter: string = '';
  
  // Define export columns for EBS volumes
  exportColumns: ExportColumn[] = [
    { key: 'volumeId', label: 'Volume ID' },
    { key: 'size', label: 'Size (GB)' },
    { key: 'volumeType', label: 'Volume Type' },
    { key: 'encrypted', label: 'Encrypted',
      transform: (resource) => resource.encrypted ? 'Yes' : 'No' },
    { key: 'state',     label: 'State' },
    { key: 'region', label: 'Region' },
    { key: 'accountName', label: 'Account',
      transform: (resource) => resource.accountName || resource.accountId },
    { key: 'attachedInstances', label: 'Attached Instances',
      transform: (resource) => {
        try {
          const instances = typeof resource.attachedInstances === 'string' ? 
            JSON.parse(resource.attachedInstances) : resource.attachedInstances;
          if (Array.isArray(instances) && instances.length > 0) {
            return instances.map((i: any) => i.instanceId).join(', ');
          }
          return 'None';
        } catch (e) {
          return 'None';
        }
      }
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
    this.resourceService.getResourcesByType('EBSVolume')
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          
          // Process resources 
          this.resources = data.map(resource => {
            
            // Make sure to handle state for use in our attached instances logic
            const state = resource.state || 'unknown';

            // ADICIONAR ESTE BLOCO: Processamento de attachedInstances
            let processedAttachedInstances = resource.attachedInstances;
            if (processedAttachedInstances) {
              // Se for string, tenta fazer parse para JSON
              if (typeof processedAttachedInstances === 'string') {
                try {
                  processedAttachedInstances = JSON.parse(processedAttachedInstances);
                } catch (e) {
                  console.error('Error parsing attachedInstances for volume:', resource.volumeId, e);
                  processedAttachedInstances = [];
                }
              }
            }
            
            return {
              ...resource,
              // Ensure encrypted is properly typed as boolean
              encrypted: typeof resource.encrypted === 'string' 
                ? resource.encrypted === 'true' 
                : Boolean(resource.encrypted),
              // Ensure size is numeric
              size: typeof resource.size === 'string' ? parseFloat(resource.size) : resource.size,
              // Ensure state is captured
              state
            };
          });
          
          this.filteredResources = [...this.resources];
          
          // Extract unique values for filters
          this.uniqueTypes = [...new Set(data.map(r => r.volumeType).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(data.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(data.map(r => r.accountName || r.accountId).filter(Boolean))].sort();
          
          // Populate uniqueStates for the new State filter
          this.uniqueStates = [...new Set(this.resources.map(r => r.state).filter((state): state is string => Boolean(state)))].sort();
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading EBS volumes:', error);
          this.loading = false;
        }
      });
  }
  
  // Filter by volume type
  filterByType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.typeFilter = value;
    this.applyFilters();
  }
  
  // Filter by encryption status
  filterByEncryption(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.encryptedFilter = value;
    this.applyFilters();
  }

  filterByState(event: Event) {
    this.stateFilter = (event.target as HTMLSelectElement).value;
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
        const volumeId = resource.volumeId ? resource.volumeId.toLowerCase() : '';
        const volumeType = resource.volumeType ? resource.volumeType.toLowerCase() : '';
        const accountName = resource.accountName ? resource.accountName.toLowerCase() : '';
        
        if (!volumeId.includes(this.searchTerm) && 
            !volumeType.includes(this.searchTerm) && 
            !accountName.includes(this.searchTerm)) {
          return false;
        }
      }
      
      // Apply type filter
      if (this.typeFilter && resource.volumeType !== this.typeFilter) {
        return false;
      }
      
      // Apply encryption filter
      if (this.encryptedFilter) {
        if (this.encryptedFilter === 'yes' && !resource.encrypted) {
          return false;
        }
        if (this.encryptedFilter === 'no' && resource.encrypted) {
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

      // Apply state filter
      if (this.stateFilter && resource.state !== this.stateFilter) {
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
    this.typeFilter = '';
    this.encryptedFilter = '';
    this.regionFilter = '';
    this.accountFilter = '';
    this.searchTerm = '';
    
    // Reset select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.value = '');
    
    // Reset search input
    const searchInput = document.getElementById('volumeSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.filteredResources = [...this.resources];
  }
  
  // Search functionality
  searchVolumes(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }
  
  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchTerm = '';
    this.applyFilters();
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
      const valueA = a[column as keyof EBSVolume];
      const valueB = b[column as keyof EBSVolume];
      
      // Handle null/undefined values
      if (valueA === undefined || valueA === null) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueB === undefined || valueB === null) return this.sortDirection === 'asc' ? 1 : -1;
      
      // Special handling for size (numeric)
      if (column === 'size' && typeof valueA === 'number' && typeof valueB === 'number') {
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
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
  
  // Show volume details
  showDetails(resource: EBSVolume): void {
    this.selectedResource = resource;
  }
  
  // Close details modal
  closeDetails(): void {
    this.selectedResource = null;
  }
  
  // Helper: Format size (GB)
  formatSize(size?: number): string {
    if (size === undefined || size === null) return 'N/A';
    return `${size} GB`;
  }
  
  // Helper: Format boolean
  formatBoolean(value?: boolean): string {
    if (value === undefined || value === null) return 'N/A';
    return value ? 'Yes' : 'No';
  }
  
  // Helper: Get CSS class for encryption status
  getEncryptionClass(encrypted?: boolean): string {
    if (encrypted === undefined || encrypted === null) return '';
    return encrypted ? 'status-encrypted' : 'status-unencrypted';
  }

  /**
   * Return CSS class for volume state badge
   */
  getStateClass(state: string): string {
    const st = state?.toLowerCase() || '';
    if (st === 'available') return 'status-available';
    if (st === 'in-use')    return 'status-in-use';
    return '';
  }
  
  // Helper: Get CSS class for attachment state
  getAttachmentStateClass(state: string): string {
    state = state.toLowerCase();
    if (state === 'attached') return 'status-attached';
    if (state === 'attaching') return 'status-attaching';
    if (state === 'detaching') return 'status-detaching';
    if (state === 'detached') return 'status-detached';
    return '';
  }

  // Replace the existing getAttachedInstances function with this one
  getAttachedInstances(resource: EBSVolume): AttachedInstance[] {
    if (!resource.attachedInstances) return [];
    
    try {
      const parsed = typeof resource.attachedInstances === 'string' 
        ? JSON.parse(resource.attachedInstances) 
        : resource.attachedInstances;
      
      if (Array.isArray(parsed)) {
        // Handle the case where it's an array of strings (instance IDs)
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          return parsed.map(instanceId => ({
            instanceId: instanceId,
            device: 'N/A', // Default value since we don't have this info
            state: resource.state === 'in-use' ? 'attached' : 'detached' // Use volume state to determine attachment state
          }));
        }
        
        // Original case - array of objects with full information
        return parsed;
      }
      
      return [];
    } catch (e) {
      console.error('Error parsing attached instances:', e);
      return [];
    }
  }
  
  // Export to CSV
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    
    const filename = 'ebs-volumes.csv';
    this.exportService.exportDataToCSV(
      this.filteredResources, 
      this.exportColumns,
      filename
    );
  }

exportToXLSX(): void {
  if (!this.filteredResources.length) return;
  
  const filename = 'ebs-volumes.xlsx';
  this.exportService.exportDataToXLSX(
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