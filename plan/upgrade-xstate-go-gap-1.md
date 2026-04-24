---
goal: Colmare il gap XState v5 dallo stato as-is allo stato completamente GO
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-24
owner: Backend Platform
status: Completed
tags: [upgrade, xstate, review, backend, testing, go-no-go]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano definisce la risoluzione completa della review XState v5 e porta il backend dal blueprint as-is a uno stato GO verificabile. Il piano converte i finding della review in sprint eseguibili, con task atomici, file target espliciti, criteri di completamento misurabili e validazioni allineate al comando backend:go.

## 1. Requirements & Constraints

- REQ-001: Eliminare la race condition generata dal pattern entry + invoke + sendTo in generationSystemMachine.
- REQ-002: Portare tutte le machine XState al pattern strict v5 con implementations solo in setup({ actions, guards, actors }).
- REQ-003: Rimuovere dalle action implementations la lettura opportunistica di event.type quando il dato puo essere passato tramite params tipizzati.
- REQ-004: Ridurre i cast event as unknown as { output: ... } ai soli casi inevitabili e preferire estrazione tipizzata dell output prima delle guardie.
- REQ-005: Rendere deterministico il time source nelle machine che producono timestamp usati nei test.
- REQ-006: Aggiornare o aggiungere test per coprire transizioni, guardie, contratti e casi di errore introdotti dalla review.
- REQ-007: Ottenere esito positivo del comando npm run backend:go come gate finale di rilascio.
- SEC-001: Nessun cambiamento deve indebolire il comportamento di idempotency o introdurre perdita silenziosa di eventi tra actor.
- SEC-002: Gli eventi terminali di errore e successo devono mantenere shape stabile per persistence e stream contracts.
- CON-001: Non introdurre pattern XState v4 vietati da xstate-v5-rules.md.
- CON-002: Non espandere il perimetro della correzione a domini non menzionati nella review.
- CON-003: Preservare la decomposizione attuale in machine distinte; il root actor resta orchestration root.
- GUD-001: Usare params tipizzati per azioni e guardie quando il transition source e noto.
- GUD-002: Preferire input dell invoke o stato iniziale del child actor rispetto a sendTo in entry verso actor appena invocati.
- GUD-003: Ogni invoke deve mantenere onDone e onError espliciti.
- PAT-001: Validazione incrementale per sprint con typecheck, test mirati e poi suite backend:go.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Chiudere il gap architetturale critico che puo perdere eventi tra orchestration root e child actor.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | In src/lib/machines/generation-system.machine.ts sostituire in extractionFlow l uso di entry: ['ensureArtifactId', 'driveExtractionAttempt'] con un flusso che inizializza extractionChainMachine tramite input dell invoke o tramite stato iniziale del child actor, senza sendTo verso extractionActor prima che esista. | yes | 2026-04-24 |
| TASK-002 | In src/lib/machines/generation-system.machine.ts sostituire in toolGenerationFlow l uso di entry: ['ensureArtifactId', 'driveToolWorkflow'] con input completo per toolWorkflowMachine, spostando stepKey, output sintetico e artifactId nel boundary dell actor senza invii entry-time. | yes | 2026-04-24 |
| TASK-003 | In src/lib/machines/generation-system.machine.ts sostituire in streaming l uso di entry: ['ensureArtifactId', 'cacheSyntheticChunk', 'driveSyntheticStream'] con inizializzazione streamTransportMachine via input tipizzato o altra sequenza priva di race; eliminare sendTo verso streamActor in entry. | yes | 2026-04-24 |
| TASK-004 | In src/lib/machines/tool-workflow.machine.ts, src/lib/machines/stream-transport.machine.ts e src/lib/machines/extraction-chain.machine.ts adattare gli input o gli stati iniziali necessari a ricevere i trigger che prima arrivavano via sendTo da generationSystemMachine. | yes | 2026-04-24 |
| TASK-005 | Aggiungere o aggiornare in src/lib/tests/generation-system.runtime.test.ts scenari che riproducono extraction, tool e generic flow e falliscono se un evento iniziale viene perso dal child actor. | yes | 2026-04-24 |

Completion criteria Phase 1:

- Il file src/lib/machines/generation-system.machine.ts non contiene piu sendTo verso extractionActor, toolActor o streamActor dentro azioni eseguite in entry degli stati che li invocano.
- Gli scenari extraction, toolGenerationFlow e streaming passano in modo deterministico in test.
- npm run typecheck passa dopo la refactor di orchestration.

Phase 1 execution note:

- Completata il 2026-04-24 con validazioni verdi su `npm run typecheck` e sulla slice `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts src/lib/tests/stream-transport.machine.test.ts`.

### Implementation Phase 2

- GOAL-002: Allineare tutte le action implementations e le transition actions al profilo XState v5 strict richiesto dalla review.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-006 | In src/lib/machines/generation-system.machine.ts sostituire cacheRequestMeta, setUserId, setValidationData, setFailureReason, cacheReplayPayload e cacheArtifactId con azioni che usano params tipizzati o assertEvent, senza pattern event.type === 'X' ? ... : context.y quando il transition source e noto. | yes | 2026-04-24 |
| TASK-007 | In src/lib/machines/request-gateway.machine.ts sostituire cacheRequestMeta, setUserId, setWorkflowType e setFailureReason con azioni guidate da params tipizzati o assertEvent coerenti con ogni transition. | yes | 2026-04-24 |
| TASK-008 | In src/lib/machines/idempotency-coordinator.machine.ts e src/lib/machines/usage.machine.ts spostare l estrazione del risultato di onDone in params tipizzati o in helper locali riusabili, riducendo i cast diretti dentro guards e actions. | yes | 2026-04-24 |
| TASK-009 | In src/lib/machines/generation-system.machine.ts, src/lib/machines/idempotency-coordinator.machine.ts e src/lib/machines/usage.machine.ts sostituire ogni assign inline in onDone o onError con azioni nominate registrate in setup({ actions }). | yes | 2026-04-24 |
| TASK-010 | Eseguire una passata di controllo su src/lib/machines/persistence-batch.machine.ts e src/lib/machines/stream-transport.machine.ts per verificare che non restino implementazioni inline fuori setup introdotte da refactor adiacenti. | yes | 2026-04-24 |

Completion criteria Phase 2:

- Le action implementations citate nella review non dipendono piu da branching opportunistico su event.type quando il dato puo essere passato con params.
- Nessun onDone o onError delle machine target usa assign inline non nominato.
- npm run typecheck passa e i test macchina esistenti continuano a passare.

### Implementation Phase 3

- GOAL-003: Rendere la suite deterministica e sufficiente a provare equivalenza funzionale rispetto ai criteri GO/No-Go.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-011 | In src/lib/machines/idempotency-coordinator.machine.ts introdurre nel tipo input un runtime.now opzionale e usare tale dipendenza per generare timestamp invece di nowIso locale non iniettabile. | yes | 2026-04-24 |
| TASK-012 | In src/lib/machines/usage.machine.ts introdurre nel tipo input un runtime.now opzionale e usare tale dipendenza per generare timestamp invece di nowIso locale non iniettabile. | yes | 2026-04-24 |
| TASK-013 | In src/lib/tests/idempotency.machine.test.ts e src/lib/tests/usage.machine.test.ts aggiungere test con clock finto che verificano timestamp stabili e output event shape costante. | yes | 2026-04-24 |
| TASK-014 | In src/lib/tests/stream-transport.machine.test.ts e src/lib/tests/persistence-batch.machine.test.ts aggiungere assert sul contratto terminale: ordine evento, terminal event unico, artifact lifecycle e accounting coerente con outcome. | yes | 2026-04-24 |
| TASK-015 | In src/lib/tests/generation-system.runtime.test.ts aggiungere coverage per guard branches richiesti dal blueprint: missing_registry_selector, idempotency replay, idempotency conflict, usage rejected, stream failure, persistence finalize failure. | yes | 2026-04-24 |

Completion criteria Phase 3:

- I timestamp prodotti da usageMachine e idempotencyCoordinatorMachine sono controllabili dai test via input runtime.now.
- I file test coprono i path critici elencati nella review e nel documento testing-go-no-go-and-risk-spec.
- npm run test passa stabilmente su esecuzioni consecutive.

### Implementation Phase 4

- GOAL-004: Eseguire il gate finale di equivalenza funzionale e dichiarare stato GO.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-016 | Eseguire npm run typecheck e correggere esclusivamente regressioni introdotte dalle fasi 1-3 nei file src/lib/machines/*.ts e src/lib/tests/*.test.ts toccati dal piano. | yes | 2026-04-24 |
| TASK-017 | Eseguire npm run test e verificare copertura funzionale dei path root lifecycle, guardie, persistence, workflow e idempotency definiti dal blueprint. | yes | 2026-04-24 |
| TASK-018 | Eseguire npm run test:smoke per verificare il comportamento minimo degli adapter postgres/redis su idempotency e conflict handling. | yes | 2026-04-24 |
| TASK-019 | Eseguire npm run backend:go come gate integrato finale e registrare l esito come criterio di uscita della sprint conclusiva. | yes | 2026-04-24 |
| TASK-020 | Aggiornare docs/review/review-to-go.md con una closure note che mappa ogni finding della review a commit, test e comando di validazione che lo chiude. | yes | 2026-04-24 |

Completion criteria Phase 4:

- npm run typecheck, npm run test, npm run test:smoke e npm run backend:go hanno esito positivo.
- Ogni finding della review ha un riferimento diretto a modifica e test che lo chiude.
- Lo stato del piano puo essere aggiornato da Planned a Completed.

Phase 4 execution note 2026-04-24:

- Gate eseguito in sequenza: `npm run typecheck && npm run test && npm run test:smoke && npm run backend:go`.
- `typecheck` e `test` verdi.
- `test:smoke` bloccato da variabile ambiente mancante: `DATABASE_URL`.
- `backend:go` non ancora eseguito per interruzione a catena dopo il fallimento smoke.

Phase 4 rerun note 2026-04-24:

- Eseguito rerun con environment `.env.local` caricato in shell.
- `npm run test:smoke` verde (`smoke:idempotency` e `smoke:conflict` OK).
- `npm run backend:go` verde (migrate, seed, typecheck, test, smoke tutti OK).

## 3. Alternatives

- ALT-001: Mantenere il pattern entry + sendTo e introdurre retry/event buffering nel root actor. Non scelto perche maschera la race condition invece di rimuovere la causa.
- ALT-002: Accorpare extraction, tool workflow e stream in una sola machine monolitica. Non scelto perche viola il boundary attuale e peggiora la separazione delle responsabilita.
- ALT-003: Limitarsi a silenziare i cast TypeScript senza rifattorizzare params e action naming. Non scelto perche non chiude il finding di conformita XState v5 strict.
- ALT-004: Dichiarare GO dopo typecheck e test unitari senza smoke test adapter. Non scelto perche il repository definisce backend:go come gate integrato finale.

## 4. Dependencies

- DEP-001: xstate 5.30.0 come runtime da mantenere compatibile durante la refactor.
- DEP-002: Script npm run typecheck, npm run test, npm run test:smoke e npm run backend:go definiti in package.json.
- DEP-003: Adapter contracts in src/lib/adapters/generation.adapters.ts e implementazioni correlate per usage, persistence, stream e idempotency.
- DEP-004: Blueprint documentale in docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md.
- DEP-005: Skill rules in /home/federico/.copilot/skills/xstate-skill/references/xstate-v5-rules.md come standard di implementazione.

## 5. Files

- FILE-001: src/lib/machines/generation-system.machine.ts - orchestration root e principale superficie della race condition.
- FILE-002: src/lib/machines/request-gateway.machine.ts - normalizzazione action strict e failure handling.
- FILE-003: src/lib/machines/idempotency-coordinator.machine.ts - output typing, guard strictness e clock injection.
- FILE-004: src/lib/machines/usage.machine.ts - output typing, rejection handling e clock injection.
- FILE-005: src/lib/machines/tool-workflow.machine.ts - adattamento input per bootstrap senza sendTo in entry.
- FILE-006: src/lib/machines/stream-transport.machine.ts - adattamento input per bootstrap e contratti terminali.
- FILE-007: src/lib/machines/extraction-chain.machine.ts - adattamento input per bootstrap e acceptance path.
- FILE-008: src/lib/tests/generation-system.runtime.test.ts - regressioni orchestration root e branch coverage.
- FILE-009: src/lib/tests/idempotency.machine.test.ts - determinismo timestamp e conflict/replay coverage.
- FILE-010: src/lib/tests/usage.machine.test.ts - determinismo timestamp e rejection coverage.
- FILE-011: src/lib/tests/stream-transport.machine.test.ts - stream contract coverage.
- FILE-012: src/lib/tests/persistence-batch.machine.test.ts - persistence contract coverage.
- FILE-013: docs/review/review-to-go.md - mapping finale finding -> fix -> test -> gate.

## 6. Testing

- TEST-001: Eseguire npm run typecheck dopo ogni sprint come controllo minimo di compatibilita tipizzata.
- TEST-002: Eseguire npm run test focalizzandosi inizialmente su src/lib/tests/generation-system.runtime.test.ts per confermare l eliminazione della race condition.
- TEST-003: Eseguire npm run test su src/lib/tests/idempotency.machine.test.ts e src/lib/tests/usage.machine.test.ts per verificare clock injection e output event shape stabile.
- TEST-004: Eseguire npm run test su src/lib/tests/stream-transport.machine.test.ts e src/lib/tests/persistence-batch.machine.test.ts per validare stream order, terminal event unico, artifact lifecycle e accounting.
- TEST-005: Eseguire npm run test:smoke per validare idempotency e conflict handling sugli adapter postgres/redis.
- TEST-006: Eseguire npm run backend:go come criterio finale di approvazione GO.
- TEST-007: Verificare copertura dei path definiti dal blueprint: root lifecycle happy/fail, guardie true/false, replay/conflict, workflow path e persistence coherence.

## 7. Risks & Assumptions

- RISK-001: La refactor del bootstrap dei child actor puo richiedere cambi strutturali nelle machine invocate, con impatto su piu test del previsto.
- RISK-002: La sostituzione di actions generiche con actions tipizzate puo aumentare temporaneamente la duplicazione se non si introducono helper locali ben circoscritti.
- RISK-003: Alcuni cast su event.output potrebbero restare necessari a causa dei limiti di typing di XState v5 su onDone; il rischio va mitigato documentando i casi residui e confinandoli in helper stretti.
- RISK-004: I smoke test possono fallire per ambiente dati o servizi locali non pronti; il piano assume ambiente coerente con gli script minimal del repository.
- ASSUMPTION-001: La suite attuale e sufficiente come base e necessita solo estensioni mirate, non una riscrittura integrale dei test.
- ASSUMPTION-002: Il comando npm run backend:go resta il gate ufficiale per dichiarare stato GO.
- ASSUMPTION-003: Il blueprint as-is e il documento testing-go-no-go-and-risk-spec.md sono la baseline funzionale da preservare.

## 8. Related Specifications / Further Reading

- docs/specifications/xstate-system-as-is-spec.md
- docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md
- docs/review/review-to-go.md
- /home/federico/.copilot/skills/xstate-skill/references/xstate-v5-rules.md