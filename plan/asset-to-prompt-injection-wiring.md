---
status: draft
version: 1.0.0
last-reviewed: 2026-07-17
next-review-date: 2026-07-24
owner: ai-execution-engine
type: implementation-plan
goal: Wire asset selection from FE to LLM prompt injection in BE generation flow
---

# Asset → Prompt Injection Wiring Plan

## Stato attuale (gap)

```
FE AssetKnowledgePanel  ──→  onAssetSelect={() => {}}  ✗  callback vuoto
                                    │
                                    ▼
         assetReferences NON inviati nella richiesta orchestrata
                                    │
                                    ▼
BE asset-injection-resolver.ts esiste (419 linee) ma MAI chiamato da generation flow
```

Il risolutore `asset-injection-resolver.ts` (419 linee) è **completamente implementato** con:
- Snapshot semantics (DDD-196): risoluzione al momento della generazione
- Field mappings (DDD-207): estrazione strutturata da asset content
- 3 modalità di injection: `prepend`, `append`, `replace`
- Staleness checking (DDD-198): warning per asset con upstream obsoleto
- Structured logging (DDD-205): tracciamento injection per quality scoring

**Ma non è mai chiamato durante la generazione reale.**

---

## Architettura del flusso

```
FE                          BE
─────────────────────────────────────────────────
AssetKnowledgePanel
  │ checkbox ✓              
  ▼
selectedAssetIds[]          
  │                         
  ▼ POST /generation/stream 
  │ assetReferences: [...]  
  │                         ──→ http-sse-request-adapter.ts
  │                               │ parse body.assetReferences
  │                               ▼
  │                             generation-system.machine.ts
  │                               │ resolveToolPrompt →
  │                               │ assetSnapshotResolver →
  │                               │ resolveAssetInjectedPrompt() →
  │                               │ finalPrompt → LLM
  │                             ◄──
  ◄── SSE stream
```

**Decisione architetturale**: Gli `assetReferences` vanno nella richiesta `POST /generation/stream`, **NON** nell'orchestrate (`POST /api/tools/orchestrate`), perché:
- L'orchestrate risolve solo dipendenze tra step, non injection
- Snapshot semantics: gli asset vanno risolti al momento della generazione (DDD-196)
- Separazione pulita: orchestrate = cosa serve da step precedenti, stream = cosa iniettare nel prompt
- L'orchestrate può essere servito da cache (idempotency) senza asset data

---

## Task 1: FE — Store asset selection state

**File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
**Complessità**: MEDIUM

**Cambiamento**: Sostituire `onAssetSelect={() => {}}` con uno state che traccia gli assetId selezionati.

**Prima**:
```tsx
<AssetKnowledgePanel
  workspaceAssets={workspace.assets}
  toolAssetInputs={assetInputs}
  projectId={workspace.id}
  onAssetSelect={() => {}}                    // ← vuoto
  onCreateAssetAction={handleCreateAssetAction}
/>
```

**Dopo**:
```tsx
const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
// ...
<AssetKnowledgePanel
  workspaceAssets={workspace.assets}
  toolAssetInputs={assetInputs}
  projectId={workspace.id}
  onAssetSelect={setSelectedAssetIds}          // ← reale
  onCreateAssetAction={handleCreateAssetAction}
/>
```

Passare `selectedAssetIds` al context di `useToolPage` in modo che siano disponibili nella dispatch di generazione.

---

## Task 2: FE — Inviare selectedAssetIds nella richiesta di stream

**File**: `apps/frontend/src/features/tools/runtime/useToolPage.ts`
**Complessità**: ALTO

Il `useToolPage` hook (o il controller equivalente) gestisce la dispatch di generazione via `POST /generation/stream`.

**Cambiamento**: Aggiungere `selectedAssetIds` al payload della richiesta stream:

```ts
// In startGeneration() o handlePrimaryAction():
const assetReferences = selectedAssetIds.map(assetId => ({
  assetId,
  usageIntent: 'injection' as const,
}));

await fetch('/generation/stream', {
  method: 'POST',
  body: JSON.stringify({
    projectId,
    toolKey,
    stepKey: targetStep,
    // ... altri campi esistenti
    assetReferences: assetReferences.length > 0 ? assetReferences : undefined,
  }),
});
```

**Attenzione**: Il payload stream è probabilmente gestito via XState events. Occorre capire se `useToolPage` delega a `useToolPageRunController` o a `GenerationWorkspaceProvider`. Il `assetReferences` va aggiunto all'event TypeScript/XState che innesca la generazione.

**Opzioni di implementazione**:
1. **Aggiungere al context di useToolPageRunController**: se il controller ha un `input` object, aggiungere `assetReferences` lì
2. **Passare via GenerationWorkspaceProvider**: aggiungere `assetReferences` allo stato condiviso
3. **Modificare l'evento di dispatch**: se la generazione usa un evento XState `START_GENERATION`, aggiungere `assetReferences` al payload dell'evento

Da verificare nel codice esistente quale pattern è più coerente.

---

## Task 3: BE — Ricevere assetReferences nel generation stream

**File**: `apps/backend/src/lib/runtime/auth-http/generation/http-sse-request-adapter.ts`
**Complessità**: BASSO

**Cambiamento**: Nel parsing della richiesta `POST /generation/stream`, estrarre e validare `assetReferences`:

```ts
// Accanto al parsing di projectId, toolKey, stepKey:
const assetReferences: AssetReferenceInput[] = Array.isArray(body.assetReferences)
  ? body.assetReferences.filter(ref => 
      typeof ref.assetId === 'string' && ref.assetId.length > 0
    )
  : [];

// Validazione
import { validateAssetReferences } from '../../runtime/asset-injection-resolver';

if (assetReferences.length > 0) {
  const validation = validateAssetReferences(assetReferences);
  if (!validation.valid) {
    writeError(response, 400, 'bad_request', 
      `Invalid assetReferences: ${validation.errors.join('; ')}`);
    return;
  }
}
```

Passare `assetReferences` al `GenerationSystemDependencies` o all'evento di avvio della macchina XState.

---

## Task 4: BE — Iniettare asset nel prompt prima della chiamata LLM

**File**: `apps/backend/src/lib/machines/generation-system.machine.ts`
**Complessità**: MEDIO

**Punto di inserimento**: Dopo la risoluzione del prompt (`resolveToolPrompt` / `readPromptFile`) e **prima** della chiamata LLM (`llmGenerate` actor).

**Cambiamento**:

```ts
// Dopo resolveToolPrompt:
const basePrompt = resolvedPrompt; // prompt risolto da file markdown

// Se ci sono assetReferences, risolvere e iniettare
let finalPrompt = basePrompt;

if (context.assetReferences?.length > 0) {
  const resolvedAssets: ResolvedAssetContent[] = [];
  
  for (const ref of context.assetReferences) {
    const snapshot = await deps.assetSnapshotResolver.getAssetSnapshot(ref.assetId);
    if (snapshot) {
      resolvedAssets.push(snapshot);
    }
  }

  // Generare injection directives
  const directives: InjectionDirectiveInput[] = resolvedAssets.map(asset => ({
    assetId: asset.assetId,
    stepKey: context.currentStep,
    injectionMode: 'prepend' as const,
    fieldMappingKey: `${asset.assetType}→${context.toolKey}`,
  }));

  // Applicare injection
  finalPrompt = resolveAssetInjectedPrompt(
    basePrompt,
    resolvedAssets,
    directives,
    context.currentStep,
  );

  // Logging
  const logger = createAssetInjectionLogger();
  for (const asset of resolvedAssets) {
    logger.logInjectionResolved({
      assetId: asset.assetId,
      assetType: asset.assetType,
      contentLength: asset.content.length,
    });
    if (asset.staleUpstream) {
      logger.logStalenessWarning({
        assetId: asset.assetId,
        upstreamLabel: asset.upstreamLabel ?? 'unknown',
        versionNumber: asset.versionNumber,
      });
    }
  }
}

// Usare finalPrompt invece di basePrompt nella chiamata LLM
```

**Assunzione**: `context.assetReferences` è disponibile come parte del context della macchina XState. Se non lo è, va aggiunto al `GenerationSystemContext`.

---

## Task 5: BE — Collegare assetSnapshotResolver ai repository DB

**File**: 
- `apps/backend/src/lib/adapters/asset.adapter.ts`
- `apps/backend/src/lib/machines/generation-system.types.ts`
- `apps/backend/src/lib/machines/generation-system.context-types.ts`

**Complessità**: MEDIO

### 5a: Aggiungere al GenerationSystemDependencies

```ts
// In generation-system.types.ts:
export interface GenerationSystemDependencies {
  // ... esistenti
  assetSnapshotResolver: AssetSnapshotResolver;
}
```

### 5b: Creare il resolver al bootstrap

Nel file che costruisce la macchina XState (probabilmente `generation-system.machine.ts` o un file di factory):

```ts
import { createAssetSnapshotResolver } from '../runtime/asset-injection-resolver';

const assetSnapshotResolver = createAssetSnapshotResolver(
  async (id) => {
    // Usare l'adapter esistente per fetchare asset
    const asset = await deps.getAssetById(id);
    if (!asset) return null;
    return {
      assetId: asset.assetId,
      assetType: asset.assetType,
      label: asset.label,
      content: asset.content,
      currentVersion: asset.currentVersion,
      staleUpstream: asset.staleUpstream,
    };
  },
  async (assetId) => {
    // Usare listAssetVersions
    const response = await deps.listAssetVersions(assetId);
    return response.versions;
  },
  async (groupId) => {
    // Fetch asset group
    const group = await deps.getAssetGroupById(groupId);
    return group ? { assetIds: group.assetIds } : null;
  },
);
```

### 5c: Aggiungere assetReferences al context

```ts
// In generation-system.context-types.ts:
export interface GenerationSystemContext {
  // ... esistenti
  assetReferences?: AssetReferenceInput[];
}
```

---

## Task 6: Integration test

**Complessità**: MEDIO

### 6a: Test unitario del resolver (già esistente)

Verificare che i test esistenti in `runtime.asset-injection-resolver.test.ts` passino dopo le modifiche (dovrebbero già passare — verificare).

### 6b: Test di integrazione end-to-end

```ts
test('selected assets are injected into generation prompt', async () => {
  // 1. Creare un asset nel DB
  const asset = await createTestAsset({ 
    assetType: 'competitor-analysis', 
    content: '{"title": "Test Angle", "hook": "Test Hook"}' 
  });

  // 2. Avviare generazione con assetReferences
  const result = await generateContent({
    toolKey: 'angle-generator',
    stepKey: 'context-and-angle-matrix',
    assetReferences: [{ assetId: asset.id, usageIntent: 'injection' }],
  });

  // 3. Verificare che il prompt contenga il contenuto dell'asset
  expect(result.prompt).toContain('Test Angle');
  expect(result.prompt).toContain('## Angle:');
});

test('stale asset triggers warning during injection', async () => {
  const asset = await createTestAsset({ 
    assetType: 'angle', 
    staleUpstream: true 
  });

  const { logs } = await generateContentWithCapturedLogs({
    assetReferences: [{ assetId: asset.id, usageIntent: 'injection' }],
  });

  expect(logs).toContain('[AssetStalenessPolicy] Stale asset used');
});
```

### 6c: Smoke test manuale

1. Aprire `meta-ads` in un workspace con asset `angle` disponibili
2. Selezionare un asset angle nella checkbox
3. Avviare generazione
4. Verificare nel prompt LLM (log backend) che l'angle sia stato iniettato
5. Verificare che la generazione produca output coerente con l'input iniettato

---

## Riepilogo task

| # | Task | File principale | Complessità | Dipendenze |
|---|---|---|---|---|
| T1 | Store asset selection state | `ToolPageTemplate.tsx` | MEDIUM | — |
| T2 | Send assetReferences in stream request | `useToolPage.ts` | ALTO | T1 |
| T3 | Parse assetReferences in stream handler | `http-sse-request-adapter.ts` | BASSO | — |
| T4 | Inject assets into prompt before LLM call | `generation-system.machine.ts` | MEDIO | T3 |
| T5 | Connect assetSnapshotResolver to DB | `asset.adapter.ts` + types | MEDIO | T4 |
| T6 | Integration tests | test files | MEDIO | T5 |

### Ordine esecuzione

```
T1 ──→ T2 ──→ T6
T3 ──→ T4 ──→ T5 ──┘
```

**Durata stimata**: 3-4 giorni
**Critical path**: T3 → T4 → T5 → T6 (2-3 giorni)
