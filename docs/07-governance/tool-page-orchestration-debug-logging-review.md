---
status: active
version: 1.0
date_created: 2026-07-15
last-reviewed: 2026-07-15
next-review-date: 2026-10-15
owner: Frontend Platform + Backend Runtime
type: code-review
tags: [logging, debugging, orchestration, auto-chain, blog-article-generator, observability]
---

# Tool Page Orchestration Debug Logging Review

## Scope

Code review focalizzata sul gap di osservabilità nell'orchestrazione multi-step dei tool, emerso da segnalazioni di sessione bloccata per `blog-article-generator`. Il 33% delle sessioni completa solo 2 step su 3 (`blog_seo_structure` + `blog_research`), fermandosi prima di `blog_article`.

Copre: bridge `useToolPageRunController`, `PROGRESS_SYNCED`, `inFlightStepsRef`, e la pipeline di auto-chain.

Contesto: [Production Observability Runbook](../04-testing/production-observability-runbook.md).

---

## A. Evidence — Sessioni Bloccate

Analisi dei log Railway del 12-15 Luglio 2026 per `blog-article-generator`.

| Correlation ID | Step completati | Manca | Nota |
|---|---|---|---|
| `84e20053` | seo_structure, research | article | |
| `a2fcd036` | seo_structure, research | article | |
| `f2417542` | seo_structure, research | article | |
| `443f358a` | seo_structure, research | article | |
| `7cce1296` | seo_structure, research | article | |
| `2a8a9a08` | seo_structure, research | article | log fuori ordine: terminal precede start |
| `68cf6867` | seo_structure, research | article | |
| `250904ef` | seo_structure, research | article | |
| `786e3a7f` | seo_structure, research | article | |
| `6cd1e49b` | solo seo_structure | research, article | |

**9 sessioni su 27 (~33%) incomplete.** Il backend completa ogni step con `status=completed` ma il frontend non invia mai la richiesta per `blog_article`.

---

## B. Root Cause Analysis — Auto-Chain Bridge

Il bridge di orchestrazione in `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts:254-402` è l'unico punto in cui l'auto-chain può fermarsi. Tre ipotesi prioritarie:

### B1. `inFlightStepsRef` sopprime `STEP_DONE` (linea 348)

```typescript
// apps/frontend/src/features/tools/runtime/useToolPageRunController.ts:346-355
if (generationStatus === 'completed') {
  const step = readRequestedStep(generationRun.snapshot.context.lastRequest, toolConfig.steps);
  const resolved = step ?? nextAvailableStep ?? lastRequestedStepRef.current;
  if (resolved && inFlightStepsRef.current.has(resolved)) return;  // ← SILENT EXIT
  if (resolved) {
    inFlightStepsRef.current = new Set(inFlightStepsRef.current).add(resolved);
    toolPageSend({ type: 'STEP_DONE', step: resolved });
  }
  generationArtifacts.reloadArtifacts();
  return;
}
```

Se `inFlightStepsRef` contiene già `blog_research`, `STEP_DONE` non viene mai emesso. `completedSteps` non si aggiorna, `nextAvailableStep` resta `null`, branch (c) auto-chain trova `!effectiveNextStep` e chiama `stopAutoChain()`.

**Trigger possibili:** doppio firing del bridge in React concurrent mode; `lastRequestedStepRef` che punta ancora a `blog_research` dopo un re-render spurio.

### B2. `readRequestedStep()` restituisce `null` (linea 346)

```typescript
const step = readRequestedStep(generationRun.snapshot.context.lastRequest, toolConfig.steps);
const resolved = step ?? nextAvailableStep ?? lastRequestedStepRef.current;
```

Se `lastRequest` è `null` (perché la macchina è già in `running` per lo step successivo o perché `cacheRequestStart` non ha ancora popolato il campo), `step` è `null`. Il fallback a `nextAvailableStep` può essere anch'esso `null` se `PROGRESS_SYNCED` non è ancora stato processato per l'ultimo step. `resolved` collassa a `undefined` → `STEP_DONE` non emesso.

### B3. `PROGRESS_SYNCED` con `runRequestPrefix === null` (linea 173)

```typescript
// apps/frontend/src/features/tools/machines/tool-page-progress.ts:173-183
if (!runRequestPrefix) {
  if (intent === 'new') {
    return {
      completedSteps: new Set<ToolStep>(),
      // ...
    };
  }
}
```

Se `getCurrentRunRequestPrefix()` restituisce `null` (perché `handleCancelGeneration` ha resettato `currentRunPrefixRef` o per una race col lifecycle React), `resolveFlowProgressState` azzera `completedSteps`. L'auto-chain non trova `blog_research` completato → `blog_article` non parte.

---

## C. Raccomandazioni — Logging Strutturato per Debug

Tutte le aggiunte di logging sotto usano `console.info` con prefisso `[tool-page]` e sono **gated in produzione** (livello `info`, soppresso dal gate `shouldLogRequestLifecycle` esistente in `node-server.ts` quando `NODE_ENV=production && !debugGenerationLogs`). Per il frontend, usare `import.meta.env.DEV` o un flag dedicato.

### C1. Log del bridge — stato dell'auto-chain a ogni ciclo

**File:** `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
**Punto:** inizio del `useLayoutEffect` (linea 254), dopo la dichiarazione delle variabili

```typescript
// Inserire dopo linea 84 (dopo generationStatus), prima del useLayoutEffect
const logBridgeState = (label: string) => {
  if (!import.meta.env.DEV) return;
  console.info(`[tool-page][bridge] ${label}`, {
    hasPendingStepStart: pendingStepStart !== null,
    pendingStep: pendingStepStart?.step ?? null,
    isAutoChainEnabled,
    generationStatus,
    isStreamActive: generationStream.isStreamActive,
    isGenerationActive: generationRun.isGenerationActive,
    nextAvailableStep,
    completedSteps: Array.from(completedStepsForFlow),
    lastRequestedStep: lastRequestedStepRef.current,
    inFlightSteps: Array.from(inFlightStepsRef.current),
    wasStreamActive: wasStreamActiveRef.current,
    pausedCheckpointStep,
  });
};
```

Chiamare `logBridgeState('enter')` all'inizio del `useLayoutEffect` (dopo linea 254) e in ciascun branch prima del `return`.

### C2. Log di `STEP_DONE` e `STEP_FAILED`

**Punto:** branch (b) del bridge, prima di ogni `toolPageSend({ type: 'STEP_DONE' })` e `toolPageSend({ type: 'STEP_FAILED' })` (linee 354, 363, 381, 386)

```typescript
// Prima di linea 354 (non-streaming success)
console.info('[tool-page][step-done] non-streaming', {
  step: resolved,
  artifactId: generationRun.snapshot.context.artifactId,
  lastRequestStep: readRequestedStep(generationRun.snapshot.context.lastRequest, toolConfig.steps),
  nextAvailableStep,
  completedStepsBefore: Array.from(completedStepsForFlow),
});

// Prima di linea 381 (stream success)
console.info('[tool-page][step-done] stream', {
  step: terminalResolution.step,
  status: terminalResolution.status,
  completedStep: generationStream.terminalCompletedStep,
  failedStep: generationStream.terminalFailedStep,
  streamStatus: generationStream.streamStatus,
});
```

### C3. Log di `PROGRESS_SYNCED` — input e output

**File:** `apps/frontend/src/features/tools/machines/tool-page-machine-assignments.ts`
**Punto:** in `buildSyncProgressState`, dopo il calcolo di `progress` (linea 48)

```typescript
if (import.meta.env.DEV) {
  console.info('[tool-page][progress-synced] computed', {
    intent: event.intent,
    runRequestPrefix: event.runRequestPrefix,
    artifactCount: event.artifacts.length,
    completedSteps: Array.from(progress.completedSteps),
    progressUnchanged: progressStatesEqual(context.progress, progress),
    contextCompletedSteps: Array.from(context.progress.completedSteps),
  });
}
```

### C4. Log di `orchestrateToolStep` — fallimento silenzioso

**File:** `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
**Punto:** blocco `catch` (linea 229), già presente `console.error`. Aggiungere dettaglio strutturato:

```typescript
// Sostituire linea 230 con:
console.error('[tool-page][orchestrate-failed]', {
  toolKey,
  step,
  projectId: normalizedProjectId,
  error: err instanceof Error ? { message: err.message, name: err.name } : String(err),
  inFlightSteps: Array.from(inFlightStepsRef.current),
  completedSteps: Array.from(v.completedStepsForFlow),
});
```

### C5. Backend: `completedStep` nell'evento SSE terminal

**File:** `apps/frontend/src/features/generation/machines/frontend-stream.machine.ts`
**Punto:** `setTerminalSuccess` action (linea 213). Loggare quando `completedStep` è assente:

```typescript
// In setTerminalSuccess, dopo l'assegnazione:
if (!event.completedStep && import.meta.env.DEV) {
  console.warn('[tool-page][stream-terminal] missing completedStep in SSE_TERMINAL', {
    artifactId: event.artifactId,
    status: event.status,
    reason: event.reason,
  });
}
```

### C6. Flag di debug remoto per produzione

Aggiungere un query parameter `?debug_tool_orchestration=1` che abilita i log di cui sopra in produzione per sessioni specifiche. Alternativa: usare `localStorage.setItem('debug_tool_orchestration', '1')` attivabile da console.

**File:** `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`

```typescript
const isDebugOrchestration = import.meta.env.DEV
  || (typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debug_tool_orchestration') === '1');
```

Usare `isDebugOrchestration` come gate per tutti i `console.info`/`console.warn` proposti sopra.

---

## D. Azioni Immediate (non-logging)

### D1. Verifica `inFlightStepsRef` — aggiungere asserzione in dev

Nel branch (b), dopo `STEP_DONE` (linea 354), loggare un warning se `inFlightStepsRef.size > toolConfig.steps.length` (indica leak della ref).

### D2. `buildSyncProgressState` — log di dedup

Quando `progressStatesEqual` restituisce `true` (linea 75), loggare in dev i valori comparati per confermare che il dedup non stia silenziando un aggiornamento legittimo.

### D3. Timeout di fallback per auto-chain bloccata

Considerare l'aggiunta di un timeout: se `isAutoChainEnabled && !isStreamActive && !isGenerationActive && nextAvailableStep !== null` persiste per più di 5 secondi senza che parta il prossimo step, forzare un `REQUEST_STEP_START` con un warning loggato.

---

## E. Verifica

Dopo l'implementazione dei log C1–C6:

1. Riprodurre una sessione `blog-article-generator` completa in dev
2. Verificare che ogni transizione dell'auto-chain produca log strutturati con tutti i campi chiave
3. Forzare un fallimento di orchestrate (es. backend down) e verificare che C4 emetta l'errore strutturato
4. Simulare `PROGRESS_SYNCED` con `runRequestPrefix: null` e verificare che C3 mostri `completedSteps: []`
5. Deploy in staging con `?debug_tool_orchestration=1`, raccogliere log per 24h, confrontare con le sessioni incomplete
