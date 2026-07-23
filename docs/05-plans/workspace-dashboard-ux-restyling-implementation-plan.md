---
goal: Restyle workspace dashboard with categorized asset accordion, prominent foundation tools section, and inline artifact promotion
version: 2.3
date_created: 2026-07-18
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: Frontend Platform
status: draft
tags: [plan, frontend, workspace, dashboard, ux, assets, artifacts, promotion, reuse-first]
validation: momus-passed-after-remediation — 3 P0 blockers resolved, 3 P1 issues addressed
---

# Workspace Dashboard UX Restyling — Implementation Plan (v2 — Reuse-First)

## Code Verification Status (2026-07-23)

> **Status: PARTIALLY IMPLEMENTED** — 15/19 tasks completed. 1 component missing, 2 hooks pending verification.

| Track | Item | Code Status |
|---|---|---|
| A-EXT | `AssetGroupSection` `mode='browse'` prop | ✅ Exists |
| A | `FoundationToolsPanel` component | ⚠️ **MISSING** — `foundationTools` data exists in `useWorkspaceContext` but no dedicated component |
| A | `AssetLibraryAccordion` component | ✅ Exists |
| A | `RecentArtifactsPanel` component | ✅ Exists |
| B | `useProjectArtifacts` hook | ✅ Exists |
| C | `WorkspaceDashboard` layout rewrite | ✅ Exists |
| C | `ContextualToolsPanel` foundation filter | ✅ Exists |
| D | `groupedByType` in `useWorkspaceContext` | ✅ Exists |
| D | `foundationTools` in `useWorkspaceContext` | ✅ Exists |
| D | `sourceArtifactId` in `WorkspaceAsset` | ✅ Exists |
| E | CSS additions to `dashboard-panels.css` | ✅ Exists |
| F | `ASSET_TYPE_LABELS` export from `toolAssetRegistry.ts` | ✅ Exists |

## 0. Problem Statement

The current workspace dashboard has three UX gaps:

| Gap | Current State | Target State |
|-----|--------------|--------------|
| **Asset visibility** | Mini grid of 6 assets, no categorization, no actions | Full accordion grouped by `AssetType`, expandable sections with quality badges |
| **Foundation tools** | `brief-generator` and `tov-generator` mixed in "Available Tools" grid with evolved tools | Dedicated full-width "Foundation" panel above the grid with prominent CTAs |
| **Artifact promotion** | Only accessible from Session Summary detail page | Inline list of recent completed artifacts on dashboard with direct `[Promote to Asset]` buttons |

---

## 1. Proposed Layout

```
┌─ 1. HERO (unchanged) ──────────────────────────────────────────────────────┐
│ Project Name                                          [Start Generating]    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ 2. KNOWLEDGE OVERVIEW (unchanged) ────────────────────────────────────────┐
│ 92%  │  12 assets  │  [Ready]  │  ■■■■■■■■░░ 5/10 tools                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ 3. FOUNDATION TOOLS (NEW) ────────────────────────────────────────────────┐
│ 🏗️  Foundation — Start here to build your workspace knowledge               │
│ ┌────────────────────────────────┐  ┌────────────────────────────────────┐  │
│ │ 📋 Brief Generator             │  │ 🎤 TOV Generator                   │  │
│ │ Upload briefing docs.          │  │ Upload brand docs to define TOV.   │  │
│ │ Produces: brief · Used by: 7   │  │ Produces: brand-voice · Used by: 7 │  │
│ │ [Generate Brief →]             │  │ [Generate Brand Voice →]           │  │
│ └────────────────────────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ 4. TWO-COLUMN GRID ───────────────────────────────────────────────────────┐
│ ┌─ ASSET LIBRARY (accordion) ──┐  ┌─ SUGGESTED ACTIONS (unchanged) ──────┐  │
│ │ ▼ Brief (2 assets)     [100] │  │ Tool A  → [Go]                      │  │
│ │ ▼ Brand Voice (1)      [100] │  │ Tool B  → [Go]                      │  │
│ │ ▶ Persona (0)          [ — ] │  │                                      │  │
│ │ ▶ Angle (3)            [ 90] │  │                                      │  │
│ │ [View all assets →]           │  │                                      │  │
│ └───────────────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ 5. TWO-COLUMN GRID ───────────────────────────────────────────────────────┐
│ ┌─ RECENT ARTIFACTS (NEW) ─────┐  ┌─ AVAILABLE TOOLS (adapted) ──────────┐  │
│ │ Angle: "Pain Point Hook"     │  │ ┌──────────┐ ┌──────────┐           │  │
│ │ angle-generator · 2h ago     │  │ │Angle Gen │ │Funnel P. │           │  │
│ │ [Promote to Asset ↗]         │  │ └──────────┘ └──────────┘           │  │
│ │ [View all activity →]         │  │                                      │  │
│ └───────────────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Reuse Audit — Existing Component Inventory vs. Proposed Components

Every proposed UI element was cross-referenced against the existing workspace component inventory. Results:

### 2.1 Existing Components — Reuse Verdict

| Component | File | Verdict | Rationale |
|---|---|---|---|
| `AssetGroupSection` | `ui/AssetGroupSection.tsx` | ✅ **REUSE with extension** | Already an accordion: header with type icon, label, count, quality badge, empty state (`CreateAssetPrompt`), "Generate More" CTA. Keyboard-accessible. **Only needs a `mode: 'browse'` prop to hide checkboxes/SelectAll** — the rest is already correct for dashboard. |
| `AssetKnowledgePanel` | `ui/AssetKnowledgePanel.tsx` | ⚠️ **NOT reusable** | Wraps `AssetGroupSection` with selection state, tool-scoped inputs, and "X assets selected for generation" footer. Dashboard needs ALL asset types (not tool-specific) and no selection. |
| `AssetSelectionList` | `ui/AssetSelectionList.tsx` | ⚠️ **HIDDEN** | Only rendered in `'select'` mode. In `'browse'` mode, `AssetGroupSection` renders a simpler label+quality list instead. Component itself stays unchanged. |
| `CreateAssetPrompt` | `ui/CreateAssetPrompt.tsx` | ✅ **REUSE as-is** | Producer tool CTA, manual upload, paste text. No changes. |
| `AssetTypeIcon` | `ui/AssetTypeIcon.tsx` | ✅ **REUSE as-is** | Pure icon mapping. |
| `QualityScoreBadge` | `ui/QualityScoreBadge.tsx` | ✅ **REUSE as-is** | Pure badge. |
| `PromoteAssetDialog` | `sessionsummary/ui/PromoteAssetDialog.tsx` | ✅ **REUSE as-is** | Standalone. Accepts `artifactId`, `projectId`, callbacks. |
| `EmptyStateMessage` | `app/ui/primitives` | ✅ **REUSE as-is** | Generic. |
| `LoadingStateMessage` | `app/ui/primitives` | ✅ **REUSE as-is** | Generic. |
| `ErrorStateMessage` | `app/ui/primitives` | ✅ **REUSE as-is** | Generic. |
| `SuggestedActionsPanel` | `dashboard/SuggestedActionsPanel.tsx` | ✅ **REUSE as-is** | No changes. |
| `WorkspaceKnowledgeOverview` | `dashboard/WorkspaceKnowledgeOverview.tsx` | ✅ **REUSE as-is** | No changes. |
| `ContextualToolsPanel` | `dashboard/ContextualToolsPanel.tsx` | ✅ **REUSE with filter** | Add `FOUNDATION_TOOL_KEYS` filter (~3 lines). |

### 2.2 Proposed New Components — Justification

| Component | Classification | Why It's Justified |
|---|---|---|
| `FoundationToolsPanel` | **Genuinely new** | Unique visual pattern: two wide hero cards with asset status, dependency count badges, and primary CTA buttons. No existing component has this layout. |
| `AssetLibraryAccordion` | **Thin wrapper (~50 lines)** | Composes `AssetGroupSection` (in `mode='browse'`) for all workspace asset types. Manages expand/collapse state. The body is 100% `AssetGroupSection`. |
| `RecentArtifactsPanel` | **Genuinely new** | Unique data source (project-level artifact query via new hook), unique interaction (inline `PromoteAssetDialog` trigger). No existing panel does this. |

### 2.3 Net Delta (v2)

| Category | Count | Details |
|---|---|---|
| **New files created** | 4 | `FoundationToolsPanel`, `AssetLibraryAccordion`, `RecentArtifactsPanel`, `useProjectArtifacts` |
| **Existing files edited** | 5 | `AssetGroupSection` (`+mode`), `toolAssetRegistry.ts` (export `ASSET_TYPE_LABELS`), `ContextualToolsPanel` (filter), `useWorkspaceContext` (derived data), `WorkspaceDashboard` (wiring) |
| **Files removed** | 0 | `AssetLibraryQuickAccess` and `RecentActivityPanel` kept on disk, un-imported |
| **Existing reused as-is** | 7 | `AssetTypeIcon`, `QualityScoreBadge`, `CreateAssetPrompt`, `PromoteAssetDialog`, `SuggestedActionsPanel`, `WorkspaceKnowledgeOverview`, primitives |
| **CSS** | Additive | New classes appended to `dashboard-panels.css`; no existing rules changed |

---

## 3. Track A-EXT — Extend `AssetGroupSection` with `mode` Prop

**File**: `apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx`

**Change**: Add optional `mode` prop. **This is the only change to an existing UI component.**

```ts
interface AssetGroupSectionProps {
  // ... all existing props unchanged
  mode?: 'select' | 'browse';  // NEW — defaults to 'select' (current behavior)
}
```

**Behavior when `mode='browse'`**:

| Section | Behavior |
|---------|----------|
| **Header** | **Unchanged**: `AssetTypeIcon` + label + `({count})` + `QualityScoreBadge` + expand/collapse chevron + keyboard a11y |
| **Expanded — has assets** | Simple list: each asset shown as `label` + `QualityScoreBadge` + stale indicator. **No checkboxes. No Select All / Deselect All.** |
| **Expanded — empty** | `CreateAssetPrompt` — **unchanged** |
| **Footer — Generate More** | **Unchanged** |
| **`selectedAssetIds` / `onAssetToggle`** | Ignored (pass `[]` and `noop`) |

**Code diff** (conceptual, inside the expanded `<Collapse>` section):
```tsx
{hasAssets ? (
  mode === 'browse' ? (
    <div className="asset-group-section__browse-list">
      {assets.map(asset => (
        <div key={asset.id} className="asset-group-section__browse-item">
          <span className="asset-group-section__browse-label">{asset.label}</span>
          <QualityScoreBadge score={asset.qualityScore} size="small" />
          {asset.staleUpstream && (
            <Chip label="Stale" size="small" color="warning" variant="outlined" />
          )}
        </div>
      ))}
    </div>
  ) : (
    <>
      <div className="asset-group-section__controls">
        <Button
          size="small"
          variant="text"
          onClick={handleSelectAllInGroup}
          startIcon={selectedAssetsInGroup === assets.length ? <Minus size={14} /> : <Plus size={14} />}
        >
          {selectedAssetsInGroup === assets.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>
      <AssetSelectionList
        assets={assets}
        selectedAssetIds={selectedAssetIds}
        onAssetToggle={onAssetToggle}
      />
    </>
  )
) : (
  <CreateAssetPrompt
    assetType={assetType}
    label={label}
    producerTool={producerTool ?? null}
    isRequired={isRequired}
    {...(projectId !== undefined ? { projectId } : {})}
    onCreateAction={onCreateAction}
  />
)}
```

**Estimated diff size**: ~15 lines added to existing component.

---

## 4. Track A — New Components

### A-001: `FoundationToolsPanel.tsx` — Genuinely New

**File**: `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.tsx`

**Props**: `{ workspaceId: string }`

**Data source**: `useWorkspaceContext(workspaceId).foundationTools` (derived in Track E)

**Foundation criteria** (derived, not hardcoded): `TOOL_ASSET_CONTRACTS[toolKey].consumes.length === 0`

**States per tool card**:

| State | Condition | Content |
|-------|-----------|---------|
| **Empty** | `existingAssets.length === 0` | ⚠️ "No {type} yet" + primary `[Generate {Label} →]` button → `/workspaces/:id/tools/:toolKey` |
| **Has assets** | `existingAssets.length > 0` | ✅ "{count} {type} asset(s)" + `QualityScoreBadge` average + `[Regenerate →]` outline button |
| **Loading** | `ctx.loading` | Skeleton placeholder |

**Layout**: Full-width `.foundation-tools` panel → `.foundation-tools__grid` (2 columns) → one `.foundation-tools__card` per tool.

**Each card**: Icon (`FileText` / `Mic` via Lucide) + Tool name (`toolFormRegistry` displayName) + 1-line description + metadata chips (`Chip`: "Produces: brief", "Used by: 7 tools") + CTA button.

**Reuses**: `Link` (react-router-dom), `QualityScoreBadge`, `Chip`, `Button` (MUI).

### A-002: `AssetLibraryAccordion.tsx` — Thin Wrapper (~50 lines)

**File**: `apps/frontend/src/features/workspace/ui/dashboard/AssetLibraryAccordion.tsx`

**Props**: `{ workspaceId: string }`

**What it does**: Orchestrates `AssetGroupSection` in `mode='browse'` for all workspace asset types. No rendering logic beyond the loop — all rendering is delegated to `AssetGroupSection`.

**Logic**:
```tsx
import { ASSET_TYPE_LABELS } from '../../runtime/toolAssetRegistry';
import { getProducerToolsForAsset } from '../../runtime/toolAssetRegistry';
import { uiPrimitives } from '../../../../app/ui/primitives';

const ctx = useWorkspaceContext(workspaceId);
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
  new Set(
    Object.entries(ctx.groupedByType)
      .filter(([_, assets]) => assets.length > 0)
      .map(([type]) => type)
  )
);

const allAssetTypes = useMemo(() => {
  const types = new Set(Object.keys(ctx.groupedByType));
  for (const gap of ctx.gaps) types.add(gap.assetType);
  return Array.from(types);
}, [ctx.groupedByType, ctx.gaps]);

const getProducerTool = (assetType: string): string | null =>
  (getProducerToolsForAsset(assetType as AssetType) as string[])[0] ?? null;

return (
  <div className="dashboard-panel">
    <div className="dashboard-panel__header">
      <span className="dashboard-panel__title">Asset Library</span>
    </div>
    <div className="dashboard-panel__content" style={{ padding: 0 }}>
      {allAssetTypes.map(assetType => (
        <AssetGroupSection
          key={assetType}
          assetType={assetType}
          label={ASSET_TYPE_LABELS[assetType] ?? assetType}
          requiredness="optional-by-tool-setting"
          assets={ctx.groupedByType[assetType] ?? []}
          isExpanded={expandedGroups.has(assetType)}
          selectedAssetIds={[]}
          producerTool={getProducerTool(assetType)}
          projectId={workspaceId}
          mode="browse"
          onToggleExpanded={(expanded) => {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              expanded ? next.add(assetType) : next.delete(assetType);
              return next;
            });
          }}
          onAssetToggle={() => {}}
          onCreateAction={() => { /* navigate to producer tool */ }}
        />
      ))}
    </div>
    <div className="asset-accordion__footer">
      <Link to={`/workspaces/${workspaceId}/assets`} className={uiPrimitives.inlineLink}>
        View all assets →
      </Link>
    </div>
  </div>
);
```

**Reuses directly**: `AssetGroupSection` (with `mode='browse'`).

### A-003: `RecentArtifactsPanel.tsx` — Genuinely New

**File**: `apps/frontend/src/features/workspace/ui/dashboard/RecentArtifactsPanel.tsx`

**Props**: `{ workspaceId: string }`

**Data source**: `useProjectArtifacts(workspaceId)` (new hook, Track B) + `useWorkspaceContext(workspaceId)` for asset cross-referencing.

**Already-promoted detection**: The panel must determine if an artifact has already been promoted to an asset. Strategy:
1. Read workspace assets from `useWorkspaceContext(workspaceId)` — `ctx.assets` provides all project assets
2. Build a `Set<string>` of all `sourceArtifactId` values from workspace assets (`AssetDto.sourceArtifactId` already exists in contracts)
3. For each artifact, check: `promotedAssetIds.has(artifact.artifactId)` → if true, show green "Asset ✓" chip instead of promote button
4. On successful promotion (dialog closes with success), refetch both artifacts and assets to update the list

```tsx
// Inside RecentArtifactsPanel:
const workspaceCtx = useWorkspaceContext(workspaceId);
const artifactsQuery = useProjectArtifacts(workspaceId);

const promotedArtifactIds = useMemo(() => {
  const ids = new Set<string>();
  for (const asset of workspaceCtx.assets) {
    if (asset.sourceArtifactId) ids.add(asset.sourceArtifactId);
  }
  return ids;
}, [workspaceCtx.assets]);
```

**Per artifact row**:

| Element | Content |
|---------|---------|
| **Content preview** | First 80 chars of artifact content, ellipsis |
| **Source line** | Tool display name (`toolFormRegistry`) + relative timestamp |
| **Action** | `[Promote to Asset ↗]` `Button` (size=small, variant=text) → opens `PromoteAssetDialog` |
| **Promoted state** | Green `Chip` "Asset ✓" for already-promoted artifacts |

**States**: loading (skeleton), empty (`EmptyStateMessage`), error (`ErrorStateMessage`), loaded (list).

**Reuses**: `PromoteAssetDialog` from `features/sessionsummary/ui/PromoteAssetDialog.tsx`.

---

## 5. Track B — `useProjectArtifacts` Hook

**File**: `apps/frontend/src/features/workspace/runtime/useProjectArtifacts.ts`

```ts
import { useState, useEffect, useCallback } from 'react';
import { listArtifacts } from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';

interface UseProjectArtifactsResult {
  artifacts: GenerationArtifact[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectArtifacts(projectId: string): UseProjectArtifactsResult {
  const [artifacts, setArtifacts] = useState<GenerationArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listArtifacts({
        projectId,
        status: 'completed',
        limit: 5,
      }, {
        apiBaseUrl: '',
        capabilities: { artifacts: true },
        localArtifacts: [],
      });
      setArtifacts(result.artifacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { artifacts, loading, error, refetch: fetch };
}
```

**Note**: `listArtifacts` already exists in `artifacts-client.ts` and supports `projectId` filter. This hook is a thin `useState` + `useEffect` wrapper (~40 lines).

---

## 6. Track C — Layout Wiring

### C-001: `WorkspaceDashboard.tsx` — New 5-Section Layout

**File**: `apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx`

**Change**: Replace `AssetLibraryQuickAccess` + `RecentActivityPanel` with `FoundationToolsPanel` + `AssetLibraryAccordion` + `RecentArtifactsPanel`.

```tsx
import { FoundationToolsPanel } from '../ui/dashboard/FoundationToolsPanel';
import { AssetLibraryAccordion } from '../ui/dashboard/AssetLibraryAccordion';
import { RecentArtifactsPanel } from '../ui/dashboard/RecentArtifactsPanel';
// Keep: WorkspaceKnowledgeOverview, SuggestedActionsPanel, ContextualToolsPanel
// REMOVED imports: AssetLibraryQuickAccess, RecentActivityPanel

<section className="workspace-dashboard">
  {/* 1. Hero */}
  <div className="workspace-dashboard__hero">...</div>

  {/* 2. Knowledge overview */}
  <WorkspaceKnowledgeOverview workspaceId={workspaceId} />

  {/* 3. Foundation Tools */}
  <FoundationToolsPanel workspaceId={workspaceId} />

  {/* 4. Two-column: Asset Library + Suggested Actions */}
  <div className="dashboard-grid" id="available-tools">
    <AssetLibraryAccordion workspaceId={workspaceId} />
    <SuggestedActionsPanel workspaceId={workspaceId} />
  </div>

  {/* 5. Two-column: Recent Artifacts + Available Tools */}
  <div className="dashboard-grid">
    <RecentArtifactsPanel workspaceId={workspaceId} />
    <ContextualToolsPanel workspaceId={workspaceId} />
  </div>
</section>
```

### C-002: `ContextualToolsPanel.tsx` — Exclude Foundation Tools

**File**: `apps/frontend/src/features/workspace/ui/dashboard/ContextualToolsPanel.tsx`

**Change** (~3 lines added):

```tsx
const FOUNDATION_TOOL_KEYS = new Set<string>(['brief-generator', 'tov-generator']);

// In render, after getEnabledToolNavigationItems():
const evolvedTools = toolItems.filter(item => !FOUNDATION_TOOL_KEYS.has(item.toolKey));
// ... render evolvedTools instead of toolItems
```

### C-003: Old Components — Keep on Disk

`AssetLibraryQuickAccess.tsx` and `RecentActivityPanel.tsx` are **kept on disk** but no longer imported by `WorkspaceDashboard.tsx`. They remain available for rollback. Deletion is a separate cleanup pass.

---

## 7. Track D — `useWorkspaceContext` Enhancements

**File**: `apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts`

### D-001: Add `groupedByType` derivation

```ts
const groupedByType = useMemo(() => {
  const groups: Record<string, WorkspaceAsset[]> = {};
  for (const asset of mappedAssets) {
    if (!groups[asset.assetType]) groups[asset.assetType] = [];
    groups[asset.assetType].push(asset);
  }
  return groups;
}, [mappedAssets]);
```

### D-002: Add `foundationTools` derivation

```ts
import { TOOL_ASSET_CONTRACTS } from '@gen-app-2/contracts';

interface FoundationToolStatus {
  toolKey: string;
  producedAssetType: string;
  existingAssets: WorkspaceAsset[];
  hasAssets: boolean;
}

const foundationTools = useMemo((): FoundationToolStatus[] => {
  // Dynamic: tools with consumes === [] are foundation candidates,
  // but explicitly exclude analysis-only tools (geometric) that don't produce
  // foundational asset types
  const EXCLUDED_FOUNDATION_TOOLS = new Set<ToolKey>(['geometric']);
  const foundationToolKeys = (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[])
    .filter(key => (TOOL_ASSET_CONTRACTS[key]?.consumes ?? []).length === 0)
    .filter(key => !EXCLUDED_FOUNDATION_TOOLS.has(key));

  return foundationToolKeys.map(toolKey => {
    const contract = TOOL_ASSET_CONTRACTS[toolKey];
    const producedType = contract?.produces[0] ?? '';
    const existingAssets = mappedAssets.filter(a => a.assetType === producedType);
    return {
      toolKey,
      producedAssetType: producedType,
      existingAssets,
      hasAssets: existingAssets.length > 0,
    };
  });
}, [mappedAssets]);
```

**Note**: Foundation tools are discovered dynamically from contracts (any tool with `consumes === []`), but `geometric` is explicitly excluded: it's an analysis tool (SERP crawling → competitor analysis), not a foundational asset-builder like `brief-generator` or `tov-generator`. The exclusion set is a `Set<ToolKey>` for easy extension if future analysis-only primitive tools are added.

### D-003: Extend return type

Add to `WorkspaceContextData`:
```ts
groupedByType: Record<string, WorkspaceAsset[]>;
foundationTools: FoundationToolStatus[];
```

### D-004: Add `sourceArtifactId` to `WorkspaceAsset` interface + `mapAssetDto`

**File**: `apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts`

Required for already-promoted artifact detection in `RecentArtifactsPanel`. `AssetDto.sourceArtifactId` already exists in contracts — just pass it through:

```ts
interface WorkspaceAsset {
  // ... existing fields
  sourceArtifactId?: string | null;  // ADD
}

const mapAssetDto = (a: AssetDto): WorkspaceAsset => ({
  id: a.assetId,
  assetType: a.assetType,
  label: a.label,
  qualityScore: a.staleUpstream ? 50 : 100,
  status: a.status,
  staleUpstream: a.staleUpstream,
  sourceArtifactId: a.sourceArtifactId,  // ADD
});
```

Then in `RecentArtifactsPanel`, drop the `(asset as any)` cast:
```tsx
const promotedArtifactIds = useMemo(() => {
  const ids = new Set<string>();
  for (const asset of workspaceCtx.assets) {
    if (asset.sourceArtifactId) ids.add(asset.sourceArtifactId);
  }
  return ids;
}, [workspaceCtx.assets]);
```

---

## 8. Track E — Styles (Additive Only)

**File**: `apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css`

All new CSS classes are appended. No existing rules are modified.

```css
/* ── Foundation Tools Panel ── */
.foundation-tools {
  border: 1px solid var(--mui-palette-primary-light, #bbdefb);
  border-radius: 12px;
  background: linear-gradient(135deg,
    var(--mui-palette-primary-light, rgba(25,118,210,0.05)) 0%,
    var(--mui-palette-background-paper, #fff) 100%);
  overflow: hidden;
}
.foundation-tools__header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.08));
}
.foundation-tools__header-icon { color: var(--mui-palette-primary-main, #1976d2); }
.foundation-tools__header-title {
  font-size: 0.875rem; font-weight: 600;
  color: var(--mui-palette-text-primary, rgba(0,0,0,0.87)); flex: 1;
}
.foundation-tools__header-subtitle {
  font-size: 0.75rem;
  color: var(--mui-palette-text-secondary, rgba(0,0,0,0.6));
}
.foundation-tools__grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 20px;
}
.foundation-tools__card {
  display: flex; flex-direction: column; gap: 8px; padding: 20px;
  border: 1px solid var(--mui-palette-divider); border-radius: 10px;
  background: var(--mui-palette-background-paper, #fff);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.foundation-tools__card:hover {
  border-color: var(--mui-palette-primary-main);
  box-shadow: 0 2px 12px rgba(25,118,210,0.08);
}
.foundation-tools__card-header { display: flex; align-items: center; gap: 8px; }
.foundation-tools__card-icon { color: var(--mui-palette-primary-main); flex-shrink: 0; }
.foundation-tools__card-name { font-size: 0.95rem; font-weight: 600; flex: 1; }
.foundation-tools__card-desc {
  font-size: 0.8rem; color: var(--mui-palette-text-secondary); line-height: 1.4;
}
.foundation-tools__card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.foundation-tools__card-status { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; }
.foundation-tools__card-status--empty { color: var(--mui-palette-warning-main); }
.foundation-tools__card-status--has-assets { color: var(--mui-palette-success-main); }
.foundation-tools__card-cta { margin-top: auto; padding-top: 12px; }

/* ── Asset Group Section — Browse Mode ── */
.asset-group-section__browse-list { display: flex; flex-direction: column; gap: 2px; }
.asset-group-section__browse-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 6px;
  transition: background-color 0.1s ease;
}
.asset-group-section__browse-item:hover {
  background-color: var(--mui-palette-action-hover);
}
.asset-group-section__browse-label {
  flex: 1; font-size: 0.8rem; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Asset Accordion Footer ── */
.asset-accordion__footer {
  padding: 10px 16px; text-align: center;
  border-top: 1px solid var(--mui-palette-divider);
}

/* ── Recent Artifacts Panel ── */
.recent-artifacts__item {
  display: flex; flex-direction: column; gap: 4px; padding: 12px 16px;
  border-bottom: 1px solid var(--mui-palette-divider, rgba(0,0,0,0.06));
  transition: background-color 0.1s ease;
}
.recent-artifacts__item:last-child { border-bottom: none; }
.recent-artifacts__item:hover { background-color: var(--mui-palette-action-hover); }
.recent-artifacts__preview {
  font-size: 0.8rem; color: var(--mui-palette-text-secondary); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.recent-artifacts__meta {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.recent-artifacts__source {
  font-size: 0.75rem; color: var(--mui-palette-text-disabled);
}
.recent-artifacts__footer {
  padding: 10px 16px; text-align: center;
  border-top: 1px solid var(--mui-palette-divider);
}

@media (max-width: 768px) {
  .foundation-tools__grid { grid-template-columns: 1fr; }
}
```

---

## 9. File Manifest (Final)

| # | File | Action | LoC Est. | Description |
|---|------|--------|----------|-------------|
| 1 | `toolAssetRegistry.ts` | **Edit** | +1 | Export `ASSET_TYPE_LABELS` (currently module-local `const`) |
| 2 | `AssetGroupSection.tsx` | **Edit** | +15 | Add `mode?: 'select' \| 'browse'` prop |
| 3 | `useWorkspaceContext.ts` | **Edit** | +35 | Add `groupedByType`, `foundationTools` derivations |
| 4 | `useProjectArtifacts.ts` | **Create** | +45 | New hook for project-level artifact listing |
| 5 | `FoundationToolsPanel.tsx` | **Create** | +80 | Foundation tools hero panel |
| 6 | `AssetLibraryAccordion.tsx` | **Create** | +55 | Thin wrapper composing `AssetGroupSection` (browse) |
| 7 | `RecentArtifactsPanel.tsx` | **Create** | +100 | Recent artifacts + inline promote |
| 8 | `ContextualToolsPanel.tsx` | **Edit** | +3 | Exclude foundation tools from grid |
| 9 | `WorkspaceDashboard.tsx` | **Edit** | +12 | New 5-section layout wiring |
| 10 | `dashboard-panels.css` | **Edit** | +100 | Additive CSS (appended) |
| 11 | `FoundationToolsPanel.test.tsx` | **Create** | +60 | Empty/has-assets/loading states |
| 12 | `AssetLibraryAccordion.test.tsx` | **Create** | +50 | Accordion expand/collapse, empty state |
| 13 | `RecentArtifactsPanel.test.tsx` | **Create** | +70 | Promote flow, promoted state, loading/empty |
| 14 | `useProjectArtifacts.test.ts` | **Create** | +50 | Mock listArtifacts, handle loading/error/empty |
| 15 | `AssetGroupSection.test.tsx` | **Create** | +55 | Regression: select mode unchanged, browse mode renders labels (no checkboxes) |
| | **Total new code** | | **~800** | |

---

## 10. Entity Decisions

### 10.1 "Foundation Tool" — UI Classification

"Foundation Tool" is a **UI-layer classification**, not a canonical domain term. The domain defines `Tool` (DDD-026) and `ToolKey`. The foundation classification is derived at runtime from `TOOL_ASSET_CONTRACTS`: any tool with `consumes.length === 0` is a candidate, minus explicitly excluded analysis tools (`geometric`). No DDD decision-log entry is required — this is a display concern, not a domain concept.

### 10.2 Artifact ↔ Asset Matching

`AssetDto.sourceArtifactId` already exists in `packages/contracts/src/asset.ts:385`. When an artifact is promoted, the backend sets `source_artifact_id` on the new asset row. For the dashboard's already-promoted detection:
1. `useWorkspaceContext` passes `sourceArtifactId` through `WorkspaceAsset` (D-004)
2. `RecentArtifactsPanel` builds a `Set<string>` of all `asset.sourceArtifactId` values
3. Each artifact is checked: `promotedArtifactIds.has(artifact.artifactId)`

### 10.3 `ASSET_TYPE_LABELS` Export

The constant `ASSET_TYPE_LABELS` (a `Record<AssetType, string>` mapping type keys to display labels) currently exists as a module-local `const` in `toolAssetRegistry.ts:9`. It is duplicated in `PromoteAssetDialog.tsx:26`. This plan exports it from `toolAssetRegistry.ts` (its canonical home) so that `AssetLibraryAccordion` and `PromoteAssetDialog` can both import it from the same source. The duplicate in `PromoteAssetDialog.tsx` is replaced with an import.

### 10.4 Promote Dialog Reuse

`PromoteAssetDialog` from `features/sessionsummary/ui/PromoteAssetDialog.tsx` is a standalone component accepting `artifactId`, `projectId`, `defaultLabel`, and callbacks. It is reused as-is from `RecentArtifactsPanel`.

---

## 11. Acceptance Gates

| Gate | Description | Verification |
|------|-------------|-------------|
| **G1** | `npm --workspace apps/frontend run typecheck` passes | Zero errors |
| **G2** | `npm --workspace apps/frontend run test` passes | ~453 tests pass |
| **G3** | Foundation tools only in Foundation panel, not in Available Tools | DOM assertion |
| **G4** | Accordion groups expand/collapse, keyboard a11y works | Manual + snapshot |
| **G5** | Empty asset types show `CreateAssetPrompt` | Visual |
| **G6** | Foundation empty state: prominent CTA when no assets | Visual |
| **G7** | Foundation has-assets: count + quality + Regenerate button | Visual |
| **G8** | Recent artifacts: preview + promote button per artifact | API mock test |
| **G9** | Promote flow: dialog → success → row updates | Integration test |
| **G10** | Already-promoted artifacts show "Asset ✓" chip | Visual + test |
| **G11** | `AssetGroupSection` select mode unchanged (regression test) | Existing tests pass |
| **G12** | Responsive at 768px | Visual at mobile width |

---

## 12. Implementation Order

| Step | Files | Description | Depends on |
|------|-------|-------------|------------|
| 1 | `toolAssetRegistry.ts` | Export `ASSET_TYPE_LABELS` | — |
| 2 | `useWorkspaceContext.ts` | Add `groupedByType`, `foundationTools`, `sourceArtifactId` to `WorkspaceAsset` | — |
| 3 | `AssetGroupSection.tsx` | Add `mode` prop | — |
| 4 | `useProjectArtifacts.ts` | Create hook | — |
| 5 | `dashboard-panels.css` | Add CSS (appended) | — |
| 6 | `FoundationToolsPanel.tsx` | Create component | 2, 5 |
| 7 | `AssetLibraryAccordion.tsx` | Create component | 1, 2, 3, 5 |
| 8 | `RecentArtifactsPanel.tsx` | Create component | 2, 4, 5 |
| 9 | `ContextualToolsPanel.tsx` | Add foundation filter | — |
| 10 | `WorkspaceDashboard.tsx` | Wire new layout | 6, 7, 8, 9 |
| 11 | Test files | Create 5 test files | 6, 7, 8 |
| 12 | — | `typecheck` + `test` | 10, 11 |
| 13 | — | `test:admin-a11y` | 10 |

---

## 13. Rollback Plan

1. Revert `WorkspaceDashboard.tsx` — restore `AssetLibraryQuickAccess` + `RecentActivityPanel` imports
2. Revert `ContextualToolsPanel.tsx` — remove foundation filter
3. Revert `AssetGroupSection.tsx` — remove `mode` prop (or leave it, it defaults to `'select'`)
4. New components stay on disk but unimported = dead code, zero runtime impact
5. CSS additions are additive and won't break existing styles
6. `useWorkspaceContext` additions are additive; no consumer is forced to use them
