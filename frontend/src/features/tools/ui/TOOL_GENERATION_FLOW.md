# ToolGenerationFlow: Unified Flow Component

## Overview

`ToolGenerationFlow` replaces the fragmented `ToolStatusCard` + `ToolStepCard[]` pattern with a **single, coherent flow representation** that guides users through the complete generation journey.

## Problem Solved

**Before (Fragmented)**:
- ToolStatusCard: Global checklist (separate card)
- ToolStepCard[]: Individual step cards (separate cards)
- No clear visual hierarchy or flow progression
- Inconsistent information architecture

**After (Unified)**:
- Single component representing the complete flow
- Three distinct phases with clear progression
- Consistent visual hierarchy and information architecture
- Better UX for understanding the generation process

## Flow Phases

### Phase 1: Input Requirements
**When**: Initial state, before generation starts
**Shows**:
- Project selection status
- Briefing upload status
- Prerequisites checklist
- Feedback on what's needed to proceed

**Visual**: Checklist with status indicators (todo, active, done, error)

### Phase 2: Generation Monitoring
**When**: Generation is running or paused
**Shows**:
- Progress bar (completed steps / total steps)
- Current step being generated
- Step-by-step artifacts with preview
- Real-time streaming status

**Visual**: Progress bar + step cards with live updates

### Phase 3: Completion
**When**: All steps completed
**Shows**:
- Completion summary (total artifacts generated)
- List of all completed steps
- Links to view each artifact

**Visual**: Summary stats + completed steps list

## Component Props

```typescript
interface ToolGenerationFlowProps {
  // Tool configuration
  toolKey: SupportedTool;
  canonicalState: CanonicalToolUiState;
  
  // Input phase data
  projectName: string | null;
  briefingFileName: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  briefingError: string | null;
  
  // Generation phase data
  steps: StepProgress[];
  currentRunningStep: ToolStep | null;
  completedStepsCount: number;
  totalStepsCount: number;
  
  // Status messages
  statusMessage: string | null;
  errorMessage: string | null;
  
  // Actions
  onViewArtifact?: (artifactId: string) => void;
}
```

## Usage Example

```typescript
<ToolGenerationFlow
  toolKey="funnel-pages"
  canonicalState="generation-monitoring"
  projectName="My Project"
  briefingFileName="brief.docx"
  briefingStatus="ready"
  briefingError={null}
  steps={[
    {
      step: 'optin',
      displayName: 'Opt-in Page',
      description: 'Generate high-converting opt-in page',
      status: 'completed',
      previewContent: '...',
      artifactId: 'art-123',
    },
    {
      step: 'quiz',
      displayName: 'Quiz',
      description: 'Generate interactive quiz',
      status: 'running',
      previewContent: '...',
      isStreaming: true,
    },
    {
      step: 'vsl',
      displayName: 'VSL Script',
      description: 'Generate video sales letter script',
      status: 'idle',
    },
  ]}
  currentRunningStep="quiz"
  completedStepsCount={1}
  totalStepsCount={3}
  statusMessage="Generating quiz..."
  errorMessage={null}
  onViewArtifact={(artifactId) => {
    // Navigate to artifact detail
  }}
/>
```

## Visual Structure

```
┌─────────────────────────────────────────────────────┐
│ Generation Flow                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Phase Indicators:                                   │
│ 📋 Input Requirements  →  ⚙️ Generation  →  ✓ Done │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PHASE 1: Input Requirements                         │
│ ─────────────────────────────────────────────────   │
│ Prerequisites                                       │
│ Provide the required information to start           │
│                                                     │
│ ○ Project          Select a project                │
│ ✓ Briefing         brief.docx                      │
│ ✓ Ready to Generate All prerequisites met          │
│                                                     │
│ Ready to generate                                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PHASE 2: Generation Progress                        │
│ ─────────────────────────────────────────────────   │
│ 1 of 3 steps completed                              │
│ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│                                                     │
│ ✓ Opt-in Page                          [Done]      │
│   Generate high-converting opt-in page              │
│   Preview: [content preview...]                     │
│   [View Artifact]                                   │
│                                                     │
│ ⟳ Quiz                                 [Generating]│
│   Generate interactive quiz                         │
│   Preview: [streaming content...]                   │
│   [Streaming...]                                    │
│                                                     │
│ ○ VSL Script                           [Pending]   │
│   Generate video sales letter script                │
│                                                     │
│ Generating quiz...                                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PHASE 3: Completed                                  │
│ ─────────────────────────────────────────────────   │
│ Generation Complete                                 │
│ All 3 steps have been completed successfully        │
│                                                     │
│ ┌──────────────────────────────────────────────┐   │
│ │ 3                                            │   │
│ │ ARTIFACTS GENERATED                          │   │
│ └──────────────────────────────────────────────┘   │
│                                                     │
│ ✓ Opt-in Page        [View Artifact]               │
│ ✓ Quiz               [View Artifact]               │
│ ✓ VSL Script         [View Artifact]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## CSS Classes

### Main Container
- `.ui-tool-generation-flow` - Main wrapper

### Header
- `.ui-flow-header` - Header section
- `.ui-flow-phases` - Phase indicators container
- `.ui-flow-phase` - Individual phase indicator
- `.ui-flow-phase.is-active` - Active phase
- `.ui-flow-phase.is-completed` - Completed phase
- `.ui-flow-phase-connector` - Connector between phases

### Input Requirements Phase
- `.ui-flow-phase-input-requirements` - Phase container
- `.ui-flow-requirements-list` - Requirements list
- `.ui-flow-requirement` - Individual requirement
- `.ui-flow-requirement.is-todo` - Todo status
- `.ui-flow-requirement.is-active` - Active status
- `.ui-flow-requirement.is-done` - Done status
- `.ui-flow-requirement.is-error` - Error status

### Generation Monitoring Phase
- `.ui-flow-phase-generation-monitoring` - Phase container
- `.ui-flow-progress-bar` - Progress bar container
- `.ui-flow-progress-fill` - Progress fill
- `.ui-flow-steps-list` - Steps list
- `.ui-flow-step` - Individual step
- `.ui-flow-step.is-idle` - Idle status
- `.ui-flow-step.is-running` - Running status
- `.ui-flow-step.is-completed` - Completed status
- `.ui-flow-step.is-error` - Error status
- `.ui-flow-step-preview` - Preview area
- `.ui-flow-step-preview-content` - Preview content

### Completion Phase
- `.ui-flow-phase-completion` - Phase container
- `.ui-flow-completion-summary` - Summary stats
- `.ui-flow-completion-stat` - Individual stat
- `.ui-flow-steps-list-completed` - Completed steps list

## Integration with ToolPageTemplate

The `ToolGenerationFlow` is used in `ToolPageTemplate` to replace the previous fragmented approach:

```typescript
<ToolGenerationFlow
  toolKey={toolKey}
  canonicalState={uiState.canonicalState}
  projectName={currentProject?.name ?? null}
  briefingFileName={effectiveBriefingFileName ?? null}
  briefingStatus={effectiveBriefingStatus}
  briefingError={briefingUpload.error}
  steps={toolConfig.steps.map((step) => ({
    step,
    displayName: step.charAt(0).toUpperCase() + step.slice(1),
    description: `Generate ${step} content`,
    status: uiState.stepStatuses[step] ?? 'idle',
    previewContent: latestArtifactByStep[step]?.content ?? null,
    artifactId: latestArtifactByStep[step]?.artifactId ?? null,
    isStreaming: generation.isStreamActive && currentRunningStep === step,
  }))}
  currentRunningStep={currentRunningStep}
  completedStepsCount={completedStepsForFlow.size}
  totalStepsCount={toolConfig.steps.length}
  statusMessage={uiState.statusMessage}
  errorMessage={uiState.errorMessage}
  onViewArtifact={(artifactId) => {
    // Navigate to artifact detail page
  }}
/>
```

## Benefits

✅ **Unified Flow**: Single component represents the complete journey
✅ **Clear Progression**: Three distinct phases with visual indicators
✅ **Consistent UX**: Same structure for all tools
✅ **Better Information Architecture**: Logical grouping of related information
✅ **Improved Readability**: Reduced cognitive load for users
✅ **Scalable**: Easy to extend with new phases or information
✅ **Maintainable**: Single source of truth for flow representation

## Future Enhancements

- [ ] Collapsible phases for compact view
- [ ] Keyboard navigation between phases
- [ ] Accessibility improvements (ARIA labels, focus management)
- [ ] Animation transitions between phases
- [ ] Customizable phase labels per tool
- [ ] Export/share generation progress
