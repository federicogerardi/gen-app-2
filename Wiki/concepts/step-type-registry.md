---
type: concept
tags:
  - wiki/concept
  - step-type
  - registry
  - workflow
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_count: 1
confidence: high
---

# STEP_TYPE_BY_TOOL_AND_STEP Registry

The canonical registry mapping `stepKey → WorkflowStepType` for tools with non-generation steps. Defined in `tool-workflow-registry.ts`.

## Structure

```typescript
export const STEP_TYPE_BY_TOOL_AND_STEP = {
  'geometric': {
    'serp-crawling': 'crawling',       // SerpApi data retrieval
    'competitor-scoring': 'scoring',   // Deterministic weighted-point computation
  },
  // Future tools: add entries here
};
```

Steps NOT listed are implicitly `WorkflowStepType = 'generation'` (LLM-driven content production).

## Consumers

| Consumer | How |
|----------|-----|
| `buildWorkflowPlan` | Attaches `type` metadata to `WorkflowStepDescriptor` |
| `routeIsCrawlingStep` guard | Routes to `crawlingFlow` |
| `routeIsScoringStep` guard | Routes to `scoringFlow` |
| `tool-workflow-job-processor` | Data-driven scoring content extraction |

## Governance

- Only steps with non-`generation` execution strategies need entries
- Adding an entry is the ONLY change needed to enable correct routing for a new tool's non-generation steps
- The `crawling` value is a domain-level specialization of `acquisition` (same `ApiService` mechanism, SerpApi-specific actor)

## Related

- [[Wiki/concepts/registry-driven-routing|Registry-Driven Routing]] — the routing pattern that reads this registry
- [[Wiki/concepts/be-driven-workflow-execution|BE-Driven Workflow Execution]] — why per-step routing matters
- [[Wiki/entities/generation-system|GenerationSystem]] — the router consumer
- [[Wiki/sources/fix-geometric-duplicate-crawling-plan|Fix Geometric Plan]]

## Contradictions

None.