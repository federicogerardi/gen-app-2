## 6.3 Workflow Machine (Client Funnel/NextLand)

Stati:

- idle
- running_step_1
- running_step_2
- running_step_3 (solo funnel)
- error
- done

Funnel dependencies:

- quiz richiede optinOutput
- vsl richiede optinOutput + quizOutput

NextLand dependencies:

- thank_you richiede landingOutput

Retry:

- retry con backoff per step retryable.
- notice utente durante retry.
- step in errore resta recuperabile senza perdere step gia done.

## 6.3-bis Workflow Machine Parametrica (Step Variabili)

Per nuovi tool, il modello client deve essere parametrico e non hardcoded su 2/3 step.

Contesto minimo parametrico:

- `tool_key: string`
- `workflow_type: string`
- `artifact_type: string`
- `steps: StepNode[]`
- `active_step_index: number`
- `dependency_graph: Record<string, string[]>`
- `step_outputs: Record<string, string>`
- `step_artifact_ids: Record<string, string>`
- `run_mode: 'new' | 'resume' | 'regenerate'`

Shape `StepNode`:

- `key: string`
- `status: idle | running | done | error | skipped`
- `retry_count: number`
- `error_message: string | null`

Regole runtime step-variabili:

- Avanzamento consentito solo se tutte le dipendenze dello step attivo sono `done`.
- `active_step_index` punta sempre al primo step non terminale (`idle|running|error`).
- In `resume`, gli step `done` non devono essere rigenerati salvo `regenerate` esplicito.
- Lo stato `done` globale si raggiunge solo quando tutti gli step required sono `done` o `skipped` ammessi.
- Il numero step e la topologia dipendenze provengono dal Tool Registry.

Eventi parametrizzati consigliati:

- `STEP_START({ step_key })`
- `STEP_SUCCESS({ step_key, output, artifact_id })`
- `STEP_FAILURE({ step_key, reason })`
- `STEP_RETRY({ step_key })`
- `STEP_SKIP({ step_key })`
- `WORKFLOW_COMPLETE`

7. `toolWorkflowMachine`
- actor lato client o shared orchestration.
- interpreta `steps[]`, `dependency_graph`, resume/regenerate.
- non incorpora logica tool-specific hardcoded oltre ai dati di registry.
`toolWorkflowMachine`

### Tabella Input As-Is (aggiornata)

| Campo input | Tipo | Obbligatorio | Note operative |
|---|---|---|---|
| `requestId` | `string` | si | Correlation id workflow/request-level |
| `registryVersion \| registrySnapshotRef` | `string` | si (almeno uno) | Selettore registry per-request |
| `toolKey` | `string` | si | Esempi: `funnel-pages`, `nextland` |
| `workflowType` | `string` | si | Allineato a `toolKey` nei flow tool-specific |
| `steps` | `WorkflowStepDescriptor[]` | si | Topologia step derivata da Tool Registry |
| `dependencyGraph` | `Record<string, string[]>` | si | Dipendenze step-by-step |
| `runMode` | `'new' \| 'resume' \| 'regenerate'` | si | Determina resume/regenerate policy |
| `bootstrap.stepKey` | `string` | no | Step di bootstrap pre-completato |
| `bootstrap.artifactId` | `string` | no | Artifact id da cui riprendere |
| `briefingId` | `string` | no | Id brief associato al workflow |
| `extractionArtifactId` | `string` | no | Artifact extraction usato come base |
| `extractionPayload` | `Record<string, unknown>` | no | Output extraction da propagare a ogni step |
| `stepDependencyArtifactIds` | `string[]` | no | Lista ordinata artifact dipendenti |
| `stepDependencyArtifactIdsByStep` | `Record<string, string>` | no | Mappa step -> artifact id dipendenza |
| `stepDependencyArtifactContentsByStep` | `Record<string, string>` | no | Mappa step -> contenuto artifact precedente per contesto progressivo |

Note di coerenza contesto progressivo:

- Step 1 riceve contesto extraction (`briefingId`, `extractionArtifactId`, `extractionPayload`).
- Step N riceve anche il contesto dei passi precedenti tramite:
  - `stepDependencyArtifactIdsByStep`
  - `stepDependencyArtifactContentsByStep` (quando disponibile).

### Tabella Output As-Is (aggiornata)

| Output | Tipo | Quando emesso | Significato |
|---|---|---|---|
| `WORKFLOW_STEP_UNLOCKED` | `{ requestId, sourceActor, timestamp, stepKey }` | completamento senza artifact corrente valido | Segnala step sbloccato per avanzamento workflow |
| `WORKFLOW_STEP_COMPLETED` | `{ requestId, sourceActor, timestamp, stepKey, artifactId }` | completamento con artifact corrente valido | Segnala step completato con artifact persistibile |

Invariante output:

- `artifactId` in `WORKFLOW_STEP_COMPLETED` deve essere propagato come dipendenza per gli step successivi.
- Nei flow multi-step il contesto request-level deve preservare extraction + dipendenze precedenti fino allo step finale.

