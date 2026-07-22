---
goal: Implement personas-generator tool — primitive tool that transforms raw uploaded files into structured buyer personas (persona Assets)
version: 1.1
date_created: 2026-07-19
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: Platform
status: completed
tags: [plan, tool-workspace, backend, frontend, personas, persona, extraction, primitive]
---

# Personas Generator Implementation Plan

## 0. Tool Classification

| Property | Value |
|---|---|
| **ToolKey** | `personas-generator` |
| **WorkflowType** | `personas_generator` |
| **Display Label** | "Personas Generator" |
| **Archetype** | Primitive: file upload → extraction → single-step generation → asset promotion |
| **CreditCost** | 1 |
| **AvailabilityPolicy** | `enabled-for-all` |
| **Accepted Formats** | `.txt`, `.md`, `.docx` |
| **Prompt Language** | English |
| **LLM Output Language** | Italian (`it-IT`) |

### Asset Contract

```ts
'personas-generator': {
  produces: ['persona'],   // structured buyer persona → consumable by other tools (asset promotion)
  consumes: [],            // zero workspace assets required
}
```

### User Flow

```
User uploads file (.txt/.md/.docx)
  → Extraction: 5 core fields (zero friction: "non disponibile" for missing data)
    → personas-generation step: LLM synthesizes full buyer persona from 5 fields + raw document text
      → Output: structured Markdown persona document (Italian)
        → Promotable to workspace 'persona' asset
```

### Why Primitive (Not Workspace-Knowledge)

- `personas-generator` is the **entry point** for creating structured buyer personas from raw content
- Requiring a pre-existing `persona` asset would be circular
- File upload is visible in tool page (`consumes: []` → `briefing-file` not filtered by `visibleInputFiles`)
- Follows same pattern as `brief-generator` (DDD-210) and `tov-generator` (DDD-212)

### Foundation Tool Auto-Derivation

No explicit foundation registration needed. `useWorkspaceContext.ts:144-147` auto-derives foundation tools: any tool in `TOOL_ASSET_CONTRACTS` with `consumes: []` and not in `EXCLUDED_FOUNDATION_TOOLS` is a foundation tool. Adding the `TOOL_ASSET_CONTRACTS` entry in A-003 is sufficient.

### Why `personas` (Plural) as ToolKey

- The tool generates one or more **buyer personas** from raw input — the plural form reflects the tool's capability scope
- The produced `AssetType` is `persona` (singular, already canonical in `ASSET_TYPES` since DDD inception)
- This singular/plural distinction mirrors how `brief-generator` produces `brief` assets and `tov-generator` produces `brand-voice` assets
- `persona` is already referenced in downstream `TOOL_ASSET_CONTRACTS` (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `meta-ads`, `blog-article-generator` all consume `persona`) — this tool closes the production gap

---

## 1. Track A — Contracts & Canonical Identity

### A-001: `packages/contracts/src/tool-workflows.ts`

**1. `TOOL_WORKFLOW_DEFINITIONS` entry:**

```ts
'personas-generator': {
  toolKey: 'personas-generator',
  workflowType: 'personas_generator',
  creditCost: 1,
  steps: [
    { key: 'personas-generation', dependencies: [], feedbackEnabled: true },
  ],
},
```

**2. `TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY` entry:**

```ts
'personas-generator': 'enabled-for-all',
```

**3. `normalizeToolKeyCandidate` aliases:**

```ts
if (normalized === 'personas_generator' || normalized === 'personasgenerator') {
  return 'personas-generator';
}
```

### A-002: `packages/contracts/src/extraction-fields.ts`

**New extraction field keys must be added to `EXTRACTION_FIELD_KEYS`** (3 new entries):

```ts
// Add to EXTRACTION_FIELD_KEYS array:
'demographics',
'goals',
'behaviors',
```

**Extraction fields (5 — essential set, zero friction):**

| Field | Status | Purpose |
|---|---|---|
| `demographics` | NEW | Age, gender, income, education, location |
| `goals` | NEW | What the persona wants to achieve, desired outcomes |
| `pain_point` | EXISTS | Pain points, frustrations, unmet needs |
| `behaviors` | NEW | Buying habits, media consumption, decision patterns |
| `objections` | EXISTS | Common objections and barriers to purchase |

```ts
'personas-generator': [
  'demographics',
  'goals',
  'pain_point',
  'behaviors',
  'objections',
],
```

```ts
'personas-generator': [],  // ReadinessRequiredExtractionFieldKeysByTool
```

```ts
'personas-generator': {},  // LegacyExtractionFieldAliasByTool
```

### A-003: `packages/contracts/src/asset.ts`

```ts
'personas-generator': {
  produces: ['persona'],   // persona AssetType already exists in ASSET_TYPES (line 40)
  consumes: [],
},
```

### Auto-Derived (No Manual Changes Needed)

- `ToolKey` type union (includes `'personas-generator'`)
- `TOOL_STEP_ORDER['personas-generator']` → `['personas-generation']`
- `TOOL_STEP_DEPENDENCIES['personas-generator']` → `{ 'personas-generation': [] }`
- `TOOL_KEY_BY_WORKFLOW_TYPE['personas_generator']` → `'personas-generator'`
- `resolveToolWorkflowType('personas-generator')` → `'personas_generator'`
- `SupportedTool` type (re-exported for frontend)

### Acceptance

- [ ] A-AC-001: `resolveToolWorkflowType('personas-generator')` returns `'personas_generator'`
- [ ] A-AC-002: `getToolLabel('personas-generator')` and `getToolRoute('personas-generator')` resolve canonical values

---

## 2. Track B — Backend Runtime

### B-001: `apps/backend/src/lib/runtime/workflow-normalizers.ts`

**`FINAL_STEP_BY_TOOL` entry:**

```ts
'personas-generator': 'personas-generation',
```

**`isStepMappedToolKey` guard — add to chain:**

```ts
|| value === 'personas-generator'
```

### B-002: `apps/backend/src/lib/runtime/tool-prompts/index.ts`

**Two entries in `PROMPT_FILE_BY_KEY`:**

```ts
'personas-generator:extraction':
  'src/lib/runtime/tool-prompts/personas-generator/prompt_extraction.md',
'personas-generator:personas-generation':
  'src/lib/runtime/tool-prompts/personas-generator/prompt_personas_generation.md',
```

**Branch in `resolvePromptFilePath` extraction block:**

```ts
if (extractionToolKey === 'personas-generator') {
  return PROMPT_FILE_BY_KEY['personas-generator:extraction'];
}
```

### B-003: Extraction Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_extraction.md`

```markdown
# PROMPT PERSONAS GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the uploaded document and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- demographics: Age, gender, income, education, location, and socio-economic context
- goals: What the persona wants to achieve, desired outcomes, aspirations
- pain_point: Pain points, frustrations, unmet needs, and daily struggles
- behaviors: Buying habits, media consumption, decision patterns, preferred channels
- objections: Common objections and barriers that prevent purchase or conversion

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
```

### B-004: Generation Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_personas_generation.md`

```markdown
# PROMPT PERSONAS GENERATOR - PERSONAS GENERATION

## Step Key
- personas-generation

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Objective
From the 5-field extraction payload, synthesize a complete and actionable
buyer persona document. The persona must serve as authoritative input for
downstream tools that consume `persona` assets: funnel-pages, nextland,
youtube-lf-script, angle-generator, meta-ads, blog-article-generator.

Infer and expand from context where extraction data is sparse. If a section
cannot be constructed, write "Non specificato nel documento di input."

## Input
Extraction Payload with 5 core fields (see below).

## Output rules
- Markdown only.
- Italian only (`it-IT`).
- No JSON. No invented claims.
- Every section must be present.

## Required output structure

## Nome Persona
- Nome Rappresentativo:
- Età:
- Occupazione/Ruolo:

## Dati Demografici
- Età:
- Genere:
- Reddito/Fascia Economica:
- Livello di Istruzione:
- Localizzazione Geografica:
- Situazione Familiare:

## Obiettivi e Motivazioni
- Obiettivo Primario:
- Obiettivi Secondari:
- Motivazioni Profonde:
- Cosa Vuole Evitare:

## Pain Point e Frustrazioni
- Problema Principale:
- Frustrazioni Quotidiane:
- Tentativi Falliti (soluzioni già provate):
- Costo Emotivo del Problema:

## Comportamenti e Abitudini
- Canali di Informazione Preferiti:
- Abitudini di Acquisto:
- Processo Decisionale:
- Dispositivi e Piattaforme Utilizzati:
- Momento della Giornata Attivo:

## Obiezioni e Barriere
- Obiezione Principale all'Acquisto:
- Obiezioni Secondarie:
- Fattori di Fiducia Necessari:
- Cosa Deve Vedere per Convertire:

## Messaggistica Efficace
- Tono di Voce Consigliato:
- Parole/Frasi che Risuonano:
- Parole/Frasi da Evitare:
- Tipi di Prova che Funzionano:

## Trigger di Acquisto
- Trigger Primario:
- Trigger Secondari:
- Stagionalità/Timing:
- Urgenza Percepita:

## Nota sull'Input
- Qualità dei Dati di Partenza:
- Aree con Dati Insufficienti:
- Assunzioni Fatte dal Modello:
```

### Prompt Template Variable Notes

No `{{placeholders}}` needed in generation prompt — the extraction payload is automatically appended as `## Extraction Payload` by `buildContextBlock` in `openrouter.adapter.ts`. The LLM reads this context block natively. No `assemble*Prompt` XState action required.

The extraction payload flows through the standard request pipeline:
1. Extraction step produces `extractionPayload` (stored in frontend state)
2. `startGenerationStep` sends request with `extractionPayload` + `briefingText`
3. `buildContextBlock` appends both as `## Extraction Payload` and `## Briefing Source`
4. Generation prompt + context block sent to LLM

### Acceptance

- [ ] B-AC-001: Backend orchestrate endpoint returns correct `dependencyArtifactIdsByStep` for `'personas-generator'`
- [ ] B-AC-002: Backend rejects unsupported tool identifiers with explicit validation error
- [ ] B-AC-003: Existing tools pass the focused backend regression suite
- [ ] B-AC-004: Extraction prompt resolves for `extractionToolKey === 'personas-generator'`

---

## 3. Track C — Frontend Tool Workspace

### C-001: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

**6 registries:**

**`toolFormRegistry`:**

```ts
'personas-generator': {
  toolKey: 'personas-generator',
  availabilityPolicy: getToolAvailabilityPolicy('personas-generator'),
  displayName: 'Personas Generator',
  defaultPrompt: 'Genera una buyer persona strutturata a partire dai dati estratti dal documento.',
  defaultModel: 'openrouter/auto',
  steps: TOOL_STEP_ORDER['personas-generator'],
  stepDependencies: TOOL_STEP_DEPENDENCIES['personas-generator'],
  defaults: {
    registrySnapshotRef: 'snapshot:default',
  },
},
```

**`toolFileInstructionsRegistry`:**

```ts
'personas-generator': {
  title: appCopy.ui.toolInstructions.title,
  summary: 'Carica un documento con dati di mercato, descrizioni del target o ricerche sui clienti. Personas Generator estrae i dati rilevanti e produce una buyer persona strutturata.',
  inputFiles: [
    {
      key: 'briefing-file',
      label: 'BriefingFile',
      accept: '.txt,.md,.docx',
      requiredness: 'always-required',
    },
  ],
  requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
  requiredFieldKeys: ['demographics', 'goals', 'pain_point', 'behaviors', 'objections'],
  optionalFields: [],
  examples: [
    'Report di ricerche di mercato con dati su target e comportamenti d\'acquisto.',
    'Trascrizione di interviste ai clienti con pain point e obiezioni.',
    'Documento di posizionamento con descrizione della buyer persona ideale.',
  ],
  notes: [
    'La persona in output è compatibile con funnel-pages, nextland, youtube-lf-script, angle-generator, meta-ads e blog-article-generator.',
    'Se un campo non è disponibile nel file, l\'estrazione lo segna come "non disponibile" e la persona lo esplicita.',
  ],
  stepConstraints: [],
},
```

**`toolNavigationLabelByKey`:**

```ts
'personas-generator': 'Personas Generator',
```

**`toolNavigationDescriptionByKey`:**

```ts
'personas-generator': 'Genera buyer personas strutturate a partire da documenti e ricerche di mercato.',
```

**`toolRouteByKey`:**

```ts
'personas-generator': '/tools/personas-generator',
```

**`stepCardConfigRegistry`:**

```ts
'personas-generator': {
  'personas-generation': {
    displayName: 'Personas Generation',
    description: 'Trasforma i dati estratti in una buyer persona strutturata e completa pronta per il consumo da parte degli altri tool.',
    expectedOutputFormat: 'Markdown strutturato con demografia, obiettivi, pain point, comportamenti, obiezioni, messaggistica e trigger',
  },
},
```

### C-002: `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts`

```ts
'personas-generator': {
  'personas-generation': { visible: true, includeInDownload: true },
},
```

### C-003: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`

Add to `isSupportedTool()`:

```ts
|| value === 'personas-generator'
```

### C-004: `apps/frontend/src/features/tools/personas-generator/pages/PersonasGeneratorToolPage.tsx` (NEW)

Create directory `apps/frontend/src/features/tools/personas-generator/pages/` and the page component:

```ts
import { createToolPage } from '../../ui/createToolPage';

export const PersonasGeneratorToolPage = createToolPage('personas-generator');
```

### C-005: `apps/frontend/src/app/routing/app-router.tsx`

**1. Add lazy import:**

```ts
const PersonasGeneratorToolPage = lazy(() => import('../../features/tools/personas-generator/pages/PersonasGeneratorToolPage').then(m => ({ default: m.PersonasGeneratorToolPage })));
```

**2. Add entry in `toolPageComponents`:**

```ts
'personas-generator': PersonasGeneratorToolPage,
```

### C-006: `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.tsx`

**`FOUNDATION_TOOL_LABELS`:**

```ts
'personas-generator': 'Personas',
```

**`FOUNDATION_TOOL_ICONS`:**

```ts
'personas-generator': <Users size={16} />,  // lucide-react Users icon
```

Add `Users` to the lucide-react import at the top of the file.

### C-007: `apps/frontend/src/features/workspace/ui/dashboard/WorkspaceOverviewCard.tsx`

**`FOUNDATION_TOOL_LABELS`:**

```ts
'personas-generator': 'Personas',
```

**`FOUNDATION_TOOL_ICONS`:**

```ts
'personas-generator': <Users size={16} />,
```

**`FOUNDATION_TOOL_TOOLTIPS`:**

```ts
'personas-generator': appCopy.ui.workspace.dashboard.foundationTooltipPersonas,
```

Add a new copy key `foundationTooltipPersonas` in `apps/frontend/src/app/copy/system.ts`.

Add `Users` to the lucide-react import at the top of the file.

### C-008: `apps/frontend/src/features/workspace/ui/dashboard/ContextualToolsPanel.tsx`

```ts
const FOUNDATION_TOOL_KEYS = new Set<string>(['brief-generator', 'tov-generator', 'personas-generator']);
```

### C-009: `apps/frontend/src/features/workspace/ui/WorkspaceHubCard.tsx`

**`FOUNDATION_TOOL_LABELS`:**

```ts
'personas-generator': 'Personas',
```

**`FOUNDATION_TOOL_ICONS`:**

```ts
'personas-generator': <Users size={16} />,
```

Add `Users` to the lucide-react import at the top of the file.

### C-010: No changes to `tool-page-selectors.ts` or `useToolPageRunController.ts`

The tool follows the standard file-upload flow. Extraction and generation are handled by existing infrastructure (`frontendStreamMachine`, `toolPageMachine`, `generationSystemMachine`).

### Acceptance

- [ ] C-AC-001: Tool route resolves to `/tools/personas-generator`
- [ ] C-AC-002: Primary generation action dispatches with correct step, toolKey, workflowType
- [ ] C-AC-003: Session summary shows "Personas Generator" as display label
- [ ] C-AC-004: `TOOL_STEP_DISPLAY_CONFIG` test passes
- [ ] C-AC-005: `tool-form-architecture.test.ts` filters enabled tools correctly
- [ ] C-AC-006: Foundation tool panels render Personas Generator with correct label and icon

---

## 4. Track D — Test Cases

| # | Test File | What to Cover |
|---|-----------|---------------|
| D-001 | `apps/backend/src/lib/tests/runtime.tool-prompts-parametrized.test.ts` | Add `personas-generator` to `TOOL_PROMPT_CONFIGS` with extraction fields, prompt resolution; add to `WORKFLOW_REGISTRY_CONFIGS` with step keys, dependencies, sample artifacts |
| D-002 | `apps/backend/src/lib/tests/runtime.workflow-normalizers.test.ts` | `resolveToolStepArtifactRole('personas-generator', 'personas-generation')` returns `'final'` |
| D-003 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.test.ts` | Add `'personas-generator'` to canonical tools list expectation |
| D-004 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts` | Verify `getEnabledToolKeys` includes `'personas-generator'` |
| D-005 | `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.test.tsx` | Add `personas-generator` mock data entries for foundation tool test cases |

### D-001: Parametrized Test Entries (New)

**Add to `TOOL_PROMPT_CONFIGS`:**

```ts
{
  toolKey: 'personas-generator',
  workflowType: 'personas_generator',
  extractionFields: ['demographics', 'goals', 'pain_point', 'behaviors', 'objections'],
  prompts: [{
    stepKey: 'personas-generation',
    filePathPattern: /prompt_personas_generation\.md$/,
    contentPatterns: [/PERSONAS GENERATION/i, /Italian only/i],
  }],
},
```

**Add to `WORKFLOW_REGISTRY_CONFIGS`:**

```ts
{
  toolKey: 'personas-generator',
  workflowType: 'personas_generator',
  stepKeys: ['personas-generation'],
  dependencies: { 'personas-generation': [] },
  sampleArtifacts: [{ artifactId: 'artifact-personas-001', stepKey: 'personas-generation' }],
},
```

**Update the union type for `WORKFLOW_REGISTRY_CONFIGS` toolKey:**

```ts
toolKey: 'brief-generator' | 'tov-generator' | 'blog-article-generator' | 'personas-generator';
```

### D-002: Workflow Normalizer Test

Add to `resolveToolStepArtifactRole` test:

```ts
assert.equal(resolveToolStepArtifactRole('personas-generator', 'personas-generation'), 'final');
```

### D-003: Step Display Config Test

Add `'personas-generator'` to the alphabetically-sorted tools array in the test.

### D-004: Form Architecture Test

Update or verify that `getEnabledToolKeys('member')` includes `'personas-generator'`.

### D-005: Foundation Tools Panel Test

Add `personas-generator` mock data to test cases. Add mock entry in `toolFormRegistry` mock:

```ts
'personas-generator': { displayName: 'Personas Generator', defaultPrompt: 'Genera una buyer persona strutturata.' },
```

### Acceptance

- [ ] D-AC-001: All new test entries pass
- [ ] D-AC-002: No regressions in existing suites
- [ ] D-AC-003: At least one non-regression pair verifies an existing tool is unchanged

---

## 5. Track E — XState Runtime

**No changes to XState machines.** The tool follows the standard file-upload runtime flow:

1. `frontendStreamMachine` → extraction with `extractionToolKey: 'personas-generator'`
2. `toolPageMachine` → `canStartExtraction` active when file present
3. `toolPageMachine` → `canStartGeneration` active after extraction completes
4. `generationSystemMachine` → standard `generating`/`streaming` path

No new states, events, or transitions required.

### Acceptance

- [ ] E-AC-001: Extraction flow completes without blocking
- [ ] E-AC-002: Generation flow produces persona artifact with `status: completed`

---

## 6. Risks and Controls

| Risk | Control |
|------|---------|
| **Sparse extraction → incomplete persona** | LLM synthesizes missing sections from context; prompt explicitly says "infer and expand from context" |
| **File upload visibility conflict with workspace-asset migration** | `consumes: []` correctly shows `briefing-file` widget; file upload is still supported for primitive tools |
| **Extraction prompt mismatch** | `resolvePromptFilePath` branch ensures `extractionToolKey === 'personas-generator'` resolves correctly |
| **`isSupportedTool()` not updated** | C-003 adds to hardcoded union; tests will catch if missing |
| **`FINAL_STEP_BY_TOOL` not updated** | B-001 adds to both map and guard; tests will catch if missing |
| **`persona` AssetType already consumed downstream** | Downstream tools (`funnel-pages`, `meta-ads`, etc.) already declare `persona` as a consumed AssetType — this tool fills the production gap; no downstream changes needed |
| **New extraction field keys breaking existing tools** | `demographics`, `goals`, `behaviors` are additive-only to `EXTRACTION_FIELD_KEYS`; no existing tool references them; extraction-field-matrix.ts auto-derives labels |
| **DDD governance: no DDD entry for tool** | A new DDD entry must be created for `personas-generator` before PR — follow DDD-210 (brief-generator) and DDD-212 (tov-generator) patterns |

---

## 7. Validation Gates

| Step | Command | Purpose |
|------|---------|---------|
| GATE-001 | `npm run typecheck` | Global type safety |
| GATE-002 | `npm --workspace apps/backend run test` | Backend regression |
| GATE-003 | `npm --workspace apps/frontend run test` | Frontend regression |
| GATE-004 | `npm run build` | Publication readiness |

---

## 8. Implementation Order Summary

```
A-001 (contracts: tool-workflows.ts)
  └─> All types auto-derive
A-002 (extraction-fields.ts — includes 3 new field keys)
A-003 (asset.ts)

B-001 (workflow-normalizers.ts)
B-002 (tool-prompts/index.ts)
B-003..B-004 (prompt files)

C-001 (tool-form-architecture.ts — 6 registries)
C-002 (tool-step-display-config.ts)
C-003 (SessionArtifactTabs.tsx — isSupportedTool)
C-004..C-005 (PersonasGeneratorToolPage.tsx + app-router.tsx)
C-006..C-009 (Foundation tool panels — 4 files)

D-001..D-005 (tests)

GATE-001..GATE-004 (validation)

DDD Entry: Create DDD-NNN decision entry for personas-generator tool identity
```

---

## 9. File Summary

| # | File | Action |
|---|------|--------|
| 1 | `packages/contracts/src/tool-workflows.ts` | Edit — add definition + availability + alias |
| 2 | `packages/contracts/src/extraction-fields.ts` | Edit — add 3 field keys to `EXTRACTION_FIELD_KEYS` + 3 entries for personas-generator |
| 3 | `packages/contracts/src/asset.ts` | Edit — add TOOL_ASSET_CONTRACTS entry |
| 4 | `apps/backend/src/lib/runtime/workflow-normalizers.ts` | Edit — add to FINAL_STEP_BY_TOOL + guard |
| 5 | `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_extraction.md` | Create — extraction prompt |
| 6 | `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_personas_generation.md` | Create — generation prompt |
| 7 | `apps/backend/src/lib/runtime/tool-prompts/index.ts` | Edit — add 2 entries + branch |
| 8 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Edit — add 6 registries |
| 9 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` | Edit — add entry |
| 10 | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | Edit — add to isSupportedTool |
| 11 | `apps/frontend/src/features/tools/personas-generator/pages/PersonasGeneratorToolPage.tsx` | Create — 3-line factory wrapper |
| 12 | `apps/frontend/src/app/routing/app-router.tsx` | Edit — add lazy import + toolPageComponents entry |
| 13 | `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.tsx` | Edit — add FOUNDATION_TOOL_LABELS + FOUNDATION_TOOL_ICONS entries |
| 14 | `apps/frontend/src/features/workspace/ui/dashboard/WorkspaceOverviewCard.tsx` | Edit — add FOUNDATION_TOOL_LABELS + FOUNDATION_TOOL_ICONS + FOUNDATION_TOOL_TOOLTIPS entries |
| 15 | `apps/frontend/src/features/workspace/ui/dashboard/ContextualToolsPanel.tsx` | Edit — add 'personas-generator' to FOUNDATION_TOOL_KEYS |
| 16 | `apps/frontend/src/features/workspace/ui/WorkspaceHubCard.tsx` | Edit — add FOUNDATION_TOOL_LABELS + FOUNDATION_TOOL_ICONS entries |
| 17 | `apps/frontend/src/app/copy/system.ts` | Edit — add `foundationTooltipPersonas` copy key |
| 18 | `apps/backend/src/lib/tests/runtime.tool-prompts-parametrized.test.ts` | Edit — add TOOL_PROMPT_CONFIGS + WORKFLOW_REGISTRY_CONFIGS entries |
| 19 | `apps/backend/src/lib/tests/runtime.workflow-normalizers.test.ts` | Edit — add artifact role test assertion |
| 20 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.test.ts` | Edit — add to canonical tools list |
| 21 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts` | Edit — verify getEnabledToolKeys includes personas-generator |
| 22 | `apps/frontend/src/features/workspace/ui/dashboard/FoundationToolsPanel.test.tsx` | Edit — add personas-generator mock data |

---

## 10. Extraction Field Definitions (Domain Reference)

These are the 5 canonical extraction fields for the Personas Generator. Three are new to `EXTRACTION_FIELD_KEYS`.

| FieldKey | Status | Definition | Example Extraction |
|---|---|---|---|
| `demographics` | **NEW** | Age, gender, income, education, location, and socio-economic context of the target buyer | `età: 35-50, genere: misto, reddito: €40k-70k, istruzione: laurea, zona: Nord Italia` |
| `goals` | **NEW** | What the persona wants to achieve, desired outcomes, aspirations related to the product/service | `Vuole automatizzare il marketing senza assumere un team interno` |
| `pain_point` | EXISTS | Pain points, frustrations, unmet needs, and daily struggles | `Perde ore ogni settimana a gestire campagne manualmente` |
| `behaviors` | **NEW** | Buying habits, media consumption, decision patterns, preferred channels and platforms | `Cerca soluzioni su Google, legge recensioni su Trustpilot, chiede in gruppi Facebook` |
| `objections` | EXISTS | Common objections and barriers that prevent purchase or conversion | `"Ho già provato tool simili e non funzionano", "Non ho tempo per imparare un nuovo software"` |

All 5 fields follow the zero-friction rule: missing data is marked as `"non disponibile"` and the generation prompt instructs the LLM to infer and expand from available context.

---

## 11. DDD Governance Notes

### Required Before PR

- [ ] Create DDD entry (e.g., DDD-214) for `personas-generator` tool identity, following DDD-210 (brief-generator) and DDD-212 (tov-generator) patterns
- [ ] Update glossary entry for `ToolKey` to include `personas-generator`
- [ ] Update bounded context map for Generation context to list `personas-generator`
- [ ] Add `demographics`, `goals`, `behaviors` to glossary as canonical `ExtractionFieldKey` entries

### Existing Terms Used (No New DDD Needed)

- `persona` (AssetType) — already canonical in `ASSET_TYPES`, `ASSET_TYPE_LABELS`, and downstream `TOOL_ASSET_CONTRACTS`
- `pain_point` (ExtractionFieldKey) — already canonical
- `objections` (ExtractionFieldKey) — already canonical

---

## 12. Foundation Tool Registration Summary

The `personas-generator` becomes a foundation tool **automatically** through A-003:

1. `TOOL_ASSET_CONTRACTS['personas-generator'].consumes === []` ✓
2. Not in `EXCLUDED_FOUNDATION_TOOLS` (`['geometric']`) ✓
3. `useWorkspaceContext.ts:144-147` auto-derives → appears in `foundationTools[]`

No manual `FOUNDATION_TOOL_KEYS` registration needed aside from the exclusion set in `ContextualToolsPanel.tsx` (C-008).

The `FOUNDATION_TOOL_LABELS`, `FOUNDATION_TOOL_ICONS`, and `FOUNDATION_TOOL_TOOLTIPS` maps in the 3 dashboard panels (C-006, C-007, C-009) are **display-only maps** used by the foundation tool rendering components. They map `toolKey → display properties` and are independent of the auto-derivation logic.
