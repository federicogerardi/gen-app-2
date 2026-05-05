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
- googleOAuthStartActor
- googleOAuthCallbackActor
- oauthStateStoreActor
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
- `start.requestId` deve coincidere con la request osservata dal client actor.
- `chunk.artifactId` deve coincidere con l`artifactId` annunciato in `start`.
- `terminal.artifactId`, se presente, deve coincidere con l`artifactId` attivo.
- violazioni di correlazione request/artifact devono essere trattate come `protocol_error`.

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
- il root deve risolvere `idempotency` e `usage` prima di invocare actor di workflow con side effect.

Nota auth/OAuth as-is:

- il runtime auth resta separato dalla generation orchestration;
- il flow OAuth Google e gestito da endpoint auth dedicati (`/auth/google/start`, `/auth/google/callback`);
- state token e PKCE sono responsabilita del layer auth (`oauthStateRepository` + runtime OAuth), non del root generation actor.

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
- `OAUTH_STATE_CREATED`
- `OAUTH_STATE_CONSUMED`
- `OAUTH_LOGIN_SUCCEEDED`
- `OAUTH_LOGIN_FAILED`

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

## 14.4.4 ToolWorkflowMachine I/O (Schema Allineato)

Tabella input canonica per `toolWorkflowMachine` (allineata a `tool-workflow-machine-spec.md`):

| Campo input | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `requestId` | `string` | si | Correlation id request/workflow |
| `registryVersion \| registrySnapshotRef` | `string` | si (almeno uno) | Selector registry per-request |
| `toolKey` | `string` | si | Esempi: `funnel-pages`, `nextland` |
| `workflowType` | `string` | si | Coerente con `toolKey` nei flow tool-specific |
| `steps` | `WorkflowStepDescriptor[]` | si | Step definiti da Tool Registry |
| `dependencyGraph` | `Record<string, string[]>` | si | Dipendenze tra step |
| `runMode` | `'new' \| 'resume' \| 'regenerate'` | si | Policy esecuzione step |
| `bootstrap.stepKey` | `string` | no | Step gia completato in bootstrap |
| `bootstrap.artifactId` | `string` | no | Artifact id di bootstrap/resume |
| `briefingId` | `string` | no | Identificativo brief workflow |
| `extractionArtifactId` | `string` | no | Artifact extraction di riferimento |
| `extractionPayload` | `Record<string, unknown>` | no | Contesto extraction propagato |
| `stepDependencyArtifactIds` | `string[]` | no | Lista artifact dipendenze |
| `stepDependencyArtifactIdsByStep` | `Record<string, string>` | no | Mappa step -> artifact id |
| `stepDependencyArtifactContentsByStep` | `Record<string, string>` | no | Mappa step -> contenuto artifact precedente |

Tabella output canonica per `toolWorkflowMachine`:

| Evento output | Payload minimo | Quando |
|---|---|---|
| `WORKFLOW_STEP_UNLOCKED` | `{ requestId, sourceActor, timestamp, stepKey }` | Step sbloccato senza artifact corrente valido |
| `WORKFLOW_STEP_COMPLETED` | `{ requestId, sourceActor, timestamp, stepKey, artifactId }` | Step completato con artifact corrente valido |

Invarianti di coerenza progressiva:

- Step 1 deve ricevere contesto extraction (`briefingId`, `extractionArtifactId`, `extractionPayload`).
- Step N deve ricevere anche il contesto step precedenti (`stepDependencyArtifactIdsByStep` e, quando disponibile, `stepDependencyArtifactContentsByStep`).
- `artifactId` emesso da `WORKFLOW_STEP_COMPLETED` deve essere propagabile come dipendenza per gli step successivi.

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
| `generationSystemMachine` | orchestration root e ordering dei gate pre-generation | nessuna validazione protocollo SSE client-side |
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

## 14.8 Frontend Tool Orchestration As-Is (Delta 2026-05-02)

Questa sezione formalizza il comportamento as-is del perimetro frontend introdotto/chiuso dal refactor XState tools.

### 14.8.1 Eventi Frontend Aggiunti (briefing upload actor)

- `INPUT_SYNCED`
- `EXTRACTION_RECOVERED`

Semantica:

- `INPUT_SYNCED` aggiorna il context del child actor briefing quando i parametri runtime (`projectId`, `userId`, capability/auth context) cambiano dopo il mount React.
- `EXTRACTION_RECOVERED` chiude esplicitamente la transizione `extracting -> ready` quando e disponibile un artifact extraction persistito coerente con progetto+briefing.

### 14.8.2 Invarianti Frontend As-Is

- Il context actor briefing non deve rimanere stale rispetto al progetto corrente selezionato nella pagina tool.
- Un artifact extraction persistito valido deve essere sufficiente per convergere allo stato UI `ready` anche in caso di stream non terminale osservabile dal client.
- Il reset del sottoflusso briefing deve essere deterministico su cambio progetto per evitare riuso involontario di contesto cross-project.

### 14.8.3 Convergenza UI Richiesta

Per ogni run tools:

1. `uploading`
2. `extracting`
3. `ready` (diretto via `onDone` oppure via `EXTRACTION_RECOVERED`)

La pagina tool non deve rimanere in pending infinito su `extracting` quando l'artifact extraction e gia stato salvato e recuperabile.

