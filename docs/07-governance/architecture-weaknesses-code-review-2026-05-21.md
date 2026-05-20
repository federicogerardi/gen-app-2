---
status: active
version: 1.0
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
owner: Architecture Review
---

# Architecture Weaknesses Code Review 2026-05-21

## Scope
- Severe architecture review focused on runtime reliability, boundary consistency, scalability, and operational safety.
- Evidence-based findings only, anchored to current workspace files.

## Findings (Severity-First)

### CRITICAL

- Parsing inconsistency for ExtractionContext between hydrate path and canonical Generation parser.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Hydrate path now imports canonical Generation parser directly (`parseCanonicalExtractionContent`) in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L4).
  - Both hydrate parse call sites (direct extraction-source and ranked fallback) now pass tool identity resolved from input in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L122) and [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L249).
  - Local hydrate parser module now keeps only parsed-format utility and no ExtractionContext parser duplicate in [tools-hydration-parser.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts#L1).
  - Canonical parser retains youtube-specific markdown semantics and now also preserves non-youtube compatibility for historical payload envelopes/fenced/object-slice JSON in [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L24), [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L57), and [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L128).
  - Regression coverage for hydrate parity and response-shape stability is present in [runtime.auth-http.test.ts](../../apps/backend/src/lib/tests/runtime.auth-http.test.ts#L2160).
  - Validation gates passed after the fix:
    - `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test` (exit code 0, 153 pass / 0 fail).
- Risk:
  - Closed for parser-parity scope. Residual risk remains only for future uncontrolled parser edits that bypass canonical module ownership.

### HIGH

- N+1 query pattern in tools hydrate candidate resolution.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Candidate list retrieval starts with `listArtifactsByUser` in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L181).
  - Coherence filtering now performs one batch detail read through `getArtifactsByIdsForUser` in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L199), replacing per-candidate fan-out.
  - Ranked winner resolution keeps a single final detail fetch (`bestDetail`) in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L242).
  - Repository implementation confirms batch SQL support via `id = ANY(...)` in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1353).
  - Effective query shape in `resolvedBriefingId` path is reduced from `1 + N + 1` to `1 + 1 + 1` (plus optional source-artifact pre-read).
  - Validation gates passed after refactor:
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test` (exit code 0, 153 pass / 0 fail).
- Risk:
  - Closed for hydrate candidate filtering scope. Residual risk remains only for future regressions that reintroduce per-candidate detail fan-out.

- Production dependency composition allows fail-open fallback to synthetic LLM adapter.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Adapter resolution now separates explicit adapter and env-backed OpenRouter adapter before fallback in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1548) and [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1551).
  - Production guard is fail-closed: when no real adapter is available and `NODE_ENV=production`, runtime throws `production_llm_adapter_missing` in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1557).
  - Synthetic adapter fallback is now restricted to non-production execution paths in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1575).
  - OpenRouter env factory behavior remains explicit (`null` without `OPENROUTER_API_KEY`) in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L271), [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L272), [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L273), and [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L274).
  - Validation gates passed after refactor:
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test` (exit code 0, 153 pass / 0 fail).
- Risk:
  - Closed for production fail-open scope. Residual risk remains only for explicit non-production fallback behavior or future regressions that remove the production guard.

- Idempotency completion is a late non-guarded step in tools orchestrate flow.
- Evidence:
  - `markCompleted` executes after successful orchestration response assembly in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts).
- Risk:
  - Late idempotency persistence failures can produce success/failure ambiguity and inconsistent replay behavior.

### MEDIUM

- Quota claim conflict path swallows infrastructure error details.
- Evidence:
  - Generic catch maps to `hasConflict: true` without diagnostic details in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts).
- Risk:
  - Reduced observability and slower root-cause analysis under transactional or infrastructure failures.

- Frontend artifact reload fallback silently ignores backend failures.
- Evidence:
  - Explicit silent ignore branch in [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx).
- Risk:
  - UI may present partially stale state without explicit error channel, masking backend degradation.

- Runtime auth-http module includes dead imports/constants.
- Evidence:
  - Unused symbols in [runtime.ts](../../apps/backend/src/lib/runtime/auth-http/runtime.ts).
- Risk:
  - Not immediately functional-critical, but indicates weak static hygiene on a high-risk boundary module.

### LOW

- Debug logging can expose partial business content/context metadata in non-production/debug configurations.
- Evidence:
  - Context/message debug traces in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts).
  - GitHub integration config debug emits token-length metadata in [github-config.ts](../../apps/backend/src/lib/runtime/integrations/github-config.ts).
- Risk:
  - Information exposure in logs if debug toggles are enabled in sensitive environments.

## Recommended Remediation Order

1. Unify extraction parsing semantics: hydrate path must reuse canonical Generation extraction parser contract for tool-specific behavior.
2. Remove N+1 in hydrate ranking: replace per-candidate detail fan-out with bounded batched projection strategy.
3. Enforce fail-closed LLM adapter policy for production runtime composition.
4. Harden orchestrate idempotency completion path with explicit error contract and rollback/compensation strategy.
5. Strengthen observability: avoid silent catches on quota and frontend persisted-artifact reload paths.

## Validation Gates

- Before merge:
  - Add targeted regression tests for hydrate semantic parity across parser paths.
  - Add performance tests for hydrate candidate ranking with large extraction history.
  - Add runtime configuration test ensuring no synthetic adapter fallback in production policy mode.
- Before release:
  - Run bounded load scenario on hydrate + orchestrate paths with representative project history sizes.

## Notes
- This review is static architecture analysis with evidence anchors from current workspace state.
- Findings are ordered by operational risk and regression impact, not by implementation effort.
