---
status: active
version: 1.0
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
- Evidence:
  - `apps/backend/src/lib/runtime/request-contract.ts` uses multiple `as never` casts for registry fields.
- Architectural weakness:
  - Type system signal is reduced at a critical integration boundary.
  - Potentially masks contract drift or incorrect enrichment logic.
- Impacted concepts:
  - `GenerationRequest`, `RegistrySnapshotRef`, `RegistryVersion`.

### 4. Medium — Backend adapter concentration (monolithic infra file)
- Evidence:
  - `apps/backend/src/lib/adapters/postgres-redis.production.ts` contains multiple repositories and helper layers in one file (1600+ LOC).
- Architectural weakness:
  - High coupling and larger change blast radius.
  - Harder ownership boundaries and more fragile targeted testing.
- Impacted concepts:
  - Adapter boundary quality (`ArtifactQueryRepository`, `RedisQuotaRepository`, `RedisIdempotencyRepository`, persistence concerns).

### 5. Medium — Session client boundary inconsistency in frontend
- Evidence:
  - `apps/frontend/src/features/tools/runtime/session-client.ts` uses capability-driven `buildApiPaths` for list/detail.
  - The same file builds step endpoint with hardcoded string path.
- Architectural weakness:
  - Inconsistent route authority in one module.
  - Higher drift risk when API paths evolve.
- Impacted concepts:
  - `SessionSummary`, `SessionArtifactGroup`, API boundary governance.

### 6. Medium — Incomplete quality gates for structural debt prevention
- Evidence:
  - Root `package.json` defines workspace lint orchestration.
  - `apps/frontend/package.json` and `apps/backend/package.json` have no local `lint` script.
  - `apps/frontend/src/features/tools/runtime/session-client.ts` keeps an unused import.
  - `tsconfig` files do not enforce `noUnusedLocals` / `noUnusedParameters`.
- Architectural weakness:
  - Dead code and small hygiene regressions can pass CI undetected.
- Impacted concepts:
  - CI maintainability and long-term architecture integrity.

### 7. Low-Medium — React hook dependency suppression in auth provider
- Evidence:
  - `apps/frontend/src/app/providers/AuthSessionProvider.tsx` disables exhaustive-deps for memoized context value.
- Architectural weakness:
  - Increased risk of stale closures or silent future regressions in session behavior.
- Impacted concepts:
  - Frontend Auth state consistency.

## Open Questions
1. Is the unbounded hydrate scan intentional for completeness, or should the endpoint enforce a deterministic capped window?
2. Is there a planned window to tighten `GenerationRequestInput` compile-time constraints after compatibility sunset?
3. Should session step endpoints be fully centralized via `buildApiPaths` to remove route duplication?

## Executive Summary
- No new open Critical issue was confirmed in this pass.
- The dominant residual risk profile is High/Medium and concentrated in:
  - hydrate scalability,
  - permissive contract typing,
  - technical governance gates.
- Recommended next hardening wave:
  1. Cap and optimize hydrate candidate selection.
  2. Tighten compile-time request contract for canonical fields.
  3. Remove forced type escapes (`as never`) from request enrichment path.
  4. Restore lint/unused-symbol guardrails across workspaces.
