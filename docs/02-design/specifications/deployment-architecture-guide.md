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

Strategia raccomandata per questo progetto:

1. Frontend su Railway service dedicato
2. Backend su Railway service dedicato
3. Configurazione esplicita CORS/CSRF/cookie per cross-origin
4. Healthcheck espliciti e runbook operativo con regole anti-regressione

Per la migrazione progressiva a same-origin: `docs/05-ops/railway-same-origin-migration-strategy-3-phases.md`.