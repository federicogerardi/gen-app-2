---
status: active
version: 1.0
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
owner: Architecture Review
---

# Severe Architecture Weaknesses Review 2026-05-21

## Scope
- Severe, evidence-first architecture review across Frontend/UI, Generation, and shared contracts.
- DDD-first review aligned with canonical terms and bounded-context ownership.
- Static analysis only; no implementation edits performed in this review.

## Findings (Normalized Severity: Architecture + DDD)

### Severity Summary Table

| ID | Finding | Architecture Severity | DDD Severity | DDD Status | Priority |
| --- | --- | --- | --- | --- | --- |
| F-01 | Duplicate ToolKey normalization policy across Frontend and Backend boundaries | Critical | High | Governance-gap risk (cross-context) | P1 |
| F-02 | GenerationRequestInput remains permissive for core domain fields | Medium | Low | Closed after runtime hardening (compatibility envelope preserved by DDD-073) | P3 |
| F-03 | Type safety erosion in briefing upload machine through forced event casts | High | Low | Closed after typed done-output remediation | P2 |
| F-04 | Artifact detail projection is fail-soft and can silently return empty input/content | High | Medium | Closed after explicit default projection hardening | P2 |
| F-05 | Hydration ranking logic is extension-fragile due to imperative ordering | High | Medium | Closed after named comparator extraction | P2 |
| F-06 | Session listing dual semantics (canonical endpoint plus artifact-derived fallback) | Medium | Low | Closed after fail-closed canonical session listing | P3 |
| F-07 | Deprecated hydration compatibility path remains active | Medium | Low | Closed after session-strict hydration selector cleanup | P3 |
| F-08 | Hydration debug logging enabled for non-production environments | Low | None | Closed after opt-in sanitized diagnostics gating | P4 |

### CRITICAL

1. Duplicate ToolKey normalization policy across Frontend and Backend boundaries.
- Normalized severity: **Architecture = Critical | DDD = High**.
- Impacted concept: ToolKey.
- Why weak: two normalization authorities increase boundary drift risk.
- Evidence (historical snapshot at review time):
  - Frontend local normalizer path (before closure): [apps/frontend/src/features/artifacts/runtime/artifacts-client.ts](../../apps/frontend/src/features/artifacts/runtime/artifacts-client.ts#L67)
  - Frontend read path using local normalization (before closure): [apps/frontend/src/features/artifacts/runtime/artifacts-client.ts](../../apps/frontend/src/features/artifacts/runtime/artifacts-client.ts#L124)
  - Backend canonical normalizer baseline: [apps/backend/src/lib/runtime/workflow-normalizers.ts](../../apps/backend/src/lib/runtime/workflow-normalizers.ts#L22)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Contract-level canonical ToolKey normalizer introduced: [packages/contracts/src/tool-workflows.ts](../../packages/contracts/src/tool-workflows.ts#L121)
  - Contract-level canonical workflow candidate resolver introduced: [packages/contracts/src/tool-workflows.ts](../../packages/contracts/src/tool-workflows.ts#L144)
  - Backend normalizer delegated to contracts authority: [apps/backend/src/lib/runtime/workflow-normalizers.ts](../../apps/backend/src/lib/runtime/workflow-normalizers.ts#L28)
  - Frontend artifacts read path converged to contracts authority: [apps/frontend/src/features/artifacts/runtime/artifacts-client.ts](../../apps/frontend/src/features/artifacts/runtime/artifacts-client.ts#L77)
- Closure validation evidence:
  - Contracts typecheck: `npm --workspace @gen-app-2/contracts run typecheck` (pass)
  - Backend focused normalization tests: `npm --workspace @gen-app-2/backend run test -- src/lib/tests/runtime.workflow-normalizers.test.ts` (pass)
  - Frontend focused artifacts client tests: `npm --workspace apps/frontend run test -- --reporter=verbose src/features/artifacts/runtime/artifacts-client.test.ts` (pass, 11/11)
  - Backend typecheck: `npm --workspace @gen-app-2/backend run typecheck` (pass)
  - Frontend typecheck: `npm --workspace apps/frontend run typecheck` (pass)

2. GenerationRequestInput remains permissive for core domain fields.
- Normalized severity: **Architecture = Medium | DDD = Low (accepted risk boundary)**.
- Impacted concept: GenerationRequestInput.
- Why weak: boundary typing still allows runtime drift for critical dispatch fields.
- Evidence (historical snapshot at review time):
  - Contract type declaration: [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L98)
  - Step field accepts broad shape: [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L101)
  - Tone field accepts broad shape: [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L103)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Request normalization hardening for dispatch-critical step and tone fields: [apps/backend/src/lib/runtime/request-contract.ts](../../apps/backend/src/lib/runtime/request-contract.ts#L107)
  - Canonical tone policy gate for generation plus extraction override: [apps/backend/src/lib/runtime/request-contract.ts](../../apps/backend/src/lib/runtime/request-contract.ts#L123)
  - Runtime request enrichment now applies canonicalized step and tone before dispatch: [apps/backend/src/lib/runtime/request-contract.ts](../../apps/backend/src/lib/runtime/request-contract.ts#L140)
- Closure validation evidence:
  - Backend typecheck: `npm --workspace @gen-app-2/backend run typecheck` (pass)
  - Focused request-contract regression tests: `node --import tsx --test src/lib/tests/runtime.tool-prompts.test.ts` (pass, 9/9) in `apps/backend`
  - New canonicalization checks: [apps/backend/src/lib/tests/runtime.tool-prompts.test.ts](../../apps/backend/src/lib/tests/runtime.tool-prompts.test.ts#L112), [apps/backend/src/lib/tests/runtime.tool-prompts.test.ts](../../apps/backend/src/lib/tests/runtime.tool-prompts.test.ts#L133)

### HIGH

1. Type safety erosion in briefing upload machine through forced event casts.
- Normalized severity: **Architecture = High | DDD = Low**.
- Impacted concepts: BriefingUpload, ExtractionContext.
- Why weak: as unknown as casts reduce compile-time safety on async machine output handling.
- Evidence (historical snapshot at review time):
  - [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L149)
  - [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L314)
  - [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L390)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Typed upload done-output parser replaces cast-based extraction: [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L83)
  - Typed extraction done-output parser replaces cast-based extraction: [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L113)
  - Guard now validates extraction payload through typed done-output reader: [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L206)
  - Upload and extraction onDone actions now consume typed output readers (no forced casts): [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L368), [apps/frontend/src/features/tools/machines/briefing-upload.machine.ts](../../apps/frontend/src/features/tools/machines/briefing-upload.machine.ts#L445)
- Closure validation evidence:
  - Forced-cast removal verification: `rg -n "as unknown as" apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` (no matches)
  - Frontend typecheck: `npm --workspace apps/frontend run typecheck` (pass)
  - Focused machine regression suite: `npm --workspace apps/frontend run test -- --reporter=verbose src/features/tools/machines/briefing-upload.machine.test.ts` (pass, 12/12)

2. Artifact detail projection is fail-soft and can silently return empty input/content.
- Normalized severity: **Architecture = High | DDD = Medium**.
- Impacted concept: Artifact read model projection.
- Why weak: includeInput/includeContent projection can degrade data shape without explicit consumer signal.
- Evidence:
  - Projection selector builder: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1042)
  - Conditional input projection: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1059)
  - Conditional content projection: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1060)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Artifact detail queries now default to including input and content in the repository boundary: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1336)
  - Batch detail artifact queries now default to including input and content in the repository boundary: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1355)
  - Session-scoped detail queries now default to including input and content in the repository boundary: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1395)
  - Detail projection keeps opt-out behavior only when a caller explicitly supplies a narrower projection: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../../apps/backend/src/lib/adapters/postgres-redis.production.ts#L1042)
- Closure validation evidence:
  - Backend focused repository regression test: `npm --workspace @gen-app-2/backend run test -- src/lib/tests/postgres-artifact-query-repository.test.ts` (pass)
  - Default detail projection regression coverage: [apps/backend/src/lib/tests/postgres-artifact-query-repository.test.ts](../../apps/backend/src/lib/tests/postgres-artifact-query-repository.test.ts#L84)

3. Hydration ranking logic is correct but extension-fragile due to imperative ordering.
- Normalized severity: **Architecture = High | DDD = Medium**.
- Impacted concepts: HydrationResult, ExtractionContext coherence.
- Why weak: ranking and coherence filters are hand-ordered in one path and prone to precedence regressions when extended.
- Evidence:
  - Coherence filter activation: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L197)
  - Coherence no-match branch: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L218)
  - Ranked selection chain: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L228)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Named hydrate ranking comparator now isolates source-priority, recency, and artifactId tie-breakers: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L74)
  - Ranked selection now delegates to the named comparator instead of inlining precedence logic: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L247)
- Closure validation evidence:
  - Auth HTTP runtime hydrate ranking regression coverage: [apps/backend/src/lib/tests/runtime.auth-http.test.ts](../../apps/backend/src/lib/tests/runtime.auth-http.test.ts#L2193)
  - Auth HTTP runtime source-priority hydrate regression coverage: [apps/backend/src/lib/tests/runtime.auth-http.test.ts](../../apps/backend/src/lib/tests/runtime.auth-http.test.ts#L2482)
  - Auth HTTP runtime content-artifact coherence hydrate regression coverage: [apps/backend/src/lib/tests/runtime.auth-http.test.ts](../../apps/backend/src/lib/tests/runtime.auth-http.test.ts#L2587)

### MEDIUM

1. Session listing maintains dual semantics (canonical endpoint plus artifact-derived fallback).
- Normalized severity: **Architecture = Medium | DDD = Low (documented transition)**.
- Impacted concepts: GenerationSession, SessionSummary.
- Why weak: fallback grouping policy can diverge from canonical backend session semantics over time.
- Evidence:
  - Frontend fallback mapper: [apps/frontend/src/features/tools/runtime/session-client.ts](../../apps/frontend/src/features/tools/runtime/session-client.ts#L93)
  - Canonical endpoint branch: [apps/frontend/src/features/tools/runtime/session-client.ts](../../apps/frontend/src/features/tools/runtime/session-client.ts#L141)
  - Fallback execution branch: [apps/frontend/src/features/tools/runtime/session-client.ts](../../apps/frontend/src/features/tools/runtime/session-client.ts#L170)
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Session listing now fails closed when the canonical sessions endpoint is unavailable instead of deriving summaries from artifacts: [apps/frontend/src/features/tools/runtime/session-client.ts](../../apps/frontend/src/features/tools/runtime/session-client.ts#L141)
  - Artifact-derived session fallback helper was removed from the production session-listing path: [apps/frontend/src/features/tools/runtime/session-client.ts](../../apps/frontend/src/features/tools/runtime/session-client.ts#L132)
- Closure validation evidence:
  - Frontend focused session-client regression test: `npm --workspace apps/frontend run test -- --reporter=verbose src/features/tools/runtime/session-client.test.ts` (pass)

2. Deprecated hydration compatibility path remains active.
- Normalized severity: **Architecture = Medium | DDD = Low**.
- Impacted concepts: StepHydration, ToolStepOrchestration.
- Why weak: legacy path increases mutation surface and cognitive load.
- Evidence:
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Deprecated warning removed from tool-step compatibility selector: [apps/frontend/src/features/generation/runtime/step-hydration.ts](../../apps/frontend/src/features/generation/runtime/step-hydration.ts#L176)
  - Legacy fallback rows removed from session-aware latest-artifact selection: [apps/frontend/src/features/generation/runtime/step-hydration.ts](../../apps/frontend/src/features/generation/runtime/step-hydration.ts#L217)
  - Canonical backend orchestration path remains the live step execution authority: [apps/frontend/src/features/tools/runtime/useToolPageRunController.ts](../../apps/frontend/src/features/tools/runtime/useToolPageRunController.ts#L121)
- Closure validation evidence:
  - Session-aware hydration regression coverage: [apps/frontend/src/features/generation/runtime/step-hydration.test.ts](../../apps/frontend/src/features/generation/runtime/step-hydration.test.ts#L76)
  - Frontend focused step-hydration regression suite: `npm --workspace apps/frontend run test -- --reporter=verbose src/features/generation/runtime/step-hydration.test.ts` (pass, 3/3)

### LOW

1. Hydration debug logging is enabled for all non-production environments.
- Normalized severity: **Architecture = Low | DDD = None**.
- Impacted concept: operational observability governance.
- Why weak: coarse debug gate can create noise and metadata exposure in staging/test.
- Evidence:
- Closure status (2026-05-21): **Closed**.
- Closure implementation evidence:
  - Hydrate diagnostics now require explicit `HYDRATE_DEBUG_DIAGNOSTICS=1` opt-in outside production: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L49)
  - Hydrate debug output now emits sanitized booleans and counts instead of direct identifiers: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L164)
  - Ranked hydrate diagnostics remain sanitized in the same opt-in path: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L278)
- Closure validation evidence:
  - Backend focused auth-http regression test: `npm --workspace @gen-app-2/backend run test -- src/lib/tests/runtime.auth-http.test.ts` (pass)

## Governance Alignment Notes
- Existing governance snapshots report no currently open findings:
  - [docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md](./architecture-weaknesses-code-review-2026-05-18.md)
  - [docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md](./architecture-weaknesses-code-review-2026-05-21.md)
- This severe review records the historical findings and their closed remediations for preventive hardening.

## Recommended Next Hardening Sequence
1. Tighten compile-time `GenerationRequestInput` contract after compatibility deprecation window (DDD-073).

## DDD Impact Verification (2026-05-21)

This section verifies the DDD impact of each finding against the canonical reference set:
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`

### Impact Matrix

1. Duplicate ToolKey normalization policy across Frontend and Backend boundaries.
- DDD references: DDD-029, DDD-071, DDD-C-005.
- DDD impact: **governance-gap risk (cross-context)**.
- Verification: `ToolKey` remains canonical and naming is aligned; risk is architectural because FE normalization is not contract-owned, while DDD-071 formalizes canonical ownership only for BE runtime normalization.

2. GenerationRequestInput remains permissive for core domain fields.
- DDD references: DDD-073, DDD-023, DDD-032.
- DDD impact: **closed with runtime hardening, no canonical drift**.
- Verification: permissive envelope remains explicitly documented as compatibility boundary (DDD-073), while dispatch-critical runtime normalization for `step` and `tone` is now enforced in backend request normalization.

3. Type safety erosion in briefing upload machine through forced event casts.
- DDD references: `BriefingUpload` glossary entry, DDD-007.
- DDD impact: **closed with typed done-output remediation, no canonical drift**.
- Verification: ubiquitous language remains consistent and async done-event handling now uses typed output readers without forced casts.

4. Artifact detail projection is fail-soft and can silently return empty input/content.
- DDD references: `ToolWorkflowPersistenceMetadata` glossary entry, DDD-034, DDD-050.
- DDD impact: **projection-contract ambiguity risk**.
- Verification: canonical terms are preserved, but projection semantics can weaken deterministic read expectations if not explicit to consumers.

5. Hydration ranking logic extension-fragile due to imperative ordering.
- DDD references: DDD-075, DDD-038.
- DDD impact: **stability risk on a DDD-critical path**.
- Verification: current logic is DDD-compliant; risk concerns future extensibility and precedence regressions rather than current semantic drift.

6. Session listing dual semantics (canonical endpoint plus artifact-derived fallback).
- DDD references: DDD-051, DDD-052, `SessionSummary` glossary entry.
- DDD impact: **transitional policy (documented), not drift**.
- Verification: fallback derivation from artifacts is explicitly allowed during transition; monitor for rollout completion to retire fallback.

7. Deprecated hydration compatibility path remains active.
- DDD references: DDD-028, DDD-031, DDD-C-007.
- DDD impact: **technical debt with bounded DDD risk**.
- Verification: BE orchestration authority is preserved; residual deprecated FE helpers increase maintenance surface but do not currently violate canonical ownership.

8. Hydration debug logging in non-production environments.
- DDD references: none (operational concern).
- DDD impact: **no direct DDD impact**.
- Verification: opt-in sanitized diagnostics now keep runtime observability separate from request payload content and identifiers.

### DDD Conclusion

- **Confirmed DDD drift requiring canonical action now**: none.
- **Architecture hardening with DDD sensitivity**: ToolKey normalization authority, hydration-ranking extensibility, artifact projection contract clarity, sanitized hydrate diagnostics.
- **Accepted/governed compatibility areas**: compile-time permissive `GenerationRequestInput` envelope (DDD-073) and SessionSummary fallback transition (DDD-051/DDD-052).

