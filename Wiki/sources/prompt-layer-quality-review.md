---
type: source-summary
tags:
  - wiki/source
  - prompt-engineering
  - quality-review
  - tool-generation
  - completed
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/prompt-layer-quality-review.md
date_ingested: 2026-07-28
source_version: 1.2
---

# Prompt Layer Quality Review

Completed quality review of 34 prompt templates across 12 tools. Remediation plan fully implemented 2026-07-23.

## Findings

Quality strongly uneven: funnel-pages prompts (5-star benchmark), most others skeletal without methodology, examples, or anti-hallucination guardrails. Primary gap is template content (depth, examples, anti-patterns, cross-tool consistency), not architecture.

## Key Decisions

| Decision | Topic |
|----------|-------|
| D1 | Remove broken `prompt_root.md` references from 6 tools |
| D2 | System instructions English, artifact output Italian |
| D3 | Remediation order: foundation tools (brief-gen, tov-gen, personas-gen) first |
| D4 | Synthetic gold-standard examples now; real data later (when DDD-179 ready) |
| D5 | Dynamic chain-awareness via `{{output_step_<stepKey>}}` placeholders |

## Per-Tool Ratings

Funnel-pages ⭐⭐⭐⭐⭐, angle-generator ⭐⭐⭐⭐, meta-ads ⭐⭐⭐, rest ⭐⭐ (thin/no methodology). Remediation upgraded all 34 templates with anti-hallucination guardrails, chain awareness, persona rules, role/guardrails/checklists, feedback instructions, and placeholder documentation.

## Contradictions

None.

## Source

- File: `docs/02-design/prompt-layer-quality-review.md`
- Version: 1.2
- Last reviewed: 2026-07-23
- Owner: Backend Runtime