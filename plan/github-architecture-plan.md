---
goal: Execute architecture hardening plan for Generation, Usage/Quota, and runtime route maintainability without breaking active flows
version: 1.1
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Backend Platform Team
status: In Progress
tags: [architecture, reliability, security, quota, budget, idempotency, parallelization]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This plan standardizes and executes high-impact architecture corrections for generation routes and quota/budget enforcement in incremental PRs on branch dev. Scope is constrained to preserve active flows for funnel, nextland, youtube-lf-script, and extraction while improving operational safety, deterministic quota/budget behavior, and maintainability.

## 0. Session Kickoff (2026-05-18)

### Environment Readiness Snapshot

- Branch status: `dev` tracking `origin/dev`, clean working tree.
- Recent validation status from session logs:
  - Frontend tests: 45/45 files passed, 305/305 tests passed.
  - Workspace build: passed (`apps/backend` typecheck + `apps/frontend` production build).
- DDD governance gate completed before session prep:
  - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
  - `docs/02-design/domain-bounded-context-map.md`
  - `docs/07-governance/domain-naming-decision-log.md`

### Progressive Implementation Session Contract

1. Start from `dev` only; one task branch per TASK id (`feature/TASK-NNN-*`).
2. Keep each PR scoped to exactly one task objective and its mandatory tests.
3. Preserve canonical guard order and DDD terms (`Artifact`, `GenerationRequest`, `ClaimUsage`, `ToolWorkflow`, `BackendStreamEvent`).
4. Do not merge partial guard changes without their blocking assertions.
5. For behavior-changing runtime work, include corresponding technical doc alignment in the same PR when externally observable.

### Immediate Branch Bootstrap (Wave 1)

```bash
git checkout dev
git pull --ff-only

git checkout -b feature/TASK-002-ownership-state
# implement TASK-002 only

git checkout dev
git checkout -b feature/TASK-004-quota-policy
# implement TASK-004 only
```

### Per-Task Done Gate (before PR open)

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend test -- src/lib/tests/runtime.node-server.test.ts
npm --workspace apps/backend test -- src/lib/tests/runtime.tools-orchestrate.test.ts
```

For adapter/quota tasks, add:

```bash
npm --workspace apps/backend test -- src/lib/tests/usage.machine.test.ts
npm --workspace apps/backend test -- src/lib/adapters/postgres-redis.conflict.smoke.ts
```

### Merge Sequencing Safety Rule

- Merge to `dev` in this strict order for Phase 1: TASK-002 -> TASK-001/TASK-003 -> TASK-004 -> TASK-005 -> TASK-006.
- If sequencing is violated, rebase downstream branches on updated `dev` and re-run the targeted gate before merge.




## 1. Requirements & Constraints

- REQ-001: Enforce guard order in all generation entrypoints as Authentication -> Ownership -> Model Availability -> Usage Guards.
- REQ-002: Prevent any ClaimUsage side effects for unauthorized, forbidden, or not-found requests.
- REQ-003: Use one canonical policy for quota/budget decisions across Redis window and PostgreSQL counters.
- REQ-004: Enforce budget atomically across pre-stream authorization and post-stream final cost settlement.
- REQ-005: Decompose extraction runtime orchestration into dedicated modules without API/SSE contract changes.
- REQ-006: Consolidate duplicated route logic across funnel, nextland, and youtube-lf-script while preserving domain-specific prompt builders.
- REQ-007: Align runtime behavior and technical documentation in the same change set.
- REQ-008: Extend idempotency policy to all generate endpoints with uniform replay/conflict/dedup rules.
- REQ-009: Harden Artifact persistence schema and state transition validity.
- REQ-010: Introduce listing/read projection policy to reduce payload size and query cost.
- SEC-001: No quota/budget mutation is allowed before ownership validation is successful.
- SEC-002: Budget enforcement must remain race-safe for concurrent requests from the same authenticated principal.
- CON-001: Preserve existing external API error contract and SSE event semantics.
- CON-002: Preserve active Tool workflows for funnel, nextland, youtube-lf-script, extraction.
- CON-003: Changes must be delivered as incremental PRs with isolated blast radius.
- GUD-001: Use canonical DDD terms: Artifact, GenerationRequest, ClaimUsage, ToolWorkflow, BackendStreamEvent.
- GUD-002: Do not introduce deprecated aliases as primary names.
- PAT-001: Prefer shared orchestration components with domain-specific adapters for prompt and step mapping.
- PAT-002: Keep route handlers thin; move policy and persistence to dedicated domain/application modules.

## 2. Parallelization Strategy

### Phase 1 Dependency Map

```
TASK-002 (ownership state)          TASK-004 (quota policy)
     ↓                                    ↓
TASK-001 (route guards)            TASK-005 (window reset)
TASK-003 (ownership tests)               ↓
     ↓                              TASK-006 (concurrency tests)
     └────────────┬─────────────────────┘
                  ↓
            PR-1 + PR-2 ready
```

**Critical Path**: TASK-002 → TASK-001 + TASK-003 → (merge PR-1)
                 TASK-004 → TASK-005 → TASK-006 → (merge PR-2)

**Parallelizable without conflict**:
- **Parallel Pair A**: TASK-002 (generation-system.machine.ts) + TASK-004 (adapters policy definition) — code is isolated.
- **Parallel Pair B**: TASK-001 (route entrypoints) + TASK-003 (tests) — can start immediately after TASK-002 completes.
- **Parallel Pair C**: TASK-005 (adapter window reset) + TASK-006 (concurrency tests) — can start after TASK-004 completes; TASK-006 can develop tests in parallel with TASK-005 if a shared concurrency harness is pre-agreed.

**Recommended Execution Timeline**:
- **Wave 1 (Day 1)**: TASK-002 + TASK-004 in parallel branches.
- **Wave 2 (Day 2)**: TASK-001 + TASK-003 (blocked on TASK-002 merge) + TASK-005 (blocked on TASK-004 merge) in parallel.
- **Wave 3 (Day 3)**: TASK-006 (blocked on TASK-005 merge).
- **Wave 4 (Day 4)**: TASK-003 + TASK-006 test results consolidation; PR-1 + PR-2 merge to dev.

**Estimated Impact**: Sequential = 6 days; Parallel = 4 days (33% acceleration).

### Branch Strategy for Parallelization

To avoid merge conflicts while executing Pair A in parallel:

| Branch | Owner | Scope | Merge Point |
| ---|---|---|---|
| `feature/TASK-002-ownership-state` | BE-Team-A | generation-system.machine.ts + generation.adapters.ts | After TASK-002 review; merged to dev before TASK-001 starts |
| `feature/TASK-004-quota-policy` | BE-Team-B | postgres-redis.adapters.ts + shared.ts | After TASK-004 review; merged to dev before TASK-005 starts |
| `feature/TASK-001-route-guards` | BE-Team-A | node-server.ts + auth-http.ts | Depends on TASK-002 branch merge; starts after TASK-002 in dev |
| `feature/TASK-003-ownership-tests` | BE-Team-A | runtime.node-server.test.ts | Depends on TASK-002 branch merge; parallel with TASK-001 |
| `feature/TASK-005-window-reset` | BE-Team-B | postgres-redis.production.ts + migration | Depends on TASK-004 branch merge; starts after TASK-004 in dev |
| `feature/TASK-006-concurrency-tests` | BE-Team-B | usage.machine.test.ts + conflict.smoke.ts | Depends on TASK-005 branch merge; parallel with TASK-005 in final review phase |

**Conflict Avoidance Rules**:
- TASK-002 and TASK-004 do not touch overlapping files → safe parallel development.
- TASK-001 must rebase on TASK-002 after merge to dev.
- TASK-005 must rebase on TASK-004 after merge to dev.
- Merge to dev is sequential: TASK-002 → TASK-001/TASK-003 → TASK-004 → TASK-005 → TASK-006.

---

## 3. Implementation Steps

### Implementation Phase 1

- GOAL-001: Deliver PR-1 and PR-2 for P0 guard correctness and deterministic quota/budget policy.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Update generation route entrypoints in apps/backend/src/lib/runtime/node-server.ts and apps/backend/src/lib/runtime/auth-http.ts to enforce guard sequence Authentication -> Ownership -> Model Availability -> Usage Guards for /generation/stream and /api/tools/orchestrate. | yes | 2026-05-18 |
| TASK-002 | Add ownership gate to generation-system.machine.ts to guarantee no ClaimUsage call for ownership/not-found failures. Currently apps/backend/src/lib/machines/generation-system.machine.ts:preGenerationGuards has only `idempotency → usage` with no ownership step — add `ownershipCheck` state BEFORE `usage`, backed by a new `OwnershipAdapter` in apps/backend/src/lib/adapters/generation.adapters.ts implemented in apps/backend/src/lib/adapters/postgres-redis.production.ts. Note: apps/backend/src/lib/machines/request-gateway.machine.ts defines the intended guard order but is currently orphaned (not wired into generation-system.machine.ts); this task must wire the ownership step into the real machine, not into the orphaned model. apps/backend/src/lib/machines/usage.machine.ts does not need changes for this task. | yes | 2026-05-18 |
| TASK-003 | Add integration tests in apps/backend/src/lib/tests/runtime.node-server.test.ts and apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts covering forbidden/not-found requests with assertion monthlyUsed unchanged and no quota events emitted. | yes | 2026-05-18 |
| TASK-004 | Define canonical quota/budget decision flow across Redis and PostgreSQL in apps/backend/src/lib/adapters/postgres-redis.adapters.ts, apps/backend/src/lib/adapters/postgres-redis.shared.ts, and apps/backend/src/lib/adapters/postgres-redis.production.ts with deterministic precedence and conflict handling. | yes | 2026-05-18 |
| TASK-005 | Implement automatic quota window reset in the adapter layer: add `quota_window_started_at` column via new migration under packages/infra-db/migrations/, update `claimUsage` in apps/backend/src/lib/adapters/postgres-redis.production.ts to reset the window when it has expired before incrementing. apps/backend/src/lib/machines/usage.machine.ts is a single-invocation `fromPromise` actor — it does not orchestrate the window reset and should not be changed for this; optionally pass `resetDate` back in the UsageDecision output for audit tracing. Include concurrency controls for burst/retry/double-submit paths. | yes | 2026-05-18 |
| TASK-006 | Add deterministic concurrency tests in apps/backend/src/lib/adapters/postgres-redis.conflict.smoke.ts and apps/backend/src/lib/tests/usage.machine.test.ts to verify repeatable decisions under parallel claims. | yes | 2026-05-18 |

### Implementation Phase 2

- GOAL-002: Deliver PR-3 for extraction route decomposition with contract preservation.
- **Parallelization**: Phase 2 can start in **parallel with Phase 1 Wave 2** (after TASK-004 merge to dev) if extraction codebase is isolated from route handlers modified in TASK-001/TASK-005. TASK-007 and TASK-008 are independent and can develop in separate branches.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-007 | Split extraction flow responsibilities in apps/backend/src/lib/runtime/node-server.ts into orchestration, retry/escalation policy, acceptance validation, SSE replay, and terminal persistence modules under apps/backend/src/lib/runtime/, preserving parity for funnel, nextland, and youtube-lf-script flows. | yes | 2026-05-18 |
| TASK-008 | Keep external API/SSE behavior stable by preserving error mapping in apps/backend/src/lib/runtime/error-contract.ts and stream semantics in apps/backend/src/lib/runtime/http-sse.ts and apps/backend/src/lib/runtime/stream-contract.ts. | yes | 2026-05-18 |
| TASK-009 | Add regression tests in apps/backend/src/lib/tests/runtime.http-sse.test.ts and apps/backend/src/lib/tests/generation-system.runtime.test.ts validating unchanged SSE event order and Artifact terminal states generating/completed/failed, with explicit coverage for youtube-lf-script alongside funnel and nextland. | yes | 2026-05-18 |

### Implementation Phase 3

- GOAL-003: Deliver PR-4 for shared generation flow consolidation and docs/runtime alignment.
- **Parallelization**: Phase 3 can start in **parallel with Phase 2** (after Phase 1 PR merge). TASK-010 and TASK-011 are independent extraction of shared concerns; TASK-012 must follow Phase 1, 2, 3 completion. Recommended: TASK-010/TASK-011 run parallel to Phase 2 extraction; TASK-012 is final synchronization.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-010 | Extract shared generation route pipeline (auth/ownership/model/usage/deadline/error/logging) into reusable module consumed by generation handlers in apps/backend/src/lib/runtime/auth-http.ts and apps/backend/src/lib/runtime/tool-workflow-registry.ts, requiring regression coverage parity for funnel, nextland, and youtube-lf-script route paths. | yes | 2026-05-18 |
| TASK-011 | Keep domain-specific logic isolated to prompt builders and step mappings in apps/backend/src/lib/runtime/tool-prompts/index.ts and workflow normalizers in apps/backend/src/lib/runtime/workflow-normalizers.ts, with explicit test coverage for youtube-lf-script prompt/step mapping alongside funnel and nextland. | yes | 2026-05-18 |
| TASK-012 | Update operational docs to match runtime truth: docs/02-design/domain-bounded-context-map.md and docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md only where behavior is implemented and externally observable. | yes | 2026-05-18 |

### Implementation Phase 4

- GOAL-004: Deliver PR-5 for idempotency extension, Artifact schema hardening, and read/list performance contracts.
- **Parallelization**: Phase 4 can start in **parallel with Phase 3** (after Phase 1 PR merge). TASK-013, TASK-014, TASK-015 are independent systems; TASK-016 consolidates test coverage. Recommended: TASK-013 (idempotency REST) and TASK-014 (schema hardening) develop in parallel; TASK-015 (projections) starts after TASK-014; TASK-016 follows.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-013 | Extend idempotency coordinator to the REST orchestrate endpoint: apps/backend/src/lib/machines/idempotency-coordinator.machine.ts is already wired into apps/backend/src/lib/machines/generation-system.machine.ts:preGenerationGuards.idempotency for the SSE path — no changes needed there. The gap is apps/backend/src/lib/runtime/auth-http.ts:handleToolsOrchestrate, which has no idempotency check; apply a separate invocation of idempotencyCoordinatorMachine (or equivalent adapter call) via apps/backend/src/lib/runtime/request-contract.ts to cover the REST orchestrate path with the same replay/conflict/dedup policy. | yes | 2026-05-18 |
| TASK-014 | Harden Artifact domain schema and transition validity in apps/backend/src/lib/types/artifact.ts and apps/backend/src/lib/types/artifacts.ts by replacing free-form status/reason/type strings with constrained domain unions/enums and transition guards. | yes | 2026-05-18 |
| TASK-015 | Implement projection policy for list/read endpoints to avoid returning full input/content unless explicitly requested in apps/backend/src/lib/runtime/auth-http/projects-handlers.ts and persistence adapters. | yes | 2026-05-18 |
| TASK-016 | Add coverage in apps/backend/src/lib/tests/idempotency.machine.test.ts, apps/backend/src/lib/tests/runtime.index.test.ts, and apps/backend/src/lib/tests/generation-session.integration.test.ts for dedup behavior, schema validity, and projection response contracts. | yes | 2026-05-18 |

### Phase Parallelization Summary

```
Timeline (days):
Day 1         Day 2         Day 3         Day 4         Day 5-6
├─────────┼─────────┼─────────┼─────────┼─────────┤
Phase 1 Wave 1 → Phase 1 Wave 2-3 → Phase 1 test consolidation + merge
                  ├─ Phase 2 (parallel, Wave 1) ┤ → Phase 2 test consolidation + merge
                  ├─ Phase 3 (parallel, Wave 1) ┤ → Phase 3 consolidation + merge
                  ├─ Phase 4 (parallel, Wave 1) ┤ → Phase 4 consolidation + merge
                                                      Phase 5 quality gates (all PRs ready)
```

**Estimated Timeline**:
- Sequential execution: 12 days (20 tasks × avg 0.6 days each).
- Parallel execution: 6-7 days (critical path: Phase 1 + max(Phase 2, Phase 3, Phase 4) + Phase 5).
- **Parallelization savings**: ~45% time reduction.

---

### Implementation Phase 5

- GOAL-005: Execute quality gates and release acceptance criteria for each PR.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-017 | Run mandatory CI-equivalent checks at workspace root: npm run typecheck, npm run lint, npm test, npm run build. |  |  |
| TASK-018 | Execute targeted integration suite for auth/ownership/rate-limit/error contract and SSE persistence invariants. |  |  |
| TASK-019 | Verify no regressions in Artifact lifecycle persistence for generating/completed/failed in runtime and adapter integration tests. |  |  |
| TASK-020 | Ensure technical documentation updates are included in the same PR as runtime behavior changes. |  |  |

## 3. Alternatives

- ALT-001: Single large refactor PR for all P0/P1/P2 items was rejected due to high blast radius and reduced rollback safety.
- ALT-002: Keep current dual-source quota logic without deterministic precedence was rejected due to audit drift risk between Redis and PostgreSQL.
- ALT-003: Enforce budget only pre-stream was rejected because final cost settlement can exceed threshold in concurrent scenarios.
- ALT-004: Keep route-specific duplicated logic for funnel, nextland, and youtube-lf-script was rejected because divergence risk increases defect recurrence.

## 4. Dependencies & Execution Coordination

### Inter-Phase Dependencies

- **Phase 1 → Phase 2/3/4**: Phase 1 PR-1 + PR-2 must merge to dev before Phase 2/3/4 development can proceed. However, Phase 2/3/4 can develop in isolation on separate branches in parallel with Phase 1.
- **Phase 2 ↔ Phase 3 ↔ Phase 4**: No blocking dependencies. Can execute fully in parallel after Phase 1 merge.
- **Phases 2-4 → Phase 5**: All Phase 2/3/4 PRs must merge to dev before Phase 5 quality gates execute.

### Code Module Dependencies

- DEP-001: Runtime route layer under apps/backend/src/lib/runtime/ — shared by TASK-001, TASK-007, TASK-010, TASK-013.
  - **Isolation Strategy**: TASK-001 modifies route guard entry points; TASK-007 extracts extraction flow; TASK-010 consolidates shared pipeline; TASK-013 adds idempotency REST wrapper. Execute in sequence: TASK-001 → TASK-007 → TASK-010 → TASK-013 to dev.
  - **Parallel Development**: TASK-007 and TASK-010 can develop on separate branches (`feature/TASK-007-extraction`, `feature/TASK-010-shared-pipeline`) in parallel, then rebase/merge sequentially to dev.

- DEP-002: State machine layer under apps/backend/src/lib/machines/ — owned by TASK-002, TASK-013.
  - **Isolation Strategy**: TASK-002 adds ownership state to `generation-system.machine.ts`; TASK-013 wires idempotency to REST handler. Independent file paths → safe parallel.

- DEP-003: Adapter layer for Redis/PostgreSQL under apps/backend/src/lib/adapters/ — owned by TASK-004, TASK-005, TASK-015.
  - **Isolation Strategy**: TASK-004 defines quota/budget policy; TASK-005 implements window reset; TASK-015 adds projection layer. TASK-005 depends on TASK-004; TASK-015 is independent.

- DEP-004: Domain type layer for Artifact under apps/backend/src/lib/types/ — owned by TASK-008, TASK-009, TASK-014.
  - **Isolation Strategy**: TASK-014 hardens Artifact schema; TASK-008/TASK-009 validate SSE contracts. TASK-014 must complete before TASK-008/TASK-009 final review.

- DEP-005: Test harness under apps/backend/src/lib/tests/ — owned by TASK-003, TASK-006, TASK-009, TASK-016.
  - **Isolation Strategy**: Each task owns its test file; parallel development is safe if test hooks/fixtures are shared in a common module.

- DEP-006: Canonical domain governance docs — owned by TASK-012, already updated in prior DDD audit step.

### Recommended Coordination Model

1. **Wave-based orchestration**: Assign teams to Wave 1 (Phase 1), then rotate to Wave 2 (Phase 2/3/4 parallel).
2. **Branch prefix convention**: `feature/TASK-NNN-*` ensures easy tracking.
3. **Merge sequence contract**: Sequential merge to dev prevents rebase conflicts; parallel branch development is safe.
4. **Test stability gate**: All tests must pass on each merge to dev before next phase/task can merge.

## 5. Files

- FILE-001: apps/backend/src/lib/runtime/node-server.ts - generation route orchestration and guard order.
- FILE-002: apps/backend/src/lib/runtime/auth-http.ts - tool orchestrate and generation handlers (handleToolsOrchestrate, handleToolsBriefUpload, handleToolsHydrate).
- FILE-003: apps/backend/src/lib/machines/request-gateway.machine.ts - models the intended guard sequence (auth → ownership → modelCheck → usage) but is currently ORPHANED: it is exported from machines/index.ts but not wired into generation-system.machine.ts or any generation entrypoint. TASK-002 must add the ownership step directly to generation-system.machine.ts; this file is a candidate for wiring as an audit/telemetry machine or removal after TASK-002 is done.
- FILE-004: apps/backend/src/lib/machines/usage.machine.ts - single-invocation fromPromise actor that delegates to adapters.usage.claimUsage; contains no quota window/reset logic (that belongs in the adapter layer). Has a RETRY event on the checking state for retry-of-claim only.
- FILE-005: apps/backend/src/lib/machines/idempotency-coordinator.machine.ts - dedup and replay policy.
- FILE-006: apps/backend/src/lib/adapters/postgres-redis.adapters.ts - quota/budget data access orchestration.
- FILE-007: apps/backend/src/lib/adapters/postgres-redis.shared.ts - shared consistency/reset logic.
- FILE-008: apps/backend/src/lib/types/artifact.ts - Artifact schema and transition constraints.
- FILE-009: apps/backend/src/lib/runtime/request-contract.ts - request and idempotency contract.
- FILE-010: apps/backend/src/lib/tests/runtime.node-server.test.ts - route guard and error contract tests.
- FILE-011: apps/backend/src/lib/tests/runtime.http-sse.test.ts - SSE behavior and replay regression tests.
- FILE-012: apps/backend/src/lib/tests/usage.machine.test.ts - quota/budget deterministic tests.
- FILE-013: apps/backend/src/lib/tests/idempotency.machine.test.ts - idempotency replay/conflict tests.
- FILE-014: docs/02-design/domain-bounded-context-map.md - architecture and guard order documentation (updated in DDD audit).
- FILE-015: docs/07-governance/domain-naming-decision-log.md - naming decisions if new terms become necessary (updated in DDD audit).

- TEST-001: Unauthorized/forbidden/not-found generate requests do not mutate monthlyUsed, monthlySpent, or quota event history.
- TEST-002: Guard order is identical across /generation/stream and /api/tools/orchestrate.
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

