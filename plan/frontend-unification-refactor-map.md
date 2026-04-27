---
goal: Unificare il frontend riducendo duplicazioni runtime, pagine data-driven e wiring tool
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-27
owner: Frontend Platform Team
status: Planned
tags: [refactor, frontend, unification, architecture]
---

# Refactor Map - Frontend Unification

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Mappa operativa per consolidare pattern duplicati nel frontend con rollout incrementale, regressioni controllate e impatto minimo sul flusso prodotto.

## 1. Scope

- Unificare accesso HTTP, endpoint resolution e parsing errori.
- Unificare pattern di caricamento dati in pagine list/detail.
- Ridurre duplicazione nei wrapper pagine tool e parsing query params.
- Mantenere invariati API pubbliche e comportamento utente finale.

Out of scope:

- Redesign UI completo.
- Migrazione completa a librerie esterne di data fetching.
- Rework della state machine stream.

## 2. Baseline Duplication Map

### 2.1 Runtime/API duplicati

- Duplicazione helper URL join:
  - frontend/src/features/auth/runtime/auth-client.ts
  - frontend/src/features/projects/runtime/projects-client.ts
  - frontend/src/features/artifacts/runtime/artifacts-client.ts
  - frontend/src/features/tools/runtime/tools-client.ts
  - frontend/src/features/generation/runtime/generation-client.ts

- Fetch/error handling simile ma non centralizzato tra client feature.
- Endpoint hardcoded presenti (esempio: admin users) invece di registry centralizzato.

### 2.2 Pagine data-driven con pattern ripetuto

- Pattern ricorrente: useEffect + IIFE async + setState + catch/finally.
- Pagine coinvolte:
  - frontend/src/features/projects/pages/ProjectsListPage.tsx
  - frontend/src/features/projects/pages/ProjectDetailPage.tsx
  - frontend/src/features/artifacts/pages/ArtifactsPage.tsx
  - frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx
  - frontend/src/features/generation/pages/GenerationConsolePage.tsx
  - frontend/src/features/admin/pages/AdminUsersPage.tsx

### 2.3 Duplicazione wrapper tool pages

- Stessa logica readIntent/readOptional in:
  - frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx
  - frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx

## 3. Target Architecture

### 3.1 Data Access Layer unificato

- Nuovo modulo core runtime:
  - frontend/src/app/runtime/http-client.ts
- Responsabilita:
  - join URL sicuro.
  - wrapper fetch con credentials include di default.
  - parse JSON tipato.
  - mapping errori HTTP coerente.
  - helper request GET/POST con opzioni minime.

### 3.2 API Paths come single source of truth

- Estendere frontend/src/app/runtime/api-paths.ts con endpoint admin e altri eventuali gap.
- Vietare path hardcoded nei feature clients e nelle pagine.

### 3.3 Hook query/mutation leggeri per pagina

- Layer frontend/src/app/runtime/queries/ con hook riusabili:
  - useProjectsQuery
  - useProjectDetailQuery
  - useArtifactsQuery
  - useArtifactDetailQuery
- Pattern comune: loading/error/data/reload/cancel.

### 3.4 Tool entry params parser condiviso

- Nuovo modulo:
  - frontend/src/features/tools/runtime/tool-entry-params.ts
- Unica logica di parsing query per tutte le tool pages.

## 4. Phased Execution Plan

### Phase 0 - Safety Net (0.5-1 giorno)

Obiettivo:
Ridurre rischio regressioni prima del refactor strutturale.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P0-T01 | Catalogare test esistenti su runtime clients e pagine interessate. |  |  |
| P0-T02 | Aggiungere test mancanti minimi su path critici admin/projects/artifacts fetch error handling. |  |  |
| P0-T03 | Definire metriche baseline: LOC duplicato, numero helper join URL, numero fetch hardcoded. |  |  |

Completion criteria:

- Test baseline verdi su frontend.
- Metriche iniziali registrate.

### Phase 1 - HTTP/Core Unification (1-2 giorni)

Obiettivo:
Eliminare duplicazione trasversale del transport HTTP.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P1-T01 | Creare http-client.ts con joinApiPath, requestJson, requestVoid, typed errors. |  |  |
| P1-T02 | Migrare auth-client.ts a http-client.ts senza cambiare API pubblica. |  |  |
| P1-T03 | Migrare projects-client.ts a http-client.ts. |  |  |
| P1-T04 | Migrare artifacts-client.ts a http-client.ts. |  |  |
| P1-T05 | Migrare tools-client.ts e generation-client.ts dove applicabile. |  |  |
| P1-T06 | Rimuovere helper joinApiPath duplicati dai file migrati. |  |  |

Completion criteria:

- Nessun joinApiPath locale nei feature clients.
- API e behavior invariati lato consumer.

### Phase 2 - Endpoint Registry Consolidation (0.5-1 giorno)

Obiettivo:
Rendere api-paths il punto unico di definizione endpoint.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P2-T01 | Estendere api-paths con admin users/models/activity e utilita byId. |  |  |
| P2-T02 | Sostituire fetch hardcoded in AdminUsersPage con client dedicato. |  |  |
| P2-T03 | Introdurre admin-client.ts coerente con altri runtime clients. |  |  |
| P2-T04 | Verificare capability gating consistente su tutte le feature. |  |  |

Completion criteria:

- Nessun endpoint hardcoded nelle pagine.
- Tutte le chiamate passano da paths centralizzati.

### Phase 3 - Page Query Pattern Unification (1-2 giorni)

Obiettivo:
Ridurre boilerplate useEffect/state/error nelle pagine data-driven.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P3-T01 | Introdurre hook query condivisi in app/runtime/queries. |  |  |
| P3-T02 | Migrare ProjectsListPage e ProjectDetailPage ai nuovi hook. |  |  |
| P3-T03 | Migrare ArtifactsPage e ArtifactDetailPage ai nuovi hook. |  |  |
| P3-T04 | Migrare AdminUsersPage al pattern query condiviso. |  |  |
| P3-T05 | Uniformare rendering stati loading/error/empty con componenti shared. |  |  |

Completion criteria:

- Riduzione boilerplate useEffect nelle pagine target.
- Stati runtime coerenti tra list/detail pages.

### Phase 4 - Tool Wrapper Consolidation (0.5 giorno)

Obiettivo:
Eliminare duplicazione dei wrapper tool page.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P4-T01 | Creare parser query condiviso tool-entry-params.ts. |  |  |
| P4-T02 | Migrare FunnelPagesToolPage al parser condiviso. |  |  |
| P4-T03 | Migrare NextlandToolPage al parser condiviso. |  |  |
| P4-T04 | Aggiungere test unitari parser query e regressione wrapper. |  |  |

Completion criteria:

- Zero duplicazione readIntent/readOptional nei wrapper tool.

### Phase 5 - Hardening and Observability (0.5-1 giorno)

Obiettivo:
Consolidare affidabilita operativa post-refactor.

Tasks:

| Task | Description | Completed | Date |
| ---- | ----------- | --------- | ---- |
| P5-T01 | Uniformare taxonomy error codes nel client HTTP. |  |  |
| P5-T02 | Aggiungere logging opzionale debug per richieste fallite (non PII). |  |  |
| P5-T03 | Eseguire smoke test manuale flussi dashboard, projects, artifacts, tools. |  |  |
| P5-T04 | Freeze regressioni con test integration page-level critici. |  |  |

Completion criteria:

- Error handling consistente e osservabile.
- Nessuna regressione funzionale nei flussi principali.

## 5. ADR and Governance

Decisioni che richiedono ADR:

- Adozione di un Frontend Data Access Layer unico.
- Strategia di endpoint centralizzati con capability gating.
- Standard query hooks senza introdurre librerie esterne.

Proposta ADR:

- docs/architecture/ADR-001-frontend-data-access-layer.md

## 6. Dependencies and Sequencing

- Phase 1 dipende da Phase 0.
- Phase 2 puo partire in parallelo dopo P1-T01.
- Phase 3 dipende da Phase 1 e Phase 2.
- Phase 4 indipendente, ma consigliata dopo Phase 3 per ridurre conflitti.
- Phase 5 chiude il rollout dopo merge delle fasi precedenti.

## 7. Risk Register

- R1: Regressione silenziosa parsing payload tra client legacy e nuovo http-client.
- R2: Cambi involontari su messaggi errore visibili in UI (snapshot test utili).
- R3: Capability flags gestite in modo non omogeneo durante migrazione incrementale.
- R4: Race conditions nei nuovi hook query se cancel/reload non ben gestiti.

Mitigazioni:

- Migrazione file-by-file con test locali per ogni step.
- Preserve API contracts e messaggi utente esistenti dove possibile.
- Feature smoke checklist per ogni merge parziale.

## 8. Success Metrics

- M1: Riduzione helper URL locali da 5 a 0.
- M2: Riduzione fetch hardcoded nelle pagine da >0 a 0.
- M3: Riduzione blocchi useEffect IIFE duplicati nelle pagine target di almeno 40%.
- M4: Nessun aumento del failure rate test frontend post-refactor.

## 9. Open Questions

- Scala attesa nei prossimi 6 mesi (utenti/giorno, richieste/giorno).
- Vincoli team (preferenza per hook custom vs librerie query esterne).
- Budget/limiti osservabilita frontend (strumenti logging/monitoring disponibili).

## 10. Execution Checklist

- [ ] Approvazione sequenza fasi 0-5.
- [ ] Creazione ADR-001 prima della Phase 1 completa.
- [ ] Esecuzione refactor incrementale con PR piccole.
- [ ] Verifica KPI M1-M4 a chiusura.
