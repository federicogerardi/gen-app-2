# Prompt A - Strategic Reporting

## Objective
Generate a qualitative strategic analysis from SERP extraction data and competitor ranking.

## Input Source
SerpAIOverviewSnippet texts from crawling artifacts + CompetitorRanking JSON from scoring artifact.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Pipeline Context
You are step 3 of 4 in the geometric workflow.
Previous step outputs:
{{output_step_serp-crawling}}
{{output_step_competitor-scoring}}

Your output will feed step 4 (unified-report). Synthesize crawling data and competitor scoring into strategic analysis.

## Rules
- Screenshot data must NEVER be included in the prompt context. Only text and structured data.
- Output in Italian (it-IT).

## Mandatory Output Structure

1. **Executive summary** of SERP landscape for the base query.
2. **Competitor visibility analysis** (which domains dominate, which are emerging).
3. **Source type distribution analysis** (organic vs sponsored vs video vs social).
4. **Trend observations** (patterns across PAA queries).
5. **Operational recommendations** for the brand (actionable, prioritized).
6. **Quality self-check** (completeness, actionability, specificity).

---
SERP snippets: {{serpSnippets}}

PAA queries: {{paaQueries}}

Competitor ranking: {{competitorRanking}}
