---
type: concept
tags:
  - wiki/concept
  - tools
  - catalog
  - refactoring
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_count: 5
confidence: high
---

# Tool Catalog — Reference For Refactoring

Catalogo completo di tutti i [[Tool]] attivi con workflow, step, tipi step, input sources, extraction fields, e note di implementazione. Riferimento primario per il refactoring [[ToolWorkflowJob]].

## Tabella Riepilogativa

[toolCount::11]

| ToolKey | ToolWorkflow | Step Count | Step Types | Input Sources | Asset-Capable | Status |
|---------|-------------|------------|------------|---------------|---------------|--------|
| `funnel-pages` | `funnel_pages` | multi-step | extraction, generation × N | file + direct-input | yes | active |
| `nextland` | `nextland` | multi-step | extraction, generation × N | file + direct-input | yes | active |
| `youtube-lf-script` | `youtube_lf_script` | 6 | extraction, generation × 5 | file + direct-input | yes | active |
| `angle-generator` | `angle_generator` | multi-step | extraction, generation × N | file × 2 (Briefing + AngleDetector) | yes | active |
| `youtube-description` | `youtube_description` | 1 | generation | **direct-input only** (no file) | no | active |
| `geometric` | `geometric_analysis` | 4 | crawling, scoring, generation × 2 | direct-input + api-acquisition | yes | active |
| `blog-article-generator` | `blog_article_generator` | 3 | generation × 3 | file + direct-input | yes | active |
| `brief-generator` | `brief_generator` | 1 | extraction → generation (→ Asset) | file | yes | active |
| `tov-generator` | `tov_generator` | 1 | extraction → generation (→ Asset) | file | yes | active |
| `personas-generator` | `personas_generator` | 1 | extraction → generation (→ Asset) | file | yes | active |
| `meta-ads` | `meta_ads_generator` | multi-step | extraction, generation × N | file + direct-input | yes | reactivated |

---

## Dettaglio Per Tool

### funnel-pages

- **ToolKey**: `funnel-pages` (kebab), **ToolWorkflow**: `funnel_pages` (snake)
- **Step types**: extraction, generation
- **Input**: 1 file (BriefingFile, always required)
- **Extraction fields** (5): `funnel_goal`, `target_audience`, `offer`, `proof`, `primary_cta`
- **Consumes**: `brief`, `brand-voice`, `persona`
- **UI**: Configuration Section not rendered (no form fields). Setup Panel: Resources (file upload) + Knowledge (asset selection)
- **Note**: One of the original tools. No direct-input form fields — all context from file extraction.

### nextland

- **ToolKey**: `nextland` (kebab), **ToolWorkflow**: `nextland` (snake)
- **Step types**: extraction, generation
- **Input**: 1 file (BriefingFile, always required)
- **Extraction fields** (5): `website_goal`, `brand_or_company`, `target_audience`, `offer_or_service`, `required_sections`
- **Consumes**: `brief`, `brand-voice`, `persona`
- **UI**: Configuration Section not rendered. Same pattern as funnel-pages.

### youtube-lf-script

- **ToolKey**: `youtube-lf-script` (kebab), **ToolWorkflow**: `youtube_lf_script` (snake)
- **Step sequence** (6 steps, DDD-041):
  1. `pre-script-analysis` — **extraction** + analysis
  2. `packaging` — **generation**
  3. `intro-structure` — **generation**
  4. `body-structure` — **generation**
  5. `native-cta-embeds` — **generation**
  6. `outro-structure` — **generation** (final, ArtifactRole = `'final'`)
- **Input**: 1 file (BriefingFile, always required)
- **Extraction fields** (8): `knowledge_content`, `avatar`, `pain_point`, `purchase_process_type`, `offer`, `proof`, `tone`, `target_duration_minutes`, `proprietary_methodology_disclosure`
- **Consumes**: `brief`, `brand-voice`, `persona`
- **UI**: Configuration Section not rendered. Output language always Italian (DDD-046).

### angle-generator

- **ToolKey**: `angle-generator` (kebab), **ToolWorkflow**: `angle_generator` (snake)
- **Step types**: extraction, generation
- **Input**: 2 files (BriefingFile always required, AngleDetectorFile required-by-tool-setting)
- **Extraction fields** (7): `goal`, `product_or_service`, `market`, `target_audience`, `pain_point`, `proof`, `creative_constraints`
- **Produces**: `angle` (AssetType)
- **Consumes**: `brief`, `brand-voice`, `persona`
- **Note (DDD-078)**: Both files merged into single extraction LLM job. No dual extraction-job fan-out.
- **UI**: Configuration Section not rendered.

### youtube-description

- **ToolKey**: `youtube-description` (kebab), **ToolWorkflow**: `youtube_description` (snake)
- **Steps**: 1 — **generation only** (no extraction)
- **Input**: **direct-input only** (DDD-095). No file upload. `socialLinks` and `hashtags` are optional, non-blocking.
- **Extraction**: None — no extraction context. Dispatches with markdown-only output contract.
- **Consumes**: `brand-voice`
- **UI**: Has Configuration Section (form fields). Asset-capable = **no** → no Knowledge Section, no `LlmModelSelector` (DDD-218).
- **Note**: Unique — only tool without file input. Also unique as only tool consuming exclusively `brand-voice`.

### geometric

- **ToolKey**: `geometric` (kebab), **ToolWorkflow**: `geometric_analysis` (snake)
- **Step sequence** (4 steps, DDD-117):
  1. `serp-crawling` — **crawling** → [[CrawlArtifact]] → delegates to [[CrawlingExtraction]] context
  2. `competitor-scoring` — **scoring** → [[ScoringArtifact]] → delegates to [[CompetitorAnalysis]] context
  3. `strategic-reporting` — **generation** → [[StrategicReport]] (ArtifactRole=`'step'`)
  4. `unified-report` — **generation** → [[UnifiedReport]] (ArtifactRole=`'final'`)
- **Input**: direct-input (BaseQuery, language, country) + api-acquisition (SerpAPI via [[ApiService]])
- **Extraction**: Uses [[QueryCluster]] with 1 BaseQuery + up to 4 PAAQuery entries
- **Session**: Uses [[AnalysisSession]] (DDD-113) instead of standard [[GenerationSession]]
- **⚠ Known issue (Fase 2 smoke test)**: SerpApi ri-eseguita per ogni step generation (B1). Rimandato a Fase 3 con long-lived actor.
- **Crawling dependency**: `SERP_API_SERVICE_ID` + `SERP_API_KEY` env vars required. Fails with `CRAWLING_FAILED` if unset.

### blog-article-generator

- **ToolKey**: `blog-article-generator` (kebab), **ToolWorkflow**: `blog_article_generator` (snake)
- **Step sequence** (3 steps):
  1. `blog_seo_structure` — **generation**
  2. `blog_outline` — **generation**
  3. `blog_article` — **generation** (final)
- **Input**: file + direct-input
- **Produces**: `article` (AssetType)
- **Note (DDD-155)**: Active since DDD-155 ratification. Riclassificato non-asset-capable in DDD-222 (`consumes: []`).

### brief-generator

- **ToolKey**: `brief-generator` (kebab), **ToolWorkflow**: `brief_generator` (snake)
- **Steps**: 1 — extraction → generation (DDD-210)
- **Output**: Produces `'brief'` [[Asset]] type
- **UI**: Configuration Section not rendered. Primitive single-step tool bridging file upload extraction and Asset production.

### tov-generator

- **ToolKey**: `tov-generator` (kebab), **ToolWorkflow**: `tov_generator` (snake)
- **Steps**: 1 — extraction → generation (DDD-212)
- **Output**: Produces `'brand-voice'` [[Asset]] type
- **UI**: Configuration Section not rendered.

### personas-generator

- **ToolKey**: `personas-generator` (kebab), **ToolWorkflow**: `personas_generator` (snake)
- **Steps**: 1 — extraction → generation (DDD-214)
- **Output**: Produces `'persona'` [[Asset]] type
- **UI**: Configuration Section not rendered.

### meta-ads (reactivated)

- **ToolKey**: `meta-ads` (kebab), **ToolWorkflow**: `meta_ads_generator` (snake)
- **Step types**: extraction, generation
- **Input**: file + direct-input
- **Produces**: `ad-copy` (AssetType)
- **Consumes**: `brief`, `brand-voice`, `persona`, `angle`
- **Note (DDD-094)**: Reactivated under new workflow identity `meta_ads_generator`. Original `meta_ads` is deprecated.

---

## Step Type Distribution

Per refactoring del processor `tool-workflow-job-processor.ts` (CRIT-03 — routing per WorkflowStepType):

| WorkflowStepType | Tools che lo usano | Count |
|------------------|-------------------|-------|
| `extraction` | funnel-pages, nextland, youtube-lf-script, angle-generator, brief-generator, tov-generator, personas-generator, meta-ads | 8 |
| `generation` | **tutti tranne** geometric (crawling+scoring non sono generation) | 9 |
| `crawling` | geometric (serp-crawling) | 1 |
| `scoring` | geometric (competitor-scoring) | 1 |
| `acquisition` | geometric (api-acquisition via SerpAPI) | 1 |

## Input Source Distribution

Per refactoring del `ToolInputRequirementMatrix`:

| Source Family | Tools |
|---------------|-------|
| **direct-input only** | youtube-description |
| **file only** | funnel-pages, nextland, brief-generator, tov-generator, personas-generator |
| **file × 1** (always required) | funnel-pages, nextland, youtube-lf-script |
| **file × 2** (1 always + 1 by-tool) | angle-generator |
| **direct + api-acquisition** | geometric |
| **direct + file** | blog-article-generator, meta-ads |

## Asset-Capable vs Non-Asset-Capable

Per refactoring della Knowledge Section / `LlmModelSelector` (DDD-218/DDD-219):

| Capacità | Tools |
|----------|-------|
| **Asset-capable** (Knowledge Section + LlmModelSelector) | funnel-pages, nextland, youtube-lf-script, angle-generator, geometric, blog-article-generator, brief-generator, tov-generator, personas-generator, meta-ads |
| **Non-asset-capable** (no Knowledge, no selector) | youtube-description |

## UI Rendering (Configuration Section)

Per refactoring del Setup Panel:

| Rende Configuration Section | Tools |
|----------------------------|-------|
| **Yes** (ha form fields) | youtube-description, geometric, blog-article-generator, meta-ads |
| **No** (solo file upload) | funnel-pages, nextland, youtube-lf-script, angle-generator, brief-generator, tov-generator, personas-generator |

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[proposal-be-driven-workflow-job-system]]
- [[feature-tool-workflow-job-system-fase-1]]
- [[feature-tool-workflow-job-system-fase-2]]