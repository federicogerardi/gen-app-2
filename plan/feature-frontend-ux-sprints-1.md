---
goal: Frontend UX Flow As-Is Completion Plan (Backend-As-Is First)
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-24
owner: Frontend Platform
status: 'Completed'
tags: [feature, frontend, ux, sprint, xstate, integration]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Piano sprint-by-sprint per completare i gap residui della GUI as-is, massimizzando il riuso del backend runtime esistente (`/auth/*` e `/generation/stream`) e imponendo il vincolo di zero regressioni backend ad ogni sprint.

## 1. Requirements & Constraints

- **REQ-001**: Implementare mappa route GUI as-is con shell autenticata e navigazione projects-first.
- **REQ-002**: Introdurre moduli pagina separati: dashboard, projects list/new/detail, tools funnel-pages/nextland, artifacts list/detail, admin.
- **REQ-003**: Implementare workflow tool specifici (funnel-pages 3-step, nextland 2-step) con dipendenze inter-step.
- **REQ-004**: Mantenere compatibilita con backend stream as-is (`start/chunk/terminal`) senza breaking change.
- **REQ-005**: Mantenere resume/regenerate con regole checkpoint gia introdotte in Sprint 2.
- **REQ-006**: Rendere lo storico artefatti persistente tramite adapter API lato frontend quando disponibili endpoint backend.
- **REQ-007**: Integrare superficie admin utenti esistente e preparare admin models con feature-flag/adapter fallback.
- **SEC-001**: Nessuna modifica ai contratti backend runtime esistenti senza test di compatibilita espliciti.
- **SEC-002**: Ogni chiamata autenticata deve mantenere `credentials: 'include'` e policy CSRF/CORS correnti.
- **CON-001**: Nessuna regressione backend permessa: `npm run backend:go` deve restare verde dopo ogni sprint.
- **CON-002**: Finche gli endpoint `/api/*` non sono disponibili, usare adapter frontend con fallback deterministico ai dati locali gia presenti.
- **CON-003**: Non introdurre dipendenze non necessarie al routing/state management.
- **GUD-001**: Ogni sprint deve avere test frontend nuovi o aggiornati, con verifica typecheck+test.
- **GUD-002**: Le funzionalita gia consegnate (Sprint 1-3) non devono cambiare comportamento osservabile senza test aggiornati.
- **PAT-001**: Backend-as-is first: prima integrare cio che esiste, poi aggiungere adapter per superfici mancanti.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Consolidare baseline gia completata (Sprint 1-3) prima delle nuove fasi route-first.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-900 | Completato Tool Setup Comune con guardrail input (`project` obbligatorio, briefing file `.docx/.txt/.md`, stato processing/review/generating) in `frontend/src/features/generation/ui/GenerationForm.tsx`. | ✅ | 2026-04-24 |
| TASK-901 | Completata derivazione stati UI canonici e policy azione primaria in `frontend/src/features/generation/ui/tool-ux-state.ts` con test dedicati. | ✅ | 2026-04-24 |
| TASK-902 | Completato resume/regenerate con checkpoint priority rule (`generating > completed_partial > completed`) e regola `resume-needs-briefing` basata su extraction context in `frontend/src/features/generation/ui/tool-checkpoints.ts`. | ✅ | 2026-04-24 |
| TASK-903 | Completati storico/dettaglio/relaunch artifacts in fallback locale frontend (`ArtifactHistoryPanel` + `artifact-history` utilities) senza modifiche backend. | ✅ | 2026-04-24 |
| TASK-904 | Completato aggiornamento test frontend per Sprint 1-3 (`tool-ux-state.test.ts`, `tool-checkpoints.test.ts`, `artifact-history.test.ts`) con suite verde. | ✅ | 2026-04-24 |
| TASK-905 | Verificata no-regressione backend post sprint con gate `npm run backend:go` verde. | ✅ | 2026-04-24 |

### Implementation Phase 1

- GOAL-001: Introdurre routing applicativo e shell autenticata con navbar as-is senza cambiare contratti backend.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Installare `react-router-dom` in `frontend/package.json` e aggiungere bootstrap router in `frontend/src/main.tsx` con `createBrowserRouter` e route placeholders per `/`, `/dashboard`, `/dashboard/projects`, `/dashboard/projects/new`, `/dashboard/projects/:id`, `/tools/funnel-pages`, `/tools/nextland`, `/artifacts`, `/artifacts/:id`, `/admin`. | ✅ | 2026-04-24 |
| TASK-002 | Creare `frontend/src/app/layouts/AuthenticatedShell.tsx` con navbar, email utente, badge runtime, sign-out, variante mobile collassabile e slot contenuto (`<Outlet />`). | ✅ | 2026-04-24 |
| TASK-003 | Creare `frontend/src/app/layouts/PublicShell.tsx` per route `/` con login/OAuth gia esistenti, riusando `LoginForm`. | ✅ | 2026-04-24 |
| TASK-004 | Spostare logica sessione da `frontend/src/App.tsx` in `frontend/src/app/providers/AuthSessionProvider.tsx` con hook `useAuthSession()`; aggiornare componenti consumer. | ✅ | 2026-04-24 |
| TASK-005 | Aggiungere test smoke routing in `frontend/src/app/routing/app-router.test.tsx` (render route + auth redirect rules). | ✅ | 2026-04-24 |

### Implementation Phase 2

- GOAL-002: Implementare dashboard e workspace projects-first usando adapter frontend su backend as-is (fallback locale).

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-006 | Creare `frontend/src/features/projects/runtime/projects-client.ts` con interfaccia `listProjects()` e fallback locale in assenza `/api/projects`. | ✅ | 2026-04-24 |
| TASK-007 | Creare pagine `frontend/src/features/dashboard/pages/DashboardPage.tsx`, `frontend/src/features/projects/pages/ProjectsListPage.tsx`, `frontend/src/features/projects/pages/NewProjectPage.tsx`, `frontend/src/features/projects/pages/ProjectDetailPage.tsx`. | ✅ | 2026-04-24 |
| TASK-008 | Implementare card dashboard con CTA progetti, shortcut tools, ultimi artifacts, usando dati da store artifacts runtime gia presenti. | ✅ | 2026-04-24 |
| TASK-009 | Implementare dettaglio progetto con lista artifact contestuali (tipo/stato/model/data/link). | ✅ | 2026-04-24 |
| TASK-010 | Aggiungere test `frontend/src/features/projects/runtime/projects-client.test.ts` e `frontend/src/features/dashboard/pages/DashboardPage.test.tsx`. | ✅ | 2026-04-24 |

### Implementation Phase 3

- GOAL-003: Separare i tool in pagine dedicate e implementare orchestration step-based (funnel-pages e nextland).

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-011 | Creare `frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx` con step obbligatori `optin -> quiz -> vsl` e dipendenze output step precedenti. | ✅ | 2026-04-24 |
| TASK-012 | Creare `frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx` con step obbligatori `landing -> thank_you`. | ✅ | 2026-04-24 |
| TASK-013 | Estrarre motore comune in `frontend/src/features/tools/runtime/tool-generation-engine.ts` che usa stream client esistente (`/generation/stream`) e mappa eventi in step progress UI. | ✅ | 2026-04-24 |
| TASK-014 | Creare machine XState tool-level in `frontend/src/features/tools/machines/tool-flow.machine.ts` con stati per step `idle/running/done/error` e retry policy UI-side max 3 tentativi. | ✅ | 2026-04-24 |
| TASK-015 | Aggiungere test `frontend/src/features/tools/machines/tool-flow.machine.test.ts` coprendo dipendenze inter-step e retry exhaustion. | ✅ | 2026-04-24 |

### Implementation Phase 4

- GOAL-004: Completare artifacts archive/detail con persistenza adapter, filtri completi e relaunch consistente.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-016 | Creare `frontend/src/features/artifacts/runtime/artifacts-client.ts` con metodi `listArtifacts(filters)`, `getArtifactById(id)` e fallback locale al modello Sprint 3 (`GenerationArtifact`). | ✅ | 2026-04-24 |
| TASK-017 | Creare `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` e `frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` usando filtri tipo/stato/progetto/periodo e deep-link `/:id`. | ✅ | 2026-04-24 |
| TASK-018 | Integrare azioni relaunch primario/secondario in `ArtifactDetailPage.tsx` riusando `buildRelaunchRequest(...)` da `frontend/src/features/generation/ui/artifact-history.ts`. | ✅ | 2026-04-24 |
| TASK-019 | Implementare delete artifact solo lato UI con feature-flag `ARTIFACT_DELETE_ENABLED=false` finche endpoint backend non disponibile. | ✅ | 2026-04-24 |
| TASK-020 | Aggiungere test `frontend/src/features/artifacts/runtime/artifacts-client.test.ts` e `frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx`. | ✅ | 2026-04-24 |

### Implementation Phase 5

- GOAL-005: Implementare superficie admin in due stadi (utenti live, models fallback) mantenendo segregazione ruolo.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-021 | Creare guard route admin in `frontend/src/features/admin/routing/admin-guard.tsx` con accesso solo `session.user.role === 'admin'`. | ✅ | 2026-04-24 |
| TASK-022 | Creare `frontend/src/features/admin/pages/AdminUsersPage.tsx` con CRUD utenti usando endpoint backend gia esposto (`/admin/users`, `/admin/users/:id`). | ✅ | 2026-04-24 |
| TASK-023 | Creare `frontend/src/features/admin/pages/AdminModelsPage.tsx` con adapter fallback locale finche `/api/admin/models` non e disponibile; esporre banner `Backend endpoint pending`. | ✅ | 2026-04-24 |
| TASK-024 | Creare `frontend/src/features/admin/pages/AdminActivityPage.tsx` con feed locale derivato da artifacts/checkpoints finche endpoint activity non disponibile. | ✅ | 2026-04-24 |
| TASK-025 | Aggiungere test `frontend/src/features/admin/pages/AdminUsersPage.test.tsx` e test guard ruolo admin/non-admin. | ✅ | 2026-04-24 |

### Implementation Phase 6

- GOAL-006: Allineare contratti endpoint `/api/*` non disponibili tramite adapter layer e piano cutover senza regressioni.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-026 | Introdurre adapter centralizzato `frontend/src/app/runtime/backend-capabilities.ts` che dichiara capability runtime (`projects`, `models`, `artifacts`, `toolsUpload`, `adminModels`). | ✅ | 2026-04-24 |
| TASK-027 | Implementare mapping endpoint in `frontend/src/app/runtime/api-paths.ts` con toggle tra route as-is (`/generation/stream`, `/auth/*`) e future route `/api/*`. | ✅ | 2026-04-24 |
| TASK-028 | Creare test contract in `frontend/src/app/runtime/backend-capabilities.test.ts` per garantire fallback deterministico quando capability manca. | ✅ | 2026-04-24 |
| TASK-029 | Aggiornare documentazione in `docs/specifications/frontend-spec.md` con sezione "Backend capability matrix" e comportamento fallback per ogni modulo. | ✅ | 2026-04-24 |
| TASK-030 | Eseguire validazione E2E locale: login -> dashboard -> tool -> artifacts -> relaunch -> admin users. Salvare checklist in `docs/review/frontend-sprint-go-checklist.md`. | ✅ | 2026-04-24 |

### Implementation Phase 7

- GOAL-007: Stabilizzare quality gate per sprint frontend con no-regression backend obbligatoria.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-031 | Definire script `frontend:test:ci` in `frontend/package.json`: `typecheck + vitest`. | ✅ | 2026-04-24 |
| TASK-032 | Definire script root `frontend:sprint:gate` in `package.json`: `npm --prefix frontend run typecheck && npm --prefix frontend run test && npm run backend:go`. | ✅ | 2026-04-24 |
| TASK-033 | Creare `docs/review/frontend-sprint-regression-policy.md` con regola bloccante: merge vietato se `backend:go` fallisce. | ✅ | 2026-04-24 |
| TASK-034 | Integrare check automatico su PR tramite workflow CI (file `.github/workflows/frontend-sprint-gate.yml`). | ✅ | 2026-04-24 |
| TASK-035 | Eseguire run finale gate e marcare sprint plan `In progress` o `Completed` in base all'esito. | ✅ | 2026-04-24 |

## 3. Alternatives

- **ALT-001**: Implementare subito tutte le route `/api/*` lato backend prima del frontend. Scartata perche blocca i rilasci incrementali UI su backend as-is gia operativo.
- **ALT-002**: Mantenere app single-page senza router e simulare sezioni con tab locali. Scartata perche non soddisfa la mappa route as-is.
- **ALT-003**: Saltare fallback e dipendere rigidamente da endpoint mancanti. Scartata perche produce blocchi operativi e regressioni UX.
- **ALT-004**: Convertire stream contract UI a `token/complete/error` subito. Scartata finche backend espone `start/chunk/terminal` stabile e testato.

## 4. Dependencies

- **DEP-001**: Backend runtime as-is disponibile: `/auth/*` e `POST /generation/stream`.
- **DEP-002**: Stato corrente frontend Sprint 1-3 (setup comune, stati canonici, resume/regenerate, artifacts local history).
- **DEP-003**: `xstate` v5 e `@xstate/react` gia presenti nel frontend.
- **DEP-004**: `react-router-dom` da aggiungere per route map.
- **DEP-005**: Credenziali ambiente locale (`.env.local`) per run `npm run backend:go`.

## 5. Files

- **FILE-001**: `frontend/src/main.tsx` - bootstrap router.
- **FILE-002**: `frontend/src/App.tsx` - decomposizione shell/feature wiring.
- **FILE-003**: `frontend/src/app/layouts/AuthenticatedShell.tsx` - shell autenticata.
- **FILE-004**: `frontend/src/app/layouts/PublicShell.tsx` - shell pubblica.
- **FILE-005**: `frontend/src/app/providers/AuthSessionProvider.tsx` - session provider.
- **FILE-006**: `frontend/src/features/dashboard/pages/DashboardPage.tsx` - dashboard.
- **FILE-007**: `frontend/src/features/projects/runtime/projects-client.ts` - adapter progetti.
- **FILE-008**: `frontend/src/features/projects/pages/ProjectsListPage.tsx` - lista progetti.
- **FILE-009**: `frontend/src/features/projects/pages/NewProjectPage.tsx` - creazione progetto.
- **FILE-010**: `frontend/src/features/projects/pages/ProjectDetailPage.tsx` - dettaglio progetto.
- **FILE-011**: `frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx` - tool funnel-pages.
- **FILE-012**: `frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx` - tool nextland.
- **FILE-013**: `frontend/src/features/tools/machines/tool-flow.machine.ts` - machine step-based tools.
- **FILE-014**: `frontend/src/features/artifacts/runtime/artifacts-client.ts` - adapter artifacts.
- **FILE-015**: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` - archivio artifacts.
- **FILE-016**: `frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` - dettaglio artifact.
- **FILE-017**: `frontend/src/features/admin/pages/AdminUsersPage.tsx` - admin utenti.
- **FILE-018**: `frontend/src/features/admin/pages/AdminModelsPage.tsx` - admin modelli.
- **FILE-019**: `frontend/src/features/admin/pages/AdminActivityPage.tsx` - admin activity.
- **FILE-020**: `frontend/src/app/runtime/backend-capabilities.ts` - capability matrix runtime.
- **FILE-021**: `frontend/src/app/runtime/api-paths.ts` - mapping endpoint as-is/futuri.
- **FILE-022**: `frontend/src/styles.css` - shell/navbar/mobile/layout pagine.
- **FILE-023**: `docs/specifications/frontend-spec.md` - documentazione aggiornata.
- **FILE-024**: `docs/review/frontend-sprint-go-checklist.md` - checklist sprint GO.
- **FILE-025**: `docs/review/frontend-sprint-regression-policy.md` - policy regressioni.
- **FILE-026**: `.github/workflows/frontend-sprint-gate.yml` - gate CI.

## 6. Testing

- **TEST-001**: Route resolution test su tutte le route primarie GUI as-is.
- **TEST-002**: Auth guard test: utente anonimo su route protetta -> redirect login.
- **TEST-003**: Tool funnel-pages: ordine step optin->quiz->vsl e blocco step invalidi.
- **TEST-004**: Tool nextland: ordine step landing->thank_you.
- **TEST-005**: Resume rules test: checkpoint con extraction context permette resume senza briefing; senza context richiede briefing.
- **TEST-006**: Artifact filters test: tipo/stato/progetto/periodo combinati.
- **TEST-007**: Relaunch test: nuova request con metadata relaunch e nuovo requestId.
- **TEST-008**: Admin guard test: non-admin non accede a `/admin`.
- **TEST-009**: Admin users integration test su endpoint runtime disponibili.
- **TEST-010**: Capability fallback test per endpoint mancanti `/api/*`.
- **TEST-011**: Gate frontend locale: `npm --prefix frontend run typecheck && npm --prefix frontend run test`.
- **TEST-012**: Gate backend no-regression obbligatorio: `npm run backend:go`.

## 7. Risks & Assumptions

- **RISK-001**: Mancanza endpoint `/api/*` puo ritardare completion funzionale completa della spec.
- **RISK-002**: Introduzione router puo creare regressioni nella gestione sessione se provider non centralizzato correttamente.
- **RISK-003**: Divergenza semantica stream (`chunk/terminal` vs `token/complete`) puo creare mismatch documentale.
- **RISK-004**: Crescita del fallback locale artifacts potrebbe divergere da dati persistenti reali se non allineata.
- **ASSUMPTION-001**: Il backend as-is continuera a esporre stabilmente `/auth/*` e `/generation/stream`.
- **ASSUMPTION-002**: Le route admin utenti esistenti restano utilizzabili dal frontend senza cambi contratto.
- **ASSUMPTION-003**: Il gate `npm run backend:go` resta riferimento ufficiale di non-regressione backend.

## 8. Related Specifications / Further Reading

[docs/specifications/gui-scope-as-is-spec.md](docs/specifications/gui-scope-as-is-spec.md)
[docs/specifications/frontend-spec.md](docs/specifications/frontend-spec.md)
[plan/frontend-development-plan-on-existing-backend-1.md](plan/frontend-development-plan-on-existing-backend-1.md)
[docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md](docs/specifications/xstate-system-as-is/backend-go-checklist-spec.md)