---
goal: Esecuzione unificazione XState-first frontend tools
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Frontend Platform
status: Completed
archived: 2026-05-02
archive_reason: Piano completato end-to-end con GO/NO-GO finale approvato
tags: [feature, frontend, xstate, unification, hardening, governance]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

> **Archiviato**: 2026-05-02 — 5 sprint completati, 21 test verdi, typecheck pass, documentazione allineata.
> Piano sorgente attivo: `plan/unification-xstate-first-frontend-1.md`

Piano esecutivo deterministico per eliminare in modo definitivo la duplicazione di logica tra macchina XState e livello UI nel flusso tool generation frontend. Il risultato target e una sola sorgente canonica di decisione in `tool-page.machine.ts`, con UI ridotta a rendering + dispatch eventi e documentazione allineata al comportamento reale.

## 1. Requirements & Constraints

- **REQ-001**: Tutte le decisioni di readiness, canonical UI state e primary action policy devono essere prodotte esclusivamente da `frontend/src/features/tools/machines/tool-page.machine.ts`.
- **REQ-002**: Il contesto macchina deve esporre un `viewModel` completo e tipizzato con i campi: `readiness`, `canonicalState`, `primaryActionPolicy`, `secondaryActionFlags`, `stepStatuses`, `messages`.
- **REQ-003**: Il componente `frontend/src/features/tools/ui/ToolPageTemplate.tsx` non deve calcolare policy o stato derivato; deve solo consumare `toolPageSnapshot.context.viewModel`.
- **REQ-004**: Il componente `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` deve mappare i reason code in output testuale deterministico con una sola tabella di mapping.
- **SEC-001**: Le transizioni macchina non devono introdurre loop di recovery; ogni evento di resume/checkpoint deve essere idempotente rispetto allo stesso artifact input.
- **SEC-002**: La compatibilita con artifact legacy senza `sourceRequest.input.toolKey` deve restare garantita e coperta da test.
- **ARC-001**: Le guardie di transizione (`canStartGeneration` e analoghe) devono dipendere solo da context macchina e mai da stato React locale.
- **CON-001**: Non modificare i contratti pubblici dei componenti pagina `FunnelPagesToolPage` e `NextlandToolPage`.
- **CON-002**: Non introdurre modifiche ai contratti API HTTP/SSE backend.
- **GUD-001**: Nessun side effect dentro funzioni `assign` XState.
- **GUD-002**: Ogni task di refactor deve includere almeno un gate di verifica automatico (test o typecheck).
- **PAT-001**: Pattern architetturale obbligatorio: machine-first presenter-thin.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Consolidare il view model macchina come unica fonte dati per decisioni di stato e policy.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | In `frontend/src/features/tools/machines/tool-page.machine.ts` definire il tipo `ToolPageViewModel` con i campi obbligatori e default espliciti; vietato uso di `any`. | Yes | 2026-05-02 |
| TASK-002 | In `frontend/src/features/tools/machines/tool-page.machine.ts` implementare `buildToolPageViewModel(context, event)` funzione pura senza side effect e senza accesso a dipendenze esterne. | Yes | 2026-05-02 |
| TASK-003 | Nello handler evento `PROGRESS_SYNCED` aggiornare `context.viewModel` solo tramite `buildToolPageViewModel(...)` e rimuovere derivazioni ridondanti locali. | Yes | 2026-05-02 |
| TASK-004 | Uniformare guard `canStartGeneration` con `context.readiness.canStartFlow`; aggiungere assert di coerenza con `viewModel.primaryActionPolicy` nello stesso file. | Yes | 2026-05-02 |

### Implementation Phase 2

- GOAL-002: Ridurre `ToolPageTemplate` a adapter puro con dispatch eventi e rendering state-driven.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-005 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx` rimuovere calcoli locali di `primaryTargetStep` o equivalenti che duplicano policy macchina. | Yes | 2026-05-02 |
| TASK-006 | Sostituire in `frontend/src/features/tools/ui/ToolPageTemplate.tsx` consumo da `useToolUiState` con selector unico `toolPageSnapshot.context.viewModel` dove applicabile. | Yes | 2026-05-02 |
| TASK-007 | Mantenere in `frontend/src/features/tools/ui/ToolPageTemplate.tsx` solo wiring eventi (`REQUEST_STEP_START`, `CANCEL_GENERATION`, `RESUME_CHECKPOINT`) e rendering condizionale da viewModel. | Yes | 2026-05-02 |

### Implementation Phase 3

- GOAL-003: Stabilizzare il contract UI verticale e il mapping reason codes.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-008 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` allineare props al contract viewModel e rimuovere props non usate. | Yes | 2026-05-02 |
| TASK-009 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` implementare mapping reasonCode -> messaggio requisito tramite mappa costante interna unica. | Yes | 2026-05-02 |
| TASK-010 | In `frontend/src/features/tools/runtime/tool-ux-state.ts` rimuovere o deprecare derivazioni duplicate non piu necessarie dopo adozione totale del viewModel macchina. | Yes | 2026-05-02 |

### Implementation Phase 4

- GOAL-004: Inserire gate di regressione automatici su coerenza macchina-template-vertical flow.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-011 | Estendere `frontend/src/features/tools/machines/tool-page.machine.test.ts` con casi su coerenza `readiness`/`primaryActionPolicy`/`viewModel` per resume e checkpoint legacy. | Yes | 2026-05-02 |
| TASK-012 | Estendere `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` per verificare CTA e dispatch eventi senza derivazioni locali. | Yes | 2026-05-02 |
| TASK-013 | Estendere `frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` con tre mapping reason code obbligatori e fallback default. | Yes | 2026-05-02 |
| TASK-014 | Eseguire test target + typecheck frontend e registrare esito in questo piano con data, senza procedere alla fase 5 se un gate fallisce. | Yes | 2026-05-02 |

### Implementation Phase 5

- GOAL-005: Allineare la documentazione tecnica al comportamento implementato e renderla base di audit futura.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-015 | Aggiornare `docs/index-overview.md` riportando stato fix checkpoint recovery e riferimento al modello XState-first consolidato. | Yes | 2026-05-02 |
| TASK-016 | Aggiornare `frontend/src/features/tools/ui/TOOL_GENERATION_FLOW_VERTICAL.md` con contract props reale, reason codes e flussi effettivi. | Yes | 2026-05-02 |
| TASK-017 | Aggiornare specifica machine-friendly in `docs/` con sezione source-of-truth su ownership macchina e limiti del template. | Yes | 2026-05-02 |

## 9. Sprint Execution Log

### Sprint 1 - Phase 1 (Completed)

- Scope eseguito: TASK-001, TASK-002, TASK-003, TASK-004.
- Gate automatici eseguiti:
	- PASS: `npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts`
	- FAIL (pre-esistente, fuori scope Sprint 1): `npm --prefix frontend run typecheck`
		- errori su `frontend/src/features/tools/runtime/useToolForm.ts`
		- errori su `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`
- Decisione sprint: Sprint 1 chiusa sul perimetro Phase 1; backlog typecheck globale mantenuto per gestione in sprint dedicata o gate finale.

### Sprint 2 - Phase 2 (Completed)

- Scope eseguito: TASK-005, TASK-006, TASK-007.
- Gate automatici eseguiti:
	- PASS: `npm --prefix frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`
- Decisione sprint: Sprint 2 chiusa con template machine-first e wiring eventi invariato.

### Sprint 3 - Phase 3 (Completed)

- Scope eseguito: TASK-008, TASK-009, TASK-010.
- Gate automatici eseguiti:
	- PASS: `npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx`
	- PASS: `npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts`
- Decisione sprint: Sprint 3 chiusa con contract verticale ridotto, mapping reason code centralizzato e derivazioni runtime duplicate deprecate.

### Sprint 4 - Phase 4 (Completed)

- Scope eseguito: TASK-011, TASK-012, TASK-013, TASK-014.
- Gate automatici eseguiti:
	- PASS: `npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`
	- PASS: `npm --prefix frontend run typecheck`
- Decisione sprint: Sprint 4 chiusa con gate regressione completo verde su macchina/template/vertical e type-safety frontend.

### Sprint 5 - Phase 5 (Completed)

- Scope eseguito: TASK-015, TASK-016, TASK-017.
- Gate documentali eseguiti:
	- PASS: allineamento `docs/index-overview.md` al consolidamento XState-first e al source-of-truth corrente.
	- PASS: aggiornamento contract tecnico `frontend/src/features/tools/ui/TOOL_GENERATION_FLOW_VERTICAL.md` ai campi realmente consumati.
	- PASS: aggiornamento source-of-truth machine-friendly `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` con ownership `toolPageMachine.context.viewModel`.
- Decisione sprint: Sprint 5 chiusa; piano completato end-to-end.

## Final GO/NO-GO

- Verdict: **GO**
- Data chiusura: 2026-05-02
- Test: 21/21 verdi (machine 9, template 8, vertical 4)
- Typecheck: pass
- Cross-doc review: 0 criticità bloccanti, 3 correzioni documentali minori applicate
