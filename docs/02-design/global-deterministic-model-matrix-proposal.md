---
status: draft
version: 1.0
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Domain Architecture
title: Global Deterministic LLM Model Step Matrix
type: proposal
tags: [llm-models, tool-steps, generation, backend, deterministic, openrouter]
goal: Eliminare openrouter/auto non-deterministico assegnando un modello specifico a ogni step LLM di ogni tool
---

# Global Deterministic LLM Model Step Matrix

## Sommario Esecutivo

Attualmente 22 step LLM su 25 (esclusi 2 code-only + 3 già overridden in `blog-article-generator`) ricadono su `openrouter/auto`, che instrada la richiesta al modello più economico disponibile in modo non-deterministico. Questo causa:

- **Output non riproducibili**: lo stesso input può produrre risultati diversi tra esecuzioni successive
- **Qualità imprevedibile**: il routing automatico può selezionare modelli deboli per task complessi
- **Costo non controllabile**: nessuna garanzia sul modello effettivamente utilizzato

**Soluzione**: estendere il sistema `StepLlmModelOverrideConfig` (DDD-150) a tutti gli step, assegnando un modello deterministico basato sulla funzione specifica dello step.

## Palette Modelli

Quattro modelli deterministici coprono l'intero spettro di esigenze:

| Tier | Modello | Ruolo | Nel catalog? |
|------|---------|-------|-------------|
| 🔴 Premium | `anthropic/claude-sonnet-4.6` | Copy persuasiva ITA, ragionamento strategico, output creativi lunghi | **Da aggiungere** |
| 🟡 Balanced | `openai/gpt-5.2` | Articoli long-form, report compositi, contesti grandi | ✓ enabled |
| 🟢 Light | `openai/gpt-4.1-mini` | Output strutturati semplici, task a bassa complessità | ✓ enabled |
| 🔵 Search | `perplexity/sonar-pro-search` | Step che richiedono web search tool | ✓ enabled (DDD-233) |

### Criteri di assegnazione

- **🔴 Premium**: step che producono copy persuasiva, script lunghi, brief creativi, buyer persona, analisi strategiche — qualità massima richiesta, lingua italiana
- **🟡 Balanced**: step con contesti grandi, output compositi, ragionamento strutturato ma non creativo
- **🟢 Light**: step con output breve e strutturato, task circoscritti dove la qualità premium non è necessaria
- **🔵 Search**: step che invocano il web search tool (obbligatorio)

## Matrice Completa Tool × Step → Modello

### funnel-pages

| Step | Modello | Rationale |
|------|---------|-----------|
| `optin` | `openai/gpt-4.1-mini` 🟢 | 3 varianti pagina optin brevi; task strutturato, basso costo |
| `quiz` | `anthropic/claude-sonnet-4.6` 🔴 | Questionario strategico con segmentazione e false-belief disruption |
| `vsl` | `anthropic/claude-sonnet-4.6` 🔴 | Script VSL 2800-3200 parole, 10 elementi persuasivi |

### nextland

| Step | Modello | Rationale |
|------|---------|-----------|
| `landing` | `anthropic/claude-sonnet-4.6` 🔴 | Landing page 10 sezioni ad alta conversione |
| `thank_you` | `openai/gpt-4.1-mini` 🟢 | Pagina thank-you breve e strutturata |

### youtube-lf-script

| Step | Modello | Rationale |
|------|---------|-----------|
| `pre-script-analysis` | `anthropic/claude-sonnet-4.6` 🔴 | Analisi strategica posizionamento |
| `packaging` | `openai/gpt-4.1-mini` 🟢 | 3 titoli + visual hook, output breve |
| `intro-structure` | `anthropic/claude-sonnet-4.6` 🔴 | Intro 90-120 sec con 4 checkpoint psicologici |
| `body-structure` | `anthropic/claude-sonnet-4.6` 🔴 | Corpo centrale 5-15 min con Value Loop |
| `native-cta-embeds` | `openai/gpt-4.1-mini` 🟢 | 2 CTA native tattiche, output breve |
| `outro-structure` | `anthropic/claude-sonnet-4.6` 🔴 | Chiusura 90-120 sec, gap closure |

### angle-generator

| Step | Modello | Rationale |
|------|---------|-----------|
| `context-and-angle-matrix` | `anthropic/claude-sonnet-4.6` 🔴 | Mappa contesto + 10-15 angoli |
| `angle-prioritization` | `openai/gpt-5.2` 🟡 | Scoring su 4 dimensioni, ranking |
| `creative-activation` | `anthropic/claude-sonnet-4.6` 🔴 | Fondamenta creative per campagne Meta |

### meta-ads

| Step | Modello | Rationale |
|------|---------|-----------|
| `context-generation` | `anthropic/claude-sonnet-4.6` 🔴 | Strategy canvas con cluster segmentation |
| `ads-generation` | `anthropic/claude-sonnet-4.6` 🔴 | Asset Meta Ads multi-variante |

### youtube-description

| Step | Modello | Rationale |
|------|---------|-----------|
| `youtube-description-generation` | `openai/gpt-4.1-mini` 🟢 | Output strutturato rigido in 5 blocchi |

### geometric

| Step | Modello | Rationale |
|------|---------|-----------|
| `serp-crawling` | — ⚡ | Solo codice, nessuna chiamata LLM |
| `competitor-scoring` | — ⚡ | Solo codice, nessuna chiamata LLM |
| `strategic-reporting` | `anthropic/claude-sonnet-4.6` 🔴 | Analisi qualitativa SERP, executive summary |
| `unified-report` | `openai/gpt-5.2` 🟡 | Report composito + classificazione GEO + CSV |

### blog-article-generator — già configurato (DDD-157, DDD-233) 🔒

| Step | Modello | Rationale |
|------|---------|-----------|
| `blog_seo_structure` | `perplexity/sonar-pro-search` 🔵 | Ricerca online + architettura SEO |
| `blog_research` | `perplexity/sonar-pro-search` 🔵 | Ricerca approfondita mercato italiano |
| `blog_article` | `openai/gpt-5.2` 🟡 | Articolo ~800 parole fluido e engaging |

### brief-generator

| Step | Modello | Rationale |
|------|---------|-----------|
| `brief-generation` | `anthropic/claude-sonnet-4.6` 🔴 | Brief creativo 11 sezioni |

### tov-generator

| Step | Modello | Rationale |
|------|---------|-----------|
| `tov-generation` | `anthropic/claude-sonnet-4.6` 🔴 | Documento Brand Tone of Voice |

### personas-generator

| Step | Modello | Rationale |
|------|---------|-----------|
| `personas-generation` | `anthropic/claude-sonnet-4.6` 🔴 | Buyer persona 10 sezioni, profondità psicologica |

## Riepilogo Allocazione

| Modello | # Step | % |
|---------|--------|---|
| `anthropic/claude-sonnet-4.6` 🔴 | 17 | 68% |
| `openai/gpt-5.2` 🟡 | 3 | 12% |
| `openai/gpt-4.1-mini` 🟢 | 5 | 20% |
| `perplexity/sonar-pro-search` 🔵 | 2 | 8% |
| N/A (solo codice) | 2 | — |
| **Totale step** | **27** | |

## Riepilogo per Tool

| Tool | Premium 🔴 | Balanced 🟡 | Light 🟢 | Search 🔵 | Code |
|------|-----------|------------|---------|----------|------|
| funnel-pages | 2 | — | 1 | — | — |
| nextland | 1 | — | 1 | — | — |
| youtube-lf-script | 4 | — | 2 | — | — |
| angle-generator | 2 | 1 | — | — | — |
| meta-ads | 2 | — | — | — | — |
| youtube-description | — | — | 1 | — | — |
| geometric | 1 | 1 | — | — | 2 |
| blog-article-generator | — | 1 | — | 2 | — |
| brief-generator | 1 | — | — | — | — |
| tov-generator | 1 | — | — | — | — |
| personas-generator | 1 | — | — | — | — |

## Implementation Plan

### Task 1: Aggiungere `anthropic/claude-sonnet-4.6` al LlmModelCatalog

Nuovo seed file: `packages/infra-db/seeds/YYYYMMDD_000001_anthropic_claude_sonnet_model.sql`

```sql
INSERT INTO llm_models (key, label, status, sort_order, is_default)
VALUES ('anthropic/claude-sonnet-4.6', 'Claude Sonnet 4.6', 'enabled', 5, false);
```

### Task 2: Popolare STEP_LLM_MODEL_OVERRIDES

Aggiungere 22 nuove entry a `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts`:

- 19 nuovi override per step non coperti
- Mantenere i 3 esistenti per `blog-article-generator`

### Task 3: Verifica

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

La validazione startup (`validateStepLlmModelOverrides`) verificherà che tutti i `toolKey` e `stepKey` esistano nel `toolWorkflowRegistry` e che tutti gli `overrideModelId` siano nel `LlmModelCatalog`.

### Task 4: Opzionale — Pulizia catalog

Rimuovere `openai/gpt-4o-mini-search-preview` e `openai/gpt-4o-search-preview` (rimpiazzati da perplexity per search). Disabilitarli con `status = 'disabled'`.

## DDD Prerequisites

La seguente DDD decision è richiesta prima dell'implementazione:

| ID | Data | Termine | Decisione | Rationale |
|----|------|---------|-----------|-----------|
| DDD-234 | 2026-07-28 | Global Deterministic Step Model Matrix | **Assegnare un modello LLM deterministico a ogni step di ogni tool tramite `StepLlmModelOverrideConfig` (DDD-150), eliminando la dipendenza da `openrouter/auto` non-deterministico.** La palette modelli è: `anthropic/claude-sonnet-4.6` (copy persuasiva/strategica ITA), `openai/gpt-5.2` (contesti grandi/report), `openai/gpt-4.1-mini` (task strutturati/basso costo), `perplexity/sonar-pro-search` (web search). `openrouter/auto` rimane enabled come fallback di sistema ma non sarà mai raggiunto con override completi. I criteri di assegnazione sono documentati nella proposal `global-deterministic-model-matrix-proposal.md`. | `openrouter/auto` è non-deterministico e causa output non riproducibili, qualità imprevedibile e costo non controllabile. Il sistema `StepLlmModelOverrideConfig` (DDD-150) esiste già e supporta override statici validati all'avvio — estenderlo a tutti gli step è l'estensione naturale. La palette a 4 modelli bilancia qualità, costo e capability specifiche (search). |

## Governance

Override configurations governed through standard code review:

1. **Add Overrides**: PR con nuove entry in `step-llm-model-overrides.config.ts`
2. **Add Model**: Nuovo seed SQL se il modello non è nel catalog
3. **Review**: Team valida model selection e reasoning
4. **Deploy**: Merge + deploy standard
5. **Monitor**: Log startup validation (`[startup][step-llm-model-overrides] N override(s)`) e generation logs

### Modifiche future

Per aggiungere un override per un nuovo tool o modificare un'assegnazione esistente:

1. Aggiornare `STEP_LLM_MODEL_OVERRIDES` in `step-llm-model-overrides.config.ts`
2. Se il modello non è nel catalog, aggiungere seed SQL
3. Se il modello esce dalla palette (es. deprecato), nuova DDD decision per documentare la migrazione
4. Aggiornare questa proposal con la nuova versione

## References

- **DDD-150**: StepLlmModelOverrideConfig (Value Object)
- **DDD-151**: StepLlmModelResolver (Domain Service)
- **DDD-152**: EffectiveModelResolution (Value Object)
- **DDD-157**: Hardcoded LLM model overrides per step (blog-article-generator)
- **DDD-233**: blog-article-generator migration to perplexity/sonar-pro-search
- **Original Proposal**: `docs/02-design/llm-model-step-override-proposal.md`
- **Config Guide**: `docs/03-development/llm-model-override-configuration-guide.md`
- **Config File**: `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts`