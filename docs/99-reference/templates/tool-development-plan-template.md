---
goal: Deterministic plan for creating a new Tool in the repository, from DDD analysis through publication
version: 2.0
date_created: 2025-10-15
last_updated: 2026-07-08
last-reviewed: 2026-07-08
next-review-date: 2026-10-08
owner: Platform
status: active
tags: [plan, tool-workspace, backend, frontend, ddd, validation, template]
---

# Tool Development Plan Template

This template defines the deterministic structure for creating a new Tool. Following it produces a Tool consistent with all existing Tools in naming, architecture, runtime behavior, and session/summary parity.

## How to Use This Template

1. Copy this file to `docs/99-reference/plans/tool-<tool-key>-development-plan.md`.
2. Replace all `<placeholder>` values with your Tool's canonical identifiers.
3. Execute Tracks A-E in order. Each track has a file-by-file checklist.
4. Run the validation gates after each track.
5. Mark checkboxes as you complete items.

## Tool Archetype Classification

Before starting, classify your Tool. The archetype determines which patterns and files apply.

| Archetype | Characteristics | Reference Implementation |
|-----------|----------------|-------------------------|
| **Direct-input, single-step** | User fills form fields, one generation step | `youtube-description` |
| **Direct-input, multi-step** | Multiple sequential generation steps, each depends on prior output | `blog-article-generator`, `geometric` |
| **File-upload, multi-step** | User uploads a file, extraction step, then generation steps | `meta-ads`, `funnel-pages` |
| **File-upload, single-step** | User uploads a file, one generation step | `nextland` (thank_you) |
| **API-acquisition** | Backend fetches external data before generation | `geometric` (serp-crawling) |

If your Tool spans multiple archetypes (e.g., file-upload + API-acquisition), apply the union of all relevant patterns.

---

## 0. Phase 0 - Initial DDD Analysis

### Objective

Identify canonical terms, confirm the Tool belongs to an existing bounded context (or requires a new one), and obtain DDD governance approval before any code is written.

### Checklist

- [ ] Identify the bounded context that owns the new Tool.
- [ ] Define canonical `ToolKey` (kebab-case, e.g. `my-new-tool`).
- [ ] Define canonical `ToolWorkflow` (snake_case, e.g. `my_new_tool`).
- [ ] Define canonical `ToolStep` sequence with explicit dependencies.
- [ ] Classify the Tool archetype (see table above).
- [ ] Identify form fields needed: which are required, which are optional.
- [ ] Decide which `ToolInputSource` families apply: `direct-input`, `tool-input-file`, `api-acquisition`.
- [ ] Check the glossary, bounded-context map, and decision log for existing terms.
- [ ] If a new domain term is needed, create a `DDD-NNN` decision entry before coding.
- [ ] Flag any synonym or drift risk (terms that appear elsewhere with different meaning).

### Required DDD Artifacts

- Canonical terms used by this Tool.
- Terms explicitly forbidden (avoid reusing with different meaning).
- Any new or updated DDD decision entries.
- The XState boundary list: which machines, actors, and transitions are touched.

### Primary Evidence Anchors

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`

---

## 1. Deterministic Inputs

Define once, reuse everywhere.

```bash
export TOOL_KEY='<kebab-case-tool-key>'          # e.g. blog-article-generator
export TOOL_WORKFLOW='<snake_case_workflow>'     # e.g. blog_article_generator
export TOOL_DISPLAY_LABEL='<Display Label>'       # e.g. Blog Article Generator
```

Input rules:
- `TOOL_KEY` matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `TOOL_WORKFLOW` matches `^[a-z0-9]+(?:_[a-z0-9]+)*$`.
- `TOOL_DISPLAY_LABEL` is approved in DDD glossary.

---

## 2. Track A - Contracts and Canonical Identity

### File-by-File Implementation

| # | File | What to Add | Pattern Reference |
|---|------|-------------|-------------------|
| A-001 | `packages/contracts/src/tool-workflows.ts` | Add `TOOL_WORKFLOW_DEFINITIONS` entry with `toolKey`, `workflowType`, `creditCost`, `steps[]` with explicit `dependencies`. Add `TOOL_AVAILABILITY_POLICY` entry. Add normalization aliases in `normalizeToolKeyCandidate`. | Lines 74-83, 124, 273-278 |
| A-002 | `packages/contracts/src/extraction-fields.ts` | Add empty arrays/lookups for extraction fields, readiness fields, legacy aliases. Even if empty, the entries are required. | Lines 98, 115, 171 |

### Auto-Derived (No Manual Changes Needed)

These derive from A-001 automatically via TypeScript:
- `ToolKey` type union (includes your key)
- `TOOL_STEP_ORDER` (ordered step array)
- `TOOL_STEP_DEPENDENCIES` (step dependency graph)
- `TOOL_KEY_BY_WORKFLOW_TYPE` (reverse lookup)
- `resolveToolWorkflowType()` return type
- `SupportedTool` type (re-exported for frontend)

### Acceptance

- [ ] A-AC-001: `resolveToolWorkflowType(TOOL_KEY)` returns `TOOL_WORKFLOW` and the reverse mapping is stable.
- [ ] A-AC-002: `getToolLabel(TOOL_KEY)` and `getToolRoute(TOOL_KEY)` resolve canonical values.

---

## 3. Track B - Backend Runtime

### File-by-File Implementation

| # | File | What to Add | Pattern Reference |
|---|------|-------------|-------------------|
| B-001 | `apps/backend/src/lib/runtime/tool-workflow-registry.ts` | **Auto-derived** from contracts A-001. No changes needed unless the Tool has non-generation step types (like geometric's `crawling`/`scoring`). | Lines 56-61, 70-90 |
| B-002 | `apps/backend/src/lib/runtime/workflow-normalizers.ts` | Add `TOOL_KEY` to `FINAL_STEP_BY_TOOL` map with its final step key. Add `TOOL_KEY` to `isStepMappedToolKey` guard. **This is required for artifact role classification** (`step` vs `final`). | Lines 16-24, 28-36 |
| B-003 | `apps/backend/src/lib/runtime/tool-prompts/index.ts` | Add `toolKey:stepKey` entries in `PROMPT_FILE_BY_KEY` for each step that needs a prompt. | Lines 37-39 |
| B-004 | `apps/backend/src/lib/runtime/tool-prompts/<tool-key>/` | Create one `.md` prompt file per step. **Use `{{variable}}` placeholders for dynamic content.** See pattern below. | `prompt_blog_article.md` |
| B-005 | `apps/backend/src/lib/machines/generation-system.actions.ts` | **If the Tool uses `{{placeholders}}` in prompts:** create `assemble<ToolName>Prompt` action (XState action level, NOT adapter level). See Section 11. | `assembleBlogArticlePrompt` (lines 379-431), `assembleGeometricPrompt` (lines 326-378) |
| B-006 | `apps/backend/src/lib/machines/generation-system.actions.ts` | Add action type to `GenerationSystemActionObject` union. | Line 63 |
| B-007 | `apps/backend/src/lib/machines/generation-system.execution.states.ts` | Wire `assemble<ToolName>Prompt` into `generating.entry` AND `streaming.entry`. Both states need it. | Lines 256, 297 |
| B-008 | `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts` | **(Optional)** Add per-step LLM model overrides if the Tool benefits from different models per step. | Lines 35-53 |
| B-009 | `apps/backend/src/lib/tests/` | Create test files for prompt resolution and workflow registry validation. | `runtime.blog-article-tool-prompts.test.ts`, `runtime.blog-article-workflow-registry.test.ts` |

### Prompt Template Variable Rules

Prompts support these placeholder patterns:

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{output_step_<stepKey>}}` | Content from a previous step's artifact | `{{output_step_blog_seo_structure}}` |
| `{{titolo}}` | `requestInput.titolo` or `extractionPayload.titolo` | `{{titolo}}` |
| `{{tone}}` | `requestInput.tone` | `{{tone}}` |
| Custom fields | Any field on `requestInput` | Add to the action's replacement logic |

**Critical rule:** Template variable replacement MUST be at the XState action level (`generation-system.actions.ts`), NOT at the adapter level (`openrouter.adapter.ts`). The adapter's `buildContextBlock` provides supplementary context; it does not replace prompt template variables.

### Acceptance

- [ ] B-AC-001: Backend orchestrate endpoint returns correct `dependencyArtifactIdsByStep` for the Tool.
- [ ] B-AC-002: Backend rejects unsupported tool identifiers with explicit validation error.
- [ ] B-AC-003: Existing tools pass the focused backend regression suite (`npm --workspace apps/backend run test`).
- [ ] B-AC-004: `assemble<ToolName>Prompt` replaces all `{{placeholders}}` (verify with 0 remaining placeholders at step 3).

---

## 4. Track C - Frontend Tool Workspace

### File-by-File Implementation

| # | File | What to Add | Pattern Reference |
|---|------|-------------|-------------------|
| C-001 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Add `toolFormRegistry` entry with `toolKey`, `availabilityPolicy`, `displayName`, `defaultPrompt`, `defaultModel`, `steps`, `stepDependencies`, `defaults`. | Lines 203-214 |
| C-002 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Add `toolFileInstructionsRegistry` entry describing input files, required/optional fields, examples, notes. | Lines 418-432 |
| C-003 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Add navigation label, description, and route in `navLabels`, `navDescriptions`, `navRoutes`. | Lines 513, 524, 535 |
| C-004 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | Add `stepCardConfigRegistry` entry with `displayName`, `description`, `expectedOutputFormat` per step. | Lines 749-765 |
| C-005 | `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts` | Add `TOOL_STEP_DISPLAY_CONFIG` entry with `visible` and `includeInDownload` per step. Even if all steps have defaults, the entry is required for test parity. | Lines 92-96 |
| C-006 | `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` | **If direct-input-only:** create `build<ToolName>DirectInputExtractionInfo` function. Register in `selectGenerationExtractionInfo` guard. Inject form fields into `buildBaseGenerationRequest` if needed for template variables (e.g. `titolo`). | Lines 187-204, 332-334, 488-491 |
| C-007 | `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` | **If direct-input-only:** add `build<ToolName>DirectInputExtractionInfo` call in the `directInputExtractionInfo` block. | Lines 116-119 |
| C-008 | `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` | Add `TOOL_KEY` to `isSupportedTool()` function. **This is a hardcoded union — the type alone is not enough.** | Line 26 |
| C-009 | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` | **(If tool adds new form fields)** Add field to `ToolFormState` type and update `toolFormRegistry` defaults. Document which fields are required/hidden and whether model selector is visible. | `titolo` field pattern |

### Frontend Dependency Content Fetching (Multi-Step Tools)

For multi-step tools where step N depends on output from step N-1, the frontend must pre-fetch dependency artifact content before dispatching the generation request. This is handled automatically by `startGenerationStep` in `useToolPageRunController.ts`:

1. `orchestrateToolStep()` returns `dependencyArtifactIdsByStep` (stepKey → artifactId).
2. For each dependency, content is resolved from `liveArtifacts` (current session, has content) or fetched via `getArtifactById` with `?includeContent=1` (previous sessions, content not in list endpoint).
3. The resolved content map is passed to `createStepRequest` as `stepDependencyArtifactContentsByStep`.

**No additional code is needed per tool.** This mechanism works for all multi-step tools automatically.

### Acceptance

- [ ] C-AC-001: Tool route resolves to `/tools/$TOOL_KEY` from canonical sources.
- [ ] C-AC-002: Primary generation action dispatches with correct `step`, `toolKey`, `workflowType`, and `stepDependencyArtifactContentsByStep` (for multi-step).
- [ ] C-AC-003: Session summary list shows `TOOL_DISPLAY_LABEL`, not raw `TOOL_KEY`.
- [ ] C-AC-004: Session detail shows `TOOL_DISPLAY_LABEL` in title and metadata.
- [ ] C-AC-005: Relaunch CTA from session detail is enabled and resolves to correct route.
- [ ] C-AC-006: `TOOL_STEP_DISPLAY_CONFIG` test passes (step visibility and download config).
- [ ] C-AC-007: `tool-form-architecture.test.ts` filters enabled tools correctly.

---

## 5. Track D - Test Cases

### Required Tests

| # | Test File | What to Cover |
|---|-----------|---------------|
| D-001 | `apps/backend/src/lib/tests/runtime.<tool>-tool-prompts.test.ts` | Prompt resolution for each step, null for unknown steps, file path matches. |
| D-002 | `apps/backend/src/lib/tests/runtime.<tool>-workflow-registry.test.ts` | Tool availability, step dependency graph, orchestration endpoint. |
| D-003 | Update `tool-step-display-config.test.ts` | Add `TOOL_KEY` to the canonical tools list expectation. |
| D-004 | Update `tool-form-architecture.test.ts` | Add `TOOL_KEY` to the enabled tools filter expectation. |
| D-005 | Update session summary tests | Cover the new Tool in list label and detail title/metadata assertions. |

### Acceptance

- [ ] D-AC-001: All new tests pass.
- [ ] D-AC-002: No regressions in existing suites (`npm run test` in all workspaces).
- [ ] D-AC-003: At least one non-regression pair verifies an existing Tool is unchanged.

---

## 6. Track E - XState Runtime Determinism

### Checklist

- [ ] E-001: Define the XState transition matrix for touched machine paths.
- [ ] E-002: Every runtime gate has an explicit event + deterministic branch.
- [ ] E-003: Recovery transitions (`retry`, `regenerate`) are explicit and test-covered.
- [ ] E-004: Non-regression transition tests pass for at least one existing Tool.

---

## 7. DDD Impact Gate

- [ ] X-001: New Tool characteristics mapped to canonical DDD terms.
- [ ] X-002: Any new term has an approved DDD decision entry.
- [ ] X-003: No synonym or local naming variant introduced.
- [ ] X-004: FE/BE cross-context translations are explicit and documented.

---

## 8. Risks and Controls

| Risk | Control |
|------|---------|
| **Cross-surface drift** (Workspace works, Summary broken) | Track C parity tasks + session summary test coverage. |
| **Naming drift** (`TOOL_KEY` vs `TOOL_WORKFLOW` mismatch) | EXEC-000 DDD grep gate. |
| **Regression on existing tools** | D-AC-003 non-regression pair. |
| **API binding gate blocks new Tool** | Track C feature-flag configuration. |
| **Template variables not replaced** | B-005: replacement at XState action level, not adapter level. Wire in BOTH `generating` and `streaming` entry. Verify 0 remaining placeholders. |
| **Direct-input Tool fails dispatch** | C-006: dedicated `build<ToolName>DirectInputExtractionInfo` + `selectGenerationExtractionInfo` guard. |
| **`isSupportedTool()` not updated** | C-008: add to hardcoded union in `SessionArtifactTabs.tsx`. |
| **Step display config missing** | C-005: add to `TOOL_STEP_DISPLAY_CONFIG`. Test will catch if missing. |
| **`FINAL_STEP_BY_TOOL` not updated** | B-002: add Tool to both the map and the `isStepMappedToolKey` guard. |
| **Dependency content missing in multi-step tools** | Frontend pre-fetches content automatically via `getArtifactById` when not in workspace. No per-tool code needed. |

---

## 9. Validation Gates

Run from repository root after each track.

| Step | Command | Purpose |
|------|---------|---------|
| GATE-001 | `npm run typecheck` | Global type safety |
| GATE-002 | `npm --workspace apps/backend run test` | Backend regression |
| GATE-003 | `npm --workspace apps/frontend run test` | Frontend regression |
| GATE-004 | `npm run build` | Publication readiness |

Stop condition: if any gate fails, fix before continuing.

---

## 10. Implementation Order Summary

Execute tracks in this order for minimum rework:

```
A-001 (contracts)
  └─> All types auto-derive
A-002 (extraction fields)

B-001..B-002 (backend registry, role mapping)
B-003..B-004 (prompt files)
B-005..B-007 (template action + wire)
B-008 (LLM overrides, optional)
B-009 (backend tests)

C-001..C-004 (form config, nav, step cards)
C-005 (step display config)
C-006..C-007 (direct-input builder, if applicable)
C-008 (isSupportedTool)
C-009 (new form fields, if applicable)

D-001..D-005 (tests)

GATE-001..GATE-004 (validation)
```

---

## 11. Architectural Patterns Reference

### Pattern 1: Template Variable Replacement (XState Action)

**When:** Any prompt `.md` file contains `{{placeholders}}` that need replacement before the LLM call.

**Location:** `apps/backend/src/lib/machines/generation-system.actions.ts`

```typescript
assemble<ToolName>Prompt: assignGeneration<undefined>({
  requestInput: ({ context }: GenerationActionArgs) => {
    // Guard: only apply to this Tool. Check BOTH toolKey AND workflowType.
    if (context.toolKey !== TOOL_KEY && context.workflowType !== TOOL_WORKFLOW) {
      return context.requestInput;
    }

    // Read template from resolvedPromptTemplate (set by request-contract.ts)
    const promptTemplate = context.requestInput.resolvedPromptTemplate
      ?? context.requestInput.prompt;
    if (!promptTemplate) return context.requestInput;

    let filledPrompt = promptTemplate;

    // Replace {{output_step_<stepKey>}} from prior step artifacts
    const deps = context.requestInput.stepDependencyArtifactContentsByStep;
    if (deps && typeof deps === 'object') {
      for (const [stepKey, content] of Object.entries(deps)) {
        if (typeof content === 'string' && content.trim()) {
          filledPrompt = filledPrompt.replace(
            new RegExp(`\\{\\{output_step_${stepKey}\\}\\}`, 'g'),
            content,
          );
        }
      }
    }

    // Replace form field placeholders ({{titolo}}, {{tone}}, etc.)
    // Read from requestInput (set by buildBaseGenerationRequest in frontend)
    // or extractionPayload (set by extraction step)

    return { ...context.requestInput, prompt: filledPrompt };
  },
}),
```

**Wire in BOTH states** (`generation-system.execution.states.ts`):
```typescript
generating: { entry: ['ensureArtifactId', 'assemble<ToolName>Prompt'], ... },
streaming:  { entry: ['ensureArtifactId', 'assemble<ToolName>Prompt'], ... },
```

**Add type** in the `GenerationSystemActionObject` union.

**Reference:** `assembleGeometricPrompt` (lines 326-378), `assembleBlogArticlePrompt` (lines 379-431).

---

### Pattern 2: Direct-Input Extraction Info

**When:** Tool uses only form fields (no file upload, no API acquisition).

**Location:** `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`

```typescript
// 1. Builder function
export const build<ToolName>DirectInputExtractionInfo = ({
  field1,
}: Pick<ToolFormState, 'field1'>): SelectedExtractionInfo | null => {
  const v = field1.trim();
  if (!v) return null;
  return {
    extractionArtifactId: `direct-input:${TOOL_KEY}`,
    briefingId: `direct-input:${TOOL_KEY}`,
    briefingText: `Field1: ${v}`,
    extractionPayload: { field1: v },
  };
};

// 2. Register in selectGenerationExtractionInfo guard
if (toolKey === TOOL_KEY && directInputExtractionInfo) {
  return directInputExtractionInfo;
}

// 3. If form fields need to reach backend for template variables,
//    add them in buildBaseGenerationRequest:
...(toolKey === TOOL_KEY && typeof formState.field1 === 'string' && formState.field1.trim()
  ? { field1: formState.field1.trim() }
  : {}),
```

**Location:** `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`

```typescript
// 4. Call builder in the directInputExtractionInfo block
if (toolKey === TOOL_KEY) {
  return build<ToolName>DirectInputExtractionInfo({
    field1: formState.field1,
  });
}
```

**Reference:** `buildBlogArticleGeneratorDirectInputExtractionInfo` (lines 187-204), `buildGeometricDirectInputExtractionInfo` (lines 33-68).

---

### Pattern 3: Step Display Configuration

**When:** Any Tool (even if all steps use defaults).

**Location:** `apps/frontend/src/features/tools/runtime/tool-step-display-config.ts`

```typescript
TOOL_KEY: {
  'step1': { visible: true, includeInDownload: false },  // intermediate step
  'step2': { visible: true, includeInDownload: true },   // final output
},
```

**Default** (if no entry): `{ visible: true, includeInDownload: true }`.

**Also required:** Add `TOOL_KEY` to `isSupportedTool()` in `SessionArtifactTabs.tsx` (C-008).

---

### Pattern 4: Prompt File Creation

**When:** Any generation step that needs an LLM prompt.

**Location:** `apps/backend/src/lib/runtime/tool-prompts/<tool-key>/prompt_<step_key>.md`

1. Create the `.md` file with the prompt template.
2. Register in `apps/backend/src/lib/runtime/tool-prompts/index.ts`:
   ```typescript
   '<tool-key>:<step_key>': 'src/lib/runtime/tool-prompts/<tool-key>/prompt_<step_key>.md',
   ```

**Placeholder naming convention:**
- Step dependency content: `{{output_step_<stepKey>}}` (e.g. `{{output_step_blog_seo_structure}}`)
- Form fields: `{{fieldName}}` (e.g. `{{titolo}}`)
- Runtime context: `{{tone}}`

---

### Pattern 5: LLM Model Overrides (Optional)

**When:** Different steps benefit from different models.

**Location:** `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts`

```typescript
[createOverrideKey(TOOL_KEY, '<step_key>')]: {
  toolKey: TOOL_KEY,
  stepKey: '<step_key>',
  overrideModelId: '<model_id>',
  reason: '<reason>',
},
```

---

### Pattern 6: Artifact Role Mapping

**When:** Any Tool (required for session projections to classify final vs intermediate steps).

**Location:** `apps/backend/src/lib/runtime/workflow-normalizers.ts`

Add TOOL_KEY to BOTH:
1. `FINAL_STEP_BY_TOOL` map with the final step key.
2. `isStepMappedToolKey` guard.

**Reference:** Lines 16-24, 28-36.

---

### Pattern 7: Form Field Registration for Template Variables

**When:** A form field value needs to reach the backend for prompt template replacement.

**Flow:**
1. Frontend `ToolFormState` includes the field (e.g. `titolo`).
2. `buildBaseGenerationRequest` injects it into `requestInput` (tool-specific spread, C-006 step 3).
3. Backend `assemble<ToolName>Prompt` action reads it from `requestInput` and replaces `{{field}}`.

**Do NOT** add form fields to `extractionPayload` unless the field is genuinely extracted data. Direct-input fields go directly on `requestInput`.

---

## 12. References

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
- `packages/contracts/src/tool-workflows.ts`
- `apps/backend/src/lib/machines/generation-system.actions.ts`
- `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
- `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`
