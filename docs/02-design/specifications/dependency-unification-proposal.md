---
status: proposed
version: 1.0
last-reviewed: 2026-05-29
next-review-date: 2026-08-29
owner: Frontend Platform Team
---

# Dependency Unification Proposal

## Objective

Introduce one dependency slot focused on code unification and simplification, with a ranked shortlist of three candidate dependencies and an implementation path that minimizes disruption.

## DDD And Architecture Alignment

- This proposal does not introduce new domain concepts.
- It preserves the existing bounded-context ownership model: Generation, Auth, Usage/Quota, Frontend/UI.
- It targets infrastructure and application-layer duplication reduction only.

## As-Is Evidence (Duplication Hotspots)

1. Frontend runtime response parsing and envelope normalization are manually repeated in Admin and tool clients.
   - Evidence: `apps/frontend/src/features/admin/runtime/admin-client.ts`
2. Backend handler input parsing and coercion are manually repeated before validation.
   - Evidence: `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`
3. Backend query construction relies on string-built SQL patterns repeated across adapters.
   - Evidence: `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts`

## Ranked Shortlist (Top 3)

### 1. Zod in Backend (recommended first)

Why:

- Frontend already uses Zod extensively; extending it to backend request parsing creates one validation language across FE and BE.
- Replaces many manual parse helpers (`parse*`, `asRecordOrDefault`, `asArrayOrDefault`) with schema-based coercion and typed output.

Expected unification impact:

- Single schema-driven contract boundary for HTTP handlers.
- Lower drift risk between frontend and backend payload assumptions.
- Better testability with deterministic parse errors.

Initial rollout scope:

- `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`
- Adjacent handler payload modules in `apps/backend/src/lib/runtime/auth-http/`
- Shared schema exports in `packages/contracts` when request/response boundaries are cross-context.

### 2. Kysely (typed SQL builder) in Backend adapters

Why:

- Reduces repeated string concatenation patterns for `WHERE`, `SET`, pagination clauses, and join-heavy list queries.
- Improves type safety in adapter-level projections.

Expected unification impact:

- One query-construction style across repositories.
- Fewer fragile manual SQL assembly branches.

Initial rollout scope:

- `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts`
- Followed by `auth.production.ts` and other query-heavy adapters.

### 3. Ky in Frontend HTTP runtime

Why:

- Standardizes retry/timeouts/hooks and JSON handling around `fetch` with lower boilerplate.
- Keeps existing domain clients while simplifying the transport layer.

Expected unification impact:

- One consistent HTTP transport behavior for all frontend clients.
- Reduced repeated request/error handling patterns.

Initial rollout scope:

- `apps/frontend/src/app/runtime/http-client.ts`
- Incremental migration of feature clients already using `requestJson`/`requestVoid`.

## Recommendation

If only one additional dependency slot is available now, adopt **Zod in backend first**.

Selection rationale:

- Highest unification return with the lowest migration risk.
- Immediate simplification in active handler codepaths.
- Natural extension of an already adopted frontend validation stack.

## Proposed Delivery Plan

1. Phase 1 (pilot): add backend Zod schemas for one admin HTTP surface and replace manual parsing in that surface.
2. Phase 2 (convergence): extract reusable schema helpers and align shared contracts where relevant.
3. Phase 3 (hardening): extend schema coverage to remaining handler groups and enforce typed parse boundaries in tests.

## Acceptance Criteria

- At least one backend HTTP handler cluster no longer uses manual parse helper chains for request bodies.
- FE/BE payload validation behavior is documented and test-covered for migrated endpoints.
- No regressions in existing `typecheck`, `test`, and `build` workflows.

## Risks And Controls

- Risk: mixed validation styles during migration.
  - Control: migrate by handler cluster and keep clear schema ownership per endpoint family.
- Risk: overreach into unrelated refactors.
  - Control: limit each phase to one bounded surface and preserve current runtime behavior.
