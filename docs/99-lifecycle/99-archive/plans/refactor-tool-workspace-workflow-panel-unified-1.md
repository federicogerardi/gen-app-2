---
goal: Simplify Tool Workspace Workflow Panel to single preload bar and minimal status text
version: 2.0
date_created: 2026-05-23
last_updated: 2026-05-23
owner: Frontend Platform Team
status: Completed
tags: [refactor, frontend, ddd, ux, tool-workspace, workflow-panel]
---

# Introduction

This plan supersedes the v1.0 multi-section approach (payload checklist + feedback aggregation + step list), which fragmented the UX into too many labelled elements. The new direction is: **one preload bar for the entire process lifecycle, one status text line, zero aggregated message lists**. The Workflow Panel becomes a silent, visual-first status indicator. The Setup Panel remains interaction-only.

## 1. Requirements & Constraints

> **v1.0 requirements REQ-001..REQ-016, ACC-001..ACC-002, VIS-001 are superseded.** The payload checklist (REQ-001, REQ-009, REQ-014), feedback aggregation (REQ-002, REQ-008), and step list approach (REQ-005, REQ-013) are cancelled — they produced a fragmented, over-labelled UI that betrayed the simplification goal.

### Active requirements (v2.0)

- SREQ-001: Workflow Panel exposes exactly three elements: one preload bar, one status text line, one optional blocking error line. No lists, no sections, no badges.
- SREQ-002: Preload bar drives all lifecycle transitions via `canonicalState`: hidden in `draft-empty`; indeterminate pulse in `running` / `paused-with-checkpoint`; full/stopped in `completed`; error accent in stream-failed states.
- SREQ-003: Status text is one line derived from existing `whereLabel` + `instruction` helpers. No additional descriptive copy blocks.
- SREQ-004: All payload checklist, step row lists, WorkflowPanelFeedbackItem aggregation, InputFilePayloadStatus sections, and readiness-reason labels are removed from the Workflow Panel.
- SREQ-005: DispatchError remains the only inline process feedback in Setup Panel adjacent to primary CTA. Constraint from DDD-061 / CON-002 is unchanged.
- SREQ-006: Setup Panel removes all process-feedback paragraphs except DispatchError (briefingError, briefingGuidance, required-files message, optional-files message, extraction-ready hint, artifactsReloadError).
- SREQ-007: ToolGenerationFlowVertical props contract is reduced to `{ canonicalState, projectName, errorMessage }`. All other props are removed.
- SREQ-008: Preserve existing generation orchestration behavior in useToolPage and useToolPageRunController with no contract regression.
- SREQ-009: Preload bar is accessible: `role="progressbar"` without `aria-valuenow` when indeterminate; status text uses `aria-live="polite"`; error line uses `role="alert"`.
- SREQ-010: Reuse existing CSS design tokens; no new color primitives unless required by accessibility contrast. Use smallest coherent CSS change.
- SREQ-011: Avoid human-only validation language; every acceptance gate must produce repository-stored evidence or command output.
- CON-001: Scope is frontend only; backend contracts and APIs are unchanged.
- CON-002: Do not modify canonical DispatchError ownership or migrate DispatchError to global feedback channel.
- GUD-001: Use smallest coherent edits per concern; avoid unrelated style or architecture changes.

## 2. Implementation Steps

> **v1.0 phases 1–6 (TASK-001..TASK-036) are closed and superseded as of 2026-05-23.** Reason: the implemented result introduced fragmented step rows, payload checklist badges, and aggregated feedback sections that increased cognitive load and violated the simplification principle. All TASK-001..036 are marked **cancelled** and must not be executed. Proceed with phases S1–S4 below.

---

### Implementation Phase S1 — Simplify ToolGenerationFlowVertical contract and rendering

- GOAL-S01: Reduce Workflow Panel to a three-element composition: preload bar + status text + optional blocking error line.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-S01 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx replace the entire Props interface with `{ canonicalState: CanonicalToolUiState; projectName: string \| null; errorMessage: string \| null }`. Remove steps, completedStepsCount, totalStepsCount, briefingError, briefingGuidance, readinessReasonCodes, briefingFileName, briefingStatus, inputFilePayload, workflowPanelFeedback. |  |  |
| TASK-S02 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx remove all sub-components: StepRow, ReqItem, payload row renderers, feedback section renderers. |  |  |
| TASK-S03 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement a single preload bar element: hidden (opacity 0, no space) when canonicalState is draft-empty; indeterminate pulse when canonicalState is running or paused-with-checkpoint; full/static when canonicalState is completed; error accent when canonicalState is a stream-failed state. Use existing design tokens only. |  |  |
| TASK-S04 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx implement one status text line derived from canonicalState: map draft-empty → empty string (hidden), processing-briefing → "Elaborazione briefing…", draft-ready → "Pronto per la generazione", running → "Generazione in corso…", paused-with-checkpoint → "In pausa", completed → "Completato", prefilled-regenerate → "Pronto per rigenerare". |  |  |
| TASK-S05 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx render errorMessage only when non-null: single line with role="alert". No severity list, no aggregation. |  |  |
| TASK-S06 | In apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx apply accessibility attributes: role="progressbar" without aria-valuenow on indeterminate bar; aria-live="polite" on status text; role="alert" on error line. |  |  |

### Implementation Phase S2 — Clean ToolPageTemplate

- GOAL-S02: Strip all process-feedback paragraphs from Setup Panel; wire simplified props to Workflow Panel.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-S07 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx remove inline process-feedback paragraphs from Setup Panel: briefingError, briefingGuidance, required-files message, optional-files message, extraction-ready hint, artifactsReloadError. |  |  |
| TASK-S08 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx keep DispatchError rendering unchanged in Setup Panel near CTA (DDD-061 / CON-002). |  |  |
| TASK-S09 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx suppress per-file inline RHF error display below upload controls while preserving zod validation to block submit behavior. |  |  |
| TASK-S10 | In apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx pass `canonicalState`, `projectName`, and `errorMessage` (from dispatchError or briefingError, whichever is non-null, precedence: dispatchError first) to ToolGenerationFlowVertical. Remove all obsolete prop wiring (inputFilePayload, workflowPanelFeedback, steps, briefingError as separate prop, etc.). |  |  |

### Implementation Phase S3 — CSS

- GOAL-S03: Replace panel CSS with minimal preload bar classes; remove all step/payload/badge/feedback section classes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-S11 | In apps/frontend/src/styles.css remove CSS classes for step rows, payload rows, optional badge, feedback list, and old progress counter. |  |  |
| TASK-S12 | In apps/frontend/src/styles.css add or update a single `.workflow-preload-bar` class with: full-width, height 3–4px, border-radius, indeterminate pulse keyframe animation, and state variants (idle hidden, active pulse, done full, error accent). Use existing CSS custom properties (design tokens) for color. |  |  |
| TASK-S13 | In apps/frontend/src/styles.css ensure `.workflow-status-text` class is minimal: single line, body-small typography token, no wrapping, truncate with ellipsis if needed. |  |  |

### Implementation Phase S4 — Tests and quality gates

- GOAL-S04: Update tests to the new minimal prop contract and validate cleanup.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-S14 | Update apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx: replace all existing assertions with tests for the three-element model. Assert preload bar visibility per canonicalState, status text content per state, error line presence/absence, accessibility attributes. |  |  |
| TASK-S15 | Update apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx: assert Setup Panel does not render briefingError, briefingGuidance, required-files, optional-files, extraction-hint, artifactsReloadError paragraphs; assert DispatchError is still present. |  |  |
| TASK-S16 | Update apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx and ToolPageTemplate.extraction-cta.single-file.test.tsx for removed Setup Panel feedback. |  |  |
| TASK-S17 | Keep apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts and useToolPage.test.ts green with no orchestration changes. |  |  |
| TASK-S18 | Run targeted test gate: `npm --workspace apps/frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx src/features/tools/runtime/tool-page-selectors.test.ts src/features/tools/runtime/useToolPage.test.ts`. |  |  |
| TASK-S19 | Run frontend typecheck gate: `npm --workspace apps/frontend run typecheck`. |  |  |
| TASK-S20 | Run frontend build gate: `npm --workspace apps/frontend run build`. |  |  |
| TASK-S21 | Run static usage check to confirm old props are fully removed from all call sites: `rg -n "readinessReasonCodes\|briefingGuidance\|briefingError\|completedStepsCount\|totalStepsCount\|inputFilePayload\|workflowPanelFeedback" apps/frontend/src/features/tools`. Expected: zero matches. |  |  |

---

### ~~Implementation Phase 1~~ — *CANCELLED (superseded by Phase S1)*
### ~~Implementation Phase 2~~ — *CANCELLED (superseded by Phase S1)*
### ~~Implementation Phase 3~~ — *CANCELLED (superseded by Phase S2)*
### ~~Implementation Phase 4~~ — *CANCELLED (superseded by Phase S3)*
### ~~Implementation Phase 4b~~ — *CANCELLED (superseded by Phase S3/S4)*
### ~~Implementation Phase 5~~ — *CANCELLED (superseded by Phase S4)*
### ~~Implementation Phase 6~~ — *See section 6 below for updated doc tasks*

---

## 3. Alternatives

- ALT-001: Keep Requisiti checklist plus step list and add only minor copy tweaks. Rejected — keeps phase-exclusive payload visibility problem unresolved.
- ALT-002: Move all feedback including DispatchError into Workflow Panel. Rejected — violates DDD-061 / CON-002 ownership contract.
- ALT-003: Keep RHF per-field inline errors and duplicate them in Workflow Panel. Rejected — dual-channel ambiguity and message duplication.
- ALT-004: Implement determinate progress based on completed steps in monitoring. Rejected — backend process is opaque; step names add overhead without value.
- ALT-005 (v1.0 multi-section model): Payload checklist + feedback aggregation + indeterminate bar as separate sections. **Rejected as of 2026-05-23** — implemented result fragmented UX with too many labelled elements; violated simplification goal.

## 4. Dependencies

- DEP-001: Existing orchestration outputs from useToolPage in apps/frontend/src/features/tools/runtime/useToolPage.ts — provides canonicalState and error signals.
- DEP-002: Existing DispatchError ownership in apps/frontend/src/features/tools/runtime/useToolPageRunController.ts and ToolPageTemplate.
- DEP-003: DDD governance references in docs/07-governance/domain-naming-decision-log.md entries DDD-061, DDD-063.
- DEP-004: UX proposal baseline in docs/ux/tool-page-sidebar-unified-flow.md (sections §4.2, §6 — indeterminate bar rationale and form simplification).

## 5. Files

- FILE-S01: apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx — replace component contract and rendering with three-element model.
- FILE-S02: apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx — remove inline process messages, wire simplified props.
- FILE-S03: apps/frontend/src/styles.css — replace panel section CSS with minimal preload bar + status text classes.
- FILE-S04: apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx — update unit tests for simplified model.
- FILE-S05: apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx — update integration tests for message suppression.
- FILE-S06: apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx — update extraction CTA feedback assertions.
- FILE-S07: apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx — update single-file extraction assertions.
- FILE-S08: docs/02-design/specifications/tool-page-frontend-runtime-spec.md — post-implementation runtime spec alignment.
- FILE-S09: docs/02-design/specifications/frontend-tool-pages-architecture-spec.md — post-implementation architecture alignment.

## 6. Testing

- TEST-S01: ToolGenerationFlowVertical unit tests pass with three-element model: preload bar state per canonicalState, status text per state, error line presence/absence, accessibility attributes.
- TEST-S02: ToolPageTemplate integration tests pass: Setup Panel has no process-feedback paragraphs except DispatchError; ToolGenerationFlowVertical receives canonicalState + errorMessage only.
- TEST-S03: Extraction CTA tests pass for multi-file and single-file contexts with removed feedback paragraphs.
- TEST-S04: Existing runtime selector and useToolPage tests remain green (no orchestration regressions).
- TEST-S05: Frontend typecheck exits 0.
- TEST-S06: Frontend build exits 0.
- TEST-S07: Static grep confirms all obsolete props removed from production call sites (zero matches).

### Visual Acceptance Checklist (v2.0)

| ID | Checkpoint | Pass Criteria | Evidence Required | Status |
|----|------------|---------------|-------------------|--------|
| VAC-S01 | Preload bar visibility per state | Bar is hidden in draft-empty, pulsing in running/paused-with-checkpoint, full in completed. | DOM test assertions in ToolGenerationFlowVertical.test.tsx | pending |
| VAC-S02 | Status text per state | Status text matches mapped string for each canonicalState; hidden in draft-empty. | DOM test assertions in ToolGenerationFlowVertical.test.tsx | pending |
| VAC-S03 | Error line | errorMessage non-null → single line with role=alert; null → no element in DOM. | DOM test assertions in ToolGenerationFlowVertical.test.tsx | pending |
| VAC-S04 | Setup Panel clean | No briefingError, briefingGuidance, required-files, optional-files, extraction-hint, artifactsReloadError paragraphs in Setup Panel. DispatchError present. | Assertions in ToolPageTemplate.test.tsx | pending |
| VAC-S05 | No old props at call sites | Static grep TASK-S21 returns zero matches. | Terminal output of rg command | pending |
| VAC-S06 | Preload bar guard — prefilled-regenerate | Bar does not pulse for prefilled-regenerate (no active generation). | DOM test assertion in ToolGenerationFlowVertical.test.tsx | pending |

## 7. Risks & Assumptions

- RISK-S01: Removing visible file state feedback entirely may leave users uncertain whether their upload was accepted — mitigated by upload button state change (upload buttons already reflect file selection state natively).
- RISK-S02: Single errorMessage slot may lose granularity if both dispatchError and briefingError are simultaneously non-null — mitigated by explicit precedence rule (TASK-S10: dispatchError first).
- RISK-S03: Existing tests assert v1.0 prop names and message copy; broader test update required than a simple prop rename.
- ASSUMPTION-S01: canonicalState from useToolPage is sufficient to drive all Workflow Panel visual states without additional derived data.
- ASSUMPTION-S02: Upload button UI (existing behavior) provides enough local feedback for file selection without a payload checklist in the panel.



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
| Phase S1 (TASK-S01..TASK-S06) | Simplify component to three-element model | refactor-plan | ToolGenerationFlowVertical.tsx + SREQ-001..009 | Props interface diff + reduced render tree + a11y attributes confirmed |
| Phase S2 (TASK-S07..TASK-S10) | Strip Setup Panel messages, wire simplified props | refactor-plan | ToolPageTemplate.tsx + DDD-061 + CON-002 | Message removal diff + errorMessage precedence rule validated |
| Phase S3 (TASK-S11..TASK-S13) | Replace CSS with minimal preload bar classes | context-map | styles.css + design token list + SREQ-010 | CSS diff with dead-class removal + responsive check |
| Phase S4 (TASK-S14..TASK-S21) | Update tests and run quality gates | context-map | test files (FILE-S04..S07) + VAC-S01..S06 | Green test output + typecheck 0 + build 0 + grep evidence |

### Task-Level Skill Suggestions

| Task ID | Recommended Skill | Delegation Note |
|---------|-------------------|-----------------|
| TASK-S01 | refactor-plan | Use for safe contract migration and call-site impact mapping before editing. |
| TASK-S03 | context-map | Map all canonicalState branches before implementing bar state variants. |
| TASK-S10 | refactor-plan | Use to keep errorMessage precedence rule explicit and testable. |
| TASK-S14 | refactor-plan | Restructure tests entirely for new three-element model; do not patch old assertions. |

### Delegation Anti-Patterns

- Do not delegate mixed concerns in one batch (for example props change plus unrelated CSS cleanup).
- Do not accept delegated output without TEST and VAC gate evidence.
- Do not execute any TASK-001..TASK-036 (v1.0 cancelled tasks) regardless of prior plan references.

- Do not merge delegated patches that introduce non-canonical terminology.
- Do not skip final end-to-end run after integrating multiple delegated patches.
