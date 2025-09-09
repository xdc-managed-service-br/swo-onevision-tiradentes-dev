// src/app/shared/components/loading-spinner/loading-spinner.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true, // Make it standalone
  imports: [CommonModule], // Add necessary imports
  template: `
    <div class="loading-container" [class.overlay]="overlay">
      <div class="spinner"></div>
      <div *ngIf="message" class="message">{{ message }}</div>
    </div>
  `,
  styles: [
    `.loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }`,
    `.overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.7);
      z-index: 1000;
    }`,
    `.spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #6b45c7;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }`,
    `.message {
      margin-top: 15px;
      color: #666;
    }`,
    `@keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }`
  ]
})
export class LoadingSpinnerComponent {
  @Input() message: string = 'Loading...';
  @Input() overlay: boolean = false;
}