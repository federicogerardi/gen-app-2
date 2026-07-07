---
status: completed
version: 1.3
last-reviewed: 2026-06-21
next-review-date: 2026-07-21
owner: Frontend Platform + Backend Runtime
goal: Add per-step visibility and download-inclusion configuration for session summary pages and downloads, without affecting tool workflow behavior
date_created: 2026-06-20
last_updated: 2026-06-21
tags: [refactor, frontend, backend, session-summary, download, step-config]
---

# Introduction

This plan defines the deterministic rollout of per-step visibility and download-inclusion configuration for the Session Summary surfaces. The configuration is **code-level** (no user-facing UI), **standard for all users**, and **zero-impact on the tool workflow generation flow**.

New canonical domain terms introduced:
- `StepDisplayConfig` (DDD-132) - Value Object for per-step configuration
- `ToolStepDisplayConfig` (DDD-133) - Complete step configuration per tool  
- `ToolStepDisplayConfigMap` (DDD-134) - Top-level configuration mapping
- `excludeSteps` (DDD-135) - Query parameter for download filtering

## 1. Requirements & Constraints

- **REQ-001**: Tool workflow step behavior must remain completely unchanged during generation.
- **REQ-002**: Session Summary detail page (`/sessionsummary/[id]`) must respect per-step visibility settings (show/hide step tabs and content).
- **REQ-003**: Session download (`.docx` / `.md`) must respect per-step inclusion settings (include/exclude step content from exported file).
- **REQ-004**: Configuration is code-level only (developer-maintained settings file), no user-facing toggle UI.
- **REQ-005**: Settings apply globally (standard for all users), not per-user or per-session.
- **REQ-006**: Default behavior when config is absent: all steps visible and included (backward-compatible).
- **REQ-007**: Type-safe configuration integrated with existing contracts (`ToolKey`, `ToolStep`).
- **CON-001**: No changes to XState machines (`toolPageMachine`, `generationLifecycleMachine`, `toolFlowMachine`).
- **CON-002**: No changes to generation dispatch, step execution, or artifact creation paths.
- **CON-003**: Backend download API must remain backward-compatible (new query params are optional).
- **GUD-001**: Extend existing modules over creating new abstractions.
- **PAT-001**: Use shared contracts (`packages/contracts/src/tool-workflows.ts`) as single mapping authority for tool/step identity.

## 2. Implementation Steps

### Phase 1 — Frontend Step Display Configuration

- GOAL-001: Create centralized step display configuration file with TypeScript types.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` with `StepDisplayConfig` (DDD-132), `ToolStepDisplayConfig` (DDD-133), and `ToolStepDisplayConfigMap` (DDD-134) types plus `TOOL_STEP_DISPLAY_CONFIG` mapping per tool/step. Default all steps to `{ visible: true, includeInDownload: true }`. | Yes | 2026-06-20 |
| TASK-002 | Export helper functions: `isStepVisible(stepKey, toolKey)`, `isStepIncludedInDownload(stepKey, toolKey)`, `getVisibleSteps(toolKey)`, `getIncludedSteps(toolKey)`. | Yes | 2026-06-20 |
| TASK-003 | Add unit tests for helper functions covering: explicit config, missing config fallback, all-true defaults. | Yes | 2026-06-20 |

### Phase 2 — Frontend UI Filtering (SessionArtifactTabs)

- GOAL-002: Apply visibility filtering to step tabs in Session Summary detail page.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Update `SessionArtifactTabs.tsx` to filter `sortedArtifacts` through `isStepVisible()` before rendering tabs. Keep full artifact list in memory for data integrity. | Yes | 2026-06-20 |
| TASK-005 | Handle edge case: if all steps are hidden, show empty state message instead of broken UI. | Yes | 2026-06-20 |
| TASK-006 | Add frontend test: verify hidden steps do not render as tabs, visible steps do. | Yes | 2026-06-20 |

### Phase 3 — Frontend Download Client Enhancement

- GOAL-003: Pass step inclusion filters to backend download endpoint.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Update `downloadSessionFile()` in `apps/frontend/src/features/artifacts/runtime/download-client.ts` to accept optional `excludeSteps?: string[]` parameter (DDD-135). Append as `?excludeSteps=step1,step2` query param. | Yes | 2026-06-21 |
| TASK-008 | Update `SessionSummaryDetailPage.tsx` `handleSessionDownload` to compute excluded steps via `getIncludedSteps()` and pass to `downloadSessionFile()`. | Yes | 2026-06-21 |
| TASK-009 | Add frontend test: verify download URL includes correct `excludeSteps` param based on config. | Yes | 2026-06-21 |

### Phase 4 — Backend Download Filtering

- GOAL-004: Backend respects `excludeSteps` query parameter in session download endpoint.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Update backend session download route handler to parse `excludeSteps` query param (DDD-135) (comma-separated string → `string[]`). | Yes | 2026-06-21 |
| TASK-011 | Update `serializeSessionDownload()` in `apps/backend/src/lib/runtime/downloads/download-serializers.ts` to accept optional `excludeSteps?: string[]` and filter `steps: SessionArtifactEntry[]` before serialization. | Yes | 2026-06-21 |
| TASK-012 | Add backend test: verify excluded steps do not appear in downloaded content (both md and docx formats). | Yes | 2026-06-21 |
| TASK-013 | Add backend test: verify backward compatibility — download without `excludeSteps` param produces identical output to current behavior. | Yes | 2026-06-21 |

### Phase 5 — Validation & Regression

- GOAL-005: Run full validation gates and verify zero workflow regression.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Run `npm run typecheck` across all workspaces — zero new errors. | Yes | 2026-06-21 |
| TASK-015 | Run `npm run test` across all workspaces — all existing tests pass. | Yes | 2026-06-21 |
| TASK-016 | Run backend smoke tests (if env available) to verify download endpoints. | Yes | 2026-06-21 |
| TASK-017 | Manual verification: generate a session, verify step tabs respect visibility config, download file respects inclusion config. | Yes | 2026-06-21 |

## 3. Data Model

### StepDisplayConfig Type (DDD-132)

```typescript
type StepDisplayConfig = {
  visible: boolean;          // Show/hide in SessionSummaryDetailPage UI
  includeInDownload: boolean; // Include/exclude from download exports
};

type ToolStepDisplayConfig = Record<ToolStep, StepDisplayConfig>; // DDD-133

type ToolStepDisplayConfigMap = Record<ToolKey, ToolStepDisplayConfig>; // DDD-134
```

### Default Configuration (all steps visible + included)

```typescript
const TOOL_STEP_DISPLAY_CONFIG: ToolStepDisplayConfigMap = {
  'funnel-pages': {
    'optin': { visible: true, includeInDownload: true },
    'quiz': { visible: true, includeInDownload: true },
    'vsl': { visible: true, includeInDownload: true },
  },
  'nextland': {
    'landing': { visible: true, includeInDownload: true },
    'thank_you': { visible: true, includeInDownload: true },
  },
  // ... all other tools with explicit per-step config
};
```

### Helper Functions Contract

```typescript
// Returns true if step should be rendered in UI (defaults to true if no config)
function isStepVisible(stepKey: ToolStep, toolKey: ToolKey | null): boolean;

// Returns true if step should be included in download (defaults to true if no config)
function isStepIncludedInDownload(stepKey: ToolStep, toolKey: ToolKey | null): boolean;

// Returns array of step keys that should be visible for a given tool
function getVisibleSteps(toolKey: ToolKey | null): ToolStep[];

// Returns array of step keys that should be included in download for a given tool
function getIncludedSteps(toolKey: ToolKey | null): ToolStep[];
```

## 4. Files

- **FILE-001**: `docs/99-lifecycle/99-archive/plans/feature-step-display-config-1.md` — this implementation plan.
- **FILE-002**: `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` — **NEW** — centralized step display configuration.
- **FILE-003**: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` — visibility filtering for step tabs.
- **FILE-004**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` — download handler enhancement.
- **FILE-005**: `apps/frontend/src/features/artifacts/runtime/download-client.ts` — `excludeSteps` query param support.
- **FILE-006**: `apps/backend/src/lib/runtime/downloads/download-serializers.ts` — step filtering pre-serialization.
- **FILE-007**: `apps/backend/src/routes/tools/sessions/download.ts` (or equivalent route handler) — query param parsing.
- **FILE-008**: `packages/contracts/src/tool-workflows.ts` — reference for `ToolKey`/`ToolStep` types (no changes needed).
- **FILE-009**: Test files under `apps/backend/src/lib/tests/` and `apps/frontend/src/features/**/*.test.ts*` — regression and new feature coverage.

## 5. Alternatives

- **ALT-001**: Store preferences in localStorage per-user. Rejected because requirements specify code-level config standard for all users.
- **ALT-002**: Build user-facing toggle UI in Session Summary page. Rejected because requirements explicitly state no UI for settings.
- **ALT-003**: Backend-only configuration. Rejected because visibility filtering is a frontend-only concern (tabs rendering).

## 6. Dependencies

- **DEP-001**: Existing `packages/contracts/src/tool-workflows.ts` for `ToolKey` and `ToolStep` types.
- **DEP-002**: Existing `SessionArtifactTabs.tsx` component for tab rendering.
- **DEP-003**: Existing `download-client.ts` for download API calls.
- **DEP-004**: Existing `download-serializers.ts` for session download serialization.
- **DEP-005**: Backend session download route handler (path to be confirmed during implementation).

## 7. Risks & Assumptions

- **RISK-001**: If `excludeSteps` param is malformed, backend should gracefully ignore and include all steps.
- **RISK-002**: If visibility config hides all steps for a tool, UI must handle empty state gracefully.
- **RISK-003**: Future tools added without explicit display config entries must default to all-visible/all-included.
- **ASSUMPTION-001**: Backend session download route accepts optional query parameters without breaking existing clients.
- **ASSUMPTION-002**: `SessionArtifactEntry` type includes `stepKey` field suitable for filtering.
- **ASSUMPTION-003**: No other download consumers (e.g., artifact-level download) require step filtering.

## 8. Testing

- **TEST-001**: Unit tests for `isStepVisible()`, `isStepIncludedInDownload()`, `getVisibleSteps()`, `getIncludedSteps()` covering explicit config and default fallback.
- **TEST-002**: Frontend component test: `SessionArtifactTabs` renders only visible steps as tabs.
- **TEST-003**: Frontend integration test: download URL includes correct `excludeSteps` param.
- **TEST-004**: Backend unit test: `serializeSessionDownload()` excludes specified steps from output.
- **TEST-005**: Backend integration test: download endpoint parses `excludeSteps` and produces filtered output.
- **TEST-006**: Regression test: download without `excludeSteps` produces identical output to current behavior.
- **TEST-007**: Regression test: tool workflow generation flow unchanged (existing machine tests pass).

## 9. Related Specifications / Further Reading

[DDD Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[DDD Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Tool Page Frontend Runtime Spec](../docs/02-design/specifications/tool-page-frontend-runtime-spec.md)
[Session Aggregation Implementation Guide](../docs/02-design/session-aggregation-implementation-guide.md)
[Frontend UX Determinism Code Review](../docs/07-governance/frontend-ux-determinism-code-review.md)
[Tool Development Plan Template](../docs/99-reference/templates/tool-development-plan-template.md)
