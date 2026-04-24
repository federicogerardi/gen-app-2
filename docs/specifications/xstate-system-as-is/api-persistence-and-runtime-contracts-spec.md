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

- 200 SSE stream (start/chunk/terminal)
- 4xx/5xx con error object canonico

Contratto SSE as-is (runtime attuale):

- evento `start` con `requestId`, `artifactId`
- eventi `chunk` incrementali con `artifactId`, `chunk`, `sequence`
- evento terminale `terminal` con `artifactId`, `status` (`completed|failed`), `reason`

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
- Gli eventi SSE esterni `start/chunk/terminal` devono restare coerenti con il contesto request-level del registry.
- In multi-step generation, ogni step completato deve tracciare `artifact_id` per resume/regenerate.

Esempio mapping minimo:

| tool_key | workflow_type | artifact_type | extraction | step_count |
|---|---|---|---|---|
| funnel_pages | funnel_pages | content | yes | 3 |
| nextland | nextland | content | yes | 2 |
| extraction | extraction | extraction | n/a | 1 |
| my_new_tool | my_new_tool | strategy_report (esempio) | yes/no | variabile |

## 9.6 Runtime Helper As-Is (Node)

Surface runtime attuale per stream:

- `runBackendGenerationSession(...)`: orchestration root + raccolta eventi stream incrementali
- `handleGenerationRequest(...)`: ritorna payload SSE aggregato finale
- `handleGenerationRequestAsSseStream(...)`: ritorna `AsyncIterable<string>` di frame SSE live
- `handleGenerationRequestAsNodeSse(...)`: pipe diretto su `ServerResponse` con chiusura automatica
- `applySseHeaders(...)`, `pipeSseStreamToNodeResponse(...)`: adapter HTTP SSE riusabile

Nota operativa:

- Il provider LLM as-is e OpenRouter tramite `OPENROUTER_API_KEY`.
- In assenza di chiave, il runtime mantiene fallback sintetico per compatibilita test/offline.

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

- eventi SSE esterni limitati a `start/chunk/terminal`.
- progress/heartbeat e usage restano segnali interni al transport actor.
- flush progress su storage ogni 10 chunk (`sequence % 10 === 0`).
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

