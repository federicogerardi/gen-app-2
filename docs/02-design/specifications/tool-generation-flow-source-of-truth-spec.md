---
goal: Source of truth machine-friendly per il flow tool generation frontend
version: 1.1
date_created: 2026-05-02
last-reviewed: 2026-05-03
next-review-date: 2026-08-03
status: Active
owner: Frontend Platform Team
tags: [xstate, tool-generation, source-of-truth, frontend, state-machine]
---

# Tool Generation Flow Source Of Truth (Frontend)

> ⚑ **DDD Reference**: This document describes the ToolPage state machine and derived view model. For canonical domain terminology and flow, see:
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md#frontend--ui-context) — `ToolPage`, `ReadinessSnapshot`, `CanonicalToolUiState`, `HydrationResult`, `WorkflowRunMode`
> - [Tool Generation Flow — Generation Context](../tool-generation-flow-generation-context.md) — complete cross-context visual flow
> - [Domain Naming Decision Log](../../07-governance/domain-naming-decision-log.md) — decisions on UI state (DDD-006, DDD-013, DDD-014, DDD-020)

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
- structured extractionPayload recovered through canonical extraction fallbacks

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

---

## 9. UX Structure & Form Behavior

### 9.1 Input Fields

**Obbligatori**:
- Progetto (`projectId`) — Selezione tramite dialog. Richiesto per abilitare upload briefing.
- Briefing file (`uploadedFileName` + contenuto estratto) — Formati: `.docx`, `.txt`, `.md`. Attiva pipeline upload → extraction → review.

**Facoltativi**:
- Modello (`model`) — Select LLM con default da lista disponibili.
- Tono (`tone`) — Select con hint contestuale.
- Note (`notes`) — Textarea opzionale (visibile dopo extraction ready); usata come istruzione additiva pre-generazione.

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

### 9.3 User Action Sequences

**Happy path**:
1. Utente apre tool (`/tools/funnel-pages` o `/tools/nextland`)
2. Seleziona progetto
3. Carica briefing file
4. Attende upload + extraction
5. (Opzionale) imposta modello, tono, note
6. Avvia generazione
7. Osserva avanzamento globale e per-step
8. Apre artefatti o rilancia generazione

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

### 9.5 ToolGenerationFlowVertical Component

**Ruolo**: Rappresenta stato globale in unica card con checklist dei prerequisiti e progresso step.

**Checklist globale**:
1. Progetto selezionato
2. Briefing disponibile
3. Estrazione completata
4. Pronto a generare

**Semantica badge**:
- `todo`: da completare
- `active`: in corso
- `done`: completato
- `error`: bloccato

**Informazioni card step**:
- Titolo, stato (badge), descrizione
- Preview output (testo formattato, scroll)
- Errore puntuale (se presente)
- CTA `Apri artefatto` (quando `artifactId` esiste)

**Comportamento preview**:
- Durante run: testo progresso contestuale
- A contenuto pronto: preview leggibile
- Senza output: messaggio `Nessun output ancora`

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
