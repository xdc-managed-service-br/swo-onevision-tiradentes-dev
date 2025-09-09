import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '.../../../amplify/data/resource';

const client = generateClient<Schema>();

@Component({
  selector: 'app-resource-analyzer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-analyzer.component.html',
  styleUrl: './resource-analyzer.component.css',
})
export class ResourceAnalyzerComponent implements OnInit {
  loading = true;
  resourceData: any[] = [];
  resourceTypes: string[] = [];
  resourceCounts: Record<string, number> = {};
  totalCount = 0;
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    this.fetchResources();
  }

  async fetchResources(): Promise<void> {
    try {
      // Implement pagination to get all resources
      const allResources = await this.loadAllResources();
      
      // Calculate resource type distribution
      const typeDistribution: Record<string, number> = {};
      allResources.forEach(resource => {
        const type = resource.resourceType;
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
      });
      
      // Sort resource types by count
      const sortedTypes = Object.keys(typeDistribution).sort(
        (a, b) => typeDistribution[b] - typeDistribution[a]
      );
      
      this.resourceData = allResources;
      this.resourceTypes = sortedTypes;
      this.resourceCounts = typeDistribution;
      this.totalCount = allResources.length;
      this.loading = false;
    } catch (err) {
      console.error('Error fetching resources:', err);
      this.error = 'Failed to fetch resources. Please try again.';
      this.loading = false;
    }
  }

  async loadAllResources(): Promise<any[]> {
    let nextToken: string | null | undefined;
    let allResources: any[] = [];
    
    do {
      // Let TypeScript infer the type instead of specifying it incorrectly
      const response = await client.models.AWSResource.list({ 
        limit: 1000,
        nextToken: nextToken 
      });
      
      allResources = [...allResources, ...response.data];
      nextToken = response.nextToken;
    } while (nextToken);
    
    return allResources;
  }
}