# Deployment Architecture Guide

**Data**: 2026-04-28  
**Revisione**: 2.0  
**Scope**: Stato as-is del deployment production su Railway e regole operative per evitare regressioni

---

## Stato As-Is (Confermato)

Topologia attiva:

```text
Frontend (Railway service) -> Backend (Railway service) -> PostgreSQL + Redis
```

Domini pubblici (esempio attuale):

- Frontend: `https://frontend-production-19bf.up.railway.app`
- Backend: `https://gen-app-2-production.up.railway.app`

Note chiave:

- Il frontend e una SPA React/Vite buildata in `frontend/dist` e servita da runtime Node (`frontend/server.mjs`).
- Il backend usa Node runtime con endpoint auth/api/stream e healthcheck su `/health`.
- Il deployment e cross-origin (frontend e backend su domini diversi), quindi cookie/CORS/CSRF devono essere configurati in modo esplicito.

---

## Regole Operative Railway (Nuove)

### 1) Service frontend

- Root directory service: `frontend`
- Builder: Dockerfile (`frontend/Dockerfile`)
- Start command: `npm run start`
- Healthcheck path: `/health`

### 2) Networking frontend

- Public networking va configurato sulla porta effettiva del processo frontend.
- Nel setup corrente la porta da impostare e `8080`.
- L'utente finale usa comunque URL HTTPS senza specificare porta.

### 3) Runtime frontend

- Script start canonico:

```bash
npm run build && npm run start:server
```

- `start:server` avvia `node server.mjs`.
- `server.mjs` espone:
  - `GET /health` -> 200 JSON
  - file statici da `dist/`
  - SPA fallback su `dist/index.html`

Razionale: build al bootstrap per eliminare regressioni legate a `dist` mancante in alcuni deployment/caching scenario.

---

## Variabili Backend Production (Cross-Origin)

Impostare su backend Railway:

```bash
FRONTEND_ORIGIN=https://frontend-production-19bf.up.railway.app
CORS_ALLOWED_ORIGINS=https://frontend-production-19bf.up.railway.app
CSRF_TRUSTED_ORIGINS=https://frontend-production-19bf.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

Per mantenere anche test locale frontend:

```bash
CORS_ALLOWED_ORIGINS=https://frontend-production-19bf.up.railway.app,http://localhost:5173
CSRF_TRUSTED_ORIGINS=https://frontend-production-19bf.up.railway.app,http://localhost:5173
```

Nota: `GOOGLE_REDIRECT_URI` resta sul dominio backend pubblico (`/auth/google/callback`).

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
curl -i https://frontend-production-19bf.up.railway.app/health
curl -i https://frontend-production-19bf.up.railway.app/
curl -i https://gen-app-2-production.up.railway.app/health
```

---

## Decisione Corrente

Topologia adottata: **Variant B — Private-Network Same-Origin via `frontend/server.mjs`** (vedi sezione dedicata sotto).

---

## Baseline Pre-Migrazione

Snapshot della configurazione cross-origin attiva prima della migrazione same-origin (da preservare come riferimento di rollback).

```
Frontend pubblico: https://frontend-production-19bf.up.railway.app
Backend pubblico:  https://gen-app-2-production.up.railway.app

CORS_ALLOWED_ORIGINS=https://frontend-production-19bf.up.railway.app
CSRF_TRUSTED_ORIGINS=https://frontend-production-19bf.up.railway.app
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
FRONTEND_ORIGIN=https://frontend-production-19bf.up.railway.app
GOOGLE_REDIRECT_URI=https://gen-app-2-production.up.railway.app/auth/google/callback
```

**Rollback a cross-origin**: ripristinare i valori sopra nelle env Railway del backend, impostare `startCommand = "npm run start"` nel `frontend/railway.toml`, e verificare che `VITE_API_BASE_URL` sia vuota nella build frontend.

---

## Variant B — Private-Network Same-Origin via `frontend/server.mjs`

### Topologia target

```text
Browser
  └─► https://<frontend-public-host>/*
        └─► frontend/server.mjs  (Railway service — unico host pubblico)
              ├── GET /health          → risposta locale
              ├── /auth/*              → proxy → http://backend.railway.internal:3000
              ├── /generation/*        → proxy → http://backend.railway.internal:3000
              ├── /api/*               → proxy → http://backend.railway.internal:3000
              ├── /admin/users/*       → proxy → http://backend.railway.internal:3000
              ├── asset statici        → dist/
              └── SPA fallback         → dist/index.html
```

### Prerequisiti bloccanti

- `BACKEND_INTERNAL_URL` deve essere impostata nel servizio frontend Railway (`http://backend.railway.internal:3000`).
- Il backend Railway deve avere private networking abilitato e rispondere su porta `3000` via hostname interno.
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
| `BACKEND_INTERNAL_URL` | `http://localhost:3000` | `http://backend.railway.internal:3000` |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | impostato da Railway |

Fail-fast: se `NODE_ENV=production` e `BACKEND_INTERNAL_URL` non è impostata, `server.mjs` termina con `process.exit(1)` al bootstrap.

### Env backend (same-origin target)

```bash
FRONTEND_ORIGIN=https://<frontend-public-host>
CORS_ALLOWED_ORIGINS=https://<frontend-public-host>
CSRF_TRUSTED_ORIGINS=https://<frontend-public-host>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
GOOGLE_REDIRECT_URI=https://<frontend-public-host>/auth/google/callback
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

### Smoke checklist runtime (da eseguire post-deploy)

```bash
# Healthcheck
curl -i https://<frontend-public-host>/health

# Sessione (proxy attivo)
curl -i https://<frontend-public-host>/auth/session

# SSE (POST, non GET)
curl -i -X POST https://<frontend-public-host>/generation/stream \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"test"}'

# SPA fallback (non deve restituire 404)
curl -i https://<frontend-public-host>/some/spa/route
```

### Rischi operativi

| Rischio | Impatto | Mitigazione |
|---|---|---|
| DNS interno Railway non risolvibile | Proxy → 502 su tutte le route applicative | Verificare con `/debug/connectivity` prima del go-live; mantenere host backend pubblico come rollback |
| Restart frontend interrompe connessioni SSE attive | Generazioni in corso troncate | Accettabile; client deve gestire riconnessione |
| `VITE_API_BASE_URL` non vuota in Railway build vars | Bundle hardcoda host backend, bypassa proxy | Verificare Railway build vars: `VITE_API_BASE_URL` deve essere vuota o assente |
| Hop-by-hop header inoltrati | `Error: Invalid header value` a runtime Node | Filtrare lista esplicita in `server.mjs` |
| `GOOGLE_REDIRECT_URI` non aggiornato su Google Console | OAuth → 400 `redirect_uri_mismatch` | Gate bloccante prima del cutover OAuth |