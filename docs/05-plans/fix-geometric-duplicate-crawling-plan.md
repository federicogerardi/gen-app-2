---
status: draft
version: 2.1
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
type: implementation-plan
tags: [geometric, bugfix, routing, crawling, scoring, deduplication, serpapi, generation-system, unification, be-driven]
goal: Eliminare ogni eccezione geometric-specifica dal routing della generation system. Zero riferimenti a 'geometric' nei guard e nel routing state. Il modello FE-driven è abbandonato — architettura target full BE-driven.
---

> ⚑ DDD Reference: [Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) · [BCM](../02-design/domain-bounded-context-map.md) · [Decision Log](../07-governance/domain-naming-decision-log.md) · DDD-117 (geometric) · DDD-123 (step sequence) · DDD-116 (crawling/scoring) · DDD-NEW (crawling → acquisition reclassification)

# Implementation Plan: Unify Geometric Routing — Zero Tool-Specific Exceptions

> **Collegamenti**: [Fase 1 Plan](./feature-tool-workflow-job-system-fase-1.md) (v2.2, `implemented`) · [Fase 2 Plan](./feature-tool-workflow-job-system-fase-2.md) (v2.1, `implemented`) · [Geometric Crawling Reference](../99-reference/geometric-crawling-step-reference.md) · B1/B2 (bug strutturali Fase 2)

---

## 1. Overview

**Obiettivo**: Eliminare ogni hardcoding di `'geometric'` dal routing della `generationSystemMachine`. Oggi esistono:

1. **`routeIsGeometric`** guard (`generation-system.guards.ts:88-93`) — matcha `toolKey === 'geometric'`
2. **`isNotGeometric`** guard (`generation-system.guards.ts:83-87`) — esclude geometric da path normali
3. **Ramo dedicato** nel routing state (`generation-system.request.states.ts:273-275`)

Questi tre elementi vengono **eliminati**. Il routing si basa esclusivamente su `STEP_TYPE_BY_TOOL_AND_STEP`, il registry che mappa step key → `WorkflowStepType`. Qualsiasi tool futuro con step crawling/scoring ottiene il routing corretto automaticamente.

**Cosa NON viene toccato**: l'auto-chain `crawlingFlow → scoringFlow` rimane. Non è un'eccezione geometric — è il corretto comportamento di dominio (scoring è trasformazione deterministica dei dati crawling, eseguita nello stesso contesto). La deduplicazione delle chiamate è gestita dal Phase 2 skip nel processore.

**Stima**: 1.5 giorni

**File modificati**: 5 file BE + 1 glossary + 1 DDD log + test

---

## 2. Cosa viene eliminato

| Elemento | File | Perché |
|---|---|---|
| `routeIsGeometric` guard | `generation-system.guards.ts:88-93` | Hardcoded su `toolKey === 'geometric'` |
| `isNotGeometric` guard | `generation-system.guards.ts:83-87` | Non più necessario — geometric non è più eccezione |
| Ramo `routeIsGeometric` nel routing | `generation-system.request.states.ts:273-275` | Sostituito da guard step-type-based |
| `type: 'routeIsGeometric'` | `generation-system.actions.ts:83` | Riferimento al guard rimosso |

---

## 3. Design della Soluzione

### 3.1 Nuovo routing

```
routing state (generation-system.request.states.ts):
  always:
    1. routeIsExtraction    → extractionFlow
    2. routeIsCrawlingStep  → crawlingFlow       ← NEW: step-type-based
    3. routeIsScoringStep   → scoringFlow        ← NEW: step-type-based
    4. routeIsTool          → toolGenerationFlow ← TUTTI i tool, incluso geometric generation
    5. routeIsGeneric       → genericGenerationFlow
```

**Zero riferimenti a `'geometric'`.**

### 3.2 Flusso geometric BE-driven (post-fix)

```
processToolWorkflowJob
  │
  ├─ Step 1: serp-crawling (WorkflowStepType: crawling)
  │   └─ runCrawlingStep → generationSystemMachine
  │       └─ routing → routeIsCrawlingStep → crawlingFlow
  │           ├─ invokeCrawling → SerpApi call (1)
  │           ├─ auto-chain → scoringFlow
  │           ├─ invokeScoring → LLM scoring call (1)
  │           └─ dispatchingMode → generating → completed
  │       └─ Processor: estrai dati scoring, salva per Phase 2 skip
  │
  ├─ Step 2: competitor-scoring (WorkflowStepType: scoring)
  │   └─ Phase 2 optimization: priorOfSameType('scoring') → FOUND
  │       └─ SKIPPED
  │
  ├─ Step 3: strategic-reporting (WorkflowStepType: generation)
  │   └─ routing → routeIsTool → toolGenerationFlow → LLM call
  │
  └─ Step 4: unified-report (WorkflowStepType: generation)
      └─ routing → routeIsTool → toolGenerationFlow → LLM call
```

**Chiamate**: 1 SerpApi, 1 LLM scoring, 2 LLM generation. **Zero eccezioni geometric nel routing.**

---

## 4. Implementation Steps

### Phase 0 — Prerequisiti (0.25 days)

#### Task 0.1 — Esportare `STEP_TYPE_BY_TOOL_AND_STEP`

- **File**: `apps/backend/src/lib/runtime/tool-workflow-registry.ts`
- **Action**: Aggiungere `export` alla dichiarazione (linea 56):

  ```typescript
  // PRIMA:
  const STEP_TYPE_BY_TOOL_AND_STEP: Partial<Record<...>> = { ... };

  // DOPO:
  export const STEP_TYPE_BY_TOOL_AND_STEP: Partial<Record<...>> = { ... };
  ```

- **Why**: Il registry è attualmente `const` privato al modulo. Deve essere esportato per l'uso nei guard (`generation-system.guards.ts`) e nel processore (`tool-workflow-job-processor.ts`).
- **Dependencies**: None
- **Risk**: Bassa — aggiunta di `export`, nessun cambio di logica
- **Estimate**: 0.1 days

#### Task 0.2 — Aggiornare glossary (DDD)

- **File**: `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- **Action**:
  1. Riga 76 (`WorkflowStepType`): rimuovere nota "provisional — type definitions introduced; runtime actors pending implementation" per `crawling` e `scoring`. Stato reale: `canonical` (DDD-116, implementato 2026-06-12).
  2. Aggiungere nota: `crawling` è una specializzazione di `acquisition` per API con logica specifica (SerpApi: multi-query, PAA discovery, AI Overview extraction).
- **Why**: Il glossary è stale — dice "pending implementation" per attori che sono implementati da oltre un mese.
- **Dependencies**: None
- **Estimate**: 0.1 days

#### Task 0.3 — Aggiungere DDD entry

- **File**: `docs/07-governance/domain-naming-decision-log.md`
- **Action**: Nuova entry:

  ```
  | DDD-NNN | 2026-07-28 | crawling → acquisition (domain reclassification) |
  Reclassify `WorkflowStepType.crawling` as a specialized form of `acquisition`
  at the domain level. Geometric's `serp-crawling` step retrieves data from
  SerpApi via the persisted `ApiService` system (DDD-102) — identical mechanism
  to all other `acquisition` steps. The code-level value `crawling` is retained
  for actor dispatch (invokeCrawling has SerpApi-specific logic: PAA discovery,
  AI Overview extraction). The glossary now reflects that crawling IS data
  acquisition.

  `scoring` is NOT reclassified — it is deterministic weighted-point computation,
  not API data retrieval and not LLM-driven content production.

  Routing unification: `routeIsGeometric` and `isNotGeometric` guards eliminated.
  Routing is step-type-based via `STEP_TYPE_BY_TOOL_AND_STEP`. Zero tool-specific
  hardcoding remains in the routing layer.

  Status: adopted
  ```

- **Dependencies**: Task 0.2 (glossary update)
- **Estimate**: 0.05 days

---

### Phase 1 — Routing (4 file, ~20 linee rimosse, ~40 aggiunte)

#### Task 1.1 — Nuovi guard step-type-based + rimozione guard geometric

- **File**: `apps/backend/src/lib/machines/generation-system.guards.ts`
- **Action**:
  1. **Aggiungere import** in cima:

     ```typescript
     import { STEP_TYPE_BY_TOOL_AND_STEP, type SupportedToolWorkflow } from '../runtime/tool-workflow-registry';
     ```

  2. **Rimuovere** `isNotGeometric` (linee 83-87, 3 righe).
  3. **Rimuovere** `routeIsGeometric` (linee 88-93, 3 righe).
  4. **Aggiungere** `routeIsCrawlingStep`:

     ```typescript
     routeIsCrawlingStep: ({ context }: GenerationGuardArgs) => {
       const domain = selectDomainContext(context);
       const toolKey = domain.toolKey ?? '';
       const step = (context.requestInput as Record<string, unknown>).step;
       if (!toolKey || !step || typeof step !== 'string') return false;
       const stepTypeMap = STEP_TYPE_BY_TOOL_AND_STEP[toolKey as SupportedToolWorkflow];
       if (!stepTypeMap) return false;
       return stepTypeMap[step] === 'crawling';
     },
     ```

  5. **Aggiungere** `routeIsScoringStep`:

     ```typescript
     routeIsScoringStep: ({ context }: GenerationGuardArgs) => {
       const domain = selectDomainContext(context);
       const toolKey = domain.toolKey ?? '';
       const step = (context.requestInput as Record<string, unknown>).step;
       if (!toolKey || !step || typeof step !== 'string') return false;
       const stepTypeMap = STEP_TYPE_BY_TOOL_AND_STEP[toolKey as SupportedToolWorkflow];
       if (!stepTypeMap) return false;
       return stepTypeMap[step] === 'scoring';
     },
     ```

- **Why**: Zero hardcoding di tool key. I guard leggono dal registry — qualsiasi tool con step crawling/scoring ottiene il routing automaticamente.
- **Dependencies**: Task 0.1 (`STEP_TYPE_BY_TOOL_AND_STEP` esportato)
- **Risk**: Bassa — guard puri, lookup su mappa statica
- **Estimate**: 0.25 days

#### Task 1.2 — Aggiornare routing state

- **File**: `apps/backend/src/lib/machines/generation-system.request.states.ts`
- **Action**: Modificare lo stato `routing` (linee 266-290):

  ```typescript
  // PRIMA:
  routing: {
    always: [
      { guard: 'routeIsExtraction', target: 'extractionFlow' },
      { guard: 'routeIsGeometric',  target: 'crawlingFlow' },    // ← RIMOSSO
      { guard: 'routeIsTool',       target: 'toolGenerationFlow' },
      ...
    ],
  },

  // DOPO:
  routing: {
    always: [
      { guard: 'routeIsExtraction',   target: 'extractionFlow' },
      { guard: 'routeIsCrawlingStep', target: 'crawlingFlow' },     // ← NEW
      { guard: 'routeIsScoringStep',  target: 'scoringFlow' },      // ← NEW
      { guard: 'routeIsTool',         target: 'toolGenerationFlow' },
      { guard: 'routeIsGeneric',      target: 'genericGenerationFlow' },
      { guard: 'hasAmbiguousRouting', target: 'failed', ... },
    ],
  },
  ```

- **Why**: `routeIsGeometric` rimosso. `routeIsCrawlingStep` e `routeIsScoringStep` sono step-type-based — zero riferimenti a tool key. Generation step geometric cadono su `routeIsTool` come qualsiasi altro tool.
- **Dependencies**: Task 1.1 (nuovi guard)
- **Risk**: Bassa — sostituzione 1:1 con rami più specifici
- **Estimate**: 0.1 days

#### Task 1.3 — Rimuovere type reference a `routeIsGeometric`

- **File**: `apps/backend/src/lib/machines/generation-system.actions.ts`
- **Action**: Rimuovere dalla union type (linea ~83):

  ```typescript
  // RIMUOVERE:
  | { type: 'routeIsGeometric'; params: unknown }
  ```

- **Dependencies**: Task 1.1
- **Risk**: Nulla — rimozione di un tipo non più referenziato
- **Estimate**: 0.05 days

---

### Phase 2 — Processor (1 file, ~30 linee modificate)

#### Task 2.1 — Estrazione scoring data-driven

- **File**: `apps/backend/src/lib/runtime/tool-workflow-job-processor.ts`
- **Action**:
  1. **Aggiungere import**:

     ```typescript
     import { STEP_TYPE_BY_TOOL_AND_STEP, type SupportedToolWorkflow } from './tool-workflow-registry';
     ```

  2. **Sostituire** il blocco specifico geometric con logica generica (dopo linea 451):

     ```typescript
     // Dopo il blocco esistente (completedStepContents.set + completedStepContentsByType.set):
     if (stepType === 'crawling') {
       const upcomingScoringSteps = plan.steps.filter(s => {
         const stm = STEP_TYPE_BY_TOOL_AND_STEP[toolKey as SupportedToolWorkflow];
         return stm && stm[s.key] === 'scoring' && !completedStepContents.has(s.key);
       });

       if (upcomingScoringSteps.length > 0) {
         const scoringContent = extractStructuredStepContent(result);
         if (scoringContent) {
           for (const scoringStep of upcomingScoringSteps) {
             const scoringResult: StepResult = {
               artifactId: `${result.artifactId}:${scoringStep.key}`,
               content: scoringContent,
             };
             completedStepContents.set(scoringStep.key, scoringResult);
             if (!completedStepContentsByType.has('scoring')) {
               completedStepContentsByType.set('scoring', scoringResult);
             }
             jobLog.info({ stepKey, scoringStepKey: scoringStep.key },
               'extracted scoring artifact from crawling step for scoring step skip');
           }
         }
       }
     }
     ```

  3. **Aggiungere helper** (a livello modulo, fuori da `processToolWorkflowJob`):

     ```typescript
     const extractStructuredStepContent = (result: StepResult): string | null => {
       const marker = '## Competitor Ranking';
       const idx = result.content.indexOf(marker);
       if (idx === -1) return null;
       return result.content.substring(idx);
     };
     ```

- **Why**: Zero riferimenti a `'geometric'` o `'serp-crawling'`. La logica cerca step scoring futuri per QUALSIASI tool con step crawling→scoring nel registry. Best-effort: se il parsing fallisce, lo skip non scatta e il comportamento degrada a chiamate duplicate (nessun break funzionale).
- **Dependencies**: Task 0.1, Task 1.1
- **Risk**: Media — best-effort text parsing
- **Estimate**: 0.25 days

---

### Phase 3 — Testing (4 file)

#### Task 3.1 — Guard test

- **File**: `apps/backend/src/lib/tests/generation-system.guards.test.ts` (MODIFICA o NUOVO)
- **Action**:
  1. Rimuovere test per `isNotGeometric` e `routeIsGeometric` (se presenti)
  2. `routeIsCrawlingStep` con geometric + `serp-crawling` → `true`
  3. `routeIsCrawlingStep` con geometric + `strategic-reporting` → `false`
  4. `routeIsCrawlingStep` con tool senza crawling → `false`
  5. `routeIsScoringStep` con geometric + `competitor-scoring` → `true`
  6. `routeIsScoringStep` con geometric + `unified-report` → `false`
  7. **SCALABILITÀ**: `STEP_TYPE_BY_TOOL_AND_STEP['test-tool'] = { 'fetch': 'crawling' }` → `routeIsCrawlingStep('fetch')` → `true`
- **Estimate**: 0.25 days

#### Task 3.2 — Routing integration test

- **File**: `apps/backend/src/lib/tests/generation-system.routing.test.ts` (MODIFICA o NUOVO)
- **Action**:
  1. Geometric `serp-crawling` → `crawlingFlow` → auto-chain → `scoringFlow`
  2. Geometric `strategic-reporting` → `toolGenerationFlow` (non `crawlingFlow`)
  3. Geometric `unified-report` → `toolGenerationFlow`
  4. `funnel-pages` → routing invariato
- **Note**: Test Category A DEVONO passare.
- **Estimate**: 0.25 days

#### Task 3.3 — Processor e2e test

- **File**: `apps/backend/src/lib/tests/runtime.geometric-e2e.test.ts` (MODIFICA)
- **Action**:
  1. `invokeCrawling` chiamato 1 volta
  2. `invokeScoring` chiamato 1 volta (via auto-chain dentro step 1)
  3. `competitor-scoring` skippato (log "extracted scoring artifact")
  4. 4 eventi `step_completed`
  5. `strategic-reporting` e `unified-report` ricevono dependency content
- **Estimate**: 0.5 days

#### Task 3.4 — All-tools regression

- **File**: `apps/backend/src/lib/tests/runtime.tool-workflow-job-processor.test.ts` (MODIFICA — estendi)
- **Action**: Verifica routing invariato per funnel-pages, meta-ads, youtube-lf-script, blog-article-generator, brief-generator, tov-generator, personas-generator, angle-generator, youtube-description, nextland.
- **Estimate**: 0.25 days

---

## 5. Implementation Order

```
Phase 0 (0.25d): Prerequisiti
  ├── T0.1: export STEP_TYPE_BY_TOOL_AND_STEP
  ├── T0.2: glossary update
  └── T0.3: DDD entry
        │
Phase 1 (0.4d): Routing
  ├── T1.1: generation-system.guards.ts
  ├── T1.2: generation-system.request.states.ts
  └── T1.3: generation-system.actions.ts
        │
Phase 2 (0.25d): Processor
  └── T2.1: tool-workflow-job-processor.ts
        │
Phase 3 (1.25d): Testing
  ├── T3.1: guards.test.ts
  ├── T3.2: routing.test.ts
  ├── T3.3: geometric-e2e.test.ts
  └── T3.4: all-tools regression
```

---

## 6. Risks & Mitigations

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| `routeIsTool` non gestisce generation step geometric | Bassa | Alto | `toolGenerationFlow` invoca `invokeToolWorkflow` che già gestisce step singoli con dependency artifacts per tutti i tool multi-step. Il processore passa `stepDependencyArtifactContentsByStep`. |
| Parsing scoring content fallisce | Bassa | Basso | Best-effort: se fallisce, `completedStepContentsByType.get('scoring')` resta `undefined`, il Phase 2 skip non scatta, e `competitor-scoring` viene eseguito normalmente (auto-chain dentro un nuovo attore). Degradazione a chiamate duplicate, nessun break funzionale. |
| Regressione tool non-geometric | Bassa | Alto | I nuovi guard `routeIsCrawlingStep`/`routeIsScoringStep` matchano solo step con entry in `STEP_TYPE_BY_TOOL_AND_STEP`. Nessun altro tool ha entry. Test Category A + T3.4 coprono. |
| `STEP_TYPE_BY_TOOL_AND_STEP` import circolare | Bassa | Medio | `generation-system.guards.ts` importa già da `generation-routing.ts` che importa da `tool-workflow-registry.ts`. L'import diretto non crea cicli. |

---

## 7. Success Criteria

- [ ] **SC-01**: `routeIsGeometric` e `isNotGeometric` rimossi dal codebase
- [ ] **SC-02**: `routeIsCrawlingStep` e `routeIsScoringStep` funzionano per qualsiasi tool con step nel registry
- [ ] **SC-03**: `serp-crawling` instradato via `routeIsCrawlingStep` → `crawlingFlow` (auto-chain a `scoringFlow` preservata)
- [ ] **SC-04**: `competitor-scoring` skippato dal processore (0 chiamate aggiuntive)
- [ ] **SC-05**: 4 eventi `step_completed` pubblicati per job geometric
- [ ] **SC-06**: `strategic-reporting` e `unified-report` instradati via `routeIsTool` → `toolGenerationFlow`
- [ ] **SC-07**: Test Category A (9 file) passano senza modifiche
- [ ] **SC-08**: 10 tool funzionanti senza regressioni (T3.4)
- [ ] **SC-09 (Scalabilità)**: Nuovo tool con `STEP_TYPE_BY_TOOL_AND_STEP['new-tool'] = { 'fetch': 'crawling' }` → routing automatico

---

## 8. Rollback Plan

1. **Revert guard**: ripristinare `routeIsGeometric` e `isNotGeometric`:

   ```typescript
   routeIsGeometric: ({ context }) => {
     const toolKey = selectDomainContext(context).toolKey ?? '';
     const workflowType = selectDomainContext(context).workflowType ?? '';
     return toolKey === 'geometric' || workflowType === 'geometric';
   },
   isNotGeometric: ({ context }) => {
     const toolKey = selectDomainContext(context).toolKey ?? '';
     return toolKey !== 'geometric';
   },
   ```

2. **Revert routing state**: ripristinare `routeIsGeometric` branch.
3. **Revert processor**: rimuovere blocco `if (stepType === 'crawling')` data-driven.
4. **Disabilitazione geometric dal job system**: escludere `geometric` da `TOOL_WORKFLOW_USE_JOB_SYSTEM`.