# Plan: Add Non-Streaming Generation Mode (Coexistence)

**Date**: 2026-06-04
**Status**: Completed — Phase 1, 2, 3 executed
**Target**: Add non-streaming generation as default for tools; streaming stays dormant for future chat

---

## 1. Purpose

Add a non-streaming generation path that coexists with the existing streaming infrastructure. All frontend tools default to the new non-streaming mode. The streaming path (`/generation/stream`, `stream-transport.machine`, `persistence-batch.machine`, SSE parser) remains intact and unmodified for future chat/typing-effect features.

### Design Principles
1. **Addition, not replacement**: streaming infra stays dormant, zero deletions
2. **Coexistence**: two modes, one unified `generation-system.machine.ts`
3. **Default non-streaming**: all FE tools use the new path
4. **Unified architecture**: shared idempotency, usage, ownership, persistence contracts
5. **Zero FE regressions**: tool generation UX remains loading → result (identical to current behavior)

---

## 2. Architecture: Coexistence

```
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│     FRONTEND (Tools — default)   │     │   FRONTEND (Future Chat)         │
│                                  │     │                                  │
│  runGeneration()                 │     │  streamGeneration()              │
│  POST /generation/run            │     │  POST /generation/stream         │
│  ↓ JSON response                 │     │  ↓ SSE frames                    │
│  { artifactId, content,          │     │  start / chunk / terminal        │
│    status, metrics }             │     │                                  │
└──────────────────────────────────┘     └──────────────────────────────────┘
                │                                         │
                └──────────────────┬──────────────────────┘
                                   ▼
              ┌────────────────────────────────────────────────┐
              │                  BACKEND                        │
              │                                                 │
              │  generation-system.machine.ts (unified)         │
              │                                                 │
              │  Pre-processing states (shared):                │
              │    extractionFlow / toolGenerationFlow /        │
              │    acquiringContext / genericGenerationFlow      │
              │              ↓                                  │
              │        dispatchingMode  ←── context.mode        │
              │         /           \                           │
              │   generating       streaming                    │
              │   (default)        (dormant)                    │
              │                                                 │
              │  generateText        streamText                 │
              │  stream:false        stream:true                │
              │        ↓                   ↓                   │
              │  persistingSuccessSync  persistingSuccess       │
              │  (1 write)              (N/10+1 writes)         │
              │        \                   /                    │
              │    finalizeIdempotencySuccess/Failure           │
              │           (shared terminal)                     │
              └────────────────────────────────────────────────┘
```

### Mode Discriminator

`GenerationMachineContext.mode: 'generate' | 'stream'` (new field in `generation-system.types.ts`).

- Set at session creation via `GenerationSystemInput.initialContext: { mode: 'generate' }` for the non-streaming endpoint.
- Defaults to `'stream'` when omitted (preserves existing SSE behavior exactly).
- The `dispatchingMode` gateway state reads `context.mode` via an `always` guard.

### Unification Points

| Concern | Shared? | Notes |
|---------|---------|-------|
| Idempotency (`checkAndClaim`, `markCompleted`, `markFailed`) | ✅ | Same machine, same logic |
| Usage (`claimUsage`, `quota_history`) | ✅ | Same adapter, same flow |
| Ownership validation | ✅ | Same guard |
| Contract validation | ✅ | Same `GenerationRequest` schema |
| `finalizeSuccess` / `finalizeFailure` adapter calls | ✅ | Same `PersistenceAdapter` methods |
| `finalizeIdempotencySuccess` / `finalizeIdempotencyFailure` states | ✅ | Shared terminal states, both paths converge here |
| Content accumulation | ❌ | Non-stream: single result; Stream: chunk-by-chunk |
| Persistence state | ❌ | Non-stream: `persistingSuccessSync` (1 write); Stream: `persistingSuccess` (N/10+1) |
| LLM actor | ❌ | Non-stream: `invokeGeneration` (`generationActor`); Stream: `invokeStream` (`streamTransportMachine`) |
| Persistence actor | ❌ | Non-stream: `invokeSimplePersistence` (`simpleFinalizationActor`); Stream: `invokePersistence` (`persistenceBatchMachine`) |

---

## 3. DDD Governance Prerequisite

**This must be completed before any code changes in Phases 1–3.**

Allocate **DDD-107** in `docs/07-governance/domain-naming-decision-log.md`:

| ID | Date | Canonical Term | Decision | Rationale | Scope |
|----|------|---------------|----------|-----------|-------|
| DDD-107 | 2026-06-04 | GenerationMode / GenerationRunResponse | `GenerationMode` (`'generate' \| 'stream'`) is the internal discriminator on `GenerationMachineContext` that selects the LLM execution and persistence path within `GenerationSystem`. It is an **internal implementation type** (per DDD-022 pattern) — not a bounded-context domain term. `GenerationRunResponse` is the cross-context contract type for the non-streaming HTTP response body; canonical definition is in `packages/contracts/src/index.ts`, imported by the Frontend via the contracts package. | Prevents future misinterpretation of `mode` as a domain concept and grounds `GenerationRunResponse` in the authoritative contracts boundary (DDD-023). | Generation (internal), contracts (cross-context) |

---

## 4. Implementation Plan

### Phase 1: Backend — Adapter + Actor + Endpoint

#### Step 1.1: Add `LlmGenerateAdapter` interface and `GenerationMode` type

**File**: `apps/backend/src/lib/adapters/generation.adapters.ts`

```typescript
export type LlmGenerateInput = {
  requestId: string;
  model: string;
  outputFormat: { systemPrompt: string; userPrompt: string; formatInstructions?: string };
  requestInput: Record<string, unknown>;
  signal?: AbortSignal;
};

export type LlmGenerateResult = {
  content: string;
  usage?: LlmUsageMetrics;
};

export interface LlmGenerateAdapter {
  generateText(input: LlmGenerateInput): Promise<LlmGenerateResult>;
}
```

Add `generate: LlmGenerateAdapter` to the `GenerationAdapters` interface.

#### Step 1.2: Update `GenerationMachineContext` with `mode` field

**File**: `apps/backend/src/lib/machines/generation-system.types.ts`

Add `mode: 'generate' | 'stream'` to `GenerationMachineContext` (after `routeType`):

```typescript
export type GenerationMachineContext = GenerationSystemContext & {
  // ... existing fields ...
  routeType: RouteType;
  mode: 'generate' | 'stream';   // NEW — internal discriminator (DDD-107)
  // ... remaining fields ...
};
```

#### Step 1.3: Implement `generateText` in OpenRouter adapter

**File**: `apps/backend/src/lib/adapters/openrouter.adapter.ts`

Add `LlmGenerateAdapter` implementation alongside the existing `LlmStreamAdapter`:
- Same request body as `streamText` but with `stream: false`
- Parse `response.choices[0].message.content` as the full result
- Extract usage from `response.usage`
- Reuse existing `buildMessages`, `normalizeOpenRouterModelId`, `toUsageMetrics`
- Export `createOpenRouterLlmGenerateAdapter` factory (mirrors `createOpenRouterLlmStreamAdapter`)

#### Step 1.4: Add synthetic generate adapter for testing

**File**: `apps/backend/src/lib/adapters/generation.adapters.ts`

Add `createSyntheticLlmGenerateAdapter()` (mirrors `createSyntheticLlmStreamAdapter`), reusing `buildSyntheticResponse`. Update `createInMemoryGenerationAdapters` to include `generate: createSyntheticLlmGenerateAdapter()`.

#### Step 1.5: Update `postgres-redis.interfaces.ts`

**File**: `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`

Add `generate: LlmGenerateAdapter` to `PostgresRedisAdapterDependencies`:

```typescript
export interface PostgresRedisAdapterDependencies {
  ownership: ProjectOwnershipRepository;
  quota: RedisQuotaRepository;
  idempotency: RedisIdempotencyRepository;
  stream: RedisStreamSessionRepository;
  llm: LlmStreamAdapter;
  generate: LlmGenerateAdapter;   // NEW
  persistence: PostgresArtifactRepository;
  orchestrateCache: OrchestrateArtifactCache | null;
}
```

#### Step 1.6: Wire `generate` adapter in production

**File**: `apps/backend/src/lib/adapters/postgres-redis.adapters.ts`

Add `generate: { generateText: (input) => dependencies.generate.generateText(input) }` to the adapter composition alongside existing `llm` (stream). Pattern mirrors the existing `llm` wiring.

#### Step 1.7: Add `GenerationRunResponse` to contracts package

**File**: `packages/contracts/src/index.ts`

Add the cross-context response type (authoritative definition per DDD-023 and DDD-107):

```typescript
export type GenerationRunResponse = {
  artifactId: string;
  content: string;
  status: 'completed' | 'failed';
  reason?: string;
  metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
};
```

#### Step 1.8: Create `generation-actor.ts`

**File**: `apps/backend/src/lib/machines/generation-actor.ts` (NEW)

Simple `fromPromise` actor (`generationActor`):
1. Receives `{ context: GenerationMachineContext }` as input
2. Calls `context.adapters.generate.generateText(...)` with fields from context
3. Returns `{ content, usage }` on success; throws on failure
4. No chunk tracking, no session, no heartbeat

Output type mirrors `StreamDoneOutput` shape for consistent guard reuse:

```typescript
export type GenerateDoneOutput =
  | { type: 'GENERATE_TERMINATED_SUCCESS'; content: string; metrics?: LlmUsageMetrics }
  | { type: 'GENERATE_TERMINATED_FAILURE'; reason: string };
```

#### Step 1.9: Create `persistence-actor.ts`

**File**: `apps/backend/src/lib/machines/persistence-actor.ts` (NEW)

Simple `fromPromise` actor (`simpleFinalizationActor`):
1. Receives `{ input: PersistenceBatchInput; mode: 'success' | 'failure'; reason?: string; adapters: { persistence: PersistenceAdapter } }` as input
2. Calls `adapters.persistence.finalizeSuccess(input)` or `finalizeFailure(input, reason)`
3. No `flushProgress`, no batching, no retry loop
4. Single write: artifact upsert + quota_history insert (same underlying adapter as streaming path — only the calling pattern differs)

Reuses the existing `PersistenceBatchInput` type and `buildPersistenceBatchInput` helper.

#### Step 1.10: Add `invokeGeneration` and `invokeSimplePersistence` actors

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

Add to `generationSystemActors`:

```typescript
invokeGeneration: generationActor,         // from generation-actor.ts
invokeSimplePersistence: simpleFinalizationActor,  // from persistence-actor.ts
```

Add both to the `GenerationSystemProvidedActor` union type.

The existing `invokeStream: streamTransportMachine` and `invokePersistence: persistenceBatchMachine` remain **unchanged**.

#### Step 1.11: Add `dispatchingMode` gateway and `generating` state to execution states

**File**: `apps/backend/src/lib/machines/generation-system.execution.states.ts`

**Two changes**:

**Change A — Replace all `target: 'streaming'` with `target: 'dispatchingMode'`** in the following transitions (all are in the existing states that precede the LLM call):
- `extractionFlow.invoke.onDone[0]` (guard `extractionOutputIsAccepted`)
- `toolGenerationFlow.always[1]` (guard `resolveWorkflowRunMode === 'new'`)
- `toolGenerationFlow.invoke.onDone[0]` (guard `toolOutputIsCompleted`)
- `toolGenerationFlow.invoke.onDone[1]` (fallthrough)
- `acquiringContext.invoke.onDone[0]` (guard `acquisitionOutputIsAccepted`)
- `acquiringContext.invoke.onDone[1]` (fallthrough)
- `genericGenerationFlow.always`

The `streaming` state itself is **not modified**.

**Change B — Add two new states**:

```typescript
dispatchingMode: {
  always: [
    {
      guard: ({ context }: ContextArgs) => context.mode === 'generate',
      target: 'generating',
    },
    { target: 'streaming' },
  ],
},
generating: {
  entry: ['ensureArtifactId'],
  invoke: {
    id: 'generationActor',
    src: 'invokeGeneration',
    input: ({ context }: ContextArgs) => ({ context }),
    onDone: [
      {
        guard: 'generateOutputIsFailure',
        target: 'resolvingFallbackPolicy',
        actions: [
          {
            type: 'cacheGenerateResult',
            params: ({ event }: UnknownEventArgs) => getGenerateResultParams(event),
          },
          {
            type: 'queueFallbackDecision',
            params: ({ event }: UnknownEventArgs) => ({
              reason: getInvokeFailureReason(event),
              defaultReason: 'generate_failure',
            }),
          },
        ],
      },
      {
        target: 'persistingSuccessSync',
        actions: {
          type: 'cacheGenerateResult',
          params: ({ event }: UnknownEventArgs) => getGenerateResultParams(event),
        },
      },
    ],
    onError: {
      target: 'resolvingFallbackPolicy',
      actions: {
        type: 'queueFallbackDecision',
        params: { defaultReason: 'generate_failure' },
      },
    },
  },
},
```

The guard `generateOutputIsFailure` and action `cacheGenerateResult` follow the same pattern as the existing `streamOutputIsFailure` guard and `cacheStreamResult` action. Add them to `generation-system.guards.ts` and `generation-system.actions.ts` respectively.

#### Step 1.12: Add `persistingSuccessSync` / `persistingFailureSync` to persistence states

**File**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`

Add two new states for the non-streaming path. The **existing** `persistingSuccess` (batch, streaming) and `persistingFailure` (batch, streaming) states are **unchanged**. Both new states converge on the already-existing shared `finalizeIdempotencySuccess` / `finalizeIdempotencyFailure` states:

```typescript
persistingSuccessSync: {
  entry: 'drivePersistenceFinalizeSuccess',
  invoke: {
    id: 'simplePersistenceActor',
    src: 'invokeSimplePersistence',
    input: ({ context }: ContextArgs) => {
      const artifactId = context.artifactId ?? context.artifactIdFactory();
      return {
        input: buildPersistenceBatchInput(context, artifactId),
        mode: 'success' as const,
        adapters: { persistence: context.adapters.persistence },
      };
    },
    onDone: 'finalizeIdempotencySuccess',
    onError: {
      target: 'resolvingFallbackPolicy',
      actions: {
        type: 'queueFallbackDecision',
        params: { defaultReason: 'persistence_finalize_failed' },
      },
    },
  },
},
persistingFailureSync: {
  entry: 'drivePersistenceFinalizeFailure',
  invoke: {
    id: 'simplePersistenceActor',
    src: 'invokeSimplePersistence',
    input: ({ context }: ContextArgs) => {
      const artifactId = context.artifactId ?? context.artifactIdFactory();
      return {
        input: buildPersistenceBatchInput(context, artifactId),
        mode: 'failure' as const,
        reason: context.failureReason ?? 'generation_failed',
        adapters: { persistence: context.adapters.persistence },
      };
    },
    onDone: 'finalizeIdempotencyFailure',
    onError: 'finalizeIdempotencyFailure',
  },
},
```

Note: the `generating` state transitions to `persistingSuccessSync` on success and to `resolvingFallbackPolicy` on failure (which then transitions to `persistingFailureSync` via `applyFallbackDecision`). The `resolvingFallbackPolicy` state's `onDone` already targets `persistingFailure`; update it to use `context.mode` to route to `persistingFailureSync` or `persistingFailure` as appropriate, following the same guard pattern as `dispatchingMode`.

#### Step 1.13: Initialize `mode` field in machine context

**File**: `apps/backend/src/lib/machines/generation-system.machine.ts`

In `buildInitialContext` (or equivalent initial context factory), set `mode: 'stream'` as the default. When `GenerationSystemInput.initialContext` contains `mode: 'generate'`, it overrides the default via the existing `initialContext` merge pattern.

#### Step 1.14: Add `/generation/run` endpoint

**File**: `apps/backend/src/lib/runtime/node-server.ts`

Add route for `POST /generation/run` → `handleGenerationRequestAsJson()`. Mirror the existing `/generation/stream` route registration pattern.

**File**: `apps/backend/src/lib/runtime/index.ts`

```typescript
export const handleGenerationRequestAsJson = async (
  req: IncomingMessage,
  res: ServerResponse,
  runtimeOptions: AuthHttpRuntimeOptions,
): Promise<void>;
```

- Apply the same guards as the SSE endpoint: ownership, model availability, contract validation (reuse `generation-entry-guards.ts`)
- Call `runBackendGenerationSessionAsJson(request, adapters)` (Step 1.15)
- Return JSON: `{ ok: true, data: GenerationRunResponse }` on success or `{ ok: false, error: BackendError }` on failure

#### Step 1.15: Add `runBackendGenerationSessionAsJson()`

**File**: `apps/backend/src/lib/runtime/backend-session.ts`

Simplified session that:
1. Creates generation system actor with `initialContext: { mode: 'generate' }` passed in `GenerationSystemInput`
2. Sends `REQUEST_RECEIVED`, `AUTH_OK`, `VALIDATION_OK` (same as `runBackendGenerationSession`)
3. Uses `waitFor` to await `completed` or `failed` terminal state
4. Returns `GenerationRunResponse` (imported from `packages/contracts`) — no SSE emission, no stream observer

The existing `runBackendGenerationSession()` for SSE remains **unchanged**.

---

### Phase 2: Frontend — Client + Machine + Default

#### Step 2.1: Add `runGeneration` to generation client

**File**: `apps/frontend/src/features/generation/runtime/generation-client.ts`

Import `GenerationRunResponse` from `@gen-app-2/contracts` (authoritative definition per DDD-107):

```typescript
import type { GenerationRunResponse } from '@gen-app-2/contracts';

export const runGeneration = async (
  request: GenerationRequest,
  options: { apiBaseUrl?: string; signal?: AbortSignal },
): Promise<GenerationRunResponse>;
```

The existing `streamGeneration()` remains **unchanged**.

#### Step 2.2: Create `frontend-generation.machine.ts`

**File**: `apps/frontend/src/features/generation/machines/frontend-generation.machine.ts` (NEW)

Simplified XState machine:
- States: `idle` → `running` → `completed` | `failed`
- No reconnection, no chunk accumulation, no sequence tracking
- Preserves existing `checkpoints` and `extractionByProject` context fields for downstream compatibility with `GenerationWorkspaceProvider`

#### Step 2.3: Wire non-streaming as default in tools

**File**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`

Update the generation dispatch to use `runGeneration` + `frontendGenerationMachine` by default.

The existing `streamGeneration` + `frontendStreamMachine` path remains available (not deleted).

#### Step 2.4: Update `GenerationWorkspaceProvider.tsx`

**File**: `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`

Support both machines:
- `frontendGenerationMachine` for non-streaming (default for tools)
- `frontendStreamMachine` for streaming (future chat)

Map both to the same status interface so downstream components are agnostic. The four existing split context providers (`GenerationStreamWorkspaceContext`, `GenerationArtifactsWorkspaceContext`, `GenerationProjectWorkspaceContext`, `GenerationWorkspaceContext`) must remain structurally compatible.

---

### Phase 3: Tests

#### Step 3.1: Backend tests

- Test `generateText` on OpenRouter adapter (mocked fetch, `stream: false` body)
- Test `generation-actor` (`generationActor`) success and failure output shapes
- Test `persistence-actor` (`simpleFinalizationActor`) calls `finalizeSuccess`/`finalizeFailure` without `flushProgress`
- Test `dispatchingMode` routes to `generating` when `context.mode === 'generate'`
- Test `dispatchingMode` routes to `streaming` when `context.mode === 'stream'`
- Test `persistingSuccessSync` → `finalizeIdempotencySuccess` → `completed`
- Test `persistingFailureSync` → `finalizeIdempotencyFailure` → `failed`
- Test `/generation/run` endpoint end-to-end (request → JSON response)
- **Verify all existing streaming tests pass unchanged** — the streaming path (`dispatchingMode` default → `streaming` → `persistingSuccess` → batch) must behave identically to pre-migration

#### Step 3.2: Frontend tests

- Test `runGeneration` client with mocked fetch returning `GenerationRunResponse`
- Test `frontend-generation.machine` state transitions: `idle` → `running` → `completed` / `failed`
- Test tools dispatch uses non-streaming path by default

#### Step 3.3: Smoke tests

- Verify single DB INSERT per generation in non-streaming path (no `flushProgress` calls)
- Verify `quota_history` recorded correctly for non-streaming path
- Verify idempotency (`claimed` / `replay` / `conflict`) works with new path

---

## 5. File Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `apps/backend/src/lib/machines/generation-actor.ts` | `generationActor` — `fromPromise` for non-streaming LLM call |
| `apps/backend/src/lib/machines/persistence-actor.ts` | `simpleFinalizationActor` — single finalize, no batching |
| `apps/frontend/src/features/generation/machines/frontend-generation.machine.ts` | Simplified FE machine for non-streaming |

### Modified Files (~16)
| File | Changes |
|------|---------|
| `docs/07-governance/domain-naming-decision-log.md` | Add DDD-107 (**prerequisite — before code**) |
| `packages/contracts/src/index.ts` | Add `GenerationRunResponse` (authoritative cross-context type) |
| `apps/backend/src/lib/adapters/generation.adapters.ts` | Add `LlmGenerateInput`, `LlmGenerateResult`, `LlmGenerateAdapter`, `generate` field on `GenerationAdapters`, `createSyntheticLlmGenerateAdapter`, update `createInMemoryGenerationAdapters` |
| `apps/backend/src/lib/adapters/openrouter.adapter.ts` | Add `generateText` method + `createOpenRouterLlmGenerateAdapter` factory |
| `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts` | Add `generate: LlmGenerateAdapter` to `PostgresRedisAdapterDependencies` |
| `apps/backend/src/lib/adapters/postgres-redis.adapters.ts` | Wire `generate` adapter in composition |
| `apps/backend/src/lib/machines/generation-system.types.ts` | Add `mode: 'generate' \| 'stream'` to `GenerationMachineContext` |
| `apps/backend/src/lib/machines/generation-system.machine.ts` | Initialize `mode: 'stream'` default in `buildInitialContext` |
| `apps/backend/src/lib/machines/generation-system.execution.states.ts` | Add `dispatchingMode` gateway + `generating` state; replace all `target: 'streaming'` in pre-LLM states with `target: 'dispatchingMode'` |
| `apps/backend/src/lib/machines/generation-system.guards.ts` | Add `generateOutputIsFailure` guard |
| `apps/backend/src/lib/machines/generation-system.actions.ts` | Add `cacheGenerateResult` action |
| `apps/backend/src/lib/machines/generation-system.actors.ts` | Add `invokeGeneration` and `invokeSimplePersistence` actors + union type entries |
| `apps/backend/src/lib/machines/generation-system.persistence.states.ts` | Add `persistingSuccessSync` / `persistingFailureSync`; update `resolvingFallbackPolicy` `onDone` to route to `persistingFailureSync` or `persistingFailure` based on `context.mode` |
| `apps/backend/src/lib/runtime/node-server.ts` | Add `POST /generation/run` route |
| `apps/backend/src/lib/runtime/index.ts` | Add `handleGenerationRequestAsJson` |
| `apps/backend/src/lib/runtime/backend-session.ts` | Add `runBackendGenerationSessionAsJson` |
| `apps/frontend/src/features/generation/runtime/generation-client.ts` | Add `runGeneration` (imports `GenerationRunResponse` from contracts) |
| `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` | Default to non-streaming dispatch |
| `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` | Support both machines with shared status interface |

### Untouched Files (streaming stays intact)
- `apps/backend/src/lib/machines/stream-transport.machine.ts`
- `apps/backend/src/lib/machines/persistence-batch.machine.ts`
- `apps/backend/src/lib/machines/generation-system.persistence.states.ts` — existing `persistingSuccess` / `persistingFailure` states (batch) **not modified**
- `apps/backend/src/lib/runtime/generation-stream-replay.ts`
- `apps/backend/src/lib/runtime/http-sse.ts`
- `apps/frontend/src/features/generation/machines/frontend-stream.machine.ts`
- `apps/frontend/src/features/generation/parser/sse-parser.ts`

---

## 6. State Machine Flow — Non-Streaming Path

```
idle
  → [REQUEST_RECEIVED / AUTH_OK / VALIDATION_OK]
checkingIdempotency
  → [claimed] → checkingUsage
  → [replay]  → completed (idempotency short-circuit)
checkingUsage
  → [granted] → checkingOwnership
checkingOwnership
  → [ok] → routeType-dependent pre-processing state
             (extractionFlow / toolGenerationFlow / genericGenerationFlow)
  → all pre-processing states → dispatchingMode
dispatchingMode
  → [context.mode === 'generate'] → generating
  → [else]                        → streaming  (existing path, unchanged)
generating
  → [success] → persistingSuccessSync
  → [failure] → resolvingFallbackPolicy
persistingSuccessSync   (invokeSimplePersistence — 1 DB write)
  → finalizeIdempotencySuccess → completed
resolvingFallbackPolicy
  → persistingFailureSync  (when context.mode === 'generate')
  → persistingFailure      (when context.mode === 'stream')
persistingFailureSync   (invokeSimplePersistence — 1 DB write)
  → finalizeIdempotencyFailure → failed
```

---

## 7. Impact

| Metric | Streaming (dormant) | Non-Streaming (default) |
|--------|---------------------|------------------------|
| DB writes per generation | N/10 + 1 (10-50+) | **1** |
| FlushProgress | ✅ every 10 chunks | ❌ absent |
| Chat-ready | ✅ | — |
| UX tool | loading → result | loading → result (identical) |

---

## 8. DDD Governance

- **DDD-107 is a mandatory prerequisite** — update decision log before Phase 1 code begins
- `GenerationMode` (`'generate' | 'stream'`) is an internal implementation type (DDD-022 pattern) — not a domain term, not in the glossary
- `GenerationRunResponse` is a cross-context contract type in `packages/contracts/src/index.ts` (DDD-023 authority)
- `BackendStreamEvent` (DDD-009) remains valid and unchanged for the streaming path
- No domain concept renamed or removed — purely additive technical change

---

## 9. Completion Summary

### Executed Changes
- **Phase 1**: All 16 backend steps completed. Added `LlmGenerateAdapter`, `generationActor`, `simpleFinalizationActor`, `dispatchingMode` gateway, `generating` state, `persistingSuccessSync`/`persistingFailureSync` states, `/generation/run` endpoint, and `runBackendGenerationSessionAsJson`.
- **Phase 2**: All 4 frontend steps completed. Added `runGeneration` client, `frontendGenerationMachine`, updated `GenerationWorkspaceProvider` to support both machines, and wired `useToolPageRunController` to default to non-streaming path.
- **Phase 3**: Tests added and passing:
  - Backend: 7 new tests in `generation-nonstreaming.test.ts` covering happy path, empty-content failure, dispatchingMode routing (both modes), persistingSuccessSync (no flushProgress), and persistingFailureSync (single finalizeFailure).
  - Frontend: 6 new tests in `frontend-generation.machine.test.ts` covering idle→running→completed/failed transitions, reset, and checkpoint handling. 3 new tests in `generation-client.test.ts` covering success, error, and abort scenarios.

### Key Fixes During Execution
1. `cacheRequestMeta` action hardcoded `mode: 'stream'`, overriding `initialContext.mode`. Fixed to preserve `context.mode`.
2. `persistingSuccessSync`/`persistingFailureSync` had `entry` actions (`drivePersistenceFinalizeSuccess`/`drivePersistenceFinalizeFailure`) that sent events to `'persistenceActor'`, but the sync states use `'simplePersistenceActor'` (a `fromPromise` actor that cannot receive events). Removed the incompatible `entry` actions.
3. `frontend-generation.machine.ts` `cacheSuccessResult` action incorrectly checked `event.type === 'GENERATION_SUCCESS'` instead of accessing `event.output` from the `done.invoke` event emitted by XState v5's `fromPromise`.

### Validation Results
- `npm run typecheck`: Passes all workspaces
- `npm run test`: Backend 265/265 pass, Frontend 400/400 pass
- `npm run build`: Frontend production build succeeds
- `npm run test:smoke`: All 4 smoke suites pass:
  - `smoke:idempotency` — claimed → completed → replay
  - `smoke:conflict` — lock present → conflict; parallel usage → one grant, one exhausted
  - `smoke:queries` — query repositories scoped and filtered correctly
  - `smoke:nonstreaming` (NEW) — single DB write, quota_history recorded, idempotency replay verified

### Notes
- Smoke tests executed against live Postgres + Redis with `.env.local` credentials.
- Non-streaming smoke test verified: single artifact INSERT, `quota_history` success record, zero `flushProgress` calls, idempotency replay returns cached artifact.
- All existing streaming tests continue to pass unchanged, confirming zero regression on the dormant streaming path.
