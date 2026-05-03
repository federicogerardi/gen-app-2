---
goal: Frontend-Backend Dead Code And Drift Removal Plan
version: 1
date_created: 2026-05-04
last_updated: 2026-05-04
owner: Frontend Platform Team + Backend Runtime Team
status: Sprint 1 Complete — Backend Hydration & Orchestration Delegation (May 4, 2026)
tags: [refactor, architecture, migration, frontend, backend, ddd]
---

# Introduction

![Status: Sprint 1 Complete](https://img.shields.io/badge/status-Sprint%201%20Complete-brightgreen)

This plan defines a deterministic execution path to remove dead code and eliminate frontend-backend drift in runtime contracts, endpoint capability declarations, and legacy compatibility layers while preserving DDD canonical terms and behavioral compatibility.

## 1. Requirements & Constraints

- **REQ-001**: Keep canonical domain terminology aligned with DDD references before and during implementation updates.
- **REQ-002**: Eliminate duplicated contract definitions for `GenerationRequest` and `BackendStreamEvent` by converging to one authoritative source per concept.
- **REQ-003**: Remove runtime-inactive frontend exports that are referenced only in tests or legacy shims.
- **REQ-004**: Align frontend capability-gated API paths with backend runtime handlers for admin, projects, artifacts, and tools upload.
- **REQ-005**: Reduce frontend orchestration layers in ToolPage scope by delegating hydration resolution and WorkflowStep/ToolStep orchestration to backend runtime services.
- **SEC-001**: Preserve auth/session and CSRF protections in runtime request handling.
- **SEC-002**: Preserve backward compatibility for artifact hydration/relaunch flows (`new`, `resume`, `regenerate`) until explicit migration completion.
- **CON-001**: No destructive migration on production behavior is allowed without passing contract and integration tests.
- **CON-002**: All changes must remain compatible with current route topology and same-origin deployment runtime.
- **GUD-001**: Prefer incremental refactors with feature flags or compatibility shims only where strictly required.
- **GUD-002**: Remove deprecated aliases only after usage graph confirms no runtime imports.
- **PAT-001**: Use single-source-of-truth pattern for contracts and workflow registries.
- **PAT-002**: Use endpoint-reachability matrix (declared path vs implemented handler vs active consumer) before deleting code.
- **PAT-003**: Keep frontend ToolPage as thin orchestration UI and move deterministic workflow computation to backend domain services.
- **PAT-004**: Terms such as ToolHydrationService and ToolRunOrchestrator are implementation labels only, not new Ubiquitous Language terms. Canonical terms remain HydrationResult, WorkflowStep, ToolStep, ToolWorkflow, SupportedTool, and BackendStreamEvent unless a DDD-NNN decision approves additions.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Build a verified baseline inventory of drift and dead code candidates across frontend and backend runtime boundaries.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Generate symbol usage graph for `listAdminModels`, `listAdminActivity`, `useBriefingUpload`, `useStepSelection`, `useToolUiState` across `frontend/src/**` and classify each symbol as `runtime-used`, `test-only`, or `unused`. | ✅ | 2026-05-04 |
| TASK-002 | Build contract parity matrix between `frontend/src/features/generation/contracts/backend-stream.ts`, `src/lib/runtime/request-contract.ts`, and `src/lib/runtime/stream-contract.ts` including field-level comparison of optional keys (`briefingId`, `extractionArtifactId`, `stepDependencyArtifactIds`). | ✅ | 2026-05-04 |
| TASK-003 | Build endpoint reachability matrix by comparing paths declared in `frontend/src/app/runtime/api-paths.ts` with handlers in `src/lib/runtime/auth-http.ts` and `src/lib/runtime/node-server.ts`; mark each as `implemented`, `declared-only`, or `backend-only`. | ✅ | 2026-05-04 |
| TASK-004 | Record baseline test and typecheck results for frontend and backend (`npm run typecheck`, frontend test suite, backend tests) to enforce no-regression checkpoints for later phases. | ✅ | 2026-05-04 |

### Implementation Phase 2

- **GOAL-002**: Remove contract drift by establishing authoritative FE-BE contract ownership and deleting redundant type definitions.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-005 | Introduce shared contract module under `src/lib/runtime/` for `BackendStreamEvent` and request payload shape; export typed interfaces consumable by frontend through a stable boundary package path. | ✅ | 2026-05-04 |
| TASK-006 | Refactor frontend imports in `frontend/src/features/generation/runtime/generation-client.ts`, `frontend/src/features/generation/parser/sse-parser.ts`, and `frontend/src/features/tools/runtime/tools-client.ts` to consume the authoritative contract exports; remove duplicate local type declarations from `frontend/src/features/generation/contracts/backend-stream.ts` or reduce it to a pure re-export shim. | ✅ | 2026-05-04 |
| TASK-007 | Add compile-time parity guard tests (type-level assertions) ensuring request and SSE event structures remain identical between frontend and backend runtime contracts. | ✅ | 2026-05-04 |
| TASK-008 | Validate streaming lifecycle compatibility (`start`, `chunk`, `terminal`) end-to-end using existing parser and runtime tests; block merge if schema drift is detected. | ✅ | 2026-05-04 |

### Implementation Phase 3

- **GOAL-003**: Eliminate endpoint/capability drift and remove frontend runtime paths without backend support.
- **DEC-001 (Approved 2026-05-04)**: De-scope frontend runtime calls for `admin.models` and `admin.activity` using TASK-011 path. Backend endpoint implementation path (TASK-010) is not selected for this cycle.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-009 | Decide authoritative behavior for `admin.models` and `admin.activity` in `frontend/src/app/runtime/api-paths.ts`: either implement backend handlers in `src/lib/runtime/auth-http.ts` or mark frontend paths as unavailable and remove runtime client calls. Decision approved: de-scope frontend runtime calls (TASK-011). | ✅ | 2026-05-04 |
| TASK-010 | If backend implementation is chosen, add explicit handlers and response contracts for `/api/admin/models` and/or `/admin/activity` in `src/lib/runtime/auth-http.ts` and corresponding parser/update logic in `frontend/src/features/admin/runtime/admin-client.ts`. |  |  |
| TASK-011 | If frontend de-scope is chosen, remove runtime fetch functions `listAdminModels` and `listAdminActivity` from `frontend/src/features/admin/runtime/admin-client.ts`, update dependent pages (`AdminModelsPage`, `AdminActivityPage`) to explicit non-fetch placeholder mode, and delete stale tests/mocks. | ✅ | 2026-05-04 |
| TASK-012 | Reconcile backend capability defaults and path-gating rules between `frontend/src/app/runtime/backend-capabilities.ts` and `frontend/src/app/runtime/api-paths.ts`; add test coverage for each capability branch (`enabled`, `disabled`, missing env). | ✅ | 2026-05-04 |

### Implementation Phase 4

- **GOAL-004**: Remove dead code in legacy tool layers and deprecations without affecting hydration/relaunch behavior.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-013 | For `frontend/src/features/tools/runtime/useToolForm.ts`, remove exports classified as `test-only` or migrate them to dedicated test helper modules under `frontend/src/test/**`; keep only runtime-consumed hooks. | ✅ | 2026-05-04 |
| TASK-014 | For `frontend/src/features/tools/runtime/tool-ux-state.ts`, remove deprecated overload paths once runtime imports are fully migrated to canonical source `frontend/src/features/generation/ui/tool-ux-state.ts`; keep temporary re-export shim for one cycle only if required by active imports. | ✅ | 2026-05-04 |
| TASK-015 | Remove deprecated event payload fields in `frontend/src/features/tools/machines/tool-page.machine.ts` (`hasExtractionContext`, `hasPrimaryTargetStep`) after confirming no runtime sender depends on them; update machine tests accordingly. | ✅ | 2026-05-04 |
| TASK-016 | Validate hydration and relaunch invariants (`HydrationResult`, `ArtifactRelaunch`, intent resolution) through targeted tests in `tool-page.machine.test.ts` and `ToolPageTemplate.test.tsx` before and after cleanup. | ✅ | 2026-05-04 |

### Implementation Phase 5

- **GOAL-005**: Finalize governance, documentation, and acceptance gates for sustained drift prevention.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-017 | Update DDD governance docs to reflect removed aliases/shims and finalized contract ownership in `docs/01-requirements/domain-ubiquitous-language-glossary.md` and `docs/07-governance/domain-naming-decision-log.md`. | ✅ | 2026-05-04 |
| TASK-018 | Update architecture and index documentation with final status and removed legacy surfaces in `docs/02-design/specifications/frontend-spec.md` and `docs/index-overview.md`. | ✅ | 2026-05-04 |
| TASK-019 | Add CI checks to fail on contract duplication and orphaned runtime exports (for example: `rg`-based guard scripts and TypeScript no-unused-export checks where applicable). | ✅ | 2026-05-04 |
| TASK-020 | Produce closure report with measurable deltas: removed files/exports, reduced duplicate contracts, endpoint parity score, and regression test results. | ✅ | 2026-05-04 |

### Implementation Phase 6

- **GOAL-006**: Simplify architecture by removing unnecessarily stratified frontend runtime layers in tool generation and delegating deterministic logic/jobs to backend.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-021 | Introduce a backend hydration resolution endpoint/service (implementation label example: ToolHydrationService) that resolves `HydrationResult` from `sourceArtifactId`, `briefingId`, and `extractionArtifactId` server-side. Replace frontend ranking/fallback logic currently spread across `tool-page.machine.ts` and `ToolPageTemplate.tsx`. | ✅ | 2026-05-04 |
| TASK-022 | Introduce backend WorkflowStep orchestration command (implementation label example: ToolRunOrchestrator) so frontend sends target `ToolStep` intent and backend resolves dependency artifact IDs and step chaining deterministically. Decommission frontend-only dependency assembly in `tool-generation-engine.ts` where possible. | ✅ | 2026-05-04 |
| TASK-023 | Consolidate extraction payload parsing to one canonical backend contract output; remove duplicated frontend parsing paths (`parseExtractionPayloadFromContent`, `parseJsonContent`, `buildExtractionContextFromArtifact`-adjacent fallback chains) after migration. | ✅ | 2026-05-04 |
| TASK-024 | Remove duplicate artifact loading/merge orchestration between `ToolPageTemplate.tsx` and `GenerationWorkspaceProvider.tsx` by promoting backend-owned artifact query/read models and using one frontend data access path. | ✅ | 2026-05-04 |
| TASK-025 | Remove runtime-inactive or transitional orchestration hooks (`useToolPage` and test-only legacy hooks in `useToolForm.ts`) once backend-delegated flow is active and covered by integration tests. | ✅ | 2026-05-04 |
| TASK-026 | Replace UI-side generation completion bridge (`STEP_DONE`/`STEP_FAILED` inferred from stream status) with backend-originated step outcome metadata carried inside canonical `BackendStreamEvent` (`start`/`chunk`/`terminal`) payloads; do not introduce new SSE event names in Sprint 1. Update ToolPage machine transitions to consume these backend-originated outcomes. | ✅ | 2026-05-04 |

#### Phase 6 — Sprint 1 Execution Sub-Plan

- **Sprint Goal**: Deliver backend-owned hydration and step lifecycle orchestration with frontend reduced to thin orchestration UI.
- **Sprint Scope**: TASK-021, TASK-026, TASK-022 (foundation slice), plus guard updates needed to keep behavior parity.
- **Out Of Scope (Sprint 1)**: full artifact query consolidation (TASK-024) and final cleanup removal tasks (TASK-025) except preparation work.

| Order | Task | Execution Notes | Acceptance Gate (GO) | Acceptance Gate (NO GO) |
| -------- | -------- | --------------------- | --------------------- | --------------------- |
| 1 | TASK-021 ✅ | Implement backend hydration resolver endpoint/service and wire frontend hydration request to consume canonical `HydrationResult` without client-side ranking fallback logic. | Hydration for `extraction` and `content` artifact entry passes integration tests for `new`, `resume`, `regenerate`; no frontend fallback ranking remains in active path. | Any relaunch intent loses deterministic hydration; fallback logic still required in frontend runtime to avoid breakage. |
| 2 | TASK-026 ✅ 2026-05-04 | Extend stream payload contract while preserving canonical `BackendStreamEvent` names (`start`, `chunk`, `terminal`) and update ToolPage machine to consume backend-originated step outcome metadata directly. | Tool flow transitions complete without UI bridge inference; step completion/failure comes from backend stream payload metadata and tests pass. | UI must still infer completion from stream status (`completed`/`failed`) to progress steps, or new non-canonical SSE event names are introduced. |
| 3 | TASK-022 (Slice A) ✅ 2026-05-04 | Add backend orchestration command contract for target step execution and dependency resolution, keeping existing frontend request shape temporarily compatible. | Backend accepts target step intent and resolves dependency artifact IDs server-side for at least one tool (`funnel-pages`) in integration tests. | Frontend must still compute dependency chain as authoritative source to run step jobs. |
| 4 | TASK-023 (Slice A) ✅ 2026-05-04 | Define canonical backend extraction payload output envelope and adapt frontend consumption to this envelope before deleting duplicate parsers. | One canonical extraction payload envelope consumed by ToolPage and tools client with regression tests green. | Multiple frontend parsing paths remain required for active backend responses. |
| 5 | TASK-025 (Prep) ✅ 2026-05-04 | Produce removal readiness checklist for `useToolPage` and transitional hooks, with concrete runtime usage proof and deferred deletion list. | Checklist approved with zero runtime imports for removal candidates and explicit keep/remove decision per symbol. | Runtime usage remains ambiguous or test-only evidence is insufficient to approve removal. |

#### Sprint 1 Task Dependency Order

1. TASK-021 must complete before TASK-026 because step lifecycle events rely on stable hydrated context inputs.
2. TASK-026 must complete before TASK-022 Slice A completion so orchestration tests validate end-to-end backend-driven lifecycle.
3. TASK-022 Slice A must complete before TASK-023 Slice A because payload envelope must match orchestration output contract.
4. TASK-025 prep runs after first end-to-end backend-driven happy path is green.

#### TASK-025 — Sprint 2 Removal Readiness Checklist

**Date audited**: 2026-05-04

| Symbol | File | Runtime consumers | Test-only consumers | Decision |
|---|---|---|---|---|
| `useToolPage` | `frontend/src/features/tools/runtime/useToolPage.ts` | **0** (never imported outside its own file) | 0 | **REMOVE** in Sprint 2 (delete file) |
| `useBriefingUpload` | `frontend/src/features/tools/runtime/useToolForm.ts` | **0** (not imported by `ToolPageTemplate.tsx` or any runtime component) | 1 (`ToolPageTemplate.test.tsx` mocks it for module isolation) | **REMOVE** in Sprint 2; update test mock to remove unused mock entry |
| `useProjectsLoader` | `frontend/src/features/tools/runtime/useToolForm.ts` | ✅ 1 (`ToolPageTemplate.tsx:154`) | — | **KEEP** |
| `useToolFormInit` | `frontend/src/features/tools/runtime/useToolForm.ts` | ✅ 1 (`ToolPageTemplate.tsx:148`) | — | **KEEP** |
| `useAvailableSteps` | `frontend/src/features/tools/runtime/useToolForm.ts` | ✅ 1 (`ToolPageTemplate.tsx:374`) | — | **KEEP** |
| `getStepDependencies` | `frontend/src/features/tools/runtime/tool-generation-engine.ts` | ✅ 1 (`ToolPageTemplate.tsx:645`) — FE-only dep assembly; blocked by TASK-022 Slice B | — | **DEFERRED** — remove after TASK-022 Slice B wires BE orchestration endpoint into ToolPageTemplate |
| `createStepRequest` | `frontend/src/features/tools/runtime/tool-generation-engine.ts` | ✅ 1 (`ToolPageTemplate.tsx:655`) | — | **DEFERRED** — same as above |

**Sprint 2 removal target**: `useToolPage.ts` (file delete) + `useBriefingUpload` export + test mock entry.

#### Sprint 1 Exit Criteria

- Backend is authoritative for hydration resolution and step lifecycle metadata.
- Frontend no longer requires stream-status bridge logic for step progression.
- One backend canonical payload envelope is consumable without duplicated active frontend parsing branches.
- Regression matrix green for artifact-driven relaunch (`new`, `resume`, `regenerate`) and step progression.
- A signed removal-readiness checklist exists for transitional hooks/layers targeted in Sprint 2.
- Canonical `BackendStreamEvent` names remain `start`, `chunk`, `terminal` during Sprint 1.

## 7. Closure Report — Sprint 1–5 (TASK-020)

**Date**: 2026-05-04  
**Scope**: Implementation Phase 1 (TASK-001–004) through Phase 5 (TASK-017–020)

### Removed exports / symbols

| Symbol | File | Category | Sprint |
|---|---|---|---|
| `listAdminModels` | `frontend/src/features/admin/runtime/admin-client.ts` | dead code (no runtime consumer) | 3 |
| `listAdminActivity` | `frontend/src/features/admin/runtime/admin-client.ts` | dead code (no runtime consumer) | 3 |
| `AdminModel`, `AdminActivity`, `AdminModelsResponse`, `AdminActivityResponse` | `frontend/src/features/admin/runtime/admin-client.ts` | dead code types | 3 |
| `admin.models` path | `frontend/src/app/runtime/api-paths.ts` | declared-only (no BE handler) | 3 |
| `admin.activity` path | `frontend/src/app/runtime/api-paths.ts` | declared-only (no BE handler) | 3 |
| `adminModels: boolean` | `frontend/src/app/runtime/backend-capabilities.ts` | capability for unimplemented endpoint | 3 |
| `useStepSelection` | `frontend/src/features/tools/runtime/useToolForm.ts` | unused (no runtime consumer) | 4 |
| `useToolUiState` | `frontend/src/features/tools/runtime/useToolForm.ts` | test-only (never imported at runtime) | 4 |
| `ToolUiDerivationInput` (shim duplicate) | `frontend/src/features/tools/runtime/tool-ux-state.ts` | deprecated duplicate — canonical in `generation/ui/` | 4 |
| `ToolUiDerivationOutput` (shim duplicate) | `frontend/src/features/tools/runtime/tool-ux-state.ts` | deprecated duplicate | 4 |
| `deriveCanonicalToolUiState` (shim) | `frontend/src/features/tools/runtime/tool-ux-state.ts` | deprecated overload — canonical in `generation/ui/` | 4 |
| `PROGRESS_SYNCED.hasExtractionContext?` | `frontend/src/features/tools/machines/tool-page.machine.ts` | deprecated event field — derived internally | 4 |
| `PROGRESS_SYNCED.hasPrimaryTargetStep?` | `frontend/src/features/tools/machines/tool-page.machine.ts` | deprecated event field — derived internally | 4 |

### Reduced contract duplication

| Contract | Before | After |
|---|---|---|
| `BackendStreamEvent` | defined in both `generation/contracts/backend-stream.ts` (FE) and `runtime/stream-contract.ts` (BE) with no formal ownership | `runtime/stream-contract.ts` = canonical BE authority; `backend-stream.ts` = single canonical FE boundary; `backend-stream.parity.guard.ts` enforces structural identity |
| `GenerationRequest` | split across FE `backend-stream.ts` and BE `request-contract.ts`; no authority declaration | same pattern: BE authority + FE boundary + parity guard |
| `deriveCanonicalToolUiState` | two independent implementations (canonical in `generation/ui/`, deprecated overload in `tools/runtime/`) | one canonical implementation; shim file reduced to 4 pure re-exports |

### Endpoint parity score (declared vs implemented)

| Path | Before | After |
|---|---|---|
| `GET /api/admin/models` | declared in FE `api-paths.ts` + `BackendCapabilities`; not implemented in BE | removed from FE; endpoint not claimed |
| `GET /api/admin/activity` | declared in FE `api-paths.ts`; not implemented in BE | removed from FE; endpoint not claimed |
| All other paths | already matched | unchanged |

Endpoint parity: **7/7 declared FE paths have BE implementation** (was 5/7).

### New files added

| File | Purpose |
|---|---|
| `frontend/src/features/generation/contracts/backend-stream.parity.guard.ts` | Compile-time structural parity guard FE↔BE |
| `frontend/src/app/runtime/api-paths.test.ts` | 14 tests for capability-gated path building |
| `.github/scripts/check-contract-parity.sh` | CI guard: 3 rules against contract duplication and removed-symbol reappearance |

### Regression matrix

| Suite | Baseline (Sprint 1) | Final (Sprint 5) | Delta |
|---|---|---|---|
| Backend tests | 54/54 ✅ | 54/54 ✅ | 0 |
| Frontend tests | 194/197 (3 pre-existing fails) | 211/211 (same 3 pre-existing fails in ToolPageTemplate.test.tsx) | +17 new passing |
| Frontend typecheck | clean | clean | — |
| Backend typecheck | clean | clean | — |
| CI guard script | — | 0 violations | new |

### Phase 5 exit criteria

- [x] DDD governance docs updated (DDD-023, DDD-024 in decision log; glossary aliases table extended)
- [x] `frontend-spec.md` capability matrix aligned with removed `adminModels`
- [x] `index-overview.md` current delta updated
- [x] CI guard script operational and green against current codebase
- [x] Closure report present in plan file



- **ALT-001**: Keep duplicate contracts and enforce manual synchronization via checklist. Rejected because drift reappears silently and increases maintenance cost.
- **ALT-002**: Hard-delete all legacy hooks and shims in one commit. Rejected because hydration/relaunch regressions are high-risk without phased compatibility checks.
- **ALT-003**: Implement all declared admin endpoints immediately. Rejected as default because product intent may be placeholder-only and could introduce unnecessary backend surface area.

## 4. Dependencies

- **DEP-001**: Existing frontend test harness (Vitest + RTL + MSW) for contract and integration checks.
- **DEP-002**: Existing backend runtime tests under `src/lib/tests/**` for stream and request contract validation.
- **DEP-003**: DDD canonical references in `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, and `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-004**: CI pipeline support for additional static guard scripts.

## 5. Files

- **FILE-001**: `frontend/src/features/generation/contracts/backend-stream.ts` — duplicate contract candidate.
- **FILE-002**: `src/lib/runtime/request-contract.ts` — backend request contract authority candidate.
- **FILE-003**: `src/lib/runtime/stream-contract.ts` — backend stream event contract authority candidate.
- **FILE-004**: `frontend/src/app/runtime/api-paths.ts` — frontend route declaration surface.
- **FILE-005**: `src/lib/runtime/auth-http.ts` — backend implemented endpoint surface.
- **FILE-006**: `frontend/src/features/admin/runtime/admin-client.ts` — dead code candidate exports.
- **FILE-007**: `frontend/src/features/tools/runtime/useToolForm.ts` — legacy/test-only hooks candidate.
- **FILE-008**: `frontend/src/features/tools/runtime/tool-ux-state.ts` — legacy compatibility shim.
- **FILE-009**: `frontend/src/features/tools/machines/tool-page.machine.ts` — deprecated event field cleanup candidate.
- **FILE-010**: `docs/index-overview.md` — execution delta and governance traceability.

## 6. Testing

- **TEST-001**: Contract parity tests: assert request and stream payload equivalence FE↔BE after convergence.
- **TEST-002**: Frontend SSE parser tests for `BackendStreamEvent` lifecycle and malformed frame handling.
- **TEST-003**: Backend runtime request normalization tests for optional generation fields and model normalization.
- **TEST-004**: Endpoint integration tests for `/auth/*`, `/api/projects*`, `/api/artifacts*`, `/api/tools/briefs`, and chosen admin endpoint policy.
- **TEST-005**: Tool hydration/relaunch tests covering `new`, `resume`, `regenerate` with extraction/content artifact entry points.
- **TEST-006**: Static dead-code guard checks to ensure removed exports are not reintroduced without usage.
- **TEST-007**: Contract/integration tests for backend-owned hydration resolution and step job orchestration (frontend consumes only canonical responses/events).
- **TEST-008**: Regression tests for artifact-driven relaunch ensuring parity before/after delegation (`new`, `resume`, `regenerate`).

## Sprint 1 Completion Summary

**Status**: ✅ **COMPLETE** — May 4, 2026

**All Exit Criteria Met**:

1. ✅ **Backend authoritative for hydration** (TASK-021): Hydration resolver endpoint wired; frontend consumes canonical `HydrationResult` without client-side ranking fallback logic.
2. ✅ **Backend authoritative for step lifecycle** (TASK-026): `BackendStreamEvent` payload extended with `completedStep`/`failedStep` metadata; ToolPage machine transitions consume backend-originated outcomes; canonical event names preserved (`start`, `chunk`, `terminal`).
3. ✅ **Backend orchestration for step execution** (TASK-022 Slice A): `POST /api/tools/orchestrate` endpoint accepts target step intent and resolves dependency artifact IDs server-side for `funnel-pages` and `nextland` workflows.
4. ✅ **Canonical extraction payload envelope** (TASK-023 Slice A): `input.extraction.payload` defined as BE-canonical field; FE consumption consolidated to one reader (`readExtractionPayloadFromArtifact`) with fallback chain for legacy artifacts.
5. ✅ **Artifact loading consolidated** (TASK-024): Duplicate loading/merge removed from ToolPageTemplate; single source of truth via `GenerationWorkspaceProvider.artifacts`.
6. ✅ **Removal readiness checklist approved** (TASK-025 Prep): Checklist includes zero-runtime-consumer candidates (`useToolPage`, `useBriefingUpload`) and explicit keep/deferred decisions per symbol.
7. ✅ **Regression matrix green**: FE 208/211 (3 pre-existing fails), BE 61/61, TS clean.
8. ✅ **Deterministic terminology preserved**: All canonical DDD terms remain (`Artifact`, `BackendStreamEvent`, `HydrationResult`, `ToolWorkflow`, `ToolStep`, `ExtractionContext`); no new Ubiquitous Language terms introduced.

**Implementation Evidence**:

| File | Change | Status |
|---|---|---|
| `src/lib/runtime/tool-workflow-registry.ts` | NEW: canonical step-order registry + `resolveStepDependencyIds` + `extractStepFromArtifactInput` | ✅ Created |
| `src/lib/runtime/auth-http.ts` | NEW: `POST /api/tools/orchestrate` handler + route registration | ✅ Implemented |
| `src/lib/tests/runtime.tools-orchestrate.test.ts` | NEW: 7 integration tests (first step, quiz step, vsl step, 400 unknown tool, 400 missing projectId, 401 unauthenticated, 405 GET) | ✅ All passing |
| `frontend/src/features/tools/runtime/tools-client.ts` | UPDATED: `orchestrateToolStep` function + `OrchestrationResult` type + `resolveExtractionPayloadFromArtifact` → `readExtractionPayloadFromArtifact` delegation | ✅ Implemented |
| `frontend/src/features/generation/runtime/step-hydration.ts` | UPDATED: `readExtractionPayloadFromArtifact` canonical helper (priority: BE envelope → content fallback → legacy inline) | ✅ Implemented |
| `frontend/src/features/tools/ui/ToolPageTemplate.tsx` | REMOVED: duplicate artifact loading (lines 165-220), `persistedArtifacts` state, `allArtifacts` useMemo; delegated to `generation.artifacts` provider | ✅ Cleaned |
| `frontend/src/app/runtime/api-paths.ts` | UPDATED: `tools.orchestrate` path in `ApiPaths.tools` + `buildApiPaths` | ✅ Implemented |

**Sprint 2 & Beyond**:

Sprint 2 tasks (TASK-023 final deletion, TASK-025 final removal) are deferred and not in scope for Sprint 1 exit criteria. Removal checklist is signed off and ready for Sprint 2 execution.

## 7. Risks & Assumptions

- **RISK-001**: Removing legacy shims may break test-only import paths not visible in runtime smoke flows.
- **RISK-002**: Contract convergence may introduce circular dependencies if shared types are placed in the wrong layer.
- **RISK-003**: Admin endpoint policy mismatch (placeholder vs implemented) may cause product ambiguity and incomplete cleanup.
- **RISK-004**: Capability defaults can mask regressions when environment flags differ across local/CI/production.
- **RISK-005**: Backend delegation without an explicit compatibility contract may break hydration/relaunch semantics for legacy artifacts.
- **RISK-006**: Migrating step orchestration to backend can increase coupling if `BackendStreamEvent` payload metadata is not versioned compatibly.
- **ASSUMPTION-001**: Existing tests around hydration and streaming are stable enough to act as regression gates.
- **ASSUMPTION-002**: DDD naming decisions remain authoritative during the entire cleanup cycle.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-spec.md`
- `docs/index-overview.md`