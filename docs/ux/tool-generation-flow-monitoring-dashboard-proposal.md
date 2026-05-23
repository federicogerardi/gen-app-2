# UX Proposal - Tool Workspace Page: Generation Flow Monitoring Dashboard

**Date**: 2026-05-23
**Scope**: `ToolGenerationFlowVertical` + `ToolPageTemplate`
**Archetype**: Tool Workspace Page

## 1. Purpose

The current flow gives the user partial visibility during long-running extraction and generation. The proposal is to evolve the Workflow Panel into a real monitoring dashboard that answers three questions at any moment:

1. What is being processed right now?
2. Which files are already included in the payload?
3. How far has generation progressed, step by step?

This proposal keeps the Tool Workspace Page archetype intact and extends the Workflow Panel into a stateful monitor instead of a mostly passive status block.

## 2. JTBD

**Job statement**

When I start a tool run and wait several minutes for extraction or generation, I want to understand what the system is doing, which files are actually in the payload, and how many steps are already completed, so I can trust the run and avoid unnecessary refreshes or duplicate attempts.

**Current solution and pain points**

- Extraction has no clear progress bar.
- Uploaded file names are not always visible in the monitoring area.
- Generation progress is not shown as a clear `N/N` count.
- The user cannot reliably tell whether the system is still working or has stalled.
- The panel currently behaves like a status summary, not a dashboard.

## 3. Persona

- **Role**: tool operator creating content with a guided workflow.
- **Context**: desktop-first, long-running task, frequent status checking.
- **Goal**: keep confidence in the run while waiting for backend processing.
- **Success metric**: the user can always answer what is running, what is done, and what remains.

## 4. Proposal Overview

The Workflow Panel should become a three-layer dashboard:

1. **Payload layer** - always visible and frozen once the run starts.
2. **Progress layer** - phase-specific progress feedback for extraction and generation.
3. **Step layer** - generation step advancement with explicit `N/N` and current step focus.

The Setup Panel remains the input surface. The Workflow Panel becomes the monitoring surface.

## 5. Proposed Dashboard Structure

### 5.1 Payload Layer

Show the files included in the current payload directly in the Workflow Panel.

Required behavior:

- display the attached file names
- display file state for each payload file
- keep the payload visible during extraction, generation, and completion
- freeze the payload state once the run starts, so the user can verify what was actually submitted

Recommended copy:

- `Payload caricato`
- `BriefingFile: relazione-q1.pdf`
- `Angle Detector: personas.xlsx`
- `File opzionale: non caricato`

### 5.2 Extraction Progress Layer

During extraction, show a progress bar instead of a static status label.

Recommended behavior:

- if the backend exposes a measurable percentage, render a determinate progress bar
- if the backend only exposes sub-states, render a staged progress bar with phases such as `caricamento`, `estrazione`, `normalizzazione`, `pronto`
- keep the file list visible while extraction runs
- pair the bar with a short status sentence such as `Estrazione in corso`
- when extraction completes and a `SessionSummary` is available, surface a secondary CTA that opens `/sessionsummary/{sessionId}` for immediate review of the generated session

This solves the biggest trust gap in the current flow: the user needs evidence that the system is doing work even before generation starts.

### 5.3 Generation Progress Layer

During generation, show explicit advancement as `N/N`.

Recommended behavior:

- show a progress counter like `3/5`
- show the current step label next to the counter
- show completed steps as done, the active step as running, and future steps as pending
- keep the counter visible even if the user does not expand step details
- at the handoff between two steps, allow a brief enabled state before the next step dispatch disables the form again, so the user perceives the boundary between one completed step and the next step starting

This gives the user a compact answer to the question: how much of the flow has actually finished?

### 5.4 Step Layer

The dashboard should still support step-level visibility, but in a more compact way than a full list of standalone rows.

Recommended presentation:

- horizontal or vertical step rail
- one active step highlight
- completed steps collapsed into compact marks
- failed step exposed with an inline error state

This retains detail without reintroducing the heavy checklist feel.

### 5.5 Completion Achievement State

The completion phase should feel like an achievement, not a silent state change.

Recommended presentation:

- stronger visual emphasis on the completed state
- larger success headline with clear confirmation copy
- success accent treatment that is more prominent than the running state
- lightweight celebratory styling, but still consistent with the tool workspace visual language

The goal is to make completion feel intentional and finite, so the user recognizes that the run has reached a meaningful milestone.

## 6. Phase Behavior

### Extraction phase

- show payload files and file names
- show extraction progress bar
- do not show generation step counters yet
- keep setup feedback in the Setup Panel only when it is truly input-related

### Generation phase

- keep the payload visible as a frozen confirmation anchor
- show `N/N` advancement for the full flow
- expose the current step label and status
- keep the active step easy to scan at a glance

### Completion phase

- freeze the completed state with stronger achievement styling
- keep the payload visible until navigation to session summary
- show a clear completion message and session handoff
- after completion, reset the form to a blank ready-to-start state so the CTA returns to `Avvia estrazione` and the tool is immediately ready for a new cycle

## 7. Design Principles

1. **Trust through visibility**: show payload, phase, and progress together.
2. **One dashboard, one job**: the Workflow Panel monitors the run; the Setup Panel configures it.
3. **State over noise**: avoid scattering file and progress feedback across multiple places.
4. **Phase-sensitive detail**: show extraction progress when extracting, show `N/N` when generating.
5. **Stable confirmation**: the payload should not disappear after dispatch.
6. **Reset after finish**: the workspace returns to a clean starting state after completion, instead of keeping a completed CTA as the dominant action.

## 8. Accessibility Requirements

- progress bars must expose accessible labels and live announcements
- file status changes must be announced with polite live regions
- step status must not rely on color alone
- completion and error states must be readable by screen readers without requiring visual inspection

## 9. Acceptance Criteria

The proposal is successful if the user can always see:

1. which files were submitted
2. whether extraction is still moving
3. how many generation steps are complete
4. which step is currently active
5. whether the flow is blocked, failed, or finished
6. a clear handoff CTA to the generated SessionSummary when extraction completes and the sessionId exists
7. a reset-to-blank state after generation completion, with the primary CTA back to `Avvia estrazione`

## 10. Implementation Notes

- Keep `DispatchError` inline in the Setup Panel.
- Avoid duplicating the same message in both panels.
- Treat extraction and generation as different monitoring modes.
- Make the completion state visually stronger than the running state, but do not change the primary post-completion action away from the restart path.
- If the flow evolves, update DDD governance before introducing new canonical terms.

### 10.1 Refactoring Touchpoints

This proposal is grounded in the current refactoring surface:

- [ToolGenerationFlowVertical](../../apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx) — Workflow Panel composition and state projection.
- [ToolGenerationFlowVertical tests](../../apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx) — behavioral coverage for the preload bar and status copy.
- [Status naming guard](../../apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.status-naming.guard.test.ts) — static drift guard for `completed` vs `done` naming.
- [Global styles](../../apps/frontend/src/styles.css) — preload bar visual variants and completion styling.
- [Naming decision log](../../docs/07-governance/domain-naming-decision-log.md) — DDD-084 and DDD-085 governance for the Workflow Panel split.
- [Source-of-truth spec](../../docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md) — contract alignment for `ToolGenerationFlowVertical`.
- [Refactor plan](../../plan/refactor-tool-workspace-workflow-panel-unified-1.md) — implementation sequence that introduced the panel simplification.

## 11. Screen-by-Screen Wireframes

Legenda simboli usati nei wireframe:

```
[  ]   bottone o controllo cliccabile
(  )   select / dropdown
●      radio o stato attivo
○      stato inattivo / pending
✓      completato
⟳      in esecuzione / animato
✕      errore
░░░    barra indeterminata animata
████   barra piena completata
─      separatore visivo
```

La pagina ha sempre due colonne: **SETUP PANEL** (sinistra) e **WORKFLOW PANEL** (destra).

---

### S1 — Stato iniziale: draft-empty

*Nessun progetto selezionato, nessun file caricato. CTA disabilitata.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│  Genera il tuo funnel...        │  Nessun progetto selezionato         │
│                                 │                                      │
│  Progetto                       │                                      │
│  [  Seleziona progetto...  ▼ ]  │                                      │
│                                 │                                      │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │                                      │
│                                 │                                      │
│  [ ↑  Carica Brief ]            │                                      │
│                                 │                                      │
│  ─────────────────────────────  │                                      │
│  [ Avvia estrazione  ░ ]        │                                      │
│  ← CTA disabilitata             │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S2 — Progetto selezionato, attesa file

*Progetto impostato. L'upload button è attivo. Il Workflow Panel mostra il progetto.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │                                      │
│                                 │                                      │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │                                      │
│                                 │                                      │
│  [ ↑  Carica Brief ]            │                                      │
│                                 │                                      │
│  ─────────────────────────────  │                                      │
│  [ Avvia estrazione  ░ ]        │                                      │
│  ← CTA disabilitata             │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S3 — File caricato, estrazione non ancora avviata

*Brief selezionato, ma estrazione non ancora avviata. CTA abilitata.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD                             │
│                                 │  ○  Brief              relazione.pdf │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │                                      │
│                                 │                                      │
│  [ ↑  relazione.pdf  ✕ ]        │                                      │
│  ← file selezionato             │                                      │
│                                 │                                      │
│  ─────────────────────────────  │                                      │
│  [ Avvia estrazione ]           │                                      │
│  ← CTA abilitata                │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S4 — Fase estrazione in corso: processing-briefing

*CTA premuta. Estrazione attiva. Form disabilitato. Dashboard mostra progresso staged.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.      ▼ ]  ░░   │  PAYLOAD                             │
│  ← disabilitato                 │  ⟳  Brief       relazione.pdf        │
│                                 │                                      │
│  Modello        Tono            │  ─────────────────────────────────── │
│  ( auto ▼ ) ░  ( Professionale) │                                      │
│  ← disabilitati                 │  ESTRAZIONE                          │
│                                 │  caricamento ──── estrazione ── pronto│
│  [ ↑  relazione.pdf  ✕ ]  ░░   │  ●──────────────○──────────○         │
│  ← disabilitato                 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ←animato
│                                 │                                      │
│  ─────────────────────────────  │  Estrazione in corso...              │
│  [ Avvia estrazione  ░ ]        │                                      │
│  ← disabilitata                 │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S5 — Estrazione completata: draft-ready

*Estrazione OK. ExtractionContext pronto. Form torna abilitato. CTA → Avvia generazione.*
*Se sessionId disponibile, compare CTA secondaria verso sessione.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD                             │
│                                 │  ✓  Brief              relazione.pdf │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │  ─────────────────────────────────── │
│                                 │                                      │
│  [ ↑  relazione.pdf  ✕ ]        │  ESTRAZIONE                          │
│                                 │  caricamento ── estrazione ── pronto │
│                                 │  ●──────────────●──────────●         │
│  Note (opzionale)               │  ████████████████████████████ ←piena │
│  [                          ]   │                                      │
│                                 │  Pronto per la generazione           │
│  ─────────────────────────────  │                                      │
│  [ Avvia generazione ]          │  [ Apri sessione → ]  ← CTA secondaria│
│  ← CTA abilitata                │  ← solo se sessionId disponibile     │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S6 — Generazione in corso: running (step 1 di 3)

*Generazione avviata. Form disabilitato. Dashboard mostra passo corrente e contatore N/N.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.      ▼ ]  ░░   │  PAYLOAD  (congelato)                │
│                                 │  ✓  Brief              relazione.pdf │
│  Modello        Tono            │                                      │
│  ( auto ▼ ) ░  ( Professionale) │  ─────────────────────────────────── │
│                                 │                                      │
│  [ ↑  relazione.pdf  ✕ ]  ░░   │  GENERAZIONE  1 / 3                  │
│                                 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ←animato
│  Note (opzionale)               │                                      │
│  [                     ]  ░░   │  ⟳  Optin Page                       │
│                                 │     In esecuzione...                 │
│  ─────────────────────────────  │                                      │
│  [ Annulla generazione ]        │  STEP                                │
│                                 │  ⟳  Optin Page       ← attivo        │
│                                 │  ○  VSL                              │
│                                 │  ○  Landing Page                     │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S7 — Step boundary: step 1 completato, step 2 non ancora avviato

*Micro-finestra di re-enable: form torna abilitato per un istante. L'utente percepisce il confine tra step.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD  (congelato)                │
│  ← abilitato (momentaneo)       │  ✓  Brief              relazione.pdf │
│                                 │                                      │
│  Modello        Tono            │  ─────────────────────────────────── │
│  ( auto   ▼ )  ( Professionale) │                                      │
│  ← abilitati (momentaneo)       │  GENERAZIONE  1 / 3  →  2 / 3        │
│                                 │  ─────────────────────────────────── │
│  Note (opzionale)               │                                      │
│  [                          ]   │  STEP                                │
│  ← abilitato (momentaneo)       │  ✓  Optin Page       ← completato    │
│                                 │  ○  VSL              ← in partenza    │
│  ─────────────────────────────  │  ○  Landing Page                     │
│  [ Avvia generazione ]          │                                      │
│  ← visibile momentaneamente     │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

> Il form torna immediatamente disable al lancio dello step successivo (→ S6 per step 2).

---

### S8 — Generazione in corso: running (step 2 di 3)

*Il ciclo continua identico a S6 ma con contatore aggiornato.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  [... identico a S6 ...]        │  GENERAZIONE  2 / 3                  │
│                                 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│                                 │                                      │
│                                 │  ⟳  VSL                              │
│                                 │     In esecuzione...                 │
│                                 │                                      │
│                                 │  STEP                                │
│                                 │  ✓  Optin Page                       │
│                                 │  ⟳  VSL              ← attivo        │
│                                 │  ○  Landing Page                     │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S9 — Completamento: completed (achievement state)

*Tutti gli step completati. Enfasi visiva forte. Form resettato a blank, pronto per un nuovo ciclo.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD                             │
│  ← abilitato, pronto            │  ✓  Brief              relazione.pdf │
│                                 │                                      │
│  Modello        Tono            │  ─────────────────────────────────── │
│  ( auto   ▼ )  ( Professionale) │                                      │
│                                 │  ████████████████████████████ ←verde │
│  [ ↑  Carica Brief ]            │                                      │
│  ← reset: nessun file           │  ✓  GENERAZIONE COMPLETATA           │
│                                 │     3 / 3  step completati           │
│  Note (opzionale)               │                                      │
│  [                          ]   │  STEP                                │
│                                 │  ✓  Optin Page                       │
│  ─────────────────────────────  │  ✓  VSL                              │
│  [ Avvia estrazione  ░ ]        │  ✓  Landing Page                     │
│  ← reset al ciclo iniziale      │                                      │
│                                 │  ─────────────────────────────────── │
│                                 │  [ Apri sessione →  ]                │
│                                 │  ← CTA primaria handoff              │
└─────────────────────────────────┴──────────────────────────────────────┘
```

> La barra è piena e verde. Il titolo "GENERAZIONE COMPLETATA" è più grande degli stati intermedi.
> Il Setup Panel è già resettato: nessun file caricato, CTA tornata a `Avvia estrazione`.
> La CTA `Apri sessione` nel Workflow Panel porta a `/sessionsummary/{sessionId}`.

---

### S10 — Errore su step intermedio: paused-with-checkpoint

*Uno step ha fallito. Feedback nella dashboard. CTA → Riprendi dal checkpoint.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD  (congelato)                │
│                                 │  ✓  Brief              relazione.pdf │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │  ─────────────────────────────────── │
│                                 │                                      │
│  [ ↑  relazione.pdf  ✕ ]        │  GENERAZIONE  1 / 3  ← bloccata      │
│                                 │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ ← in pausa    │
│  Note (opzionale)               │                                      │
│  [                          ]   │  ✕  Errore su VSL                    │
│                                 │     Timeout di connessione.          │
│  ─────────────────────────────  │                                      │
│  [ Riprendi dal checkpoint ]    │  STEP                                │
│  [ Rigenera da zero ]           │  ✓  Optin Page                       │
│                                 │  ✕  VSL              ← errore        │
│                                 │  ○  Landing Page                     │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### S11 — Errore estrazione

*Estrazione fallita. Form torna abilitato. Errore nella dashboard. CTA → Avvia estrazione.*

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│  SETUP PANEL                    │  WORKFLOW PANEL                      │
├─────────────────────────────────┼──────────────────────────────────────┤
│  Hotlead Funnel                 │  Progetto                            │
│                                 │  Acme S.r.l.                         │
│  Progetto                       │                                      │
│  [  Acme S.r.l.           ▼ ]  │  PAYLOAD                             │
│                                 │  ✕  Brief              relazione.pdf │
│  Modello        Tono            │                                      │
│  ( auto   ▼ )  ( Professionale) │  ─────────────────────────────────── │
│                                 │                                      │
│  [ ↑  relazione.pdf  ✕ ]        │  ESTRAZIONE                          │
│  ← rimuovi e ricarica           │  caricamento ── estrazione           │
│                                 │  ●──────────────✕                    │
│                                 │                                      │
│  ─────────────────────────────  │  ✕  Estrazione non riuscita.         │
│  [ Avvia estrazione ]           │     Verifica il formato del file.    │
│  ← CTA abilitata (riprova)      │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

### Mappa delle transizioni tra schermate

```
S1 ──[seleziona progetto]──────────────────────────────────▶ S2
S2 ──[seleziona file]──────────────────────────────────────▶ S3
S3 ──[Avvia estrazione]────────────────────────────────────▶ S4
S4 ──[estrazione OK]───────────────────────────────────────▶ S5
S4 ──[estrazione fallita]──────────────────────────────────▶ S11
S11 ─[Avvia estrazione, riprova]───────────────────────────▶ S4
S5 ──[Avvia generazione]───────────────────────────────────▶ S6
S6 ──[step N completato]───────────────────────────────────▶ S7 (micro)
S7 ──[step N+1 avviato]────────────────────────────────────▶ S6 (step N+1)
S6 ──[ultimo step completato]──────────────────────────────▶ S9
S6 ──[step fallito]────────────────────────────────────────▶ S10
S9 ──[reset automatico form]───────────────────────────────▶ S2 (nuovo ciclo)
S9 ──[Apri sessione]───────────────────────────────────────▶ /sessionsummary/{sessionId}
S10 ─[Riprendi dal checkpoint]─────────────────────────────▶ S6 (step fallito)
S10 ─[Rigenera da zero]────────────────────────────────────▶ S6 (step 1)
```

## 12. Suggested Next Step

Portare i wireframe in Figma come frame per stato, poi definire il contratto runtime che alimenta:

- payload file list
- extraction progress state
- generation `N/N` counter
- active step metadata
