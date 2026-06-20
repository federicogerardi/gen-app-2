# Prompt A - Strategic Reporting

## Objective
Generate a qualitative strategic analysis from SERP extraction data and competitor ranking.

## Input Source
SerpAIOverviewSnippet texts from crawling artifacts + CompetitorRanking JSON from scoring artifact.

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
