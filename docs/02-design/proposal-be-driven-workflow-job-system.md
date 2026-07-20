---
goal: Replace FE-driven step-by-step tool workflow orchestration with a BE-driven job system that accepts a single job submission, chains steps internally, supports parallel jobs via BullMQ, and eliminates FE dependency for step progression
version: 1.0
date_created: 2026-07-20
last-reviewed: 2026-07-20
next-review-date: 2026-10-20
owner: Backend Runtime
status: draft
type: proposal
tags: [tool-workflow, job-queue, bullmq, backend-driven, xstate, sse, architecture]
---

# Proposal: BE-Driven Workflow Job System

## Context

### Current Architecture: FE-Driven Step-by-Step

Ogni tool workflow multi-step e' oggi orchestrato interamente dal frontend:

```
FE (per ogni step):
  1. POST /api/tools/orchestrate → ottiene dependencyArtifactIds degli step precedenti
  2. POST /api/generate (con step, dependencies, extraction context)
  3. Attende completamento SSE/JSON
  4. Auto-chain: se ci sono step rimanenti → torna al punto 1

BE (per ogni richiesta):
  - Crea una sessione XState generationSystemMachine
  - toolGenerationFlow invoca toolWorkflowMachine con 1 solo step descriptor
  - Esegue, streama, persiste, termina
```

**Criticita' strutturale**: il BE non esegue mai piu' di uno step in una singola sessione. La `toolWorkflowMachine` e' architetturalmente capace di multi-step (ha `stepStates[]`, `activeStepIndex`, transizioni `STEP_SUCCESS` → auto-advance), ma `generation-system.execution.states.ts` la invoca con `steps: [stepDescriptor]` — sempre e solo un elemento.

Il loop di auto-chain e' gestito dal bridge React in `useToolPageRunController.ts` (circa 200 linee di `useLayoutEffect` che leggono `pendingStepStart`, dispatchano via HTTP, e re-iniettano `STEP_DONE` nella macchina). Questo crea:

1. **Dipendenza da FE**: se il tab si chiude o crasha, il workflow si interrompe
2. **N+1 HTTP round-trip**: ogni step = orchestrate call + generation call + SSE stream
3. **No code paralleli**: impossibile processare piu' job contemporaneamente per utente
4. **Complessita' FE elevata**: 200+ linee di `useLayoutEffect` bridge, `pendingStepStart` queue, auto-chain state

### Infrastruttura Gia' Disponibile

| Componente | Stato |
|---|---|
| **BullMQ v5.78.0** | Gia' in `apps/backend/package.json` |
| **Redis (ioredis)** | Gia' configurato in `server.ts`, usato per lock, rate-limit, cache |
| **Coda BullMQ esistente** | `crawling-queue.ts` per crawling geometrico (pattern riutilizzabile) |
| **SSE streaming** | `http-sse.ts` + `backend-session.ts` — gia' implementato |
| **XState generationSystemMachine** | Macchina a stati completa per generazione |
| **runMode (new/resume/regenerate)** | Gia' a livello dominio (DDD-037) |
| **Redis idempotency lock** | Pattern `SET NX EX` gia' usato |
| **Redis rate limiting** | Sliding window per-user via `INCR`/`EXPIRE` |
| **Postgres connection pool** | pg `Pool` con max configurabile |

## Decision

Sostituire il loop FE-driven con un sistema di job BE-driven basato su BullMQ:

1. **FE invia un singolo submit job** con tutti i parametri necessari (toolKey, projectId, extractionPayload, model, form fields)
2. **BE accoda il job su Redis** (BullMQ) e restituisce `jobId`
3. **Worker BE processa il job**: itera gli step nell'ordine canonico, per ognuno risolve dependencies, esegue generazione, persiste artifact, emette eventi di progresso
4. **FE riceve aggiornamenti** via SSE sul `jobId`, rendering progressivo senza logica di orchestrazione
5. **Job falliti vengono riprovati da zero** con idempotency key (nessuna serializzazione XState, nessun resume intermedio)

### Razionale per "no serializzazione XState"

Serializzare e deserializzare lo snapshot di una XState machine tra un crash e il retry e' complesso, fragile (cambi di schema macchina = snapshot illeggibili), e aggiunge latenza. BullMQ supporta nativamente il retry di job falliti (`attempts`, `backoff`). Con l'idempotency key gia' implementata (Redis lock + Postgres `ON CONFLICT DO NOTHING`), ri-eseguire un job da zero produce lo stesso risultato senza duplicate side-effects. Il trade-off e' accettabile: un job geometrico completo (~4 step) impiega ~2-3 minuti; ripartire da zero dopo un crash costa al massimo quel tempo, ma elimina un'intera classe di bug di stato.

## Detailed Design

### 1. Nuovo Endpoint: Submit Job

```
POST /api/tools/jobs
```

**Request:**
```json
{
  "toolKey": "geometric",
  "projectId": "proj_abc123",
  "extractionPayload": {
    "reference_url": "https://competitor.com",
    "keywords": ["saas", "b2b"]
  },
  "model": "openai/gpt-4o",
  "intent": "new",
  "idempotencyKey": "idem_xyz789"
}
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "queued",
  "toolKey": "geometric",
  "workflowType": "geometric_analysis",
  "totalSteps": 4,
  "queuedAt": "2026-07-20T13:00:00Z"
}
```

**Validation pre-accodamento:**
- Auth (stesso middleware esistente)
- Project ownership (stessa logica di `tools-orchestrate-handlers.ts`)
- ToolKey supportato (`isSupportedToolWorkflow`)
- Rate limit / quota check (riusa `postgres-redis.usage.repository.ts`)
- Idempotency: se `idempotencyKey` gia' processato → restituisce il job esistente

### 2. Job Status / Stream

```
GET /api/tools/jobs/:jobId
GET /api/tools/jobs/:jobId/stream  (SSE)
```

**Polling response (`GET /:jobId`):**
```json
{
  "jobId": "job_abc123",
  "status": "running",
  "toolKey": "geometric",
  "progress": {
    "currentStep": "competitor-scoring",
    "completedSteps": ["serp-crawling"],
    "stepStatuses": {
      "serp-crawling": "done",
      "competitor-scoring": "running",
      "strategic-reporting": "idle",
      "unified-report": "idle"
    }
  },
  "result": null
}
```

**SSE stream (`GET /:jobId/stream`):**
```
event: progress
data: {"step":"serp-crawling","status":"running"}

event: progress
data: {"step":"serp-crawling","status":"done","artifactId":"art_001"}

event: progress
data: {"step":"competitor-scoring","status":"running"}

event: chunk
data: {"step":"competitor-scoring","text":"## Competitive Analysis\n\n..."}

event: terminal
data: {"status":"completed","artifacts":["art_001","art_002","art_003","art_004"],"sessionId":"sess_xyz"}
```

Riutilizza l'infrastruttura SSE esistente (`http-sse.ts`, `generation-stream-replay.ts`). I chunk di generazione vengono inoltrati cosi' come sono oggi, con l'aggiunta del campo `step` per distinguere a quale step appartengono.

### 3. Worker: `apps/backend/src/worker.ts`

Nuovo entry point separato dal server HTTP:

```typescript
// apps/backend/src/worker.ts
import { Queue, Worker } from 'bullmq';
import { createRedisConnection } from './lib/adapters/redis-connection';
import { createPostgresPool } from './lib/adapters/postgres-pool';
import { processToolWorkflowJob } from './lib/runtime/tool-workflow-job-processor';

const redis = createRedisConnection();
const pg = createPostgresPool();

const queue = new Queue('tool-workflow', { connection: redis });
const worker = new Worker('tool-workflow', 
  (job) => processToolWorkflowJob(job, { pg, redis }),
  {
    connection: redis,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 },  // 10 job/min per worker
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  }
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
  await queue.close();
  await redis.quit();
  await pg.end();
});
```

Il worker puo' girare:
- **In-process** (stesso processo del server HTTP, per ambienti monolitici/sviluppo)
- **Out-of-process** (processo separato o istanza separata, per produzione con scalabilita' orizzontale)

### 4. Processore: `tool-workflow-job-processor.ts`

Cuore del nuovo sistema. Logica equivalente al loop FE ma eseguita interamente lato BE:

```typescript
// apps/backend/src/lib/runtime/tool-workflow-job-processor.ts

export async function processToolWorkflowJob(
  job: Job<ToolWorkflowJobPayload>,
  adapters: { pg: Pool; redis: Redis }
): Promise<ToolWorkflowJobResult> {
  const { toolKey, projectId, extractionPayload, model, intent, userId } = job.data;

  // 1. Idempotency check (Redis lock + Postgres upsert)
  await ensureIdempotency(job);

  // 2. Resolve ToolWorkflowPlan (tutti gli step ordinati + dependency graph)
  const plan = resolveToolWorkflowPlanFromToolKey(toolKey);

  // 3. Run extraction (se necessaria per il tool)
  const extractionResult = await runExtractionOnce({
    toolKey, projectId, extractionPayload, userId, adapters
  });
  await updateJobProgress(job, { extraction: 'done' });

  // 4. Esegui ogni step nell'ordine canonico
  const artifactIds: string[] = [];
  const completedStepContents: Record<string, string> = {};

  for (const stepDescriptor of plan.steps) {
    await updateJobProgress(job, { currentStep: stepDescriptor.key, status: 'running' });

    // 4a. Risolvi dependency artifact IDs (query DB, stessa logica di orchestrate)
    const dependencyArtifactIds = resolveStepDependencyIds(
      toolKey, stepDescriptor.key, completedStepArtifacts
    );

    // 4b. Esegui la generazione per questo step
    const result = await runSingleStepGeneration({
      toolKey,
      step: stepDescriptor.key,
      workflowType: plan.workflowType,
      dependencyArtifactIds,
      dependencyArtifactContents: completedStepContents,
      extractionResult,
      model,
      userId,
      projectId,
      adapters,
    });

    artifactIds.push(result.artifactId);
    completedStepContents[stepDescriptor.key] = result.content;
    completedStepArtifacts[stepDescriptor.key] = result.artifactId;

    await updateJobProgress(job, {
      currentStep: stepDescriptor.key,
      status: 'done',
      artifactId: result.artifactId,
    });
  }

  return {
    status: 'completed',
    artifactIds,
    sessionId: extractionResult.sessionId,
  };
}
```

### 5. Modifiche a `generation-system`

**Invocation multi-step**: `generation-system.execution.states.ts` — il `toolGenerationFlow` deve accettare `steps: plan.steps` (array completo) invece di `steps: [stepDescriptor]` (singolo). La `toolWorkflowMachine` gestisce gia' l'iterazione interna.

**Alternativa pragmatica (preferita per la fase 1)**: mantenere l'esecuzione single-step ma chiamarla in loop dal processore. Questo evita modifiche alla macchina XState esistente e riduce il rischio di regressione. La `toolWorkflowMachine` viene invocata N volte (una per step) dal processore, che gestisce il passaggio di contesto tra uno step e l'altro. Vedi Sezione "Implementation Strategy" per il dettaglio.

### 6. Job Status Storage

**Opzione A — Solo Redis (scelta per fase 1)**: BullMQ gestisce lo stato dei job (waiting, active, completed, failed). I metadati aggiuntivi (progress per-step, artifact IDs) vengono salvati in un hash Redis con TTL:

```
key: tool-job:{jobId}
fields: status, toolKey, currentStep, completedSteps (JSON), result (JSON)
TTL: 86400 (24 ore)
```

**Opzione B — Postgres (fase 2, per query e retention)**:
```sql
CREATE TABLE tool_jobs (
  job_id         TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  project_id     TEXT NOT NULL,
  tool_key       TEXT NOT NULL,
  workflow_type  TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed')),
  progress       JSONB DEFAULT '{}',
  result         JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_jobs_user_status ON tool_jobs(user_id, status);
CREATE INDEX idx_tool_jobs_project ON tool_jobs(project_id);
```

### 7. SSE Job Stream

Il FE dopo aver inviato il job si connette a `GET /api/tools/jobs/:jobId/stream` per ricevere eventi in tempo reale. L'implementazione lato BE:

- BullMQ emette eventi (`completed`, `failed`, `progress`) sul worker
- Un `JobEventBus` (basato su Redis pub/sub o EventEmitter in-process) inoltra gli eventi al gestore SSE
- Il gestore SSE mantiene una mappa `jobId → Set<Response>` per broadcast a tutti i listener connessi
- Timeout: se nessun evento per 30s, invia heartbeat `:keepalive`

Per la fase 1, con worker in-process, si puo' usare un semplice `EventEmitter` Node.js. Per fase 2 (multi-processo), Redis pub/sub.

### 8. Idempotency e Retry

**Idempotency key** gia' implementata in `postgres-redis.idempotency.repository.ts`:
- Redis lock `SET NX EX 900` (15 minuti)
- Postgres `ON CONFLICT DO NOTHING` su `request_id`
- Se il lock esiste gia' → il job e' duplicato, si restituisce il `jobId` esistente

**Retry senza serializzazione**:
```typescript
new Worker('tool-workflow', processor, {
  attempts: 3,                              // 3 tentativi totali
  backoff: { type: 'exponential', delay: 2000 },  // 2s, 4s, 8s
  removeOnComplete: { age: 3600 * 24 },     // tieni completati per 24h
  removeOnFail: { age: 3600 * 24 * 7 },     // tieni falliti per 7 giorni
});
```

Il job contiene un `idempotencyKey` nel payload. Se il worker crasha a meta' (es. dopo aver completato 2 step su 4), al retry il processore:
1. Controlla Redis/Postgres per artifact gia' generati con la stessa idempotency key
2. Skips gli step gia' completati (riconosce gli artifact esistenti)
3. Riprende dallo step successivo

Questo e' un **retry con skip dei step completati**, non una serializzazione completa della macchina. I step completati sono determinati interrogando il DB per artifact con `stepKey` e `sessionId`.

### 9. Rate Limiting e Parallelismo

BullMQ gestisce nativamente:
- **Concurrency per worker**: `concurrency: 3` — max 3 job processati in parallelo
- **Rate limiter globale**: `limiter: { max: 10, duration: 60_000 }` — max 10 job al minuto
- **Group concurrency** (fase 2): limita job paralleli per utente (`group: { concurrency: 1 }` sul `userId`)

L'attuale rate limiting Redis (`INCR`/`EXPIRE` sliding window in `postgres-redis.usage.repository.ts`) viene **mantenuto** al livello HTTP (submit endpoint) come prima linea di difesa. Il rate limiting BullMQ e' una seconda linea per il worker.

## Impact Assessment

| Layer | Modifica | Complessita' |
|---|---|---|
| **Contracts** | Nuovo tipo `SubmitJobRequest`, `JobStatusResponse`, `JobProgressEvent` | Bassa — nuovi tipi, nessuna modifica a tipi esistenti |
| **BE server.ts** | Nuove route `POST /api/tools/jobs`, `GET /api/tools/jobs/:id`, `GET /api/tools/jobs/:id/stream` | Media — nuove route, handler dedicati |
| **BE worker.ts** | Nuovo file, entry point per il worker. Connessione BullMQ + Redis + Postgres | Media — codice nuovo ma pattern simile a `crawling-queue.ts` |
| **BE tool-workflow-job-processor.ts** | Nuovo file, loop step con chiamate a generation system | Alta — e' il cuore del nuovo sistema |
| **BE generation-system** | **Fase 1**: nessuna modifica, invocato 1 volta per step dal processore. **Fase 2 (opzionale)**: supporto multi-step nativo | Fase 1: Nessuna. Fase 2: Media |
| **BE tool-prompts** | Nessuna modifica — i prompt restano invariati | Nessuna |
| **BE handlers (orchestrate)** | Mantenuti per backward compatibility (tool singoli, debug) | Nessuna |
| **FE tool-page.machine** | **Semplificazione drastica**: rimozione `pendingStepStart`, auto-chain, `STEP_REQUEST_DISPATCHED`. Nuovo path: `submitting` → `running` (passivo, consuma SSE) → `completed` | Media — piu' rimozione che aggiunta |
| **FE useToolPageRunController** | Sostituzione dell'intero bridge `useLayoutEffect` (200+ linee) con `submitJob()` + consumatore SSE passivo | Media — semplificazione netta |
| **FE tool-page-selectors** | Rimozione selettori di auto-chain. Mantenuti quelli di extraction info e form state | Bassa |
| **FE new: useJobStream** | Nuovo hook per consumare SSE job stream | Bassa |
| **Infra-DB** | Migrazione per tabella `tool_jobs` (fase 2). Fase 1: solo Redis | Bassa |
| **Redis** | Nuove chiavi per job state e pub/sub (gestite da BullMQ + hash manuali per progress) | Bassa |

## Implementation Strategy

### Fase 1 — Minimum Viable (2 settimane)

**Obiettivo**: job system funzionante con worker in-process, senza modifiche a `generation-system`.

1. **`tool-workflow-job-processor.ts`** — loop che esegue step uno alla volta chiamando `runSingleStepGeneration` (wrapper che riusa `handleGenerationRequest` esistente)
2. **`worker.ts`** — worker BullMQ in-process, avviato da `server.ts` in sviluppo
3. **Endpoint submit** — `POST /api/tools/jobs`, validazione, accodamento
4. **Endpoint status** — `GET /api/tools/jobs/:id`, lettura da Redis hash
5. **Endpoint stream** — `GET /api/tools/jobs/:id/stream`, SSE con `EventEmitter` in-process
6. **FE semplificazione** — nuovo hook `useToolPageSubmitController` che sostituisce `useToolPageRunController`. La `toolPageMachine` riceve un evento `SUBMIT_JOB` e transita in `running` passivo consumando SSE. Nessuna modifica ai componenti UI (continuano a ricevere `completedSteps` e `artifacts` dal context, la fonte cambia ma l'interfaccia a valle no)

**File nuovi:**
- `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- `apps/backend/src/lib/runtime/tool-workflow-job-queue.ts` (Queue/Worker setup)
- `apps/backend/src/lib/runtime/auth-http/tools/tools-job-handlers.ts`
- `apps/backend/src/lib/runtime/auth-http/tools/tools-job-stream-handler.ts`
- `apps/backend/src/worker-entry.ts` (entry point per worker standalone)
- `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.ts`
- `apps/frontend/src/features/tools/runtime/useJobStream.ts`

**File modificati:**
- `apps/backend/src/server.ts` — nuove route, avvio worker in-process (opzionale, via env `TOOL_WORKFLOW_WORKER_IN_PROCESS=true`)
- `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts` — registrazione nuove route
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — nuovo stato `submitting`, rimozione path di auto-chain
- `apps/frontend/src/features/tools/machines/tool-page.types.ts` — nuovi eventi `SUBMIT_JOB`, `JOB_PROGRESS`, `JOB_COMPLETED`, `JOB_FAILED`
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — composizione con `useToolPageSubmitController` invece di `useToolPageRunController`
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — il CTA chiama `submitJob()` invece di `handlePrimaryAction()`
- `packages/contracts/src/index.ts` — nuovi tipi job

**Non modificati (fase 1):**
- `generation-system.execution.states.ts` — continua a eseguire single-step
- `toolWorkflowMachine` — invariata
- Tutti i prompt file — invariati
- `tools-orchestrate-handlers.ts` — mantenuto per backward compat e debug
- `useToolPageRunController.ts` — mantenuto (coesiste), feature-flagged

### Fase 2 — Ottimizzazione (1 settimana, opzionale)

1. **Tabella `tool_jobs` in Postgres** — migrazione, sostituzione Redis hash per storage permanente
2. **Redis pub/sub per multi-processo** — sostituzione `EventEmitter` con Redis pub/sub per SSE cross-processo
3. **Group concurrency per utente** — `group: { concurrency: 1 }` per limitare a 1 job per utente
4. **Integration test end-to-end** — test che simulano submit job → stream → completamento

### Fase 3 — Multi-step nativo in XState (1 settimana, opzionale)

1. `toolGenerationFlow` invoca `toolWorkflowMachine` con `steps: plan.steps` (array completo)
2. La macchina itera internamente gli step senza uscire dalla sessione
3. Unica sessione SSE per l'intero workflow

## Risks and Controls

| Risk | Control |
|---|---|
| **Regressione tool esistenti** | Feature flag `TOOL_WORKFLOW_USE_JOB_SYSTEM` per tool key. Attivazione graduale: prima `geometric` (il piu' complesso), poi `blog-article-generator`, poi tutti |
| **Worker crash durante un job** | BullMQ retry automatico (3 tentativi). Idempotency key previene side-effects duplicati. Skip step gia' completati (lettura da DB) |
| **Redis pieno / memoria** | BullMQ `removeOnComplete` + TTL su hash di progress (24h). Eventuali artifact sono gia' in Postgres |
| **Deadlock idempotency su retry multipli** | Redis lock TTL 900s. Dopo scadenza, il lock si libera automaticamente. Il processore controlla Postgres prima di rieseguire |
| **SSE stream disconnesso** | FE puo' sempre chiamare `GET /:jobId` per lo stato corrente e riconnettersi allo stream. Stream replay come gia' implementato in `generation-stream-replay.ts` |
| **Aumento latenza percepita (submit → primo progresso)** | Il primo step parte immediatamente dopo extraction. Per tool single-step, la latenza e' identica a oggi. Per multi-step, l'utente vede progresso gia' dal primo step, senza attendere tutto il workflow |
| **Compatibilita' con `runMode: resume/regenerate`** | Il job payload include `intent: 'resume'`. Il processore usa `resolveWorkflowRunMode` esistente e passa `bootstrap` con i contenuti degli step precedenti (recuperati da DB) |

## Non-Goals (Cosa NON Facciamo)

1. **Serializzazione XState snapshot** — complessita' ingiustificata. I job falliti ripartono da zero con idempotency
2. **Job scheduling differito** (es. "esegui alle 3:00") — BullMQ lo supporta nativamente (`delay`), ma non e' un requisito attuale. Si potra' aggiungere in futuro
3. **Code multiple per tipologia** (generation, export, email) — fase 1 usa una singola coda `tool-workflow`. Si partizionera' quando servira'
4. **Dashboard BullMQ / Bull Board** — utile per debug ma non bloccante. Si puo' aggiungere dopo
5. **Modifica dei prompt** — i prompt file restano identici. Il processore li risolve con lo stesso meccanismo `resolveToolPrompt` di oggi

## Acceptance Criteria

- [ ] AC-001: `POST /api/tools/jobs` accetta un payload completo, valida, e restituisce `jobId`
- [ ] AC-002: Il worker esegue tutti gli step di un tool multi-step senza intervento FE
- [ ] AC-003: `GET /api/tools/jobs/:id` restituisce lo stato corrente del job (step corrente, step completati)
- [ ] AC-004: `GET /api/tools/jobs/:id/stream` emette eventi SSE di progresso e chunk
- [ ] AC-005: Job fallito viene riprovato automaticamente (max 3 tentativi)
- [ ] AC-006: Idempotency key funziona: submit duplicato restituisce il job esistente
- [ ] AC-007: Tool single-step (youtube-description, brief-generator) funzionano come prima
- [ ] AC-008: Tool multi-step (geometric, blog-article-generator) completano tutti gli step
- [ ] AC-009: Il FE mostra il progresso passo-passo senza logica di auto-chain
- [ ] AC-010: `npm run typecheck && npm run test` passa in tutti i workspace
- [ ] AC-011: Backward compat: i tool non migrati continuano a funzionare col vecchio sistema

## References

- `apps/backend/src/lib/runtime/integrations/crawling-queue.ts` — pattern BullMQ esistente
- `apps/backend/src/lib/machines/tool-workflow.machine.ts` — XState machine multi-step gia' capace
- `apps/backend/src/lib/machines/generation-system.execution.states.ts` — invocation corrente single-step
- `apps/backend/src/lib/machines/generation-routing.ts` — `resolveToolWorkflowPlan`, `resolveWorkflowRunMode`
- `apps/backend/src/lib/runtime/tool-workflow-registry.ts` — `ToolWorkflowPlan`, `resolveStepDependencyIds`
- `apps/backend/src/lib/runtime/generation-handler.ts` — entry point generazione
- `apps/backend/src/lib/runtime/auth-http/tools/tools-orchestrate-handlers.ts` — orchestrate endpoint corrente
- `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts` — idempotency lock
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — macchina FE da semplificare
- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` — bridge auto-chain da sostituire
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — composizione hook
