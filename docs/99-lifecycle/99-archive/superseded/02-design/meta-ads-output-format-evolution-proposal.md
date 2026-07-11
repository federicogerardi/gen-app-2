---
goal: Evoluzione del formato output del tool meta-ads da sistema di 4 varianti per lunghezza a sistema cluster → angolo → awareness levels con controllo utente della lunghezza copy
version: 1.1
date_created: 2026-06-28
last_updated: 2026-07-11
last-reviewed: 2026-07-11
next-review-date: 2027-01-11
owner: Product Team
status: archived
tags: [proposal, meta-ads, tool-evolution, copy-generation, user-experience, archived]
archived_reason: Implementation completed and shipped via feature-meta-ads-cluster-system-evolution-1.md (all 21 tasks ✅ Completed). This proposal served as the approval basis; the cluster system is now live with legacy removed.
---

# PROPOSAL: Evoluzione Formato Output Tool Meta-Ads

## EXECUTIVE SUMMARY

Proposta di evoluzione del tool meta-ads da un sistema di **4 varianti per lunghezza** a un sistema **cluster → angolo → versioni per awareness**, con output long-form ottimizzato per Meta Ads moderne e **controllo utente della lunghezza del copy** attraverso input nel form del tool.

---

## SITUAZIONE ATTUALE

### Sistema di Output Corrente
- **3 varianti** (A, B, C) basate su awareness states
- **4 lunghezze** per variante: very_short (40-60), short (60-90), medium (90-120), long (120-200 parole)
- **Focus**: Variazioni di lunghezza dello stesso messaggio base
- **Limitazioni**: Copy brevi, approccio generico, scarsa personalizzazione per target specifici, lunghezza fissa non personalizzabile

### Architettura Tecnica Attuale
- **Workflow**: 2 step (context-generation → ads-generation)
- **Prompt principale**: `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md`
- **Struttura rigida** con 3×4 = 12 variazioni totali
- **Parsing deterministico** via `parseMetaAdsExtractionMarkdown`
- **Form input**: Nessun controllo lunghezza da parte dell'utente

---

## NUOVA VISIONE PROPOSTA

### Sistema Cluster → Angolo → Awareness + Controllo Lunghezza Utente

**STRUTTURA GERARCHICA:**
1. **CLUSTER**: Macro-categoria di target (es. "Persona Funzionale Insoddisfatta", "Rimandatario Ansioso")
2. **ANGOLO**: Strategia di comunicazione specifica (es. "La seconda vita della protesi mobile", "Tempo di recupero accelerato")  
3. **VERSIONI PER AWARENESS**: 3 declinazioni per livello di consapevolezza del problema
4. **CONTROLLO LUNGHEZZA**: Input utente per selezionare formato desiderato

**3 LIVELLI DI AWARENESS:**
- **Problem Aware**: PAS completo (Problem-Agitate-Solve)
- **Solution Aware**: Focus su differenziazione competitiva
- **Product Aware**: Offerta diretta + call-to-action, PAS attenuato

**3 OPZIONI DI LUNGHEZZA COPY (Controllo Utente):**
- **Short Form**: 400-600 caratteri - Per campagne quick-test e budget limitati
- **Medium Form**: 800-1000 caratteri - Bilanciamento tra narrativa e concisione
- **Long Form**: 1200+ caratteri - Storytelling completo e massima persuasione

### Caratteristiche Long-Form (Predefinito)
- **Primary Text**: ≥1200 caratteri (vs attuali 120-200 parole)
- **Struttura narrativa** con hook entro primi 125 caratteri
- **Spazio bianco strategico** per leggibilità mobile
- **Headline** (~40 caratteri) + **Description** (~30 caratteri)
- **Brand facts coerenti** distribuiti strategicamente

---

## CONTROLLO LUNGHEZZA COPY - SPECIFICA TECNICA

### Input Form - Nuova Sezione

**Posizione**: Dopo la sezione briefing/context, prima dell'avvio generazione

**UI Component**: Radio button group con preview caratteri

```typescript
interface CopyLengthOption {
  id: 'short-form' | 'medium-form' | 'long-form';
  label: string;
  description: string;
  characterRange: string;
  useCases: string[];
  recommended?: boolean;
}

const COPY_LENGTH_OPTIONS: CopyLengthOption[] = [
  {
    id: 'short-form',
    label: 'Short Form',
    description: 'Copy conciso per test rapidi e budget limitati',
    characterRange: '400-600 caratteri',
    useCases: ['A/B test iniziali', 'Campagne discovery', 'Budget ridotti']
  },
  {
    id: 'medium-form', 
    label: 'Medium Form',
    description: 'Equilibrio tra narrativa e concisione',
    characterRange: '800-1000 caratteri', 
    useCases: ['Campagne standard', 'Retargeting', 'Funnel intermedi'],
    recommended: true
  },
  {
    id: 'long-form',
    label: 'Long Form', 
    description: 'Storytelling completo per massima persuasione',
    characterRange: '1200+ caratteri',
    useCases: ['Cold audience', 'Prodotti complessi', 'High-ticket items']
  }
];
```

### Backend Prompt Integration

**Modifica a**: `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md`

```markdown
## CONTROLLO LUNGHEZZA OUTPUT

Lunghezza target selezionata dall'utente: {{copy_length_format}}

### Specifiche per formato:

**SHORT FORM (400-600 caratteri):**
- Primary text: 400-600 caratteri
- Hook entro primi 80 caratteri
- 1 pain point principale + 1 benefit chiave
- CTA diretto senza troppo buildup

**MEDIUM FORM (800-1000 caratteri):**  
- Primary text: 800-1000 caratteri
- Hook entro primi 100 caratteri
- 2 pain points + 2 benefits con evidenza sociale
- Storytelling contenuto ma persuasivo

**LONG FORM (1200+ caratteri):**
- Primary text: 1200+ caratteri minimum
- Hook entro primi 125 caratteri  
- PAS completo con agitate forte
- Evidenza sociale + autorità + urgenza
- Spazio bianco strategico per mobile
```

### Contracts Update

**Aggiunta a**: `/packages/contracts/src/tool-workflows.ts`

```typescript
interface MetaAdsInput {
  // ... existing fields
  copyLengthFormat: 'short-form' | 'medium-form' | 'long-form';
}

interface MetaAdsGenerationStep {
  // ... existing fields
  copyLengthFormat: 'short-form' | 'medium-form' | 'long-form';
}
```

---

## VANTAGGI STRATEGICI

### 1. **Maggiore Precisione di Target**
- **Cluster** permettono segmentazione psicografica profonda
- **Angoli** offrono messaggi altamente specifici per bisogno
- **Awareness levels** ottimizzano per stadio del customer journey

### 2. **Flessibilità Operativa**
- **Controllo lunghezza** permette adattamento a budget, obiettivi e audience
- **Short form** per test rapidi e discovery campaigns
- **Long form** per cold audiences e prodotti complessi
- **Medium form** come sweet spot per la maggior parte dei casi

### 3. **Performance Meta Ads Superiore**
- **Long-form copy** (1200+ caratteri) sfrutta algoritmo Meta 2024+
- **Narrative structure** aumenta engagement e riduce CPC
- **Hook ottimizzato** per preview mobile e desktop
- **Lunghezza personalizzata** per match con strategia campagna

### 4. **Scalabilità Organizzativa**
- **Template riutilizzabili** per cluster e angoli
- **Variazioni sistematiche** per awareness levels
- **Brand consistency** tramite fact bank centralizzato
- **Flusso decision-making** semplificato con controllo lunghezza

### 5. **ROI Misurabile**
- **A/B testing** strutturato (cluster vs angolo vs awareness vs lunghezza)
- **Attribution chiara** su quale elemento converte meglio
- **Ottimizzazione iterativa** basata su performance data
- **Cost efficiency** attraverso lunghezza ottimizzata per obiettivo

---

## IMPATTO TECNICO

### Modifiche Richieste

**PROMPT ENGINEERING:**
- Riscrittura completa di `prompt_ads_generation.md`
- Nuovo sistema di template cluster-based
- Logica awareness levels integrata
- **Controllo dinamico lunghezza** basato su input utente
- Guardrail per settori regolamentati (salute, finanza)

**DATA STRUCTURE:**
- Estensione schema output da 3×4 a N×M×3×3 (N cluster, M angoli, 3 awareness, 3 lunghezze)
- Nuovi campi: cluster_name, angle_name, awareness_level, copy_length_format, primary_text_formatted
- Backwards compatibility per API esistenti

**FRONTEND FORM:**
- Nuovo componente `CopyLengthSelector` in form meta-ads
- Integrazione con `useToolPage` per propagazione input
- Preview caratteri e use cases per ogni opzione
- Default su "Medium Form" con "recommended" badge

**UI/UX UPDATES:**
- Nuova navigazione gerarchica in `SessionArtifactTabs`
- Preview organizzata per cluster → angolo
- Export selettivo per awareness levels e lunghezza
- **Indicatore lunghezza** nei titoli degli output

### Rischi Tecnici Mitigati
- **Breaking changes**: Mantenere endpoint legacy in parallelo
- **Performance**: Chunking intelligente per output estesi  
- **Quality control**: Validation automatica lunghezza e struttura
- **User confusion**: Guidance chiaro su quando usare ogni formato

---

## ROADMAP IMPLEMENTAZIONE

### FASE 1: Foundation + User Control (Sprint 1-2)
- [ ] Analisi requirements dettagliata con stakeholders
- [ ] Design e implementazione `CopyLengthSelector` component
- [ ] Prototipo prompt system per 1 cluster + 2 angoli + 3 lunghezze
- [ ] Test A/B con copy attuale vs nuovo formato

### FASE 2: Core Development (Sprint 3-5)
- [ ] Riscrittura prompt_ads_generation.md con controllo lunghezza
- [ ] Aggiornamento parsing logic e data schemas per nuovo input
- [ ] Implementazione UI navigazione gerarchica
- [ ] Integrazione form input con backend workflow

### FASE 3: Quality & Scale (Sprint 6-7)
- [ ] Template library per cluster comuni (B2B, E-commerce, Health, etc.)
- [ ] Quality assurance automation con validation lunghezza
- [ ] Documentazione e training team su scelta lunghezza ottimale

### FASE 4: Launch & Optimize (Sprint 8)
- [ ] Rollout graduale con feature flag
- [ ] Monitoring performance vs baseline per ogni formato
- [ ] Iterazione basata su feedback utenti e performance data

---

## METRICHE DI SUCCESSO

### KPI Primari (per formato lunghezza)
- **CTR improvement**: 
  - Short Form: +10% vs copy attuali (focus su discovery)
  - Medium Form: +15% vs copy attuali (baseline)
  - Long Form: +25% vs copy attuali (cold audiences)
- **CPC reduction**: -15-25% tramite maggiore relevance per formato
- **Conversion rate**: +20-35% per lead qualificati

### KPI Operativi  
- **Time-to-market**: Riduzione 40% per campagne multi-formato
- **Brand consistency**: 95% compliance con terminologia aziendale
- **User satisfaction**: Score ≥4.5/5 per usabilità tool
- **Format adoption**: Distribuzione equilibrata tra i 3 formati

### KPI Tecnici
- **Generation time**: <45s per output completo (tutti cluster/angoli/formati)
- **Error rate**: <2% per parsing e validation
- **API backwards compatibility**: 100% per 6 mesi post-launch
- **Format validation**: 99% accuracy su caratteri target per formato

---

## DETTAGLIO IMPLEMENTAZIONE CONTROLLO LUNGHEZZA

### Frontend Implementation

**File da modificare**: `/apps/frontend/src/features/tools/meta-ads/pages/MetaAdsToolPage.tsx`

```typescript
// Nuovo componente per selezione lunghezza
const CopyLengthSelector: React.FC<{
  value: CopyLengthFormat;
  onChange: (value: CopyLengthFormat) => void;
}> = ({ value, onChange }) => {
  return (
    <FormSection title="Formato Copy" required>
      <RadioGroup value={value} onChange={onChange}>
        {COPY_LENGTH_OPTIONS.map(option => (
          <RadioOption 
            key={option.id}
            value={option.id}
            label={option.label}
            description={option.description}
            metadata={option.characterRange}
            useCases={option.useCases}
            recommended={option.recommended}
          />
        ))}
      </RadioGroup>
      <HelpText>
        Seleziona il formato più adatto alla tua strategia di campagna.
        Medium Form è consigliato per la maggior parte dei casi.
      </HelpText>
    </FormSection>
  );
};
```

**Integrazione con form esistente**:
- Posizionamento dopo briefing upload
- Validation required prima di submit
- Stato sincronizzato con `useToolPage`
- Preview real-time dei caratteri target

### Backend Validation

**File da modificare**: `/apps/backend/src/lib/runtime/request-contract.ts`

```typescript
const MetaAdsInputSchema = z.object({
  // ... existing validation
  copyLengthFormat: z.enum(['short-form', 'medium-form', 'long-form']),
});

// Validation logic per consistency
const validateCopyLength = (generated: string, format: CopyLengthFormat): boolean => {
  const ranges = {
    'short-form': [400, 600],
    'medium-form': [800, 1000], 
    'long-form': [1200, 2000]
  };
  
  const [min, max] = ranges[format];
  return generated.length >= min && generated.length <= max;
};
```

---

## CONCLUSIONI

La migrazione verso il sistema **cluster → angolo → awareness + controllo lunghezza** rappresenta un'evoluzione strategica che:

1. **Allinea il tool** alle best practices Meta Ads 2024+
2. **Aumenta la precisione** di targeting e messaging  
3. **Offre flessibilità operativa** attraverso controllo formato copy
4. **Migliora il ROI** attraverso copy ottimizzati per obiettivo e audience
5. **Scala l'efficienza** operativa del team marketing

Il **controllo utente della lunghezza** aggiunge un livello di personalizzazione critico, permettendo di:
- **Adattare il formato** a budget, timeline e obiettivi specifici
- **Ottimizzare per audience** (short per discovery, long per cold traffic)
- **A/B testare formati** in modo sistematico
- **Ridurre friction** nella scelta del copy appropriato

**Raccomandazione**: Procedere con Fase 1 per validazione empirica dell'approccio tramite test A/B controllati, con focus particolare sull'adoption del controllo lunghezza da parte degli utenti.

---

## APPENDICE: NUOVI PROMPT DI SOSTITUZIONE

Questa sezione contiene i prompt aggiornati da utilizzare in sostituzione di quelli attuali in `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/`.

### PROMPT_EXTRACTION.MD (Updated)

```markdown
# Deterministic Step Contract

## Step Key

- extraction

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Extract canonical Meta Ads context fields from the uploaded briefing sources, with focus on identifying cluster opportunities and angle candidates for the new cluster → angle → awareness system.

The extraction job is single-run. Do not split into multiple extraction jobs.

## Required input

- Briefing textual context
- Optional AngleDetector textual context

## Mandatory output rules

- Return markdown only.
- Return in English.
- Do not use code fences.
- Do not output JSON.
- Keep sections in the exact order below.
- If a field is not inferable, write exactly: "Not available from provided sources".

## Required output structure

## Product or Service
- ...

## Target Audience
- ...

## Campaign Objective
- ...

## Budget Context
- ...

## Primary Offer
- ...

## Proof Points
- ...

## Dominant Pain Points
- ...

## Objections
- ...

## Awareness Priority
- ...

## LF8 Priority
- ...

## Unique Mechanism
- ...

## Cluster Opportunities
- Persona-based clusters that could be targeted (e.g., "Functional Dissatisfied", "Anxious Procrastinator", "Quality Seeker")
- Psychographic segments with distinct pain points and motivations
- Behavioral patterns that suggest different messaging approaches

## Angle Candidates
- Specific communication strategies per cluster
- Unique positioning approaches based on audience segments
- Problem-solution narratives aligned with customer journey stages

## Missing
- ...

## Unclear
- ...
```

### PROMPT_CONTEXT_GENERATION.MD (Updated)

```markdown
# PROMPT META ADS - CONTEXT GENERATION

## Step Key

- context-generation

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Transform the extracted Meta Ads context into an activation-ready strategy canvas with cluster-based segmentation and angle development for the new format system.

## Input

- ExtractionContext generated by the extraction step.

## Output rules

- Markdown only.
- Italian only (`it-IT`).
- No JSON.
- No invented claims.
- Keep each recommendation tied to the extracted context.

## Required output structure

## Strategic Snapshot
- Product or service:
- Target audience:
- Campaign objective:
- Budget context:

## Target Clusters Identified
- Cluster 1: [Name and description]
  - Key characteristics:
  - Primary pain points:
  - Desired outcomes:
  - Messaging tone:

- Cluster 2: [Name and description]  
  - Key characteristics:
  - Primary pain points:
  - Desired outcomes:
  - Messaging tone:

- Cluster 3: [Name and description]
  - Key characteristics:
  - Primary pain points:
  - Desired outcomes:
  - Messaging tone:

## Messaging Angles per Cluster
### Cluster 1 Angles:
- Angle A: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware
  - Key differentiators:

- Angle B: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware  
  - Key differentiators:

### Cluster 2 Angles:
- Angle A: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware
  - Key differentiators:

- Angle B: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware
  - Key differentiators:

### Cluster 3 Angles:
- Angle A: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware
  - Key differentiators:

- Angle B: [Name and positioning]
  - Core narrative:
  - Awareness fit: Problem Aware / Solution Aware / Product Aware
  - Key differentiators:

## Brand Facts Bank
- Credibility markers:
- Social proof elements:
- Authority indicators:
- Trust signals:
- Unique value propositions:

## Objection Handling Matrix
- Objection:
  Counter-message:
  Required proof:

## Offer Positioning
- Core promise:
- Mechanism explanation:
- Risk reversal:

## Compliance Notes
- Regulatory considerations for the industry
- Claims that require substantiation
- Avoiding problematic language patterns
```

### PROMPT_ADS_GENERATION.MD (New System)

```markdown
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

## Output rules

- Markdown only.
- Italian only (`it-IT`).
- No JSON.
- No code fences.
- Use direct-response clarity with narrative storytelling.
- Incorporate spazi bianchi strategici for mobile readability in longer formats.

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
```

## Implementazione Prompt

### Modifiche ai File Esistenti

**1. Sostituire completamente:** `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_extraction.md`
- Aggiungere sezione "Cluster Opportunities" per identificazione cluster
- Ampliare "Angle Candidates" con focus su segmentazione

**2. Sostituire completamente:** `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_context_generation.md`  
- Nuova struttura "Target Clusters Identified"
- "Messaging Angles per Cluster" con awareness fit
- "Brand Facts Bank" centralizzato

**3. Sostituire completamente:** `/apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md`
- Sistema cluster → angolo → awareness
- Controllo dinamico lunghezza via `{{copy_length_format}}`
- Specifiche dettagliate per ogni formato (Short/Medium/Long)
- Output strutturato per navigazione gerarchica

### Variabili Template

I nuovi prompt utilizzano le seguenti variabili template che devono essere populate dal backend:

```typescript
interface PromptVariables {
  copy_length_format: 'short-form' | 'medium-form' | 'long-form';
  // Variabili esistenti mantengono compatibilità
}
```

### Backward Compatibility

Per garantire transition graduale:
- Mantenere prompt legacy con suffisso `_legacy.md`  
- Feature flag `USE_CLUSTER_SYSTEM` per switch
- Parsing dual-mode per supportare entrambi i formati
- Migration path automatico per sessioni esistenti