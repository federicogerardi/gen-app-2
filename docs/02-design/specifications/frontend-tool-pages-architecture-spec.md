# Frontend Tool Pages — Unified Architecture Specification

---
date_created: 2026-04-26
date_updated: 2026-04-28
status: Target (post-unification)
version: 2.0
title: Frontend Tool Pages — Unified Architecture Specification
tags: [architecture, tool-pages, unification, scalability, registry]
---

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

### 3.3 Guardrail operativo cancel/resume (delta 2026-04-28)

- Quando l'utente cancella durante `running`, la UI deve preservare lo step interrotto come checkpoint locale (`pausedCheckpointStep`).
- Finche il checkpoint interrotto non viene ripreso/completato, la policy primaria resta `resume-checkpoint`.
- L'azione `resume-checkpoint` deve rilanciare lo stesso step interrotto, non degradare automaticamente a `start-generation`.
- Prima del resume, il run prefix/request id deve essere rigenerato per evitare riuso del requestId del run cancellato.

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