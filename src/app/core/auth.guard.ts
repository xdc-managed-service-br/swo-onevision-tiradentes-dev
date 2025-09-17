// src/app/core/auth/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  
  try {
    await getCurrentUser();
    return true;
  } catch (error) {
    console.error('Auth guard: User not authenticated', error);
    router.navigate(['/login']);
    return false;
  }
};