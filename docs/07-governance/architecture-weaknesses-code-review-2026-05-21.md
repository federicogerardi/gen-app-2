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
- Evidence:
  - Hydrate path imports and uses a local parser that only accepts content input and does not receive tool identity in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L6) and [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L110).
  - The same hydrate path repeats that parser usage in ranked fallback resolution in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L230).
  - Local hydrate parser signature is content-only, JSON-first (direct/fenced/object-slice), with no tool-aware branch in [tools-hydration-parser.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts#L47).
  - Canonical Generation parser is tool-aware: it normalizes tool key and applies youtube-specific markdown extraction for youtube-lf-script in [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L96) and [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L98).
  - Youtube parsing semantics in Generation are materially different (section-heading + bullet mapping, null normalization for missing markers) in [extraction-parsers.ts](../../apps/backend/src/lib/machines/generation/extraction-parsers.ts#L38).
  - Frontend readiness enforces youtube mandatory extraction fields (`knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`) in [extraction-context-validity.ts](../../apps/frontend/src/features/tools/machines/extraction-context-validity.ts#L3), [extraction-context-validity.ts](../../apps/frontend/src/features/tools/machines/extraction-context-validity.ts#L46), and [extraction-context-validity.ts](../../apps/frontend/src/features/tools/machines/extraction-context-validity.ts#L88).
  - Hydration validation path consumes `hydrationResult.extractionPayload` under tool-specific validity checks in [tool-page-readiness.ts](../../apps/frontend/src/features/tools/machines/tool-page-readiness.ts#L91).
- Risk:
  - Hydration may reconstruct non-equivalent ExtractionContext payloads versus Generation canonical parsing for youtube-lf-script, causing semantic drift in HydrationResult and tool readiness evaluation.

### HIGH

- N+1 query pattern in tools hydrate candidate resolution.
- Evidence:
  - Candidate list plus per-candidate detail fetch (`Promise.all` + repeated `getArtifactByIdForUser`) in [tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts).
- Risk:
  - Latency and DB pressure scale linearly with historical extraction volume, impacting relaunch/resume path stability.

- Production dependency composition allows fail-open fallback to synthetic LLM adapter.
- Evidence:
  - Runtime dependency chain selects synthetic adapter when env-backed OpenRouter adapter is unavailable in [postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts).
  - OpenRouter env factory returns null without `OPENROUTER_API_KEY` in [openrouter.adapter.ts](../../apps/backend/src/lib/adapters/openrouter.adapter.ts).
- Risk:
  - Misconfiguration can silently degrade real generation behavior into synthetic output in production-like runtime composition.

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
