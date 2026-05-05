---
goal: Refactor frontend async state to XState v5 machines
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Frontend
status: 'Completed'
tags: [refactor, xstate, frontend, state-machines, architecture]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Il frontend gestisce attualmente diversi flussi asincroni tramite hook React (`useState` + `useEffect`) senza modello di stato esplicito. Questo causa: stati impliciti non mutuamente esclusivi, transizioni non verificabili, nessuna gestione canonica degli errori e difficoltà nei test unitari.

Il piano converte quattro aree prioritarie in macchine XState v5 idiomatiche usando `setup().createMachine()`, `fromPromise`, `fromCallback` e composizione actor. Il modello esistente `frontendStreamMachine` e `toolFlowMachine` restano invariati — questo refactor li orchestra e li integra con i flussi mancanti.

Target architetturale post-refactor:

```
authSessionMachine                       (standalone, sostituisce AuthSessionProvider useState)
     │
GenerationWorkspaceProvider              (consolida useState locali nel context di frontendStreamMachine)
     │
toolPageMachine  (per ogni tool page)
     ├─ child actor: briefingUploadMachine
     └─ invoke:      toolFlowMachine      (già esistente)
```

## 1. Requirements & Constraints

- **REQ-001**: Ogni macchina deve usare `setup().createMachine()` con tipi `context`, `events`, `input` espliciti.
- **REQ-002**: Nessun `interpret()` o pattern legacy XState v4. Usare `createActor()` o `useMachine()` da `@xstate/react`.
- **REQ-003**: Nessun side effect dentro `assign`. Le chiamate async vivono esclusivamente in `fromPromise` o `fromCallback`.
- **REQ-004**: Ogni macchina deve avere file di test separato (`*.machine.test.ts`) che copre: transizioni principali, path di errore, guard e reset.
- **REQ-005**: Il refactor non deve modificare contratti API (`auth-client.ts`, `tools-client.ts`, `generation-client.ts`).
- **REQ-006**: Il refactor non deve cambiare routing, layout o struttura componenti UI.
- **REQ-007**: `frontendStreamMachine` esistente non deve essere modificato nelle Phase 1–3 (solo integrato). `toolFlowMachine` richiede una modifica minima in Phase 2 (vedere TASK-011a) per dichiarare lo stato `done` come `type: 'final'`, prerequisito tecnico per l'`invoke.onDone` XState v5.
- **REQ-008**: Esistono due versioni distinte di `tool-ux-state.ts` con firme diverse: `features/tools/runtime/tool-ux-state.ts` (usata da `ToolPageTemplate`) e `features/generation/ui/tool-ux-state.ts` (usata da `GenerationConsolePage`). Questo piano riguarda esclusivamente la prima. La seconda e `GenerationConsolePage` sono fuori scope.
- **CON-001**: Non introdurre dipendenze npm aggiuntive. `xstate` e `@xstate/react` sono già presenti.
- **CON-002**: Mantenere retrocompatibilità delle API pubbliche degli hook (`useBriefingUpload`, `useProjectsLoader`, `useAuthSession`) durante la transizione — i componenti UI non devono richiedere modifiche.
- **CON-003**: Non spostare `briefingUploadMachine` fuori da `features/tools/` — è specifica del dominio tool.
- **GUD-001**: Usare `fromPromise` per async request/response. Usare `fromCallback` per stream/subscription con `sendBack`.
- **GUD-002**: Usare `invoke` per child actor con ciclo di vita legato allo stato. Usare `spawnChild` per actor con ciclo di vita indipendente.
- **GUD-003**: La sequenza upload→extraction di `briefingUploadMachine` deve essere modellata come due stati distinti con `invoke` separati, non un unico try/catch.
- **PAT-001**: Context derivato (es. `canonicalState` in `tool-ux-state.ts`) deve essere calcolato fuori dalla macchina tramite `useSelector` o helper puri, non come stato della macchina.
- **PAT-002**: I provider React che wrappano macchine devono esporre `snapshot` e `send` tramite context, non re-implementare logica.

## 2. Implementation Steps

### Phase 1 — briefingUploadMachine

- **GOAL-001**: Sostituire il flusso asincrono upload→extraction in `useBriefingUpload` con una macchina XState v5 esplicita che rende osservabili tutti gli stati intermedi e gestisce reset/errore in modo deterministico.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Creare `frontend/src/features/tools/machines/briefing-upload.machine.ts`. Definire `BriefingUploadContext` con campi: `projectId: string`, `toolKey: SupportedTool`, `file: File \| null`, `fileName: string \| null`, `briefingId: string \| null`, `extractionArtifactId: string \| null`, `extractionPayload: Record<string, unknown> \| null`, `normalizedText: string \| null`, `parsedFormat: 'txt' \| 'md' \| 'docx' \| null`, `error: string \| null`. | Yes | 2026-05-02 |
| TASK-002 | Definire eventi macchina: `FILE_SELECTED: { file: File }`, `RESET: {}`. Gli eventi interni `xstate.done.actor.*` e `xstate.error.actor.*` sono gestiti via `onDone`/`onError` negli `invoke`. | Yes | 2026-05-02 |
| TASK-003 | Definire stati: `idle` → (FILE_SELECTED) → `validating` → `uploading` → `extracting` → `ready`. Ogni stato di errore ha transizione `RESET` → `idle`. Lo stato `validating` usa transizioni `always` con questa struttura esatta (ordine vincolante): `always: [{ guard: 'isValidExtension', target: 'uploading' }, { target: 'idle', actions: assign({ error: 'Formato non supportato. Usa .docx, .txt o .md', file: null }) }]`. Il secondo ramo (senza guard) è obbligatorio: in XState v5 una guardia `false` su `always` senza ramo fallback blocca la macchina nello stato `validating` indefinitamente. `isValidExtension` chiama `isAllowedBriefingExtension(context.file.name)` da `tool-form-architecture.ts`. | Yes | 2026-05-02 |
| TASK-004 | Stato `uploading`: `invoke` su `fromPromise` che chiama `uploadBrief(...)`. `onDone`: assegna `briefingId`, `fileName`, `normalizedText`, `parsedFormat` dal output; transita a `extracting`. `onError`: assegna `error`; transita a `idle`. | Yes | 2026-05-02 |
| TASK-005 | Stato `extracting`: `invoke` su `fromPromise` che chiama `runExtraction(...)` usando `context.briefingId` come input. `onDone`: assegna `extractionArtifactId`, `extractionPayload`; transita a `ready`. `onError`: assegna `error`; transita a `idle`. | Yes | 2026-05-02 |
| TASK-006 | Aggiornare `useBriefingUpload` in `useToolForm.ts` per usare `useMachine(briefingUploadMachine, { input: { toolKey, projectId, apiBaseUrl, capabilities, userId } })` invece di useState/useEffect. I campi `apiBaseUrl`, `capabilities`, `userId` sono estratti dall'hook `useAuthSession()` prima di passarli come input alla macchina — NON passare l'oggetto `auth` intero. Mantenere la stessa firma di ritorno (`{ file, fileName, error, status, extractionContext, handleFileSelected }`). | Yes | 2026-05-02 |
| TASK-007 | Creare `frontend/src/features/tools/machines/briefing-upload.machine.test.ts`. Testare: transizione `idle → uploading → extracting → ready`, path errore upload (`idle → idle` con error), path errore extraction, guard `isValidExtension` rifiuta estensioni non supportate, reset da `ready → idle`. | Yes | 2026-05-02 |

**Criteri completamento Phase 1:**
- `briefingUploadMachine` esporta la macchina con tipi completi. ✅ 2026-05-02
- `useBriefingUpload` usa la macchina internamente senza useState asincrono. ✅ 2026-05-02
- 9 test passano in `briefing-upload.machine.test.ts` (inclusi sync input dinamico e recovery da artifact persistito). ✅ 2026-05-02
- `npx tsc --noEmit` senza errori su file modificati. ✅ 2026-05-02

---

### Phase 2 — toolPageMachine (orchestratore)

- **GOAL-002**: Introdurre `toolPageMachine` come macchina orchestratrice per le tool page che coordina `briefingUploadMachine` (child actor) e `toolFlowMachine` (invoke), eliminando la dispersione di hook separati e la derivazione manuale in `tool-ux-state.ts`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Creare `frontend/src/features/tools/machines/tool-page.machine.ts`. Definire `ToolPageContext`: `toolKey: SupportedTool`, `projectId: string`, `model: string`, `registrySnapshotRef: string`, `briefingActorRef: ActorRefFrom<briefingUploadMachine> \| null`, `stepArtifactIds: Partial<Record<ToolStep, string>>`, `generationError: string \| null`. | Yes | 2026-05-02 |
| TASK-009 | Definire eventi macchina: `PROJECT_SELECTED: { projectId: string }`, `MODEL_CHANGED: { model: string }`, `STEP_ARTIFACT_UPDATED: { step: ToolStep; artifactId: string }`, `START_GENERATION: {}`, `CANCEL_GENERATION: {}`, `RESET: {}`. Delegare eventi briefing direttamente all'actorRef. | Yes | 2026-05-02 |
| TASK-010 | Definire stati principali: `configuring` (form editabile, briefing actor attivo) → `generating` (toolFlowMachine invocato) → `completed` (tutti gli step done) → (RESET) → `configuring`. Stato parallelo opzionale: `configuring.briefing` gestisce internamente gli stati di `briefingUploadMachine`. | Yes | 2026-05-02 |
| TASK-011a | **Prerequisito — modifica minima a `tool-flow.machine.ts`**: aggiungere `type: 'final'` allo stato `done` esistente. Senza questa modifica, `invoke.onDone` di `toolPageMachine` non si triggerà mai in XState v5 (le macchine invocate emettono `onDone` solo al raggiungimento di uno stato `final`). Questa è l'unica modifica consentita a `toolFlowMachine` in questo piano. | Yes | 2026-05-02 |
| TASK-011b | In `configuring`: usare come entry action `assign({ briefingActorRef: ({ spawn, context }) => spawn(briefingUploadMachine, { id: 'briefingActor', input: { toolKey: context.toolKey, projectId: context.projectId, apiBaseUrl: context.apiBaseUrl, capabilities: context.capabilities, userId: context.userId } }) })`. NON usare `spawnChild(...)` direttamente in `entry`: in XState v5, `spawnChild` è un action creator che funziona solo dentro l'array `actions` di una transizione, non come valore standalone di `entry`. L'unico pattern supportato per spawnare durante entry è `assign` con `({ spawn })`. In `generating`: `invoke: { id: 'toolFlowActor', src: 'toolFlowMachine', input: ({ context }) => ({ tool: context.toolKey, maxRetries: 3 }), onDone: { target: 'completed' } }`. Aggiungere entry action `sendTo('toolFlowActor', { type: 'START' })` nello stato `generating` per avviare il flow dopo l'invoke. | Yes | 2026-05-02 |
| TASK-012 | Guard `canStartGeneration`: `context.projectId.trim().length > 0` AND il snapshot corrente dell'actorRef briefing è nello stato `ready`. In XState v5, leggere lo snapshot dell'actorRef dentro una guard richiede `context.briefingActorRef?.getSnapshot().matches('ready') ?? false`. | Yes | 2026-05-02 |
| TASK-013 | Creare hook `useToolPage(toolKey: SupportedTool, prefillProjectId?: string)` in `frontend/src/features/tools/runtime/useToolPage.ts`. Usa `useMachine(toolPageMachine, { input: { toolKey, ... } })`. Espone: `snapshot`, `send`, `briefingSnapshot` (via `useSelector(snapshot.context.briefingActorRef, s => s)` — in `@xstate/react` v6 `useSelector` accetta direttamente un `ActorRefFrom<...>`). | Yes | 2026-05-02 |
| TASK-014 | Creare `frontend/src/features/tools/machines/tool-page.machine.test.ts`. Testare: guard `canStartGeneration` (false quando briefing idle, true quando briefing ready), transizione `configuring → generating → completed`, transizione `RESET` da `completed → configuring`, propagazione `CANCEL_GENERATION`. | Yes | 2026-05-02 |

**Criteri completamento Phase 2:**
- `toolPageMachine` esporta la macchina e i tipi snapshot. ✅ 2026-05-02
- `useToolPage` hook funzionante con firma stabile. ✅ 2026-05-02
- `tool-flow.machine.ts`: stato `done` dichiara `type: 'final'`; test esistenti in `tool-flow.machine.test.ts` continuano a passare. ✅ 2026-05-02
- Verifica esplicita: `briefingActorRef` nel context di `toolPageMachine` è di tipo `ActorRefFrom<typeof briefingUploadMachine>` non `null` dopo il boot di `configuring` (spawn avvenuto tramite `assign`). ✅ 2026-05-02
- Verifica esplicita: l'evento `START` raggiunge il `toolFlowActor` invocato tramite `sendTo` — la macchina transita a `running` e non resta in `idle`. ✅ 2026-05-02
- `features/tools/runtime/tool-ux-state.ts` mantiene `deriveCanonicalToolUiState` invariata; il file `features/generation/ui/tool-ux-state.ts` non viene toccato. ✅ 2026-05-02
- 4 test passano in `tool-page.machine.test.ts`. ✅ 2026-05-02
- `npx tsc --noEmit` senza errori. ✅ 2026-05-02

---

### Phase 3 — authSessionMachine

- **GOAL-003**: Sostituire i tre `useState` + `useEffect` in `AuthSessionProvider.tsx` con `authSessionMachine`, rendendo gli stati di autenticazione mutuamente esclusivi, auditabili e testabili.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Creare `frontend/src/app/machines/auth-session.machine.ts`. Definire `AuthSessionContext`: `session: AuthSession \| null`, `error: string \| null`, `apiBaseUrl: string`. Input: `{ apiBaseUrl: string }`. | ✅ | 2026-05-02 |
| TASK-016 | Definire eventi: `LOGIN: { email: string; password: string }`, `LOGOUT: {}`, `REFRESH: {}`, `SESSION_INVALIDATED: {}`. | ✅ | 2026-05-02 |
| TASK-017 | Definire stati: `bootstrapping` (invoke `readSession`) → `authenticated` \| `unauthenticated`. Da `authenticated`: `LOGOUT` → (invoke `logoutSession`) → `unauthenticated`. Da `unauthenticated`: `LOGIN` → `authenticating` (invoke `loginWithPassword`) → `authenticated` \| `unauthenticated` (con error). Stato `error` transitorio (5s) → `unauthenticated`. | ✅ | 2026-05-02 |
| TASK-018 | Aggiornare `AuthSessionProvider.tsx`: sostituire `useState`/`useEffect` con `useMachine(authSessionMachine, { input: { apiBaseUrl } })`. Il context esposto deve mantenere la stessa interfaccia `AuthSessionContextValue` (retrocompatibilità CON-002). Derivare `loading` da `snapshot.matches('bootstrapping') \| snapshot.matches('authenticating')`. | ✅ | 2026-05-02 |
| TASK-019 | Creare `frontend/src/app/machines/auth-session.machine.test.ts`. Testare: bootstrap success → `authenticated`, bootstrap 401 → `unauthenticated`, login success, login failure (error nel context), logout, refresh da `authenticated`. | ✅ | 2026-05-02 |

**Criteri completamento Phase 3:**
- `authSessionMachine` esporta macchina e tipi.
- `AuthSessionProvider` non contiene più `useState` per session/loading/error.
- Tutti i test esistenti in `app-router.test.tsx` e `AdminUsersPage.test.tsx` continuano a passare (retrocompatibilità context).
- 6 test passano in `auth-session.machine.test.ts`.
- `npx tsc --noEmit` senza errori.

---

### Phase 4 — GenerationWorkspaceProvider consolidamento

- **GOAL-004**: Spostare `checkpoints` e `extractionByProject` dal `useState` locale di `GenerationWorkspaceProvider` nel context di `frontendStreamMachine`, eliminando la deriva tra stato macchina e stato React locale.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Aggiungere a `FrontendStreamContext` in `frontend-stream.machine.ts`: `checkpoints: ToolCheckpoint[]`, `extractionByProject: Record<string, ToolExtractionContext>`. Aggiornare `FrontendStreamInput` se necessario. | ✅ | 2026-05-02 |
| TASK-021 | Aggiungere azione `upsertCheckpoint` (assign su `checkpoints`) e azione `upsertExtraction` (assign su `extractionByProject`). Entrambe triggered da eventi: `CHECKPOINT_UPSERTED: { checkpoint: ToolCheckpoint }`, `EXTRACTION_UPSERTED: { context: ToolExtractionContext }`. | ✅ | 2026-05-02 |
| TASK-022 | Aggiornare `GenerationWorkspaceProvider.tsx`: rimuovere `useState` per `checkpoints` e `extractionByProject`. Sostituire con `useSelector(actor, s => s.context.checkpoints)` e `useSelector(actor, s => s.context.extractionByProject)`. Aggiornare `upsertExtractionContext` e `getExtractionContext` per mandare eventi alla macchina anziché `setExtractionByProject`. | ✅ | 2026-05-02 |
| TASK-023 | Aggiornare `useEffect` in `GenerationWorkspaceProvider` che aggiorna checkpoints: sostituire `setCheckpoints` con `send({ type: 'CHECKPOINT_UPSERTED', checkpoint: ... })`. | ✅ | 2026-05-02 |
| TASK-024 | Aggiornare `frontend-stream.machine.test.ts`: aggiungere test per `CHECKPOINT_UPSERTED` e `EXTRACTION_UPSERTED`, verificare che il context contenga i dati corretti dopo gli eventi. | ✅ | 2026-05-02 |

**Criteri completamento Phase 4:**
- `GenerationWorkspaceProvider` non ha più `useState` per checkpoints/extraction.
- `persistedArtifacts` e `artifacts` possono restare come `useState` (gestiti da reload separato, fuori scope).
- Test esistenti `frontend-stream.machine.test.ts` passano senza regressioni.
- 2 nuovi test per gli eventi aggiunti.
- `npx tsc --noEmit` senza errori.

---

## 3. Alternatives

- **ALT-001**: Usare Zustand o Jotai invece di XState per la gestione dello stato asincrono. Scartato: l'architettura esistente ha già `toolFlowMachine` e `frontendStreamMachine` in XState v5; aggiungere un secondo sistema di stato creerebbe eterogeneità e duplicazione di pattern.
- **ALT-002**: Unificare tutte le macchine in un'unica macchina root globale. Scartato: accoppiamento eccessivo tra domini (auth, briefing, generazione). La composizione tramite actor preserva l'isolamento.
- **ALT-003**: Mantenere `deriveCanonicalToolUiState` eliminando la conversione a macchina. Parzialmente adottato: `tool-ux-state.ts` resta invariato (PAT-001). La macchina garantisce la coerenza degli input, ma la funzione di derivazione rimane come helper puro chiamato da `useSelector`.
- **ALT-005**: Usare `fromCallback` + subscribe per rilevare il completamento di `toolFlowMachine` invece di modificarlo con `type: 'final'`. Scartato: più complesso e meno idiomatico. La modifica a `toolFlowMachine` è minimale e non rompe nessun test esistente.
- **ALT-004**: Per Phase 4, usare `useRef` invece di context nella macchina per checkpoints. Scartato: i ref non sono reattivi e non partecipano al ciclo di re-render necessario per aggiornare la UI.

## 4. Dependencies

- **DEP-001**: `xstate` >= 5.x — già presente in `frontend/package.json`.
- **DEP-002**: `@xstate/react` ^6.1.x — già presente in `frontend/package.json`. API `useMachine`, `useSelector`, `useActorRef` stabili in v6.
- **DEP-003**: `uploadBrief` e `runExtraction` da `frontend/src/features/tools/runtime/tools-client.ts` — API invariate.
- **DEP-004**: `readSession`, `loginWithPassword`, `logoutSession` da `frontend/src/features/auth/runtime/auth-client.ts` — API invariate.
- **DEP-005**: `isAllowedBriefingExtension` da `frontend/src/features/tools/runtime/tool-form-architecture.ts` — riusata come guardia in Phase 1.
- **DEP-006**: `toolFlowMachine` da `frontend/src/features/tools/machines/tool-flow.machine.ts` — invocata in Phase 2, non modificata.
- **DEP-007**: `frontendStreamMachine` da `frontend/src/features/generation/machines/frontend-stream.machine.ts` — estesa in Phase 4.

## 5. Files

**Nuovi file (creati in questo refactor):**
- **FILE-001**: `frontend/src/features/tools/machines/briefing-upload.machine.ts` — Phase 1
- **FILE-002**: `frontend/src/features/tools/machines/briefing-upload.machine.test.ts` — Phase 1
- **FILE-003**: `frontend/src/features/tools/machines/tool-page.machine.ts` — Phase 2
- **FILE-004**: `frontend/src/features/tools/machines/tool-page.machine.test.ts` — Phase 2
- **FILE-005**: `frontend/src/features/tools/runtime/useToolPage.ts` — Phase 2
- **FILE-006**: `frontend/src/app/machines/auth-session.machine.ts` — Phase 3
- **FILE-007**: `frontend/src/app/machines/auth-session.machine.test.ts` — Phase 3

**File modificati:**
- **FILE-008**: `frontend/src/features/tools/runtime/useToolForm.ts` — Phase 1 (useBriefingUpload → useMachine)
- **FILE-009**: `frontend/src/app/providers/AuthSessionProvider.tsx` — Phase 3 (useState → useMachine)
- **FILE-010**: `frontend/src/features/generation/machines/frontend-stream.machine.ts` — Phase 4 (aggiunta context checkpoints/extraction)
- **FILE-011**: `frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx` — Phase 4 (rimozione useState locali)

**File con modifica minima (Phase 2 prerequisito):**
- **FILE-012**: `frontend/src/features/tools/machines/tool-flow.machine.ts` — aggiunta unica: `type: 'final'` allo stato `done`

**File invariati (solo integrati):**
- **FILE-013**: `frontend/src/features/tools/runtime/tool-ux-state.ts` — non modificato (input derivano da snapshot)
- **FILE-014**: `frontend/src/features/tools/runtime/tool-form-architecture.ts` — non modificato
- **FILE-015**: `frontend/src/features/generation/ui/tool-ux-state.ts` — non modificato (versione separata usata da `GenerationConsolePage`, fuori scope)
- **FILE-016**: `frontend/src/features/generation/pages/GenerationConsolePage.tsx` — fuori scope (usa versione separata di `tool-ux-state.ts` e pattern useState indipendente)

## 6. Testing

- **TEST-001**: `briefing-upload.machine.test.ts` — 9 test: happy path, errore upload, errore extraction, guard estensione, reset, guard progetto selezionato, guard sessione, sync input dinamico, recovery extraction da artifact persistito.
- **TEST-002**: `tool-page.machine.test.ts` — 4 test: guard canStartGeneration, ciclo completo configuring→generating→completed, reset, cancel.
- **TEST-003**: `auth-session.machine.test.ts` — 6 test: bootstrap ok, bootstrap 401, login ok, login fail, logout, refresh.
- **TEST-004**: `frontend-stream.machine.test.ts` (aggiornato) — 2 nuovi test per CHECKPOINT_UPSERTED e EXTRACTION_UPSERTED.
- **TEST-005**: Smoke test manuale (eseguito): caricamento briefing, estrazione completata con artifact persistito in DB, avanzamento UI a stato pronto, generazione completata fino all'ultimo artifact. Esito: GO.
- **TEST-006**: Regressione: eseguire `npm run test` su `frontend/` dopo ogni phase; nessun test pre-esistente deve fallire.
- **TEST-007**: `useToolForm.test.tsx` — test hook-level sul path reale: stream extraction pendente + artifact extraction già persistito => transizione a `ready` e popolamento `extractionContext`.

## 7. Risks & Assumptions

- **RISK-001**: La firma pubblica degli hook (`useBriefingUpload`, `useAuthSession`) cambia internamente ma deve restare identica all'esterno per non rompere i componenti UI. Mitigazione: definire il tipo di ritorno atteso prima di modificare l'implementazione.
- **RISK-002**: `frontendStreamMachine` in Phase 4 aggiunge campi al context — se lo snapshot è persistito (es. `getPersistedSnapshot`), potrebbe divergere. Verificare che non ci sia persistenza snapshot in produzione prima di mergiare Phase 4.
- **RISK-003 (risolto)**: `toolFlowMachine` ha stato iniziale `idle` e attende evento `START` esplicito. L'`invoke.onDone` non si triggerà mai perché `done` non era `type: 'final'`. Risolto tramite TASK-011a (aggiunta `type: 'final'` allo stato `done`) e TASK-011b (l'evento `START` viene inviato automaticamente all'actor invocato via entry action `send({ type: 'START' })` all'ingresso dello stato `generating`).
- **RISK-005 (risolto in TASK-003)**: In XState v5, uno stato con solo `always: [{ guard: 'X', target: 'Y' }]` senza ramo fallback causa blocco silenzioso della macchina se la guardia è falsa — nessun errore a runtime, la macchina rimane bloccata nello stato `validating` per sempre. Risolto: TASK-003 specifica obbligatoriamente il secondo ramo `{ target: 'idle', actions: assign({ error: '...' }) }` come catch-all.
- **RISK-006 (risolto in TASK-011b)**: `spawnChild` in XState v5 è un action creator valido solo dentro l'array `actions` di una transizione o come stringa in `actions`. Usato come valore diretto di `entry: spawnChild(...)` genera un errore TypeScript (tipo incompatibile) e non produce l'actorRef nel context. Risolto: TASK-011b specifica `entry: assign({ briefingActorRef: ({ spawn }) => spawn(...) })` come unico pattern supportato per spawnare e assegnare in una entry action. Mitigazione verificata: i 10 file di test usano `vi.mock('...AuthSessionProvider', () => ({ useAuthSession: () => ({...}) }))` che sostituisce il modulo intero — sono insensibili all'implementazione interna finché `useAuthSession` è esportato dallo stesso path.
- **RISK-007 (risolto post-Phase 4)**: Input dinamico stale in `useMachine(..., { input })` per `projectId`/`userId`/capabilities dopo il mount della pagina tool. Risolto con evento esplicito `INPUT_SYNCED` verso `briefingUploadMachine` e sincronizzazione controllata nel hook `useBriefingUpload`.
- **RISK-008 (risolto post-Phase 4)**: Possibile stallo UI in stato `extracting` quando l'artifact extraction è già persistito ma lo stream non emette terminale osservabile dal client. Risolto con recovery path deterministico: polling artifact `type='extraction'` per progetto+briefing e evento `EXTRACTION_RECOVERED` che chiude la macchina in `ready`.
- **ASSUMPTION-001**: `xstate` ^5.30.x e `@xstate/react` ^6.1.x installati nel frontend sono compatibili con `setup().createMachine()`, `useMachine`, `useSelector` — confermato da `frontend/package.json`.
- **ASSUMPTION-002**: Non esiste persistenza di snapshot XState in produzione (localStorage, cookie, DB) per le macchine modificate.
- **ASSUMPTION-003**: Le tool page (`FunnelPagesToolPage`, `NextlandToolPage`) usano `useBriefingUpload` tramite l'hook esistente, non direttamente la macchina.

## 8. Related Specifications / Further Reading

- [docs/02-design/specifications/xstate-system-as-is-spec.md](../docs/02-design/specifications/xstate-system-as-is-spec.md)
- [docs/07-governance/review/tools-generation-go-closure-2026-04-25.md](../docs/07-governance/review/tools-generation-go-closure-2026-04-25.md)
- [frontend/src/features/tools/machines/tool-flow.machine.ts](../frontend/src/features/tools/machines/tool-flow.machine.ts)
- [frontend/src/features/generation/machines/frontend-stream.machine.ts](../frontend/src/features/generation/machines/frontend-stream.machine.ts)
- [XState v5 docs — fromPromise](https://stately.ai/docs/actors#frompromise)
- [XState v5 docs — invoke](https://stately.ai/docs/invoke)
- [XState v5 docs — spawnChild](https://stately.ai/docs/spawn)

## 9. Final Closure

- Chiusura definitiva del piano confermata in data 2026-05-02.
- Tutte le phase (1-4) completate e validate.
- Correzioni post-refactor concluse su ciclo completo estrazione→generazione:
     - sync input dinamico attore briefing (`INPUT_SYNCED`),
     - chiusura robusta stato `extracting` con recovery da artifact persistito (`EXTRACTION_RECOVERED`).
- Evidenza finale: smoke test end-to-end positivo fino al completamento dell'ultimo artifact (GO).
