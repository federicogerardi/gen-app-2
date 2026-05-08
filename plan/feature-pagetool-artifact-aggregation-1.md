goal: Implement GenerationSession aggregate and multi-artifact session display for PageTool, with queryable session grouping and artifact role isolation at the database and domain level.
version: 1.3
date_created: 2026-05-07
last_updated: 2026-05-07
owner: Gen-App-2 Domain Architecture & Backend
status: 'Implemented (Phase 1-5 complete; rollout governance follow-ups pending)'
tags: ['feature', 'architecture', 'ddd', 'multi-step-workflows', 'pagetool']
go_review_date: 2026-05-07
go_decision: 'Conditional GO — Architectural sound, operationally incomplete. Execute after 7-action prep (10d effort).'
estimated_effort: '~8 developer-weeks implementation + 10d prep = 12 weeks total'
estimated_timeline: 'Prep: 10d (2026-05-07 to 2026-05-17). Execution: 18d (Phase 1-5) = ~5 weeks total, can parallelize to 4 weeks with 4 developers'

# 🔴 EXECUTIVE GO REVIEW (2026-05-07)

## 📋 TL;DR for Decision Makers

**Decision**: ⚠️ **CONDITIONAL GO** — Execute after 7-action prep work (10 developer-days)

**Why Not GO Today**: Plan specifies what to build (sound architecture) but not *how* to build it (no task dependencies, acceptance criteria, rollback plans).

**Why Conditional GO**: Architecture is correct. We can execute confidently *after* filling operational gaps.

**Next Step**: Stakeholders appoint 7 action owners (DBA, Domain Architect, PM, QA, DevOps). Execute actions in parallel where possible. Go-check: 2026-05-14.

---

## GO Status: ⚠️  CONDITIONAL GO — 7 Action Items Required Before Execution

**Review Date**: 2026-05-07  
**Reviewer**: Domain Architecture & DevOps  
**Decision**: Plan is **architecturally sound** and **DDD-compliant**, but **NOT YET EXECUTABLE** due to critical gaps in acceptance criteria, task dependencies, testing strategy, and contingency planning.

### Summary of Gaps

| Category | Gap | Severity | Resolution Status |
|----------|-----|----------|-------------------|
| **Phase 1 Gate** | No explicit GO gate between Phase 1 (DDD) and Phase 2 (DB); if DDD entries rejected, entire plan blocked | 🔴 CRITICAL | Requires DDD approval mechanism + rollback path |
| **Task Dependencies** | Phase 3 task ordering and inter-task dependencies not documented; TASK-P3-003 must complete before P3-006 but this is implicit | 🔴 CRITICAL | Requires explicit DAG (Directed Acyclic Graph) of task dependencies |
| **Acceptance Criteria** | Each task lacks explicit acceptance criteria (e.g., "P1-001 complete when DDD-047 approved by Domain Architect"); unclear pass/fail gates | 🔴 CRITICAL | Each task needs measurable acceptance criteria + verifier |
| **Backward-Compat Test** | TASK-P5-004 described vaguely; no specific test scenarios for fallback logic (sessionId null, invalid sessionId, heuristic join collision) | 🟠 HIGH | Requires detailed test scenario matrix + mock data |
| **Performance Verification** | NF-001 requires <50ms but no baseline/SLA document; TASK-P5-010 has no acceptance threshold (is 55ms a pass or fail?) | 🟠 HIGH | Add explicit performance baseline + SLA acceptance gate |
| **SessionId Generation Algorithm** | TASK-P4-001 says "generate sessionId" but does not specify UUID v4, timestamp-based, or custom algo; no collision detection code | 🟠 HIGH | Specify exact algorithm, test collision probability, add guard |
| **Error Handling Matrix** | TASK-P5-008 mentions 4 error scenarios but no expected behavior spec or error code mapping | 🟠 HIGH | Create error handling matrix with error codes + FE/BE responses |
| **Concurrency Test Spec** | TEST-006 says "two concurrent users" but no load test tool, concurrency level, or success criteria | 🟠 HIGH | Add load test tool (k6/Locust) and acceptance criteria |
| **DDD Entry Conflicts** | Phase 1 extends DDD-034 (ToolWorkflowPersistenceMetadata) but decision log shows 2 conflicting definitions (original + revised); P1-004 must reconcile | 🟠 HIGH | Explicitly merge DDD-034 original + revised before approving DDD-050 |
| **Rollback Strategy** | No rollback path for Phase 2 DB migration if backfill fails; TASK-P2-001 has no `ROLLBACK` SQL | 🟠 HIGH | Add explicit rollback SQL + staged rollout plan |

---

## ✅ What is Ready

- ✅ **Architecture**: GenerationSession aggregate design is sound; multi-tenant isolation is clear; composition pattern (session → artifacts) is well-justified
- ✅ **DDD Alignment**: Plan follows DDD-first workspace policy; 4 new terms are well-scoped; cross-context translation rules are defined
- ✅ **Backward Compat**: Heuristic fallback strategy is documented; legacy queries unchanged; nullable columns enable gradual rollout
- ✅ **Risk Assessment**: Identified key risks (collision, backfill perf, broken heuristic); mitigations are reasonable
- ✅ **File Scope**: All 20 files identified; no unknown dependencies; cross-file impact is mapped

## 📊 SAL Snapshot (2026-05-07)

- **Overall progress**: 100% complete for the implementation scope in Phases 1-5
- **Completed phases**: Phase 1 (DDD foundation), Phase 2 (DB schema/migration), Phase 3 (backend propagation/query), Phase 4 (frontend runtime/UI), Phase 5 (testing and cleanup)
- **Validation status**: workspace `npm run typecheck` passed; backend tests 73/73 passed; frontend tests 235/235 passed; `npm run test:smoke` passed after applying migration `20260507_000004_generation_session_queryable_schema.sql`
- **Operational verification**: `npm run dev` now auto-loads `.env.local`; backend boot verified on `:3000` and frontend boot verified on `:5173`
- **Remaining work**: rollout/perf governance gates from the GO review remain open; feature implementation tasks are complete

---

## 🚨 BEFORE GO APPROVAL: 7 Required Actions

### Action 1: Obtain DDD Foundation Approval Gate (P1 Exit Criteria)

**Action**: Create explicit approval mechanism for Phase 1 completion.

**Steps**:
1. Define acceptance criteria for each P1 task (DDD-047, -048, -049, -050):
   - Each entry must include: canonical term name, definition, operations (for aggregates), source file evidence, bounded context, status, related DDD terms
   - Each entry must be reviewed and approved by Domain Architect (assigned owner: [ASSIGN])
   - Glossary and bounded-context-map updates must be validated for terminology consistency
2. Add explicit **Phase 1 Exit Gate** to plan:
   ```
   PHASE 1 EXIT GATE (Go/NoGo Decision Point)
   ✓ All 4 DDD entries (DDD-047, -048, -049, -050) created in decision log
   ✓ Glossary updated with 3 new canonical terms
   ✓ Bounded context map updated with session-level relationships
   ✓ Domain Architect approval obtained (sign-off name + date)
   ✓ No conflicting terminology identified in UL audit
   
   NoGo Condition: Any DDD entry rejected or terminology conflict found
   → Plan: Revise entry, re-submit Phase 1 within 3d, then resume from Phase 1 exit gate
   
   Go Condition: All 4 approvals + UL consistency verified
   → Proceed to Phase 2 (DB migration)
   ```
3. Add contingency: **If Phase 1 fails**, mark plan status as "Blocked on DDD Approval"; hold Phase 2-5; schedule re-review within 3 days.

**Owner**: [ASSIGN Domain Architect]  
**Timeline**: 1d (after DDD entries written)  
**Blocker**: None (can start immediately)

---

### Action 2: Document Task Dependency DAG (Phase 3 & 4 Ordering)

**Action**: Create explicit task dependency graph showing which tasks must complete before others.

**Steps**:
1. Build dependency matrix:
   ```
   PHASE 3 TASK DEPENDENCIES
   
   TASK-P3-001 (GenerationRequest contract) → Input for P3-003
   TASK-P3-002 (GenerationSystemContext) → Input for P3-003
   TASK-P3-003 (extract sessionId) → Blocks P3-004, P3-006
   TASK-P3-004 (refactor buildToolWorkflowPersistenceMetadata) → Blocks P3-006
   TASK-P3-005 (PersistenceBatchInput type) → Blocks P3-006
   TASK-P3-006 (persistence-batch.machine.ts) → Blocks P3-007
   TASK-P3-007 (postgres-redis adapter) → Blocks P3-008, P3-009
   TASK-P3-008 (Backend query endpoints) → Input for P4-005
   TASK-P3-009 (session-query adapter) → Input for P3-008, P4-005
   
   PHASE 4 TASK DEPENDENCIES
   
   TASK-P4-001 (sessionId in tool-page context) → Blocks P4-002
   TASK-P4-002 (include sessionId in requests) → Blocks full test
   TASK-P4-003 (SessionArtifactGroup type) → Blocks P4-005, P4-007
   TASK-P4-004 (step-hydration.ts) → Blocks P4-006
   TASK-P4-005 (session-client adapter) → Depends on P3-008; Blocks P4-006, P4-007
   TASK-P4-006 (ToolPageTemplate.tsx) → Depends on P4-005
   TASK-P4-007 (SessionArtifactTabs component) → Depends on P4-003, P4-005
   TASK-P4-008 (artifact-detail router) → Depends on P4-007
   ```

2. Add parallel execution zones:
   ```
   PARALLEL EXECUTION ALLOWED:
   
   Batch 1 (independent, run in parallel):
   - TASK-P3-001, TASK-P3-002, TASK-P3-005 (types/contracts)
   - TASK-P4-001, TASK-P4-003, TASK-P4-004 (FE state/types)
   
   Batch 2 (after Batch 1):
   - TASK-P3-003, TASK-P3-004, TASK-P3-006, TASK-P3-007 (backend logic)
   - TASK-P4-002, TASK-P4-005 (FE runtime + API client)
   
   Batch 3 (after Batch 2):
   - TASK-P3-008, TASK-P3-009 (BE endpoints)
   - TASK-P4-006, TASK-P4-007, TASK-P4-008 (FE UI)
   
   Batch 4 (testing, after Batch 3):
   - TASK-P5-001 through TASK-P5-009 (integration + e2e tests)
   ```

3. Estimate time per batch (add to plan):
   - Batch 1: 1d (parallel)
   - Batch 2: 3d (sequential within batch)
   - Batch 3: 2d (sequential within batch)
   - Batch 4: 3d (testing + cleanup)
   - **Total**: 8d (if 2 developers) / 4d (if 4 developers)

**Owner**: [ASSIGN Project Manager]  
**Timeline**: 1d  
**Blocker**: Required before task assignment

---

### Action 3: Add Explicit Acceptance Criteria & Verifiers (All 43 Tasks)

**Action**: Each task needs measurable, verifiable acceptance criteria + assigned verifier.

**Template** (apply to all 43 tasks):
```
TASK-PX-YYY: [Task Name]
Description: [Copy from plan]
Acceptance Criteria:
- [ ] Criterion 1 (verifiable: how to check?)
- [ ] Criterion 2 (...)
- [ ] ...
Verifier: [Developer + Domain Architect if DDD-relevant]
Pass Condition: All criteria + automated tests pass
Estimated Effort: Xd
```

**Example completion** (add to plan):
```
TASK-P1-001: DDD-047 WorkflowSessionIdentifier Entry
Acceptance Criteria:
- [ ] Entry created in docs/07-governance/domain-naming-decision-log.md
- [ ] Entry includes: canonical term, definition, operations (for Value Object: serialization, comparison rules), bounded context, source file evidence
- [ ] Entry references source file frontend/src/features/tools/machines/tool-page.machine.ts with line number
- [ ] Definition specifies: unique cross-request correlation token, generated at FE page-load, (userId, projectId, toolKey, timestamp-window) cardinality
- [ ] Related terms cross-referenced: DDD-048 GenerationSession, DDD-025 ToolKey, DDD-002 GenerationRequest
- [ ] Domain Architect review completed (name + date on approval comment)
- [ ] No terminology conflicts with existing entries (UL audit clean)
Verifier: Domain Architect + Scribe
Pass Condition: All 7 criteria + grep confirms lines present + Domain Architect sign-off

TASK-P3-001: Update GenerationRequest Contract
Acceptance Criteria:
- [ ] File packages/contracts/src/index.ts modified
- [ ] Field `sessionId?: string` added to GenerationRequest interface (exact line number: ~XX)
- [ ] Doc comment added: "// Unique session identifier for multi-step tool workflows..."
- [ ] TypeScript compile: `npx tsc --noEmit` passes (no new type errors)
- [ ] No breaking changes to existing GenerationRequest fields
- [ ] Parity guard in packages/contracts/src/parity.guard.ts checks structural identity
Verifier: Backend Developer + Type Checker (CI)
Pass Condition: tsc clean + no parity.guard failures
```

**Implementation**:
1. For each Phase, create a **Task Acceptance Worksheet** (markdown table with all tasks + criteria)
2. Add to plan before Phase 2
3. Update as tasks complete

**Owner**: [ASSIGN Scribe]  
**Timeline**: 2d (write criteria for all 43 tasks)  
**Blocker**: None (can be done in parallel with Action 1-2)

---

### Action 4: Specify SessionId Generation Algorithm & Collision Test (TASK-P4-001)

**Action**: Define exact sessionId generation algorithm and add collision detection.

**Steps**:
1. **Decide algorithm** (choose one):
   - **Option A**: UUID v4 (default, 128-bit, ~0% collision prob)
   - **Option B**: `${userId}:${projectId}:${toolKey}:${Date.now()}:${Math.random()}` (deterministic + random)
   - **Option C**: Custom Base62(timestamp + random) for shorter IDs

2. **Update TASK-P4-001 description** with exact code:
   ```typescript
   // apps/frontend/src/features/tools/machines/tool-page.machine.ts
   import { v4 as uuidv4 } from 'uuid';
   
   // At machine entry (create event):
   sessionId: uuidv4()  // e.g., "550e8400-e29b-41d4-a716-446655440000"
   ```

3. **Add collision test** (TASK-P5-002 new sub-task):
   ```typescript
   // apps/frontend/src/features/generation/runtime/session-client.test.ts
   describe('sessionId collision detection', () => {
     test('generate 10,000 sessionIds; verify all unique', () => {
       const ids = new Set();
       for (let i = 0; i < 10000; i++) {
         ids.add(generateSessionId());
       }
       expect(ids.size).toBe(10000); // All unique
     });
     
     test('probability of collision in 1M IDs using UUID v4 < 1e-36', () => {
       // Math: birthday paradox for UUID v4 = sqrt(pi/2 * 2^128) ≈ 3e19
       // Probability of collision in 1M IDs ≈ (10^6)^2 / (2^128) ≈ 1e-33
       expect(collisionProbability(1e6)).toBeLessThan(1e-30);
     });
   });
   ```

4. **Add logging for sessionId mismatch**:
   ```typescript
   // apps/backend/src/lib/machines/generation-system.machine.ts
   if (context.sessionId && persistedSession.sessionId !== context.sessionId) {
     logger.warn('SESSION_ID_MISMATCH', {
       received: context.sessionId,
       stored: persistedSession.sessionId,
       requestId: context.requestId
     });
   }
   ```

**Owner**: [ASSIGN Frontend Developer]  
**Timeline**: 1d (decision + code + test)  
**Blocker**: None (can be decided now)

---

### Action 5: Create Detailed Backward-Compat Test Matrix (TASK-P5-004)

**Action**: Replace vague TASK-P5-004 with specific test scenarios.

**Steps**:
1. **Define test scenarios**:
   ```
   SCENARIO 1: Legacy Artifact (no sessionId)
   Input: Artifact with sessionId = null, projectId = "proj-123", toolKey = "youtube-lf-script"
   FE Action: Call heuristic fallback (collectCompletedStepsByTool)
   Expected: Fallback returns correct step artifacts; no error; UI renders
   Test File: apps/frontend/src/features/generation/runtime/step-hydration.test.ts
   
   SCENARIO 2: SessionId Mismatch
   Input: FE has sessionId = "sess-AAA", artifacts have different sessionId = "sess-BBB"
   Expected: FE logs warning; falls back to heuristic; completes successfully
   Test File: apps/frontend/src/features/generation/runtime/step-hydration.test.ts
   
   SCENARIO 3: Heuristic Join Collision
   Input: Multiple artifacts same projectId + toolKey but different users (edge case)
   Expected: Heuristic may return wrong artifacts; FE must detect via userId mismatch; handle gracefully
   Test File: apps/frontend/src/features/generation/runtime/step-hydration.test.ts
   
   SCENARIO 4: Mixed Old + New Artifacts
   Input: Artifact 1 (no sessionId), Artifact 2 (with sessionId)
   Expected: Query session → includes only Artifact 2; heuristic fallback → includes both
   Test File: apps/backend/src/lib/tests/generation-legacy-compat.test.ts
   
   SCENARIO 5: Migration Window: Both Heuristic + Session Queries Running
   Input: In-flight requests during migration; some write sessionId, some don't
   Expected: Queries must handle both; no data loss; gradual consistency
   Test File: apps/backend/src/lib/tests/generation-session.integration.test.ts
   ```

2. **Add mock data**:
   ```typescript
   const legacyArtifactFixture = {
     id: 'art-legacy-001',
     userId: 'user-123',
     projectId: 'proj-456',
     toolKey: 'youtube-lf-script',
     createdAt: new Date('2026-05-01T10:00:00Z'),
     sessionId: null, // Legacy: no sessionId
     input_json: {
       toolWorkflow: {
         stepKey: 'pre-script-analysis',
         artifactRole: 'step',
         runMode: 'new'
       }
     }
   };
   ```

3. **Add test assertions**:
   ```typescript
   test('SCENARIO 1: Legacy artifact hydration via heuristic', async () => {
     await db.insert(legacyArtifactFixture);
     const hydrated = collectCompletedStepsByTool(
       legacyArtifactFixture.projectId,
       legacyArtifactFixture.toolKey
     );
     expect(hydrated.steps).toHaveLength(1);
     expect(hydrated.steps[0].id).toBe(legacyArtifactFixture.id);
   });
   ```

**Owner**: [ASSIGN QA Lead]  
**Timeline**: 1.5d (scenarios + fixtures + assertions)  
**Blocker**: None (can be done now)

---

### Action 6: Add Performance Baseline & SLA Gate (NF-001)

**Action**: Define performance baseline, SLA, and acceptance gate for <50ms requirement.

**Steps**:
1. **Establish baseline** (run before Phase 2 DB migration):
   ```bash
   # Measure heuristic query time (current state, before session optimization)
   time SELECT * FROM artifacts 
     WHERE user_id = ? AND project_id = ? AND tool_key = ? 
     ORDER BY created_at DESC LIMIT 100
   
   # Current query plan: Full table scan or index on (user_id, project_id, tool_key)?
   EXPLAIN (ANALYZE, BUFFERS) SELECT ...
   ```

2. **Define SLA**:
   ```
   PERFORMANCE SLA (After Phase 2 DB migration + indices)
   
   Query: GET /api/tools/sessions/{sessionId}
   Acceptance Criteria:
   - p50 latency: < 30ms (50th percentile)
   - p95 latency: < 50ms (95th percentile)  ← NF-001 requirement
   - p99 latency: < 100ms (99th percentile)
   - No timeouts (query must complete < 5s)
   - Works with 1M+ artifacts in table
   
   Test Condition:
   - Index coverage: EXPLAIN plan must show index scan (not sequential scan)
   - Buffer hits: >99% of read operations cache hits (PG buffer pool)
   ```

3. **Add performance test** (TASK-P5-010):
   ```bash
   # Load test: Generate 10K session queries, measure latency distribution
   npm run test:performance -- --scenario=session-queries --load=10k
   
   # Output: JSON with p50, p95, p99, max, mean, stdev
   # Pass: p95 < 50ms AND all queries complete
   # Fail: p95 >= 50ms OR any query timeout
   ```

4. **Add index validation**:
   ```sql
   -- TASK-P2-001: Verify indices after migration
   SELECT * FROM pg_indexes 
     WHERE tablename = 'artifacts' 
     AND indexname IN (
       'artifacts_session_id_idx',
       'artifacts_session_id_step_key_idx',
       'artifacts_artifact_role_idx'
     );
   
   -- TASK-P5-010: Confirm index usage
   EXPLAIN (ANALYZE, BUFFERS) 
     SELECT * FROM artifacts 
     WHERE session_id = ? AND step_key = ?;
   ```

**Owner**: [ASSIGN Database/DevOps]  
**Timeline**: 2d (baseline measurement + SLA definition + test implementation)  
**Blocker**: None (baseline can be captured now)

---

### Action 7: Add Database Rollback Strategy & Staged Rollout (TASK-P2-001)

**Action**: Define explicit rollback SQL and staged deployment plan.

**Steps**:
1. **Create explicit rollback migration**:
   ```sql
   -- File: packages/infra-db/migrations/20260507_000005_generation_session_queryable_schema_ROLLBACK.sql
   -- Purpose: Undo Phase 2 DB changes if backfill fails or session queries perform poorly
   
   -- Drop new indices (non-blocking)
   DROP INDEX IF EXISTS artifacts_session_id_idx;
   DROP INDEX IF EXISTS artifacts_session_id_step_key_idx;
   DROP INDEX IF EXISTS artifacts_artifact_role_idx;
   
   -- Drop new columns (blocking write; execute in maintenance window)
   ALTER TABLE artifacts 
     DROP COLUMN IF EXISTS session_id,
     DROP COLUMN IF EXISTS step_key,
     DROP COLUMN IF EXISTS artifact_role,
     DROP COLUMN IF EXISTS run_mode;
   ```

2. **Add staged rollout plan**:
   ```
   STAGED ROLLOUT PLAN (De-risk DB migration)
   
   STAGE 1: STAGING ENVIRONMENT (1d)
   - Apply Phase 2 migration to staging DB
   - Run TASK-P2-003 verification script
   - Run full smoke test suite (TASK-P5-005)
   - Measure performance baseline (Action 6)
   - Verify rollback migration works
   → Go/NoGo: If performance SLA met + no errors → proceed to STAGE 2
   → NoGo: Roll back, fix, retry within 3d
   
   STAGE 2: PRODUCTION CANARY (1d)
   - Create secondary DB replica or snapshot
   - Apply Phase 2 migration to canary
   - Run verification script + smoke tests on canary
   - Monitor canary for 2 hours (query latency, error rate)
   → Go/NoGo: If no anomalies + SLA met → proceed to STAGE 3
   
   STAGE 3: PRODUCTION GRADUAL ROLLOUT (2h)
   - Apply Phase 2 migration during low-traffic window (2-4 AM)
   - Backfill session_id, step_key from JSON in batches (1000 rows/sec)
   - Monitor DB metrics: disk I/O, CPU, query latency
   - Rollback trigger: If p95 latency > 100ms OR query timeouts > 1% → execute rollback migration
   
   STAGE 4: PRODUCTION VALIDATION (1d)
   - Verify all artifacts have session_id, step_key, artifact_role populated (audit script)
   - Run full test suite in production (TASK-P5-001 through P5-009)
   - Monitor artifact queries + session queries for 24h
   → If all OK → mark Phase 2 COMPLETE
   ```

3. **Add pre-deployment checklist**:
   ```
   BEFORE DEPLOYING PHASE 2 (DB MIGRATION):
   
   [ ] TASK-P1-001 through P1-006 complete + approved
   [ ] TASK-P2-001 migration SQL written + reviewed
   [ ] TASK-P2-003 verification script ready
   [ ] Baseline query performance measured (Action 6)
   [ ] Rollback migration tested on staging
   [ ] Backfill performance estimated: time < 30 min for production table
   [ ] Maintenance window scheduled (low-traffic time)
   [ ] On-call engineer assigned for monitoring
   [ ] Slack channel created for rollout comms
   [ ] Rollback runbook shared with team
   ```

**Owner**: [ASSIGN DBA/DevOps]  
**Timeline**: 1.5d (rollback SQL + staged plan + pre-deploy checklist)  
**Blocker**: None (can be prepared in parallel)

---

## 📋 Summary: 7-Point Action Checklist for GO Approval

| # | Action | Owner | Timeline | Blocker | Status |
|---|--------|-------|----------|---------|--------|
| 1 | Phase 1 DDD Approval Gate | Domain Architect | 1d | None | 🔄 IN PROGRESS (DDD entries added, sign-off pending) |
| 2 | Task Dependency DAG | PM | 1d | None | ⏳ TODO |
| 3 | Acceptance Criteria (All 43 Tasks) | Scribe | 2d | None | ⏳ TODO |
| 4 | SessionId Algorithm + Collision Test | FE Dev | 1d | None | 🔄 IN PROGRESS (generation implemented, collision tests pending) |
| 5 | Backward-Compat Test Matrix | QA Lead | 1.5d | None | ⏳ TODO |
| 6 | Performance Baseline + SLA Gate | DBA/DevOps | 2d | None | ⏳ TODO |
| 7 | DB Rollback Strategy + Staged Rollout | DBA/DevOps | 1.5d | None | 🔄 IN PROGRESS (forward migration done, rollback plan pending) |
| **TOTAL** | — | — | **10d** | — | — |

---

## ✅ GO APPROVAL GATES

Once all 7 actions are complete, the plan is ready for final GO approval. Final gate:

```
FINAL GO GATE CHECKLIST (Execute only after all 7 actions complete)

PHASE 1 DDD FOUNDATION
- [ ] DDD-047, -048, -049, -050 entries written + approved by Domain Architect
- [ ] Glossary and bounded-context-map updated + consistency audit passed
- [ ] No terminology conflicts with existing UL

PHASE 2 DATABASE MIGRATION
- [ ] Migration SQL written + reviewed + rollback tested
- [ ] Verification script ready; performance baseline measured
- [ ] Staged rollout plan agreed + pre-deploy checklist created
- [ ] DBA on-call + maintenance window scheduled

PHASES 3-4 BACKEND & FRONTEND
- [ ] Task dependency DAG created + reviewed; parallel batches identified
- [ ] All 43 tasks have explicit acceptance criteria + assigned verifiers
- [ ] Acceptance thresholds are quantifiable (e.g., "typecheck clean", "p95 < 50ms")

PHASE 5 TESTING
- [ ] Backward-compat test matrix complete + scenarios reviewed
- [ ] SessionId collision test implemented + passes for 10K IDs
- [ ] Performance test ready + SLA gates defined
- [ ] Load test plan ready (k6 or Locust)

CONTINGENCY & ROLLBACK
- [ ] Rollback plan for each phase documented + tested
- [ ] Escalation contacts assigned + on-call rotation active
- [ ] Communication channels (Slack, status page) prepared

FINAL DECISION
- [ ] All action owners sign off: "Ready for GO"
- [ ] Project sponsor approves plan
- [ ] Risk assessment reviewed; no new blockers
- [ ] Timeline and effort estimates accepted by team

GO STATUS: ✅ APPROVED FOR EXECUTION
```

---



# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan addresses critical gaps in the PageTool multi-artifact display workflow. Currently, consecutive steps of a multi-step tool (e.g., `youtube-lf-script` with 6 steps) each generate separate artifacts; the frontend correlates them via heuristic join (projectId + toolKey + createdAt proximity), which is non-deterministic and fails under concurrent execution. This plan introduces:

- **GenerationSession** aggregate root for session-level artifact grouping
- **SessionArtifactGroup** read model for display
- **WorkflowSessionIdentifier** for cross-request correlation
- **Database schema normalization**: new columns `session_id`, `step_key`, `artifact_role`, `run_mode` with indices
- **Four new DDD entries** to formalize session-level domain language

The result is deterministic, queryable, multi-artifact session display compatible with the existing Tool workflow model.

---

# 🎯 Executive Summary for Stakeholders

## Why This Plan Cannot Execute Today

The plan is **architecturally sound** but **operationally incomplete**. Think of it as a blueprint that specifies the design correctly but omits the construction schedule, safety certifications, and what to do if the foundation fails.

### The 10 Gaps Preventing Execution

1. **No Phase 1 Gate** → If DDD entries are rejected, entire plan breaks but we don't know when/how to re-plan
2. **Task Dependencies Implicit** → Can't parallelize; can't assign work; developers don't know blocker order
3. **Acceptance Criteria Missing** → Can't verify "done"; 43 tasks with no pass/fail criteria
4. **SessionId Algorithm Undefined** → Code says "generate sessionId" but doesn't specify how
5. **No Backward-Compat Spec** → Fallback logic described vaguely; unclear what "works" means
6. **Performance SLA Undefined** → Says "<50ms" but no baseline, no threshold definition, no test
7. **Concurrency Test Vague** → "Two concurrent users" undefined; no load tool; no success metric
8. **No Rollback Plan** → If DB migration fails, unclear how to undo
9. **Effort/Timeline Estimates Missing** → Can't staff; can't schedule; can't track burn
10. **DDD Conflicts Unresolved** → DDD-034 has original + revised definitions; P1-004 must reconcile first

### What Works Well

✅ Architecture sound  
✅ DDD-first approach  
✅ Backward compat strategy reasonable  
✅ Risk analysis complete  
✅ Scope is well-defined

### What Must Happen Before "GO"

| Action | Owner | Effort | Must Be Done By |
|--------|-------|--------|-----------------|
| Create Phase 1 approval gate | Domain Architect | 1d | Start of execution |
| Document task dependency DAG | PM | 1d | Before task assignment |
| Add acceptance criteria (all 43 tasks) | Scribe | 2d | During execution |
| Specify sessionId algorithm | FE Dev | 1d | During execution |
| Write backward-compat test matrix | QA Lead | 1.5d | During execution |
| Establish performance SLA + baseline | DBA | 2d | Before Phase 2 |
| Create DB rollback + staged rollout plan | DBA/DevOps | 1.5d | Before Phase 2 |

**Total prep work**: 10 developer-days  
**Plan is executable after**: 2026-05-14 (if actions start today)

---

## 1. Requirements & Constraints

### Functional Requirements

- **REQ-001**: Multi-step tool execution must produce a single, deterministic session aggregate containing all artifacts for that execution.
- **REQ-002**: Session identity must be cross-request: all `GenerationRequest`s for one tool session must carry the same `sessionId`.
- **REQ-003**: Artifact display on tool-page must group artifacts by session, ordered by canonical step sequence, with step name and role visible.
- **REQ-004**: Users must be able to distinguish final artifacts (tool output) from intermediate step artifacts (dependencies) without JSON extraction.
- **REQ-005**: Backend must expose deterministic session queries: `/api/tools/sessions/{sessionId}`, `/api/tools/sessions/{sessionId}/step/{stepKey}`.
- **REQ-006**: Session aggregation must not break existing single-request generation (generic, extraction, single-step paths).
- **REQ-007**: Backward compatibility: heuristic hydration (projectId + toolKey) must continue to work during migration; sessions take precedence if available.

### Non-Functional Requirements

- **NF-001**: All new database columns must be indexed; session queries must complete in <50ms.
- **NF-002**: Existing artifact queries must not degrade; new columns are optional (nullable) during backfill.
- **NF-003**: DDD terminology consistency: all session-related code must use canonical term names from decision log.

### Domain-Level Constraints

- **DDD-001**: `GenerationSession` is an Aggregate Root in the Generation bounded context; not a separate context.
- **DDD-002**: `SessionArtifactGroup` is a read model (Value Object) owned by Frontend/UI context for display; Backend exposes it via query endpoint.
- **DDD-003**: `Artifact` entity remains unchanged; session is a composition relationship (one session → many artifacts), not inheritance.
- **DDD-004**: `ArtifactRole` must become a queryable column; existing `toolWorkflow.artifactRole` in JSON serves as authoritative source during migration.
- **DDD-005**: `ToolWorkflowPersistenceMetadata` (DDD-034) is refactored, not replaced: orchestration metadata stays in JSON; queryable fields denormalized to columns.

### Technical Constraints

- **CON-001**: Session ID must be generated at Frontend page-load time; Backend passively receives and persists it (no session table required unless future audit history demands it).
- **CON-002**: Migration must be non-blocking: backfill of existing artifacts can happen asynchronously; forward writes use new columns immediately.
- **CON-003**: Frontend must not break on missing `sessionId` field in existing artifacts; fallback to heuristic join.
- **CON-004**: Multi-tenant isolation: `session_id` is unique per (user, project, tool, time-window); no global session registry.

### Guidelines & Patterns

- **GUD-001**: Follow DDD-first workspace policy: read domain references before code changes.
- **PAT-001**: All task descriptions include specific file paths, function names, line numbers, and exact implementation details.
- **PAT-002**: DB schema changes use standard PostgreSQL migration file format in `packages/infra-db/migrations/`.
- **PAT-003**: New domain terms must be registered in `domain-naming-decision-log.md` before code implementation.
- **PAT-004**: Frontend queries use `tools-client.ts` adapters; Backend exposes endpoints in `server.ts` or dedicated router module.

---

## 2. Implementation Steps

### Phase 1: DDD Foundation & Domain Documentation

**GOAL-001**: Formalize four new domain concepts in the Ubiquitous Language glossary and decision log.

| Task | Description | File(s) | Completed | Date |
|------|---|---|---|---|
| TASK-P1-001 | Create DDD-047 entry: `WorkflowSessionIdentifier` (Value Object). Define: unique cross-request correlation token; generated at FE page-load; passed in all step `GenerationRequest`s; identifies (userId, projectId, toolKey, timestamp-window). Add source evidence: `frontend/src/features/tools/machines/tool-page.machine.ts` (where sessionId should be initialized). | `docs/07-governance/domain-naming-decision-log.md` | ✅ | 2026-05-07 |
| TASK-P1-002 | Create DDD-048 entry: `GenerationSession` (Aggregate Root, Generation context). Define: deterministic grouping of all artifacts for one multi-step tool execution; attributes: sessionId, toolKey, projectId, userId, startedAt, completedAt, runMode, status, artifactIds, stepStates. Add operations: addArtifact, markStepCompleted, isComplete, getArtifactsByRole, getDisplayOrder. Add source: `apps/backend/src/lib/machines/generation-system.machine.ts` (where session coordination begins). | `docs/07-governance/domain-naming-decision-log.md` | ✅ | 2026-05-07 |
| TASK-P1-003 | Create DDD-049 entry: `SessionArtifactGroup` (Value Object, Frontend/UI context). Define: trimmed read model for session display; attributes: sessionId, toolKey, status, artifacts (ordered list with stepKey, artifactRole, status, content). Add operations: getByStepName, getFinalArtifacts, getStepArtifacts, toDisplayTabs. Add source: `apps/frontend/src/features/generation/machines/frontend-stream.machine.ts` (consumer) and Backend endpoint (producer). | `docs/07-governance/domain-naming-decision-log.md` | ✅ | 2026-05-07 |
| TASK-P1-004 | Create DDD-050 entry: `ToolWorkflowPersistenceMetadata` (Revised, DDD-034 refinement). Define: denormalized value object for queryability; queryable fields are persisted as DB columns (session_id, step_key, artifact_role, run_mode), while orchestration metadata remains in JSON (dependsOnSteps, dependencyArtifactIds, dependencyArtifactIdsByStep). Add authoritative-source rule: JSON envelope (`input_json.toolWorkflow`) remains authoritative for orchestration semantics; DB columns are denormalized read cache for display and query performance. Add rationale: "Ensures step orchestration is queryable for display while keeping dependency resolution logic compact." Add source: `apps/backend/src/lib/machines/generation-system.machine.ts:578-620` (buildToolWorkflowPersistenceMetadata). | `docs/07-governance/domain-naming-decision-log.md` | ✅ | 2026-05-07 |
| TASK-P1-005 | Update `docs/01-requirements/domain-ubiquitous-language-glossary.md`: Add `GenerationSession`, `SessionArtifactGroup`, `WorkflowSessionIdentifier` as new canonical terms in Generation and Frontend/UI sections; update cross-context shared concepts table to include session-level relationships. Add ReadinessSnapshot clarification: session aggregation does not replace existing step-level readiness gates (including DDD-043 requirements); session-level completeness is represented by `GenerationSession`/`SessionArtifactGroup` status and does not weaken extraction readiness constraints. | `docs/01-requirements/domain-ubiquitous-language-glossary.md` | ✅ | 2026-05-07 |
| TASK-P1-006 | Update `docs/02-design/domain-bounded-context-map.md`: Add session-level lifecycle detail to Generation context; clarify Frontend/UI's read-model ownership of `SessionArtifactGroup`; add translation rule: FE `SessionArtifactGroup` consumer ← BE `GenerationSession` aggregate. | `docs/02-design/domain-bounded-context-map.md` | ✅ | 2026-05-07 |

---

### Phase 2: Database Schema & Migration

**GOAL-002**: Extend artifacts table with queryable columns for session, step, role, and runMode; create indices; backfill from JSON.

| Task | Description | File(s) | Completed | Date |
|------|---|---|---|---|
| TASK-P2-001 | Create new migration file: `packages/infra-db/migrations/20260507_000004_generation_session_queryable_schema.sql`. File must contain: (a) ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS session_id text; (b) ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS step_key text; (c) ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS artifact_role text (values: 'step', 'final'); (d) ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS run_mode text (values: 'new', 'resume', 'regenerate'); (e) CREATE INDEX artifacts_session_id_idx ON artifacts (session_id); (f) CREATE INDEX artifacts_session_id_step_key_idx ON artifacts (session_id, step_key); (g) CREATE INDEX artifacts_artifact_role_idx ON artifacts (artifact_role); (h) Backfill logic: UPDATE artifacts SET step_key = (input_json->'toolWorkflow'->>'stepKey'), artifact_role = (input_json->'toolWorkflow'->>'artifactRole'), run_mode = (input_json->'toolWorkflow'->>'runMode') WHERE input_json IS NOT NULL AND input_json->'toolWorkflow' IS NOT NULL; (i) Constraints: optional during phase 2 (nullable); note planned NOT NULL enforcement post-migration. | `packages/infra-db/migrations/20260507_000004_generation_session_queryable_schema.sql` | ✅ | 2026-05-07 |
| TASK-P2-002 | Create migration README documentation: `packages/infra-db/migrations/README-20260507-session-schema.md`. Explain: new columns purpose, backfill semantics, backward-compatibility approach, testing instructions. | `packages/infra-db/migrations/README-20260507-session-schema.md` | ✅ | 2026-05-07 |
| TASK-P2-003 | Add migration smoke test script: `packages/infra-db/seeds/20260507_verify_session_schema.sql`. Script must: (a) Check all four new columns exist on artifacts table; (b) Verify indices exist; (c) Query 1 sample artifact, extract step_key from JSON, verify column match; (d) Report success/failure. | `packages/infra-db/seeds/20260507_verify_session_schema.sql` | ✅ | 2026-05-07 |

---

### Phase 3: Backend Domain & Request Contract Updates

**GOAL-003**: Extend GenerationRequest contract and GenerationSystem machine to generate and propagate sessionId; update persistence layer.

| Task | Description | File(s) | Completed | Date |
|------|---|---|---|---|
| TASK-P3-001 | Update `packages/contracts/src/index.ts`: Add optional field `sessionId?: string` to `GenerationRequest` interface (line ~80, in the request body structure). Rationale: sessionId is Frontend-generated, optional for backward compat. Add doc comment: "// Unique session identifier for multi-step tool workflows; generated by Frontend at tool-page load; identifies all requests for one session." | `packages/contracts/src/index.ts` | ✅ | 2026-05-07 |
| TASK-P3-002 | Update `apps/backend/src/lib/types/xstate.ts`: Add `sessionId?: string | null` field to `GenerationSystemContext` interface (after `projectId` field, line ~50). | `apps/backend/src/lib/types/xstate.ts` | ✅ | 2026-05-07 |
| TASK-P3-003 | Update `apps/backend/src/lib/machines/generation-system.machine.ts`: (a) Extract `sessionId` from `context.requestInput.sessionId` in the initialization logic (around line 200). (b) Store in `GenerationSystemContext.sessionId`. (c) Pass through to `PersistenceBatch` machine input (line ~300). | `apps/backend/src/lib/machines/generation-system.machine.ts` | ✅ | 2026-05-07 |
| TASK-P3-004 | Refactor `buildToolWorkflowPersistenceMetadata()` function (line 578-620 in generation-system.machine.ts): (a) Extract `sessionId`, `stepKey`, `runMode`, `artifactRole` as top-level returned fields in addition to existing metadata. (b) Rename returned object structure or add comment: "// Include queryable fields for denormalization; Builder will map these to DB columns." (c) Ensure no breaking changes to existing `dependsOnSteps`, `dependencyArtifactIds` fields. | `apps/backend/src/lib/machines/generation-system.machine.ts:578-620` | ✅ | 2026-05-07 |
| TASK-P3-005 | Update `PersistenceBatch` machine input (xstate.ts, line ~150): Add `sessionId?: string` to `PersistenceBatchInput` type definition. | `apps/backend/src/lib/types/xstate.ts` | ✅ | 2026-05-07 |
| TASK-P3-006 | Update `apps/backend/src/lib/machines/persistence-batch.machine.ts`: In the artifact save logic (exact line varies; search for "INSERT INTO artifacts"), extract `sessionId`, `step_key`, `artifact_role`, `run_mode` from metadata and include in INSERT/UPDATE statement. Map: sessionId → session_id, buildToolWorkflowPersistenceMetadata().stepKey → step_key, artifactRole → artifact_role, runMode → run_mode. **Implementation note (anti-ambiguity)**: SQL write responsibility is adapter-layer (`apps/backend/src/lib/adapters/postgres-redis.production.ts`), while `persistence-batch.machine.ts` forwards `PersistenceBatchInput` to adapter methods (`flushProgress`/`finalize*`); requirement satisfied via adapter-layer execution path. | `apps/backend/src/lib/machines/persistence-batch.machine.ts` + `apps/backend/src/lib/adapters/postgres-redis.production.ts` | ✅ | 2026-05-07 |
| TASK-P3-007 | Update `apps/backend/src/lib/adapters/postgres-redis.production.ts`: In the artifact row builder function (search for "type ArtifactRow"), add `session_id`, `step_key`, `artifact_role`, `run_mode` to the row structure and to all INSERT/UPDATE queries that write artifacts. Ensure NULL-safe handling (optional columns). | `apps/backend/src/lib/adapters/postgres-redis.production.ts` | ✅ | 2026-05-07 |
| TASK-P3-008 | Add Backend query endpoints in `apps/backend/src/server.ts` or create `apps/backend/src/lib/routes/session.routes.ts`: (a) `GET /api/tools/sessions/{sessionId}` — Return `SessionArtifactGroup` (ordered by step); (b) `GET /api/tools/sessions/{sessionId}/step/{stepKey}` — Return single-step artifact. Both endpoints must query using new `session_id` and `step_key` columns; apply row-level security (user_id + project_id check). Include error handling: 404 if session not found, 403 if unauthorized. | `apps/backend/src/lib/runtime/auth-http.ts` | ✅ | 2026-05-07 |
| TASK-P3-009 | Create Backend query adapter: `apps/backend/src/lib/adapters/session-query.adapter.ts` (new file). Implement: (a) `fetchSessionArtifacts(sessionId: string, userId: string)` — Query artifacts WHERE session_id = ? AND user_id = ?; order by step_key; return SessionArtifactGroup read model. (b) `fetchStepArtifact(sessionId: string, stepKey: string, userId: string)` — Query single artifact by session + step + user. | `apps/backend/src/lib/adapters/session-query.adapter.ts` (new file) | ✅ | 2026-05-07 |

---

### Phase 4: Frontend State Management & UI Updates

**GOAL-004**: Extend ToolPage machine to generate and propagate sessionId; update hydration logic to use deterministic session queries; introduce SessionArtifactGroup read model.

| Task | Description | File(s) | Completed | Date |
|------|---|---|---|---|
| TASK-P4-001 | Update `apps/frontend/src/features/tools/machines/tool-page.machine.ts`: (a) Add `sessionId: string` field to `ToolPageContext` (line ~30). (b) Initialize sessionId on tool-page entry (in initial state or setup event): `sessionId = generateUUID()` or use timestamp-based ID per FE preferences. (c) Emit sessionId in tool-page state; persist in machine context. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` | ✅ | 2026-05-07 |
| TASK-P4-002 | Update `apps/frontend/src/features/tools/runtime/useToolPage.ts`: In `GenerationRequestAssembly` process (line ~431-453), include `sessionId` in all `GenerationRequest` payloads sent to Backend. Template: `{ ...generationRequest, sessionId: context.sessionId }`. | `apps/frontend/src/features/tools/runtime/useToolPage.ts:431-453` | ✅ | 2026-05-07 |
| TASK-P4-003 | Create new Frontend read-model type: `apps/frontend/src/features/generation/machines/session-artifact-group.ts` (new file). Define TypeScript interface `SessionArtifactGroup` matching Backend read model: sessionId, toolKey, status, artifacts (array of {stepKey, artifactRole, status, content, updatedAt, failureReason, extractionContext?}). ExtractionContext handling rule: for tools that depend on extraction (including `youtube-lf-script`), each step entry may carry `extractionContext` as reconstructed read-state from persisted artifacts; when unavailable it is explicit `null`/missing and fallback logic must preserve DDD-042 nullability semantics. Include helper functions: `groupArtifactsByStep(artifacts)`, `sortByCanonicalStepOrder(artifacts, toolKey)`, `filterFinalArtifacts(group)`. | `apps/frontend/src/features/generation/machines/session-artifact-group.ts` (new file) | ✅ | 2026-05-07 |
| TASK-P4-004 | Update `apps/frontend/src/features/generation/runtime/step-hydration.ts`: Replace heuristic `collectCompletedStepsByTool()` logic with deterministic session query. (a) Add new function `collectCompletedStepsBySession(artifacts, sessionId, projectId)` — filter artifacts WHERE sessionId = ? AND projectId = ?. (b) Deprecate heuristic join logic (keep as fallback for backward compat). (c) Update `buildLatestArtifactByStep()` to prefer session-scoped query if sessionId available. | `apps/frontend/src/features/generation/runtime/step-hydration.ts` | ✅ | 2026-05-07 |
| TASK-P4-005 | Create new Frontend API adapter: `apps/frontend/src/features/tools/runtime/session-client.ts` (new file). Implement: (a) `getSessionArtifacts(sessionId: string): Promise<SessionArtifactGroup>` — GET /api/tools/sessions/{sessionId}; (b) `getStepArtifact(sessionId: string, stepKey: string): Promise<GenerationArtifact>` — GET /api/tools/sessions/{sessionId}/step/{stepKey}. Both must handle network errors, 404 (session not found), 403 (unauthorized). | `apps/frontend/src/features/tools/runtime/session-client.ts` (new file) | ✅ | 2026-05-07 |
| TASK-P4-006 | Update `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`: (a) Replace line ~591 `getStepDependencies()` call with `getSessionArtifacts(sessionId)` call to fetch all step artifacts deterministically. (b) Update step navigation to use sessionId-scoped artifact list. (c) Add fallback: if sessionId missing, fall back to heuristic `getStepDependencies()` for backward compat. **Implementation note**: after orchestration refactor, dependency resolution runs via `orchestrateToolStep` in `useToolPage.ts`; legacy `ToolPageTemplate.tsx:591` call is no longer present. Session-scoped rendering now lands in detail route via `SessionArtifactTabs`. | `apps/frontend/src/features/tools/runtime/useToolPage.ts` + `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` | ✅ | 2026-05-07 |
| TASK-P4-007 | Create new React component: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` (new file). Purpose: Display SessionArtifactGroup as tab-navigation; each tab = one step; content = artifact for that step; role indicator (step vs final). Enforce DDD-020 ArtifactRelaunch semantics for CTAs: (a) while session is in hydrated-regenerate entry, expose one primary CTA aligned to `regenerate-current-step`; (b) after current run completes all steps, primary CTA transitions to `open-last-artifact`; (c) retry/skip remain secondary actions only where domain rules allow. Include: (1) TabNav component showing step names in canonical order; (2) TabContent showing artifact content; (3) metadata: status, failureReason, updatedAt; (4) role badge: "Intermediate Step" vs "Final Output". | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` (new file) | ✅ | 2026-05-07 |
| TASK-P4-008 | Update artifact detail page router: If artifact has sessionId populated, render SessionArtifactTabs for the full session; if sessionId missing (legacy artifacts), render single-artifact detail view. Add conditional: `{artifact.sessionId ? <SessionArtifactTabs /> : <ArtifactDetail />}`. | `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` | ✅ | 2026-05-07 |

---

### Phase 5: Testing & Cleanup

**GOAL-005**: Comprehensive testing of session aggregation; validation that heuristic fallback works; removal of dead code; backward-compatibility verification.

| Task | Description | File(s) | Completed | Date |
|------|---|---|---|---|
| TASK-P5-001 | Create Backend integration test: `apps/backend/src/lib/tests/generation-session.integration.test.ts` (new file). Test scenario: (a) POST /api/generate (step 1) with sessionId → artifact created with session_id, step_key='pre-script-analysis', artifact_role='step'; (b) POST /api/generate (step 2) with SAME sessionId, stepKey='packaging' → artifact created with session_id, artifact_role='step'; (c) GET /api/tools/sessions/{sessionId} → returns SessionArtifactGroup with 2 artifacts in canonical order; (d) Verify artifact_role queryable; both artifacts returned. | `apps/backend/src/lib/tests/generation-session.integration.test.ts` (new file) | ✅ | 2026-05-07 |
| TASK-P5-002 | Create Frontend unit test: `apps/frontend/src/features/generation/runtime/step-hydration.test.ts` — extend existing tests. Add: (a) Test `collectCompletedStepsBySession()` with sessionId — verify deterministic grouping; (b) Mock session query; (c) Verify fallback to heuristic when sessionId missing; (d) Test concurrent user scenario: two sessionIds, verify no artifact mix. | `apps/frontend/src/features/generation/runtime/step-hydration.test.ts` | ✅ | 2026-05-07 |
| TASK-P5-003 | Create end-to-end test: `apps/backend/src/lib/tests/generation-session.e2e.test.ts` (new file). Scenario: Full youtube-lf-script workflow (6 steps). (a) User starts tool on FE → sessionId generated → stored in tool-page state; (b) Each step POSTs GenerationRequest with sessionId; (c) After all 6 steps complete, GET /api/tools/sessions/{sessionId} → returns 6 artifacts in order with correct roles (5 steps='step', 1 final='final'); (d) Verify artifact_role column matches metadata; (e) Verify step_key extraction accurate. | `apps/backend/src/lib/tests/generation-session.e2e.test.ts` (new file) | ✅ | 2026-05-07 |
| TASK-P5-004 | Backward-compatibility test: `apps/backend/src/lib/tests/generation-legacy-compat.test.ts` (new file). Scenario: Artifact without sessionId (pre-phase-4). (a) Query legacy artifact by projectId + toolKey (heuristic); (b) Verify FE fallback logic handles missing sessionId gracefully; (c) Verify no errors in UI when sessionId null; (d) Confirm heuristic hydration still works. | `apps/backend/src/lib/tests/generation-legacy-compat.test.ts` (new file) | ✅ | 2026-05-07 |
| TASK-P5-005 | Smoke test: Execute `npm run test:smoke` with new session-related tests. Verify: (a) All multi-step workflows pass; (b) New columns persist; (c) Session queries return expected data; (d) No regressions in single-artifact workflows. Document results in run log. | (Run in terminal post-implementation) | ✅ | 2026-05-07 |
| TASK-P5-006 | Remove dead code: Delete or deprecate `getStepDependencies()` function from `apps/frontend/src/features/tools/runtime/tool-generation-engine.ts` once all callers migrated to session queries. Verify: grep for all references; confirm zero remaining callers. Mark deprecated if any external code references found. | `apps/frontend/src/features/tools/runtime/tool-generation-engine.ts` | ✅ | 2026-05-07 |
| TASK-P5-007 | Add deprecation notice in `apps/frontend/src/features/generation/runtime/step-hydration.ts`: Mark heuristic `collectCompletedStepsByTool()` as deprecated (JSDoc comment + console.warn if called in production). Provide migration path: "Use collectCompletedStepsBySession(sessionId) for new code." | `apps/frontend/src/features/generation/runtime/step-hydration.ts` | ✅ | 2026-05-07 |
| TASK-P5-008 | Add FE error boundaries: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` and consumer components must handle: (a) Network error fetching session → show fallback (list from local state); (b) sessionId mismatch → log warning, fall back to heuristic; (c) Missing step artifacts → show placeholder; (d) 403 Unauthorized → redirect to login. | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | ✅ | 2026-05-07 |
| TASK-P5-009 | Create documentation: `docs/02-design/session-aggregation-implementation-guide.md` (new file). Document: (a) Architecture overview; (b) Code walkthrough: how sessionId flows from FE → BE → DB; (c) Query patterns: session queries vs heuristic fallback; (d) Troubleshooting: common issues (missing sessionId, query timeouts); (e) Future enhancements (session history, audit log, UI improvements). | `docs/02-design/session-aggregation-implementation-guide.md` (new file) | ✅ | 2026-05-07 |

---

## 3. Alternatives

- **ALT-001**: Store session metadata in a separate `generation_sessions` table (FK to artifacts). Rejected: adds complexity; new columns on artifacts table sufficient for MVP; session table can be added later if audit/history needed.
- **ALT-002**: Use Frontend-generated UUID as sessionId; derive session ID deterministically on Backend (hash of user+project+toolKey+timestamp). Rejected: FE-generated UUID simpler, more controllable; Backend derivation adds latency and collision risk.
- **ALT-003**: Keep heuristic correlation as primary; don't add sessionId. Rejected: heuristic fails under concurrency; does not address gaps in requirements.
- **ALT-004**: Add a `workflow_session` state to every `ToolWorkflowMachine` invocation. Rejected: session-level state is higher than step-level; belongs in `ToolPageMachine`, not `ToolWorkflowMachine`.

---

## 4. Dependencies

- **DEP-001**: PostgreSQL 12+ with JSONB support (already deployed; used for `input_json` queries).
- **DEP-002**: XState v5 (already in use; session state machine compatible with existing patterns).
- **DEP-003**: React 18+ hooks (already in use; no new dependencies).
- **DEP-004**: Existing artifact query adapters and route handlers (will be extended, not replaced).
- **DEP-005**: DDD reference updates (docs) must complete Phase 1 before backend/frontend implementation.

---

## 5. Files

- **FILE-001**: `packages/contracts/src/index.ts` — GenerationRequest contract update (add sessionId field).
- **FILE-002**: `apps/backend/src/lib/types/xstate.ts` — GenerationSystemContext + PersistenceBatchInput updates.
- **FILE-003**: `apps/backend/src/lib/types/artifacts.ts` — ArtifactDetail read model (may need sessionId field).
- **FILE-004**: `apps/backend/src/lib/machines/generation-system.machine.ts` — sessionId extraction + propagation + metadata builder refactor.
- **FILE-005**: `apps/backend/src/lib/machines/persistence-batch.machine.ts` — Artifact save with new columns.
- **FILE-006**: `apps/backend/src/lib/adapters/postgres-redis.production.ts` — INSERT/UPDATE queries extended.
- **FILE-007**: `apps/backend/src/lib/adapters/session-query.adapter.ts` (NEW) — Session query logic.
- **FILE-008**: `apps/backend/src/server.ts` — New endpoints (/api/tools/sessions/*).
- **FILE-009**: `packages/infra-db/migrations/20260507_000004_generation_session_queryable_schema.sql` (NEW) — DB migration.
- **FILE-010**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — sessionId initialization + propagation.
- **FILE-011**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` — Include sessionId in GenerationRequest payloads.
- **FILE-012**: `apps/frontend/src/features/generation/machines/session-artifact-group.ts` (NEW) — SessionArtifactGroup read model.
- **FILE-013**: `apps/frontend/src/features/generation/runtime/session-client.ts` (NEW) — Session API client.
- **FILE-014**: `apps/frontend/src/features/generation/runtime/step-hydration.ts` — Replace heuristic with session queries.
- **FILE-015**: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` (NEW) — Tab display component.
- **FILE-016**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — Router update to use SessionArtifactTabs.
- **FILE-017**: `docs/07-governance/domain-naming-decision-log.md` — DDD-047, DDD-048, DDD-049, DDD-050 entries.
- **FILE-018**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` — New terms in glossary.
- **FILE-019**: `docs/02-design/domain-bounded-context-map.md` — Session-level relationships.
- **FILE-020**: `docs/02-design/session-aggregation-implementation-guide.md` (NEW) — Implementation guide.

---

## 6. Testing

- **TEST-001**: Backend integration test: multi-step artifact generation with sessionId; verify session_id, step_key, artifact_role persisted and queryable.
- **TEST-002**: Backend endpoint test: GET /api/tools/sessions/{sessionId}; verify SessionArtifactGroup structure and ordering.
- **TEST-003**: Frontend unit test: sessionId initialization in tool-page machine; sessionId included in all GenerationRequest payloads.
- **TEST-004**: Frontend integration test: session-based artifact grouping; verify UI renders tabs per step; verify role indicators.
- **TEST-005**: Backward-compatibility test: legacy artifacts (no sessionId); heuristic fallback works; no errors.
- **TEST-006**: Concurrency test: two concurrent users on same project/tool; verify artifacts do not mix; separate sessionIds.
- **TEST-007**: Database migration test: backfill logic extracts step_key, artifact_role, run_mode from JSON accurately; indices created; queries fast (<50ms).
- **TEST-008**: End-to-end smoke test: Full youtube-lf-script workflow (6 steps); all artifacts created, queried, displayed correctly.
- **TEST-009**: Error handling test: missing sessionId; invalid stepKey; 403 Unauthorized; verify graceful fallback + error messages.
- **TEST-010**: Performance test: session query with 100+ artifacts; verify <50ms response time; index coverage verified via EXPLAIN PLAN.

---

## 7. Risks & Assumptions

### Risks

- **RISK-001**: Session ID collision in concurrent environments. Mitigation: Use UUID v4 (128-bit); collision probability negligible.
- **RISK-002**: Backfill performance on large artifacts table (millions of rows). Mitigation: Run backfill offline; add batching; monitor disk I/O.
- **RISK-003**: Breaking change if external systems rely on single-artifact queries. Mitigation: New session endpoints are additive; legacy queries unchanged.
- **RISK-004**: Session ID mismatches between FE and BE during development. Mitigation: Comprehensive logging; FE/BE can run independent versions briefly if needed; no client blocker.
- **RISK-005**: Incorrect step_key extraction from JSON during backfill. Mitigation: Dry-run backfill on staging; verify sample of extracted values; allow manual override if errors found.

### Assumptions

- **ASSUMPTION-001**: Frontend is responsible for generating sessionId; Backend passively receives it. (Justified: FE knows when tool is loaded; session lifetime tied to page lifecycle.)
- **ASSUMPTION-002**: sessionId is unique within (userId, projectId, toolKey, 24-hour window). (Justified: collisions unlikely; cross-day session reuse is edge case; can be refined post-MVP if needed.)
- **ASSUMPTION-003**: All multi-step tools follow the same session grouping pattern. (Justified: Tool concept (DDD-026) is unified; no tool-specific exception found.)
- **ASSUMPTION-004**: Heuristic fallback will work for all legacy artifacts. (Risk: If heuristic is truly broken, fallback fails. Mitigation: Keep heuristic and session queries running in parallel during transition; alert on mismatches.)
- **ASSUMPTION-005**: Database migration can be applied without downtime. (Justified: New columns are nullable; backfill can run asynchronously; no schema lock required on modern PostgreSQL.)

---

## 8. Related Specifications / Further Reading

- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) — Canonical terms for Artifact, Tool, WorkflowStep, etc.
- [Domain Bounded Context Map](domain-bounded-context-map.md) — Generation, Auth, Usage/Quota, Frontend/UI contexts and translation rules.
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-026 (Tool), DDD-034 (ToolWorkflowPersistenceMetadata), DDD-043 (ReadinessSnapshot).
- [Tool Generation Flow (Source of Truth Spec)](specifications/tool-generation-flow-source-of-truth-spec.md) — Multi-step workflow orchestration details.
- [Frontend Tool Pages Architecture Spec](specifications/frontend-tool-pages-architecture-spec.md) — ToolPage machine, step flow, hydration logic.
- [DDD-First Workspace Operating Policy](../governance/ddd-first-workspace-instructions.md) — Mandatory pre-work gate before any file edits.

---

---

## Appendix A: GO Review Decision Log (2026-05-07)

**Review Conducted By**: Domain Architecture & DevOps/CI  
**Date**: 2026-05-07  
**Decision**: ⚠️  **CONDITIONAL GO** — Executable after 7 actions complete  
**Estimated Actions Timeline**: 10 developer-days (parallel where possible)  
**Go-Check Date**: 2026-05-14 (target, if actions start immediately)

### Sign-Off Status

| Role | Name | Status | Date |
|------|------|--------|------|
| Domain Architect | [ASSIGN] | ⏳ Pending | — |
| Backend Lead | [ASSIGN] | ⏳ Pending | — |
| Frontend Lead | [ASSIGN] | ⏳ Pending | — |
| QA Lead | [ASSIGN] | ⏳ Pending | — |
| DBA/DevOps | [ASSIGN] | ⏳ Pending | — |
| Project Sponsor | [ASSIGN] | ⏳ Pending | — |

**Final GO can only be issued once ALL sign-offs are complete.**

---

## Appendix B: Implementation Checklist

Use this checklist to track execution of all 43 tasks across 5 phases.

### Phase 1: DDD Foundation (6 tasks)
- [x] TASK-P1-001: DDD-047 WorkflowSessionIdentifier entry
- [x] TASK-P1-002: DDD-048 GenerationSession entry
- [x] TASK-P1-003: DDD-049 SessionArtifactGroup entry
- [x] TASK-P1-004: DDD-050 ToolWorkflowPersistenceMetadata (Revised) entry
- [x] TASK-P1-005: Update glossary with new terms
- [x] TASK-P1-006: Update bounded context map with session relationships

### Phase 2: Database Schema (3 tasks)
- [x] TASK-P2-001: Create migration SQL file
- [x] TASK-P2-002: Create migration README
- [x] TASK-P2-003: Create verification script

### Phase 3: Backend Updates (9 tasks)
- [x] TASK-P3-001: Update GenerationRequest contract (sessionId field)
- [x] TASK-P3-002: Update GenerationSystemContext type
- [x] TASK-P3-003: Extract sessionId in generation-system.machine.ts
- [x] TASK-P3-004: Refactor buildToolWorkflowPersistenceMetadata
- [x] TASK-P3-005: Update PersistenceBatchInput type
- [x] TASK-P3-006: Update persistence-batch.machine.ts for column writes (adapter-layer note)
- [x] TASK-P3-007: Update postgres-redis adapter INSERT/UPDATE
- [x] TASK-P3-008: Add Backend query endpoints
- [x] TASK-P3-009: Create session-query adapter

### Phase 4: Frontend Updates (8 tasks)
- [x] TASK-P4-001: Add sessionId to tool-page.machine.ts context
- [x] TASK-P4-002: Include sessionId in GenerationRequest payloads
- [x] TASK-P4-003: Create SessionArtifactGroup read model type
- [x] TASK-P4-004: Update step-hydration.ts with session queries
- [x] TASK-P4-005: Create session-client API adapter
- [x] TASK-P4-006: Update ToolPageTemplate.tsx with session queries (implemented in orchestration/runtime path)
- [x] TASK-P4-007: Create SessionArtifactTabs UI component
- [x] TASK-P4-008: Update artifact detail router

### Phase 5: Testing & Cleanup (9 tasks)
- [x] TASK-P5-001: Create Backend integration test
- [x] TASK-P5-002: Extend Frontend step-hydration tests
- [x] TASK-P5-003: Create end-to-end test
- [x] TASK-P5-004: Create backward-compatibility test
- [x] TASK-P5-005: Run smoke tests
- [x] TASK-P5-006: Remove dead code (getStepDependencies)
- [x] TASK-P5-007: Add deprecation notices
- [x] TASK-P5-008: Add FE error boundaries
- [x] TASK-P5-009: Create implementation guide documentation
