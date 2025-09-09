// src/app/core/auth/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  
  try {
    // Check if user is authenticated via Amplify
    await getCurrentUser();
    // If we get here, the user is authenticated
    return true;
  } catch (error) {
    // User is not authenticated, redirect to login
    console.error('Auth guard: User not authenticated', error);
    router.navigate(['/login']);
    return false;
  }
};