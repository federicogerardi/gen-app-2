---
status: draft
version: 1.0
date_created: 2026-06-30
last-reviewed: 2026-06-30
next-review-date: 2026-07-30
owner: Backend Runtime
type: proposal
tags: [logging, ux, error-handling, proxy, idempotency, observability, debug]
goal: Improve error logging correlation and user-facing feedback for generation/run failures
---

# Proposal: Error Logging and UX Feedback Improvements

## 1. Problem Statement

Production log analysis (30/06/2026) revealed three error classes during `generation/run` execution that are functional but poorly observable:

| Error | Frequency | User Impact | Debug Difficulty |
|---|---|---|---|
| `idempotency_conflict` | Intermittent during auto-chain | Silent 500 → DispatchError | High — no requestId in proxy log |
| `ECONNRESET` on `/generation/run` | Every long-running geometric step | Socket hang up → unclear recovery | High — proxy log lacks request context |
| Duplicate step dispatch | Race condition in auto-chain | Transient 500, self-recovers | Very High — no correlation between FE/BE logs |

### Root Cause Analysis

From production logs (`logs.1782814250609.json`, `logs.1782814260017.json`):

**Incident timeline (30/06 10:05–10:08, geometric run `c1cf562c`):**

```
BACKEND                              FRONTEND PROXY
─────────                            ──────────────
10:06:54 competitor-scoring START    10:06:49 POST /generation/run → 200 (63794ms)
10:07:14 DUPLICATE request received  10:07:19 POST /generation/run → 500 (52ms)
         → idempotency_conflict     10:07:26 ECONNRESET (39954ms)
10:07:34 FIRST request finalized     10:07:28 POST /generation/run → 200 (86008ms)
                                     10:07:49 ECONNRESET (13929ms)
```

**Observability gaps:**

1. Proxy ECONNRESET log (`[proxy] error (39954ms): ECONNRESET socket hang up → /generation/run`) contains no `requestId`, no `toolKey`, no `userId` — impossible to correlate with backend session.
2. Backend `idempotency_conflict` log has `requestId` but no indication of which frontend action triggered the duplicate.
3. Frontend `generation/run` proxy entries log only HTTP status and duration — no request payload context.
4. The `500 (52ms)` response is logged as a normal `[proxy]` info entry, not as an error — easy to miss in log analysis.

## 2. Scope

In scope:

- Backend logging improvements for idempotency and generation errors
- Frontend proxy logging improvements for request correlation
- UX feedback improvements for timeout and conflict scenarios
- Observability documentation for production debugging

Out of scope:

- XState machine logic changes
- Backend generation pipeline changes
- Railway infrastructure configuration

## 3. Proposed Changes

### 3.1 Backend: Enhanced Error Logging

**File:** `apps/backend/src/lib/machines/generation-system.machine.ts`

#### 3.1.1 Idempotency Conflict Logging

Current behavior: `idempotency_conflict` is returned as a failure reason with minimal context.

Proposed: add structured log entry before returning conflict.

```typescript
// In idempotency-coordinator.machine.ts or generation-system.machine.ts
console.warn(JSON.stringify({
  event: 'generation.idempotency_conflict',
  requestId,
  userId: context.requestInput?.userId,
  projectId: context.requestInput?.projectId,
  toolKey: context.requestInput?.toolKey,
  stepKey: context.requestInput?.step,
  existingArtifactId: existingClaim?.artifactId,
  existingStatus: existingClaim?.status,
  timestamp: new Date().toISOString(),
}));
```

**Impact:** enables log-based correlation between duplicate requests and frontend actions.

#### 3.1.2 Generation Error Structured Logging

Current: `crawling.failed` logs error as multi-line string.

Proposed: single structured JSON log entry.

```typescript
console.error(JSON.stringify({
  event: 'generation.step_failed',
  requestId,
  toolKey,
  stepKey,
  operation: 'invokeCrawling', // or invokeScoring, etc.
  durationMs,
  errorType: error?.name,      // 'AbortError', 'TimeoutError', etc.
  errorMessage: error?.message,
  isRetryable: isRetryableError(error),
  timestamp: new Date().toISOString(),
}));
```

### 3.2 Frontend Proxy: Request Correlation Logging

**File:** `apps/frontend/server.mjs`

#### 3.2.1 Add Request Context to Proxy Error Handler

Current:
```javascript
proxy.on('error', (err, req, res) => {
  console.error(`[proxy] error (${duration}ms): ${err.code} ${err.message} → ${req.url}`);
});
```

Proposed:
```javascript
proxy.on('error', (err, req, res) => {
  const requestId = req.headers['x-request-id'] || '-';
  const duration = Date.now() - req._proxyStartTime;
  console.error(JSON.stringify({
    event: 'proxy.error',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    durationMs: duration,
    errorCode: err.code,
    errorMessage: err.message,
    requestId,
    timestamp: new Date().toISOString(),
  }));
});
```

#### 3.2.2 Log 5xx Responses as Errors

Current: `POST /generation/run → 500 (52ms)` logged as `[info]`.

Proposed: 5xx responses logged as `[error]` with structured context.

```javascript
proxyRes.on('end', () => {
  const duration = Date.now() - req._proxyStartTime;
  const level = res.statusCode >= 500 ? 'error' : 'info';
  const logEntry = {
    event: 'proxy.response',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    durationMs: duration,
    requestId: req.headers['x-request-id'] || '-',
    timestamp: new Date().toISOString(),
  };
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.info(JSON.stringify(logEntry));
  }
});
```

#### 3.2.3 Add Request ID Header Propagation

Ensure frontend sends `x-request-id` header on all `generation/run` requests.

**File:** `apps/frontend/src/features/tools/runtime/tools-client.ts`

```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-request-id': request.requestId, // already available from GenerationRequest
};
```

### 3.3 UX: Improved Error Feedback

#### 3.3.1 Timeout-Aware DispatchError Messaging

**File:** `apps/frontend/src/features/tools/runtime/useToolPage.ts`

Current: `DispatchError` shows generic "generation failed" message.

Proposed: differentiate timeout/idempotency errors.

```typescript
function mapDispatchErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('ECONNRESET')) {
      return 'La generazione ha impiegato troppo tempo. Riprova o contatta il supporto.';
    }
    if (error.message.includes('idempotency')) {
      return 'Generazione già in corso. Attendi il completamento.';
    }
  }
  return 'Si è verificato un errore durante la generazione. Riprova.';
}
```

#### 3.3.2 Auto-Chain Race Condition Guard

**File:** `apps/frontend/src/features/tools/runtime/useToolPage.ts`

Add guard in effect #9 (auto-chain) to prevent duplicate dispatch when a request is already in flight.

```typescript
// In effect #9 — auto-chain
if (
  isAutoChainEnabled
  && !generation.isStreamActive  // already checked
  && generation.streamStatus !== 'failed'
  && !toolPageSnapshot.context.pendingStepStart  // NEW: prevent double dispatch
  && nextAvailableStep
) {
  startGenerationStep(nextAvailableStep);
}
```

#### 3.3.3 ECONNRESET Recovery UX

When proxy returns ECONNRESET, the frontend should show a retry-capable message instead of a dead-end error.

**File:** `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

```tsx
{dispatchError && (
  <div className={uiPrimitives.error}>
    <p>{dispatchError}</p>
    {dispatchError.includes('tempo') && (
      <button
        type="button"
        className={uiPrimitives.button}
        onClick={handlePrimaryAction}
      >
        Riprova
      </button>
    )}
  </div>
)}
```

## 4. Implementation Plan

| Phase | Task | Effort | Priority |
|---|---|---|---|
| 1 | Backend structured logging for idempotency_conflict (3.1.1) | 1h | High |
| 1 | Backend structured logging for step_failed (3.1.2) | 1h | High |
| 1 | Frontend proxy error structured logging (3.2.1, 3.2.2) | 1h | High |
| 2 | Frontend x-request-id propagation (3.2.3) | 30min | Medium |
| 2 | Timeout-aware DispatchError messaging (3.3.1) | 1h | Medium |
| 2 | Auto-chain race condition guard (3.3.2) | 30min | Medium |
| 3 | ECONNRESET recovery UX with retry button (3.3.3) | 1h | Low |

**Total estimated effort:** ~6 hours

## 5. Acceptance Criteria

### Logging

- [ ] Every `idempotency_conflict` log entry contains `requestId`, `userId`, `projectId`, `toolKey`, `stepKey`
- [ ] Every proxy error log contains `requestId` and `method`
- [ ] Every 5xx proxy response is logged as `[error]` (not `[info]`)
- [ ] Backend `generation.step_failed` logs are single-line JSON (parseable by log aggregators)

### UX

- [ ] ECONNRESET shows user-readable message with retry affordance
- [ ] `idempotency_conflict` shows "generation already in progress" message
- [ ] Auto-chain cannot dispatch duplicate step when `pendingStepStart` is non-null

### Correlation

- [ ] Given a frontend ECONNRESET log, backend session can be identified via `requestId`
- [ ] Given a backend `idempotency_conflict`, the originating frontend request can be traced

## 6. Non-Regression

- Existing `generation/run` happy path must remain unchanged
- Existing `generation/stream` (SSE) path must remain unchanged
- Proxy logging format change must not break Railway log ingestion
- Auto-chain behavior must remain identical for non-conflicting scenarios

## 7. DDD Alignment

No new domain terms introduced. Changes are purely operational (logging) and UX feedback (copy). All terms reference existing glossary entries:

- `DispatchError` — `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `IdempotencyKey`, `IdempotencyDecision` — `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `GenerationRequest` — `packages/contracts/src/index.ts`

## 8. References

- Production logs: `logs/logs.1782814250609.json` (backend), `logs/logs.1782814260017.json` (frontend)
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` — effect #7, #8, #9
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` — state machine contract
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — DispatchError definition
- `docs/07-governance/tool-governance-tool-matrix.md` — endpoint touchpoints
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — effects #7, #8, #9
- `apps/frontend/server.mjs` — proxy error handler
- `apps/backend/src/lib/machines/generation-system.machine.ts` — idempotency gate
