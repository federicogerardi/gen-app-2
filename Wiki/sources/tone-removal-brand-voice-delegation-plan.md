---
type: source-summary
tags:
  - wiki/source
  - tone
  - brand-voice
  - asset-injection
  - refactoring
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/tone-removal-brand-voice-delegation-plan.md
date_ingested: 2026-07-28
source_version: 1.1
---

# Tone Removal — Brand Voice Delegation Plan

Completed implementation plan removing the standalone `tone` parameter (`[[ToneProfile]]`: Professional/Casual/Formal/Technical) from all generation layers and delegating tone specification to `'brand-voice'` [[Asset]] injection via `[[AssetFieldMapping]]` (DDD-207).

## Rationale

Tone is a brand property, not a discrete per-generation parameter. The `[[tov-generator]]` already produces `brand-voice` assets with a `tone` field. Selecting tone standalone creates redundancy and potential inconsistency with the brand voice asset content.

## Implementation Approach

Three-layer removal: FE form (Zod schema, dropdown, copy keys), FE runtime (contracts, dispatch payload), BE generation (prompt assembly, extraction tone). The XState machine never depended on `tone` — guards use `projectId`, `extractionContext`, `primaryTargetStep`, `requiredAssets` only.

## Critical FE Blocker

Zod schema at `ToolPageTemplate.tsx:324` had `tone: z.string().min(1, ...)` — removing the field from the form but keeping it in Zod would dead-lock all 11 tools (form always invalid, `handleSubmit` never fires). The dropdown was unconditional — rendered on all tools.

## DDD Alignment

`[[RequestTone]]` and `[[ToneProfile]]` deprecated (DDD-216). Extraction operational tone `analitico` eliminated — LLM self-determines tone autonomously from step prompt. `ExtractionContext.tone` (briefing-derived) unaffected.

## Contradictions

None.

## Source

- File: `docs/02-design/tone-removal-brand-voice-delegation-plan.md`
- Version: 1.1
- Last reviewed: 2026-07-19
- Owner: Generation Team