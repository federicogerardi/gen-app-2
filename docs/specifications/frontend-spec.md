# Frontend — Specifica as-is

**Data**: 2026-04-24  
**Radice sorgente**: `frontend/src/`  
**Stack**: React 18 + TypeScript + XState v5 + Vite

---

## Struttura delle directory

```
frontend/
  src/
    main.tsx                          # Entry point React
    App.tsx                           # Shell applicativa e orchestrazione auth
    styles.css                        # Stili globali
    features/
      auth/
        runtime/
          auth-client.ts              # Client HTTP autenticazione
        ui/
          LoginForm.tsx               # Form di login (username/password + OAuth)
      generation/
        contracts/
          backend-stream.ts           # Tipi condivisi con il backend (GenerationRequest, BackendStreamEvent)
        machines/
          frontend-stream.machine.ts  # XState machine dello streaming SSE
        parser/
          sse-parser.ts               # Parser SSE frame-by-frame
        runtime/
          generation-client.ts        # Client HTTP streaming (fetch + ReadableStream)
        ui/
          GenerationForm.tsx          # Form di invio richiesta di generazione
          GenerationStreamPanel.tsx   # Pannello di visualizzazione output stream
```

---

## Flusso applicativo

### Bootstrap sessione

Al mount di `App.tsx`:

1. `readSession()` chiama `GET /auth/session` con `credentials: 'include'`.
2. Se `401` → utente non autenticato → render `LoginForm`.
3. Se `200` → `AuthSession` salvata in state → render shell autenticata.

### Login nativo

1. Utente inserisce email + password in `LoginForm`.
2. `loginWithPassword()` chiama `POST /auth/login` con body JSON.
3. Backend imposta cookie `genapp_session` (HttpOnly, SameSite=Lax).
4. `AuthSession` salvata nello state → render shell autenticata.

### Login OAuth (Google)

- Il pulsante OAuth apre `GET /auth/google/start` come navigazione diretta (non fetch).
- Il callback `/auth/google/callback` imposta il cookie e redireziona al path configurato nel backend (`GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH`).

### Logout

1. `logoutSession()` chiama `POST /auth/logout`.
2. State `session` azzerato → render `LoginForm`.
3. La machine XState riceve evento `RESET`.

---

## Auth client (`auth-client.ts`)

| Funzione | Metodo | Endpoint | Note |
|---|---|---|---|
| `loginWithPassword` | POST | `/auth/login` | Ritorna `AuthSession` |
| `readSession` | GET | `/auth/session` | Ritorna `AuthSession \| null` (null se 401) |
| `logoutSession` | POST | `/auth/logout` | Nessun corpo nella risposta |
| `googleOAuthStartUrl` | — | `/auth/google/start` | Costruisce URL per navigazione diretta |

Tutte le funzioni accettano `{ apiBaseUrl?: string }`. Con `apiBaseUrl = ''` (default) le richieste usano path relativi e transitano attraverso il proxy Vite in sviluppo.

---

## Machine XState: `frontendStreamMachine`

### Stati

| Stato | Descrizione |
|---|---|
| `idle` | Nessuna richiesta attiva |
| `active` | Stato composto che mantiene attivo l'actor di trasporto SSE per tutta la durata della richiesta |
| `active.connecting` | Fetch avviata, in attesa di evento `start` dal backend |
| `active.streaming` | Ricezione chunk SSE in corso |
| `active.reconnecting` | Errore ritentabile, attesa delay esponenziale prima di rientrare in `active.connecting` |
| `completed` | Evento `terminal` ricevuto con `status: completed` |
| `failed` | Errore non ritentabile o `terminal` con `status: failed` |

### Struttura della machine

- `idle`, `completed` e `failed` sono stati top-level.
- `active` e uno stato composto con actor `streamTransport` invocato sul parent: il fetch SSE resta quindi vivo durante i passaggi interni tra `active.connecting`, `active.streaming` e `active.reconnecting`.
- La UI deriva il mode visualizzato dallo snapshot XState, non da flag duplicati nel context.

### Transizioni principali

- `idle` → `active.connecting`: evento `REQUEST_START`
- `active.connecting` → `active.streaming`: evento `SSE_START`
- `active.connecting` → `failed`: evento `SSE_CHUNK` ricevuto prima di `SSE_START` (errore di protocollo / ordine eventi invalido)
- `active.streaming` → `active.streaming`: evento `SSE_CHUNK` con guard di sequenza monotonica
- `active.streaming` → `failed`: evento `SSE_CHUNK` non monotono
- `active.*` → `completed`: evento `SSE_TERMINAL` con `status: completed`
- `active.*` → `failed`: evento `SSE_TERMINAL` con `status: failed`
- `active.connecting/active.streaming` → `active.reconnecting`: evento `STREAM_ERROR` con `retryable: true`
- `active.reconnecting` → `active.connecting`: timeout con delay esponenziale + jitter
- `active.reconnecting` → `failed`: massimo tentativi raggiunto
- qualsiasi → `idle`: evento `RESET`
- stato attivo → `idle`: evento `CANCEL` (abort del fetch)
- `failed` → `active.connecting`: evento `RETRY` se esiste una richiesta precedente da riusare
- `completed`/`failed` → `active.connecting`: nuovo evento `REQUEST_START` con nuova request

### Note di comportamento

- `RETRY` e supportato solo da `failed`; `completed` non effettua retry implicito.
- `CANCEL` esce dallo stato `active`, abortisce il fetch in corso e resetta il contesto stream a `idle`.
- Gli eventi `SSE_TERMINAL` e `STREAM_ERROR` sono gestiti sul parent `active`, cosi il comportamento resta uniforme nei sottostati interni.

### Input macchina

| Parametro | Default | Descrizione |
|---|---|---|
| `apiBaseUrl` | `''` | Base URL per le richieste |
| `maxReconnectAttempts` | `3` | Numero massimo di retry |
| `reconnectBaseDelayMs` | `500` | Delay base retry (ms) |
| `reconnectMaxDelayMs` | `4000` | Delay massimo retry (ms) |

### Delay di riconnessione

Backoff esponenziale con jitter:

```
delay = min(maxDelay, baseDelay × 2^(attempt-1)) + random(0..250ms)
```

---

## Parser SSE (`sse-parser.ts`)

- Gestisce buffer incrementale di chunk stringa (streaming fetch).
- Separa i frame SSE sul delimitatore `\n\n`.
- Estrae `event:` e `data:` da ogni frame.
- Lancia `SseProtocolError` se un frame è malformato (campo mancante o vuoto).
- `flush()` termina il buffer e ritorna eventuali frame residui.

I tipi di evento attesi dal backend:

| Event | Payload |
|---|---|
| `start` | `{ requestId, artifactId }` |
| `chunk` | `{ artifactId, chunk, sequence }` |
| `terminal` | `{ artifactId \| null, status: 'completed' \| 'failed', reason \| null }` |

---

## Generation client (`generation-client.ts`)

- Chiama `POST /generation/stream` con body JSON corrispondente a `GenerationRequest`.
- Legge la risposta come `ReadableStream<Uint8Array>` via `response.body.getReader()`.
- Ogni chunk viene decodificato (`TextDecoder`) e passato al parser SSE.
- Gestione degli errori:

| Caso | Codice errore | Ritentabile |
|---|---|---|
| HTTP non 2xx prima dello stream | `transport_pre_start` | sì |
| Abort del controller | `transport_mid_stream` | sì |
| Errore di rete a metà stream | `transport_mid_stream` | sì |
| Frame SSE malformato | `protocol_error` | no |
| Terminal con `status: failed` | `terminal_failed` | no |

---

## Configurazione sviluppo locale

### Variabili d'ambiente

| File | Variabile | Valore default | Scope |
|---|---|---|---|
| `frontend/.env.local` | `BACKEND_URL` | `http://localhost:3000` | Solo lato Node/Vite config |

> **Importante**: usare `BACKEND_URL` (senza prefisso `VITE_`) per evitare che Vite inietti il valore nel bundle del browser. Il browser deve usare sempre path relativi (`''`) per passare attraverso il proxy.

### Proxy Vite (`vite.config.ts`)

Tutti i path `/auth/*` e `/generation/*` sono proxati verso `BACKEND_URL` (default `http://localhost:3000`) con `changeOrigin: true`.

### Avvio

```sh
# Backend
set -a && . ./.env.local && set +a
npm run start:server

# Frontend (in un secondo terminale)
npm --prefix frontend run dev
```

Frontend disponibile su `http://localhost:5173`.

---

## Test

| File | Tipo | Coverage |
|---|---|---|
| `sse-parser.test.ts` | Unit | Parsing frame, errori protocollo, buffer incrementale |
| `frontend-stream.machine.test.ts` | Unit (XState) | Transizioni stati, reconnect, cancel, sequenza chunk |

Esecuzione: `npm --prefix frontend run test`

---

## Seed utente di sviluppo

| Campo | Valore |
|---|---|
| Email | `seed-user-001@example.local` |
| Password | `password123` |
| Ruolo | `admin` |
| Stato | `active` |
