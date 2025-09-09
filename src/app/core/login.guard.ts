// Create this file: src/app/core/login.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';

/**
 * Guard that prevents authenticated users from accessing login/register pages
 * Redirects them to dashboard if they're already authenticated
 */
export const LoginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  
  try {
    // Check if user is authenticated via Amplify
    await getCurrentUser();
    // If we get here, the user is authenticated - redirect to dashboard
    console.log('Authenticated user trying to access login page, redirecting to dashboard');
    router.navigate(['/dashboard']);
    return false; // Prevent access to login page
  } catch (error) {
    // User is not authenticated, allow access to login page
    console.log('Unauthenticated user accessing login page - allowed');
    return true;
  }
};