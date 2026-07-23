---
date_created: 2026-04-26
date_updated: 2026-05-02
status: approved
version: 2.0
last-reviewed: 2026-05-22
next-review-date: 2026-08-22
owner: Frontend Platform Team
title: Frontend Tool Pages — Unified Architecture Specification
tags: [architecture, tool-pages, unification, scalability, registry]
type: specification
---

# Frontend Tool Pages — Unified Architecture Specification

> ⚑ **DDD Reference**: This document describes the Frontend/UI tool page architecture. For canonical domain terminology, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md#frontend--ui-context) — `ToolPage`, `ToolStep`, `ReadinessSnapshot`, `SupportedTool`, `CanonicalToolUiState`
> - [Domain Bounded Context Map](../domain-bounded-context-map.md#frontend--ui-context) — Frontend/UI Context and integration constraints
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — DDD-051, DDD-052 for SessionSummary/Artifacts route and listing boundaries

## Executive Summary

This document specifies the **unified and scalable** architecture for generation tool pages (FunnelPages, NextLand, and future tools). The goal is to **eliminate ~95% code duplication** across tool pages and make adding new tools possible with only configuration + minimalist wrapper (~30 min of work).

### Architectural change

| Aspect | Before (as-is) | After (target) |
|---------|---------------|----------------|
| FunnelPages LOC | ~350 | ~50 |
| NextLand LOC | ~350 (100% dup) | ~50 |
| Duplicated logic | 95% | 0% |
| Adding tool | 5-10 hours | ~30 min |
| State management | 12 useState per tool | 1 centralized hook |
| UI components | Local duplicates | Registry-driven generics |

---

## 1. Architecture Overview

### 1.0 SessionSummary / Artifacts / Projects Boundary (DDD-051, DDD-052)

Tool pages must preserve deterministic navigation and projection boundaries:

| Concern | Canonical FE namespace | Canonical read model | Backend contract |
|---|---|---|---|
| Project contextual history | `/dashboard/projects/{projectId}` | `SessionSummary[]` filtered by project | `GET /api/tools/sessions?projectId={projectId}` |
| Session aggregate navigation | `/sessionsummary`, `/sessionsummary/{sessionId}` | `SessionSummary`, `SessionArtifactGroup` | `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}` |
| Artifact history + single generation detail | `/artifacts`, `/artifacts/{artifactId}` | `GenerationArtifact` | `GET /api/artifacts`, `GET /api/artifacts/{artifactId}` |

Implementation notes:
- Do not treat `/artifacts/{id}` as a session aggregate route.
- Project detail navigation is session-first and must not regress to non-aggregated artifact list semantics.
- Transitional implementations may keep session-summary derivation from artifacts while backend list rollout is in progress.

### 1.1 Key Components

```
frontend/src/features/tools/
├── runtime/
│   ├── tool-form-architecture.ts      # Registry + ToolFormConfig types
│   ├── tool-page-selectors.ts         # Derived page selectors, including tool file instructions
│   ├── tool-ux-state.ts               # Canonical state derivation
│   ├── tool-generation-engine.ts      # Unchanged
│   ├── tools-client.ts                # Unchanged
│   └── useToolForm.ts                 # Hook utilities: useProjectsLoader, useToolUiState, form helpers
├── ui/
│   ├── ToolPageTemplate.tsx           # Orchestration component (~150 lines)
│   ├── ToolFileInstructionsSection.tsx # Registry-driven default-closed accordion for required fields only
│   ├── ToolGenerationFlowVertical.tsx # Unified flow/status right column
│   ├── ToolStatusCard.tsx             # Legacy reusable component
│   ├── ToolStepCard.tsx               # Legacy reusable component
│   └── ToolActionButtons.tsx          # Adaptive CTAs (~100 lines)
├── funnel-pages/pages/
│   └── FunnelPagesToolPage.tsx         # Wrapper only (~50 lines)
├── nextland/pages/
│   └── NextlandToolPage.tsx           # Wrapper only (~50 lines)
└── machines/
  ├── briefing-upload.machine.ts     # Briefing upload/extraction actor
  ├── tool-page.machine.ts           # Page orchestrator + progress sync + flow commands
  └── tool-flow.machine.ts           # Step workflow actor
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────┐
│         ToolPageTemplate (Main Orchestrator)        │
└──────────────────┬──────────────────────────────────┘
                   │
      ┌────────────┼────────────┬──────────────────┐
      │            │            │                  │
        ▼            ▼            ▼                  ▼
      toolPageMachine toolConfig  useToolUiState   derivePrimary
      (briefing actor  lookup      derivation       ActionPolicy
       + flow commands)
      │            │            │                  │
      └────────────┼────────────┴──────────────────┘
                   │
      ┌────────────┴─────────────────────┐
      │                                  │
        ▼                                  ▼
      ToolGenerationFlowVertical       ToolPageTemplate.render()
      (Checklist + progress +         ├─ Form (Project, Model, Tone, Notes)
        step statuses unificati)       ├─ Briefing upload input (events -> machine actor)
                                       ├─ Tool File Instructions Section (registry-driven, default-closed accordion, required fields only)
                      ├─ Flow state da selector macchina
                      └─ ToolActionButtons (CTA adaptivi)
```

---

## 2. Registry Pattern

### 2.1 ToolFormRegistry

Declarative configuration map for each available tool.

**File**: `runtime/tool-form-architecture.ts`

```typescript
export const toolFormRegistry: Record<ToolKey, ToolFormConfig> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    displayName: 'HotLeadFunnel Pages',
    defaultPrompt: 'Generate opt-in page, quiz, and VSL...',
    defaultModel: 'openrouter/auto',
    steps: ['optin', 'quiz', 'vsl'] as const,
    stepDependencies: {
      optin: [],
      quiz: ['optin'],
      vsl: ['optin', 'quiz'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },

  'nextland': {
    toolKey: 'nextland',
    displayName: 'NextLand',
    defaultPrompt: 'Generate landing page and thank you page...',
    defaultModel: 'openrouter/auto',
    steps: ['landing', 'thank_you'] as const,
    stepDependencies: {
      landing: [],
      thank_you: ['landing'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },

  // Example of adding new tool
  'campaign-studio': {
    toolKey: 'campaign-studio',
    displayName: 'Campaign Studio',
    defaultPrompt: 'Generate campaign steps with coherence...',
    defaultModel: 'openrouter/auto',
    steps: ['brief', 'landing', 'email', 'social'] as const,
    stepDependencies: {
      brief: [],
      landing: ['brief'],
      email: ['brief'],
      social: ['email'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
};

export type ToolKey = keyof typeof toolFormRegistry;
// ToolKey is the registry implementation type for the canonical SupportedTool domain concept.
// SupportedTool (UL glossary) = the set of tools live in the system; ToolKey extends it for registry lookups.

export interface ToolFormConfig {
  toolKey: ToolKey;
  displayName: string;
  defaultPrompt: string;
  defaultModel: string;
  steps: readonly string[];
  stepDependencies: Record<string, string[]>;
  defaults: {
    registrySnapshotRef: string;
  };
  // Optional customization points
  customization?: {
    ctaLabels?: {
      startGeneration?: string;
      resumeCheckpoint?: string;
      openLastArtifact?: string;
    };
  };
}
```

### 2.2 Configuration Lookup

```typescript
export function getToolFormConfig(toolKey: ToolKey): ToolFormConfig {
  const config = toolFormRegistry[toolKey];
  if (!config) {
    throw new Error(`Tool '${toolKey}' not registered in toolFormRegistry`);
  }
  return config;
}
```

### 2.3 Tool File Instructions Key-To-Label Matrix (Operational Convergence)

Runtime convergence for DDD-079/DDD-080 is active:

- registry source uses canonical `requiredFieldKeys: ExtractionFieldKey[]`;
- selector output projects keys to localized `ExtractionFieldLabel` values;
- mixed lists (localized labels + raw keys in one list) are removed from Tool Workspace rendering.

Current operational matrix:

| Tool | ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status |
| --- | --- | --- | --- |
| `youtube-lf-script` | `knowledge_content` | Knowledge content | contract-backed |
| `youtube-lf-script` | `avatar` | Avatar | contract-backed |
| `youtube-lf-script` | `pain_point` | Pain point | contract-backed |
| `youtube-lf-script` | `purchase_process_type` | Purchase process type | contract-backed |
| `youtube-lf-script` | `offer` | Offerta | contract-backed |
| `youtube-lf-script` | `proof` | Proof | contract-backed |
| `youtube-lf-script` | `target_duration_minutes` | Target duration (minutes) | contract-backed |
| `youtube-lf-script` | `proprietary_methodology_disclosure` | Proprietary methodology disclosure | contract-backed |
| `funnel-pages` | `funnel_goal` | Obiettivo del funnel | contract-backed |
| `funnel-pages` | `target_audience` | Target | contract-backed |
| `funnel-pages` | `offer` | Offerta | contract-backed |
| `funnel-pages` | `proof` | Proof | contract-backed |
| `funnel-pages` | `primary_cta` | CTA principale | contract-backed |
| `nextland` | `website_goal` | Obiettivo del sito | contract-backed |
| `nextland` | `brand_or_company` | Brand o azienda | contract-backed |
| `nextland` | `target_audience` | Target | contract-backed |
| `nextland` | `offer_or_service` | Offerta o servizio | contract-backed |
| `nextland` | `required_sections` | Sezioni richieste | contract-backed |
| `angle-generator` | `goal` | Obiettivo | contract-backed |
| `angle-generator` | `product_or_service` | Prodotto o servizio | contract-backed |
| `angle-generator` | `market` | Mercato | contract-backed |
| `angle-generator` | `target_audience` | Target | contract-backed |
| `angle-generator` | `pain_point` | Pain point | contract-backed |
| `angle-generator` | `proof` | Proof | contract-backed |
| `angle-generator` | `creative_constraints` | Vincoli creativi | contract-backed |

### 2.4 Tool Input File Requirement Policy (DDD-081)

Tool Workspace setup must be policy-driven through `inputFiles` in `toolFileInstructionsRegistry`.

Canonical requiredness taxonomy:

- `always-required`: first input file (`inputFiles[0]`) and mandatory invariant.
- `required-by-tool-setting`: additional file explicitly blocking readiness/CTA until uploaded.
- `optional-by-tool-setting`: additional file that never blocks readiness/CTA.

Deterministic rules:

- Every `SupportedTool` declares `inputFiles`.
- `inputFiles[0]` must always be `always-required` (fail-fast invariant).
- Every file from index `1..N` must be explicitly classified as `required-by-tool-setting` or `optional-by-tool-setting`.
- Current `angle-generator` policy: `BriefingFile` = `always-required`, `AngleDetectorFile` = `optional-by-tool-setting`.

Readiness outcomes:

- Scenario A (`required complete` + `optional missing`): non-blocking readiness, primary CTA enabled, advisory messaging allowed.
- Scenario B (`all-required` and one missing): blocking readiness, primary CTA disabled, deterministic missing-required list.

Implementation note:

- shared canonical matrix contract: `packages/contracts/src/extraction-fields.ts`.
- frontend projection + compile-time coverage guard: `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts`.
- selector projection path (label-only UI output): `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`.

---

## 3. Canonical UI State Derivation

### 3.1 CanonicalToolUiState

Unified map of the 8 possible UI states for any tool, independent of the specific workflow.

**File**: `runtime/tool-ux-state.ts`

```typescript
export type CanonicalToolUiState =
  | 'draft-empty'              // No briefing loaded
  | 'processing-briefing'      // Upload/extraction in progress
  | 'draft-ready'              // Briefing processed, ready to generate
  | 'prefilled-regenerate'     // Reloaded previous artifact, ready to regenerate
  | 'paused-with-checkpoint'   // Generated some steps, user can resume
  | 'resume-needs-briefing'    // Resuming requires new/updated briefing
  | 'running'                  // Generation active
  | 'completed';               // Generation done

export interface ToolUiDerivationInput {
  uploadStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  extractionContext: ExtractionContext | null;
  generationStatus: 'idle' | 'running' | 'completed' | 'failed';
  lastCheckpoint: Checkpoint | null;
  sourceArtifactId: string | null;
  intent: 'regenerate' | 'resume' | null;
  // New in v2: tool-specific configuration
  toolConfig: ToolFormConfig;
}

export function deriveCanonicalToolUiState(
  input: ToolUiDerivationInput
): CanonicalToolUiState {
  // Logic maps upload + generation + checkpoint state → canonical state
  // Rules:
  // - If uploadStatus === 'uploading' or 'extracting' → 'processing-briefing'
  // - If extractionContext exists and generationStatus === 'idle' → 'draft-ready'
  // - If generationStatus === 'running' → 'running'
  // - If generationStatus === 'completed' → 'completed'
  // - If lastCheckpoint exists and !sourceArtifactId → 'paused-with-checkpoint'
  // - etc.
  
  // Implementation omitted for brevity
}

export type PrimaryActionPolicy =
  | 'start-generation'
  | 'resume-checkpoint'
  | 'regenerate-current-step'
  | 'open-last-artifact'
  | 'disabled';

export function derivePrimaryActionPolicy(
  state: CanonicalToolUiState
): PrimaryActionPolicy {
  // Maps canonical state → primary CTA action
  // E.g., 'draft-ready' → 'start-generation'
}
```

### 3.2 Secondary Action Flags

Determines which secondary CTAs are available:

```typescript
export interface SecondaryActionFlags {
  canRegenerateFromZero: boolean;    // Reset setup and start fresh
  canResetSetup: boolean;             // Clear current state, keep artifact
  canStartNewGeneration: boolean;     // Begin generation for new project
}
```

### 3.3 Operational cancel/resume guardrail (delta 2026-04-28)

- When the user cancels during `running`, the UI must preserve the interrupted step as a local checkpoint (`pausedCheckpointStep`).
- Until the interrupted checkpoint is resumed/completed, the primary policy remains `resume-checkpoint`.
- The `resume-checkpoint` action must relaunch the same interrupted step, not automatically degrade to `start-generation`.
- Before resume, the run prefix/request id must be regenerated to avoid reuse of the cancelled run's requestId.

---

## 4. Composite Hook: useToolForm

### 4.1 Hook Composition

**File**: `runtime/useToolForm.ts`

```typescript
export interface UseToolFormResult {
  // State
  projectId: string | null;
  modelId: string | null;
  toneId: string | null;
  notes: string;
  uploadedFileName: string | null;
  extractionContext: ExtractionContext | null;
  uploadStatus: UploadStatus;
  generationStatus: GenerationStatus;
  currentStepIndex: number;
  currentStepArtifactId: string | null;
  allStepArtifacts: Record<string, Artifact>;
  lastCheckpoint: Checkpoint | null;
  error: Error | null;

  // Derivations
  canonicalUiState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  availableSteps: readonly string[];

  // Actions
  setProject: (projectId: string) => void;
  setModel: (modelId: string) => void;
  setTone: (toneId: string) => void;
  setNotes: (notes: string) => void;
  runNextStep: () => Promise<void>;
  resumeCheckpoint: () => Promise<void>;
  uploadBriefing: (file: File) => Promise<void>;
  openArtifact: (artifactId: string) => void;
  resetSetup: () => void;
}

export function useToolForm(toolKey: ToolKey): UseToolFormResult {
  const config = getToolFormConfig(toolKey);
  const { session } = useAuthSession();
  const { generation, dispatch } = useGeneration();

  // Sub-hooks (extracted, reusable logic)
  const projects = useProjectsLoader(session?.userId);
  const uiState = useToolUiState({
    uploadStatus: /* derived from toolPageMachine briefing actor snapshot */,
    extractionContext: /* from GenerationWorkspaceProvider cache */,
    generationStatus: generation.status,
    lastCheckpoint: generation.lastCheckpoint,
    sourceArtifactId: /* from route */, 
    intent: /* from route */,
    toolConfig: config,
  });

  // Combined state and actions...
  return {
    projectId: /* ... */,
    // ... other state
    canonicalUiState: uiState.canonicalState,
    primaryActionPolicy: uiState.primaryPolicy,
    // ... actions
  };
}
```

### 4.2 Sub-Hooks

**useProjectsLoader**: Loads the current user's project list.

As-is note (delta 2026-05-02): `ToolPageTemplate` no longer uses `useBriefingUpload` as primary source.
The briefing state is commanded by the child actor `briefing-upload.machine` spawned by `tool-page.machine`.
The template sends events (`BRIEFING_FILE_SELECTED`, `BRIEFING_RESET`) and reads actor snapshot via selector.

**useToolUiState**: Invoker per deriveCanonicalToolUiState + derivePrimaryActionPolicy.

---

## 5. Generic UI Components

As-is note (delta 2026-05-02): the runtime right column is unified in `ToolGenerationFlowVertical`.
Sections 5.1 and 5.2 remain as historical/reuse reference, not as current primary composition of `ToolPageTemplate`.

### 5.1 ToolStatusCard

**Purpose**: Unique global feedback card with checklist (4 items).

**Props**:
```typescript
interface ToolStatusCardProps {
  state: CanonicalToolUiState;
  uploadStatus: UploadStatus;
  generationStatus: GenerationStatus;
  currentStepIndex: number;
  totalSteps: number;
  error: Error | null;
}
```

**Render**:
```
┌─────────────────────────────────────────┐
│  📋 Progress Checklist                  │
├─────────────────────────────────────────┤
│  ✓ Briefing processed                   │
│  ⏳ Step 1 of 3 running                 │
│  ⬤ Step 2 pending                       │
│  ⬤ Step 3 pending                       │
└─────────────────────────────────────────┘
```

**Stati badge**: `todo`, `active`, `done`, `error`

### 5.2 ToolStepCard

**Purpose**: Card for individual step with preview area and status.

**Props**:
```typescript
interface ToolStepCardProps {
  step: string;
  stepIndex: number;
  status: 'idle' | 'running' | 'done' | 'error';
  description: string;
  preview: string | null;  // Output artifact content
  artifactId: string | null;
  error: Error | null;
}
```

**Render**:
```
┌──────────────────────────────────────┐
│  [1] Opt-in Page          ✓ DONE     │
├──────────────────────────────────────┤
│  Generate high-converting opt-in...  │
├──────────────────────────────────────┤
│  Preview (scrollable):               │
│  ┌────────────────────────────────┐  │
│  │ [Generated content snippet]    │  │
│  └────────────────────────────────┘  │
│  [💬 Open Artifact]                  │
└──────────────────────────────────────┘
```

### 5.3 ToolActionButtons

**Purpose**: Dynamic CTAs based on state and eligibility.

**Props**:
```typescript
interface ToolActionButtonsProps {
  state: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  onStartGeneration: () => void;
  onResumeCheckpoint: () => void;
  onOpenArtifact: () => void;
  onRegenerateFromZero: () => void;
  onResetSetup: () => void;
}
```

**Logic**:
- Primary CTA always visible, label/action derived from `primaryActionPolicy`
- Secondary CTAs conditionally rendered based on flags
- All buttons respect `canonical state` for disabling

**Example renders**:
```
State: draft-ready
├─ Primary: [🚀 Start Generation]
└─ Secondary: 
   └─ [Resetta setup]

State: running
├─ Primary: [⏸️ Cancel] (disabled)
└─ Secondary: (none)

State: completed
├─ Primary: [💬 Open Last Artifact]
└─ Secondary:
   ├─ [🔄 Rigenera da zero]
   └─ [📝 Nuova generazione]
```

### 5.4 ToolPageTemplate

**Purpose**: Main orchestration component that composes all elements.

**Props**:
```typescript
interface ToolPageTemplateProps {
  toolKey: ToolKey;
  sourceArtifactId?: string;  // For resume/regenerate
  intent?: 'resume' | 'regenerate';
}

Relevant as-is behavior:

- Primary CTA managed for all canonical policies (`start-generation`, `resume-checkpoint`, `regenerate-current-step`, `open-last-artifact`, `disabled`).
- In restore flows, `regenerate-current-step` uses the source step of the restored checkout even when `nextAvailableStep` is null.
- Step start requests pass through `tool-page.machine` with command `REQUEST_STEP_START`; the dispatch side effect is hooked to the pending command in machine context.
```

---

## 6. Tool Page Wrappers

### 6.1 FunnelPagesToolPage

**File**: `funnel-pages/pages/FunnelPagesToolPage.tsx`

```typescript
export const FunnelPagesToolPage = () => {
  return <ToolPageTemplate toolKey="funnel-pages" />;
};
```

**Size**: ~50 lines (including imports, JSDoc)

### 6.2 NextlandToolPage

**File**: `nextland/pages/NextlandToolPage.tsx`

```typescript
export const NextlandToolPage = () => {
  return <ToolPageTemplate toolKey="nextland" />;
};
```

**Size**: ~50 lines

---

## 7. Adding a New Tool

### 7.1 Step-by-Step Checklist

**Time estimate: ~30 minutes** ✅

**1. Add to registry** (`runtime/tool-form-architecture.ts`)
**2. Create page wrapper** (`campaign-studio/pages/CampaignStudioToolPage.tsx`)
**3. Add copy entries** (`app/copy/system.ts`)
**4. Register route** (`app-router.tsx`)
**5. Add navigation entry** (if needed in `appCopy.navigation`)
**6. Test**

**Total: 5 files edited, ~100 lines added** → new tool fully functional ✅

---

## 8. Benefits & Outcomes

### Immediate
✅ **-95% code duplication**: FunnelPages + NextLand consolidated into generics  
✅ **Simpler maintenance**: One source of truth for tool page logic  
✅ **Consistent UX**: All tools use same UI patterns and state machine  
✅ **Type safety**: Centralized types reduce errors  

### Scalability
✅ **New tool in ~30 min**: Just registry entry + wrapper page  
✅ **Reduced onboarding time**: No need to study existing tool code  
✅ **Registry-driven**: Easy A/B testing via config flags  
✅ **Extensible**: Override points for tool-specific customization  

### Technical Debt
✅ **Removed duplicate state logic**: useToolForm centralized  
✅ **Removed duplicate UI components**: ToolPageTemplate generalized  
✅ **Better testability**: Derivation logic separated from rendering  
✅ **Cleaner router**: Minimal page wrappers easily auditable  

---

**Last Updated**: 2026-04-26  
**Status**: Target Architecture (Post-Unification Implementation)