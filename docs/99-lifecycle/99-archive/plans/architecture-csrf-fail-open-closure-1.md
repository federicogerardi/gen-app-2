---
goal: Close critical CSRF fail-open when trusted origins resolve to empty set
version: 1.1
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Backend Architecture
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [architecture, security, backend, csrf]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan closes the critical security weakness where CSRF protection is silently bypassed when trusted origins resolve to an empty list in the Node runtime handler. The plan introduces fail-closed startup invariants, deterministic runtime enforcement, and automated regression tests to prevent future fail-open behavior.

## 1. Requirements & Constraints

- **REQ-001**: CSRF validation must run for protected methods when `csrf.enabled = true` and request path is not excluded.
- **REQ-002**: Runtime startup must fail fast when CSRF is enabled and the resolved trusted origins set is empty.
- **REQ-003**: Runtime startup must fail fast when CSRF is enabled and trusted origins include wildcard `*`.
- **REQ-004**: Trusted origins must be normalized and de-duplicated before runtime use.
- **REQ-005**: Existing CORS invariant (`allowCredentials=true` with wildcard origins forbidden) must remain unchanged.
- **SEC-001**: System must be fail-closed for CSRF posture. Invalid security configuration must throw during handler creation.
- **SEC-002**: No request-time branch may disable CSRF validation solely because trusted origins length is zero.
- **SEC-003**: Origin comparison logic must preserve existing normalization behavior (trim + trailing slash removal).
- **CON-001**: Keep public API shape of `NodeRuntimeServerOptions` backward compatible (no required new fields).
- **CON-002**: No new npm dependencies are allowed.
- **CON-003**: Changes must be limited to backend runtime and related tests/spec artifacts.
- **CON-004**: Before enabling fail-fast in production, deployment configuration must define non-empty trusted origins (`CSRF_TRUSTED_ORIGINS` or fallback chain) to avoid startup outage.
- **GUD-001**: Keep changes atomic and isolated to CSRF enforcement concern.
- **PAT-001**: Security invariants must be enforced at startup (constructor/factory boundary), not deferred to per-request execution.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Introduce deterministic CSRF security invariants at runtime initialization.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `apps/backend/src/lib/runtime/node-server.ts`, add helper `resolveCsrfTrustedOrigins(options)` that computes trusted origins from `options.csrf?.trustedOrigins ?? options.cors?.allowedOrigins ?? []`, normalizes values, and de-duplicates them. | ✅ | 2026-05-19 |
| TASK-002 | In `createNodeRuntimeRequestHandler` (`apps/backend/src/lib/runtime/node-server.ts`), after computing CSRF options, add startup invariant: if `csrfEnabled === true` and resolved trusted origins length is `0`, throw `Error('Invalid CSRF configuration: trustedOrigins must be non-empty when CSRF is enabled')`. | ✅ | 2026-05-19 |
| TASK-003 | In `createNodeRuntimeRequestHandler` (`apps/backend/src/lib/runtime/node-server.ts`), add startup invariant: if `csrfEnabled === true` and resolved trusted origins contain `*`, throw `Error('Invalid CSRF configuration: trustedOrigins cannot include "*" when CSRF is enabled')`. | ✅ | 2026-05-19 |
| TASK-004 | Replace inline assignment at current `csrfTrustedOrigins` declaration in `apps/backend/src/lib/runtime/node-server.ts` with the resolved helper output from TASK-001 to ensure one canonical resolution path. | ✅ | 2026-05-19 |

### Implementation Phase 2

- GOAL-002: Remove request-time fail-open branch and enforce CSRF checks deterministically.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | In request handler condition block in `apps/backend/src/lib/runtime/node-server.ts`, remove `&& csrfTrustedOrigins.length > 0` guard so CSRF gate depends only on `csrfEnabled`, protected method, and non-excluded path. | ✅ | 2026-05-19 |
| TASK-006 | Keep existing `isOriginAllowed(origin, csrfTrustedOrigins)` check unchanged; verify behavior for missing origin remains `false` and returns HTTP 403 with existing error payload (`forbidden`, `CSRF origin check failed`). | ✅ | 2026-05-19 |
| TASK-007 | Add concise code comments near CSRF invariant block in `apps/backend/src/lib/runtime/node-server.ts` explaining why startup fail-fast is required to prevent fail-open runtime behavior. | ✅ | 2026-05-19 |

### Implementation Phase 3

- GOAL-003: Add regression tests and verification gates for critical security closure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | In `apps/backend/src/lib/tests/runtime.node-server.test.ts`, add test case: `createNodeRuntimeRequestHandler` throws when CSRF enabled and both `csrf.trustedOrigins` and `cors.allowedOrigins` resolve to empty. | ✅ | 2026-05-19 |
| TASK-009 | Add test case: `createNodeRuntimeRequestHandler` throws when CSRF enabled and trusted origins include wildcard `*`. | ✅ | 2026-05-19 |
| TASK-010 | Add test case: POST request to non-excluded path with disallowed/missing `Origin` returns 403 when CSRF enabled and trusted origins configured. | ✅ | 2026-05-19 |
| TASK-011 | Add test case: excluded paths in `csrfExcludePaths` bypass CSRF origin gate and preserve current behavior. | ✅ | 2026-05-19 |
| TASK-012 | Execute validation commands from workspace root: `npm --workspace apps/backend run typecheck` and `npm --workspace apps/backend run test`. Record outcome in plan update or follow-up closure note. | ✅ | 2026-05-19 |
| TASK-013 | Update `docs/04-testing/streaming-generator-debug-runbook.md` with a pre-deploy configuration gate: when `CSRF_ENABLED=true`, require at least one trusted origin from `CSRF_TRUSTED_ORIGINS` or fallback `CORS_ALLOWED_ORIGINS`/`FRONTEND_ORIGIN`; if missing, block rollout and remediate environment variables before deploy. | ✅ | 2026-05-19 |
| TASK-014 | Create architecture decision record `docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md` documenting decision drivers, options considered, selected fail-closed startup invariant, rollout gate, and rollback strategy. | ✅ | 2026-05-19 |

## 3. Alternatives

- **ALT-001**: Keep current runtime guard `csrfTrustedOrigins.length > 0` and only add warning logs. Not chosen because warning-only posture keeps a critical fail-open security condition.
- **ALT-002**: Auto-disable CSRF when trusted origins are empty. Not chosen because it silently weakens security posture and violates fail-closed policy.
- **ALT-003**: Force CSRF trusted origins to mirror CORS allowed origins without explicit invariant checks. Not chosen because explicit invalid configuration detection is required for deterministic security.

## 4. Dependencies

- **DEP-001**: `apps/backend/src/lib/runtime/node-server.ts` (primary implementation target).
- **DEP-002**: `apps/backend/src/lib/tests/runtime.node-server.test.ts` (existing runtime node-server test harness).
- **DEP-003**: Existing HTTP utility functions in `apps/backend/src/lib/runtime/http-utils.ts` and origin helper behavior in `apps/backend/src/lib/runtime/node-server.ts`.
- **DEP-004**: Governance reference for severity context: `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md`.
- **DEP-005**: Runtime env resolution path in `apps/backend/src/server.ts` (`CSRF_TRUSTED_ORIGINS ?? CORS_ALLOWED_ORIGINS ?? FRONTEND_ORIGIN`).
- **DEP-006**: Deployment runbook target for rollout gate: `docs/04-testing/streaming-generator-debug-runbook.md`.

## 5. Files

- **FILE-001**: `apps/backend/src/lib/runtime/node-server.ts` — add CSRF configuration resolver, startup invariants, and fail-open guard removal.
- **FILE-002**: `apps/backend/src/lib/tests/runtime.node-server.test.ts` — add startup invariant and runtime request-path regression tests.
- **FILE-003**: `./architecture-csrf-fail-open-closure-1.md` — this implementation plan.
- **FILE-004**: `docs/04-testing/streaming-generator-debug-runbook.md` — add pre-deploy CSRF configuration gate checklist.
- **FILE-005**: `docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md` — architecture decision record for fail-closed CSRF startup behavior.

## 6. Testing

- **TEST-001**: Unit/integration test asserts startup throws for CSRF enabled + empty resolved trusted origins.
- **TEST-002**: Unit/integration test asserts startup throws for CSRF enabled + wildcard trusted origin.
- **TEST-003**: Request test asserts non-excluded protected method returns 403 when origin is missing or not in trusted list.
- **TEST-004**: Request test asserts excluded path bypasses CSRF origin check.
- **TEST-005**: Type safety gate: `npm --workspace apps/backend run typecheck` exits with code 0.
- **TEST-006**: Backend test gate: `npm --workspace apps/backend run test` exits with code 0.

## 7. Risks & Assumptions

- **RISK-001**: Existing deployments with CSRF enabled but no configured trusted origins will fail at startup after fix. This is intentional fail-closed behavior; rollout requires explicit configuration readiness.
- **RISK-002**: Existing runtime-node tests may rely on implicit default CSRF configuration paths; adding fail-fast invariants can require fixture updates in unrelated tests.
- **RISK-003**: If environment-specific defaults inject wildcard origins unexpectedly, startup may fail; deployment config audit must be part of rollout.
- **RISK-004**: Introducing fail-fast without deployment precheck can block server boot in environments that currently rely on implicit empty-origin fallback.
- **ASSUMPTION-001**: Protected methods set (`POST`, `PATCH`, `PUT`, `DELETE`) remains unchanged for current security baseline.
- **ASSUMPTION-002**: Existing consumers depend on current 403 payload shape and this plan preserves it.

## 8. Related Specifications / Further Reading

- [docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md](../docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md)
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md)
- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
- [apps/backend/src/lib/runtime/node-server.ts](../apps/backend/src/lib/runtime/node-server.ts)
- [apps/backend/src/lib/tests/runtime.node-server.test.ts](../apps/backend/src/lib/tests/runtime.node-server.test.ts)
- [apps/backend/src/server.ts](../apps/backend/src/server.ts)
- [docs/04-testing/streaming-generator-debug-runbook.md](../docs/04-testing/streaming-generator-debug-runbook.md)
- [docs/02-design/adr/frontend-data-access-layer-adr.md](../docs/02-design/adr/frontend-data-access-layer-adr.md)
