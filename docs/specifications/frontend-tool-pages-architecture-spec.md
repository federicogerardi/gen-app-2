---
date_created: 2026-04-26
date_updated: 2026-04-26
status: Target (post-unification)
version: 2.0
title: Frontend Tool Pages — Unified Architecture Specification
tags: [architecture, tool-pages, unification, scalability, registry]
---

# Frontend Tool Pages — Unified Architecture Specification

## Executive Summary

Questo documento specifica l'architettura **unificata e scalabile** per le pagine dei tool di generazione (FunnelPages, NextLand, e futuri tool). L'obiettivo è **eliminare ~95% duplicazione di codice** tra tool page e rendere l'aggiunta di nuovi tool possibile con sola configurazione + wrapper minimalista (~30 min di lavoro).

### Cambio architetturale

| Aspetto | Prima (as-is) | Dopo (target) |
|---------|---------------|----------------|
| FunnelPages LOC | ~350 | ~50 |
| NextLand LOC | ~350 (100% dup) | ~50 |
| Logica duplicata | 95% | 0% |
| Aggiungere tool | 5-10 ore | ~30 min |
| State management | 12 useState per tool | 1 hook centralized |
| UI componenti | Locali duplicate | Registry-driven generici |

---

## 1. Architecture Overview

### 1.1 Componenti Chiave

```
frontend/src/features/tools/
├── runtime/
│   ├── tool-form-architecture.ts      # Registry + ToolFormConfig types
│   ├── tool-ux-state.ts               # Canonical state derivation
│   ├── tool-generation-engine.ts      # Unchanged
│   ├── tools-client.ts                # Unchanged
│   └── useToolForm.ts                 # Composite hook: useProjectsLoader, useBriefingUpload, useToolUiState
├── ui/
│   ├── ToolPageTemplate.tsx           # Orchestration component (~150 lines)
│   ├── ToolStatusCard.tsx             # Global feedback card (~80 lines)
│   ├── ToolStepCard.tsx               # Per-step card + preview (~120 lines)
│   └── ToolActionButtons.tsx          # Adaptive CTAs (~100 lines)
├── funnel-pages/pages/
│   └── FunnelPagesToolPage.tsx         # Wrapper only (~50 lines)
├── nextland/pages/
│   └── NextlandToolPage.tsx           # Wrapper only (~50 lines)
└── machines/
    └── tool-flow.machine.ts           # Unchanged
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
  useToolForm   toolConfig   useToolUiState   derivePrimary
  (12 useState   lookup       derivation       ActionPolicy
   → centralized)
      │            │            │                  │
      └────────────┼────────────┴──────────────────┘
                   │
      ┌────────────┴─────────────────────┐
      │                                  │
      ▼                                  ▼
  ToolStatusCard                   ToolPageTemplate.render()
  (Checklist + global            ├─ Form (Project, Model, Tone, Notes)
   feedback)                     ├─ BriefingUpload
                                 ├─ ToolStepCard[] (per-step preview)
                                 └─ ToolActionButtons (CTA adaptivi)
```

---

## 2. Registry Pattern

### 2.1 ToolFormRegistry

Mappa dichiarativa di configurazione per ogni tool disponibile.

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

---

## 3. Canonical UI State Derivation

### 3.1 CanonicalToolUiState

Mappa unificata dei 8 stati UI possibili per qualsiasi tool, indipendente dal workflow specifico.

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
  uploadStatus: 'idle' | 'uploading' | 'extracting' | 'review' | 'failed';
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

Determina quali CTA secondari sono disponibili:

```typescript
export interface SecondaryActionFlags {
  canRegenerateFromZero: boolean;    // Reset setup and start fresh
  canResetSetup: boolean;             // Clear current state, keep artifact
  canStartNewGeneration: boolean;     // Begin generation for new project
}
```

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
  const briefing = useBriefingUpload(session?.userId);
  const uiState = useToolUiState({
    uploadStatus: briefing.status,
    extractionContext: briefing.extractionContext,
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

**useProjectsLoader**: Carica lista progetti dell'utente corrente.

**useBriefingUpload**: Gestisce upload file, estrazione, e storage.

**useToolUiState**: Invoker per deriveCanonicalToolUiState + derivePrimaryActionPolicy.

---

## 5. Generic UI Components

### 5.1 ToolStatusCard

**Scopo**: Card univoca di feedback globale con checklist (4 item).

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

**Scopo**: Card per singolo step con preview area e stato.

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

**Scopo**: CTA dinamici basati su state e eligibility.

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

**Scopo**: Orchestrazione main component che compone tutti gli elementi.

**Props**:
```typescript
interface ToolPageTemplateProps {
  toolKey: ToolKey;
  sourceArtifactId?: string;  // For resume/regenerate
  intent?: 'resume' | 'regenerate';
}
```

**Render**:
```jsx
export function ToolPageTemplate({
  toolKey,
  sourceArtifactId,
  intent,
}: ToolPageTemplateProps) {
  const toolForm = useToolForm(toolKey);
  const config = getToolFormConfig(toolKey);

  if (!toolForm) return <LoadingSpinner />;

  return (
    <Surface>
      <ToolStatusCard
        state={toolForm.canonicalUiState}
        uploadStatus={toolForm.uploadStatus}
        generationStatus={toolForm.generationStatus}
        currentStepIndex={toolForm.currentStepIndex}
        totalSteps={config.steps.length}
        error={toolForm.error}
      />

      <form>
        <ProjectSelector
          value={toolForm.projectId}
          onChange={toolForm.setProject}
        />
        <ModelSelector
          value={toolForm.modelId}
          onChange={toolForm.setModel}
        />
        <ToneSelector
          value={toolForm.toneId}
          onChange={toolForm.setTone}
          optional
        />
        <NotesInput
          value={toolForm.notes}
          onChange={toolForm.setNotes}
          optional
        />
        <BriefingUpload
          status={toolForm.uploadStatus}
          fileName={toolForm.uploadedFileName}
          onUpload={toolForm.uploadBriefing}
        />
      </form>

      <div className="steps-grid">
        {config.steps.map((step, idx) => (
          <ToolStepCard
            key={step}
            step={step}
            stepIndex={idx}
            status={/* derive from currentStepIndex */}
            description={appCopy.ui.steps[step]?.description}
            preview={toolForm.allStepArtifacts[step]?.preview}
            artifactId={toolForm.allStepArtifacts[step]?.id}
            error={
              toolForm.currentStepIndex === idx
                ? toolForm.error
                : null
            }
          />
        ))}
      </div>

      <ToolActionButtons
        state={toolForm.canonicalUiState}
        primaryActionPolicy={toolForm.primaryActionPolicy}
        secondaryActionFlags={toolForm.secondaryActionFlags}
        onStartGeneration={toolForm.runNextStep}
        onResumeCheckpoint={toolForm.resumeCheckpoint}
        onOpenArtifact={() => /* navigate to artifact */}
        onRegenerateFromZero={() => /* reset and start */}
        onResetSetup={toolForm.resetSetup}
      />
    </Surface>
  );
}
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
```typescript
'campaign-studio': {
  toolKey: 'campaign-studio',
  displayName: 'Campaign Studio',
  defaultPrompt: 'Generate campaign steps...',
  defaultModel: 'openrouter/auto',
  steps: ['brief', 'landing', 'email', 'social'] as const,
  stepDependencies: {
    brief: [],
    landing: ['brief'],
    email: ['brief'],
    social: ['email'],
  },
  defaults: { registrySnapshotRef: 'snapshot:default' },
},
```

**2. Create page wrapper** (`campaign-studio/pages/CampaignStudioToolPage.tsx`)
```typescript
export const CampaignStudioToolPage = () => (
  <ToolPageTemplate toolKey="campaign-studio" />
);
```

**3. Add copy entries** (`app/copy/system.ts`)
```typescript
campaignStudio: {
  title: 'Campaign Studio',
  description: 'Generate multi-step campaigns...',
  // Per-step labels (optional but recommended)
  steps: {
    brief: 'Campaign Brief',
    landing: 'Landing Page',
    email: 'Email Sequence',
    social: 'Social Media Posts',
  },
},
```

**4. Register route** (`app-router.tsx`)
```typescript
{
  path: '/tools/campaign-studio',
  element: <CampaignStudioToolPage />,
},
```

**5. Add navigation entry** (if needed in `appCopy.navigation`)

**6. Test**
```sh
npm --prefix frontend run build
npm --prefix frontend run test
```

**Total: 5 files edited, ~100 lines added** → new tool fully functional ✅

---

## 8. Type Contracts

### 8.1 ToolFormState

```typescript
export interface ToolFormState {
  // Form inputs
  projectId: string | null;
  modelId: string | null;
  toneId: string | null;
  notes: string;

  // Upload state
  uploadedFileName: string | null;
  uploadStatus: UploadStatus;
  extractionContext: ExtractionContext | null;

  // Generation state
  generationStatus: GenerationStatus;
  currentStepIndex: number;
  allStepArtifacts: Record<string, Artifact>;
  lastCheckpoint: Checkpoint | null;

  // Derivations (NEW in v2)
  canonicalUiState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;

  // Error state
  error: Error | null;
}
```

### 8.2 ToolFormSubmitData

```typescript
export interface ToolFormSubmitData {
  toolKey: ToolKey;
  projectId: string;
  step: string;
  modelId: string;
  tone: string;
  notes: string;
  extractionPayload: {
    briefingContent: string;
    processedContext: Record<string, unknown>;
  };
  stepDependencyArtifactIds: Record<string, string>;
  generationRequest: GenerationRequest;
}
```

---

## 9. Copy System Integration

### 9.1 Editorial Copy (`appCopy.editorial.tools`)

Per tool:

```typescript
editorial: {
  tools: {
    funnelPages: {
      title: 'HotLeadFunnel Pages',
      description: 'Generate high-converting...',
    },
    nextland: {
      title: 'NextLand',
      description: 'Generate landing pages...',
    },
    campaignStudio: {
      title: 'Campaign Studio',
      description: 'Generate multi-step campaigns...',
    },
  },
},
```

### 9.2 UI State Labels (`appCopy.ui.states`)

Generic UI state descriptors (used by ToolStatusCard):

```typescript
ui: {
  states: {
    draftEmpty: 'Ready to upload briefing',
    processingBriefing: 'Processing briefing...',
    draftReady: 'Ready to generate',
    runningGeneration: 'Generation in progress...',
    completed: 'Generation complete',
  },
  steps: {
    // Per-tool step descriptions (optional)
    optin: { label: 'Opt-in', description: 'Generate opt-in page...' },
    quiz: { label: 'Quiz', description: 'Generate quiz flow...' },
    vsl: { label: 'VSL', description: 'Generate VSL script...' },
  },
},
```

---

## 10. Migration Path (from as-is to target)

### Phase 1: Types & Architecture (30 min)
- [ ] Extend ToolFormState, ToolUiDerivationInput in tool-form-architecture.ts
- [ ] Add new types in primitives (ToolStatusCardProps, ToolStepCardProps, etc.)

### Phase 2: Runtime Hooks (45 min)
- [ ] Complete useToolForm composition
- [ ] Add useToolUiState derivation

### Phase 3: UI Components (2-3 hours)
- [ ] Implement ToolStatusCard, ToolStepCard, ToolActionButtons, ToolPageTemplate

### Phase 4: Page Wrapper Refactor (45 min)
- [ ] Simplify FunnelPagesToolPage → wrapper only
- [ ] Simplify NextlandToolPage → wrapper only
- [ ] Update app-router imports

### Phase 5: Copy System & Editorial (30 min)
- [ ] Add UI state labels to appCopy
- [ ] Add per-step descriptions

### Phase 6: Testing & Validation (1 hour)
- [ ] Build validation check
- [ ] Test derivation logic
- [ ] Visual regression check

### Phase 7: Documentation (30 min)
- [ ] Update README with "Add New Tool" procedure
- [ ] Add JSDoc comments to ToolPageTemplate

---

## 11. Benefits & Outcomes

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

## 12. Appendix: Glossary

- **ToolKey**: Unique identifier for a tool (e.g., `'funnel-pages'`, `'nextland'`)
- **ToolFormConfig**: Registry entry defining tool metadata, steps, dependencies
- **CanonicalToolUiState**: Unified state machine for all tools (8 states)
- **PrimaryActionPolicy**: Derived from state, determines primary CTA label + action
- **ToolPageTemplate**: Generic orchestration component used by all tool pages
- **useToolForm**: Composite hook containing all tool page state management logic
- **ToolStatusCard**: Global feedback component showing overall progress checklist
- **ToolStepCard**: Per-step component showing status, preview, and CTA
- **ToolActionButtons**: Adaptive CTA buttons (primary + secondaries)

---

**Last Updated**: 2026-04-26  
**Status**: Target Architecture (Post-Unification Implementation)  
**Next Review**: After Phase 7 completion
