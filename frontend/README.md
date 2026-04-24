# Frontend Generation UI

Frontend React + XState v5 che consuma il backend as-is:

- stream POST /generation/stream con parser SSE start/chunk/terminal
- auth cookie routes: /auth/login, /auth/logout, /auth/session
- Google OAuth start link: /auth/google/start

## Avvio

1. Installazione dipendenze:

```bash
npm --prefix frontend install
```

2. Avvio dev server:

```bash
npm --prefix frontend run dev
```

3. Opzionale base URL backend (default http://localhost:3000):

```bash
VITE_API_BASE_URL=http://localhost:3000 npm --prefix frontend run dev
```

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
