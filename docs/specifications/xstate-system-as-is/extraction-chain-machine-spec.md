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

8. `extractionChainMachine`
- actor specializzato per selection plan, attempt loop, evaluate, soft-accept, escalation e exhausted.
- puo spawnare un `streamTransportMachine` per attempt, ma non deve possedere direttamente logica SSE.
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

### 14.8.6 extractionChainMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `attempt_preflight` | attempt selected | model disponibile | `attempt_running` | - |
| `attempt_running` | eval accept | parse/schema/consistency policy ok | `attempt_accept` | `EXTRACTION_ATTEMPT_ACCEPTED` |
| `attempt_running` | eval reject + escalate | retry policy consente escalation | `attempt_escalate` | `EXTRACTION_ATTEMPT_REJECTED` |
| `attempt_escalate` | next attempt available | max attempts non superato | `attempt_preflight` | - |
| `attempt_running|attempt_escalate` | no more attempts | chain exhausted | `chain_exhausted` | `EXTRACTION_CHAIN_EXHAUSTED` |

