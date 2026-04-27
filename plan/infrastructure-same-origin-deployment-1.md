---
goal: Same-Origin Deployment Implementation Plan
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-27
owner: GitHub Copilot
status: Planned
tags: [infrastructure, deployment, frontend, backend, auth, same-origin]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano definisce l'implementazione della variante di deploy same-origin per frontend e backend, con il browser che continua a usare path relativi e un layer di rewrite o reverse proxy che instrada le route applicative verso il backend persistente. La variante con due origini pubbliche distinte non rientra in questo piano esecutivo: viene registrata come analisi differita con rischi e verifiche da svolgere successivamente.

## 1. Requirements & Constraints

- **REQ-001**: Il browser deve continuare a chiamare solo path relativi same-origin per `auth`, `generation`, `api` e `admin/users`.
- **REQ-002**: Il backend deve restare deployato come server Node persistente compatibile con SSE, sessioni cookie-based, PostgreSQL e Redis.
- **REQ-003**: Il layer di edge routing deve inoltrare senza trasformazioni funzionali le route `/auth/*`, `/generation/*`, `/api/*` e `/admin/users/*` al backend pubblico.
- **REQ-004**: La configurazione di produzione deve essere rappresentata nel repository con file e documentazione riproducibili.
- **REQ-005**: Il flusso Google OAuth deve continuare a funzionare con callback e redirect coerenti con la topologia same-origin lato browser.
- **SEC-001**: I cookie di sessione devono restare `HttpOnly` e `Secure` in produzione.
- **SEC-002**: `AUTH_COOKIE_SAMESITE` deve restare `lax` per la variante same-origin salvo controindicazioni verificate.
- **SEC-003**: `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` devono essere limitati all'origine pubblica del frontend same-origin.
- **OPS-001**: Il piano deve coprire almeno una configurazione di hosting del frontend con rewrites committata nel repository.
- **OPS-002**: Il piano deve produrre una checklist di validazione pre-deploy e post-deploy eseguibile senza interpretazione aggiuntiva.
- **CON-001**: Non introdurre in questo piano la variante cross-origin come target implementativo.
- **CON-002**: Non modificare il comportamento applicativo del frontend che oggi usa `VITE_API_BASE_URL` vuoto di default e path relativi.
- **CON-003**: Non cambiare il modello auth da cookie-based a token-based.
- **GUD-001**: Favorire la topologia coerente con l'architettura già documentata in `docs/02-design/specifications/deployment-architecture-guide.md`.
- **PAT-001**: Formalizzare l'infrastruttura tramite configurazioni versionate e non tramite soli passaggi manuali fuori repository.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Formalizzare la topologia same-origin come target ufficiale di deploy.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Creare o aggiornare il documento di deployment operativo sotto `docs/02-design/specifications/` per dichiarare la variante same-origin come target raccomandato e chiarire che il browser usa path relativi. |  |  |
| TASK-002 | Documentare in modo esplicito le route da inoltrare: `/auth/*`, `/generation/*`, `/api/*`, `/admin/users/*`, includendo il mapping esatto verso l'host backend pubblico. |  |  |
| TASK-003 | Documentare le env di produzione obbligatorie del backend: `DATABASE_URL`, `UPSTASH_REDIS_URL`, `NODE_ENV`, `FRONTEND_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH`. |  |  |
| TASK-004 | Aggiornare `.env.example` per includere tutte le env obbligatorie di deploy online, distinguendo chiaramente esempio locale da esempio produzione. |  |  |

**Completion Criteria**

- La documentazione di deploy identifica una sola topologia esecutiva primaria: same-origin.
- `.env.example` copre tutte le variabili richieste per il bootstrap di produzione.
- Le route inoltrate sono elencate in forma esplicita e verificabile.

### Implementation Phase 2

- **GOAL-002**: Versionare la configurazione di edge routing o hosting necessaria per mantenere il comportamento same-origin nel browser.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-005 | Scegliere una configurazione primaria di hosting frontend tra `netlify.toml`, `vercel.json` o reverse proxy equivalente già supportato dall'hosting target e salvarla nel repository root. |  |  |
| TASK-006 | Implementare nella configurazione scelta i rewrite 200 per `/auth/*`, `/generation/*`, `/api/*` e `/admin/users/*` verso il backend pubblico. |  |  |
| TASK-007 | Aggiungere il fallback SPA per tutte le route client-side non API verso `frontend/dist/index.html`, senza intercettare le quattro famiglie di route backend. |  |  |
| TASK-008 | Documentare il comando build del frontend e il path di publish esatto per l'hosting selezionato. |  |  |

**Completion Criteria**

- Esiste un file di configurazione versionato per l'hosting frontend.
- La configurazione distingue rewrites backend e fallback SPA senza ambiguità.
- Le route applicative del browser non richiedono `VITE_API_BASE_URL` per funzionare in produzione.

### Implementation Phase 3

- **GOAL-003**: Bloccare la configurazione backend di produzione per cookie, CORS, CSRF e OAuth nella topologia same-origin.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-009 | Definire nel runbook operativo i valori attesi di `FRONTEND_ORIGIN`, `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` come singola origine pubblica del frontend. |  |  |
| TASK-010 | Definire nel runbook operativo i valori attesi di `AUTH_COOKIE_SECURE=true` e `AUTH_COOKIE_SAMESITE=lax` per produzione same-origin. |  |  |
| TASK-011 | Definire il valore di `GOOGLE_REDIRECT_URI` in coerenza con il dominio pubblico finale e la route `/auth/google/callback` esposta tramite rewrite same-origin. |  |  |
| TASK-012 | Verificare e documentare che `GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH` punti a un path frontend valido servito dalla SPA. |  |  |

**Completion Criteria**

- Tutte le env di sicurezza e OAuth hanno un valore target esplicito per produzione.
- Il modello cookie-based resta coerente con same-origin e non richiede eccezioni cross-site.
- Il callback OAuth è definito con URI e redirect finale verificabili.

### Implementation Phase 4

- **GOAL-004**: Rendere il go-live verificabile con una checklist eseguibile e convalidare la topologia same-origin end-to-end.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-013 | Aggiungere una checklist pre-deploy con i comandi esatti: `npm --prefix frontend run build`, `npm --prefix frontend run typecheck`, `npm run typecheck`, `npm run test`, `npm run test:smoke` con caricamento esplicito delle env locali se richiesto. |  |  |
| TASK-014 | Aggiungere una checklist post-deploy con verifiche browser e CLI: bootstrap sessione, login, logout, streaming SSE, accesso admin, routing SPA e callback OAuth. |  |  |
| TASK-015 | Documentare una smoke verification same-origin con richieste HTTP all'origine pubblica frontend, verificando che le route rewrite raggiungano il backend senza CORS errors. |  |  |
| TASK-016 | Registrare esplicitamente la variante con due origini pubbliche distinte come analisi successiva, con elenco dei rischi aperti e senza inserirla nella checklist di go-live corrente. |  |  |

**Completion Criteria**

- Esiste una checklist end-to-end eseguibile senza decisioni implicite.
- Il go-live same-origin è validabile con comandi e scenari UI espliciti.
- La variante cross-origin è marcata come differita e fuori scope operativo.

## 3. Alternatives

- **ALT-001**: Frontend e backend su due origini pubbliche distinte con chiamate browser dirette al backend. Non scelto in questo piano perché aumenta il rischio su cookie cross-site, CORS, CSRF e comportamento OAuth.
- **ALT-002**: Unificare frontend e backend nello stesso processo server applicativo. Non scelto perché il repository è già strutturato come frontend statico separato e backend persistente dedicato.
- **ALT-003**: Passare da sessioni cookie-based a bearer token nel browser. Non scelto perché cambierebbe il modello auth e allarga inutilmente lo scope.

## 4. Dependencies

- **DEP-001**: Hosting frontend con supporto a rewrites o reverse proxy versionabili nel repository.
- **DEP-002**: Hosting backend persistente con supporto SSE e connessioni lunghe.
- **DEP-003**: PostgreSQL raggiungibile dal backend di produzione.
- **DEP-004**: Redis raggiungibile dal backend di produzione.
- **DEP-005**: Credenziali Google OAuth e configurazione redirect lato Google Cloud Console.

## 5. Files

- **FILE-001**: `docs/02-design/specifications/deployment-architecture-guide.md` da aggiornare con topologia same-origin come target ufficiale.
- **FILE-002**: `.env.example` da estendere con env di produzione e note locali vs online.
- **FILE-003**: File di configurazione hosting da creare in root repository, preferibilmente `netlify.toml` se Netlify è il target scelto.
- **FILE-004**: Eventuale documentazione frontend operativa in `frontend/README.md` se necessaria per build e publish.
- **FILE-005**: Questo piano in `plan/infrastructure-same-origin-deployment-1.md`.

## 6. Testing

- **TEST-001**: Eseguire `npm --prefix frontend run build` e verificare la generazione di `frontend/dist`.
- **TEST-002**: Eseguire `npm --prefix frontend run typecheck`.
- **TEST-003**: Eseguire `npm run typecheck` nel root.
- **TEST-004**: Eseguire `npm run test` nel root.
- **TEST-005**: Eseguire `set -a && . ./.env.local && set +a && npm run test:smoke` se il backend smoke dipende da env locali.
- **TEST-006**: Verificare in staging che `GET /auth/session` richiesto dall'origine pubblica frontend non produca errori CORS.
- **TEST-007**: Verificare che il login imposti il cookie sessione con attributi `HttpOnly`, `Secure` e `SameSite=Lax`.
- **TEST-008**: Verificare che il flusso `GET /auth/google/start` e callback `/auth/google/callback` ritorni l'utente su una route SPA valida.
- **TEST-009**: Verificare che `GET /generation/stream` funzioni dietro il layer di rewrite scelto senza timeout anomali introdotti dal provider.

## 7. Risks & Assumptions

- **RISK-001**: Il provider frontend scelto potrebbe richiedere sintassi di rewrite specifica o limitazioni non ancora verificate per SSE.
- **RISK-002**: Una configurazione incompleta del fallback SPA potrebbe intercettare route backend e mascherare errori applicativi.
- **RISK-003**: Variabili env di sicurezza non documentate nel repository possono produrre deploy parzialmente funzionanti ma con auth rotta.
- **RISK-004**: Il callback Google OAuth può fallire se la redirect URI pubblica non coincide esattamente con la configurazione del provider OAuth.
- **RISK-005**: La checklist potrebbe dare esito positivo in locale ma fallire in hosting reale se il provider modifica header o timeout SSE.
- **ASSUMPTION-001**: Il frontend continuerà a usare path relativi come comportamento di default in produzione.
- **ASSUMPTION-002**: Il backend resterà esposto su un host pubblico separato ma nascosto dietro rewrites same-origin dal punto di vista del browser.
- **ASSUMPTION-003**: La variante con due origini pubbliche distinte non verrà attivata durante questo ciclo implementativo.

## 8. Related Specifications / Further Reading

- `docs/02-design/specifications/deployment-architecture-guide.md`
- `frontend/vite.config.ts`
- `frontend/src/app/providers/AuthSessionProvider.tsx`
- `src/server.ts`
- `src/lib/runtime/auth-contract.ts`

## Deferred Analysis: Dual Public Origins Variant

La variante con frontend pubblico e backend pubblico su due origini distinte è esplicitamente fuori scope implementativo per questo piano e deve essere trattata in una review successiva dedicata.

- **ANL-001**: Analizzare se il modello attuale di cookie-based sessione richiede `SameSite=None` per richieste `fetch` cross-site dal browser.
- **ANL-002**: Analizzare l'impatto di `credentials: include` sulle policy CORS del backend e sui browser target.
- **ANL-003**: Analizzare se `CSRF_TRUSTED_ORIGINS` e le esclusioni CSRF attuali restano sufficienti in topologia cross-origin.
- **ANL-004**: Analizzare il comportamento di Google OAuth con redirect cross-origin e path finale di rientro nella SPA.
- **ANL-005**: Analizzare se il deploy cross-origin richiede esplicitamente `VITE_API_BASE_URL` in produzione e quali regressioni introduce su ambienti preview.
- **ANL-006**: Eseguire un proof-of-concept con browser reali e verifica degli attributi cookie ricevuti e reinviati.