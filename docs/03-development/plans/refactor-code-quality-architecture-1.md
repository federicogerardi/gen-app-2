---
goal: Risoluzione sistematica dei 12 problemi di qualità, architettura e modularità identificati nel code review del 2026-05-05
version: 1.2
date_created: 2026-05-05
last_updated: 2026-05-05
owner: Engineering
status: 'Completed'
tags: [refactor, quality, architecture, dry, modularità, scalabilità, chore]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Piano derivato dal code review del 2026-05-05 che ha identificato 12 problemi distribuiti su 4 livelli di impatto: bug concreti (P1/P11), dead code e stub (P6/P7/P8), problemi architetturali moderati (P9/P10), e refactor strutturali ad alto sforzo (P2/P3/P4/P5/P12). Il piano era stato chiuso dopo 4 fasi complete, ma viene **riaperto** in data 2026-05-05 sulla base della code review aggiornata post-fix: 9 problemi risolti, 1 parzialmente risolto (P1), 2 volutamente aperti (P2, P3), 5 nuovi punti di hardening (N1–N5).

### Update 2026-05-05 — Code Review Post-Fix

| Area | Stato | Note |
|---|---|---|
| P4, P5, P6, P7, P8, P9, P10, P11, P12 | ✅ Risolti | Implementati e verificati da gate G-1..G-4 |
| P1 | ⚠️ Parziale | Residuo parser duplicato in `tools-client.ts` |
| P2, P3 | 🔴 Aperti deliberatamente | Vincolo architetturale e fuori scope fase precedente |
| N1, N2, N3, N4, N5 | 🟡 Nuovi | Refactor hardening + test coverage mancanti |

Non è richiesta la creazione di nuovi termini DDD per questo piano: tutti i problemi sono di qualità/architettura implementativa, non di linguaggio di dominio. I termini `ExtractionContext`, `readExtractionPayloadFromArtifact`, `GenerationArtifact` e `generateRequestId` sono già canonici nei riferimenti DDD esistenti.

---

## 1. Requirements & Constraints

- **REQ-001**: Nessuna modifica al comportamento runtime osservabile nelle fasi 1 e 2. Le fasi 3 e 4 possono alterare strutture interne ma non contratti pubblici verso il BE.
- **REQ-002**: Il termine canonico per la funzione di parsing è `readExtractionPayloadFromArtifact` (step-hydration.ts). Nessuna nuova copia locale è ammessa — tutti i caller devono importare da step-hydration.
- **REQ-003**: `generateRequestId` in `shared-utils.ts` è la fonte canonica per la generazione di ID casuali. `randomId()` in tools-client.ts è un duplicato da rimuovere.
- **REQ-004**: I test devono rimanere verdi (o restare allo stato di baseline pre-esistente) al termine di ogni fase. Non è accettabile introdurre regressioni aggiuntive.
- **REQ-005**: `useBriefingUpload` è dead code. Il suo test in `useToolForm.test.tsx` valida codice non eseguito a runtime — rimuovere entrambi.
- **REQ-006**: `getCompletedArtifactForStep` ritorna la stringa hardcodata `'found'` invece di un artifact ID. Poiché non è usata da nessun codice runtime, va rimossa (non implementata).
- **CON-001**: Le fasi sono sequenziali: Fase 1 → Fase 2 → Fase 3 → Fase 4. La Fase 3 (estrazione TOOL_WORKFLOW_REGISTRY) non deve essere eseguita prima che la Fase 1 abbia stabilizzato il parsing.
- **CON-002**: I file in `docs/99-lifecycle/99-archive/` non devono essere modificati.
- **CON-003**: La Fase 4 (God Component + registry unificato + routing data-driven) è ad alto sforzo. Ogni task di Fase 4 deve essere approvato individualmente prima dell'esecuzione.
- **GUD-001**: Seguire il pattern import-from-canonical: quando una funzione esiste già in un modulo condiviso, importarla da lì — non ridefinirla localmente.
- **GUD-002**: I tipi UI locali (`type StepStatus = ...`) non devono essere ridefiniti nei componenti: importare sempre dal tipo canonico nella machine.
- **REQ-007**: Completare il residuo P1 esponendo un parser canonico riusabile da step-hydration verso tools-client, evitando copie locali della stessa logica di envelope parsing.
- **REQ-008**: `ToolPageTemplate` deve rimanere presentazionale puro: nessuna esposizione diretta di snapshot macchina o `toolPageSend` nel componente.
- **REQ-009**: Tutti i log diagnostici in `useToolPage` devono essere protetti da `if (import.meta.env.DEV)`.
- **REQ-010**: Implementare i test pianificati ma mancanti: TEST-005 (`useToolPage`) e TEST-006 (`isRecord` array guard).

---

## 2. Implementation Steps

### Implementation Phase 1 — Bug fix e correzioni isRecord (P1, P8, P11)

- GOAL-001: Eliminare il bug di parsing in `ToolPageTemplate.tsx` che ignora l'envelope BE canonico `extraction.payload`; correggere `isRecord()` in tools-client.ts; consolidare `randomId()` nel canonical `generateRequestId`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx`: aggiungere import `readExtractionPayloadFromArtifact` da `'../../generation/runtime/step-hydration'` nella sezione import a L.31. Verificare che non sia già importata (è presente solo `extractArtifactStep` da step-hydration). | ✅ | 2026-05-05 |
| TASK-002 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx` L.93–100: rimuovere la funzione locale `readExtractionPayloadFromArtifactInput`. Sostituire il suo unico call site a L.540 (`return readExtractionPayloadFromArtifactInput(extractionArtifact)`) con `return readExtractionPayloadFromArtifact(extractionArtifact)`. La funzione canonica verifica già `input.extraction.payload` (envelope BE), `JSON.parse(artifact.content)`, e `input.extractionPayload` nell'ordine corretto. | ✅ | 2026-05-05 |
| TASK-003 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx`: rimuovere la funzione locale `parseExtractionPayloadFromContent` (L.44–99) se non ha altri call site oltre quello rimosso in TASK-002. Verificare con `grep -n "parseExtractionPayloadFromContent" frontend/src/features/tools/ui/ToolPageTemplate.tsx` → deve dare zero risultati. | ✅ | 2026-05-05 |
| TASK-004 | In `frontend/src/features/tools/runtime/tools-client.ts` L.110–112: correggere `isRecord()` aggiungendo `&& !Array.isArray(value)`. La definizione corretta è: `const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);`. Questo allinea il comportamento a quello di step-hydration.ts L.6. | ✅ | 2026-05-05 |
| TASK-005 | In `frontend/src/features/tools/runtime/tools-client.ts`: aggiungere import `generateRequestId` da `'../../../app/runtime/shared-utils'`. Sostituire la chiamata `randomId()` a L.233 con `generateRequestId()`. Rimuovere la definizione locale `const randomId = ...` (L.62–68). Eseguire typecheck per confermare nessun errore. | ✅ | 2026-05-05 |
| TASK-006 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Registrare esito come gate G-1. Tutti i check devono essere verdi (o nella baseline pre-esistente) prima di procedere alla Fase 2. | ✅ | 2026-05-05 |

**Gate G-1**: ✅ typecheck pulito (0 errori); 29 file test, 223 test verdi; `parseExtractionPayloadFromContent`, `readExtractionPayloadFromArtifactInput`, `randomId()` → zero occorrenze.

---

### Implementation Phase 2 — Dead code removal: useBriefingUpload e getCompletedArtifactForStep (P6, P7)

- GOAL-002: Rimuovere il dead code identificato nel code review — il hook deprecato `useBriefingUpload` e la funzione stub `getCompletedArtifactForStep` — insieme ai test che li coprono.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | In `frontend/src/features/tools/runtime/useToolForm.ts`: rimuovere la funzione `useBriefingUpload` (da L.91 fino alla fine della funzione, ~270 righe). Rimuovere anche gli import che diventano inutilizzati per effetto della rimozione (verificare con typecheck). | ✅ | 2026-05-05 |
| TASK-008 | In `frontend/src/features/tools/runtime/useToolForm.test.tsx`: rimuovere l'import di `useBriefingUpload` a L.3 e l'intero blocco `describe('useBriefingUpload', ...)` (L.62 segg.). Mantenere gli altri describe block nel file (se presenti). — **File eliminato** (conteneva solo il describe `useBriefingUpload`). | ✅ | 2026-05-05 |
| TASK-009 | Verificare che `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` L.235 menzioni `useBriefingUpload` solo come mock di un import che non esiste più. Se il test lo mocka come parte di un import da `useToolForm`, rimuovere quella riga di mock. Eseguire typecheck per confermare. | ✅ | 2026-05-05 |
| TASK-010 | In `frontend/src/features/tools/runtime/tool-form-architecture.ts`: rimuovere la funzione `getCompletedArtifactForStep` (L.146–165) e il suo JSDoc. Verificare con `grep -rn "getCompletedArtifactForStep" frontend/src/` → zero risultati dopo la rimozione. | ✅ | 2026-05-05 |
| TASK-011 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Registrare esito come gate G-2. | ✅ | 2026-05-05 |

**Gate G-2**: ✅ `grep -rn "useBriefingUpload\|getCompletedArtifactForStep" frontend/src/` → zero risultati; typecheck pulito (0 errori); 28 file test, 222 test verdi (−1 file, −1 test rimossi come previsto).

---

### Implementation Phase 3 — Estrazione TOOL_WORKFLOW_REGISTRY dal machine file BE (P10) + UI string constants (P9)

- GOAL-003: Ridurre le responsabilità di `generation-system.machine.ts` estraendo il registry inline nel file dedicato `tool-workflow-registry.ts`; estrarre le stringhe UI dalla machine in costanti dedicate.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | In `src/lib/runtime/tool-workflow-registry.ts`: esportare il tipo `ToolWorkflowPlan` (attualmente privato in generation-system.machine.ts L.388–392): `export type ToolWorkflowPlan = { toolKey: string; steps: WorkflowStepDescriptor[]; dependencyGraph: Record<string, string[]>; }`. Il tipo `WorkflowStepDescriptor` deve essere esportato o importato dallo stesso file. Verificare prima che `WorkflowStepDescriptor` sia già definito o importabile. | ✅ | 2026-05-05 |
| TASK-013 | In `src/lib/runtime/tool-workflow-registry.ts`: aggiungere e esportare `TOOL_WORKFLOW_REGISTRY` come costante pubblica con il contenuto attualmente inline in `generation-system.machine.ts` L.394–430 (le definizioni di `funnel-pages` e `nextland`). Il contenuto è identico a quanto già espresso in `toolWorkflowStepOrder` + `stepDependencies` in `tool-form-architecture.ts` (FE). | ✅ | 2026-05-05 |
| TASK-014 | In `src/lib/machines/generation-system.machine.ts`: aggiungere import `{ TOOL_WORKFLOW_REGISTRY, ToolWorkflowPlan }` da `'../runtime/tool-workflow-registry'`. Rimuovere la definizione locale `type ToolWorkflowPlan` (L.388–392) e la costante locale `const TOOL_WORKFLOW_REGISTRY` (L.394–430). Verificare che `resolveToolWorkflowPlan`, `isFinalStepForPlan` e i call site a L.507 e L.1035 continuino a compilare senza errori. | ✅ | 2026-05-05 |
| TASK-015 | In `frontend/src/features/tools/machines/tool-page.machine.ts`: creare un oggetto costante locale `TOOL_PAGE_MESSAGES` sopra la funzione `buildInitialViewModel`: `const TOOL_PAGE_MESSAGES = { readyStatus: 'Pronto per la generazione', waitingStatus: 'Seleziona un progetto e carica un brief per iniziare', } as const;`. Sostituire le stringhe inline a L.169–170 con `TOOL_PAGE_MESSAGES.readyStatus` e `TOOL_PAGE_MESSAGES.waitingStatus`. | ✅ | 2026-05-05 |
| TASK-016 | Eseguire `npm run typecheck` (BE) e `npm --prefix frontend run typecheck` (FE). Eseguire `npm run test` e `npm --prefix frontend run test`. Registrare esito come gate G-3. | ✅ | 2026-05-05 |

**Gate G-3**: ✅ `TOOL_WORKFLOW_REGISTRY` non più definizione locale in `generation-system.machine.ts`; stringhe hardcodate rimosse dalla machine FE; BE typecheck pulito (0 errori), 62/62 test verdi; FE typecheck pulito (0 errori), 28 file test, 222 test verdi.

---

### Implementation Phase 4 — Refactor architetturali strutturali (P2 parziale, P4, P5, P12) — Alta complessità

- GOAL-004: Ridurre la complessità di `ToolPageTemplate.tsx` estraendo l'orchestrazione delle macchine in un hook dedicato; unificare le page wrapper in una factory; rendere il routing data-driven. Questa fase è ad alto sforzo e ogni task deve essere validato individualmente.

> ⚠️ **Nota**: i task di questa fase alterano la struttura di componenti critici. Eseguire un task alla volta con gate intermedi. Non eseguire in autonomia senza approvazione esplicita per ogni task.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | **P5 — Factory page wrapper**: creare `frontend/src/features/tools/ui/createToolPage.tsx` che esporta `createToolPage(toolKey: SupportedTool): React.FC`. Il component factory legge i `searchParams` con `useSearchParams`, chiama `parseToolEntryParams`, e renderizza `<ToolPageTemplate toolKey={toolKey} {...params} />`. Aggiornare `FunnelPagesToolPage.tsx` e `NextlandToolPage.tsx` per usare la factory: `export const FunnelPagesToolPage = createToolPage('funnel-pages')`. Verificare typecheck. | ✅ | 2026-05-05 |
| TASK-018 | **P12 — Routing data-driven**: in `frontend/src/app/routing/app-router.tsx` definire un array `TOOL_ROUTES: Array<{ toolKey: SupportedTool; path: string; component: React.LazyExoticComponent<...> }>` derivato da `toolFormRegistry` (tool-form-architecture.ts). Sostituire le route manuali per `funnel-pages` e `nextland` con un `TOOL_ROUTES.map(...)`. Mantenere il lazy import per ogni tool wrapper. Verificare typecheck e che il routing funzioni per entrambi i tool. | ✅ | 2026-05-05 |
| TASK-019 | **P4 — Hook useToolPage**: estrarre da `ToolPageTemplate.tsx` tutti gli hook XState, i `useEffect` di orchestrazione, la logica di source artifact resolution, la hydration context, e la logica auto-chain in un hook dedicato `frontend/src/features/tools/runtime/useToolPage.ts`. Il hook deve accettare le stesse props di `ToolPageTemplate` e restituire i valori necessari al rendering. `ToolPageTemplate` deve diventare un componente di sola presentazione che usa `useToolPage` e delega il rendering a `ToolGenerationFlowVertical` e `ToolActionButtons`. Target: `ToolPageTemplate.tsx` sotto le 200 righe dopo l'estrazione. | ✅ | 2026-05-05 |
| TASK-020 | Eseguire `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, e smoke test manuale delle pagine funnel-pages e nextland. Registrare esito come gate G-4. | ✅ | 2026-05-05 |

**Gate G-4** ✅ 2026-05-05: `ToolPageTemplate.tsx` = 162 righe (< 200); routing generato da `TOOL_ROUTES` (via `toolFormRegistry`); typecheck clean; 28 test file, 222 test verdi; smoke test manuale positivo su extraction + funnel-pages (`optin`, `quiz`, `vsl`).

---

### Implementation Phase 5 — Hardening post code-review aggiornata (P1 residuo, N1–N5)

- GOAL-005: Chiudere il residuo P1, rimuovere leakage architetturali nel boundary hook→presentational, e completare la coverage test pianificata.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | **P1 residuo**: adottare la soluzione canonica coerente con la review: esportare da `frontend/src/features/generation/runtime/step-hydration.ts` la funzione parser core multi-envelope (nome consigliato: `parseExtractionArtifactContent`) e riusarla in `frontend/src/features/tools/runtime/tools-client.ts`. In `tools-client.ts` è ammesso solo un wrapper minimale di adattamento input/output, senza logica di envelope parsing duplicata (`parseJsonCandidate`/`parseJsonContent` da rimuovere o ridurre a delega diretta). Criterio di completamento: parser core definito una sola volta nel codebase frontend. | ✅ | 2026-05-05 |
| TASK-022 | **N1**: in `frontend/src/features/tools/runtime/useToolPage.ts` esporre `streamingStep: ToolStep | null` già derivato; rimuovere `generationSnapshot` dal return API del hook. Aggiornare `frontend/src/features/tools/ui/ToolPageTemplate.tsx` per usare solo `streamingStep`. | ✅ | 2026-05-05 |
| TASK-023 | **N2**: in `frontend/src/features/tools/runtime/useToolPage.ts` esporre handler semantici `handleBriefingFileSelected(file)` e `handleBriefingReset()`. In `frontend/src/features/tools/ui/ToolPageTemplate.tsx` rimuovere chiamate dirette a `toolPageSend(...)` sugli eventi briefing. | ✅ | 2026-05-05 |
| TASK-024 | **N3 + N4**: proteggere `console.debug('[useToolPage] sending HYDRATE_REQUESTED', ...)` con `if (import.meta.env.DEV)`; ridurre il return object del hook rimuovendo campi non usati dal consumer (incluso `progressState` se non necessario). | ✅ | 2026-05-05 |
| TASK-025 | **N5 / TEST-005**: aggiungere `frontend/src/features/tools/runtime/useToolPage.test.ts` con test su inizializzazione macchina, hydration path, e dispatch avvio step (mock dependency boundary). | ✅ | 2026-05-05 |
| TASK-026 | **N5 / TEST-006**: estendere `frontend/src/features/tools/runtime/tools-client.test.ts` con caso esplicito che verifica che top-level array non venga trattato come record (`isRecord` guard). | ✅ | 2026-05-05 |
| TASK-027 | Eseguire gate finale G-5: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm run typecheck`, `npm run test` e smoke test manuale relaunch/generation su funnel-pages. | ✅ | 2026-05-05 |

**Gate G-5** ✅ 2026-05-05: P1 chiuso (nessuna duplicazione parser core); `ToolPageTemplate` senza accesso diretto a snapshot/send della macchina; log debug gated in DEV; nuovi test TEST-005/006 verdi; suite FE+BE verde (29 file / 227 test FE, 63 test BE); smoke test autenticato generazione artefatto: OK.

---

## 3. Alternatives

- **ALT-001**: Per P1, invece di delegare a `readExtractionPayloadFromArtifact` da step-hydration, si potrebbe spostare tutta la logica di parsing in `shared-utils.ts`. Scartato: step-hydration è il modulo canonico owner dell'`ExtractionContext` (DDD-007, DDD-028); spostarlo in shared-utils violerebbe la coesione del bounded context Frontend.
- **ALT-002**: Per P10, invece di estrarre `TOOL_WORKFLOW_REGISTRY` in tool-workflow-registry.ts, si potrebbe eliminare uno dei due registri BE (toolWorkflowStepOrder o TOOL_WORKFLOW_REGISTRY). Scartato: i due registri servono scopi diversi (`toolWorkflowStepOrder` per ordinamento step, `TOOL_WORKFLOW_REGISTRY` per dependency graph completo). La soluzione corretta è consolidarli nello stesso file (tool-workflow-registry.ts), non eliminarne uno.
- **ALT-003**: Per P4 (God Component), si potrebbe mantenere `ToolPageTemplate.tsx` as-is e aggiungere commenti di documentazione. Scartato: il componente ha 9 `useEffect` e 929 righe — la testabilità isolata è impossibile senza estrazione.
- **ALT-004**: Per P2 (4 registri), si potrebbe creare un file `tool-definitions.ts` condiviso importato da FE e BE. Scartato nel breve termine: FE e BE hanno build separate; un file condiviso richiederebbe un monorepo workspace o un package dedicato. Rinviato a future architettura a pacchetti condivisi. Il TASK-013 (estrazione in tool-workflow-registry.ts) è il passo intermedio fattibile oggi.
- **ALT-005**: Per P6 (useBriefingUpload), si potrebbe convertire i test esistenti per coprire `briefingUploadMachine` invece di rimuoverli. Preferito il approach di rimozione: i test attuali validano la macchina a stati interna del hook (implementazione), non comportamento osservabile. I test di `briefingUploadMachine.test.ts` già coprono il comportamento canonico.

---

## 4. Dependencies

- **DEP-001**: TASK-001/002 (P1 fix in ToolPageTemplate) dipendono da `readExtractionPayloadFromArtifact` già esportata da step-hydration.ts — confermato presente a L.100 del file.
- **DEP-002**: TASK-005 (randomId → generateRequestId) dipende da `generateRequestId` già esportata da shared-utils.ts — confermato presente a L.11.
- **DEP-003**: TASK-012/013 (estrazione TOOL_WORKFLOW_REGISTRY) dipendono da `WorkflowStepDescriptor` — verificare che sia già definito/esportabile da tool-workflow-registry.ts o da un tipo condiviso BE prima di eseguire.
- **DEP-004**: TASK-017 (factory createToolPage) dipende dall'interfaccia stabile di `ToolPageTemplate` props — non modificare ToolPageTemplate props durante la Fase 4 finché TASK-017 non è completato.
- **DEP-005**: TASK-019 (hook useToolPage) è il task più dipendente: richiede che TASK-017 sia completato e che nessun refactor di ToolPageTemplate sia in corso in parallelo.
- **DEP-006**: TASK-021 richiede sincronizzazione tra `step-hydration.ts` e `tools-client.ts` per evitare regressioni sul path extraction raw-content.
- **DEP-007**: TASK-022/023/024 dipendono da API contract stabile del hook `useToolPage` verso `ToolPageTemplate`.
- **DEP-008**: TASK-025 dipende da boundary di testability nel hook (handler e valori derivati esposti in modo deterministico).

---

## 5. Files

- **FILE-001**: `frontend/src/features/tools/ui/ToolPageTemplate.tsx` — Fase 1 (rimozione funzioni locali), Fase 4 (estrazione hook)
- **FILE-002**: `frontend/src/features/tools/runtime/tools-client.ts` — Fase 1 (fix isRecord, rimozione randomId)
- **FILE-003**: `frontend/src/features/tools/runtime/useToolForm.ts` — Fase 2 (rimozione useBriefingUpload)
- **FILE-004**: `frontend/src/features/tools/runtime/useToolForm.test.tsx` — Fase 2 (rimozione test useBriefingUpload)
- **FILE-005**: `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` — Fase 2 (rimozione mock useBriefingUpload)
- **FILE-006**: `frontend/src/features/tools/runtime/tool-form-architecture.ts` — Fase 2 (rimozione getCompletedArtifactForStep)
- **FILE-007**: `src/lib/runtime/tool-workflow-registry.ts` — Fase 3 (aggiunta ToolWorkflowPlan + TOOL_WORKFLOW_REGISTRY)
- **FILE-008**: `src/lib/machines/generation-system.machine.ts` — Fase 3 (rimozione TOOL_WORKFLOW_REGISTRY inline, import da tool-workflow-registry)
- **FILE-009**: `frontend/src/features/tools/machines/tool-page.machine.ts` — Fase 3 (estrazione TOOL_PAGE_MESSAGES)
- **FILE-010**: `frontend/src/features/tools/ui/createToolPage.tsx` — Fase 4 (nuovo file, factory)
- **FILE-011**: `frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx` — Fase 4 (usa factory)
- **FILE-012**: `frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx` — Fase 4 (usa factory)
- **FILE-013**: `frontend/src/app/routing/app-router.tsx` — Fase 4 (routing data-driven)
- **FILE-014**: `frontend/src/features/tools/runtime/useToolPage.ts` — Fase 4 (nuovo file, hook estratto da ToolPageTemplate)
- **FILE-015**: `frontend/src/features/generation/runtime/step-hydration.ts` — Fase 5 (parser canonico riusabile)
- **FILE-016**: `frontend/src/features/tools/runtime/useToolPage.test.ts` — Fase 5 (nuovo file test hook)

---

## 6. Testing

- **TEST-001**: Gate G-1 — `npm --prefix frontend run typecheck` e `npm --prefix frontend run test` verdi dopo Fase 1. Verificare che `parseExtractionPayloadFromContent` e `readExtractionPayloadFromArtifactInput` non compaiano più in ToolPageTemplate.tsx.
- **TEST-002**: Gate G-2 — `npm --prefix frontend run typecheck` e `npm --prefix frontend run test` verdi dopo Fase 2. Verificare `grep -rn "useBriefingUpload\|getCompletedArtifactForStep" frontend/src/` → zero risultati.
- **TEST-003**: Gate G-3 — typecheck FE + BE, test FE + BE verdi dopo Fase 3. Verificare che `TOOL_WORKFLOW_REGISTRY` non sia più una costante locale in `generation-system.machine.ts`.
- **TEST-004**: Gate G-4 — typecheck + test + smoke test manuale delle tool page dopo Fase 4. Verificare che `ToolPageTemplate.tsx` sia < 200 righe.
- **TEST-005**: Aggiungere test unitari per `useToolPage` hook in `frontend/src/features/tools/runtime/useToolPage.test.ts` (Fase 5) che verifichino inizializzazione macchine, hydration, e avvio generazione step in isolamento.
- **TEST-006**: Aggiungere test in `frontend/src/features/tools/runtime/tools-client.test.ts` che verifichino che top-level array venga rifiutato come record (`isRecord` guard).
- **TEST-007**: Gate G-5 — typecheck/test FE+BE verdi dopo i task di hardening post-review (`npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm run typecheck`, `npm run test` tutti senza fail).

---

## 7. Risks & Assumptions

- **RISK-001**: `ToolPageTemplate.tsx` ha 9 `useEffect` con dipendenze potenzialmente accoppiate. L'estrazione in `useToolPage` (TASK-019) potrebbe modificare l'ordine di esecuzione degli effetti. Mitigazione: eseguire smoke test completo dopo TASK-019 prima del gate G-4.
- **RISK-002**: `useBriefingUpload` in `useToolForm.test.tsx` potrebbe essere referenziato in altri file non individuati. Mitigazione: eseguire `grep -rn "useBriefingUpload" frontend/src/` prima di TASK-007 e rimuovere tutti i riferimenti trovati.
- **RISK-003**: `ToolWorkflowPlan` in generation-system.machine.ts usa `WorkflowStepDescriptor` che potrebbe non essere definito in tool-workflow-registry.ts. Se non presente, TASK-012 deve prima definirlo o importarlo da un tipo condiviso. Mitigazione: verificare con `grep -rn "WorkflowStepDescriptor" src/lib/` prima di TASK-012.
- **RISK-004**: Il routing data-driven (TASK-018) usa `toolFormRegistry` (FE) ma potrebbe non coprire tool con routing speciale (parametri route diversi). Verificare che tutti i tool in `toolFormRegistry` abbiano path uniformi prima di TASK-018.
- **RISK-005**: Estrazione parser canonico (TASK-021) può alterare fallback parsing su artifact legacy/non-JSON. Mitigazione: aggiungere test di parità con fixture già presenti in `tools-client.test.ts` e `step-hydration`.
- **RISK-006**: Ridurre superficie return di `useToolPage` (TASK-024) può rompere consumer futuri non tipati. Mitigazione: aggiornare solo consumer espliciti e validare con typecheck + test.
- **ASSUMPTION-001**: Per la riapertura Phase 5 il criterio di qualità è aggiornato a "suite FE+BE verde"; eventuali fail pre-esistenti devono essere risolti o esplicitamente rimossi dallo scope prima della chiusura del gate G-5.
- **ASSUMPTION-002**: `readExtractionPayloadFromArtifact` in step-hydration.ts è già esportata come funzione pubblica (confermato da L.100 del file nella sessione di analisi).
- **ASSUMPTION-003**: `generateRequestId` in shared-utils.ts è già importabile da tools-client.ts senza circular dependency (percorso: `features/tools/runtime/` → `app/runtime/shared-utils.ts` — percorso upward, non circolare).

---

## 8. Related Specifications / Further Reading

- [Code review originale — 2026-05-05](../docs/code-review/2026-05-03-checkpoint-recovery-overengineering-analysis.md)
- [domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md) — ExtractionContext (DDD-007), StepHydration (DDD-028)
- [domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md) — DDD-C-007 (getStepDependencies drift), DDD-019 (toolStepOrder)
- [refactor-ddd-ul-drift-alignment-1.md](./refactor-ddd-ul-drift-alignment-1.md) — piano drift DDD correlato (Fase B: chiusura DDD-C-007)
- [step-hydration.ts](../frontend/src/features/generation/runtime/step-hydration.ts) — funzione canonica `readExtractionPayloadFromArtifact`
- [shared-utils.ts](../frontend/src/app/runtime/shared-utils.ts) — `generateRequestId` canonica
