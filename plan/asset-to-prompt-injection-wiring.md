---
status: completed
version: 1.3.0
last-reviewed: 2026-07-18
next-review-date: 2026-08-18
owner: ai-execution-engine
type: implementation-plan
goal: Wire asset selection from FE to LLM prompt injection in BE generation flow
---

# Asset → Prompt Injection Wiring Plan

## Stato attuale — COMPLETED (validated 2026-07-18)

```
FE AssetKnowledgePanel  ──→  onAssetSelect={setSelectedAssetIds}  ✓
                                    │
                                    ▼
     selectedAssetIds → volatileArgsRef  ✓  (fix: stale closure bug)
                                    │
                                    ▼
     assetReferences inviati via input.assetReferences  ✓
     (buildBaseGenerationRequest → createStepRequest)
                                    │
                                    ▼
BE generationActor (generation-actor.ts, XState fromPromise)
  estrae assetReferences da context.requestInput
  risolve snapshot via context.adapters.assetSnapshotResolver  ✓  (fix: stub → real DB)
  inietta nel prompt prima di generateText()  ✓
```

### Validazione (2026-07-18)

Flusso testato end-to-end con `funnel-pages` + asset `brief`:
1. Frontend invia `assetReferences: [{ assetId: "ast_c291899c...", sourceToolKey: "funnel-pages", usageIntent: "injection" }]`
2. Backend `generationActor` risolve l'asset via `getAssetSnapshot()` → 149KB di contenuto
3. `resolveAssetInjectedPrompt()` inietta il contenuto nel prompt (prepend mode)
4. Prompt finito: basePrompt(11KB) → injectedPrompt(161KB) → delta +149KB
5. LLM genera output pertinente al brief

### Fix applicati in sessione

| Fix | File | Root cause |
|-----|------|------------|
| `selectedAssetIds` in volatileRef | `useToolPageRunController.ts` | Stale closure: useCallback deps non includevano `selectedAssetIds` |
| Real `assetSnapshotResolver` | `postgres-redis.adapters.ts` | Stub restituiva sempre null, ignora asset DB |
| `canStartGeneration` guard | `tool-page.machine.ts` | Guard bloccava su `missing_extraction_context` anche quando asset coprivano il contesto |
| `hasAssetBasedExtractionContext` | `useToolPage.ts`, `ToolPageTemplate.tsx` | Override readiness quando asset always-required soddisfatti |
| `completedFileKeys` override | `ToolPageTemplate.tsx` | Include briefing-file quando asset coprono (matrix non blocca) |
| Brief required, others optional | `toolAssetRegistry.ts` | Invertito: brief=always-required, persona/brand-voice=optional |

## Revisione XState v5

La macchina di generazione usa il pattern XState v5 `setup()`:

```ts
// generation-system.definition.ts
generationSystemMachine = setup({
  types: {
    context: {} as GenerationMachineContext,
    input: {} as GenerationSystemInput,
    events: {} as GenerationSystemEvent,
  },
  actions: generationSystemActions,
  guards: generationSystemGuards,
  actors: generationSystemActors,
}).createMachine({
  context: ({ input }) => ({
    ...buildGenerationCoreDefaults(),
    ...buildGenerationRuntimeDefaults(),
    ...buildGenerationMetricsDefaults(),
    ...buildGenerationInfraContext(input.adapters, input.runtime),
    ...input.initialContext,       // ← qui si iniettano campi extra
  }),
  states: { ... },
});

// generation-actor.ts — dove avviene la generazione effettiva
generationActor = fromPromise(async ({ input }) => {
  const { context } = input;
  const result = await context.adapters.generate.generateText({
    requestId: context.requestId,
    model: context.model,
    requestInput: context.requestInput,  // Record<string, unknown> — contiene prompt e params
  });
});
```

**Punti di inserimento chiave**:

| Cosa | Dove | Come |
|---|---|---|
| `assetReferences` come input | `initialContext` in `GenerationSystemInput` | Campo extra nel `GenerationRuntimeContext` |
| `assetSnapshotResolver` | `GenerationAdapters` | Nuovo campo nell'interfaccia adapters |
| Injection nel prompt | Dentro `generationActor` | Prima di `generateText()`, modificare `requestInput` con il prompt iniettato |

---

## Task 1: FE — Store asset selection state

**File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
**Complessità**: MEDIUM

**Prima**:
```tsx
<AssetKnowledgePanel
  onAssetSelect={() => {}}   // ← vuoto
  ...
/>
```

**Dopo**:
```tsx
const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
// ...
<AssetKnowledgePanel
  onAssetSelect={setSelectedAssetIds}
  ...
/>
```

Passare `selectedAssetIds` al controller di generazione (`useToolPage`).

---

## Task 2: FE — Inviare assetReferences nel POST /generation/stream

**File**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
**Complessità**: ALTO

Aggiungere `assetReferences` al payload della richiesta di stream:

```ts
const assetReferences = selectedAssetIds.map(assetId => ({
  assetId,
  usageIntent: 'injection' as const,
}));

// Nel payload di POST /generation/stream:
{
  projectId,
  toolKey,
  stepKey,
  requestInput: { ... },
  assetReferences: assetReferences.length > 0 ? assetReferences : undefined,
}
```

---

## Task 3: BE — Ricevere assetReferences nello stream handler

**File**: `apps/backend/src/lib/runtime/auth-http/generation/` (il file che gestisce `POST /generation/stream`)
**Complessità**: BASSO

Estrarre e validare `assetReferences` dal body, passarli come `initialContext` alla macchina:

```ts
const assetReferences = body.assetReferences ?? [];

const actor = createActor(generationSystemMachine, {
  input: {
    adapters: generationAdapters,
    initialContext: {
      assetReferences,  // ← XState v5: context({ input }) lo merge
    },
  },
});
```

---

## Task 4: BE — Aggiungere assetReferences al GenerationRuntimeContext

**File**: `apps/backend/src/lib/machines/generation-system.context-types.ts`
**Complessità**: BASSO

```ts
import type { AssetReferenceInput } from '../runtime/asset-injection-resolver';

export type GenerationRuntimeContext = {
  // ...esistenti
  readonly assetReferences?: AssetReferenceInput[];
};
```

---

## Task 5: BE — Aggiungere assetSnapshotResolver ai GenerationAdapters

**File**: `apps/backend/src/lib/adapters/generation.adapters.ts`
**Complessità**: MEDIO

```ts
import type { AssetSnapshotResolver } from '../runtime/asset-injection-resolver';

export interface GenerationAdapters {
  // ... esistenti
  readonly assetSnapshotResolver: AssetSnapshotResolver;
}
```

Il resolver va costruito al bootstrap, prima di creare la macchina:

```ts
// In server.ts o dove si costruiscono i GenerationAdapters:
const assetSnapshotResolver = createAssetSnapshotResolver(
  // getAssetById → usa pool.query('SELECT * FROM assets WHERE id = $1')
  async (id) => {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    // ... mapping
  },
  // getAssetVersions
  async (assetId) => {
    const result = await pool.query('SELECT * FROM asset_versions WHERE asset_id = $1', [assetId]);
    // ... mapping
  },
  // getAssetGroupById
  async (groupId) => {
    const result = await pool.query('SELECT * FROM asset_groups WHERE id = $1', [groupId]);
    // ... mapping
  },
);
```

---

## Task 6: BE — Iniettare asset nel prompt dentro generationActor

**File**: `apps/backend/src/lib/machines/generation-actor.ts`
**Complessità**: MEDIO

Il punto esatto: **prima** di chiamare `context.adapters.generate.generateText()`.

```ts
import { resolveAssetInjectedPrompt, createAssetInjectionLogger } from '../runtime/asset-injection-resolver';
import type { ResolvedAssetContent, InjectionDirectiveInput } from '../runtime/asset-injection-resolver';

export const generationActor = fromPromise(
  async ({ input }: { input: { context: GenerationMachineContext } }): Promise<GenerateDoneOutput> => {
    const { context } = input;

    // ═══════════════════════════════
    // Asset injection (NUOVO)
    // ═══════════════════════════════
    let resolvedPrompt = context.requestInput as Record<string, unknown>;
    
    if (context.assetReferences?.length > 0) {
      const adapter = context.adapters.assetSnapshotResolver;
      const resolvedAssets: ResolvedAssetContent[] = [];

      for (const ref of context.assetReferences) {
        const snapshot = await adapter.getAssetSnapshot(ref.assetId);
        if (snapshot) {
          resolvedAssets.push(snapshot);
        }
      }

      if (resolvedAssets.length > 0) {
        const directives: InjectionDirectiveInput[] = resolvedAssets.map(asset => ({
          assetId: asset.assetId,
          stepKey: (context as any).stepKey ?? '',
          injectionMode: 'prepend' as const,
          fieldMappingKey: `${asset.assetType}→${context.toolKey}`,
        }));

        const basePrompt = typeof resolvedPrompt.prompt === 'string' ? resolvedPrompt.prompt : '';
        const injectedPrompt = resolveAssetInjectedPrompt(
          basePrompt,
          resolvedAssets,
          directives,
          (context as any).stepKey ?? '',
        );

        resolvedPrompt = { ...resolvedPrompt, prompt: injectedPrompt };
      }
    }
    // ═══════════════════════════════

    const result = await context.adapters.generate.generateText({
      requestId: context.requestId,
      model: context.model,
      requestInput: resolvedPrompt,
    });
    // ...
  },
);
```

### Nota su `context.stepKey` e `context.toolKey`

Se `stepKey` e `toolKey` non sono campi diretti del `GenerationMachineContext`, sono probabilmente dentro `requestInput`:

```ts
const toolKey = context.toolKey ?? (context.requestInput as Record<string, unknown>).toolKey as string;
const stepKey = (context.requestInput as Record<string, unknown>).stepKey as string;
```

Questo va verificato nel codice reale e adattato.

---

## Task 7: Integration test

**Complessità**: MEDIO

```ts
test('selected assets are injected into generation prompt', async () => {
  const asset = await createTestAsset({ 
    assetType: 'competitor-analysis', 
    content: '{"title": "Test Angle"}' 
  });

  const machine = generationSystemMachine.provide({
    actors: {
      generateText: fromPromise(async ({ input }) => {
        // Cattura il prompt che sarebbe stato inviato all'LLM
        const reqInput = input.context.requestInput as Record<string, unknown>;
        const prompt = reqInput.prompt as string;
        expect(prompt).toContain('Test Angle');
        expect(prompt).toContain('## Angle:');
        return { content: 'mock output' };
      }),
    },
  });

  const actor = createActor(machine, {
    input: {
      adapters: mockAdapters,
      initialContext: {
        toolKey: 'angle-generator' as any,
        requestInput: { prompt: 'Original prompt', stepKey: 'context-and-angle-matrix' },
        assetReferences: [{ assetId: asset.id, usageIntent: 'injection' }],
      },
    },
  });
  actor.start();
  actor.send({ type: 'START_GENERATION' });
});
```

---

## Riepilogo task

| # | File | Complessità | XState relevancy |
|---|---|---|---|
| T1 | `ToolPageTemplate.tsx` | MEDIUM | — |
| T2 | `useToolPageRunController.ts` | ALTO | — |
| T3 | Stream handler | BASSO | `createActor(machine, { input: { initialContext: { assetReferences } } })` |
| T4 | `generation-system.context-types.ts` | BASSO | Aggiungere a `context` type |
| T5 | `generation.adapters.ts` | MEDIO | `GenerationAdapters.assetSnapshotResolver` |
| T6 | `generation-actor.ts` | MEDIO | `fromPromise` → iniettare prima di `generateText` |
| T7 | Integration test | MEDIO | Mock `generateText` actor via `machine.provide()` |

### Ordine

```
T1 ──→ T2 ──→ T7
T4 ──→ T5 ──→ T6 ──┘
T3 ──→ T5 ──┘
```

**Critical path**: T4 → T5 → T6 → T7 (2-3 giorni)
**Durata totale**: 3-4 giorni
