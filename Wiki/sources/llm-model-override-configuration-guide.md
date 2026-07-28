---
type: source-summary
tags:
  - wiki/source
  - llm-models
  - override
  - configuration
  - development-guide
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/03-development/llm-model-override-configuration-guide.md
date_ingested: 2026-07-28
source_version: 1.0
---

# LLM Model Override Configuration Guide

Developer guide for configuring per-step LLM model overrides via `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts`.

## Configuration Format

```typescript
STEP_LLM_MODEL_OVERRIDES = {
  [createOverrideKey('tool-key', 'step-key')]: {
    toolKey, stepKey, overrideModelId: 'openrouter/provider/model', reason?
  }
} as const;
```

Key: `createOverrideKey(toolKey, stepKey)` → `tool-key::step-key`. Values validated at startup against canonical registries.

## Precedence

1. Static override (highest)
2. User selection
3. System default (`openrouter/auto`)

## Validation

At startup: `validateStepLlmModelOverrides()` checks all `overrideModelId` values against `LlmModelCatalog`, all `(toolKey, stepKey)` pairs against `toolWorkflowRegistry`. Invalid configs throw at startup — fail-fast.

## Contradictions

None.

## Source

- File: `docs/03-development/llm-model-override-configuration-guide.md`
- Version: 1.0
- Last reviewed: 2026-07-07
- Owner: Backend Runtime