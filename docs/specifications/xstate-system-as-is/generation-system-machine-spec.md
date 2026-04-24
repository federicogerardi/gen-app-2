## 6. State Model Target (As-Is Coverage Completa)

## 6.1 Root Machine (Server Request Lifecycle)

Stati (as-is implementazione):

- `idle`
- `gateway` — gestisce AUTH_OK/AUTH_FAIL/VALIDATION_OK/VALIDATION_FAIL inline
- `routing` — stato always che determina il flow (extraction/tool/generic) o va in failed
- `extractionFlow` — invoca `extractionChainMachine`
- `toolGenerationFlow` — invoca `toolWorkflowMachine`
- `genericGenerationFlow` — transizione immediata a `usageAndIdempotency`
- `usageAndIdempotency` (compound):
  - `idempotency` — invoca `idempotencyCoordinatorMachine`
  - `usage` — invoca `usageMachine`
- `streaming` — invoca `streamTransportMachine`
- `persistingSuccess` — invoca `persistenceBatchMachine` sul path success
- `persistingFailure` — invoca `persistenceBatchMachine` sul path failure
- `finalizeIdempotencySuccess` — invoca `markCompletedIdempotency`
- `finalizeIdempotencyFailure` — invoca `markFailedIdempotency`
- `completed`
- `failed`

Transizioni principali:

- idle --REQUEST_RECEIVED (con registrySelector)--> gateway
- idle --REQUEST_RECEIVED (senza registrySelector)--> failed (`missing_registry_selector`)
- gateway --AUTH_OK--> gateway (`setUserId`)
- gateway --AUTH_FAIL--> failed (`unauthorized`)
- gateway --VALIDATION_OK--> routing
- gateway --VALIDATION_FAIL--> failed
- routing [always] --routeIsExtraction--> extractionFlow
- routing [always] --routeIsTool--> toolGenerationFlow
- routing [always] --routeIsGeneric--> genericGenerationFlow
- routing [always] --hasAmbiguousRouting--> failed (`ambiguous_routing`)
- extractionFlow --onDone--> usageAndIdempotency
- toolGenerationFlow --onDone--> usageAndIdempotency
- genericGenerationFlow [always]--> usageAndIdempotency
- usageAndIdempotency.idempotency --IDEMPOTENCY_REPLAY_READY--> completed
- usageAndIdempotency.idempotency --IDEMPOTENCY_CONFLICT--> persistingFailure
- usageAndIdempotency.idempotency --claimed--> usage
- usageAndIdempotency.usage --USAGE_GRANTED--> streaming
- usageAndIdempotency.usage --USAGE_REJECTED--> persistingFailure
- streaming --STREAM_TERMINATED_SUCCESS--> persistingSuccess
- streaming --STREAM_TERMINATED_FAILURE--> persistingFailure
- persistingSuccess --onDone--> finalizeIdempotencySuccess
- persistingFailure --onDone--> finalizeIdempotencyFailure
- finalizeIdempotencySuccess --onDone--> completed
- finalizeIdempotencyFailure --onDone--> failed
- completed --RESET--> idle
- failed --RESET--> idle

Nota: `requestGatewayMachine` esiste come macchina standalone ma NON è invocata come actor da `generationSystemMachine`. La logica gateway è gestita inline nello stato `gateway`.

## 14. Blueprint di Implementazione XState v5 (Consigliato)

Diagnosi sintetica:

- il blueprint as-is definisce bene contratti ed eventi, ma non e ancora abbastanza prescrittivo sui confini actor/machine per evitare che una nuova implementazione ricada in route monolitiche;
- la priorita della nuova implementazione deve essere la chiarezza dei confini XState, non la replica 1:1 dei file o delle funzioni correnti;
- equivalenza funzionale significa preservare semantica, contratti e invarianti, non copiare il wiring runtime attuale.

## 14.1 Architettura XState-First Proposta

La nuova implementazione deve essere centrata su una gerarchia di actor esplicita.

Actor root consigliato:

1. `generationSystemMachine`
- actor root server-side.
- riceve `REQUEST_RECEIVED`.
- decide se avviare `genericGenerationFlow`, `toolGenerationFlow` o `extractionFlow`.

### 14.1.1 Routing Decision Table Deterministica (Root Actor)

Il routing del root actor deve essere funzione deterministica di:

- `toolKey`
- `workflowType`
- `artifactType`
- `registryVersion | registrySnapshotRef`
- `idempotencyKey`
- `input.responseMode` (solo extraction)

Ordine di valutazione obbligatorio (top-down, first-match-wins):

| Priorita | Condizione | Flow target | Esito se condizione fallisce |
|---|---|---|---|
| 1 | `toolKey === 'extraction'` OR `workflowType === 'extraction'` OR `artifactType === 'extraction'` | `extractionFlow` | passa alla priorita 2 |
| 2 | `toolKey != null` AND `toolKey !== 'extraction'` | `toolGenerationFlow` | passa alla priorita 3 |
| 3 | `toolKey == null` AND `workflowType == null` | `genericGenerationFlow` | passa alla priorita 4 |
| 4 | combinazione non valida o ambigua | `failed` | emettere `VALIDATION_FAIL` con reason `ambiguous_routing` |

Regole di tie-break non negoziabili:

- se almeno una delle tre chiavi (`toolKey`, `workflowType`, `artifactType`) indica extraction, vince sempre `extractionFlow`.
- `toolKey` non nullo e non extraction vince su `workflowType` generico nullo.
- `workflowType` valorizzato con `toolKey == null` e `artifactType != extraction` e input ambiguo non deve inferire automaticamente un tool: deve fallire in validazione.
- il root actor non deve usare fallback impliciti basati sul provider/model per decidere il flow.

Normalizzazione obbligatoria pre-routing:

- trim e lowercase di `toolKey`/`workflowType`.
- se entrambi assenti (`registryVersion` e `registrySnapshotRef`) -> `VALIDATION_FAIL` reason `missing_registry_selector`.
- validazione rispetto al Tool Registry risolto per-request (selector esplicito, non implicito globale).
- se `toolKey` e presente ma non registrato/attivo -> `VALIDATION_FAIL` reason `unknown_tool_key`.
- se `workflowType` e presente ma non registrato/attivo -> `VALIDATION_FAIL` reason `unknown_workflow_type`.

Contratto idempotency per routing:

- in `extractionFlow`, `idempotencyKey` e raccomandata fortemente e il path senza key deve essere esplicitamente tracciato (`metadata.idempotency = 'missing'`).
- in `toolGenerationFlow`, comportamento idempotency determinato da `idempotency_scope` del registry (`request | step | none`), senza fallback impliciti.
- in `genericGenerationFlow`, assenza di idempotencyKey non cambia il flow ma deve restare osservabile nei log di request.

Pseudocodice canonico:

```ts
if (isExtractionSignal(toolKey, workflowType, artifactType)) {
  return 'extractionFlow';
}

if (toolKey !== null) {
  return 'toolGenerationFlow';
}

if (toolKey === null && workflowType === null) {
  return 'genericGenerationFlow';
}

throw new ValidationError('ambiguous_routing');
```

Questa tabella e vincolante per test di transizione root actor: a parita di input normalizzato, il flow scelto deve essere sempre unico.

### 14.1.2 Scelta XState-First: Separazione Formale Deterministic vs Non-Deterministic

Scelta architetturale adottata:

- separare formalmente i flow deterministic e non-deterministic come rami espliciti della state machine;
- non trattare la variabilita di idempotency come regola implicita distribuita.

Motivazione XState-first:

- la natura del comportamento (deterministic/non-deterministic) deve essere visibile nella topologia stati/transizioni;
- le proprieta verificabili della macchina (replay invariance, retry invariance) diventano testabili per ramo;
- riduce ambiguita quando si introducono nuovi tool con policy diverse.

Partizionamento obbligatorio dei flow:

- deterministic branch:
  - replay supportato;
  - retry cross-node supportato;
  - idempotency richiesta a livello di richiesta o step in base al registry;
  - eventi terminali devono essere replay-safe.

- non-deterministic branch:
  - replay non garantito;
  - retry cross-node non garantito;
  - idempotency opzionale o disabilitata;
  - output considerato best-effort non replayabile.

Regola di classificazione runtime:

- ogni tool registrato deve dichiarare `determinism_class: deterministic | non_deterministic`.
- il root actor deve instradare prima per flow (sezione 14.1.1), poi per `determinism_class`.
- assenza di `determinism_class` nel registry -> `VALIDATION_FAIL` con reason `missing_determinism_class`.

Implicazioni su idempotency:

- branch deterministic: idempotency non puo essere `none`.
- branch non-deterministic: idempotency puo essere `none`, ma il sistema deve esporre questa scelta in audit/event metadata.

Test minimi obbligatori per separazione:

- stessa request deterministic + stesso idempotencyKey -> stesso artifact outcome (o replay coerente).
- stessa request non-deterministic + stesso idempotencyKey -> nessuna promessa di replay identico.
- transizione tra classi diverse non ammessa senza modifica esplicita di registry versionata.

## 14.8 Transition Table Formale

Le tabelle seguenti sono normative per progettazione avanzata e test model-based.

### 14.8.1 generationSystemMachine

| Current state | Event / Trigger | Guard / Precondizione | Target state | Actions principali |
|---|---|---|---|---|
| `idle` | `REQUEST_RECEIVED` | `registryVersion` o `registrySnapshotRef` presenti | `gateway` | `cacheRequestMeta` (calcola `routeType`), `reset content/failure` |
| `idle` | `REQUEST_RECEIVED` | nessun registry selector | `failed` | `setMissingRegistrySelectorFailure` |
| `gateway` | `AUTH_OK` | - | `gateway` | `setUserId` |
| `gateway` | `AUTH_FAIL` | - | `failed` | `setFailureReason='unauthorized'` |
| `gateway` | `VALIDATION_OK` | - | `routing` | `setValidationData` (aggiorna `routeType`) |
| `gateway` | `VALIDATION_FAIL` | - | `failed` | `setFailureReason=event.reason` |
| `routing` | always | `routeIsExtraction` | `extractionFlow` | - |
| `routing` | always | `routeIsTool` | `toolGenerationFlow` | - |
| `routing` | always | `routeIsGeneric` | `genericGenerationFlow` | - |
| `routing` | always | `hasAmbiguousRouting` | `failed` | `setAmbiguousRoutingFailure` |
| `extractionFlow` | invoke `extractionChainMachine` done | - | `usageAndIdempotency` | - |
| `extractionFlow` | invoke error | - | `persistingFailure` | `setExtractionFailedFailure` |
| `toolGenerationFlow` | invoke `toolWorkflowMachine` done | - | `usageAndIdempotency` | `cacheToolArtifactFromOutput` |
| `toolGenerationFlow` | invoke error | - | `persistingFailure` | `setWorkflowFailedFailure` |
| `genericGenerationFlow` | always | - | `usageAndIdempotency` | - |
| `usageAndIdempotency.idempotency` | invoke done | `idempotencyOutputIsReplay` | `completed` | `cacheReplayPayload` |
| `usageAndIdempotency.idempotency` | invoke done | `idempotencyOutputIsConflict` | `persistingFailure` | `setFailureFromInvokeOutput` |
| `usageAndIdempotency.idempotency` | invoke done | claimed | `usageAndIdempotency.usage` | - |
| `usageAndIdempotency.idempotency` | invoke error | - | `persistingFailure` | `setIdempotencyConflictFailure` |
| `usageAndIdempotency.usage` | invoke done | `usageOutputIsRejected` | `persistingFailure` | `setFailureFromInvokeOutput` |
| `usageAndIdempotency.usage` | invoke done | granted | `streaming` | - |
| `usageAndIdempotency.usage` | invoke error | - | `persistingFailure` | `setUsageFailedFailure` |
| `streaming` | invoke `streamTransportMachine` done | `streamOutputIsFailure` | `persistingFailure` | `setFailureFromInvokeOutput` |
| `streaming` | invoke done | success | `persistingSuccess` | - |
| `streaming` | invoke error | - | `persistingFailure` | `setStreamFailureFailure` |
| `persistingSuccess` | invoke `persistenceBatchMachine` done | - | `finalizeIdempotencySuccess` | - |
| `persistingSuccess` | invoke error | - | `persistingFailure` | `setPersistenceFinalizeFailedFailure` |
| `persistingFailure` | invoke done/error | - | `finalizeIdempotencyFailure` | - |
| `finalizeIdempotencySuccess` | invoke done/error | - | `completed` | - |
| `finalizeIdempotencyFailure` | invoke done/error | - | `failed` | - |
| `completed` | `RESET` | - | `idle` (`reenter: true`) | `resetVolatileContext` |
| `failed` | `RESET` | - | `idle` (`reenter: true`) | `resetVolatileContext` |

Nota priorita eventi in `usageAndIdempotency` (deterministica):

1. `IDEMPOTENCY_REPLAY_READY`
2. `IDEMPOTENCY_CONFLICT`
3. `USAGE_REJECTED`
4. `USAGE_GRANTED`

