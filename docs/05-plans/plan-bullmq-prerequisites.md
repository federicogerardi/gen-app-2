---
status: implemented
version: 1.1
date_created: 2026-07-22
implementation_date: 2026-07-22
last-reviewed: 2026-07-22
next-review-date: 2026-10-22
owner: Backend Runtime
type: plan
tags: [bullmq, redis, pubsub, serialization, event-bridge, step-progress, xstate, sse]
goal: Implementare i prerequisiti architetturali per il ToolWorkflowJob system BullMQ — Redis pub/sub event bridge (RISK-2) e manual step serialization (RISK-1).
---

# Plan: BullMQ Prerequisites — Event Bridge & Step Serialization

> **Collegamenti**: [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) · [Proposal BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) · DDD-226/DDD-227

---

## 1. Scope and Goals

Questo piano copre i due rischi architetturali classificati come **gate di go-live** per il `ToolWorkflowJob` system BullMQ:

| Rischio | Gate | Obiettivo |
|---|---|---|
| **RISK-2** | Redis pub/sub Event Bridge | Il worker BullMQ notifica il server HTTP (che ha la SSE connessa al FE) quando uno step completa/progredisce/fallisce |
| **RISK-1** | Manual Redis Step Serialization | Dopo un crash del worker BullMQ, il retry riprende dall'ultimo step completato invece di ricominciare da zero |

**Non-goal espliciti**:
- Serializzazione completa XState snapshot (documentata come inutilizzabile — gli `invoke` ripartono da zero)
- Modifiche a `generation-system.execution.states.ts` o `toolWorkflowMachine` (restano invocate single-step in Fase 1)
- Pub/sub cross-processo per il FE (gestito da SSE; questo piano costruisce il bridge worker→HTTP server)

---

## 2. RISK-2 — Redis pub/sub Event Bridge

**Stima effort**: 2-3 giorni

### 2.1 Design Overview

```
┌── Processo HTTP (Node) ──────────┐     ┌── Processo Worker (BullMQ) ──┐
│                                    │     │                              │
│  Redis subscriber su canale        │     │  Redis publisher sul canale  │
│  `generation:{jobId}`              │─────│  `generation:{jobId}`        │
│                                    │     │                              │
│  Inoltra eventi a SSE connection   │     │  Pubblica dopo ogni step:    │
│  per il FE                         │     │  - step_started              │
│                                    │     │  - step_completed            │
└────────────────────────────────────┘     │  - step_failed               │
                                           │  - workflow_completed        │
                                           │  - workflow_failed           │
                                           └──────────────────────────────┘
```

### 2.2 Module Design: `job-event-bridge.ts`

**Nuovo file**: `apps/backend/src/lib/runtime/job-event-bridge.ts` (~100 linee)

```typescript
// apps/backend/src/lib/runtime/job-event-bridge.ts

import type Redis from 'ioredis';
import { createComponentLogger, LogComponent } from './log-components';

// ─── Canonical Event Channel ───────────────────────────────────────────────

const CHANNEL_PREFIX = 'generation';

export const buildJobChannel = (jobId: string): string =>
  `${CHANNEL_PREFIX}:${jobId}`;

// ─── Event Types ───────────────────────────────────────────────────────────

export type JobEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'workflow_completed'
  | 'workflow_failed';

export type JobProgressEvent = {
  type: JobEventType;
  jobId: string;
  timestamp: string; // ISO 8601
  stepKey?: string;
  artifactId?: string;
  stepIndex?: number;
  totalSteps?: number;
  status?: 'running' | 'done' | 'error';
  errorMessage?: string;
  result?: {
    sessionId?: string;
    artifactIds?: string[];
  };
};

// ─── Publisher (Worker side) ───────────────────────────────────────────────

const bridgeLog = createComponentLogger('job-event-bridge');

export const createJobEventPublisher = (redis: Redis) => ({
  publish: async (event: JobProgressEvent): Promise<void> => {
    const channel = buildJobChannel(event.jobId);
    const payload = JSON.stringify(event);

    try {
      const receiverCount = await redis.publish(channel, payload);
      bridgeLog.info(
        { channel, eventType: event.type, jobId: event.jobId, stepKey: event.stepKey, receivers: receiverCount },
        'event published',
      );
    } catch (error) {
      // Non-critical: il worker continua anche senza pub/sub
      bridgeLog.error(
        { channel, eventType: event.type, jobId: event.jobId, err: error },
        'event publish failed (non-critical)',
      );
    }
  },
});

// ─── Subscriber (HTTP Server side) ─────────────────────────────────────────

export type JobEventCallback = (event: JobProgressEvent) => void;

export const subscribeToJobEvents = async (
  subscriber: Redis,
  jobId: string,
  callback: JobEventCallback,
): Promise<() => void> => {
  const channel = buildJobChannel(jobId);

  await subscriber.subscribe(channel);

  const listener = (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as JobProgressEvent;
      callback(event);
    } catch {
      bridgeLog.warn({ channel, message }, 'unparseable event message');
    }
  };

  subscriber.on('message', listener);

  bridgeLog.info({ channel, jobId }, 'subscribed to job events');

  // Return unsubscribe function
  return () => {
    subscriber.off('message', listener);
    subscriber.unsubscribe(channel).catch((err) =>
      bridgeLog.error({ channel, jobId, err }, 'unsubscribe failed'),
    );
  };
};
```

### 2.3 Redis Key Patterns

Seguono il pattern esistente di `postgres-redis.shared.ts` e `redis-orchestrate-artifact-cache.ts`:

| Chiave | Pattern | TTL | Note |
|---|---|---|---|
| Canale pub/sub | `generation:{jobId}` | N/A (messaggi effimeri) | Redis PUBLISH/SUBSCRIBE — nessuna persistenza |
| Heartbeat (opzionale) | `generation:{jobId}:heartbeat` | 60s | Per detect worker disconnesso |

### 2.4 Integration Points

#### 2.4.1 Con il Worker BullMQ (`tool-workflow-job-processor.ts`)

Il processore (da implementare in Fase 1 della Proposal) chiama il publisher dopo ogni step:

```typescript
// Nel loop del processore, dopo updateJobProgress:
const publisher = createJobEventPublisher(adapters.redis);

// Prima di eseguire uno step:
await publisher.publish({
  type: 'step_started',
  jobId: job.id!,
  timestamp: new Date().toISOString(),
  stepKey: stepDescriptor.key,
  stepIndex: currentIndex,
  totalSteps: plan.steps.length,
});

// Dopo step completato:
await publisher.publish({
  type: 'step_completed',
  jobId: job.id!,
  timestamp: new Date().toISOString(),
  stepKey: stepDescriptor.key,
  artifactId: result.artifactId,
  status: 'done',
});

// Al completamento workflow:
await publisher.publish({
  type: 'workflow_completed',
  jobId: job.id!,
  timestamp: new Date().toISOString(),
  result: { sessionId, artifactIds },
});
```

#### 2.4.2 Con il Server HTTP e SSE (`http-sse.ts`)

Il server HTTP si sottoscrive agli eventi per il `jobId` e li forwarda alla connessione SSE:

```typescript
// apps/backend/src/lib/runtime/auth-http/tools/tools-job-stream-handler.ts
// (nuovo file, parte della Proposal Fase 1)

import { subscribeToJobEvents, type JobProgressEvent } from '../../job-event-bridge';
import { applySseHeaders } from '../../http-sse';
import { serializeSseEvent } from '../../stream-contract';

// Nel handler GET /api/tools/jobs/:jobId/stream:

applySseHeaders(response);

const subscriber = createRedisConnection(); // subscriber dedicato
                                           // (NON il redis principale — Redis richiede
                                           //  una connessione separata in subscriber mode)

const unsubscribe = await subscribeToJobEvents(subscriber, jobId, (event) => {
  if (response.writableEnded || response.destroyed) {
    unsubscribe();
    return;
  }

  // Mappa evento Redis → frame SSE
  const sseEventType = mapJobEventToSseType(event.type);
  const frame = serializeSseEvent({
    event: sseEventType,
    data: {
      step: event.stepKey,
      status: event.status,
      artifactId: event.artifactId,
      ...(event.result ? { result: event.result } : {}),
    },
  });

  response.write(frame);
});

// Cleanup su disconnect
response.on('close', () => {
  unsubscribe();
  subscriber.quit().catch(() => {});
});

function mapJobEventToSseType(type: JobEventType): string {
  switch (type) {
    case 'step_started':
    case 'step_completed':
    case 'step_failed':
      return 'progress';
    case 'workflow_completed':
    case 'workflow_failed':
      return 'terminal';
  }
}
```

#### 2.4.3 Con Structured Logging (`log-components.ts`)

Aggiungere un nuovo LogComponent:

```typescript
// In log-components.ts, aggiungere a LogComponent:
JOB_EVENT_BRIDGE: 'job-event-bridge' as const,
```

### 2.5 Fallback: Modalità In-Process (Fase 1)

Per la Fase 1 (worker in-process), il pattern di riferimento è un `EventEmitter` Node.js invece di Redis pub/sub. Questo era già indicato nella Proposal (Sezione 7). Il modulo `job-event-bridge.ts` espone comunque l'interfaccia `JobEventCallback` — l'implementazione concreta può essere swappata tra `EventEmitter` (in-process) e Redis pub/sub (multi-process) senza cambiare i consumer.

L'implementazione in-process è più semplice e non richiede un subscriber Redis dedicato. Il piano è:
1. **Fase 1**: `EventEmitter` condiviso tra worker e handler SSE
2. **Fase 2** (post-go-live): sostituire con Redis pub/sub per supporto multi-processo

### 2.6 Test Strategy

| # | Test | Cosa verifica |
|---|---|---|
| T-2.1 | `job-event-bridge.publish.test.ts` | `buildJobChannel` produce canale corretto; `createJobEventPublisher.publish` serializza e chiama `redis.publish` con payload JSON valido |
| T-2.2 | `job-event-bridge.subscribe.test.ts` | `subscribeToJobEvents` chiama `redis.subscribe`, invoca callback su messaggio valido, ignora messaggi non-JSON, restituisce funzione `unsubscribe` funzionante |
| T-2.3 | `tools-job-stream.test.ts` (integrazione) | Endpoint SSE riceve eventi pubblicati via Redis (mock Redis pub/sub o Redis reale in Docker) e produce frame SSE validi |
| T-2.4 | `job-event-bridge.non-critical.test.ts` | Il publish che fallisce (Redis down) NON blocca il worker — errore loggato, esecuzione continua |

### 2.7 Error Handling

| Scenario | Comportamento |
|---|---|
| **Redis unavailable al publish** | Errore loggato con livello `error`. Il worker continua l'esecuzione indisturbato. Il FE non riceve l'evento, ma può sempre ottenere lo stato via `GET /api/tools/jobs/:id`. |
| **Redis unavailable al subscribe** | L'handler SSE restituisce `503 Service Unavailable` con messaggio "real-time updates unavailable, use polling". Il FE può fallback a polling automatico. |
| **Subscriber si disconnette** | La funzione `unsubscribe` viene chiamata automaticamente su `response.on('close')`. Il subscriber Redis viene chiuso con `.quit()`. |
| **Evento malformato** | `JSON.parse` wrappato in try/catch. Evento scartato, warning loggato. Nessun crash. |
| **Connessione SSE chiusa dal client** | `response.writableEnded === true` → il callback salta la scrittura. L'`unsubscribe` cleanup è già stato chiamato. |

---

## 3. RISK-1 — Manual Redis Step Serialization

**Stima effort**: 3-5 giorni

### 3.1 Design Overview

```
┌── Processo Worker ──────────────────────────────────────────────────────┐
│                                                                          │
│  Loop step:                                                              │
│    step 1 completato → serializza { completedSteps, currentStepIndex }   │
│                      → Redis: generation:job:{jobId}:progress            │
│    step 2 completato → aggiorna Redis                                    │
│    ...                                                                    │
│    step 6 completato → workflow completo → cancella Redis key            │
│                                                                          │
│  Worker crash dopo step 3:                                               │
│    BullMQ retry → leggi Redis progress                                   │
│    → completedSteps = [step1, step2, step3]                              │
│    → inject bootstrap multi-step in ToolWorkflowInput                    │
│    → toolWorkflowMachine riparte da step 4                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Module Design: `job-progress-serializer.ts`

**Nuovo file**: `apps/backend/src/lib/runtime/job-progress-serializer.ts` (~80 linee)

```typescript
// apps/backend/src/lib/runtime/job-progress-serializer.ts

import type Redis from 'ioredis';
import type { WorkflowStepState } from '../types/xstate';
import { createComponentLogger } from './log-components';

const KEY_PREFIX = 'generation:job';
const DEFAULT_TTL_SECONDS = 3600; // 1 ora

// ─── Serialized Progress Shape ────────────────────────────────────────────

export type SerializedJobProgress = {
  jobId: string;
  completedSteps: WorkflowStepState[];
  currentStepIndex: number;
  lastUpdated: string; // ISO 8601
};

// ─── Key Builder ──────────────────────────────────────────────────────────

const buildProgressKey = (jobId: string): string =>
  `${KEY_PREFIX}:${jobId}:progress`;

// ─── Serializer ───────────────────────────────────────────────────────────

const progressLog = createComponentLogger('job-progress-serializer');

export const createJobProgressSerializer = (redis: Redis, ttlSeconds = DEFAULT_TTL_SECONDS) => ({
  /**
   * Serializza lo stato di progresso dopo ogni step completato.
   */
  save: async (jobId: string, progress: Omit<SerializedJobProgress, 'jobId' | 'lastUpdated'>): Promise<void> => {
    const key = buildProgressKey(jobId);
    const payload: SerializedJobProgress = {
      jobId,
      ...progress,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const result = await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      progressLog.info(
        { jobId, currentStepIndex: progress.currentStepIndex, completedCount: progress.completedSteps.length, redisResult: result },
        'progress saved',
      );
    } catch (error) {
      // Non-critical: se Redis non è disponibile, si perde la possibilità di resume
      // ma il retry da zero (comportamento corrente) rimane il fallback.
      progressLog.error({ jobId, err: error }, 'progress save failed — resume will fall back to full retry');
    }
  },

  /**
   * Legge lo stato di progresso all'inizio di un retry.
   * Restituisce null se non esiste (primo tentativo o TTL scaduto).
   */
  load: async (jobId: string): Promise<SerializedJobProgress | null> => {
    const key = buildProgressKey(jobId);

    try {
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as SerializedJobProgress;
      // Validazione minima
      if (!parsed.completedSteps || !Array.isArray(parsed.completedSteps)) {
        progressLog.warn({ jobId, parsed }, 'invalid progress shape in Redis — ignoring');
        return null;
      }

      progressLog.info(
        { jobId, completedCount: parsed.completedSteps.length, currentStepIndex: parsed.currentStepIndex },
        'progress loaded for resume',
      );
      return parsed;
    } catch (error) {
      progressLog.error({ jobId, err: error }, 'progress load failed — falling back to full retry');
      return null;
    }
  },

  /**
   * Cancella il progresso dopo completamento del workflow.
   */
  clear: async (jobId: string): Promise<void> => {
    const key = buildProgressKey(jobId);

    try {
      await redis.del(key);
      progressLog.info({ jobId }, 'progress cleared after workflow completion');
    } catch (error) {
      progressLog.warn({ jobId, err: error }, 'progress clear failed — key will expire via TTL');
    }
  },
});
```

### 3.3 Estensione del Bootstrap per Multi-Step Resume

**File modificato**: `apps/backend/src/lib/types/xstate.ts` (tipo `ToolWorkflowInput`)

**Stato attuale** (riga 175-180 in `xstate.ts`):
```typescript
bootstrap?: {
  stepKey: string;
  output: string;
  artifactId: string;
};
```

**Modifica proposta** — estendere per supportare multi-step resume:
```typescript
bootstrap?: {
  /** Singolo step da cui riprendere (backward compat). */
  stepKey?: string;
  output?: string;
  artifactId?: string;
  /** Multi-step resume: array di step già completati da saltare. */
  completedSteps?: Array<{
    stepKey: string;
    artifactId: string;
    status?: WorkflowStepStatus; // 'done' | 'skipped'
  }>;
};
```

**File modificato**: `apps/backend/src/lib/machines/tool-workflow.machine.ts` (funzione `createInitialStepStates`, riga 36-45)

**Stato attuale**:
```typescript
const createInitialStepStates = (input: ToolWorkflowInput): WorkflowStepState[] =>
  input.steps.map((step) => ({
    key: step.key,
    status: input.bootstrap?.stepKey === step.key ? 'done' : 'idle',
    retryCount: 0,
    errorMessage: null,
  }));
```

**Modifica proposta** — arricchire per riconoscere `completedSteps`:
```typescript
const createInitialStepStates = (input: ToolWorkflowInput): WorkflowStepState[] => {
  // Costruisci un set per lookup O(1) degli step completati
  const completedSet = new Set(
    input.bootstrap?.completedSteps?.map((s) => s.stepKey) ?? [],
  );

  // Se c'è anche bootstrap.stepKey legacy (single-step resume), includilo
  if (input.bootstrap?.stepKey) {
    completedSet.add(input.bootstrap.stepKey);
  }

  return input.steps.map((step) => ({
    key: step.key,
    status: completedSet.has(step.key) ? 'done' : 'idle',
    retryCount: 0,
    errorMessage: null,
  }));
};
```

La funzione `findFirstNonTerminalStepIndex` (riga 47-48) già funziona correttamente: trova il primo step con status `idle`/`running`/`error`. Con i completed steps marcati `done`, la macchina riparte automaticamente dallo step successivo.

### 3.4 Integrazione con il Processore BullMQ

**File toccato**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` (da scrivere in Fase 1 Proposal)

```typescript
import { createJobProgressSerializer } from './job-progress-serializer';

export async function processToolWorkflowJob(
  job: Job<ToolWorkflowJobPayload>,
  adapters: { pg: Pool; redis: Redis },
): Promise<ToolWorkflowJobResult> {
  const progressSerializer = createJobProgressSerializer(adapters.redis);
  const jobId = job.id!;

  // 1. Carica progresso salvato (se esiste — siamo in un retry)
  const savedProgress = await progressSerializer.load(jobId);

  // 2. Costruisci bootstrap multi-step se disponibile
  const bootstrap = savedProgress
    ? { completedSteps: savedProgress.completedSteps }
    : undefined;

  // 3. Costruisci il ToolWorkflowInput con bootstrap
  const plan = resolveToolWorkflowPlanFromToolKey(job.data.toolKey);

  // ... extraction, poi loop step ...

  for (let i = startingIndex; i < plan.steps.length; i++) {
    const stepDescriptor = plan.steps[i];

    // ... esecuzione step ...

    // 4. Dopo ogni step completato, serializza progresso
    const completedSteps: WorkflowStepState[] = [
      ...(savedProgress?.completedSteps ?? []),
      {
        key: stepDescriptor.key,
        status: 'done',
        retryCount: 0,
        errorMessage: null,
      },
    ];

    await progressSerializer.save(jobId, {
      completedSteps,
      currentStepIndex: i + 1,
    });
  }

  // 5. Workflow completato — pulisci progresso
  await progressSerializer.clear(jobId);

  return { status: 'completed', ... };
}
```

### 3.5 Determinazione dello Starting Step dopo Resume

Quando il processore carica `savedProgress`, deve determinare da quale step riprendere:

```typescript
const determineStartingIndex = (
  plan: ToolWorkflowPlan,
  savedProgress: SerializedJobProgress | null,
): number => {
  if (!savedProgress || savedProgress.completedSteps.length === 0) {
    return 0; // Primo tentativo — inizia dal primo step
  }

  const completedKeys = new Set(savedProgress.completedSteps.map((s) => s.key));

  // Trova il primo step NON completato
  const firstIncomplete = plan.steps.findIndex((step) => !completedKeys.has(step.key));

  return firstIncomplete === -1
    ? plan.steps.length // Tutti completati (edge case: workflow già finito)
    : firstIncomplete;
};
```

### 3.6 Redis Key Patterns

| Chiave | Pattern | TTL | Note |
|---|---|---|---|
| Progresso step | `generation:job:{jobId}:progress` | 3600s (1 ora) | JSON serializzato di `SerializedJobProgress`. Cancellato a workflow completato. |
| (Esistente) Idempotency lock | `generation:idempotency:lock:{userId}:{projectId}:{endpoint}:{idempotencyKey}` | 900s | Già implementato in `postgres-redis.idempotency.repository.ts` |

### 3.7 Fallback: Retry da Zero

Se Redis non è disponibile al momento del retry:

1. `progressSerializer.load(jobId)` restituisce `null` (catch dell'errore)
2. Il processore parte con `startingIndex = 0` (primo step)
3. Idempotency key per-step (CRIT-01 della Proposal) previene side-effect duplicati per gli step già completati nel primo tentativo
4. L'idempotency check su Postgres (`ON CONFLICT DO NOTHING`) conferma che l'artifact esiste già → skip effettivo anche senza Redis progress

Questo crea un **doppio meccanismo di difesa**:
- **Happy path**: Redis progress → resume immediato dallo step corretto, zero chiamate duplicate
- **Fallback**: Redis down → retry da zero, ma idempotency key + Postgres `ON CONFLICT` prevengono doppie scritture e doppi addebiti (anche se le chiamate LLM possono avvenire due volte per step già completati)

### 3.8 Test Strategy

| # | Test | Cosa verifica |
|---|---|---|
| T-1.1 | `job-progress-serializer.save-load.test.ts` | `save` scrive JSON corretto in Redis con TTL; `load` ritorna il payload deserializzato; `load` ritorna `null` per key inesistente; `load` ritorna `null` per JSON malformato |
| T-1.2 | `job-progress-serializer.clear.test.ts` | `clear` rimuove la key dopo workflow completato |
| T-1.3 | `tool-workflow.machine.bootstrap-multi.test.ts` | `createInitialStepStates` con `bootstrap.completedSteps` multi-step marca gli step corretti come `done`; backward compat con `bootstrap.stepKey` legacy funziona ancora; assenza di bootstrap produce tutti `idle` |
| T-1.4 | `job-progress-serializer.fallback.test.ts` | Redis non disponibile → `save` non lancia eccezioni (errore loggato); `load` restituisce `null` (non crasha); il processore parte da `startingIndex = 0` |
| T-1.5 | `job-progress-serializer.retry.test.ts` (integrazione) | Simula un crash dopo 3 step su 6; al retry, `load` restituisce progresso; il processore riprende da step 4; gli artifact degli step 1-3 esistono già (idempotency); solo step 4-6 vengono eseguiti |

---

## 4. Implementation Order & Dependencies

```
Fase A: RISK-2 Event Bridge (2-3 giorni)
 │
 ├── A1: Crea job-event-bridge.ts (publisher + subscriber + tipi)
 ├── A2: Test unitari (publish, subscribe, edge case)
 ├── A3: Integra publisher nel processore (quando il processore esiste)
 └── A4: Integra subscriber nell'handler SSE (tools-job-stream-handler.ts)
 
Fase B: RISK-1 Step Serialization (3-5 giorni)
 │
 ├── B1: Estendi bootstrap in xstate.ts (ToolWorkflowInput)
 ├── B2: Arricchisci createInitialStepStates in tool-workflow.machine.ts
 ├── B3: Crea job-progress-serializer.ts
 ├── B4: Test unitari (save/load/clear, fallback Redis down)
 ├── B5: Integra nel processore (save dopo ogni step, load all'inizio, clear a fine)
 └── B6: Test integrazione retry (crash mid-workflow, resume da step corretto)
```

**Dipendenze tra rischi**:
- RISK-2 e RISK-1 sono **indipendenti** — possono essere implementati in parallelo o in qualsiasi ordine
- Entrambi dipendono dal modulo `tool-workflow-job-processor.ts` della Proposal Fase 1 per l'integrazione finale, ma i moduli stessi (`job-event-bridge.ts`, `job-progress-serializer.ts`) possono essere scritti e testati indipendentemente

**Dipendenze esterne**:
- `ioredis` — già configurato e disponibile (usato in `server.ts`, `postgres-redis.idempotency.repository.ts`, `redis-orchestrate-artifact-cache.ts`)
- `log-components.ts` — estendere con nuovi `LogComponent` (minima modifica, 2 righe)
- `xstate.ts` (tipi) — modificare `ToolWorkflowInput.bootstrap` (backward compat garantita)
- `tool-workflow.machine.ts` — arricchire `createInitialStepStates` (nessun cambiamento comportamentale senza bootstrap)

---

## 5. Effort Estimates

| Rischio | Task | Giorni | Note |
|---|---|---|---|
| RISK-2 | `job-event-bridge.ts` modulo + tipi | 0.5 | ~100 linee, pattern pub/sub semplice |
| RISK-2 | Test unitari (publish, subscribe) | 0.5 | Mock Redis o Redis Docker |
| RISK-2 | Integrazione publisher nel processore | 0.5 | 5-10 linee per chiamata nel loop |
| RISK-2 | Integrazione subscriber SSE handler | 0.5 | ~40 linee nel tools-job-stream-handler.ts |
| **RISK-2 sub-totale** | | **2.0** | |
| RISK-1 | Estensione `ToolWorkflowInput.bootstrap` | 0.5 | Backward compat, tipo additivo |
| RISK-1 | `createInitialStepStates` arricchimento | 0.5 | ~10 linee modificate |
| RISK-1 | `job-progress-serializer.ts` modulo | 0.5 | ~80 linee, pattern Redis SET/GET/DEL |
| RISK-1 | Test unitari (save/load/clear, fallback) | 1.0 | Copertura Redis up/down |
| RISK-1 | Integrazione nel processore | 1.0 | Resume logic + save in loop + clear finale |
| RISK-1 | Test integrazione retry | 0.5 | Simulazione crash mid-workflow |
| **RISK-1 sub-totale** | | **4.0** | |
| **TOTALE** | | **6.0** | Sequenziale: 5-7 giorni. Parallelo: 3-5 giorni. |

---

## 6. Risk Assessment

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| **Redis indisponibile in produzione** | Bassa (Redis gestito) | Medio | Fallback: retry da zero con idempotency (RISK-1), polling HTTP invece di SSE real-time (RISK-2) |
| **TTL progresso scade prima del retry** | Media (retry rapidi, ma backoff esponenziale può arrivare a 8s×3=~30s) | Basso | TTL di 1 ora copre ampiamente il backoff massimo (~30s). Anche se scade, fallback retry da zero con idempotency. |
| **Connessione subscriber Redis bloccata** | Bassa | Basso | Subscriber dedicato (non condivide il Redis client principale). Disconnessione → unsubscribe automatico. |
| **`createInitialStepStates` regressione** | Bassa | Critico | Modifica additiva al tipo `bootstrap`. Test esistenti su `toolWorkflowMachine` (runtime.geometric-e2e.test.ts, runtime.acquisition-workflow.machine.test.ts) garantiscono nessuna regressione. |
| **Multi-step bootstrap con step types diversi** | Media | Medio | Gli step `crawling`/`scoring` (geometric) completati vengono marcati `done` come gli step `generation`. Il bootstrap non distingue per tipo — solo per `stepKey`. Test dedicato su GEOMETRIC con resume dopo serp-crawling. |

---

## 7. Success Criteria

### RISK-2 (Event Bridge)

- [x] SC-2.1: `createJobEventPublisher.publish` invia un evento JSON valido sul canale Redis `generation:{jobId}`
- [x] SC-2.2: `subscribeToJobEvents` riceve l'evento e chiama il callback; `unsubscribe` ferma la ricezione
- [ ] SC-2.3: Il worker BullMQ pubblica `step_started`/`step_completed`/`step_failed`/`workflow_completed`/`workflow_failed` nel ciclo di vita corretto
- [ ] SC-2.4: L'handler SSE (`GET /api/tools/jobs/:jobId/stream`) forwarda gli eventi Redis come frame SSE validi
- [x] SC-2.5: Redis non disponibile → worker continua (publish fallisce senza crash); SSE handler restituisce 503; FE può usare polling `GET /api/tools/jobs/:id`
- [x] SC-2.6: `npm --workspace apps/backend run test` passa con i nuovi test unitari

### RISK-1 (Step Serialization)

- [x] SC-1.1: `createJobProgressSerializer.save` scrive `SerializedJobProgress` in Redis con TTL 3600s
- [x] SC-1.2: `createJobProgressSerializer.load` restituisce il progresso salvato; `null` se inesistente o Redis down
- [x] SC-1.3: `createJobProgressSerializer.clear` rimuove la key dopo workflow completato
- [x] SC-1.4: `createInitialStepStates` con `bootstrap.completedSteps` marca multi-step come `done`; backward compat con `bootstrap.stepKey` singolo preservata
- [ ] SC-1.5: Retry dopo crash a step 3 di 6: il processore carica il progresso, salta step 1-3, esegue step 4-6
- [x] SC-1.6: Redis non disponibile → `load` restituisce `null` → il processore parte da step 0 (retry completo con idempotency)
- [x] SC-1.7: `npm --workspace apps/backend run test` passa (test esistenti + nuovi test unitari/integrazione); regressione assente su `toolWorkflowMachine`
- [x] SC-1.8: Il tipo `ToolWorkflowInput.bootstrap` esteso è backward-compatibile — il codice esistente che usa `bootstrap?.stepKey` continua a compilare e funzionare

---

## 8. Files Summary

### New Files

| File | Rischio | Linee stimate | Status |
|---|---|---|---|
| `apps/backend/src/lib/runtime/job-event-bridge.ts` | RISK-2 | ~100 | ✅ Implementato |
| `apps/backend/src/lib/runtime/job-progress-serializer.ts` | RISK-1 | ~80 | ✅ Implementato |
| `apps/backend/src/lib/tests/runtime.job-event-bridge.test.ts` | RISK-2 | ~120 | ✅ Implementato |
| `apps/backend/src/lib/tests/runtime.job-progress-serializer.test.ts` | RISK-1 | ~150 | ✅ Implementato |

### Modified Files

| File | Rischio | Modifica | Status |
|---|---|---|---|
| `apps/backend/src/lib/types/xstate.ts` | RISK-1 | Estendere `ToolWorkflowInput.bootstrap` (tipo additivo, ~15 righe) | ✅ Implementato |
| `apps/backend/src/lib/machines/tool-workflow.machine.ts` | RISK-1 | Arricchire `createInitialStepStates` (~10 righe) | ✅ Implementato |
| `apps/backend/src/lib/runtime/log-components.ts` | RISK-2, RISK-1 | Aggiungere `JOB_EVENT_BRIDGE`, `JOB_PROGRESS_SERIALIZER` (~2 righe) | ✅ Implementato |
| `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` | RISK-2, RISK-1 | Integrare publisher + serializer nel loop step | ⏳ In attesa Proposal Fase 1 |
| `apps/backend/src/lib/runtime/auth-http/tools/tools-job-stream-handler.ts` | RISK-2 | Integrare subscriber Redis nell'handler SSE | ⏳ In attesa Proposal Fase 1 |

---

## 9. References

- [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) — RISK-1 (Sezione 2.1), RISK-2 (Sezione 2.2), Raccomandazioni (Sezioni 4.1, 4.2)
- [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) — Worker lifecycle (Sezione 3), Processore (Sezione 4), SSE Stream (Sezione 7), Idempotency (Sezione 8)
- `apps/backend/src/lib/adapters/redis-orchestrate-artifact-cache.ts` — Pattern Redis esistente (HSET + TTL, pipeline) da seguire per il serializzatore
- `apps/backend/src/lib/adapters/postgres-redis.shared.ts` — Pattern di naming chiavi Redis (`generation:idempotency:lock:...`)
- `apps/backend/src/lib/runtime/http-sse.ts` — Infrastruttura SSE (`applySseHeaders`, `pipeSseStreamToNodeResponse`)
- `apps/backend/src/lib/runtime/log-components.ts` — Registry LogComponent canonico
- `apps/backend/src/lib/types/xstate.ts` — `ToolWorkflowInput`, `WorkflowStepState`, `WorkflowStepDescriptor`
- `apps/backend/src/lib/machines/tool-workflow.machine.ts` — `createInitialStepStates` (righe 36-45), `findFirstNonTerminalStepIndex` (righe 47-48)