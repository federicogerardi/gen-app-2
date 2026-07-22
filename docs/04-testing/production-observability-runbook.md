---
status: active
version: 1.0
date_created: 2026-07-06
last-reviewed: 2026-07-06
next-review-date: 2026-10-06
owner: Backend Runtime + Frontend Platform
type: observability-runbook
tags: [logging, observability, pino, correlation, error-handling, debugging]
---

# Production Observability Runbook

## 1. Structured Logging Architecture

### 1.1 Backend Logging (pino)

**Logger Module:** `apps/backend/src/lib/runtime/logger.ts`

```typescript
import pino from 'pino';

export const logger = pino({
  name: 'gen-app-2-backend',
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  })
});
```

**Usage Pattern:**
```typescript
import { logger } from '../runtime/logger';

// Request-scoped logging
const requestLogger = logger.child({
  requestId: context.input.requestId,
  userId: context.input.userId,
  projectId: context.input.projectId,
});

requestLogger.warn({
  event: 'generation.idempotency_conflict',
  workflowType: context.input.workflowType,
  existingReason: context.conflictReason,
});
```

### 1.2 Frontend Logging

**Logger Module:** `apps/frontend/src/app/runtime/logger.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};

function log(level: LogLevel, message: string, context: LogContext = {}) {
  console[level](JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    component: 'frontend',
    ...context,
  }));
}
```

### 1.3 Proxy Logging

**File:** `apps/frontend/server.mjs`

- Correlation ID auto-generation via `uuid`
- Structured JSON for 5xx responses
- Error logging with correlation context

---

## 2. Error Classification & Correlation

### 2.1 Error Taxonomy (DDD-148)

| Reason Code | Source | Description |
|---|---|---|
| `idempotency_conflict` | `IdempotencyCoordinator` | Duplicate request detected |
| `extraction_context_insufficient` | Backend extraction | Briefing data insufficient |
| `stream_empty_output` | Backend stream | LLM returned empty output |
| `terminal_failed` | Backend generation | Terminal failure (prefix match) |
| `timeout` | Proxy/Network | ECONNRESET or long-running timeout |
| `connection_lost` | Proxy/Network | Proxy connection failure |
| `unknown` | Fallback | Unrecognized error |

### 2.2 Translation Rules (DDD-149)

**Translation Layer:** `mapInlineDispatchError` in `tool-page-runtime-utils.ts`

```
Backend reason strings → DispatchErrorReasonCode → Localized DispatchError message
```

**Rules:**
1. Backend owns canonical error semantics
2. Frontend owns display translation via typed codes
3. No raw backend strings shown to users
4. New backend error codes require new `DispatchErrorReasonCode` entry

---

## 3. Railway Log Query Patterns

### 3.1 Idempotency Conflict Investigation

```bash
# Search for idempotency conflicts
grep 'generation.idempotency_conflict' logs/*.json

# Filter by requestId
grep '"requestId":"req-xxx"' logs/*.json

# Filter by userId
grep '"userId":"user-xxx"' logs/*.json
```

### 3.2 ECONNRESET/Timeout Analysis

```bash
# Search proxy errors
grep 'proxy.error' logs/*.json

# Filter by correlation ID
grep '"correlationId":"uuid-xxx"' logs/*.json

# Search timeout errors
grep '"event":"generation.step_failed"' logs/*.json | grep '"errorType":"TimeoutError"'
```

### 3.3 Generation Failure Correlation

```bash
# Find generation failures
grep 'generation.step_failed' logs/*.json

# Correlate frontend → backend
grep '"x-correlation-id":"uuid-xxx"' logs/*.json
```

---

## 4. Debugging Workflows

### 4.1 FE→Proxy→BE Correlation Tracing

**Scenario:** User reports generation failure

1. **Get correlation ID from frontend:**
   - Check browser console for `dispatchError` messages
   - Note the correlation ID from Network tab headers

2. **Trace through proxy:**
   ```bash
   grep '"correlationId":"<uuid>"' logs/frontend-proxy.json
   ```

3. **Find backend logs:**
   ```bash
   grep '"requestId":"<request-id>"' logs/backend.json
   ```

4. **Identify error type:**
   - Check `event` field for error classification
   - Review `errorType` and `errorMessage` for root cause

### 4.2 IdempotencyConflict Investigation

**Scenario:** User sees "Generazione già in corso"

1. **Find conflict event:**
   ```bash
   grep 'generation.idempotency_conflict' logs/backend.json
   ```

2. **Check duplicate request:**
   - Look for same `requestId` in multiple logs
   - Check `existingReason` for conflict details

3. **Identify source:**
   - Auto-chain race condition (check `pendingStepStart`)
   - Manual duplicate click
   - Network retry

### 4.3 ECONNRESET Timeout Analysis

**Scenario:** User sees "La generazione ha impiegato troppo tempo"

1. **Find proxy error:**
   ```bash
   grep 'proxy.error' logs/frontend-proxy.json | grep 'ECONNRESET'
   ```

2. **Check duration:**
   - Look for `durationMs` in log entry
   - Compare with timeout thresholds

3. **Trace backend state:**
   - Find backend logs for same time window
   - Check if generation was still running

---

## 5. Log Entry Examples

### 5.1 Idempotency Conflict (Backend)

```json
{
  "level": 40,
  "time": "2026-07-06T10:05:30.123Z",
  "pid": 1234,
  "hostname": "railway-container",
  "name": "gen-app-2-backend",
  "requestId": "req-abc123",
  "userId": "user-456",
  "projectId": "proj-789",
  "event": "generation.idempotency_conflict",
  "workflowType": "funnel_pages",
  "existingReason": "idempotency_conflict",
  "msg": ""
}
```

### 5.2 Proxy Error (Frontend)

```json
{
  "timestamp": "2026-07-06T10:05:30.456Z",
  "level": "error",
  "message": "proxy.error",
  "component": "frontend-proxy",
  "method": "POST",
  "url": "/generation/run",
  "statusCode": 502,
  "durationMs": 30001,
  "errorCode": "ECONNRESET",
  "errorMessage": "socket hang up",
  "correlationId": "uuid-abc123"
}
```

### 5.3 Generation Step Failed (Backend)

```json
{
  "level": 50,
  "time": "2026-07-06T10:05:30.789Z",
  "pid": 1234,
  "hostname": "railway-container",
  "name": "gen-app-2-backend",
  "requestId": "req-abc123",
  "event": "[geometric] crawling.failed",
  "operation": "invokeCrawling",
  "error": "timeout",
  "msg": ""
}
```

---

## 6. Monitoring Recommendations

### 6.1 Key Metrics to Track

- **Idempotency conflict rate:** Count of `generation.idempotency_conflict` events
- **Proxy error rate:** Count of `proxy.error` events with 5xx status
- **Timeout rate:** Count of timeout-related `generation.step_failed` events
- **Correlation success rate:** Requests with valid `correlationId`

### 6.2 Alert Thresholds

- **High conflict rate:** > 5 conflicts/minute → investigate auto-chain logic
- **High timeout rate:** > 10 timeouts/hour → check LLM provider health
- **Proxy errors:** Any 5xx errors → immediate investigation

### 6.3 Log Aggregation

- **Railway:** Automatic JSON log ingestion
- **Structured format:** All logs are JSON-parseable
- **Correlation:** `requestId` and `correlationId` enable cross-service tracing

---

## 7. Troubleshooting Common Issues

### 7.1 No Correlation ID in Logs

**Symptoms:** Cannot trace requests across services

**Solution:**
- Verify `uuid` is installed in frontend
- Check `x-correlation-id` header in Network tab
- Ensure proxy forwards correlation ID

### 7.2 Missing Structured Logs

**Symptoms:** Logs are plain text, not JSON

**Solution:**
- Check `NODE_ENV` (development uses pino-pretty)
- Verify pino is installed (`npm ls pino`)
- Check logger module import path

### 7.3 Duplicate Dispatch Errors

**Symptoms:** User sees error twice

**Solution:**
- Check `pendingStepStart` guard in auto-chain
- Verify `isAutoChainEnabled` state management
- Review race condition in effect dependencies

---

## 8. Related Documentation

- **DDD Glossary:** `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- **Decision Log:** `docs/07-governance/domain-naming-decision-log.md` (DDD-147, DDD-148, DDD-149)
- **Bounded Context Map:** `docs/02-design/domain-bounded-context-map.md` (Error Translation Rules)
- **Debug Runbook:** `docs/04-testing/streaming-generator-debug-runbook.md`
- **Implementation Plan:** `../99-lifecycle/99-archive/plans/feature-error-logging-ux-feedback-improvements-1.md`
