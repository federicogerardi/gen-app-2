---
type: entity
tags:
  - wiki/entity
  - frontend
  - readiness
  - value-object
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Frontend Platform Team
source_count: 2
entity_type: value-object
---

# ReadinessSnapshot

The canonical start-eligibility object computed by the [[ToolPage]] aggregate. Defined in `tool-page.machine.ts` and referenced by the [[tool-generation-flow-source-of-truth-spec]].

## Schema

```
canStartFlow = hasProject AND hasExtractionContext AND hasPrimaryTargetStep
```

## Reason Codes

[reasonCodes::`missing_project` | `missing_extraction_context` | `missing_primary_target_step`]

Each reason maps to canonical UI feedback:
- `missing_project` → "Select a project"
- `missing_extraction_context` → "Upload or retrieve a brief"
- `missing_primary_target_step` → "Waiting for available step"

## Completeness Rule

`hasExtractionContext = true` only when:
- Non-empty briefing text recovered
- Resolved extraction artifact identity (`extractionArtifactId` + `briefingId`)
- Extraction payload treated as optional passthrough at readiness stage

A non-null `HydrationResult` alone is not sufficient.

## Extended Matrix (DDD-081, DDD-213)

Asset hard-block rule: `project-asset` entries with `always-required` or `required-by-tool-setting` hard-block the CTA identically to other source families (DDD-213).

## Decision Table

| hasProject | hasExtractionContext | hasPrimaryTargetStep | canStartFlow |
|------------|---------------------|---------------------|-------------|
| false | false | false | false |
| true | false | false | false |
| true | true | false | false |
| true | true | true | true |

## Related

- [[ToolInputRequirementMatrix]] — extended requiredness across all input source families
- [[ReadinessQualityGate]] (provisional) — quality-gated readiness beyond presence checks

## Sources

- [[tool-generation-flow-source-of-truth-spec]]
- [[frontend-ui-ubiquitous-language-spec]]