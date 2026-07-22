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

> Guida per lo sviluppatore che mappa i concetti DDD classici alle implementazioni XState v5 usate in `gen-app-2`.
>
> **Collegamenti**: [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) · [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) · [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) · [Domain Naming Decision Log](../domain-naming-decision-log.md)

---

## 1. Perché XState come Aggregate Root?

### 1.1 Confronto: DDD OOP classico vs XState v5

| Aspetto | DDD OOP classico | XState v5 |
|---|---|---|
| Stato | Campi mutabili su un oggetto | `context` immutabile, modificato via `assign()` |
| Transizioni | Metodi che mutano lo stato | Eventi → transizioni dichiarative nel `states` |
| Invarianti | Guard inline nei metodi | `guards` dichiarativi, testabili in isolamento |
| Side effect | Chiamate dirette a servizi | `actions` e `invoke` (attori figli) |
| Test | Mock del repository + assertion sullo stato | `createActor()` → `send()` → `assert` snapshot |

### 1.2 Benefici

- **Stati espliciti**: ogni stato della macchina è un nodo nel grafo — niente stati impliciti derivati da combinazioni di campi.
- **Transizioni dichiarate**: il codice `on: { EVENT: { target, actions, guard } }` è auto-documentante.
- **Testabilità**: i guard sono funzioni pure `({ context, event }) → boolean` — testabili senza mock.
- **Visualizzazione**: XState Inspector mostra l'albero degli attori runtime.

### 1.3 Trade-off

- **Serializzazione mid-flight**: gli `invoke` ripartono da zero dopo un crash (vedi [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) per la soluzione RISK-1).
- **Child actor state**: gli attori figli sono isolati — il padre non può leggere il loro contesto senza eventi espliciti.
- **Debugging cross-process**: con BullMQ, il worker e l'HTTP server sono processi separati (vedi RISK-2 nel piano BullMQ per il bridge Redis pub/sub).

---

## 2. Mappatura DDD → XState

### 2.1 Aggregate Root → XState Machine

Ogni macchina XState definita con `setup({ ... }).createMachine({ ... })` è un Aggregate Root.

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

**Esempio concreto**: `generationSystemMachine` è l'Aggregate Root del Generation bounded context.

### 2.2 Domain Event → XState Event

I Domain Event sono le union type definite in `xstate.ts`:

```typescript
// apps/backend/src/lib/types/xstate.ts
export type ToolWorkflowEvent =
  | WorkflowStepUnlockedEvent    // DDD-035
  | WorkflowStepCompletedEvent;  // DDD-036
```

Ogni evento ha un `type` stringa che corrisponde alle chiavi nelle transizioni `on: { ... }`.

### 2.3 Command/Invocation → XState invoke

I comandi che richiedono side effect asincroni (chiamate LLM, API esterne) sono implementati come `invoke`:

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

I guard sono funzioni pure che determinano se una transizione è permessa:

```typescript
// apps/backend/src/lib/machines/generation-system.guards.ts
isNotFinalArtifact: ({ context }) => {
  const plan = resolveToolWorkflowPlan(context);
  return !isFinalStepForPlan(plan, stepDescriptor.key);
},
```

### 2.5 Side Effect → XState Action

Le azioni sono effetti collaterali dichiarativi — tipicamente `assign()` per mutare il contesto:

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

I repository sono iniettati tramite `input.adapters`:

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

I Value Object sono tipi TypeScript (interfacce o type alias) definiti in `xstate.ts`:

```typescript
export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';
export type WorkflowStepType = 'extraction' | 'generation' | 'acquisition' | 'crawling' | 'scoring';
```

### 2.8 Aggregate State → XState Context

Il contesto della macchina è lo stato dell'aggregate. Per macchine complesse, il contesto è decomposto in sub-contesti (DDD-167/DDD-168):

```typescript
// Context decomposti in generation-system.context-accessors.ts
selectDomainContext(context)   // toolKey, workflowType, artifactType
selectRuntimeContext(context)  // routeType, mode, model
```

---

## 3. Diagramma di Sequenza Completo

### 3.1 Submit FE → POST /api/tools/jobs

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
  ├─ Crea attore generationSystemMachine
  │
  ▼
generationSystemMachine: idle → requestGateway → toolGenerationFlow
```

### 3.2 BullMQ accoda ToolWorkflowJob → Worker processa

```
toolGenerationFlow
  │
  ├─ invoke: toolWorkflowMachine (1 step alla volta)
  │   ├─ STEP_START → step: running
  │   ├─ invoke: LLM actor (stream/generate)
  │   ├─ STEP_SUCCESS → step: done
  │   ├─ Salva progresso Redis (RISK-1)
  │   └─ Pubblica evento Redis (RISK-2)
  │
  ▼
Worker BullMQ
  │
  ├─ Per ogni step nel piano:
  │   ├─ Esegui step
  │   ├─ Salva progresso → Redis
  │   └─ Pubblica evento → Redis pub/sub
  │
  └─ Workflow completato → pulisci Redis
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
  │   │   └── (invoke per step corrente)
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
  ├─ onmessage → aggiorna UI (step progress, completion)
```

### 3.5 Completamento

```
toolWorkflowMachine: done
  │
  ├─ output: WorkflowStepCompletedEvent
  │
  ▼
generationSystemMachine
  │
  ├─ persistenceRecording → salva artifact
  ├─ finalize → cleanup
  └─ idle (stato finale)
```

---

## 4. Anatomia di una Macchina

### 4.1 generation-system.definition.ts

File: `apps/backend/src/lib/machines/generation-system.definition.ts`

Top-level machine definition. Registra actions, guards, actors da moduli separati:

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

Multi-step orchestrator. Gestisce il ciclo di vita di ogni step:

- `createInitialStepStates(input)` — inizializza gli step da idle/done (bootstrap support)
- `findFirstNonTerminalStepIndex(stepStates)` — trova il prossimo step da eseguire
- Actions: `markStepRunning`, `markStepDone`, `markStepError`, `markStepSkipped`
- Merge actions: `mergeAcquisitionOutput`, `mergeCrawlingOutput`, `mergeScoringOutput`

### 4.3 generation-system.guards.ts

File: `apps/backend/src/lib/machines/generation-system.guards.ts`

Business rule guards. Ogni guard è una funzione pura:

- `routeIsTool`, `routeIsExtraction`, `routeIsGeneric` — routing discriminator
- `isNotFinalArtifact` — credit gate (step intermedio vs finale)
- `streamOutputIsFailure`, `extractionOutputIsAccepted` — output type discriminators

### 4.4 generation-system.events.ts

File: `apps/backend/src/lib/machines/generation-system.events.ts`

Event output accessors. Helper che estraggono l'output dagli eventi XState:

- `getStreamDoneOutput(event)` → `StreamDoneOutput | undefined`
- `getToolDoneOutput(event)` → `ToolDoneOutput | undefined`
- `getExtractionDoneOutput(event)` → `ExtractionDoneOutput | undefined`

### 4.5 generation-system.types.ts

File: `apps/backend/src/lib/machines/generation-system.types.ts`

Context types, output types, action types. Definisce la shape del contesto e degli output degli attori.

---

## 5. Test Pattern

### 5.1 Unit test di una macchina

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

### 5.2 Test di una guard

```typescript
test('isNotFinalArtifact returns false for last step', () => {
  const result = isNotFinalArtifact({
    context: { routeType: 'tool', ... },
    event: { type: 'STEP_SUCCESS', stepKey: 'outro-structure', ... },
  });
  assert.equal(result, false);
});
```

### 5.3 Test di un'azione assign

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

### 5.4 Snapshot testing per regressione

Pattern esistente in `runtime.geometric-e2e.test.ts`: creare un attore, inviare una sequenza di eventi, e confrontare lo snapshot finale con un expected shape.

---

## 6. Estensione: Aggiungere un Nuovo Step Type

### 6.1 WorkflowStepType union in xstate.ts

```typescript
// apps/backend/src/lib/types/xstate.ts
export type WorkflowStepType = 'extraction' | 'generation' | 'acquisition' | 'crawling' | 'scoring' | 'newType';
```

### 6.2 WorkflowStepDescriptor.type

Assegnare il type nel descriptor dello step:

```typescript
{ key: 'my-step', dependencies: [], type: 'newType' }
```

### 6.3 Routing in generation-system.execution.states.ts

Aggiungere uno stato per il nuovo flow:

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

Se il nuovo step produce output che deve essere merge nel contesto:

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

### 7.1 "Perché la guard non scatta?"

- Verifica che l'evento abbia il `type` corretto nella transizione `on: { ... }`.
- Verifica che il contesto abbia la shape attesa dal guard.
- Usa XState Inspector per vedere lo stato corrente e gli eventi emessi.

### 7.2 "Perché invoke riparte da zero?"

Comportamento documentato di XState: gli `invoke` sono effimeri. Dopo un crash o un retry, l'attore invocato riparte dall'inizio. Per il resume dopo crash, vedi il meccanismo di serializzazione step nel [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) (RISK-1).

### 7.3 "Perché TS non inferisce il tipo?"

Gli helper in `generation-system.events.ts` usano cast `as` per accedere all'output degli eventi. Se il tipo non corrisponde, il cast fallisce silenziosamente a runtime. Per runtime validation, vedi RISK-4 nel [Post-BullMQ Improvements Plan](../../05-plans/plan-post-bullmq-improvements.md).

### 7.4 "Come debuggare uno stato runtime?"

```typescript
const snapshot = actor.getSnapshot();
console.log('State:', snapshot.value);
console.log('Context:', JSON.stringify(snapshot.context, null, 2));
console.log('Children:', Object.keys(snapshot.children ?? {}));
```

Per una rappresentazione formattata, vedi RISK-6 nel [Post-BullMQ Improvements Plan](../../05-plans/plan-post-bullmq-improvements.md) (Actor Inspector).

---

## 8. Appendice: Riferimenti Incrociati

### 8.1 DDD-NNN pertinenti

| DDD-NNN | Concetto | Rilevanza |
|---|---|---|
| DDD-167 | Context decomposition | Decomposizione del contesto in sub-contesti (domain, runtime, metrics) |
| DDD-168 | Decomposed context accessors | `selectDomainContext`, `selectRuntimeContext` |
| DDD-037 | WorkflowStepBootstrap | Bootstrap per resume/regenerate |
| DDD-035 | WorkflowStepUnlocked | Evento di unlock step |
| DDD-036 | WorkflowStepCompleted | Evento di completamento step |
| DDD-034 | ToolWorkflowPersistenceMetadata | Metadati persistenza workflow |
| DDD-226 | ToolWorkflowJob BullMQ | Proposal per il sistema BullMQ |
| DDD-227 | BullMQ prerequisites | Piano per RISK-1 e RISK-2 |

### 8.2 Entry AGENTS.md rilevanti

- **XState Pitfalls**: `useMachine(..., { input })` inizializza l'input una volta sola; se le props cambiano, sincronizza via evento o ricrea l'attore.
- **React Pitfalls**: dichiara le costanti prima di `useEffect` se referenziate nel corpo dell'effetto.

### 8.3 Documenti collegati

| Documento | Relazione |
|---|---|
| [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) | Analisi dei rischi architetturali — questa guida ne è la controparte pratica |
| [BullMQ Prerequisites Plan](../../05-plans/plan-bullmq-prerequisites.md) | Implementazione RISK-1 (serializzazione) e RISK-2 (event bridge) |
| [Post-BullMQ Improvements Plan](../../05-plans/plan-post-bullmq-improvements.md) | RISK-3 (domain modules), RISK-4 (Zod), RISK-5 (questa guida), RISK-6 (inspector) |
| [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) | Terminologia canonica DDD |
| [Domain Naming Decision Log](../domain-naming-decision-log.md) | DDD-NNN per annotazioni e riferimenti |
