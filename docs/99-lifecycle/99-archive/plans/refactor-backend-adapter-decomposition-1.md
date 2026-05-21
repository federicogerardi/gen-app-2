---
goal: Deterministic decomposition of backend Postgres/Redis production adapter monolith to close Finding 4
version: 1.1
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Backend Architecture
status: Completed
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [refactor, architecture, backend, adapters, process]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

This plan decomposes `apps/backend/src/lib/adapters/postgres-redis.production.ts` into bounded adapter modules with deterministic wiring, stable public contracts, and unchanged runtime behavior.

## 1. Requirements & Constraints

- **REQ-001**: Preserve runtime behavior and external API contracts for all adapter consumers.
- **REQ-002**: Keep all existing exported factory signatures in `postgres-redis.production.ts` available during migration.
- **REQ-003**: Isolate each repository implementation into one dedicated file with one primary responsibility.
- **REQ-004**: Keep `GenerationRequest`, `Artifact`, and session projection behavior unchanged.
- **SEC-001**: Preserve idempotency lock semantics and Redis lock TTL behavior without regression.
- **SEC-002**: Preserve quota claim transactional guarantees and rollback behavior.
- **CON-001**: Do not introduce new external npm dependencies.
- **CON-002**: Keep migration incremental; no big-bang rename of all imports in one step.
- **GUD-001**: Follow existing naming style `postgres-redis.<concern>.repository.ts`.
- **GUD-002**: Keep SQL queries and mapping logic byte-equivalent unless explicitly changed by task.
- **PAT-001**: Apply extraction-by-seam pattern: move code first, keep a stable facade file, then switch imports.
- **PAT-002**: Validate each phase with backend typecheck and targeted tests before moving to next phase.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish decomposition skeleton and preserve stable facade exports.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/backend/src/lib/adapters/postgres-redis.shared.types.ts` and move shared local types currently defined in `postgres-redis.production.ts` (`ProjectRow`, `ArtifactRow`, repository option types, `PostgresRedisProductionClients`, `PostgresRedisProductionOptions`, `IdempotencyRow`). Update imports in `postgres-redis.production.ts` to use this file. | Yes | 2026-05-21 |
| TASK-002 | Create `apps/backend/src/lib/adapters/postgres-redis.sql.utils.ts` and move local helper functions (`quoteIdentifier`, `buildQualifiedTableName`, `withTransaction`, `nowDate`, `randomId`) from `postgres-redis.production.ts`. Re-export helper types/functions required by repository modules. | Yes | 2026-05-21 |
| TASK-003 | Keep `apps/backend/src/lib/adapters/postgres-redis.production.ts` as migration facade. Replace in-file helper/type definitions with imports only; maintain existing exports `createPostgresRedisProductionDependencies` and `createPostgresRedisProductionGenerationAdapters` unchanged. | Yes | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Extract repository implementations into bounded modules with one class per concern.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Move class `PostgresRedisUsageRepository` from `postgres-redis.production.ts` to `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts`. Keep constructor signature and method behavior identical (`claimUsage`, `recordUsageSuccess`, `recordUsageFailure`, `recordUsageRateLimited`). | Yes | 2026-05-21 |
| TASK-005 | Move class `PostgresProjectOwnershipRepository` to `apps/backend/src/lib/adapters/postgres.project-ownership.repository.ts` with unchanged method signatures and SQL. | Yes | 2026-05-21 |
| TASK-006 | Move class `PostgresRedisIdempotencyRepository` to `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts` preserving endpoint resolver, lock key, lock TTL, and conflict/replay semantics. | Yes | 2026-05-21 |
| TASK-007 | Move class `PostgresRedisStreamSessionRepository` to `apps/backend/src/lib/adapters/postgres-redis.stream.repository.ts` preserving Redis session key format and TTL behavior. | Yes | 2026-05-21 |
| TASK-008 | Move class `PostgresArtifactRepository` to `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` preserving artifact persistence SQL and normalization routines (`normalizeToolWorkflowInputJson`, `extractToolWorkflowColumns`). | Yes | 2026-05-21 |
| TASK-009 | Move class `PostgresProjectQueryRepository` to `apps/backend/src/lib/adapters/postgres.project-query.repository.ts` and class `PostgresArtifactQueryRepository` to `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts` preserving query projection behavior. | Yes | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Rewire composition, remove dead code from monolith, and guarantee behavioral parity.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Update `apps/backend/src/lib/adapters/postgres-redis.production.ts` to import extracted repositories and keep only assembly logic. Remove duplicated class implementations from this file after imports compile cleanly. | Yes | 2026-05-21 |
| TASK-011 | Ensure `createPostgresRedisProductionDependencies` wiring in `postgres-redis.production.ts` instantiates extracted classes with identical constructor arguments and option paths. | Yes | 2026-05-21 |
| TASK-012 | Update `apps/backend/src/lib/adapters/index.ts` exports if needed to expose new repository modules for tests and internal composition without changing public runtime entry points. | Yes | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Add focused regression coverage and validate deterministic parity.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Add/adjust backend adapter tests to ensure query repositories still return identical projections: update `apps/backend/src/lib/tests/runtime.query-mappers.test.ts` and session-related tests if imports moved. | Yes | 2026-05-21 |
| TASK-014 | Add targeted tests for wiring parity in `apps/backend/src/lib/tests/runtime.index.test.ts` ensuring production dependency factory still provides all required repositories. | Yes | 2026-05-21 |
| TASK-015 | Execute validation gate commands in order and capture outputs in implementation notes: `npm --workspace apps/backend run typecheck`; `npm --workspace apps/backend run test -- src/lib/tests/runtime.index.test.ts`; `npm --workspace apps/backend run test -- src/lib/tests/runtime.query-mappers.test.ts`; `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts`. | Yes | 2026-05-21 |

## 3. Alternatives

- **ALT-001**: Keep monolith and add only comments/regions. Rejected because it does not reduce coupling or blast radius.
- **ALT-002**: Big-bang rewrite of all adapters and interfaces. Rejected due to high regression risk and rollback complexity.
- **ALT-003**: Extract only one repository (ArtifactQuery) and stop. Rejected because finding 4 concerns multi-repository concentration, not one class.

## 4. Dependencies

- **DEP-001**: Existing adapter contracts in `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`.
- **DEP-002**: Existing SQL mapping functions in `apps/backend/src/lib/types/artifacts.ts` and `apps/backend/src/lib/types/projects.ts`.
- **DEP-003**: Existing generation adapter composition in `apps/backend/src/lib/adapters/postgres-redis.adapters.ts`.
- **DEP-004**: Existing runtime tests under `apps/backend/src/lib/tests/`.

## 5. Files

- **FILE-001**: `apps/backend/src/lib/adapters/postgres-redis.production.ts` — migration facade reduced to composition.
- **FILE-002**: `apps/backend/src/lib/adapters/postgres-redis.shared.types.ts` — extracted shared types.
- **FILE-003**: `apps/backend/src/lib/adapters/postgres-redis.sql.utils.ts` — extracted SQL/runtime utilities.
- **FILE-004**: `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts` — quota repository.
- **FILE-005**: `apps/backend/src/lib/adapters/postgres.project-ownership.repository.ts` — ownership repository.
- **FILE-006**: `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts` — idempotency repository.
- **FILE-007**: `apps/backend/src/lib/adapters/postgres-redis.stream.repository.ts` — stream session repository.
- **FILE-008**: `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` — artifact persistence repository.
- **FILE-009**: `apps/backend/src/lib/adapters/postgres.project-query.repository.ts` — project query repository.
- **FILE-010**: `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts` — artifact query repository.
- **FILE-011**: `apps/backend/src/lib/adapters/index.ts` — export alignment.
- **FILE-012**: `apps/backend/src/lib/tests/runtime.index.test.ts` — wiring parity tests.
- **FILE-013**: `apps/backend/src/lib/tests/runtime.query-mappers.test.ts` — query projection parity tests.

## 6. Testing

- **TEST-001**: Backend compile gate passes with zero errors: `npm --workspace apps/backend run typecheck`.
- **TEST-002**: Dependency factory parity test passes: `npm --workspace apps/backend run test -- src/lib/tests/runtime.index.test.ts`.
- **TEST-003**: Query mapping parity test passes: `npm --workspace apps/backend run test -- src/lib/tests/runtime.query-mappers.test.ts`.
- **TEST-004**: Auth HTTP integration regression test passes: `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts`.
- **TEST-005**: Adapter-focused smoke set passes with no import/runtime regressions after extraction.

## 7. Risks & Assumptions

- **RISK-001**: Import cycle introduction between new repository modules and shared utils.
- **RISK-002**: Silent SQL drift during copy/move operations.
- **RISK-003**: Wiring mismatch in dependency factory causing runtime missing repository errors.
- **ASSUMPTION-001**: Existing tests are sufficient to detect projection and wiring regressions.
- **ASSUMPTION-002**: No schema changes are required for this refactor.

## 8. Related Specifications / Further Reading

- `./review-architecture-severe-2026-05-21-1.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/domain-bounded-context-map.md`

## 9. Implementation Outcome

- Plan executed fully on 2026-05-21 with facade decomposition completed and repository seams extracted.
- Validation gates executed successfully:
	- `npm --workspace apps/backend run typecheck`
	- `npm --workspace apps/backend run test -- src/lib/tests/runtime.index.test.ts`
	- `npm --workspace apps/backend run test -- src/lib/tests/runtime.query-mappers.test.ts`
	- `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts`
