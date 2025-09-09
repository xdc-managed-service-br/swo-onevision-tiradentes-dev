// src/app/shared/utils/format-utils.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormatUtils {
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // First try: Fix malformed dates with both timezone offset and Z
      let cleaned = dateString;
      
      // Fix dates with +00:00Z format by removing the Z
      if (cleaned.match(/\+\d{2}:\d{2}Z$/)) {
        cleaned = cleaned.replace('Z', '');
      }
      
      const date = new Date(cleaned);
      
      // Check if date is valid
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
      
      // Second try: Manual parsing for date strings with T format
      if (dateString.includes('T')) {
        const [datePart, timePart] = dateString.split('T');
        
        if (datePart && datePart.includes('-')) {
          const [year, month, day] = datePart.split('-').map(Number);
          
          // Try to extract hours, minutes, seconds
          if (timePart) {
            const timeMatch = timePart.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
              const [_, hours, minutes, seconds] = timeMatch;
              const manualDate = new Date(
                year, 
                month - 1, // months are 0-indexed
                day, 
                parseInt(hours), 
                parseInt(minutes), 
                parseInt(seconds)
              );
              return manualDate.toLocaleString();
            }
          }
          
          // If we only have the date part
          return new Date(year, month - 1, day).toLocaleDateString();
        }
      }
      
      // If all fails, return the original string
      return dateString;
      
    } catch (e) {
      console.error('Error formatting date:', e, dateString);
      return dateString;
    }
  }
  
  formatSize(size: number): string {
    if (size === undefined || size === null) return '';
    return `${size} GB`;
  }
  
  formatBoolean(value: boolean): string {
    if (value === undefined || value === null) return '';
    return value ? 'Yes' : 'No';
  }
  
  getStatusClass(status: string, type: 'instance' | 'storage' | 'database' = 'instance'): string {
    if (!status) return '';
    
    status = status.toLowerCase();
    
    switch (type) {
      case 'instance':
        if (status === 'running') return 'status-running';
        if (status === 'stopped') return 'status-stopped';
        if (status === 'pending') return 'status-pending';
        if (status === 'terminated') return 'status-terminated';
        break;
      case 'storage':
        if (status === 'available') return 'status-available';
        if (status === 'in-use') return 'status-in-use';
        break;
      case 'database':
        if (status === 'available') return 'status-available';
        if (status === 'stopped') return 'status-stopped';
        if (status === 'starting') return 'status-pending';
        break;
    }
    
    return 'status-unknown';
  }
}