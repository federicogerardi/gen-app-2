---
goal: Implement brief-generator tool — primitive tool that transforms raw uploaded files into structured creative briefs
version: 1.1
date_created: 2026-07-18
last-reviewed: 2026-07-18
next-review-date: 2026-08-18
owner: Platform
status: completed
tags: [plan, tool-workspace, backend, frontend, brief, extraction, primitive]
---

# Brief Generator Implementation Plan

## 0. Tool Classification

| Property | Value |
|---|---|
| **ToolKey** | `brief-generator` |
| **WorkflowType** | `brief_generator` |
| **Display Label** | "Brief Generator" |
| **Archetype** | Primitive: file upload → extraction → single-step generation → asset promotion |
| **CreditCost** | 1 |
| **AvailabilityPolicy** | `enabled-for-all` |
| **Accepted Formats** | `.txt`, `.md`, `.docx` |
| **Prompt Language** | English |
| **LLM Output Language** | Italian (`it-IT`) |

### Asset Contract

```ts
'brief-generator': {
  produces: ['brief'],   // structured brief → consumable by other tools (asset promotion)
  consumes: [],          // zero workspace assets required
}
```

### User Flow

```
User uploads file (.txt/.md/.docx)
  → Extraction: 5 core fields (zero friction: "non disponibile" for missing data)
    → brief-generation step: LLM synthesizes full brief from 5 fields + raw document text
      → Output: structured Markdown brief (Italian)
        → Promotable to workspace 'brief' asset
```

### Why Primitive (Not Workspace-Knowledge)

- `brief-generator` is the **entry point** for creating structured briefs from raw content
- Requiring a pre-existing `brief` asset would be circular
- File upload is visible in tool page (`consumes: []` → `briefing-file` not filtered by `visibleInputFiles`)
- Follows same pattern as `angle-generator`, `meta-ads`, `funnel-pages` legacy file-upload flow

---

## 1. Track A — Contracts & Canonical Identity

### A-001: `packages/contracts/src/tool-workflows.ts`

**1. `TOOL_WORKFLOW_DEFINITIONS` entry:**

```ts
'brief-generator': {
  toolKey: 'brief-generator',
  workflowType: 'brief_generator',
  creditCost: 1,
  steps: [
    { key: 'brief-generation', dependencies: [], feedbackEnabled: true },
  ],
},
```

**2. `TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY` entry:**

```ts
'brief-generator': 'enabled-for-all',
```

**3. `normalizeToolKeyCandidate` aliases:**

```ts
if (normalized === 'brief_generator' || normalized === 'briefgenerator') {
  return 'brief-generator';
}
```

### A-002: `packages/contracts/src/extraction-fields.ts`

**Extraction fields (5 — essential set, zero friction):**

| Field | Purpose |
|---|---|
| `product_or_service` | Core subject of the brief |
| `target_audience` | Who the campaign/content targets |
| `campaign_objective` | Goal of the campaign |
| `primary_offer` | What is being promoted/sold |
| `tone` | Preferred communication style |

```ts
'brief-generator': [
  'product_or_service',
  'target_audience',
  'campaign_objective',
  'primary_offer',
  'tone',
],
```

```ts
'brief-generator': [],  // ReadinessRequiredExtractionFieldKeysByTool
```

```ts
'brief-generator': {},  // LegacyExtractionFieldAliasByTool
```

### A-003: `packages/contracts/src/asset.ts`

```ts
'brief-generator': {
  produces: ['brief'],
  consumes: [],
},
```

### Auto-Derived (No Manual Changes Needed)

- `ToolKey` type union (includes `'brief-generator'`)
- `TOOL_STEP_ORDER['brief-generator']` → `['brief-generation']`
- `TOOL_STEP_DEPENDENCIES['brief-generator']` → `{ 'brief-generation': [] }`
- `TOOL_KEY_BY_WORKFLOW_TYPE['brief_generator']` → `'brief-generator'`
- `resolveToolWorkflowType('brief-generator')` → `'brief_generator'`
- `SupportedTool` type (re-exported for frontend)

### Acceptance

- [x] A-AC-001: `resolveToolWorkflowType('brief-generator')` returns `'brief_generator'`
- [x] A-AC-002: `getToolLabel('brief-generator')` and `getToolRoute('brief-generator')` resolve canonical values

---

## 2. Track B — Backend Runtime

### B-001: `apps/backend/src/lib/runtime/workflow-normalizers.ts`

**`FINAL_STEP_BY_TOOL` entry:**

```ts
'brief-generator': 'brief-generation',
```

**`isStepMappedToolKey` guard — add to chain:**

```ts
|| value === 'brief-generator'
```

### B-002: `apps/backend/src/lib/runtime/tool-prompts/index.ts`

**Two entries in `PROMPT_FILE_BY_KEY`:**

```ts
'brief-generator:extraction':
  'src/lib/runtime/tool-prompts/brief-generator/prompt_extraction.md',
'brief-generator:brief-generation':
  'src/lib/runtime/tool-prompts/brief-generator/prompt_brief_generation.md',
```

**Branch in `resolvePromptFilePath` extraction block:**

```ts
if (extractionToolKey === 'brief-generator') {
  return PROMPT_FILE_BY_KEY['brief-generator:extraction'];
}
```

### B-003: Extraction Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_extraction.md`

```markdown
# PROMPT BRIEF GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the briefing file and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- product_or_service: What is being marketed or described
- target_audience: Primary audience for this product/service/campaign
- campaign_objective: What the campaign or content aims to achieve
- primary_offer: The main offer, product, or call to action
- tone: Preferred tone of voice or communication style

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
```

### B-004: Generation Prompt (NEW)

**File:** `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_brief_generation.md`

```markdown
# PROMPT BRIEF GENERATOR - BRIEF GENERATION

## Step Key
- brief-generation

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Objective
Starting from the 5-field extraction payload, synthesize a complete and actionable
creative brief. The brief must serve as authoritative input for downstream tools:
funnel-pages, meta-ads, angle-generator, youtube-lf-script, nextland.

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

## Panoramica
- Prodotto/Servizio:
- Categoria/Settore:
- Unique Value Proposition:

## Obiettivo Campagna
- Obiettivo Primario (awareness / lead-gen / sales / retention):
- Obiettivi Secondari:
- KPI di Successo:

## Target Audience
- Persona Primaria:
- Dati Demografici:
- Dati Psicografici:
- Pain Point Principali:
- Desired Outcomes:
- Obiezioni da Superare:

## Offerta e Meccanismo
- Offerta Core:
- Meccanismo Unico / Differenziazione:
- Garanzia / Risk Reversal:

## Mercato e Competizione
- Posizionamento di Mercato:
- Competitor Principali (nome + differenziante):
- Vantaggio Competitivo:

## Brand Voice e Tono
- Tono di Voce (1-3 aggettivi):
- Parole/Frasi da Usare:
- Parole/Frasi da Evitare:

## Pilastri di Messaggio
- Pilastro 1 (messaggio chiave + proof):
- Pilastro 2:
- Pilastro 3:

## Proof e Credibilità
- Elementi di Social Proof:
- Authority Markers:
- Dati/Statistiche:
- Testimonial / Case Study:

## Vincoli Creativi
- Elementi Obbligatori:
- Elementi Vietati:
- Vincoli di Formato/Lunghezza:
- Note Normative:

## Contesto Funnel
- Funnel Goal:
- Stadio del Funnel:
- CTA Primaria:
- Next Step dopo Conversione:
```

### Prompt Template Variable Notes

No `{{placeholders}}` needed in generation prompt — the extraction payload is automatically appended as `## Extraction Payload` by `buildContextBlock` in `openrouter.adapter.ts`. The LLM reads this context block natively. No `assemble*Prompt` XState action required.

The extraction payload flows through the standard request pipeline:
1. Extraction step produces `extractionPayload` (stored in frontend state)
2. `startGenerationStep` sends request with `extractionPayload` + `briefingText`
3. `buildContextBlock` appends both as `## Extraction Payload` and `## Briefing Source`
4. Generation prompt + context block sent to LLM

### Acceptance

- [x] B-AC-001: Backend orchestrate endpoint returns correct `dependencyArtifactIdsByStep` for `'brief-generator'`
- [x] B-AC-002: Backend rejects unsupported tool identifiers with explicit validation error
- [x] B-AC-003: Existing tools pass the focused backend regression suite
- [x] B-AC-004: Extraction prompt resolves for `extractionToolKey === 'brief-generator'`

---

## 3. Track C — Frontend Tool Workspace

### C-001: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

**6 registries:**

**`toolFormRegistry`:**

```ts
'brief-generator': {
  toolKey: 'brief-generator',
  availabilityPolicy: getToolAvailabilityPolicy('brief-generator'),
  displayName: 'Brief Generator',
  defaultPrompt: 'Genera un brief strutturato completo a partire dai dati estratti dal documento.',
  defaultModel: 'openrouter/auto',
  steps: TOOL_STEP_ORDER['brief-generator'],
  stepDependencies: TOOL_STEP_DEPENDENCIES['brief-generator'],
  defaults: {
    registrySnapshotRef: 'snapshot:default',
  },
},
```

**`toolFileInstructionsRegistry`:**

```ts
'brief-generator': {
  title: appCopy.ui.toolInstructions.title,
  summary: 'Carica un documento con appunti, bullet points o descrizioni. Brief Generator estrae i dati rilevanti e produce un brief strutturato pronto per gli altri tool.',
  inputFiles: [
    {
      key: 'briefing-file',
      label: 'BriefingFile',
      accept: '.txt,.md,.docx',
      requiredness: 'always-required',
    },
  ],
  requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
  requiredFieldKeys: ['product_or_service', 'target_audience', 'campaign_objective', 'primary_offer', 'tone'],
  optionalFields: [],
  examples: [
    'Appunti sparsi su prodotto, target e obiettivi campagna.',
    'Trascrizione di una call commerciale da strutturare in brief formale.',
  ],
  notes: [
    'Il brief in output è compatibile con funnel-pages, meta-ads, angle-generator, youtube-lf-script e nextland.',
    'Se un campo non è disponibile nel file, l\'estrazione lo segna come "non disponibile" e il brief lo esplicita.',
  ],
  stepConstraints: [],
},
```

**`toolNavigationLabelByKey`:**

```ts
'brief-generator': 'Brief Generator',
```

**`toolNavigationDescriptionByKey`:**

```ts
'brief-generator': 'Trasforma documenti grezzi in brief strutturati pronti per la generazione con altri tool.',
```

**`toolRouteByKey`:**

```ts
'brief-generator': '/tools/brief-generator',
```

**`stepCardConfigRegistry`:**

```ts
'brief-generator': {
  'brief-generation': {
    displayName: 'Brief Generation',
    description: 'Trasforma i dati estratti in un brief creativo strutturato e standardizzato pronto per il consumo da parte degli altri tool.',
    expectedOutputFormat: 'Markdown strutturato con tutte le sezioni canoniche del brief',
  },
},
```

### C-002: `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts`

```ts
'brief-generator': {
  'brief-generation': { visible: true, includeInDownload: true },
},
```

### C-003: `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`

Add to `isSupportedTool()`:

```ts
|| value === 'brief-generator'
```

### C-004: `apps/frontend/src/features/tools/brief-generator/pages/BriefGeneratorToolPage.tsx` (NEW)

Create directory `apps/frontend/src/features/tools/brief-generator/pages/` and the page component:

```ts
import { createToolPage } from '../../ui/createToolPage';

export const BriefGeneratorToolPage = createToolPage('brief-generator');
```

This 3-line factory wrapper follows the exact pattern of all 8 existing tool pages (e.g., `YoutubeDescriptionToolPage.tsx`, `GeometricToolPage.tsx`, `BlogArticleGeneratorToolPage.tsx`).

### C-005: `apps/frontend/src/app/routing/app-router.tsx` (NEW)

Two changes required:

**1. Add lazy import at top of file (near other tool page imports):**

```ts
const BriefGeneratorToolPage = lazy(() => import('../../features/tools/brief-generator/pages/BriefGeneratorToolPage').then(m => ({ default: m.BriefGeneratorToolPage })));
```

**2. Add entry in `toolPageComponents` (exhaustive Record<SupportedTool, ...>):**

```ts
'brief-generator': BriefGeneratorToolPage,
```

Without this entry, TypeScript fails because `toolPageComponents` is typed as exhaustive `Record<SupportedTool, LazyExoticComponent<FC>>`.

### C-006: No changes to `tool-page-selectors.ts` or `useToolPageRunController.ts`

The tool follows the standard file-upload flow. Extraction and generation are handled by existing infrastructure (`frontendStreamMachine`, `toolPageMachine`, `generationSystemMachine`).

### Acceptance

- [x] C-AC-001: Tool route resolves to `/tools/brief-generator`
- [x] C-AC-002: Primary generation action dispatches with correct step, toolKey, workflowType
- [x] C-AC-003: Session summary shows "Brief Generator" as display label
- [x] C-AC-004: `TOOL_STEP_DISPLAY_CONFIG` test passes
- [x] C-AC-005: `tool-form-architecture.test.ts` filters enabled tools correctly

---

## 4. Track D — Test Cases

| # | Test File | What to Cover |
|---|-----------|---------------|
| D-001 | `apps/backend/src/lib/tests/runtime.brief-generator-tool-prompts.test.ts` | Prompt resolution for extraction and brief-generation steps, null for unknown steps, file path matches |
| D-002 | `apps/backend/src/lib/tests/runtime.brief-generator-workflow-registry.test.ts` | Tool availability, step dependency graph, orchestration endpoint |
| D-003 | `tool-step-display-config.test.ts` | Add `'brief-generator'` to canonical tools list expectation |
| D-004 | `tool-form-architecture.test.ts` | Add `'brief-generator'` to enabled tools filter expectation |
| D-005 | `workflow-normalizers.test.ts` | `FINAL_STEP_BY_TOOL['brief-generator']` === `'brief-generation'` |
| D-006 | Contracts type test | `'brief-generator'` in `ToolKey` union, `TOOL_ASSET_CONTRACTS` shape valid |

### Acceptance

- [x] D-AC-001: All new tests pass
- [x] D-AC-002: No regressions in existing suites
- [x] D-AC-003: At least one non-regression pair verifies an existing tool is unchanged

---

## 5. Track E — XState Runtime

**No changes to XState machines.** The tool follows the standard file-upload runtime flow:

1. `frontendStreamMachine` → extraction with `extractionToolKey: 'brief-generator'`
2. `toolPageMachine` → `canStartExtraction` active when file present
3. `toolPageMachine` → `canStartGeneration` active after extraction completes
4. `generationSystemMachine` → standard `generating`/`streaming` path

No new states, events, or transitions required.

### Acceptance

- [x] E-AC-001: Extraction flow completes without blocking
- [x] E-AC-002: Generation flow produces brief artifact with `status: completedd`

---

## 6. Risks and Controls

| Risk | Control |
|------|---------|
| **Sparse extraction → incomplete brief** | LLM synthesizes missing sections from context; prompt explicitly says "infer and expand from context" |
| **File upload visibility conflict with workspace-asset migration** | `consumes: []` correctly shows `briefing-file` widget; file upload is still supported for primitive tools |
| **Extraction prompt mismatch** | `resolvePromptFilePath` branch ensures `extractionToolKey === 'brief-generator'` resolves correctly |
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
C-004..C-005 (BriefGeneratorToolPage.tsx + app-router.tsx)

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
| 5 | `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_extraction.md` | Create — extraction prompt |
| 6 | `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_brief_generation.md` | Create — generation prompt |
| 7 | `apps/backend/src/lib/runtime/tool-prompts/index.ts` | Edit — add 2 entries + branch |
| 8 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Edit — add 6 registries |
| 9 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` | Edit — add entry |
| 10 | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | Edit — add to isSupportedTool |
| 11 | `apps/frontend/src/features/tools/brief-generator/pages/BriefGeneratorToolPage.tsx` | Create — 3-line factory wrapper |
| 12 | `apps/frontend/src/app/routing/app-router.tsx` | Edit — add lazy import + toolPageComponents entry |
| 13 | `apps/backend/src/lib/tests/runtime.brief-generator-tool-prompts.test.ts` | Create — prompt resolution tests |
| 14 | `apps/backend/src/lib/tests/runtime.brief-generator-workflow-registry.test.ts` | Create — workflow registry tests |
