---
status: active
version: 2.0
last-reviewed: 2026-06-20
next-review-date: 2026-09-20
owner: Backend Runtime
date_created: 2026-06-12
title: Geometric Crawling Step — Backend Operations Reference
type: reference
tags: [geometric, crawling, backend, serpapi, google-ai-overview, xstate, paa]
---

# Geometric Crawling Step — Backend Operations Reference

## 1. Trigger — XState Generation System

```
GenerationSystem (toolGenerationFlow)
  └─ Stato: 'dispatchingMode' → routeType = 'tool'
       └─ Invoca: invokeToolWorkflow (toolWorkflowMachine)
            └─ Stato: 'running'
                 └─ STEP_START per step 'serp-crawling' (type: 'crawling')
                      └─ GenerationSystem invoca: invokeCrawling (fromPromise actor)
```

**File**: `generation-system.execution.states.ts:78`, `tool-workflow.machine.ts`

---

## 2. invokeCrawling Actor — Orchestratore Principale

**File**: `generation-system.actors.ts:181-320`

```
invokeCrawling (fromPromise)
  │
  ├─ 1. Estrazione parametri da requestInput
  │     ├─ baseQuery    → root o extractionPayload (fallback)
  │     ├─ language     → root o extractionPayload (fallback)
  │     ├─ country      → root o extractionPayload (fallback)
  │     └─ brandName    → root o extractionPayload (fallback)
  │
  ├─ 2. Risoluzione SerpApi service via ApiServiceAdapter
  │     ├─ Se apiService adapter mancante → CRAWLING_FAILED (api_service_adapter_missing)
  │     ├─ resolveSerpApiService() → cerca SERP_API_SERVICE_ID nel DB
  │     ├─ Se risoluzione fallisce → CRAWLING_FAILED (serpapi_resolution_failed)
  │     └─ Se service non trovato/disabled → CRAWLING_FAILED (serpapi_service_not_found)
  │
  ├─ 3. Validazione: se baseQuery vuoto → CRAWLING_FAILED (base_query_missing)
  │
  ├─ 4. Log: crawling.start (requestId, baseQuery, language, country)
  │
  ├─ 5. crawlSerp(baseQuery, language, country, serpApiService) → risultato base
  │     └─ Google Search API → AI Overview page_token (se presente)
  │     └─ Google AI Overview API (se page_token) → text_blocks + references
│     └─ Normalizzazione → aiOverviewSnippet, sources[]
  │
  ├─ 6. discoverPAAQueries(baseQuery, language, country, serpApiService) → array PAA
  │     └─ related_questions[] dalla Google Search API response
  │
  ├─ 7. Se PAA scoperte (max 4):
  │     └─ Promise.all(crawlSerp(paaQuery, ..., serpApiService) per ogni PAA)
  │        └─ Ogni PAA fallita → log warn, ignorata (non blocca il flusso)
  │
  ├─ 8. Merge risultati: base + PAA → crawlArtifacts[]
  │
  ├─ 9. Log: crawling.completed (durationMs, sourceCount, paaCount)
  │
  └─ 10. Ritorna: CRAWLING_COMPLETED
        └─ crawlArtifacts[]
        └─ paaQueries[]
```

---

## 3. SerpApi Service Resolution

**File**: `serpapi-service-resolver.ts`

```
resolveSerpApiService(apiServiceAdapter)
  │
  ├─ 1. Legge SERP_API_SERVICE_ID da env
  │     └─ Se non impostato → undefined (nessun crawling)
  │
  ├─ 2. apiServiceAdapter.resolveApiServiceForCrawling(serviceId)
  │     └─ Query DB: api_services WHERE id = serviceId AND status = 'active'
  │
  ├─ 3. Se service.status !== 'active' → undefined
  │
  ├─ 4. Se SERP_API_KEY è impostata in env → override tokenCiphertext
  │
  └─ 5. Ritorna: ResolvedApiServiceForAcquisition | undefined
```

**Environment variables**:

| Variable | Scopo |
|----------|-------|
| `SERP_API_SERVICE_ID` | ID del record api_services (default: `serpapi-google-ai-overview`) |
| `SERP_API_KEY` | API key SerpApi (override del token nel DB) |

---

## 4. SerpApi Crawling Adapter

**File**: `crawling.adapter.ts`

### 4a. `crawlSerp(query, language, country, apiService)`

```
crawlSerp() — SerpApi-only, no fallback
  │
  ├─ 1. Google Search API call
  │     └─ GET https://serpapi.com/search
  │        ├─ engine=google
  │        ├─ q={query}
  │        ├─ hl={language}
  │        ├─ gl={country senza 'google.'}
  │        └─ api_key={token}
  │
  ├─ 2. Se response.statusCode !== 200 → throw Error
  │
  ├─ 3. Se response.error → throw Error
  │
  ├─ 4. Check page_token da ai_overview.page_token
  │     └─ Se presente → chiamata separata a Google AI Overview API
  │        ├─ engine=google_ai_overview
  │        ├─ page_token={token}
  │        └─ api_key={token}
  │
  ├─ 5. Se AI Overview API response OK → normalizeSerpApiAiOverview()
  │     └─ text_blocks[].snippet → aiOverviewSnippet (concatenati con '\n\n')
  │     └─ references[] → sources[] (con classificazione tipo)
  │     └─ aiOverviewConfidence = 0.95
  │     └─ selectorUsed = 'serpapi-ai-overview'
  │
  ├─ 6. Fallback: AI Overview embedded nella Search response
  │     └─ ai_overview.text_blocks → snippet
  │     └─ ai_overview.references → sources
  │     └─ aiOverviewConfidence = 0.85
  │     └─ selectorUsed = 'serpapi-google-search'
  │
  └─ 7. Se nessun AI Overview → risultato minimale con organic_results
        └─ aiOverviewSnippet = null
        └─ aiOverviewConfidence = 0.0
```

### 4b. `discoverPAAQueries(baseQuery, language, country, apiService)`

```
discoverPAAQueries() — SerpApi-only
  │
  ├─ 1. Google Search API call (come crawlSerp step 1)
  │
  ├─ 2. Se response.statusCode !== 200 → []
  │
  ├─ 3. Se response.error → []
  │
  ├─ 4. extractPAAQueriesFromSerpApi(response)
  │     └─ related_questions[].question
  │     └─ Max 4, filtra vuoti
  │
  └─ 5. Ritorna: string[] (PAA queries scoperte)
```

### 4c. SerpApi Normalizer

**File**: `serpapi-normalizer.ts`

| Function | Scopo |
|----------|-------|
| `normalizeSerpApiAiOverview(response)` | SerpApi AI Overview JSON → `CrawlingResult` |
| `extractPAAQueriesFromSerpApi(response)` | `related_questions[]` → `string[]` |
| `requiresSeparateAiOverviewRequest(response)` | Estrae `page_token` se presente, null altrimenti |
| `classifySourceType(url, title, source)` | URL/title/source → `SourceType` (organic, video, ugc, news, sponsored) |

---

## 5. ApiService Database Configuration

**Migration**: `20260620_000019_serpapi_ai_overview_service.sql`

```sql
-- api_services record
id: gen_random_uuid()
key: 'serpapi-google-ai-overview'
label: 'SerpApi Google AI Overview'
base_url: 'https://serpapi.com/search'
access_mode: 'query-param'
status: 'active'
token_param_name: 'api_key'

-- api_service_tool_step_bindings record
tool_key: 'geometric'
step_key: 'serp-crawling'
workflow_step_type: 'crawling'
binding_status: 'active'
requiredness: 'required-by-tool-setting'
```

---

## 6. Merge Output — toolWorkflowMachine

**File**: `tool-workflow.machine.ts:173-242`

```
mergeCrawlingOutput (assign action)
  │
  ├─ 1. Verifica: event.type === 'STEP_SUCCESS'
  ├─ 2. Verifica: stepDescriptor?.type === 'crawling'
  ├─ 3. Verifica: crawlArtifacts.length > 0
  │     └─ Se vuoto → log error, return context unchanged
  │
  ├─ 4. Merge snippets:
  │     └─ crawlArtifacts.map(a => a.content).filter(Boolean).join('\n\n')
  │
  ├─ 5. Merge sources:
  │     └─ FlatMap di tutti gli artifact.structuredPayload.sources
  │
  ├─ 6. Merge paaQueries:
  │     └─ Deduplicati (Set<string>)
  │
  ├─ 7. Preserva brandName da requestInput se presente
  │
  ├─ 8. Log: merge.crawling.completed
  │     └─ sourceCount, paaCount, snippetLength
  │
  └─ 9. Aggiorna assembledGenerationInput:
       └─ { crawling: { snippets, sources, paaQueries } }
```

---

## 7. Cache Result — Generation System Actions

**File**: `generation-system.actions.ts:245-246`

```
cacheCrawlingResult
  │
  └─ Aggiorna requestInput:
       └─ mergeCrawlingIntoGenerationInput(context.requestInput, crawlingOutput)
```

---

## 8. Context Assembly — Per Step Successivi

**File**: `context-generation-assembly.ts:23-64`

```
mergeCrawlingIntoGenerationInput()
  │
  ├─ 1. Estrai crawlArtifacts e paaQueries dall'output
  ├─ 2. Concatena snippets con '\n\n'
  ├─ 3. FlatMap sources da tutti gli artifact
  ├─ 4. Ritorna:
       └─ { crawling: { snippets, sources, paaQueries } }
```

---

## 9. Guards — Validazione Output

**File**: `generation-system.guards.ts:59-60`

```
crawlingOutputIsAccepted
  │
  └─ getCrawlingDoneOutput(event)?.type === 'CRAWLING_COMPLETED'
```

---

## 10. Types — Contratto XState

**File**: `generation-system.types.ts:85-92`

```typescript
export type CrawlingDoneOutput =
  | { type: 'CRAWLING_COMPLETED'
      crawlArtifacts: {
        query: string
        isPaa: boolean
        content: string
        structuredPayload: Record<string, unknown>
      }[]
      paaQueries: string[]
    }
  | { type: 'CRAWLING_FAILED'; reason: string }

export type CacheCrawlingResultParams = {
  crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[]
  paaQueries: string[]
}
```

---

## 11. Flusso Completo — Sequenza Temporale

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Frontend: click "Avvia generazione"                              │
│     └─ POST /api/tools/orchestrate                                   │
│        └─ extractionPayload: { baseQuery, language, country, brandName } │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Backend: generation-system riceve REQUEST_RECEIVED               │
│     └─ requestInput = { ..., extractionPayload: { ... } }           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. toolWorkflowMachine: STEP_START per 'serp-crawling'              │
│     └─ invokeCrawling (fromPromise actor)                            │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. invokeCrawling: estrae parametri da requestInput/extractionPayload│
│     └─ baseQuery = 'protein supplements'                             │
│     └─ language = 'it'                                               │
│     └─ country = 'google.it'                                         │
│     └─ brandName = 'MyBrand'                                         │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. resolveSerpApiService() → SerpApi service dal DB                 │
│     └─ SERP_API_SERVICE_ID → api_services lookup                     │
│     └─ SERP_API_KEY → override tokenCiphertext                       │
│     └─ Se mancante/disabled → CRAWLING_FAILED (no fallback)          │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. crawlSerp(baseQuery, ..., serpApiService) → SerpApi              │
│     └─ Google Search API → page_token (se AI Overview)               │
│     └─ Google AI Overview API → text_blocks + references             │
│     └─ Normalizzazione → aiOverviewSnippet, sources[]                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. discoverPAAQueries(baseQuery, ..., serpApiService)               │
│     └─ related_questions[] → max 4 query                             │
│     └─ Esempio: ["What is the best protein?", "Is whey safe?"]       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Promise.all(crawlSerp(paaQuery, ..., serpApiService) per PAA)   │
│     └─ Ogni PAA → crawlSerp parallelo via SerpApi                    │
│     └─ PAA fallita → log warn, ignorata                              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  9. Merge risultati → crawlArtifacts[]                               │
│     └─ base + PAA results                                            │
│     └─ log: crawling.completed (durationMs, sourceCount, paaCount)   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  10. Ritorna: CRAWLING_COMPLETED                                     │
│      └─ toolWorkflowMachine: STEP_SUCCESS                            │
│         └─ mergeCrawlingOutput → assembledGenerationInput            │
│            └─ { crawling: { snippets, sources, paaQueries } }        │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  11. Prossimo step: 'score-competitors'                              │
│      └─ invokeScoring legge assembledGenerationInput.crawling.sources│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 12. Regole Critiche

| Regola | Implementazione |
|--------|----------------|
| **No Puppeteer fallback** | Se SerpApi fallisce → errore propagato, processo si interrompe |
| **SerpApi service required** | Se `SERP_API_SERVICE_ID` non configurato o service non attivo → `CRAWLING_FAILED` |
| **PAA non bloccante** | 0 PAA queries = step valido, continua con base query |
| **PAA fallita = ignorata** | Singola PAA fallita → log warn, non blocca il flusso |
| **Fallback extractionPayload** | Se `baseQuery` non nel root, cerca in `extractionPayload` |
| **Deduplicazione PAA** | `Set<string>` per evitare query duplicate |
| **Max 4 PAA** | `.slice(0, 4)` per limitare il numero di crawl paralleli |
| **Token injection** | `SERP_API_KEY` env override `tokenCiphertext` dal DB |
| **AI Overview confidence** | 0.95 per AI Overview API, 0.85 per embedded, 0.0 se assente |

---

## 13. Error Handling

| Scenario | Comportamento | Reason Code |
|----------|---------------|-------------|
| `apiService` adapter mancante | `CRAWLING_FAILED` | `api_service_adapter_missing` |
| SerpApi service non trovato nel DB | `CRAWLING_FAILED` | `serpapi_service_not_found` |
| SerpApi service disabled | `CRAWLING_FAILED` | `serpapi_service_not_found` |
| `baseQuery` mancante | `CRAWLING_FAILED` | `base_query_missing` |
| SerpApi HTTP error | Errore propagato | — |
| SerpApi response error | Errore propagato | — |
| Singola PAA fallita | Log warn, ignorata | — |

---

## 14. File Correlati

| File | Scopo |
|------|-------|
| `generation-system.actors.ts` | `invokeCrawling` fromPromise actor + SerpApi resolution |
| `crawling.adapter.ts` | SerpApi-only crawling adapter (no Puppeteer) |
| `serpapi-normalizer.ts` | SerpApi JSON → CrawlingResult normalization |
| `serpapi-service-resolver.ts` | SerpApi service resolution da env + DB |
| `crawling-chain.machine.ts` | XState crawling chain (usa SerpApi adapter) |
| `tool-workflow.machine.ts` | `mergeCrawlingOutput` action |
| `generation-system.guards.ts` | `crawlingOutputIsAccepted` guard |
| `generation-system.actions.ts` | `cacheCrawlingResult` action |
| `context-generation-assembly.ts` | `mergeCrawlingIntoGenerationInput` helper |
| `generation-system.types.ts` | `CrawlingDoneOutput`, `CacheCrawlingResultParams` |
