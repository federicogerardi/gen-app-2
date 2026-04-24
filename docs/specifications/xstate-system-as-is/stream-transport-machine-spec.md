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

5. `streamTransportMachine`
- actor dedicato esclusivamente a provider session, emissione token SSE, timeout, disconnect e terminal event.
- non deve eseguire write SQL dirette.
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

### 14.8.4 streamTransportMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `initializing` | stream boot | provider session aperta | `stream_open` | `STREAM_SESSION_STARTED` |
| `stream_open` | first token | terminal open | `streaming_tokens` | `STREAM_CHUNK_RECEIVED` |
| `streaming_tokens` | token chunk | terminal open | `streaming_tokens` | `STREAM_CHUNK_RECEIVED` |
| `streaming_tokens` | heartbeat timer | ogni finestra progress definita | `streaming_tokens` | `STREAM_HEARTBEAT_DUE` |
| `streaming_tokens` | provider complete | - | `closed_success` | `STREAM_TERMINATED_SUCCESS` |
| `stream_open|streaming_tokens` | timeout/disconnect/provider error | - | `closed_failure` | `STREAM_TERMINATED_FAILURE { reason }` |

