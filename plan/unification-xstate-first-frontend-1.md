---
goal: Esecuzione unificazione XState-first frontend tools
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Frontend Platform
status: Completed
tags: [feature, frontend, xstate, unification, hardening, governance]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

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

Acceptance gate fase 1:
- `context.viewModel` valorizzato in tutti i path della macchina (init, resume, regenerate, checkpoint restore).
- Nessuna derivazione di primary action policy al di fuori della macchina.

### Implementation Phase 2

- GOAL-002: Ridurre `ToolPageTemplate` a adapter puro con dispatch eventi e rendering state-driven.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-005 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx` rimuovere calcoli locali di `primaryTargetStep` o equivalenti che duplicano policy macchina. | Yes | 2026-05-02 |
| TASK-006 | Sostituire in `frontend/src/features/tools/ui/ToolPageTemplate.tsx` consumo da `useToolUiState` con selector unico `toolPageSnapshot.context.viewModel` dove applicabile. | Yes | 2026-05-02 |
| TASK-007 | Mantenere in `frontend/src/features/tools/ui/ToolPageTemplate.tsx` solo wiring eventi (`REQUEST_STEP_START`, `CANCEL_GENERATION`, `RESUME_CHECKPOINT`) e rendering condizionale da viewModel. | Yes | 2026-05-02 |

Acceptance gate fase 2:
- Nessuna funzione di derivazione policy/stato nel template.
- Flussi utente start/cancel/resume invariati rispetto al comportamento corrente.

### Implementation Phase 3

- GOAL-003: Stabilizzare il contract UI verticale e il mapping reason codes.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-008 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` allineare props al contract viewModel e rimuovere props non usate. | Yes | 2026-05-02 |
| TASK-009 | In `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` implementare mapping reasonCode -> messaggio requisito tramite mappa costante interna unica. | Yes | 2026-05-02 |
| TASK-010 | In `frontend/src/features/tools/runtime/tool-ux-state.ts` rimuovere o deprecare derivazioni duplicate non piu necessarie dopo adozione totale del viewModel macchina. | Yes | 2026-05-02 |

Acceptance gate fase 3:
- Contratto props minimale, senza campi morti.
- Mapping reason codes deterministico e centralizzato in un punto unico.

### Implementation Phase 4

- GOAL-004: Inserire gate di regressione automatici su coerenza macchina-template-vertical flow.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-011 | Estendere `frontend/src/features/tools/machines/tool-page.machine.test.ts` con casi su coerenza `readiness`/`primaryActionPolicy`/`viewModel` per resume e checkpoint legacy. | Yes | 2026-05-02 |
| TASK-012 | Estendere `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` per verificare CTA e dispatch eventi senza derivazioni locali. | Yes | 2026-05-02 |
| TASK-013 | Estendere `frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` con tre mapping reason code obbligatori e fallback default. | Yes | 2026-05-02 |
| TASK-014 | Eseguire test target + typecheck frontend e registrare esito in questo piano con data, senza procedere alla fase 5 se un gate fallisce. | Yes | 2026-05-02 |

Acceptance gate fase 4:
- Tutti i test target verdi.
- Nessun warning/unhandled error runtime legato a recovery loop o gating readiness.

### Implementation Phase 5

- GOAL-005: Allineare la documentazione tecnica al comportamento implementato e renderla base di audit futura.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-015 | Aggiornare `docs/index-overview.md` riportando stato fix checkpoint recovery e riferimento al modello XState-first consolidato. | Yes | 2026-05-02 |
| TASK-016 | Aggiornare `frontend/src/features/tools/ui/TOOL_GENERATION_FLOW_VERTICAL.md` con contract props reale, reason codes e flussi effettivi. | Yes | 2026-05-02 |
| TASK-017 | Aggiornare specifica machine-friendly in `docs/` con sezione source-of-truth su ownership macchina e limiti del template. | Yes | 2026-05-02 |

Acceptance gate fase 5:
- Nessuna divergenza tra documentazione e codice corrente su state ownership, reason codes e policy decision.

## 3. Alternatives

- **ALT-001**: Mantenere derivazioni UI in `ToolPageTemplate` con sola pulizia parziale. Non scelta perche mantiene rischio regressioni da doppia sorgente di verita.
- **ALT-002**: Spostare tutta la logica in hook React custom separato invece che in macchina XState. Non scelta perche viola il principio machine-first gia adottato.
- **ALT-003**: Rinviare aggiornamento documentazione a ciclo successivo. Non scelta perche prolunga mismatch e aumenta rischio di rollback errati.

## 4. Dependencies

- **DEP-001**: Coerenza tipi TypeScript in `frontend/tsconfig.json` e strict mode attivo sulle aree modificate.
- **DEP-002**: Suite test frontend disponibile tramite script npm nel workspace root.
- **DEP-003**: Contratti eventi XState esistenti in `tool-page.machine.ts` mantenuti compatibili.

## 5. Files

- **FILE-001**: `frontend/src/features/tools/machines/tool-page.machine.ts` - fonte canonica viewModel, guardie e transizioni.
- **FILE-002**: `frontend/src/features/tools/ui/ToolPageTemplate.tsx` - adapter UI che consuma viewModel e dispatcha eventi.
- **FILE-003**: `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` - rendering stato/reason codes.
- **FILE-004**: `frontend/src/features/tools/runtime/tool-ux-state.ts` - eliminazione derivazioni duplicate residue.
- **FILE-005**: `frontend/src/features/tools/machines/tool-page.machine.test.ts` - test coerenza macchina.
- **FILE-006**: `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` - test comportamento template.
- **FILE-007**: `frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` - test mapping reason codes.
- **FILE-008**: `docs/index-overview.md` - stato governance fix e riferimento source-of-truth.
- **FILE-009**: `frontend/src/features/tools/ui/TOOL_GENERATION_FLOW_VERTICAL.md` - documentazione tecnica verticale.

## 6. Testing

- **TEST-001**: `npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts`
- **TEST-002**: `npm --prefix frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx`
- **TEST-003**: `npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`
- **TEST-004**: `npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx`
- **TEST-005**: `npm --prefix frontend run typecheck`
- **TEST-006**: Verifica manuale deterministica: restore checkpoint legacy senza `sourceRequest.input.toolKey` con CTA coerente a `viewModel.primaryActionPolicy`.

## 7. Risks & Assumptions

- **RISK-001**: Regressione CTA/start in resume da checkpoint.
- **RISK-002**: Reintroduzione involontaria di derivazioni locali nel template durante evoluzioni future.
- **RISK-003**: Documentazione non aggiornata rispetto ai nuovi reason code.
- **ASSUMPTION-001**: I test esistenti coprono i principali path funzionali (start, cancel, resume, regenerate).
- **ASSUMPTION-002**: Non sono richieste modifiche backend per completare l'unificazione XState-first frontend.

## 8. Related Specifications / Further Reading

- `plan/feature-railway-same-origin-unified-1.md`
- `plan/refactor-xstate-frontend-machines-1.md`
- `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md`
- `docs/03-development/frontend-xstate-refactor-as-is-changelog-2026-05-02.md`

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
