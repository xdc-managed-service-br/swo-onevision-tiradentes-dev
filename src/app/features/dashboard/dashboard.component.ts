// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResourceHealthComponent } from './resource-health/resource-health.component';
import { SharedModule } from '../../shared/shared.module';
import { InstanceStatusWidgetComponent } from './instance-status-widget/instance-status-widget.component';
import { MonitoringWidgetComponent } from './monitoring-widget/monitoring-widget.component';
import { ResourceService } from '../../core/services/resource.service';
import { ErrorService } from '../../core/services/error.service';

// Interfaces
interface ResourceCounts {
  total: number;
  ec2: number;
  rds: number;
  s3: number;
  ebs: number;
  ebsSnapshots: number;
  amiSnapshots: number;
}

interface MonitoringStatus {
  ramMonitoredPercentage: number;
  diskMonitoredPercentage: number;
}

interface InstanceStatus {
  total: number;
  running: number;
  stopped: number;
  pending: number;
  terminated: number;
}

interface SSMStatus {
  connectedPercentage: number;
}

interface DistributionItem {
  account?: string;
  region?: string;
  count: number;
}

interface RecentResource {
  resourceType: string;
  region: string;
  lastUpdated: string | Date;
  instanceId?: string;
  instanceName?: string;
  imageId?: string;
  imageName?: string;
  bucketName?: string;
  volumeId?: string;
  dbInstanceId?: string;
  snapshotId?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ResourceHealthComponent,
    InstanceStatusWidgetComponent,
    MonitoringWidgetComponent,
    SharedModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Estado de carregamento
  loading = true;

  // Dados do dashboard
  resourceCounts: ResourceCounts = {
    total: 0,
    ec2: 0,
    rds: 0,
    s3: 0,
    ebs: 0,
    ebsSnapshots: 0,
    amiSnapshots: 0,
  };

  monitoringStatus: MonitoringStatus = { 
    ramMonitoredPercentage: 0,
    diskMonitoredPercentage: 0 
  };

  instanceStatus: InstanceStatus = { 
    total: 0, 
    running: 0, 
    stopped: 0, 
    pending: 0, 
    terminated: 0 
  };

  ssmStatus: SSMStatus = { 
    connectedPercentage: 0 
  };

  accountDistribution: DistributionItem[] = [];
  regionDistribution: DistributionItem[] = [];
  recentResources: RecentResource[] = [];
  accountMaxCount = 1;
  regionMaxCount = 1;

  constructor(
    private resourceService: ResourceService,
    private errorService: ErrorService
  ) {}

  ngOnInit(): void {
    console.log('Dashboard - Iniciando carregamento dos dados...');
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    // no-op: cleanup handled by takeUntilDestroyed()
  }

  // ========== CARREGAMENTO PRINCIPAL DOS DADOS ==========
  private loadDashboardData(): void {
    this.resourceService.getAllResources()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (resources) => {
          console.log('Dashboard - Recursos carregados do banco:', resources.length);
          
          if (!resources || resources.length === 0) {
            console.warn('Dashboard - Nenhum recurso encontrado no banco de dados');
            this.loading = false;
            return;
          }

          // Log dos tipos de recursos encontrados
          const resourceTypes = [...new Set(resources.map(r => r.resourceType))];
          console.log('Dashboard - Tipos de recursos encontrados:', resourceTypes);

          // Processa todos os dados sequencialmente
          this.calculateResourceCounts(resources);
          this.calculateMonitoringStatus(resources);
          this.calculateInstanceStatus(resources);
          this.calculateSSMStatus(resources);
          this.calculateDistributions(resources);
          this.setRecentResources(resources);
          
          this.loading = false;
          console.log('Dashboard - Todos os dados processados com sucesso!');
        },
        error: (error) => {
          console.error('Dashboard - Erro ao carregar recursos do banco:', error);
          this.errorService.handleError({
            message: 'Failed to load dashboard data',
            details: error
          });
          this.loading = false;
        }
      });
  }

  // ========== CÁLCULO DOS CONTADORES DE RECURSOS ==========
  private calculateResourceCounts(resources: any[]): void {
    console.log('Dashboard - Calculando contadores de recursos...');

    const counts: ResourceCounts = {
      total: resources.length,
      ec2: 0,
      rds: 0,
      s3: 0,
      ebs: 0,
      ebsSnapshots: 0,
      amiSnapshots: 0,
    };

    const unknownTypes: Record<string, number> = {};

    resources.forEach(resource => {
      const canonical = this.getCanonicalType(resource.resourceType);

      switch (canonical) {
        case 'EC2Instance':
          counts.ec2++;
          break;
        case 'RDSInstance':
          counts.rds++;
          break;
        case 'S3Bucket':
          counts.s3++;
          break;
        case 'EBSVolume':
          counts.ebs++;
          break;
        case 'EBSSnapshot':
          counts.ebsSnapshots++;
          break;
        case 'AMISnapshot':
          counts.amiSnapshots++;
          break;
        default:
          // Track unknowns for troubleshooting
          const k = resource.resourceType || 'Unknown';
          unknownTypes[k] = (unknownTypes[k] || 0) + 1;
      }
    });

    if (Object.keys(unknownTypes).length) {
      console.warn('Dashboard - Tipos de recurso não mapeados (verifique normalização):', unknownTypes);
    }

    this.resourceCounts = counts;
    console.log('Dashboard - Contadores calculados:', counts);
  }

  // ========== CÁLCULO DO STATUS DE MONITORAMENTO (CLOUDWATCH) ==========
  private calculateMonitoringStatus(resources: any[]): void {
    console.log('Dashboard - Calculando status de monitoramento CloudWatch...');

    const ec2Instances = resources.filter(r => r.resourceType === 'EC2Instance');
    const runningInstances = ec2Instances.filter(r => 
      r.instanceState && r.instanceState.toLowerCase() === 'running'
    );
    
    console.log(`Dashboard - EC2 total: ${ec2Instances.length}, Running: ${runningInstances.length}`);

    if (runningInstances.length === 0) {
      this.monitoringStatus = { 
        ramMonitoredPercentage: 0, 
        diskMonitoredPercentage: 0 
      };
      console.log('Dashboard - Nenhuma instância running encontrada para monitoramento');
      return;
    }

    // Conta instâncias com CloudWatch Agent
    const ramMonitored = runningInstances.filter(r => 
      r.cwAgentMemoryDetected === true
    ).length;
    
    const diskMonitored = runningInstances.filter(r => 
      r.cwAgentDiskDetected === true
    ).length;

    console.log(`Dashboard - CloudWatch Agent - RAM: ${ramMonitored}/${runningInstances.length}, Disk: ${diskMonitored}/${runningInstances.length}`);

    this.monitoringStatus = {
      ramMonitoredPercentage: Math.round((ramMonitored / runningInstances.length) * 100),
      diskMonitoredPercentage: Math.round((diskMonitored / runningInstances.length) * 100)
    };

    console.log('Dashboard - Status de monitoramento calculado:', this.monitoringStatus);
  }

  // ========== CÁLCULO DO STATUS DAS INSTÂNCIAS EC2 ==========
  private calculateInstanceStatus(resources: any[]): void {
    console.log('Dashboard - Calculando status das instâncias EC2...');

    const ec2Instances = resources.filter(r => r.resourceType === 'EC2Instance');
    
    const status: InstanceStatus = {
      total: ec2Instances.length,
      running: 0,
      stopped: 0,
      pending: 0,
      terminated: 0
    };

    // Conta por estado da instância
    ec2Instances.forEach(instance => {
      const state = instance.instanceState?.toLowerCase() || 'unknown';
      
      switch (state) {
        case 'running':
          status.running++;
          break;
        case 'stopped':
          status.stopped++;
          break;
        case 'pending':
          status.pending++;
          break;
        case 'terminated':
          status.terminated++;
          break;
        default:
          console.warn(`Dashboard - Estado de instância não reconhecido: ${state}`);
      }
    });

    this.instanceStatus = status;
    console.log('Dashboard - Status das instâncias calculado:', status);
  }

  // ========== CÁLCULO DO STATUS SSM AGENT ==========
  private calculateSSMStatus(resources: any[]): void {
    console.log('Dashboard - Calculando status do SSM Agent...');

    const ec2Instances = resources.filter(r => r.resourceType === 'EC2Instance');
    const runningInstances = ec2Instances.filter(r => 
      r.instanceState && r.instanceState.toLowerCase() === 'running'
    );
    
    if (runningInstances.length === 0) {
      this.ssmStatus = { connectedPercentage: 0 };
      console.log('Dashboard - Nenhuma instância running para verificar SSM');
      return;
    }

    // Conta instâncias com SSM Agent conectado
    const ssmConnected = runningInstances.filter(r => {
      const ssmStatus = r.ssmStatus?.toLowerCase();
      const ssmPingStatus = r.ssmPingStatus?.toLowerCase();
      
      return ssmStatus === 'online' || 
             ssmStatus === 'connected' || 
             ssmPingStatus === 'online' || 
             ssmPingStatus === 'connected';
    }).length;

    console.log(`Dashboard - SSM Agent conectado: ${ssmConnected}/${runningInstances.length}`);

    this.ssmStatus = {
      connectedPercentage: Math.round((ssmConnected / runningInstances.length) * 100)
    };

    console.log('Dashboard - Status SSM calculado:', this.ssmStatus);
  }

  // ========== CÁLCULO DAS DISTRIBUIÇÕES (ACCOUNT E REGION) ==========
  private calculateDistributions(resources: any[]): void {
    console.log('Dashboard - Calculando distribuições por Account e Region...');

    // Distribuição por Account
    const accountMap = new Map<string, number>();
    resources.forEach(r => {
      const account = r.accountName || r.accountId || 'Unknown Account';
      accountMap.set(account, (accountMap.get(account) || 0) + 1);
    });

    this.accountDistribution = Array.from(accountMap.entries())
      .map(([account, count]) => ({ account, count }))
      .sort((a, b) => b.count - a.count) // Ordena por maior quantidade
      .slice(0, 10); // Limita aos top 10

    // Maximo da seção Accounts
    this.accountMaxCount = Math.max(
      ...this.accountDistribution.map(i => i.count),
      1
    );

    console.log('Dashboard - Distribuição por Account:', this.accountDistribution);

    // Distribuição por Region  
    const regionMap = new Map<string, number>();
    resources.forEach(r => {
      const region = r.region || 'Unknown Region';
      regionMap.set(region, (regionMap.get(region) || 0) + 1);
    });

    this.regionDistribution = Array.from(regionMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count) // Ordena por maior quantidade
      .slice(0, 10); // Limita aos top 10

    // Maximo da seção Regions
    this.regionMaxCount = Math.max(
      ...this.regionDistribution.map(i => i.count),
      1
    );

    console.log('Dashboard - Distribuição por Region:', this.regionDistribution);
  }

  // ========== DEFINIÇÃO DOS RECURSOS RECENTES ==========
  private setRecentResources(resources: any[]): void {
    console.log('Dashboard - Organizando recursos recentes...');

    // Filtra recursos com lastUpdated e ordena pelos mais recentes
    const recentResources = resources
      .filter(r => r.lastUpdated)
      .sort((a, b) => {
        const dateA = new Date(a.lastUpdated).getTime();
        const dateB = new Date(b.lastUpdated).getTime();
        return dateB - dateA; // Mais recente primeiro
      })
      .slice(0, 10) // Pega apenas os 10 mais recentes
      .map(r => ({
        resourceType: r.resourceType,
        region: r.region,
        lastUpdated: r.lastUpdated,
        // Campos específicos por tipo de recurso
        instanceId: r.instanceId,
        instanceName: r.instanceName,
        imageId: r.imageId,
        imageName: r.imageName,
        bucketName: r.bucketName,
        volumeId: r.volumeId,
        dbInstanceId: r.dbInstanceId,
        snapshotId: r.snapshotId
      }));

    this.recentResources = recentResources;
    console.log('Dashboard - Recursos recentes organizados:', recentResources.length);
  }

  // ========== MÉTODOS AUXILIARES PARA O TEMPLATE ==========

  /**
   * Calcula a largura percentual das barras de distribuição
   * baseada no maior valor encontrado
   */
  getBarWidth(count: number, max?: number): number {
    // Se um max foi informado (por seção), usa ele
    if (typeof max === 'number' && isFinite(max) && max > 0) {
      return Math.round((count / max) * 100);
    }

    // Compatibilidade temporária com o HTML atual (usa max global das duas listas)
    const allCounts = [
      ...this.accountDistribution.map(item => item.count),
      ...this.regionDistribution.map(item => item.count)
    ];
    const globalMax = Math.max(...allCounts, 1);
    return Math.round((count / globalMax) * 100);
  }

  /**
   * Retorna um identificador amigável para cada tipo de recurso
   */
  getResourceIdentifier(resource: RecentResource): string {
    // Ordem de prioridade para nomes mais descritivos
    if (resource.instanceName) return resource.instanceName;
    if (resource.bucketName) return resource.bucketName;
    if (resource.imageName) return resource.imageName;
    if (resource.instanceId) return resource.instanceId;
    if (resource.volumeId) return resource.volumeId;
    if (resource.dbInstanceId) return resource.dbInstanceId;
    if (resource.imageId) return resource.imageId;
    if (resource.snapshotId) return resource.snapshotId;
    
    return 'Unnamed Resource';
  }

  /**
   * Getter para compatibilidade com templates que usam monitoredPercentage
   * Retorna a média entre RAM e Disk monitoring
   */
  get monitoredPercentage(): number {
    const ram = this.monitoringStatus.ramMonitoredPercentage;
    const disk = this.monitoringStatus.diskMonitoredPercentage;
    return Math.round((ram + disk) / 2);
  }

  trackByResourceId(index: number, resource: RecentResource): string {
    return resource.instanceId || 
           resource.bucketName || 
           resource.volumeId || 
           resource.dbInstanceId || 
           resource.snapshotId || 
           resource.imageId || 
           `${resource.resourceType}-${index}`;
  }  

  /**
   * Normaliza nomes/aliases de tipos de recursos vindos do backend
   * para valores canônicos usados no dashboard.
   */
  private getCanonicalType(type: string | undefined | null):
    'EC2Instance' | 'RDSInstance' | 'S3Bucket' | 'EBSVolume' | 'EBSSnapshot' | 'AMISnapshot' | 'Unknown' {
    const t = (type || '').toLowerCase();

    if (t === 'ec2instance' || t === 'ec2') return 'EC2Instance';
    if (t === 'rdsinstance' || t === 'rds') return 'RDSInstance';
    if (t === 's3bucket' || t === 's3') return 'S3Bucket';
    if (t === 'ebsvolume' || t === 'volume') return 'EBSVolume';
    if (t === 'ebssnapshot' || t === 'ebs-snapshot' || t === 'snapshot') return 'EBSSnapshot';

    // AMI images often come as AMIImage / Image / EC2Image / AMI
    if (
      t === 'amisnapshot' ||
      t === 'amiimage' ||
      t === 'image' ||
      t === 'ec2image' ||
      t === 'ami'
    ) {
      return 'AMISnapshot';
    }

    return 'Unknown';
  }
}
