---
status: active
version: 1.0
date_created: 2026-07-15
last-reviewed: 2026-07-15
next-review-date: 2026-10-15
owner: Backend Runtime
type: code-review
tags: [logging, quality, consistency, pino, geometric-logger, console, observability]
---

# Backend Logging Quality & Consistency Review

## Scope

Valutazione della qualità del sistema di logging backend. Identifica ogni file che usa logging e ne classifica la coerenza con l'architettura dichiarata: **Pino** come logger strutturato principale e **geometric-logger** per le operazioni Geometric.

Risultato: il sistema di logging è frammentato. Pino è usato da **1 solo file** su 28+. Tutti gli altri usano `console.*` diretto.

---

## A. Architettura Dichiarata vs Realtà

| | Dichiarato | Effettivo |
|---|---|---|
| **Logger primario** | Pino (`lib/runtime/logger.ts`) | `console.*` in 22 file |
| **Logger Geometric** | `geometric-logger.ts` wrapper | Usato da 3 file; 1 file lo bypassa |
| **Copertura Pino** | Progettato per tutto il backend | 1 file (`idempotency-coordinator.machine.ts`) |

Il Pino logger ha configurazione completa (level via `LOG_LEVEL`, pretty-print in dev, JSON in prod) ma è praticamente inutilizzato. Il `geometric-logger` è usato correttamente dai suoi 3 consumer primari, ma un quarto file (`context-generation-assembly.ts`) lo aggira scrivendo `console.info('[geometric] ...')` manualmente.

---

## B. Classificazione Completa

### B1. Pino — Uso Corretto (1 file)

| File | Pattern |
|---|---|
| `lib/machines/idempotency-coordinator.machine.ts` | `logger.child({...}).warn({...})` |

### B2. Geometric Logger — Uso Corretto (3 file)

| File | Import |
|---|---|
| `lib/machines/generation/crawling-chain.machine.ts` | `logGeometricInfo`, `logGeometricWarn`, `logGeometricError` |
| `lib/machines/tool-workflow.machine.ts` | `logGeometricInfo`, `logGeometricError` |
| `lib/machines/generation-system.actors.ts` | `logGeometricInfo`, `logGeometricWarn`, `logGeometricError` |

### B3. Console Direct — Inconsistente (22 file)

#### Runtime Layer (6 file)

| File | Prefisso usato | Note |
|---|---|---|
| `server.ts` | `[startup]`, `[gen][model-cache]` | Startup + model cache logging |
| `lib/runtime/node-server.ts` | `[req]`, `[res]`, `[err]`, `[gen][bad_request]` | HTTP lifecycle, gated in prod |
| `lib/runtime/backend-session.ts` | `[gen][session-start]`, `[gen][session-terminal]`, `[gen][json-session-start]`, `[gen][json-session-terminal]` | Session boundary logging |
| `lib/runtime/generation-handler.ts` | `[gen][session-escalation]` | Error escalation |
| `lib/runtime/generation-stream-observability.ts` | `[gen][request]`, `[gen][model-check]`, `[gen][stream-error]` | Debug osservabilità |
| `lib/runtime/generation-route-pipeline.ts` | `[gen-route][start]`, `[gen-route][ok]`, `[gen-route][error]` | Definisce interfaccia `GenerationRoutePipelineLogger` ma default = console |

#### Machine Layer (1 file) — Geometric Bypass

| File | Problema |
|---|---|
| `lib/machines/generation/context-generation-assembly.ts` | Scrive `console.info('[geometric] ...')` **direttamente** senza importare `geometric-logger.ts`. Salta la sanitizzazione (`truncateQuery`, rimozione contenuti binari/HTML) applicata dal wrapper. Inconsistente con `crawling-chain.machine.ts`, `tool-workflow.machine.ts`, e `generation-system.actors.ts` che usano `logGeometric*` correttamente. |

#### Auth-HTTP Handlers (4 file)

| File | Prefisso usato | Note |
|---|---|---|
| `lib/runtime/auth-http/runtime.ts` | `[auth-http]` | Unhandled errors |
| `lib/runtime/auth-http/tools/tools-orchestrate-handlers.ts` | `[orchestrate-cache]` | Cache warnings + pipeline logger callbacks |
| `lib/runtime/auth-http/tools/tools-hydrate-handlers.ts` | n/a | Solo `debugLog()` gated |
| `lib/runtime/auth-http/admin/admin-feedback-center-handlers.ts` | n/a | Gated debug + ungated `console.error` |

#### Integrations (5 file)

| File | Prefisso usato | Note |
|---|---|---|
| `lib/runtime/integrations/geometric-logger.ts` | `[geometric]` | È la definizione stessa del wrapper (usa console internamente) |
| `lib/runtime/integrations/serpapi-service-resolver.ts` | `SerpApi service ...` | Warning non strutturati |
| `lib/runtime/integrations/github-config.ts` | `[readGitHubApiConfigFromEnv]` | Gated diagnostic |
| `lib/runtime/integrations/crawling-queue.ts` | `[crawling-queue]` | Job lifecycle |
| `lib/runtime/integrations/github-issues.ts` | `[publishGitHubIssue]` | Gated debug + ungated errors |

#### Adapters (6 file)

| File | Prefisso usato | Note |
|---|---|---|
| `lib/adapters/openrouter.adapter.ts` | `[openrouter]` | Gated diagnostic |
| `lib/adapters/user-report.adapter.ts` | `[createUserReport]` | Insert lifecycle |
| `lib/adapters/user-report-github-link.adapter.ts` | `[publishUserReportIssueTransaction]` | Transaction lifecycle |
| `lib/adapters/postgres-redis.adapters.ts` | `[orchestrate-cache]` | Non-fatal cache warnings |
| `lib/adapters/postgres-redis.production.ts` | `[adapter][llm]`, `[adapter][generate]` | LLM key availability |
| `lib/adapters/smoke-cleanup.ts` | n/a | Cleanup warnings |

---

## C. Problemi di Qualità — Dettaglio

### C1. `context-generation-assembly.ts` — Bypass del Geometric Logger (CRITICAL)

**File:** `apps/backend/src/lib/machines/generation/context-generation-assembly.ts`

```typescript
// Riga 92 — INCONSISTENTE
console.info(`[geometric] assembly.strategic_reporting`, { ... });
// Riga 136
console.info(`[geometric] assembly.unified_report`, { ... });
// Riga 158
console.info(`[geometric] assembly.select`, { ... });
```

Dovrebbe essere:
```typescript
import { logGeometricInfo } from '../../runtime/integrations/geometric-logger';
logGeometricInfo('assembly.strategic_reporting', { ... });
logGeometricInfo('assembly.unified_report', { ... });
logGeometricInfo('assembly.select', { ... });
```

**Impatto:** Le chiamate saltano `sanitizeMeta()` che tronca `baseQuery`/`paaQuery` a 80 caratteri e rimuove `htmlContent`/`rawBuffer`. Se questi campi sono presenti nel meta passato, finiscono non sanitizzati nei log. Inoltre il `requestId` non viene validato.

### C2. Pino Logger Inutilizzato — 27 File Mancanti (HIGH)

Il file `lib/runtime/logger.ts` esporta un logger Pino perfettamente configurato ma è importato solo da 1 file. I 27 file rimanenti usano `console.*` con prefissi testuali fatti a mano.

**File che dovrebbero usare Pino (priorità alta):**

| Priorità | File | Motivo |
|---|---|---|
| 1 | `backend-session.ts` | Log di inizio/fine sessione — è il punto di correlazione primario |
| 1 | `node-server.ts` | Log HTTP request/response — ciclo di vita centrale |
| 1 | `generation-handler.ts` | Errori di escalation — diagnostica errori |
| 2 | `server.ts` | Startup e model cache — diagnostica avvio |
| 2 | `tools-orchestrate-handlers.ts` | Orchestrazione tool — punto di debugging corrente |
| 3 | `crawling-queue.ts` | Job crawling — operazioni asincrone |
| 3 | `github-issues.ts` | Pubblicazione issue — errori non recuperabili |
| 3 | `postgres-redis.adapters.ts` | Cache warnings — diagnostica infrastruttura |

**File che dovrebbero usare Geometric Logger (priorità alta):**

| Priorità | File | Motivo |
|---|---|---|
| 1 | `context-generation-assembly.ts` | Già usa prefisso `[geometric]` — basta cambiare l'import |

### C3. `console.error` Non Protetti in Produzione (MEDIUM)

7 file chiamano `console.error` senza alcun gate. In produzione questi generano rumore non strutturato che si mescola con l'output JSON di Pino (se mai venisse adottato).

| File | Linea | Contenuto |
|---|---|---|
| `server.ts` | 278 | `console.error(error)` — panic startup |
| `node-server.ts` | 353 | `console.error('[err] ...')` — errori non gestiti |
| `auth-http/runtime.ts` | 266 | `console.error('[auth-http] unhandled error ...')` |
| `admin-feedback-center-handlers.ts` | 448 | `console.error('[POST ...] Error during publication:', ...)` |
| `github-issues.ts` | 163, 177, 186 | `console.error('[publishGitHubIssue] ...')` |
| `user-report.adapter.ts` | 69 | `console.error('[createUserReport] Error during insert:', ...)` |
| `smoke-cleanup.ts` | 20 | `console.error('Smoke cleanup warning:', error)` |

### C4. Prefissi Testuali Non Standardizzati (LOW)

I prefissi `[gen]`, `[geometric]`, `[req]`, `[err]`, `[startup]`, `[auth-http]`, `[orchestrate-cache]`, `[crawling-queue]`, `[openrouter]`, `[adapter]` sono inventati ad-hoc per ogni file. Non esiste un registro centralizzato. Con Pino, questi diventerebbero campi strutturati (`{ component: 'node-server', event: 'request.start' }`) invece di stringhe.

### C5. `GenerationRoutePipelineLogger` — Interfaccia Iniettabile ma Default Console (LOW)

L'interfaccia in `generation-route-pipeline.ts` è un buon pattern (logger iniettabile) ma:
- Il default `defaultLogger` usa `console.*`
- L'unico consumer (`tools-orchestrate-handlers.ts`) passa callback che wrappano `console.*`
- Nessuno passa mai un'istanza Pino

---

## D. Raccomandazioni

### D1. Fix Immediato: `context-generation-assembly.ts`

Sostituire le 3 chiamate `console.info('[geometric] ...')` con `logGeometricInfo(...)` importando da `geometric-logger.ts`. Allineare con `crawling-chain.machine.ts` e `generation-system.actors.ts`.

**File:** `apps/backend/src/lib/machines/generation/context-generation-assembly.ts`
**Effort:** 5 minuti. Nessun test da modificare.

### D2. Adozione Progressiva di Pino (Roadmap)

Fase 1 — Session boundary (impatto massimo per debugging):
- `backend-session.ts`: `logger.child({ correlationId, requestId })` per `session-start`/`session-terminal`/`json-session-start`/`json-session-terminal`
- `node-server.ts`: `logger.child({ requestId })` per `[req]`/`[res]`/`[err]`
- `generation-handler.ts`: `logger.child({ correlationId }).error(...)` per escalation

Fase 2 — Infrastruttura:
- `server.ts`: `logger.info(...)` per startup
- `postgres-redis.adapters.ts`: `logger.warn(...)` per cache warnings
- `postgres-redis.production.ts`: `logger.warn(...)` per adapter availability

Fase 3 — Integrations:
- `crawling-queue.ts`, `github-issues.ts`, `serpapi-service-resolver.ts`

Fase 4 — Adapters e handlers:
- `user-report.adapter.ts`, `user-report-github-link.adapter.ts`, `openrouter.adapter.ts`
- `auth-http/runtime.ts`, `admin-feedback-center-handlers.ts`

### D3. Registro Centralizzato dei Prefissi

Creare `apps/backend/src/lib/runtime/log-prefixes.ts`:

```typescript
export const LogComponent = {
  SERVER: 'server',
  NODE_SERVER: 'node-server',
  BACKEND_SESSION: 'backend-session',
  GENERATION_HANDLER: 'generation-handler',
  ORCHESTRATE: 'orchestrate',
  CRAWLING_QUEUE: 'crawling-queue',
  GITHUB_ISSUES: 'github-issues',
  OPENROUTER: 'openrouter',
  USER_REPORT: 'user-report',
  POSTGRES_REDIS: 'postgres-redis',
  // ...
} as const;
```

Da usare come `logger.child({ component: LogComponent.NODE_SERVER }).info(...)` al posto dei prefissi testuali.

### D4. Gate per `console.error` in Produzione

Sostituire le 7 chiamate `console.error` non gatate con `logger.error(...)` (Pino) o con un wrapper che rispetti `LOG_LEVEL`. In subordine, wrappare con `if (process.env.NODE_ENV !== 'production' || process.env.GENERATION_DEBUG_LOGS === '1')`.

### D5. `GenerationRoutePipelineLogger` → Pino

Modificare `defaultLogger` in `generation-route-pipeline.ts` per usare Pino:

```typescript
import { logger } from './logger';

const defaultLogger: GenerationRoutePipelineLogger = {
  info: (message, meta) => logger.info(meta, message),
  warn: (message, meta) => logger.warn(meta, message),
  error: (message, meta) => logger.error(meta, message),
};
```

---

## E. Riepilogo Quantitativo

| Metrica | Valore |
|---|---|
| File totali con logging | 28 |
| File che usano Pino | 1 (3.6%) |
| File che usano Geometric Logger | 3 (10.7%) |
| File che usano solo `console.*` | 22 (78.6%) |
| File che bypassano il geometric-logger | 1 (`context-generation-assembly.ts`) |
| File con `console.error` non gated | 7 |
| Interfacce logger iniettabili definite | 1 (`GenerationRoutePipelineLogger`) |
| Interfacce logger iniettabili con impl Pino | 0 |
