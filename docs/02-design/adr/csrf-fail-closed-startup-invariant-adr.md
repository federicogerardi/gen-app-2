---
status: accepted
date: 2026-05-19
decision-makers: [Backend Architecture]
related-plan: plan/architecture-csrf-fail-open-closure-1.md
---

# ADR: CSRF Fail-Closed Startup Invariant

## Context

The Node runtime request handler (`apps/backend/src/lib/runtime/node-server.ts`) contained a critical fail-open path: when `csrfEnabled = true` but the resolved trusted origins list was empty, the request-time condition `csrfTrustedOrigins.length > 0` silently skipped CSRF validation for every incoming mutating request. This is a silent security bypass, not a hard failure.

The same runtime defaulted `csrfEnabled` to `true` but resolved `csrfTrustedOrigins` from optional config fields that can legitimately be absent in misconfigured or under-configured deployments.

This issue was identified in the architecture code review documented in `docs/07-governance/architecture-weaknesses-code-review.md`.

## Decision Drivers

- **SEC-001**: A security control that can be silently bypassed by misconfiguration violates the fail-closed principle.
- **PAT-001**: Security invariants must be enforced at startup (constructor/factory boundary), not deferred to per-request execution.
- **CON-001**: No new npm dependencies. No breaking changes to `NodeRuntimeServerOptions` public API shape.

## Options Considered

| Option | Summary | Verdict |
|--------|---------|---------|
| **A — Keep runtime guard, add warning log** | Log a warning when origins are empty instead of throwing. CSRF still silently disabled. | Rejected — warning-only posture keeps fail-open. |
| **B — Auto-disable CSRF on empty origins** | Treat empty origins as implicit `csrf.enabled = false`. | Rejected — silently weakens security; violates fail-closed policy. |
| **C — Fail-fast at factory initialization (selected)** | Throw at handler creation time if CSRF is enabled and origins are empty or contain `*`. Remove the per-request `length > 0` guard. | **Accepted** |

## Decision

**Option C** is selected. `createNodeRuntimeRequestHandler` now enforces two startup invariants immediately after the existing CORS wildcard invariant:

1. If `csrfEnabled === true` and resolved trusted origins length is `0` → throw `Invalid CSRF configuration: trustedOrigins must be non-empty when CSRF is enabled`.
2. If `csrfEnabled === true` and resolved trusted origins contain `*` → throw `Invalid CSRF configuration: trustedOrigins cannot include "*" when CSRF is enabled`.

The per-request `&& csrfTrustedOrigins.length > 0` guard is removed. The CSRF gate now depends only on `csrfEnabled`, protected method, and non-excluded path.

A canonical helper `resolveCsrfTrustedOrigins(options)` consolidates the single resolution path: `csrf.trustedOrigins → cors.allowedOrigins → []`, with normalization and de-duplication.

## Consequences

### Positive
- Misconfigured deployments fail immediately on startup with a clear diagnostic message, not silently during request handling.
- The per-request hot path is simpler: one fewer boolean condition.
- Regression tests cover both startup invariants and request-path behavior.

### Risks and Mitigations
- **RISK-001**: Existing deployments with `CSRF_ENABLED=true` and no configured origins will fail to start after this change. This is the intended behavior; rollout requires environment variables to be configured first. See the pre-deploy gate in `docs/04-testing/streaming-generator-debug-runbook.md`.
- **RISK-002**: Tests that used `createNodeRuntimeRequestHandler` without origins were updated to add `csrf: { enabled: false }` explicitly.

## Rollout Gate

Before deploying to any environment with `CSRF_ENABLED=true` (the default):

1. Confirm at least one of `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, or `FRONTEND_ORIGIN` is set and non-empty.
2. Confirm no configured origin is `*`.
3. Validate startup succeeds (first log lines confirm handler initialization without exception).

## Rollback Strategy

To roll back: revert `apps/backend/src/lib/runtime/node-server.ts` to the prior commit and redeploy. The startup invariants and the fail-open guard removal are contained in a single commit.

## Related Documents

- `plan/architecture-csrf-fail-open-closure-1.md` — implementation plan
- `docs/07-governance/architecture-weaknesses-code-review.md` — original weakness identification
- `docs/04-testing/streaming-generator-debug-runbook.md` — pre-deploy CSRF configuration gate
- `docs/02-design/adr/frontend-data-access-layer-adr.md` — ADR format reference
