---
goal: Replace FE-driven step-by-step tool workflow orchestration with a BE-driven ToolWorkflowJob system that accepts a single job submission, chains steps internally, supports parallel jobs via BullMQ, and eliminates FE dependency for step progression
version: 1.10
date_created: 2026-07-20
last-reviewed: 2026-07-24
next-review-date: 2026-08-24
owner: Backend Runtime
status: approved
type: proposal
tags: [tool-workflow, tool-workflow-job, bullmq, backend-driven, xstate, sse, architecture]
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
3. **No code paralleli**: impossibile processare piu' `ToolWorkflowJob` (workflow multi-step) contemporaneamente per utente
4. **Complessita' FE elevata**: 200+ linee di `useLayoutEffect` bridge, `pendingStepStart` queue, auto-chain state

### Infrastruttura Gia' Disponibile

| Componente | Stato |
|---|---|
| **BullMQ v5.78.0** | Gia' in `apps/backend/package.json` |
| **Redis (ioredis)** | Gia' configurato in `server.ts`, usato per lock, rate-limit, cache |
| **SSE streaming** | `http-sse.ts` + `backend-session.ts` — gia' implementato |
| **XState generationSystemMachine** | Macchina a stati completa per generazione |
| **runMode (new/resume/regenerate)** | Gia' a livello dominio (DDD-037) |
| **Redis idempotency lock** | Pattern `SET NX EX` gia' usato |
| **Redis rate limiting** | Sliding window per-user via `INCR`/`EXPIRE` |
| **Postgres connection pool** | pg `Pool` con max configurabile |

**Nota positiva verificata — modello crediti a due livelli (nessuna modifica necessaria)**: il sistema attuale implementa gia' correttamente un modello a due livelli distinti, verificato in `apps/backend/src/lib/machines/generation-system.guards.ts:85-95` e `generation-system.persistence.states.ts:187-223`:

1. **`monthly_artifacts_used`** (`ArtifactGateUsed`, DDD-140) — si incrementa di **+1 per ogni artifact generato** (quindi per ogni step), controllato contro `monthly_artifact_limit` (`ArtifactGateLimit`, DDD-140). E' un limite di sicurezza anti-abuso, **invisibile all'utente**: le risposte API non lo espongono.
2. **`monthly_credits_used`** (`MonthlyCreditsUsed`, DDD-138) — i crediti realmente percepiti dall'utente vengono addebitati **una sola volta per l'intero tool workflow**, quando lo step finale completa. Il guard `isNotFinalArtifact` (`generation-system.guards.ts:85-95`, basato su `isFinalStepForPlan`) determina nello stato `recordingUsage` se saltare direttamente a `completed` (step non-finale: nessun addebito crediti, solo increment del gate artifact) o passare per `consumingCredits` (step finale: addebito di `context._creditCost`, DDD-139).

**Conclusione**: un run completo di `blog-article-generator` (3 step, `creditCost: 3`) costa all'utente esattamente **3 crediti totali**, non 9. Poiche' il nuovo `ToolWorkflowJob` system BE-driven propone di chiamare `runSingleStepGeneration` in loop per ogni step (vedi pseudocodice nella sezione "Detailed Design"), questo comportamento si applica automaticamente e correttamente senza alcuna modifica al modello quota/crediti: gli step 1..N-1 faranno scattare `isNotFinalArtifact=true` (skip crediti, solo increment gate) e solo l'ultimo step (N) addebitera' il credito una volta. **Questo e' un punto a favore della proposal**, non un gap — nessuna azione richiesta.

## Decision

Sostituire il loop FE-driven con un sistema di code BE-driven basato su BullMQ, il cui concetto centrale e' il nuovo Aggregate Root **`ToolWorkflowJob`** (Generation context, ratificato in DDD-226/DDD-227 — vedi Sezione "DDD Governance Verification Notes"):

1. **FE invia un singolo submit** con tutti i parametri necessari (toolKey, projectId, extractionPayload, model, form fields) per creare un `ToolWorkflowJob`
2. **BE accoda il `ToolWorkflowJob` su Redis** (BullMQ) e restituisce `jobId` (identificatore del `ToolWorkflowJob`, Value Object `ToolWorkflowJobId` — DDD-227)
3. **Worker BE processa il `ToolWorkflowJob`**: itera gli step nell'ordine canonico, per ognuno risolve dependencies, esegue generazione, persiste artifact, emette eventi di progresso
4. **FE riceve aggiornamenti** via SSE sul `jobId`, rendering progressivo senza logica di orchestrazione
5. **`ToolWorkflowJob` falliti vengono riprovati da zero** con idempotency key (nessuna serializzazione XState, nessun resume intermedio)

**Relazione con `GenerationSession`**: un `ToolWorkflowJob` **produce e possiede** una `GenerationSession` (DDD-048) — il job e' l'unita' di esecuzione asincrona (stati `queued`/`running`/`completed`/`failed`/`cancelled`), la session resta l'aggregato di raggruppamento degli `Artifact` prodotti. Relazione 1:1 per `WorkflowRunMode = 'new'`; potenzialmente 1:N per `'regenerate'` (da confermare in implementazione — vedi Sezione 8, tabella di decisione).

### Razionale per "no serializzazione XState"

XState v5 offre un meccanismo di persistenza built-in pulito (`getPersistedSnapshot()` + `createActor(machine, { snapshot })` con deep child actor preservation). Tuttavia, il comportamento documentato rende la serializzazione mid-flight inadatta al nostro caso d'uso:

> **"Actions are not re-executed upon restoration, but invocations will restart."**
> — [Stately docs — Persistence > Restoring state](https://stately.ai/docs/persistence)

Tradotto: se serializziamo la macchina mentre e' in corso l'`invoke` di `generationActor` (la chiamata LLM), al restore l'invocazione **riparte da zero**, producendo una seconda chiamata LLM e un doppio addebito crediti. Inoltre, XState non offre schema migration built-in per machine snapshot (solo `xstate-store` ha l'opzione `migrate`), quindi ogni modifica alla definizione della macchina richiederebbe un transform manuale del JSON persistito.

BullMQ supporta nativamente il retry di `ToolWorkflowJob` falliti (`attempts`, `backoff`). Con l'idempotency key gia' implementata (Redis lock + Postgres `ON CONFLICT DO NOTHING`), ri-eseguire un `ToolWorkflowJob` da zero produce lo stesso risultato senza duplicate side-effects. Il trade-off e' accettabile: un `ToolWorkflowJob` geometrico completo (~4 step) impiega ~2-3 minuti; ripartire da zero dopo un crash costa al massimo quel tempo, ma evita sia le chiamate LLM duplicate del restore mid-invoke sia i rischi di schema migration.

## Detailed Design

### 1. Nuovo Endpoint: Submit ToolWorkflowJob

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

Il campo `jobId` nella risposta e' l'identificatore del `ToolWorkflowJob` (`ToolWorkflowJobId`, DDD-227) creato dal submit — `jobId` resta il nome di campo a livello API (convenzione REST), mentre il concetto di dominio sottostante e' il `ToolWorkflowJob`.

**Validation pre-accodamento:**
- Auth (stesso middleware esistente)
- Project ownership (stessa logica di `tools-orchestrate-handlers.ts`)
- ToolKey supportato (`isSupportedToolWorkflow`)
- Rate limit / quota check (riusa `postgres-redis.usage.repository.ts`)
- Idempotency: se `idempotencyKey` gia' processato → restituisce il `ToolWorkflowJob` esistente

### 2. ToolWorkflowJob Status / Stream

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
    limiter: { max: 10, duration: 60_000 },  // 10 ToolWorkflowJob/min per worker
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    // HIGH-01 (Context7 2026-07-24): group-concurrency e' BullMQ PRO only
    // (WorkerPro da @taskforcesh/bullmq-pro). Non disponibile in OSS v5.78.0.
    // Single-flight guard implementato via Redis lock SET NX EX al submit-time
    // (vedi Sezione "Detailed Design" #3, nota HIGH-01 e AC-015).
    // La riga `group: { id: ... }` NON deve apparire nell'implementazione reale.
    // group: { id: (job) => `${job.data.userId}:${job.data.projectId}:${job.data.toolKey}` },
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

**Nota HIGH-01 (single-flight guard) — incertezza dichiarata**: `group: { id: ... }` con group-concurrency nativa (limitare a 1 `ToolWorkflowJob` attivo per gruppo) e' una feature di **BullMQ Pro**, non della libreria open-source `bullmq` v5.78.0 attualmente in `apps/backend/package.json`. Questa proposal **non ha potuto verificare con certezza** se la versione OSS in uso esponga un equivalente nativo per il group-concurrency (la sintassi `group: { id }` mostrata sopra e' quella nota per BullMQ Pro; potrebbe non essere disponibile nella variante OSS). **Fallback sicuro da adottare in Fase 1, in assenza di conferma**: un lock applicativo Redis `SET NX EX <ttl>` su chiave `tool-job-active:{userId}:{projectId}:{toolKey}`, acquisito al submit (prima dell'accodamento BullMQ) e rilasciato quando il `ToolWorkflowJob` raggiunge `completed`/`failed`/`cancelled`. Se il lock e' gia' presente, il submit restituisce `409 Conflict` con il `jobId` del `ToolWorkflowJob` attivo, invece di accodare un secondo `ToolWorkflowJob` per lo stesso `(userId, projectId, toolKey)`. Questo fallback e' indipendente dalla versione BullMQ e non richiede la feature Pro — e' l'opzione da implementare per Fase 1 finche' la disponibilita' di group-concurrency nativa in OSS non e' confermata.

Il worker puo' girare:
- **In-process** (stesso processo del server HTTP, per ambienti monolitici/sviluppo)
- **Out-of-process** (processo separato o istanza separata, per produzione con scalabilita' orizzontale)

### 4. Processore: `tool-workflow-job-processor.ts`

Cuore del nuovo sistema. Logica equivalente al loop FE ma eseguita interamente lato BE. Il pseudocodice seguente incorpora tre correzioni rispetto alla revisione precedente: **(a)** idempotency key derivato per-step (chiude CRIT-01), **(b)** controllo del flag di cancellazione tra uno step e il successivo (chiude CRIT-02, vedi Sezione 10), **(c)** routing esplicito per `WorkflowStepType` invece della chiamata uniforme a `runSingleStepGeneration` (chiude CRIT-03):

```typescript
// apps/backend/src/lib/runtime/tool-workflow-job-processor.ts

export async function processToolWorkflowJob(
  job: Job<ToolWorkflowJobPayload>,
  adapters: { pg: Pool; redis: Redis }
): Promise<ToolWorkflowJobResult> {
  // Invariante MED-02: il worker NON re-esegue ownership check.
  // L'autorizzazione e' garantita esclusivamente al submit-time (middleware auth
  // + project ownership su POST /api/tools/jobs). job.data e' immutabile e
  // trusted dopo l'accodamento BullMQ. Qualsiasi path futuro che modifichi
  // job.data post-submit DEVE reintrodurre il re-check esplicito.
  const { toolKey, projectId, extractionPayload, model, intent, userId, idempotencyKey } = job.data;

  // 1. Idempotency check (Redis lock + Postgres upsert) — questo claim usa
  //    l'idempotencyKey grezzo del submit, scoped al ToolWorkflowJob nel suo complesso
  //    (non ai singoli step — vedi punto 4b per il derivato per-step).
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
  const completedStepArtifacts: Record<string, string> = {};

  for (const stepDescriptor of plan.steps) {
    // 4a. CRIT-02 — controllo cancellazione tra uno step e il successivo.
    // Verificato SOLO ai boundary tra step, non durante una chiamata LLM in corso
    // (l'interruzione hard mid-invoke non e' nello scope — vedi Sezione 10).
    const cancelRequested = await redis.get(`tool-job-cancel:${job.data.jobId}`);
    if (cancelRequested) {
      await updateJobProgress(job, { status: 'cancelled' });
      return {
        status: 'cancelled',
        artifactIds,
        sessionId: extractionResult.sessionId,
      };
    }

    await updateJobProgress(job, { currentStep: stepDescriptor.key, status: 'running' });

    // 4b. CRIT-01 — idempotency key derivato per-step. Il claim del lock Redis
    // usa una chiave scoped al singolo step, non l'idempotencyKey grezzo del
    // submit (che e' gia' stato claimato al punto 1 per l'intero ToolWorkflowJob
    // e non puo' essere riusato — altrimenti il secondo step riceverebbe sempre
    // `idempotency_conflict` dal lock ancora attivo del primo step).
    const stepIdempotencyKey = `${idempotencyKey}:${stepDescriptor.key}`;

    // 4c. Risolvi dependency artifact IDs (query DB, stessa logica di orchestrate)
    const dependencyArtifactIds = resolveStepDependencyIds(
      toolKey, stepDescriptor.key, completedStepArtifacts
    );

    // 4d. CRIT-03 — instrada per WorkflowStepType invece di chiamare sempre
    // runSingleStepGeneration. Gli step 'crawling' e 'scoring' delegano ai
    // rispettivi bounded context (Crawling & Extraction, Competitor Analysis —
    // vedi domain-bounded-context-map.md righe 234/236) tramite wrapper dedicati,
    // NON tramite il path LLM-generativo.
    let result: { artifactId: string; content: string };

    switch (stepDescriptor.type) {
      case 'generation':
      case 'extraction':
      case 'acquisition': {
        result = await runSingleStepGeneration({
          toolKey,
          step: stepDescriptor.key,
          workflowType: plan.workflowType,
          dependencyArtifactIds,
          dependencyArtifactContents: completedStepContents,
          extractionResult,
          model,
          userId,
          projectId,
          idempotencyKey: stepIdempotencyKey,
          adapters,
        });
        break;
      }
      case 'crawling': {
        // Delega a crawlingChainMachine (Crawling & Extraction context),
        // stesso path di generation-system.execution.states.ts crawlingFlow.
        // Implementazione completa in Fase 1 (pattern per futuri tool API-driven).
        result = await runCrawlingStep({
          toolKey,
          step: stepDescriptor.key,
          dependencyArtifactIds,
          extractionResult,
          model,
          userId,
          projectId,
          idempotencyKey: stepIdempotencyKey,
          adapters,
        });
        break;
      }
      case 'scoring': {
        // Delega a scoringChainMachine (Competitor Analysis context),
        // stesso path di generation-system.execution.states.ts scoringFlow.
        // Implementazione completa in Fase 1 (pattern per futuri tool API-driven).
        result = await runScoringStep({
          toolKey,
          step: stepDescriptor.key,
          dependencyArtifactIds,
          userId,
          projectId,
          idempotencyKey: stepIdempotencyKey,
          adapters,
        });
        break;
      }
      default: {
        throw new Error(`Unhandled WorkflowStepType for step ${stepDescriptor.key}`);
      }
    }

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
    status: completed,
    artifactIds,
    sessionId: extractionResult.sessionId,
  };
}

// Firme wrapper (CRIT-03). I wrapper delegano ai chain actor esistenti
// (crawlingChainMachine, scoringChainMachine) invocati oggi da
// generation-system.execution.states.ts (crawlingFlow, scoringFlow).
// L'implementazione e' inclusa nella Fase 1: ogni wrapper crea una
// sessione generationSystemMachine, instrada al chain actor corretto
// (non al path LLM-generativo), e restituisce { artifactId, content }.
// Pattern riutilizzabile per ogni futuro tool API-driven — il loop
// centrale del processore (switch su WorkflowStepType) non richiedera'
// modifiche per nuovi tipi di step non-generativi.

/** Delega al bounded context Crawling & Extraction (crawlingChainMachine). */
async function runCrawlingStep(params: {
  toolKey: string;
  step: string;
  dependencyArtifactIds: string[];
  extractionResult: ExtractionResult;
  model: LlmModelId;
  userId: string;
  projectId: string;
  idempotencyKey: string;
  adapters: { pg: Pool; redis: Redis };
}): Promise<{ artifactId: string; content: string }> {
  // Crea una sessione generationSystemMachine con routeType che punta al
  // crawlingChainMachine (stesso path di generation-system.execution.states.ts
  // crawlingFlow). Il chain actor produce un CrawlArtifact (ArtifactType =
  // 'crawl', DDD-122) e lo persiste. Restituisce artifactId e contenuto
  // testuale dell'artifact prodotto.
}

/** Delega al bounded context Competitor Analysis (scoringChainMachine). */
async function runScoringStep(params: {
  toolKey: string;
  step: string;
  dependencyArtifactIds: string[];
  extractionResult: ExtractionResult;
  model: LlmModelId;
  userId: string;
  projectId: string;
  idempotencyKey: string;
  adapters: { pg: Pool; redis: Redis };
}): Promise<{ artifactId: string; content: string }> {
  // Crea una sessione generationSystemMachine con routeType che punta allo
  // scoringChainMachine (stesso path di generation-system.execution.states.ts
  // scoringFlow). Il chain actor produce uno ScoringArtifact (ArtifactType =
  // 'analysis', DDD-121/DDD-124) e lo persiste. Restituisce artifactId e
  // contenuto testuale dell'artifact prodotto.
}
```

### 5. Modifiche a `generation-system`

**Invocation multi-step**: `generation-system.execution.states.ts` — il `toolGenerationFlow` deve accettare `steps: plan.steps` (array completo) invece di `steps: [stepDescriptor]` (singolo). La `toolWorkflowMachine` gestisce gia' l'iterazione interna.

**Alternativa pragmatica (preferita per la fase 1)**: mantenere l'esecuzione single-step ma chiamarla in loop dal processore. Questo evita modifiche alla macchina XState esistente e riduce il rischio di regressione. La `toolWorkflowMachine` viene invocata N volte (una per step) dal processore, che gestisce il passaggio di contesto tra uno step e l'altro. Vedi Sezione "Implementation Strategy" per il dettaglio.

### 6. ToolWorkflowJob Status Storage

**Opzione A — Solo Redis (scelta per fase 1)**: BullMQ gestisce lo stato dei `ToolWorkflowJob` (waiting, active, completed, failed). I metadati aggiuntivi (progress per-step, artifact IDs) vengono salvati in un hash Redis con TTL:

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
  status         TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
  progress       JSONB DEFAULT '{}',
  result         JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_jobs_user_status ON tool_jobs(user_id, status);
CREATE INDEX idx_tool_jobs_project ON tool_jobs(project_id);
```

Nota: l'enum `status` include ora anche `cancelled` (aggiunto per CRIT-02 — vedi Sezione 10).

### 7. SSE ToolWorkflowJob Stream

Il FE dopo aver inviato il submit si connette a `GET /api/tools/jobs/:jobId/stream` per ricevere eventi in tempo reale sul `ToolWorkflowJob`. L'implementazione lato BE:

- BullMQ emette eventi (`completed`, `failed`, `progress`) sul worker
- Un `ToolWorkflowJobEventBus` (basato su Redis pub/sub o EventEmitter in-process) inoltra gli eventi al gestore SSE
- Il gestore SSE mantiene una mappa `jobId → Set<Response>` per broadcast a tutti i listener connessi
- Timeout: se nessun evento per 30s, invia heartbeat `:keepalive`

Per la fase 1, con worker in-process, si puo' usare un semplice `EventEmitter` Node.js. Per fase 2 (multi-processo), Redis pub/sub.

### 8. Idempotency e Retry

**Idempotency key** gia' implementata in `postgres-redis.idempotency.repository.ts`:
- Redis lock `SET NX EX 900` (15 minuti)
- Postgres `ON CONFLICT DO NOTHING` su `request_id`
- Se il lock esiste gia' → il `ToolWorkflowJob` e' duplicato, si restituisce il `jobId` esistente

**Idempotency key per-step (CRIT-01)**: il lock claimato al punto 1 del processore (Sezione 4) usa l'`idempotencyKey` grezzo del submit, scoped all'intero `ToolWorkflowJob`. Ogni step interno del loop deriva invece una propria chiave `${idempotencyKey}:${stepDescriptor.key}` prima di invocare `runSingleStepGeneration`/`runCrawlingStep`/`runScoringStep`, evitando che il lock claimato per lo step 1 blocchi come "duplicato" lo step 2 (vedi pseudocodice aggiornato in Sezione 4).

**Retry senza serializzazione**:
```typescript
new Worker('tool-workflow', processor, {
  attempts: 3,                              // 3 tentativi totali
  backoff: { type: 'exponential', delay: 2000 },  // 2s, 4s, 8s
  removeOnComplete: { age: 3600 * 24 },     // tieni completati per 24h
  removeOnFail: { age: 3600 * 24 * 7 },     // tieni falliti per 7 giorni
});
```

Il `ToolWorkflowJob` contiene un `idempotencyKey` nel payload. Se il worker crasha a meta' (es. dopo aver completato 2 step su 4), al retry il processore:
1. Controlla Redis/Postgres per artifact gia' generati con la stessa idempotency key per-step
2. Skips gli step gia' completati (riconosce gli artifact esistenti)
3. Riprende dallo step successivo

Questo e' un **retry con skip dei step completati**, non una serializzazione completa della macchina. I step completati sono determinati interrogando il DB per artifact con `stepKey` e `sessionId`.

**HIGH-04 — Tabella di decisione: retry BullMQ vs `regenerate` utente**

I due meccanismi sono **ortogonali** e non devono essere confusi nel processore. La tabella seguente li distingue esplicitamente lungo le dimensioni rilevanti:

| Dimensione | Retry automatico post-crash (BullMQ) | `regenerate` esplicito (utente) |
|---|---|---|
| **Trigger** | Worker crash o eccezione non gestita durante l'esecuzione del `ToolWorkflowJob`; BullMQ rilancia automaticamente (`attempts: 3`) | Azione utente esplicita sulla UI (`PrimaryActionPolicy = 'regenerate-current-step'`, DDD-020) su un `Artifact` esistente |
| **idempotencyKey** | **Stesso** `idempotencyKey` del submit originale (nessun cambiamento) — il retry BullMQ ri-esegue lo stesso `ToolWorkflowJob` | **Nuovo** `idempotencyKey` — e' un nuovo submit, quindi un nuovo `ToolWorkflowJob` con propria identita' (`jobId` diverso) |
| **WorkflowRunMode** | Nessun cambio — resta quello del `ToolWorkflowJob` originale (tipicamente `'new'`) | `WorkflowRunMode = 'regenerate'` (DDD-037), esplicitamente impostato nel payload del nuovo submit |
| **Comportamento su step gia' completati** | Skip automatico via query DB (stepKey + sessionId), come descritto sopra — nessun input utente coinvolto | Inietta `WorkflowStepBootstrap` (DDD-037) per riprendere da uno step specifico scelto dall'utente/dal sistema; puo' produrre incrementi sulla `GenerationSession` esistente (relazione 1:N `ToolWorkflowJob` → `GenerationSession`, DDD-227, provvisoria) |

Il processore non deve implementare un'unica funzione di "resume" condivisa tra i due casi: il retry BullMQ e' interamente interno al `ToolWorkflowJob` corrente (stesso `jobId`); `regenerate` crea sempre un `ToolWorkflowJob` nuovo e distinto.

### 9. Rate Limiting e Parallelismo

BullMQ gestisce nativamente:
- **Concurrency per worker**: `concurrency: 3` — max 3 `ToolWorkflowJob` processati in parallelo
- **Rate limiter globale**: `limiter: { max: 10, duration: 60_000 }` — max 10 `ToolWorkflowJob` al minuto
- **Single-flight guard per (userId, projectId, toolKey)** (HIGH-01): vedi Sezione 3 per il dettaglio su `group` (BullMQ Pro, disponibilita' OSS non confermata) e sul fallback Redis lock proposto per Fase 1

L'attuale rate limiting Redis (`INCR`/`EXPIRE` sliding window in `postgres-redis.usage.repository.ts`) viene **mantenuto** al livello HTTP (submit endpoint) come prima linea di difesa. Il rate limiting BullMQ e' una seconda linea per il worker.

### 10. Cancellazione ToolWorkflowJob (CRIT-02)

Chiude il gap critico "nessuna cancellazione server-side": oggi `CANCEL_GENERATION` e' puramente client-side (`AbortController.abort()` sulla connessione SSE browser) e non ha alcun effetto sul worker BE, che continua a eseguire il `ToolWorkflowJob` fino a completamento anche se il client si disconnette.

**Design**:

1. **Nuovo endpoint**: `POST /api/tools/jobs/:jobId/cancel`
   - Auth + ownership check identico al submit (stesso `userId` che ha creato il `ToolWorkflowJob`, o admin)
   - Effetto: imposta il flag `cancel_requested: true` su una chiave Redis `tool-job-cancel:{jobId}`, con **TTL 24h** (coerente con la retention del `ToolWorkflowJob` stesso)
   - Risposta immediata `202 Accepted` — la cancellazione non e' sincrona, viene applicata al prossimo controllo del processore (vedi punto 2)

2. **Punto di controllo nel processore**: il loop del processore (Sezione 4) controlla il flag Redis `tool-job-cancel:{jobId}` **all'inizio di ogni iterazione**, cioe' tra il completamento di uno step e l'avvio del successivo. Non viene interrotta una chiamata LLM/crawling/scoring gia' in corso — l'interruzione hard mid-invoke e' esplicitamente **fuori scope** per questa fase (richiederebbe abort propagation dentro `runSingleStepGeneration`/il chain actor invocato, non presente oggi).

3. **Nuovo stato**: l'enum di `status` del `ToolWorkflowJob` si estende da `queued/running/completed/failed` a `queued/running/completed/failed/cancelled`. Quando il flag di cancellazione e' rilevato, il processore:
   - marca `status: 'cancelled'` (via `updateJobProgress`)
   - interrompe il loop senza eseguire ulteriori step
   - restituisce gli `artifactIds` prodotti fino a quel punto (gli step completati restano validi e persistiti — nessun rollback)

4. **Non-goal esplicito**: interruzione hard di una chiamata LLM/crawling/scoring gia' in corso. Il controllo e' solo ai boundary tra step — un `ToolWorkflowJob` con uno step LLM lungo in esecuzione continuera' a completare quello step prima di fermarsi.

**AC-013 aggiornato** (vedi Sezione "Acceptance Criteria"): il test di verifica deve dimostrare che (a) la cancel request setta il flag Redis, (b) il processore rileva il flag al successivo boundary tra step e non avvia lo step successivo, (c) lo step in corso al momento della cancel request completa normalmente prima dell'arresto — non viene interrotto mid-invoke.

## Impact Assessment

| Layer | Modifica | Complessita' |
|---|---|---|
| **Contracts** | Nuovo tipo `SubmitJobRequest`, `JobStatusResponse`, `JobProgressEvent` (payload/wire types per il nuovo `ToolWorkflowJob` Aggregate Root) | Bassa — nuovi tipi, nessuna modifica a tipi esistenti |
| **BE server.ts** | Nuove route `POST /api/tools/jobs`, `GET /api/tools/jobs/:id`, `GET /api/tools/jobs/:id/stream`, `POST /api/tools/jobs/:id/cancel` | Media — nuove route, handler dedicati |
| **BE worker.ts** | Nuovo file, entry point per il worker. Connessione BullMQ + Redis + Postgres | Media — codice nuovo, pattern da `job-event-bridge.ts` e `job-progress-serializer.ts` (prerequisiti) |
| **BE tool-workflow-job-processor.ts** | Nuovo file, loop step con routing per `WorkflowStepType` e chiamate a generation system / crawling / scoring | Alta — e' il cuore del nuovo sistema |
| **BE generation-system** | **Fase 1**: nessuna modifica, invocato 1 volta per step dal processore. **Fase 2 (opzionale)**: supporto multi-step nativo | Fase 1: Nessuna. Fase 2: Media |
| **BE tool-prompts** | Nessuna modifica — i prompt restano invariati | Nessuna |
| **BE handlers (orchestrate)** | Mantenuti per backward compatibility (tool singoli, debug) | Nessuna |
| **FE tool-page.machine** | **Semplificazione drastica**: rimozione `pendingStepStart`, auto-chain, `STEP_REQUEST_DISPATCHED`. Nuovo path: `submitting` → `running` (passivo, consuma SSE) → `completed` | Media — piu' rimozione che aggiunta |
| **FE useToolPageRunController** | Sostituzione dell'intero bridge `useLayoutEffect` (200+ linee) con `submitJob()` + consumatore SSE passivo | Media — semplificazione netta |
| **FE tool-page-selectors** | Rimozione selettori di auto-chain. Mantenuti quelli di extraction info e form state | Bassa |
| **FE new: useJobStream** | Nuovo hook per consumare SSE `ToolWorkflowJob` stream | Bassa |
| **Infra-DB** | Migrazione per tabella `tool_jobs` (fase 2). Fase 1: solo Redis | Bassa |
| **Redis** | Nuove chiavi per stato del `ToolWorkflowJob`, cancellazione, e pub/sub (gestite da BullMQ + hash manuali per progress) | Bassa |

## Implementation Strategy

### Fase 1 — Minimum Viable (2 settimane)

**Obiettivo**: `ToolWorkflowJob` system funzionante con worker in-process, senza modifiche a `generation-system`.

1. **`tool-workflow-job-processor.ts`** — loop che esegue step uno alla volta, instradando per `WorkflowStepType` (Sezione 4). Include implementazione completa di `runCrawlingStep` e `runScoringStep` (wrapper che delegano a `crawlingChainMachine`/`scoringChainMachine` esistenti in `generation-system.execution.states.ts`), non piu' sketched come TODO. Il pattern `WorkflowStepType` e' il meccanismo di estensione per futuri tool API-driven: nuovi tipi di step non-generativi richiederanno solo un wrapper di delega, nessuna modifica al loop centrale. Con questa implementazione, **tutti i tool esistenti funzionano end-to-end in Fase 1**, incluso `geometric` (4 step: crawling + scoring + 2 generation).
2. **`worker.ts`** — worker BullMQ in-process, avviato da `server.ts` in sviluppo
3. **Endpoint submit** — `POST /api/tools/jobs`, validazione, accodamento
4. **Endpoint status** — `GET /api/tools/jobs/:id`, lettura da Redis hash
5. **Endpoint stream** — `GET /api/tools/jobs/:id/stream`, SSE con `EventEmitter` in-process
6. **Endpoint cancel** — `POST /api/tools/jobs/:jobId/cancel` (Sezione 10, CRIT-02)
7. **FE semplificazione** — nuovo hook `useToolPageSubmitController` che sostituisce `useToolPageRunController`. La `toolPageMachine` riceve un evento `SUBMIT_JOB` e transita in `running` passivo consumando SSE. Nessuna modifica ai componenti UI (continuano a ricevere `completedSteps` e `artifacts` dal context, la fonte cambia ma l'interfaccia a valle no)
8. **Feature flag via `BackendCapabilities`** (MED-04) — nuovo campo `toolsJobSystem: boolean` in `BackendCapabilities`. Il FE usa `readFlag` per instradare tra `submitJob()` (nuovo) e `handlePrimaryAction()` (vecchio). Il flag env `TOOL_WORKFLOW_USE_JOB_SYSTEM` resta dettaglio BE.
9. **Resume dopo reload** (HIGH-02 workaround Fase 1) — `useJobStream` persiste `jobId` in `sessionStorage` con chiave `tool-job:{projectId}:{toolKey}`. Al mount, se esiste un `jobId` per lo scope corrente, chiama `GET /api/tools/jobs/:jobId` e si riconnette allo stream.

**File nuovi:**
- `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- `apps/backend/src/lib/runtime/tool-workflow-job-queue.ts` (Queue/Worker setup)
- `apps/backend/src/lib/runtime/auth-http/tools/tools-job-handlers.ts`
- `apps/backend/src/lib/runtime/auth-http/tools/tools-job-stream-handler.ts`
- `apps/backend/src/worker-entry.ts` (entry point per worker standalone)
- `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.ts`
- `apps/frontend/src/features/tools/runtime/useJobStream.ts` — hook consumatore SSE via `fetch()` + `ReadableStream` (non `EventSource` — GAP-FE-04: `fetch()` supporta header auth nativi, pattern gia' usato in produzione per generation stream)

**File modificati:**
- `apps/backend/src/server.ts` — nuove route, avvio worker in-process (opzionale, via env `TOOL_WORKFLOW_WORKER_IN_PROCESS=true`)
- `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts` — registrazione nuove route
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — nuovo stato `submitting`, rimozione path di auto-chain
- `apps/frontend/src/features/tools/machines/tool-page.types.ts` — nuovi eventi `SUBMIT_JOB`, `JOB_PROGRESS`, `JOB_COMPLETED`, `JOB_FAILED`
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — composizione con `useToolPageSubmitController` invece di `useToolPageRunController`
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — il CTA chiama `submitJob()` invece di `handlePrimaryAction()`
- `packages/contracts/src/index.ts` — nuovi tipi `ToolWorkflowJob`-correlati

**Non modificati (fase 1):**
- `generation-system.execution.states.ts` — continua a eseguire single-step
- `toolWorkflowMachine` — invariata
- Tutti i prompt file — invariati
- `tools-orchestrate-handlers.ts` — mantenuto per backward compat e debug
- `useToolPageRunController.ts` — mantenuto (coesiste), feature-flagged

### Frontend Implementation Details

Le seguenti decisioni chiudono i 6 gap FE identificati nella review zero-regression (2026-07-24).

#### GAP-FE-01 — Destino di `generationLifecycleMachine`

Il nuovo stato `running` **non invoca** `generationLifecycleMachine`. Gli eventi `STEP_DONE`, `STEP_FAILED`, `RETRY_STEP` vengono **rimossi** dal tipo `ToolPageEvent` e dalle transizioni della macchina. Le azioni `forwardStepOutcomeToLifecycle` e `controlGenerationLifecycle` vengono rimosse. La `generationLifecycleMachine` resta nel codebase (usata dal path legacy `useToolPageRunController`) ma non e' referenziata dal nuovo path `submitting` → `running`.

#### GAP-FE-02 — `latestArtifactByStep` con artifact parziale

SSE `JOB_PROGRESS` porta solo `{ step, status, artifactId? }` — non artifact completi. La nuova action `syncJobProgress` crea oggetti `GenerationArtifact` **parziali** con solo `artifactId` popolato (campi `content`, `format`, `type` rimangono `undefined`). I consumer di `latestArtifactByStep` (`ToolPageTemplate`, `ToolGenerationFlowVertical`) accedono solo a `artifactId` per routing e download — nessun consumer legge `content`/`format`/`type` da `latestArtifactByStep`. Verificato: `completedArtifactsByStep` in `useToolPage.ts:140` estrae solo `artifactId`.

#### GAP-FE-03 — `runRequestPrefix` sostituito da `jobId`

Nel nuovo sistema, `ToolPageContext.runRequestPrefix` viene **sostituito** da `ToolPageContext.pendingJobId` (popolato dall'azione su `SUBMIT_JOB`). Il view model `buildToolPageViewModel` usa `runRequestPrefix !== null` per determinare `isCurrentRunComplete` (riga 89) — il check equivalente diventa `pendingJobId !== null`. Nessuna modifica alla firma del view model: il campo si chiama ancora `runRequestPrefix` nel `ToolPageContext` ma viene popolato con `jobId` nel nuovo path. Il comportamento e' equivalente: oggi `runRequestPrefix` e' FE-generated per gruppo di step; domani `jobId` e' BE-assigned per l'intero workflow.

#### GAP-FE-04 — Auth su SSE `useJobStream`

Il browser `EventSource` API non supporta header custom. La proposta adotta **`fetch()` + `ReadableStream`** per il parsing SSE manuale (piu' solido di `EventSource` con token in query param). L'hook `useJobStream`:

```typescript
const response = await fetch(`/api/tools/jobs/${jobId}/stream`, {
  headers: { 'Authorization': `Bearer ${auth.token}` },
  signal: abortController.signal,
});
const reader = response.body!.getReader();
// Parsing SSE manuale: split su '\n\n', parse 'event:'/'data:' lines
```

Pattern gia' usato in produzione per lo streaming generazione (`generationStream` in `useToolPageRunController.ts` usa `fetch()` con `ReadableStream`, non `EventSource`). Auth header funziona nativamente con `fetch()`.

#### GAP-FE-05 — Nome env var per `BackendCapabilities.toolsJobSystem`

```typescript
// In backend-capabilities.ts:
toolsJobSystem: readFlag(import.meta.env.VITE_CAP_TOOLS_JOB_SYSTEM, false),

// In .env / .env.local:
VITE_CAP_TOOLS_JOB_SYSTEM=true   // per sviluppo con nuovo sistema
```

Il flag env lato BE (`TOOL_WORKFLOW_USE_JOB_SYSTEM`) controlla quali tool key usano il nuovo processore. Il flag `VITE_CAP_TOOLS_JOB_SYSTEM` controlla se il FE mostra il path `submitJob()` o il path legacy. Sono indipendenti: il BE puo' abilitare il nuovo sistema per `geometric` anche se il FE non ha il flag acceso (il FE usa il path legacy, compatibile).

#### GAP-FE-06 — `PROGRESS_SYNCED` mantenuto per hydration/resume

L'evento `PROGRESS_SYNCED` viene **mantenuto** nel tipo `ToolPageEvent` per i path di hydration e resume (che sono invariati — Category A). Nel nuovo path `submitting` → `running`, il progress arriva via `JOB_PROGRESS` (SSE-driven). `PROGRESS_SYNCED` non viene dispatchato durante `running` ma resta attivo per `HYDRATE_REQUESTED` → `hydrating` → `configuring` e per i poll di aggiornamento progress da artifact esistenti.

#### Schema macchina a stati aggiornato

```
configuring ──(SUBMIT_JOB)──→ submitting ──(http 200)──→ running ──(JOB_COMPLETED)──→ completed
     │                              │                        │
     │                              └──(http error)──→ configuring.generationFailed
     │                                                       │
     │                              running ──(JOB_FAILED)──→ configuring.generationFailed
     │                              running ──(CANCEL_GENERATION)──→ configuring.clean
     │
     └──(resto invariato: HYDRATE_REQUESTED, PROGRESS_SYNCED, extraction, briefing, ecc.)
```

### Frontend UI Design

Le seguenti indicazioni di design (2026-07-24) guidano l'implementazione dei componenti UI per la visualizzazione dei `ToolWorkflowJob`. Due viste distinte: Member (workspace) e Admin (system-wide).

#### Componenti nuovi

| Componente | File | Scopo |
|---|---|---|
| `ToolWorkflowJobPanel` | `apps/frontend/src/features/tools/ui/ToolWorkflowJobPanel.tsx` | Vista Member: mostra stato, progresso per-step, chunk stream, azioni cancel |
| `ToolWorkflowJobStepTracker` | `apps/frontend/src/features/tools/ui/ToolWorkflowJobStepTracker.tsx` | Sub-component: lista verticale step con iconografia per stato (`idle`/`running`/`done`/`error`) |
| `AdminToolWorkflowJobsPage` | `apps/frontend/src/features/admin/pages/AdminToolWorkflowJobsPage.tsx` | Vista Admin: Data Table View system-wide con filtri e azioni |
| `AdminToolWorkflowJobsToolbar` | `apps/frontend/src/features/admin/ui/AdminToolWorkflowJobsToolbar.tsx` | Toolbar filtri admin (status, tool, user) |
| `useToolWorkflowJobStream` | `apps/frontend/src/features/tools/runtime/useToolWorkflowJobStream.ts` | Hook SSE: `fetch()` + `ReadableStream`, dispatch `JOB_PROGRESS`/`JOB_COMPLETED`/`JOB_FAILED` |
| `useAdminToolWorkflowJobsQuery` | `apps/frontend/src/features/admin/runtime/useAdminToolWorkflowJobsQuery.ts` | SWR query per `GET /api/tools/jobs` (Fase 2; Fase 1: stub) |

#### Posizionamento nell'interfaccia

**Member**: `ToolWorkflowJobPanel` sostituisce `ToolGenerationFlowVertical` nella colonna destra di `ToolPageTemplate` quando `pendingJobId !== null`. Nessuna modifica al layout grid a due colonne. Quando `pendingJobId === null`, `ToolGenerationFlowVertical` resta invariato (path legacy).

**Admin**: nuova voce "Tool Jobs" nella nav admin, route `/admin/tool-jobs`, posizionata dopo "Sessions". Layout standard `AdminPageContainer` + `ListingTableSection` con azioni bordered-chip.

#### Stati visuali `StatusBadge`

| Stato | Variant | Label |
|---|---|---|
| `queued` | `neutral` (gray) | Queued |
| `running` | `info` (blue) | Running |
| `completed` | `success` (green) | Completed |
| `failed` | `error` (red) | Failed |
| `cancelled` | `warning` (amber) | Cancelled |

Tutti i token CSS mappano a variabili esistenti del design system — nessun nuovo token richiesto.

#### Step tracker per-step

| Stato step | Icona | ARIA |
|---|---|---|
| `idle` | Cerchio vuoto (gray) | `aria-label="Step {label}: waiting"` |
| `running` | Cerchio pulsante (blue) | `aria-current="step"` |
| `done` | Checkmark (green) | `aria-label="Step {label}: completed"` |
| `error` | X (red) | `aria-label="Step {label}: failed"` |

Lo step tracker riusa la stessa computazione `stepItems` di `ToolPageTemplate` (righe 221-231), alimentata da `JOB_PROGRESS` SSE invece che da `PROGRESS_SYNCED`.

#### Admin Data Table

Colonne: `jobId`, `status` (StatusBadge), `toolKey`, `projectId`, `userId`, `progress` (N/M), `createdAt`, `actions` (Inspect/Cancel/Retry via bordered-chip).

Filtri: Status (select), Tool (select), User (autocomplete — Fase 2).

#### Accessibilità

- Live regions: `aria-live="polite"` su messaggi di stato e chunk stream
- `role="alert"` su messaggi di errore
- `aria-current="step"` sullo step in esecuzione
- Focus management: dopo submit → focus su `ToolWorkflowJobPanel` heading; dopo cancel → focus su CTA primario
- Tutti gli `aria-label` usano chiavi `appCopy`, mai stringhe hardcoded

#### Responsive

- Desktop (>980px): step tracker verticale completo
- Tablet (760-980px): stesso layout, padding ridotto, label con ellipsis se necessario
- Mobile (<760px): step tracker collassa a stepper orizzontale a punti numerati; `ToolWorkflowJobPanel` appare sotto il Setup Panel (grid stacking nativo)

### Fase 2 — Ottimizzazione (1 settimana, opzionale)

1. **Tabella `tool_jobs` in Postgres** — migrazione, sostituzione Redis hash per storage permanente
2. **Redis pub/sub per multi-processo** — sostituzione `EventEmitter` con Redis pub/sub per SSE cross-processo
3. **Group concurrency per utente** — confermare la disponibilita' nativa in BullMQ OSS (vedi Sezione 3, HIGH-01) oppure consolidare il fallback Redis lock introdotto in Fase 1 come soluzione definitiva
4. **Integration test end-to-end** — test che simulano submit `ToolWorkflowJob` → stream → completamento
5. **Endpoint discovery `ToolWorkflowJob`** (HIGH-02) — `GET /api/tools/jobs?projectId=&toolKey=` per recuperare job attivi/recenti, sostituendo il workaround `sessionStorage` della Fase 1 con vera discovery multi-job
6. **Aggregazione costo/token** (HIGH-03) — campo `usage` in `GET /api/tools/jobs/:id` con somma `LlmUsageMetrics` di tutti gli artifact della `GenerationSession` (query `SUM()` su Postgres)
7. **Deployment worker separato** (MED-03) — secondo servizio Railway con `worker-entry.ts` come entry point, `TOOL_WORKFLOW_WORKER_IN_PROCESS=false` sul server HTTP

### Fase 3 — Multi-step nativo in XState (1 settimana, opzionale)

1. `toolGenerationFlow` invoca `toolWorkflowMachine` con `steps: plan.steps` (array completo)
2. La macchina itera internamente gli step senza uscire dalla sessione
3. Unica sessione SSE per l'intero workflow

## Risks and Controls

| Risk | Control |
|---|---|
| **Regressione tool esistenti** | Feature flag `BackendCapabilities.toolsJobSystem` (MED-04) per tool key. Attivazione graduale: prima `geometric` (il piu' complesso, 4 step con crawling + scoring — verifica completa del routing `WorkflowStepType`), poi `blog-article-generator` (3 step generativi — verifica loop multi-step), poi tutti. Backward compat garantita: i tool non migrati continuano col vecchio path `useToolPageRunController` |
| **Worker crash durante un `ToolWorkflowJob`** | BullMQ retry automatico (3 tentativi). Idempotency key per-step previene side-effects duplicati (CRIT-01, Sezione 4/8). Skip step gia' completati (lettura da DB) |
| **Redis pieno / memoria** | BullMQ `removeOnComplete` + TTL su hash di progress (24h). Eventuali artifact sono gia' in Postgres |
| **Deadlock idempotency su retry multipli** | Redis lock TTL 900s. Dopo scadenza, il lock si libera automaticamente. Il processore controlla Postgres prima di rieseguire |
| **SSE stream disconnesso** | FE puo' sempre chiamare `GET /:jobId` per lo stato corrente e riconnettersi allo stream. Stream replay come gia' implementato in `generation-stream-replay.ts` |
| **Aumento latenza percepita (submit → primo progresso)** | Il primo step parte immediatamente dopo extraction. Per tool single-step, la latenza e' identica a oggi. Per multi-step, l'utente vede progresso gia' dal primo step, senza attendere tutto il workflow |
| **Compatibilita' con `runMode: resume/regenerate`** | Il `ToolWorkflowJob` payload include `intent: 'resume'` o `'regenerate'`. Il processore usa `resolveWorkflowRunMode` esistente e passa `bootstrap` con i contenuti degli step precedenti (recuperati da DB) — vedi Sezione 8, tabella di decisione retry vs regenerate (HIGH-04) |

## Non-Goals (Cosa NON Facciamo)

1. **Serializzazione XState snapshot** — inutilizzabile per il nostro caso: gli `invoke` ripartono da zero dopo un restore (documentazione XState v5), causando chiamate LLM duplicate. I `ToolWorkflowJob` falliti ripartono da zero con idempotency key, che previene side-effects duplicati
2. **Scheduling differito del `ToolWorkflowJob`** (es. "esegui alle 3:00") — BullMQ lo supporta nativamente (`delay`), ma non e' un requisito attuale. Si potra' aggiungere in futuro
3. **Code multiple per tipologia** (generation, export, email) — fase 1 usa una singola coda `tool-workflow`. Si partizionera' quando servira'
4. **Dashboard BullMQ / Bull Board** — utile per debug ma non bloccante. Si puo' aggiungere dopo
5. **Modifica dei prompt** — i prompt file restano identici. Il processore li risolve con lo stesso meccanismo `resolveToolPrompt` di oggi
6. **Human-in-the-loop gate a meta' workflow** (LOW-02) — il modello BE-driven fully-automatic elimina i checkpoint naturali che il modello FE-driven offriva implicitamente (ogni step era un punto in cui il FE poteva pausare per raccogliere input umano). Questo trade-off e' accettato consapevolmente: il guadagno in semplicita'/affidabilita' (niente auto-chain FE, niente N+1 round-trip, niente dipendenza dal tab aperto) supera il costo futuro. Se il requisito human-in-the-loop emergera', il `ToolWorkflowJob` model lo supporta tramite un nuovo stato `paused-awaiting-feedback` nell'enum `status`, con `POST /submit` per riprendere — un'estensione naturale, non un redesign

## Acceptance Criteria

- [ ] AC-001: `POST /api/tools/jobs` accetta un payload completo, valida, e restituisce `jobId` (identificatore del `ToolWorkflowJob` creato)
- [ ] AC-002: Il worker esegue tutti gli step di un tool multi-step senza intervento FE
- [ ] AC-003: `GET /api/tools/jobs/:id` restituisce lo stato corrente del `ToolWorkflowJob` (step corrente, step completati)
- [ ] AC-004: `GET /api/tools/jobs/:id/stream` emette eventi SSE di progresso e chunk
- [ ] AC-005: `ToolWorkflowJob` fallito viene riprovato automaticamente (max 3 tentativi)
- [ ] AC-006: Idempotency key funziona: submit duplicato restituisce il `ToolWorkflowJob` esistente
- [ ] AC-007: Tool single-step (youtube-description, brief-generator) funzionano come prima
- [ ] AC-008: Tool multi-step (geometric, blog-article-generator) completano tutti gli step
- [ ] AC-009: Il FE mostra il progresso passo-passo senza logica di auto-chain
- [ ] AC-010: `npm run typecheck && npm run test` passa in tutti i workspace
- [ ] AC-011: Backward compat: i tool non migrati continuano a funzionare col vecchio sistema
- [ ] AC-012: Ogni step interno al `ToolWorkflowJob` usa un idempotency key derivato per-step (es. `${idempotencyKey}:${stepKey}`), non l'idempotency key grezzo del submit — verificato con test che dimostra che step 2 non viene bloccato come duplicato dal lock Redis creato per step 1 (Critical Gap #1, chiuso — vedi Sezione "Detailed Design" #4 e #8)
- [ ] AC-013: Esiste un endpoint `POST /api/tools/jobs/:jobId/cancel` che imposta un flag di cancellazione Redis (`tool-job-cancel:{jobId}`) verificato dal processore **tra uno step e il successivo** (non un abort mid-invoke) — verificato con test che dimostra che (a) la cancel request setta il flag, (b) il processore non avvia lo step successivo dopo aver rilevato il flag, (c) lo step in corso al momento della richiesta completa normalmente prima dell'arresto, (d) il `ToolWorkflowJob` transita a `status: 'cancelled'` (Critical Gap #3, chiuso — vedi Sezione "Detailed Design" #10)
- [ ] AC-014: Il processore instrada per `WorkflowStepType` (`extraction`, `generation`, `acquisition`, `crawling`, `scoring`) invece di chiamare uniformemente `runSingleStepGeneration` per ogni step — verificato con test end-to-end sul tool `geometric` che dimostra corretta esecuzione dello step `serp-crawling` (crawling) e `competitor-scoring` (scoring) tramite i rispettivi wrapper (`runCrawlingStep`/`runScoringStep`, delegati ai chain actor dei bounded context dedicati), non tramite il path LLM-generativo (Critical Gap #4, chiuso — vedi Sezione "Detailed Design" #4)
- [ ] AC-015 (nuovo): il single-flight guard su `(userId, projectId, toolKey)` (HIGH-01) e' implementato — tramite `group` nativo BullMQ se confermato disponibile in OSS, altrimenti tramite il Redis lock `tool-job-active:{userId}:{projectId}:{toolKey}` — verificato con test che dimostra che un secondo submit concorrente per lo stesso scope riceve `409 Conflict` con il `jobId` del `ToolWorkflowJob` attivo, invece di accodare un secondo `ToolWorkflowJob`

## References

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

---

## Review Findings — Gaps and Risks Identified

Cross-check eseguito dal DDD Governance Gatekeeper contro `domain-ubiquitous-language-glossary.md`, `domain-bounded-context-map.md`, e `domain-naming-decision-log.md` (ordine di lettura obbligatorio per AGENTS.md), oltre a verifica diretta del codice sorgente citato. I 14 punti seguenti sono validi findings della review precedente (il punto relativo al modello crediti e' stato riscritto come nota positiva in "Infrastruttura Gia' Disponibile" — non e' un gap). **Aggiornamento 2026-07-23**: TUTTI i gap sono stati chiusi con decisioni esplicite in questa revisione (v1.5). I 3 gap Critical (CRIT-01/02/03) hanno soluzioni di design nel Detailed Design. I 5 gap High sono tutti risolti: HIGH-01 (fallback Redis lock), HIGH-02 (workaround sessionStorage Fase 1 + endpoint discovery Fase 2), HIGH-03 (aggregazione costo/token Fase 2), HIGH-04 (tabella di decisione retry vs regenerate), HIGH-05 (Backend No-Regression Gates). I 4 gap Medium e i 2 Low sono tutti risolti con decisioni documentate. Nessun gap bloccante residuo per l'inizio della Fase 1.

### Critical

#### CRIT-01 — Idempotency key collide tra step nello stesso `ToolWorkflowJob` — **RISOLTO**
- **Descrizione**: Il processore pseudocodice (`processToolWorkflowJob`, Sezione "Detailed Design" #4) riusa lo stesso `idempotencyKey` del submit per ogni step interno del loop. Il lock Redis `SET NX EX 900` su `generation:idempotency:lock:{userId}:{projectId}:{endpoint}:{idempotencyKey}` (verificato in `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts`, metodo `getLockKey` → `buildIdempotencyRedisLockKey`) claim il lock per il primo step e lo rilascia solo su `finalizeSuccess`/`markFailed`. Se il secondo step del loop tenta di claimare lo stesso lock con lo stesso `idempotencyKey`, il risultato e' `conflict` (`idempotency_conflict`), bloccando l'intero `ToolWorkflowJob` dopo il primo step.
- **Impatto**: Ogni tool multi-step (`geometric`, `blog-article-generator`, ecc.) fallirebbe deterministicamente dopo il primo step in produzione — non un edge case, ma il path principale del nuovo sistema.
- **Azione correttiva raccomandata**: derivare un idempotency key per-step, es. `${idempotencyKey}:${stepKey}`, prima di invocare `runSingleStepGeneration` per ciascuno step nel loop del processore.
- **Riferimento codice verificato**: `apps/backend/src/lib/adapters/postgres-redis.idempotency.repository.ts` (lock key construction, TTL 900s via `this.redisLockTtlSeconds`).
- **Soluzione adottata**: il pseudocodice del processore in Sezione "Detailed Design" #4 deriva ora `stepIdempotencyKey = ${idempotencyKey}:${stepDescriptor.key}` a ogni iterazione del loop, prima di invocare `runSingleStepGeneration`/`runCrawlingStep`/`runScoringStep`. Tabella di decisione aggiuntiva in Sezione 8 (HIGH-04) distingue questo meccanismo dal retry BullMQ.
- **AC di verifica**: AC-012.

#### CRIT-02 — Nessuna cancellazione server-side — **RISOLTO**
- **Descrizione**: Oggi `CANCEL_GENERATION` e' puramente client-side (`AbortController.abort()` sulla connessione SSE browser). Il BE non ha endpoint di cancel/abort — la generazione continua fino a completamento anche se il client si disconnette. Con `ToolWorkflowJob` che durano minuti attraverso 4+ step senza supervisione client, l'assenza di un endpoint di cancellazione server-side diventa un gap strutturale, non solo un'inefficienza.
- **Impatto**: Costi LLM e consumo crediti/artifact-gate continuano ad accumularsi anche quando l'utente ha esplicitamente richiesto l'interruzione (o ha chiuso il tab), senza possibilita' di interrompere il worker.
- **Azione correttiva raccomandata**: introdurre `POST /api/tools/jobs/:jobId/cancel` che segnali al worker BullMQ di interrompere l'esecuzione (es. tramite controllo di un flag di cancellazione in Redis, verificato tra uno step e il successivo nel loop del processore).
- **Soluzione adottata**: nuova Sezione "Detailed Design" #10 "Cancellazione ToolWorkflowJob" definisce l'endpoint `POST /api/tools/jobs/:jobId/cancel`, il flag Redis `tool-job-cancel:{jobId}` (TTL 24h), il controllo al boundary tra step nel loop del processore (Sezione 4), e il nuovo stato `cancelled` nell'enum `status`. L'interruzione hard mid-invoke resta un non-goal esplicito.
- **AC di verifica**: AC-013 (aggiornato per riflettere il design specifico: check tra step, non abort mid-invoke).

#### CRIT-03 — Il processore pseudocodice ignora step non-generativi (crawling/scoring) — **RISOLTO**
- **Descrizione**: `generation-system.execution.states.ts` ha flussi distinti (`extractionFlow`, `crawlingFlow`, `scoringFlow`, `toolGenerationFlow`) instradati per `WorkflowStepType`. Il tool `geometric` ha step `serp-crawling` (`WorkflowStepType = 'crawling'`) e `competitor-scoring` (`WorkflowStepType = 'scoring'`) che sono non-LLM e delegano rispettivamente al bounded context Crawling & Extraction e Competitor Analysis (vedi `domain-bounded-context-map.md`, DDD-116). Il pseudocodice del processore (Sezione "Detailed Design" #4) chiama uniformemente `runSingleStepGeneration` per ogni `stepDescriptor` nel loop, senza instradare per `WorkflowStepType`.
- **Impatto**: Il tool `geometric` (il tool esplicitamente citato come primo target di rollout nella tabella Risks/feature flag) non funzionerebbe correttamente con il nuovo sistema: gli step di crawling e scoring verrebbero erroneamente trattati come step generativi LLM.
- **Azione correttiva raccomandata**: il processore deve instradare per `stepDescriptor.type` (`WorkflowStepType`), richiamando il chain actor appropriato (`crawlingChainMachine`, `scoringChainMachine` quando implementati, o l'equivalente wrapper non-XState) invece di assumere sempre `runSingleStepGeneration`.
- **Riferimento codice verificato**: `apps/backend/src/lib/machines/generation-system.execution.states.ts` (flussi distinti per tipo), `domain-bounded-context-map.md` righe 234, 236 (traduzione `WorkflowStepType = 'crawling'`/`'scoring'` verso i bounded context dedicati).
- **Soluzione adottata**: il pseudocodice del processore in Sezione "Detailed Design" #4 instrada ora esplicitamente su `stepDescriptor.type` con un blocco `switch`: `'generation' | 'extraction' | 'acquisition'` → `runSingleStepGeneration`; `'crawling'` → `runCrawlingStep` (wrapper verso `crawlingChainMachine`); `'scoring'` → `runScoringStep` (wrapper verso `scoringChainMachine`). Entrambi i wrapper sono implementati completamente in Fase 1, delegando ai chain actor esistenti in `generation-system.execution.states.ts`. Il pattern `WorkflowStepType` e' il meccanismo di estensione per futuri tool API-driven.
- **AC di verifica**: AC-014.

### High

#### HIGH-01 — Nessun single-flight guard su (userId, projectId, toolKey) — **RISOLTO (conferma: solo BullMQ Pro)**
- **Descrizione**: `sessionId` (`WorkflowSessionIdentifier`, DDD-047) e' generato FE-side senza controllo unicita' server-side. L'idempotency key e' opzionale nel payload del submit — se il FE non lo passa o lo rigenera, nulla impedisce submit duplicati concorrenti per lo stesso `(userId, projectId, toolKey)`.
- **Impatto**: Doppia esecuzione dello stesso workflow, doppio consumo di crediti/artifact-gate, doppie chiamate LLM.
- **Soluzione adottata**: **Confermato da Context7 (2026-07-24): `group: { id: ... }` con group-concurrency e' esclusivo di BullMQ Pro (`WorkerPro` da `@taskforcesh/bullmq-pro`), NON disponibile in BullMQ OSS v5.78.0.** Il fallback Redis lock applicativo `SET NX EX <ttl>` su `tool-job-active:{userId}:{projectId}:{toolKey}`, acquisito al submit e rilasciato a `completed`/`failed`/`cancelled`, e' l'unica strada percorribile in Fase 1. Nuovo AC-015 verifica il comportamento (`409 Conflict` su submit concorrente). La sintassi `group: { id }` nello pseudocodice `worker.ts` (Sezione 3) e' da rimuovere/commentare nell'implementazione effettiva.

#### HIGH-02 — Nessun endpoint per riscoprire un `ToolWorkflowJob` in corso dopo reload pagina — **RISOLTO (deferito a Fase 2)**
- **Descrizione**: Non e' definito un endpoint per il FE per recuperare `ToolWorkflowJob` attivi dopo un reload di pagina o riapertura del browser (es. `GET /api/tools/jobs?projectId=&toolKey=`).
- **Impatto**: L'utente perde visibilita' sullo stato di un `ToolWorkflowJob` in corso se ricarica la pagina prima del completamento, anche se il worker BE continua a processarlo.
- **Soluzione adottata**: **Fase 1 — workaround FE**: il FE persiste `jobId` in `sessionStorage` con chiave `tool-job:{projectId}:{toolKey}`. Al mount, se esiste un `jobId` per lo scope corrente, chiama `GET /api/tools/jobs/:jobId` per recuperare lo stato e riconnettersi allo stream. Questo copre il caso piu' comune (reload accidentale nella stessa sessione browser). **Fase 2 — endpoint di discovery**: l'endpoint `GET /api/tools/jobs?projectId=&toolKey=` verra' aggiunto insieme alla tabella Postgres `tool_jobs` (Fase 2), consentendo la vera discovery multi-job anche attraverso sessioni browser diverse.
- **AC di verifica**: l'hook `useJobStream` deve supportare il resume da `jobId` persistito in `sessionStorage` (da includere in FE-GATE-D01).

#### HIGH-03 — Nessuna aggregazione di costo/token a livello `ToolWorkflowJob` — **RISOLTO (deferito a Fase 2)**
- **Descrizione**: Costo e token sono oggi salvati per singolo artifact (`LlmUsageMetrics` per artifact) senza aggregazione per sessione/workflow.
- **Impatto**: `GET /api/tools/jobs/:id` non espone un costo totale del `ToolWorkflowJob`, impedendo trasparenza sul costo complessivo di un workflow multi-step (anche se il credito addebitato e' singolo — vedi nota positiva sul modello crediti — token/cost LLM aggregati restano utili per audit e diagnostica).
- **Soluzione adottata**: **Fase 1**: `GET /api/tools/jobs/:id` restituisce solo `status` e `progress` — nessuna metrica di costo/token aggregata. **Fase 2**: con l'introduzione della tabella Postgres `tool_jobs`, l'aggregazione sara' una query `SUM()` sugli `LlmUsageMetrics` di tutti gli artifact appartenenti alla `GenerationSession` del `ToolWorkflowJob`, esposta nel campo `usage` della risposta. Nessun impatto sul path critico del sistema in Fase 1 — solo trasparenza/audit rimandata.
- **Stato**: non bloccante per Fase 1.

#### HIGH-04 — Conflitto non risolto tra "regenerate step N" e "retry-skip-completati" — **RISOLTO**
- **Descrizione**: La proposal introduce un meccanismo di retry-skip-completati per `ToolWorkflowJob` falliti (Sezione "Idempotency e Retry", punto 8), ma non discute esplicitamente la relazione con l'intent utente `regenerate` esistente (`WorkflowRunMode = 'regenerate'`, DDD-037, che risolve `primaryTargetStep = sourceStep` e inietta `WorkflowStepBootstrap`).
- **Impatto**: Ambiguita' semantica tra due meccanismi che entrambi "riprendono da un punto intermedio": il retry automatico post-crash (skip step completati, stessa idempotency key) e il `regenerate` esplicito dell'utente (bootstrap da un artifact specifico, nuova intent). Senza chiarimento, rischio di collisione di logica nel processore.
- **Azione correttiva raccomandata**: documentare esplicitamente che i due meccanismi sono ortogonali — il retry BullMQ e' infrastrutturale (stesso `ToolWorkflowJob`, stesso `idempotencyKey`, nessun cambio di `WorkflowRunMode`), mentre `regenerate` e' un nuovo `ToolWorkflowJob` con `intent: 'regenerate'` e proprio `WorkflowStepBootstrap`. Aggiungere un diagramma o tabella di decisione nel processore.
- **Soluzione adottata**: Sezione "Detailed Design" #8 include ora una tabella di decisione esplicita ("HIGH-04 — Tabella di decisione: retry BullMQ vs `regenerate` utente") che distingue i due meccanismi lungo le dimensioni trigger, `idempotencyKey`, `WorkflowRunMode`, e comportamento sugli step gia' completati.

#### HIGH-05 — Nessun BE No-Regression Gate equivalente al FE — **RISOLTO**
- **Descrizione**: La sezione "Frontend No-Regression Gates" (vedi sotto, non modificata da questa revisione) e' dettagliata con 22 file categorizzati, ma non esiste una sezione equivalente per il backend (es. `runtime.geometric-e2e.test.ts`, `runtime.acquisition-workflow.machine.test.ts`, `runtime.scoring.test.ts`).
- **Impatto**: Asimmetria di governance — il rischio di regressione BE (dove risiede la maggior parte della logica nuova: processore, worker, routing per `WorkflowStepType`) non e' tracciato con lo stesso rigore del FE.
- **Azione correttiva raccomandata**: produrre una sezione "Backend No-Regression Gates" analoga, che categorizzi i test BE esistenti (es. `runtime.geometric-e2e.test.ts`, `runtime.acquisition-workflow.machine.test.ts`, `runtime.scoring.test.ts`, `generation-system.runtime.test.ts`) secondo lo stesso schema A/B/C/D usato per il FE.
- **Soluzione adottata**: nuova sezione "## Backend No-Regression Gates" aggiunta in coda al documento (dopo "Frontend No-Regression Gates", non modificata), che categorizza i file di test BE rilevanti trovati in `apps/backend/src/lib/tests/` secondo lo stesso schema A/B/C/D, con nuovi Acceptance Criteria per i test D (nuovi test da scrivere per il `ToolWorkflowJob` processor).

### Medium

#### MED-01 — Pattern `crawling-queue.ts` — **RISOLTO (file rimosso)**
- **Descrizione**: La proposal originale citava `crawling-queue.ts` come "pattern BullMQ esistente" riutilizzabile. Verifica del codice ha confermato che il file era dead code (0 import in tutto il codebase, 0 consumer — il crawling adapter chiama SerpApi sincronamente tramite `ApiService`), usava `REDIS_HOST`/`REDIS_PORT` invece di `REDIS_URL` (inconsistente col sistema), e aveva singleton module-level senza lifecycle management.
- **Soluzione adottata**: file rimosso (2026-07-23). Il nuovo `tool-workflow-job-queue.ts` e' scritto da zero con `REDIS_URL`, graceful shutdown esplicito, e nessuno stato module-level. Il pattern di riferimento e' l'infrastruttura BullMQ gia' presente nei prerequisiti (`job-event-bridge.ts`, `job-progress-serializer.ts`).

#### MED-02 — Autorizzazione nel worker non discussa esplicitamente — **RISOLTO**
- **Descrizione**: Il worker esegue con `userId`/`projectId` letti da `job.data` senza rieseguire un ownership check esplicito (l'ownership viene verificata solo all'atto del submit HTTP).
- **Impatto**: Probabilmente accettabile per design (il `ToolWorkflowJob` e' immutabile una volta accodato e i dati provengono da una richiesta gia' autenticata/autorizzata), ma l'assunzione non e' dichiarata come invariante esplicito, rendendola vulnerabile a regressioni silenziose se in futuro si introduce un path per modificare `job.data` post-submit.
- **Soluzione adottata**: dichiarata esplicitamente l'invariante di design nella sezione "Detailed Design" #4 (pseudocodice del processore): _"Il worker non re-esegue ownership check. L'autorizzazione e' garantita esclusivamente al submit-time (middleware auth + project ownership su `POST /api/tools/jobs`). `job.data` e' immutabile e trusted dopo l'accodamento BullMQ. Qualsiasi path futuro che modifichi `job.data` post-submit deve reintrodurre il re-check esplicito."_

#### MED-03 — Deployment del worker su Railway non affrontato — **RISOLTO**
- **Descrizione**: `AGENTS.md` descrive il deployment come Dockerfile + `npm run start` (singolo processo, singolo container). La proposal non specifica come `worker.ts`/`worker-entry.ts` verrebbe deployato: secondo servizio Railway separato, oppure stesso container con avvio in-process (`TOOL_WORKFLOW_WORKER_IN_PROCESS=true`, menzionato nella Sezione "File modificati" della Fase 1)?
- **Impatto**: Ambiguita' operativa che puo' portare a un deployment che gira solo in-process (nessuna scalabilita' orizzontale reale) mentre la proposal descrive un'architettura Queue/Worker pensata per lo scaling.
- **Soluzione adottata**: **Fase 1 — worker in-process**: il worker si avvia dentro `server.ts` quando `TOOL_WORKFLOW_WORKER_IN_PROCESS=true` (default). Stesso container Railway, stesso processo Node.js, nessun cambiamento al Dockerfile. L'architettura Queue/Worker funziona interamente in-process (code in-memory o Redis, worker stesso evento loop). **Fase 2 — worker separato (opzionale, se serve scaling orizzontale)**: secondo servizio Railway con `worker-entry.ts` come entry point (`CMD ["node", "--import", "tsx", "src/worker-entry.ts"]`), stessa Docker image, Redis condiviso. Il flag `TOOL_WORKFLOW_WORKER_IN_PROCESS=false` sul server HTTP disabilita il worker in-process e demanda tutto al servizio worker dedicato. Aggiornata la sezione "Implementation Strategy" per riflettere questa decisione.

#### MED-04 — Feature flag: meccanismo di propagazione non specificato — **RISOLTO**
- **Descrizione**: La proposal menziona il feature flag `TOOL_WORKFLOW_USE_JOB_SYSTEM` per tool key (Sezione "Risks and Controls") ma non lo lega esplicitamente al pattern esistente `BackendCapabilities` (`apps/frontend/src/app/runtime/backend-capabilities.ts`), che e' il meccanismo canonico gia' presente per esporre capacita' backend al frontend (vedi es. `toolsApiServicesResolve`, `adminApiServicesCrud`).
- **Impatto**: Rischio di introdurre un secondo meccanismo di feature-flagging parallelo e non coerente con `BackendCapabilities`, generando drift tra i due sistemi di esposizione capability.
- **Soluzione adottata**: aggiungere una entry `toolsJobSystem` nel tipo `BackendCapabilities` (es. `toolsJobSystem: boolean`). Il FE usa il pattern `readFlag(import.meta.env.VITE_CAP_TOOLS_JOB_SYSTEM, ...)` esistente per determinare se usare il nuovo path `submitJob()` o il vecchio path `handlePrimaryAction()`. Il feature flag env `TOOL_WORKFLOW_USE_JOB_SYSTEM` (o una mappa per-tool piu' granulare) resta un dettaglio implementativo BE — il FE non lo legge direttamente. Coerente con `toolsApiServicesResolve` e `adminApiServicesCrud` gia' esistenti in `BackendCapabilities`.
- **Riferimento codice verificato**: `apps/frontend/src/app/runtime/backend-capabilities.ts` (tipo `BackendCapabilities`, funzione `readBackendCapabilities`/`readFlag`).

### Low

#### LOW-01 — Retention/PII dei payload `ToolWorkflowJob` in Redis — **RISOLTO (rischio accettato)**
- **Descrizione**: `extractionPayload` puo' contenere URL competitor, testo utente. Il TTL su Redis e' specificato (24h) ma non e' discusso se serva cifratura at-rest o considerazioni di compliance privacy.
- **Impatto**: Basso nel breve termine (TTL limita l'esposizione), ma diventa rilevante se il payload contiene dati personali o sensibili con requisiti normativi specifici.
- **Soluzione adottata**: rischio accettato per Fase 1/Fase 2. Il TTL 24h su Redis e la natura effimera dei `ToolWorkflowJob` (consumati entro minuti, non ore) limitano l'esposizione. Valutare cifratura at-rest in una revisione futura se i requisiti normativi lo richiedono.

#### LOW-02 — `feedbackEnabled` e' dead code, potenzialmente strutturalmente piu' difficile da riattivare col nuovo modello — **RISOLTO (trade-off accettato)**
- **Descrizione**: Il campo `feedbackEnabled` in `packages/contracts/src/tool-workflows.ts` (verificato: presente su ogni `WorkflowStepDescriptor`, es. `{ key: 'outro-structure', ..., feedbackEnabled: true }`) non e' letto da nessun altro file — e' dead code oggi. Non blocca la proposal, ma se l'intenzione futura era un gate di feedback umano a meta' workflow, un `ToolWorkflowJob` BE-driven fully-automatic rende questo strutturalmente piu' difficile da inserire rispetto al modello FE-driven attuale (dove ogni step e' un checkpoint naturale in cui il FE puo' pausare per raccogliere input umano prima di procedere).
- **Impatto**: Nessun impatto immediato (il campo e' inutilizzato oggi).
- **Soluzione adottata**: trade-off architetturale accettato consapevolmente e documentato nella sezione "Non-Goals". In sintesi: il guadagno in semplicita'/affidabilita' del modello BE-driven (niente auto-chain FE, niente N+1 round-trip, niente dipendenza dal tab aperto) supera il costo futuro di reintrodurre checkpoint di feedback. Se il requisito human-in-the-loop emergera', il `ToolWorkflowJob` model lo supporta tramite un nuovo stato `paused-awaiting-feedback` nell'enum `status`, con `POST /submit` per riprendere — un'estensione naturale del modello esistente, non un redesign.
- **Riferimento codice verificato**: `packages/contracts/src/tool-workflows.ts` (campo `feedbackEnabled?: boolean` su ogni `WorkflowStepDescriptor`, nessun consumer trovato).

---

## DDD Governance Verification Notes

Cross-check terminologico eseguito secondo l'ordine di lettura obbligatorio (`AGENTS.md`): Glossario → Bounded Context Map → Decision Log.

**Aggiornamento 2026-07-20 — Naming ratificato**: il TODO precedentemente aperto in questa sezione ("TODO — DDD-NNN da assegnare") e' stato **risolto**. L'utente ha approvato esplicitamente `ToolWorkflowJob` come **naming** canonico definitivo il 2026-07-20 — la **promozione** da `provisional` a `canonical` nel glossario/BCM avverra' solo dopo l'implementazione e il superamento degli Acceptance Criteria. Le entry `DDD-226` (Aggregate Root `ToolWorkflowJob`, relazione con `GenerationSession`), `DDD-227` (Value Object `ToolWorkflowJobId` vs `WorkflowSessionIdentifier`) e `DDD-C-019` (Naming Conflicts Register — risoluzione del conflitto `Job` generico vs `CrawlingJob`) sono state registrate in `docs/07-governance/domain-naming-decision-log.md`. Il glossario (`docs/01-requirements/domain-ubiquitous-language-glossary.md`) e la bounded context map (`docs/02-design/domain-bounded-context-map.md`) sono stati aggiornati con voci **provisional** di conseguenza. Tutti i termini `Job`/`jobId` standalone in questo documento sono stati sostituiti con `ToolWorkflowJob`/`ToolWorkflowJobId` (o qualificati esplicitamente) dove riferiti al concetto di dominio.

**DDD review 2026-07-24 — 0 blocker**: la proposal ha superato la revisione DDD Governance. Vedi sezione "DDD Review Approvals & New Registrations" per i nuovi riferimenti registrati a corollario della proposal.

| Termine verificato | Esito | Note |
|---|---|---|
| `ToolWorkflowJob` / `ToolWorkflowJobId` | **Risolto — ratificato come DDD-226 / DDD-227** | `ToolWorkflowJob` e' ora il nuovo Aggregate Root canonico (Generation context) per l'unita' di lavoro asincrona in coda che orchestra l'esecuzione end-to-end di un `Tool`. `ToolWorkflowJobId` e' il Value Object identificatore, distinto da `WorkflowSessionIdentifier` (DDD-047). Vedi `domain-naming-decision-log.md` DDD-226/DDD-227. |
| `Worker` | **Termine tecnico infrastrutturale, non un concetto di dominio (confermato)** | Nessuna entry nel glossario/decision log — per design. Coerente con il precedente DDD-022 (`RouteType` dichiarato "internal implementation type... must not appear in domain documentation") e DDD-018 (declassificazione di tipi di registry a "internal implementation type"): `Worker`/`worker.ts` e' accettabile come termine tecnico-infrastrutturale (BullMQ `Worker` class), non come termine di Ubiquitous Language. Confermato esplicitamente in DDD-226. |
| `Queue` | **Termine tecnico infrastrutturale, non un concetto di dominio (confermato)** | Analogamente a `Worker`: `Queue` (BullMQ) e' un dettaglio implementativo. Il bounded context map menziona "GEOMETRIC crawling job queue" solo come dettaglio tecnico all'interno della responsabilita' del bounded context Crawling & Extraction, non come concetto UL promosso. Confermato esplicitamente in DDD-226. |
| **Relazione `ToolWorkflowJob` ↔ `GenerationSession`/`ToolWorkflow`/`WorkflowSessionIdentifier`** | **Risolto — ratificato come DDD-226 / DDD-227** | Il bounded context map ora documenta esplicitamente la relazione `ToolWorkflowJob -> GenerationSession` (Sezione "Shared Concepts And Translation Rules"): un `ToolWorkflowJob` **produce e possiede** una `GenerationSession` — il job e' l'unita' di esecuzione asincrona (stati BullMQ), la session resta l'aggregato di raggruppamento degli `Artifact`. Cardinalita' 1:1 per `WorkflowRunMode = 'new'`, potenzialmente 1:N per `'regenerate'` (**provvisorio**, da confermare in implementazione — vedi Sezione 8 per la tabella di decisione HIGH-04 che distingue retry da regenerate). `ToolWorkflowJobId` e `sessionId` sono identificatori distinti, non alias. |
| `DDD-C-019` (Naming Conflicts Register) | **Resolved by naming** | Il conflitto `Job` (generico, proposto) vs `CrawlingJob` (Aggregate Root, Crawling & Extraction, DDD-114) e' risolto scegliendo `ToolWorkflowJob` come termine canonico, con lo stesso pattern di disambiguazione gia' usato per `ExtractionJob` → `CrawlingJob` (DDD-C-015). Vedi `domain-naming-decision-log.md` sezione "Naming Conflicts Register", entry DDD-C-019. |

### DDD Review Approvals & New Registrations (2026-07-24)

A corollario della DDD review (0 blocker, 5 warning), vengono registrate le seguenti nuove entry:

#### DDD-228 — `ToolWorkflowJobStatus` (Value Object, Generation context)

**Canonical Value Object** per lo stato del ciclo di vita di un `ToolWorkflowJob`. Valori: `queued` (accodato, in attesa di worker), `running` (in esecuzione), `completed` (tutti gli step completati con successo), `failed` (almeno uno step fallito dopo tutti i retry), `cancelled` (interrotto dall'utente via `POST /api/tools/jobs/:jobId/cancel`). Segue lo stesso pattern di `ArtifactStatus` (DDD-017: `generating | completed | failed`). I valori `queued` e `cancelled` sono specifici del modello asincrono `ToolWorkflowJob` e non hanno equivalente in `ArtifactStatus`.

| DDD-228 | 2026-07-24 | ToolWorkflowJobStatus | `ToolWorkflowJobStatus` is the canonical Value Object for the lifecycle state of a `ToolWorkflowJob` (DDD-226). Values: `queued`, `running`, `completed`, `failed`, `cancelled`. Transition rules: `queued → running` (worker claims job), `running → completed` (all steps succeed), `running → failed` (step failure after all retries), `running → cancelled` (user cancel request detected at step boundary). Follows the `ArtifactStatus` pattern (DDD-017). The `queued` and `cancelled` values are specific to the asynchronous `ToolWorkflowJob` model and have no equivalent in `ArtifactStatus`. | Lifecycle state management for asynchronous job execution. Consistent with `ArtifactStatus` (DDD-017) and extends the pattern with queue-specific states (`queued`, `cancelled`). Essential for `StatusBadge` mapping in Frontend/UI and for admin monitoring dashboards. | Generation, Frontend/UI |

#### DDD-C-020 — `jobId` (REST field) vs `ToolWorkflowJobId` (domain Value Object)

| DDD-C-020 | `jobId` (REST field name in API responses/URL paths) vs `ToolWorkflowJobId` (canonical Value Object, DDD-227) | Generation, Frontend/UI | **Resolved by convention**: `jobId` is the REST field name in JSON responses (`{ "jobId": "..." }`) and URL path parameters (`/api/tools/jobs/:jobId`). `ToolWorkflowJobId` is the canonical domain Value Object (DDD-227) identifying a `ToolWorkflowJob`. The field name `jobId` follows REST naming conventions (camelCase, no domain prefix in API surface); the domain concept `ToolWorkflowJobId` carries the `ToolWorkflow` prefix for disambiguation from `CrawlingJob` (DDD-114) and `AnalysisJob` (DDD-113). This follows the same pattern as DDD-C-003 (`extractionPayload` REST field vs `ExtractionContext` domain Value Object). | resolved-documented |

**Governance chiusa**: non esistono piu' TODO di naming aperti per questa proposal. Ogni futura estensione del concetto `ToolWorkflowJob` (es. nuovi stati, nuovi campi payload) deve comunque passare per una nuova entry nel decision log prima della propagazione in codice/documentazione, secondo la regola generale AGENTS.md.

---

## Backend No-Regression Gates

Questa sezione definisce la matrice di regressione BE per la transizione dall'orchestrazione per-step FE-driven al `ToolWorkflowJob` processor BE-driven, analoga per struttura a "Frontend No-Regression Gates" (sezione seguente, non modificata da questa revisione — vedi cross-reference in fondo). I file di test elencati sono stati individuati con ricerca diretta in `apps/backend/src/lib/tests/` sui moduli impattati dalla proposal: `tool-workflow.machine.ts`, `generation-routing.ts`, `tool-workflow-registry.ts`, `workflow-normalizers.ts`, e i moduli step-type-specifici (`scoring-engine.ts`, `scoring-chain.machine.ts`).

### Gate Categories Summary

| # | Test File | Category | Justification |
|---|-----------|----------|---------------|
| 1 | `runtime.geometric-e2e.test.ts` | **A** | Test end-to-end del `toolWorkflowMachine` sul workflow GEOMETRIC a 4 step (`crawl-serp` → `score-competitors` → `generate-strategic-report` → `generate-unified-report`), invocando direttamente la macchina XState con `createActor`. Indipendente dal meccanismo di dispatch HTTP (FE-driven vs job processor): verifica il comportamento della macchina, non chi la invoca. Deve continuare a passare inalterato quando il processore la invoca in loop (Fase 1, "Alternativa pragmatica" — Sezione "Detailed Design" #5). |
| 2 | `runtime.acquisition-workflow.machine.test.ts` | **A** | Verifica che `toolWorkflowMachine` unisca correttamente il payload di uno step `acquisition` prima del completamento downstream (`STEP_START`/`STEP_SUCCESS` su `acquire-context` → `optin`). Indipendente da chi invoca la macchina — resta valido invariato con il nuovo processore. |
| 3 | `runtime.scoring.test.ts` | **A** | Copre sia funzioni pure (`computeDomainScores`, `computeCompetitorRanking` in `scoring-engine.ts`) sia l'invocazione di `scoringChainMachine` tramite `toolWorkflowMachine`. Le funzioni pure sono zero-dipendenza dall'orchestrazione; l'invocazione della macchina resta invariata. Rilevante per verificare che `runScoringStep` (nuovo wrapper, CRIT-03) deleghi correttamente a questo stesso `scoringChainMachine` senza duplicare la logica di scoring. |
| 4 | `runtime.workflow-normalizers.test.ts` | **A** | Funzioni pure di normalizzazione (`normalizeStepKey`, `normalizeToolWorkflowKey`, `resolveToolStepArtifactRole`) usate sia dal path corrente sia dal futuro `tool-workflow-job-processor.ts` per risolvere `toolKey`/`stepKey` nel payload del `ToolWorkflowJob`. Zero dipendenza dal meccanismo di dispatch. |
| 5 | `runtime.tool-workflow-registry.test.ts` | **A** | `buildCompletedArtifactsByStep` — funzione usata per ricostruire lo stato degli step completati da artifact esistenti. Sara' riusata identicamente dal processore per il "retry con skip step completati" (Sezione 8). Nessuna modifica prevista. |
| 6 | `runtime.tool-prompts-parametrized.test.ts` | **A** | Verifica risoluzione parametrica dei prompt (`resolveToolPrompt` e dipendenze). Non-Goal #5 della proposal dichiara che i prompt restano invariati — questo test deve continuare a passare senza modifiche. |
| 7 | `generation-system.runtime.test.ts` | **B** | Test di integrazione su `generationSystemMachine` + `toolWorkflowMachine` + `persistenceBatchMachine` orchestrati insieme, inclusi contatori di guard (`allRequiredStepsCompleted`) e `CompetitorRanking`. La singola invocazione per-step (Fase 1) resta compatibile, ma i test che assumono un'unica sessione HTTP per l'intero workflow (se presenti) richiedono verifica: il processore invoca `generationSystemMachine`/`toolWorkflowMachine` N volte (una per step) invece di una singola volta con `steps: plan.steps` — la Fase 3 (multi-step nativo) cambierebbe questo comportamento e richiederebbe un rewrite mirato. |
| 8 | `runtime.tool-prompts.test.ts` | **A** | Test base di risoluzione prompt, indipendente da orchestrazione. |
| 9 | `runtime.token-efficiency.test.ts` | **A** | Verifica la regola di token-efficiency (screenshot/dati pesanti non inviati all'LLM) per gli step GEOMETRIC. Indipendente dal meccanismo di dispatch: si applica identicamente se lo step e' invocato dal loop FE-driven o dal processore `ToolWorkflowJob`. |
| 10 | `runtime.serpapi-crawling.test.ts` | **A** | Normalizzazione della risposta SerpApi verso i domain concept (`SerpSource`, `SerpAIOverviewSnippet`, `PAAQuery`). Indipendente dall'orchestrazione — rilevante per la corretta implementazione di `runCrawlingStep` (CRIT-03) che deve produrre lo stesso `CrawlArtifact` shape. |

### Category A: Preserved Invariants (sintesi)

I test #1–#6, #8–#10 sono classificati **A** perche' verificano comportamento delle macchine XState (`toolWorkflowMachine`, `scoringChainMachine`), funzioni pure di normalizzazione/routing, o logica di dominio (scoring, token-efficiency, normalizzazione SerpApi) totalmente indipendente dal meccanismo che le invoca (HTTP per-step FE-driven oggi, `ToolWorkflowJob` processor domani). Devono continuare a passare **senza modifiche** con `npm --workspace apps/backend run test`.

### Category B: Rewrite Plan

#### BE-B01 — `generation-system.runtime.test.ts` invocazioni multi-sessione
- **Old behavior**: assume una sessione `generationSystemMachine` per singola richiesta HTTP/step.
- **New equivalent**: il processore invoca la stessa macchina N volte (una per step) in Fase 1 — comportamento equivalente, nessun rewrite atteso finche' resta l'"alternativa pragmatica" (Sezione 5). Diventa **B** solo se/quando si adotta la Fase 3 (multi-step nativo, `steps: plan.steps`): a quel punto i test che assumono N invocazioni singole richiederebbero un rewrite per verificare una singola invocazione con array completo di step.

### Category C: Removal Justification

Nessun file di test BE esistente e' identificato come obsoleto in Fase 1 — il path corrente (`tools-orchestrate-handlers.ts`, single-step `toolWorkflowMachine` invocation) resta attivo per backward compat (vedi Sezione "Implementation Strategy", "Non modificati (fase 1)"). La rimozione di `tools-orchestrate-handlers.ts`/i relativi test e' un non-goal esplicito di Fase 1.

### Category D: New Test Specifications

#### BE-GATE-D01 — `tool-workflow-job-processor.test.ts` — idempotency key per-step (CRIT-01)
- **Test description**: verifica che il processore derivi `${idempotencyKey}:${stepKey}` per ogni step e che il secondo step non venga bloccato come duplicato dal lock Redis creato per il primo step.
- **Conditions**: submit di un `ToolWorkflowJob` multi-step con `idempotencyKey` fisso; assert che ogni chiamata a `runSingleStepGeneration` riceva un `idempotencyKey` param diverso per ogni step; assert che lo step 2 completi con successo (non `idempotency_conflict`).
- **Suggested file location**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (nuovo file)

#### BE-GATE-D02 — `tool-workflow-job-processor.test.ts` — routing per WorkflowStepType (CRIT-03)
- **Test description**: verifica end-to-end sul tool `geometric` che gli step `crawling`/`scoring` invochino `runCrawlingStep`/`runScoringStep` (non `runSingleStepGeneration`).
- **Conditions**: mock di `runCrawlingStep`, `runScoringStep`, `runSingleStepGeneration`; assert che ciascuno sia chiamato esattamente per gli step del tipo corretto secondo il piano GEOMETRIC (`serp-crawling` → crawling, `competitor-scoring` → scoring, `strategic-reporting`/`unified-report` → generation).
- **Suggested file location**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (estende D01)

#### BE-GATE-D03 — `tools-job-handlers.test.ts` — cancellazione (CRIT-02)
- **Test description**: verifica che `POST /api/tools/jobs/:jobId/cancel` setti il flag Redis, che il processore lo rilevi al boundary tra step, e che il `ToolWorkflowJob` transiti a `status: 'cancelled'` senza eseguire step successivi.
- **Conditions**: submit di un `ToolWorkflowJob` multi-step; invocare cancel dopo il completamento dello step 1; assert che lo step 2 non venga mai avviato; assert `status === 'cancelled'`; assert che l'artifact dello step 1 resti persistito (nessun rollback).
- **Suggested file location**: `apps/backend/src/lib/tests/runtime.tools-job-handlers.test.ts` (nuovo file)

#### BE-GATE-D04 — `tool-workflow-job-queue.test.ts` — single-flight guard (HIGH-01)
- **Test description**: verifica che un secondo submit concorrente per lo stesso `(userId, projectId, toolKey)` riceva `409 Conflict` con il `jobId` del `ToolWorkflowJob` attivo, tramite il fallback Redis lock `tool-job-active:{userId}:{projectId}:{toolKey}` (vedi Sezione 3).
- **Conditions**: submit di un `ToolWorkflowJob`; submit immediato di un secondo `ToolWorkflowJob` con lo stesso scope prima che il primo completi; assert risposta `409` con lo `jobId` del `ToolWorkflowJob` esistente; assert che il lock si rilasci a completamento e un terzo submit successivo abbia successo.
- **Suggested file location**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-queue.test.ts` (nuovo file)

### No-Regression Gate (Backend)

Il comando CI che verifica tutti i gate BE-enforced:

```
npm --workspace apps/backend run test
```

**Pre-condizioni perche' questo gate sia significativo**:
1. Tutti i test Category A (#1–#6, #8–#10) continuano a passare senza modifiche.
2. I nuovi test Category D (`BE-GATE-D01` – `BE-GATE-D04`) sono scritti e passano **prima** che il feature flag `TOOL_WORKFLOW_USE_JOB_SYSTEM` sia abilitato per qualunque tool key in produzione — stesso principio di enforcement gia' applicato al gate FE (vedi "Frontend No-Regression Gates" → "No-Regression Gate", enforcement rule).
3. `generation-system.runtime.test.ts` (Category B, BE-B01) resta verde con l'invocazione N-volte per-step della Fase 1; un rewrite e' richiesto solo se si adotta la Fase 3 (multi-step nativo).

**Cross-reference**: per il gate equivalente lato Frontend, vedi la sezione "Frontend No-Regression Gates" che segue (non modificata da questa revisione).

---

## Frontend No-Regression Gates

This section defines a complete regression gate matrix for the FE transition from per-step orchestration to passive SSE-driven job consumption. Every existing FE test file has been analyzed against the target architecture to determine whether it (a) must pass unchanged, (b) must be rewritten for equivalent behavior, (c) can be removed as obsolete, or (d) represents a gap requiring new tests.

### Gate Categories Summary

| # | Test File | Category | Justification |
|---|-----------|----------|---------------|
| 1 | `tool-page.machine.test.ts` | **B** | Machine transitions change (`generating` → `submitting`/`running`), but guards (canStartGeneration, canCancelGeneration), readiness derivation, PROGRESS_SYNCED, hydration, and view-model computation are preserved invariants. Tests for REQUEST_STEP_START dispatch flow must be rewritten for SUBMIT_JOB + JOB_PROGRESS. |
| 2 | `tool-page-readiness.test.ts` | **A** | Pure domain functions: `buildReadinessSnapshot`, `deriveHasExtractionContext`, `deriveHasPrimaryTargetStep`. Zero dependence on step orchestration mechanism. |
| 3 | `tool-page-hydration.test.ts` | **A** | Pure utility functions: `normalizeHydrateRequest`, `normalizePendingHydration`, `readHydrationMachineOutput`. Hydration protocol unchanged. |
| 4 | `briefing-upload.machine.test.ts` | **A** | Briefing upload machine (idle→uploading→extracting→ready) is completely independent of generation step orchestration. File upload, extraction, and recovery paths unchanged. |
| 5 | `tool-flow.machine.test.ts` | **C** | FE-side step-sequencing actor. In the new system the BE owns step order via `ToolWorkflowPlan`; the FE no longer validates step transitions. Types (`SupportedTool`, `ToolStep`, `ToolStepStatus`) remain in use but the actor itself is obsolete. |
| 6 | `extraction-context-validity.test.ts` | **A** | Pure validation functions (`isExtractionContextValidForTool`, `hasRequiredExtractionFields`). Tool-specific extraction field requirements unchanged. |
| 7 | `ToolPageTemplate.test.tsx` | **B** | Mixed file. UI rendering assertions (CTA labels, aria roles, button states) are **A** and must pass unchanged. Integration tests that verify `startMock` call count via auto-chain are **C** (auto-chain removed). Tests for `resolveFlowProgressState` require **B** rewrites because progress state computation shifts from artifact-scanning to SSE-driven. |
| 8 | `ToolPageTemplate.youtube-description-direct-input.test.tsx` | **A** | Mocks `useToolPage` entirely. Tests form rendering, direct-input field validation, and CTA click delegation. UI layer unchanged. |
| 9 | `ToolPageTemplate.meta-ads-objective.test.tsx` | **A** | Mocks `useToolPage` entirely. Tests campaign objective selector rendering and form state sync. UI layer unchanged. |
| 10 | `ToolPageTemplate.meta-ads-flow.e2e.test.tsx` | **A** | Mocks `useToolPage` entirely. Tests extraction start flow and CTA state transitions at the UI level. UI layer unchanged. |
| 11 | `ToolPageTemplate.geometric-direct-input.test.tsx` | **A** | Mocks `useToolPage` entirely. Tests geometric direct-input fields (baseQuery, language, country, brandName). UI layer unchanged. |
| 12 | `ToolGenerationFlowVertical.test.tsx` | **A** | Pure presentational component. Renders progress bars, status text, error alerts based on `canonicalState` prop. Zero orchestration dependency. |
| 13 | `ToolFileInstructionsSection.test.tsx` | **A** | Pure presentational component. Renders extraction field instructions from `selectToolFileInstructions`. Zero orchestration dependency. |
| 14 | `ToolsHubPage.test.tsx` | **A** | Hub page renders enabled tool cards via `getEnabledToolNavigationItems`. Zero orchestration dependency. |
| 15 | `useToolPage.test.ts` | **B** | Tests hook composition and dispatch. Initialization and briefing handlers (**A**). `REQUEST_STEP_START` dispatch after CTA (**B** → rewritten for `SUBMIT_JOB`). Auto-start-after-extraction (**B** → rewritten for submit-after-extraction). PROGRESS_SYNCED sync (**A**). Error dispatch after terminal failure (**B** → rewritten for JOB_FAILED handling). |
| 16 | `tools-client.test.ts` | **B** | `uploadBrief` and `runExtraction` tests are **A** (unchanged). `orchestrateToolStep` tests are **C** (obsolete — BE resolves dependencies internally). New tests needed for `submitJob` client function (**D**). |
| 17 | `tool-step-display-config.test.ts` | **A** | Display config registry (`TOOL_STEP_DISPLAY_CONFIG`, `isStepVisible`, `isStepIncludedInDownload`). Independent of orchestration. |
| 18 | `tool-entry-params.test.ts` | **A** | URL param parsing (`parseToolEntryParams`, `parseToolIntent`). Independent of orchestration. |
| 19 | `tool-page-selectors.test.ts` | **B** | `selectToolFileInstructions` and `deriveToolInputRequirementMatrix` are **A** (preserved). `buildYoutubeDescriptionDirectInputExtractionInfo` and `buildGeometricDirectInputExtractionInfo` are **A** (form→extraction mapping unchanged). `buildBaseGenerationRequest` is **B** — the generation request payload shape changes; a new `buildSubmitJobRequest` equivalent must be tested. |
| 20 | `tool-api-binding-status-adapter.test.ts` | **A** | API binding status resolution. Zero orchestration dependency. |
| 21 | `tool-form-architecture.test.ts` | **A** | Form registry (`getEnabledToolKeys`, `isToolEnabled`, `getAvailableSteps`). Step availability logic for UI display is independent of how steps are dispatched. |
| 22 | `session-client.test.ts` | **A** | Session client (`listSessions`, `getStepArtifact`). Independent of orchestration. |

### Category A: Preserved Invariants

These concrete, verifiable gates ensure that behaviors independent of the step orchestration mechanism are not regressed.

#### FE-GATE-A01 — Readiness snapshot is deterministic and reason-code-driven
- **Behavior preserved**: `buildReadinessSnapshot` returns `{ canStartFlow, hasProject, hasExtractionContext, hasPrimaryTargetStep, hasRequiredAssets, reasonCodes }` deterministically from its inputs. The `reasonCodes` array exactly matches the set of missing conditions.
- **Verified by**:
  - `tool-page-readiness.test.ts` → `buildReadinessSnapshot returns deterministic reason-code matrix`
  - `tool-page-readiness.test.ts` → `deriveHasPrimaryTargetStep reflects tool step availability`
  - `tool-page-readiness.test.ts` → `marks direct-input-only tools as extraction-context-ready by policy`
  - `tool-page.machine.test.ts` → `computes structured readiness reason codes from PROGRESS_SYNCED signals`
- **Command**: `npm --workspace apps/frontend run test -- tool-page-readiness`

#### FE-GATE-A02 — Extraction context validity per tool is unchanged
- **Behavior preserved**: `isExtractionContextValidForTool` validates per-tool required keys, normalizes legacy aliases, and correctly blocks/permits readiness per canonical field sets for funnel-pages, youtube-lf-script, nextland, and meta-ads.
- **Verified by**:
  - `extraction-context-validity.test.ts` → all test cases
  - `tool-page.machine.test.ts` → `requires canonical extraction fields for youtube-lf-script readiness`
  - `tool-page.machine.test.ts` → `enables hasExtractionContext for valid funnel-pages extraction context`
  - `tool-page.machine.test.ts` → `keeps hasExtractionContext=false for invalid nextland extraction context`
  - `tool-page.machine.test.ts` → `enables hasExtractionContext for valid youtube-lf-script extraction context`
- **Command**: `npm --workspace apps/frontend run test -- extraction-context-validity`

#### FE-GATE-A03 — Hydration protocol is unchanged
- **Behavior preserved**: `HYDRATE_REQUESTED` transitions to `hydrating` state, invokes `hydrationMachine`, and on success restores `hydrationResult`, syncs `briefingActorRef` via `EXTRACTION_RECOVERED`, and recomputes readiness. On failure, sets `errorMessage` and transitions to `configuring.hydrationFailed`. Legacy extraction artifacts without `briefingId` use `artifactId` as fallback. Local artifact resolution works without network. Retry after failure clears error and succeeds.
- **Verified by**:
  - `tool-page-hydration.test.ts` → all test cases
  - `tool-page.machine.test.ts` → all Phase 2 hydration tests (9 test cases from `transitions to hydrating on HYDRATE_REQUESTED` through `ranking: resolvedBriefingId viene passato al BE endpoint`)
- **Command**: `npm --workspace apps/frontend run test -- tool-page-hydration`

#### FE-GATE-A04 — Briefing upload lifecycle is unchanged
- **Behavior preserved**: idle → FILE_SELECTED → EXTRACTION_REQUESTED → uploading → extracting → ready. Upload failure, extraction failure, unsupported extension rejection, empty projectId rejection, null userId rejection, EXTRACTION_RECOVERED idempotency in idle/ready, angle-generator multi-file support, and RESET from ready→idle.
- **Verified by**: `briefing-upload.machine.test.ts` → all 14 test cases
- **Command**: `npm --workspace apps/frontend run test -- briefing-upload.machine`

#### FE-GATE-A05 — ToolPageViewModel shape is identical
- **Behavior preserved**: `buildReactiveViewModel` and `buildToolPageViewModel` produce the same `ToolPageViewModel` shape: `{ readiness, canonicalState, primaryActionPolicy, secondaryActionFlags, stepStatuses, messages }`. The view model is derived from `{ toolKey, intent, readiness, progress, errorMessage, configuringSubstate, runRequestPrefix }`. The view model derivation logic (paused-with-checkpoint, prefilled-regenerate, completed, open-last-artifact) is unchanged.
- **Verified by**:
  - `tool-page.machine.test.ts` → `syncs unified progress in context via PROGRESS_SYNCED` (checks `canonicalState: 'prefilled-regenerate'`)
  - `tool-page.machine.test.ts` → `returns open-last-artifact when intent=resume and all steps completed (TEST-003)`
  - `tool-page.machine.test.ts` → `returns regenerate-current-step when intent=regenerate and zero steps completed (TEST-004)`
  - `tool-page.machine.test.ts` → `returns open-last-artifact when intent=regenerate and current run completed all steps (TEST-005)`
  - `tool-page.machine.test.ts` → `keeps readiness and policy coherent for resume checkpoint flow`
  - `tool-page.machine.test.ts` → `blocks START_GENERATION when readiness is true but policy is not startable`
- **Command**: `npm --workspace apps/frontend run test -- tool-page.machine`

#### FE-GATE-A06 — UI components render identically from view-model props
- **Behavior preserved**: `ToolPageTemplate` and `ToolGenerationFlowVertical` render the same DOM given the same `machineViewModel`, `effectiveCanonicalState`, `completedStepsForFlow`, `currentRunningStep`, and `pausedCheckpointStep` values. CTA labels and disabled states are derived from `primaryActionPolicy` exactly as before. Progress bar aria attributes, status text, and error messages render identically.
- **Verified by**:
  - `ToolGenerationFlowVertical.test.tsx` → all 14 test cases
  - `ToolPageTemplate.test.tsx` → `machine-driven readiness: la readiness della macchina determina la policy CTA` (CTA button present and not disabled when canStartFlow=true)
  - `ToolPageTemplate.meta-ads-objective.test.tsx` → campaign objective select rendering
  - All tool-specific Template tests (youtube-description, meta-ads-flow, geometric-direct-input)
- **Command**: `npm --workspace apps/frontend run test -- ToolGenerationFlowVertical`

#### FE-GATE-A07 — Form architecture and tool registry are unchanged
- **Behavior preserved**: `toolFormRegistry`, `toolFileInstructionsRegistry`, `getToolFormConfig`, `getEnabledToolKeys`, `isToolEnabled`, `getAvailableSteps`, `selectToolFileInstructions`, and `deriveToolInputRequirementMatrix` maintain their current registrations and return values.
- **Verified by**:
  - `tool-form-architecture.test.ts` → all test cases
  - `tool-page-selectors.test.ts` → `returns canonical youtube-lf-script instructions with the full extraction schema`, `projects labels for funnel-pages without leaking raw key tokens`, `supports youtube-description direct-input policy without required file inputs`, `maps youtube-description required direct fields to canonical seven-field set`
- **Command**: `npm --workspace apps/frontend run test -- tool-form-architecture`

#### FE-GATE-A08 — Display config, entry params, session client, API binding are unchanged
- **Behavior preserved**: Step visibility/download config, URL param parsing, session list/step-artifact retrieval, and API binding status resolution.
- **Verified by**: `tool-step-display-config.test.ts`, `tool-entry-params.test.ts`, `session-client.test.ts`, `tool-api-binding-status-adapter.test.ts`
- **Command**: `npm --workspace apps/frontend run test -- tool-step-display-config`

#### FE-GATE-A09 — PROGRESS_SYNCED event updates context invariants
- **Behavior preserved**: Sending `PROGRESS_SYNCED` with artifacts, intent, sourceArtifact, and runRequestPrefix correctly updates `context.progress` (completedSteps, latestArtifactByStep, lastCheckpointStep) and `context.readiness` (hasExtractionContext, canStartFlow). Artifacts from past runs with no active prefix are ignored for `intent: 'new'`.
- **Verified by**:
  - `tool-page.machine.test.ts` → `syncs unified progress in context via PROGRESS_SYNCED`
  - `tool-page.machine.test.ts` → `treats relaunch new from artifact as fresh progress state`
  - `tool-page.machine.test.ts` → `ignores historical artifacts when intent=new and no active run (TEST-002)`
- **Command**: `npm --workspace apps/frontend run test -- "syncs unified progress in context"`

### Category B: Rewrite Plan

#### B01 — `tool-page.machine.test.ts` transition tests
- **Old behavior**: Tests send `START_GENERATION` → machine transitions to `generating` state; `REQUEST_STEP_START` queues `pendingStepStart` and transitions to `generating`; `STEP_DONE` events accumulate in `generationLifecycleMachine` until all steps complete → transition to `completed`.
- **New equivalent**: Tests send `SUBMIT_JOB` → machine transitions to `submitting` → on success transitions to `running` (passive SSE consumer); `JOB_PROGRESS` events carrying `{ step, status }` update `progress.completedSteps`; `JOB_COMPLETED` → transition to `completed`.
- **Rewritten tests must verify**:
  - `SUBMIT_JOB` guard: same as `canStartGeneration` guard (readiness + policy)
  - `submitting` state entry: `pendingJobId` set in context
  - `JOB_PROGRESS` with `status: 'done'` adds step to `completedSteps`
  - `JOB_PROGRESS` with `status: 'running'` sets `currentRunningStep` in context
  - `JOB_COMPLETED` transitions to `completed` and sets all steps as done
  - `JOB_FAILED` transitions to `configuring.generationFailed` with `errorMessage`
  - `CANCEL_GENERATION` from `running` still works (cancels SSE + resets)

#### B02 — `ToolPageTemplate.test.tsx` dispatch tests
- **Old behavior**: Tests verify that clicking the CTA triggers `POST /api/tools/orchestrate` → `generationRun.startRun(request)`, and auto-chain triggers subsequent `startRun` calls.
- **New equivalent**: Tests verify that clicking the CTA triggers `POST /api/tools/jobs` with `SubmitJobRequest` payload, and the SSE stream consumer dispatches `JOB_PROGRESS` events to the machine.
- **Rewritten tests must verify**:
  - `submitJob` called exactly once on CTA click (not per-step)
  - `SubmitJobRequest` payload contains `toolKey`, `projectId`, `extractionPayload`, `model`, `intent`, `idempotencyKey`
  - After job submission, SSE events cause `completedStepsForFlow` to grow incrementally
  - Inter-step dependency resolution is NOT part of the FE test scope (BE-owned)
  - `resolveFlowProgressState` is replaced by SSE-driven progress: the `ToolPageTemplate` receives `completedStepsForFlow` directly from the machine context populated by `JOB_PROGRESS` events

#### B03 — `useToolPage.test.ts` dispatch tests
- **Old behavior**: Tests verify that `handlePrimaryAction()` dispatches `REQUEST_STEP_START` event; the bridge `useLayoutEffect` in `useToolPageRunController` then calls `startGenerationStep` which invokes `orchestrateToolStep` + `generationRun.startRun`.
- **New equivalent**: `handlePrimaryAction()` calls `submitJob()` (from `useToolPageSubmitController`), which sends a `SUBMIT_JOB` event to the machine. The machine transitions to `submitting` and the submit controller calls `POST /api/tools/jobs`. On success, the SSE stream consumer (`useJobStream`) dispatches `JOB_PROGRESS` events.
- **Rewritten tests must verify**:
  - `handlePrimaryAction` dispatches `SUBMIT_JOB` (not `REQUEST_STEP_START`)
  - After extraction completes with `autoStartGeneration: true`, `handlePrimaryAction` (or auto-start path) fires `SUBMIT_JOB`
  - `PROGRESS_SYNCED` is still dispatched after project/model/form changes
  - Error handling for `JOB_FAILED` populates `dispatchError` and `machineViewModel.messages.error`

#### B04 — `tool-page-selectors.test.ts` generation request builder
- **Old behavior**: `buildBaseGenerationRequest` constructs a per-step generation request with `stepDependencyArtifactIds`, `stepDependencyArtifactContentsByStep`, `runPrefix`, etc.
- **New equivalent**: A new function `buildSubmitJobRequest` (or similar) constructs a `SubmitJobRequest` payload with `toolKey`, `projectId`, `extractionPayload`, `model`, `intent`, `idempotencyKey`. The per-step dependency resolution is BE-owned.
- **Rewritten tests must verify**:
  - `buildSubmitJobRequest` correctly merges `extractionInfo` (from briefing extraction or direct-input)
  - `buildSubmitJobRequest` includes `selectedAssetIds` when asset-based context is active
  - `buildSubmitJobRequest` includes `campaignObjective` when tool is `meta-ads`
  - Direct-input extraction info builders (`buildYoutubeDescriptionDirectInputExtractionInfo`, `buildGeometricDirectInputExtractionInfo`) remain unchanged and continue to pass existing tests

#### B05 — `tools-client.test.ts` remove orchestrate, add submitJob
- **Old behavior**: `orchestrateToolStep` tests verify the per-step orchestration HTTP call.
- **New equivalent**: `orchestrateToolStep` is removed (BE resolves dependencies internally). New `submitJob` function tested.
- **Rewritten tests must verify**:
  - `submitJob` returns `{ jobId, status: 'queued', totalSteps }` on success
  - `submitJob` rejects when auth capability is missing
  - `submitJob` sends `POST /api/tools/jobs` with correct JSON body
  - Idempotency: duplicate `submitJob` with same `idempotencyKey` returns the existing jobId (HTTP 409 or 200 with same jobId)

### Category C: Removal Justification

#### C01 — `useToolPageRunController.ts` auto-chain bridge (no dedicated test file; logic inlined into other tests)
- **What is removed**: The entire `useLayoutEffect` bridge (~200 lines) with branches (a) pending dispatch, (b) stream terminal resolution, (c) auto-chain trigger. The `pendingStepStart` queue field on `ToolPageContext`. The `STEP_REQUEST_DISPATCHED` clearing event. The `isAutoChainEnabled` state flag and `stopAutoChain` function.
- **Why obsolete**: BE worker iterates all steps internally. FE no longer needs to detect step completion, resolve next available step, and dispatch a new HTTP request. Step progression is driven by SSE `JOB_PROGRESS` events from the BE.
- **Affected test citations**: `useToolPage.test.ts` tests that mock `pendingStepStart` and verify `orchestrateToolStep` → `startRun` dispatch chain; `ToolPageTemplate.test.tsx` tests that verify auto-chain across 2-3 sequential `startRun` calls.

#### C02 — `tool-flow.machine.test.ts`
- **What is removed**: The `toolFlowMachine` actor and its tests. This machine sequences steps (e.g., optin→quiz→vsl), validates out-of-order step completion, and manages retry exhaustion per step.
- **Why obsolete**: In the new system, step order is defined in the BE's `ToolWorkflowPlan` and enforced by the BE worker. The FE no longer needs to validate step transitions. The types exported from `tool-flow.machine.ts` (`SupportedTool`, `ToolStep`, `ToolStepStatus`) remain in use for display purposes and are migrated to a types-only module.
- **Affected test files**: `tool-flow.machine.test.ts` — entire file removed.

#### C03 — `orchestrateToolStep` in `tools-client.test.ts`
- **What is removed**: The `orchestrateToolStep` function and its tests (calls `POST /api/tools/orchestrate`, resolves dependency artifact IDs per step).
- **Why obsolete**: Dependency resolution is BE-owned. The worker resolves `resolveStepDependencyIds` internally using the same logic previously exposed via the orchestrator endpoint.
- **Affected test cases**: `tools-client.test.ts` → `orchestrateToolStep` describe block (3 test cases).

#### C04 — Auto-chain tests in `ToolPageTemplate.test.tsx`
- **What is removed**: Tests `auto-starts the next step after previous step completion in auto-chain mode` and `persists extraction context and grows step dependency context incrementally across steps`. These verify that clicking CTA once triggers a chain of 1 → 2 → 3 sequential `startRun` calls.
- **Why obsolete**: Single `submitJob()` call replaces the auto-chain. The BE worker handles sequential step execution; the FE observes progress via SSE. No per-step dispatch cycles.
- **Affected test cases**: 2 test cases in `ToolPageTemplate.test.tsx` describe block `ToolPageTemplate wiring`.

### Category D: New Test Specifications

#### D01 — `FE-GATE-D01` — `useJobStream` hook
- **Test description**: Hook connects to `GET /api/tools/jobs/:jobId/stream` via `fetch()` + `ReadableStream` (non `EventSource` — GAP-FE-04: `fetch()` supporta header auth), riceve eventi SSE (`progress`, `chunk`, `terminal`), ed espone lo stato parsato.
- **Conditions**:
  - On mount with `jobId`, establishes `fetch()` connection with `Authorization` header
  - `progress` event with `{ step, status: 'running' }` → sets `currentRunningStep`
  - `progress` event with `{ step, status: 'done', artifactId }` → adds step to `completedSteps`, maps `artifactId` to `completedArtifactsByStep`
  - `chunk` event with `{ step, text }` → appends to streaming content buffer
  - `terminal` event with `{ status: completed, artifacts, sessionId }` → sets `isComplete: true`
  - `terminal` event with `{ status: 'failed', reason }` → sets `error`
  - On unmount, calls `AbortController.abort()` e chiude il reader `ReadableStream`
  - On reconnect (connection lost), resumes from last known state via `sessionStorage` jobId
- **Suggested file location**: `apps/frontend/src/features/tools/runtime/useJobStream.test.ts`

#### D02 — `FE-GATE-D02` — `useToolPageSubmitController` hook
- **Test description**: Hook exposes `submitJob` function that calls `POST /api/tools/jobs`, handles loading/error/success states, and dispatches `SUBMIT_JOB` event to the machine.
- **Conditions**:
  - `submitJob` returns `{ jobId }` and transitions machine to `submitting` state
  - `submitJob` calls `POST /api/tools/jobs` with correct `SubmitJobRequest` payload (all required fields: `toolKey`, `projectId`, `extractionPayload`, `model`, `intent`, `idempotencyKey`)
  - `submitJob` rejects when projectId is empty (no HTTP call made)
  - `submitJob` rejects when extraction context is missing (unless asset-based override)
  - On HTTP error, dispatches error state and does NOT transition to `running`
  - The `idempotencyKey` is a stable UUID generated once per submit (not regenerated on retry)
- **Suggested file location**: `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.test.ts`

#### D03 — `FE-GATE-D03` — `toolPageMachine` new transitions
- **Test description**: Machine handles `SUBMIT_JOB`, `JOB_PROGRESS`, `JOB_COMPLETED`, `JOB_FAILED` events correctly.
- **Conditions**:
  - `SUBMIT_JOB` from `configuring` with valid readiness → transitions to `submitting`
  - `SUBMIT_JOB` from `configuring` with invalid readiness → rejected by `canStartGeneration` guard (stays in `configuring`)
  - `SUBMIT_JOB` while already `submitting` or `running` → rejected (no double-submit)
  - `JOB_PROGRESS { step, status: 'running' }` from `running` → sets context field for current step
  - `JOB_PROGRESS { step, status: 'done' }` from `running` → adds to `completedSteps`, fires `PROGRESS_SYNCED`-equivalent recomputation
  - `JOB_COMPLETED` from `running` → transitions to `completed`, all steps marked done
  - `JOB_FAILED { reason }` from `running` or `submitting` → transitions to `configuring.generationFailed`
  - `CANCEL_GENERATION` from `submitting` or `running` → transitions to `configuring.clean`, aborts pending SSE connection
- **Suggested file location**: `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` (extend existing file)

#### D04 — `FE-GATE-D04` — `submitJob` client function
- **Test description**: Plain HTTP client function for the submit-job endpoint.
- **Conditions**:
  - Returns typed `SubmitJobResponse` on HTTP 200
  - Throws on HTTP 4xx/5xx with structured error
  - Throws when `toolsGeneration` capability is missing
  - Sends correct `Content-Type: application/json` header
  - Request body matches `SubmitJobRequest` contract type from `packages/contracts`
- **Suggested file location**: `apps/frontend/src/features/tools/runtime/tools-client.test.ts` (extend existing file, replacing the `orchestrateToolStep` describe block)

#### D05 — `FE-GATE-D05` — SSE-to-machine event bridge
- **Test description**: Integration test verifying that `useJobStream` + `useToolPageSubmitController` compose correctly: submit → stream connect → progress events → machine state updates → UI re-renders.
- **Conditions**:
  - Full flow: CTA click → `SUBMIT_JOB` dispatched → `submitting` state → HTTP 200 → `running` state → SSE `progress` events accumulate → `JOB_COMPLETED` → `completed` state
  - Interruption: SSE disconnects mid-job → FE shows last known progress → on reconnect, resumes from current state via `GET /api/tools/jobs/:id` poll
  - Error: SSE `terminal` with status `failed` → `JOB_FAILED` dispatched → error message shown in UI
- **Suggested file location**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` (extend existing file, replacing auto-chain integration tests)

#### D06 — `FE-GATE-D06` — `ToolPageViewModel` accepts SSE-populated progress
- **Test description**: `buildToolPageViewModel` and `buildReactiveViewModel` produce correct canonical states and policies when `progress.completedSteps` is populated from `JOB_PROGRESS` events (rather than from `PROGRESS_SYNCED` artifact scanning).
- **Conditions**:
  - `completedSteps` has 0 entries → `canonicalState: 'draft-ready'`, `primaryActionPolicy: 'start-generation'`
  - `completedSteps` has 1 entry (not all) → `canonicalState: 'paused-with-checkpoint'`, `primaryActionPolicy: 'resume-checkpoint'`
  - `completedSteps` has all entries → `canonicalState: 'completed'`, `primaryActionPolicy: 'open-last-artifact'`
  - Same behavior for all tool keys (funnel-pages, meta-ads, geometric, youtube-lf-script)
- **Suggested file location**: `apps/frontend/src/features/tools/machines/tool-page-view-model.test.ts` (new file) or extend `tool-page.machine.test.ts`

### No-Regression Gate

The single CI command that proves all gate-enforced tests pass:

```
npm --workspace apps/frontend run test
```

**Pre-conditions for this gate to be meaningful**:
1. All Category B tests have been rewritten as specified above and are passing.
2. All Category C tests have been removed (their removal must not reduce coverage below thresholds: lines 70%, functions 70%, branches 60%, statements 70%).
3. All Category D tests (`FE-GATE-D01` through `FE-GATE-D06`) have been written and are passing.
4. The feature flag `TOOL_WORKFLOW_USE_JOB_SYSTEM` is set to `true` for at least one tool key (e.g., `geometric`) in the test environment, and a Category A-only gate run confirms no regression:
   ```
   npm --workspace apps/frontend run test -- --grep "Category A preserved"
   ```

**Gate enforcement**: Category D tests (`FE-GATE-D01` through `FE-GATE-D06`) must be written and passing **before** the feature flag `TOOL_WORKFLOW_USE_JOB_SYSTEM` is enabled for any production tool key. The gate is not satisfied by Category A tests alone — new behavior must have test coverage from day one.

## Context7 Verification Notes

Le sezioni della proposal relative a XState v5 e BullMQ sono state verificate contro la documentazione ufficiale (Context7 + Stately docs live). Ultima verifica: 2026-07-24.

### XState v5

| Claim | Esito | Fonte |
|---|---|---|
| `toolWorkflowMachine` puo' ricevere input multi-step via `invoke.input` | **Confermato** — XState v5 supporta `invoke` con `input` dinamico derivato da `context` | [Invoke Service and Capture Results](https://github.com/statelyai/xstate/blob/main/examples/workflow-media-scanner/README.md) |
| `getPersistedSnapshot()` + `createActor(machine, { snapshot })` per serializzazione | **Confermato** — API pulita, deep child actor preservation. Verificato con test `rehydration.test.ts` nel repo XState: actor tree ripristinato con nested child context intatto | [Stately docs — Persistence](https://stately.ai/docs/persistence), [XState rehydration test](https://github.com/statelyai/xstate/blob/main/packages/core/test/rehydration.test.ts) |
| **"Invocations will restart"** dopo un restore | **CONFERMATO** — _"Actions from machine actors will not be re-executed, because they are assumed to have been already executed. However, invocations will be restarted, and spawned actors will be restored recursively."_ — Questo e' il motivo primario per cui la serializzazione mid-flight non e' adatta: causerebbe chiamate LLM duplicate | [Stately docs — Restoring state](https://stately.ai/docs/persistence#restoring-state) |
| Deep child actor preservation durante restore | **Confermato** — _"Persisting & restoring state from machine actors is deep; all invoked & spawned actors will be persisted and restored recursively."_ | [Stately docs — Deep persistence](https://stately.ai/docs/persistence#deep-persistence) |
| Assenza di schema migration built-in per machine snapshot | **Confermato** — solo `xstate-store` ha `migrate`. Machine snapshot richiederebbero transform manuale. Le caveat docs elencano "incompatible state" come rischio | [Stately docs — Caveats](https://stately.ai/docs/persistence#caveats), [XState Store Schema Migrations](https://stately.ai/docs/xstate-store/persist) |
| `createActor(machine, { input })` per inizializzazione con dati | **Confermato** — pattern standard XState v5 | [Inject Context into Actor Initialization](https://github.com/statelyai/xstate/blob/main/examples/workflow-media-scanner/README.md) |

### BullMQ v5.78.0

| Claim | Esito | Fonte |
|---|---|---|
| `group: { id: (job) => ... }` con group-concurrency | **NON DISPONIBILE in OSS** — richiede `WorkerPro` da `@taskforcesh/bullmq-pro`. Il fallback Redis lock (`SET NX EX`) descritto in HIGH-01 e' l'unica strada percorribile in Fase 1 con BullMQ OSS. La sintassi `group: { id }` nella sezione `worker.ts` e' stata marcata come "incertezza dichiarata — da rimuovere/commentare nell'implementazione effettiva" | [BullMQ Pro Groups — Concurrency](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/bullmq-pro/groups/concurrency.md) |
| `limiter: { max: 10, duration: 60_000 }` | **Confermato** — disponibile in OSS. Limita il numero di job processati per worker in una finestra temporale | [BullMQ Guide — Rate Limiting](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/rate-limiting.md) |
| `removeOnComplete: { age: 3600 * 24 }` | **Confermato** — `age` in secondi. 86400 = 24 ore. Corretto | [BullMQ Guide — Auto-removal of jobs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/auto-removal-of-jobs.md) |
| `removeOnFail: { age: 3600 * 24 * 7 }` | **Confermato** — `age` in secondi. 604800 = 7 giorni. Corretto | [BullMQ Guide — Auto-removal of jobs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/auto-removal-of-jobs.md) |
| `concurrency: 3` | **Confermato** — disponibile in OSS. Max job concorrenti per worker | [BullMQ Guide — Workers](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/workers/concurrency.md) |
| `attempts: 3` con `backoff: { type: 'exponential', delay: 2000 }` | **Confermato** — formula: `delay * 2^(attemptsMade-1)`. Con delay=2000: tentativo 1 = 2000ms, tentativo 2 = 4000ms, tentativo 3 = 8000ms | [BullMQ — Backoffs](https://github.com/taskforcesh/bullmq/blob/master/src/classes/backoffs.ts) |
| `Queue.add()` tipo di ritorno | **Confermato** — `job.id` e' disponibile dopo `add()`. Usato in `crawling-queue.ts` e nella proposal per restituire `jobId` | BullMQ Queue API (verificato in `crawling-queue.ts:66-75`) |

---

## Code Verification Status (2026-07-23)

> **Status: NOT IMPLEMENTED** — Zero code artifacts exist. All 10 core components are missing.

| Component | Code Status |
|---|---|
| `tool-workflow-job-processor.ts` | **MISSING** |
| `tool-workflow-job-queue.ts` | **MISSING** |
| `tools-job-handlers.ts` | **MISSING** |
| `tools-job-stream-handler.ts` | **MISSING** |
| `worker-entry.ts` | **MISSING** |
| `useToolPageSubmitController` (FE) | **MISSING** |
| `useJobStream` (FE) | **MISSING** |
| `SUBMIT_JOB` event in tool-page machine | **MISSING** |
| `tool_jobs` DB table | **MISSING** |
| `TOOL_WORKFLOW_USE_JOB_SYSTEM` feature flag | **MISSING** |

Infrastructure prerequisites confirmed available: BullMQ v5.78.0 in `package.json`, Redis configured, `job-event-bridge.ts` + `job-progress-serializer.ts` (prerequisiti BullMQ), SSE streaming implemented.

**Conclusione**: la decisione di evitare serializzazione XState mid-flight e' supportata dalla documentazione ufficiale. L'API di persistenza e' pulita ma il comportamento "invocations will restart" la rende inadatta a preservare lo stato durante una chiamata LLM in corso. Il retry da zero con idempotency key e' l'approccio corretto.
