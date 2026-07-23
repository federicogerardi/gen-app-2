# PROMPT META ADS - ADS GENERATION (CLUSTER → ANGLE → AWARENESS SYSTEM)

## Step Key

- ads-generation

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Generate production-ready Meta Ads assets using the new cluster → angle → awareness system with user-controlled copy length formatting.

## Input

- Context-generation artifact
- User-selected copy length format: {{copy_length_format}}

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Output rules

- Markdown only.
- Italian only (`it-IT`).
- No JSON.
- No code fences.
- Use direct-response clarity with narrative storytelling.
- Incorporate spazi bianchi strategici for mobile readability in longer formats.

## Persona Assets — Critical Usage Rule

When persona assets are provided as input (e.g., buyer persona documents from personas-generator):
- Personas are **abstract reference profiles** used to understand the target audience. They are NOT real people and NOT the direct recipients of the ads.
- Use persona data to inform pain points, objections, triggers, and messaging tone — but treat personas as **archetypes**, not individuals.
- NEVER mention persona names (e.g., "Marco", "Giulia") in ad copy, headlines, descriptions, or any user-facing text.
- ALL ad copy must address an abstract "tu" — a generic member of the target profile. Example: "Sei un professionista che..." NOT "Marco è un professionista che...".
- NEVER write copy in third person about a persona. The copy speaks TO the reader, not ABOUT a fictional character.

## Copy Length Specifications

### SHORT FORM (400-600 caratteri)
- Primary text: 400-600 caratteri
- Hook entro primi 80 caratteri  
- 1 pain point principale + 1 benefit chiave
- CTA diretto senza troppo buildup
- Struttura: Hook → Problem → Solution → CTA

### MEDIUM FORM (800-1000 caratteri)
- Primary text: 800-1000 caratteri
- Hook entro primi 100 caratteri
- 2 pain points + 2 benefits con evidenza sociale  
- Storytelling contenuto ma persuasivo
- Struttura: Hook → Problem → Agitate → Solution → Proof → CTA

### LONG FORM (1200+ caratteri)
- Primary text: 1200+ caratteri minimum
- Hook entro primi 125 caratteri per preview mobile
- PAS completo con agitate forte e storytelling immersivo
- Evidenza sociale + autorità + urgenza + meccanismo unico
- Spazio bianco strategico ogni 3-4 righe per leggibilità mobile
- Struttura: Hook → Story Setup → Problem → Agitate → Solution → Proof → Mechanism → CTA

## Mandatory Contract

Per ogni CLUSTER identificato nel context-generation:
- Produrre tutti gli ANGOLI definiti per quel cluster
- Per ogni ANGOLO produrre esattamente 3 VERSIONI per awareness level:
  - **Problem Aware**: PAS completo (Problem-Agitate-Solve)
  - **Solution Aware**: Focus differenziazione competitiva  
  - **Product Aware**: Offerta diretta + prova sociale, PAS attenuato

## Required Output Structure

# Libreria Copy Meta Ads ({{copy_length_format}} format)

Schema: Cluster → Angolo → versioni declinate per livello di consapevolezza
Ogni Primary Text rispetta: {{copy_length_format}} specifications

Brand facts utilizzati in modo coerente: [Inserire brand facts dal Brand Facts Bank]

**Nota lunghezza {{copy_length_format}}:** [Guidance specifica per il formato selezionato]

---

## CLUSTER 1 — [Nome Cluster dal context-generation]

[Breve descrizione del cluster: chi sono, cosa desiderano]

### Angolo 1 — [Nome Angolo]

**› Versione Problem Aware (PAS pieno)**

**Primary Text**  
[Copy che rispetta le specifiche di lunghezza selezionate - includere spazi bianchi se Long Form]

**Headline:** [~40 caratteri]  
**Description:** [~30 caratteri]

**› Versione Solution Aware (peso sulla differenziazione)**

**Primary Text**  
[Copy che rispetta le specifiche di lunghezza selezionate]

**Headline:** [~40 caratteri]  
**Description:** [~30 caratteri]

**› Versione Product Aware (offerta + prova, PAS spento)**

**Primary Text**  
[Copy che rispetta le specifiche di lunghezza selezionate]

**Headline:** [~40 caratteri]  
**Description:** [~30 caratteri]

### Angolo 2 — [Nome Angolo]

[Ripetere struttura per ogni angolo del cluster]

---

## CLUSTER 2 — [Nome Cluster dal context-generation]

[Ripetere struttura per ogni cluster identificato]

---

## Targeting Suggestions per Cluster

**Cluster 1:**
- Interessi:
- Comportamenti:
- Demografia:
- Lookalike sources:

**Cluster 2:**
- Interessi:
- Comportamenti:
- Demografia:
- Lookalike sources:

## Visual Suggestions per Angolo

**Cluster 1 - Angolo 1:**
- Concept visivo:
- Elementi da includere:
- Tone emotivo:

**Cluster 1 - Angolo 2:**
- Concept visivo:
- Elementi da includere:
- Tone emotivo:

[Continue per tutti gli angoli]

## Psychological Triggers Matrix

**Cluster 1:**
- Primary triggers: [3 LF8 triggers più rilevanti]
- Secondary triggers: [Ulteriori trigger psicologici]

**Cluster 2:**
- Primary triggers: [3 LF8 triggers più rilevanti]
- Secondary triggers: [Ulteriori trigger psicologici]

## Quality Assurance Checklist

- [ ] Tutti i copy rispettano la lunghezza {{copy_length_format}} selezionata
- [ ] Hook posizionati entro i limiti caratteri per preview mobile  
- [ ] Brand facts utilizzati coerentemente across all copy
- [ ] Spazi bianchi inseriti strategicamente (Long Form only)
- [ ] Headlines e Descriptions entro limiti Meta Ads
- [ ] Compliance verificata per settore/industria
- [ ] CTA variano appropriatamente per awareness level
