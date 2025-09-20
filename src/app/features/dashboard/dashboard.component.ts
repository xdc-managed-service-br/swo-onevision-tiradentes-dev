// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MetricService } from '../../core/services/metric.service';
import { MetricProcessorService, ProcessedMetricData } from '../../core/services/metric-processor.service';

interface ResourceHealthState {
  total: number;
  healthy: number;
  unhealthy: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: `./dashboard.component.html`,
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isLoading = false;
  dashboardData: ProcessedMetricData | null = null;
  resourceTypes: { name: string; count: number }[] = [];
  accountMaxCount = 0;
  regionMaxCount = 0;
  resourceTypeMaxCount = 0;
  networkHealth = {
    directConnectConnections: this.createEmptyHealthState(),
    directConnectVirtualInterfaces: this.createEmptyHealthState(),
    vpnConnections: this.createEmptyHealthState(),
    transitGateways: this.createEmptyHealthState()
  };

  constructor(
    private metricService: MetricService,
    private metricProcessor: MetricProcessorService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData() {
    this.isLoading = true;
    this.accountMaxCount = 0;
    this.regionMaxCount = 0;
    
    this.metricService.getCurrentMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics) => {
          // Processa os dados para o dashboard
          this.dashboardData = this.metricProcessor.processMetricsForDashboard(metrics);
          
          // Extrai tipos de recursos
          this.extractResourceTypes();

          // Atualiza limites auxiliares
          this.updateMetricSummaryBounds();

          // Carrega dados de saúde adicionais para recursos de rede
          this.loadNetworkResourceHealth();

          this.isLoading = false;
        },
        error: (error) => {
          console.error('[Dashboard] Error loading metrics:', error);
          this.isLoading = false;
        }
      });
  }

  refreshData() {
    this.metricService.clearCache();
    this.loadDashboardData();
  }

  private extractResourceTypes() {
    if (!this.dashboardData?.resourceCounts) {
      this.resourceTypes = [];
      return;
    }

    this.resourceTypes = Array.from(this.dashboardData.resourceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter(type => type.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  private updateMetricSummaryBounds() {
    this.accountMaxCount = this.calculateMaxCount(this.dashboardData?.accountDistribution);
    this.regionMaxCount = this.calculateMaxCount(this.dashboardData?.regionDistribution);
    this.resourceTypeMaxCount = this.calculateMaxCount(this.resourceTypes);
  }

  private calculateMaxCount(items?: Array<{ count?: number }>): number {
    if (!items?.length) {
      return 0;
    }

    return items.reduce((max, item) => Math.max(max, item?.count ?? 0), 0);
  }

  getBarWidth(count: number, max: number): number {
    if (!max) {
      return 0;
    }

    return Math.round((count / max) * 100);
  }

  // Métodos auxiliares para o template
  getFormattedDate(date: Date | undefined): string {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number | undefined): string {
    if (!value) return '$0.00';
    return `$${value.toFixed(2)}`;
  }

  getPercentage(value: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  getAccountTotal(): number {
    if (!this.dashboardData?.accountDistribution) return 0;
    return this.dashboardData.accountDistribution.reduce((sum, acc) => sum + acc.count, 0);
  }

  getTopRegions() {
    if (!this.dashboardData?.regionDistribution) return [];
    return this.dashboardData.regionDistribution;
  }

  getResourceIcon(resourceType: string): string {
    const iconMap: { [key: string]: string } = {
      'VPC': 'fas fa-network-wired',
      'EC2 Instance': 'fas fa-server',
      'S3 Bucket': 'fas fa-database',
      'Security Group': 'fas fa-shield-alt',
      'Load Balancer': 'fas fa-balance-scale',
      'RDS Instance': 'fas fa-database',
      'Route Table': 'fas fa-route',
      'Subnet': 'fas fa-project-diagram',
      'Internet Gateway': 'fas fa-globe',
      'VPN Connection': 'fas fa-key',
      'Network ACL': 'fas fa-list',
      'Transit Gateway': 'fas fa-exchange-alt',
      'Direct Connect': 'fas fa-link',
      'EBS Volume': 'fas fa-hdd',
      'EBS Snapshot': 'fas fa-camera',
      'AMI': 'fas fa-compact-disc'
    };

    return iconMap[resourceType] || 'fas fa-cube';
  }

  getRelativeTime(date: Date | string): string {
    const now = new Date();
    const targetDate = new Date(date);
    const diff = now.getTime() - targetDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  get summaryTiles() {
    return [
      {
        label: 'Total Resources',
        value: this.formatNumber(this.dashboardData?.summary?.totalResources || 0),
        route: '/resources',
        ariaLabel: 'View all resources'
      },
      {
        label: 'EC2 Instances',
        value: this.formatNumber(this.getResourceCount('EC2Instance')),
        route: '/resources/ec2',
        ariaLabel: 'View EC2 instances'
      },
      {
        label: 'RDS Instances',
        value: this.formatNumber(this.getResourceCount('RDSInstance')),
        route: '/resources/rds',
        ariaLabel: 'View RDS instances'
      },
      {
        label: 'S3 Buckets',
        value: this.formatNumber(this.getResourceCount('S3Bucket')),
        route: '/resources/s3',
        ariaLabel: 'View S3 buckets'
      },
      {
        label: 'Transit Gateways',
        value: this.formatNumber(this.getResourceCount('TransitGateway')),
        route: '/resources/transit-gateways',
        ariaLabel: 'View Transit Gateways'
      },
      {
        label: 'EBS Volumes',
        value: this.formatNumber(this.getResourceCount('EBSVolume')),
        route: '/resources/ebs-volumes',
        ariaLabel: 'View EBS volumes'
      },
      {
        label: 'EBS Snapshots',
        value: this.formatNumber(this.getResourceCount('EBSSnapshot')),
        route: '/resources/ebs-snapshots',
        ariaLabel: 'View EBS snapshots'
      },
      {
        label: 'AMI Snapshots',
        value: this.formatNumber(this.getResourceCount('AMI')),
        route: '/resources/ami-snapshots',
        ariaLabel: 'View AMI snapshots'
      }
    ];
  }

  get resourceHealthCards() {
    const ec2Count = this.getResourceCount('EC2Instance');
    const ec2 = this.dashboardData?.ec2Health;
    const ec2Total = ec2?.total || ec2Count;
    const ec2Running = ec2?.running || 0;
    const ec2Stopped = ec2?.stopped || 0;
    const ec2Other = Math.max(ec2Total - ec2Running - ec2Stopped, 0);

    const directConnectHealth = this.networkHealth.directConnectConnections;
    const vifHealth = this.networkHealth.directConnectVirtualInterfaces;
    const vpnHealth = this.networkHealth.vpnConnections;
    const transitGatewayHealth = this.networkHealth.transitGateways;

    const cards = [
      {
        key: 'ec2',
        title: 'EC2 Instances',
        total: ec2Total,
        badge: ec2Total,
        segments: [
          { value: ec2Running, color: 'good' },
          { value: ec2Other, color: 'warn' },
          { value: ec2Stopped, color: 'critical' }
        ],
        status: ec2Total > 0 ? `${this.getPercentage(ec2Running, ec2Total)}% Running` : 'No data',
        description: ec2Total > 0 ? `${ec2Running} running / ${ec2Stopped} stopped` : 'RDS fleet overview'
      },
      {
        key: 'rds',
        title: 'RDS Instances',
        total: this.getResourceCount('RDSInstance'),
        badge: this.getResourceCount('RDSInstance'),
        segments: [
          { value: this.getResourceCount('RDSInstance'), color: 'good' }
        ],
        status: this.getResourceCount('RDSInstance') > 0 ? '100% Healthy' : 'No data',
        description: 'RDS fleet overview'
      },
      {
        key: 'ebs',
        title: 'EBS Volumes',
        total: this.getResourceCount('EBSVolume'),
        badge: this.getResourceCount('EBSVolume'),
        segments: [
          { value: this.getResourceCount('EBSVolume'), color: 'good' }
        ],
        status: this.getResourceCount('EBSVolume') > 0 ? '100% Healthy' : 'No data',
        description: 'Volume health overview'
      }
    ];

    cards.push({
      key: 'direct-connect-connections',
      title: 'Direct Connect Links',
      total: directConnectHealth.total,
      badge: directConnectHealth.total,
      segments: [
        { value: directConnectHealth.healthy, color: 'good' },
        { value: directConnectHealth.unhealthy, color: 'critical' }
      ].filter(segment => segment.value > 0),
      status: directConnectHealth.total > 0
        ? `${this.getPercentage(directConnectHealth.healthy, directConnectHealth.total)}% Available`
        : 'No data',
      description: directConnectHealth.total > 0
        ? `${directConnectHealth.healthy} available / ${directConnectHealth.unhealthy} other states`
        : 'Direct Connect overview'
    });

    cards.push({
      key: 'direct-connect-vifs',
      title: 'Direct Connect VIFs',
      total: vifHealth.total,
      badge: vifHealth.total,
      segments: [
        { value: vifHealth.healthy, color: 'good' },
        { value: vifHealth.unhealthy, color: 'critical' }
      ].filter(segment => segment.value > 0),
      status: vifHealth.total > 0
        ? `${this.getPercentage(vifHealth.healthy, vifHealth.total)}% BGP Available`
        : 'No data',
      description: vifHealth.total > 0
        ? `${vifHealth.healthy} stable / ${vifHealth.unhealthy} with BGP issues`
        : 'Virtual interface overview'
    });

    cards.push({
      key: 'vpn-connections',
      title: 'VPN Connections',
      total: vpnHealth.total,
      badge: vpnHealth.total,
      segments: [
        { value: vpnHealth.healthy, color: 'good' },
        { value: vpnHealth.unhealthy, color: 'critical' }
      ].filter(segment => segment.value > 0),
      status: vpnHealth.total > 0
        ? `${this.getPercentage(vpnHealth.healthy, vpnHealth.total)}% Available`
        : 'No data',
      description: vpnHealth.total > 0
        ? `${vpnHealth.healthy} available / ${vpnHealth.unhealthy} other states`
        : 'VPN availability overview'
    });

    cards.push({
      key: 'transit-gateways',
      title: 'Transit Gateways',
      total: transitGatewayHealth.total,
      badge: transitGatewayHealth.total,
      segments: [
        { value: transitGatewayHealth.healthy, color: 'good' },
        { value: transitGatewayHealth.unhealthy, color: 'critical' }
      ].filter(segment => segment.value > 0),
      status: transitGatewayHealth.total > 0
        ? `${this.getPercentage(transitGatewayHealth.healthy, transitGatewayHealth.total)}% Available`
        : 'No data',
      description: transitGatewayHealth.total > 0
        ? `${transitGatewayHealth.healthy} available / ${transitGatewayHealth.unhealthy} other states`
        : 'Transit gateway overview'
    });

    return cards;
  }

  get monitoringMetrics() {
    const coverage = this.dashboardData?.ec2Health?.cloudwatchAgentCoverage || 0;
    return [
      {
        label: 'RAM Monitoring',
        value: coverage,
        description: 'Active monitoring on resources'
      },
      {
        label: 'Disk Monitoring',
        value: coverage,
        description: 'Active monitoring on resources'
      }
    ];
  }

  get ec2InstanceStatus() {
    const ec2Count = this.getResourceCount('EC2Instance');
    const ec2 = this.dashboardData?.ec2Health;
    const total = ec2?.total || ec2Count;
    const running = ec2?.running || 0;
    const stopped = ec2?.stopped || 0;
    
    return {
      total: total,
      running: running,
      stopped: stopped,
      runningPercent: total > 0 ? this.getPercentage(running, total) : 0
    };
  }

  get ssmCoverage(): number {
    return this.dashboardData?.ec2Health?.ssmAgentCoverage || 0;
  }

  /**
   * CORREÇÃO: Buscar recursos usando as chaves corretas (sem formatação)
   */
  getResourceCount(type: string): number {
    if (!this.dashboardData?.resourceCounts) return 0;
    
    // Busca direta pela chave sem formatação
    return this.dashboardData.resourceCounts.get(type) || 0;
  }

  formatNumber(value: number | undefined): string {
    const formatter = new Intl.NumberFormat('en-US');
    return formatter.format(value || 0);
  }

  getResourceDisplayName(type: string): string {
    const nameMap: { [key: string]: string } = {
      'EC2Instance': 'EC2 Instances',
      'RDSInstance': 'RDS Instances',
      'S3Bucket': 'S3 Buckets',
      'EBSVolume': 'EBS Volumes',
      'EBSSnapshot': 'EBS Snapshots',
      'AMI': 'AMIs',
      'VPNConnection': 'VPN Connections',
      'NetworkACL': 'Network ACLs',
      'RouteTable': 'Route Tables',
      'SecurityGroup': 'Security Groups',
      'TransitGateway': 'Transit Gateways',
      'TransitGatewayAttachment': 'TGW Attachments',
      'InternetGateway': 'Internet Gateways',
      'FSxFileSystem': 'FSx File Systems',
      'EFSFileSystem': 'EFS File Systems',
      'BackupPlan': 'Backup Plans',
      'BackupVault': 'Backup Vaults',
      'RDSClusterSnapshot': 'RDS Cluster Snapshots',
      'AutoScalingGroup': 'Auto Scaling Groups',
      'ElasticIP': 'Elastic IPs',
      'DirectConnectConnection': 'Direct Connect Connections',
      'DirectConnectVirtualInterface': 'Direct Connect Virtual Interfaces',
      'VPCEndpoint': 'VPC Endpoints'
    };

    if (nameMap[type]) {
      return nameMap[type];
    }

    return type
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }

  private loadNetworkResourceHealth(): void {
    const networkMetrics = this.dashboardData?.networkHealth;

    if (!networkMetrics) {
      this.networkHealth = {
        directConnectConnections: this.createEmptyHealthState(),
        directConnectVirtualInterfaces: this.createEmptyHealthState(),
        vpnConnections: this.createEmptyHealthState(),
        transitGateways: this.createEmptyHealthState()
      };
      return;
    }

    this.networkHealth = {
      directConnectConnections: this.coerceHealthState(networkMetrics.directConnectConnections),
      directConnectVirtualInterfaces: this.coerceHealthState(networkMetrics.directConnectVirtualInterfaces),
      vpnConnections: this.coerceHealthState(networkMetrics.vpnConnections),
      transitGateways: this.coerceHealthState(networkMetrics.transitGateways)
    };
  }

  private coerceHealthState(state?: Partial<ResourceHealthState>): ResourceHealthState {
    if (!state) {
      return this.createEmptyHealthState();
    }

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const total = Math.max(0, Math.round(toNumber(state.total)));
    const healthy = Math.min(total, Math.max(0, Math.round(toNumber(state.healthy))));
    const hasUnhealthy = state.unhealthy !== undefined;
    const computedUnhealthy = hasUnhealthy
      ? Math.round(toNumber(state.unhealthy))
      : total - healthy;
    let unhealthy = Math.min(total, Math.max(0, computedUnhealthy));

    if (healthy + unhealthy > total) {
      unhealthy = Math.max(total - healthy, 0);
    }

    return {
      total,
      healthy,
      unhealthy
    };
  }

  private createEmptyHealthState(): ResourceHealthState {
    return { total: 0, healthy: 0, unhealthy: 0 };
  }
}
