6. `persistenceBatchMachine`
- actor dedicato a creazione artifact, flush progress, finalizzazione success/failure e quota history success/error.
- riceve eventi dal transport actor ma resta indipendente dal provider.
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
### 14.8.5 persistenceBatchMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `idle` | `STREAM_CHUNK_RECEIVED` batch threshold | artifactId valorizzato | `flushing` | - |
| `flushing` | DB update ok | - | `idle` | `PERSISTENCE_FLUSH_COMMITTED` |
| `flushing` | DB update error | retry budget disponibile | `flushing` | - |
| `idle` | `STREAM_TERMINATED_SUCCESS` | finalize tx success | `finalized_success` | `PERSISTENCE_FINALIZE_SUCCEEDED` |
| `idle` | `STREAM_TERMINATED_FAILURE` | finalize tx failure path | `finalized_failure` | `PERSISTENCE_FINALIZE_FAILED` |

