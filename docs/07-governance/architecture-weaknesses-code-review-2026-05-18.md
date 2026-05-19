---
status: active
version: 1.3
last-reviewed: 2026-05-19
next-review-date: 2026-08-18
owner: Architecture Review
---

# Architecture Weaknesses Code Review

## Scope
- Severity-first architecture review across backend, frontend, contracts, and governance alignment.
- Evidence-based findings only, with direct file references.

## Findings

| Severity | Weakness | Evidence |
| --- | --- | --- |
| Medium | Backend auth-http composition is no longer monolithic, but residual concentration remains in route registration and FeedbackCenter admin publication flow. | `apps/backend/src/lib/runtime/auth-http/runtime.ts` (265 LOC), `apps/backend/src/lib/runtime/auth-http/route-table.ts` (349 LOC), `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` (434 LOC) |
| High | Generation orchestrator remains a monolithic state machine definition with mixed concerns. | `apps/backend/src/lib/machines/generation-system.definition.ts` (1089 LOC), fallback/persistence cluster `:920-1040` |
| High | Frontend Tool page orchestration still concentrates readiness policy, hydration projection, and UI policy. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (1021 LOC), `apps/frontend/src/features/tools/machines/tool-page.machine.ts:565-860` |
| High | Excessive debug logging persists in sensitive admin and integration paths. | `apps/backend/src/lib/runtime/node-server.ts:158-162`, `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts:295-398`, `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts:113-194`, `apps/backend/src/lib/runtime/integrations/github-issues.ts:88-165` |
| Medium | Type-safety erosion via open unions and broad request payload shape remains. | `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:116-123` |
| Medium | Shared domain package remains inactive, so cross-context model consolidation is still deferred. | `packages/domain/README.md:11-20`, `packages/domain/package.json:8` |

## Evidence Refresh Delta (2026-05-19)

### Closed Since Previous Review
- CSRF fail-open finding is closed: startup now fails closed when CSRF trusted origins resolve to empty or include `*`, and request-time guard no longer bypasses CSRF on empty origin list. Evidence: `apps/backend/src/lib/runtime/node-server.ts:142-174`, `apps/backend/src/lib/runtime/node-server.ts:215-227`, `apps/backend/src/lib/tests/runtime.node-server.test.ts:457-548`, `docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md`, `docs/04-testing/streaming-generator-debug-runbook.md:132-142`.
- Contracts isolation breach is closed: `packages/contracts/src/parity.guard.ts` is package-local and no longer imports `apps/*` types.
- Model availability fail-open on DB read error is closed: startup check now fails closed (`fallback=deny`) in `apps/backend/src/server.ts:92-103`.
- Frontend temporary debug endpoint finding is closed: `apps/frontend/server.mjs` no longer exposes the previously reported debug route and now handles only health, proxy, static, and SPA fallback.
- Auth HTTP route-chain weakness is substantially closed: the imperative dispatch chain moved into `apps/backend/src/lib/runtime/auth-http/route-table.ts`, while the parent modules shrank to `runtime.ts` (265 LOC), `admin-handlers.ts` (106 LOC), and `tools-handlers.ts` (59 LOC).
- Auth HTTP local tool-key normalization duplication is closed: the private `normalizeSupportedToolKey` variant was removed and the tools upload path now uses the canonical backend normalizer `normalizeToolWorkflowKey` from `apps/backend/src/lib/runtime/workflow-normalizers.ts`.

### Still Open / Updated
- Backend auth-http risk is reduced from monolithic parent modules to two residual concentration points: `route-table.ts` as a central ordered mutation surface and `admin-feedback-center-handlers.ts` as the last oversized child module.
- Generation and ToolPage orchestration remain large single-point mutation surfaces.
- Operational logging volume in admin publish-issue, hydrate, and external integration paths remains above governance target for production-sensitive flows.

## Priority Remediation Order
1. Split `generation-system.definition.ts` and `tool-page.machine.ts` into narrower orchestration/policy/projection slices.
2. Reduce or gate verbose debug logs in admin publish-issue, hydrate, and external integration flows with environment-based policy.
3. Reduce residual auth-http size concentration in `route-table.ts` and `admin-feedback-center-handlers.ts`, or add narrower invariants coverage around route order and publish flow behavior.
4. Activate `packages/domain` or otherwise consolidate cross-context domain models now that the auth-http surface has been decomposed.
