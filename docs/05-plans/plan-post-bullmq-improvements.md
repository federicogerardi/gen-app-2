---
status: draft
version: 1.0
date_created: 2026-07-22
last-reviewed: 2026-07-22
next-review-date: 2026-10-22
owner: Backend Runtime + Frontend Tools
type: plan
tags: [xstate, ddd, developer-guide, domain-rules, zod, validation, actor-inspector, technical-debt]
goal: Implementare i miglioramenti post-go-live dell'architettura XState-as-Aggregate — developer guide (RISK-5), domain decision modules (RISK-3), Zod runtime validation (RISK-4), e actor inspector (RISK-6).
---

# Plan: Post-BullMQ Improvements — Developer Guide, Domain Modules, Zod, Inspector

> **Collegamenti**: [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) · [BullMQ Prerequisites Plan](./plan-bullmq-prerequisites.md) · DDD-167/DDD-168 (decomposed context accessors)

---

## 1. Scope and Goals

Questo piano copre quattro miglioramenti architetturali che **non sono gate di go-live** per il `ToolWorkflowJob` system BullMQ, ma riducono debito tecnico, accelerano l'onboarding, e aumentano la resilienza runtime.

| Rischio | Obiettivo | Gravità |
|---|---|---|
| **RISK-5** | Developer guide & annotazioni `@ddd` per mappare DDD→XState | Basso |
| **RISK-3** | Consolidare business logic distribuita in decision modules puri | Medio |
| **RISK-4** | Sostituire cast `as` unsafe con Zod runtime validation | Medio |
| **RISK-6** | Actor Inspector per ispezione runtime leggibile degli actor tree | Basso |

**Ordine di priorità**: RISK-5 → RISK-4 → RISK-3 → RISK-6

---

## 2. RISK-5 — Developer Guide & Code Annotations

**Stima effort**: 2-3 giorni

### 2.1 Motivazione

Il triplo cognitive load all'onboarding (DDD + XState v5 + mappatura tra i due) è il costo principale di questa architettura. Una developer guide centralizzata riduce il tempo di onboarding e serve come reference per il team esistente durante debugging cross-process (BullMQ).

### 2.2 Developer Guide: `xstate-as-aggregate-developer-guide.md`

**Nuovo documento**: `docs/02-design/specifications/xstate-as-aggregate-developer-guide.md`

**Outline proposto**:

```
1. Perché XState come Aggregate Root?
   1.1 Confronto: DDD OOP classico vs XState v5
   1.2 Benefici: stati espliciti, transizioni dichiarate, testabilità
   1.3 Trade-off: serializzazione mid-flight, child actor state (rimandi a RISK-1/RISK-2)

2. Mappatura DDD → XState
   2.1 Aggregate Root → XState Machine (setup + createMachine)
   2.2 Domain Event → XState Event (type union)
   2.3 Command/Invocation → XState invoke/spawn
   2.4 Business Invariant → XState guard
   2.5 Side Effect → XState action (assign, forwardTo, sendParent)
   2.6 Repository Pattern → XState input adapters
   2.7 Value Object → TypeScript branded types
   2.8 Aggregate State → XState context (con decomposed sub-contexts, DDD-167/DDD-168)

3. Diagramma di Sequenza Completo
   3.1 Submit FE → POST /api/tools/jobs
   3.2 BullMQ accoda ToolWorkflowJob → Worker processa
   3.3 Actor tree: generationSystemMachine → toolWorkflowMachine → toolActor (invoke)
   3.4 Event Bridge: Redis pub/sub → SSE → FE
   3.5 Completamento: persistenceRecording → finalize → TTL cleanup

4. Anatomia di una Macchina
   4.1 generation-system.definition.ts: top-level, routing, child invocation
   4.2 tool-workflow.machine.ts: multi-step orchestrator, bootstrap, createInitialStepStates
   4.3 generation-system.guards.ts: business rule guards, isNotFinalArtifact, route discriminators
   4.4 generation-system.events.ts: event extraction helpers, output type access
   4.5 generation-system.types.ts: context types, output types, action types

5. Test Pattern
   5.1 Unit test di una macchina: createActor → send event → assert snapshot
   5.2 Test di una guard: funzione pura ({ context, event }) → boolean
   5.3 Test di un'azione assign: snapshot prima/dopo l'evento
   5.4 Snapshot snapshot testing per regressione (pattern esistente in geometric-e2e)

6. Estensione: Aggiungere un Nuovo Step Type
   6.1 WorkflowStepType union in xstate.ts
   6.2 WorkflowStepDescriptor.type
   6.3 Routing in generation-system.execution.states.ts
   6.4 Merge action in tool-workflow.machine.ts (es. mergeCrawlingOutput)

7. Troubleshooting Common Issues
   7.1 "Perché la guard non scatta?" → verifica event type, verifica context shape
   7.2 "Perché invoke riparte da zero?" → comportamento documentato XState, rimando RISK-1
   7.3 "Perché TS non inferisce il tipo?" → cast espliciti in events.ts, rimando RISK-4
   7.4 "Come debuggare uno stato runtime?" → actor.getSnapshot(), rimando RISK-6

8. Appendice: Riferimenti Incrociati
   8.1 DDD-NNN pertinenti: DDD-167/168 (context decomposition), DDD-226/227 (ToolWorkflowJob)
   8.2 Entry AGENTS.md rilevanti (XState pitfalls, React pitfalls)
   8.3 Documenti collegati: architectural review, BullMQ proposal, domain glossary
```

### 2.3 Annotazioni `@ddd` JSDoc

**Obiettivo**: aggiungere tag `@ddd` nei file chiave per creare una mappatura esplicita tra costrutti XState e concetti DDD, referenziabile dall'IDE e dalla developer guide.

**Formato annotazione**:
```typescript
/**
 * Aggregate Root: GenerationSystem
 *
 * Questa macchina a stati è l'Aggregate Root del Generation bounded context.
 * Tutti i Domain Event (WORKFLOW_STEP_UNLOCKED, WORKFLOW_STEP_COMPLETED, etc.)
 * sono transizioni interne all'actor tree — non esiste un event bus inter-processo
 * (vedi RISK-2 per il bridge Redis pub/sub introdotto con BullMQ).
 *
 * @ddd AggregateRoot GenerationSystem
 * @ddd BoundedContext Generation
 * @ddd Related DDD-167 DDD-168 DDD-037
 */
```

**File da annotare** (con mapping DDD):

| File | Concetto DDD | DDD-NNN |
|---|---|---|
| `apps/backend/src/lib/machines/generation-system.definition.ts` | Aggregate Root `GenerationSystem` | DDD-167, DDD-168 |
| `apps/backend/src/lib/machines/tool-workflow.machine.ts` | Entity `ToolWorkflow` (sub-entity di GenerationSystem) | DDD-037 |
| `apps/frontend/src/features/tools/machines/tool-page.machine.ts` | Aggregate Root `ToolPage` (FE bounded context) | DDD-020 |
| `apps/backend/src/lib/machines/generation-system.guards.ts` | Business Invariants / Policy | DDD-140, DDD-138 |
| `apps/backend/src/lib/machines/generation-system.events.ts` | Domain Event accessors | — |
| `apps/backend/src/lib/types/xstate.ts` | Domain Event type definitions | — |

**Esempio annotazione su `generation-system.guards.ts:85-95`** (guard `isNotFinalArtifact`):

```typescript
/**
 * Business Rule: Credit Addebitment Gate
 *
 * Determina se lo step corrente è l'ultimo del piano di workflow.
 * Se true: lo step è intermedio → nessun addebito crediti (DDD-138 MonthlyCreditsUsed),
 * solo incremento del gate artifact (DDD-140 ArtifactGateUsed).
 * Se false: lo step è finale → recordingUsage → consumingCredits → addebito crediti.
 *
 * @ddd BusinessRule CreditGate
 * @ddd Related DDD-138 DDD-139 DDD-140
 * @see resolveToolWorkflowPlan
 * @see isFinalStepForPlan
 */
```

**Esempio annotazione su `tool-page.machine.ts:32-43`** (guard `canStartGeneration`):

```typescript
/**
 * Business Invariant: Generation Start Readiness
 *
 * L'utente può avviare la generazione solo se:
 * 1. Il readiness snapshot indica canStartFlow (tutti i prerequisiti soddisfatti), OPPURE
 * 2. L'unico motivo bloccante è missing_extraction_context E il React layer
 *    ha verificato che asset-based context (workspace Assets) fornisce contesto sufficiente.
 *
 * @ddd BusinessInvariant GenerationReadiness
 * @ddd Related DDD-020
 * @see buildReactiveViewModel
 * @see buildReadinessSnapshot
 */
```

### 2.4 Test Strategy

| # | Test | Cosa verifica |
|---|---|---|
| T-5.1 | Validazione documentale | La developer guide esiste, tutti i riferimenti a DDD-NNN sono aggiornati, i diagrammi sono corretti |
| T-5.2 | Verifica annotazioni | `grep '@ddd'` restituisce le annotazioni attese su tutti i file nella lista; nessun file annotato ha `@ddd` che punta a DDD-NNN inesistenti o archiviati |
| T-5.3 | Link checking | I link interni della developer guide (→ RISK-1, → RISK-2, → DDD-167) risolvono a documenti esistenti |
| T-5.4 | Build check | `npm run typecheck` passa — le annotazioni JSDoc non rompono la compilazione |

---

## 3. RISK-4 — Zod Runtime Validation

**Stima effort**: 2-3 giorni

### 3.1 Motivazione

Gli 8 helper in `generation-system.events.ts` usano cast `as` per accedere al campo `output` degli eventi XState. Se un tipo evento viene rinominato, il cast non fallisce a compile-time — fallisce **a runtime** con comportamento silenziosamente errato. Zod aggiunge un runtime guard esplicito.

### 3.2 Design: Schemi Additivi

**Nuovo file**: `apps/backend/src/lib/machines/generation-system.event-schemas.ts`

```typescript
// apps/backend/src/lib/machines/generation-system.event-schemas.ts

import { z } from 'zod';

// ─── Stream Done ──────────────────────────────────────────────────────────

export const StreamDoneOutputSchema = z.object({
  type: z.enum(['STREAM_TERMINATED_SUCCESS', 'STREAM_TERMINATED_FAILURE']),
  content: z.string().optional(),
  reason: z.string().optional(),
  metrics: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      costUsd: z.number(),
    })
    .optional(),
});

// ─── Generate Done ────────────────────────────────────────────────────────

export const GenerateDoneOutputSchema = z.object({
  type: z.enum(['GENERATE_TERMINATED_SUCCESS', 'GENERATE_TERMINATED_FAILURE']),
  content: z.string().optional(),
  metrics: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      costUsd: z.number(),
    })
    .optional(),
});

// ─── Tool Done ────────────────────────────────────────────────────────────

export const ToolDoneOutputSchema = z.object({
  type: z.enum(['WORKFLOW_STEP_UNLOCKED', 'WORKFLOW_STEP_COMPLETED']),
  artifactId: z.string().optional(),
});

// ─── Extraction Done ─────────────────────────────────────────────────────

export const ExtractionDoneOutputSchema = z.object({
  type: z.enum([
    'EXTRACTION_ATTEMPT_ACCEPTED',
    'EXTRACTION_ATTEMPT_REJECTED',
    'EXTRACTION_CHAIN_EXHAUSTED',
  ]),
  artifactId: z.string().optional(),
  content: z.string().optional(),
  structuredPayload: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});

// ─── Acquisition Done ────────────────────────────────────────────────────

export const AcquisitionDoneOutputSchema = z.object({
  type: z.enum(['ACQUISITION_ATTEMPT_ACCEPTED', 'ACQUISITION_ATTEMPT_SKIPPED']),
  statusCode: z.number().optional(),
  payload: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});

// ─── Crawling Done ───────────────────────────────────────────────────────

export const CrawlingDoneOutputSchema = z.object({
  type: z.literal('CRAWLING_COMPLETED'),
  crawlArtifacts: z.array(
    z.object({
      content: z.string(),
      structuredPayload: z.record(z.unknown()),
    }),
  ),
  paaQueries: z.array(z.string()),
});

// ─── Scoring Done ────────────────────────────────────────────────────────

export const ScoringDoneOutputSchema = z.object({
  type: z.literal('SCORING_COMPLETED'),
  ranking: z.record(z.unknown()),
});

// ─── Usage Done ──────────────────────────────────────────────────────────

export const UsageDoneOutputSchema = z.object({
  type: z.enum(['USAGE_GRANTED', 'USAGE_REJECTED']),
  creditCost: z.number().optional(),
  reason: z.string().optional(),
});

// ─── Idempotency Done ────────────────────────────────────────────────────

export const IdempotencyDoneOutputSchema = z.object({
  type: z.enum([
    'IDEMPOTENCY_CLAIMED',
    'IDEMPOTENCY_REPLAY_READY',
    'IDEMPOTENCY_CONFLICT',
  ]),
  artifactId: z.string().optional(),
  metadata: z.object({ content: z.string() }).optional(),
  reason: z.string().optional(),
});

// ─── Ownership Done ──────────────────────────────────────────────────────

export const OwnershipDoneOutputSchema = z.object({
  type: z.enum(['OWNERSHIP_OK', 'OWNERSHIP_REJECTED']),
  reason: z.string().optional(),
});
```

### 3.3 Integrazione negli Helper Esistenti

**File modificato**: `apps/backend/src/lib/machines/generation-system.events.ts`

**Approccio**: wrapping non-breaking — ogni helper esistente mantiene la firma, ma internamente valida con Zod e logga warning se la validazione fallisce:

```typescript
// Prima (cast unsafe):
export const getStreamDoneOutput = (event: unknown): StreamDoneOutput | undefined =>
  (event as { output?: StreamDoneOutput }).output;

// Dopo (Zod-validato):
import { StreamDoneOutputSchema } from './generation-system.event-schemas';

export const getStreamDoneOutput = (event: unknown): StreamDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  if (output === undefined || output === null) {
    return undefined;
  }

  const result = StreamDoneOutputSchema.safeParse(output);
  if (!result.success) {
    glog.warn(
      { eventType: (event as { type?: string }).type, zodErrors: result.error.issues },
      'StreamDoneOutput validation failed — type mismatch, possible type drift',
    );
    return undefined;
  }

  return result.data as StreamDoneOutput;
};
```

**Helper da wrappare** (8 totali):

| Helper | Schema | Riga attuale |
|---|---|---|
| `getStreamDoneOutput` | `StreamDoneOutputSchema` | 30-31 |
| `getGenerateDoneOutput` | `GenerateDoneOutputSchema` | 33-34 |
| `getToolDoneOutput` | `ToolDoneOutputSchema` | 87-88 |
| `getExtractionDoneOutput` | `ExtractionDoneOutputSchema` | 69-70 |
| `getAcquisitionDoneOutput` | `AcquisitionDoneOutputSchema` | 90-91 |
| `getCrawlingDoneOutput` | `CrawlingDoneOutputSchema` | 106-107 |
| `getScoringDoneOutput` | `ScoringDoneOutputSchema` | 124-125 |
| `getUsageDoneOutput` | `UsageDoneOutputSchema` | 24-25 |
| `getIdempotencyDoneOutput` | `IdempotencyDoneOutputSchema` | 21-22 |
| `getOwnershipDoneOutput` | `OwnershipDoneOutputSchema` | 27-28 |

**Nota**: `getInvokeFailureReason` (riga 150-151) e `isExtractionPayloadSemanticallyValid` (riga 140-148) non usano cast `as` problematici — nessuna modifica necessaria.

### 3.4 Strategia di Compatibilità

- **Nessuna rimozione dei tipi TypeScript esistenti** in `generation-system.types.ts`. Zod è un runtime guard aggiuntivo, non un sostituto.
- **Nessuna modifica alle firme pubbliche**: gli helper restituiscono lo stesso tipo (`StreamDoneOutput | undefined`, etc.)
- **Validazione non bloccante**: se Zod fallisce, l'helper restituisce `undefined` (comportamento equivalente a campo mancante) e logga un warning. Non lancia eccezioni.
- **Performance**: `safeParse` è O(1) per oggetti di queste dimensioni (~3-5 campi). Overhead trascurabile nel path di generazione (dominato dalla latenza LLM).

### 3.5 Test Strategy

| # | Test | Cosa verifica |
|---|---|---|
| T-4.1 | `generation-system.event-schemas.test.ts` — valid output | Ogni schema `.safeParse` accetta l'output corretto del tipo corrispondente |
| T-4.2 | `generation-system.event-schemas.test.ts` — invalid output | Ogni schema `.safeParse` rifiuta output con `type` errato, campo mancante, o tipo sbagliato |
| T-4.3 | `generation-system.events.test.ts` — helper wrapped | `getStreamDoneOutput` con evento valido restituisce l'output; con evento malformato restituisce `undefined` e logga warning |
| T-4.4 | Regressione | `npm --workspace apps/backend run test` — tutti i test esistenti che chiamano gli helper passano invariati |

---

## 4. RISK-3 — Domain Decision Modules

**Stima effort**: 5-8 giorni

### 4.1 Motivazione

La business logic per rispondere a "Perché la generazione non parte?" è distribuita su 6+ file (tool-page.machine.ts, tool-page-readiness.ts, tool-page-selectors.ts, extraction-fields.ts, generation-system.guards.ts, tool-form-architecture.ts). Questo piano consolida le decisioni di business in moduli puri, mantenendo i file esistenti come deleganti.

### 4.2 Struttura Proposta

```
apps/frontend/src/features/tools/runtime/domain-rules/
  can-start-generation.rule.ts       — readiness + policy + asset override
  input-requirement-matrix.rule.ts   — derivazione matrice input required/optional
  extraction-readiness.rule.ts       — validazione campi estrazione
  artifact-role-resolution.rule.ts   — step vs final determination
```

Ogni modulo esporta **UNA** pure function che prende **UNA** decisione di business.

### 4.3 Dettaglio Moduli

#### 4.3.1 `can-start-generation.rule.ts`

**Decisione**: "L'utente può avviare la generazione in questo momento?"

**Fonti attuali**:
- `tool-page.machine.ts:32-43` — guard `canStartGeneration`
- `tool-page-readiness.ts` — `buildReadinessSnapshot()`
- `tool-page-view-model.ts` — `canStartFromPolicy`

**Nuovo modulo**:
```typescript
// apps/frontend/src/features/tools/runtime/domain-rules/can-start-generation.rule.ts

import type { ReadinessSnapshot } from '../../machines/tool-page-readiness';
import type { PrimaryActionPolicy } from '../../machines/tool-page-view-model';

export type CanStartGenerationInput = {
  readiness: ReadinessSnapshot;
  primaryActionPolicy: PrimaryActionPolicy;
};

/**
 * Business Rule: Generation Start Gate
 *
 * Restituisce true se l'utente può avviare la generazione.
 * Due path:
 * 1. Readiness standard: canStartFlow === true E policy startable
 * 2. Asset-based override: l'unico blocker è missing_extraction_context
 *    (il React layer ha verificato che workspace Assets coprono il fabbisogno)
 *
 * @ddd BusinessRule GenerationStartGate
 */
export const canStartGeneration = (input: CanStartGenerationInput): boolean => {
  const extractionOnlyMissing =
    !input.readiness.canStartFlow
    && input.readiness.reasonCodes.length === 1
    && input.readiness.reasonCodes[0] === 'missing_extraction_context';

  if (extractionOnlyMissing) {
    return true;
  }

  return input.readiness.canStartFlow && isPolicyStartable(input.primaryActionPolicy);
};

// Re-export per backward compat
const isPolicyStartable = (policy: PrimaryActionPolicy): boolean =>
  policy !== 'disabled' && policy !== 'requires-extraction';
```

**Modifica a `tool-page.machine.ts:32-43`**:
```typescript
// Prima: logica inline
canStartGeneration: ({ context }) => {
  const policy = buildReactiveViewModel(context).primaryActionPolicy;
  const extractionOnlyMissing = !context.readiness.canStartFlow
    && context.readiness.reasonCodes.length === 1
    && context.readiness.reasonCodes[0] === 'missing_extraction_context';
  return (context.readiness.canStartFlow || extractionOnlyMissing)
    && (canStartFromPolicy(policy) || extractionOnlyMissing);
},

// Dopo: delegazione
import { canStartGeneration as canStartGenerationRule } from '../runtime/domain-rules/can-start-generation.rule';

canStartGeneration: ({ context }) => {
  const policy = buildReactiveViewModel(context).primaryActionPolicy;
  return canStartGenerationRule({
    readiness: context.readiness,
    primaryActionPolicy: policy,
  });
},
```

#### 4.3.2 `input-requirement-matrix.rule.ts`

**Decisione**: "Quali campi di input sono required, optional-by-tool-setting, o always-required per questo tool?"

**Fonti attuali**:
- `tool-page-selectors.ts:537` — `deriveToolInputRequirementMatrix()`
- `tool-form-architecture.ts` — `ToolFormConfig.requiredness`
- `extraction-fields.ts` — `ReadinessRequiredExtractionFieldKeysByTool`

**Nuovo modulo**:
```typescript
// apps/frontend/src/features/tools/runtime/domain-rules/input-requirement-matrix.rule.ts

import type { SupportedTool } from '@gen-app-2/contracts';
import type { ToolFormState } from '../tool-form-architecture';

export type InputRequirementEntry = {
  fieldKey: string;
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  isSatisfied: boolean;
};

/**
 * Business Rule: Input Requirement Matrix
 *
 * Per un dato tool e form state, restituisce la matrice completa dei campi di input
 * con il loro stato di soddisfacimento. Usata dal FE per determinare se mostrare
 * warning di campi mancanti e per il readiness check.
 *
 * @ddd BusinessRule InputRequirementMatrix
 */
export const deriveInputRequirementMatrix = (
  toolKey: SupportedTool,
  formState: ToolFormState,
): InputRequirementEntry[] => {
  // Logica attualmente in tool-page-selectors.ts:537+
  // ... estrai da deriveToolInputRequirementMatrix esistente
};
```

#### 4.3.3 `extraction-readiness.rule.ts`

**Decisione**: "I campi di estrazione per questo tool sono tutti presenti e validi?"

**Fonti attuali**:
- `extraction-fields.ts` — `ReadinessRequiredExtractionFieldKeysByTool`
- `extraction-context-validity.ts` (frontend) — `hasRequiredExtractionFields`

**Nuovo modulo**: consolida la validazione dei campi estrazione in una funzione pura, eliminando la necessità di consultare `extraction-fields.ts` + `extraction-context-validity.ts` separatamente.

#### 4.3.4 `artifact-role-resolution.rule.ts`

**Decisione**: "Questo artifact è uno step intermedio o l'output finale del workflow?"

**Fonti attuali**:
- `generation-system.guards.ts:85-95` — `isNotFinalArtifact`
- `workflow-normalizers.ts` — `FINAL_STEP_BY_TOOL`, `resolveToolStepArtifactRole`
- `generation-routing.ts` — `isFinalStepForPlan`

**Nuovo modulo**:
```typescript
// apps/frontend/src/features/tools/runtime/domain-rules/artifact-role-resolution.rule.ts

export type ArtifactRole = 'step' | 'final';

/**
 * Business Rule: Artifact Role Classification
 *
 * Determina se un artifact è uno step intermedio (non addebita crediti,
 * incrementa solo artifact gate) o l'output finale (addebita crediti).
 *
 * @ddd BusinessRule ArtifactRoleClassification
 * @ddd Related DDD-138 DDD-139 DDD-140
 */
export const resolveArtifactRole = (
  toolKey: string,
  stepKey: string,
  planSteps: ReadonlyArray<{ key: string }>,
): ArtifactRole => {
  const isLastStep = planSteps.length > 0 && planSteps[planSteps.length - 1]?.key === stepKey;
  return isLastStep ? 'final' : 'step';
};
```

### 4.4 Ordine di Estrazione

Per minimizzare il rischio di regressione, estrarre un modulo alla volta:

```
1. can-start-generation.rule.ts         ← più semplice, 1 decisione, 2 file toccati
2. input-requirement-matrix.rule.ts     ← media complessità, 3 file toccati
3. artifact-role-resolution.rule.ts     ← media complessità, backend + contratti
4. extraction-readiness.rule.ts         ← più complesso, 4+ file toccati
```

Dopo ogni estrazione:
1. Eseguire `npm --workspace apps/frontend run test` e verificare che tutti i test passino
2. Se fallimenti: revert e investigare prima di procedere

### 4.5 File Impact

| File | Modifica |
|---|---|
| `tool-page.machine.ts` | Delegare `canStartGeneration` guard al nuovo modulo (riga 32-43) |
| `tool-page-readiness.ts` | Nessuna modifica (già puro, resta come fonte dati per il modulo) |
| `tool-page-selectors.ts` | Delegare `deriveToolInputRequirementMatrix` al nuovo modulo |
| `extraction-fields.ts` | Nessuna modifica (rimane come dato statico, non logica) |
| `tool-form-architecture.ts` | Nessuna modifica (rimane come configurazione, non logica) |
| `generation-system.guards.ts` | Delegare `isNotFinalArtifact` al nuovo modulo (backend) |
| `generation-routing.ts` | Nessuna modifica (funzioni pure di risoluzione piano) |
| `workflow-normalizers.ts` | Nessuna modifica (rimane come utility, il modulo la usa) |

**Nuovi file**: 4 (i domain-rules modules)

**Totale file toccati**: ~10 (6 modificati per delegazione, 4 nuovi)

### 4.6 Risk Mitigation

| Rischio | Mitigazione |
|---|---|
| **Regressione funzionale** | Ogni estrazione esegue `npm --workspace apps/frontend run test` immediatamente. La suite esistente (22+ test file FE, vedi No-Regression Gates nella Proposal) copre già tutti i path di decisione. |
| **Drift tra vecchio e nuovo** | Il vecchio codice inline **non viene rimosso** nella prima iterazione — viene solo wrappato per delegare al nuovo modulo. Rimozione in una PR separata dopo validazione. |
| **Ciclo di import** | I moduli sono foglia (dipendono da tipi, non da altre macchine). Nessun rischio di ciclo. |
| **Test esistenti che mockano i vecchi path** | I test che mockano `buildReadinessSnapshot` o `buildReactiveViewModel` non sono toccati — ricevono gli stessi input e si aspettano gli stessi output. La delegazione è trasparente. |

---

## 5. RISK-6 — Actor Inspector

**Stima effort**: 1-2 giorni

### 5.1 Motivazione

Debuggare un `generationSystemMachine` con 7+ child machines richiede `actor.getSnapshot()` e interpretazione manuale di 200+ righe di JSON. Un inspector formatta lo stato in un albero testuale leggibile.

### 5.2 Module Design: `actor-inspector.ts`

**Nuovo file**: `apps/backend/src/lib/runtime/actor-inspector.ts` (~100 linee)

```typescript
// apps/backend/src/lib/runtime/actor-inspector.ts

import type { Actor, Snapshot } from 'xstate';
import { createComponentLogger } from './log-components';

const inspectorLog = createComponentLogger('actor-inspector');

// ─── Public API ───────────────────────────────────────────────────────────

export type InspectorOptions = {
  /** Massima profondità di ricorsione nei child actors. Default: 3 */
  maxDepth?: number;
  /** Se true, mostra anche i valori grezzi del context (per debug). Default: false */
  showContext?: boolean;
};

/**
 * Restituisce una rappresentazione testuale formattata dell'albero degli attori.
 *
 * Esempio output:
 * ```
 * generationSystemMachine: toolGenerationFlow
 *   ├── step 2/6: blog_outline [running]
 *   │   ├── streamTransport: chunk 47
 *   │   └── persistenceBatch: buffering
 *   └── completed: [blog_seo_structure]
 * ```
 */
export const inspectActor = (
  actor: Actor<Snapshot<unknown>>,
  options: InspectorOptions = {},
): string => {
  const snapshot = actor.getSnapshot();
  const lines = walkSnapshot(snapshot, '', options, 0);
  return lines.join('\n');
};

// ─── Snapshot Walker ──────────────────────────────────────────────────────

const MACHINE_NAME_KEYS = ['id', 'machine', 'key'] as const;

const getMachineId = (snapshot: Snapshot<unknown>): string | undefined => {
  const meta = (snapshot as Record<string, unknown>).machine;
  if (meta && typeof meta === 'object') {
    return (meta as Record<string, unknown>).id as string | undefined;
  }
  // Fallback per snapshot senza meta
  for (const key of MACHINE_NAME_KEYS) {
    const value = (snapshot as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
};

const getValueString = (snapshot: Snapshot<unknown>): string => {
  const value = (snapshot as Record<string, unknown>).value;
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}:${String(v)}`)
      .join(',');
  }
  return String(value);
};

const walkSnapshot = (
  snapshot: Snapshot<unknown>,
  prefix: string,
  options: InspectorOptions,
  depth: number,
): string[] => {
  const { maxDepth = 3, showContext = false } = options;

  const machineId = getMachineId(snapshot) ?? 'unknown';
  const valueStr = getValueString(snapshot);
  const lines: string[] = [];

  // Riga principale
  lines.push(`${prefix}${machineId}: ${valueStr}`);

  // Context (opzionale)
  if (showContext) {
    const ctx = (snapshot as Record<string, unknown>).context;
    if (ctx !== undefined) {
      lines.push(`${prefix}  [context: ${JSON.stringify(ctx).slice(0, 200)}]`);
    }
  }

  // Step progress (specifico per toolWorkflowMachine)
  const stepStates = (snapshot as Record<string, unknown>).context as Record<string, unknown> | undefined;
  if (stepStates?.stepStates && Array.isArray(stepStates.stepStates)) {
    for (const step of stepStates.stepStates as Array<Record<string, unknown>>) {
      const status = step.status;
      if (status === 'done') {
        lines.push(`${prefix}  ✅ ${step.key}: done`);
      } else if (status === 'running') {
        lines.push(`${prefix}  ⏳ ${step.key}: running`);
      } else if (status === 'error') {
        lines.push(`${prefix}  ❌ ${step.key}: error (${step.errorMessage ?? 'unknown'})`);
      } else if (status === 'skipped') {
        lines.push(`${prefix}  ⏭️  ${step.key}: skipped`);
      } else {
        lines.push(`${prefix}  ⬜ ${step.key}: ${String(status)}`);
      }
    }
  }

  // Child actors (limita profondità)
  if (depth < maxDepth) {
    const children = (snapshot as Record<string, unknown>).children as
      | Record<string, Actor<Snapshot<unknown>>>
      | undefined;

    if (children && typeof children === 'object') {
      const entries = Object.entries(children);
      if (entries.length > 0) {
        const isLast = true; // placeholder — raffinabile con indici
        for (const [key, childActor] of entries) {
          try {
            const childSnapshot = childActor.getSnapshot();
            const childPrefix = isLast ? `${prefix}  └── ` : `${prefix}  ├── `;
            lines.push(...walkSnapshot(childSnapshot, childPrefix, options, depth + 1));
          } catch {
            lines.push(`${prefix}  ├── ${key}: [unavailable]`);
          }
        }
      }
    }
  } else if (depth >= maxDepth) {
    const children = (snapshot as Record<string, unknown>).children;
    if (children && typeof children === 'object' && Object.keys(children).length > 0) {
      lines.push(`${prefix}  ... (max depth reached)`);
    }
  }

  return lines;
};

// ─── Structured Logging Integration ───────────────────────────────────────

/**
 * Logga lo stato corrente dell'attore usando structured logging.
 * Utile per debug in produzione — il log JSON include l'albero testuale
 * come campo `actorTree`.
 */
export const logActorState = (
  actor: Actor<Snapshot<unknown>>,
  correlationId: string,
): void => {
  const tree = inspectActor(actor, { maxDepth: 2 });
  inspectorLog.info({ correlationId, actorTree: tree }, 'actor state snapshot');
};
```

### 5.3 Integrazione con Structured Logging

`log-components.ts` — aggiungere:

```typescript
ACTOR_INSPECTOR: 'actor-inspector' as const,
```

Nel processore `tool-workflow-job-processor.ts`, chiamare `logActorState` a ogni step boundary:

```typescript
import { logActorState } from './actor-inspector';

// Dopo ogni step:
logActorState(toolWorkflowActor, job.id!);
```

### 5.4 Endpoint Amministrativo (Opzionale, Fase 2)

```
GET /api/admin/inspect/:actorId
```

Restituisce l'albero formattato. Richiede autenticazione admin. Utile per debug in produzione senza accesso SSH.

**Non implementare in questa fase** — il modulo `actor-inspector.ts` è progettato per essere chiamabile sia da log che da un futuro handler HTTP.

### 5.5 Test Strategy

| # | Test | Cosa verifica |
|---|---|---|
| T-6.1 | `actor-inspector.inspect.test.ts` — root machine | `inspectActor` su `generationSystemMachine` nello stato `idle` produce output contenente `generationSystemMachine: idle` |
| T-6.2 | `actor-inspector.inspect.test.ts` — child actors | `inspectActor` su macchina con child invoked mostra i child nell'albero |
| T-6.3 | `actor-inspector.inspect.test.ts` — step progress | `inspectActor` su `toolWorkflowMachine` con step completati mostra `✅`, `⏳`, `⬜` |
| T-6.4 | `actor-inspector.inspect.test.ts` — max depth | Con `maxDepth: 1`, i child oltre il primo livello mostrano `... (max depth reached)` |
| T-6.5 | `actor-inspector.log.test.ts` | `logActorState` chiama `logger.info` con `actorTree` nel payload |

---

## 6. Implementation Order & Dependencies

```
Fase 1: RISK-5 — Developer Guide (2-3 giorni)  ← PRIORITÀ MASSIMA
 │                                               (sblocca il contesto per tutto il resto)
 ├── 1.1: Scrivi xstate-as-aggregate-developer-guide.md
 ├── 1.2: Aggiungi annotazioni @ddd (6 file)
 └── 1.3: Verifica link e riferimenti DDD-NNN

Fase 2: RISK-4 — Zod Validation (2-3 giorni)
 │
 ├── 2.1: Crea generation-system.event-schemas.ts (10 schemi)
 ├── 2.2: Wrappa helper in generation-system.events.ts (10 funzioni)
 ├── 2.3: Test unitari (valid/invalid output per ogni schema)
 └── 2.4: Verifica regressione (npm test backend)

Fase 3: RISK-3 — Domain Decision Modules (5-8 giorni)
 │
 ├── 3.1: Estrai can-start-generation.rule.ts (1 modulo, 2 file toccati)
 │   └── Esegui test FE dopo estrazione
 ├── 3.2: Estrai input-requirement-matrix.rule.ts (1 modulo, 3 file)
 │   └── Esegui test FE dopo estrazione
 ├── 3.3: Estrai artifact-role-resolution.rule.ts (1 modulo, backend)
 │   └── Esegui test BE dopo estrazione
 ├── 3.4: Estrai extraction-readiness.rule.ts (1 modulo, 4+ file)
 │   └── Esegui test FE dopo estrazione
 └── 3.5: Pulizia finale: rimuovi logica inline (PR separata)

Fase 4: RISK-6 — Actor Inspector (1-2 giorni)
 │
 ├── 4.1: Crea actor-inspector.ts
 ├── 4.2: Integra in log-components.ts e tool-workflow-job-processor.ts
 └── 4.3: Test unitari
```

**Dipendenze tra rischi**:
- RISK-5 è **prerequisito logico** per RISK-3 (le annotazioni `@ddd` guidano l'estrazione dei moduli)
- RISK-4 e RISK-3 sono **indipendenti** (Zod opera nel backend, i decision modules nel frontend)
- RISK-6 è **indipendente** da tutti gli altri

**Dipendenze esterne**:
- `zod` — già in `apps/backend/package.json` (usato per validazione in adapter)
- `xstate` — già disponibile (v5)
- `@ddd` JSDoc tag — non è un tag standard, ma JSDoc permette tag custom senza errori di compilazione

---

## 7. Effort Estimates

| Rischio | Task | Giorni | Note |
|---|---|---|---|
| RISK-5 | Developer guide (scrittura) | 1.0 | ~2000-3000 parole, 8 sezioni |
| RISK-5 | Annotazioni `@ddd` (6 file) | 0.5 | ~10 annotazioni totali, 3-5 righe ciascuna |
| RISK-5 | Verifica link e DDD-NNN | 0.5 | grep + validazione manuale |
| **RISK-5 sub-totale** | | **2.0** | |
| RISK-4 | `event-schemas.ts` (10 schemi) | 0.5 | ~100 linee, pattern ripetitivo |
| RISK-4 | Wrap helper in `events.ts` | 1.0 | 10 funzioni, ~10 righe ciascuna |
| RISK-4 | Test unitari | 0.5 | 4 test file |
| **RISK-4 sub-totale** | | **2.0** | |
| RISK-3 | `can-start-generation.rule.ts` | 1.0 | Estrazione + delega + test |
| RISK-3 | `input-requirement-matrix.rule.ts` | 1.5 | Più complesso, più file toccati |
| RISK-3 | `artifact-role-resolution.rule.ts` | 0.5 | Funzione semplice, backend |
| RISK-3 | `extraction-readiness.rule.ts` | 1.5 | Il più complesso, 4+ file |
| RISK-3 | Pulizia finale (rimozione inline) | 1.0 | PR separata, dopo validazione |
| RISK-3 | Buffer/test tra estrazioni | 1.0 | Esecuzione suite FE dopo ogni modulo |
| **RISK-3 sub-totale** | | **6.5** | |
| RISK-6 | `actor-inspector.ts` | 0.5 | ~100 linee |
| RISK-6 | Integrazione logging + test | 0.5 | LogComponent + test |
| **RISK-6 sub-totale** | | **1.0** | |
| **TOTALE** | | **11.5** | Sequenziale: 10-15 giorni. Con parallelismo RISK-4/RISK-6: 8-12 giorni. |

---

## 8. Risk Assessment

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| **Developer guide diventa obsoleta** | Alta (il codice evolve) | Basso | `next-review-date` nel frontmatter triggera review trimestrale. Annotazioni `@ddd` sono nel codice — si evolvono col codice. |
| **Zod safeParse overhead percepibile** | Bassa | Basso | `safeParse` su oggetti di 3-5 campi è microsecondi. Dominato dalla latenza LLM (secondi). |
| **Estrazione domain rules rompe test** | Media | Medio | Test eseguiti dopo ogni estrazione. Rollback immediato su fallimento. La suite FE ha 22+ file di test che coprono i path decisionali. |
| **Actor inspector snapshot API cambia in XState v6** | Bassa | Basso | L'inspector usa API pubbliche (`actor.getSnapshot()`, `snapshot.children`, `snapshot.value`). Stabili da XState v4. |
| **Annotazioni `@ddd` fuori sync con DDD-NNN** | Media | Basso | `grep '@ddd Related DDD-'` produce lista verificabile contro `domain-naming-decision-log.md`. Automatizzabile con uno script CI. |

---

## 9. Success Criteria

### RISK-5 (Developer Guide)

- [x] SC-5.1: `docs/02-design/specifications/xstate-as-aggregate-developer-guide.md` esiste con tutte le 8 sezioni
- [x] SC-5.2: Tutti i 6 file nella lista di annotazione contengono almeno un blocco `@ddd` JSDoc
- [x] SC-5.3: `grep -r '@ddd Related DDD-' apps/backend apps/frontend` non produce DDD-NNN inesistenti o archiviati
- [x] SC-5.4: Il diagramma di sequenza nella Sezione 3 della guida riflette accuratamente il flusso corrente (incluso BullMQ post-go-live)

### RISK-4 (Zod Validation)

- [x] SC-4.1: `generation-system.event-schemas.ts` contiene 10 schemi Zod, uno per ogni helper con cast `as`
- [x] SC-4.2: Ogni helper in `generation-system.events.ts` usa `safeParse` prima di ritornare; warning loggato su fallimento
- [x] SC-4.3: `npm --workspace apps/backend run test` passa invariato (nessuna regressione)
- [x] SC-4.4: Test dimostrano che output valido passa, output malformato viene rifiutato con `undefined` + warning

### RISK-3 (Domain Decision Modules)

- [ ] SC-3.1: 4 nuovi file in `apps/frontend/src/features/tools/runtime/domain-rules/` — uno per decisione
- [ ] SC-3.2: Ogni modulo esporta esattamente UNA pure function
- [ ] SC-3.3: I file originali (tool-page.machine.ts, tool-page-selectors.ts, generation-system.guards.ts, etc.) delegato ai nuovi moduli invece di contenere logica inline
- [ ] SC-3.4: `npm --workspace apps/frontend run test` e `npm --workspace apps/backend run test` passano dopo ogni estrazione
- [ ] SC-3.5: Nessun nuovo ciclo di import introdotto

### RISK-6 (Actor Inspector)

- [ ] SC-6.1: `inspectActor(actor)` restituisce una stringa formattata con tree ASCII
- [ ] SC-6.2: L'output include machine name, current state, child actors (con profondità configurabile), e step progress (se `stepStates` presente)
- [ ] SC-6.3: `logActorState` scrive un log JSON strutturato con campo `actorTree`
- [ ] SC-6.4: `npm --workspace apps/backend run test` include test per l'inspector

---

## 10. Files Summary

### New Files

| File | Rischio | Note |
|---|---|---|
| `docs/02-design/specifications/xstate-as-aggregate-developer-guide.md` | RISK-5 | ~2000-3000 parole |
| `apps/backend/src/lib/machines/generation-system.event-schemas.ts` | RISK-4 | ~100 linee, 10 schemi Zod |
| `apps/frontend/src/features/tools/runtime/domain-rules/can-start-generation.rule.ts` | RISK-3 | ~40 linee |
| `apps/frontend/src/features/tools/runtime/domain-rules/input-requirement-matrix.rule.ts` | RISK-3 | ~60 linee |
| `apps/frontend/src/features/tools/runtime/domain-rules/extraction-readiness.rule.ts` | RISK-3 | ~50 linee |
| `apps/frontend/src/features/tools/runtime/domain-rules/artifact-role-resolution.rule.ts` | RISK-3 | ~30 linee |
| `apps/backend/src/lib/runtime/actor-inspector.ts` | RISK-6 | ~100 linee |
| `apps/backend/src/lib/tests/runtime.actor-inspector.test.ts` | RISK-6 | ~80 linee |
| `apps/backend/src/lib/tests/runtime.generation-system.event-schemas.test.ts` | RISK-4 | ~100 linee |

### Modified Files

| File | Rischio | Modifica |
|---|---|---|
| `apps/backend/src/lib/machines/generation-system.definition.ts` | RISK-5 | Aggiungere annotazione `@ddd` JSDoc (nessun cambiamento codice) |
| `apps/backend/src/lib/machines/tool-workflow.machine.ts` | RISK-5 | Aggiungere annotazione `@ddd` JSDoc |
| `apps/frontend/src/features/tools/machines/tool-page.machine.ts` | RISK-5, RISK-3 | `@ddd` + delegare `canStartGeneration` |
| `apps/backend/src/lib/machines/generation-system.guards.ts` | RISK-5, RISK-3 | `@ddd` + delegare `isNotFinalArtifact` |
| `apps/backend/src/lib/machines/generation-system.events.ts` | RISK-4, RISK-5 | Wrappare 10 helper con Zod `safeParse` + `@ddd` |
| `apps/backend/src/lib/types/xstate.ts` | RISK-5 | Aggiungere annotazione `@ddd` JSDoc |
| `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` | RISK-3 | Delegare `deriveToolInputRequirementMatrix` |
| `apps/backend/src/lib/runtime/log-components.ts` | RISK-6 | Aggiungere `ACTOR_INSPECTOR` |
| `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts` | RISK-6 | Chiamare `logActorState` a ogni step boundary |

---

## 11. References

- [XState-as-Aggregate Architectural Review](../07-governance/xstate-as-aggregate-architectural-review.md) — RISK-3 (Sezione 2.3), RISK-4 (Sezione 2.4), RISK-5 (Sezione 2.5), RISK-6 (Sezione 2.6)
- [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) — Backend No-Regression Gates (categorizzazione test BE)
- [Frontend UI Ubiquitous Language Spec](../02-design/specifications/frontend-ui-ubiquitous-language-spec.md) — Terminologia canonica per UI
- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) — Termini DDD canonici
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-NNN per annotazioni
- `apps/backend/src/lib/machines/generation-system.events.ts` — Helper attuali (righe 21-166)
- `apps/backend/src/lib/machines/generation-system.types.ts` — Tipi output (righe 38-80)
- `apps/backend/src/lib/machines/generation-system.guards.ts` — Guard `isNotFinalArtifact` (righe 85-95)
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — Guard `canStartGeneration` (righe 32-43)
- `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` — `deriveToolInputRequirementMatrix` (riga 537+)
- `apps/backend/src/lib/runtime/log-components.ts` — Registry `LogComponent`