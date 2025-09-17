// src/app/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Import standalone components
import { ResourceTableComponent } from './components/resource-table/resource-table.component';
import { ResourceTagsComponent } from './components/resource-tags/resource-tags.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ResourceTableComponent,
    ResourceTagsComponent
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ResourceTableComponent,
    ResourceTagsComponent
  ]
})
export class SharedModule { }