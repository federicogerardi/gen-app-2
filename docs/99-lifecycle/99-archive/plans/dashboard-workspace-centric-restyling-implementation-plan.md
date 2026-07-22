---
status: completed
version: 1.1
date_created: 2026-07-21
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: Frontend Platform Team
type: implementation-plan
tags: [dashboard, workspace-centric, ui-convergence, copy, restyling]
goal: Implement the Dashboard Workspace-Centric Restyling per the approved proposal, transforming `/dashboard` from a static vanity-metrics page into an action-oriented, workspace-centric entry point.
---

# Implementation Plan: Dashboard Workspace-Centric Restyling

> Proposal: `docs/02-design/specifications/dashboard-workspace-centric-restyling-proposal.md`
> Precedent: `docs/02-design/specifications/workspace-hub-restyling-proposal.md` (already implemented)

## Prerequisiti

Prima di iniziare, verificare che questi documenti siano letti e compresi (AGENTS.md Mandatory Read Order):

1. `docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `docs/02-design/domain-bounded-context-map.md`
3. `docs/07-governance/domain-naming-decision-log.md`
4. `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` (vincolante per CTA, feedback, token)
5. `docs/02-design/specifications/dashboard-workspace-centric-restyling-proposal.md` (proposal madre)

**Archetype dichiarato**: Data Table View (card-variant), Overview Companion.

---

## Fase 0 — Token verification (prerequisito, ~5 min)

Verificare che i design token necessari siano definiti in `apps/frontend/src/styles.css`:

- [ ] `--error-fg` in `:root` (linea 54) e `:root[data-theme='dark']` (linea 170) — usato da `.dashboard-workspace-chip__status--blocked`
- [ ] `--interactive-hover` in `:root` (linea 83) e `:root[data-theme='dark']` (linea 199) — usato dal chip workspace al hover
- [ ] `--workspace-blue` in `:root` (linea 15) — usato da `:focus-visible` outline

Se mancanti, aggiungerli prima di procedere. Tutti e tre sono già presenti nel codice attuale (verificato).

**QA**: nessuno — è una verifica di lettura.

---

## Fase 1 — Nuovi file (non-breaking, nessuna modifica a DashboardPage)

Tutti i passi della Fase 1 sono **additivi** — non toccano il rendering attuale di `/dashboard`. Possono essere mergeati senza rompere nulla.

### Task 1.1: Aggiungere nuove copy key in `system.ts`

**File**: `apps/frontend/src/app/copy/system.ts`

**Modifiche**:

1. In `appCopy.editorial.dashboard` (dopo `cards.recentSessions.title`, linea ~989), aggiungere le nuove key del Hero (§10.3 proposal):

```ts
eyebrow: 'Welcome back',
heroHeadlineResume: (toolLabel: string) => `Continue with ${toolLabel}`,
heroHeadlineChoose: 'Choose a workspace to continue',
heroSubtitleResume: (workspaceName: string) => `Pick up where you left off in ${workspaceName}.`,
heroSubtitleChoose: 'Select a workspace to start generating or complete its Foundation.',
heroCtaResume: (toolLabel: string) => `Resume ${toolLabel}`,
heroCtaChoose: 'Choose a workspace',
recentActivityTitle: 'Recent activity',
```

2. In `appCopy.ui.states` (dopo `loadingProjects`, linea ~385), aggiungere:

```ts
loadingDashboard: 'Loading dashboard...',
```

3. Aggiungere nuovo namespace `appCopy.ui.dashboard` dopo `appCopy.ui.workspace` (chiudendo `}`, linea ~933):

```ts
dashboard: {
  foundationSummaryTitle: 'Foundation across workspaces',
  foundationSummaryFraction: (present: number, total: number) => `${present}/${total} workspaces`,
  foundationSummaryFooterLink: 'Complete Foundation \u2192',
  recommendedActionsTitle: 'Recommended next actions',
  recommendedActionsEmpty: 'All caught up \u2014 every recent workspace has what it needs.',
  recommendedActionUseLabel: 'Use \u2192',
  recommendedActionWorkspaceLabel: (name: string) => `in ${name}`,
  activeWorkspacesTitle: 'Your workspaces',
  activeWorkspacesFooterLink: 'View all workspaces',
},
```

**QA**:
- Tool: `npm --workspace apps/frontend run typecheck` — deve passare
- Steps: verificare che `system.ts` sia valido TypeScript senza errori di sintassi
- Expected: typecheck passa, nessun errore su `appCopy.ui.dashboard` o `appCopy.editorial.dashboard`

---

### Task 1.2: Creare `useDashboardOverview` hook

**File**: `apps/frontend/src/features/dashboard/runtime/useDashboardOverview.ts` (**NUOVO**)

Creare la directory `runtime/` sotto `features/dashboard/` se non esiste.

**Contenuto**: hook di composizione che combina:

1. `useProjectsQuery({ apiBaseUrl, capabilities })` — lista workspace
2. `useSessionsQuery({ apiBaseUrl, capabilities })` — sessioni cross-workspace (unscoped, `projectId` omesso)

**Nota**: `useSessionsQuery` supporta già chiamate unscoped — quando `projectId` è omesso, `listSessions({})` restituisce tutte le sessioni (verificato in `useSessionsQuery.ts:22-23`, `listSessions` riceve `{}` quando projectIdKey è vuoto).

3. Per i **top K=5 workspace** per `updatedAt` recency (dalla lista `ProjectSummary[]` già fetchata), chiamare:
   - `useWorkspaceContext(project.id)` — restituisce `assets`, `foundationTools`, `gaps`, `workflowPosition`, `qualityGateStatus`, `overallQualityScore`
   - `useToolRecommendations(project.id, 'member', 5)` — restituisce `ToolRecommendation[]` con readiness/impact/priority score

**Problema noto**: `useWorkspaceContext` e `useToolRecommendations` sono React hooks — non possono essere chiamati in un loop dinamico (violation delle Rules of Hooks). **Soluzione**: il hook `useDashboardOverview` deve limitarsi a invocare questi hooks per un **numero fisso di workspace** (es. 5 slots, inizializzati a null/id, poi popolati con i primi 5 workspace ID dopo il primo render via `useEffect` + `useState`). Pattern alternativo: usare `useMemo` per derivare i top-5 ID e renderizzare 5 sotto-componenti ciascuno col proprio `useWorkspaceContext` — ma questo sposta la composizione nel componente, non nel hook.

**Decisione architetturale**: implementare `useDashboardOverview` come **coordinatore** che:

```ts
// useDashboardOverview orchestrates existing hooks into a single read-model.
// NOTE: This hook calls useWorkspaceContext/useToolRecommendations for the top-K
// workspaces via a fixed array of workspace IDs managed in state.

export const useDashboardOverview = (): DashboardOverviewData => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const projectsQuery = useProjectsQuery({ apiBaseUrl, capabilities });
  const sessionsQuery = useSessionsQuery({ apiBaseUrl, capabilities });

  // Top K=5 workspace IDs, sorted by updatedAt desc
  const topWorkspaceIds = useMemo(() => {
    if (!projectsQuery.data) return [];
    return projectsQuery.data
      .filter(p => p.status !== 'archived')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(p => p.id);
  }, [projectsQuery.data]);

  // Fixed array of 5 slots for workspace context hooks
  const ws0 = useWorkspaceContext(topWorkspaceIds[0] ?? '');
  const ws1 = useWorkspaceContext(topWorkspaceIds[1] ?? '');
  const ws2 = useWorkspaceContext(topWorkspaceIds[2] ?? '');
  const ws3 = useWorkspaceContext(topWorkspaceIds[3] ?? '');
  const ws4 = useWorkspaceContext(topWorkspaceIds[4] ?? '');
  const workspaceContexts = [ws0, ws1, ws2, ws3, ws4];

  // Fixed array of 5 slots for tool recommendation hooks
  const rec0 = useToolRecommendations(topWorkspaceIds[0] ?? '', 'member', 3);
  const rec1 = useToolRecommendations(topWorkspaceIds[1] ?? '', 'member', 3);
  const rec2 = useToolRecommendations(topWorkspaceIds[2] ?? '', 'member', 3);
  const rec3 = useToolRecommendations(topWorkspaceIds[3] ?? '', 'member', 3);
  const rec4 = useToolRecommendations(topWorkspaceIds[4] ?? '', 'member', 3);
  const recommendationSets = [rec0, rec1, rec2, rec3, rec4];

  // ... derive resumeCandidate, foundationSummary, recommendations, recentSessions, activeWorkspaces
};
```

**NOTA IMPORTANTE**: `useWorkspaceContext` quando riceve `workspaceId` vuoto `''` restituisce `{ loading: false, error: null, assets: [], ... }` (guard clause in `useWorkspaceContext.ts:98-101` — `if (!workspaceId || hasToolKey) return;` in `useEffect`, e `useAssetSuggestions` è `enabled` solo con projectId non-null). Quindi i 5 slot iniziali a `''` sono sicuri — non producono chiamate API errate.

Allo stesso modo, `useToolRecommendations('')` restituisce `[]` (guard in `useToolRecommendations.ts:28` — `if (!workspaceId || ctx.loading || !ctx.workflowPosition) return []`).

**Derivazione output**:

```ts
const resumeCandidate = useMemo(() => {
  const sessions = sessionsQuery.data ?? [];
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const latest = sorted[0];
  if (!latest) return null;
  const project = projectsQuery.data?.find(p => p.id === latest.projectId);
  if (!project) return null;
  return {
    workspaceId: project.id,
    workspaceName: project.name,
    toolKey: latest.toolKey ?? '',
    toolLabel: getToolLabel(latest.toolKey),
    sessionId: latest.sessionId,
  };
}, [sessionsQuery.data, projectsQuery.data]);
```

**Type output** (UI-layer, non domain):

```ts
export interface WorkspaceToolRecommendation extends ToolRecommendation {
  workspaceId: string;
  workspaceName: string;
}

export interface DashboardOverviewData {
  loading: boolean;
  error: string | null;
  resumeCandidate: {
    workspaceId: string;
    workspaceName: string;
    toolKey: string;
    toolLabel: string;
    sessionId: string;
  } | null;
  foundationSummary: {
    toolKey: string;
    label: string;
    workspacesWithAsset: number;
    totalWorkspaces: number;
  }[];
  recommendations: WorkspaceToolRecommendation[];
  recentSessions: SessionSummary[];
  activeWorkspaces: {
    id: string;
    name: string;
    qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  }[];
  mostGappedWorkspaceId: string | null;
}
```

**Foundation tools constant** (riusare il set già definito in `useWorkspaceContext.ts:145-149`):
```ts
const FOUNDATION_TOOL_KEYS = new Set<string>(['brief-generator', 'tov-generator', 'personas-generator']);
```

**Aggregazione foundationSummary**: per ogni Foundation tool key, contare in quanti workspace (tra i 5 scansionati) `hasAssets === true`.

**Aggregazione recommendations**: concatenare i `ToolRecommendation[]` da tutti e 5 i workspace, aggiungere `workspaceId`/`workspaceName`, ordinare per `priorityScore desc`, prendere top 5.

**Aggregazione activeWorkspaces**: mappare `topWorkspaceIds` con nomi da `ProjectSummary[]` e `qualityGateStatus` da `useWorkspaceContext`.

**mostGappedWorkspaceId**: il workspace con il maggior numero di Foundation gaps (il primo in ordine di gap count).

**QA**:
- Tool: `npm --workspace apps/frontend run typecheck` — deve passare
- Tool: `node --import tsx --test` non applicabile (FE), usare `npm --workspace apps/frontend run test` — test separatamente
- Steps: creare un test `useDashboardOverview.test.ts` con mock di `useProjectsQuery`, `useSessionsQuery`, `useWorkspaceContext`, `useToolRecommendations`
- Expected: typecheck passa, test passa, hook restituisce dati aggregati corretti

---

### Task 1.3: Creare `DashboardHeroPanel`

**File**: `apps/frontend/src/features/dashboard/ui/DashboardHeroPanel.tsx` (**NUOVO**)

**Props**:
```ts
interface DashboardHeroPanelProps {
  resumeCandidate: DashboardOverviewData['resumeCandidate'];
  loading: boolean;
}
```

**Rendering**:
- `loading === true`: skeleton inline (3 righe `<Skeleton variant="text">` MUI — già usato in altri pannelli workspace)
- `resumeCandidate` presente: headline = `appCopy.editorial.dashboard.heroHeadlineResume(toolLabel)`, subtitle = `appCopy.editorial.dashboard.heroSubtitleResume(workspaceName)`, CTA = `appCopy.editorial.dashboard.heroCtaResume(toolLabel)` → `/workspaces/{workspaceId}/tools/{toolKey}`
- `resumeCandidate === null`: headline = `appCopy.editorial.dashboard.heroHeadlineChoose`, subtitle = `appCopy.editorial.dashboard.heroSubtitleChoose`, CTA = `appCopy.editorial.dashboard.heroCtaChoose` → `/workspaces`

**CTA**: `<Link to={route} className={uiPrimitives.button}>` (Pattern A, §4b UL Spec)

**Accessibilità**: il blocco dinamico headline+subtitle è wrappato in `<div role="status" aria-live="polite">` (§8.2 proposal).

**Import**:
```ts
import { Link } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
```

**CSS class**: `.dashboard-hero`, `.dashboard-hero__headline`, `.dashboard-hero__subtitle`, `.dashboard-hero__cta` (definite in Task 1.8).

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardHeroPanel`
- Steps: render con `resumeCandidate` presente, verificare CTA href; render con `resumeCandidate === null`, verificare fallback CTA; render con `loading === true`, verificare skeleton
- Expected: 3 test passano, CTA usa `uiPrimitives.button`, aria-live è presente

---

### Task 1.4: Creare `DashboardFoundationSummaryPanel`

**File**: `apps/frontend/src/features/dashboard/ui/DashboardFoundationSummaryPanel.tsx` (**NUOVO**)

**Props**:
```ts
interface DashboardFoundationSummaryPanelProps {
  foundationSummary: DashboardOverviewData['foundationSummary'];
  mostGappedWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
}
```

**Rendering**: wrapper `DashboardPanel` con title `appCopy.ui.dashboard.foundationSummaryTitle`, props `loading`/`error`.

Corpo: `.dashboard-foundation-summary__row` con 3 `.foundation-status__item`:
- Riutilizza le classi CSS da `dashboard-panels.css` (`.foundation-status__item`, `__icon`, `__label`, `__indicator--present/missing`)
- Per ogni Foundation tool: icona lucide (`FileText`/`Mic`/`Users`), label canonica (`appCopy.ui.workspace.dashboard.foundationLabelBrief` etc.), frazione aggregata `{workspacesWithAsset}/{totalWorkspaces}` (usa `appCopy.ui.dashboard.foundationSummaryFraction`)
- Se `workspacesWithAsset === 0`: indicator con `AlertTriangle` + testo "0/{N}"
- Se `workspacesWithAsset > 0`: indicator con `CheckCircle` + testo "{n}/{N}"

Footer: `<Link to={route} className={uiPrimitives.inlineLink}>` → `appCopy.ui.dashboard.foundationSummaryFooterLink`
- Route: `/workspaces/{mostGappedWorkspaceId}` (o la route del Foundation tool nel workspace più gap-pato)

**NOTA**: `DashboardPanel` è importato da `features/workspace/ui/dashboard/DashboardPanel.tsx` — cross-feature import, accettato dalla proposal §5.2.

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardFoundationSummaryPanel`
- Steps: render con 2/5 workspaces con Brief, verificare frazione; render con loading, verificare DashboardPanel loading state
- Expected: frazione corretta, foundation-status classi riutilizzate

---

### Task 1.5: Creare `DashboardRecommendedActionsPanel`

**File**: `apps/frontend/src/features/dashboard/ui/DashboardRecommendedActionsPanel.tsx` (**NUOVO**)

**Props**:
```ts
interface DashboardRecommendedActionsPanelProps {
  recommendations: WorkspaceToolRecommendation[];
  loading: boolean;
  error: string | null;
}
```

**Rendering**: wrapper `DashboardPanel` con title `appCopy.ui.dashboard.recommendedActionsTitle`, props `loading`/`error`.

Empty: `appCopy.ui.dashboard.recommendedActionsEmpty`.

Corpo: `.dashboard-item-row` × N (massimo 5):
- `__primary`: `rec.label` (nome tool)
- `__meta`: `rec.reason` + `appCopy.ui.dashboard.recommendedActionWorkspaceLabel(rec.workspaceName)`
- Action: `<Link to={rec.to} className={uiPrimitives.inlineLink}>` → `appCopy.ui.dashboard.recommendedActionUseLabel`

**Nota su `rec.to`**: `useToolRecommendations` produce `item.to` come route del tool nel workspace. Verificare che il formato sia `/workspaces/{workspaceId}/tools/{toolKey}` — controllare `getEnabledToolNavigationItems` in `tool-form-architecture.ts`.

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardRecommendedActionsPanel`
- Steps: render con 3 recommendations, verificare row rendering; render con array vuoto, verificare empty state
- Expected: rows renderizzate con label, reason, workspace name, CTA link

---

### Task 1.6: Creare `DashboardRecentActivityPanel`

**File**: `apps/frontend/src/features/dashboard/ui/DashboardRecentActivityPanel.tsx` (**NUOVO**)

**Props**:
```ts
interface DashboardRecentActivityPanelProps {
  sessions: SessionSummary[];
  projectNameById: Map<string, string>;
  loading: boolean;
  error: string | null;
}
```

**Rendering**: wrapper `DashboardPanel` con title `appCopy.editorial.dashboard.recentActivityTitle`, props `loading`/`error`.

Empty: `appCopy.editorial.sessions.emptyState` (riusato).

Corpo: `.dashboard-item-row` × N (massimo 5, già sliced da `useDashboardOverview`):
- `__primary`: `getToolLabel(session.toolKey)`
- `__meta`: `{projectName} · {artifactCountLabel} · {relativeTime}` (riusando `formatRelativeTime` da `app/ui/format-utils.ts`)
- `__badge`: `<StatusBadge status={session.status} />` (da `app/ui/StatusBadge.tsx`, NON MUI `Chip`)

Footer: `<Link to="/workspaces" className={uiPrimitives.inlineLink}>` → `appCopy.ui.workspace.dashboard.viewAllSessionsArrow`

**Nota**: il footer punta a `/workspaces` (Hub) perché non esiste una route cross-workspace per le sessioni. La proposta §12 Phase 2 anticipa una vista sessioni aggregate futura.

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardRecentActivityPanel`
- Steps: render con 3 sessions, verificare row con tool label + project name + status badge; render empty
- Expected: StatusBadge usato (non MUI Chip), formatRelativeTime chiamato

---

### Task 1.7: Creare `DashboardActiveWorkspacesPanel`

**File**: `apps/frontend/src/features/dashboard/ui/DashboardActiveWorkspacesPanel.tsx` (**NUOVO**)

**Props**:
```ts
interface DashboardActiveWorkspacesPanelProps {
  activeWorkspaces: DashboardOverviewData['activeWorkspaces'];
  loading: boolean;
  error: string | null;
}
```

**Rendering**: wrapper `DashboardPanel` con title `appCopy.ui.dashboard.activeWorkspacesTitle`, props `loading`/`error`.

Corpo: `.dashboard-workspace-chip-row` con `.dashboard-workspace-chip` per ogni workspace:
- Nome workspace
- Indicatore colore via `.dashboard-workspace-chip__status--{status}` (punto colorato o colore testo)
- Il chip è un `<Link to={/workspaces/{id}}>` con `className="dashboard-workspace-chip"`

Footer: `<Link to="/workspaces" className={uiPrimitives.button}>` → `appCopy.ui.dashboard.activeWorkspacesFooterLink` (Pattern A — è l'escape-hatch primario del pannello)

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardActiveWorkspacesPanel`
- Steps: render con 3 workspace (1 healthy, 1 needs-attention, 1 blocked), verificare chips con status corretti; verificare footer CTA
- Expected: chips cliccabili, footer usa `uiPrimitives.button`

---

### Task 1.8: Aggiungere CSS in `dashboard-panels.css`

**File**: `apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css`

Appendere le seguenti classi alla fine del file (prima di eventuali media query responsive):

```css
/* ── Dashboard Hero (cross-workspace action anchor) ── */

.dashboard-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  padding: var(--space-3) 0;
}

.dashboard-hero__headline {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin: 0;
}

.dashboard-hero__subtitle {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 0;
  max-width: 640px;
}

.dashboard-hero__cta {
  margin-top: var(--space-1);
}

/* ── Foundation Summary (aggregate fraction row) ── */

.dashboard-foundation-summary__row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.dashboard-foundation-summary__fraction {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Recommended Action row (extends .dashboard-item-row) ── */

.dashboard-recommendation__reason {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: normal;
}

.dashboard-recommendation__workspace {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Active Workspaces chip row ── */

.dashboard-workspace-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1-5);
}

.dashboard-workspace-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-1-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-chip);
  background: var(--surface-base);
  font-size: 0.8rem;
  color: var(--text-primary);
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.dashboard-workspace-chip:hover {
  background: var(--interactive-hover);
  border-color: var(--border-strong);
}

.dashboard-workspace-chip:focus-visible {
  outline: 2px solid var(--workspace-blue);
  outline-offset: 2px;
}

.dashboard-workspace-chip__status--healthy { color: var(--success-pine); }
.dashboard-workspace-chip__status--needs-attention { color: var(--warning-amber); }
.dashboard-workspace-chip__status--blocked { color: var(--error-fg, var(--warning-amber)); }
```

**Verifica**: ogni valore `var(--*)` è definito in `:root` di `styles.css` — verificato in Fase 0.

**QA**:
- Tool: `npm --workspace apps/frontend run typecheck` + ispezione manuale CSS
- Steps: verificare che ogni `var(--*)` usato esista in `styles.css :root`
- Expected: nessun valore hardcoded, tutti i token risolti

---

### Task 1.9: Verifica Fase 1

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
```

Entrambi devono passare. La DashboardPage attuale non è stata toccata — nessun regressione possibile.

---

## Fase 2 — Rifattorizzazione DashboardPage

### Task 2.1: Riscrivere `DashboardPage.tsx`

**File**: `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx`

**Rimosso** (righe attuali):
- Riga 3: `import { Link, useSearchParams } from 'react-router-dom'` → `Link` resta (usato nel zero-state), `useSearchParams` rimosso (non più necessario se `previewZeroState` rimosso)
- Riga 7: `import { Surface, TopBar, uiPrimitives }` → `Surface` e `TopBar` rimossi (non più usati)
- Riga 8: `import { getToolLabel }` → rimosso (spostato in `useDashboardOverview`)
- Riga 10: `import { DashboardPanel }` → rimosso (ora usato dai sotto-componenti)
- Riga 12: `const formatSessionToolName` → rimosso (incorporato in sotto-componenti)
- Righe 54-76: blocco KPI `TopBar` → **rimosso**
- Righe 78-99: due card statiche `DashboardPanel` ("Your strategies" / "Generation for your strategy") → **rimosso**
- Righe 101-124: raw `<ul>`/`.ui-dashboard-session-link` recent sessions → **rimosso**

**Mantenuto**:
- Zero-state block (righe 34-47) — invariato
- `useProjectsQuery` (serve per `hasNoProjects`)
- `appCopy.editorial.dashboard.zeroState.*`

**Nuova struttura**:
```tsx
import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { Surface, uiPrimitives, LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { useDashboardOverview } from '../runtime/useDashboardOverview';
import { DashboardHeroPanel } from '../ui/DashboardHeroPanel';
import { DashboardFoundationSummaryPanel } from '../ui/DashboardFoundationSummaryPanel';
import { DashboardRecommendedActionsPanel } from '../ui/DashboardRecommendedActionsPanel';
import { DashboardRecentActivityPanel } from '../ui/DashboardRecentActivityPanel';
import { DashboardActiveWorkspacesPanel } from '../ui/DashboardActiveWorkspacesPanel';

export const DashboardPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const projectsQuery = useProjectsQuery({ apiBaseUrl, capabilities });
  const overview = useDashboardOverview();

  const hasNoProjects = !projectsQuery.loading && !projectsQuery.error && projectsQuery.data.length === 0;

  if (hasNoProjects) {
    return (
      <Surface as="section" className="ui-dashboard-zero-state">
        <div className="ui-dashboard-zero-state-inner">
          <p className={uiPrimitives.metaLine}>{appCopy.editorial.dashboard.zeroState.eyebrow}</p>
          <h2>{appCopy.editorial.dashboard.zeroState.headline}</h2>
          <p>{appCopy.editorial.dashboard.zeroState.body}</p>
          <Link to="/workspaces" className={uiPrimitives.button}>
            {appCopy.editorial.dashboard.zeroState.cta}
          </Link>
        </div>
      </Surface>
    );
  }

  if (overview.loading) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <LoadingStateMessage>{appCopy.ui.states.loadingDashboard}</LoadingStateMessage>
      </Surface>
    );
  }

  if (overview.error) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <ErrorStateMessage>{overview.error}</ErrorStateMessage>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <DashboardHeroPanel
        resumeCandidate={overview.resumeCandidate}
        loading={overview.loading}
      />
      <DashboardFoundationSummaryPanel
        foundationSummary={overview.foundationSummary}
        mostGappedWorkspaceId={overview.mostGappedWorkspaceId}
        loading={overview.loading}
        error={overview.error}
      />
      <section className={uiPrimitives.dashboardGrid}>
        <DashboardRecommendedActionsPanel
          recommendations={overview.recommendations}
          loading={overview.loading}
          error={overview.error}
        />
        <DashboardRecentActivityPanel
          sessions={overview.recentSessions}
          projectNameById={
            new Map(projectsQuery.data.map((p) => [p.id, p.name]))
          }
          loading={overview.loading}
          error={overview.error}
        />
      </section>
      <DashboardActiveWorkspacesPanel
        activeWorkspaces={overview.activeWorkspaces}
        loading={overview.loading}
        error={overview.error}
      />
    </Surface>
  );
};
```

**QA**:
- Tool: `npm --workspace apps/frontend run typecheck`
- Steps: verificare che DashboardPage compili senza errori
- Expected: typecheck passa

---

### Task 2.2: Aggiornare `DashboardPage.test.tsx`

**File**: `apps/frontend/src/features/dashboard/pages/DashboardPage.test.tsx`

**Rimosso**:
- Mock di `useSessionsQuery` (non più necessario — il test non lo usa più direttamente)
- Assertion righe 74-80: `expect(screen.getByRole('link', { name: appCopy.ui.navigation.tools }))` → lock-in della duplicazione rimosso

**Mantenuto**: mock di `useProjectsQuery` — la nuova `DashboardPage` lo usa ancora direttamente per la gate `hasNoProjects`

**Nuovo mock**: aggiungere mock di `useDashboardOverview`:
```ts
vi.mock('../runtime/useDashboardOverview', () => ({
  useDashboardOverview: () => dashboardOverviewState,
}));
```

Dove `dashboardOverviewState` è un hoisted object con campi:
```ts
const dashboardOverviewState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
  resumeCandidate: null as any,
  foundationSummary: [] as any[],
  recommendations: [] as any[],
  recentSessions: [] as any[],
  activeWorkspaces: [] as any[],
  mostGappedWorkspaceId: null as string | null,
}));
```

**Nuovi test**:
1. `renders dashboard heading` — test che Hero renderizza il headline (attualmente testa `appCopy.editorial.dashboard.headline` che verrà rimosso → testare `appCopy.editorial.dashboard.heroHeadlineChoose` o il resume headline)
2. `shows resume CTA when resumeCandidate is present` — mock `resumeCandidate` con dati, verificare CTA link href
3. `shows foundation summary` — mock `foundationSummary` con 3 entries, verificare frazioni
4. `shows recommended actions` — mock `recommendations` con 2 entries, verificare rows
5. `shows zero state when no projects` — invariato
6. `shows loading state` — mock `loading: true`, verificare `appCopy.ui.states.loadingDashboard`

**NOTA**: import `appCopy.ui.navigation.tools` non più necessario nel test (nessun link "Tools" più renderizzato).

**QA**:
- Tool: `npm --workspace apps/frontend run test -- DashboardPage`
- Expected: tutti i test passano

---

### Task 2.3: Verifica Fase 2

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test -- DashboardPage
npm --workspace apps/frontend run build
```

Tutti devono passare.

**QA manuale** (dopo build):
- Navigare a `/dashboard` con browser, verificare:
  - Hero mostra CTA "Choose a workspace" (o "Resume" se ci sono sessioni recenti)
  - Foundation Summary mostra frazioni corrette
  - Recommended Actions mostra tool pronti
  - Recent Activity mostra sessioni con workspace name
  - Active Workspaces mostra chips cliccabili
  - Zero-state funziona (nessun workspace)
  - Dark mode: tutti i colori sono token-based, nessun hardcoded color
  - Keyboard navigation: Tab naviga Hero → Foundation → Recommended → Recent → Active → footer CTA
  - Responsive: a 760px, il grid 2-col collassa a 1-col

---

## Fase 3 — Cleanup

### Task 3.1: Rimuovere dead components

- [ ] Eliminare `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.tsx`
- [ ] Eliminare `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.test.tsx`
- [ ] Eliminare `apps/frontend/src/features/workspace/ui/dashboard/RecentActivityPanel.tsx`
- [ ] Verificare con grep che non ci siano import residui:
  ```bash
  grep -r "FoundationToolsPanel\|RecentActivityPanel" apps/frontend/src --include="*.tsx" --include="*.ts"
  ```

**QA**: `npm --workspace apps/frontend run typecheck` passa.

---

### Task 3.2: Rimuovere copy obsolete da `system.ts`

**File**: `apps/frontend/src/app/copy/system.ts`

Rimuovere da `appCopy.editorial.dashboard`:
- `headline` (sostituito da `heroHeadlineResume`/`heroHeadlineChoose`)
- `body` (non più renderizzato)
- `stats` array (rimosso — KPI topbar eliminato)
- `cards.projects.title`, `cards.projects.body` (card statica rimossa)
- `cards.tools.title`, `cards.tools.body` (card statica rimossa)
- `cards.recentSessions.title` (rinominato in `recentActivityTitle`)

**Mantenere**: `zeroState.*` (invariato), `eyebrow`, `heroHeadline*`, `heroSubtitle*`, `heroCta*`, `recentActivityTitle`.

**Verifica**: grep per ogni key rimossa, confermare zero riferimenti:
```bash
grep -r "editorial\.dashboard\.headline\|editorial\.dashboard\.body\|editorial\.dashboard\.stats\|editorial\.dashboard\.cards" apps/frontend/src --include="*.tsx" --include="*.ts"
```

**QA**: `npm --workspace apps/frontend run typecheck` passa.

---

### Task 3.3: Rimuovere CSS obsolete da `styles.css`

**File**: `apps/frontend/src/styles.css`

Dopo grep di conferma zero riferimenti residui:

1. Rimuovere `.ui-dashboard-kpi-topbar` (righe ~2221-2225)
2. Rimuovere `.ui-dashboard-kpi-item` (righe ~2227-2247)
3. **NON** rimuovere `.ui-kpi-label` — verificare con grep se è usato altrove (AdminDashboardPage usa `ui-kpi-value` a :85, non `ui-kpi-label`; possibile dead code ma non confermato)
4. Rimuovere `.ui-dashboard-card` e varianti (righe ~2352-2404)
5. Rimuovere `.ui-dashboard-session-link` (righe ~2406-2422)
6. Rimuovere i media query associati nel blocco responsive (righe ~2425-2440)
7. **NON** rimuovere `.ui-dashboard-zero-state*` (invariato, usato)
8. **NON** rimuovere `.ui-dashboard-grid` (riusato dalla nuova layout)

**Verifica prima di ogni rimozione**:
```bash
grep -r "ui-dashboard-kpi-topbar\|ui-dashboard-kpi-item\|ui-dashboard-card\|ui-dashboard-session-link" apps/frontend/src --include="*.tsx" --include="*.ts" --include="*.css"
```

Se un class ha riferimenti residui, NON rimuoverla.

**QA**: `npm --workspace apps/frontend run typecheck && npm --workspace apps/frontend run build` passano.

---

### Task 3.4: Verifica finale

```bash
npm run typecheck        # tutti i workspace
npm --workspace apps/frontend run test
npm --workspace apps/frontend run build
```

**QA manuale finale**:
- `/dashboard` funziona correttamente in tutti gli stati (loading, error, zero-state, ready)
- `/workspaces` non è stato toccato (Hub funziona come prima)
- `/workspaces/:id` non è stato toccato (WorkspaceDashboard funziona come prima)
- Dark mode: tutti i token si risolvono correttamente
- Keyboard navigation completa
- axe audit: `npm --workspace apps/frontend run test:admin-a11y` (o equivalente per `/dashboard`)

---

## Riepilogo file

| # | File | Azione | Fase |
|---|------|--------|------|
| 1 | `features/dashboard/runtime/useDashboardOverview.ts` | **NUOVO** | 1 |
| 2 | `features/dashboard/ui/DashboardHeroPanel.tsx` | **NUOVO** | 1 |
| 3 | `features/dashboard/ui/DashboardFoundationSummaryPanel.tsx` | **NUOVO** | 1 |
| 4 | `features/dashboard/ui/DashboardRecommendedActionsPanel.tsx` | **NUOVO** | 1 |
| 5 | `features/dashboard/ui/DashboardRecentActivityPanel.tsx` | **NUOVO** | 1 |
| 6 | `features/dashboard/ui/DashboardActiveWorkspacesPanel.tsx` | **NUOVO** | 1 |
| 7 | `features/workspace/ui/dashboard/dashboard-panels.css` | **ESTESO** | 1 |
| 8 | `app/copy/system.ts` | **MODIFICATO** (add + remove) | 1 + 3 |
| 9 | `features/dashboard/pages/DashboardPage.tsx` | **RIFATTORIZZATO** | 2 |
| 10 | `features/dashboard/pages/DashboardPage.test.tsx` | **AGGIORNATO** | 2 |
| 11 | `styles.css` | **MODIFICATO** (rimozioni CSS) | 3 |
| 12 | `features/workspace/ui/dashboard/FoundationToolsPanel.tsx` | **RIMOSSO** | 3 |
| 13 | `features/workspace/ui/dashboard/FoundationToolsPanel.test.tsx` | **RIMOSSO** | 3 |
| 14 | `features/workspace/ui/dashboard/RecentActivityPanel.tsx` | **RIMOSSO** | 3 |

## Fuori scope (deferiti)

- Migrazione MUI `Chip` → `StatusBadge` in `ContextualToolsPanel.tsx` (ticket separato)
- Relocation `DashboardPanel.tsx` da `workspace/` a `app/ui/` (ticket separato)
- Endpoint batch server-side `GET /api/projects/overview` (Phase 2, trigger differito)
- Vista sessioni aggregate cross-workspace (Phase 2, footer "View all sessions" punta a `/workspaces` per ora)

## Open Questions (dalla proposal §13)

1. `WorkspaceToolRecommendation` come tipo UI-layer — conferma governance (non richiede DDD entry)
2. Endpoint batch — definire metrica trigger (es. p95 load time > Xms con ≥10 workspaces)
3. `.dashboard-workspace-chip` classification Pattern B — conferma Frontend Platform Team
4. `DashboardPanel` location — cross-feature import accettato per ora
5. `ContextualToolsPanel.tsx` MUI Chip migration — ticket separato
6. Recommended Actions: mischiare Foundation e non-Foundation nello stesso pannello? (proposal dice sì)
