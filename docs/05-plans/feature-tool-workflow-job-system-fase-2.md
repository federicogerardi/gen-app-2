---
status: implemented
version: 2.1
date_created: 2026-07-24
last-reviewed: 2026-07-24
next-review-date: 2027-01-24
implementation_date: 2026-07-24
owner: Backend Runtime + Frontend Tools
type: implementation-plan
tags: [tool-workflow-job, bullmq, sse, backend-driven, phase-2, optimization, postgres, payload-propagation]
goal: Ottimizzare il sistema ToolWorkflowJob con payload propagation, persistenza Postgres, deployment worker separato, e dashboard admin funzionante.
---
> ⚑ DDD Reference: [Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) · [BCM](../02-design/domain-bounded-context-map.md) · [Decision Log](../07-governance/domain-naming-decision-log.md) · DDD-226/DDD-227 · DDD-NEW `ToolWorkflowJobStatus`, `ToolWorkflowJobRepository`

# Implementation Plan: ToolWorkflowJob System — Fase 2

> **Collegamenti**: [Proposal BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (v1.13, `implemented`) · [Fase 1 Plan](./feature-tool-workflow-job-system-fase-1.md) (v2.2, `implemented`) · DDD-226/DDD-227

---

## 1. Overview

**Obiettivo**: Completare l'hardening production-grade del sistema ToolWorkflowJob. La Fase 2 risolve i bug strutturali emersi nello smoke test (payload propagation, re-execution crawling/scoring, assenza di artifact content resolution), migra lo stato job da Redis a Postgres, abilita deployment worker separato, e porta la dashboard admin da stub a funzionante.

**Stima complessiva**: 11-13 giorni lavorativi (2.5 settimane)

**Prerequisiti validati dalla Fase 1:**
- Tutti gli 11 tool funzionanti con job system (zero regressioni)
- Worker BullMQ in-process con graceful shutdown
- SSE stream functional via Redis pub/sub (`job-event-bridge.ts`)
- Feature flag `toolsJobSystem` attivo e verificato

**Bug strutturali ereditati dalla Fase 1 (da risolvere in questa fase):**

| # | Bug | Impatto |
|---|-----|---------|
| B1 | Ogni step crea un attore `generationSystemMachine` indipendente → crawling+scoring rieseguiti per ogni step (SerpApi calls ×4 per geometric) | Costi API duplicati |
| B2 | `stepDependencyArtifactIds` risolti ma non usati da `runCrawlingStep`/`runScoringStep` — ricevono solo `extractionPayload` | Nessun contesto tra step |
| B3 | Nessuna risoluzione di artifact content nel processor — solo ID passati, mai fetchato il contenuto | `{{output_step_xxx}}` placeholder vuoti nei prompt |
| B4 | Admin Data Table stub (Fase 1 Task 3.5) | Dashboard admin inutilizzabile |
| B5 | `sessionStorage` workaround per resume (HIGH-02) — nessuna vera discovery multi-job | UX fragile dopo reload |

---

## 1.1 DDD Prerequisites (da registrare prima dell'implementazione)

Il piano introduce nuovi termini che richiedono entry nella [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md):

| DDD-# | Termine | Tipo | Motivazione |
|-------|---------|------|-------------|
| DDD-NEW | **`ToolWorkflowJobStatus`** | Value Object | Enum `queued` \| `running` \| `completed` \| `failed` \| `cancelled`. Usato nel `CHECK` constraint della tabella `tool_jobs`, nel FE `StatusBadge`, e nel filtro admin. DDD-226 menziona gli stati informalmente ma non li registra come Value Object. |
| DDD-NEW | **`ToolWorkflowJobRepository`** | Repository | Nome canonico del repository per l'aggregate root `ToolWorkflowJob` (DDD-226). Segue il pattern `{context}.{entity}.repository.ts` già usato da `postgres.artifact.repository.ts`, `postgres-redis.idempotency.repository.ts`. Evita l'abbreviazione non-canonica `ToolJobRepository`. |

**Nota**: il riferimento errato a `DDD-228` nel plan header e in `packages/contracts/src/index.ts:419` va rimosso — DDD-228 è `ToolAssetContract single-produce principle`, non correlato a ToolWorkflowJob.

---

## 2. Architecture Changes

### 2.1 Artifact Content Resolution Flow

Il processor oggi raccoglie `{ artifactId, content }` da ogni step in `StepResult` ma scarta il content. In Fase 2, il content viene preservato in una mappa `completedStepContents: Record<string, StepResult>` e risolto per gli step successivi:

```
processToolWorkflowJob:
  completedStepContents = {}
  
  for each step:
    a. resolveStepDependencyIds → stepDependencyArtifactIds[]
    b. lookup completedStepContents[depKey] → stepDependencyArtifactContentsByStep
    c. per crawling/scoring: inietta content come crawling.sources pre-popolato
    d. per generation: popola stepDependencyArtifactContentsByStep nel request
    e. runStepByType → StepResult
    f. completedStepContents[stepKey] = result
```

Il content degli artifact è già disponibile in due punti:
1. **In-memory**: `runSingleStepGeneration` restituisce `{ artifactId, content }` con il content buffer
2. **Postgres**: `adapters.artifactQueries.getArtifactDetail(artifactId)` (da aggiungere come metodo esposto)

**Decisione**: usare l'in-memory content dalla mappa locale (evita round-trip Postgres per ogni step).

### 2.2 Postgres `tool_jobs` Write Strategy

Il processor scrive in **dual-write**: BullMQ gestisce automaticamente lo stato interno job (Redis), mentre il processor popola Postgres per il recovery e le query admin:

```
on submit:
  INSERT INTO tool_jobs (job_id, user_id, project_id, tool_key, status, ...)

on step completed:
  UPDATE tool_jobs SET progress = ..., updated_at = now()

on workflow completed/failed/cancelled:
  UPDATE tool_jobs SET status = ..., result = ..., completed_at = now()
```

Il read path (`handleGetJobStatus`, `handleListJobs`) migra da Redis a Postgres. Le operazioni Redis restano per: lock single-flight, idempotency, progress temporaneo (serializer).

### 2.3 Deployment Worker Separato

`worker-entry.ts` esiste già dalla Fase 1 (Task 1.5). Il lavoro Fase 2 consiste nel:
- Verificare che `worker-entry.ts` sia completo per esecuzione standalone (connessioni, error handling, graceful shutdown)
- Aggiornare `Dockerfile` con un secondo container `worker`
- Configurare il deployment Railway per due servizi (`server` + `worker`)

---

## 3. Task Breakdown

### Pillar A — Payload & Context Propagation (5 giorni)

Risolve B1, B2, B3.

#### Task A.0 — Prerequisite: expose artifact content reader (0.5 days)
- **Action**: Aggiungere `getArtifactDetail(artifactId: string): Promise<{ content: string } | null>` a `ArtifactQueryRepository` (interfaccia `postgres-redis.interfaces.ts`) e implementazione `postgres.artifact-query.repository.ts`. Esporre via `PostgresRedisArtifactRepository` come `fetchArtifactContent`.
- **File**: `packages/infra-db/src/artifact-query.repository.ts` o adapter equivalente
- **Why**: Necessario come fallback per risolvere artifact content da Postgres se il content in-memory non è disponibile (es. retry dopo crash). Il metodo esiste già come `getArtifactDetailBySessionStep` ma non per artifact ID singolo.
- **Risk**: Bassa — query semplice, pattern esistente.

#### Task A.1 — Preservare `completedStepContents` nel processor (0.5 days)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**: Aggiungere `const completedStepContents = new Map<string, { artifactId: string; content: string }>()` all'inizio del loop. Dopo `runStepByType`, salvare `completedStepContents.set(stepKey, result)`. Espandere il tipo `StepResult` se necessario.
- **Why**: Risolve B3 — il content è già disponibile nel `StepResult` ma viene scartato. Salvarlo in una mappa lo rende disponibile agli step successivi.
- **Risk**: Bassa — aggiunta puramente additiva.

#### Task A.2 — Iniettare `crawling.sources` nei passaggi crawling/scoring successivi (1.5 days)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**:
  1. Modificare `runCrawlingStep` per accettare `crawlingContext?: { snippets: string; sources: unknown[]; paaQueries: string[] }` opzionale
  2. Modificare `runScoringStep` per accettare `crawlingContext?` e `scoringContext?` opzionali
  3. Nel loop `processToolWorkflowJob`: prima di chiamare crawling/scoring, cercare nella mappa `completedStepContents` se esiste un artifact crawling/scoring precedente
  4. Se esiste, parsare il content JSON (struttura `CrawlArtifact`/`ScoringArtifact`) e iniettarlo come `requestInput.crawling` / `requestInput.scoring` pre-popolato
  5. Aggiungere logica skip: se `crawlingContext` è fornito, `invokeCrawling`/`invokeScoring` usa i dati pre-popolati invece di chiamare SerpApi
- **Why**: Risolve B1 — crawling/scoring eseguiti una sola volta. Step successivi riusano i dati via content risolto.
- **Risk**: Alta — richiede comprensione della struttura interna di `CrawlArtifact` e `ScoringArtifact`. Il content JSON deve essere parsato correttamente per estrarre `sources`, `snippets`, `paaQueries`, `ranking`. Se il format cambia, il parsing si rompe.
- **Mitigation**: usare le stesse funzioni di merge di `tool-workflow.machine.ts` (`mergeCrawlingOutput`, `mergeScoringOutput`) invece di reimplementare il parsing.

#### Task A.3 — Popolare `stepDependencyArtifactContentsByStep` per generation step (1 day)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` + `apps/backend/src/lib/runtime/request-contract.ts`
- **Action**:
  1. In `buildBackendGenerationRequest`: aggiungere `stepDependencyArtifactContentsByStep` (Record<string, string>) come nuovo campo in `input`
  2. Nel loop del processor: costruire `stepDependencyArtifactContentsByStep` cercando ogni `depKey` nella mappa `completedStepContents` e mappando `depKey → completedStepContents[depKey].content`
  3. Passare il risultato a `buildBackendGenerationRequest`
- **Why**: Risolve B3 — i placeholder `{{output_step_xxx}}` nei prompt vengono popolati con il contenuto reale degli step precedenti.
- **Verifica**: `assembleChainAwarePrompt` in `generation-system.actions.ts` (linee 420-483) già supporta `stepDependencyArtifactContentsByStep` — verifica che il field arrivi attraverso la catena `BackendGenerationRequest.input → buildRequestReceivedEvent → enrichedInput → context.requestInput`.
- **Risk**: Media — cambiamento cross-cutting nel contract di `BackendGenerationRequest.input`. Verificare che non rompa la backward compat con il path legacy (che popola lo stesso campo via orchestrate handler).

#### Task A.4 — Integration test: payload propagation end-to-end (0.5 days)
- **File**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (estendi)
- **Action**: Test geometric 4-step:
  1. Step 0 (serp-crawling): verifica 1 chiamata SerpApi
  2. Step 1 (competitor-scoring): verifica 0 chiamate SerpApi (usa dati step 0)
  3. Step 2 (strategic-reporting): verifica che `stepDependencyArtifactContentsByStep` contenga content di step 0 e 1
  4. Step 3 (unified-report): idem per step 0, 1, 2
- **AC coperto**: AC-016

#### Task A.5 — Idempotency cleanup su step failure (0.5 days)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**: Già implementato nel commit `e27ffe7` (Fase 1). Verificare e testare.
- **Why**: Previene `idempotency_conflict` sui retry BullMQ dopo step failure.

---

### Pillar B — Postgres `tool_jobs` Table (3 days)

Risolve B4, B5 e completa i non-goals Fase 1 #2 (Postgres), #5 (costo/token), #6 (discovery).

#### Task B.0 — Schema definition + migration (0.5 days)
- **File**: `packages/infra-db/migrations/XXXX_add_tool_jobs.sql` (nuova)
- **Schema**:
  ```sql
  CREATE TABLE tool_jobs (
    job_id         TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    project_id     TEXT NOT NULL,
    tool_key       TEXT NOT NULL,
    workflow_type  TEXT NOT NULL,
    session_id     TEXT,
    status         TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','running','completed','failed','cancelled')),
    total_steps    INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    progress       JSONB DEFAULT '{}',
    result         JSONB,
    model          TEXT,
    cost_usd       NUMERIC(12,6) DEFAULT 0,
    input_tokens   INTEGER DEFAULT 0,
    output_tokens  INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at   TIMESTAMPTZ
  );

  CREATE INDEX idx_tool_jobs_user_status ON tool_jobs(user_id, status);
  CREATE INDEX idx_tool_jobs_project ON tool_jobs(project_id);
  CREATE INDEX idx_tool_jobs_tool_key ON tool_jobs(tool_key);
  CREATE INDEX idx_tool_jobs_session ON tool_jobs(session_id);
  ```
- **Why**: Schema allineato alla proposal (Sezione 6) con campi aggiuntivi per costo/token (HIGH-03) e `session_id` per correlazione artifact→job. `model`, `cost_usd`, `input_tokens`, `output_tokens` sono un **read-model cache**: duplicano dati già presenti in `artifacts` ma sono pre-aggregati via `SUM()` a completamento job (Task B.3) per efficienza delle query admin. La fonte autorevole resta la tabella `artifacts`.

#### Task B.1 — `ToolWorkflowJobRepository` via Kysely (1 day)
- **File**: `apps/backend/src/lib/adapters/postgres.tool-workflow-job.repository.ts` (nuovo)
- **Action**: Implementare `create`, `updateProgress`, `markCompleted`, `markFailed`, `markCancelled`, `findById`, `listByFilter` con supporto per paginazione e filtri (userId, projectId, toolKey, status).
- **Dependencies**: B.0 (schema)
- **Risk**: Media — pattern Kysely già rodato nel progetto (vedi `postgres.artifact.repository.ts`).

#### Task B.2 — Dual-write nel processor (0.75 days)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**:
  1. Iniettare `ToolWorkflowJobRepository` in `ProcessToolWorkflowJobContext`
  2. All'inizio del processore: `repository.create({ jobId, userId, projectId, toolKey, workflowType, totalSteps, ... })`
  3. Dopo ogni step completato: `repository.updateProgress(jobId, { completedSteps, progress })`
  4. Al completamento/failure/cancel: `repository.markCompleted/markFailed/markCancelled(jobId, { result, cost, tokens })`
- **Why**: Persistenza dual-write. BullMQ gestisce lo stato job internamente (Redis); Postgres fornisce query e retention.
- **Risk**: Media — il repository deve esistere (B.1) prima di questo task.

#### Task B.3 — Aggregazione costo/token (HIGH-03) (0.5 days)
- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**: Al completamento del workflow, calcolare `SUM(input_tokens)`, `SUM(output_tokens)`, `SUM(cost_usd)` dagli artifact della sessione e scrivere nei campi `cost_usd`, `input_tokens`, `output_tokens` della tabella `tool_jobs`.
- **Why**: HIGH-03 della proposal. I dati di costo/token sono già disponibili negli artifact (`artifacts.input_tokens`, `artifacts.output_tokens`, `artifacts.cost_usd`). Va aggiunta una query `SUM()` nel repository.
- **Risk**: Bassa — query aggregata semplice.

#### Task B.4 — Migrazione read path: Redis → Postgres (0.75 days)
- **File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-job-handlers.ts`
- **Action**:
  1. `handleGetJobStatus`: sostituire lettura Redis hash `tool-job:{jobId}` con `repository.findById(jobId)`
  2. `handleListJobs`: sostituire iterazione chiavi Redis `tool-job:*` con `repository.listByFilter(filters)`
  3. Aggiungere `GET /api/tools/jobs?projectId=&toolKey=` come endpoint discovery (HIGH-02)
- **Note**: Redis resta per lock single-flight, idempotency, e progress temporaneo (serializer). Solo lo storage permanente migra a Postgres.
- **Risk**: Media — il read path deve gestire il caso di job non ancora migrati (creati prima del deploy). Fallback: se `findById` restituisce null, tentare Redis.
- **Migration**: Backfill non necessario per Fase 2 — i job pre-migrazione hanno TTL Redis 24h. Dopo 24h dal deploy, solo Postgres.

---

### Pillar C — Deployment Worker Separato (1.5 days) ⚠ *rivisto al ribasso vs proposta iniziale*

`worker-entry.ts` esiste già dalla Fase 1 (Task 1.5). Il lavoro Fase 2 è verifica + configurazione deployment.

#### Task C.1 — Verifica `worker-entry.ts` come processo standalone (0.25 days)
- **File**: `apps/backend/src/worker-entry.ts`
- **Action**: Verificare che il file copra:
  - Connessione Redis + Postgres con le stesse variabili d'env del server
  - `createToolWorkflowWorker` + `processToolWorkflowJob`
  - Graceful shutdown su SIGTERM/SIGINT
  - Logging strutturato
  - Gestione errori fatale (process.exit)
- **Why**: Il file esiste ma non è mai stato testato come processo standalone — solo in-process dentro `server.ts`.
- **Risk**: Bassa — file di ~50 linee, boilerplate.

#### Task C.2 — Aggiornamento `Dockerfile` per worker separato (0.5 days)
- **File**: `Dockerfile` (root)
- **Action**:
  1. Aggiungere secondo stage o multi-service entry: `CMD` condizionale basato su env `SERVICE_ROLE=worker|server`
  2. Alternativa Railway: due servizi nello stesso `Dockerfile` con entry point diversi
  3. `npm run start:worker` script in `apps/backend/package.json`
- **Why**: Abilita il deployment come due container separati su Railway.
- **Risk**: Media — pattern multi-service Docker da validare con Railway.

#### Task C.3 — Configurazione Railway + smoke test cross-processo (0.5 days)
- **File**: `railway.json` o equivalente
- **Action**:
  1. Definire due servizi: `server` (port 3000, `SERVICE_ROLE=server`) e `worker` (nessuna porta, `SERVICE_ROLE=worker`)
  2. `TOOL_WORKFLOW_WORKER_IN_PROCESS=false` sul server
  3. Smoke test: submit job via server HTTP → worker processa → SSE eventi ricevuti via Redis pub/sub (già funzionante cross-process)
- **Why**: Prerequisito per produzione separata.
- **Risk**: Media — dipende dalla configurazione Railway.

#### Task C.4 — Rimozione (non applicabile)
- **Original C.4** ("SSE via Redis pub/sub — verifica cross-processo"): già implementato in Fase 1 (`job-event-bridge.ts` usa Redis pub/sub). Eliminato dal piano.

---

### Pillar D — Admin & Discovery (2.5 days)

Risolve B4, B5.

#### Task D.1 — Discovery endpoint (HIGH-02) (0.5 days)
- **File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-job-handlers.ts`
- **Action**: `GET /api/tools/jobs?projectId=&toolKey=` — restituisce `{ jobs: JobSummary[] }` con `{ jobId, toolKey, status, progress, createdAt }`
- **Why**: Sostituisce il workaround `sessionStorage` della Fase 1. Il FE può ora scoprire job attivi per un progetto senza dover conoscere il `jobId` a priori.
- **Dependencies**: B.4 (repository Postgres per `listByFilter`)

#### Task D.2 — `useAdminToolWorkflowJobsQuery` da stub a hook SWR reale (0.5 days)
- **File**: `apps/frontend/src/features/admin/runtime/useAdminToolWorkflowJobsQuery.ts`
- **Action**: Implementare `useSWR('/api/tools/jobs', fetcher)` con filtri passati come query params. Polling interval 10s per aggiornamento automatico.
- **Dependencies**: D.1 (discovery endpoint)

#### Task D.3 — `AdminToolWorkflowJobsToolbar` con filtri reali (0.5 days)
- **File**: `apps/frontend/src/features/admin/ui/AdminToolWorkflowJobsToolbar.tsx`
- **Action**: Sostituire stub con componenti reali:
  - Status select (popolato da enum `ToolWorkflowJobStatus`)
  - Tool select (popolato da `TOOL_KEYS`)
  - User autocomplete (da `GET /api/admin/users` o locale)
- **Dependencies**: D.2

#### Task D.4 — Aggregazione costo/token nella dashboard admin (0.5 days)
- **File**: `apps/frontend/src/features/admin/pages/AdminToolWorkflowJobsPage.tsx`
- **Action**: Aggiungere colonne `costUsd`, `inputTokens`, `outputTokens` alla Data Table (dati da `tool_jobs.cost_usd`, `tool_jobs.input_tokens`, `tool_jobs.output_tokens` di Postgres).
- **Dependencies**: B.3 (costo/token popolati nel processor)

#### Task D.5 — Rimozione workaround `sessionStorage` (0.25 days)
- **File**: `apps/frontend/src/features/tools/runtime/useToolPageSubmitController.ts` + `useToolWorkflowJobStream.ts`
- **Action**: Sostituire `sessionStorage.getItem('tool-job:...')` con `GET /api/tools/jobs?projectId=&toolKey=` per scoprire job attivi al mount. Rimuovere `sessionStorage.setItem` al submit.
- **Why**: HIGH-02 chiuso. UX più robusta: dopo reload, il FE scopre automaticamente il job attivo senza dipendere da sessionStorage.
- **Dependencies**: D.1

---

### Pillar D — UX/UI Acceptance Criteria (aggiuntivi, da Task D.1–D.5)

Requisiti UX derivati dalla review del design system e Fase 1.

#### D.UX.1 — Discovery endpoint tie-breaking (Task D.1)
- `GET /api/tools/jobs?projectId=&toolKey=` restituisce al massimo 1 job: il più recente con `status IN ('queued','running')`, ordinato per `created_at DESC LIMIT 1`.
- **Why**: Evita ambiguità su quale job mostrare se l'utente ha re-submittato prima del completamento.

#### D.UX.2 — Mount transition state (Task D.5)
- Durante la chiamata API discovery, il Workflow Panel mostra un indicatore di caricamento sottile (`pendingJobId: 'discovering'`) invece di flashare il `ToolGenerationFlowVertical` legacy.
- Se la discovery fallisce, mostra un messaggio non-bloccante "Unable to check for active jobs" e defaulta alla view legacy (non uno stato broken).

#### D.UX.3 — Admin Data Table convergence (Task D.2/D.3)
- Sostituire `<table>` raw con `ListingTableSection` + `AdminPageContainer` (pattern canonico Data Table View).
- Usare `StatusBadge` per la colonna status con mapping `ToolWorkflowJobStatus → variant` (queued=neutral, running=info, completed=success, failed=error, cancelled=warning).
- Colonna `progress`: `—` per job in stato `queued`; `{completed}/{total}` per running/completed/failed.
- Azioni row via `bordered-chip` pattern (`inlineLink` + `artifactTableActionLink`).
- Cancel/Retry: `MUI Dialog` di conferma con testo esplicito.
- Mutation outcomes via `GlobalFeedbackMessage` channel (canonico per mutazioni cross-page).
- `Inspect` action: naviga a `/artifacts?sessionId={sessionId}`.

#### D.UX.4 — Pagination (Task D.2)
- Server-side pagination: 25 righe per pagina, `offset`/`limit` nei query params.
- `PaginationBlockControls` passato come `paginationNode` a `ListingTableSection`.

#### D.UX.5 — Cost/token columns (Task D.4)
- Nascoste dietro toggle "Show costs" nella toolbar (non visibili di default).
- Formattazione: `costUsd` → `$0.023` (3 decimali); `null` → `—`.
- Token counts con separatore migliaia: `15,234`.
- Allineamento colonne numeriche a destra.

#### D.UX.6 — Adaptive polling (Task D.2)
- `useSWR` con `refreshInterval` adattivo: 3s quando almeno una riga ha `status=running`, 10s altrimenti.
- `revalidateOnFocus: true` per la pagina admin (il default globale `false` è per tool pages dove il focus-triggered refetch può interrompere lo stream SSE).

#### D.UX.7 — Admin sub-navigation (Task D.2)
- Aggiungere voce "Tool Jobs" nella sub-navigation admin, tra "Sessions" e gli eventuali item successivi.

#### D.UX.8 — Accessibility (Task D.2/D.3)
- **A11Y-1**: Usare primitive `PageStateMessage` canoniche (`LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage`) — niente `<div role="alert">` raw.
- **A11Y-2**: I cambi filtro annunciano il conteggio risultati via `aria-live="polite"`.
- **A11Y-3**: Tutti gli `aria-label` referenziano chiavi `appCopy`.
- **A11Y-4**: `ListingTableSection` garantisce `aria-label` unici per ogni landmark.
- **A11Y-5**: `EmptyStateMessage` con contesto: "No tool workflow jobs found. Jobs will appear here when users run tool workflows."

---

## 4. Pillar E — Long-Lived Actor (Opzionale, 5+ giorni)

> ⚠ **Deferito a Fase 3.** Modifica `generationSystemMachine` per eseguire multi-step in un singolo attore invece di attori indipendenti per step. Risolve B1 in modo architetturale invece che con content injection (Pillar A). Alto rischio di regressione (tocca la macchina XState core, 9 test Category A). Da valutare solo se il costo SerpApi della soluzione Pillar A è ancora inaccettabile dopo l'ottimizzazione.

---

## 5. Dependency Graph

```
B.0 (schema) ──→ B.1 (repository) ──→ B.2 (dual-write processor) ──→ B.3 (costo/token)
                      │                     │
                      ├──→ B.4 (read path) ──→ D.1 (discovery) ──→ D.2 (SWR hook)
                      │                                                │
                      │                                                └──→ D.3 (toolbar filtri)
                      │
A.0 (artifact reader) ─┐
                       ├──→ A.1 (completedStepContents) ──→ A.2 (crawling/scoring injection)
                       │                                        │
                       │                                        ├──→ A.3 (stepDependencyArtifactContentsByStep)
                       │                                        │
                       └──→ A.5 (idempotency cleanup)           └──→ A.4 (integration test)

C.1 (verify worker-entry) ──→ C.2 (Dockerfile) ──→ C.3 (Railway + smoke)

D.4 (aggregation admin) richiede B.3
D.5 (rimozione sessionStorage) richiede D.1
```

**Parallelizzabile**: Pillar A e Pillar B sono indipendenti — possono partire in parallelo. Pillar C è indipendente da A e B. Pillar D dipende da B.4 e B.3.

---

## 6. Giorno per Giorno

| Giorni | Pillar | Task |
|--------|--------|------|
| 1-2 | A | A.0 (artifact reader) + A.1 (completedStepContents) + A.2 (crawling/scoring injection) |
| 1-2 | B (parallelo) | B.0 (migration) + B.1 (repository) |
| 3-4 | A | A.3 (stepDependencyArtifactContentsByStep) + A.4 (integration test) + A.5 (idempotency) |
| 3-4 | B (parallelo) | B.2 (dual-write processor) |
| 5 | B | B.3 (costo/token) + B.4 (read path migration) |
| 6-7 | D | D.1 (discovery) + D.2 (SWR hook) + D.3 (toolbar) + D.4 (aggregation) + D.5 (sessionStorage removal) |
| 8-9 | C | C.1 (verify worker-entry) + C.2 (Dockerfile) + C.3 (Railway smoke test) |
| 10-11 | Testing | Regressione BE + FE + smoke test cross-processo |

---

## 7. Testing Strategy

### Acceptance Criteria

| AC | Descrizione | Verificato da |
|----|------------|---------------|
| AC-016 | Artifact content da step N è disponibile per step N+1 (sia crawling/scoring che generation) | A.4 |
| AC-017 | Postgres `tool_jobs` rispecchia tutti i job attivi; read path (`handleGetJobStatus`, `handleListJobs`) restituisce dati da Postgres | B.4 + test unit |
| AC-018 | Worker separato completa job indipendentemente dall'HTTP server | C.3 |
| AC-019 | `GET /api/tools/jobs?projectId=&toolKey=` restituisce job attivi per scope | D.1 + D.5 |
| AC-020 | Admin Data Table mostra job reali con filtri funzionanti (status, tool, user) | D.2 + D.3 |
| AC-021 | `cost_usd`, `input_tokens`, `output_tokens` popolati su `tool_jobs` e visibili in admin | B.3 + D.4 |
| AC-022 | Geometric 4-step: 1 sola chiamata SerpApi (step 0) + step 1-3 riusano dati | A.4 |
| AC-023 | `npm run typecheck && npm run test` passa in tutti i workspace (regression gate invariato) | CI |
| AC-024 | Feature flag `toolsJobSystem: false` → path legacy invariato (come Fase 1) | Regression test Category A |
| AC-025 | Admin Data Table usa `ListingTableSection` + `AdminPageContainer` + `StatusBadge` (no raw table/html) | D.UX.3 |
| AC-026 | Cost/token columns hidden behind toggle, formattati correttamente | D.UX.5 |
| AC-027 | Paginazione server-side funzionante (25/page) | D.UX.4 |
| AC-028 | Adaptive polling: 3s running, 10s idle | D.UX.6 |
| AC-029 | Admin Data Table: `PageStateMessage` primitives per loading/error/empty, `aria-live` per filtri | D.UX.8 |
| AC-030 | Discovery endpoint: mount transition non-bloccante (no flash legacy view) | D.UX.2 |

### Backend Gate

```
npm --workspace apps/backend run test
```

- Tutti i test Category A (9 file) invariati
- Test Category B (`generation-system.runtime.test.ts`) invariato
- Test Category D (Fase 1: 4 file) invariati
- Nuovi test:
  - `runtime.tool-workflow-job-processor.test.ts` — esteso con A.4 (payload propagation)
  - `runtime.tool-workflow-job-repository.test.ts` — nuovo, testa CRUD `ToolWorkflowJobRepository`
  - `runtime.tool-workflow-job-queue.test.ts` — esteso con cross-process smoke

### Frontend Gate

```
npm --workspace apps/frontend run test
```

- Tutti i test Fase 1 (Category A, C, D) invariati
- Nuovi test:
  - `useAdminToolWorkflowJobsQuery.test.ts` — nuovo, testa hook SWR con MSW
  - `AdminToolWorkflowJobsPage.test.tsx` — nuovo, testa rendering Data Table

### Integration Gate

```
set -a && . .env.local && set +a && npm run test:smoke
```

- Smoke test cross-processo: submit via HTTP → worker separato processa → SSE ricevuto
- Verifica Postgres: query `tool_jobs` dopo completamento

---

## 8. Risks & Mitigations

| Risk | Probabilità | Impatto | Mitigation |
|------|-------------|---------|------------|
| **A.2: Parsing `CrawlArtifact` content per estrarre `sources`** | Media | Alto | Riutilizzare `mergeCrawlingOutput` di `tool-workflow.machine.ts` invece di reimplementare il parsing |
| **A.3: `stepDependencyArtifactContentsByStep` non arriva a `assembleChainAwarePrompt`** | Media | Alto | Tracciare il field attraverso `BackendGenerationRequest.input → buildRequestReceivedEvent → enrichedInput → context.requestInput`. Test dedicato |
| **B.2: Dual-write fallisce parzialmente** | Bassa | Medio | Se Postgres write fallisce, BullMQ state è ancora valido. Il job completa normalmente ma senza persistenza Postgres. Loggare l'errore e non bloccare il workflow |
| **B.4: Jobs pre-migrazione invisibili** | Bassa | Basso | TTL Redis 24h. Dopo 24h dal deploy, solo Postgres. Nessun backfill necessario |
| **C.3: Railway multi-service config errata** | Media | Alto | Testare localmente con `docker-compose` prima del deploy Railway |
| **Regressions da modifiche al processor** | Media | Critico | Tutti i test Category D (Fase 1) devono passare. Rollback via feature flag `toolsJobSystem: false` |
| **Artifact content di grandi dimensioni in memoria** | Bassa | Medio | I content buffer sono tipicamente < 50KB. Per 4 step geometric, ~200KB totali. Irrilevante per un processo Node.js con 512MB heap |

---

## 9. Non-Goals (Fase 2)

1. **Long-lived actor** (Pillar E) — rimandato a Fase 3
2. **Group concurrency nativa BullMQ Pro** — il fallback Redis lock della Fase 1 è sufficiente per Fase 2
3. **Dashboard Bull Board** — non implementata
4. **Human-in-the-loop gate** — non implementato
5. **Modifica dei prompt** — invariati
6. **Serializzazione XState snapshot** — non implementata (retry da zero con idempotency confermato)
7. **Backfill Redis → Postgres** — non necessario (TTL 24h copre la transizione)

---

## 10. References

- [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (v1.13, `implemented`)
- [Fase 1 Implementation Plan](./feature-tool-workflow-job-system-fase-1.md) (v2.2, `implemented`)
- [BullMQ Prerequisites Plan](./plan-bullmq-prerequisites.md) (`implemented`)
- [Post-BullMQ Improvements Plan](./plan-post-bullmq-improvements.md) (`implemented`)
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-226/DDD-227/DDD-228
- `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` — processore da modificare (Pillar A, B.2)
- `apps/backend/src/lib/runtime/tool-workflow-job-queue.ts` — config BullMQ
- `apps/backend/src/lib/runtime/job-event-bridge.ts` — Redis pub/sub (prerequisito)
- `apps/backend/src/lib/runtime/job-progress-serializer.ts` — Redis progress
- `apps/backend/src/worker-entry.ts` — entry point worker standalone
- `packages/contracts/src/index.ts` — tipi condivisi

---

## 11. Post-Implementation: Bug Fixes (Smoke Test Findings)

Durante lo smoke test del sistema Phase 2 sono emersi 4 bug critici, tutti risolti:

### Bug #1 — Idempotency deadlock su BullMQ retry

**Sintomo**: Dopo un `base_query_missing` su geometric step 0, BullMQ riprovava 3 volte ma ogni retry incontrava `idempotency_conflict`.

**Root cause**: `markFailed` impostava lo stato a `'failed'`, ma `checkAndClaim` permetteva solo il replay per `'completed'`. Ogni retry trovava il record `'failed'` e restituiva conflitto.

**Fix**: In entrambi gli adapter (in-memory e Postgres/Redis), `checkAndClaim` ora cancella il record `'failed'` prima di permettere il re-claim. File: `generation.adapters.ts`, `postgres-redis.idempotency.repository.ts`.

### Bug #2 — Single-flight lock leak

**Sintomo**: Dopo un job fallito, il lock Redis `tool-job-active:{user}:{project}:{tool}` persisteva per 900s, bloccando ogni submit successivo con 409.

**Root cause**: Il lock veniva rilasciato solo su completamento positivo. I job cancellati o falliti non lo rilasciavano.

**Fix triplo**:
1. Processor cancel path: `redis.del(activeLockKey)` dopo `workflow_failed` publish
2. Worker `failed` event: liberazione lock su fallimento definitivo (retry esauriti)
3. Submit handler stale-lock guard: verifica se il job BullMQ esiste ancora prima di rifiutare con 409

### Bug #3 — `contentBuffer` vuoto per step crawling/scoring

**Sintomo**: `stepDependencyArtifactContentsByStep` iniettava solo 264 byte per lo step `serp-crawling` (con 13 fonti SerpApi), rendendo i placeholder `{{output_step_xxx}}` quasi vuoti.

**Root cause**: `contentBuffer` cattura solo il testo streammato, ma gli step crawling/scoring non fanno streaming — i dati reali (snippets, sources, PAA queries, ranking) vivono in `context.requestInput` dopo le azioni `mergeCrawlingIntoGenerationInput` / `cacheScoringResult`.

**Fix**: `runSingleStepGeneration` ora estrae dati strutturati da `doneSnapshot.context.requestInput.crawling` e `requestInput.scoring` quando `contentBuffer` è vuoto, producendo content formattato con snippets, sources, PAA queries e competitor ranking.

### Bug #4 — `brandName`/`baseQuery` non propagati all'assembly

**Sintomo**: `assembleStrategicReportingInput` loggava `brandName:"none"`, `baseQuery:"none"`.

**Root cause**: Le assembly functions leggono `requestInput.brandName` (top-level), ma questi campi esistevano solo in `requestInput.extractionPayload.brandName`.

**Fix**: In `runCrawlingStep`, `runScoringStep`, e `buildBackendGenerationRequest`, i campi `brandName`, `baseQuery`, `language`, `country` vengono promossi da `extractionPayload` al top-level di `requestInput`.

### Risultato finale

Verificato con DB query: gli artifact di crawling contengono 1140+ byte di dati SerpApi reali. I placeholder `{{output_step_serp-crawling}}` e `{{output_step_competitor-scoring}}` vengono sostituiti con content reale. L'assembly ora riporta `brandName:"Oroetic"` e `baseQuery:"Come aprire un franchising"`. Output LLM generato su dati forniti dal payload (non su dati di memoria).

### Bug #5 — SerpApi ri-eseguita per ogni step (B1 dal piano originale)

**Stato**: NON risolto. Ogni step di tipo `generation` (strategic-reporting, unified-report) crea un attore `generationSystemMachine` indipendente che esegue crawling+scoring da zero. I dati vengono iniettati nei prompt via `{{output_step_xxx}}`, ma le chiamate SerpApi sono duplicate (step 2 e 3 ri-crawlando con ~200-400ms ciascuno, dati cachati).

La soluzione architetturale richiede Pillar E (long-lived actor) o injection di crawling data pre-popolato nel machine context — rimandato a Fase 3.
