// src/app/shared/components/loading-spinner/loading-spinner.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true, // Make it standalone
  imports: [CommonModule], // Add necessary imports
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['../../styles/onevision-base.css']
})
export class LoadingSpinnerComponent {
  @Input() message: string = 'Loading...';
  @Input() overlay: boolean = false;
}