---
status: draft
version: 1.0
last-reviewed: 2026-07-21
next-review-date: 2026-08-21
owner: Frontend Platform Team
type: design-proposal
tags: [dashboard, workspace-centric, ui-convergence, copy]
goal: Redesign copy, layout, and UX of the global Dashboard (`/dashboard`) so it acts as an action-oriented, workspace-centric entry point — surfacing Foundation/Asset health and next actions across workspaces — instead of a generic vanity-metrics landing page, while staying strictly non-overlapping in purpose with the Workspace Hub (`/workspaces`).
---

# Dashboard Workspace-Centric Restyling Proposal

## 0. Precedent And Scope

This proposal follows the same governance depth and structure as [`workspace-hub-restyling-proposal.md`](./workspace-hub-restyling-proposal.md) (the Workspace Hub restyling, already implemented for `/workspaces`). It reuses that proposal's conclusions wherever architecturally relevant (card-variant Data Table View precedent, `.foundation-status__*` / `.workspace-overview__*` CSS reuse, N+1 query posture) and explicitly cross-references it rather than re-deriving already-settled decisions.

Mandatory governance sources read and honored:
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md` (Asset domain model ownership, line ~14; Frontend/UI Context, lines ~108-129)
- `docs/07-governance/domain-naming-decision-log.md` — DDD-188→DDD-207 (Asset domain), DDD-210/212/214 (Foundation tool identities), DDD-219→DDD-225 (asset-capable classification), DDD-093 (`ToolAvailabilityStatus` tri-state)
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` (binding for archetype, CTA, feedback channel, token rules)
- `docs/02-design/specifications/workspace-hub-restyling-proposal.md` (structural and stylistic precedent)
- `docs/02-design/promote-to-asset-deterministic-mapping-review.md` (tool→AssetType deterministic mapping, used to validate Recommended Next Action generation logic)

---

## 1. Archetype Classification

### 1.1 Canonical Archetype: Data Table View (card-variant), Overview Companion

Per the Frontend UI Ubiquitous Language Spec (Section 3.2), any page that is primarily a cross-entity aggregate/index view maps to **Data Table View**. `/dashboard` aggregates data across *multiple* workspaces (not a single workspace, and not a flat entity list), so it is classified — by the same reasoning already applied to `/workspaces` (Section 1.1 of the Hub proposal) and to `/admin` (Spec Section 3.2.3, "Admin Overview companion") — as:

> **Data Table View (card-variant), Overview Companion.**

Justification:
- **Not tabular**: dashboard cards carry heterogeneous nested data (Foundation completeness, tool recommendation reasoning, session recency) — same non-tabular argument already accepted for `/workspaces` (Hub proposal §1.1).
- **Overview companion, not primary index**: like `/admin` (Spec §3.2.3), `/dashboard` is a KPI-first, read-oriented landing surface that triages the user toward downstream pages (`/workspaces`, `/workspaces/:id`, `/workspaces/:id/tools/:toolKey`). It does not own list-management operations (create/archive/filter workspaces) — those remain owned by `/workspaces` (Hub) per the purpose split defined in §3 below.
- **Precedent applied**: the same "KPI widget cards with deterministic `loading`/`empty`/`error`/`ready` state" companion pattern used for `/admin` (Spec §3.2.3) and the card-grid pattern used for `/workspaces` (Hub proposal) are both reused here — no new archetype is introduced.

### 1.2 Naming Convention

| Term | Canonical Name | Source |
|------|---------------|--------|
| Page component | `DashboardPage` (unchanged) | `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx` |
| Cross-workspace summary hook | `useDashboardOverview` (new) | This proposal — see §5 |
| Hero/greeting section | `DashboardHeroPanel` (new) | This proposal |
| Foundation/Asset health summary card | `DashboardFoundationSummaryPanel` (new) | This proposal |
| Recommended actions list | `DashboardRecommendedActionsPanel` (new) | This proposal |
| Recent cross-workspace activity | `DashboardRecentActivityPanel` (new, distinct from the dead-code per-workspace `RecentActivityPanel.tsx`) | This proposal |
| Active workspaces quick-access | `DashboardActiveWorkspacesPanel` (new) | This proposal |
| UI-layer recommendation concept | `ToolRecommendation` (reused, **not renamed**) | `apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts` |
| UI-layer aggregate item wrapping a `ToolRecommendation` with its source workspace | `WorkspaceToolRecommendation` (new, UI-layer derivation, non-canonical — see §12 Q1) | This proposal |

No domain term is renamed or introduced. `ToolRecommendation` (already defined in `useToolRecommendations.ts`) is reused verbatim as required by the task instructions; `WorkspaceToolRecommendation` is an explicit UI-layer derivation (analogous in status to `FoundationToolStatus` in `useWorkspaceContext.ts`, which itself carries the comment *"not a canonical domain term"*).

---

## 2. Current State Analysis (Problems)

### 2.1 Vanity-metrics KPI block, no action orientation

`DashboardPage.tsx:54-76` renders a `TopBar` with two raw counters (`projectsCount`, `sessionsCount`) pulled from `useProjectsQuery`/`useSessionsQuery` totals. Neither number is actionable: a user cannot tell from "3 workspaces / 12 sessions" what to do next. This is the generic "admin overview" anti-pattern the task brief explicitly rejects ("non una pagina di vanity metrics").

### 2.2 Static editorial cards duplicating `/workspaces` with no differentiation

`DashboardPage.tsx:78-99` renders two `DashboardPanel` cards ("Your strategies" / "Generation for your strategy") whose only content is generic copy plus a link to `/workspaces`. Both `appCopy.editorial.dashboard.cards.projects` and `.cards.tools` (`system.ts:977-985`) are vague marketing copy with **zero live data**. The `DashboardPage.test.tsx` file (lines 74-80) locks in this duplication by asserting that a "Tools" link exists pointing to `/workspaces` — i.e. the test currently *enforces* the drift this proposal removes.

### 2.3 Zero Asset/Foundation visibility at the aggregate level

Nothing on `/dashboard` surfaces Foundation completeness (Brief / Brand Voice / Personas) or Asset health across workspaces, even though this is — per the Bounded Context Map (line 14) — the defining property of the workspace-centric model: *"Assets are property of the Project... unlike Artifacts which are content produced in the Project."* The single-workspace `WorkspaceDashboard` (`WorkspaceDashboard.tsx`) already renders this via `WorkspaceOverviewCard` + `foundation-status__*`, but the cross-workspace aggregate view has no equivalent. A returning user with 5 workspaces, 3 of which are missing a Brief, has no way to see this without opening each workspace individually.

### 2.4 No "what should I do now" entry point

`useToolRecommendations` (readiness/impact/priority scored `ToolRecommendation[]`) exists and is fully implemented, but is **only consumed by `CrossToolWorkflowPanel`** inside the single-workspace Tool Workspace Page context (per the Frontend UI Spec §3.1: *"Cross-tool workflow state is displayed in the Dashboard, not in individual Tool pages"* — a rule that is **currently violated**, since the panel lives inside the Tool page, not the Dashboard). The global Dashboard has no recommendation surface at all. This is the single most consequential gap relative to the task's second requirement ("utile a iniziare già a svolgere la propria attività").

### 2.5 Redundant/duplicated recent-sessions rendering, wrong primitive family

`DashboardPage.tsx:101-124` renders recent sessions as a raw `<ul className={uiPrimitives.listClean}>` with a bespoke `.ui-dashboard-session-link` class (`styles.css:2406-2422`), while the *existing* canonical pattern for "recent sessions" is `RecentSessionsPanel.tsx` (`.dashboard-item-row` family, already used inside `WorkspaceDashboard`). Two different visual patterns render conceptually the same content (a list of recent sessions) — a direct violation of UL Spec Acceptance Gate 4 ("no new local visual pattern is introduced when a canonical one exists").

### 2.6 Dead code adjacent to the page being restyled

`FoundationToolsPanel.tsx` and `RecentActivityPanel.tsx` (both in `apps/frontend/src/features/workspace/ui/dashboard/`) are not imported anywhere in the codebase (verified: only self-referenced by their own file and tests). They duplicate functionality already covered by `WorkspaceOverviewCard` (Foundation) and `RecentSessionsPanel` (activity), respectively. `ContextualToolsPanel.tsx` is mounted (inside `WorkspaceDashboard`) but still uses MUI `Chip` in violation of UL Spec §8 anti-patterns table ("MUI `color=...` on MUI components... injects MUI palette CSS variables at runtime").

### 2.7 CTA Governance violations in the current implementation

| Violation | Location | Rule Broken |
|---|---|---|
| Bespoke `.ui-dashboard-session-link` class instead of reusing `.dashboard-item-row` | `DashboardPage.tsx:114-119`, `styles.css:2406` | UL Spec §9 Gate 4 — no new local visual pattern when canonical exists |
| Two `<Link to="/workspaces">` rendered as `inlineLink` inside cards whose *sole content* is that link (no real card body value) | `DashboardPage.tsx:82-84, 93-95` | Borderline Pattern B misuse — an `inlineLink` standing in for what is effectively the entire card's purpose should instead be a real primary CTA (Pattern A) if it is the card's main action |
| `RecentActivityPanel`/`ContextualToolsPanel` use MUI `Chip`, `Typography` with palette props | `RecentActivityPanel.tsx:1,71-77`, `ContextualToolsPanel.tsx:1,54-59` | UL Spec §8 anti-pattern table (MUI palette props bypass dark-mode tokens) — not directly in `/dashboard` scope today, but must not be reused as source of copy-paste when building new Dashboard panels |

### 2.8 Copy problems

`appCopy.editorial.dashboard` (`system.ts:963-989`) is written in an abstract, marketing register ("Your growth strategy, protected", "Every workspace is treated as if the budget were our own") with **no reference to workspaces, Foundation, Assets, or actionable next steps**. The three stat labels (`stats: ['Protected strategies', 'Completed sessions', 'Available credits']`, `system.ts:972-976`) don't even match what is rendered — the code only ever binds `stats[0]` and `stats[1]` (`DashboardPage.tsx:65,73`) to `projectsCount`/`sessionsCount`; `stats[2]` ("Available credits") is dead copy, since there is no credits KPI rendered anywhere on the page. This is a live copy/code drift that predates this proposal and must be resolved as part of it.

---

## 3. Architectural Decision: `/dashboard` vs `/workspaces` Purpose Split

This decision directly answers the task's requirement #3 ("considerare esplicitamente se `/dashboard` debba assorbire funzionalità di `/workspaces`").

**Decision: `/dashboard` remains a distinct, thin "at-a-glance + act now" layer above `/workspaces`. It does not absorb `/workspaces` management functionality.**

| Concern | `/dashboard` (this proposal) | `/workspaces` (Hub, already restyled) |
|---|---|---|
| Primary question answered | "What should I do right now, across all my workspaces?" | "Show me and let me manage all my workspaces." |
| Scope | Cross-workspace aggregate, read-mostly, action-triage | Per-workspace management: create, archive/reactivate, browse |
| Mutations owned | None (dashboard triggers navigation only — no create/archive here) | Create workspace, archive/reactivate (Hub proposal §5.4-5.5) |
| Card unit | `WorkspaceToolRecommendation` (tool-centric, cross-workspace) + aggregate Foundation summary | `WorkspaceHubCard` (workspace-centric, single workspace per card) |
| Primary CTA | "Resume" / "Continue in <tool>" (jumps directly into a Tool Workspace Page) | "Enter workspace" (jumps into a Workspace Dashboard) |
| Data depth per workspace | Rolled up into 1-3 numbers + top N recommendations | Full per-workspace card: Foundation, stats, activity |

Rationale:
1. **Avoiding overlap is explicitly required by the task** ("suggerire una differenziazione di scopo chiara"). Absorbing `/workspaces` into `/dashboard` would either bloat the dashboard into the same "browse all workspaces" surface (redundant with the already-restyled Hub) or force the Hub to lose its dedicated management affordances (create/archive), which are out of place on a first-screen dashboard.
2. **Existing routing evidence supports the split**: `app-router.tsx` already treats `/dashboard` and `/workspaces` as structurally distinct top-level routes with distinct redirect semantics (`/dashboard/projects*` redirects to `/workspaces`, confirming `/dashboard` was never meant to own workspace-listing logic).
3. **The Workspace Hub proposal's card already covers full single-workspace depth** (Foundation, stats, activity, archive controls). Reproducing that on `/dashboard` at N-workspace scale would either force pagination (defeating the "at-a-glance" purpose) or a flattened/lossy view (defeating the Hub's own "no tabular flattening" rationale, Hub proposal §1.1).
4. **`/dashboard` earns its own reason to exist by being tool-recommendation-first, not workspace-list-first.** The unit of value on the Dashboard is "the next action" (`WorkspaceToolRecommendation`), not "the workspace" — this is the differentiator that makes the page non-redundant.

**Consequence**: `/dashboard` shows at most **N=5 recent/active workspaces** as compact quick-access chips (not full `WorkspaceHubCard`s) and defers full workspace browsing to `/workspaces` via an explicit `inlineLink`/`ui-button` (Pattern A, "View all workspaces").

---

## 4. Proposed Layout Structure

### 4.1 Page-Level Layout (ASCII)

```
┌────────────────────────────────────────────────────────────────────┐
│ ui-stack (page wrapper, max-width via .workspace-hub convention)  │
│                                                                    │
│ DashboardHeroPanel                                        1200px  │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ <p class="ui-meta-line"> Welcome back                          ││
│ │ <h2> {greeting: e.g. "Continue where you left off"}            ││
│ │ <p>  {contextual subtitle, e.g. "You have 2 workspaces ready   ││
│ │       to generate and 1 missing its Brief."}                   ││
│ │                                                                ││
│ │ [Primary CTA — Pattern A]                                      ││
│ │   "Resume {workspaceName} → {toolLabel}"  (if a clear resume   ││
│ │    candidate exists: most-recent active session's workspace)   ││
│ │   OR "Choose a workspace" → /workspaces (if none)               ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ DashboardFoundationSummaryPanel        (dashboard-panel, reused)  │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ Title: "Foundation across workspaces"                          ││
│ │                                                                ││
│ │ foundation-status__item (Brief)     foundation-status__item    ││
│ │  ✓ 4/5 workspaces        (Brand Voice) ⚠ 2/5 workspaces        ││
│ │                          foundation-status__item (Personas)    ││
│ │                           ⚠ 1/5 workspaces                     ││
│ │                                                                ││
│ │ footer: inlineLink "Complete Foundation →" (jumps to the       ││
│ │         single workspace with the most gaps)                   ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ ui-dashboard-grid (2-col, reused .dashboard-grid)                 │
│ ┌───────────────────────────────┐ ┌──────────────────────────────┐│
│ │ DashboardRecommendedActions   │ │ DashboardRecentActivityPanel ││
│ │ Panel (dashboard-panel)       │ │ (dashboard-panel)            ││
│ │                                │ │                              ││
│ │ dashboard-item-row (×N, N≤5)  │ │ dashboard-item-row (×N, N≤5) ││
│ │  Angle Generator                │ │  Project A · Funnel Pages    ││
│ │  "Ready — all inputs available" │ │  2h ago · 4 artifacts        ││
│ │  in Project A          [Use →]  │ │                              ││
│ │                                │ │  Project B · TOV Generator   ││
│ │  Meta-Ads Generator             │ │  1d ago · 1 artifact         ││
│ │  "Needs persona — fills 1 gap"  │ │                              ││
│ │  in Project B          [Use →]  │ │                              ││
│ │                                │ │                              ││
│ │ footer: (none — list is        │ │ footer: inlineLink           ││
│ │  self-contained, ≤5 items)      │ │  "View all sessions →"       ││
│ └───────────────────────────────┘ └──────────────────────────────┘│
│                                                                    │
│ DashboardActiveWorkspacesPanel     (dashboard-panel, full width)  │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ Title: "Your workspaces"                                       ││
│ │                                                                ││
│ │ [chip: Project A · healthy]  [chip: Project B · needs review]  ││
│ │ [chip: Project C · healthy]                                    ││
│ │                                                                ││
│ │ footer: ui-button "View all workspaces →" (Pattern A, → /workspaces) │
│ └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ (Zero-state — replaces entire page body when hasNoProjects)      │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │           Everything starts with a workspace.                  ││
│ │    [Create your first workspace]  (ui-button, Pattern A)       ││
│ └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Layout Rationale

- **Hero is the action anchor, not a metrics banner.** It replaces the current two-KPI `TopBar` (`ui-dashboard-kpi-topbar`) with a single deterministic primary CTA computed from `useDashboardOverview` (see §5): resume the most recently touched workspace/session if one exists, otherwise route to workspace selection. This directly satisfies task requirement #2 ("almeno una entry point azionabile immediato").
- **Foundation summary is the aggregate signal that most differentiates workspace-centric thinking** from generic dashboards — it surfaces the same `foundation-status__*` visual language already used per-workspace (`WorkspaceOverviewCard`), rolled up as a fraction across all workspaces ("4/5 have a Brief"). This reuses canonical CSS with zero new patterns (UL Spec Gate 4).
- **Two-column grid (`dashboard-grid`, already defined in `dashboard-panels.css:103-107`)** hosts Recommended Actions (left) and Recent Activity (right) — mirroring the exact grid already used inside `WorkspaceDashboard.tsx:22` (`RecentSessionsPanel` + `RecentAssetsPanel`), extended to cross-workspace scope.
- **Recommended Actions panel is the direct promotion of `useToolRecommendations`** to dashboard scope (aggregated across workspaces — see §5.2), replacing the two static, data-free editorial cards described in §2.2. This directly satisfies task requirement #2's "usa un tool raccomandato" entry point.
- **Active Workspaces panel is intentionally shallow** (compact status chips, not full `WorkspaceHubCard`s) — enforcing the purpose split from §3. Its only actions are navigational: click a chip to open that workspace, or click the panel's Pattern-A CTA to go to the full Hub.
- **No nested cards.** Every panel body uses `dashboard-item-row` / `foundation-status__item` list items with dividers, not boxed sub-cards — consistent with UL Spec §3 global composition rule.

### 4.3 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| ≥ 980px | Hero full width; Foundation Summary full width; Recommended Actions + Recent Activity as 2-column `dashboard-grid`; Active Workspaces full width |
| 760px–979px | Same vertical order, `dashboard-grid` collapses to 1 column (existing rule, `dashboard-panels.css:407-410`, extended breakpoint already governed by UL Spec §14 — `980px` is the canonical desktop↔tablet breakpoint) |
| < 760px | All panels stack full width; Foundation Summary items wrap (`flex-wrap: wrap`, already default on `.workspace-overview__foundation-row`); Active Workspace chips wrap to multiple rows |

No new breakpoint values are introduced — `980px` and `760px` are reused per UL Spec §14 (the only two canonical breakpoints relevant to non-admin pages).

---

## 5. Component Tree (Concrete)

### 5.1 Page Component: `DashboardPage`

```
DashboardPage  (apps/frontend/src/features/dashboard/pages/DashboardPage.tsx — REFACTORED)
│
├── [state: loading]  <LoadingStateMessage>{appCopy.ui.states.loadingDashboard}</LoadingStateMessage>
├── [state: error]    <ErrorStateMessage>{...}</ErrorStateMessage>
├── [state: zero-state] existing .ui-dashboard-zero-state block — UNCHANGED (already compliant, Pattern A CTA)
│
└── [state: ready]
    ├── DashboardHeroPanel                       (NEW — apps/frontend/src/features/dashboard/ui/DashboardHeroPanel.tsx)
    │     ├── <p className={uiPrimitives.metaLine}>  {appCopy.editorial.dashboard.eyebrow}
    │     ├── <h2>                                    {greeting headline, dynamic}
    │     ├── <p>                                      {contextual subtitle, dynamic}
    │     └── Primary CTA (Pattern A: <Link className={uiPrimitives.button}>)
    │           "Resume {workspaceName} → {toolLabel}" OR "Choose a workspace"
    │
    ├── DashboardFoundationSummaryPanel           (NEW — apps/frontend/src/features/dashboard/ui/DashboardFoundationSummaryPanel.tsx)
    │     └── uses DashboardPanel (reused) + foundation-status__item ×3 (Brief/BrandVoice/Personas)
    │           footer: inlineLink → most-gapped workspace's tool route
    │
    ├── <section className={uiPrimitives.dashboardGrid}>
    │     ├── DashboardRecommendedActionsPanel     (NEW — .../ui/DashboardRecommendedActionsPanel.tsx)
    │     │     └── uses DashboardPanel (reused) + dashboard-item-row ×N (bordered-chip CTA per row — see §8)
    │     │
    │     └── DashboardRecentActivityPanel         (NEW — .../ui/DashboardRecentActivityPanel.tsx)
    │           └── uses DashboardPanel (reused) + dashboard-item-row ×N (reuses RecentSessionsPanel row markup pattern)
    │
    └── DashboardActiveWorkspacesPanel             (NEW — .../ui/DashboardActiveWorkspacesPanel.tsx)
          └── uses DashboardPanel (reused) + compact chip row
                footer: ui-button "View all workspaces" (Pattern A) → /workspaces
```

### 5.2 Component File Map

| Component | File Path | Status |
|---|---|---|
| `DashboardPage` | `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx` | **Refactored** |
| `useDashboardOverview` | `apps/frontend/src/features/dashboard/runtime/useDashboardOverview.ts` | **New** |
| `DashboardHeroPanel` | `apps/frontend/src/features/dashboard/ui/DashboardHeroPanel.tsx` | **New** |
| `DashboardFoundationSummaryPanel` | `apps/frontend/src/features/dashboard/ui/DashboardFoundationSummaryPanel.tsx` | **New** |
| `DashboardRecommendedActionsPanel` | `apps/frontend/src/features/dashboard/ui/DashboardRecommendedActionsPanel.tsx` | **New** |
| `DashboardRecentActivityPanel` | `apps/frontend/src/features/dashboard/ui/DashboardRecentActivityPanel.tsx` | **New** |
| `DashboardActiveWorkspacesPanel` | `apps/frontend/src/features/dashboard/ui/DashboardActiveWorkspacesPanel.tsx` | **New** |
| `DashboardPanel` | `apps/frontend/src/features/workspace/ui/dashboard/DashboardPanel.tsx` | **Reused verbatim** (import across feature boundary — already exported, no relocation needed) |
| CSS | `apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css` | **Extended** (new `.dashboard-hero__*`, `.dashboard-recommendation__*`, `.dashboard-workspace-chip__*` classes only — see §6) |
| CSS (legacy, to remove) | `apps/frontend/src/styles.css` (`.ui-dashboard-kpi-*`, `.ui-dashboard-card*`, `.ui-dashboard-session-link`, `.ui-kpi-*`) | **Removed** after migration (see §11 Phase 3) |
| Dead code removal | `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.tsx`, `RecentActivityPanel.tsx` | **Removed** (confirmed zero non-self imports) |

`DashboardPanel` currently lives under the `workspace` feature folder but is feature-agnostic (`title`, `loading`, `error`, `empty`, `children`, `footer` props only — see `DashboardPanel.tsx:5-12`). This proposal imports it as-is into `features/dashboard/`; a folder relocation to a shared `app/ui/` location is flagged as an **Open Question** (§12 Q4), not executed in this proposal to minimize diff surface.

---

## 6. Data Sources & Query Strategy

### 6.1 New Aggregate Hook: `useDashboardOverview`

```
useDashboardOverview()
│
├── useProjectsQuery()                         ← GET /api/projects (single request, existing)
│     └── ProjectSummary[]  { id, name, description, status, updatedAt }
│
├── useSessionsQuery({})                        ← GET /api/sessions (single request, existing, unscoped = all projects)
│     └── SessionSummary[]  { sessionId, projectId, toolKey, status, artifactCount, updatedAt }
│
└── per active (non-archived) ProjectSummary, bounded to top K=5 by `updatedAt` recency:
      useWorkspaceContext(project.id)            ← GET /api/projects/{id}/assets (parallel, existing hook)
          └── assets[], foundationTools[], gaps[], workflowPosition, overallQualityScore
      useToolRecommendations(project.id)          ← composes useWorkspaceContext internally (existing hook)
          └── ToolRecommendation[] (readinessScore, impactScore, priorityScore, reason)
```

`useDashboardOverview` is a **composition hook** (Application-Layer, Frontend/UI — same classification pattern as `GenerationRequestAssembly`, DDD-032: it contains no domain logic, only orchestrates existing hooks and derives read-model projections). It does not introduce a new backend endpoint in Phase 1 (see §6.3 for the Phase 2 optimization path already anticipated by the Workspace Hub proposal §5.2).

Its output shape (UI-layer only, not a domain contract):

```ts
interface DashboardOverviewData {
  loading: boolean;
  error: string | null;
  resumeCandidate: { workspaceId: string; workspaceName: string; toolKey: string; toolLabel: string; sessionId: string } | null;
  foundationSummary: {
    toolKey: string;            // 'brief-generator' | 'tov-generator' | 'personas-generator'
    label: string;
    workspacesWithAsset: number;
    totalWorkspaces: number;
  }[];
  recommendations: WorkspaceToolRecommendation[];   // top N=5 across scanned workspaces, sorted by priorityScore desc
  recentSessions: SessionSummary[];                 // top N=5 across all projects, sorted by updatedAt desc
  activeWorkspaces: { id: string; name: string; qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked' }[];
  mostGappedWorkspaceId: string | null;              // for Foundation Summary footer link
}
```

`WorkspaceToolRecommendation` extends `ToolRecommendation` (reused type, `useToolRecommendations.ts`) with the source workspace identity:

```ts
// UI-layer derivation, non-canonical — pattern per useWorkspaceContext.ts "Foundation Tool" comment
interface WorkspaceToolRecommendation extends ToolRecommendation {
  workspaceId: string;
  workspaceName: string;
}
```

### 6.2 Bounding The Fan-Out (K=5 Scan Limit)

To avoid unbounded N+1 fan-out on accounts with many workspaces, `useDashboardOverview` scans **only the top K=5 workspaces by `updatedAt` recency** (from the already-fetched `ProjectSummary[]`) for `useWorkspaceContext`/`useToolRecommendations` calls. This is a pragmatic, explicit bound — recommendations and Foundation summary are computed only over the most-recently-touched workspaces, which is also the correct product behavior (a dashboard should prioritize recent context, not stale archived workspaces).

This mirrors the Workspace Hub proposal's own accepted posture (§5.2 there): *"All cards mount simultaneously and fire their requests in parallel... For typical workspace counts (1-10), this is acceptable."* The Dashboard is strictly less exposed to fan-out than the Hub, because it additionally caps the scan to K=5 regardless of total workspace count.

### 6.3 Addressing N+1 — Phase 1 (this proposal) vs Phase 2 (deferred)

**Phase 1 (this proposal, matches Hub proposal precedent):**
- `useDashboardOverview` fires ≤ 5 parallel `useWorkspaceContext` calls (each internally may also fire `useAssetSuggestions`/`listAssets`).
- SWR caching (already used by `useProjectsQuery`/`useSessionsQuery` via `useSWRQuery`) prevents redundant re-fetches when the user navigates `/dashboard` → `/workspaces/:id` → back to `/dashboard` (same cache keys).
- Acceptable for the documented target scale (1-10 workspaces per account, per Hub proposal §5.2).

**Phase 2 (deferred, explicitly anticipated by both this proposal and the Hub proposal's own Open Question #3):**
- Introduce a single batched endpoint, e.g. `GET /api/projects/overview?limit=5&sort=updatedAt`, returning per-workspace `{ foundationTools, gaps, overallQualityScore, latestSession }` in one round trip, plus a companion `GET /api/tools/recommendations?scope=account&limit=5` if recommendation computation needs to move server-side for performance.
- Not implemented in this proposal — see Open Questions §12 Q2 for the trigger condition to revisit.

### 6.4 Per-Component Data Requirements

| Component | Data Source | Loading State | Error State | Empty Handling |
|---|---|---|---|---|
| `DashboardPage` (page-level) | `useProjectsQuery()` (for zero-state gate) | `LoadingStateMessage` centered | `ErrorStateMessage` with retry | existing zero-state (`hasNoProjects`) — unchanged |
| `DashboardHeroPanel` | `useDashboardOverview().resumeCandidate` | Skeleton headline/subtitle (inline, not a separate panel state) | Falls back to generic "Choose a workspace" CTA — never blocks the page | If `resumeCandidate` is null, renders "Choose a workspace" CTA (still Pattern A) |
| `DashboardFoundationSummaryPanel` | `useDashboardOverview().foundationSummary` | `DashboardPanel loading` prop | `DashboardPanel error` prop | `DashboardPanel empty` prop when `totalWorkspaces === 0` for all tools (should not occur post zero-state gate, defensive only) |
| `DashboardRecommendedActionsPanel` | `useDashboardOverview().recommendations` | `DashboardPanel loading` prop | `DashboardPanel error` prop | `DashboardPanel empty` prop with copy "All caught up — every recent workspace has what it needs" |
| `DashboardRecentActivityPanel` | `useSessionsQuery({})` (unscoped, all projects) — reused directly, not through the aggregate hook, since it needs no per-workspace fan-out | `DashboardPanel loading` prop | `DashboardPanel error` prop | `DashboardPanel empty` prop, reuses `appCopy.editorial.sessions.emptyState` |
| `DashboardActiveWorkspacesPanel` | `useProjectsQuery()` (filtered to non-archived, top 5 by `updatedAt`) + per-workspace `qualityGateStatus` from `useDashboardOverview` | `DashboardPanel loading` prop | `DashboardPanel error` prop | Not reachable post zero-state gate |

### 6.5 No Mutations On This Page

Per the §3 purpose split, `/dashboard` triggers **no mutations** (no create/archive/promote actions). All interactive elements are navigational (`<Link>`), which simplifies feedback-channel governance considerably (see §8 — no `global` channel events originate from this page).

---

## 7. CSS & Token Alignment

### 7.1 Reused Classes (zero modification)

| Class | Source | Reused For |
|---|---|---|
| `.dashboard-panel`, `.dashboard-panel__header`, `.dashboard-panel__title`, `.dashboard-panel__content`, `.dashboard-panel__footer` | `dashboard-panels.css:1,74-101` | Every new panel wrapper |
| `.dashboard-grid` | `dashboard-panels.css:103-107` | Recommended Actions + Recent Activity 2-column layout |
| `.foundation-status__item`, `__icon`, `__label`, `__indicator`, `__indicator--present`, `__indicator--missing` | `dashboard-panels.css:444-482` | Foundation Summary panel rows (aggregate fraction instead of per-workspace present/missing) |
| `.dashboard-item-row`, `__primary`, `__meta`, `__badge` | `dashboard-panels.css:529-568` | Recommended Actions rows + Recent Activity rows |
| `.ui-meta-line`, `.ui-button`, `.ui-inline-link` | `primitives.tsx` / `styles.css` | Hero eyebrow/CTA, panel footers |
| `LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage` | `app/ui/primitives.tsx` | All page-level and panel-level states |
| `StatusBadge` | `app/ui/StatusBadge.tsx` | Recent Activity row status (replacing any MUI `Chip` usage that might otherwise be copy-pasted from `RecentActivityPanel.tsx`) |

### 7.2 New CSS Classes (added to `dashboard-panels.css`, token-only)

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

Every value above is a `var(--*)` token already defined in `styles.css` `:root` (light) and `:root[data-theme='dark']` — no hardcoded colors, spacing, radii, or shadows, per UL Spec §12.

### 7.3 Removal of Obsolete CSS (Phase 3, after migration is stable)

| Class | Location | Reason for removal |
|---|---|---|
| `.ui-dashboard-kpi-topbar`, `.ui-dashboard-kpi-item`, `.ui-kpi-label` (dashboard-specific usage) | `styles.css:2221-2247` | KPI topbar removed; `.ui-kpi-value`/`.ui-kpi-label` remain in use by Admin Overview widgets (`ui-admin-kpi-widget-state`, `styles.css:1218-1243`) — **do not delete the shared `.ui-kpi-value`/`.ui-kpi-label` base classes**, only the dashboard-specific `.ui-dashboard-kpi-*` wrapper classes once no longer referenced |
| `.ui-dashboard-card`, `.ui-dashboard-card-with-cta`, `.ui-dashboard-card-cta-*` | `styles.css:2352-2404` | Static editorial cards removed; these classes have no other known consumers (verify via grep before deletion in Phase 3) |
| `.ui-dashboard-session-link` | `styles.css:2406-2422` | Replaced by reused `.dashboard-item-row` |
| `.ui-dashboard-zero-state`, `.ui-dashboard-zero-state-inner` | `styles.css:2321-2350` | **Not removed** — zero-state is unchanged and remains compliant |

---

## 8. State Handling (Loading / Empty / Error / Ready)

### 8.1 Channel Mapping (per UL Spec §7)

| Event | Canonical Channel | Implementation |
|---|---|---|
| `useProjectsQuery` loading (page-level gate) | `page-state` | `<LoadingStateMessage>` centered, page body |
| `useProjectsQuery` error (page-level gate) | `page-state` | `<ErrorStateMessage>` with retry `ui-button` |
| `useProjectsQuery` empty → zero-state | `page-state` | Existing `.ui-dashboard-zero-state` block (unchanged) |
| `useDashboardOverview` per-panel loading (Foundation Summary, Recommended Actions, Active Workspaces) | `page-state` | `DashboardPanel loading` prop → `LoadingStateMessage` inside panel body |
| `useDashboardOverview` per-panel error (partial failure — e.g. one workspace's `useWorkspaceContext` fails) | `page-state` | `DashboardPanel error` prop inside the affected panel only; **does not** fail the whole page (graceful degradation — recommendations/Foundation summary simply exclude the failed workspace) |
| `useSessionsQuery({})` loading/error/empty (Recent Activity panel) | `page-state` | `DashboardPanel` loading/error/empty props, identical pattern to `RecentSessionsPanel` |
| Hero resume-candidate resolution (no data yet vs. resolved vs. none found) | `page-state` (implicit — no distinct loading UI, folded into hero's own inline skeleton per §6.4) | Inline skeleton text within `DashboardHeroPanel`, not a separate `LoadingStateMessage` block (avoids layout jump on a hero element) |

**No `global` channel events originate from `/dashboard`** — confirmed by §6.5 (no mutations on this page). This is a simpler channel profile than the Workspace Hub (which owns create/archive mutations).

### 8.2 Accessibility For Dynamic Aggregate States

- `DashboardFoundationSummaryPanel`, `DashboardRecommendedActionsPanel`, `DashboardRecentActivityPanel`, `DashboardActiveWorkspacesPanel` all render through `DashboardPanel`, which already wires `LoadingStateMessage`/`ErrorStateMessage`/`EmptyStateMessage` with `role="status" aria-live="polite"` / `role="alert"` (per `primitives.tsx:109-119`) — no new accessibility wiring is required, only correct prop usage.
- The Hero's dynamic resume-candidate text (which changes once `useDashboardOverview` resolves) must be wrapped in a `role="status" aria-live="polite"` container so screen readers announce the resolved greeting/CTA — this is a **new** requirement not covered by `DashboardPanel` (the Hero is not a `DashboardPanel`), and must be implemented directly in `DashboardHeroPanel.tsx`.

---

## 9. CTA Governance Alignment

### 9.1 CTA Inventory

| CTA | Location | Classification | Canonical Pattern | Implementation |
|---|---|---|---|---|
| "Resume {workspace} → {tool}" / "Choose a workspace" (Hero primary) | `DashboardHeroPanel`, outside `<td>` | Primary page action | **Pattern A**: `ui-button` | `<Link to={resumeRoute} className={uiPrimitives.button}>` |
| "Complete Foundation →" (Foundation Summary footer) | `DashboardFoundationSummaryPanel` footer, outside `<td>` | Secondary navigational hint in card footer | **Pattern B**: `inlineLink` | `<Link to={mostGappedWorkspaceToolRoute} className={uiPrimitives.inlineLink}>` |
| "Use →" (per recommendation row) | `DashboardRecommendedActionsPanel`, inside `dashboard-item-row` — **not** a `<td>` (this page has no tables) | Row-level navigational action inside a card list item | **Pattern B**: `inlineLink` (row context, not table cell — Pattern C's bordered-chip rule applies only to `<td>`; since there is no table here, plain `inlineLink` is correct per the decision rule in UL Spec §4b) | `<Link to={item.to} className={uiPrimitives.inlineLink}>` |
| "View all sessions →" (Recent Activity footer) | `DashboardRecentActivityPanel` footer | Secondary navigational hint | **Pattern B**: `inlineLink` | `<Link to="/artifacts">` or session archive route, `className={uiPrimitives.inlineLink}` |
| Workspace chip (per active workspace) | `DashboardActiveWorkspacesPanel` body | Inline navigational affordance (not primary, not in `<td>`) | **Pattern B**: `inlineLink`-family (custom `.dashboard-workspace-chip` visual, still governed as inline-navigational — see note below) | `<Link to={`/workspaces/${id}`} className="dashboard-workspace-chip">` |
| "View all workspaces →" (Active Workspaces footer) | `DashboardActiveWorkspacesPanel` footer | Primary panel action (this is the panel's designated escape-hatch to full management) | **Pattern A**: `ui-button` | `<Link to="/workspaces" className={uiPrimitives.button}>` |
| "Retry" (page-level error state) | Page body | Recovery action | **Pattern A**: `ui-button` | `<Button onClick={reload}>` |
| "Create your first workspace" (zero-state) | Zero-state | Primary page action | **Pattern A**: `ui-button` | Unchanged from current implementation |

**Note on the workspace chip**: `.dashboard-workspace-chip` is a bespoke visual (pill/chip shape) rather than the plain underline-style `.ui-inline-link`. This is analogous to the already-approved `.workspace-hub-card__archived-badge` non-CTA chip pattern and, more importantly, to the fact that Section 4b's decision tree only prescribes *exactly two* non-table CTA patterns (A: primary `ui-button`; B: `inlineLink`) — a compact status-carrying chip that is still fundamentally "an inline navigational hint inside... a card" resolves to Pattern B's intent (secondary, contextual, non-primary) even though its visual treatment borrows the chip shape already established by `.workspace-hub-card__archived-badge`. No new *pattern* is introduced — this is a card-context inline link using an existing compact-pill visual convention, not a fourth CTA class. This nuance is flagged explicitly in Open Questions (§12 Q3) for governance confirmation, since it is the one CTA in this proposal that does not map with zero ambiguity to Pattern A/B/C.

### 9.2 Anti-Pattern Check

| Anti-pattern (UL Spec §4b) | Present in this proposal? |
|---|---|
| `<Button>` inside `<td>` | No — no tables on this page |
| Custom `background`/`border-radius` overriding `.ui-button` | No — all primary CTAs use `uiPrimitives.button` unmodified |
| `inlineLink` used as a page's sole primary CTA | No — Hero and Active-Workspaces-footer both use Pattern A for their primary actions; `inlineLink` is reserved for secondary/contextual hints only |
| MUI `<Chip>`/`<IconButton>` newly introduced | No — all new components are MUI-free; `.dashboard-workspace-chip` is a plain `<Link>` with BEM class, not MUI `Chip` |
| `border-radius: var(--radius-card)` on a CTA element | No — `.dashboard-workspace-chip` uses `var(--radius-chip)`; `.ui-button` owns its own radius via the canonical class |

---

## 10. Copy & i18n Strategy

### 10.1 Language Confirmation

Verified against `system.ts`: all `appCopy.editorial.*` and `appCopy.ui.*` keys are written in **English** (e.g. `editorial.dashboard.headline: 'Your growth strategy, protected.'`, `ui.actions.enterWorkspace: 'Enter workspace'`). Italian only appears in **asset content prompts** (backend generation prompts, e.g. TOV/Persona output language per DDD-210/212/214) and in a few isolated extraction-field labels documented in the UL Spec §2.1 (`ExtractionFieldLabel`, it-IT, explicitly scoped to extraction guidance, not general UI copy). All new Dashboard copy in this proposal is therefore **English**, consistent with existing `editorial`/`ui` key conventions.

### 10.2 Old Key → New Text Map

| Old Key | Old Text | Disposition |
|---|---|---|
| `appCopy.editorial.dashboard.headline` | "Your growth strategy, protected." | **Replaced** — see new key `editorial.dashboard.heroHeadlineDefault` below (dynamic headline, static fallback) |
| `appCopy.editorial.dashboard.body` | "Every workspace is treated as if the budget were our own..." | **Removed** — no longer rendered as a static top-of-page paragraph; tone-of-voice preserved in the new `zeroState` and `heroSubtitle*` copy instead |
| `appCopy.editorial.dashboard.stats` (array) | `['Protected strategies', 'Completed sessions', 'Available credits']` | **Removed** — the two-KPI topbar is removed; `stats[2]` was already dead copy (§2.8) |
| `appCopy.editorial.dashboard.cards.projects.title` / `.body` | "Your strategies" / "Every workspace is a space where..." | **Removed** — static card removed, replaced by data-driven `DashboardFoundationSummaryPanel` |
| `appCopy.editorial.dashboard.cards.tools.title` / `.body` | "Generation for your strategy" / "Open Tools as the central hub..." | **Removed** — static card removed, replaced by data-driven `DashboardRecommendedActionsPanel` |
| `appCopy.editorial.dashboard.cards.recentSessions.title` | "Your history of results" | **Renamed** — see new key `editorial.dashboard.recentActivityTitle` ("Recent activity") for plain, concrete labeling consistent with `RecentSessionsPanel`'s existing title style |
| `appCopy.editorial.dashboard.zeroState.*` | — | **Unchanged** — zero-state copy is already concrete and workspace-centric ("Everything starts with a workspace.") and needs no revision |

### 10.3 New Copy Keys Proposed

All new keys are proposed under `appCopy.editorial.dashboard` (page-level narrative copy) and `appCopy.ui.dashboard` (new namespace for structural/panel labels, mirroring the existing `appCopy.ui.workspace.dashboard` namespace pattern but scoped to the *cross-workspace* dashboard rather than the per-workspace one — see naming note below).

```ts
editorial: {
  dashboard: {
    eyebrow: 'Welcome back',
    heroHeadlineResume: (toolLabel: string) => `Continue with ${toolLabel}`,
    heroHeadlineChoose: 'Choose a workspace to continue',
    heroSubtitleResume: (workspaceName: string) => `Pick up where you left off in ${workspaceName}.`,
    heroSubtitleChoose: 'Select a workspace to start generating or complete its Foundation.',
    heroCtaResume: (toolLabel: string) => `Resume ${toolLabel}`,
    heroCtaChoose: 'Choose a workspace',
    recentActivityTitle: 'Recent activity',
    // zeroState.* — unchanged, reused verbatim
  },
},
ui: {
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
    loadingDashboard: 'Loading dashboard...',
  },
},
```

**Naming note (governance check)**: the existing `appCopy.ui.workspace.dashboard` namespace (`system.ts:839-888`) is scoped to the **single-workspace** `WorkspaceDashboard` page (`/workspaces/:id`) and its panels (`DashboardPanel`-based, e.g. `foundationToolsTitle`, `recentSessionsTitle`). Introducing `appCopy.ui.dashboard` (top-level, no `workspace.` prefix) for the **cross-workspace** `/dashboard` page copy avoids namespace collision while making the scope distinction between "the Dashboard route" and "a workspace's dashboard tab" explicit and greppable. This mirrors the existing top-level/nested split already present in the codebase (e.g. `appCopy.ui.navigation.dashboard` = nav label vs. `appCopy.ui.workspace.dashboard.*` = per-workspace panel copy) and does not introduce a new domain term — `dashboard` here is a Frontend/UI route/page name, not a canonical domain concept, and requires no DDD log entry.

Several existing `appCopy.ui.workspace.dashboard.*` keys are **reused verbatim** by the new panels where the underlying UI concept is identical across scope (single-workspace vs. cross-workspace): `foundationStatusPresent`, `foundationStatusMissing`, `foundationLabelBrief`, `foundationLabelBrandVoice`, `foundationLabelPersonas`, `artifactCountLabel`, `loadingGeneric`, `viewAllSessionsArrow`.

---

## 11. Acceptance Checklist

Per UL Spec §9, the following gates must pass:

### Gate 1: Archetype Declared
- [ ] PR description explicitly states "Data Table View (card-variant), Overview Companion"
- [ ] Justification (non-tabular data + overview-companion precedent from `/admin` and `/workspaces`) is included

### Gate 2: Canonical UI Terms
- [ ] Code comments/docs reference "Data Table View" / "Overview Companion" where applicable
- [ ] `ToolRecommendation` type is imported and reused, never redefined locally
- [ ] `WorkspaceToolRecommendation` is explicitly commented as "UI-layer derivation, non-canonical" at its definition site
- [ ] Feedback events reference canonical channel terms (`page-state`); no `global`/`inline-action` events are fabricated where none exist

### Gate 3: Table/List Rules (UL Spec §4, applied to card/list rows)
- [ ] Recommended Actions and Recent Activity rows follow information hierarchy: primary (label), secondary (reason/meta), action last
- [ ] Foundation Summary status uses text + icon token (`CheckCircle`/`AlertTriangle`), never color-only
- [ ] Loading/empty/error states share the same structural position across all four new panels (all route through `DashboardPanel`)
- [ ] Responsive fallback defined (single-column `dashboard-grid` below 980px, per §4.3)

### Gate 4: No New Local Visual Pattern
- [ ] Foundation Summary reuses `.foundation-status__item` + sub-classes verbatim
- [ ] Recommended Actions / Recent Activity rows reuse `.dashboard-item-row` + sub-classes verbatim
- [ ] Panel wrapper reuses `.dashboard-panel` + sub-classes verbatim (via `DashboardPanel` component, no reimplementation)
- [ ] No MUI components imported in any new Dashboard file (`DashboardHeroPanel`, `DashboardFoundationSummaryPanel`, `DashboardRecommendedActionsPanel`, `DashboardRecentActivityPanel`, `DashboardActiveWorkspacesPanel`, `useDashboardOverview`)
- [ ] Old bespoke `.ui-dashboard-session-link` pattern is removed, not left dangling

### Gate 5: Accessibility Baseline
- [ ] All new interactive elements (`ui-button`, `inlineLink`, `.dashboard-workspace-chip`) have visible `:focus-visible` outlines using `--workspace-blue` token
- [ ] Hero's dynamic resume-candidate text is wrapped in `role="status" aria-live="polite"` (new requirement, §8.2)
- [ ] `DashboardPanel`-routed loading/empty/error states inherit existing `role="status"`/`role="alert"` wiring — verified, not reimplemented
- [ ] No hardcoded English/Italian text in `aria-label` attributes — all copy sourced from `appCopy`

### Gate 6: Feedback Channel Consistency
- [ ] All loading/error/empty states on this page map to `page-state` (per §8.1 — confirmed no `global` events originate here)
- [ ] No duplicate rendering of the same event in both `page-state` and `global`
- [ ] Per-workspace partial failure in `useDashboardOverview` degrades gracefully (excludes the failed workspace) rather than failing the whole page

### Gate 7: Feedback Event Registry
- [ ] Every feedback event in this proposal maps to a row in §8.1
- [ ] No ad-hoc `alert()`/`console.error()` introduced

### Gate 8: Anti-Pattern Prevention
- [ ] No `<Button>` inside `<td>` (N/A — no tables)
- [ ] No custom `background`/`border-radius` overriding `.ui-button`
- [ ] No MUI `Chip`/`IconButton`/palette props introduced in new files
- [ ] `var(--mui-palette-*)` is not referenced anywhere in new CSS

### Gate 9: Implementation Accuracy
- [ ] `useDashboardOverview.ts` created at the path specified in §5.2
- [ ] All five new UI components created at paths specified in §5.2
- [ ] CSS additions appended to `dashboard-panels.css` only (no new CSS file)
- [ ] Dead code (`FoundationToolsPanel.tsx`, `RecentActivityPanel.tsx`) removed in the same change, with a final `grep` confirming zero remaining imports
- [ ] `DashboardPage.test.tsx` updated to match new structure (see §11.1 below) — existing assertions that lock in the old "Tools → /workspaces" duplication (lines 74-80) are removed/replaced
- [ ] New unit tests cover: `useDashboardOverview` (resume-candidate resolution logic, Foundation fraction aggregation, recommendation dedup/sort), each new panel's loading/empty/error/ready states

### 11.1 Test Migration Note

`DashboardPage.test.tsx` currently asserts (lines 74-80) that a link with the accessible name `appCopy.ui.navigation.tools` ("Tools") exists and points to `/workspaces` — this assertion is a direct lock-in of the duplication problem described in §2.2 and **must be removed**, replaced with assertions against the new Hero primary CTA and Active-Workspaces-footer "View all workspaces" CTA instead.

---

## 12. Implementation Plan

### Phase 1: Aggregate Hook + Component Creation (non-breaking, dark-launched)
1. Create `useDashboardOverview.ts` composing `useProjectsQuery`, `useSessionsQuery({})`, bounded `useWorkspaceContext`/`useToolRecommendations` calls (K=5 scan, §6.2)
2. Create the five new UI components (`DashboardHeroPanel`, `DashboardFoundationSummaryPanel`, `DashboardRecommendedActionsPanel`, `DashboardRecentActivityPanel`, `DashboardActiveWorkspacesPanel`), each consuming `useDashboardOverview`
3. Add new CSS classes to `dashboard-panels.css` (§7.2)
4. Add new copy keys to `system.ts` under `appCopy.editorial.dashboard` and `appCopy.ui.dashboard` (§10.3)
5. Write unit tests for `useDashboardOverview` and each new panel in isolation (mocked hook data)

### Phase 2: Page Refactor
1. Rewrite `DashboardPage.tsx`:
   - Remove `ui-dashboard-kpi-topbar` KPI block
   - Remove the two static editorial `DashboardPanel` cards ("Your strategies" / "Generation for your strategy")
   - Remove the raw `<ul>`/`.ui-dashboard-session-link` recent-sessions block
   - Assemble the new component tree per §5.1
   - Preserve the existing zero-state block unchanged (already compliant)
2. Update `DashboardPage.test.tsx` per §11.1
3. Manual QA: keyboard navigation through Hero → Foundation Summary → Recommended Actions → Recent Activity → Active Workspaces; responsive breakpoints (980px, 760px); dark mode token correctness

### Phase 3: Cleanup
1. Remove dead components `FoundationToolsPanel.tsx`, `RecentActivityPanel.tsx` (confirmed zero external imports)
2. Remove obsolete copy keys per §10.2 ("Removed" rows) from `system.ts`
3. Remove obsolete CSS classes per §7.3 (after grep-confirming zero remaining references)
4. Final accessibility audit (axe run against `/dashboard`)
5. Migrate `ContextualToolsPanel.tsx`'s MUI `Chip` usage to `StatusBadge` — **flagged as related but out-of-scope cleanup**; tracked as a follow-up, not blocking this proposal's merge (see Open Questions §13 Q5)

---

## 13. Open Questions

1. **`WorkspaceToolRecommendation` as a new UI-layer type — governance sign-off.** This proposal introduces `WorkspaceToolRecommendation` (extends `ToolRecommendation` with `workspaceId`/`workspaceName`) as an explicit "UI-layer derivation, non-canonical" type, following the precedent set by `FoundationToolStatus` in `useWorkspaceContext.ts`. **Decision needed**: confirm this naming does not require a DDD log entry (it should not, per the same reasoning that exempted `FoundationToolStatus`), but Domain Architecture should explicitly ratify this before Phase 1 lands.

2. **Batched overview endpoint (Phase 2) — trigger condition.** This proposal defers the `GET /api/projects/overview` batched endpoint (§6.3) exactly as the Workspace Hub proposal deferred its own equivalent (Hub proposal §12 Q3: *"Monitor performance before optimizing"*). **Decision needed**: define a concrete trigger metric (e.g. "p95 `/dashboard` load time exceeds Xms with ≥10 workspaces") that forces Phase 2 implementation, so this doesn't remain indefinitely deferred across two proposals.

3. **`.dashboard-workspace-chip` Pattern B classification — ambiguity flagged in §9.1.** The workspace status chip is visually chip-shaped but is governed as Pattern B (inline navigational hint), not a fourth CTA pattern. **Decision needed**: Frontend Platform Team to confirm this reading is acceptable, or alternatively require it to render as a plain `.ui-inline-link` without the pill visual (losing the compact multi-item scan benefit) to remove all ambiguity.

4. **`DashboardPanel` location.** `DashboardPanel.tsx` currently lives under `features/workspace/ui/dashboard/` but is imported cross-feature by this proposal (`features/dashboard/`). **Decision needed**: relocate to a shared location (e.g. `app/ui/DashboardPanel.tsx`) in a follow-up refactor, or accept the cross-feature import as-is (lower risk, smaller diff, consistent with how `WorkspaceHubCard.tsx` already imports `dashboard-panels.css` cross-feature today).

5. **`ContextualToolsPanel.tsx` MUI `Chip` migration.** Flagged in §2.7/§11 Phase 3 as adjacent drift, not directly caused by this proposal, but touched conceptually since it shares the "contextual tool suggestion" theme with the new `DashboardRecommendedActionsPanel`. **Decision needed**: confirm this migration is tracked as a separate, smaller follow-up ticket rather than bundled into this proposal's Phase 3 (recommended, to keep this proposal's diff focused on `/dashboard`).

6. **Should Recommended Actions be limited to Foundation-producing tools, or any tool?** `useToolRecommendations` already scores *all* asset-consuming tools (not just Foundation tools) by readiness/impact/priority. This proposal surfaces the top-5 cross-workspace recommendations without restricting to any tool category. **Decision needed**: product confirmation that surfacing non-Foundation tool recommendations (e.g. "Meta-Ads Generator ready in Project B") alongside Foundation gaps (e.g. "Project C is missing Brand Voice") on the same panel is the intended UX, or whether these should be visually/semantically separated into two panels instead of one.

---

**Revision History**:
- v1.0 (2026-07-21): Initial proposal covering archetype classification, purpose-split decision vs. `/workspaces`, layout, component tree, aggregate data strategy, CSS, states, CTA governance, copy migration map, and acceptance checklist.
