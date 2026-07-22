---
status: archived
version: 1.7
date_created: 2026-06-13
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
owner: Backend Runtime
title: Geometric SERP Screenshot Archival Implementation Plan
type: implementation-plan
tags: [feature, geometric, screenshot, archival, admin, monitoring, crawling, archived]
superseded-by: ../remove-geometric-screenshot-archival.md
---

> **Archived — feature removed in `remove-geometric-screenshot-archival.md`**

# Introduction

![Status: Draft](https://img.shields.io/badge/status-Draft-yellow)

Attualmente gli screenshot SERP prodotti da `crawlSerp()` vengono salvati in `/tmp/serp-{timestamp}-{random}.png` e persi al restart del processo (Railway è stateless per default). Non esiste associazione con `sessionId` o `requestId`, né un endpoint admin per consultarli.

Questo piano introduce un sistema di archival persistente che:

1. Associa ogni screenshot al `sessionId` e al `requestId` del crawl
2. Persiste i file su storage configurabile (filesystem mount per MVP, S3 in futuro)
3. Registra i metadati su Postgres (tabella `geometric_screenshot_metadata`)
4. Espone un endpoint admin-only per consultare screenshot per sessione
5. Aggiunge `aiOverviewConfidence` e `selectorUsed` al risultato del crawling per validazione

Il piano è un'estensione di Geometric — dal quale dipende — e non modifica il flusso di generazione LLM né alcun contratto FE/BE.

## 1. Requirements & Constraints

- **REQ-001**: Ogni screenshot SERP (query base + PAA) deve essere archiviato in storage persistente associato a `sessionId`, `requestId`, `query`, `isPaa`.
- **REQ-002**: I metadati di ogni screenshot (percorso, dimensione, timestamp, `aiOverviewConfidence`, `selectorUsed`) devono essere registrati in una tabella Postgres `geometric_screenshot_metadata`.
- **REQ-003**: L'archival è **async e non-bloccante**: un fallimento nell'archiviazione non deve interrompere né ritardare il flusso di crawling.
- **REQ-004**: Gli screenshot **non devono mai** essere inclusi nel context LLM (invariante REQ-011 del piano padre, DDD-120).
- **REQ-005**: Il campo `screenshotPath` di `CrawlingResult` viene rimosso dall'output pubblico di `CrawlingDoneOutput` — gli screenshot transitano solo via archival service, mai via XState context.
- **REQ-006**: `crawlSerp()` deve ritornare `aiOverviewConfidence` (0.0–1.0) e `selectorUsed` (il selettore CSS che ha estratto l'AI Overview) per ogni crawl.
- **REQ-007**: Un endpoint admin-only `GET /api/admin/geometric/sessions/:sessionId/screenshots` deve restituire la lista degli screenshot con metadati per una sessione.
- **REQ-008**: Un endpoint admin-only `GET /api/admin/geometric/screenshots/:screenshotId` deve servire il file immagine direttamente (content-type `image/png`), con autenticazione admin.
- **REQ-009**: La retention degli screenshot è configurabile via env var `SCREENSHOT_RETENTION_DAYS` (default: 30 giorni). Un job di cleanup rimuove file e record scaduti.
- **REQ-010**: Il path di storage è configurabile via `SCREENSHOT_STORAGE_PATH` (default: `/data/screenshots` per Railway persistent disk, `/tmp/screenshots` per dev locale).
- **SEC-001**: Gli endpoint screenshot sono admin-only: reuse del guard `requireAdminPrincipal` del pattern esistente (`admin-feedback-center-handlers.ts`).
- **SEC-002**: I percorsi di file serviti dall'endpoint devono essere validati per evitare path traversal (solo UUID come screenshotId).
- **DDD-001**: Nessun nuovo termine di dominio richiesto — `ScreenshotArchival` è un concetto infrastrutturale interno a `CrawlingContext`, non esposto in contracts.
- **CON-001**: Dipendenza da Railway Persistent Disk (o equivalente) in produzione — documentare in deployment guide.
- **CON-002**: Nessuna modifica ai contratti `packages/contracts/` — screenshot archival è backend-only.
- **CON-003**: Nessuna modifica al frontend — il campo `screenshotUrl` è admin-only e non compare mai in UI utente.
- **GUD-001**: Il servizio di archival segue il pattern adapter: interfaccia `ScreenshotStorageAdapter` con implementazioni `LocalScreenshotStorage` (MVP) e `S3ScreenshotStorage` (futura).
- **GUD-002**: La tabella Postgres usa UUID come PK. La migrazione segue il pattern di `packages/infra-db/migrations/`.
- **GUD-003**: L'handler admin segue esattamente il pattern `createAdminFeedbackCenterHandlers`: dipendenze iniettate, `requireAdminPrincipal`, `writeError`/`writeSuccess`.
- **GUD-004**: L'accesso all'archival dall'actor XState avviene tramite una nuova entry `screenshotArchival: ScreenshotArchivalAdapter | null` in `GenerationAdapters` (`generation.adapters.ts`). Questo segue il pattern degli adapter esistenti (`ownership`, `usage`, `idempotency`, ecc.) ed è l'unico meccanismo di injection verso `invokeCrawling`. Il `db` Pool e il `screenshotStorage` sono iniettati nel costruttore dell'implementazione concreta (`LocalScreenshotArchival`), non passati come parametri dell'actor.

## 2. Implementation Steps

### Implementation Phase 0 — CrawlingChainMachine Activation (Prerequisite)

- **GOAL-000**: Rendere il `crawlingChainMachine` operativo e wire it nel `generationSystemMachine` affinché il crawling venga effettivamente eseguito in produzione anziché restituire output vuoto.
- **Rationale**: Attualmente `crawlingChainMachine` (`apps/backend/src/lib/machines/generation/crawling-chain.machine.ts`) è uno stub (`initial: 'done'`, `output: { crawlArtifacts: [], paaQueries: [] }`). L'actor `invokeCrawling` in `generationSystem.actors.ts` è già implementato con il crawling reale, ma **non è referenziato da nessuno stato** di `generationSystemMachine`. Di conseguenza, in produzione il `toolWorkflowMachine` riceve solo `STEP_START`/`STEP_SUCCESS` dai test, mai dal runtime. Per attivare l'archival degli screenshot, il crawling deve prima essere invocato.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000A | Implementare `crawlingChainMachine` con stati reali: `initial: 'crawling'` → `invoke: 'invokeCrawling'` (src: `fromPromise` che chiama `crawlSerp` + `discoverPAAQueries` + `archiveScreenshot`). Lo stato transiziona a `scoring` al completamento. Lo stato `scoring` invoca `invokeScoring`. In uscita, `done` restituisce `output: { crawlArtifacts, paaQueries }` (o un oggetto strutturato compatibile con `STEP_SUCCESS`). Usare `context` per passare `requestId`, `sessionId`, `baseQuery`, `language`, `country` e `adapters` (per `screenshotArchival`). | ✅ | 2026-06-13 |
| TASK-000B | Aggiungere `crawlingFlow` in `generationSystem.execution.states.ts`: nuovo stato parallelo a `toolGenerationFlow` che invoca `invokeCrawling` (o `crawlingChainMachine` se embeddato). Il `crawlingFlow` deve essere raggiunto dal `routing` quando `workflowType === 'geometric'` e `runMode === 'new'`. Dopo `onDone`, il risultato (`CRAWLING_COMPLETED`) deve essere cachato in `requestInput` tramite `cacheCrawlingResult` (azione già esistente). Aggiungere guard `crawlingOutputIsAccepted` in `generationSystem.guards.ts`. | ✅ | 2026-06-13 |
| TASK-000C | Aggiornare `routing` in `generationSystem.request.states.ts` (o `generation-routing.ts`) per instradare verso `crawlingFlow` anziché direttamente `toolGenerationFlow` quando il tool è `geometric`. Assicurarsi che il `toolGenerationFlow` venga poi raggiunto dopo `crawlingFlow` (es. `always` transition o `onDone`). | ✅ | 2026-06-13 |
| TASK-000D | Verificare che `invokeCrawling` in `generationSystem.actors.ts` acceda a `context.adapters.screenshotArchival` (già fatto in TASK-004), ma assicurarsi che il `context` passato a `invokeCrawling` contenga `sessionId` e `requestId` correttamente popolati dal `REQUEST_RECEIVED` event. Aggiungere log di debug `[DEBUG][screenshot] invokeCrawling start` e `[DEBUG][screenshot] crawlSerp completed`. | ✅ | 2026-06-13 |
| TASK-000E | Test di integrazione: `generationSystemMachine` con `workflowType: 'geometric'` e `toolKey: 'geometric'` deve transizionare da `routing` → `crawlingFlow` → `scoringFlow` → `dispatchingMode` senza errori. Verificare che il prompt venga assemblato con i dati reali di crawling e scoring. | ✅ | 2026-06-13 |

### Implementation Phase 1 — Storage Adapter & CrawlingResult Extension

- GOAL-001: Creare il servizio di archival e aggiungere campi di confidence al crawler.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Aggiungere `aiOverviewConfidence: number`, `selectorUsed: string`, `screenshotPath: string \| null` a `CrawlingResult` in `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts`. Implementare `computeAiOverviewConfidence(selectorUsed): number` con valori: `[data-snf]` → 0.95, `.AIHVYe` → 0.90, `[data-attrid="wa:/description"]` → 0.85, fallback → 0.50. | ✅ | 2026-06-13 |
| TASK-001B | Definire `ScreenshotArchivalAdapter` in `apps/backend/src/lib/adapters/generation.adapters.ts`: interfaccia con metodi `archiveScreenshot(params: ScreenshotArchivalParams): Promise<string \| null>` e `cleanupExpiredScreenshots(now: Date): Promise<{ deletedFiles: number; deletedRecords: number }>`. Aggiungere `screenshotArchival: ScreenshotArchivalAdapter \| null` a `GenerationAdapters`. Aggiornare `createInMemoryGenerationAdapters()` in `apps/backend/src/lib/adapters/index.ts` con `screenshotArchival: null` (stub per test e workflow non-Geometric). **Questo task risolve il problema di injection dell'adapter in `invokeCrawling`: l'actor accede via `context.adapters.screenshotArchival`.** | ✅ | 2026-06-13 |
| TASK-002 | Creare `apps/backend/src/lib/runtime/integrations/screenshot-storage.ts` con: (a) interfaccia `ScreenshotStorageAdapter` (`save(sourcePath, destPath): Promise<void>`, `getAbsolutePath(storedPath): string`, `delete(storedPath): Promise<void>`); (b) implementazione `LocalScreenshotStorage` che copia da `/tmp/` a `{SCREENSHOT_STORAGE_PATH}/{sessionId}/{screenshotId}.png` via `fs.copyFile`. | ✅ | 2026-06-13 |
| TASK-003 | Creare `apps/backend/src/lib/runtime/integrations/screenshot-archival.ts` con classe `LocalScreenshotArchival` che implementa `ScreenshotArchivalAdapter`. Il costruttore accetta `(storage: ScreenshotStorageAdapter, db: Pool, retentionDays: number)` — il `db` Pool e lo storage sono iniettati alla costruzione, non passati a ogni chiamata. `archiveScreenshot(params)` copia il file, inserisce riga in `geometric_screenshot_metadata`, rimuove il temp file. Tutti gli errori sono non-bloccanti: catch + log `geometric.screenshot.archival.failed`. | ✅ | 2026-06-13 |
| TASK-004 | Aggiornare `invokeCrawling` in `apps/backend/src/lib/machines/generation-system.actors.ts`: dopo ogni `crawlSerp()` (base + PAA), chiamare `void context.adapters.screenshotArchival?.archiveScreenshot({ screenshotPath, sessionId: context.sessionId ?? context.requestId, requestId, query, isPaa, aiOverviewConfidence, selectorUsed })`. Usare `context.requestId` come fallback di `sessionId` quando `context.sessionId` è null/undefined. L'archival è `void` — non blocca il return di `CRAWLING_COMPLETED`. Loggare `geometric.screenshot.archival.ok`. | ✅ | 2026-06-13 |
| TASK-005 | Rimuovere `screenshotPath` da `CrawlingDoneOutput` in `generation-system.types.ts` (invariante REQ-005 — i path non devono transitare via XState context). Aggiungere invece `screenshotIds: string[]` opzionale (array di UUID archiviati, per correlazione admin). | ✅ | 2026-06-13 |

### Implementation Phase 2 — Database Migration

- GOAL-002: Registrare i metadati degli screenshot in Postgres con retention gestibile.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Creare migrazione `packages/infra-db/migrations/YYYYMMDD_000001_create_geometric_screenshot_metadata.sql`: tabella `geometric_screenshot_metadata` con colonne `id UUID PK`, `session_id TEXT NOT NULL`, `request_id TEXT NOT NULL`, `query TEXT NOT NULL`, `is_paa BOOLEAN NOT NULL DEFAULT false`, `stored_path TEXT NOT NULL`, `file_size_bytes INTEGER`, `ai_overview_confidence NUMERIC(3,2)`, `selector_used TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `expires_at TIMESTAMPTZ NOT NULL`. Indici su `session_id`, `expires_at`. | ✅ | 2026-06-13 |
| TASK-007 | Creare adapter functions in `apps/backend/src/lib/adapters/geometric-screenshot.repository.ts`: `insertScreenshotMetadata(db, params)`, `listScreenshotsBySession(db, sessionId)`, `getScreenshotById(db, screenshotId)`, `deleteExpiredScreenshots(db, now)`. Seguire il pattern Kysely delle query esistenti. | ✅ | 2026-06-13 |
| TASK-008 | Aggiungere `geometric-screenshot.repository.ts` all'indice `apps/backend/src/lib/adapters/index.ts`. | ✅ | 2026-06-13 |

### Implementation Phase 3 — Admin HTTP Handlers

- GOAL-003: Esporre endpoint admin-only per consultare screenshot per sessione e scaricare i file.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Creare `apps/backend/src/lib/runtime/auth-http/admin-geometric-handlers.ts` con factory `createAdminGeometricHandlers(deps)`. Dipendenze: `requireAdminPrincipal`, `requireDb`, `parseRequestUrl`, `writeError`, `writeSuccess`, `screenshotStorage`. Handler: `handleAdminListSessionScreenshots(request, response, sessionId)` → `GET /api/admin/geometric/sessions/:sessionId/screenshots`. Risposta: `{ ok: true, data: { screenshots: ScreenshotMetadata[] } }`. | ✅ | 2026-06-13 |
| TASK-010 | Aggiungere a `admin-geometric-handlers.ts` handler `handleAdminGetScreenshot(request, response, screenshotId)` → `GET /api/admin/geometric/screenshots/:screenshotId`. Validare `screenshotId` come UUID (regex), recuperare record, determinare path assoluto via `screenshotStorage.getAbsolutePath()`, servire file con `content-type: image/png`. Se file non trovato → 404. | ✅ | 2026-06-13 |
| TASK-011 | Registrare i nuovi handler nel router `apps/backend/src/lib/runtime/auth-http/runtime.ts`: pattern `/api/admin/geometric/sessions/:sessionId/screenshots` (GET) e `/api/admin/geometric/screenshots/:screenshotId` (GET). Seguire il pattern di mount degli handler admin esistenti. | ✅ | 2026-06-13 |
| TASK-012 | Aggiungere `screenshotStorage` e `screenshotRepository` alle dipendenze della factory `createAuthHttpRuntime` in `apps/backend/src/lib/runtime/auth-http/runtime.ts`. Init condizionale basata su env vars. | ✅ | 2026-06-13 |

### Implementation Phase 4 — Cleanup & Env Configuration

- GOAL-004: Gestire la retention degli screenshot e configurare lo storage tramite env vars.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Leggere `SCREENSHOT_STORAGE_PATH` e `SCREENSHOT_RETENTION_DAYS` in `apps/backend/src/server.ts` o in un modulo di config centralizzato. Inizializzare `LocalScreenshotStorage` e `LocalScreenshotArchival` con il path e il db configurati. Passare l'istanza `LocalScreenshotArchival` agli adapter tramite la factory di runtime. Log di avvio con path e retention configurati. | ✅ | 2026-06-13 |
| TASK-014 | Il metodo `cleanupExpiredScreenshots(now)` è già definito in `LocalScreenshotArchival` (TASK-003). Aggiungere solo il test di verifica in TASK-017 per questo metodo (nessun file nuovo da creare). | ✅ | 2026-06-13 |
| TASK-015 | Registrare il cleanup come operazione schedulata in `apps/backend/src/server.ts` con `setInterval` (frequenza: ogni 24h). Chiamare `screenshotArchival?.cleanupExpiredScreenshots(new Date())`. Loggare risultato cleanup con `deletedFiles` e `deletedRecords`. | ✅ | 2026-06-13 |
| TASK-016 | Aggiungere a `.env.example` (root del repository): `SCREENSHOT_STORAGE_PATH=/data/screenshots`, `SCREENSHOT_RETENTION_DAYS=30`. Aggiornare `docs/02-design/specifications/deployment-architecture-guide.md` con nota su Railway Persistent Disk richiesto per screenshot archival. **Nota**: il file da modificare è `.env.example` in radice del repo, non `apps/backend/.env.example` (che non esiste). | ✅ | 2026-06-13 |

### Implementation Phase 5 — Testing

- GOAL-005: Coprire le parti critiche con test unitari e di integrazione.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Test unitari `apps/backend/src/lib/tests/runtime.screenshot-archival.test.ts`: (a) `LocalScreenshotArchival.archiveScreenshot` copia il file nel path corretto e inserisce il record DB (mock `fs.copyFile` + mock repository); (b) `LocalScreenshotArchival.archiveScreenshot` non lancia errore se il file sorgente non esiste (non-bloccante, solo log); (c) `LocalScreenshotArchival.cleanupExpiredScreenshots` cancella file e record con `expires_at` passato; (d) `context.adapters.screenshotArchival = null` → `invokeCrawling` completa normalmente senza archiviare. | ✅ | 2026-06-13 |
| TASK-018 | Test unitari `apps/backend/src/lib/tests/runtime.geometric-admin-handlers.test.ts`: (a) `handleAdminListSessionScreenshots` ritorna 200 con lista screenshot per sessionId noto; (b) 404 se sessione non ha screenshot; (c) 403 se utente non admin; (d) `handleAdminGetScreenshot` ritorna 404 se screenshotId non trovato; (e) ritorna file PNG se trovato. | ✅ | 2026-06-13 |
| TASK-019 | Test `computeAiOverviewConfidence`: verificare mapping corretto da selettore a valore. Test estensione `CrawlingResult`: `aiOverviewConfidence` e `selectorUsed` presenti nell'output di `crawlSerp` (con mock Puppeteer). | ✅ | 2026-06-13 |

## 3. Alternatives

- **ALT-001**: Metadata in Redis con TTL invece di Postgres. Rifiutato perché Redis è usato per cache/code e non per dati strutturati queryabili. Postgres è già disponibile e permette query per `session_id`.
- **ALT-002**: S3 come storage primario invece di filesystem mount. Non rifiutato — è il target di Phase 2 futura. Escluso dall'MVP per non aggiungere dipendenze AWS prima di validare l'approccio.
- **ALT-003**: Restituire screenshot come base64 in risposta JSON invece di servirli come file. Rifiutato: screenshot SERP possono pesare 300KB–1MB; base64 in JSON non è adatto.
- **ALT-004**: Archiviare screenshot dentro l'artifact Postgres (colonna `content` come data URL). Rifiutato: viola REQ-011 (nessun dato screenshot in requestInput) e aumenta dimensione artifact.
- **ALT-005**: Non separare l'interfaccia `ScreenshotStorageAdapter` e usare solo filesystem. Rifiutato: il disaccoppiamento costa poco e consente di aggiungere S3 senza toccare il codice di archival.

## 4. Dependencies

- **DEP-001**: Geometric Tool completato (piano `feature-geometric-tool-1.md`, v1.7, status: Completed).
- **DEP-002**: Postgres database disponibile e migrazioni tramite `packages/infra-db/migrations/`.
- **DEP-003**: Railway Persistent Disk montato su path configurabile (o equivalente in dev locale).
- **DEP-004**: Auth admin guard esistente (`requireAdminPrincipal`) nel runtime HTTP.
- **DEP-005**: Pattern handler admin esistente (`createAdminFeedbackCenterHandlers`) come template.

## 5. Files

| File | Azione |
|------|--------|
| `packages/infra-db/migrations/YYYYMMDD_000001_create_geometric_screenshot_metadata.sql` | Nuovo — tabella metadata |
| `apps/backend/src/lib/adapters/generation.adapters.ts` | Modifica — aggiungere `ScreenshotArchivalAdapter` interface + `screenshotArchival` a `GenerationAdapters` |
| `apps/backend/src/lib/runtime/integrations/screenshot-storage.ts` | Nuovo — storage adapter |
| `apps/backend/src/lib/runtime/integrations/screenshot-archival.ts` | Nuovo — `LocalScreenshotArchival` class (implementa adapter, incapsula `db` + `storage`) |
| `apps/backend/src/lib/adapters/geometric-screenshot.repository.ts` | Nuovo — query Postgres |
| `apps/backend/src/lib/adapters/index.ts` | Modifica — export nuovo repository + `screenshotArchival: null` in in-memory adapters |
| `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` | Modifica — aggiungere `aiOverviewConfidence`, `selectorUsed` a `CrawlingResult` |
| `apps/backend/src/lib/machines/generation/crawling-chain.machine.ts` | Modifica — implementare stati reali per crawling + scoring |
| `apps/backend/src/lib/machines/generation-system.actors.ts` | Modifica — chiamata `context.adapters.screenshotArchival?.archiveScreenshot()` in `invokeCrawling` |
| `apps/backend/src/lib/machines/generation-system.execution.states.ts` | Modifica — aggiungere stato `crawlingFlow` |
| `apps/backend/src/lib/machines/generation-system.guards.ts` | Modifica — aggiungere guard `crawlingOutputIsAccepted` |
| `apps/backend/src/lib/machines/generation-system.types.ts` | Modifica — aggiungere `screenshotIds` opzionale a `CrawlingDoneOutput` |
| `apps/backend/src/lib/runtime/auth-http/admin-geometric-handlers.ts` | Nuovo — handler GET screenshots |
| `apps/backend/src/lib/runtime/auth-http/runtime.ts` | Modifica — mount nuovi route + init storage |
| `apps/backend/src/server.ts` | Modifica — init adapter, cleanup scheduler |
| `.env.example` | Modifica — nuove env vars (`SCREENSHOT_STORAGE_PATH`, `SCREENSHOT_RETENTION_DAYS`) — file in root del repo |
| `apps/backend/src/lib/tests/runtime.screenshot-archival.test.ts` | Nuovo — test archival |
| `apps/backend/src/lib/tests/runtime.geometric-admin-handlers.test.ts` | Nuovo — test handler admin |
| `docs/02-design/specifications/deployment-architecture-guide.md` | Modifica — nota Railway Persistent Disk |

## 6. Testing

- **TEST-001**: `computeAiOverviewConfidence` ritorna il valore corretto per ogni selettore.
- **TEST-002**: `archiveScreenshot` copia il file nel path corretto con nome `{screenshotId}.png`.
- **TEST-003**: `archiveScreenshot` inserisce correttamente il record in `geometric_screenshot_metadata`.
- **TEST-004**: `archiveScreenshot` non lancia errore se il file sorgente non esiste (silently fails + log).
- **TEST-005**: `cleanupExpiredScreenshots` cancella solo i file con `expires_at < now`.
- **TEST-006**: `GET /api/admin/geometric/sessions/:sessionId/screenshots` ritorna 200 + lista.
- **TEST-007**: `GET /api/admin/geometric/screenshots/:screenshotId` ritorna 404 se non trovato.
- **TEST-008**: `GET /api/admin/geometric/screenshots/:screenshotId` ritorna 403 se non admin.
- **TEST-009**: Path traversal attempt (screenshotId con `../`) ritorna 400.
- **TEST-010**: `CrawlingResult` contiene `aiOverviewConfidence` e `selectorUsed` nell'output del mock crawl.

## 7. Risks & Assumptions

- **RISK-001**: Railway Persistent Disk non disponibile → screenshot persi. Mitigazione: fallback graceful (archival non-bloccante), log warning al boot se path non configurato.
- **RISK-002**: Disk pieno → archival fallisce. Mitigazione: cleanup retention automatico + monitorare utilizzo disco.
- **RISK-003**: Screenshot molto pesanti (fullPage) → storage saturo in breve. Mitigazione: `fullPage: false` già impostato — screenshot viewport-only (1280×800, ~100-400 KB).
- **RISK-004**: `crawlSerp` già fa screenshot a `/tmp/` in caso di errore parziale → file orfani. Mitigazione: cleanup `/tmp/serp-*.png` sempre eseguito in `archiveScreenshot`, anche in caso di fallimento DB.
- **ASSUMPTION-001**: Railway Persistent Disk è disponibile o viene configurato prima del deploy di questa feature.
- **ASSUMPTION-002**: La dimensione media degli screenshot è 200 KB. Con 100 sessioni/giorno × 5 crawl/sessione × 30 giorni retention = ~3 GB max. Gestibile con disco da 10 GB.
- **ASSUMPTION-003**: L'archival è async — il timing tra crawl completato e screenshot visibile all'admin può essere di pochi ms, non è un requisito real-time.

## 8. Related Specifications / Further Reading

- [Geometric Tool Plan](./feature-geometric-tool-1.md) — piano padre, v1.7
- [Geometric Admin Debug & Monitoring Proposal](../../../02-design/geometric-admin-debug-monitoring-proposal.md) — proposal che ha generato questo piano
- [Geometric Crawling Step Reference](../../../99-reference/geometric-crawling-step-reference.md) — dettaglio operazioni BE
- [Deployment Architecture Guide](../../../02-design/specifications/deployment-architecture-guide.md) — Railway Persistent Disk
