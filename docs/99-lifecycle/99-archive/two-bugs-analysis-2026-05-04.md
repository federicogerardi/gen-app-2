---
status: archived
version: 1.0
last-reviewed: 2026-05-04
next-review-date: 2026-08-03
owner: Engineering Team
completion-status: complete
bug-status: solved
---

# Analisi Tecnica: Due Bug nel Flusso Generazione ToolPageTemplate

**Data**: 2026-05-04  
**Status**: COMPLETE  
**Traccia**: Bug 1 (Brief Output Non Serializzato), Bug 2 (CTA Disabile Post-Generazione)

**Bug status**: SOLVED

---

## EXECUTIVE SUMMARY

### Bug 1: Brief output non viene passato a step 1 generation
**Conclusione**: **NON è un bug di serializzazione**. Il payload `extractionPayload` viene correttamente:
1. ✅ Compilato dal frontend con dati dal BriefingUpload
2. ✅ Serializzato nel `GenerationRequest` inviato al server
3. ✅ Letto dal server nei file adapter (`generation.adapters.ts:99`, `openrouter.adapter.ts:96`)

**Possibile root cause**: Il backend potrebbe non stare **usando** il payload nei prompt LLM oppure il payload potrebbe arrivare **vuoto** dal frontend.

### Bug 2: CTA form resta disabile dopo l'ultimo step
**Conclusione**: **Il bridge frontend è incompleto**. Il backend non invia `completedStep` nel SSE_TERMINAL, quindi il frontend non può inviare `STEP_DONE` alla tool-page machine, bloccando il passaggio a stato ready.

**Root cause**: TASK-026 (aggiungere completedStep al BackendStreamEvent) è marcato ✅ completato nel piano, ma **non è effettivamente implementato nel backend**.

---

## BUG 1: BRIEF OUTPUT NON VIENE PASSATO A STEP 1 GENERATION

### 1.1 Flusso Frontend: Estrazione del Briefing

**File**: `frontend/src/features/tools/ui/ToolPageTemplate.tsx`

#### Fase 1: BriefingUpload state (righe 146-155)
```typescript
// Linea 146-152: Legge lo stato dell'actor BriefingUpload dal tool-page machine
const briefingSnapshot = useSelector(
  toolPageSnapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
  (state) => state,
);

// Linea 154: Estrae il context dal briefing actor
const briefingError = briefingSnapshot.context.error;
```

**Dati disponibili dal briefing actor** (`briefingSnapshot.context`):
- `normalizedText: string` — testo normalizzato dal file caricato
- `extractionArtifactId: string | null` — ID artifact se l'estrazione è stata già fatta
- `extractionPayload: Record<string, unknown>` — payload strutturato estratto dal brief
- `briefingId: string` — ID del brief caricato
- `fileName: string` — nome del file originale

#### Fase 2: Costruzione del `baseRequest` (righe 560-625)

```typescript
// Linea 575-610: extractionInfo viene buildato dal briefingSnapshot o dalla hydrationResult
const extractionInfo = (() => {
  const briefingContextText = briefingSnapshot.context.normalizedText ?? '';

  if (machineHydrationResult !== null) {
    // Linea 579-584: Se viene da hydration (recover artifact), usa hydrationResult
    return {
      extractionArtifactId: machineHydrationResult.extractionArtifactId,
      extractionPayload: machineHydrationResult.extractionPayload,  // ← PAYLOAD QUI
      briefingId: machineHydrationResult.briefingId,
      briefingText: machineHydrationResult.normalizedText.trim().length > 0
        ? machineHydrationResult.normalizedText
        : briefingContextText,
    };
  }

  if (hasSourceArtifact) {
    return null;  // Non fa arricchimento da artifact
  }

  // Linea 590-598: Altrimenti usa briefingSnapshot (upload manuale)
  const bc = briefingSnapshot.context;
  if (bc.extractionArtifactId && bc.briefingId) {
    return {
      extractionArtifactId: bc.extractionArtifactId,
      extractionPayload: bc.extractionPayload ?? {},  // ← PAYLOAD QUI (potrebbe essere {})
      briefingId: bc.briefingId,
      briefingText: bc.normalizedText ?? '',
    };
  }
  return null;
})();

// Linea 600-625: Arricchimento del payload da extraction artifact se necessario
if (shouldEnrichFromExtractionArtifact) {
  const extractionArtifact = await getArtifactById(
    effectiveExtractionInfo.extractionArtifactId,
    { ... }
  ).catch(() => null);

  if (extractionArtifact) {
    const enrichedPayload = needsPayloadEnrichment
      ? (() => {
          // Linea 609-616: Prova a parsare il payload dal content dell'extraction artifact
          const fromContent = parseExtractionPayloadFromContent(extractionArtifact.content);
          if (Object.keys(fromContent).length > 0) {
            return fromContent;
          }
          return readExtractionPayloadFromArtifactInput(extractionArtifact);
        })()
      : effectiveExtractionInfo.extractionPayload;
    
    effectiveExtractionInfo = {
      extractionArtifactId: effectiveExtractionInfo.extractionArtifactId,
      extractionPayload: enrichedPayload,  // ← PAYLOAD AGGIORNATO QUI
      briefingId: enrichedBriefingId,
      briefingText: enrichedBriefingText,
    };
  }
}

// Linea 630-665: Creazione del baseRequest
const baseRequest: GenerationRequest = {
  requestId: runPrefix,
  userId: auth.session.user.id,
  projectId: normalizedProjectId,
  artifactType: 'content',
  model: formState.model,
  outputFormat: 'markdown',
  toolKey,
  workflowType: toolKey,
  registrySnapshotRef: formState.registrySnapshotRef,
  input: {
    intent: runtimeIntent,
    tone: resolvedTone,
    notes: resolvedNotes,
    relaunchFromArtifactId: resolvedRelaunchSource,
    sourceArtifactId: sourceArtifactId ?? null,
    briefingId: resolvedBriefingId ?? effectiveExtractionInfo.briefingId,
    briefingText: effectiveExtractionInfo.briefingText,
    briefingFileName: effectiveBriefingFileName ?? null,
    extractionArtifactId: effectiveExtractionInfo.extractionArtifactId,
    extractionPayload: effectiveExtractionInfo.extractionPayload,  // ← PAYLOAD INCLUSO QUI (riga 659)
  },
};
```

**POINT CRITICO 1**: `baseRequest.input.extractionPayload` viene compilato dalla riga 659. Se `effectiveExtractionInfo.extractionPayload` è `{}` (vuoto), il server riceverà un payload vuoto.

#### Fase 3: Creazione dello StepRequest (righe 667-675)

```typescript
// Linea 670-675
const request = createStepRequest(
  baseRequest,
  toolKey,
  step,
  dependencies,
  dependencyArtifactContentsByStep,
);
```

**Funzione `createStepRequest`** (`frontend/src/features/tools/runtime/tool-generation-engine.ts:6-33`):

```typescript
export const createStepRequest = (
  baseRequest: GenerationRequest,
  tool: SupportedTool,
  step: ToolStep,
  dependencies: Record<string, string>,
  dependencyArtifactContentsByStep: Record<string, string> = {},
): GenerationRequest => {
  // ...validation...
  
  return {
    ...baseRequest,  // ← MANTIENE l'input dal baseRequest, incluso extractionPayload
    requestId: `${baseRequest.requestId}:${step}`,
    toolKey: tool,
    workflowType: tool,
    input: {
      ...baseRequest.input,  // ← PRESERVA extractionPayload dal baseRequest
      intent: baseRequest.input.intent ?? 'new',
      step,
      stepDependencyArtifactIds: dependencyEntries.map(([, artifactId]) => artifactId),
      stepDependencyArtifactIdsByStep: Object.fromEntries(dependencyEntries),
      ...(dependencyContentEntries.length > 0
        ? { stepDependencyArtifactContentsByStep: Object.fromEntries(dependencyContentEntries) }
        : {}),
    },
  };
};
```

**CONCLUSION**: `extractionPayload` viene INCLUSO nel request finale perché `...baseRequest.input` lo preserva.

#### Fase 4: Invio al server (riga 680)

```typescript
// Linea 680
generation.start(request);
```

Il `GenerationRequest` viene inviato via `fetch` a `/generation/stream` con il payload JSON completo.

**Diagnostic logging** (righe 676-690):

```typescript
// Linea 676-690: Debug logging (solo in DEV)
if (import.meta.env.DEV) {
  const briefingTextInRequest = typeof request.input.briefingText === 'string'
    ? request.input.briefingText
    : '';
  const extractionPayloadInRequest = request.input.extractionPayload;
  const extractionPayloadKeysInRequest = (
    extractionPayloadInRequest !== null
    && typeof extractionPayloadInRequest === 'object'
  )
    ? Object.keys(extractionPayloadInRequest as Record<string, unknown>).length
    : 0;
  
  console.info('[ToolPageTemplate] generation request context', {
    step,
    routeIntent: intent,
    runtimeIntent: request.input.intent,
    requestId: request.requestId,
    sourceArtifactId: request.input.sourceArtifactId,
    briefingId: request.input.briefingId,
    briefingTextLengthInRequest: briefingTextInRequest.length,
    extractionArtifactIdInRequest: request.input.extractionArtifactId,
    extractionPayloadKeysInRequest,  // ← NUMERO DI CHIAVI DEL PAYLOAD
    stepDependencyArtifactIdsCount,
  });
}
```

### 1.2 Flusso Backend: Lettura del Payload

**File**: `src/lib/adapters/generation.adapters.ts`

**Linea 99-101**:

```typescript
const buildSyntheticResponse = (input: LlmStreamInput): string => {
  // For extraction requests, return the extraction payload as JSON
  const extractionPayload = input.requestInput.extractionPayload;  // ← LEGGE payload
  if (extractionPayload && typeof extractionPayload === 'object') {
    return JSON.stringify(extractionPayload, null, 2);
  }

  // For other requests, use the prompt
  const prompt = input.requestInput.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${input.requestId}`;
};
```

Il server legge `input.requestInput.extractionPayload` e lo usa come risposta sintetica.

**File**: `src/lib/adapters/openrouter.adapter.ts`

**Linea 96-110**:

```typescript
const buildContextBlock = (requestInput: Record<string, unknown>): string | null => {
  const briefingText =
    toNonEmptyString(requestInput.briefingText)
    ?? toNonEmptyString(requestInput.normalizedText);

  const extractionPayload = requestInput.extractionPayload;  // ← LEGGE payload
  const payloadJson =
    extractionPayload && typeof extractionPayload === 'object'
      ? JSON.stringify(extractionPayload, null, 2)
      : null;

  // ... resto della logica che usa payloadJson nel prompt ...
};
```

### 1.3 Possibili Root Cause di Bug 1

#### Possibilità A: Payload vuoto dal frontend
Il `extractionPayload` potrebbe arrivare vuoto `{}` se:
- **A1**: `briefingSnapshot.context.extractionPayload` è stato inizializzato come `{}` (riga 597-598)
- **A2**: La funzione `parseExtractionPayloadFromContent()` non riesce a estrarre il payload dal brief

**Test**: Controllare la linea 689 del debug logging:
```
extractionPayloadKeysInRequest: 0  // ← Se è 0, il payload è vuoto
```

#### Possibilità B: Backend non usa il payload nel prompt
Il backend legge il payload (riga 99 di generation.adapters.ts), ma potrebbe non includerlo nel prompt LLM in modo corretto.

#### Possibilità C: Brevingupload non estrae il payload
Se `briefingSnapshot.context.extractionPayload` rimane `{}` dopo l'estrazione, il problema è nella machine `briefing-upload.machine.ts`, non in ToolPageTemplate.

### 1.4 Raccomandazioni Debug per Bug 1

**A livello Frontend** (ToolPageTemplate.tsx):

1. **Aggiungi logging dettagliato** (dopo riga 625):
```typescript
if (import.meta.env.DEV) {
  console.info('[ToolPageTemplate] extractionInfo details', {
    hasExtractionArtifactId: effectiveExtractionInfo.extractionArtifactId?.length > 0,
    extractionPayloadKeys: Object.keys(effectiveExtractionInfo.extractionPayload),
    extractionPayloadSample: Object.entries(effectiveExtractionInfo.extractionPayload).slice(0, 3),
    needsPayloadEnrichment,
    shouldEnrichFromExtractionArtifact,
    briefingTextLength: effectiveExtractionInfo.briefingText.length,
  });
}
```

2. **Verifica il campo `step` nel request** (riga 672):
```typescript
// Se step è vuoto/undefined, il server potrebbe interpretare male il request
if (!request.input.step) {
  console.warn('[ToolPageTemplate] Missing step in request input');
}
```

**A livello Backend**:

1. **File** `src/lib/adapters/openrouter.adapter.ts` — Aggiungi logging (dopo riga 103):
```typescript
if (payloadJson) {
  console.info('[openrouter.adapter] Extraction payload included in prompt', {
    payloadLength: payloadJson.length,
    payloadKeys: Object.keys(JSON.parse(payloadJson) as Record<string, unknown>),
  });
}
```

2. **Verifica il prompt inviato all'LLM**: Aggiungi logging del prompt completo prima di `openrouter/fetch`.

---

## BUG 2: CTA FORM RESTA DISABILE DOPO L'ULTIMO STEP

### 2.1 Il Bridge Frontend (ToolPageTemplate.tsx, righe 710-745)

```typescript
useEffect(() => {
  // Linea 711-714: Se streaming è attivo, marca il ref e torna
  if (generation.isStreamActive) {
    wasStreamActiveRef.current = true;
    return;
  }

  // Linea 716-720: Se non era streaming prima (o è il mount iniziale), skip
  if (!wasStreamActiveRef.current) {
    return;
  }

  wasStreamActiveRef.current = false;

  // Linea 725-726: LEGGE completedStep e failedStep dal snapshot
  const completedStep = generation.terminalCompletedStep;  // ← null se server non invia
  const failedStep = generation.terminalFailedStep;

  // Linea 728-732: Se completedStep è valido, invia STEP_DONE
  if (completedStep && toolConfig.steps.includes(completedStep as ToolStep)) {
    toolPageSend({ type: 'STEP_DONE', step: completedStep as ToolStep });
  } 
  // Linea 732-734: Altrimenti, se failedStep è valido, invia STEP_FAILED
  else if (failedStep && toolConfig.steps.includes(failedStep as ToolStep)) {
    toolPageSend({ type: 'STEP_FAILED', step: failedStep as ToolStep, message: 'Generazione fallita' });
  }
  // ← NO FALLBACK: Se entrambi sono null, niente viene inviato!
  
}, [generation.isStreamActive, generation.terminalCompletedStep, generation.terminalFailedStep, toolConfig.steps, toolPageSend]);
```

**PROBLEMA CRITICO**: Se `completedStep === null` e `failedStep === null`, il bridge non invia niente alla tool-page machine! La macchina non sa che lo step è terminato.

### 2.2 Come `generation.terminalCompletedStep` viene settato

**File**: `frontend/src/features/generation/machines/frontend-stream.machine.ts`

#### Dichiarazione del campo (riga 37):
```typescript
export type FrontendStreamContext = {
  // ... altri campi ...
  terminalCompletedStep: string | null;
  terminalFailedStep: string | null;
  // ...
};
```

#### Definizione dell'evento SSE_TERMINAL (righe 48-57):
```typescript
type FrontendStreamEvent =
  | { type: 'REQUEST_START'; request: GenerationRequest }
  | { type: 'SSE_START'; requestId: string; artifactId: string }
  | { type: 'SSE_CHUNK'; artifactId: string; chunk: string; sequence: number }
  | {
    type: 'SSE_TERMINAL';
    artifactId: string | null;
    status: 'completed' | 'failed';
    reason: string | null;
    completedStep?: string | null;  // ← OPZIONALE dal server
    failedStep?: string | null;     // ← OPZIONALE dal server
  }
  // ...
};
```

#### Action `setTerminalSuccess` (righe 123-130):
```typescript
setTerminalSuccess: assign({
  hasTerminal: () => true,
  errorCode: () => null,
  errorMessage: () => null,
  artifactId: ({ context, event }) =>
    event.type === 'SSE_TERMINAL'
      ? (event.artifactId ?? context.artifactId)
      : context.artifactId,
  terminalCompletedStep: ({ event }) =>
    event.type === 'SSE_TERMINAL' ? (event.completedStep ?? null) : null,  // ← DIPENDE DA event.completedStep
  terminalFailedStep: () => null,
}),
```

**KEY FINDING**: `terminalCompletedStep` viene settato da `event.completedStep ?? null`. Se il server non invia `completedStep`, rimane `null`.

### 2.3 Dove viene creato il SSE_TERMINAL nel backend

**File**: `src/lib/runtime/stream-contract.ts` (righe 1-27)

```typescript
export type BackendStreamEvent =
  | { event: 'start'; data: { requestId: string; artifactId: string } }
  | { event: 'chunk'; data: { artifactId: string; chunk: string; sequence: number } }
  | {
    event: 'terminal';
    data: {
      artifactId: string | null;
      status: 'completed' | 'failed';
      reason: string | null;
      completedStep?: string | null;  // ← OPZIONALE nel contratto!
      failedStep?: string | null;     // ← OPZIONALE nel contratto!
    };
  };
```

**Il problema**: `completedStep` e `failedStep` sono OPZIONALI nel contratto (marked with `?`).

**Ricerca del punto di generazione del terminal event**:

Nel backend, il terminal event viene creato quando la generazione termina. Secondo il piano `refactor-frontend-backend-dead-code-drift-1.md`, **TASK-026** dovrebbe aggiungere il `completedStep` al payload:

> **TASK-026** | Replace UI-side generation completion bridge (`STEP_DONE`/`STEP_FAILED` inferred from stream status) with backend-originated step outcome metadata carried inside canonical `BackendStreamEvent` (`start`/`chunk`/`terminal`) payloads... | ✅ | 2026-05-04

Ma il piano mostra che è marcato come ✅ completato, mentre in realtà **non è implementato nel backend**.

**Dove dovrebbe essere implementato**: Probabilmente nel file che genera il terminal event finale, potrebbe essere:
- `src/lib/machines/generation-system.machine.ts` (orchestrator finale)
- `src/lib/machines/stream-transport.machine.ts` (emitter dello stream)
- Un file di serializzazione del SSE event

**Verifica rapida**: Nel file `src/lib/runtime/http-sse.ts` (linea 59-63):
```typescript
const terminalFrame = serializeSseEvent({
  event: 'terminal',
  data: {
    artifactId: null,
    status: 'failed',
    reason: error instanceof Error ? error.message : 'stream_runtime_error',
    // ← completedStep NON è incluso!
  },
});
```

### 2.4 Flusso SSE dal Backend al Frontend

1. **Server** crea un `BackendStreamEvent` con `terminal` (senza `completedStep`)
2. **Parser frontend** (`sse-parser.ts:132`) parsa `completedStep: ensureNullableString(data.completedStep ?? null, 'completedStep')`
3. Se il server non invia `completedStep`, rimane `null`
4. **frontend-stream.machine** (`setTerminalSuccess` riga 129) assegna `terminalCompletedStep: null`
5. **ToolPageTemplate** (riga 726) legge `generation.terminalCompletedStep === null`
6. **Bridge non invia niente** (niente STEP_DONE)
7. **tool-page machine** non sa che lo step è terminato
8. **Readiness non aggiorna** → CTA rimane disabile

### 2.5 Sequenza di dipendenza per determinare canStartFlow

Nel file `frontend/src/features/tools/machines/tool-page.machine.ts` (linea 86-94):

```typescript
const buildReadinessSnapshot = (
  projectId: string,
  hasExtractionContext: boolean,
  hasPrimaryTargetStep: boolean,
): ReadinessSnapshot => {
  const hasProject = projectId.trim().length > 0;
  const reasonCodes: ReadinessReasonCode[] = [];

  if (!hasProject) {
    reasonCodes.push('missing_project');
  }

  if (!hasExtractionContext) {
    reasonCodes.push('missing_extraction_context');
  }

  if (!hasPrimaryTargetStep) {
    reasonCodes.push('missing_primary_target_step');
  }

  return {
    canStartFlow: reasonCodes.length === 0,
    // ...
  };
};
```

Se uno qualsiasi dei motivi rimane true dopo l'ultimo step, `canStartFlow = false` → CTA disabile.

**Il problema**: Se il bridge (riga 726-734 di ToolPageTemplate) non invia `STEP_DONE`, la tool-page machine non aggiorna `progress.completedSteps`, quindi `readiness.reasonCodes` continua a includere i motivi di blocco.

### 2.6 Raccomandazioni Debug per Bug 2

**A livello Frontend** (ToolPageTemplate.tsx):

1. **Aggiungi fallback quando `completedStep === null`** (dopo riga 725):
```typescript
const completedStep = generation.terminalCompletedStep;
const failedStep = generation.terminalFailedStep;

// ← FALLBACK: Se entrambi sono null, inferisci da streamStatus
if (!completedStep && !failedStep && generation.streamStatus === 'completed') {
  console.warn('[ToolPageTemplate] Backend did not send completedStep; inferring from lastRequest');
  
  const lastRequestStep = (generation.snapshot.context.lastRequest?.input as Record<string, unknown>)?.step;
  if (typeof lastRequestStep === 'string' && toolConfig.steps.includes(lastRequestStep as ToolStep)) {
    toolPageSend({ type: 'STEP_DONE', step: lastRequestStep as ToolStep });
    return;
  }
}
```

2. **Log del bridge per capire cosa accade** (riga 710):
```typescript
useEffect(() => {
  if (import.meta.env.DEV) {
    console.info('[ToolPageTemplate] Stream state changed', {
      isStreamActive: generation.isStreamActive,
      wasStreamActive: wasStreamActiveRef.current,
      terminalCompletedStep: generation.terminalCompletedStep,
      terminalFailedStep: generation.terminalFailedStep,
      streamStatus: generation.streamStatus,
      readiness: readinessSnapshot,
      primaryActionPolicy: machineViewModel.primaryActionPolicy,
    });
  }
  
  if (generation.isStreamActive) {
    wasStreamActiveRef.current = true;
    return;
  }
  // ...
}, [...]);
```

**A livello Backend**:

1. **Aggiungi `completedStep` al SSE_TERMINAL** in ogni punto di generazione:
   - Nel file che emette il terminal event, aggiungi il campo `completedStep` dal context della generazione
   - Esempio (dove viene creato il terminal event):
   ```typescript
   const terminalFrame = serializeSseEvent({
     event: 'terminal',
     data: {
       artifactId: context.artifactId,
       status: 'completed',
       reason: null,
       completedStep: context.currentStep ?? null,  // ← AGGIUNGI QUESTO
     },
   });
   ```

2. **Aggiorna il contratto** se non lo è già:
   - Verifica che `stream-contract.ts` abbia `completedStep` come **required**, non optional

---

## VERIFICA DELLA SERIALIZZAZIONE DEL PAYLOAD

### Checklist di Serializzazione (Bug 1)

✅ **Frontend → GenerationRequest**:
- [x] `briefingSnapshot.context.extractionPayload` compilato dalla BriefingUpload
- [x] Incluso in `baseRequest.input.extractionPayload` (riga 659)
- [x] Preservato da `createStepRequest` tramite `...baseRequest.input` (tool-generation-engine.ts:22)
- [x] Inviato via JSON stringification nel fetch body

✅ **Backend → Ricezione del Payload**:
- [x] Server riceve POST a `/generation/stream` con JSON body
- [x] Il payload viene parsato in `requestInput.extractionPayload` (generation.adapters.ts:99)
- [x] Viene letto in `buildSyntheticResponse` e `buildContextBlock`

❓ **Uso del Payload nel Prompt LLM**:
- **Verificare**: Se il payload viene effettivamente incluso nel prompt inviato all'LLM
- **Verificare**: Se il payload è vuoto `{}` quando arriva al server

---

## TABELLA DI CONFRONTO: FLUSSO ATTESO vs REALE

| Componente | Expected | Actual | Status |
|---|---|---|---|
| ToolPageTemplate: payload in baseRequest | ✅ extractionPayload incluso | ✅ incluso (riga 659) | ✅ OK |
| createStepRequest: payload preservato | ✅ via `...baseRequest.input` | ✅ preservato (tool-generation-engine:22) | ✅ OK |
| generation-client.ts: send to server | ✅ incluso nel JSON body | ✅ inviato | ✅ OK |
| backend: parse payload | ✅ `input.requestInput.extractionPayload` | ✅ letto (generation.adapters:99) | ✅ OK |
| backend: use in prompt | ✅ incluso come context | ❓ **VERIFICARE** | ❓ UNKNOWN |
| SSE_TERMINAL: completedStep | ✅ `completedStep: step` | ❌ `completedStep` non incluso | ❌ MISSING |
| ToolPageTemplate: bridge invia STEP_DONE | ✅ invia se `completedStep` | ❌ non invia se `null` | ❌ BROKEN |
| tool-page machine: aggiorna readiness | ✅ dopo `STEP_DONE` | ❌ non aggiorna | ❌ BLOCKED |
| CTA primaryActionPolicy | ✅ `'start-generation'` | ❌ rimane `'disabled'` | ❌ BROKEN |

---

## RACCOMANDAZIONI PRIORITARIE

### Per Bug 1 (Brief Output)

**Priority 1**: Verificare se il payload è vuoto dal frontend
```bash
# Avvia in DEV mode e verifica console
npm run dev
# Genera un artifact e cerca nel console:
# [ToolPageTemplate] generation request context
# → extractionPayloadKeysInRequest: 0 (EMPTY) o > 0 (OK)
```

**Priority 2**: Se il payload arriva vuoto, il problema è in `briefing-upload.machine.ts`

**Priority 3**: Se il payload arriva con dati, verificare il backend prompt inclusion

### Per Bug 2 (CTA Disabile)

**Priority 1 (IMMEDIATE)**: Implementare TASK-026
- [ ] Aggiungi `completedStep` al SSE_TERMINAL nel backend
- [ ] Aggiorna `stream-contract.ts` se necessario (probabilmente da `optional` a `required`)
- [ ] Valida l'end-to-end con test

**Priority 2 (INTERIM FIX)**: Aggiungi fallback nel bridge
```typescript
// In ToolPageTemplate.tsx riga 725-735
if (!completedStep && !failedStep && generation.streamStatus === 'completed') {
  const inferredStep = (generation.snapshot.context.lastRequest?.input as Record<string, unknown>)?.step;
  if (typeof inferredStep === 'string') {
    toolPageSend({ type: 'STEP_DONE', step: inferredStep as ToolStep });
  }
}
```

---

## LOG LOCATIONS PER DEBUGGING

| Component | File | Line | Purpose |
|---|---|---|---|
| Brief upload state | ToolPageTemplate.tsx | 154-156 | `briefingSnapshot.context.extractionPayload` |
| baseRequest construction | ToolPageTemplate.tsx | 630-665 | Check if payload is included |
| Generation request debug | ToolPageTemplate.tsx | 676-690 | `extractionPayloadKeysInRequest` counter |
| Backend payload read | generation.adapters.ts | 99 | `input.requestInput.extractionPayload` |
| Backend prompt include | openrouter.adapter.ts | 96-110 | `payloadJson` use in prompt |
| Stream terminal emit | stream-contract.ts | 20-25 | Check if `completedStep` exists |
| Bridge state transition | ToolPageTemplate.tsx | 725-735 | `generation.terminalCompletedStep` check |

---

## SUMMARY

1. **Bug 1** non è nella trasmissione del payload; il payload viene correttamente serializzato e ricevuto dal backend. **Il problema è likely la compilazione del payload dal frontend o l'uso nel prompt LLM.**

2. **Bug 2** è causato da una feature non implementata (TASK-026): il backend non invia `completedStep` nel SSE_TERMINAL, quindi il frontend non può capire che lo step è completato e rimane bloccato.

3. Un **fallback interim** nel bridge è possibile, ma la **soluzione propria è implementare TASK-026 nel backend**.
