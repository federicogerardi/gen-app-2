---
goal: Completare UX-flow per relaunch artifact generation e checkpoint resume
version: 1.1
date_created: 2026-04-26
last_updated: 2026-04-26
owner: Frontend Platform Team
status: Planned
tags: [feature, ux-flow, generation, checkpoint, relaunch]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano definisce interventi deterministici per completare il comportamento UX-flow in scope: relaunch artifact generation e checkpoint resume, allineando implementazione frontend e specifica funzionale.

## 1. Requirements & Constraints

- **REQ-001**: Implementare entrypoint `resume` da pagina artifact con navigazione verso tool target e query obbligatorie `sourceArtifactId`, `projectId`, `intent=resume`, `tone`, `notes`.
- **REQ-002**: Implementare entrypoint `regenerate` da pagina artifact con navigazione verso tool target e query obbligatorie `sourceArtifactId`, `projectId`, `intent=regenerate`, `tone`, `notes`.
- **REQ-003**: La CTA primaria del form deve essere derivata runtime e non statica, con mapping stato -> label/comportamento conforme alla specifica UX.
- **REQ-004**: In stato `paused-with-checkpoint` la CTA primaria deve invocare resume dal checkpoint selezionato e non avviare una generazione generica.
- **REQ-005**: In stato `prefilled-regenerate` la CTA primaria deve visualizzare `Rigenera ora` e avviare run completa con contesto precompilato.
- **REQ-006**: Eliminare dead-end nel form: garantire sempre almeno una next action valida per path `resume` e `regenerate`.
- **REQ-007**: Dopo relaunch da artifact, il form tool deve atterrare con dati estratti gia disponibili e stato step idratato da output persistiti a DB.
- **REQ-008**: Gli step del tool devono essere precompilati con output recuperati dallo storico artifact/checkpoint del progetto, senza richiedere nuova estrazione se recovery data valida.
- **REQ-009**: La nuova generazione completa deve produrre nuove varianti archiviate nello storico artifact e referenziate al briefing file usato nel run corrente.
- **SEC-001**: Sanitizzare tutti i valori query provenienti da artifact (`trim`, fallback `null`) prima della navigazione.
- **SEC-002**: Non propagare `idempotencyKey` da artifact originale durante relaunch.
- **CON-001**: Non introdurre breaking changes nei tipi pubblici `GenerationRequest`, `GenerationArtifact`, `ToolCheckpoint`.
- **CON-002**: Mantenere compatibilita con stream machine esistente (`REQUEST_START`, `RETRY`, `CANCEL`, `RESET`).
- **GUD-001**: Riutilizzare funzioni di derivazione stato gia esistenti in `tool-ux-state.ts` per evitare branching duplicato.
- **PAT-001**: Separare chiaramente responsabilita tra navigazione (artifact pages/history), prefill stato (form), e avvio stream (workspace provider).

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Formalizzare gap implementativi nello scope e definire contratto di navigazione deterministicamente verificabile.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-001 | Verificare mismatch tra specifica UX e codice corrente nei punti: `buildRelaunchRequest` in `frontend/src/features/generation/ui/artifact-history.ts`, `relaunch` in `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`, CTA artifact in `frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`, CTA form in `frontend/src/features/generation/ui/GenerationForm.tsx`. |  |  |
| TASK-002 | Definire contratto query params per `resume` e `regenerate` (chiavi, normalizzazione, fallback) in documento tecnico interno `docs/02-design/specifications/tool-generation-structural-ux-flow-spec.md` come appendice operativa. |  |  |
| TASK-003 | Definire matrice stato->azione primaria/secondaria con mapping eseguibile: `processing-briefing`, `running`, `paused-with-checkpoint`, `prefilled-regenerate`, `draft-ready`, `completed`, `draft-empty`. |  |  |

Completion Criteria:
Tutti i campi query e le transizioni CTA sono tracciati in una matrice unica e referenziabili da test unitari/integration test senza interpretazione manuale.

### Implementation Phase 2

- **GOAL-002**: Implementare flusso di navigazione artifact -> tool per `resume`/`regenerate` senza avvio stream diretto lato action relaunch.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-004 | Introdurre funzione pura `buildArtifactEntryQuery(artifact, intent)` in `frontend/src/features/generation/ui/artifact-history.ts` con output `URLSearchParams` serializzato includendo `sourceArtifactId`, `projectId`, `intent`, `tone`, `notes` se presenti. |  |  |
| TASK-005 | Modificare `ArtifactDetailPage` (`frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`) per sostituire `generation.relaunch(...)` con `useNavigate()` verso route tool con query costruita da `buildArtifactEntryQuery`. |  |  |
| TASK-006 | Modificare `ArtifactHistoryPanel` (`frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx`) esponendo due azioni separate: `onResumeFromArtifact` e `onRegenerateFromArtifact`; invocarle da `GenerationConsolePage`. |  |  |
| TASK-007 | Aggiornare `GenerationConsolePage` (`frontend/src/features/generation/pages/GenerationConsolePage.tsx`) per fornire handler di navigazione centralizzati e conservare `onOpenProject` invariato. |  |  |
| TASK-007A | Estendere query di ingresso con riferimento lineage al run sorgente (`relaunchFromArtifactId`) per consentire ricostruzione deterministica dello stato step dal backend. |  |  |

Completion Criteria:
Click su CTA artifact non avvia `REQUEST_START` immediato; la UI naviga al tool target con query corretta e verificabile tramite test.

### Implementation Phase 3

- **GOAL-003**: Implementare prefill e resume checkpoint coerenti con query di ingresso e disponibilita checkpoint riusabile.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-008 | Estendere `GenerationForm` (`frontend/src/features/generation/ui/GenerationForm.tsx`) per leggere query di ingresso (`intent`, `projectId`, `sourceArtifactId`, `tone`, `notes`) e inizializzare stato locale una sola volta per mount. |  |  |
| TASK-009 | Integrare risoluzione automatica checkpoint migliore via `selectBestCheckpointForProject` in presenza di `intent=resume`, con fallback esplicito a stato `resume-needs-briefing` quando manca extraction context. |  |  |
| TASK-010 | Introdurre guardia `isReusableCheckpoint(checkpoint)` in `frontend/src/features/generation/ui/tool-checkpoints.ts` per filtrare checkpoint non riusabili nel path resume da artifact. |  |  |
| TASK-011 | Aggiornare `GenerationWorkspaceProvider` (`frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`) separando API `start(request)` da API `buildRelaunchRequest` e rimuovendo accoppiamento tra relaunch action e stream start. |  |  |
| TASK-011A | Implementare idratazione step form da output gia persistiti, usando lookup su artifact/checkpoint per `projectId` + `sourceArtifactId` e mapping nei campi step UI. |  |  |
| TASK-011B | In caso di recovery data valida, impostare automaticamente fase `review` con step precompilati; in caso di recovery incompleta, forzare fallback guidato a `resume-needs-briefing`. |  |  |

Completion Criteria:
Con query `intent=resume` e checkpoint valido la UI entra in `paused-with-checkpoint`; con query `intent=regenerate` e source artifact valido la UI entra in `prefilled-regenerate`; gli step risultano idratati da output gia presenti a DB.

### Implementation Phase 4

- **GOAL-004**: Rendere le CTA del form pienamente reattive allo stato runtime e senza dead-end.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-012 | Introdurre funzione `derivePrimaryActionDescriptor(state, context)` in `frontend/src/features/generation/ui/tool-ux-state.ts` con label e handler key (`resume-checkpoint`, `regenerate-now`, `start-generation`, `open-last-artifact`, `disabled`). |  |  |
| TASK-013 | Modificare `GenerationForm` per usare il descriptor: cambiare label bottone submit dinamicamente (`Riprendi dal checkpoint`, `Rigenera ora`, `Avvia generazione`, ecc.). |  |  |
| TASK-014 | Aggiungere CTA secondarie condizionali in `GenerationForm` (`Rigenera da zero`, `Resetta setup`, `Nuova generazione`, `Riprova estrazione`) con regole abilitative derivate da canonical state. |  |  |
| TASK-015 | Aggiornare `GenerationStreamPanel` (`frontend/src/features/generation/ui/GenerationStreamPanel.tsx`) per mostrare CTA coerenti con policy corrente e non solo metadato testuale della policy. |  |  |

Completion Criteria:
Ogni canonical state ha CTA primaria coerente e almeno una strategia di uscita; assenza di stati bloccanti senza azione disponibile.

### Implementation Phase 5

- **GOAL-005**: Coprire il comportamento con test automatici e validare regressioni zero.

| Task     | Description | Completed | Date |
| -------- | ----------- | --------- | ---- |
| TASK-016 | Estendere `frontend/src/features/generation/ui/artifact-history.test.ts` con casi su query builder (`resume`/`regenerate`, preservazione `tone`/`notes`, assenza `idempotencyKey`). |  |  |
| TASK-017 | Estendere `frontend/src/features/generation/ui/GenerationForm.test.tsx` con test CTA primaria dinamica per stati `paused-with-checkpoint` e `prefilled-regenerate`. |  |  |
| TASK-018 | Aggiungere test in `frontend/src/features/generation/ui/tool-checkpoints.test.ts` per `isReusableCheckpoint` e fallback su `resume-needs-briefing`. |  |  |
| TASK-019 | Aggiungere test integration page-level in `frontend/src/features/generation/pages/GenerationConsolePage` (nuovo file test) per verificare wiring handler da ArtifactHistoryPanel e navigazione query. |  |  |
| TASK-019A | Aggiungere test integration su idratazione step da DB: ingresso da artifact -> form precompilato con output step salvati, senza nuova estrazione. |  |  |
| TASK-019B | Aggiungere test end-to-end su rilancio completo: nuova variante creata, visibile in storico artifact, e linkata a `briefingId`/`briefingFileName` del run. |  |  |
| TASK-020 | Eseguire `npm --prefix frontend run test` e `npm --prefix frontend run typecheck`; bloccare merge se uno dei due fallisce. |  |  |

Completion Criteria:
Test verdi, typecheck verde, coverage dei path `resume`/`regenerate` tracciata da test nominati, e verifica esplicita del linkage variante->briefing.

## 3. Alternatives

- **ALT-001**: Mantenere `generation.relaunch` come avvio diretto stream senza navigazione; scartata perche viola la specifica UX di redirect con query e riduce osservabilita del prefill.
- **ALT-002**: Gestire resume/regenerate solo con stato in-memory globale senza query URL; scartata perche impedisce deep-linking e riproducibilita del flow.
- **ALT-003**: Spostare tutta la logica CTA nel solo `GenerationStreamPanel`; scartata perche il form e il punto di ingresso primario per setup/runtime gating.

## 4. Dependencies

- **DEP-001**: `react-router-dom` (`useNavigate`, eventuale `useSearchParams`) gia presente nel frontend.
- **DEP-002**: Stato runtime da `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx`.
- **DEP-003**: Derivazione stato da `frontend/src/features/generation/ui/tool-ux-state.ts`.
- **DEP-004**: Specifica UX normativa in `docs/02-design/specifications/tool-generation-structural-ux-flow-spec.md`.
- **DEP-005**: Endpoint/adapter backend per recupero output step gia persistiti da artifact/checkpoint su progetto.
- **DEP-006**: Contratto backend per persistenza lineage varianti e associazione a `briefingId`/`briefingFileName`.

## 5. Files

- **FILE-001**: `frontend/src/features/generation/ui/artifact-history.ts` - builder query e relaunch payload.
- **FILE-002**: `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` - separazione API avvio stream vs relaunch intent.
- **FILE-003**: `frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` - CTA resume/regenerate basate su navigazione.
- **FILE-004**: `frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx` - wiring azioni resume/regenerate da storico.
- **FILE-005**: `frontend/src/features/generation/pages/GenerationConsolePage.tsx` - orchestrazione handler e props verso pannelli.
- **FILE-006**: `frontend/src/features/generation/ui/GenerationForm.tsx` - prefill query, CTA dinamiche, fallback anti dead-end.
- **FILE-007**: `frontend/src/features/generation/ui/tool-ux-state.ts` - descriptor azioni primarie/secondarie.
- **FILE-008**: `frontend/src/features/generation/ui/GenerationStreamPanel.tsx` - rendering CTA coerenti con policy.
- **FILE-009**: `frontend/src/features/generation/ui/tool-checkpoints.ts` - regole checkpoint riusabile.
- **FILE-010**: `frontend/src/features/generation/ui/artifact-history.test.ts` - test relaunch/query.
- **FILE-011**: `frontend/src/features/generation/ui/GenerationForm.test.tsx` - test stati e CTA reattive.
- **FILE-012**: `frontend/src/features/generation/ui/tool-checkpoints.test.ts` - test regole resume/checkpoint.
- **FILE-013**: `frontend/src/features/generation/runtime/step-hydration.ts` - mapping deterministico output DB -> campi step form (nuovo modulo).
- **FILE-014**: `frontend/src/features/generation/pages/GenerationConsolePage.test.tsx` - test integrazione navigazione + idratazione step + lineage varianti.

## 6. Testing

- **TEST-001**: Verificare che da pagina artifact `resume` produca URL con `intent=resume`, `projectId`, `sourceArtifactId` validi.
- **TEST-002**: Verificare che da pagina artifact `regenerate` produca URL con `intent=regenerate` e campi opzionali `tone`/`notes` se presenti.
- **TEST-003**: Verificare che `GenerationForm` con query `resume` + checkpoint riusabile mostri CTA primaria `Riprendi dal checkpoint`.
- **TEST-004**: Verificare che `GenerationForm` con query `regenerate` + source artifact mostri CTA primaria `Rigenera ora`.
- **TEST-005**: Verificare assenza `idempotencyKey` nel payload relaunch derivato.
- **TEST-006**: Verificare fallback a `resume-needs-briefing` quando checkpoint non ha extraction context.
- **TEST-007**: Verificare assenza dead-end: per ogni canonical state esiste almeno una CTA attiva o una CTA primaria con messaggio esplicito di blocco.
- **TEST-008**: Verificare atterraggio su form con step gia compilati da output DB dopo relaunch da artifact.
- **TEST-009**: Verificare che il rilancio completo salvi una nuova variante in storico artifact con linkage al briefing usato.

## 7. Risks & Assumptions

- **RISK-001**: Divergenza tra route tool target reale e route usata dal builder query puo rompere deep-linking.
- **RISK-002**: Prefill aggressivo da query puo sovrascrivere input utente se non limitato al primo mount.
- **RISK-003**: Introduzione CTA secondarie dinamiche puo creare regressioni visuali se non allineata a design primitives.
- **RISK-004**: Inconsistenza tra output step salvati e schema UI corrente puo causare idratazione parziale o errata.
- **ASSUMPTION-001**: Le route tool supportano parametri query standard e non richiedono stato extra in navigation state.
- **ASSUMPTION-002**: I campi `tone` e `notes` sono opzionali e serializzabili come stringhe semplici.
- **ASSUMPTION-003**: La machine frontend stream resta invariata e non richiede nuovi eventi per coprire lo scope.
- **ASSUMPTION-004**: Il backend espone dati sufficienti per ricostruire gli step (output per step + metadati briefing) senza query manuali addizionali lato operatore.

## 8. Related Specifications / Further Reading

- docs/02-design/specifications/tool-generation-structural-ux-flow-spec.md
- docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
- docs/02-design/specifications/gui-scope-as-is-spec.md