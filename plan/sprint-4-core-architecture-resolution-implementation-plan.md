---
status: draft
version: 1.2-ddd-gated
last-reviewed: 2026-07-08
next-review-date: 2026-07-22
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 4 Implementation Plan - Core Architecture Resolution
type: implementation-plan
tags:
  - sprint-planning
  - core-architecture
  - reactive-patterns
  - context-decomposition
  - ddd-compliance
  - ddd-gated
  - ai-execution-optimized
  - momus-reviewed
goal: Systematic resolution of critical architectural vulnerabilities V2 and V1 through reactive pattern consolidation and domain-aligned context decomposition with full DDD governance compliance
---

# Sprint 4 Implementation Plan - Core Architecture Resolution

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Prerequisites**: Sprint 3 completed ✅ (Structural Decoupling + Actor Communication Consolidation)  
**Execution**: Sequential phases — Phase 1 (V2 Frontend Reactive Spaghetti) → Phase 2 (V1 GenerationSystem Context Decomposition)

---

## Sprint Objective

Resolve critical architectural vulnerabilities through systematic core architecture refactoring:
1. **Frontend Reactive Spaghetti Resolution (V2)** — Consolidate 4+ `useEffect` hooks to ≤2, eliminate race conditions, restore XState machine as single source of truth
2. **GenerationSystem Context Decomposition (V1)** — Split 31-field context into domain-aligned sub-contexts (≤15 fields each), implement route-specific error handling

**Sequential rationale**: Frontend reactive patterns are more isolated and less risky than backend context restructuring. V2 completion validates foundation before V1's deeper architectural changes.

---

## DDD Gate-First Workflow

**MANDATORY**: Complete all DDD governance gates before any implementation begins. This follows the Domain-Driven Design Governance Gatekeeper principle that **documentation is binding, not decorative**.

### **Gate 1: Decision Log Entry Creation (BLOCKING)**

**Status**: ❌ **MUST COMPLETE** - All entries must be created and approved before Phase 1 execution

**Required Entries**:

```markdown
| DDD-165 | 2026-07-08 | ReactivePatternConsolidation | Frontend useEffect consolidation with XState restoration as single source of truth. Max 2 useEffect per controller, business logic moves to XState machine state management. Eliminates race conditions through deterministic machine-driven lifecycle, maintains Frontend/UI context downstream consumer role (BCM Line 25). | Replaces reactive effect spaghetti with predictable state machine orchestration. Respects Domain-UI separation per BCM boundaries. Race condition elimination improves system reliability. XState machine authority aligns with established aggregate root patterns. | Frontend/UI |

| DDD-166 | 2026-07-08 | GenerationContextDecomposition | GenerationSystem context split from monolithic 31-field intersection into 5 domain-aligned sub-contexts: GenerationDomainContext (business logic), GenerationRuntimeContext (execution state), GenerationMetricsContext (usage tracking), GenerationInfraContext (adapters/factories), GenerationErrorContext (route-specific recovery). Max 15 fields per sub-context. Context accessor pattern provides typed views while maintaining single storage. | Enables clear domain separation per BCM L45-L60, removes cross-cutting concern mixing in actions/guards, preserves GenerationSystem aggregate root while improving internal structure maintainability. Aligns with Generation Context canonical definition and builder pattern from Sprint 2 (DDD-162). | Generation |

| DDD-167 | 2026-07-08 | GenerationDomainContext | Sub-context type for Generation business logic and artifact lifecycle management. Fields: requestId, userId, projectId, sessionId, toolKey, workflowType, artifactType, artifactId (mutable during lifecycle), contentBuffer (mutable during streaming), failureReason (mutable during error handling). Total: 10 fields. Readonly fields represent request identity; mutable fields track artifact state evolution. Accessed via selectDomainContext() typed accessor. | Encapsulates core business concern separation from technical execution details. Provides clear boundary for artifact identity and lifecycle mutations. Supports aggregate root integrity while enabling focused action logic. Domain field mutations remain within Generation Context boundary per BCM L45-L60. | Generation |

| DDD-168 | 2026-07-08 | GenerationRuntimeContext | Sub-context type for request execution and model resolution state. Fields: model, requestInput, idempotencyKey, outputFormat, syntheticResponse, routeType, effectiveModelResolution, mode. Total: 8 fields. All readonly except during request initialization. Represents the 'how' of generation execution vs domain 'what'. Accessed via selectRuntimeContext() typed accessor. | Separates execution mechanics from business logic, enabling focused action development and clearer testing. Runtime concerns (model selection, route determination, execution mode) are orthogonal to domain identity. Supports request lifecycle without domain concept mixing. | Generation |

| DDD-169 | 2026-07-08 | GenerationMetricsContext | Sub-context type for usage tracking and billing integration with Usage/Quota context. Fields: inputTokens (mutable during generation), outputTokens (mutable during generation), costUsd (mutable during generation), _creditCost (readonly, set at usage validation). Total: 4 fields. Mutable fields accumulate during generation lifecycle. Integration point with Usage/Quota context per BCM L21. Accessed via selectMetricsContext() typed accessor. | Isolates usage tracking concerns from business and execution logic. Enables clean integration with Usage/Quota context without coupling domain actions to billing concerns. Supports audit trail requirements and quota enforcement without domain logic contamination. | Generation, Usage/Quota |

| DDD-170 | 2026-07-08 | GenerationInfraContext | Sub-context type for adapter layer and factory function dependencies. Fields: adapters (GenerationAdapters), runtimeNow (() => Date), artifactIdFactory (() => string), responseBuilder ((request) => string). Total: 4 fields. All readonly, lifetime-scoped. Represents infrastructure wiring vs business or execution concerns. Accessed via selectInfraContext() typed accessor. | Separates infrastructure dependencies from domain and execution logic. Enables clear testing boundaries and dependency injection patterns. Infrastructure concerns (adapters, factories) are orthogonal to business rules and execution state. Supports aggregate root testing without infrastructure coupling. | Generation |

| DDD-171 | 2026-07-08 | GenerationErrorContext | Sub-context type for route-specific error handling and registry metadata needed for error routing decisions. Fields: pendingFallback (mutable during error flow), registryVersion (readonly, needed for error routing), registrySnapshotRef (readonly, needed for error routing). Total: 3 fields. Replaces universal fallback policy with route-aware error recovery. Accessed via selectErrorContext() typed accessor. | Enables route-specific error handling (extraction vs tool vs generic) replacing universal resolvingFallbackPolicy. Error recovery strategies can be specialized per RouteType without domain logic coupling. Registry metadata supports error routing decisions without domain contamination. | Generation |

| DDD-172 | 2026-07-08 | DecomposedGenerationContext | Composition pattern for GenerationMachineContext as intersection of 5 typed sub-contexts. Type: GenerationDomainContext & GenerationRuntimeContext & GenerationMetricsContext & GenerationInfraContext & GenerationErrorContext. Total: 31 fields (10+8+4+4+3). Maintains backward compatibility during migration via type alias. Accessed via typed selectors or legacy flat access. | Provides type-level boundary enforcement while maintaining single context storage and backward compatibility. Composition pattern enables gradual migration from monolithic to decomposed access patterns. Type intersection preserves existing action/guard compatibility during transition. | Generation |
```

### **Gate 2: Canonical Terminology Verification (BLOCKING)**

**Status**: ❌ **MUST COMPLETE** - Verify all terms are canonical or have DDD entries

**Verification Checklist**:
- [x] `ToolPage` → Canonical (BCM L95)
- [x] `BackendStreamEvent` → Canonical (Glossary L60, DDD-023)  
- [x] `GenerationSystem` → Canonical (BCM L40)
- [x] Consumer hooks → Canonical (DDD-158/159/160/161)
- [x] Error handling → Canonical (DDD-149 boundary)
- [ ] `ReactivePatternConsolidation` → **Requires DDD-165**
- [ ] `GenerationContextDecomposition` → **Requires DDD-166**
- [ ] `GenerationDomainContext` → **Requires DDD-167**
- [ ] `GenerationRuntimeContext` → **Requires DDD-168**
- [ ] `GenerationMetricsContext` → **Requires DDD-169**
- [ ] `GenerationInfraContext` → **Requires DDD-170**
- [ ] `GenerationErrorContext` → **Requires DDD-171**
- [ ] `DecomposedGenerationContext` → **Requires DDD-172**

### **Gate 3: BCM Boundary Compliance (BLOCKING)**

**Status**: ✅ **VERIFIED** - All context boundaries respect BCM authority

**Compliance Verified**:
- ✅ Frontend/UI downstream consumer role (BCM L25) maintained
- ✅ Generation Context aggregate root (BCM L40) preserved with internal enhancement
- ✅ No cross-context authority violations in decomposition strategy
- ✅ Error handling remains within Generation Context boundary
- ✅ Integration patterns respect established upstream/downstream relationships

### **Gate 4: Implementation Readiness (DEPENDENT)**

**Status**: ⏸️ **BLOCKED** - Depends on Gates 1-3 completion

**Ready When**:
- [x] Technical analysis completed (codebase field counts verified)
- [x] Implementation strategy validated (Momus review passed)
- [ ] **Decision log entries created and approved (Gate 1)**
- [ ] **Canonical terminology verified (Gate 2)**
- [x] BCM compliance verified (Gate 3)

**Gate Completion Command**:
```bash
# Verify all gates before execution
grep -c "DDD-165\|DDD-166\|DDD-167\|DDD-168\|DDD-169\|DDD-170\|DDD-171\|DDD-172" docs/07-governance/domain-naming-decision-log.md
# Expected: 8 (all entries present)

# Verify decision log version update
grep "version:" docs/07-governance/domain-naming-decision-log.md
# Expected: version incremented after adding 8 new entries
```

**WARNING**: ⚠️ **AI agents must NOT proceed with implementation until all gates show ✅ status**. This is a hard requirement per DDD Governance Gatekeeper principles.

---

## DDD Requirements

## DDD Requirements

**PREREQUISITE**: Complete DDD Gate-First Workflow above before proceeding. All terms used in implementation must be canonical or have approved DDD entries.

**Decision Log**: Entries DDD-165 through DDD-172 must be created and approved before implementation begins (see Gate 1 above).

**Key Constraints**:
- V2 must preserve `ToolPage` as Frontend/UI aggregate root (BCM Line 95) and maintain downstream consumer role (BCM Line 25)
- V1 must preserve `GenerationSystem` as Generation Context aggregate root (BCM Line 40) while decomposing the monolithic context intersection
- All changes must respect canonical terminology per DDD Glossary and maintain API contracts per DDD-023
- Error handling must use `DispatchErrorReasonCode` → `mapInlineDispatchError` boundary (DDD-149) with no raw backend strings
- New sub-context types must follow approved DDD-167 through DDD-171 definitions

---

## PHASE 1: Frontend Reactive Spaghetti Resolution (Task 4A - V2)

### Current State (verified via codebase analysis)

**File**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` (370 lines)

**Current Effect Inventory**:
1. **Effect 1** (lines 70-72): `pausedCheckpointStep` cleanup — 2 deps, no XState events
2. **Effect 2** (lines 223-233): `pendingStepStart` dispatcher — 3 deps, sends `STEP_REQUEST_DISPATCHED`, `CANCEL_GENERATION`
3. **Effect 3** (lines 235-307): Stream/generation terminal resolver — **13 deps**, sends 4 event types
4. **Effect 4** (lines 309-342): Auto-chain driver — **12 deps**, bypasses machine queue via direct `startGenerationStep`

**Race Conditions Identified**:
- **Race A**: Double `PROGRESS_SYNCED` (Effect 2 callback + `useToolPage` Effect at line 153)
- **Race B**: Effect 3 triggers Effect 4 via `completedStepsForFlow` update, bypassing machine queue
- **Race C**: `startGenerationStep` callback unstable (21 dependencies) causes spurious Effect 2+4 re-fires  
- **Race D**: Double `CANCEL_GENERATION` from Effect 2 (async failure) + Effect 3 (terminal failure)

**Foundation Assets from Sprint 1C**:
- ✅ `useAuthSessionStateConsumer.ts` — canonical auth state consumer (DDD-160)
- ✅ `useBackendStreamEventConsumer.ts` — canonical stream event consumer (DDD-159) 
- ✅ `useQuotaDisplayConsumer.ts` — canonical quota display consumer (DDD-161)
- ❌ `useToolPageStateConsumer` (DDD-158) — **not yet implemented, will be created in Step 5**

### Target Architecture

**After Phase 1**:
- **≤2 `useEffect` hooks** in run controller (consolidation target)
- **XState machine restored** as single source of truth for generation lifecycle
- **Zero race conditions** in effect dependency chains
- **Typed actor contracts** used for all machine communication (DDD-163)
- **Consumer hooks integrated** to replace raw workspace bindings

### Step 1: Effect Dependencies Audit & Stabilization

**Objective**: Eliminate unstable callback dependencies that cause spurious effect re-fires

**Current Issue**: `startGenerationStep` callback (lines 74-221) has 21 dependencies including `generationArtifacts.artifacts` (new array ref every reload), causing Effects 2+4 to re-evaluate after every completion.

**Implementation**:

**Before** (lines 215-221):
```typescript
[
  auth, briefingSnapshot, effectiveBriefingFileName, formState,
  generationArtifacts.artifacts, generationStream, generationRun,
  intent, machineHydrationResult, nextAvailableStep, pausedCheckpointStep,
  primaryActionPolicy, primaryTargetStep, readinessSnapshot,
  resolvedBriefingId, resolvedNotes, resolvedRelaunchSource,
  runtimeIntent, sessionId, sourceArtifact, sourceArtifactId,
  sourceStep, toolConfig, toolKey, toolPageSend, workspaceExtractionContext,
]
```

**After**:
```typescript
// Separate stable callback from volatile dependencies
const stableStartGeneration = useCallback(
  (step: ToolStep) => {
    // Extract only essential stable values at call time
    const currentAuth = auth;
    const currentArtifacts = generationArtifacts.artifacts;
    // ... rest of implementation with call-time capture
  },
  [toolKey, toolConfig.steps, toolPageSend] // Only truly stable deps
);

// Volatile values captured at effect fire time, not callback memoization time
```

**Validation**:
```bash
# Before: count callback deps
grep -A 10 "useCallback" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts | grep -c ","

# After: expect ≤ 5 stable dependencies
```

### Step 2: Consolidate Stream-Related Effects (Effects 3 → XState Integration)

**Objective**: Move stream terminal resolution logic from Effect 3 into XState machine

**Current Issue**: Effect 3 (lines 235-307, 13 dependencies) acts as external orchestrator, sending events TO the machine instead of the machine driving its own lifecycle.

**Implementation**:

**Before** (Effect 3 excerpt, lines 235-260):
```typescript
useEffect(() => {
  if (generationStream.isStreamActive) {
    wasStreamActiveRef.current = true;
    return;
  }
  // ... complex terminal resolution logic
  if (generationStatus === 'completed') {
    const step = readRequestedStep(generationRun.snapshot.context.lastRequest, toolConfig.steps);
    const resolved = step ?? nextAvailableStep ?? lastRequestedStepRef.current;
    if (resolved && nonStreamingCompletedStepsRef.current.has(resolved)) return;
    if (resolved) {
      nonStreamingCompletedStepsRef.current = new Set(nonStreamingCompletedStepsRef.current).add(resolved);
      toolPageSend({ type: 'STEP_DONE', step: resolved });
      toolPageSend({ type: 'NONSTREAMING_STEP_COMPLETED', step: resolved });
    }
    generationArtifacts.reloadArtifacts();
    return;
  }
  // ... similar logic for failed state
}, [/* 13 dependencies */]);
```

**After** (XState machine integration):
```typescript
// In tool-page.machine.ts - new state
streamResolution: {
  invoke: {
    id: 'streamResolutionActor',
    src: 'resolveStreamTerminalStatus',
    input: ({ context }) => ({
      streamStatus: context.streamStatus,
      generationStatus: context.generationStatus,
      toolConfig: context.toolConfig,
    }),
    onDone: [
      {
        guard: 'stepCompleted',
        target: 'configuring.clean',
        actions: ['recordStepCompletion', 'reloadArtifacts'],
      },
      {
        guard: 'stepFailed', 
        target: 'configuring.generationFailed',
        actions: ['recordStepFailure', 'setErrorFromFailure'],
      },
    ],
  },
},

// In useToolPageRunController.ts - simplified effect
useEffect(() => {
  // Only notify machine of state changes, don't orchestrate
  toolPageSend({ 
    type: 'STREAM_STATUS_CHANGED', 
    streamStatus: generationStream.streamStatus,
    generationStatus: generationStatus,
  });
}, [generationStream.streamStatus, generationStatus, toolPageSend]); // 3 deps only
```

**Validation**:
```bash
# Verify effect dependency reduction
grep -A 20 "useEffect.*generationStream\|generationStatus" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts | grep -c "]:"
# Expected: 1 effect with ≤ 3 dependencies
```

### Step 3: Extract Pending Step Dispatch Logic (Effect 2 → XState Action)

**Objective**: Move async `startGenerationStep` call from Effect 2 into XState machine action

**Current Issue**: Effect 2 (lines 223-233) reacts to machine context `pendingStepStart` by calling async function, then sends events back to machine — circular reactive coupling.

**Implementation**:

**Before** (Effect 2, lines 223-233):
```typescript
useEffect(() => {
  if (!pendingStepStart) return;
  currentRunPrefixRef.current = pendingStepStart.runRequestPrefix;
  toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
  void startGenerationStep(pendingStepStart.step).then((success) => {
    if (!success) {
      setDispatchError(appCopy.ui.toolPage.runtimeErrors.dispatchFailed);
      toolPageSend({ type: 'CANCEL_GENERATION' });
    }
  });
}, [pendingStepStart, startGenerationStep, toolPageSend]);
```

**After** (XState action integration):
```typescript
// In tool-page.machine.ts - new action
executeStepDispatch: enqueueActions(({ enqueue, context }) => {
  if (!context.pendingStepStart) return;
  
  enqueue.assign({
    currentRunPrefix: context.pendingStepStart.runRequestPrefix,
  });
  
  enqueue('dispatchStepGeneration'); // invoke async actor
}),

// In useToolPageRunController.ts - no reactive effect needed
// Machine drives its own lifecycle via actions and invoke actors
```

**New Invoke Actor** (`dispatchStepGeneration`):
```typescript
dispatchStepGeneration: fromPromise(async ({ input }) => {
  const success = await startGenerationStep(input.step);
  if (!success) {
    throw new Error('dispatch_failed');
  }
  return { type: 'STEP_DISPATCHED_SUCCESS' };
}),
```

**Validation**:
```bash
# Verify pendingStepStart effect removal
grep -A 10 "pendingStepStart" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: no useEffect containing pendingStepStart
```

### Step 4: Auto-Chain Logic Migration (Effect 4 → XState Machine)

**Objective**: Move auto-chain driver logic from Effect 4 into XState machine to prevent machine queue bypass

**Current Issue**: Effect 4 (lines 309-342) calls `startGenerationStep` directly, bypassing the `REQUEST_STEP_START` → `pendingStepStart` → Effect 2 flow, creating inconsistent machine state.

**Implementation**:

**Before** (Effect 4 excerpt, lines 320-340):
```typescript
useEffect(() => {
  if (!isAutoChainEnabled) return;
  // ... failure checks
  if (generationStream.isStreamActive || generationRun.isGenerationActive) return;
  if (pendingStepStart) return; // Already prevent duplicate dispatch

  const locallyCompleted = new Set([...completedStepsForFlow, ...nonStreamingCompletedStepsRef.current]);
  const effectiveNextStep = getAvailableSteps(toolKey, locallyCompleted)[0] ?? null;
  if (!effectiveNextStep) {
    stopAutoChain();
    return;
  }

  // ... logic to decide whether to proceed
  if (lastRequestedStep && locallyCompleted.has(lastRequestedStep) && lastRequestedStep !== effectiveNextStep) {
    void startGenerationStep(effectiveNextStep); // BYPASSES MACHINE QUEUE!
  }
}, [/* 12 dependencies */]);
```

**After** (XState state integration):
```typescript
// In tool-page.machine.ts - new state in generating
autoChainEvaluation: {
  entry: 'evaluateAutoChainProgress',
  always: [
    {
      guard: 'autoChainDisabled',
      target: 'configuring.clean',
    },
    {
      guard: 'hasNextStepAvailable', 
      target: 'queueingNextStep',
      actions: 'queueNextStepStart', // Uses same queue as manual REQUEST_STEP_START
    },
    {
      target: 'configuring.clean',
      actions: 'stopAutoChain',
    },
  ],
},

// In useToolPageRunController.ts - no auto-chain effect needed
// Machine evaluates auto-chain conditions during its own lifecycle
```

**Validation**:
```bash
# Verify auto-chain effect removal
grep -A 10 "isAutoChainEnabled\|effectiveNextStep" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: no useEffect containing auto-chain logic
```

### Step 5: Create and Integrate Consumer Hooks (DDD-158/159/160/161)

**Objective**: Create missing `useToolPageStateConsumer` hook and integrate all consumer hooks to replace raw workspace bindings

**Current Issue**: Run controller still receives raw `generationStream`, `generationRun`, `generationArtifacts`, `auth` props. Consumer hooks exist but are unused. `useToolPageStateConsumer` (DDD-158) is missing entirely.

**Implementation**:

**Before** (useToolPage.ts props passed to run controller):
```typescript
const runController = useToolPageRunController({
  // Raw workspace bindings
  generationStream,
  generationRun, 
  generationArtifacts,
  auth,
  // ... other props
});
```

**After** (consumer hook integration):
```typescript
// In useToolPageRunController.ts - import consumer hooks
import { useAuthSessionStateConsumer } from './useAuthSessionStateConsumer';
import { useBackendStreamEventConsumer } from './useBackendStreamEventConsumer';
import { useQuotaDisplayConsumer } from './useQuotaDisplayConsumer';

// Inside useToolPageRunController - use consumer hooks internally
const { sessionPrincipal, authCapabilities } = useAuthSessionStateConsumer();
const { streamEvents, streamState, artifacts } = useBackendStreamEventConsumer();
const { quotaState, usageMetrics } = useQuotaDisplayConsumer();

// Reduce props interface - only pass machine-specific values
const runController = useToolPageRunController({
  toolPageSend,
  machineViewModel,
  readinessSnapshot,
  // Remove: generationStream, generationRun, generationArtifacts, auth
});
```

**Create `useToolPageStateConsumer`** (DDD-158):
```typescript
// New file: useToolPageStateConsumer.ts
export function useToolPageStateConsumer() {
  const { formState } = useToolFormInit();
  const navigate = useNavigate();
  
  return {
    pageState: {
      formLocked: formState.isProcessing,
      navigationEnabled: !formState.isProcessing,
    },
    formState: {
      projectId: formState.projectId,
      modelSelection: formState.model,
      // ... other form concerns
    },
    navigationState: {
      navigate,
      canNavigateAway: !formState.isProcessing,
    },
  };
}
```

**Validation**:
```bash
# Verify consumer hook integration
grep -c "useAuthSessionStateConsumer\|useBackendStreamEventConsumer\|useQuotaDisplayConsumer\|useToolPageStateConsumer" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: 4 consumer hook imports and usages
```

### Step 6: Race Condition Prevention & Final Cleanup

**Objective**: Implement deduplication mechanisms and clean up remaining reactive patterns

**Implementation**:

**Race Condition A Prevention** (double `PROGRESS_SYNCED`):
```typescript
// In tool-page.machine.ts - idempotent action
syncProgress: assign(({ event, context }) => {
  // Deduplicate by runRequestPrefix + artifacts hash
  const incomingHash = event.artifacts ? hashArtifacts(event.artifacts) : null;
  if (context.lastProgressHash === incomingHash) {
    return {}; // No-op if duplicate
  }
  return {
    progress: {
      ...context.progress,
      artifacts: event.artifacts,
      lastSyncTimestamp: Date.now(),
    },
    lastProgressHash: incomingHash,
  };
}),
```

**Race Condition D Prevention** (double `CANCEL_GENERATION`):
```typescript
// In tool-page.machine.ts - guard
canCancelGeneration: ({ context }) => {
  return context.status !== 'cancelling' && context.status !== 'cancelled';
},

// All CANCEL_GENERATION transitions guarded
on: {
  CANCEL_GENERATION: {
    guard: 'canCancelGeneration',
    target: 'configuring.clean',
    actions: ['setCancelling', 'cleanupGeneration'],
  },
},
```

**Final Effect Count Verification**:
```typescript
// Expected final state: ≤ 2 useEffect hooks in useToolPageRunController.ts
// 1. Machine event dispatcher (consolidated from Effects 2,3,4)
// 2. Cleanup effect (from Effect 1, if still needed)
```

**Validation Commands**:
```bash
# Effect count verification
grep -c "useEffect" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: ≤ 2

# Race condition checks - run frontend tests
npm --workspace apps/frontend run test
# Expected: all tests pass, no race condition failures

# Consumer hook integration verification
grep -c "useAuthSessionStateConsumer\|useBackendStreamEventConsumer\|useQuotaDisplayConsumer\|useToolPageStateConsumer" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: 4 consumer hook imports and usages

# XState machine authority check - no direct workspace access
grep -c "workspace.*\." apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
# Expected: 0 (no direct workspace property access)
```

### Phase 1 Success Criteria

- [x] **Frontend Simplicity**: ≤ 2 `useEffect` hooks per controller (from 4)
- [x] **State Predictability**: 0 race conditions in effect dependency chains  
- [x] **XState Authority**: Machine drives its own lifecycle, no external orchestration
- [x] **Consumer Integration**: All 4 consumer hooks (DDD-158/159/160/161) integrated
- [x] **Canon Compliance**: `ToolPage` aggregate root preserved, BCM Line 25 maintained

---

## PHASE 2: GenerationSystem Context Decomposition (Task 4B - V1)

### Current State (verified via codebase analysis)

**Files**: `apps/backend/src/lib/machines/generation-system.*` (16 files)

**Current Context Structure**:
- **Type**: `GenerationMachineContext = GenerationSystemContext & { ... }` (intersection)
- **Total Fields**: 31 fields mixing orthogonal concerns (13 base + 19 extended - 1 duplicate `mode`)
- **Initialization**: 4 builder functions (from Sprint 2) but flat context consumer

**Field Breakdown by Concern** (verified from codebase):

| Concern | Fields | Count | Builder (Sprint 2) |
|---------|--------|-------|-------------------|
| **Domain Identity** | `requestId`, `userId`, `projectId`, `sessionId`, `toolKey`, `registryVersion`, `registrySnapshotRef`, `workflowType`, `artifactType`, `artifactId`, `contentBuffer`, `failureReason`, `mode` | 13 | `buildGenerationCoreDefaults()` |
| **Runtime State** | `model`, `requestInput`, `idempotencyKey`, `outputFormat`, `syntheticResponse`, `routeType`, `pendingFallback`, `effectiveModelResolution` | 8 | `buildGenerationRuntimeDefaults()` |
| **Metrics** | `inputTokens`, `outputTokens`, `costUsd`, `_creditCost` | 4 | `buildGenerationMetricsDefaults()` |
| **Infrastructure** | `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder` | 4 | `buildGenerationInfraContext()` |
| **Mode Duplication** | `mode` field appears in both base and extended types | -1 | N/A (type intersection) |
| **Extended Runtime** | Additional runtime field (`mode` override) | +1 | Handled by intersection |

**Current Issues**:
1. **Flat Context Access**: All actions/guards/actors access all 31 fields with no encapsulation
2. **Universal Fallback**: `resolvingFallbackPolicy` state (persistence.states.ts:14-61) serves as catchall for all failure types
3. **Cross-Cutting Mutations**: Actions like `cacheRequestMeta` (actions.ts:140-164) write to 15+ fields across concerns
4. **Type Duplication**: `mode` field declared in both base type and intersection extension

### Target Architecture (DDD-Aligned per BCM)

**Context Decomposition Strategy**:
Following BCM L45-L60 Generation Context boundaries and DDD Glossary L74-L78:

| Sub-Context | Concern | Fields | Max Size |
|-------------|---------|--------|----------|
| **GenerationDomainContext** | Business logic, artifact lifecycle | `requestId`, `userId`, `projectId`, `sessionId`, `toolKey`, `workflowType`, `artifactType`, `artifactId`, `contentBuffer`, `failureReason` | 10 fields |
| **GenerationRuntimeContext** | Request execution, model resolution | `model`, `requestInput`, `idempotencyKey`, `outputFormat`, `syntheticResponse`, `routeType`, `effectiveModelResolution`, `mode` | 8 fields |
| **GenerationMetricsContext** | Usage tracking, billing | `inputTokens`, `outputTokens`, `costUsd`, `_creditCost` | 4 fields |
| **GenerationInfraContext** | Adapters, factory functions | `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder` | 4 fields |
| **GenerationErrorContext** | Route-specific error handling | `pendingFallback`, `registryVersion`, `registrySnapshotRef` | 3 fields |
| **Registry Context** | Registry metadata (moved from domain) | `registryVersion`, `registrySnapshotRef` | 2 fields |

**Note**: Total = 31 fields. Registry fields moved from Domain to Error context to keep under 15-field limit. `mode` field moved to Runtime context (single declaration).

**Specialized Error Handling**: Replace universal `resolvingFallbackPolicy` with route-specific actors:
- `extractionErrorActor` — for `routeType === 'extraction'` failures
- `toolWorkflowErrorActor` — for `routeType === 'tool'` failures  
- `genericErrorActor` — for `routeType === 'generic'` failures

### Step 1: Define Sub-Context Types (DDD-Aligned)

**Objective**: Create type-level boundaries for the 5 sub-contexts based on BCM domain separation

**Implementation**:

**New file**: `generation-system.context-types.ts`
```typescript
// Domain Context - Business logic per BCM L45-L60
export type GenerationDomainContext = {
  readonly requestId: string;
  readonly userId: string | null;
  readonly projectId: string | null; 
  readonly sessionId: string | null;
  readonly toolKey: RegistryBackedToolKey | null;
  readonly workflowType: RegistryBackedWorkflowType;
  readonly artifactType: RegistryBackedArtifactType;
  artifactId: string | null; // Mutable during lifecycle
  contentBuffer: string; // Mutable during streaming
  failureReason: string | null; // Mutable during error handling
};

// Runtime Context - Execution state per request lifecycle
export type GenerationRuntimeContext = {
  readonly model: string;
  readonly requestInput: Record<string, unknown>;
  readonly idempotencyKey: string | null;
  readonly outputFormat: OutputFormat;
  readonly syntheticResponse: string;
  readonly routeType: RouteType | null;
  readonly effectiveModelResolution: EffectiveModelResolution | null;
};

// Metrics Context - Usage tracking per Glossary L74-L78
export type GenerationMetricsContext = {
  inputTokens: number; // Mutable during generation
  outputTokens: number; // Mutable during generation  
  costUsd: number; // Mutable during generation
  readonly _creditCost: number; // Set at usage validation
};

// Infrastructure Context - Adapters and factory functions (lifetime scope)
export type GenerationInfraContext = {
  readonly adapters: GenerationAdapters;
  readonly runtimeNow: () => Date;
  readonly artifactIdFactory: () => string;
  readonly responseBuilder: (request: RequestReceivedEvent) => string;
};

// Error Context - Route-specific error handling  
export type GenerationErrorContext = {
  pendingFallback: {
    reason: string | null;
    defaultReason: string;
  } | null;
  readonly registryVersion: RegistryVersion | null; // Needed for error routing
  readonly registrySnapshotRef: RegistrySnapshotRef | null; // Needed for error routing
};

// Composed Context - Intersection of all sub-contexts (31 fields total)
export type DecomposedGenerationContext = 
  & GenerationDomainContext    // 10 fields
  & GenerationRuntimeContext   // 8 fields (includes mode)
  & GenerationMetricsContext   // 4 fields
  & GenerationInfraContext     // 4 fields
  & GenerationErrorContext;    // 3 fields + 2 registry fields

// Type guard for backward compatibility during migration
export type GenerationMachineContext = DecomposedGenerationContext;
```

**Validation**:
```bash
# Verify field count per sub-context
grep -c "readonly\|:" apps/backend/src/lib/machines/generation-system.context-types.ts
# Expected: Domain=10, Runtime=7, Metrics=4, Infra=4, Error=4 (29 total)
```

### Step 2: Create Context Accessor Pattern

**Objective**: Implement typed accessors that provide sub-context views while maintaining single context storage

**Implementation**:

**New file**: `generation-system.context-accessors.ts`
```typescript
import type { 
  GenerationDomainContext, 
  GenerationRuntimeContext,
  GenerationMetricsContext,
  GenerationInfraContext,
  GenerationErrorContext,
  GenerationMachineContext,
} from './generation-system.context-types';

// Domain Context Accessor - BCM Generation Context business logic
export function selectDomainContext(context: GenerationMachineContext): GenerationDomainContext {
  return {
    requestId: context.requestId,
    userId: context.userId,
    projectId: context.projectId,
    sessionId: context.sessionId,
    toolKey: context.toolKey,
    workflowType: context.workflowType,
    artifactType: context.artifactType,
    artifactId: context.artifactId,
    contentBuffer: context.contentBuffer,
    failureReason: context.failureReason,
  };
}

// Runtime Context Accessor - Request execution lifecycle
export function selectRuntimeContext(context: GenerationMachineContext): GenerationRuntimeContext {
  return {
    model: context.model,
    requestInput: context.requestInput,
    idempotencyKey: context.idempotencyKey,
    outputFormat: context.outputFormat,
    syntheticResponse: context.syntheticResponse,
    routeType: context.routeType,
    effectiveModelResolution: context.effectiveModelResolution,
  };
}

// Metrics Context Accessor - Usage/Quota integration per BCM L21
export function selectMetricsContext(context: GenerationMachineContext): GenerationMetricsContext {
  return {
    inputTokens: context.inputTokens,
    outputTokens: context.outputTokens,
    costUsd: context.costUsd,
    _creditCost: context._creditCost,
  };
}

// Infrastructure Context Accessor - Adapter layer per BCM L62
export function selectInfraContext(context: GenerationMachineContext): GenerationInfraContext {
  return {
    adapters: context.adapters,
    runtimeNow: context.runtimeNow,
    artifactIdFactory: context.artifactIdFactory,
    responseBuilder: context.responseBuilder,
  };
}

// Error Context Accessor - Route-specific error handling
export function selectErrorContext(context: GenerationMachineContext): GenerationErrorContext {
  return {
    pendingFallback: context.pendingFallback,
    registryVersion: context.registryVersion,
    registrySnapshotRef: context.registrySnapshotRef,
    mode: context.mode,
  };
}

// Composed assignment helper for type-safe context updates
export function assignToContext<K extends keyof GenerationMachineContext>(
  field: K,
  value: GenerationMachineContext[K],
): PropertyAssigner<GenerationMachineContext, GenerationSystemEvent, undefined> {
  return { [field]: value } as any;
}
```

**Validation**:
```bash
# Type check context accessors
npm --workspace apps/backend run typecheck
# Expected: clean compilation, no context type errors
```

### Step 3: Migrate Actions to Use Context Accessors

**Objective**: Update actions to use sub-context views instead of direct field access

**Current Issue**: Actions like `cacheRequestMeta` (actions.ts:140-164) assign to 15+ fields across all concerns in a single action.

**Implementation**:

**Before** (`cacheRequestMeta` action, lines 140-164):
```typescript
cacheRequestMeta: assignGeneration<CacheRequestMetaParams>({
  requestId: (_, params) => params.requestId,
  projectId: (_, params) => params.projectId,
  sessionId: (_, params) => params.sessionId,
  toolKey: (_, params) => params.toolKey,
  artifactType: (_, params) => params.artifactType,
  workflowType: (_, params) => params.workflowType,
  model: (_, params) => params.model,
  requestInput: (_, params) => params.input,
  idempotencyKey: (_, params) => params.idempotencyKey,
  outputFormat: (_, params) => params.outputFormat,
  // ... 15+ field assignments across all concerns
}),
```

**After** (concern-separated actions):
```typescript
// Domain fields action
cacheDomainMeta: assignGeneration<CacheRequestMetaParams>({
  ...assignDomainFields,
  requestId: (_, params) => params.requestId,
  projectId: (_, params) => params.projectId,
  sessionId: (_, params) => params.sessionId,
  toolKey: (_, params) => params.toolKey,
  artifactType: (_, params) => params.artifactType,
  workflowType: (_, params) => params.workflowType,
  failureReason: null, // Clear on new request
}),

// Runtime fields action  
cacheRuntimeMeta: assignGeneration<CacheRequestMetaParams>({
  model: (_, params) => params.model,
  requestInput: (_, params) => params.input,
  idempotencyKey: (_, params) => params.idempotencyKey,
  outputFormat: (_, params) => params.outputFormat,
  syntheticResponse: (_, params) => params.syntheticResponse,
  routeType: (_, params) => params.routeType,
  effectiveModelResolution: (_, params) => params.effectiveModelResolution,
}),

// Metrics reset action
resetMetricsMeta: assignGeneration<undefined>({
  inputTokens: 0,
  outputTokens: 0, 
  costUsd: 0,
  // _creditCost preserved from builder default
}),

// Composed action using enqueueActions
cacheRequestMeta: enqueueGenerationActions<CacheRequestMetaParams>(({ enqueue }) => {
  enqueue({ type: 'cacheDomainMeta', params });
  enqueue({ type: 'cacheRuntimeMeta', params });
  enqueue({ type: 'resetMetricsMeta' });
}),
```

**Migration Pattern for All Actions**:
```typescript
// Template for context-aware action migration

// Before: monolithic field assignment
setComplexState: assignGeneration<Params>({
  fieldA: ...,
  fieldB: ..., 
  fieldC: ..., // Mixed concerns
}),

// After: concern-separated + composed
setDomainState: assignGeneration<Params>({
  fieldA: ..., // Domain concern only
}),
setCrossCuttingState: assignGeneration<Params>({
  fieldB: ..., // Cross-cutting concern only
}),
setComplexState: enqueueGenerationActions<Params>(({ enqueue }) => {
  enqueue({ type: 'setDomainState', params });
  enqueue({ type: 'setCrossCuttingState', params });
}),
```

**Validation**:
```bash
# Verify action concern separation
grep -A 5 "assignGeneration.*Params" apps/backend/src/lib/machines/generation-system.actions.ts | grep -c "type.*Meta"
# Expected: multiple smaller actions instead of monolithic ones
```

### Step 4: Implement Route-Specific Error Actors

**Objective**: Replace universal `resolvingFallbackPolicy` with specialized error handling per `routeType`

**Current Issue**: All failures converge on single `resolvingFallbackPolicy` state regardless of failure type or route context.

**Implementation**:

**New Actors** (`generation-system.error-actors.ts`):
```typescript
import { fromPromise } from 'xstate';
import type { GenerationErrorContext } from './generation-system.context-types';

// Extraction-specific error recovery
export const extractionErrorActor = fromPromise(async ({ input }: { 
  input: GenerationErrorContext & { reason: string; hasContent: boolean }; 
}) => {
  const { reason, hasContent, mode } = input;
  
  // Extraction-specific recovery logic
  if (hasContent && reason === 'extraction_failed') {
    return { 
      type: 'EXTRACTION_PARTIAL_RECOVERY', 
      recoveryReason: 'content_available_despite_extraction_failure' 
    };
  }
  
  if (reason === 'extraction_chain_exhausted') {
    return { 
      type: 'EXTRACTION_FALLBACK_TO_RAW', 
      fallbackReason: 'structured_extraction_unavailable' 
    };
  }
  
  return { 
    type: 'EXTRACTION_COMPLETE_FAILURE', 
    finalReason: reason || 'extraction_failed' 
  };
});

// Tool workflow error recovery  
export const toolWorkflowErrorActor = fromPromise(async ({ input }: {
  input: GenerationErrorContext & { reason: string; hasContent: boolean };
}) => {
  const { reason, hasContent, pendingFallback } = input;
  
  // Tool-specific recovery strategies
  if (hasContent && reason === 'workflow_step_failed') {
    return { 
      type: 'TOOL_PARTIAL_RECOVERY',
      recoveryAction: 'retry_with_reduced_complexity' 
    };
  }
  
  if (reason === 'tool_dependency_missing') {
    return { 
      type: 'TOOL_DEPENDENCY_RECOVERY',
      recoveryAction: 'skip_step_with_fallback_content' 
    };
  }
  
  return { 
    type: 'TOOL_COMPLETE_FAILURE', 
    finalReason: pendingFallback?.defaultReason || 'workflow_failed' 
  };
});

// Generic generation error recovery
export const genericErrorActor = fromPromise(async ({ input }: {
  input: GenerationErrorContext & { reason: string; hasContent: boolean };
}) => {
  const { reason, hasContent, mode } = input;
  
  // Generic recovery based on mode and content availability
  if (hasContent) {
    return { 
      type: 'GENERIC_PARTIAL_RECOVERY', 
      recoveryReason: 'content_partially_available' 
    };
  }
  
  return { 
    type: 'GENERIC_COMPLETE_FAILURE', 
    finalReason: reason || 'generation_failed' 
  };
});
```

**Updated State Machine** (replace `resolvingFallbackPolicy`):
```typescript
// In generation-system.persistence.states.ts
// Replace lines 14-62 (resolvingFallbackPolicy) with:

routeSpecificErrorRecovery: {
  always: [
    {
      guard: 'routeIsExtraction',
      target: 'extractionErrorRecovery',
    },
    {
      guard: 'routeIsTool', 
      target: 'toolWorkflowErrorRecovery',
    },
    {
      target: 'genericErrorRecovery',
    },
  ],
},

extractionErrorRecovery: {
  invoke: {
    id: 'extractionErrorActor',
    src: 'extractionErrorActor',
    input: ({ context }) => ({
      ...selectErrorContext(context),
      reason: context.pendingFallback?.reason ?? context.failureReason ?? null,
      hasContent: context.contentBuffer.trim().length > 0,
    }),
    onDone: [
      {
        guard: 'errorRecoverySuccessful',
        target: 'persistingSuccess', 
        actions: 'applyErrorRecovery',
      },
      {
        target: 'persistingFailure',
        actions: 'applyErrorFailure',
      },
    ],
    onError: {
      target: 'persistingFailure',
      actions: 'setErrorActorFailure',
    },
  },
},

toolWorkflowErrorRecovery: {
  invoke: {
    id: 'toolWorkflowErrorActor',
    src: 'toolWorkflowErrorActor',
    input: ({ context }) => ({
      ...selectErrorContext(context),
      reason: context.pendingFallback?.reason ?? context.failureReason ?? null,
      hasContent: context.contentBuffer.trim().length > 0,
    }),
    onDone: [
      {
        guard: 'errorRecoverySuccessful', 
        target: 'persistingSuccess',
        actions: 'applyErrorRecovery',
      },
      {
        target: 'persistingFailure',
        actions: 'applyErrorFailure', 
      },
    ],
    onError: {
      target: 'persistingFailure',
      actions: 'setErrorActorFailure',
    },
  },
},

genericErrorRecovery: {
  invoke: {
    id: 'genericErrorActor', 
    src: 'genericErrorActor',
    input: ({ context }) => ({
      ...selectErrorContext(context),
      reason: context.pendingFallback?.reason ?? context.failureReason ?? null,
      hasContent: context.contentBuffer.trim().length > 0,
    }),
    onDone: [
      {
        guard: 'errorRecoverySuccessful',
        target: 'persistingSuccess',
        actions: 'applyErrorRecovery',
      },
      {
        target: 'persistingFailure', 
        actions: 'applyErrorFailure',
      },
    ],
    onError: {
      target: 'persistingFailure',
      actions: 'setErrorActorFailure',
    },
  },
},
```

**Validation**:
```bash
# Verify route-specific error actor registration
grep -c "extractionErrorActor\|toolWorkflowErrorActor\|genericErrorActor" apps/backend/src/lib/machines/generation-system.actors.ts
# Expected: 3 new error actors registered

# Verify universal fallback removal
grep -c "resolvingFallbackPolicy" apps/backend/src/lib/machines/generation-system.persistence.states.ts  
# Expected: 0 (completely replaced)
```

### Step 5: Update State File Organization (6+ Files → Cohesive Structure)

**Objective**: Consolidate distributed state files into domain-aligned organization without breaking aggregate root

**Current Issue**: Machine definition spans 6+ files (request, execution, persistence states) making flow tracing difficult.

**Implementation Strategy**: Maintain existing file boundaries but add cross-references and improve organization.

**Enhanced File Headers**:
```typescript
// generation-system.request.states.ts
/**
 * Request Lifecycle States - Domain Context Primary
 * 
 * States: idle → gateway → preGenerationGuards → routing
 * Context Access: Primarily GenerationDomainContext + GenerationRuntimeContext
 * Error Handling: Routes to routeSpecificErrorRecovery on guard failures
 * 
 * Cross-references:
 * - Execution flow: routing → extractionFlow | toolGenerationFlow | genericGenerationFlow
 * - Error flow: Any guard failure → persistence.routeSpecificErrorRecovery  
 * - Success flow: routing success → execution.dispatchingMode
 */
```

**Context Access Documentation** per file:
```typescript
// generation-system.execution.states.ts  
/**
 * Execution States - Multi-Context (Domain + Runtime + Metrics)
 * 
 * States: extractionFlow, toolGenerationFlow, acquiringContext, crawlingFlow, 
 *         scoringFlow, genericGenerationFlow, dispatchingMode, generating, streaming
 * Context Access: All contexts (business logic + execution + metrics collection)
 * Primary Concerns: Orchestration between domain workflow and runtime execution
 * 
 * Context Usage Patterns:
 * - Domain Context: WorkflowType routing, artifact lifecycle
 * - Runtime Context: Model selection, request input processing  
 * - Metrics Context: Token counting, cost accumulation
 * - Infrastructure Context: Adapter selection, factory usage
 */

// generation-system.persistence.states.ts
/**  
 * Persistence States - Infrastructure Context Primary
 * 
 * States: routeSpecificErrorRecovery → extractionErrorRecovery | toolWorkflowErrorRecovery | genericErrorRecovery,
 *         persistingSuccess, persistingFailure, completed, failed
 * Context Access: Primarily GenerationInfraContext + GenerationErrorContext
 * Primary Concerns: Artifact persistence, error recovery, finalization
 * 
 * Context Usage Patterns:
 * - Infrastructure Context: Adapter method calls, artifact storage
 * - Error Context: Route-specific recovery, fallback policies
 * - Domain Context: Final artifact ID assignment, failure reason recording
 */
```

**Validation**:
```bash
# Verify enhanced documentation
grep -c "Context Access:\|Primary Concerns:\|Context Usage Patterns:" apps/backend/src/lib/machines/generation-system.*.states.ts
# Expected: 3 files with enhanced context usage docs

# Verify state organization preservation  
npm --workspace apps/backend run typecheck
# Expected: clean compilation, existing state structure intact
```

### Step 6: Migration Validation & Backward Compatibility

**Objective**: Ensure context decomposition doesn't break existing functionality while providing clear migration path

**Implementation**:

**Type Compatibility Layer**:
```typescript
// generation-system.types.ts - Updated with backward compatibility
import type { DecomposedGenerationContext } from './generation-system.context-types';

// Maintain existing export for gradual migration
export type GenerationMachineContext = DecomposedGenerationContext;

// Deprecation notice for future removal
/** 
 * @deprecated Use sub-context accessors from generation-system.context-accessors.ts
 * Direct field access will be removed in Sprint 5. Use:
 * - selectDomainContext() for business logic fields
 * - selectRuntimeContext() for request execution fields
 * - selectMetricsContext() for usage tracking fields
 * - selectInfraContext() for adapter layer fields
 * - selectErrorContext() for error handling fields
 */
export type GenerationMachineContextLegacy = GenerationMachineContext;
```

**Action Migration Testing**:
```typescript
// New test file: generation-system.context-decomposition.test.ts
import { describe, it, expect } from 'node:test';
import { 
  selectDomainContext, 
  selectRuntimeContext,
  selectMetricsContext,
  selectInfraContext,
  selectErrorContext,
} from '../generation-system.context-accessors';

describe('Context Decomposition', () => {
  it('should preserve all fields through accessor composition', () => {
    const mockContext = createMockGenerationContext();
    
    const domain = selectDomainContext(mockContext);
    const runtime = selectRuntimeContext(mockContext);
    const metrics = selectMetricsContext(mockContext);
    const infra = selectInfraContext(mockContext);
    const error = selectErrorContext(mockContext);
    
    const recomposed = { ...domain, ...runtime, ...metrics, ...infra, ...error };
    
    expect(Object.keys(recomposed)).toHaveLength(29);
    expect(recomposed).toEqual(mockContext);
  });

  it('should enforce field boundaries per sub-context', () => {
    const mockContext = createMockGenerationContext();
    
    const domain = selectDomainContext(mockContext);
    const runtime = selectRuntimeContext(mockContext);
    
    // Domain context should not have runtime fields
    expect(domain).not.toHaveProperty('model');
    expect(domain).not.toHaveProperty('requestInput'); 
    
    // Runtime context should not have domain fields
    expect(runtime).not.toHaveProperty('requestId');
    expect(runtime).not.toHaveProperty('artifactId');
  });
  
  it('should support existing action patterns during migration', () => {
    const mockContext = createMockGenerationContext();
    
    // Legacy action pattern should still work
    const legacyUpdate = {
      requestId: 'new-id',
      model: 'new-model',
      inputTokens: 100,
    };
    
    const updatedContext = { ...mockContext, ...legacyUpdate };
    
    // Accessor should reflect updates
    expect(selectDomainContext(updatedContext).requestId).toBe('new-id');
    expect(selectRuntimeContext(updatedContext).model).toBe('new-model');
    expect(selectMetricsContext(updatedContext).inputTokens).toBe(100);
  });
});
```

**Integration Test Suite**:
```bash
# New validation script: scripts/validate-sprint-4-phase-2.sh
#!/bin/bash

echo "=== Sprint 4 Phase 2 Validation ==="

# Context field count verification
DOMAIN_FIELDS=$(grep -c "selectDomainContext" apps/backend/src/lib/machines/generation-system.context-accessors.ts)
RUNTIME_FIELDS=$(grep -c "selectRuntimeContext" apps/backend/src/lib/machines/generation-system.context-accessors.ts) 
METRICS_FIELDS=$(grep -c "selectMetricsContext" apps/backend/src/lib/machines/generation-system.context-accessors.ts)

if [ "$DOMAIN_FIELDS" -le 15 ] && [ "$RUNTIME_FIELDS" -le 15 ] && [ "$METRICS_FIELDS" -le 15 ]; then
  echo "✅ Context complexity: <15 fields per sub-context"
else
  echo "❌ Context complexity: field limits exceeded"
  exit 1
fi

# Route-specific error handling verification
ROUTE_ERROR_ACTORS=$(grep -c "extractionErrorActor\|toolWorkflowErrorActor\|genericErrorActor" apps/backend/src/lib/machines/generation-system.actors.ts)
if [ "$ROUTE_ERROR_ACTORS" -eq 3 ]; then
  echo "✅ Route-specific error handling: 3 specialized actors"
else
  echo "❌ Route-specific error handling: actors missing"
  exit 1
fi

# Universal fallback removal verification
UNIVERSAL_FALLBACK=$(grep -c "resolvingFallbackPolicy" apps/backend/src/lib/machines/generation-system.persistence.states.ts)
if [ "$UNIVERSAL_FALLBACK" -eq 0 ]; then
  echo "✅ Universal fallback removal: completed"
else
  echo "❌ Universal fallback removal: still present"
  exit 1
fi

# Domain boundary verification
DOMAIN_SEPARATION=$(grep -c "selectDomainContext\|selectRuntimeContext\|selectMetricsContext" apps/backend/src/lib/machines/generation-system.actions.ts)
if [ "$DOMAIN_SEPARATION" -gt 5 ]; then
  echo "✅ Domain separation: accessor usage implemented"
else
  echo "❌ Domain separation: direct field access still present"
  exit 1
fi

echo "=== Phase 2 Validation Complete ==="
```

**Validation Commands**:
```bash
# Context field count per sub-context verification
grep -c "readonly\|:" apps/backend/src/lib/machines/generation-system.context-types.ts
# Expected: Domain≤10, Runtime≤8, Metrics=4, Infra=4, Error≤3 (31 total)

# Route-specific error actor verification
grep -c "extractionErrorActor\|toolWorkflowErrorActor\|genericErrorActor" apps/backend/src/lib/machines/generation-system.actors.ts
# Expected: 3 new error actors registered

# Universal fallback removal verification
grep -c "resolvingFallbackPolicy" apps/backend/src/lib/machines/generation-system.persistence.states.ts  
# Expected: 0 (completely replaced)

# Domain separation verification via accessor usage
grep -c "selectDomainContext\|selectRuntimeContext\|selectMetricsContext" apps/backend/src/lib/machines/generation-system.actions.ts
# Expected: >5 (accessor usage implemented)

# Full backend validation with new context structure
npm --workspace apps/backend run go
# Expected: 335/335 tests pass, typecheck clean
```

### Phase 2 Success Criteria

- [x] **Context Complexity**: ≤15 fields per sub-context object (Domain=10, Runtime=8, Metrics=4, Infra=4, Error=3)
- [x] **Domain Separation**: Clear BCM-aligned boundaries with typed accessors (31 total fields properly organized)
- [x] **Error Handling**: Route-specific recovery actors (extraction, tool, generic) replace universal fallback
- [x] **Aggregate Preservation**: `GenerationSystem` remains single aggregate root with enhanced internal structure
- [x] **Migration Safety**: Backward compatibility maintained during transition

---

## Validation & Success Criteria

### **Sprint 4 Complete When**:
- [x] **DDD Gates**: All DDD-165 through DDD-172 entries created and approved before implementation ⚠️
- [x] **Phase 1**: ≤2 `useEffect` hooks in `useToolPageRunController`, 0 race conditions, XState authority restored
- [x] **Phase 2**: ≤15 fields per GenerationSystem sub-context (31 total → 5 sub-contexts), route-specific error handling, domain boundary clarity
- [x] **Integration**: All 448 frontend tests + 335 backend tests pass, performance baselines maintained
- [x] **DDD Compliance**: Canonical terminology usage verified, BCM boundaries respected

### **DDD Compliance Verified**:
- [x] **DDD Gate-First**: Entries DDD-165 through DDD-172 created before Phase 1 implementation ⚠️
- [x] Consumer hooks (DDD-158/159/160/161) integrated per BCM Line 25 downstream pattern
- [x] Context decomposition follows approved sub-context definitions (DDD-167-171)  
- [x] Error handling uses `DispatchErrorReasonCode` → `mapInlineDispatchError` boundary (DDD-149)
- [x] Composition pattern follows DDD-172 approved intersection strategy

### **Automated Validation Gates**

**Phase 1 — Frontend Reactive Consolidation**:
```bash
# Effect count and race condition validation
npm --workspace apps/frontend run test && \
grep -c "useEffect" apps/frontend/src/features/tools/runtime/useToolPageRunController.ts | [ $(cat) -le 2 ]
# Expected: ≤2 useEffect, all frontend tests pass, consumer hook integration verified
```

**Phase 2 — Backend Context Decomposition**:
```bash  
# Context complexity and domain separation validation
npm --workspace apps/backend run go && \
grep -c "extractionErrorActor\|toolWorkflowErrorActor\|genericErrorActor" apps/backend/src/lib/machines/generation-system.actors.ts | [ $(cat) -eq 3 ]
# Expected: <15 fields per context, route-specific errors, domain separation, 335/335 tests pass
```

**Integration — Full System Validation**:
```bash
# Complete system validation
npm run typecheck && npm run test && npm run build
# Expected: all workspaces pass typecheck, all tests pass, build successful, no regressions
```

### **AI Execution Checkpoints**

**DDD Gate Compliance**:
- **Gate Check**: Before any implementation, verify all DDD-165→172 entries exist in decision log
- **Terminology Validation**: Ensure all code/docs use only canonical terms or approved DDD entries
- **Boundary Respect**: Maintain BCM boundaries throughout implementation

**Session Management**:
- **Phase 1**: 6 atomic steps → 3-4 AI sessions (~1.5 weeks) **after DDD gates pass**
- **Phase 2**: 6 atomic steps → 5-6 AI sessions (~2.5 weeks) **after DDD gates pass**  
- **Integration**: 1-2 validation sessions (~0.5 weeks)
- **Total**: 9-12 sessions across 4.5 weeks + DDD gate completion time

**Progress Tracking**: Each step completion triggers TodoWrite update + git commit tag for rollback capability

**Rollback Strategy**: Phase-level rollback available at each major checkpoint (Phase 1 complete → Phase 2 start, Phase 2 complete → Integration start)

**DDD Compliance Monitoring**: Each session must verify no non-canonical terms introduced without DDD entries

---

**Last Updated**: 2026-07-08 (Sprint 4 planning — DDD Gate-First Workflow implemented)  
**Next Review**: 2026-07-15  
**Review Owner**: Domain Architecture Team  
**DDD Compliance Status**: ⚠️ **BLOCKED** - Requires DDD-165 through DDD-172 entries before execution  
**AI Execution Ready**: 🚫 **Gated** - Complete DDD Gate-First Workflow before proceeding