---
goal: Implement tov-generator tool — primitive tool that takes raw uploaded files and generates a structured Brand Tone of Voice document as a brand-voice asset
version: 1.0
date_created: 2026-07-18
last-reviewed: 2026-07-18
next-review-date: 2026-08-18
owner: Platform
status: completed
tags: [plan, tool-workspace, backend, frontend, tov, brand-voice, extraction, primitive]
---

# TOV Generator Implementation Plan

## 0. Tool Classification

| Property | Value |
|---|---|
| **ToolKey** | `tov-generator` |
| **WorkflowType** | `tov_generator` |
| **Display Label** | "TOV Generator" |
| **Archetype** | Primitive: file upload → extraction → single-step generation → asset promotion |
| **CreditCost** | 1 |
| **AvailabilityPolicy** | `enabled-for-all` |
| **Accepted Formats** | `.txt`, `.md`, `.docx` |
| **Prompt Language** | English |
| **LLM Output Language** | Italian (`it-IT`) |

### Asset Contract

```ts
'tov-generator': {
  produces: ['brand-voice'],   // structured TOV → consumable by 7 downstream tools
  consumes: [],                // zero workspace assets required
}
```

### User Flow

```
User uploads file (.txt/.md/.docx)
  → Extraction: 5 core fields (zero friction: "non disponibile" for missing data)
    → tov-generation step: LLM synthesizes full TOV from 5 fields + raw document text
      → Output: structured Markdown TOV document (Italian)
        → Promotable to workspace 'brand-voice' asset
```

### Why Primitive (Not Workspace-Knowledge)

- `tov-generator` is the **entry point** for creating structured TOV from raw content
- Requiring a pre-existing `brand-voice` asset would be circular
- File upload is visible in tool page (`consumes: []` → `briefing-file` not filtered by `visibleInputFiles`)
- Follows same pattern as `brief-generator` (DDD-210)

### Impact on Existing `tone` Select

The frontend `tone` dropdown (4 hardcoded options: Professional/Casual/Formal/Technical) is **not removed** by this tool. The `tov-generator` produces `brand-voice` assets that tools can consume as an **alternative** to the manual `tone` select. A separate migration plan is required to eventually replace the select with asset-driven TOV injection.

---

## 1. Track A — Contracts & Canonical Identity

### A-001: `packages/contracts/src/tool-workflows.ts`

**1. `TOOL_WORKFLOW_DEFINITIONS` entry:**

```ts
'tov-generator': {
  toolKey: 'tov-generator',
  workflowType: 'tov_generator',
  creditCost: 1,
  steps: [
    { key: 'tov-generation', dependencies: [], feedbackEnabled: true },
  ],
},
```

**2. `TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY` entry:**

```ts
'tov-generator': 'enabled-for-all',
```

**3. `normalizeToolKeyCandidate` aliases:**

```ts
if (normalized === 'tov_generator' || normalized === 'tovgenerator') {
  return 'tov-generator';
}
```

### A-002: `packages/contracts/src/extraction-fields.ts`

**Extraction fields (5 — essential set, zero friction):**

| Field | Already in `EXTRACTION_FIELD_KEYS`? | Purpose |
|---|---|---|
| `brand_or_company` | Yes | Brand/company name — TOV subject |
| `target_audience` | Yes | Who the brand communicates with |
| `tone` | Yes | Explicit tone references in the document |
| `product_or_service` | Yes | What the brand offers |
| `market` | Yes | Market positioning/industry context |

```ts
'tov-generator': [
  'brand_or_company',
  'target_audience',
  'tone',
  'product_or_service',
  'market',
],
```

```ts
'tov-generator': [],  // ReadinessRequiredExtractionFieldKeysByTool
```

```ts
'tov-generator': {},  // LegacyExtractionFieldAliasByTool
```

### A-003: `packages/contracts/src/asset.ts`

```ts
'tov-generator': {
  produces: ['brand-voice'],
  consumes: [],
},
```

### Auto-Derived (No Manual Changes Needed)

- `ToolKey` type union (includes `'tov-generator'`)
- `TOOL_STEP_ORDER['tov-generator']` → `['tov-generation']`
- `TOOL_STEP_DEPENDENCIES['tov-generator']` → `{ 'tov-generation': [] }`
- `TOOL_KEY_BY_WORKFLOW_TYPE['tov_generator']` → `'tov-generator'`
- `resolveToolWorkflowType('tov-generator')` → `'tov_generator'`
- `SupportedTool` type (re-exported for frontend)

### Acceptance

- [ ] A-AC-001: `resolveToolWorkflowType('tov-generator')` returns `'tov_generator'`
- [ ] A-AC-002: `getToolLabel('tov-generator')` and `getToolRoute('tov-generator')` resolve canonical values

---

## 2. Track B — Backend Runtime

### B-001: `apps/backend/src/lib/runtime/workflow-normalizers.ts`

**`FINAL_STEP_BY_TOOL` entry:**

```ts
'tov-generator': 'tov-generation',
```

**`isStepMappedToolKey` guard — add to chain:**

```ts
|| value === 'tov-generator'
```

### B-002: `apps/backend/src/lib/runtime/tool-prompts/index.ts`

**Two entries in `PROMPT_FILE_BY_KEY`:**

```ts
'tov-generator:extraction':
  'src/lib/runtime/tool-prompts/tov-generator/prompt_extraction.md',
'tov-generator:tov-generation':
  'src/lib/runtime/tool-prompts/tov-generator/prompt_tov_generation.md',
```

**Branch in `resolvePromptFilePath` extraction block:**

```ts
if (extractionToolKey === 'tov-generator') {
  return PROMPT_FILE_BY_KEY['tov-generator:extraction'];
}
```

### B-003: Extraction Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_extraction.md`

```markdown
# PROMPT TOV GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the uploaded document and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- brand_or_company: Company or brand name
- target_audience: Primary audience the brand communicates with
- tone: Explicit tone references found in the document
- product_or_service: What the brand offers (informs the voice)
- market: Market positioning or industry context

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
```

### B-004: Generation Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_tov_generation.md`

```markdown
# PROMPT TOV GENERATOR - TOV GENERATION

## Step Key
- tov-generation

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Objective
From the 5-field extraction payload, synthesize a complete Brand Tone of Voice
document. The TOV must serve as authoritative input for 7 downstream tools that
consume `brand-voice` assets: funnel-pages, nextland, youtube-lf-script,
angle-generator, meta-ads, youtube-description, blog-article-generator.

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

## Identità del Brand
- Nome Brand/Azienda:
- Settore/Categoria:
- Personalità del Brand (archetipo, 3 aggettivi chiave):

## Valori e Posizionamento
- Valori Fondamentali:
- Posizionamento di Mercato:
- Promessa al Cliente:

## Voce e Tono
- Tono di Voce Primario:
- Toni Secondari (se applicabili):
- Registro Linguistico (formale/informale/tecnico/accessibile):

## Linguaggio
- Parole e Frasi da Usare:
- Parole e Frasi da Evitare:
- Struttura delle Frasi (corte/lunghe, attive/passive):
- Punteggiatura Preferita:

## Adattamento per Canale
- Social Media (tono, lunghezza, emoji):
- Email Marketing (formalità, personalizzazione):
- Landing Page (persuasione, chiarezza):
- Advertising (impatto, brevità):
- Contenuti Lunghi (blog, guide, script):

## Esempi
- Esempio Corretto (breve testo che incarna il TOV):
- Esempio Sbagliato (breve testo che viola il TOV):
```

### Prompt Template Variable Notes

No `{{placeholders}}` needed in generation prompt — the extraction payload is automatically appended as `## Extraction Payload` by `buildContextBlock` in `openrouter.adapter.ts`. The LLM reads this context block natively. No `assemble*Prompt` XState action required.

### Acceptance

- [ ] B-AC-001: Backend orchestrate endpoint returns correct `dependencyArtifactIdsByStep` for `'tov-generator'`
- [ ] B-AC-002: Backend rejects unsupported tool identifiers with explicit validation error
- [ ] B-AC-003: Existing tools pass the focused backend regression suite
- [ ] B-AC-004: Extraction prompt resolves for `extractionToolKey === 'tov-generator'`

---

## 3. Track C — Frontend Tool Workspace

### C-001: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

**6 registries:**

**`toolFormRegistry`:**

```ts
'tov-generator': {
  toolKey: 'tov-generator',
  availabilityPolicy: getToolAvailabilityPolicy('tov-generator'),
  displayName: 'TOV Generator',
  defaultPrompt: 'Genera un Tone of Voice strutturato a partire dai dati estratti dal documento.',
  defaultModel: 'openrouter/auto',
  steps: TOOL_STEP_ORDER['tov-generator'],
  stepDependencies: TOOL_STEP_DEPENDENCIES['tov-generator'],
  defaults: {
    registrySnapshotRef: 'snapshot:default',
  },
},
```

**`toolFileInstructionsRegistry`:**

```ts
'tov-generator': {
  title: appCopy.ui.toolInstructions.title,
  summary: 'Carica un documento con descrizioni del brand, valori aziendali o comunicazioni esistenti. TOV Generator estrae i dati rilevanti e produce un Tone of Voice strutturato.',
  inputFiles: [
    {
      key: 'briefing-file',
      label: 'BriefingFile',
      accept: '.txt,.md,.docx',
      requiredness: 'always-required',
    },
  ],
  requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
  requiredFieldKeys: ['brand_or_company', 'target_audience', 'tone', 'product_or_service', 'market'],
  optionalFields: [],
  examples: [
    'Documento con mission aziendale, valori e descrizione del brand.',
    'Trascrizione di un workshop sul posizionamento del brand.',
  ],
  notes: [
    'Il TOV in output è compatibile con funnel-pages, meta-ads, angle-generator, youtube-lf-script e altri tool.',
  ],
  stepConstraints: [],
},
```

**`toolNavigationLabelByKey`:**

```ts
'tov-generator': 'TOV Generator',
```

**`toolNavigationDescriptionByKey`:**

```ts
'tov-generator': 'Genera un Tone of Voice strutturato a partire da documenti sul brand.',
```

**`toolRouteByKey`:**

```ts
'tov-generator': '/tools/tov-generator',
```

**`stepCardConfigRegistry`:**

```ts
'tov-generator': {
  'tov-generation': {
    displayName: 'TOV Generation',
    description: 'Trasforma i dati estratti in un Tone of Voice strutturato e completo pronto per il consumo da parte degli altri tool.',
    expectedOutputFormat: 'Markdown strutturato con identità, valori, voce, linguaggio, canali ed esempi',
  },
},
```

### C-002: `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts`

```ts
'tov-generator': {
  'tov-generation': { visible: true, includeInDownload: true },
},
```

### C-003: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`

Add to `isSupportedTool()`:

```ts
|| value === 'tov-generator'
```

### C-004: `apps/frontend/src/features/tools/tov-generator/pages/TovGeneratorToolPage.tsx` (NEW)

Create directory `apps/frontend/src/features/tools/tov-generator/pages/` and the page component:

```ts
import { createToolPage } from '../../ui/createToolPage';

export const TovGeneratorToolPage = createToolPage('tov-generator');
```

### C-005: `apps/frontend/src/app/routing/app-router.tsx`

**1. Add lazy import:**

```ts
const TovGeneratorToolPage = lazy(() => import('../../features/tools/tov-generator/pages/TovGeneratorToolPage').then(m => ({ default: m.TovGeneratorToolPage })));
```

**2. Add entry in `toolPageComponents`:**

```ts
'tov-generator': TovGeneratorToolPage,
```

### C-006: No changes to `tool-page-selectors.ts` or `useToolPageRunController.ts`

The tool follows the standard file-upload flow. Extraction and generation are handled by existing infrastructure.

### Acceptance

- [ ] C-AC-001: Tool route resolves to `/tools/tov-generator`
- [ ] C-AC-002: Primary generation action dispatches with correct step, toolKey, workflowType
- [ ] C-AC-003: Session summary shows "TOV Generator" as display label
- [ ] C-AC-004: `TOOL_STEP_DISPLAY_CONFIG` test passes
- [ ] C-AC-005: `tool-form-architecture.test.ts` filters enabled tools correctly

---

## 4. Track D — Test Cases

| # | Test File | What to Cover |
|---|-----------|---------------|
| D-001 | `apps/backend/src/lib/tests/runtime.tov-generator-tool-prompts.test.ts` | Prompt resolution for extraction and tov-generation steps, null for unknown steps, file path matches |
| D-002 | `apps/backend/src/lib/tests/runtime.tov-generator-workflow-registry.test.ts` | Tool availability, step dependency graph, orchestration endpoint |
| D-003 | `tool-step-display-config.test.ts` | Add `'tov-generator'` to canonical tools list expectation |
| D-004 | `tool-form-architecture.test.ts` | Add `'tov-generator'` to enabled tools filter expectation |
| D-005 | `workflow-normalizers.test.ts` | `FINAL_STEP_BY_TOOL['tov-generator']` === `'tov-generation'` |
| D-006 | Contracts type test | `'tov-generator'` in `ToolKey` union, `TOOL_ASSET_CONTRACTS` shape valid |

### Acceptance

- [ ] D-AC-001: All new tests pass
- [ ] D-AC-002: No regressions in existing suites
- [ ] D-AC-003: At least one non-regression pair verifies an existing tool is unchanged

---

## 5. Track E — XState Runtime

**No changes to XState machines.** The tool follows the standard file-upload runtime flow:

1. `frontendStreamMachine` → extraction with `extractionToolKey: 'tov-generator'`
2. `toolPageMachine` → `canStartExtraction` active when file present
3. `toolPageMachine` → `canStartGeneration` active after extraction completes
4. `generationSystemMachine` → standard `generating`/`streaming` path

### Acceptance

- [ ] E-AC-001: Extraction flow completes without blocking
- [ ] E-AC-002: Generation flow produces `brand-voice` artifact with `status: completedd`

---

## 6. Risks and Controls

| Risk | Control |
|------|---------|
| **Sparse extraction → incomplete TOV** | LLM synthesizes missing sections from context; prompt explicitly says "infer and expand from context" |
| **File upload visibility conflict with workspace-asset migration** | `consumes: []` correctly shows `briefing-file` widget; file upload is still supported for primitive tools |
| **Extraction prompt mismatch** | `resolvePromptFilePath` branch ensures `extractionToolKey === 'tov-generator'` resolves correctly |
| **`isSupportedTool()` not updated** | C-003 adds to hardcoded union; tests will catch if missing |
| **`FINAL_STEP_BY_TOOL` not updated** | B-001 adds to both map and guard; tests will catch if missing |

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
A-002 (extraction-fields.ts)
A-003 (asset.ts)

B-001 (workflow-normalizers.ts)
B-002 (tool-prompts/index.ts)
B-003..B-004 (prompt files)

C-001 (tool-form-architecture.ts — 6 registries)
C-002 (tool-step-display-config.ts)
C-003 (SessionArtifactTabs.tsx — isSupportedTool)
C-004..C-005 (TovGeneratorToolPage.tsx + app-router.tsx)

D-001..D-006 (tests)

GATE-001..GATE-004 (validation)
```

---

## 9. File Summary

| # | File | Action |
|---|------|--------|
| 1 | `packages/contracts/src/tool-workflows.ts` | Edit — add definition + availability + alias |
| 2 | `packages/contracts/src/extraction-fields.ts` | Edit — add 3 entries |
| 3 | `packages/contracts/src/asset.ts` | Edit — add TOOL_ASSET_CONTRACTS entry |
| 4 | `apps/backend/src/lib/runtime/workflow-normalizers.ts` | Edit — add to FINAL_STEP_BY_TOOL + guard |
| 5 | `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_extraction.md` | Create — extraction prompt |
| 6 | `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_tov_generation.md` | Create — generation prompt |
| 7 | `apps/backend/src/lib/runtime/tool-prompts/index.ts` | Edit — add 2 entries + branch |
| 8 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Edit — add 6 registries |
| 9 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` | Edit — add entry |
| 10 | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | Edit — add to isSupportedTool |
| 11 | `apps/frontend/src/features/tools/tov-generator/pages/TovGeneratorToolPage.tsx` | Create — 3-line factory wrapper |
| 12 | `apps/frontend/src/app/routing/app-router.tsx` | Edit — add lazy import + toolPageComponents entry |
| 13 | `apps/backend/src/lib/tests/runtime.tov-generator-tool-prompts.test.ts` | Create — prompt resolution tests |
| 14 | `apps/backend/src/lib/tests/runtime.tov-generator-workflow-registry.test.ts` | Create — workflow registry tests |
