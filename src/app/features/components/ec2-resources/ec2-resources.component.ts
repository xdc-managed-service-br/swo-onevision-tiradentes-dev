import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { TagFormatter } from '../../../shared/utils/tag-formatter';

interface EC2Tag {
  Key: string;
  Value: string;
}

// Interface for column definition
interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  transform?: (resource: any) => string;
}

@Component({
  selector: 'app-ec2-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './ec2-resources.component.html',
  styleUrls: [
    './ec2-resources.component.css',
    '../../../shared/styles/onevision-base.css' 
  ]
})
export class EC2ResourcesComponent implements OnInit, OnDestroy {
  resources: any[] = [];
  filteredResources: any[] = [];
  loading = true;
  selectedResource: any = null;
  uniqueAccounts: string[] = [];
  
  // Search functionality
  searchTerm: string = '';
  
  // Unique values for filters
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];
  uniqueRegions: string[] = [];
  
  // Sorting
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Current filter values
  stateFilter: string = '';
  typeFilter: string = '';
  regionFilter: string = '';
  cwAgentFilter: string = '';
  accountFilter: string = '';
  
  // Column customization
  showColumnCustomizer = false;
  selectedColumns: Set<string> = new Set();
  
  // Define all available columns
  availableColumns: ColumnDefinition[] = [
    { key: 'instanceId', label: 'Instance ID', sortable: true },
    { key: 'instanceName', label: 'Name', sortable: true },
    { key: 'instanceType', label: 'Type', sortable: true },
    { key: 'instanceState', label: 'State', sortable: true },
    { key: 'healthStatus', label: 'Health Status', sortable: true, 
      transform: (resource) => this.getHealthStatusText(resource) },
    { key: 'cwAgentMemoryDetected', label: 'CW Monitoring', sortable: true,
      transform: (resource) => resource.cwAgentMemoryDetected ? 'Enabled' : 'Disabled' },
    { key: 'privateIps', label: 'Private IPs', sortable: false,
      transform: (resource) => resource.privateIpArray?.join(', ') || 'N/A' },
    { key: 'publicIps', label: 'Public IPs', sortable: false,
      transform: (resource) => resource.publicIpArray?.join(', ') || 'N/A' },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'accountId', label: 'Account ID', sortable: true },
    { key: 'accountName', label: 'Account Name', sortable: true },
    { key: 'createdAt', label: 'Launch Time', sortable: true,
      transform: (resource) => this.formatDate(resource.createdAt) },
    { key: 'platformDetails', label: 'Platform', sortable: true },
    { key: 'amiName', label: 'AMI Name', sortable: true },
    { key: 'iamRole', label: 'IAM Role', sortable: true },
    { key: 'ssmStatus', label: 'SSM Status', sortable: true },
    { key: 'ssmPingStatus', label: 'SSM Ping Status', sortable: true },
    { key: 'ssmVersion', label: 'SSM Version', sortable: true },
    { key: 'ssmLastPingTime', label: 'Last Ping Time', sortable: true,
      transform: (resource) => this.formatDate(resource.ssmLastPingTime) },
    { key: 'swoMonitor', label: 'SWO Monitor', sortable: true },
    { key: 'swoPatch', label: 'SWO Patch', sortable: true },
    { key: 'swoBackup', label: 'SWO Backup', sortable: true },
    { key: 'swoRiskClass', label: 'Risk Class', sortable: true },
    { key: 'patchGroup', label: 'Patch Group', sortable: true },
    { key: 'autoStart', label: 'Auto Start', sortable: true },
    { key: 'autoShutdown', label: 'Auto Shutdown', sortable: true },
    { key: 'saturday', label: 'Saturday Schedule', sortable: true },
    { key: 'sunday', label: 'Sunday Schedule', sortable: true },
    { key: 'lastUpdated', label: 'Last Updated', sortable: true,
      transform: (resource) => this.formatDate(resource.lastUpdated) }
  ];
  
  // Default columns to show
  defaultColumns = ['instanceId', 'instanceName', 'instanceType', 'state', 'healthStatus', 
                    'cwAgentMemoryDetected', 'privateIps', 'region', 'accountId', 'accountName', 'createdAt'];
  
  // Required columns that cannot be deselected
  requiredColumns = ['instanceId'];
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {
    // Initialize selected columns with defaults
    this.selectedColumns = new Set(this.defaultColumns);
    
    // Load saved column preferences from localStorage
    this.loadColumnPreferences();
  }
  
  ngOnInit(): void {
    this.loadResources();
  }
  
  loadResources(): void {
    this.loading = true;
    this.resourceService.getResourcesByType('EC2Instance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.resources = data.map(resource => {
            const parsedTagsObj = TagFormatter.parseTags(resource.tags);
            const parsedTagsArray: EC2Tag[] = Object.entries(parsedTagsObj).map(([key, value]) => ({
              Key: key,
              Value: value
            }));

            const privateIpArray = TagFormatter.parseIpList(resource.privateIps);
            const publicIpArray = TagFormatter.parseIpList(resource.publicIps);

            return {
              ...resource,           
              // Convert string 'true'/'false' to actual booleans if needed
              privateIpArray,
              publicIpArray,
              cwAgentMemoryDetected: typeof resource.cwAgentMemoryDetected === 'string' 
                ? resource.cwAgentMemoryDetected === 'true' 
                : Boolean(resource.cwAgentMemoryDetected),
              cwAgentDiskDetected: typeof resource.cwAgentDiskDetected === 'string' 
                ? resource.cwAgentDiskDetected === 'true' 
                : Boolean(resource.cwAgentDiskDetected),
              // Extract values from parsed tags
              swoMonitor: parsedTagsObj['swoMonitor'] || resource.swoMonitor,
              swoPatch: parsedTagsObj['swoPatch'] || resource.swoPatch,
              swoBackup: parsedTagsObj['swoBackup'] || resource.swoBackup,
              swoRiskClass: parsedTagsObj['swoRiskClass'] || resource.swoRiskClass,
              patchGroup: parsedTagsObj['PatchGroup'] || resource.patchGroup,
              // Auto scheduling tags
              autoStart: parsedTagsObj['Start'] || resource.autoStart,
              autoShutdown: parsedTagsObj['Shutdown'] || resource.autoShutdown,
              saturday: parsedTagsObj['Saturday'] || resource.saturday,
              sunday: parsedTagsObj['Sunday'] || resource.sunday,
              // Store both formats for reference
              parsedTags: parsedTagsArray,
              tagObject: parsedTagsObj,
            };
          });
          
          this.filteredResources = [...this.resources];
          
          // Extract unique values for filters
          this.uniqueStates = [...new Set(data.map(r => r.instanceState).filter(Boolean))].sort();
          this.uniqueTypes = [...new Set(data.map(r => r.instanceType).filter(Boolean))].sort();
          this.uniqueRegions = [...new Set(data.map(r => r.region).filter(Boolean))].sort();
          this.uniqueAccounts = [...new Set(data.map(r => r.accountName || r.accountId).filter(Boolean))].sort();
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading EC2 instances:', error);
          this.loading = false;
        }
      });
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
    this.availableColumns.forEach(col => {
      this.selectedColumns.add(col.key);
    });
  }
  
  deselectAllColumns(): void {
    this.selectedColumns.clear();
    // Keep required columns selected
    this.requiredColumns.forEach(key => {
      this.selectedColumns.add(key);
    });
  }
  
  applyColumnSelection(): void {
    // Save preferences to localStorage
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }
  
  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter(col => this.selectedColumns.has(col.key));
  }
  
  getColumnValue(column: ColumnDefinition, resource: any): string {
    if (column.transform) {
      return column.transform(resource);
    }
    
    const value = resource[column.key];
    
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  }
  
  getColumnClass(key: string, resource: any): string {
    if (key === 'state') {
      return this.getStatusClass(resource.instanceState);
    }
    
    if (key === 'healthStatus') {
      return this.getHealthStatusClass(resource);
    }
    
    if (key === 'cwAgentMemoryDetected') {
      return resource.cwAgentMemoryDetected ? 'status-running' : 'status-stopped';
    }
    
    if (key === 'privateIps' || key === 'publicIps') {
      return 'ip-address-column';
    }
    
    return '';
  }
  
  shouldBeFullWidth(key: string): boolean {
    // Determine which fields should take full width in mobile cards
    return ['instanceName', 'platformDetails', 'amiName', 'privateIps', 'publicIps'].includes(key);
  }
  
  // Save and load column preferences
  saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem('ec2-columns', JSON.stringify(preferences));
    } catch (e) {
      console.warn('Could not save column preferences:', e);
    }
  }
  
  loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('ec2-columns');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.selectedColumns = new Set(preferences);
        // Ensure required columns are always included
        this.requiredColumns.forEach(key => {
          this.selectedColumns.add(key);
        });
      }
    } catch (e) {
      this.selectedColumns = new Set(this.defaultColumns);
    }
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
  
  // Filter by state
  filterByState(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.stateFilter = value;
    this.applyFilters();
  }
  
  // Filter by instance type
  filterByType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.typeFilter = value;
    this.applyFilters();
  }
  
  // Filter by region
  filterByRegion(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.regionFilter = value;
    this.applyFilters();
  }
  
  // Filter by CloudWatch Agent
  filterByCWAgent(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.cwAgentFilter = value;
    this.applyFilters();
  }

  // Filter by account ID
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
        const instanceId = resource.instanceId ? resource.instanceId.toLowerCase() : '';
        const instanceName = resource.instanceName ? resource.instanceName.toLowerCase() : '';
        
        if (!instanceId.includes(this.searchTerm) && !instanceName.includes(this.searchTerm)) {
          return false;
        }
      }
      
      // Apply state filter
      if (this.stateFilter && resource.instanceState  !== this.stateFilter) {
        return false;
      }
      
      // Apply type filter
      if (this.typeFilter && resource.instanceType !== this.typeFilter) {
        return false;
      }
      
      // Apply region filter
      if (this.regionFilter && resource.region !== this.regionFilter) {
        return false;
      }
      
      // Apply CloudWatch Agent filter
      if (this.cwAgentFilter) {
        const isEnabled = this.cwAgentFilter === 'true';
        if (resource.cwAgentMemoryDetected !== isEnabled) {
          return false;
        }
      }
      
      // Apply account filter
      if (this.accountFilter && (resource.accountName || resource.accountId) !== this.accountFilter) {
        return false;
      }
      
      return true;
    });
    
    // Reapply sorting if active
    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }
  }

  getHealthStatusText(resource: any): string {
    // Skip health checks for stopped instances
    if (resource.instanceState !== 'running') {
      return 'N/A';
    }

    // Check if we have health check information
    if (typeof resource.healthChecksPassed === 'number' && 
        typeof resource.healthChecksTotal === 'number') {
      return `${resource.healthChecksPassed} / ${resource.healthChecksTotal}`;
    }
    
    // If we have no health check info but instance is running, build status from individual checks
    let passedChecks = 0;
    let totalChecks = 0;
    
    // System Status Check
    if (resource.systemStatus) {
      totalChecks++;
      if (resource.systemStatus === 'Ok') passedChecks++;
    }
    
    // Instance Status Check
    if (resource.instanceStatus) {
      totalChecks++;
      if (resource.instanceStatus === 'Ok') passedChecks++;
    }
    
    // EBS Status Check
    if (resource.ebsStatus) {
      totalChecks++;
      if (resource.ebsStatus === 'Ok') passedChecks++;
    }
    
    if (totalChecks > 0) {
      return `${passedChecks} / ${totalChecks}`;
    }
    
    // If no health information is available
    return 'No Health Data';
  }
  
  /**
   * Get CSS class for health status display
   */
  getHealthStatusClass(resource: any): string {
    // Skip health status for non-running instances
    if (resource.instanceState  !== 'running') {
      return 'status-unknown';
    }
    
    // Check if all checks are passing
    const isFullyHealthy = 
      (resource.healthChecksPassed === resource.healthChecksTotal && resource.healthChecksTotal > 0) ||
      (resource.systemStatus === 'Ok' && resource.instanceStatus === 'Ok' && resource.ebsStatus === 'Ok');
      
    if (isFullyHealthy) {
      return 'status-running';
    }
    
    // Check if we have at least one failing check
    const hasFailingCheck = 
      (resource.healthChecksPassed < resource.healthChecksTotal) ||
      (resource.systemStatus === 'failed' || resource.instanceStatus === 'failed' || resource.ebsStatus === 'failed');
    
    if (hasFailingCheck) {
      return 'status-warning';
    }
    
    // If we can't determine health or some checks are impaired
    return 'status-warning';
  }
  
  // Reset all filters
  resetFilters(): void {
    this.stateFilter = '';
    this.typeFilter = '';
    this.regionFilter = '';
    this.cwAgentFilter = '';
    this.accountFilter = '';
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
      if (column === 'launchTime' || column === 'createdAt' || column === 'updatedAt') {
        const dateA = valueA ? new Date(valueA) : new Date(0);
        const dateB = valueB ? new Date(valueB) : new Date(0);
        return this.sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime() 
          : dateB.getTime() - dateA.getTime();
      }
      
      // Handle booleans
      if (typeof valueA === 'boolean') {
        return this.sortDirection === 'asc' 
          ? (valueA === valueB ? 0 : valueA ? 1 : -1)
          : (valueA === valueB ? 0 : valueA ? -1 : 1);
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
  
  showDetails(r: any) {
    this.selectedResource = r;
  }
  refresh(): void {
  this.resourceService.clearCache();
  this.loadResources();
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
  
  // Helper: Get CSS class for status
  getStatusClass(status: string): string {
    if (!status) return '';
    
    status = status.toLowerCase();
    if (status === 'running') return 'status-running';
    if (status === 'stopped') return 'status-stopped';
    if (status === 'pending') return 'status-pending';
    if (status === 'terminated') return 'status-terminated';
    
    return 'status-unknown';
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Updated Export to CSV method using only visible columns
  exportToCSV(): void {
    if (!this.filteredResources.length) return;
    
    const filename = 'ec2-instances.csv';
    
    // Get only the visible columns for export
    const visibleColumns = this.getVisibleColumns();
    const exportColumns: ExportColumn[] = visibleColumns.map(col => ({
      key: col.key,
      label: col.label,
      transform: col.transform || ((resource) => {
        // Special handling for IP arrays
        if (col.key === 'privateIps' && resource.privateIpArray) {
          return resource.privateIpArray.join('; ');
        }
        if (col.key === 'publicIps' && resource.publicIpArray) {
          return resource.publicIpArray.join('; ');
        }
        return resource[col.key];
      })
    }));
    
    this.exportService.exportDataToCSV(
      this.filteredResources, 
      exportColumns,
      filename
    );
  }
}