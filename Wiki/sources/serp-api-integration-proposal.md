---
type: source-summary
tags:
  - wiki/source
  - geometric
  - serp-api
  - crawling
  - adr
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/serp-api-integration-proposal.md
date_ingested: 2026-07-28
source_version: 3.0
---

# ADR — SERP API for Geometric, Puppeteer for Future Web Tools

Architectural split replacing Puppeteer-based Google SERP crawling in Geometric with SerpAPI as the sole channel. Puppeteer retained for future non-Google web scraping tools.

## Decision

| Tool | Channel | Rationale |
|------|---------|-----------|
| **Geometric** | SerpAPI (API service) | Google blocks Puppeteer systematically |
| **Future tools** | Puppeteer (retained) | Effective for non-Google sites with moderate protection |

**No fallback**: if SerpAPI unavailable, `CRAWLING_FAILED` explicit — no silent zero-source Puppeteer path.

## Architecture

Geometric's `invokeCrawling` rewritten to use existing `[[ApiService]]` infrastructure exclusively:
1. `resolveApiService(SERP_API_SERVICE_ID)` → if null, return `CRAWLING_FAILED`
2. `executeApiAcquisition()` with retry on 429
3. `normalizeSerpApiResponse()` → `[[SerpSource]][]`, `[[SerpAIOverviewSnippet]]`, `[[PAAQuery]][]`

## SerpAPI Configuration

Engine `google` provides all data in one call: `organic_results` → `SerpSource[]`, `answer_box.snippet` → `SerpAIOverviewSnippet`, `related_questions[].question` → `PAAQuery[]`. `related_searches[].query` kept as distinct `queryHints` (not `PAAQuery` per DDD-118).

Three blockers resolved during implementation: `accessMode: 'query-param'` support (DDD-130), `workflowStepType: 'crawling'` extension, `resolveApiService` naming cleanup.

## Error Handling

All SERP API errors become explicit `CRAWLING_FAILED` with typed reason codes: `serp_api_not_configured`, `crawling_rate_limited`, `crawling_quota_exceeded`, `crawling_api_auth_failed`, `crawling_api_timeout`, `crawling_api_network_error`.

## Contradictions

None.

## Source

- File: `docs/02-design/serp-api-integration-proposal.md`
- Version: 3.0
- Last reviewed: 2026-07-16
- Owner: Backend Runtime
- Implementation date: 2026-07-16