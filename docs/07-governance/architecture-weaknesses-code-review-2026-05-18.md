---
status: active
version: 1.1
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
| Critical | CSRF protection can fail open when trusted origins resolve to an empty list. | `apps/backend/src/lib/runtime/node-server.ts:152-153`, `apps/backend/src/lib/runtime/node-server.ts:190-191` |
| High | Backend HTTP composition remains a high-coupling route chain with oversized handler modules. | `apps/backend/src/lib/runtime/auth-http/runtime.ts` (515 LOC), `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` (1092 LOC), `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` (873 LOC) |
| High | Generation orchestrator remains a monolithic state machine definition with mixed concerns. | `apps/backend/src/lib/machines/generation-system.definition.ts` (1089 LOC), fallback/persistence cluster `:920-1040` |
| High | Frontend Tool page orchestration still concentrates readiness policy, hydration projection, and UI policy. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (1021 LOC), `apps/frontend/src/features/tools/machines/tool-page.machine.ts:565-860` |
| High | Excessive debug logging persists in sensitive admin and integration paths. | `apps/backend/src/lib/runtime/node-server.ts:158-162`, `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts:674-777`, `apps/backend/src/lib/runtime/integrations/github-issues.ts:88-165` |
| Medium | Type-safety erosion via open unions and broad request payload shape remains. | `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:116-123` |
| Medium | Tool key normalization logic is duplicated outside contracts-level canonical mapping. | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts:70-91`, contracts mapping exports in `packages/contracts/src/index.ts:22-44` |
| Medium | Shared domain package remains inactive, so cross-context model consolidation is still deferred. | `packages/domain/README.md:11-20`, `packages/domain/package.json:8` |

## Evidence Refresh Delta (2026-05-19)

### Closed Since Previous Review
- Contracts isolation breach is closed: `packages/contracts/src/parity.guard.ts` is package-local and no longer imports `apps/*` types.
- Model availability fail-open on DB read error is closed: startup check now fails closed (`fallback=deny`) in `apps/backend/src/server.ts:92-103`.
- Frontend temporary debug endpoint finding is closed: `apps/frontend/server.mjs` no longer exposes the previously reported debug route and now handles only health, proxy, static, and SPA fallback.

### Still Open / Updated
- Core architecture risk moved from single-file `auth-http.ts` to oversized runtime + handler modules under `apps/backend/src/lib/runtime/auth-http/`.
- Generation and ToolPage orchestration remain large single-point mutation surfaces.
- Operational logging volume in admin and integration paths remains above governance target for production-sensitive flows.

## Priority Remediation Order
1. Enforce strict CSRF startup invariants (non-empty trusted origin set when CSRF is enabled) and fail fast on invalid security posture.
2. Decompose backend runtime routing into bounded modules with declarative route registration and smaller handler units.
3. Split `generation-system.definition.ts` and `tool-page.machine.ts` into narrower orchestration/policy/projection slices.
4. Reduce or gate verbose debug logs in admin and external integration flows with environment-based policy.
5. Converge tool-key normalization to contracts-level canonical mapping only.
