---
goal: Estendere la policy di disponibilita Tool con tre modalita deterministiche (enable for all, disable for all, enable only for admin)
version: 1.0
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Frontend Platform + Backend Runtime
status: Completed
tags: [feature, architecture, ddd, frontend, backend, auth]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano definisce l'estensione della policy di disponibilita dei Tool da modello binario a modello tri-state, mantenendo coerenza DDD-first e comportamento deterministico FE/BE.

## 1. Requirements & Constraints

- **REQ-001**: Introdurre una policy Tool con tre valori canonici: `enabled-for-all`, `disabled-for-all`, `enabled-for-admin-only`.
- **REQ-002**: Un Tool in stato `enabled-for-admin-only` deve essere visibile e utilizzabile solo da utenti con ruolo `admin`.
- **REQ-003**: Un Tool in stato `disabled-for-all` deve essere nascosto da Hub, routing pubblico tool e shortcut di navigazione.
- **REQ-004**: Un Tool in stato `enabled-for-all` deve mantenere il comportamento attuale per utenti `member` e `admin`.
- **REQ-005**: La risoluzione visibilita Tool deve essere centralizzata in un unico modulo FE.
- **REQ-006**: La validazione accesso Tool deve essere applicata anche lato backend runtime per impedire bypass client-side.
- **REQ-007**: Definire una singola fonte di verita FE/BE per la policy di disponibilita Tool, evitando mappe duplicate in moduli separati.
- **REQ-008**: Estendere moduli esistenti prima di introdurre nuovi file; nuova creazione consentita solo se documentata come inevitabile.
- **XST-001**: Le decisioni di accesso role-aware in frontend devono essere valutate a runtime su snapshot corrente dell'attore di sessione (`authSessionMachine`) e non in costanti statiche inizializzate a module-load.
- **XST-002**: Nessun side effect deve essere introdotto dentro `assign` nelle macchine XState esistenti; eventuali effetti restano in actor/services o in effetti React esterni.
- **XST-003**: In presenza di risposta `403` da endpoint tool, la UX deve rimanere deterministica: nessun stato macchina bloccato in `running/generating` senza recovery esplicito.
- **XST-004**: Le modifiche devono mantenere semantica XState v5 (transizioni interne di default, nessun pattern legacy v4).
- **SEC-001**: Nessun utente non-admin puo eseguire endpoint tool per Tool con policy `enabled-for-admin-only`.
- **SEC-002**: Tutte le risposte di blocco autorizzazione devono usare codici HTTP e error envelope gia canonici del runtime auth-http.
- **DDD-001**: Prima di modifiche a codice o test, aggiornare documenti canonici DDD con nuova nomenclatura policy.
- **CON-001**: Non introdurre sinonimi non canonici per `ToolAvailabilityStatus`; registrare decisione esplicita nel decision log.
- **CON-002**: Mantenere retrocompatibilita per i Tool attuali (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`).
- **CON-003**: Evitare nuova duplicazione logica di guard FE/BE: preferire helper condivisi e import da modulo contratti comune.
- **GUD-001**: Evitare logica duplicata di gating in componenti multipli; usare helper centrali riusabili.
- **PAT-001**: Applicare pattern esistente di role gate (`AdminGuard`) come riferimento per la parte frontend route-level.
- **PAT-002**: Applicare strategia "extend-existing": aggiornare `packages/contracts/src/tool-workflows.ts`, `tool-form-architecture.ts`, `app-router.tsx` e handler auth-http esistenti invece di introdurre nuove superfici.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Allineare la Ubiquitous Language e i vincoli DDD-first prima di qualsiasi intervento applicativo.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Aggiornare `docs/07-governance/domain-naming-decision-log.md` con nuova decisione (proposta ID: DDD-093) che estende `ToolAvailabilityStatus` a tri-state e definisce semantica per ruolo `AuthUserRole`. | ✅ | 2026-05-25 |
| TASK-001 | Aggiornare `docs/01-requirements/domain-ubiquitous-language-glossary.md` voce `ToolAvailabilityStatus` con i tre valori canonici e impatti su visibilita/uso. | ✅ | 2026-05-25 |
| TASK-002 | Aggiornare `docs/02-design/domain-bounded-context-map.md` nelle sezioni Frontend/UI e Integration Constraints con regola di traduzione ruolo-policy (member/admin). | ✅ | 2026-05-25 |
| TASK-003 | Aggiornare `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` per allineare nomenclatura UI e comportamento pagine Tool Workspace/Data Table View in presenza di Tool admin-only. | ✅ | 2026-05-25 |

### Implementation Phase 1

- GOAL-001: Introdurre modello tri-state in frontend runtime con API di selezione deterministica per ruolo.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Modificare `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`: sostituire `ToolFormConfig.status` con `ToolFormConfig.availabilityPolicy` (union literal tri-state) e migrare `toolFormRegistry`. | ✅ | 2026-05-25 |
| TASK-005 | Aggiungere helper centrali in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`: `canRoleAccessTool(role, toolKey)`, `getVisibleToolKeysForRole(role)`, `getVisibleToolNavigationItemsForRole(role)` importando policy dal modulo contratti condiviso. | ✅ | 2026-05-25 |
| TASK-006 | Mantenere compatibilita temporanea senza nuova logica: rendere `getEnabledToolKeys` un alias puro verso helper role-aware (nessuna mappa o branch dedicato). | ✅ | 2026-05-25 |
| TASK-007 | Aggiornare test unitari `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts` con casi per i tre stati e due ruoli (`admin`, `member`). | ✅ | 2026-05-25 |

### Implementation Phase 2

- GOAL-002: Applicare gating frontend su routing e discovery Tool.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Aggiornare `apps/frontend/src/features/tools/pages/ToolsHubPage.tsx` per usare `useAuthSession()` e `getVisibleToolNavigationItemsForRole(session.user.role)`. | ✅ | 2026-05-25 |
| TASK-009 | Aggiornare `apps/frontend/src/app/routing/app-router.tsx`: sostituire costruzione statica `TOOL_ROUTES` basata su enabled con route table completa + guard inline riusando pattern `AdminGuard` (redirect a `/tools` su accesso non consentito). | ✅ | 2026-05-25 |
| TASK-010 | Evitare nuovo file guard se non necessario: implementare la logica in `app-router.tsx` tramite wrapper locale e helper condivisi da `tool-form-architecture.ts`. Creare file dedicato solo se l'inline guard produce duplicazione non eliminabile. | ✅ | 2026-05-25 |
| TASK-011 | Aggiornare test `apps/frontend/src/features/tools/pages/ToolsHubPage.test.tsx` e `apps/frontend/src/app/routing/app-router.test.tsx` con scenari: member non vede/admin-only, admin vede/admin-only, member redirect su route admin-only. | ✅ | 2026-05-25 |

### Implementation Phase 2A

- GOAL-002A: Validare impatto XState sul flusso FE senza introdurre regressioni di orchestrazione.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011A | In `apps/frontend/src/app/routing/app-router.tsx` evitare la derivazione role-aware a module scope; mantenere la decisione in component boundary dove e disponibile snapshot sessione corrente (`useAuthSession`). | ✅ | 2026-05-25 |
| TASK-011B | Verificare in `apps/frontend/src/features/tools/runtime/useToolPage.ts` che i fallimenti autorizzativi (`403`) convergano su recovery gia canonica (`dispatchError` + cancellazione generazione) senza lasciare actor in stato incoerente. | ✅ | 2026-05-25 |
| TASK-011C | Aggiungere test di integrazione FE che simulano cambio ruolo/snapshot (member -> admin e admin -> member) e verificano riallineamento deterministico di route access e CTA senza refresh manuale. | ✅ | 2026-05-25 |

### Implementation Phase 3

- GOAL-003: Applicare enforcement backend per impedire bypass client-side su Tool admin-only.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Estendere `packages/contracts/src/tool-workflows.ts` con mappa canonica `ToolKey -> availabilityPolicy` + helper `resolveToolAvailabilityPolicy` e importarla sia in FE che BE (fonte unica, nessuna mappa duplicata). | ✅ | 2026-05-25 |
| TASK-013 | Integrare check policy in `apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts` prima della business logic upload brief: rifiutare `member` su tool `enabled-for-admin-only` con `403 forbidden`. | ✅ | 2026-05-25 |
| TASK-014 | Integrare check policy in `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts` per bloccare orchestrazione non autorizzata su tool admin-only. | ✅ | 2026-05-25 |
| TASK-015 | Integrare check policy in `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts` e `tools-hydrate-handlers.ts` quando richiesta e contestualizzata da `toolKey`, mantenendo compatibilita per payload legacy senza `toolKey` e evitando branch ridondanti per endpoint. | ✅ | 2026-05-25 |
| TASK-016 | Aggiungere/estendere test backend in `apps/backend/src/lib/tests/` per casi autorizzativi member/admin su endpoint tools coinvolti + test di coerenza import policy dal modulo contratti (nessuna copia locale). | ✅ | 2026-05-25 |

### Implementation Phase 4

- GOAL-004: Consolidare convergenza FE/BE, quality gate e regressioni.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Eseguire quality gate FE: `npm --workspace apps/frontend run typecheck`, `npm --workspace apps/frontend run test`. | ✅ | 2026-05-25 |
| TASK-018 | Eseguire quality gate BE: `npm --workspace apps/backend run typecheck`, `npm --workspace apps/backend run test`. | ✅ | 2026-05-25 |
| TASK-019 | Eseguire quality gate workspace: `npm run typecheck`, `npm run test`. | ✅ | 2026-05-25 |
| TASK-020 | Aggiornare eventuali piani/documenti correlati in `plan/` e `docs/07-governance/` con link al nuovo comportamento policy. | ✅ | 2026-05-25 |

## 3. Alternatives

- **ALT-001**: Gestire policy solo frontend senza enforcement backend. Scartata: permette bypass tramite chiamate dirette agli endpoint.
- **ALT-002**: Creare route separate `/admin/tools/:toolKey` per tool admin-only. Scartata: aumenta duplicazione routing e divergenza UX.
- **ALT-003**: Lasciare policy binaria e introdurre flag admin-only separato. Scartata: introduce modello ibrido ambiguo non canonico.
- **ALT-004**: Definire mappa policy separata in FE e BE. Scartata: aumenta drift e costo manutenzione; preferita fonte unica in contratti condivisi.

## 4. Dependencies

- **DEP-001**: Coerenza con tipi ruolo auth FE `apps/frontend/src/features/auth/runtime/auth-client.ts` (`AuthUserRole`).
- **DEP-002**: Coerenza con validazione ruolo runtime BE `apps/backend/src/lib/runtime/auth-http/runtime.ts` (`requireAdminPrincipal`, `requireSessionPrincipal`).
- **DEP-003**: Coerenza con mappa ToolKey e nuova policy availability in `packages/contracts/src/tool-workflows.ts`.
- **DEP-004**: Aggiornamento documentazione canonica DDD prima delle modifiche applicative (Phase 0).

## 5. Files

- **FILE-001**: `docs/07-governance/domain-naming-decision-log.md` - decisione DDD sulla nuova policy tri-state.
- **FILE-002**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` - aggiornamento termine `ToolAvailabilityStatus`.
- **FILE-003**: `docs/02-design/domain-bounded-context-map.md` - regole di integrazione FE/BE per role-aware availability.
- **FILE-004**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` - regole UI per tool admin-only.
- **FILE-005**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` - selector role-aware riusando policy da contratti condivisi.
- **FILE-006**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts` - test unitari tri-state.
- **FILE-007**: `apps/frontend/src/features/tools/pages/ToolsHubPage.tsx` - filtro tool visibili per ruolo.
- **FILE-008**: `apps/frontend/src/features/tools/pages/ToolsHubPage.test.tsx` - test hub visibilita per ruolo.
- **FILE-009**: `apps/frontend/src/app/routing/app-router.tsx` - route guarding policy-aware.
- **FILE-010**: `packages/contracts/src/tool-workflows.ts` - estensione con availability policy canonica + helper di risoluzione condivisi.
- **FILE-011**: `apps/frontend/src/app/routing/app-router.test.tsx` - test redirect/accesso per role-policy.
- **FILE-011A**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` - verifica recovery path XState in caso `403` su dispatch tool.
- **FILE-011B**: `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` - test regressione su recovery autorizzativa e assenza deadlock actor.
- **FILE-012**: `apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts` - enforcement accesso upload brief.
- **FILE-013**: `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts` - enforcement orchestrazione.
- **FILE-014**: `apps/backend/src/lib/runtime/auth-http/tools-session-handlers.ts` - enforcement lettura sessioni tool-aware.
- **FILE-015**: `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts` - enforcement hydration tool-aware.
- **FILE-016**: `apps/backend/src/lib/tests/` - suite autorizzativa endpoint tools.

## 6. Testing

- **TEST-001**: Unit FE su selector policy role-aware in `tool-form-architecture.test.ts` (matrix 3 policy x 2 ruoli).
- **TEST-002**: UI FE su ToolsHub per visibilita card coerente con policy e ruolo.
- **TEST-003**: Routing FE per redirect member su route admin-only e accesso admin consentito.
- **TEST-003A**: Test XState-oriented su snapshot sessione che cambia ruolo e riallinea immediatamente visibilita/accesso tool.
- **TEST-003B**: Test runtime `useToolPage` su errore `403` con verifica recovery (`dispatchError` valorizzato, generazione annullata, CTA nuovamente deterministica).
- **TEST-004**: Backend auth-http per `403 forbidden` su member in endpoint tool admin-only.
- **TEST-005**: Backend regression per tool `enabled-for-all` invariato su member/admin.
- **TEST-006**: Contract test di coerenza policy map FE/BE sui ToolKey supportati.
- **TEST-007**: Test di non-regressione su riuso: FE e BE importano policy da `packages/contracts/src/tool-workflows.ts` senza definizioni locali duplicate.

## 7. Risks & Assumptions

- **RISK-001**: Divergenza policy tra FE e BE se mappe mantenute in due file distinti.
- **RISK-001A**: Introduzione involontaria di nuovo file guard/policy puo riaprire duplicazione semantica gia risolta.
- **RISK-002**: Regressione routing se `TOOL_ROUTES` rimane statico senza guard role-aware.
- **RISK-002A**: Se la decisione role-aware resta a module initialization, lo snapshot XState di sessione puo divergere dalla route table fino a reload pagina.
- **RISK-003**: Endpoint legacy senza `toolKey` possono ridurre enforcement in alcuni flussi storici.
- **ASSUMPTION-001**: I ruoli applicativi validi restano `admin` e `member`.
- **ASSUMPTION-002**: Tutti i Tool runtime continuano a essere rappresentati da `ToolKey` in `packages/contracts`.
- **ASSUMPTION-003**: Il team accetta la strategia di estensione moduli esistenti come default; nuovi file solo con motivazione esplicita.

## 8. Related Specifications / Further Reading

[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
