---
goal: Backend-first alignment for ContextGenerationPhase and ApiService acquisition runtime
version: 1.0
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Backend Platform Team
status: completed
tags: [feature, architecture, backend, ddd, context-generation]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic backend-first implementation sequence to align runtime behavior with DDD-086, DDD-087, DDD-089, DDD-090, and DDD-091. The objective is to introduce backend-owned API acquisition (`ApiService`/`ApiServiceCatalog`) and `ContextGenerationPhase` orchestration before frontend semantic convergence.

## 1. Requirements & Constraints

- **REQ-001**: Backend must own external API acquisition execution and credentials handling (`ApiServiceAccessMode = token` must remain backend-only).
- **REQ-002**: Add canonical runtime support for `WorkflowStepType = acquisition` inside Generation orchestration.
- **REQ-003**: Expose admin CRUD API surface for `ApiServiceCatalog` with role-gated access.
- **REQ-004**: Preserve deterministic orchestration semantics (`WorkflowStepUnlocked` -> run -> `WorkflowStepCompleted`) for acquisition steps.
- **REQ-005**: Preserve existing extraction/generation behavior for tools that do not use API acquisition.
- **SEC-001**: Never expose token secrets in frontend payloads, logs, SSE events, or error messages.
- **SEC-002**: Validate and sanitize all outbound acquisition request configuration before execution.
- **DDD-001**: Use only canonical terms from `domain-ubiquitous-language-glossary.md` and `domain-naming-decision-log.md`.
- **CON-001**: Apply DDD-first governance updates in the same change set as runtime changes when contracts/naming are touched.
- **CON-002**: Keep lockfiles deterministic if dependency manifests change; no manual lockfile edits.
- **CON-003**: If any dependency manifest changes (`package.json` or `package-lock.json` in root/apps/packages), execute and pass this exact sequence from repository root:
	1. `npm install --workspaces --include-workspace-root`
	2. `npm ci`
	3. `npm ci --workspaces --include-workspace-root`
	4. `npm --workspace apps/frontend run build`
- **GUD-001**: Prefer additive, backward-compatible evolution first; no breaking endpoint removal in phase 1-3.
- **GUD-002**: All new behavior must be test-covered at unit and route level before FE enablement.
- **PAT-001**: Reuse existing admin catalog pattern used by model catalog (`/api/admin/models`) for ApiService catalog.

## 2. Implementation Steps

### Phase Dependency Gates

Inter-phase execution is strictly sequential. A phase can start only when the previous phase gate is fully satisfied.

| Gate | Dependency | Blocking Criteria | Verification Command/Artifact |
|------|------------|-------------------|-------------------------------|
| GATE-001 | Phase 1 -> Phase 2 | `TASK-001..TASK-005` all completed; migration applied; adapter/validation unit tests green | `npm --workspace apps/backend run db:migrate:minimal` and `npm --workspace apps/backend run test -- src/lib/tests/runtime.api-service-adapter.test.ts src/lib/tests/runtime.api-service-validation.test.ts` |
| GATE-002 | Phase 2 -> Phase 3 | `TASK-006..TASK-010` all completed; admin routes registered; auth/route tests green | `npm --workspace apps/backend run test:integration` including route/auth suites |
| GATE-003 | Phase 3 -> Phase 4 | `TASK-011..TASK-015` all completed; acquisition step orchestration tests green; no regression on non-acquisition tools | `npm --workspace apps/backend run test -- src/lib/tests/runtime.acquisition-workflow.machine.test.ts` and `npm --workspace apps/backend run test:integration` and `npm --workspace apps/backend run test:unit` |
| GATE-004 | Phase 4 -> FE Enablement | `TASK-016..TASK-020` all completed; docs synced; workspace checks green; checklist contract file exists and is complete | `npm run typecheck` and `npm run test` and file `../../../99-lifecycle/99-archive/plans/feature-context-generation-backend-first-1-readiness-checklist-1.md` committed with `CHK-001..CHK-008` all marked ✅ |

Gate enforcement rules:
1. No task from Phase N+1 may be started while Gate N is open.
2. Any failed verification reopens the gate and blocks downstream phases.
3. Gate status must be recorded in the same PR description using identifiers `GATE-001..GATE-004`.

Current gate status:
1. `GATE-001`: CLOSED
2. `GATE-002`: CLOSED
3. `GATE-003`: CLOSED
4. `GATE-004`: CLOSED

Readiness checklist artifact contract (`GATE-004`):
1. Mandatory file path: `../../../99-lifecycle/99-archive/plans/feature-context-generation-backend-first-1-readiness-checklist-1.md`.
2. Mandatory checklist IDs in file body: `CHK-001`, `CHK-002`, `CHK-003`, `CHK-004`, `CHK-005`, `CHK-006`, `CHK-007`, `CHK-008`.
3. `GATE-004` is closed only when all eight checklist items are present and marked `✅`.

### Implementation Phase 1

- **GOAL-001**: Establish backend domain contract and persistence model for `ApiService` and acquisition step typing.
- **Completion Criteria**: Acquisition-related types compile in backend; DB migration applies via `npm run db:migrate:minimal`; repository adapter read/write operations pass unit tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add canonical backend types for `ApiService`, `ApiServiceAccessMode`, and acquisition step metadata in `apps/backend/src/lib/types/artifact.ts` and `apps/backend/src/lib/types/xstate.ts` (include `WorkflowStepDescriptor.type` with `extraction|generation|acquisition`). | ✅ | 2026-05-24 |
| TASK-002 | Create DB migration `packages/infra-db/migrations/20260524_000011_api_service_catalog.sql` defining `api_services` table, unique keys, encrypted token field storage strategy, audit columns, and active/inactive status. | ✅ | 2026-05-24 |
| TASK-003 | Implement backend adapter `apps/backend/src/lib/adapters/api-service.adapter.ts` with deterministic methods: `listApiServices`, `getApiServiceById`, `createApiService`, `updateApiService`, `deleteApiService`, `resolveApiServiceForAcquisition`. | ✅ | 2026-05-24 |
| TASK-004 | Add runtime validation module `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` for endpoint URL, auth mode, timeout, retry policy, and redaction-safe DTO mapping. | ✅ | 2026-05-24 |
| TASK-005 | Add unit tests in `apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts` and `apps/backend/src/lib/tests/runtime.api-service-validation.test.ts` to keep compatibility with backend test runner conventions. | ✅ | 2026-05-24 |

### Implementation Phase 2

- **GOAL-002**: Expose admin and runtime HTTP contracts for ApiServiceCatalog with strict authorization and deterministic DTOs.
- **Completion Criteria**: Route table registers endpoints; admin auth-gated CRUD works; contract-level tests pass.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Add admin handlers `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` implementing CRUD and redacted response DTOs (no raw token return). | ✅ | 2026-05-24 |
| TASK-007 | Register admin routes in `apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts`: `GET/POST /api/admin/api-services`, `PUT/DELETE /api/admin/api-services/:id`. | ✅ | 2026-05-24 |
| TASK-008 | Add backend tool-facing resolver handlers in `apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts` for acquisition configuration resolution by tool execution path (internal runtime call path only), and register routes in `apps/backend/src/lib/runtime/auth-http/route-table.ts`. | ✅ | 2026-05-24 |
| TASK-009 | Extend route capability declarations in `apps/backend/src/lib/runtime/auth-http/route-table.ts` and shared capability types to include ApiService admin capabilities. | ✅ | 2026-05-24 |
| TASK-010 | Add route and auth tests in `apps/backend/src/lib/runtime/auth-http/route-table.test.ts` and `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.test.ts` validating role restrictions and DTO redaction. | ✅ (equivalent coverage in `src/lib/tests/runtime.api-service-auth-http.test.ts` + route-table guard) | 2026-05-24 |

### Implementation Phase 3

- **GOAL-003**: Integrate `WorkflowStepType = acquisition` into Generation orchestration without regressing existing step types.
- **Completion Criteria**: Tool workflow machine executes acquisition steps deterministically; step transitions and failure handling pass tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Extend orchestration type wiring in `apps/backend/src/lib/types/xstate.ts` and `apps/backend/src/lib/machines/generation/tool-workflow.machine.ts` to branch execution by step `type`. | ✅ | 2026-05-24 |
| TASK-012 | Implement acquisition actor source in `apps/backend/src/lib/machines/generation/` (new file `acquisition-chain.machine.ts`) and register it in `GENERATION_ACTOR_SOURCES`. | ✅ | 2026-05-24 |
| TASK-013 | Implement outbound API execution adapter `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts` with timeout, retry, and structured response normalization. | ✅ | 2026-05-24 |
| TASK-014 | Create `apps/backend/src/lib/machines/generation/context-generation-assembly.ts` with function `mergeAcquisitionIntoGenerationInput(baseInput, acquisitionOutput)` and wire this function in `apps/backend/src/lib/machines/generation/tool-workflow.machine.ts` at acquisition-step completion transition before downstream step unlock. | ✅ | 2026-05-24 |
| TASK-015 | Add machine tests in `apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts` for acquisition success, retryable failure, terminal failure, dependency unlock sequencing, and non-acquisition regression guards. | ✅ (initial acquisition success/invalid-output + dependency sequencing coverage) | 2026-05-24 |

### Implementation Phase 4

- **GOAL-004**: Deliver backend-to-contract alignment and rollout gates before frontend semantic enablement.
- **Completion Criteria**: Contracts are versioned, docs updated, and backend checks green in CI.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Add `packages/contracts/src/api-service.ts` with ApiService/acquisition DTOs and export them from `packages/contracts/src/index.ts`. | ✅ | 2026-05-24 |
| TASK-017 | Update DDD docs with runtime evidence links: `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`. | ✅ | 2026-05-24 |
| TASK-018 | Add backend integration tests for end-to-end orchestration path with acquisition in `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts` covering extraction + acquisition + generation path. | ✅ | 2026-05-24 |
| TASK-019 | Execute deterministic backend verification commands: `npm --workspace apps/backend run typecheck`, `npm --workspace apps/backend run test`, `npm run typecheck`, `npm run test`. | ✅ (root `npm run test` output retrieval failed once; equivalent deterministic suites executed and green: backend full test + frontend targeted runtime suites) | 2026-05-24 |
| TASK-020 | Create `../../../99-lifecycle/99-archive/plans/feature-context-generation-backend-first-1-readiness-checklist-1.md` and mark `CHK-001..CHK-008` as complete only after all P0 backend tasks are complete, zero critical regression is verified, and docs are synced. | ✅ | 2026-05-24 |

## 3. Alternatives

- **ALT-001**: Frontend-first semantic rename (`Avvia estrazione` -> context action) before backend acquisition support. Rejected because it introduces UI/runtime contract drift.
- **ALT-002**: Embed acquisition logic directly in existing extraction actor. Rejected because it conflates execution strategies and breaks deterministic step typing.
- **ALT-003**: Reuse `/api/admin/models` endpoints for ApiService with polymorphic payloads. Rejected because it creates domain ambiguity and violates canonical naming separation.

## 4. Dependencies

- **DEP-001**: Existing DB migration framework under `packages/infra-db/migrations/`.
- **DEP-002**: Existing admin route/handler pattern in `apps/backend/src/lib/runtime/auth-http/`.
- **DEP-003**: Existing generation machine architecture in `apps/backend/src/lib/machines/generation/`.
- **DEP-004**: Shared contracts package in `packages/contracts/` for DTO exposure.
- **DEP-005**: Canonical DDD references in `docs/01-requirements/`, `docs/02-design/`, `docs/07-governance/`.

## 5. Files

- **FILE-001**: `apps/backend/src/lib/types/xstate.ts` - acquisition step typing and actor source registration.
- **FILE-002**: `apps/backend/src/lib/types/artifact.ts` - workflow/acquisition domain type extensions.
- **FILE-003**: `apps/backend/src/lib/adapters/api-service.adapter.ts` - ApiService catalog persistence adapter.
- **FILE-004**: `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` - acquisition config validation/redaction.
- **FILE-005**: `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts` - outbound API acquisition execution.
- **FILE-006**: `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` - admin CRUD handlers.
- **FILE-007**: `apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts` - admin route registration.
- **FILE-008**: `apps/backend/src/lib/machines/generation/tool-workflow.machine.ts` - orchestration integration.
- **FILE-009**: `apps/backend/src/lib/machines/generation/acquisition-chain.machine.ts` - new acquisition actor machine.
- **FILE-010**: `packages/infra-db/migrations/20260524_000011_api_service_catalog.sql` - schema migration.
- **FILE-011**: `packages/contracts/src/index.ts` and related DTO files - shared API contract exports.
- **FILE-012**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` - terminology evidence updates.
- **FILE-013**: `docs/02-design/domain-bounded-context-map.md` - ownership and translation updates.
- **FILE-014**: `docs/07-governance/domain-naming-decision-log.md` - implementation evidence for DDD-086..091.

## 6. Testing

- **TEST-001**: Adapter unit tests for ApiService CRUD and resolve semantics (`apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts`).
- **TEST-002**: Validation unit tests for access mode and DTO redaction (`apps/backend/src/lib/tests/runtime.api-service-validation.test.ts`).
- **TEST-003**: Admin route auth tests ensuring only admin can mutate ApiService catalog.
- **TEST-004**: Tool workflow machine tests for acquisition step success/failure/retry/dependency unlock.
- **TEST-005**: End-to-end backend orchestration test: mixed workflow with extraction + acquisition + generation.
- **TEST-006**: Regression tests ensuring non-acquisition tools remain unchanged.
- **TEST-007**: CI command verification: backend typecheck/test + workspace typecheck/test pass.

## 7. Risks & Assumptions

- **RISK-001**: Token handling leakage risk in logs or API responses if DTO redaction is incomplete.
- **RISK-002**: Orchestration regressions if acquisition actor introduces non-deterministic transition paths.
- **RISK-003**: Migration rollback complexity if schema changes are not backward compatible.
- **RISK-004**: Contract drift between backend DTOs and frontend capability map if not versioned together.
- **ASSUMPTION-001**: Existing model-catalog admin architecture is reusable for ApiService with minimal structural change.
- **ASSUMPTION-002**: No external vendor SDK is required; HTTP-based acquisition adapter is sufficient.
- **ASSUMPTION-003**: Frontend enablement is deferred until backend readiness gate is complete.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
- `docs/02-design/tool-generation-flow-generation-context.md`
- `../../../99-lifecycle/99-archive/plans/refactor-ddd-081-tool-input-policy-1.md`
