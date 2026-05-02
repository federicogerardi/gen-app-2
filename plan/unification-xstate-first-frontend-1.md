---
goal: Unification XState-first frontend hardening plan
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Frontend Platform
status: Planned
tags: [xstate, frontend, unification, architecture, hardening]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Piano di implementazione per rimuovere inconsistenze e duplicazioni residue nel frontend, consolidando un modello XState-first dove la macchina e la sorgente canonica di stato/decisione UI.

Contesto audit:
- readiness gating gia centralizzato in `toolPageMachine` con snapshot e reason codes
- persiste duplicazione nella derivazione di canonical UI state e primary action policy fuori macchina
- documentazione tecnica del componente verticale non allineata al codice reale

## 1. Objectives

- OBJ-001: Portare ownership completa di readiness + policy primaria nel contesto macchina.
- OBJ-002: Ridurre la logica UI derivata lato template a puro rendering di un selector macchina.
- OBJ-003: Eliminare mismatch tra documentazione e implementazione corrente.
- OBJ-004: Blindare regressioni con test unitari e integration sui path checkpoint/resume/regenerate.

## 2. Scope

In scope:
- `frontend/src/features/tools/machines/tool-page.machine.ts`
- `frontend/src/features/tools/ui/ToolPageTemplate.tsx`
- `frontend/src/features/tools/runtime/tool-ux-state.ts`
- `frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`
- test correlati (`tool-page.machine.test.ts`, `ToolPageTemplate.test.tsx`, `ToolGenerationFlowVertical.test.tsx`)
- documentazione tecnica frontend/XState allineata

Out of scope:
- refactor backend
- redesign UI visuale
- modifica contratti API HTTP/SSE

## 3. Requirements & Constraints

- REQ-001: Eventi macchina devono trasportare solo segnali raw o dati di dominio; evitare boolean aggregati derivati in presenter quando la macchina puo derivarli.
- REQ-002: Nessun side effect dentro `assign`.
- REQ-003: Guardie di transizione devono dipendere da context macchina, non da stato React locale.
- REQ-004: Ogni cambiamento su policy/derivazione deve avere test di regressione dedicato.
- CON-001: Non rompere i contratti dei componenti pagina (`FunnelPagesToolPage`, `NextlandToolPage`).
- CON-002: Mantenere compatibilita con artifact legacy privi di `sourceRequest.input.toolKey`.

## 4. Target Architecture (XState-first)

Single source of truth lato tool page:

1. `toolPageMachine.context.viewModel`
- `readiness` (gia presente, reason codes inclusi)
- `canonicalState`
- `primaryActionPolicy`
- `secondaryActionFlags`
- `stepStatuses`
- `messages` (status/error)

2. Template come adapter
- invia eventi macchina
- legge un solo selector macchina per stato/policy/readiness
- non ricalcola policy primaria in locale

3. UI verticale e CTA
- render guidato da `viewModel` macchina
- reason codes usati per feedback deterministico requisiti

## 5. Implementation Plan

### Phase 1 - Machine ViewModel Consolidation

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Introdurre `ToolPageViewModel` nel context macchina con campi canonical state/policy/secondary/step statuses/messages. |  |  |
| TASK-002 | Aggiungere builder puro `buildToolPageViewModel(...)` interno alla macchina (no side effects). |  |  |
| TASK-003 | Aggiornare `PROGRESS_SYNCED` per alimentare il viewModel senza dipendere da derivazioni presenter duplicate. |  |  |
| TASK-004 | Uniformare guard `canStartGeneration` su `context.readiness.canStartFlow` + coerenza `viewModel.primaryActionPolicy`. |  |  |

Completion criteria:
- macchina espone `context.viewModel` consistente con `context.readiness`
- nessuna policy primaria calcolata fuori macchina

### Phase 2 - Template Simplification

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-005 | Rimuovere derivazioni duplicate nel template (`primaryTargetStep` dipendente da policy locale non canonica, mapping stato ridondante). |  |  |
| TASK-006 | Sostituire consumo `useToolUiState` con selector macchina (`toolPageSnapshot.context.viewModel`). |  |  |
| TASK-007 | Mantenere solo logica strettamente presentazionale e wiring eventi (`REQUEST_STEP_START`, `CANCEL_GENERATION`, ecc.). |  |  |

Completion criteria:
- `ToolPageTemplate` non contiene logica di policy/stato duplicata rispetto alla macchina
- avvio/cancel/resume restano invarianti sui path utenti

### Phase 3 - UI Contract Hardening

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-008 | Allineare `ToolGenerationFlowVertical` al nuovo contract viewModel (status/reason/messages). |  |  |
| TASK-009 | Rimuovere props inutilizzate o ridondanti (es. campi non renderizzati). |  |  |
| TASK-010 | Garantire mapping deterministico reason codes -> dettaglio requisito pronto. |  |  |

Completion criteria:
- contratto props minimale e coerente
- nessun campo non usato nel componente verticale

### Phase 4 - Test Coverage and Regression Gates

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-011 | Estendere `tool-page.machine.test.ts` con casi viewModel (policy/readiness coherence). |  |  |
| TASK-012 | Estendere `ToolPageTemplate.test.tsx` per verificare che CTA e guard macchina restino allineate. |  |  |
| TASK-013 | Estendere `ToolGenerationFlowVertical.test.tsx` con casi messaggi/status da viewModel macchina. |  |  |
| TASK-014 | Eseguire suite target frontend tools e validare zero unhandled errors. |  |  |

Completion criteria:
- test verdi sui path resume/regenerate/checkpoint legacy
- nessun warning runtime legato a loop o inconsistenza gating

### Phase 5 - Documentation Alignment

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-015 | Aggiornare docs architetturali frontend per dichiarare la macchina come source of truth completa. |  |  |
| TASK-016 | Aggiornare doc tecnica `TOOL_GENERATION_FLOW_VERTICAL.md` con class naming, contract props e flow reali attuali. |  |  |
| TASK-017 | Aggiornare eventuali checklist/migration doc con stato completamento unificazione XState-first. |  |  |

Completion criteria:
- nessuna divergenza documentale tra contract dichiarati e codice in produzione

## 6. Testing Commands

```bash
npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts
npm --prefix frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx
npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx
npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx
npm --prefix frontend run typecheck
```

## 7. Risks & Mitigations

- RISK-001: regressione funzionale su CTA/start nei casi resume-checkpoint.
  - MIT-001: test integration su click CTA + assert guard/transizione macchina.

- RISK-002: overfitting del viewModel a un solo tool.
  - MIT-002: test matrix su `funnel-pages` e `nextland` con stesso contract.

- RISK-003: persistenza logica duplicata involontaria nel template.
  - MIT-003: code review checklist con regola "no policy derivation outside machine".

- RISK-004: docs obsolete post-refactor.
  - MIT-004: phase dedicata di documentation alignment nello stesso change set.

## 8. Deliverables

- DEL-001: `toolPageMachine` con `viewModel` completo e tipizzato
- DEL-002: `ToolPageTemplate` semplificato a wiring + rendering
- DEL-003: `ToolGenerationFlowVertical` contract ridotto e coerente
- DEL-004: suite test aggiornata e verde
- DEL-005: documentazione frontend/XState allineata alla vision XState-first
