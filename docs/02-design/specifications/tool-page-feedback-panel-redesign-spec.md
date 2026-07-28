---
status: implemented
version: 1.1
last-reviewed: 2026-07-28
next-review-date: 2026-12-28
implementation_date: 2026-07-28
owner: UI Designer
date_created: 2026-07-28
type: design-proposal
tags:
  - ui-design
  - feedback-panel
  - tool-page
  - job-system
  - component-architecture
  - governance-compliance
---

# Tool Page Feedback Panel Redesign Specification

> ⚑ DDD Reference
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md)
> - [Domain Bounded Context Map](../../02-design/domain-bounded-context-map.md)
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md)
> - [Frontend UI Ubiquitous Language Spec](../specifications/frontend-ui-ubiquitous-language-spec.md) — §4b (CTA Governance), §7 (Feedback Channels), §12 (Design Tokens)
> - Governance sections in this spec: [§12a CTA Mapping](#12a-cta-governance--canonical-pattern-mapping), [§12b Feedback Channels](#12b-feedback-channel-mapping), [§13.1 Token Mapping](#131-token-mapping-to-stylescss)
> - [Tool Generation Flow Source-of-Truth Spec](../specifications/tool-generation-flow-source-of-truth-spec.md) — canonical XState state names and readiness contracts

## 1. Executive Summary

The tool page feedback panel currently has a split personality: an un-wired `ToolStatusCard` (readiness checklist), a legacy in-browser `ToolGenerationFlowVertical`, and a hastily-built `ToolWorkflowJobPanel` for the new BE-driven job system. This specification unifies them into a single, coherent design system that serves the user's primary need — **knowing what's happening, how long it'll take, and when results are ready** — across all states.

### Design principles for this panel
1. **Single source of truth**: One panel owns the right column. No mutually-exclusive branching.
2. **State-driven, not feature-flagged**: The component adapts to the machine state, not to `useJobSystem` flags.
3. **Progressive disclosure**: Show what matters now; defer what doesn't.
4. **Confidence-builder**: Always give users a reason to trust the system is working (even when it's slow).
5. **Accessibility-first**: Every state has screen-reader announcements, keyboard targets, and focus management.

## 2. Component Architecture

### 2.1 Component Tree

```
<ToolFeedbackPanel>                         ← NEW unified root (replaces both branches)
├─ <PreFlightReadiness>                     ← NEW: workspace + briefing readiness (absorbed from ToolStatusCard)
│  ├─ <WorkspaceIndicator />                ← workspace name + icon
│  └─ <BriefingIndicator />                 ← briefing file name + status icon
├─ <JobProgressDashboard>                   ← NEW: replaces ToolWorkflowJobPanel + ToolGenerationFlowVertical
│  ├─ <StatusBadge />                       ← queued / running / completed / failed / cancelled
│  ├─ <StepTracker />                       ← step-by-step visualization (replaces ToolWorkflowJobStepTracker)
│  │  └─ <StepItem /> × N                   ← individual step with status, label, progress detail
│  ├─ <ProgressBar />                       ← overall completion bar (from legacy ToolGenerationFlowVertical)
│  ├─ <CurrentActivity />                   ← human-readable description of what's happening NOW
│  └─ <ActionBar />                         ← Cancel, Retry, View Results buttons (contextual)
├─ <ErrorBanner />                          ← error display with action
├─ <ReconnectionNotice />                   ← stream disconnection feedback
└─ <EmptyStateGuide />                      ← what to do before starting (initial state)
```

### 2.2 Component Responsibilities

| Component | Responsibility | Replaces |
|---|---|---|
| `ToolFeedbackPanel` | Orchestrates all feedback display; reads machine state + job state; delegates to children | Both branches in ToolPageTemplate |
| `PreFlightReadiness` | Shows workspace + briefing readiness inline BEFORE job starts | `ToolStatusCard` (absorbed) |
| `JobProgressDashboard` | Displays active job progress with step tracking | `ToolWorkflowJobPanel` + `ToolGenerationFlowVertical` |
| `StatusBadge` | Single-word status chip: `Queued` / `Running` / `Completed` / `Failed` | Inline badge in ToolWorkflowJobPanel |
| `StepTracker` | Vertical/horizontal step list with animated status transitions | `ToolWorkflowJobStepTracker` |
| `ProgressBar` | Overall % completion bar with phase label | Progress bar in ToolGenerationFlowVertical |
| `CurrentActivity` | Human-readable activity description (e.g. "Extracting keywords from your brief…") | `statusText` in legacy flow |
| `ActionBar` | Contextual buttons: Cancel during run, Retry on error, View Results on complete | Action buttons in both panels |
| `ErrorBanner` | Error message with retry CTA | Error display in both panels |
| `ReconnectionNotice` | Pulses when SSE stream drops, disappears on reconnect | Inline notice in ToolWorkflowJobPanel |
| `EmptyStateGuide` | Shows readiness checklist + "Get started" guidance when no job is active | New (currently a gap) |

### 2.3 Props Contract

```typescript
type ToolFeedbackPanelProps = {
  // Machine state
  machineState: 'configuring' | 'submitting' | 'running' | 'completed';
  configuringSubstate?: 'clean' | 'hydrationFailed' | 'generationFailed';
  canonicalState: CanonicalToolUiState;

  // Job identity
  jobId: string | null;
  isJobSystemActive: boolean;

  // Step data (for job system)
  steps: Array<{
    key: string;
    label: string;
    status: 'idle' | 'running' | 'done' | 'error';
  }>;
  currentRunningStep: string | null;
  completedStepsCount: number;
  totalStepsCount: number;

  // Readiness data (for pre-flight)
  workspaceName: string | null;
  briefingFileName: string | null;
  isBriefingReady: boolean;

  // Stream health
  isStreamActive: boolean;

  // Messages
  errorMessage: string | null;

  // Actions
  onCancel: () => void;
  onRetry: () => void;
  onViewResults: () => void;

  // Legacy flow support (while transitioning)
  legacyProgress?: GenerationProgressSnapshot;
};
```

## 3. State Matrix

### 3.1 Complete State × Element Grid

| State | StatusBadge | ProgressBar | StepTracker | CurrentActivity | PreFlightReadiness | ActionBar | ErrorBanner | ReconnectionNotice | EmptyStateGuide |
|---|---|---|---|---|---|---|---|---|---|
| **Initial (no job)** | hidden | hidden | hidden | hidden | **visible** | hidden | if error | hidden | **visible** |
| **Submitting** | `Queued` (pill, blue) | indeterminate animation | all steps `idle` | "Preparing your request…" | hidden | Cancel btn | if submit fails | hidden | hidden |
| **Running (step N)** | `Running` (pill, blue + pulse) | `N/total` determinate | steps before N: `done`; step N: `running` (animated); steps after N: `idle` | "Extracting context from your brief…" (per-step copy) | hidden | Cancel btn | if step fails | if stream drops | hidden |
| **Completed** | `Completed` (pill, green + check) | 100% full | all steps `done` | "All artifacts generated — review results below" | hidden | **View Results** btn | hidden | hidden | hidden |
| **Failed (mid-job)** | `Failed` (pill, red + x) | frozen at % | failed step: `error`; prior: `done`; rest: `idle` | "Generation stopped at {step} — an error occurred" | hidden | **Retry** btn + Cancel btn | **visible** (error detail + retry suggestion) | hidden | hidden |
| **Failed (submit)** | hidden | hidden | hidden | hidden | **visible** | hidden | **visible** (submit error) | hidden | hidden |
| **Cancelled** | `Cancelled` (pill, neutral) | frozen at % | as at cancel moment | "Generation was cancelled" | **visible** | Start btn | hidden | hidden | hidden |

### 3.2 State Transition Animation Map

```
  Initial ──[user clicks Start]──▶ Submitting ──[POST succeeds]──▶ Running
                                                                      │
                                    ┌─────────────────────────────────┼─────────────┐
                                    ▼                                 ▼             ▼
                               Completed                          Failed        Cancelled
                                    │                                 │             │
                                    └────[user clicks Retry]──────────┘             │
                                                                                    │
  Initial ◀───────────────[RESET from any terminal state]───────────────────────────┘
```

**Transition durations (CSS)**:
- Status badge color shift: `transition: background-color 400ms ease, border-color 400ms ease`
- Step icon transition (idle → running → done): `transition: all 300ms ease`
- Progress bar fill: `transition: width 500ms ease-out`
- Error banner entry: slide down + fade in `300ms ease-out`
- Reconnection notice: pulse animation `1.5s infinite`

## 4. Layout Design (Per-State)

### 4.1 Initial / Empty State (no active job)

```
┌─────────────────────────────────────────┐
│  🚀 Ready to Generate                  │  ← Panel heading
│                                         │
│  Before you start, make sure:           │
│  ┌─ ✓ Workspace ──────────────────────┐│
│  │  "Summer Campaign 2026"             ││  ← PreFlightReadiness
│  ├─ ✓ Brief ──────────────────────────┤│
│  │  "campaign-brief-v2.docx" uploaded  ││
│  └─────────────────────────────────────┘│
│                                         │
│  📋 What happens next:                  │  ← EmptyStateGuide
│     1. Brief extraction & context       │
│     2. Web crawl for references         │
│     3. Content generation (4 steps)     │
│     4. Final assembly                   │
│                                         │
│     [Start Generation] ← CTA            │
└─────────────────────────────────────────┘
```

**Visual hierarchy**: Heading → Readiness checklist items → Walkthrough → CTA button.
**First thing the eye sees**: The green checkmarks confirming readiness.
**Purpose**: Reassure the user they're set up correctly before committing.

### 4.2 Submitting State

```
┌─────────────────────────────────────────┐
│  ┌──────────┐                           │  ← StatusBadge: blue pill
│  │  Queued  │                           │
│  └──────────┘                           │
│                                         │
│  Preparing your request…                │  ← CurrentActivity (with ellipsis animation)
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ││  ← ProgressBar: indeterminate
│  └─────────────────────────────────────┘│
│                                         │
│  ▸ Extract context           waiting    │  ← StepTracker: all idle
│  ▸ Crawl & score             waiting    │
│  ▸ Generate content          waiting    │
│  ▸ Final assembly            waiting    │
│                                         │
│           [Cancel]                       │  ← ActionBar
└─────────────────────────────────────────┘
```

**Visual hierarchy**: Status badge → Animated text → Indeterminate bar → Grayed-out steps → Cancel.
**First thing the eye sees**: The pulsing "Queued" badge.
**Purpose**: "We received your request. Things are starting. You can still cancel."

**Indeterminate bar behavior**: A shimmer/scan animation moves left-to-right continuously on the progress bar track (no percentage text).

### 4.3 Running State (during an active step)

```
┌─────────────────────────────────────────┐
│  ┌──────────┐  Extracting context from  │  ← StatusBadge + CurrentActivity
│  │ Running  │  your briefing document…  │
│  └──────────┘                           │
│                                         │
│  ████████████░░░░░░░░░░░░  3/7 steps    │  ← ProgressBar: 43% filled
│                                         │
│  ✓ Extract context           done        │  ← StepTracker: green checkmarks
│  ● Crawl & score            running     │  ← animated pulsing dot
│  ◌ Generate content          waiting     │  ← dimmed, static
│  ◌ Final assembly            waiting     │
│                                         │
│           [Cancel Generation]            │  ← ActionBar
└─────────────────────────────────────────┘
```

**Visual hierarchy**: What's happening NOW (badge + activity text) → Overall progress (bar) → Step detail (tracker) → Cancel.
**First thing the eye sees**: The animated running step (pulsing dot + bold text).
**Purpose**: "We're working on step 2 of 7. Here's exactly where we are. You can cancel anytime."

**Step detail rows**: Each step row gets a subtle left border accent color matching its status:
- `idle`: `transparent` (invisible border)
- `running`: `#3b82f6` (blue) with a 2px left border + subtle blue background tint
- `done`: `#10b981` (green) with 1px left border
- `error`: `#ef4444` (red) with 2px left border + light red background tint

### 4.4 Completed State

```
┌─────────────────────────────────────────┐
│  ┌───────────┐                          │
│  │ Completed │                          │  ← StatusBadge: green with ✓ icon
│  └───────────┘                          │
│                                         │
│  All 7 steps completed successfully      │  ← CurrentActivity (positive)
│                                         │
│  ████████████████████████████  100%     │  ← ProgressBar: full, green
│                                         │
│  ✓ Extract context           done       │  ← StepTracker: all done
│  ✓ Crawl & score             done       │
│  ✓ Generate content          done       │
│  ✓ Final assembly            done       │
│                                         │
│       [View Results ↓]                   │  ← ActionBar: prominent CTA
└─────────────────────────────────────────┘
```

**Visual hierarchy**: Success state badge (green dominates) → "View Results" CTA button → Full progress bar → Step checklist (secondary).
**First thing the eye sees**: The green "Completed" badge + the prominent View Results button.
**Purpose**: "Success! Your content is ready. Click here to see it."

### 4.5 Failed State (mid-run step failure)

```
┌─────────────────────────────────────────┐
│  ┌────────┐                             │
│  │ Failed │                             │  ← StatusBadge: red with ✕ icon
│  └────────┘                             │
│                                         │
│  Generation stopped during "Generate    │  ← CurrentActivity
│  content" — an error occurred.          │
│                                         │
│  ██████████░░░░░░░░░░░░░░░░  3/7 steps  │  ← ProgressBar: frozen at 43%
│                                         │
│  ✓ Extract context           done       │
│  ✓ Crawl & score             done       │
│  ✕ Generate content          error      │  ← red highlight + error detail line
│    └─ "LLM service returned 503"        │  ← expandable error detail
│  ◌ Final assembly            waiting    │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ⚠ The generation couldn't complete  ││  ← ErrorBanner
│  │ due to a backend issue. Your         ││
│  │ progress up to step 2 is saved.      ││
│  │              [Retry] [Cancel]        ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Visual hierarchy**: Red badge + error highlight → Error banner with actionable CTAs → Frozen progress context → Remaining steps.
**First thing the eye sees**: The red "Failed" badge and the error banner immediately below it.
**Purpose**: "Something went wrong, but your work isn't lost. You can retry."

### 4.6 Cancelled State

```
┌─────────────────────────────────────────┐
│  ┌───────────┐                          │
│  │ Cancelled │                          │  ← StatusBadge: neutral gray
│  └───────────┘                          │
│                                         │
│  Generation was cancelled at step 2/7   │  ← CurrentActivity
│                                         │
│  ┌────────── Before you restart ───────┐│
│  │ ✓ Workspace: "Summer Campaign 2026" ││  ← PreFlightReadiness returns
│  │ ✓ Brief: ready                      ││
│  └─────────────────────────────────────┘│
│                                         │
│       [Start Generation]                 │  ← ActionBar
└─────────────────────────────────────────┘
```

## 5. Visual Hierarchy Summary

| State | 1st (most prominent) | 2nd | 3rd | 4th (least prominent) |
|---|---|---|---|---|
| Initial | PreFlightReadiness checks | EmptyStateGuide text | Start CTA | — |
| Submitting | StatusBadge (blue, pulsing) | Indeterminate bar (motion draws eye) | "Preparing…" text | Steps (grayed out) |
| Running | Running step row (highlighted + animated) | StatusBadge | ProgressBar | Idle/done steps |
| Completed | StatusBadge (green) | View Results CTA | ProgressBar (100%) | Done steps |
| Failed | ErrorBanner | StatusBadge (red) + failed step highlight | Retry CTA | Frozen progress |
| Cancelled | StatusBadge (gray) | PreFlightReadiness | Start CTA | — |

## 6. Copy Strategy

### 6.1 New Copy Tokens Required

Add to `appCopy.ui.toolPage.feedbackPanel` (new section):

```typescript
feedbackPanel: {
  // Panel headings
  readyHeading: 'Ready to Generate',
  activeHeading: 'Generation in Progress',
  completedHeading: 'Generation Complete',
  failedHeading: 'Generation Failed',
  cancelledHeading: 'Generation Cancelled',

  // Pre-flight readiness
  preFlightTitle: 'Before you start, make sure:',
  workspaceLabel: 'Workspace',
  workspaceMissing: 'Select a workspace',
  briefingLabel: 'Brief',
  briefingMissing: 'Upload a briefing document',

  // Empty state guide
  emptyGuideTitle: 'What happens next:',
  emptyGuideSteps: [
    'Brief extraction & context analysis',
    'Web crawl for reference data',
    'AI content generation ({stepCount} steps)',
    'Final assembly and formatting',
  ] as readonly string[],

  // Status badge labels (extends existing toolWorkflowJob.status)
  // Use: appCopy.ui.toolWorkflowJob.status for these — no duplicate needed

  // Current activity descriptions (per-step, richer than stepTracker labels)
  activityByStep: {
    // Generic fallback map — override per tool in tool-specific copy
    extracting: 'Extracting context from your {source}…',
    crawling: 'Crawling web sources for relevant data…',
    scoring: 'Scoring and ranking crawled content…',
    generating: 'Generating {stepLabel} content…',
    assembling: 'Assembling final output…',
  },
  activityDefault: 'Processing your request…',

  // Completed state
  completedSummary: (count: number) => `All ${count} steps completed successfully`,
  completedCta: 'View Results',

  // Failed state
  failedSummary: (step: string) => `Generation stopped during "${step}" — an error occurred.`,
  failedSavedProgress: 'Your progress up to the previous step has been saved.',

  // Cancelled state
  cancelledSummary: (step: number, total: number) => `Generation was cancelled at step ${step}/${total}.`,

  // Reconnection (remains in toolWorkflowJob.stream)
  // reconnecting: 'Connection lost. Reconnecting…' (already exists)

  // Action labels
  actionCancel: 'Cancel',
  actionCancelling: 'Cancelling…',
  actionRetry: 'Retry',
  actionStart: 'Start Generation',
  actionViewResults: 'View Results ↓',

  // Aria labels
  ariaPanelLabel: 'Generation feedback panel',
  ariaProgressLabel: (step: number, total: number) => `Progress: ${step} of ${total} steps completed`,
  ariaStepLabel: (label: string, status: string, index: number, total: number) =>
    `Step ${index + 1} of ${total}: ${label}, ${status}`,
  ariaLiveCompleted: 'Generation completed. Results are ready.',
  ariaLiveFailed: (step: string) => `Generation failed during step: ${step}.`,
  ariaLiveCancelled: 'Generation was cancelled.',
};
```

### 6.2 Step-Level Activity Copy

Each tool step gets a dedicated activity description. The mapping from step keys to activity text lives in tool-specific config:

```typescript
// Example for meta-ads tool steps
toolStepActivity: {
  'extract-context': 'Extracting campaign parameters from your brief…',
  'crawl-competitors': 'Crawling competitor ad libraries for benchmarks…',
  'score-references': 'Scoring reference ads by relevance to your objective…',
  'generate-headlines': 'Generating headline variations…',
  'generate-primary-text': 'Writing primary text for each headline…',
  'generate-descriptions': 'Creating description pairs…',
  'assemble-final': 'Assembling final ad copy combinations…',
}
```

Fallback: if no per-step copy exists, use `appCopy.ui.toolWorkflowJob.stepTracker[status]` with the step label.

## 7. Interaction Design

### 7.1 Click Targets

| Element | Min Size | Behavior |
|---|---|---|
| Cancel button | 44×32px | Dispatches `CANCEL_GENERATION` → machine resets to `configuring` |
| Retry button | 44×32px | Dispatches `RETRY` → machine re-enters `running` from last checkpoint |
| View Results button | 160×44px (prominent) | Scrolls page to results section or navigates to session page |
| Start Generation button | 160×44px (prominent) | Dispatches `START_GENERATION` or `SUBMIT_JOB` |
| Step rows | Full row width, 40px min height | Non-interactive during run; clickable to expand error detail on failed step |
| Expandable error detail | Chevron icon (24×24px tap target) | Toggles inline error detail below failed step |

### 7.2 Hover States

- **Cancel button**: Background shifts from `transparent` → `#fee2e2` (light red), text color stays `#ef4444`
- **Retry button**: Background fills from `transparent` → `#2563eb`, text turns white
- **View Results button**: Subtle scale `transform: scale(1.02)` + shadow increase
- **Step rows (failed)**: Cursor changes to `pointer`, left border intensifies from 2px to 3px

### 7.3 State Transitions

**Submitting → Running**: 
- Progress bar snaps from indeterminate to 0% (or first step %) in 100ms
- First step row transitions from `idle` to `running` with a 300ms ease-in animation
- Status badge slides left-to-right within its container (300ms ease)
- Cancel button remains available throughout

**Running → Running (step advance)**:
- Current step: running dot → checkmark (cross-fade, 200ms)
- Next step: idle dot → running dot (fade + scale bounce, 300ms)
- Progress bar: width increases smoothly (500ms ease-out)
- Activity text: cross-fade to new step description (250ms)
- Screen reader: announce "Step X completed. Now working on step Y."

**Running → Completed**:
- Status badge: blue → green (400ms color transition + checkmark icon morph)
- All remaining idle steps: snap to `done` simultaneously (one batch transition)
- Progress bar: fills to 100% (800ms ease-out, feels satisfying)
- View Results button: fades in with `translateY(8px) → translateY(0)` (400ms ease-out, delayed 200ms after bar completes)

**Running → Failed**:
- Status badge: blue → red (300ms, with a subtle shake on the failed step row)
- Failed step: highlight appears with 100ms delay
- Error banner: slides down from `-20px` + fades in (300ms ease-out)
- Progress bar: freezes immediately (no continued animation)
- Cancel button: replaces with Retry button (cross-fade 250ms)

## 8. Animation & Motion

### 8.1 What Animates

| Element | Animation | Duration | Easing | Trigger |
|---|---|---|---|---|
| Running step dot | `scale(0.8) → scale(1.2) → scale(1.0)` pulse loop | 1.2s per cycle | `ease-in-out` | continuous while step is `running` |
| Progress bar fill | `width: X% → Y%` | 500ms | `ease-out` | on `JOB_PROGRESS` event |
| Indeterminate bar shimmer | `translateX(-100%) → translateX(400%)` loop | 2s per cycle | `linear` | while machine is `submitting` |
| Status badge color | `background-color` transition | 400ms | `ease` | on status change |
| Step icon morph | cross-fade (opacity 0→1) | 200ms | `ease-in-out` | on step status change |
| Error banner entry | `opacity 0→1` + `translateY(-8px→0)` | 300ms | `ease-out` | on error |
| Reconnection pulse | `opacity 0.6→1.0` loop | 1.5s | `ease-in-out` | when stream drops |
| View Results CTA | `opacity 0→1` + `translateY(8px→0)` | 400ms | `ease-out` (delay 200ms) | on completion |
| Step row highlight | left border `0→2px` + bg tint `transparent→light-blue` | 300ms | `ease` | when step becomes `running` |

### 8.2 What Does NOT Animate

- Steps transitioning from `idle` to `idle` (no change, no render)
- Error text content changes (instant swap, no morph — prevents jank)
- Button width changes (fixed width containers prevent layout shift)
- Step label text (no morphing, instant swap with screen reader announcement)

### 8.3 Reduced Motion

Respect `prefers-reduced-motion: reduce`:
- All `transition` durations set to `0ms`
- Pulse animations disabled (running step shows static filled dot)
- Indeterminate bar shows static gradient (no shimmer movement)
- Step icon changes are instant swaps (no cross-fade)
- Bounce/scale effects disabled
- Entry animations become instant reveals

## 9. Accessibility

### 9.1 Screen Reader Announcements

Use `aria-live` regions strategically:

```html
<!-- Persistent live region for status changes (polite: doesn't interrupt) -->
<div class="ui-feedback-sr-live" aria-live="polite" aria-atomic="true">
  <!-- Content swapped on every state change -->
</div>

<!-- Assertive region for critical alerts only -->
<div class="ui-feedback-sr-alert" aria-live="assertive" role="alert">
  <!-- Only for error and completion states -->
</div>
```

Announcement schedule:
| Event | Region | Message |
|---|---|---|
| Job submitted | polite | "Generation submitted. Preparing your request." |
| Step starts | polite | "Step 2 of 7: Crawling and scoring." |
| Step completes | polite | "Step 2 completed. Moving to step 3." |
| Job completes | assertive | "Generation completed. Results are ready." |
| Job fails | assertive | "Generation failed during Generate content. Error: LLM service returned 503." |
| Stream drops | polite | "Connection lost. Attempting to reconnect." |
| Stream reconnects | polite | "Connection restored." |
| Cancelled | polite | "Generation cancelled." |

### 9.2 Keyboard Navigation

| Element | Key | Action |
|---|---|---|
| Panel container | Tab | Focus enters panel |
| Cancel button | Enter / Space | Cancel job |
| Retry button | Enter / Space | Retry from checkpoint |
| View Results button | Enter / Space | Navigate to results |
| Failed step row (expandable) | Enter / Space | Toggle error detail |
| Step list | Arrow Up/Down | Navigate between steps (roving tabindex) |

### 9.3 Focus Management

1. **On submit**: Focus moves to the Cancel button (allows immediate cancel without Tab navigation)
2. **On completion**: Focus moves to the View Results button
3. **On error**: Focus moves to the Retry button inside the error banner
4. **On cancel**: Focus returns to the Start Generation button (or the first focusable element in the setup panel)
5. **During run**: Focus stays on the Cancel button unless user navigates away

### 9.4 ARIA Attributes

```html
<div role="region" aria-label="Generation feedback panel" aria-describedby="panel-desc">
  <span id="panel-desc" class="sr-only">
    Shows the status of your content generation job.
    Use Tab to access action buttons.
  </span>

  <!-- Status badge -->
  <span role="status" aria-label="Job status: Running">Running</span>

  <!-- Progress bar -->
  <div role="progressbar"
       aria-valuenow="43"
       aria-valuemin="0"
       aria-valuemax="100"
       aria-label="3 of 7 steps completed">
  </div>

  <!-- Step tracker -->
  <ol aria-label="Generation steps">
    <li aria-current="step" aria-label="Step 2 of 7: Crawl and score, running">
      ...
    </li>
  </ol>

  <!-- Error banner -->
  <div role="alert">
    <p>Generation failed during Generate content.</p>
    <button>Retry</button>
  </div>
</div>
```

## 10. Empty/Loading/Skeleton States

### 10.1 Skeleton (during hydration / initial load)

```
┌─────────────────────────────────────────┐
│  ┌──────────────────┐                   │  ← shimmer placeholder for heading
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓ ││  ← skeleton for pre-flight checks
│  ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤│
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││  ← skeleton for walkthrough
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│  └─────────────────────────────────────┘│
│                                         │
│       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │  ← skeleton for CTA button
└─────────────────────────────────────────┘
```

Skeleton uses MUI's `Skeleton` component or custom shimmer with `animation: shimmer 1.5s infinite`. Background: `linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)`.

### 10.2 Submit-in-Progress (transient, ~50-200ms)

Between user click and server response, the Cancel button briefly shows "Cancelling…" with a spinner. The status badge shows "Queued." No skeleton needed — the submitting state (Section 4.2) renders immediately with the indeterminate bar.

### 10.3 Post-Completion Artifact Load

After completion, results may still be loading from the server. Show a compact loading indicator inline below the completed panel:

```
┌─────────────────────────────────────────┐
│  ✓ Completed — Loading results… ⟳      │  ← spinner + text
└─────────────────────────────────────────┘
```

## 11. Edge Cases

### 11.1 Long Step Names

- Truncate at 2 lines with ellipsis (`text-overflow: ellipsis` on the label span)
- Step tooltip on hover shows full name (native `title` attribute)
- Step container has `min-width: 0` + `overflow: hidden` to prevent layout break
- Step icon has `flex-shrink: 0` to prevent squishing

### 11.2 Many Steps (≥8)

- Steps beyond 4 are auto-collapsed into a "Show all N steps" expander
- Default visible: first 4 steps (or all if ≤4)
- Collapsed state shows: "4 done, 3 remaining" summary line
- Expansion reveals all with a 300ms max-height transition

### 11.3 Rapid State Changes

- The `JOB_PROGRESS` events can fire rapidly (e.g., step done immediately followed by next step running)
- **Debounce visual updates**: Batch state changes within a 100ms window
- **Animation interruption**: Use `transition` (not `animation`) so intermediate states are skipped — CSS transitions naturally handle this: if the target value changes mid-transition, the transition re-targets smoothly
- **Step tracker**: Use a `requestAnimationFrame` gate so multiple status updates in the same frame result in a single render

### 11.4 Network Interruptions

- When `isStreamActive` goes from `true` → `false` while `panelStatus === 'running'`:
  1. Show the reconnection notice (pulsing amber banner)
  2. After 15 seconds without reconnection, escalate: show a more prominent notice + manual "Refresh Status" button
  3. The progress bar freezes at its last known value (do NOT animate to 0 or 100)
  4. Step tracker maintains last known state (no steps change to `error` on disconnect alone)
- On reconnect: reconnection notice disappears with a brief green flash "Reconnected" (2s) → back to normal
- If reconnection fails permanently (60s), transition to a soft-error state: "Lost connection to server. [Check Status]" button

### 11.5 Job Already Completed on Page Load

If `pendingJobId` is in sessionStorage and the job completed while the user was away:
1. On mount, poll job status (`GET /api/tools/jobs/{jobId}`)
2. If completed: render the Completed state immediately with artifact links
3. If failed: render Failed state with retry option
4. If running: reconnect to SSE stream

### 11.6 Concurrent Generation (idempotency)

If the user hits Start while a job is already running (idempotency conflict, HTTP 409):
- Show error: "Generation is already in progress. Please wait for completion."
- Do NOT reset the current job state
- Error auto-dismisses after 5 seconds

### 11.7 SessionStorage Cleanup

- On successful completion: keep the job ID in sessionStorage for 30 minutes (allows page refresh without losing context)
- On failure/cancel: clear `sessionStorage` entry immediately
- On navigate away during run: keep the entry (allows recovery on return — handled by 11.5)

## 12. Migration & Implementation Strategy

### 12.1 Phase 1: Extract Pre-Flight Readiness (1-2 days)
- Create `PreFlightReadiness` component from `ToolStatusCard` logic
- Wire it into `ToolFeedbackPanel` (still behind feature flag, next to existing panels)
- Show it in the initial state only

### 12.2 Phase 2: Build `JobProgressDashboard` (2-3 days)
- Create unified `StepTracker` with animations (reuses step data from both old and new systems)
- Create `StatusBadge` component
- Create `ProgressBar` component (unified from both systems)
- Create `ActionBar` with contextual button logic
- Create `ErrorBanner` + `ReconnectionNotice`

### 12.3 Phase 3: Assemble `ToolFeedbackPanel` (2 days)
- Compose all Phase 1/Phase 2 components
- Implement state machine driving which sub-components render
- Wire props from `useToolPage()` hook
- Implement skeleton/loading states
- Implement all screen reader announcements

### 12.4 Phase 4: Switchover & Cleanup (1 day)
- Remove the `useJobSystem && pendingJobId ? ... : ...` ternary in `ToolPageTemplate`
- Replace with single `<ToolFeedbackPanel />`
- Deprecate `ToolWorkflowJobPanel`, `ToolWorkflowJobStepTracker`, `ToolGenerationFlowVertical`
- Deprecate `ToolStatusCard` (absorbed into `PreFlightReadiness`)
- Run a11y audit against the new panel across all states
- Remove feature flag

### 12.5 What Gets Deleted

| File | Action |
|---|---|
| `ToolWorkflowJobPanel.tsx` | Delete (replaced by `JobProgressDashboard`) |
| `ToolWorkflowJobStepTracker.tsx` | Delete (replaced by `StepTracker`) |
| `ToolStatusCard.tsx` | Delete (replaced by `PreFlightReadiness`) |
| `ToolGenerationFlowVertical.tsx` | Delete (replaced by `JobProgressDashboard` + `ProgressBar`) |

## 12a. CTA Governance — Canonical Pattern Mapping

> Per [Frontend UI Ubiquitous Language Spec §4b](../specifications/frontend-ui-ubiquitous-language-spec.md), ogni CTA deve mappare esattamente a uno dei tre pattern canonici: Pattern A (`ui-button`), Pattern B (`inlineLink`), Pattern C (bordered-chip per `<td>`).

Nessun pulsante del feedback panel appare in celle `<td>`, quindi Pattern C non si applica. Tutti i CTA del pannello sono azioni primarie del workflow e usano **Pattern A (`ui-button`)**:

| Pulsante | Pattern | Classe | Stato macchina | Motivazione |
|---|---|---|---|---|
| Start Generation | **Pattern A** `ui-button` | `uiPrimitives.button` | Initial, Cancelled | Azione primaria che avvia il flusso |
| Cancel | **Pattern A** `ui-button` (outlined) | `ui-button` + variant outline | Submitting, Running | Azione distruttiva reversibile locale |
| Retry | **Pattern A** `ui-button` | `ui-button` | Failed | Recovery action primaria |
| View Results | **Pattern A** `ui-button` | `ui-button` | Completed | Azione di completamento primaria |

**Regole aggiuntive** (§4b):
- Nessuna proprietà CSS custom (`background`, `border-radius`, `font-size`, `font-weight`) che sovrascriva `.ui-button` — tutto delegato alla classe canonica in `styles.css`
- Nessun `inlineLink` usato come CTA primario del pannello
- Min touch target: 44×32px per Cancel/Retry, 160×44px per Start/View Results (garantito da `.ui-button`)

### 12a.1 Unification Principle

Questo mapping è intenzionalmente **identico per tutti gli stati** del pannello. Non ci sono variazioni di pattern CTA tra Initial, Running, Failed, o Completed — ogni stato ha al massimo un'azione primaria via `ui-button`. Questo è lo stesso principio di unificazione che ha guidato il refactoring BE-driven: **un componente, un pattern, zero eccezioni**.

## 12b. Feedback Channel Mapping

> Per [Frontend UI Ubiquitous Language Spec §7](../specifications/frontend-ui-ubiquitous-language-spec.md), ogni evento di feedback deve mappare esattamente a un canale canonico. Il canale `inline-action` ha precedenza su `page-state` che ha precedenza su `global`.

| Evento | Canale | Componente | Motivazione |
|---|---|---|---|
| Step failure con retry | `inline-action` | `ErrorBanner` | L'utente può correggere (Retry) nel contesto corrente — regola §7.1 |
| Submit failure (pre-flight) | `inline-action` | `ErrorBanner` sotto `PreFlightReadiness` | L'utente può correggere la configurazione e riprovare |
| Idempotency conflict (409) | `inline-action` | Banner auto-dismiss | Informazione locale, non richiede azione cross-page |
| Stream disconnection | `inline-action` | `ReconnectionNotice` | Lo stato del job è visibile nel pannello; il recovery è locale (Refresh Status) |
| Reconnection restored | `inline-action` | Flash "Reconnected" (2s) | Conferma locale, non cross-page |
| Job completion | `page-state` | Transizione a stato `Completed` | Cambio strutturale di pagina (il pannello mostra risultati, non più progresso) |
| Job cancelled | `page-state` | Transizione a stato `Cancelled` → `Initial` | Reset strutturale del pannello |

**Regola di precedenza applicata** (§7 channel precedence):
1. Se l'utente può agire nel contesto corrente → `inline-action` (errori, disconnessioni, conflitti)
2. Se l'evento rappresenta un cambio di stato strutturale della pagina → `page-state` (completion, cancel)
3. Nessun evento di questo pannello ha rilevanza cross-page → `global` non usato

**Anti-pattern evitati** (§8):
- ❌ Errori mostrati sia inline che global (duplicazione)
- ❌ Completion via toast globale (perdita di contesto)
- ❌ Disconnection via `page-state` (non è un cambio strutturale, è un evento recuperabile)

## 13. CSS Architecture (Design Token Compliant)

### 13.1 Token Mapping to `styles.css`

This component uses zero new CSS custom properties. Every style value maps to an existing token from `styles.css` `:root` (Section 12.1, 12.3 of the [Frontend UI Ubiquitous Language Spec](../specifications/frontend-ui-ubiquitous-language-spec.md)):

| Semantic Role | `styles.css` Token | Light Value | Dark Value |
|---|---|---|---|
| Status: queued, running | `--workspace-blue` | `#2563eb` | `#2563eb` |
| Status: completed, step done | `--success-pine` | `#15803d` | `#15803d` |
| Status: failed, step error (fg) | `--error-fg` | `#7f1d1d` | `#fecaca` |
| Status: cancelled | `--text-muted` | `#475569` | `#94a3b8` |
| Step idle dot | `--border-subtle` | `rgba(15,23,42,0.14)` | `rgba(148,163,184,0.2)` |
| Step active (running) accent | `--workspace-blue` | `#2563eb` | `#2563eb` |
| Error banner background | `--error-bg` | `rgba(180,35,24,0.1)` | `rgba(180,35,24,0.16)` |
| Error banner border | `--error-border` | `rgba(180,35,24,0.34)` | `rgba(248,113,113,0.36)` |
| Active step row background | `--interactive-soft` | `rgba(37,99,235,0.1)` | `rgba(59,130,246,0.16)` |
| Progress bar track | `--border-subtle` | `rgba(15,23,42,0.14)` | `rgba(148,163,184,0.2)` |
| Progress bar fill (running) | `--workspace-blue` | `#2563eb` | `#2563eb` |
| Progress bar fill (complete) | `--success-pine` | `#15803d` | `#15803d` |

| Spacing/Radius Role | `styles.css` Token | Value |
|---|---|---|
| Component border-radius (card-level) | `--radius-card` | `12px` |
| Button border-radius (CTA) | `--radius-button` | `8px` |
| Status badge border-radius (pill) | `--radius-chip` | `999px` |
| Internal padding/gaps | `--space-1`, `--space-1-5`, `--space-2`, `--space-3` | `8px`, `12px`, `16px`, `24px` |
| Step row min-height | `--space-4` | `32px` (40px via padding) |

### 13.2 Governance Compliance Verification

| Requirement (UL Spec) | Compliance |
|---|---|
| §12.1: Tokens in `styles.css` `:root` only | ✅ Zero new `:root` variables; all values reference existing tokens |
| §12.2: No `var(--mui-palette-*)` | ✅ No MUI palette references anywhere |
| §12.3: No hardcoded colors | ✅ All colors via `--*` tokens; no `#fff`, no `rgba()` |
| §12.4: No hardcoded spacing | ✅ All spacing via `--space-*` tokens |
| §12.5: No hardcoded border-radius | ✅ All radii via `--radius-*` tokens |
| §12.8: Dark mode completeness | ✅ Every token has a `:root[data-theme='dark']` override in `styles.css` |

### 13.3 Class Naming Convention

```
.ui-feedback-panel            ← root
.ui-feedback-panel-header     ← heading + status badge row
.ui-feedback-badge            ← status badge pill
.ui-feedback-badge--queued    ← modifier
.ui-feedback-badge--running
.ui-feedback-badge--completed
.ui-feedback-badge--failed
.ui-feedback-badge--cancelled
.ui-feedback-activity         ← current activity description text
.ui-feedback-preflight        ← pre-flight readiness section
.ui-feedback-preflight-item   ← individual readiness check row
.ui-feedback-preflight-item--done
.ui-feedback-preflight-item--missing
.ui-feedback-progress         ← progress bar wrapper
.ui-feedback-progress-fill    ← progress bar fill element
.ui-feedback-progress-label   ← "3/7 steps" label
.ui-feedback-tracker          ← step tracker list (ol)
.ui-feedback-step             ← individual step (li)
.ui-feedback-step--idle
.ui-feedback-step--running
.ui-feedback-step--done
.ui-feedback-step--error
.ui-feedback-step-icon        ← status icon circle
.ui-feedback-step-label       ← step name
.ui-feedback-step-detail      ← optional detail line (artifact link, error detail)
.ui-feedback-actions          ← action bar container
.ui-feedback-error            ← error banner
.ui-feedback-reconnect        ← reconnection notice
.ui-feedback-empty            ← empty state guide
.ui-feedback-skeleton         ← loading skeleton
```