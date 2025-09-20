// src/app/auth/reset-password/reset-password.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  // Current step in the reset process
  currentStep: 'request' | 'confirm' = 'request';
  
  // Form fields
  email: string = '';
  resetCode: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';
  
  // UI state
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    // Check if email was passed in the URL
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
      }
      
      // If code was passed, move to confirm step
      if (params['code']) {
        this.resetCode = params['code'];
        this.currentStep = 'confirm';
      }
    });
  }

  async requestResetCode(): Promise<void> {
    if (!this.email) {
      this.errorMessage = 'Email is required';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // Request password reset code
      const resetResponse = await resetPassword({ username: this.email });
      
      // Check if we received a delivery details response which confirms the user exists
      if (resetResponse.nextStep && 
          resetResponse.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        // User exists and code was sent
        this.successMessage = 'A verification code has been sent to your email. Please check your inbox.';
        this.currentStep = 'confirm';
      } else {
        // This shouldn't happen, but as a fallback
        this.errorMessage = 'Error sending verification code. Please try again.';
      }
    } catch (error: any) {
      console.error('Error requesting password reset:', error);

      // Check specifically for UserNotFoundException
      if (error.name === 'UserNotFoundException') {
        this.errorMessage = 'This email is not registered. Please contact OneVision Administrator for access.';
      } else if (error.name === 'InvalidParameterException') {
        this.errorMessage = 'Please provide a valid email address';
      } else if (error.name === 'LimitExceededException') {
        this.errorMessage = 'Too many attempts. Please try again later';
      } else {
        this.errorMessage = 'Error requesting password reset. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async confirmPasswordReset(): Promise<void> {
    // Validate form
    if (!this.resetCode) {
      this.errorMessage = 'Verification code is required';
      return;
    }
    
    if (!this.newPassword) {
      this.errorMessage = 'New password is required';
      return;
    }
    
    if (this.newPassword !== this.confirmNewPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    try {
      // Call Amplify's confirmResetPassword function
      await confirmResetPassword({
        username: this.email,
        confirmationCode: this.resetCode,
        newPassword: this.newPassword
      });
      
      // Password reset successful
      this.successMessage = 'Password reset successful. You will be redirected to login...';
      
      // Redirect to login after a brief delay
      setTimeout(() => {
        this.router.navigate(['/login'], { 
          queryParams: { resetSuccess: 'true' } 
        });
      }, 2000);
    } catch (error: any) {
      console.error('Error confirming password reset:', error);
      
      if (error.name === 'CodeMismatchException') {
        this.errorMessage = 'Invalid verification code. Please try again';
      } else if (error.name === 'InvalidPasswordException') {
        this.errorMessage = 'Password does not meet the requirements';
      } else if (error.name === 'ExpiredCodeException') {
        this.errorMessage = 'Verification code has expired. Please request a new one';
      } else {
        this.errorMessage = 'Error resetting password. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }
  
  // Go back to request step
  backToRequest(): void {
    this.currentStep = 'request';
    this.resetCode = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
  }
  
  // Navigate back to login
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}