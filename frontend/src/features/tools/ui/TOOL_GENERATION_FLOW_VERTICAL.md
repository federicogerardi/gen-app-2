# ToolGenerationFlowVertical: Brutalist Minimalist Design

## Design Philosophy

**Aesthetic Direction**: Brutalist minimalism with functional animations

This component replaces the previous flow representation with a **pure vertical layout** that prioritizes:
- **Immediate comprehension**: WHERE am I → WHAT to do → WHERE in flow
- **Zero non-functional copy**: Every element serves a purpose
- **Animated feedback**: Status indicators animate during active states
- **Monospace lettering**: Technical, precise, no ambiguity
- **High contrast**: Clear visual hierarchy through contrast, not decoration

## Visual Structure

### Phase 1: Input Requirements

```
┌─────────────────────────────────────────┐
│ WHERE                                   │
│ Setup                                   │
│                                         │
│ WHAT                                    │
│ ○ Select project                        │
│ ⟳ Briefing: brief.docx    EXTRACTING   │
│ ○ Ready to generate                     │
│                                         │
│ PROGRESS                                │
│ Ready to generate                       │
└─────────────────────────────────────────┘
```

**Key Elements**:
- `WHERE`: Current location in flow (Setup, Generating, Complete)
- `WHAT`: Checklist of prerequisites with status icons
- `PROGRESS`: Current readiness state
- Animated icon (⟳) during uploading/extracting
- Pulsing status label (UPLOADING, EXTRACTING, RUNNING)

### Phase 2: Generation Monitoring

```
┌─────────────────────────────────────────┐
│ WHERE                                   │
│ Generating                              │
│                                         │
│ PROGRESS                                │
│ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ 1 / 3                                   │
│                                         │
│ STEPS                                   │
│ ✓ Opt-in Page                           │
│   [View]                                │
│ ⟳ Quiz                    RUNNING       │
│ ○ VSL Script                            │
└─────────────────────────────────────────┘
```

**Key Elements**:
- `WHERE`: Current location (Generating)
- `PROGRESS`: Visual progress bar + numeric count
- `STEPS`: List of all steps with status
- Animated icon (⟳) for running step
- Pulsing status label (RUNNING)
- Action buttons (View) for completed steps

### Phase 3: Completion

```
┌─────────────────────────────────────────┐
│ WHERE                                   │
│ Complete                                │
│                                         │
│ ARTIFACTS                               │
│ 3                                       │
│                                         │
│ STEPS                                   │
│ ✓ Opt-in Page                           │
│   [View]                                │
│ ✓ Quiz                                  │
│   [View]                                │
│ ✓ VSL Script                            │
│   [View]                                │
└─────────────────────────────────────────┘
```

**Key Elements**:
- `WHERE`: Current location (Complete)
- `ARTIFACTS`: Large number showing total artifacts generated
- `STEPS`: All completed steps with View buttons

## Animations

### Spinning Icon (⟳)
- **Trigger**: When status is `running` or briefing is `uploading`/`extracting`
- **Animation**: 360° rotation, 1.5s linear infinite
- **Purpose**: Immediate visual feedback that something is happening

### Pulsing Status Label
- **Trigger**: When status is `UPLOADING`, `EXTRACTING`, or `RUNNING`
- **Animation**: Opacity pulse, 1.5s ease-in-out infinite (1 → 0.5 → 1)
- **Purpose**: Draw attention to active state without being distracting

## Typography

### Labels (WHERE, WHAT, PROGRESS, STEPS, ARTIFACTS)
- Font: JetBrains Mono (monospace)
- Size: 0.65rem
- Weight: 700 (bold)
- Letter-spacing: 0.15em
- Transform: UPPERCASE
- Color: Secondary text (muted)
- Purpose: Technical precision, clear hierarchy

### Values (Setup, Generating, Complete)
- Font: IBM Plex Sans
- Size: 1.5rem
- Weight: 600
- Color: Primary text
- Purpose: Clear, readable, prominent

### Content (Project name, step names, etc.)
- Font: IBM Plex Sans
- Size: 0.95rem
- Weight: 500
- Color: Primary text
- Purpose: Readable, consistent

### Status Labels (UPLOADING, EXTRACTING, RUNNING)
- Font: JetBrains Mono
- Size: 0.65rem
- Weight: 700
- Letter-spacing: 0.1em
- Color: Primary (animated pulse)
- Purpose: Technical feedback, animated attention

## Color Scheme

### States
- **Todo**: Border + text at 60% opacity
- **Running**: Primary color border, light primary background, animated icon
- **Done**: Success color border, light success background
- **Error**: Error color border, light error background

### Borders
- Left border: 2px for items, 1px for containers
- Color: Varies by state (border, primary, success, error)
- Radius: 0 (brutalist, no rounding)

## Responsive Design

### Desktop (> 768px)
- Full layout with all sections visible
- Generous spacing (2rem between sections)
- Large completion count (3rem)

### Mobile (≤ 768px)
- Reduced spacing (1.5rem between sections)
- Smaller completion count (2.5rem)
- Compact padding (1rem)

## CSS Classes

### Main Container
- `.ui-tool-generation-flow-vertical` - Main wrapper

### Phases
- `.ui-flow-v-phase` - Phase container
- `.ui-flow-v-phase-input` - Input requirements phase
- `.ui-flow-v-phase-generation` - Generation monitoring phase
- `.ui-flow-v-phase-completion` - Completion phase

### Sections
- `.ui-flow-v-section` - Section container (WHERE, WHAT, PROGRESS, STEPS)
- `.ui-flow-v-section-error` - Error section

### Labels & Values
- `.ui-flow-v-label` - Label (WHERE, WHAT, PROGRESS, STEPS, ARTIFACTS)
- `.ui-flow-v-value` - Value (Setup, Generating, Complete)

### Checklist Items
- `.ui-flow-v-checklist` - Checklist container
- `.ui-flow-v-item` - Individual checklist item
- `.ui-flow-v-item.is-todo` - Todo state
- `.ui-flow-v-item.is-running` - Running state
- `.ui-flow-v-item.is-done` - Done state
- `.ui-flow-v-item.is-error` - Error state

### Icons & Status
- `.ui-flow-v-icon` - Icon element
- `.ui-flow-v-icon.is-animated` - Animated icon (spinning)
- `.ui-flow-v-status-label` - Status label (UPLOADING, EXTRACTING, RUNNING)

### Progress
- `.ui-flow-v-progress-bar` - Progress bar container
- `.ui-flow-v-progress-fill` - Progress fill
- `.ui-flow-v-progress-text` - Progress text (e.g., "1 / 3")

### Steps
- `.ui-flow-v-steps` - Steps list container
- `.ui-flow-v-step` - Individual step
- `.ui-flow-v-step.is-idle` - Idle state
- `.ui-flow-v-step.is-running` - Running state
- `.ui-flow-v-step.is-completed` - Completed state
- `.ui-flow-v-step.is-error` - Error state
- `.ui-flow-v-step-icon` - Step icon
- `.ui-flow-v-step-name` - Step name
- `.ui-flow-v-step-status` - Step status label
- `.ui-flow-v-step-action` - Step action button (View)

### Completion
- `.ui-flow-v-completion-count` - Large completion count

## Animations

### Spinning Icon
```css
@keyframes ui-flow-v-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Pulsing Status Label
```css
@keyframes ui-flow-v-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Design Rationale

### Why Brutalist Minimalism?

1. **Clarity**: No decoration, only function
2. **Speed**: Users understand state immediately
3. **Precision**: Monospace lettering removes ambiguity
4. **Scalability**: Easy to extend with new states
5. **Accessibility**: High contrast, clear hierarchy

### Why Vertical Only?

1. **Natural Flow**: Top-to-bottom reading order
2. **Mobile-First**: Works perfectly on narrow screens
3. **Focus**: No horizontal distractions
4. **Simplicity**: Single column, no layout complexity

### Why Animated Icons?

1. **Feedback**: Users know something is happening
2. **Non-Intrusive**: Subtle animation, not distracting
3. **Functional**: Animation has purpose, not decoration
4. **Accessible**: Can be disabled with prefers-reduced-motion

### Why Monospace Labels?

1. **Technical**: Conveys precision and control
2. **Hierarchy**: Clearly distinguishes labels from content
3. **Consistency**: Same font for all labels
4. **Readability**: Monospace is highly legible

## Usage Example

```typescript
<ToolGenerationFlowVertical
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
      status: 'completed',
      artifactId: 'art-123',
    },
    {
      step: 'quiz',
      displayName: 'Quiz',
      status: 'running',
      isStreaming: true,
    },
    {
      step: 'vsl',
      displayName: 'VSL Script',
      status: 'idle',
    },
  ]}
  currentRunningStep="quiz"
  completedStepsCount={1}
  totalStepsCount={3}
  errorMessage={null}
  onViewArtifact={(artifactId) => {
    // Navigate to artifact detail
  }}
/>
```

## Comparison: Before vs After

### Before (Fragmented)
- Multiple cards (ToolStatusCard + ToolStepCard[])
- Horizontal phase indicators
- Lots of descriptive copy
- No animated feedback
- Unclear flow progression

### After (Unified Vertical)
- Single component
- Vertical-only layout
- Zero non-functional copy
- Animated status indicators
- Clear WHERE → WHAT → PROGRESS flow

## Future Enhancements

- [ ] Keyboard navigation (arrow keys to navigate steps)
- [ ] Accessibility improvements (ARIA labels, focus management)
- [ ] Prefers-reduced-motion support (disable animations)
- [ ] Customizable phase labels per tool
- [ ] Export/share generation progress
- [ ] Undo/redo for steps
- [ ] Checkpoint recovery UI

---

**Design Date**: 2026-04-29
**Aesthetic**: Brutalist Minimalism
**Status**: Production Ready
