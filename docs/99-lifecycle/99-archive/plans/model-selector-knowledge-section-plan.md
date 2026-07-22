---
goal: Spostare `LlmModelSelector` dalla Configuration Section alla Knowledge Section per i tool asset-capable, e rimuovere il selettore per i tool non-asset-capable (modello hardcodato via `defaultModel`)
version: 1.2
date_created: 2026-07-19
last-reviewed: 2026-07-19
next-review-date: 2026-08-19
owner: Generation Team
status: completed
tags:
  - model-selector
  - knowledge-section
  - asset-domain
  - ui-composition
  - ddd-governance
  - llm-model
---

# Piano: Spostamento `LlmModelSelector` nella Knowledge Section e hardcoding per tool non-asset

## Obiettivo

Spostare il selettore del modello LLM (`LlmModelSelector`, DDD-057) dalla Configuration Section del form Tool Page alla Knowledge Section (`AssetKnowledgePanel`), per i tool che consumano Asset di workspace (tool asset-capable). Per i tool che non consumano Asset, il selettore viene rimosso e il modello è determinato esclusivamente da `defaultModel` nel `toolFormRegistry`.

## Razionale

- Il modello LLM è percepito dall'utente come un attributo del workspace/contesto, non come parametro effimero di generazione.
- Collocare `LlmModelSelector` nella Knowledge Section (accanto ai chip metrics) rafforza l'associazione mentale "modello + asset = contesto di generazione completo".
- Per i tool senza Asset compatibili (`geometric`, `brief-generator`, `tov-generator`, `blog-article-generator`), l'utente non ha workspace context da comporre — esporre il model selector aggiunge rumore senza valore.
- `blog-article-generator` è stato riclassificato come non-asset-capable (DDD-222): era l'unico tool asset-capable con model selector nascosto (eccezione architetturale). Ora è uniforme agli altri tool non-asset.

---

## 0. Prerequisiti DDD (COMPLETED 2026-07-19, revised 2026-07-19)

Tutti gli 8 prerequisiti DDD sono stati chiusi. Il gate DDD è ora aperto per l'implementazione del codice.

| Prereq | DDD ID | Contenuto | Status |
|---|---|---|---|
| **P1** | DDD-218 | Registrare `defaultModel` come Value Object canonico (Frontend/UI). | ✅ CLOSED |
| **P2** | DDD-219 | Definire la classificazione "asset-capable" vs "non-asset-capable" per i Tool. **Policy, not invariant**: asset-capable → `LlmModelSelector` visibile è default; un futuro flag `allowModelSelection` su `ToolFormConfig` può sovrascrivere per singoli tool. | ✅ CLOSED |
| **P3** | DDD-220 | Autorizzare il riposizionamento di `LlmModelSelector` dalla Configuration Section alla Knowledge Section per i tool asset-capable. | ✅ CLOSED |
| **P4** | DDD-221 | Autorizzare l'eccezione a DDD-046: per i tool non-asset-capable, la selezione del modello NON è user-controlled. | ✅ CLOSED |
| **P5** | DDD-222 | Riclassificare `blog-article-generator` come non-asset-capable (`consumes: []`). | ✅ CLOSED |
| **P6** | DDD-223 | `creative-brief` diventa AssetType dormante (zero consumer tools). | ✅ CLOSED |
| **P7** | DDD-224 | Rimuovere `brand-voice→blog-article-generator` da `ASSET_FIELD_MAPPINGS` (dead code). | ✅ CLOSED |
| **P8** | DDD-225 | Aggiornare DDD-219: `blog-article-generator` nella lista non-asset-capable. | ✅ CLOSED |

**Nota sulla policy**: la mappatura "asset-capable → `LlmModelSelector` visibile" è una policy di default, non un invariante architetturale (DDD-219). Tool futuri asset-capable potranno hardcodare il modello via un flag `allowModelSelection: false` su `ToolFormConfig` senza cambiare la classificazione.

### Documenti aggiornati (✅ completato 2026-07-19)

| Documento | Versione corrente | Nuova versione | Modifiche | Status |
|---|---|---|---|---|
| `domain-naming-decision-log.md` | 4.11 | 4.13 | Aggiunte righe DDD-218–DDD-225 (8 entry). | ✅ |
| `domain-ubiquitous-language-glossary.md` | 2.20 | 2.22 | Aggiunte entry `defaultModel`, `asset-capable tool`, `creative-brief` (dormant). | ✅ |
| `domain-bounded-context-map.md` | 3.11 | 3.13 | Aggiornata traduzione `LlmModelCatalog → LlmModelSelector` con repositioning + policy note (DDD-220). | ✅ |
| `frontend-ui-ubiquitous-language-spec.md` | 1.5 | 1.6 | §2: rimosso model selector da Configuration Section; aggiunta specifica Knowledge Section. | ✅ |
| `frontend-ui-ubiquitous-language-spec.md` | 1.5 | 1.6 | Revisionato §2: rimosso `LlmModelSelector` dalla Configuration Section; aggiunta specifica per `LlmModelSelector` nella Knowledge Section per tool asset-capable. | ✅ |

---

## 1. Analisi impatto FE

### Sistema di sincronizzazione stato

Il `<Controller name="model">` attuale fa **due cose**:
1. `field.onChange(e)` — aggiorna React Hook Form (`setValue`)
2. `setFormState((prev) => ({ ...prev, model: e.target.value }))` — aggiorna lo stato locale

Il nuovo `LlmModelSelector` nella Knowledge Section deve replicare **entrambe** le sincronizzazioni. Inoltre, la prop `onModelChange` deve avere accesso a `setValue` (da `useForm`) e a `setFormState` (da `useState`). L'`AssetKnowledgePanelWrapper` attuale NON ha accesso a `useForm()` — va rifattorizzato.

**Strategia**: il `LlmModelSelector` nella Knowledge Section riceve `modelValue` e `onModelChange` via props. `onModelChange` è definito nel `ToolPageTemplate` (dove `useForm` e `useState` sono disponibili) e passato attraverso `AssetKnowledgePanelWrapper` → `AssetKnowledgePanel`.

### Bootstrap di `formState.model` per tool non-asset

Per `geometric`, `brief-generator`, `tov-generator`, il `defaultModel` nel `toolFormRegistry` viene già usato come valore iniziale in `useToolForm.ts:21`:

```ts
model: config.defaultModel,  // 'openrouter/anthropic/claude-sonnet-4' per geometric
```

Quindi `formState.model` parte già popolato con il valore corretto. La validazione `modelRequired` (Zod schema, `copy/system.ts:223`) non scatterà perché il campo ha già un valore. **Verifica richiesta**: test esplicito che confermi che il form di geometric/brief-generator/tov-generator è valido al mount senza interazione utente sul modello.

### Rimozione di `defaultAppliedRef`

L'effetto `defaultAppliedRef` (ToolPageTemplate.tsx:558-568) auto-seleziona il modello catalog default quando la lista si popola. Va rimosso perché:
- Per i tool asset-capable: la logica equivalente si sposta nel Knowledge Panel (o nel wrapper)
- Per i tool non-asset: il `defaultModel` è già inizializzato in `useToolForm.ts`

### Verifica: `formState.model` non resta vuoto

**Scenario**: tool asset-capable, l'utente apre la pagina, il Knowledge Panel carica i model options. Se l'utente non interagisce col selettore modello, `formState.model` resta al valore inizializzato da `useToolForm.ts` (`config.defaultModel`, cioè `'openrouter/auto'`). Questo è il comportamento corretto — il default è già un valore valido.

---

## 2. Perimetro completo (file-by-file)

### 2.1 `AssetKnowledgePanel.tsx` — Nuove props

**File**: `apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx`

Aggiungere a `AssetKnowledgePanelProps` (attuale L15-22):

```ts
interface AssetKnowledgePanelProps {
  // ... existing props ...
  /** LlmModelId correntemente selezionato (dal form state) */
  modelValue?: string;
  /** Opzioni disponibili da LlmModelCatalog */
  modelOptions?: Array<{ key: string; label: string; isDefault: boolean }>;
  /** Callback quando l'utente cambia modello */
  onModelChange?: (model: string) => void;
  /** Se false, il model selector non viene renderizzato (tool non-asset-capable) */
  showModelSelector?: boolean;
}
```

Nell'header del pannello (dopo `__metrics`, L131-146), aggiungere condizionalmente:

```tsx
{showModelSelector && modelOptions && modelOptions.length > 0 && (
  <FormControl size="small" className="asset-knowledge-panel__model-selector">
    <InputLabel id="knowledge-model-label">Model</InputLabel>
    <Select
      labelId="knowledge-model-label"
      value={modelValue ?? ''}
      label="Model"
      onChange={(e) => onModelChange?.(e.target.value)}
    >
      {modelOptions.map((o) => (
        <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
)}
```

Alternativa (più compatta, senza label flottante): un `<TextField select size="small" />` con placeholder "Model".

### 2.2 `AssetKnowledgePanel.css` — Stili model selector inline

**File**: `apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css`

Aggiungere:

```css
.asset-knowledge-panel__model-selector {
  min-width: 200px;
}

/* Su mobile, il model selector va a capo */
@media (max-width: 768px) {
  .asset-knowledge-panel__model-selector {
    min-width: 100%;
  }
}
```

### 2.3 `ToolPageTemplate.tsx` — Rimozione da Configuration Section

**File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

**Azione 1** (L692-722): Rimuovere l'intero blocco `<Controller name="model">` incluso il condizionale `{isBlogArticleGeneratorTool ? null : (...)}`. La Configuration Section ora contiene solo la riga del form (che diventa `--single` o `--double` a seconda del tool, senza model dropdown).

**Azione 2** (L558-568): Rimuovere `defaultAppliedRef` e l'effetto `useEffect` associato.

**Azione 3** (L72-73): Rimuovere `isBlogArticleGeneratorTool` — non più necessario perché il condizionale sul model selector è scomparso. Mantenere solo le altre flag (`isMetaAdsTool`, `isYoutubeDescriptionTool`, `isGeometricTool`).

**Azione 4** (L73): Aggiungere flag `isAssetCapable`:
```ts
const isAssetCapable = useMemo(() => {
  try {
    const inputs = getToolAssetInputs(props.toolKey);
    return inputs.length > 0;
  } catch {
    return false;
  }
}, [props.toolKey]);
```

**Azione 5** (L1163, `AssetKnowledgePanelWrapper`): Passare nuove props per il model selector:

```tsx
<AssetKnowledgePanelWrapper
  toolKey={props.toolKey}
  onAssetSelect={setSelectedAssetIds}
  readinessScore={toolReadinessScore}
  // Nuove props:
  modelValue={formState.model}
  modelOptions={modelOptions}
  onModelChange={(newModel: string) => {
    setValue('model', newModel);                          // sync RHF
    setFormState((prev) => ({ ...prev, model: newModel })); // sync local state
  }}
/>
```

Il wrapper `AssetKnowledgePanelWrapper` (L1215-1249) va aggiornato per forwardare queste props a `AssetKnowledgePanel`, aggiungendo `showModelSelector={assetInputs.length > 0}`.

### 2.4 `tool-form-architecture.ts` — Hardcoding `defaultModel`

**File**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

Cambiare `defaultModel` per i tre tool non-asset-capable:

| Tool | `defaultModel` attuale | Nuovo `defaultModel` | Razionale |
|---|---|---|---|
| `geometric` (L207) | `'openrouter/auto'` | `'openrouter/anthropic/claude-sonnet-4'` | Analisi SERP, contesto lungo (128K+ token) |
| `brief-generator` (L231) | `'openrouter/auto'` | `'openrouter/openai/gpt-4o'` | Estrazione strutturata, output Markdown |
| `tov-generator` (L243) | `'openrouter/auto'` | `'openrouter/openai/gpt-4o'` | Analisi stilistica, output strutturato |

**Nota**: i valori specifici dei modelli vanno validati con il team prima del commit. Sono placeholder ragionevoli basati sulle caratteristiche dei tool.

**Rimozione flag speciale**: rimuovere `isBlogArticleGeneratorTool` dal `ToolPageTemplate` — il comportamento è ora uniforme: tutti i tool asset-capable mostrano `LlmModelSelector` nella Knowledge Section, tutti i tool non-asset-capable (incluso `blog-article-generator`, DDD-222) non lo mostrano.

### 2.5 `copy/system.ts` — Label model nella Knowledge Section

**File**: `apps/frontend/src/app/copy/system.ts`

Aggiungere chiave per la label del model selector nella Knowledge Section:

```ts
// In ui.workspace.assetPanel o in ui.toolPage.form
knowledgeModelLabel: 'Model',
```

Verificare se `modelLabel` (L198) è ancora referenziato dopo la rimozione del dropdown standalone — se è usato solo nel vecchio `<Controller>`, può essere rimosso.

### 2.6 Test file — Aggiornamenti

I seguenti file di test referenziano `model: 'openrouter/auto'` e vanno verificati:

| File | Tipo di modifica |
|---|---|
| `ToolPageTemplate.test.tsx` | Verificare che il test non cerchi più il dropdown Model nella Configuration Section; aggiungere test per il model selector nella Knowledge Section |
| `ToolPageTemplate.meta-ads-flow.e2e.test.tsx` | `model: 'openrouter/auto'` in mock formState — invariato |
| `ToolPageTemplate.meta-ads-objective.test.tsx` | idem |
| `ToolPageTemplate.geometric-direct-input.test.tsx` | Verificare che il model selector NON sia renderizzato per geometric |
| `ToolPageTemplate.youtube-description-direct-input.test.tsx` | Verificare che il model selector sia nella Knowledge Section |
| `useToolPage.test.ts` | `formState.model` mock — invariato |
| `tool-page-selectors.test.ts` | `formState.model` in fixtures — invariato |
| `AssetKnowledgePanel.test.tsx` | Nuovo: test per `showModelSelector`, `onModelChange` callback |

---

## 3. QA Scenarios

### QA-1: Tool asset-capable — Model selector nella Knowledge Section

**Tool**: `funnel-pages`  
**Steps**:
1. Aprire `/workspaces/{id}/tools/funnel-pages`
2. Verificare che la Configuration Section NON contenga il dropdown Model
3. Verificare che la Knowledge Section contenga il selettore modello nell'header (accanto ai chip metrics)
4. Il valore pre-selezionato è `openrouter/auto` (o il catalog default)
5. Cambiare modello a `openrouter/anthropic/claude-sonnet-4`
6. Submit → verificare nel payload di generazione che `model` sia `openrouter/anthropic/claude-sonnet-4`

### QA-2: Tool non-asset-capable — Nessun model selector

**Tool**: `geometric`  
**Steps**:
1. Aprire `/workspaces/{id}/tools/geometric`
2. Verificare che NON ci sia alcun dropdown Model nella pagina (né Configuration, né Knowledge — geometric non ha Knowledge Section)
3. Compilare i campi geometric (baseQuery, language, country) e submit
4. Verificare nel payload che `model` sia `openrouter/anthropic/claude-sonnet-4`

### QA-3: Tool non-asset-capable — Nessun model selector

**Tool**: `brief-generator`  
**Steps**:
1. Aprire `/workspaces/{id}/tools/brief-generator`
2. Verificare che NON ci sia alcun dropdown Model
3. Upload file + submit
4. Verificare nel payload che `model` sia `openrouter/openai/gpt-4o`

### QA-4: blog-article-generator — Nessun model selector (non-asset-capable, DDD-222)

**Tool**: `blog-article-generator`  
**Steps**:
1. Aprire `/workspaces/{id}/tools/blog-article-generator`
2. Verificare che NON ci sia alcun dropdown Model nella pagina (né Configuration, né Knowledge — blog-article-generator non ha Knowledge Section perché non-asset-capable)
3. Verificare che il form abbia solo il campo titolo (comportamento esistente, invariato)
4. Submit — verificare nel payload che `model` sia `openrouter/auto` (o il `defaultModel` configurato per blog-article-generator)

### QA-5: Sincronizzazione form state ↔ RHF

**Tool**: `meta-ads`  
**Steps**:
1. Selezionare modello X nel Knowledge Panel
2. Verificare che `formState.model` sia X (ispezionabile via React DevTools)
3. Verificare che il valore RHF `model` sia X
4. Submit → il payload di generazione usa X

---

## 4. Fasi di implementazione

### Fase 1 — DDD Governance (BLOCKING per codice)

1. Creare DDD-218 (`defaultModel` registration) nel Decision Log
2. Creare DDD-219 (classificazione asset-capable) nel Decision Log
3. Creare DDD-220 (riposizionamento `LlmModelSelector`) nel Decision Log
4. Creare DDD-221 (eccezione DDD-046 per tool non-asset) nel Decision Log
5. Aggiornare UL Glossary v2.20 → v2.21
6. Aggiornare UI UL Spec v1.5 → v1.6
7. Aggiornare BCM v3.11 → v3.12

### Fase 2 — Prop drilling + UI nel Knowledge Panel

1. `AssetKnowledgePanel.tsx`: aggiungere props `modelValue`, `modelOptions`, `onModelChange`, `showModelSelector`
2. `AssetKnowledgePanel.css`: aggiungere stili per model selector inline
3. `AssetKnowledgePanel.tsx`: renderizzare `<FormControl size="small">` nell'header
4. `ToolPageTemplate.tsx` (`AssetKnowledgePanelWrapper`): forwardare nuove props, derivare `showModelSelector` da `assetInputs.length > 0`
5. `copy/system.ts`: aggiungere label `knowledgeModelLabel`

### Fase 3 — Rimozione dal Template

1. `ToolPageTemplate.tsx`: rimuovere `<Controller name="model">` dalla Configuration Section (L692-722)
2. `ToolPageTemplate.tsx`: rimuovere `defaultAppliedRef` e relativo effetto (L558-568)
3. `ToolPageTemplate.tsx`: rimuovere `isBlogArticleGeneratorTool` flag
4. `ToolPageTemplate.tsx`: aggiungere `isAssetCapable` derivato via `getToolAssetInputs`
5. `ToolPageTemplate.tsx`: passare `modelValue`, `modelOptions`, `onModelChange` a `AssetKnowledgePanelWrapper`

### Fase 4 — Hardcoding per tool non-asset

1. `tool-form-architecture.ts`: aggiornare `defaultModel` per `geometric`, `brief-generator`, `tov-generator`
2. Verificare che `useToolForm.ts` inizializzi `model: config.defaultModel` per questi tool
3. Verificare che `normalizeModelForPayload` usi il valore corretto come fallback

### Fase 5 — Test

1. Aggiornare test `ToolPageTemplate.*.test.tsx` (5 file)
2. Aggiornare test `useToolPage.test.ts`
3. Aggiornare test `tool-page-selectors.test.ts`
4. Aggiungere test per `AssetKnowledgePanel` con model selector
5. Eseguire QA scenarios QA-1 → QA-5 manualmente

### Fase 6 — Validazione

1. `npm run typecheck` — pulito su tutti i workspace
2. `npm run test` — tutti i test passano
3. `npm run build` — frontend build pulito
4. Verifica funzionale su tutti gli 11 tool con QA scenarios

---

## 5. Cosa NON cambia

- **`model` in `ToolFormState`** — il campo rimane, viene popolato da `defaultModel` o dal selettore nella Knowledge Section.
- **`GenerationRequest.model`** — il payload di generazione continua a includere il modello.
- **`normalizeModelForPayload`** — invariato, continua a fare fallback.
- **`useModelsQuery`** / **`models-client.ts`** — invariati, il catalogo modelli è ancora fetchato.
- **`LlmModelCatalog`** (DDD-055) — invariato, il backend continua a servire il catalogo.
- **Asset injection pipeline** — invariata.

---

## 6. Rischi e mitigazioni

| # | Rischio | Severità | Mitigazione |
|---|---|---|---|
| 1 | `formState.model` non sincronizzato con RHF dopo la rimozione del `<Controller>` | 🔴 HIGH | `onModelChange` nel wrapper chiama esplicitamente `setValue('model', ...)` E `setFormState(...)`. Test QA-5 verifica. |
| 2 | `AssetKnowledgePanelWrapper` non ha accesso a `useForm()` → impossibile forwardare `setValue` | 🔴 HIGH | Il wrapper è già dentro il componente `ToolPageTemplate` che ha `useForm()`. Le nuove props (`modelValue`, `onModelChange`) sono passate dal componente parent, non calcolate dentro il wrapper. |
| 3 | `modelRequired` Zod validation blocca submit per tool non-asset | 🟡 MEDIUM | `useToolForm.ts` inizializza `model: config.defaultModel` — il campo non è mai vuoto. Test esplicito di verifica. |
| 4 | Snapshot test rotti per rimozione markup dropdown Model | 🟡 MEDIUM | Aggiornare snapshot; i mock di `formState.model` restano validi. |
| 5 | `defaultAppliedRef` rimosso ma il catalog default non viene selezionato nel Knowledge Panel | 🟡 MEDIUM | Aggiungere logica nel wrapper: se `modelValue` è vuoto e `modelOptions` ha un `isDefault`, auto-selezionarlo al mount. |
| 6 | Layout header Knowledge Panel diventa troppo stretto con model selector | 🟢 LOW | CSS `min-width: 200px` + flex-wrap sui chip metrics. Il media query mobile già esiste. |

---

## 7. Momus Review Notes (2026-07-19)

**Verdetto iniziale: [NEEDS WORK]** — Tre gap colmati in questa versione del piano:

### Gap 1: Sincronizzazione `onModelChange` ✅ RISOLTO

**Problema**: il piano iniziale non specificava come `onModelChange` sincronizzasse sia RHF (`setValue`) che `formState` (`setFormState`).

**Risoluzione**: Sezione 2.3 Azione 5 specifica esplicitamente:

```ts
onModelChange={(newModel: string) => {
  setValue('model', newModel);                          // sync RHF
  setFormState((prev) => ({ ...prev, model: newModel })); // sync local state
}}
```

Il wrapper `AssetKnowledgePanelWrapper` è dentro `ToolPageTemplate` e riceve `onModelChange` come prop — ha accesso a entrambi i setter.

### Gap 2: Validazione `modelRequired` per tool non-asset ✅ RISOLTO

**Problema**: il piano iniziale non affrontava il rischio che `formState.model` fosse vuoto per i tool non-asset, triggerando la validazione Zod.

**Risoluzione**: Sezione 1 "Bootstrap di formState.model" chiarisce che `useToolForm.ts:21` inizializza già `model: config.defaultModel`. Per i tre tool non-asset, `defaultModel` sarà aggiornato nella Fase 4, quindi `formState.model` partirà col valore corretto. La validazione Zod non scatterà mai.

### Gap 3: QA Scenarios assenti ✅ RISOLTO

**Risoluzione**: Sezione 3 con 5 QA scenarios eseguibili, ciascuno con tool concreto, passi, risultato atteso.

---

## 8. DDD Governance Gatekeeper Notes (2026-07-19)

**Verdetto finale: [GATE RESOLVED]** — Tutti e quattro i blocchi sono stati risolti nella Fase 1 (DDD Governance), eseguita il 2026-07-19.

### BLOCK #1: Terminologia non canonica ✅ RISOLTO

Tutti i riferimenti nel piano usano ora la terminologia canonica:
- "model selector" → `LlmModelSelector` (DDD-057)
- "Knowledge Panel" → "Knowledge Section" (UI UL spec §2); `AssetKnowledgePanel` solo in riferimenti al codice
- "Workspace Knowledge" → "compatible project Assets"

### BLOCK #2: `defaultModel` non registrato ✅ RISOLTO

Il prerequisito P1 (DDD-218) ha registrato `defaultModel` come Value Object canonico. Il termine è ora presente nella Glossary (v2.21) e nel Decision Log.

### BLOCK #3: UI UL spec violation ✅ RISOLTO

Il prerequisito P3 (DDD-220) ha autorizzato il riposizionamento. La UI UL spec è stata revisionata (v1.6): `LlmModelSelector` è stato rimosso dalla Configuration Section e aggiunto alla Knowledge Section per i tool asset-capable.

### BLOCK #4: DDD-046 contraddizione ✅ RISOLTO

Il prerequisito P4 (DDD-221) ha autorizzato esplicitamente l'eccezione per i tool non-asset-capable, con razionale documentato nel Decision Log. DDD-046 rimane in vigore per tutti i tool asset-capable.

---

## 9. DDD Governance Status (2026-07-19)

I gate DDD sono stati chiusi il 2026-07-19 (prima ondata: P1-P4) e rivisti 2026-07-19 (seconda ondata: P5-P8 per riclassificazione blog-article-generator):

| Gate | DDD ID | Decision Log Entry | Glossary Entry | UI UL Spec Update | Status |
|---|---|---|---|---|---|
| P1 | DDD-218 | `defaultModel` registration | `defaultModel` (VO, Frontend/UI) | N/A | ✅ CLOSED |
| P2 | DDD-219 | asset-capable classification (policy, not invariant) | asset-capable tool (classification) | N/A | ✅ CLOSED |
| P3 | DDD-220 | `LlmModelSelector` repositioning | N/A | §2 Configuration/Knowledge Section revised (v1.6) | ✅ CLOSED |
| P4 | DDD-221 | DDD-046 exception per non-asset-capable | N/A | N/A | ✅ CLOSED |
| P5 | DDD-222 | blog-article-generator → non-asset-capable | N/A | N/A | ✅ CLOSED |
| P6 | DDD-223 | creative-brief → dormant AssetType | creative-brief (dormant) | N/A | ✅ CLOSED |
| P7 | DDD-224 | Rimozione ASSET_FIELD_MAPPINGS dead entry | N/A | N/A | ✅ CLOSED |
| P8 | DDD-225 | Aggiornamento DDD-219 lista non-asset | N/A | N/A | ✅ CLOSED |

Documenti canonici aggiornati:
- `domain-naming-decision-log.md`: v4.11 → v4.13 (entry DDD-218–DDD-225)
- `domain-ubiquitous-language-glossary.md`: v2.20 → v2.22 (`defaultModel`, asset-capable tool, creative-brief dormant)
- `domain-bounded-context-map.md`: v3.11 → v3.13 (`LlmModelCatalog → LlmModelSelector` translation rule con repositioning + policy note)
- `frontend-ui-ubiquitous-language-spec.md`: v1.5 → v1.6 (§2 Configuration Section, Knowledge Section)

Il piano entra ora in Fase 2 (Prop drilling + UI nel Knowledge Panel).

---

## 10. Ordine di esecuzione raccomandato

```
Fase 1 (DDD Governance) ─── ✅ COMPLETED 2026-07-19
     │
     ├── P1-P4: DDD-218–DDD-221 ✅
     ├── P5-P8: DDD-222–DDD-225 ✅
     ├── Glossary v2.20 → v2.22 ✅
     ├── UI UL Spec v1.5 → v1.6 ✅
     └── BCM v3.11 → v3.13 ✅
          │
          ▼
Fase 2 (Prop drilling + UI Knowledge Panel) ← PROSSIMA FASE
    │
    ├── AssetKnowledgePanel.tsx: nuove props
    ├── AssetKnowledgePanel.css: stili inline
    ├── AssetKnowledgePanel.tsx: FormControl nell'header
    ├── ToolPageTemplate.tsx (wrapper): forwardare props
    └── copy/system.ts: label
         │
         ▼
Fase 3 (Rimozione dal Template)
    │
    ├── Rimuovere <Controller name="model">
    ├── Rimuovere defaultAppliedRef
    ├── Rimuovere isBlogArticleGeneratorTool
    └── Aggiungere isAssetCapable
         │
         ▼
Fase 4 (Hardcoding defaultModel)
    │
    ├── geometric → claude-sonnet-4
    ├── brief-generator → gpt-4o
    └── tov-generator → gpt-4o
         │
         ▼
Fase 5 (Test)
    │
    ├── Aggiornare 5 file ToolPageTemplate.*.test.tsx
    ├── useToolPage.test.ts
    ├── tool-page-selectors.test.ts
    └── AssetKnowledgePanel.test.tsx (nuovo)
         │
         ▼
Fase 6 (Validazione)
    │
    ├── npm run typecheck
    ├── npm run test
    ├── npm run build
    └── QA scenarios QA-1 → QA-5
```
