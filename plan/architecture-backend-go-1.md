---
goal: Backend GO implementation plan before frontend integration with real database
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-24
owner: GitHub Copilot
status: In Progress
tags: [architecture, backend, xstate, postgres, redis, go-no-go]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

Deterministic execution plan to move the backend from the current NO-GO state to a GO state before frontend integration against the real Postgres and Redis stack.

## Progress Update (2026-04-24)

- Completed: runtime root orchestration wiring (GOAL-001), backend surface contracts/session entrypoint (GOAL-002), accounting persistence completion (GOAL-003), base workflow/extraction integration (GOAL-004), machine/root test matrix and scripts (GOAL-005/GOAL-006).
- Verified: `npm run typecheck`, `npm test`, and `npm run test:smoke` green on real environment (`DATABASE_URL` Neon + `UPSTASH_REDIS_URL`).
- Verified: `npm run backend:go` green with DB bootstrap scripts migrated to Node/`pg` (no `psql` dependency).

## 1. Requirements & Constraints

- **REQ-001**: Keep the orchestration centered in `generationSystemMachine` and avoid moving runtime coordination into route handlers.
- **REQ-002**: Preserve the existing canonical event contracts in `src/lib/types/xstate.ts`.
- **REQ-003**: Keep XState v5 idioms only: `setup().createMachine()`, `fromPromise`, `always`, `reenter: true`, `createActor()`.
- **REQ-004**: Use the existing adapter contract boundary in `src/lib/adapters/generation.adapters.ts`.
- **REQ-005**: Reuse the existing real adapter package in `src/lib/adapters/postgres-redis.production.ts`.
- **REQ-006**: Produce a backend surface that can be consumed by a future frontend without redefining request/error/stream contracts.
- **REQ-007**: Add executable smoke tests against real Postgres and Redis.
- **SEC-001**: Do not add hidden fallback behavior for routing, idempotency, or persistence outcomes.
- **CON-001**: Maintain compatibility with the current migration and seed scripts in `package.json`.
- **CON-002**: Keep the implementation incremental; each phase must leave the repository in a valid state.
- **CON-003**: Do not introduce XState v4 APIs or side effects inside `assign`.
- **GUD-001**: Validate each phase with the narrowest executable check available.
- **PAT-001**: Child actors must own single operational responsibilities exactly as defined in the topology spec.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Wire the root actor to real child actors and make the orchestration executable instead of passive event forwarding.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Refactor `src/lib/machines/generation-system.machine.ts` to invoke or spawn `usageMachine` with concrete machine input built from `REQUEST_RECEIVED`, `AUTH_OK`, and validated routing context. |  |  |
| TASK-002 | Refactor `src/lib/machines/generation-system.machine.ts` to invoke or spawn `idempotencyCoordinatorMachine` before stream startup and consume `IDEMPOTENCY_CLAIMED`, `IDEMPOTENCY_REPLAY_READY`, and `IDEMPOTENCY_CONFLICT` directly from child actor completion. |  |  |
| TASK-003 | Refactor `src/lib/machines/generation-system.machine.ts` to invoke or spawn `streamTransportMachine` after usage/idempotency success and route `STREAM_SESSION_STARTED`, `STREAM_CHUNK_RECEIVED`, `STREAM_TERMINATED_SUCCESS`, and `STREAM_TERMINATED_FAILURE` through the root machine. |  |  |
| TASK-004 | Refactor `src/lib/machines/generation-system.machine.ts` to invoke or spawn `persistenceBatchMachine` for flush/finalize paths instead of relying on externally injected persistence events. |  |  |
| TASK-005 | Introduce a root machine input contract in `src/lib/machines/generation-system.machine.ts` that carries `GenerationAdapters` and all child machine dependencies deterministically. |  |  |
| TASK-006 | Add a small runtime bootstrap module in `src/lib/machines/runtime.ts` that creates the root actor with real adapters via `createPostgresRedisProductionGenerationAdapters(...)`. |  |  |

### Implementation Phase 2

- **GOAL-002**: Add a backend runtime surface with stable request, error, and streaming contracts.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create `src/lib/runtime/request-contract.ts` defining the concrete backend input mapping from transport payloads into `RequestReceivedEvent`. |  |  |
| TASK-008 | Create `src/lib/runtime/error-contract.ts` defining deterministic backend error objects aligned with machine failure reasons. |  |  |
| TASK-009 | Create `src/lib/runtime/stream-contract.ts` defining SSE event serialization for `STREAM_SESSION_STARTED`, `STREAM_CHUNK_RECEIVED`, terminal stream events, and persistence terminal events. |  |  |
| TASK-010 | Create `src/lib/runtime/backend-session.ts` that starts `generationSystemMachine`, subscribes to snapshots/events, and emits serialized stream payloads in canonical order. |  |  |
| TASK-011 | Add a minimal server-facing integration module at `src/lib/runtime/index.ts` exporting one `handleGenerationRequest(...)` entrypoint for future route handlers. |  |  |

### Implementation Phase 3

- **GOAL-003**: Complete real persistence and accounting so outcomes are coherent on Postgres/Redis.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Extend `src/lib/adapters/generation.adapters.ts` and `src/lib/adapters/postgres-redis.interfaces.ts` with explicit accounting operations required for `quota_history`, token usage, and cost persistence. |  |  |
| TASK-013 | Refactor `src/lib/adapters/postgres-redis.production.ts` so `PostgresArtifactRepository` persists `model`, `input_json`, `input_tokens`, `output_tokens`, and `cost_usd` with deterministic values. |  |  |
| TASK-014 | Add a `quota_history` write path in `src/lib/adapters/postgres-redis.production.ts` for `success`, `error`, and `rate_limited` outcomes, executed in the same transaction as terminal artifact updates where required by the spec. |  |  |
| TASK-015 | Add a follow-up SQL migration under `db/migrations/` for any schema fields needed by the completed accounting path and keep it backward-compatible with existing seed data. |  |  |
| TASK-016 | Update `db/seeds/20260424_000001_minimal_users_projects.sql` only if additional non-null DB fields become mandatory for real smoke tests. |  |  |

### Implementation Phase 4

- **GOAL-004**: Integrate workflow and extraction branches into the executable root flow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Refactor `src/lib/machines/generation-system.machine.ts` to route `extractionFlow`, `toolGenerationFlow`, and `genericGenerationFlow` into concrete child actor invocations rather than placeholder branch states. |  |  |
| TASK-018 | Integrate `src/lib/machines/extraction-chain.machine.ts` into the root orchestration with deterministic handling of accept, reject, hard fail, and exhausted paths. |  |  |
| TASK-019 | Integrate `src/lib/machines/tool-workflow.machine.ts` into the root orchestration with step dependency handling, retry, and terminal artifact propagation. |  |  |
| TASK-020 | Add explicit root-level guards or actions for deterministic vs non-deterministic routing if the registry contract requires it during runtime integration. |  |  |

### Implementation Phase 5

- **GOAL-005**: Add executable smoke tests and focused machine tests that can fail the backend GO gate.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Add `src/lib/adapters/postgres-redis.smoke.ts` that runs a real `claimed -> markCompleted -> replay` idempotency scenario against Postgres and Redis using the seed user/project data. |  |  |
| TASK-022 | Add `src/lib/adapters/postgres-redis.conflict.smoke.ts` that validates `checkAndClaim(...)` returns conflict when the Redis lock seed is present. |  |  |
| TASK-023 | Add machine tests for `usageMachine` covering granted and rejected branches. |  |  |
| TASK-024 | Add machine tests for `idempotencyCoordinatorMachine` covering claimed, replay, and conflict branches. |  |  |
| TASK-025 | Add machine tests for `streamTransportMachine` covering success, failure, timeout, and disconnect terminal paths. |  |  |
| TASK-026 | Add machine tests for `persistenceBatchMachine` covering flush retry, finalize success, and finalize failure. |  |  |
| TASK-027 | Add at least one root actor happy-path integration test and one root actor failure-path integration test. |  |  |

### Implementation Phase 6

- **GOAL-006**: Make the GO gate executable through scripts and verification.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-028 | Update `package.json` with real `test`, `test:smoke`, and `typecheck` scripts instead of the current placeholder test command. |  |  |
| TASK-029 | Add a single backend readiness command in `package.json` that executes migration, seed, typecheck, smoke tests, and machine tests in deterministic order. |  |  |
| TASK-030 | Update `docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md` by marking each BE item with the outcome from completed implementation work. |  |  |
| TASK-031 | Add a short execution section to `docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md` documenting the exact command sequence required to assert `GO`. |  |  |

## 3. Alternatives

- **ALT-001**: Implement the backend entrypoint first and postpone root actor wiring. Rejected because it would push orchestration into transport code and violate the XState-first boundary.
- **ALT-002**: Add tests before runtime wiring. Rejected because current machines are not yet executed end-to-end and early tests would mostly validate placeholders.
- **ALT-003**: Move directly to frontend integration using the current machine skeleton. Rejected because the backend still fails the current GO checklist on orchestration, persistence completeness, and tests.

## 4. Dependencies

- **DEP-001**: `xstate` v5 APIs already installed in `package.json`.
- **DEP-002**: `pg` runtime already installed in `package.json`.
- **DEP-003**: `ioredis` runtime already installed in `package.json`.
- **DEP-004**: Postgres reachable through `DATABASE_URL` for smoke tests.
- **DEP-005**: Redis reachable through `UPSTASH_REDIS_URL` for smoke tests.
- **DEP-006**: Existing seed files in `db/seeds/` for user/project and Redis conflict setup.

## 5. Files

- **FILE-001**: `src/lib/machines/generation-system.machine.ts` — root orchestration runtime wiring.
- **FILE-002**: `src/lib/machines/request-gateway.machine.ts` — gateway runtime alignment as needed.
- **FILE-003**: `src/lib/machines/usage.machine.ts` — transition tests.
- **FILE-004**: `src/lib/machines/idempotency-coordinator.machine.ts` — transition tests.
- **FILE-005**: `src/lib/machines/stream-transport.machine.ts` — terminal path tests.
- **FILE-006**: `src/lib/machines/persistence-batch.machine.ts` — persistence tests.
- **FILE-007**: `src/lib/machines/tool-workflow.machine.ts` — workflow integration.
- **FILE-008**: `src/lib/machines/extraction-chain.machine.ts` — extraction integration.
- **FILE-009**: `src/lib/machines/runtime.ts` — root actor bootstrap.
- **FILE-010**: `src/lib/runtime/request-contract.ts` — backend request mapping.
- **FILE-011**: `src/lib/runtime/error-contract.ts` — backend error mapping.
- **FILE-012**: `src/lib/runtime/stream-contract.ts` — stream serialization.
- **FILE-013**: `src/lib/runtime/backend-session.ts` — executable backend session runtime.
- **FILE-014**: `src/lib/runtime/index.ts` — backend runtime exports.
- **FILE-015**: `src/lib/adapters/generation.adapters.ts` — adapter contract evolution.
- **FILE-016**: `src/lib/adapters/postgres-redis.interfaces.ts` — repository contract evolution.
- **FILE-017**: `src/lib/adapters/postgres-redis.production.ts` — real Postgres/Redis completion.
- **FILE-018**: `db/migrations/*.sql` — schema completion for accounting.
- **FILE-019**: `db/seeds/*.sql` and `db/seeds/*.sh` — smoke test readiness.
- **FILE-020**: `package.json` — executable verification scripts.
- **FILE-021**: `docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md` — GO gate status source of truth.

## 6. Testing

- **TEST-001**: Root actor happy-path integration test: request accepted, stream success, persistence success, terminal completed.
- **TEST-002**: Root actor replay integration test: idempotency replay skips stream and returns completed with cached content.
- **TEST-003**: Root actor conflict integration test: Redis lock present returns failure path with `idempotency_conflict`.
- **TEST-004**: Usage machine unit test: granted branch.
- **TEST-005**: Usage machine unit test: rejected branch.
- **TEST-006**: Idempotency machine unit test: claimed branch.
- **TEST-007**: Idempotency machine unit test: replay branch.
- **TEST-008**: Idempotency machine unit test: conflict branch.
- **TEST-009**: Stream transport unit test: complete branch.
- **TEST-010**: Stream transport unit test: fail/timeout/disconnect branches.
- **TEST-011**: Persistence batch unit test: flush retry path.
- **TEST-012**: Persistence batch unit test: finalize success/failure paths.
- **TEST-013**: Real smoke test using `DATABASE_URL` and `UPSTASH_REDIS_URL` with seeded `seed-user-001` and `seed-project-001`.

## 7. Risks & Assumptions

- **RISK-001**: Root machine wiring may reveal missing intermediate events or missing context fields not obvious in the passive skeleton.
- **RISK-002**: Completing accounting may require expanding the adapter input contracts and touching multiple machines.
- **RISK-003**: SSE/backend transport design may need one additional contract refinement once the frontend consumption pattern is known.
- **ASSUMPTION-001**: Current canonical event names in `src/lib/types/xstate.ts` are stable enough to be used as the backend integration contract.
- **ASSUMPTION-002**: Existing Postgres schema names `users`, `projects`, `artifacts`, `quota_history`, and `request_idempotency` remain valid.
- **ASSUMPTION-003**: The frontend integration will consume the backend through one request entrypoint and one ordered stream contract.

## 8. Related Specifications / Further Reading

[docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md](docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md)
[docs/specifications/xstate-system-as-is/generation-system-machine-spec.md](docs/specifications/xstate-system-as-is/generation-system-machine-spec.md)
[docs/specifications/xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md](docs/specifications/xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md)
[docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md](docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md)
