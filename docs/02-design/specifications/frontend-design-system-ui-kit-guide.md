---
status: active
version: 1.3
date_created: 2026-04-28
last-reviewed: 2026-05-11
next-review-date: 2026-08-11
owner: Frontend Platform Team
type: design-system-guide
---

# Frontend Design System e UI Kit Guide

> ⓘ **Design Document** — This guide covers visual language, design tokens, layout system, and UI components. It is orthogonal to the DDD domain model (no UL linkage required per governance policy). For domain-facing architecture, see [Frontend Tool Pages Architecture Spec](./frontend-tool-pages-architecture-spec.md).

Data: 2026-04-28  
Status: Active  
Versione: 1.3

## 1. Ruolo del documento

Questo documento e la fonte di verita per tutte le decisioni grafiche e visuali della GUI frontend.

Ambito coperto:

- visual language e direzione estetica
- design tokens (colori, tipografia, spacing, raggi, bordi, ombre)
- layout system e regole di composizione
- UI kit (componenti, varianti, stati e comportamento)
- micro-interazioni e feedback visivi
- regole di consistenza per nuove feature o refactor

Ambito non coperto:

- logica runtime/machine/backend
- contratti API e persistence

Governance complementare obbligatoria:

- Per vocabolario UI e archetipi pagina canonici, usare anche `frontend-ui-ubiquitous-language-spec.md`.
- Questa guida resta la fonte di verita visuale (token, componenti, look and feel); lo UI UL spec governa naming e composizione cross-page.

## 2. Visione visiva (Precision-Creative)

La GUI deve comunicare velocita, affidabilita tecnica e supporto creativo.

Direzione visiva:

- stile Professional Workspace su base chiara e neutra
- superfici stratificate leggere, bordi definiti e gerarchia leggibile
- accenti cromatici funzionali e sobri per stati e CTA

Keyword di riferimento:

- Affidabilita
- Chiarezza
- Controllo operativo
- Focus

## 3. Design tokens canonici

Nota aggiornamento 2026-04-28:

- il sistema token supporta esplicitamente tema light + dark tramite override su `:root[data-theme='dark']` in `apps/frontend/src/styles.css`.
- il cambio tema avviene senza transizioni CSS globali per coerenza UX.

Nota aggiornamento 2026-05-11 — MUI Theming Engine (v9):

- il sistema di theming è ora unificato e gestito interamente da MUI v9 tramite `cssVariables: true` + `colorSchemes: { light, dark }` in `apps/frontend/src/theme/theme.ts`.
- MUI scrive automaticamente le CSS custom properties sul selettore `[data-theme="%s"]`, allineandosi al selettore già presente in `styles.css`.
- il custom `ThemeProvider` applicativo è stato rimosso; l'unico provider attivo è `ThemeProvider` di `@mui/material` con `defaultMode="system"` in `App.tsx`.
- il toggle tema usa `useColorScheme` da `@mui/material` (hook nativo MUI v9); non espone più `useTheme` custom.
- la preferenza utente è persistita da MUI in `localStorage`; non è necessaria logica custom di storage.
- i CSS custom properties legacy in `styles.css` rimangono invariati: MUI li sincronizza tramite il `colorSchemeSelector`.

## 3.1 Colori

Palette primaria:

- Workspace Blue: #2563EB (azioni primarie, stati attivi)
- Canvas Light: #F6F8FB (fondi principali)
- Surface Steel: #E6EBF2 (card e superfici secondarie)
- Text Ink: #0F172A (testo primario e titolazioni)

Palette funzionale:

- Success Pine: #15803D (stati healthy/success)
- Alert Brick: #B42318 (errori, alert critici)
- Warning Amber: #B7791F (warning, draft, suggerimenti)

Regole:

- nessun colore hardcoded nei componenti quando esiste gia un token globale
- usare naming semantico (primary, surface, success, error, warning)
- mantenere contrasto AA minimo su testo e controlli interattivi
- evitare glow, gradienti aggressivi e contrasti eccessivi non funzionali al task

## 3.2 Tipografia

Font stack target:

- Headings e UI: IBM Plex Sans
- Body: Source Sans 3
- Mono: JetBrains Mono

Gerarchia tipografica di riferimento:

- H1: 32px, bold, letter-spacing -0.02em
- Body: 14px, regular, line-height 1.6
- Labels/meta: 12px, uppercase, bold

Regole:

- evitare font ad hoc per singola feature
- label e metadati devono restare compatti e consistenti
- stringhe tecniche, id e prompt devono usare font mono

## 3.3 Spacing, radius, border, shadow

Base system:

- 8-point grid system
- ogni spacing/padding/margin e multiplo di 8 o sottomultipli consistenti

Token geometrici:

- card radius: 12px
- button/input radius: 8px
- border: 1px con opacita bassa
- shadow: soft shadow, non invasiva

## 4. Layout system canonico

## 4.1 Layout pagina autenticata

Layout standard desktop:

- colonna 1: navigation
- colonna 2: main canvas

Layout mobile:

- stack verticale, navigation collassabile

## 4.2 Layout tool pages

Per le pagine tool il layout canonico e a doppia colonna interna:

- colonna sinistra: setup form (project, model, registry snapshot, briefing file, CTA)
- colonna destra: card di stato + step cards

Regole:

- colonne visivamente autonome
- nessuna card genitore ridondante che avvolga l'intera colonna destra
- CTA primaria posizionata sotto il blocco upload nella colonna sinistra

## 5. UI kit: componenti base

Il UI kit deve usare le primitive condivise e i token di classe centralizzati.

Riferimenti implementativi:

- `apps/frontend/src/app/ui/primitives.tsx` — token classi CSS condivisi
- `apps/frontend/src/styles.css` — CSS custom properties e override dark mode
- `apps/frontend/src/theme/theme.ts` — definizione tema MUI (CSS vars + colorSchemes)
- `apps/frontend/src/app/copy/system.ts` — copy centralizzato

Componenti core:

- Shell
- Surface
- Top bar
- Navigation link
- Button (primary/secondary/disabled)
- Input/select/textarea/file input
- Status line/meta line/error
- Card stato e card step tool
- Theme toggle icon-only (header utility action) — usa `useColorScheme` da `@mui/material`
- Artifact content toolbar (tabs `Markdown`/`Raw` + azione copy)

Regole di composizione:

- prima si riusa un componente/token esistente
- se manca, si introduce token condiviso prima dell'uso locale
- vietato introdurre naming CSS locale non generalizzabile

## 6. Stati visuali e feedback

Stati minimi obbligatori:

- idle
- running/streaming
- completed
- failed
- disabled

Pattern feedback:

- progress highlight sobrio su pannello attivo durante streaming
- conferme immediate su azioni rapide (copy, start, retry)
- dropzone evidenziata durante drag and drop file

Regola di consistenza toolbar contenuti artifact:

- i controlli `Markdown`, `Raw` e `Copia contenuto` condividono lo stesso sistema visivo di bottone (`size`, `border`, `radius`, `hover`, `active`, `disabled`).
- evitare pulsanti floating assoluti sopra i container contenuto quando e disponibile una toolbar strutturata in flusso layout.

## 7. Iconografia

Standard:

- librerie: Lucide o Phosphor
- stile: outline
- stroke: 1.5-2
- colore di default: eredita il testo
- hover/active: accent primary (Workspace Blue)

## 8. Accessibilita e quality gates visuali

Ogni intervento GUI deve verificare:

- contrasto testo/sfondo adeguato (WCAG AA)
- focus visibile per componenti interattivi
- leggibilita mobile e desktop
- coerenza con token e componenti del design system

Gate minimo tecnico:

- npm --prefix frontend run typecheck
- npm --prefix frontend run test

## 9. Regole di governance per modifiche GUI

Prima di modificare UI:

1. consultare questo documento
2. verificare se esiste gia un token/componente equivalente
3. aggiornare docs e index se cambia una regola canonica

In caso di conflitto tra documenti:

- per regole visuali prevale questo documento
- per dettagli architetturali tool pages prevale frontend-tool-pages-architecture-spec.md
- per contratti runtime/copy centralizzato si integra con frontend-spec.md

## 10. Checklist rapida per PR frontend GUI

- usa token esistenti (CSS custom properties da `styles.css` o palette MUI da `theme.ts`)
- non introduce classi locali ridondanti
- rispetta layout canonico a 2 colonne
- mantiene coerenza stato/feedback
- non introduce provider tema custom; usa esclusivamente `useColorScheme` per leggere/modificare il tema
- passa typecheck e test
- aggiorna documentazione se modifica regole canoniche