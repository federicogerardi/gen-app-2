---
goal: Integrate SERP API as primary crawling channel for Geometric tool, replacing direct Puppeteer scraping as the default path while keeping Puppeteer as fallback
version: 1.1
date_created: 2026-06-13
last-reviewed: 2026-06-13
next-review-date: 2026-09-13
owner: Backend Runtime
status: draft
type: adr
tags: [geometric, serp-api, crawling, api-service, acquisition, puppeteer-fallback, ddd-129]
---

# ADR — SERP API Integration as Primary Crawling Channel

## Context

Il crawling SERP attuale usa Puppeteer + stealth plugin per navigare direttamente `google.it`. Google rileva e blocca le richieste automatizzate (sourceCount: 0, paaCount: 0 nei log). Lo screenshot viene comunque catturato, ma i dati strutturati (fonti, snippet, PAA) non vengono estratti.

Il sistema ha già un componente **ApiService** completo e configurabile che gestisce:
- Chiamate HTTP con auth token, retry, timeout
- Request/response mapping via JSON rules
- Error mapping con projection
- Binding a tool+step specifici
- Cache Redis per orchestrazione

## Decision

Usare **SERP API** (SerpAPI o DataForSEO) come canale **primario** per il crawling SERP, configurato tramite il sistema ApiService esistente. Puppeteer rimane come **fallback** quando la SERP API fallisce o la quota è esaurita.

### Perché non implementare un adapter SERP API dedicato

L'architettura ApiService è già sufficiente per integrare qualsiasi SERP API:
- **baseUrl** + **resourcePath** = URL dell'endpoint SERP
- **accessMode: token** = API key nell'header
- **requestMappingRulesJson** = mappa `query` → parametro della SERP API
- **responseMappingRulesJson** = estrae `sources`, `snippets`, `paaQueries` dalla risposta JSON
- **errorMappingRulesJson** = gestisce errori specifici (quota exceeded, rate limit)
- **retryCount** + **timeoutMs** = già configurabili

Non serve un nuovo adapter. Serve solo:
1. Registrare un ApiService per la SERP API scelta
2. Bindarlo al geometric tool `serp-crawling` step
3. Modificare `invokeCrawling` per tentare prima la SERP API, poi fallback a Puppeteer

## Architettura Proposta

```
┌──────────────────────────────────────────────────────────────┐
│  invokeCrawling (generation-system.actors.ts)                │
│                                                              │
│  1. resolveApiServiceForAcquisition(serp-api-service-id)     │
│     ↓                                                        │
│  2. executeApiAcquisition({ service: serpApi, query })       │
│     ↓                                                        │
│  3. Se OK → parse SERP API response → crawlArtifacts         │
│     ↓                                                        │
│  4. Se FAIL → fallback a crawlSerp() (Puppeteer)            │
│     ↓                                                        │
│  5. archiveScreenshot() SOLO da Puppeteer fallback           │
│     (SERP API non restituisce screenshot)                    │
│     ↓                                                        │
│  6. return CRAWLING_COMPLETED                                │
└──────────────────────────────────────────────────────────────┘
```

**Nota screenshot**: Le SERP API commerciali (SerpAPI, DataForSEO) **non restituiscono screenshot**. Lo screenshot è prodotto **solo** dal fallback Puppeteer (`crawlSerp()`). Se la SERP API ha successo e il fallback non viene eseguito, nessun screenshot viene archiviato per quella query. Questo è un trade-off accettabile: la SERP API fornisce dati strutturati affidabili; lo screenshot è un bonus del fallback Puppeteer.

## Configurazione SERP API

### Opzione A — SerpAPI (raccomandata)

| Campo | Valore |
|-------|--------|
| baseUrl | `https://serpapi.com` |
| resourcePath | `/search.json` |
| accessMode | `token` |
| tokenHeaderName | `Authorization` |
| requestMethod | `GET` |
| timeoutMs | `15000` |
| retryCount | `2` |

**Request mapping:**
```json
[
  { "sourcePath": "input.query", "targetPath": "query.q", "required": true },
  { "sourcePath": "input.language", "targetPath": "query.hl" },
  { "sourcePath": "input.country", "targetPath": "query.gl" }
]
```

**Response mapping (SerpAPI → formato interno):**
```json
[
  { "sourcePath": "organic_results", "targetPath": "sources", "required": false },
  { "sourcePath": "answer_box.snippet", "targetPath": "aiOverviewSnippet" },
  { "sourcePath": "related_questions", "targetPath": "paaQueries" }
]
```

### Opzione B — DataForSEO

| Campo | Valore |
|-------|--------|
| baseUrl | `https://api.dataforseo.com` |
| resourcePath | `/v3/serp/google/organic/live/advanced` |
| accessMode | `token` |
| tokenHeaderName | `Authorization` |
| requestMethod | `POST` |
| timeoutMs | `30000` |
| retryCount | `1` |

## Implementation Steps

### Step 1 — Modificare `invokeCrawling` per usare ApiService come primary

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

L'actor `invokeCrawling` attualmente:
1. Chiama `crawlSerp()` (Puppeteer) direttamente
2. Chiama `discoverPAAQueries()` (Puppeteer)
3. Chiama `archiveScreenshot()`

Nuovo flusso:
1. Risolve l'ApiService per la SERP API (dal DB, via binding o env var `SERP_API_SERVICE_ID`)
2. Se trovato e attivo → `executeApiAcquisition()` con la query
3. Se la risposta è valida → parse → `crawlArtifacts`
4. Se fallisce o non trovato → fallback a `crawlSerp()` (Puppeteer)
5. Sempre → `archiveScreenshot()` dallo screenshot del fallback o dalla SERP API

### Step 2 — Aggiungere env var `SERP_API_SERVICE_ID`

**File**: `apps/backend/src/server.ts`

```
SERP_API_SERVICE_ID=<uuid-dell-api-service-serp>
```

Se non impostata, il sistema usa solo Puppeteer (comportamento attuale).

### Step 3 — Registrare l'ApiService SERP

Via admin UI o seed script:
```sql
INSERT INTO api_services (
  id, key, label, base_url, resource_path, access_mode,
  timeout_ms, retry_count, request_method,
  request_mapping_rules_json, response_mapping_rules_json,
  error_mapping_rules_json, status
) VALUES (
  gen_random_uuid(),
  'serp-api',
  'SERP API Primary',
  'https://serpapi.com',
  '/search.json',
  'token',
  15000, 2, 'GET',
  '[{"sourcePath":"input.query","targetPath":"query.q","required":true},{"sourcePath":"input.language","targetPath":"query.hl"},{"sourcePath":"input.country","targetPath":"query.gl"}]',
  '[{"sourcePath":"organic_results","targetPath":"sources"},{"sourcePath":"answer_box.snippet","targetPath":"aiOverviewSnippet"},{"sourcePath":"related_questions","targetPath":"paaQueries"}]',
  '[{"statusCode":429,"errorCode":"rate_limited","message":"SERP API rate limit exceeded"},{"statusCode":403,"errorCode":"quota_exceeded","message":"SERP API quota exhausted"}]',
  'active'
);
```

### Step 4 — Binding al geometric tool

**Nota DDD**: Il `workflowStepType` rimane `'crawling'` (DDD-116), non `'acquisition'`. La SERP API è un **canale di acquisizione dati** per lo step di crawling, ma non cambia il tipo dello step. Il `WorkflowStepType` rimane `'crawling'`; cambia solo il **mezzo** di acquisizione (SERP API invece di Puppeteer).

```sql
INSERT INTO api_service_tool_step_bindings (
  api_service_id, tool_key, step_key, workflow_step_type,
  binding_status, requiredness
) VALUES (
  <serp-api-service-id>, 'geometric', 'serp-crawling', 'crawling',
  'active', 'required-by-tool-setting'
);
```

### Step 5 — Domain Translation: SERP API → Concetti di Dominio

La risposta SERP API ha un formato diverso dal payload generico. Serve un **response normalizer** che converte i campi SERP API ai concetti di dominio del Crawling & Extraction Context (DDD-114):

| Campo SERP API | Concetto di Dominio | Tipo | Note |
|---|---|---|---|
| `organic_results[].title` | `SerpSource.title` | `string` | Titolo del risultato organico |
| `organic_results[].link` | `SerpSource.url` | `string` | URL del dominio |
| `organic_results[].snippet` | `SerpSource.snippet` | `string \| null` | Testo snippet |
| `organic_results[].position` | `SerpSource.position` | `number` | Posizione nella SERP (opzionale) |
| `answer_box.snippet` | `SerpAIOverviewSnippet` | `string \| null` | Testo dell'AI Overview |
| `related_questions[].question` | `PAAQuery` | `string` | Query "People Also Ask" |
| `search_metadata.status` | `CrawlingResult.status` | `string` | Stato della richiesta SERP API |
| `search_metadata.total_time_taken` | `CrawlingResult.durationMs` | `number` | Tempo di esecuzione in secondi |

**Mappatura `SerpSourceType`**: Tutti i risultati da `organic_results` sono classificati come `SerpSourceType = 'organic'`. I risultati `paid_results` (se presenti nella risposta SERP API) sono classificati come `'sponsored'`. I risultati `video_results` sono classificati come `'video'`.

**Normalizer dedicato**: La mappatura deve avvenire in `crawling.adapter.ts` tramite una funzione `normalizeSerpApiResponse(payload)` che riceve il payload grezzo dalla SERP API e restituisce un `CrawlingResult` con i campi di dominio corretti. Questo normalizer è responsabile della traduzione del formato SERP API al formato `CrawlArtifact` consumato dal downstream (`CompetitorAnalysisContext`).

### Step 6 — Error Mapping: SERP API → Crawling Failure Reasons

| Errore SERP API | HTTP Status | Crawling Failure Reason | Comportamento |
|---|---|---|---|
| Rate limit exceeded | `429` | `crawling_rate_limited` | Retry con backoff (max 2), poi fallback Puppeteer |
| Quota exhausted | `403` | `crawling_quota_exceeded` | Fallback immediato a Puppeteer, log warning |
| Invalid API key | `401` | `crawling_api_auth_failed` | Fallback a Puppeteer, log error (configurazione errata) |
| Timeout | — | `crawling_api_timeout` | Fallback a Puppeteer |
| Network error | — | `crawling_api_network_error` | Fallback a Puppeteer |
| SERP API non configurata | — | — | Usa solo Puppeteer (comportamento attuale) |

## Fallback Strategy

| Scenario | Comportamento |
|----------|--------------|
| SERP API OK | Usa dati SERP API → `crawlArtifacts` con `SerpSource`, `SerpAIOverviewSnippet`, `PAAQuery`. **Nessuno screenshot** (SERP API non restituisce immagini). |
| SERP API 429 (rate limit) | Retry con backoff (max 2), poi fallback Puppeteer |
| SERP API 403 (quota) | Fallback immediato a Puppeteer |
| SERP API timeout | Fallback a Puppeteer |
| SERP API non configurata | Usa solo Puppeteer (comportamento attuale) |
| Puppeteer fallisce | `sourceCount: 0`, `paaCount: 0`, screenshot comunque archiviato (se catturato prima del fallimento) |
| Puppeteer OK (fallback) | Dati da Puppeteer + screenshot archiviato |

## Costi Stimati

| Provider | Piano | Costo/mese | Query incluse |
|----------|-------|-----------|---------------|
| SerpAPI | Hobby | $50 | 5,000 |
| DataForSEO | Pay-as-you-go | ~$0.002/query | Variabile |
| ValueSERP | Starter | $29 | 5,000 |

Per uso admin-only (Geometric è `enabled-for-admin-only`), 5,000 query/mese sono più che sufficienti.

## Rischi

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|------------|---------|-------------|
| SERP API down | Bassa | Medio | Fallback a Puppeteer automatico |
| Quota esaurita | Media | Medio | Alert + fallback a Puppeteer |
| Formato risposta SERP API cambia | Bassa | Alto | Test di integrazione + response mapping configurabile |
| Costi superiori al previsto | Bassa | Basso | Monitoraggio usage + alert |

## Alternatives Considerate

- **ALT-001**: Proxy rotation + Puppeteer — Rifiutato: costi proxy residenziali ($10-15/GB), manutenzione continua, efficacia incerta contro Google 2026
- **ALT-002**: Bing Web Search API — Rifiutato: risultati inferiori per SEO analysis, non compatibili con il workflow Geometric
- **ALT-003**: Adapter SERP API dedicato — Rifiutato: il sistema ApiService esistente è già sufficiente, non serve duplicare la logica

## Related

- [ApiService Architecture](../02-design/api-service-architecture.md) — se esiste
- [Geometric Tool Plan](./feature-geometric-tool-1.md)
- [Geometric Screenshot Archival Plan](./feature-geometric-screenshot-archival-1.md)
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-129
- [Domain Bounded Context Map](./domain-bounded-context-map.md) — Crawling & Extraction Context (dual-channel)
