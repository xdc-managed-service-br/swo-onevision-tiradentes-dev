// src/app/shared/components/error-banner/error-banner.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppError } from '../../../core/services/error.service';

@Component({
  selector: 'app-error-banner',
  standalone: true, // Make it standalone
  imports: [CommonModule], // Add CommonModule for *ngIf
  template: `
    <div *ngIf="error" class="error-banner">
      <div class="error-message">{{ error.message }}</div>
      <button (click)="close()" class="close-button">×</button>
    </div>
  `,
  styles: [
    `.error-banner {
      background-color: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }`,
    `.close-button {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #721c24;
    }`
  ]
})
export class ErrorBannerComponent {
  @Input() error: AppError | null = null;
  @Output() dismissed = new EventEmitter<void>();
  
  close() {
    this.dismissed.emit();
  }
}