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