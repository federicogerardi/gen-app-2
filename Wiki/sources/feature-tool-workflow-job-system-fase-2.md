---
type: source-summary
tags:
  - wiki/source
  - implementation-plan
  - bullmq
  - tool-workflow-job
  - refactoring
  - postgres
  - payload-propagation
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/05-plans/feature-tool-workflow-job-system-fase-2.md
date_ingested: 2026-07-28
source_version: "2.1"
---

# ToolWorkflowJob System — Fase 2 Implementation Plan

Piano di hardening production-grade per il sistema [[ToolWorkflowJob]]. Status: **implemented** (2026-07-24). Stima: 11-13 giorni.

## Bug Strutturali Risolti

| # | Bug | Soluzione |
|---|-----|-----------|
| B1 | Crawling+scoring rieseguiti per ogni step (SerpApi calls ×4 per geometric) | Pillar A: content injection da step precedenti |
| B2 | `stepDependencyArtifactIds` risolti ma non usati | Pillar A: context injection in `runCrawlingStep`/`runScoringStep` |
| B3 | Nessuna risoluzione artifact content — placeholder `{{output_step_xxx}}` vuoti | Pillar A: `completedStepContents` map + `stepDependencyArtifactContentsByStep` |
| B4 | Admin Data Table stub | Pillar D: hook SWR reale |
| B5 | `sessionStorage` workaround per resume | Pillar D: discovery endpoint |

## 4 Pillars

| Pillar | Ambito | Giorni | Dettaglio |
|--------|--------|--------|-----------|
| **A** — Payload Propagation | Content injection tra step, crawling/scoring context, `stepDependencyArtifactContentsByStep` | 5 | Risolve B1, B2, B3 |
| **B** — Postgres `tool_jobs` | Tabella, repository Kysely, dual-write processor, aggregazione costo/token, read path migration | 3 | Risolve B4, B5 |
| **C** — Deployment Worker | Verifica `worker-entry.ts`, Dockerfile multi-service, Railway config, smoke test cross-processo | 1.5 | Separazione HTTP/worker |
| **D** — Admin & Discovery | Discovery endpoint, SWR hook reale, toolbar filtri, cost/token admin, rimozione sessionStorage | 2.5 | Risolve B4, B5 |

## Post-Implementation Bug Fixes (Smoke Test)

5 bug trovati e risolti:
1. **Idempotency deadlock**: `checkAndClaim` ora cancella record `failed` prima del re-claim
2. **Single-flight lock leak**: lock rilasciato anche su cancel/fail, stale-lock guard al submit
3. **`contentBuffer` vuoto per crawling/scoring**: estrazione dati strutturati da `context.requestInput`
4. **`brandName`/`baseQuery` non propagati**: promossi da `extractionPayload` al top-level `requestInput`
5. **SerpApi ri-eseguita (B1)**: NON risolto — rimandato a Fase 3 (long-lived actor)

## Contradictions

None.

## Source

- File: `docs/05-plans/feature-tool-workflow-job-system-fase-2.md`
- Version: 2.1
- Status: implemented (2026-07-24)
- Owner: Backend Runtime + Frontend Tools