---
goal: Railway Same-Origin Unified Deployment Plan
version: 1.0
date_created: 2026-05-01
last_updated: 2026-05-01
owner: Platform/DevOps
status: deprecated
tags: [infrastructure, deployment, railway, same-origin, auth, frontend, backend, migration]
---

# Introduction

![Status: Deprecated](https://img.shields.io/badge/status-Deprecated-lightgrey)

> **Deprecato 2026-05-01.** Questo piano è stato superseded dall'esecuzione completa di [`architecture-railway-private-network-same-origin-1`](./architecture-railway-private-network-same-origin-1.md), che ha implementato la topologia same-origin via private-network Railway (`frontend/server.mjs`) portandola in produzione. I task di questo piano non sono stati eseguiti perché la soluzione alternativa li ha resi ridondanti. Conservato come riferimento storico della strategia pianificata.

Piano unificato che integra la strategia di migrazione same-origin Railway (3 fasi) con il piano implementativo infrastrutturale. Obiettivo: esporre frontend e backend sotto un unico host pubblico Railway, con routing same-origin trasparente per il browser, sessioni cookie-based stabili e fallback rollback documentato per ogni sprint.

Il piano è strutturato in 5 sprint progressivi. Ogni sprint è indipendentemente verificabile e dispone di criteri GO/NO-GO espliciti prima di avanzare al successivo.

Target architetturale:

```
https://app.<domain>/               -> frontend (static)
https://app.<domain>/api/*          -> backend Railway
https://app.<domain>/auth/*         -> backend Railway
https://app.<domain>/generation/*   -> backend Railway
https://app.<domain>/admin/users/*  -> backend Railway
```

## 1. Requirements & Constraints

- **REQ-001**: Il browser deve usare esclusivamente path relativi same-origin; nessun `VITE_API_BASE_URL` hardcoded in produzione.
- **REQ-002**: Il backend resta un server Node persistente su Railway con supporto SSE, cookie-based auth, PostgreSQL e Redis.
- **REQ-003**: Il layer di proxy/routing deve inoltrare senza trasformazioni funzionali le route `/auth/*`, `/generation/*`, `/api/*` e `/admin/users/*` al backend Railway.
- **REQ-004**: Ogni configurazione di infrastruttura deve essere versionata nel repository e riproducibile.
- **REQ-005**: Il flusso Google OAuth deve funzionare end-to-end con callback e redirect coerenti con il dominio same-origin finale.
- **SEC-001**: Cookie di sessione `HttpOnly` e `Secure` in produzione.
- **SEC-002**: `AUTH_COOKIE_SAMESITE=lax` per topologia same-origin.
- **SEC-003**: `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` limitati alla singola origine pubblica del frontend.
- **OPS-001**: Ogni sprint deve avere rollback documentato ed eseguibile entro 10 minuti.
- **OPS-002**: Nessun downtime durante Fase 1 (Foundation); downtime massimo 5 minuti tollerato in Fase 2 (Cutover).
- **CON-001**: Non introdurre la variante cross-origin come target implementativo in questo ciclo.
- **CON-002**: Non modificare il modello auth da cookie-based a token-based.
- **CON-003**: Non modificare contratti API o comportamenti XState durante la migrazione.
- **GUD-001**: Configurazione infrastrutturale tramite file versionati, non passaggi manuali fuori repository.
- **PAT-001**: Allinearsi alla topologia già documentata in `docs/02-design/specifications/deployment-architecture-guide.md`.

## 2. Implementation Steps

### Sprint 0 — Baseline & Documentation

- **GOAL-001**: Formalizzare la topologia same-origin come unica architettura target e congelare la baseline pre-migrazione.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Aggiornare `docs/02-design/specifications/deployment-architecture-guide.md` per dichiarare same-origin come topologia di deploy raccomandata e unica, con schema host e route di inoltro espliciti. | | |
| TASK-002 | Documentare nel deployment guide il mapping route → backend: `/auth/*`, `/generation/*`, `/api/*`, `/admin/users/*` con host backend Railway target. | | |
| TASK-003 | Documentare nel deployment guide tutte le env obbligatorie backend per produzione: `DATABASE_URL`, `UPSTASH_REDIS_URL`, `NODE_ENV`, `FRONTEND_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH`. | | |
| TASK-004 | Aggiornare `.env.example` con separazione esplicita sezione `# LOCAL` e sezione `# PRODUCTION`, coprendo tutte le env obbligatorie senza valori segreti reali. | | |
| TASK-005 | Fotografare la configurazione cross-origin attuale: valori `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `AUTH_COOKIE_SAMESITE`, `FRONTEND_ORIGIN` e domini Railway in uso. Salvare come commento nel deployment guide sotto `## Baseline Pre-Migrazione`. | | |

**Criteri GO Sprint 0:**
- Deployment guide aggiornato con topologia same-origin e route esplicite.
- `.env.example` copre tutte le variabili di produzione.
- Baseline cross-origin documentata e recuperabile in caso di rollback.

**Rollback Sprint 0:** Non richiesto (solo documentazione).

---

### Sprint 1 — Foundation (Dual Host, Zero-Risk)

- **GOAL-002**: Configurare domini custom su Railway e validare che entrambi i servizi siano healthy sui nuovi domini, senza modificare ancora il routing utente.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-006 | Configurare custom domain per il servizio backend su Railway (es. `api.<domain>`). Verificare che `GET /health` risponda 200. | | |
| TASK-007 | Configurare custom domain per il servizio frontend su Railway (es. `app.<domain>`). Verificare che la SPA carichi correttamente. | | |
| TASK-008 | Aggiungere il nuovo frontend domain (`app.<domain>`) a `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` del backend, mantenendo gli origin legacy separati da virgola. | | |
| TASK-009 | Eseguire smoke funzionale su `app.<domain>`: login, logout, session refresh su desktop e mobile reale. Verificare assenza di 401/403 anomali. | | |

**Criteri GO Sprint 1:**
- `GET /health` risponde 200 su entrambi i nuovi domini.
- Login persistente su mobile dopo refresh senza logout involontario.
- Nessun incremento di 401/403 nelle route auth/api rispetto alla baseline.

**Rollback Sprint 1:**
1. Rimuovere `app.<domain>` da `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS`.
2. Reindirizzare traffico al dominio frontend precedente.

---

### Sprint 2 — Same-Origin Cutover

- **GOAL-003**: Attivare il layer di routing same-origin su Railway e aggiornare le env backend per la topologia unificata.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-010 | Configurare il layer di routing same-origin su Railway: aggiornare `frontend/railway.toml` con direttive di proxy verso il backend Railway, oppure introdurre un servizio proxy dedicato nel progetto Railway. Committare la configurazione nel repository. | | |
| TASK-011 | Implementare i rewrite proxy per `/auth/*`, `/generation/*`, `/api/*` e `/admin/users/*` verso l'host backend Railway nella configurazione del Sprint 2. | | |
| TASK-012 | Aggiungere il fallback SPA per tutte le route client-side non-API verso `frontend/dist/index.html`, senza intercettare le quattro famiglie di route backend. | | |
| TASK-013 | Documentare in `frontend/README.md` il comando di build (`npm --prefix frontend run build`), il path di publish (`frontend/dist`) e il target Railway del servizio frontend. | | |
| TASK-014 | Aggiornare le env backend per same-origin: `FRONTEND_ORIGIN=https://app.<domain>`, `CORS_ALLOWED_ORIGINS=https://app.<domain>`, `CSRF_TRUSTED_ORIGINS=https://app.<domain>`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`. | | |
| TASK-015 | Definire `GOOGLE_REDIRECT_URI` coerente con `https://app.<domain>/auth/google/callback` esposta tramite rewrite same-origin. Aggiornare la configurazione sul Google Cloud Console. | | |
| TASK-016 | Verificare che `GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH` punti a un path frontend valido servito dalla SPA (es. `/dashboard`). | | |

**Criteri GO Sprint 2:**
- Nessun errore CORS lato browser su `app.<domain>`.
- Login persistente su mobile dopo refresh.
- SSE `GET /generation/stream` funzionante senza timeout anomali.
- OAuth callback end-to-end completato sul dominio unificato.
- `VITE_API_BASE_URL` non necessario in produzione (path relativi operativi).

**Rollback Sprint 2:**
1. Ripristinare routing cross-origin (frontend e backend su host separati).
2. Ripristinare env backend baseline cross-origin (da Sprint 0 TASK-005).
3. Se ritorno a cross-origin: ripristinare `AUTH_COOKIE_SAMESITE=none` se necessario.

---

### Sprint 3 — Validation & Go-Live Gate

- **GOAL-004**: Validare la topologia same-origin end-to-end con checklist eseguibili e gate CI obbligatori prima del go-live definitivo.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-017 | Eseguire gate CI backend: `npm run typecheck`, `npm run test`, `set -a && . ./.env.local && set +a && npm run test:smoke`. Tutti i gate devono passare con exit 0. | | |
| TASK-018 | Eseguire gate CI frontend: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm --prefix frontend run build`. Tutti i gate devono passare con exit 0. | | |
| TASK-019 | Produrre checklist pre-deploy nel deployment guide con comandi esatti: build, typecheck, test, smoke, env check. | | |
| TASK-020 | Produrre checklist post-deploy nel deployment guide con verifiche: bootstrap sessione, login, logout, streaming SSE, accesso admin, routing SPA, callback OAuth. | | |
| TASK-021 | Eseguire smoke verification same-origin con richieste HTTP dirette a `https://app.<domain>`: verificare che le route rewrite raggiungano il backend senza CORS errors e che `GET /auth/session` ritorni stato sessione corretto. | | |
| TASK-022 | Verificare attributi cookie sessione post-login: `HttpOnly`, `Secure`, `SameSite=Lax` su `app.<domain>`. | | |

**Criteri GO Sprint 3 (GO/NO-GO definitivo):**

GO solo se:
- Healthcheck verdi su entrambi i servizi Railway.
- Login persistente validato su mobile reale.
- SSE e CRUD principali validati end-to-end.
- Tutti i gate CI verdi.
- Piano rollback verificato e documentato.

NO-GO se:
- 401/403 in aumento dopo cutover.
- OAuth callback fallisce su dominio target.
- Route backend non raggiungibili dal dominio unificato.
- Errori CORS residui nel browser.

---

### Sprint 4 — Hardening & Cleanup

- **GOAL-005**: Consolidare lo stato same-origin, rimuovere configurazioni legacy e completare la finestra di osservazione prima della chiusura del piano.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-023 | Rimuovere origin legacy da `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` del backend, mantenendo solo `https://app.<domain>`. | | |
| TASK-024 | Aggiornare runbook operativo e alert: soglie 401/403 auth, healthcheck frontend/backend, errori SSE, latenza mediana upload→completion. | | |
| TASK-025 | Eseguire finestra di osservazione di 7 giorni: nessun incidente auth/sessione mobile, nessun uso residuo domini legacy nei client attivi. | | |
| TASK-026 | Registrare la variante cross-origin (due origini pubbliche distinte) come analisi differita in `docs/99-lifecycle/99-archive/infrastructure-same-origin-deployment-1.md` sezione `Deferred Analysis`, senza inserirla nella checklist operativa. | | |
| TASK-027 | Aggiornare `docs/index-overview.md`: spostare questo piano da `planned` a `completed`, aggiornare `last-reviewed` e `Current Delta`. | | |

**Criteri di chiusura Sprint 4:**
- 7 giorni di osservazione senza incidenti auth/sessione.
- Nessun uso residuo domini legacy.
- Documentazione operativa aggiornata.
- Piano marcato `Completed`.

**Rollback Sprint 4:**
- Non richiesto se finestra di osservazione completata.
- In caso di regressione severa: riattivare snapshot routing Sprint 2 e riaprire piano.

## 3. Alternatives

- **ALT-001**: Frontend e backend su due origini pubbliche distinte. Scartato: aumenta rischio cookie cross-site, CORS, CSRF e OAuth. Registrato come analisi differita.
- **ALT-002**: Unificazione frontend e backend nello stesso processo server. Scartato: architettura già strutturata con frontend statico separato.
- **ALT-003**: Passaggio da cookie-based a bearer token. Scartato: cambia il modello auth fuori scope.
- **ALT-004**: Hosting frontend su Netlify o Vercel con rewrite verso Railway backend. Scartato: introduce dipendenza su provider terzo e complica governance infrastrutturale; Railway è il provider unico.

## 4. Dependencies

- **DEP-001**: Progetto Railway con servizi frontend e backend già deployati e healthy.
- **DEP-002**: Domini custom disponibili e DNS gestibile per `app.<domain>` e `api.<domain>`.
- **DEP-003**: Healthcheck attivi su entrambi i servizi Railway.
- **DEP-004**: PostgreSQL raggiungibile dal backend di produzione Railway.
- **DEP-005**: Redis (Upstash) raggiungibile dal backend di produzione Railway.
- **DEP-006**: Credenziali Google OAuth con possibilità di aggiornare `GOOGLE_REDIRECT_URI` su Google Cloud Console.

## 5. Files

- **FILE-001**: `docs/02-design/specifications/deployment-architecture-guide.md` — aggiornare con topologia same-origin, route di inoltro e baseline pre-migrazione.
- **FILE-002**: `.env.example` — estendere con env di produzione distinte da quelle locali.
- **FILE-003**: `frontend/railway.toml` — aggiornare con direttive di proxy/routing same-origin verso backend Railway.
- **FILE-004**: `frontend/README.md` — documentare build command, publish path e target Railway.
- **FILE-005**: `plan/feature-railway-same-origin-unified-1.md` — questo piano.
- **FILE-006**: `docs/99-lifecycle/99-archive/infrastructure-same-origin-deployment-1.md` — archiviato, status `archived`.
- **FILE-007**: `docs/99-lifecycle/99-archive/railway-same-origin-migration-strategy-3-phases.md` — archiviato, status `archived`.

## 6. Testing

- **TEST-001**: `npm --prefix frontend run build` → generazione `frontend/dist` senza errori.
- **TEST-002**: `npm --prefix frontend run typecheck` → exit 0.
- **TEST-003**: `npm run typecheck` → exit 0.
- **TEST-004**: `npm run test` → tutti i test passano.
- **TEST-005**: `set -a && . ./.env.local && set +a && npm run test:smoke` → smoke OK.
- **TEST-006**: `GET /health` su `app.<domain>` e `api.<domain>` → 200.
- **TEST-007**: `GET /auth/session` da `app.<domain>` → nessun errore CORS, risposta JSON sessione.
- **TEST-008**: Login + verifica cookie → attributi `HttpOnly`, `Secure`, `SameSite=Lax`.
- **TEST-009**: Flusso OAuth completo: `GET /auth/google/start` → callback → redirect SPA valida.
- **TEST-010**: `GET /generation/stream` → SSE attivo senza timeout anomali dietro il layer di rewrite.
- **TEST-011**: Routing SPA client-side → nessun 404 su refresh di route frontend non-API.

## 7. Risks & Assumptions

- **RISK-001**: Railway potrebbe non supportare nativamente rewrite proxy nel `railway.toml` del frontend statico; potrebbe richiedere un servizio proxy dedicato (es. Caddy, Nginx) come terzo servizio nel progetto.
- **RISK-002**: Configurazione incompleta del fallback SPA potrebbe intercettare route backend e mascherare errori applicativi.
- **RISK-003**: Env di sicurezza non aggiornate contestualmente al cutover producono deploy parzialmente funzionanti con auth rotta.
- **RISK-004**: `GOOGLE_REDIRECT_URI` non aggiornato su Google Cloud Console causa fallimento OAuth immediato post-cutover.
- **RISK-005**: SSE potrebbe subire timeout prematuri se il layer proxy introduce buffer o timeout default non configurati per connessioni lunghe.
- **RISK-006**: Warning SSL `pg-connection-string` rilevato in smoke pre-esistente richiede hardening configurazione DB prima del cutover finale (known issue dal GO closure 2026-04-25).
- **ASSUMPTION-001**: Il frontend continuerà a usare path relativi come comportamento di default in produzione.
- **ASSUMPTION-002**: Il backend resta esposto su host Railway pubblico separato, nascosto dal browser dietro i rewrite same-origin.
- **ASSUMPTION-003**: La variante cross-origin non viene attivata durante questo ciclo implementativo.
- **ASSUMPTION-004**: I domini custom Railway sono disponibili e il DNS è gestibile entro lo Sprint 1.

## 8. Related Specifications / Further Reading

- [deployment-architecture-guide](../docs/02-design/specifications/deployment-architecture-guide.md)
- [railway-same-origin-migration-strategy-3-phases](../docs/99-lifecycle/99-archive/railway-same-origin-migration-strategy-3-phases.md) *(archived — superseded da questo piano)*
- [infrastructure-same-origin-deployment-1](../docs/99-lifecycle/99-archive/infrastructure-same-origin-deployment-1.md) *(archived — superseded da questo piano)*
- `frontend/railway.toml`
- `frontend/vite.config.ts`
- `src/server.ts`
