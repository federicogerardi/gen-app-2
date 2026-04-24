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

## Verifica

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test
```
