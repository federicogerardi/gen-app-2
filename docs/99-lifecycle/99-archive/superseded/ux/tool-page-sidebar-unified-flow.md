# UX Proposal — Tool Workspace Page: Workflow Panel Unificato

**Data**: 2026-05-22  
**Scope**: `ToolGenerationFlowVertical` + `ToolPageTemplate` (Setup Panel feedback)  
**Archetype**: Tool Workspace Page ([frontend-ui-ubiquitous-language-spec.md](../02-design/specifications/frontend-ui-ubiquitous-language-spec.md))

---

## 1. Diagnosi as-is: feedback dispersivo

### Dove vive il feedback oggi

| Elemento | Dove appare | Componente |
|---|---|---|
| Stato brief (upload/extraction) | **Workflow Panel** — checklist "Requisiti" | `ToolGenerationFlowVertical` |
| Errore briefing | **Form** — inline `<p.error>` | `ToolPageTemplate` |
| Guida briefing (guidance) | **Form** — inline `<p.metaLine>` | `ToolPageTemplate` |
| File obbligatori mancanti | **Form** — inline `<p.error>` + parzialmente Workflow Panel | `ToolPageTemplate` |
| Suggerimento file opzionali | **Form** — sotto ogni upload button | `ToolPageTemplate` |
| Hint "Genera contesto" | **Form** — inline `<p.metaLine>` | `ToolPageTemplate` |
| Errore reload artefatti | **Form** — inline `<p.error>` | `ToolPageTemplate` |
| Progresso step generazione | **Workflow Panel** — fase monitoring/completion | `ToolGenerationFlowVertical` |
| Errore globale generazione | **Workflow Panel** | `ToolGenerationFlowVertical` |
| Errore dispatch CTA | **Form** — per contratto architetturale | `ToolPageTemplate` |

**Problema centrale**: il Workflow Panel è *phase-exclusive* — mostra la checklist "Requisiti" nella fase input, poi la sostituisce con il progress in monitoring. L'utente perde visibilità sul payload caricato nel momento in cui la generazione parte.

Il form accumula 6–7 messaggi inline non strutturati, dispersi tra i bottoni di upload e la CTA.

---

## 2. Principio di refactoring

> **Il form è puramente interattivo. Il Workflow Panel è l'unico canale di feedback.**

- **Form**: selector (project, model, tone) + bottoni di upload + CTA. Zero messaggi di processo, tranne `dispatchError` che per contratto architetturale resta inline adiacente alla CTA.
- **Workflow Panel**: unico pannello di feedback strutturato, sempre visibile con tre sezioni *persistenti* (non phase-exclusive).

---

## 3. Struttura Workflow Panel unificato per fase

Il layout varia per fase: la barra indeterminata è presente **solo in MONITORING** (e solo per `running` / `paused-with-checkpoint` — non per `prefilled-regenerate`). La sezione Feedback appare in qualsiasi fase quando ci sono messaggi.

**INPUT**
```
┌──────────────────────────────────────────────────────┐
│  PAYLOAD CARICATO  (InputFilePayloadStatus — DDD-082) │
│                                                      │
│  ✓  Brief              relazione-q1.pdf             │
│  ○  Angle Detector     —  (non caricato)            │
│  ○  Doc opzionale      —  (opzionale)               │
│                                                      │
│  → sempre visibile                                   │
├──────────────────────────────────────────────────────┤
│  FEEDBACK  (condizionale)                            │
│  ✕  Messaggio di errore  (solo se presente)         │
│  ℹ  Messaggio info       (solo se presente)         │
└──────────────────────────────────────────────────────┘
```

**MONITORING** (solo per `running` / `paused-with-checkpoint`)
```
┌──────────────────────────────────────────────────────┐
│  PAYLOAD CARICATO  (InputFilePayloadStatus — DDD-082) │
│  ✓  Brief              relazione-q1.pdf             │
│  ✓  Angle Detector     personas.xlsx                │
│                                                      │
│  → congelato sullo stato al momento del dispatch     │
├──────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░  [indeterminate pulse]              │
│                                                      │
│  Generazione in corso                               │
│  Il processo è attivo e richiede alcuni minuti.     │
│  Puoi tenere la pagina aperta: il risultato          │
│  apparirà automaticamente.                          │
├──────────────────────────────────────────────────────┤
│  FEEDBACK  (condizionale)                            │
│  ✕  Messaggio di errore  (solo se presente)         │
└──────────────────────────────────────────────────────┘
```

**COMPLETION**
```
┌──────────────────────────────────────────────────────┐
│  ✓  Generazione completata                           │
│                                                      │
│  PAYLOAD CARICATO  (InputFilePayloadStatus — DDD-082) │
│  ✓  Brief              relazione-q1.pdf             │
│  ✓  Angle Detector     personas.xlsx                │
│                                                      │
│  Apertura riepilogo sessione in corso...             │
└──────────────────────────────────────────────────────┘
```

---

## 4. Dettaglio delle tre sezioni

### 4.1 InputFilePayloadStatus — sezione payload caricato (DDD-082, sempre visibile)

Mostra ogni `inputFile` del tool in ordine canonico (da `toolFileInstructions.inputFiles`), con il brief come riga fissa al primo posto. UI copy del titolo sezione: "Payload caricato".

> **Nota sulla checklist "Requisiti" attuale**: la checklist corrente ha 3 item — Progetto, Brief, Pronto per la generazione — di cui solo gli item file (Brief, Angle Detector, ecc.) migrano in `InputFilePayloadStatus`. L'item **"Progetto"** viene rimosso (il project name è già nell'intestazione del Workflow Panel via `instruction`/`whereLabel`). L'item **"Pronto per la generazione"** (da `readinessReasonCodes`) migra nella sezione Feedback come item `error`/`info`, trattato alla stregua di `briefingError` e degli altri messaggi di readiness.

**Tabella stati riga** — il tipo `status` ha 4 valori: `'todo' | 'active' | 'done' | 'error'`. Il trattamento visivo dei file opzionali non caricati è **render-logic pura**: un file con `status: 'todo'` e `requiredness: 'optional-by-tool-setting'` si renderizza con icona `○` grigio chiaro e label "opzionale" — non richiede un valore `status` aggiuntivo.

| Stato riga | Icona | Condizione |
|---|---|---|
| `todo` (required) | `○` grigio | file obbligatorio non ancora caricato |
| `todo` (optional) | `○` grigio chiaro + label "opzionale" | file opzionale non caricato — render derivato da `requiredness: 'optional-by-tool-setting'` |
| `active` | `⟳` spin blu | uploading / extracting |
| `done` | `✓` verde | file caricato e pronto |
| `error` | `✕` rosso | errore sul file (es. `briefingError`) |

Durante monitoring e completion la sezione rimane visibile e congelata sullo stato `done`. Serve come prova silenziosa che la sessione è attiva con i dati corretti — riduce il dubbio "aveva caricato il file giusto?".

**Nuove props da aggiungere** a `ToolGenerationFlowVerticalProps`:
```ts
// InputFilePayloadStatus[] — DDD-082
inputFilePayload: Array<{
  key: string;
  label: string;
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting'; // ToolInputFileRequirementPolicy (DDD-081)
  status: 'todo' | 'active' | 'done' | 'error';
  fileName: string | null;
}>;
```

### 4.2 Avanzamento Generazione — barra indeterminata (fase monitoring)

La barra di progresso è **indeterminata** (pulse continuo, senza percentuale né counter di step). Trasmette *attività*, non *avanzamento misurabile*.

**Rationale**: con tempi medi di completamento di 6–8 minuti, mostrare step individuali crea due problemi cognitivi:
1. **Ansia da stallo** — se uno step non avanza visibilmente, l'utente interpreta il fermo come errore.
2. **Overhead di comprensione** — i nomi degli step non dicono nulla di utile in attesa; richiedono contestualizzazione che l'utente non ha.

Una barra indeterminata è più onesta per processi backend opachi dove la durata non è prevedibile step-by-step.

**Copy di rassicurazione (stabile, non reattivo agli step)**:
> **Generazione in corso**  
> Il processo è attivo e richiede alcuni minuti. Puoi tenere la pagina aperta: il risultato apparirà automaticamente.

Il testo non cambia durante il monitoring — è un'ancora psicologica fissa che riduce l'impulso a refreshare.

**Comportamento per `canonicalState`**:
- `running` → pulse attivo + testo rassicurazione
- `paused-with-checkpoint` → pulse rallentato o sospeso + testo "In pausa"
- `completed` → barra piena solidificata, pulse si ferma, sezione passa in completion

> **Guard `prefilled-regenerate`**: `derivePhase()` mappa `prefilled-regenerate` → `monitoring`, ma in questo stato nessuna generazione è in corso — l'utente deve ancora premere CTA. La barra indeterminata e il testo di rassicurazione **non devono renderizzare** per questo stato. Il guard interno alla sezione §4.2 deve essere: `canonicalState === 'running' || canonicalState === 'paused-with-checkpoint'`.

### 4.3 Feedback — sezione `inline-action` del Workflow Panel (condizionale)

Aggrega tutti i messaggi che oggi sono dispersi nel form, unificati nel canale `inline-action` del `Feedback Channel` (DDD-063). Include anche i messaggi di readiness (`readinessReasonCodes`) che nell'as-is erano item della checklist "Requisiti" (item "Pronto per la generazione"). Priorità di rendering dall'alto:

| Messaggio | Sorgente | Tipo |
|---|---|---|
| `briefingError` | `useToolPage` | `error` |
| File obbligatori mancanti | `fileCompletion.missingRequiredFiles` | `error` |
| Readiness mancante | `readinessReasonCodes` (es. `missing_project`, `missing_extraction_context`) | `error` / `info` |
| `artifactsReloadError` | `useToolPage` | `error` |
| `briefingGuidance` | `useToolPage` | `info` |
| Suggerimento file opzionali | `fileCompletion.missingOptionalFiles` | `info` |
| Hint estrazione pronta | `canStartExtraction` | `info` |

La sezione non appare se tutti i messaggi sono `null` / `[]`.

> **Nota `briefingGuidance`**: nel codice as-is `briefingGuidance` viene già renderizzato dentro `ToolGenerationFlowVertical` (come `guidanceMessage` nella sezione "Requisiti" INPUT). Il refactoring deve: (1) rimuoverlo dal form, (2) refactorare il rendering esistente in `ToolGenerationFlowVertical` verso la nuova sezione Feedback — non è sufficiente solo rimuoverlo dal form.

> **Deduplicazione errori RHF vs `fileCompletion`**: nel codice as-is gli errori per file mancanti compaiono in due forme — errori RHF Zod per campo (`errors[fileEntry.key]?.message`) sotto ogni upload button, e `fileCompletion.missingRequiredFiles` come messaggio globale. Dopo il refactoring la **display** degli errori RHF per i file viene **soppressa completamente** (nessun `<span>` sotto i bottoni); la validazione Zod rimane attiva esclusivamente per bloccare il submit. La sezione Feedback usa `fileCompletion.missingRequiredFiles` come unica fonte per gli errori di file mancanti.

---

## 5. Fase completion

L'utente rimane sulla tool page per tutta la durata della generazione (non c'è batch BE: il processo è sincrono rispetto alla sessione). Al completamento il sistema reindirizza automaticamente alla `SessionSummaryDetailPage`.

Il Workflow Panel in completion **non mostra artefatti né link di download** — quello è responsabilità della session summary. Vedere wireframe COMPLETION in §3.

- Nessun link per artefatto, nessun download.
- Il testo "Apertura riepilogo sessione..." accompagna il redirect automatico.
- Il payload resta visibile come conferma dell'esito prima di uscire dalla pagina.
- La lista step è **completamente rimossa** anche in completion: non serve né per tracking (monitoring) né per accesso risultati (gestito da session summary).

---

## 6. Form semplificato (dopo refactoring)

```
┌──────────────────────────────────────────────────────┐
│  [Titolo tool]                                       │
│  [Sottotitolo]                                       │
├──────────────────────────────────────────────────────┤
│  [Project ▼]   [Model ▼]   [Tone ▼]                 │
├──────────────────────────────────────────────────────┤
│  [↑ Carica Brief]                                    │
│  [↑ Carica Angle Detector]  (se richiesto dal tool)  │
├──────────────────────────────────────────────────────┤
│  [ToolFileInstructionsSection accordion]             │
├──────────────────────────────────────────────────────┤
│  [dispatchError inline]  ← contratto architetturale  │
│  [CTA primaria]  [Azioni secondarie]                 │
└──────────────────────────────────────────────────────┘
```

I bottoni di upload non mostrano messaggi inline — né errori RHF Zod di campo né suggerimenti opzionali. La validazione RHF/Zod rimane attiva internamente per bloccare il submit (il bottone CTA viene disabilitato se i file obbligatori non sono validi), ma la **display** degli errori è soppressa dal form. Il testo degli errori viene surfacato esclusivamente nel Workflow Panel, nella sezione Feedback, usando `fileCompletion.missingRequiredFiles` come fonte (non gli errori Zod di campo).

---

## 7. Componenti impattati

| Componente | Modifica |
|---|---|
| `ToolGenerationFlowVertical.tsx` | Rimuovere `<StepRow>` lista e progress `N/totale`; aggiungere sezione `InputFilePayloadStatus` (DDD-082, sempre visibile) + barra indeterminata + testo rassicurazione in monitoring + sezione Feedback (`inline-action` channel, DDD-063) |
| `ToolGenerationFlowVerticalProps` | **Aggiungere**: `inputFilePayload: InputFilePayloadStatus[]` (DDD-082), `workflowPanelFeedback: WorkflowPanelFeedbackItem[]` (DDD-063). **Rimuovere**: `steps`, `completedStepsCount`, `totalStepsCount`, `briefingError`, `briefingGuidance`, `readinessReasonCodes`, `briefingFileName`, `briefingStatus` — tutte assorbite nelle due nuove props. |
| `ToolPageTemplate.tsx` | Rimuovere tutti i `<p className={uiPrimitives.error}>` e `<p className={uiPrimitives.metaLine}>` dal form (tranne `dispatchError`); rimuovere messaggi inline sotto i `Controller` file; derivare e passare `inputFilePayload` e `workflowPanelFeedback` a `ToolGenerationFlowVertical` |

---

## 8. Accessibilità

- Sezione Feedback (`inline-action` channel, DDD-063): `role="alert"` per errori, `role="status"` per info/warning.
- Sezione `InputFilePayloadStatus` (DDD-082): `aria-live="polite"` sulle transizioni di stato file.
- Barra indeterminata: `role="progressbar"` senza `aria-valuenow` (indeterminate), con `aria-label="Generazione in corso"`.
- Testo rassicurazione: `aria-live="polite"` per essere annunciato allo screen reader all'avvio della generazione.

---

## 9. Prossimi passi prima dell'implementazione

1. Confermare contratto `Dispatch Error` (DDD-061): rimane l'unico feedback inline nel Setup Panel.
2. Definire il type `WorkflowPanelFeedbackItem` (label, severity, source) seguendo la governance `Feedback Channel` (DDD-063) per la sezione Feedback del Workflow Panel.
3. Implementare derivation di `InputFilePayloadStatus[]` (DDD-082) in `ToolPageTemplate` da `fileCompletion` + `effectiveBriefingFileName` + `angleDetectorFileName`.
4. Aggiornare test snapshot di `ToolGenerationFlowVertical` con il nuovo prop set (`inputFilePayload`, `workflowPanelFeedback`).
5. Aprire task di implementazione con riferimento a questo documento e alle entry DDD-081, DDD-082.
