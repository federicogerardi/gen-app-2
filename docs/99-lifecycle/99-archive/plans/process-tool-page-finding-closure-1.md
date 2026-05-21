---
goal: Close High ToolPage orchestration concentration finding with deterministic decomposition and behavior-preserving verification
version: 1.0
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Architecture Review
status: 'Completed'
tags: [process, refactor, frontend, architecture, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan defines deterministic phases to close the High architecture finding on ToolPage orchestration concentration in the frontend. The scope is centered on the ToolPage machine and specifically addresses concentration of ReadinessSnapshot policy, HydrationResult projection, and ToolPageViewModel UI policy in one mutation surface.

## 1. Requirements & Constraints

- REQ-001: Keep external ToolPage behavior unchanged for start, resume, regenerate, reset, hydrate, and progress synchronization flows.
- REQ-002: Decompose ToolPage orchestration so that readiness policy, hydration projection, and UI policy are implemented in dedicated modules with explicit ownership.
- REQ-003: Preserve canonical domain terms and semantics for ToolPage, ReadinessSnapshot, ReadinessReasonCode, HydrationResult, ToolPageViewModel, PrimaryActionPolicy, and SecondaryActionFlags.
- REQ-004: Preserve deterministic event handling for PROGRESS_SYNCED and HYDRATE_REQUESTED transitions.
- REQ-005: Produce closure evidence with before and after LOC metrics and regression test results.
- SEC-001: Do not expose extraction payload content or sensitive hydration details in production logs.
- DDD-001: Apply DDD-029 and related decisions by reusing canonical terms with no local synonyms.
- DDD-002: Keep ToolPage as Frontend/UI aggregate root while moving computation helpers to isolated modules.
- CON-001: Scope is limited to frontend ToolPage orchestration area anchored in apps/frontend/src/features/tools/machines/tool-page.machine.ts.
- CON-002: No route path, API contract, or backend runtime change is allowed in this plan.
- CON-003: Refactor must remain frontend-only and compile under existing workspace build and test commands.
- GUD-001: Prefer thin machine composition and extracted pure functions over broad monolithic replacements.
- GUD-002: Keep each extraction atomic and independently verifiable.
- PAT-001: Separate pure policy computation from XState transition wiring.
- PAT-002: Validate each extraction with focused machine and runtime tests before proceeding to the next phase.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Capture deterministic baseline and define decomposition acceptance gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Capture baseline evidence for concentration in apps/frontend/src/features/tools/machines/tool-page.machine.ts with anchors for UI policy builder at lines 168-275, readiness derivation at lines 281-347, action concentration in setup actions at lines 587-781, and state orchestration in range 840-1021. | Yes | 2026-05-19 |
| TASK-002 | Record baseline file size and closure thresholds: tool-page.machine.ts baseline 1021 LOC; target composer size <= 350 LOC; each extracted module <= 300 LOC. | Yes | 2026-05-19 |
| TASK-003 | Define deterministic module extraction map and ownership matrix for readiness policy, UI policy, hydration projection, and progress projection before code edits begin. | Yes | 2026-05-19 |

### Implementation Phase 2

- GOAL-002: Extract UI policy and readiness computation from machine file into pure modules.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Create apps/frontend/src/features/tools/machines/tool-page-view-model.ts and move buildDefaultViewModel, buildToolPageViewModel, TOOL_PAGE_MESSAGES, and canStartFromPolicy from tool-page.machine.ts. Preserve all return shapes and PrimaryActionPolicy transitions exactly. | Yes | 2026-05-19 |
| TASK-005 | Create apps/frontend/src/features/tools/machines/tool-page-readiness.ts and move ReadinessSnapshot, ReadinessReasonCode, buildReadinessSnapshot, deriveHasExtractionContext, and deriveHasPrimaryTargetStep from tool-page.machine.ts with unchanged semantics. | Yes | 2026-05-19 |
| TASK-006 | Update apps/frontend/src/features/tools/machines/tool-page.machine.ts imports and calls to consume extracted modules only; remove duplicated local definitions and keep machine wiring behaviorally identical. | Yes | 2026-05-19 |

### Implementation Phase 3

- GOAL-003: Extract hydration and progress projection helpers to reduce mutation-surface concentration.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create apps/frontend/src/features/tools/machines/tool-page-progress.ts and move resolveFlowProgressState, resolveRestoredCheckpointState, buildLatestRunArtifactByStep, and readStepDependencyArtifactIdsByStep from tool-page.machine.ts. Preserve intent semantics for new, resume, and regenerate. | Yes | 2026-05-19 |
| TASK-008 | Create apps/frontend/src/features/tools/machines/tool-page-hydration.ts and move readDoneEventPayload and readHydrationMachineOutput from tool-page.machine.ts, plus create explicit hydration request normalizers with fixed signatures and plain input shapes (no ToolPageContext or ToolPageEvent coupling): normalizeHydrateRequest(input: { sourceArtifactId?: string \| null; intent: 'new' \| 'resume' \| 'regenerate'; resolvedBriefingId?: string \| null; sourceExtractionArtifactId?: string \| null; localArtifacts?: GenerationArtifact[]; }) => PendingHydration and normalizePendingHydration(input: PendingHydration \| null, fallbackIntent: 'new' \| 'resume' \| 'regenerate') => PendingHydration. The normalizers must include exactly these fields in output: sourceArtifactId, intent, resolvedBriefingId (via toCanonicalBriefingId), sourceExtractionArtifactId, localArtifacts. Keep HydrationResult success and error mapping unchanged. | Yes | 2026-05-19 |
| TASK-009 | Keep tool-page.machine.ts as thin orchestrator: context, events, setup actors, guards, actions wiring, and states only. Verify no policy-logic duplication remains in machine file after extraction. | Yes | 2026-05-19 |

### Implementation Phase 4

- GOAL-004: Validate regressions and publish closure evidence in governance artifacts.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Run frontend type and focused regressions: npm --workspace apps/frontend run build; npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts src/features/tools/runtime/useToolPage.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx. Pass criteria: exit code 0 and no failing tests in selected suite. | Yes | 2026-05-19 |
| TASK-011 | Run full frontend suite: npm run test --workspace apps/frontend. Pass criteria: exit code 0 and no regression in existing baseline. | Yes | 2026-05-19 |
| TASK-012 | Validate SEC-001 with deterministic checks: add/update a focused test in apps/frontend/src/features/tools/machines/tool-page.machine.test.ts that asserts production-mode execution path emits no sensitive log (no raw extractionPayload and no normalizedText) during readiness/hydration validation; run npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts. Pass criteria: exit code 0 and explicit assertion coverage for no sensitive log emitted in production path. | Yes | 2026-05-19 |
| TASK-013 | Add direct unit tests for extracted readiness module in apps/frontend/src/features/tools/machines/tool-page-readiness.test.ts. Minimum cases: buildReadinessSnapshot reason code matrix, deriveHasPrimaryTargetStep behavior, and production-path no sensitive log emission from deriveHasExtractionContext. Run npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page-readiness.test.ts. Pass criteria: exit code 0. | Yes | 2026-05-19 |
| TASK-014 | Add direct unit tests for extracted hydration module in apps/frontend/src/features/tools/machines/tool-page-hydration.test.ts. Minimum cases: readHydrationMachineOutput success/error mapping, normalizeHydrateRequest canonicalization (including toCanonicalBriefingId), and normalizePendingHydration fallback intent behavior. Run npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page-hydration.test.ts. Pass criteria: exit code 0. | Yes | 2026-05-19 |
| TASK-015 | Update docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md by moving the ToolPage finding from Open Findings to Closed Since Previous Review only if TASK-010, TASK-011, TASK-012, TASK-013, and TASK-014 pass and LOC thresholds from TASK-002 are satisfied. | Yes | 2026-05-19 |

## 3. Alternatives

- ALT-001: Keep single-file machine and add comments only. Rejected because it does not reduce structural concentration.
- ALT-002: Rewrite ToolPage orchestration from scratch. Rejected because it introduces high regression risk and weakens closure determinism.
- ALT-003: Extract only tests and leave production logic centralized. Rejected because finding closure requires architectural decomposition evidence.

## 4. Dependencies

- DEP-001: apps/frontend/src/features/tools/machines/tool-page.machine.ts as primary scope artifact.
- DEP-002: apps/frontend/src/features/tools/machines/hydration.machine.ts for hydration result contract compatibility.
- DEP-003: apps/frontend/src/features/tools/machines/briefing-upload.machine.ts for extraction context readiness checks.
- DEP-004: apps/frontend/src/features/tools/machines/extraction-context-validity.ts for tool-aware extraction validity predicates.
- DEP-005: apps/frontend/src/features/tools/runtime/useToolPage.ts for integration behavior and runtime dispatch compatibility.
- DEP-006: docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md for finding closure recording.

## 5. Files

- FILE-001: apps/frontend/src/features/tools/machines/tool-page.machine.ts
- FILE-002: apps/frontend/src/features/tools/machines/tool-page-view-model.ts
- FILE-003: apps/frontend/src/features/tools/machines/tool-page-readiness.ts
- FILE-004: apps/frontend/src/features/tools/machines/tool-page-progress.ts
- FILE-005: apps/frontend/src/features/tools/machines/tool-page-hydration.ts
- FILE-006: apps/frontend/src/features/tools/machines/tool-page.machine.test.ts
- FILE-007: apps/frontend/src/features/tools/runtime/useToolPage.test.ts
- FILE-008: apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx
- FILE-009: docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- FILE-010: apps/frontend/src/features/tools/machines/tool-page-readiness.test.ts
- FILE-011: apps/frontend/src/features/tools/machines/tool-page-hydration.test.ts

## 6. Testing

- TEST-001: Machine regression suite in apps/frontend/src/features/tools/machines/tool-page.machine.test.ts for PROGRESS_SYNCED, HYDRATE_REQUESTED, START_GENERATION guard, and RESET transitions.
- TEST-002: Runtime integration checks in apps/frontend/src/features/tools/runtime/useToolPage.test.ts for dispatch flow consistency after decomposition.
- TEST-003: UI policy checks in apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx verifying primary action policy and status messaging behavior.
- TEST-004: Type safety and build gate with npm --workspace apps/frontend run build.
- TEST-005: Focused frontend tests with npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts src/features/tools/runtime/useToolPage.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx.
- TEST-006: Full frontend suite with npm run test --workspace apps/frontend.
- TEST-007: SEC-001 logging compliance test in apps/frontend/src/features/tools/machines/tool-page.machine.test.ts verifying production path emits no sensitive log (no raw extraction payload and no normalizedText) in readiness or hydration-related warnings.
- TEST-008: Direct unit tests in apps/frontend/src/features/tools/machines/tool-page-readiness.test.ts for ReadinessSnapshot reason-code matrix, deriveHasPrimaryTargetStep, and production-path no sensitive log emission from deriveHasExtractionContext.
- TEST-009: Direct unit tests in apps/frontend/src/features/tools/machines/tool-page-hydration.test.ts for hydration output mapping and request normalizers (canonical briefing ID and fallback intent behavior).

## 7. Risks & Assumptions

- RISK-001: Helper extraction may accidentally change edge-case order in buildToolPageViewModel branches.
- RISK-002: Hydration helper extraction may alter error reason fallback behavior.
- RISK-003: Progress projection extraction may change merge behavior for resume and regenerate paths.
- RISK-004: Remaining inline debug logs in extraction readiness checks may exceed governance targets if not controlled in production mode.
- ASSUMPTION-001: Existing machine and runtime tests provide enough coverage to detect behavior regressions during extraction.
- ASSUMPTION-002: No backend or contract shape changes are needed to close this frontend concentration finding.
- ASSUMPTION-003: Governance closure is accepted when structural decomposition, thresholds, and regression gates are all satisfied.

## 8. Related Specifications / Further Reading

- docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md
- plan/refactor-generation-system-definition-1.md
