# Backend GO Checklist

Versione: 1.3
Data: 2026-04-24
Scope: readiness backend prima di integrazione frontend con DB reale

## 1. Obiettivo

Questa checklist definisce il gate operativo minimo per considerare il backend `GO`.

Il sistema e `GO` solo se:

- il root actor XState orchestra davvero i child actor runtime;
- i contratti request/error/stream sono eseguibili e stabili;
- la persistenza reale Postgres/Redis e coerente con gli outcome;
- esistono smoke test e test minimi sulle transizioni critiche.

Piano esecutivo associato:

- `plan/architecture-backend-go-1.md`

## 2. Stato Attuale Sintetico

Esito corrente: `GO`

Motivi principali:

- il wiring runtime e il contract backend sono implementati;
- l'integrazione LLM as-is usa OpenRouter con fallback sintetico controllato;
- la surface runtime espone stream live via AsyncIterable e adapter Node SSE;
- la surface runtime auth minima login/logout/session e implementata;
- la surface runtime auth include OAuth Google start/callback con state token + PKCE;
- e disponibile un adapter server Node unificato con dispatch auth + generation SSE;
- la persistenza reale copre accounting (`quota_history`, token, costi);
- i test machine/root sono disponibili e verdi;
- smoke test reali su Neon + Upstash eseguiti con esito verde;
- `npm run backend:go` validato end-to-end con bootstrap DB via `pg` (nessuna dipendenza da `psql`).

## 3. Gate GO Backend

| ID | Area | Criterio GO | Stato attuale | Esito |
|---|---|---|---|---|
| BE-001 | Root orchestration | `generationSystemMachine` invoca/spawna `usage`, `idempotency`, `stream`, `persistence`, `workflow`, `extraction` dove richiesto | Root runtime attivo con invoke actor v5 e routing runtime | GO |
| BE-002 | Gateway runtime | `requestGatewayMachine` applica auth/validation/model/ownership con dipendenze reali o adapter concreti | Gateway runtime presente nella surface backend, ownership/model preflight ancora minimale | QUASI-GO |
| BE-003 | Usage/idempotency | quota e idempotency sono eseguibili con Postgres/Redis reale, lock contestuale corretto e replay coerente | Adapter pg/redis reali, lock helper condiviso e smoke scripts presenti | GO |
| BE-004 | Stream transport | esiste path reale per stream session, terminal events, timeout/disconnect osservabili | Stream actor runtime + invoke LLM adapter (OpenRouter as-is) + serializzazione SSE `start/chunk/terminal` | GO |
| BE-005 | Persistence lifecycle | artifact `generating/completed/failed` coerente, finalize in transazione, replay compatibile | finalize success/failure in transazione con update artifact coerente | GO |
| BE-006 | Accounting | persistenza di token, costi e `quota_history` coerente con outcome | Persistenza model/input/tokens/cost + scrittura `quota_history` su success/error/rate_limited | GO |
| BE-007 | Tool workflow | dipendenze step-based, retry, resume/regenerate integrati nel flow root | Branch tool collegato nel flow root runtime | GO |
| BE-008 | Extraction chain | accept/escalation/exhausted integrati nel flow root con policy testabili | Branch extraction collegato nel flow root runtime | GO |
| BE-009 | API/backend surface | esiste entrypoint backend reale con request contract stabile | Surface runtime `handleGenerationRequest(...)`, `handleGenerationRequestAsSseStream(...)`, `handleGenerationRequestAsNodeSse(...)` | GO |
| BE-010 | SSE/error contract | esistono payload SSE e shape errori stabili e verificati | `stream-contract` + `error-contract` + adapter `http-sse` implementati e usati in session runtime | GO |
| BE-011 | DB readiness | migration + seed minimi applicabili su DB reale | Presente | GO |
| BE-012 | Redis readiness | seed/example Redis per test idempotency disponibile | Presente | GO |
| BE-013 | Smoke test reale | smoke test su pg + ioredis eseguibile end-to-end | Eseguiti con esito verde su infrastruttura reale (`claimed -> completed -> replay`, `lock -> conflict`) | GO |
| BE-014 | Test matrix minima | test su transizioni, guardie, replay/conflict, finalize success/failure | Suite test machine + root happy/failure disponibile e green | GO |
| BE-015 | Package scripts | comandi `migrate`, `seed`, `test/smoke` disponibili | Script bootstrap DB portabili via `pg`; pipeline `backend:go` validata verde | GO |
| BE-016 | Auth runtime surface | esiste surface auth runtime minima con sessione cookie + login/logout/session | `createAuthHttpRuntime(...)` + contratti runtime auth (`auth-contract`) + test runtime auth verdi | GO |
| BE-017 | Unified Node server adapter | esiste adapter server unico che instrada auth e generation SSE nello stesso handler | `createNodeRuntimeRequestHandler(...)` + `createNodeRuntimeServer(...)` + test dispatch verdi | GO |
| BE-018 | Google OAuth runtime | esiste flow OAuth Google reale in surface auth con state/PKCE e callback | `createGoogleOAuthRuntime(...)` + `/auth/google/start` + `/auth/google/callback` + test runtime OAuth verdi | GO |

## 4. Criteri di Chiusura Minimi

Il backend puo passare a `GO` solo se tutte le condizioni seguenti sono vere.

### 4.1 Orchestrazione Runtime

- [x] `generationSystemMachine` usa actor runtime reali per `usageMachine`
- [x] `generationSystemMachine` usa actor runtime reali per `idempotencyCoordinatorMachine`
- [x] `generationSystemMachine` usa actor runtime reali per `streamTransportMachine`
- [x] `generationSystemMachine` usa actor runtime reali per `persistenceBatchMachine`
- [x] `toolWorkflowMachine` ed `extractionChainMachine` sono collegati dove previsti dal routing
- [x] la root machine resta il punto centrale di orchestrazione, non il route handler

### 4.2 Surface Backend

- [x] esiste un entrypoint backend reale per `REQUEST_RECEIVED`
- [x] il request contract usa i tipi canonici condivisi
- [x] gli errori restituiscono shape stabile
- [x] lo stream espone ordine eventi coerente (`start -> chunk* -> terminal`)
- [x] la surface auth minima (`/auth/login`, `/auth/logout`, `/auth/session`) e disponibile nel runtime
- [x] la surface OAuth Google (`/auth/google/start`, `/auth/google/callback`) e disponibile nel runtime
- [x] esiste un adapter Node unificato per dispatch auth + generation SSE

### 4.3 Persistenza e Coerenza

- [x] `artifacts` viene creato/aggiornato in `generating`
- [x] `finalizeSuccess` persiste stato terminale corretto
- [x] `finalizeFailure` persiste stato terminale corretto
- [x] `request_idempotency` supporta `claimed`, `conflict`, `replay`
- [x] `quota_history` viene scritto con esito coerente (`success`, `error`, `rate_limited`)
- [x] token e costi reali vengono persistiti in modo coerente

### 4.4 Test Minimi

- [x] smoke test `claimed -> completed -> replay` (verde su infrastruttura reale)
- [x] smoke test `lock Redis presente -> conflict` (verde su infrastruttura reale)
- [x] test transition coverage per `usageMachine`
- [x] test transition coverage per `idempotencyCoordinatorMachine`
- [x] test transition coverage per `streamTransportMachine`
- [x] test transition coverage per `persistenceBatchMachine`
- [x] almeno un test root flow happy path
- [x] almeno un test root flow failure path

## 5. Ordine Consigliato di Chiusura

1. Cablaggio runtime del root actor con child machine reali.
2. Entry point backend minimo + contract error/stream.
3. Completion della persistence reale (`quota_history`, token, costi).
4. Smoke test reale su Postgres/Redis.
5. Test matrix minima sulle machine critiche.
6. Solo dopo: integrazione frontend contro backend reale.

## 6. Decisione Operativa

Decisione attuale: `GO`

Il backend e pronto come runtime eseguibile end-to-end e testato su infrastruttura reale (Neon + Upstash). Il passaggio ai lavori frontend con DB reale e approvato.

Nota operativa residua:

- nessun blocker operativo aperto per il gate backend GO.

## 7. Verifica Finale

Formula minima:

$$
GO_{backend} = BE\text{-}001 \land BE\text{-}004 \land BE\text{-}006 \land BE\text{-}009 \land BE\text{-}013 \land BE\text{-}014
$$

Se una sola di queste aree resta aperta, l'esito resta `NO-GO`.

## 8. Sequenza Esecuzione GO

Comandi minimi:

1. `export DATABASE_URL=...`
2. `export UPSTASH_REDIS_URL=...`
3. `export OPENROUTER_API_KEY=...` (consigliato per stream LLM reale)
4. `npm run backend:go`

Esito atteso:

- `npm run typecheck` verde
- `npm test` verde
- `npm run test:smoke` verde
- quindi `GO` backend confermato
