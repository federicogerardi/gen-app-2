# Frontend Design System e UI Kit Guide

Data: 2026-04-26  
Status: Active  
Versione: 1.0

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

## 2. Visione visiva (Precision-Creative)

La GUI deve comunicare velocita, affidabilita tecnica e supporto creativo.

Direzione visiva:

- stile Neo-SaaS Minimalist su base dark
- superfici stratificate, bordi sottili, profondita morbida
- accenti cromatici netti per stati e CTA

Keyword di riferimento:

- Efficienza
- Modularita
- Scalabilita
- Ispirazione

## 3. Design tokens canonici

## 3.1 Colori

Palette primaria:

- Electric Violet: #8B5CF6 (azioni primarie, stati attivi)
- Deep Carbon: #0F172A (fondi principali)
- Slate Grey: #1E293B (card e superfici secondarie)

Palette funzionale:

- SEO Green: #10B981 (stati healthy/success)
- Media Red/Pink: #F43F5E (errori, alert critici)
- Copy Amber: #F59E0B (warning, draft, suggerimenti)

Regole:

- nessun colore hardcoded nei componenti quando esiste gia un token globale
- usare naming semantico (primary, surface, success, error, warning)
- mantenere contrasto AA minimo su testo e controlli interattivi

## 3.2 Tipografia

Font stack target:

- Headings e UI: Plus Jakarta Sans
- Body: Inter
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

- frontend/src/app/ui/primitives.tsx
- frontend/src/styles.css
- frontend/src/app/copy/system.ts

Componenti core:

- Shell
- Surface
- Top bar
- Navigation link
- Button (primary/secondary/disabled)
- Input/select/textarea/file input
- Status line/meta line/error
- Card stato e card step tool

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

- generative shimmer su pannello attivo durante streaming
- conferme immediate su azioni rapide (copy, start, retry)
- dropzone evidenziata durante drag and drop file

## 7. Iconografia

Standard:

- librerie: Lucide o Phosphor
- stile: outline
- stroke: 1.5-2
- colore di default: eredita il testo
- hover/active: accent primary (Electric Violet)

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

- usa token esistenti
- non introduce classi locali ridondanti
- rispetta layout canonico a 2 colonne
- mantiene coerenza stato/feedback
- passa typecheck e test
- aggiorna documentazione se modifica regole canoniche
