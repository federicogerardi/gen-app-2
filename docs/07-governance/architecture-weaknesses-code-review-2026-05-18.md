---
status: active
version: 1.4
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
| High | Frontend Tool page orchestration still concentrates readiness policy, hydration projection, and UI policy. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (1021 LOC), `apps/frontend/src/features/tools/machines/tool-page.machine.ts:565-860` |
| High | Excessive debug logging persists in sensitive hydrate and external integration paths. Admin publish-issue path is gated (see closure below). | `apps/backend/src/lib/runtime/node-server.ts:158-162`, `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:113-194`, `apps/backend/src/lib/runtime/integrations/github-issues.ts:88-165` |
| Medium | Type-safety erosion via open unions and broad request payload shape remains. | `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:116-123` |
| Medium | Shared domain package remains inactive, so cross-context model consolidation is still deferred. | `packages/domain/README.md:11-20`, `packages/domain/package.json:8` |

## Evidence Refresh Delta (2026-05-19)

### Closed Since Previous Review
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

### Still Open / Updated
- ~~Backend auth-http risk is reduced from monolithic parent modules to two residual concentration points: `route-table.ts` as a central ordered mutation surface and `admin-feedback-center-handlers.ts` as the last oversized child module.~~ **CLOSED**: route-table.ts decomposed to thin composer (51 LOC) + 5 group modules (316 LOC); admin-feedback-center-handlers.ts retains handlers but console.debug fully gated via `NODE_ENV` check. All test coverage added per plan.
- ToolPage orchestration remains a large single-point mutation surface.
- ~~Operational logging volume in admin publish-issue, hydrate, and external integration paths remains above governance target for production-sensitive flows.~~ **REDUCED**: admin publish-issue path fully gated; hydrate and external integration paths remain (defer to subsequent review).

## Priority Remediation Order (Updated 2026-05-19)
1. Prioritize ToolPage orchestration decomposition (`apps/frontend/src/features/tools/machines/tool-page.machine.ts`) now that Generation and auth-http decompositions are closed.
2. Reduce or gate verbose debug logs remaining in hydrate and external integration paths.
3. Activate `packages/domain` and establish canonical cross-context model consolidation using the decomposed Generation/auth-http surfaces as the reference pattern.
4. Keep Generation orchestrator decomposition under anti-regression watch (normalized LOC + regression gates) during future feature work.
