---
date_created: 2026-04-26
date_updated: 2026-05-02
status: Target (post-unification)
version: 2.0
title: Frontend Tool Pages — Unified Architecture Specification
tags: [architecture, tool-pages, unification, scalability, registry]
---

# Frontend Tool Pages — Unified Architecture Specification

> ⚑ **DDD Reference**: This document describes the Frontend/UI tool page architecture. For canonical domain terminology, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md#frontend--ui-context) — `ToolPage`, `ToolStep`, `ReadinessSnapshot`, `SupportedTool`, `CanonicalToolUiState`
> - [Domain Bounded Context Map](../domain-bounded-context-map.md#frontend--ui-context) — Frontend/UI Context and integration constraints
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — DDD-051, DDD-052 for SessionSummary/Artifacts route and listing boundaries
> - [Tool Generation Flow — Generation Context](../tool-generation-flow-generation-context.md) — visual diagram with cross-context flow

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

### 1.1 Componenti Chiave

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

To align Tool Workspace guidance with DDD-079:

- the registry should converge to `ExtractionFieldKey[]` as source data for required fields;
- UI rendering should project keys to localized `ExtractionFieldLabel` values;
- mixed lists (localized labels + raw keys in one list) are transitional drift.

Current operational matrix:

| Tool | ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status |
| --- | --- | --- | --- |
| `youtube-lf-script` | `knowledge_content` | Knowledge content | contract-backed |
| `youtube-lf-script` | `avatar` | Avatar | contract-backed |
| `youtube-lf-script` | `pain_point` | Pain point | contract-backed |
| `youtube-lf-script` | `purchase_process_type` | Purchase process type | contract-backed |
| `youtube-lf-script` | `offer` | Offer | contract-backed |
| `youtube-lf-script` | `proof` | Proof | contract-backed |
| `youtube-lf-script` | `target_duration_minutes` | Target duration (minutes) | contract-backed |
| `youtube-lf-script` | `proprietary_methodology_disclosure` | Proprietary methodology disclosure | contract-backed |
| `funnel-pages` | `funnel_goal` | Obiettivo del funnel | provisional |
| `funnel-pages` | `target_audience` | Target | provisional |
| `funnel-pages` | `offer` | Offerta | provisional |
| `funnel-pages` | `proof` | Proof o testimonianze | provisional |
| `funnel-pages` | `primary_cta` | CTA principale | provisional |
| `nextland` | `website_goal` | Obiettivo del sito | provisional |
| `nextland` | `brand_or_company` | Brand o azienda | provisional |
| `nextland` | `target_audience` | Target | provisional |
| `nextland` | `offer_or_service` | Offerta o servizio | provisional |
| `nextland` | `required_sections` | Sezioni richieste | provisional |
| `angle-generator` | `goal` | Obiettivo | provisional |
| `angle-generator` | `product_or_service` | Prodotto o servizio | provisional |
| `angle-generator` | `market` | Mercato | provisional |
| `angle-generator` | `target_audience` | Target | provisional |
| `angle-generator` | `pain_point` | Pain point | provisional |
| `angle-generator` | `proof` | Proof | provisional |
| `angle-generator` | `creative_constraints` | Vincoli creativi | provisional |

Implementation note:

- `contract-backed` entries are already represented as key-based required fields in the current registry.
- `provisional` entries are documented convergence targets and require naming decision-log registration before runtime contract adoption.

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

**useProjectsLoader**: Carica lista progetti dell'utente corrente.

Nota as-is (delta 2026-05-02): `ToolPageTemplate` non usa piu `useBriefingUpload` come sorgente primaria.
Lo stato briefing e comandato dal child actor `briefing-upload.machine` spawnato da `tool-page.machine`.
Il template invia eventi (`BRIEFING_FILE_SELECTED`, `BRIEFING_RESET`) e legge snapshot actor via selector.

**useToolUiState**: Invoker per deriveCanonicalToolUiState + derivePrimaryActionPolicy.

---

## 5. Generic UI Components

Nota as-is (delta 2026-05-02): la colonna destra runtime e unificata in `ToolGenerationFlowVertical`.
Le sezioni 5.1 e 5.2 restano come riferimento storico/riuso, non come composizione primaria corrente di `ToolPageTemplate`.

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

Comportamento as-is rilevante:

- CTA primaria gestita per tutte le policy canoniche (`start-generation`, `resume-checkpoint`, `regenerate-current-step`, `open-last-artifact`, `disabled`).
- Nei restore flow, `regenerate-current-step` usa lo step sorgente del checkout ripristinato anche quando `nextAvailableStep` e nullo.
- Le richieste di avvio step passano da `tool-page.machine` con comando `REQUEST_STEP_START`; il side effect di dispatch e agganciato al comando pending nel context macchina.
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