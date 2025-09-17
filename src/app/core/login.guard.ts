// src/app/core/login.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';

export const LoginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  
  try {
    await getCurrentUser();
    console.log('Authenticated user trying to access login page, redirecting to dashboard');
    router.navigate(['/dashboard']);
    return false;
  } catch (error) {
    console.log('Unauthenticated user accessing login page - allowed');
    return true;
  }
};