// src/app/core/services/collector.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CollectorService {
  private readonly apiUrl = 'https://b2xz1tfnk5.execute-api.sa-east-1.amazonaws.com/refresh';

  triggerCollector(): Observable<any> {
    return from(
      fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
    ).pipe(
      catchError(err => {
        console.error('[CollectorService] Error triggering collector:', err);
        return throwError(() => err);
      })
    );
  }
}