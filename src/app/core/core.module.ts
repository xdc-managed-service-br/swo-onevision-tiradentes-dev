// src/app/core/core.module.ts
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Remove LoginComponent and ResetPasswordComponent from here - they are standalone

@NgModule({
  declarations: [
    // Remove LoginComponent and ResetPasswordComponent from declarations
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    // Import standalone components instead
  ],
  providers: [
    // Add interceptors when created
    // { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  exports: [
    // Remove from exports as well
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only');
    }
  }
}