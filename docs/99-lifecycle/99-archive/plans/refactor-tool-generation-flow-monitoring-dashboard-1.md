---
goal: Refactor the Tool Workspace Workflow Panel into a monitoring dashboard
version: 1.0
date_created: 2026-05-23
last_updated: 2026-05-23
owner: Frontend/UI
status: 'Completed'
tags: [refactor, frontend, ux, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan converts the current `ToolGenerationFlowVertical` Workflow Panel into the canonical monitoring dashboard described in the proposal. The implementation keeps the Tool Workspace Page archetype intact, preserves DDD-084 and DDD-085 naming convergence, and introduces a two-card monitor (`Progress` + `Contesto`) with a unified phase-aware progress element.

## 1. Requirements & Constraints

- **REQ-001**: The Workflow Panel must remain part of the Tool Workspace Page and must not replace the Setup Panel.
- **REQ-002**: `ToolGenerationFlowVertical` must render the monitoring dashboard using the canonical UI state source (`CanonicalToolUiState`) and must keep `DispatchError` in the Setup Panel only.
- **REQ-003**: The payload view must be present in every monitoring phase and must use canonical file terminology, including `BriefingFile` and `AngleDetectorFile` where applicable.
- **REQ-004**: Extraction monitoring must support staged progress or determinate progress, and completion must expose a `SessionSummary` handoff CTA when `sessionId` is available.
- **REQ-005**: Generation monitoring must show step advancement with `N/N` and current step focus through phase-selective progress metrics, without a dedicated step rail.
- **REQ-006**: Completion state must visually emphasize `completed` and must reset the Setup Panel to a blank ready-to-start state after the run finishes.
- **SEC-001**: Do not duplicate user-facing error messages across Setup Panel and Workflow Panel; keep blocking errors localized to the correct surface.
- **CON-001**: Preserve canonical naming convergence from DDD-085: preload-bar variant and CSS class must use `completed`, not `done`.
- **CON-002**: Preserve the existing Tool Workspace Page archetype and do not introduce a new page type or route namespace.
- **GUD-001**: Reuse the canonical terms from `domain-ubiquitous-language-glossary.md`, `domain-bounded-context-map.md`, and `domain-naming-decision-log.md` without introducing synonyms.
- **PAT-001**: Keep the implementation aligned with the existing refactor plan and source-of-truth spec for `ToolGenerationFlowVertical`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Align the Workflow Panel contract and visual vocabulary with the monitoring dashboard proposal.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` so the Workflow Panel renders the payload layer, progress layer, and step layer according to `CanonicalToolUiState`, `projectName`, and `errorMessage` only. Remove any remaining rendering paths for checklist-style payload summaries or feedback aggregation in the panel body. | ✅ | 2026-05-23 |
| TASK-002 | Update `apps/frontend/src/styles.css` so the preload bar variants and completion styling match the monitoring states, including `workflow-preload-bar.is-completed` and the active/paused/hidden variants used by `ToolGenerationFlowVertical`. | ✅ | 2026-05-23 |
| TASK-003 | Update `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` so the behavioral coverage asserts the new dashboard composition, payload confirmation copy, extraction handoff CTA behavior, and `completed` state rendering. | ✅ | 2026-05-23 |

### Implementation Phase 2

- GOAL-002: Add regression protection for DDD-084 and DDD-085 convergence and wire the dashboard states to the current frontend runtime.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Keep or extend `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.status-naming.guard.test.ts` so it statically rejects any `is-done` preload-bar naming drift and verifies that `completed` remains the only preload-bar completion token. | ✅ | 2026-05-23 |
| TASK-005 | Update `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` and the related runtime projection path if needed so `SessionSummary` handoff, `DispatchError`, and `GenerationRequest`-derived state are mapped into the new monitoring dashboard without reintroducing duplicated feedback channels. | ✅ | 2026-05-23 |
| TASK-006 | Update `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` and `docs/07-governance/domain-naming-decision-log.md` only if the implementation requires a contract clarification beyond the current DDD-084 and DDD-085 decisions. | ✅ | 2026-05-23 |

### Implementation Phase 3

- GOAL-003: Validate the monitoring dashboard with focused tests and confirm that the proposal traceability remains complete.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Run the focused frontend tests for `ToolGenerationFlowVertical.test.tsx` and `ToolGenerationFlowVertical.status-naming.guard.test.ts` and confirm they pass after the dashboard refactor. | ✅ | 2026-05-23 |
| TASK-008 | Verify that `ToolGenerationFlowVertical` still composes with the existing frontend runtime without changing the canonical route or bounded context ownership. | ✅ | 2026-05-23 |
| TASK-009 | Confirm that the proposal file `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md` still reflects the implemented phases and file touchpoints after the refactor is complete. | ✅ | 2026-05-23 |

## 3. Alternatives

- **ALT-001**: Keep the current fragmented Workflow Panel and only add a few visual indicators. Rejected because it would preserve the checklist-style surface and fail to deliver the dashboard behavior described in the proposal.
- **ALT-002**: Move payload, progress, and step visibility into the Setup Panel. Rejected because it would blur the separation between configuration and monitoring and would conflict with the Tool Workspace Page structure.

## 4. Dependencies

- **DEP-001**: `CanonicalToolUiState` and the Tool Workspace machine projection already implemented in `apps/frontend/src/features/generation/ui/tool-ux-state.ts`.
- **DEP-002**: `ToolGenerationFlowVertical` and its tests in `apps/frontend/src/features/tools/ui/`.
- **DEP-003**: DDD-084 and DDD-085 in `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-004**: The source-of-truth spec in `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`.
- **DEP-005**: Vitest and Testing Library coverage for the frontend workspace.

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` - Workflow Panel composition and runtime state projection.
- **FILE-002**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` - behavioral tests for payload, progress, and completion states.
- **FILE-003**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.status-naming.guard.test.ts` - static naming drift guard.
- **FILE-004**: `apps/frontend/src/styles.css` - preload bar variants and completion styling.
- **FILE-005**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` - page-level orchestration and action placement.
- **FILE-006**: `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` - canonical UI contract reference.
- **FILE-007**: `docs/07-governance/domain-naming-decision-log.md` - DDD governance record for status naming convergence.
- **FILE-008**: `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md` - implementation proposal and screen-by-screen wireframes.

## 6. Testing

- **TEST-001**: `npm --workspace apps/frontend run test -- ToolGenerationFlowVertical.test.tsx` must pass after the refactor.
- **TEST-002**: `npm --workspace apps/frontend run test -- ToolGenerationFlowVertical.status-naming.guard.test.ts` must pass and must reject `is-done` preload-bar regressions.
- **TEST-003**: The Workflow Panel must render the `completed` preload-bar class in the completion state and must not render `WorkflowPanelFeedbackItem` aggregates.
- **TEST-004**: The completion state must expose the handoff CTA to `/sessionsummary/{sessionId}` when `SessionSummary` data is present.
- **TEST-005**: The Setup Panel must retain `DispatchError` placement while Workflow Panel keeps phase-specific progress metrics (`Step corrente` + extraction/generation selective secondary metric).

## 7. Risks & Assumptions

- **RISK-001**: The runtime projection may still carry legacy assumptions about checklist-style payload or feedback rendering, requiring a second pass in `ToolPageTemplate`.
- **RISK-002**: CSS-only changes may not be sufficient if the component still emits obsolete DOM structure for payload or step summaries.
- **ASSUMPTION-001**: The current frontend runtime already provides enough state to render payload confirmation, extraction progress, and step progression without a backend contract change.
- **ASSUMPTION-002**: DDD-084 and DDD-085 remain the authoritative governance baseline for the monitoring dashboard and preload-bar naming.

## 10. Post-Completion Alignment Delta (2026-05-23)

- **ALIGN-001**: Root Workflow Panel card removed; only internal `Progress` and `Contesto caricato` cards remain visually surfaced.
- **ALIGN-002**: Project block moved/kept inside `Contesto caricato` and aligned to `done` green visual semantics when project is selected.
- **ALIGN-003**: Unified progress bar behavior normalized across both phases: extraction stop->play->stop, generation stop/play/stop according to canonical state transitions.
- **ALIGN-004**: `paused-with-checkpoint` normalized to stop-state rendering for generation progress.
- **ALIGN-005**: `ui-fv-progress-metric` fields made phase-selective (extraction informational metrics vs generation step/count metrics).

## 8. Related Specifications / Further Reading

- [docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md](../docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md)
- [docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md](../docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)

## 9. Post-Implementation Corrections Register

- **COR-001 (2026-05-23)**: `Apri sessione` CTA visibility corrected to completion-only (`CanonicalToolUiState = completed`).
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`, `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md`.
- **COR-002 (2026-05-23)**: Extraction phase progress bar corrected to active behavior under `processing-briefing`.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`.
- **COR-003 (2026-05-23)**: Monitoring copy corrected from `Payload` to `Contesto` in UI/documented copy.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`, `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md`.
- **COR-004 (2026-05-23)**: File status projection corrected so uploaded files remain `done`/green during extraction and generation.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`.
- **COR-005 (2026-05-23)**: Workflow Panel root card removed; two internal cards left as the only visual card surfaces.
	Impacted files: `apps/frontend/src/styles.css`.
- **COR-006 (2026-05-23)**: Project selected indicator aligned to the same green `done` visual tokens used by uploaded files.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/styles.css`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`.
- **COR-007 (2026-05-23)**: Unified progress-bar lifecycle applied across extraction and generation phases with explicit stop/play transitions.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`, `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md`, `docs/07-governance/domain-naming-decision-log.md`.
- **COR-008 (2026-05-23)**: `paused-with-checkpoint` mapped to stop-state visualization in generation phase.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`.
- **COR-009 (2026-05-23)**: Progress metrics (`ui-fv-progress-metric`) made phase-selective to avoid generation-only counters during extraction.
	Impacted files: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`, `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`, `docs/ux/tool-generation-flow-monitoring-dashboard-proposal.md`.