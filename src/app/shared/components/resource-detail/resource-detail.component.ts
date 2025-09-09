import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
// Assuming ResourceTagsComponent is correctly located and standalone
import { ResourceTagsComponent } from "../resource-tags/resource-tags.component"; 

// Define and EXPORT the interface so it can be imported elsewhere
export interface ResourceField {
  key: string;
  label: string;
  format?: 'date' | 'boolean' | 'size' | 'json' | 'url'; // Added 'url' based on S3 component
  // Optional transform function for complex formatting (like URL generation)
  transform?: (resource: any) => string; 
}

export interface ResourceSection {
  title: string;
  fields: ResourceField[];
}

@Component({
  selector: 'app-resource-details',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  // Corrected typo: resource-detail.component.html (singular)
  templateUrl: './resource-detail.component.html', 
  styleUrls: ['./resource-detail.component.css']
})
export class ResourceDetailsComponent {
  // Use more specific types if possible, but 'any' allows flexibility
  @Input() resource: any; 
  @Input() resourceType: string = '';
  // Use the exported ResourceSection interface
  @Input() sections: ResourceSection[] = []; 
  @Input() title: string = 'Resource Details';
  @Input() showClose: boolean = true;
  
  @Output() close = new EventEmitter<void>();
  
  constructor() {}

  // Helper function to check if a string is likely JSON
  isJsonString(str: any): boolean {
    if (typeof str !== 'string') return false;
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Helper function to parse tags (assuming tags might be a JSON string or object)
  // NOTE: This seems unused here, might be for ResourceTagsComponent logic
  parseTags(tagsData: string | Record<string, string> | null | undefined): Record<string, string> {
    if (!tagsData) return {};
    if (typeof tagsData === 'object') return tagsData; // Already an object
    try {
      // Attempt to parse if it's a string
      const parsed = JSON.parse(tagsData);
      // Ensure the parsed result is a simple key-value object
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Convert values to strings if necessary
        const result: Record<string, string> = {};
        for (const key in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            result[key] = String(parsed[key]);
          }
        }
        return result;
      }
      // If parsing results in something else (e.g., array, primitive), treat the original string as a single tag value
      return { "value": tagsData }; 
    } catch (e) {
      // If parsing fails, treat the original string as a single tag value
      return { "value": tagsData }; 
    }
  }
  
  // Determines which sections to display based on input or resource type
  getSections(): ResourceSection[] {
    // Prioritize explicitly provided sections
    if (this.sections && this.sections.length > 0) {
      return this.sections;
    }
    
    // Fallback to default sections based on resource type
    switch (this.resourceType) {
      case 'EC2Instance':
        return this.getEC2Sections();
      case 'S3Bucket':
        return this.getS3Sections();
      case 'EBSVolume':
        return this.getEBSVolumeSections();
      case 'RDSInstance':
        return this.getRDSSections();
      // Add cases for AMI/EBS Snapshots if needed
      case 'AMISnapshot':
         return this.getAmiSnapshotSections(); // Example: Implement this
      case 'EBSSnapshot':
         return this.getEbsSnapshotSections(); // Example: Implement this
      default:
        // Generate generic sections as a last resort
        return this.getGenericSections(); 
    }
  }
  
  // --- Default Section Definitions ---
  // (Keep these private as they are internal implementation details)

  private getEC2Sections(): ResourceSection[] {
    return [
      {
        title: 'Instance Information',
        fields: [
          { key: 'instanceId', label: 'Instance ID' },
          { key: 'instanceType', label: 'Instance Type' },
          { key: 'state', label: 'State' },
          { key: 'operatingSystem', label: 'Operating System' },
          { key: 'platformDetails', label: 'Platform Details' },
          { key: 'launchTime', label: 'Launch Time', format: 'date' }
        ]
      },
      {
        title: 'Monitoring',
        fields: [
          { key: 'ssmStatus', label: 'SSM Status' },
          { key: 'ssmVersion', label: 'SSM Version' },
          { key: 'ramUtilization', label: 'RAM Utilization' },
          { key: 'diskUtilization', label: 'Disk Utilization' }
        ]
      },
      {
        title: 'Location',
        fields: [
          { key: 'region', label: 'Region' },
          { key: 'accountId', label: 'Account ID' },
          { key: 'accountName', label: 'Account Name' }
        ]
      }
      // Tags section is handled separately in the template via app-resource-tags
    ];
  }
  
  private getS3Sections(): ResourceSection[] {
    return [
      {
        title: 'Bucket Information',
        fields: [
          { key: 'bucketName', label: 'Bucket Name' },
          { key: 'creationDate', label: 'Creation Date', format: 'date' },
          { key: 'storageClass', label: 'Storage Class' },
          { key: 'hasLifecycleRules', label: 'Lifecycle Rules', format: 'boolean' },
          // Example of using transform for S3 URL
          { 
            key: 'bucketUrl', // A virtual key, doesn't need to exist in data
            label: 'S3 URL', 
            format: 'url', // Use 'url' format if you add specific styling/handling for it
            // Requires resource object with bucketName and region
            transform: (resource) => resource?.bucketName && resource?.region 
              ? `https://${resource.bucketName}.s3.${resource.region}.amazonaws.com` 
              : 'N/A'
          }
        ]
      },
      {
        title: 'Location',
        fields: [
          { key: 'region', label: 'Region' },
          { key: 'accountId', label: 'Account ID' },
          { key: 'accountName', label: 'Account Name' }
        ]
      }
      // Tags section handled separately
    ];
  }
  
  private getEBSVolumeSections(): ResourceSection[] {
     return [
      {
        title: 'Volume Information',
        fields: [
          { key: 'volumeId', label: 'Volume ID' },
          { key: 'size', label: 'Size', format: 'size' },
          { key: 'volumeType', label: 'Volume Type' },
          { key: 'encrypted', label: 'Encrypted', format: 'boolean' },
          // Assuming attachedInstances is an array or object needing JSON view
          { key: 'attachedInstances', label: 'Attached Instances', format: 'json' } 
        ]
      },
      {
        title: 'Location',
        fields: [
          { key: 'region', label: 'Region' },
          { key: 'accountId', label: 'Account ID' },
          { key: 'accountName', label: 'Account Name' }
        ]
      }
      // Tags section handled separately
    ];
  }
  
  private getRDSSections(): ResourceSection[] {
    return [
      {
        title: 'Database Information',
        fields: [
          { key: 'dbInstanceId', label: 'Instance ID' },
          { key: 'engine', label: 'Engine' },
          { key: 'engineVersion', label: 'Engine Version' },
          { key: 'status', label: 'Status' },
          { key: 'instanceClass', label: 'Instance Class' },
          { key: 'allocatedStorage', label: 'Allocated Storage', format: 'size' },
          { key: 'multiAZ', label: 'Multi-AZ', format: 'boolean' }
        ]
      },
      {
        title: 'Location',
        fields: [
          { key: 'region', label: 'Region' },
          { key: 'accountId', label: 'Account ID' },
          { key: 'accountName', label: 'Account Name' }
        ]
      }
      // Tags section handled separately
    ];
  }

  // Placeholder - Implement specific sections for AMI Snapshots
  private getAmiSnapshotSections(): ResourceSection[] {
    return [
       { 
         title: 'AMI Snapshot Info', 
         fields: [
           { key: 'imageId', label: 'Image ID'},
           { key: 'snapshotId', label: 'Snapshot ID'}, 
           { key: 'name', label: 'Name'}, 
           { key: 'creationDate', label: 'Creation Date', format: 'date'},
           { key: 'state', label: 'State'},
           // Add other relevant fields
         ]
       },
       { 
         title: 'Location', 
         fields: [
           { key: 'region', label: 'Region' },
           { key: 'accountId', label: 'Account ID' },
           { key: 'accountName', label: 'Account Name' }
         ]
       }
       // Tags section handled separately
    ];
  }

  // Placeholder - Implement specific sections for EBS Snapshots
  private getEbsSnapshotSections(): ResourceSection[] {
    return [
       { 
         title: 'EBS Snapshot Info', 
         fields: [
           { key: 'snapshotId', label: 'Snapshot ID'}, 
           { key: 'volumeId', label: 'Volume ID'}, 
           { key: 'volumeSize', label: 'Volume Size', format: 'size'}, 
           { key: 'startTime', label: 'Start Time', format: 'date'},
           { key: 'state', label: 'State'},
           // Add other relevant fields
         ]
       },
       { 
         title: 'Location', 
         fields: [
           { key: 'region', label: 'Region' },
           { key: 'accountId', label: 'Account ID' },
           { key: 'accountName', label: 'Account Name' }
         ]
       }
       // Tags section handled separately
    ];
  }

  // Fallback for unknown resource types
  private getGenericSections(): ResourceSection[] {
    if (!this.resource) {
      return [];
    }
    
    const sectionsMap: { [key: string]: ResourceField[] } = {
      'Basic Information': [],
      'Location': [],
      'Additional Details': []
    };
    const knownKeys = new Set<string>();

    // Add fields from specific sections first if they exist
    const specificSections = [
        ...this.getEC2Sections(), 
        ...this.getS3Sections(), 
        ...this.getEBSVolumeSections(), 
        ...this.getRDSSections(),
        ...this.getAmiSnapshotSections(),
        ...this.getEbsSnapshotSections()
    ];
    specificSections.forEach(section => section.fields.forEach(field => knownKeys.add(field.key)));
    
    // Add common keys that might be handled separately (like tags)
    knownKeys.add('tags'); 
    knownKeys.add('id'); // Often a generic ID
    knownKeys.add('__typename'); // GraphQL internal field

    // Categorize remaining fields
    for (const key of Object.keys(this.resource)) {
      if (knownKeys.has(key) || this.resource[key] === null || this.resource[key] === undefined) {
        continue; // Skip already handled, null, or undefined keys
      }

      const field = { key, label: this.formatLabel(key) };
      
      if (['region', 'accountId', 'accountName'].includes(key)) {
        sectionsMap['Location'].push(field);
      } else if (['name', 'arn', 'resourceType', 'lastUpdated'].includes(key)) {
         sectionsMap['Basic Information'].push(field);
      } else {
        // Try to guess format for common patterns
        let format: ResourceField['format'] | undefined;
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
            format = 'date';
        } else if (typeof this.resource[key] === 'boolean') {
            format = 'boolean';
        } else if (typeof this.resource[key] === 'object') {
            format = 'json'; // Display objects/arrays as JSON
        }
        sectionsMap['Additional Details'].push({ ...field, format });
      }
    }
    
    // Convert map to array of sections, filtering out empty ones
    return Object.entries(sectionsMap)
      .map(([title, fields]) => ({ title, fields }))
      .filter(section => section.fields.length > 0);
  }
  
  // --- Formatting Helpers ---

  // Formats a camelCase key into a readable label
  formatLabel(key: string): string {
    // Handle specific known abbreviations or names
    if (key === 'dbInstanceId') return 'DB Instance ID';
    if (key === 'multiAZ') return 'Multi-AZ';
    if (key === 'ssmStatus') return 'SSM Status';
    if (key === 'ssmVersion') return 'SSM Version';
    
    // General camelCase to Title Case conversion
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  // Formats a value based on the specified format type
  formatValue(value: any, format?: ResourceField['format']): string {
    if (value === undefined || value === null) {
      return 'N/A'; // Use 'N/A' or '-' for empty values
    }
    
    // Handle different formats
    switch (format) {
      case 'date':
        return this.formatDate(value);
      case 'boolean':
        // Check for string representations of boolean as well
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') return 'Yes';
          if (value.toLowerCase() === 'false') return 'No';
        }
        return value ? 'Yes' : 'No';
      case 'size':
        // Assuming value is in GB, add units
        return `${value} GB`; 
      case 'json':
        try {
          // Ensure consistent spacing and handle non-string objects
          const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
          return JSON.stringify(parsedValue, null, 2); // Pretty print JSON
        } catch (e) {
          // If JSON parsing fails, return the original value as string
          console.warn(`Failed to format value as JSON for key:`, value, e);
          return String(value); 
        }
      case 'url':
         // URLs are typically handled by the transform function or are already strings
         return String(value);
      default:
        // Default to string conversion
        return String(value);
    }
  }
  
  // Safely formats a date string
  formatDate(dateInput: string | Date | number | undefined | null): string {
    if (!dateInput) return 'N/A';
    try {
      // Handle potential number (timestamp) or Date object inputs
      const date = new Date(dateInput);
      // Check if the date is valid after parsing
      if (isNaN(date.getTime())) {
        return String(dateInput); // Return original if invalid date
      }
      // Use locale-specific format
      return date.toLocaleString(); 
    } catch (e) {
      console.warn(`Failed to format date:`, dateInput, e);
      // Fallback to original string if Date constructor fails
      return String(dateInput); 
    }
  }
  
  // --- Event Handlers ---

  // Emits the close event when the close button is clicked
  onClose(): void {
    this.close.emit();
  }
  
  // --- Title Generation ---

  // Generates the main title for the details view
  getTitle(): string {
    // Use explicit title if provided
    if (this.title && this.title !== 'Resource Details') {
      return this.title;
    }
    
    // Generate title based on resource type and a primary identifier
    const identifier = this.getResourceIdentifier();
    const typeName = this.formatResourceTypeName();
    
    return identifier ? `${typeName} Details: ${identifier}` : `${typeName} Details`;
  }
  
  // Finds a common identifier property in the resource data
  private getResourceIdentifier(): string {
    if (!this.resource) return '';
    
    // Check common identifier keys in a specific order
    const identifierKeys = [
      'instanceId', 'bucketName', 'volumeId', 'dbInstanceId', 
      'snapshotId', 'imageId', 'name', 'id', 'arn' 
    ];
    
    for (const key of identifierKeys) {
      if (this.resource[key]) {
        return String(this.resource[key]);
      }
    }
    
    // Fallback if no common identifier is found
    return ''; 
  }
  
  // Formats the resource type string into a user-friendly name
  private formatResourceTypeName(): string {
    // Handle known types
    switch (this.resourceType) {
      case 'EC2Instance': return 'EC2 Instance';
      case 'S3Bucket': return 'S3 Bucket';
      case 'EBSVolume': return 'EBS Volume';
      case 'RDSInstance': return 'RDS Instance';
      case 'EBSSnapshot': return 'EBS Snapshot';
      case 'AMISnapshot': return 'AMI Snapshot'; // Assuming this type name
      // Add more specific types as needed
    }
    
    // Generic fallback: Add space before capital letters if resourceType is camelCase
    if (this.resourceType) {
        const formatted = this.resourceType.replace(/([A-Z])/g, ' $1').trim();
        return formatted || 'Resource'; // Ensure it doesn't return empty string
    }
    
    return 'Resource'; // Default if resourceType is empty
  }
}
