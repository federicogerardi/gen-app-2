---
status: active
version: 1.5
last-reviewed: 2026-05-19
next-review-date: 2026-08-18
owner: Architecture Review
---

# Architecture Weaknesses Code Review

## Scope
- Severity-first architecture review across backend, frontend, contracts, and governance alignment.
- Evidence-based findings only, with direct file references.

## Open Findings

| Severity | Weakness | Evidence |
| --- | --- | --- |
| Medium | Type-safety erosion via open unions and broad request payload shape remains. | `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:116-123` |
| Medium | Shared domain package remains inactive, so cross-context model consolidation is still deferred. | `packages/domain/README.md:11-20`, `packages/domain/package.json:8` |

## Evidence Refresh Delta (2026-05-19)

### Closed Since Previous Review
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

### Still Open / Updated
- ~~Backend auth-http risk is reduced from monolithic parent modules to two residual concentration points: `route-table.ts` as a central ordered mutation surface and `admin-feedback-center-handlers.ts` as the last oversized child module.~~ **CLOSED**: route-table.ts decomposed to thin composer (51 LOC) + 5 group modules (316 LOC); admin-feedback-center-handlers.ts retains handlers but console.debug fully gated via `NODE_ENV` check. All test coverage added per plan.
- ~~ToolPage orchestration remains a large single-point mutation surface.~~ **CLOSED**: decomposed into dedicated readiness/view-model/progress/hydration modules with thin composer (`338` LOC) and full regression evidence.
- ~~Operational logging volume in admin publish-issue, hydrate, and external integration paths remains above governance target for production-sensitive flows.~~ **CLOSED**: admin publish-issue, hydrate, external integration, and runtime request/response lifecycle debug/verbose traces are now gated for production-sensitive paths; error-path diagnostics intentionally remain active.

## Priority Remediation Order (Updated 2026-05-19)
1. Activate `packages/domain` and establish canonical cross-context model consolidation using the decomposed Generation/auth-http/tool-page surfaces as the reference pattern.
2. Keep Generation and ToolPage decompositions under anti-regression watch (normalized LOC + regression gates) during future feature work.
3. Keep logging-gate coverage under regression watch so production-sensitive paths do not reintroduce ungated verbose logs.
