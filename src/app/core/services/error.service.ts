// src/app/core/services/error.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  private errorSubject = new Subject<AppError>();
  errors$ = this.errorSubject.asObservable();

  handleError(error: any) {
    const appError: AppError = {
      message: error.message || 'An unexpected error occurred',
      code: error.code,
      details: error
    };
    
    console.error('Application error:', appError);
    this.errorSubject.next(appError);
  }
  
  logError(error: any) {
    console.error('Application error (logged only):', error);
  }
  
  clearErrors() {
    this.errorSubject.next(undefined as any);
  }
}