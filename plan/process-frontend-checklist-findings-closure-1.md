---
goal: Progressive Closure Plan For Remaining Findings In Frontend Unification Checklist
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21 (execution complete)
owner: Frontend Platform
status: Completed
tags: [process, frontend, checklist, refactor, deduplication, cleanup]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan closes all remaining Open and Partial findings in the frontend unification checklist using deterministic, phased execution. The plan preserves canonical DDD terminology and applies incremental validation gates after each batch.

## 1. Requirements & Constraints

- **REQ-001**: Close all findings still marked Open or Partial in plan/apps-frontend-unification-dead-code-checklist-1.md.
- **REQ-002**: Keep one canonical runtime surface for tool generation entry and remove legacy console surfaces when migration is complete.
- **REQ-003**: Converge query hooks to one canonical shared abstraction and retain existing runtime semantics.
- **REQ-004**: Converge tool label and route metadata to one canonical source used by Dashboard, Sessions, Artifact relaunch, and Navigation.
- **REQ-005**: Retire obsolete wrappers, shims, and rollout branches when no runtime consumers remain.
- **SEC-001**: Preserve existing auth and admin gating behavior in route and query consumers.
- **DDD-001**: Use canonical terms from glossary and naming decision log, including ToolKey, SupportedTool, ToolStep, ReadinessSnapshot, and HydrationResult.
- **CON-001**: Do not introduce new domain terms without a DDD decision entry.
- **CON-002**: Keep behavior compatibility for existing routes until replacement paths are verified.
- **CON-003**: Preserve Data Table View behavior in sessions and artifact listings.
- **GUD-001**: Execute cleanup in small batches by concern with explicit rollback points.
- **GUD-002**: Keep patches atomic by concern and file cluster.
- **PAT-001**: Use existing shared runtime helpers before adding new utility functions.
- **PAT-002**: Use one canonical query abstraction for data/loading/error/reload lifecycle.
- **PAT-003**: Use one canonical metadata source for tool labels and route resolution.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Remove legacy console runtime surfaces while preserving functional access to canonical Tool Workspace flows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Remove /tools/console route from apps/frontend/src/app/routing/app-router.tsx by deleting the route object with path /tools/console and its Navigate redirect element. | Yes | 2026-05-21 |
| TASK-002 | Delete apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx and apps/frontend/src/features/generation/pages/GenerationConsolePage.test.tsx after TASK-001 is merged. | Yes | 2026-05-21 |
| TASK-003 | Delete legacy console-only UI files apps/frontend/src/features/generation/ui/GenerationForm.tsx, apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx, and apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx if no import consumers remain. | Yes | 2026-05-21 |
| TASK-004 | Remove legacy console references in editorial copy by updating apps/frontend/src/app/copy/system.ts under editorial.dashboard.cards.tools.body and any residual tools console text. | Yes | 2026-05-21 |
| TASK-005 | Update routing tests in apps/frontend/src/app/routing/app-router.test.tsx by removing /tools/console redirect assertions and replacing with canonical /tools hub assertions. | Yes | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Converge runtime queries to one canonical shared abstraction with unchanged business semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Refactor apps/frontend/src/app/runtime/queries/useModelsQuery.ts to use useSWRQuery from apps/frontend/src/app/runtime/queries/useSWRQuery.ts, preserving enabled behavior and existing error message text. | Yes | 2026-05-21 |
| TASK-007 | Refactor apps/frontend/src/app/runtime/queries/useArtifactsQuery.ts to use useSWRQuery while preserving localArtifacts fallback and filter pagination semantics. | Yes | 2026-05-21 |
| TASK-008 | Remove apps/frontend/src/app/runtime/queries/useAsyncQuery.ts after TASK-006 and TASK-007 and after confirming zero import consumers via workspace search. | Yes | 2026-05-21 |
| TASK-009 | Align query option handling signatures across useProjectsQuery, useSessionsQuery, useModelsQuery, useAdminUsersQuery, useProjectDetailQuery, useArtifactDetailQuery, and useArtifactsQuery by enforcing a consistent enabled default contract. | Yes | 2026-05-21 |
| TASK-010 | Validate all query consumers compile unchanged in apps/frontend/src/features/dashboard/pages/DashboardPage.tsx, apps/frontend/src/features/projects/pages/ProjectsListPage.tsx, apps/frontend/src/features/projects/pages/ProjectDetailPage.tsx, and apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx. | Yes | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Converge tool metadata, route resolution, and ux-state imports to canonical shared sources.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Introduce a canonical tool metadata export in apps/frontend/src/features/tools/runtime/tool-form-architecture.ts that includes label and route for each enabled SupportedTool. | Yes | 2026-05-21 |
| TASK-012 | Replace local tool label resolvers in apps/frontend/src/features/dashboard/pages/DashboardPage.tsx, apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx, and apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx with the canonical metadata export from TASK-011. | Yes | 2026-05-21 |
| TASK-013 | Replace resolveToolRouteFromArtifact logic in apps/frontend/src/features/generation/ui/artifact-history.ts to use canonical metadata mapping from TASK-011. | Yes | 2026-05-21 |
| TASK-014 | Remove re-export shim file apps/frontend/src/features/tools/runtime/tool-ux-state.ts by moving all imports to apps/frontend/src/features/generation/ui/tool-ux-state.ts and deleting shim consumers in ToolActionButtons, ToolStatusCard, ToolGenerationFlowVertical, and tool-page-view-model. | Yes | 2026-05-21 |
| TASK-015 | Simplify tool form architecture exports in apps/frontend/src/features/tools/runtime/tool-form-architecture.ts by removing dead types ProjectsLoadingState, BriefingUploadState, and ToolFormSubmitData when no consumers remain. | Yes | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Retire rollout legacy branch and obsolete wrappers, then finalize documentation and checklist closure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Remove legacy rollout mode support from apps/frontend/src/app/runtime/ui-rollout.ts by collapsing resolveUiRolloutMode to mui-only and removing isMuiUiRolloutEnabled export if unused. | Yes | 2026-05-21 |
| TASK-017 | Remove data-ui-rollout-mode side effect from apps/frontend/src/App.tsx and ensure no consumer relies on documentElement dataset uiRolloutMode. | Yes | 2026-05-21 |
| TASK-018 | Retire unused wrappers apps/frontend/src/components/AppInput.tsx and apps/frontend/src/components/AppModal.tsx when import search confirms zero consumers. | Yes | 2026-05-21 |
| TASK-019 | Evaluate wrappers apps/frontend/src/components/AppButton.tsx and apps/frontend/src/components/AppCard.tsx; either replace remaining consumers in DashboardPage and ToolsHubPage with canonical primitives or mark wrappers as canonical and close finding with explicit rationale in checklist. | Yes | 2026-05-21 |
| TASK-020 | Update apps/frontend/README.md by removing legacy rollback instructions tied to VITE_UI_ROLLOUT_MODE=legacy and documenting final canonical cleanup decisions and validation gate commands. | Yes | 2026-05-21 |

### Implementation Phase 5

- GOAL-005: Execute deterministic validation gates and close all checklist findings with auditable evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Run npm --workspace apps/frontend run typecheck after each completed phase and record result in checklist evidence notes. | Yes | 2026-05-21 |
| TASK-022 | Run npm --workspace apps/frontend run test after each completed phase and record result in checklist evidence notes. | Yes | 2026-05-21 |
| TASK-023 | Run npm --workspace apps/frontend run build after each completed phase and record result in checklist evidence notes. | Yes | 2026-05-21 |
| TASK-024 | Update plan/apps-frontend-unification-dead-code-checklist-1.md statuses from Open or Partial to Done only when corresponding code change and validation evidence are both present. | Yes | 2026-05-21 |
| TASK-025 | Mark Validation Checklist and Expected Outcomes entries Done with direct evidence for each row, including command results and impacted file references. | Yes | 2026-05-21 |

## 3. Alternatives

- **ALT-001**: Keep dual runtime surfaces by retaining GenerationConsolePage as transitional fallback. Rejected because it preserves duplicate orchestration and blocks canonical Tool Workspace convergence.
- **ALT-002**: Migrate query hooks to an external data layer library abstraction. Rejected because current useSWRQuery already exists and enables deterministic in-place convergence.
- **ALT-003**: Keep tool metadata duplicated in copy plus runtime modules. Rejected because duplication is the direct source of drift findings.
- **ALT-004**: Keep ui-rollout legacy toggle indefinitely. Rejected because legacy branch has no validated operational purpose in current runtime.

## 4. Dependencies

- **DEP-001**: Existing SWR query abstraction in apps/frontend/src/app/runtime/queries/useSWRQuery.ts.
- **DEP-002**: Existing tool configuration registry in apps/frontend/src/features/tools/runtime/tool-form-architecture.ts.
- **DEP-003**: Existing canonical ux-state definitions in apps/frontend/src/features/generation/ui/tool-ux-state.ts.
- **DEP-004**: Existing DDD governance references in docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, and docs/07-governance/domain-naming-decision-log.md.

## 5. Files

- **FILE-001**: plan/apps-frontend-unification-dead-code-checklist-1.md
- **FILE-002**: apps/frontend/src/app/routing/app-router.tsx
- **FILE-003**: apps/frontend/src/app/routing/app-router.test.tsx
- **FILE-004**: apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx
- **FILE-005**: apps/frontend/src/features/generation/pages/GenerationConsolePage.test.tsx
- **FILE-006**: apps/frontend/src/features/generation/ui/GenerationForm.tsx
- **FILE-007**: apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx
- **FILE-008**: apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx
- **FILE-009**: apps/frontend/src/app/runtime/queries/useModelsQuery.ts
- **FILE-010**: apps/frontend/src/app/runtime/queries/useArtifactsQuery.ts
- **FILE-011**: apps/frontend/src/app/runtime/queries/useAsyncQuery.ts
- **FILE-012**: apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
- **FILE-013**: apps/frontend/src/features/dashboard/pages/DashboardPage.tsx
- **FILE-014**: apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx
- **FILE-015**: apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx
- **FILE-016**: apps/frontend/src/features/generation/ui/artifact-history.ts
- **FILE-017**: apps/frontend/src/features/tools/runtime/tool-ux-state.ts
- **FILE-018**: apps/frontend/src/features/tools/ui/ToolActionButtons.tsx
- **FILE-019**: apps/frontend/src/features/tools/ui/ToolStatusCard.tsx
- **FILE-020**: apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx
- **FILE-021**: apps/frontend/src/features/tools/machines/tool-page-view-model.ts
- **FILE-022**: apps/frontend/src/app/runtime/ui-rollout.ts
- **FILE-023**: apps/frontend/src/App.tsx
- **FILE-024**: apps/frontend/src/components/AppButton.tsx
- **FILE-025**: apps/frontend/src/components/AppCard.tsx
- **FILE-026**: apps/frontend/src/components/AppInput.tsx
- **FILE-027**: apps/frontend/src/components/AppModal.tsx
- **FILE-028**: apps/frontend/README.md

## 6. Testing

- **TEST-001**: Route regression tests in apps/frontend/src/app/routing/app-router.test.tsx pass after console route removal.
- **TEST-002**: Query hook consumer tests pass in dashboard, projects, and artifact detail pages after query abstraction convergence.
- **TEST-003**: Artifact relaunch path behavior remains unchanged after tool metadata convergence in artifact-history utilities.
- **TEST-004**: Sessions listing and session detail pages preserve Data Table View behavior and tool label rendering after metadata migration.
- **TEST-005**: Tool page action components compile and runtime behavior remains unchanged after ux-state shim removal.
- **TEST-006**: Frontend validation gates pass per phase: npm --workspace apps/frontend run typecheck.
- **TEST-007**: Frontend validation gates pass per phase: npm --workspace apps/frontend run test.
- **TEST-008**: Frontend validation gates pass per phase: npm --workspace apps/frontend run build.

## 7. Risks & Assumptions

- **RISK-001**: Removing legacy console files may break hidden deep links if external bookmarks still exist.
- **RISK-002**: Query abstraction migration may introduce subtle loading state regressions if enabled handling is not preserved exactly.
- **RISK-003**: Metadata convergence may alter displayed tool labels if fallback handling is inconsistent.
- **RISK-004**: Wrapper removal may cause visual regressions in dashboard or tools hub if component variants diverge.
- **RISK-005**: Rollout toggle removal may impact diagnostics that currently rely on data-ui-rollout-mode.
- **ASSUMPTION-001**: /tools hub and tool routes are the only canonical supported generation entry surfaces.
- **ASSUMPTION-002**: No production requirement remains for VITE_UI_ROLLOUT_MODE=legacy.
- **ASSUMPTION-003**: Canonical tool metadata can be centralized without introducing new domain terms.
- **ASSUMPTION-004**: Existing test suite coverage is sufficient to detect primary regressions during phased cleanup.

## 8. Related Specifications / Further Reading

- plan/apps-frontend-unification-dead-code-checklist-1.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md