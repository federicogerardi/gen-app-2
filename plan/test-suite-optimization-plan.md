---
status: completed
version: 1.2.0
last-reviewed: 2026-07-19
next-review-date: 2026-07-26
owner: Solo Developer
date_created: 2026-07-19
title: Test Suite Optimization Plan
type: implementation-plan
tags:
  - test-optimization
  - maintenance
  - developer-velocity
  - mvp
goal: Ridurre l'attrito di sviluppo eliminando test fragili, overengineered o a basso valore dalla suite BE/FE, mantenendo copertura sui path critici
---

# Test Suite Optimization Plan

**Source**: Analisi completa della suite test (132 file, ~31,000 righe)  
**Branch**: `chore/test-suite-optimization`  
**Durata stimata**: 4-6 ore  
**Rischio**: Basso (rimozione/consolidamento, nessuna logica di business toccata)  
**Contesto**: MVP 50 utenti, unico sviluppatore

---

## Overview

La suite test attuale ha assunto volume e tempi di esecuzione inefficaci per un MVP single-dev. Tre categorie di spreco identificate:

| Categoria | Impatto | Righe removibili |
|---|---|---|
| **Copy/UI test fragili** | Ogni modifica copy rompe 2-4 test; ~30 assertion hardcoded in italiano | ~30 assertion convertite |
| **Overengineering** | DB stub SQL-parsing, mock XState duplicati, guard cross-file via filesystem | ~930 righe |
| **AI Slop** | File template clone, test di funzioni pure, test di prop-passing, mock duplicati 24× | ~2,100 righe |

**Risultato atteso**: ~27,500 righe (-11%), 7 file eliminati, suite FE -15/25% tempo esecuzione.

---

## Phase 1 — Rimozioni Immediate (basso rischio, alto impatto)

### TASK 1.1: Eliminare guard tests cross-file (filesystem readers)

**File**: 
- `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.status-naming.guard.test.ts` (61 righe)
- `apps/frontend/src/features/tools/ui/ToolGenerationFlow.guard.test.ts` (78 righe)

**Problema**: Questi non sono test — sono regole di lint. Il primo legge 3 file da disco per grep di naming convention. Il secondo fa walk ricorsivo di tutto `src/` per verificare che nessuno importi un componente deprecato. Aggiungono I/O su disco a ogni run e accoppiano i test ai nomi dei file sorgente.

**Azione**: Eliminare entrambi i file. Sostituire `ToolGenerationFlow` con un commento `/** @deprecated */` nel componente — TypeScript segnalerà usi residui.

**Righe rimosse**: 139

**QA**:
- Strumento: `npm --workspace apps/frontend run test`
- Passi: (1) eliminare i 2 file, (2) eseguire suite frontend completa
- Risultato atteso: tutti i test passano, nessun errore di import

---

### TASK 1.2: Eliminare test triviali

**File da eliminare**:
- `apps/backend/src/lib/tests/runtime.tool-availability-policy.test.ts` (13 righe, 2 test)
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.test.tsx` (25 righe, test di prop-passing React)
- `apps/frontend/src/features/dashboard/pages/DashboardPage.test.tsx` righe 107-109 (test vuoto senza corpo)

**Problema**: 
- `tool-availability-policy.test.ts`: 2 assert che verificano `canPrincipalRoleAccessToolKey('', 'member') === false` e `canPrincipalRoleAccessToolKey('funnel-pages', 'admin') === true`. I contratti di disponibilità sono già testati nei file workflow-registry specifici.
- `SessionSummaryListPage.test.tsx`: testa esclusivamente che un componente passi una prop a un child (`toHaveBeenCalledWith`). TypeScript garantisce questo contratto.
- `DashboardPage.test.tsx`: test vuoto con corpo commentato.

**Azione**: Eliminare i 2 file completi, rimuovere il test vuoto da DashboardPage.

**Righe rimosse**: 41

**QA**:
- Strumento: `npm run test`
- Passi: (1) eliminare i file indicati, (2) eseguire suite completa BE + FE
- Risultato atteso: tutti i test rimanenti passano

---

### TASK 1.3: Convertire copy hardcoded italiano → `appCopy`

**File coinvolti** (8 file, ~30 assertion):

| File | Stringhe hardcoded | Da sostituire con |
|---|---|---|
| `AdminUsersPage.test.tsx` | `'Utente creato.'`, `'Disabilitato'`, `'Crea utente'`, `'Modifica'`, `'Salva'`, `'Disabilita'`, `'Apri admin'`, `/403/i` | `appCopy.ui.feedback.*`, `appCopy.ui.admin.*` |
| `AdminUserReportsPage.test.tsx` | `'Chiusa'`, `'Chiudi'`, `'Report triaged aggiornato.'`, `'Issue GitHub pubblicata.'`, `'Report closed aggiornato.'` | `appCopy.ui.feedback.*` |
| `AdminModelsPage.test.tsx` | `'Modello creato.'`, `'Salva'`, `'Elimina'` | `appCopy.ui.admin.*` |
| `AdminApiServicesPage.test.tsx` | `'Servizio API creato.'`, `'Salva'`, `'Elimina'` | `appCopy.ui.admin.*` |
| `AdminChangelogPage.test.tsx` | `'Pubblica'`, `'Changelog pubblicato.'` | `appCopy.ui.admin.*` |
| `ToolsHubPage.test.tsx` | `'Apri workspace'`, `'Tools Console'` | `appCopy.ui.navigation.*` |
| `DashboardPage.test.tsx` | `/12\/05\/2026/i` (date format) | Usare `toHaveTextContent` su `data-testid` |
| `UserReportSubmissionPage.test.tsx` | `'Invia report'`, `'Report inviato.'` | `appCopy.ui.feedback.*` |

**Azione**: 
1. Se i valori `appCopy` non esistono, aggiungerli al file `apps/frontend/src/app/copy/system.ts`
2. Sostituire ogni stringa hardcoded con il reference `appCopy` corrispondente
3. Per l'assertion sulla data in Dashboard, usare `data-testid` invece del formato testuale

**Righe rimosse/modificate**: ~30 assertion

**QA**:
- Strumento: `npm --workspace apps/frontend run test`
- Passi: (1) dopo ogni file modificato, eseguire `npm --workspace apps/frontend run test -- <filename>`, (2) al termine, eseguire suite completa
- Risultato atteso: stessi test passano, ma con reference `appCopy` invece di stringhe letterali. Verificare che modificando un valore in `appCopy` i test continuino a passare (sono accoppiati alla chiave, non al valore)

---

## Phase 2 — Consolida duplicazioni (medio impatto)

### TASK 2.1: Creare shared mock factory per AuthSessionProvider

**File coinvolti**: 24 file di test che duplicano lo stesso pattern ~25-35 righe ciascuno

**Pattern duplicato** (presente in tutti i 24 file):
```typescript
vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { role: 'member' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { ... },
  }),
  useAuthState: () => ({ session: {...}, loading: false, hasError: false }),
  useAuthActions: () => ({ login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), clearError: () => {} }),
  useApiConfig: () => ({ apiBaseUrl: '', capabilities: { ... } }),
  useOAuthUrl: () => ({ oauthStartUrl: '' }),
}));
```

**Azione**:
1. Creare `apps/frontend/src/test/mocks/auth-session-provider.mock.ts`:
   - Funzione `createMockAuthSessionProvider(overrides?: { role?, capabilities?, session? })` che restituisce l'oggetto mock completo
   - Default: ruolo `member`, capabilities vuote
2. In ogni file, sostituire il blocco `vi.mock` inline con:
   ```typescript
   import { createMockAuthSessionProvider } from '../../../test/mocks/auth-session-provider.mock';
   vi.mock('../../../app/providers/AuthSessionProvider', () => createMockAuthSessionProvider());
   ```
3. Dove servono override (es. admin), passare `createMockAuthSessionProvider({ role: 'admin' })`

**Righe nette**: -690 (24 file × -29 righe + 1 file × +30 righe)

**QA**:
- Strumento: `npm --workspace apps/frontend run test`
- Passi: (1) creare il mock factory, (2) migrare 2-3 file rappresentativi (admin + member + non-autenticato), (3) eseguire test specifici, (4) migrare i rimanenti 21 file, (5) eseguire suite completa
- Risultato atteso: tutti i test passano con zero regressioni. Verificare che `getByRole('heading', { name: appCopy.editorial.admin.usersTitle })` funzioni in un test admin e `screen.getByText(appCopy.editorial.sessions.emptyState)` in un test member

---

### TASK 2.2: Estrarre briefingUploadMachine mock in file condiviso

**File duplicati**:
- `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` (linee 5-136, 131 righe)
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` (linee 37-130, 93 righe)

**Problema**: Due copie quasi identiche del mock di `briefingUploadMachine` con XState `setup()` + `createMachine()` + `assign()` + guard `hasReadyBriefingExtractionContext`. Ogni modifica alla macchina reale richiede update in due file.

**Azione**:
1. Creare `apps/frontend/src/test/mocks/briefing-upload-machine.mock.ts`:
   - Esportare `createMockBriefingUploadMachine(config?: { initialState?, contextOverrides? })` che costruisce la macchina mock
   - Esportare `mockHasReadyBriefingExtractionContext` (la guard function)
2. In entrambi i file, sostituire il mock inline con `import { createMockBriefingUploadMachine, mockHasReadyBriefingExtractionContext } from ...`

**Righe nette**: 0 (spostamento, non rimozione). Beneficio: manutenibilità (1 punto di modifica invece di 2).

**QA**:
- Strumento: `npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine src/features/tools/ui/ToolPageTemplate`
- Passi: (1) creare il file condiviso, (2) aggiornare entrambi i file, (3) eseguire i test specifici
- Risultato atteso: tutti i test dei due file passano invariati

---

### TASK 2.3: Consolidare test tool-specifici in test parametrizzati

**File da consolidare** (6 file, ~352 righe totali):

| File | Righe | Pattern testato |
|---|---|---|
| `runtime.brief-generator-tool-prompts.test.ts` | 57 | resolveToolPrompt + extraction fields |
| `runtime.brief-generator-workflow-registry.test.ts` | 57 | buildCompletedArtifactsByStep + policy + deps |
| `runtime.tov-generator-tool-prompts.test.ts` | 57 | identico, cambia toolKey |
| `runtime.tov-generator-workflow-registry.test.ts` | 57 | identico |
| `runtime.blog-article-tool-prompts.test.ts` | 58 | identico |
| `runtime.blog-article-workflow-registry.test.ts` | 66 | identico, step multipli |

**Problema**: Ogni nuovo tool richiede ~120 righe di test boilerplate (2 file). I test sono generati con copy/paste: stesso `resolveToolPrompt()`, stesso `buildCompletedArtifactsByStep()`, stessi assert su policy e dipendenze. Cambia solo `toolKey`.

**Azione**:
1. Creare `apps/backend/src/lib/tests/runtime.tool-prompts-parametrized.test.ts`:
   ```typescript
   const TOOLS = [
     { toolKey: 'brief-generator', stepKeys: ['brief-generation'], ... },
     { toolKey: 'tov-generator', stepKeys: ['tov-generation'], ... },
     { toolKey: 'blog-article-generator', stepKeys: ['blog_seo_structure', 'blog_research', 'blog_article'], ... },
   ];
   
   describe.each(TOOLS)('$toolKey', ({ toolKey, stepKeys }) => {
     test('resolveToolPrompt carica extraction prompt', () => { ... });
     test('resolveToolPrompt carica generation prompt', () => { ... });
     test('resolveToolPrompt returns null per step sconosciuto', () => { ... });
     test('buildCompletedArtifactsByStep risolve correttamente', () => { ... });
     test('buildCompletedArtifactsByStep gestisce array vuoto', () => { ... });
     test('policy = enabled-for-all', () => { ... });
     test('step dependencies match contracts', () => { ... });
   });
   ```
2. Aggiungere un nuovo tool = aggiungere 1 oggetto all'array `TOOLS`, non 120 righe di boilerplate.
3. Eliminare i 6 file originali.

**Righe nette**: -272 (352 → ~80)

**QA**:
- Strumento: `node --import tsx --test src/lib/tests/runtime.tool-prompts-parametrized.test.ts`
- Passi: (1) creare il file parametrizzato con i 3 tool esistenti, (2) eseguire il nuovo file di test, (3) verificare che TUTTI i test case dei 6 file originali siano coperti (controllare conteggio test: 6 file × ~4 test = 24 test attesi nel file parametrizzato), (4) eliminare i 6 file, (5) eseguire `npm --workspace apps/backend run test`
- Risultato atteso: stesso numero di test case eseguiti, zero regressioni. Coverage invariata (gli assert sono gli stessi)

---

## Phase 3 — Semplificazione stub backend (medio rischio)

### TASK 3.1: Sostituire FeedbackCenterDbStub con in-memory store semplice

**File**: `apps/backend/src/lib/tests/runtime.auth-http.test.ts` (linee 78-270, 192 righe di stub)

**Problema**: `FeedbackCenterDbStub` è una classe di 167 righe che impersona Postgres parsando SQL con `.includes()` e regex su stringhe. Ogni modifica query (aggiunta campo, cambio ordine parametri, rename tabella) rompe lo stub con `"Unsupported SQL"`.

**Azione**: Sostituire con un semplice in-memory store:
```typescript
class FeedbackCenterStore {
  userReports = new Map<string, UserReportRecord>();
  changelogs = new Map<string, ChangelogRecord>();
  
  getUserReport(id: string) { return this.userReports.get(id) ?? null; }
  listUserReports(filter?: { status?, category? }) { ... }
  insertUserReport(report: UserReportRecord) { this.userReports.set(report.id, report); }
  updateUserReport(id: string, patch: Partial<UserReportRecord>) { ... }
  // ...
}
```
Poi fare in modo che i test chiamino direttamente lo store invece di passare per query SQL stub. I test testano l'auth HTTP runtime, non il layer database.

**Righe rimosse**: ~130

**QA**:
- Strumento: `node --import tsx --test src/lib/tests/runtime.auth-http.test.ts`
- Passi: (1) creare il nuovo store, (2) riscrivere i test che usano `FeedbackCenterDbStub` per usare il nuovo store, (3) eseguire il file di test specifico, (4) eseguire `npm --workspace apps/backend run test:integration`
- Risultato atteso: tutti i 34 test di `runtime.auth-http.test.ts` passano. I test su user-reports e changelogs nella sezione feedback center del file funzionano con gli stessi dati di test

---

### TASK 3.2: Semplificare stub transazionali in user-report-github-link

**File**: `apps/backend/src/lib/tests/user-report-github-link.adapter.test.ts` (linee 11-62, 52 righe di stub)

**Problema**: `TransactionClientStub` (49 righe) + `PoolConnectStub` (13 righe) implementano SQL string matching per testare una singola funzione di transazione (`publishUserReportIssueTransaction`). Overkill per 2 test case.

**Azione**: Sostituire con un mock/spy più semplice che:
1. Registra le chiamate in un array
2. Non prova a parsare SQL
3. Permette di configurare il comportamento (success/failure) tramite flag

**Righe rimosse**: ~30

**QA**:
- Strumento: `node --import tsx --test src/lib/tests/user-report-github-link.adapter.test.ts`
- Passi: (1) semplificare gli stub, (2) eseguire il test
- Risultato atteso: i 2 test (`commits atomically`, `rolls back when update fails`) passano invariati

---

## Phase 4 — Affinamento finale (basso rischio)

### TASK 4.1: Ridurre tool-form-architecture.test.ts ai soli edge case

**File**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts` (70 righe)

**Problema**: 32 delle 70 righe testano che funzioni di lookup restituiscano valori statici:
```typescript
expect(getToolLabel('angle_generator')).toBe('Angle Generator');  // testing a Map.get()
expect(getToolRoute('meta_ads')).toBe('/tools/meta-ads');         // testing a Map.get()
expect(getEnabledToolKeys('member')).toEqual([...9 tool keys...]); // testing a filter
```

**Azione**: Rimuovere i test di lookup statico. Tenere solo:
- `getAvailableSteps`: testare edge case di dipendenze non soddisfatte (logica reale)
- `isToolEnabled`: testare differenza member vs admin (logica di policy)

**Righe rimosse**: ~45

**QA**:
- Strumento: `npm --workspace apps/frontend run test -- tool-form-architecture`
- Passi: (1) ridurre il file, (2) eseguire il test
- Risultato atteso: i test di `getAvailableSteps` e `isToolEnabled` passano (la logica non cambia)

---

### TASK 4.2: Estrarre feedbackApiSpy in helper condiviso

**File coinvolti**: 7 file che definiscono lo stesso spy identico (7 righe ciascuno)

**Azione**:
1. Creare `apps/frontend/src/test/mocks/feedback-message-spy.mock.ts`:
   ```typescript
   export const createFeedbackApiSpy = () => vi.hoisted(() => ({
     publishSuccess: vi.fn(),
     publishError: vi.fn(),
     dismiss: vi.fn(),
     dismissAll: vi.fn(),
   }));
   ```
2. Sostituire in tutti i file.

**Righe nette**: -30

**QA**:
- Strumento: `npm --workspace apps/frontend run test`
- Passi: (1) creare helper, (2) migrare i 7 file, (3) eseguire suite completa
- Risultato atteso: zero regressioni

---

### TASK 4.3: Aggiungere `describe` blocks in runtime.auth-http.test.ts

**File**: `apps/backend/src/lib/tests/runtime.auth-http.test.ts` (3689 righe, 34 test top-level, 0 blocchi `describe`)

**Azione**: Raggruppare i test in blocchi logici:
```typescript
describe('auth HTTP - login/logout/session', () => { ... });
describe('auth HTTP - OAuth flow', () => { ... });
describe('auth HTTP - password reset', () => { ... });
describe('auth HTTP - admin feedback center', () => { ... });
```

**Righe modificate**: 0 nette (solo indentazione/struttura). Beneficio: navigabilità e debug (`node --test --test-name-pattern="auth HTTP - login"`).

---

## Riepilogo per Fase

| Fase | Task | File creati | File eliminati | Righe nette | Rischio |
|---|---|---|---|---|---|
| **1** | 1.1 Guard tests | 0 | 2 | **-139** | Basso |
| **1** | 1.2 Test triviali | 0 | 2 | **-41** | Basso |
| **1** | 1.3 Copy hardcoded → appCopy | 0 | 0 | 0 (~30 assert conv.) | Basso |
| **2** | 2.1 AuthSessionProvider mock factory | 1 | 0 | **-690** | Basso |
| **2** | 2.2 briefingUploadMachine shared mock | 1 | 0 | 0 (spostamento) | Basso |
| **2** | 2.3 Tool tests parametrizzati | 1 | 6 | **-272** | Medio |
| **3** | 3.1 FeedbackCenterDbStub semplificato | 0 | 0 | **-130** | Medio |
| **3** | 3.2 TransactionClientStub semplificato | 0 | 0 | **-30** | Medio |
| **4** | 4.1 tool-form-architecture ridotto | 0 | 0 | **-45** | Basso |
| **4** | 4.2 feedbackApiSpy condiviso | 1 | 0 | **-30** | Basso |
| **4** | 4.3 auth-http describe blocks | 0 | 0 | 0 | Basso |
| **TOT** | | 4 nuovi file | 10 eliminati | **-1,377 nette** | |

---

## Impatto Stimato

| Metrica | Prima | Dopo |
|---|---|---|
| File di test | 132 | ~122 |
| Righe test | ~31,000 | ~27,500 |
| Tempo aggiunta nuovo tool | ~120 righe test da scrivere | ~1 riga in array parametrizzato |
| Tempo modifica copy UI | 2-4 test rotti da fixare | 0 test rotti (usa `appCopy`) |
| Tempo modifica query SQL | Rotto `FeedbackCenterDbStub` | Rotto solo se cambia semantica |
| Tempo refactor nome componente | Rotto tree-walk guard | Nessun impatto |
| Modifica `AuthSessionProvider` API | Rotti 24 file | Rotto 1 factory → fix 1 riga |

---

## Ordine di Esecuzione Consigliato

1. **Fase 1** completa (1-2 ore) — massimo rapporto costo/beneficio, rischio zero
2. **Fase 2** Task 2.1 + 2.2 (1 ora) — elimina attrito quotidiano sui mock
3. **Fase 2** Task 2.3 (1 ora) — richiede attenzione per non perdere coverage
4. **Fase 3** (1-2 ore) — da fare con calma, i test auth-http sono critici
5. **Fase 4** (30 min) — cleanup finale
