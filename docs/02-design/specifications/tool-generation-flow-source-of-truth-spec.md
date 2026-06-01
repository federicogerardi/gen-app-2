---
goal: Source of truth machine-friendly per il flow tool generation frontend
version: 1.2
date_created: 2026-05-02
last-reviewed: 2026-05-23
next-review-date: 2026-08-03
status: Active
owner: Frontend Platform Team
tags: [xstate, tool-generation, source-of-truth, frontend, state-machine]
---

# Tool Generation Flow Source Of Truth (Frontend)

> ⚑ **DDD Reference**: This document describes the ToolPage state machine and derived view model. For canonical domain terminology and flow, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md#frontend--ui-context) — `ToolPage`, `ReadinessSnapshot`, `CanonicalToolUiState`, `HydrationResult`, `WorkflowRunMode`
> - [Tool Generation Flow — Generation Context](../tool-generation-flow-generation-context.md) — complete cross-context visual flow
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — decisions on UI state (DDD-006, DDD-013, DDD-014, DDD-020, DDD-084, DDD-085)

## 1. Scope

Questo documento definisce il contratto astratto e canonico del flow tool generation lato frontend.

Obiettivo:
- avere una base stabile per implementazione, review e refactor futuri
- evitare divergenza tra UI, orchestrazione e stato macchina
- preservare la visione XState-first

Out of scope:
- dettagli visual design
- contratti backend non necessari alla logica frontend

## 2. Bounded Context

Contesto dominio: `tool generation page`.

Responsabilita del bounded context:
1. setup input (project + briefing context)
2. resume/regenerate da checkpoint e artifact history
3. orchestrazione start/cancel/retry step flow
4. esposizione stato deterministico alla UI tramite selector macchina

## 3. Canonical Actors

Actor tree frontend (astratto):

```text
toolPageMachine
|- briefingUploadMachine
|- toolFlowMachine
```

Ownership:
1. `toolPageMachine`
- source of truth del page state
- progress state per step
- readiness snapshot con reason codes
- decisioni di abilitazione start generation
- on terminal stream failure without a recoverable `failedStep`, the terminal bridge must still force the page out of `generating` by driving `STEP_FAILED` when possible and `CANCEL_GENERATION` as the unblock path

2. `briefingUploadMachine`
- upload/extraction lifecycle (`idle|uploading|extracting|ready`)
- recovery extraction event-driven

3. `toolFlowMachine`
- stato step runtime (`idle|running|error|done|failed`)

## 4. Canonical Data Model

### 4.1 Readiness Snapshot

Schema canonico:

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

Regola canonica:

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
1. `toolPageMachine.context.viewModel` e l'unica sorgente canonica per decisioni UI.
2. `ToolPageTemplate` non puo derivare localmente policy primaria o canonical state.
3. `ToolGenerationFlowVertical` riceve dati pronti dal viewModel e non calcola policy.

## 5. Event Contract (Frontend Internal)

Eventi canonici del flow page:
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

Payload minimo `PROGRESS_SYNCED`:

```ts
{
  type: 'PROGRESS_SYNCED';
  artifacts: GenerationArtifact[];
  intent: 'new' | 'resume' | 'regenerate';
  sourceArtifact: GenerationArtifact | null;
  runRequestPrefix: string | null;
}
```

Nota: la macchina deve derivare internamente `readiness` dal payload e dal proprio context (`projectId`).

## 6. Canonical State Semantics

Stati page machine:
1. `configuring`
2. `generating`
3. `completed`

Invarianti:
1. in `configuring`, `briefingUploadMachine` deve essere disponibile
2. transizione `configuring -> generating` ammessa solo con `readiness.canStartFlow = true`
3. `CANCEL_GENERATION` deve riportare a `configuring` senza side effects residui attivi
4. `RESET` deve azzerare progress/readiness e ricreare subtree child actor
5. `STEP_FAILED` può essere emesso anche come derivazione del terminal stream bridge quando il backend termina in `failed` ma non espone un `failedStep` recuperabile

## 7. Decision Table (Readiness)

| hasProject | hasExtractionContext | hasPrimaryTargetStep | canStartFlow | reasonCodes |
|---|---|---|---|---|
| false | false | false | false | missing_project, missing_extraction_context, missing_primary_target_step |
| true | false | false | false | missing_extraction_context, missing_primary_target_step |
| true | true | false | false | missing_primary_target_step |
| true | true | true | true | (empty) |

## 8. UI Contract (Machine-Driven)

Regola XState-first:
1. la UI legge lo stato da selector macchina
2. la UI non deve duplicare logica decisionale di readiness
3. il blocco `Pronto per la generazione` deve essere guidato da `readiness.reasonCodes`
4. le CTA principali devono usare `viewModel.primaryActionPolicy`
5. il rendering step deve usare `viewModel.stepStatuses`

Mapping reason code -> feedback:

| Reason code | Feedback UI canonico |
|---|---|
| `missing_project` | Seleziona un progetto |
| `missing_extraction_context` | Carica o recupera un brief |
| `missing_primary_target_step` | In attesa dello step disponibile |

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

Campi esplicitamente non necessari nel contract verticale corrente:
1. `readinessReasonCodes`
2. `steps`
3. `completedStepsCount` + `totalStepsCount`

## 8c. Status Naming Convergence Guard (DDD-085)

Regola anti-drift tra livelli:
1. `ToolStepStatus` conserva `done` come stato terminale step-level.
2. `CanonicalToolUiState` conserva `completed` come stato terminale panel-level.
3. `ToolGenerationFlowVertical` deve proiettare il terminale del preload bar solo come `completed` (`BarVariant = 'completed'`, CSS `.workflow-preload-bar.is-completed`).
4. `is-done` e `BarVariant = 'done'` sono vietati nella superficie preload bar.

Gates di enforcement:
1. test comportamentale: `ToolGenerationFlowVertical.test.tsx`
2. static guard cross-file: `ToolGenerationFlowVertical.status-naming.guard.test.ts`

## 9. Recovery & Compatibility Rules

Regole resume/checkpoint:
1. recovery checkpoint deve supportare artifact legacy privi di `sourceRequest.input.toolKey`
2. fallback extraction recovery deve restare deterministico per progetto/tool/briefing quando disponibile
3. in caso di cancel durante run, lo step interrotto deve diventare checkpoint locale riprendibile

## 10. Acceptance Gates

Checklist minima per modifiche future al flow:
1. `toolPageMachine.test` verde (guardie + readiness snapshot + transizioni)
2. `ToolPageTemplate.test` verde (CTA coerente con guard macchina)
3. `ToolGenerationFlowVertical.test` verde (single-bar state mapping deterministico)
4. `ToolGenerationFlowVertical.status-naming.guard.test` verde (convergenza naming component/CSS/test)
5. smoke test manuale checkpoint resume: esito OK

## 11. Versioning Policy

Regole aggiornamento documento:
1. bump minor (`x.y -> x.(y+1)`) per cambi semantici compatibili
2. bump major (`x -> x+1`) per breaking change di contract eventi/state
3. ogni update deve includere delta esplicito nei docs attivi (index overview + changelog development)

## 12. Sprint 5 Delta (2026-05-02)

1. formalizzata ownership completa del `viewModel` macchina come source of truth UI.
2. esplicitato limite architetturale del template: presenter-thin senza derivazioni policy/stato.
3. allineato contract minimale del verticale ai campi realmente consumati.

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

**Obbligatori**:
- Progetto (`projectId`) — Selezione tramite dialog. Richiesto per abilitare upload briefing.
- Briefing file (`uploadedFileName` + contenuto estratto) — Formati: `.docx`, `.txt`, `.md`. Attiva pipeline upload → extraction → review.

**Facoltativi**:
- Modello (`model`) — Select LLM con default da lista disponibili.
- Tono (`tone`) — Select con hint contestuale.
- Note (`notes`) — Textarea opzionale (visibile dopo extraction ready); usata come istruzione additiva pre-generazione.

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

**Abilitazione**:
- Input file disabilitato quando: nessun progetto selezionato, fase in `uploading/extracting`, generazione in corso.

**Stati**:
- `idle`: nessun briefing caricato
- `uploading`: caricamento file in corso
- `extracting`: estrazione briefing in corso
- `ready`: contesto pronto; `ExtractionContext` popolato (termine canonico UL)
- `error`: messaggio esposto; possibilità di nuovo upload/reset

**Output**:
- `extractionPayload` (ExtractionContext canonico)
- Eventuale `uploadError` o `extractionError`
- Abilitazione CTA primaria se precondizioni soddisfatte

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
1. Utente apre tool (`/tools/funnel-pages` o `/tools/nextland`)
2. Seleziona progetto
3. Fornisce gli input richiesti dal tool (direct input, file upload, API acquisition settings)
4. Clicca la CTA primaria visibile `Avvia la generazione`
5. FE esegue `Start Context Generation Action` quando il contesto non è ancora pronto
6. Attende completamento `Context Generation Phase` (extraction + fetch + merge, per configurazione tool)
7. FE avvia automaticamente la generazione step-1 con payload composito già pronto, senza secondo click
8. Osserva avanzamento globale e per-step
9. Apre artefatti o rilancia generazione

**Resume/Regenerate path**:
1. Utente arriva con `sourceArtifactId` + `intent` (`resume` o `regenerate`)
2. Tool precompila contesto da artifact/checkpoint
3. CTA primaria diventa contestuale: `Riprendi dal checkpoint` o `Rigenera`
4. Azioni secondarie disponibili: `Rigenera da zero`, `Resetta setup`, `Nuova generazione`

### 9.4 State-to-Action Routing

Mappa canonica stato → CTA:

| Stato UI | CTA primaria | CTA secondarie tipiche |
|---|---|---|
| `draft-empty` | Completa dati obbligatori | Riprendi da checkpoint |
| `processing-briefing` | Caricamento/Estrazione in corso | nessuna |
| `draft-ready` | Avvia generazione | Riprova estrazione, Resetta setup |
| `prefilled-regenerate` | Rigenera | Resetta setup |
| `running` | Generazione in corso (disabilitato) | nessuna |
| `paused-with-checkpoint` | Riprendi dal checkpoint | Rigenera da zero, Resetta setup |
| `completed` | Apri ultimo artefatto | Rigenera, Nuova generazione |

**Principi reattivita**:
- In `processing-briefing`: bottone disabilitato con label caricamento/estrazione
- In `running`: bottone disabilitato; cancel interrompe e crea checkpoint locale dello step interrotto
- Post-cancel: CTA primaria diventa `Riprendi dal checkpoint` (non torna a start finche checkpoint non è completato)
- Resume deve usare nuovo `requestId` run-level (evita collisioni idempotency del run cancellato)

### 9.5 Workflow Panel `ui-fv-dashboard` Contract (Deterministic Spec)

**Ruolo**: `ToolGenerationFlowVertical` rappresenta il monitor runtime del Tool Workspace con composizione a due card (`Progress`, `Informazioni di contesto`) secondo DDD-084.

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
| `draft-empty` | context-generation | `idle` | `Context generation in attesa` |
| `resume-needs-briefing` | context-generation | `idle` | `Context generation in attesa` |
| `processing-briefing` | context-generation | `active` | `Context generation in corso` |
| `draft-ready` | context-generation | `idle` | `Context generation completata` |
| `running` | generation | `active` | `Generazione in corso` |
| `paused-with-checkpoint` | generation | `idle` | `Generazione in pausa` |
| `completed` | generation | `completed` | `Generazione completata` |
| `prefilled-regenerate` | generation | `idle` | `In attesa di avvio` |

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
   - Metric 1: `Step corrente: ${extractionProgress.currentStepLabel}`
   - Metric 2: `extractionProgress.statusLabel`
2. Generation phase (`phase = generation`):
   - Metric 1: `Step corrente: ${generationProgress.currentStepLabel}`
   - Metric 2: `${completedCount} / ${totalCount} step completati`

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

**Resume da checkpoint** (artifact detail page):
- Bottone disponibile se checkpoint riusabile esiste nel progetto
- Query params: `sourceArtifactId`, `projectId`, `intent=resume`, optional `tone`, `notes`
- Stato UI → `paused-with-checkpoint`
- CTA primaria → `Riprendi dal checkpoint` (riavvia dallo step interrotto, non dal primo)

**Regenerate variante** (artifact detail page):
- Bottone sempre disponibile per workflow supportati
- Query params: `sourceArtifactId`, `projectId`, `intent=regenerate`, optional `tone`, `notes`
- Stato UI → `prefilled-regenerate`
- CTA primaria → `Rigenera` (avvia run completa nuova variante)

**Post-cancel durante run**:
- Click cancel → interrompe stream → pausa con checkpoint dello step interrotto
- CTA primaria: **non** torna a `Avvia generazione` subito; diventa `Riprendi dal checkpoint`
- CTA secondarie: `Rigenera da zero`, `Resetta setup`
- Effetto UX: utente vede sempre next action valida, senza dead-end

---

## 13. References & Related Docs
