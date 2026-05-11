---
status: active
version: 1.0
date_created: 2026-05-11
last-reviewed: 2026-05-11
next-review-date: 2026-08-11
owner: Frontend Platform Team
type: ai-first-runtime-spec
---

# Tool Page Frontend Runtime Specification

> **AI-first document** — Written to eliminate inferential reconstruction by future agents. Every claim is traceable to a specific file and line range. Do not rely on this document alone: always cross-reference code before making changes.

> **DDD Reference**: canonical terms used here are defined in:
> - `docs/01-requirements/domain-ubiquitous-language-glossary.md` — glossary (including `GenerationWorkspace`, `ExtractionContextBridge`, `DispatchError`, `ReadinessSnapshot`, `ExtractionContext`, `HydrationResult`, `ToolPage`, `BriefingUpload`)
> - `docs/07-governance/domain-naming-decision-log.md` — DDD-059, DDD-060, DDD-061
> - `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — Tool Workspace Page archetype

---

## 1. File Map

| Role | File | Purpose |
|---|---|---|
| Orchestration hook | `apps/frontend/src/features/tools/runtime/useToolPage.ts` | Single entry point for all tool page logic |
| Page orchestrator machine | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` | XState v5 machine managing page lifecycle states |
| Briefing upload machine | `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` | XState v5 actor managing briefing file lifecycle |
| Step flow machine | `apps/frontend/src/features/tools/machines/tool-flow.machine.ts` | XState v5 actor managing step progression |
| Presentation component | `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` | Pure presentation: form + layout + CTA rendering |
| Generation workspace | `apps/frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` | React context — per-project `ExtractionContext` + stream state |
| Generation dispatch + assembly | `apps/frontend/src/features/tools/runtime/tools-client.ts` | `orchestrateToolStep`, `createStepRequest`, extraction assembly |
| Step hydration | `apps/frontend/src/features/generation/runtime/step-hydration.ts` | Read projections over `GenerationArtifact` history |
| Artifact client | `apps/frontend/src/features/artifacts/runtime/artifacts-client.ts` | `getArtifactById` — single artifact fetch with local cache |

Tool page wrapper files (minimal, one per tool):
- `apps/frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx`
- `apps/frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx`
- `apps/frontend/src/features/tools/youtube-lf-script/pages/YoutubeLfScriptToolPage.tsx`

---

## 2. State Machine Architecture

### 2.1 `toolPageMachine` (page orchestrator)

File: `apps/frontend/src/features/tools/machines/tool-page.machine.ts`

**Top-level states:**

| State | Meaning | Entry condition |
|---|---|---|
| `configuring` | Default waiting state. Form editable. Primary CTA governed by `ReadinessSnapshot`. | Initial; returned to after `CANCEL_GENERATION` |
| `hydrating` | Resolving extraction context from a prior artifact. | `HYDRATE_REQUESTED` event received |
| `generating` | Generation dispatched and in progress. | `REQUEST_STEP_START` event accepted |
| `completed` | All steps done for current run. | `STEP_DONE` event received with all steps complete |

**Key transitions:**

| From | Event | To |
|---|---|---|
| `configuring` | `HYDRATE_REQUESTED` | `hydrating` |
| `hydrating` | (hydration service resolves) | `configuring` |
| `configuring` | `REQUEST_STEP_START` | `generating` |
| `generating` | `STEP_REQUEST_DISPATCHED` | `generating` (clears `pendingStepStart`) |
| `generating` | `STEP_DONE` | `completed` or `configuring` (partial) |
| `generating` | `STEP_FAILED` | `configuring` |
| `generating` | `CANCEL_GENERATION` | `configuring` |
| `completed` | `PROGRESS_SYNCED` | `configuring` or `completed` (re-evaluated) |

**Machine context fields (selected):**

| Field | Type | Role |
|---|---|---|
| `hydrationResult` | `HydrationResult \| null` | Set by hydration service; used by `extractionInfo` builder in `useToolPage` |
| `readiness` | `ReadinessSnapshot` | Computed by `syncProgress` action on each `PROGRESS_SYNCED` event |
| `viewModel` | `ToolPageViewModel` | Computed by `buildToolPageViewModel`; drives CTA label and enabled state |
| `progress` | `{ completedSteps, latestArtifactByStep }` | Snapshot of completed step state per run |
| `pendingStepStart` | `{ step, runRequestPrefix } \| null` | Set when `REQUEST_STEP_START` received; cleared by `STEP_REQUEST_DISPATCHED` |
| `generationError` | `string \| null` | Stream-level error; distinct from `DispatchError` |

**`PROGRESS_SYNCED` event** — sent by `useToolPage` on every `generation.artifacts` change. Triggers `syncProgress` action:
- calls `deriveHasExtractionContext(toolKey, briefingActorRef, hydrationResult)` → updates `readiness.hasExtractionContext`
- calls `deriveHasPrimaryTargetStep(...)` → updates `readiness.hasPrimaryTargetStep`
- calls `buildToolPageViewModel(...)` → recomputes `viewModel`

### 2.2 `briefingUploadMachine` (spawned actor)

Spawned by `toolPageMachine` as `briefingActorRef`. Managed states:

| State | Trigger |
|---|---|
| `idle` | Initial; `BRIEFING_RESET` event |
| `validating` | `BRIEFING_FILE_SELECTED` event |
| `uploading` | File passes validation → POST to `/api/tools/briefs` |
| `extracting` | Upload complete → polls/streams extraction |
| `ready` | Extraction complete; all fields populated |
| `error` | Any step fails; `context.error` set |

**Context fields used by `useToolPage`:**

| Field | Type |
|---|---|
| `briefingId` | `string` — canonical briefing identifier |
| `extractionArtifactId` | `string` — ID of the extraction artifact |
| `normalizedText` | `string` — full briefing text extracted |
| `extractionPayload` | `Record<string, unknown>` — structured JSON payload |
| `parsedFormat` | `'json' \| 'text' \| null` |
| `fileName` | `string \| null` |
| `error` | `string \| null` |

### 2.3 `toolFlowMachine` (spawned actor)

Spawned by `toolPageMachine`. Tracks ordered step progression (`ToolStep[]`) with per-step `ToolStepStatus` values. Not directly consumed by `useToolPage`; progress is read indirectly through `generation.artifacts` via `StepHydration`.

---

## 3. `useToolPage` — Effect Inventory

File: `apps/frontend/src/features/tools/runtime/useToolPage.ts`

`useToolPage` is the single orchestration hook. All tool page wrappers delegate entirely to it. It owns nine numbered effects (plus the bridge sub-effect) and returns a typed object consumed by `ToolPageTemplate`.

### Effect #1 — One-shot prefill from route params (lines ~130–140)

**Purpose**: Set initial `projectId` from URL param into form state and generation workspace.
**Fires once**: guarded by `initialPrefillDoneRef`.
**Deps**: `[generation, initialProjectId, setFormState]`
**Side effects**: `setFormState`, `generation.setFocusedProjectId`

### Effect #2 — Resolve source artifact (lines ~190–215)

**Purpose**: Fetch the source artifact for `ArtifactRelaunch` entries. Tries local cache first (`generation.artifacts`); falls back to `getArtifactById`.
**Deps**: `[generation.artifacts, auth.apiBaseUrl, auth.capabilities, sourceArtifactId]`
**Side effects**: `setSourceArtifact`

### Effect #2b — ExtractionContextBridge (lines ~140–185)

> **Critical effect.** See DDD-060 for full rationale.

**Purpose**: Sync a ready `BriefingUpload` actor's extraction context into `GenerationWorkspace` so that `startGenerationStep` can read it via `workspaceExtractionContext`.

**Fires when**: `briefingSnapshot.matches('ready')` AND `normalizedProjectId` is non-empty AND all four required fields are non-empty (`briefingId`, `extractionArtifactId`, `normalizedText`, `parsedFormat`).

**Idempotency guard** (mandatory, prevents infinite render loop):
```ts
const isWorkspaceContextCurrent =
  workspaceExtractionContext !== null
  && workspaceExtractionContext.projectId === normalizedProjectId
  && workspaceExtractionContext.briefingId === briefingIdFromActor
  && workspaceExtractionContext.extractionArtifactId === extractionArtifactIdFromActor
  && workspaceExtractionContext.normalizedText === normalizedTextFromActor
  && workspaceExtractionContext.parsedFormat === parsedFormatFromActor
  && JSON.stringify(workspaceExtractionContext.extractionPayload) === JSON.stringify(extractionPayloadFromActor);
if (isWorkspaceContextCurrent) return;
generation.upsertExtractionContext({ ... });
```

**Why the guard is mandatory**: `generation.upsertExtractionContext` dispatches `EXTRACTION_UPSERTED` on `frontendStreamMachine`, updating `extractionByProject`. This causes `GenerationWorkspace` to re-render, which causes `workspaceExtractionContext` to change, which triggers this effect again — infinite loop. The guard breaks the cycle by returning early when all fields are already current.

**Deps**: `[briefingSnapshot, generation, normalizedProjectId, workspaceExtractionContext]`

### Effect #3 — Hydrate extraction context from source artifact (lines ~220–260)

**Purpose**: For artifact-driven relaunch entries, send `HYDRATE_REQUESTED` to `toolPageMachine` once the source artifact is loaded.
**Deps**: `[generation.artifacts, briefingId, extractionArtifactId, intent, normalizedProjectId, sourceArtifact, toolPageSend]`
**Side effects**: `toolPageSend({ type: 'HYDRATE_REQUESTED', ... })`

### Effect #4 — Sync project selection to machine (lines ~265–270)

**Purpose**: Notify `toolPageMachine` of project change via `PROJECT_SELECTED` event when `normalizedProjectId` changes.
**Deps**: `[normalizedProjectId, toolPageSend]`

### Effect #5 — Tone prefill (lines ~290–320)

**Purpose**: One-shot tone prefill from `relaunchTone` or `sourceArtifact` input fields.
**Fires once**: guarded by `tonePrefillDoneRef`.
**Deps**: `[relaunchTone, setFormState, sourceArtifact, sourceArtifactId]`

### Effect #6 — PROGRESS_SYNCED (line ~350)

**Purpose**: Send `PROGRESS_SYNCED` on every artifact list change so the machine can recompute `ReadinessSnapshot` and `ToolPageViewModel`.
**Deps**: `[generation.artifacts, briefingSnapshot, intent, sourceArtifact, toolPageSend]`

### Effect #7 — Dispatch pending step start (lines ~585–600)

> **The generation launch gate.** Changed in 2026-05-11 to fix the "step 1 non parte" regression.

**Triggers when**: `toolPageSnapshot.context.pendingStepStart` becomes non-null (set by `toolPageMachine` on `REQUEST_STEP_START`).

**Execution order** (critical):
1. Capture `pending.step` and `pending.runRequestPrefix`
2. Send `STEP_REQUEST_DISPATCHED` synchronously → clears `pendingStepStart` in machine, transitions machine out of `generating/waiting` sub-state
3. Await `startGenerationStep(capturedStep)` asynchronously
4. If `false` → `setDispatchError(...)` + `toolPageSend({ type: 'CANCEL_GENERATION' })` → machine returns to `configuring`

**Why step 2 must happen before step 3**: if `startGenerationStep` fails and `STEP_REQUEST_DISPATCHED` was never sent, `pendingStepStart` is still non-null and effect #7 fires again on the next render — infinite retry loop.

**Deps**: `[startGenerationStep, toolPageSend, toolPageSnapshot.context.pendingStepStart]`

### Effect #8 — Bridge: stream terminal → machine STEP_DONE/STEP_FAILED (lines ~605–645)

**Purpose**: When a generation stream ends, map the terminal event to the appropriate machine event.
**Pattern**: tracks `wasStreamActiveRef`; fires once when `isStreamActive` transitions from `true` to `false`.
**Deps**: `[generation.isStreamActive, generation.terminalCompletedStep, generation.terminalFailedStep, generation.streamStatus, generation.snapshot, toolConfig.steps, toolPageSend]`

### Effect #9 — Auto-chain (lines ~650–685)

**Purpose**: When `isAutoChainEnabled` is true and a step completes, automatically start the next available step.
**Deps**: `[completedStepsForFlow, currentRunningStep, generation.isStreamActive, generation.streamStatus, isAutoChainEnabled, nextAvailableStep, startGenerationStep]`

---

## 4. ExtractionContext Resolution Chain

`startGenerationStep` resolves `extractionInfo` via a deterministic four-step chain (lines ~445–480):

```
Priority 1: machineHydrationResult !== null
  → use hydrationResult.{extractionArtifactId, extractionPayload, briefingId, normalizedText}
  → fallback to briefingContextText if normalizedText is empty

Priority 2: workspaceExtractionContext !== null  (from GenerationWorkspace via ExtractionContextBridge)
  → use workspaceExtractionContext.{extractionArtifactId, extractionPayload, briefingId, normalizedText}

Priority 3: hasSourceArtifact === false AND briefingSnapshot.context.extractionArtifactId + briefingId present
  → use briefingSnapshot.context directly

Priority 4: none of the above → return null → startGenerationStep returns false
```

**Post-resolution enrichment** (lines ~482–515): if `extractionArtifactId` is present but payload or briefingText is empty, `getArtifactById` is called to recover missing fields from the artifact's content and `sourceRequest.input`.

---

## 5. Generation Dispatch Logic (`startGenerationStep`)

File: `apps/frontend/src/features/tools/runtime/useToolPage.ts` (lines ~400–580)

**Input**: `step: ToolStep`
**Returns**: `Promise<boolean>` — `true` on success, `false` on any failure

**Execution sequence**:
1. Guard: `!auth.session || !normalizedProjectId` → return `false`
2. Build `extractionInfo` via the resolution chain (Section 4)
3. If `extractionInfo === null` → return `false`
4. Post-resolution enrichment: fetch missing payload/text from extraction artifact if needed
5. Build `baseRequest: GenerationRequest` with `requestId = currentRunPrefixRef.current`
6. Call `orchestrateToolStep(projectId, toolKey, step, options)` → resolves `dependencyArtifactIdsByStep`
7. If `orchestrateToolStep` throws → `console.error` + return `false`
8. Build `dependencyArtifactContentsByStep` by looking up deps in `generation.artifacts`
9. Call `createStepRequest(baseRequest, toolKey, step, dependencies, contents)` → final `GenerationRequest`
10. Call `generation.start(request)` → begins SSE stream

**Debug logging** (DEV only): two `console.info` calls — one before (entry state) and one after (dispatched request fields, including `briefingTextLength` and `extractionPayloadKeys`).

---

## 6. CANCEL_GENERATION Recovery Path

**Trigger**: effect #7 calls `toolPageSend({ type: 'CANCEL_GENERATION' })` when `startGenerationStep` returns `false`.

**Machine handling** (`tool-page.machine.ts`): in `generating` state, `CANCEL_GENERATION` executes:
1. `cancelToolFlow` action → sends cancellation to `toolFlowMachine`
2. `raise('INTERNAL_CANCELLED')` → internal event → transition back to `configuring`
3. `clearGenerationError` action

**UI outcome**: machine returns to `configuring`; `DispatchError` local state is non-null; `<p className={uiPrimitives.error}>` is rendered adjacent to the primary CTA.

**CTA state**: `ReadinessSnapshot.canStartFlow` is re-evaluated; if still true, the primary CTA remains enabled and the user can retry immediately.

---

## 7. `handlePrimaryAction` — CTA Dispatch Sequence

File: `apps/frontend/src/features/tools/runtime/useToolPage.ts` (lines ~710–745)

```
if (primaryActionPolicy === 'open-last-artifact') → navigate to /artifacts/{lastArtifactId}
else:
  guard: !readinessSnapshot.canStartFlow → no-op
  guard: generation.isStreamActive → no-op
  guard: primaryTargetStep === null → no-op
  1. currentRunPrefixRef.current = generateRequestId()
  2. setDispatchError(null)          ← clears previous DispatchError
  3. setPausedCheckpointStep(null)
  4. setIsAutoChainEnabled(true)
  5. toolPageSend({ type: 'REQUEST_STEP_START', step: targetStep, runRequestPrefix })
     → machine: pending = { step, runRequestPrefix } → transitions to 'generating'
     → effect #7 fires on next render
```

---

## 8. `ReadinessSnapshot` Computation

Computed by `syncProgress` action in `toolPageMachine` on every `PROGRESS_SYNCED` event.

| Field | True when |
|---|---|
| `canStartFlow` | All three sub-flags are true |
| `hasProject` | `formState.projectId.trim().length > 0` |
| `hasExtractionContext` | `deriveHasExtractionContext(toolKey, briefingActorRef, hydrationResult)` — `briefingActorRef.matches('ready')` OR `hydrationResult !== null && hydrationResult` has required fields |
| `hasPrimaryTargetStep` | `deriveHasPrimaryTargetStep(...)` — `nextAvailableStep !== null` or policy allows regenerate |

**Warning**: `hasExtractionContext = true` does NOT guarantee that `workspaceExtractionContext` is populated. The machine only checks that the briefing actor is `ready` or a hydration result exists. The `ExtractionContextBridge` (effect #2b) is the mechanism that populates `workspaceExtractionContext` before dispatch. Without it, `startGenerationStep` would proceed past the readiness gate but fail at the `extractionInfo` null check.

---

## 9. `ToolPageTemplate` — Consumed Props

File: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

All props come from `useToolPage` return value. Selected mapping:

| Prop | Source | Use |
|---|---|---|
| `machineViewModel` | `toolPageSnapshot.context.viewModel` | Drives CTA label and enabled state |
| `readinessSnapshot` | `toolPageSnapshot.context.readiness` | Guards CTA click |
| `effectiveCanonicalState` | Computed: `isGenerating \|\| generation.isStreamActive ? 'running' : machineViewModel.canonicalState` | Drives Workflow Panel visual state |
| `dispatchError` | `dispatchError` local state | Rendered as `<p className={uiPrimitives.error}>` near CTA |
| `briefingError` | `briefingSnapshot.context.error` | Rendered in Setup Panel briefing area |
| `completedStepsForFlow` | `progressState.completedSteps` | Passed to `ToolGenerationFlowVertical` |
| `currentRunningStep` | `streamingStep` | Highlights active step in flow panel |
| `handlePrimaryAction` | `useCallback` in hook | Bound to primary CTA `onClick` |
| `handleBriefingFileSelected` | `useCallback` | Bound to file input change |
| `handleBriefingReset` | `useCallback` | Bound to briefing reset button |

---

## 10. Known Architecture Constraints and Open Issues

| ID | Constraint | Status |
|---|---|---|
| DDD-C-007 | `getStepDependencies` (FE) still called locally instead of routing through `orchestrateToolStep` BE endpoint | Open — provisional term `ToolStepOrchestration` registered (DDD-031); code refactor required |
| DDD-028 | `StepHydration` is a Client-Side Projection, not a Domain Service | Resolved/documented |
| DDD-038 | `extractionPayload` not part of readiness gate; only `normalizedText + briefingId + extractionArtifactId` required | Canonical |
| (none) | `ExtractionContextBridge` idempotency guard uses `JSON.stringify` on `extractionPayload` — may be slow for large payloads | Acceptable for current payload sizes; revisit if performance becomes an issue |
| (none) | `toolFlowMachine` step state is not the primary authority for completed steps in `useToolPage` — authority is `generation.artifacts` via `StepHydration`; the two must stay in sync | Monitor on new tool additions |

---

## 11. Regression Test Reference

| Test file | Coverage |
|---|---|
| `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` | 4/4 passing (2026-05-11). Covers: basic render, effect #7 dispatch flow, CANCEL_GENERATION recovery, ExtractionContextBridge idempotency |
| `apps/frontend/src/features/tools/runtime/tools-client.test.ts` | `createStepRequest` + extraction assembly (lines 134–187) |

---

## 12. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-05-11 | Initial document created. Documents state machines, 9 effects, ExtractionContext resolution chain, CANCEL_GENERATION recovery, ExtractionContextBridge pattern with idempotency guard, DispatchError UX pattern. All sections verified against live code. | AI-first doc session |
