---
goal: Apply DDD-081 Tool Input File Requirement Policy alignment across Frontend Tool Workspace runtime, UI, and tests
version: 1.0
date_created: 2026-05-22
last_updated: 2026-05-22
owner: Frontend Platform Team
status: Completed
tags: [refactor, frontend, ddd, policy-alignment, tools]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines deterministic implementation steps to remove code drift against DDD-081 by introducing a policy-driven model for tool input files in Frontend Tool Workspace flows. The target outcome is: first file always required, each file from index 1 onward explicitly classified as required or optional by tool setting, with runtime enforcement and tests.

## 1. Requirements & Constraints

- **REQ-001**: Implement DDD-081 semantics in frontend tool runtime: one-file tools keep file[0] always required; multi-file tools keep file[0] always required; file[1..N] must have explicit requiredness classification.
- **REQ-002**: Remove hardcoded angle-generator-only requiredness logic from UI rendering and machine guards; replace with policy-driven behavior from a single registry source.
- **REQ-003**: Preserve backward-compatible behavior for currently supported tools (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`) during migration.
- **REQ-004**: Keep existing extraction-field governance unchanged (`InstructionRequiredExtractionFieldKeysByTool`, `ReadinessRequiredExtractionFieldKeysByTool`).
- **REQ-005**: Readiness UX behavior must be deterministic and user-centered for optional files: if all required files are present, `ReadinessSnapshot` is ready even when optional files are missing.
- **REQ-006**: When optional files are missing and readiness is already satisfied, UI must show a non-blocking recommendation message that suggests optional upload and explains expected value.
- **REQ-007**: When a tool configuration marks all files as required (first file `always-required` + remaining files `required-by-tool-setting`), readiness remains blocked until all required files are uploaded.
- **REQ-008**: Primary CTA behavior must be coherent with readiness policy: enabled only when required-file set is complete; optional-file absence never blocks CTA.
- **REQ-009**: Documentation must be updated in the same refactor cycle for all tool-flow and UX-readiness specs impacted by DDD-081 runtime changes.
- **SEC-001**: Preserve current file-extension validation controls in upload guards (`.docx`, `.txt`, `.md`) and do not weaken existing checks.
- **DDD-001**: Use canonical terms from DDD references only: `BriefingFile`, `AngleDetectorFile`, `ToolInputFileRequirementPolicy`, `SupportedTool`, `ToolKey`.
- **CON-001**: Do not change backend contracts in this plan; scope is frontend code alignment only.
- **CON-002**: Avoid regressions in current angle-generator dual-file upload flow and extraction dispatch behavior.
- **GUD-001**: Keep changes atomic per concern (registry model, selector/UI mapping, machine/client enforcement, tests).
- **PAT-001**: Single-source policy pattern: one canonical frontend registry for file requiredness consumed by UI selectors, form validation, machine guards, and client preconditions.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Introduce canonical policy model for tool input files and migrate registry data to deterministic per-file classification.
- Completion Criteria:
- CC-001.1: `toolFileInstructionsRegistry` includes `inputFiles` for every `SupportedTool`.
- CC-001.2: Runtime invariant check fails fast when `inputFiles[0]` is missing or not `always-required`.
- CC-001.3: No Phase 2+ file reads `requiredFiles` as primary source.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add a new typed model in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`: `ToolInputFilePolicyEntry` with fields `{ key, label, accept, requiredness }`, where `requiredness` is `'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting'`. | yes | 2026-05-22 |
| TASK-002 | Extend `ToolFileInstructionsConfig` in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` to include `inputFiles: readonly ToolInputFilePolicyEntry[]` and mark `requiredFiles` as transitional/deprecated field for one cycle. | yes | 2026-05-22 |
| TASK-003 | Migrate all entries in `toolFileInstructionsRegistry` in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` to include `inputFiles` and enforce deterministic indexing: file[0] always `always-required`; file[1..N] explicitly classified. | yes | 2026-05-22 |
| TASK-004 | For `angle-generator` in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`, map `BriefingFile` as `always-required` and `AngleDetectorFile` as `optional-by-tool-setting`; keep existing labels and accepted extensions. | yes | 2026-05-22 |
| TASK-005 | Add a local invariant helper in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` validating each tool config: first file exists and is `always-required`; no undefined requiredness on subsequent files. | yes | 2026-05-22 |

### Implementation Phase 2

- GOAL-002: Make selectors and setup UI policy-driven for file guidance and upload rendering.
- Completion Criteria:
- CC-002.1: Setup UI renders policy groups derived from selector output without tool-name hardcoding.
- CC-002.2: Form validation blocks submit when any configured required file is missing.
- CC-002.3: Existing single-file tool UX remains unchanged in visible behavior.
- CC-002.4: Missing optional files produce advisory UX (`non-blocking`) while readiness remains true.
- CC-002.5: In all-required configurations, readiness remains false until all required files are present.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Update `selectToolFileInstructions` in `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` to project `inputFiles` into explicit display groups: `alwaysRequiredFiles`, `requiredBySettingFiles`, `optionalBySettingFiles`. | yes | 2026-05-22 |
| TASK-007 | Update `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx` to render file policy groups before required extraction fields, showing deterministic headings for each group. | yes | 2026-05-22 |
| TASK-008 | Update `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx` to assert file-group rendering and remove expectation that `File richiesti` is always absent. | yes | 2026-05-22 |
| TASK-009 | Replace hardcoded angle-generator branch in `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` (`props.toolKey === 'angle-generator'`) with dynamic rendering from `inputFiles` selector output. | yes | 2026-05-22 |
| TASK-010 | In `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`, replace generic optional zod file fields with policy-driven validation (file[0] required always, file[1..N] required by policy only). | yes | 2026-05-22 |
| TASK-021 | In `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`, expose deterministic file-completion derivations: `requiredFilesComplete`, `missingRequiredFiles`, `missingOptionalFiles`. | yes | 2026-05-22 |
| TASK-022 | In `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`, add advisory component copy for missing optional files (non-blocking) and blocking copy for missing required files, both derived from selector outputs only. | yes | 2026-05-22 |
| TASK-023 | In `apps/frontend/src/features/tools/machines/tool-page.machine.ts` readiness derivation, ensure required-file completeness gates readiness while optional-file completeness never gates readiness. | yes | 2026-05-22 |

### Implementation Phase 3

- GOAL-003: Refactor machine and client enforcement to consume the same policy source; remove tool-specific requiredness branches.
- Completion Criteria:
- CC-003.1: No branch in machine/client checks `toolKey === 'angle-generator'` for file requiredness decisions.
- CC-003.2: Machine and client resolve required secondary files from policy entries only.
- CC-003.3: Angle-generator request payload remains backward-compatible with current backend expectations.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Introduce policy-aware file map in `apps/frontend/src/features/tools/machines/tool-page.types.ts` events, replacing source union `'briefing' | 'angle-detector'` with generic file slot key(s) derived from tool config. | yes | 2026-05-22 |
| TASK-012 | Update event dispatch in `apps/frontend/src/features/tools/runtime/useToolPage.ts` to send policy slot identifiers instead of angle-specific source constants. | yes | 2026-05-22 |
| TASK-013 | Refactor `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` guards (`isAngleDetectorSelection`, `canUploadBriefing`, angle-generator missing file branch) to evaluate requiredness from tool input-file policy entries, not from `toolKey === 'angle-generator'` checks. | yes | 2026-05-22 |
| TASK-014 | Refactor `uploadBrief` precondition in `apps/frontend/src/features/tools/runtime/tools-client.ts` to validate required secondary files via policy model; remove hardcoded `Angle Detector file required for angle-generator` branch and replace with policy-derived error message template. | yes | 2026-05-22 |
| TASK-015 | Preserve current payload shape compatibility for angle-generator in `apps/frontend/src/features/tools/runtime/tools-client.ts` while enabling future multi-file tools through internal mapping layer. | yes | 2026-05-22 |

### Implementation Phase 4

- GOAL-004: Add deterministic regression tests for DDD-081 semantics and complete migration cleanup.
- Completion Criteria:
- CC-004.1: All tests listed in Section 6 pass on CI-equivalent frontend environment.
- CC-004.2: Deprecated `requiredFiles` has no runtime readers.
- CC-004.3: Typecheck and build gates pass with no new warnings/errors.
- CC-004.4: UX readiness tests cover both policy scenarios: `required complete + optional missing => ready` and `all required not complete => not ready`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Add parameterized selector tests in `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` verifying three policy scenarios: one-file-only, two-file with second required, two-file with second optional. | yes | 2026-05-22 |
| TASK-017 | Add machine tests in `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` validating policy-driven requiredness without tool-name conditionals. | yes | 2026-05-22 |
| TASK-018 | Add client tests in `apps/frontend/src/features/tools/runtime/tools-client.test.ts` validating policy-driven required-secondary-file preconditions and message outputs. | yes | 2026-05-22 |
| TASK-019 | Update `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` and `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` for dynamic file-slot rendering and submission behavior. | yes | 2026-05-22 |
| TASK-020 | Remove transitional deprecated `requiredFiles` readers after all consumers migrated; if unresolved readers remain, this plan is not complete and status must stay `In progress`. | yes | 2026-05-22 |
| TASK-024 | Add UX readiness matrix tests in `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` covering: (A) optional missing but ready, (B) all-required and one missing -> blocked, (C) all required present -> ready. | yes | 2026-05-22 |

### Implementation Phase 5

- GOAL-005: Update system documentation impacted by the refactor to keep tool-flow and readiness UX behavior aligned with as-is implementation.
- Completion Criteria:
- CC-005.1: All documentation candidates in this phase are reviewed and updated when impacted.
- CC-005.2: Runtime behavior for optional-vs-required file readiness is documented consistently across architecture, runtime, and UX specs.
- CC-005.3: `docs/index-overview.md` section map remains accurate after documentation edits.
- CC-005.4: Documentation quality gates pass (`link-check`, `orphan-check`, `owner-check`, `review-expiry-check`).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Update `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` with policy-driven input-file model (`inputFiles`), readiness behavior for optional files, and all-required blocking behavior. | yes | 2026-05-22 |
| TASK-026 | Update `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` with deterministic selector/machine behavior (`requiredFilesComplete`, `missingRequiredFiles`, `missingOptionalFiles`) and CTA enablement semantics. | yes | 2026-05-22 |
| TASK-027 | Update `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` with end-to-end flow outcomes for the two UX scenarios: optional-missing non-blocking and all-required blocking. | yes | 2026-05-22 |
| TASK-028 | Update `docs/02-design/tool-generation-flow.md` to reflect user-visible readiness transitions and advisory messaging points in the flow narrative. | yes | 2026-05-22 |
| TASK-029 | Update `docs/02-design/tool-generation-flow-generation-context.md` with frontend-to-generation boundary behavior for required/optional documents under DDD-081. | yes | 2026-05-22 |
| TASK-030 | Update `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` to include canonical non-blocking advisory behavior for optional files and blocking semantics for required files. | yes | 2026-05-22 |
| TASK-031 | Update `docs/02-design/specifications/frontend-spec.md` with the final UX copy-state matrix and accessibility requirements (`aria-live`, status severity, placement). | yes | 2026-05-22 |
| TASK-032 | Update `docs/99-reference/templates/tool-development-plan-template.md` to include mandatory DDD-081 readiness semantics (optional non-blocking advisory vs all-required blocking) and deterministic UX copy-state guidance for future tool replication plans. | yes | 2026-05-22 |
| TASK-033 | Refresh `docs/index-overview.md` links/status metadata for all docs updated in TASK-025..TASK-032 and validate no orphaned edited docs remain. | yes | 2026-05-22 |
| TASK-034 | Governance checkpoint: if new domain terms are introduced during doc updates, register decision first in `docs/07-governance/domain-naming-decision-log.md`; otherwise record no-new-term confirmation in phase notes. | yes | 2026-05-22 |

### Execution Order And Dependencies

- DEP-EXEC-001: Phase 1 must complete before Phase 2 starts.
- DEP-EXEC-002: Phase 2 must complete before Phase 3 starts.
- DEP-EXEC-003: Phase 3 must complete before Phase 4 starts.
- DEP-EXEC-004: `TASK-001` -> `TASK-002` -> `TASK-003` -> `TASK-005`.
- DEP-EXEC-005: `TASK-006` depends on `TASK-003`; `TASK-007` depends on `TASK-006`; `TASK-009` and `TASK-010` depend on `TASK-006`.
- DEP-EXEC-006: `TASK-021` depends on `TASK-006`; `TASK-022` depends on `TASK-021`; `TASK-023` depends on `TASK-021`.
- DEP-EXEC-007: `TASK-011` depends on `TASK-003`; `TASK-012` depends on `TASK-011`; `TASK-013` and `TASK-014` depend on `TASK-012`; `TASK-015` depends on `TASK-014`.
- DEP-EXEC-008: `TASK-016..TASK-019` depend on completion of corresponding implementation tasks in Phases 2-3; `TASK-024` depends on `TASK-023`; `TASK-020` is final gate before status change to `Completed`.
- DEP-EXEC-009: Phase 5 starts only after Phase 4 completion criteria are met.
- DEP-EXEC-010: `TASK-025..TASK-032` depend on finalized runtime behavior from TASK-021..TASK-024.
- DEP-EXEC-011: `TASK-033` depends on `TASK-025..TASK-032`; `TASK-034` runs before plan status can transition to `Completed`.

## 3. Alternatives

- **ALT-001**: Keep hardcoded angle-generator branches and document exception only. Rejected because it violates DDD-081 deterministic generalization for all multi-file tools.
- **ALT-002**: Enforce requiredness only in machine/client and keep UI static. Rejected because UI would remain semantically drifted from policy and confuse setup behavior.
- **ALT-003**: Move policy to backend immediately. Rejected for this iteration because scope is frontend alignment with minimal contract changes.

## 4. Dependencies

- **DEP-001**: Existing frontend tool configuration registry in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`.
- **DEP-002**: Existing selector pipeline in `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`.
- **DEP-003**: Existing upload orchestration machine in `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`.
- **DEP-004**: Existing upload/extraction client in `apps/frontend/src/features/tools/runtime/tools-client.ts`.
- **DEP-005**: Existing DDD policy documents (`DDD-081`, glossary, BCM, frontend UI UL specs).
- **DEP-006**: Documentation governance constraints for docs under `docs/` (frontmatter completeness, index consistency, quality gates).

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` — add canonical input-file policy model and registry migration.
- **FILE-002**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` — project policy groups for UI and validation.
- **FILE-003**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx` — render file policy groups.
- **FILE-004**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — dynamic file upload fields and policy-based form validation.
- **FILE-005**: `apps/frontend/src/features/tools/machines/tool-page.types.ts` — policy-driven file selection event model.
- **FILE-006**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` — dispatch policy slot file events.
- **FILE-007**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` — policy-driven upload guards.
- **FILE-008**: `apps/frontend/src/features/tools/runtime/tools-client.ts` — policy-driven preconditions with backward-compatible payload mapping.
- **FILE-009**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` — selector policy tests.
- **FILE-010**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx` — UI file-group tests.
- **FILE-011**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` — machine policy tests.
- **FILE-012**: `apps/frontend/src/features/tools/runtime/tools-client.test.ts` — client policy tests.
- **FILE-013**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` — template dynamic file-slot tests.
- **FILE-014**: `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` — event dispatch tests with generic file slots.
- **FILE-015**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — readiness derivation update for required/optional file completeness behavior.
- **FILE-016**: `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` — readiness UX matrix tests.
- **FILE-017**: `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` — architecture alignment for DDD-081 runtime-ready model.
- **FILE-018**: `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` — runtime derivation and readiness semantics.
- **FILE-019**: `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` — source-of-truth flow updates for readiness scenarios.
- **FILE-020**: `docs/02-design/tool-generation-flow.md` — user-facing flow narrative updates.
- **FILE-021**: `docs/02-design/tool-generation-flow-generation-context.md` — frontend-generation boundary behavior updates.
- **FILE-022**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — canonical UX semantics for optional/required file states.
- **FILE-023**: `docs/02-design/specifications/frontend-spec.md` — UX copy-state matrix and accessibility behavior.
- **FILE-024**: `docs/99-reference/templates/tool-development-plan-template.md` — template alignment for coherent tool replication under DDD-081 readiness semantics.
- **FILE-025**: `docs/index-overview.md` — section map/status refresh after documentation updates.
- **FILE-026**: `docs/07-governance/domain-naming-decision-log.md` — conditional update only if new canonical terms are required.

## 6. Testing

- **TEST-001**: Run selector unit tests: `npm --workspace apps/frontend run test -- src/features/tools/runtime/tool-page-selectors.test.ts`.
- **TEST-002**: Run UI instruction tests: `npm --workspace apps/frontend run test -- src/features/tools/ui/ToolFileInstructionsSection.test.tsx`.
- **TEST-003**: Run machine tests: `npm --workspace apps/frontend run test -- src/features/tools/machines/briefing-upload.machine.test.ts`.
- **TEST-004**: Run client tests: `npm --workspace apps/frontend run test -- src/features/tools/runtime/tools-client.test.ts`.
- **TEST-005**: Run integration-focused tool page tests: `npm --workspace apps/frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx`.
- **TEST-006**: Run hook tests: `npm --workspace apps/frontend run test -- src/features/tools/runtime/useToolPage.test.ts`.
- **TEST-007**: Run frontend typecheck gate: `npm --workspace apps/frontend run typecheck`.
- **TEST-008**: Run frontend build gate: `npm --workspace apps/frontend run build`.
- **TEST-009**: Run readiness machine matrix tests: `npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts`.
- **TEST-010**: Run deterministic UX subset gate in one command: `npm --workspace apps/frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/machines/tool-page.machine.test.ts src/features/tools/runtime/tool-page-selectors.test.ts`.
- **TEST-011**: Run deterministic docs link-check command:
	`rg -n "\]\((\.{1,2}/)+[^)#]+\.md(#[^)]+)?\)" docs/02-design docs/99-reference/templates/tool-development-plan-template.md docs/index-overview.md`.
	Pass criteria: command returns only links that resolve to existing files under the workspace root after path normalization; fail on at least one unresolved target.
- **TEST-012**: Run deterministic orphan-check command:
	`for f in docs/02-design/specifications/frontend-tool-pages-architecture-spec.md docs/02-design/specifications/tool-page-frontend-runtime-spec.md docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md docs/02-design/tool-generation-flow.md docs/02-design/tool-generation-flow-generation-context.md docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md docs/02-design/specifications/frontend-spec.md docs/99-reference/templates/tool-development-plan-template.md; do rg -n --fixed-strings "$f" docs/index-overview.md || exit 1; done`.
	Pass criteria: every listed file has at least one reference in `docs/index-overview.md`; fail if any file is missing.
- **TEST-013**: Run deterministic frontmatter key-check command:
	`for f in docs/02-design/specifications/frontend-tool-pages-architecture-spec.md docs/02-design/specifications/tool-page-frontend-runtime-spec.md docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md docs/02-design/tool-generation-flow.md docs/02-design/tool-generation-flow-generation-context.md docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md docs/02-design/specifications/frontend-spec.md docs/99-reference/templates/tool-development-plan-template.md docs/index-overview.md; do head -n 40 "$f" | rg -n "^(status|version|last-reviewed|next-review-date|owner):"; done`.
	Pass criteria: each listed file includes all required governance keys in frontmatter; fail if one or more keys are missing.
- **TEST-014**: Run deterministic owner-check command:
	`for f in docs/02-design/specifications/frontend-tool-pages-architecture-spec.md docs/02-design/specifications/tool-page-frontend-runtime-spec.md docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md docs/02-design/tool-generation-flow.md docs/02-design/tool-generation-flow-generation-context.md docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md docs/02-design/specifications/frontend-spec.md docs/99-reference/templates/tool-development-plan-template.md docs/index-overview.md; do head -n 40 "$f" | rg -n '^owner:\s+.+$' || exit 1; done`.
	Pass criteria: every listed file contains non-empty `owner` frontmatter value; fail on empty or missing owner.
- **TEST-015**: Run deterministic review-expiry-check command:
	`for f in docs/02-design/specifications/frontend-tool-pages-architecture-spec.md docs/02-design/specifications/tool-page-frontend-runtime-spec.md docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md docs/02-design/tool-generation-flow.md docs/02-design/tool-generation-flow-generation-context.md docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md docs/02-design/specifications/frontend-spec.md docs/99-reference/templates/tool-development-plan-template.md docs/index-overview.md; do lr=$(head -n 40 "$f" | sed -n 's/^last-reviewed:\s*//p'); nr=$(head -n 40 "$f" | sed -n 's/^next-review-date:\s*//p'); [[ -n "$lr" && -n "$nr" ]] || exit 1; [[ "$lr" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$nr" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || exit 1; [[ "$lr" < "$nr" ]] || exit 1; done`.
	Pass criteria: each listed file has valid ISO dates and `last-reviewed < next-review-date`; fail otherwise.

## 7. Risks & Assumptions

- **RISK-001**: Event model migration from angle-specific source tags to generic file slots may break existing tests and machine wiring.
- **RISK-002**: Dynamic rendering of file fields may cause regressions in form-state synchronization and reset behavior.
- **RISK-003**: Backward compatibility in upload payload mapping for current backend endpoints may be broken if slot mapping is not carefully constrained.
- **RISK-004**: Advisory UX copy for optional files may be interpreted as blocking if visual hierarchy is unclear (tone, color, placement).
- **ASSUMPTION-001**: Backend upload endpoint remains backward-compatible with current angle-generator payload shape during this frontend refactor.
- **ASSUMPTION-002**: Supported tools remain the current four during implementation (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`).
- **ASSUMPTION-003**: DDD-081 semantics are authoritative and no conflicting policy supersedes it during execution window.

## 8. UX Flow Solutions (User-Centered)

### 8.1 Personas And Context Assumptions

- UX-ASSUME-001: Primary users are content operators working on desktop with moderate tool familiarity.
- UX-ASSUME-002: Main JTBD is to start generation quickly without confusion on mandatory vs optional uploads.
- UX-ASSUME-003: Failure cost is medium-high (time loss + incorrect output quality), so guidance must be clear and immediate.

### 8.2 Flow A: Optional Documents Missing (Readiness Must Be True)

- UX-FLOW-A-001: When all required files are complete, readiness becomes true and primary CTA is enabled.
- UX-FLOW-A-002: Missing optional files are shown in an advisory panel near the CTA with explicit non-blocking language (`Optional but recommended`).
- UX-FLOW-A-003: Advisory includes expected benefit statement per file (for example better specificity, better angle quality).
- UX-FLOW-A-004: User can continue immediately; no modal confirmation required.
- UX-FLOW-A-005: Advisory panel disappears automatically when optional file is uploaded.

### 8.3 Flow B: All Files Required (Readiness Must Be False Until Complete)

- UX-FLOW-B-001: Readiness remains false while at least one required file is missing.
- UX-FLOW-B-002: Primary CTA remains disabled and blocking reason lists exactly which required files are missing.
- UX-FLOW-B-003: Required missing list must be stable and ordered by file index to avoid visual jumpiness.
- UX-FLOW-B-004: On completion of last missing required file, readiness transitions immediately to true and CTA enables without page refresh.

### 8.4 Interaction And Copy Rules

- UX-RULE-001: Never use warning/error styling for optional-missing advisory; use neutral/informational styling.
- UX-RULE-002: Blocking messages must use direct action language (`Upload required file to continue`).
- UX-RULE-003: Optional advisory must include dismiss-free persistent visibility until upload or step change.
- UX-RULE-004: Keyboard and screen reader users must receive the same readiness state and advisory context via semantic status text.

### 8.5 Acceptance Metrics

- UX-METRIC-001: In optional-missing scenario, user can trigger generation in <= 1 click after required files complete.
- UX-METRIC-002: In all-required scenario, disabled CTA reason matches missing-required list exactly (100% deterministic match in tests).
- UX-METRIC-003: No false-negative readiness states when only optional files are missing.

### 8.6 UX Copy Table (Development Ready)

| State ID | Trigger Condition | Message | Severity | aria-live | Position |
|------|-------------|-----------|------|------|------|
| UX-COPY-001 | Required files complete AND one or more optional files missing | You can start now. Optional documents are recommended to improve output quality. | info | polite | Setup panel, directly above primary CTA |
| UX-COPY-002 | Required files complete AND no optional files missing | Ready to generate. All configured documents are uploaded. | success | polite | Setup panel, directly above primary CTA |
| UX-COPY-003 | One or more required files missing | Upload required documents to continue. Missing: {missingRequiredFilesOrdered}. | warning | assertive | Setup panel, directly above primary CTA |
| UX-COPY-004 | File uploaded successfully (required or optional) | File uploaded: {fileLabel}. | success | polite | Inline, under the corresponding upload field |
| UX-COPY-005 | Optional file not uploaded after readiness reached | Optional document not uploaded yet. You can continue now or upload it for better results. | info | polite | Inline advisory under optional file field |
| UX-COPY-006 | Invalid file extension on upload | Unsupported file type. Allowed formats: .docx, .txt, .md. | error | assertive | Inline error under affected upload field |
| UX-COPY-007 | Upload in progress | Uploading document... | info | polite | Inline, under affected upload field |
| UX-COPY-008 | All-required scenario transitioned to ready | All required documents are uploaded. You can start generation. | success | polite | Setup panel, directly above primary CTA |

Implementation notes for deterministic usage:
- Use `UX-COPY-003` as the single blocking readiness message source.
- Build `{missingRequiredFilesOrdered}` from selector output sorted by input-file index.
- Never render `UX-COPY-001` and `UX-COPY-003` together in the same frame.
- When readiness is true and optional files are missing, render `UX-COPY-001` at panel level and `UX-COPY-005` inline per missing optional field.

## 9. Deterministic Validation Commands

### 9.1 Canonical Docs Validation Scope (Phase 5)

- VAL-SCOPE-001: The canonical file set for `TEST-011..TEST-015` is:
	- `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md`
	- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
	- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
	- `docs/02-design/tool-generation-flow.md`
	- `docs/02-design/tool-generation-flow-generation-context.md`
	- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
	- `docs/02-design/specifications/frontend-spec.md`
	- `docs/99-reference/templates/tool-development-plan-template.md`
	- `docs/index-overview.md`
- VAL-SCOPE-002: Any file added to TASK-025..TASK-033 scope during execution must be appended to this list before running `GATE-P5`.

## 10. Deterministic Execution Instructions

### 10.1 Execution Protocol

- EXEC-001: Implement tasks strictly in dependency order from Section 2 (`DEP-EXEC-*`).
- EXEC-002: After each completed task, run only its nearest verification subset before moving forward.
- EXEC-003: If a verification fails, stop progression, fix failure, rerun subset, then continue.
- EXEC-004: Do not start Phase N+1 until all completion criteria of Phase N are true.

### 10.1.1 Task-To-Validation Subset Map

- MAP-001: `TASK-001` -> none (design-only type addition).
- MAP-002: `TASK-002` -> `TEST-007`.
- MAP-003: `TASK-003` -> `TEST-001`, `TEST-007`.
- MAP-004: `TASK-004` -> `TEST-001`.
- MAP-005: `TASK-005` -> `TEST-001`, `TEST-007` (must satisfy `GATE-P1`).
- MAP-006: `TASK-006` -> `TEST-001`.
- MAP-007: `TASK-007` -> `TEST-002`.
- MAP-008: `TASK-008` -> `TEST-002`.
- MAP-009: `TASK-009` -> `TEST-005`.
- MAP-010: `TASK-010` -> `TEST-005`, `TEST-010`.
- MAP-011: `TASK-021` -> `TEST-001`, `TEST-010`.
- MAP-012: `TASK-022` -> `TEST-005`, `TEST-010`.
- MAP-013: `TASK-023` -> `TEST-009`, `TEST-010` (must satisfy `GATE-P2`).
- MAP-014: `TASK-011` -> `TEST-006`.
- MAP-015: `TASK-012` -> `TEST-006`.
- MAP-016: `TASK-013` -> `TEST-003`.
- MAP-017: `TASK-014` -> `TEST-004`.
- MAP-018: `TASK-015` -> `TEST-003`, `TEST-004`, `TEST-006` (must satisfy `GATE-P3`).
- MAP-019: `TASK-016` -> `TEST-001`.
- MAP-020: `TASK-017` -> `TEST-003`.
- MAP-021: `TASK-018` -> `TEST-004`.
- MAP-022: `TASK-019` -> `TEST-005`, `TEST-006`.
- MAP-023: `TASK-024` -> `TEST-009`, `TEST-010`.
- MAP-024: `TASK-020` -> `TEST-001..TEST-010`, `TEST-008` (must satisfy `GATE-P4`).
- MAP-025: `TASK-025` -> `TEST-011`, `TEST-013`.
- MAP-026: `TASK-026` -> `TEST-011`, `TEST-013`.
- MAP-027: `TASK-027` -> `TEST-011`, `TEST-013`.
- MAP-028: `TASK-028` -> `TEST-011`, `TEST-013`.
- MAP-029: `TASK-029` -> `TEST-011`, `TEST-013`.
- MAP-030: `TASK-030` -> `TEST-011`, `TEST-013`.
- MAP-031: `TASK-031` -> `TEST-011`, `TEST-013`.
- MAP-032: `TASK-032` -> `TEST-011`, `TEST-013`.
- MAP-033: `TASK-033` -> `TEST-011`, `TEST-012`, `TEST-013`, `TEST-014`, `TEST-015`.
- MAP-034: `TASK-034` -> `TEST-013`, `TEST-014`, `TEST-015` and execution note update in Section 13 (must satisfy `GATE-P5`).

### 10.2 Deterministic Validation Gates By Phase

- GATE-P1: Run `TEST-001`, `TEST-007` after TASK-005.
- GATE-P2: Run `TEST-002`, `TEST-005`, `TEST-010` after TASK-023.
- GATE-P3: Run `TEST-003`, `TEST-004`, `TEST-006` after TASK-015.
- GATE-P4: Run `TEST-001..TEST-010` plus `TEST-008` as final release gate.
- GATE-P5: Run `TEST-011`, `TEST-012`, `TEST-013`, `TEST-014`, `TEST-015` after TASK-034; block closure if any docs governance gate fails.

### 10.3 Stop/Go Rules

- STOP-001: If required/optional readiness semantics fail in `tool-page.machine.test.ts`, block merge.
- STOP-002: If any runtime reader still depends on deprecated `requiredFiles`, block status transition to `Completed`.
- STOP-003: If UX advisory appears as blocking (role/variant mismatch), block merge until corrected.

### 10.4 Deterministic Rollback Unit

- RB-001: Revert only the last task-level change set that introduced gate failure.
- RB-002: Re-run nearest gate and document failure cause under corresponding `TASK-*` row before retry.

## 13. Execution Notes (Canonical Location)

Use this section as the single authoritative execution log required by `TASK-034`.

### 13.1 Entry Format

- EN-001: Each note must use this format: `[YYYY-MM-DD] [owner] [task-id] [result] [details]`.
- EN-002: `result` allowed values: `completed`, `failed`, `no-structural-change`, `blocked`.
- EN-003: For governance outcome at `TASK-034`, include one deterministic line:
	- `new-term-added: DDD-NNN` when a new term is introduced.
	- `new-term-added: none` when no canonical term changes occurred.

### 13.2 Initial Placeholder

- [2026-05-22] [Frontend Platform Team] [TASK-034] [completed] [new-term-added: none]
- [2026-05-22] [Frontend Platform Team] [TASK-004] [completed] [angle-generator file[1] classified as optional-by-tool-setting]
- [2026-05-22] [Frontend Platform Team] [TASK-016] [completed] [selector matrix updated for optional second file scenario]
- [2026-05-22] [Frontend Platform Team] [TASK-017] [completed] [briefing upload machine tests aligned with non-blocking optional file]
- [2026-05-22] [Frontend Platform Team] [TASK-018] [completed] [tools client tests aligned with optional secondary file precondition]
- [2026-05-22] [Frontend Platform Team] [TASK-020] [blocked] [final closure pending full TEST-001..TEST-010 + TEST-008 rerun after latest optional-file update]
- [2026-05-22] [Frontend Platform Team] [TASK-020] [completed] [GATE-P4 passed: TEST-001..TEST-010 + TEST-008 rerun after model-input test alignment]

## 11. Per-File Delta Checklist (TASK-025..TASK-034)

Use this checklist as the minimum editable content set for each candidate document. If a row is fully satisfied, the corresponding TASK can be marked completed without additional interpretation.

| Task | Target File | Minimum Delta Content To Apply | Deterministic Completion Check |
|------|-------------|-----------|------|
| TASK-025 | `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` | Add or update the section describing `ToolInputFileRequirementPolicy` runtime model with `inputFiles` structure and requiredness taxonomy (`always-required`, `required-by-tool-setting`, `optional-by-tool-setting`). Add explicit rule: first file always required; files from second onward classified by tool setting. | File contains one canonical subsection with the three requiredness values and both readiness scenarios (optional missing non-blocking; all-required blocking). |
| TASK-026 | `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` | Add selector/runtime contract for `requiredFilesComplete`, `missingRequiredFiles`, `missingOptionalFiles`. Document CTA enablement invariant: CTA enabled iff `missingRequiredFiles` is empty. | Runtime spec includes all three derivations and a truth table for CTA enabled/disabled outcomes. |
| TASK-027 | `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` | Add end-to-end flow branches for: A) required complete + optional missing => ready + advisory; B) required missing => not ready + blocking reason list. | Source-of-truth flow includes exactly two branch outcomes with deterministic transition conditions. |
| TASK-028 | `docs/02-design/tool-generation-flow.md` | Update narrative flow steps to include user-facing advisory touchpoint for optional missing files and blocking gate for required missing files. | Flow narrative explicitly names where advisory appears and where blocking state is resolved. |
| TASK-029 | `docs/02-design/tool-generation-flow-generation-context.md` | Add FE->Generation boundary note: optional missing files do not block dispatch when required set is complete; required missing files prevent dispatch. Clarify no backend contract changes. | Generation-context doc includes boundary rule pair (dispatch allowed vs blocked) and states FE-only scope for this refactor. |
| TASK-030 | `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` | Extend canonical UI vocabulary/behavior with non-blocking optional advisory and blocking required-missing semantics, aligned with `ReadinessSnapshot` and `PrimaryActionPolicy`. | UI UL spec contains canonical terms for both states and forbids treating optional advisory as blocking feedback. |
| TASK-031 | `docs/02-design/specifications/frontend-spec.md` | Add UX copy-state matrix aligned to section 8.6 of this plan: status id, trigger, message, severity, `aria-live`, placement. | Frontend spec includes a table with all six columns and mappings consistent with UX-COPY-001..UX-COPY-008. |
| TASK-032 | `docs/99-reference/templates/tool-development-plan-template.md` | Add a mandatory checklist block for DDD-081 readiness replication: required-file gating, optional-file advisory non-blocking behavior, UX copy-state matrix alignment, and deterministic validation gate references for future tool plans. | Template contains an explicit subsection that future plans can copy verbatim and includes both readiness scenarios plus verification hooks. |
| TASK-033 | `docs/index-overview.md` | Refresh section map entries and status metadata for every updated document from TASK-025..TASK-032; verify discoverability from root index. | Every updated doc is linked from index-overview (directly or via section index) and no updated doc is orphaned. |
| TASK-034 | `docs/07-governance/domain-naming-decision-log.md` (conditional) | If new canonical term is introduced while executing TASK-025..TASK-032, add a new DDD decision entry first. If no new term is introduced, append phase note in this plan confirming no-term-change outcome. | Either: a new DDD entry exists with rationale/scope; or explicit no-new-term note is recorded in execution notes with date and owner. |

Execution note for implementers:
- Do not broaden scope beyond the listed minimum deltas during TASK-025..TASK-034 unless required by a failed docs quality gate.
- If a target file already contains equivalent content, update only wording needed for DDD-081 consistency and mark task as completed with `no-structural-change` note.

## 12. Related Specifications / Further Reading

- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md)
- [docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
- [docs/02-design/specifications/frontend-tool-pages-architecture-spec.md](../docs/02-design/specifications/frontend-tool-pages-architecture-spec.md)
- [docs/99-reference/templates/tool-development-plan-template.md](../docs/99-reference/templates/tool-development-plan-template.md)
