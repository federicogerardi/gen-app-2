# Frontend Design Artifact Canvas Snapshot - 2026-04-26

Status: Archived  
Tipo: Snapshot storico (superseded)

## Motivo archiviazione

Questo documento e stato superato dalla guida canonica di design system:

- `docs/specifications/frontend-design-system-ui-kit-guide.md`

La guida canonica e ora la fonte unica di verita per tutti gli interventi GUI frontend.

## Contenuto storico (originario da plan/feature-new-look.md)

# Specifiche Grafiche e di Layout: "Artifact Canvas"

Questa guida definisce il perimetro visivo per la web app di generazione artefatti marketing, mirata a un target di professionisti tra i 25 e i 35 anni. L'obiettivo e un'estetica **"Precision-Creative"**: pulita, tecnica ma con vibrazioni dinamiche.

## 1. Visione Creativa e Linguaggio Visivo

Il design deve comunicare velocita, intelligenza artificiale e collaborazione. Lo stile scelto e il **Neo-SaaS Minimalist**: un'evoluzione del flat design che utilizza profondita sottili (soft shadows), angoli arrotondati e accenti di colore neon su basi neutre.

- **Keywords:** Efficienza, Modularita, Scalabilita, Ispirazione.
- **Moodboard:** Interfaccia scura di default (Dark Mode), icone filiformi, micro-animazioni fluide.

## 2. Design Tokens: Colori e Luce

La palette e progettata per ridurre l'affaticamento visivo durante sessioni di lavoro prolungate, tipiche dei Media Buyer e SEO.

### Palette Primaria (Brand)

- **Electric Violet (#8B5CF6):** Colore dell'IA e dell'innovazione. Usato per azioni primarie e stati attivi.
- **Deep Carbon (#0F172A):** Sfondo principale della dashboard.
- **Slate Grey (#1E293B):** Colore per card e sezioni secondarie.

### Palette Funzionale (Target Specific)

- **SEO Green (#10B981):** Indicatore di salute (health scores, ranking, keyword strength).
- **Media Red/Pink (#F43F5E):** Per alert di budget, ROAS basso o stop campagne.
- **Copy Amber (#F59E0B):** Per suggerimenti creativi e bozze in lavorazione.

## 3. Tipografia (Lettering)

Il sistema tipografico privilegia la leggibilita dei dati densi senza sacrificare l'impatto visivo dei titoli.

- **Primary Font (Headings & UI):** Plus Jakarta Sans.
  - Un carattere geometrico moderno, giovane ed energico.
  - *Peso:* Bold per titoli, Medium per label.
- **Secondary Font (Body & Copy):** Inter.
  - Ottimizzato per schermi, perfetto per i lunghi testi dei copywriter.
- **Mono Font (Data & Prompts):** JetBrains Mono.
  - Usato per stringhe di prompt, coordinate SEO e codice script.

**Gerarchia:**

- H1: 32px / Bold / Letter-spacing: -0.02em
- Body: 14px / Regular / Line-height: 1.6
- Labels: 12px / Uppercase / Bold (per piccoli metadati)

## 4. Layout e Architettura dell'Informazione

L'interfaccia si basa su un sistema a pannelli flottanti per massimizzare l'area di lavoro (Canvas).

### La Griglia

- **8-Point Grid System:** Ogni elemento (padding, margin, altezza) deve essere multiplo di 8px.
- **Layout a 3 Colonne (Configurabile):**
  1. **Sidebar SX (Navigation):** Sottile, icone-only espandibile.
  2. **Main Center (Canvas/Output):** L'area dove viene generato l'artefatto.
  3. **Sidebar DX (Settings/Context):** Controlli specifici (es. Tone of Voice per copy, Audience per Media Buyer).

### Componenti UI Key

- **Corner Radius:** 12px per le card principali, 8px per i bottoni.
- **Borders:** 1px solid con opacita ridotta (rgba(255,255,255,0.1)).
- **Glassmorphism:** Usato esclusivamente per i menu a comparsa e i tooltip per dare profondita senza appesantire.

## 5. Perimetro Visivo degli Artefatti

Ogni tipologia di artefatto generato deve avere un "frame" distintivo:

- **Ads Preview:** Simulazione realistica dei feed (Meta, TikTok, Google) con toggle per dark/light mode.
- **SEO Report:** Visualizzazione a "blocchi" con grafici a linee pulite e gradienti sottili sotto le curve.
- **Copy Deck:** Interfaccia pulita tipo "Typewriter mode" per eliminare le distrazioni.

## 6. Micro-interazioni e Feedback

I professionisti digitali apprezzano la reattivita.

- **Generative State:** Quando l'IA lavora, mostrare un gradiente animato "shimmer" sui bordi del pannello interessato.
- **Copy-to-Clipboard:** Feedback visivo immediato (check verde che appare sul cursore).
- **Drag & Drop:** Zone di rilascio evidenziate con tratteggio neon quando un file viene trascinato sopra.

## 7. Iconografia

- **Stile:** Lucide Icons o Phosphor Icons.
- **Tratto:** 1.5pt o 2pt, non riempite (Outline).
- **Logica Colore:** Le icone seguono il colore del testo, tranne in stato di hover dove adottano il colore del brand (Electric Violet).
