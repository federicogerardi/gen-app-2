---
goal: Prevent invalid ExtractionContext from enabling ToolPage generation readiness
version: 1.0
date_created: 2026-05-16
last_updated: 2026-05-16
owner: Frontend Platform Team
status: 'Completed'
tags: [refactor, frontend, backend, xstate, readiness, extraction, bug]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic refactor that blocks Tool Workspace Page readiness when extraction completes with semantically invalid output (for example empty or non-actionable extraction payload), and requires a new valid brief upload before generation can start.

## 1. Requirements & Constraints

- **REQ-001**: Tool Workspace Page must not expose `start-generation` when extraction output is semantically invalid for the selected Tool.
- **REQ-002**: After invalid extraction, `briefingUploadMachine` must return to `idle` (or remain non-ready) and require a new brief upload attempt.
- **REQ-003**: Readiness derivation must use deterministic extraction-validity rules per `SupportedTool`, not only presence of IDs and normalized text.
- **REQ-004**: Error feedback must be user-readable and domain-specific (no raw transport/internal event names in UI).
- **REQ-005**: Existing valid extraction flows must remain backward compatible and continue to reach `ready`.
- **SEC-001**: No new endpoint may bypass existing authenticated session checks for `/generation/stream` and `/api/tools/*`.
- **DOM-001**: Canonical terms must remain aligned with DDD glossary (`ExtractionContext`, `ReadinessSnapshot`, `DispatchError`, `ToolPage`).
- **CON-001**: No schema migration is allowed in this refactor version.
- **CON-002**: Existing Tool-specific readiness rule for `youtube-lf-script` required fields must remain enforced.
- **GUD-001**: Keep state transitions deterministic and test-first for actor machines (`briefingUploadMachine`, `toolPageMachine`).
- **PAT-001**: Implement extraction validity as an explicit predicate function and reuse it in both readiness derivation and extraction completion handling.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Reproduce and lock the failing scenario with automated tests before functional changes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add a failing unit test in `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` verifying `extracting -> idle` when extraction terminal outcome is semantically empty (no required extraction signal). | ✅ | 2026-05-16 |
| TASK-002 | Add a failing unit test in `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` verifying `ReadinessSnapshot.hasExtractionContext=false` for invalid extraction context despite populated `briefingId` and `extractionArtifactId`. | ✅ | 2026-05-16 |
| TASK-003 | Add a failing integration-level hook test in `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` verifying `primaryActionPolicy='disabled'` after invalid extraction and presence of inline `DispatchError`. | ✅ | 2026-05-16 |
| TASK-004 | Add a backend test in `apps/backend/src/lib/tests/generation-system.runtime.test.ts` covering extraction stream success with empty semantic output and expected mapped failure reason contract. | ✅ | 2026-05-16 |

Completion criteria:
- All four tests exist and fail on current codebase for the targeted scenario.
- Failure messages explicitly identify readiness leakage and invalid extraction acceptance.

### Implementation Phase 2

- GOAL-002: Introduce canonical extraction validity gate and enforce non-ready state after invalid extraction.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | In `apps/frontend/src/features/tools/machines/tool-page.machine.ts`, implement `isExtractionContextValidForTool(toolKey, payload, normalizedText)` and replace direct core-field checks in `hasCompleteBriefingContext` / `deriveHasExtractionContext` with this predicate. | ✅ | 2026-05-16 |
| TASK-006 | In `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`, add extraction output validation in `extracting.onDone`: if invalid, transition to `idle`, clear extraction context fields, and set deterministic error code/message key (for example `extraction_context_insufficient`). | ✅ | 2026-05-16 |
| TASK-007 | In `apps/frontend/src/features/tools/runtime/useToolPage.ts`, ensure `ExtractionContextBridge` upserts only when extraction context passes the same validity predicate used by `toolPageMachine`; prevent stale valid context reuse after invalid extraction attempt. | ✅ | 2026-05-16 |
| TASK-008 | In `apps/frontend/src/features/tools/runtime/tools-client.ts`, normalize extraction result classification so empty/invalid extraction payload does not silently return as successful ready candidate. | ✅ | 2026-05-16 |

Completion criteria:
- Invalid extraction can no longer produce `briefingSnapshot.matches('ready')` for readiness purposes.
- `ReadinessSnapshot.canStartFlow` remains `false` until a valid re-upload completes.

### Implementation Phase 3

- GOAL-003: Align backend failure semantics and frontend feedback mapping for extraction-empty outcomes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | In `apps/backend/src/lib/machines/generation-system.machine.ts`, define deterministic extraction-empty failure mapping (new reason code or explicit existing code) for extraction route when semantic output is empty/invalid. | ✅ | 2026-05-16 |
| TASK-010 | In `apps/backend/src/lib/runtime/error-contract.ts`, map the selected extraction-empty reason to a stable API error envelope (`code`, `message`) consumable by frontend without leaking internal machine event types. | ✅ | 2026-05-16 |
| TASK-011 | In `apps/frontend/src/features/generation/runtime/generation-client.ts` and `apps/frontend/src/features/tools/runtime/tools-client.ts`, map backend extraction-empty reason to domain-readable frontend error text and preserve raw reason only in debug logs. | ✅ | 2026-05-16 |
| TASK-012 | In `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`, verify feedback remains in `inline-action` channel (`DispatchError`) and does not trigger global feedback viewport for this scenario. | ✅ | 2026-05-16 |

Completion criteria:
- Screenshot-equivalent scenario shows readable inline error and no ready state.
- Internal token `STREAM_TERMINATED_SUCCESS` is not displayed to end users.

### Implementation Phase 4

- GOAL-004: Regression hardening and documentation alignment.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Update frontend machine tests to cover valid and invalid extraction for `funnel-pages`, `nextland`, and existing strict path `youtube-lf-script`. | ✅ | 2026-05-16 |
| TASK-014 | Update runtime test matrix in `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` to verify re-upload recovers from invalid extraction and re-enables readiness only after valid context. | ✅ | 2026-05-16 |
| TASK-015 | Update DDD governance docs for readiness/extraction validity semantics: `docs/01-requirements/domain-ubiquitous-language-glossary.md` and `docs/07-governance/domain-naming-decision-log.md` (new DDD-NNN entry if new canonical reason term is introduced). | ✅ | 2026-05-16 |
| TASK-016 | Update UI specification if feedback wording/channel behavior changes: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`. | ✅ | 2026-05-16 |

Completion criteria:
- Full targeted test suite passes.
- Documentation reflects final domain and UI behavior with no terminology drift.

## 3. Alternatives

- **ALT-001**: Frontend-only fix in `toolPageMachine` readiness derivation. Rejected because `briefingUploadMachine` would still accept invalid extraction as ready-like state, causing latent inconsistencies.
- **ALT-002**: Backend-only fix by failing extraction route always on empty semantic output. Rejected because stale frontend extraction context could still make readiness true without synchronized invalidation.
- **ALT-003**: Relaxed approach showing warning but allowing generation start. Rejected because requirement demands explicit blocking until valid brief upload.

## 4. Dependencies

- **DEP-001**: Existing XState actor contracts in `briefingUploadMachine`, `toolPageMachine`, and `frontendStreamMachine`.
- **DEP-002**: Backend failure reason mapping in `apps/backend/src/lib/runtime/error-contract.ts`.
- **DEP-003**: Shared frontend extraction parsing helpers in `apps/frontend/src/features/generation/runtime/step-hydration.ts` and tools client.
- **DEP-004**: DDD canonical references (`docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`).

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` — enforce invalid extraction transition to `idle` and error assignment.
- **FILE-002**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — introduce tool-aware extraction validity predicate and readiness gate.
- **FILE-003**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` — guard `ExtractionContextBridge` and dispatch flow against invalid extraction context.
- **FILE-004**: `apps/frontend/src/features/tools/runtime/tools-client.ts` — normalize extraction-empty handling.
- **FILE-005**: `apps/frontend/src/features/generation/runtime/generation-client.ts` — preserve transport semantics and user-facing mapping.
- **FILE-006**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — validate inline feedback rendering behavior.
- **FILE-007**: `apps/backend/src/lib/machines/generation-system.machine.ts` — extraction-empty reason classification.
- **FILE-008**: `apps/backend/src/lib/runtime/error-contract.ts` — API error mapping for extraction-empty reason.
- **FILE-009**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts` — extraction invalid-state tests.
- **FILE-010**: `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` — readiness gating tests.
- **FILE-011**: `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` — end-to-end hook behavior tests.
- **FILE-012**: `apps/backend/src/lib/tests/generation-system.runtime.test.ts` — backend extraction-empty regression tests.
- **FILE-013**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` — domain behavior updates.
- **FILE-014**: `docs/07-governance/domain-naming-decision-log.md` — naming/governance decision entry.
- **FILE-015**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — feedback behavior alignment.

## 6. Testing

- **TEST-001**: Run frontend machine tests: `npm test -- apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts apps/frontend/src/features/tools/machines/tool-page.machine.test.ts`.
- **TEST-002**: Run frontend hook/UI tests: `npm test -- apps/frontend/src/features/tools/runtime/useToolPage.test.ts apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`.
- **TEST-003**: Run backend targeted runtime test: `node --import tsx --test --test-name-pattern "extraction.*empty|stream completes with empty output" apps/backend/src/lib/tests/generation-system.runtime.test.ts`.
- **TEST-004**: Add and run regression asserting that invalid extraction keeps `primaryActionPolicy='disabled'` and `ReadinessSnapshot.canStartFlow=false`.
- **TEST-005**: Add and run recovery test asserting that a second valid brief upload transitions to `ready` and enables generation.

## 7. Risks & Assumptions

- **RISK-001**: Overly strict extraction-validity predicate may block legitimate short briefs.
- **RISK-002**: Frontend/backed reason-code mismatch may reintroduce raw technical messages in UI.
- **RISK-003**: Existing hydration flows from legacy artifacts may fail if predicate does not account for historical payload sparsity.
- **ASSUMPTION-001**: Product requirement is strict blocking until valid extraction output is present.
- **ASSUMPTION-002**: Tool-specific minimal extraction requirements can be expressed deterministically without LLM confidence scoring.
- **ASSUMPTION-003**: No external API contract changes are required beyond existing SSE terminal/error payload fields.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`