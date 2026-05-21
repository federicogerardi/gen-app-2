---
status: active
version: 1.6
last-reviewed: 2026-05-21
owner: Architecture Review
---

# Severe Architecture Review 2026-05-21

## Scope
- Static architecture review across Backend, Frontend/UI, and shared contracts.
- DDD-aligned terminology and bounded-context consistency checks.
- Focus on open weaknesses and residual risk after prior remediations.

## Findings (Ordered by Severity)

### 1. High — Hydration candidate scan is unbounded and ranked in memory
- Status: resolved (2026-05-21)
- Resolution summary:
  - Hydrate candidate query is now explicitly capped via dedicated scan-limit configuration and dependency wiring.
  - In-memory full-array ranking was replaced with deterministic linear best-candidate selection.
  - Regression coverage was added to assert limit propagation in hydrate path.
- Validation evidence:
  - `npm --workspace apps/backend run typecheck` passed.
  - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` passed.
- Evidence:
  - Hydrate candidate retrieval has no explicit cap in the call site:
    - `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:203` calls `listArtifactsByUser(...)` with `{ type, status, projectId }` only (no `limit`, no `offset`).
  - In briefing-coherence mode, hydrate expands the full candidate set into a second wide read:
    - `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:221` calls `getArtifactsByIdsForUser(...)` with `candidates.map(...)` over the entire candidate array.
  - Final selection is performed via in-memory ranking over all eligible rows:
    - `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:250` executes `const ranked = [...eligibleCandidates].sort(...)`.
  - Repository query only applies SQL pagination when the caller provides it:
    - `apps/backend/src/lib/adapters/postgres-redis.production.ts:1167` conditionally adds `LIMIT`.
    - `apps/backend/src/lib/adapters/postgres-redis.production.ts:1169` builds `LIMIT $...` into the query only in that branch.
  - Comparative boundary evidence (asymmetry with orchestrate path):
    - Orchestrate has a dedicated cap (`DEFAULT_TOOLS_ORCHESTRATE_ARTIFACT_SCAN_LIMIT = 1000`) in `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-config.ts:2`.
    - Hydrate handler has no equivalent scan-limit config in `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts`.
  - Operational evidence gap:
    - Backend scripts expose `bench:orchestrate` only (`apps/backend/package.json:13`); no hydrate benchmark gate is present.
- Architectural weakness:
  - Request cost scales with project history size.
  - Increased latency and memory pressure in high-volume projects.
- Impacted concepts:
  - `HydrationResult`, `ExtractionContext` (selection path stability and performance).

### 2. High — GenerationRequest contract remains permissive for core domain fields
- Status: resolved (2026-05-21)
- Resolution summary:
  - Shared contract hardened for dispatch-critical fields:
    - `model` tightened to canonical `LlmModelId` shape.
    - `tone` tightened to canonical request union (`RequestTone`) aligned with `ToneProfile` + extraction operational tone.
    - Deprecated `relaunchMode` removed from request boundary.
  - Frontend request builders and artifact/source-request mappers now normalize legacy free-form model/tone input to canonical contract values before dispatch.
  - Targeted test fixtures were updated to canonical model/tone literals.
- Validation evidence:
  - `npm run typecheck --workspaces --if-present` passed.
  - Targeted changed-test run completed with green result after fixture alignment (20/20).
- Evidence:
  - `packages/contracts/src/index.ts`: `step?: ToolStep | string`.
  - `packages/contracts/src/index.ts`: `tone?: string`.
  - `packages/contracts/src/index.ts`: `model: string`.
  - `packages/contracts/src/index.ts`: deprecated `relaunchMode` still present.
- Architectural weakness:
  - Compile-time guarantees are weak for dispatch-critical fields.
  - Correctness relies heavily on runtime normalization.
- Impacted concepts:
  - `GenerationRequest`, `ToolStep`, `ToneProfile`, `LlmModelId`.

### 3. Medium-High — Type-safety bypass through forced `as never` casts in request boundary
- Status: resolved (2026-05-21)
- Resolution summary:
  - Removed `as never` casts from request enrichment boundary and validation event mapping in `request-contract.ts`.
  - Removed `as never` cast from registry selector fallback derivation in `generation-routing.ts`.
  - Normalized registry selector scalar aliases in `xstate.ts` to concrete `string` types, eliminating cast-only bridges while preserving compatibility semantics.
- Validation evidence:
  - `npm --workspace apps/backend run typecheck` passed.
  - `npm --workspace apps/backend run test -- src/lib/tests/runtime.tool-prompts.test.ts` passed.
- Evidence:
  - Direct bypass in request boundary (`apps/backend/src/lib/runtime/request-contract.ts`):
    - `registryVersion: request.registryVersion as never`.
    - `registrySnapshotRef: request.registrySnapshotRef as never`.
    - fallback/default variants also cast through `as never` (`registrySnapshotRef`, `registryVersion`).
  - Upstream parser accepts raw string values for registry fields without semantic validation (`apps/backend/src/lib/runtime/generation-request-node.ts`):
    - `if (typeof payload.registryVersion === 'string') request.registryVersion = payload.registryVersion`.
    - `if (typeof payload.registrySnapshotRef === 'string') request.registrySnapshotRef = payload.registrySnapshotRef`.
  - Pattern is not isolated to one file: routing helper also forces selector typing with `as never` when deriving fallback snapshot ref (`apps/backend/src/lib/machines/generation-routing.ts`).
  - Runtime guard on selector presence checks only truthiness (`event.registryVersion || event.registrySnapshotRef`) and does not enforce canonical shape (`apps/backend/src/lib/machines/generation-system.guards.ts`).
  - Current focused tests around request enrichment (`apps/backend/src/lib/tests/runtime.tool-prompts.test.ts`) validate prompt/model/tone/step normalization but do not add negative coverage for invalid registry selector shape propagation.
- Architectural weakness:
  - Type system signal is reduced at a critical integration boundary.
  - Potentially masks contract drift or incorrect enrichment logic.
- Impacted concepts:
  - `GenerationRequest`, `RegistrySnapshotRef`, `RegistryVersion`.

### 4. Medium — Backend adapter concentration (monolithic infra file)
- Status: resolved (2026-05-21)
- Resolution summary:
  - Decomposed monolithic adapter into bounded repository modules and shared helper/type seams.
  - Reduced `postgres-redis.production.ts` to composition facade while preserving factory exports and wiring semantics.
  - Preserved runtime behavior for usage, ownership, idempotency, stream session, artifact persistence, and query projections.
- Validation evidence:
  - `npm --workspace apps/backend run typecheck` passed.
  - `npm --workspace apps/backend run test -- src/lib/tests/runtime.index.test.ts` passed.
  - `npm --workspace apps/backend run test -- src/lib/tests/runtime.query-mappers.test.ts` passed.
  - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` passed.
- Evidence:
  - `apps/backend/src/lib/adapters/postgres-redis.production.ts` contains multiple repositories and helper layers in one file (1600+ LOC).
  - Implemented decomposition modules:
    - `apps/backend/src/lib/adapters/postgres-redis.shared.types.ts`
    - `apps/backend/src/lib/adapters/postgres-redis.sql.utils.ts`
    - `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts`
    - `apps/backend/src/lib/adapters/postgres.project-ownership.repository.ts`
    - `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts`
    - `apps/backend/src/lib/adapters/postgres-redis.stream.repository.ts`
    - `apps/backend/src/lib/adapters/postgres.artifact.repository.ts`
    - `apps/backend/src/lib/adapters/postgres.project-query.repository.ts`
    - `apps/backend/src/lib/adapters/postgres.artifact-query.repository.ts`
- Architectural weakness:
  - High coupling and larger change blast radius.
  - Harder ownership boundaries and more fragile targeted testing.
- Impacted concepts:
  - Adapter boundary quality (`ArtifactQueryRepository`, `RedisQuotaRepository`, `RedisIdempotencyRepository`, persistence concerns).

### 5. Medium — Session client boundary inconsistency in frontend
- Status: resolved (2026-05-21)
- Resolution summary:
  - Centralized session step endpoint authority in `buildApiPaths` via `tools.sessions.byStep(sessionId, stepKey)`.
  - Removed hardcoded step path construction from `session-client.ts` and switched `getStepArtifact` to capability-driven route resolution.
  - Added fail-closed gating for step artifact calls when `sessionsDetail` capability is unavailable.
- Validation evidence:
  - `npm --workspace apps/frontend run test -- src/app/runtime/api-paths.test.ts` passed.
  - `npm --workspace apps/frontend run test -- src/features/tools/runtime/session-client.test.ts` passed.
  - `npm --workspace apps/frontend run typecheck` passed.
- Evidence:
  - `apps/frontend/src/features/tools/runtime/session-client.ts` uses capability-driven `buildApiPaths` for list/detail.
  - The same file builds step endpoint with hardcoded string path.
  - Remediation implementation:
    - `apps/frontend/src/app/runtime/api-paths.ts` now exposes `tools.sessions.byStep(...)`.
    - `apps/frontend/src/features/tools/runtime/session-client.ts` now resolves step endpoint through `buildApiPaths(capabilities).tools.sessions.byStep(...)`.
    - `apps/frontend/src/features/tools/runtime/session-client.test.ts` adds coverage for capability fail-closed and centralized step path use.
- Architectural weakness:
  - Inconsistent route authority in one module.
  - Higher drift risk when API paths evolve.
- Impacted concepts:
  - `SessionSummary`, `SessionArtifactGroup`, API boundary governance.

### 6. Medium — Incomplete quality gates for structural debt prevention
- Status: resolved (2026-05-21)
- Resolution summary:
  - Added local workspace `lint` scripts for frontend and backend, aligned with root orchestration.
  - Removed unused imports/variables surfaced by `noUnused*` checks, including session-client hygiene drift.
  - Enabled `noUnusedLocals` and `noUnusedParameters` enforcement in root, frontend, and backend TypeScript configs.
- Validation evidence:
  - `npm --workspace apps/frontend run lint` passed.
  - `npm --workspace apps/backend run lint` passed.
  - `npm run lint --workspaces --if-present` passed.
  - `npm run typecheck --workspaces --if-present` passed.
- Evidence:
  - Root `package.json` defines workspace lint orchestration.
  - `apps/frontend/package.json` and `apps/backend/package.json` have no local `lint` script.
  - `apps/frontend/src/features/tools/runtime/session-client.ts` keeps an unused import.
  - `tsconfig` files do not enforce `noUnusedLocals` / `noUnusedParameters`.
  - Remediation implementation:
    - `apps/frontend/package.json` and `apps/backend/package.json` now define local `lint` scripts.
    - `apps/frontend/src/features/tools/runtime/session-client.ts` unused import removed.
    - `tsconfig.json`, `apps/frontend/tsconfig.json`, and `apps/backend/tsconfig.json` now enforce `noUnusedLocals` and `noUnusedParameters`.
- Architectural weakness:
  - Dead code and small hygiene regressions can pass CI undetected.
- Impacted concepts:
  - CI maintainability and long-term architecture integrity.

### 7. Low-Medium — React hook dependency suppression in auth provider
- Status: resolved (2026-05-21)
- Resolution summary:
  - Removed `react-hooks/exhaustive-deps` suppression from `AuthSessionProvider` memoized context value.
  - Stabilized `login`, `logout`, and `refresh` callbacks with `useCallback`, then declared them explicitly in `useMemo` dependency array.
  - Preserved provider behavior while restoring dependency transparency for future maintenance.
- Validation evidence:
  - `npm --workspace apps/frontend run typecheck` passed.
  - `npm run typecheck --workspaces --if-present` passed.
- Evidence:
  - `apps/frontend/src/app/providers/AuthSessionProvider.tsx` disables exhaustive-deps for memoized context value.
- Architectural weakness:
  - Increased risk of stale closures or silent future regressions in session behavior.
- Impacted concepts:
  - Frontend Auth state consistency.

## Executive Summary
- No new open Critical issue was confirmed in this pass.
- Two High findings are now closed in this cycle:
  - hydrate scalability hardening,
  - `GenerationRequest` compile-time contract hardening.
- Finding 3 is now closed in this cycle:
  - request-boundary type-safety hardening with cast removal.
- Finding 4 is now closed in this cycle:
  - backend adapter decomposition into bounded modules with facade wiring parity.
- Finding 5 is now closed in this cycle:
  - frontend session client endpoint authority centralized through `buildApiPaths`.
- Finding 6 is now closed in this cycle:
  - lint and noUnused quality gates restored across workspaces.
- Finding 7 is now closed in this cycle:
  - auth provider hook dependency suppression removed with stable callback memoization.
- No open Critical/High/Medium findings remain in this review pass.
