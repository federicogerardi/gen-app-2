---
status: active
version: 2.4
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
owner: Architecture Review
---

# Architecture Weaknesses Code Review

## Scope
- Severity-first architecture review across backend, frontend, contracts, and governance alignment.
- Evidence-based findings only, with direct file references.

## Open Findings

Severity-first ranking of active findings identified in 2026-05-21 refresh. All findings are evidence-based with direct anchor paths.

### HIGH

- No open HIGH findings.

### MEDIUM

- No open MEDIUM findings.

### LOW

- No open LOW findings.

## Evidence Refresh Delta (2026-05-19)

### Closed Since Previous Review
- **Type-Safety Loss in Frontend Tool Page Controller is CLOSED** (executed 2026-05-21):
  - `toolPageSend` in `useToolPageRunController` is now typed with canonical machine event union (`ToolPageEvent`) instead of `any`.
  - Event dispatch from runtime controller is now compile-time coupled to `toolPageMachine` contract, preventing silent event-shape regressions.
  - **Validation**: frontend typecheck ✅.
  - Closure evidence anchors: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`, `apps/frontend/src/features/tools/machines/tool-page.types.ts`.

- **GenerationRequestInput Contract Too Permissive is CLOSED** (executed 2026-05-21):
  - `GenerationRequestInput` contract is now explicitly governed and no longer accepts arbitrary keys via index signature.
  - Cross-boundary metadata keys are modeled explicitly (`toolWorkflow`, `resolvedPromptTemplate`, `resolvedPromptSource`) and legacy relaunch alias is retained as deprecated (`relaunchMode`) for backward-compat migration.
  - Frontend runtime/tests updated to consume typed fields directly rather than relying on open index access for canonical keys.
  - **Validation**: backend typecheck ✅, frontend typecheck ✅.
  - Closure evidence anchors: `packages/contracts/src/index.ts`, `apps/frontend/src/features/artifacts/runtime/artifacts-client.ts`, `apps/frontend/src/features/generation/ui/artifact-history.test.ts`.

- **HTTP Method Enforcement Distributed Across Handlers is CLOSED** (executed 2026-05-21):
  - Route table now uses explicit HTTP methods for auth/public/projects/tools/admin entries (no `method: null` wildcard routes).
  - Router dispatch now enforces method constraints centrally and emits deterministic `405 method_not_allowed` with `Allow` header when path matches but verb is unsupported.
  - Projects/admin route definitions were normalized to method-specific entries, removing route-level verb branching wrappers as primary enforcement mechanism.
  - Regression coverage added for centralized 405 dispatch behavior and auth-http integration path.
  - **Validation**: backend typecheck ✅, auth-http suite ✅ (`28 pass / 0 fail`) including explicit routing-layer method enforcement test.
  - Closure evidence anchors: `apps/backend/src/lib/runtime/auth-http/route-dispatch.ts`, `apps/backend/src/lib/runtime/auth-http/route-table.ts`, `apps/backend/src/lib/runtime/auth-http/runtime.ts`, `apps/backend/src/lib/runtime/auth-http/auth-http-auth-routes.ts`, `apps/backend/src/lib/runtime/auth-http/auth-http-public-routes.ts`, `apps/backend/src/lib/runtime/auth-http/auth-http-projects-routes.ts`, `apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts`, `apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts`, `apps/backend/src/lib/tests/runtime.auth-http.test.ts`.

- **Frontend Fallback Session/Artifact Listing Not Paginated is CLOSED** (executed 2026-05-21):
  - Frontend artifact fallback now uses shared paginated retrieval (`listArtifactsPaginated`) instead of single unbounded fetch.
  - Session fallback path (`listSessions` when sessions endpoint capability is unavailable) now iterates artifact pages with deterministic `limit/offset` progression.
  - Generation workspace persisted artifact reload path now uses the same paginated retrieval strategy, avoiding non-linear one-shot payload growth.
  - Regression coverage added for fallback pagination behavior in session client and paginated artifacts runtime tests.
  - **Validation**: frontend typecheck ✅, focused frontend runtime tests ✅ (`11 pass / 0 fail`).
  - Closure evidence anchors: `apps/frontend/src/features/artifacts/runtime/artifacts-client.ts`, `apps/frontend/src/features/tools/runtime/session-client.ts`, `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`, `apps/frontend/src/features/tools/runtime/session-client.test.ts`, `apps/frontend/src/features/artifacts/runtime/artifacts-client.test.ts`.

- **Step-Artifact Endpoint Not Optimized is CLOSED** (executed 2026-05-21):
  - `SessionQueryAdapter.fetchStepArtifact(...)` no longer loads full session artifacts; it now uses dedicated repository projection `getArtifactDetailBySessionStep(...)`.
  - Production adapter now executes a step-level query with session + step filter and `LIMIT 1`, avoiding in-memory filtering over full session payloads.
  - Stub adapter aligned to the same step-level query contract; integration regression confirms the step endpoint path no longer depends on `listArtifactDetailsBySession(...)`.
  - **Validation**: backend typecheck ✅, session integration suite ✅ (`5 pass / 0 fail`), postgres query repository suite ✅ (`3 pass / 0 fail`), auth-http suite ✅ (`27 pass / 0 fail`).
  - Closure evidence anchors: `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`, `apps/backend/src/lib/adapters/postgres-redis.production.ts`, `apps/backend/src/lib/adapters/postgres-redis.stub.ts`, `apps/backend/src/lib/adapters/session-query.adapter.ts`, `apps/backend/src/lib/tests/generation-session.integration.test.ts`, `apps/backend/src/lib/tests/postgres-artifact-query-repository.test.ts`.

- **Session Listing Fragmentation and Hard-Coded Truncation is CLOSED** (executed 2026-05-20):
  - Session summary aggregation in production repository now groups by `session_id, project_id` (no workflow fragmentation) and resolves `toolKey` from latest artifact in-session using deterministic ordering.
  - `/api/tools/sessions` now supports cursor pagination (`limit`, `cursor`) with deterministic ordering (`updatedAt DESC, sessionId DESC`) and optional `nextCursor` response field.
  - Session listing contract updated end-to-end in backend adapters/runtime (`SessionListCursor`, `SessionListPage`) with compatibility preserved for existing clients (`sessions` payload unchanged, `nextCursor` additive).
  - Regression coverage added for SQL shape + pagination contract and auth-http endpoint behavior (cursor success path + invalid cursor 400), plus adapter-level dedup and cursor flow tests.
  - **Validation**: backend typecheck ✅, auth-http suite ✅ (`27 pass / 0 fail`), session integration suite ✅ (`4 pass / 0 fail`), postgres query repository suite ✅ (`2 pass / 0 fail`), frontend typecheck ✅.
  - Closure evidence anchors: `apps/backend/src/lib/adapters/postgres-redis.production.ts`, `apps/backend/src/lib/adapters/postgres-redis.stub.ts`, `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`, `apps/backend/src/lib/adapters/session-query.adapter.ts`, `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts`, `apps/backend/src/lib/tests/runtime.auth-http.test.ts`, `apps/backend/src/lib/tests/generation-session.integration.test.ts`, `apps/backend/src/lib/tests/postgres-artifact-query-repository.test.ts`, `apps/frontend/src/features/tools/runtime/session-client.ts`.

- **Orchestration Step Scalability and Structural Timeout Risk is CLOSED** (executed 2026-05-21, Phase 1-4 complete):
  - `/api/tools/orchestrate` deadline is now configurable (`TOOLS_ORCHESTRATE_TIMEOUT_MS`) with deterministic fallback to 3000 ms through runtime config resolution.
  - Completed artifact lookup is now bounded and workflow-filtered (`listRecentCompletedArtifactsForToolByUser`) with configurable limit (`TOOLS_ORCHESTRATE_ARTIFACT_SCAN_LIMIT`), replacing broad completed-history scans.
  - Step fallback resolution removed per-item N+1 detail fetch pattern: `buildCompletedArtifactsByStep` now applies two-pass strategy with batch detail fetch (`getArtifactsByIdsForUser`) and deterministic first-hit selection.
  - Regression coverage expanded: orchestrate timeout default/custom/invalid fallback tests, bounded lookup usage test, large-history deterministic ordering test, and dedicated registry batch-fallback deterministic tests.
  - Benchmark evidence recorded in `docs/04-testing/orchestrate-scalability-benchmark-2026-05-21.md` with concurrent runs over 1k/5k/10k datasets; timeout and error counts remain zero in all scenarios.
  - **Validation**: backend typecheck ✅ passing, focused orchestrate suite ✅ passing (`32 pass / 0 fail`), registry suite ✅ passing (`3 pass / 0 fail`), backend full suite ✅ passing (`142 pass / 0 fail`).
  - Closure evidence anchors: `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-config.ts`, `apps/backend/src/lib/runtime/auth-http/runtime.ts`, `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`, `apps/backend/src/lib/runtime/tool-workflow-registry.ts`, `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`, `apps/backend/src/lib/adapters/postgres-redis.production.ts`, `apps/backend/src/lib/adapters/postgres-redis.stub.ts`, `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts`, `apps/backend/src/lib/tests/runtime.tool-workflow-registry.test.ts`, `apps/backend/src/lib/tests/runtime.tools-orchestrate.benchmark.ts`, `docs/04-testing/orchestrate-scalability-benchmark-2026-05-21.md`, `plan/process-orchestration-timeout-risk-closure-1.md`.

- **Hydration Non-Determinism vs. Requested Briefing is CLOSED** (executed 2026-05-20, DDD-075 enforcement complete):
  - `/api/tools/hydrate` candidate selection now enforces briefing coherence when `resolvedBriefingId` is provided, before source exact-match and recency ranking.
  - Legacy compatibility preserved for artifacts without explicit `input.briefingId` by using `artifactId` fallback identity.
  - New explicit no-match branch returns HTTP 404 with code `no_extraction_for_briefing`.
  - Deterministic ranking includes stable tie-break after recency for equal timestamps.
  - Regression coverage expanded in `runtime.auth-http.test.ts` with five hydration scenarios (multi-briefing filter, no-match 404, legacy fallback, source priority, content-artifact resume coherence) plus updated fenced JSON baseline request.
  - **Validation**: backend typecheck ✅ passing (`npm --workspace apps/backend run typecheck`), focused hydrate test file ✅ passing (`136 pass / 0 fail`), backend full suite ✅ passing (`136 pass / 0 fail`).
  - Closure evidence anchors: `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts`, `apps/backend/src/lib/runtime/auth-http/support.ts`, `apps/backend/src/lib/tests/runtime.auth-http.test.ts`, `plan/process-hydration-briefing-coherence-finding-closure-1.md`.
- ToolPage orchestration concentration finding is closed: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` was decomposed into dedicated policy/projection modules (`tool-page-view-model.ts`, `tool-page-readiness.ts`, `tool-page-progress.ts`, `tool-page-hydration.ts`) plus thin-assignment/type support modules (`tool-page-machine-assignments.ts`, `tool-page.types.ts`), keeping behavior unchanged for start/resume/regenerate/reset/hydrate/progress flows. Closure gates passed on 2026-05-19: composer LOC threshold met (`tool-page.machine.ts=338` <= 350), each extracted module <= 300 LOC (`179`, `127`, `189`, `72`), frontend build passed, focused regressions passed, machine SEC-001 logging gate passed, new direct unit tests for readiness/hydration passed, and full frontend suite passed (`47` files, `313` tests).
- Generation orchestrator monolith finding is closed: the previous single-file machine definition has been decomposed into typed helper modules and state fragments, with `generation-system.definition.ts` reduced to thin root composition (`setup + context + states spread`). Closure evidence: plan `plan/refactor-generation-system-definition-1.md` updated to `Completed` on 2026-05-19, normalized LOC gate passed (`definition=47`, each extracted module <= 300), and regression gates passed (`typecheck`, runtime test suite, integration suite, backend full suite).
- CSRF fail-open finding is closed: startup now fails closed when CSRF trusted origins resolve to empty or include `*`, and request-time guard no longer bypasses CSRF on empty origin list. Evidence: `apps/backend/src/lib/runtime/node-server.ts:142-174`, `apps/backend/src/lib/runtime/node-server.ts:215-227`, `apps/backend/src/lib/tests/runtime.node-server.test.ts:457-548`, `docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md`, `docs/04-testing/streaming-generator-debug-runbook.md:132-142`.
- Contracts isolation breach is closed: `packages/contracts/src/parity.guard.ts` is package-local and no longer imports `apps/*` types.
- Model availability fail-open on DB read error is closed: startup check now fails closed (`fallback=deny`) in `apps/backend/src/server.ts:92-103`.
- Frontend temporary debug endpoint finding is closed: `apps/frontend/server.mjs` no longer exposes the previously reported debug route and now handles only health, proxy, static, and SPA fallback.
- Auth HTTP route-chain weakness is substantially closed: the imperative dispatch chain moved into `apps/backend/src/lib/runtime/auth-http/route-table.ts`, while the parent modules shrank to `runtime.ts` (265 LOC), `admin-handlers.ts` (106 LOC), and `tools-handlers.ts` (59 LOC).
- Auth HTTP local tool-key normalization duplication is closed: the private `normalizeSupportedToolKey` variant was removed and the tools upload path now uses the canonical backend normalizer `normalizeToolWorkflowKey` from `apps/backend/src/lib/runtime/workflow-normalizers.ts`.
- **Backend auth-http residual concentration is CLOSED** (per plan `process-auth-http-finding-closure-ddd-1.md` v1.2, executed 2026-05-19):
  - `route-table.ts`: decomposed from 349 LOC monolithic function to thin composer (51 LOC) with 5 dedicated route group modules (`auth-http-*-routes.ts`): auth (32 LOC), public (22 LOC), admin (143 LOC), projects (58 LOC), tools (61 LOC) = **316 LOC total across modules**, each module < 100 LOC boundary.
  - `route-dispatch.ts`: extracted dispatcher logic from inline route-table into isolated ~40 LOC module for testability and separation of concerns.
  - Admin publish-issue flow (`admin-feedback-center-handlers.ts`): all ungated `console.debug` calls wrapped with `if (process.env.NODE_ENV !== 'production')` via centralized `debugLog()` utility, eliminating SEC-002 violation (sensitive operational details in production path).
  - Test coverage added: route order regression (3 test cases: publish-issue before /:id pattern, userId extraction, unmatched fallback), HTTP status contract mapping (6 test cases: 401/403/404/400/503/500 error branches).
  - **Validation**: TypeScript typecheck ✅ passing; backend test suite **131 pass / 0 fail** ✅; DDD compliance audit (TASK-002) shows 0 drift, 0 deprecated aliases in scope; line-level anchor verification confirms no cross-context terminology conflicts.
- **Excessive operational logging finding is CLOSED** (executed 2026-05-19):
  - `node-server.ts` request/response lifecycle logs are now gated via `shouldLogRequestLifecycle = debugGenerationLogs || process.env.NODE_ENV !== 'production'`, preventing default production emission while preserving explicit debug visibility when enabled.
  - `tools-hydrate-handlers.ts` hydrate debug traces moved from direct `console.debug` calls to a centralized local `debugLog()` utility gated by `NODE_ENV !== 'production'`.
  - `integrations/github-issues.ts` verbose integration tracing moved from direct `console.debug` calls to a centralized local `debugLog()` utility gated by `NODE_ENV !== 'production'`; failure-path `console.error` logs remain active for operational diagnostics.
  - Closure evidence anchors: `apps/backend/src/lib/runtime/node-server.ts:165-188`, `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:49-55`, `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:119-127`, `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:200-210`, `apps/backend/src/lib/runtime/integrations/github-issues.ts:83-89`, `apps/backend/src/lib/runtime/integrations/github-issues.ts:94-174`.
  - **Validation**: backend TypeScript typecheck ✅ passing; backend test suite **131 pass / 0 fail** ✅.
- **Type-safety erosion via open unions is CLOSED as accepted risk under governance controls** (executed 2026-05-19):
  - DDD decision `DDD-073` classifies open-union (`RegistryBacked*`) as an intentional infrastructure compatibility boundary, not canonical domain typing.
  - Mandatory guardrails are documented and evidenced: canonical key/workflow guards in `packages/contracts/src/tool-workflows.ts`, normalization/projection controls in `apps/backend/src/lib/runtime/request-contract.ts`, and existing declassification baseline in DDD-018.
  - Closure evidence anchors: `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:106-124`, `packages/contracts/src/tool-workflows.ts`, `apps/backend/src/lib/runtime/request-contract.ts`, `docs/07-governance/domain-naming-decision-log.md` (DDD-018, DDD-073).

- **Shared domain package inactive finding is CLOSED** (executed 2026-05-20, DDD-074):
  - `packages/domain` activated with `packages/domain/src/index.ts` exporting five canonical cross-context Value Objects: `ArtifactType`, `ArtifactStatus`, `OutputFormat`, `WorkflowRunMode`, `ArtifactRole` — each with companion const array for runtime guard use.
  - `packages/contracts` now imports and re-exports `ArtifactType`, `OutputFormat`, `WorkflowRunMode` from `@gen-app-2/domain` (DDD-023 authority chain preserved, parity guard unaffected).
  - `apps/backend/src/lib/types/artifact.ts` now imports all five from domain and re-exports; three inline duplicate definitions (`ArtifactType`, `ArtifactStatus`, `OutputFormat`) removed.
  - `apps/backend/src/lib/types/xstate.ts` local `WorkflowRunMode` definition removed; now imports from `@gen-app-2/domain` directly.
  - `ArtifactRole` promoted to first canonical named type (previously only inline `'step' | 'final'` unions in adapter files).
  - **Validation**: TypeScript typecheck ✅ passing on all four workspaces (`@gen-app-2/domain`, `@gen-app-2/contracts`, `@gen-app-2/backend`, `gen-app-2-frontend`) with 0 errors. DDD-074 registered in decision log.
- ~~Backend auth-http risk is reduced from monolithic parent modules to two residual concentration points: `route-table.ts` as a central ordered mutation surface and `admin-feedback-center-handlers.ts` as the last oversized child module.~~ **CLOSED**: route-table.ts decomposed to thin composer (51 LOC) + 5 group modules (316 LOC); admin-feedback-center-handlers.ts retains handlers but console.debug fully gated via `NODE_ENV` check. All test coverage added per plan.
- ~~ToolPage orchestration remains a large single-point mutation surface.~~ **CLOSED**: decomposed into dedicated readiness/view-model/progress/hydration modules with thin composer (`338` LOC) and full regression evidence.
- ~~Operational logging volume in admin publish-issue, hydrate, and external integration paths remains above governance target for production-sensitive flows.~~ **CLOSED**: admin publish-issue, hydrate, external integration, and runtime request/response lifecycle debug/verbose traces are now gated for production-sensitive paths; error-path diagnostics intentionally remain active.
- ~~Type-safety erosion via open unions remains.~~ **CLOSED (accepted risk)**: governed by DDD-073 as intentional compatibility boundary with mandatory runtime guardrails (`tool-workflows` guards + `request-contract` normalization) and DDD-018 declassification baseline.

## Priority Remediation Order (Updated 2026-05-20)

- No open remediation items in this review snapshot.

### Validation Gates
- **Before Merge**: Correctness (Tier 1) and Robustness (Tier 3 routing) fixes must pass all existing test suites + new regression tests specific to the finding.
- **Before Release**: Scalability fixes (Tier 2) must include load benchmarks (p99 latency, memory, query cost) on representative historical projects.
- **Ongoing**: Anti-regression watches for Generation/ToolPage decompositions and logging-gate coverage continue through feature work cycles.

### Historical Closures (Completed 2026-05-19 – 2026-05-20)
1. ~~Optimize Orchestration Scan and Deadline~~ **DONE** (2026-05-21): deadline is configurable, completed lookup is bounded+workflow-filtered, N+1 detail fallback replaced by batch fetch path; validation and benchmark evidence recorded.
2. ~~Activate `packages/domain`~~ **DONE** (DDD-074, 2026-05-20): `ArtifactType`, `ArtifactStatus`, `OutputFormat`, `WorkflowRunMode`, `ArtifactRole` consolidated into `packages/domain`; consumers updated; 0 typecheck errors.
3. Keep Generation and ToolPage decompositions under anti-regression watch (normalized LOC + regression gates) during future feature work.
4. Keep logging-gate coverage under regression watch so production-sensitive paths do not reintroduce ungated verbose logs.

---

## Assumptions and Open Questions (2026-05-21)

### Review Methodology
- This review is static-code and contract analysis plus local synthetic benchmark evidence for `/api/tools/orchestrate`.
- Evidence is file-path anchored to current source state (2026-05-21).
- Impact assessments are based on domain contract semantics and architectural patterns, not instrumented profiling.

### Next Steps (Optional)
If prioritized for remediation:
- **Tier 1 (Correctness)** findings can be resolved with targeted patches and domain-logic verification tests (no architectural refactoring).
- **Tier 2 (Scalability)** remaining findings require load-test baselines (p50, p99, p99.9 latency; memory; query cost) before and after optimization to validate impact reduction.
- **Tier 3 (Robustness)** findings can be resolved with schema/routing changes and integration-level regression tests.

### Governance Integration
- New findings and remediation tasks will be tracked as **DDD-NNN** decisions (for domain impact) and/or GitHub Issues (for implementation).
- `docs/07-governance/domain-naming-decision-log.md` will record any terminology or boundary changes arising from remediation.
- `docs/02-design/adr/` will host ADR documents for architectural changes (e.g., session query refactoring, HTTP routing layer).

### Summary
Architecture has improved significantly since prior reviews. In this snapshot, all tracked findings are closed with implementation evidence and validation gates recorded.
