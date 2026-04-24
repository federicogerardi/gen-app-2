---
goal: Sequenza di ticket tecnici granulari per chiudere il gap backend/frontend su projects e artifacts
version: 2.0
date_created: 2026-04-24
last_updated: 2026-04-25
owner: Backend Platform + Frontend Platform
status: 'Completed'
tags: [process, feature, backend, frontend, tickets, projects, artifacts, api, persistence]
---

# Introduction


![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano scompone il piano di implementazione generale per projects e artifacts in ticket tecnici atomici, ordinati per dipendenze ed eseguibili da team backend/frontend o da agenti separati senza ambiguità interpretative.

## 0. Progress Snapshot (2026-04-24)

### Ticket implementati (codice presente)

- Backend P0-P6 implementato a livello codice:
	- `BE-INJECT-001..004`
	- `BE-CONTRACT-001..003`, `BE-EXPORT-002`
	- `BE-PROJ-QUERY-001..003`, `BE-PROJ-STUB-001`
	- `BE-ART-QUERY-001..002`, `BE-ART-MAP-001`, `BE-ART-STUB-001`
	- `BE-AUTH-001..002` e wiring runtime lato server
	- `BE-PROJ-HTTP-001..003`, `BE-ART-HTTP-001..003`
	- test HTTP aggiunti/estesi per route `/api/*`
	- smoke repository query aggiunto (`smoke:queries`) e incluso in `test:smoke`
	- gate backend completo verificato (`npm run backend:go`)
- Frontend P8-P11 (parziale) implementato a livello codice:
	- `FE-CAP-001..002`
	- `FE-PROJ-CLIENT-001`, `FE-PROJ-CLIENT-TEST-001`, `FE-PROJ-PAGE-001..002`
	- `FE-ART-CLIENT-001`, `FE-ART-CLIENT-TEST-001`, `FE-ART-PAGE-001..002`
	- `FE-DEV-001`
	- `FE-DEV-TEST-001` e `E2E-001` registrati con validazione HTTP autenticata
	- `DOC-001`, `ENV-001`, `GATE-001`, `FE-FALLBACK-001` allineati in documentazione/stato runtime
	- conferma funzionale frontend capability-live su list/create projects registrata

### Ticket ancora aperti o non validati

- Nessun ticket aperto residuo per questo piano; attivi solo monitoraggi CI post-cutover.

### Nota di affidabilita

Lo stato sopra riflette interventi implementati nel codice; la chiusura definitiva dei ticket resta subordinata al passaggio dei gate e alla validazione manuale prevista dal piano.

> **Revisione architetturale 2026-04-24** — Analisi statica pre-esecuzione ha rilevato due blocchi P0 non modellati nella versione originale:
>
> **BLOCCO-1**: `AuthHttpRuntimeOptions` riceve solo `AuthRepositoryBundle` (`users`, `sessions`, `oauthState`) e non ha alcun punto di injection per repository projects/artifacts. Le route HTTP `/api/projects*` e `/api/artifacts*` non compilerebbero. Una **Fase 0** obbligatoria risolve questo introducendo `UserQueryRepositoryBundle` separato e un campo opzionale `queryRepositories` su `AuthHttpRuntimeOptions`.
>
> **BLOCCO-2**: `PostgresArtifactRepository` (interfaccia esistente) ha solo metodi write usati dalle macchine XState (`flushProgress`, `finalizeSuccess`, `finalizeFailure`). Le query read devono vivere su una interfaccia separata `ArtifactQueryRepository` per non alterare il contratto degli actor in produzione.
>
> Le macchine XState di generazione **non devono essere toccate** in nessuna fase del piano.

## 1. Requirements & Constraints

- **REQ-001**: Ogni ticket deve essere eseguibile con scope minimo, file target espliciti e un criterio di completamento verificabile.
- **REQ-002**: Il risultato finale deve esporre `GET/POST /api/projects`, `GET /api/projects/:id`, `GET /api/artifacts`, `GET /api/artifacts/:id` con dati letti dal DB.
- **REQ-003**: Il frontend deve consumare gli endpoint backend solo quando `VITE_CAP_PROJECTS=true` e `VITE_CAP_ARTIFACTS=true`; in caso contrario deve mantenere il fallback locale.
- **REQ-004**: Tutti i ticket backend devono preservare il comportamento esistente di `/auth/*`, `/generation/stream`, `/admin/users` in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts).
- **REQ-005**: Tutti i ticket frontend devono mantenere il comportamento fallback attuale finché i ticket backend e proxy non sono completati.
- **SEC-001**: Gli endpoint `/api/projects*` e `/api/artifacts*` devono essere autenticati e filtrare i dati per `user_id` lato server.
- **SEC-002**: `404` deve coprire sia risorsa inesistente sia risorsa non accessibile all’utente autenticato.
- **SEC-003**: Tutte le chiamate frontend verso backend devono mantenere `credentials: 'include'`.
- **CON-001**: Nessuna migration distruttiva; lo schema DB in [db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql) è già sufficiente come base.
- **CON-002**: I path API finali devono restare quelli già predisposti in [frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts).
- **CON-003**: Il proxy dev deve inoltrare `/api/*` senza intercettare erroneamente route SPA come `/admin` o `/dashboard`.
- **GUD-001**: Ogni ticket che introduce codice eseguibile deve introdurre o aggiornare almeno un test pertinente nello stesso slice.
- **GUD-002**: L’ordine di esecuzione deve essere backend contracts -> backend queries -> backend HTTP -> frontend capability wiring -> frontend clients/pages -> cutover/docs.

## 2. Implementation Steps
- **PAT-003**: I metodi read per projects/artifacts devono vivere su `ProjectQueryRepository` e `ArtifactQueryRepository`, interfacce separate da `PostgresArtifactRepository`; quest'ultima è parte del contratto XState e non deve essere estesa con query HTTP.
- **PAT-004**: `AuthHttpRuntimeOptions` deve essere esteso con campo opzionale `queryRepositories?: UserQueryRepositoryBundle`; il campo è opzionale per non rompere i caller esistenti.
- **INV-001**: Le macchine XState (`IdempotencyCoordinatorMachine`, `PersistenceBatchMachine`, ecc.) non devono essere modificate in nessuna fase. Gli endpoint CRUD sono sincroni e non richiedono nuovi actors.

### Implementation Phase 1

### Implementation Phase 0 — Prerequisito bloccante: injection gap (P0)

- GOAL-000: Risolvere il gap di injection tra repository query e `auth-http.ts`. Senza questa fase le Fasi 5-6 non compilano.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-INJECT-001 | Ticket BE-INJECT-001: definire `ProjectQueryRepository` e `ArtifactQueryRepository` in [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts) come interfacce separate da `PostgresArtifactRepository`. `ProjectQueryRepository` firma: `listProjectsByUser(userId: string): Promise<ProjectSummary[]>`, `getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail \| null>`, `createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail>`. `ArtifactQueryRepository` firma: `listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]>`, `getArtifactByIdForUser(userId: string, artifactId: string): Promise<ArtifactDetail \| null>`. Completato quando `tsc --noEmit` compila e `PostgresArtifactRepository` resta invariata. |  |  |
| TASK-INJECT-002 | Ticket BE-INJECT-002: definire `UserQueryRepositoryBundle` in [src/lib/adapters/auth.interfaces.ts](../src/lib/adapters/auth.interfaces.ts) con campi `projects: ProjectQueryRepository` e `artifacts: ArtifactQueryRepository`. Deve essere separata da `AuthRepositoryBundle`. Completato quando importabile senza modificare `AuthRepositoryBundle`. |  |  |
| TASK-INJECT-003 | Ticket BE-INJECT-003: estendere `AuthHttpRuntimeOptions` in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) con campo `queryRepositories?: UserQueryRepositoryBundle`. Il campo **deve essere opzionale**: tutti i caller esistenti (test e `node-server.ts`) continuano a compilare senza cambiamenti. Completato quando `tsc --noEmit` è verde senza modifiche ai caller. |  |  |
| TASK-INJECT-004 | Ticket BE-INJECT-004: riesportare `UserQueryRepositoryBundle`, `ProjectQueryRepository`, `ArtifactQueryRepository` da [src/lib/adapters/index.ts](../src/lib/adapters/index.ts). Completato quando importabili senza path profondi. |  |  |

- GOAL-001: Preparare contratti e superfici backend minime prima di aggiungere nuove route.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Ticket BE-CONTRACT-001: aggiungere i tipi `ProjectSummary`, `ProjectDetail`, `CreateProjectInput`, `ArtifactListFilters`, `ArtifactSummary`, `ArtifactDetail` in `src/lib/types/` o in un file dedicato coerente con gli export correnti. Completato quando i tipi sono importabili da runtime HTTP e adapter. |  |  |
| TASK-002 | Ticket BE-CONTRACT-002: definire mapper DB row → `ProjectSummary` / `ProjectDetail` in `src/lib/types/projects.ts`. Il mapper è una funzione pura (no I/O) che trasforma le colonne `id`, `name`, `description`, `updated_at` del DB. Deve avere almeno un test unitario. Completato quando il mapper è testato e importabile da produzione e stub. |  |  |
| TASK-003 | Ticket BE-CONTRACT-003: definire mapper DB row → `ArtifactSummary` / `ArtifactDetail` in `src/lib/types/artifacts.ts`. **Nota**: basarsi sulle colonne della tabella `artifacts` in [db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql), non su `GenerationArtifact` (tipo XState in-flight non persistito). Completato quando il mapper è testato e produce shape compatibile con i client frontend. |  |  |
| TASK-004 | Ticket BE-EXPORT-002: aggiornare [src/lib/adapters/index.ts](../src/lib/adapters/index.ts) per riesportare i tipi HTTP `ProjectSummary`, `ProjectDetail`, `CreateProjectInput`, `ArtifactSummary`, `ArtifactDetail`, `ArtifactListFilters`. Le interfacce repository (TASK-INJECT-001/002) sono già esportate dalla Fase 0. Completato quando importabili senza path profondi. |  |  |

### Implementation Phase 2

- GOAL-002: Implementare le query projects su Postgres e stub.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-005 | Ticket BE-PROJ-QUERY-001: implementare `listProjectsByUser(userId)` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) con query ordinata per `updated_at DESC`. Completato quando il metodo restituisce solo record dell’utente richiesto. |  |  |
| TASK-006 | Ticket BE-PROJ-QUERY-002: implementare `getProjectByIdForUser(userId, projectId)` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts). Completato quando restituisce `null` per record assente o di altro utente. |  |  |
| TASK-007 | Ticket BE-PROJ-QUERY-003: implementare `createProjectForUser(userId, input)` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) valorizzando `id`, `created_at`, `updated_at`. Completato quando il record è persistito e leggibile con `getProjectByIdForUser`. |  |  |
| TASK-008 | Ticket BE-PROJ-STUB-001: implementare `ProjectQueryRepositoryStub` in [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts), implementando `ProjectQueryRepository` (da Fase 0 TASK-INJECT-001). Storage in-memory con `Map`. Completato quando i test backend usano lo stub senza Postgres reale. |  |  |

### Implementation Phase 3

- GOAL-003: Implementare le query artifacts su Postgres e stub.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-009 | Ticket BE-ART-QUERY-001: implementare `listArtifactsByUser(userId, filters)` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) con filtri `type`, `status`, `projectId`, `from`, `to`. Completato quando la query rispetta tutti i filtri combinati. |  |  |
| TASK-010 | Ticket BE-ART-QUERY-002: implementare `getArtifactByIdForUser(userId, artifactId)` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts). Completato quando restituisce `null` per artifact di altro utente o inesistente. |  |  |
| TASK-011 | Ticket BE-ART-MAP-001: verificare che il mapper di TASK-003 (Fase 1) sia allineato alle colonne effettive della tabella `artifacts`. Confrontare colonne migration vs campi `ArtifactSummary`/`ArtifactDetail`. Se necessario adattare il mapper. Completato quando `listArtifactsByUser` e `getArtifactByIdForUser` restituiscono shape consumabile dai client frontend senza cast extra. |  |  |
| TASK-012 | Ticket BE-ART-STUB-001: implementare `ArtifactQueryRepositoryStub` in [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts), implementando `ArtifactQueryRepository` (da Fase 0 TASK-INJECT-001). Deve supportare tutti i filtri di `ArtifactListFilters` in memoria. Completato quando i test HTTP artifacts usano lo stub. |  |  |

### Implementation Phase 4

- GOAL-004: Preparare il runtime HTTP autenticato per route user-scoped non-admin.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-013 | Ticket BE-AUTH-001: introdurre in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) un helper `requireSessionPrincipal` o equivalente, distinto da `requireAdminPrincipal`. Completato quando è riutilizzabile da route projects/artifacts. |  |  |
| TASK-014 | Ticket BE-AUTH-002: definire e testare la convenzione status code per route user-scoped: `401` sessione assente, `400` filtri invalidi, `404` record non trovato/non visibile. Completato quando le utility HTTP esprimono questo comportamento in test. |  |  |
| TASK-015 | Ticket BE-WIRING-001: aggiornare il punto di costruzione di `AuthHttpRuntimeOptions` in [src/lib/runtime/node-server.ts](../src/lib/runtime/node-server.ts) passando `queryRepositories: { projects: new PostgresProjectQueryRepository(pool), artifacts: new PostgresArtifactQueryRepository(pool) }`. Il `Pool` Postgres è già disponibile nel file (usato dagli auth repository); non deve essere duplicato. [src/server.ts](../src/server.ts) non richiede modifiche se delega a `node-server.ts`. Completato quando il server si avvia correttamente e `GET /api/projects` risponde (anche con lista vuota). |  |  |

### Implementation Phase 5

- GOAL-005: Esporre gli endpoint HTTP projects.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-016 | Ticket BE-PROJ-HTTP-001: aggiungere in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) il branch `GET /api/projects`. Completato quando usa `requireSessionPrincipal`, query repository e restituisce lista JSON corretta. |  |  |
| TASK-017 | Ticket BE-PROJ-HTTP-002: aggiungere il branch `GET /api/projects/:id` usando regex `^\/api\/projects\/([^/]+)$` (analoga a `/admin/users/:id` già presente). Restituisce `{ ok: false, error: { code: 'not_found', message: '...' } }` con status 404 sia per record assente sia per record di altro utente. Completato quando il test verifica isolamento per utente. |  |  |
| TASK-018 | Ticket BE-PROJ-HTTP-003: aggiungere il branch `POST /api/projects` con `parseJsonBody<CreateProjectInput>`. Validare che `name` sia string non vuota; restituire 400 altrimenti. Restituire 201 con `{ ok: true, data: { project: ProjectDetail } }`. Completato quando il test verifica round-trip create→getById. |  |  |
| TASK-019 | Ticket BE-PROJ-HTTP-TEST-001: estendere [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) con i casi `401`, `200 list`, `200 byId`, `404 byId`, `201/200 create`, “isolation by user”. Completato quando i test falliscono senza implementation e passano con implementation. |  |  |

### Implementation Phase 6

- GOAL-006: Esporre gli endpoint HTTP artifacts.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-020 | Ticket BE-ART-HTTP-001: aggiungere in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) il branch `GET /api/artifacts` con parsing filtri querystring. Completato quando chiama repository query con filtri validati. |  |  |
| TASK-020 | Ticket BE-ART-HTTP-001: aggiungere il branch `GET /api/artifacts` con parsing filtri da `url.searchParams`. Prerequisito: TASK-INJECT-003 (campo `queryRepositories` disponibile) e TASK-012 (stub). Ogni filtro stringa deve essere validato prima di essere passato al repository, seguendo la convenzione di `parseAuthUserStatus` già presente. Completato quando chiama `queryRepositories.artifacts.listArtifactsByUser` con filtri validati. |  |  |
| TASK-021 | Ticket BE-ART-HTTP-002: aggiungere il branch `GET /api/artifacts/:id` usando regex `^\/api\/artifacts\/([^/]+)$`. Restituisce 404 per artifact non trovato o non visibile all'utente. Completato quando il test verifica isolamento per utente. |  |  |
| TASK-022 | Ticket BE-ART-HTTP-003: aggiungere validazione parametri `type`, `status`, `projectId`, `from`, `to` con errore `400` per valori invalidi. Completato quando almeno un test copre ogni ramo invalido. |  |  |
| TASK-023 | Ticket BE-ART-HTTP-TEST-001: estendere [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) con casi `401`, `200 list`, `200 byId`, `404 byId`, filtri combinati e isolamento per utente. Completato quando la suite passa con stub o fixture dedicata. |  |  |

### Implementation Phase 7

- GOAL-007: Aggiungere copertura query/repository e stabilizzare il backend gate.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-024 | Ticket BE-REPO-TEST-001: aggiungere test query projects sul repository live o smoke dedicato. Completato quando verifica lettura ordinata, creazione e scoping per utente. |  |  |
| TASK-025 | Ticket BE-REPO-TEST-002: aggiungere test query artifacts sul repository live o smoke dedicato. Completato quando verifica filtri e scoping per utente. |  |  |
| TASK-026 | Ticket BE-GATE-001: verificare e aggiornare `npm run backend:go` in [package.json](../package.json) se necessario per includere le nuove coperture senza step manuali extra. Completato quando il gate verde copre la nuova superficie. |  |  |

### Implementation Phase 8

- GOAL-008: Introdurre il wiring frontend delle capability runtime reali.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-027 | Ticket FE-CAP-001: creare un punto unico di lettura capability basato su `readBackendCapabilities()` da [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts). Completato quando almeno un consumer riceve le capability via provider/hook, non via override hardcoded. |  |  |
| TASK-028 | Ticket FE-CAP-002: esporre le capability nel contesto applicativo esistente in [frontend/src/app/providers/AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx) oppure in un provider dedicato. Completato quando una pagina può leggere `projects` e `artifacts` capability da hook centralizzato. |  |  |
| TASK-029 | Ticket FE-CAP-TEST-001: aggiungere o aggiornare test in [frontend/src/app/runtime/backend-capabilities.test.ts](../frontend/src/app/runtime/backend-capabilities.test.ts) o test provider dedicato per coprire lettura env e propagation. Completato quando `VITE_CAP_PROJECTS` e `VITE_CAP_ARTIFACTS` influenzano effettivamente il client path. |  |  |

### Implementation Phase 9

- GOAL-009: Fare il cutover frontend dei client projects.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-030 | Ticket FE-PROJ-CLIENT-001: aggiornare [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) per usare le capability reali lette dal provider/runtime. Completato quando con capability `true` chiama `/api/projects*`, con capability `false` usa fallback locale. |  |  |
| TASK-031 | Ticket FE-PROJ-CLIENT-TEST-001: aggiornare [frontend/src/features/projects/runtime/projects-client.test.ts](../frontend/src/features/projects/runtime/projects-client.test.ts) per coprire entrambi i rami capability `true` e `false` con shape JSON backend reale. Completato quando i test verificano `fetch` + fallback. |  |  |
| TASK-032 | Ticket FE-PROJ-PAGE-001: aggiornare [frontend/src/features/projects/pages/ProjectsListPage.tsx](../frontend/src/features/projects/pages/ProjectsListPage.tsx) per passare capability e gestire error/empty state live. Completato quando la pagina mostra dati backend con capability attiva. |  |  |
| TASK-033 | Ticket FE-PROJ-PAGE-002: aggiornare [frontend/src/features/projects/pages/ProjectDetailPage.tsx](../frontend/src/features/projects/pages/ProjectDetailPage.tsx) per usare il dettaglio backend e non dipendere dalla sola lista fallback. Completato quando il deep-link a un project reale funziona con capability attiva. |  |  |

### Implementation Phase 10

- GOAL-010: Fare il cutover frontend dei client artifacts.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-034 | Ticket FE-ART-CLIENT-001: aggiornare [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts) per usare le capability reali lette dal provider/runtime. Completato quando con capability `true` usa `/api/artifacts*`, con capability `false` usa `localArtifacts`. |  |  |
| TASK-035 | Ticket FE-ART-CLIENT-TEST-001: aggiornare [frontend/src/features/artifacts/runtime/artifacts-client.test.ts](../frontend/src/features/artifacts/runtime/artifacts-client.test.ts) per coprire shape backend reale, filtri e fallback. Completato quando i test verificano sia fetch sia applyQuery locale. |  |  |
| TASK-036 | Ticket FE-ART-PAGE-001: aggiornare [frontend/src/features/artifacts/pages/ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) per passare capability e rendere i filtri coerenti col backend. Completato quando la pagina mostra archive live da DB con capability attiva. |  |  |
| TASK-037 | Ticket FE-ART-PAGE-002: aggiornare [frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx](../frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx) per supportare dettaglio live e fallback locale. Completato quando il deep-link artifact funziona in entrambi i rami. |  |  |

### Implementation Phase 11

- GOAL-011: Chiudere il gap di sviluppo locale e verificare il percorso end-to-end.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-038 | Ticket FE-DEV-001: aggiornare [frontend/vite.config.ts](../frontend/vite.config.ts) per proxy `/api` verso backend locale, preservando le route SPA. Completato quando `/api/projects` e `/api/artifacts` vengono inoltrate correttamente e `/admin` rimane route client-side. |  |  |
| TASK-039 | Ticket FE-DEV-TEST-001: aggiungere copertura minima per il comportamento path/proxy tramite test o checklist manuale verificabile. Completato quando esiste una prova ripetibile che `/api/*` non rompe la SPA. |  |  |
| TASK-040 | Ticket E2E-001: eseguire validazione locale completa con backend reale: login, projects list, create project, project detail, artifacts list, artifact detail. Completato quando gli esiti sono registrati in un documento review esistente. |  |  |

### Implementation Phase 12

- GOAL-012: Completare il cutover documentale e la decisione finale sul fallback locale.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-041 | Ticket DOC-001: aggiornare [docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md) indicando che projects e artifacts usano backend live quando le capability sono attive. Completato quando la capability matrix distingue chiaramente fallback e live path. |  |  |
| TASK-042 | Ticket ENV-001: definire i valori env locali `VITE_CAP_PROJECTS=true` e `VITE_CAP_ARTIFACTS=true` e il punto di configurazione. Completato quando un developer può attivarli senza deduzioni implicite. |  |  |
| TASK-043 | Ticket GATE-001: eseguire `npm --prefix frontend run typecheck && npm --prefix frontend run test && npm run backend:go` con capability attive. Completato quando tutti i gate sono verdi. |  |  |
| TASK-044 | Ticket FE-FALLBACK-001: decidere e applicare il destino del fallback demo in [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts): mantenerlo come safe fallback o ridurlo a fallback di errore. Completato quando la decisione è riflessa nel codice e in documentazione. |  |  |

## 3. Alternatives

- **ALT-001**: Un unico ticket monolitico backend+frontend. Scartata perché rende difficile verificare regressioni locali e impedisce parallelizzazione.
- **ALT-002**: Attivare prima il frontend con capability `true` e implementare dopo il backend. Scartata perché produrrebbe errori runtime immediati.
- **ALT-003**: Fare solo endpoint backend e rimandare la propagation delle capability. Scartata perché lascerebbe il frontend ancora sul fallback locale nonostante gli endpoint esistano.
- **ALT-004**: Eliminare subito il fallback locale. Scartata perché toglie resilienza al rollout graduale e rende più fragile il dev locale.
- **ALT-005**: Estendere `AuthRepositoryBundle` con metodi query projects/artifacts. Scartata: contaminerebbe il dominio auth e richiederebbe di modificare tutti i caller esistenti.
- **ALT-006**: Aggiungere metodi read a `PostgresArtifactRepository`. Scartata: questa interfaccia è parte del contratto XState in produzione; modificarla senza necessità è rischio ingiustificato.

## 4. Dependencies

- **DEP-001**: [plan/feature-projects-artifacts-backend-frontend-gap-1.md](../plan/feature-projects-artifacts-backend-frontend-gap-1.md) come piano padre.
- **DEP-002**: [db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql) per schema `projects` e `artifacts`.
- **DEP-003**: [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) come dispatcher HTTP esistente.
- **DEP-004**: [frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts) per i path frontend già definiti.
- **DEP-005**: [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts) per le env capability già introdotte.
- **DEP-006**: [frontend/vite.config.ts](../frontend/vite.config.ts) per il proxy di sviluppo.
- **DEP-007**: `AuthHttpRuntimeOptions` in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) — bloccante; chiuso su `AuthRepositoryBundle`, deve essere esteso in Fase 0 prima di qualunque route HTTP nuova.
- **DEP-008**: `PostgresArtifactRepository` in [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts) — solo write; le interfacce read devono essere separate (Fase 0 TASK-INJECT-001).
- **DEP-009**: `Pool` Postgres in [src/lib/runtime/node-server.ts](../src/lib/runtime/node-server.ts) — già usato dagli auth repository; da riutilizzare senza duplicare connessioni (Fase 4 TASK-015).

## 5. Files

- **FILE-001**: [src/lib/types](../src/lib/types) - nuovi tipi project/artifact lato backend.
- **FILE-002**: [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts) - firme query.
- **FILE-003**: [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) - query Postgres live.
- **FILE-004**: [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts) - query stub.
- **FILE-005**: [src/lib/adapters/index.ts](../src/lib/adapters/index.ts) - export superfici.
- **FILE-006**: [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) - route `/api/projects*` e `/api/artifacts*`.
- **FILE-007**: [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) - test HTTP nuovi.
- **FILE-018**: [src/lib/adapters/auth.interfaces.ts](../src/lib/adapters/auth.interfaces.ts) - nuova interfaccia `UserQueryRepositoryBundle` (Fase 0 TASK-INJECT-002).
- **FILE-019**: `src/lib/types/projects.ts` - tipi HTTP `ProjectSummary`, `ProjectDetail`, `CreateProjectInput` e mapper DB row → payload.
- **FILE-020**: `src/lib/types/artifacts.ts` - tipi HTTP `ArtifactSummary`, `ArtifactDetail`, `ArtifactListFilters` e mapper DB row → payload.
- **FILE-008**: [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts) - lettura capability.
- **FILE-009**: [frontend/src/app/providers/AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx) - propagation capability.
- **FILE-010**: [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) - cutover projects client.
- **FILE-011**: [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts) - cutover artifacts client.
- **FILE-012**: [frontend/src/features/projects/pages/ProjectsListPage.tsx](../frontend/src/features/projects/pages/ProjectsListPage.tsx) - pagina list live.
- **FILE-013**: [frontend/src/features/projects/pages/ProjectDetailPage.tsx](../frontend/src/features/projects/pages/ProjectDetailPage.tsx) - pagina detail live.
- **FILE-014**: [frontend/src/features/artifacts/pages/ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) - archive live.
- **FILE-015**: [frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx](../frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx) - detail live.
- **FILE-016**: [frontend/vite.config.ts](../frontend/vite.config.ts) - proxy `/api`.
- **FILE-017**: [docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md) - docs cutover.

## 6. Testing

- **TEST-001**: Test unit/HTTP per i contratti backend projects.
- **TEST-002**: Test unit/HTTP per i contratti backend artifacts.
- **TEST-003**: Test repository live/stub per query projects.
- **TEST-004**: Test repository live/stub per query artifacts.
- **TEST-005**: Test frontend per propagation capability `projects` e `artifacts`.
- **TEST-006**: Test frontend per `projects-client` con capability `true` e `false`.
- **TEST-007**: Test frontend per `artifacts-client` con capability `true` e `false`.
- **TEST-008**: Validazione proxy `/api` senza regressione SPA.
- **TEST-009**: Gate frontend verde con `typecheck` e `vitest`.
- **TEST-010**: Gate backend verde con `backend:go`.
- **TEST-011**: Verifica end-to-end locale con backend reale e capability attive.
- **TEST-012**: `tsc --noEmit` verde dopo Fase 0 senza modifiche ai caller `AuthHttpRuntimeOptions` esistenti in test e `node-server.ts`.
- **TEST-013**: Test unitari per i mapper DB→HTTP projects e artifacts (funzioni pure, no I/O, veloci).

## 7. Risks & Assumptions

- **RISK-001**: La shape persistita di `artifacts` potrebbe richiedere un mapper più ricco del previsto per allinearsi a `GenerationArtifact`.
- **RISK-002**: Il repository live potrebbe non avere ancora un punto di estensione chiaro per query read-only e richiedere refactoring preliminare.
- **RISK-003**: Un proxy `/api` troppo ampio può interferire con route SPA o con future route frontend se non verificato bene.
- **RISK-004**: Il fallback locale projects può mascherare errori backend se il ramo capability `true` non viene effettivamente testato.
- **RISK-005** ⚠️ **Bloccante verificato**: `AuthHttpRuntimeOptions` non ha injection point per repository query. Fase 0 è prerequisito non saltabile; le Fasi 5-6 non compilano senza di essa.
- **RISK-006** ⚠️ **Bloccante verificato**: `PostgresArtifactRepository` ha solo metodi write; estenderla con read altera il contratto XState. Fase 0 TASK-INJECT-001 separa le due superfici in interfacce distinte.
- **RISK-007**: Il wiring in `node-server.ts` (TASK-015) richiede accesso al `Pool` Postgres già usato dagli auth repository. Verificare che sia condivisibile nella stessa factory function senza duplicare connessioni.
- **ASSUMPTION-001**: Il backend continuerà a centralizzare l’HTTP in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts).
- **ASSUMPTION-002**: Le capability env sono il meccanismo di rollout graduale desiderato.
- **ASSUMPTION-003**: I seed esistenti sono sufficienti per una prima verifica locale di projects e artifacts oppure possono essere estesi senza nuove migration strutturali.
- **ASSUMPTION-004**: Le macchine XState di generazione non richiedono modifiche; tutti gli endpoint sono CRUD sincroni gestiti fuori dal sistema actor.

## 8. Related Specifications / Further Reading

[plan/feature-projects-artifacts-backend-frontend-gap-1.md](../plan/feature-projects-artifacts-backend-frontend-gap-1.md)
[plan/feature-frontend-ux-sprints-1.md](../plan/feature-frontend-ux-sprints-1.md)
[docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md)
[frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts)
[src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts)