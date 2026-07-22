---
goal: Replace Puppeteer-based Google SERP crawling in Geometric with SERP API as the sole channel; reposition Puppeteer for future non-Google tool contexts
version: 3.0
date_created: 2026-06-13
last-reviewed: 2026-07-16
next-review-date: 2027-01-16
owner: Backend Runtime
status: implemented
type: adr
implementation_date: 2026-07-16
tags: [geometric, serp-api, serpapi, crawling, api-service, puppeteer-repurpose, paa, related-questions, ddd-129]
---

# ADR — Architectural Split: SERP API for Geometric, Puppeteer for Future Web Tools

## Context

Il Geometric tool usa Puppeteer + stealth plugin per navigare direttamente `google.it`. Google rileva sistematicamente le richieste automatizzate (sourceCount: 0, paaCount: 0 nei log di produzione) indipendentemente dal livello di stealth.

**Constatazione**: nessuna quantità di configurazione Puppeteer risolverà il problema con Google a lungo termine. Google investe significativamente in anti-bot detection. Le SERP API commerciali gestiscono già questa complessità e offrono dati strutturati affidabili.

Il sistema ha già un componente **ApiService** completo e configurabile:
- Chiamate HTTP con auth token, retry, timeout configurabili
- Request/response mapping via JSON rules
- Error mapping con projection
- Binding a tool+step specifici

**Realtà del crawler Puppeteer esistente**: è uno strumento efficace per accedere a siti web con livelli di protezione moderati (blog, articoli, pagine statiche). Il suo valore non è zero — semplicemente non è adatto per Google SERP.

## Decision

**Separazione architetturale per canale di crawling**:

| Tool | Canale | Ragione |
|---|---|---|
| **Geometric** | SERP API (SerpAPI, futuri provider) | Google blocca Puppeteer; le API sono il solo canale affidabile per Google SERP |
| **Futuri tool** (webfetch, blog scraper, ecc.) | Puppeteer (già implementato) | Siti con protezione moderata — browser automation è efficace e non richiede costi API |

**Per Geometric**: Puppeteer è rimosso dal path di esecuzione. Non esiste più un "fallback" a Puppeteer — se la SERP API è non configurata o non disponibile, lo step `serp-crawling` fallisce con `CRAWLING_FAILED`. Il risultato è un errore esplicito anziché dati vuoti silenziosamente accettati.

**Per futuri tool**: Puppeteer (`crawlSerp`, `discoverPAAQueries`) rimane nell'adapter `crawling.adapter.ts` disponibile per step `WorkflowStepType = 'crawling'` che operano su siti non-Google.

### Perché non mantenere il fallback Puppeteer per Geometric

Il fallback Puppeteer per Geometric è **illusorio**:
1. Google blocca Puppeteer → il fallback ritorna sempre `sourceCount: 0`, `paaCount: 0`
2. Un `CRAWLING_COMPLETED` con zero fonti è peggio di un `CRAWLING_FAILED` esplicito: causa un `scoring_failed.no_sources` ed un 500 silenzioso ugualmente, ma maschera il vero problema
3. Mantenere un path di codice che non funziona crea ambiguità operativa

### Perché non implementare un adapter SERP API dedicato

L'architettura ApiService esistente è sufficiente:
- **baseUrl** + **resourcePath** = URL dell'endpoint SERP
- **accessMode** = autenticazione token o query-param
- **requestMappingRulesJson** = mappa query → parametri API
- **responseMappingRulesJson** = estrae `sources`, `aiOverviewSnippet`, `paaQueries`
- **errorMappingRulesJson** = gestisce errori specifici (rate limit, quota)
- **retryCount** + **timeoutMs** = configurabili

Non serve nuovo codice infrastructure. Serve solo:
1. Registrare un ApiService per SerpAPI nel DB
2. Bindarlo al Geometric tool `serp-crawling` step
3. Riscrivere `invokeCrawling` per usare **esclusivamente** la SERP API per Geometric

## Architettura Aggiornata

### Geometric — `invokeCrawling` (SOLO API)

```
┌──────────────────────────────────────────────────────────────────┐
│  invokeCrawling — Geometric (generation-system.actors.ts)        │
│                                                                  │
│  1. resolveApiService(SERP_API_SERVICE_ID)                       │
│     ↓                                                            │
│     Se non configurato → return CRAWLING_FAILED                  │
│     (config error: non mascherare con dati vuoti)                │
│     ↓                                                            │
│  2. executeApiAcquisition({ service, query, language, country }) │
│     ↓                                                            │
│  3. Se 429/quota → retry con backoff (max retryCount)            │
│     Se ancora KO → return CRAWLING_FAILED                        │
│     ↓                                                            │
│  4. normalizeSerpApiResponse(payload)                            │
│     → SerpSource[], SerpAIOverviewSnippet, PAAQuery[]            │
│     → queryHints[] (related_searches, non PAAQuery per DDD-118) │
│     ↓                                                            │
│  5. return CRAWLING_COMPLETED                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Futuri tool — Puppeteer rimane disponibile

```
┌──────────────────────────────────────────────────────────────────┐
│  invokeCrawling — Tool generico con Puppeteer                    │
│                                                                  │
│  1. crawlSerp(url, language, country)  ← Puppeteer               │
│     → SerpSource[], SerpAIOverviewSnippet, screenshotPath        │
│     ↓                                                            │
│  2. return CRAWLING_COMPLETED                                    │
└──────────────────────────────────────────────────────────────────┘
```

Esempi di futuri tool che beneficiano di Puppeteer:
- Webfetch di articoli blog
- Scraping di pagine prodotto (e-commerce non protetto)
- Estrazione contenuto da CMS statici

## Configurazione SerpAPI — `engine=google`

L'engine `google` standard è la scelta corretta per Geometric: fornisce in una sola chiamata tutti i dati necessari.

| Campo | Valore |
|-------|-------|
| baseUrl | `https://serpapi.com` |
| resourcePath | `/search.json` |
| accessMode | `query-param` |
| tokenParamName | `api_key` |
| requestMethod | `GET` |
| timeoutMs | `15000` |
| retryCount | `2` |

**Request template** (parametri fissi per tutte le richieste):
```json
{
  "query": {
    "engine": "google",
    "num": "10"
  }
}
```

**Request mapping** (parametri dinamici):
```json
[
  { "sourcePath": "input.query",    "targetPath": "query.q",  "required": true },
  { "sourcePath": "input.language", "targetPath": "query.hl"                   },
  { "sourcePath": "input.country",  "targetPath": "query.gl"                   }
]
```

**Response mapping**:
```json
[
  { "sourcePath": "organic_results",    "targetPath": "sources",          "required": false },
  { "sourcePath": "answer_box.snippet", "targetPath": "aiOverviewSnippet"                   },
  { "sourcePath": "related_questions",  "targetPath": "paaQuestions"                        },
  { "sourcePath": "related_searches",   "targetPath": "relatedSearches"                     }
]
```

**Error mapping**:
```json
[
  { "statusCode": 429, "errorCode": "rate_limited",    "message": "SerpAPI rate limit exceeded"    },
  { "statusCode": 401, "errorCode": "api_auth_failed", "message": "SerpAPI API key invalid"        },
  { "statusCode": 403, "errorCode": "quota_exceeded",  "message": "SerpAPI quota exhausted"        }
]
```

### PAA — People Also Ask e Related Searches

Tre campi distinti nella risposta SerpAPI `engine=google` per l'espansione del `QueryCluster`:

| Campo SerpAPI | Engine | Struttura | Semantica | Uso |
|---|---|---|---|---|
| `related_questions[]` | `google` | `{ question, snippet, title, link, next_page_token }` | "People Also Ask" — domande reali con risposta | ✅ **Fonte primaria PAA** |
| `related_searches[]` | `google` | `{ query, block_position, link }` | "People Also Search For" — query correlate | Fallback se PAA assenti |
| PAA espanse | `google_related_questions` | `{ question, type, snippet\|text_blocks, next_page_token }` | PAA aggiuntive via `next_page_token` | 🔄 Opzionale (fase 2) |

**Flusso PAA** — `engine=google_related_questions` è un engine separato che richiede un `next_page_token` dalla risposta `engine=google`. Non accetta query dirette:

```
Chiamata 1: engine=google + q=baseQuery
  → related_questions[].question     → PAAQuery[] (fino a 4)
  → related_questions[].next_page_token → token per espansione

Chiamata 2 (opzionale): engine=google_related_questions + next_page_token=<token>
  → related_questions[]  → PAA con snippet/AI answer strutturati
```

Due tipi di risposta PAA:
- `type: "featured_snippet"` — snippet testuale nel campo `snippet`
- `type: "ai_overview"` — risposta AI con `text_blocks[]` e `references[]`

## Implementation Steps

### Step 1 — Riscrivere `invokeCrawling` per Geometric (solo API)

**File**: `apps/backend/src/lib/machines/generation-system.actors.ts`

L'actor attuale chiama Puppeteer direttamente. **Il nuovo flusso Geometric non usa più Puppeteer**:

```
PRIMA (da rimuovere per Geometric):
1. crawlSerp() (Puppeteer)
2. discoverPAAQueries() (Puppeteer)

DOPO (Geometric — solo API):
1. resolveApiService(SERP_API_SERVICE_ID)
   → se null → return CRAWLING_FAILED "serp_api_not_configured"
2. executeApiAcquisition({ service, query: baseQuery, language, country })
   → retry automatico su 429 (max retryCount del servizio)
   → se fallisce → return CRAWLING_FAILED con reason dall'error mapping
3. normalizeSerpApiResponse(payload) → { sources, aiOverviewSnippet, paaQueries }
4. return CRAWLING_COMPLETED
```

La funzione `crawlSerp()` di Puppeteer non viene più chiamata in `invokeCrawling` per il Geometric tool. Rimane disponibile nell'adapter per futuri tool.

### Step 2 — Rimuovere `discoverPAAQueries()` dal path Geometric

**File**: `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts`

`discoverPAAQueries()` apre un browser Puppeteer separato per ogni PAA query. Con SerpAPI le PAA arrivano già dalla risposta principale (`related_questions[]`). La funzione rimane disponibile nell'adapter per futuri tool Puppeteer, ma non viene più chiamata per Geometric.

### Step 3 — Aggiungere env var `SERP_API_SERVICE_ID`

**File**: `apps/backend/src/server.ts`

```
SERP_API_SERVICE_ID=<uuid-dell-api-service-serp>
```

Se non impostata, `invokeCrawling` per Geometric ritorna `CRAWLING_FAILED` con reason `serp_api_not_configured`. Questo è il comportamento corretto — **non** un fallback silenzioso a Puppeteer.

### Step 4 — Registrare l'ApiService SerpAPI

Via admin UI o seed script.

```sql
INSERT INTO api_services (
  id, key, label, base_url, resource_path,
  access_mode,
  token_param_name,
  timeout_ms, retry_count, request_method,
  request_template_json,
  request_mapping_rules_json,
  response_mapping_rules_json,
  error_mapping_rules_json,
  status
) VALUES (
  gen_random_uuid(),
  'serpapi-google-standard',
  'SerpAPI Google Standard',
  'https://serpapi.com',
  '/search.json',
  'query-param',
  'api_key',
  15000, 2, 'GET',
  '{"query":{"engine":"google","num":"10"}}',
  '[{"sourcePath":"input.query","targetPath":"query.q","required":true},{"sourcePath":"input.language","targetPath":"query.hl"},{"sourcePath":"input.country","targetPath":"query.gl"}]',
  '[{"sourcePath":"organic_results","targetPath":"sources"},{"sourcePath":"answer_box.snippet","targetPath":"aiOverviewSnippet"},{"sourcePath":"related_questions","targetPath":"paaQuestions"},{"sourcePath":"related_searches","targetPath":"relatedSearches"}]',
  '[{"statusCode":429,"errorCode":"rate_limited","message":"SerpAPI rate limit exceeded"},{"statusCode":401,"errorCode":"api_auth_failed","message":"SerpAPI API key invalid"},{"statusCode":403,"errorCode":"quota_exceeded","message":"SerpAPI quota exhausted"}]',
  'active'
);
```

> **Note sulla struttura dati**: i campi mappano esattamente a `CreateApiServiceInput` in `api-service.adapter.ts`. `tokenCiphertext` (la chiave reale) viene salvata tramite admin UI separatamente — non va nel seed SQL per sicurezza.

### Step 5 — Binding al Geometric tool

**Nota DDD**: `workflowStepType = 'crawling'` (DDD-116) è il valore semanticamente corretto.

```sql
-- Upsert via upsertApiServiceBinding() in api-service.adapter.ts
INSERT INTO api_service_tool_step_bindings (
  api_service_id, tool_key, step_key,
  workflow_step_type,
  binding_status, requiredness
) VALUES (
  <serp-api-service-id>, 'geometric', 'serp-crawling',
  'crawling',
  'active', 'required-by-tool-setting'
)
ON CONFLICT (api_service_id, tool_key, step_key) DO UPDATE SET
  workflow_step_type = EXCLUDED.workflow_step_type,
  binding_status = EXCLUDED.binding_status,
  requiredness = EXCLUDED.requiredness,
  updated_at = NOW();
```

### Step 6 — Domain Translation: SerpAPI Google Standard → Concetti di Dominio

Normalizer `normalizeSerpApiResponse(payload)` in `crawling.adapter.ts`:

**Fonti competitor:**

| Campo SerpAPI | Concetto di Dominio | Tipo | Note |
|---|---|---|---|
| `organic_results[].title` | `SerpSource.title` | `string` | Titolo del risultato organico |
| `organic_results[].link` | `SerpSource.url` | `string` | URL del dominio competitor |
| `organic_results[].snippet` | `SerpSource.snippet` | `string \| null` | Snippet di testo |
| `organic_results[].displayed_link` | `SerpSource.domain` | `string` | Per scoring |
| `organic_results[].position` | `SerpSource.position` | `number` | Posizione SERP |

**AI Overview:**

| Campo SerpAPI | Concetto di Dominio | Tipo | Note |
|---|---|---|---|
| `answer_box.snippet` | `SerpAIOverviewSnippet` | `string \| null` | Può essere assente |

**Query espansione QueryCluster:**

| Campo SerpAPI | Concetto di Dominio | Semantica |
|---|---|---|
| `related_questions[].question` | `PAAQuery` | **Fonte primaria** — "People Also Ask": domande PAA canoniche (DDD-118) con risposta |
| `related_questions[].snippet` | *(metadata)* | Risposta quando `type: "featured_snippet"` |
| `related_questions[].next_page_token` | *(token espansione)* | Per `engine=google_related_questions` (opzionale) |
| `related_searches[].query` | *(query hint non-PAA)* | "People Also Search For" — **non è `PAAQuery`** (DDD-118): query correlate senza risposta, non derivate da "People Also Ask". Usato come sorgente alternativa per espansione `QueryCluster` quando PAA è assente, ma classificato come query hint distinto. |

> **Nota DDD**: `PAAQuery` è canonicamente definito come "Google People Also Ask correlated query" (DDD-118). `related_searches[]` sono query correlate di tipo diverso ("People Also Search For"). Mescolare i due come `PAAQuery` viola la semantica. Il normalizer deve tenere separati i due tipi e usare `PAAQuery` solo per `related_questions[].question`.

**Mappatura `SerpSourceType`** — i valori canonici sono definiti nel glossario (DDD-114, status: provisional):
- `organic_results[]` → `SerpSourceType.ORGANIC_WEBSITE`
- `paid_results[]` (se presente) → `SerpSourceType.SPONSORED_ADS`
- `video_results[]` con `youtube.com` → `SerpSourceType.YOUTUBE_VIDEO`
- `video_results[]` altri → `SerpSourceType.SOCIAL_MEDIA` (approssimazione conservativa)

**Normalizer — logica priorità PAA e separazione concettuale:**

```typescript
// PAAQuery (DDD-118): SOLO da related_questions — "People Also Ask"
const paaQueries: string[] = Array.isArray(payload.paaQuestions)
  ? (payload.paaQuestions as { question?: string }[])
      .map(q => q.question)
      .filter((q): q is string => typeof q === 'string' && q.length > 0)
      .slice(0, 4)
  : [];

// queryHints: da related_searches — "People Also Search For" (NON PAAQuery)
// Usati separatamente per eventuale espansione del QueryCluster
const queryHints: string[] = Array.isArray(payload.relatedSearches)
  ? (payload.relatedSearches as { query?: string }[])
      .map(s => s.query)
      .filter((q): q is string => typeof q === 'string' && q.length > 0)
      .slice(0, 4)
  : [];

// CrawlingResult output — conforme a CrawlingResult (DDD-114)
return {
  sources,           // SerpSource[] da organic_results
  aiOverviewSnippet, // SerpAIOverviewSnippet | null da answer_box
  paaQueries,        // PAAQuery[] da related_questions (DDD-118)
  queryHints,        // string[] da related_searches (non PAAQuery — held separate)
};

// Token PAA per espansione opzionale futura (conservati, non usati in MVP)
const paaTokens = Array.isArray(payload.paaQuestions)
  ? (payload.paaQuestions as { question?: string; next_page_token?: string }[])
      .filter(q => q.question && q.next_page_token)
      .map(q => ({ question: q.question!, token: q.next_page_token! }))
      .slice(0, 4)
  : [];
```

### Step 7 — Error Handling: SERP API → CRAWLING_FAILED (no fallback)

Con la rimozione del fallback Puppeteer, ogni errore SERP API diventa un `CRAWLING_FAILED` esplicito che il `generationSystemMachine` gestisce via `resolvingFallbackPolicy`:

| Scenario | HTTP Status | Reason Code | Comportamento |
|---|---|---|---|
| SERP API non configurata | — | `serp_api_not_configured` | `CRAWLING_FAILED` — config error, richiede setup |
| Rate limit | `429` | `crawling_rate_limited` | Retry max `retryCount`, poi `CRAWLING_FAILED` |
| Quota esaurita | `403` | `crawling_quota_exceeded` | `CRAWLING_FAILED` — richiede upgrade piano |
| API key non valida | `401` | `crawling_api_auth_failed` | `CRAWLING_FAILED` — config error |
| Timeout | — | `crawling_api_timeout` | `CRAWLING_FAILED` dopo timeout |
| Errore di rete | — | `crawling_api_network_error` | `CRAWLING_FAILED` |
| SERP API OK | 200 | — | `CRAWLING_COMPLETED` con dati strutturati |

## Comportamento del sistema a fronte di errori

| Scenario | Risultato visibile all'utente | Log |
|---|---|---|
| SERP API OK | Workflow Geometric completa normalmente | `crawling.completed` |
| SERP API non configurata | 500 con `failureReason: serp_api_not_configured` | `crawling.failed.serp_api_not_configured` |
| Quota esaurita | 500 con `failureReason: crawling_quota_exceeded` | `crawling.failed.quota_exceeded` — upgrade piano |
| Rate limit (tutti i retry esauriti) | 500 con `failureReason: crawling_rate_limited` | `crawling.failed.rate_limited` — ridurre frequenza |

Questo è preferibile al comportamento precedente in cui Puppeteer silenziosamente ritornava zero fonti con status 500 ugualmente.

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
| SERP API down | Bassa | Alto | Alert monitoring; il tool fallisce esplicitamente; pianificare multi-provider |
| Quota esaurita | Media | Alto | Alert a soglia 80%; upgrade piano automatico o manuale |
| Formato risposta cambia | Bassa | Alto | Response mapping configurabile via DB (no deploy); test di integrazione periodici |
| Costi superiori al previsto | Bassa | Basso | Monitoraggio usage; quota/mese configurabile |
| Provider SERP API depreca endpoint | Bassa | Medio | `ApiService` registrato in DB — cambio provider = nuovo record + binding, no codice |

## Alternatives Considerate

- **ALT-001**: Puppeteer + fallback per Geometric — Rifiutato: Google blocca sistematicamente; il fallback è illusorio e maschera il problema con dati vuoti e 500 uguale
- **ALT-002**: Proxy rotation + Puppeteer — Rifiutato: costi proxy residenziali elevati, manutenzione continua, efficacia incerta contro Google 2026
- **ALT-003**: Bing Web Search API — Rifiutato: risultati su Google SERP sono il requisito; Bing non sostituisce Google per GEO analysis
- **ALT-004**: Adapter SERP API dedicato — Rifiutato: il sistema `ApiService` esistente è sufficiente; nessun nuovo codice infrastructure
- **ALT-005**: SerpAPI `engine=google_ai_mode` — Non scelto come primary: non restituisce `organic_results` né PAA standard; adatto come enrich opzionale dello snippet AI in una fase futura

## Blockers

### BLOCKER-001 — `accessMode: 'query-param'` non supportato dall'adapter ✅ RISOLTO

**Stato**: Risolto il 2026-06-14. Migrazione `20260614_000017_add_token_param_name_column.sql` applicata.

**Variazioni applicate**:

1. **`api-service.ts`** — `ApiServiceAccessMode` esteso:
```typescript
export type ApiServiceAccessMode = 'public' | 'token' | 'query-param';
```

2. **`CreateApiServiceInput`** — campo aggiunto:
```typescript
tokenParamName?: string | null;  // es. 'api_key' per SerpAPI
```

3. **Migrazione DB** — colonna aggiunta in `api_services`:
```sql
ALTER TABLE api_services ADD COLUMN token_param_name TEXT DEFAULT NULL;
```

4. **`api-acquisition.adapter.ts`** — token iniettato come query param:
```typescript
if (input.service.accessMode === 'query-param' && input.service.tokenCiphertext) {
  requestEnvelope.query[input.service.tokenParamName ?? 'api_key'] = input.service.tokenCiphertext;
}
```

5. **`api-service-validation.ts`** — validazione aggiornata per accettare `'query-param'`.

6. **Contracts** — `packages/contracts/src/api-service.ts` aggiornato con nuovo campo e tipo.

**Decisione DDD**: DDD-130 nel domain-naming-decision-log.md.

---

### BLOCKER-002 — `workflowStepType` nel binding supporta solo `'acquisition'` ✅ RISOLTO

**Stato**: Risolto il 2026-06-14. Migrazione `20260614_000018_extend_workflow_step_type_constraint.sql` applicata.

**Variazioni applicate**:

1. **`api-service.ts`** — tipo esteso:
```typescript
workflowStepType: 'acquisition' | 'crawling';
```

2. **`api-service.adapter.ts`** — `UpsertApiServiceBindingInput` aggiornato:
```typescript
workflowStepType?: 'acquisition' | 'crawling';
```

3. **Migrazione DB** — CHECK constraint aggiornato su `api_service_tool_step_bindings.workflow_step_type`:
```sql
-- Constraint aggiornato a: CHECK (workflow_step_type IN ('acquisition', 'crawling'))
```

4. **Contracts** — `packages/contracts/src/api-service.ts` aggiornato con opzioni estese.

---

### BLOCKER-003 — `resolveApiServiceForAcquisition` ha naming fuorviante per step `crawling` ✅ RISOLTO

**Stato**: Risolto il 2026-06-14. Alias aggiunti senza breaking changes.

**Variazioni applicate**:

```typescript
// Alias aggiunti in api-service.adapter.ts
export const resolveApiServiceForCrawling = resolveApiServiceForAcquisition;
export const resolveApiServiceById = resolveApiServiceForAcquisition;
```

La funzione originale mantiene il nome per backward compatibility. JSDoc aggiornato per chiarire che funziona per qualsiasi step type.

---

### Step 5 — Binding al Geometric tool

Il binding usa `workflowStepType: 'crawling'` come valore semanticamente corretto (DDD-116).

## Related

- [Geometric Tool Plan](../99-lifecycle/99-archive/plans/feature-geometric-tool-1.md)
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md) — DDD-129
- [Domain Bounded Context Map](./domain-bounded-context-map.md) — Crawling & Extraction Context
