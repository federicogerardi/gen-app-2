---
goal: Allineare il codebase as-is ai termini canonici DDD/UL (glossario v2.0 + decision log v2.0)
version: 1.0
date_created: 2026-05-04
last_updated: 2026-05-04
owner: Domain Architecture
status: 'Completed'
tags: [refactor, ddd, ubiquitous-language, drift, architecture, chore]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Censimento completo (2026-05-04) dei drift tra il codebase as-is e i tre documenti SOT
(glossario UL v2.0, BCM v1.7, decision log v2.0). Questo piano traduce il censimento in
task atomici, ordinati per severità, eseguibili in maniera autonoma da agenti AI o
sviluppatori umani senza interpretazione aggiuntiva.

I blocchi sono eseguibili in modo indipendente, fatta eccezione per la dipendenza esplicita
tra Blocco A (rimozione meta_ads dall'enum) e tutti i test che usano meta_ads come fixture
(presuppone che l'enum sia già stato ristretto oppure che i test vengano migrati in parallelo).

---

## 1. Requirements & Constraints

- **REQ-001**: Ogni modifica deve rispettare i termini canonici definiti in
  `docs/01-requirements/domain-ubiquitous-language-glossary.md` (v2.0) e le decisioni in
  `docs/07-governance/domain-naming-decision-log.md` (v2.0).
- **REQ-002**: Nessun nuovo sinonimo per un termine canonico esistente. Se serve un nuovo
  termine, aggiungere prima un entry DDD-NNN nel decision log.
- **REQ-003**: La baseline test deve rimanere verde (o allo stato pre-esistente noto) dopo
  ogni fase. Non è accettabile introdurre regressioni aggiuntive.
- **REQ-004**: I file in `docs/99-lifecycle/99-archive/` non devono essere modificati.
  Contengono snapshot storici; qualsiasi occorrenza di termini deprecati in quella cartella
  è out-of-scope.
- **REQ-005**: Tutte le occorrenze legacy rimosse devono essere sostituite con il termine
  canonico corrispondente, non semplicemente eliminate.
- **CON-001**: Gli alias backward-compat in `apps/backend/src/lib/types/xstate.ts` e in
  `apps/backend/src/lib/adapters/generation.adapters.ts` (Blocco E) NON devono essere rimossi prima che
  sia confermato che nessun consumer esterno li usa. Removal target già fissato a 2026-Q3
  (DDD-016, DDD-017).
- **CON-002**: Il prompt directory `apps/backend/src/lib/runtime/tool-prompts/hl_funnel/` non può essere
  rinominato senza aggiornare contestualmente i path in `tool-prompts/index.ts` e i test
  associati. La rinomina è opzionale e separata dalla normalizzazione delle stringhe di routing.
- **GUD-001**: Seguire l'ordine dei blocchi: A → B → C → D → E. I Blocchi A e C possono
  essere eseguiti in parallelo se su branch separati.
- **GUD-002**: Dopo ogni fase eseguire `npm run typecheck` (BE) e `npm --prefix frontend run typecheck` (FE) come gate minimo prima del commit.
- **PAT-001**: Usare il pattern alias-then-remove: introdurre il termine canonico, mantenere
  l'alias deprecated per 1 ciclo (già applicato negli sprint precedenti), poi rimuoverlo nel
  cycle successivo.

---

## 2. Implementation Steps

### Implementation Phase A — Rimozione `meta_ads` da runtime e fixture (DDD-030)

- GOAL-A: Rimuovere `meta_ads` dal set attivo di valori `ToolWorkflow` nel runtime BE e
  sostituire tutti i default e le fixture di test che lo usano con valori canonici.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-A-001 | In `apps/backend/src/lib/types/artifact.ts` riga 24: rimuovere `'meta_ads'` dall'array `TOOL_WORKFLOWS`. La riga corrente è `export const TOOL_WORKFLOWS = ['meta_ads', 'funnel_pages', 'nextland', 'extraction'] as const;` → diventa `export const TOOL_WORKFLOWS = ['funnel_pages', 'nextland', 'extraction'] as const;`. Aggiornare il commento JSDoc per riflettere la rimozione. | | |
| TASK-A-002 | In `apps/frontend/src/features/generation/ui/GenerationForm.tsx` righe 78-79: sostituire `useState('meta_ads')` con `useState('funnel_pages')` per `workflowType` e `useState('funnel-pages')` per `toolKey`. Questo allinea il form console ai valori canonici attivi. | | |
| TASK-A-003 | In `apps/frontend/src/features/generation/ui/artifact-history.test.ts` righe 19-20, 31-32, 145-146, 149-150: sostituire tutte le fixture `toolKey: 'meta_ads'` e `workflowType: 'meta_ads'` con `toolKey: 'funnel-pages'` e `workflowType: 'funnel_pages'`. Verificare che i test che usano `buildToolEntryPathFromArtifact(unsupported, 'resume')` continuino ad attestare `null` (il fixture "unsupported" va aggiornato a usare un ToolKey senza route, per esempio `workflowType: 'extraction'`). | | |
| TASK-A-004 | In `apps/frontend/src/features/generation/ui/tool-checkpoints.test.ts` righe 17-18: sostituire `workflowType: 'meta_ads'` con `workflowType: 'funnel_pages'` e `toolKey: 'meta_ads'` con `toolKey: 'funnel-pages'`. | | |
| TASK-A-005 | In `apps/frontend/src/features/generation/ui/GenerationForm.test.tsx` riga 20: sostituire `toolKey: 'meta_ads'` con `toolKey: 'funnel-pages'`. | | |
| TASK-A-006 | Eseguire `npm run typecheck` e `npm --prefix frontend run typecheck`. Verificare zero errori nuovi. Eseguire `npm --prefix frontend run test` e `npm run test` (o equivalente). Registrare la baseline. | | |

**Gate A**: nessuna occorrenza di `meta_ads` in `apps/backend/src/` o `apps/frontend/src/` eccetto nei file di
archive; typecheck pulito; test non in regressione rispetto alla baseline.

---

### Implementation Phase B — Orchestrazione step: chiusura drift FE/BE (DDD-C-007 / DDD-031)

- GOAL-B: Sostituire la chiamata FE locale `getStepDependencies` in `ToolPageTemplate.tsx` con
  la chiamata al backend endpoint `/api/tools/orchestrate` via `orchestrateToolStep`, rendendo
  il BE la singola authority sulla risoluzione delle dipendenze tra step.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-B-001 | In `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` riga 18: rimuovere l'import di `getStepDependencies` dalla lista importata da `'../runtime/tool-generation-engine'`. Mantenere gli altri import dalla stessa riga se presenti. | | |
| TASK-B-002 | In `frontend/src/features/tools/ui/ToolPageTemplate.tsx`: individuare il blocco che inizia a riga 591 (`const dependencies = getStepDependencies(toolKey, completedArtifactsByStep, step);`). Sostituire questa chiamata sincrona con una chiamata asincrona a `orchestrateToolStep(normalizedProjectId, toolKey, step)` importata da `'../runtime/tools-client'`. La funzione circostante (handler di avvio generazione) deve diventare async oppure usare `.then()`. Gestire l'errore con fallback: se `orchestrateToolStep` fallisce, loggare l'errore e lanciare per impedire la generazione con dipendenze mancanti (no silent fallback a calcolo locale). | | |
| TASK-B-003 | Aggiornare `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`: adattare la firma del handler che chiama `getStepDependencies` per usare `OrchestrationResult` (tipo già esportato da `tools-client.ts` riga 331). Il campo `stepDependencyArtifactIds` nel `GenerationRequest` deve essere popolato da `orchestrationResult.stepDependencyArtifactIds`; il campo `dependencyArtifactIdsByStep` deve essere popolato da `orchestrationResult.dependencyArtifactIdsByStep`. | | |
| TASK-B-004 | In `frontend/src/features/tools/runtime/tool-generation-engine.ts`: marcare `getStepDependencies` come `/** @deprecated use orchestrateToolStep via /api/tools/orchestrate (DDD-C-007) */`. NON rimuoverla in questa fase — potrebbe essere usata da test. | | |
| TASK-B-005 | Verificare che il backend endpoint `/api/tools/orchestrate` sia già esposto con il body atteso `{ projectId, toolKey, targetStep }`. Leggere `src/lib/runtime/auth-http.ts` righe 1125 segg. e la route corrispondente in `src/server.ts` per confermare. Se il campo `projectId` non è usato nella logica backend attuale ma richiesto nel payload, assicurarsi che non generi errori (il BE ignora `projectId` oggi per la risoluzione step — questo è corretto). | | |
| TASK-B-006 | Aggiornare o aggiungere test in `frontend/src/features/tools/runtime/tools-client.test.ts`: aggiungere un test case per `orchestrateToolStep` che mocki la risposta BE con `{ ok: true, data: { orchestration: { toolKey, targetStep, stepDependencyArtifactIds, dependencyArtifactIdsByStep } } }` e verifichi che la funzione restituisca correttamente `OrchestrationResult`. | | |
| TASK-B-007 | Eseguire `npm run typecheck` e `npm --prefix frontend run typecheck`. Eseguire la suite test. Registrare che il call site `getStepDependencies(` non compare più in `ToolPageTemplate.tsx`. | | |

**Gate B**: `rg -n "getStepDependencies(" frontend/src/features/tools/ui/ToolPageTemplate.tsx` → zero risultati; typecheck pulito; test non in regressione.

---

### Implementation Phase C — Consolidamento `ArtifactRelaunch` (primary/secondary drift)

- GOAL-C: Allineare il runtime al concetto canonico `ArtifactRelaunch` (DDD-020): un solo
  concetto di riavvio, un solo CTA effettivo, intent default `regenerate` per artifact-driven
  relaunch. Rimuovere lo split `primary`/`secondary` dall'API pubblica del workspace provider.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-C-001 | In `frontend/src/features/generation/ui/artifact-history.ts`: nella funzione `buildRelaunchRequest` (riga ~161), rimuovere il parametro `mode: 'primary' \| 'secondary'`. Sostituire con un parametro opzionale `intent: WorkflowRunMode = 'regenerate'`. Il campo `relaunchMode` nel request input può essere rimosso o impostato fisso a `'regenerate'` (non è un termine canonico UL — si tratta di un implementation detail interno). Assicurarsi che `relaunchFromArtifactId` sia sempre valorizzato con `artifact.artifactId`. | | |
| TASK-C-002 | In `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` riga 73: aggiornare la firma del campo `relaunch` da `(artifact: GenerationArtifact, mode: 'primary' \| 'secondary') => void` a `(artifact: GenerationArtifact) => void`. Aggiornare l'implementazione a riga 243 per chiamare `buildRelaunchRequest(artifact)` senza `mode`. | | |
| TASK-C-003 | Ricercare tutti i call site di `.relaunch(` nel FE (`rg -n "\.relaunch("  frontend/src`): aggiornare ogni call site per rimuovere l'argomento `mode`. Se i call site non esistono a runtime (il metodo è esposto ma non chiamato direttamente nel codebase attuale, essendo la navigazione gestita via `buildToolEntryPathFromArtifact`), lasciare la firma semplificata senza aggiornamenti aggiuntivi. | | |
| TASK-C-004 | In `frontend/src/app/copy/system.ts` riga 50: rimuovere la chiave `relaunchSecondary: 'Rigenera con nuovi parametri'`. Verificare con `rg -n "relaunchSecondary" frontend/src` che non ci siano consumer attivi. | | |
| TASK-C-005 | In `frontend/src/features/generation/ui/artifact-history.test.ts` riga 68: aggiornare il test `buildRelaunchRequest(sourceArtifact, 'secondary')` rimuovendo il secondo argomento. Aggiornare l'assertion `relaunchMode` se presente — il campo `relaunchMode` sarà rimosso o impostato fisso; verificare che il test attesti solo `relaunchFromArtifactId`. | | |
| TASK-C-006 | Eseguire `npm --prefix frontend run typecheck` e la suite test FE. Eseguire `rg -n "relaunchSecondary\|'primary'\|'secondary'" frontend/src/features/generation/runtime frontend/src/features/generation/ui frontend/src/features/artifacts` per verificare assenza di residui. | | |

**Gate C**: zero occorrenze di `relaunchSecondary` in `frontend/src`; firma `relaunch` non
porta più parametro mode; typecheck pulito.

---

### Implementation Phase D — Strategia legacy `hl_funnel` (naming path prompt)

- GOAL-D: Rendere esplicita e documentata la compatibilità legacy `hl_funnel`, con opzione
  futura di rinomina dei file prompt. In questa fase: consolidare la normalizzazione esistente,
  eliminare le varianti non documentate (`funnelpages`) dal codice di normalizzazione,
  e aggiungere un commento che marca il compat layer per futura rimozione.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-D-001 | In `src/lib/runtime/tool-prompts/index.ts` riga 25 e in `src/lib/machines/generation-system.machine.ts` riga 427: aggiungere un commento inline `// @deprecated-compat: 'hl_funnel' normalizzato a 'funnel-pages' (DDD-030). Rimuovere quando tutti i dati DB saranno migrati a 'funnel_pages'.` Questa operazione rende il compat layer tracciato e intentional, senza rimuoverlo. | | |
| TASK-D-002 | In `src/lib/runtime/tool-prompts/index.ts` riga 25 e in `src/lib/machines/generation-system.machine.ts` riga 427: valutare se il caso `funnelpages` (senza separatore) abbia evidenza in dati reali. Se non ha evidenza, rimuovere solo `'funnelpages'` dalla condizione (mantenere `'hl_funnel'` e `'funnel_pages'`). Questo riduce la superficie di normalizzazione silenziosa senza rompere retrocompatibilità con dati reali. | | |
| TASK-D-003 | **Opzionale — Rinomina directory prompt**: Se si decide di rinominare `src/lib/runtime/tool-prompts/hl_funnel/` in `src/lib/runtime/tool-prompts/funnel-pages/`, eseguire: (1) `mv src/lib/runtime/tool-prompts/hl_funnel src/lib/runtime/tool-prompts/funnel-pages`; (2) aggiornare `src/lib/runtime/tool-prompts/index.ts` righe 6-8 con i nuovi path; (3) aggiornare `src/lib/tests/runtime.tool-prompts.test.ts` riga 16 con il nuovo path atteso. La rinomina è sicura perché il mapping avviene in `index.ts` e non è esposto direttamente al FE. **Non eseguire se non strettamente necessario in questa iterazione.** | | |
| TASK-D-004 | Eseguire `npm run test` per la suite BE. Verificare che il test `runtime.tool-prompts.test.ts` passi correttamente. | | |

**Gate D**: commenti `@deprecated-compat` presenti nei due file di normalizzazione; se TASK-D-003 eseguito, `rg -rn "hl_funnel" src/lib/runtime/tool-prompts/` → zero risultati nei file `.ts` (i file `.md` dentro la cartella rinominata non sono modificati); test BE verdi.

---

### Implementation Phase E — Cleanup alias backward-compat (removal target 2026-Q3)

- GOAL-E: Rimuovere gli alias backward-compat nei file BE che hanno superato il ciclo di
  deprecazione (DDD-015, DDD-016, DDD-017). **Questa fase non deve essere eseguita prima
  di aver verificato che nessun consumer esterno al workspace usi gli alias.**

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-E-001 | **Pre-requisito**: eseguire `rg -rn "ToolRegistryVersion\|ToolRegistrySnapshotRef\|StreamUsageMetrics\|PersistedArtifactStatus" src frontend/src --glob '!**/*.md'` per censire tutti i consumer attivi degli alias. Registrare l'output. Se esistono consumer oltre ai file shim già noti, bloccare la fase e aprire un issue di migrazione per quei consumer. | | |
| TASK-E-002 | In `src/lib/types/xstate.ts`: rimuovere le righe `export type ToolRegistryVersion = RegistryVersion;` (riga 10) e `export type ToolRegistrySnapshotRef = RegistrySnapshotRef;` (riga 11) **solo se** TASK-E-001 ha confermato zero consumer oltre al file stesso. | | |
| TASK-E-003 | In `src/lib/types/xstate.ts`: rimuovere la riga `export type StreamUsageMetrics = LlmUsageMetrics;` (riga 97) **solo se** TASK-E-001 ha confermato zero consumer di `StreamUsageMetrics`. | | |
| TASK-E-004 | In `src/lib/adapters/generation.adapters.ts`: rimuovere la riga `export type PersistedArtifactStatus = ArtifactStatus;` (riga 40) e rimuovere il re-export `type PersistedArtifactStatus` da `src/lib/adapters/index.ts` (riga 10) **solo se** TASK-E-001 ha confermato zero consumer. Verificare che `src/lib/adapters/postgres-redis.stub.ts` non importi più `PersistedArtifactStatus`. | | |
| TASK-E-005 | In `frontend/src/features/tools/runtime/tool-form-architecture.ts`: rimuovere la riga `export type BriefingContext = ExtractionContext;` (riga 54) **solo se** TASK-E-001 ha confermato zero consumer di `BriefingContext` nel FE. | | |
| TASK-E-006 | Eseguire `npm run typecheck` e `npm --prefix frontend run typecheck`. Assenza di errori di compilazione conferma rimozione sicura. Eseguire la suite test completa. | | |

**Gate E**: typecheck pulito; `rg -rn "ToolRegistryVersion\|ToolRegistrySnapshotRef\|StreamUsageMetrics\|PersistedArtifactStatus\|BriefingContext" src frontend/src --glob '!**/*.md'` → zero risultati (o solo nei file di test che usano i tipi direttamente).

---

## 3. Alternatives

- **ALT-001**: Mantenere `meta_ads` come valore nell'enum e limitare la rimozione ai test.
  Scartato: l'enum `TOOL_WORKFLOWS` è usato come type guard (`isToolWorkflow`); mantenere un
  valore dead nell'enum propaga il termine deprecato nelle route API e nella validazione.
- **ALT-002**: Rinominare immediatamente la directory `hl_funnel` in Fase D.
  Valutato rischioso in isolamento: il mapping path impatta i test BE e richiede un commit
  coordinato con TASK-D-002. Inserito come opzionale con prerequisiti espliciti.
- **ALT-003**: Blocco B — fallback silenzioso a `getStepDependencies` se `orchestrateToolStep`
  fallisce. Scartato: un fallback silenzioso nasconde errori di connettività e viola il
  principio di single authority sulla dependency resolution. Un errore esplicito blocca la
  generazione e forza il debug.
- **ALT-004**: Fase C — mantenere lo split `primary`/`secondary` in `buildRelaunchRequest`
  ma deprecarlo. Valutato superfluo: il metodo ha un solo call site runtime
  (`GenerationWorkspaceProvider`); rimozione diretta è più pulita del ciclo di deprecazione.
- **ALT-005**: Eseguire tutti i blocchi in un unico PR. Scartato: la dimensione e le aree
  di rischio distinte rendono la separazione necessaria per review e rollback indipendente.

---

## 4. Dependencies

- **DEP-001**: DDD-030 (decision log): `meta_ads` dichiarato deprecato e da rimuovere.
  Autorizza TASK-A-001.
- **DEP-002**: DDD-C-007 (open conflict): `getStepDependencies` FE vs BE endpoint.
  Fase B lo chiude; Fase B è eseguibile solo se `/api/tools/orchestrate` è raggiungibile
  in ambiente di test (endpoint già presente in `src/lib/runtime/auth-http.ts`).
- **DEP-003**: DDD-020 (ArtifactRelaunch): singolo concetto di riavvio. Autorizza Fase C.
- **DEP-004**: DDD-016, DDD-017, DDD-015 (removal target 2026-Q3): autorizzano Fase E, ma
  solo a partire da Q3 2026 o quando i consumer sono confermati zero.
- **DEP-005**: Suite test frontend baseline. Deve essere stabile prima di avviare le fasi.
  Verificare con `npm --prefix frontend run test` pre-plan.

---

## 5. Files

- **FILE-001**: `src/lib/types/artifact.ts` — rimozione `meta_ads` da `TOOL_WORKFLOWS` (Fase A)
- **FILE-002**: `frontend/src/features/generation/ui/GenerationForm.tsx` — default state toolKey/workflowType (Fase A)
- **FILE-003**: `frontend/src/features/generation/ui/artifact-history.test.ts` — fixture meta_ads (Fase A), firma buildRelaunchRequest (Fase C)
- **FILE-004**: `frontend/src/features/generation/ui/tool-checkpoints.test.ts` — fixture meta_ads (Fase A)
- **FILE-005**: `frontend/src/features/generation/ui/GenerationForm.test.tsx` — fixture meta_ads (Fase A)
- **FILE-006**: `frontend/src/features/tools/ui/ToolPageTemplate.tsx` — call site getStepDependencies → orchestrateToolStep (Fase B)
- **FILE-007**: `frontend/src/features/tools/runtime/tool-generation-engine.ts` — deprecazione getStepDependencies (Fase B)
- **FILE-008**: `frontend/src/features/tools/runtime/tools-client.ts` — nessuna modifica funzionale; test extension (Fase B)
- **FILE-009**: `frontend/src/features/generation/ui/artifact-history.ts` — rimozione mode primary/secondary da buildRelaunchRequest (Fase C)
- **FILE-010**: `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` — firma relaunch (Fase C)
- **FILE-011**: `frontend/src/app/copy/system.ts` — rimozione chiave relaunchSecondary (Fase C)
- **FILE-012**: `src/lib/runtime/tool-prompts/index.ts` — commento compat layer + opzionale rinomina path (Fase D)
- **FILE-013**: `src/lib/machines/generation-system.machine.ts` — commento compat layer normalizeToolWorkflowKey (Fase D)
- **FILE-014**: `src/lib/tests/runtime.tool-prompts.test.ts` — aggiornamento path atteso se TASK-D-003 eseguito (Fase D)
- **FILE-015**: `src/lib/types/xstate.ts` — rimozione alias ToolRegistryVersion, ToolRegistrySnapshotRef, StreamUsageMetrics (Fase E)
- **FILE-016**: `src/lib/adapters/generation.adapters.ts` — rimozione alias PersistedArtifactStatus (Fase E)
- **FILE-017**: `src/lib/adapters/index.ts` — rimozione re-export PersistedArtifactStatus (Fase E)
- **FILE-018**: `frontend/src/features/tools/runtime/tool-form-architecture.ts` — rimozione alias BriefingContext (Fase E)

---

## 6. Testing

- **TEST-001**: Fase A — Verificare con `rg -n "meta_ads" src frontend/src --glob '!**/*.md'`
  → zero risultati post-cleanup.
- **TEST-002**: Fase A — `npm --prefix frontend run test` baseline stabile; nessun nuovo fail.
- **TEST-003**: Fase B — Aggiungere test `orchestrateToolStep` in `tools-client.test.ts`:
  mock BE response `{ ok: true, data: { orchestration: { toolKey: 'funnel-pages', targetStep: 'optin', stepDependencyArtifactIds: [], dependencyArtifactIdsByStep: {} } } }`;
  verificare che la funzione ritorni l'oggetto `OrchestrationResult` correttamente.
- **TEST-004**: Fase B — Aggiungere/aggiornare test in `ToolPageTemplate.test.tsx` per
  verificare che il call handler di generazione chiami `orchestrateToolStep` e non
  `getStepDependencies` prima di dispatch.
- **TEST-005**: Fase B — Verifica statistica: `rg -n "getStepDependencies(" frontend/src/features/tools/ui/ToolPageTemplate.tsx` → zero risultati.
- **TEST-006**: Fase C — `rg -n "relaunchSecondary" frontend/src` → zero risultati.
- **TEST-007**: Fase C — `rg -n "'primary'\|'secondary'" frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` → zero risultati.
- **TEST-008**: Fase D — `npm run test` suite BE include `runtime.tool-prompts.test.ts` verde.
- **TEST-009**: Fase E — `npm run typecheck` e `npm --prefix frontend run typecheck` → zero errori nuovi.

---

## 7. Risks & Assumptions

- **RISK-001**: Fase B — `orchestrateToolStep` invoca il backend via fetch; se il backend
  non è raggiungibile durante i test FE (mock MSW non configurato), la chiamata fallisce.
  Mitigazione: assicurarsi che `frontend/src/test/mocks/stream-handlers.ts` includa un
  handler per `POST /api/tools/orchestrate` prima di eseguire i test di integrazione.
- **RISK-002**: Fase A — Il fixture "unsupported" in `artifact-history.test.ts` testa che
  `buildToolEntryPathFromArtifact` ritorni `null` per un ToolKey non riconosciuto. La
  sostituzione da `meta_ads` a `'extraction'` mantiene la semantica del test (extraction
  non ha una tool route FE), ma deve essere verificata sulla logica di
  `resolveToolRouteFromArtifact` che non gestisce `extraction` come tool con route.
- **RISK-003**: Fase C — Il metodo `relaunch` in `GenerationWorkspaceContext` è esposto
  come API del provider; se consumer esterni (ad es. pagine admin) lo chiamano con
  `mode`, rimuovere il parametro introduce un type error. TASK-C-003 include la verifica
  con `rg` dei call site; se trovati, aggiornare prima i call site.
- **RISK-004**: Fase E — Gli alias `PersistedArtifactStatus` / `StreamUsageMetrics` possono
  essere importati da consumer nel layer di integrazione PostgreSQL/Redis che non sono
  coperti dai test unitari FE. Eseguire `rg` su tutto il workspace (incluso `db/`) prima
  della rimozione.
- **ASSUMPTION-001**: Il backend endpoint `/api/tools/orchestrate` è già deployato e
  risponde correttamente all'input `{ projectId, toolKey, targetStep }` come attestato
  da `src/lib/runtime/auth-http.ts` riga 1125.
- **ASSUMPTION-002**: Nessun dato persistito in DB usa `meta_ads` come valore attivo di
  `toolKey` o `workflowType` per artifacts in stato `generating`. Se esiste, la rimozione
  dall'enum non impatta la persistenza (il DB non fa validazione sul valore del campo), ma
  l'ORM/adapter potrebbe rifiutare la deserialization. Verificare con query se necessario.
- **ASSUMPTION-003**: La suite test FE corrente ha 3 test pre-esistenti in stato fail
  (attestato da DDD-024). Questi non sono introdotti da questo piano e non rappresentano
  una regressione.

---

## 8. Related Specifications / Further Reading

- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md) — DDD-020, DDD-028, DDD-030, DDD-031, DDD-C-007
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md) — termini: ToolWorkflow, ArtifactRelaunch, ToolStepOrchestration, GenerationRequestAssembly
- [docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md) — Integration Constraints: ExtractionContext completeness, ToolStepOrchestration target pattern
- [plan/refactor-frontend-backend-dead-code-drift-1.md](refactor-frontend-backend-dead-code-drift-1.md) — piano correlato su dead code e drift strutturale
