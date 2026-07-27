---
type: entity
tags:
  - wiki/entity
  - generation
  - llm
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Generation
source_count: 3
entity_type: entity
---

# LlmModel

An administrator-managed LLM endpoint available for generation. Persisted in the `llm_models` table.

## Attributes

- `id` — surrogate DB key
- `key` ([[LlmModelId]]) — canonical identifier, form `${provider}/${model}` (e.g. `openrouter/auto`)
- `label` — display name
- `status` ([[LlmModelStatus]]) — `enabled` or `disabled`
- `sortOrder` — optional UI ordering

## Lifecycle

Admin CRUD operations require `AuthUserRole = 'admin'`. Disabled models are hidden from user selection but preserved for audit continuity in artifact history.

## Catalog & Selection

[[LlmModelCatalog]] is the admin-managed ordered collection. Frontend consumes `enabled` entries via `GET /api/models` and projects as the [[LlmModelSelector]].

## Model Override

[[StepLlmModelOverrideConfig]] allows static per-step model overrides. [[StepLlmModelResolver]] resolves the effective model with precedence: static override → user selection → system default (`openrouter/auto`).

## UI Positioning (DDD-219, DDD-220)

The model selector is rendered in the Knowledge Section header for asset-capable tools. For non-asset-capable tools, the model is determined solely by `defaultModel`.

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-053 through DDD-057, DDD-219 through DDD-221)