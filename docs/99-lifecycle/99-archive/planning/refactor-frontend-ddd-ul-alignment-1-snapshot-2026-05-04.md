---
goal: Allineamento frontend e backend a DDD Ubiquitous Language — 11 drift identificati da analisi 2026-05-03
version: 1.2
date_created: 2026-05-03
last_updated: 2026-05-03
owner: Frontend Platform Team
status: 'Completed'
tags: [refactor, ddd, ubiquitous-language, frontend, backend, types]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Piano di allineamento del codice frontend e backend ai termini canonici del Domain Ubiquitous Language Glossary (v1.1). Derivato dall'analisi di drift DDD eseguita il 2026-05-03, che ha identificato **11 violazioni distribuite su 4 cluster tematici**: 8 nel frontend (Phase 1–3) e 3 nel layer backend `src/lib/` (Phase 5). Nessuna modifica logica o comportamentale: solo rinominazione di tipi e consolidamento di definizioni duplicate.

---

## 1. Requirements & Constraints

- **REQ-001**: Tutti i tipi nel frontend che rappresentano concetti del dominio devono usare esattamente il termine canonico definito nel glossario UL.
- **REQ-002**: Nessuna modifica logica o comportamentale — solo rinominazione di tipi TypeScript e consolidamento di definizioni duplicate.
- **REQ-003**: I test devono continuare a passare senza modifiche al comportamento atteso (solo aggiornamenti di type annotations e stringhe valore dove richiesto).
- **REQ-004**: `ToolCheckpointStatus.completed` (in `tool-checkpoints.ts`) NON deve essere modificato — rappresenta un concetto distinto da `ToolStepStatus`.
- **REQ-005**: `ArtifactStatus.completed` (in `backend-stream.ts`) NON deve essere modificato — è un termine canonico separato del bounded context Generation.
- **REQ-006**: `CanonicalToolUiState = 'completed'` (in `tool-ux-state.ts`) NON deve essere modificato — rappresenta lo stato globale della tool page, non lo stato di un singolo step.
- **CON-001**: Il refactor deve essere eseguito fase per fase, con typecheck (`npm --prefix frontend run typecheck`) e test (`npm --prefix frontend run test`) verdi al termine di ogni fase prima di procedere.
- **CON-002**: Le fasi sono sequenziali per dipendenza: Phase 1 (ExtractionContext) → Phase 2 (ToolStepStatus) → Phase 3 (ReadinessSnapshot). La Phase 4 (decision log) è indipendente.
- **REQ-007**: I branding types e le interfacce backend devono usare i termini canonici del glossario UL. I duplicati strutturali devono essere consolidati nella definizione più upstream per evitare dipendenze circolari.
- **CON-003**: Phase 5 (backend) è sequenziale rispetto a Phase 4: eseguire solo dopo che i gate di Phase 4 sono verdi. Il typecheck backend (`npm run typecheck`) e i test backend (`npm run test`) devono essere verdi al termine di Phase 5.
- **GUD-001**: Usare type alias backward-compat (`export type OldName = NewName`) nei file sorgente quando il tipo rinominato è importato da più di 3 consumer, per minimizzare il diff.
- **GUD-002**: Preferire la rinominazione in-place (rename + update imports) alla creazione di nuovi file, per non aumentare la superficie del codebase.
- **PAT-001**: Il tipo canonico `ExtractionContext` deve essere definito in `frontend-stream.machine.ts` (sorgente più upstream) e ri-esportato da `GenerationWorkspaceProvider.tsx` per preservare il contratto di import esistente dei consumer.

---

## 2. Implementation Steps

### Implementation Phase 1 — Unificazione ExtractionContext

- GOAL-001: Consolidare `ToolExtractionContext` (in `frontend-stream.machine.ts`) e `BriefingContext` (in `tool-form-architecture.ts`) nel termine canonico `ExtractionContext` (DDD-007). Tre nomi per lo stesso Value Object → uno solo.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `frontend/src/features/generation/machines/frontend-stream.machine.ts` righe 21-28: rinominare `export type ToolExtractionContext` → `export type ExtractionContext`. Aggiornare tutte le occorrenze interne nel file (righe 46, 71). | ✅ | 2026-05-03 |
| TASK-002 | In `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` riga 11: aggiornare import da `ToolExtractionContext` a `ExtractionContext`. Riga 13: aggiornare re-export `export type { ExtractionContext }`. Aggiornare le firme sulle righe 63, 65, 66. | ✅ | 2026-05-03 |
| TASK-003 | In `frontend/src/features/generation/runtime/step-hydration.ts` riga 3: aggiornare import da `ToolExtractionContext` a `ExtractionContext`. Riga 103: aggiornare la firma del return type. | ✅ | 2026-05-03 |
| TASK-004 | In `frontend/src/features/generation/ui/GenerationForm.tsx` riga 22: aggiornare import da `ToolExtractionContext` a `ExtractionContext`. Righe 39-40: aggiornare le props. | ✅ | 2026-05-03 |
| TASK-005 | In `frontend/src/features/tools/runtime/useToolForm.test.tsx` righe 6, 8-9: aggiornare import e annotation da `ToolExtractionContext` a `ExtractionContext`. | ✅ | 2026-05-03 |
| TASK-006 | In `frontend/src/features/generation/machines/frontend-stream.machine.test.ts` riga 603: aggiornare import da `ToolExtractionContext` a `ExtractionContext`. Righe 641, 655: aggiornare type annotation. | ✅ | 2026-05-03 |
| TASK-007 | In `frontend/src/features/tools/runtime/tool-form-architecture.ts` riga 52: sostituire `export type BriefingContext = { ... }` con `export type BriefingContext = ExtractionContext` (alias backward-compat) e aggiungere import di `ExtractionContext` da `../../generation/machines/frontend-stream.machine`. Aggiungere commento `/** @deprecated use ExtractionContext (DDD-007) */`. | ✅ | 2026-05-03 |
| TASK-008 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Tutti i check devono essere verdi prima di procedere alla Phase 2. | ✅ | 2026-05-03 |

### Implementation Phase 2 — ToolStepStatus: allineamento valore 'completed' → 'done'

- GOAL-002: Allineare il tipo inline `'idle' | 'running' | 'completed' | 'error'` usato in `ToolPageViewModel.stepStatuses` e nei componenti UI al tipo canonico `ToolStepStatus = 'idle' | 'running' | 'done' | 'error'` (definito in `tool-flow.machine.ts`). Eliminare le definizioni locali `type StepStatus` nei componenti e importare `ToolStepStatus` dalla sorgente canonica.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | In `frontend/src/features/tools/machines/tool-page.machine.ts`: aggiungere `import type { ToolStepStatus } from './tool-flow.machine'` all'inizio del file. Alla riga 62, cambiare `stepStatuses: Record<ToolStep, 'idle' \| 'running' \| 'completed' \| 'error'>` → `stepStatuses: Record<ToolStep, ToolStepStatus>`. | ✅ | 2026-05-03 |
| TASK-010 | In `frontend/src/features/tools/machines/tool-page.machine.ts`: righe 100 e 102, sostituire il tipo inline `Record<ToolStep, 'idle' \| 'running' \| 'completed' \| 'error'>` → `Record<ToolStep, ToolStepStatus>`. Riga 153: cambiare `stepStatuses[step] = 'completed'` → `stepStatuses[step] = 'done'`. | ✅ | 2026-05-03 |
| TASK-011 | In `frontend/src/features/tools/runtime/tool-ux-state.ts` riga 87 (in `ToolUiDerivationOutput` deprecated): cambiare `stepStatuses: Record<ToolStep, 'idle' \| 'running' \| 'completed' \| 'error'>` → `stepStatuses: Record<ToolStep, ToolStepStatus>`. Aggiungere import di `ToolStepStatus` da `../machines/tool-flow.machine`. Riga 210: cambiare `let status: 'idle' \| 'running' \| 'completed' \| 'error' = 'idle'` → `let status: ToolStepStatus = 'idle'`. Riga 215: cambiare `status = 'completed'` → `status = 'done'` (valore runtime — stessa logica di TASK-010/riga 153). Riga 221: cambiare il cast finale `as Record<ToolStep, 'idle' \| 'running' \| 'completed' \| 'error'>` → `as Record<ToolStep, ToolStepStatus>`. | ✅ | 2026-05-03 |
| TASK-012 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`: rimuovere la definizione locale `type StepStatus = 'idle' \| 'running' \| 'completed' \| 'error'` (riga 5). Aggiungere `import type { ToolStepStatus } from '../machines/tool-flow.machine'`. Nel tipo `FlowStepProgress` (riga 14): cambiare `status: StepStatus` → `status: ToolStepStatus`. Alla riga 72 in `READINESS_DETAIL_BY_REASON`: verificare che non usi `StepStatus`. | ✅ | 2026-05-03 |
| TASK-013 | In `frontend/src/features/tools/ui/ToolStepCard.tsx`: (1) rimuovere la definizione locale `type StepStatus = 'idle' \| 'running' \| 'completed' \| 'error'` (riga 11). (2) Aggiungere `import type { ToolStepStatus } from '../machines/tool-flow.machine'`. (3) Riga 16: aggiornare la prop `status: StepStatus` → `status: ToolStepStatus`. (4) Riga 23: aggiornare il parameter type `const getStatusBadge = (status: StepStatus)` → `(status: ToolStepStatus)`. (5) Riga 29: cambiare `case 'completed':` → `case 'done':` nel switch di `getStatusBadge` (valore runtime — rende raggiungibile il case con i nuovi valori emessi da `stepStatuses`). (6) Riga 76: cambiare `status === 'completed'` → `status === 'done'` nel guard del bottone "Visualizza" (confronto runtime — senza questo il bottone non appare mai dopo il refactor). | ✅ | 2026-05-03 |
| TASK-014 | In `frontend/src/features/tools/ui/ToolGenerationFlow.tsx`: (1) Aggiungere `import type { ToolStepStatus } from '../machines/tool-flow.machine'`. (2) Riga 47: sostituire il tipo inline `status: 'idle' \| 'running' \| 'completed' \| 'error'` → `status: ToolStepStatus` nell'interfaccia `StepProgress`. (3) Riga 108 in `getStepStatusIcon`: cambiare `case 'completed': return '✓'` → `case 'done': return '✓'` (valore runtime — senza questo l'icona ✓ non è renderizzata per step con stato `'done'`). (4) Riga 121 in `getStepStatusBadge`: cambiare `case 'completed': return { label: 'Done', ... }` → `case 'done': return { label: 'Done', ... }` (valore runtime — senza questo il badge rimane vuoto per step `'done'`). NON modificare riga 132 (`canonicalState === 'completed'`) — protetta da REQ-006. | ✅ | 2026-05-03 |
| TASK-015 | In `frontend/src/features/tools/machines/tool-page.machine.test.ts`: **nessuna modifica necessaria.** Verifica pre-esecuzione ha confermato che tutte le occorrenze di `status: 'completed'` in questo file (righe 159, 191, 214, 264, 296, 373, 396, 419, 466, 531) sono campi `GenerationArtifact.status` — tipo `ArtifactStatus`, protetto da REQ-005. Il file non contiene asserzioni dirette su `viewModel.stepStatuses` e non è necessario modificarlo. Gate obbligatorio: eseguire `grep -n "stepStatuses" tool-page.machine.test.ts` e confermare 0 risultati prima di procedere a TASK-016. | ✅ | 2026-05-03 |
| TASK-016 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Tutti i check devono essere verdi prima di procedere alla Phase 3. | ✅ | 2026-05-03 |

### Implementation Phase 3 — ReadinessSnapshot / ReadinessReasonCode: normalizzazione naming

- GOAL-003: Allineare i nomi dei tipi `ToolPageReadinessSnapshot` e `ToolPageReadinessReasonCode` ai termini canonici `ReadinessSnapshot` e `ReadinessReasonCode` (DDD-006, glossario Frontend/UI). Eliminare la ridefinizione locale di `ReadinessReasonCode` in `ToolGenerationFlowVertical.tsx`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | In `frontend/src/features/tools/machines/tool-page.machine.ts` righe 44 e 49: rinominare `ToolPageReadinessReasonCode` → `ReadinessReasonCode` e `ToolPageReadinessSnapshot` → `ReadinessSnapshot`. Aggiornare tutte le occorrenze interne nel file (righe 54, 58, 73, 75, 107, 130, 444). Aggiungere alias backward-compat: `export type ToolPageReadinessReasonCode = ReadinessReasonCode` e `export type ToolPageReadinessSnapshot = ReadinessSnapshot`. | ✅ | 2026-05-03 |
| TASK-018 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` righe 7-10: rimuovere la ridefinizione locale `type ReadinessReasonCode = ...`. Aggiungere `import type { ReadinessReasonCode } from '../machines/tool-page.machine'`. Verificare che tutti gli usi locali di `ReadinessReasonCode` nel file (righe 28, 72, 189, 192, 197, 207) siano ancora consistenti. | ✅ | 2026-05-03 |
| TASK-019 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Tutti i check devono essere verdi prima di procedere alla Phase 4. | ✅ | 2026-05-03 |

### Implementation Phase 4 — Aggiornamento DDD References

- GOAL-004: Registrare nel decision log le azioni correttive eseguite e aggiornare il glossario con le note di deprecazione.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-012` — `ExtractionContext` è il termine canonico; `ToolExtractionContext` e `BriefingContext` sono alias deprecati rimossi con questo refactor. | ✅ | 2026-05-03 |
| TASK-021 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-013` — `ToolStepStatus` con valore `'done'` è il termine canonico per lo step completato. Il valore `'completed'` in `stepStatuses` era un drift rispetto alla definizione in `tool-flow.machine.ts`. | ✅ | 2026-05-03 |
| TASK-022 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-014` — `ReadinessSnapshot` e `ReadinessReasonCode` sono i termini canonici. Il prefisso `ToolPage` era ridondante; alias backward-compat mantenuti per 1 ciclo di deprecazione. | ✅ | 2026-05-03 |
| TASK-023 | In `docs/01-requirements/domain-ubiquitous-language-glossary.md`: aggiornare la sezione Aliases per aggiungere `ToolExtractionContext` → `ExtractionContext` e `BriefingContext` → `ExtractionContext`. Aggiornare `ToolPageReadinessSnapshot` → `ReadinessSnapshot` e `ToolPageReadinessReasonCode` → `ReadinessReasonCode`. | ✅ | 2026-05-03 |
| TASK-024 | Aggiornare `docs/index-overview.md` sezione "Current Delta" con entry della correzione effettuata. | ✅ | 2026-05-03 |

### Implementation Phase 5 — Backend UL Alignment

- GOAL-005: Correggere i 3 drift UL nel layer `src/lib/`: (1) rinominare `ToolRegistryVersion`/`ToolRegistrySnapshotRef` ai termini canonici senza prefisso `Tool`; (2) consolidare `StreamUsageMetrics` nel termine canonico `LlmUsageMetrics` eliminando la definizione duplicata; (3) consolidare `PersistedArtifactStatus` nel termine canonico `ArtifactStatus` eliminando la definizione duplicata.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | In `src/lib/types/xstate.ts`: rinominare `export type ToolRegistryVersion = string & {}` → `export type RegistryVersion = string & {}` (riga 8). Rinominare `export type ToolRegistrySnapshotRef = string & {}` → `export type RegistrySnapshotRef = string & {}` (riga 9). Aggiornare tutte le occorrenze interne nel file (righe 13, 14, 17, 18, 53, 54, 206, 207). Aggiungere alias backward-compat: `export type ToolRegistryVersion = RegistryVersion` e `export type ToolRegistrySnapshotRef = RegistrySnapshotRef`. | ✅ | 2026-05-03 |
| TASK-026 | In `src/lib/types/xstate.ts`: rinominare `interface StreamUsageMetrics` → `interface LlmUsageMetrics` (riga 90). Aggiornare le occorrenze interne alle righe 276 e 286 (`metrics?: StreamUsageMetrics` → `metrics?: LlmUsageMetrics` in `StreamTerminatedSuccessEvent` e `StreamTerminatedFailureEvent`). Aggiungere alias backward-compat: `export type StreamUsageMetrics = LlmUsageMetrics`. | ✅ | 2026-05-03 |
| TASK-027 | In `src/lib/adapters/generation.adapters.ts`: rimuovere la definizione locale `export type LlmUsageMetrics = { inputTokens: number; outputTokens: number; costUsd: number; }` (righe 8-12). Aggiungere import `import type { LlmUsageMetrics } from '../types/xstate'`. Aggiungere `export type { LlmUsageMetrics }` dopo l'import per mantenere il contratto di re-export verso `openrouter.adapter.ts` e `src/lib/adapters/index.ts`. Verificare che `LlmStreamEvent` (riga 30: `{ type: 'completed'; usage?: LlmUsageMetrics }`) continui a typecheckare correttamente con il tipo importato. | ✅ | 2026-05-03 |
| TASK-028 | In `src/lib/adapters/generation.adapters.ts`: rimuovere `export type PersistedArtifactStatus = 'generating' \| 'completed' \| 'failed'` (riga 42). Aggiungere `import type { ArtifactStatus } from '../types/artifact'`. Aggiungere alias backward-compat: `export type PersistedArtifactStatus = ArtifactStatus`. Aggiornare la firma interna alla riga 92 (`ArtifactRecord.status: PersistedArtifactStatus` → `ArtifactRecord.status: ArtifactStatus`). | ✅ | 2026-05-03 |
| TASK-029 | Eseguire `npm run typecheck` e `npm run test`. Tutti i check backend devono essere verdi. | ✅ | 2026-05-03 |
| TASK-030 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-015` — `RegistryVersion` e `RegistrySnapshotRef` sono i termini canonici per i branding types; il prefisso `Tool` era ridondante nel namespace `src/lib/types/`. | ✅ | 2026-05-03 |
| TASK-031 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-016` — `LlmUsageMetrics` è il termine canonico per le metriche di utilizzo LLM; `StreamUsageMetrics` era un duplicato strutturale in `xstate.ts`. Dopo il refactor la definizione canonica risiede in `src/lib/types/xstate.ts`; `generation.adapters.ts` la importa da lì. Aggiornare il campo `Source` nel glossario per `LlmUsageMetrics`. | ✅ | 2026-05-03 |
| TASK-032 | In `docs/07-governance/domain-naming-decision-log.md`: aggiungere decisione `DDD-017` — `ArtifactStatus` (da `src/lib/types/artifact.ts`) è il termine canonico per lo stato di persistenza degli artefatti; `PersistedArtifactStatus` era un duplicato con gli stessi valori in `generation.adapters.ts`. | ✅ | 2026-05-03 |
| TASK-033 | In `docs/01-requirements/domain-ubiquitous-language-glossary.md`: (1) aggiornare `source` di `LlmUsageMetrics` a `src/lib/types/xstate.ts`; (2) aggiungere alla sezione Aliases: `ToolRegistryVersion` → `RegistryVersion`, `ToolRegistrySnapshotRef` → `RegistrySnapshotRef`, `StreamUsageMetrics` → `LlmUsageMetrics`, `PersistedArtifactStatus` → `ArtifactStatus`. | ✅ | 2026-05-03 |

---

## 3. Alternatives

- **ALT-001**: Unificare `ExtractionContext` in un file di tipi condivisi separato (`frontend/src/types/domain.ts`). Scartato: aumenta la superficie del codebase e rompe il principio di co-location con la macchina sorgente.
- **ALT-002**: Mantenere `ToolExtractionContext` come nome e aggiornare solo il glossario. Scartato: viola REQ-001 (il codice deve usare il termine canonico, non il contrario).
- **ALT-003**: Deprecare gradualmente `'completed'` con un lint rule custom anziché rinominare ora. Scartato: aggiunge complessità tooling; la modifica è meccanica e sicura.
- **ALT-004**: Rinominare `ToolPageReadinessSnapshot` senza alias backward-compat. Valutato rischioso per eventuali consumer non identificati dalla ricerca statica (ad es. file generati o snapshot Jest).

---

## 4. Dependencies

- **DEP-001**: `frontend/src/features/tools/machines/tool-flow.machine.ts` — sorgente canonica di `ToolStepStatus`, `ToolStep`, `SupportedTool`. NON modificato da questo piano.
- **DEP-002**: `frontend/src/features/generation/machines/frontend-stream.machine.ts` — file sorgente per la definizione di `ExtractionContext` dopo Phase 1.
- **DEP-003**: `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` — hub di re-export; aggiornato in TASK-002 per mantenere il contratto di import verso i consumer.
- **DEP-004**: `src/lib/adapters/openrouter.adapter.ts` — importa `LlmUsageMetrics` da `./generation.adapters`; continuerà a funzionare solo se `generation.adapters.ts` mantiene la re-export dopo TASK-027. NON modificato da questo piano.
- **DEP-005**: `src/lib/adapters/index.ts` — re-esporta `LlmUsageMetrics` e `PersistedArtifactStatus` nominalmente da `generation.adapters`; entrambi rimangono disponibili tramite alias backward-compat dopo TASK-027 e TASK-028. NON modificato da questo piano.

---

## 5. Files

- **FILE-001**: `frontend/src/features/generation/machines/frontend-stream.machine.ts` — rinominazione `ToolExtractionContext` → `ExtractionContext` (TASK-001)
- **FILE-002**: `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` — aggiornamento import/re-export (TASK-002)
- **FILE-003**: `frontend/src/features/generation/runtime/step-hydration.ts` — aggiornamento import (TASK-003)
- **FILE-004**: `frontend/src/features/generation/ui/GenerationForm.tsx` — aggiornamento import e props (TASK-004)
- **FILE-005**: `frontend/src/features/tools/runtime/useToolForm.test.tsx` — aggiornamento type annotation (TASK-005)
- **FILE-006**: `frontend/src/features/generation/machines/frontend-stream.machine.test.ts` — aggiornamento import e annotation (TASK-006)
- **FILE-007**: `frontend/src/features/tools/runtime/tool-form-architecture.ts` — deprecazione `BriefingContext` con alias (TASK-007)
- **FILE-008**: `frontend/src/features/tools/machines/tool-page.machine.ts` — import `ToolStepStatus`, fix tipo inline, fix valore `'done'`, rename `ReadinessSnapshot`/`ReadinessReasonCode` (TASK-009, TASK-010, TASK-017)
- **FILE-009**: `frontend/src/features/tools/runtime/tool-ux-state.ts` — aggiornamento tipo inline `stepStatuses` (TASK-011)
- **FILE-010**: `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` — rimozione tipo locale `StepStatus`, import `ToolStepStatus`, import `ReadinessReasonCode` (TASK-012, TASK-018)
- **FILE-011**: `frontend/src/features/tools/ui/ToolStepCard.tsx` — rimozione tipo locale `StepStatus`, import `ToolStepStatus`, aggiornamento prop e parameter type, switch case runtime `'completed'`→`'done'`, guard runtime `=== 'completed'`→`=== 'done'` (TASK-013)
- **FILE-012**: `frontend/src/features/tools/ui/ToolGenerationFlow.tsx` — sostituzione tipo inline (TASK-014)
- **FILE-013**: `frontend/src/features/tools/machines/tool-page.machine.test.ts` — **nessuna modifica** (TASK-015 no-op: tutte le occorrenze di `status: 'completed'` sono `ArtifactStatus`, protette da REQ-005)
- **FILE-014**: `docs/07-governance/domain-naming-decision-log.md` — DDD-012, DDD-013, DDD-014 (TASK-020..022); DDD-015, DDD-016, DDD-017 (TASK-030..032)
- **FILE-015**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` — aggiornamento aliases frontend (TASK-023) e backend (TASK-033)
- **FILE-016**: `docs/index-overview.md` — aggiornamento Current Delta (TASK-024)
- **FILE-017**: `src/lib/types/xstate.ts` — rinominazione `ToolRegistryVersion`→`RegistryVersion`, `ToolRegistrySnapshotRef`→`RegistrySnapshotRef`, `StreamUsageMetrics`→`LlmUsageMetrics` con alias backward-compat (TASK-025, TASK-026)
- **FILE-018**: `src/lib/adapters/generation.adapters.ts` — rimozione `LlmUsageMetrics` locale + import da xstate; rimozione `PersistedArtifactStatus` + import `ArtifactStatus` da artifact.ts con alias (TASK-027, TASK-028)
- **FILE-019**: `src/lib/adapters/index.ts` — `PersistedArtifactStatus` continua a essere esportato via alias backward-compat in FILE-018; nessuna modifica necessaria se l'alias è mantenuto
- **FILE-020**: `src/lib/adapters/postgres-redis.stub.ts` — nessuna modifica necessaria: continua a importare `PersistedArtifactStatus` dall'alias in `generation.adapters.ts`

---

## 6. Testing

- **TEST-001**: `npm --prefix frontend run typecheck` verde dopo ogni fase (gate obbligatorio in TASK-008, TASK-016, TASK-019).
- **TEST-002**: `npm --prefix frontend run test` verde dopo ogni fase. Nessun test deve cambiare comportamento — solo aggiornamenti di type annotation e stringhe valore dove `stepStatuses[x] = 'completed'` diventa `'done'`.
- **TEST-003**: Verifica manuale: cercare residui di `ToolExtractionContext` e `BriefingContext` come type (non come commento) nel frontend dopo Phase 1.
- **TEST-004**: Verifica manuale: cercare residui dell'inline `'idle' | 'running' | 'completed' | 'error'` dopo Phase 2 (escludendo `ToolCheckpointStatus` e `ArtifactStatus`).
- **TEST-005**: Verifica manuale: cercare residui di `ToolPageReadinessSnapshot` e `ToolPageReadinessReasonCode` come definizioni (non alias) dopo Phase 3.
- **TEST-006**: `npm run typecheck` verde dopo Phase 5 (gate obbligatorio in TASK-029).
- **TEST-007**: Verifica manuale: cercare residui di `ToolRegistryVersion` e `ToolRegistrySnapshotRef` come definizioni (non alias) e di `interface StreamUsageMetrics` come definizione (non alias) in `src/lib/` dopo Phase 5. Cercare `PersistedArtifactStatus` come definizione con valori letterali (non alias) dopo Phase 5.

---

## 7. Risks & Assumptions

- **RISK-001**: ~~`tool-page.machine.test.ts` usa `status: 'completed'` in molti contesti~~ — **risolto in review finale 2026-05-03**. Tutte le occorrenze sono `ArtifactStatus` (REQ-005). TASK-015 ridefinito come no-op con gate di verifica.
- **RISK-002**: ~~Codice UI che confronta `stepStatuses[step] === 'completed'`~~ — **risolto in review finale 2026-05-03**. I confronti runtime `=== 'completed'` in `ToolStepCard.tsx` (riga 76) e i switch case in `ToolGenerationFlow.tsx` (righe 108, 121) sono coperti esplicitamente da TASK-013 e TASK-014. Nessun confronto residuo non gestito.
- **RISK-003**: ~~`ToolGenerationFlow.tsx` potrebbe avere snapshot test~~ — **risolto in review finale 2026-05-03**. `frontend/src/features/tools/ui/` non ha directory `__snapshots__` e nessun file usa `toMatchSnapshot`. Nessun rischio di rottura snapshot.
- **ASSUMPTION-001**: Non esistono consumer esterni al frontend (es. backend, script) che importano i tipi TypeScript rinominati.
- **ASSUMPTION-002**: `BriefingContext` in `tool-form-architecture.ts` non è usato come tipo in nessun file esterno al file stesso (la ricerca ha rilevato 1 sola definizione, zero import).
- **RISK-004**: TASK-027 sposta la definizione di `LlmUsageMetrics` da `generation.adapters.ts` a `xstate.ts`. `openrouter.adapter.ts` importa `LlmUsageMetrics` da `./generation.adapters` — continuerà a funzionare solo se `generation.adapters.ts` mantiene una re-export dell'import da xstate. Aggiungere `export type { LlmUsageMetrics }` in `generation.adapters.ts` dopo il refactor per garantire zero rotture nei consumer dell'adapter layer.
- **RISK-005**: `src/lib/adapters/index.ts` esporta `PersistedArtifactStatus` nominalmente. Mantenere l'alias `export type PersistedArtifactStatus = ArtifactStatus` in `generation.adapters.ts` garantisce che tutti i consumer esistenti (incluso `postgres-redis.stub.ts`) continuino a compilare senza modifiche. Verificare che nessun consumer effettui confronti stringa diretti su `PersistedArtifactStatus` come letterale.
- **ASSUMPTION-003**: `ToolRegistryVersion` e `ToolRegistrySnapshotRef` sono usati esclusivamente in `src/lib/types/xstate.ts` — la ricerca non ha trovato import di questi tipi in altri file `src/`. Dopo la rinominazione non ci sono consumer da aggiornare oltre al file stesso.

---

## 9. Deterministic Execution Guards

> Questa sezione è obbligatoria per l'esecutore. Contiene il registro completo delle occorrenze protette di `'completed'`, i grep di pre/post verifica per ogni fase, e gli exact-match patterns per ogni task che modifica valori runtime.

### 9.1 Registro occorrenze protette di `'completed'`

Queste occorrenze **NON devono essere toccate** in nessun task. Ogni modifica a questi valori viola un REQ.

| File | Riga | Testo esatto | Tipo concetto | REQ/Motivo |
|------|------|-------------|---------------|------------|
| `tool-ux-state.ts` | 27 | `\| 'completed'; // All steps completed` | `CanonicalToolUiState` union | REQ-006 |
| `tool-ux-state.ts` | 158 | `canonicalState = 'completed';` | assegnamento `CanonicalToolUiState` | REQ-006 |
| `tool-ux-state.ts` | 201 | `canonicalState === 'completed'` | confronto `CanonicalToolUiState` | REQ-006 |
| `tool-page.machine.ts` | 177 | `canonicalState: 'completed',` | `CanonicalToolUiState` in object literal | REQ-006 |
| `tool-page.machine.ts` | 309 | `artifact.status === 'completed'` | confronto `ArtifactStatus` | REQ-005 |
| `tool-page.machine.ts` | 315 | `artifact?.status === 'completed'` | confronto `ArtifactStatus` | REQ-005 |
| `tool-page.machine.ts` | 343 | `artifact.status === 'completed'` | confronto `ArtifactStatus` | REQ-005 |
| `tool-page.machine.ts` | 557 | `{ type: 'extraction', status: 'completed', ...}` | `ArtifactStatus` filter | REQ-005 |
| `tool-page.machine.ts` | 967 | `target: 'completed'` | nome stato XState interno | architetturale — stato macchina |
| `tools-client.test.ts` | 89, 120, 274 | `status: 'completed'` | `ArtifactStatus` in SSE terminal event | REQ-005 |
| `tool-page.machine.test.ts` | 159, 191, 214, 264, 296, 373, 396, 419, 466, 531 | `status: 'completed'` | `GenerationArtifact.status` (`ArtifactStatus`) | REQ-005 — non toccare |
| `ToolStepCard.tsx` | 30 | `return { label: 'Completato', className: 'ui-badge-completed' }` | label UI nel badge — stringa display, non valore di dominio | nessun vincolo DDD; può restare |
| `ToolGenerationFlow.tsx` | 132 | `canonicalState === 'completed'` | confronto `CanonicalToolUiState` | REQ-006 |
| `tool-ux-state.ts` (type) | 27 | `CanonicalToolUiState = ... \| 'completed'` | tipo union | REQ-006 |

### 9.2 Occorrenze target (da modificare)

Queste sono le **uniche** occorrenze da modificare nei task di Phase 2. Confrontare con il registro 9.1 prima di ogni modifica.

| Task | File | Riga | Modifica |
|------|------|------|----------|
| TASK-009 | `tool-page.machine.ts` | 62 | tipo `stepStatuses` in `ToolPageViewModel` → `ToolStepStatus` |
| TASK-010 | `tool-page.machine.ts` | 100 | return type di `buildDefaultStepStatuses` → `ToolStepStatus` |
| TASK-010 | `tool-page.machine.ts` | 102 | cast interno → `ToolStepStatus` |
| TASK-010 | `tool-page.machine.ts` | 153 | `stepStatuses[step] = 'completed'` → `= 'done'` |
| TASK-011 | `tool-ux-state.ts` | 87 | tipo `stepStatuses` in `ToolUiDerivationOutput` → `ToolStepStatus` |
| TASK-011 | `tool-ux-state.ts` | 210 | `let status: 'idle' \| 'running' \| 'completed' \| 'error'` → `let status: ToolStepStatus` |
| TASK-011 | `tool-ux-state.ts` | 215 | `status = 'completed'` → `status = 'done'` (runtime value) |
| TASK-011 | `tool-ux-state.ts` | 221 | cast finale → `ToolStepStatus` |
| TASK-012 | `ToolGenerationFlowVertical.tsx` | 5 | rimuovere `type StepStatus = 'idle' \| 'running' \| 'completed' \| 'error'` |
| TASK-013 | `ToolStepCard.tsx` | 11, 16, 23, 29, 76 | rimuovere `type StepStatus` locale; aggiornare prop, parameter type, switch case runtime, guard runtime |
| TASK-014 | `ToolGenerationFlow.tsx` | 47, 108, 121 | tipo inline `StepProgress.status`; switch case runtime in `getStepStatusIcon` e `getStepStatusBadge` |

### 9.3 Grep di pre-verifica per fase

Eseguire questi comandi **prima** di iniziare ogni fase per confermare lo stato atteso. Se l'output differisce, fermarsi e rivalutare.

**Prima di Phase 1:**
```sh
# deve trovare esattamente 3 risultati (righe 21, 46, 71)
grep -n 'ToolExtractionContext' frontend/src/features/generation/machines/frontend-stream.machine.ts
```

**Prima di Phase 2:**
```sh
# deve trovare le 3 righe target in tool-page.machine.ts (62, 100, 102)
grep -n "'idle' | 'running' | 'completed' | 'error'" frontend/src/features/tools/machines/tool-page.machine.ts

# deve trovare esattamente riga 153
grep -n "stepStatuses\[step\] = 'completed'" frontend/src/features/tools/machines/tool-page.machine.ts

# tool-ux-state.ts: deve trovare righe 87, 210, 215, 221
grep -n "'completed'" frontend/src/features/tools/runtime/tool-ux-state.ts
```

**Prima di Phase 3:**
```sh
# deve trovare righe 44, 49 come definizioni (non alias)
grep -n 'ToolPageReadinessReasonCode\|ToolPageReadinessSnapshot' frontend/src/features/tools/machines/tool-page.machine.ts | grep 'export type'
```

### 9.4 Grep di post-verifica per fase

**Dopo Phase 1 (gate TASK-008):**
```sh
# deve tornare 0 risultati come definizioni type (non commenti)
grep -rn 'ToolExtractionContext\|BriefingContext = {' frontend/src/
```

**Dopo Phase 2 (gate TASK-016):**
```sh
# deve tornare 0 risultati come definizioni type o inline union
grep -rn "type StepStatus = 'idle'" frontend/src/features/tools/

# deve tornare 0 risultati come assegnamento runtime in contesto stepStatuses
grep -rn "stepStatuses\[.*\] = 'completed'" frontend/src/

# VERIFICA PROTEZIONI: questi devono ancora esistere
grep -n "canonicalState.*'completed'\|status === 'completed'" frontend/src/features/tools/machines/tool-page.machine.ts
```

**Dopo Phase 3 (gate TASK-019):**
```sh
# deve tornare 0 risultati come export type definition (solo alias backward-compat è accettato)
grep -n 'export type ToolPageReadinessReasonCode\|export type ToolPageReadinessSnapshot' frontend/src/features/tools/machines/tool-page.machine.ts | grep -v '='
```

### 9.5 Exact-match patterns per le sostituzioni critiche

Per ogni riga che modifica un valore runtime (non solo tipo), usare il contesto minimo di 3 righe per identificazione univoca.

**TASK-010 — riga 153 (unico assegnamento `stepStatuses[step] = 'completed'` nel file):**
```
OLD: for (const step of progress.completedSteps) {
       stepStatuses[step] = 'completed';
     }
NEW: for (const step of progress.completedSteps) {
       stepStatuses[step] = 'done';
     }
```

**TASK-011 — riga 215 (unico `status = 'completed'` nel blocco buildStepStatuses):**
```
OLD: } else if (input.completedSteps.has(step)) {
       status = 'completed';
     }
NEW: } else if (input.completedSteps.has(step)) {
       status = 'done';
     }
```

**Nota finale**: riga 215 di `tool-ux-state.ts` non era documentata nel piano originale (v1.1/v1.2) — scoperta durante la verifica pre-esecutiva. Il typecheck di TASK-016 l'avrebbe catturata come errore di tipo; qui è resa esplicita per zero sorprese.

---

## 8. Related Specifications / Further Reading

- [domain-ubiquitous-language-glossary](docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-naming-decision-log](docs/07-governance/domain-naming-decision-log.md)
- [tool-generation-flow-source-of-truth-spec](docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
- [frontend-xstate-refactor-as-is-changelog-2026-05-02](docs/03-development/frontend-xstate-refactor-as-is-changelog-2026-05-02.md)
