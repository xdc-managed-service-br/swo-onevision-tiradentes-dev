import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ResourceService } from '../../../core/services/resource.service';
import { ResourceTagsComponent } from '../../../shared/components/resource-tags/resource-tags.component';
import { ExportService, ExportColumn } from '../../../core/services/export.service';
import { EC2Instance } from '../../../models/resource.model';

type ColumnKey = keyof EC2Instance;

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  sortable?: boolean;
  transform?: (resource: EC2Instance) => string;
}

@Component({
  selector: 'app-ec2-resources',
  standalone: true,
  imports: [CommonModule, ResourceTagsComponent],
  templateUrl: './ec2-resources.component.html',
  styleUrls: [
    '../../../shared/styles/onevision-base.css'
  ]
})
export class EC2ResourcesComponent implements OnInit, OnDestroy {
  constructor(
    private resourceService: ResourceService,
    private exportService: ExportService
  ) {}
  // ==== State ====
  resources: EC2Instance[] = [];
  filteredResources: EC2Instance[] = [];
  paginatedResources: EC2Instance[] = [];
  loading = true;
  selectedResource: EC2Instance | null = null;

  // Pagination
  pageSize = 50;
  currentPage = 1;
  totalPages = 1;
  pageStartIndex = 0;
  pageEndIndex = 0;

  // Search & filters
  searchTerm = '';
  uniqueStates: string[] = [];
  uniqueTypes: string[] = [];
  uniqueRegions: string[] = [];
  uniqueAccounts: string[] = [];
  stateFilter = '';
  typeFilter = '';
  regionFilter = '';
  cwAgentFilter = '';
  accountFilter = '';

  // Sorting
  sortColumn: ColumnKey | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  private static readonly DATE_COLUMNS: ColumnKey[] = ['lastUpdated', 'ssmLastPingTime'];

  // Columns customization
  showColumnCustomizer = false;
  selectedColumns: Set<ColumnKey> = new Set();

  availableColumns: ColumnDefinition[] = [
    { key: 'instanceId', label: 'Instance ID', sortable: true },
    { key: 'instanceName', label: 'Name', sortable: true },
    { key: 'instanceType', label: 'Type', sortable: true },
    { key: 'instanceState', label: 'State', sortable: true },
    {
      key: 'healthStatus',
      label: 'Health Status',
      sortable: true,
      transform: (r) => this.getHealthStatusText(r)
    },
    {
      key: 'cwAgentMemoryDetected',
      label: 'CW Monitoring',
      sortable: true,
      transform: (r) => (r.cwAgentMemoryDetected ? 'Enabled' : 'Disabled')
    },
    {
      key: 'instancePrivateIps',
      label: 'Private IPs',
      sortable: false,
      transform: (r) => this.formatIpList(r.instancePrivateIps),
    },
    {
      key: 'instancePublicIps',
      label: 'Public IPs',
      sortable: false,
      transform: (r) => this.formatIpList(r.instancePublicIps),
    },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'accountId', label: 'Account ID', sortable: true },
    { key: 'accountName', label: 'Account Name', sortable: true },
    { key: 'platformDetails', label: 'Platform', sortable: true },
    { key: 'amiName', label: 'AMI Name', sortable: true },
    { key: 'iamRole', label: 'IAM Role', sortable: true },
    { key: 'ssmStatus', label: 'SSM Status', sortable: true },
    { key: 'ssmPingStatus', label: 'SSM Ping Status', sortable: true },
    { key: 'ssmVersion', label: 'SSM Version', sortable: true },
    {
      key: 'ssmLastPingTime',
      label: 'Last Ping Time',
      sortable: true,
      transform: (r) => this.formatDate(r.ssmLastPingTime)
    },
    { key: 'swoMonitor', label: 'SWO Monitor', sortable: true },
    { key: 'swoPatch', label: 'SWO Patch', sortable: true },
    { key: 'swoBackup', label: 'SWO Backup', sortable: true },
    { key: 'swoRiskClass', label: 'Risk Class', sortable: true },
    { key: 'patchGroup', label: 'Patch Group', sortable: true },
    { key: 'autoStart', label: 'Auto Start', sortable: true },
    { key: 'autoShutdown', label: 'Auto Shutdown', sortable: true },
    { key: 'saturday', label: 'Saturday Schedule', sortable: true },
    { key: 'sunday', label: 'Sunday Schedule', sortable: true },
    {
      key: 'lastUpdated',
      label: 'Last Updated',
      sortable: true,
      transform: (r) => this.formatDate(r.lastUpdated)
    }
  ];

  defaultColumns: ColumnKey[] = [
    'instanceId',
    'instanceName',
    'instanceType',
    'instanceState',
    'healthStatus',
    'cwAgentMemoryDetected',
    'instancePrivateIps',
    'instancePublicIps',
    'region',
    'accountId',
    'accountName',
    'lastUpdated'
  ];
  requiredColumns: ColumnKey[] = ['instanceId'];

  private destroy$ = new Subject<void>();

  // ==== Lifecycle ====
  ngOnInit(): void {
    this.selectedColumns = new Set(this.defaultColumns);
    this.loadColumnPreferences();
    this.loadResources();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==== Data loading ====
  loadResources(): void {
    this.loading = true;

    this.resourceService
      .getResourcesByType('EC2Instance')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: EC2Instance[]) => {
          console.log('[EC2] recebidas do serviço:', data.length);

          this.resources = data.map((resource: EC2Instance) => {
            const instancePrivateIps = this.parseIpList(
              (resource as any).instancePrivateIps ?? (resource as any).privateIps
            );
            const instancePublicIps = this.parseIpList(
              (resource as any).instancePublicIps ?? (resource as any).publicIps
            );
            // Normaliza booleans que podem vir como "true"/"false"
            const toBool = (v: unknown) =>
              typeof v === 'string' ? v.toLowerCase() === 'true' : Boolean(v);

            const normalized: EC2Instance = {
              ...resource,
              // garante os arrays tipados
              instancePrivateIps,
              instancePublicIps,
              // booleans consistentes
              cwAgentMemoryDetected: toBool(resource.cwAgentMemoryDetected),
              cwAgentDiskDetected: toBool(resource.cwAgentDiskDetected),
              lastUpdated: resource.lastUpdated,
              ssmLastPingTime: resource.ssmLastPingTime,
            };

            return normalized;
          });
          this.filteredResources = [...this.resources];
          this.uniqueStates = Array.from(
            new Set(this.resources.map(r => r.instanceState).filter((s): s is string => !!s))
          ).sort();
          this.uniqueTypes = Array.from(
            new Set(this.resources.map(r => r.instanceType).filter((s): s is string => !!s))
          ).sort();
          this.uniqueRegions = Array.from(
            new Set(this.resources.map(r => r.region).filter((s): s is string => !!s))
          ).sort();
          this.uniqueAccounts = Array.from(
            new Set(
              this.resources
                .map(r => r.accountName || r.accountId)
                .filter((s): s is string => !!s)
            )
          ).sort();
          this.recomputePagination();
          this.loading = false;
        },
        error: (error: unknown) => {
          console.error('Error loading EC2 instances:', error);
          this.loading = false;
        },
      });
  }

  refresh(): void {
    this.resourceService.clearCache();
    this.loadResources();
  }

  openColumnCustomizer(): void {
    this.showColumnCustomizer = true;
  }

  closeColumnCustomizer(): void {
    this.showColumnCustomizer = false;
  }

  toggleColumn(key: ColumnKey): void {
    if (this.isRequiredColumn(key)) return;

    if (this.selectedColumns.has(key)) {
      this.selectedColumns.delete(key);
    } else {
      this.selectedColumns.add(key);
    }
  }

  isColumnSelected(key: ColumnKey): boolean {
    return this.selectedColumns.has(key);
  }

  isRequiredColumn(key: ColumnKey): boolean {
    return this.requiredColumns.includes(key);
  }

  selectAllColumns(): void {
    this.availableColumns.forEach((col) => this.selectedColumns.add(col.key));
  }

  deselectAllColumns(): void {
    this.selectedColumns.clear();
    this.requiredColumns.forEach((k) => this.selectedColumns.add(k));
  }

  applyColumnSelection(): void {
    this.saveColumnPreferences();
    this.closeColumnCustomizer();
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter((col) => this.selectedColumns.has(col.key));
  }

  private saveColumnPreferences(): void {
    try {
      const preferences = Array.from(this.selectedColumns);
      localStorage.setItem('ec2-columns', JSON.stringify(preferences));
    } catch (e) {
      console.warn('Could not save column preferences:', e);
    }
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('ec2-columns');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Only keep keys that still exist
        const validKeys = new Set(this.availableColumns.map((c) => c.key));
        this.selectedColumns = new Set(parsed.filter((k): k is ColumnKey => validKeys.has(k as ColumnKey)) as ColumnKey[]);
        // Ensure required columns are present
        this.requiredColumns.forEach((k) => this.selectedColumns.add(k));
      }
    } catch {
      this.selectedColumns = new Set(this.defaultColumns);
    }
  }

  searchInstances(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm = value.trim().toLowerCase();
    this.applyFilters();
  }

  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  filterByState(event: Event): void {
    this.stateFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByType(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByRegion(event: Event): void {
    this.regionFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByCWAgent(event: Event): void {
    this.cwAgentFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  filterByAccount(event: Event): void {
    this.accountFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredResources = this.resources.filter((r) => {

      if (this.searchTerm) {
        const id = r.instanceId?.toLowerCase() ?? '';
        const name = r.instanceName?.toLowerCase() ?? '';
        if (!id.includes(this.searchTerm) && !name.includes(this.searchTerm)) return false;
      }

      if (this.stateFilter && r.instanceState !== this.stateFilter) return false;
      if (this.typeFilter && r.instanceType !== this.typeFilter) return false;
      if (this.regionFilter && r.region !== this.regionFilter) return false;

      if (this.cwAgentFilter) {
        const isEnabled = this.cwAgentFilter === 'true';
        if (r.cwAgentMemoryDetected !== isEnabled) return false;
      }

      if (this.accountFilter && (r.accountName || r.accountId) !== this.accountFilter) return false;

      return true;
    });

    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    } else {
      this.updatePaginationAfterChange();
    }
  }

resetFilters(): void {
  this.stateFilter = '';
  this.typeFilter = '';
  this.regionFilter = '';
  this.cwAgentFilter = '';
  this.accountFilter = '';
  this.searchTerm = '';

  const searchInput = document.getElementById('instanceSearch') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = '';
  }

  this.filteredResources = [...this.resources];

  if (this.sortColumn) {
    this.sortData(this.sortColumn);
  } else {
    this.updatePaginationAfterChange();
  }
}  

  // ==== Sorting ====
  sortData(column: ColumnKey): void {
    this.sortColumn = column; // keep selected column
    this.filteredResources = [...this.filteredResources].sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];

      // Dates (ISO strings)
      if (EC2ResourcesComponent.DATE_COLUMNS.includes(column)) {
        const dateA = valueA ? new Date(valueA as string).getTime() : 0;
        const dateB = valueB ? new Date(valueB as string).getTime() : 0;
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Numbers
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }

      // Booleans
      if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
        const aNum = valueA ? 1 : 0;
        const bNum = valueB ? 1 : 0;
        return this.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Strings
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return 0;
    });

    this.updatePaginationAfterChange();
  }

  // ==== Pagination ====
  private recomputePagination(): void {
    const total = this.filteredResources?.length ?? 0;
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize, total);

    this.paginatedResources = (this.filteredResources ?? []).slice(start, end);
    this.pageStartIndex = total === 0 ? 0 : start + 1;
    this.pageEndIndex = end;
  }

  updatePaginationAfterChange(): void {
    this.currentPage = 1;
    this.recomputePagination();
  }

  // ==== Details / helpers ====
  // 1) Helpers
  private readonly IPV4 =
    /^(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
  private readonly IPV6 =
    /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(::)|([0-9a-f]{1,4}:){1,7}:|:([0-9a-f]{1,4}:){1,7}|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}(:[0-9a-f]{1,4}){1,6})$/i;

  private isIp(x: string): boolean {
    const v = (x || '').trim();
    // remove máscara se vier "10.0.0.1/24"
    const ip = v.includes('/') ? v.split('/')[0] : v;
    return this.IPV4.test(ip) || this.IPV6.test(ip);
  }

  // Extrai possíveis IPs de qualquer forma de objeto que venha de ENI/EC2
  private extractIpsFromObject(o: any): string[] {
    if (!o || typeof o !== 'object') return [];

    const candidates: unknown[] = [];

    // Campos comuns
    const directKeys = [
      'ip', 'IP', 'Ip', 'address', 'Address',
      'privateIp', 'PrivateIp', 'privateIpAddress', 'PrivateIpAddress',
      'publicIp', 'PublicIp', 'publicIpAddress', 'PublicIpAddress'
    ];
    directKeys.forEach(k => { if (o?.[k] != null) candidates.push(o[k]); });

    // Estruturas do SDK EC2
    if (Array.isArray(o?.PrivateIpAddresses)) {
      o.PrivateIpAddresses.forEach((p: any) => {
        if (p?.PrivateIpAddress) candidates.push(p.PrivateIpAddress);
        if (p?.Association?.PublicIp) candidates.push(p.Association.PublicIp);
      });
    }
    if (o?.Association?.PublicIp) candidates.push(o.Association.PublicIp);

    // Arrays aninhados genéricos
    if (Array.isArray(o?.ips)) candidates.push(...o.ips);
    if (Array.isArray(o?.privateIps)) candidates.push(...o.privateIps);
    if (Array.isArray(o?.publicIps)) candidates.push(...o.publicIps);

    // Recursividade leve: se tiver sub-objetos óbvios
    ['eni', 'networkInterface', 'interface', 'addressInfo'].forEach(k => {
      if (o?.[k]) candidates.push(o[k]);
    });

    return this.flattenToIps(candidates);
  }

  private flattenToIps(values: unknown[]): string[] {
    const out: string[] = [];
    for (const v of values) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        out.push(...this.flattenToIps(v));
        continue;
      }
      if (typeof v === 'object') {
        out.push(...this.extractIpsFromObject(v));
        continue;
      }
      if (typeof v === 'string') {
        const s = v.trim();
        // String com JSON?
        if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
          try {
            const parsed = JSON.parse(s);
            out.push(...this.flattenToIps([parsed]));
            continue;
          } catch { /* segue fluxo */ }
        }
        // "a, b; c | d"
        const parts = s.split(/[,\s;|]+/).map(p => p.trim()).filter(Boolean);
        for (const p of parts) if (this.isIp(p)) out.push(p);
      }
    }
    return out;
  }

  // 2) Substitui TUA parseIpList por esta versão blindada
  private parseIpList(raw: unknown): string[] {
    if (raw == null) return [];

    // Array -> flatten + extrair
    if (Array.isArray(raw)) return this.flattenToIps(raw);

    // DynamoDB shapes
    if (typeof raw === 'object') {
      const o: any = raw;
      if (typeof o?.S === 'string') return this.parseIpList(o.S);
      if (Array.isArray(o?.L)) return this.flattenToIps(o.L);
      return this.extractIpsFromObject(o); // pega campos comuns
    }

    // String (JSON, CSV, etc.)
    if (typeof raw === 'string') {
      const s = raw.trim();
      try {
        if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
          const parsed = JSON.parse(s);
          return this.parseIpList(parsed);
        }
      } catch { /* ignora e tenta split */ }
      return this.flattenToIps([s]);
    }

    return [];
  }

  // 3) Formatação amigável (mantém "N/A" quando vazio)
  private formatIpList(value: unknown): string {
    const arr = Array.from(new Set(this.parseIpList(value))).filter(Boolean);
    return arr.length ? arr.join(', ') : 'N/A';
  }




  showDetails(r: EC2Instance): void {
    this.selectedResource = r;
  }

  closeDetails(): void {
    this.selectedResource = null;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString();
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s === 'running') return 'status-running';
    if (s === 'stopped') return 'status-stopped';
    if (s === 'pending') return 'status-pending';
    if (s === 'terminated') return 'status-terminated';
    return 'status-unknown';
  }

  getHealthStatusText(r: EC2Instance): string {
    if (r.instanceState !== 'running') return 'N/A';

    if (typeof r.healthChecksPassed === 'number' && typeof r.healthChecksTotal === 'number') {
      return `${r.healthChecksPassed} / ${r.healthChecksTotal}`;
    }

    let passed = 0;
    let total = 0;
    if (r.systemStatus) { total++; if (r.systemStatus === 'Ok') passed++; }
    if (r.instanceStatus) { total++; if (r.instanceStatus === 'Ok') passed++; }
    if (r.ebsStatus) { total++; if (r.ebsStatus === 'Ok') passed++; }

    if (total > 0) return `${passed} / ${total}`;
    return 'No Health Data';
  }

  getHealthStatusClass(r: EC2Instance): string {
    if (r.instanceState !== 'running') return 'status-unknown';

    const fullyHealthy =
      (r.healthChecksPassed === r.healthChecksTotal && (r.healthChecksTotal ?? 0) > 0) ||
      (r.systemStatus === 'Ok' && r.instanceStatus === 'Ok' && r.ebsStatus === 'Ok');

    if (fullyHealthy) return 'status-running';

    const failing =
      (typeof r.healthChecksPassed === 'number' &&
        typeof r.healthChecksTotal === 'number' &&
        r.healthChecksPassed < r.healthChecksTotal) ||
      r.systemStatus === 'failed' ||
      r.instanceStatus === 'failed' ||
      r.ebsStatus === 'failed';

    return failing ? 'status-warning' : 'status-warning';
  }

  shouldBeFullWidth(key: ColumnKey): boolean {
    return ['instanceName', 'platformDetails', 'amiName', 'instancePrivateIps', 'instancePublicIps'].includes(
      key as string
    );
  }

  getColumnValue(column: ColumnDefinition, resource: EC2Instance): string {
    if (column.transform) return column.transform(resource);

    const value = resource[column.key];
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
      return value.map(String).join(', ');
    }
    return String(value);
  }

  getColumnClass(key: ColumnKey, resource: EC2Instance): string {
    if (key === 'instanceState') return this.getStatusClass(resource.instanceState);
    if (key === 'healthStatus') return this.getHealthStatusClass(resource);
    if (key === 'cwAgentMemoryDetected') return resource.cwAgentMemoryDetected ? 'status-running' : 'status-stopped';
    if (key === 'instancePrivateIps' || key === 'instancePublicIps') return 'ip-address-column';
    return '';
  }

  // ==== Export ====
  exportToCSV(): void {
    if (!this.filteredResources.length) return;

    const filename = 'ec2-instances.csv';
    const visibleColumns = this.getVisibleColumns();

    const exportColumns: ExportColumn[] = visibleColumns.map((col) => ({
      key: col.key as string,
      label: col.label,
      transform: col.transform
        ? (r) => col.transform!(r as EC2Instance)
        : (r) => {
            const resource = r as EC2Instance;
            if (col.key === 'instancePrivateIps') return resource.instancePrivateIps?.join('; ') ?? '';
            if (col.key === 'instancePublicIps') return resource.instancePublicIps?.join('; ') ?? '';
            return (resource as any)[col.key] ?? '';
          }
    }));

    this.exportService.exportDataToCSV(this.filteredResources, exportColumns, filename);
  }

  // ==== Pagination helpers for template ====
  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages);
    if (clamped !== this.currentPage) {
      this.currentPage = clamped;
      this.recomputePagination();
    }
  }

  goToFirstPage(): void {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.recomputePagination();
    }
  }

  goToLastPage(): void {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.recomputePagination();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.recomputePagination();
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.recomputePagination();
    }
  }
}