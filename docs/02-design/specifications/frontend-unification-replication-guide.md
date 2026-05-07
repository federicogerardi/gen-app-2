---
status: approved
version: 1.0
last-reviewed: 2026-04-27
next-review-date: 2026-07-27
owner: Frontend Platform Team
---

# Frontend Unification Replication Guide

> ⚑ **DDD Reference**: This guide covers Frontend/UI bounded context infrastructure (data access layer). For canonical domain terminology, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) — `ExtractionContext` (DDD-013), `ToolPage` (DDD-004), `HydrationResult` (DDD-020)
> - [Domain Bounded Context Map](../domain-bounded-context-map.md#frontend--ui-context) — Frontend/UI Context, data access responsibilities
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — DDD-051, DDD-052 (SessionSummary listing and route namespace separation)
> - [Frontend Data Access Layer ADR](../adr/frontend-data-access-layer-adr.md) — architectural decision backing this guide

Data: 2026-04-27
Stato: Active
Version: 1.0

Guida canonica per replicare l'approccio di unificazione frontend adottato nel progetto dopo il refactor completato il 2026-04-27.

Obiettivo:

- evitare nuova duplicazione strutturale;
- mantenere un solo punto di verita per transport HTTP, endpoint, query hooks e parsing condiviso;
- rendere i nuovi sviluppi coerenti con il target architetturale gia implementato.
- mantenere uniforme anche il rendering degli stati pagina e l'osservabilita tecnica minima del layer HTTP.

## 1. Ambito dell'unificazione

L'unificazione implementata copre quattro aree operative:

1. transport HTTP condiviso;
2. registry centralizzato degli endpoint;
3. query hooks riusabili per pagine list/detail;
4. parser condivisi per wrapper e ingressi URL.

Completamenti successivi consolidati:

5. componenti shared per loading/error/empty state;
6. debug opzionale delle richieste HTTP fallite;
7. copertura page-level sui percorsi critici migrati.

## 2. Stato target da preservare

### 2.1 Transport HTTP

Fonte canonica:

- `frontend/src/app/runtime/http-client.ts`

Regole:

- tutte le richieste HTTP non-streaming devono passare da `joinApiPath`, `requestJson` o `requestVoid`;
- i feature client non devono ridefinire helper locali di composizione URL;
- gli errori HTTP devono essere normalizzati nel layer runtime, non nelle pagine;
- `credentials: 'include'` resta obbligatorio per le superfici autenticate.
- il debug HTTP opzionale, quando attivato, deve loggare solo metadati tecnici minimi e mai payload utente.

### 2.2 Endpoint registry

Fonte canonica:

- `frontend/src/app/runtime/api-paths.ts`

Regole:

- gli endpoint devono essere dichiarati nel registry prima di essere consumati;
- le pagine non devono contenere path hardcoded `/api/*`, `/auth/*`, `/admin/*`, `/generation/*`;
- il capability gating deve essere espresso nel registry o nei client, non nei componenti visuali.

### 2.3 Query hooks condivisi

Fonte canonica:

- `frontend/src/app/runtime/queries/`

Pattern standard:

- output shape uniforme: `{ data, loading, error, reload }`;
- cancellazione locale tramite flag per evitare `setState` dopo unmount;
- fallback e trasformazioni dati nei runtime client, non nelle pagine;
- uso preferenziale per pagine list/detail data-driven.

Hook attivi:

- `useProjectsQuery`
- `useProjectDetailQuery`
- `useSessionsQuery`
- `useArtifactsQuery`
- `useArtifactDetailQuery`
- `useAdminUsersQuery`

Session aggregation rule:
- project contextual navigation must use `SessionSummary[]` filtered by `projectId`;
- `artifacts` namespace remains non-aggregated history/detail only.

Componenti shared per il rendering degli stati:

- `LoadingStateMessage`
- `ErrorStateMessage`
- `EmptyStateMessage`

### 2.4 Parser condivisi per wrapper

Fonte canonica:

- `frontend/src/features/tools/runtime/tool-entry-params.ts`

Regole:

- il parsing di query params riusabili deve essere centralizzato in utility pure;
- i wrapper di pagina devono restare sottili e privi di logica duplicata;
- qualunque nuovo tool deve riusare parser esistenti o estendere il parser condiviso.

## 3. Architettura operativa risultante

```text
pages/
  -> query hooks shared
  -> feature runtime clients
  -> app/runtime/http-client.ts
  -> app/runtime/api-paths.ts
```

Separazione responsabilita:

- `app/runtime`: infrastruttura condivisa e contratti trasversali;
- `features/*/runtime`: adattatori feature-aware e mapping payload;
- `app/runtime/queries`: orchestration data-loading riusabile;
- `features/*/pages`: rendering, wiring UI e composizione shell;
- `features/*/runtime/*-params.ts`: parser e helper condivisi di ingresso.

## 4. Procedura obbligatoria per nuovi sviluppi

### 4.1 Quando aggiungi una nuova pagina data-driven

Sequenza obbligatoria:

1. aggiungi o riusa endpoint in `frontend/src/app/runtime/api-paths.ts`;
2. aggiungi o estendi il runtime client nella feature corretta;
3. se il pattern e list/detail, crea o riusa un query hook in `frontend/src/app/runtime/queries/`;
4. nella pagina usa solo hook shared e componenti shared per loading/error/empty quando il pattern e standard;
5. aggiungi test mirato della pagina o del hook introdotto.

Da evitare:

- `fetch()` direttamente nella pagina;
- `useEffect + IIFE async` replicato quando il pattern e gia coperto da hook shared;
- costruzione manuale degli URL dentro il componente.

### 4.2 Quando aggiungi un nuovo runtime client

Sequenza obbligatoria:

1. dichiarare gli endpoint nel registry;
2. importare `joinApiPath`, `requestJson`, `requestVoid` da `http-client.ts`;
3. mappare il payload in tipi feature-specifici;
4. trasformare l'errore tecnico in messaggio compatibile con il contratto UI esistente;
5. aggiungere test unitari sul client.

Da evitare:

- helper `joinApiPath` locali;
- gestione incoerente di status `404` o capability disabled;
- logica di fallback nel componente visuale se puo stare nel client.

### 4.3 Quando aggiungi un nuovo tool page wrapper

Sequenza obbligatoria:

1. riusare `ToolPageTemplate`;
2. leggere i query params tramite `parseToolEntryParams()` o estensione equivalente;
3. mantenere il wrapper come pass-through verso la configurazione tool-specifica;
4. coprire parser e wrapper con test minimo se viene introdotta nuova semantica di ingresso.

## 5. Checklist di code review

Una modifica frontend e accettabile solo se tutte le risposte sono "si":

- usa il layer `http-client.ts` per le richieste non-streaming?
- evita endpoint hardcoded nelle pagine?
- evita nuovi `joinApiPath` locali?
- evita nuova duplicazione di `useEffect + IIFE async` dove esiste gia un hook shared?
- evita markup inline duplicato per loading/error/empty state se esistono componenti shared?
- mantiene le pagine focalizzate sul rendering?
- aggiorna test e documentazione quando introduce un nuovo pattern condiviso?

## 6. Metriche di regressione da monitorare

Metriche baseline post-unificazione:

- helper `joinApiPath` locali nei runtime client: `0`
- endpoint hardcoded nelle pagine production: `0`
- pattern `useEffect + IIFE async` nelle pagine target del refactor: `1`
- shared page-state components disponibili nel layer UI comune: `3`
- copertura page-level dei percorsi critici migrati: presente per projects list/detail, sessions list/detail, and artifacts list/detail

Ogni nuovo ciclo di refactor o feature deve preservare o migliorare questi valori.

## 7. Decisioni di estensione future

Estendere l'approccio quando:

- almeno due pagine condividono lo stesso pattern di caricamento;
- due feature client duplicano mapping/error handling comparabili;
- un wrapper di pagina contiene piu logica di parsing che di composizione.

Non estendere l'approccio quando:

- la logica e davvero one-off e non ha un secondo consumer prevedibile;
- l'astrazione introdurrebbe branching specifico maggiore della duplicazione rimossa;
- il comportamento stream/actor dipende da contratti runtime specializzati gia isolati.

## 8. Validazione minima obbligatoria

Per ogni modifica coerente con questa guida:

1. `npm --prefix frontend run typecheck`
2. `npm --prefix frontend run test`
3. smoke mirato della pagina o del flusso toccato

## 9. Riferimenti canonici

- [Frontend as-is](./frontend-spec.md)
- [Frontend Tool Pages Architecture](./frontend-tool-pages-architecture-spec.md)
- [Tool Generation Flow Source Of Truth (Frontend)](./tool-generation-flow-source-of-truth-spec.md) — UX state routing, form behavior, state-to-action mapping
- [Unified Frontend Data Access Layer ADR](../adr/frontend-data-access-layer-adr.md)
