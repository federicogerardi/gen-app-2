## 6.2 Streaming Machine (Server)

Stati (as-is implementazione — nomi camelCase):

- `initializing` — apre la sessione provider via invoke `openStreamSession`
- `streamOpen` — sessione aperta; controlla guard bootstrap (failureReason/autoComplete) e fallback a stream live
- `streamingTokens` — invoca actor LLM (`streamLlmResponse`) e riceve chunk, heartbeat, timeout, disconnect
- `closedSuccess` (final) — emette `STREAM_TERMINATED_SUCCESS`
- `closedFailure` (final) — emette `STREAM_TERMINATED_FAILURE`

Stati descritti nella spec originale ma NON presenti nell'implementazione:
`progress_flushing`, `normalizing_output`, `terminal_emit_complete`, `terminal_emit_error`, `closed`.
Queste responsabilità sono delegate a `persistenceBatchMachine`.

Regole:

- Su `initializing` onDone: transizione a `streamOpen`, caching `sessionId`.
- `streamOpen` ha guard `always`: se `bootstrap.failureReason` -> `closedFailure`; se `bootstrap.autoComplete` -> `closedSuccess`; altrimenti `streamingTokens`.
- Su complete: terminazione diretta in `closedSuccess`.
- Su errore non recuperabile: terminazione in `closedFailure`.
- Su client disconnect: impostare `reason='client_disconnect'` e andare in `closedFailure`.

5. `streamTransportMachine`
- actor dedicato esclusivamente a provider session, trasporto chunk/eventi stream interni, timeout, disconnect e terminal event.
- non deve eseguire write SQL dirette.
`streamTransportMachine`

- input:
  - `requestId`
  - `registryVersion | registrySnapshotRef`
  - `artifactId`
  - `model`
  - `requestInput`
  - `workflowType`
  - `outputFormat`
- output eventi (output XState della macchina — solo stati final):
  - `STREAM_TERMINATED_SUCCESS { requestId, sourceActor, timestamp, artifactId, content?, metrics? }` — emesso da stato `closedSuccess`
  - `STREAM_TERMINATED_FAILURE { requestId, sourceActor, timestamp, artifactId, reason, content?, metrics? }` — emesso da stato `closedFailure`

Nota: `STREAM_SESSION_STARTED`, `STREAM_CHUNK_RECEIVED`, `STREAM_HEARTBEAT_DUE` NON sono output XState della macchina ma factory function esportate (`createStreamSessionStartedEvent`, etc.) da usare esternamente.

### 14.8.4 streamTransportMachine (child critico)

| Current state | Event / Trigger | Guard / Precondizione | Target state | Output evento |
|---|---|---|---|---|
| `initializing` | invoke `openStreamSession` done | - | `streamOpen` | `cacheSessionId` |
| `initializing` | invoke error | - | `closedFailure` | `setSessionOpenFailureReason` |
| `initializing` | `STREAM_READY` | - | `streamOpen` | - |
| `initializing` | `STREAM_FAIL` | - | `closedFailure` | `setFailureReason` |
| `streamOpen` | always | `bootstrap.failureReason` | `closedFailure` | `setBootstrapFailureReason` |
| `streamOpen` | always | `bootstrap.autoComplete` | `closedSuccess` | - |
| `streamOpen` | always | default | `streamingTokens` | - |
| `streamOpen` | `STREAM_CHUNK` | - | `streamingTokens` | `incrementSequence`, `cacheChunk` |
| `streamOpen` | `STREAM_COMPLETE` | - | `closedSuccess` | - |
| `streamOpen` | `STREAM_FAIL/TIMEOUT/CLIENT_DISCONNECT` | - | `closedFailure` | `setFailureReason` |
| `streamingTokens` | invoke `streamLlmResponse` | - | `streamingTokens` | produce `STREAM_CHUNK/STREAM_HEARTBEAT/STREAM_COMPLETE/STREAM_FAIL` |
| `streamingTokens` | `STREAM_CHUNK` | - | `streamingTokens` | `incrementSequence`, `cacheChunk`, `appendGeneratedChunk` |
| `streamingTokens` | `STREAM_HEARTBEAT` | - | `streamingTokens` | `cacheUsageMetrics` |
| `streamingTokens` | `STREAM_COMPLETE` | - | `closedSuccess` | - |
| `streamingTokens` | `STREAM_FAIL/TIMEOUT/CLIENT_DISCONNECT` | - | `closedFailure` | `setFailureReason` |
| `closedSuccess` | final | - | - | `STREAM_TERMINATED_SUCCESS { content?, metrics? }` |
| `closedFailure` | final | - | - | `STREAM_TERMINATED_FAILURE { reason, content?, metrics? }` |

