# Streaming Generator Debug Guide

Complete debugging infrastructure for multi-step LLM generation streaming with XState v5.

## Architecture

### 1. **Stream Logger** (`src/features/generation/runtime/stream-logger.ts`)

Structured event logging with timing and filtering capabilities:

```typescript
import { createStreamLogger } from './stream-logger';

const logger = createStreamLogger();

// Log events
logger.log('info', 'STREAM_STARTED', {
  requestId: 'req-1',
  artifactId: 'art-1',
});

// Time operations
logger.startTimer('operation-key');
// ... do work ...
logger.endTimer('operation-key', 'OPERATION_COMPLETE', context);

// Query logs
logger.getLogs();                          // All logs
logger.getLogsByLevel('error');            // By level
logger.getLogsByRequestId('req-1');        // By request
logger.dump();                             // Console.table()
```

**Typical Log Flow:**
```
REQUEST_SENT → STREAM_STARTED → CHUNK_* → STREAM_COMPLETED/FAILED → (RECONNECT attempts)
```

### 2. **MSW Handlers** (`src/test/mocks/stream-handlers.ts`)

Mock Service Worker handlers for different streaming scenarios:

```typescript
import { CreateStreamHandler, streamHandlers } from './mocks/stream-handlers';

// Success scenario (3-step generation)
streamHandlers.success

// Failure + terminal_failed
streamHandlers.failure

// Sequence corruption (jump: 1→3)
streamHandlers.malformedSequence

// Network timeout (no terminal event)
streamHandlers.timeout

// HTTP error during fetch
streamHandlers.networkError
```

**Usage in tests:**
```typescript
import { useMswHandler } from './mocks/server';

beforeEach(() => {
  useMswHandler(streamHandlers.success);
});
```

### 3. **Test Suites**

#### Happy Path
- Multi-step chunks processed in sequence
- Content accumulation across steps
- Logging progression with timestamps
- Completion with all data preserved

#### Failure Scenarios
- **Terminal Failed**: LLM errors with reason messages
- **Protocol Errors**: Non-retryable frame corruption
- **Reconnect Exhaustion**: Exponential backoff timeout
- **Partial Content**: Preserves what was received before failure

#### Edge Cases
- Unicode/emoji in streaming content
- Large payloads (>100KB chunks)
- Terminal events with null artifactId
- Context reset from terminal states

#### Context Snapshots
- State integrity verification
- Error detail preservation
- Terminal flag consistency

## Running Tests

```bash
# All streaming tests
npm --prefix frontend run test -- frontend-stream.machine.test.ts

# Watch mode for development
npm --prefix frontend run test -- --watch frontend-stream.machine.test.ts

# Verbose output
npm --prefix frontend run test -- --reporter=verbose frontend-stream.machine.test.ts

# Coverage
npm --prefix frontend run test -- --coverage src/features/generation/
```

## Debug Checklist

### During Development

- [ ] Verify sequence monotonicity (1→2→3, not 1→3)
- [ ] Track artifactId consistency across events
- [ ] Check chunk content accumulation
- [ ] Validate error codes and messages

### Before Release

- [ ] Run full test suite (`npm run test`)
- [ ] Verify no flaky assertions on timing-dependent tests
- [ ] Check logger output for spurious errors
- [ ] Test on slow networks (timeout scenarios)

## Debugging Live Streams

Add logging to the active machine:

```typescript
// In generation-client.ts onEvent callback
onEvent: (event) => {
  if (import.meta.env.DEV) {
    console.group(`[Stream] ${event.event}`);
    console.log('Event:', event);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  }
  // ... existing handler ...
}
```

Use browser DevTools:
1. **Console**: Filter by `[Stream]` prefix
2. **Network**: Monitor `/generation/stream` with chunked responses
3. **Performance**: Check frame rate during streaming
4. **XState Inspector**: Visualize state machine transitions (requires `@statelyai/xstate-inspector`)

## Common Issues

### Sequence Breach Detected
Problem: `errorCode: 'protocol_error'`
- Chunks skip sequence numbers (1→3)
- Duplicate sequence numbers
- Out-of-order delivery

Solution: Check backend stream processor ordering.

### Reconnect Loop
Problem: Repeated `RECONNECT_ATTEMPT_*` logs
- Transient network errors
- Backend temporarily unavailable
- Exhaust after `maxReconnectAttempts` (default: 3)

Solution: Increase delays with `reconnectBaseDelayMs` and `reconnectMaxDelayMs`.

### Incomplete Content
Problem: `terminal_failed` but partial content in context
- Content is preserved before failure
- Check `errorMessage` for LLM error reason
- User can retry with `RETRY` event

Solution: Display partial content to user until retry succeeds.

## Logger Entry Fields

```typescript
type StreamLogEntry = {
  timestamp: number;           // Unix timestamp
  level: 'debug' | 'info' | 'warn' | 'error';
  requestId: string | null;    // Generation request ID
  artifactId: string | null;   // Artifact ID (set after START)
  event: string;               // Event name (e.g., 'CHUNK_RECEIVED')
  sequence?: number;           // For chunk events
  data?: Record<string, unknown>;
  duration?: number;           // For timer measurements (ms)
};
```

## Integration with Monitoring

Export logs for external analysis:

```typescript
const logs = logger.getLogs();
const errorLogs = logger.getLogsByLevel('error');

// Send to monitoring service
fetch('/api/debug/stream-logs', {
  method: 'POST',
  body: JSON.stringify({
    requestId: context.requestId,
    logs,
    errorCount: errorLogs.length,
  }),
});
```

---

**Last Updated**: 2026-04-25
**Test Coverage**: 17 tests covering happy path, failures, and edge cases
