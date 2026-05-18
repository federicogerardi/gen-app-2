---
status: active
version: 1.0
last-reviewed: 2026-05-18
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
| Critical | Backend god object: HTTP routing, policy, integration and domain logic are centralized in one file. | `apps/backend/src/lib/runtime/auth-http.ts` (3020 LOC), routing cluster `:2750-3017` |
| Critical | Generation orchestrator is monolithic and mixes responsibilities (routing, metadata, fallback, persistence preparation). | `apps/backend/src/lib/machines/generation-system.machine.ts` (1182 LOC), e.g. `:300-412`, `:414+` |
| High | Frontend Tool runtime is heavily coupled and spread across very large state/runtime units. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (1168), `.../useToolPageRunController.ts` (615), `.../useToolPage.ts` (448) |
| High | Handler modularization is mostly pass-through; logic remains concentrated in `auth-http.ts`. | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts:1-22`, `projects-handlers.ts:34`, `tools-handlers.ts:22` |
| Critical | Contracts package violates isolation by importing from application packages. | `packages/contracts/src/parity.guard.ts:22-23,68-69,91-92` |
| High | Dual parity-guard strategy duplicates authority and increases divergence risk. | `packages/contracts/src/parity.guard.ts`, `apps/frontend/src/features/generation/contracts/backend-stream.parity.guard.ts` |
| Critical | Model availability guard fails open: DB failure enables permissive behavior. | `apps/backend/src/server.ts:105-111`; optional model check in `apps/backend/src/lib/runtime/node-server.ts:54-57` |
| High | Silent degradation in frontend paths (`[]`/`null` fallback) reduces observability and correctness guarantees. | `apps/frontend/src/features/tools/runtime/models-client.ts:58-60`, `.../useToolPage.ts:206-208`, `.../useToolPageRunController.ts:270` |
| High | Temporary debug endpoint is still exposed in frontend server runtime. | `apps/frontend/server.mjs:177-179,218-223` |
| High | Excessive debug logging in sensitive flows (auth/report/github/openrouter) increases operational noise and leakage risk. | `auth-http.ts:1994-2056,2304-2408`, `github-issues.ts:88-172`, `openrouter.adapter.ts:102-113,163-170` |
| Medium | Type-safety erosion via open unions and broad request payload shape. | `apps/backend/src/lib/types/xstate.ts:5-7`, `packages/contracts/src/index.ts:123` |
| Medium | Shared domain package is inactive, so cross-context model consolidation is not implemented. | `packages/domain/README.md:15-20`, `packages/domain/package.json:8` |
| Medium | DDD governance still includes open/provisional decisions in key areas. | `docs/07-governance/domain-naming-decision-log.md:102 (DDD-C-005 open), :61 (DDD-039 provisional), :80 (DDD-059 provisional)` |

## Priority Remediation Order
1. Decompose monoliths: `auth-http.ts`, `generation-system.machine.ts`, `tool-page.machine.ts`.
2. Remove fail-open/silent fallback behavior on model and extraction-critical paths.
3. Restore strict package boundaries for `@gen-app-2/contracts` (no imports from `apps/*`).
4. Remove temporary debug surfaces and reduce production debug logs.
5. Close open/provisional DDD decisions that impact runtime contracts and routing semantics.
