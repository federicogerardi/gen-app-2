---
status: archived
version: 1.0
last-reviewed: 2026-04-27
next-review-date: null
owner: Frontend Platform Team
title: Refactor Frontend Deterministic Unification Plan (Archived)
date-archived: 2026-04-27
original-path: plan/refactor-frontend-deterministic-unification-1.md
tags: [refactor, frontend, architecture, deterministic]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano definisce un intervento deterministico sul codice frontend per unificare il layer HTTP, centralizzare gli endpoint, ridurre boilerplate nelle pagine e consolidare i wrapper tool, mantenendo invariato il comportamento funzionale osservabile.

## Sprint Execution Model

Cadence sprint:

- Sprint duration: 5 giorni lavorativi
- Deployment mode: PR piccole e sequenziali
- Merge gate: typecheck + test + smoke checklist per sprint

Sprint backlog (deterministico):

| Sprint | Window | Goal | Task IDs |
| ------ | ------ | ---- | -------- |
| S1 | 2026-04-27 -> 2026-05-01 | Baseline e compatibilita contratti | TASK-001, TASK-002, TASK-003 |
| S2 | 2026-05-04 -> 2026-05-08 | HTTP core unification | TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009 |
| S3 | 2026-05-11 -> 2026-05-15 | Endpoint registry consolidation | TASK-010, TASK-011, TASK-012, TASK-013 |
| S4 | 2026-05-18 -> 2026-05-22 | Query hooks e migrazione pagine | TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020 |
| S5 | 2026-05-25 -> 2026-05-29 | Tool wrapper consolidation | TASK-021, TASK-022, TASK-023, TASK-024, TASK-025 |
| S6 | 2026-06-01 -> 2026-06-05 | Hardening e closure | TASK-026, TASK-027, TASK-028, TASK-029 |

Definition of Done per sprint:

- Tutti i task dello sprint marcati completati.
- Nessun errore typecheck su frontend.
- Test frontend verdi per area toccata.
- Delta metriche aggiornato nel piano.

## 1. Requirements & Constraints

- **REQ-001**: Implementare un modulo unico HTTP in frontend/src/app/runtime/http-client.ts con funzioni joinApiPath, requestJson e requestVoid.
- **REQ-002**: Eliminare ogni implementazione locale di joinApiPath dai client feature presenti in frontend/src/features/**/runtime/*.ts.
- **REQ-003**: Centralizzare tutti gli endpoint in frontend/src/app/runtime/api-paths.ts, inclusi endpoint admin.
- **REQ-004**: Introdurre un client dedicato frontend/src/features/admin/runtime/admin-client.ts e rimuovere fetch hardcoded dalle pagine admin.
- **REQ-005**: Introdurre hook query condivisi in frontend/src/app/runtime/queries/ per list/detail di projects e artifacts.
- **REQ-006**: Consolidare il parsing query per pagine tool in frontend/src/features/tools/runtime/tool-entry-params.ts.
- **REQ-007**: Mantenere invariate le API pubbliche esportate dai client attuali (nomi funzioni e shape output).
- **SEC-001**: Non loggare dati sensibili o payload completi contenenti input utente; log solo codice errore e route.
- **SEC-002**: Conservare credentials include per tutte le richieste autenticate.
- **CON-001**: Non introdurre dipendenze esterne di data fetching (React Query/SWR) in questo intervento.
- **CON-002**: Non modificare contratti backend o percorsi API esistenti.
- **CON-003**: Non modificare state machine stream in frontend/src/features/generation/machines/frontend-stream.machine.ts.
- **GUD-001**: Ogni migrazione deve essere file-by-file con test passante prima del task successivo.
- **PAT-001**: Separazione responsabilita: transport HTTP in app/runtime, feature clients in features/*/runtime, orchestration UI in pages.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Stabilire baseline tecnica e contratti di compatibilita.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Catalogare i punti di duplicazione verificati in frontend/src/features/auth/runtime/auth-client.ts, frontend/src/features/projects/runtime/projects-client.ts, frontend/src/features/artifacts/runtime/artifacts-client.ts, frontend/src/features/tools/runtime/tools-client.ts e frontend/src/features/generation/runtime/generation-client.ts. | ✅ | 2026-04-27 |
| TASK-002 | Definire tabella di compatibilita input/output per funzioni pubbliche: loginWithPassword, readSession, logoutSession, listProjects, getProjectById, createProject, listArtifacts, getArtifactById, uploadBrief, runExtraction, streamGeneration. | ✅ | 2026-04-27 |
| TASK-003 | Registrare baseline metrica iniziale: count joinApiPath locali, count fetch hardcoded nelle pagine, count pattern useEffect+IIFE duplicati. | ✅ | 2026-04-27 |

Completion Criteria:
- Baseline documentata con valori numerici verificabili.
- Tabella compatibilita pubblicata e approvata.

Sprint 1 evidence (2026-04-27):

- Baseline metriche iniziali:
	- joinApiPath locali nei runtime client: 5
	- fetch hardcoded nelle pagine feature: 1 (AdminUsersPage)
	- pattern useEffect + IIFE async nelle pagine target: 6
- Copertura test esistente area runtime/pagine (conteggio file): 15 test file frontend/src/features/**/*.{test.ts,test.tsx}

Tabella compatibilita I/O funzioni pubbliche (stato pre-refactor):

| Function | Input Contract | Output Contract | Test Coverage Status |
| -------- | -------------- | --------------- | -------------------- |
| loginWithPassword | (email: string, password: string, options?) | Promise<AuthSession> | Missing dedicated test |
| readSession | (options?) | Promise<AuthSession \| null> | Missing dedicated test |
| logoutSession | (options?) | Promise<void> | Missing dedicated test |
| listProjects | (options?) | Promise<ProjectSummary[]> | Covered in projects-client.test.ts |
| getProjectById | (id: string, options?) | Promise<ProjectSummary \| null> | Covered in projects-client.test.ts |
| createProject | (input, options?) | Promise<ProjectSummary> | Missing dedicated test |
| listArtifacts | (filters, options?) | Promise<GenerationArtifact[]> | Covered in artifacts-client.test.ts |
| getArtifactById | (id: string, options?) | Promise<GenerationArtifact \| null> | Covered in artifacts-client.test.ts |
| uploadBrief | (input, options?) | Promise<UploadBriefResult> | Covered in tools-client.test.ts |
| runExtraction | (input, options?) | Promise<RunExtractionResult> | Covered in tools-client.test.ts |
| streamGeneration | (request, options) | Promise<void> | Indirectly covered via tools-client.test.ts mock integration |

Sprint 1 status:

- Planned outcome: achieved
- Sprint gate: passed (baseline evidence produced)

### Implementation Phase 2

- **GOAL-002**: Implementare layer HTTP unico e migrare i client runtime senza regressioni funzionali.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-004 | Creare frontend/src/app/runtime/http-client.ts con type HttpClientError { code, status, message, retryable } e funzioni joinApiPath(baseUrl, path), requestJson<T>(url, init), requestVoid(url, init). | ✅ | 2026-04-27 |
| TASK-005 | Migrare frontend/src/features/auth/runtime/auth-client.ts per usare requestJson/requestVoid mantenendo identico contract esterno e messaggi errore utente. | ✅ | 2026-04-27 |
| TASK-006 | Migrare frontend/src/features/projects/runtime/projects-client.ts per usare http-client.ts e rimuovere joinApiPath locale. | ✅ | 2026-04-27 |
| TASK-007 | Migrare frontend/src/features/artifacts/runtime/artifacts-client.ts per usare http-client.ts e rimuovere joinApiPath locale. | ✅ | 2026-04-27 |
| TASK-008 | Migrare frontend/src/features/tools/runtime/tools-client.ts per usare http-client.ts e rimuovere joinApiPath locale. | ✅ | 2026-04-27 |
| TASK-009 | Migrare frontend/src/features/generation/runtime/generation-client.ts per usare joinApiPath da http-client.ts, preservando GenerationTransportError e semantica stream. | ✅ | 2026-04-27 |

Completion Criteria:
- Occorrenze di "const joinApiPath" nei feature client ridotte a zero.
- Typecheck frontend verde.
- Test unitari runtime client verdi.

Sprint 2 evidence (2026-04-27):

- Occorrenze "const joinApiPath" nei runtime client feature: 0
- Gate eseguiti:
	- npm --prefix frontend run typecheck: PASS
	- npm --prefix frontend run test: PASS (17 file test, 99 test)

Sprint 2 status:

- Planned outcome: achieved
- Sprint gate: passed (code + quality gates)

### Implementation Phase 3

- **GOAL-003**: Consolidare endpoint registry e rimuovere hardcoded path dalle pagine.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-010 | Estendere frontend/src/app/runtime/api-paths.ts aggiungendo admin.users, admin.userById, admin.models, admin.activity con capability gating coerente. | ✅ | 2026-04-27 |
| TASK-011 | Creare frontend/src/features/admin/runtime/admin-client.ts con funzioni listAdminUsers, getAdminUserById, listAdminModels, listAdminActivity basate su api-paths.ts + http-client.ts. | ✅ | 2026-04-27 |
| TASK-012 | Modificare frontend/src/features/admin/pages/AdminUsersPage.tsx rimuovendo fetch diretto e usando admin-client.ts. | ✅ | 2026-04-27 |
| TASK-013 | Verificare che nessuna pagina in frontend/src/features/**/pages/*.tsx contenga URL hardcoded che iniziano con /admin, /api, /auth, /generation. | ✅ | 2026-04-27 |

Completion Criteria:
- Endpoint hardcoded nelle pagine target ridotti a zero.
- AdminUsersPage allineata ai client runtime.

Sprint 3 evidence (2026-04-27):

- Endpoint registry esteso con admin.activity.
- Nuovo runtime admin-client introdotto e usato da AdminUsersPage.
- Verifica hardcoded URL:
	- Produzione pages (*.tsx non test): 0 endpoint hardcoded con prefisso /admin, /api, /auth, /generation.
	- Test pages (*.test.tsx): presenti mock MSW su /admin/users (atteso).
- Gate eseguiti:
	- npm --prefix frontend run typecheck: PASS
	- npm --prefix frontend run test: PASS (17 file test, 99 test)

Sprint 3 status:

- Planned outcome: achieved
- Sprint gate: passed (code + quality gates)

### Implementation Phase 4

- **GOAL-004**: Unificare pattern query list/detail in hook condivisi e ridurre boilerplate pagine.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-014 | Creare frontend/src/app/runtime/queries/useProjectsQuery.ts con stato { data, loading, error, reload } e supporto cancel tramite flag locale. | ✅ | 2026-04-27 |
| TASK-015 | Creare frontend/src/app/runtime/queries/useProjectDetailQuery.ts con input projectId e output tipato ProjectSummary | null. | ✅ | 2026-04-27 |
| TASK-016 | Creare frontend/src/app/runtime/queries/useArtifactsQuery.ts con input ArtifactQuery e output GenerationArtifact[]. | ✅ | 2026-04-27 |
| TASK-017 | Creare frontend/src/app/runtime/queries/useArtifactDetailQuery.ts con input artifactId e output GenerationArtifact | null. | ✅ | 2026-04-27 |
| TASK-018 | Migrare frontend/src/features/projects/pages/ProjectsListPage.tsx e frontend/src/features/projects/pages/ProjectDetailPage.tsx ai nuovi hook query. | ✅ | 2026-04-27 |
| TASK-019 | Migrare frontend/src/features/artifacts/pages/ArtifactsPage.tsx e frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx ai nuovi hook query. | ✅ | 2026-04-27 |
| TASK-020 | Migrare frontend/src/features/admin/pages/AdminUsersPage.tsx al medesimo pattern query shared (loading/error/empty). | ✅ | 2026-04-27 |

Completion Criteria:
- Riduzione minima del 40% dei blocchi useEffect+IIFE nelle pagine migrate.
- Rendering stati loading/error/empty uniforme nelle pagine list/detail migrate.

Sprint 4 evidence (2026-04-27):

- Hook query aggiunti:
	- useProjectsQuery
	- useProjectDetailQuery
	- useArtifactsQuery
	- useArtifactDetailQuery
	- useAdminUsersQuery
- Pagine migrate al pattern shared query:
	- ProjectsListPage
	- ProjectDetailPage
	- ArtifactsPage
	- ArtifactDetailPage
	- AdminUsersPage
- Delta metrica useEffect+IIFE nelle pagine target:
	- baseline: 6
	- attuale: 1 (solo GenerationConsolePage)
	- riduzione: 83.3%
- Gate eseguiti:
	- npm --prefix frontend run typecheck: PASS
	- npm --prefix frontend run test: PASS (17 file test, 99 test)

Sprint 4 status:

- Planned outcome: achieved
- Sprint gate: passed (code + quality gates)

### Implementation Phase 5

- **GOAL-005**: Consolidare wrapper tool pages con parser query condiviso.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-021 | Creare frontend/src/features/tools/runtime/tool-entry-params.ts con funzioni parseToolIntent(value) e parseOptionalString(value). | ✅ | 2026-04-27 |
| TASK-022 | Esportare funzione parseToolEntryParams(searchParams) che restituisce shape normalizzata: intent, sourceArtifactId, initialProjectId, relaunchTone, relaunchNotes, relaunchFromArtifactId, briefingId, briefingFileName. | ✅ | 2026-04-27 |
| TASK-023 | Migrare frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx al parser condiviso. | ✅ | 2026-04-27 |
| TASK-024 | Migrare frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx al parser condiviso. | ✅ | 2026-04-27 |
| TASK-025 | Aggiungere test unitari parser in frontend/src/features/tools/runtime/tool-entry-params.test.ts. | ✅ | 2026-04-27 |

Completion Criteria:
- Duplicazione readIntent/readOptional nei wrapper tool ridotta a zero.
- Test parser query verdi con casi null/empty/trim/resume/regenerate.

Sprint 5 evidence (2026-04-27):

- Parser shared introdotto: tool-entry-params.ts.
- Wrapper migrati: FunnelPagesToolPage e NextlandToolPage.
- Test parser dedicati introdotti: tool-entry-params.test.ts (6 test).
- Gate eseguiti:
	- npm --prefix frontend run typecheck: PASS
	- npm --prefix frontend run test -- src/features/tools/runtime/tool-entry-params.test.ts: PASS
	- npm --prefix frontend run test: PASS (18 file test, 105 test)

Sprint 5 status:

- Planned outcome: achieved
- Sprint gate: passed (code + quality gates)

### Implementation Phase 6

- **GOAL-006**: Hardening, verifica automatica e chiusura rollout.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-026 | Eseguire npm --prefix frontend run typecheck e bloccare merge se fallisce. | ✅ | 2026-04-27 |
| TASK-027 | Eseguire npm --prefix frontend run test e bloccare merge se fallisce. | ✅ | 2026-04-27 |
| TASK-028 | Eseguire smoke checklist su route: /dashboard, /dashboard/projects, /dashboard/projects/:id, /artifacts, /artifacts/:id, /admin, /tools/funnel-pages, /tools/nextland. | ✅ | 2026-04-27 |
| TASK-029 | Registrare metriche finali M1-M4 e confronto baseline/finale nel documento di chiusura. | ✅ | 2026-04-27 |

Completion Criteria:
- Typecheck e test suite verdi.
- Smoke route completata senza regressioni bloccanti.
- Metriche finali pubblicate con delta numerico.

Sprint 6 evidence (2026-04-27):

- TASK-026: PASS (typecheck frontend)
- TASK-027: PASS (test frontend, 18 file test, 105 test)
- TASK-028: PASS (smoke route HTTP 200)
	- /dashboard -> 200
	- /dashboard/projects -> 200
	- /dashboard/projects/seed-smoke -> 200
	- /artifacts -> 200
	- /artifacts/seed-artifact -> 200
	- /admin -> 200
	- /tools/funnel-pages -> 200
	- /tools/nextland -> 200
- TASK-029: completato con confronto baseline/finale

Metriche finali M1-M4:

- M1 (helper URL locali): 5 -> 0
- M2 (fetch hardcoded nelle pagine): 1 -> 0
- M3 (useEffect + IIFE nelle pagine target): 6 -> 1 (riduzione 83.3%)
- M4 (failure rate test frontend): invariato/migliorato (baseline 99 pass, finale 105 pass)

Sprint 6 status:

- Planned outcome: achieved
- Sprint gate: passed (quality gates + smoke routes)

## 3. Alternatives

- **ALT-001**: Migrare direttamente a React Query per tutte le pagine; non scelto per vincolo CON-001 e impatto dimensionale non necessario in questa fase.
- **ALT-002**: Refactor monolitico in un singolo PR; non scelto per rischio regressione e scarsa isolabilita difetti.
- **ALT-003**: Limitarsi a deduplicazione joinApiPath senza query hooks; non scelto perche non risolve duplicazione page-level e uniformita stati UI.

## 4. Dependencies

- **DEP-001**: frontend/src/app/runtime/api-paths.ts come registry endpoint.
- **DEP-002**: frontend/src/app/runtime/backend-capabilities.ts per capability gating.
- **DEP-003**: frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx per fallback artifacts in query hooks.
- **DEP-004**: frontend/src/features/generation/contracts/backend-stream.ts per contratto stream invariato.
- **DEP-005**: Tooling frontend scripts definiti in frontend/package.json (test, typecheck).

## 5. Files

- **FILE-001**: frontend/src/app/runtime/http-client.ts - nuovo client HTTP condiviso.
- **FILE-002**: frontend/src/app/runtime/api-paths.ts - estensione endpoint centralizzati.
- **FILE-003**: frontend/src/features/auth/runtime/auth-client.ts - migrazione transport condiviso.
- **FILE-004**: frontend/src/features/projects/runtime/projects-client.ts - migrazione transport condiviso.
- **FILE-005**: frontend/src/features/artifacts/runtime/artifacts-client.ts - migrazione transport condiviso.
- **FILE-006**: frontend/src/features/tools/runtime/tools-client.ts - migrazione transport condiviso.
- **FILE-007**: frontend/src/features/generation/runtime/generation-client.ts - import joinApiPath condiviso.
- **FILE-008**: frontend/src/features/admin/runtime/admin-client.ts - nuovo runtime client admin.
- **FILE-009**: frontend/src/app/runtime/queries/useProjectsQuery.ts - nuovo hook query list projects.
- **FILE-010**: frontend/src/app/runtime/queries/useProjectDetailQuery.ts - nuovo hook query detail project.
- **FILE-011**: frontend/src/app/runtime/queries/useArtifactsQuery.ts - nuovo hook query list artifacts.
- **FILE-012**: frontend/src/app/runtime/queries/useArtifactDetailQuery.ts - nuovo hook query detail artifact.
- **FILE-013**: frontend/src/features/projects/pages/ProjectsListPage.tsx - migrazione hook query.
- **FILE-014**: frontend/src/features/projects/pages/ProjectDetailPage.tsx - migrazione hook query.
- **FILE-015**: frontend/src/features/artifacts/pages/ArtifactsPage.tsx - migrazione hook query.
- **FILE-016**: frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx - migrazione hook query.
- **FILE-017**: frontend/src/features/admin/pages/AdminUsersPage.tsx - rimozione fetch hardcoded.
- **FILE-018**: frontend/src/features/tools/runtime/tool-entry-params.ts - parser query condiviso.
- **FILE-019**: frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx - migrazione parser condiviso.
- **FILE-020**: frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx - migrazione parser condiviso.
- **FILE-021**: frontend/src/features/tools/runtime/tool-entry-params.test.ts - test parser.
- **FILE-022**: frontend/src/app/runtime/queries/useAdminUsersQuery.ts - hook query shared admin users.

## 6. Testing

- **TEST-001**: Verificare compatibilita auth-client.ts: loginWithPassword, readSession, logoutSession invariati su successo/errore HTTP.
- **TEST-002**: Verificare projects-client.ts: listProjects/getProjectById/createProject con capability on/off e status 404.
- **TEST-003**: Verificare artifacts-client.ts: listArtifacts/getArtifactById con fallback localArtifacts quando capability disabilitata.
- **TEST-004**: Verificare AdminUsersPage renderizza stato error/loading/empty dopo migrazione admin-client.
- **TEST-005**: Verificare query hooks condivisi gestiscono reload e cancellazione senza setState dopo unmount.
- **TEST-006**: Verificare parser tool-entry-params su combinazioni query complete e parziali.
- **TEST-007**: Verificare assenza stringhe hardcoded endpoint in pagine tramite grep automatizzato su frontend/src/features/**/pages/*.tsx.
- **TEST-008**: Verificare typecheck frontend green e test suite frontend green al termine di ogni fase.

## 7. Risks & Assumptions

- **RISK-001**: Variazioni involontarie nei messaggi errore UI durante normalizzazione error handling.
- **RISK-002**: Introduzione race condition nei nuovi hook query durante rapidi cambi filtro/id.
- **RISK-003**: Migrazione incompleta puo lasciare path hardcoded residui in pagine non coperte.
- **ASSUMPTION-001**: Le shape JSON backend correnti restano invariate durante l'intervento.
- **ASSUMPTION-002**: Le route tool continuano a usare query params come source of truth di ingresso.
- **ASSUMPTION-003**: La suite test frontend puo essere estesa senza vincoli di infrastruttura aggiuntivi.

## 8. Related Specifications / Further Reading

- docs/99-lifecycle/99-archive/planning/frontend-unification-refactor-map-snapshot-2026-04-27.md
- docs/99-lifecycle/99-archive/planning/feature-generation-ux-flow-1-snapshot-2026-04-27.md
- docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
- docs/02-design/specifications/frontend-spec.md
