# Frontend SSE UI Ready-to-Build Mini Spec

Versione: 1.1
Data: 2026-04-24
Scope: implementazione frontend consumatrice del runtime SSE as-is

## 1. Obiettivo

Definire una specifica minima ma eseguibile per costruire il frontend di generazione con stream live.

Output richiesti da questa spec:

- contratto consumabile del flusso SSE esterno
- state model UI XState v5 per ciclo `start/chunk/terminal`
- policy operativa di error handling e reconnect

## 2. Contratto SSE Consumabile

## 2.1 Envelope SSE

Formato frame server:

```text
event: <name>
data: <json>

```

Eventi esterni ammessi:

- `start`
- `chunk`
- `terminal`

## 2.2 Payload Evento

`start`

```json
{
  "requestId": "string",
  "artifactId": "string"
}
```

`chunk`

```json
{
  "artifactId": "string",
  "chunk": "string",
  "sequence": 1
}
```

`terminal`

```json
{
  "artifactId": "string|null",
  "status": "completed|failed",
  "reason": "string|null"
}
```

## 2.3 Invarianti Contrattuali

- `start` precede sempre i `chunk`.
- `start.requestId` deve coincidere con la request attiva aperta dalla UI.
- tutti i `chunk` validi devono riferirsi allo stesso `artifactId` annunciato da `start`.
- `chunk.sequence` e monotonicamente crescente per singolo stream.
- `terminal` e unico e chiude semanticamente lo stream; se include `artifactId`, deve coincidere con quello attivo.
- dopo `terminal` ogni frame successivo va ignorato lato UI.
- mismatch di `requestId` o `artifactId`, oppure ordine frame invalido, devono produrre `protocol_error` fail-closed.

## 2.4 Tipi TypeScript Frontend

```ts
export type UiSseEvent =
  | { event: 'start'; data: { requestId: string; artifactId: string } }
  | { event: 'chunk'; data: { artifactId: string; chunk: string; sequence: number } }
  | {
      event: 'terminal';
      data: {
        artifactId: string | null;
        status: 'completed' | 'failed';
        reason: string | null;
      };
    };
```

## 2.5 Parser Raccomandato

- Se endpoint frontend usa `GET` senza body: possibile `EventSource` nativo.
- Se endpoint richiede `POST` con payload: usare `fetch` + stream parser SSE.
- Ogni frame deve essere validato prima di inviare evento alla state machine.

## 3. State Model UI (XState v5)

## 3.1 Diagnosi Problema UI

La UI deve gestire in modo deterministico:

- avvio request
- accumulo chunk incrementali
- terminalita positiva/negativa
- interruzioni rete con reconnect controllato

Il route handler non deve contenere logica di stato UI: la source of truth e la macchina client.

## 3.2 Architettura Proposta

Un actor principale `frontendStreamMachine` con topologia as-is:

- `idle`
- `active` (compound)
  - `connecting`
  - `streaming`
  - `reconnecting`
- `completed`
- `failed`

## 3.3 Eventi UI

- `REQUEST_START`
- `SSE_START`
- `SSE_CHUNK`
- `SSE_TERMINAL`
- `STREAM_ERROR`
- `RECONNECT_TIMEOUT`
- `CANCEL`
- `RETRY`
- `RESET`

## 3.4 Context UI Minimo

```ts
type FrontendStreamContext = {
  requestId: string | null;
  artifactId: string | null;
  content: string;
  lastSequence: number;
  errorCode: string | null;
  errorMessage: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  hasTerminal: boolean;
  lastRequest: GenerationRequest | null;
  apiBaseUrl: string;
};
```

## 3.5 Transizioni Normative

- `idle` + `REQUEST_START` -> `active.connecting`
- `active.connecting` + `SSE_START(requestId coerente)` -> `active.streaming`
- `active.streaming` + `SSE_CHUNK(sequence monotona + artifact coerente)` -> `active.streaming` (append, update sequence)
- `active` + `SSE_TERMINAL(status=completed, artifact coerente)` -> `completed`
- `active` + `SSE_TERMINAL(status=failed, artifact coerente)` -> `failed`
- `active.connecting|active.streaming` + `STREAM_ERROR` -> `active.reconnecting` (se retryabile)
- `active.reconnecting` + delay di reconnect -> `active.connecting` (nuovo tentativo)
- `reconnecting` + tentativi esauriti -> `failed`
- `completed|failed` + `RESET` -> `idle`
- `active` + frame protocollo invalido -> `failed` con `errorCode='protocol_error'`

## 3.6 Guardie e Azioni Raccomandate

Guardie:

- `isExpectedStartEvent`: `event.requestId === context.requestId`
- `isMonotonicSequence`: `event.sequence > context.lastSequence`
- `isChunkForActiveArtifact`: sequence monotona e `event.artifactId === context.artifactId`
- `isTerminalForActiveArtifact`: `event.artifactId == null || event.artifactId === context.artifactId`
- `canReconnect`: `context.reconnectAttempts < context.maxReconnectAttempts`
- `isRetryableTransportError`: timeout/disconnect/network reset

Azioni:

- `cacheStartMeta`
- `appendChunk`
- `setTerminalSuccess`
- `setTerminalFailure`
- `setProtocolError`
- `incrementReconnectAttempts`
- `resetStreamContext`

Vincolo XState v5:

- niente side effects dentro `assign`
- side effects stream/reconnect in actor logic (`fromCallback`, `fromPromise`)

## 4. Error Handling e Reconnect Policy

## 4.1 Classificazione Errori

- `transport_pre_start`: errore prima di `SSE_START`
- `transport_mid_stream`: errore dopo almeno un `chunk`
- `protocol_error`: frame non valido, `requestId` mismatch, `artifactId` mismatch o sequence non monotona
- `terminal_failed`: `SSE_TERMINAL` con `status=failed`

## 4.2 Politica Reconnect

Policy default consigliata:

- max tentativi: `3`
- backoff: esponenziale con jitter
- base delay: `500ms`
- max delay: `4000ms`

Formula suggerita:

$$
delay_n = min(4000, 500 * 2^n) + jitter(0..250)
$$

Regole:

- reconnect solo su errori retryable.
- nessun reconnect dopo `terminal` ricevuto.
- su reconnect, riusare stesso `requestId` e `idempotencyKey` lato API quando disponibile.
- se stream non supporta resume, la UI deve ripartire da richiesta nuova e mostrare avviso utente.

## 4.3 UX Failure Policy

Messaggi minimi UI:

- Tentativo di riconnessione in corso con contatore.
- Errore finale con reason normalizzata.
- Azioni disponibili: `Riprova`, `Copia errore`, `Reset`.

## 5. Ready-to-Build Checklist

Una feature frontend e pronta quando:

- parser SSE gestisce `start/chunk/terminal` con validazione schema
- macchina UI implementa transizioni normative della sezione 3.5
- reconnect policy implementata con limiti e jitter
- test coprono:
  - ordine eventi
  - coerenza `requestId` su `start`
  - coerenza `artifactId` su `chunk` e `terminal`
  - monotonicita sequence
  - terminal success/failure
  - reconnect con tentativi esauriti

## 6. Riferimenti Implementativi

- runtime stream helper: `src/lib/runtime/index.ts`
- adapter HTTP SSE Node: `src/lib/runtime/http-sse.ts`
- contratto stream serializzato: `src/lib/runtime/stream-contract.ts`
- contratti tipi actor/server: `src/lib/types/xstate.ts`
