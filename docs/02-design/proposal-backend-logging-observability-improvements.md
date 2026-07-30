---
status: draft
version: 1.0
date_created: 2026-07-25
last-reviewed: 2026-07-25
next-review-date: 2026-10-25
owner: Backend Runtime
type: proposal
tags: [logging, observability, pino, http, correlation-id, railway, generation-actor, console]
goal: Migrate remaining console.* calls to Pino, add HTTP logging middleware, introduce correlation IDs, and unify log levels across the backend
---

# Proposal: Backend Logging Observability Improvements

## 1. Problem Statement

An assessment of the gen-app-2 dev environment on Railway (2026-07-25) identified four gaps in the backend logging system:

| Gap | Severity | Impact |
|---|---|---|
| **No HTTP logs captured by Railway** | Critical | Zero observability on latency, error rate, status codes per route. Railway HTTP log capture returns "No HTTP logs found" for both backend and frontend. |
| **Dual logging system** | High | `generation-actor.ts` (the aggregate root) and `tools-orchestrate-handlers.ts` use raw `console.info/console.error` instead of Pino, bypassing structured logging for the most critical component. |
| **No correlation ID** | High | No trace ID propagates across logs of the same request. Impossible to trace a generation end-to-end. |
| **Inconsistent log levels** | Medium | `console.info` used for all severity levels in generation-actor. `console.debug` in `github-issues.ts` without level guard. |

### Context

The backend already has a solid Pino foundation:
- `lib/runtime/logger.ts` — Pino instance with `LOG_LEVEL` env, `pino-pretty` in dev
- `lib/runtime/log-serializers.ts` — sensitive data scrubbing (`htmlContent`, `rawBuffer`, query truncation)
- `lib/runtime/log-components.ts` — 24 canonical component tags + `createComponentLogger()` factory
- 22 files already migrated to Pino (per `backend-logging-quality-consistency-review.md` v2.1)
- 2 known exceptions remain: `generation-actor.ts` (8 calls) and `tools-orchestrate-handlers.ts` (3 calls)

The prior review (`backend-logging-quality-consistency-review.md`) flagged `tools-orchestrate-handlers.ts` as blocked by test infrastructure (`captureOrchestrateStartMeta` monkey-patches `console.info`). `generation-actor.ts` was not addressed in that review.

## 2. Scope

### In scope

- Add `pino-http` middleware to backend Express server for Railway HTTP log capture
- Migrate `generation-actor.ts` from `console.*` to Pino via `createComponentLogger()`
- Migrate `tools-orchestrate-handlers.ts` from `console.*` to Pino (unblock test infra)
- Introduce correlation ID (`x-request-id`) generation and propagation across all log entries
- Normalize log levels: `info` for normal flow, `warn` for recoverable, `error` for failures
- Add `pino-http` to frontend `server.mjs` proxy

### Out of scope

- Log sampling / dynamic log level runtime adjustment
- Log aggregation or external shipping (e.g. DataDog, Grafana)
- Frontend application logging (browser-side)
- Railway HTTP log capture for Redis/Postgres services

## 3. Proposed Changes

### 3.1 Add Pino-HTTP Middleware (Backend)

**File:** `apps/backend/src/server.ts`

Add `pino-http` as Express middleware. This emits structured HTTP logs that Railway can capture.

```typescript
import pinoHttp from 'pino-http';
import { logger } from './lib/runtime/logger';

app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  customProps: (req) => ({
    requestId: req.id,
  }),
}));
```

**Impact:** Railway HTTP capture will show method, path, status, response time, and correlation ID per request.

### 3.2 Migrate generation-actor.ts to Pino

**File:** `apps/backend/src/lib/machines/generation-actor.ts`

Replace all 8 `console.*` calls with `createComponentLogger('generation-actor')`.

```typescript
import { createComponentLogger } from '../runtime/log-components';

const log = createComponentLogger('generation-actor');

// Replace: console.info('[generation-actor] asset injection start', { ... })
// With:    log.info({ requestId, toolKey, stepKey, assetRefCount, assetRefs }, 'asset injection start')
```

Add `GenerationActor` to `LogComponent` registry.

**Impact:** All generation-actor logs become structured Pino JSON, searchable by component tag.

### 3.3 Migrate tools-orchestrate-handlers.ts to Pino

**File:** `apps/backend/src/lib/runtime/auth-http/tools/tools-orchestrate-handlers.ts`

Current test infrastructure monkey-patches `console.info` via `captureOrchestrateStartMeta`. Migration steps:

1. Add Pino logger import
2. Replace 3 `console.*` calls with `log.info` / `log.warn` / `log.error`
3. Update `captureOrchestrateStartMeta` to intercept Pino logs instead of `console.info`, or inject a test logger instance

**Impact:** Last remaining `console.*` exception eliminated. Logging system fully unified under Pino.

### 3.4 Correlation ID Propagation

**Files:** `apps/backend/src/server.ts`, `apps/backend/src/lib/runtime/logger.ts`

1. Generate or extract `x-request-id` header in middleware
2. Attach to `req.id` (Pino HTTP auto-picks this up)
3. Pass `requestId` through generation pipeline context to `generation-actor`

```typescript
// server.ts middleware
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
  next();
});
```

**Impact:** Every log entry in a request chain shares the same correlation ID, enabling end-to-end tracing.

### 3.5 Log Level Normalization

Standardize across all backend files:

| Level | Usage |
|---|---|
| `info` | Normal flow: start/complete of operations, state transitions |
| `warn` | Recoverable issues: retries, fallbacks, staleness warnings |
| `error` | Failures: exceptions, timeouts, unrecoverable errors |
| `debug` | Development-only: verbose internal state (guarded by `LOG_LEVEL=debug`) |

**Specific fix:** `apps/backend/src/lib/runtime/integrations/github-issues.ts:86` — wrap `console.debug` behind `LOG_LEVEL` check or use Pino `log.debug`.

### 3.6 Frontend Proxy HTTP Logging

**File:** `apps/frontend/server.mjs`

Add `pino-http` to the Express proxy server for consistent observability across both services.

```javascript
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({ name: 'gen-app-2-frontend-proxy', level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
```

## 4. Files Changed

| File | Change |
|---|---|
| `apps/backend/src/server.ts` | Add `pino-http` middleware + correlation ID middleware |
| `apps/backend/src/lib/machines/generation-actor.ts` | Replace 8 `console.*` → Pino |
| `apps/backend/src/lib/runtime/log-components.ts` | Add `GENERATION_ACTOR` component |
| `apps/backend/src/lib/runtime/auth-http/tools/tools-orchestrate-handlers.ts` | Replace 3 `console.*` → Pino |
| `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts` | Update `captureOrchestrateStartMeta` for Pino |
| `apps/backend/src/lib/runtime/integrations/github-issues.ts` | Guard `console.debug` with log level |
| `apps/frontend/server.mjs` | Add `pino-http` middleware |
| `apps/frontend/package.json` | Add `pino` and `pino-http` dependencies |
| `apps/backend/package.json` | Add `pino-http` dependency |

## 5. Acceptance Criteria

1. `npm --workspace apps/backend run test` passes — all orchestrate tests updated for Pino migration
2. `npm --workspace apps/backend run typecheck` passes
3. Railway HTTP logs show structured entries with method, path, status, duration for `/generation/*` routes
4. `railway get-logs --log-type http` returns non-empty results for backend service in dev
5. `grep -r "console\.(info|warn|error|debug)" apps/backend/src/lib/` returns 0 results outside test/smoke files and `server.ts` bootstrap
6. Correlation ID present in all log entries across a single generation run
7. `npm --workspace apps/frontend run typecheck` and `npm --workspace apps/frontend run build` pass
8. `railway get-logs --log-type http` returns non-empty results for frontend service in dev

## 6. Implementation Order

| Phase | Items | Estimated Effort |
|---|---|---|
| Phase 1 | 3.1 Backend `pino-http` + 3.4 Correlation ID | 0.5 day |
| Phase 2 | 3.2 Migrate `generation-actor.ts` | 0.5 day |
| Phase 3 | 3.3 Migrate `tools-orchestrate-handlers.ts` + unblock tests | 0.5 day |
| Phase 4 | 3.5 Log level normalization | 0.5 day |
| Phase 5 | 3.6 Frontend proxy `pino-http` | 0.5 day |

Total: ~2.5 days.

## 7. Risks

| Risk | Mitigation |
|---|---|
| `pino-http` test interference (mocked Express app) | Phase 1 first, verify test pass before proceeding |
| Orchestrate test `captureOrchestrateStartMeta` refactor | Phase 3 isolated; rollback to `console.*` in test if needed temporarily |
| `pino-pretty` transport in non-dev breaks Railway log parsing | Keep `pino-pretty` only when `NODE_ENV=development`; Railway uses JSON stdout |
| Frontend `server.mjs` is CommonJS; `pino-http` ESM | Verify compatibility or use `pino-http@8` (CJS-compatible) |

## 8. Related Documents

- [Backend Logging Quality & Consistency Review](../07-governance/backend-logging-quality-consistency-review.md)
- [Proposal: Error Logging and UX Feedback Improvements](./proposal-error-logging-and-ux-feedback.md)
- [Production Observability Runbook](../04-testing/production-observability-runbook.md)