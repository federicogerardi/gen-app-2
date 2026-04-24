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
- USAGE_GRANTED | USAGE_REJECTED
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

