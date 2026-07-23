---
status: active
version: 2.0
date_created: 2026-07-15
last-reviewed: 2026-07-15
next-review-date: 2026-10-15
owner: Backend Runtime
type: code-review
tags: [logging, quality, consistency, pino, geometric-logger, console, observability]
---

# Backend Logging Quality & Consistency Review

## Scope

Assessment of backend logging system quality. Identifies every file that uses logging and classifies its consistency with the declared architecture: **Pino** as the primary structured logger.

**v2.0 (2026-07-15)**: Unification completed. All operational files use Pino via `createComponentLogger()`. `geometric-logger.ts` removed. 1 known exception remains (pipeline logger in `tools-orchestrate-handlers.ts`).

Result: the logging system is unified under Pino. **22 files** migrated, **2 new modules** created, **2 files** eliminated.

---

## A. Declared Architecture vs Reality (Post-Unification)

| | Declared | Actual |
|---|---|---|
| **Primary logger** | Pino (`lib/runtime/logger.ts`) | Pino — used by **22+ files** via `createComponentLogger()` |
| **Component registry** | `log-components.ts` | ✅ Created — 21 canonical components |
| **Serializers** | `log-serializers.ts` | ✅ Created — `baseQuery`/`paaQuery` truncation, `htmlContent`/`rawBuffer` removal |
| **geometric-logger** | Eliminated | ✅ Removed — folded into Pino serializers |
| **Pino coverage** | All operational files | 22/22 files migrated (1 known exception) |

---

## B. Complete Classification (Post-Unification)

### B1. Pino — `createComponentLogger()` (22 files)

| Phase | File | Component |
|---|---|---|
| 0 | `generation-route-pipeline.ts` | `generation-route-pipeline` (defaultLogger) |
| 1 | `backend-session.ts` | `backend-session` |
| 1 | `node-server.ts` | `node-server` |
| 1 | `generation-handler.ts` | `generation-handler` |
| 1 | `generation-stream-observability.ts` | `generation-stream-observability` |
| 2 | `crawling-chain.machine.ts` | `geometric` |
| 2 | `tool-workflow.machine.ts` | `geometric` |
| 2 | `generation-system.actors.ts` | `geometric` |
| 2 | `context-generation-assembly.ts` | `geometric` |
| 2 | `idempotency-coordinator.machine.ts` | `idempotency-coordinator` |
| 3 | `server.ts` | `server` |
| 3 | `postgres-redis.adapters.ts` | `postgres-redis` |
| 3 | `postgres-redis.production.ts` | `llm-adapter` |
| 4 | `crawling-queue.ts` | `crawling-queue` |
| 4 | `github-issues.ts` | `github-issues` |
| 4 | `serpapi-service-resolver.ts` | `serpapi-resolver` |
| 4 | `github-config.ts` | `github-config` |
| 5 | `openrouter.adapter.ts` | `openrouter` |
| 5 | `user-report.adapter.ts` | `user-report` |
| 5 | `user-report-github-link.adapter.ts` | `user-report-github-link` |
| 5 | `auth-http/runtime.ts` | `node-server` |
| 5 | `admin-feedback-center-handlers.ts` | `feedback-center` |
| 6 | `smoke-cleanup.ts` | `smoke-cleanup` |

### B2. Known Exception — Pipeline Logger (1 file)

| File | Pattern | Reason |
|---|---|---|
| `tools-orchestrate-handlers.ts` | `console.info/warn/error` in pipeline logger callbacks | Test `captureOrchestrateStartMeta` monkey-patches `console.info` to capture pipeline output. Migration requires test infrastructure update. |

### B3. Eliminated Files (2)

| File | Reason |
|---|---|
| `geometric-logger.ts` | Folded into Pino serializers (`log-serializers.ts`) |
| `runtime.geometric-logger.test.ts` | Sanitization test now covered by Pino serializers |

---

## C. Resolved Issues

### C1. ~~`context-generation-assembly.ts` — Geometric Logger Bypass~~ ✅ RESOLVED

The 3 `console.info('[geometric] ...')` calls have been migrated to `glog.info({...}, 'assembly.*')` via `createComponentLogger(LogComponent.GEOMETRIC)`. Sanitization now handled by global Pino serializers.

### C2. ~~Unused Pino Logger~~ ✅ RESOLVED

22 files now use Pino via `createComponentLogger()`. The `geometric-logger.ts` has been eliminated.

### C3. ~~Unprotected `console.error` in Production~~ ✅ RESOLVED

All 7 ungated `console.error` calls have been migrated to `log.error()` with Pino structure. The only exception is the pipeline logger in `tools-orchestrate-handlers.ts`.

### C4. ~~Non-Standardized Textual Prefixes~~ ✅ RESOLVED

Ad-hoc prefixes have been replaced by the centralized `LogComponent` registry in `log-components.ts`. Each file uses `createComponentLogger(LogComponent.XXX)` with canonical component.

### C5. ~~`GenerationRoutePipelineLogger` — Default Console~~ ✅ RESOLVED

The `defaultLogger` in `generation-route-pipeline.ts` now uses Pino (`logger.info(meta, message)`). Pino serializers are wired globally.

---

## D. Post-Unification Metrics

| Metric | Before | After |
|---|---|---|
| Files using Pino | 1 (3.6%) | **22+ (100% operational)** |
| Files using geometric-logger | 3 (10.7%) | **0 (eliminated)** |
| Files using only `console.*` | 22 (78.6%) | **1 (pipeline logger — known exception)** |
| Files with ungated `console.error` | 7 | **0** |
| Registry components | 0 | **21** |
| Pino serializers | 0 | **4** (`baseQuery`, `paaQuery`, `htmlContent`, `rawBuffer`) |
| Injectable logger interfaces with Pino impl | 0 | **1** (`GenerationRoutePipelineLogger`) |

---

## E. Rollback

Each phase is self-contained. `git revert <phase-commit>` reverts that phase without affecting previous ones.

---

## F. Review History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-15 | Initial review — fragmented logging, 22 files on console.* |
| 2.0 | 2026-07-15 | Unification completed — 22 files migrated to Pino, geometric-logger eliminated |
