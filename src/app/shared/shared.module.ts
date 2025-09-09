// src/app/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Import standalone components
import { ResourceTableComponent } from './components/resource-table/resource-table.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { ResourceTagsComponent } from './components/resource-tags/resource-tags.component';

@NgModule({
  declarations: [
    // No non-standalone components to declare
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    // Import standalone components
    ResourceTableComponent,
    ErrorBannerComponent,
    LoadingSpinnerComponent,
    ResourceTagsComponent
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    // Export the standalone components
    ResourceTableComponent,
    ErrorBannerComponent,
    LoadingSpinnerComponent,
    ResourceTagsComponent
  ]
})
export class SharedModule { }