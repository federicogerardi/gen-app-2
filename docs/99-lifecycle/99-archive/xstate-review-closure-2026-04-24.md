# XState Review Closure Snapshot

Versione: 1.0  
Data: 2026-04-24  
Stato: Completed

Documento di chiusura della review XState v5, derivato dai finding emersi sull implementazione as-is e allineato al piano di risoluzione in [plan/upgrade-xstate-go-gap-1.md](../../../plan/upgrade-xstate-go-gap-1.md) e alla checklist PR-ready in [plan/process-xstate-review-pr-checklist-1.md](../../../plan/process-xstate-review-pr-checklist-1.md).

## Obiettivo

Portare il backend da stato as-is a stato completamente GO, chiudendo ogni finding della review con:

- modifica codice verificabile
- test o smoke test associato
- gate finale eseguibile

La review si considera chiusa solo quando tutti i finding sono marcati closed e il gate finale `npm run backend:go` risulta verde.

## Stato di Chiusura

| Finding | Titolo | Severita | Stato | Owner | Evidenza Richiesta |
| --- | --- | --- | --- | --- | --- |
| FIND-001 | Race condition tra entry, invoke e sendTo | Critica | Closed | Backend Platform | Diff + test runtime + typecheck |
| FIND-002 | Actions con lettura opportunistica di event.type senza params o assertEvent | Media | Closed | Backend Platform | Diff actions/params + typecheck |
| FIND-003 | assign inline in onDone o onError fuori setup | Media | Closed | Backend Platform | Diff actions nominate + typecheck + test |
| FIND-004 | Typing residuo su output e clock non deterministico | Minore | Closed | Backend Platform | Diff runtime.now + test deterministici |

## Finding Dettagliati

### FIND-001 - Race condition tra entry, invoke e sendTo

Problema:

- In generationSystemMachine alcuni stati usano `entry` per inviare eventi a child actor che vengono creati dallo stesso stato tramite `invoke`.
- In XState v5 le `entry` actions vengono eseguite prima che l actor invocato sia disponibile.
- Il risultato e perdita silenziosa di eventi iniziali nei flow `extractionFlow`, `toolGenerationFlow` e `streaming`.

Closure note 2026-04-24:

- `generationSystemMachine` non usa piu `sendTo` in `entry` per `extractionFlow`, `toolGenerationFlow` e `streaming`.
- `extractionChainMachine`, `toolWorkflowMachine` e `streamTransportMachine` accettano bootstrap da `invoke.input`.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/stream-transport.machine.test.ts`.

### FIND-002 - Actions con lettura opportunistica di event.type senza params o assertEvent

Problema:

- Alcune action implementations leggono `event.type` per scegliere tra payload evento e valore gia presente in context.
- Questo pattern aggira il modello strict di XState v5 e rende le azioni meno tipizzate e meno locali alla transizione che le usa.

Closure note 2026-04-24:

- `generationSystemMachine` e `requestGatewayMachine` usano azioni params-first per `cacheRequestMeta`, `setUserId`, `setValidationData` e `setFailureReason`, con passaggio esplicito dei dati nel transition source.
- `idempotencyCoordinatorMachine` e `usageMachine` hanno estrazione output localizzata in helper tipizzati e passaggio di params per guardie e azioni `onDone`.
- Verifica statica su scope FIND-002: nessun match residuo per il pattern `event.type === '...'` nelle quattro machine target.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/idempotency.machine.test.ts src/lib/tests/usage.machine.test.ts`.

### FIND-003 - assign inline in onDone o onError fuori setup

Problema:

- Alcuni `assign(...)` sono definiti inline dentro `onDone` o `onError` anziche essere registrati come azioni nominate in `setup({ actions })`.
- Questo rompe la centralizzazione delle implementazioni e abbassa la leggibilita delle transizioni.

Closure note 2026-04-24:

- Rimossi tutti gli `assign` inline nei machine target (`generationSystemMachine`, `idempotencyCoordinatorMachine`, `usageMachine`) e sostituiti con azioni nominate in `setup.actions`.
- Verifica statica: nessun match su `actions: assign(...)` nei file target della review.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/idempotency.machine.test.ts src/lib/tests/usage.machine.test.ts`.

### FIND-004 - Typing residuo su output e clock non deterministico

Problema:

- Alcuni cast su `event.output` restano fragili e i timestamp sono generati da helper locali non iniettabili.
- Questo rende meno deterministici i test e piu rumorosi i punti in cui XState v5 non tipizza completamente `onDone`.

Closure note 2026-04-24:

- `IdempotencyCoordinatorInput` e `UsageActorInput` includono `runtime.now` opzionale; `idempotencyCoordinatorMachine` e `usageMachine` usano `runtime.now` per i timestamp terminali.
- Output terminali esposti a livello macchina (`output`) per `idempotencyCoordinatorMachine`, `usageMachine`, `streamTransportMachine` e `persistenceBatchMachine`, rendendo verificabile il contratto `onDone` nei test.
- Cast su `event.output` confinati in helper locali (`getIdempotencyResult`, `getClaimUsageResult`) e mapping `output` top-level.
- Test aggiornati con clock fisso e assert contrattuali: `idempotency.machine.test.ts`, `usage.machine.test.ts`, `stream-transport.machine.test.ts`, `persistence-batch.machine.test.ts`.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/idempotency.machine.test.ts src/lib/tests/usage.machine.test.ts src/lib/tests/stream-transport.machine.test.ts src/lib/tests/persistence-batch.machine.test.ts`.

## Gate Finale di Review

La review puo passare a stato `Closed` solo se tutte le seguenti condizioni sono vere:

- [x] `npm run typecheck` verde.
- [x] `npm run test` verde.
- [x] `npm run test:smoke` verde.
- [x] `npm run backend:go` verde.
- [x] Tutti i finding `FIND-001`..`FIND-004` sono marcati `Closed`.
- [x] La PR o il changelog di review mappa esplicitamente `finding -> fix -> test -> gate`.

Gate execution note 2026-04-24:

- Eseguito comando unico gate: `npm run typecheck && npm run test && npm run test:smoke && npm run backend:go`.
- `npm run typecheck`: verde.
- `npm run test`: verde (13 test passati).
- `npm run test:smoke`: fallito in `smoke:idempotency` per ambiente mancante (`Missing required environment variable: DATABASE_URL`).
- `npm run backend:go`: non eseguito per stop a catena dopo il fallimento smoke.

Gate rerun note 2026-04-24:

- Eseguito rerun con ambiente caricato da `.env.local`: `set -a && . ./.env.local && set +a && npm run test:smoke && npm run backend:go`.
- `npm run test:smoke`: verde (`smoke:idempotency` e `smoke:conflict` OK).
- `npm run backend:go`: verde (migrate + seed + typecheck + test + smoke tutti OK).

## Chiusura

Documento archiviato come snapshot storico della chiusura review al 2026-04-24.

Stato della snapshot:

- `Stato: Completed`
- tabella `Stato di Chiusura` interamente su `Closed`
- gate finale con rerun completato in ambiente configurato

Questo file non e una checklist operativa in corso, ma un riferimento di chiusura consolidata.