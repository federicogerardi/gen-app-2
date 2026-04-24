3. `usageMachine`
- actor dedicato a rate limit, quota, audit di rifiuto e claim request-level.
- deve restituire solo `USAGE_GRANTED`, `USAGE_REJECTED` (con `reason` tipicamente `rate_limited` o `quota_exhausted`).
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

### 14.8.2 usageMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `checking` | invoke `claimUsage` start | input valido con registry selector | `checking` | - |
| `checking` | invoke done | limiti ok + quota ok | `granted` | `USAGE_GRANTED` |
| `checking` | invoke error | rate/quota fail | `rejected` | `USAGE_REJECTED { reason }` |

