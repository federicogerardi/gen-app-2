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
- output eventi (output XState della macchina — solo stati final):
  - `PERSISTENCE_FINALIZE_SUCCEEDED { requestId, sourceActor, timestamp, artifactId }` — emesso da stato `finalizedSuccess`
  - `PERSISTENCE_FINALIZE_FAILED { requestId, sourceActor, timestamp, artifactId, reason }` — emesso da stato `finalizedFailure`

Nota: `PERSISTENCE_FLUSH_COMMITTED` NON è un output XState della macchina ma una factory function esportata (`createPersistenceFlushCommittedEvent`) da usare esternamente durante il flush. Il flush interno non emette output XState, torna nello stato `idle`.
### 14.8.5 persistenceBatchMachine (child critico)

Stati reali: `idle`, `flushing`, `finalizingSuccess`, `finalizingFailure`, `finalizedSuccess` (final), `finalizedFailure` (final).

Flushing threshold: `event.metadata.sequence % 10 === 0` (guard `shouldFlush`).

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `idle` | `STREAM_CHUNK_RECEIVED` | `shouldFlush` (sequence % 10 = 0) | `flushing` | `cacheSequence` |
| `flushing` | invoke `flushProgress` done | - | `idle` | `resetFlushRetries` (nessun output XState) |
| `flushing` | invoke error | `canRetryFlush` (retries < 3) | `flushing` (reenter) | `incrementFlushRetries` |
| `flushing` | invoke error | budget esaurito | `finalizingFailure` | `setFlushFailureReason` |
| `flushing` | `RETRY_FLUSH` | - | `flushing` (reenter) | - |
| `idle` | `STREAM_TERMINATED_SUCCESS` | - | `finalizingSuccess` | - |
| `idle` | `STREAM_TERMINATED_FAILURE` | - | `finalizingFailure` | `cacheFailureReason` |
| `finalizingSuccess` | invoke `finalizeSuccess` done | - | `finalizedSuccess` | `PERSISTENCE_FINALIZE_SUCCEEDED` |
| `finalizingFailure` | invoke `finalizeFailure` done/error | - | `finalizedFailure` | `PERSISTENCE_FINALIZE_FAILED` |

