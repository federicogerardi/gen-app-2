---
status: completed
version: 1.1-complete
last-reviewed: 2026-07-12
next-review-date: 2026-07-19
owner: Domain Architecture Team
date_created: 2026-07-12
title: Sprint 7 Implementation Plan — V7 NONSTREAMING Technical Debt + V6 Progress State Mutation
type: implementation-plan
tags:
  - sprint-planning
  - nonstreaming
  - technical-debt
  - persistence-unification
  - progress-state
  - race-condition
  - fe-be
  - completed
goal: Merge streaming/non-streaming persistence paths (V7), eliminate progress state race condition (V6), and remove legacy workarounds
---

# Sprint 7 Implementation Plan — V7 NONSTREAMING Technical Debt + V6 Progress State Mutation

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md) (V6 + V7 residual)
**Branch**: `feature/sprint-4-session-2-reducer-bridge` (continua — Sprint 4+5+6+7 nello stesso PR)
**Prerequisites**:
- Sprint 4 Phase 1 ✅ COMPLETE (FE — reducer-bridge consolidation + Race A/D guards)
- Sprint 5 ✅ COMPLETE (BE — context migration + validation layer)
- Sprint 6 ✅ COMPLETE (BE — error-actors wiring + legacy cleanup)
- V6/V7 deferred from original Sprint 5 scope

**Scope**: FE+BE. Unificazione percorsi streaming/non-streaming + eliminazione race condition.

**Design Decisions (user-confirmed, validated via Context7)**:
1. **Backend**: Unifica su `persistenceBatchMachine` — rimuovi `persistingSuccessSync`/`persistingFailureSync` + `simpleFinalizationActor`. Il batch machine fa flush solo su `STREAM_CHUNK_RECEIVED` (mai inviato in non-streaming → invariants preservati).
2. **Frontend**: Rimuovi `NONSTREAMING_STEP_COMPLETED` event + `updateNonStreamingProgress` action. `PROGRESS_SYNCED` diventa unico writer di `progress`. Mantieni ref semplificato (`inFlightStepsRef`) per auto-chain dedup (non compete più con machine context).
3. **Mode**: Rimuovi `modeIsGenerate` dai branch di persistenza/fallback (6 branch). Mantieni `mode` in context per `dispatchingMode` routing (`generating` vs `streaming` execution path — rimozione completa richiede unificare anche gli attori di esecuzione, differito a sprint futuro).
4. **Branch**: Continua su `feature/sprint-4-session-2-reducer-bridge`.

---

## Context7 Validation

| Pattern | XState v5 Confirmation | Sprint 7 Impact |
|--------|----------------------|-----------------|
| Child machine with event-driven `idle` state | ✅ `persistenceBatchMachine` waits in `idle` for `STREAM_TERMINATED_*` events. No chunk → no flush. | NON-Streaming path safe: `flushProgress` never called, invariants preserved |
| Final state → parent `onDone` | ✅ `type: 'final'` triggers `onDone` in parent invoke | Both paths use same `persistingSuccess` → `onDone: 'finalizeIdempotencySuccess'` |
| `always` transition priority | ✅ Fires before raised events, immediately on state entry | `route` child state dispatch in `resolvingFallbackPolicy` works |
| `onDone` array without guard | ✅ Unguarded entry always fires if no earlier guard matches | Safe to remove guarded `modeIsGenerate` branches |
| `sendTo` from `entry` action | ✅ Parent sends event to invoked child via `enqueue.sendTo` | `drivePersistenceFinalize*` works for both streaming and non-streaming |

---

## Current State (verified via codebase analysis 2026-07-12)

### Backend — Dual persistence paths (V7)

**4 stati persistenze duplicati** (`apps/backend/src/lib/machines/generation-system.persistence.states.ts`):
- `persistingSuccess` (lines 157-182): streaming path → `invokePersistence` (persistenceBatchMachine)
- `persistingFailure` (lines 183-200): streaming path → `invokePersistence`
- `persistingSuccessSync` (lines 249-270): non-streaming path → `invokeSimplePersistence` (simpleFinalizationActor)
- `persistingFailureSync` (lines 271-287): non-streaming path → `invokeSimplePersistence`

**2 attori** (`apps/backend/src/lib/machines/generation-system.actors.ts`):
- `invokePersistence` → `persistenceBatchMachine` (205 righe, stateful con flush retries)
- `invokeSimplePersistence` → `simpleFinalizationActor` (23 righe, fromPromise singolo)

**7 branch `modeIsGenerate`**:
- `execution.states.ts:264`: `dispatchingMode` routing (`generating` vs `streaming`)
- `persistence.states.ts:54,74,92,112,130,150`: 6 branch in `resolvingFallbackPolicy` child states (onDone + onError)

**Referenze a stati rimossi**:
- `execution.states.ts:295`: `target: 'persistingSuccessSync'` in `generating.onDone`

**Mode in context**:
- `GenerationRuntimeContext.mode: 'generate' | 'stream'` (context-types.ts:35)
- `GenerationSystemContext.mode: 'generate' | 'stream'` (xstate.ts:65)
- Streaming session: no explicit `initialContext.mode` (default `'stream'`)
- JSON session: `initialContext: { mode: 'generate' as const }` (backend-session.ts:289)

**Test invariants** (`apps/backend/src/lib/tests/generation-nonstreaming.test.ts`):
- Test 5 (line 189): `flushProgressCalls === 0`
- Test 5 (line 190): `finalizeSuccessCalls === 1`
- Test 6 (line 224): `finalizeFailureCalls === 1`

### Frontend — Race condition (V6)

**Evento `NONSTREAMING_STEP_COMPLETED`**:
- Definizione: `tool-page.types.ts:60` — `{ type: 'NONSTREAMING_STEP_COMPLETED'; step: ToolStep }`
- Handler: `tool-page.machine.ts:219-221` → `updateNonStreamingProgress` action (lines 174-190)
- Dispatch: `useToolPageRunController.ts:356` — subito dopo `STEP_DONE` (line 354)

**Race condition**:
1. `NONSTREAMING_STEP_COMPLETED` → `updateNonStreamingProgress` muta solo `progress.completedSteps` (no dedup, no artifacts)
2. `reloadArtifacts()` (line 359) → async fetch
3. Artifacts arrivano → `PROGRESS_SYNCED` → `syncProgress` → `resolveFlowProgressState` ricalcola completo da artifacts clobberando lo stato intermedio

**`nonStreamingCompletedStepsRef`** (7 riferimenti):
- Init: `useToolPageRunController.ts:53`
- Auto-chain merge: line 290
- Dedup gate: line 348
- Add: line 353
- Reset: lines 411, 420

---

## PHASE 1: Backend — V7 Persistence Path Unification

### Step 1.1: Remove persistingSuccessSync + persistingFailureSync states

**Objective**: Eliminate the duplicated non-streaming persistence states. Both execution paths now use `persistingSuccess` and `persistingFailure` with `persistenceBatchMachine`.

**File**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`

**Change**: Remove the two Sync state definitions (lines 249-287).

**Key invariant**: `persistenceBatchMachine` starts in `idle` state which listens for `STREAM_TERMINATED_*` events (sent by `drivePersistenceFinalize*` entry actions). It ONLY flushes on `STREAM_CHUNK_RECEIVED` (guard `shouldFlush`: `event.metadata.sequence % 10 === 0`). Non-streaming runs don't send chunk events → `flushProgress` never called → test invariants preserved.

**Validation**:
```bash
rg -c "persistingSuccessSync|persistingFailureSync" apps/backend/src/lib/machines/
# Expected: 0 (after Steps 1.1-1.3)
npm --workspace apps/backend run typecheck
# Expected: errors (references still exist — fixed in Steps 1.2-1.3)
```

**Commit**: `feat(sprint-7 phase 1): Step 1.1 — remove persistingSuccessSync + persistingFailureSync states`

---

### Step 1.2: Remove 6 modeIsGenerate branches in resolvingFallbackPolicy

**Objective**: Remove guarded `modeIsGenerate` branches in `resolvingFallbackPolicy` compound state child states. After removal, all paths route to `persistingFailure` (not `persistingFailureSync`).

**File**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`

**Change**: In each of the 3 child states (`extractionRecovery`, `toolWorkflowRecovery`, `genericRecovery`), remove the guarded `onDone` and `onError` entries:

```diff
 onDone: [
-  {
-    guard: 'modeIsGenerate',
-    target: '#generationSystemMachine.persistingFailureSync',
-    actions: { type: 'applyRouteErrorOutput', params: ... },
-  },
   {
     target: '#generationSystemMachine.persistingFailure',
     actions: { type: 'applyRouteErrorOutput', params: ... },
   },
 ],
 onError: [
-  { guard: 'modeIsGenerate', target: '#generationSystemMachine.persistingFailureSync', actions: 'setFallbackPolicyFailure' },
   { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
 ],
```

6 pair rimossi (3 `onDone` + 3 `onError`).

**Validation**:
```bash
rg -c "modeIsGenerate" apps/backend/src/lib/machines/generation-system.persistence.states.ts
# Expected: 0
npm --workspace apps/backend run typecheck
# Expected: clean (all references to persistingFailureSync removed)
```

**Commit**: `feat(sprint-7 phase 1): Step 1.2 — remove 6 modeIsGenerate branches in resolvingFallbackPolicy`

---

### Step 1.3: Update generating.onDone target

**Objective**: Fix reference to removed `persistingSuccessSync` state in execution states.

**File**: `apps/backend/src/lib/machines/generation-system.execution.states.ts`

**Change**: Line ~295 in `generating.onDone` success branch:

```diff
-        target: 'persistingSuccessSync',
+        target: 'persistingSuccess',
```

**Note**: `persistingSuccess` already has the same routing (`onDone: 'finalizeIdempotencySuccess'`, `onError → resolvingFallbackPolicy`). The semantics are identical — only the persistence actor changed (from `simpleFinalizationActor` to `persistenceBatchMachine`).

**Validation**:
```bash
npm --workspace apps/backend run typecheck
# Expected: clean
npm --workspace apps/backend run test
# Expected: 345 test pass (no regression)
```

**Commit**: `feat(sprint-7 phase 1): Step 1.3 — update generating.onDone target → persistingSuccess`

---

### Step 1.4: Archive simpleFinalizationActor + remove invokeSimplePersistence

**Objective**: Remove the dead persistence actor.

**File 1**: `apps/backend/src/lib/machines/generation-system.actors.ts`

Rimuovi import + registrazione:
```diff
- import { simpleFinalizationActor } from './persistence-actor';
- invokeSimplePersistence: simpleFinalizationActor,
```

Rimuovi entry dal `GenerationSystemProvidedActor` union.

**File 2**: Archivia `persistence-actor.ts`:
```bash
git mv apps/backend/src/lib/machines/persistence-actor.ts docs/99-lifecycle/99-archive/
```

**Validation**:
```bash
rg "simpleFinalizationActor|invokeSimplePersistence" apps/backend/src/
# Expected: 0
npm --workspace apps/backend run typecheck
# Expected: clean
```

**Commit**: `feat(sprint-7 phase 1): Step 1.4 — archive simpleFinalizationActor + remove invokeSimplePersistence`

---

### Step 1.5: Update non-streaming tests for unified path

**Objective**: Verify existing invariants hold with unified path. Rename tests to reflect new state names.

**File**: `apps/backend/src/lib/tests/generation-nonstreaming.test.ts`

**Changes**:

1. Rinomina test 4 (line 108): `'non-streaming path completes via persistingSuccessSync without flushProgress'` → `'non-streaming path completes via persistingSuccess without flushProgress'`

2. Rinomina test 5 (line 193): `'non-streaming failure path completes via persistingFailureSync with single finalizeFailure'` → `'non-streaming failure path completes via persistingFailure with single finalizeFailure'`

3. Rinomina test 3 (line 60): Aggiorna descrizione routing test

4. **Invariants preservati** (no assertion changes):
   - `flushProgressCalls === 0` ✅
   - `finalizeSuccessCalls === 1` ✅
   - `finalizeFailureCalls === 1` ✅

5. Aggiungi test: `'non-streaming success path uses persistenceBatchMachine without flushProgress'` — verifica che `flushProgress` spy count rimane 0 nonostante il batch machine sia invocato.

**Validation**:
```bash
node --import tsx --test apps/backend/src/lib/tests/generation-nonstreaming.test.ts
# Expected: 6 tests pass (5 existing updated + 1 new)
npm --workspace apps/backend run test
# Expected: 346 pass (345 baseline + 1 new)
```

**Commit**: `test(sprint-7 phase 1): Step 1.5 — update non-streaming tests for unified persistence path`

---

### Step 1.6: Full regression (Phase 1)

**Objective**: Verify Phase 1 introduced zero regressions.

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
# Expected: 346 test pass, typecheck clean
```

**Commit**: `feat(sprint-7 phase 1): Step 1.6 — full backend regression (Phase 1 complete)`

---

## PHASE 2: Frontend — V6 Race Condition Elimination

### Step 2.1: Remove NONSTREAMING_STEP_COMPLETED event + updateNonStreamingProgress action

**Objective**: Eliminate the competing writer of `context.progress.completedSteps`. `PROGRESS_SYNCED` becomes the sole writer.

**File 1**: `apps/frontend/src/features/tools/machines/tool-page.types.ts`

Rimuovi dalla `ToolPageEvent` union (line 60):
```diff
- | { type: 'NONSTREAMING_STEP_COMPLETED'; step: ToolStep }
```

**File 2**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts`

Rimuovi:
- Action `updateNonStreamingProgress` (lines 174-190)
- Handler `NONSTREAMING_STEP_COMPLETED` (lines 219-221)

**Validation**:
```bash
rg -c "NONSTREAMING_STEP_COMPLETED|updateNonStreamingProgress" apps/frontend/src/
# Expected: 0 (after Step 2.2 removes dispatch)
npm --workspace apps/frontend run typecheck
# Expected: errors in useToolPageRunController.ts (dispatch removed in Step 2.2)
```

**Commit**: `feat(sprint-7 phase 2): Step 2.1 — remove NONSTREAMING_STEP_COMPLETED event + updateNonStreamingProgress action`

---

### Step 2.2: Simplify ref → inFlightStepsRef, remove double-dispatch

**Objective**: Rename `nonStreamingCompletedStepsRef` → `inFlightStepsRef`. Remove `NONSTREAMING_STEP_COMPLETED` dispatch. Keep ref for auto-chain dedup (doesn't compete with machine context anymore — no `updateNonStreamingProgress`).

**File**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`

**Changes**:

1. Rinomina: `nonStreamingCompletedStepsRef` → `inFlightStepsRef` (line 53 + all 7 references)

2. Rimuovi dispatch di `NONSTREAMING_STEP_COMPLETED` (lines 355-357):
```diff
  if (resolved) {
-   nonStreamingCompletedStepsRef.current = new Set(nonStreamingCompletedStepsRef.current).add(resolved);
+   inFlightStepsRef.current = new Set(inFlightStepsRef.current).add(resolved);
    toolPageSend({ type: 'STEP_DONE', step: resolved });
-   if (import.meta.env.DEV) console.info('[useToolPage] dispatching NONSTREAMING_STEP_COMPLETED', ...);
-   toolPageSend({ type: 'NONSTREAMING_STEP_COMPLETED', step: resolved });
-   if (import.meta.env.DEV) console.info('[useToolPage] dispatched NONSTREAMING_STEP_COMPLETED', ...);
  }
```

3. Aggiorna dedup gate (line 348): `inFlightStepsRef.current.has(resolved)`

4. Aggiorna auto-chain merge (line 290): `...inFlightStepsRef.current`

5. Aggiorna reset paths (lines 411, 420): `inFlightStepsRef.current = new Set()`

6. Rimuovi dev log lines (353 `add` ora è solo ref update)

**Key behavior**: Il ref ora traccia solo "step per cui `STEP_DONE` è stato dispatchato ma `PROGRESS_SYNCED` non ha ancora settlelato". Non compete più con il machine context perché non c'è più `updateNonStreamingProgress` a mutare `progress.completedSteps` fuori banda. Race eliminata alla radice.

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
# Expected: clean
npm --workspace apps/frontend run test
# Expected: 448 test pass
```

**Commit**: `feat(sprint-7 phase 2): Step 2.2 — simplify ref to inFlightStepsRef + remove double-dispatch`

---

### Step 2.3: Update frontend tests for race elimination

**Objective**: Remove assertions on removed events. Add test for single-writer invariant.

**File**: Test files che referenziavano `NONSTREAMING_STEP_COMPLETED`

**Changes**:
1. Aggiorna test in `tool-page.machine.test.ts`: rimuovi assertion su `NONSTREAMING_STEP_COMPLETED` forwarding
2. Aggiorna test in `useToolPage.test.ts`: aggiorna ref rename
3. Aggiungi test: `'PROGRESS_SYNCED is sole writer of progress.completedSteps'` — verifica che `completedSteps` non cambia dopo `STEP_DONE` senza `PROGRESS_SYNCED`

**File specifici** (individuabili con grep dopo Step 2.2):
```bash
rg -l "NONSTREAMING_STEP_COMPLETED|nonStreamingCompletedStepsRef" apps/frontend/src/ --type ts
```

**Validation**:
```bash
npm --workspace apps/frontend run test
# Expected: 448+ pass
```

**Commit**: `test(sprint-7 phase 2): Step 2.3 — update frontend tests for race elimination`

---

### Step 2.4: Full regression (Phase 2)

**Objective**: Verify Phase 2 introduced zero regressions.

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
# Expected: 448+ test pass, typecheck clean
```

**Commit**: `feat(sprint-7 phase 2): Step 2.4 — full frontend regression (Phase 2 complete)`

---

## PHASE 3: Integration & Plan Bump

### Step 3.1: Full integration regression

```bash
# Backend full gate
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
# Expected: 346 test pass (345 baseline + 1 new non-streaming)

# Frontend regression guard
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
# Expected: 448+ test pass

# Sprint 5 validation script (regression check)
bash scripts/validate-sprint-5-context-migration.sh
# Expected: all ✅ (persistence changes don't affect context migration)
```

**Commit**: `feat(sprint-7 phase 3): Step 3.1 — full integration regression`

---

### Step 3.2: Plan status bump

**File**: `plan/sprint-7-v7-nonstreaming-v6-progress-implementation-plan.md`

Aggiorna frontmatter: `status: completed`, `version: 1.1-complete`, `last-reviewed: 2026-07-12`.

Aggiorna Success Matrix: all rows ✅.

**Commit**: `feat(sprint-7 phase 3): Step 3.2 — plan status bump (Sprint 7 complete)`

---

## Success Matrix

| Phase | Success Criteria | Status | Validation |
|-------|------------------|--------|------------|
| **Phase 1** | `persistingSuccessSync` + `persistingFailureSync` removed | 🟡 TODO | `rg "persistingSuccessSync\|persistingFailureSync" apps/backend/src/` → 0 |
| **Phase 1** | 6 `modeIsGenerate` branches removed in persistence | 🟡 TODO | `rg "modeIsGenerate" persistence.states.ts` → 0 |
| **Phase 1** | `simpleFinalizationActor` archived, `invokeSimplePersistence` removed | 🟡 TODO | `rg "simpleFinalizationActor\|invokeSimplePersistence"` → 0 |
| **Phase 1** | Non-streaming tests pass with unified path | 🟡 TODO | 346 backend tests pass |
| **Phase 2** | `NONSTREAMING_STEP_COMPLETED` removed | 🟡 TODO | `rg "NONSTREAMING_STEP_COMPLETED"` → 0 |
| **Phase 2** | `updateNonStreamingProgress` action removed | 🟡 TODO | `rg "updateNonStreamingProgress"` → 0 |
| **Phase 2** | `inFlightStepsRef` simplifies ref (no machine competition) | 🟡 TODO | typecheck + 448+ FE tests pass |
| **Integration** | 346 BE + 448+ FE pass, typecheck clean | 🟡 TODO | `npm run test` both workspaces |

**Final Target**:
- Backend: **346 test pass** (345 baseline + 1 new non-streaming unified)
- Frontend: **448+ test pass** (regression guard)
- Typecheck: clean both workspaces
- `persistingSuccessSync`/`persistingFailureSync` references: 0 across codebase
- `NONSTREAMING_STEP_COMPLETED` references: 0 across codebase
- `simpleFinalizationActor`/`invokeSimplePersistence` references: 0 across codebase
- `modeIsGenerate` references in persistence.states.ts: 0
- Race condition (dual writers of `progress.completedSteps`): eliminated

---

## Execution: Single Continuous Session

Sprint 7 = **one single session**, sequential commits on `feature/sprint-4-session-2-reducer-bridge`:

| # | Step | Commit Subject |
|---|------|----------------|
| 1 | 1.1 | `feat(sprint-7 phase 1): Step 1.1 — remove Sync persistence states` |
| 2 | 1.2 | `feat(sprint-7 phase 1): Step 1.2 — remove 6 modeIsGenerate branches` |
| 3 | 1.3 | `feat(sprint-7 phase 1): Step 1.3 — update generating.onDone target` |
| 4 | 1.4 | `feat(sprint-7 phase 1): Step 1.4 — archive simpleFinalizationActor` |
| 5 | 1.5 | `test(sprint-7 phase 1): Step 1.5 — update non-streaming tests` |
| 6 | 1.6 | `feat(sprint-7 phase 1): Step 1.6 — full backend regression` |
| 7 | 2.1 | `feat(sprint-7 phase 2): Step 2.1 — remove NONSTREAMING_STEP_COMPLETED` |
| 8 | 2.2 | `feat(sprint-7 phase 2): Step 2.2 — simplify ref + remove double-dispatch` |
| 9 | 2.3 | `test(sprint-7 phase 2): Step 2.3 — update frontend tests` |
| 10 | 2.4 | `feat(sprint-7 phase 2): Step 2.4 — full frontend regression` |
| 11 | 3.1+3.2 | `feat(sprint-7): full integration + plan bump (Sprint 7 complete)` |

**Estimate**: 1 sessione (~3-4 ore di lavoro focalizzato).

---

## DDD Compliance Requirements

- **No new domain terms**: Sprint 7 unifies existing persistence paths. No new canonical terms.
- **Aggregate root preserved**: `GenerationSystem` remains Generation Context aggregate root (BCM Line 40).
- **Error handling**: `DispatchErrorReasonCode` → `mapInlineDispatchError` boundary preserved (DDD-149).
- **XState v5 constraints**: Child machine invocation, `always` transitions, `sendTo` pattern — all validated via Context7.

---

## Risks and Controls

| Risk | Control |
|------|---------|
| `persistenceBatchMachine` misbehaves without chunk events | Step 1.5 test verifies `flushProgress=0`, `finalizeSuccess=1`, `finalizeFailure=1` |
| Auto-chain latenza dopo rimozione `NONSTREAMING_STEP_COMPLETED` | `inFlightStepsRef` bridga il gap — stesso meccanismo, senza race su machine context |
| `generating.onDone` target breaking after Sync state removal | Step 1.3 explicitly updates target; typecheck catches broken refs |
| `simpleFinalizationActor` archiviation breaks existing consumers | Step 1.4 verifies zero references before archiving |
| Frontend test regression after event removal | Step 2.3 updates test assertions for removed event |
| Backward compatibility broken for JSON API consumers | Both HTTP endpoints preserved (`/generation` SSE + `/generation/json`). Machine internals changed, API contracts unchanged |

---

## Out-of-Scope (Deferred to Future Sprint)

1. **`mode` complete removal from context**: `mode` remains in context for `dispatchingMode` routing (`generating` vs `streaming` execution paths use different actors). Full removal requires unifying `invokeGeneration` and `invokeStream` actors — non-trivial refactor.
2. **`modeIsGenerate` guard removal from execution states**: Kept for `dispatchingMode` routing (see above).
3. **`inFlightStepsRef` eventual removal**: Could be removed if auto-chain waits for `PROGRESS_SYNCED` to settle. Deferred until all steps reliably produce artifacts that trigger PROGRESS_SYNCED.
4. **`STEP_DONE` event consolidation**: `STEP_DONE` still fires for lifecycle transition. Could be unified with `PROGRESS_SYNCED` in a future sprint.

---

## References

- [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md) (V6 + V7)
- [Sprint 6 Implementation Plan](./sprint-6-error-actors-wiring-implementation-plan.md) (resolvingFallbackPolicy compound state)
- [Sprint 5 Implementation Plan](./sprint-5-context-migration-validation-implementation-plan.md) (context decomposition)
- `apps/backend/src/lib/machines/generation-system.persistence.states.ts` (4 persistence states → 2 after Sprint 7)
- `apps/backend/src/lib/machines/persistence-batch.machine.ts` (streaming batch machine — now used for both paths)
- `apps/backend/src/lib/machines/persistence-actor.ts` (simpleFinalizationActor — archived in Sprint 7)
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (updateNonStreamingProgress action — removed in Sprint 7)
- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` (NONSTREAMING_STEP_COMPLETED dispatch — removed in Sprint 7)
- `apps/backend/src/lib/tests/generation-nonstreaming.test.ts` (test invariants updated for unified path)

---

**Last Updated**: 2026-07-12 (Sprint 7 plan created — V7 NONSTREAMING + V6 Progress State, FE+BE, single session)
**Next Review**: 2026-07-19
**Review Owner**: Domain Architecture Team
**DDD Compliance Status**: ✅ **PASSED** - No new domain terms, path unification is internal refactor
**AI Execution Ready**: ✅ **READY** - Plan finalized, Context7 validated, awaiting user confirmation to proceed with Step 1.1
