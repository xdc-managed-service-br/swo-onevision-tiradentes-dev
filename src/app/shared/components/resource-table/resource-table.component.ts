// src/app/shared/components/resource-table/resource-table.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-resource-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.css']
})
export class ResourceTableComponent {
  @Input() data: any[] = [];
  @Input() columns: {key: string, label: string, type?: string}[] = [];
  @Input() sortColumn: string = '';
  @Input() sortDirection: 'asc' | 'desc' = 'asc';
  @Input() showActions: boolean = true;
  
  @Output() sort = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<any>();
  @Output() exportData = new EventEmitter<void>();
  
  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  }
  /** Valor seguro da célula, evita (row as any)[col.key] no template */
  getCell(row: any, key: string): any {
    if (!row || !key) return '';
    const v = (row as any)[key];
    return v === undefined || v === null ? '' : v;
  }
  getStatusClass(status: string): string {
    if (!status) return '';
    
    status = status.toLowerCase();
    if (['running', 'available', 'active'].includes(status)) return 'status-active';
    if (['stopped', 'stopping'].includes(status)) return 'status-inactive';
    if (['pending', 'provisioning'].includes(status)) return 'status-pending';
    if (['terminated', 'deleted'].includes(status)) return 'status-terminated';
    
    return 'status-unknown';
  }
}