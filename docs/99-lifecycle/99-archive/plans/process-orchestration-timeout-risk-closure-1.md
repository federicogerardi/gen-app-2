---
goal: Close Orchestration Step Scalability and Structural Timeout Risk for POST /api/tools/orchestrate
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Backend Architecture
status: Completed
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [process, architecture, scalability, backend, generation]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Deterministic implementation plan to close the open HIGH finding on ToolStepOrchestration scalability: full completed-artifact scans per request, conditional N+1 detail fetches, and fixed 3000 ms route deadline in the orchestrate path.

## 1. Requirements & Constraints

- REQ-001: Keep API contract for POST /api/tools/orchestrate response unchanged (`orchestration.toolKey`, `targetStep`, `stepDependencyArtifactIds`, `dependencyArtifactIdsByStep`).
- REQ-002: Preserve canonical backend authority for ToolStepOrchestration in `resolveStepDependencyIds` and `/api/tools/orchestrate`.
- REQ-003: Replace fixed orchestrate timeout with configurable budget while keeping deterministic timeout handling (`503 service_unavailable`, code path unchanged).
- REQ-004: Remove unbounded completed-artifact scan in orchestrate execution path by introducing bounded query strategy.
- REQ-005: Remove per-artifact detail fetch loop pattern for step resolution by introducing batch-oriented detail projection fallback.
- SEC-001: Do not weaken existing auth/ownership/idempotency guards in the route pipeline.
- QLT-001: Preserve behavior for artifacts with and without persisted `step_key` values.
- CON-001: Keep DDD terminology consistent with existing canonical terms (`ToolStepOrchestration`, `Artifact`, `ToolWorkflowPersistenceMetadata`, `ToolKey`).
- CON-002: Do not introduce breaking changes in `packages/contracts` for this closure.
- GUD-001: Keep changes minimal and localized to orchestrate path, runtime registry, and query adapter interfaces.
- PAT-001: Prefer query-time filtering and batching over in-memory full scans.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Introduce deterministic orchestration configuration and observability baseline.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add orchestrate timeout config key in backend runtime config (default 3000 for backward compatibility), wire into `createToolsOrchestrateHandlers` replacing literal `createGenerationRouteDeadline(3000)` in `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`. Include explicit parse/validation guard for non-positive values. | ✅ | 2026-05-21 |
| TASK-002 | Add structured timing logs/metrics fields in orchestrate route path (`artifactSummaryCount`, `artifactDetailBatchCount`, `deadlineMs`, `elapsedMs`) using existing route pipeline logging points in `apps/backend/src/lib/runtime/generation-route-pipeline.ts` and orchestrate handler metadata wrapper. | ✅ | 2026-05-21 |
| TASK-003 | Add regression tests verifying timeout config behavior: default path, custom higher budget path, invalid config fallback path in `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts`. | ✅ | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Eliminate unbounded artifact scans in orchestrate pre-resolution step.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Extend artifact query interface to support bounded lookup for orchestrate (`userId`, `projectId`, `status=completed`, `workflowType`, bounded limit) in `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts` and implement in production adapter `apps/backend/src/lib/adapters/postgres-redis.production.ts`. | ✅ | 2026-05-21 |
| TASK-005 | Update orchestrate handler to call bounded query API instead of broad `listArtifactsByUser(...status: completed)` in `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`. Configure deterministic limit constant with config override. | ✅ | 2026-05-21 |
| TASK-006 | Add tests asserting bounded query usage and ordering determinism for large synthetic artifact history in `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts` and stub adapter behavior in `apps/backend/src/lib/adapters/postgres-redis.stub.ts`. | ✅ | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Remove conditional N+1 detail fetch path from step mapping resolution.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Add batch detail fetch method for artifact inputs (`getArtifactsByIdsForUser` with projection `{ includeInput: true }`) to adapter interface and production implementation. Ensure single SQL round-trip using `WHERE id = ANY($n)` and stable map reconstruction by id. | ✅ | 2026-05-21 |
| TASK-008 | Refactor `buildCompletedArtifactsByStep` in `apps/backend/src/lib/runtime/tool-workflow-registry.ts` to use two-pass strategy: pass 1 consume `stepKey` directly; pass 2 batch-fetch only missing-step artifacts and resolve via `extractStepFromArtifactInput`; remove per-item awaited calls inside loop. | ✅ | 2026-05-21 |
| TASK-009 | Add targeted unit tests for `buildCompletedArtifactsByStep` covering mixed datasets (`stepKey` present, missing, null input, duplicates) and assert deterministic first-hit behavior by updated order. | ✅ | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Validate scalability closure with measurable gates and update governance evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add backend integration benchmark test harness for orchestrate path (1k, 5k, 10k completed artifacts) capturing p50/p95/p99 and memory deltas under concurrent calls; store results in `docs/04-testing/` as reproducible artifact. | ✅ | 2026-05-21 |
| TASK-011 | Re-run full backend validation gates (`typecheck`, focused orchestrate tests, full backend suite) and capture exact pass/fail counts in closure notes. | ✅ | 2026-05-21 |
| TASK-012 | Update finding status and anchors in `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md`, correcting moved registry path (`apps/backend/src/lib/runtime/tool-workflow-registry.ts`) and recording closure evidence references. | ✅ | 2026-05-21 |

## 3. Alternatives

- ALT-001: Increase timeout only (for example 3000 -> 8000) without query/algorithm changes. Rejected because it masks structural inefficiency and does not remove scan/N+1 cost growth.
- ALT-002: Introduce distributed cache layer for orchestrate dependency maps. Rejected for first closure cycle because complexity is higher than needed and invalidation semantics are non-trivial.
- ALT-003: Precompute step dependency graphs asynchronously after each artifact completion. Rejected for now due to eventual consistency risk and added write-path coupling.

## 4. Dependencies

- DEP-001: Existing artifact query adapter contracts (`ArtifactQueryRepository`) in backend adapters package.
- DEP-002: Runtime route pipeline deadline/error behavior in `apps/backend/src/lib/runtime/generation-route-pipeline.ts`.
- DEP-003: Tool workflow ordering and resolution utilities in `apps/backend/src/lib/runtime/tool-workflow-registry.ts`.
- DEP-004: Governance review document for finding lifecycle in `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md`.

## 5. Files

- FILE-001: apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts
- FILE-002: apps/backend/src/lib/runtime/tool-workflow-registry.ts
- FILE-003: apps/backend/src/lib/runtime/generation-route-pipeline.ts
- FILE-004: apps/backend/src/lib/adapters/postgres-redis.interfaces.ts
- FILE-005: apps/backend/src/lib/adapters/postgres-redis.production.ts
- FILE-006: apps/backend/src/lib/adapters/postgres-redis.stub.ts
- FILE-007: apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts
- FILE-008: docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- FILE-009: docs/04-testing/streaming-generator-debug-runbook.md

## 6. Testing

- TEST-001: Unit tests for batch step-resolution fallback in workflow registry (`buildCompletedArtifactsByStep`).
- TEST-002: Route tests for orchestrate timeout configurability and deterministic 503 mapping on deadline exceeded.
- TEST-003: Adapter tests for bounded completed-artifact query semantics (filters + ordering + limit).
- TEST-004: Integration tests for orchestrate correctness on mixed artifact history (legacy and normalized metadata).
- TEST-005: Scalability benchmark run with representative dataset sizes and concurrent orchestrate invocations.

## 7. Execution Checklist (Command Order + Pass/Fail Gates)

| Step | Command | Scope | Pass Criteria | Fail Criteria |
|------|---------|-------|---------------|---------------|
| EXEC-001 | `npm --workspace apps/backend run typecheck` | Backend static typing | Exit code 0 and no TypeScript errors | Non-zero exit code or any TypeScript error |
| EXEC-002 | `cd apps/backend && node --import tsx --test src/lib/tests/runtime.tools-orchestrate.test.ts` | Focused orchestrate regression suite | Exit code 0 and all tests passing in target file | Non-zero exit code, failing test, or runtime crash |
| EXEC-003 | `cd apps/backend && node --import tsx --test src/lib/tests/runtime.tool-workflow-registry.test.ts` | Registry dependency-resolution unit suite | Exit code 0 and all tests passing in target file | Non-zero exit code, failing test, or runtime crash |
| EXEC-004 | `npm --workspace apps/backend run test` | Full backend regression suite | Exit code 0 and no failing tests | Non-zero exit code or any failing test |
| EXEC-005 | `npm --workspace apps/backend run bench:orchestrate` | Scalability benchmark gate (1k, 5k, 10k artifacts; concurrent runs) | Benchmark report produced; p99 does not regress versus baseline; no OOM; no timeout explosion | Missing report, p99 regression beyond baseline tolerance, OOM, or structural timeout increase |
| EXEC-006 | `npm --workspace apps/backend run test -- --coverage` | Safety coverage gate for modified path | Exit code 0 and coverage report generated | Non-zero exit code or report generation failure |

| Gate | Rule | Outcome on Fail |
|------|------|-----------------|
| GATE-001 | Steps must run in strict order EXEC-001 -> EXEC-006 | Stop execution immediately and open remediation task |
| GATE-002 | Any failed step blocks finding closure and governance update | Keep finding status as open |
| GATE-003 | Governance update is allowed only after all steps pass | Do not edit closure status section |

| Artifact | Required Output | Location |
|---------|------------------|----------|
| OUT-001 | Typecheck and test command transcripts (summary form) | Closure notes in `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md` |
| OUT-002 | Benchmark report with p50/p95/p99 and memory deltas | `docs/04-testing/` |
| OUT-003 | Updated finding anchors and closure evidence list | `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md` |

## 8. Risks & Assumptions

- RISK-001: Legacy artifacts missing `toolWorkflow.stepKey` may still require detail fetch fallback; mitigated by batch fetch path.
- RISK-002: Tight bounded limits can truncate required dependencies for very old sessions; mitigated by deterministic ordering and limit tuning from benchmark data.
- RISK-003: Timeout increase without performance gains could hide regressions; mitigated by mandatory p99 and memory benchmarks before closure.
- ASSUMPTION-001: Artifact ordering by `updated_at DESC, id DESC` is stable enough to support deterministic first-hit step mapping.
- ASSUMPTION-002: Existing idempotency replay flow remains unaffected by orchestrate query strategy changes.
- ASSUMPTION-003: No contract changes are required on frontend for this closure cycle.

## 9. Related Specifications / Further Reading

- docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md
- plan/process-auth-http-finding-closure-ddd-1.md
