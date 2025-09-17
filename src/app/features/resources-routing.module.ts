import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home (All Resources)
  {
    path: '',
    loadComponent: () =>
      import('./components/resources/all-resources.component')  // << era ./components/...
        .then(m => m.ResourcesComponent)
  },

  // Dashboard da feature (se existir)
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component')                // << ajuste relativo
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
      import('./components/s3-buckets/s3-buckets.component')  // << caminho correto
        .then(m => m.S3BucketsComponent)
  },
 {
    path: 'ebs',
    loadComponent: () =>
      import('./components/ebs-volumes/ebs-volumes.component')  // << caminho correto
        .then(m => m.EBSVolumesComponent)
  },
  {
      path: 'ebs-snapshots',
      loadComponent: () =>
        import('./components/ebs-snapshots/ebs-snapshots.component')  // << caminho correto
          .then(m => m.EBSSnapshotsComponent)
  },
  // Databases
  {
    path: 'rds',
    loadComponent: () =>
      import('./components/rds-resources/rds-instances.component')
        .then(m => m.RDSInstancesComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}