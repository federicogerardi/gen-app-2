# XState System As-Is Blueprint (Standalone)

Versione: 2.0  
Status: Reference blueprint standalone per ricostruzione completa  
Data: 2026-04-24  

## 1. Obiettivo Documento

Questo documento descrive il comportamento as-is del sistema in modo autosufficiente, cosi da guidare una nuova implementazione da zero in qualsiasi repository/ambiente, senza dipendenze implicite dal workspace originale.

Obiettivo pratico: permettere a un team di implementare statechart XState v5 equivalenti (server + client) senza lacune funzionali.

## 2. Ambito Funzionale (As-Is)

Sistema multi-tool per generazione artifact AI con streaming SSE, guardrail di sicurezza/costo e workflow a step.

Capacita incluse:

- Generazione generic artifact: content, seo, code.
- Generazione tool-based:
- Funnel Pages (step: optin -> quiz -> vsl).
- NextLand (step: landing -> thank_you).
- Extraction con catena tentativi, validazione output e fallback policy.
- Autenticazione utente, ownership project, model availability.
- Rate limit + quota enforcement (numero generazioni).
- Persistenza artifact con lifecycle completo.
- Cost accounting e quota history.
- Contratto SSE strutturato con eventi start/token/progress/complete/error.

Fuori ambito (non necessario per equivalenza funzionale):

- Scelte UI visuali specifiche.
- Provider cloud specifico (pur mantenendo semantica equivalente).
- Dettagli framework web (Next.js/non-Next.js).

## 3. Vincoli Architetturali Non Negoziabili

- Pattern actor-based con separazione di responsabilita:
- Route/API layer: auth, validate, ownership, usage guards, output contract.
- Orchestrator layer: routing type/workflow, normalizzazione output.
- Provider layer: stream token, usage tokens, abort/timeout.
- Persistence layer: artifact state + cost + audit/quota history.

- Nessuna chiamata al provider prima del completamento di tutti i gate:
- autenticazione
- validazione input
- disponibilita modello
- usage guards
- ownership project

- Contratto errori canonico:

```json
{ "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

- Contratto SSE canonico (vedi sezione 8).

## 4. Modello Dominio Minimo

## 4.1 Entita Core

`User`

- id: string
- monthlyQuota: number
- monthlyUsed: number

`Project`

- id: string
- userId: string

`Artifact`

- id: string
- userId: string
- projectId: string
- type: string (registry-backed; seed values as-is: `content`, `seo`, `code`, `extraction`)
- workflowType: string | null (registry-backed; seed values as-is: `funnel_pages`, `nextland`, `extraction`, `meta_ads`; `null` ammesso per flow generic)
- model: string
- input: json
- content: string
- status: generating | completed | failed
- failureReason: null | string
- inputTokens: number
- outputTokens: number
- costUSD: number
- streamedAt: datetime|null
- completedAt: datetime|null

`QuotaHistory`

- id: string
- userId: string
- requestCount: number
- costUSD: number
- model: string
- artifactType: string (registry-backed)
- status: success | error | rate_limited
- createdAt: datetime

## 4.2 Enumerazioni Funzionali

Artifact type runtime:

- open string validated against Tool Registry

Seed values as-is:

- content
- seo
- code
- extraction

Workflow type runtime:

- open string validated against Tool Registry

Seed values as-is:

- funnel_pages
- nextland
- extraction
- meta_ads (legacy storica)
- null (generic flow senza tool-specific workflow)

Output format stream:

- plain
- markdown
- json

## 4.3 Schema Logical Model (Storage Standalone)

Storage target consigliato per equivalenza as-is: database relazionale SQL (PostgreSQL o equivalente ACID).

Relazioni minime:

- User 1:N Project
- User 1:N Artifact
- Project 1:N Artifact
- User 1:N QuotaHistory

Logical schema (livello concettuale):

`users`

- id (PK)
- monthly_quota
- monthly_used
- created_at
- updated_at

`projects`

- id (PK)
- user_id (FK -> users.id)
- created_at
- updated_at

`artifacts`

- id (PK)
- user_id (FK -> users.id)
- project_id (FK -> projects.id)
- type
- workflow_type
- model
- input_json
- content
- status
- failure_reason
- input_tokens
- output_tokens
- cost_usd
- streamed_at
- completed_at
- created_at
- updated_at

`quota_history`

- id (PK)
- user_id (FK -> users.id)
- request_count
- cost_usd
- model
- artifact_type
- status
- request_id (opzionale ma consigliato)
- created_at

`request_idempotency` (opzionale ma consigliata per robustezza cross-env)

- id (PK)
- user_id (FK -> users.id)
- project_id (FK -> projects.id)
- idempotency_key
- artifact_id (FK -> artifacts.id)
- endpoint
- status_snapshot
- created_at
- expires_at

Regola di ownership invariance:

- `artifacts.user_id` deve essere coerente con `projects.user_id` per lo stesso `project_id`.

## 4.4 Tool Registry Contract (Obbligatorio)

Ogni nuovo tool deve essere registrato in un registry centralizzato (config o tabella) prima di essere attivato in runtime.

Campi obbligatori per voce di registry:

- `tool_key`: string univoca stabile (es. `funnel_pages`, `nextland`, `my_tool`).
- `registry_version`: string versione registry (es. `2026.04.24.1`).
- `snapshot_ref`: riferimento immutabile snapshot (hash/id).
- `workflow_type`: stringa registry-backed usata in stream e persistenza artifact.
- `artifact_type`: stringa registry-backed, aperta nel tempo.
- `supports_extraction`: boolean.
- `steps`: array ordinato di step key (lunghezza variabile, minimo 1).
- `dependencies`: grafo dipendenze step (`step -> prerequisite[]`).
- `generation_endpoint`: path API.
- `default_output_format`: `plain | markdown | json`.
- `idempotency_scope`: `request | step | none`.
- `active`: boolean.

Esempio shape logica:

```json
{
  "tool_key": "funnel_pages",
  "registry_version": "2026.04.24.1",
  "snapshot_ref": "reg_7f3a91c2",
  "workflow_type": "funnel_pages",
  "artifact_type": "content",
  "supports_extraction": true,
  "steps": ["optin", "quiz", "vsl"],
  "dependencies": {
    "optin": [],
    "quiz": ["optin"],
    "vsl": ["optin", "quiz"]
  },
  "generation_endpoint": "/api/tools/funnel-pages/generate",
  "default_output_format": "markdown",
  "idempotency_scope": "step",
  "active": true
}
```

Regole obbligatorie registry:

- `tool_key` e `workflow_type` univoci.
- ogni request deve essere valutata contro uno snapshot registry esplicito per-request (`registryVersion` o `registrySnapshotRef`).
- `workflow_type` e un valore aperto ma deve essere registrato e validato a runtime.
- `artifact_type` e un valore aperto ma deve essere registrato e validato a runtime.
- `dependencies` deve essere un DAG (no cicli).
- Ogni step in `dependencies` deve esistere in `steps`.
- Ogni tool nuovo deve dichiarare mapping esplicito `artifact_type/workflow_type`.
- Nessun tool non registrato puo entrare nel routing runtime.

## 5. Event Catalog Unificato (Per XState)

Eventi cross-subsystem:

- REQUEST_RECEIVED
- AUTH_OK | AUTH_FAIL
- VALIDATION_OK | VALIDATION_FAIL
- MODEL_AVAILABLE | MODEL_UNAVAILABLE
- USAGE_OK | RATE_LIMITED | QUOTA_EXHAUSTED
- OWNERSHIP_OK | OWNERSHIP_FAIL
- STREAM_START
- STREAM_TOKEN
- STREAM_PROGRESS
- STREAM_COMPLETE
- STREAM_ERROR
- STREAM_TIMEOUT
- CLIENT_DISCONNECT
- PERSIST_SUCCESS
- PERSIST_FAILURE
- RETRY_SCHEDULED
- RETRY_ATTEMPT
- RESET

Eventi extraction-specific:

- ROLLOUT_ALLOWED | ROLLOUT_BLOCKED
- IDEMPOTENCY_HIT_COMPLETED
- IDEMPOTENCY_HIT_CONFLICT
- ATTEMPT_STARTED
- ATTEMPT_MODEL_UNAVAILABLE
- ATTEMPT_PARSE_OK | ATTEMPT_PARSE_FAIL
- ATTEMPT_SCHEMA_OK | ATTEMPT_SCHEMA_FAIL
- ATTEMPT_CONSISTENCY_OK | ATTEMPT_CONSISTENCY_FAIL
- ATTEMPT_SOFT_ACCEPT
- ATTEMPT_REJECTED
- ATTEMPT_ESCALATE
- CHAIN_EXHAUSTED

Eventi workflow client:

- STEP_STARTED
- STEP_DONE
- STEP_ERROR
- WORKFLOW_DONE
- WORKFLOW_ABORT

## 6. State Model Target (As-Is Coverage Completa)

## 6.1 Root Machine (Server Request Lifecycle)

Stati:

- idle
- auth
- validate
- preflight
- streaming
- persist
- completed
- failed

`preflight` (compound):

- model_check
- usage_check
- ownership_check

Transizioni principali:

- idle --REQUEST_RECEIVED--> auth
- auth --AUTH_OK--> validate
- auth --AUTH_FAIL--> failed
- validate --VALIDATION_OK--> preflight.model_check
- validate --VALIDATION_FAIL--> failed
- preflight.model_check --MODEL_AVAILABLE--> preflight.usage_check
- preflight.model_check --MODEL_UNAVAILABLE--> failed
- preflight.usage_check --USAGE_OK--> preflight.ownership_check
- preflight.usage_check --RATE_LIMITED|QUOTA_EXHAUSTED--> failed
- preflight.ownership_check --OWNERSHIP_OK--> streaming
- preflight.ownership_check --OWNERSHIP_FAIL--> failed
- streaming --STREAM_COMPLETE--> persist
- streaming --STREAM_ERROR|STREAM_TIMEOUT|CLIENT_DISCONNECT--> failed (o persist parziale dove consentito)
- persist --PERSIST_SUCCESS--> completed
- persist --PERSIST_FAILURE--> failed

## 6.2 Streaming Machine (Server)

Stati:

- artifact_initializing
- stream_open
- streaming_tokens
- progress_flushing
- normalizing_output
- terminal_emit_complete
- terminal_emit_error
- closed

Regole:

- Emettere sempre `start` prima del primo `token`.
- Emettere `progress` periodico con stime tokens/costo.
- Effettuare flush periodico contenuto su storage durante stream.
- Su complete: normalizzare output, persist finale, emettere evento complete terminale.
- Su errore non recuperabile: emettere error terminale.
- Su client disconnect: interrompere provider e marcare failure coerente.

## 6.3 Workflow Machine (Client Funnel/NextLand)

Stati:

- idle
- running_step_1
- running_step_2
- running_step_3 (solo funnel)
- error
- done

Funnel dependencies:

- quiz richiede optinOutput
- vsl richiede optinOutput + quizOutput

NextLand dependencies:

- thank_you richiede landingOutput

Retry:

- retry con backoff per step retryable.
- notice utente durante retry.
- step in errore resta recuperabile senza perdere step gia done.

## 6.3-bis Workflow Machine Parametrica (Step Variabili)

Per nuovi tool, il modello client deve essere parametrico e non hardcoded su 2/3 step.

Contesto minimo parametrico:

- `tool_key: string`
- `workflow_type: string`
- `artifact_type: string`
- `steps: StepNode[]`
- `active_step_index: number`
- `dependency_graph: Record<string, string[]>`
- `step_outputs: Record<string, string>`
- `step_artifact_ids: Record<string, string>`
- `run_mode: 'new' | 'resume' | 'regenerate'`

Shape `StepNode`:

- `key: string`
- `status: idle | running | done | error | skipped`
- `retry_count: number`
- `error_message: string | null`

Regole runtime step-variabili:

- Avanzamento consentito solo se tutte le dipendenze dello step attivo sono `done`.
- `active_step_index` punta sempre al primo step non terminale (`idle|running|error`).
- In `resume`, gli step `done` non devono essere rigenerati salvo `regenerate` esplicito.
- Lo stato `done` globale si raggiunge solo quando tutti gli step required sono `done` o `skipped` ammessi.
- Il numero step e la topologia dipendenze provengono dal Tool Registry.

Eventi parametrizzati consigliati:

- `STEP_START({ step_key })`
- `STEP_SUCCESS({ step_key, output, artifact_id })`
- `STEP_FAILURE({ step_key, reason })`
- `STEP_RETRY({ step_key })`
- `STEP_SKIP({ step_key })`
- `WORKFLOW_COMPLETE`

## 6.4 Extraction Chain Machine (Server)

Stati:

- preflight
- rollout_gate
- idempotency_check
- attempt_preflight
- attempt_running
- attempt_evaluate
- attempt_accept
- attempt_replay_or_finalize
- attempt_escalate
- chain_exhausted
- failed_hard
- completed

Comportamento chiave:

- Rollout gate puo bloccare con `SERVICE_UNAVAILABLE`.
- Idempotency:
- Se artifact completed esistente: replay stream immediato.
- Se artifact non terminale: conflict.
- Attempt plan multi-modello: saltare modelli non disponibili.
- Valutazione attempt su 3 assi: parse, schema, consistency.
- Possibile soft-accept in modalita text/timebox.
- Escalation finche policy consente; poi chain exhausted.

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
- providerStreamActor
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
data: {json}\n\n
```

Tipi evento ammessi:

`start`

```json
{
  "type": "start",
  "artifactId": "string",
  "workflowType": "string|null",
  "format": "plain|markdown|json"
}
```

`token`

```json
{
  "type": "token",
  "token": "string",
  "sequence": 1,
  "workflowType": "...",
  "format": "..."
}
```

`progress`

```json
{
  "type": "progress",
  "workflowType": "...",
  "format": "...",
  "estimatedTokens": { "input": 123, "output": 456 },
  "costEstimate": 0.0123
}
```

`complete`

```json
{
  "type": "complete",
  "artifactId": "string",
  "content": "string",
  "workflowType": "...",
  "format": "plain|markdown|json",
  "tokens": { "input": 123, "output": 456 },
  "cost": 0.0123
}
```

`error`

```json
{
  "type": "error",
  "code": "INTERNAL_ERROR|...",
  "message": "string",
  "workflowType": "...",
  "format": "..."
}
```

Invarianti SSE:

- `start` obbligatorio per stream validi.
- `complete` e `error` mutuamente esclusivi come terminal event.
- `sequence` su token monotonicamente crescente.

## 9. Contratti API Minimi da Preservare

## 9.1 Generic Generate

POST `/api/artifacts/generate`

Input minimo:

```json
{
  "projectId": "cuid",
  "type": "string",
  "registryVersion": "string (obbligatorio se registrySnapshotRef assente)",
  "registrySnapshotRef": "string (obbligatorio se registryVersion assente)",
  "model": "string",
  "input": {}
}
```

Vincolo: almeno uno tra `registryVersion` e `registrySnapshotRef` deve essere presente.

Nota: nel sistema as-is i valori seed per `type` sul path generic sono `content`, `seo`, `code`; nella nuova implementazione il valore deve essere validato contro il Tool Registry/Artifact Type Registry.

Per i flow generic, `workflowType` puo essere `null`; per ogni tool registrato, `workflowType` deve corrispondere a una voce attiva del Tool Registry.

Esito:

- 200 SSE stream (start/token/progress/complete o error)
- 4xx/5xx con error object canonico

## 9.2 Funnel Generate

POST `/api/tools/funnel-pages/generate`

Input logico:

- registry selector per-request: almeno uno tra `registryVersion` e `registrySnapshotRef`
- projectId, model, tone, step(optin|quiz|vsl)
- extractionContext/briefing
- dipendenze step precedenti (optinOutput, quizOutput)

Esito:

- SSE markdown-oriented

## 9.3 NextLand Generate

POST `/api/tools/nextland/generate`

Input logico:

- registry selector per-request: almeno uno tra `registryVersion` e `registrySnapshotRef`
- projectId, model, tone, step(landing|thank_you)
- extractionContext/briefing
- dipendenze step precedenti (landingOutput)

Esito:

- SSE markdown-oriented

## 9.4 Extraction Generate

POST `/api/tools/extraction/generate`

Input logico:

- registry selector per-request: almeno uno tra `registryVersion` e `registrySnapshotRef`
- projectId, model (requested), rawContent, fieldMap, tone
- responseMode: structured|text
- idempotency key via header (opzionale)

Esito:

- SSE success/replay
- oppure error contract (`EXTRACTION_FAILED`, `SERVICE_UNAVAILABLE`, `CONFLICT`, ecc.)

## 9.5 Pipeline Canonica Obbligatoria (Tool Runtime)

Ogni tool nuovo deve implementare la pipeline canonica:

1. `extraction` (se `supports_extraction=true`)
2. `generation` (step-by-step o single-step)
3. `save` (persist artifact terminale + audit/quota)

In assenza di extraction (`supports_extraction=false`), il flusso parte da generation ma deve mantenere stessi contratti di save e tracciamento.

Mapping obbligatorio per tool nuovo:

- `tool_key -> workflow_type` (1:1)
- `tool_key -> artifact_type` (N:1 ammesso)
- `tool_key -> generation_endpoint`
- `tool_key -> default_output_format`

Invarianti pipeline:

- Ogni output di generation deve essere salvato con `artifact_type` e `workflow_type` coerenti col registry.
- Nessun save terminale senza `workflow_type` valorizzato per tool-specific flows.
- `workflow_type` puo essere `null` solo per flow generic non associati a un tool registrato.
- Gli eventi SSE `start/complete/error` devono includere `workflowType` coerente con registry.
- In multi-step generation, ogni step completato deve tracciare `artifact_id` per resume/regenerate.

Esempio mapping minimo:

| tool_key | workflow_type | artifact_type | extraction | step_count |
|---|---|---|---|---|
| funnel_pages | funnel_pages | content | yes | 3 |
| nextland | nextland | content | yes | 2 |
| extraction | extraction | extraction | n/a | 1 |
| my_new_tool | my_new_tool | strategy_report (esempio) | yes/no | variabile |

## 10. Regole di Persistenza e Consistenza

- Artifact creato come `generating` prima dello stream provider.
- Progress flush periodico durante token stream.
- Finalizzazione success:
- status `completed`
- content finale normalizzato
- tokens/cost valorizzati
- completedAt valorizzato
- quotaHistory status `success`

- Finalizzazione failure:
- status `failed`
- failureReason valorizzato
- quotaHistory status `error` o `rate_limited` a seconda del punto di fallimento

- Usage enforcement:
- rate limit check early
- quota check atomica
- incremento monthlyUsed coerente con policy request-level

## 10.1 Vincoli SQL Minimi (Obbligatori)

Vincoli di integrita:

- PK su tutte le tabelle core.
- FK obbligatorie:
- `projects.user_id -> users.id`
- `artifacts.user_id -> users.id`
- `artifacts.project_id -> projects.id`
- `quota_history.user_id -> users.id`

Check constraints minime:

- `users.monthly_quota >= 0`
- `users.monthly_used >= 0`
- `artifacts.input_tokens >= 0`
- `artifacts.output_tokens >= 0`
- `artifacts.cost_usd >= 0`
- `artifacts.status IN ('generating','completed','failed')`
- `quota_history.status IN ('success','error','rate_limited')`

Not null minimi:

- `artifacts.status`, `artifacts.type`, `artifacts.model`, `artifacts.input_json`
- `users.monthly_quota`, `users.monthly_used`
- `quota_history.status`, `quota_history.request_count`, `quota_history.cost_usd`

Unique/index consigliati (minimo operativo):

- indice `artifacts(user_id, created_at DESC)`
- indice `artifacts(project_id, created_at DESC)`
- indice `artifacts(status)`
- indice `artifacts(type)`
- indice `quota_history(user_id, created_at DESC)`
- unique su `request_idempotency(user_id, project_id, endpoint, idempotency_key)`

Regole transazionali:

- finalizzazione success/failure artifact deve avvenire in transazione DB.
- inserimento `quota_history` sul success path nella stessa transazione di finalizzazione.
- update di `users.monthly_used` deve essere atomico con check quota al momento della decisione usage.

Politica monetaria/tokens:

- usare tipo decimal/numeric per `cost_usd` (consigliato `numeric(12,6)`).
- rounding deterministico lato server prima del persist (es. 6 decimali).

Politica stati terminali:

- una volta `artifacts.status = 'completed'` o `'failed'`, vietare ritorno a `generating`.
- `completed_at` valorizzato solo su `completed`.

## 10.2 Matrice Transazioni/Eventi (Server)

| Evento XState | Transazione DB | Tabelle coinvolte | Commit atteso | Rollback su errore |
|---|---|---|---|---|
| REQUEST_RECEIVED | no (solo memoria) | - | n/a | n/a |
| STREAM_START | si (create/update artifact) | artifacts | artifact in `generating` | nessun artifact terminale |
| STREAM_TOKEN | no transazione forte (accumulo buffer) | - | n/a | n/a |
| STREAM_PROGRESS (flush) | update singolo | artifacts | `content` e `streamed_at` aggiornati | mantiene stato precedente |
| STREAM_COMPLETE | si (transazione finale success) | artifacts, quota_history | artifact `completed`, tokens/cost persistiti, quota event `success` | nessuna mutazione parziale |
| STREAM_ERROR | si (transazione finale failure) | artifacts, quota_history | artifact `failed`, failure_reason valorizzata, quota event `error` | stato artifact precedente |
| RATE_LIMITED | si (audit rate-limited) | quota_history | quota event `rate_limited` | nessun side effect ulteriore |
| QUOTA_EXHAUSTED | si (audit quota exhausted) | quota_history | quota event `rate_limited` | nessun side effect ulteriore |
| IDEMPOTENCY_HIT_COMPLETED | no write (read path) | artifacts/request_idempotency | replay stream | n/a |
| IDEMPOTENCY_HIT_CONFLICT | no write (read path) | artifacts/request_idempotency | risposta conflict | n/a |
| CHAIN_EXHAUSTED | si (transazione failure hard) | artifacts, quota_history | artifact `failed`, reason finale persistita | nessuna mutazione parziale |

Matrice aggiornamento usage (request-level):

| Fase | Operazione atomica | Vincolo |
|---|---|---|
| usage_check | verify `monthly_used < monthly_quota` | stessa transazione |
| usage_check success | `monthly_used = monthly_used + 1` | stesso commit del check |
| usage_check fail | nessun incremento | scrittura audit opzionale/coerente |

## 11. Timeouts, Retry, Fallback (As-Is)

Server stream:

- deadline stream configurabile.
- timeout puo portare:
- partial-success (se contenuto utile e policy lo consente)
- failure terminale

Client workflow:

- retry con backoff per errori retryable.
- errori non retryable terminano step con stato error.

Extraction chain:

- tentativi sequenziali con timeout policy.
- fallback reason tracciata (`provider_error`, `parse_failed`, `schema_failed`, `consistency_failed`, `timeout`, ecc.).
- chain exhausted -> hard fail coerente.

## 11.1 Parametri Operativi As-Is (Quantitativi)

Questa sezione riporta le soglie operative attese per equivalenza funzionale.

Streaming generic/tool:

- evento `progress` emesso ogni 20 token.
- flush progress su storage ogni 50 token.
- timeout stream tool funnel/nextland: 270000 ms.
- su timeout provider, path partial-success consentito solo con contenuto utile.
- soglia minima contenuto utile per partial-success generic stream: 120 caratteri trimmed.

Extraction:

- preflight modello: selezione primo attempt con modello disponibile; i modelli non disponibili vengono saltati.
- incremento usage/quota avviene una volta all'ingresso della chain (request-level), non per ogni attempt successivo.
- responseMode `structured`: applica guardie stream/json e validazione parse/schema/consistency.
- responseMode `text`: logica di accettazione piu permissiva.
- in `text`, timeout puo essere accettato se contenuto trimmed >= 120 caratteri.
- in `text`, tentativo non-timeout puo essere accettato se contenuto trimmed >= 40 caratteri.
- idempotency:
- hit su artifact completed -> replay SSE immediato (`start` + `complete`).
- hit su artifact non terminale -> `CONFLICT`.

Terminalita e fallback:

- `completionOutcome` deve distinguere almeno: completed_full, completed_partial, failed_hard.
- `fallbackReason` deve mantenere causa principale dell'esito terminale.
- `timeoutKind` deve essere tracciato quando la chiusura avviene per timeout.

## 12. Output Normalization Rules

- workflow funnel/nextland/extraction: output finale preferito markdown.
- se output provider e JSON parseabile: formattazione leggibile.
- fallback robusto quando parse fallisce.
- generic workflow non tool-based puo restare plain/json in base al contenuto.

## 13. Error Taxonomy Minima

Codici da preservare:

- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- VALIDATION_ERROR
- RATE_LIMIT_EXCEEDED
- SERVICE_UNAVAILABLE
- CONFLICT
- EXTRACTION_FAILED
- INTERNAL_ERROR

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

2. `requestGatewayMachine`
- figlio del root.
- responsabile solo di auth, validation, model availability, ownership e avvio usage.
- non puo parlare col provider.

3. `usageMachine`
- actor dedicato a rate limit, quota, audit di rifiuto e claim request-level.
- deve restituire solo `USAGE_OK`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`.

4. `idempotencyCoordinatorMachine`
- actor dedicato a claim, replay, conflict e finalize release.
- deve eseguire prima dell'avvio provider per tutti i flow che dichiarano idempotency.

5. `streamTransportMachine`
- actor dedicato esclusivamente a provider session, emissione token SSE, timeout, disconnect e terminal event.
- non deve eseguire write SQL dirette.

6. `persistenceBatchMachine`
- actor dedicato a creazione artifact, flush progress, finalizzazione success/failure e quota history success/error.
- riceve eventi dal transport actor ma resta indipendente dal provider.

7. `toolWorkflowMachine`
- actor lato client o shared orchestration.
- interpreta `steps[]`, `dependency_graph`, resume/regenerate.
- non incorpora logica tool-specific hardcoded oltre ai dati di registry.

8. `extractionChainMachine`
- actor specializzato per selection plan, attempt loop, evaluate, soft-accept, escalation e exhausted.
- puo spawnare un `streamTransportMachine` per attempt, ma non deve possedere direttamente logica SSE.

## 14.2 Principio di Separazione Obbligatorio

Separazioni non negoziabili nella nuova codebase:

- `requestGatewayMachine` decide se una richiesta puo partire; non costruisce stream e non persiste output.
- `streamTransportMachine` trasporta token/eventi; non calcola policy quota/idempotency e non scrive audit.
- `persistenceBatchMachine` persiste snapshot e finalizza artifact; non parla mai direttamente col provider.
- `idempotencyCoordinatorMachine` decide replay/conflict/claim; non interpreta prompt o output modello.
- `toolWorkflowMachine` governa solo dipendenze step e resume/regenerate; non esegue gate auth o usage.

Questa separazione ha precedenza sulla replica della logica as-is, perche riduce accoppiamento, rende i test di transizione piu piccoli e permette evoluzione indipendente di streaming, storage e workflow.

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

`usageMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `userId`
  - `artifactType`
  - `workflowType`
- output eventi:
  - `USAGE_GRANTED { requestId, sourceActor, timestamp }`
  - `USAGE_REJECTED { requestId, sourceActor, timestamp, reason }`

`idempotencyCoordinatorMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `userId`
  - `projectId`
  - `workflowType`
  - `idempotencyKey`
- output eventi:
  - `IDEMPOTENCY_CLAIMED { requestId, sourceActor, timestamp }`
  - `IDEMPOTENCY_REPLAY_READY { requestId, sourceActor, timestamp, artifactId, metadata: { content } }`
  - `IDEMPOTENCY_CONFLICT { requestId, sourceActor, timestamp, reason }`

`streamTransportMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `artifactId`
  - `model`
  - `workflowType`
  - `outputFormat`
- output eventi:
  - `STREAM_SESSION_STARTED { requestId, sourceActor, timestamp, artifactId }`
  - `STREAM_CHUNK_RECEIVED { requestId, sourceActor, timestamp, artifactId, metadata: { chunk, sequence } }`
  - `STREAM_HEARTBEAT_DUE { requestId, sourceActor, timestamp, artifactId, metadata: { estimatedTokens, costEstimate } }`
  - `STREAM_TERMINATED_SUCCESS { requestId, sourceActor, timestamp, artifactId }`
  - `STREAM_TERMINATED_FAILURE { requestId, sourceActor, timestamp, artifactId, reason }`

`persistenceBatchMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `artifactId`
  - `artifactType`
  - `workflowType`
  - `contentBuffer`
- output eventi:
  - `PERSISTENCE_FLUSH_COMMITTED { requestId, sourceActor, timestamp, artifactId }`
  - `PERSISTENCE_FINALIZE_SUCCEEDED { requestId, sourceActor, timestamp, artifactId }`
  - `PERSISTENCE_FINALIZE_FAILED { requestId, sourceActor, timestamp, artifactId, reason }`

`toolWorkflowMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `toolKey`
  - `workflowType`
  - `steps`
  - `dependencyGraph`
- output eventi:
  - `WORKFLOW_STEP_UNLOCKED { requestId, sourceActor, timestamp, stepKey }`
  - `WORKFLOW_STEP_COMPLETED { requestId, sourceActor, timestamp, stepKey, artifactId }`

`extractionChainMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `artifactId`
  - `workflowType`
  - `attemptPlan`
- output eventi:
  - `EXTRACTION_ATTEMPT_ACCEPTED { requestId, sourceActor, timestamp, artifactId, attemptIndex }`
  - `EXTRACTION_ATTEMPT_REJECTED { requestId, sourceActor, timestamp, artifactId, attemptIndex, reason }`
  - `EXTRACTION_CHAIN_EXHAUSTED { requestId, sourceActor, timestamp, artifactId, reason }`

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

## 14.8 Transition Table Formale

Le tabelle seguenti sono normative per progettazione avanzata e test model-based.

### 14.8.1 generationSystemMachine

| Current state | Event | Guard / Precondizione | Target state | Actions principali |
|---|---|---|---|---|
| `idle` | `REQUEST_RECEIVED` | request valida, selector registry presente (almeno uno tra `registryVersion` e `registrySnapshotRef`) | `gateway` | `cache request meta`, `reset content/failure`, `set registry selector` |
| `gateway` | `AUTH_OK` | - | `gateway` | `set userId` |
| `gateway` | `VALIDATION_OK` | routing non ambiguo (14.1.1) | `usageAndIdempotency` | `set workflowType`, `set registry selector` |
| `gateway` | `AUTH_FAIL` | - | `failed` | `set failureReason='unauthorized'` |
| `gateway` | `VALIDATION_FAIL` | - | `failed` | `set failureReason=event.reason` |
| `usageAndIdempotency` | `IDEMPOTENCY_REPLAY_READY` | priorita massima su eventi concorrenti | `completed` | `set artifactId`, `set contentBuffer=event.metadata.content` |
| `usageAndIdempotency` | `IDEMPOTENCY_CONFLICT` | se replay non disponibile | `failed` | `set failureReason='idempotency_conflict'` |
| `usageAndIdempotency` | `USAGE_REJECTED` | se nessun replay/conflict gia consumato | `failed` | `set failureReason=event.reason` |
| `usageAndIdempotency` | `USAGE_GRANTED` | se nessun replay/conflict gia consumato | `streaming` | `open stream path` |
| `streaming` | `STREAM_SESSION_STARTED` | - | `streaming` | `set artifactId` |
| `streaming` | `STREAM_CHUNK_RECEIVED` | terminal non raggiunto | `streaming` | `append contentBuffer += event.metadata.chunk` |
| `streaming` | `STREAM_TERMINATED_SUCCESS` | - | `persisting` | `request finalize success` |
| `streaming` | `STREAM_TERMINATED_FAILURE` | - | `failed` | `set failureReason=event.reason` |
| `persisting` | `PERSISTENCE_FINALIZE_SUCCEEDED` | - | `completed` | `set terminal=completed` |
| `persisting` | `PERSISTENCE_FINALIZE_FAILED` | - | `failed` | `set failureReason=event.reason` |
| `completed` | `RESET` | - | `idle` (`reenter: true`) | `clear context volatile` |
| `failed` | `RESET` | - | `idle` (`reenter: true`) | `clear context volatile` |

Nota priorita eventi in `usageAndIdempotency` (deterministica):

1. `IDEMPOTENCY_REPLAY_READY`
2. `IDEMPOTENCY_CONFLICT`
3. `USAGE_REJECTED`
4. `USAGE_GRANTED`

### 14.8.2 usageMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `checking` | invoke `claimUsage` start | input valido con registry selector | `checking` | - |
| `checking` | invoke done | limiti ok + quota ok | `granted` | `USAGE_GRANTED` |
| `checking` | invoke error | rate/quota fail | `rejected` | `USAGE_REJECTED { reason }` |

### 14.8.3 idempotencyCoordinatorMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `checking` | request start | branch deterministic oppure idempotency_scope != `none` | `checking` | - |
| `checking` | existing completed | key trovata + artifact terminale replayable | `replay_ready` | `IDEMPOTENCY_REPLAY_READY` |
| `checking` | existing non terminal | key trovata + artifact non terminale | `conflict` | `IDEMPOTENCY_CONFLICT` |
| `checking` | no existing | key assente in store | `claimed` | `IDEMPOTENCY_CLAIMED` |

### 14.8.4 streamTransportMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `initializing` | stream boot | provider session aperta | `stream_open` | `STREAM_SESSION_STARTED` |
| `stream_open` | first token | terminal open | `streaming_tokens` | `STREAM_CHUNK_RECEIVED` |
| `streaming_tokens` | token chunk | terminal open | `streaming_tokens` | `STREAM_CHUNK_RECEIVED` |
| `streaming_tokens` | heartbeat timer | ogni finestra progress definita | `streaming_tokens` | `STREAM_HEARTBEAT_DUE` |
| `streaming_tokens` | provider complete | - | `closed_success` | `STREAM_TERMINATED_SUCCESS` |
| `stream_open|streaming_tokens` | timeout/disconnect/provider error | - | `closed_failure` | `STREAM_TERMINATED_FAILURE { reason }` |

### 14.8.5 persistenceBatchMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `idle` | `STREAM_CHUNK_RECEIVED` batch threshold | artifactId valorizzato | `flushing` | - |
| `flushing` | DB update ok | - | `idle` | `PERSISTENCE_FLUSH_COMMITTED` |
| `flushing` | DB update error | retry budget disponibile | `flushing` | - |
| `idle` | `STREAM_TERMINATED_SUCCESS` | finalize tx success | `finalized_success` | `PERSISTENCE_FINALIZE_SUCCEEDED` |
| `idle` | `STREAM_TERMINATED_FAILURE` | finalize tx failure path | `finalized_failure` | `PERSISTENCE_FINALIZE_FAILED` |

### 14.8.6 extractionChainMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `attempt_preflight` | attempt selected | model disponibile | `attempt_running` | - |
| `attempt_running` | eval accept | parse/schema/consistency policy ok | `attempt_accept` | `EXTRACTION_ATTEMPT_ACCEPTED` |
| `attempt_running` | eval reject + escalate | retry policy consente escalation | `attempt_escalate` | `EXTRACTION_ATTEMPT_REJECTED` |
| `attempt_escalate` | next attempt available | max attempts non superato | `attempt_preflight` | - |
| `attempt_running|attempt_escalate` | no more attempts | chain exhausted | `chain_exhausted` | `EXTRACTION_CHAIN_EXHAUSTED` |

## 15. Piano Test Completo (Per Non Avere Lacune)

## 15.1 Transition Coverage

- Tutte le transizioni root lifecycle (happy + fail).
- Tutte le uscite terminali streaming (`complete`, `error`, `timeout`, `disconnect`).
- Tutti i path extraction (`accept`, `soft-accept`, `escalate`, `exhausted`).

## 15.2 Guard Coverage

- Ogni guardia con caso true/false.
- Ownership mismatch, model unavailable, quota exceeded.
- Idempotency completed vs conflict.

## 15.3 Contract Coverage

- Error object shape stabile.
- SSE event shape stabile per tutti i tipi evento.
- Ordine evento (`start` precede token, terminal event unico).

## 15.4 Persistence Coverage

- Artifact state transitions consistenti.
- Token/cost persistiti correttamente.
- QuotaHistory coerente con outcome.

## 15.5 Workflow Coverage

- Funnel: optin -> quiz -> vsl con dipendenze.
- NextLand: landing -> thank_you con dipendenza.
- Retry behavior e notice.

## 15.6 Property/Model-based Coverage (Raccomandato)

- Path generation su extractionChainMachine per combinazioni timeout/parse/schema/consistency.
- Assertion: assenza stati terminali ambigui.

## 16. Checklist di Equivalenza Funzionale (Go/No-Go)

Una nuova implementazione e equivalente solo se:

- Rispetta tutti i gate pre-provider nell'ordine corretto.
- Espone stesso contratto errori e SSE.
- Mantiene artifact lifecycle e accounting coerenti.
- Riproduce workflow step-based con dipendenze e retry.
- Riproduce extraction chain con rollout/idempotency/escalation.
- Implementa Tool Registry Contract con mapping obbligatorio `tool_key/workflow_type/artifact_type`.
- Supporta workflow parametrico a step variabili (`active_step_index`, `steps[]`, `dependency_graph`).
- Applica pipeline canonica `extraction -> generation -> save` per ogni tool nuovo.
- Separa esplicitamente `streamTransportMachine`, `persistenceBatchMachine` e `idempotencyCoordinatorMachine`.
- Mantiene l'orchestrazione principale nel root actor XState, non nel route handler/framework.
- Separa formalmente branch `deterministic` e `non_deterministic` con routing esplicito da registry.
- Passa test matrix transizioni/guardie/contratti/persistenza.

## 17. Rischi Residui e Mitigazioni

Rischi:

- Divergenza tra stato stream e stato DB in edge di rete.
- Overlap retry client/server se idempotency incompleta.
- Complessita extraction in assenza di model-based test.

Mitigazioni:

1. Introdurre correlation id obbligatorio su request e artifact.
2. Implementare idempotency forte per endpoint extraction (e opzionalmente tool-step).
3. Aggiungere test model-based e replay test su stream interrotti.
4. Bloccare regressioni con snapshot strutturali delle macchine XState.

## 18. Allegato: Skeleton TypeScript XState v5

```ts
import { setup, assign, createActor, fromPromise } from 'xstate';

type RequestContext = {
  requestId: string;
  userId: string | null;
  projectId: string | null;
  toolKey: string | null;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  workflowType: string | null;
  artifactType: string;
  artifactId: string | null;
  contentBuffer: string;
  failureReason: string | null;
};

type RequestEvent =
  | {
    type: 'REQUEST_RECEIVED';
    requestId: string;
    projectId: string;
    toolKey: string | null;
    artifactType: string;
    model: string;
    input: Record<string, unknown>;
    workflowType?: string | null;
    idempotencyKey?: string;
    registryVersion: string;
    registrySnapshotRef?: string;
  }
  | {
    type: 'REQUEST_RECEIVED';
    requestId: string;
    projectId: string;
    toolKey: string | null;
    artifactType: string;
    model: string;
    input: Record<string, unknown>;
    workflowType?: string | null;
    idempotencyKey?: string;
    registryVersion?: string;
    registrySnapshotRef: string;
  }
  | { type: 'AUTH_OK'; userId: string }
  | { type: 'AUTH_FAIL' }
  | {
    type: 'VALIDATION_OK';
    workflowType: string | null;
    registryVersion: string | null;
    registrySnapshotRef: string | null;
  }
  | { type: 'VALIDATION_FAIL'; reason: string }
  | { type: 'USAGE_GRANTED'; requestId: string; sourceActor: 'usageMachine'; timestamp: string }
  | { type: 'USAGE_REJECTED'; requestId: string; sourceActor: 'usageMachine'; timestamp: string; reason: string }
  | { type: 'IDEMPOTENCY_CLAIMED'; requestId: string; sourceActor: 'idempotencyCoordinatorMachine'; timestamp: string }
  | {
    type: 'IDEMPOTENCY_REPLAY_READY';
    requestId: string;
    sourceActor: 'idempotencyCoordinatorMachine';
    timestamp: string;
    artifactId: string;
    metadata: { content: string };
  }
  | { type: 'IDEMPOTENCY_CONFLICT'; requestId: string; sourceActor: 'idempotencyCoordinatorMachine'; timestamp: string; reason: string }
  | { type: 'STREAM_SESSION_STARTED'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; artifactId: string }
  | {
    type: 'STREAM_CHUNK_RECEIVED';
    requestId: string;
    sourceActor: 'streamTransportMachine';
    timestamp: string;
    artifactId: string;
    metadata: { chunk: string; sequence: number };
  }
  | {
    type: 'STREAM_HEARTBEAT_DUE';
    requestId: string;
    sourceActor: 'streamTransportMachine';
    timestamp: string;
    artifactId: string;
    metadata: { estimatedTokens: { input: number; output: number }; costEstimate: number };
  }
  | { type: 'STREAM_TERMINATED_SUCCESS'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; artifactId: string }
  | { type: 'STREAM_TERMINATED_FAILURE'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; reason: string }
  | { type: 'PERSISTENCE_FLUSH_COMMITTED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; artifactId: string }
  | { type: 'PERSISTENCE_FINALIZE_SUCCEEDED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; artifactId: string }
  | { type: 'PERSISTENCE_FINALIZE_FAILED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; reason: string }
  | { type: 'WORKFLOW_STEP_UNLOCKED'; requestId: string; sourceActor: 'toolWorkflowMachine'; timestamp: string; stepKey: string }
  | {
    type: 'WORKFLOW_STEP_COMPLETED';
    requestId: string;
    sourceActor: 'toolWorkflowMachine';
    timestamp: string;
    stepKey: string;
    artifactId: string;
  }
  | {
    type: 'EXTRACTION_ATTEMPT_ACCEPTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    attemptIndex: number;
  }
  | {
    type: 'EXTRACTION_ATTEMPT_REJECTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    attemptIndex: number;
    reason: string;
  }
  | {
    type: 'EXTRACTION_CHAIN_EXHAUSTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    reason: string;
  }
  | { type: 'RESET' };

const usageMachine = setup({
  types: {
    input: {} as { userId: string },
  },
  actors: {
    claimUsage: fromPromise(async ({ input }) => {
      return { userId: input.userId };
    }),
  },
}).createMachine({
  id: 'usage',
  initial: 'checking',
  states: {
    checking: {
      invoke: {
        src: 'claimUsage',
        input: ({ input }) => input,
        onDone: { target: 'granted' },
        onError: { target: 'rejected' },
      },
    },
    granted: { type: 'final' },
    rejected: { type: 'final' },
  },
});

export const generationSystemMachine = setup({
  types: { context: {} as RequestContext, events: {} as RequestEvent },
  guards: {
    hasReplay: ({ event }) => event.type === 'IDEMPOTENCY_REPLAY_READY',
  },
}).createMachine({
  id: 'generation-system',
  initial: 'idle',
  context: {
    requestId: '',
    userId: null,
    projectId: null,
    toolKey: null,
    registryVersion: null,
    registrySnapshotRef: null,
    workflowType: null,
    artifactType: 'content',
    artifactId: null,
    contentBuffer: '',
    failureReason: null,
  },
  states: {
    idle: {
      on: {
        REQUEST_RECEIVED: {
          target: 'gateway',
          actions: assign(({ event }) => ({
            requestId: event.requestId,
            projectId: event.projectId,
            toolKey: event.toolKey,
            registryVersion: event.registryVersion ?? null,
            registrySnapshotRef: event.registrySnapshotRef ?? null,
            artifactType: event.artifactType,
            contentBuffer: '',
            failureReason: null,
          })),
        },
      },
    },
    gateway: {
      on: {
        AUTH_OK: { actions: assign(({ event }) => ({ userId: event.userId })) },
        VALIDATION_OK: {
          target: 'usageAndIdempotency',
          actions: assign(({ event }) => ({
            workflowType: event.workflowType,
            registryVersion: event.registryVersion,
            registrySnapshotRef: event.registrySnapshotRef,
          })),
        },
        AUTH_FAIL: 'failed',
        VALIDATION_FAIL: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    usageAndIdempotency: {
      on: {
        USAGE_GRANTED: 'streaming',
        USAGE_REJECTED: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
        IDEMPOTENCY_REPLAY_READY: {
          target: 'completed',
          actions: assign(({ event }) => ({
            artifactId: event.artifactId,
            contentBuffer: event.metadata.content,
          })),
        },
        IDEMPOTENCY_CONFLICT: {
          target: 'failed',
          actions: assign({ failureReason: 'idempotency_conflict' }),
        },
      },
    },
    streaming: {
      on: {
        STREAM_SESSION_STARTED: {
          actions: assign(({ event }) => ({ artifactId: event.artifactId })),
        },
        STREAM_CHUNK_RECEIVED: {
          actions: assign(({ context, event }) => ({
            contentBuffer: context.contentBuffer + event.metadata.chunk,
          })),
        },
        STREAM_TERMINATED_SUCCESS: 'persisting',
        STREAM_TERMINATED_FAILURE: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    persisting: {
      on: {
        PERSISTENCE_FINALIZE_SUCCEEDED: 'completed',
        PERSISTENCE_FINALIZE_FAILED: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    completed: {
      on: {
        RESET: { target: 'idle', reenter: true },
      },
    },
    failed: {
      on: {
        RESET: { target: 'idle', reenter: true },
      },
    },
  },
});

export const generationSystemActor = createActor(generationSystemMachine);
```

## 19. Allegato: Contratto Tipi Artifact (Sintetico, Normativo)

Sorgente canonica implementativa:

- [src/lib/types/artifact.ts](../../src/lib/types/artifact.ts)

Tipi normativi minimi da preservare:

```ts
export type ArtifactType = 'content' | 'seo' | 'code' | 'extraction';
export type ArtifactStatus = 'generating' | 'completed' | 'failed';
export type ArtifactFailureReason = 'client_disconnect' | 'timeout' | 'error' | 'stale';

export type ToolWorkflow = 'meta_ads' | 'funnel_pages' | 'nextland' | 'extraction';
export type QuotaEventStatus = 'success' | 'error' | 'rate_limited';
export type OutputFormat = 'plain' | 'json' | 'markdown';
```

Validatori richiesti (firma minima):

```ts
export declare function isArtifactType(value: unknown): value is ArtifactType;
export declare function isArtifactStatus(value: unknown): value is ArtifactStatus;
export declare function isToolWorkflow(value: unknown): value is ToolWorkflow;
export declare function isQuotaEventStatus(value: unknown): value is QuotaEventStatus;
export declare function isOutputFormat(value: unknown): value is OutputFormat;
```

Nota contract-first:

- Le seed enum sopra sono baseline as-is.
- I valori registry-backed aperti nel tempo sono governati dal Tool Registry (sezione 4.4).

## 20. Allegato: Contratto Tipi XState Shared (Sintetico, Normativo)

Sorgente canonica implementativa:

- [src/lib/types/xstate.ts](../../src/lib/types/xstate.ts)

Alias e selector per-request (obbligatori):

```ts
import type { ArtifactType, OutputFormat, ToolWorkflow } from '@/lib/types/artifact';

export type IsoTimestamp = string;

export type RegistryBackedArtifactType = ArtifactType | (string & {});
export type RegistryBackedWorkflowType = ToolWorkflow | (string & {}) | null;
export type RegistryBackedToolKey = ToolWorkflow | (string & {});

export type ToolRegistryVersion = string & {};
export type ToolRegistrySnapshotRef = string & {};

export type RequestRegistrySelector =
  | { registryVersion: ToolRegistryVersion; registrySnapshotRef?: ToolRegistrySnapshotRef }
  | { registryVersion?: ToolRegistryVersion; registrySnapshotRef: ToolRegistrySnapshotRef };
```

Envelope eventi actor-to-actor (obbligatorio):

```ts
export type GenerationActorSource =
  | 'generationSystemMachine'
  | 'requestGatewayMachine'
  | 'usageMachine'
  | 'idempotencyCoordinatorMachine'
  | 'streamTransportMachine'
  | 'persistenceBatchMachine'
  | 'toolWorkflowMachine'
  | 'extractionChainMachine';

export interface GenerationActorEventEnvelope<TType extends string, TSource extends GenerationActorSource> {
  type: TType;
  requestId: string;
  sourceActor: TSource;
  timestamp: IsoTimestamp;
}
```

Contesto root (minimo richiesto):

```ts
export interface GenerationSystemContext {
  requestId: string;
  userId: string | null;
  projectId: string | null;
  toolKey: RegistryBackedToolKey | null;
  registryVersion: ToolRegistryVersion | null;
  registrySnapshotRef: ToolRegistrySnapshotRef | null;
  workflowType: RegistryBackedWorkflowType;
  artifactType: RegistryBackedArtifactType;
  artifactId: string | null;
  contentBuffer: string;
  failureReason: string | null;
}
```

Input actor (shape normativa):

```ts
export type WorkflowRunMode = 'new' | 'resume' | 'regenerate';
export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';
export type ExtractionResponseMode = 'structured' | 'text';

export type UsageActorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
};

export type IdempotencyCoordinatorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  projectId: string;
  workflowType: RegistryBackedWorkflowType;
  idempotencyKey: string;
};

export type StreamTransportInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  model: string;
  workflowType: RegistryBackedWorkflowType;
  outputFormat: OutputFormat;
};

export type PersistenceBatchInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
  contentBuffer: string;
};
```

Famiglie evento normative (unioni da mantenere):

```ts
export type GenerationSystemEvent =
  | RequestReceivedEvent
  | AuthOkEvent
  | AuthFailEvent
  | ValidationOkEvent
  | ValidationFailEvent
  | GenerationChildActorEvent
  | ResetEvent;
```

Nota contract-first:

- Questo allegato definisce il minimo normativo.
- I dettagli completi (tutte le interfacce ed eventi specifici) restano nei sorgenti canonici linkati sopra.
