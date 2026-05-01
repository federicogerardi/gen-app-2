---
goal: Railway Private-Network Same-Origin Plan
version: 1.0
date_created: 2026-05-01
last_updated: 2026-05-01
owner: Platform/DevOps
status: In Progress
tags: [architecture, railway, same-origin, private-network, frontend, backend, proxy]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano definisce la topologia di deploy same-origin adottata: il browser comunica sempre con l'host pubblico del servizio frontend Railway, mentre `frontend/server.mjs` inoltra internamente le route applicative al backend tramite networking privato Railway. Il backend non viene esposto pubblicamente al browser durante il target finale.

Topologia target:

```text
Browser -> https://frontend.up.railway.app/*
        -> frontend/server.mjs
        -> http://backend.railway.internal:3000/*
        -> PostgreSQL + Redis
```

Obiettivo operativo: ottenere same-origin browser-side senza dipendere da DNS custom esterno, mantenendo sessioni cookie-based, SSE e SPA fallback sotto un unico host pubblico Railway.

## 1. Requirements & Constraints

- **REQ-001**: Il browser deve continuare a usare solo path relativi per `/auth/*`, `/generation/*`, `/api/*` e `/admin/users/*`.
- **REQ-002**: Il solo host pubblico finale deve essere il servizio frontend Railway.
- **REQ-003**: Il backend deve restare raggiungibile dal frontend tramite hostname privato Railway, senza dipendenza da public networking per il traffico applicativo browser-side.
- **REQ-004**: `frontend/server.mjs` deve gestire sia static asset + SPA fallback sia proxy HTTP verso il backend interno.
- **REQ-005**: Il proxy frontend deve preservare metodo, path, querystring, header necessari, cookie e streaming SSE senza buffering distruttivo.
- **REQ-006**: Il flusso Google OAuth deve rientrare sull'host pubblico frontend e terminare correttamente nella SPA.
- **SEC-001**: Il backend target finale non deve essere esposto direttamente al browser tramite hostname pubblico per route applicative normali.
- **SEC-002**: I cookie di sessione devono restare `HttpOnly`; `Secure=true` in produzione HTTPS Railway.
- **SEC-003**: `AUTH_COOKIE_SAMESITE` deve essere `lax` nel target same-origin private-network.
- **OPS-001**: La configurazione deve funzionare senza dominio custom o DNS esterno.
- **OPS-002**: Il piano deve prevedere rollback verso topologia cross-origin pubblica attuale.
- **CON-001**: Non introdurre un terzo servizio proxy dedicato come target primario; il proxy vive in `frontend/server.mjs`.
- **CON-002**: Non modificare i contratti API backend né la semantica dei path lato browser.
- **CON-003**: Non introdurre `VITE_API_BASE_URL` pubblico in produzione.
- **GUD-001**: Riutilizzare il pattern locale già presente in `frontend/vite.config.ts`, che proxya gli stessi path verso un backend target.
- **PAT-001**: Formalizzare la topologia in documentazione e configurazione versionata repository-first.

## 2. Implementation Steps

### Sprint 0 - Baseline & Feasibility

- **GOAL-001**: Validare la fattibilita tecnica del proxy applicativo nel frontend Railway e congelare la baseline cross-origin corrente.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Aggiornare `docs/02-design/specifications/deployment-architecture-guide.md` con una nuova sezione `Variant B - Private-Network Same-Origin via frontend/server.mjs`, includendo il diagramma del flusso browser -> frontend -> backend. | ✅ | 2026-05-01 |
| TASK-002 | Documentare la baseline attuale cross-origin: host pubblico frontend, host pubblico backend, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `AUTH_COOKIE_SAMESITE`, `GOOGLE_REDIRECT_URI`. | ✅ | 2026-05-01 |
| TASK-003 | Verificare che il frontend possa raggiungere il backend via hostname interno Railway. Metodo concreto: aggiungere temporaneamente un endpoint `/debug/connectivity` in `frontend/server.mjs` che esegue una richiesta `GET` a `${BACKEND_INTERNAL_URL}/health` e restituisce `{ ok, status, backendUrl }`. Deployare, chiamare `curl https://<frontend-public-host>/debug/connectivity`, registrare l'hostname e la porta reali nel deployment guide, poi rimuovere l'endpoint prima del go-live. Se il backend non e raggiungibile (`ECONNREFUSED`, `ENOTFOUND`), bloccare l'esecuzione degli sprint successivi fino a risoluzione. | ✅ | 2026-05-01 |
| TASK-004 | Definire esplicitamente l'elenco route da proxare in `frontend/server.mjs` e la strategia di matching: usare `url.startsWith(prefix)` su prefissi esatti `/auth`, `/generation`, `/api`, `/admin/users` (senza wildcard regex). Ordine di valutazione obbligatorio nel request handler: **(1)** `/health` → risposta locale; **(2)** route proxy (startsWith prefisso) → forward al backend, qualunque metodo HTTP; **(3)** asset statici esistenti in `dist/`; **(4)** SPA fallback `dist/index.html`. Il trailing slash (`/api/` vs `/api`) deve essere normalizzato oppure entrambe le forme devono matchare il prefisso. | ✅ | 2026-05-01 |

**Completion Criteria**

- Il deployment guide contiene la variante private-network con prerequisiti espliciti.
- La baseline cross-origin e disponibile per rollback.
- Hostname interno backend e porta sono verificati o dichiarati come prerequisito bloccante.

### Sprint 1 - Frontend Proxy Implementation

- **GOAL-002**: Rendere `frontend/server.mjs` il punto unico di ingresso pubblico capace di servire SPA e fare reverse proxy al backend interno Railway.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-005 | Modificare `frontend/server.mjs` per intercettare i path `/auth`, `/generation`, `/api`, `/admin/users` prima del fallback SPA e inoltrarli al backend interno Railway. **Attenzione**: la riga 41 di `server.mjs` applica una guardia `405 Method Not Allowed` globale per tutti i metodi diversi da GET/HEAD; questa guardia deve essere rimossa o riposizionata in modo che si applichi solo alle route di asset statici e SPA fallback, altrimenti ogni `POST`, `PUT`, `DELETE` verso le route proxy viene bloccata prima di raggiungere la logica di inoltro. | ✅ | 2026-05-01 |
| TASK-005b | Dichiarare e documentare l'API Node.js usata per il proxy: usare **`undici` (`fetch` o `request`)** disponibile in Node 18+ senza dipendenze aggiuntive, oppure `node:http.request` built-in. **Non** usare librerie di terze parti (es. `http-proxy`, `express`). La scelta impatta: streaming SSE (undici supporta body stream nativo), timeout configurabili, e comportamento con connessioni keep-alive. Documenta la scelta scelta in un commento all'inizio della sezione proxy di `server.mjs`. | ✅ | 2026-05-01 |
| TASK-006 | Implementare nel proxy di `frontend/server.mjs` il forward integrale di: **(a) request** — metodo, querystring, body, `cookie`, `content-type`, `authorization`, `x-forwarded-for`, `x-real-ip` e header CSRF; **(b) response** — passare integralmente al browser tutti gli header di risposta dal backend, in particolare `Set-Cookie`, `Location`, `Content-Type`, `Cache-Control`, `WWW-Authenticate`. Filtrare o ignorare gli header di risposta rompe auth e OAuth silenziosamente. Il forward di `x-forwarded-for` e necessario per preservare l'IP client (`auth-http.ts` linee 235-237, 458, 556). **Escludere** dalla risposta al browser gli header hop-by-hop HTTP/1.1 che non devono essere inoltrati: `transfer-encoding`, `connection`, `keep-alive`, `proxy-authenticate`, `proxy-authorization`, `te`, `trailers`, `upgrade`; passarli causa errori Node.js a runtime (`Error: Invalid header value`). | ✅ | 2026-05-01 |
| TASK-007 | Garantire supporto SSE nel proxy frontend con le seguenti chiamate esplicite: **(1)** rilevare `content-type: text/event-stream` nella risposta backend; **(2)** chiamare `response.flushHeaders()` immediatamente dopo aver impostato gli header SSE nel browser, prima di iniziare a scrivere i chunk; **(3)** impostare `response.socket?.setNoDelay(true)` per disabilitare l'algoritmo di Nagle; **(4)** fare il pipe del body backend verso la response browser senza buffering intermedio; **(5)** gestire il disconnect del client (evento `close` sulla request browser) con la distruzione esplicita della upstream request verso il backend (`upstreamReq.destroy()`) per evitare connessioni zombie. | ✅ | 2026-05-01 |
| TASK-008 | Gestire error path del proxy in `frontend/server.mjs`: backend interno non raggiungibile -> risposta `502` con body diagnostico minimale e log server-side strutturato. | ✅ | 2026-05-01 |
| TASK-009 | Introdurre env frontend server-side non bundle-exposed `BACKEND_INTERNAL_URL`, letta solo da `frontend/server.mjs` (non da Vite, quindi non esposta nel bundle). Default per sviluppo locale: `http://localhost:3000`. In produzione Railway: `http://backend.railway.internal:3000`. **Fail-fast**: all'avvio di `server.mjs`, se il processo e in produzione (`NODE_ENV === 'production'`) e `BACKEND_INTERNAL_URL` non e impostata, il processo deve terminare immediatamente con `process.exit(1)` e messaggio esplicito (`BACKEND_INTERNAL_URL is required in production`), anziche fallire silenziosamente alla prima richiesta proxy. Documentare in `frontend/README.md` e `frontend/.env.example`. | ✅ | 2026-05-01 |

**Completion Criteria**

- `frontend/server.mjs` distingue correttamente tra asset/statici, `/health`, route proxate e SPA fallback.
- Le route applicative browser-side funzionano senza chiamare un host backend pubblico.
- SSE continua a funzionare dietro il proxy frontend.
- **Test locale pre-Railway**: `BACKEND_INTERNAL_URL=http://localhost:3000 node frontend/server.mjs` con backend locale attivo risponde correttamente a `GET /health`, `POST /auth/login`, `DELETE /auth/session` e `POST /generation/stream` senza 405 e senza timeout SSE.

### Sprint 2 - Railway Networking & Security Cutover

- **GOAL-003**: Spostare la topologia Railway dal backend pubblico alla comunicazione interna frontend -> backend, mantenendo l'host pubblico frontend come unica entrypoint browser.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-010 | Aggiornare `frontend/railway.toml` e la configurazione del servizio frontend Railway per usare il runtime `server.mjs` come entrypoint pubblico unico, con `PORT` e healthcheck `/health` coerenti. | ✅ | 2026-05-01 |
| TASK-010b | Correggere il `CMD` in `frontend/Dockerfile`: attualmente `CMD ["npm", "run", "start"]` esegue `npm run build && npm run start:server`, causando una **double-build** ad ogni restart Railway. Sostituire con `CMD ["node", "server.mjs"]` direttamente, o aggiungere uno script `"start:prod": "node server.mjs"` in `package.json` e usare quello. **Verificare anche `frontend/railway.toml`**: il campo `startCommand = "npm run start"` sovrascrive il `CMD` del Dockerfile in Railway (comportamento equivalente a Docker Compose `command`). Aggiornare `startCommand` in `railway.toml` in modo coerente con la correzione al Dockerfile, altrimenti il fix non ha effetto in produzione. | ✅ | 2026-05-01 |
| TASK-011 | Configurare il servizio backend Railway per essere raggiungibile dal frontend tramite networking interno. Se Railway richiede public networking attivo per healthcheck o gestione, documentare che l'host pubblico backend resta non usato dal browser ma disponibile solo come rollback operativo. |  |  |
| TASK-012 | Aggiornare env backend per target same-origin browser-side: `FRONTEND_ORIGIN=https://<frontend-public-host>`, `CORS_ALLOWED_ORIGINS=https://<frontend-public-host>`, `CSRF_TRUSTED_ORIGINS=https://<frontend-public-host>`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`. |  |  |
| TASK-013 | Aggiornare `GOOGLE_REDIRECT_URI` per rientrare sull'host pubblico frontend (`https://<frontend-public-host>/auth/google/callback`) e verificare che il proxy inoltri correttamente la callback al backend. **Step obbligatorio e bloccante**: aggiungere l'URI `https://<frontend-public-host>/auth/google/callback` negli **Authorized Redirect URIs** del client OAuth nel pannello Google Cloud Console (`APIs & Services > Credentials > OAuth 2.0 Client IDs`). Senza questo step Google restituisce `redirect_uri_mismatch` (errore 400) e il flusso OAuth e completamente bloccato indipendentemente dalla configurazione backend/proxy. |  |  |
| TASK-014 | Aggiornare il deployment guide con distinzione esplicita tra `frontend public host`, `backend internal host`, eventuale `backend public rollback host`. |  |  |
| TASK-014b | Deprecare o aggiornare la nota in `docs/02-design/specifications/deployment-architecture-guide.md` che afferma che `GOOGLE_REDIRECT_URI` resta sul dominio backend pubblico. Con questa variante la callback OAuth si sposta sull'host frontend (`https://<frontend-public-host>/auth/google/callback`), quindi la nota e in conflitto con TASK-013. |  |  |

**Completion Criteria**

- Il browser usa un solo host pubblico Railway.
- Il backend applicativo non e piu richiesto direttamente dal browser.
- Cookie/CORS/CSRF sono coerenti con same-origin browser-side.

### Sprint 3 - Validation & Go-Live Gates

- **GOAL-004**: Validare end-to-end la variante private-network same-origin con check tecnici e funzionali ripetibili.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-015 | Eseguire gate backend: `npm run typecheck`, `npm run test`, `set -a && . ./.env.local && set +a && npm run test:smoke`. |  |  |
| TASK-016 | Eseguire gate frontend: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm --prefix frontend run build`. |  |  |
| TASK-017 | Aggiungere nel deployment guide una checklist di smoke runtime sul solo host frontend pubblico: `/health`, login, logout, `GET /auth/session`, CRUD principali, SSE `/generation/stream`, callback OAuth. |  |  |
| TASK-018 | Verificare che login e refresh su browser desktop e mobile reale non producano logout involontario e che il cookie sessione sia `HttpOnly`, `Secure`, `SameSite=Lax`. |  |  |
| TASK-019 | Verificare che il backend non riceva traffico browser-side diretto durante il test target; i log devono mostrare richieste applicative provenienti dal frontend proxy o dall'internal network. |  |  |

**Completion Criteria**

- Tutti i gate locali passano.
- Browser desktop e mobile usano solo il frontend public host.
- SSE, OAuth e sessioni cookie-based risultano stabili.

### Sprint 4 - Hardening & Rollback Discipline

- **GOAL-005**: Consolidare la variante privata, ridurre il rischio operativo e formalizzare il rollback.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-020 | Aggiungere logging sintetico in `frontend/server.mjs` per distinguere richieste statiche, SPA fallback, proxy success e proxy failure senza esporre dati sensibili. |  |  |
| TASK-021 | Documentare timeout, header e limiti del proxy frontend rilevanti per SSE e upload, con soglie operative e segnali di allarme. |  |  |
| TASK-022 | Formalizzare rollback a cross-origin: ripristino uso host pubblico backend nel browser, `AUTH_COOKIE_SAMESITE=none`, `CORS_ALLOWED_ORIGINS` aggiornati, `GOOGLE_REDIRECT_URI` su backend pubblico. |  |  |
| TASK-023 | Registrare nel deployment guide i rischi aperti della variante private-network: dipendenza da DNS interno Railway, impatto di restart frontend sul traffico proxy, debugging multi-hop. |  |  |

**Completion Criteria**

- Esiste rollback eseguibile e documentato.
- Il proxy frontend ha osservabilita sufficiente per troubleshooting.
- I rischi residui sono registrati con mitigazioni operative.

## 3. Alternatives

- **ALT-001**: Same-origin via dominio custom e rewrite edge esterno. Non scelto in questo piano perche richiede DNS custom e non sfrutta il private networking Railway come percorso primario.
- **ALT-002**: Due host pubblici cross-origin. Non scelto perche mantiene complessita CORS/CSRF/cookie cross-site lato browser.
- **ALT-003**: Terzo servizio proxy dedicato (Nginx/Caddy). Non scelto come target primario per evitare un hop addizionale e una superficie operativa in piu.
- **ALT-004**: Backend pubblico diretto e frontend solo statico. Non scelto perche non realizza same-origin browser-side.

## 4. Dependencies

- **DEP-001**: Servizio frontend Railway basato su `frontend/server.mjs` e `frontend/Dockerfile` gia deployabile.
- **DEP-002**: Servizio backend Railway raggiungibile via internal networking dal frontend.
- **DEP-003**: Healthcheck frontend e backend operativi.
- **DEP-004**: PostgreSQL e Redis disponibili al backend in produzione.
- **DEP-005**: Google OAuth aggiornabile per callback sull'host pubblico frontend.
- **DEP-006**: Supporto Node runtime nel frontend per proxy HTTP e streaming response.

## 5. Files

- **FILE-001**: `frontend/server.mjs` - implementazione del proxy applicativo interno Railway.
- **FILE-002**: `frontend/railway.toml` - conferma del runtime pubblico frontend e healthcheck coerenti.
- **FILE-003**: `frontend/README.md` - documentazione env `BACKEND_INTERNAL_URL`, build e run Railway.
- **FILE-004**: `docs/02-design/specifications/deployment-architecture-guide.md` - variante private-network, runbook, rollback e troubleshooting.
- **FILE-005**: `.env.example` (root) - env backend: `DATABASE_URL`, `UPSTASH_REDIS_URL`, `FRONTEND_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, ecc. Non includere qui `BACKEND_INTERNAL_URL`, che e una env del servizio frontend Railway e non appartiene al backend.
- **FILE-006**: `frontend/.env.example` (nuovo file) - env server-side del frontend Railway: `BACKEND_INTERNAL_URL=http://backend.railway.internal:3000`. Separata dal root `.env.example` per evitare confusione tra variabili backend e variabili del proxy frontend.
- **FILE-007**: `frontend/Dockerfile` - correzione `CMD` per eliminare double-build (TASK-010b).
- **FILE-008**: `plan/architecture-railway-private-network-same-origin-1.md` - questo piano.

## 6. Testing

- **TEST-001**: `npm --prefix frontend run build` produce `frontend/dist` senza errori.
- **TEST-002**: `npm --prefix frontend run typecheck` passa senza errori.
- **TEST-003**: `npm --prefix frontend run test` passa senza errori.
- **TEST-004**: `npm run typecheck` passa senza errori.
- **TEST-005**: `npm run test` passa senza errori.
- **TEST-006**: `set -a && . ./.env.local && set +a && npm run test:smoke` passa con env locali caricate.
- **TEST-007**: `curl -i https://<frontend-public-host>/health` restituisce `200`.
- **TEST-008**: `curl -i https://<frontend-public-host>/auth/session` restituisce risposta backend coerente tramite proxy frontend.
- **TEST-009**: Login browser imposta cookie `HttpOnly`, `Secure`, `SameSite=Lax` sull'host frontend pubblico.
- **TEST-010**: `POST /generation/stream` (metodo corretto: il backend richiede POST, non GET - cfr. `src/lib/runtime/node-server.ts` riga 295) rimane aperto e riceve eventi SSE senza buffering anomalo; il body della richiesta deve essere inoltrato integralmente dal proxy frontend.
- **TEST-011**: Refresh di una route SPA autenticata non restituisce `404` e non intercetta le route backend proxate.
- **TEST-012**: Callback OAuth `GET /auth/google/callback` rientra via frontend host e completa il redirect finale alla SPA.
- **TEST-013**: Test proxy locale pre-Railway — con `BACKEND_INTERNAL_URL=http://localhost:3000 node frontend/server.mjs` e backend locale attivo: `curl -X POST http://localhost:<PORT>/auth/login` e `curl -X DELETE http://localhost:<PORT>/auth/session` restituiscono il codice HTTP del backend (non `405`); `curl -X POST http://localhost:<PORT>/generation/stream` apre la connessione SSE senza bloccarsi. Questo test verifica che la guardia 405 (TASK-005) sia stata rimossa correttamente prima del deploy Railway.

## 7. Risks & Assumptions

- **RISK-001**: `frontend/server.mjs` oggi non implementa proxy; l'aggiunta puo introdurre regressioni su fallback SPA o static asset se l'ordine di matching e errato.
- **RISK-002**: Il proxy frontend puo interrompere SSE se usa buffering o timeout incompatibili con connessioni lunghe.
- **RISK-003**: Railway internal hostname o networking policy possono differire dall'assunzione `backend.railway.internal:3000`.
- **RISK-004**: La callback OAuth puo fallire se il backend genera URL assoluti non coerenti con l'host pubblico frontend.
- **RISK-005**: Se il backend resta pubblicamente esposto per motivi operativi, il team puo continuare accidentalmente a testare il path pubblico sbagliato, mascherando regressioni del proxy frontend.
- **RISK-006**: Se il proxy frontend non inoltra `x-forwarded-for`, l'IP client registrato in sessione/audit sara quello interno Railway del frontend, rendendo inutilizzabile il tracciamento IP per sicurezza e diagnostica.
- **RISK-007**: Se nel pannello Railway viene impostata la build var `VITE_API_BASE_URL=https://<backend-public-host>`, la build Vite incorpora l'URL backend nel bundle (cfr. `frontend/Dockerfile` ARG/ENV e `AuthSessionProvider.tsx` riga 47), bypassando il proxy `server.mjs` e rompendo il same-origin. `VITE_API_BASE_URL` deve restare **vuota o non impostata** nelle Railway build vars in questa variante.
- **ASSUMPTION-001**: Il frontend Node runtime puo effettuare richieste HTTP server-side verso il backend interno Railway.
- **ASSUMPTION-002**: Le route browser restano relative; nessuna porzione del frontend richiede un hostname backend pubblico hardcoded.
- **ASSUMPTION-003**: Il backend puo accettare traffico proxyato dal frontend senza cambiare i contratti HTTP pubblici.

## 8. Related Specifications / Further Reading

- [deployment-architecture-guide](../docs/02-design/specifications/deployment-architecture-guide.md)
- [frontend-spec](../docs/02-design/specifications/frontend-spec.md)
- [frontend/server.mjs](../frontend/server.mjs)
- [frontend/vite.config.ts](../frontend/vite.config.ts)
- [src/server.ts](../src/server.ts)