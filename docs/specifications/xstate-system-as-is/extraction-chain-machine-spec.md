## 6.4 Extraction Chain Machine (Server)

Stati (as-is implementazione — nomi camelCase):

- `preflight` — always: verifica `hasAvailableAttempt`, altrimenti `chainExhausted`
- `attemptPreflight` — always: guard `shouldAutoAccept` -> `attemptAccept`; `hasAvailableAttempt` -> `attemptRunning`; altrimenti `chainExhausted`
- `attemptRunning` — attende eventi `ATTEMPT_ACCEPTED`, `ATTEMPT_REJECTED`, `ATTEMPT_HARD_FAIL`
- `attemptAccept` (final) — emette `EXTRACTION_ATTEMPT_ACCEPTED`
- `attemptEscalate` — always: `canEscalateAttempt` -> `attemptPreflight` (incrementa indice); altrimenti `chainExhausted`
- `chainExhausted` (final) — emette `EXTRACTION_CHAIN_EXHAUSTED`
- `failedHard` (final) — emette `EXTRACTION_ATTEMPT_REJECTED`

Stati descritti nella spec originale ma NON presenti nell'implementazione:
`rollout_gate`, `idempotency_check`, `attempt_evaluate`, `attempt_replay_or_finalize`, `completed`.

Comportamento chiave:

- Attempt plan definito in input come array `attemptPlan`; `currentAttemptIndex` segue il progresso.
- `shouldAutoAccept`: se `bootstrap.autoAccept === true`, accetta direttamente senza passare per `attemptRunning`.
- Escalation finché `canEscalateAttempt`; poi `chainExhausted`.
- Hard fail: va direttamente in `failedHard` senza escalation.
- Reset globale tramite evento `RESET` (root-level `on`, `reenter: true`).

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
| `preflight` | always | `hasAvailableAttempt` | `attemptPreflight` | - |
| `preflight` | always | nessun attempt | `chainExhausted` | `EXTRACTION_CHAIN_EXHAUSTED` |
| `attemptPreflight` | always | `shouldAutoAccept` | `attemptAccept` | `EXTRACTION_ATTEMPT_ACCEPTED` |
| `attemptPreflight` | always | `hasAvailableAttempt` | `attemptRunning` | - |
| `attemptPreflight` | always | nessun attempt | `chainExhausted` | `EXTRACTION_CHAIN_EXHAUSTED` |
| `attemptRunning` | `ATTEMPT_ACCEPTED` | - | `attemptAccept` | `EXTRACTION_ATTEMPT_ACCEPTED` |
| `attemptRunning` | `ATTEMPT_REJECTED` | - | `attemptEscalate` | `setFailureReason` |
| `attemptRunning` | `ATTEMPT_HARD_FAIL` | - | `failedHard` | `EXTRACTION_ATTEMPT_REJECTED` |
| `attemptEscalate` | always | `canEscalateAttempt` | `attemptPreflight` | `incrementAttemptIndex` |
| `attemptEscalate` | always | no more attempts | `chainExhausted` | `EXTRACTION_CHAIN_EXHAUSTED` |
| root | `RESET` | - | `.preflight` (`reenter: true`) | `resetAttemptState` |

