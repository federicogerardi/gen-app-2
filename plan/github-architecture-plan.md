---
goal: Execute architecture hardening plan for Generation, Usage/Quota, and runtime route maintainability without breaking active flows
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Backend Platform Team
status: In Progress
tags: [architecture, reliability, security, quota, budget, idempotency]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This plan standardizes and executes high-impact architecture corrections for generation routes and quota/budget enforcement in incremental PRs on branch dev. Scope is constrained to preserve active flows for funnel, nextland, and extraction while improving operational safety, deterministic quota/budget behavior, and maintainability.

## Progress Notes

### 2026-05-18

- Scope delivered in current change set:
	- Added pre-stream authorization gate in runtime to enforce Authentication and Ownership before Model Availability and Usage Guards.
	- Added deterministic rolling quota window reset in PostgreSQL usage claim path with atomic reset+consume flow.
	- Added migration `20260518_000010_usage_quota_window_reset.sql` to persist quota window anchor (`quota_window_started_at`).
	- Updated runtime debug runbook to document effective guard order as-is.
- Validation executed:
	- Backend typecheck: passed.
	- Targeted integration/runtime tests: passed (`runtime.node-server`, `runtime.auth-http`, `generation-system.runtime`).
	- Workspace build: passed.
- Expected effect:
	- Unauthorized/forbidden ownership failures are rejected before usage mutation.
	- Quota window reset is deterministic and not dependent on manual admin reset.
- Open gaps in this plan phase:
	- Explicit no-quota-burn assertions for forbidden/not-found paths are still pending dedicated integration coverage.
	- Canonical quota/budget precedence across Redis and PostgreSQL is partially implemented; final deterministic conflict policy and concurrency stress tests remain open.
	- End-to-end budget atomic settlement (pre-stream authorization + post-stream final cost) remains open.
- Next execution slice:
	- Complete TASK-002, TASK-003, TASK-004, and TASK-006 before advancing to extraction decomposition (Phase 2).

## 1. Requirements & Constraints

- REQ-001: Enforce guard order in all generation entrypoints as Authentication -> Ownership -> Model Availability -> Usage Guards.
- REQ-002: Prevent any ClaimUsage side effects for unauthorized, forbidden, or not-found requests.
- REQ-003: Use one canonical policy for quota/budget decisions across Redis window and PostgreSQL counters.
- REQ-004: Enforce budget atomically across pre-stream authorization and post-stream final cost settlement.
- REQ-005: Decompose extraction runtime orchestration into dedicated modules without API/SSE contract changes.
- REQ-006: Consolidate duplicated route logic between funnel and nextland while preserving domain-specific prompt builders.
- REQ-007: Align runtime behavior and technical documentation in the same change set.
- REQ-008: Extend idempotency policy to all generate endpoints with uniform replay/conflict/dedup rules.
- REQ-009: Harden Artifact persistence schema and state transition validity.
- REQ-010: Introduce listing/read projection policy to reduce payload size and query cost.
- SEC-001: No quota/budget mutation is allowed before ownership validation is successful.
- SEC-002: Budget enforcement must remain race-safe for concurrent requests from the same authenticated principal.
- CON-001: Preserve existing external API error contract and SSE event semantics.
- CON-002: Preserve active Tool workflows for funnel, nextland, extraction.
- CON-003: Changes must be delivered as incremental PRs with isolated blast radius.
- GUD-001: Use canonical DDD terms: Artifact, GenerationRequest, ClaimUsage, ToolWorkflow, BackendStreamEvent.
- GUD-002: Do not introduce deprecated aliases as primary names.
- PAT-001: Prefer shared orchestration components with domain-specific adapters for prompt and step mapping.
- PAT-002: Keep route handlers thin; move policy and persistence to dedicated domain/application modules.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Deliver PR-1 and PR-2 for P0 guard correctness and deterministic quota/budget policy.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Update generation route entrypoints in apps/backend/src/lib/runtime/node-server.ts and apps/backend/src/lib/runtime/auth-http/tools-handlers.ts to enforce guard sequence Authentication -> Ownership -> Model Availability -> Usage Guards for /api/artifacts/generate and /api/tools/*/generate. | In progress | 2026-05-18 |
| TASK-002 | Refactor usage gate invocation to guarantee no ClaimUsage call for ownership/not-found failures in apps/backend/src/lib/machines/request-gateway.machine.ts and apps/backend/src/lib/machines/usage.machine.ts. |  |  |
| TASK-003 | Add integration tests in apps/backend/src/lib/tests/runtime.node-server.test.ts and apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts covering forbidden/not-found requests with assertion monthlyUsed unchanged and no quota events emitted. |  |  |
| TASK-004 | Define canonical quota/budget decision flow across Redis and PostgreSQL in apps/backend/src/lib/adapters/postgres-redis.adapters.ts, apps/backend/src/lib/adapters/postgres-redis.shared.ts, and apps/backend/src/lib/adapters/postgres-redis.production.ts with deterministic precedence and conflict handling. |  |  |
| TASK-005 | Implement automatic reset strategy aligned with policy window and persist resetDate coherently in apps/backend/src/lib/machines/usage.machine.ts and adapter layer; include concurrency controls for burst/retry/double-submit paths. | In progress | 2026-05-18 |
| TASK-006 | Add deterministic concurrency tests in apps/backend/src/lib/adapters/postgres-redis.conflict.smoke.ts and apps/backend/src/lib/tests/usage.machine.test.ts to verify repeatable decisions under parallel claims. |  |  |

### Implementation Phase 2

- GOAL-002: Deliver PR-3 for extraction route decomposition with contract preservation.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-007 | Split extraction flow responsibilities in apps/backend/src/lib/runtime/node-server.ts into orchestration, retry/escalation policy, acceptance validation, SSE replay, and terminal persistence modules under apps/backend/src/lib/runtime/. |  |  |
| TASK-008 | Keep external API/SSE behavior stable by preserving error mapping in apps/backend/src/lib/runtime/error-contract.ts and stream semantics in apps/backend/src/lib/runtime/http-sse.ts and apps/backend/src/lib/runtime/stream-contract.ts. |  |  |
| TASK-009 | Add regression tests in apps/backend/src/lib/tests/runtime.http-sse.test.ts and apps/backend/src/lib/tests/generation-system.runtime.test.ts validating unchanged SSE event order and Artifact terminal states generating/completed/failed. |  |  |

### Implementation Phase 3

- GOAL-003: Deliver PR-4 for shared generation flow consolidation and docs/runtime alignment.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-010 | Extract shared generation route pipeline (auth/ownership/model/usage/deadline/error/logging) into reusable module consumed by funnel and nextland handlers in apps/backend/src/lib/runtime/auth-http/tools-handlers.ts and apps/backend/src/lib/runtime/tool-workflow-registry.ts. |  |  |
| TASK-011 | Keep domain-specific logic isolated to prompt builders and step mappings in apps/backend/src/lib/runtime/tool-prompts/index.ts and workflow normalizers in apps/backend/src/lib/runtime/workflow-normalizers.ts. |  |  |
| TASK-012 | Update operational docs to match runtime truth: docs/02-design/domain-bounded-context-map.md and docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md only where behavior is implemented and externally observable. |  |  |

### Implementation Phase 4

- GOAL-004: Deliver PR-5 for idempotency extension, Artifact schema hardening, and read/list performance contracts.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-013 | Extend idempotency coordinator to all generate endpoints with uniform replay/conflict/dedup policy in apps/backend/src/lib/machines/idempotency-coordinator.machine.ts, apps/backend/src/lib/machines/generation-system.machine.ts, and apps/backend/src/lib/runtime/request-contract.ts. |  |  |
| TASK-014 | Harden Artifact domain schema and transition validity in apps/backend/src/lib/types/artifact.ts and apps/backend/src/lib/types/artifacts.ts by replacing free-form status/reason/type strings with constrained domain unions/enums and transition guards. |  |  |
| TASK-015 | Implement projection policy for list/read endpoints to avoid returning full input/content unless explicitly requested in apps/backend/src/lib/runtime/auth-http/projects-handlers.ts and persistence adapters. |  |  |
| TASK-016 | Add coverage in apps/backend/src/lib/tests/idempotency.machine.test.ts, apps/backend/src/lib/tests/runtime.index.test.ts, and apps/backend/src/lib/tests/generation-session.integration.test.ts for dedup behavior, schema validity, and projection response contracts. |  |  |

### Implementation Phase 5

- GOAL-005: Execute quality gates and release acceptance criteria for each PR.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-017 | Run mandatory CI-equivalent checks at workspace root: npm run typecheck, npm run lint, npm test, npm run build. | In progress | 2026-05-18 |
| TASK-018 | Execute targeted integration suite for auth/ownership/rate-limit/error contract and SSE persistence invariants. | Yes | 2026-05-18 |
| TASK-019 | Verify no regressions in Artifact lifecycle persistence for generating/completed/failed in runtime and adapter integration tests. | Yes | 2026-05-18 |
| TASK-020 | Ensure technical documentation updates are included in the same PR as runtime behavior changes. | Yes | 2026-05-18 |

## 3. Alternatives

- ALT-001: Single large refactor PR for all P0/P1/P2 items was rejected due to high blast radius and reduced rollback safety.
- ALT-002: Keep current dual-source quota logic without deterministic precedence was rejected due to audit drift risk between Redis and PostgreSQL.
- ALT-003: Enforce budget only pre-stream was rejected because final cost settlement can exceed threshold in concurrent scenarios.
- ALT-004: Keep route-specific duplicated logic for funnel and nextland was rejected because divergence risk increases defect recurrence.

## 4. Dependencies

- DEP-001: Runtime route layer under apps/backend/src/lib/runtime/.
- DEP-002: State machine layer under apps/backend/src/lib/machines/.
- DEP-003: Adapter layer for Redis/PostgreSQL under apps/backend/src/lib/adapters/.
- DEP-004: Domain type layer for Artifact and request contracts under apps/backend/src/lib/types/ and apps/backend/src/lib/runtime/.
- DEP-005: Test harness under apps/backend/src/lib/tests/.
- DEP-006: Canonical domain governance docs under docs/01-requirements/, docs/02-design/, docs/07-governance/.

## 5. Files

- FILE-001: apps/backend/src/lib/runtime/node-server.ts - generation route orchestration and guard order.
- FILE-002: apps/backend/src/lib/runtime/auth-http/tools-handlers.ts - tool generate handlers.
- FILE-003: apps/backend/src/lib/machines/request-gateway.machine.ts - pre-authorization and usage gating.
- FILE-004: apps/backend/src/lib/machines/usage.machine.ts - ClaimUsage and quota/budget state logic.
- FILE-005: apps/backend/src/lib/machines/idempotency-coordinator.machine.ts - dedup and replay policy.
- FILE-006: apps/backend/src/lib/adapters/postgres-redis.adapters.ts - quota/budget data access orchestration.
- FILE-007: apps/backend/src/lib/adapters/postgres-redis.shared.ts - shared consistency/reset logic.
- FILE-008: apps/backend/src/lib/types/artifact.ts - Artifact schema and transition constraints.
- FILE-009: apps/backend/src/lib/runtime/request-contract.ts - request and idempotency contract.
- FILE-010: apps/backend/src/lib/tests/runtime.node-server.test.ts - route guard and error contract tests.
- FILE-011: apps/backend/src/lib/tests/runtime.http-sse.test.ts - SSE behavior and replay regression tests.
- FILE-012: apps/backend/src/lib/tests/usage.machine.test.ts - quota/budget deterministic tests.
- FILE-013: apps/backend/src/lib/tests/idempotency.machine.test.ts - idempotency replay/conflict tests.
- FILE-014: docs/02-design/domain-bounded-context-map.md - architecture and guard order documentation.
- FILE-015: docs/07-governance/domain-naming-decision-log.md - naming decisions if new terms become necessary.

## 6. Testing

- TEST-001: Unauthorized/forbidden/not-found generate requests do not mutate monthlyUsed, monthlySpent, or quota event history.
- TEST-002: Guard order is identical across /api/artifacts/generate and /api/tools/*/generate.
- TEST-003: Concurrent same-user generation requests preserve deterministic quota/budget decisions and prevent uncontrolled overspend.
- TEST-004: Extraction decomposition preserves API error contract and BackendStreamEvent sequence.
- TEST-005: Shared funnel/nextland generation flow preserves step-specific output behavior.
- TEST-006: Idempotency policy deduplicates retries and returns consistent replay/conflict responses across all generate endpoints.
- TEST-007: Artifact schema rejects invalid status/reason/type combinations and invalid state transitions.
- TEST-008: List/read projection contract reduces payload while preserving detail endpoint correctness.
- TEST-009: End-to-end CI gate passes: typecheck, lint, tests, build.

## 7. Risks & Assumptions

- RISK-001: Hidden coupling in node-server.ts may cause behavior drift during extraction decomposition.
- RISK-002: Budget atomicity changes may surface latent race conditions in adapter transaction boundaries.
- RISK-003: Projection policy changes may break downstream clients relying on previously over-broad payloads.
- RISK-004: Consolidated shared generation flow may accidentally normalize behavior that is intentionally tool-specific.
- ASSUMPTION-001: Existing tests provide enough baseline coverage to detect API/SSE contract regressions.
- ASSUMPTION-002: Redis and PostgreSQL latency characteristics support deterministic decision policy under expected load.
- ASSUMPTION-003: No mandatory external API contract changes are required to complete P0/P1/P2 objectives.

## 8. Related Specifications / Further Reading

docs/01-requirements/domain-ubiquitous-language-glossary.md
docs/02-design/domain-bounded-context-map.md
docs/07-governance/domain-naming-decision-log.md
docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md

