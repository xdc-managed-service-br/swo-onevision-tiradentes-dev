// src/app/features/resources/resources-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home
  { path: '', loadComponent: () => import('./components/resources/all-rresources.component').then(m => m.ResourcesComponent) },
  // Dashboard
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  // Compute
  { path: 'ec2',            loadComponent: () => import('./components/ec2-resources/ec2-instances.component').then(m => m.EC2InstancesComponent) },
  { path: 'ami-snapshots',  loadComponent: () => import('./components/ami-snapshots/ami-snapshots.component').then(m => m.AMISnapshotsComponent) },

  // Storage

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}
