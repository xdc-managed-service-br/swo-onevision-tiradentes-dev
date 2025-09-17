import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home (All Resources)
  {
    path: 'resources',
    loadComponent: () =>
      import('./components/resources/all-resources.component')
        .then(m => m.ResourcesComponent)
  },

  // Dashboard
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component')
        .then(m => m.DashboardComponent)
  },
  // Compute
  {
    path: 'ec2',
    loadComponent: () =>
      import('./components/ec2-instances/ec2-instances.component')
        .then(m => m.EC2InstancesComponent)
  },
  {
    path: 'ami-snapshots',
    loadComponent: () =>
      import('./components/ami-snapshots/ami-snapshots.component')
        .then(m => m.AMISnapshotsComponent)
  },

  // Storage
  {
    path: 's3',
    loadComponent: () =>
      import('./components/s3-buckets/s3-buckets.component')
        .then(m => m.S3BucketsComponent)
  },
 {
    path: 'ebs',
    loadComponent: () =>
      import('./components/ebs-volumes/ebs-volumes.component')
        .then(m => m.EBSVolumesComponent)
  },
  {
      path: 'ebs-snapshots',
      loadComponent: () =>
        import('./components/ebs-snapshots/ebs-snapshots.component')
          .then(m => m.EBSSnapshotsComponent)
  },
  // Databases
  {
    path: 'rds',
    loadComponent: () =>
      import('./components/rds-instances/rds-instances.component')
        .then(m => m.RDSInstancesComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}