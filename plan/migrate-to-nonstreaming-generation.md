# Plan: Add Non-Streaming Generation Mode (Coexistence)

**Date**: 2026-06-04
**Status**: Draft
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
              │    ┌──────────────┬───────────────┐            │
              │    │  generating  │   streaming   │            │
              │    │  (default)   │   (dormant)   │            │
              │    │              │               │            │
              │    │ generateText │  streamText   │            │
              │    │ stream:false │  stream:true  │            │
              │    │              │               │            │
              │    │ persist-     │  persist-     │            │
              │    │ enceActor    │  batchMachine │            │
              │    │ (1 write)    │  (N/10+1)     │            │
              │    └──────┬───────┴───────┬───────┘            │
              │           │               │                    │
              │    ┌──────┴───────────────┴───────┐            │
              │    │   Shared: idempotency, usage, │            │
              │    │   ownership, finalizeSuccess  │            │
              │    └───────────────────────────────┘            │
              └────────────────────────────────────────────────┘
```

### Unification Points

| Concern | Shared? | Notes |
|---------|---------|-------|
| Idempotency (`checkAndClaim`, `markCompleted`, `markFailed`) | ✅ | Same machine, same logic |
| Usage (`claimUsage`, `quota_history`) | ✅ | Same adapter, same flow |
| Ownership validation | ✅ | Same guard |
| Contract validation | ✅ | Same `GenerationRequest` schema |
| `finalizeSuccess` / `finalizeFailure` | ✅ | Same persistence adapter method |
| Content accumulation | ❌ | Non-stream: single result; Stream: chunk-by-chunk |
| Persistence strategy | ❌ | Non-stream: `persistenceActor` (1 write); Stream: `persistenceBatchMachine` (N/10+1) |

---

## 3. Implementation Plan

### Phase 1: Backend — Adapter + Actor + Endpoint

#### Step 1.1: Add `LlmGenerateAdapter` interface

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

Add `generate: LlmGenerateAdapter` to `GenerationAdapters`.

#### Step 1.2: Implement `generateText` in OpenRouter adapter

**File**: `apps/backend/src/lib/adapters/openrouter.adapter.ts`

- Same request body as `streamText` but `stream: false`
- Parse `response.choices[0].message.content`
- Extract usage from `response.usage`
- Reuse `buildMessages`, `normalizeOpenRouterModelId`, `toUsageMetrics`

#### Step 1.3: Add synthetic generate adapter for testing

**File**: `apps/backend/src/lib/adapters/generation.adapters.ts`

Update `createInMemoryGenerationAdapters` to include a `generate` adapter that returns content immediately.

#### Step 1.4: Wire `generate` adapter in production

**File**: `apps/backend/src/lib/adapters/postgres-redis.adapters.ts`

Add `generate` to the adapter composition alongside existing `llm` (stream).

#### Step 1.5: Create `generation-actor.ts`

**File**: `apps/backend/src/lib/machines/generation-actor.ts` (NEW)

Simple `fromPromise` actor:
1. Calls `adapters.generate.generateText(input)`
2. Returns `{ content, usage }` on success or throws on failure
3. No chunk tracking, no session, no heartbeat

#### Step 1.6: Create `persistence-actor.ts`

**File**: `apps/backend/src/lib/machines/persistence-actor.ts` (NEW)

Simple `fromPromise` actor:
1. Calls `adapters.persistence.finalizeSuccess(content, metadata)` or `finalizeFailure(reason, content)`
2. No `flushProgress`, no batching, no retry
3. Single transaction: artifact upsert + quota_history insert

#### Step 1.7: Add non-streaming path to `generation-system.machine.ts`

**File**: `apps/backend/src/lib/machines/generation-system.execution.states.ts`

Add a new `generating` state alongside existing `streaming`:

```typescript
generating: {
  invoke: {
    src: 'invokeGeneration',
    input: ({ context }) => buildGenerateInput(context),
    onDone: { target: 'persistingSuccess', actions: assign({ contentBuffer: ... }) },
    onError: { target: 'persistingFailure', actions: assign({ failureReason: ... }) },
  },
},
```

The `streaming` state remains **unchanged**. The machine chooses the path based on `context.mode` (`'generate'` | `'stream'`).

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

Add `invokeGeneration: generationActor` alongside existing `invokeStream: streamTransportMachine`.

**File**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`

Add `persistingSuccess` / `persistingFailure` states that use `persistenceActor`. The existing `persisting` state using `persistenceBatchMachine` remains for the streaming path.

#### Step 1.8: Add `/generation/run` endpoint

**File**: `apps/backend/src/lib/runtime/node-server.ts`

Add route for `/generation/run` → `handleGenerationRequestAsJson()`.

**File**: `apps/backend/src/lib/runtime/index.ts`

```typescript
export const handleGenerationRequestAsJson = async (
  req: IncomingMessage,
  res: ServerResponse,
  runtimeOptions: AuthHttpRuntimeOptions,
): Promise<void>;
```

- Same guards as SSE endpoint (ownership, model availability, contract validation)
- Sets `context.mode = 'generate'` on the generation system
- Returns JSON: `{ ok: true, data: { artifactId, content, status, metrics } }` or `{ ok: false, error }`

#### Step 1.9: Add `runBackendGenerationSessionAsJson()`

**File**: `apps/backend/src/lib/runtime/backend-session.ts`

Simplified session that:
1. Creates generation system actor with `mode: 'generate'`
2. Waits for terminal state
3. Returns JSON result (no SSE emission)

The existing `runBackendGenerationSession()` for SSE remains **unchanged**.

---

### Phase 2: Frontend — Client + Machine + Default

#### Step 2.1: Add `runGeneration` to generation client

**File**: `apps/frontend/src/features/generation/runtime/generation-client.ts`

```typescript
export type GenerationRunResponse = {
  artifactId: string;
  content: string;
  status: 'completed' | 'failed';
  reason?: string;
  metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
};

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
- Preserves existing `checkpoints` and `extractionByProject` context for compatibility

#### Step 2.3: Wire non-streaming as default in tools

**File**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`

Update the generation dispatch to use `runGeneration` + `frontendGenerationMachine` by default.

The existing `streamGeneration` + `frontendStreamMachine` path remains available.

#### Step 2.4: Update `GenerationWorkspaceProvider.tsx`

**File**: `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`

Support both machines:
- `frontendGenerationMachine` for non-streaming (default for tools)
- `frontendStreamMachine` for streaming (future chat)

Map both to the same status interface so downstream components are agnostic.

---

### Phase 3: Tests

#### Step 3.1: Backend tests

- Test `generateText` on OpenRouter adapter (mocked fetch)
- Test `generation-actor` success/failure paths
- Test `persistence-actor` single finalize (no flush)
- Test `/generation/run` endpoint end-to-end
- Test generation-system machine in `generate` mode
- **Verify existing streaming tests still pass unchanged**

#### Step 3.2: Frontend tests

- Test `runGeneration` client with mocked fetch
- Test `frontend-generation.machine` state transitions
- Test tools dispatch uses non-streaming by default

#### Step 3.3: Smoke tests

- Verify single INSERT per generation (no flushProgress)
- Verify quota_history recorded correctly
- Verify idempotency works with new path

---

## 4. File Summary

### New Files (3)
| File | Purpose |
|------|---------|
| `apps/backend/src/lib/machines/generation-actor.ts` | Simple fromPromise for non-streaming LLM call |
| `apps/backend/src/lib/machines/persistence-actor.ts` | Single finalize, no batching |
| `apps/frontend/src/features/generation/machines/frontend-generation.machine.ts` | Simplified FE machine |

### Modified Files (~12)
| File | Changes |
|------|---------|
| `apps/backend/src/lib/adapters/generation.adapters.ts` | Add `LlmGenerateAdapter`, `generate` to `GenerationAdapters`, synthetic adapter |
| `apps/backend/src/lib/adapters/openrouter.adapter.ts` | Add `generateText` method + factory |
| `apps/backend/src/lib/adapters/postgres-redis.adapters.ts` | Wire `generate` adapter |
| `apps/backend/src/lib/machines/generation-system.execution.states.ts` | Add `generating` state alongside `streaming` |
| `apps/backend/src/lib/machines/generation-system.actors.ts` | Add `invokeGeneration` actor |
| `apps/backend/src/lib/machines/generation-system.persistence.states.ts` | Add non-batch persistence states |
| `apps/backend/src/lib/runtime/node-server.ts` | Add `/generation/run` route |
| `apps/backend/src/lib/runtime/index.ts` | Add `handleGenerationRequestAsJson` |
| `apps/backend/src/lib/runtime/backend-session.ts` | Add `runBackendGenerationSessionAsJson` |
| `apps/frontend/src/features/generation/runtime/generation-client.ts` | Add `runGeneration` |
| `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` | Default to non-streaming |
| `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` | Support both machines |

### Untouched Files (streaming stays intact)
- `apps/backend/src/lib/machines/stream-transport.machine.ts`
- `apps/backend/src/lib/machines/persistence-batch.machine.ts`
- `apps/backend/src/lib/runtime/generation-stream-replay.ts`
- `apps/backend/src/lib/runtime/http-sse.ts`
- `apps/frontend/src/features/generation/machines/frontend-stream.machine.ts`
- `apps/frontend/src/features/generation/parser/sse-parser.ts`

---

## 5. Impact

| Metric | Streaming (dormant) | Non-Streaming (default) |
|--------|---------------------|------------------------|
| DB writes per generation | N/10 + 1 (10-50+) | **1** |
| FlushProgress | ✅ every 10 chunks | ❌ absent |
| Chat-ready | ✅ | — |
| UX tool | loading → result | loading → result (identical) |

---

## 6. DDD Governance

- No domain term changes — purely technical addition
- `BackendStreamEvent` (DDD-009) remains valid for streaming path
- New contract type `GenerationRunResponse` added to contracts package
- Decision log entry needed for the new mode naming
