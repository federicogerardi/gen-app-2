---
goal: Adopt Kysely as typed SQL builder in backend adapters, replacing manual raw query construction with schema-driven query building
version: 1.0
date_created: 2026-06-02
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
owner: Backend Platform
status: completed
type: implementation-plan
tags: [feature, backend, kysely, sql, adapters, persistence, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a phased adoption of [Kysely](https://kysely.dev/) (typed SQL builder) for PostgreSQL in the backend adapter layer. The migration targets the ~69 raw `pg.query()` and `client.query()` calls across 12 production adapter files, replacing manual string concatenation patterns (`string[]` + `.push()` + `.join()`), manual parameter indexing (`$1..$N`), and raw template literal SQL with Kysely's typed query builder API.

This is candidate #2 in `docs/02-design/specifications/dependency-unification-proposal.md`, following the completed Zod backend adoption (candidate #1).

## Scope

**In scope:**
- All adapter files under `apps/backend/src/lib/adapters/` that construct raw SQL
- The utility file `postgres-redis.sql.utils.ts` (quoteIdentifier, buildQualifiedTableName, withTransaction)
- Type definitions for Kysely `DB` interface extracted from existing row types
- Migration of `pg.query()` calls to Kysely's `db.selectFrom(...)`, `db.insertInto(...)`, `db.updateTable(...)`, `db.deleteFrom(...)`
- Transaction migration from `withTransaction(...)` to `db.transaction().execute(...)`
- Inline raw SQL escape hatch via `sql\`...\`` template tag for unsupported constructs

**Out of scope (Phase 1):**
- Smoke test files (`postgres-redis.smoke.ts`, `postgres-redis.query.smoke.ts`, `postgres-redis.conflict.smoke.ts`)
- Handler files under `runtime/auth-http/` (they delegate to adapters; no SQL changes needed)
- Frontend or shared packages
- Database migration files or schema changes

## 1. Requirements & Constraints

- **REQ-001**: Replace all raw `pg.query()` calls in the target adapter file with Kysely query builder equivalents. Do not mix raw SQL and Kysely in the same adapter class after its wave is complete.
- **REQ-002**: Define a single `DB` interface type that models all tables referenced by migrated adapters. Keep it in a shared location under `apps/backend/src/lib/adapters/`.
- **REQ-003**: Preserve the existing `PersistenceRepositoryOptions` constructor pattern (schema/table name configuration) and map it to Kysely's schema-qualified table references.
- **REQ-004**: Preserve all existing adapter interface contracts (`ArtifactQueryRepository`, `ArtifactRepository`, `AuthUserRepository`, etc.). Kysely migration is an internal implementation detail.
- **REQ-005**: Preserve all runtime behavior including transaction atomicity, row locking (`SELECT...FOR UPDATE`), upsert conflict resolution, CTE + LATERAL joins, and cursor-based pagination.
- **REQ-006**: Use Kysely's `sql` template tag as an escape hatch for PostgreSQL-specific constructs (e.g., `BOOL_OR`, `COALESCE` casts, `JSONB` operations) where the query builder API is insufficient. Mark each escape hatch with a comment explaining why the builder API could not express the construct.
- **REQ-007**: Do not change the `pg` driver dependency. Kysely works with `pg` Pool via `PostgresDialect`.
- **SEC-001**: Preserve parameterized query semantics. No raw string interpolation of user-controlled values in Kysely `sql` template tags.
- **SEC-002**: No SQL injection vectors introduced. Kysely's query builder is injection-safe by design, but `sql` template tag escape hatches must use Kysely's parameterized `sql\`...\`` binding (not template literal interpolation).
- **CON-001**: Any dependency-manifest change must follow workspace dependency governance: regenerate lockfiles via npm only.
- **CON-002**: The required dependency verification sequence after adding Kysely: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`.
- **CON-003**: `packages/domain` must remain framework-agnostic. Do not import Kysely types into domain or contracts packages.
- **CON-004**: Keep migration incremental by adapter file/wave. Do not attempt monorepo-wide SQL refactor in one phase.
- **CON-005**: Each adapter wave must maintain existing test coverage. No existing test may be removed or reduced in scope.
- **GUD-001**: Favor Kysely's typed query builder over `sql` template tags. Use `sql` only when the builder lacks equivalent API surface.
- **GUD-002**: Model the `DB` interface types closely after existing `ArtifactRow`, `UserRow`, `SessionRow` and similar row types already defined in `postgres-redis.shared.types.ts` and adjacent type modules.
- **GUD-003**: Reuse `sql\`type\`` and Kysely's `Generated`, `GeneratedAlways`, `ColumnType` for computed/generated columns.

## 2. Implementation Steps

### Implementation Phase 0 — Dependency & Foundation

- GOAL-000: Add Kysely dependency, create the shared `DB` type interface, and establish the Kysely dialect instance factory.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Add `kysely` to `apps/backend/package.json` dependencies. Pin to latest stable v0.27.x. Do not hand-edit lockfiles. | yes | 2026-06-02 |
| TASK-001 | Regenerate workspace lockfiles: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`. | yes | 2026-06-02 |
| TASK-002 | Create `apps/backend/src/lib/adapters/postgres-kysely.types.ts` with the `DB` interface type mapping. Model all tables used by production adapters: `artifacts`, `users`, `sessions`, `oauth_states`, `projects`, `api_services`, `api_service_tool_step_bindings`, `quota_history`, `user_reports`, `user_report_github_links`, `product_changelog`, `llm_models`. Use existing `ArtifactRow`, `ApiServiceRow`, etc. as source of truth. | yes | 2026-06-02 |
| TASK-003 | Create `apps/backend/src/lib/adapters/postgres-kysely.dialect.ts` exporting a factory `createKyselyDb(pool: Pool): Kysely<DB>` that wraps `pg` Pool via `PostgresDialect`. Accept the same `PersistenceRepositoryOptions` pattern for schema-qualified table resolution. | yes | 2026-06-02 |
| TASK-004 | Run `npm --workspace apps/backend run typecheck` to confirm the Kysely dependency and type definitions compile. | yes | 2026-06-02 |
| TASK-005 | Run `npm --workspace apps/backend run build` and `npm run test` to confirm no regressions from the dependency addition alone. | yes | 2026-06-02 |

Completion Criteria:
- CC-000: `apps/backend/package.json` includes `kysely`, lockfiles are npm-regenerated.
- CC-001: `postgres-kysely.types.ts` models all required tables with correct column types, nullable markers, and JSONB typing.
- CC-002: `createKyselyDb(pool)` returns a functional `Kysely<DB>` instance.
- CC-003: Backend typecheck and test suite pass after Phase 0.

### Implementation Phase 1 — Pilot: PostgresArtifactQueryRepository (CTE + LATERAL)

- GOAL-001: Migrate the most complex adapter file first (`postgres.artifact-query.repository.ts`) to validate Kysely's capability with CTE, LATERAL JOIN, dynamic projection, and cursor pagination.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-100 | In `PostgresArtifactQueryRepository`, add a private `db: Kysely<DB>` instance initialized via `createKyselyDb(this.pg)`. Keep the existing `pg: Pool` field for backward compatibility until the wave completes. | yes | 2026-06-02 |
| TASK-101 | Migrate `listArtifacts(filters)` — replace dynamic WHERE array + `join(' AND ')` + `LIMIT` with `db.selectFrom('artifacts').selectAll().where(...).limit(...).execute()`. Use conditional `.where()` chains matching the existing filter logic. | yes | 2026-06-02 |
| TASK-102 | Migrate `getArtifactDetail(id, projection)` — replace `buildProjectedDetailSelect()` string join with conditional `.select()` chain. Use Kysely's dynamic `.select()` with `sql\`NULL::jsonb\`` and `sql\`''::text\`` for excluded columns. | yes | 2026-06-02 |
| TASK-103 | Migrate `listSessionSummaries(filters, cursor, limit)` — the most complex query. **Build the dynamic `WHERE` clause first** as a query builder variable (`const where = (eb: ExpressionBuilder<DB, 'artifacts'>) => eb.and([...])`), then pass it to `db.with('grouped', (qb) => qb.selectFrom('artifacts').where(where).select(...).groupBy(...))`. Then chain `db.with('grouped', ...).selectFrom('grouped').leftJoinLateral(...)`. Use `sql\`BOOL_OR(...)\`` escape hatch. Translate cursor pagination via `sql\`...\`` or `.where()` chains. | yes | 2026-06-02 |
| TASK-104 | Migrate remaining methods: `listCompletedBySession`, `listCompletedByContext`, `listCompletedByStepKey`. Each follows simpler WHERE + ORDER BY + LIMIT patterns. | yes | 2026-06-02 |
| TASK-105 | Remove the private `pg: Pool` field reference from this repository after full migration. Keep the constructor parameter for interface compatibility; delegate exclusively through `db`. | yes | 2026-06-02 |
| TASK-106 | Verify all 11+ queries in this file produce equivalent SQL results. Run the existing artifact query backend tests. | yes | 2026-06-02 |

Completion Criteria:
- CC-100: `PostgresArtifactQueryRepository` no longer uses `this.pg.query(...)` directly.
- CC-101: CTE + LATERAL query (`listSessionSummaries`) returns identical results for known input sets.
- CC-102: Dynamic projection (`getArtifactDetail` with `includeInput`/`includeContent` flags) works correctly.
- CC-103: Cursor pagination still produces deterministic `hasMore` semantics and correct slicing.
- CC-104: All existing artifact query backend tests remain green.

### Implementation Phase 2 — Auth Production (PostgresAuthUserRepository, PostgresAuthSessionRepository, PostgresOAuthStateRepository)

- GOAL-002: Migrate `auth.production.ts` — the file with the highest query count (16 queries), dynamic SET clauses, and 3 repository classes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-200 | Refactor each repository class (`PostgresAuthUserRepository`, `PostgresAuthSessionRepository`, `PostgresOAuthStateRepository`) to accept a `Kysely<DB>` instance instead of/alongside the raw `Pool`. | yes | 2026-06-02 |
| TASK-201 | Migrate `PostgresAuthUserRepository` methods: `findById`, `findByEmail`, `createUser` (INSERT...RETURNING), `updateUser` (dynamic SET with `set(obj)` partial update), `listUsers` (dynamic WHERE). The dynamic SET pattern is the critical migration — replace `string[]` + `$index++` with Kysely's `.set({ field: value })` conditional chain. | yes | 2026-06-02 |
| TASK-202 | Migrate `PostgresAuthSessionRepository` methods: `createSession`, `findSessionById`, `updateSession`, `revokeUserSessions` (dynamic WHERE), `deleteExpiredSessions`. | yes | 2026-06-02 |
| TASK-203 | Migrate `PostgresOAuthStateRepository` methods: `saveOAuthState` (INSERT...ON CONFLICT), `consumeOAuthState` (SELECT + DELETE). | yes | 2026-06-02 |
| TASK-204 | Remove raw `pg.query()` calls and manual parameter indexing from all three classes. | yes | 2026-06-02 |
| TASK-205 | Run auth-specific backend tests to confirm login, session, OAuth, and admin CRUD flows remain green. | yes | 2026-06-02 |

Completion Criteria:
- CC-200: All 16 queries in `auth.production.ts` use Kysely query builder.
- CC-201: Dynamic SET pattern no longer uses manual `$index++` or `assignments.push(...)`.
- CC-202: All auth HTTP runtime tests (login, session, CRUD, OAuth) remain green.

### Implementation Phase 3 — PostgresArtifactRepository (Complex Upsert)

- GOAL-003: Migrate `postgres.artifact.repository.ts` — the core write path with complex `INSERT...ON CONFLICT DO UPDATE` + `COALESCE` + `CASE` + conditional `WHERE` on conflict. Contains 5 queries total (1 `pg.query` + 4 `client.query` inside transactions).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-300 | Replace the upsert query in `saveArtifact` with Kysely's `insertInto(...).values(...).onConflict(...).doUpdateSet(...).where(...).returning(...)`. Use `ref` to reference `EXCLUDED` pseudo-table and target table columns. | yes | 2026-06-02 |
| TASK-301 | Use `sql\`COALESCE(EXCLUDED.x, ref("x"))\`` for conditional field preservation where Kysely's `doUpdateSet` API does not support expressions in value positions. | yes | 2026-06-02 |
| TASK-302 | Migrate the secondary `INSERT INTO quota_history` (inside the same transaction) to Kysely. | yes | 2026-06-02 |
| TASK-303 | Migrate remaining simple queries in the file (SELECT, simple INSERT). | yes | 2026-06-02 |
| TASK-304 | Replace `withTransaction(...)` with `db.transaction().execute(async (trx) => { ... })`. | yes | 2026-06-02 |
| TASK-305 | Run artifact persistence tests. | yes | 2026-06-02 |

Completion Criteria:
- CC-300: Upsert preserves existing conflict-resolution behavior: `COALESCE` semantics, `CASE` status guard, conditional `WHERE` on conflict.
- CC-301: Transaction atomicity preserved — quota_history insert rolls back if artifact insert fails.
- CC-302: All artifact persistence tests remain green.

### Implementation Phase 4 — Idempotency + Usage (Row Locking)

- GOAL-004: Migrate `postgres-redis.idempotency.repository.ts` and `postgres-redis.usage.repository.ts`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-400 | Migrate idempotency repository: `INSERT...ON CONFLICT DO NOTHING RETURNING`, `UPDATE`, `SELECT...WHERE...LIMIT 1`. | yes | 2026-06-02 |
| TASK-401 | Migrate usage repository: `SELECT...FOR UPDATE` via Kysely's `.forUpdate()`, conditional `UPDATE...SET` with `WHERE monthly_used < monthly_quota` (2 queries total in this file). | yes | 2026-06-02 |
| TASK-402 | Migrate transaction usage from `withTransaction(...)` to `db.transaction().execute(...)`. | yes | 2026-06-02 |
| TASK-403 | Run idempotency and usage backend tests. | yes | 2026-06-02 |

Completion Criteria:
- CC-400: Idempotency `INSERT...ON CONFLICT DO NOTHING` correctly returns `undefined` on conflict.
- CC-401: Usage `SELECT...FOR UPDATE` acquires row lock and prevents concurrent quota overshoot.
- CC-402: All idempotency and usage backend tests remain green.

### Implementation Phase 5 — API Service + LLM Model Adapters

- GOAL-005: Migrate `api-service.adapter.ts` and `llm-model.adapter.ts` — dynamic SET on 18+ fields and manual transaction handling.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-500 | Migrate `api-service.adapter.ts`: all 9 queries including INSERT...RETURNING, UPDATE...RETURNING, DELETE, dynamic SET (18 fields) via `.set()` conditional chain, JSONB casts via `sql\`...::jsonb\``. | yes | 2026-06-02 |
| TASK-501 | Migrate `llm-model.adapter.ts`: 5 queries total including INSERT...RETURNING, dynamic SET, manual `BEGIN`/`COMMIT`/`ROLLBACK` transaction. Replace raw transaction with `db.transaction().execute(...)`. | yes | 2026-06-02 |
| TASK-502 | Run API service and LLM model backend tests. | yes | 2026-06-02 |

Completion Criteria:
- CC-500: Dynamic SET for 18+ ApiService fields no longer uses manual parameter indexing.
- CC-501: LLM model default-swap transaction preserves atomicity.
- CC-502: All API service and LLM model backend tests remain green.

### Implementation Phase 6 — Remaining Simple Adapters

- GOAL-006: Migrate the remaining simpler adapters: `postgres.project-query.repository.ts`, `postgres.project-ownership.repository.ts`, `user-report.adapter.ts`, `user-report-github-link.adapter.ts`, `product-changelog.adapter.ts`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-600 | Migrate `postgres.project-query.repository.ts` (3 queries). | yes | 2026-06-02 |
| TASK-601 | Migrate `postgres.project-ownership.repository.ts` (1 trivial query). | yes | 2026-06-02 |
| TASK-602 | Migrate `user-report.adapter.ts` (4 queries, dynamic WHERE + SET). | yes | 2026-06-02 |
| TASK-603 | Migrate `user-report-github-link.adapter.ts` (4 queries, manual transaction). | yes | 2026-06-02 |
| TASK-604 | Migrate `product-changelog.adapter.ts` (5 simple CRUD queries). | yes | 2026-06-02 |
| TASK-605 | Run all backend tests to confirm no regressions. | yes | 2026-06-02 |

Completion Criteria:
- CC-600: All production adapter `.ts` files under `apps/backend/src/lib/adapters/` use Kysely for SQL queries.
- CC-601: Zero `pg.query()` calls remain in production adapter files.
- CC-602: All backend tests pass.

### Implementation Phase 7 — Cleanup & Governance

- GOAL-007: Remove legacy SQL utilities, update dependency proposal, and finalize the migration.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-700 | Re-evaluate `postgres-redis.sql.utils.ts`: remove `quoteIdentifier` and `buildQualifiedTableName` (replaced by Kysely). Keep `nowDate` and `randomId` if still referenced by non-migrated consumers. | yes | 2026-06-02 |
| TASK-701 | Re-evaluate `withTransaction(...)`: if zero callers remain after migration, remove it. | yes | 2026-06-02 |
| TASK-702 | Run workspace dependency-determinism commands if the dependency manifest was not yet run after the initial Kysely addition. | yes | 2026-06-02 |
| TASK-703 | Update `docs/02-design/specifications/dependency-unification-proposal.md` to mark Kysely (candidate #2) as implemented. | yes | 2026-06-02 |
| TASK-704 | Update this plan's status to `Completed`. | yes | 2026-06-02 |

Completion Criteria:
- CC-700: `quoteIdentifier` and `buildQualifiedTableName` are removed or have zero callers in production code.
- CC-701: `withTransaction` is removed or has zero callers in production code.
- CC-702: Monorepo typecheck, test, and build all pass with Kysely as the only SQL builder.
- CC-703: Dependency unification proposal is updated.

## 3. Kysely DB Type Interface (Template)

```typescript
// apps/backend/src/lib/adapters/postgres-kysely.types.ts

import type { ColumnType, Generated } from 'kysely';

export interface ArtifactsTable {
  id: Generated<string>;
  request_id: string;
  user_id: string;
  project_id: string;
  type: string;
  status: string;
  model: string | null;
  workflow_type: string | null;
  session_id: string | null;
  step_key: string | null;
  artifact_role: string | null;
  run_mode: string | null;
  input_json: Record<string, unknown> | null;
  content: string | null;
  failure_reason: string | null;
  created_at: ColumnType<Date, string, string>;
  updated_at: ColumnType<Date, string, string>;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: Generated<boolean>;
  last_login_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// Additional tables: sessions, oauth_states, projects, api_services,
// api_service_tool_step_bindings, quota_history, user_reports,
// user_report_github_links, product_changelog, llm_models

export interface DB {
  artifacts: ArtifactsTable;
  users: UsersTable;
  // ... remaining tables
}
```

**Schema resolution note**: The `DB` interface types do not include schema qualifiers. Schema is applied at the builder level via `db.withSchema(options.schema)` per query (see ASSUMPTION-002). This keeps the type definition independent of deployment-specific schema naming.

## 4. Alternatives

- **ALT-001**: Keep current raw SQL approach and add more utility helpers around `pg.query()`. Rejected because it preserves the documented duplication problem — dynamic WHERE/SET construction via string concatenation remains fragile, untested at the type level, and prone to parameter mismatch.
- **ALT-002**: Adopt a full ORM like Prisma or Drizzle. Rejected because Kysely provides typed query building without requiring a schema generation step, CLI tooling, or migration from the existing `pg` driver. Kysely is a library, not a framework — lower migration risk.
- **ALT-003**: Adopt Kysely only in new code paths and leave existing adapters on raw SQL. Rejected because it creates a permanent two-query-style maintenance burden and leaves the documented unification goal incomplete.
- **ALT-004**: Use Kysely's raw `sql` template tag everywhere as a thin wrapper over existing queries. Rejected because it bypasses typed query building and does not eliminate manual parameter indexing or string concatenation.

## 5. Dependencies

- **DEP-001**: `docs/02-design/specifications/dependency-unification-proposal.md` as the authoritative proposal ranking Kysely as candidate #2.
- **DEP-002**: Existing row types in `apps/backend/src/lib/adapters/postgres-redis.shared.types.ts` as the source of truth for `DB` interface columns.
- **DEP-003**: Existing adapter interfaces in `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts` — the public contracts that must remain unchanged.
- **DEP-004**: Existing file `apps/backend/src/lib/adapters/postgres-redis.sql.utils.ts` — to be partially removed after migration.
- **DEP-005**: Existing test files under `apps/backend/src/lib/tests/` — regression gates for each migrated adapter.
- **DEP-006**: Workspace dependency and lockfile governance in `AGENTS.md`.

## 6. Files

- **FILE-000**: `apps/backend/package.json` — add `kysely` dependency.
- **FILE-001**: `package-lock.json` — regenerated after dependency change.
- **FILE-002**: `apps/frontend/package-lock.json` — regenerated if workspace graph requires.
- **FILE-003**: `apps/backend/src/lib/adapters/postgres-kysely.types.ts` — new `DB` interface type.
- **FILE-004**: `apps/backend/src/lib/adapters/postgres-kysely.dialect.ts` — new dialect factory.
- **FILE-005**: `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts` — Phase 1 migration target.
- **FILE-006**: `apps/backend/src/lib/adapters/auth.production.ts` — Phase 2 migration target.
- **FILE-007**: `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` — Phase 3 migration target.
- **FILE-008**: `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts` — Phase 4 migration target.
- **FILE-009**: `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts` — Phase 4 migration target.
- **FILE-010**: `apps/backend/src/lib/adapters/api-service.adapter.ts` — Phase 5 migration target.
- **FILE-011**: `apps/backend/src/lib/adapters/llm-model.adapter.ts` — Phase 5 migration target.
- **FILE-012**: `apps/backend/src/lib/adapters/postgres.project-query.repository.ts` — Phase 6 migration target.
- **FILE-013**: `apps/backend/src/lib/adapters/postgres.project-ownership.repository.ts` — Phase 6 migration target.
- **FILE-014**: `apps/backend/src/lib/adapters/user-report.adapter.ts` — Phase 6 migration target.
- **FILE-015**: `apps/backend/src/lib/adapters/user-report-github-link.adapter.ts` — Phase 6 migration target.
- **FILE-016**: `apps/backend/src/lib/adapters/product-changelog.adapter.ts` — Phase 6 migration target.
- **FILE-017**: `apps/backend/src/lib/adapters/postgres-redis.sql.utils.ts` — Phase 7 cleanup target.
- **FILE-018**: `docs/02-design/specifications/dependency-unification-proposal.md` — Phase 7 update target.

## 7. Testing

- **TEST-000**: After each phase, run `npm --workspace apps/backend run typecheck` to confirm TypeScript compilation.
- **TEST-001**: After each phase, run `node --import tsx --test <narrowest-test-file-for-migrated-adapter>` to confirm targeted regression gates.
- **TEST-002**: After each phase, run `npm --workspace apps/backend run test` to confirm full backend suite.
- **TEST-003**: After Phase 0 (dependency addition), run the full dependency-governance sequence: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`.
- **TEST-004**: After Phase 7 (cleanup), run `npm run typecheck && npm run test && npm run build` from root to confirm monorepo health.
- **TEST-005**: After full migration, grep `apps/backend/src/lib/adapters/` for `\.query\(` and `pg\.query` to confirm zero raw SQL calls remain in production adapters.

## 8. Risks & Assumptions

- **RISK-001**: Kysely v0.27+ `with()` (CTE) and `leftJoinLateral`/`innerJoinLateral`/`crossJoinLateral` are all natively supported in the public API (verified via Kysely docs and TypeScript definitions). Risk is low, but Phase 1 still serves as the validation gate to confirm generated SQL matches expected behavior for the most complex query in the codebase. If any gap is discovered, fall back to `sql` template tag for that specific clause.
- **RISK-002**: Kysely's `onConflict...doUpdateSet` may not support expressions like `COALESCE(EXCLUDED.x, table.x)`. Mitigation: Phase 3 validates upsert translation. Use `sql` template tag within `doUpdateSet` if builder API is insufficient.
- **RISK-003**: The `DB` interface type may grow large (~12 tables) and require maintenance as the schema evolves. Mitigation: locate the type file alongside adapters, not in shared packages, to keep schema drift localized and manageable.
- **RISK-004**: Transaction semantics may subtly differ between raw `BEGIN`/`COMMIT`/`ROLLBACK` and Kysely's `db.transaction().execute()`. Mitigation: Phase 3/4 transaction migrations include explicit rollback tests.
- **RISK-005**: Performance regression from Kysely's generated SQL compared to hand-tuned raw queries. Mitigation: Kysely produces deterministic SQL that is structurally equivalent to the current manual queries. If a specific query shows regression, use `sql` escape hatch with the original SQL.
- **ASSUMPTION-001**: The `pg` Pool instance currently passed to repository constructors can be wrapped in a `PostgresDialect` without behavioral changes.
- **ASSUMPTION-002**: Existing `PersistenceRepositoryOptions` (schema/table name configuration) maps cleanly to Kysely. **Note**: Kysely's `db.withSchema('schema_name')` is scoped to the query builder it's called on and does not persist on the `db` instance. For repositories that currently resolve table names via `buildQualifiedTableName(schema, table)`, the migration strategy is: (a) when the repository instantiates the Kysely builder, call `db.withSchema(options.schema)` once per query, OR (b) pass `'schema.table'` directly as the table identifier (Kysely supports this for the `selectFrom`/`insertInto`/etc. methods when the dialect is configured with `createTableNode` correctly). The preferred approach is (a) to keep schema resolution explicit.
- **ASSUMPTION-003**: Kysely's `.returning()` API covers all `RETURNING *` and `RETURNING id` patterns currently used.
- **ASSUMPTION-004**: Each adapter wave's test coverage is adequate to catch behavioral regressions. **If a wave reveals insufficient test coverage for any migrated query, new test cases must be added in the same wave before the wave is considered complete.** Use the existing test files under `apps/backend/src/lib/tests/` as anchors.
- **ASSUMPTION-005**: Kysely's `.forUpdate()` works inside transactions — the usage repository's `SELECT...FOR UPDATE` + `UPDATE` flow is a standard PostgreSQL pattern.

## 9. Related Specifications / Further Reading

[docs/02-design/specifications/dependency-unification-proposal.md](../docs/02-design/specifications/dependency-unification-proposal.md)
[docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[plan/feature-zod-backend-unification-1.md](../plan/feature-zod-backend-unification-1.md)
[AGENTS.md](../AGENTS.md)
