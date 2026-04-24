## 7. Guard, Action, Actor Catalog

## 7.1 Guardie

- isAuthenticated
- isPayloadValid
- isModelAvailable
- isWithinRateLimit
- isWithinQuota
- isProjectOwnedByUser
- isStreamTerminalOpen
- canPersistPartialOnTimeout
- isExtractionRolloutAllowed
- hasIdempotencyKey
- shouldEscalateAttempt
- canSoftAcceptAttempt

## 7.2 Azioni Pure (no side effect in assign)

- cacheRequestMeta
- appendTokenToBuffer
- setFallbackReason
- incrementAttemptIndex
- setStepStatus
- accumulateCostEstimate
- setTerminalOutcome

## 7.3 Side Effects (Actors)

- authActor
- validationActor
- modelRegistryActor
- usageGuardsActor
- ownershipActor
- llmStreamAdapterActor (OpenRouter as-is; fallback sintetico in assenza chiave)
- artifactCreateActor
- artifactProgressFlushActor
- artifactFinalizeSuccessActor
- artifactFinalizeFailureActor
- quotaHistoryActor
- extractionEvaluationActor
- retryDelayActor

## 8. Contratto SSE Canonico

Ogni evento SSE deve essere in formato:

```text
event: <name>\ndata: {json}\n\n
```

Tipi evento ammessi:

`start`

```json
{
  "requestId": "string",
  "artifactId": "string"
}
```

`chunk`

```json
{
  "artifactId": "string",
  "chunk": "string",
  "sequence": 1
}
```

`terminal`

```json
{
  "artifactId": "string|null",
  "status": "completed|failed",
  "reason": "string|null"
}
```

Invarianti SSE:

- `start` obbligatorio per stream validi.
- `terminal` unico per stream.
- `sequence` su `chunk` monotonicamente crescente.

## 14.3 Topologia Actor Consigliata

Topologia server consigliata:

```text
generationSystemMachine
|- requestGatewayMachine
|- usageMachine
|- idempotencyCoordinatorMachine
|- flowRouterMachine
  |- genericGenerationFlowMachine
  |  |- streamTransportMachine
  |  |- persistenceBatchMachine
  |
  |- toolGenerationFlowMachine
  |  |- toolWorkflowMachine
  |  |- streamTransportMachine (per step o per run)
  |  |- persistenceBatchMachine
  |
  |- extractionFlowMachine
    |- extractionChainMachine
    |- streamTransportMachine (per attempt)
    |- persistenceBatchMachine
```

Regole di comunicazione:

- il root invia eventi semantici, non dettagli SQL.
- gli actor figli rispondono con eventi di dominio (`STREAM_TERMINATED_SUCCESS`, `PERSISTENCE_FLUSH_COMMITTED`, `IDEMPOTENCY_REPLAY_READY`).
- la UI o il route handler osservano il root actor; non devono coordinare manualmente gli attori interni.

## 14.4 Contratti Evento Tra Actor

Eventi interni consigliati per la nuova implementazione:

- `USAGE_GRANTED`
- `USAGE_REJECTED`
- `IDEMPOTENCY_CLAIMED`
- `IDEMPOTENCY_REPLAY_READY`
- `IDEMPOTENCY_CONFLICT`
- `STREAM_SESSION_STARTED`
- `STREAM_CHUNK_RECEIVED`
- `STREAM_HEARTBEAT_DUE`
- `STREAM_TERMINATED_SUCCESS`
- `STREAM_TERMINATED_FAILURE`
- `PERSISTENCE_FLUSH_REQUESTED`
- `PERSISTENCE_FLUSH_COMMITTED`
- `PERSISTENCE_FINALIZE_SUCCEEDED`
- `PERSISTENCE_FINALIZE_FAILED`
- `WORKFLOW_STEP_UNLOCKED`
- `WORKFLOW_STEP_COMPLETED`
- `EXTRACTION_ATTEMPT_ACCEPTED`
- `EXTRACTION_ATTEMPT_REJECTED`
- `EXTRACTION_CHAIN_EXHAUSTED`

Regola di modellazione:

- eventi API/SSE verso l'esterno e eventi interni actor-to-actor non devono coincidere per nome se rappresentano livelli di astrazione diversi.
- gli eventi SSE restano contratto esterno; gli eventi sopra sono contratto interno della macchina.

## 14.4.1 Envelope Tipizzato Minimo

Ogni evento interno tra actor deve usare un envelope prevedibile.

Campi minimi obbligatori:

- `type: string`
- `requestId: string`
- `sourceActor: string`
- `timestamp: string` in formato ISO-8601

Campi opzionali standardizzati:

- `artifactId?: string`
- `toolKey?: string | null`
- `workflowType?: string | null`
- `registryVersion?: string`
- `registrySnapshotRef?: string`
- `stepKey?: string`
- `attemptIndex?: number`
- `reason?: string`
- `metadata?: Record<string, unknown>`

Regole envelope:

- `requestId` deve propagarsi invariato dal root actor a tutti gli actor figli.
- `sourceActor` identifica il produttore dell'evento, non il destinatario.
- `metadata` e ammesso solo per dati accessori; i campi contrattuali non devono essere nascosti in `metadata`.
- `reason` e obbligatorio su tutti gli eventi di rifiuto o terminal failure.

## 14.4.2 Contratti Per Actor

Contratti minimi richiesti tra root e child actor:

## 14.4.3 Ownership Del Payload

Ownership contrattuale dei campi:

- il root actor possiede `requestId`, `toolKey`, `workflowType`, `artifactType` come sorgente canonica.
- il root actor possiede anche `registryVersion`/`registrySnapshotRef` come selector canonico dello snapshot registry per-request.
- `usageMachine` possiede solo l'esito usage, non puo mutare `artifactId` o `contentBuffer`.
- `idempotencyCoordinatorMachine` puo produrre `artifactId` solo nei path replay/claim.
- `streamTransportMachine` possiede `sequence`, `chunk`, `estimatedTokens`, `costEstimate`, `timeoutKind`.
- `persistenceBatchMachine` possiede `completedAt`, `inputTokens`, `outputTokens`, `costUSD`, `failureReason` persistita.
- `toolWorkflowMachine` possiede `stepKey`, `activeStepIndex`, `step status`.
- `extractionChainMachine` possiede `attemptIndex`, `acceptanceReason`, `consistencyDecision`.

Regola: un actor non deve riscrivere campi owned da un altro actor se non tramite evento esplicito accettato dal root.

## 14.5 Regole XState v5 da Applicare

- usare `setup().createMachine()` come default per tutte le macchine significative.
- creare actor runtime con `createActor()`.
- modellare side effect async con actor logic creator (`fromPromise`, `fromObservable` solo se realmente necessario).
- usare `reenter: true` quando un reset o un retry deve ricreare esplicitamente sottoalberi e actor figli.
- usare `always` solo per passaggi derivati puri e garantiti non ciclici.
- per reasoning fuori runtime, preferire `getNextSnapshot(...)` invece di logica ad hoc.
- evitare side effect dentro `assign`.

## 14.6 Mapping Macchine -> Responsabilita di Scalabilita

Per evitare i colli di bottiglia emersi nell'analisi di scalabilita, ogni macchina deve avere una responsabilita operativa unica:

| Machine | Responsabilita primaria | Cosa non deve fare |
|---|---|---|
| `requestGatewayMachine` | gate iniziali e routing | nessuna write progressiva di stream |
| `usageMachine` | claim quota e rate-limit | nessuna gestione token provider |
| `idempotencyCoordinatorMachine` | replay/conflict/claim | nessun parsing output modello |
| `streamTransportMachine` | trasporto token, timeout, disconnect | nessuna persistenza SQL |
| `persistenceBatchMachine` | flush e finalizzazione artifact | nessuna chiamata provider |
| `toolWorkflowMachine` | dipendenze step, resume, regenerate | nessun controllo auth/ownership |
| `extractionChainMachine` | policy di accept/escalation | nessuna emissione SSE diretta |

## 14.7 Priorita di Implementazione

Ordine consigliato di costruzione nel progetto:

1. `usageMachine` + `idempotencyCoordinatorMachine`
2. `streamTransportMachine`
3. `persistenceBatchMachine`
4. `generationSystemMachine` come composizione root
5. `extractionChainMachine`
6. `toolWorkflowMachine` parametrica

Motivazione:

- quota/idempotency sono i primi confini che impediscono duplicazioni e race;
- stream e persistence devono essere separati prima di aggiungere nuovi tool;
- extraction e workflow parametrico si innestano piu facilmente sopra un backbone actor gia stabile.

