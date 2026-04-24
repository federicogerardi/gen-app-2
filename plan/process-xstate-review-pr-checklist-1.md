---
goal: Checklist PR-ready per chiudere la review XState finding per finding
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-24
owner: Backend Platform
status: Completed
tags: [process, review, checklist, xstate, pr, backend]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questa checklist traduce il piano di upgrade XState in criteri PR-ready direttamente verificabili in review. Ogni finding ha scope, file target, cambiamenti obbligatori, evidenze richieste e comandi di validazione necessari per considerare la review chiusa.

## 1. Requirements & Constraints

- REQ-001: Ogni finding della review deve avere una sezione checklist dedicata con criterio di chiusura binario.
- REQ-002: La checklist deve essere eseguibile in una PR senza richiedere interpretazione implicita del reviewer.
- REQ-003: Ogni finding deve elencare file target, modifiche attese, test attesi e gate finale.
- REQ-004: La chiusura della review richiede evidenza sia statica sia eseguibile.
- CON-001: La checklist non introduce scope aggiuntivo oltre al piano in plan/upgrade-xstate-go-gap-1.md.
- CON-002: I gate finali restano npm run typecheck, npm run test, npm run test:smoke e npm run backend:go.
- GUD-001: Le modifiche XState devono seguire le regole strict v5 del repository.
- GUD-002: Ogni finding e chiuso solo se il reviewer puo tracciare mapping tra codice, test e comando di verifica.
- PAT-001: Un finding e considerato chiuso solo se tutte le checkbox della sua sezione sono verificate.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Preparare la PR con metadata e contesto minimi per una review deterministica.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Aprire una PR con titolo che esplicita il perimetro: fix XState review gaps to GO. | yes | 2026-04-24 |
| TASK-002 | Nel body della PR linkare plan/upgrade-xstate-go-gap-1.md, docs/review/review-to-go.md e questa checklist. | yes | 2026-04-24 |
| TASK-003 | Nel body della PR dichiarare che il gate finale di approvazione e npm run backend:go. | yes | 2026-04-24 |

Completion criteria Phase 1:

- La PR contiene riferimenti diretti a piano, review e checklist.
- Il reviewer puo identificare il gate finale senza cercare altrove.

### Implementation Phase 2

- GOAL-002: Chiudere i finding tecnici della review con checklist atomica finding per finding.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-004 | Verificare e marcare il blocco FIND-001 Race condition entry + invoke + sendTo. | yes | 2026-04-24 |
| TASK-005 | Verificare e marcare il blocco FIND-002 Actions che leggono event.type senza params o assertEvent. | yes | 2026-04-24 |
| TASK-006 | Verificare e marcare il blocco FIND-003 assign inline in onDone o onError fuori setup. | yes | 2026-04-24 |
| TASK-007 | Verificare e marcare il blocco FIND-004 typing e clock deterministico nei machine output. | yes | 2026-04-24 |

Completion criteria Phase 2:

- Tutti i blocchi FIND-001..FIND-004 risultano completamente verificati.
- Ogni blocco include evidenza codice e validazione eseguibile.

### Implementation Phase 3

- GOAL-003: Eseguire i gate finali della PR e registrare l esito in modo verificabile.

| Task | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-008 | Eseguire npm run typecheck e allegare esito sintetico alla PR. | yes | 2026-04-24 |
| TASK-009 | Eseguire npm run test e allegare esito sintetico alla PR. | yes | 2026-04-24 |
| TASK-010 | Eseguire npm run test:smoke e allegare esito sintetico alla PR. | yes | 2026-04-24 |
| TASK-011 | Eseguire npm run backend:go e allegare esito sintetico alla PR come gate conclusivo. | yes | 2026-04-24 |

Completion criteria Phase 3:

- Tutti i gate risultano verdi.
- La PR contiene l evidenza finale di stato GO.

## 3. Alternatives

- ALT-001: Lasciare la checklist nel body libero della PR. Non scelto perche rende difficile la verifica finding per finding.
- ALT-002: Chiudere la review solo con esito dei test. Non scelto perche non garantisce tracciabilita tra finding e modifica.
- ALT-003: Usare una checklist generica per tutte le machine. Non scelto perche la review ha finding specifici e non equivalenti tra loro.

## 4. Dependencies

- DEP-001: plan/upgrade-xstate-go-gap-1.md come fonte di sprint e scope.
- DEP-002: docs/review/review-to-go.md come fonte dei finding da chiudere.
- DEP-003: package.json per i comandi di validazione ufficiali.
- DEP-004: docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md per i criteri GO/No-Go.

## 5. Files

- FILE-001: plan/upgrade-xstate-go-gap-1.md
- FILE-002: docs/review/review-to-go.md
- FILE-003: src/lib/machines/generation-system.machine.ts
- FILE-004: src/lib/machines/request-gateway.machine.ts
- FILE-005: src/lib/machines/idempotency-coordinator.machine.ts
- FILE-006: src/lib/machines/usage.machine.ts
- FILE-007: src/lib/machines/tool-workflow.machine.ts
- FILE-008: src/lib/machines/stream-transport.machine.ts
- FILE-009: src/lib/machines/extraction-chain.machine.ts
- FILE-010: src/lib/tests/generation-system.runtime.test.ts
- FILE-011: src/lib/tests/idempotency.machine.test.ts
- FILE-012: src/lib/tests/usage.machine.test.ts
- FILE-013: src/lib/tests/stream-transport.machine.test.ts
- FILE-014: src/lib/tests/persistence-batch.machine.test.ts

## 6. Testing

- TEST-001: npm run typecheck
- TEST-002: npm run test
- TEST-003: npm run test:smoke
- TEST-004: npm run backend:go

## 7. Risks & Assumptions

- RISK-001: Una PR troppo grande puo rendere difficile validare i finding separatamente.
- RISK-002: Alcuni cast residuali su output di onDone potrebbero essere legittimi per limiti del typing XState v5; devono essere giustificati esplicitamente in PR.
- ASSUMPTION-001: Il reviewer dispone di ambiente in grado di eseguire i gate backend:go.
- ASSUMPTION-002: I test esistenti sono aggiornabili senza redesign architetturale fuori scope.

## 8. Related Specifications / Further Reading

- plan/upgrade-xstate-go-gap-1.md
- docs/review/review-to-go.md
- docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md
- /home/federico/.copilot/skills/xstate-skill/references/xstate-v5-rules.md

## PR Checklist Operativa

### FIND-001 - Race condition tra entry, invoke e sendTo

Scope:

- src/lib/machines/generation-system.machine.ts
- src/lib/machines/tool-workflow.machine.ts
- src/lib/machines/stream-transport.machine.ts
- src/lib/machines/extraction-chain.machine.ts
- src/lib/tests/generation-system.runtime.test.ts

Checklist:

- [x] In generationSystemMachine non esiste piu un action path di entry che invia eventi a extractionActor prima dell invoke.
- [x] In generationSystemMachine non esiste piu un action path di entry che invia eventi a toolActor prima dell invoke.
- [x] In generationSystemMachine non esiste piu un action path di entry che invia eventi a streamActor prima dell invoke.
- [x] I dati iniziali necessari ai child actor sono passati tramite input dell invoke oppure tramite bootstrap interno del child actor.
- [x] extractionChainMachine riceve dal boundary di invoke tutto cio che gli serve per avviare il primo attempt senza evento perso.
- [x] toolWorkflowMachine riceve dal boundary di invoke stepKey, artifactId e input iniziali senza dipendere da sendTo in entry.
- [x] streamTransportMachine riceve dal boundary di invoke payload iniziale e non dipende da trigger inviati prima dell avvio.
- [x] generation-system.runtime.test.ts contiene almeno uno scenario per extraction flow che fallirebbe in presenza di evento perso.
- [x] generation-system.runtime.test.ts contiene almeno uno scenario per tool flow che fallirebbe in presenza di evento perso.
- [x] generation-system.runtime.test.ts contiene almeno uno scenario per generic or streaming flow che fallirebbe in presenza di evento perso.

Evidence richiesta in PR:

- Diff che mostra la rimozione del pattern entry + sendTo sui tre flow critici.
- Diff che mostra l adattamento degli input dei child actor.
- Output sintetico di npm run test focalizzato sugli scenari runtime della macchina root.

Closing condition:

- FIND-001 e chiuso solo se il reviewer puo verificare che nessun evento iniziale verso actor invocati venga piu inviato prima della loro esistenza runtime.

### FIND-002 - Actions che leggono event.type senza params o assertEvent

Scope:

- src/lib/machines/generation-system.machine.ts
- src/lib/machines/request-gateway.machine.ts
- src/lib/machines/idempotency-coordinator.machine.ts
- src/lib/machines/usage.machine.ts

Checklist:

- [x] cacheRequestMeta usa params tipizzati oppure assertEvent invece di branching opportunistico su event.type.
- [x] setUserId usa params tipizzati oppure assertEvent invece di branching opportunistico su event.type.
- [x] setValidationData o equivalenti usano params tipizzati coerenti col transition source.
- [x] setFailureReason e stato spezzato in azioni piu specifiche oppure usa params tipizzati che arrivano dalla transizione corretta.
- [x] requestGatewayMachine non contiene piu action implementations che dipendono da event.type per restituire context preesistente quando il tipo evento e noto nella transizione.
- [x] Idempotency e usage estraggono output e reason in modo tipizzato e localizzato, non con branching sparso.
- [x] Le modifiche non hanno introdotto any nei params o nei helper di estrazione.

Evidence richiesta in PR:

- Diff sulle azioni nominate in setup che mostra params tipizzati o assertEvent.
- Diff sui blocchi on e onDone che mostra il passaggio esplicito dei params.
- Output sintetico di npm run typecheck.

Closing condition:

- FIND-002 e chiuso solo se le azioni toccate dalla review non usano piu il pattern event.type === 'X' ? valoreEvento : valoreContext come scorciatoia di typing.

### FIND-003 - assign inline in onDone o onError fuori setup

Scope:

- src/lib/machines/generation-system.machine.ts
- src/lib/machines/idempotency-coordinator.machine.ts
- src/lib/machines/usage.machine.ts
- src/lib/machines/request-gateway.machine.ts

Checklist:

- [x] Ogni assign inline usato in onError e stato sostituito da una action nominata definita in setup.
- [x] Ogni assign inline usato in onDone e stato sostituito da una action nominata definita in setup.
- [x] I nuovi nomi delle azioni descrivono il fallimento o l aggiornamento di contesto in modo specifico.
- [x] Non rimangono implementazioni effetto collocate direttamente nella configurazione della macchina fuori setup, salvo built-in consentiti non segnalati dalla review.
- [x] Le transizioni restano leggibili e il mapping tra evento e side effect e esplicito.

Evidence richiesta in PR:

- Diff che mostra le nuove azioni nominate in setup.
- Diff che mostra la sostituzione degli assign inline nei punti di invoke e transition.
- Output sintetico di npm run typecheck e npm run test.

Closing condition:

- FIND-003 e chiuso solo se il reviewer puo controllare che le implementazioni custom vivano interamente in setup e le transizioni referenzino solo azioni nominate.

### FIND-004 - Typing onDone residuo e clock deterministico

Scope:

- src/lib/machines/idempotency-coordinator.machine.ts
- src/lib/machines/usage.machine.ts
- src/lib/tests/idempotency.machine.test.ts
- src/lib/tests/usage.machine.test.ts
- src/lib/tests/stream-transport.machine.test.ts
- src/lib/tests/persistence-batch.machine.test.ts

Checklist:

- [x] idempotencyCoordinatorMachine accetta una dipendenza runtime.now opzionale tramite input.
- [x] usageMachine accetta una dipendenza runtime.now opzionale tramite input.
- [x] I timestamp emessi da usageMachine sono verificati da test con clock controllato.
- [x] I timestamp emessi da idempotencyCoordinatorMachine sono verificati da test con clock controllato.
- [x] Gli eventuali cast residui su event.output sono confinati in helper o punti esplicitamente motivati nella PR.
- [x] stream-transport.machine.test.ts verifica shape e ordine dei terminal event rilevanti.
- [x] persistence-batch.machine.test.ts verifica artifact lifecycle e accounting coerente con outcome.

Evidence richiesta in PR:

- Diff che mostra l introduzione di runtime.now nei tipi input e nell output event.
- Diff che mostra test deterministici con timestamp atteso fisso.
- Nota nel body PR che giustifica eventuali cast residui inevitabili di XState v5.

Closing condition:

- FIND-004 e chiuso solo se i machine producono output temporalmente deterministici in test e i residui limiti di typing sono documentati, confinati e non diffusi nelle guardie o azioni principali.

### Gate finale PR

Checklist:

- [x] npm run typecheck verde.
- [x] npm run test verde.
- [x] npm run test:smoke verde.
- [x] npm run backend:go verde.
- [x] docs/review/review-to-go.md aggiornato con mapping finding -> fix -> test -> gate.
- [x] Il body della PR elenca esplicitamente FIND-001, FIND-002, FIND-003 e FIND-004 come closed.

Closing condition:

- La review e chiusa solo se tutti i finding sono marcati closed e il gate finale PR e completamente verde.