// src/app/shared/components/resource-tags/resource-tags.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagFormatter } from '../../utils/tag-formatter';

@Component({
  selector: 'app-resource-tags',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tags-container">
      <ng-container *ngIf="!isEmptyTags(); else noTagsMessage">
        <div class="tag" *ngFor="let tag of parsedTagsArray">
          <span class="tag-key">{{ tag.key }}</span>
          <span class="tag-value">{{ tag.value }}</span>
        </div>
      </ng-container>
      <ng-template #noTagsMessage>
        <div class="no-tags-message">No tags available for this resource</div>
      </ng-template>
    </div>
  `,
  styles: [`
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      max-width: 100%;
      overflow-x: auto;
    }

    .tag {
      display: flex;
      background-color: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      font-size: 0.85rem;
      border: 1px solid #ddd;
      max-width: 100%;
    }

    .tag-key {
      background-color: #e0e0e0;
      padding: 6px 10px;
      font-weight: bold;
      color: #555;
      border-right: 1px solid #ddd;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .tag-value {
      padding: 6px 10px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    .no-tags-message {
      color: #888;
      font-style: italic;
      padding: 5px;
      background-color: #f8f8f8;
      border-radius: 4px;
      border: 1px dashed #ddd;
      width: 100%;
      text-align: center;
    }

    /* For mobile */
    @media (max-width: 768px) {
      .tags-container {
        flex-direction: column;
      }
      
      .tag {
        width: 100%;
      }
      
      .tag-key, .tag-value {
        max-width: none;
      }
    }
  `]
})
export class ResourceTagsComponent implements OnChanges {
  @Input() tags: any;
  
  parsedTagsArray: {key: string, value: string}[] = [];

  ngOnChanges() {
    this.parseTags();
  }

  parseTags() {
    try {
      // Log the raw tags for debugging
      console.log('Raw tags input:', this.tags);
      
      // Special handling for AWS format as a string
      if (typeof this.tags === 'string' && this.tags.includes('[{')) {
        console.log('Detected AWS JSON tag format');
        
        try {
          // Try to clean up any escaped characters
          let cleanedTags = this.tags;
          if (cleanedTags.startsWith('"') && cleanedTags.endsWith('"')) {
            // Handle double-quoted JSON strings (might be escaped JSON)
            cleanedTags = JSON.parse(cleanedTags);
          }
          
          // Parse the tags using our formatter
          const parsedTags = TagFormatter.parseTags(cleanedTags);
          console.log('Parsed tags result:', parsedTags);
          
          // Convert to array format for display
          this.parsedTagsArray = Object.entries(parsedTags).map(([key, value]) => ({
            key,
            value: String(value)
          }));
        } catch (err) {
          console.error('Error cleaning/parsing AWS format tags:', err);
          
          // Fallback regex extraction for AWS format tags
          const awsRegex = /\{\s*"Key"\s*:\s*"([^"]+)"\s*,\s*"Value"\s*:\s*"([^"]*)"\s*\}/g;
          let match;
          this.parsedTagsArray = [];
          
          // Extract directly with regex as a last resort
          while ((match = awsRegex.exec(this.tags)) !== null) {
            this.parsedTagsArray.push({
              key: match[1],
              value: match[2]
            });
          }
        }
      } else {
        // Standard parsing for other formats
        const parsedTags = TagFormatter.parseTags(this.tags);
        this.parsedTagsArray = Object.entries(parsedTags).map(([key, value]) => ({
          key,
          value: String(value)
        }));
      }
      
      console.log('Final parsed tags array:', this.parsedTagsArray);
    } catch (error) {
      console.error('Error parsing tags in component:', error);
      this.parsedTagsArray = [];
    }
  }

  isEmptyTags(): boolean {
    return !this.parsedTagsArray || this.parsedTagsArray.length === 0;
  }
}