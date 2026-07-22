---
status: active
version: 1.1
date_created: 2026-06-01
last-reviewed: 2026-07-18
next-review-date: 2026-10-18
owner: Frontend Platform + Backend Runtime
title: Tool Step Display Configuration Specification
type: specification
tags: [step-display, visibility, download, configuration, ddd-132, ddd-133, ddd-134, ddd-135]
---

# Tool Step Display Configuration Specification

> DDD reference: canonical terms `StepDisplayConfig` (DDD-132), `ToolStepDisplayConfig` (DDD-133), `ToolStepDisplayConfigMap` (DDD-134), and `excludeSteps` (DDD-135) are defined in the [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md).

## 1. Scope

This specification governs **per-step visibility** (UI rendering in Session Summary detail page) and **per-step download inclusion** (content exported in session download files) for all tools. Configuration is **code-level only** — no user-facing toggle UI. Settings apply globally (standard for all users).

## 2. Design Principles

| Principle | Rationale |
|-----------|-----------|
| Zero workflow impact | Step display config must never affect generation behavior, XState machines, or artifact creation |
| Backward-compatible defaults | When config is absent for a tool or step, default is `{ visible: true, includeInDownload: true }` |
| Single source of truth | All configuration lives in one file: `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` |
| Type-safe | Configuration uses canonical `ToolKey` and `ToolStep` types from `@gen-app-2/contracts` |

## 3. Data Model

### StepDisplayConfig (DDD-132)

```typescript
type StepDisplayConfig = {
  visible: boolean;          // Show/hide in SessionSummaryDetailPage UI
  includeInDownload: boolean; // Include/exclude from download exports
};
```

### ToolStepDisplayConfig (DDD-133)

Per-tool mapping of step keys to their display config:

```typescript
type ToolStepDisplayConfig = Partial<Record<ToolStep, StepDisplayConfig>>;
```

### ToolStepDisplayConfigMap (DDD-134)

Top-level configuration across all tools:

```typescript
type ToolStepDisplayConfigMap = Partial<Record<ToolKey, ToolStepDisplayConfig>>;
```

## 4. Configuration Map

The centralized configuration is defined in `TOOL_STEP_DISPLAY_CONFIG`:

```typescript
export const TOOL_STEP_DISPLAY_CONFIG: ToolStepDisplayConfigMap = {
  'funnel-pages': {
    optin: { visible: true, includeInDownload: true },
    quiz: { visible: true, includeInDownload: true },
    vsl: { visible: true, includeInDownload: true },
  },
  nextland: {
    landing: { visible: true, includeInDownload: true },
    'thank_you': { visible: true, includeInDownload: true },
  },
  'youtube-lf-script': {
    'pre-script-analysis': { visible: true, includeInDownload: true },
    packaging: { visible: true, includeInDownload: true },
    'intro-structure': { visible: true, includeInDownload: true },
    'body-structure': { visible: true, includeInDownload: true },
    'native-cta-embeds': { visible: true, includeInDownload: true },
    'outro-structure': { visible: true, includeInDownload: true },
  },
  'angle-generator': {
    'context-and-angle-matrix': { visible: true, includeInDownload: true },
    'angle-prioritization': { visible: true, includeInDownload: true },
    'creative-activation': { visible: true, includeInDownload: true },
  },
  'meta-ads': {
    'context-generation': { visible: true, includeInDownload: true },
    'ads-generation': { visible: true, includeInDownload: true },
  },
  'youtube-description': {
    'youtube-description-generation': { visible: true, includeInDownload: true },
  },
  geometric: {
    'serp-crawling': { visible: false, includeInDownload: false },
    'competitor-scoring': { visible: false, includeInDownload: false },
    'strategic-reporting': { visible: true, includeInDownload: false },
    'unified-report': { visible: true, includeInDownload: true },
  },
  'brief-generator': {
    'brief-generation': { visible: true, includeInDownload: true },
  },
};
```

### Current Visibility & Download Matrix

| Tool | Step | Visible in UI | Included in Download |
|------|------|:---:|:---:|
| funnel-pages | optin | ✅ | ✅ |
| funnel-pages | quiz | ✅ | ✅ |
| funnel-pages | vsl | ✅ | ✅ |
| nextland | landing | ✅ | ✅ |
| nextland | thank_you | ✅ | ✅ |
| youtube-lf-script | pre-script-analysis | ✅ | ✅ |
| youtube-lf-script | packaging | ✅ | ✅ |
| youtube-lf-script | intro-structure | ✅ | ✅ |
| youtube-lf-script | body-structure | ✅ | ✅ |
| youtube-lf-script | native-cta-embeds | ✅ | ✅ |
| youtube-lf-script | outro-structure | ✅ | ✅ |
| angle-generator | context-and-angle-matrix | ✅ | ✅ |
| angle-generator | angle-prioritization | ✅ | ✅ |
| angle-generator | creative-activation | ✅ | ✅ |
| meta-ads | context-generation | ✅ | ✅ |
| meta-ads | ads-generation | ✅ | ✅ |
| youtube-description | youtube-description-generation | ✅ | ✅ |
| geometric | serp-crawling | ❌ | ❌ |
| geometric | competitor-scoring | ❌ | ❌ |
| geometric | strategic-reporting | ✅ | ❌ |
| geometric | unified-report | ✅ | ✅ |
| brief-generator | brief-generation | ✅ | ✅ |

## 5. Lookup Helpers

### isStepVisible

Returns `true` if the step should be rendered in the Session Summary UI:

```typescript
function isStepVisible(stepKey: string, toolKey: string | null): boolean;
```

- Returns `true` by default when `toolKey` or `stepKey` is null/invalid
- Returns `true` by default when the tool or step is not in the config map
- Returns the explicit `visible` value when configured

### isStepIncludedInDownload

Returns `true` if the step content should be included in download exports:

```typescript
function isStepIncludedInDownload(stepKey: string, toolKey: string | null): boolean;
```

- Same default behavior as `isStepVisible` — defaults to `true`
- Returns the explicit `includeInDownload` value when configured

### getVisibleSteps

Returns all step keys that should be visible for a given tool:

```typescript
function getVisibleSteps(toolKey: string | null): ToolStep[];
```

- Returns `[]` for null or invalid toolKey
- Filters `TOOL_STEP_ORDER[toolKey]` through `isStepVisible()`
- Preserves canonical step order

### getIncludedSteps

Returns all step keys that should be included in download for a given tool:

```typescript
function getIncludedSteps(toolKey: string | null): ToolStep[];
```

- Returns `[]` for null or invalid toolKey
- Filters `TOOL_STEP_ORDER[toolKey]` through `isStepIncludedInDownload()`
- Preserves canonical step order

## 6. Frontend Integration

### SessionArtifactTabs Visibility Filtering

The `SessionArtifactTabs` component filters `sortedArtifacts` through `isStepVisible()` to compute `visibleArtifacts`:

```typescript
const visibleArtifacts = useMemo(
  () => sortedArtifacts.filter((a) => isStepVisible(a.stepKey, session?.toolKey)),
  [sortedArtifacts, session?.toolKey],
);
```

- Full `sortedArtifacts` array is retained in memory for data integrity
- If all steps are hidden, an empty state message is rendered instead of broken UI
- Tab rendering iterates over `visibleArtifacts`, not `sortedArtifacts`

### SessionSummaryDetailPage Download Handler

The download handler computes excluded steps and passes them to the download client:

```typescript
const includedSteps = getIncludedSteps(session?.toolKey);
const excludedSteps = sessionArtifacts
  .map((a) => a.stepKey)
  .filter((stepKey) => !includedSteps.includes(stepKey as ToolStep));
await downloadSessionFile(sessionId, format, downloadOptions, { excludeSteps });
```

- For unknown tools, `excludedSteps` is empty (preserves default include-all behavior)
- Excluded steps are computed by comparing session artifact step keys against the included set

## 7. Backend Integration

### Download Endpoint

The backend session download endpoint accepts an optional `excludeSteps` query parameter (DDD-135):

```
GET /api/tools/sessions/:sessionId/download?format=docx&excludeSteps=serp-crawling,competitor-scoring
```

- Parameter is comma-separated: `excludeSteps=step1,step2,step3`
- Parameter is optional — absence means include all steps (backward-compatible)
- Malformed values are gracefully handled (whitespace trimmed, empty strings filtered)

### Serialization Filtering

The `serializeSessionDownload()` function filters the `steps` array before presentation serialization:

```typescript
function serializeSessionDownload(
  steps: SessionArtifactEntry[],
  format: DownloadFormat,
  options?: { docxTheme?: DocxVisualTheme; excludeSteps?: string[] },
): DownloadContent;
```

- When `excludeSteps` is provided, steps whose `stepKey` matches any excluded value are removed
- Filtering happens before format-specific serialization (md, txt, docx)
- When `excludeSteps` is absent or empty, all steps are included

## 8. Constraints

| Constraint | Description |
|------------|-------------|
| CON-001 | No changes to XState machines (`toolPageMachine`, `generationLifecycleMachine`, `toolFlowMachine`) |
| CON-002 | No changes to generation dispatch, step execution, or artifact creation paths |
| CON-003 | Backend download API must remain backward-compatible (new query params are optional) |
| REQ-001 | Tool workflow step behavior must remain completely unchanged during generation |
| REQ-004 | Configuration is code-level only — no user-facing toggle UI |
| REQ-005 | Settings apply globally (standard for all users), not per-user or per-session |
| REQ-006 | Default behavior when config is absent: all steps visible and included |

## 9. Risks

| Risk | Mitigation |
|------|------------|
| RISK-001: Malformed `excludeSteps` param | Backend parses with `.split(',').map(s => s.trim()).filter(Boolean)` — ignores empty/malformed entries |
| RISK-002: All steps hidden for a tool | `SessionArtifactTabs` renders empty state message instead of broken UI |
| RISK-003: New tool added without config entry | Falls back to default `{ visible: true, includeInDownload: true }` for all steps |

## 10. Source Files

| File | Purpose |
|------|---------|
| `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` | Centralized config, types, and lookup helpers |
| `apps/frontend/src/features/tools/runtime/tool-step-display-config.test.ts` | Unit tests for config helpers (22 tests) |
| `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | Visibility filtering for step tabs |
| `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` | Download handler with excludeSteps computation |
| `apps/frontend/src/features/artifacts/runtime/download-client.ts` | Download client with excludeSteps query param |
| `apps/backend/src/lib/runtime/downloads/download-serializers.ts` | Step filtering pre-serialization |
| `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts` | Route handler with excludeSteps query param parsing |
| `apps/backend/src/lib/tests/runtime.download-serializers.test.ts` | Backend tests for exclusion and backward compatibility |
