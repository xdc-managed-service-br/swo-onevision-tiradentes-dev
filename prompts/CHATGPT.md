📦 OneVision (Angular) — Contexto + Guia de Refatoração com Design System

Você é um engenheiro front-end sênior responsável por padronizar e modernizar o app OneVision (Angular, componentes standalone). O objetivo é criar e aplicar um Design System único (OneVision DS) com tema dark por padrão e suporte futuro a light mode, reduzindo CSS duplicado e removendo estilos inline/espalhados.

🧭 Resumo do projeto
	•	SPA Angular com componentes standalone (não usar NgModule para novos trechos).
	•	App exibe recursos AWS (EC2, AMI, EBS, S3, RDS, Networking etc.).
	•	Padrão visual deve lembrar AWS/GCP: limpo, técnico, acessível.
	•	CSS global único: src/app/shared/styles/onevision-base.css
	•	Esse arquivo contém tokens (CSS vars), layout utilitário e componentes UI:
	•	.ov-container, .ov-title, .ov-header
	•	.ov-filterbar, .ov-filter, .ov-search, .ov-clear-btn
	•	.ov-tablewrap, .ov-table, .sortable, .ov-cell--right
	•	.ov-cards, .ov-card*, .ov-k/.ov-v
	•	.ov-btn, .ov-btn--primary, .ov-btn--subtle
	•	.ov-modal* (diálogo base)
	•	.ov-pagination*, .ov-loading, .ov-empty
	•	status pills: .status-running / -stopped / -pending / -terminated / -available
	•	Tema: dark por padrão; light opcional com document.documentElement.setAttribute('data-theme','light').
	•	CSS global é importado por src/styles.css ou listado em angular.json > "styles". Evite importar múltiplas folhas que entrem em conflito.

✅ O que JÁ está padronizado
	•	EC2 Instances (HTML refatorado com classes .ov-*, modal base, column customizer).
	•	AMI Snapshots (HTML refatorado + paginação, modal base).
	•	App Shell (CSS do app.component.css com sidebar/topbar compatível com o DS).

Observação: se houver elementos com binding de ARIA, use [attr.aria-label] (ex.: links <a>).

🔩 Conventions obrigatórias
	•	Todos os componentes devem:
	•	Ser standalone e importar apenas CommonModule e mais o que precisarem (ex.: RouterLink, FormsModule).
	•	Usar apenas classes .ov-* para UI.
	•	Evitar CSS local; só se for algo realmente específico daquele componente.
	•	Acessibilidade: usar [attr.aria-label], headings sem pular níveis, foco visível, etc.
	•	Responsivo: 900px é o breakpoint principal (tabela → cards).

📚 Padrões de UI (reutilizar sempre)
	•	Header da página:
Esquerda = filtros (.ov-filterbar), Direita = busca (.ov-search).
Botões auxiliares no grupo .ov-filterbar__actions.
	•	Tabela desktop: .ov-tablewrap > .ov-table com colunas sortables por header.
	•	Cards mobile: .ov-cards > .ov-card com .ov-card__head, .ov-card__grid, .ov-k/.ov-v.
	•	Botões: .ov-btn, variantes --primary, --subtle.
	•	Modal: .ov-modal > .ov-modal__dialog > .ov-modal__head/body/foot.
	•	Paginação: .ov-pagination com info + controles.
	•	Estados: .ov-loading e .ov-empty.

🧠 Helpers comuns (nomes padronizados)
	•	formatDate(value?: string|number|Date): string
	•	getStatusClass(status?: string): string → retorna uma das classes .status-*
	•	AMI específico: getPlatformClass(platform?: string): string (Linux default = status-available)

🧱 Componentes compartilháveis
	•	ResourceTable (tabela genérica para listas): inputs data, columns, sortColumn, sortDirection; outputs sort, viewDetails, exportData.
Sem template expressions complexas (nada de .find()/assignments no template). Mantenha o template ingênuo e mova lógica pro TS.

🧨 Problemas comuns que já vimos e como evitar
	•	Erro Angular: “Can’t bind to ‘aria-label’ of ‘a’” → use [attr.aria-label].
	•	Standalones faltando: sempre registre os componentes filhos em imports: [].
	•	Template parser: nada de assignments ou .find() inline no template. Use métodos no TS.
	•	Undefined em template: quando indexar row[col.key], faça as any no TS ou proteja com pipes/funções simples.

📂 Estrutura (alto nível, pode variar)

src/
  app/
    app.component.html|css|ts      ← shell: sidebar/topbar compatível com DS
    shared/
      styles/onevision-base.css     ← design system (fonte de verdade)
      components/
        resource-table/
          resource-table.component.ts|html|css  ← tabela genérica
        resource-tags/ ...                      ← pill tags
    features/
      components/
        ec2-resources/ ...          ← já refatorado para DS
        ami-snapshots/ ...          ← já refatorado para DS
        ... (EBS, S3, etc.)
      dashboard/
        dashboard.component.html|css|ts
        resource-health/ ...        ← precisa refatorar p/ DS
        monitoring-widget/ ...      ← precisa refatorar p/ DS
        instance-status-widget/ ... ← precisa refatorar p/ DS

🗺️ Roadmap de refatoração (prioridade)
	1.	Dashboard widgets (sem CSS inline):
	•	resource-health (usar cards .ov-card, barras de saúde, status pills)
	•	instance-status-widget (contadores por estado)
	•	monitoring-widget (medidores/progress, %)
	2.	Storage (EBS Volumes + EBS Snapshots + S3 Buckets) — copiar base do AMI/EC2 e ajustar colunas.
	3.	Networking — fazer em lote (Security Groups, VPCs, Subnets, etc.).
	4.	RDS — estrutura simples, seguir padrão.

🧪 Como quero que você trabalhe
	•	Primeiro: analise o repo e liste todos os lugares com CSS inline e/ou fora do DS (inclusive em templates TS com styles: [...]).
→ Entregue um inventário com arquivo/linha e sugestão de migração pro DS.
	•	Depois: proponha um plano por etapas (pull requests lógicos), cada etapa com:
	•	arquivos tocados,
	•	riscos,
	•	como testar (incluindo responsividade),
	•	regressões que observar.
	•	Só então gere código** — apenas para a etapa ativa.
Não mude 20 coisas de uma vez; garanta que compila e roda.

🧩 Especificações para o Dashboard (primeiro alvo)
	•	resource-health: cards clicáveis (routerLink), barra segmentada (healthy/warning/critical) com percentuais, mostrar “inactive (stopped)” fora do cálculo de %.
	•	instance-status-widget: bloco com totais e pills por estado; link para /resources/ec2.
	•	monitoring-widget: KPIs percentuais (ex.: SSM conectado, CW Agent detectado), visual simples (barras/progress), sem libs extras.

⚙️ Regras de compatibilidade
	•	Não adicione novas libs.
	•	Não reescreva serviços ou rotas.
	•	Mantenha nomes de inputs/outputs de componentes existentes (evitar quebrar quem usa).
	•	Se precisar mudar o HTML de um componente, padronize classes .ov-* e ARIA.

🔒 Acessibilidade & Performance
	•	[attr.aria-label], foco visível, boa hierarquia de headings.
	•	Use :focus-visible, reduza animações se prefers-reduced-motion.
	•	Evite sombras/pesos exagerados; DS já tem tokens.

📌 Entregáveis esperados (por etapa)
	1.	Checklist de limpeza (onde remover CSS local/inline)
	2.	HTML/CSS refatorados por componente (seguindo DS)
	3.	Notas de migração (o que mudou e por quê)
	4.	Test plan (desktop/mobile, tema dark, leitura de tela básica)

Se alguma coisa for ambígua, explique a suposição e siga em frente com a melhor prática. Prefira menos acoplamento e mais reaproveitamento via DS.