---
type: source-summary
tags:
  - wiki/source
  - wiki/plan
  - wiki/routeIsGeometric
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_file: docs/05-plans/fix-geometric-duplicate-crawling-plan.md
source_version: "2.1"
date_ingested: 2026-07-28
---

# Fix Geometric Duplicate Crawling — Source Summary

Implementation plan (v2.1, **implemented** 2026-07-28) to eliminate all geometric-specific exceptions from the [[Wiki/entities/generation-system|GenerationSystem]] routing layer.

## Status: ✅ Implemented

Pipeline end-to-end verified on dev DB (Railway):
- 1 SerpApi call + 1 scoring LLM + 2 generation LLM (was 4+4+4)
- All `{{output_step_xxx}}` placeholders replaced correctly
- PAA queries, baseQuery, brandName injected via enriched step dependency content
- `competitor-scoring` step skipped via Phase 2 optimization
- `maxTokens` override (8192) via `StepLlmModelOverride` config
- 452 tests passing, zero regressions on 10 non-geometric tools

## Core Problem

The [[Wiki/concepts/routing-layer|routing layer]] hardcodes geometric tool identity via two guards:
- `routeIsGeometric` — matches `toolKey === 'geometric'`, routes to `crawlingFlow`
- `isNotGeometric` — excludes geometric from normal paths

This causes every step of a geometric job to go through the full `crawlingFlow → scoringFlow → dispatchingMode → generating` pipeline, resulting in 4× SerpApi calls and 4× scoring LLM calls per job.

## Solution

Replace tool-specific guards with step-type-based guards reading from [[Wiki/concepts/step-type-registry|STEP_TYPE_BY_TOOL_AND_STEP]]:

**Removed:**
- `routeIsGeometric` guard
- `isNotGeometric` guard
- `routeIsGeometric` branch in routing state

**Added:**
- `routeIsCrawlingStep` — data-driven guard matching `WorkflowStepType === 'crawling'`
- `routeIsScoringStep` — data-driven guard matching `WorkflowStepType === 'scoring'`

**Preserved:**
- `crawlingFlow → scoringFlow` auto-chain (legitimate domain behavior: scoring is deterministic transformation of crawling data)

## Philosophy

`[key::registry-driven-routing]` `[key::no-tool-exceptions]` `[key::be-driven-architecture]`

The routing layer must never reference a specific `[[Wiki/concepts/toolkey|ToolKey]]`. Discrimination happens exclusively via `WorkflowStepType`. Any future tool adding crawling/scoring step types to the registry gets correct routing automatically — zero code changes.

## DDD Impact

- `crawling` reclassified as specialized `acquisition` at domain level (glossary + DDD entry)
- `scoring` remains distinct — it's deterministic computation, not API retrieval or LLM generation
- Glossary stale note removed for `crawling`/`scoring` (marked "pending implementation" but implemented since DDD-116, 2026-06-12)

## Files Touched

5 BE files + 1 glossary + 1 DDD log + 4 test files. Key modifications:
- [[Wiki/entities/generation-system|generation-system.guards.ts]] — remove 2 guards, add 2 data-driven guards
- [[Wiki/entities/generation-system|generation-system.request.states.ts]] — replace `routeIsGeometric` branch
- [[Wiki/entities/generation-system|generation-system.actions.ts]] — remove type reference
- [[Wiki/entities/tool-workflow-job|tool-workflow-registry.ts]] — export `STEP_TYPE_BY_TOOL_AND_STEP`
- [[Wiki/entities/tool-workflow-job|tool-workflow-job-processor.ts]] — data-driven scoring extraction

## Contradictions

None.