# Frontend Generation UI

Frontend React + XState v5 che consuma il backend as-is:

- stream POST /generation/stream con parser SSE start/chunk/terminal
- auth cookie routes: /auth/login, /auth/logout, /auth/session
- Google OAuth start link: /auth/google/start

## Variabili d'ambiente server-side (frontend/server.mjs)

Queste variabili sono lette solo dal server Node (`server.mjs`) e **non** sono esposte nel bundle Vite:

| Variabile | Obbligatoria | Default locale | Valore produzione Railway |
|---|---|---|---|
| `BACKEND_INTERNAL_URL` | Sì (produzione) | `http://localhost:3000` | `http://<backend-service-name>.railway.internal:<backend-port>` |
| `PORT` | No | `3000` | Impostata automaticamente da Railway |
| `NODE_ENV` | No | `development` | `production` |

**Fail-fast**: se `NODE_ENV=production` e `BACKEND_INTERNAL_URL` non è impostata, il processo termina con `process.exit(1)` al bootstrap.

Copiare `frontend/.env.example` in `frontend/.env.local` per lo sviluppo locale.

## Railway: Build vs Runtime variables

`VITE_*` viene letto da Vite al momento della build e viene incorporato nel bundle statico.

- Impostare `VITE_CAP_PROJECTS`, `VITE_CAP_ARTIFACTS`, `VITE_CAP_TOOLS_UPLOAD`, `VITE_CAP_MODELS`, `VITE_CAP_ADMIN_MODELS` come **Build Variables** del servizio frontend Railway.
- `BACKEND_INTERNAL_URL` resta una **Runtime Variable** del server Node (`server.mjs`).

Nel deploy corrente verificato: `BACKEND_INTERNAL_URL=http://gen-app-2.railway.internal:8080`.

Se `VITE_CAP_PROJECTS` viene impostata solo a runtime, il frontend continuerà a vedere capability disabilitata nel bundle già buildato.

## Avvio

1. Installazione dipendenze:

```bash
npm --prefix frontend install
```

2. Avvio dev server:

```bash
npm --prefix frontend run dev
```

3. Avvio server di produzione locale (con proxy verso backend locale):

```bash
BACKEND_INTERNAL_URL=http://localhost:3000 node frontend/server.mjs
```

Il server espone:
- `GET /health` → risposta locale
- `/auth/*`, `/generation/*`, `/api/*`, `/admin/users/*` → proxy verso `BACKEND_INTERNAL_URL`
- asset statici da `dist/`
- SPA fallback `dist/index.html`

## Build

```bash
npm --prefix frontend run build
```

Produce `frontend/dist`. Su Railway il build avviene nel Dockerfile; `server.mjs` viene avviato direttamente con `node server.mjs`.

## Capability Flags

Il frontend usa flag runtime `VITE_CAP_*` per attivare/disattivare i moduli backend-dipendenti.

Esempio `.env.local`:

```bash
VITE_CAP_PROJECTS=true
VITE_CAP_ARTIFACTS=true
VITE_CAP_TOOLS_UPLOAD=true

# opzionali
VITE_CAP_MODELS=false
VITE_CAP_ADMIN_MODELS=false
```

Note:

- `VITE_CAP_TOOLS_UPLOAD=true` abilita il flusso upload/extraction dal form tool (endpoint `POST /api/tools/briefs`).
- Se `VITE_CAP_TOOLS_UPLOAD=false`, il pulsante di processamento brief resta disabilitato e il frontend non chiama endpoint tools.

## Verifica

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test
```
