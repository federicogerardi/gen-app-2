---
status: archived
version: 1.3
last-reviewed: 2026-07-08
next-review-date: 2027-01-08
owner: Backend Runtime
date_created: 2026-06-28
title: Remove Geometric Screenshot Archival Implementation Plan
type: removal-plan
tags: [removal, geometric, screenshot, archival, cleanup, serpapi, ddd-governance, archived]
goal: Rimuovere completamente la funzionalità di screenshot archival dal tool Geometric, inclusi i campi derivati `aiOverviewConfidence` e `selectorUsed`, ormai privi di significato con il percorso SerpApi-only
---

# Introduction

Il tool Geometric utilizza esclusivamente SerpApi per dati strutturati. Il percorso Puppeteer con screenshot SERP non è più attivo. La funzionalità di screenshot archival (piano `feature-geometric-screenshot-archival-1.md`) è diventata dead code.

Anche `aiOverviewConfidence` e `selectorUsed` — introdotti insieme agli screenshot — vanno rimossi: i selettori CSS (`[data-snf]`, `.AIHVYe`) sono concetti del vecchio scraping Puppeteer. Con SerpApi, il normalizer hardcodifica `selectorUsed: 'serpapi-ai-overview'` e `aiOverviewConfidence: 0.95` — nessun consumatore downstream legge questi campi per logica operativa.

## Decisione: rimozione completa

- **`aiOverviewConfidence`** → **RIMUOVERE**. Campo introdotto per metadata screenshot. Con SerpApi è sempre 0.95 o 0.0 (hardcoded nel normalizer). Nessun consumer logico.
- **`selectorUsed`** → **RIMUOVERE**. Concetto CSS-selector del Puppeteer path. SerpApi non produce selettori.
- **`screenshotPath`** → **RIMUOVERE** da `CrawlingResult`. SerpApi non produce immagini. Il campo è sempre `null`.
- **`screenshotArchival`** → **RIMUOVERE** completamente (adapter, implementazione, repository, handler admin, pagina FE, migration).

---

## Phase 0 — DDD Governance & Gate Alignment

**Prerequisito obbligatorio**: Completare la governance DDD prima di procedere con l'implementazione. La rimozione di concetti del dominio richiede allineamento canonico e chiusura esplicita dei gate di governance.

### STEP-000: DDD Decision Log - Concept Lifecycle Policy

**Descrizione**: Stabilire la policy generale per il retirement di concetti del dominio quando diventano obsoleti per cambiamenti architetturali.

**File**: `docs/07-governance/domain-naming-decision-log.md`

**Decisione richiesta**: 
- **ID**: `DDD-[NEXT-AVAILABLE-ID]`
- **Canonical Term**: `Domain Concept Retirement Policy`
- **Decision**: Policy per gestire la rimozione di concetti del dominio obsoleti
- **Rationale**: Cambiamenti architetturali (es. Puppeteer → SerpApi) rendono alcuni concetti obsoleti; serve processo esplicito per deprecation → retirement
- **Scope**: `all contexts`

**QA Scenario**: Verifica creazione entry DDD
- **Tool**: `grep -A10 "Domain Concept Retirement Policy" docs/07-governance/domain-naming-decision-log.md`
- **Steps**: Cerca la nuova entry nel decision log
- **Expected result**: Entry presente con ID, rationale, e scope definiti

### STEP-001: DDD Glossary - Retroactive Canonicalization of Deprecated Concepts

**Descrizione**: Aggiungere entry retroattive nel Glossary per i 4 concetti non canonicalizzati che verranno rimossi.

**File**: `docs/01-requirements/domain-ubiquitous-language-glossary.md`

**Aggiunte richieste alla sezione "Crawling & Extraction Context"**:

```
| screenshotArchival | Adapter/System | **DEPRECATED** — Former adapter system for persisting SERP screenshot metadata and files during Puppeteer-based crawling. Included storage path management, expiration handling, and admin query interfaces. Obsoleted by SerpApi-only architectural shift (no screenshot production). Removal planned in `remove-geometric-screenshot-archival.md`. | `apps/backend/src/lib/adapters/generation.adapters.ts` (historical) | deprecated |
| aiOverviewConfidence | Value Object | **DEPRECATED** — Numeric confidence score (0.0-1.0) for AI Overview extraction accuracy in Puppeteer-based crawling. Computed via CSS selector reliability mapping (`[data-snf]`: 0.95, `.AIHVYe`: 0.90, etc.). Hardcoded to 0.95 in SerpApi normalizer without semantic meaning. No downstream consumers use for operational logic. Removal planned in `remove-geometric-screenshot-archival.md`. | `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` (historical) | deprecated |
| selectorUsed | Value Object | **DEPRECATED** — CSS selector string indicating which DOM element was used to extract AI Overview content during Puppeteer-based crawling. Values included `[data-snf]`, `.AIHVYe`, `serpapi-ai-overview` (hardcoded). Obsoleted by SerpApi structured data which provides direct AI Overview text without DOM parsing. Removal planned in `remove-geometric-screenshot-archival.md`. | `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` (historical) | deprecated |
| screenshotPath | Value Object | **DEPRECATED** — File system path to stored PNG screenshot of SERP during Puppeteer-based crawling. Always `null` in SerpApi implementation since API returns structured data without visual capture. Used for admin verification and archival storage. Removal planned in `remove-geometric-screenshot-archival.md`. | `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` (historical) | deprecated |
```

**QA Scenario**: Verifica entry deprecate aggiunte
- **Tool**: `grep -A5 "screenshotArchival\|aiOverviewConfidence\|selectorUsed\|screenshotPath" docs/01-requirements/domain-ubiquitous-language-glossary.md`
- **Steps**: Cerca le 4 entry deprecate nella sezione Crawling & Extraction Context
- **Expected result**: Tutte e 4 le entry presenti con status `deprecated` e rationale appropriato

### STEP-002: DDD Bounded Context Map - Architecture Impact Analysis

**Descrizione**: Aggiornare il Bounded Context Map per riflettere il cambiamento da Puppeteer+screenshots a SerpApi-only.

**File**: `docs/02-design/domain-bounded-context-map.md`

**Modifiche richieste**:

1. **Sezione "Crawling & Extraction Context" (riga ~118-142)**: Rimuovere `SerpScreenshot` dalla lista "Key Value Objects" e aggiornare la descrizione della responsabilità per rimuovere "screenshot capture".

2. **Sezione "Shared Concepts And Translation Rules" (riga ~172-200)**: Aggiungere nuova entry per documentare l'impatto della rimozione:

```
| Screenshot Archival (deprecated) | Crawling & Extraction | Generation, Frontend/UI | **DEPRECATED TRANSLATION RULE** — Former screenshot archival system provided PNG storage paths and confidence metadata to Generation context via `CrawlingResult.screenshotPath`, `aiOverviewConfidence`, `selectorUsed`. Frontend/UI consumed screenshot URLs through admin handlers for verification. Translation removed with SerpApi-only architecture: SerpApi provides structured data without visual artifacts. All screenshot-related adapters, handlers, and UI surfaces are retired. |
```

**QA Scenario**: Verifica aggiornamenti Context Map
- **Tool**: `grep -A5 -B5 "SerpScreenshot\|Screenshot Archival" docs/02-design/domain-bounded-context-map.md`
- **Steps**: Cerca le modifiche nel Context Map per SerpScreenshot e nuova translation rule
- **Expected result**: `SerpScreenshot` rimossa da Key Value Objects; nuova deprecated translation rule presente

### STEP-003: DDD Decision Log - SerpScreenshot Lifecycle Resolution

**Descrizione**: Risolvere esplicitamente lo status di `SerpScreenshot` che è attualmente canonical ma incompatibile con SerpApi.

**File**: `docs/07-governance/domain-naming-decision-log.md`

**Decisione richiesta**:
- **ID**: `DDD-[NEXT-AVAILABLE-ID+1]`
- **Canonical Term**: `SerpScreenshot`
- **Decision**: `SerpScreenshot` marcato come `deprecated` — valore obsoleto per architettura SerpApi-only
- **Rationale**: SerpApi non produce screenshot PNG; `SerpScreenshot` era concetto valid per Puppeteer crawling ma incompatibile con structured API data
- **Scope**: `Crawling & Extraction Context`

**QA Scenario**: Verifica decisione SerpScreenshot
- **Tool**: `grep -A10 "SerpScreenshot.*deprecated" docs/07-governance/domain-naming-decision-log.md`
- **Steps**: Cerca la decisione di deprecation per SerpScreenshot
- **Expected result**: Entry presente con rationale SerpApi-incompatibility

### STEP-004: DDD Decision Log - Integration Constraints Impact Assessment

**Descrizione**: Documentare l'impatto sui Integration Constraints della rimozione del sistema screenshot archival.

**File**: `docs/07-governance/domain-naming-decision-log.md`

**Decisione richiesta**:
- **ID**: `DDD-[NEXT-AVAILABLE-ID+2]`
- **Canonical Term**: `Screenshot Archival Removal Impact`
- **Decision**: Removal of `ScreenshotArchivalAdapter` eliminates Crawling & Extraction → Generation → Frontend/UI data flow for screenshot verification
- **Rationale**: SerpApi architecture eliminates screenshot production; admin verification capabilities no longer needed; adapter removal simplifies context integration
- **Scope**: `Cross-context integration constraints`

**QA Scenario**: Verifica impatto integration constraints
- **Tool**: `grep -A10 "Screenshot Archival Removal Impact" docs/07-governance/domain-naming-decision-log.md`
- **Steps**: Cerca la decisione sull'impatto integration constraints
- **Expected result**: Entry presente con analisi cross-context impact

### STEP-005: DDD Gate Validation

**Descrizione**: Validazione finale che tutti i gate di governance DDD siano chiusi prima di procedere con l'implementazione.

**QA Scenario**: Verifica completezza governance DDD
- **Tool**: Manuale review dei 4 step precedenti
- **Steps**: Conferma che tutte le entry richieste sono state create nei documenti canonici
- **Expected result**: 
  - ✅ Decision Log contiene 3 nuove entry (Concept Retirement Policy, SerpScreenshot deprecation, Integration Impact)
  - ✅ Glossary contiene 4 entry deprecate (screenshotArchival, aiOverviewConfidence, selectorUsed, screenshotPath)
  - ✅ Bounded Context Map aggiornato con deprecated translation rule
  - ✅ Nessun concetto del piano utilizza terminologia non-canonical

---

## Phase 1 — Backend: Adapter & Types Cleanup

### STEP-001: `generation.adapters.ts` — rimuovere ScreenshotArchivalAdapter

**Prerequisito**: ✅ Phase 0 completata (DDD governance gates chiusi)

**File**: `apps/backend/src/lib/adapters/generation.adapters.ts`

Rimuovere:
- Tipo `ScreenshotArchivalParams` (righe 119-127)
- Interfaccia `ScreenshotArchivalAdapter` (righe 129-132)
- Campo `screenshotArchival: ScreenshotArchivalAdapter | null` da `GenerationAdapters` (riga 151)
- `screenshotArchival: null` da `createInMemoryGenerationAdapters()` (riga 358)

**QA Scenario**: Verifica TypeScript compilation
- **Tool**: `npm --workspace apps/backend run typecheck`
- **Steps**: Esegui typecheck dopo le modifiche
- **Expected result**: Nessun errore di compilazione TS. I riferimenti a `ScreenshotArchivalAdapter` non dovrebbero più esistere nel file.

### STEP-002: `adapters/index.ts` — rimuovere export screenshot

**File**: `apps/backend/src/lib/adapters/index.ts`

Rimuovere:
- Export `ScreenshotArchivalAdapter`, `ScreenshotArchivalParams` da `generation.adapters` (righe 17-18)
- Export `insertScreenshotMetadata`, `listAllScreenshots`, `listScreenshotsBySession`, `getScreenshotById`, `deleteExpiredScreenshots`, `ScreenshotMetadata`, `InsertScreenshotMetadataInput` da `geometric-screenshot.repository` (righe 56-64)

**QA Scenario**: Verifica rimozione export
- **Tool**: `grep -n "ScreenshotArchival\|insertScreenshotMetadata\|listAllScreenshots\|ScreenshotMetadata" apps/backend/src/lib/adapters/index.ts`
- **Steps**: Cerca i termini rimossi nel file index
- **Expected result**: Nessun match trovato per i termini screenshot-related

### STEP-003: `postgres-redis.adapters.ts` — rimuovere screenshotArchival stub

**File**: `apps/backend/src/lib/adapters/postgres-redis.adapters.ts`

Rimuovere:
- `screenshotArchival: null,` (riga 71)
- Log `[DEBUG][postgres-redis-adapters]...screenshotArchival` (riga 76)

**QA Scenario**: Verifica rimozione configurazione
- **Tool**: `grep -n "screenshotArchival" apps/backend/src/lib/adapters/postgres-redis.adapters.ts`
- **Steps**: Cerca riferimenti screenshotArchival nel file
- **Expected result**: Nessun match trovato per "screenshotArchival"

### STEP-004: `crawling.adapter.ts` — rimuovere campi screenshot e confidence

**File**: `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts`

Rimuovere da `CrawlingResult`:
- `aiOverviewConfidence: number` (riga 23)
- `selectorUsed: string` (riga 24)
- `screenshotPath: string | null` (riga 33)

Rimuovere:
- Funzione `computeAiOverviewConfidence()` (righe 38-47)

Aggiornare le 3 return statements in `crawlSerpViaApi` (righe 108-153) per rimuovere i campi `aiOverviewConfidence`, `selectorUsed`, `screenshotPath`.

**QA Scenario**: Verifica struttura CrawlingResult aggiornata
- **Tool**: `grep -A5 -B5 "type CrawlingResult" apps/backend/src/lib/runtime/integrations/crawling.adapter.ts`
- **Steps**: Ispeziona la definizione del tipo CrawlingResult
- **Expected result**: Il tipo non deve contenere `aiOverviewConfidence`, `selectorUsed`, o `screenshotPath`. Deve contenere solo: `aiOverviewSnippet`, `sources`, `adsCount`, `videoCount`

### STEP-005: `serpapi-normalizer.ts` — rimuovere campi confidence dai normalizer

**File**: `apps/backend/src/lib/runtime/integrations/serpapi-normalizer.ts`

Aggiornare `normalizeSerpApiAiOverview` (righe 139-174): rimuovere `aiOverviewConfidence` e `selectorUsed` dalle return statements (righe 147-148, 168-169). Il tipo di return cambia da `Omit<CrawlingResult, 'screenshotPath'>` a un tipo che non include più i campi rimossi.

**QA Scenario**: Verifica normalizer aggiornato
- **Tool**: `grep -n "aiOverviewConfidence\|selectorUsed" apps/backend/src/lib/runtime/integrations/serpapi-normalizer.ts`
- **Steps**: Cerca i campi rimossi nel normalizer
- **Expected result**: Nessun match per `aiOverviewConfidence` o `selectorUsed` nel file

### STEP-006: `generation-system.types.ts` — rimuovere screenshotIds

**File**: `apps/backend/src/lib/machines/generation-system.types.ts`

Rimuovere `screenshotIds?: string[]` dal tipo `CRAWLING_COMPLETED` (riga 87).

**QA Scenario**: Verifica tipo eventi aggiornato
- **Tool**: `grep -A10 -B5 "CRAWLING_COMPLETED" apps/backend/src/lib/machines/generation-system.types.ts`
- **Steps**: Ispeziona la definizione del tipo CRAWLING_COMPLETED
- **Expected result**: Il tipo non deve contenere il campo `screenshotIds`

### STEP-007: `generation-system.actors.ts` — rimuovere chiamate screenshot archival

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

Rimuovere:
- Log `[DEBUG][screenshot] crawlSerp completed` con `aiOverviewConfidence`/`selectorUsed` (riga 285)
- Blocco `if (baseResult.screenshotPath)` + `archiveScreenshot` per base query (righe 287-300)
- Log `[DEBUG][screenshot] crawlSerp PAA completed` (riga 325)
- Blocco `if (result.screenshotPath)` + `archiveScreenshot` per PAA (righe 326-339)

Rimuovere riferimenti a `aiOverviewConfidence` e `selectorUsed` dalle strutture dati (se presenti nelle righe 295-296, 334-335).

**QA Scenario**: Verifica rimozione logica screenshot
- **Tool**: `grep -n "screenshot\|archiveScreenshot\|aiOverviewConfidence\|selectorUsed" apps/backend/src/lib/machines/generation-system.actors.ts`
- **Steps**: Cerca tutti i riferimenti screenshot nel file actors
- **Expected result**: Nessun match per screenshot-related terms (esclusi eventuali commenti storici)

---

## Phase 2 — Backend: Crawling Chain Machine

### STEP-008: `crawling-chain.machine.ts` — rimuovere screenshotArchival da input e chiamate

**File**: `apps/backend/src/lib/machines/generation/crawling-chain.machine.ts`

Rimuovere da `CrawlingChainInput`:
- Tipo `screenshotArchival` (righe 14-24)

Rimuovere:
- Blocco `if (baseResult.screenshotPath && chainInput.screenshotArchival)` + `archiveScreenshot` per base (righe 76-86)
- Blocco `if (result.screenshotPath && chainInput.screenshotArchival)` + `archiveScreenshot` per PAA (righe 111-121)

Rimuovere riferimenti a `aiOverviewConfidence` e `selectorUsed` (righe 83-84, 118-119).

**QA Scenario**: Verifica input chain machine aggiornato
- **Tool**: `grep -A20 "type CrawlingChainInput" apps/backend/src/lib/machines/generation/crawling-chain.machine.ts`
- **Steps**: Ispeziona la definizione CrawlingChainInput
- **Expected result**: Il tipo non deve contenere il campo `screenshotArchival`

### STEP-009: `context-generation-assembly.ts` — pulire commenti screenshot

**File**: `apps/backend/src/lib/machines/generation/context-generation-assembly.ts`

Aggiornare commenti JSDoc e inline che menzionano screenshot (righe 69, 86, 108, 131). I commenti "NEVER includes screenshot data" e "No screenshot data (DDD-120, REQ-011)" possono essere rimossi o sostituiti con "SerpApi-only structured data".

**QA Scenario**: Verifica commenti aggiornati
- **Tool**: `grep -n -i "screenshot" apps/backend/src/lib/machines/generation/context-generation-assembly.ts`
- **Steps**: Cerca riferimenti screenshot nei commenti
- **Expected result**: Nessun match per "screenshot" o commenti aggiornati per riflettere "SerpApi-only"

---

## Phase 3 — Backend: Server & Runtime Cleanup

### STEP-010: `server.ts` — rimuovere inizializzazione screenshot

**File**: `apps/backend/src/server.ts`

Rimuovere:
- Import `LocalScreenshotStorage` (riga 16)
- Import `LocalScreenshotArchival` (riga 17)
- Blocco configurazione screenshot (righe 91-104): env vars, istanziazione storage/archival, log
- Spread `generationAdaptersWithScreenshot` — usare direttamente `generationAdapters` (righe 106-110)
- `screenshotStorage` nelle opzioni di `createAuthHttpRuntime` (riga 155)
- `generationAdaptersWithScreenshot` → rinominare in `generationAdapters` nelle chiamate successive (riga 159)
- Log `Screenshot storage path:` (riga 215)
- Blocco `setInterval` cleanup (righe 217-230)

**QA Scenario**: Verifica server cleanup completo
- **Tool**: `grep -n "Screenshot\|screenshotStorage\|LocalScreenshot" apps/backend/src/server.ts`
- **Steps**: Cerca tutti i riferimenti screenshot nel server
- **Expected result**: Nessun match per screenshot-related terms

### STEP-011: `runtime.ts` — rimuovere screenshotStorage da options

**File**: `apps/backend/src/lib/runtime/auth-http/runtime.ts`

Rimuovere:
- Import `ScreenshotStorageAdapter` (riga 54)
- Campo `screenshotStorage` da `AuthHttpRuntimeOptions` (riga 75)
- `const screenshotStorage = options.screenshotStorage ?? null;` (riga 105)
- `screenshotStorage,` dalle deps di `createAdminHandlers` (riga 239)

**QA Scenario**: Verifica runtime options cleanup
- **Tool**: `grep -n "screenshotStorage\|ScreenshotStorage" apps/backend/src/lib/runtime/auth-http/runtime.ts`
- **Steps**: Cerca riferimenti screenshotStorage nel runtime
- **Expected result**: Nessun match per screenshot storage terms

### STEP-012: `admin-handlers.ts` — rimuovere geometric handlers

**File**: `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`

Rimuovere:
- Import `createAdminGeometricHandlers`, `AdminGeometricHandlers` da `admin-geometric-handlers` (righe 33-35)
- Import `ScreenshotStorageAdapter` (riga 36)
- Campo `screenshotStorage` da `CreateAdminHandlersDependencies` (riga 43)
- `& AdminGeometricHandlers` dal tipo `AdminHandlers` (riga 65)
- Destructuring `screenshotStorage` (riga 73)
- Creazione `geometricHandlers` (righe 142-148)
- Spread `...geometricHandlers` nel return (riga 156)

**QA Scenario**: Verifica admin handlers cleanup
- **Tool**: `grep -n "GeometricHandlers\|screenshotStorage" apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`
- **Steps**: Cerca riferimenti geometric handlers e screenshot storage
- **Expected result**: Nessun match per geometric handlers o screenshot storage

### STEP-013: `auth-http-admin-routes.ts` — rimuovere route screenshot

**File**: `apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts`

Rimuovere le 3 route (righe 169-195):
- `GET /api/admin/geometric/screenshots`
- `GET /api/admin/geometric/sessions/:sessionId/screenshots`
- `GET /api/admin/geometric/screenshots/:screenshotId`

**QA Scenario**: Verifica rimozione route admin
- **Tool**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/geometric/screenshots`
- **Steps**: Testa che le route screenshot restituiscano 404 dopo il backend restart
- **Expected result**: HTTP status 404 per tutte e 3 le route geometric/screenshots

---

## Phase 4 — Backend: Delete Dead Files

### STEP-014: Eliminare file screenshot creati dalla feature

Eliminare:
- `apps/backend/src/lib/runtime/integrations/screenshot-storage.ts`
- `apps/backend/src/lib/runtime/integrations/screenshot-archival.ts`
- `apps/backend/src/lib/adapters/geometric-screenshot.repository.ts`
- `apps/backend/src/lib/runtime/auth-http/admin-geometric-handlers.ts`
- `apps/backend/src/lib/tests/runtime.screenshot-archival.test.ts`
- `apps/backend/src/lib/tests/runtime.geometric-admin-handlers.test.ts`
- `apps/backend/src/lib/tests/runtime.geometric-crawling-confidence.test.ts`

**QA Scenario**: Verifica file eliminati
- **Tool**: `ls -la apps/backend/src/lib/runtime/integrations/screenshot-storage.ts`
- **Steps**: Verifica che i file siano stati effettivamente eliminati
- **Expected result**: `ls: screenshot-storage.ts: No such file or directory` per tutti i 7 file listati

---

## Phase 5 — Backend: Database Migration (Drop Table)

### STEP-015: Creare migration di drop

**File nuovo**: `packages/infra-db/migrations/YYYYMMDD_000017_drop_geometric_screenshot_metadata.sql`

```sql
-- Drop geometric_screenshot_metadata table (screenshot archival removed — SerpApi-only)
DROP TABLE IF EXISTS geometric_screenshot_metadata;
```

**QA Scenario**: Verifica drop tabella
- **Tool**: `psql -h localhost -U postgres -d gen_app_dev -c "\dt geometric_screenshot_metadata"`
- **Steps**: Controlla che la tabella non esista più dopo la migration
- **Expected result**: `Did not find any relation named "geometric_screenshot_metadata"` o equivalente

---

## Phase 6 — Frontend Cleanup

### STEP-016: Eliminare pagina admin screenshot

Eliminare:
- `apps/frontend/src/features/admin/pages/AdminGeometricScreenshotsPage.tsx`
- `apps/frontend/src/features/admin/runtime/useAdminGeometricScreenshotsQuery.ts`

**QA Scenario**: Verifica file frontend eliminati
- **Tool**: `ls -la apps/frontend/src/features/admin/pages/AdminGeometricScreenshotsPage.tsx`
- **Steps**: Controlla che i file frontend siano stati eliminati
- **Expected result**: `No such file or directory` per entrambi i file

### STEP-017: `app-router.tsx` — rimuovere route

**File**: `apps/frontend/src/app/routing/app-router.tsx`

Rimuovere:
- Lazy import `AdminGeometricScreenshotsPage` (riga 38)
- Route `geometric-screenshots` (righe 195-198)

**QA Scenario**: Verifica route non esistente
- **Tool**: Navigate browser to `http://localhost:3000/admin/geometric-screenshots`
- **Steps**: Accedi alla route screenshots dopo il deploy frontend
- **Expected result**: 404 page o redirect, non la pagina AdminGeometricScreenshotsPage

### STEP-018: `backend-capabilities.ts` — rimuovere flag

**File**: `apps/frontend/src/app/runtime/backend-capabilities.ts`

Rimuovere:
- `adminGeometricScreenshots: boolean` dal tipo (riga 18)
- `adminGeometricScreenshots: readFlag(...)` da `readBackendCapabilities` (riga 51)
- `adminGeometricScreenshots: false` da `defaultBackendCapabilities` (riga 73)

**QA Scenario**: Verifica capability flag rimossa
- **Tool**: `grep -n "adminGeometricScreenshots" apps/frontend/src/app/runtime/backend-capabilities.ts`
- **Steps**: Cerca la capability flag nel file
- **Expected result**: Nessun match per "adminGeometricScreenshots"

### STEP-019: `backend-capabilities.test.ts` — rimuovere riferimento

**File**: `apps/frontend/src/app/runtime/backend-capabilities.test.ts`

Rimuovere `adminGeometricScreenshots: true` (riga 49).

**QA Scenario**: Verifica test aggiornato
- **Tool**: `npm --workspace apps/frontend run test -- backend-capabilities.test.ts`
- **Steps**: Esegui i test per backend-capabilities dopo le modifiche
- **Expected result**: Tutti i test passano, nessun riferimento a adminGeometricScreenshots

### STEP-020: `api-paths.ts` — rimuovere path functions

**File**: `apps/frontend/src/app/runtime/api-paths.ts`

Rimuovere:
- `geometricScreenshots` function (righe 110-116)
- `geometricScreenshotById` function (righe 117-121)

**QA Scenario**: Verifica path functions rimosse
- **Tool**: `grep -n "geometricScreenshot" apps/frontend/src/app/runtime/api-paths.ts`
- **Steps**: Cerca le function screenshot nei path API
- **Expected result**: Nessun match per "geometricScreenshot"

### STEP-021: `admin-client.ts` — rimuovere tipo e funzione

**File**: `apps/frontend/src/features/admin/runtime/admin-client.ts`

Rimuovere:
- Tipo `GeometricScreenshotMetadata` (righe 693-705)
- Tipo `GeometricScreenshotsListResponse` (righe 707-713)
- Funzione `readGeometricScreenshot` (righe 715-746)
- Funzione `listAdminGeometricScreenshots` (righe 748-787)

**QA Scenario**: Verifica client screenshot cleanup
- **Tool**: `grep -n "GeometricScreenshot\|readGeometricScreenshot\|listAdminGeometric" apps/frontend/src/features/admin/runtime/admin-client.ts`
- **Steps**: Cerca i tipi e funzioni screenshot nel client admin
- **Expected result**: Nessun match per screenshot-related types e functions

### STEP-022: `copy/system.ts` — rimuovere namespace

**File**: `apps/frontend/src/app/copy/system.ts`

Rimuovere:
- Chiave `loadAdminGeometricScreenshots` da `fallbackErrors` (riga 413)
- Namespace `adminGeometricScreenshots` intero (righe 677-700)

**QA Scenario**: Verifica copy text cleanup
- **Tool**: `grep -n "adminGeometricScreenshots\|loadAdminGeometric" apps/frontend/src/app/copy/system.ts`
- **Steps**: Cerca i copy text screenshot nel file system
- **Expected result**: Nessun match per screenshot-related copy text

---

## Phase 7 — Env & Docs Cleanup

### STEP-023: `.env.example` — rimuovere variabili

**File**: `.env.example`

Rimuovere le righe commentate (righe 79-80):
```
# SCREENSHOT_STORAGE_PATH=/data/screenshots
# SCREENSHOT_RETENTION_DAYS=30
```

**QA Scenario**: Verifica env example cleanup
- **Tool**: `grep -n "SCREENSHOT" .env.example`
- **Steps**: Cerca variabili screenshot nel file env example
- **Expected result**: Nessun match per "SCREENSHOT"

### STEP-024: Archiviare piano originale

**File**: `../../../99-lifecycle/99-archive/plans/feature-geometric-screenshot-archival-1.md`

Aggiornare frontmatter: `status: archived`, `version: 1.5`, `last-reviewed: 2026-06-28`. Aggiungere nota in testa: "Archived — feature removed in `remove-geometric-screenshot-archival.md`".

**QA Scenario**: Verifica archiviazione piano
- **Tool**: `grep -A5 "^status:" ../../../99-lifecycle/99-archive/plans/feature-geometric-screenshot-archival-1.md`
- **Steps**: Controlla il frontmatter del piano originale
- **Expected result**: `status: archived` e presence nota "Archived — feature removed"

### STEP-025: Aggiornare documentazione

Documenti da aggiornare (rimuovere riferimenti screenshot):
- `docs/index-overview.md` — rimuovere piano screenshot dagli Active Plans (già aggiornata deployment guide)
- `docs/02-design/specifications/deployment-architecture-guide.md` — ✅ già aggiornata con deprecation notice
- `docs/99-reference/geometric-crawling-step-reference.md` — rimuovere `screenshotPath`, `aiOverviewConfidence`, `selectorUsed`
- `docs/99-reference/geometric-operation-schematic.md` — rimuovere riferimenti "NO screenshot data"
- `docs/02-design/domain-bounded-context-map.md` — rimuovere `SerpScreenshot` dai Value Objects, rimuovere "screenshot capture" dalle responsabilità
- `docs/02-design/geometric-admin-debug-monitoring-proposal.md` — rimuovere sezioni screenshot
- `docs/02-design/serp-api-integration-proposal.md` — rimuovere note screenshot e `archiveScreenshot`
- `docs/07-governance/frontend-ux-determinism-code-review.md` — rimuovere riferimenti `adminGeometricScreenshots`
- `../../../99-lifecycle/99-archive/plans/feature-geometric-tool-1.md` — rimuovere riferimenti screenshot in req, task, test

**QA Scenario**: Verifica documentazione aggiornata
- **Tool**: `grep -r -l "screenshot\|Screenshot\|SCREENSHOT" docs/ plan/`
- **Steps**: Cerca tutti i riferimenti screenshot nella documentazione
- **Expected result**: Solo riferimenti storici accettabili o documenti archiviati (esclusi dai risultati attivi)

---

## Fase 8 — Validazione

### STEP-026: Verifiche post-rimozione

**QA Scenarios Validazione Completa**:

1. **Backend TypeScript Validation**
   - **Tool**: `npm --workspace apps/backend run typecheck`
   - **Steps**: Verifica compilazione backend dopo tutte le modifiche
   - **Expected result**: Nessun errore TS, zero warnings per screenshot-related types

2. **Frontend TypeScript Validation**
   - **Tool**: `npm --workspace apps/frontend run typecheck`
   - **Steps**: Verifica compilazione frontend dopo tutte le modifiche
   - **Expected result**: Nessun errore TS, zero warnings per screenshot-related types

3. **Backend Test Suite Validation**
   - **Tool**: `npm --workspace apps/backend run test`
   - **Steps**: Esegui tutti i test backend dopo le modifiche
   - **Expected result**: Tutti i test passano, nessun test fallito per screenshot-related functionality

4. **Frontend Test Suite Validation**
   - **Tool**: `npm --workspace apps/frontend run test`
   - **Steps**: Esegui tutti i test frontend dopo le modifiche
   - **Expected result**: Tutti i test passano, nessun test fallito per screenshot-related functionality

5. **Build Validation**
   - **Tool**: `npm run build`
   - **Steps**: Build completa di tutto il progetto
   - **Expected result**: Build successful senza errori

6. **Residual Code Validation** 
   - **Tool**: `grep -r --exclude-dir=node_modules --exclude="*.log" "screenshot\|Screenshot\|SCREENSHOT\|aiOverviewConfidence\|selectorUsed\|computeAiOverviewConfidence" apps/ packages/`
   - **Steps**: Ricerca sistematica di residui screenshot nel codice attivo
   - **Expected result**: **Criteri di successo specifici**: 
     - 0 matches in apps/backend/src/
     - 0 matches in apps/frontend/src/
     - 0 matches in packages/contracts/src/
     - 0 matches in packages/domain/src/
     - Eventuali matches in packages/infra-db/migrations/ devono essere solo migration storiche (non la nuova drop migration)

7. **Functional Regression Test**
   - **Tool**: Geometric tool manual test with SerpApi
   - **Steps**: Esegui un crawling completo con query test attraverso l'interfaccia utente
   - **Expected result**: Il tool Geometric funziona correttamente con SerpApi, produce risultati con `aiOverviewSnippet` e `sources`, nessun errore 500 o crash del server

8. **Database Schema Validation**
   - **Tool**: `psql -h localhost -U postgres -d gen_app_dev -c "\d"`
   - **Steps**: Lista tutte le tabelle nel database dopo migration
   - **Expected result**: La tabella `geometric_screenshot_metadata` non deve esistere nella lista

9. **DDD Governance Compliance Validation**
   - **Tool**: Manual review of canonical documents
   - **Steps**: Verifica che tutti i concetti rimossi siano correttamente marcati come `deprecated` nei documenti canonici
   - **Expected result**: 
     - ✅ Glossary contiene 4 entry deprecate (screenshotArchival, aiOverviewConfidence, selectorUsed, screenshotPath)
     - ✅ Decision Log contiene le 3 entry di governance richieste
     - ✅ Bounded Context Map aggiornato con deprecated translation rule
     - ✅ Nessun concetto rimosso dal codice che non sia tracciato come deprecated nella documentazione canonica

---

## Riepilogo file

| Azione | Conteggio |
|--------|-----------|
| **DDD Governance entries** | **7 (4 Glossary deprecate + 3 Decision Log + 1 Context Map update)** |
| File da eliminare | 9 (7 backend, 2 frontend) |
| File backend da modificare | 12 |
| File frontend da modificare | 6 |
| Env da modificare | 1 |
| Doc/plan da aggiornare | 9 |
| Migration nuova (drop) | 1 |

**Totale**: ~46 interventi (**38 implementazione + 8 governance DDD**)

**Note**: La **Phase 0 (DDD Governance)** è **prerequisito bloccante** per tutte le fasi successive. L'implementazione può iniziare solo dopo il completamento e validazione di tutti i gate di governance DDD.
