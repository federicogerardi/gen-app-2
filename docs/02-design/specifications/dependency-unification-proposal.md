---
status: implemented
version: 1.1
last-reviewed: 2026-06-02
next-review-date: 2026-09-02
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

### 1. Zod in Backend (✅ implemented)

**Status: Complete** — shipped across 6 waves covering all auth-http handler surfaces (admin-api-service, admin-api-service-binding, projects, admin-feedback-center, public, admin-llm-model). See `../../99-lifecycle/99-archive/plans/feature-zod-backend-unification-1.md` for execution detail.

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

### 2. Kysely (typed SQL builder) in Backend adapters (✅ implemented)

**Status: Complete** — shipped across 8 waves covering all backend production adapter surfaces. See `.opencode/plans/feature-kysely-backend-adapters-1.md` for execution detail.

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

✅ **Phase 1 (Zod in backend) is complete.** ✅ **Phase 4 (Kysely in backend adapters) is complete.** The remaining candidate is:

1. **Ky** — HTTP client for frontend HTTP runtime.

## Delivery Plan

### ✅ Phase 1 (pilot) — Complete
Add backend Zod schemas for one admin HTTP surface and replace manual parsing in that surface. Execution in `../../99-lifecycle/99-archive/plans/feature-zod-backend-unification-1.md`.

### ✅ Phase 2 (convergence) — Complete
Extract reusable schema helpers and align shared contracts where relevant.

### ✅ Phase 3 (hardening) — Complete
Extend schema coverage to remaining handler groups and enforce typed parse boundaries in tests.

### ✅ Phase 4 — Kysely adoption in backend adapters — Complete
### 🔲 Phase 5 — Ky adoption in frontend HTTP runtime

## Acceptance Criteria

- At least one backend HTTP handler cluster no longer uses manual parse helper chains for request bodies.
- FE/BE payload validation behavior is documented and test-covered for migrated endpoints.
- No regressions in existing `typecheck`, `test`, and `build` workflows.

## Risks And Controls

- Risk: mixed validation styles during migration.
  - Control: migrate by handler cluster and keep clear schema ownership per endpoint family.
- Risk: overreach into unrelated refactors.
  - Control: limit each phase to one bounded surface and preserve current runtime behavior.
