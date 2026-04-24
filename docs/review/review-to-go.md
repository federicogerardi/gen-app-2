# Review To Go

Versione: 1.0  
Data: 2026-04-24  
Stato: Completed

Documento di chiusura della review XState v5, derivato dai finding emersi sull implementazione as-is e allineato al piano di risoluzione in [plan/upgrade-xstate-go-gap-1.md](plan/upgrade-xstate-go-gap-1.md) e alla checklist PR-ready in [plan/process-xstate-review-pr-checklist-1.md](plan/process-xstate-review-pr-checklist-1.md).

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

Scope file:

- [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts)
- [src/lib/machines/extraction-chain.machine.ts](src/lib/machines/extraction-chain.machine.ts)
- [src/lib/machines/tool-workflow.machine.ts](src/lib/machines/tool-workflow.machine.ts)
- [src/lib/machines/stream-transport.machine.ts](src/lib/machines/stream-transport.machine.ts)
- [src/lib/tests/generation-system.runtime.test.ts](src/lib/tests/generation-system.runtime.test.ts)

Closure checklist:

- [x] Nessun action path di `entry` invia piu eventi a `extractionActor` prima dell `invoke`.
- [x] Nessun action path di `entry` invia piu eventi a `toolActor` prima dell `invoke`.
- [x] Nessun action path di `entry` invia piu eventi a `streamActor` prima dell `invoke`.
- [x] I child actor ricevono i dati di bootstrap tramite `input` dell `invoke` oppure tramite bootstrap interno deterministicamente eseguibile.
- [x] I test runtime coprono almeno un caso extraction, un caso tool e un caso streaming o generic che fallirebbe in presenza di evento perso.

Evidenze minime per chiudere:

- Diff che mostra la rimozione del pattern `entry + sendTo` nei tre flow critici.
- Diff che mostra l adattamento degli input dei child actor.
- Esito verde di `npm run typecheck`.
- Esito verde di `npm run test` con scenari runtime aggiornati.

Condizione di chiusura:

- FIND-001 e `Closed` solo se il reviewer puo verificare che nessun evento iniziale verso actor invocati venga inviato prima della loro esistenza runtime.

Closure note 2026-04-24:

- `generationSystemMachine` non usa piu `sendTo` in `entry` per `extractionFlow`, `toolGenerationFlow` e `streaming`.
- `extractionChainMachine`, `toolWorkflowMachine` e `streamTransportMachine` accettano bootstrap da `invoke.input`.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/stream-transport.machine.test.ts`.

### FIND-002 - Actions con lettura opportunistica di event.type senza params o assertEvent

Problema:

- Alcune action implementations leggono `event.type` per scegliere tra payload evento e valore gia presente in context.
- Questo pattern aggira il modello strict di XState v5 e rende le azioni meno tipizzate e meno locali alla transizione che le usa.

Scope file:

- [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts)
- [src/lib/machines/request-gateway.machine.ts](src/lib/machines/request-gateway.machine.ts)
- [src/lib/machines/idempotency-coordinator.machine.ts](src/lib/machines/idempotency-coordinator.machine.ts)
- [src/lib/machines/usage.machine.ts](src/lib/machines/usage.machine.ts)

Closure checklist:

- [x] `cacheRequestMeta` usa `params` tipizzati oppure `assertEvent` invece di branching opportunistico su `event.type`.
- [x] `setUserId` usa `params` tipizzati oppure `assertEvent`.
- [x] `setValidationData` o equivalenti usano `params` tipizzati coerenti con la transizione sorgente.
- [x] `setFailureReason` e stato spezzato in azioni piu specifiche oppure riceve `params` tipizzati dalla transizione.
- [x] requestGatewayMachine non usa piu actions che tornano al valore di context come fallback generico quando il tipo evento e noto.
- [x] I helper introdotti non usano `any` nei params o nei dati di output.

Evidenze minime per chiudere:

- Diff sulle azioni nominate in `setup` che mostra `params` tipizzati o `assertEvent`.
- Diff sui blocchi `on`, `onDone` o `always` che mostra il passaggio esplicito dei `params`.
- Esito verde di `npm run typecheck`.

Condizione di chiusura:

- FIND-002 e `Closed` solo se le azioni segnalate non usano piu il pattern `event.type === 'X' ? valoreEvento : valoreContext` come scorciatoia di typing.

Closure note 2026-04-24:

- `generationSystemMachine` e `requestGatewayMachine` usano azioni params-first per `cacheRequestMeta`, `setUserId`, `setValidationData` e `setFailureReason`, con passaggio esplicito dei dati nel transition source.
- `idempotencyCoordinatorMachine` e `usageMachine` hanno estrazione output localizzata in helper tipizzati e passaggio di params per guardie e azioni `onDone`.
- Verifica statica su scope FIND-002: nessun match residuo per il pattern `event.type === '...'` nelle quattro machine target.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/idempotency.machine.test.ts src/lib/tests/usage.machine.test.ts`.

### FIND-003 - assign inline in onDone o onError fuori setup

Problema:

- Alcuni `assign(...)` sono definiti inline dentro `onDone` o `onError` anziche essere registrati come azioni nominate in `setup({ actions })`.
- Questo rompe la centralizzazione delle implementazioni e abbassa la leggibilita delle transizioni.

Scope file:

- [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts)
- [src/lib/machines/idempotency-coordinator.machine.ts](src/lib/machines/idempotency-coordinator.machine.ts)
- [src/lib/machines/usage.machine.ts](src/lib/machines/usage.machine.ts)
- [src/lib/machines/request-gateway.machine.ts](src/lib/machines/request-gateway.machine.ts)

Closure checklist:

- [x] Ogni `assign` inline in `onError` e stato sostituito da una action nominata in `setup`.
- [x] Ogni `assign` inline in `onDone` e stato sostituito da una action nominata in `setup`.
- [x] I nomi delle azioni descrivono il fallimento o l aggiornamento di contesto in modo specifico.
- [x] Le transizioni referenziano solo azioni nominate per gli effetti custom toccati dalla review.

Evidenze minime per chiudere:

- Diff che mostra le nuove azioni nominate in `setup`.
- Diff che mostra la sostituzione degli `assign` inline nelle transizioni interessate.
- Esito verde di `npm run typecheck`.
- Esito verde di `npm run test`.

Condizione di chiusura:

- FIND-003 e `Closed` solo se il reviewer puo controllare che le implementazioni custom vivano in `setup` e che le transizioni contengano solo riferimenti ad azioni nominate.

Closure note 2026-04-24:

- Rimossi tutti gli `assign` inline nei machine target (`generationSystemMachine`, `idempotencyCoordinatorMachine`, `usageMachine`) e sostituiti con azioni nominate in `setup.actions`.
- Verifica statica: nessun match su `actions: assign(...)` nei file target della review.
- Validazioni eseguite: `npm run typecheck` e `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/idempotency.machine.test.ts src/lib/tests/usage.machine.test.ts`.

### FIND-004 - Typing residuo su output e clock non deterministico

Problema:

- Alcuni cast su `event.output` restano fragili e i timestamp sono generati da helper locali non iniettabili.
- Questo rende meno deterministici i test e piu rumorosi i punti in cui XState v5 non tipizza completamente `onDone`.

Scope file:

- [src/lib/machines/idempotency-coordinator.machine.ts](src/lib/machines/idempotency-coordinator.machine.ts)
- [src/lib/machines/usage.machine.ts](src/lib/machines/usage.machine.ts)
- [src/lib/tests/idempotency.machine.test.ts](src/lib/tests/idempotency.machine.test.ts)
- [src/lib/tests/usage.machine.test.ts](src/lib/tests/usage.machine.test.ts)
- [src/lib/tests/stream-transport.machine.test.ts](src/lib/tests/stream-transport.machine.test.ts)
- [src/lib/tests/persistence-batch.machine.test.ts](src/lib/tests/persistence-batch.machine.test.ts)

Closure checklist:

- [x] idempotencyCoordinatorMachine accetta una dipendenza `runtime.now` opzionale tramite input.
- [x] usageMachine accetta una dipendenza `runtime.now` opzionale tramite input.
- [x] I test verificano timestamp stabili con clock controllato.
- [x] Gli eventuali cast residui su `event.output` sono confinati in helper o punti esplicitamente giustificati.
- [x] I test di stream e persistence verificano shape terminale, ordine evento e coerenza lifecycle/accounting sui path interessati.

Evidenze minime per chiudere:

- Diff che mostra l introduzione di `runtime.now` nei tipi input e negli output event.
- Diff che mostra test deterministici con timestamp attesi fissi.
- Nota in PR che giustifica eventuali cast residui inevitabili di XState v5.

Condizione di chiusura:

- FIND-004 e `Closed` solo se i machine producono output temporalmente deterministici in test e i residui limiti di typing restano confinati e documentati.

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

## Mapping con Piano e Checklist PR

Riferimenti di esecuzione:

- Piano sprint: [plan/upgrade-xstate-go-gap-1.md](plan/upgrade-xstate-go-gap-1.md)
- Checklist PR-ready: [plan/process-xstate-review-pr-checklist-1.md](plan/process-xstate-review-pr-checklist-1.md)

Mapping operativo:

- FIND-001 corrisponde alla Fase 1 del piano e al blocco FIND-001 della checklist PR-ready.
- FIND-002 e FIND-003 corrispondono alla Fase 2 del piano e ai blocchi FIND-002 e FIND-003 della checklist PR-ready.
- FIND-004 corrisponde alla Fase 3 del piano e al blocco FIND-004 della checklist PR-ready.
- Il gate finale della review corrisponde alla Fase 4 del piano e al blocco finale della checklist PR-ready.

## Chiusura

Quando tutti i finding sono `Closed` e il gate finale e verde, questo documento deve essere aggiornato cosi:

- `Stato: Completed`
- tabella `Stato di Chiusura` tutta su `Closed`
- eventuale aggiunta dei riferimenti a commit o PR che hanno chiuso ogni finding

Fino a quel momento questo documento resta la sorgente operativa per verificare la distanza residua tra stato as-is e stato GO.