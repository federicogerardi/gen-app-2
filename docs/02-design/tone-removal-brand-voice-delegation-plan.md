---
status: completed
version: 1.1
last-reviewed: 2026-07-19
next-review-date: 2026-10-17
owner: Generation Team
type: implementation-plan
tags:
  - tone
  - brand-voice
  - asset-injection
  - generation
  - refactoring
  - frontend-readiness
  - ddd-aligned
goal: Rimuovere il parametro `tone` standalone dalla generazione e delegare la specifica del tono all'iniezione di asset Brand Voice tramite AssetFieldMapping (DDD-207).
---

# Piano: Rimozione di `tone` come parametro di generazione e delega a Brand Voice asset

## Obiettivo

Rimuovere la proprietà `tone` (ToneProfile: Professional/Casual/Formal/Technical) da tutti i livelli dell'architettura di generazione (BE e FE) e delegare la specifica del tono all'uso di asset `Brand Voice` tramite il meccanismo esistente di `AssetFieldMapping` (DDD-207).

## Razionale

- Il tono di voce è una proprietà del brand, non un parametro discreto selezionabile per ogni generazione.
- Il sistema dispone già di un meccanismo completo di asset injection (`generation-actor.ts`, `asset-injection-resolver.ts`, `ASSET_FIELD_MAPPINGS`).
- Il `tov-generator` (DDD-211/212) produce asset `brand-voice` che contengono già il campo `tone`.
- Separare il tono come parametro standalone crea ridondanza e incoerenza con il contenuto del Brand Voice asset.

## Analisi impatto FE: readiness e form validation

### Sistema a due gate indipendenti

Il sistema ha **due gate indipendenti** per l'abilitazione della generazione:

| Layer | Cosa controlla | Controlla `tone`? | Effetto se fallisce |
|-------|---------------|--------------------|---------------------|
| **Form validation** (Zod, `ToolPageTemplate.tsx:324`) | Tutti i campi form incluso tone | **SÌ — `REQUIRED`** | `handleSubmit` non chiama mai `executePrimaryActionFromForm` |
| **Machine readiness** (XState, `tool-page-readiness.ts`) | projectId, extractionContext, primaryTargetStep, requiredAssets | **NO** | CTA disabilitato con tooltip |

### Blocker critico: Zod validation

A `ToolPageTemplate.tsx:324`, il campo `tone` è **required** nello schema Zod:

```typescript
tone: z.string().min(1, copy.form.validation.toneRequired),
```

Rimuovendo il campo `tone` dal form MA lasciandolo nello schema Zod, il `useForm` resolver marchia il form come invalido e `handleSubmit` **non scatta mai** — dead-lock permanente su tutti gli 11 tool.

**La macchina XState non ha alcuna dipendenza da `tone`**: i guard `canStartGeneration` in `tool-page.machine.ts` e `buildReadinessSnapshot` in `tool-page-readiness.ts` controllano solo `projectId`, `extractionContext`, `primaryTargetStep`, `requiredAssets`. Rimuovere `tone` non rompe il readiness a livello macchina.

### Il dropdown tone è incondizionato

Il `<Controller name="tone">` a `ToolPageTemplate.tsx:734-758` è renderizzato **senza guard condizionali** — appare su tutti gli 11 tool. Non esiste alcun `{isFooTool && ...}` che lo protegge. Il campo è sempre visibile e sempre required.

### Ordine critico di rimozione FE

L'ordine è vincolante perché la rimozione del campo dal form state prima della rimozione dallo schema Zod causa errori di compilazione, e viceversa. Seguendo quest'ordine si evita il dead-lock del form:

```
1. Rimuovere tone da Zod schema            (ToolPageTemplate.tsx:324)  ← SBLOCCA IL GATE
2. Rimuovere UI Controller + dropdown      (ToolPageTemplate.tsx:734-758)
3. Rimuovere sync effect formState → RHF   (ToolPageTemplate.tsx:586-588)
4. Rimuovere defaultValues.tone            (ToolPageTemplate.tsx:541)
5. Rimuovere executePrimaryActionFromForm  (ToolPageTemplate.tsx:490)
6. Rimuovere da ToolFormState              (tool-form-architecture.ts:100)
7. Rimuovere default init                  (useToolForm.ts:22)
8. Rimuovere prefill logic                 (tool-page-context.ts:203-216)
9. Rimuovere da selectors (pick + input)   (tool-page-selectors.ts:447,470)
10. Rimuovere URL params                    (tool-entry-params.ts)
11. Rimuovere normalizer                    (tool-page-runtime-utils.ts)
12. Rimuovere copy labels                   (system.ts)
13. Rimuovere artifact-history tone param   (artifact-history.ts:141-143)
14. Aggiornare 14+ file di test
```

---

## Perimetro completo (file-by-file)

### CONTRACTS (`packages/contracts/src/`)

1. **`index.ts:140,142,199`** — RIMUOVERE: esportazione `ToneProfile`, esportazione `RequestTone`, campo `tone` da `GenerationRequestInput`.

2. **`extraction-fields.ts`** — MANTENERE tutto: `tone` resta `ExtractionFieldKey` per brief/tov generator.

3. **`asset.ts:305-316`** — ESPANDERE: aggiungere mapping `brand-voice→{toolKey}` per TUTTI i tool che consumano brand-voice (`funnel-pages`, `nextland`, `youtube-lf-script`, `youtube-description`, `blog-article-generator`), oltre al già esistente `meta-ads`. Ogni mapping replica la struttura esistente: `{ tone: { sourcePath: 'tone', injectionTemplate: '## Brand Tone: {{tone}}', required: true }, guidelines: { sourcePath: 'guidelines', injectionTemplate: '### Voice Guidelines: {{guidelines}}', required: false } }`.

### BACKEND — Canonicalization e Prompt Injection

4. **`apps/backend/src/lib/runtime/request-contract.ts:96-148,158,184,209`** — RIMUOVERE: `TONE_PROFILE_ALLOWED`, `toCanonicalToneProfile()`, `toCanonicalRequestTone()`, uso di `canonicalTone` in `buildRequestReceivedEvent`. Rimuovere anche la destrutturazione `tone: _rawTone` e l'enrichment `...(canonicalTone ? { tone: canonicalTone } : {})`.

5. **`apps/backend/src/lib/machines/generation-system.actions.ts:461-465`** — RIMUOVERE: replace `{{tone}}` da `requestInput.tone`.

6. **`apps/backend/src/lib/machines/generation-actor.ts`** — NESSUNA MODIFICA: asset injection già funzionante, costruisce `fieldMappingKey` dinamicamente come `${asset.assetType}→${toolKey}` (linea 72).

### PROMPT TEMPLATES

7. **`apps/backend/src/lib/runtime/tool-prompts/extraction/prompt_generation.md:24`** — RIMUOVERE riga `- Tono richiesto: {{tone}}`.

8. **`apps/backend/src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_article.md:22`** — RISCRIVERE: rimuovere riferimento a `{{tone}}`, aggiungere nota che il tono deriva dal Brand Voice asset.

### BACKEND — Extraction

9. **`apps/backend/src/lib/machines/generation/extraction-parsers.ts:20`** — MANTENERE: `tone: 'tone'` in `YOUTUBE_EXTRACTION_SECTION_BY_HEADING` (mapping heading markdown → extraction field key).

10. **`apps/backend/src/lib/machines/generation/extraction-parsers.ts:348`** — RIMUOVERE: `primary_tone` reference a `requestInput.tone`. Sostituire con `null` o rimuovere il campo.

11. **`apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_extraction.md`**, **`apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_extraction.md`** — MANTENERE: `tone` come extraction field (linea 19 e 17 rispettivamente).

### BACKEND — Observability e Session

12. **`apps/backend/src/lib/runtime/generation-stream-observability.ts:68-75,79,93,118,156`** — RIMUOVERE/ADATTARE: `readTone()`, campo `tone` in `GenerationDebugInfo`. Rimuovere i log che referenziano `info.tone`.

13. **`apps/backend/src/lib/runtime/backend-session.ts:49-52,65,236`** — RIMUOVERE/ADATTARE: `requestedTone` e i log che lo utilizzano.

### FRONTEND — Form Architecture (ordine vincolante)

**⚠️ L'ordine di esecuzione in questa sezione è vincolante.** Lo schema Zod è il gate critico: va rimosso per primo per sbloccare il form, poi a cascata tutti i consumer.

14. **`apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`** — 5 punti di intervento in ordine:
    - **Linea 324**: RIMUOVERE `tone: z.string().min(1, copy.form.validation.toneRequired),` dallo schema Zod — **CRITICO: sblocca il gate di submit del form**
    - **Linee 734-758**: RIMUOVERE l'intero blocco `<Controller name="tone" ...>` con `<TextField select>` e `<MenuItem>` del dropdown tone
    - **Linee 586-588**: RIMUOVERE `useEffect` che sync `formState.tone` → `setValue('tone', ...)`
    - **Linea 541**: RIMUOVERE `tone: formState.tone` da `defaultValues` di `useForm`
    - **Linea 490**: RIMUOVERE `tone: formState.tone` da `executePrimaryActionFromForm` (sync formState → RHF prima del submit)
    - **Linea 33**: RIMUOVERE costante `toneProfileOptions` (diventa dead code dopo rimozione dropdown)

15. **`apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`** — 2 punti:
    - **Linea 100**: RIMUOVERE `tone: string` da `ToolFormState`
    - **Linea 335**: RIMUOVERE nota `'The brief tone does not replace the generation ToneProfile.'` dall'array `notes` di `youtube-lf-script`

16. **`apps/frontend/src/features/tools/runtime/useToolForm.ts:22`** — RIMUOVERE: `tone: 'Professional'` default nell'inizializzazione del form state.

17. **`apps/frontend/src/features/tools/runtime/tool-page-context.ts`** — 3 punti:
    - **Linea 70**: RIMUOVERE `tonePrefillDoneRef` e suo import `useRef` se non più utilizzato
    - **Linee 203-216**: RIMUOVERE intero blocco `useEffect` che fa prefill tone da `relaunchTone` o `sourceArtifact`
    - **Linea di import**: RIMUOVERE import di `normalizeToneProfile` se non più utilizzato

18. **`apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`** — 3 punti:
    - **Linea 447**: RIMUOVERE `'tone'` dal Pick type di `buildBaseGenerationRequest` (`Pick<ToolFormState, 'model' | 'tone' | ...>`)
    - **Linea 470**: RIMUOVERE `tone: normalizeToneProfile(formState.tone),` dall'oggetto `input` restituito
    - **Linea 32**: RIMUOVERE import di `normalizeToneProfile` se non più utilizzato

19. **`apps/frontend/src/features/tools/runtime/tool-page-runtime-utils.ts`** — rimozione completa:
    - **Linea 2**: RIMUOVERE import di `ToneProfile` da `@gen-app-2/contracts`
    - **Linee 4-5**: RIMUOVERE `TONE_PROFILE_DEFAULT` e `TONE_PROFILE_ALLOWED`
    - **Linee 27-38**: RIMUOVERE intera funzione `normalizeToneProfile()`

20. **`apps/frontend/src/features/tools/runtime/tool-entry-params.ts:7,37`** — RIMUOVERE: `relaunchTone: string | null` dal type `ToolEntryParams` e `relaunchTone: parseOptionalString(searchParams.get('tone'))` da `parseToolEntryParams`.

21. **`apps/frontend/src/features/tools/runtime/tools-client.ts:90`** — RIMUOVERE: `tone?: string` da `RunExtractionInput` type. L'hardcode `tone: 'analitico'` a linea 292 resta invariato per extraction workflow.

22. **`apps/frontend/src/features/generation/ui/artifact-history.ts:141-143`** — RIMUOVERE: `const tone = readInputField(artifact.sourceRequest, 'tone'); if (tone) { params.set('tone', tone); }` dal builder URL di relaunch.

### FRONTEND — Copy System

23. **`apps/frontend/src/app/copy/system.ts`** — 5 punti:
    - **Linea 139**: RIMUOVERE `toneOptional: 'Tone (optional)'`
    - **Linee 185-190**: RIMUOVERE array `toneProfiles` (4 opzioni: Professional, Casual, Formal, Technical)
    - **Linea 206**: RIMUOVERE `toneLabel: 'Tone'`
    - **Linea 232**: RIMUOVERE `toneRequired: 'Tone required'`
    - Verificare che nessun consumer referenzi ancora queste chiavi dopo la rimozione

### FRONTEND — Artifact Detail (metadata display)

24. **`apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx:179-263`** — VERIFICARE: il componente potrebbe renderizzare `tone` come metadato dell'artifact. Se il campo tone non è più presente nel payload, la riga semplicemente non verrà renderizzata. Rimuovere il blocco condizionale `{metadata.tone && ...}` per pulizia.

### FRONTEND — Estrazione (nessuna modifica)

25. **`apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts:53`** — MANTENERE: `tone: 'Tone'` label per extraction display. Il campo resta un `ExtractionFieldKey`.

### TEST FILES — Backend

27. Aggiornare/rimuovere test che usano `tone` in fixture di `GenerationRequestInput` nei seguenti file:
    - `apps/backend/src/lib/tests/runtime.tool-prompts.test.ts` (linee 174, 196, 218, 239: `input.tone` assertions)
    - `apps/backend/src/lib/tests/runtime.tool-prompts-parametrized.test.ts` (linee 25, 35: `extractionFields` config; linea 60: `{{tone}}` contentPattern)
    - `apps/backend/src/lib/tests/generation.extraction-parsers.test.ts` (linea 38: `fromYoutube.tone`)
    - `apps/backend/src/lib/tests/runtime.generation-entry-guards.test.ts` (linea 49: `tone: 'Professional'` fixture)
    - `apps/backend/src/lib/tests/generation-system.runtime.test.ts` (linea 232: `tone: 'analitico'` input)
    - `apps/backend/src/lib/tests/runtime.auth-http.test.ts` (linea 2871: `tone: 'Consultative'` fixture)

### TEST FILES — Frontend (14 file)

28. Aggiornare/rimuovere test che usano `tone` in `ToolFormState`, `GenerationRequest.input`, `ToolEntryParams`, artifact metadata:

    **Tool Page Template tests:**
    - `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` (linea 222: `tone: 'Professional'` in mock formState)
    - `apps/frontend/src/features/tools/ui/ToolPageTemplate.meta-ads-flow.e2e.test.tsx` (linea 17: `tone: 'Professional'`)
    - `apps/frontend/src/features/tools/ui/ToolPageTemplate.meta-ads-objective.test.tsx` (linea 52: `tone: 'Professional'`)
    - `apps/frontend/src/features/tools/ui/ToolPageTemplate.geometric-direct-input.test.tsx` (linea 68: `tone: 'Professional'`)
    - `apps/frontend/src/features/tools/ui/ToolPageTemplate.youtube-description-direct-input.test.tsx` (linea 68: `tone: 'Professional'`)

    **Tool Page runtime tests:**
    - `apps/frontend/src/features/tools/runtime/useToolPage.test.ts` (linee 89, 217, 389: mock formState; linee 410-468: test specifico normalizzazione e fallback tone)
    - `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` (linee 174, 214: `tone: 'Professional'` in formState)
    - `apps/frontend/src/features/tools/runtime/tools-client.test.ts` (linee 107-135: test `runExtraction` hardcoded `'analitico'`; linee 322-337: extraction payload con tone)
    - `apps/frontend/src/features/tools/runtime/tool-entry-params.test.ts` (linea 40: `tone: ' direct '`)

    **Artifact tests:**
    - `apps/frontend/src/features/generation/ui/artifact-history.test.ts` (linee 82, 96, 110, 127, 182: tone in relaunch URL e fixture)
    - `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx` (linee 141-218: test rendering tone metadata)

    **Session summary tests:**
    - `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx` (linee 55, 164, 232, 313, 380, 450: `tone: 'Formal'` in multiple fixtures)

**Nota sui test di extraction:** I test in `tools-client.test.ts` che verificavano `tone: 'analitico'` per extraction sono stati aggiornati — l'hardcode è stato rimosso insieme al tipo `RunExtractionInput.tone`.

## Cosa NON cambia

- **`tone` come `ExtractionFieldKey`** — resta campo di estrazione per brief/tov generator.
- **Asset injection pipeline** (`generation-actor.ts`, `asset-injection-resolver.ts`) — già funzionante, nessuna modifica.
- **`tone` extraction prompts e parser** — restano invariati (`brief-generator/prompt_extraction.md`, `tov-generator/prompt_extraction.md`, `extraction-parsers.ts:20`).

## Ordine di esecuzione raccomandato

✅ **Completato 2026-07-19**

1. **Contracts**: rimosso `ToneProfile`/`RequestTone`/`tone` da `GenerationRequestInput` + espanso `ASSET_FIELD_MAPPINGS` con le 5 nuove entry `brand-voice→{toolKey}`.
2. **Backend**: rimosso canonicalization tone, `{{tone}}` replacement, extraction operational tone `analitico`, tone da observability/session, `primary_tone` da extraction-parsers.
3. **Prompt templates**: rimosso `{{tone}}` da `extraction/prompt_generation.md` e `blog-article-generator/prompt_blog_article.md`.
4. **Frontend** (14 step eseguiti nell'ordine vincolante):
   - ✅ Step 4.1 — Rimosso tone da Zod schema
   - ✅ Step 4.2 — Rimosso UI Controller + dropdown
   - ✅ Step 4.3 — Rimosso sync effect + defaultValues + executePrimaryActionFromForm
   - ✅ Step 4.4 — Rimosso da ToolFormState
   - ✅ Step 4.5 — Rimosso default init
   - ✅ Step 4.6 — Rimosso prefill logic
   - ✅ Step 4.7 — Rimosso da selectors
   - ✅ Step 4.8 — Rimosso URL params
   - ✅ Step 4.9 — Rimosso normalizer
   - ✅ Step 4.10 — Rimosso copy labels
   - ✅ Step 4.11 — Rimosso artifact-history tone param
   - ✅ Step 4.12 — Rimosso tone metadata da ArtifactDetailPage
5. **Test**: aggiornati 6 file backend + 12 file frontend.
6. **Validazione**: typecheck, test, build — tutti passati.

## Validazione

✅ **Completata 2026-07-19**

1. `npm run typecheck` — pulito su tutti i 5 workspace (backend, frontend, contracts, domain, infra-db).
2. `npm run test` — 68 file frontend, 465 test passati (6 skipped pre-esistenti).
3. `npm --workspace apps/backend run test` — 396 test passati.
4. `npm run build` — frontend built in 475ms.
5. **Verifica FE**: il form di ogni tool page è valido e submit-enabled senza campo tone — lo Zod schema non blocca.
6. Verifica funzionale: con un asset Brand Voice attivo, il prompt generato include la sezione `## Brand Tone: ...` iniettata via `ASSET_FIELD_MAPPINGS`.
7. Verifica funzionale: senza asset Brand Voice, la generazione funziona senza errori (nessun `{{tone}}` unresolved).

---

## DDD Governance Status (2026-07-19)

**Gate status: CLOSED** — entrambi i blocker risolti.

| # | Blocker | Risoluzione |
|---|---------|-------------|
| **B1** | `analitico` senza replacement | **Opzione (c) scelta**: il tono operativo `analitico` per extraction è eliminato. L'LLM extraction engine decide il tono in autonomia, guidato dal prompt di step. Il replace `{{tone}}` in `extraction/prompt_generation.md:24` viene rimosso; l'hardcode in `tools-client.ts:292` e `toCanonicalRequestTone()` in `request-contract.ts` vengono eliminati. Vedi DDD-217. |
| **B2** | Nessuna entry DDD | **DDD-216 e DDD-217 creati**. Decision Log (v4.11), Glossary (v2.20), e BCM (v3.11) aggiornati con: (a) retirement di `ToneProfile` e `RequestTone`, (b) delega tone a Brand Voice asset injection via `AssetFieldMapping`, (c) eliminazione extraction operational tone `analitico`, (d) nuovo integration constraint `AssetFieldMapping['brand-voice→{toolKey}']` tone injection. |

### Decisioni DDD allineate

| Entry | Documento | Versione | Contenuto |
|-------|-----------|----------|-----------|
| DDD-216 | Decision Log | v4.11 | Retirement di `ToneProfile` (DDD-039) e `RequestTone` (DDD-076). Delega tone a Brand Voice asset injection. Perimetro completo di rimozione. |
| DDD-217 | Decision Log | v4.11 | Eliminazione extraction operational tone `analitico`. LLM self-determina tono da step prompt. |
| Glossary | UL Glossary | v2.20 | `ToneProfile` e `RequestTone` marcati `deprecated`. `GenerationRequest` aggiornato senza riferimenti a tone. |
| BCM | Bounded Context Map | v3.11 | Integration constraints deprecati. Nuovo constraint `AssetFieldMapping` tone injection. |

---

## Momus Review Notes (2026-07-19, updated v1.1.0)

**Verdetto: [OKAY]** — Piano eseguito e validato. v1.1.0 riflette l'implementazione completa con risultati di validazione.

### Riepilogo della verifica (v1.1.0)

- **Reference verification**: 30+ file referenziati esistono e sono stati modificati. ✅
- **Executability**: Ogni task eseguito nell'ordine vincolante previsto. ✅
- **Readiness blocker risolto**: Il form di ogni tool page è valido e submit-enabled senza campo tone. ✅
- **DDD governance**: DDD-216 e DDD-217 creati, Glossary e BCM aggiornati. ✅
- **Validazione finale**: `npm run typecheck` (5 workspace), `npm run test` (68 file FE, 396 BE), `npm run build` — tutti passati. ✅

### File modificati nell'implementazione

| Area | File | Azione |
|------|------|--------|
| **Contracts** | `index.ts` | Rimosso `ToneProfile`, `RequestTone`, `tone` da `GenerationRequestInput` |
| | `asset.ts` | Aggiunte 5 entry `brand-voice→{toolKey}` (funnel-pages, nextland, youtube-lf-script, youtube-description, blog-article-generator) |
| **Backend** | `request-contract.ts` | Rimosso `TONE_PROFILE_ALLOWED`, `toCanonicalToneProfile()`, `toCanonicalRequestTone()`, `canonicalTone` |
| | `generation-system.actions.ts` | Rimosso replace `{{tone}}` |
| | `tools-client.ts` | Rimosso `tone` da `RunExtractionInput`, rimosso hardcode `analitico` |
| | `generation-stream-observability.ts` | Rimosso `readTone()`, `tone` da debug info |
| | `backend-session.ts` | Rimosso `requestedTone` |
| | `extraction-parsers.ts` | Rimosso `primary_tone` |
| **Prompt** | `extraction/prompt_generation.md` | Rimosso `- Tono richiesto: {{tone}}` |
| | `blog-article-generator/prompt_blog_article.md` | Rimosso `{{tone}}`, aggiunto riferimento Brand Voice |
| **Frontend** | `ToolPageTemplate.tsx` | Rimosso Zod schema, UI Controller, sync effect, defaultValues, `toneProfileOptions` |
| | `tool-form-architecture.ts` | Rimosso da `ToolFormState` e note |
| | `useToolForm.ts` | Rimosso default `tone: 'Professional'` |
| | `tool-page-context.ts` | Rimosso prefill logic e `tonePrefillDoneRef` |
| | `tool-page-selectors.ts` | Rimosso da Pick type e `buildGenerationRequest` |
| | `tool-entry-params.ts` | Rimosso `relaunchTone` |
| | `tool-page-runtime-utils.ts` | Rimosso `normalizeToneProfile()`, `TONE_PROFILE_*` |
| | `useToolPage.ts` | Rimosso `relaunchTone` prop |
| | `createToolPage.tsx` | Rimosso `relaunchTone` prop |
| | `copy/system.ts` | Rimosso `toneProfiles`, `toneLabel`, `toneRequired`, `toneOptional` |
| | `artifact-history.ts` | Rimosso tone dal relaunch URL |
| | `ArtifactDetailPage.tsx` | Rimosso tone metadata display |
| **Test** | 6 BE + 12 FE test file | Aggiornati fixture e asserzioni |

### Validazione finale

| Check | Risultato |
|-------|-----------|
| `npm run typecheck` (5 workspace) | ✅ Pulito |
| `npm run test` (frontend, 68 file) | ✅ 465 passati, 6 skipped |
| `npm --workspace apps/backend run test` | ✅ 396 passati |
| `npm run build` (frontend) | ✅ Built in 475ms |
