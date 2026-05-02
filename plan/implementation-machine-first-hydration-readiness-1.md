---
goal: Ridurre complessita UI tools con hydration/readiness machine-first
version: 1.1
date_created: 2026-05-02
last_updated: 2026-05-03
owner: Frontend Platform
status: In Progress
tags: [implementation-plan, frontend, xstate, machine-first, hydration, readiness]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Piano esecutivo per eliminare logica di recovery e readiness dal livello UI tools, spostandola in macchine XState v5 idiomatiche.

Contesto problema:
- la UI contiene recovery extraction, polling e segnali readiness derivati localmente
- il backend e il DB espongono gia campi utili per decisioni deterministiche lato macchina
- i casi legacy su artifact extraction (campi input incompleti) rendono fragile il flusso attuale
- il changelog as-is precedente marca il tema recovery come closed; questo piano formalizza riapertura controllata con nuovo perimetro machine-first e gate dedicati

Obiettivo target:
- UI presenter-thin (render + dispatch)
- toolPageMachine owner unico di hydration/readiness/policy
- riduzione fallback procedurali in ToolPageTemplate

## 1. Requirements & Constraints

- REQ-001: `toolPageMachine` deve possedere interamente la decisione di readiness senza boolean passati dalla UI.
- REQ-002: L’hydration da artifact deve essere orchestrata da actor logic v5 (`fromPromise`) invocata dalla macchina.
- REQ-003: Compatibilita garantita con artifact extraction legacy privi di `input.briefingId` o `input.toolKey`.
- REQ-004: `ToolPageTemplate` non deve contenere polling recovery (`setInterval`) ne logica di ranking artifact recovery.
- REQ-005: Contratti pagina `FunnelPagesToolPage` e `NextlandToolPage` invariati.
- REQ-006: Nessun side effect dentro `assign`; side effect solo in invoke actor logic.
- REQ-007: I campi DB disponibili in `artifacts` devono essere sfruttati nel modello frontend quando utili a gating/error path:
  - `failure_reason`
  - `streamed_at`
  - `completed_at`
- REQ-008: Mantenere compatibilita API correnti; eventuali estensioni backend sono additive.
- REQ-009: La macchina deve essere owner dei dati di hydration; la UI puo solo inviare identificatori di input (`sourceArtifactId`, `intent`, `projectId`) e non puo passare liste artifacts pre-ordinate o logiche di ranking.
- REQ-010: Modifiche al contract eventi interni (es. payload `PROGRESS_SYNCED`) devono essere allineate nello stesso sprint a source-of-truth e changelog, con delta esplicito di governance.

Vincoli DB analizzati:
- Tabella `artifacts` con campi `type`, `workflow_type`, `input_json`, `status`, `failure_reason`, `streamed_at`, `completed_at`.
- Tabella `request_idempotency` con `status` e `artifact_id` (FK su `artifacts.id`) utile per recovery deterministico futura.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Allineare il modello artifact frontend ai campi DB che migliorano gating e diagnosi.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Estendere `BackendArtifact` in `frontend/src/features/artifacts/runtime/artifacts-client.ts` con campi opzionali `failureReason`, `streamedAt`, `completedAt` mappati dal payload backend. | Yes | 2026-05-03 |
| TASK-002 | Estendere `GenerationArtifact` in `frontend/src/features/generation/ui/artifact-history.ts` con gli stessi campi opzionali e aggiornare conversione `toGenerationArtifact(...)`. | Yes | 2026-05-03 |
| TASK-003 | Garantire fallback backward-compatible: se i nuovi campi non sono presenti nel payload backend, il mapping resta stabile senza regressioni. Includere normalizzazione naming `snake_case`/`camelCase` nel mapper client. | Yes | 2026-05-03 |

Acceptance gate fase 1:
- typecheck frontend verde
- test `artifacts-client`/`artifact-history` verdi o aggiornati
- contratto payload verificato: mapping valido per entrambe le varianti `failure_reason|failureReason`, `streamed_at|streamedAt`, `completed_at|completedAt`

### Implementation Phase 2

- GOAL-002: Spostare hydration/recovery extraction in `toolPageMachine` con actor invocato.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-004 | In `frontend/src/features/tools/machines/tool-page.machine.ts` introdurre eventi `HYDRATE_REQUESTED`, `HYDRATION_SUCCEEDED`, `HYDRATION_FAILED`. | Yes | 2026-05-03 |
| TASK-005 | Introdurre stato dedicato di hydration (es. sottostato in `configuring`) con invoke actor logic `fromPromise` che risolve extraction context da `sourceArtifactId`, `intent`, `projectId`. L'actor deve recuperare artifacts via `listArtifacts/getArtifactById` usando `apiBaseUrl/capabilities` da context macchina; vietato passare `artifacts list` dalla UI. | Yes | 2026-05-03 |
| TASK-006 | Centralizzare in macchina il ranking artifact recovery oggi in UI: priorita `sourceExtractionArtifactId`, match briefingId, recency per `updatedAt`. | Yes | 2026-05-03 |
| TASK-007 | Gestire compatibilita legacy in macchina: se artifact e `extraction` e manca `briefingId`, usare fallback deterministico su artifact id come chiave di recovery. | Yes | 2026-05-03 |
| TASK-008 | Aggiornare `viewModel.messages` e reason code in caso `HYDRATION_FAILED` con errore deterministicamente tracciabile. | Yes | 2026-05-03 |

Acceptance gate fase 2:
- nessuna chiamata `listArtifacts(...)` per recovery dentro `ToolPageTemplate`
- pass test machine su path hydration success/fail/legacy

### Implementation Phase 3

- GOAL-003: Rendere readiness interamente machine-computed.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-009 | Aggiornare payload `PROGRESS_SYNCED` in `tool-page.machine.ts`: deprecare `hasExtractionContext` e `hasPrimaryTargetStep` lato input UI e derivarli internamente da context macchina; rimozione definitiva consentita solo dopo update source-of-truth/changelog nello stesso sprint. | Yes | 2026-05-03 |
| TASK-010 | Derivare internamente `hasExtractionContext` dal context macchina (hydration + briefing actor snapshot). | Yes | 2026-05-03 |
| TASK-011 | Derivare internamente `hasPrimaryTargetStep` dal progress e policy macchina (senza input UI). | Yes | 2026-05-03 |
| TASK-012 | Aggiornare `canStartGeneration` per dipendere solo da context macchina e policy macchina, mantenendo invarianti anti-deadlock. | Yes | 2026-05-03 |

Acceptance gate fase 3:
- readiness calcolata esclusivamente da context macchina (verificata via test su `tool-page.machine` e payload `PROGRESS_SYNCED` ridotto)
- source-of-truth e changelog aggiornati per riflettere il contract `PROGRESS_SYNCED` adottato in fase 3
- test `tool-page.machine.test.ts` verdi su nuove guardie

### Implementation Phase 4

- GOAL-004: Semplificare `ToolPageTemplate` a puro adapter senza recovery procedurale.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-013 | Rimuovere polling recovery (`setInterval`) da `frontend/src/features/tools/ui/ToolPageTemplate.tsx`. | Yes | 2026-05-03 |
| TASK-014 | Rimuovere ranking/recovery artifact locale da `ToolPageTemplate`, sostituendo con dispatch evento macchina (`HYDRATE_REQUESTED`) e sola lettura snapshot. | Yes | 2026-05-03 |
| TASK-015 | Mantenere in UI solo eventi utente (start/cancel/retry/reset) e navigazione, senza logica di dominio recovery/readiness. | Yes | 2026-05-03 |
| TASK-016 | Conservare comportamento UX esistente (copy CTA, stato blocco readiness, view artifact) usando solo `toolPageSnapshot.context.viewModel`. | Yes | 2026-05-03 |

Acceptance gate fase 4:
- nessun calcolo recovery/readiness in template
- `ToolPageTemplate.test.tsx` verde con casi resume da extraction artifact

### Implementation Phase 5

- GOAL-005: Hardening test + opzionale estensione backend additive.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-017 | Estendere test `tool-page.machine.test.ts` con scenari extraction artifact legacy, assenza briefingId, hydration failure, retry successivo. | Yes | 2026-05-03 |
| TASK-018 | Estendere test `briefing-upload.machine.test.ts` per eventi recovery ricevuti in `idle` e in `extracting` (idempotenza). | Yes | 2026-05-03 |
| TASK-019 | Estendere test `ToolPageTemplate.test.tsx` verificando assenza regressioni CTA e assenza dipendenza da stream globale cross-tool. | Yes | 2026-05-03 |
| TASK-020 | Opzionale: valutare endpoint artifacts/detail che ritorna anche `failure_reason`, `streamed_at`, `completed_at` e, se utile, metadato di hydration canonicale (additivo, non breaking). | No | - |

Acceptance gate fase 5:
- suite target verde
- typecheck frontend verde
- smoke test manuale resume da extraction artifact: brief visibile nel modulo e start generation stabile
- regola chiusura fase: `TASK-020` non blocca la chiusura se `TASK-017/018/019` sono completati e documentati; se avviato, deve essere tracciato in appendice come follow-up

## 3. Execution Policy

Ordine sprint raccomandato (vincolante):
1. Sprint 1 -> Implementation Phase 1 (`TASK-001..003`)
2. Sprint 2 -> Implementation Phase 2 (`TASK-004..008`)
3. Sprint 3 -> Implementation Phase 3 (`TASK-009..012`)
4. Sprint 4 -> Implementation Phase 4 (`TASK-013..016`)
5. Sprint 5 -> Implementation Phase 5 (`TASK-017..019` + eventuale `TASK-020`)

Regole operative sprint-by-sprint:
- Eseguire una sola phase per sprint; vietato fondere phase consecutive nello stesso sprint.
- Aggiornare tabella task (`Completed`, `Date`) entro la chiusura di ogni sprint.
- Se uno o piu gate di phase falliscono, sprint in stato `NO-GO` e avanzamento bloccato alla phase successiva.
- Ogni sprint chiude con evidenza comandi test/typecheck e con decisione esplicita `GO` o `NO-GO`.

Criteri GO/NO-GO per phase:

### Phase 1 (Sprint 1)
- GO se:
  - `TASK-001..003` completati
  - gate phase 1 verdi
  - mapping payload verificato su varianti `snake_case` e `camelCase`
- NO-GO se:
  - typecheck fallisce
  - regressione su `artifacts-client` o `artifact-history`
  - mapping nuovi campi non deterministico o non backward-compatible

### Phase 2 (Sprint 2)
- GO se:
  - `TASK-004..008` completati
  - gate phase 2 verdi
  - ownership hydration in macchina rispettata (nessuna lista artifacts passata dalla UI)
- NO-GO se:
  - resta recovery/ranking artifacts in UI
  - `HYDRATION_FAILED` non produce reason code e messaggio deterministici
  - test machine hydration non verdi

### Phase 3 (Sprint 3)
- GO se:
  - `TASK-009..012` completati
  - gate phase 3 verdi
  - guardie start generation dipendono solo da context/policy macchina
- NO-GO se:
  - `PROGRESS_SYNCED` mantiene boolean readiness derivati dalla UI
  - test su guardie e readiness falliscono

### Phase 4 (Sprint 4)
- GO se:
  - `TASK-013..016` completati
  - gate phase 4 verdi
  - `ToolPageTemplate` e solo adapter (render + dispatch)
- NO-GO se:
  - persiste `setInterval` o ranking recovery locale in template
  - CTA/readiness divergono dal `viewModel` macchina

### Phase 5 (Sprint 5)
- GO se:
  - `TASK-017..019` completati
  - gate phase 5 verdi
  - smoke test manuale resume da extraction artifact conferma brief visibile e start stabile
- NO-GO se:
  - regressioni cross-tool su loading/CTA
  - test suite target o typecheck falliscono
  - comportamento resume non deterministico su artifact legacy

Nota `TASK-020`:
- `TASK-020` e opzionale e non blocca GO di Sprint 5.
- Se eseguito, deve risultare tracciato come appendice follow-up con impatto e decisione rollout.

## 4. Alternatives

- ALT-001: Mantenere recovery in UI e aggiungere solo fix puntuali. Non scelta perche aumenta regressioni future.
- ALT-002: Spostare tutta la logica in hook custom React senza macchina. Non scelta perche rompe il principio XState-first.
- ALT-003: Rinviare l’estensione del modello artifact frontend. Non scelta perche limita osservabilita error path e recovery diagnostics.

## 5. Dependencies

- DEP-001: `xstate` v5 e `@xstate/react` gia presenti in frontend.
- DEP-002: `listArtifacts` e `getArtifactById` in `frontend/src/features/artifacts/runtime/artifacts-client.ts`.
- DEP-003: `buildExtractionContextFromArtifact` in `frontend/src/features/generation/runtime/step-hydration.ts`.
- DEP-004: Contratti attuali `ToolPageTemplate`, `toolPageMachine`, `briefingUploadMachine`.
- DEP-005: Schema `artifacts` disponibile in `db/migrations/20260424_000001_generation_adapters_minimal.sql`.
- DEP-006: Vincolo `request_idempotency.artifact_id` disponibile in `db/migrations/20260424_000002_request_idempotency_artifact_fk.sql`.

## 6. Files

- FILE-001: `frontend/src/features/tools/machines/tool-page.machine.ts` - orchestrazione hydration/readiness.
- FILE-002: `frontend/src/features/tools/machines/tool-page.machine.test.ts` - copertura nuova logica macchina.
- FILE-003: `frontend/src/features/tools/ui/ToolPageTemplate.tsx` - rimozione recovery procedurale.
- FILE-004: `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` - regressione CTA/dispatch.
- FILE-005: `frontend/src/features/generation/runtime/step-hydration.ts` - fallback legacy extraction.
- FILE-006: `frontend/src/features/artifacts/runtime/artifacts-client.ts` - mapping campi DB estesi.
- FILE-007: `frontend/src/features/generation/ui/artifact-history.ts` - modello artifact esteso.
- FILE-008: `frontend/src/features/tools/machines/briefing-upload.machine.ts` - gestione recovery coerente cross-state.
- FILE-009: `frontend/src/features/tools/machines/briefing-upload.machine.test.ts` - test idempotenza recovery.

## 7. Testing

- TEST-001: `npm --prefix frontend run test -- src/features/tools/machines/tool-page.machine.test.ts`
- TEST-002: `npm --prefix frontend run test -- src/features/tools/machines/briefing-upload.machine.test.ts`
- TEST-003: `npm --prefix frontend run test -- src/features/tools/ui/ToolPageTemplate.test.tsx`
- TEST-004: `npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`
- TEST-005: `npm --prefix frontend run typecheck`
- TEST-006: smoke test manuale deterministico resume da artifact extraction legacy (con e senza `briefingId` in input)
- TEST-007: test unitario mapper artifacts su payload mixed-case (`snake_case` e `camelCase`) per `failureReason`, `streamedAt`, `completedAt`

## 8. Risks & Assumptions

- RISK-001: Regressioni su CTA readiness durante migrazione del payload `PROGRESS_SYNCED`.
- RISK-002: Differenze formato payload backend per nuovi campi artifact (naming snake_case vs camelCase).
- RISK-003: Possibile coupling non voluto tra machine hydration e availability rete.
- ASSUMPTION-001: Le API artifacts espongono almeno `projectId`, `type`, `status`, `updatedAt` e identificatori artifact necessari al recovery deterministico.
- ASSUMPTION-002: Il refactor resta frontend-first; eventuali estensioni backend sono additive e pianificabili in sprint successivo.

## 9. Related Specifications / Further Reading

- `plan/unification-xstate-first-frontend-1.md`
- `plan/refactor-xstate-frontend-machines-1.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
- `docs/03-development/frontend-xstate-refactor-as-is-changelog-2026-05-02.md`
- `db/migrations/20260424_000001_generation_adapters_minimal.sql`
- `db/migrations/20260424_000002_request_idempotency_artifact_fk.sql`
