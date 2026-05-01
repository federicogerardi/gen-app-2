# Gen App 2 - Architettura Repository

Panoramica rapida dello schema logico e funzionale dell'applicazione full-stack (backend + frontend).

## 1) Obiettivo del sistema

Applicazione per generazione contenuti con:

- autenticazione a sessione (cookie + OAuth Google)
- streaming dei risultati di generazione (SSE)
- persistenza su PostgreSQL
- coordinamento idempotenza e lock su Redis
- UI React per workflow tools e gestione artifacts/progetti

## 2) Architettura ad alto livello

```text
Browser (React + XState)
	-> HTTPS same-origin
Frontend Runtime (Node — frontend/server.mjs)
	-> asset statici / SPA fallback
	-> HTTP proxy (Railway private network)
Backend Runtime (Node + TypeScript)
	-> PostgreSQL (dati applicativi)
	-> Redis (idempotenza, coordinamento)
```

Il browser comunica esclusivamente con il servizio frontend Railway. `frontend/server.mjs` serve la SPA e inoltra le route applicative (`/auth/*`, `/generation/*`, `/api/*`, `/admin/users/*`) al backend via networking privato Railway. Il backend non è esposto direttamente al browser.

## 3) Mappa repository

- `src/`: backend runtime, adapter infrastrutturali, macchine XState server-side
- `frontend/`: applicazione React + Vite, macchine XState client-side
- `db/migrations/`: schema SQL evolutivo
- `db/seeds/`: seed minimi e script esempi idempotenza
- `docs/`: specifiche as-is, ADR, governance, archivio lifecycle
- `plan/`: piani operativi attivi

## 4) Backend - schema logico/funzionale

Entry point backend: `src/server.ts`.

Responsabilita principali:

- bootstrap connessioni PostgreSQL e Redis
- configurazione CORS/CSRF e session cookie auth
- esposizione endpoint auth e generazione stream
- wiring adapter di produzione e runtime HTTP

Blocchi chiave:

- Runtime HTTP/Auth: `src/lib/runtime/`
- Adapter persistence e integrazione: `src/lib/adapters/`
- Orchestrazione state machine: `src/lib/machines/`

## 5) Frontend - schema logico/funzionale

Entry point frontend: `frontend/src/main.tsx` e `frontend/src/App.tsx`.
Runtime server: `frontend/server.mjs`.

Responsabilita principali:

- `server.mjs`: serve asset statici e SPA fallback; inoltra route applicative al backend via networking privato Railway; endpoint `/health` locale
- routing e layout applicativo
- orchestrazione UI dei flussi tool multi-step
- consumo stream backend con gestione stati/errore/retry
- rendering artifacts e pagine data-driven

Blocchi chiave:

- Server proxy runtime: `frontend/server.mjs`
- Feature modules: `frontend/src/features/`
- Runtime/API client: `frontend/src/features/**/runtime/`
- UI primitives/layout/provider: `frontend/src/app/`

## 6) Sezione dedicata: architettura XState

Il progetto usa XState v5 sia nel backend sia nel frontend, con separazione chiara tra orchestrazione dominio e trasporto.

### 6.1 Backend XState

Root machine: `src/lib/machines/generation-system.machine.ts`

Sottomacchine principali:

- `request-gateway.machine.ts`: ingresso richiesta e validazioni iniziali
- `idempotency-coordinator.machine.ts`: claim/replay/conflict request-idempotent
- `usage.machine.ts`: regole di consumo/quota
- `stream-transport.machine.ts`: trasporto stream e segnali sessione
- `extraction-chain.machine.ts`: pipeline extraction strutturata
- `tool-workflow.machine.ts`: avanzamento step dei tool
- `persistence-batch.machine.ts`: commit batch di persistenza

Funzione architetturale:

- rendere deterministico il workflow di generazione
- isolare failure mode e fallback per stato
- rendere testabili i passaggi critici per evento/transizione

### 6.2 Frontend XState

Macchine principali:

- `frontend/src/features/generation/machines/frontend-stream.machine.ts`
- `frontend/src/features/tools/machines/tool-flow.machine.ts`

Funzione architetturale:

- `frontend-stream.machine`: lifecycle stream (idle/connecting/streaming/completed/failed/reconnecting), monotonicita chunk, retry controllato
- `tool-flow.machine`: orchestrazione step tool (start, done/fail, retry, reset)

### 6.3 Principio di integrazione

- backend: autorita di stato dominio e persistenza
- frontend: autorita di stato interazione utente e presentazione
- protocollo eventi stream: ponte tra i due livelli

## 7) Flusso end-to-end (sintesi)

1. L'utente avvia una generazione dal frontend.
2. Il frontend invia request HTTP e apre stream SSE.
3. Il backend orchestra la richiesta via XState (idempotenza, usage, workflow tool, persistence).
4. Il frontend riceve eventi stream (start/chunk/terminal) e aggiorna UI/state machine.
5. Risultato finale salvato e consultabile come artifact.

## 8) Avvio rapido

Backend:

```bash
npm install
npm run db:migrate:minimal
npm run start:server
```

Frontend (sviluppo locale — Vite dev server):

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Frontend (produzione locale — server.mjs con proxy):

```bash
npm --prefix frontend run build
BACKEND_INTERNAL_URL=http://localhost:3000 node frontend/server.mjs
```

## 9) Documentazione architetturale consigliata

- `docs/index-overview.md`
- `docs/02-design/specifications/frontend-spec.md`
- `docs/02-design/specifications/deployment-architecture-guide.md`
- `docs/02-design/adr/frontend-data-access-layer-adr.md`
- `docs/02-design/specifications/xstate-system-as-is-spec.md`
