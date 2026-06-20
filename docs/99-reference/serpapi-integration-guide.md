---
status: active
version: 2.0
last-reviewed: 2026-06-20
next-review-date: 2026-09-20
owner: Domain Architecture
type: integration-guide
---

# SerpApi Integration Guide 

## Overview

The Geometric tool uses SerpApi exclusively for SERP data extraction, implementing the SerpApi-only crawling pattern described in DDD-131. There is **no Puppeteer fallback** — if SerpApi fails, the crawling process stops with an error.

## Architecture

### SerpApi-Only Pattern

The integration uses SerpApi as the sole crawling channel:

1. **API Channel (SerpApi)**: Google Search API + Google AI Overview API
2. **No Fallback**: SerpApi errors propagate and stop the process

### Runtime Behavior

```typescript
// Environment-based configuration
SERP_API_SERVICE_ID=serpapi-google-ai-overview  // Required
SERP_API_KEY=your_serpapi_key                   // Required

// Runtime behavior
const serpApiService = await resolveSerpApiService(context.adapters.apiService);
if (!serpApiService) {
  return { type: 'CRAWLING_FAILED', reason: 'serpapi_service_not_found' };
}
const result = await crawlSerp(query, language, country, serpApiService);
// If crawlSerp throws → error propagates, no fallback
```

## Implementation Components

### 1. Database Configuration

Migration `20260620_000019_serpapi_ai_overview_service.sql` creates:

- **ApiService Entry**: `serpapi-google-ai-overview`
  - Base URL: `https://serpapi.com/search`
  - Access Mode: `query-param` (API key via `?api_key=`)
  - Tool binding: `geometric` → `serp-crawling`

### 2. Core Modules

#### SerpApi Normalizer (`serpapi-normalizer.ts`)
- **Response mapping**: SerpApi JSON → `CrawlingResult` types
- **AI Overview extraction**: Text blocks → `aiOverviewSnippet`
- **Source classification**: URLs → `SourceType` (`organic`, `video`, `ugc`, etc.)
- **PAA extraction**: Related questions → `PAAQuery[]`

#### Service Resolver (`serpapi-service-resolver.ts`)
- **Environment resolution**: `SERP_API_SERVICE_ID` → `ResolvedApiServiceForAcquisition`
- **Token injection**: `SERP_API_KEY` overrides database token
- **Error handling**: Returns `undefined` if service unavailable — caller must handle failure

### 3. Generation System Integration

The `invokeCrawling` actor in `generation-system.actors.ts`:

```typescript
// Resolve SerpApi service — required, no fallback
if (!context.adapters.apiService) {
  return { type: 'CRAWLING_FAILED', reason: 'api_service_adapter_missing' };
}

const serpApiService = await resolveSerpApiService(context.adapters.apiService);
if (!serpApiService) {
  return { type: 'CRAWLING_FAILED', reason: 'serpapi_service_not_found' };
}

// SerpApi-only crawling — errors propagate, no fallback
const baseResult = await crawlSerp(query, language, country, serpApiService);
const paaQueries = await discoverPAAQueries(query, language, country, serpApiService);
```

## Configuration

### Environment Variables

Add to your `.env.local`:

```bash
# SerpApi integration (required for Geometric tool)
SERP_API_SERVICE_ID=serpapi-google-ai-overview
SERP_API_KEY=your_serpapi_api_key_here
```

### Database Setup

Run the migration to create the ApiService configuration:

```bash
# Apply migration
npm --workspace packages/infra-db run migrate:minimal

# Verify ApiService created
psql $DATABASE_URL -c "SELECT key, label, access_mode, status FROM api_services WHERE key = 'serpapi-google-ai-overview';"
```

## Usage

### Production
```bash
export SERP_API_SERVICE_ID=serpapi-google-ai-overview
export SERP_API_KEY=your_production_key
npm run start
```

### Monitoring
```bash
# Check SerpApi usage logs
grep "crawling.start" /var/log/app.log

# Monitor SerpApi failures
grep "crawling.failed" /var/log/app.log
```

## API Consumption

### SerpApi Request Flow

1. **Google Search API**: Get search results + potential AI Overview page token
   ```
   GET https://serpapi.com/search?engine=google&q={query}&hl={lang}&gl={country}
   ```

2. **AI Overview API** (if page_token returned):
   ```
   GET https://serpapi.com/search?engine=google_ai_overview&page_token={token}
   ```

3. **Response Normalization**: SerpApi JSON → Geometric `CrawlingResult`

### Data Mapping

| SerpApi Field | Geometric Field | Notes |
|---------------|-----------------|-------|
| `ai_overview.text_blocks[].snippet` | `aiOverviewSnippet` | Concatenated with paragraph breaks |
| `ai_overview.references[]` | `sources[]` | Mapped to `SerpSource` with type classification |
| `related_questions[].question` | PAA queries | Max 4 entries per DDD-118 |
| `search_metadata.status` | Error handling | API success/failure detection |

### Rate Limiting & Costs

- **SerpApi**: Based on your subscription plan (requests/month)
- **No fallback**: If SerpApi quota is exceeded, the crawling process fails

## Error Handling

### No Fallback — Errors Propagate

```typescript
// SerpApi errors propagate — no Puppeteer fallback
const result = await crawlSerp(query, language, country, serpApiService);
// If crawlSerp throws → error propagates to invokeCrawling → CRAWLING_FAILED
```

### Common Scenarios

| Error Condition | Behavior | Resolution |
|----------------|----------|------------|
| No `SERP_API_SERVICE_ID` | `CRAWLING_FAILED` | Set `SERP_API_SERVICE_ID` in `.env.local` |
| Invalid API key | `CRAWLING_FAILED` | Check `SERP_API_KEY` environment |
| SerpApi quota exceeded | `CRAWLING_FAILED` | Monitor usage in SerpApi dashboard, upgrade plan |
| Network timeout | `CRAWLING_FAILED` | Transient; retry on next crawl |
| Invalid page_token | `CRAWLING_FAILED` | SerpApi token expiry (1 minute) |
| Service not found in DB | `CRAWLING_FAILED` | Re-run migration `20260620_000019` |

## Testing

### Unit Tests

```bash
# Run SerpApi integration tests
node --import tsx --test apps/backend/src/lib/tests/runtime.serpapi-crawling.test.ts

# Full backend test suite
npm --workspace apps/backend run test
```

### Integration Testing

```bash
# Test with real SerpApi (requires valid API key)
export SERP_API_SERVICE_ID=serpapi-google-ai-overview
export SERP_API_KEY=test_key_here
npm --workspace apps/backend run test:smoke
```

### Manual Verification

1. **Start Geometric flow** with `baseQuery = "SEO tools comparison"`
2. **Check logs** for `crawling.start` and `crawling.completed`
3. **Verify sources** in generated `CrawlArtifact` content

## Performance Characteristics

### SerpApi Channel
- **Latency**: ~2-4 seconds per query (Google Search) + ~5-6 seconds (AI Overview)
- **Reliability**: High (no anti-bot blocking)
- **Data quality**: Structured, consistent schema
- **Cost**: Monetary cost per request

## Troubleshooting

### Common Issues

**SerpApi service not found**
```bash
# Check if ApiService exists in DB
psql $DATABASE_URL -c "SELECT key, status FROM api_services WHERE key = 'serpapi-google-ai-overview';"

# Re-run migration if needed
psql $DATABASE_URL -f packages/infra-db/migrations/20260620_000019_serpapi_ai_overview_service.sql
```

**Token authentication errors**
```bash
# Verify API key format
curl "https://serpapi.com/search?engine=google&q=test&api_key=$SERP_API_KEY"
```

**Service resolution fails**
```bash
# Check env vars
echo $SERP_API_SERVICE_ID
echo $SERP_API_KEY | cut -c1-8
```

## DDD Alignment

This integration implements several canonical domain decisions:

- **DDD-131**: SerpApi-only crawling implementation (no Puppeteer fallback)
- **DDD-130**: `ApiServiceAccessMode = 'query-param'` support
- **DDD-102**: ApiService system usage  
- **DDD-114**: Crawling & Extraction context boundary
- **DDD-116**: `WorkflowStepType = 'crawling'` reuse
- **DDD-118**: QueryCluster with BaseQuery + PAAQuery limits

---

For questions or issues, refer to the [Geometric Tool Operations Reference](./geometric-crawling-step-reference.md) or contact the Domain Architecture team.