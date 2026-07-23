---
status: implemented
version: 1.1
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
owner: Frontend Platform Team
type: design-proposal
tags:
  - workspace-hub
  - ui-convergence
  - data-table-view
goal: Converge the Workspaces Hub page (`/workspaces`) to the canonical Data Table View archetype with a card-variant layout, unifying visual language, layout tokens, component composition, and query strategy with workspace detail routes while respecting all CTA and feedback channel governance rules.
---

# Workspace Hub Restyling Proposal

## 1. Archetype Classification

### 1.1 Canonical Archetype: Data Table View (card-variant)

Per the Frontend UI Ubiquitous Language Spec (Section 3.2), the Hub page is a list/index page and therefore maps to the **Data Table View** archetype.

However, Section 3.2 also states:

> _card-only list views are allowed only when data is not tabular_

Workspace entities are **not tabular**. Unlike admin users, models, or artifact rows (which have uniform column schemas), each workspace carries heterogeneous, nested metadata: foundation asset completeness (2 specific tools), asset counts across 13 types, quality scores, stale-warning signals, and recent activity summaries. Tabular representation would flatten this richness into a lossy row format, reducing the Hub's ability to act as an _intentional starting point_ where users scan and prioritize workspaces at a glance.

**Classification justification**:
- **Archetype**: Data Table View (card-variant)
- **Rationale**: Data is non-tabular; card layout preserves semantic grouping without nested cards
- **Precedent**: The existing Admin Overview (`/admin`) is classified as a Data Table View companion with KPI widget cards (Section 5.2 of spec). The Hub follows the same companion-card logic: cards are the structural unit, not table rows.

### 1.2 Naming Convention

| Term | Canonical Name | Source |
|------|---------------|--------|
| Page component | `WorkspacesListPage` (unchanged) | `apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx` |
| Individual card | `WorkspaceHubCard` (new) | This proposal |
| Card container | `workspace-hub-grid` (new CSS class) | This proposal |
| Page wrapper | `workspace-hub` (new CSS class) | This proposal |
| Create dialog | `CreateWorkspaceDialog` (refactored, not new component) | Existing component, redesigned |

---

## 2. Current State Analysis (Problems)

### 2.1 Layout Drift

The current Hub page (`workspace-list-page`) uses `max-width: 800px` with centered vertical card stacking. The workspace detail pages inside `WorkspaceLayout` use `max-width: 1200px` with a two-column grid (`dashboard-grid`). This creates a jarring transition: users navigate from a narrow single-column list into a spacious dashboard, breaking the spatial model.

| Property | Current Hub (`/workspaces`) | Detail (`/workspaces/:id`) | Drift |
|----------|---------------------------|---------------------------|-------|
| Max width | 800px | 1200px | **Significant** |
| Layout | Single-column card stack | Two-column grid + full-width sections | **Significant** |
| Card style | `.workspace-list-card` (horizontal row) | `.workspace-overview` (hero card) + `.dashboard-panel` | **Significant** |
| Gap | 12px | 24px | Moderate |

### 2.2 Component Inconsistency

The Hub page uses MUI primitives (`Chip`, `Typography`, `IconButton`, `Menu`, `MenuItem`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `TextField`, `Button`) that are **not used** in the workspace detail pages. The detail pages use design-system primitives (`LoadingStateMessage`, `ErrorStateMessage`, BEM CSS classes like `dashboard-panel`, `workspace-overview`).

| Element | Current Hub | Detail Pages | Canonical Source |
|---------|-------------|--------------|-----------------|
| Title | MUI `<Typography variant="h5">` | `<h4 className="workspace-overview__title">` | `WorkspaceOverviewCard` |
| Buttons | MUI `<Button variant="contained">` | `<button className="ui-button">` or `<Link className="ui-button">` | `primitives.tsx` |
| Status | MUI `<Chip>` | `foundation-status__indicator--present/missing` | `FoundationToolsPanel` |
| Loading | `LoadingStateMessage` (correct) | `LoadingStateMessage` (correct) | `primitives.tsx` |
| Error | `ErrorStateMessage` (correct) | `ErrorStateMessage` (correct) | `primitives.tsx` |
| Dialog | MUI `<Dialog>` | N/A (Tool pages use in-page transitions) | Design system |

### 2.3 N+1 Query Problem

```typescript
// Current: WorkspacesListPage loads ProjectSummary[] (name, description, updatedAt)
const { data: projects } = useProjectsQuery({ apiBaseUrl, capabilities });

// Then each WorkspaceCard independently calls:
const ctx = useWorkspaceContext(project.id);
// Which triggers: listAssets(project.id) — a separate HTTP request per card
```

For N workspaces, this produces N+1 HTTP requests: 1 for the project list, N for asset lists. With 5-10 workspaces, this is manageable but wasteful. Each `WorkspaceHubCard` also independently computes foundation tool status, gaps, quality scores, and workflow position — all derivable from the asset list.

### 2.4 Information Poverty

The current card shows:
- **Name** + **Description** (from `ProjectSummary`)
- **Asset count** (from `useWorkspaceContext`)
- **Quality score %** (from `useWorkspaceContext`)
- **Tools completed/total** (from `useWorkspaceContext`)
- **Quality gate Chip** (healthy/needs-attention/blocked)

Missing from the card:
- **Foundation asset status** — the single most important signal for new workspaces (are Brief and Brand Voice generated?)
- **Stale asset count** — actionable quality signal
- **Asset type coverage** — how many of the 13 canonical types have assets?
- **Recent session activity** — when was this workspace last used?
- **Archived status visibility** — currently shown as opacity: 0.6, but no labeled filter/sort

### 2.5 CTA Governance Violations

| Violation | Location | Rule Broken |
|-----------|----------|-------------|
| MUI `<Button variant="contained">` for "New Workspace" | `WorkspacesListPage` L236-242 | CTA Governance Section 4b: must use `ui-button` pattern |
| MUI `<Button>` for "Cancel" / "Create" in dialog | `CreateWorkspaceDialog` L103-108 | Must use `Button` from `primitives.tsx` |
| MUI `<IconButton>` for workspace actions menu | `WorkspaceCard` L192-198 | Not a CTA, but MUI component inconsistent with design system |
| MUI `<Chip>` for quality gate label | `WorkspaceCard` L185-191 | Semantic status should use `StatusBadge` or BEM status indicator |

---

## 3. Proposed Layout Structure

### 3.1 Page-Level Layout

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar (page header)                                  1200px │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ <h4> Workspaces                         [New Workspace]  │ │
│ │ <p>  {n} workspaces · {m} need attention                │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ workspace-hub-grid (2-column, 24px gap)                      │
│ ┌──────────────────────┐ ┌──────────────────────┐           │
│ │ WorkspaceHubCard     │ │ WorkspaceHubCard     │           │
│ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │           │
│ │ │ Header (name)    │ │ │ │ Header (name)    │ │           │
│ │ │ [Archived badge] │ │ │ │                  │ │           │
│ │ │ Description      │ │ │ │ Description      │ │           │
│ │ ├──────────────────┤ │ │ ├──────────────────┤ │           │
│ │ │ Foundation row   │ │ │ │ Foundation row   │ │           │
│ │ │ Brief ✓ | BV ✗   │ │ │ │ Brief ✓ | BV ✓   │ │           │
│ │ ├──────────────────┤ │ │ ├──────────────────┤ │           │
│ │ │ Stats row        │ │ │ │ Stats row        │ │           │
│ │ │ 12 assets · 5    │ │ │ │ 3 assets · 2     │ │           │
│ │ │ types · 2 stale  │ │ │ │ types · 92% qual │ │           │
│ │ ├──────────────────┤ │ │ ├──────────────────┤ │           │
│ │ │ Activity hint    │ │ │ │ Activity hint    │ │           │
│ │ │ Last: MetaAds    │ │ │ │ Last: Brief Gen  │ │           │
│ │ │ 2h ago · 4 art.  │ │ │ │ 1d ago · 1 art.  │ │           │
│ │ ├──────────────────┤ │ │ ├──────────────────┤ │           │
│ │ │ [Enter →] [···]  │ │ │ │ [Enter →] [···]  │ │           │
│ │ └──────────────────┘ │ │ └──────────────────┘ │           │
│ └──────────────────────┘ └──────────────────────┘           │
│                                                              │
│ (Empty state when no workspaces)                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │          No workspaces available.                        │ │
│ │    [Create your first workspace]  (ui-button)            │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Layout Rationale

**Max-width 1200px**: Unifies with `WorkspaceLayout` (`workspace-layout__content`, `max-width: 1200px`). The Hub should feel like the entry point into the same spatial system. When users click into a workspace, the page expands from the same container, not from a narrower one.

**Two-column grid**: Matches `dashboard-grid` (`grid-template-columns: repeat(2, 1fr); gap: 24px`). Workspace cards are rich enough to warrant 50% width each. On mobile (< 768px), collapses to single column — same breakpoint as `dashboard-grid`.

**No nested cards**: Each `WorkspaceHubCard` is a single `Surface` (or `.workspace-hub-card` following BEM). Internal sections use horizontal rules, typographic labels, and spacing — not nested boxed surfaces. This follows the global rule from Section 3 of the UI spec: "avoid nested cards by default."

**Page header**: Uses a `TopBar` (or a BEM `workspace-hub__header`) with title + action button on the same row and a `ui-meta-line` subtitle. This mirrors the `workspace-overview__header` pattern (title left, CTA right) but applies it at page level.

### 3.3 Responsive Behavior

| Breakpoint | Layout | Card Width |
|------------|--------|------------|
| < 640px | Single column | Full width |
| 640-1023px | Single column | Full width (cards are too rich for 2-across on tablet) |
| 1024px+ | Two columns | 50% each |

On mobile the foundation row may stack vertically (`flex-wrap: wrap`), and stats may collapse to fewer visible items.

---

## 4. Component Tree (Concrete)

### 4.1 Page Component: `WorkspacesListPage`

```
WorkspacesListPage
├── workspace-hub (section wrapper)
│   ├── workspace-hub__header (TopBar or header div)
│   │   ├── <h4 className="workspace-hub__title">
│   │   │     {appCopy.ui.navigation.workspaces}       // "Workspaces"
│   │   ├── <Link to="/workspaces" className={uiPrimitives.button}>
│   │   │     <Plus size={18} />
│   │   │     {appCopy.ui.actions.createProject}        // "Create workspace"
│   │   ├── <p className={uiPrimitives.metaLine}>
│   │   │     {n} workspaces · {m} {attention copy}
│   │
│   ├── Page States (conditional)
│   │   ├── [if loading] <LoadingStateMessage>
│   │   │     {appCopy.ui.states.loadingProjects}       // "Loading workspaces..."
│   │   ├── [if error] <ErrorStateMessage>
│   │   │     {error.message || appCopy.ui.fallbackErrors.loadProjects}
│   │   ├── [if empty (projects.length === 0)] <EmptyStateMessage> in zero-state layout
│   │   │     {appCopy.ui.states.noProjectsAvailable}   // "No workspaces available."
│   │   │     <Link to="?create" className={uiPrimitives.button}>
│   │   │       {appCopy.ui.actions.createFirstProject} // "Create your first workspace"
│   │
│   ├── workspace-hub-grid (2-column CSS grid)
│   │   ├── WorkspaceHubCard (for each project)
│   │   │   ├── workspace-hub-card__header
│   │   │   │   ├── workspace-hub-card__name            // project.name
│   │   │   │   ├── [if archived] workspace-hub-card__archived-badge
│   │   │   │   └── workspace-hub-card__description     // project.description
│   │   │   ├── workspace-hub-card__divider (<hr>)
│   │   │   ├── workspace-hub-card__foundation
│   │   │   │   ├── workspace-hub-card__foundation-label  // "Foundation"
│   │   │   │   └── workspace-hub-card__foundation-row
│   │   │   │       ├── .foundation-status__item (Brief)
│   │   │   │       │   ├── .foundation-status__icon   <FileText size={16}>
│   │   │   │       │   ├── .foundation-status__label  "Brief"
│   │   │   │       │   ├── .foundation-status__indicator (present/missing)
│   │   │   │       │   │   <CheckCircle> / <AlertTriangle>
│   │   │   │       │   │   "1 asset" / "Missing"
│   │   │   │       │   └── [if hasAssets]
│   │   │   │       │       .foundation-status__count   "{n} assets"
│   │   │   │       ├── .foundation-status__item (Brand Voice)
│   │   │   │       │    ... same structure ...
│   │   │   ├── workspace-hub-card__divider (<hr>)
│   │   │   ├── workspace-hub-card__stats
│   │   │   │   ├── <span> "{n} assets"
│   │   │   │   ├── <span className="workspace-hub-card__stat-sep"> &middot;
│   │   │   │   ├── <span> "{n} types"
│   │   │   │   ├── [if staleCount > 0]
│   │   │   │   │   <span className="workspace-hub-card__stat--warning"> "{n} stale"
│   │   │   │   ├── <span className="workspace-hub-card__stat-sep"> &middot;
│   │   │   │   └── <span> "{n}% quality"
│   │   │   ├── workspace-hub-card__divider (<hr>)
│   │   │   ├── workspace-hub-card__activity
│   │   │   │   ├── <span className="workspace-hub-card__activity-label"> "Last activity"
│   │   │   │   └── <span className="workspace-hub-card__activity-detail">
│   │   │   │         {toolLabel} · {relativeTime} · {artifactCount} artifacts
│   │   │   │       [or] "No sessions yet"
│   │   │   ├── workspace-hub-card__divider (<hr>)
│   │   │   └── workspace-hub-card__actions
│   │   │       ├── <Link to={`/workspaces/${project.id}`}
│   │   │       │     className={uiPrimitives.button}>
│   │   │       │     {appCopy.ui.actions.enterWorkspace}  // "Enter workspace"
│   │   │       └── <button type="button" onClick={handleArchiveToggle}
│   │   │             className="workspace-hub-card__menu-btn"
│   │   │             aria-label={isArchived ? "Reactivate workspace" : "Archive workspace"}>
│   │   │             <Archive size={16} />
│   │   │
│   │   └── ... more WorkspaceHubCard ...
│   │
│   └── CreateWorkspaceDialog (conditional, on ?create or state)
│       ├── <Surface as="dialog" className="workspace-hub-dialog">
│       │   ├── <h5> Create New Workspace
│       │   ├── <label> Workspace Name
│       │   │   <input className="form-input" ... >
│       │   ├── <label> Description (optional)
│       │   │   <textarea className="form-input" ... >
│       │   ├── [if error] <p className={uiPrimitives.error}>
│       │   └── <div className="workspace-hub-dialog__actions">
│       │       ├── <Button onClick={close}> Cancel
│       │       └── <Button onClick={submit} disabled={loading}> Create
```

### 4.2 Component File Map

| Component | File Path | Status |
|-----------|-----------|--------|
| `WorkspacesListPage` | `apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx` | **Refactored** |
| `WorkspaceHubCard` | `apps/frontend/src/features/workspace/ui/WorkspaceHubCard.tsx` | **New** |
| `CreateWorkspaceDialog` | Inline in `WorkspacesListPage` or extracted to `apps/frontend/src/features/workspace/ui/CreateWorkspaceDialog.tsx` | **New/Extracted** |
| CSS | `apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css` | **Extended** |

---

## 5. Data Sources & Query Strategy

### 5.1 Data Dependency Map

```
WorkspacesListPage
│
├── useProjectsQuery()
│   └── ProjectSummary[]   ← GET /api/projects (single request)
│       └── { id, name, description, status, updatedAt }
│
└── WorkspaceHubCard (per project, self-loading)
    │
    ├── useWorkspaceContext(workspaceId)   ← GET /api/projects/{id}/assets
    │   ├── assets[]                       (one request per workspace, parallel)
    │   ├── qualityGateStatus
    │   ├── foundationTools[]
    │   ├── overallQualityScore
    │   └── groupedByType
    │
    └── useSessionsQuery({ projectId })   ← GET /api/sessions?projectId=X
        └── SessionSummary[]               (one request per workspace, parallel)
            └── { sessionId, toolKey, status, updatedAt, artifactCount }
```

### 5.2 Addressing the N+1 Concern

The current implementation calls `useWorkspaceContext(project.id)` per card, which triggers `listAssets(project.id)`. This is **N parallel requests**, not strictly N+1 in the classic ORM sense (where N queries are sequential and dependent). All cards mount simultaneously and fire their requests in parallel.

**Pragmatic approach (Phase 1 — this proposal)**:
- Each `WorkspaceHubCard` self-loads via `useWorkspaceContext` and `useSessionsQuery`
- Cards render skeleton states while their data loads
- SWR caching prevents re-fetches on remount
- For typical workspace counts (1-10), this is acceptable

**Optimization (Phase 2 — future)**:
- Add a batched endpoint: `GET /api/projects/summaries` returning `WorkspaceHubSummary[]` with:
  - Asset counts, quality scores, foundation status, latest session metadata
- This eliminates per-card requests entirely
- Not in scope for this proposal; noted as architectural follow-up

### 5.3 Per-Component Data Requirements

| Component | Data Source | Loading State | Error State | Empty Handling |
|-----------|------------|---------------|-------------|----------------|
| `WorkspacesListPage` (page-level) | `useProjectsQuery()` | `LoadingStateMessage` centered | `ErrorStateMessage` with retry button | `EmptyStateMessage` + zero-state CTA |
| `WorkspaceHubCard` (card-level) | `useWorkspaceContext(project.id)` | Skeleton rows for foundation + stats | Compact `ErrorStateMessage` inside card | Card renders with "No assets yet" stats |
| `WorkspaceHubCard` activity row | `useSessionsQuery({ projectId })` | Inline `<Skeleton>` text | Suppressed (show "Activity unavailable") | Show "No sessions yet" |
| `CreateWorkspaceDialog` | Local `useState` + `createProject()` | Button shows "Creating..." | Inline `<p className={uiPrimitives.error}>` | N/A (form always visible when open) |

### 5.4 Mutation Flow

```
User clicks "New Workspace" → setDialogOpen(true)
User fills name/description → clicks "Create"
  → createProject({ name, description })
  → on success:
      1. publishSuccess(appCopy.ui.feedback.projectsCreated)   // "Workspace created."
         via FeedbackMessageProvider (global channel, per Section 7 of UI spec)
      2. close dialog
      3. reload() useProjectsQuery
  → on error:
      1. setError(error.message) in dialog (inline-action channel)
      2. Do NOT use global channel (the error is fixable in-place)
```

### 5.5 Archive/Reactivate Flow

```
User clicks archive action → handleArchiveToggle()
  → updateProject(project.id, { status: newStatus })
  → on success:
      1. reload() useProjectsQuery (refresh the list)
      2. publishSuccess("Workspace archived.") via global channel
  → on error:
      1. publishError(error.message) via global channel
```

---

## 6. CSS & Token Alignment

### 6.1 New CSS Classes (added to `dashboard-panels.css`)

```css
/* ── Workspace Hub (list page) ── */

.workspace-hub {
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (max-width: 768px) {
  .workspace-hub {
    padding: 16px;
    gap: 16px;
  }
}

.workspace-hub__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.workspace-hub__header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-hub__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87));
  letter-spacing: -0.01em;
  margin: 0;
}

.workspace-hub__subtitle {
  font-size: 0.8rem;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  margin: 0;
}

.workspace-hub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 1023px) {
  .workspace-hub-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Workspace Hub Card ── */

.workspace-hub-card {
  border: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.12));
  border-radius: 12px;
  background: var(--mui-palette-background-paper, #fff);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.workspace-hub-card--loading {
  opacity: 0.7;
}

.workspace-hub-card__header {
  padding: 20px 24px 16px;
}

.workspace-hub-card__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.workspace-hub-card__name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-hub-card__archived-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
  background: var(--mui-palette-grey-100, #f5f5f5);
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  border: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.12));
  flex-shrink: 0;
}

.workspace-hub-card__description {
  font-size: 0.8rem;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.workspace-hub-card__divider {
  margin: 0 24px;
  border: none;
  border-top: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.08));
}

/* Foundation section — reuses .foundation-status__item etc. from existing CSS */
.workspace-hub-card__foundation {
  padding: 14px 24px;
}

.workspace-hub-card__foundation-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--mui-palette-text-disabled, rgba(0,0,0,0.38));
  margin-bottom: 8px;
}

.workspace-hub-card__foundation-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

/* Stats section */
.workspace-hub-card__stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  flex-wrap: wrap;
}

.workspace-hub-card__stat {
  font-size: 0.8rem;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
}

.workspace-hub-card__stat--warning {
  color: var(--mui-palette-warning-main, #ed6c02);
}

.workspace-hub-card__stat-sep {
  color: var(--mui-palette-divider, rgba(0,0,0,0.12));
  user-select: none;
}

/* Activity hint */
.workspace-hub-card__activity {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
}

.workspace-hub-card__activity-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  white-space: nowrap;
  flex-shrink: 0;
}

.workspace-hub-card__activity-detail {
  font-size: 0.8rem;
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-hub-card__activity-none {
  font-size: 0.75rem;
  color: var(--mui-palette-text-disabled, rgba(0,0,0,0.38));
}

/* Actions row */
.workspace-hub-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.08));
  margin-top: auto;
}

.workspace-hub-card__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.workspace-hub-card__menu-btn:hover {
  background: var(--mui-palette-action-hover, rgba(0,0,0,0.04));
  border-color: var(--mui-palette-divider, rgba(0,0,0,0.12));
}

.workspace-hub-card__menu-btn:focus-visible {
  outline: 2px solid var(--mui-palette-primary-main, #1976d2);
  outline-offset: 2px;
}

/* ── Create Workspace Dialog ── */

.workspace-hub-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  padding: 24px;
}

.workspace-hub-dialog {
  width: 100%;
  max-width: 480px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workspace-hub-dialog__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87));
  margin: 0;
}

.workspace-hub-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-hub-dialog__label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
}

.workspace-hub-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* ── Zero State ── */

.workspace-hub--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 320px;
  gap: 16px;
}

.workspace-hub--empty .ui-meta-line {
  max-width: 400px;
  font-size: 0.9rem;
}
```

### 6.2 Token Alignment

All new CSS classes follow the existing design token conventions:

| Token Usage | Source Convention |
|-------------|------------------|
| `border-radius: 12px` | Matches `.dashboard-panel`, `.workspace-list-card` |
| `border: 1px solid var(--mui-palette-divider)` | Matches `.dashboard-panel` |
| `font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em` | Matches `.workspace-overview__foundation-label` |
| `gap: 24px` | Matches `.workspace-dashboard`, `.dashboard-grid` |
| `max-width: 1200px` | Matches `.workspace-layout__content` |
| `font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em` | Matches `.workspace-overview__title` |
| `--warning` | Matches `.workspace-overview__stat--warning` |
| `foundation-status__item`, `foundation-status__icon`, `foundation-status__label`, `foundation-status__indicator`, `foundation-status__action` | **Reused verbatim** from existing CSS (lines 508-547 of `dashboard-panels.css`) |

### 6.3 Removal of Old CSS Classes

After migration, remove the following from `dashboard-panels.css`:
- `.workspace-list-page` (lines 379-399)
- `.workspace-list-card` (lines 401-454)
- Associated mobile overrides for these classes in the `@media (max-width: 768px)` block (lines 489-505)

---

## 7. State Handling (Loading / Empty / Error / Ready)

### 7.1 Channel Mapping (per Section 7 of UI Spec)

| Event | Canonical Channel | Implementation |
|-------|------------------|----------------|
| Project list loading | `page-state` | `<LoadingStateMessage>` in page body |
| Project list empty | `page-state` | `<EmptyStateMessage>` + zero-state CTA |
| Project list error | `page-state` | `<ErrorStateMessage>` with retry |
| Card-level asset loading | `page-state` | Skeleton placeholders inside card (not global) |
| Card-level asset error | `page-state` | Compact `<ErrorStateMessage>` inside card |
| Card-level session loading | `page-state` | Text skeleton in activity row |
| Workspace creation success | `global` | `publishSuccess(appCopy.ui.feedback.projectsCreated)` |
| Workspace creation failure | `inline-action` | Error in dialog form (fixable in-place) |
| Archive/Reactivate success | `global` | `publishSuccess(...)` |
| Archive/Reactivate failure | `global` | `publishError(...)` |

### 7.2 Page-Level States

**Loading state**:
```tsx
if (loading) return (
  <section className="workspace-hub">
    <LoadingStateMessage>{appCopy.ui.states.loadingProjects}</LoadingStateMessage>
  </section>
);
```

**Error state**:
```tsx
if (error) return (
  <section className="workspace-hub">
    <ErrorStateMessage>{error}</ErrorStateMessage>
    <Button onClick={reload}>{appCopy.ui.actions.retry}</Button>
  </section>
);
```

**Empty state (zero projects)**:
```tsx
if (projects.length === 0) return (
  <section className="workspace-hub workspace-hub--empty">
    <EmptyStateMessage>{appCopy.ui.states.noProjectsAvailable}</EmptyStateMessage>
    <Link to="?create" className={uiPrimitives.button}>
      {appCopy.ui.actions.createFirstProject}
    </Link>
  </section>
);
```
**CTA Governance check**: Zero-state CTA uses `<Link className={uiPrimitives.button}>` — satisfies Pattern A from Section 4b. The `?create` query param triggers the dialog without navigation away.

### 7.3 Card-Level States

Each `WorkspaceHubCard` handles its own sub-states:

**Card loading** (assets still fetching):
```tsx
// Foundation section: skeleton items
<div className="foundation-status">
  <div className="foundation-status__item">
    <Skeleton variant="circular" width={24} height={24} />
    <Skeleton variant="text" width={60} />
    <Skeleton variant="text" width={100} />
  </div>
  // ... second skeleton
</div>
// Stats: skeleton text line
<Skeleton variant="text" width="80%" />
```

**Card error** (asset fetch failed):
```tsx
<div className="workspace-hub-card__stats">
  <ErrorStateMessage>Unable to load workspace data</ErrorStateMessage>
</div>
```

**Card ready** (assets loaded): Full card as described in Section 4.1.

**Empty workspace** (no assets): Card renders with `"No assets yet"` stats, foundation section shows both tools as "Missing", activity shows "No sessions yet."

### 7.4 Archived Workspace Treatment

Archived workspaces (`project.status === 'archived'`):
- Card shows `.workspace-hub-card__archived-badge` next to name
- Card background has slightly muted appearance (`opacity: 0.85` or a lighter border)
- "Enter workspace" button text changes to "View workspace" (read-only context)
- Archive action button changes to reactivate icon (`<RefreshCw size={16} />`)
- No `disabled` — archived workspaces are navigable (read-only) per existing `WorkspaceLayout` behavior

---

## 8. CTA Governance Alignment

### 8.1 CTA Inventory

| CTA | Location | Classification | Canonical Pattern | Implementation |
|-----|----------|---------------|-------------------|----------------|
| "Create workspace" (header) | Page header, outside `<td>` | Primary page action | Pattern A: `ui-button` | `<Link to="?create" className={uiPrimitives.button}>` |
| "Create" / "Cancel" (dialog) | Dialog form, outside `<td>` | Form submit / dismiss | Pattern A: `ui-button` | `<Button type="submit">` / `<Button type="button" onClick={close}>` |
| "Enter workspace" | Card footer, outside `<td>` | Primary card action | Pattern A: `ui-button` | `<Link to={/workspaces/${id}} className={uiPrimitives.button}>` |
| Archive/Reactivate button | Card footer, outside `<td>` | Secondary card action | Not a `<td>` — use a bordered icon button | `<button className="workspace-hub-card__menu-btn">` (compact, not primary weight) |
| "Create your first workspace" | Zero-state, outside `<td>` | Primary page action | Pattern A: `ui-button` | `<Link to="?create" className={uiPrimitives.button}>` |
| "Retry" (error state) | Page body, outside `<td>` | Recovery action | Pattern A: `ui-button` | `<Button onClick={reload}>` |

### 8.2 Anti-Pattern Check

| Anti-pattern (Section 4b) | Present in this proposal? |
|---------------------------|--------------------------|
| `<Button>` inside `<td>` | No — no tables in this design |
| Custom `background`, `border-radius` on links | No — all CTAs use `uiPrimitives.button` or BEM classes |
| `inlineLink` alone in `<td>` | No — no tables |
| `border-radius: var(--radius-card)` on buttons | No — buttons use `ui-button` which uses `var(--radius-button)` |
| MUI `<Button>` or `<Chip>` | No — fully migrated to design-system primitives |

---

## 9. Copy & i18n Strategy

### 9.1 Copy Key Map

Every rendered string maps to an existing `appCopy` key. No new copy keys are introduced in this proposal.

| UI Element | Copy Key | Fallback Text |
|------------|----------|---------------|
| Page title | `appCopy.ui.navigation.workspaces` | "Workspaces" |
| "New Workspace" button | `appCopy.ui.actions.createProject` | "Create workspace" |
| Zero-state CTA | `appCopy.ui.actions.createFirstProject` | "Create your first workspace" |
| Loading | `appCopy.ui.states.loadingProjects` | "Loading workspaces..." |
| Empty | `appCopy.ui.states.noProjectsAvailable` | "No workspaces available." |
| Error (fallback) | `appCopy.ui.fallbackErrors.loadProjects` | "Unable to load workspaces" |
| "Enter workspace" | `appCopy.ui.actions.enterWorkspace` | "Enter workspace" |
| Foundation section label | `appCopy.ui.workspace.dashboard.workspaceOverviewFoundationLabel` | "Foundation Assets" |
| Foundation — present | `appCopy.ui.workspace.dashboard.foundationStatusPresent(count)` | "{n} assets" |
| Foundation — missing | `appCopy.ui.workspace.dashboard.foundationStatusMissing` | "Missing" |
| Quality score | `appCopy.ui.workspace.dashboard.workspaceOverviewQuality(score)` | "{n}% quality" |
| Asset count | `appCopy.ui.workspace.dashboard.workspaceOverviewStatsAssets(count)` | "{n} assets" |
| Type count | `appCopy.ui.workspace.dashboard.workspaceOverviewStatsTypes(count)` | "{n} types" |
| Stale count | `appCopy.ui.workspace.dashboard.workspaceOverviewStatsStale(count)` | "{n} stale" |
| No assets | `appCopy.ui.workspace.dashboard.workspaceOverviewStatsNone` | "No assets yet" |
| Creation success | `appCopy.ui.feedback.projectsCreated` | "Workspace created." |
| "Retry" | `appCopy.ui.actions.retry` | "Retry" |
| "Cancel" | `appCopy.ui.actions.cancel` | "Cancel" |
| Dialog title | (hardcoded "Create New Workspace") | — |
| Dialog name label | (hardcoded "Workspace Name") | — |
| Dialog desc label | (hardcoded "Description (optional)") | — |

### 9.2 New Copy Keys (if needed)

If the domain team decides to add dedicated Hub-level copy, register keys under:
```
appCopy.ui.workspace.hub: {
  title: 'Workspaces',
  subtitleWorkspaces: (n: number, attention: number) => string,
  lastActivityLabel: 'Last activity',
  noRecentActivity: 'No sessions yet',
  archivedBadge: 'Archived',
  reactivateAction: 'Reactivate',
  archiveAction: 'Archive',
}
```
This is optional — the existing keys in Section 9.1 suffice for the initial implementation.

---

## 10. Acceptance Checklist

Per Section 9 of the Frontend UI Ubiquitous Language Spec, the following gates must pass:

### Gate 1: Archetype Declared
- [ ] PR description explicitly states "Data Table View (card-variant)"
- [ ] Justification for card-variant is included in PR description

### Gate 2: Canonical UI Terms
- [ ] Code comments reference "Data Table View" where applicable
- [ ] Component naming follows canonical vocabulary (e.g., `WorkspaceHubCard`, not "WorkspaceTile" or "ProjectCard")
- [ ] Feedback events reference canonical channel terms (`page-state`, `global`, `inline-action`)

### Gate 3: Table/List Rules (Section 4)
- [ ] Cards follow information hierarchy: primary (name), secondary (foundation), metadata (stats), action
- [ ] Status represented with text + visual token (CheckCircle/AlertTriangle + label), not color only
- [ ] Loading, empty, error states share same structural position across all cards
- [ ] Responsive fallback defined (single-column below 1024px)

### Gate 4: No New Local Visual Pattern
- [ ] Foundation status reuses `.foundation-status__item` + sub-classes from `dashboard-panels.css`
- [ ] Stats row mirrors `.workspace-overview__stats` pattern
- [ ] Card border/radius matches `.dashboard-panel` (12px radius, divider border)
- [ ] Page layout uses `max-width: 1200px` matching `WorkspaceLayout`
- [ ] No MUI components imported in `WorkspacesListPage`, `WorkspaceHubCard`, or `CreateWorkspaceDialog`

### Gate 5: Accessibility Baseline
- [ ] All interactive elements have keyboard focus indicators (`:focus-visible` rules in CSS)
- [ ] Archive/Reactivate button has `aria-label`
- [ ] Foundation status indicator uses icon + text (not icon-only)
- [ ] Dialog uses `<dialog>` semantics or `role="dialog"` with `aria-modal`
- [ ] Loading state uses `role="status" aria-live="polite"` (via `LoadingStateMessage`)
- [ ] Error state uses `role="alert"` (via `ErrorStateMessage`)

### Gate 6: Feedback Channel Consistency
- [ ] Project list loading/empty/error → `page-state` (via `Page State Message` primitives)
- [ ] Card-level loading/error → `page-state` (inside card body)
- [ ] Workspace creation success → `global` (via `FeedbackMessageProvider`)
- [ ] Workspace creation failure → `inline-action` (dialog error message)
- [ ] Archive/Reactivate success → `global`
- [ ] Archive/Reactivate failure → `global`
- [ ] No channel overlap (same event rendered in both `page-state` and `global`)

### Gate 7: Feedback Event Registry
- [ ] Every new feedback event maps to a row in Section 7 of this proposal
- [ ] No ad-hoc `alert()` or `console.error()` for user-facing feedback

### Gate 8: Anti-Pattern Prevention
- [ ] No `<Button>` inside `<td>` (N/A — no tables)
- [ ] No custom `background`/`border-radius` on CTA links
- [ ] No `inlineLink` used as primary CTA
- [ ] No MUI components remaining in touched files

### Gate 9: Implementation Accuracy
- [ ] CSS changes only append to `dashboard-panels.css` (or remove old `.workspace-list-*` classes after migration is stable)
- [ ] `WorkspaceHubCard` file created at `apps/frontend/src/features/workspace/ui/WorkspaceHubCard.tsx`
- [ ] `WorkspacesListPage` updated in-place at existing path
- [ ] All existing tests continue to pass (route tests, workspace context tests)
- [ ] New unit test for `WorkspaceHubCard` covering: ready state, loading skeleton, empty workspace, archived badge, foundation tool presence/absence

---

## 11. Implementation Plan

### Phase 1: Component Creation (non-breaking)
1. Create `WorkspaceHubCard.tsx` with all sub-states (loading/error/ready/empty/archived)
2. Create `CreateWorkspaceDialog.tsx` with design-system primitives
3. Add new CSS classes to `dashboard-panels.css`
4. Write unit tests for `WorkspaceHubCard`

### Phase 2: Page Refactor
1. Rewrite `WorkspacesListPage.tsx`:
   - Replace `.workspace-list-page` wrapper with `.workspace-hub`
   - Replace single-column stack with `.workspace-hub-grid`
   - Replace inline `WorkspaceCard` with `WorkspaceHubCard`
   - Replace MUI dialog with `CreateWorkspaceDialog`
   - Add zero-state layout
2. Verify route tests still pass
3. Manual QA: keyboard navigation, responsive breakpoints, loading/error/empty states

### Phase 3: Cleanup
1. Remove deprecated CSS classes (`.workspace-list-page`, `.workspace-list-card`, `.workspace-list-card__*`)
2. Remove unused MUI imports from `WorkspacesListPage.tsx`
3. Final accessibility audit (axe run)

---

## 12. Open Questions

1. **Workspace filtering**: Should the Hub support filtering by status (active/archived/all)? The current implementation shows all workspaces. A simple toggle or segmented control could be added to the page header. **Decision**: Defer to Phase 2 — start with "all workspaces" and add filtering when user feedback demands it.

2. **Workspace sorting**: Currently sorted by API response order (creation time). Should users sort by name, last activity, or quality score? **Decision**: Defer — the API returns in natural order; client-side sorting can be added as a toolbar enhancement.

3. **Batch endpoint**: Should we create `GET /api/projects/summaries` now or defer? **Decision**: Defer — parallel card-level loading with SWR caching is acceptable for current workspace counts. Monitor performance before optimizing.

4. **"New Workspace" dialog trigger**: Using `?create` query param vs. local state. Query param allows direct linking to the create dialog (e.g., from onboarding). **Decision**: Use local state (`useState<boolean>`) for simplicity. Add `?create` support in Phase 2 if needed.

---

**Revision History**:
- v1.0 (2026-07-19): Initial proposal covering archetype classification, component tree, data strategy, CSS, states, CTA governance, and acceptance checklist.
