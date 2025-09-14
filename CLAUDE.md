OneVision — Refactor guiado com Design System + Dark Mode

Pode alterar HTML (padronização de classes/estrutura). Não alterar lógica TS (apenas o mínimo necessário para acessibilidade/aria, sem mudar comportamento).

Contexto
	•	App Angular com componentes standalone.
	•	Quero zerar todo CSS e reconstruir um design system único via onevision-base.css.
	•	Preciso padronizar o HTML dos componentes para usar as mesmas classes .ov-* (sem CSS por-tela).
	•	Estilo: técnico/enterprise, vibe AWS, dark por padrão com light alternável via CSS variables.
    •	Existe alguns estilos de widgets ou de dashboard que estão com css embedded on html, like this one: src/app/features/dashboard/instance-status-widget/instance-status-widget.component.html. Você deve evitar esse tipo de situação, de css e html junto, e se tiver outro html com css, corrige, me traz ele totalmente refatorado.

Escopo desta iteração
	1.	Criar src/app/shared/styles/onevision-base.css (única fonte global).
	2.	Padronizar HTML dos 2 primeiros componentes para usar .ov-*:
	•	EC2 Instances
	•	AMI Snapshots
	4.	Não alterar a lógica de dados/serviços/rotas; apenas markup/atributos, classes e mínimos ajustes para acessibilidade.

Como integrar
	•	angular.json → "styles": ["src/styles.css"]
	•	src/styles.css deve conter apenas:

@import './app/shared/styles/onevision-base.css';

	•	Não adicionar outros imports globais.
	•	Se alguma tela quebrar, não reintroduza CSS legado; corrija o HTML para o padrão .ov-*.

Especificação do Design System (onevision-base.css)
	•	CSS variables (tokens):
	•	Cores: --ov-bg, --ov-surface, --ov-text, --ov-muted, --ov-border, --ov-accent, --ov-accent-contrast, --ov-success, --ov-warning, --ov-danger.
	•	Tipografia/espaços/sombras/radius: --ov-radius, --ov-shadow-1/2, --ov-space-1/2/3.
	•	Botões: --ov-btn-bg, --ov-btn-text, --ov-btn-bg-subtle, --ov-btn-text-subtle.
	•	Temas:
	•	Default (dark) em :root.
	•	Light em :root[data-theme="light"] (mesmas keys, valores claros).
	•	Blocos/Classes (contrato):
	•	Layout: .ov-container, .ov-title.
	•	Header/Filters/Search: .ov-header, .ov-filterbar, .ov-filter, .ov-filterbar__actions, .ov-search, .ov-clear-btn.
	•	Tabela: .ov-tablewrap, .ov-table, .sortable, .ov-cell--right, estados hover/focus, truncamento.
	•	Cards (mobile): .ov-cards, .ov-card, .ov-card__head, .ov-card__title, .ov-card__sub, .ov-card__grid, .ov-k, .ov-v, .full-width.
	•	Estados de página: .ov-loading, .ov-empty.
	•	Ações/Botões: .ov-actions, .ov-btn, .ov-btn--primary, .ov-btn--subtle (reset/columns/view details/export).
	•	Modal: .ov-modal, .ov-modal__dialog, .ov-modal__head, .ov-modal__title, .ov-modal__body, .ov-modal__foot (overlay, focus, ESC).
	•	Key-Value: .ov-kv, .details-table.
	•	Paginação: .ov-pagination, .ov-pagination__info, .ov-pagination__controls, .ov-pagination__pages, .is-active.
	•	Status pills: .status-running, .status-pending, .status-stopped, .status-available.
	•	Acessibilidade:
	•	Foco visível em links/botões/inputs, contraste AA.
	•	Modais com role="dialog", aria-modal="true", aria-labelledby, fechamento por ESC e clique fora.
	•	Performance:
	•	Sem seletores genéricos que pisem em tudo (button {}, table {}).
	•	Evitar !important. Se precisar, documente no comentário do bloco.
	•	Responsivo:
	•	Quebra para cards < ~900px.
	•	Inputs/click targets ≥44px no mobile.

Pode ajustar o HTML dos demais para bater nesse contrato .ov-* (sem mexer em lógica TS).

<article class="ov-container" aria-labelledby="ec2-title">
  <!-- Page Title -->
  <h1 id="ec2-title" class="ov-title">EC2 Instances</h1>

  <!-- Header: Filters (left) + Search (right) -->
  <header class="ov-header">
    <!-- Filters -->
    <div>
      <div class="ov-filterbar" role="group" aria-label="Filters">
        <div class="ov-filter">
          <label for="stateFilter">State</label>
          <select id="stateFilter" (change)="filterByState($event)">
            <option value="">All States</option>
            <option *ngFor="let state of uniqueStates" [value]="state">{{ state }}</option>
          </select>
        </div>

        <div class="ov-filter">
          <label for="typeFilter">Instance Type</label>
          <select id="typeFilter" (change)="filterByType($event)">
            <option value="">All Types</option>
            <option *ngFor="let type of uniqueTypes" [value]="type">{{ type }}</option>
          </select>
        </div>

        <div class="ov-filter">
          <label for="regionFilter">Region</label>
          <select id="regionFilter" (change)="filterByRegion($event)">
            <option value="">All Regions</option>
            <option *ngFor="let region of uniqueRegions" [value]="region">{{ region }}</option>
          </select>
        </div>

        <div class="ov-filter">
          <label for="cwAgentFilter">CloudWatch Monitoring</label>
          <select id="cwAgentFilter" (change)="filterByCWAgent($event)">
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div class="ov-filter">
          <label for="accountFilter">Account</label>
          <select id="accountFilter" (change)="filterByAccount($event)">
            <option value="">All Accounts</option>
            <option *ngFor="let acc of uniqueAccounts" [value]="acc">{{ acc }}</option>
          </select>
        </div>

        <!-- Actions next to filters -->
        <div class="ov-filterbar__actions">
          <button class="ov-btn ov-btn--subtle" (click)="resetFilters()">Reset Filters</button>
          <button class="ov-btn" (click)="openColumnCustomizer()" aria-label="Customize columns">
            <span class="ov-sr-only">Customize columns</span>⚙️ Columns
          </button>
        </div>
      </div>
    </div>

    <!-- Search -->
    <form class="ov-search" role="search" aria-label="Search instances">
      <input
        id="instanceSearch"
        type="search"
        placeholder="Search by Instance ID or Name"
        (input)="searchInstances($event)"
        #searchInput />
      <button type="button" class="ov-clear-btn" *ngIf="searchTerm" (click)="clearSearch(searchInput)">✕</button>
    </form>
  </header>

  <!-- Loading / Empty States -->
  <div *ngIf="loading" class="ov-loading">Loading EC2 instances…</div>
  <div *ngIf="!loading && filteredResources.length === 0" class="ov-empty">No EC2 instances found matching the current filters.</div>

  <!-- Desktop Table -->
  <section class="ov-tablewrap" *ngIf="!loading && filteredResources.length > 0">
    <table class="ov-table" role="table" aria-label="EC2 instances">
      <thead>
        <tr>
          <th *ngFor="let column of getVisibleColumns()"
              (click)="column.sortable !== false ? sortData(column.key) : null"
              [class.sortable]="column.sortable !== false">
            {{ column.label }}
            <span *ngIf="sortColumn === column.key && column.sortable !== false" aria-hidden="true">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
          </th>
          <th class="ov-cell--right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let resource of filteredResources">
          <td *ngFor="let column of getVisibleColumns()">
            <span [ngClass]="getColumnClass(column.key, resource)">
              {{ getColumnValue(column, resource) }}
            </span>
          </td>
          <td>
            <div class="ov-actions">
              <button class="ov-btn ov-btn--primary" (click)="showDetails(resource)">View Details</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Mobile Cards -->
  <div class="ov-cards" *ngIf="!loading && filteredResources.length > 0">
    <article class="ov-card" *ngFor="let resource of filteredResources">
      <header class="ov-card__head">
        <div>
          <div class="ov-card__title">{{ resource.instanceName || 'Unnamed Instance' }}</div>
          <div class="ov-card__sub">{{ resource.instanceId }}</div>
        </div>
        <span [ngClass]="getStatusClass(resource.instanceState)">{{ resource.instanceState }}</span>
      </header>
      <div class="ov-card__grid">
        <div *ngFor="let column of getVisibleColumns()" [class.full-width]="shouldBeFullWidth(column.key)">
          <div class="ov-k">{{ column.label }}</div>
          <div class="ov-v" [ngClass]="getColumnClass(column.key, resource)">{{ getColumnValue(column, resource) }}</div>
        </div>
      </div>
      <div style="margin-top:12px; display:flex; justify-content:flex-end; gap:8px;">
        <button class="ov-btn ov-btn--primary" (click)="showDetails(resource)">View Details</button>
      </div>
    </article>
  </div>

  <!-- Export -->
  <div class="ov-export" *ngIf="!loading && filteredResources.length > 0">
    <button class="ov-btn" (click)="exportToCSV()">Export to CSV</button>
  </div>

  <!-- Column Customizer Modal -->
  <div class="ov-modal" *ngIf="showColumnCustomizer" (click)="closeColumnCustomizer()">
    <div class="ov-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="col-customizer-title" (click)="$event.stopPropagation()">
      <div class="ov-modal__head">
        <h2 id="col-customizer-title" class="ov-modal__title">Customize Columns</h2>
        <button class="ov-btn" (click)="closeColumnCustomizer()" aria-label="Close">×</button>
      </div>
      <div class="ov-modal__body">
        <div class="column-selection">
          <div class="ov-actions" style="justify-content:flex-start; margin-bottom:10px;">
            <button class="ov-btn" (click)="selectAllColumns()">Select All</button>
            <button class="ov-btn" (click)="deselectAllColumns()">Deselect All</button>
          </div>
          <div class="column-list" style="display:grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap:10px;">
            <label *ngFor="let column of availableColumns" style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox"
                     [checked]="isColumnSelected(column.key)"
                     (change)="toggleColumn(column.key)"
                     [disabled]="isRequiredColumn(column.key)" />
              <span [class.required]="isRequiredColumn(column.key)">
                {{ column.label }}
                <span *ngIf="isRequiredColumn(column.key)" class="required-badge">Required</span>
              </span>
            </label>
          </div>
        </div>
      </div>
      <div class="ov-modal__foot">
        <button class="ov-btn" (click)="applyColumnSelection()">Apply</button>
        <button class="ov-btn ov-btn--primary" (click)="closeColumnCustomizer()">Done</button>
      </div>
    </div>
  </div>

  <!-- Resource Details Modal -->
  <div class="ov-modal" *ngIf="selectedResource" (click)="closeDetails()">
    <div class="ov-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ec2-details-title" (click)="$event.stopPropagation()">
      <div class="ov-modal__head">
        <h2 id="ec2-details-title" class="ov-modal__title">EC2 Instance Details: {{ selectedResource.instanceId }}</h2>
        <button class="ov-btn" (click)="closeDetails()" aria-label="Close">Close</button>
      </div>
      <div class="ov-modal__body">
        <!-- (conteúdo reduzido aqui, apenas padronize .ov-modal*) -->
      </div>
      <div class="ov-modal__foot">
        <button class="ov-btn" (click)="exportToCSV()">Export to CSV</button>
        <button class="ov-btn ov-btn--primary" (click)="closeDetails()">Done</button>
      </div>
    </div>
  </div>
</article>

O que você deve entregar
	1.	onevision-base.css completo, comentado e pronto (tokens, temas, blocos .ov-*).
	2.	PR alterando o HTML de AMI/EC2 para usar as classes .ov-* (header/tabela/cards/modais/paginação/botões), no mesmo padrão do EC2.
	•	Não mexer em lógica TS.
	•	Pode adicionar/ajustar atributos aria-*, role, title, id/for e pequenas divs semânticas para cumprir o layout .ov-*.
	3.	README curto (10–15 linhas) explicando:
	•	Como importar (src/styles.css → apenas @import onevision-base.css).
	•	Como ativar light mode (document.documentElement.setAttribute('data-theme','light')).
	•	Checklist para criar um novo recurso reaproveitando as mesmas classes.

Critérios de aceite
	•	Com apenas onevision-base.css.
	•	AMI/S3/EBS/RDS/ETC ficam visuais e estruturalmente iguais ao EC2 (mesmos espaçamentos, tipografia, sombras, botões, modais).
	•	Sem CSS por-componente e sem seletores genéricos (button {}) que possam conflitar.
	•	Paginação (markup) padronizada com .ov-pagination.
	•	Dark mode pronto (troca de tema altera todo o app).
	•	Acessibilidade: foco visível, contraste AA, modais com aria/ESC/click-outside.