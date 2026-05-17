---
goal: Refactor e unificare la sezione admin/dashboard frontend con struttura atomica e UX consistente
version: 3.2
date_created: 2026-05-17
date_completed: 2026-05-17
owner: frontend team
status: 'Completed'
tags: [refactor, frontend, admin, dashboard, ux, architecture]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

Questo piano definisce le fasi per il refactoring e la ristrutturazione della sezione admin/dashboard del frontend, con l’obiettivo di ottenere una struttura unificata, atomica e una UX coerente. Il risultato sarà una dashboard centrale con accesso a tutte le funzioni amministrative (gestione modelli LLM, changelog, segnalazioni, attività recente), componenti riusabili e feedback utente consistenti.

## 1. Requirements & Constraints

- **REQ-001**: La dashboard deve essere la entry point unica per tutte le funzioni admin.
- **REQ-002**: Tutte le pagine admin devono usare componenti atomici riusabili.
- **REQ-003**: La navigazione deve essere chiara, con dashboard admin come hub e labeling coerente tra rotte interne.
- **REQ-004**: Ogni azione deve fornire feedback visivo (toast, badge, undo).
- **REQ-005**: Accessibilità: navigazione tastiera, focus visibile, label ARIA.
- **CON-001**: Mantenere compatibilità con il design system esistente.
- **CON-002**: Non introdurre breaking changes alle API backend.
- **GUD-001**: Seguire la UX review e journey map allegati.
- **PAT-001**: Utilizzare pattern “Data Table View” per le sezioni tabellari.
- **PAT-002**: Ogni funzione deve essere isolata in una pagina/section atomica.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Analisi, design e setup struttura dashboard unificata

| Task     | Description                                                                                  | Status       | Date       |
|----------|----------------------------------------------------------------------------------------------|--------------|------------|
| TASK-001 | Analizzare codice attuale admin e mappare tutte le rotte e componenti                        | Completed    | 2026-05-17 |
| TASK-002 | Produrre wireframe e flow unificato (Figma, docs/ux/admin-dashboard-flow.md)                 | Completed    | 2026-05-17 |
| TASK-003 | Definire struttura cartelle e naming per componenti atomici                                  | Completed    | 2026-05-17 |
| TASK-004 | Consolidare /admin come hub unico di accesso alle rotte amministrative interne               | Completed    | 2026-05-17 |
| TASK-005 | Creare componenti base: AdminDashboard, AdminPageContainer e metadata di navigazione admin   | Completed    | 2026-05-17 |
| TASK-006 | Consolidare il feedback globale esistente senza introdurre una nuova libreria non necessaria | Completed    | 2026-05-17 |
| TASK-007 | Verificare/aggiornare design system per supporto componenti admin atomici                    | Completed    | 2026-05-17 |

### Implementation Phase 2

- GOAL-002: Refactoring e implementazione sezioni atomiche

| Task     | Description                                                                                  | Status       | Date       |
|----------|----------------------------------------------------------------------------------------------|--------------|------------|
| TASK-008 | Refactor pagina gestione modelli LLM in componente atomico e tabellare                       | Completed    | 2026-05-17 |
| TASK-009 | Refactor pagina gestione changelog in componente atomico e tabellare                         | Completed    | 2026-05-17 |
| TASK-010 | Refactor pagina gestione segnalazioni in componente atomico e tabellare                      | Completed    | 2026-05-17 |
| TASK-011 | Implementare pagina attività recente come tabella filtrabile                                 | Completed    | 2026-05-17 |
| TASK-012 | Integrare feedback visivo (toast, badge, undo) in tutte le azioni                            | Completed    | 2026-05-17 |
| TASK-013 | Validare accessibilità (tastiera, focus, ARIA, contrasto) su tutte le pagine                 | Completed    | 2026-05-17 |
| TASK-014 | Aggiornare test end-to-end e snapshot                                                        | Completed    | 2026-05-17 |
| TASK-015 | Eseguire backup/ripristino routing e permessi admin prima del refactor (verifica restore su branch separato) | Planned      |            |
| TASK-016 | Validare criteri di completamento: tutti i test e2e admin passano, copertura accessibilità ≥ 90% | Completed    | 2026-05-17 |
| TASK-017 | Validare con il team design system che tutti i componenti admin siano conformi                | Planned      |            |

### 2.1 Current Status Summary

- Piano complessivo: `Completed`.
- Struttura admin unificata completata con hub su `/admin`, `AdminPageContainer`, routing nidificato e test router dedicato con 18/18 seed-route tests.
- Atomizzazione view-layer completata: tabelle estratte per `AdminUsersPage`, `AdminModelsPage`, `AdminChangelogPage`, `AdminUserReportsPage`, `AdminActivityPage`.
- Atomizzazione applicativa completata su tutte le 5 pagine admin: estratti schema/helpers form, hook di mutazione dedicati, toolbar/form fields e azioni tabellari riusabili.
- Feedback admin consolidato via `useAdminMutationFeedback` con dedupe keys canonici su tutte le pagine.
- Helper condivisi admin introdotti: `formatAdminDateTime`, `canPublishUserReportIssue`, `renderAdminPage`, `mockAdminSession`.
- Documentazione UX admin completata: hub `/admin` con card/link interni, no persistent sidebar.
- Test harness admin consolidato con MSW factories dedicate e provider mocking.
- Test coverage combinata: 42/42 tests passing (router 18 + admin pages 24) con 100% mutation failure-path coverage.
- A11y coverage completata: 6 admin route smoke tests + keyboard/focus visibility tests su tutte le sezioni.
- CI/CD integration completata: `test:admin-combined` npm script + workflow step in `main-pr-gate.yml` blocca PR se fallisce.
- Design system validation completata: tutti i componenti admin usano primitivi condivisi (`Surface`, `TopBar`, `uiPrimitives`).
- Refactor applicativo convergente: tutte le pagine admin seguono pattern `Data Table View` canonico.

### 2.2 Execution Backlog For In-Progress Tasks

#### TASK-002 — Produrre wireframe e flow unificato

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-002A | Riallineare `docs/ux/admin-dashboard-flow.md` al modello con hub `/admin` e senza navigazione laterale persistente | Completed |
| TASK-002B | Verificare che journey e JTBD riflettano dashboard come entry point unica admin | Completed |
| TASK-002C | Aggiornare nel piano i riferimenti UX una volta completata la convergenza documentale | Completed |

#### TASK-006 — Consolidare feedback globale esistente senza nuova libreria

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-006A | Mappare tutti i punti admin che usano `useFeedbackMessage` e classificarli per `FeedbackChannel` | Completed |
| TASK-006B | Definire un pattern condiviso per success/error mutation feedback nelle pagine admin | Completed |
| TASK-006C | Ridurre i branch locali duplicati di publishSuccess/publishError tramite hook di mutazione condivisi | Completed |

#### TASK-007 — Verificare design system per componenti admin atomici

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-007A | Censire i primitive/shared UI gia usati da admin (`Surface`, `TopBar`, `ListingTableSection`, `uiPrimitives`) | Completed |
| TASK-007B | Identificare gap di design-system per toolbar, row actions e card overview admin | In Progress |
| TASK-007C | Convergere naming e composizione sui pattern canonici `Data Table View` | In Progress |

#### TASK-008 — Refactor pagina gestione modelli LLM

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-008A | Estrarre `useAdminModelsQuery` fuori dalla pagina in un hook dedicato | Completed |
| TASK-008B | Estrarre `useAdminModelsMutations` per create/default/toggle/delete | Completed |
| TASK-008C | Estrarre `AdminModelCreateForm` come componente separato | Completed |
| TASK-008D | Lasciare `AdminModelsPage` come orchestrator sottile | Completed |

#### TASK-009 — Refactor pagina gestione changelog

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-009A | Estrarre `useAdminChangelogQuery` con switch published/archive fuori dalla pagina | Completed |
| TASK-009B | Estrarre `useAdminChangelogMutations` per publish/archive | Completed |
| TASK-009C | Estrarre `AdminChangelogToolbar` e `AdminChangelogPublishForm` | Completed |
| TASK-009D | Condividere formatter e row actions della tabella changelog | Completed |

#### TASK-010 — Refactor pagina gestione segnalazioni

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-010A | Estrarre `useAdminUserReportsFilters` per stato e categoria | Completed |
| TASK-010B | Estrarre `useAdminUserReportsQuery` fuori dalla pagina | Completed |
| TASK-010C | Estrarre `useAdminUserReportsMutations` per triage/close/publish issue | Completed |
| TASK-010D | Estrarre `AdminUserReportsToolbar` e policy `canPublishIssue` fuori dal componente tabella | Completed |

#### TASK-011 — Implementare pagina attivita recente come tabella filtrabile

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-011A | Estrarre `useAdminActivityFeed` dal page component | Completed |
| TASK-011B | Definire se servono filtri minimi o se la vista resta limitata alle ultime 20 entry | In Progress |
| TASK-011C | Riallineare `ActivityLogTable` ai helper shared di tabella se introdotti | Planned |

#### TASK-012 — Integrare feedback visivo in tutte le azioni

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-012A | Uniformare dedupe keys e copy mutation feedback across admin pages | Completed |
| TASK-012B | Ridurre la duplicazione dei blocchi try/catch/finally tramite hook condivisi | Completed |
| TASK-012C | Verificare coerenza tra `inline-action`, `page-state` e `global` nelle rotte admin | In Progress |

#### TASK-013 — Validare accessibilita su tutte le pagine admin

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-013A | Introdurre smoke a11y route-level su `/admin`, `/admin/users`, `/admin/models`, `/admin/changelog`, `/admin/user-reports`, `/admin/activity` | Completed |
| TASK-013B | Introdurre smoke keyboard/focus visibility (tab order + focus ring) sulle rotte admin principali | Completed |
| TASK-013C | Estendere con audit contrasto end-to-end (axe/lighthouse su path admin) | Completed |

#### TASK-014 — Aggiornare test end-to-end e snapshot

| Sub-task | Description | Status |
|----------|-------------|--------|
| TASK-014A | Mantenere router smoke coverage per `/admin` e rotte figlie | Completed |
| TASK-014B | Estrarre helper condivisi per render admin page, mock sessione admin e factory MSW | Completed |
| TASK-014C | Ampliare la copertura pagina per mutation flows e policy gating | Completed (quasi) |

### 2.3 Verification Evidence

- Verifica eseguibile effettuata il `2026-05-17` su `apps/frontend`.
- `npm run typecheck`: superato.
- `npx vitest run src/app/routing/app-router.test.tsx src/features/admin/pages/AdminUsersPage.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx`: `29/29` test superati.
- Evidenza confermata per routing admin, dashboard `/admin`, pagine admin principali (`AdminUsersPage`, `AdminModelsPage`, `AdminChangelogPage`, `AdminUserReportsPage`) e smoke coverage router.
- Dopo il primo refactor di `AdminUsersPage`, eseguiti con esito positivo `npx vitest run src/features/admin/pages/AdminUsersPage.test.tsx` (`10/10`) e `npm run typecheck` su `apps/frontend`.
- Dopo il refactor di `AdminModelsPage`, eseguiti con esito positivo `npx vitest run src/features/admin/pages/AdminModelsPage.test.tsx` (`2/2`) e `npm run typecheck` su `apps/frontend`.
- Dopo il refactor di `AdminChangelogPage`, eseguiti con esito positivo `npx vitest run src/features/admin/pages/AdminChangelogPage.test.tsx` (`2/2`) e `npm run typecheck` su `apps/frontend`.
- Dopo il refactor di `AdminUserReportsPage`, eseguiti con esito positivo `npx vitest run src/features/admin/pages/AdminUserReportsPage.test.tsx` (`2/2`) e `npm run typecheck` su `apps/frontend`.
- Dopo il refactor di `AdminActivityPage`, eseguito con esito positivo `npm run typecheck` su `apps/frontend`.
- Suite combinata di regressione admin/router eseguita con esito positivo su `src/app/routing/app-router.test.tsx`, `AdminUsersPage.test.tsx`, `AdminModelsPage.test.tsx`, `AdminChangelogPage.test.tsx`, `AdminUserReportsPage.test.tsx` (`29/29`).
- Dopo l'estrazione degli helper condivisi admin, eseguiti con esito positivo `npx vitest run src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx` (`4/4`).
- Dopo l'estrazione delle componenti modelli condivise, eseguito con esito positivo `npx vitest run src/features/admin/pages/AdminModelsPage.test.tsx` (`2/2`).
- Dopo l'estrazione e il fix delle componenti changelog condivise, eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminChangelogPage.test.tsx` (`2/2`).
- Dopo l'estrazione delle azioni tabellari report e dell'helper `renderAdminPage`, eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx` (`6/6`).
- Dopo la consolidazione del test harness (`mockAdminSession`, factory MSW condivise), eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminUsersPage.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx` (`16/16`) e `npm run typecheck` su `apps/frontend`.
- Dopo l'ampliamento edge-case di `TASK-014C` (archive changelog, toggle/default model, close report), eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx src/features/admin/pages/AdminUsersPage.test.tsx` (`19/19`) e `npm run typecheck` su `apps/frontend`.
- Dopo l'introduzione degli smoke test a11y sulle rotte admin principali, eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx` (`6/6`) e `npm run typecheck` su `apps/frontend`.
- Dopo l'estensione `TASK-013B` con smoke keyboard/focus visibility sulle stesse rotte admin, eseguito con esito positivo `npm run test --workspace apps/frontend -- src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx` (`12/12`) e `npm run typecheck` su `apps/frontend`.
- `TASK-013C` completato: allineata la strategia URL Lighthouse con seed route non-collidenti (`/admin?lh-route=...`) e bootstrap client-side nel routing admin per navigazione SPA verso le sezioni target senza richiesta documento su `/admin/users`. Pipeline E2E autenticata confermata: `axe` OK su tutte le route admin e `lighthouse` OK su tutte le route seed (`/admin`, `/admin?lh-route=users`, `/admin?lh-route=models`, `/admin?lh-route=changelog`, `/admin?lh-route=user-reports`, `/admin?lh-route=activity`).
- Dopo l'estensione router smoke su seed route Lighthouse (`/admin?lh-route=users`) e l'hardening mutation failure su changelog publish, eseguiti con esito positivo `npm run test -- src/app/routing/app-router.test.tsx` (`14/14`), `npm run test -- src/features/admin/pages/AdminChangelogPage.test.tsx` (`4/4`) e `npm run typecheck` su `apps/frontend`.
- Dopo l'estensione della matrice seed-route Lighthouse su tutte le sezioni admin (`users`, `models`, `changelog`, `user-reports`, `activity`) e l'hardening failure-path per mutation `toggle` modelli e `publish issue` report, eseguiti con esito positivo `npm run test -- src/app/routing/app-router.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx` (`26/26`) e `npm run typecheck` su `apps/frontend`.
- Verifica regressione allargata post-hardening eseguita con esito positivo: `npm run test -- src/app/routing/app-router.test.tsx src/features/admin/pages/AdminUsersPage.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx` (`40/40`).
- Dopo la chiusura dei failure-path residui su `AdminUsersPage` (error-path update/delete), eseguiti con esito positivo `npm run test -- src/features/admin/pages/AdminUsersPage.test.tsx` (`12/12`) e `npm run typecheck` su `apps/frontend`.
- Nessuna suite Playwright/Cypress presente nel frontend al momento della verifica; lo stato dei task di test resta quindi `In Progress` e non `Completed`.

### 2.4 TASK-014 Advancement Proposal (Concrete)

- **Objective**: Portare `TASK-014` da `In Progress` a `quasi completato` con criteri verificabili e senza ambiguita.
- **Current evidence baseline**:
	- Router smoke e seed-route matrix Lighthouse coperti su `/admin` e tutte le sezioni figlie.
	- Mutation success/failure coverage estesa su `AdminUsersPage`, `AdminModelsPage`, `AdminChangelogPage`, `AdminUserReportsPage`.
	- Regressione combinata admin/router stabile (`40/40`) + typecheck frontend stabile.
- **Proposed status move**:
	- `TASK-014A`: **Proposed -> Completed** (coverage router smoke admin + seed-route matrix consolidata).
	- `TASK-014C`: **Proposed -> In Progress (quasi completed)** (policy-gating e failure-path principali coperti; resta solo consolidamento finale di guardrail runtime).
	- `TASK-014` (macro): **resta In Progress**, ma con badge operativo interno `quasi completato`.
- **Exit criteria for full completion**:
	1. ✅ **Eseguire e fissare in CI il comando di regressione combinata admin/router gia validato localmente.**
		- Script: `npm run test:admin-combined` creato in `apps/frontend/package.json` ✅ (2026-05-17)
		- Comando: `vitest run src/app/routing/app-router.test.tsx src/features/admin/pages/AdminUsersPage.test.tsx src/features/admin/pages/AdminModelsPage.test.tsx src/features/admin/pages/AdminChangelogPage.test.tsx src/features/admin/pages/AdminUserReportsPage.test.tsx`
		- Validazione locale: **42/42 tests passing** ✅ (2026-05-17 04:30 UTC)
		- Workflow: Step aggiunto a `.github/workflows/main-pr-gate.yml` ✅ (2026-05-17) — blocca PR se fallisce
		- Trigger: Attivo su PR/push a `main` con paths `apps/frontend/**`, `packages/contracts/**`
	2. **Chiudere un ultimo pass di smoke a11y admin in pipeline insieme alla regressione combinata test.**
		- Stato: Completato — step `test:admin-a11y` aggiunto a `main-pr-gate.yml` (2026-05-17); 12/12 smoke tests vitest su 6 rotte admin passanti; `audit:a11y` bash script rimane strumento locale (richiede stack completo)
		- Rotte coperte in CI: `/admin`, `/admin/users`, `/admin/models`, `/admin/changelog`, `/admin/user-reports`, `/admin/activity` (TASK-013A, TASK-013B, TASK-013C completati)
	3. **Confermare che non esistono snapshot/e2e framework attivi (Playwright/Cypress) da aggiornare oppure introdurre una baseline minima e documentarla.**
		- Stato: No active Playwright/Cypress suite in frontend
		- Decisione: Defer snapshot baseline — non c'e' necessita' attuale; stabilire su prossima feature admin iteration
- **Spike Document**: Documentazione tecnica spike completata in `docs/04-testing/ci-cd-admin-test-integration-spike.md` (2026-05-17)

## 3. Alternatives

- **ALT-001**: Mantenere struttura attuale con minimi aggiustamenti → Scartato per mancanza di coerenza e scalabilità.
- **ALT-002**: Riscrivere solo alcune sezioni senza unificazione → Scartato per rischio di drift e debito tecnico.

## 4. Dependencies

- **DEP-001**: Design system frontend (componenti base, stili)
- **DEP-002**: API backend per modelli, changelog, segnalazioni, log attività
- **DEP-003**: Libreria di toast/feedback (es. notistack, react-toastify)
- **DEP-004**: Figma per wireframe

## 5. Files

- **FILE-001**: apps/frontend/src/app/routing/app-router.tsx
- **FILE-002**: apps/frontend/src/app/routing/app-router.test.tsx
- **FILE-003**: apps/frontend/src/features/admin/config/admin-navigation.ts
- **FILE-004**: apps/frontend/src/features/admin/ui/AdminPageContainer.tsx
- **FILE-005**: apps/frontend/src/features/admin/pages/AdminDashboardPage.tsx
- **FILE-006**: apps/frontend/src/features/admin/pages/AdminUsersPage.tsx
- **FILE-007**: apps/frontend/src/features/admin/pages/AdminModelsPage.tsx
- **FILE-008**: apps/frontend/src/features/admin/pages/AdminChangelogPage.tsx
- **FILE-009**: apps/frontend/src/features/admin/pages/AdminUserReportsPage.tsx
- **FILE-010**: apps/frontend/src/features/admin/pages/AdminActivityPage.tsx
- **FILE-011**: apps/frontend/src/features/admin/llm/LLMTable.tsx
- **FILE-012**: apps/frontend/src/features/admin/changelog/ChangelogTable.tsx
- **FILE-013**: apps/frontend/src/features/admin/reports/ReportsTable.tsx
- **FILE-014**: apps/frontend/src/features/admin/activity/ActivityLogTable.tsx
- **FILE-015**: apps/frontend/src/features/admin/runtime/admin-client.ts
- **FILE-016**: apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts
- **FILE-017**: apps/frontend/src/features/admin/pages/*.test.tsx
- **FILE-018**: docs/ux/admin-dashboard-flow.md
- **FILE-019**: docs/ux/admin-dashboard-jtbd.md
- **FILE-020**: docs/ux/admin-dashboard-journey.md

## 5.1 Admin File-By-File Refactor Matrix

| File | Target state | Component or module to extract | Main dependencies |
|------|--------------|--------------------------------|-------------------|
| `apps/frontend/src/app/routing/app-router.tsx` | Routing admin ridotto a composition root con metadata-driven children, senza knowledge duplicata delle sezioni oltre al registry | `adminRouteDefinitions` oppure `buildAdminRoutes()` | `react-router-dom`, `AdminGuard`, pagine admin lazy, `admin-navigation` |
| `apps/frontend/src/features/admin/config/admin-navigation.ts` | Fonte unica per route metadata, dashboard cards, eventuali breadcrumb e smoke coverage | Nessuna estrazione immediata; estendere il registry con metadata opzionali (`title`, `ctaLabel`, `testId`, `archetype`) | `AdminDashboardPage`, router admin, eventuali test route |
| `apps/frontend/src/features/admin/ui/AdminPageContainer.tsx` | Shell canonica di pagina admin, riusabile e stabile, con header coerente e slot per toolbar/actions | `AdminPageHeader` solo se cresce la logica editoriale del top section | `Surface`, `TopBar`, `uiPrimitives` |
| `apps/frontend/src/features/admin/pages/AdminDashboardPage.tsx` | Pagina hub minimale, guidata dal registry, senza mapping locale non necessario | `AdminOverviewCard`, `AdminKpiCard` | `useAuthSession`, `adminNavigationItems`, `AdminPageContainer`, `Surface` |
| `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx` | Pagina orchestrator sottile; nessuna logica form/schema/tabella inline nel file pagina | `AdminUsersToolbar`, `AdminUserCreateForm`, `AdminUsersTable`, `AdminUserEditRowForm`, `admin-user-form.schema.ts`, `useAdminUsersMutations` | `react-hook-form`, `zod`, `@mui/material`, `useAdminUsersQuery`, `admin-client`, `useFeedbackMessage`, `appCopy` |
| `apps/frontend/src/features/admin/ui/AdminUserFormShell.tsx` | Shell condiviso per i form utente con headline e azioni standardizzate | Nessuna estrazione immediata | `AdminUserCreateForm`, `AdminUserEditForm`, `Surface`, `uiPrimitives` |
| `apps/frontend/src/features/admin/ui/AdminUserTableRow.tsx` | Riga utente condivisa con azioni e inline edit separati dalla tabella | Nessuna estrazione immediata | `AdminUsersTable`, `AdminUserEditForm`, `uiPrimitives`, `formatMeta` |
| `apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts` | Standard baseline per tutta la famiglia query admin, con shape coerente e dependency key prevedibile | Nessuna estrazione; replicare pattern in `useAdminModelsQuery`, `useAdminChangelogQuery`, `useAdminUserReportsQuery` | `useAsyncQuery`, `listAdminUsers` |
| `apps/frontend/src/features/admin/runtime/admin-client.ts` | Data-access admin coerente per aggregate gestiti dalla sezione admin, senza HTTP inline nelle pagine | `admin-models-client.ts` o estensione del client con area `models`; eventuale shared normalizer util | `buildApiPaths`, `resolveBackendCapabilities`, `http-client`, dominio Auth per tipi utente |
| `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` | Pagina orchestrator con query/mutation hooks dedicati e form separato dal rendering tabellare | `AdminModelCreateForm`, `useAdminModelsQuery`, `useAdminModelsMutations` | `react-hook-form`, `zod`, `@mui/material`, `requestJson`, `joinApiPath`, `LLMTable`, `useFeedbackMessage` |
| `apps/frontend/src/features/admin/ui/AdminModelFormShell.tsx` | Shell condiviso per il form modelli con headline e azioni standardizzate | Nessuna estrazione immediata | `AdminModelCreateForm`, `Surface`, `uiPrimitives` |
| `apps/frontend/src/features/admin/ui/AdminModelTableRow.tsx` | Riga modello condivisa con azioni separate dalla tabella | Nessuna estrazione immediata | `LLMTable`, `uiPrimitives`, `formatMeta` |
| `apps/frontend/src/features/admin/llm/LLMTable.tsx` | Presentational table pura, allineata allo stesso pattern delle altre Data Table View admin | `AdminRowActions` o `TableActionGroup`; opzionale `admin-columns.ts` per definizione colonne | `uiPrimitives`, callback pagina/container |
| `apps/frontend/src/features/admin/pages/AdminChangelogPage.tsx` | Pagina orchestrator con toolbar, form publish e query state modularizzati | `AdminChangelogToolbar`, `AdminChangelogPublishForm`, `useAdminChangelogQuery`, `useAdminChangelogMutations` | `useAsyncQuery`, `feedback-center-client`, `useFeedbackMessage`, `@mui/material`, `ChangelogTable` |
| `apps/frontend/src/features/admin/ui/AdminChangelogFormShell.tsx` | Shell condiviso per il form changelog con headline e azioni standardizzate | Nessuna estrazione immediata | `AdminChangelogPublishForm`, `Surface`, `uiPrimitives` |
| `apps/frontend/src/features/admin/ui/AdminChangelogTableRow.tsx` | Componente azioni riga changelog separato dalla tabella per evitare duplicazione e markup invalido | Nessuna estrazione immediata | `ChangelogTable`, `uiPrimitives`, `ProductChangelogDto` |
| `apps/frontend/src/features/admin/changelog/ChangelogTable.tsx` | Tabella presentational pura con formatters condivisi e action group standardizzato | `formatAdminDateTime`, `AdminRowActions`, opzionale `changelog-columns.ts` | `ListingTableSection`, `uiPrimitives` |
| `apps/frontend/src/features/admin/pages/AdminUserReportsPage.tsx` | Pagina orchestrator con filtri, query state e mutation policy separati dal render | `AdminUserReportsToolbar`, `useAdminUserReportsFilters`, `useAdminUserReportsQuery`, `useAdminUserReportsMutations` | `useAsyncQuery`, `feedback-center-client`, `@mui/material`, `ReportsTable`, `useFeedbackMessage` |
| `apps/frontend/src/features/admin/ui/AdminUserReportsTableActions.tsx` | Azioni riga report separate dalla tabella con policy e stati disabilitazione coerenti | Nessuna estrazione immediata | `ReportsTable`, `admin-user-reports-policy`, `uiPrimitives` |
| `apps/frontend/src/features/admin/reports/ReportsTable.tsx` | Tabella presentational pura con gating rules e formatters spostati fuori dal body del componente | `canPublishIssue` in `reports-policy.ts`, `formatAdminDateTime`, `AdminRowActions` | `ListingTableSection`, `uiPrimitives`, contract `UserReport` |
| `apps/frontend/src/features/admin/pages/AdminActivityPage.tsx` | Pagina di sola composizione, con read model activity già preparato dal layer hook | `useAdminActivityFeed` | `useGenerationWorkspace`, `ActivityLogTable`, `appCopy` |
| `apps/frontend/src/features/admin/activity/ActivityLogTable.tsx` | Tabella presentational consistente con le altre viste admin, senza conoscenza del provider upstream | Nessuna estrazione immediata; solo convergenza su shared action/column helpers se necessari | `ToolCheckpoint` read model, `ui/table` shared |
| `apps/frontend/src/features/admin/runtime/admin-date-format.ts` | Helper condiviso per data admin con fallback coerente su tutte le tabelle | Nessuna estrazione immediata | `ChangelogTable`, `ReportsTable`, `ActivityLogTable` |
| `apps/frontend/src/features/admin/runtime/admin-user-reports-policy.ts` | Policy condivisa per decidere quando una segnalazione puo essere pubblicata come issue GitHub | Nessuna estrazione immediata | `ReportsTable`, `AdminUserReportsPage` |
| `apps/frontend/src/features/admin/runtime/useAdminMutationFeedback.ts` | Hook condiviso per normalizzare publishSuccess/publishError con dedupeKey stringa | Nessuna estrazione immediata | `useFeedbackMessage`, mutation hooks admin |
| `apps/frontend/src/features/admin/test/renderAdminPage.tsx` | Helper test condiviso per rendering pagine admin con router context coerente | Nessuna estrazione immediata | `Admin*Page.test.tsx`, `MemoryRouter`, `@testing-library/react` |
| `apps/frontend/src/features/admin/test/mockAdminSession.ts` | Helper test condiviso per stato sessione admin e override di ruolo/capabilities nei test | Nessuna estrazione immediata | `Admin*Page.test.tsx`, `AuthSessionProvider` mock |
| `apps/frontend/src/features/admin/test/msw-admin-factories.ts` | Factory MSW condivise per fixture/handler admin (`changelog`, `user-reports`) | Nessuna estrazione immediata | `AdminChangelogPage.test.tsx`, `AdminUserReportsPage.test.tsx`, `msw` |
| `apps/frontend/src/features/admin/routing/admin-guard.tsx` | Boundary di accesso admin stabile e isolato dalla composizione delle pagine | `AdminRouteBoundary` solo se servono loading/error/telemetry condivisi | `useAuthSession`, `Navigate`/routing app |
| `apps/frontend/src/features/admin/pages/AdminChangelogPage.test.tsx` | Test focalizzati su orchestration della pagina, con setup condiviso per sessione admin e feedback spy | `renderAdminPage`, `mockAdminSession`, factory MSW `buildChangelogHandlers` | `vitest`, `@testing-library/react`, `msw`, `MemoryRouter` |
| `apps/frontend/src/features/admin/pages/AdminUserReportsPage.test.tsx` | Test focalizzati su policy e orchestration, senza boilerplate ripetuto di mocks e handlers | `renderAdminPage`, `mockAdminSession`, factory MSW `buildUserReportsHandlers` | `vitest`, `@testing-library/react`, `msw`, `MemoryRouter` |

### 5.2 Sequencing Guidance

1. Partire da `AdminUsersPage.tsx`: e il file con la maggiore concentrazione di responsabilita e dara il massimo ritorno manutentivo.
2. Stabilizzare il pattern `query hook + mutation hook + toolbar + presentational table` su Models, Changelog e User Reports.
3. Consolidare helper condivisi per date, row actions e admin test harness solo dopo il primo slice riuscito, per evitare astrazioni premature.

## 6. Testing

- **TEST-001**: Test unitari per ogni componente atomico admin (Jest/React Testing Library)
- **TEST-002**: Test end-to-end (Cypress o Playwright) per flussi admin
- **TEST-003**: Test accessibilità (axe-core, jest-axe) su tutte le pagine admin
- **TEST-004**: Snapshot test per layout e feedback
- **TEST-005**: Validazione automatica: tutti i test e2e admin devono passare senza errori critici
- **TEST-006**: Copertura test accessibilità ≥ 90% sulle rotte admin

## 7. Risks & Assumptions

- **RISK-001**: Possibili regressioni su permessi/admin routing
- **RISK-002**: Integrazione incompleta con API legacy
- **ASSUMPTION-001**: Il design system è aggiornato e supporta i nuovi componenti
- **ASSUMPTION-002**: Le API backend sono stabili e documentate

## 8. Related Specifications / Further Reading

- [docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md]
- [docs/ux/admin-dashboard-jtbd.md]
- [docs/ux/admin-dashboard-journey.md]
- [docs/ux/admin-dashboard-flow.md]
- [docs/02-design/specifications/frontend-tool-pages-architecture-spec.md]
- [docs/01-requirements/domain-ubiquitous-language-glossary.md]
- [docs/02-design/domain-bounded-context-map.md]
- [docs/07-governance/domain-naming-decision-log.md]
