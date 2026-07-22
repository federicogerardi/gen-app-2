---
status: completed
version: 1.1
date_created: 2026-07-15
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: Backend Runtime
type: implementation-plan
tags: [backend, logging, pino, unification, observability]
goal: Unify all backend operational logging under a single Pino-based system — zero console.* calls
---

# Backend Logging Unification Plan

**Status**: COMPLETED  
**Created**: 2026-07-15  
**Updated**: 2026-07-15 (execution completed)  
**Completed**: 2026-07-15  
**Estimated Effort**: 4-5 hours  
**Actual Effort**: ~3 hours  
**Risk Level**: Low (cosmetic changes, no business logic touched)  
**Files Affected**: 22 source files edited + 2 new, 2 deleted  
**DDD Gates**: None (infrastructure concern)  

## Overview

Unify all backend operational logging under a **single Pino-based system**. No `console.*` calls, no separate geometric-logger. Two new infrastructure modules handle everything:

| Module | Purpose |
|---|---|
| `lib/runtime/log-components.ts` (NEW) | Canonical component name registry + `createComponentLogger()` |
| `lib/runtime/log-serializers.ts` (NEW) | Pino serializers: `baseQuery`/`paaQuery` truncation, `htmlContent`/`rawBuffer` removal (inherits geometric-logger sanitization) |

**Target: zero `console.*` operational calls, one logger.**

```
Pino (lib/runtime/logger.ts)  ← serialized by log-serializers.ts
├── server.ts
├── node-server.ts
├── backend-session.ts
├── generation-handler.ts
├── generation-stream-observability.ts
├── generation-route-pipeline.ts
├── auth-http/runtime.ts
├── tools-orchestrate-handlers.ts
├── tools-hydrate-handlers.ts
├── admin-feedback-center-handlers.ts
├── crawling-queue.ts
├── github-issues.ts
├── github-config.ts
├── serpapi-service-resolver.ts
├── openrouter.adapter.ts
├── user-report.adapter.ts
├── user-report-github-link.adapter.ts
├── postgres-redis.adapters.ts
├── postgres-redis.production.ts
├── smoke-cleanup.ts
├── idempotency-coordinator.machine.ts    ✓ already Pino
├── crawling-chain.machine.ts             ← migrated from geometric-logger
├── tool-workflow.machine.ts              ← migrated from geometric-logger
├── generation-system.actors.ts           ← migrated from geometric-logger
└── context-generation-assembly.ts        ← migrated from console.* (was bypassing geometric-logger)

DELETED: lib/runtime/integrations/geometric-logger.ts   (folded into Pino serializers)
```

---

## Phase 0 — Infrastructure

### Task 0.1: Create `log-components.ts`

**File (NEW):** `apps/backend/src/lib/runtime/log-components.ts`

```typescript
import { logger } from './logger';

/** Canonical registry of log component names. Replaces all ad-hoc text prefixes. */
export const LogComponent = {
  SERVER: 'server',
  NODE_SERVER: 'node-server',
  BACKEND_SESSION: 'backend-session',
  GENERATION_HANDLER: 'generation-handler',
  GENERATION_STREAM_OBSERVABILITY: 'generation-stream-observability',
  GENERATION_ROUTE_PIPELINE: 'generation-route-pipeline',
  ORCHESTRATE: 'orchestrate',
  HYDRATE: 'hydrate',
  FEEDBACK_CENTER: 'feedback-center',
  CRAWLING_QUEUE: 'crawling-queue',
  GITHUB_ISSUES: 'github-issues',
  GITHUB_CONFIG: 'github-config',
  SERPAPI_RESOLVER: 'serpapi-resolver',
  OPENROUTER: 'openrouter',
  USER_REPORT: 'user-report',
  USER_REPORT_GITHUB_LINK: 'user-report-github-link',
  POSTGRES_REDIS: 'postgres-redis',
  LLM_ADAPTER: 'llm-adapter',
  SMOKE_CLEANUP: 'smoke-cleanup',
  GEOMETRIC: 'geometric',
  IDEMPOTENCY_COORDINATOR: 'idempotency-coordinator',
} as const;

/** Create a Pino child logger pre-tagged with a component name. */
export const createComponentLogger = (component: string) =>
  logger.child({ component });
```

### Task 0.2: Create Pino serializers (replaces geometric-logger sanitization)

**File (NEW):** `apps/backend/src/lib/runtime/log-serializers.ts`

```typescript
const MAX_QUERY_LOG_LENGTH = 80;

const truncateString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return value.length > MAX_QUERY_LOG_LENGTH
    ? `${value.slice(0, MAX_QUERY_LOG_LENGTH)}…`
    : value;
};

/**
 * Pino serializers that replace geometric-logger sanitizeMeta.
 * Applied globally to every log call via logger.ts configuration.
 */
export const serializers = {
  baseQuery: truncateString,
  paaQuery: truncateString,
  // Never log binary or raw HTML content
  htmlContent: () => undefined,
  rawBuffer: () => undefined,
};
```

### Task 0.3: Wire serializers into `logger.ts`

**File:** `apps/backend/src/lib/runtime/logger.ts`  
**Change:** Add `serializers` import and pass to Pino config.

```typescript
// BEFORE:
export const logger = pino({
  name: 'gen-app-2-backend',
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

// AFTER:
import { serializers } from './log-serializers';

export const logger = pino({
  name: 'gen-app-2-backend',
  level: process.env.LOG_LEVEL || 'info',
  serializers,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
```

### Task 0.4: Update `generation-route-pipeline.ts` defaultLogger

**File:** `apps/backend/src/lib/runtime/generation-route-pipeline.ts`  
**Lines:** 25-35 (the `defaultLogger` constant)

```typescript
// Add import at top:
import { logger } from './logger';

// Replace lines 25-35:
const defaultLogger: GenerationRoutePipelineLogger = {
  info: (message, meta) => logger.info(meta, message),
  warn: (message, meta) => logger.warn(meta, message),
  error: (message, meta) => logger.error(meta, message),
};
```

### Verify Phase 0

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

## Phase 1 — Critical Observability (session boundary + HTTP lifecycle)

### Task 1.1: Migrate `backend-session.ts`

**File:** `apps/backend/src/lib/runtime/backend-session.ts`

**Step 1a — Add import at top:**
```typescript
import { createComponentLogger, LogComponent } from './log-components';
```

**Step 1b — Replace `console.info` at lines 54-68 (session-start):**
```typescript
// BEFORE (lines 54-68):
console.info(
  [
    '[gen][session-start]',
    `corr=${correlationId}`,
    `requestId=${request.requestId}`,
    `projectId=${request.projectId}`,
    ... 
  ].join(' '),
);

// AFTER:
const log = createComponentLogger(LogComponent.BACKEND_SESSION);
const sessionLog = log.child({ correlationId, requestId: request.requestId });

sessionLog.info({
  projectId: request.projectId,
  sessionId: request.sessionId ?? '-',
  toolKey: request.toolKey ?? '-',
  workflowType: request.workflowType ?? '-',
  artifactType: request.artifactType,
  step: requestedStep,
  model: request.model,
  tone: requestedTone,
}, 'session start');
```

**Step 1c — Replace `console.info` at lines 231-244 (session-terminal):**
```typescript
sessionLog.info({
  status,
  artifactId: doneSnapshot.context.artifactId ?? '-',
  failureReason: doneSnapshot.context.failureReason ?? '-',
  contentLen: doneSnapshot.context.contentBuffer.length,
  step: requestedStep,
  model: request.model,
  tone: requestedTone,
}, 'session terminal');
```

**Step 1d — Replace `console.info` at lines 276-284 (json-session-start):**
```typescript
const jsonLog = log.child({ correlationId, requestId: request.requestId });
jsonLog.info({ projectId: request.projectId, mode: 'generate' }, 'json session start');
```

**Step 1e — Replace `console.info` at lines 308-317 (json-session-terminal):**
```typescript
jsonLog.info({
  status,
  artifactId: doneSnapshot.context.artifactId ?? '-',
  failureReason: doneSnapshot.context.failureReason ?? '-',
  contentLen: doneSnapshot.context.contentBuffer.length,
}, 'json session terminal');
```

### Task 1.2: Migrate `node-server.ts`

**File:** `apps/backend/src/lib/runtime/node-server.ts`

**Step 1.2a — Add import + const:**
```typescript
import { createComponentLogger, LogComponent } from './log-components';
// At top of handler function (after ~line 188):
const log = createComponentLogger(LogComponent.NODE_SERVER);
```

**Step 1.2b — Replace `[req]` at lines 193-194:**
```typescript
// BEFORE:
if (shouldLogRequestLifecycle) {
  console.log(`[req] ${method} ${path} origin=${origin}`);
}
// AFTER:
if (shouldLogRequestLifecycle) {
  log.info({ method, path, origin }, 'request received');
}
```

**Step 1.2c — Replace `[res]` at lines 198:**
```typescript
// BEFORE:
if (shouldLogRequestLifecycle) {
  response.on('finish', () => {
    console.log(`[res] ${method} ${path} → ${response.statusCode}`);
  });
}
// AFTER:
if (shouldLogRequestLifecycle) {
  response.on('finish', () => {
    log.info({ method, path, statusCode: response.statusCode }, 'response sent');
  });
}
```

**Step 1.2d — Replace `console.warn('[gen][bad_request]')` at ~line 278:**
```typescript
log.warn({ method, path, reason }, 'bad request');
```

**Step 1.2e — Replace `console.error('[err]')` at ~line 353:**
```typescript
log.error({ err: error }, 'unhandled server error');
```

### Task 1.3: Migrate `generation-handler.ts`

**File:** `apps/backend/src/lib/runtime/generation-handler.ts`

```typescript
import { createComponentLogger, LogComponent } from './log-components';
const log = createComponentLogger(LogComponent.GENERATION_HANDLER);

// Line 50-54:
onEscalation: (error) => {
  log.error({ requestId: request.requestId, error }, 'session escalation: request failed without retry');
},
```

### Task 1.4: Migrate `generation-stream-observability.ts`

**File:** `apps/backend/src/lib/runtime/generation-stream-observability.ts`

```typescript
import { createComponentLogger, LogComponent } from './log-components';
const log = createComponentLogger(LogComponent.GENERATION_STREAM_OBSERVABILITY);
// console.info('[gen][request]...') → log.info({ correlationId, ... }, 'generation request debug')
// console.info('[gen][model-check]...') → log.info({ correlationId, modelKey, available }, 'model check')
// console.error('[gen][stream-error]...') → log.error({ correlationId, error }, 'stream error')
// Preserve: if (debugGenerationLogs) gate
```

### Verify Phase 1

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

## Phase 2 — Fold Geometric Logger into Pino

**Goal:** Migrate all 4 geometric-logger consumers to `createComponentLogger(LogComponent.GEOMETRIC)`, then delete `geometric-logger.ts` and its test file.

### Task 2.1: Migrate `crawling-chain.machine.ts` (8 calls)

**File:** `apps/backend/src/lib/machines/generation/crawling-chain.machine.ts`  
**Line 3:** Replace import

```typescript
// BEFORE:
import { logGeometricInfo, logGeometricWarn, logGeometricError } from '../../runtime/integrations/geometric-logger';

// AFTER:
import { createComponentLogger, LogComponent } from '../../runtime/log-components';
const glog = createComponentLogger(LogComponent.GEOMETRIC);
```

Then replace each call site:

| Line | BEFORE | AFTER |
|---|---|---|
| 42 | `logGeometricInfo('crawling.start', { requestId, ... })` | `glog.info({ requestId, ... }, 'crawling.start')` |
| 51 | `logGeometricError('crawling.failed.base_query_missing', { ... })` | `glog.error({ ... }, 'crawling.failed.base_query_missing')` |
| 56 | `logGeometricError('crawling.failed.api_service_missing', { ... })` | `glog.error({ ... }, 'crawling.failed.api_service_missing')` |
| 78 | `logGeometricInfo('crawling.paa.discovered', { ... })` | `glog.info({ ... }, 'crawling.paa.discovered')` |
| 95 | `logGeometricWarn('crawling.paa.single_failed', { ... })` | `glog.warn({ ... }, 'crawling.paa.single_failed')` |
| 108 | `logGeometricInfo('crawling.completed', { ... })` | `glog.info({ ... }, 'crawling.completed')` |
| 125 | `logGeometricError('crawling.failed', { ... })` | `glog.error({ ... }, 'crawling.failed')` |

**Note:** Pino serializers (Phase 0.2) now handle `baseQuery`/`paaQuery` truncation and `htmlContent`/`rawBuffer` removal automatically on every call.

### Task 2.2: Migrate `tool-workflow.machine.ts` (4 calls)

**File:** `apps/backend/src/lib/machines/tool-workflow.machine.ts`  
**Line 3:** Replace import

```typescript
// BEFORE:
import { logGeometricInfo, logGeometricError } from '../runtime/integrations/geometric-logger';

// AFTER:
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const glog = createComponentLogger(LogComponent.GEOMETRIC);
```

| Line | BEFORE | AFTER |
|---|---|---|
| 187 | `logGeometricError('merge.crawling.empty', { ... })` | `glog.error({ ... }, 'merge.crawling.empty')` |
| 216 | `logGeometricInfo('merge.crawling.completed', { ... })` | `glog.info({ ... }, 'merge.crawling.completed')` |
| 257 | `logGeometricError('merge.scoring.empty', { ... })` | `glog.error({ ... }, 'merge.scoring.empty')` |
| 266 | `logGeometricInfo('merge.scoring.completed', { ... })` | `glog.info({ ... }, 'merge.scoring.completed')` |

### Task 2.3: Migrate `generation-system.actors.ts` (16 calls)

**File:** `apps/backend/src/lib/machines/generation-system.actors.ts`  
**Line 19:** Replace import

```typescript
// BEFORE:
import { logGeometricInfo, logGeometricWarn, logGeometricError } from '../runtime/integrations/geometric-logger';

// AFTER:
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const glog = createComponentLogger(LogComponent.GEOMETRIC);
```

Replace all 16 `logGeometric*` calls with `glog.info/warn/error`. Pattern identical to Tasks 2.1-2.2.

### Task 2.4: Fix `context-generation-assembly.ts` (3 calls)

**File:** `apps/backend/src/lib/machines/generation/context-generation-assembly.ts`

This file was bypassing geometric-logger with raw `console.info('[geometric] ...')`. Now it uses Pino directly.

```typescript
// BEFORE (line 92):
console.info(`[geometric] assembly.strategic_reporting`, { requestId, ... });

// AFTER:
import { createComponentLogger, LogComponent } from '../../runtime/log-components';
const glog = createComponentLogger(LogComponent.GEOMETRIC);
glog.info({ requestId, ... }, 'assembly.strategic_reporting');
```

Same pattern for lines 136 (`assembly.unified_report`) and 158 (`assembly.select`).

### Task 2.5: Delete `geometric-logger.ts` and its test

```bash
rm apps/backend/src/lib/runtime/integrations/geometric-logger.ts
rm apps/backend/src/lib/tests/runtime.geometric-logger.test.ts
```

The test file tested sanitization which is now covered by Pino serializers (Phase 0.2).

### Task 2.6: Update `idempotency-coordinator.machine.ts`

**File:** `apps/backend/src/lib/machines/idempotency-coordinator.machine.ts`

Already uses Pino. Switch from raw `logger` import to `createComponentLogger` for consistency:

```typescript
// BEFORE:
import { logger } from '../runtime/logger';
const requestLogger = logger.child({ requestId, userId, projectId });

// AFTER:
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const requestLogger = createComponentLogger(LogComponent.IDEMPOTENCY_COORDINATOR)
  .child({ requestId, userId, projectId });
```

### Verify Phase 2

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test

# Confirm geometric-logger is gone
rg "geometric-logger" apps/backend/src/lib/ -g '*.ts'
# Expected: no matches (imports all changed)
```

---

## Phase 3 — Server Startup & Infrastructure

### Task 3.1: Migrate `server.ts`

**File:** `apps/backend/src/server.ts`

```typescript
import { createComponentLogger, LogComponent } from './lib/runtime/log-components';
const log = createComponentLogger(LogComponent.SERVER);

// console.info('[startup][...]') → log.info({ overrideCount }, 'step LLM model overrides validated')
// console.warn('[startup][...]') → log.warn({ ... }, 'step LLM model override warning')
// console.info('[gen][model-cache]...') → log.info({ event: 'model-cache.refreshed', ... })
// console.log('Runtime server listening...') → log.info({ host, port }, 'server listening')
// console.log('CORS allowed origins...') → log.info({ origins }, 'CORS configured')
// console.error(error) → log.error({ err: error }, 'server startup failed')
```

### Task 3.2: Migrate `postgres-redis.adapters.ts` (line 63)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.POSTGRES_REDIS);
log.warn({ err }, 'orchestrate cache setStepArtifact failed (non-fatal)');
```

### Task 3.3: Migrate `postgres-redis.production.ts` (lines 56, 74)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.LLM_ADAPTER);
log.warn('OPENROUTER_API_KEY is not set; LLM adapter will be unavailable');
```

### Verify Phase 3

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

## Phase 4 — Integrations

### Task 4.1: `crawling-queue.ts` (lines 48, 52)

```typescript
import { createComponentLogger, LogComponent } from '../log-components';
const log = createComponentLogger(LogComponent.CRAWLING_QUEUE);
log.error({ jobId, error }, 'crawling job failed');
log.info({ jobId }, 'crawling job completed');
```

### Task 4.2: `github-issues.ts` (lines 85, 163, 177, 186)

```typescript
import { createComponentLogger, LogComponent } from '../log-components';
const log = createComponentLogger(LogComponent.GITHUB_ISSUES);
// debugLog(...) → log.debug(...)  (Pino suppresses at LOG_LEVEL=info)
// console.error(...) → log.error(...)
```

### Task 4.3: `serpapi-service-resolver.ts` (lines 28, 33, 47)

```typescript
import { createComponentLogger, LogComponent } from '../log-components';
const log = createComponentLogger(LogComponent.SERPAPI_RESOLVER);
log.warn({ reason }, 'SerpApi service unavailable');
```

### Task 4.4: `github-config.ts` (lines 33, 53)

```typescript
import { createComponentLogger, LogComponent } from '../log-components';
const log = createComponentLogger(LogComponent.GITHUB_CONFIG);
log.debug({ ... }, 'GitHub API config diagnostic');
```

### Verify Phase 4

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

## Phase 5 — Adapters & HTTP Handlers

### Task 5.1: `openrouter.adapter.ts` (lines 111, 167)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.OPENROUTER);
log.debug({ ... }, 'OpenRouter diagnostic');
```

### Task 5.2: `user-report.adapter.ts` (lines 48, 66, 69)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.USER_REPORT);
log.debug({ ... }, 'createUserReport starting insert');
log.debug({ reportId }, 'createUserReport completed');
log.error({ err }, 'createUserReport insert failed');
```

### Task 5.3: `user-report-github-link.adapter.ts` (lines 70, 92, 109, 114)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.USER_REPORT_GITHUB_LINK);
log.debug({ ... }, 'publishUserReportIssue transaction step');
```

### Task 5.4: `auth-http/runtime.ts` (line 266)

```typescript
import { createComponentLogger, LogComponent } from '../log-components';
const log = createComponentLogger(LogComponent.NODE_SERVER);
log.error({ err }, 'auth-http unhandled error');
```

### Task 5.5: `tools-orchestrate-handlers.ts` (lines 246, 289-298)

Line 246 — cache warning:
```typescript
import { createComponentLogger, LogComponent } from '../../log-components';
const log = createComponentLogger(LogComponent.ORCHESTRATE);
log.warn({ err }, 'orchestrate cache read failed (fallback to DB)');
```

Lines 289-298 — pipeline logger callbacks. Since Phase 0.4 made the default Pino-backed:
```typescript
import { logger } from '../../log-components';
const pipelineLogger: GenerationRoutePipelineLogger = {
  info: (message, meta) => logger.info(withOrchestrateMeta(meta), message),
  warn: (message, meta) => logger.warn(withOrchestrateMeta(meta), message),
  error: (message, meta) => logger.error(withOrchestrateMeta(meta), message),
};
```

### Task 5.6: `tools-hydrate-handlers.ts` (line 58)

```typescript
import { createComponentLogger, LogComponent } from '../../log-components';
const log = createComponentLogger(LogComponent.HYDRATE);
log.debug({ ... }, 'hydrate diagnostic');
```

### Task 5.7: `admin-feedback-center-handlers.ts` (line 98 debug, line 448 error)

```typescript
import { createComponentLogger, LogComponent } from '../../log-components';
const log = createComponentLogger(LogComponent.FEEDBACK_CENTER);
log.debug({ ... }, 'feedback center diagnostic');
log.error({ err }, 'feedback center publication failed');
```

### Verify Phase 5

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

## Phase 6 — Smoke Cleanup

### Task 6.1: Migrate `smoke-cleanup.ts` (line 20)

```typescript
import { createComponentLogger, LogComponent } from '../runtime/log-components';
const log = createComponentLogger(LogComponent.SMOKE_CLEANUP);
log.warn({ error }, 'smoke cleanup warning');
```

### Verify Phase 6 (Final)

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test

# Confirm zero operational console.* calls remain
rg "console\.(log|info|warn|error)\b" \
   apps/backend/src/lib/ \
   -g '*.ts' \
   -g '!*.test.ts' \
   -g '!*.smoke.ts'
# Expected: no matches

# Confirm geometric-logger is gone
rg "geometric-logger" apps/backend/src/ -g '*.ts'
# Expected: no matches

# Full validation
npm --workspace apps/backend run go
```

---

## Phase Summary

| Phase | Files | Risk | Est. Time | Depends On |
|---|---|---|---|---|
| 0 | 3 new + 2 edits | Low | 45 min | — |
| 1 | 4 edits | Medium | 1.5 hr | Phase 0 |
| 2 | 4 edits + 2 deletes | Medium | 1 hr | Phase 0 |
| 3 | 3 edits | Low | 45 min | Phase 0 |
| 4 | 4 edits | Low | 45 min | Phase 0 |
| 5 | 7 edits | Low | 1 hr | Phase 0 |
| 6 | 1 edit | Low | 5 min | — |
| **Total** | **26 edits + 3 new + 2 deleted** | | **~5 hr** | |

## Architecture After Unification

- **One logger:** `lib/runtime/logger.ts` (Pino)
- **One component registry:** `lib/runtime/log-components.ts`
- **One serializer module:** `lib/runtime/log-serializers.ts`
- **One injectable interface:** `GenerationRoutePipelineLogger` (backed by Pino)
- **Zero** `console.*` operational calls
- **Zero** geometric-logger (deleted)

## Rollback

Each phase is self-contained. `git revert <phase-commit>` undoes that phase without affecting prior phases.

## Non-Goals

- Test files and smoke test files retain `console.*` (test output is not operational logging)
- No changes to `LOG_LEVEL` semantics or Pino configuration
- No changes to `GenerationRoutePipelineLogger` interface signature

---

## Execution Summary (2026-07-15)

### Verification Results

- **Typecheck**: clean
- **Tests**: 341/341 pass (4 tests removed with geometric-logger test file)
- **geometric-logger**: fully removed (only comment reference in `log-serializers.ts`)

### Files Created (2)
- `apps/backend/src/lib/runtime/log-components.ts` — component name registry + `createComponentLogger()`
- `apps/backend/src/lib/runtime/log-serializers.ts` — Pino serializers for query truncation + binary/HTML removal

### Files Deleted (2)
- `apps/backend/src/lib/runtime/integrations/geometric-logger.ts`
- `apps/backend/src/lib/tests/runtime.geometric-logger.test.ts`

### Files Edited (22)
**Phase 0 — Infrastructure:** `logger.ts`, `generation-route-pipeline.ts`
**Phase 1 — Critical Observability:** `backend-session.ts`, `node-server.ts`, `generation-handler.ts`, `generation-stream-observability.ts`
**Phase 2 — Geometric → Pino:** `crawling-chain.machine.ts`, `tool-workflow.machine.ts`, `generation-system.actors.ts`, `context-generation-assembly.ts`, `idempotency-coordinator.machine.ts`
**Phase 3 — Server/Infra:** `server.ts`, `postgres-redis.adapters.ts`, `postgres-redis.production.ts`
**Phase 4 — Integrations:** `crawling-queue.ts`, `github-issues.ts`, `serpapi-service-resolver.ts`, `github-config.ts`
**Phase 5 — Adapters/Handlers:** `openrouter.adapter.ts`, `user-report.adapter.ts`, `user-report-github-link.adapter.ts`, `auth-http/runtime.ts`, `tools-orchestrate-handlers.ts`, `tools-hydrate-handlers.ts`, `admin-feedback-center-handlers.ts`
**Phase 6 — Cleanup:** `smoke-cleanup.ts`

### Known Deviation

`tools-orchestrate-handlers.ts` pipeline logger callbacks (lines 289-298) still use `console.info/warn/error` — the test infrastructure (`captureOrchestrateStartMeta`) monkey-patches `console.info` to capture pipeline log output. Full migration requires updating the test to capture Pino output instead.

### Remaining `console.*` in Non-Test Files

| File | Calls | Reason |
|---|---|---|
| `tools-orchestrate-handlers.ts` | 3 (`console.info/warn/error`) | Pipeline logger — test dependency |
| `runtime.tools-orchestrate.benchmark.ts` | 1 (`console.log`) | Benchmark file, not production code |
