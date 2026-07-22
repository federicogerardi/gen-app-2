---
status: active
version: 1.0
date_created: 2026-05-24
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Backend Runtime
type: reference
tags: [geometric, crawling, serp, schematic, operations]
---

# Geometric Tool — Sequence of Operations (Schematic)

## 1. User Input (Direct Input)
```
┌─────────────────────────────────────────────────────────┐
│  Base query: "protein supplements"                        │
│  Language: "it"                                          │
│  Country / Google Domain: "google.it"                   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
```

## 2. Phase 1 — Crawling & Extraction (SERP + PAA)
```
┌──────────────────────────────────────────────────────────────┐
│  STEP: crawl-serp                                            │
│  Type: crawling                                              │
├──────────────────────────────────────────────────────────────┤
│  Actor: invokeCrawling (fromPromise)                         │
│  Queue: BullMQ (concurrency 3, retry 3x)                     │
│  Adapter: SerpApi (Google Search + AI Overview APIs)         │
├──────────────────────────────────────────────────────────────┤
│  Operation:                                                  │
│    1. Call SerpApi Google Search API                         │
│    2. Extract AI Overview (with separate request if needed)  │
│    3. Normalize response to structured data:                 │
│       • AI Overview snippet                                  │
│       • Organic results (title, URL, snippet)                │
│       • PAA (People Also Ask) questions                      │
│    4. For each PAA query → parallel API call                 │
│    5. Merge results, return structured payload               │
├──────────────────────────────────────────────────────────────┤
│  Output: CRAWLING_COMPLETED                                  │
│  {                                                           │
│    crawlArtifacts: [                                         │
│      { query, content, structuredPayload: { sources,         │
│        paaQueries } }                                        │
│    ],                                                        │
│    paaQueries: ["What is the best protein?", ...]           │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
```

## 3. Phase 2 — Competitor Analysis (Scoring)
```
┌──────────────────────────────────────────────────────────────┐
│  STEP: score-competitors                                     │
│  Type: scoring                                               │
├──────────────────────────────────────────────────────────────┤
│  Actor: invokeScoring (fromPromise)                          │
│  Engine: Pure function (no side effects)                     │
├──────────────────────────────────────────────────────────────┤
│  Operation:                                                  │
│    1. Receive crawling output (sources + snippets)           │
│    2. For each competitor domain:                            │
│       • Detect SERP features (organic, sitelink,             │
│         video, sponsored)                                    │
│       • Apply weights:                                       │
│         organic  = 3.0                                       │
│         sitelink = 2.0                                       │
│         video    = 2.0                                       │
│         sponsored= 1.5                                       │
│    3. Normalize to 1-100 scale (geoScore)                  │
│    4. Assign tier:                                           │
│         S = 90-100                                           │
│         A = 70-89                                            │
│         B = 50-69                                            │
│         C = <50                                               │
│    5. Return ranked map                                      │
├──────────────────────────────────────────────────────────────┤
│  Output: SCORING_COMPLETED                                   │
│  {                                                           │
│    ranking: {                                                │
│      "healthline.com": { geoScore: 92, tier: "S" },         │
│      "myprotein.com":  { geoScore: 78, tier: "A" },         │
│      "bodybuilding.com": { geoScore: 65, tier: "B" }        │
│    }                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
```

## 4. Phase 3 — Strategic Reporting (LLM Prompt A)
```
┌──────────────────────────────────────────────────────────────┐
│  STEP: generate-strategic-report                             │
│  Type: generation                                            │
├──────────────────────────────────────────────────────────────┤
│  Input Assembly (selectGeometricAssembly):                   │
│    {                                                         │
│      serpSnippets: ["AI overview: ...", "PAA result: ..."],  │
│      paaQueries: ["What is the best protein?", ...],        │
│      competitorRanking: {                                    │
│        "healthline.com": { geoScore: 92, tier: "S" }         │
│      }                                                       │
│    }                                                         │
├──────────────────────────────────────────────────────────────┤
│  Prompt: prompt_strategic_reporting.md                        │
├──────────────────────────────────────────────────────────────┤
│  Output: Strategic analysis text (markdown)                  │
│    • Content gap analysis                                    │
│    • Competitive angle recommendations                       │
│    • SERP feature opportunities                            │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
```

## 5. Phase 4 — Unified Report (LLM Prompt B)
```
┌──────────────────────────────────────────────────────────────┐
│  STEP: generate-unified-report                               │
│  Type: generation                                            │
├──────────────────────────────────────────────────────────────┤
│  Input Assembly (selectGeometricAssembly):                   │
│    {                                                         │
│      competitorRanking: {                                    │
│        "healthline.com": { geoScore: 92, tier: "S" }         │
│      }                                                       │
│    }                                                         │
├──────────────────────────────────────────────────────────────┤
│  Prompt: prompt_unified_report.md                           │
├──────────────────────────────────────────────────────────────┤
│  Output: Comprehensive competitor report (markdown + docx)  │
│    • Executive summary                                       │
│    • Competitor scorecards                                   │
│    • Actionable recommendations                              │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
```

## 6. Final Output
```
┌──────────────────────────────────────────────────────────────┐
│  ARTIFACTS:                                                  │
│    • artifact-crawl-001    (crawling data)                   │
│    • artifact-score-001    (competitor ranking)                │
│    • artifact-strategic-001  (strategic report)              │
│    • artifact-unified-001    (unified report)                │
├──────────────────────────────────────────────────────────────┤
│  DOWNLOADABLE FORMATS:                                       │
│    • Markdown (.md)                                        │
│    • Word (.docx) — via markdown-docx                      │
└──────────────────────────────────────────────────────────────┘
```

## 7. Data Flow Diagram (Simplified)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User Input │────▶│  Crawling   │────▶│  Scoring    │────▶│  Strategic  │────▶│   Unified   │
│  (3 fields) │     │  (SERP+PAA) │     │  (weights)  │     │  Reporting  │     │   Report    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                  │                  │                  │
       │                  │                  │                  │                  │
       │           ┌──────┘                  │                  │                  │
       │           │   sources[]              │                  │                  │
       │           │   paaQueries[]         │                  │                  │
       │           │   snippets             │                  │                  │
       │           │                        │                  │                  │
       │           └────────────────────────┘                  │                  │
       │                     │                                 │                  │
       │              ┌──────┘                                 │                  │
       │              │   ranking: { domain → geoScore, tier }   │                  │
       │              │                                        │                  │
       │              └────────────────────────────────────────┘                  │
       │                                │                                         │
       │                         ┌──────┘                                         │
       │                         │   serpSnippets + paaQueries + competitorRanking │
       │                         │                                                │
       │                         └────────────────────────────────────────────────┘
       │                                              │
       │                                       ┌──────┘
       │                                       │   competitorRanking
       │                                       │
       │                                       └────────────────────────────────────
       │                                                            │
       │                                                            ▼
       │                                                  ┌─────────────────┐
       │                                                  │  Final Output   │
       │                                                  │  (.md + .docx)  │
       │                                                  └─────────────────┘
```

## 8. Key Architectural Rules

| Rule | Implementation |
|------|----------------|
| **No file upload** | Direct input only (`allowNoFiles: true`) |
| **DDD governance** | All domain terms in canonical glossary |
| **Admin-only rollout** | `enabled-for-admin-only` policy |
| **BullMQ queue** | Concurrency 3, retry 3x, exponential backoff |
| **Pure scoring** | Deterministic weights, no external deps |
| **Pass-through chains** | `crawling-chain.machine.ts` + `scoring-chain.machine.ts` |
| **Contract-first** | All types in `packages/contracts` before implementation |
