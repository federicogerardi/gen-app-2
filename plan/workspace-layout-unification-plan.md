---
status: approved
version: 2.1
date_created: 2026-07-19
last-reviewed: 2026-07-19
next-review-date: 2026-08-19
owner: Frontend Platform
type: plan
tags:
  - plan
  - frontend
  - workspace
  - layout
  - navigation
  - breadcrumb
  - unification
  - ux
goal: >
  Transform /workspaces/:workspaceId/* into a unified layout with cross-section
  navigation, centralized project-level context fetching, and UX improvements that
  prioritize real user utility — no AI slop, no fake metrics, no over-engineered
  layouting.
validation: >
  momus-reviewed — 3 critical gaps resolved. UX-reviewed — 4 priority levels addressed
  (P0 header/route fixes, P1 fake metric removal, P2 AI-slop copy cleanup, P3 design
  token alignment). expert-react-frontend-engineer-reviewed — 6 fixes applied: P0
  blocking early-return removed (always render Outlet), P1 appCopy for SECTION_LABELS,
  P2 dedicated CSS class for asset items + DashboardPanel wrapper for RecentArtifactsPanel,
  P3 renaming .section-nav → .workspace-section-nav + dead code notation + missing
  .workspace-layout CSS definition.
---

# Plan: Unified `workspaces/[id]` Layout — Governance Hub

**Objective**: Transform `/workspaces/:workspaceId/*` into a consistent, app-unified page where the user governs every workspace from a central hub with rapid cross-section navigation (Overview, Assets, Sessions). Every piece of UI that reaches the user must be real data, not AI-generated filler.

**Guiding principle**: Show the user what they actually have, what they actually did, and what they can actually do next — no invented metrics, no placeholder copy, no panels that stay prominent after they've served their purpose.

---

## 1. Target Architecture — Two Context Layers + Route-Aware Rendering

The workspace has **two distinct context layers**:

| Layer | Data | Source | Consumers |
|-------|------|--------|-----------|
| **Project-Layer** (shared) | Project name, status (`active`/`archived`), `workspaceId` | `useProjectDetailQuery(workspaceId)` | Header breadcrumb, archived banner, all sub-routes |
| **Workspace-Layer** (section-specific) | Assets, quality gate, gaps, workflow position | `useWorkspaceContext(workspaceId, toolKey?)` with `toolKey` only for tool pages | Dashboard, Assets page, Tool pages |

**Why two layers**: `useWorkspaceContext` with `toolKey` fetches tool-compatible assets (via `useAssetSuggestions`); without `toolKey` it fetches ALL project assets. Forcing tool pages to use the context without `toolKey` would break compatibility filtering and degrade performance.

### Route-Aware Rendering Logic

`WorkspaceLayout` uses `useMatch` to determine what to render:

| Route Pattern | Header | SectionNav | Notes |
|---|---|---|---|
| `/workspaces/:id` (dashboard) | Hidden | Visible | Dashboard hero already shows project name |
| `/workspaces/:id/assets` | Visible (`currentSection="assets"`) | Visible | Breadcrumb: Workspaces / Project / Assets |
| `/workspaces/:id/sessions` | Visible (`currentSection="sessions"`) | Visible | Breadcrumb: Workspaces / Project / Sessions |
| `/workspaces/:id/tools/:toolKey` | Hidden (rendered by `WorkspaceToolWrapper`) | Hidden | Tool pages have own header with tool-specific context |
| `/workspaces/:id/sessions/:sessionId` | Hidden | Hidden | Autonomous two-column detail layout per UI governance spec |

```
AuthenticatedShell (MainNavigation sidebar, existing)
  └── WorkspaceLayout  ← NEW, wraps all sub-routes
      ├── WorkspaceProjectProvider (project-layer: name, isArchived, workspaceId)
      ├── Archived banner (centralized here, removed from WorkspaceDashboard)
      ├── WorkspaceContextHeader (conditional — NOT on dashboard, tools, session detail)
      ├── WorkspaceSectionNav  ← NEW, conditional (only on Overview, Assets, Sessions)
      └── <main className="workspace-layout__content">
            <Outlet />
          </main>
```

Sub-pages consume `useWorkspaceProject()` for shared data and manage their own `useWorkspaceContext()` calls with appropriate parameters.

---

## 2. Implementation Plan (7 Tracks)

### Track 1 — `WorkspaceProjectContext` + `useWorkspaceProject`

**File**: `apps/frontend/src/features/workspace/runtime/WorkspaceProjectContext.tsx` (CREATE)

Lightweight context for project-level data shared by all sub-routes.

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface WorkspaceProjectData {
  workspaceId: string;
  projectName: string;
  isArchived: boolean;
  isProjectLoading: boolean;
  projectError: string | null;
  refetchProject: () => void;
}

const WorkspaceProjectContext = createContext<WorkspaceProjectData | null>(null);

export const WorkspaceProjectProvider: React.FC<{
  value: WorkspaceProjectData;
  children: ReactNode;
}> = ({ value, children }) => {
  const contextValue = useMemo(() => value, [
    value.workspaceId, value.projectName, value.isArchived,
    value.isProjectLoading, value.projectError, value.refetchProject,
  ]);
  return (
    <WorkspaceProjectContext.Provider value={contextValue}>
      {children}
    </WorkspaceProjectContext.Provider>
  );
};

export const useWorkspaceProject = (): WorkspaceProjectData => {
  const ctx = useContext(WorkspaceProjectContext);
  if (!ctx) {
    throw new Error('useWorkspaceProject must be used within WorkspaceLayout');
  }
  return ctx;
};
```

**P0 fix**: The header renders inside the provider, so `useWorkspaceProject()` is always called from a valid context. No try-catch anti-pattern.

---

### Track 2 — `WorkspaceSectionNav` (Cross-Section Navigation)

**File**: `apps/frontend/src/features/workspace/ui/WorkspaceSectionNav.tsx` (CREATE)

Pill navigation: **Overview** | **Assets** | **Sessions**. Uses `NavLink` for automatic active-state highlighting. Rendered by `WorkspaceLayout` conditionally (not on tool routes or session detail).

```tsx
import { NavLink, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';

const SECTIONS = [
  { to: '',           labelKey: 'overview',  end: true },
  { to: 'assets',     labelKey: 'assets',    end: false },
  { to: 'sessions',   labelKey: 'sessions',  end: false },
];

export const WorkspaceSectionNav: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const labels = appCopy.ui.workspace?.sectionNav;

  return (
    <nav className="workspace-section-nav" role="tablist" aria-label={labels?.label ?? 'Workspace sections'}>
      {SECTIONS.map(section => (
        <NavLink
          key={section.to}
          to={section.to
            ? `/workspaces/${workspaceId}/${section.to}`
            : `/workspaces/${workspaceId}`}
          end={section.end}
          className={({ isActive }) =>
            `workspace-section-nav__pill${isActive ? ' workspace-section-nav__pill--active' : ''}`
          }
          role="tab"
        >
          {labels?.[section.labelKey as keyof typeof labels] ?? section.labelKey}
        </NavLink>
      ))}
    </nav>
  );
};
```

**CSS**: `apps/frontend/src/features/workspace/ui/WorkspaceSectionNav.css` (CREATE)

```css
.workspace-section-nav {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: var(--mui-palette-background-paper, #fff);
  border-bottom: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.12));
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.workspace-section-nav__pill {
  display: inline-flex; align-items: center;
  padding: 6px 16px; border-radius: 20px;
  font-size: 0.8125rem; font-weight: 500;
  text-decoration: none; white-space: nowrap;
  scroll-snap-align: start;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  background: transparent; border: 1px solid transparent;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.workspace-section-nav__pill:hover {
  background: var(--mui-palette-action-hover, rgba(0,0,0,0.04));
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87));
}
.workspace-section-nav__pill--active {
  color: var(--mui-palette-primary-main, #1976d2);
  background: var(--mui-palette-primary-light, rgba(25,118,210,0.08));
  border-color: var(--mui-palette-primary-main, #1976d2);
  font-weight: 600;
}
.workspace-section-nav__pill:focus-visible {
  outline: 2px solid var(--mui-palette-primary-main, #1976d2);
  outline-offset: 2px;
}
@media (max-width: 768px) {
  .workspace-section-nav { padding: 8px 12px; gap: 2px; }
  .workspace-section-nav__pill { padding: 6px 12px; font-size: 0.75rem; }
}
```

---

### Track 3 — `WorkspaceLayout` (Route-Aware Shell)

**File**: `apps/frontend/src/features/workspace/layouts/WorkspaceLayout.tsx` (CREATE)

Central orchestrator. Fetches project data once, provides `WorkspaceProjectContext`, conditionally renders header and SectionNav based on route.

```tsx
import { useParams, Outlet, useMatch } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { WorkspaceProjectProvider } from '../runtime/WorkspaceProjectContext';
import { WorkspaceContextHeader } from '../ui/WorkspaceContextHeader';
import { WorkspaceSectionNav } from '../ui/WorkspaceSectionNav';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { updateProject } from '../../../features/projects/runtime/projects-client';
import '../ui/WorkspaceSectionNav.css';
import '../ui/WorkspaceContextHeader.css';

export const WorkspaceLayout: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: project, loading, error, reload } = useProjectDetailQuery({
    projectId: workspaceId ?? '',
    apiBaseUrl,
    capabilities,
    enabled: Boolean(workspaceId),
  });

  // P0 fix: route-aware rendering decisions
  const isDashboard = Boolean(useMatch('/workspaces/:workspaceId'));
  const isToolRoute = Boolean(useMatch('/workspaces/:workspaceId/tools/:toolKey'));
  const isSessionDetail = Boolean(useMatch('/workspaces/:workspaceId/sessions/:sessionId'));

  const showContextHeader = !isDashboard && !isToolRoute && !isSessionDetail;
  const showSectionNav = !isToolRoute && !isSessionDetail;

  // P0 fix: determine currentSection from route for breadcrumb
  const isAssetsRoute = Boolean(useMatch('/workspaces/:workspaceId/assets'));
  const isSessionsRoute = Boolean(useMatch('/workspaces/:workspaceId/sessions'));
  const currentSection: 'overview' | 'assets' | 'sessions' =
    isAssetsRoute ? 'assets' : isSessionsRoute ? 'sessions' : 'overview';

  const handleReactivate = useCallback(async () => {
    if (!workspaceId) return;
    await updateProject(workspaceId, { status: 'active' });
    reload();
  }, [workspaceId, reload]);

  // CRITICAL: Never block <Outlet /> on project data.
  // SessionSummaryDetailPage is fully autonomous — it fetches its own session data
  // independently and must remain reachable even if useProjectDetailQuery fails.
  // Sub-pages that depend on project data use useWorkspaceProject() and handle
  // loading/error states locally.
  if (!workspaceId) return null;

  const projectName = project?.name ?? workspaceId;
  const isArchived = project?.status === 'archived';

  return (
    <WorkspaceProjectProvider value={{
      workspaceId, projectName, isArchived,
      isProjectLoading: loading, projectError: error, refetchProject: reload,
    }}>
      <div className="workspace-layout">
        {isArchived && (
          <Alert severity="warning" sx={{ borderRadius: 0 }}
            action={
              <Button color="inherit" size="small" startIcon={<RefreshCw size={16} />}
                onClick={handleReactivate}>
                Reactivate
              </Button>
            }>
            This workspace is archived. Content is read-only until reactivated.
          </Alert>
        )}

        {showContextHeader && (
          <WorkspaceContextHeader currentSection={currentSection} />
        )}

        {showSectionNav && <WorkspaceSectionNav />}

        <main className="workspace-layout__content">
          <Outlet />
        </main>
      </div>
    </WorkspaceProjectProvider>
  );
};
```

**P0 fixes applied**:
- `WorkspaceContextHeader` is NOT rendered on dashboard, tool routes, or session detail pages — no double header
- `WorkspaceSectionNav` is NOT rendered on tool routes or session detail pages — no UI noise
- `WorkspaceProjectProvider` wraps ALL sub-routes including tool pages, so `useWorkspaceProject()` is always valid
- `currentSection` derived from URL match, not hardcoded

---

**CSS for layout container** — add to `apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css`:

```css
/* ── Workspace Layout (unified wrapper) ── */
.workspace-layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.workspace-layout__content {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
@media (max-width: 768px) {
  .workspace-layout__content {
    padding: 16px;
  }
}
```

Sub-pages (Dashboard, Assets, Sessions) must NOT set padding/max-width inline — they inherit from `.workspace-layout__content`.

---

### Track 4 — `WorkspaceContextHeader` (Dynamic Breadcrumb, Fixed Hook)

**File**: `apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx` (MODIFY)

Changes:
1. `currentTool` becomes optional
2. `currentSection` prop for non-tool pages
3. Uses `useWorkspaceProject()` for `workspaceId` and `projectName` — called unconditionally inside the provider
4. Third breadcrumb element is dynamic based on `currentTool` or `currentSection`

**P0 fix**: No try-catch around `useWorkspaceProject()`. The header is always rendered inside `WorkspaceProjectProvider`, so the hook is always valid. When used from `WorkspaceToolWrapper` (which is inside the provider via the layout), the hook still works.

```tsx
interface WorkspaceContextHeaderProps {
  currentTool?: SupportedTool;
  currentSection?: 'overview' | 'assets' | 'sessions' | 'session-detail';
  assetCount?: number;
  qualityGateStatus?: 'healthy' | 'needs-attention' | 'blocked';
  crossToolPosition?: WorkflowPosition;
}

export const WorkspaceContextHeader: React.FC<WorkspaceContextHeaderProps> = ({
  currentTool,
  currentSection,
  assetCount = 0,
  qualityGateStatus = 'healthy',
  crossToolPosition,
}) => {
  // P0 fix: called unconditionally, always inside WorkspaceProjectProvider
  const { workspaceId, projectName } = useWorkspaceProject();

  // F5 fix: breadcrumb labels from appCopy — no hardcoded strings
  const sectionLabels = appCopy.ui.workspace?.sectionNav;

  const thirdSegment = currentTool
    ? toolFormRegistry[currentTool]?.displayName || currentTool
    : currentSection && currentSection !== 'overview'
      ? (sectionLabels?.[currentSection as keyof typeof sectionLabels] ?? currentSection)
      : null;

  return (
    <div className="workspace-context-header">
      <div className="workspace-context-header__breadcrumb">
        <Breadcrumbs separator={<ChevronRight size={14} />}>
          <Link to="/workspaces" className="workspace-context-header__breadcrumb-link">
            <Folder size={16} />
            {appCopy.ui.workspace?.contextHeader?.breadcrumbWorkspaces || 'Workspaces'}
          </Link>
          <Link to={`/workspaces/${workspaceId}`} className="workspace-context-header__breadcrumb-link">
            <FolderOpen size={16} />
            {projectName}
          </Link>
          {thirdSegment && (
            <Typography variant="body2" color="text.primary">{thirdSegment}</Typography>
          )}
        </Breadcrumbs>
      </div>
      {/* status chips unchanged */}
    </div>
  );
};
```

---

### Track 5 — Dashboard UX Overhaul (Real Data, No AI Slop)

#### 5.1 — Remove `WorkspaceKnowledgeOverview` as-is

**Rationale**: The current implementation displays:
- `overallQualityScore`: binary (100 or 50 based on `staleUpstream`) masquerading as a 0–100 continuous score → **AI slop**
- `5/8 tools completed`: `totalSteps: 8` is hardcoded, bears no relation to real tool count → **fake metric**
- Progress bar with fake percentage → **decorative filler**

**Replacement**: Move real, actionable data into the Hero subtitle and remove the standalone panel:

```tsx
// In WorkspaceDashboard Hero — replaces the standalone WorkspaceKnowledgeOverview
const staleCount = ctx.assets.filter(a => a.staleUpstream).length;
const assetTypeCounts = Object.entries(ctx.groupedByType)
  .filter(([, assets]) => assets.length > 0);

<Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
  {ctx.assets.length > 0
    ? `${assetTypeCounts.length} asset type${assetTypeCounts.length !== 1 ? 's' : ''} · ${ctx.assets.length} total`
    : 'No assets yet — start with Brief Generator'}
  {staleCount > 0 && ` · ${staleCount} stale`}
</Typography>
```

#### 5.2 — Reorder Dashboard Panels by Utility

**Before** (current order):
1. Hero
2. WorkspaceKnowledgeOverview → REMOVED
3. FoundationToolsPanel → CONDITIONAL
4. AssetLibraryAccordion
5. ContextualToolsPanel

**After** (new order, descending utility):
1. Hero (project name + real stats + primary CTA)
2. RecentArtifactsPanel — what did I build recently? (already implemented well)
3. AssetLibraryAccordion — what assets do I have?
4. ContextualToolsPanel — what can I do next?
5. FoundationToolsPanel — ONLY when assets are missing or stale

#### 5.3 — `FoundationToolsPanel` Conditional Rendering

**P1 fix**: When both foundation tools have assets and none are stale, hide the panel. Show it only when assets are missing or stale.

```tsx
// Inside FoundationToolsPanel:
if (ctx.loading) return /* skeleton */;

const missingOrStale = ctx.foundationTools.filter(tool =>
  !tool.hasAssets || tool.existingAssets.some(a => a.staleUpstream)
);

// P1 fix: hide when everything is complete and fresh
if (missingOrStale.length === 0) return null;

// When showing, only render tools that need attention
// (not all foundation tools equally prominent)
return (
  <div className="foundation-tools">
    <div className="foundation-tools__header">
      <span className="foundation-tools__header-title">
        {appCopy.ui.workspace.dashboard.foundationToolsTitle}
      </span>
      <span className="foundation-tools__header-subtitle">
        {appCopy.ui.workspace.dashboard.foundationToolsSubtitle}
      </span>
    </div>
    <div className="foundation-tools__grid">
      {ctx.foundationTools.map(tool => {
        // Show completed tools as compact confirmation, not full cards
        if (tool.hasAssets && !tool.existingAssets.some(a => a.staleUpstream)) {
          return (
            <div key={tool.toolKey} className="foundation-tools__card foundation-tools__card--done">
              <CheckCircle size={16} />
              <span>{toolFormRegistry[tool.toolKey]?.displayName} — {tool.existingAssets.length} asset(s)</span>
            </div>
          );
        }
        // ... full card for missing/stale tools
      })}
    </div>
  </div>
);
```

#### 5.4 — `SuggestedActionsPanel` — Remove Fake Empty State

**P2 fix**: When there are no gaps, hide the panel entirely instead of showing "No suggestions — workspace is fully loaded."

The `SuggestedActionsPanel` component: add early return `null` when `suggestedTools.length === 0 && actionableGaps.length === 0`.

#### 5.5 — Dashboard Hero Copy

```tsx
// Replace generic AI-slop copy with real data in Hero subtitle
const subtitle = ctx.assets.length > 0
  ? `${ctx.assets.length} asset${ctx.assets.length !== 1 ? 's' : ''} · ${Object.keys(ctx.groupedByType).filter(k => ctx.groupedByType[k]?.length > 0).length} type${...}`
  : 'No assets yet';

// Primary CTA: first suggested tool if available
const primaryTool = ctx.workflowPosition?.suggestedNext?.[0];
```

---

### Track 6 — Copy Cleanup (AI Slop Removal)

**File**: `apps/frontend/src/app/copy/system.ts` (MODIFY)

#### 6.1 — Remove / Replace Generic Copy

| Current (AI slop) | Replacement |
|---|---|
| `foundationToolsSubtitle: 'Start here to build your workspace knowledge'` | `foundationToolsSubtitle: 'Missing or stale foundation assets'` |
| `foundationToolsTitle: 'Foundation'` | `foundationToolsTitle: 'Foundation Assets'` |
| `qualityScoreLabel: 'Quality Score'` (used in KnowledgeOverview) | Removed with component |
| `toolsCompletedLabel` (uses hardcoded `totalSteps`) | Removed with component |

#### 6.2 — Add SectionNav Labels

```ts
sectionNav: {
  label: 'Workspace sections',
  overview: 'Overview',
  assets: 'Assets',
  sessions: 'Sessions',
},
```

#### 6.3 — Add Hero Stat Labels

```ts
dashboard: {
  // ...existing...
  heroAssetCount: (count: number, types: number) =>
    `${count} asset${count !== 1 ? 's' : ''} · ${types} type${types !== 1 ? 's' : ''}`,
  heroNoAssets: 'No assets yet',
  heroStaleCount: (count: number) =>
    ` · ${count} stale`,
  // Remove: qualityScoreLabel, toolsCompletedLabel
},
```

---

### Track 7 — Sub-Page Simplification & Style Fixes

#### 7.1 — `WorkspaceDashboard.tsx`

**File**: `apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx` (MODIFY)

Changes:
- Remove: `useProjectDetailQuery` (now from `useWorkspaceProject()`)
- Remove: archived banner (centralized in `WorkspaceLayout`)
- Remove: `WorkspaceKnowledgeOverview` import and rendering
- Remove: loading/error/null checks for project data (handled by Layout)
- Remove: footer "View all sessions" button (replaced by SectionNav)
- Add: `useWorkspaceProject()` for `projectName`, `isArchived`
- Add: inline real stats in Hero subtitle (asset count, types, stale count)
- Reorder: RecentArtifactsPanel first, then AssetLibraryAccordion, then ContextualToolsPanel, FoundationToolsPanel last

```tsx
export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);
  const { projectName, isArchived } = useWorkspaceProject();

  if (ctx.loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  const suggestedNext = ctx.workflowPosition?.suggestedNext ?? [];
  const firstSuggestedTool = suggestedNext[0];
  const staleCount = ctx.assets.filter(a => a.staleUpstream).length;
  const assetTypesWithAssets = Object.keys(ctx.groupedByType)
    .filter(k => (ctx.groupedByType[k]?.length ?? 0) > 0).length;

  return (
    <section className="workspace-dashboard">
      {/* Hero */}
      <div className="workspace-dashboard__hero">
        <div className="workspace-dashboard__hero-content">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{projectName}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {ctx.assets.length > 0
              ? `${ctx.assets.length} asset${ctx.assets.length !== 1 ? 's' : ''} · ${assetTypesWithAssets} type${assetTypesWithAssets !== 1 ? 's' : ''}`
              : 'No assets yet'}
            {staleCount > 0 && ` · ${staleCount} stale`}
          </Typography>
        </div>
        <div className="workspace-dashboard__hero-cta">
          <Button
            component={Link}
            to={firstSuggestedTool
              ? `/workspaces/${workspaceId}/tools/${firstSuggestedTool}`
              : '#available-tools'}
            variant="contained" size="large"
            startIcon={firstSuggestedTool ? <Play size={18} /> : <ArrowRight size={18} />}
            disabled={isArchived}
          >
            {firstSuggestedTool ? 'Start generating' : 'Choose a tool'}
          </Button>
        </div>
      </div>

      {/* Real data first: recent activity */}
      <RecentArtifactsPanel workspaceId={workspaceId} />

      {/* Asset inventory */}
      <AssetLibraryAccordion workspaceId={workspaceId} />

      {/* Available tools */}
      <div id="available-tools">
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>

      {/* Foundation tools — only when needed */}
      <FoundationToolsPanel workspaceId={workspaceId} />
    </section>
  );
};
```

#### 7.2 — `ProjectAssetsPage.tsx`

**File**: `apps/frontend/src/features/workspace/pages/ProjectAssetsPage.tsx` (MODIFY)

Changes:
- Remove: `useProjectDetailQuery`, `useApiConfig` (from `useWorkspaceProject()`)
- Remove: custom `<Breadcrumbs>` block (now in header)
- Remove: inline styles (`padding: 24`, `maxWidth: 1200`, `border: '1px solid #e0e0e0'`)
- Remove: "Back to Workspace" link (SectionNav handles navigation)
- Remove: `projectLoading`/`projectError` state handling (Layout handles)
- **P2 fix**: Replace inline hex colors with design token CSS classes

Asset items should use a new `.asset-page__item` class defined in `dashboard-panels.css` (NOT `.asset-group-section__browse-item` — that class is for compact borderless list items in the accordion, a different visual pattern). The asset page requires a bordered card with `Typography` + `Chip` badges:

```css
/* Add to dashboard-panels.css */
.asset-page__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.12));
  border-radius: 8px;
}
.asset-page__item + .asset-page__item { margin-top: 8px; }
.asset-page__item-label {
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
  min-width: 0;
}
.asset-page__item-meta {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
```

#### 7.3 — `WorkspaceSessionsPage.tsx`

**File**: `apps/frontend/src/features/workspace/pages/WorkspaceSessionsPage.tsx` (MODIFY)

Changes:
- Remove: `useProjectDetailQuery`, `useApiConfig`
- Remove: custom `<Breadcrumbs>` block
- Remove: inline styles
- Remove: `loading`/`error` handling for project
- Add: `useWorkspaceProject()` for `projectName`

#### 7.4 — `WorkspaceToolWrapper.tsx`

**File**: `apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx` (MODIFY)

Continues to call `useWorkspaceContext(workspaceId, toolKey)` for tool-compatible assets. Renders its own `WorkspaceContextHeader` with `currentTool={toolKey}`.

**P0 fix**: `WorkspaceLayout` does NOT render the header on tool routes, so there's only one header on tool pages. `WorkspaceToolWrapper` is inside `WorkspaceProjectProvider` (from the layout), so `WorkspaceContextHeader` can safely call `useWorkspaceProject()`.

```tsx
export const WorkspaceToolWrapper: React.FC<WorkspaceToolWrapperProps> = ({
  toolKey, children,
}) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaceContext = useWorkspaceContext(workspaceId, toolKey);

  if (workspaceContext.loading) return <LoadingStateMessage>Loading workspace context...</LoadingStateMessage>;
  if (workspaceContext.error) return <ErrorStateMessage>Error loading workspace: {workspaceContext.error}</ErrorStateMessage>;
  if (!workspaceId) return <Navigate to="/workspaces" replace />;

  return (
    <div className="workspace-tool-wrapper">
      <WorkspaceContextHeader
        currentTool={toolKey}
        assetCount={workspaceContext.assets.length}
        qualityGateStatus={workspaceContext.qualityGateStatus}
        {...(workspaceContext.workflowPosition ? { crossToolPosition: workspaceContext.workflowPosition } : {})}
      />
      <WorkspaceProvider value={workspaceContext}>
        {children}
      </WorkspaceProvider>
    </div>
  );
};
```

#### 7.5 — `SuggestedActionsPanel.tsx`

**File**: `apps/frontend/src/features/workspace/ui/dashboard/SuggestedActionsPanel.tsx` (MODIFY)

**Status note**: This component is currently dead code — it is not imported by any page in the workspace. The modifications below are cleanup to prevent AI slop if/when the component is re-activated.

**P2 fix**: Return `null` when there are no suggestions, instead of showing fake empty state copy.

```tsx
// Before the return:
if (suggestedTools.length === 0 && actionableGaps.length === 0) {
  return null;  // P2 fix: hide panel, don't show "workspace is fully loaded"
}
```

#### 7.6 — `RecentArtifactsPanel.tsx` — Use DashboardPanel Wrapper

**File**: `apps/frontend/src/features/workspace/ui/dashboard/RecentArtifactsPanel.tsx` (MODIFY)

**F8 fix**: The component currently duplicates `<div className="dashboard-panel">` boilerplate (header, content, footer divs) that already exists in the `<DashboardPanel>` wrapper. Refactor to use the wrapper:

```tsx
// BEFORE (manual boilerplate):
<div className="dashboard-panel">
  <div className="dashboard-panel__header">
    <span className="dashboard-panel__title">...</span>
  </div>
  <div className="dashboard-panel__content">...</div>
</div>

// AFTER (use wrapper):
<DashboardPanel title={appCopy.ui.workspace.dashboard.recentArtifactsTitle}>
  {/* content only */}
</DashboardPanel>
```

This reduces ~15 lines of duplicated markup per state variant (loading, error, empty, loaded).

---

## 3. Routing Final

```tsx
// app-router.tsx — :workspaceId route excerpt
{
  path: ':workspaceId',
  element: <Suspense fallback={<PageLoader />}><WorkspaceLayout /></Suspense>,
  children: [
    { index: true,
      element: <Suspense fallback={<PageLoader />}><WorkspaceDashboard /></Suspense> },
    { path: 'assets',
      element: <Suspense fallback={<PageLoader />}><ProjectAssetsPage /></Suspense> },
    { path: 'sessions', children: [
      { index: true,
        element: <Suspense fallback={<PageLoader />}><WorkspaceSessionsPage /></Suspense> },
      { path: ':sessionId',
        element: <Suspense fallback={<PageLoader />}><SessionSummaryDetailPage /></Suspense> },
    ]},
    { path: 'tools',
      children: Object.entries(toolPageComponents).map(([toolKey, Component]) => ({
        path: toolKey,
        element: (
          <ToolRouteGuard toolKey={toolKey as SupportedTool}>
            <Suspense fallback={<PageLoader />}>
              <WorkspaceToolWrapper toolKey={toolKey as SupportedTool}>
                <Component />
              </WorkspaceToolWrapper>
            </Suspense>
          </ToolRouteGuard>
        ),
      })) },
  ],
}
```

**Import**: add `import { WorkspaceLayout } from '../../features/workspace/layouts/WorkspaceLayout';` to `app-router.tsx`.

---

## 4. Implementation Order

| Step | Track | What | Depends on |
|------|-------|------|------------|
| 1 | 1 | Create `WorkspaceProjectContext` + `useWorkspaceProject` | — |
| 2 | 2 | Create `WorkspaceSectionNav` + CSS | — |
| 3 | 4 | Modify `WorkspaceContextHeader` (dynamic breadcrumb, `currentSection`, fix hook, appCopy labels) | 1 |
| 4 | 3 | Create `WorkspaceLayout` (route-aware, P0: always render Outlet) | 1, 2, 4 |
| 5 | CSS | Add `.workspace-layout`, `__content`, `.asset-page__item` to `dashboard-panels.css` | — |
| 6 | Router | Update `app-router.tsx` | 4 |
| 7 | 5.1 | Remove `WorkspaceKnowledgeOverview` from dashboard + add real stats to hero | 4 |
| 8 | 5.2–5.3 | Reorder panels, make `FoundationToolsPanel` conditional (compact cards for done, full for missing/stale) | 4 |
| 9 | 5.4–5.5 | Fix `SuggestedActionsPanel` empty state, cleanup hero copy | 4 |
| 10 | 7.1 | Simplify `WorkspaceDashboard` | 4, 7, 8 |
| 11 | 7.2 | Simplify `ProjectAssetsPage` (remove inline styles, use `.asset-page__item`) | 4 |
| 12 | 7.3 | Simplify `WorkspaceSessionsPage` | 4 |
| 13 | 7.4 | Update `WorkspaceToolWrapper` (remove deprecated props) | 3 |
| 14 | 7.5 | Fix `SuggestedActionsPanel` null return (dead code, defensive) | 4 |
| 15 | 7.6 | Refactor `RecentArtifactsPanel` to use `<DashboardPanel>` wrapper | 4 |
| 16 | 6 | Cleanup copy in `system.ts` | — |
| 17 | — | `typecheck` + `test` + `test:admin-a11y` | all |

---

## 5. Acceptance Gates

| Gate | Description | Verification |
|------|-------------|-------------|
| G1 | `npm --workspace apps/frontend run typecheck` passes | Zero TS errors |
| G2 | `npm --workspace apps/frontend run test` passes | All tests pass |
| G3 | `npm run test:admin-a11y` passes | No accessibility regressions |
| G4 | SectionNav: Overview/Assets/Sessions highlight correct on each route | Visual + unit test |
| G5 | WorkspaceContextHeader: dynamic breadcrumb correct for each section/tool | Visual |
| G6 | No duplicate `useProjectDetailQuery` calls in sub-pages | Code review |
| G7 | Custom breadcrumbs removed from `ProjectAssetsPage` and `WorkspaceSessionsPage` | Code review |
| G8 | `WorkspaceToolWrapper` functions with tool-specific header — **one header, not two** (P0) | Manual test |
| G9 | Archived banner visible on all sub-routes (not just dashboard) | Manual test |
| G10 | Layout responsive ≤768px: SectionNav scrollable, header stacks vertically | Manual test |
| G11 | `useWorkspaceProject()` throws if used outside `WorkspaceLayout` | Unit test |
| G12 | `SessionSummaryDetailPage` accessible from `/workspaces/:id/sessions/:sid` | Manual test |
| G13 | `WorkspaceContextHeader` works without `currentTool` (only `currentSection`) | Unit test |
| G14 | **P0**: No double header on tool pages | Manual test on any tool route |
| G15 | **P0**: No SectionNav on tool pages or session detail | Manual test on tool + session detail routes |
| G16 | **P0**: No try-catch around `useWorkspaceProject` in header | Code review |
| G17 | **P1**: KnowledgeOverview removed; hero shows real asset counts | Visual |
| G18 | **P1**: FoundationToolsPanel hidden when all assets exist and none stale | Visual + unit test |
| G19 | **P2**: `SuggestedActionsPanel` returns null (not visible) when no gaps | Unit test |
| G20 | **P2**: No inline hex colors in `ProjectAssetsPage` | Code review |
| G21 | **P3**: No AI-slop copy in `system.ts` (`'Start here to build...'`, fake `qualityScoreLabel`) | Code review |

---

## 6. Files Touched Summary

| File | Action | Delta |
|------|--------|-------|
| `runtime/WorkspaceProjectContext.tsx` | **Create** | ~40 lines |
| `layouts/WorkspaceLayout.tsx` | **Create** | ~100 lines |
| `ui/WorkspaceSectionNav.tsx` | **Create** | ~50 lines |
| `ui/WorkspaceSectionNav.css` | **Create** | ~55 lines |
| `ui/WorkspaceContextHeader.tsx` | **Modify** | ~25 lines |
| `ui/dashboard/dashboard-panels.css` | **Modify** | ~50 lines (`.workspace-layout`, `__content`, `.asset-page__item`) |
| `ui/dashboard/FoundationToolsPanel.tsx` | **Modify** | ~25 lines |
| `ui/dashboard/RecentArtifactsPanel.tsx` | **Modify** | ~20 removed (use DashboardPanel wrapper) |
| `ui/dashboard/SuggestedActionsPanel.tsx` | **Modify** | ~5 lines (null return, dead code) |
| `app/routing/app-router.tsx` | **Modify** | ~10 lines |
| `app/copy/system.ts` | **Modify** | ~15 lines |
| `pages/WorkspaceDashboard.tsx` | **Modify** | ~30 removed, +15 added |
| `pages/ProjectAssetsPage.tsx` | **Modify** | ~25 removed, +5 added |
| `pages/WorkspaceSessionsPage.tsx` | **Modify** | ~20 removed, +3 added |
| `ui/WorkspaceToolWrapper.tsx` | **Modify** | ~5 removed |
| Test files for new components | **Create** | ~350 lines |
| **Net total** | | **~370 new, ~130 removed** |

---

## 7. Architectural Decisions

### 7.1 Why WorkspaceLayout does NOT render the header on every route

The header is context-sensitive. On the dashboard, the project name is already in the hero — showing a breadcrumb "Workspaces / ProjectName" above it is redundant. On tool pages, `WorkspaceToolWrapper` renders its own header with tool-specific metadata (asset count filtered by tool compatibility, quality gate for the tool context). The layout should not compete with sub-page headers.

### 7.2 Why two context layers

`useWorkspaceContext(workspaceId, toolKey)` fetches tool-compatible assets filtered by `useAssetSuggestions`. `useWorkspaceContext(workspaceId)` without `toolKey` fetches ALL project assets. Forcing tool pages to use the no-`toolKey` variant would break compatibility filtering. The Project-Layer (name, status) is identical for all sub-routes and is centralized.

### 7.3 Why FoundationToolsPanel becomes conditional

The panel's purpose is to guide the user toward creating missing foundation assets. Once brief and brand-voice assets exist and are fresh, the panel has served its purpose. Keeping two full-width hero cards saying "Regenerate" is visual noise that competes with actual tools for the user's attention.

### 7.4 Why KnowledgeOverview is removed rather than patched

The component displays `qualityScore`, `estimatedCompletion`, and `currentStep` — all derived from either binary logic (`staleUpstream ? 50 : 100`) or hardcoded constants (`totalSteps: 8`). None of these are real metrics. Real data (asset counts by type, stale count, last activity timestamp) fits naturally in the Hero subtitle without a separate panel.

---

## 8. Test Coverage

### 8.1 New Tests

| File | Tests |
|------|-------|
| `WorkspaceProjectContext.test.tsx` | `useWorkspaceProject` throws outside provider; values accessible inside |
| `WorkspaceLayout.test.tsx` | Loading/error/archived/ready states; header visibility by route; SectionNav visibility by route |
| `WorkspaceSectionNav.test.tsx` | 3 pills rendered; correct links; active state per route; ARIA `tablist` role |
| `WorkspaceContextHeader.test.tsx` | Breadcrumb with `currentSection='assets'`; with `currentTool='funnel-pages'`; no third segment (overview) |
| `FoundationToolsPanel.test.tsx` | Hidden when all complete; shows only missing/stale; compact confirmation for complete |

### 8.2 Existing Tests to Update

| File | Change |
|------|--------|
| `WorkspaceDashboard.test.tsx` | May fail if mocks `useProjectDetailQuery` — update for `WorkspaceProjectProvider` |
| `ProjectAssetsPage.test.tsx` | Update for new context pattern if exists |
| `WorkspaceToolWrapper.test.tsx` | Verify no duplicate header rendering |
| `SuggestedActionsPanel.test.tsx` | Verify returns null when no suggestions |

---

## 9. Rollback Plan

1. Remove `WorkspaceLayout` from routing in `app-router.tsx` (restore direct `element` entries)
2. Restore `ProjectAssetsPage.tsx` — re-add `useProjectDetailQuery`, breadcrumb, inline styles
3. Restore `WorkspaceSessionsPage.tsx` — re-add `useProjectDetailQuery`, breadcrumb
4. Restore `WorkspaceDashboard.tsx` — re-add `useProjectDetailQuery`, archived banner, `WorkspaceKnowledgeOverview`
5. Restore `SuggestedActionsPanel.tsx` — remove null return
6. Revert `FoundationToolsPanel.tsx` — remove conditional logic
7. Revert `WorkspaceContextHeader.tsx` — restore old props interface
8. New files (`WorkspaceLayout.tsx`, `WorkspaceProjectContext.tsx`, `WorkspaceSectionNav.tsx`, CSS) stay on disk unimported = dead code, zero runtime impact
