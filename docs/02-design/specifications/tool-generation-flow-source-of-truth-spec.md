---
goal: Machine-friendly source of truth for the frontend tool generation flow
version: 1.3
date_created: 2026-05-02
last-reviewed: 2026-06-04
next-review-date: 2026-09-04
status: active
owner: Frontend Platform Team
tags: [xstate, tool-generation, source-of-truth, frontend, state-machine, non-streaming]
type: specification
---

# Tool Generation Flow Source Of Truth (Frontend)

> ⚑ **DDD Reference**: This document describes the ToolPage state machine and derived view model. For canonical domain terminology and flow, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md#frontend--ui-context) — `ToolPage`, `ReadinessSnapshot`, `CanonicalToolUiState`, `HydrationResult`, `WorkflowRunMode`
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — decisions on UI state (DDD-006, DDD-013, DDD-014, DDD-020, DDD-084, DDD-085)

## 1. Scope

This document defines the abstract and canonical contract of the frontend tool generation flow.

Objective:
- have a stable base for implementation, review and future refactoring
- avoid divergence between UI, orchestration and machine state
- preserve the XState-first vision

Out of scope:
- visual design details
- backend contracts not necessary for frontend logic

> **Architectural note (v1.3)**: Starting from June 2026, the generation path for tools has been migrated to the **non-streaming** model (`POST /generation/run`, JSON response). The streaming path (`POST /generation/stream`, SSE) remains intact but dormant for future uses (e.g., chat with typing effect). The frontend uses `frontendGenerationMachine` as default for tools, while `frontendStreamMachine` remains available. For complete technical details of the migration, see [Non-Streaming Generation Migration Plan](../../99-lifecycle/99-archive/plans/migrate-to-nonstreaming-generation.md).

## 2. Bounded Context

Domain context: `tool generation page`.

Bounded context responsibilities:
1. setup input (project + briefing context)
2. resume/regenerate from checkpoint and artifact history
3. orchestration start/cancel/retry step flow
4. deterministic state exposure to UI via machine selector

## 3. Canonical Actors

Frontend actor tree (abstract):

```text
toolPageMachine
|- briefingUploadMachine
|- toolFlowMachine
```

Ownership:
1. `toolPageMachine`
- source of truth for page state
- progress state per step
- readiness snapshot with reason codes
- start generation enablement decisions
- on terminal stream failure without a recoverable `failedStep`, the terminal bridge must still force the page out of `generating` by driving `STEP_FAILED` when possible and `CANCEL_GENERATION` as the unblock path

2. `briefingUploadMachine`
- upload/extraction lifecycle (`idle|uploading|extracting|ready`)
- recovery extraction event-driven

3. `toolFlowMachine`
- step runtime state (`idle|running|error|done|failed`)

## 4. Canonical Data Model

### 4.1 Readiness Snapshot

Canonical schema:

```ts
type ReadinessReasonCode =
  | 'missing_project'
  | 'missing_extraction_context'
  | 'missing_primary_target_step';

type ReadinessSnapshot = {
  canStartFlow: boolean;
  hasProject: boolean;
  hasExtractionContext: boolean;
  hasPrimaryTargetStep: boolean;
  reasonCodes: ReadinessReasonCode[];
};
```

Canonical rule:

```text
canStartFlow = hasProject AND hasExtractionContext AND hasPrimaryTargetStep
```

Readiness completeness rule:

```text
hasExtractionContext = true only when the effective ExtractionContext is complete enough
to assemble a valid GenerationRequest.

For artifact-driven relaunch hydration, completeness requires:
- non-empty briefing text recovered from the artifact briefingText source
- a resolved extraction artifact identity (`extractionArtifactId` + `briefingId`), with extraction payload treated as optional passthrough at readiness stage

A non-null HydrationResult alone is not sufficient.
```

### 4.2 Progress Snapshot

```ts
type ToolPageProgressState = {
  completedSteps: Set<ToolStep>;
  latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  lastCheckpointStep: ToolStep | null;
};
```

### 4.3 ViewModel Snapshot (Machine Source Of Truth)

```ts
type ToolPageViewModel = {
  readiness: ReadinessSnapshot;
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  stepStatuses: Record<ToolStep, 'idle' | 'running' | 'done' | 'error'>;
  messages: {
    status: string | null;
    error: string | null;
  };
};
```

Ownership rule:
1. `toolPageMachine.context.viewModel` is the only canonical source for UI decisions.
2. `ToolPageTemplate` cannot locally derive primary policy or canonical state.
3. `ToolGenerationFlowVertical` receives ready data from viewModel and does not calculate policy.

## 5. Event Contract (Frontend Internal)

Canonical page flow events:
1. `PROJECT_SELECTED`
2. `BRIEFING_FILE_SELECTED`
3. `BRIEFING_RESET`
4. `PROGRESS_SYNCED`
5. `REQUEST_STEP_START`
6. `STEP_REQUEST_DISPATCHED`
7. `STEP_DONE`
8. `STEP_FAILED`
9. `RETRY_STEP`
10. `CANCEL_GENERATION`
11. `RESET`

Minimum `PROGRESS_SYNCED` payload:

```ts
{
  type: 'PROGRESS_SYNCED';
  artifacts: GenerationArtifact[];
  intent: 'new' | 'resume' | 'regenerate';
  sourceArtifact: GenerationArtifact | null;
  runRequestPrefix: string | null;
}
```

Note: the machine must internally derive `readiness` from the payload and its own context (`projectId`).

## 6. Canonical State Semantics

Page machine states:
1. `configuring`
2. `generating`
3. `completed`

Invariants:
1. in `configuring`, `briefingUploadMachine` must be available
2. `configuring -> generating` transition allowed only with `readiness.canStartFlow = true`
3. `CANCEL_GENERATION` must return to `configuring` without active residual side effects
4. `RESET` must zero out progress/readiness and recreate child actor subtree
5. `STEP_FAILED` can also be emitted as derivation of the terminal stream bridge when the backend terminates in `failed` but does not expose a recoverable `failedStep`

## 7. Decision Table (Readiness)

| hasProject | hasExtractionContext | hasPrimaryTargetStep | canStartFlow | reasonCodes |
|---|---|---|---|---|
| false | false | false | false | missing_project, missing_extraction_context, missing_primary_target_step |
| true | false | false | false | missing_extraction_context, missing_primary_target_step |
| true | true | false | false | missing_primary_target_step |
| true | true | true | true | (empty) |

## 8. UI Contract (Machine-Driven)

XState-first rule:
1. the UI reads state from machine selector
2. the UI must not duplicate readiness decision logic
3. the `Ready for generation` block must be driven by `readiness.reasonCodes`
4. primary CTAs must use `viewModel.primaryActionPolicy`
5. step rendering must use `viewModel.stepStatuses`

Reason code -> feedback mapping:

| Reason code | Canonical UI feedback |
|---|---|
| `missing_project` | Select a project |
| `missing_extraction_context` | Upload or retrieve a brief |
| `missing_primary_target_step` | Waiting for available step |

Contract verticale minimo (`ToolGenerationFlowVertical`) — DDD-084:
1. `canonicalState`
2. `projectName`
3. `errorMessage`

## 8b. DDD-081 Readiness Branch Outcomes

Tool setup file policy introduces two deterministic outcomes at page-flow level:

1. Required complete + optional missing
- Transition: remains ready.
- `ReadinessSnapshot.canStartFlow`: true.
- CTA: enabled.
- Feedback: non-blocking advisory near CTA and optional inline recommendations.

2. Required missing
- Transition: remains blocked.
- `ReadinessSnapshot.canStartFlow`: false for start action.
- CTA: disabled.
- Feedback: blocking message listing missing required files in stable policy order.

Flow invariant:

- Optional-file absence never blocks generation start.
- Required-file absence always blocks generation start.

Fields explicitly not necessary in the current vertical contract:
1. `readinessReasonCodes`
2. `steps`
3. `completedStepsCount` + `totalStepsCount`

## 8c. Status Naming Convergence Guard (DDD-085)

Anti-drift rule across levels:
1. `ToolStepStatus` conserva `done` come stato terminale step-level.
2. `CanonicalToolUiState` conserva `completed` come stato terminale panel-level.
3. `ToolGenerationFlowVertical` deve proiettare il terminale del preload bar solo come `completed` (`BarVariant = 'completed'`, CSS `.workflow-preload-bar.is-completed`).
4. `is-done` e `BarVariant = 'done'` sono vietati nella superficie preload bar.

Enforcement gates:
1. test comportamentale: `ToolGenerationFlowVertical.test.tsx`
2. static guard cross-file: `ToolGenerationFlowVertical.status-naming.guard.test.ts`

## 9. Recovery & Compatibility Rules

Resume/checkpoint rules:
1. recovery checkpoint must support legacy artifacts lacking `sourceRequest.input.toolKey`
2. fallback extraction recovery must remain deterministic for project/tool/briefing when available
3. in case of cancel during run, the interrupted step must become a resumable local checkpoint

## 10. Acceptance Gates

Minimum checklist for future flow changes:
1. `toolPageMachine.test` green (guards + readiness snapshot + transitions)
2. `ToolPageTemplate.test` green (CTA consistent with machine guard)
3. `ToolGenerationFlowVertical.test` green (single-bar state mapping deterministic)
4. `ToolGenerationFlowVertical.status-naming.guard.test` green (naming convergence component/CSS/test)
5. manual checkpoint resume smoke test: OK outcome

## 11. Versioning Policy

Document update rules:
1. minor bump (`x.y -> x.(y+1)`) for compatible semantic changes
2. major bump (`x -> x+1`) for breaking changes in event/state contract
3. every update must include explicit delta in active docs (index overview + development changelog)

## 12. Sprint 5 Delta (2026-05-02)

1. formalized complete machine `viewModel` ownership as UI source of truth.
2. explicit template architectural limit: presenter-thin without policy/state derivations.
3. aligned minimal vertical contract to actually consumed fields.

---

## 9. UX Structure & Form Behavior

### 9.0 Context Generation Phase (umbrella pre-step semantics)

Canonical FE naming for the pre-step phase is `Context Generation Phase`.

Definition:
1. This phase assembles the effective payload for step-1 generation dispatch.
2. It may execute one or more source-specific sub-activities depending on tool configuration:
- text extraction from uploaded files;
- API-backed acquisition fetches;
- direct-input merge.
3. `Extraction` remains a valid sub-activity label when document processing is present, but does not define the whole phase for mixed-source tools.

Primary CTA contract:
1. The canonical action is `Start Context Generation Action`.
2. In the current runtime the visible primary CTA is unified under `Avvia la generazione`; a dedicated `Genera contesto` button is not rendered.
3. When context is not ready, the same click starts the full configured pre-step pipeline (extraction + fetch + merge), not extraction-only behavior.
4. On successful context completion, FE must auto-dispatch step-1 generation without requiring a second user click.

Progress contract:
1. During this phase, Workflow Panel progress represents `Context Generation Phase` state.
2. Source-specific details can be surfaced as sub-status items, but the top-level phase remains singular and deterministic.

### 9.1 Input Fields

**Mandatory**:
- Project (`projectId`) — Selection via dialog. Required to enable briefing upload.
- Briefing file (`uploadedFileName` + extracted content) — Formats: `.docx`, `.txt`, `.md`. Activates upload → extraction → review pipeline.

**Optional**:
- Model (`model`) — LLM select with default from available list.
- Tone (`tone`) — Select with contextual hint.
- Notes (`notes`) — Optional textarea (visible after extraction ready); used as pre-generation additive instruction.

### 9.1b Unified Input Requirement Matrix (three source families)

`ToolInputRequirementMatrix` is the canonical readiness gate across all pre-step input sources.

Source families:
1. `direct-input`
2. `tool-input-file`
3. `api-acquisition`

Requiredness values:
1. `always-required`
2. `required-by-tool-setting`
3. `optional-by-tool-setting`

Deterministic eligibility rule:
1. The unified primary CTA is enabled only when every matrix entry classified as `always-required` or `required-by-tool-setting` is satisfied.
2. Entries classified as `optional-by-tool-setting` are non-blocking and must never disable the primary pre-step CTA.

Feature-flag adapter gate (as-is runtime):
1. `api-acquisition` requiredness contributes to eligibility only when `VITE_FF_TOOLS_API_BINDING_STATUS = true`.
2. Default runtime keeps the flag off, so current tools preserve legacy behavior and do not block on API binding resolution.
3. When enabled, FE resolves binding connectivity through backend `GET /api/tools/api-services?apiServiceId=...` and projects `connected`/`disconnected` into the matrix.

Readiness outcome matrix:

| direct-input required | file required | api required | canStartContextGeneration | feedback |
|---|---|---|---|---|
| satisfied | satisfied | satisfied | true | optional advisories only |
| missing any required | any | any | false | blocking required-input feedback |
| satisfied | satisfied | optional missing | true | non-blocking optional advisory |
| satisfied | optional missing | satisfied | true | non-blocking optional advisory |
| optional missing only | optional missing only | optional missing only | true | non-blocking optional advisory |

### 9.2 Upload/Extraction Lifecycle

**Enabling**:
- Input file disabled when: no project selected, phase in `uploading/extracting`, generation in progress.

**States**:
- `idle`: no briefing loaded
- `uploading`: file upload in progress
- `extracting`: briefing extraction in progress
- `ready`: context ready; `ExtractionContext` populated (canonical UL term)
- `error`: message exposed; possibility of new upload/reset

**Output**:
- `extractionPayload` (canonical ExtractionContext)
- Any `uploadError` or `extractionError`
- Primary CTA enabled if preconditions met

Mixed-source extension:
1. File upload/extraction lifecycle remains valid for file-enabled tools.
2. API acquisition lifecycle runs in the same umbrella phase and contributes structured data to the composed context payload.
3. Direct-input values contribute deterministic merge fields in the same composed payload.
4. Completion of `Context Generation Phase` means the composed payload is ready for step-1 generation dispatch.

Component convergence rule:
1. FE components currently associated with extraction pre-step behavior are context-generation-level elements.
2. Their responsibilities remain local (validation, upload, extraction handling, readiness signaling), but their top-level orchestration ownership is `Context Generation Phase`.
3. This convergence must not add extra user steps, extra primary CTAs, or parallel pre-step progress bars.

### 9.3 User Action Sequences

**Happy path**:
1. User opens tool (`/tools/funnel-pages` or `/tools/nextland`)
2. Selects project
3. Provides the inputs required by the tool (direct input, file upload, API acquisition settings)
4. Clicks the visible primary CTA `Start generation`
5. FE executes `Start Context Generation Action` when context is not yet ready
6. Waits for `Context Generation Phase` completion (extraction + fetch + merge, per tool configuration)
7. FE automatically starts step-1 generation with composite payload already ready, without second click
8. Observes global and per-step progress
9. Opens artifacts or relaunches generation

**Resume/Regenerate path**:
1. User arrives with `sourceArtifactId` + `intent` (`resume` or `regenerate`)
2. Tool pre-fills context from artifact/checkpoint
3. Primary CTA becomes contextual: `Resume from checkpoint` or `Regenerate`
4. Secondary actions available: `Regenerate from scratch`, `Reset setup`, `New generation`

### 9.4 State-to-Action Routing

Canonical state → CTA map:

| UI State | Primary CTA | Typical secondary CTAs |
|---|---|---|
| `draft-empty` | Complete mandatory data | Resume from checkpoint |
| `processing-briefing` | Upload/Extraction in progress | none |
| `draft-ready` | Start generation | Retry extraction, Reset setup |
| `prefilled-regenerate` | Regenerate | Reset setup |
| `running` | Generation in progress (disabled) | none |
| `paused-with-checkpoint` | Resume from checkpoint | Regenerate from scratch, Reset setup |
| `completed` | Open last artifact | Regenerate, New generation |

**Reactivity principles**:
- In `processing-briefing`: disabled button with upload/extraction label
- In `running`: disabled button; cancel interrupts and creates local checkpoint of interrupted step
- Post-cancel: primary CTA becomes `Resume from checkpoint` (does not return to start until checkpoint is completed)
- Resume must use new run-level `requestId` (avoids idempotency collisions of cancelled run)

### 9.5 Workflow Panel `ui-fv-dashboard` Contract (Deterministic Spec)

**Role**: `ToolGenerationFlowVertical` represents the Tool Workspace runtime monitor with two-card composition (`Progress`, `Context Information`) per DDD-084.

#### 9.5.1 Canonical DOM Composition

1. Root region: `.ui-fv-root` (`role="region"`, `aria-label="Generation flow"`)
2. Dashboard container: `.ui-fv-dashboard`
3. Progress card: `.ui-fv-card` con `aria-labelledby="workflow-progress-title"`
4. Context card: `.ui-fv-card` con `aria-labelledby="workflow-context-title"`
5. Optional global blocking message: `.ui-fv-error` (`role="alert"`) quando `errorMessage != null`

#### 9.5.2 Canonical CSS Classes

| Class | Responsibility | Notes |
|---|---|---|
| `.ui-fv-root` | Structural wrapper only | Must remain non-card (no border/background card shell). |
| `.ui-fv-dashboard` | Vertical stack for panel cards | Owns inter-card spacing only. |
| `.ui-fv-card` | Visual card surface | Shared style for `Progress` and `Informazioni di contesto`. |
| `.workflow-preload-bar` | Unified progress element | Phase-agnostic base element. |
| `.workflow-preload-bar.is-idle` | Stop state | Neutral, non-animated bar. |
| `.workflow-preload-bar.is-active` | Play state | Animated preload. |
| `.workflow-preload-bar.is-paused` | Reserved paused variant | Kept for compatibility; current phase model maps pause to stop (`is-idle`). |
| `.workflow-preload-bar.is-completed` | Completion state | Must remain canonical completion token per DDD-085. |
| `.ui-fv-progress-metric` | Progress info rows | Two rows, phase-selective content. |
| `.ui-fv-context-project` | Project block inside context card | Adds `.is-done` when project is selected. |
| `.ui-fv-context-project.is-done` | Selected-project completed visual | Must align green token with `.ui-fv-payload-item.is-done`. |
| `.ui-fv-payload-item` | Context file row | Variants: `.is-todo`, `.is-active`, `.is-done`, `.is-error`. |

#### 9.5.3 Canonical State-to-UI Mapping

`ToolGenerationFlowVertical` must derive one `ProgressBarModel` from `CanonicalToolUiState`:

| CanonicalToolUiState | Phase | Bar variant | Aria label |
|---|---|---|---|
| `draft-empty` | context-generation | `idle` | `Context generation waiting` |
| `resume-needs-briefing` | context-generation | `idle` | `Context generation waiting` |
| `processing-briefing` | context-generation | `active` | `Context generation in progress` |
| `draft-ready` | context-generation | `idle` | `Context generation completed` |
| `running` | generation | `active` | `Generation in progress` |
| `paused-with-checkpoint` | generation | `idle` | `Generation paused` |
| `completed` | generation | `completed` | `Generation completed` |
| `prefilled-regenerate` | generation | `idle` | `Waiting to start` |

Deterministic rule:
1. `processing-briefing` must always animate preload (`is-active`).
2. Pause/cancel states (`paused-with-checkpoint`) must be stop mode (`is-idle`), not animated.
3. Completion must use `is-completed` and never `is-done` (DDD-085).

#### 9.5.4 Progress Metrics Contract (`.ui-fv-progress-metric`)

The progress card exposes two metric lines with phase-selective semantics.

`GenerationProgressSnapshot` contract:

```ts
type GenerationProgressSnapshot = {
  completedCount: number;
  totalCount: number;
  currentStepLabel: string | null;
  sessionId: string | null;
  extractionProgress?: {
    completedCount: number;
    totalCount: number;
    currentStepLabel: string | null;
    statusLabel: string;
  };
};
```

Metric rules:
1. Context generation phase (`phase = context-generation`):
   - Metric 1: `Current step: ${extractionProgress.currentStepLabel}`
   - Metric 2: `extractionProgress.statusLabel`
2. Generation phase (`phase = generation`):
   - Metric 1: `Current step: ${generationProgress.currentStepLabel}`
   - Metric 2: `${completedCount} / ${totalCount} steps completed`

Progress value rules:
1. Context generation phase value derives from `extractionProgress.completedCount / extractionProgress.totalCount`.
2. Generation phase value derives from `completedCount / totalCount`.
3. `completed` forces `aria-valuenow = 100`.

#### 9.5.5 Context Card Contract

1. Project block always visible in context card.
2. Project selected => `.ui-fv-context-project.is-done`.
3. File rows render only when a project is selected.
4. Without selected project: show empty-state guidance message.
5. Session handoff link (`Apri sessione →`) is visible only when `canonicalState = completed` and `sessionId` is available.

#### 9.5.6 Deterministic Intervention Checklist

Before changing `ui-fv-dashboard` behavior:
1. Update mapping table in this section if state semantics change.
2. Keep class-token convergence with DDD-085 (`is-completed`, no `is-done` preload variant).
3. Update tests in `ToolGenerationFlowVertical.test.tsx`.
4. Keep static guard green in `ToolGenerationFlowVertical.status-naming.guard.test.ts`.
5. If props contract changes, update this section and DDD decision log in the same patch.

### 9.6 Regeneration & Checkpoint Behavior

**Resume from checkpoint** (artifact detail page):
- Button available if reusable checkpoint exists in project
- Query params: `sourceArtifactId`, `projectId`, `intent=resume`, optional `tone`, `notes`
- UI state → `paused-with-checkpoint`
- Primary CTA → `Resume from checkpoint` (restarts from interrupted step, not from first)

**Regenerate variant** (artifact detail page):
- Button always available for supported workflows
- Query params: `sourceArtifactId`, `projectId`, `intent=regenerate`, optional `tone`, `notes`
- UI state → `prefilled-regenerate`
- Primary CTA → `Regenerate` (starts complete new variant run)

**Post-cancel during run**:
- Click cancel → interrupts stream → pauses with checkpoint of interrupted step
- Primary CTA: does **not** return to `Start generation` immediately; becomes `Resume from checkpoint`
- Secondary CTAs: `Regenerate from scratch`, `Reset setup`
- UX effect: user always sees valid next action, no dead-end

---

## 13. References & Related Docs
