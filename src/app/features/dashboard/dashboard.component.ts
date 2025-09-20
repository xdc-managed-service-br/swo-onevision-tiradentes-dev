// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { MetricService } from '../../core/services/metric.service';
import { MetricProcessorService, ProcessedMetricData } from '../../core/services/metric-processor.service';
import { ResourceService } from '../../core/services/resource.service';

interface ResourceHealthState {
  total: number;
  healthy: number;
  unhealthy: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./dashboard.component.html`,
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isLoading = false;
  dashboardData: ProcessedMetricData | null = null;
  resourceTypes: { name: string; count: number }[] = [];
  networkHealth = {
    directConnectConnections: this.createEmptyHealthState(),
    directConnectVirtualInterfaces: this.createEmptyHealthState(),
    vpnConnections: this.createEmptyHealthState(),
    transitGateways: this.createEmptyHealthState()
  };

  constructor(
    private metricService: MetricService,
    private metricProcessor: MetricProcessorService,
    private resourceService: ResourceService
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
    
    this.metricService.getCurrentMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (metrics) => {
          // Processa os dados para o dashboard
          this.dashboardData = this.metricProcessor.processMetricsForDashboard(metrics);
          
          // Extrai tipos de recursos
          this.extractResourceTypes();

          // Atualiza cards de saúde para recursos de rede
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
      .sort((a, b) => b.count - a.count)
      .slice(0, 12); // Top 12 resource types
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
    return this.dashboardData.regionDistribution.slice(0, 10);
  }

  getRecentResources() {
    if (!this.dashboardData?.recentResources) return [];
    return this.dashboardData.recentResources.slice(0, 10);
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
        value: this.formatNumber(this.dashboardData?.summary?.totalResources || 0)
      },
      {
        label: 'EC2 Instances',
        value: this.formatNumber(this.getResourceCount('EC2Instance'))
      },
      {
        label: 'RDS Instances',
        value: this.formatNumber(this.getResourceCount('RDSInstance'))
      },
      {
        label: 'S3 Buckets',
        value: this.formatNumber(this.getResourceCount('S3Bucket'))
      },
      {
        label: 'Transit Gateways',
        value: this.formatNumber(this.getResourceCount('TransitGateway'))
      },
      {
        label: 'EBS Volumes',
        value: this.formatNumber(this.getResourceCount('EBSVolume'))
      },
      {
        label: 'Snapshots',
        value: this.formatNumber(this.getSnapshotCount())
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

  /**
   * Método auxiliar para obter total de snapshots
   */
  getSnapshotCount(): number {
    const ebs = this.getResourceCount('EBSSnapshot');
    const ami = this.getResourceCount('AMI');
    const storageTotal = this.dashboardData?.storage?.totalSnapshots;
    
    // Usa o valor de storage se disponível, senão soma EBS + AMI
    return storageTotal || (ebs + ami);
  }

  formatNumber(value: number | undefined): string {
    const formatter = new Intl.NumberFormat('en-US');
    return formatter.format(value || 0);
  }

  private loadNetworkResourceHealth(): void {
    forkJoin({
      directConnectConnections: this.resourceService.getResourcesByType('DirectConnectConnection'),
      directConnectVirtualInterfaces: this.resourceService.getResourcesByType('DirectConnectVirtualInterface'),
      vpnConnections: this.resourceService.getResourcesByType('VPNConnection'),
      transitGateways: this.resourceService.getResourcesByType('TransitGateway')
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({
          directConnectConnections,
          directConnectVirtualInterfaces,
          vpnConnections,
          transitGateways
        }) => {
          this.networkHealth.directConnectConnections = this.calculateStateHealth(
            directConnectConnections,
            (resource) => (resource as any)?.connectionState,
            ['available']
          );

          this.networkHealth.directConnectVirtualInterfaces = this.calculateDirectConnectVirtualInterfaceHealth(
            directConnectVirtualInterfaces as any[]
          );

          this.networkHealth.vpnConnections = this.calculateStateHealth(
            vpnConnections,
            (resource) => (resource as any)?.state,
            ['available']
          );

          this.networkHealth.transitGateways = this.calculateStateHealth(
            transitGateways,
            (resource) => (resource as any)?.state,
            ['available']
          );
        },
        error: (error) => {
          console.error('[Dashboard] Error loading network resource health:', error);
          this.networkHealth = {
            directConnectConnections: this.createEmptyHealthState(),
            directConnectVirtualInterfaces: this.createEmptyHealthState(),
            vpnConnections: this.createEmptyHealthState(),
            transitGateways: this.createEmptyHealthState()
          };
        }
      });
  }

  private calculateStateHealth<T>(items: T[], extractor: (item: T) => unknown, healthyStates: string[]): ResourceHealthState {
    const normalizedHealthy = healthyStates.map(state => state.toLowerCase());
    const total = items?.length || 0;

    const healthy = (items || []).reduce((count, item) => {
      const value = extractor(item);
      const normalized = this.normalizeState(value);
      return normalized && normalizedHealthy.includes(normalized) ? count + 1 : count;
    }, 0);

    return {
      total,
      healthy,
      unhealthy: Math.max(total - healthy, 0)
    };
  }

  private calculateDirectConnectVirtualInterfaceHealth(interfaces: any[]): ResourceHealthState {
    const total = interfaces?.length || 0;
    let healthy = 0;

    (interfaces || []).forEach(iface => {
      const peers = Array.isArray(iface?.bgpPeers) ? iface.bgpPeers : [];
      const hasHealthyPeer = peers.some(peer => this.normalizeState((peer as any)?.bgpStatus) === 'up');
      if (hasHealthyPeer) {
        healthy += 1;
      }
    });

    return {
      total,
      healthy,
      unhealthy: Math.max(total - healthy, 0)
    };
  }

  private normalizeState(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized || undefined;
  }

  private createEmptyHealthState(): ResourceHealthState {
    return { total: 0, healthy: 0, unhealthy: 0 };
  }
}
