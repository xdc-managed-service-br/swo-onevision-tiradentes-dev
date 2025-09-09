// src/app/features/resources/resources-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // Home da área
  { path: '', loadComponent: () => import('./components/resources/resources.component').then(m => m.ResourcesComponent) },

  // Compute
  { path: 'ec2',            loadComponent: () => import('./components/ec2-resources/ec2-resources.component').then(m => m.Ec2ResourcesComponent) },
  { path: 'ami-snapshots',  loadComponent: () => import('./components/ami-snapshots/ami-snapshots.component').then(m => m.AmiSnapshotsComponent) },

  // Storage
  { path: 's3',             loadComponent: () => import('./components/s3-resources/s3-resources.component').then(m => m.S3ResourcesComponent) },
  { path: 'ebs',            loadComponent: () => import('./components/ebs-resources/ebs-resources.component').then(m => m.EbsResourcesComponent) },
  { path: 'ebs-snapshots',  loadComponent: () => import('./components/ebs-snapshots/ebs-snapshots.component').then(m => m.EbsSnapshotsComponent) },

  // Database
  { path: 'rds',            loadComponent: () => import('./components/rds-resources/rds-resources.component').then(m => m.RdsResourcesComponent) },

  // Networking
  { path: 'security-groups',   loadComponent: () => import('./components/security-groups/security-groups.component').then(m => m.SecurityGroupsComponent) },
  { path: 'vpcs',              loadComponent: () => import('./components/vpcs/vpcs.component').then(m => m.VpcsComponent) },
  { path: 'subnets',           loadComponent: () => import('./components/subnets/subnets.component').then(m => m.SubnetsComponent) },
  { path: 'internet-gateways', loadComponent: () => import('./components/internet-gateways/internet-gateways.component').then(m => m.InternetGatewaysComponent) },
  { path: 'nat-gateways',      loadComponent: () => import('./components/nat-gateways/nat-gateways.component').then(m => m.NatGatewaysComponent) },
  { path: 'load-balancers',    loadComponent: () => import('./components/load-balancers/load-balancers.component').then(m => m.LoadBalancersComponent) },
  { path: 'transit-gateways',  loadComponent: () => import('./components/transit-gateways/transit-gateways.component').then(m => m.TransitGatewaysComponent) },

  // Quando criar:
  // { path: 'route-tables',   loadComponent: () => import('./components/route-tables/route-tables.component').then(m => m.RouteTablesComponent) },
  // { path: 'vpn-gateways',   loadComponent: () => import('./components/vpn-gateways/vpn-gateways.component').then(m => m.VpnGatewaysComponent) },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResourcesRoutingModule {}
