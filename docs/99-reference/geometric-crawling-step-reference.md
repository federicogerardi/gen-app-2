---
status: active
version: 1.0
last-reviewed: 2026-06-12
next-review-date: 2026-07-12
owner: Backend Runtime
date_created: 2026-06-12
title: Geometric Crawling Step — Backend Operations Reference
type: reference
tags: [geometric, crawling, backend, puppeteer, bullmq, xstate, serp, paa]
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

**File**: `generation-system.actors.ts:180-240`

```
invokeCrawling (fromPromise)
  │
  ├─ 1. Estrazione parametri da requestInput
  │     ├─ baseQuery    → root o extractionPayload (fallback)
  │     ├─ language     → root o extractionPayload (fallback)
  │     ├─ country      → root o extractionPayload (fallback)
  │     └─ brandName    → root o extractionPayload (fallback)
  │
  ├─ 2. Validazione: se baseQuery vuoto → CRAWLING_FAILED
  │
  ├─ 3. Log: crawling.start (requestId, baseQuery, language, country)
  │
  ├─ 4. crawlSerp(baseQuery) → risultato base
  │     └─ AI Overview snippet
  │     └─ sources[] (title, url, snippet, sourceType, sitelinks, videoMeta)
  │     └─ adsCount, videoCount
  │     └─ screenshotPath (storage only, mai inviato a LLM)
  │
  ├─ 5. discoverPAAQueries(baseQuery) → array di query PAA scoperte
  │
  ├─ 6. Se PAA scoperte (max 4):
  │     └─ Promise.all(crawlSerp(paaQuery) per ogni PAA)
  │        └─ Ogni PAA fallita → log warn, ignorata (non blocca il flusso)
  │
  ├─ 7. Merge risultati: base + PAA → crawlArtifacts[]
  │
  ├─ 8. Log: crawling.completed (durationMs, sourceCount, paaCount)
  │
  └─ 9. Ritorna: CRAWLING_COMPLETED
       └─ crawlArtifacts[]
       └─ paaQueries[]
```

---

## 3. Crawling Adapter — Puppeteer + Stealth

**File**: `crawling.adapter.ts`

### 3a. `crawlSerp(query, language, country)`

```
crawlSerp()
  │
  ├─ 1. Load Puppeteer + Stealth plugin
  │
  ├─ 2. Launch browser (headless, --no-sandbox, --disable-setuid-sandbox)
  │
  ├─ 3. Naviga a: https://www.{country}/search?q={query}&hl={language}
  │     └─ waitUntil: 'networkidle2', timeout: 30s
  │
  ├─ 4. Estrai AI Overview snippet:
  │     └─ Selettori: [data-snf], .AIHVYe, [data-attrid="wa:/description"]
  │
  ├─ 5. Estrai sources (max 12 risultati):
  │     └─ Selettori: .g, .Zmcmbc, .dbsr, .g-blk
  │     └─ Per ogni risultato:
  │        ├─ title (h3)
  │        ├─ url (a[href])
  │        ├─ snippet ([data-sncf], .VwiC3b, .s3v94d)
  │        ├─ sourceType:
  │        │  ├─ sponsored → .uEiDre, .tads, [data-text-ad], "Sponsorizzato"
  │        │  ├─ video → video, .hTjNSe, [data-ved*="video"], youtube.com
  │        │  ├─ sitelink → .s8GCU a, .VlD9Fd a (più di 0)
  │        │  ├─ ugc → reddit.com, quora.com, forum, community
  │        │  └─ organic → default
  │        ├─ sitelinks[] → se hasSitelinks
  │        └─ videoMeta → { platform, views } se isVideo
  │
  ├─ 6. Conta adsCount e videoCount
  │
  ├─ 7. Screenshot → /tmp/serp-{timestamp}-{random}.png
  │     └─ MAI inviato a LLM (token efficiency rule)
  │
  └─ 8. Ritorna: CrawlingResult
```

### 3b. `discoverPAAQueries(baseQuery, language, country)`

```
discoverPAAQueries()
  │
  ├─ 1. Launch browser + naviga (come crawlSerp)
  │
  ├─ 2. Clicca elementi PAA per espanderli:
  │     └─ Selettori: .related-question-pair, .PZPBZc, [jsname]
  │     └─ Per ogni elemento (max 4): click + waitForTimeout(1s)
  │
  ├─ 3. Estrai PAA queries:
  │     └─ Selettori: .related-question-pair, .PZPBZc
  │     └─ Max 4, filtra vuoti
  │
  └─ 4. Ritorna: string[] (PAA queries scoperte)
```

---

## 4. BullMQ Queue — Gestione Coda

**File**: `crawling-queue.ts`

```
BullMQ Queue 'geometric-crawling'
  │
  ├─ Configurazione:
  │  ├─ concurrency: 3 (env-configurable)
  │  ├─ retry: 3 tentativi con exponential backoff
  │  └─ progress reporting via job.updateProgress()
  │
  ├─ Worker:
  │  ├─ on('completed') → log: "Job {id} completed"
  │  └─ on('failed') → log: "Job {id} failed: {error}"
  │
  └─ Nota: La coda è gestita internamente dall'adapter
        L'XState machine vede solo un Promise
```

---

## 5. Merge Output — toolWorkflowMachine

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

## 6. Cache Result — Generation System Actions

**File**: `generation-system.actions.ts:245-246`

```
cacheCrawlingResult
  │
  └─ Aggiorna requestInput:
       └─ mergeCrawlingIntoGenerationInput(context.requestInput, crawlingOutput)
```

---

## 7. Context Assembly — Per Step Successivi

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

## 8. Guards — Validazione Output

**File**: `generation-system.guards.ts:59-60`

```
crawlingOutputIsAccepted
  │
  └─ getCrawlingDoneOutput(event)?.type === 'CRAWLING_COMPLETED'
```

---

## 9. Types — Contratto XState

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

## 10. Flusso Completo — Sequenza Temporale

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
│  5. crawlSerp(baseQuery) → Puppeteer + Stealth                       │
│     └─ Naviga google.it/search?q=protein+supplements&hl=it           │
│     └─ Estrai AI Overview + sources (max 12)                         │
│     └─ Screenshot /tmp/serp-*.png (MAI a LLM)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. discoverPAAQueries(baseQuery)                                    │
│     └─ Clicca PAA elements → estrai max 4 query                      │
│     └─ Esempio: ["What is the best protein?", "Is whey safe?"]       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. Promise.all(crawlSerp(paaQuery) per ogni PAA)                   │
│     └─ Ogni PAA → crawlSerp parallelo                                │
│     └─ PAA fallita → log warn, ignorata                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Merge risultati → crawlArtifacts[]                               │
│     └─ base + PAA results                                            │
│     └─ log: crawling.completed (durationMs, sourceCount, paaCount)   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  9. Ritorna: CRAWLING_COMPLETED                                      │
│     └─ toolWorkflowMachine: STEP_SUCCESS                             │
│        └─ mergeCrawlingOutput → assembledGenerationInput             │
│           └─ { crawling: { snippets, sources, paaQueries } }         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  10. Prossimo step: 'score-competitors'                              │
│      └─ invokeScoring legge assembledGenerationInput.crawling.sources│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. Regole Critiche

| Regola | Implementazione |
|--------|----------------|
| **No screenshot a LLM** | Screenshot salvato in `/tmp/`, mai incluso in `requestInput` |
| **PAA non bloccante** | 0 PAA queries = step valido, continua con base query |
| **PAA fallita = ignorata** | Singola PAA fallita → log warn, non blocca il flusso |
| **Fallback extractionPayload** | Se `baseQuery` non nel root, cerca in `extractionPayload` |
| **Deduplicazione PAA** | `Set<string>` per evitare query duplicate |
| **Max 4 PAA** | `.slice(0, 4)` per limitare il numero di crawl paralleli |
| **Timeout crawl** | 30s per navigazione, gestito da Puppeteer |
| **Anti-bot** | Stealth plugin + `--no-sandbox` in Docker/Railway |

---

## 12. File Correlati

| File | Scopo |
|------|-------|
| `generation-system.actors.ts` | `invokeCrawling` fromPromise actor |
| `crawling.adapter.ts` | Puppeteer + Stealth adapter |
| `crawling-queue.ts` | BullMQ queue configuration |
| `tool-workflow.machine.ts` | `mergeCrawlingOutput` action |
| `generation-system.guards.ts` | `crawlingOutputIsAccepted` guard |
| `generation-system.actions.ts` | `cacheCrawlingResult` action |
| `context-generation-assembly.ts` | `mergeCrawlingIntoGenerationInput` helper |
| `generation-system.types.ts` | `CrawlingDoneOutput`, `CacheCrawlingResultParams` |
