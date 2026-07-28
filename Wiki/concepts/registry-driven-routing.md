---
type: concept
tags:
  - wiki/concept
  - routing
  - registry-driven
  - generation-system
  - step-type
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_count: 2
confidence: high
---

# Registry-Driven Routing

The principle that the [[Wiki/entities/generation-system|GenerationSystem]]'s `routing` state must discriminate execution flows based on `WorkflowStepType` (read from `STEP_TYPE_BY_TOOL_AND_STEP`), never on a specific `[[Wiki/concepts/toolkey|ToolKey]]`.

## Anti-Pattern (Rejected)

```typescript
// NEVER: tool-specific guard
routeIsGeometric: ({ context }) => context.toolKey === 'geometric'
```

This creates a tool-specific exception that must be replicated for every new tool with non-generation steps.

## Canonical Pattern

```typescript
// ALWAYS: step-type-based guard
routeIsCrawlingStep: ({ context }) => {
  const stepTypeMap = STEP_TYPE_BY_TOOL_AND_STEP[context.toolKey];
  return stepTypeMap?.[context.step] === 'crawling';
}
```

Any tool registering step types in [[Wiki/entities/tool-workflow-job|STEP_TYPE_BY_TOOL_AND_STEP]] gets correct routing automatically — zero code changes to guards or routing state.

## Implementation State

| Date | What |
|------|------|
| 2026-06-12 | `routeIsGeometric` guard introduced (DDD-117) — geometric-specific |
| 2026-07-24 | BE-driven job system (DDD-226) enables per-step actor creation |
| 2026-07-28 | Plan to eliminate tool-specific guards and adopt registry-driven routing |

## Related

- [[Wiki/entities/generation-system|GenerationSystem]] — the actor tree owning the routing state
- [[Wiki/concepts/be-driven-workflow-execution|BE-Driven Workflow Execution]] — the architecture enabling per-step independent actors
- [[Wiki/concepts/tool-domain-concept|Tool]] — the domain entity owning step type declarations
- [[Wiki/sources/fix-geometric-duplicate-crawling-plan|Fix Geometric Plan]] — implementation plan applying this pattern

## Contradictions

None.