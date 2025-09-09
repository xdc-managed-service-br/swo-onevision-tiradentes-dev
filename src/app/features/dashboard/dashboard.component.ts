// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ResourceHealthComponent } from './resource-health/resource-health.component';
import { SharedModule } from '../../shared/shared.module';
import { InstanceStatusWidgetComponent } from './instance-status-widget/instance-status-widget.component';
import { MonitoringWidgetComponent } from './monitoring-widget/monitoring-widget.component';

type RecentResource = {
  resourceType: string;
  region: string;
  lastUpdated: string | Date;
  instanceId?: string;
  instanceName?: string;
  imageId?: string;
  imageName?: string;
  bucketName?: string;
  volumeId?: string;
  [k: string]: any;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ResourceHealthComponent,
    InstanceStatusWidgetComponent,
    MonitoringWidgetComponent,
    SharedModule, // mantém widgets/app-* se forem exportados aqui
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  loading = true;

  // Resumo
  resourceCounts = {
    total: 0,
    ec2: 0,
    rds: 0,
    s3: 0,
    ebs: 0,
    ebsSnapshots: 0,
    amiSnapshots: 0,
  };

  // Monitoring/Status
  monitoringStatus = { monitoredPercentage: 0 };
  instanceStatus = { total: 0, running: 0, stopped: 0 };
  ssmStatus = { connectedPercentage: 0 };

  // Distribuição
  accountDistribution: { account: string; count: number }[] = [];
  regionDistribution: { region: string; count: number }[] = [];

  // Recentes
  recentResources: RecentResource[] = [];

  ngOnInit(): void {
    // Aqui você mantém a sua lógica original que popula os dados.
    this.loading = false;
  }

  /** Largura percentual do gráfico de barras por maior valor encontrado */
  getBarWidth(count: number): number {
    const max = Math.max(
      ...[...this.accountDistribution, ...this.regionDistribution].map(
        (i) => i.count || 0
      ),
      1
    );
    return Math.round((count / max) * 100);
  }

  /** Identificador amigável por tipo de recurso */
  getResourceIdentifier(resource: RecentResource): string {
    if (resource.instanceName) return resource.instanceName;
    if (resource.instanceId) return resource.instanceId;
    if (resource.imageName) return resource.imageName;
    if (resource.imageId) return resource.imageId;
    if (resource.bucketName) return resource.bucketName;
    if (resource.volumeId) return resource.volumeId;
    return 'Unnamed';
  }
}