---
status: active
version: 1.0
date_created: 2026-07-22
last-reviewed: 2026-07-22
next-review-date: 2027-01-22
owner: Domain Architecture
type: specification
tags: [xstate, ddd, aggregate, developer-guide, architecture, onboarding]
---

# XState-as-Aggregate Developer Guide

> Developer guide mapping classic DDD concepts to XState v5 implementations used in `gen-app-2`.
>
> **References**: [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) · [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) · [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) · [Domain Naming Decision Log](../domain-naming-decision-log.md)

---

## 1. Why XState as Aggregate Root?

### 1.1 Comparison: Classic DDD OOP vs XState v5

| Aspect | Classic DDD OOP | XState v5 |
|---|---|---|
| State | Mutable fields on an object | Immutable `context`, modified via `assign()` |
| Transitions | Methods that mutate state | Events → declarative transitions in `states` |
| Invariants | Inline guards in methods | Declarative `guards`, testable in isolation |
| Side effects | Direct service calls | `actions` and `invoke` (child actors) |
| Testing | Mock repository + assert state | `createActor()` → `send()` → assert snapshot |

### 1.2 Benefits

- **Explicit states**: every machine state is a node in the graph — no implicit states derived from field combinations.
- **Declared transitions**: the code `on: { EVENT: { target, actions, guard } }` is self-documenting.
- **Testability**: guards are pure functions `({ context, event }) => boolean` — testable without mocks.
- **Visualization**: XState Inspector shows the runtime actor tree.

### 1.3 Trade-offs

- **Mid-flight serialization**: `invoke` restarts from scratch after a crash (see [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) for the RISK-1 solution).
- **Child actor state**: child actors are isolated — the parent cannot read their context without explicit events.
- **Cross-process debugging**: with BullMQ, the worker and HTTP server are separate processes (see RISK-2 in the BullMQ plan for the Redis pub/sub bridge).

---

## 2. DDD → XState Mapping

### 2.1 Aggregate Root → XState Machine

Every XState machine defined with `setup({ ... }).createMachine({ ... })` is an Aggregate Root.

```typescript
// apps/backend/src/lib/machines/generation-system.definition.ts
export const generationSystemMachine = setup({
  types: { context, input, events },
  actions, guards, actors,
}).createMachine({
  id: 'generationSystemMachine',
  initial: 'idle',
  context: ({ input }) => ({ ... }),
  states: { ... },
});
```

**Concrete example**: `generationSystemMachine` is the Aggregate Root of the Generation bounded context.

### 2.2 Domain Event → XState Event

Domain Events are the union types defined in `xstate.ts`:

```typescript
// apps/backend/src/lib/types/xstate.ts
export type ToolWorkflowEvent =
  | WorkflowStepUnlockedEvent    // DDD-035
  | WorkflowStepCompletedEvent;  // DDD-036
```

Every event has a string `type` that corresponds to keys in `on: { ... }` transitions.

### 2.3 Command/Invocation → XState invoke

Commands requiring async side effects (LLM calls, external APIs) are implemented as `invoke`:

```typescript
// apps/backend/src/lib/machines/generation-system.execution.states.ts
invoke: {
  id: 'extractionActor',
  src: 'invokeExtraction',      // attore registrato in setup({ actors })
  input: ({ context }) => ({ context }),
  onDone: [ ... ],
  onError: { ... },
}
```

### 2.4 Business Invariant → XState Guard

Guards are pure functions that determine whether a transition is permitted:

```typescript
// apps/backend/src/lib/machines/generation-system.guards.ts
isNotFinalArtifact: ({ context }) => {
  const plan = resolveToolWorkflowPlan(context);
  return !isFinalStepForPlan(plan, stepDescriptor.key);
},
```

### 2.5 Side Effect → XState Action

Actions are declarative side effects — typically `assign()` to mutate context:

```typescript
assign({
  stepStates: ({ context, event }) =>
    context.stepStates.map((step) =>
      step.key === event.stepKey
        ? { ...step, status: 'done' }
        : step,
    ),
}),
```

### 2.6 Repository Pattern → XState Input Adapters

Repositories are injected via `input.adapters`:

```typescript
// input shape
type GenerationSystemInput = {
  adapters: {
    pg: Pool;
    redis: Redis;
    llm: LlmAdapter;
  };
};
```

### 2.7 Value Object → TypeScript branded types

Value Objects are TypeScript types (interfaces or type aliases) defined in `xstate.ts`:

```typescript
export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';
export type WorkflowStepType = 'extraction' | 'generation' | 'acquisition' | 'crawling' | 'scoring';
```

### 2.8 Aggregate State → XState Context

The machine context is the aggregate state. For complex machines, the context is decomposed into sub-contexts (DDD-167/DDD-168):

```typescript
// Decomposed contexts in generation-system.context-accessors.ts
selectDomainContext(context)   // toolKey, workflowType, artifactType
selectRuntimeContext(context)  // routeType, mode, model
```

---

## 3. Complete Sequence Diagram

### 3.1 FE Submit → POST /api/tools/jobs

```
FE (ToolPage)
  │
  ├─ canStartGeneration guard → true
  ├─ POST /api/generate (GenerationRequest)
  │
  ▼
BE (HTTP Handler)
  │
  ├─ Auth → Validation → Usage → Idempotency
  ├─ Creates generationSystemMachine actor
  │
  ▼
generationSystemMachine: idle → requestGateway → toolGenerationFlow
```

### 3.2 BullMQ enqueues ToolWorkflowJob → Worker processes

```
toolGenerationFlow
  │
  ├─ invoke: toolWorkflowMachine (1 step at a time)
  │   ├─ STEP_START → step: running
  │   ├─ invoke: LLM actor (stream/generate)
  │   ├─ STEP_SUCCESS → step: done
  │   ├─ Saves progress Redis (RISK-1)
  │   └─ Publishes event Redis (RISK-2)
  │
  ▼
Worker BullMQ
  │
  ├─ For each step in plan:
  │   ├─ Execute step
  │   ├─ Save progress → Redis
  │   └─ Publish event → Redis pub/sub
  │
  └─ Workflow completed → clean Redis
```

### 3.3 Actor tree

```
generationSystemMachine
  ├── requestGateway
  │   ├── usageMachine
  │   ├── idempotencyCoordinatorMachine
  │   └── ownershipMachine
  ├── toolGenerationFlow
  │   ├── toolWorkflowMachine
  │   │   └── (invoke for current step)
  │   │       ├── streamTransportMachine
  │   │       └── persistenceBatchMachine
  │   └── extractionChainMachine
  └── persistenceRecording
```

### 3.4 Event Bridge: Redis pub/sub → SSE → FE

```
Worker (pub/sub publisher)
  │
  ├─ redis.publish('generation:{jobId}', event)
  │
  ▼
HTTP Server (pub/sub subscriber)
  │
  ├─ subscribeToJobEvents(subscriber, jobId, callback)
  ├─ callback → serializeSseEvent() → response.write()
  │
  ▼
FE (EventSource)
  │
  ├─ onmessage → updates UI (step progress, completion)
```

### 3.5 Completion

```
toolWorkflowMachine: done
  │
  ├─ output: WorkflowStepCompletedEvent
  │
  ▼
generationSystemMachine
  │
  ├─ persistenceRecording → saves artifact
  ├─ finalize → cleanup
  └─ idle (final state)
```

---

## 4. Machine Anatomy

### 4.1 generation-system.definition.ts

File: `apps/backend/src/lib/machines/generation-system.definition.ts`

Top-level machine definition. Registers actions, guards, actors from separate modules:

```typescript
setup({
  actions: generationSystemActions,     // da generation-system.actions.ts
  guards: generationSystemGuards,       // da generation-system.guards.ts
  actors: generationSystemActors,       // da generation-system.actors.ts
}).createMachine({
  states: {
    ...generationSystemRequestStates,   // da generation-system.request.states.ts
    ...generationSystemExecutionStates, // da generation-system.execution.states.ts
    ...generationSystemPersistenceStates,
  },
});
```

### 4.2 tool-workflow.machine.ts

File: `apps/backend/src/lib/machines/tool-workflow.machine.ts`

Multi-step orchestrator. Manages the lifecycle of each step:

- `createInitialStepStates(input)` — initializes steps from idle/done (bootstrap support)
- `findFirstNonTerminalStepIndex(stepStates)` — finds the next step to execute
- Actions: `markStepRunning`, `markStepDone`, `markStepError`, `markStepSkipped`
- Merge actions: `mergeAcquisitionOutput`, `mergeCrawlingOutput`, `mergeScoringOutput`

### 4.3 generation-system.guards.ts

File: `apps/backend/src/lib/machines/generation-system.guards.ts`

Business rule guards. Each guard is a pure function:

- `routeIsTool`, `routeIsExtraction`, `routeIsGeneric` — routing discriminator
- `isNotFinalArtifact` — credit gate (intermediate vs final step)
- `streamOutputIsFailure`, `extractionOutputIsAccepted` — output type discriminators

### 4.4 generation-system.events.ts

File: `apps/backend/src/lib/machines/generation-system.events.ts`

Event output accessors. Helpers that extract output from XState events:

- `getStreamDoneOutput(event)` → `StreamDoneOutput | undefined`
- `getToolDoneOutput(event)` → `ToolDoneOutput | undefined`
- `getExtractionDoneOutput(event)` → `ExtractionDoneOutput | undefined`

### 4.5 generation-system.types.ts

File: `apps/backend/src/lib/machines/generation-system.types.ts`

Context types, output types, action types. Defines the shape of context and actor outputs.

---

## 5. Test Patterns

### 5.1 Unit test of a machine

```typescript
import { createActor } from 'xstate';
import { toolWorkflowMachine } from '../machines/tool-workflow.machine';

test('toolWorkflowMachine merges crawling output', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      requestId: 'req-1',
      toolKey: 'geometric',
      workflowType: 'geometric',
      steps: [{ key: 'crawl-serp', dependencies: [], type: 'crawling' }],
      // ...
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'crawl-serp' });
  actor.send({ type: 'STEP_SUCCESS', stepKey: 'crawl-serp', output: { ... }, artifactId: 'art-1' });

  const snapshot = actor.getSnapshot();
  assert.equal(snapshot.context.stepStates[0].status, 'done');
});
```

### 5.2 Testing a guard

```typescript
test('isNotFinalArtifact returns false for last step', () => {
  const result = isNotFinalArtifact({
    context: { routeType: 'tool', ... },
    event: { type: 'STEP_SUCCESS', stepKey: 'outro-structure', ... },
  });
  assert.equal(result, false);
});
```

### 5.3 Testing an assign action

```typescript
test('markStepDone updates step status', () => {
  const actor = createActor(toolWorkflowMachine, { input: { ... } });
  actor.start();

  actor.send({ type: 'STEP_START', stepKey: 'generate' });
  actor.send({ type: 'STEP_SUCCESS', stepKey: 'generate', output: {}, artifactId: 'art-1' });

  const step = actor.getSnapshot().context.stepStates.find(s => s.key === 'generate');
  assert.equal(step?.status, 'done');
});
```

### 5.4 Snapshot testing for regression

Existing pattern in `runtime.geometric-e2e.test.ts`: create an actor, send a sequence of events, and compare the final snapshot with an expected shape.

---

## 6. Extension: Adding a New Step Type

### 6.1 WorkflowStepType union in xstate.ts

```typescript
// apps/backend/src/lib/types/xstate.ts
export type WorkflowStepType = 'extraction' | 'generation' | 'acquisition' | 'crawling' | 'scoring' | 'newType';
```

### 6.2 WorkflowStepDescriptor.type

Assign the type in the step descriptor:

```typescript
{ key: 'my-step', dependencies: [], type: 'newType' }
```

### 6.3 Routing in generation-system.execution.states.ts

Add a state for the new flow:

```typescript
newTypeFlow: {
  invoke: {
    id: 'newTypeActor',
    src: 'invokeNewType',
    input: ({ context }) => ({ context }),
    onDone: [ ... ],
    onError: { ... },
  },
},
```

### 6.4 Merge action in tool-workflow.machine.ts

If the new step produces output that must be merged into context:

```typescript
mergeNewTypeOutput: assign({
  assembledGenerationInput: ({ context, event }) => {
    if (event.type !== 'STEP_SUCCESS') return context.assembledGenerationInput;
    const stepDescriptor = context.input.steps.find(s => s.key === event.stepKey);
    if (stepDescriptor?.type !== 'newType') return context.assembledGenerationInput;
    return { ...context.assembledGenerationInput, newType: event.output };
  },
}),
```

---

## 7. Troubleshooting Common Issues

### 7.1 "Why doesn't the guard trigger?"

- Verify that the event has the correct `type` in the `on: { ... }` transition.
- Verify that the context has the shape expected by the guard.
- Use XState Inspector to see the current state and emitted events.

### 7.2 "Why does invoke restart from scratch?"

Documented XState behavior: `invoke` is ephemeral. After a crash or retry, the invoked actor restarts from the beginning. For post-crash resume, see the step serialization mechanism in [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) (RISK-1).

### 7.3 "Why doesn't TS infer the type?"

The helpers in `generation-system.events.ts` use `as` casts to access event output. If the type doesn't match, the cast fails silently at runtime. For runtime validation with Zod, see `generation-system.event-schemas.ts` (RISK-4 implemented).

### 7.4 "How to debug runtime state?"

```typescript
const snapshot = actor.getSnapshot();
console.log('State:', snapshot.value);
console.log('Context:', JSON.stringify(snapshot.context, null, 2));
console.log('Children:', Object.keys(snapshot.children ?? {}));
```

For a formatted representation, see `actor-inspector.ts` (RISK-6 implemented):

---

## 8. Appendix: Cross-References

### 8.1 Relevant DDD-NNN

| DDD-NNN | Concept | Relevance |
|---|---|---|
| DDD-167 | Context decomposition | Decomposition of context into sub-contexts (domain, runtime, metrics) |
| DDD-168 | Decomposed context accessors | `selectDomainContext`, `selectRuntimeContext` |
| DDD-037 | WorkflowStepBootstrap | Bootstrap for resume/regenerate |
| DDD-035 | WorkflowStepUnlocked | Step unlock event |
| DDD-036 | WorkflowStepCompleted | Step completion event |
| DDD-034 | ToolWorkflowPersistenceMetadata | Workflow persistence metadata |
| DDD-226 | ToolWorkflowJob BullMQ | Proposal for BullMQ system |
| DDD-227 | BullMQ prerequisites | Plan for RISK-1 and RISK-2 |

### 8.2 Relevant AGENTS.md entries

- **XState Pitfalls**: `useMachine(..., { input })` initializes input once; if props change, sync via event or recreate actor.
- **React Pitfalls**: declare constants before `useEffect` if referenced in the effect body.

### 8.3 Related Documents

| Document | Relationship |
|---|---|
| [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) | Architectural risk analysis — this guide is its practical counterpart |
| [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) | ✅ Implemented — RISK-1 (serialization) and RISK-2 (event bridge) |
| [Post-BullMQ Improvements Plan](../../05-plans/plan-post-bullmq-improvements.md) | ✅ Implemented — RISK-3 (domain modules), RISK-4 (Zod), RISK-5 (this guide), RISK-6 (inspector) |
| [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) | Canonical DDD terminology |
| [Domain Naming Decision Log](../domain-naming-decision-log.md) | DDD-NNN for annotations and references |
