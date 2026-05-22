---
goal: Implement Tool Workspace Workflow Panel unified feedback and payload visibility model from proposal
version: 1.0
date_created: 2026-05-23
last_updated: 2026-05-23
owner: Frontend Platform Team
status: Planned
tags: [refactor, frontend, ddd, ux, tool-workspace, workflow-panel]
---

# Introduction

This plan defines the deterministic implementation path for the Tool Workspace Page refactor that unifies process feedback in Workflow Panel and introduces persistent InputFilePayloadStatus visibility across input, monitoring, and completion phases.

## 1. Requirements & Constraints

- REQ-001: Replace phase-exclusive Requisiti rendering in Workflow Panel with persistent payload-focused rendering aligned to DDD-082 InputFilePayloadStatus.
- REQ-002: Implement Workflow Panel feedback aggregation as a single inline-action channel surface for briefing error, readiness messages, missing required files, artifacts reload error, optional-file advisories, and extraction-start hint.
- REQ-003: Keep DispatchError as the only inline process feedback in Setup Panel adjacent to primary CTA, per DDD-061 and DDD-063 ownership.
- REQ-004: Remove inline process feedback paragraphs from Setup Panel in ToolPageTemplate except DispatchError.
- REQ-005: Replace monitoring progress model from step counter plus step list to indeterminate progress section with stable reassurance copy.
- REQ-006: Apply guard for prefilled-regenerate in monitoring section so indeterminate progress and reassurance copy render only for canonical states running and paused-with-checkpoint.
- REQ-007: Completion phase must show completion confirmation and persistent payload section without artifact links/download controls in Workflow Panel.
- REQ-008: Introduce explicit WorkflowPanelFeedbackItem type and deterministic mapping priority for feedback entries.
- REQ-009: Introduce InputFilePayloadStatus derivation in ToolPageTemplate from policy registry and runtime file completion evidence.
- REQ-010: Update ToolGenerationFlowVertical props to the new contract and remove obsolete props listed in proposal.
- REQ-011: Preserve existing generation orchestration behavior in useToolPage and useToolPageRunController with no contract regression.
- REQ-012: Ensure tests cover both single-file and multi-file tool behavior with optional and required file states.
- REQ-013: Implement a visually coherent Workflow Panel composition aligned with proposal wireframes for input, monitoring, and completion phases.
- REQ-014: Ensure the resulting Workflow Panel contains at least one explicitly validated graphic UI element for UX goals: persistent InputFilePayloadStatus block with deterministic visual states and iconography.
- REQ-015: Define deterministic visual acceptance criteria for spacing, typography hierarchy, color/state consistency, and message grouping in Workflow Panel.
- REQ-016: Persist visual-evidence artifacts and checklist outcome in a deterministic execution log file at plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md.
- ACC-001: Add accessibility semantics: role alert/status by severity, progressbar without aria-valuenow for indeterminate state, aria-live polite for payload state changes and monitoring reassurance copy.
- ACC-002: Preserve visual accessibility constraints for the new graphic element: text contrast compliant with existing design tokens, non-color-only state signaling, and clear focus/reading order.
- DDD-001: Use canonical terms only: InputFilePayloadStatus (DDD-082), ToolInputFileRequirementPolicy (DDD-081), FeedbackChannel inline-action (DDD-063), DispatchError (DDD-061).
- CON-001: Scope is frontend only; backend contracts and APIs are unchanged.
- CON-002: Do not modify canonical DispatchError ownership or migrate DispatchError to global feedback channel.
- CON-003: Keep all filenames in this plan and future implementation changes aligned with existing workspace taxonomy and deterministic naming.
- CON-004: Avoid human-only validation language; every acceptance gate must produce repository-stored evidence or command output.
- GUD-001: Use smallest coherent edits per concern; avoid unrelated style or architecture changes.
- GUD-002: Avoid placeholder or temporary visual styles; implement production-grade visual states in the same refactor cycle.
- GUD-003: During execution, prefer phase-level delegation to specialized sub-agents when available; each delegated task must include explicit input context and deterministic output gate.
- PAT-001: Build selector-first derivations in runtime and keep UI components presentation-focused.
- VIS-001: Use one visual language across all panel sections (payload, monitoring, feedback) with consistent icon scale, row rhythm, and state token mapping.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define canonical UI data contracts for unified Workflow Panel rendering.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx add InputFilePayloadStatus type with fields key, label, requiredness, status, fileName exactly as DDD-082. |  |  |
| TASK-002 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx add WorkflowPanelFeedbackItem type with fields id, severity, message, source where severity is error or info. |  |  |
| TASK-003 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx replace ToolGenerationFlowVerticalProps contract to include inputFilePayload and workflowPanelFeedback and remove obsolete props steps, completedStepsCount, totalStepsCount, briefingError, briefingGuidance, readinessReasonCodes, briefingFileName, briefingStatus. |  |  |
| TASK-004 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx add deterministic internal helpers for feedback grouping and payload row display state with optional requiredness badges. |  |  |

### Implementation Phase 2

- GOAL-002: Implement unified Workflow Panel rendering behavior by phase.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx replace input-phase Requisiti checklist with Payload caricato section that is always visible in all phases. |  |  |
| TASK-006 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx remove monitoring/completion step list rendering and progress counter rendering entirely. |  |  |
| TASK-007 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement monitoring indeterminate progress section with guard canonicalState equals running or paused-with-checkpoint only. |  |  |
| TASK-008 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement stable reassurance copy in monitoring for running and paused-with-checkpoint variants with deterministic text branch. |  |  |
| TASK-009 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement completion section with generation completed message plus payload visibility and no artifact link/download controls. |  |  |
| TASK-010 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement Feedback section rendering from workflowPanelFeedback and hide section when list is empty. |  |  |
| TASK-011 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx apply accessibility attributes: role alert for error feedback items, role status for info items, role progressbar indeterminate for monitoring bar, aria-live polite for payload/monitoring textual updates. |  |  |

### Implementation Phase 3

- GOAL-003: Move process feedback derivation from Setup Panel to Workflow Panel while preserving DispatchError ownership.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx add local derivation function for inputFilePayload using selectToolFileInstructions plus deriveToolInputFileCompletion plus effectiveBriefingFileName plus angleDetectorFileName plus effectiveBriefingStatus. |  |  |
| TASK-013 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx add local derivation for workflowPanelFeedback with deterministic priority: briefingError, missingRequiredFiles, readiness reason mapping, artifactsReloadError, briefingGuidance, missingOptionalFiles advisory, extraction-ready hint. |  |  |
| TASK-014 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx remove inline process feedback paragraphs from Setup Panel: briefingError, briefingGuidance, required-files message, optional-files message, extraction-ready hint, artifactsReloadError. |  |  |
| TASK-015 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx keep DispatchError rendering unchanged in Setup Panel near CTA and keep existing ownership comment. |  |  |
| TASK-016 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx pass inputFilePayload and workflowPanelFeedback to ToolGenerationFlowVertical and remove obsolete prop wiring. |  |  |
| TASK-017 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx suppress per-file inline RHF error display below upload controls while preserving zod validation to block submit behavior. |  |  |

### Implementation Phase 4

- GOAL-004: Update styles and UI primitives for new panel composition.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | In apps/frontend/src/styles.css replace ToolGenerationFlowVertical style block classes used by removed step list and old progress counter with classes for payload rows, optional badge, feedback list, and indeterminate progress pulse. |  |  |
| TASK-019 | In apps/frontend/src/styles.css keep existing design token usage and avoid introducing new color primitives unless required by accessibility contrast checks. |  |  |
| TASK-020 | In apps/frontend/src/styles.css ensure responsive behavior for payload rows with long filenames and optional labels without overflow regressions. |  |  |

### Implementation Phase 4b

- GOAL-004B: Enforce visual acceptance and graphic validity for UX refactor outcomes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-033 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement a deterministic visual state map for payload rows: todo-required, todo-optional, active, done, error with explicit icon and text treatment per proposal. |  |  |
| TASK-034 | In apps/frontend/src/styles.css add or update classes so Payload caricato section behaves as a clearly legible graphic element: stable row spacing, filename truncation policy, optional badge visibility, and severity-aligned feedback grouping. |  |  |
| TASK-035 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx add assertions for visual semantics rendered in DOM (state labels, optional marker text, feedback order and presence), so visual intent is regression-tested. |  |  |
| TASK-036 | Produce implementation evidence in plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md with three phase screenshots (input, monitoring, completion) captured from current app state proving graphic coherence with docs/ux/tool-page-sidebar-unified-flow.md. |  |  |

### Implementation Phase 5

- GOAL-005: Validate behavior with deterministic tests and quality gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Update apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx to assert new prop contract and phase rendering: persistent payload section, monitoring indeterminate section, completion section, feedback severity roles, prefilled-regenerate guard behavior. |  |  |
| TASK-022 | Update apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx to assert Setup Panel no longer renders process feedback messages except DispatchError and Workflow Panel receives aggregated feedback. |  |  |
| TASK-023 | Update apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx and apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx for new message ownership placement in Workflow Panel. |  |  |
| TASK-024 | Keep apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts green and add assertions only if new helper derivations are introduced there. |  |  |
| TASK-025 | Run targeted test gate command: npm --workspace apps/frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx src/features/tools/runtime/tool-page-selectors.test.ts src/features/tools/runtime/useToolPage.test.ts. |  |  |
| TASK-026 | Run frontend typecheck gate: npm --workspace apps/frontend run typecheck. |  |  |
| TASK-027 | Run frontend build gate: npm --workspace apps/frontend run build. |  |  |
| TASK-028 | Run static usage check to ensure old ToolGenerationFlowVertical props were fully removed from call sites: rg -n "readinessReasonCodes|briefingGuidance|briefingError|completedStepsCount|totalStepsCount" apps/frontend/src/features/tools. |  |  |

### Implementation Phase 6

- GOAL-006: Align technical documentation after code changes and keep governance consistency.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | Update docs/02-design/specifications/tool-page-frontend-runtime-spec.md to reflect new Workflow Panel prop contract and feedback ownership split after implementation lands. |  |  |
| TASK-030 | Update docs/02-design/specifications/frontend-tool-pages-architecture-spec.md for new ToolGenerationFlowVertical responsibilities and removed step list/progress counter behavior. |  |  |
| TASK-031 | Update docs/02-design/tool-generation-flow.md and docs/02-design/tool-generation-flow-source-of-truth-spec.md to describe persistent payload visibility and monitoring indeterminate progress behavior. |  |  |
| TASK-032 | Validate docs index consistency for touched documentation pages in docs/index-overview.md and update references if changed paths/sections require it. |  |  |

## 3. Alternatives

- ALT-001: Keep Requisiti checklist plus step list and add only minor copy tweaks. Rejected because it keeps phase-exclusive payload visibility problem unresolved.
- ALT-002: Move all feedback including DispatchError into Workflow Panel. Rejected because it violates DDD-061 and DDD-063 ownership contract.
- ALT-003: Keep RHF per-field inline errors and duplicate them in Workflow Panel. Rejected because it creates dual-channel ambiguity and message duplication.
- ALT-004: Implement determinate progress based on completed steps in monitoring. Rejected because proposal requires indeterminate progress for long-running opaque backend flow.

## 4. Dependencies

- DEP-001: Existing tool input policy runtime registry in apps/frontend/src/features/tools/runtime/tool-form-architecture.ts.
- DEP-002: Existing completion derivations in apps/frontend/src/features/tools/runtime/tool-page-selectors.ts.
- DEP-003: Existing orchestration outputs from useToolPage in apps/frontend/src/features/tools/runtime/useToolPage.ts.
- DEP-004: Existing DispatchError ownership and action handling in apps/frontend/src/features/tools/runtime/useToolPageRunController.ts and ToolPageTemplate.
- DEP-005: DDD governance references in docs/07-governance/domain-naming-decision-log.md entries DDD-061, DDD-063, DDD-081, DDD-082.
- DEP-006: UX proposal baseline in docs/ux/tool-page-sidebar-unified-flow.md.

## 5. Files

- FILE-001: apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx - replace component contract and rendering structure.
- FILE-002: apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx - derive panel payload/feedback data and remove inline process messages except DispatchError.
- FILE-003: apps/frontend/src/styles.css - update flow panel CSS classes to new composition.
- FILE-004: apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx - update unit tests for new props and phase behavior.
- FILE-005: apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx - update integration tests for feedback ownership and wiring.
- FILE-006: apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx - update extraction CTA feedback assertions.
- FILE-007: apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx - update single-file extraction feedback assertions.
- FILE-008: docs/02-design/specifications/tool-page-frontend-runtime-spec.md - post-implementation runtime spec alignment.
- FILE-009: docs/02-design/specifications/frontend-tool-pages-architecture-spec.md - post-implementation architecture spec alignment.
- FILE-010: docs/02-design/tool-generation-flow.md - post-implementation flow narrative alignment.
- FILE-011: docs/02-design/tool-generation-flow-source-of-truth-spec.md - post-implementation source-of-truth alignment.
- FILE-012: docs/index-overview.md - documentation index alignment for touched docs.

## 6. Testing

- TEST-001: ToolGenerationFlowVertical unit tests pass with new prop model and phase rendering assertions.
- TEST-002: ToolPageTemplate integration tests pass with Setup Panel feedback suppression and Workflow Panel aggregation assertions.
- TEST-003: Extraction CTA tests pass for both multi-file and single-file tool contexts with new feedback placement.
- TEST-004: Existing runtime selector and useToolPage tests remain green to confirm no orchestration regressions.
- TEST-005: Frontend typecheck command exits 0.
- TEST-006: Frontend build command exits 0.
- TEST-007: Static grep confirms obsolete ToolGenerationFlowVertical props removed from production call sites.
- TEST-008: Accessibility smoke checks in tests verify role alert/status placement and progressbar semantics.
- TEST-009: Visual regression smoke check confirms Payload caricato graphic element renders correctly in all three phases (input, monitoring, completion) with expected status/icon combinations.
- TEST-010: DOM-level assertions verify optional file visual marker and required/error/info ordering in Workflow Panel feedback block.
- TEST-011: Manual responsive verification at desktop and mobile widths confirms row readability, no overlap, and no clipping for long file names.
- TEST-012: Deterministic evidence file gate passes: test -f plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md.
- TEST-013: Deterministic evidence content gate passes: rg -n "VAC-001|VAC-002|VAC-003|VAC-004|VAC-005|VAC-006|VAC-007|VAC-008" plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md.

### Visual Acceptance Checklist

Execution field semantics:
- Status values are fixed: pending | pass | fail.
- Evidence path must point to an artifact stored in repository or to a deterministic test file assertion.

| ID | Checkpoint | Pass Criteria | Evidence Required | Status |
|----|------------|---------------|-------------------|--------|
| VAC-001 | Persistent payload block | Payload caricato section is visible in input, monitoring, and completion phases without phase-exclusive disappearance. | 3 screenshots in plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md: input + monitoring + completion | pending |
| VAC-002 | File row state semantics | Each file row matches proposal semantics for todo-required, todo-optional, active, done, error using icon plus text cue, not color only. | DOM assertions in apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx + screenshot with mixed states | pending |
| VAC-003 | Monitoring progress behavior | Indeterminate progress bar and reassurance copy render only for running and paused-with-checkpoint, never for prefilled-regenerate. | Test assertion for guard in apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx + running screenshot | pending |
| VAC-004 | Feedback channel visual grouping | Workflow Panel Feedback section shows ordered messages (error first, info after) and hides when list is empty. | Ordered-rendering assertions in apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx + screenshot with both severities | pending |
| VAC-005 | Setup Panel message suppression | Setup Panel contains no process-feedback paragraphs except DispatchError near primary CTA. | Assertions in apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx + setup screenshot | pending |
| VAC-006 | Optional marker readability | Optional file rows display clear optional marker text and remain readable at mobile width. | Mobile screenshot evidence in plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md | pending |
| VAC-007 | Filename overflow handling | Long filenames truncate safely without overlap, layout break, or clipped status markers. | Desktop and mobile screenshots with long filename fixture in plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md | pending |
| VAC-008 | Visual consistency | Typography scale, spacing rhythm, and icon sizing are uniform across payload, monitoring, and feedback sections. | Execution log section in plan/execution-evidence/refactor-tool-workspace-workflow-panel-unified-1.md with deterministic checklist outcome | pending |

Checklist usage rule: implementation is not review-ready until all VAC rows are marked pass with attached evidence.

## 7. Risks & Assumptions

- RISK-001: Feedback aggregation ordering may accidentally hide higher-priority blocking messages if not implemented deterministically.
- RISK-002: Removing per-field RHF inline errors may reduce immediate local clarity if Workflow Panel mapping is incomplete.
- RISK-003: CSS refactor in styles.css may produce visual regressions in small viewport layouts for long file names.
- RISK-004: Existing tests may assert legacy copy or locations and require broader updates than expected.
- RISK-005: Documentation references with old prop names may drift if not updated in same delivery cycle.
- RISK-006: Visual implementation may satisfy logic but still miss UX readability goals if visual acceptance criteria are not enforced during review.
- ASSUMPTION-001: Current useToolPage outputs remain sufficient to derive InputFilePayloadStatus without new backend data.
- ASSUMPTION-002: Tool input policy keys remain stable for current SupportedTool set.
- ASSUMPTION-003: No additional DDD naming decision is required beyond already approved DDD-082 and DDD-063 terms.

## 8. Related Specifications / Further Reading

### UX Quick Links

- [UX Proposal - Tool Workspace Workflow Panel Unificato](../docs/ux/tool-page-sidebar-unified-flow.md)
- [Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
- [Tool Page Frontend Runtime Spec](../docs/02-design/specifications/tool-page-frontend-runtime-spec.md)
- [Frontend Tool Pages Architecture Spec](../docs/02-design/specifications/frontend-tool-pages-architecture-spec.md)
- [Frontend Design System and UI Kit Guide](../docs/02-design/specifications/frontend-design-system-ui-kit-guide.md)

- [Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
- [Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
- [Related Plan - Tool Input Policy](./refactor-ddd-081-tool-input-policy-1.md)

## 9. Sub-Agent Delegation Guidance

Delegation policy:
- Use delegation as optional acceleration, not as ownership transfer.
- Main agent remains accountable for final integration, conflict resolution, and quality gates.
- Every delegated unit must return file diffs plus executed-command evidence.
- Do not delegate tasks that require cross-phase architectural decisions unless explicitly scoped.

Execution handoff format required for each delegated task:
- Scope: exact task IDs and files touched.
- Inputs: canonical docs, constraints, and acceptance criteria copied from this plan.
- Outputs: patch summary, tests run, command results, unresolved risks.
- Gate: pass/fail outcome mapped to TASK and TEST IDs.

### Phase-To-Skill Mapping

| Delegation Unit | Primary Objective | Suggested Skill | Input Package | Expected Output |
|-----------------|-------------------|-----------------|---------------|-----------------|
| Phase 1 (TASK-001..TASK-004) | Define and stabilize component contract types and helpers | refactor-plan | ToolGenerationFlowVertical.tsx + REQ-008/REQ-010 + DDD-082 | Type contract diff + obsolete prop removal confirmation |
| Phase 2 (TASK-005..TASK-011) | Implement phase rendering and accessibility semantics | context-map | ToolGenerationFlowVertical.tsx + proposal wireframes + ACC-001/ACC-002 | Rendering diff + accessibility attribute checklist |
| Phase 3 (TASK-012..TASK-017) | Move feedback ownership and derive panel payload/feedback | refactor-plan | ToolPageTemplate.tsx + selector outputs + REQ-002/REQ-004 | Wiring diff + message ownership matrix validated |
| Phase 4 and 4b (TASK-018..TASK-020, TASK-033..TASK-036) | Implement visual system coherence and evidence artifacts | context-map | styles.css + ToolGenerationFlowVertical tests + VAC checklist | CSS diff + VAC evidence references + screenshot inventory |
| Phase 5 (TASK-021..TASK-028) | Harden tests and quality gates | context-map | test files listed in section 5 + TEST-001..TEST-013 | Updated tests + green command outputs + grep evidence |
| Phase 6 (TASK-029..TASK-032) | Align documentation after implementation | refactor-plan | docs targets + DDD references + index-overview constraints | Doc diffs + index consistency confirmation |

### Task-Level Skill Suggestions

| Task ID | Recommended Skill | Delegation Note |
|---------|-------------------|-----------------|
| TASK-003 | refactor-plan | Use for safe contract migration and call-site impact minimization. |
| TASK-007 | context-map | Use to map all canonicalState rendering branches before editing guards. |
| TASK-013 | refactor-plan | Use to keep deterministic feedback priority mapping explicit and testable. |
| TASK-018 | context-map | Use to map style selector usage and avoid dead-class regressions. |
| TASK-021 | refactor-plan | Use to restructure tests for new props and phase semantics. |
| TASK-022 | refactor-plan | Use to assert Setup Panel suppression and Workflow Panel ownership boundaries. |
| TASK-031 | refactor-plan | Use to keep docs aligned with implementation deltas only. |

### Delegation Anti-Patterns

- Do not delegate mixed concerns in one batch (for example contract change plus unrelated CSS cleanup).
- Do not accept delegated output without TEST and VAC gate evidence.
- Do not merge delegated patches that introduce non-canonical terminology.
- Do not skip final end-to-end run after integrating multiple delegated patches.
