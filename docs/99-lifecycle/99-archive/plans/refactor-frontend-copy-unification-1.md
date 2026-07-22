---
goal: Unify all frontend user-facing copy under the canonical app copy system with deterministic ownership and zero logic-coupled string comparisons
version: 1.0
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-05-24
last_updated: 2026-06-22
owner: Frontend Platform Team
status: completed
tags: [refactor, frontend, copy, ddd, tool-workspace, ux]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines the full frontend copy unification required to make `apps/frontend/src/app/copy/system.ts` the single authoritative source for user-facing copy in the workspace. The refactor removes hardcoded strings from Tool Workspace runtime, Tool Workspace components, session detail pages, page loaders, and SWR query hooks, while also eliminating logic that depends on exact user-visible string values.

## 1. Requirements & Constraints

- **REQ-001**: All user-facing copy in frontend production code must be read from `apps/frontend/src/app/copy/system.ts` or from deterministic helper functions built on top of that file.
- **REQ-002**: No production logic may branch on exact user-visible string literals. Runtime decisions must use typed state, flags, or canonical codes instead of copy values.
- **REQ-003**: The Tool Workspace Page must preserve canonical terms from the DDD references, including `Tool Workspace Page`, `Setup Panel`, `Workflow Panel`, `DispatchError`, `ExtractionContext`, `SessionSummary`, and `ArtifactRelaunch`.
- **REQ-004**: The refactor must keep current user-visible behavior semantically equivalent unless the plan explicitly introduces a wording normalization.
- **REQ-005**: Italian user-facing copy and existing approved product/editorial labels must remain centralized and reusable; accidental English drift in production UI must be removed or explicitly governed.
- **REQ-006**: Copy used by `briefingUploadMachine`, `useToolPageRunController`, `ToolStatusCard`, `SessionSummaryDetailPage`, `PageLoader`, and frontend query hooks must be unified in the same change set or through explicitly ordered phases in this plan.
- **REQ-007**: `apps/frontend/src/app/copy/system.ts` must expose grouped, deterministic namespaces for the newly centralized copy so other files can consume them without ad-hoc key invention.
- **REQ-008**: Existing tests that assert hardcoded strings must be updated to assert canonical copy keys through rendered output, not through legacy local literals embedded in implementation files.
- **REQ-009**: Frontend copy unification must not introduce new canonical domain terms; it may only reuse terms already defined by the glossary, bounded context map, decision log, and UI vocabulary spec.
- **REQ-010**: The implementation must cover both UI component copy and hook/query fallback copy, not only visible React component JSX.
- **SEC-001**: Error messages must remain user-readable and must not expose internal machine tokens such as `extraction_context_insufficient` or transport-level failure markers.
- **CON-001**: Scope is frontend-only; backend APIs, contracts, and persistence schemas remain unchanged.
- **CON-002**: The plan must preserve `DispatchError` ownership in the Setup Panel and must not re-route it to a different feedback channel.
- **CON-003**: Do not edit lockfiles or dependency manifests; this refactor must use existing frontend runtime capabilities only.
- **CON-004**: Do not centralize test-only fixture labels into production copy unless the same text is also consumed by production code.
- **GUD-001**: Use the smallest coherent copy groups possible in `appCopy`; avoid dumping unrelated strings into generic buckets.
- **GUD-002**: Prefer replacing duplicated literals with existing copy keys when a semantic match already exists; introduce new keys only when no precise canonical slot exists.
- **GUD-003**: When runtime logic currently compares a literal message string, replace that check with a typed boolean or canonical reason branch in the same phase.
- **PAT-001**: Follow the Tool Workspace Page and Data Table View UI vocabulary from `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`.
- **PAT-002**: Preserve the FE ownership boundary: frontend centralizes presentation copy, but backend-owned domain concepts and orchestration rules remain unchanged.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish the canonical copy inventory and target ownership map for all currently hardcoded frontend production strings.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create a complete production-only inventory of hardcoded user-facing strings under `apps/frontend/src/` using targeted scans and manual verification. Exclude test-only strings in `*.test.tsx`, `*.test.ts`, and helper mocks unless the same literal is duplicated in production code. |  |  |
| TASK-002 | Classify each inventoried string into one of these ownership groups inside `apps/frontend/src/app/copy/system.ts`: `ui.toolPage`, `ui.toolWorkspaceStatus`, `ui.sessions`, `ui.loader`, `ui.states`, `ui.fallbackErrors`, `ui.feedback`, or existing equivalent group when a semantic match already exists. |  |  |
| TASK-003 | Mark all inventory rows that are already semantically covered by existing keys in `apps/frontend/src/app/copy/system.ts` so the implementation can reuse them instead of creating duplicate keys. Minimum baseline coverage must include `Data non disponibile`, `Progetto non disponibile`, query-load failures, and session/archive navigation labels. |  |  |
| TASK-004 | Produce a deterministic mapping for each currently hardcoded Tool Workspace string found in `apps/frontend/src/features/tools/runtime/tool-page-context.ts`, `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`, and `apps/frontend/src/features/tools/ui/ToolStatusCard.tsx`, including whether the target is an existing copy key or a new key. |  |  |

### Implementation Phase 2

- GOAL-002: Expand `appCopy` to own the full set of missing production copy keys needed by Tool Workspace, session detail, page loading, and query fallback flows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Update `apps/frontend/src/app/copy/system.ts` to add a dedicated `ui.toolWorkspaceStatus` group for the current `ToolStatusCard` labels and state messages currently hardcoded in `apps/frontend/src/features/tools/ui/ToolStatusCard.tsx`. Include heading, item labels, empty-state details, step-progress detail variants, and canonical-state readable labels. |  |  |
| TASK-006 | Update `apps/frontend/src/app/copy/system.ts` to add a dedicated `ui.sessions.detail` group for the strings currently hardcoded in `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`, including the relaunch CTA, panel aria labels, detail summary label, and unavailable fallbacks that are not already present in `ui.states`, `ui.session`, or `ui.feedbackCenter`. |  |  |
| TASK-007 | Update `apps/frontend/src/app/copy/system.ts` to add a dedicated `ui.loader` group for the page loader aria label, eyebrow, title, and body currently hardcoded in `apps/frontend/src/app/ui/PageLoader.tsx`. |  |  |
| TASK-008 | Normalize `ui.fallbackErrors` in `apps/frontend/src/app/copy/system.ts` so all shared SWR query hooks can use centralized fallback load-failure messages. Add keys for projects, project detail, models, admin models, artifacts, sessions, changelog, and admin user reports where missing. |  |  |
| TASK-009 | Add a deterministic copy entry for the Angle Generator guidance currently emitted from Tool Workspace runtime when the primary `BriefingFile` is present but `AngleDetectorFile` is still missing. The copy key must live in a Tool Workspace-specific namespace and must not be inferred from an error literal. |  |  |

### Implementation Phase 3

- GOAL-003: Remove logic-coupled message comparisons and centralize machine/runtime Tool Workspace copy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | In `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`, replace all hardcoded user-facing error literals with values read from `appCopy`. Cover the guards and invoke branches that currently emit: project-required, required-files-missing, upload failure, extraction failure, and session-unavailable messages. |  |  |
| TASK-011 | In `apps/frontend/src/features/tools/runtime/tool-page-context.ts`, remove the equality check against the literal `Carica i file richiesti per continuare.` and replace it with a typed branch derived from the same runtime facts already available in scope (`hasRequiredAngleDetector`, selected files, machine state, and missing file condition). The new `briefingGuidance` message must read from `appCopy`, not from a local string literal. |  |  |
| TASK-012 | In `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`, replace the hardcoded dispatch failure message with a canonical `appCopy` entry while preserving `DispatchError` ownership and behavior. |  |  |
| TASK-013 | In `apps/frontend/src/features/tools/runtime/tool-page-runtime-utils.ts`, if needed, add a small helper that maps machine/runtime error codes to copy keys so `briefingUploadMachine`, `tool-page-context`, and `useToolPageRunController` can share centralized wording without branching on rendered strings. |  |  |

### Implementation Phase 4

- GOAL-004: Centralize Tool Workspace and session-detail component copy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | In `apps/frontend/src/features/tools/ui/ToolStatusCard.tsx`, replace the local `CANONICAL_STATE_LABEL` object and all hardcoded headings, labels, and detail strings with values read from `appCopy.ui.toolWorkspaceStatus`. Keep the current rendering contract and status semantics unchanged. |  |  |
| TASK-015 | In `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`, replace hardcoded strings for relaunch action, panel aria labels, detail summary label, unavailable project fallback, and unavailable date fallback with `appCopy` values. Reuse existing copy keys where semantic match already exists before adding new ones. |  |  |
| TASK-016 | In `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` and `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`, perform a targeted follow-up scan and centralize any remaining production literals in the same detail/navigation surface if they are still outside `appCopy`. This task is conditional on inventory output from TASK-001 and must not widen into unrelated feature areas. |  |  |

### Implementation Phase 5

- GOAL-005: Centralize page-level and shared frontend infrastructure copy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | In `apps/frontend/src/app/ui/PageLoader.tsx`, replace the aria label and all displayed copy with `appCopy.ui.loader` values. |  |  |
| TASK-018 | In `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts`, `apps/frontend/src/app/runtime/queries/useModelsQuery.ts`, `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts`, `apps/frontend/src/app/runtime/queries/useArtifactsQuery.ts`, `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts`, `apps/frontend/src/app/runtime/queries/useAdminModelsQuery.ts`, `apps/frontend/src/features/admin/runtime/useAdminChangelogQuery.ts`, and `apps/frontend/src/features/admin/runtime/useAdminUserReportsQuery.ts`, replace hardcoded `errorMessage` fallback strings with `appCopy.ui.fallbackErrors` entries. |  |  |
| TASK-019 | Normalize inconsistent English production copy in query fallbacks and loader content so the selected centralized wording is deliberate and consistent with the rest of the frontend. Any retained English string must be justified by existing product/editorial usage in `appCopy`. |  |  |

### Implementation Phase 6

- GOAL-006: Update tests and add static guards so hardcoded copy does not regress.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Update `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` to assert the centralized Tool Workspace copy behavior after machine string extraction. Remove direct dependency on implementation-local literals where appropriate. |  |  |
| TASK-021 | Update `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx` and `apps/frontend/src/features/tools/ui/ToolStatusCard` tests if present so assertions continue to validate rendered output using centralized copy. |  |  |
| TASK-022 | Add a static regression test or guard script under `apps/frontend/src/` that fails when new production hardcoded copy is introduced in the targeted surfaces covered by this plan. Minimum guard scope: `features/tools`, `features/sessionsummary`, `app/ui/PageLoader.tsx`, and shared query hooks. |  |  |
| TASK-023 | Run a production-surface grep gate after implementation: `rg -n "'[^']*[A-Za-zÀ-ÿ][^']*'|\"[^\"]*[A-Za-zÀ-ÿ][^\"]*\"" apps/frontend/src/features/tools apps/frontend/src/features/sessionsummary apps/frontend/src/app/ui/PageLoader.tsx apps/frontend/src/app/runtime/queries apps/frontend/src/features/admin/runtime --glob '!**/*.test.*' --glob '!**/*.guard.test.*'`. Manually review remaining matches and confirm they are identifiers, technical constants, or intentionally exempt non-user-facing strings only. |  |  |

### Implementation Phase 7

- GOAL-007: Validate the full frontend copy-unification slice end to end.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Run targeted frontend tests for the touched slice: `npm --workspace apps/frontend run test -- src/features/tools/machines/briefing-upload.machine.test.ts src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx`. Add additional touched test files to the same command if implementation changes require them. |  |  |
| TASK-025 | Run frontend typecheck: `npm --workspace apps/frontend run typecheck`. |  |  |
| TASK-026 | Run frontend build: `npm --workspace apps/frontend run build`. |  |  |
| TASK-027 | Run a final static grep to confirm no targeted production files still contain the known hardcoded candidate strings identified during discovery, including `Seleziona prima un progetto`, `Carica i file richiesti per continuare.`, `Errore durante upload`, `Errore durante estrazione`, `Sessione non disponibile. Ricarica la pagina.`, `Brief pronto. Carica Angle Detector File per continuare.`, `Workspace in sync`, `Rilancia`, `Dettagli sessione`, and `Progetto non disponibile`. Expected result: zero matches in production files. |  |  |

## 3. Alternatives

- **ALT-001**: Centralize only Tool Workspace copy and leave session detail, PageLoader, and query fallback messages untouched. Rejected because the user requested complete copy unification and the current drift spans all these layers.
- **ALT-002**: Keep current runtime message comparison in `tool-page-context.ts` and only move the compared text into `appCopy`. Rejected because logic would still be coupled to user-visible wording and would remain fragile.
- **ALT-003**: Add a second copy file per feature area instead of keeping one canonical `appCopy` authority. Rejected because it would preserve distributed ownership and duplicate terminology governance.
- **ALT-004**: Centralize all test strings into `appCopy` together with production strings. Rejected because test-only fixture text is not a production copy concern and would pollute the canonical UI copy surface.

## 4. Dependencies

- **DEP-001**: `apps/frontend/src/app/copy/system.ts` as the single canonical copy authority.
- **DEP-002**: Tool Workspace runtime files `apps/frontend/src/features/tools/runtime/tool-page-context.ts` and `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`.
- **DEP-003**: Tool Workspace machine `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`.
- **DEP-004**: Tool Workspace component `apps/frontend/src/features/tools/ui/ToolStatusCard.tsx`.
- **DEP-005**: Session detail component `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`.
- **DEP-006**: Shared UI loader `apps/frontend/src/app/ui/PageLoader.tsx`.
- **DEP-007**: Shared query infrastructure under `apps/frontend/src/app/runtime/queries/` and admin runtime query hooks.
- **DEP-008**: Frontend UI governance in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` and domain naming governance in `docs/07-governance/domain-naming-decision-log.md`.

## 5. Files

- **FILE-001**: `apps/frontend/src/app/copy/system.ts` - canonical copy authority to be expanded and normalized.
- **FILE-002**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` - machine error and guidance copy centralization.
- **FILE-003**: `apps/frontend/src/features/tools/runtime/tool-page-context.ts` - removal of string-based branching and copy centralization.
- **FILE-004**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` - `DispatchError` fallback copy centralization.
- **FILE-005**: `apps/frontend/src/features/tools/runtime/tool-page-runtime-utils.ts` - optional shared copy-mapping helper.
- **FILE-006**: `apps/frontend/src/features/tools/ui/ToolStatusCard.tsx` - Tool Workspace status-card copy centralization.
- **FILE-007**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` - session detail hardcoded copy removal.
- **FILE-008**: `apps/frontend/src/app/ui/PageLoader.tsx` - loader copy centralization.
- **FILE-009**: `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts` - query fallback copy centralization.
- **FILE-010**: `apps/frontend/src/app/runtime/queries/useModelsQuery.ts` - query fallback copy centralization.
- **FILE-011**: `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts` - query fallback copy centralization.
- **FILE-012**: `apps/frontend/src/app/runtime/queries/useArtifactsQuery.ts` - query fallback copy centralization.
- **FILE-013**: `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` - query fallback copy centralization.
- **FILE-014**: `apps/frontend/src/app/runtime/queries/useAdminModelsQuery.ts` - query fallback copy centralization.
- **FILE-015**: `apps/frontend/src/features/admin/runtime/useAdminChangelogQuery.ts` - query fallback copy centralization.
- **FILE-016**: `apps/frontend/src/features/admin/runtime/useAdminUserReportsQuery.ts` - query fallback copy centralization.
- **FILE-017**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` - machine copy assertions update.
- **FILE-018**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx` - session detail copy assertions update.
- **FILE-019**: `apps/frontend/src/features/tools/` static guard file to prevent reintroduction of hardcoded production copy in the scoped surfaces.

## 6. Testing

- **TEST-001**: `briefingUploadMachine` tests must still pass after string extraction and must confirm user-facing errors remain mapped to readable centralized copy.
- **TEST-002**: `SessionSummaryDetailPage` tests must still pass after relaunch CTA, detail labels, aria labels, and fallbacks are moved to `appCopy`.
- **TEST-003**: The Tool Workspace guidance path for missing `AngleDetectorFile` must still render the specialized guidance copy without relying on equality against another rendered message.
- **TEST-004**: Query hooks must continue to return the same fallback error behavior, but with centralized copy sourced from `appCopy.ui.fallbackErrors`.
- **TEST-005**: Frontend typecheck must exit 0.
- **TEST-006**: Frontend build must exit 0.
- **TEST-007**: Static grep review from TASK-023 must confirm that the targeted production surfaces do not retain hardcoded user-facing strings except for approved exemptions.
- **TEST-008**: Static grep from TASK-027 must return zero matches for the known candidate literals discovered during copy inventory.

## 7. Risks & Assumptions

- **RISK-001**: `appCopy` may become flatter and less navigable if new keys are added without strict grouping discipline.
- **RISK-002**: Some query fallback strings may currently be reused implicitly by generic infrastructure; centralization may require touching more hooks than initially expected.
- **RISK-003**: Session detail and artifact/session preview surfaces may contain additional hidden literals adjacent to the known candidates, requiring one extra focused follow-up inside the same slice.
- **RISK-004**: Tests that assert exact Italian copy may become brittle if the plan changes wording and extraction happens in the same patch; sequencing matters.
- **ASSUMPTION-001**: `apps/frontend/src/app/copy/system.ts` is the intended single frontend copy authority and can safely absorb the missing namespaces without architectural conflict.
- **ASSUMPTION-002**: Removing string-based branching in Tool Workspace runtime can be done with currently available typed state and file-selection facts, without backend changes.
- **ASSUMPTION-003**: Query fallback copy belongs to the same frontend copy-governance effort even when rendered indirectly by shared query state components.

## 8. Related Specifications / Further Reading

[docs/01-requirements/domain-ubiquitous-language-glossary.md](../../../01-requirements/domain-ubiquitous-language-glossary.md)
[docs/02-design/domain-bounded-context-map.md](../../../02-design/domain-bounded-context-map.md)
[docs/07-governance/domain-naming-decision-log.md](../../../07-governance/domain-naming-decision-log.md)
[docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md](../../../02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[../../../99-lifecycle/99-archive/plans/refactor-tool-workspace-workflow-panel-unified-1.md](./refactor-tool-workspace-workflow-panel-unified-1.md)
[../../../99-lifecycle/99-archive/plans/refactor-tool-generation-flow-monitoring-dashboard-1.md](./refactor-tool-generation-flow-monitoring-dashboard-1.md)