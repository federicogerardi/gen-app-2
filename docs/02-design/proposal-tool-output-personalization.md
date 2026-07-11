---
status: draft
version: 1.1
date_created: 2026-07-11
last-reviewed: 2026-07-11
next-review-date: 2026-10-11
owner: Frontend Platform Team
type: proposal
tags: [personalization, tools, ux, generation, variants, feedback]
goal: Improve output personalization, variety, and effectiveness scalability across all 8 generation tools
---

# Proposal: Tool Output Personalization

## 1. Executive Summary

Tutti gli 8 tool implementati (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `meta-ads`, `youtube-description`, `geometric`, `blog-article-generator`) condividono lo stesso limite architetturale: producono un unico output deterministico dato un set di input. Non esiste:

- **Generazione varianti**: sempre 1 risultato, nessuna possibilità di scelta
- **Profilo utente persistente**: tone, stile, preferenze perse tra sessioni
- **Feedback loop**: nessun apprendimento da generazioni passate
- **Controllo creatività**: temperature/creativity slider assente
- **Template system**: configurazioni non salvabili/riusabili

Questa proposta definisce un layer di personalizzazione cross-tool più miglioramenti specifici per-tool, organizzati su tre assi: **customizzazione**, **varietà**, **scalabilità di efficacia**.

## 2. Common Infrastruttura Cross-Tool

Prima dei miglioramenti per-tool, servono quattro layer orizzontali.

Ognuno richiede un DDD-NNN nel Decision Log prima della propagazione (vedere §9).

### 2.1 UserTasteProfile (DDD-160)

Profilo persistente caricato all'apertura del tool page e usato come default prefill.

```ts
type UserTasteProfile = {
  userId: string;
  preferredTone: ToneProfile | null;
  preferredModel: LlmModelId | null;
  perTool: Partial<Record<ToolKey, {
    lastSettings: Record<string, unknown>;      // ultime scelte per tool
    preferredPatterns: Record<string, string>;  // es. hookApproach, visualStyle
    generationCount: number;
    positiveFeedbackCount: number;
  }>>;
};
```

**Implementazione**:
- Nuova tabella `user_taste_profile` in infra-db
- Backend: `GET /api/user/profile/taste`, `PATCH /api/user/profile/taste`
- Frontend: `useUserTasteProfile()` hook, merge con form defaults in `useToolForm`

### 2.2 VariantGenerationMode (DDD-161)

Ogni tool espone in Setup Panel un controllo "Numero varianti" (1–5, default 1).

Quando >1:
- FE genera N run parallele con `requestId` + `seed` diversi
- Backend accetta `variantSeed?: number` in GenerationRequest (nuovo campo opzionale)
- I risultati sono presentati in una comparison view (tabs / side-by-side / carosello)
- L'utente seleziona la migliore come "finale"
- La selezione è registrata come feedback implicito

```ts
// Nuovo campo in GenerationRequest
type GenerationRequestInput = {
  // ...esistenti
  variantSeed?: number;        // 0..N per generazioni multiple
  variantTotal?: number;       // N totale, per logging
};
```

### 2.3 FeedbackCollector / GenerationFeedback (DDD-162)

Dopo `completed`, la Workflow Panel mostra un micro-feedback:

> "Questo risultato ti è utile?" 👍 👎 "Segnala preferenze"

Il clic su 👍/👎 invia `POST /api/user/profile/feedback` con:
```ts
type GenerationFeedback = {
  userId: string;
  toolKey: ToolKey;
  sessionId: string;
  artifactId: string;
  rating: 'positive' | 'negative';
  appliedSettings: Record<string, unknown>;  // snapshot dei parametri usati
};
```

### 2.4 Template System / UserToolTemplate (DDD-163)

Ogni tool espone un pulsante "Salva configurazione come template" che serializza:
- Tutti i campi del form (direct input + extraction fields)
- Le impostazioni di personalizzazione (style, format, varianti)
- Un nome utente e descrizione opzionale

I template sono salvati su DB (`user_tool_templates`), caricabili da una sezione "I tuoi template" nella Setup Panel.

---

## 3. Per-Tool Analysis

### 3.1 funnel-pages — DDD-169 (VisualStyle, ConversionGoal, PageLength, HookStrategy)

**Stato**: optin → quiz → vsl, 5 extraction fields, single-file upload.

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `visualStyle` | select | minimal, bold, corporate, playful, luxury |
| Customization | `conversionGoal` | select | lead-capture, webinar-reg, free-trial, direct-sales |
| Customization | `pageLength` | select | squeeze-page, standard, long-form-story |
| Customization | `leadMagnetType` | string (opzionale) | descrizione del lead magnet da includere |
| Varietà | `variantCount` | number (1-5) | N landing con angle/messaging diversi |
| Varietà | `hookStrategy` | select | P-A-S, story, social-proof, curiosity, direct |
| Scalabilità | Per `conversionGoal + visualStyle`, salva le combinazioni con feedback positivo | — | template consigliati per settore |

### 3.2 nextland — DDD-170 (SitePersonality, NavigationStyle, ComponentLibrary)

**Stato**: landing → thank_you, 5 extraction fields, single-file upload.

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `sitePersonality` | select | luxury, startup, educational, e-commerce, local-business, portfolio |
| Customization | `navigationStyle` | select | single-page, multi-page, sticky-cta, hamburger |
| Customization | `seoKeywords` | string[] | keywords target per pagina |
| Varietà | `sectionAlternatives` | pre-generation step | genera 2-3 strutture sito, utente sceglie prima della generazione full |
| Varietà | `componentLibrary` | checkboxes | hero, proof, FAQ, pricing, testimonial, blog-preview, CTA |
| Scalabilità | Per `sitePersonality + target_audience`, pesa i pattern migliori | — | il sistema impara il setup vincente per verticale |

### 3.3 youtube-lf-script — DDD-171 (VideoFormat, HookApproach, CtaDensity, RetentionPattern)

**Stato**: 6 step (pre-script-analysis → packaging → intro → body → CTA-embeds → outro), 8 extraction fields.

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `videoFormat` | select | solo-talking-head, interview, screen-share, hybrid, voiceover-broll |
| Customization | `hookApproach` | select | question-hook, statistic-hook, story-hook, contrarian, curiosity-gap |
| Customization | `ctaDensity` | select | single-soft, single-hard, multiple, none |
| Customization | `retentionPattern` | select | loop-recap, ladder, spiral, sandwich |
| Varietà | `generateHooksFirst` | pre-generation step | 5 hook, utente sceglie, poi script completo |
| Varietà | `introVariants` | number (1-3) | genera N intro alternative dallo stesso body |
| Varietà | `angleVariants` | number (1-3) | stesso brief, script con angle diversi |
| Scalabilità | Per `avatar + topic`, raccomanda hookApproach e retentionPattern | — | coaching di retention per creator |

**Strategy**: `generateHooksFirst` è il cambiamento a più alto impatto: una lightweight pre-call genera 5 hook, utente seleziona, il full script inietta quell'hook in intro-structure e packaging. `videoFormat` condiziona tutti gli step (es. `interview` genera body come Q&A flow invece di monologo).

### 3.4 angle-generator — DDD-172 (Channel, BrandVoice, AnglesToAvoid, CreativitySlider)

**Stato**: context-and-angle-matrix → angle-prioritization → creative-activation, 7 extraction fields.

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `channel` | select | meta, google, linkedin, tiktok, email, organic, youtube |
| Customization | `brandVoice` | select | authoritative, friendly, disruptive, educational, empathetic |
| Customization | `anglesToAvoid` | string[] | angle già usati o non compatibili col brand |
| Customization | `angleCount` | number (5-30) | quante generare |
| Varietà | `contentTypeMapping` | checkboxes | per ogni angle prioritizzato, genera short-form, long-form, headline, email-oggetto |
| Varietà | `creativitySlider` | range (1-10) | da "pattern sicuri" a "blue ocean" |
| Scalabilità | Per `market + product_or_service`, salva angle con feedback positivo | — | knowledge base di angle efficace che cresce |

**Strategy**: `channel` è mandatory: uno stesso angle prioritario per LinkedIn non lo è per TikTok. `angle-prioritization` deve ricevere il canale come filtro. `creative-activation` genera contenuti attivabili per il canale specifico.

### 3.5 meta-ads — DDD-173 (AdFormat, VisualDirection, PlatformPlacement, CtaStyle)

**Stato**: context-generation → ads-generation, 13 extraction fields (il più ricco).

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `adFormat` | select | single-image, carousel, video, dynamic, collection |
| Customization | `visualDirection` | select | product-focus, lifestyle, UGC, branded, minimal |
| Customization | `platformPlacement` | multi-select | feed, story, reels, search, marketplace, audience-network |
| Customization | `ctaStyle` | select | urgent, soft, educational, social-proof, fomo |
| Varietà | `adSetGroups` | number (1-5) | N gruppi di ads per audience segment diverso |
| Varietà | `variantPairs` | checkboxes | genera coppie A/B per headline / CTA / offer |
| Varietà | `hookLibrary` | pre-generation step | genera 10 hook, utente sceglie 3-5, ads-generation li usa |
| Scalabilità | Per `campaign_objective + product_or_service + adFormat`, raccomanda winning angle | — | ogni campagna parte dal pattern migliore |

**Strategy**: `hookLibrary` come step opzionale pre-ads-generation. `variantPairs` per A/B test strutturato. `copyLengthFormat` già esiste ma va reso per-ad-set per mixare formati diversi in una campagna.

### 3.6 youtube-description — DDD-174 (DescriptionStyle, SeoDepth, DescriptionLength, FeaturedSnippetMode)

**Stato**: 1 step singolo, 8 direct-input fields.

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `descriptionStyle` | select | professional, conversational, hype, minimalist, educational |
| Customization | `seoDepth` | select | light, balanced, heavy |
| Customization | `descriptionLength` | select | short (~150), medium (~350), long (~700) parole |
| Customization | `featuredSnippet` | boolean | ottimizza per featured snippet |
| Varietà | `variantCount` | number (1-5) | N descrizioni con stili diversi |
| Varietà | `hashtagBank` | boolean | genera 20 hashtag organizzati per volume/nicchia |
| Varietà | `thumbnailText` | boolean | suggerisci 3-5 headline per thumbnail |
| Scalabilità | Per canale/nichia, salva style + seoDepth preferiti | — | il sistema impara lo stile del canale |

### 3.7 geometric — DDD-175 (ReportDepth, StrategicFocus, CustomKpis)

**Stato**: serp-crawling → competitor-scoring → strategic-reporting → unified-report, 3 direct input fields (query, language, country).

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `reportDepth` | select | quick (solo executive + scoring), detailed (full), comprehensive (+ PAA + video + featured snippets) |
| Customization | `competitorList` | string[] (opzionale) | override dell'auto-detect |
| Customization | `industryContext` | string (opzionale) | es. "health supplements", "saas" |
| Customization | `customKpis` | textarea (opzionale) | metriche da pesare nello scoring |
| Customization | `reportSections` | checkboxes | SERP overview, competitor-analysis, PAA, featured-snippets, video-results, recommendations |
| Varietà | `strategicFocus` | select | growth, defense, differentiation, gap-analysis |
| Varietà | `executiveSummaryVariants` | number (1-3) | summary in stili diversi: data-driven, narrative, bullet-point |
| Scalabilità | Per `base_query + language`, cache competitor e pattern SERP | — | analisi successive più rapide (+ storico raccomandazioni) |

### 3.8 blog-article-generator — DDD-176 (ArticleFormat, OutlineFirst, ArticleToneProfile)

**Stato**: seo_structure → research → article, 1 direct input field (titolo).

| Asse | Cosa aggiungere | Tipo | Descrizione |
|---|---|---|---|
| Customization | `articleFormat` | select | how-to, listicle, thought-leadership, case-study, pillar-page, comparison |
| Customization | `targetWordCount` | number (500-3000) | parola target |
| Customization | `targetAudience` | string | descrizione del lettore ideale |
| Customization | `toneProfile` | select | educational, persuasive, controversial, neutral, technical, storytelling |
| Customization | `primaryKeywords` | string[] | keyword primarie |
| Customization | `secondaryKeywords` | string[] | keyword secondarie |
| Customization | `includeFaq` | boolean | sezione FAQ alla fine |
| Customization | `includeMeta` | boolean | genera anche meta title + meta description |
| Varietà | `outlineFirst` | pre-generation step | genera H1+H2+H3, utente modifica/riordina, poi full article |
| Varietà | `sectionAlternatives` | number (1-3) | per ogni H2, genera N varianti di contenuto |
| Varietà | `angleVariants` | number (1-3) | stesso titolo, article con angle/positioning diverso |
| Scalabilità | Per autore/sito, salva formato, word count e tone preferiti | — | redazione che conosce lo stile del brand |

**Strategy**: `outlineFirst` è il cambiamento più impattante di tutti i tool. Step 1: genera struttura completa (H1, H2 con descrizione contenuto, H3). Step 2: utente modifica/approva. Step 3: full article. `articleFormat` cambia radicalmente la struttura dell'output (un how-to ha H2 diversi da un thought-leadership). `primaryKeywords` per SEO reale.

---

## 4. Schema DB Nuove Entità

DDD-NNN associati: `UserTasteProfile` (DDD-160), `GenerationFeedback` (DDD-162), `UserToolTemplate` (DDD-163).

```sql
-- Profilo utente preferenze
CREATE TABLE user_taste_profile (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  preferred_tone  VARCHAR(50),
  preferred_model VARCHAR(100),
  per_tool        JSONB NOT NULL DEFAULT '{}',  -- Record<ToolKey, PerToolPreferences>
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback su generazioni
CREATE TABLE generation_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  tool_key        VARCHAR(50) NOT NULL,
  session_id      VARCHAR(100) NOT NULL,
  artifact_id     VARCHAR(100) NOT NULL,
  rating          VARCHAR(10) NOT NULL CHECK (rating IN ('positive', 'negative')),
  applied_settings JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template utente
CREATE TABLE user_tool_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  tool_key        VARCHAR(50) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  config_snapshot JSONB NOT NULL,          -- tutti i campi form + personalizzazione
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Priority Matrix

| Priorità | Cosa | Effort | Impatto | Tool |
|---|---|---|---|---|
| P0 | `variantCount` cross-tool + comparison view | M | Alto | Tutti |
| P0 | `UserTasteProfile` (DB + API + hook) | M | Alto | Tutti |
| P1 | `outlineFirst` — struttura prima del full article | M | Molto alto | blog-article-generator |
| P1 | `generateHooksFirst` + `videoFormat` | M | Alto | youtube-lf-script |
| P1 | `channel` + `brandVoice` per angle-generator | B | Alto | angle-generator |
| P1 | `adSetGroups` + `variantPairs` per meta-ads | M-A | Alto | meta-ads |
| P2 | `visualStyle` + `conversionGoal` per funnel-pages | B | M | funnel-pages |
| P2 | `sitePersonality` + `sectionAlternatives` per nextland | M | M-A | nextland |
| P2 | `reportDepth` + `strategicFocus` per geometric | B | M | geometric |
| P2 | `descriptionStyle` + `seoDepth` per youtube-description | B | B | youtube-description |
| P2 | `hookLibrary` pre-step per meta-ads | M | M | meta-ads |
| P3 | `Template System` (salva/carica configurazioni) | A | Alto | Tutti |
| P3 | `FeedbackCollector` (like/dislike + recommend) | M | Alto | Tutti |
| P3 | `hashtagBank` + `thumbnailText` per youtube-description | B | B | youtube-description |
| P3 | `angleVariants` per tutti i multi-step | M | M | tutti |

Effort: B=hours, M=days, A=weeks.

---

## 6. Frontend Implementation Notes

### 6.1 Nuovi componenti UI

DDD-NNN associati: `VariantComparisonView` (DDD-166), `PreGenerationStepPanel` (DDD-165), `MiniFeedback` (DDD-167), `UserPreferenceSummary` (DDD-168).

- **`VariantComparisonView`**: tabs/carosello per confrontare N risultati di generazione; selector "Scegli questo come finale" + feedback implicito
- **`PreGenerationStepPanel`**: wrapper per step intermedi (scegli hook, scegli struttura, scegli angle) prima della generazione full
- **`MiniFeedback`**: componente 👍👎 contestuale al risultato completato; opzionalmente apre `PreferenceDetailPanel`
- **`UserPreferenceSummary`**: badge nella Setup Panel che mostra "tone preferito: professionale" con pulsante modifica

### 6.2 Modifiche a macchine esistenti

- `tool-page.machine`: aggiungere `VARIANT_GENERATION_REQUESTED` event per avviare N run parallele
- `tool-flow.machine`: il context deve tracciare `variantIndex` per ogni step
- `ToolPageViewModel`: aggiungere `variantCount`, `variantCurrentIndex`, `totalVariants`
- `buildBaseGenerationRequest`: aggiungere `variantSeed` al payload

### 6.3 Nuovo hook

```ts
function useVariantGeneration(toolKey: ToolKey): {
  variants: GenerationArtifact[][];     // N x steps results
  currentVariantIndex: number;
  setCurrentVariantIndex: (i: number) => void;
  selectFinalVariant: (i: number) => void;
  isGeneratingVariants: boolean;
};
```

---

## 7. Backend Implementation Notes

### 7.1 Nuove API

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/user/profile/taste` | GET | Ottiene il profilo di preferenze |
| `/api/user/profile/taste` | PATCH | Aggiorna il profilo |
| `/api/user/profile/feedback` | POST | Registra feedback su generazione |
| `/api/user/templates` | GET | Elenco template |
| `/api/user/templates` | POST | Salva template |
| `/api/user/templates/{id}` | DELETE | Elimina template |

### 7.2 Modifiche a contratti esistenti

- `GenerationRequestInput`: aggiungere `variantSeed?: number`
- `GenerationRunResponse`: aggiungere `feedbackUrl?: string` per il micro-feedback POST
- `ToolWorkflowDefinition` in `tool-workflows.ts`: aggiungere `personalization?: Record<string, PersonalizationFieldDef>` per esporre i campi di personalizzazione in modo dichiarativo

---

## 8. Acceptance Gates

1. `npm run typecheck` su tutti i workspace
2. `npm run test` su tutti i workspace (inclusi nuovi test per `VariantComparisonView`, `MiniFeedback`, `useUserTasteProfile`)
3. Test manuale variant generation: 3 run parallele, preview + selection funzionante
4. Test manuale feedback: clic 👍/👎 → POST verificato in network tab
5. Test manuale template: salva → ricarica pagina → carica template → form precompilato
6. Per ogni per-tool personalizzazione: smoke test che il campo condiziona l'output visibilmente (differenza rispetto a default)

---

## 9. DDD-NNN Reference Index

Questa sezione elenca tutti i nuovi concetti introdotti dalla proposal che richiedono una voce nel [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) prima della propagazione. I codici DDD-NNN sono **placeholder temporanei** — verranno assegnati definitivamente al momento dell'approvazione.

### 9.1 Entità/Value Object cross-tool

| DDD-NNN | Termine | Tipo | Bounded Context | Descrizione |
|---|---|---|---|---|
| DDD-160 | `UserTasteProfile` | Entity | Frontend/UI, Generation | Profilo persistente delle preferenze utente per tool. Caricato all'apertura del ToolPage, usato come default prefill. Nuova tabella `user_taste_profile`. |
| DDD-161 | `VariantGenerationMode` | Process | Frontend/UI | Modalità di generazione multipla varianti (1-5). Prevede `variantCount` in UI e `variantSeed` in GenerationRequest. |
| DDD-162 | `GenerationFeedback` | Entity | Generation, Frontend/UI | Feedback utente su singola generazione (rating positivo/negativo + snapshot impostazioni). Estende il concetto provisional `ArtifactLearningFeedbackLoop` (DDD-098). Nuova tabella `generation_feedback`. |
| DDD-163 | `UserToolTemplate` | Entity | Frontend/UI | Snapshot serializzato della configurazione tool salvato dall'utente. Include campi form + personalizzazione. Nuova tabella `user_tool_templates`. |
| DDD-164 | `variantSeed` / `variantCount` | Value Object (field) | Generation, Frontend/UI | Campi opzionali in `GenerationRequest` per generazione multipla varianti. `variantSeed` discrimina le run parallele; `variantCount` indica il totale per logging. |

### 9.2 Componenti UI canonici

| DDD-NNN | Termine | Tipo | Bounded Context | Descrizione |
|---|---|---|---|---|
| DDD-165 | `PreGenerationStepPanel` | Component | Frontend/UI | Pannello intermedio tra setup e generazione full: utente seleziona hook, struttura, angle prima della generazione completa. |
| DDD-166 | `VariantComparisonView` | Component | Frontend/UI | Vista confronto varianti (tabs/carosello). Permette selezione variante finale con feedback implicito. |
| DDD-167 | `MiniFeedback` / `FeedbackCollector` | Component | Frontend/UI | Componente 👍👎 contestuale al risultato completato. Invia `POST /api/user/profile/feedback`. |
| DDD-168 | `UserPreferenceSummary` | Component | Frontend/UI | Badge nella Setup Panel che riassume le preferenze attive (tone, style) con pulsante modifica. |

### 9.3 Per-tool personalization fields

| DDD-NNN | Tool | Nuovi campi | Descrizione |
|---|---|---|---|
| DDD-169 | funnel-pages | `VisualStyle`, `ConversionGoal`, `PageLength`, `HookStrategy` | Stile visuale, obiettivo conversione, lunghezza pagina, strategia hook |
| DDD-170 | nextland | `SitePersonality`, `NavigationStyle`, `ComponentLibrary` | Personalità sito, stile navigazione, libreria sezioni |
| DDD-171 | youtube-lf-script | `VideoFormat`, `HookApproach`, `CtaDensity`, `RetentionPattern` | Formato video, approccio hook, densità CTA, pattern retention |
| DDD-172 | angle-generator | `Channel`, `BrandVoice`, `AnglesToAvoid`, `CreativitySlider` | Canale target, voce brand, angle da evitare, slider creatività |
| DDD-173 | meta-ads | `AdFormat`, `VisualDirection`, `PlatformPlacement`, `CtaStyle` | Formato annuncio, direzione visual, posizionamento, stile CTA |
| DDD-174 | youtube-description | `DescriptionStyle`, `SeoDepth`, `DescriptionLength`, `FeaturedSnippetMode` | Stile descrizione, profondità SEO, lunghezza, ottimizzazione featured snippet |
| DDD-175 | geometric | `ReportDepth`, `StrategicFocus`, `CustomKpis` | Profondità report, focus strategico, KPI personalizzati |
| DDD-176 | blog-article-generator | `ArticleFormat`, `OutlineFirst`, `ArticleToneProfile` | Formato articolo, struttura prima del full article, profilo tono esteso |

### 9.4 Relazioni con DDD esistenti

| DDD esistente | Relazione |
|---|---|
| DDD-098 (`ArtifactLearningFeedbackLoop`, `ArtifactOutcomeStatus`, `ArtifactComparisonSet`) | DDD-162 (`GenerationFeedback`) è l'istanza runtime concreta del feedback loop. DDD-166 (`VariantComparisonView`) realizza `ArtifactComparisonSet` in UI. |
| DDD-063 (`FeedbackChannel`) | `MiniFeedback` (DDD-167) opera sul canale `inline-action`. |
| DDD-061 (`DispatchError`) | DDD-164 introduce nuovi scenari di errore per varianti parziali. |
| DDD-053/055/057 (`LlmModel`, `LlmModelCatalog`, `LlmModelSelector`) | DDD-160.preferredModel è cache ultima selezione, non sostituisce il catalogo. |
| DDD-089 (`ContextGenerationPhase`) | DDD-165 (`PreGenerationStepPanel`) è un passo prima della `ContextGenerationPhase`, non la sostituisce. |
| DDD-079/080 (ExtractionFieldKey governance) | I campi DDD-169..176 non sono `ExtractionFieldKey` — sono parametri di stile/strategia UI, non campi di estrazione. |
