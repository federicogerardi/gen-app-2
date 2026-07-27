---
type: entity
tags:
  - wiki/entity
  - generation
  - workflow
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Generation
source_count: 3
entity_type: entity
---

# WorkflowStep

A single named step within a multi-step [[Tool]] generation flow. Exists in two forms:

- **[[WorkflowStepDescriptor]]** — static configuration: name, dependencies, optional `type`
- **[[WorkflowStepState]]** — runtime tracking: status, artifact ID

## Step Types

[stepType::[[WorkflowStepType]]]

| Type | Status | Handler |
|------|--------|---------|
| `extraction` | canonical | [[ExtractionChain]] — LLM-driven structured extraction |
| `generation` | canonical | [[StreamTransport]] + [[PersistenceBatch]] — content production |
| `acquisition` | canonical | `acquisitionChainMachine` — API-backed data retrieval |
| `crawling` | **provisional** | Crawling chain actor — SERP scraping ([[CrawlingExtraction]] context) |
| `scoring` | **provisional** | Scoring chain actor — competitor analysis ([[CompetitorAnalysis]] context) |

## Step Status

[stepStatus::`idle` | `running` | `done` | `error` | `skipped`]

Governed by [[WorkflowStepStatus]].

## Domain Events

- **[[WorkflowStepUnlocked]]** (DDD-035) — dependencies satisfied, step begins execution
- **[[WorkflowStepCompleted]]** (DDD-036) — step reaches terminal status; unlocks downstream dependencies

## Resume/Regenerate

[[WorkflowStepBootstrap]] (DDD-037) injects initial state `{ stepKey, output, artifactId }` when resuming from a prior [[Artifact]], skipping already-completed steps.

## Cross-Context

- Backend: abstract `WorkflowStepDescriptor` / `WorkflowStepState`
- Frontend: concrete `ToolStep` (projection with step names like `intro-structure`, `body-structure`)
- Step ordering authority is BE (`toolWorkflowStepOrder` in contracts)

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-003, DDD-035, DDD-036, DDD-101)