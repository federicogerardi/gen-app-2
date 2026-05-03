---
goal: Source of truth machine-friendly per il flow tool generation frontend
version: 1.1
date_created: 2026-05-02
date_updated: 2026-05-02
status: Active
owner: Frontend Platform Team
tags: [xstate, tool-generation, source-of-truth, frontend, state-machine]
---

# Tool Generation Flow Source Of Truth (Frontend)

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

2. `briefingUploadMachine`
- upload/extraction lifecycle (`idle|uploading|extracting|ready`)
- recovery extraction event-driven

3. `toolFlowMachine`
- stato step runtime (`idle|running|error|done|failed`)

## 4. Canonical Data Model

### 4.1 Readiness Snapshot

Schema canonico:

```ts
type ToolPageReadinessReasonCode =
  | 'missing_project'
  | 'missing_extraction_context'
  | 'missing_primary_target_step';

type ToolPageReadinessSnapshot = {
  canStartFlow: boolean;
  hasProject: boolean;
  hasExtractionContext: boolean;
  hasPrimaryTargetStep: boolean;
  reasonCodes: ToolPageReadinessReasonCode[];
};
```

Regola canonica:

```text
canStartFlow = hasProject AND hasExtractionContext AND hasPrimaryTargetStep
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
  readiness: ToolPageReadinessSnapshot;
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
  hasExtractionContext: boolean;
  hasPrimaryTargetStep: boolean;
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

Contract verticale minimo (`ToolGenerationFlowVertical`):
1. `canonicalState`
2. `readinessReasonCodes`
3. `steps`
4. `completedStepsCount` + `totalStepsCount`
5. `errorMessage`

Campi esplicitamente non necessari nel contract verticale corrente:
1. `toolKey`
2. `currentRunningStep`
3. `statusMessage`

## 9. Recovery & Compatibility Rules

Regole resume/checkpoint:
1. recovery checkpoint deve supportare artifact legacy privi di `sourceRequest.input.toolKey`
2. fallback extraction recovery deve restare deterministico per progetto/tool/briefing quando disponibile
3. in caso di cancel durante run, lo step interrotto deve diventare checkpoint locale riprendibile

## 10. Acceptance Gates

Checklist minima per modifiche future al flow:
1. `toolPageMachine.test` verde (guardie + readiness snapshot + transizioni)
2. `ToolPageTemplate.test` verde (CTA coerente con guard macchina)
3. `ToolGenerationFlowVertical.test` verde (mapping reason codes deterministico)
4. smoke test manuale checkpoint resume: esito OK

## 11. Versioning Policy

Regole aggiornamento documento:
1. bump minor (`x.y -> x.(y+1)`) per cambi semantici compatibili
2. bump major (`x -> x+1`) per breaking change di contract eventi/state
3. ogni update deve includere delta esplicito nei docs attivi (index overview + changelog development)

## 12. Sprint 5 Delta (2026-05-02)

1. formalizzata ownership completa del `viewModel` macchina come source of truth UI.
2. esplicitato limite architetturale del template: presenter-thin senza derivazioni policy/stato.
3. allineato contract minimale del verticale ai campi realmente consumati.
