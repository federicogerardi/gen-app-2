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

## Snapshot Symmetry With Severe Review (2026-05-21)

This companion snapshot is aligned with the shared-governance status captured in [docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md](./architecture-weaknesses-code-review-severe-2026-05-21.md).

### Shared Finding Status Alignment

| Shared ID | Finding | Companion Status | Severe Snapshot Status | Alignment |
| --- | --- | --- | --- | --- |
| F-01 | Duplicate ToolKey normalization policy across Frontend and Backend boundaries | Closed | Closed | Symmetric |
| F-02 | GenerationRequestInput permissive boundary for dispatch-critical fields | Closed after runtime hardening | Closed after runtime hardening | Symmetric |
| F-03 | Type safety erosion in briefing upload machine through forced event casts | Closed after typed done-output remediation | Closed after typed done-output remediation | Symmetric |
| F-04 | Artifact detail projection is fail-soft and can silently return empty input/content | Closed after explicit default projection hardening | Closed after explicit default projection hardening | Symmetric |

### Shared Hardening Sequence Alignment

The residual hardening sequence for open architectural work is intentionally symmetric with [docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md](./architecture-weaknesses-code-review-severe-2026-05-21.md):

1. Optional follow-up: tighten compile-time GenerationRequestInput contract after compatibility deprecation window (DDD-073).

The F-03 and F-04 remediations are already reflected in the severe snapshot and should be treated as part of the shared aligned state.

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
- Status: CLOSED (2026-05-21).
- Evidence:
  - Handler now tracks idempotency completion phase explicitly via `idempotencyCompletionPending` in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L142).
  - `markCompleted` is moved into the guarded execution path and wrapped by the same error boundary used by orchestration in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L260) and [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L261).
  - Failure contract is now explicit for late completion failures: `Failed idempotency completion for orchestrate request` in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L283) and [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L284).
  - Compensation path is deterministic: `markFailed` is invoked on guarded failure after idempotency claim in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L275).
  - Success response remains emitted only after guarded idempotency completion in [tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts#L291), removing the prior unguarded late-step gap.
  - Validation gates passed after refactor:
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.tools-orchestrate.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test` (exit code 0, 153 pass / 0 fail).
- Risk:
  - Closed for non-guarded late completion scope. Residual risk remains only for future regressions that move idempotency completion outside guarded flow.

### MEDIUM

- Quota claim conflict path swallows infrastructure error details.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Quota claim catch path now returns explicit infra-failure reason `usage_failed` (no synthetic `hasConflict: true` coercion) in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L398).
  - Usage actor fallback now preserves `usage_failed` for adapter errors and missing rejection reasons in [usage.machine.ts](../../apps/backend/src/lib/machines/usage.machine.ts#L53), [usage.machine.ts](../../apps/backend/src/lib/machines/usage.machine.ts#L83), and [usage.machine.ts](../../apps/backend/src/lib/machines/usage.machine.ts#L120).
  - Runtime error contract now maps `usage_failed` explicitly to retryable backend failure semantics in [error-contract.ts](../../apps/backend/src/lib/runtime/error-contract.ts#L49).
  - Regression coverage added for repository catch-path behavior and downstream mappings in [postgres-redis.usage-repository.test.ts](../../apps/backend/src/lib/tests/postgres-redis.usage-repository.test.ts#L8), [usage.machine.test.ts](../../apps/backend/src/lib/tests/usage.machine.test.ts#L104), and [runtime.contracts.test.ts](../../apps/backend/src/lib/tests/runtime.contracts.test.ts#L69).
  - Validation gates passed after remediation:
    - `npm --workspace apps/backend run test -- src/lib/tests/postgres-redis.usage-repository.test.ts src/lib/tests/usage.machine.test.ts src/lib/tests/runtime.contracts.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test` (exit code 0).
- Risk:
  - Closed for quota-claim observability scope. Residual risk remains only for future regressions that collapse infra failures back into quota/conflict paths.

- Frontend artifact reload fallback silently ignores backend failures.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Persisted artifact reload is executed via `listArtifactsPaginated(...)` in [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx#L214), with state update only on success in [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx#L219).
  - Reload failure branch no longer swallows errors silently: provider now captures and stores reload error message in [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx#L231).
  - Artifacts client surfaces backend list failures as thrown errors (`Unable to list artifacts (HTTP ...)`) in [artifacts-client.ts](../../apps/frontend/src/features/artifacts/runtime/artifacts-client.ts#L328), and provider catch now propagates them into workspace/UI error state.
  - Workspace artifacts contract now exposes explicit error channel `artifactsReloadError` alongside data/reload handlers in [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx#L85) and [GenerationWorkspaceProvider.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx#L251).
  - Tool workspace UI now surfaces persisted reload failures through explicit inline feedback in [ToolPageTemplate.tsx](../../apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx#L67) and [ToolPageTemplate.tsx](../../apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx#L257).
  - Dedicated provider-level regression coverage is now present in [GenerationWorkspaceProvider.test.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.test.tsx#L45) and [GenerationWorkspaceProvider.test.tsx](../../apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.test.tsx#L63).
  - Validation gates passed after remediation:
    - `npm --workspace apps/frontend run test -- src/features/generation/runtime/GenerationWorkspaceProvider.test.tsx src/features/tools/runtime/useToolPage.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx` (exit code 0, 3 files / 28 tests passed).
- Risk:
  - Closed for frontend persisted-artifact reload observability scope. Residual risk remains only for future regressions that remove or bypass `artifactsReloadError` propagation.

- Runtime auth-http module includes dead imports/constants.
- Status: CLOSED (2026-05-21).
- Evidence:
  - Dead symbols removed from [runtime.ts](../../apps/backend/src/lib/runtime/auth-http/runtime.ts#L1): `randomUUID`, `UpdateAuthUserInput`, `isSupportedToolWorkflow`, `extractStepFromArtifactInput`, `normalizePath`, `parseArtifactReadProjection`, and `LLM_MODEL_KEY_REGEX`.
  - Import section is now reduced to active dependencies only in [runtime.ts](../../apps/backend/src/lib/runtime/auth-http/runtime.ts#L1).
  - Post-remediation lexical scan returns no matches for the removed symbols in [runtime.ts](../../apps/backend/src/lib/runtime/auth-http/runtime.ts).
  - Validation gate passed after remediation:
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (exit code 0, 155 pass / 0 fail).
- Risk:
  - Closed for static-hygiene scope in auth-http runtime boundary. Residual risk remains only for future regressions that reintroduce unused imports/constants.

### LOW

- Debug logging can expose partial business content/context metadata in non-production/debug configurations.
- Status: CLOSED (2026-05-21).
- Evidence:
  - OpenRouter diagnostics are now gated by explicit opt-in (`OPENROUTER_DEBUG_DIAGNOSTICS=1`) and non-production execution in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L24).
  - OpenRouter context diagnostics were sanitized to coarse booleans (`hasBriefingText`, `hasExtractionPayloadObject`) with no content-length or payload-shape leakage in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L109).
  - OpenRouter final-message diagnostics no longer log message length/prefix and now expose only `hasContextBlock` and `messageCount` in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts#L168).
  - GitHub config diagnostics are now gated by explicit opt-in (`GITHUB_DEBUG_DIAGNOSTICS=1`) and non-production execution in [github-config.ts](../../apps/backend/src/lib/runtime/integrations/github-config.ts#L23).
  - GitHub config logs are sanitized to presence flags and retry settings only (`hasOwner`, `hasRepo`, timing/retry fields), removing direct owner/repo/token-derived metadata exposure in [github-config.ts](../../apps/backend/src/lib/runtime/integrations/github-config.ts#L55).
  - Validation gates passed after remediation:
    - `npm --workspace apps/backend run test -- src/lib/tests/openrouter.adapter.test.ts` (exit code 0).
    - `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (exit code 0).
- Risk:
  - Closed for debug-log exposure scope. Residual risk remains only for future regressions that log request content or token-derived metadata without sanitization.

## Recommended Remediation Order

1. Unify extraction parsing semantics: hydrate path must reuse canonical Generation extraction parser contract for tool-specific behavior.
2. Remove N+1 in hydrate ranking: replace per-candidate detail fan-out with bounded batched projection strategy.
3. Enforce fail-closed LLM adapter policy for production runtime composition.
4. Harden orchestrate idempotency completion path with explicit error contract and rollback/compensation strategy.
5. Improve static hygiene: remove dead imports/constants in auth-http runtime boundary.

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
