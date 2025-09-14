// src/app/app.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Amplify } from 'aws-amplify';
import { signOut, getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import outputs from '../../amplify_outputs.json';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./shared/styles/onevision-base.css'],
  imports: [
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    CommonModule
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'OneVision';
  isAuthenticated = false;
  username = '';
  isSidebarOpen = true;
  isMobile = false;
  theme: 'light' | 'dark' = 'dark';
  private themeSource: 'system' | 'user' = 'system';
  private mql?: MediaQueryList;
  // Session timeout properties
  private sessionTimeoutId: any;
  private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds
  
  // For cleanup
  private destroy$ = new Subject<void>();
  
  constructor(private router: Router) {
    Amplify.configure(outputs);
  }
  
  ngOnInit() {
    Amplify.configure(outputs);
    this.initTheme(); 
    this.checkAuthState();
    this.checkScreenSize();
    this.setupSessionTimeout();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        // Handle async checkAuthState without async keyword
        this.checkAuthState().then(() => {
          console.log('Auth state checked after navigation');
        }).catch((error) => {
          console.error('Error checking auth state after navigation:', error);
        });
      });
    
    // Detect initial layout changes
    setTimeout(() => {
      this.checkScreenSize();
    }, 100);
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (this.themeSource === 'system') {
      this.applyTheme(e.matches ? 'light' : 'dark');
    }
  };

  private applyTheme(theme: 'light' | 'dark'): void {
    const t = (theme || 'dark').toLowerCase() as 'light' | 'dark';
    this.theme = t;

    const root = document.documentElement;
    root.setAttribute('data-theme', t);          // <- "light" ou "dark"

    // remove variações antigas
    root.classList.remove(
      'theme-light','theme-dark',
      'theme-Light','theme-Dark','theme-LIGHT','theme-DARK'
    );
    root.classList.add(`theme-${t}`);            // <- "theme-light" ou "theme-dark"
  }

  private initTheme(): void {
    const saved = (localStorage.getItem('ov-theme') || '').toLowerCase() as 'light' | 'dark' | '';
    const savedSource = (localStorage.getItem('ov-theme-source') || 'system') as 'system' | 'user';
    this.themeSource = savedSource;

    this.mql = window.matchMedia('(prefers-color-scheme: light)');

    if (this.themeSource === 'user' && (saved === 'light' || saved === 'dark')) {
      this.applyTheme(saved);
    } else {
      this.applyTheme(this.mql.matches ? 'light' : 'dark');
    }

    this.mql.addEventListener('change', this.handleSystemThemeChange);
  }

  toggleTheme(): void {
    this.themeSource = 'user';
    const next = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
    localStorage.setItem('ov-theme', next);          // sempre minúsculo
    localStorage.setItem('ov-theme-source', 'user');
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.mql?.removeEventListener('change', this.handleSystemThemeChange);
  }
  
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }
  
  // NEW: Reset session timeout on user activity
  @HostListener('window:click')
  @HostListener('window:keypress')
  @HostListener('window:mousemove')
  onUserActivity() {
    if (this.isAuthenticated) {
      this.resetSessionTimeout();
    }
  }
  
  checkScreenSize() {
    this.isMobile = window.innerWidth <= 768;
    
    // Em mobile, a sidebar começa fechada
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
    // Em desktop, a sidebar começa aberta
    else {
      this.isSidebarOpen = true;
    }
  }
  
  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
  
  // Fecha a sidebar ao clicar em um link no mobile
  closeSidebarOnMobile() {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }
  
  // UPDATED: Better authentication state checking
  async checkAuthState() {
    try {
      // First verify the user is authenticated
      const user = await getCurrentUser();
      
      // Set authenticated state immediately
      this.isAuthenticated = true;
      
      // Check if user is on login page while authenticated
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/reset-password') {
        console.log('Authenticated user on login page, redirecting to dashboard');
        this.router.navigate(['/dashboard']);
        return;
      }
      
      // Fetch the user attributes to get the email
      try {
        const attributes = await fetchUserAttributes();
        
        // Format the email into a display name
        if (attributes.email) {
          this.username = this.formatNameFromEmail(attributes.email);
        } else {
          // Fallback in case email isn't available for some reason
          this.username = user.username;
        }
      } catch (attributeError) {
        // If there's an error fetching attributes, fall back to username
        console.error('Error fetching user attributes:', attributeError);
        this.username = user.username;
      }
      
      // Setup session timeout for authenticated users
      this.resetSessionTimeout();
      
      console.log('Authentication state updated: authenticated =', this.isAuthenticated);
      
    } catch (error) {
      // User is not authenticated
      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      
      // Only redirect to login if not already on login/reset-password pages
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/reset-password')) {
        console.log('User not authenticated, redirecting to login');
        this.router.navigate(['/login']);
      }
      
      console.log('Authentication state updated: authenticated =', this.isAuthenticated);
    }
  }
  
  // NEW: Setup session timeout
  private setupSessionTimeout(): void {
    if (this.isAuthenticated) {
      this.resetSessionTimeout();
    }
  }
  
  // NEW: Reset the session timeout
  private resetSessionTimeout(): void {
    this.clearSessionTimeout();
    
    this.sessionTimeoutId = setTimeout(async () => {
      console.log('Session timeout reached, signing out user');
      await this.handleSessionTimeout();
    }, this.SESSION_TIMEOUT_MS);
  }
  
  // NEW: Clear session timeout
  private clearSessionTimeout(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
  }
  
  // NEW: Handle session timeout
  private async handleSessionTimeout(): Promise<void> {
    try {
      await signOut();
      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      
      // Show timeout message and redirect
      alert('Your session has expired. Please log in again.');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during session timeout signout:', error);
      // Force reload if signout fails
      window.location.href = '/login';
    }
  }
  
  /**
   * Formats a display name from an email address
   * Example: "renan.bueno@softwareone.com" becomes "Renan Bueno"
   */
  formatNameFromEmail(email: string): string {
    try {
      // Extract the part before the @ symbol
      const localPart = email.split('@')[0];
      
      // Split by both dots and underscores and capitalize each part
      const nameParts = localPart.split(/[._]/).map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      
      // Join with spaces
      return nameParts.join(' ');
    } catch (error) {
      console.error('Error formatting name from email:', error);
      return email; // Return the original email if there's an error
    }
  }
  
  async handleSignOut(): Promise<void> {
    try {
      await signOut();
      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      
      // Redirect to login page
      this.router.navigate(['/login']);
    } catch (error: unknown) {
      console.error('Error during sign out:', error);
      // Force reload if signout fails
      window.location.href = '/login';
    }
  }
}