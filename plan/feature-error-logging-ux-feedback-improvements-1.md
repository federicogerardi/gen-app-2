---
goal: Implementazione strutturata di error logging e miglioramenti UX feedback per generation/run failures
version: 1.1
date_created: 2026-07-06
last_updated: 2026-07-06
last-reviewed: 2026-07-06
next-review-date: 2026-08-06
owner: Backend Runtime + Frontend Platform
status: draft
tags: [plan, error-logging, ux-feedback, observability, proxy, idempotency, generation-system, pino, correlation-id]
source_proposal: docs/02-design/proposal-error-logging-and-ux-feedback.md
dependencies: [pino, correlation-id, uuid, pino-pretty, tap-spec]
---

# Piano Implementazione: Error Logging and UX Feedback Improvements

## 1. Obiettivo

Migliorare **observability** e **UX feedback** per 3 classi di errori production identificati dall'analisi logs del 30/06/2026:

| Error Class | Impatto | Problema Observability |
|---|---|---|
| `idempotency_conflict` | Silent 500 → DispatchError | No requestId nei proxy logs |
| `ECONNRESET` su `/generation/run` | Socket hang up → recovery unclear | Proxy log senza request context |
| Duplicate step dispatch | Transient 500, self-recovers | No correlazione FE/BE logs |

**Deliverable:** Structured logging per correlation FE↔BE + UX messaging specifico per timeout/idempotency scenarios + centralized logging infrastructure.

## 2. Dependencies Requirements

### 2.1 Minimal Implementation Dependencies

**Backend structured logging:**
```bash
npm --workspace apps/backend install pino
npm --workspace apps/backend install --save-dev pino-pretty
```

**Request correlation:**
```bash
npm --workspace apps/backend install correlation-id
npm --workspace apps/frontend install uuid
```

**Testing structured logs:**
```bash
npm --workspace apps/backend install --save-dev tap-spec
```

### 2.2 Rationale Dependencies

| Package | Purpose | Benefit |
|---|---|---|
| `pino` | High-performance structured logging | 5x faster than winston, JSON native, Railway-ready |
| `pino-pretty` | Development log formatting | Human-readable logs during development |
| `correlation-id` | Backend request correlation | Automatic context propagation via AsyncLocalStorage |
| `uuid` | Frontend correlation headers | Generate correlation IDs for FE→BE tracing |
| `tap-spec` | Structured log testing | Validate JSON log formats in unit tests |

## 3. Analisi del Perimetro

### 3.1 Backend (XState Machines + Adapters)

**File principali:**
- `apps/backend/src/lib/machines/idempotency-coordinator.machine.ts` — gestisce `IDEMPOTENCY_CONFLICT` events (linea 170-182)
- `apps/backend/src/lib/machines/generation-system.definition.ts` — orchestrator principale 
- `apps/backend/src/lib/machines/generation-system.execution.states.ts` — da verificare per step failures

**Stato attuale:**
- `idempotency_conflict` viene loggato come failure reason, ma senza structured context 
- Step failures (`crawling.failed`, `scoring.failed`) non hanno structured logging JSON
- Context disponibile: `requestId`, `userId`, `projectId`, `toolKey`, ma non correlabile con frontend
- **Logging method:** `console.*` calls manuali, no structured format

**Target state:**
- **pino-based structured logging** con child loggers per request correlation
- **correlation-id integration** per automatic context propagation
- **JSON-first format** ottimizzato per Railway log ingestion

### 3.2 Frontend (useToolPage + Proxy + Client)

**File principali:**
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — effects #7, #8, #9 per auto-chain e DispatchError handling
- `apps/frontend/src/features/tools/runtime/tools-client.ts` — `runExtraction()` con recovery ECONNRESET (linea 311-349)
- `apps/frontend/server.mjs` — proxy error handler (linea 155-165)
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — rendering `DispatchError`

**Stato attuale:**
- Proxy ECONNRESET log: `[proxy] error (39954ms): ECONNRESET socket hang up → /generation/run` — **no requestId, no correlation**
- Frontend `DispatchError`: generic "generation failed" message — **no differentiation per timeout/idempotency**
- Auto-chain effect può dispatch duplicate step — **race condition non gestita**
- **Logging method:** String interpolation, no structured format

**Target state:**
- **uuid-based correlation IDs** in headers per FE→BE tracing  
- **Structured JSON logging** in proxy con correlation context
- **Lightweight logger wrapper** per browser structured logging

### 3.3 DDD Alignment

**Termini canonici verificati:**
- `DispatchError` — canonical in glossary (linea 220), Value Object per useToolPage local state
- `IdempotencyDecision` + `IdempotencyKey` — canonical (linee 92-93)
- `WorkflowPanelFeedbackItem` — canonical, per inline-action feedback channel

**Conformità:** Nessun nuovo domain term introdotto, solo operational improvements + logging infrastructure.

## 4. Piano di Implementazione

### 4.0 PHASE 0: DDD Governance Gate Closure (~2h) ⚠️ **MANDATORY**

**Rationale:** Il DDD Governance Gatekeeper ha identificato critical terminology gaps che bloccano l'implementazione. Questi devono essere risolti prima di modificare codice che tocca domain concepts.

#### 4.0.1 Critical DDD Issues Identified

**BLOCKER 1:** `DispatchError` referenced but not canonical
- Piano references `DispatchError` as canonical (glossary linea 220-claimed) 
- **REALITY:** Term missing from actual glossary, no DDD decision exists
- **IMPACT:** Phase 4.2.2 (DispatchError messaging) cannot proceed without definition

**BLOCKER 2:** Error reason code taxonomy undefined  
- Timeout, idempotency, network errors treated as generic strings
- **IMPACT:** Cross-context error propagation lacks semantic rules
- **RISK:** Semantic drift via UI-driven error definitions

**BLOCKER 3:** Translation rules Generation → Frontend/UI missing
- `IdempotencyDecision.reason` → user display lacks canonical mapping
- **IMPACT:** Domain error semantics leak into UI copy without boundaries

#### 4.0.2 DDD Decisions Required (Sequential)

**Decision DDD-144: DispatchError Canonical Status**
```yaml
Decision ID: DDD-144
Context: Frontend/UI ↔ Generation error handling  
Question: Is DispatchError a canonical domain concept?
Options:
  A) Canonical Value Object (Generation context ownership)
  B) UI-only concept (Frontend/UI context ownership)
  C) Replace with typed domain reason codes + translation layer
Required Evidence: 
  - Current useToolPage.ts usage analysis
  - Error propagation flow mapping  
  - User-facing vs internal error distinction
Effort: 1h (analysis + decision)
Blocker: Phase 4.2.2, 4.2.3, 4.3.x cannot proceed without this
```

**Decision DDD-145: Error Reason Code Translation Rules**  
```yaml
Decision ID: DDD-145
Context: Generation → Frontend/UI integration
Question: How should Generation error codes translate to Frontend display?
Dependency: DDD-144 resolved
Options:
  A) Direct propagation (Generation owns display semantics)
  B) Translation layer (Frontend maps domain codes → localized messages)
  C) Hybrid (semantic categories + localized presentation)
Required Evidence:
  - IdempotencyDecision.reason current values
  - appCopy.ui.toolPage.runtimeErrors current messages
  - Cross-context boundary analysis
Effort: 30min (documentation + rules)
```

**Decision DDD-146: Canonical Error Taxonomy**
```yaml  
Decision ID: DDD-146
Context: Generation domain model
Question: Should timeout/idempotency/network errors be distinct canonical types?
Dependency: DDD-144, DDD-145 resolved
Options:
  A) Single ErrorReason generic type
  B) Distinct canonical types (TimeoutError, IdempotencyConflict, NetworkError)
  C) Hierarchical taxonomy (ErrorCategory → specific ErrorReason)
Effort: 30min (taxonomy definition)
Impact: Determines structured logging field taxonomy
```

#### 4.0.3 Implementation Tasks

**Task 4.0.3a: Domain Evidence Collection (~30min)**
- [ ] Read current `useToolPage.ts` DispatchError usage patterns
- [ ] Map Generation → Frontend error propagation flows
- [ ] Inventory existing `appCopy.ui.toolPage.runtimeErrors` messages
- [ ] Document `IdempotencyDecision.reason` possible values

**Task 4.0.3b: DDD Decision Execution (~1h)**
- [ ] Execute DDD-144 decision process (definition + glossary update)
- [ ] Execute DDD-145 decision process (translation rules documentation)  
- [ ] Execute DDD-146 decision process (taxonomy definition)
- [ ] Update `domain-naming-decision-log.md` with all decisions

**Task 4.0.3c: Domain Boundary Documentation (~30min)**
- [ ] Document error handling integration constraints in Bounded Context Map
- [ ] Establish canonical error → UI message mapping rules
- [ ] Define structured logging field taxonomy based on canonical types

#### 4.0.4 Phase 0 Deliverables

**Domain Documentation Updates:**
- [ ] `docs/01-requirements/domain-ubiquitous-language-glossary.md` — DispatchError canonical entry
- [ ] `docs/07-governance/domain-naming-decision-log.md` — DDD-144, DDD-145, DDD-146 entries
- [ ] `docs/02-design/domain-bounded-context-map.md` — error handling integration constraints

**Implementation Readiness:**
- [ ] **Phase 4.2.2** ready: DispatchError canonical definition established
- [ ] **Phase 4.2.3** ready: Error taxonomy supports auto-chain guard semantics
- [ ] **Phase 4.3.x** ready: UX messaging aligned with canonical error types
- [ ] **Structured logging** ready: Field taxonomy based on canonical concepts

#### 4.0.5 Gate Criteria for Phase 1+ Execution

**DDD GATE PASS Requirements:**
- [ ] All 3 DDD decisions (144, 145, 146) have status: `approved`
- [ ] DispatchError has canonical glossary entry OR replacement taxonomy defined
- [ ] Error reason code translation rules documented
- [ ] Cross-context integration constraints established
- [ ] **No semantic drift risk**: UI-driven error messaging replaced with canonical approach

**Technical GATE PASS Requirements:**
- [ ] Dependencies installation plan validated (pino, correlation-id, uuid)
- [ ] File modification scope confirmed (no additional domain concept changes)
- [ ] Testing strategy aligned with canonical terminology

### 4.1 PHASE 1: Dependencies & Logging Infrastructure (Alta Priorità, ~3.5h)

#### 4.1.0 Prerequisites: Dependencies Installation (~15min)

**Prerequisite:** Phase 0 DDD Gate PASSED ✓

**Setup structured logging dependencies:**
```bash
# Backend structured logging
npm --workspace apps/backend install pino
npm --workspace apps/backend install --save-dev pino-pretty

# Request correlation
npm --workspace apps/backend install correlation-id  
npm --workspace apps/frontend install uuid

# Testing structured logs
npm --workspace apps/backend install --save-dev tap-spec
```

**Setup logging infrastructure:**
```typescript
// apps/backend/src/lib/runtime/logger.ts
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

```typescript
// apps/frontend/src/app/runtime/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};

function log(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  console[level](JSON.stringify(entry));
}
```

### 4.1 FASE 1: Structured Logging (Alta Priorità, ~3.5h)

**Prerequisite:** Phase 0 DDD Gate PASSED ✓

#### 4.1.1 Backend: Idempotency Conflict Logging (~1h)

**Target:** `apps/backend/src/lib/machines/idempotency-coordinator.machine.ts`

**Modifica:** Stato `conflict` (linea 170-182) — sostituire console.warn con pino structured logging

```typescript
// Import logger
import { logger } from '../../runtime/logger';

// In conflict state output
output: ({ context }) => {
  // NUOVO: pino structured logging
  const requestLogger = logger.child({
    requestId: context.input.requestId,
    userId: context.input.userId,
    projectId: context.input.projectId,
  });
  
  requestLogger.warn({
    event: 'generation.idempotency_conflict',
    toolKey: context.input.toolKey,
    stepKey: context.input.step, // se disponibile in input
    existingReason: context.conflictReason,
    existingStatus: 'unknown', // da completare se disponibile in adapters
  });
  
  const event: IdempotencyConflictEvent = {
    type: 'IDEMPOTENCY_CONFLICT',
    requestId: context.input.requestId,
    sourceActor: 'idempotencyCoordinatorMachine',
    timestamp: getNow(context.input).toISOString(),
    reason: context.conflictReason ?? 'idempotency_conflict',
  };
  return event;
}
```

**Acceptance Criterion:** Pino log contiene structured context con `requestId`, `userId`, `projectId`, `toolKey`, `stepKey`

#### 4.1.2 Backend: Generation Step Failed Logging (~1h)

**Target:** `apps/backend/src/lib/machines/generation-system.execution.states.ts` (da verificare location)

**Ricerca necessaria:** Trovare invoke actors per crawling/scoring e i loro error handlers

**Pattern target con pino:**
```typescript
// Import logger
import { logger } from '../../runtime/logger';

// In invoke onError o catch block
const requestLogger = logger.child({
  requestId,
  userId: context.userId,
  projectId: context.projectId,
});

requestLogger.error({
  event: 'generation.step_failed',
  toolKey,
  stepKey, // 'crawling', 'scoring', etc.
  operation: 'invokeCrawling', // o invokeScoring
  durationMs: Date.now() - startTime,
  errorType: error?.name, // 'AbortError', 'TimeoutError', etc.
  errorMessage: error?.message,
  isRetryable: isRetryableError(error),
});
```

**Acceptance Criterion:** Pino structured logs parseabili da Railway log aggregators

#### 4.1.3 Frontend: Proxy Structured Logging (~1h)

**Target:** `apps/frontend/server.mjs`

**Setup correlation middleware:**
```javascript
// Top of file imports
import { v4 as uuidv4 } from 'uuid';

// Logger wrapper function
function logStructured(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component: 'frontend-proxy',
    ...context,
  };
  console[level](JSON.stringify(entry));
}
```

**Modifiche:**
1. **Request correlation setup** — linea 90-94, aggiungere in `handleProxy`:
```javascript
function handleProxy(request, response, backendUrl) {
  const t0 = Date.now();
  request._proxyStartTime = t0;
  
  // NUOVO: ensure correlation ID exists
  if (!request.headers['x-correlation-id']) {
    request.headers['x-correlation-id'] = uuidv4();
  }
  
  const logPath = (request.url ?? '/').split('?')[0];
  logReq('proxy', request.method ?? 'GET', logPath);
```

2. **Error handler structured logging** — linea 155-165, sostituire:
```javascript
upstreamReq.on('error', (err) => {
  const elapsed = Date.now() - t0;
  const correlationId = request.headers['x-correlation-id'] || 'unknown';
  
  // NUOVO: structured error log
  logStructured('error', 'proxy.error', {
    method: request.method,
    url: request.url,
    statusCode: response.statusCode,
    durationMs: elapsed,
    errorCode: err.code,
    errorMessage: err.message,
    correlationId,
  });
  
  if (!response.headersSent) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Bad Gateway', code: err.code }));
  } else {
    response.destroy();
  }
});
```

3. **5xx responses as error level** — linea 127-128, sostituire:
```javascript
const elapsed = Date.now() - t0;
const correlationId = request.headers['x-correlation-id'] || 'unknown';
const level = response.statusCode >= 500 ? 'error' : 'info';

if (level === 'error') {
  logStructured('error', 'proxy.response', {
    method: request.method,
    url: request.url,
    statusCode: response.statusCode,
    durationMs: elapsed,
    correlationId,
  });
} else {
  console.log(`[proxy] ${request.method ?? 'GET'} ${logPath} → ${response.statusCode} (${elapsed}ms)`);
}
```

**Acceptance Criteria:**
- [ ] Proxy error log contiene `correlationId` e `method`
- [ ] 5xx responses logged as `[error]` (non `[info]`)
- [ ] Structured JSON format compatible con Railway log ingestion

### 4.2 FASE 2: Frontend Request Correlation & UX (Media Priorità, ~2.5h)

**Prerequisite:** Phase 0 DDD Gate PASSED ✓ + Phase 1 completed

#### 4.2.1 Frontend: Correlation ID Header Propagation (~30min)

**Target:** `apps/frontend/src/features/tools/runtime/tools-client.ts`

**Modifica:** Funzione `runExtraction` (linea ~280) — aggiungere correlation header

```typescript
// Import uuid
import { v4 as uuidv4 } from 'uuid';

// In runExtraction, dopo request object creation
const request: GenerationRequest = {
  requestId: generateRequestId(),
  userId: input.userId,
  // ... existing fields
};

// NUOVO: correlation ID for FE→BE tracing
const correlationId = uuidv4();
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-correlation-id': correlationId, // per correlation con backend logs
};

// In streamGeneration call
await streamGeneration(request, {
  ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {}),
  headers, // NUOVO: pass correlation headers
  onEvent: (event) => {
    // ... existing event handlers
  },
});
```

**Nota:** Verificare se `streamGeneration` supporta headers parameter, altrimenti implementare via `requestJson` wrapper.

#### 4.2.2 Frontend: Timeout-aware DispatchError Messaging (~1h)

**Prerequisites:** 
- DDD-144 resolved: DispatchError canonical definition established
- DDD-145 resolved: Error reason code translation rules documented

**Target:** `apps/frontend/src/features/tools/runtime/useToolPage.ts`

**Setup:** Import lightweight logger wrapper
```typescript
import { logger } from '../../../app/runtime/logger';
```

**Modifica:** Creare function per mapping specifico degli error messages

```typescript
// NUOVA function prima della component
function mapDispatchErrorMessage(error: unknown): string {
  // Log error for debugging
  logger.error('dispatchError.mapping', {
    errorName: error instanceof Error ? error.name : 'unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('ECONNRESET')) {
      return 'La generazione ha impiegato troppo tempo. Riprova o contatta il supporto.';
    }
    if (error.message.includes('idempotency') || error.message.includes('conflict')) {
      return 'Generazione già in corso. Attendi il completamento.';
    }
    if (error.name === 'TimeoutError') {
      return 'Timeout della generazione. Riprova con parametri più semplici.';
    }
  }
  return 'Si è verificato un errore durante la generazione. Riprova.';
}
```

**Integrazione:** Utilizzare `mapDispatchErrorMessage(error)` negli effects che settano `dispatchError` state.

**Ricerca necessaria:** Identificare location esatta degli effects #7, #8, #9 in useToolPage.ts

#### 4.2.3 Frontend: Auto-chain Race Condition Guard (~30min) ⚠️ **CRITICO**

**Prerequisites:**
- DDD-146 resolved: Error taxonomy supports auto-chain semantics
- Phase 1 structured logging infrastructure ready

**Target:** `apps/frontend/src/features/tools/runtime/useToolPage.ts`

**Modifica:** Effect #9 (auto-chain) — aggiungere guard per `pendingStepStart`

**Ricerca necessaria:** 
1. Trovare effect auto-chain in useToolPage.ts
2. Identificare dove viene settato/cleared `pendingStepStart`
3. Implementare guard

**Pattern target:**
```typescript
// In effect #9 — auto-chain
if (
  isAutoChainEnabled
  && !generation.isStreamActive
  && generation.streamStatus !== 'failed'
  && !toolPageSnapshot.context.pendingStepStart // NUOVO: prevent double dispatch
  && nextAvailableStep
) {
  startGenerationStep(nextAvailableStep);
}
```

### 4.3 FASE 3: ECONNRESET Recovery UX (Bassa Priorità, ~1h)

**Prerequisites:**
- Phase 0 DDD Gate PASSED ✓
- Phase 2.2 completed: DispatchError messaging established  
- Canonical error messaging taxonomy in place

#### 4.3.1 Recovery UX with Retry Button

**Target:** `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

**Modifica:** Conditional retry button per timeout errors

```tsx
{dispatchError && (
  <div className={uiPrimitives.error}>
    <p>{dispatchError}</p>
    {(dispatchError.includes('tempo') || dispatchError.includes('Timeout')) && (
      <button
        type="button"
        className={uiPrimitives.button}
        onClick={handlePrimaryAction}
        disabled={!machineViewModel.primaryActionEnabled}
      >
        Riprova
      </button>
    )}
  </div>
)}
```

### 4.4 FASE 4: Documentation Alignment & Knowledge Graph Update (~1.5h)

**Prerequisites:**
- All previous phases completed successfully
- Structured logging system validated in production
- DDD governance decisions fully implemented

#### 4.4.1 Documentation Updates (~1h)

**Target:** Update canonical documentation per structured logging implementation

**4.4.1a: Observability & Debug Documentation (~30min)**

**Create/Update documents:**
- [ ] `docs/04-testing/production-observability-runbook.md` — **NEW** comprehensive guide
- [ ] Update `docs/04-testing/streaming-generator-debug-runbook.md` — integrate pino correlation patterns
- [ ] Consider updating `docs/02-design/geometric-admin-debug-monitoring-proposal.md` — align with implemented logging

**Content requirements:**
```markdown
# Production Observability Runbook
## Structured Logging Architecture (pino + correlation-id)
## Error Classification & Correlation Guide  
## Railway Log Ingestion & Query Patterns
## Debugging Workflows:
  - FE→Proxy→BE correlation tracing
  - IdempotencyConflict investigation  
  - ECONNRESET timeout analysis
  - Auto-chain race condition detection
```

**4.4.1b: Architecture Documentation Update (~30min)**

**Update existing specifications:**
- [ ] `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` — document DispatchError canonical implementation
- [ ] `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — update error feedback channel documentation  
- [ ] `docs/02-design/domain-bounded-context-map.md` — add error handling integration constraints (if not done in Phase 0)

**Content requirements:**
- Document pino structured logging patterns
- Correlation ID propagation flows
- Error message translation rules (per DDD-145)
- Canonical error taxonomy (per DDD-146)

#### 4.4.2 Knowledge Graph Update (graphify) (~30min)

**Rationale:** The error logging implementation introduces new cross-file relationships and architectural patterns that should be reflected in the knowledge graph for future development reference.

**4.4.2a: Incremental Graph Update**

```bash
# After all code changes committed
graphify update .
```

**Expected graph updates:**
- New logging infrastructure nodes (`pino`, `correlation-id`, `uuid` dependencies)
- Enhanced error handling relationships (useToolPage ↔ idempotency-coordinator)
- Structured logging patterns (proxy ↔ backend correlation)
- Documentation ↔ implementation correlation (runbooks ↔ error types)

**4.4.2b: Graph Validation & Documentation**

```bash  
# Query updated graph for validation
graphify query "error logging correlation patterns"
graphify query "pino structured logging implementation"
graphify path "DispatchError" "IdempotencyDecision"
```

**Validation criteria:**
- [ ] Error handling flows properly mapped in graph
- [ ] Documentation ↔ code relationships updated
- [ ] New logging infrastructure visible in graph structure
- [ ] Cross-context error handling patterns discoverable

**4.4.2c: Wiki Update (if applicable)**

```bash
# Update agent-crawlable wiki if exists
graphify --wiki
```

**Benefits:**
- Future development can discover error logging patterns via graph queries
- Documentation and code relationships maintained automatically
- Cross-repository knowledge preserved for similar implementations

#### 4.4.3 Documentation Governance Compliance (~0min)

**Frontmatter Updates:** All updated/created docs must include proper YAML frontmatter per AGENTS.md requirements:

```yaml
---
status: active  
version: 1.0
last-reviewed: 2026-07-06
next-review-date: 2026-10-06  
owner: Backend Runtime + Frontend Platform
type: observability-runbook  # or appropriate type
tags: [logging, observability, pino, correlation, error-handling]
---
```

**Index Update:** Update `docs/index-overview.md` to include new observability documentation in the appropriate sections.

#### 4.4.4 Phase 4 Deliverables

**New Documentation:**
- [ ] `docs/04-testing/production-observability-runbook.md` — comprehensive structured logging guide
- [ ] Updated debug runbooks with correlation patterns
- [ ] Enhanced architecture specs with error handling documentation

**Updated Knowledge Graph:**
- [ ] Incremental graphify update with new logging relationships
- [ ] Validated error handling patterns discoverable via graph queries  
- [ ] Documentation ↔ implementation ties maintained

**Compliance:**
- [ ] All documentation follows AGENTS.md frontmatter requirements
- [ ] Documentation index updated with new observability guides
- [ ] Review dates established for ongoing maintenance

#### 4.4.5 Long-term Maintenance Setup

**Documentation Review Schedule:**
- **Observability runbook:** Review every 3 months (high churn from production learnings)
- **Architecture specs:** Review every 6 months (stable implementation patterns)
- **Debug runbooks:** Review when new error patterns identified

**Knowledge Graph Maintenance:**
```bash
# Add to project post-commit hook (optional)
graphify update . --auto
```

**Benefits:**
- Structured logging knowledge preserved beyond individual contributor memory
- Future error logging improvements have documented baseline
- Cross-team knowledge sharing via discoverable documentation
- Graph-based discovery supports similar feature implementations

## 5. Strategia di Testing (Enhanced)

### 5.1 Backend Unit Tests (with pino)

**Target:** `apps/backend/src/lib/tests/`

**Enhanced tests con pino logger:**
- Mock `idempotency-coordinator` con input simulati → verify pino structured log output
- Mock generation step failures → verify pino JSON log format  
- Log parsing validation → verify all required fields present + pino format compliance
- **tap-spec integration** per structured log validation

```typescript
// Enhanced test structure con pino
import { logger } from '../../runtime/logger';
import { mockLogger } from 'pino-test'; // se necessario per testing

describe('IdempotencyCoordinator Pino Logging', () => {
  it('should log structured conflict with pino format', async () => {
    const mockInput = {
      requestId: 'test-123',
      userId: 'user-456',
      projectId: 'proj-789', 
      toolKey: 'geometric',
      step: 'crawling',
    };
    
    // Capture pino output
    const logSpy = vi.spyOn(logger, 'warn');
    
    // Trigger conflict scenario
    // Assert pino log structure:
    expect(logSpy).toHaveBeenCalledWith({
      event: 'generation.idempotency_conflict',
      toolKey: 'geometric',
      stepKey: 'crawling',
      existingReason: expect.any(String),
    });
  });
  
  it('should validate pino JSON format compatibility', () => {
    // Verify logs are parseable by Railway
    // Test with tap-spec if needed
  });
});
```

### 5.2 Frontend Unit Tests (with correlation IDs)

**Target:** `apps/frontend/src/features/tools/runtime/`

**Enhanced tests con correlation tracking:**
- MSW mock ECONNRESET responses → verify DispatchError mapping + correlation logging
- Mock timeout scenarios → verify correct message display + structured logging
- Auto-chain race condition → verify guard prevents duplicate dispatch
- **Correlation ID propagation** tests

```typescript
// Enhanced test structure con correlation
import { logger } from '../../../app/runtime/logger';

describe('DispatchError Message Mapping with Correlation', () => {
  it('should show timeout message for ECONNRESET errors and log correlation', () => {
    const logSpy = vi.spyOn(logger, 'error');
    const error = new Error('ECONNRESET socket hang up');
    
    const message = mapDispatchErrorMessage(error);
    
    expect(message).toContain('troppo tempo');
    expect(logSpy).toHaveBeenCalledWith('dispatchError.mapping', {
      errorName: 'Error',
      errorMessage: 'ECONNRESET socket hang up',
    });
  });
  
  it('should propagate correlation ID in headers', () => {
    // Test correlation ID generation and propagation
    // Verify uuid format and header presence
  });
});
```

### 5.3 Integration Tests (Enhanced Correlation)

**Target:** Proxy logging correlation + pino/correlation-id integration

**Enhanced tests:**
- Generate request with correlation ID → verify proxy logs contain same ID  
- Simulate backend errors → verify pino structured logging correlation
- End-to-end correlation → frontend correlationId should match backend pino logs
- **Railway log ingestion compatibility** tests

```typescript
describe('Enhanced Request Correlation', () => {
  it('should maintain correlation across FE→Proxy→BE', async () => {
    // Generate correlation ID in frontend
    // Send request through proxy  
    // Verify backend pino logs contain same correlation ID
    // Test Railway JSON parsing compatibility
  });
});
```

### 5.4 E2E Smoke Tests (with Monitoring)

**Enhanced scenarios:**
- Trigger real idempotency conflict → verify pino correlation logs + UX message
- Long-running generation with timeout → verify ECONNRESET handling + retry UX  
- Auto-chain with rapid clicks → verify no duplicate dispatches + correlation logging
- **Performance impact** tests per pino overhead
  it('should show timeout message for ECONNRESET errors', () => {
    const error = new Error('ECONNRESET socket hang up');
    const message = mapDispatchErrorMessage(error);
    expect(message).toContain('troppo tempo');
  });
});
```

### 4.3 Integration Tests

**Target:** Proxy logging correlation

**Tests necessari:**
- Generate request with x-request-id → verify proxy logs contain same ID
- Simulate backend errors → verify proxy structured logging 
- End-to-end correlation → frontend requestId should match backend logs

### 4.4 E2E Smoke Tests

**Scenarios:**
- Trigger real idempotency conflict → verify correlation logs + UX message
- Long-running generation with timeout → verify ECONNRESET handling + retry UX
- Auto-chain with rapid clicks → verify no duplicate dispatches

## 6. Acceptance Criteria (Enhanced + DDD Compliance)

### 6.0 DDD Governance Requirements (MANDATORY GATE)

- [ ] **DDD-144 resolved**: DispatchError canonical status decided and documented
- [ ] **DDD-145 resolved**: Error reason code translation rules established  
- [ ] **DDD-146 resolved**: Canonical error taxonomy defined
- [ ] **Domain glossary updated**: All domain terms used in plan have canonical entries
- [ ] **Decision log current**: All terminology decisions recorded with rationale
- [ ] **Bounded context rules**: Error handling integration constraints documented
- [ ] **No semantic drift**: UI-driven error messaging replaced with canonical approach
- [ ] **Phase 0 deliverables**: All documentation updated and reviewed

### 6.1 Dependencies Requirements

- [ ] **pino** installed and configured in backend
- [ ] **correlation-id** middleware integrated in backend
- [ ] **uuid** library available in frontend
- [ ] **pino-pretty** configured for development
- [ ] **tap-spec** available for structured log testing

### 6.2 Logging Requirements (Enhanced)

- [ ] Every `idempotency_conflict` **pino log** contains structured context: `requestId`, `userId`, `projectId`, `toolKey`, `stepKey`
- [ ] Every proxy error log contains **correlationId** and `method` in JSON format
- [ ] Every 5xx proxy response is logged as `[error]` (not `[info]`) with **structured format**
- [ ] Backend `generation.step_failed` **pino logs** are structured JSON (parseable by Railway aggregators)
- [ ] **Child loggers** properly propagate request context in backend
- [ ] **Correlation IDs** flow consistently from FE → Proxy → Backend
- [ ] **Canonical terminology**: All log fields use approved domain terms only

### 6.3 UX Requirements (DDD-Compliant)

- [ ] ECONNRESET shows user-readable message with retry affordance
- [ ] `idempotency_conflict` shows "generation already in progress" message **based on canonical IdempotencyDecision semantics**
- [ ] Auto-chain cannot dispatch duplicate step when `pendingStepStart` is non-null
- [ ] Timeout errors show specific messaging (not generic "generation failed")
- [ ] **DispatchError mapping** uses canonical error types per DDD-144 decision
- [ ] **Error messages** follow translation rules per DDD-145 decision
- [ ] **No domain leakage**: Internal Generation errors properly translated to UI context

### 6.4 Correlation Requirements (Enhanced)

- [ ] Given a frontend ECONNRESET log, backend session can be identified via **correlationId**
- [ ] Given a backend `idempotency_conflict` **pino log**, the originating frontend request can be traced
- [ ] Proxy logs contain sufficient **structured context** for production debugging
- [ ] **End-to-end correlation** works: FE uuid → Proxy structured log → Backend pino log
- [ ] **Railway log ingestion** compatible with new JSON formats
- [ ] **Canonical term consistency**: Same concept uses same term across all logs

### 6.5 Non-Regression

- [ ] Existing `generation/run` happy path remains unchanged
- [ ] Existing `generation/stream` (SSE) path remains unchanged 
- [ ] **Pino logging overhead** does not impact generation performance
- [ ] Auto-chain behavior remains identical for non-conflicting scenarios
- [ ] Development log readability maintained via **pino-pretty**
- [ ] **Domain model integrity**: No unintended domain concept modifications
- [ ] **Bounded context boundaries**: No leakage between Generation ↔ Frontend/UI contexts

### 6.6 Documentation & Knowledge Graph Requirements

- [ ] **Production observability runbook** created with comprehensive structured logging guide
- [ ] **Debug runbooks updated** with pino correlation patterns and Railway query examples
- [ ] **Architecture specifications updated** with error handling documentation per DDD decisions
- [ ] **Knowledge graph updated** via graphify incremental update reflecting new logging relationships
- [ ] **Documentation frontmatter compliance** per AGENTS.md requirements (status, version, owner, etc.)
- [ ] **Documentation index updated** with new observability guides properly categorized
- [ ] **Graph query validation** confirms error handling patterns discoverable via graphify
- [ ] **Cross-reference maintenance**: Documentation ↔ code relationships preserved in knowledge graph
- [ ] **Review schedule established** for ongoing documentation maintenance (3-6 month cycles)
- [ ] **Future developer onboarding** supported via discoverable structured logging knowledge

## 7. Timeline e Effort (Updated with Documentation Phase)

| Fase | Task | Effort | Dipendenze | DDD Impact |
|---|---|---|---|---|
| **0.1** | **Domain Evidence Collection** | **0.5h** | **Nessuna** | **MANDATORY** |
| **0.2** | **DDD Decision Execution (144,145,146)** | **1h** | **Evidence Collection** | **MANDATORY** |
| **0.3** | **Domain Boundary Documentation** | **0.5h** | **DDD Decisions** | **MANDATORY** |
| **1.0** | **Dependencies Installation + Setup** | **0.25h** | **Phase 0 PASSED** | **Safe** |
| 1.1 | Backend Idempotency Conflict Logging (pino) | 1h | Dependencies + Phase 0 | Safe - uses canonical terms |
| 1.2 | Backend Step Failed Logging (pino) | 1h | Ricerca execution states + Phase 0 | Safe - uses canonical terms |
| 1.3 | Frontend Proxy Structured Logging (correlation) | 1h | Dependencies + Phase 0 | Safe - no domain terms |
| 2.1 | Frontend Correlation ID Propagation (uuid) | 0.5h | Phase 1 completed | Safe - technical only |
| **2.2** | **Timeout-aware DispatchError Messaging** | **1h** | **DDD-144,145 resolved** | **BLOCKED until Phase 0** |
| **2.3** | **Auto-chain Race Condition Guard** | **0.5h** | **DDD-146 resolved** | **BLOCKED until Phase 0** |
| **3.1** | **ECONNRESET Recovery UX** | **1h** | **Phase 2.2 + DDD complete** | **BLOCKED until Phase 0** |
| **4.1** | **Documentation Updates (observability runbooks)** | **1h** | **All phases complete** | **Documentation governance** |
| **4.2** | **Knowledge Graph Update (graphify)** | **0.5h** | **Code changes committed** | **Safe** |

**Total effort:** ~9.75 ore (was 8.25) — **+1.5h for documentation & knowledge preservation**

**Critical Path Dependencies:**
1. **Phase 0 (2h)**: MANDATORY gate before any domain-touching code
2. **Phase 1 (3.75h)**: Technical infrastructure, safe to execute after Phase 0
3. **Phase 2-3 (3.5h)**: Domain semantics, CANNOT start until Phase 0 complete
4. **Phase 4 (1.5h)**: Documentation & knowledge graph, after all implementation complete

**Parallel Execution Options:**
- Phase 1.1, 1.2, 1.3 can run in parallel AFTER Phase 0 complete
- Phase 2.2, 2.3 must be sequential (2.3 depends on error taxonomy from 2.2)
- Phase 3.1 depends on 2.2 completion
- **Phase 4.1 and 4.2 can run in parallel** after all code implementation complete

**Critical path:** Fase 2.3 (Auto-chain guard) — previene data corruption da race conditions

## 7. Deliverables

### 8.1 Code Changes (Enhanced)

- [ ] **Dependencies installation:** pino, correlation-id, uuid, pino-pretty, tap-spec
- [ ] **Backend logger setup:** `apps/backend/src/lib/runtime/logger.ts` — pino configuration
- [ ] **Frontend logger setup:** `apps/frontend/src/app/runtime/logger.ts` — structured wrapper  
- [ ] `idempotency-coordinator.machine.ts` — pino structured conflict logging
- [ ] `generation-system.execution.states.ts` — pino structured step failure logging  
- [ ] `server.mjs` — proxy error correlation logging con structured JSON
- [ ] `tools-client.ts` — correlation ID header propagation (uuid)
- [ ] `useToolPage.ts` — DispatchError mapping + auto-chain guard + structured logging
- [ ] `ToolPageTemplate.tsx` — timeout retry UX

### 8.2 Documentation Changes (NEW)

- [ ] **NEW:** `docs/04-testing/production-observability-runbook.md` — comprehensive structured logging guide
- [ ] **Updated:** `docs/04-testing/streaming-generator-debug-runbook.md` — pino correlation integration
- [ ] **Updated:** `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` — DispatchError canonical documentation
- [ ] **Updated:** `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — error feedback channel updates
- [ ] **Updated:** `docs/02-design/domain-bounded-context-map.md` — error handling integration constraints (if needed)
- [ ] **Updated:** `docs/index-overview.md` — include new observability documentation

### 8.3 Knowledge Graph Updates (NEW)

- [ ] **Incremental graphify update:** Post-implementation graph refresh with new logging relationships
- [ ] **Graph validation:** Error handling patterns discoverable via graph queries
- [ ] **Wiki generation:** Agent-crawlable wiki update if applicable
- [ ] **Cross-reference maintenance:** Documentation ↔ code relationships preserved

### 8.4 Testing (Enhanced)

- [ ] **Backend unit tests** per pino structured logging validation
- [ ] **Frontend unit tests** per DispatchError mapping + correlation ID propagation
- [ ] **Integration tests** per end-to-end correlation (FE→Proxy→BE)
- [ ] **E2E smoke tests** per recovery scenarios + performance impact
- [ ] **tap-spec validation** per structured log formats
- [ ] **Railway compatibility tests** per log ingestion

### 8.5 Documentation & Knowledge Preservation

- [ ] **Production observability guide** con pino log formats + correlation examples
- [ ] **Updated debug runbooks** con Railway query patterns + error investigation workflows  
- [ ] **Architecture specification updates** per canonical error handling patterns
- [ ] **Knowledge graph refresh** reflecting new logging infrastructure relationships
- [ ] **Documentation governance compliance** per AGENTS.md frontmatter requirements
- [ ] **Long-term maintenance schedule** per observability documentation lifecycle

## 9. Risk Assessment (Enhanced + DDD)

### 9.0 DDD Governance Risks

**CRITICAL RISK: Phase 0 Gate Failure**
- **Impact:** Cannot proceed with domain-touching code (Phase 2.2, 2.3, 3.x)
- **Probability:** Medium (requires terminology decisions)
- **Mitigation:** Execute Phase 0 first, validate all DDD decisions before code changes
- **Fallback:** Infrastructure-only implementation (Phase 1 only)

**HIGH RISK: Semantic Drift During Implementation** 
- **Impact:** Code changes introduce non-canonical terminology
- **Probability:** Medium (developer unfamiliar with DDD constraints)
- **Mitigation:** Mandatory DDD review for any error message changes
- **Detection:** Pre-commit hooks validate canonical term usage

### 9.1 High Risk

- **Auto-chain race condition fix (2.3):** Modifiche alla logica core useToolPage — potenziale regressione nel flow normale
- **Proxy logging format change:** Potential Railway log ingestion breakage se parsing è fragile  
- **Pino integration complexity:** New dependency in production path — potential startup/runtime issues
- **DDD compliance overhead:** +2h effort, potential project timeline impact

### 9.2 Medium Risk

- **Backend structured logging:** Pino JSON format potrebbe impattare existing log analysis scripts
- **DispatchError message changes:** User-facing copy changes potrebbero richiedere localization review
- **Correlation ID overhead:** UUID generation + header propagation performance impact
- **Domain boundary violations:** Error handling changes might leak internal concepts to UI

### 9.3 Low Risk

- **pino-pretty development:** Development-only dependency, no production impact
- **tap-spec testing:** Test-only dependency, no runtime impact
- **Phase 1 infrastructure:** Technical changes only, no domain semantics

### 9.4 Enhanced Mitigation Strategies

**DDD-Specific Mitigations:**
- **Phase 0 mandatory gate:** No code modifications until DDD decisions resolved
- **Terminology validation:** Pre-commit checks for canonical term usage
- **Domain expert review:** All error message changes reviewed by domain owner
- **Bounded context integrity:** Error translation layer prevents domain leakage

**Technical Mitigations:**
- **Gradual rollout:** Deploy prima dependencies setup, poi structured logging, poi correlation
- **Feature flags:** Conditional pino logging per rollback rapido se needed 
- **Performance monitoring:** Track pino overhead + correlation ID generation impact
- **Rollback plan:** Keep console.* fallback ready per emergency rollback
- **Testing:** Comprehensive integration tests + Railway log ingestion validation

**DDD Rollback Strategy:**
- **Phase 0 incomplete:** Execute infrastructure-only (Phase 1), skip UX changes
- **Semantic drift detected:** Revert to original error messages, re-execute DDD governance
- **Domain expert unavailable:** Defer Phase 2-3, proceed with logging infrastructure only

## 10. References

### 10.1 Source Documents

- **Primary:** `docs/02-design/proposal-error-logging-and-ux-feedback.md`
- **DDD Glossary:** `docs/01-requirements/domain-ubiquitous-language-glossary.md` (DispatchError, IdempotencyDecision)
- **Frontend UI Spec:** `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` (feedback channels)
- **Tool Page Spec:** `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` (effects #7, #8, #9)

### 10.2 Dependencies Documentation

- **pino:** https://getpino.io/ — High-performance structured logging
- **correlation-id:** https://github.com/clarkware/node-correlation-id — AsyncLocalStorage-based correlation
- **uuid:** https://github.com/uuidjs/uuid — UUID generation per correlation IDs
- **pino-pretty:** https://github.com/pinojs/pino-pretty — Development log formatting
- **tap-spec:** https://github.com/scottcorgan/tap-spec — TAP output formatting for tests

### 10.3 Production Logs Analysis

- **Backend logs:** `logs/logs.1782814250609.json` — idempotency conflicts timeline
- **Frontend logs:** `logs/logs.1782814260017.json` — proxy ECONNRESET incidents
- **Incident:** 30/06 10:05–10:08, geometric run `c1cf562c` — correlation case study

### 10.4 Implementation References

- **XState machine context:** `apps/backend/src/lib/machines/generation-system.types.ts`
- **Proxy implementation:** `apps/frontend/server.mjs` — node:http built-in approach
- **Generation client:** `apps/frontend/src/features/generation/runtime/generation-client.ts` — SSE + recovery patterns
- **Tool page runtime:** `apps/frontend/src/features/tools/runtime/useToolPage.ts` — effects orchestration

---

**Next Actions (DDD-Gated + Documentation):**
1. **MANDATORY: Execute Phase 0** — DDD Governance Gate Closure (2h)
   - 4.0.3a: Domain evidence collection (useToolPage.ts, error flows)
   - 4.0.3b: DDD-144, DDD-145, DDD-146 decision execution  
   - 4.0.3c: Domain boundary documentation updates
2. **Validate Phase 0 completion** — All DDD gate criteria met before proceeding
3. Install dependencies per Minimal Implementation (pino, correlation-id, uuid) 
4. Review enhanced plan con Backend Runtime + Frontend Platform teams + **Domain Expert**
5. Setup **pino + correlation-id** in development environment
6. Begin implementation con **PHASE 1** (infrastructure) only after **Phase 0 PASSED**
7. **Execute Phases 1-3** sequentially with DDD constraints
8. **FINALIZE: Execute Phase 4** — Documentation & Knowledge Graph Update (1.5h)
   - 4.4.1: Create production observability runbook + update existing debug docs
   - 4.4.2: Refresh knowledge graph with new logging relationships via graphify
   - 4.4.3: Ensure documentation governance compliance (frontmatter, index updates)

**Long-term maintenance:** Schedule observability documentation reviews every 3-6 months based on production learnings and error pattern evolution.