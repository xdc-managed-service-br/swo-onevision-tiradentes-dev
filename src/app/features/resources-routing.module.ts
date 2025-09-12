// src/app/features/resources/resources-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home da área
  { path: '', loadComponent: () => import('./components/resources/resources.component').then(m => m.ResourcesComponent) },

  // Compute
  { path: 'ec2',            loadComponent: () => import('./components/ec2-resources/ec2-resources.component').then(m => m.EC2ResourcesComponent) },
  { path: 'ami-snapshots',  loadComponent: () => import('./components/ami-snapshots/ami-snapshots.component').then(m => m.AMISnapshotsComponent) },

  // Storage
  { path: 'ebs',            loadComponent: () => import('./components/ebs-resources/ebs-resources.component').then(m => m.EbsResourcesComponent) },
  { path: 'ebs-snapshots',  loadComponent: () => import('./components/ebs-snapshots/ebs-snapshots.component').then(m => m.EbsSnapshotsComponent) },

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}
