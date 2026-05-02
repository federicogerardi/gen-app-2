# ToolGenerationFlowVertical: Contract And Runtime Behavior

## Scope

Documento tecnico as-is sul comportamento del componente verticale usato da `ToolPageTemplate`.

Obiettivi:
1. fissare il contract props realmente in uso.
2. documentare il mapping reason code -> dettaglio requisito.
3. evitare divergenze tra codice e documentazione durante i refactor.

## Canonical Props Contract

```ts
type ReadinessReasonCode =
  | 'missing_project'
  | 'missing_extraction_context'
  | 'missing_primary_target_step';

type StepStatus = 'idle' | 'running' | 'completed' | 'error';

interface FlowStepProgress {
  step: ToolStep;
  displayName: string;
  status: StepStatus;
  artifactId?: string | null;
  isStreaming?: boolean;
}

interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  briefingFileName: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  readinessReasonCodes: ReadonlyArray<ReadinessReasonCode>;
  briefingError: string | null;
  steps: FlowStepProgress[];
  completedStepsCount: number;
  totalStepsCount: number;
  errorMessage: string | null;
  onViewArtifact?: (artifactId: string) => void;
}
```

Campi rimossi dal contract (non usati):
1. `toolKey`
2. `currentRunningStep`
3. `statusMessage`

## Runtime Sections

### Input

Mostra checklist requisiti:
1. progetto
2. brief
3. pronto per la generazione

### Monitoring

Mostra:
1. progresso numerico e barra
2. elenco step con stato (`idle|running|completed|error`)
3. azione `Visualizza` sugli step completati con artifact

### Completion

Mostra:
1. conteggio artefatti
2. elenco step finali

## Readiness Reason Mapping

Mappa canonica interna:

```ts
const READINESS_DETAIL_BY_REASON = {
  missing_project: 'Seleziona un progetto',
  missing_extraction_context: 'Carica o recupera un brief',
  missing_primary_target_step: 'In attesa dello step disponibile',
};
```

Priorita deterministica quando arrivano piu reason code:
1. `missing_project`
2. `missing_extraction_context`
3. `missing_primary_target_step`

## State Derivation Rules

1. phase `input`: canonicalState non in `running|paused-with-checkpoint|prefilled-regenerate|completed`
2. phase `monitoring`: canonicalState in `running|paused-with-checkpoint|prefilled-regenerate`
3. phase `completion`: canonicalState `completed`

Instruction text:
1. determinato da `canonicalState`, `projectName`, `briefingStatus`
2. non dipende da logica locale del template

## Integration Contract With ToolPageTemplate

`ToolPageTemplate` deve:
1. passare `canonicalState` da `toolPageSnapshot.context.viewModel.canonicalState`.
2. passare `readinessReasonCodes` da `toolPageSnapshot.context.readiness.reasonCodes`.
3. passare `steps.status` da `viewModel.stepStatuses` con override `running` durante stream attivo.

## Test Gates

Test minimi obbligatori:
1. mapping `missing_project` -> `Seleziona un progetto`.
2. mapping `missing_extraction_context` -> `Carica o recupera un brief`.
3. mapping `missing_primary_target_step` -> `In attesa dello step disponibile` + badge `In attesa`.
4. fallback priorita multi-reason code deterministico.

## CSS Classes (As-Is)

Classi principali:
1. `ui-fv-root`
2. `ui-fv-section`
3. `ui-fv-checklist`
4. `ui-fv-steps`
5. `ui-fv-progress-bar`
6. `ui-fv-progress-fill`

## Usage Example

```ts
<ToolGenerationFlowVertical
  canonicalState="paused-with-checkpoint"
  projectName="My Project"
  briefingFileName="brief.docx"
  briefingStatus="ready"
  readinessReasonCodes={[]}
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
  completedStepsCount={1}
  totalStepsCount={3}
  errorMessage={null}
  onViewArtifact={(artifactId) => {
    // Navigate to artifact detail
  }}
/>
```

## Ownership Note

Decisioni policy/stato non appartengono a questo componente.
La source of truth resta `toolPageMachine.context.viewModel`.

---

**Doc Updated**: 2026-05-02
**Status**: Active (machine-aligned)
