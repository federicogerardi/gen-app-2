---
status: completed
version: 1.1-complete
last-reviewed: 2026-07-12
next-review-date: 2026-07-19
owner: Domain Architecture Team
date_created: 2026-07-12
title: Sprint 6 Implementation Plan - Error-Actors Wiring & Legacy Cleanup
type: implementation-plan
tags:
  - sprint-planning
  - error-actors
  - route-specific-recovery
  - compound-state
  - legacy-cleanup
  - be-only
  - completed
goal: Wire the 3 route-specific error actors (extraction/tool/generic) into the generation system machine, replace the universal resolvingFallbackPolicy with route-dispatching compound state, and remove legacy type alias
---

# Sprint 6 Implementation Plan — Error-Actors Wiring & Legacy Cleanup

**Source**: [Sprint 5 Implementation Plan](./sprint-5-context-migration-validation-implementation-plan.md) (Out-of-Scope section: error-actors wiring)
**Branch**: `feature/sprint-4-session-2-reducer-bridge` (continues — Sprint 4+5+6 land in same PR)
**Prerequisites**:
- Sprint 4 Phase 1 ✅ COMPLETE (Session 2 FE — reducer-bridge consolidation + DDD-158 consumer + Race A/D guards)
- Sprint 5 ✅ COMPLETE (Context Migration & Validation — actions split + validation layer)
- Error-actors defined but NOT wired: `generation-system.error-actors.ts` (Sprint 4 Session 1)

**Scope**: Backend-only. Frontend untouched (448 tests must stay green as regression guard). V6/V7 technical debt explicitly deferred to Sprint 7+.

**Execution**: Single continuous session, sequential commit per step.

**Design Decisions (user-confirmed)**:
1. **Fail-forward**: All 8 `ErrorActorOutput` variants mapped to `failureReason` string. Routing unchanged (always → `persistingFailure`/`persistingFailureSync`). Partial-recovery routing deferred to future sprint.
2. **Remove `invokeFallbackPolicy`**: `genericErrorActor` handles both `'generic'` and `null`/ambiguous routes. `generationFallbackActor` import + registration removed.

---

## DDD Gate ✅ INHERITED

All DDD governance gates inherited from Sprint 4 Session 1 — no new DDD entries required for Sprint 6 (wiring already-approved error-actors).

| Gate | Requirement | Status |
|------|-------------|--------|
| **Gate 1** | DDD-165→172 entries created | ✅ Inherited (Sprint 4 Session 1) |
| **Gate 2** | All terminology canonical | ✅ Inherited (verified) |
| **Gate 3** | BCM boundaries respected | ✅ Inherited (`GenerationSystem` remains aggregate root) |
| **Gate 4** | Implementation ready | ✅ All dependencies met (error-actors.ts exists, actors.ts + persistence.states.ts ready) |

**Key Constraints** (inherited):
- `GenerationSystem` remains Generation Context aggregate root (BCM Line 40)
- Error handling uses `DispatchErrorReasonCode` → `mapInlineDispatchError` boundary (DDD-149)
- XState v5 constraint: `always` transitions fire immediately upon state entry (confirmed via Context7)
- Compound state targeting: entering a compound state automatically enters its `initial` child (confirmed via Context7)

---

## Current State (verified via codebase analysis 2026-07-12)

### Error-actors file (defined, NOT wired)
- ✅ `apps/backend/src/lib/machines/generation-system.error-actors.ts` — 3 route-specific actors:
  - `extractionErrorActor` (lines 19-40): branches on `hasContent && reason === 'extraction_failed'` → partial recovery; `reason === 'extraction_chain_exhausted'` → fallback to raw; else complete failure
  - `toolWorkflowErrorActor` (lines 42-63): branches on `hasContent && reason === 'workflow_step_failed'` → partial recovery; `reason === 'tool_dependency_missing'` → dependency recovery; else complete failure (uses `pendingFallback?.defaultReason`)
  - `genericErrorActor` (lines 65-79): branches on `hasContent` → partial recovery; else complete failure

### Types (current)
- `ErrorActorInput = GenerationErrorContext & { reason: string; hasContent: boolean }` — NOT exported
- `ErrorActorOutput` — 8-variant discriminated union, NOT exported
- `GenerationErrorContext` — `{ pendingFallback, registryVersion, registrySnapshotRef }` (from context-types.ts)
- `GenerationFallbackOutput = { reason: string; shouldRetry: boolean }` (from generation-fallback.actor.ts) — current output type

### Actors registration (current)
- ✅ `apps/backend/src/lib/machines/generation-system.actors.ts` (431 lines):
  - 17 actors registered in `generationSystemActors` object
  - `invokeFallbackPolicy: generationFallbackActor` (line 145) — to be REPLACED
  - Error-actors NOT imported, NOT registered
  - ⚠️ Bug: `GenerationSystemProvidedActor` union (lines 412-431) has duplicate entries:
    - Lines 423+425: `invokeFallbackPolicy` duplicated
    - Lines 424+426: `markCompletedIdempotency` duplicated

### Resolving fallback policy state (current)
- ✅ `apps/backend/src/lib/machines/generation-system.persistence.states.ts:31-79`:
  - Single `invoke` with `src: 'invokeFallbackPolicy'`
  - Input already passes `context.routeType` (line 41) — route-aware branching possible
  - `onDone` branches on `context.mode === 'generate'` → `persistingFailureSync` vs `persistingFailure`
  - `onError` same mode-based branching with `setFallbackPolicyFailure` action
  - **23 transition sites** target `resolvingFallbackPolicy` across 3 files:
    - `execution.states.ts`: 13 matches (extractionFlow, toolGenerationFlow, acquiringContext, crawlingFlow, scoringFlow, generating, streaming)
    - `request.states.ts`: 7 matches (preGenerationGuards nested states — use `#generationSystemMachine.resolvingFallbackPolicy` absolute target)
    - `persistence.states.ts`: 2 matches (persistingSuccess.onError, persistingSuccessSync.onError)

### Route types
- ✅ `RouteType = 'generic' | 'tool' | 'extraction' | null` (generation-routing.ts:6)
- Maps 1:1 to the 3 error-actors: `extraction` → `extractionErrorActor`, `tool` → `toolWorkflowErrorActor`, `generic`/null → `genericErrorActor`
- `null` (ambiguous) routed to `failed` by `hasAmbiguousRouting` guard BEFORE reaching `resolvingFallbackPolicy` — but `genericErrorActor` handles it as safety net

### Events file (dead code after restructure)
- `getFallbackDoneOutput` (events.ts:141) — used only in persistence.states.ts:53,62 — becomes dead code after Step 1.4
- `generation-fallback.actor.ts` — becomes orphaned after Step 1.5 — archive in Step 1.6

---

## Out-of-Scope (Explicitly Deferred to Sprint 7+)

1. **V6 (Progress State Mutation)** — Two concurrent mutators of `context.progress.completedSteps`; entire frontend refactor
2. **V7 (NONSTREAMING Technical Debt)** — 33+ occurrences; merging streaming/non-streaming persistence paths (FE+BE)
3. **Partial-recovery routing** — `PARTIAL_RECOVERY` → `persistingSuccess` instead of `persistingFailure`
4. **`getFallbackDoneOutput` removal** — dead code cleanup after restructure
5. **`shouldRetry` re-implementation** — current fallback actor has retry logic; new error actors don't; re-implement in future sprint

---

## PHASE 1: Error-Actors Wiring

### Step 1.1: Export ErrorActorOutput + ErrorActorInput types

**Objective**: Make the error-actor types available for state machine typing and tests.

**File**: `apps/backend/src/lib/machines/generation-system.error-actors.ts`

**Change**: Add `export` keyword to `ErrorActorInput` (line 4) and `ErrorActorOutput` (line 9).

```diff
- type ErrorActorInput = GenerationErrorContext & {
+ export type ErrorActorInput = GenerationErrorContext & {

- type ErrorActorOutput =
+ export type ErrorActorOutput =
```

**Validation**:
```bash
rg -n "export type ErrorActor" apps/backend/src/lib/machines/generation-system.error-actors.ts
# Expected: 2 matches (ErrorActorInput + ErrorActorOutput)
npm --workspace apps/backend run typecheck
# Expected: clean
```

**Commit**: `feat(sprint-6 phase 1): Step 1.1 — export ErrorActorOutput + ErrorActorInput types`

---

### Step 1.2: Add applyRouteErrorOutput action

**Objective**: New action that maps the 8-variant `ErrorActorOutput` to a `failureReason` string (fail-forward).

**File**: `apps/backend/src/lib/machines/generation-system.actions.ts`

**Change 1**: Import `ErrorActorOutput` from error-actors.ts.

```diff
+ import type { ErrorActorOutput } from './generation-system.error-actors';
```

**Change 2**: Add `{ type: 'applyRouteErrorOutput'; params: { output: ErrorActorOutput } }` to `GenerationSystemActionObject` union.

**Change 3**: Add the action implementation:

```typescript
applyRouteErrorOutput: assignGeneration<{ output: ErrorActorOutput }>({
  failureReason: (_: GenerationActionArgs, params: { output: ErrorActorOutput }) => {
    const out = params.output;
    switch (out.type) {
      case 'EXTRACTION_PARTIAL_RECOVERY': return out.recoveryReason;
      case 'EXTRACTION_FALLBACK_TO_RAW': return out.fallbackReason;
      case 'EXTRACTION_COMPLETE_FAILURE': return out.finalReason;
      case 'TOOL_PARTIAL_RECOVERY': return out.recoveryAction;
      case 'TOOL_DEPENDENCY_RECOVERY': return out.recoveryAction;
      case 'TOOL_COMPLETE_FAILURE': return out.finalReason;
      case 'GENERIC_PARTIAL_RECOVERY': return out.recoveryReason;
      case 'GENERIC_COMPLETE_FAILURE': return out.finalReason;
    }
  },
  pendingFallback: null,
}),
```

**Validation**:
```bash
npm --workspace apps/backend run typecheck
# Expected: clean
npm --workspace apps/backend run test
# Expected: ≥ 340 test pass (no regression)
```

**Commit**: `feat(sprint-6 phase 1): Step 1.2 — add applyRouteErrorOutput action (8-variant → failureReason)`

---

### Step 1.3: Register 3 route-specific error actors

**Objective**: Import and register the 3 error actors in the machine's `actors` block.

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

**Change 1**: Add import at top of file:

```diff
+ import { extractionErrorActor, toolWorkflowErrorActor, genericErrorActor } from './generation-system.error-actors';
```

**Change 2**: Add 3 entries to `generationSystemActors` object (before or after existing actors):

```typescript
extractionErrorActor,
toolWorkflowErrorActor,
genericErrorActor,
```

**Validation**:
```bash
rg -c "extractionErrorActor|toolWorkflowErrorActor|genericErrorActor" apps/backend/src/lib/machines/generation-system.actors.ts
# Expected: ≥ 4 (3 registrations + 1 import line)
npm --workspace apps/backend run typecheck
# Expected: clean
```

**Commit**: `feat(sprint-6 phase 1): Step 1.3 — register 3 route-specific error actors`

---

### Step 1.4: Restructure resolvingFallbackPolicy into compound state

**Objective**: Replace the single `invoke` in `resolvingFallbackPolicy` with a compound state that dispatches to route-specific child states based on `context.routeType`.

**File**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`

**Key design** (confirmed via Context7):
- XState v5 `always` transitions fire immediately upon state entry — correct for route dispatch
- Targeting a compound state enters its `initial` child — all 23 call sites work unchanged
- Absolute targets (`#generationSystemMachine.persistingFailureSync`) used in child `onDone`/`onError` to reach sibling states

**Replace** `resolvingFallbackPolicy` (lines 31-79) with:

```typescript
resolvingFallbackPolicy: {
  initial: 'route',
  states: {
    route: {
      always: [
        { guard: 'routeIsExtraction', target: 'extractionRecovery' },
        { guard: 'routeIsTool', target: 'toolWorkflowRecovery' },
        { target: 'genericRecovery' },
      ],
    },
    extractionRecovery: {
      invoke: {
        id: 'extractionErrorActor',
        src: 'extractionErrorActor',
        input: ({ context }: ContextArgs) => ({
          pendingFallback: context.pendingFallback,
          registryVersion: context.registryVersion,
          registrySnapshotRef: context.registrySnapshotRef,
          reason: context.pendingFallback?.reason ?? context.failureReason ?? 'extraction_failed',
          hasContent: context.contentBuffer.trim().length > 0,
        }),
        onDone: [
          {
            guard: 'modeIsGenerate',
            target: '#generationSystemMachine.persistingFailureSync',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
          {
            target: '#generationSystemMachine.persistingFailure',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
        ],
        onError: [
          { guard: 'modeIsGenerate', target: '#generationSystemMachine.persistingFailureSync', actions: 'setFallbackPolicyFailure' },
          { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
        ],
      },
    },
    toolWorkflowRecovery: {
      invoke: {
        id: 'toolWorkflowErrorActor',
        src: 'toolWorkflowErrorActor',
        input: ({ context }: ContextArgs) => ({
          pendingFallback: context.pendingFallback,
          registryVersion: context.registryVersion,
          registrySnapshotRef: context.registrySnapshotRef,
          reason: context.pendingFallback?.reason ?? context.failureReason ?? 'workflow_failed',
          hasContent: context.contentBuffer.trim().length > 0,
        }),
        onDone: [
          {
            guard: 'modeIsGenerate',
            target: '#generationSystemMachine.persistingFailureSync',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
          {
            target: '#generationSystemMachine.persistingFailure',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
        ],
        onError: [
          { guard: 'modeIsGenerate', target: '#generationSystemMachine.persistingFailureSync', actions: 'setFallbackPolicyFailure' },
          { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
        ],
      },
    },
    genericRecovery: {
      invoke: {
        id: 'genericErrorActor',
        src: 'genericErrorActor',
        input: ({ context }: ContextArgs) => ({
          pendingFallback: context.pendingFallback,
          registryVersion: context.registryVersion,
          registrySnapshotRef: context.registrySnapshotRef,
          reason: context.pendingFallback?.reason ?? context.failureReason ?? 'generation_failed',
          hasContent: context.contentBuffer.trim().length > 0,
        }),
        onDone: [
          {
            guard: 'modeIsGenerate',
            target: '#generationSystemMachine.persistingFailureSync',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
          {
            target: '#generationSystemMachine.persistingFailure',
            actions: {
              type: 'applyRouteErrorOutput',
              params: ({ event }: UnknownEventArgs) => ({
                output: (event as { output?: ErrorActorOutput }).output!,
              }),
            },
          },
        ],
        onError: [
          { guard: 'modeIsGenerate', target: '#generationSystemMachine.persistingFailureSync', actions: 'setFallbackPolicyFailure' },
          { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
        ],
      },
    },
  },
},
```

**Additional change**: Remove `getFallbackDoneOutput` import (line 18) — now dead code. Add `ErrorActorOutput` import.

**Collateral**: Remove old `invoke` block (lines 32-78) entirely. The `resolvingFallbackPolicy` state name is preserved — all 23 call sites work unchanged.

**Validation**:
```bash
npm --workspace apps/backend run typecheck
# Expected: clean
npm --workspace apps/backend run test
# Expected: ≥ 340 test pass (no regression)
rg -c "invokeFallbackPolicy" apps/backend/src/lib/machines/
# Expected: 0 (state no longer references it)
```

**Commit**: `feat(sprint-6 phase 1): Step 1.4 — restructure resolvingFallbackPolicy into compound state with route dispatch`

---

### Step 1.5: Remove invokeFallbackPolicy + generationFallbackActor

**Objective**: Remove the old universal fallback actor registration and import.

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

**Change 1**: Remove import (line 8):
```diff
- import { generationFallbackActor } from './generation-fallback.actor';
```

**Change 2**: Remove registration from `generationSystemActors` object:
```diff
- invokeFallbackPolicy: generationFallbackActor,
```

**Validation**:
```bash
rg -c "invokeFallbackPolicy|generationFallbackActor" apps/backend/src/lib/machines/
# Expected: 0
npm --workspace apps/backend run typecheck
# Expected: clean
```

**Commit**: `feat(sprint-6 phase 1): Step 1.5 — remove invokeFallbackPolicy + generationFallbackActor`

---

### Step 1.6: Fix GenerationSystemProvidedActor union + archive orphaned file

**Objective**: Fix duplicate entries in the type union. Archive orphaned `generation-fallback.actor.ts`.

**File 1**: `apps/backend/src/lib/machines/generation-system.actors.ts`

Remove duplicates (lines 423+425 for `invokeFallbackPolicy`, lines 424+426 for `markCompletedIdempotency`). Add 3 new entries for route-specific actors:

```diff
  | { src: 'invokeToolWorkflow'; logic: typeof generationSystemActors.invokeToolWorkflow; id: string | undefined }
- | { src: 'invokeFallbackPolicy'; logic: typeof generationSystemActors.invokeFallbackPolicy; id: string | undefined }
  | { src: 'markCompletedIdempotency'; logic: typeof generationSystemActors.markCompletedIdempotency; id: string | undefined }
- | { src: 'invokeFallbackPolicy'; logic: typeof generationSystemActors.invokeFallbackPolicy; id: string | undefined }
- | { src: 'markCompletedIdempotency'; logic: typeof generationSystemActors.markCompletedIdempotency; id: string | undefined }
  | { src: 'markFailedIdempotency'; logic: typeof generationSystemActors.markFailedIdempotency; id: string | undefined }
  ...
+ | { src: 'extractionErrorActor'; logic: typeof generationSystemActors.extractionErrorActor; id: string | undefined }
+ | { src: 'toolWorkflowErrorActor'; logic: typeof generationSystemActors.toolWorkflowErrorActor; id: string | undefined }
+ | { src: 'genericErrorActor'; logic: typeof generationSystemActors.genericErrorActor; id: string | undefined }
```

**File 2**: Archive `generation-fallback.actor.ts` (now orphaned — zero imports):

```bash
git mv apps/backend/src/lib/machines/generation-fallback.actor.ts docs/99-lifecycle/99-archive/
```

Add a brief note at the top of the archived file explaining it was replaced by route-specific error actors in Sprint 6.

**Validation**:
```bash
npm --workspace apps/backend run typecheck
# Expected: clean
rg -c "generationFallbackActor" apps/backend/src/
# Expected: 0
```

**Commit**: `feat(sprint-6 phase 1): Step 1.6 — fix ProvidedActor union + archive generation-fallback.actor.ts`

---

### Step 1.7: Route-specific error recovery tests (5 new → 345 total)

**Objective**: Verify route-specific actor invocation and fail-forward behavior.

**New file**: `apps/backend/src/lib/tests/generation-system.error-recovery-routing.test.ts`

**Test cases** (run with Node built-in test runner):

1. **`extraction route invokes extractionErrorActor`** — Send REQUEST_RECEIVED with `toolKey: 'extraction'` → trigger extraction failure → verify `failureReason` contains `'content_available_despite_extraction_failure'` (extraction-specific output from partial recovery branch) or `'extraction_failed'` (complete failure branch).

2. **`tool route invokes toolWorkflowErrorActor`** — Send REQUEST_RECEIVED with `toolKey` mapping to tool route → trigger workflow failure → verify `failureReason` contains tool-specific output text.

3. **`generic route invokes genericErrorActor`** — Send REQUEST_RECEIVED with `toolKey: null`, `workflowType: null` (generic route) → trigger generic failure → verify `failureReason` contains `'content_partially_available'` or `'generation_failed'`.

4. **`null route falls back to genericErrorActor`** — Verify that if `routeType` were null at fallback time, `genericErrorActor` handles it (safety net test).

5. **`mode='generate' routes to persistingFailureSync`** — Verify that non-streaming mode failures route to `persistingFailureSync` (sync persistence path) rather than `persistingFailure` (batched path).

**Mock helper**: `createMockGenerationContext()` from Sprint 5 test suite — reuse for deterministic field values.

**Validation**:
```bash
node --import tsx --test apps/backend/src/lib/tests/generation-system.error-recovery-routing.test.ts
# Expected: 5 tests pass
npm --workspace apps/backend run test
# Expected: 345 total pass (340 baseline + 5 new)
```

**Commit**: `test(sprint-6 phase 1): Step 1.7 — route-specific error recovery tests (5 new tests)`

---

### Step 1.8: Full regression (Phase 1)

**Objective**: Verify Sprint 6 Phase 1 introduced zero regressions.

```bash
# Backend full gate
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
# Expected: 345 test pass, typecheck clean

# Frontend regression guard (untouched in Sprint 6)
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
# Expected: 448 test pass, typecheck clean (no FE break)

# Sprint 5 validation script (regression check)
bash scripts/validate-sprint-5-context-migration.sh
# Expected: all ✅
```

**Commit**: `feat(sprint-6 phase 1): Step 1.8 — full regression (Phase 1 complete)`

---

## PHASE 2: Legacy Cleanup

### Step 2.1: Remove GenerationMachineContextLegacy alias

**Objective**: Remove the deprecated type alias created in Sprint 5 Step 2.1.

**File**: `apps/backend/src/lib/machines/generation-system.types.ts`

Remove:
```diff
- /**
-  * Legacy alias for any consumer still referencing the pre-decomposition type name.
-  * Removed in Sprint 6.
-  */
- export type GenerationMachineContextLegacy = GenerationMachineContext;
```

**Validation**:
```bash
rg -c "GenerationMachineContextLegacy" apps/backend/src/
# Expected: 0
npm --workspace apps/backend run typecheck
# Expected: clean
```

**Commit**: `feat(sprint-6 phase 2): Step 2.1 — remove GenerationMachineContextLegacy alias`

---

### Step 2.2: Full regression + plan status bump

**Objective**: Final validation that Sprint 6 introduced zero regressions.

```bash
# Backend full gate
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
# Expected: 345 test pass, typecheck clean

# Frontend regression guard
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
# Expected: 448 test pass, typecheck clean

# Sprint 5 validation script (still valid — regression check)
bash scripts/validate-sprint-5-context-migration.sh
# Expected: all ✅
```

**Plan update**:
- Bump frontmatter: `status: completed`, `version: 1.1-complete`, `last-reviewed: 2026-07-12`
- Update Success Matrix: all rows ✅
- Update footer: Sprint 6 COMPLETE, Sprint 7 scope noted (V6/V7)

**Commit**: `feat(sprint-6 phase 2): Step 2.2 — full regression + plan status bump (Sprint 6 complete)`

---

## Success Matrix

| Phase | Success Criteria | Status | Validation Command |
|-------|------------------|--------|-------------------|
| **Phase 1** | 3 error-actors registered + compound state + invokeFallbackPolicy removed | 🟡 TODO | `rg -c "extractionErrorActor\|toolWorkflowErrorActor\|genericErrorActor" actors.ts` ≥ 4 |
| **Phase 1** | applyRouteErrorOutput action maps 8 variants → failureReason | 🟡 TODO | typecheck clean |
| **Phase 1** | resolvingFallbackPolicy compound state with route dispatch | 🟡 TODO | `rg -c "resolvingFallbackPolicy" persistence.states.ts` still present, but internal structure changed |
| **Phase 1** | invokeFallbackPolicy + generationFallbackActor removed | 🟡 TODO | `rg "invokeFallbackPolicy\|generationFallbackActor" apps/backend/src/` → 0 |
| **Phase 1** | GenerationSystemProvidedActor union cleaned (no duplicates) | 🟡 TODO | typecheck clean |
| **Phase 1** | generation-fallback.actor.ts archived | 🟡 TODO | file moved to docs/99-lifecycle/99-archive/ |
| **Tests** | 5 route-specific error recovery tests | 🟡 TODO | 345 backend tests pass |
| **Phase 2** | GenerationMachineContextLegacy removed | 🟡 TODO | `rg "GenerationMachineContextLegacy"` → 0 |
| **Integration** | 345 backend + 448 frontend tests pass, typecheck clean | 🟡 TODO | `npm run test` both workspaces |

**Final Target** (user-confirmed):
- Backend: **345 test pass** (340 baseline + 5 new error-recovery-routing)
- Frontend: **448 test pass** (regression guard — untouched)
- Typecheck: clean both workspaces
- 3 error-actors registered: `extractionErrorActor`, `toolWorkflowErrorActor`, `genericErrorActor`
- `invokeFallbackPolicy` references: 0 across codebase
- `GenerationMachineContextLegacy` references: 0 across codebase
- `generation-fallback.actor.ts`: archived

---

## Execution: Single Continuous Session

Sprint 6 = **one single session** (user-confirmed), sequential commits on `feature/sprint-4-session-2-reducer-bridge`:

| # | Step | Commit Subject |
|---|------|----------------|
| 1 | 1.1 | `feat(sprint-6 phase 1): Step 1.1 — export ErrorActorOutput + ErrorActorInput types` |
| 2 | 1.2 | `feat(sprint-6 phase 1): Step 1.2 — add applyRouteErrorOutput action (8-variant → failureReason)` |
| 3 | 1.3 | `feat(sprint-6 phase 1): Step 1.3 — register 3 route-specific error actors` |
| 4 | 1.4 | `feat(sprint-6 phase 1): Step 1.4 — restructure resolvingFallbackPolicy into compound state` |
| 5 | 1.5 | `feat(sprint-6 phase 1): Step 1.5 — remove invokeFallbackPolicy + generationFallbackActor` |
| 6 | 1.6 | `feat(sprint-6 phase 1): Step 1.6 — fix ProvidedActor union + archive generation-fallback.actor.ts` |
| 7 | 1.7 | `test(sprint-6 phase 1): Step 1.7 — route-specific error recovery tests (5 new tests)` |
| 8 | 1.8+2.1+2.2 | `feat(sprint-6): full regression + legacy cleanup + plan bump (Sprint 6 complete)` |

**Estimate**: 1 session (~2-3 ore di lavoro focalizzato).

---

## DDD Compliance Requirements

- **No new domain terms**: Sprint 6 wires already-approved error-actors (Sprint 4 Session 1). `ErrorActorOutput` variants are operational encodings, not domain terms.
- **Aggregate root preserved**: `GenerationSystem` remains aggregate root — compound state is internal restructure.
- **Error handling**: `DispatchErrorReasonCode` → `mapInlineDispatchError` boundary preserved (DDD-149).
- **XState v5 constraint**: `always` transitions confirmed via Context7 for route dispatch. Compound state targeting confirmed.

---

## Risks and Controls

| Risk | Control |
|------|---------|
| Compound state changes fallback behavior | Step 1.7 tests verify route-specific actor invocation; all 23 call sites unchanged |
| `applyRouteErrorOutput` maps incorrectly | Exhaustive switch on 8 variants — TypeScript enforces completeness |
| `null` routeType reaches fallback | `hasAmbiguousRouting` guard routes to `failed` BEFORE fallback; `genericErrorActor` is safety net |
| `generation-fallback.actor.ts` orphan causes TS error | Archived via `git mv`, not deleted — no TS error |
| `shouldRetry` logic lost | Deferred to Sprint 7 — not needed for fail-forward approach |
| Regression on existing 340 backend tests | Step 1.8 full `npm run go` gate |
| Frontend regression (FE untouched but shared branch) | Step 1.8 `npm --workspace apps/frontend run test` gate |

---

## Out-of-Scope (Explicitly Deferred to Sprint 7+)

1. **V6 (Progress State Mutation)** — Two concurrent mutators of `context.progress.completedSteps`; entire frontend refactor
2. **V7 (NONSTREAMING Technical Debt)** — 33+ occurrences; merging streaming/non-streaming persistence paths (FE+BE)
3. **Partial-recovery routing** — `PARTIAL_RECOVERY` → `persistingSuccess` instead of `persistingFailure`
4. **`getFallbackDoneOutput` removal** — dead code cleanup after restructure
5. **`shouldRetry` re-implementation** — current fallback actor has retry logic; new error actors don't; re-implement in future sprint
6. **`GenerationMachineContext` alias simplification** — `GenerationMachineContext = DecomposedGenerationContext` could be simplified further

---

## References

- [Sprint 5 Implementation Plan](./sprint-5-context-migration-validation-implementation-plan.md) (Out-of-Scope: error-actors wiring)
- [Sprint 4 Implementation Plan - Phase 2](../../../05-plans/sprint-4-core-architecture-resolution-implementation-plan.md) (Steps 1,4: error-actors + state documentation)
- [Unified Architectural Vulnerabilities Review](../../../07-governance/unified-architectural-vulnerabilities-review.md)
- [Domain Bounded Context Map](../../../02-design/domain-bounded-context-map.md) (BCM L40)
- [Domain Naming Decision Log](../../../07-governance/domain-naming-decision-log.md) (DDD-165 → DDD-172)
- `apps/backend/src/lib/machines/generation-system.error-actors.ts` (error actors defined)
- `apps/backend/src/lib/machines/generation-system.actors.ts` (actor registration)
- `apps/backend/src/lib/machines/generation-system.persistence.states.ts` (resolvingFallbackPolicy state)
- `apps/backend/src/lib/machines/generation-routing.ts` (RouteType definition)
- `apps/backend/src/lib/machines/generation-fallback.actor.ts` (to be archived)

---

**Last Updated**: 2026-07-12 (Sprint 6 plan created — error-actors wiring, BE-only, single session)
**Next Review**: 2026-07-19
**Review Owner**: Domain Architecture Team
**DDD Compliance Status**: ✅ **PASSED** - All DDD-165 through DDD-172 inherited from Sprint 4 Session 1
**AI Execution Ready**: ✅ **READY** - Plan finalized, awaiting user confirmation to proceed with Step 1.1
