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

Valutazione della qualità del sistema di logging backend. Identifica ogni file che usa logging e ne classifica la coerenza con l'architettura dichiarata: **Pino** come logger strutturato principale.

**v2.0 (2026-07-15)**: Unificazione completata. Tutti i file operazionali usano Pino tramite `createComponentLogger()`. `geometric-logger.ts` rimosso. Rimane 1 eccezione nota (pipeline logger in `tools-orchestrate-handlers.ts`).

Risultato: il sistema di logging è unificato sotto Pino. **22 file** migrati, **2 nuovi moduli** creati, **2 file** eliminati.

---

## A. Architettura Dichiarata vs Realtà (Post-Unification)

| | Dichiarato | Effettivo |
|---|---|---|
| **Logger primario** | Pino (`lib/runtime/logger.ts`) | Pino — usato da **22+ file** via `createComponentLogger()` |
| **Component registry** | `log-components.ts` | ✅ Creato — 21 componenti canonici |
| **Serializers** | `log-serializers.ts` | ✅ Creato — `baseQuery`/`paaQuery` truncation, `htmlContent`/`rawBuffer` removal |
| **geometric-logger** | Eliminato | ✅ Rimosso — foldato nei serializer Pino |
| **Copertura Pino** | Tutti i file operazionali | 22/22 file migrati (1 eccezione nota) |

---

## B. Classificazione Completa (Post-Unification)

### B1. Pino — `createComponentLogger()` (22 file)

| Fase | File | Componente |
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

### B2. Eccezione Nota — Pipeline Logger (1 file)

| File | Pattern | Motivo |
|---|---|---|
| `tools-orchestrate-handlers.ts` | `console.info/warn/error` nei callback del pipeline logger | Test `captureOrchestrateStartMeta` monkey-patches `console.info` per catturare l'output del pipeline. Migrazione richiede aggiornamento infrastruttura test. |

### B3. File Eliminati (2)

| File | Motivo |
|---|---|
| `geometric-logger.ts` | Foldato nei serializer Pino (`log-serializers.ts`) |
| `runtime.geometric-logger.test.ts` | Test del sanitization ora coperto dai serializer Pino |

---

## C. Problemi Risolti

### C1. ~~`context-generation-assembly.ts` — Bypass del Geometric Logger~~ ✅ RISOLTO

Le 3 chiamate `console.info('[geometric] ...')` sono state migrate a `glog.info({...}, 'assembly.*')` tramite `createComponentLogger(LogComponent.GEOMETRIC)`. Sanitizzazione ora gestita dai serializer Pino globali.

### C2. ~~Pino Logger Inutilizzato~~ ✅ RISOLTO

22 file ora usano Pino tramite `createComponentLogger()`. Il `geometric-logger.ts` è stato eliminato.

### C3. ~~`console.error` Non Protetti in Produzione~~ ✅ RISOLTO

Tutte le 7 chiamate `console.error` non gatate sono state migrate a `log.error()` con struttura Pino. L'unica eccezione è il pipeline logger in `tools-orchestrate-handlers.ts`.

### C4. ~~Prefissi Testuali Non Standardizzati~~ ✅ RISOLTO

I prefissi ad-hoc sono stati sostituiti dal `LogComponent` registry centralizzato in `log-components.ts`. Ogni file usa `createComponentLogger(LogComponent.XXX)` con componente canonico.

### C5. ~~`GenerationRoutePipelineLogger` — Default Console~~ ✅ RISOLTO

Il `defaultLogger` in `generation-route-pipeline.ts` ora usa Pino (`logger.info(meta, message)`). I serializers Pino sono wiringati globalmente.

---

## D. Metriche Post-Unification

| Metrica | Prima | Dopo |
|---|---|---|
| File che usano Pino | 1 (3.6%) | **22+ (100% operazionale)** |
| File che usano geometric-logger | 3 (10.7%) | **0 (eliminato)** |
| File che usano solo `console.*` | 22 (78.6%) | **1 (pipeline logger — eccezione nota)** |
| File con `console.error` non gated | 7 | **0** |
| Componenti registry | 0 | **21** |
| Serializer Pino | 0 | **4** (`baseQuery`, `paaQuery`, `htmlContent`, `rawBuffer`) |
| Interfacce logger iniettabili con impl Pino | 0 | **1** (`GenerationRoutePipelineLogger`) |

---

## E. Rollback

Ogni fase è autocontenuta. `git revert <phase-commit>` annulla quella fase senza affectare le precedenti.

---

## F. Review History

| Versione | Data | Cambiamento |
|---|---|---|
| 1.0 | 2026-07-15 | Review iniziale — logging frammentato, 22 file su console.* |
| 2.0 | 2026-07-15 | Unificazione completata — 22 file migrati a Pino, geometric-logger eliminato |
