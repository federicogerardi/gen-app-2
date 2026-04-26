4. `idempotencyCoordinatorMachine`
- actor dedicato a claim, replay, conflict e finalize release.
- deve eseguire prima dell'avvio provider per tutti i flow che dichiarano idempotency.
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

### 14.8.3 idempotencyCoordinatorMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `checking` | request start | branch deterministic oppure idempotency_scope != `none` | `checking` | - |
| `checking` | existing completed | key trovata + artifact terminale replayable | `replay_ready` | `IDEMPOTENCY_REPLAY_READY` |
| `checking` | existing non terminal | key trovata + artifact non terminale | `conflict` | `IDEMPOTENCY_CONFLICT` |
| `checking` | no existing | key assente in store | `claimed` | `IDEMPOTENCY_CLAIMED` |

