// src/app/features/resources-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home (All Resources)
  {
    path: '',
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
  {
    path: 'load-balancers',
    loadComponent: () =>
      import('./components/load-balancers/load-balancers.component')
        .then(m => m.LoadBalancersComponent)
  },
  {
    path: 'security-groups',
    loadComponent: () =>
      import('./components/security-groups/security-groups.component')
        .then(m => m.SecurityGroupsComponent)
  },
  // Storage
  {
    path: 's3',
    loadComponent: () =>
      import('./components/s3-buckets/s3-buckets.component')
        .then(m => m.S3BucketsComponent)
  },
  {
    path: 'efs',
    loadComponent: () =>
      import('./components/efs/efs.component')
        .then(m => m.EFSFileSystemsComponent)
  },
  {
    path: 'fsx',
    loadComponent: () =>
      import('./components/fsx/fsx.component')
    .then(m => m.FSXFileSystemsComponent)
  },  
  {
    path: 'backup-plans',
    loadComponent: () =>
      import('./components/backup-plans/backup-plans.component')
        .then(m => m.BackupPlansComponent)
  },
  {
    path: 'backup-vaults',
    loadComponent: () =>
      import('./components/backup-vaults/backup-vaults.component')
    .then(m => m.BackupVaultsComponent)
  },
  {
    path: 'ebs-volumes',
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
  },

  // Networking
  {
    path: 'vpcs',
    loadComponent: () =>
      import('./components/vpcs/vpcs.component')
        .then(m => m.VPCsComponent)
  },
  {
    path: 'subnets',
    loadComponent: () =>
      import('./components/subnets/subnets.component')
        .then(m => m.SubnetsComponent)
  },
  {
    path: 'internet-gateways',
    loadComponent: () =>
      import('./components/internet-gateways/internet-gateways.component')
        .then(m => m.InternetGatewaysComponent)
  },
  {
    path: 'nat-gateways',
    loadComponent: () =>
      import('./components/nat-gateways/nat-gateways.component')
        .then(m => m.NatGatewaysComponent)
  },
  {
    path: 'route-tables',
    loadComponent: () =>
      import('./components/route-tables/route-tables.component')
        .then(m => m.RouteTablesComponent)
  },
  {
    path: 'vpn-gateways',
    loadComponent: () =>
      import('./components/vpn-gateways/vpn-gateways.component')
        .then(m => m.VpnGatewaysComponent)
  },
  {
    path: 'transit-gateways',
    loadComponent: () =>
      import('./components/transit-gateways/transit-gateways.component')
        .then(m => m.TransitGatewaysComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}
