---
status: approved
version: 2.4
date_created: 2026-05-01
last-reviewed: 2026-06-28
next-review-date: 2026-09-28
owner: Platform/DevOps
type: reference
tags: [deployment, railway, networking, proxy, operations]
---

# Deployment Architecture Guide

> ⓘ **Operational Document** — This guide covers Railway deployment architecture, networking, and rollback procedures (orthogonal to DDD domain model). For domain terminology in this document, see canonical references:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) — `GenerationRequest`, `Artifact`, `BackendStreamEvent`
> - [Domain Bounded Context Map](../domain-bounded-context-map.md) — context boundaries and integration points

**Date**: 2026-05-01  
**Revision**: 2.2  
**Scope**: Current Railway deployment state, same-origin private-network migration and operational rules to avoid regressions

---

## As-Is State (Confirmed)

Active topology:

```text
Frontend (Railway service) -> Backend (Railway service) -> PostgreSQL + Redis
```

Public domains (current example):

- Frontend: `https://<frontend-service>.up.railway.app`
- Backend: `https://<backend-service>.up.railway.app`

Key notes:

- The frontend is a React/Vite SPA built in `frontend/dist` and served by Node runtime (`frontend/server.mjs`).
- The backend uses Node runtime with auth/api/stream endpoints and healthcheck at `/health`.
- The deployment is cross-origin (frontend and backend on different domains), so cookie/CORS/CSRF must be configured explicitly.

---

## Railway Operational Rules (New)

### 1) Frontend service

- Service root directory: `frontend`
- Builder: Dockerfile (`frontend/Dockerfile`)
- Start command: `node server.mjs`
- Healthcheck path: `/health`

### 2) Frontend networking

- Public networking must be configured on the actual frontend process port.
- In the current setup the port to set is `8080`.
- The end user still uses HTTPS URL without specifying port.

### 3) Frontend runtime

- Canonical runtime script:

```bash
node server.mjs
```

- Frontend build occurs in the Dockerfile (`RUN npm run build`), not at container bootstrap.
- `server.mjs` exposes:
  - `GET /health` -> 200 JSON
  - static files from `dist/`
  - SPA fallback on `dist/index.html`

Rationale: avoid double-build on every Railway restart and keep runtime deterministic.

---

## Backend Production Variables (Historical Cross-Origin Baseline)

Set on Railway backend:

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

To also maintain local frontend testing:

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
        └─► frontend/server.mjs  (Railway service — single public host)
              ├── GET /health          → local response
              ├── /auth/*              → proxy → http://<backend-service>.railway.internal:<port>
              ├── /generation/*        → proxy → http://<backend-service>.railway.internal:<port>
              ├── /api/*               → proxy → http://<backend-service>.railway.internal:<port>
              ├── /admin/users/*       → proxy → http://<backend-service>.railway.internal:<port>
              ├── static assets        → dist/
              └── SPA fallback         → dist/index.html
```

### Blocking prerequisites

- `BACKEND_INTERNAL_URL` must be set in the frontend Railway service (e.g., `http://<backend-service>.railway.internal:<port>`).
- The Railway backend must have private networking enabled and respond on port `8080` via internal hostname in the current deploy.
- Verify reachability with `/debug/connectivity` (temporary endpoint to remove before go-live — see TASK-003).

### Route evaluation order in `frontend/server.mjs`

1. `GET /health` → local response `{ ok: true }`
2. paths starting with `/auth`, `/generation`, `/api`, `/admin/users` → proxy to backend, **any HTTP method** (GET, POST, PUT, DELETE, PATCH)
3. existing static asset in `dist/` → `sendFile`
4. SPA fallback → `dist/index.html`

Matching: `url.startsWith(prefix)` on exact prefixes. Normalize trailing slash: `/api` and `/api/` both match.

### Frontend env (server-side, not bundle)

| Variable | Local default | Railway Production |
|---|---|---|
| `BACKEND_INTERNAL_URL` | `http://localhost:3000` | `http://<backend-service>.railway.internal:<port>` |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | set by Railway |

Fail-fast: if `NODE_ENV=production` and `BACKEND_INTERNAL_URL` is not set, `server.mjs` terminates with `process.exit(1)` at bootstrap.

### Env backend (same-origin target)

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
GOOGLE_REDIRECT_URI=https://<frontend-service>.up.railway.app/auth/google/callback
# Optional DOCX visual preset for backend download serializers.
# Supported values: none | classic
DOCX_DEFAULT_THEME=none
```

**WARNING**: `GOOGLE_REDIRECT_URI` moves from the public backend host to the frontend host. Also update in the **Authorized Redirect URIs** of the OAuth client on Google Cloud Console (`APIs & Services > Credentials > OAuth 2.0 Client IDs`). Without this step Google returns `redirect_uri_mismatch` (HTTP 400).

### DOCX visual preset governance (download endpoints)

`DOCX_DEFAULT_THEME` selects the default visual theme used by backend DOCX download serialization when no per-call override is passed.

- `none`: semantic-only rendering baseline
- `classic`: visual preset aligned to the Artifact Detail markdown preview typography and spacing

Source evidence:

- `apps/backend/src/lib/runtime/downloads/docx-theme-config.ts`
- `apps/backend/src/lib/runtime/downloads/download-serializers.ts`
- `apps/frontend/src/styles.css` (`.ui-artifact-markdown`)

### Header proxy — forward contract

**Request browser → backend:**
- Forwarded: `method`, `url+querystring`, `body`, `cookie`, `content-type`, `authorization`, `x-forwarded-for`, `x-real-ip`, CSRF header
- `x-forwarded-for` required for client IP in audit log (ref: `apps/backend/src/lib/runtime/auth-http/support.ts:219-225`, `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts:128`, `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts:200`, `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts:300`)

**Response backend → browser:**
- Forwarded: all headers, in particular `set-cookie`, `location`, `content-type`, `cache-control`, `www-authenticate`
- **Excluded** (hop-by-hop, cause `Error: Invalid header value` in Node): `transfer-encoding`, `connection`, `keep-alive`, `proxy-authenticate`, `proxy-authorization`, `te`, `trailers`, `upgrade`

### SSE — streaming contract

1. Detect `content-type: text/event-stream` from backend response
2. `response.flushHeaders()` immediately after setting SSE headers
3. `response.socket?.setNoDelay(true)` to disable Nagle
4. Pipe backend body → browser response without intermediate buffering
5. `close` event on browser request → `upstreamReq.destroy()` to prevent zombie connections

### Fix double-build (TASK-010b)

The current `CMD ["npm", "run", "start"]` in `frontend/Dockerfile` and `startCommand = "npm run start"` in `frontend/railway.toml` execute `npm run build && npm run start:server`, causing a build on every restart.

Fix:
- `frontend/Dockerfile`: `CMD ["node", "server.mjs"]`
- `frontend/railway.toml`: `startCommand = "node server.mjs"`

### Smoke runtime checklist (run post-deploy on frontend public host only)

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

# SessionSummary listing (canonical aggregate listing target)
curl -i "https://<frontend-service>.up.railway.app/api/tools/sessions?projectId=<project-id>"

# Session aggregate detail
curl -i https://<frontend-service>.up.railway.app/api/tools/sessions/<session-id>

# Session aggregate step detail
curl -i https://<frontend-service>.up.railway.app/api/tools/sessions/<session-id>/step/<step-key>

# Artifact archive/detail (non-aggregated history)
curl -i "https://<frontend-service>.up.railway.app/api/artifacts?projectId=<project-id>"
curl -i https://<frontend-service>.up.railway.app/api/artifacts/<artifact-id>

# SSE (POST, non GET)
curl -i -X POST https://<frontend-service>.up.railway.app/generation/stream \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"test"}'

# OAuth bootstrap
curl -i https://<frontend-service>.up.railway.app/auth/google/start

# SPA fallback (non deve restituire 404)
curl -i https://<frontend-service>.up.railway.app/some/spa/route
```

Expected results:
- `/health` -> `200`
- `/auth/session` -> coherent backend response via proxy (`200` with session or `401` without session, but not `502` and not CORS error)
- `/auth/login` -> coherent backend response with `Set-Cookie` header; cookie `HttpOnly`, `Secure`, `SameSite=Lax`
- `/auth/logout` -> `204` or coherent backend response, without `502`
- `/api/projects` -> coherent backend response with valid session
- `/api/tools/sessions*` -> coherent response for session aggregate listing/detail (session-scoped data)
- `/api/artifacts*` -> coherent response for non-aggregated artifact history/detail (artifact-scoped data)
- `/generation/stream` -> SSE stream open without abnormal buffering
- `/auth/google/start` -> OAuth redirect without `redirect_uri_mismatch`
- SPA route -> `200`, not `404`

### API namespace determinism gate (DDD-052)

Proxy same-origin must preserve backend API semantics without namespace overlap:

- `projects` scope: `/api/projects*`
- `session aggregate` scope: `/api/tools/sessions*`
- `artifact history/detail` scope: `/api/artifacts*`

Operational rule:
- Deployment/proxy changes must not reintroduce endpoint or route ambiguity where artifact endpoints are used as session aggregate endpoints.

### Operational risks

| Risk | Impact | Mitigation |
|---|---|---|
| Internal Railway DNS unresolvable | Proxy → 502 on all application routes | Verify with `/debug/connectivity` before go-live; keep public backend host as rollback |
| Frontend restart interrupts active SSE connections | Truncated in-progress generations | Acceptable; client must handle reconnection |
| `VITE_API_BASE_URL` non-empty in Railway build vars | Bundle hardcodes backend host, bypasses proxy | Verify Railway build vars: `VITE_API_BASE_URL` must be empty or absent |
| Hop-by-hop headers forwarded | `Error: Invalid header value` at Node runtime | Filter explicit list in `server.mjs` |
| `GOOGLE_REDIRECT_URI` not updated on Google Console | OAuth → 400 `redirect_uri_mismatch` | Blocking gate before OAuth cutover |

---

## Logging Proxy (TASK-020)

`frontend/server.mjs` emits synthetic logs for each request. Logs **do not contain** headers, cookies, tokens, or body.

### Log format

| Prefix | Event | Example |
|---|---|---|
| `[req] health` | Local healthcheck | `[req] health GET /health` |
| `[req] proxy` | Dispatch to backend, pre-response | `[req] proxy POST /auth/login` |
| `[proxy] METHOD path → status (ms)` | Backend response received | `[proxy] POST /auth/login → 200 (42ms)` |
| `[proxy] error (ms): CODE msg` | Backend unreachable or upstream error | `[proxy] error (5001ms): ECONNREFUSED ... → http://...` |
| `[req] static` | Static asset served from `dist/` | `[req] static GET /assets/index-abc.js` |
| `[req] spa` | SPA fallback on `dist/index.html` | `[req] spa GET /tools/my-tool` |
| `[req] 405` | Method not allowed on static/SPA | `[req] 405 DELETE /assets/foo.js` |
| `[req] debug` | Debug connectivity (pre-go-live only) | `[req] debug GET /debug/connectivity` |

### How to read logs on Railway

```bash
railway logs --follow
```

Warning signals:

- Frequency of `[proxy] error` > 0 → backend unreachable; check backend service status and Railway internal DNS.
- Log `[req] proxy` without corresponding `[proxy] ... → STATUS` → silent upstream timeout; verify `BACKEND_INTERNAL_URL`.
- `[req] spa` on paths that should be assets → build not completed correctly; `dist/` incomplete.
- `[server] Missing dist/index.html` at bootstrap → build missing in Dockerfile.

---

## Timeout and Proxy Limits (TASK-021)

### Current state

`server.mjs` **does not set explicit timeouts** on `node:http.request`. Connections to the internal backend have no hard proxy-side limit; the operational timeout is determined by Railway behavior and the client.

### Railway operational thresholds

| Scenario | Active timeout | Source |
|---|---|---|
| Normal HTTP requests | ~5 minutes | Railway idle connection timeout |
| SSE (open stream) | Until client or backend close | No proxy-side timeout; Railway does not truncate active SSE streams |
| Large body upload | ~5 minutes without progress | Railway TCP keepalive |

### Implications for SSE

- The proxy does direct `pipe` without buffering → no timeout added by the proxy.
- `response.flushHeaders()` + `setNoDelay(true)` ensure SSE chunks reach the browser without delay.
- If the backend does not emit events for a long time, the browser may close the connection (`EventSource` auto reconnect); the proxy responds by destroying the upstream socket (`response.on('close')`).
- **Warning signal**: `[proxy] POST /generation/stream → STATUS` with high time and no chunk visible on client side → backend stuck in processing.

### Future timeout configuration (if needed)

```js
// Upstream socket timeout for normal requests (non-SSE)
// Evaluate if backend introduces slow endpoints
upstreamReq.setTimeout(30_000, () => {
  upstreamReq.destroy(new Error('upstream timeout'));
});
```

Not added now to avoid false positives on long-generation SSE.

---

## Screenshot Storage — Geometric Tool (DEPRECATED — to be removed)

> **Decision 2026-06-28**: The Geometric tool uses exclusively SerpApi for structured data. The Puppeteer path with screenshot has been removed. `aiOverviewConfidence` and `selectorUsed` were concepts tied to CSS-selector scraping — also removed, since SerpApi does not produce selectors and confidence is implicit in the data structure.
>
> This section is kept only as historical reference until completion of code removal (see `../../99-lifecycle/99-archive/plans/remove-geometric-screenshot-archival.md`).
>
> **Environment variables to remove**: `SCREENSHOT_STORAGE_PATH`, `SCREENSHOT_RETENTION_DAYS`.
> **Postgres table to drop**: `geometric_screenshot_metadata`.
> **Railway Persistent Disk**: no longer needed for screenshots.

---

## Rollback to Cross-Origin (TASK-022)

Execute in order. The rollback restores the topology to the cross-origin baseline. Estimated time: ~10 minutes.

### Step 1 — Restore backend Railway env

Set on the backend service in Railway (`Variables`):

```bash
FRONTEND_ORIGIN=https://<frontend-service>.up.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-service>.up.railway.app
CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
GOOGLE_REDIRECT_URI=https://<backend-service>.up.railway.app/auth/google/callback
```

### Step 2 — Restore Google OAuth Redirect URI

In Google Cloud Console (`APIs & Services > Credentials > OAuth 2.0 Client IDs`):

- Add (or restore): `https://<backend-service>.up.railway.app/auth/google/callback`
- Remove (or disable): `https://<frontend-service>.up.railway.app/auth/google/callback`

### Step 3 — Restore frontend build (if proxy causes issues)

The frontend in cross-origin topology must have `VITE_API_BASE_URL` set as Railway build variable to point requests at the public backend:

```bash
VITE_API_BASE_URL=https://<backend-service>.up.railway.app
```

Remove `BACKEND_INTERNAL_URL` from the frontend service Railway env after deploy.

### Step 4 — Verify rollback

```bash
# Backend responds on its own public host
curl -i https://<backend-service>.up.railway.app/health

# Session cookie with SameSite=None
curl -i -X POST https://<backend-service>.up.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test>","password":"<test>"}'
# → Set-Cookie: ... SameSite=None; Secure

# SPA loads
curl -i https://<frontend-service>.up.railway.app/
```

### Rollback acceptance gate

- `GET https://<backend-service>.up.railway.app/health` → `200`
- Login produces `Set-Cookie` with `SameSite=None; Secure`
- No `redirect_uri_mismatch` OAuth on backend callback
- Backend logs show requests from browser directly (public IPs, not Railway internal IPs)

---

## Residual Risks — Private-Network Variant (TASK-023)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **Internal Railway DNS unresolvable** after restart or re-deploy | Low | High — all application routes → 502 | `/debug/connectivity` pre-deploy; cross-origin rollback in < 10 min (see section above) |
| **Frontend restart interrupts active proxy connections** (SSE in progress) | Medium (every deploy) | Medium — truncated generations | Acceptable; client `EventSource` auto-reconnects; generations must handle client-side interruption |
| **Multi-hop debugging** (browser → frontend → backend) | High (any network bug) | Medium — more complex than direct cross-origin | Synthetic `[req]`/`[proxy]` logs in `server.mjs`; correlation with `railway logs` from backend; `x-forwarded-for` traceable in backend logs |
| **Build-time vs runtime Vite env** (`VITE_CAP_*`) | Low (documented) | Medium — silently disabled capabilities | `VITE_CAP_*` must be build variables on Railway; documented in `frontend/README.md` |
| **`BACKEND_INTERNAL_URL` not set in production** | Low (fail-fast) | High — container stops at bootstrap | `process.exit(1)` on `NODE_ENV=production` without env; Railway shows crash in deploy log |
| **`/debug/connectivity` exposed in production** | Medium (to be removed) | Low — reveals internal topology | Remove before final go-live (TASK-003 pending) |
| **Railway backend service rename** | Low | High — internal hostname changes | Update `BACKEND_INTERNAL_URL` env on Railway frontend after every backend service rename |