// src/app/core/services/export.service.ts
import { Injectable } from '@angular/core';
import { ErrorService } from './error.service';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  transform?: (item: any) => any;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  constructor(private errorService: ErrorService) {}
  /**
   * Exporta dados para um arquivo XLSX (Excel)
   */
  exportDataToXLSX(data: any[], columns: ExportColumn[], filename: string): void {
    if (!data || !data.length) {
      this.errorService.handleError({
        message: 'No data to export'
      });
      return;
    }
    

    try {
      const mappedData = data.map(item => {
        const row: { [key: string]: any } = {};
        columns.forEach(column => {
          const value = column.transform ? column.transform(item) : item[column.key];
          row[column.label] = value ?? '';
        });
        return row;
      });

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(mappedData);
      const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
      XLSX.writeFile(workbook, filename || 'export.xlsx');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errorService.handleError({
        message: `Error exporting data to XLSX: ${errorMessage}`,
        details: error
      });
    }
  }

  /**
   * Export data to CSV with specified columns
   * @param data Array of objects to export
   * @param columns Columns to export (including key, label, and optional transform function)
   * @param filename Filename for the CSV file
   */
  exportDataToCSV(data: any[], columns: ExportColumn[], filename: string): void {
    if (!data || !data.length) {
      this.errorService.handleError({
        message: 'No data to export'
      });
      return;
    }
    
    try {
      // Use column labels as headers
      const headers = columns.map(col => col.label);
      
      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      // Add data rows
      data.forEach(item => {
        const row = columns.map(column => {
          // Get value using transform function if provided
          let value = column.transform ? column.transform(item) : item[column.key];
          
          if (value === undefined || value === null) return '';
          
          // Handle special formatting for certain types
          if (typeof value === 'boolean') return value ? 'Yes' : 'No';
          
          // Escape values if needed
          if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          
          return String(value);
        });
        
        csvContent += row.join(',') + '\n';
      });
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename || 'export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errorService.handleError({
        message: `Error exporting data: ${errorMessage}`,
        details: error
      });
    }
  }

  
}