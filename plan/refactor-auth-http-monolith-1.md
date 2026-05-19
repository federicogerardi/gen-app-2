---
goal: Scomposizione funzionale del monolite auth-http — runtime, admin-handlers, tools-handlers
version: 1.2
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Backend Architecture
status: 'In Progress'
tags: [refactor, architecture, backend, decomposition]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano decompone i tre file monolitici del layer HTTP `auth-http` in unità funzionali coese, ciascuna con responsabilità singola e dimensione target ≤ 300 LOC. I file di partenza totalizzano **2480 LOC** e costituiscono la debolezza architetturale High severity già tracciata in `docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md`.

Il gate DDD è già superato: DDD-071 è stato registrato in `docs/07-governance/domain-naming-decision-log.md` il 2026-05-19 e dichiarata `normalizeToolWorkflowKey` in `workflow-normalizers.ts` come singolo normalizzatore canonico BE per chiavi `ToolKey`.

La strategia è **strangler-fig incrementale**: ogni fase produce file compilabili e testabili senza interrompere il comportamento runtime. Nessuna fase tocca la surface HTTP pubblica (rotte, contratti di risposta, codici di stato).

Aggiornamento di readiness 2026-05-19: il contesto implementativo verificato in `plan/refactor-auth-http-monolith-context-1.md` ha confermato i dead import di `runtime.ts`, la centralizzazione già disponibile dei request-body types in `support.ts`, l'assenza di uno script `build` nel package `apps/backend` (validazione corretta: `typecheck`), e ha ristretto ulteriormente il contratto runtime effettivo dei blocchi admin/public. Le correzioni rilevanti sono propagate in questa revisione del piano.

---

## 1. Requirements & Constraints

- **REQ-001**: Ogni file target prodotto deve avere ≤ 300 LOC misurati al termine della fase (esclusi commenti e blank lines).
- **REQ-002**: Ogni split deve preservare il comportamento runtime al 100% — nessuna modifica a rotte, metodi HTTP, contratti di risposta, codici di stato, header.
- **REQ-003**: La firma pubblica `createAdminHandlers`, `createToolsHandlers` e `AdminHandlers`/`ToolsHandlers` deve restare invariata per non rompere runtime.ts durante le fasi intermedie.
- **REQ-004**: Il tipo `CreateAdminHandlersDependencies` e `CreateToolsHandlersDependencies` devono restare pubblicamente esportati e compatibili con i consumer esistenti.
- **REQ-005**: I local request-body types duplicati in `admin-handlers.ts` (righe 38–105) devono essere sostituiti con import da `support.ts` dove il tipo equivalente esiste già.
- **REQ-006**: Le validazioni backend di fase devono usare comandi realmente disponibili nel workspace corrente. Per il package `apps/backend` il gate minimo è `npm --workspace apps/backend run typecheck`; `npm run build` resta valido solo dal root workspace perché include anche il frontend.
- **DDD-001**: Nessun modulo figlio del split può ridefinire un normalizzatore `ToolKey`. Solo import da `workflow-normalizers.ts` (DDD-071).
- **DDD-002**: I nomi dei nuovi file e factory devono usare esattamente i termini canonici del glossario DDD: `LlmModel`/`LlmModelCatalog` (DDD-053/055), `UserReport`/`ProductChangelog` (DDD-065/066), `ToolStep`/`GenerationSession` (DDD-031/048). **Eccezione documentata**: admin-feedback-center-handlers.ts usa "FeedbackCenter" come termine aggregante per coerenza con il modulo BE esistente feedback-center-policy.ts. Il termine FeedbackCenterMachine resta canonical solo per il FE; DDD-072 ha registrato FeedbackCenter come termine canonico del boundary Backend/API, quindi l’eccezione è formalmente coperta e non richiede ulteriori prerequisiti di governance.
- **SEC-001**: Nessun refactor deve rimuovere o spostare i guard `requireAdminPrincipal` e `requireSessionPrincipal` senza proof-of-equivalence nel test di integrazione.
- **CON-001**: Nessuna nuova dipendenza npm deve essere introdotta in questo refactoring.
- **CON-002**: Il runtime Node.js HTTP raw (`IncomingMessage`/`ServerResponse`) rimane invariato — nessuna introduzione di framework Express/Fastify.
- **CON-003**: Le fasi devono essere eseguibili in ordine sequenziale: Phase 1 è prerequisito di Phase 2 e Phase 3; Phase 4 dipende dal completamento di Phase 2 e Phase 3.
- **GUD-001**: Ogni nuova factory deve ricevere solo le dipendenze strettamente necessarie ai suoi handler — deps minimo per modulo.
- **GUD-002**: Le funzioni helper private inline (es. `parseExtractionContent`, `normalizeExtractionPayload` in `tools-handlers.ts`) devono essere estratte come funzioni di modulo esportate se condivisibili, o mantenute private nel modulo figlio se non condivisibili.
- **PAT-001**: Pattern `createXxxHandlers(deps): XxxHandlers` — ogni modulo figlio esporta una factory con lo stesso schema del monolite genitore.
- **PAT-002**: Il monolite genitore (`admin-handlers.ts`, `tools-handlers.ts`) diventa un **thin composer**: crea i moduli figli, li combina, e re-esporta `AdminHandlers`/`ToolsHandlers` invariati. Questo preserva il contratto con `runtime.ts` senza modifiche intermedie.

---

## 2. Implementation Steps

### Implementation Phase 1 — Prerequisiti: cleanup dead imports e deduplicazione tipi

- GOAL-001: Eliminare tutti gli import morti in `runtime.ts` e rimuovere i local types duplicati in `admin-handlers.ts` prima di eseguire i split, per ridurre il rumore nei diff successivi.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | **[runtime.ts — dead imports]** Rimuovere riga 46: `import { normalizeToolWorkflowKey } from '../workflow-normalizers'`. Funzione importata ma mai chiamata nel file. (DDD-071 prerequisito già soddisfatto.) | Yes | 2026-05-19 |
| TASK-002 | **[runtime.ts — dead imports]** Verificare con `grep` se `canPublishUserReportIssue`, `normalizeProductChangelogStatus`, `normalizeUserReportCategory`, `normalizeUserReportStatus` (importati da `'../feedback-center-policy'` a riga ~56) sono usati nel corpo di `runtime.ts`. Se nessuna occorrenza oltre l'import: rimuovere l'intera riga di import. (Verifica: 1 match per simbolo = solo import line → dead.) | Yes | 2026-05-19 |
| TASK-003 | **[runtime.ts — dead imports]** Verificare con `grep` se `publishGitHubIssue` e `PublishGitHubIssueError` (importati da `'../integrations/github-issues'` a riga ~59) sono usati nel corpo di `runtime.ts`. Se usati solo in `admin-handlers.ts`: rimuovere l'import da `runtime.ts`. | Yes | 2026-05-19 |
| TASK-004 | **[admin-handlers.ts — type dedup]** Righe 38–105 di `admin-handlers.ts` definiscono local types che duplicano i tipi già esportati da `support.ts`: `AdminCreateUserRequestBody` (riga 38), `AdminUpdateUserRequestBody` (riga 48), `AdminCreateChangelogRequestBody` (riga 58), `AdminUpdateUserReportRequestBody` (riga 64), `AdminPublishUserReportIssueRequestBody` (riga 68). Sostituire le definizioni locali con import da `'./support'`. | Yes | 2026-05-19 |
| TASK-005 | **[admin-handlers.ts — WriteError/WriteSuccess types]** I local types `WriteError` (riga 76) e `WriteSuccess` (riga 88) in `admin-handlers.ts` sono callback types sulle deps. Centralizzare in `support.ts` come `AuthHttpWriteErrorFn` e `AuthHttpWriteSuccessFn` e importarli in `admin-handlers.ts` e `tools-handlers.ts`. | Yes | 2026-05-19 |
| TASK-006 | **Validazione Phase 1**: eseguire `npm --workspace apps/backend run typecheck` e verificare zero errori TypeScript prima di procedere con Phase 2. Facoltativo come gate più ampio di repo: `npm run build`. | Yes | 2026-05-19 |

---

### Implementation Phase 2 — Split admin-handlers.ts (1092 LOC → 3 + 1 thin composer)

- GOAL-002: Decomporre `admin-handlers.ts` in tre moduli per gruppo di dominio DDD, riducendo il file genitore a un thin composer ≤ 50 LOC che preserva il contratto `createAdminHandlers`/`AdminHandlers`.

**Target files e handler assignment:**

| Target file | Handlers inclusi | LOC stimati |
|---|---|---|
| `admin-llm-model-handlers.ts` | `handleAdminModelsList` (L175), `handleAdminModelsCreate` (L280), `handleAdminModelsUpdate` (L339), `handleAdminModelsDelete` (L422) | ~240 |
| `admin-feedback-center-handlers.ts` | `handleAdminCreateChangelog` (L453), `handleAdminListChangelog` (L515), `handleAdminArchiveChangelog` (L539), `handleAdminListUserReports` (L573), `handleAdminUpdateUserReport` (L615), `handleAdminPublishUserReportIssue` (L669) | ~560 |
| `admin-user-handlers.ts` | `handleAdminListUsers` (L806), `handleAdminCreateUser` (L840), `handleAdminGetUser` (L918), `handleAdminUpdateUser` (L945), `handleAdminDeleteUser` (L1037) | ~260 |
| `admin-handlers.ts` (thin composer) | Re-esporta `AdminHandlers`, crea le tre sub-factory, combina i return objects | ≤ 60 |

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | **[Crea admin-llm-model-handlers.ts]** Esito verifica completato: `adminHandlers.handleModelsList` non è dispatchato da `runtime.ts` (`/api/models` instrada a `publicHandlers.handleModelsList`) e va trattato come dead code candidate, non come scope obbligatorio del modulo figlio. Creare `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts`. Dichiarare `CreateAdminLlmModelHandlersDependencies` con le deps effettivamente necessarie: `requireAdminPrincipal`, `requireDb`, `parseJsonBody`, `repositories.sessions`, `now`, `writeError`, `writeSuccess`. Le funzioni adapter `createModel`, `deleteModel`, `listAllModels`, `updateModel` restano importate a livello di modulo da `'../../adapters/llm-model.adapter'`. Spostare le `const handleXxx = async` del slice admin models da `admin-handlers.ts`. | Yes | 2026-05-19 |
| TASK-008 | **[Crea admin-feedback-center-handlers.ts]** Esito verifica completato: `handleCreateUserReport` e `handleListPublishedChangelog` in `admin-handlers.ts` duplicano handler già dispatchati da `public-handlers.ts` e vanno trattati come dead code candidate, non come scope obbligatorio del modulo feedback admin. Creare `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts`. Deps necessarie: `repositories.sessions`, `githubApiConfig`, `requireAdminPrincipal`, `requireDb`, `parseJsonBody`, `parseOptionalNonEmptyString`, `parseRequestUrl`, `now`, `writeError`, `writeSuccess`. Spostare i 6 handler admin `handleAdminCreateChangelog` … `handleAdminPublishUserReportIssue`. Mantenere invariato il blocco `handleAdminPublishUserReportIssue` (L669–805) inclusi i 14 `console.debug` — la riduzione logging volume è fuori scope di questo refactoring. | Yes | 2026-05-19 |
| TASK-009 | **[Crea admin-user-handlers.ts]** Creare `apps/backend/src/lib/runtime/auth-http/admin-user-handlers.ts`. Deps necessarie: `repositories.users`, `repositories.sessions`, `passwordHashing`, `requireAdminPrincipal`, `parseJsonBody`, `parseRequestUrl`, `parseAuthUserRole`, `parseAuthUserStatus`, `userToResponseData`, `now`, `writeError`, `writeSuccess`. Spostare i 5 handler `handleAdminListUsers` … `handleAdminDeleteUser`. | Yes | 2026-05-19 |
| TASK-010 | **[Trasforma admin-handlers.ts in thin composer]** Ridurre `admin-handlers.ts` a: (1) import e re-export di `AdminHandlers` type assembly dai tre nuovi file; (2) `CreateAdminHandlersDependencies` invariato (union delle tre deps-sub); (3) `createAdminHandlers` che istanzia le tre sub-factory con il subset di deps appropriato e combina i return objects via spread `{ ...llmModelHandlers, ...feedbackCenterHandlers, ...userHandlers }`; (4) rimozione dal contratto `AdminHandlers` dei dead duplicated handlers non dispatchati (`handleModelsList`, `handleCreateUserReport`, `handleListPublishedChangelog`) salvo emersione di consumer esterni non rilevati. | Yes | 2026-05-19 |
| TASK-011 | **Validazione Phase 2**: eseguire `npm --workspace apps/backend run typecheck`. Verificare zero errori TypeScript. Eseguire i test di integrazione esistenti sull'endpoint admin per verificare comportamento invariato. | Yes | 2026-05-19 |

---

### Implementation Phase 3 — Split tools-handlers.ts (873 LOC → 4 + 1 thin composer)

- GOAL-003: Decomporre `tools-handlers.ts` in quattro moduli per gruppo funzionale, applicare DDD-071 (sostituire `normalizeSupportedToolKey` con import da `workflow-normalizers.ts`), ed estrarre i helper DDD-038 (`parseExtractionContent`, `normalizeExtractionPayload`) in un modulo condivisibile.

**Target files e handler assignment:**

| Target file | Handlers inclusi | LOC stimati |
|---|---|---|
| `tools-brief-handlers.ts` | `handleToolsBriefUpload` (L149–257) | ~110 |
| `tools-hydrate-handlers.ts` | `handleToolsHydrate` (L258–503) + helper module extract | ~250 |
| `tools-orchestrate-handlers.ts` | `handleToolsOrchestrate` (L504–698) | ~200 |
| `tools-session-handlers.ts` | `handleToolsSessionsList` (L699), `handleToolsSessionArtifacts` (L728), `handleToolsSessionStepArtifact` (L761), `handleToolsSessionDownload` (L795) | ~180 |
| `tools-handlers.ts` (thin composer) | Re-esporta `ToolsHandlers`, crea le quattro sub-factory, combina i return objects | ≤ 50 |

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | **[DDD-071 — Sostituire normalizeSupportedToolKey]** In `tools-handlers.ts` riga 81: rimuovere la funzione privata `normalizeSupportedToolKey`. Aggiungere `import { normalizeToolWorkflowKey } from '../workflow-normalizers'`. Sostituire le 2 chiamate a `normalizeSupportedToolKey(x)` (righe 180–181) con `normalizeToolWorkflowKey(x)`. **Nota sulla differenza comportamentale nel fallback**: `normalizeSupportedToolKey` usa `replaceAll('_', '-')` come fallback (es. `thank_you` → `thank-you`), mentre `normalizeToolWorkflowKey` restituisce il valore normalizzato as-is (es. `thank_you` → `thank_you`). La migrazione è sicura perché: (1) input non-canonici falliscono `isSupportedToolWorkflow` in entrambi i casi; (2) `normalizeToolWorkflowKey` è **più corretto** per la chiave canonica `thank_you` (forma con underscore). La differenza è un miglioramento, non una regressione. | | |
| TASK-013 | **[Estrai tools-hydration-parser.ts]** Creare `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts` con le funzioni helper attualmente inline in `handleToolsHydrate`: `isRecord` (L301), `normalizeExtractionPayload` (L304), `parseJsonCandidate` (L335), `parseExtractionContent` (L344), `parsedFormatFromInput` (L369). Esportarle come funzioni pure non legate a `IncomingMessage`/`ServerResponse`. Questo modulo implementa il fallback DDD-038 (direct artifact → ranked listing). | | |
| TASK-014 | **[Crea tools-brief-handlers.ts]** Creare `apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts`. Deps necessarie: `parseJsonBody`, `parseRequestUrl`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess`. Spostare `handleToolsBriefUpload`. Usare `normalizeToolWorkflowKey` importato da `'../workflow-normalizers'` (DDD-071). | | |
| TASK-015 | **[Crea tools-hydrate-handlers.ts]** Creare `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts`. Deps necessarie: `parseJsonBody`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess`. Spostare `handleToolsHydrate`. Importare i parser da `tools-hydration-parser.ts` (TASK-013). | | |
| TASK-016 | **[Crea tools-orchestrate-handlers.ts]** Creare `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`. Deps necessarie: `idempotency`, `parseJsonBody`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess`. Spostare `handleToolsOrchestrate`. | | |
| TASK-017 | **[Crea tools-session-handlers.ts]** Creare `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts`. Deps necessarie: `parseRequestUrl`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess`. Spostare i 4 handler di sessione. | | |
| TASK-018 | **[Trasforma tools-handlers.ts in thin composer]** Ridurre `tools-handlers.ts` a: (1) re-export di `ToolsHandlers` type assembly; (2) `CreateToolsHandlersDependencies` invariato; (3) `createToolsHandlers` che istanzia le quattro sub-factory con il subset di deps verificato e combina via spread. | | |
| TASK-019 | **Validazione Phase 3**: eseguire `npm --workspace apps/backend run typecheck`. Verificare zero errori TypeScript. Eseguire i test di integrazione esistenti sugli endpoint tools per verificare comportamento invariato. | | |

---

### Implementation Phase 4 — Route dispatch declarativo in runtime.ts (515 LOC → ≤ 200 LOC)

- GOAL-004: Sostituire la catena if/else imperativa del dispatch (L248–510, ~260 LOC, 14 blocchi) con una struttura route table dichiarativa. `createAuthHttpRuntime` diventa un thin orchestrator ≤ 200 LOC totali.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | **[Crea route-table.ts]** Creare `apps/backend/src/lib/runtime/auth-http/route-table.ts`. Definire il tipo `RouteEntry`: `{ method: string \| null; pattern: string \| RegExp; handler: (request, response, ...matches: string[]) => Promise<void> }`. Il campo `method: null` indica handler che gestisce il method-check internamente (usato per rotte con metodi multipli). | | |
| TASK-021 | **[Implementa buildRouteTable(handlers)]** In `route-table.ts` implementare `buildRouteTable(handlers: AllHandlerGroups): RouteEntry[]` che restituisce la route table come array ordinato. I parametri regex catturati (`[1]`, `[2]`) vengono passati come argomenti posizionali all'handler. | | |
| TASK-022 | **[Implementa dispatchRequest(routeTable, request, response)]** In `route-table.ts` implementare la funzione `dispatchRequest(routeTable: RouteEntry[], request: IncomingMessage, response: ServerResponse): Promise<HandleAuthHttpRequestResult>`. La funzione itera la route table in ordine, fa match su `normalizePath(request.url)` e `request.method`, invoca l'handler con i captures, restituisce `{ handled: true }` o `{ handled: false }` al termine. | | |
| TASK-023 | **[Aggiorna runtime.ts]** In `createAuthHttpRuntime`: sostituire il blocco if/else del dispatch (L248–510) con `const routeTable = buildRouteTable(allHandlers)` e `return await dispatchRequest(routeTable, request, response)`. Il try/catch di errore unhandled rimane invariato. | | |
| TASK-024 | **Validazione Phase 4**: eseguire `npm --workspace apps/backend run typecheck`. Verificare zero errori TypeScript. Eseguire la suite di test completa `npm --workspace apps/backend run test`. Verificare che tutte le 29 route entries attualmente coperte in `runtime.ts` siano presenti nella route table con metodi e ordine corretti. | | |

---

## 3. Alternatives

- **ALT-001**: Mantenere il pattern monolite e aggiungere solo commenti di sezione. Scartato: non riduce il costo cognitivo né il rischio di regressioni da modifiche al file, non chiude la debolezza High severity tracciata.
- **ALT-002**: Introdurre un framework HTTP (Express, Fastify, Hono) come alternativa alla route table custom. Scartato: introduce una dipendenza npm non autorizzata (CON-001) e richiederebbe una migrazione dell'intera superficie HTTP in un unico cambiamento rischiato.
- **ALT-003**: Split per file separati per ogni singolo handler (18 file per admin, 7 per tools). Scartato: frammentazione eccessiva, gli handler dello stesso gruppo di dominio condividono helper interni e costanti che sarebbero da duplicare o centralizzare ulteriormente.
- **ALT-004**: Eseguire Phase 4 (route table) prima di Phase 2/3. Scartato: la route table deve mappare handlers già stabilizzati — farlo prima dei split aumenta il rischio di duplicazione di lavoro.
- **ALT-005**: Estrarre `handleAdminPublishUserReportIssue` in un servizio separato (GitHub integration service). Non scartato permanentemente, ma rimandato: il refactoring della logica di pubblicazione GitHub è un concern separato (logging volume, policy layer) non incluso in questo scope di decomposizione strutturale.

---

## 4. Dependencies

- **DEP-001**: `apps/backend/src/lib/runtime/auth-http/support.ts` — file esistente; Phase 1 lo estende con nuovi tipi `AuthHttpWriteErrorFn` / `AuthHttpWriteSuccessFn`.
- **DEP-002**: `apps/backend/src/lib/runtime/workflow-normalizers.ts` — file esistente; Phase 3 aggiunge un import da esso in `tools-brief-handlers.ts` (DDD-071).
- **DEP-003**: `apps/backend/src/lib/runtime/auth-http/http-utils.ts` — file esistente; `normalizePath` è già usato in `runtime.ts` e rimane il punto di normalizzazione URL nella route table.
- **DEP-004**: `apps/backend/src/lib/adapters/` — bundle adapter esistenti; i subset di deps per ogni modulo figlio devono essere ricavati dai tipi esistenti `AuthRepositoryBundle` / `UserQueryRepositoryBundle`.
- **DEP-005**: `docs/07-governance/domain-naming-decision-log.md` — DDD-071 già registrato; prerequisito di governance già soddisfatto prima di questo piano.
- **DEP-006**: `plan/refactor-auth-http-monolith-context-1.md` — contesto implementativo verificato; fonte di truth operativa per correzioni di dipendenze minime, dead code candidate e comandi di validazione realmente eseguibili.

---

## 5. Files

**File modificati:**
- **FILE-001**: `apps/backend/src/lib/runtime/auth-http/runtime.ts` — rimozione dead imports (Phase 1), sostituzione dispatch chain con route table (Phase 4). LOC target: da 515 a ≤ 200.
- **FILE-002**: `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` — rimozione local type dups (Phase 1), trasformazione in thin composer (Phase 2). LOC target: ≤ 60.
- **FILE-003**: `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` — rimozione `normalizeSupportedToolKey` (Phase 3 TASK-012), trasformazione in thin composer (Phase 3). LOC target: ≤ 50.
- **FILE-004**: `apps/backend/src/lib/runtime/auth-http/support.ts` — aggiunta `AuthHttpWriteErrorFn`, `AuthHttpWriteSuccessFn` (Phase 1 TASK-005).

**File creati:**
- **FILE-005**: `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` — ~270 LOC.
- **FILE-006**: `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` — ~600 LOC. (Unico file che supera 300 LOC per via della densità del handler `handleAdminPublishUserReportIssue` — ulteriore estrazione è candidata per un refactoring successivo.)
- **FILE-007**: `apps/backend/src/lib/runtime/auth-http/admin-user-handlers.ts` — ~260 LOC.
- **FILE-008**: `apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts` — ~110 LOC.
- **FILE-009**: `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts` — ~80 LOC (funzioni pure, no HTTP deps).
- **FILE-010**: `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts` — ~170 LOC (dopo estrazione parser).
- **FILE-011**: `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts` — ~200 LOC.
- **FILE-012**: `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts` — ~180 LOC.
- **FILE-013**: `apps/backend/src/lib/runtime/auth-http/route-table.ts` — ~120 LOC.

---

## 6. Testing

- **TEST-001**: Dopo Phase 1 (TASK-006): `npm --workspace apps/backend run typecheck` deve completare senza errori TypeScript. Verifica specifica: nessun `TS2305` (module has no exported member) e nessun `TS6133` (declared but never read) sui file modificati.
- **TEST-002**: Dopo Phase 2 (TASK-011): eseguire la suite di test di integrazione admin. Verifica: tutti gli endpoint `GET/POST /admin/users`, `GET/POST/PUT/DELETE /api/admin/models`, `GET/POST /api/admin/changelog`, `PATCH /api/admin/user-reports/:id`, `POST /api/admin/user-reports/:id/publish-issue`, `POST /api/admin/product-changelogs/:id/archive` ritornano gli stessi status code e body shape di prima del refactoring.
- **TEST-003**: Dopo Phase 3 (TASK-019): eseguire la suite di test di integrazione tools. Verifica: tutti gli endpoint `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/:id`, `GET /api/tools/sessions/:id/step/:stepKey`, `GET /api/tools/sessions/:id/download` ritornano gli stessi status code e body shape.
- **TEST-004**: Dopo Phase 4 (TASK-024): eseguire la suite di test completa `npm --workspace apps/backend run test`. Verifica specifica: route table contiene esattamente 29 entries corrispondenti alle rotte definite nella catena if/else originale, mantenendo l'ordine dei catch-all e delle download routes.
- **TEST-005**: Test unitario per `tools-hydration-parser.ts` (TASK-013): verificare che `parseExtractionContent`, `normalizeExtractionPayload` si comportino identicamente alle funzioni inline originali con i casi limite DDD-038 (direct artifact hit, fallback listing, content assente).
- **TEST-006**: Test unitario per `dispatchRequest` in `route-table.ts` (TASK-022): verificare match corretto di rotte statiche, rotte con parametri regex, e `{ handled: false }` per path non mappato.

---

## 7. Risks & Assumptions

- **RISK-001**: `admin-feedback-center-handlers.ts` (FILE-006) supererà 300 LOC (~600 stimate) a causa dell'handler `handleAdminPublishUserReportIssue` che concentra HTTP + authz + policy + GitHub API + DB transaction. Mitigazione: accettato in questo scope; la scomposizione ulteriore è candidata per un piano separato `refactor-issue-publication-service-1.md`.
- **RISK-002**: I subset di deps per i moduli figli potrebbero non essere completamente identificabili prima della lettura completa degli handler. Mitigazione: leggere il corpo completo di ogni handler durante l'implementazione per costruire il deps-type minimo.
- **RISK-003**: La route table in Phase 4 richiede l'ordine delle route invariato (es. download prima del catch-all `/:sessionId`). Il commento a riga ~460 (`// Download route must be before the /:sessionId catch-all`) documenta già questa dipendenza. Mitigazione: preservare l'ordine array nella `buildRouteTable` e aggiungere commento esplicito nel codice.
- **RISK-004**: TypeScript potrebbe richiedere cast espliciti sui spread `{ ...handlerGroupA, ...handlerGroupB }` se i tipi non sono perfettamente inferiti. Mitigazione: usare `satisfies AdminHandlers` o cast esplicito come ultima risorsa, documentando con commento il perché.
- **ASSUMPTION-001**: Non esistono test unitari diretti per i tre file monolitici oltre ai test di integrazione HTTP. La refactoring confidence si basa quindi sui test di integrazione di TASK-002 / TASK-003.
- **ASSUMPTION-002**: Le funzioni helper private inline di `handleToolsHydrate` (`isRecord`, `normalizeExtractionPayload`, etc.) non hanno side-effects e sono pura computazione — estraibili senza rischi comportamentali.
- **RISK-005**: Verifica completata: `adminHandlers.handleModelsList` non è dispatchato da `runtime.ts`; inoltre `handleCreateUserReport` e `handleListPublishedChangelog` duplicano path pubblici gestiti da `public-handlers.ts`. Mitigazione: trattarli come dead code candidate e non promuoverli nei nuovi moduli salvo rilevazione di consumer esterni non coperti dal workspace search.
- **RISK-006**: Verifica completata: i deps minimi effettivi dei moduli tools e admin sono più ampi di alcune stime iniziali. In particolare, diversi handler toccano `repositories.sessions.touchSession` e richiedono quindi `repositories.sessions` e `now`; `admin-feedback-center-handlers.ts` richiede anche `parseRequestUrl`. Mitigazione: usare come fonte operativa il contesto verificato `plan/refactor-auth-http-monolith-context-1.md` e costruire i deps-type dai real usage sites, non dalle stime iniziali.
- **ASSUMPTION-004**: `admin-llm-model-handlers.ts` importa le adapter LLM (`createModel`, `deleteModel`, `listAllModels`, `updateModel`) a livello di modulo da `'../../adapters/llm-model.adapter'`. L'accesso al DB resta via `requireDb`, ma il modulo deve comunque ricevere `repositories.sessions` e `now` per il session touch post-mutation/read.


## 8. Related Specifications / Further Reading

- [docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md](../docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md) — Debolezze architetturali High severity che motivano questo piano
- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md) — DDD-071: gate governance soddisfatto prima dell'esecuzione
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md) — Termini canonici usati nei nomi dei nuovi moduli
- [apps/backend/src/lib/runtime/auth-http/support.ts](../apps/backend/src/lib/runtime/auth-http/support.ts) — Tipi condivisi estesi in Phase 1
- [apps/backend/src/lib/runtime/workflow-normalizers.ts](../apps/backend/src/lib/runtime/workflow-normalizers.ts) — Normalizzatore canonico `normalizeToolWorkflowKey` (DDD-071)
- [plan/refactor-auth-http-monolith-context-1.md](./refactor-auth-http-monolith-context-1.md) — Contesto implementativo verificato usato per correggere assunzioni e task del piano
