# Frontend — Specifica as-is

**Data**: 2026-04-25  
**Radice sorgente**: `frontend/src/`  
**Stack**: React 19.2 + TypeScript + XState v5 + Vite

---

## Struttura delle directory

```
frontend/
  src/
    main.tsx                          # Entry point React
    App.tsx                           # Shell applicativa e orchestrazione auth
    styles.css                        # Stili globali
    app/
      copy/
        system.ts                     # Registry centralizzato copy UI + tono editoriale
      ui/
        primitives.tsx                # Primitive UI e vocabolario classi condivise
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

## Centralizzazione UI e copy

Lo stato as-is del frontend non usa piu silos locali per grafica e testi utente nelle pagine operative principali.

Fonte di verita visuale:

- Le linee guida di design system e UI kit sono definite in `docs/specifications/frontend-design-system-ui-kit-guide.md`.
- Questa specifica resta il contratto tecnico-operativo di implementazione (registry UI/copy, machine, runtime, test).

### Layer grafico condiviso

- `frontend/src/app/ui/primitives.tsx` e la fonte canonica delle primitive React riusabili (`Surface`, `Shell`, `TopBar`, `Button`) e dei token di classe (`uiPrimitives`).
- `frontend/src/styles.css` implementa i token CSS globali e gli alias `.ui-*` che danno forma visiva alle primitive.
- Le pagine non devono introdurre naming CSS ad hoc per pannelli, shell, navigation, card, meta line e action group se esiste gia un token nel registry UI.

### Layer copy condiviso

- `frontend/src/app/copy/system.ts` e la fonte canonica di tutto il testo utente centralizzato.
- Il modulo separa due domini:
  - `appCopy.ui`: microcopy operativo, label, CTA, stati, fallback error, option label, badge e navigation.
  - `appCopy.editorial`: tono di prodotto, headline, body copy e framing editoriale delle pagine.
- Il formatter `formatMeta()` centralizza il pattern `label: value` per metadati e stati di supporto.

### Stato di adozione corrente

- Shell pubblica/autenticata, dashboard, projects, artifacts, admin, generation e tool pages principali consumano il registry UI e il registry copy.
- I test frontend toccati in questo ciclo importano anch'essi `appCopy` dove l'asserzione dipende dal testo utente, per evitare divergenze tra runtime e suite di test.

---

## Tool Pages Architecture

Le pagine dei tool di generazione (HotLeadFunnel, NextLand, e futuri tool) seguono un pattern **unificato e scalabile** per eliminare duplicazione di codice e ridurre l'effort per aggiungere nuovi tool.

### Pattern di Unificazione

Ogni tool page è costruita tramite:

- **ToolFormRegistry**: Registry dichiarativa con configurazione tool-specifica (steps, labels, dipendenze).
- **useToolForm**: Composite hook che centralizza tutta la logica di state management (form, upload, generazione).
- **ToolPageTemplate**: Generic orchestration component che compone form, status feedback, step preview e azioni.
- **Canonical UI State**: Derivation logic che mappa lo stato locale → 8 stati UI unificati (`draft-empty`, `processing-briefing`, `draft-ready`, `running`, `completed`, ecc.).
- **Tool Page Wrappers** (FunnelPagesToolPage, NextlandToolPage): Minimalisti wrapper (~50 righe) che invocano `<ToolPageTemplate toolKey="..." />`.

### Outcome

| Metrica | Prima | Dopo |
|---------|-------|------|
| Duplicazione codice | ~95% | 0% |
| LOC per tool page | ~350 | ~50 |
| Aggiungere tool | 5-10 ore | ~30 min |
| Stato UI | 12 useState per page | 1 hook centralized |

### Aggiungerv Tool Nuovo

Richiede solo:

1. Aggiungere entry in `toolFormRegistry` (tool-form-architecture.ts)
2. Creare pagina wrapper minimalista (~50 righe)
3. Aggiungere route in app-router.tsx
4. Aggiungere copy entries in appCopy (opzionale ma raccomandato)

**Tempo totale: ~30 minuti** ✅

### Specifica Completa

Vedere [frontend-tool-pages-architecture-spec.md](./frontend-tool-pages-architecture-spec.md) per:
- Architettura dettagliata e componenti
- Registry pattern e configurazione
- Derivation logic per canonical UI state
- Type contracts e interfaces
- Step-by-step per aggiungere nuovo tool
- Migration path dalle tool page as-is al target unificato

---

## Regole obbligatorie per interventi futuri

### Interventi grafici

1. Prima cercare una primitive o un token esistente in `frontend/src/app/ui/primitives.tsx`.
2. Se il pattern esiste, riusarlo; non duplicare classi raw nel TSX.
3. Se il pattern non esiste, aggiungere prima il token al registry UI e poi mappare lo stile in `frontend/src/styles.css`.
4. Evitare classi locali orientate al contenuto come `new-card`, `special-panel`, `custom-header` se il comportamento e generalizzabile.

### Interventi di copy

1. Prima cercare il testo in `frontend/src/app/copy/system.ts`.
2. Se il testo descrive una meccanica UI o uno stato di sistema, inserirlo in `appCopy.ui`.
3. Se il testo definisce tono, posizionamento o narrativa di pagina, inserirlo in `appCopy.editorial`.
4. Evitare stringhe utente hardcoded nei componenti, inclusi empty state, error fallback, CTA, intestazioni e option label ripetute.
5. Quando il testo e costruito come metadato `chiave: valore`, usare `formatMeta()` invece di concatenazioni manuali.

### Interventi su test e regressioni

1. Se un test verifica testo utente, preferire `appCopy` come fonte dell'asserzione quando il testo e parte del contratto di prodotto.
2. Se il test deve restare resilient al rewording, usare query per ruolo o comportamento invece di replicare stringhe hardcoded.
3. Non introdurre fixture di copy parallele nei test se il testo esiste gia nel registry condiviso.

### Criterio di accettazione per nuovi cambiamenti frontend

Un intervento frontend e coerente con questa specifica solo se:

- non introduce nuovi silos di stile o copy nel TSX;
- aggiorna i registry condivisi prima dei consumer;
- mantiene allineati runtime, test e documentazione;
- valida almeno `npm --prefix frontend run build` dopo la modifica.

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

### Convenzioni request tools/extraction (as-is)

- `model` usa formato `provider/model` (es. `openrouter/auto`).
- Se arriva un formato legacy con `:` (es. `openrouter:auto`), la normalizzazione avviene lato backend runtime.
- Nel flusso tools step-by-step la request include:
  - `extractionPayload` (output extraction)
  - `stepDependencyArtifactIds` e `stepDependencyArtifactIdsByStep`
  - `stepDependencyArtifactContentsByStep` quando disponibili i contenuti degli artifact precedenti
- Obiettivo: ogni step riceve sia il contesto extraction sia il contesto progressivo dei passi precedenti.

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

Validazione minima per interventi che toccano UI o copy centralizzati:

- `npm --prefix frontend run build`
- `npm --prefix frontend run test` oppure una selezione mirata delle suite toccate

---

## Seed utente di sviluppo

| Campo | Valore |
|---|---|
| Email | `seed-user-001@example.local` |
| Password | `password123` |
| Ruolo | `admin` |
| Stato | `active` |

---

## Backend capability matrix

Ogni modulo frontend dichiara la propria dipendenza da endpoint backend tramite `BackendCapabilities` (`frontend/src/app/runtime/backend-capabilities.ts`). Quando una capability non è disponibile, il modulo usa un adapter con fallback deterministico ai dati locali.

| Capability | Flag env (`VITE_CAP_*`) | Endpoint backend | Fallback locale |
|---|---|---|---|
| `projects` | `VITE_CAP_PROJECTS` | `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects` | Lista vuota (nessun mock) |
| `models` | `VITE_CAP_MODELS` | `GET /api/models` | Array vuoto |
| `artifacts` | `VITE_CAP_ARTIFACTS` | `GET /api/artifacts`, `GET /api/artifacts/:id` | Store locale `GenerationArtifact[]` da `GenerationWorkspaceProvider` |
| `toolsUpload` | `VITE_CAP_TOOLS_UPLOAD` | `POST /api/tools/briefs` | Disabilitato (process briefing non disponibile) |
| `adminModels` | `VITE_CAP_ADMIN_MODELS` | `GET /api/admin/models` | Banner "Backend endpoint pending" |

### Comportamento fallback per modulo

| Modulo | Comportamento senza capability |
|---|---|
| Projects list/detail | Mostra lista vuota; nessuna chiamata HTTP |
| Artifacts archive | Filtra artifacts da store XState locale; nessuna chiamata HTTP |
| Artifact detail | Cerca per `artifactId` tra artifacts locali; restituisce null se non trovato |
| Admin models | Mostra pagina con banner warning; dati modelli non disponibili |
| Admin users | Chiama sempre `/admin/users` (endpoint as-is disponibile); nessun fallback |
| Tool upload | Upload/extraction disabilitati; nessuna chiamata HTTP verso `/api/tools/briefs` |

### Route endpoint as-is confermati

| Endpoint | Descrizione |
|---|---|
| `POST /auth/login` | Login con email/password |
| `POST /auth/logout` | Logout sessione |
| `GET /auth/session` | Lettura sessione corrente |
| `GET /auth/google/start` | OAuth Google start |
| `POST /generation/stream` | Stream SSE generazione (`start/chunk/terminal`) |
| `GET /admin/users` | Lista utenti admin |
| `GET /admin/users/:id` | Dettaglio utente admin |

### Stato implementazione cutover (2026-04-25)

- Backend `/api/projects*` e `/api/artifacts*` è implementato nel runtime HTTP con protezione sessione e filtro user-scoped.
- Frontend `projects-client` e `artifacts-client` è stato allineato a:
  - branch live quando capability è `true`
  - fallback deterministico quando capability è `false`
- Provider sessione espone ora le capability runtime ai consumer pagina.
- Proxy dev Vite inoltra anche `/api/*` verso backend locale.

Validazioni registrate in questo ciclo:

- gate frontend `npm --prefix frontend run typecheck` e `npm --prefix frontend run test` verdi
- gate backend `npm run backend:go` verde (include smoke `smoke:queries`)
- E2E HTTP locale autenticato verificato su:
  - `POST /auth/login`
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/artifacts?status=completed`

Decisione fallback consolidata:

- `projects-client` usa fallback vuoto quando capability projects è disattivata (`empty-fallback-when-capability-disabled`), evitando dati mock in UI.
- Con capability attive (`VITE_CAP_PROJECTS=true`, `VITE_CAP_ARTIFACTS=true`) il ramo live è il path primario.
- Confermata funzionalita frontend projects in capability-live: list e create operative via backend.
