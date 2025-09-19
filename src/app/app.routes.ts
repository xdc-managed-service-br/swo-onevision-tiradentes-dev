// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './core/auth/login/login.component';
import { ResetPasswordComponent } from './core/auth/reset-password/reset-password.component';
import { AuthGuard } from './core/auth.guard';
import { LoginGuard } from './core/login.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [LoginGuard]
  },
  { 
    path: 'reset-password', 
    component: ResetPasswordComponent,
    canActivate: [LoginGuard]
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'resources', 
    loadChildren: () => import('./features/resources.module').then(m => m.ResourcesModule),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: 'dashboard' }
];