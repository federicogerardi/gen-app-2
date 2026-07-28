---
type: source-summary
tags:
  - wiki/source
  - llm-models
  - tool-steps
  - generation
  - proposal
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/llm-model-step-override-proposal.md
date_ingested: 2026-07-28
source_version: 2.0
---

# LLM Model Step Override System

Implemented proposal introducing per-step LLM model override configuration, allowing tools to specify default models for individual `[[WorkflowStep]]`s that override user selection when configured.

## DDD Prerequisites (DDD-150/151/152)

Three domain concepts approved:
- `[[StepLlmModelOverrideConfig]]` — Value Object for static per-step override configuration `{ toolKey, stepKey, overrideModelId, reason? }`
- `[[StepLlmModelResolver]]` — Domain Service resolving effective model via precedence: static override → user selection → system default (`openrouter/auto`)
- `[[EffectiveModelResolution]]` — Value Object with resolution metadata: `{ effectiveModel, source, overrideReason?, originalUserModel? }`

## Precedence Rules

Static override takes highest priority. When configured, overrides user selection during generation. Resolution is synchronous using in-memory configuration.

## Implementation Scope

Backend-only: `step-llm-model-overrides.config.ts` (static config), `step-llm-model-resolver.ts` (resolution service). No runtime CRUD — overrides are code-space configuration validated against canonical registries at startup.

## Contradictions

None.

## Source

- File: `docs/02-design/llm-model-step-override-proposal.md`
- Version: 2.0
- Last reviewed: 2026-07-16
- Owner: Domain Architecture
- Implementation date: 2026-07-16