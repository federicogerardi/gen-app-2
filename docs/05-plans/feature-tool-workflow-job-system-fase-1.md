---
status: draft
version: 1.1
date_created: 2026-07-24
last-reviewed: 2026-07-24
next-review-date: 2027-01-24
owner: Backend Runtime + Frontend Tools
type: implementation-plan
tags: [tool-workflow-job, bullmq, sse, backend-driven, phase-1, mvp]
goal: Implementare la Fase 1 (MVP) del sistema ToolWorkflowJob BE-driven con worker in-process, feature flag BackendCapabilities, e SSE stream — zero modifiche a generation-system.
---

# Implementation Plan: ToolWorkflowJob System — Fase 1 (MVP)

> **Collegamenti**: [Proposal BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (v1.10, `approved`) · [BullMQ Prerequisites Plan](./plan-bullmq-prerequisites.md) (`implemented`) · DDD-226/DDD-227/DDD-228

---

## 1. Overview

**Obiettivo**: Sostituire l'orchestrazione FE-driven step-by-step con un sistema di code BE-driven basato su BullMQ. La Fase 1 consegna l'MVP con worker in-process (stesso processo Node.js del server HTTP), feature flag `BackendCapabilities.toolsJobSystem` per attivazione graduale per-tool, e SSE stream per aggiornamenti real-time al FE. Zero modifiche a `generation-system` — il processore invoca la stessa logica di generazione 1 volta per step in un loop BE.

**Durata stimata**: 10 giorni lavorativi (2 settimane)

**Output**: 22 file (10 nuovi, 7 modificati, 5 file di test BE, 6 file di test FE) + 15 Acceptance Criteria verificati

---

## 2. Prerequisiti e Precondizioni

| Componente | Stato | Note |
|---|---|---|
| BullMQ v5.78.0 | ✅ In `apps/backend/package.json` | Queue/Worker/Job API disponibile |
| Redis (ioredis) | ✅ Configurato in `server.ts` | `REDIS_URL`, connection pool |
| `job-event-bridge.ts` | ✅ Implementato (plan BullMQ prerequisites) | Redis pub/sub publisher + subscriber |
| `job-progress-serializer.ts` | ✅ Implementato (plan BullMQ prerequisites) | Manual Redis step serialization |
| `ToolWorkflowInput.bootstrap` esteso | ✅ Implementato (plan BullMQ prerequisites) | Multi-step resume support in `xstate.ts` |
| `createInitialStepStates` | ✅ Implementato (plan BullMQ prerequisites) | Riconosce `bootstrap.completedSteps` in `tool-workflow.machine.ts` |
| SSE infrastructure | ✅ `http-sse.ts` + `stream-contract.ts` | `applySseHeaders`, `serializeSseEvent` |
| DDD naming ratificato | ✅ DDD-226/DDD-227/DDD-228 | `ToolWorkflowJob`, `ToolWorkflowJobId`, `ToolWorkflowJobStatus` |
| `tool-workflow-job-processor.ts` | ❌ **Da creare** | File non esiste — è il cuore del nuovo sistema |
| `tool-workflow-job-queue.ts` | ❌ **Da creare** | File non esiste |

---

## 3. Architecture Changes

### 3.1 Nuovo flusso FE→BE

```
FE (submit singolo):
  1. POST /api/tools/jobs → riceve { jobId, status: 'queued' }
  2. GET /api/tools/jobs/:jobId/stream → consuma eventi SSE passivamente

BE (processore BullMQ):
  Loop step:
    1. Check cancellazione (Redis flag)
    2. Pubblica step_started
    3. Esegue step (routing per WorkflowStepType)
    4. Pubblica step_completed + artifactId
    5. Serializza progresso (Redis)
```

### 3.2 File new vs modificati vs non toccati

| Categoria | File | Descrizione |
|---|---|---|
| **Nuovo BE** | `tool-workflow-job-processor.ts` | Loop step con routing `WorkflowStepType` |
| **Nuovo BE** | `tool-workflow-job-queue.ts` | Queue/Worker BullMQ setup con graceful shutdown |
| **Nuovo BE** | `tools-job-handlers.ts` | Handler HTTP: submit, status, cancel |
| **Nuovo BE** | `tools-job-stream-handler.ts` | Handler SSE: stream job progress |
| **Nuovo BE** | `worker-entry.ts` | Entry point per worker standalone (Fase 2) |
| **Nuovo FE** | `useToolPageSubmitController.ts` | Sostituisce `useToolPageRunController` via feature flag |
| **Nuovo FE** | `useToolWorkflowJobStream.ts` | Hook SSE via `fetch()` + `ReadableStream` |
| **Nuovi UI** | `ToolWorkflowJobPanel.tsx` | Vista Member: stato, progresso, chunk stream |
| **Nuovi UI** | `ToolWorkflowJobStepTracker.tsx` | Sub-component: lista verticale step |
| **Nuovi UI** | `AdminToolWorkflowJobsPage.tsx` | Vista Admin: Data Table system-wide |
| **Nuovi UI** | `AdminToolWorkflowJobsToolbar.tsx` | Toolbar filtri admin |
| **Nuovo FE** | `useAdminToolWorkflowJobsQuery.ts` | SWR query (Fase 1: stub) |
| **Modificato BE** | `server.ts` | Nuove route, avvio worker in-process |
| **Modificato BE** | `tools-routes.ts` | Registrazione nuove route job |
| **Modificato FE** | `tool-page.machine.ts` | Nuovo stato `submitting`, rimozione auto-chain |
| **Modificato FE** | `tool-page.types.ts` | Nuovi eventi, `pendingJobId` nel context |
| **Modificato FE** | `useToolPage.ts` | Branching feature flag submit vs legacy |
| **Modificato FE** | `ToolPageTemplate.tsx` | Swap condizionale `ToolWorkflowJobPanel` vs `ToolGenerationFlowVertical` |
| **Modificato** | `backend-capabilities.ts` | Nuovo campo `toolsJobSystem: boolean` |
| **Modificato** | `contracts/src/index.ts` | Nuovi tipi: `SubmitJobRequest`, `JobStatusResponse`, `JobProgressEvent` |
| **Modificato FE** | `system.ts` | Nuovo namespace `toolWorkflowJob` |
| **Non toccato** | `generation-system.execution.states.ts` | Invocato single-step dal processore |
| **Non toccato** | `toolWorkflowMachine` | Invariata |
| **Non toccato** | Prompt files | Invariati |
| **Non toccato** | `tools-orchestrate-handlers.ts` | Mantenuto per backward compat |
| **Non toccato** | `useToolPageRunController.ts` | Mantenuto (coesiste), feature-flagged |

---

## 4. Task Breakdown

### Phase 0 — Contracts & Types (0.5 days)

Ground-work: tipi condivisi e feature flag, nessuna dipendenza da codice runtime.

#### Task 0.1 — Nuovi tipi in `packages/contracts/src/index.ts`
- **File**: `packages/contracts/src/index.ts`
- **Action**: Aggiungere export dei tipi:
  ```typescript
  // ToolWorkflowJob contracts (DDD-226, DDD-227, DDD-228)
  export type SubmitJobRequest = {
    toolKey: string;
    projectId: string;
    extractionPayload: Record<string, unknown>;
    model: string;
    intent: 'new' | 'resume' | 'regenerate';
    idempotencyKey: string;
  };

  export type JobStatusResponse = {
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    toolKey: string;
    progress: {
      currentStep: string | null;
      completedSteps: string[];
      stepStatuses: Record<string, 'idle' | 'running' | 'done' | 'error'>;
    };
    result: null | {
      sessionId: string;
      artifactIds: string[];
    };
    createdAt: string;
    updatedAt: string;
  };

  export type JobProgressEvent = {
    type: 'step_started' | 'step_completed' | 'step_failed' | 'workflow_completed' | 'workflow_failed';
    jobId: string;
    timestamp: string;
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
  ```
- **Why**: Tipi condivisi FE↔BE per submit, status polling, e SSE stream. Ispirati ai `JobProgressEvent` già definiti in `job-event-bridge.ts` (prerequisito implementato).
- **Dependencies**: None
- **Risk**: Bassa — tipi additivi, nessuna modifica a tipi esistenti
- **Estimate**: 0.25 days

#### Task 0.2 — Feature flag `BackendCapabilities.toolsJobSystem`
- **File**: `apps/frontend/src/app/runtime/backend-capabilities.ts`
- **Action**:
  1. Aggiungere `toolsJobSystem: boolean;` al tipo `BackendCapabilities`
  2. Aggiungere `toolsJobSystem: readFlag(import.meta.env.VITE_CAP_TOOLS_JOB_SYSTEM, false)` in `readBackendCapabilities()`
  3. Aggiungere `toolsJobSystem: false` in `defaultBackendCapabilities`
  4. Aggiornare `ToolsCapabilities` (Pick) per includere `toolsJobSystem`
- **Why**: Meccanismo canonico di feature flagging FE (MED-04). Il FE instrada tra `submitJob()` (nuovo) e `handlePrimaryAction()` (vecchio) in base a questa flag. L'env `TOOL_WORKFLOW_USE_JOB_SYSTEM` (BE) controlla quali tool key usano il nuovo sistema.
- **Dependencies**: None
- **Risk**: Bassa — campo additivo con fallback `false`
- **Estimate**: 0.25 days

---

### Phase 1 — Backend Core (3.5 days)

Il cuore del sistema: processore, coda BullMQ, handler HTTP, e handler SSE.

#### Task 1.1 — `tool-workflow-job-queue.ts` — Queue/Worker BullMQ setup
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-queue.ts` (NUOVO, ~120 linee)
- **Action**:
  1. Import `Queue`, `Worker`, `JobsOptions` da `bullmq`
  2. Export `createToolWorkflowQueue(redis)` → `new Queue('tool-workflow', { connection: redis })` con `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } }`
  3. Export `createToolWorkflowWorker(queue, processor, redis)` → `new Worker('tool-workflow', processor, { connection: redis, concurrency: 3, limiter: { max: 10, duration: 60000 }, ...defaultJobOptions })`
  4. Export `gracefulShutdown(worker, queue, redis)` → `worker.close()` → `queue.close()` → `redis.quit()`
  5. Log via `createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_QUEUE)` — aggiungere `TOOL_WORKFLOW_JOB_QUEUE` a `log-components.ts`
- **Why**: Incapsula setup BullMQ con rate limiting (10 ToolWorkflowJob/min), retry (3 tentativi, exponential backoff), e graceful shutdown. Separato dal processore per testabilità.
- **Dependencies**: Task 0.1 (tipi contracts)
- **Risk**: Media — primi 2-3 giorni per aggiustare concorrenza/limiter in base al carico reale
- **Estimate**: 0.5 days

#### Task 1.2 — `tool-workflow-job-processor.ts` — Loop step con routing
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` (NUOVO, ~350 linee)
- **Action**:
  1. Definire tipo `ToolWorkflowJobPayload` con `{ toolKey, projectId, extractionPayload, model, intent, userId, idempotencyKey, jobId }`
  2. **Definire `runSingleStepGeneration`**: questa funzione NON esiste come named export oggi — va creata. Invoca `generationSystemMachine` con `createActor`, fornendo `input` con `steps: [stepDescriptor]` (singolo step, stessa logica di `generation-system.execution.states.ts`), extraction context, e dependency artifact IDs. Restituisce `{ artifactId, content }`. Pattern verificato: è la stessa invocazione single-step che oggi avviene via HTTP in `tools-generate-handlers.ts`. La funzione va definita come helper interno al processore o in un modulo separato (`run-generation-step.ts`). **Subtasks**:
      - Creare `createGenerationStepActor(input)` → `createActor(generationSystemMachine, { input }).start()`
      - Attendere completamento: `waitFor(actor, (s) => s.matches('completed'))` o pattern equivalent
      - Estrarre `artifactId` e `content` dallo snapshot finale
  3. Implementare `processToolWorkflowJob(job, { pg, redis })`:
     - **Idempotency check**: claim idempotency key via `postgres-redis.idempotency.repository.ts` (già implementato)
     - **Resolve ToolWorkflowPlan**: `resolveToolWorkflowPlanFromToolKey(toolKey)` da `tool-workflow-registry.ts`
     - **Run extraction**: `runExtractionOnce({ toolKey, projectId, extractionPayload, userId, adapters })` — delega all'extraction flow esistente
     - **Loop step**: per ogni `stepDescriptor` in `plan.steps`:
       - **a. Cancel check**: `redis.get('tool-job-cancel:' + jobId)` — se presente, marca `cancelled`, interrompi loop
       - **b. Publish `step_started`**: via `createJobEventPublisher(redis).publish(...)` (da `job-event-bridge.ts`)
       - **c. Idempotency per-step**: `stepIdempotencyKey = idempotencyKey + ':' + stepDescriptor.key`
       - **d. Resolve dependencies**: `resolveStepDependencyIds(toolKey, stepDescriptor.key, completedStepArtifacts)`
       - **e. Route per WorkflowStepType**:
         ```
         'generation' | 'extraction' | 'acquisition' → runSingleStepGeneration(...)
         'crawling'                              → runCrawlingStep(...)
         'scoring'                               → runScoringStep(...)
         ```
       - **f. Publish `step_completed`**: via event bridge con `artifactId`
       - **g. Serialize progress**: `createJobProgressSerializer(redis).save(jobId, ...)`
     - **Cleanup**: `progressSerializer.clear(jobId)`, release idempotency lock, release single-flight lock
  4. Implementare **`runCrawlingStep`** (wrapper completo, non TODO):
     - Crea una sessione `generationSystemMachine` con routeType `crawlingFlow` (stesso path di `generation-system.execution.states.ts`)
     - Il chain actor (`crawlingChainMachine`) produce un `CrawlArtifact` (ArtifactType `crawl`, DDD-122)
     - Restituisce `{ artifactId, content }`
  5. Implementare **`runScoringStep`** (wrapper completo, non TODO):
     - Crea una sessione `generationSystemMachine` con routeType `scoringFlow`
     - Il chain actor (`scoringChainMachine`) produce uno `ScoringArtifact` (ArtifactType `analysis`, DDD-121/DDD-124)
     - Restituisce `{ artifactId, content }`
  6. Implementare **`runExtractionOnce`**: esegue extraction una volta sola (non per-step), cache del risultato
  7. **Single-flight guard release**: al completamento/failure/cancel del job, rilasciare il Redis lock `tool-job-active:{userId}:{projectId}:{toolKey}`
- **Why**: Cuore del nuovo sistema. Routing esplicito per WorkflowStepType chiude CRIT-03. Idempotency per-step chiude CRIT-01. Cancel check tra step chiude CRIT-02. Wrapper crawling/scoring implementati completamente (non TODO) per supportare il tool `geometric`.
- **Dependencies**: Task 1.1 (queue), task 0.1 (tipi)
- **Risk**: Alta — è il componente più complesso. Il loop deve gestire correttamente: idempotency per-step, cancel check, serializzazione progresso, routing per WorkflowStepType, error propagation, e single-flight guard release.
- **Estimate**: 2 days

#### Task 1.3 — `tools-job-handlers.ts` — Handler HTTP submit/status/cancel
- **File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-job-handlers.ts` (NUOVO, ~250 linee)
- **Action**:
  1. Import `createToolWorkflowQueue` da `tool-workflow-job-queue.ts`
  2. Implementare **`handleSubmitJob`** (`POST /api/tools/jobs`):
     - Validazione payload con Zod: `SubmitJobRequest` schema (da `packages/contracts`)
     - Auth middleware (esistente, riusato da `tools-handlers.ts`)
     - Project ownership check (esistente, riusato da `tools-orchestrate-handlers.ts`)
     - ToolKey supportato: `isSupportedToolWorkflow(toolKey)`
     - **Single-flight guard**: Redis `SET NX EX` su chiave `tool-job-active:{userId}:{projectId}:{toolKey}` con TTL 900s. Se lock esiste → `409 Conflict` con `{ jobId: existingJobId, message: 'A ToolWorkflowJob is already active for this scope' }`
     - Idempotency check: se `idempotencyKey` già processato → restituisce il `ToolWorkflowJob` esistente (200 con `jobId`)
     - Rate limit / quota check (riusa `postgres-redis.usage.repository.ts`)
     - Accoda su BullMQ: `queue.add('tool-workflow', payload, { jobId: generatedJobId })`
     - Restituisce `{ jobId, status: 'queued', toolKey, workflowType, totalSteps, queuedAt }`
  3. Implementare **`handleGetJobStatus`** (`GET /api/tools/jobs/:jobId`):
     - Legge stato da Redis hash `tool-job:{jobId}`
     - Se non trovato → `404 Not Found` (TTL scaduto o jobId inesistente)
     - Restituisce `JobStatusResponse`
  4. Implementare **`handleCancelJob`** (`POST /api/tools/jobs/:jobId/cancel`):
     - Auth + ownership check (stesso `userId` che ha creato il ToolWorkflowJob, o admin)
     - Imposta flag Redis: `SET tool-job-cancel:{jobId} 'true' EX 86400`
     - Risposta immediata `202 Accepted` — la cancellazione è asincrona
  5. Implementare **`handleListJobs`** (`GET /api/tools/jobs`) — endpoint admin:
     - Query parameters: `userId`, `toolKey`, `status`, `projectId`
     - **Fase 1**: itera chiavi Redis `tool-job:*` e filtra (non performante, solo admin)
     - **Fase 2**: sostituito da query Postgres su tabella `tool_jobs`
- **Why**: Endpoint REST per submit, status polling, e cancellazione. Single-flight guard al submit-time chiude HIGH-01. Cancel endpoint chiude CRIT-02 (flag Redis, non abort mid-invoke).
- **Dependencies**: Task 1.1 (queue), task 1.2 (processore per comprendere payload shape), task 0.1 (tipi contracts)
- **Risk**: Media — validazione Zod + auth/ownership + idempotency + single-flight devono funzionare insieme senza race condition
- **Estimate**: 0.75 days

#### Task 1.4 — `tools-job-stream-handler.ts` — Handler SSE
- **File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-job-stream-handler.ts` (NUOVO, ~120 linee)
- **Action**:
  1. Import `applySseHeaders`, `serializeSseEvent` da `http-sse.ts` / `stream-contract.ts`
  2. Import `subscribeToJobEvents` da `job-event-bridge.ts` (prerequisito implementato)
  3. Implementare **`handleJobStream`** (`GET /api/tools/jobs/:jobId/stream`):
     - Auth via header `Authorization: Bearer <token>` (stesso middleware esistente)
     - `applySseHeaders(response)`
     - Crea subscriber Redis dedicato: `new Redis(REDIS_URL)`
     - `subscribeToJobEvents(subscriber, jobId, callback)`:
       - Callback mappa `JobProgressEvent` → frame SSE:
         - `step_started` / `step_completed` / `step_failed` → `event: progress` con `{ step, status, artifactId? }`
         - `workflow_completed` / `workflow_failed` → `event: terminal` con `{ status, artifacts?, sessionId? }`
       - Scrive frame via `response.write(frame)`
     - Heartbeat: `setInterval` ogni 30s invia `:keepalive\n\n` (commento SSE, ignorato dal parser)
     - Cleanup su disconnect: `response.on('close', () => { unsubscribe(); subscriber.quit(); clearInterval(heartbeat); })`
     - Timeout massimo: 30 minuti (dopo chiude lo stream)
  4. **Fallback in-process (Fase 1)**: se la proposal indica worker in-process, si può usare `EventEmitter` condiviso tra processore e handler invece di Redis pub/sub. L'interfaccia `subscribeToJobEvents` è la stessa — swap dell'implementazione sotto. Il pattern attuale usa Redis pub/sub (prerequisito già implementato) → usiamo quello.
- **Why**: SSE stream per aggiornamenti real-time. Riutilizza l'infrastruttura SSE esistente. Event bridge (Redis pub/sub) già implementato come prerequisito.
- **Dependencies**: Task 1.2 (processore pubblica eventi), `job-event-bridge.ts` (prerequisito implementato)
- **Risk**: Bassa — pattern SSE già rodato in produzione (`generation-stream-replay.ts`, `http-sse.ts`)
- **Estimate**: 0.5 days

#### Task 1.5 — `worker-entry.ts` — Entry point standalone
- **File**: `apps/backend/src/worker-entry.ts` (NUOVO, ~50 linee)
- **Action**:
  ```typescript
  import Redis from 'ioredis';
  import { Pool } from 'pg';
  import { createToolWorkflowWorker, createToolWorkflowQueue, gracefulShutdown } from './lib/runtime/tool-workflow-job-queue';
  import { processToolWorkflowJob } from './lib/runtime/tool-workflow-job-processor';

  const redis = new Redis(process.env.REDIS_URL!);
  const pg = new Pool({ connectionString: process.env.DATABASE_URL! });
  const queue = createToolWorkflowQueue(redis);
  const worker = createToolWorkflowWorker(queue, (job) => processToolWorkflowJob(job, { pg, redis }), redis);

  process.on('SIGTERM', () => { void gracefulShutdown(worker, queue, redis).finally(() => process.exit(0)); });
  process.on('SIGINT', () => { void gracefulShutdown(worker, queue, redis).finally(() => process.exit(0)); });
  ```
- **Why**: Entry point per worker standalone (Fase 2 deployment separato). In Fase 1, il worker gira in-process dentro `server.ts` (`TOOL_WORKFLOW_WORKER_IN_PROCESS=true`). Questo file è pronto per il deployment separato.
- **Dependencies**: Task 1.1, task 1.2
- **Risk**: Bassa — file semplice, per lo più boilerplate
- **Estimate**: 0.25 days

#### Task 1.6 — `server.ts` — Nuove route e worker in-process
- **File**: `apps/backend/src/server.ts` (MODIFICA, ~30 linee aggiunte)
- **Action**:
  1. Import handler da `tools-job-handlers.ts` e `tools-job-stream-handler.ts`
  2. Import `createToolWorkflowQueue`, `createToolWorkflowWorker`, `gracefulShutdown` da `tool-workflow-job-queue.ts`
  3. Aggiungere registrazione route in `tools-routes.ts` (vedi Task 1.7)
  4. Avvio worker in-process condizionale:
     ```typescript
     const workerInProcess = parseBooleanEnv(process.env.TOOL_WORKFLOW_WORKER_IN_PROCESS, true);
     if (workerInProcess) {
       const toolWorkflowQueue = createToolWorkflowQueue(redis);
       const toolWorkflowWorker = createToolWorkflowWorker(
         toolWorkflowQueue,
         (job) => processToolWorkflowJob(job, { pg, redis }),
         redis,
       );
       // Aggiungi cleanup in closeAll():
       // await toolWorkflowWorker.close();
       // await toolWorkflowQueue.close();
     }
     ```
  5. Aggiungere `queue.close()` e `worker.close()` nella funzione `closeAll()` esistente (dopo `server.close()`)
- **Why**: Integrazione minimal-invasiva. Il worker in-process è il default per Fase 1 (stesso container Railway, stesso processo Node). Il flag `TOOL_WORKFLOW_WORKER_IN_PROCESS=false` disabilita il worker in-process per Fase 2 (deployment separato).
- **Dependencies**: Task 1.1, 1.2, 1.3, 1.4, 1.5
- **Risk**: Media — graceful shutdown deve chiudere worker e queue prima di `redis.quit()` per evitare perdita di job in-flight
- **Estimate**: 0.25 days

#### Task 1.7 — `tools-routes.ts` — Registrazione nuove route
- **File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts` (MODIFICA, ~40 linee aggiunte)
- **Action**: Aggiungere route entries:
  ```typescript
  // Nuove route per ToolWorkflowJob system (DDD-226)
  { method: 'POST', pattern: '/api/tools/jobs', handler: toolsHandlers.handleSubmitJob },
  { method: 'GET',  pattern: '/api/tools/jobs', handler: toolsHandlers.handleListJobs },
  { method: 'GET',  pattern: /^\/api\/tools\/jobs\/([^/]+)$/,
    handler: (req, res, jobId) => toolsHandlers.handleGetJobStatus(req, res, decodeURIComponent(jobId ?? '')) },
  { method: 'POST', pattern: /^\/api\/tools\/jobs\/([^/]+)\/cancel$/,
    handler: (req, res, jobId) => toolsHandlers.handleCancelJob(req, res, decodeURIComponent(jobId ?? '')) },
  { method: 'GET',  pattern: /^\/api\/tools\/jobs\/([^/]+)\/stream$/,
    handler: (req, res, jobId) => toolsHandlers.handleJobStream(req, res, decodeURIComponent(jobId ?? '')) },
  ```
- **Important**: Le route `/jobs` (string literal) DEVONO precedere le route regex `/jobs/([^/]+)` per evitare che il router catturi `GET /jobs` con il pattern parametrico.
- **Why**: Registrazione standard nel pattern route table esistente. Le route job sono aggiunte prima delle route asset per priorità di match.
- **Dependencies**: Task 1.3, 1.4 (handler devono esistere)
- **Risk**: Bassa — pattern identico alle route esistenti
- **Estimate**: 0.25 days

---

### Phase 2 — Frontend Core (3 days)

Nuovo controller di submit, hook SSE, e modifiche alla macchina a stati.

#### Task 2.1 — `tool-page.types.ts` — Nuovi eventi e `pendingJobId`
- **File**: `apps/frontend/src/features/tools/machines/tool-page.types.ts` (MODIFICA, ~25 linee)
- **Action**:
  1. Aggiungere `pendingJobId: string | null;` a `ToolPageContext`
  2. Aggiungere nuovi eventi a `ToolPageEvent`:
     ```typescript
     | { type: 'SUBMIT_JOB'; jobId: string }
     | { type: 'JOB_PROGRESS'; step: string; status: 'running' | 'done' | 'error'; artifactId?: string }
     | { type: 'JOB_COMPLETED'; sessionId: string; artifactIds: string[] }
     | { type: 'JOB_FAILED'; reason: string }
     | { type: 'JOB_CANCELLED' }
     ```
  3. **Rimuovere** da `ToolPageEvent` (non più usati nel nuovo path):
     - `REQUEST_STEP_START` — rimosso dal tipo (non più dispatchato). Nota: la macchina lo usa ancora nel path legacy `generating`, quindi va mantenuto nella macchina ma non nel nuovo path.
     - `STEP_REQUEST_DISPATCHED` — idem, mantenuto per backward compat nel path legacy
     - `STEP_DONE`, `STEP_FAILED`, `RETRY_STEP` — rimossi solo dal nuovo path `submitting`/`running`. Mantenuti nel tipo per il path legacy `generating`.
  4. **Mantenere** `PROGRESS_SYNCED` — invariato, usato per hydration/resume (GAP-FE-06)
- **Why**: Estensione minimale del tipo esistente. Gli eventi legacy restano nel tipo per backward compat. `pendingJobId` sostituisce `runRequestPrefix` nel nuovo path (GAP-FE-03).
- **Dependencies**: None
- **Risk**: Bassa — tipi additivi
- **Estimate**: 0.25 days

#### Task 2.2 — `tool-page.machine.ts` — Nuovo stato `submitting`, rimozione auto-chain
- **File**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (MODIFICA, ~80 linee modificate/aggiunte)
- **Action**:
  1. **Nuovo stato `submitting`**: aggiunto come stato top-level (fratello di `configuring`, `generating`, ecc.)
     ```
     submitting: {
       on: {
         JOB_FAILED: {
           target: 'configuring.generationFailed',
           actions: assign({ errorMessage: ({ event }) => event.reason }),
         },
         CANCEL_GENERATION: {
           target: 'configuring.clean',
           actions: ['resetConfig', stopChild('briefingActor')],
         },
       },
     },
     ```
  2. **Nuovo stato `running`**: aggiunto come stato top-level (passivo, consuma SSE)
     ```
     running: {
       entry: assign({ pendingJobId: ({ event }) => ... }), // popolato da SUBMIT_JOB
       on: {
         JOB_PROGRESS: {
           actions: 'syncJobProgress', // nuova action
         },
         JOB_COMPLETED: {
           target: 'completed',
           actions: ['clearError'],
         },
         JOB_FAILED: {
           target: 'configuring.generationFailed',
           actions: assign({ errorMessage: ({ event }) => event.reason }),
         },
         JOB_CANCELLED: {
           target: 'configuring.clean',
           actions: ['resetConfig', stopChild('briefingActor')],
         },
         CANCEL_GENERATION: {
           target: 'configuring.clean',
           actions: ['resetConfig', stopChild('briefingActor')],
         },
       },
     },
     ```
  3. **Nuova transition**: da `configuring` a `submitting` su evento `SUBMIT_JOB`:
     ```
     SUBMIT_JOB: {
       guard: 'canStartGeneration', // stessa guard esistente
       target: 'submitting',
       actions: ['clearError'],
     },
     ```
  4. **Nuova action `syncJobProgress`**: popola `context.progress` da `JOB_PROGRESS`:
     - `status: 'running'` → non modifica `completedSteps`, imposta `currentRunningStep` (o un nuovo campo nel progress state)
     - `status: 'done'` → aggiunge step a `completedSteps`, popola `latestArtifactByStep` con artifact parziale (`artifactId` popolato, `content`/`format`/`type` `undefined` — vedi GAP-FE-02)
     - `status: 'error'` → marca step come errore (non blocca il flusso, il BE gestisce retry)
  5. **Rimozione parziale auto-chain**: il path legacy `generating` con `invoke: generationLifecycleMachine` RESTA invariato. Il nuovo path `submitting` → `running` NON invoca `generationLifecycleMachine`. Le azioni `forwardStepOutcomeToLifecycle` e `controlGenerationLifecycle` restano definite ma non sono referenziate dal nuovo path.
  6. **Nuovo campo context**: `pendingJobId: null` nell'inizializzazione context
  7. **Guards invariati**: `canStartGeneration` e `canCancelGeneration` restano identici
- **Why**: La macchina guadagna un path BE-driven senza rompere il path legacy FE-driven. Feature flag a livello di `useToolPage.ts` decide quale path usare. `generationLifecycleMachine` non è invocata nel nuovo path (GAP-FE-01).
- **Dependencies**: Task 2.1 (tipi)
- **Risk**: Media — la macchina a stati è complessa. Le transizioni devono essere corrette per entrambi i path (legacy e nuovo). Test esistenti (Category A) devono continuare a passare.
- **Estimate**: 1 day

#### Task 2.3 — `useToolWorkflowJobStream.ts` — Hook SSE
- **File**: `apps/frontend/src/features/tools/runtime/useToolWorkflowJobStream.ts` (NUOVO, ~150 linee)
- **Action**:
  1. Implementare hook che accetta `{ jobId, auth, toolPageSend, enabled }`:
     ```typescript
     export const useToolWorkflowJobStream = ({ jobId, auth, toolPageSend, enabled }: UseToolWorkflowJobStreamArgs) => {
       useEffect(() => {
         if (!enabled || !jobId) return;
         const abortController = new AbortController();
         let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

         const connect = async () => {
           const response = await fetch(`/api/tools/jobs/${jobId}/stream`, {
             headers: { 'Authorization': `Bearer ${auth.token}` },
             signal: abortController.signal,
           });
           if (!response.ok) throw new Error(`SSE connection failed: ${response.status}`);
           reader = response.body!.getReader();
           const decoder = new TextDecoder();
           let buffer = '';

           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             buffer += decoder.decode(value, { stream: true });
             // Parse SSE frames: split su '\n\n', parse 'event:'/'data:' lines
             const frames = buffer.split('\n\n');
             buffer = frames.pop() ?? ''; // ultimo frame incompleto
             for (const frame of frames) {
               const eventType = frame.match(/^event: (.+)$/m)?.[1];
               const dataLine = frame.match(/^data: (.+)$/m)?.[1];
               if (!eventType || !dataLine) continue;
               const data = JSON.parse(dataLine);
               switch (eventType) {
                 case 'progress':
                   toolPageSend({ type: 'JOB_PROGRESS', step: data.step, status: data.status, artifactId: data.artifactId });
                   break;
                 case 'terminal':
                   if (data.status === 'completed') toolPageSend({ type: 'JOB_COMPLETED', sessionId: data.result?.sessionId, artifactIds: data.result?.artifactIds ?? [] });
                   else toolPageSend({ type: 'JOB_FAILED', reason: data.reason ?? 'Job failed' });
                   break;
               }
             }
           }
         };

         connect().catch((err) => {
           if (err.name !== 'AbortError') toolPageSend({ type: 'JOB_FAILED', reason: String(err) });
         });

         return () => { abortController.abort(); reader?.cancel(); };
       }, [jobId, enabled]);
     };
     ```
2. **SessionStorage resume (HIGH-02)**: `useToolPageSubmitController` persiste `jobId` in `sessionStorage` con chiave `tool-job:{projectId}:{toolKey}` al submit (linea 543 del controller). `useToolWorkflowJobStream` lo legge al mount: se esiste un `jobId` in `sessionStorage` per lo scope corrente, il FE chiama `GET /api/tools/jobs/:jobId` per recuperare lo stato e si riconnette allo stream. Se il job è già `completed`/`failed`/`cancelled`, dispatcha l'evento terminale senza connettere lo stream. Il `jobId` viene rimosso da `sessionStorage` quando il job raggiunge uno stato terminale.
   3. **Race condition SSE vs submit (mitigazione)**: il FE chiama `POST /api/tools/jobs` e subito dopo si connette allo stream SSE. Se il processore completa istantaneamente (tool single-step), il FE potrebbe connettersi dopo che gli eventi sono già stati emessi dal bridge Redis pub/sub. **Mitigazione**: prima di connettere lo stream, il FE chiama sempre `GET /api/tools/jobs/:jobId` una volta. Se lo stato è già `completed`/`failed`/`cancelled`, dispatcha l'evento terminale corrispondente (saltando la connessione SSE). Se lo stato è `queued`/`running`, procede con la connessione SSE. Questo poll iniziale è idempotente e copre il race window.
   4. **Non usare `EventSource`**: usa `fetch()` + `ReadableStream` per supportare header auth nativi (GAP-FE-04)
- **Why**: Consumatore SSE passivo. Sostituisce ~200 linee di `useLayoutEffect` bridge in `useToolPageRunController.ts` con ~150 linee di parsing SSE semplice. Pattern `fetch()` + `ReadableStream` già usato in produzione per generazione stream.
- **Dependencies**: Task 2.2 (eventi `JOB_PROGRESS`, `JOB_COMPLETED`, `JOB_FAILED` nella macchina)
- **Risk**: Bassa — pattern SSE già rodato, parsing manuale ma semplice
- **Estimate**: 0.75 days

#### Task 2.4 — `useToolPageSubmitController.ts` — Controller submit
- **File**: `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.ts` (NUOVO, ~180 linee)
- **Action**:
  1. Implementare hook che espone `submitJob` e `handleCancelGeneration`:
     ```typescript
     export const useToolPageSubmitController = ({
       auth, toolKey, formState, intent, machineViewModel, readinessSnapshot,
       briefingSnapshot, machineHydrationResult, workspaceExtractionContext,
       effectiveBriefingFileName, resolvedBriefingId, resolvedNotes,
       resolvedRelaunchSource, sourceArtifact, sourceArtifactId, sourceStep,
       selectedAssetIds, hasAssetBasedExtractionContext, toolPageSend, sessionId,
     }: UseToolPageSubmitControllerArgs) => {
       // Costruisce SubmitJobRequest
       const buildSubmitRequest = useCallback((): SubmitJobRequest => {
         const extractionPayload = selectGenerationExtractionInfo({ ... });
         const idempotencyKey = generateRequestId(); // UUID stabile per questo submit
         return {
           toolKey,
           projectId: formState.projectId,
           extractionPayload,
           model: formState.model,
           intent,
           idempotencyKey,
         };
       }, [...]);

       // Chiama POST /api/tools/jobs
       const submitJob = useCallback(async () => {
         toolPageSend({ type: 'SUBMIT_JOB' });
         const request = buildSubmitRequest();
         const response = await fetch('/api/tools/jobs', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
           body: JSON.stringify(request),
         });
         if (!response.ok) {
           const error = await response.json().catch(() => ({ message: 'Submit failed' }));
           toolPageSend({ type: 'JOB_FAILED', reason: error.message ?? 'Submit failed' });
           return;
         }
         const { jobId } = await response.json();
         // Persisti in sessionStorage per resume
         sessionStorage.setItem(`tool-job:${formState.projectId}:${toolKey}`, jobId);
         // Il FE ora si connette allo stream — la transizione a 'running' avviene quando lo stream inizia
       }, [...]);

       const handleCancelGeneration = useCallback(() => {
         // POST /api/tools/jobs/:jobId/cancel + abort SSE
       }, []);

       return { submitJob, handleCancelGeneration, ... };
     };
     ```
  2. Riutilizza selettori esistenti da `tool-page-selectors.ts`:
     - `selectGenerationExtractionInfo` — invariato
     - `buildGeometricDirectInputExtractionInfo` — invariato
     - `buildYoutubeDescriptionDirectInputExtractionInfo` — invariato
  3. **Non riutilizza** `orchestrateToolStep` — non più necessario (BE risolve dipendenze internamente)
  4. **Non riutilizza** `buildBaseGenerationRequest` — sostituito da `buildSubmitRequest` che produce `SubmitJobRequest`
- **Why**: Sostituisce l'intero bridge `useToolPageRunController` (519 linee) con un controller submit semplice (~200 linee). La complessità di auto-chain, `pendingStepStart`, `inFlightStepsRef`, `isAutoChainEnabled` è tutta rimossa.
- **Dependencies**: Task 2.1 (tipi), task 0.2 (feature flag per sapere se chiamare submit o legacy)
- **Risk**: Media — deve riprodurre correttamente la logica di costruzione del payload (extraction info, asset ids, campaign objective, ecc.) che oggi è sparsa in `useToolPageRunController`
- **Estimate**: 1 day

#### Task 2.5 — `useToolPage.ts` — Branching feature flag
- **File**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` (MODIFICA, ~50 linee)
- **Action**:
  1. Import `useToolPageSubmitController` e `useToolWorkflowJobStream`
  2. Leggere feature flag:
     ```typescript
     const useJobSystem = auth.capabilities.toolsJobSystem === true && isSupportedToolWorkflow(toolKey);
     ```
  3. Branching condizionale:
     - Se `useJobSystem === true`: usa `useToolPageSubmitController` + `useToolWorkflowJobStream`
     - Se `useJobSystem === false`: usa `useToolPageRunController` (esistente, invariato)
  4. Il valore di ritorno pubblico di `useToolPage` resta identico — `handlePrimaryAction`, `handleCancelGeneration`, `dispatchError`, `completedStepsForFlow`, ecc. devono essere popolati da entrambi i path
- **Why**: Feature flag pulito. Zero breaking change per i consumer di `useToolPage`. I tool non migrati continuano col vecchio path.
- **Dependencies**: Task 2.3, 2.4, task 0.2 (feature flag)
- **Risk**: Media — il branching deve essere seamless per i consumer. I test esistenti di `useToolPage` (Category B) devono essere riscritti per coprire entrambi i path.
- **Estimate**: 0.5 days

---

### Phase 3 — Frontend UI Components (2 days)

Nuovi componenti per visualizzare ToolWorkflowJob progress (Member view) e admin dashboard (Admin view).

#### Task 3.1 — `ToolWorkflowJobStepTracker.tsx` — Tracker step verticale
- **File**: `apps/frontend/src/features/tools/ui/ToolWorkflowJobStepTracker.tsx` (NUOVO, ~120 linee)
- **Action**:
  1. Component che riceve `{ steps: Array<{ key: string; label: string; status: 'idle' | 'running' | 'done' | 'error' }> }`
  2. Renderizza lista verticale con:
     - **idle**: cerchio vuoto grigio (`aria-label="Step {label}: waiting"`)
     - **running**: cerchio pulsante blu (`aria-current="step"`)
     - **done**: checkmark verde (`aria-label="Step {label}: completed"`)
     - **error**: X rossa (`aria-label="Step {label}: failed"`)
  3. Label da `appCopy.ui.toolWorkflowJob.steps[stepKey]` (mai hardcoded)
  4. Responsive: mobile collassa a stepper orizzontale a punti numerati
  5. Accessibilità: `aria-live="polite"` sul container, `role="status"` sullo step corrente
- **Why**: Sub-component puramente presentazionale. Riutilizza la stessa computazione `stepItems` di `ToolPageTemplate` (righe 221-231), alimentata da `JOB_PROGRESS` invece che da `PROGRESS_SYNCED`.
- **Dependencies**: Task 3.4 (namespace copy)
- **Risk**: Bassa — puramente presentazionale
- **Estimate**: 0.5 days

#### Task 3.2 — `ToolWorkflowJobPanel.tsx` — Pannello Member
- **File**: `apps/frontend/src/features/tools/ui/ToolWorkflowJobPanel.tsx` (NUOVO, ~150 linee)
- **Action**:
  1. Component che riceve `{ jobId, toolKey, stepStatuses, currentRunningStep, completedSteps, errorMessage, isStreamActive }`
  2. Layout:
     - Header: `StatusBadge` (queued=neutral, running=info, completed=success, failed=error, cancelled=warning)
     - Body: `ToolWorkflowJobStepTracker` con step statuses
     - Footer: streaming content area (chunk stream visibile) + cancel button (solo se `running`)
  3. Accessibilità:
     - `aria-live="polite"` su messaggi di stato
     - `role="alert"` su errori
     - Focus management: dopo submit → focus su heading del pannello
  4. Sostituisce `ToolGenerationFlowVertical` nella colonna destra di `ToolPageTemplate` quando `pendingJobId !== null`
  5. Nessuna modifica al layout grid a due colonne
- **Why**: Vista Member per monitorare ToolWorkflowJob in corso. Design specificato nella proposal (Sezione "Frontend UI Design").
- **Dependencies**: Task 3.1 (step tracker), task 3.4 (namespace copy)
- **Risk**: Bassa — puramente presentazionale
- **Estimate**: 0.5 days

#### Task 3.3 — `AdminToolWorkflowJobsPage.tsx` + `AdminToolWorkflowJobsToolbar.tsx` — Vista Admin
- **File**: `apps/frontend/src/features/admin/pages/AdminToolWorkflowJobsPage.tsx` (NUOVO, ~180 linee)
- **File**: `apps/frontend/src/features/admin/ui/AdminToolWorkflowJobsToolbar.tsx` (NUOVO, ~80 linee)
- **Action**:
  1. **`AdminToolWorkflowJobsPage`**:
     - Layout standard: `AdminPageContainer` + `ListingTableSection`
     - Colonne Data Table: `jobId`, `status` (StatusBadge), `toolKey`, `projectId`, `userId`, `progress` (N/M), `createdAt`, `actions` (Inspect/Cancel/Retry via bordered-chip)
     - Usa `useAdminToolWorkflowJobsQuery` (Task 3.5 — stub in Fase 1, dati mock o polling `GET /api/tools/jobs`)
  2. **`AdminToolWorkflowJobsToolbar`**:
     - Filtri: Status (select), Tool (select), User (autocomplete — Fase 2 stub)
  3. **Routing**: nuova voce "Tool Jobs" nella nav admin, route `/admin/tool-jobs`, posizionata dopo "Sessions"
- **Why**: Vista Admin per monitoring system-wide dei ToolWorkflowJob (proposal Sezione "Frontend UI Design").
- **Dependencies**: Task 3.4 (copy), task 3.5 (hook query), route admin esistente per pattern
- **Risk**: Bassa — pattern Data Table già usato per Sessions, Feedback, ecc.
- **Estimate**: 0.5 days

#### Task 3.4 — `system.ts` — Namespace `toolWorkflowJob`
- **File**: `apps/frontend/src/app/copy/system.ts` (MODIFICA, ~40 linee aggiunte)
- **Action**: Aggiungere nuovo namespace `toolWorkflowJob` dentro `appCopy.ui`:
  ```typescript
  toolWorkflowJob: {
    status: {
      queued: 'Queued',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
    stepTracker: {
      idle: 'Waiting',
      running: 'Generating...',
      done: 'Completed',
      error: 'Error',
    },
    cancel: {
      label: 'Cancel',
      confirming: 'Cancelling...',
      success: 'Job cancelled',
    },
    stream: {
      connectionLost: 'Connection lost. Reconnecting...',
      reconnected: 'Reconnected',
    },
    admin: {
      pageTitle: 'Tool Jobs',
      tableJobId: 'Job ID',
      tableStatus: 'Status',
      tableTool: 'Tool',
      tableProject: 'Project',
      tableUser: 'User',
      tableProgress: 'Progress',
      tableCreated: 'Created',
      actionInspect: 'Inspect',
      actionCancel: 'Cancel',
      actionRetry: 'Retry',
    },
  },
  ```
- **Why**: Copia centralizzata, mai hardcoded nei componenti. Segue il pattern esistente di `appCopy.ui.session`, `appCopy.ui.badges`, ecc.
- **Dependencies**: None
- **Risk**: Bassa — solo stringhe
- **Estimate**: 0.25 days

#### Task 3.5 — `useAdminToolWorkflowJobsQuery.ts` — Hook Admin (stub Fase 1)
- **File**: `apps/frontend/src/features/admin/runtime/useAdminToolWorkflowJobsQuery.ts` (NUOVO, ~50 linee)
- **Action**: Stub SWR hook che restituisce `{ data: [], loading: false, error: null }`. In Fase 2, chiamerà `GET /api/tools/jobs` con i filtri.
- **Why**: Placeholder per non bloccare lo sviluppo UI Admin. La Data Table si monta con dati vuoti.
- **Dependencies**: None
- **Risk**: Bassa
- **Estimate**: 0.25 days

#### Task 3.6 — `ToolPageTemplate.tsx` — Swap condizionale
- **File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` (MODIFICA, ~30 linee)
- **Action**:
  1. Import `ToolWorkflowJobPanel` e `useToolWorkflowJobStream`
  2. Leggere `pendingJobId` dal context macchina o dal hook `useToolPage`
  3. Condizionale nel render:
     ```tsx
     {pendingJobId ? (
       <ToolWorkflowJobPanel jobId={pendingJobId} toolKey={toolKey} ... />
     ) : (
       <ToolGenerationFlowVertical ... />
     )}
     ```
  4. Il CTA primario chiama `handlePrimaryAction` che internamente (via `useToolPage`) decide se chiamare `submitJob()` o il path legacy
- **Why**: Swap minimale. Il resto del layout (Setup Panel a sinistra, form fields, briefing upload) resta identico.
- **Dependencies**: Task 3.2, task 2.5
- **Risk**: Bassa — cambio condizionale semplice
- **Estimate**: 0.25 days

---

### Phase 4 — Testing (3 days)

Test BE (4 nuovi file) + test FE (6 nuovi/estesi).

#### Task 4.1 — BE-GATE-D01 — Idempotency per-step test
- **File**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (NUOVO)
- **Action**: Test che verifica:
  1. Il processore deriva `idempotencyKey:stepKey` per ogni step
  2. Step 2 non viene bloccato come duplicato dal lock Redis di step 1
  3. Chiamata a `runSingleStepGeneration` con `idempotencyKey` diverso per ogni step
- **AC coperto**: AC-012
- **Estimate**: 0.25 days

#### Task 4.2 — BE-GATE-D02 — Routing WorkflowStepType test
- **File**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (estende D01)
- **Action**: Test end-to-end su `geometric`:
  1. Mock di `runCrawlingStep`, `runScoringStep`, `runSingleStepGeneration`
  2. Assert che `serp-crawling` chiami `runCrawlingStep`
  3. Assert che `competitor-scoring` chiami `runScoringStep`
  4. Assert che `strategic-reporting` e `unified-report` chiamino `runSingleStepGeneration`
- **AC coperto**: AC-014
- **Estimate**: 0.25 days

#### Task 4.3 — BE-GATE-D03 — Cancellazione test
- **File**: `apps/backend/src/lib/tests/runtime.tools-job-handlers.test.ts` (NUOVO)
- **Action**: Test che verifica:
  1. `POST /api/tools/jobs/:jobId/cancel` setta flag Redis `tool-job-cancel:{jobId}`
  2. Processore rileva flag al boundary tra step e non avvia step successivo
  3. ToolWorkflowJob transita a `status: 'cancelled'`
  4. Artifact degli step completati restano persistiti (nessun rollback)
  5. Step in corso al momento della cancel request completa normalmente (non abortito mid-invoke)
- **AC coperto**: AC-013
- **Estimate**: 0.5 days

#### Task 4.4 — BE-GATE-D04 — Single-flight guard test
- **File**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-queue.test.ts` (NUOVO)
- **Action**: Test che verifica:
  1. Submit ToolWorkflowJob → lock Redis `tool-job-active:{userId}:{projectId}:{toolKey}` acquisito
  2. Secondo submit concorrente stesso scope → `409 Conflict` con `jobId` del ToolWorkflowJob attivo
  3. Dopo completamento primo ToolWorkflowJob → lock rilasciato → terzo submit ha successo
- **AC coperto**: AC-015
- **Estimate**: 0.25 days

#### Task 4.5 — FE-GATE-D01 — `useToolWorkflowJobStream` test
- **File**: `apps/frontend/src/features/tools/runtime/useToolWorkflowJobStream.test.ts` (NUOVO)
- **Action**: Test hook con MSW:
  1. Connessione `fetch()` con `Authorization` header
  2. Evento SSE `progress` con `{ step, status: 'running' }` → dispatch `JOB_PROGRESS`
  3. Evento SSE `progress` con `{ step, status: 'done', artifactId }` → dispatch `JOB_PROGRESS` con artifactId
  4. Evento SSE `terminal` con `{ status: 'completed', artifacts }` → dispatch `JOB_COMPLETED`
  5. Evento SSE `terminal` con `{ status: 'failed', reason }` → dispatch `JOB_FAILED`
  6. Unmount → `AbortController.abort()` chiamato
  7. Resume da `sessionStorage` jobId
- **Estimate**: 0.5 days

#### Task 4.6 — FE-GATE-D02 — `useToolPageSubmitController` test
- **File**: `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.test.ts` (NUOVO)
- **Action**: Test hook con MSW:
  1. `submitJob` chiama `POST /api/tools/jobs` con payload corretto
  2. Restituisce `{ jobId }` su successo
  3. Dispatches `JOB_FAILED` su HTTP error
  4. Rifiuta submit quando `projectId` è vuoto
  5. `idempotencyKey` è un UUID stabile (non rigenerato a ogni chiamata)
  6. Persiste `jobId` in `sessionStorage`
- **Estimate**: 0.25 days

#### Task 4.7 — FE-GATE-D03 — Macchina transizioni test
- **File**: `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` (MODIFICA — estendi file esistente)
- **Action**: Nuovi test case:
  1. `SUBMIT_JOB` da `configuring` con readiness valida → `submitting`
  2. `SUBMIT_JOB` con readiness invalida → rejected da guard `canStartGeneration`
  3. `SUBMIT_JOB` mentre già `submitting` o `running` → rejected
  4. `JOB_PROGRESS { step, status: 'running' }` da `running` → context aggiornato
  5. `JOB_PROGRESS { step, status: 'done' }` da `running` → step aggiunto a `completedSteps`
  6. `JOB_COMPLETED` da `running` → `completed`
  7. `JOB_FAILED` da `running` o `submitting` → `configuring.generationFailed`
  8. `CANCEL_GENERATION` da `submitting` o `running` → `configuring.clean`
- **Note**: I test Category A esistenti DEVONO continuare a passare. I test Category B esistenti (che testano `START_GENERATION` → `generating`) restano validi per il path legacy.
- **Estimate**: 0.5 days

#### Task 4.8 — FE-GATE-D04 — `submitJob` client test
- **File**: `apps/frontend/src/features/tools/runtime/tools-client.test.ts` (MODIFICA — estendi file esistente)
- **Action**: Nuovi test case (sostituiscono il describe block `orchestrateToolStep`):
  1. `submitJob` restituisce `{ jobId, status: 'queued', totalSteps }` su HTTP 200
  2. `submitJob` invia `POST /api/tools/jobs` con body JSON corretto
  3. `submitJob` lancia errore su HTTP 4xx/5xx
  4. Idempotency: submit duplicato con stesso `idempotencyKey` restituisce stesso `jobId`
- **Estimate**: 0.25 days

#### Task 4.9 — FE-GATE-D05 — SSE-to-machine integration test
- **File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` (MODIFICA — estendi file esistente)
- **Action**: Integration test con MSW:
  1. Full flow: CTA click → `SUBMIT_JOB` → `submitting` → HTTP 200 → `running` → SSE `progress` × N → `JOB_COMPLETED` → `completed`
  2. Interruzione: SSE disconnects mid-job → FE mostra ultimo progresso
  3. Errore: SSE `terminal` con `status: 'failed'` → `JOB_FAILED` → UI mostra errore
- **Note**: Sostituisce i test di auto-chain esistenti (Category C04) che verificavano 1→2→3 `startRun` calls
- **Estimate**: 0.25 days

#### Task 4.10 — FE-GATE-D06 — ViewModel con SSE progress test
- **File**: `apps/frontend/src/features/tools/machines/tool-page-view-model.test.ts` (NUOVO)
- **Action**: Test che:
  1. `completedSteps` 0 entries → `canonicalState: 'draft-ready'`
  2. `completedSteps` 1 entry (non tutti) → `canonicalState: 'paused-with-checkpoint'`
  3. `completedSteps` tutti → `canonicalState: 'completed'`
  4. Stesso comportamento per tutti i tool key (funnel-pages, meta-ads, geometric, youtube-lf-script)
- **Estimate**: 0.25 days

---

## 5. Implementation Order & Dependency Graph

```
Phase 0 (0.5d): Contracts & Feature Flag
  ├── T0.1: packages/contracts/src/index.ts
  └── T0.2: backend-capabilities.ts
        │
Phase 1 (3.5d): Backend Core ──────────────┐
  ├── T1.1: tool-workflow-job-queue.ts      │
  ├── T1.2: tool-workflow-job-processor.ts  │ (dipende da T0.1, T1.1)
  ├── T1.3: tools-job-handlers.ts           │ (dipende da T1.1, T1.2, T0.1)
  ├── T1.4: tools-job-stream-handler.ts    │ (dipende da T1.2)
  ├── T1.5: worker-entry.ts                │ (dipende da T1.1, T1.2)
  ├── T1.6: server.ts                       │ (dipende da T1.1-T1.5)
  └── T1.7: tools-routes.ts                │ (dipende da T1.3, T1.4)
        │                                    │
Phase 2 (3d): Frontend Core ─────────────────┤
  ├── T2.1: tool-page.types.ts              │
  ├── T2.2: tool-page.machine.ts            │ (dipende da T2.1)
  ├── T2.3: useToolWorkflowJobStream.ts     │ (dipende da T2.2)
  ├── T2.4: useToolPageSubmitController.ts  │ (dipende da T2.1, T0.2)
  └── T2.5: useToolPage.ts                  │ (dipende da T2.3, T2.4, T0.2)
        │                                    │
Phase 3 (2d): Frontend UI ───────────────────┤
  ├── T3.4: system.ts (copy namespace)      │
  ├── T3.1: ToolWorkflowJobStepTracker.tsx   │ (dipende da T3.4)
  ├── T3.2: ToolWorkflowJobPanel.tsx        │ (dipende da T3.1, T3.4)
  ├── T3.5: useAdminToolWorkflowJobsQuery.ts │
  ├── T3.3: AdminToolWorkflowJobsPage.tsx    │ (dipende da T3.4, T3.5)
  └── T3.6: ToolPageTemplate.tsx            │ (dipende da T3.2, T2.5)
        │                                    │
Phase 4 (3d): Testing ───────────────────────┘
  ├── T4.1: BE-GATE-D01 (idempotency per-step)
  ├── T4.2: BE-GATE-D02 (routing WorkflowStepType)
  ├── T4.3: BE-GATE-D03 (cancellazione)
  ├── T4.4: BE-GATE-D04 (single-flight guard)
  ├── T4.5: FE-GATE-D01 (useJobStream)
  ├── T4.6: FE-GATE-D02 (useToolPageSubmitController)
  ├── T4.7: FE-GATE-D03 (macchina transizioni)
  ├── T4.8: FE-GATE-D04 (submitJob client)
  ├── T4.9: FE-GATE-D05 (integrazione SSE-to-machine)
  └── T4.10: FE-GATE-D06 (ViewModel con SSE progress)
```

**Parallelizzabile**: Phase 0 e Phase 1 possono iniziare in parallelo (T0.1/T0.2 non hanno dipendenze da Phase 1). Phase 2 e Phase 3 sono sequenziali dopo Phase 1. Phase 4 può iniziare in parallelo con Phase 3 (i test BE possono essere scritti appena Phase 1 è completata; i test FE appena Phase 2 è completata).

**Giorno per giorno**:
- **Day 1-2**: Phase 0 + Phase 1 (T1.1, T1.2) — contratti e processore
- **Day 3-4**: Phase 1 (T1.3, T1.4, T1.5, T1.6, T1.7) — handler e integrazione server
- **Day 5-6**: Phase 2 (T2.1–T2.5) — frontend core
- **Day 7-8**: Phase 3 (T3.1–T3.6) — UI components
- **Day 9-10**: Phase 4 (T4.1–T4.10) — testing

---

## 6. Testing Strategy

### Backend Gate
```
npm --workspace apps/backend run test
```

**Pre-condizioni**:
1. Test Category A esistenti (9 file: `runtime.geometric-e2e.test.ts`, `runtime.acquisition-workflow.machine.test.ts`, `runtime.scoring.test.ts`, `runtime.workflow-normalizers.test.ts`, `runtime.tool-workflow-registry.test.ts`, `runtime.tool-prompts-parametrized.test.ts`, `runtime.tool-prompts.test.ts`, `runtime.token-efficiency.test.ts`, `runtime.serpapi-crawling.test.ts`) continuano a passare senza modifiche
2. Test Category B (`generation-system.runtime.test.ts`) resta verde con invocazione N-volte per-step (Fase 1)
3. Nuovi test Category D (BE-GATE-D01..D04) passano

### Frontend Gate
```
npm --workspace apps/frontend run test
```

**Pre-condizioni**:
1. Tutti i test Category A (FE-GATE-A01..A09) continuano a passare
2. Test Category B riscritti come specificato (B01–B05) passano
3. Test Category C (C01–C04) rimossi senza ridurre coverage sotto le threshold (lines 70%, functions 70%, branches 60%, statements 70%)
4. Nuovi test Category D (FE-GATE-D01..D06) passano

### Acceptance Criteria Verification

| AC | Descrizione | Verificato da |
|---|---|---|
| AC-001 | `POST /api/tools/jobs` accetta payload, valida, restituisce `jobId` | T1.3 + T4.6 |
| AC-002 | Worker esegue tutti gli step multi-step senza FE | T1.2 + T4.2 |
| AC-003 | `GET /api/tools/jobs/:id` restituisce stato corrente | T1.3 + T4.3 |
| AC-004 | `GET /api/tools/jobs/:id/stream` emette SSE | T1.4 + T4.5 |
| AC-005 | ToolWorkflowJob fallito riprovato (max 3 tentativi) | T1.1 (BullMQ config) |
| AC-006 | Idempotency key: submit duplicato restituisce ToolWorkflowJob esistente | T1.3 |
| AC-007 | Tool single-step funzionano come prima | T4.9 (integration) |
| AC-008 | Tool multi-step completano tutti gli step | T4.2 + T4.9 |
| AC-009 | FE mostra progresso senza auto-chain | T4.5 + T4.7 |
| AC-010 | `npm run typecheck && npm run test` passa | CI gate |
| AC-011 | Backward compat: tool non migrati funzionano | T0.2 (feature flag off → legacy path) |
| AC-012 | Idempotency per-step (CRIT-01) | T4.1 |
| AC-013 | Cancel endpoint (CRIT-02) | T4.3 |
| AC-014 | Routing WorkflowStepType (CRIT-03) | T4.2 |
| AC-015 | Single-flight guard (HIGH-01) | T4.4 |

---

## 7. Risks & Mitigations

| Risk | Probabilità | Impatto | Mitigation |
|---|---|---|---|
| **Processore `runCrawlingStep`/`runScoringStep` wrapper troppo complessi** | Media | Alto | I wrapper delegano a `crawlingChainMachine`/`scoringChainMachine` esistenti in `generation-system.execution.states.ts`. Pattern testato. Se bloccante, si può deferire a Fase 2 e usare `runSingleStepGeneration` anche per crawling/scoring come workaround temporaneo. |
| **Single-flight guard race condition** | Media | Medio | Redis `SET NX EX` è atomico. Il lock viene acquisito prima di `queue.add()` e rilasciato nel processore (non nell'handler HTTP). Se il processore crasha prima di rilasciare, il TTL di 900s libera automaticamente. |
| **Macchina a stati regressione** | Bassa | Critico | Il nuovo path `submitting` → `running` è aggiuntivo. Il path legacy `configuring` → `generating` resta invariato. Test Category A garantiscono nessuna regressione. Feature flag permette rollback immediato. |
| **SSE stream disconnect durante ToolWorkflowJob** | Media | Basso | FE può sempre chiamare `GET /api/tools/jobs/:id` per lo stato corrente. `sessionStorage` persiste `jobId` per resume dopo reload (HIGH-02 workaround). |
| **Redis pieno / memoria** | Bassa | Medio | BullMQ `removeOnComplete` + TTL 24h su hash progress. Eventuali artifact sono già in Postgres. |
| **Coverage threshold dopo rimozione test Category C** | Media | Medio | I test Category C rimossi sono pochi (C01: nessun file dedicato, C02: `tool-flow.machine.test.ts`, C03: ~3 test case, C04: ~2 test case). I nuovi test Category D (6 file) compensano ampiamente. |
| **Deadlock idempotency su retry multipli** | Bassa | Medio | Redis lock TTL 900s. Dopo scadenza, lock si libera automaticamente. Processore controlla Postgres (`ON CONFLICT DO NOTHING`) prima di rieseguire. |

---

## 8. Success Criteria

- [ ] **SC-01**: `POST /api/tools/jobs` funzionante con validazione, idempotency, single-flight guard (AC-001, AC-006, AC-015)
- [ ] **SC-02**: Processore esegue tool multi-step end-to-end: `geometric` (4 step: crawling + scoring + 2 generation) e `blog-article-generator` (3 step generativi) (AC-002, AC-008)
- [ ] **SC-03**: SSE stream funzionante: eventi `progress` e `terminal` ricevuti dal FE (AC-004, AC-009)
- [ ] **SC-04**: Cancellazione funzionante: flag Redis rilevato al boundary tra step, ToolWorkflowJob marcato `cancelled` (AC-013)
- [ ] **SC-05**: Routing per `WorkflowStepType`: crawling → `runCrawlingStep`, scoring → `runScoringStep`, generation/extraction/acquisition → `runSingleStepGeneration` (AC-014)
- [ ] **SC-06**: Backward compat: con feature flag `toolsJobSystem: false`, il FE usa il path legacy `useToolPageRunController` (AC-011)
- [ ] **SC-07**: `npm --workspace apps/backend run test` passa (tutti i test Category A + nuovi Category D) (AC-010)
- [ ] **SC-08**: `npm --workspace apps/frontend run test` passa (Category A invariati, Category B riscritti, Category D nuovi) (AC-010)
- [ ] **SC-09**: `npm run typecheck` passa in tutti i workspace (AC-010)
- [ ] **SC-10**: Idempotency per-step: step 2 non bloccato da lock Redis di step 1 (AC-012)
- [ ] **SC-11**: Tool single-step (`youtube-description`, `brief-generator`) funzionano come prima (AC-007)
- [ ] **SC-12**: Worker in-process si avvia e si ferma correttamente con graceful shutdown (`TOOL_WORKFLOW_WORKER_IN_PROCESS=true`)

---

## 9. Non-Goals (Fase 1)

1. **Serializzazione XState snapshot** — non implementata (decisione architetturale: retry da zero con idempotency)
2. **Tabella `tool_jobs` in Postgres** — Fase 2 (solo Redis in Fase 1)
3. **Redis pub/sub cross-processo** — Fase 2 (EventEmitter o Redis pub/sub in-process in Fase 1, già implementato come prerequisito)
4. **Deployment worker separato** — Fase 2 (worker in-process in Fase 1)
5. **Aggregazione costo/token** — Fase 2
6. **Endpoint discovery ToolWorkflowJob** (`GET /api/tools/jobs?projectId=&toolKey=`) — Fase 2 (workaround `sessionStorage` in Fase 1)
7. **Group concurrency nativa BullMQ Pro** — non disponibile in OSS (fallback Redis lock in Fase 1)
8. **Human-in-the-loop gate a metà workflow** — non implementato
9. **Modifica dei prompt** — invariati
10. **Dashboard Bull Board** — non implementata

---

## 10. References

- [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (v1.10, `approved`)
- [Plan: BullMQ Prerequisites](./plan-bullmq-prerequisites.md) (`implemented`)
- [Plan: Post-BullMQ Improvements](./plan-post-bullmq-improvements.md) (`implemented`)
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-226 (`ToolWorkflowJob`), DDD-227 (`ToolWorkflowJobId`), DDD-228 (`ToolWorkflowJobStatus`)
- `apps/backend/src/lib/runtime/job-event-bridge.ts` — Redis pub/sub publisher/subscriber (prerequisito)
- `apps/backend/src/lib/runtime/job-progress-serializer.ts` — Manual step progress serialization (prerequisito)
- `apps/backend/src/lib/runtime/http-sse.ts` — SSE infrastructure (`applySseHeaders`, `pipeSseStreamToNodeResponse`)
- `apps/backend/src/lib/runtime/stream-contract.ts` — `serializeSseEvent`
- `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts` — Route registration pattern
- `apps/frontend/src/app/runtime/backend-capabilities.ts` — Feature flag pattern (`BackendCapabilities`, `readFlag`)
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — Macchina FE da estendere
- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` — Controller legacy da affiancare (non modificare)
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — Composizione hook con feature flag