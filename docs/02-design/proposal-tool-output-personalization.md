---
status: draft
version: 3.0
date_created: 2026-07-11
last-reviewed: 2026-07-11
next-review-date: 2026-10-11
owner: Frontend Platform Team & Domain Architecture
type: proposal
tags: [personalization, tools, ux, generation, variants, feedback, hitl, enterprise]
goal: Implement an enterprise-grade, deterministic architecture for tool output personalization, multi-variant generation, and feedback-driven scalability.
---

# Proposal: Enterprise-Grade Tool Output Personalization

## 1. Executive Summary

All 8 currently implemented tools share a fundamental architectural constraint: they act as deterministic `1:1` functions (one input set yields one static output). Currently, the system lacks:

- **Variant Generation**: No ability to generate and compare multiple output paths.
- **Persistent Brand Context**: Tone and style are treated as ephemeral UI selections rather than persistent project assets.
- **Human-In-The-Loop (HITL)**: No capability to pause a workflow, request human approval, and resume.
- **Effectiveness Scalability**: No feedback loop allowing the system to learn from past successful generations.

This proposal introduces a unified, backend-driven architecture to resolve these limitations through declarative personalization, backend fan-out generation, interactive XState steps, and dynamic few-shot prompting.

---

## 2. Architectural Pillars (Cross-Tool)

To avoid frontend fragmentation and maintain strict XState and DDD compliance, the solution relies on 5 architectural pillars. Each concept requires a formal DDD-NNN registration (see §12).

### 2.1 Project Brand Persona (DDD-173)

Preferences are elevated to a `ProjectBrandPersona` tied to a `Project`.
```ts
type ProjectBrandPersona = {
  projectId: string;
  brandVoice: string;
  targetAudience: string;
  wordsToAvoid: string[];
  coreValues: string[];
};
```
**Impact**: When a Project is selected in the Tool Workspace, the backend automatically injects the `ProjectBrandPersona` into the system prompt. No extra fields are needed per-tool.

### 2.2 Registry-Driven Personalization Contract (DDD-174)

Personalization parameters must be **declarative** and defined in the shared contracts (`packages/contracts`).
```ts
type PersonalizationFieldDef = {
  key: string;
  type: 'select' | 'slider' | 'multi-select' | 'boolean';
  label: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
  impactsSteps: ToolStep[]; 
};

type GenerationRequestInput = {
  // ...existing
  personalizationOverrides: Record<string, unknown>;
};
```

### 2.3 Backend-Driven Variant Fan-Out (DDD-175 & DDD-176)

Variant generation must be infrastructure-aware.
- Frontend sends a single `GenerationRequest` with `variantCount: number`.
- Backend (`generationSystemMachine`) handles the fan-out: it invokes `N` parallel stream actors.
- **Idempotency**: `IdempotencyKey` is extended to include `variantIndex`: `(userId, projectId, toolKey, baseIdempotency, variantIndex)`.
- **Quota Policy (DDD-176)**: Generating 3 variants costs `CreditCost * 3`. The `ClaimUsage` command must account for `variantCount`.

### 2.4 Human-In-The-Loop (HITL) Interactive Steps (DDD-177)

We introduce `WorkflowStepType = 'interactive'`.
1. Backend executes Step 1.
2. Backend completes the step, producing a `step` Artifact, but transitions the tool workflow into an `idle_pending_input` state instead of auto-chaining.
3. Frontend renders the artifact in an editable UI.
4. User edits and approves. Frontend dispatches `POST /api/tools/sessions/{id}/step/{key}/submit`.
5. Backend injects the approved content into the dependency graph and resumes Step 2.

### 2.5 Dynamic Few-Shot Prompting / Feedback Loop (DDD-178 & DDD-179)

1. **FeedbackCollector (DDD-178)**: A UI component requests 👍/👎 on finalized artifacts, saving to a `generation_feedback` table.
2. **RAG-lite Injection (DDD-179)**: Before generation, the backend queries the last 2 positive-rated artifacts for this Tool + Project. These are injected into the prompt as `<examples>`.

---

## 3. Per-Tool Personalization Registries

The following configurations will be added to each tool's definition in `packages/contracts/src/tool-workflows.ts` via the `PersonalizationFieldDef` schema.

### 3.1 angle-generator (DDD-180)
| Key | Type | Description / Options |
|---|---|---|
| `channel` | select | meta, google, linkedin, tiktok, email, organic |
| `creativityLevel`| slider | 1 to 10 (1 = proven patterns, 10 = blue ocean/experimental) |
| `contentType` | multi-select | short-form, long-form, headline, email-subject |

### 3.2 meta-ads (DDD-181)
*Note: Uses `WorkflowStepType = 'interactive'` for a new `hook-library` pre-step.*
| Key | Type | Description / Options |
|---|---|---|
| `adFormat` | select | single-image, carousel, video, dynamic |
| `visualDirection`| select | product-focus, lifestyle, UGC, branded, minimal |
| `platformPlacement`| multi-select| feed, story, reels, search, audience-network |
| `ctaStyle` | select | urgent, soft, educational, social-proof, fomo |

### 3.3 geometric (DDD-182)
| Key | Type | Description / Options |
|---|---|---|
| `reportDepth` | select | quick (exec + scoring), detailed, comprehensive (+ PAA + video) |
| `strategicFocus` | select | growth, defense, differentiation, gap-analysis |

### 3.4 blog-article-generator (DDD-183)
*Note: The `blog_seo_structure` step will be converted to `WorkflowStepType = 'interactive'` (Outline approval).*
| Key | Type | Description / Options |
|---|---|---|
| `articleFormat` | select | how-to, listicle, thought-leadership, case-study, pillar-page |
| `targetWordCount`| slider | 500 to 3000 words |
| `includeFaq` | boolean | Append FAQ section |
| `includeMeta` | boolean | Generate Title Tag and Meta Description |

---

## 4. Database Schema Updates

Associated DDDs: `ProjectBrandPersona` (DDD-173), `GenerationFeedback` (DDD-178).

```sql
-- Project Brand Context
CREATE TABLE project_brand_personas (
  project_id       VARCHAR(50) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  brand_voice      TEXT,
  target_audience  TEXT,
  words_to_avoid   JSONB NOT NULL DEFAULT '[]',
  core_values      JSONB NOT NULL DEFAULT '[]',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generation Feedback (RAG source)
CREATE TABLE generation_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  project_id       VARCHAR(50) NOT NULL REFERENCES projects(id),
  tool_key         VARCHAR(50) NOT NULL,
  session_id       VARCHAR(100) NOT NULL,
  artifact_id      VARCHAR(100) NOT NULL,
  rating           VARCHAR(10) NOT NULL CHECK (rating IN ('positive', 'negative')),
  applied_settings JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_feedback_rag ON generation_feedback(project_id, tool_key, rating);
```

---

## 5. Priority Matrix & Implementation Phasing

### Phase 1 (P0) — Foundations & Registry
**Effort**: Medium

| Task | Detail |
|---|---|
| Implement `PersonalizationFieldDef` in `packages/contracts/src/tool-workflows.ts` | Type definition + per-tool registration for angle-generator, meta-ads, geometric, blog-article-generator |
| Build `DynamicPersonalizationForm` in Frontend | Generic renderer that reads `PersonalizationFieldDef[]` and emits `personalizationOverrides` |
| Implement Prompt Injection Contract | Backend maps `personalizationOverrides` → `<personalization_directives>` Markdown block appended to LLM system prompt |
| Frontend wiring | Integrate `DynamicPersonalizationForm` into Tool Workspace Setup Panel for the 4 approved tools |

### Phase 2 (P0) — Project Brand Persona
**Effort**: Low

| Task | Detail |
|---|---|
| DB table `project_brand_personas` | Migration with FK to `projects(id)`, indexed by `project_id` |
| CRUD API | `GET/PUT /api/projects/{id}/brand-persona` (scoped to project ownership) |
| Auto-injection | Backend reads `project_brand_personas` on each generation request and appends `{{brand_persona_context}}` to the LLM prompt |

### Phase 3 (P1) — HITL Interactive Steps
**Effort**: High

| Task | Detail |
|---|---|
| Implement `WorkflowStepType = 'interactive'` | New step type in `tool-workflow-registry.ts`. The `toolWorkflowMachine` transitions to `idle_pending_input` after completion instead of auto-chaining. |
| HITL Submit API | `POST /api/tools/sessions/{id}/step/{key}/submit` — validates artifact ownership, injects edited content into dependency graph, resumes workflow |
| **Wire blog-article-generator** | Convert `blog_seo_structure` step to `interactive`. User edits the H1+H2+H3 outline, approves, then `blog_research` + `blog_article` execute with the confirmed structure. |
| **Wire meta-ads** | Add new `hook-library` `interactive` step before `ads-generation`. Backend generates 10 hook options, user selects 3-5, `ads-generation` uses selected hooks. |
| `InteractiveStepEditor` Frontend component | Generic Markdown editor that fetches the intermediate artifact, allows mutation, and dispatches the submit mutation. |

### Phase 4 (P1) — Backend Variant Fan-out
**Effort**: High

| Task | Detail |
|---|---|
| `IdempotencyCoordinator` update | `buildIdempotencyKey` extends to `(userId, projectId, toolKey, baseIdempotency, variantIndex)` |
| `UsageMachine` / `ClaimUsage` update | Multiply `CreditCost` by `variantCount`. Reject if insufficient credits for `CreditCost * N`. |
| `GenerationSystemMachine` update | `generating` state spawns N parallel stream actors instead of 1 when `variantCount > 1` |
| `VariantComparisonView` Frontend | Tabbed/side-by-side component receiving N artifact streams. Primary CTA: "Select as Final". |
| Wire `variantCount` selector | Add to Setup Panel for all 4 approved tools (default 1, max 3) |

### Phase 5 (P2) — Feedback & RAG-lite
**Effort**: Medium

| Task | Detail |
|---|---|
| `MiniFeedback` UI | 👍/👎 component in Workflow Panel shown on `completed` state |
| DB table `generation_feedback` | Migration with FK chain: `user_id → users`, `project_id → projects`, indexed by `(project_id, tool_key, rating)` |
| `DynamicFewShotInjection` | Before prompt resolution, backend queries: "Get last 2 positive-rated artifacts for this Tool + Project". Injects raw content as `<examples>` block in system prompt. |
| Backfill on existing artifacts | Initial RAG population: treat all existing artifacts with `status = completed` as neutral (not injected). Only explicit positive feedback triggers injection. |

---

## 6. Decision Log

| Item | Vote |
|---|---|
| 1 — `ProjectBrandPersona` (DDD-173) | ✅ Approved |
| 2 — `PersonalizationFieldDef` (DDD-174) | ✅ Approved |
| 3 — `personalizationOverrides` field | ✅ Approved |
| 4 — Prompt Injection Contract | ✅ Approved |
| 5 — Backend Variant Fan-Out (DDD-175) | ✅ Approved |
| 6 — Idempotency extended with `variantIndex` | ✅ Approved |
| 7 — Quota Policy multi-variant (DDD-176) | ✅ Approved |
| 8 — `WorkflowStepType = 'interactive'` (DDD-177) | ✅ Approved |
| 9 — HITL Submit API | ✅ Approved |
| 10 — `GenerationFeedback` (DDD-178) | ✅ Approved |
| 11 — `DynamicFewShotInjection` (DDD-179) | ✅ Approved |
| 12 — funnel-pages personalization (DDD-184) | ❌ Rejected |
| 13 — nextland personalization (DDD-185) | ❌ Rejected |
| 14 — youtube-lf-script personalization + interactive (DDD-186) | ❌ Rejected |
| 15 — angle-generator personalization (DDD-180) | ✅ Approved |
| 16 — meta-ads personalization + interactive (DDD-181) | ✅ Approved |
| 17 — youtube-description personalization (DDD-187) | ❌ Rejected |
| 18 — geometric personalization (DDD-182) | ✅ Approved |
| 19 — blog-article-generator personalization + interactive (DDD-183) | ✅ Approved |
| 20 — Implementation phasing | ✅ Approved as remodulated in §5 |

---

## 7. Implementation Notes

### 7.1 Frontend (`apps/frontend/`)
- **`DynamicPersonalizationForm`**: A generic component that reads `PersonalizationFieldDef[]` from the tool registry and renders the appropriate Formik controls (Sliders, Selects, Checkboxes).
- **`VariantComparisonView`**: A new tabbed or side-by-side component for viewing concurrent artifacts. Includes a primary CTA: "Select as Final".
- **`InteractiveStepEditor`**: A generic Markdown editor panel that appears when the backend halts an `interactive` step, allowing the user to mutate the intermediate artifact payload before resuming.

### 7.2 Backend (`apps/backend/`)
- **Idempotency Modification**: `buildIdempotencyKey` must ingest `variantIndex`.
- **Usage Modification**: `ClaimUsage` must multiply `CreditCost` by `variantCount`.
- **Interactive State**: `toolWorkflowMachine` requires a new state `idle_pending_input` reachable only by `interactive` step types.
- **Prompt Resolution**: `tool-prompts.ts` must be updated to append `{{brand_persona_context}}`, `{{personalization_directives}}`, and `{{positive_examples_rag}}`.

---

## 8. Unification with Existing Frontend Assets

Before introducing new components, each proposal item must be checked against existing FE surfaces (copy registry, UI primitives, component library, and machine contracts). Below is the unification map.

### 8.1 Copy Reuse Map (`appCopy.ui` from `apps/frontend/src/app/copy/system.ts`)

| Proposal Key | Existing Copy Key | Status | Action |
|---|---|---|---|
| `DynamicPersonalizationForm` labels per field | `appCopy.ui.toolPage.form.*` (`modelLabel`, `toneLabel`, etc.) | ✅ Reuse | New `personalizationFields` keys must be added to `appCopy.ui.toolPage.personalization` |
| `brandVoice` label (ProjectBrandPersona) | None | ❌ New | Add `appCopy.ui.brandProfile.*` section (brandVoice, targetAudience, wordsToAvoid, coreValues) |
| `awaiting-approval` status text | `appCopy.ui.toolPage.flow.statusByCanonicalState` | ❌ Extend | Add `'awaiting-approval': 'In attesa di approvazione…'` + aria label in `progressAria` |
| `variantCount` label + quota feedback | `appCopy.ui.toolPage.form.copyLengthFormat` (existing meta-ads pattern) | ✅ Pattern | Follow `copyLengthFormat` pattern: label + options. Add quota warning copy in `appCopy.ui.toolPage.form.variantCount` |
| `MiniFeedback` + / - rating | None | ❌ New | Add `appCopy.ui.toolPage.feedback.*` section (useful, needsImprovement, ratingSubmitted) |
| `InteractiveStepEditor` approve CTA | `appCopy.ui.actions` (existing `cancel`, `retry`) | ✅ Reuse | Use `actions.approve` or extend with `appCopy.ui.toolPage.interactiveStep.*` |
| `descriptionStyle`, `seoDepth`, etc. (per-tool fields) | `appCopy.ui.toolPage.form.videoTitleLabel` etc. (for existing direct-input fields) | ❌ New | Each `PersonalizationFieldDef` carries its own `label` in the registry — no `appCopy` key needed. Labels live in contracts. |
| Primary action policy `'awaiting-approval'` | `appCopy.ui.toolPage.primaryActionPolicy.*` | ❌ Extend | Add `awaitingApprovalLabel: "Approvazione richiesta"` + tooltip |
| `VariantComparisonView` CTA "Select as Final" | None | ❌ New | Add `appCopy.ui.toolPage.variantComparison.*` |

### 8.2 Component Reuse Map

| Proposal Component | Existing Component | Status | Integration Strategy |
|---|---|---|---|
| `DynamicPersonalizationForm` | None (hardcoded `if (isMetaAdsTool)` blocks in `ToolPageTemplate`) | ❌ New | Replace the `if (isMetaAdsTool)` / `if (isGeometricTool)` / `if (isBlogArticleGeneratorTool)` hardcoded blocks with a generic `DynamicPersonalizationForm` that reads `PersonalizationFieldDef[]` from the tool registry. This is the **primary unification** — it eliminates the ~500 lines of conditional `<Controller>` blocks in `ToolPageTemplate.tsx`. |
| `VariantCountSelector` | `copyLengthFormat` select (meta-ads pattern) | ✅ Pattern | Reuse the MUI `<TextField select>` pattern already established for `copyLengthFormat`. Place inside `DynamicPersonalizationForm`. |
| `VariantComparisonView` | None | ❌ New | Rendered INSIDE `ToolGenerationFlowVertical` when `variantCount > 1`. The Workflow Panel switches from progress display to tabbed artifact preview. |
| `InteractiveStepEditor` | None | ❌ New | Rendered INSIDE `ToolGenerationFlowVertical` when `canonicalState === 'awaiting-approval'`. The Workflow Panel switches from progress display to Markdown editor. |
| `MiniFeedback` | None | ❌ New | Rendered as additional section INSIDE `ToolGenerationFlowVertical` below context card, only when `canonicalState === 'completed'`. |
| `BrandProfileEditor` | `AdminUsersPage` form pattern | ✅ Pattern | Follow the admin page pattern: dedicated route, form with save mutation, global feedback message on success. Use existing `Surface`, `Stack`, `Button` primitives. |
| Primary CTA | `ToolActionButtons.tsx` + `derivePrimaryActionLabel` | ✅ Reuse | Extend `derivePrimaryActionLabel` to handle `'awaiting-approval'` policy. Add `'awaiting-approval'` to `CanonicalToolUiState`. The existing `PrimaryActionPolicy` and `CanonicalToolUiState` union types need this new value. |
| `ToolGenerationFlowVertical` | Existing (props: `canonicalState`, `projectName`, `errorMessage`, `inputFilePayload`, `apiAcquisitionPayload`, `generationProgress`, `primaryActionCta`) | ✅ Extend | Add new optional props: `interactiveStep`, `variants`, `feedbackRating`. The component renders different sub-views based on `canonicalState` + these new props, but the existing `ui-fv-dashboard` structure is preserved. |

### 8.3 Zod Validation & Form State Unification

**Problem**: `ToolPageTemplate.tsx` defines a single `ToolPageFormValues` type and Zod schema that enumerates every possible tool field. Every new tool or new field requires editing these types. This is not scalable.

**Solution**: The `PersonalizationFieldDef` registry must drive Zod validation.

```ts
// Contracts-level: each PersonalizationFieldDef generates a Zod primitive
const buildPersonalizationSchema = (defs: PersonalizationFieldDef[]): Record<string, z.ZodTypeAny> => {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const def of defs) {
    switch (def.type) {
      case 'select': shape[def.key] = z.string(); break;
      case 'slider': shape[def.key] = z.number().min(1).max(10); break;
      case 'multi-select': shape[def.key] = z.array(z.string()); break;
      case 'boolean': shape[def.key] = z.boolean(); break;
    }
  }
  return shape;
};

// The new form state field
type ToolPageFormValues = {
  // ... existing core fields (projectId, model, tone)
  personalizationOverrides: Record<string, unknown>;
};
```

### 8.4 Machine State Unification

| Proposal Change | Existing Machine | Impact |
|---|---|---|
| New canonical state `'awaiting-approval'` | `CanonicalToolUiState` in `tool-ux-state.ts` | Add value to union type |
| New policy `'awaiting-approval'` | `PrimaryActionPolicy` in `tool-ux-state.ts` | Add value to union type |
| `pendingInputStep` in ViewModel | `ToolPageViewModel` in `tool-page.machine.ts` | Add optional field to view model type |
| `VARIANT_SELECTED` event | `toolPageMachine` events | New event |
| `MANUAL_APPROVAL_SUBMITTED` event | `toolPageMachine` events | New event |
| `variantCount` in GenerationRequest | `GenerationRequestInput` in contracts | Extend existing interface |
| `personalizationOverrides` in GenerationRequest | `GenerationRequestInput` in contracts | Extend existing interface |

---

## 9. GUI Integration Specifications

This section defines the deterministic mapping between each approved architectural item and its GUI surface. Each entry specifies: **Component** (React name), **Location** (which panel/route), **Trigger** (what user action activates it), **State Mapping** (XState event flow), and **Wireframe** (ASCII layout).

### 9.1 DynamicPersonalizationForm — Registry-Driven Controls

| Property | Specification |
|---|---|
| **Location** | Tool Workspace Page → Setup Panel (left column). Rendered below the `notes` textarea and above the primary CTA button. |
| **Trigger** | On mount, reads `toolFormRegistry[toolKey].personalizationFields: PersonalizationFieldDef[]`. Renders nothing (null) if the array is empty or undefined. |
| **Behavior** | Each `PersonalizationFieldDef` becomes a labeled control. All controls are uncontrolled until user interaction, then emit changes to local form state. |
| **Form State** | `formState.personalizationOverrides: Record<string, unknown>` — merged into `buildBaseGenerationRequest` as `input.personalizationOverrides`. |

```
┌─────────────────────────────────────────────┐
│  Setup Panel                                │
│                                             │
│  [Project Select] ████████████████          │
│  [Briefing Upload] ████████████████          │
│                                             │
│  ┌─ Personalization ─────────────────────┐  │
│  │                                        │  │
│  │  Channel:  [meta ⌄]                   │  │
│  │  Creativity Level:                     │  │
│  │  Proven ────●────────── Blue Ocean     │  │
│  │  Variant Count:  [1 ⌄]  (1-3)         │  │
│  │  (3 variants = 3 credits)              │  │
│  └────────────────────────────────────────┘  │
│                                             │
│  [🚀 Avvia la generazione]                  │
└─────────────────────────────────────────────┘
```

### 9.2 VariantCountSelector — Multi-Variant Quantity Control

| Property | Specification |
|---|---|
| **Location** | Inside `DynamicPersonalizationForm` as the last field. Always visible when `variantCount` is declared in the tool's `PersonalizationFieldDef`. |
| **Control** | MUI `<Select>` with options `1`, `2`, `3` (hard max cap at 3). Default: `1`. |
| **Quota Feedback** | On change, reads `toolFormRegistry[toolKey].creditCost` and displays inline text: `"{N} varianti = {N * creditCost} crediti"`. If `MonthlyCreditsUsed + (N * creditCost) > CreditQuota`, the variant selector remains functional but the primary CTA shows a tooltip warning. |

### 9.3 VariantComparisonView — Multi-Result Selection

| Property | Specification |
|---|---|
| **Location** | Tool Workspace Page → Workflow Panel (right column). Replaces the default `ToolGenerationFlowVertical` content when `variantCount > 1` AND `canonicalState === 'completed'`. |
| **Selection CTA** | Below the preview: a primary CTA `[Select as Final]` per tab. Clicking emits `VARIANT_SELECTED` event to `toolPageMachine` with payload `{ variantIndex: number }`. |
| **Feedback Implicit** | The selected variant index is recorded in `generation_feedback` as a positive rating for that artifact. |

```
┌──────────────────────────────────────────────┐
│  Workflow Panel                              │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │  [Variant 1] [Variant 2] [Variant 3]     ││
│  ├──────────────────────────────────────────┤│
│  │                                          ││
│  │  ## Generated Content                    ││
│  │  Lorem ipsum dolor sit amet...           ││
│  │                                          ││
│  │  [📋 Select as Final]                    ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### 9.4 InteractiveStepEditor — Human-In-The-Loop Approval

| Property | Specification |
|---|---|
| **Location** | Tool Workspace Page → Workflow Panel (right column). Replaces the entire Workflow Panel content when `toolPageMachine` is in `'awaiting-approval'`. |
| **Trigger** | Backend completes an `interactive` step, transitions workflow to `idle_pending_input`. `frontendStreamMachine` receives a terminal event `{ type: 'terminal', stepType: 'interactive', artifactId }`. The FE detects `pendingInputStep !== null` from the machine viewModel and switches to editor mode. |
| **Primary CTA** | `[Approve & Continue]` — dispatches `POST /api/tools/sessions/{sessionId}/step/{stepKey}/submit` with body `{ editedContent: string }`. On success, sends `STEP_DONE` to machine. |
| **Secondary CTA** | `[Regenerate Step]` — dispatches `REQUEST_STEP_START` for the same step. |

```
┌──────────────────────────────────────────────┐
│  Workflow Panel                              │
│                                              │
│  ⏳ Step 1 completed — Your input needed     │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │  Edit the generated outline below:       ││
│  │  ┌────────────────────────────────────┐  ││
│  │  │ # H1: Article Title                │  ││
│  │  │ ## H2: Introduction                │  ││
│  │  └────────────────────────────────────┘  ││
│  │                                          ││
│  │  [✅ Approve & Continue]                 ││
│  │  [🔄 Regenerate Step]   [✕ Cancel]       ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### 9.5 MiniFeedback — Per-Artifact Rating Component

| Property | Specification |
|---|---|
| **Location** | Workflow Panel, rendered below the artifact preview, inside a thin card. |
| **Visibility** | Only visible when `canonicalState === 'completed'`. |
| **Interaction** | Click 👍 → `POST /api/user/profile/feedback`. On success, the 👍 button becomes filled/accented. Once a rating is submitted, the component locks to read-only. |

```
┌──────────────────────────────────────┐
│  Was this result useful?             │
│                                      │
│  [👍 Utile]  [👎 Da migliorare]     │
└──────────────────────────────────────┘
```

### 9.6 ProjectBrandPersona Editor — Brand Settings Page

| Property | Specification |
|---|---|
| **Location** | `/dashboard/projects/{projectId}/brand` — new route under Project settings. |
| **Form Layout** | Four fields: `brandVoice` (textarea), `targetAudience` (textarea), `wordsToAvoid` (chip input), `coreValues` (chip input). |
| **Save** | `PUT /api/projects/{id}/brand-persona` with the full object. |

---

## 10. Rejected Items

The following per-tool personalization registries were proposed and rejected. They are preserved here for future reference but are explicitly **out of scope** for this proposal's implementation.

### 10.1 funnel-pages (DDD-184) — ❌ Rejected
| Key | Type | Description / Options |
|---|---|---|
| `visualStyle` | select | minimal, bold, corporate, playful, luxury |
| `conversionGoal` | select | lead-capture, webinar-reg, free-trial, direct-sales |
| `pageLength` | select | squeeze-page, standard, long-form-story |
| `hookStrategy` | select | PAS (Problem-Agitate-Solve), story, social-proof, direct |

### 10.2 nextland (DDD-185) — ❌ Rejected
| Key | Type | Description / Options |
|---|---|---|
| `sitePersonality` | select | luxury, startup, educational, e-commerce, local-business |
| `navigationStyle` | select | single-page, multi-page, sticky-cta |
| `componentLibrary` | multi-select | hero, proof, FAQ, pricing, testimonial, blog-preview |

### 10.3 youtube-lf-script (DDD-186) — ❌ Rejected
*Proposed `WorkflowStepType = 'interactive'` for `packaging` (Hook selection).*
| Key | Type | Description / Options |
|---|---|---|
| `videoFormat` | select | solo-talking-head, interview, screen-share, voiceover-broll |
| `hookApproach` | select | question, statistic, story, contrarian, curiosity-gap |
| `ctaDensity` | select | single-soft, single-hard, multiple, none |
| `retentionPattern` | select | loop-recap, ladder, spiral, sandwich |

### 10.4 youtube-description (DDD-187) — ❌ Rejected
| Key | Type | Description / Options |
|---|---|---|
| `descriptionStyle` | select | professional, conversational, hype, educational |
| `seoDepth` | select | light, balanced, heavy |
| `descriptionLength` | select | short (~150), medium (~350), long (~700) |
| `featuredSnippet` | boolean | Optimize for Google Featured Snippets |

---

## 11. Acceptance Gates

1. **Contracts Integrity**: `npm run typecheck` passes after adding `PersonalizationFieldDef` to shared contracts.
2. **Quota Enforcement**: Requesting 3 variants of a 1-credit tool correctly claims 3 credits via `RedisQuotaRepository`.
3. **Idempotency Stability**: Requesting variants does not trigger `idempotency_conflict` errors.
4. **Interactive Workflow**: A user can pause a workflow at an `interactive` step, close the browser, return via `/sessionsummary`, edit the artifact, and successfully resume the generation chain.
5. **RAG Injection**: Backend logs confirm that rating an artifact positively successfully injects its content as an `<example>` in the very next generation for the same project.

---

## 12. DDD-NNN Reference Index

This section lists the concepts introduced by this proposal that have been registered in the `domain-naming-decision-log.md`.

| DDD-NNN | Term | Type | Bounded Context | Status | Description |
|---|---|---|---|---|---|
| DDD-173 | `ProjectBrandPersona` | Entity | Auth, Generation | ✅ Approved | Persistent branding rules tied to a `Project`. Replaces user-level tone preferences. |
| DDD-174 | `PersonalizationFieldDef` | Value Object | Cross-Context | ✅ Approved | Declarative contract defining dynamic UI controls and backend prompt injection directives. |
| DDD-175 | `VariantGenerationFanOut` | Process | Generation | ✅ Approved | Backend orchestration pattern where one `GenerationRequest` spawns `N` concurrent stream actors. |
| DDD-176 | `VariantCreditCostPolicy` | Policy | Usage/Quota | ✅ Approved | Rule: Multi-variant requests consume `CreditCost * variantCount`. Extends `ClaimUsage` command. |
| DDD-177 | `interactive` (Step Type) | Value Object | Generation | ✅ Approved | Extension of `WorkflowStepType`. A step that produces an intermediate artifact, pauses the workflow (`idle_pending_input`), and requires a frontend `POST /submit` mutation to resume. |
| DDD-178 | `GenerationFeedback` | Entity | Generation, Frontend | ✅ Approved | Granular rating (+/-) of a finalized artifact. Realizes the `ArtifactLearningFeedbackLoop` (DDD-098). |
| DDD-179 | `DynamicFewShotInjection` | Process | Generation | ✅ Approved | Automatic retrieval of `GenerationFeedback` history to inject past successful artifacts as prompt `<examples>`. |
| DDD-180 | angle-generator Personalization | Policy | Frontend | ✅ Approved | Registration of `channel`, `creativityLevel`, `contentType`. |
| DDD-181 | meta-ads Personalization | Policy | Frontend | ✅ Approved | Registration of `adFormat`, `visualDirection`, `platformPlacement`, `ctaStyle`, plus `interactive` Hook Library step. |
| DDD-182 | geometric Personalization | Policy | Frontend | ✅ Approved | Registration of `reportDepth`, `strategicFocus`. |
| DDD-183 | blog-article-generator Personalization | Policy | Frontend | ✅ Approved | Registration of `articleFormat`, `targetWordCount`, `includeFaq`, `includeMeta`, plus `interactive` Outline step. |
| DDD-184 | funnel-pages Personalization | Policy | Frontend | ❌ Rejected | Registration of `visualStyle`, `conversionGoal`, `pageLength`, `hookStrategy` via `PersonalizationFieldDef`. See §10.1. |
| DDD-185 | nextland Personalization | Policy | Frontend | ❌ Rejected | Registration of `sitePersonality`, `navigationStyle`, `componentLibrary` via `PersonalizationFieldDef`. See §10.2. |
| DDD-186 | youtube-lf-script Personalization | Policy | Frontend | ❌ Rejected | Registration of `videoFormat`, `hookApproach`, `ctaDensity`, `retentionPattern`, plus `interactive` Hook step. See §10.3. |
| DDD-187 | youtube-description Personalization | Policy | Frontend | ❌ Rejected | Registration of `descriptionStyle`, `seoDepth`, `descriptionLength`, `featuredSnippet`. See §10.4. |
