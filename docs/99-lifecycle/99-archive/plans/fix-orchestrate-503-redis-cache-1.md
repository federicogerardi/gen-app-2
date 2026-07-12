---
status: archived
version: 1.0
last-reviewed: 2026-07-08
next-review-date: 2027-01-08
owner: Backend Runtime
date_created: 2026-06-28
title: Fix Orchestrate 503 with Redis Cache Implementation
type: fix-plan
tags: [fix, orchestrate, redis-cache, connection-pool, timeout, archived]
goal: Fix orchestrate 503 deadline_exceeded errors with connection pool optimization and Redis cache implementation
---

# Fix: Orchestrate 503 — Hotfix + Redis Cache Strutturale

## Problema

`POST /api/tools/orchestrate` produce 503 (`deadline_exceeded`) quando chiamato durante uno
stream di generazione attivo. Il deadline è 5000ms; il secondo call nel log ha impiegato 9677ms.

**Root cause**: Il pool DB (`pg`) ha default `max: 10` connessioni. Durante lo stream il
`persistence batch` occupa connessioni con INSERT/UPDATE ad alta frequenza. Le query READ di
orchestrate attendono una connessione libera nel pool. L'attesa supera il deadline.

Le query stesse sono ottimali (indice parziale `artifacts_orchestrate_recent_completed_idx`), il
problema è la **contesa sul connection pool**, non la query.

---

## Fase 1 — Hotfix Immediato

**Obiettivo**: eliminare i 503 oggi, senza cambiamenti architetturali.

### 1.1 — Aumentare pool max

**File**: `apps/backend/src/server.ts`

Aggiungere supporto env var `PG_POOL_MAX` con default 20.

```typescript
// prima
const pg = new Pool({
    connectionString: databaseUrl,
});

// dopo
const pgPoolMax = Number.parseInt(process.env.PG_POOL_MAX ?? '20', 10);
const pg = new Pool({
    connectionString: databaseUrl,
    max: Number.isFinite(pgPoolMax) && pgPoolMax > 0 ? pgPoolMax : 20,
});
```

**Motivazione**: raddoppiare il pool da 10 a 20 lascia connessioni libere per orchestrate anche
durante generazioni attive. Il valore è env-configurabile per adattarsi a deployment con pool
Postgres esterni (Railway, Supabase).

### 1.2 — Aumentare il default del timeout orchestrate

**File**: `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-config.ts`

```typescript
// prima
export const DEFAULT_TOOLS_ORCHESTRATE_TIMEOUT_MS = 5_000;

// dopo
export const DEFAULT_TOOLS_ORCHESTRATE_TIMEOUT_MS = 15_000;
```

**Motivazione**: il timeout è già env-configurabile via `TOOLS_ORCHESTRATE_TIMEOUT_MS`. Alzare il
default a 15s dà margine sufficiente anche sotto carico, senza modificare il codice dell'handler.
Il timeout rimane un safety net, non un fix strutturale.

### Checklist di controllo Fase 1

| # | File | Test correlato | Check |
|---|------|----------------|-------|
| 1 | `apps/backend/src/server.ts` | Nessun test unitario (server entry). Verificare typecheck. | `npm --workspace apps/backend run typecheck` |
| 2 | `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-config.ts` | `runtime.tools-orchestrate.test.ts` riga 859: asserisce `deadlineMs: 5000`. **Aggiornare il test** al nuovo default 15000. | `node --import tsx --test src/lib/tests/runtime.tools-orchestrate.test.ts` |

---

## Fase 2 — Fix Strutturale: Redis Artifact Cache

**Obiettivo**: eliminare le query DB da orchestrate durante sessioni attive. Lettura da Redis
(<10ms) invece di scan su 120 artifact completati.

### Architettura della cache

```
KEY:   orchestrate:artifacts:{userId}:{projectId}:{workflowType}
TYPE:  Redis Hash
FIELD: {stepKey}
VALUE: {artifactId}
TTL:   14400s (4 ore)
```

**Popolazione**: `finalizeSuccess` nel layer di composizione adapter (non dentro
`PostgresArtifactRepository` per mantenere la separazione delle dipendenze).

**Lettura**: In `tools-orchestrate-handlers.ts`, prima delle query DB. Se la cache contiene tutti
i passi precedenti al `targetStep`, le query DB vengono saltate completamente.

**Fallback**: Se Redis è down o la cache è vuota (cold start, sessione vecchia), il codice
originale delle query DB rimane il fallback.

---

### 2.1 — Nuova interfaccia: `OrchestrateArtifactCache`

**File**: `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts`

Aggiungere interfaccia e aggiungerla a `PostgresRedisAdapterDependencies`:

```typescript
export interface OrchestrateArtifactCache {
  setStepArtifact(
    userId: string,
    projectId: string,
    workflowType: string,
    stepKey: string,
    artifactId: string,
  ): Promise<void>;

  getCompletedArtifactsByStep(
    userId: string,
    projectId: string,
    workflowType: string,
  ): Promise<Record<string, string>>;
}

// aggiungere a PostgresRedisAdapterDependencies
export interface PostgresRedisAdapterDependencies {
  // ... esistenti ...
  orchestrateCache: OrchestrateArtifactCache | null; // null = cache disabilitata (test stub)
}
```

### 2.2 — Nuova classe: `RedisOrchestrateArtifactCache`

**File nuovo**: `apps/backend/src/lib/adapters/redis-orchestrate-artifact-cache.ts`

```typescript
import type Redis from 'ioredis';
import type { OrchestrateArtifactCache } from './postgres-redis.interfaces';

const DEFAULT_PREFIX = 'orchestrate:artifacts';
const DEFAULT_TTL_SECONDS = 14_400; // 4 ore

export class RedisOrchestrateArtifactCache implements OrchestrateArtifactCache {
  private readonly prefix: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    options: { prefix?: string; ttlSeconds?: number } = {},
  ) {
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private buildKey(userId: string, projectId: string, workflowType: string): string {
    return `${this.prefix}:${userId}:${projectId}:${workflowType}`;
  }

  async setStepArtifact(
    userId: string,
    projectId: string,
    workflowType: string,
    stepKey: string,
    artifactId: string,
  ): Promise<void> {
    const key = this.buildKey(userId, projectId, workflowType);
    // HSET campo + EXPIRE atomico con pipeline
    const pipeline = this.redis.pipeline();
    pipeline.hset(key, stepKey, artifactId);
    pipeline.expire(key, this.ttlSeconds);
    await pipeline.exec();
  }

  async getCompletedArtifactsByStep(
    userId: string,
    projectId: string,
    workflowType: string,
  ): Promise<Record<string, string>> {
    const key = this.buildKey(userId, projectId, workflowType);
    const result = await this.redis.hgetall(key);
    return result ?? {};
  }
}
```

**Nota Kysely**: questa classe non usa Kysely — è Redis-only. Kysely viene usato solo dalle classi
che parlano con Postgres. L'isolamento è corretto.

### 2.3 — Wrap di `finalizeSuccess` nel layer adapter

**File**: `apps/backend/src/lib/adapters/postgres-redis.adapters.ts`

```typescript
// Aggiungere nella finalizeSuccess wrapper:
persistence: {
  flushProgress: (input, sequence) => dependencies.persistence.flushProgress(input, sequence),
  finalizeSuccess: async (input) => {
    await dependencies.persistence.finalizeSuccess(input);
    // Scrittura cache Redis: solo per artifact di tool multi-step con userId e projectId noti
    if (
      dependencies.orchestrateCache
      && input.userId
      && input.projectId
      && input.inputJson?.toolWorkflow
    ) {
      const tw = input.inputJson.toolWorkflow as Record<string, unknown>;
      const stepKey = typeof tw.stepKey === 'string' && tw.stepKey.trim() ? tw.stepKey.trim() : null;
      if (stepKey) {
        const workflowType = typeof input.workflowType === 'string' ? input.workflowType : null;
        if (workflowType) {
          // Fire-and-forget: cache write non deve bloccare la response
          void dependencies.orchestrateCache
            .setStepArtifact(input.userId, input.projectId, workflowType, stepKey, input.artifactId)
            .catch((err) => console.warn('[orchestrate-cache] setStepArtifact failed (non-fatal)', err));
        }
      }
    }
  },
  finalizeFailure: (input, reason) => dependencies.persistence.finalizeFailure(input, reason),
},
```

**Fire-and-forget rationale**: la cache Redis è ottimistica. Un'eventuale write failure non deve
bloccare il successo della generazione. Il fallback al DB garantisce la correttezza.

### 2.4 — Lettura cache in `tools-orchestrate-handlers.ts`

**File**: `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`

Aggiungere `orchestrateCache: OrchestrateArtifactCache | null` alle dipendenze del handler. Nella
pipeline di esecuzione, prima di `listRecentCompletedArtifactsForToolByUser`:

```typescript
// Tentativo cache-first
let cacheHit = false;
if (deps.orchestrateCache) {
  try {
    const cachedByStep = await deps.orchestrateCache.getCompletedArtifactsByStep(
      principal.user.id,
      projectId,
      workflowType,
    );
    const resolved = resolveStepDependencyIds(toolKey, targetStep, cachedByStep);
    if (resolved.stepDependencyArtifactIds.length > 0 || stepIndex === 0) {
      // Cache sufficiente: ritorna senza query DB
      stepDependencyArtifactIds = resolved.stepDependencyArtifactIds;
      dependencyArtifactIdsByStep = resolved.dependencyArtifactIdsByStep;
      cacheHit = true;
    }
  } catch (err) {
    console.warn('[orchestrate-cache] read failed (fallback to DB)', err);
  }
}

if (!cacheHit) {
  // Percorso DB originale (invariato)
  ({ stepDependencyArtifactIds, dependencyArtifactIdsByStep } = await runGenerationRoutePipeline(...));
}
```

**Nota**: lo step index 0 (primo passo, nessuna dipendenza) può essere risolto subito dalla cache
senza attendere che la cache venga popolata, perché `resolveStepDependencyIds` restituirà sempre
`[]` per il primo step indipendentemente dal contenuto della cache.

### 2.5 — Registrazione in `postgres-redis.production.ts`

**File**: `apps/backend/src/lib/adapters/postgres-redis.production.ts`

```typescript
import { RedisOrchestrateArtifactCache } from './redis-orchestrate-artifact-cache';

// In createPostgresRedisProductionDependencies:
orchestrateCache: new RedisOrchestrateArtifactCache(clients.redis, options.orchestrateCache),
```

Aggiungere `orchestrateCache?: { prefix?: string; ttlSeconds?: number }` a
`PostgresRedisProductionOptions` in `postgres-redis.shared.types.ts`.

### 2.6 — Aggiornare il runtime server per passare la cache all'handler orchestrate

**File**: `apps/backend/src/lib/runtime/auth-http/` (dove viene creato il handler orchestrate)

Passare `generationAdapters.orchestrateCache` alle dipendenze di `createToolsOrchestrateHandlers`.

---

### Checklist di controllo Fase 2

| # | File | Tipo modifica | Test richiesto |
|---|------|---------------|----------------|
| 1 | `apps/backend/src/lib/adapters/postgres-redis.interfaces.ts` | Nuova interfaccia + aggiornamento deps | Test type-check |
| 2 | `apps/backend/src/lib/adapters/redis-orchestrate-artifact-cache.ts` | Nuovo file | `runtime.redis-orchestrate-cache.test.ts` (nuovo) |
| 3 | `apps/backend/src/lib/adapters/postgres-redis.adapters.ts` | Wrap finalizeSuccess | `generation-system.runtime.test.ts` (esistente, verificare no regression) |
| 4 | `apps/backend/src/lib/adapters/postgres-redis.shared.types.ts` | Aggiungere opzione cache | Typecheck |
| 5 | `apps/backend/src/lib/adapters/postgres-redis.production.ts` | Istanziare RedisOrchestrateArtifactCache | Typecheck |
| 6 | `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts` | Cache-first lookup | `runtime.tools-orchestrate.test.ts` (esistente + nuovi casi) |
| 7 | `apps/backend/src/server.ts` | Passare cache al runtime | Typecheck |

---

## Test da scrivere o aggiornare

### Test nuovi: `runtime.redis-orchestrate-cache.test.ts`

| Test case | Cosa verifica |
|-----------|---------------|
| `setStepArtifact scrive in Redis Hash con chiave corretta` | hset + expire chiamati con key e TTL |
| `getCompletedArtifactsByStep restituisce mappa step→artifactId` | hgetall deserializzato correttamente |
| `getCompletedArtifactsByStep restituisce {} per cache miss` | nessun errore su chiave assente |
| `setStepArtifact sovrascrive artifactId più recente per stesso step` | HSET sovrascrive field |
| `pipeline exec usato per atomicità hset+expire` | pipeline.exec chiamato |

### Test da aggiornare: `runtime.tools-orchestrate.test.ts`

| Riga | Test esistente | Aggiornamento necessario |
|------|----------------|--------------------------|
| 859 | `assert.equal(startMeta.deadlineMs, 5000)` | **Cambiare a 15000** dopo Fase 1 |
| Nuovi | Cache hit: orchestrate risolve da cache senza query DB | Aggiungere mock cache, verificare che `listRecentCompletedArtifactsForToolByUser` non sia chiamato |
| Nuovi | Cache miss: orchestrate fa fallback al DB originale | Cache vuota → DB query eseguita |
| Nuovi | Cache Redis down (error): orchestrate fa fallback al DB | Cache throws → warn log + DB query |
| Nuovi | Primo step (no dipendenze): cache risolve immediatamente | stepDependencyArtifactIds = [] senza DB query |

### Test esistenti da eseguire senza modifiche (regression check)

| File | Comando |
|------|---------|
| `runtime.tools-orchestrate.test.ts` | `node --import tsx --test src/lib/tests/runtime.tools-orchestrate.test.ts` |
| `generation-system.runtime.test.ts` | `node --import tsx --test src/lib/tests/generation-system.runtime.test.ts` |
| `persistence-batch.machine.test.ts` | `node --import tsx --test src/lib/tests/persistence-batch.machine.test.ts` |
| Full suite | `npm --workspace apps/backend run test` |
| Typecheck | `npm --workspace apps/backend run typecheck` |

---

## Osservazione su Kysely — Nessuna Ottimizzazione Necessaria

Dopo analisi:

1. **Indice parziale** (`artifacts_orchestrate_recent_completed_idx`) già ottimale:
   `(user_id, project_id, workflow_type, updated_at DESC, id DESC) WHERE status = 'completed'`.
   La query usa `a.status = 'completed'` come literal inline (non parametrizzato) specificamente
   per consentire al planner PostgreSQL di usare questo indice — design corretto.

2. **Istanze Kysely**: `PostgresArtifactQueryRepository` crea una nuova istanza `Kysely` nel
   costruttore. Alcuni adapter usano un modulo-level cache (`_kyselyDbCache`). Entrambi i pattern
   sono corretti — `Kysely` non tiene connessioni, le gestisce il `Pool`. Non c'è overhead.

3. **`id = ANY($1::text[])`** in `getArtifactsByIdsForUser`: uso corretto di ANY con cast
   esplicito. Il planner usa l'index su `id` (primary key). Già ottimale.

4. **Un pattern ridondante trovato**: la Fase 2 rende l'intera coppia di query
   (`listRecentCompletedArtifactsForToolByUser` + `getArtifactsByIdsForUser`) superflua per le
   call durante sessioni attive. La Redis cache sostituisce entrambe in un singolo `HGETALL`.

---

## Ordine di esecuzione

```
Fase 1:  server.ts pool max  →  orchestrate-config.ts timeout  →  aggiornare test riga 859
         → npm run test (backend)  → npm run typecheck

Fase 2:  interfaces.ts  →  redis-orchestrate-artifact-cache.ts  →  postgres-redis.adapters.ts
         →  shared.types.ts  →  production.ts  →  tools-orchestrate-handlers.ts  →  server.ts
         → scrivere runtime.redis-orchestrate-cache.test.ts
         → aggiornare runtime.tools-orchestrate.test.ts (nuovi casi)
         → npm run test (backend)  →  npm run typecheck
```