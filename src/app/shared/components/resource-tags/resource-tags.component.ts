// src/app/shared/components/resource-tags/resource-tags.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagFormatter } from '../../utils/tag-formatter';

@Component({
  selector: 'app-resource-tags',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-tags.component.html',
  styleUrls: ['../../../shared/styles/onevision-base.css' ]
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