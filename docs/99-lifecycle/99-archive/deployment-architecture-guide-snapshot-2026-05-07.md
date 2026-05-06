---
status: archived
version: 2.1
last-reviewed: 2026-05-01
archived-date: 2026-05-07
owner: Platform/DevOps
---

# Deployment Architecture Guide (Archived)

> ⓘ **Operational Document** — This guide covers Railway deployment architecture, networking, and rollback procedures (orthogonal to DDD domain model). For domain terminology in this document, see canonical references:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) — `GenerationRequest`, `Artifact`, `BackendStreamEvent`
> - [Domain Bounded Context Map](../../02-design/domain-bounded-context-map.md) — context boundaries and integration points

**Data**: 2026-05-01  
**Revisione**: 2.1  
**Scope**: Stato deploy Railway corrente, migrazione same-origin private-network e regole operative per evitare regressioni

---

## Stato As-Is (Confermato)

Topologia attiva:

```text
Frontend (Railway service) -> Backend (Railway service) -> PostgreSQL + Redis
```

Domini pubblici (esempio attuale):

- Frontend: `https://<frontend-service>.up.railway.app`
- Backend: `https://<backend-service>.up.railway.app`

Note chiave:

- Il frontend e una SPA React/Vite buildata in `frontend/dist` e servita da runtime Node (`frontend/server.mjs`).
- Il backend usa Node runtime con endpoint auth/api/stream e healthcheck su `/health`.
- Il deployment e cross-origin (frontend e backend su domini diversi), quindi cookie/CORS/CSRF devono essere configurati in modo esplicito.

---

## Regole Operative Railway (Nuove)

### 1) Service frontend

- Root directory service: `frontend`
- Builder: Dockerfile (`frontend/Dockerfile`)
- Start command: `node server.mjs`
- Healthcheck path: `/health`

### 2) Networking frontend

- Public networking va configurato sulla porta effettiva del processo frontend.
- Nel setup corrente la porta da impostare e `8080`.
- L'utente finale usa comunque URL HTTPS senza specificare porta.

### 3) Runtime frontend

- Script runtime canonico:

```bash
node server.mjs
```

- Il build frontend avviene nel Dockerfile (`RUN npm run build`), non al bootstrap del container.
- `server.mjs` espone:
  - `GET /health` -> 200 JSON
  - file statici da `dist/`
  - SPA fallback su `dist/index.html`

Razionale: evitare double-build ad ogni restart Railway e mantenere il runtime deterministico.

---

## Variabili Backend Production (Cross-Origin Baseline Storica)

Impostare su backend Railway:

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

Per mantenere anche test locale frontend:

```bash
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app,http://localhost:5173
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app,http://localhost:5173
```

Nota storica: nella baseline cross-origin `GOOGLE_REDIRECT_URI` restava sul dominio backend pubblico (`/auth/google/callback`). Questo non vale piu per la topologia same-origin corrente.

---

## Checklist Deploy/Re-Deploy

### Frontend

```bash
# 1) lockfile allineato
npm --prefix frontend ci

# 2) build locale di controllo
npm --prefix frontend run build

# 3) commit + push
git add frontend/package.json frontend/Dockerfile frontend/railway.toml frontend/server.mjs
git commit -m "frontend deploy update"
git push
```

### Backend

```bash
# 1) typecheck/test baseline
npm run typecheck
npm run test

# 2) smoke adapters (con env caricata)
set -a && . ./.env.local && set +a && npm run test:smoke
```

---

## Troubleshooting Rapido (Lezioni Apprese)

| Sintomo | Causa tipica | Azione |
|---|---|---|
| `Missing script: "start"` | Start command Railway su script non presente | Definire script `start` in `frontend/package.json` e allineare `frontend/railway.toml` |
| Healthcheck pending/fail | Porta public networking non allineata alla porta runtime | Impostare in Public Networking la porta effettiva runtime (attuale: `8080`) |
| `Missing dist/index.html` | Build non disponibile al runtime | Usare start con build (`npm run build && npm run start:server`) |
| Login ok, poi 401 su API o refresh logout | Cookie cross-origin non configurato | `AUTH_COOKIE_SAMESITE=none`, `AUTH_COOKIE_SECURE=true`, CORS/CSRF allineati al dominio frontend |
| `502` dal dominio frontend | Routing edge verso porta errata o container non healthy | Verificare porta pubblica service e stato healthcheck |

---

## Monitoraggio Operativo

Comandi utili:

```bash
railway logs
railway logs --follow
```

Probe manuali:

```bash
curl -i https://<frontend-service>.up.railway.app/health
curl -i https://<frontend-service>.up.railway.app/
curl -i https://<backend-service>.up.railway.app/health
```

---

## Decisione Corrente

Topologia adottata: **Variant B — Private-Network Same-Origin via `frontend/server.mjs`** (vedi sezione dedicata sotto).

---

## Baseline Pre-Migrazione

Snapshot della configurazione cross-origin attiva prima della migrazione same-origin (da preservare come riferimento di rollback).

```
Frontend pubblico: https://<frontend-service>.up.railway.app
Backend pubblico:  https://<backend-service>.up.railway.app

CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
GOOGLE_REDIRECT_URI=https://<backend-service>.up.railway.app/auth/google/callback
```

**Rollback a cross-origin**: ripristinare i valori sopra nelle env Railway del backend, impostare `startCommand = "npm run start"` nel `frontend/railway.toml`, e verificare che `VITE_API_BASE_URL` sia vuota nella build frontend.

---

## Variant B — Private-Network Same-Origin via `frontend/server.mjs`

### Stato deploy verificato (2026-05-01)

- frontend public host: `https://<frontend-service>.up.railway.app`
- backend internal host: `http://<backend-service>.railway.internal:<port>`
- backend public rollback host: `https://<backend-service>.up.railway.app`
- verifica networking interno: `/debug/connectivity` -> `{"ok":true,"status":200,"backendUrl":"http://<backend-service>.railway.internal:<port>"}`

### Topologia target

```text
Browser
  └─► https://<frontend-service>.up.railway.app/*
        └─► frontend/server.mjs  (Railway service — unico host pubblico)
              ├── GET /health          → risposta locale
              ├── /auth/*              → proxy → http://<backend-service>.railway.internal:<port>
              ├── /generation/*        → proxy → http://<backend-service>.railway.internal:<port>
              ├── /api/*               → proxy → http://<backend-service>.railway.internal:<port>
              ├── /admin/users/*       → proxy → http://<backend-service>.railway.internal:<port>
              ├── asset statici        → dist/
              └── SPA fallback         → dist/index.html
```

### Prerequisiti bloccanti

- `BACKEND_INTERNAL_URL` deve essere impostata nel servizio frontend Railway (es. `http://<backend-service>.railway.internal:<port>`).
- Il backend Railway deve avere private networking abilitato e rispondere su porta `8080` via hostname interno nel deploy corrente.
- Verificare raggiungibilità con `/debug/connectivity` (endpoint temporaneo da rimuovere prima del go-live — vedi TASK-003).

### Ordine di valutazione route in `frontend/server.mjs`

1. `GET /health` → risposta locale `{ ok: true }`
2. path che inizia con `/auth`, `/generation`, `/api`, `/admin/users` → proxy al backend, **qualunque metodo HTTP** (GET, POST, PUT, DELETE, PATCH)
3. asset statico esistente in `dist/` → `sendFile`
4. SPA fallback → `dist/index.html`

Matching: `url.startsWith(prefix)` su prefissi esatti. Normalizzare trailing slash: `/api` e `/api/` entrambi matchano.

### Env frontend (server-side, non bundle)

| Variabile | Default locale | Produzione Railway |
|---|---|---|
| `BACKEND_INTERNAL_URL` | `http://localhost:3000` | `http://<backend-service>.railway.internal:<port>` |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | impostato da Railway |

Fail-fast: se `NODE_ENV=production` e `BACKEND_INTERNAL_URL` non è impostata, `server.mjs` termina con `process.exit(1)` al bootstrap.

### Env backend (same-origin target)

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
GOOGLE_REDIRECT_URI=https://<frontend-service>.up.railway.app/auth/google/callback
```

**ATTENZIONE**: `GOOGLE_REDIRECT_URI` si sposta dall'host backend pubblico all'host frontend. Aggiornare anche negli **Authorized Redirect URIs** del client OAuth su Google Cloud Console (`APIs & Services > Credentials > OAuth 2.0 Client IDs`). Senza questo step Google restituisce `redirect_uri_mismatch` (HTTP 400).

### Header proxy — contratto forward

**Request browser → backend:**
- Forwarded: `method`, `url+querystring`, `body`, `cookie`, `content-type`, `authorization`, `x-forwarded-for`, `x-real-ip`, header CSRF
- `x-forwarded-for` necessario per IP client in audit log (ref: `auth-http.ts` righe 235-237, 458, 556)

**Response backend → browser:**
- Forwarded: tutti gli header, in particolare `set-cookie`, `location`, `content-type`, `cache-control`, `www-authenticate`
- **Esclusi** (hop-by-hop, causano `Error: Invalid header value` in Node): `transfer-encoding`, `connection`, `keep-alive`, `proxy-authenticate`, `proxy-authorization`, `te`, `trailers`, `upgrade`

### SSE — contratto streaming

1. Rilevare `content-type: text/event-stream` dalla risposta backend
2. `response.flushHeaders()` immediato dopo aver impostato gli header SSE
3. `response.socket?.setNoDelay(true)` per disabilitare Nagle
4. Pipe del body backend → response browser senza buffering intermedio
5. Evento `close` sulla request browser → `upstreamReq.destroy()` per prevenire connessioni zombie

### Fix double-build (TASK-010b)

L'attuale `CMD ["npm", "run", "start"]` in `frontend/Dockerfile` e `startCommand = "npm run start"` in `frontend/railway.toml` eseguono `npm run build && npm run start:server`, causando una build ad ogni restart.

Correzione:
- `frontend/Dockerfile`: `CMD ["node", "server.mjs"]`
- `frontend/railway.toml`: `startCommand = "node server.mjs"`

### Smoke checklist runtime (da eseguire post-deploy sul solo host frontend pubblico)

```bash
# Healthcheck
curl -i https://<frontend-service>.up.railway.app/health

# Sessione bootstrap (proxy attivo)
curl -i https://<frontend-service>.up.railway.app/auth/session

# Login (cookie-based auth via proxy)
curl -i -X POST https://<frontend-service>.up.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test-user-email>","password":"<test-password>"}'

# Logout
curl -i -X POST https://<frontend-service>.up.railway.app/auth/logout

# CRUD principale - sessione autenticata richiesta
curl -i https://<frontend-service>.up.railway.app/api/projects

# SSE (POST, non GET)
curl -i -X POST https://<frontend-service>.up.railway.app/generation/stream \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"test"}'

# OAuth bootstrap
curl -i https://<frontend-service>.up.railway.app/auth/google/start

# SPA fallback (non deve restituire 404)
curl -i https://<frontend-service>.up.railway.app/some/spa/route
```

Esiti attesi:
- `/health` -> `200`
- `/auth/session` -> risposta backend coerente via proxy (`200` con sessione o `401` senza sessione, ma non `502` e non errore CORS)
- `/auth/login` -> risposta backend coerente con header `Set-Cookie`; cookie `HttpOnly`, `Secure`, `SameSite=Lax`
- `/auth/logout` -> `204` oppure risposta coerente del backend, senza `502`
- `/api/projects` -> risposta backend coerente con sessione valida
- `/generation/stream` -> stream SSE aperto senza buffering anomalo
- `/auth/google/start` -> redirect OAuth senza `redirect_uri_mismatch`
- route SPA -> `200`, non `404`

### Rischi operativi

| Rischio | Impatto | Mitigazione |
|---|---|---|
| DNS interno Railway non risolvibile | Proxy → 502 su tutte le route applicative | Verificare con `/debug/connectivity` prima del go-live; mantenere host backend pubblico come rollback |
| Restart frontend interrompe connessioni SSE attive | Generazioni in corso troncate | Accettabile; client deve gestire riconnessione |
| `VITE_API_BASE_URL` non vuota in Railway build vars | Bundle hardcoda host backend, bypassa proxy | Verificare Railway build vars: `VITE_API_BASE_URL` deve essere vuota o assente |
| Hop-by-hop header inoltrati | `Error: Invalid header value` a runtime Node | Filtrare lista esplicita in `server.mjs` |
| `GOOGLE_REDIRECT_URI` non aggiornato su Google Console | OAuth → 400 `redirect_uri_mismatch` | Gate bloccante prima del cutover OAuth |

---

## Logging Proxy (TASK-020)

`frontend/server.mjs` emette log sintetici per ogni richiesta. I log **non contengono** header, cookie, token o body.

### Formato log

| Prefisso | Evento | Esempio |
|---|---|---|
| `[req] health` | Healthcheck locale | `[req] health GET /health` |
| `[req] proxy` | Dispatch al backend, pre-risposta | `[req] proxy POST /auth/login` |
| `[proxy] METHOD path → status (ms)` | Risposta backend ricevuta | `[proxy] POST /auth/login → 200 (42ms)` |
| `[proxy] error (ms): CODE msg` | Backend non raggiungibile o errore upstream | `[proxy] error (5001ms): ECONNREFUSED ... → http://...` |
| `[req] static` | Asset statico servito da `dist/` | `[req] static GET /assets/index-abc.js` |
| `[req] spa` | SPA fallback su `dist/index.html` | `[req] spa GET /tools/my-tool` |
| `[req] 405` | Metodo non consentito su static/SPA | `[req] 405 DELETE /assets/foo.js` |
| `[req] debug` | Debug connectivity (solo pre-go-live) | `[req] debug GET /debug/connectivity` |

### Come leggere i log su Railway

```bash
railway logs --follow
```

Segnali di allarme:

- Frequenza di `[proxy] error` > 0 → backend non raggiungibile; controllare stato servizio backend e DNS interno Railway.
- Log `[req] proxy` senza corrispondente `[proxy] ... → STATUS` → timeout upstream silenzioso; verificare `BACKEND_INTERNAL_URL`.
- `[req] spa` su path che dovrebbero essere asset → build non completata correttamente; `dist/` incompleto.
- `[server] Missing dist/index.html` al bootstrap → build mancante nel Dockerfile.

---

## Timeout e Limiti Proxy (TASK-021)

### Stato attuale

`server.mjs` **non imposta timeout espliciti** su `node:http.request`. Le connessioni verso il backend interno non hanno un hard limit lato proxy; il timeout operativo è determinato dal comportamento Railway e dal client.

### Soglie operative Railway

| Scenario | Timeout attivo | Sorgente |
|---|---|---|
| Richieste HTTP normali | ~5 minuti | Railway idle connection timeout |
| SSE (stream aperto) | Fino a chiusura client o backend | Nessun timeout lato proxy; Railway non tronca stream SSE attivi |
| Upload body grande | ~5 minuti senza progress | Railway TCP keepalive |

### Implicazioni per SSE

- Il proxy fa `pipe` diretto senza buffering → nessun timeout aggiunto dal proxy.
- `response.flushHeaders()` + `setNoDelay(true)` garantiscono che i chunk SSE arrivino al browser senza ritardo.
- Se il backend non emette eventi per molto tempo, il browser può chiudere la connessione (`EventSource` reconnect automatico); il proxy risponde distruggendo il socket upstream (`response.on('close')`).
- **Segnale di allarme**: `[proxy] POST /generation/stream → STATUS` con tempo elevato e nessun chunk visibile lato client → backend bloccato nel processing.

### Configurazione timeout futura (se necessaria)

```js
// Timeout socket upstream per richieste normali (non SSE)
// Da valutare se il backend introduce endpoint lenti
upstreamReq.setTimeout(30_000, () => {
  upstreamReq.destroy(new Error('upstream timeout'));
});
```

Non aggiunto ora per evitare falsi positivi su SSE di generazione lunga.

---

## Rollback a Cross-Origin (TASK-022)

Eseguire in ordine. Il rollback riporta la topologia alla baseline cross-origin. Tempo stimato: ~10 minuti.

### Step 1 — Ripristino env backend Railway

Impostare sul servizio backend in Railway (`Variables`):

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
GOOGLE_REDIRECT_URI=https://<backend-service>.up.railway.app/auth/google/callback
```

### Step 2 — Ripristino Google OAuth Redirect URI

In Google Cloud Console (`APIs & Services > Credentials > OAuth 2.0 Client IDs`):

- Aggiungere (o ripristinare): `https://<backend-service>.up.railway.app/auth/google/callback`
- Rimuovere (o disabilitare): `https://<frontend-service>.up.railway.app/auth/google/callback`

### Step 3 — Ripristino build frontend (se il proxy causa problemi)

Il frontend in topologia cross-origin deve avere `VITE_API_BASE_URL` impostata come build variable Railway per indirizzare le richieste al backend pubblico:

```bash
VITE_API_BASE_URL=https://<backend-service>.up.railway.app
```

Rimuovere `BACKEND_INTERNAL_URL` dalle env del servizio frontend Railway dopo il deploy.

### Step 4 — Verifica rollback

```bash
# Backend risponde sul proprio host pubblico
curl -i https://<backend-service>.up.railway.app/health

# Cookie di sessione con SameSite=None
curl -i -X POST https://<backend-service>.up.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test>","password":"<test>"}'
# → Set-Cookie: ... SameSite=None; Secure

# SPA carica
curl -i https://<frontend-service>.up.railway.app/
### Gate di accettazione rollback

- `GET https://<backend-service>.up.railway.app/health` → `200`
- Login produce `Set-Cookie` con `SameSite=None; Secure`
- No `redirect_uri_mismatch` OAuth su callback backend
- Log backend mostrano richieste dal browser direttamente (IP pubblici, non IP internal Railway)

---

## Rischi Residui — Variante Private-Network (TASK-023)

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| **DNS interno Railway non risolvibile** dopo restart o re-deploy | Bassa | Alto — tutte le route applicative → 502 | `/debug/connectivity` pre-deploy; rollback cross-origin in < 10 min (vedi sezione sopra) |
| **Restart frontend interrompe connessioni proxy attive** (SSE in corso) | Media (ogni deploy) | Medio — generazioni troncate | Accettabile; client `EventSource` riconnette automaticamente; le generazioni devono gestire interruzione lato client |
| **Debugging multi-hop** (browser → frontend → backend) | Alta (ogni bug di rete) | Medio — più complesso rispetto a cross-origin diretto | Log sintetici `[req]`/`[proxy]` in `server.mjs`; correlazione con `railway logs` del backend; `x-forwarded-for` tracciabile nei log backend |
| **Build-time vs runtime Vite env** (`VITE_CAP_*`) | Bassa (documentato) | Medio — capability disabilitate silenziosamente | `VITE_CAP_*` devono essere build variables su Railway; documentato in `frontend/README.md` |
| **`BACKEND_INTERNAL_URL` non impostata in produzione** | Bassa (fail-fast) | Alto — container si ferma al bootstrap | `process.exit(1)` su `NODE_ENV=production` senza env; Railway mostra il crash nel deploy log |
| **`/debug/connectivity` esposto in produzione** | Media (da rimuovere) | Basso — rivela topologia interna | Rimuovere prima del go-live definitivo (TASK-003 pendente) |
| **Rename servizio backend Railway** | Bassa | Alto — hostname interno cambia | Aggiornare `BACKEND_INTERNAL_URL` env su Railway frontend dopo ogni rename del servizio backend |
