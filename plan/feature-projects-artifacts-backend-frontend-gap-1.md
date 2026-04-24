---
goal: Chiudere il gap backend/frontend per projects e artifacts con dati persistiti da DB
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-25
owner: Backend Platform + Frontend Platform
status: 'Completed'
tags: [feature, backend, frontend, migration, projects, artifacts, api, persistence]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano definisce le attività necessarie per sostituire i fallback locali frontend di projects e artifacts con dati persistiti in Postgres, esposti tramite endpoint backend dedicati e consumati dal frontend tramite capability runtime realmente abilitate.

## 0. Execution Snapshot (2026-04-24)

Stato aggiornato agli interventi implementati nel branch corrente.

### Completato (codice implementato)

- Backend contracts e injection:
	- tipi e mapper aggiunti in [src/lib/types/projects.ts](../src/lib/types/projects.ts) e [src/lib/types/artifacts.ts](../src/lib/types/artifacts.ts)
	- interfacce query separate aggiunte in [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts)
	- `UserQueryRepositoryBundle` introdotto in [src/lib/adapters/auth.interfaces.ts](../src/lib/adapters/auth.interfaces.ts)
	- export aggiornati in [src/lib/adapters/index.ts](../src/lib/adapters/index.ts)
- Backend repositories e route HTTP:
	- query Postgres/stub implementate in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) e [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts)
	- route autenticate `/api/projects*` e `/api/artifacts*` aggiunte in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts)
	- wiring query repositories aggiunto in [src/server.ts](../src/server.ts)
	- test HTTP estesi in [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts)
	- test mapper aggiunti in [src/lib/tests/runtime.query-mappers.test.ts](../src/lib/tests/runtime.query-mappers.test.ts)
- Frontend capability/cutover:
	- capabilities propagate nel provider in [frontend/src/app/providers/AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx)
	- client projects/artifacts allineati a payload `{ ok, data }` in [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) e [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts)
	- pages consumer aggiornate per passare capabilities (projects/artifacts)
	- proxy `/api` aggiunto in [frontend/vite.config.ts](../frontend/vite.config.ts)
	- test frontend aggiornati per branch capability `true/false`

### Chiusura registrata (2026-04-25)

- Gate eseguiti e verificati in questo ciclo:
	- `npm --prefix frontend run typecheck` -> verde
	- `npm --prefix frontend run test` -> verde
	- `npm run backend:go` -> verde (incluso nuovo smoke `smoke:queries`)
- Verifica end-to-end locale registrata (HTTP autenticato):
	- `POST /auth/login` -> `200`
	- `GET /api/projects` -> `200`
	- `POST /api/projects` -> `201`
	- `GET /api/artifacts?status=completed` -> `200`
- Decisione fallback consolidata:
	- fallback projects ridotto a lista vuota quando `VITE_CAP_PROJECTS=false` (nessun mock visibile)
	- path live prioritario quando capability projects/artifacts sono abilitate

Conferma funzionale frontend registrata:
	- con capability attive, list projects e create project da UI operativi su backend live

## 1. Requirements & Constraints

- **REQ-001**: Esporre endpoint backend autenticati `GET/POST /api/projects`, `GET /api/projects/:id`, `GET /api/artifacts`, `GET /api/artifacts/:id` senza regressioni sulle route già attive (`/auth/*`, `/generation/stream`, `/admin/users`).
- **REQ-002**: Leggere i dati di projects e artifacts dal DB Postgres esistente, usando le tabelle `projects` e `artifacts` già presenti in [db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql).
- **REQ-003**: Limitare tutte le query ai dati dell’utente autenticato; un utente non deve poter leggere projects o artifacts di altri utenti.
- **REQ-004**: Mantenere il fallback frontend deterministico finché gli endpoint non sono disponibili o le capability non sono attivate esplicitamente.
- **REQ-005**: Abilitare il frontend a leggere realmente le env `VITE_CAP_PROJECTS` e `VITE_CAP_ARTIFACTS`, oggi definite ma non consumate dai page/client consumer.
- **REQ-006**: Aggiungere proxy dev per `/api/*` in [frontend/vite.config.ts](../frontend/vite.config.ts) senza rompere la navigazione SPA diretta.
- **REQ-007**: Definire payload JSON stabili e compatibili con i tipi frontend esistenti in [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) e [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts).
- **SEC-001**: Tutti gli endpoint `/api/projects*` e `/api/artifacts*` devono richiedere sessione autenticata e usare `credentials: 'include'` lato frontend.
- **SEC-002**: Gli endpoint di lettura devono filtrare per `user_id` a livello backend; il filtro lato frontend non è sufficiente.
- **SEC-003**: Il backend deve restituire status code coerenti: `401` per sessione assente, `403` solo quando previsto, `404` per risorsa inesistente o non visibile all’utente, `400` per filtri invalidi.
- **CON-001**: Nessuna modifica distruttiva allo schema DB; la persistenza base esiste già.
- **CON-002**: Nessuna regressione sui test backend esistenti in [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) e [src/lib/tests/runtime.node-server.test.ts](../src/lib/tests/runtime.node-server.test.ts).
- **CON-003**: Il frontend deve continuare a funzionare in assenza degli endpoint `/api/*` finché le capability sono `false`.
- **GUD-001**: Ogni nuova superficie backend deve avere test HTTP dedicati e test repository/query dedicati o smoke equivalenti.
- **GUD-002**: Il cutover deve essere graduale: prima backend e proxy, poi capability wiring, poi attivazione env.
- **PAT-001**: Riutilizzare il dispatcher HTTP esistente in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) invece di introdurre un secondo router parallelo.
- **PAT-002**: Riutilizzare gli adapter Postgres esistenti in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) estendendoli con metodi di query, invece di aggiungere accesso SQL sparso nei handler HTTP.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Definire il contratto backend/frontend e introdurre le superfici di query mancanti sugli adapter di persistenza.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Aggiungere tipi condivisi backend per `ProjectSummary`, `ProjectDetail`, `ArtifactListItem`, `ArtifactDetail`, `ProjectListFilters`, `ArtifactListFilters` in un file dedicato sotto `src/lib/types/` oppure estendere i tipi esistenti già usati da [src/lib/adapters/generation.adapters.ts](../src/lib/adapters/generation.adapters.ts). |  |  |
| TASK-002 | Estendere le interfacce exportate in [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts) con metodi di query per projects e artifacts: `listProjectsByUser`, `getProjectByIdForUser`, `createProjectForUser`, `listArtifactsByUser`, `getArtifactByIdForUser`. |  |  |
| TASK-003 | Aggiornare [src/lib/adapters/index.ts](../src/lib/adapters/index.ts) per esportare le nuove interfacce/repository query necessarie al runtime HTTP. |  |  |
| TASK-004 | Definire la shape JSON di risposta per gli endpoint `/api/projects*` e `/api/artifacts*` in modo esplicito: projects come array/oggetto piatto con `id`, `name`, `description`, `updatedAt`; artifacts come shape compatibile con `GenerationArtifact` lato frontend. |  |  |

### Implementation Phase 2

- GOAL-002: Implementare query persistite Postgres per projects e artifacts, con filtro per utente autenticato.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-005 | Implementare i metodi `listProjectsByUser`, `getProjectByIdForUser`, `createProjectForUser` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts), usando la tabella `projects` e restituendo record già mappati verso il contratto HTTP. |  |  |
| TASK-006 | Implementare i metodi `listArtifactsByUser` e `getArtifactByIdForUser` in [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts), con supporto ai filtri `type`, `status`, `projectId`, `from`, `to`. |  |  |
| TASK-007 | Estendere lo stub repository in [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts) con gli stessi metodi di query, così da mantenere test e fallback backend coerenti. |  |  |
| TASK-008 | Se i repository auth/runtime non hanno un punto di composizione adeguato, introdurre un bundle repository HTTP condiviso che includa auth repositories e query repositories projects/artifacts, mantenendo la composizione esistente usata da [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts). |  |  |

### Implementation Phase 3

- GOAL-003: Esporre endpoint HTTP autenticati `/api/projects*` e `/api/artifacts*` nel backend esistente.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-009 | In [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts), aggiungere route match per `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id` usando lo stesso dispatcher che oggi gestisce `/admin/users`. |  |  |
| TASK-010 | Implementare helper `requireSessionPrincipal` oppure riusare il path di autenticazione esistente per proteggere `/api/projects*` e `/api/artifacts*` senza richiedere ruolo admin. |  |  |
| TASK-011 | In [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts), aggiungere route match per `GET /api/artifacts` e `GET /api/artifacts/:id`, con validazione querystring e mapping filtri verso repository. |  |  |
| TASK-012 | Restituire `404` per project o artifact non trovato o non appartenente all’utente, invece di leakare esistenza di record altrui. |  |  |
| TASK-013 | Verificare che [src/server.ts](../src/server.ts) e [src/lib/runtime/node-server.ts](../src/lib/runtime/node-server.ts) non richiedano ulteriori modifiche di wiring oltre al router HTTP già in uso. |  |  |

### Implementation Phase 4

- GOAL-004: Coprire il nuovo backend con test automatici e convalide dei contratti JSON.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-014 | Aggiungere test HTTP in [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) per `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`, incluse condizioni `401`, `404`, filtro per utente e shape payload. |  |  |
| TASK-015 | Aggiungere test HTTP in [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) per `GET /api/artifacts` e `GET /api/artifacts/:id`, inclusi filtri combinati e visibilità limitata all’utente. |  |  |
| TASK-016 | Aggiungere test repository/query su [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) oppure smoke dedicati che verifichino lettura da DB reale per projects e artifacts. |  |  |
| TASK-017 | Aggiornare il gate `npm run backend:go` se necessario per includere i nuovi test senza introdurre dipendenze manuali aggiuntive. |  |  |

### Implementation Phase 5

- GOAL-005: Collegare il frontend alle capability runtime reali e attivare il consumo degli endpoint backend quando disponibili.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-018 | Introdurre un punto unico di lettura capability in [frontend/src/app/providers/AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx) oppure in un nuovo provider runtime, usando `readBackendCapabilities()` da [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts). |  |  |
| TASK-019 | Aggiornare [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) per ricevere capability dal provider/runtime e non affidarsi solo a `resolveBackendCapabilities({})`, così da usare `/api/projects*` quando `VITE_CAP_PROJECTS=true`. |  |  |
| TASK-020 | Aggiornare [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts) con la stessa strategia, così da usare `/api/artifacts*` quando `VITE_CAP_ARTIFACTS=true`. |  |  |
| TASK-021 | Allineare le pagine consumer [frontend/src/features/projects/pages/ProjectsListPage.tsx](../frontend/src/features/projects/pages/ProjectsListPage.tsx), [frontend/src/features/projects/pages/ProjectDetailPage.tsx](../frontend/src/features/projects/pages/ProjectDetailPage.tsx), [frontend/src/features/artifacts/pages/ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) e [frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx](../frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx) per passare capability e gestire gli stati empty/error live. |  |  |
| TASK-022 | Aggiornare [frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts) solo se la shape finale degli endpoint richiede varianti aggiuntive; non cambiare i path se non necessario. |  |  |

### Implementation Phase 6

- GOAL-006: Abilitare il percorso end-to-end in sviluppo locale e verificare il cutover frontend su backend reale.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-023 | Estendere il proxy dev in [frontend/vite.config.ts](../frontend/vite.config.ts) con `/api` verso il backend, preservando la route SPA `/admin` e le altre route client-side. |  |  |
| TASK-024 | Aggiungere test frontend nei client [frontend/src/features/projects/runtime/projects-client.test.ts](../frontend/src/features/projects/runtime/projects-client.test.ts) e [frontend/src/features/artifacts/runtime/artifacts-client.test.ts](../frontend/src/features/artifacts/runtime/artifacts-client.test.ts) per coprire il ramo capability `true` con shape JSON reale del backend. |  |  |
| TASK-025 | Eseguire verifica manuale locale: login, projects list da DB, creazione project persistita, project detail, artifacts archive da DB, artifact detail da DB. Registrare gli esiti nel documento di review già esistente o in quello di sprint corrente. |  |  |

### Implementation Phase 7

- GOAL-007: Fare il cutover controllato da fallback locale a backend reale senza regressioni funzionali.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-026 | Definire i valori env locali `VITE_CAP_PROJECTS=true` e `VITE_CAP_ARTIFACTS=true` e documentare dove abilitarli (`frontend/.env.local` o equivalente). |  |  |
| TASK-027 | Aggiornare la documentazione funzionale in [docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md) indicando che projects e artifacts passano da fallback locale a backend live quando le capability sono attive. |  |  |
| TASK-028 | Eseguire il gate completo `npm --prefix frontend run typecheck && npm --prefix frontend run test && npm run backend:go` con capability attive e backend locale avviato. |  |  |
| TASK-029 | Rimuovere o relegare a fallback secondario i dati demo locali in [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) solo dopo aver validato stabilmente gli endpoint backend in locale e CI. |  |  |

## 3. Alternatives

- **ALT-001**: Lasciare projects e artifacts in fallback locale permanente. Scartata perché non soddisfa l’obiettivo di usare dati persistiti dal DB.
- **ALT-002**: Esportare nuovi endpoint su `/projects` e `/artifacts` anziché `/api/projects` e `/api/artifacts`. Scartata perché il frontend ha già un contratto predisposto in [frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts).
- **ALT-003**: Far leggere il DB direttamente dal frontend tramite un SDK o accesso diretto. Scartata per ragioni di sicurezza e perché romperebbe il modello di sessione server-side già esistente.
- **ALT-004**: Attivare subito `VITE_CAP_PROJECTS` e `VITE_CAP_ARTIFACTS` senza endpoint backend. Scartata perché produrrebbe errori runtime immediati e non chiuderebbe il gap reale.

## 4. Dependencies

- **DEP-001**: Tabelle `projects` e `artifacts` già presenti in [db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql).
- **DEP-002**: Dispatcher HTTP esistente in [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts).
- **DEP-003**: Path frontend già definiti in [frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts).
- **DEP-004**: Capability env già definite in [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts), ma non ancora propagate ai consumer.
- **DEP-005**: Proxy dev attuale in [frontend/vite.config.ts](../frontend/vite.config.ts), da estendere con `/api`.
- **DEP-006**: Seed locale utenti/progetti in [db/seeds/20260424_000001_minimal_users_projects.sql](../db/seeds/20260424_000001_minimal_users_projects.sql).

## 5. Files

- **FILE-001**: [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) - aggiunta route `/api/projects*` e `/api/artifacts*`.
- **FILE-002**: [src/lib/adapters/postgres-redis.interfaces.ts](../src/lib/adapters/postgres-redis.interfaces.ts) - nuove interfacce query projects/artifacts.
- **FILE-003**: [src/lib/adapters/postgres-redis.production.ts](../src/lib/adapters/postgres-redis.production.ts) - implementazione query Postgres per projects/artifacts.
- **FILE-004**: [src/lib/adapters/postgres-redis.stub.ts](../src/lib/adapters/postgres-redis.stub.ts) - implementazione stub query per test.
- **FILE-005**: [src/lib/adapters/index.ts](../src/lib/adapters/index.ts) - export nuove interfacce/repository.
- **FILE-006**: [src/lib/tests/runtime.auth-http.test.ts](../src/lib/tests/runtime.auth-http.test.ts) - test endpoint nuovi.
- **FILE-007**: [src/server.ts](../src/server.ts) - eventuale wiring finale se richiesto dal router HTTP.
- **FILE-008**: [frontend/src/app/runtime/backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts) - fonte capability runtime.
- **FILE-009**: [frontend/src/app/providers/AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx) - possibile provider capability/sessione unificato.
- **FILE-010**: [frontend/src/features/projects/runtime/projects-client.ts](../frontend/src/features/projects/runtime/projects-client.ts) - cutover verso backend live.
- **FILE-011**: [frontend/src/features/artifacts/runtime/artifacts-client.ts](../frontend/src/features/artifacts/runtime/artifacts-client.ts) - cutover verso backend live.
- **FILE-012**: [frontend/src/features/projects/pages/ProjectsListPage.tsx](../frontend/src/features/projects/pages/ProjectsListPage.tsx) - consumo dati DB lato frontend.
- **FILE-013**: [frontend/src/features/projects/pages/ProjectDetailPage.tsx](../frontend/src/features/projects/pages/ProjectDetailPage.tsx) - dettaglio project da backend.
- **FILE-014**: [frontend/src/features/artifacts/pages/ArtifactsPage.tsx](../frontend/src/features/artifacts/pages/ArtifactsPage.tsx) - archivio live da backend.
- **FILE-015**: [frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx](../frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx) - dettaglio live da backend.
- **FILE-016**: [frontend/vite.config.ts](../frontend/vite.config.ts) - proxy `/api`.
- **FILE-017**: [docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md) - aggiornamento capability matrix e stato cutover.

## 6. Testing

- **TEST-001**: `GET /api/projects` restituisce solo projects dell’utente autenticato.
- **TEST-002**: `POST /api/projects` crea un project persistito e lo restituisce con `id` e `updatedAt` valorizzati.
- **TEST-003**: `GET /api/projects/:id` restituisce `404` per project assente o appartenente ad altro utente.
- **TEST-004**: `GET /api/artifacts` supporta filtri `type`, `status`, `projectId`, `from`, `to` e restituisce solo artifacts dell’utente autenticato.
- **TEST-005**: `GET /api/artifacts/:id` restituisce `404` per artifact assente o non autorizzato.
- **TEST-006**: I repository Postgres per projects e artifacts leggono dal DB reale con mapping corretto verso il contratto HTTP.
- **TEST-007**: I client frontend `projects-client` e `artifacts-client` chiamano `/api/*` quando le capability sono `true` e mantengono il fallback quando sono `false`.
- **TEST-008**: Il proxy Vite inoltra `/api/*` al backend senza rompere la navigazione diretta alle route SPA.
- **TEST-009**: Gate frontend `npm --prefix frontend run typecheck && npm --prefix frontend run test` verde con capability sia `false` sia `true` nei test mirati.
- **TEST-010**: Gate backend `npm run backend:go` verde dopo l’introduzione dei nuovi endpoint.
- **TEST-011**: Verifica manuale end-to-end locale con sessione reale: login, projects list, create project, project detail, artifacts list, artifact detail.

## 7. Risks & Assumptions

- **RISK-001**: L’adapter artifacts esistente potrebbe coprire solo write/finalization e richiedere nuovi metodi read/query non ancora modellati.
- **RISK-002**: La shape `GenerationArtifact` lato frontend potrebbe non coincidere 1:1 con la shape persistita nel DB e richiedere un mapper dedicato nel backend.
- **RISK-003**: Abilitare troppo presto le capability frontend potrebbe mascherare errori backend con regressioni UX immediate.
- **RISK-004**: L’aggiunta del proxy `/api` in sviluppo potrebbe intercettare route indesiderate se configurata troppo genericamente senza tenere conto della SPA.
- **ASSUMPTION-001**: Il backend continuerà a usare [src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts) come superficie centrale delle route autenticate.
- **ASSUMPTION-002**: Le tabelle `projects` e `artifacts` restano lo storage source-of-truth per la lettura frontend.
- **ASSUMPTION-003**: Le capability `VITE_CAP_PROJECTS` e `VITE_CAP_ARTIFACTS` sono il meccanismo corretto per il cutover graduale.

## 8. Related Specifications / Further Reading

[docs/specifications/frontend-spec.md](../docs/specifications/frontend-spec.md)
[plan/feature-frontend-ux-sprints-1.md](../plan/feature-frontend-ux-sprints-1.md)
[db/migrations/20260424_000001_generation_adapters_minimal.sql](../db/migrations/20260424_000001_generation_adapters_minimal.sql)
[frontend/src/app/runtime/api-paths.ts](../frontend/src/app/runtime/api-paths.ts)
[src/lib/runtime/auth-http.ts](../src/lib/runtime/auth-http.ts)