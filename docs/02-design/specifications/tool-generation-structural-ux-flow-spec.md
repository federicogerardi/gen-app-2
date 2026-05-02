---
goal: Descrizione strutturale e UX-flow del tool di generazione (as-is)
version: 1.0
date_created: 2026-04-25
date_updated: 2026-05-02
status: Active
tags: [ux, tool-generation, flow, setup, progress, checkpoint]
---

# Tool Generation: Struttura e UX Flow

## Obiettivo

Definire in modo strutturato il flusso UX dei tool di generazione attivi (HotLeadFunnel e NextLand), con focus su:

- campi input
- upload briefing
- sequenza azioni utente
- card unica di feedback avanzamento processo globale
- card per singolo step su avanzamento puntuale e preview output
- pulsanti per richiamo generazione da punti precedenti

## Ambito

Documento as-is basato sulla UI corrente in `frontend/src/features/tools/**` e runtime correlati (`frontend/src/features/generation/**`, `frontend/src/features/artifacts/**`).

## 1) Campi Input

### Campi obbligatori

- Progetto (`projectId`)
  - Selezione tramite dialog progetti.
  - Richiesto per abilitare upload briefing.

- Briefing file (`uploadedFileName` + contenuto estratto)
  - Formati supportati: `.docx`, `.txt`, `.md`.
  - Attiva pipeline upload -> extraction -> review.

### Campi facoltativi

- Modello (`model`)
  - Select LLM con default lato lista modelli disponibile.

- Tono (`tone`)
  - Select con hint contestuale.

- Note (`notes`)
  - Textarea opzionale visibile dopo `extraction ready`.
  - Usata come istruzione additiva pre-generazione.

## 2) Upload

### Regole di abilitazione

- Input file disabilitato quando:
  - nessun progetto selezionato
  - fase in `uploading` o `extracting`
  - generazione in corso

### Stati upload/extraction

- `idle`: nessun briefing caricato
- `uploading`: caricamento file in corso
- `extracting`: estrazione briefing in corso
- `ready`: contesto pronto, utente puo avviare generazione
- errore: esposto come messaggio nel form con possibilita di nuovo upload/reset

### Output dell'upload

- `extractionContext` popolato (briefing processabile)
- eventuale `uploadError` o `extractionError`
- abilitazione CTA primaria di generazione se precondizioni soddisfatte

## 3) Sequenza Azioni Utente

### Happy path

1. Utente apre tool (`/tools/funnel-pages` o `/tools/nextland`).
2. Seleziona progetto.
3. Carica briefing file.
4. Attende completamento upload + extraction.
5. (Opzionale) imposta modello, tono, note.
6. Avvia generazione con CTA primaria.
7. Osserva avanzamento globale e per-step.
8. Apre artefatti generati o rilancia generazione.

### Path con resume/regenerate

1. Utente arriva con `sourceArtifactId` e `intent` (`resume` o `regenerate`).
2. Tool precompila contesto recuperabile da artifact/checkpoint.
3. CTA primaria diventa contestuale:
   - `Riprendi dal checkpoint`
  - oppure `Rigenera`
4. Utente puo anche usare azioni secondarie (`Rigenera da zero`, `Resetta setup`, `Nuova generazione`).

## 4) Card Unica Feedback Avanzamento Globale

### Componente

- `ToolGenerationFlowVertical` (colonna destra unificata)

### Ruolo UX

- Rappresenta lo stato globale del processo in una sola card collassabile (`Stato rapido`).
- Mostra readiness operativa e blocchi senza richiedere lettura delle card step.

### Checklist globale visualizzata

1. Progetto selezionato
2. Briefing disponibile
3. Estrazione
4. Pronto a generare

### Semantica stato

- `todo` -> Da completare
- `active` -> In corso
- `done` -> Pronto
- `error` -> Bloccato

### Messaggi di supporto

- slot `Aggiornamento` per `retryNotice`
- slot `Aggiornamento` per `resumeNotice`

## 5) Card per Singolo Step (Avanzamento Puntuale + Preview)

### Componenti

- Gli step sono renderizzati dal flow unificato (`ToolGenerationFlowVertical`) con configurazione per tool (`funnel-pages`, `nextland`).

### Informazioni per card step

- Titolo step
- Stato step (`idle`, `running`, `done`, `error`) con badge
- Descrizione step
- Preview output (testo formattato, area scroll)
- Errore puntuale (se presente)
- CTA `Apri artefatto` quando esiste `artifactId`

### Comportamento preview

- Durante run: testo di avanzamento contestuale.
- A contenuto presente: preview leggibile del risultato.
- In assenza contenuto: messaggio `Nessun output ancora`.

## 6) Buttons per Richiamo Generazione da Punti Precedenti

Le azioni sono gestite da stato UI canonico (`useToolUiState`) e da orchestrazione `tool-page.machine`, variando in base a fase/intent/checkpoint.

### CTA primaria (dipendente da stato)

- `Riprendi dal checkpoint`
- `Carica nuovo briefing`
- `Rigenera`
- `Avvia generazione funnel` / `Avvia generazione NextLand`
- `Apri ultimo artefatto`

### CTA secondarie (richiamo da punti precedenti)

- `Riprendi da checkpoint`
  - disponibile in stati iniziali o resume senza briefing pronto

- `Riprova estrazione`
  - disponibile quando upload/estrazione espongono errore recuperabile

- `Rigenera da zero`
  - disponibile da stato pausato con checkpoint

- `Rigenera funnel` / `Rigenera NextLand`
  - disponibile a completamento con extraction ancora valida

- `Resetta setup` / `Nuova generazione`
  - reset del contesto operativo corrente

## 7) Mappa Sintetica Stato -> Azione

| Stato UI | CTA primaria | CTA secondarie tipiche |
|---|---|---|
| processing-briefing | Caricamento/Estrazione in corso | nessuna |
| running | Generazione in corso | nessuna |
| paused-with-checkpoint | Riprendi dal checkpoint | Rigenera da zero, Resetta setup |
| prefilled-regenerate | Rigenera | Resetta setup |
| draft-ready | Avvia generazione | Riprova estrazione, Resetta setup |
| completed | Apri ultimo artefatto | Rigenera, Nuova generazione |
| draft-empty | Completa dati obbligatori | Riprendi da checkpoint |

## 8) Considerazioni UX operative

- La separazione card globale + card step riduce ambiguita tra readiness di processo e stato output.
- Le CTA di richiamo evitano dead-end e consentono rientro rapido in flussi interrotti.
- Il gating progressivo (progetto -> upload -> extraction -> generation) previene errori input a valle.

## 9) Flow di Rigenerazione e Comportamento Sistema

### 9.1 Riprendi dal checkpoint dalla pagina artefatto

Entry point

- Nella pagina dettaglio artefatto, il sistema espone il bottone `Riprendi dal checkpoint` solo se esiste un checkpoint riusabile nel progetto associato.

Risoluzione disponibilita checkpoint

- Un checkpoint e considerato riusabile quando nello storico progetto esiste un artifact di tipo extraction con contenuto non vuoto e stato coerente con resume operativo.

Navigazione generata

- Click su `Riprendi dal checkpoint` -> redirect al tool target con query:
  - `sourceArtifactId`
  - `projectId`
  - `intent=resume`
  - `tone` (se presente in input artifact)
  - `notes` (se presente in input artifact)

Comportamento nel tool

- Il tool entra in modalita `resume`.
- Se recovery data e checkpoint sono validi, lo stato UI diventa `paused-with-checkpoint`.
- La CTA primaria diventa `Riprendi dal checkpoint` e riavvia la generazione dal contesto estratto gia disponibile.

### 9.2 Rigenera variante dalla pagina artefatto

Entry point

- Nella pagina dettaglio artefatto, il bottone `Rigenera variante` e sempre disponibile per workflow supportati (HotLeadFunnel, NextLand).
- Se presente anche resume, `Rigenera variante` resta come azione secondaria; altrimenti diventa primaria.

Navigazione generata

- Click su `Rigenera variante` -> redirect al tool target con query:
  - `sourceArtifactId`
  - `projectId`
  - `intent=regenerate`
  - `tone` (se presente)
  - `notes` (se presente)

Comportamento nel tool

- Il tool entra in modalita `regenerate` con prefill del contesto disponibile.
- Quando extraction e pronta, lo stato UI diventa `prefilled-regenerate`.
- La CTA primaria diventa `Rigenera` e avvia run completa di nuova variante.

### 9.3 Buttons del form reattivi alla richiesta di rigenerazione

Principio

- I bottoni del form non sono statici: vengono derivati da stato runtime (`phase`, `running`, `intent`, presenza briefing/checkpoint, esiti step).

Reattivita CTA primaria

- `processing-briefing` -> bottone disabilitato con label di caricamento/estrazione.
- `running` -> bottone disabilitato con label `Generazione in corso...`.
- `paused-with-checkpoint` -> `Riprendi dal checkpoint`.
- `prefilled-regenerate` -> `Rigenera`.
- `draft-ready` -> `Avvia generazione ...`.
- `completed` -> `Apri ultimo artefatto`.

Comportamento post-cancel durante `running`

- click su `Cancel` interrompe lo stream e porta lo stato in pausa con checkpoint locale dello step interrotto.
- la CTA primaria non deve tornare a `Avvia generazione` subito dopo cancel.
- la CTA primaria deve diventare `Riprendi dal checkpoint` finche il checkpoint interrotto non viene completato o resettato.
- click su `Riprendi dal checkpoint` rilancia dallo step interrotto, non dal primo step disponibile storico.
- il resume deve usare un nuovo `requestId` run-level per evitare collisioni/idempotency replay del run cancellato.

Reattivita CTA secondarie

- In base a intent e stato vengono mostrate solo azioni coerenti:
  - `Riprendi da checkpoint`
  - `Riprova estrazione`
  - `Rigenera da zero`
  - `Rigenera funnel` / `Rigenera NextLand`
  - `Resetta setup` / `Nuova generazione`

Effetto UX atteso

- L utente vede sempre una next action valida e contestuale alla richiesta iniziale (`resume` o `regenerate`), senza dead-end nel form.
- Nel caso di cancel manuale durante run, la next action valida e sempre `Riprendi dal checkpoint` fino alla ripresa effettiva.

---

## 10. Implementazione Tecnica

Questo documento specifica il flusso **UX e comportamento** del tool di generazione. Per la specifica tecnica dell'implementazione (architettura, pattern unificato, procedura per aggiungere nuovi tool), consultare:

**[Frontend Tool Pages Architecture (Unified)](./frontend-tool-pages-architecture-spec.md)**

Documenta:
- Architettura unificata per eliminare duplicazione tra tool page
- Registry pattern per configurazione tool-specifica
- ToolPageTemplate, derivation logic, composite hooks
- Step-by-step per aggiungere nuovo tool in ~30 minuti
- Type contracts e interfaces complete