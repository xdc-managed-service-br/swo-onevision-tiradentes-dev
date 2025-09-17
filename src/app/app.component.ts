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
  styleUrls: ['./shared/styles/onevision-base.css', './app.component.css'],
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
  private sessionTimeoutId: any;
  private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000;

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
        this.checkAuthState().then(() => {
          console.log('Auth state checked after navigation');
        }).catch((error) => {
          console.error('Error checking auth state after navigation:', error);
        });
      });
    
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
    root.setAttribute('data-theme', t);

    root.classList.remove(
      'theme-light','theme-dark',
      'theme-Light','theme-Dark','theme-LIGHT','theme-DARK'
    );
    root.classList.add(`theme-${t}`);
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
    localStorage.setItem('ov-theme', next); 
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

    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
    else {
      this.isSidebarOpen = true;
    }
  }
  
  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
  
  closeSidebarOnMobile() {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }
  
  async checkAuthState() {
    try {

      const user = await getCurrentUser();

      this.isAuthenticated = true;

      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/reset-password') {
        console.log('Authenticated user on login page, redirecting to dashboard');
        this.router.navigate(['/dashboard']);
        return;
      }

      try {
        const attributes = await fetchUserAttributes();

        if (attributes.email) {
          this.username = this.formatNameFromEmail(attributes.email);
        } else {
          this.username = user.username;
        }
      } catch (attributeError) {
        console.error('Error fetching user attributes:', attributeError);
        this.username = user.username;
      }

      this.resetSessionTimeout();
      console.log('Authentication state updated: authenticated =', this.isAuthenticated);
      
    } catch (error) {

      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/reset-password')) {
        console.log('User not authenticated, redirecting to login');
        this.router.navigate(['/login']);
      }
      
      console.log('Authentication state updated: authenticated =', this.isAuthenticated);
    }
  }

  private setupSessionTimeout(): void {
    if (this.isAuthenticated) {
      this.resetSessionTimeout();
    }
  }

  private resetSessionTimeout(): void {
    this.clearSessionTimeout();
    
    this.sessionTimeoutId = setTimeout(async () => {
      console.log('Session timeout reached, signing out user');
      await this.handleSessionTimeout();
    }, this.SESSION_TIMEOUT_MS);
  }

  private clearSessionTimeout(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
  }
  
  private async handleSessionTimeout(): Promise<void> {
    try {
      await signOut();
      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      alert('Your session has expired. Please log in again.');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during session timeout signout:', error);
      window.location.href = '/login';
    }
  }
  
  formatNameFromEmail(email: string): string {
    try {

      const localPart = email.split('@')[0];
      const nameParts = localPart.split(/[._]/).map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      
      return nameParts.join(' ');
    } catch (error) {
      console.error('Error formatting name from email:', error);
      return email;
    }
  }
  
  async handleSignOut(): Promise<void> {
    try {
      await signOut();
      this.isAuthenticated = false;
      this.username = '';
      this.clearSessionTimeout();
      this.router.navigate(['/login']);
    } catch (error: unknown) {
      console.error('Error during sign out:', error);
      window.location.href = '/login';
    }
  }
}