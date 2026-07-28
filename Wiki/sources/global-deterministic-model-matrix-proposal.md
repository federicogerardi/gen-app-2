---
type: source-summary
tags:
  - wiki/source
  - llm-models
  - deterministic
  - tool-steps
  - proposal
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Domain Architecture
source_file: docs/02-design/global-deterministic-model-matrix-proposal.md
date_ingested: 2026-07-28
source_version: 1.0
---

# Global Deterministic LLM Model Step Matrix

Proposal per estendere il sistema `StepLlmModelOverrideConfig` (DDD-150) a tutti i 25 step LLM, eliminando `openrouter/auto` non-deterministico.

## Palette Modelli (4 tier)

| Tier | Modello | # Step | Ruolo |
|------|---------|--------|-------|
| 🔴 Premium | `anthropic/claude-sonnet-4.6` | 17 | Copy persuasiva ITA, ragionamento strategico |
| 🟡 Balanced | `openai/gpt-5.2` | 3 | Contesti grandi, report compositi |
| 🟢 Light | `openai/gpt-4.1-mini` | 5 | Task strutturati, basso costo |
| 🔵 Search | `perplexity/sonar-pro-search` | 2 | Web search tool |

## Mappatura per Tool

- **funnel-pages**: optin=🟢, quiz=🔴, vsl=🔴
- **nextland**: landing=🔴, thank_you=🟢
- **youtube-lf-script**: pre-script-analysis=🔴, packaging=🟢, intro-structure=🔴, body-structure=🔴, native-cta-embeds=🟢, outro-structure=🔴
- **angle-generator**: context-and-angle-matrix=🔴, angle-prioritization=🟡, creative-activation=🔴
- **meta-ads**: context-generation=🔴, ads-generation=🔴
- **youtube-description**: youtube-description-generation=🟢
- **geometric**: serp-crawling=N/A (code), competitor-scoring=N/A (code), strategic-reporting=🔴, unified-report=🟡
- **blog-article-generator**: blog_seo_structure=🔵, blog_research=🔵, blog_article=🟡 (already configured)
- **brief-generator**: brief-generation=🔴
- **tov-generator**: tov-generation=🔴
- **personas-generator**: personas-generation=🔴

## Implementation Tasks

1. Aggiungere `anthropic/claude-sonnet-4.6` al `LlmModelCatalog` (seed SQL)
2. 19 nuovi override in `step-llm-model-overrides.config.ts`

## Contradictions

None.

## Source

- File: `docs/02-design/global-deterministic-model-matrix-proposal.md`
- Version: 1.0
- Last reviewed: 2026-07-28
- Owner: Domain Architecture