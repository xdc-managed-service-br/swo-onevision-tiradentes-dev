// src/app/services/state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StateService<T> {
  private state = new BehaviorSubject<T[]>([]);
  
  setState(newState: T[]): void {
    this.state.next(newState);
  }
  
  getState(): Observable<T[]> {
    return this.state.asObservable();
  }
  
  updateItem(id: string, updatedItem: Partial<T>): void {
    const currentState = this.state.getValue();
    const index = currentState.findIndex((item: any) => item.id === id);
    
    if (index !== -1) {
      const newState = [...currentState];
      newState[index] = { ...newState[index], ...updatedItem };
      this.state.next(newState);
    }
  }
}