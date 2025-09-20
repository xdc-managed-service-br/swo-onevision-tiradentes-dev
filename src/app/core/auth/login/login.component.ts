// src/app/core/auth/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { 
  signIn, 
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  getCurrentUser  // Add this import
} from 'aws-amplify/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  forgotPasswordMode: boolean = false;
  resetEmail: string = '';
  resetSuccess: boolean = false;
  resetErrorMessage: string = '';
  resetCode: string = '';
  resetConfirmMode: boolean = false;

  // Add new properties for new password challenge
  newPasswordChallengeMode: boolean = false;
  newPassword: string = '';
  confirmNewPassword: string = '';
  challengeUser: any = null; // Will store the user object during challenge

  constructor(private router: Router, private route: ActivatedRoute) {}
  
  async ngOnInit(): Promise<void> {
    // FIRST: Check if user is already authenticated
    await this.checkExistingAuth();
    
    // Then check for success message from password reset
    this.route.queryParams.subscribe(params => {
      if (params['resetSuccess'] === 'true') {
        this.errorMessage = ''; // Clear any existing error messages
        alert('Password reset successful. Please log in with your new password.');
      }
    });
  }

  // NEW METHOD: Check if user is already authenticated
  private async checkExistingAuth(): Promise<void> {
    try {
      await getCurrentUser();
      // User is authenticated, redirect to dashboard
      console.log('User already authenticated, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    } catch (error) {
      // User is not authenticated, stay on login page
      console.log('User not authenticated, showing login form');
    }
  }

  // Show the reset confirmation form
  showResetConfirmMode(): void {
    this.resetConfirmMode = true;
    this.resetErrorMessage = '';
  }

  async handleResetConfirm(): Promise<void> {
    if (!this.resetCode) {
      this.resetErrorMessage = 'Verification code is required';
      return;
    }
  
    if (!this.newPassword) {
      this.resetErrorMessage = 'New password is required';
      return;
    }
  
    if (this.newPassword !== this.confirmNewPassword) {
      this.resetErrorMessage = 'Passwords do not match';
      return;
    }
  
    this.isLoading = true;
    this.resetErrorMessage = '';
  
    try {
      // Call Amplify's confirmResetPassword function
      await confirmResetPassword({
        username: this.resetEmail,
        confirmationCode: this.resetCode,
        newPassword: this.newPassword
      });
      
      // Password reset successful
      this.forgotPasswordMode = false;
      this.resetConfirmMode = false;
      this.resetSuccess = false;
      this.resetEmail = '';
      this.resetCode = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      
      // Show success message before redirecting to login
      alert('Password reset successful. Please log in with your new password.');
    } catch (error: any) {
      console.error('Error confirming password reset:', error);
      
      if (error.name === 'CodeMismatchException') {
        this.resetErrorMessage = 'Invalid verification code. Please try again';
      } else if (error.name === 'InvalidPasswordException') {
        this.resetErrorMessage = 'Password does not meet the requirements';
      } else if (error.name === 'ExpiredCodeException') {
        this.resetErrorMessage = 'Verification code has expired. Please request a new one';
      } else {
        this.resetErrorMessage = 'Error resetting password. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleSignIn(): Promise<void> {
    if (!this.username || !this.password) {
      this.errorMessage = 'Username and password are required';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const signInOutput = await signIn({
        username: this.username,
        password: this.password
      });

      // Check if user is fully signed in
      if (signInOutput.isSignedIn) {
        // After successful login, redirect to dashboard
        this.router.navigate(['/dashboard']); // Use router instead of window.location
      } 
      // Check if there's a challenge to complete (like NEW_PASSWORD_REQUIRED)
      else if (signInOutput.nextStep && signInOutput.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        this.newPasswordChallengeMode = true;
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      if (error.name === 'UserNotConfirmedException') {
        this.errorMessage = 'Please confirm your account before signing in';
      } else if (error.name === 'NotAuthorizedException') {
        this.errorMessage = 'Incorrect username or password';
      } else if (error.name === 'UserNotFoundException') {
        this.errorMessage = 'User does not exist';
      } else {
        this.errorMessage = 'An error occurred during sign in. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleNewPasswordChallenge(): Promise<void> {
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

    try {
      // Complete the sign-in process with the new password
      const confirmSignInOutput = await confirmSignIn({
        challengeResponse: this.newPassword
      });

      if (confirmSignInOutput.isSignedIn) {
        // User is now signed in with the new password
        this.router.navigate(['/dashboard']); // Use router instead of window.location
      } else {
        // Handle any additional steps if needed
        this.errorMessage = 'Additional steps required to complete sign-in';
      }
    } catch (error: any) {
      console.error('Error completing new password challenge:', error);
      
      if (error.name === 'InvalidPasswordException') {
        this.errorMessage = 'Password does not meet the requirements: ' + error.message;
      } else {
        this.errorMessage = 'An error occurred while setting your new password. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  toggleForgotPassword(): void {
    this.forgotPasswordMode = !this.forgotPasswordMode;
    this.resetConfirmMode = false;
    this.resetEmail = '';
    this.resetCode = '';
    this.resetErrorMessage = '';
    this.resetSuccess = false;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.newPasswordChallengeMode = false;
  }

  // Cancel the new password challenge and go back to login
  cancelNewPasswordChallenge(): void {
    this.newPasswordChallengeMode = false;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.errorMessage = '';
    this.challengeUser = null;
  }

  async handleForgotPassword(): Promise<void> {
    if (!this.resetEmail) {
      this.resetErrorMessage = 'Email is required';
      return;
    }

    this.isLoading = true;
    this.resetErrorMessage = '';

    try {
      // First attempt to reset password and verify the email exists in Cognito
      try {
        // Call Amplify's resetPassword function with the email
        const resetResponse = await resetPassword({ username: this.resetEmail });
        
        // Check if we received a delivery details response which confirms the user exists
        if (resetResponse.nextStep && 
            resetResponse.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          // User exists and code was sent
          this.resetSuccess = true;
        } else {
          // This shouldn't happen, but as a fallback
          this.resetErrorMessage = 'Error sending verification code. Please try again.';
        }
      } catch (error: any) {
        console.error('Error requesting password reset:', error);

        // Check specifically for UserNotFoundException
        if (error.name === 'UserNotFoundException') {
          this.resetErrorMessage = 'This email is not registered. Please contact OneVision Administrator for access.';
        } else if (error.name === 'InvalidParameterException') {
          this.resetErrorMessage = 'Please provide a valid email address';
        } else if (error.name === 'LimitExceededException') {
          this.resetErrorMessage = 'Too many attempts. Please try again later';
        } else {
          this.resetErrorMessage = 'Error requesting password reset. Please try again.';
        }
      }
    } catch (error: any) {
      console.error('Unexpected error during reset flow:', error);
      this.resetErrorMessage = 'An unexpected error occurred. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}