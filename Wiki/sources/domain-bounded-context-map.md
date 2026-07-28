---
type: source-summary
tags:
  - wiki/source
  - ddd/bounded-context
  - architecture
  - domain
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: LLM
source_file: docs/02-design/domain-bounded-context-map.md
date_ingested: 2026-07-27
source_version: "3.14"
---

# Domain Bounded Context Map

Defines the canonical bounded contexts, their boundaries, key entities/value objects, and integration rules for `gen-app-2`.

## Six Bounded Contexts

| Context | Aggregate Root | Status | Responsibility |
|---------|----------------|--------|----------------|
| **Generation** | [[GenerationSystem]], [[ToolWorkflowJob]] (provisional) | active | End-to-end artifact production: routing, streaming, persistence, extraction, idempotency |
| **Auth** | (none specified) | active | Identity management: users, sessions, roles, OAuth |
| **Usage/Quota** | (none specified) | active | Per-user generation limits, credit consumption, audit history |
| **Frontend/UI** | [[ToolPage]] | active | Tool interaction: page session, step flow, readiness, artifact hydration |
| **Crawling & Extraction** | [[CrawlingJob]] | **provisional** | Web crawling, SERP scraping, anti-bot bypass, structured data extraction |
| **Competitor Analysis** | [[CompetitorRanking]] | **provisional** | Competitor grouping, source classification, weighted scoring, tier assignment |

## Generation Context

The richest context with 9 XState actors (machines): `generationSystemMachine`, `requestGatewayMachine`, `idempotencyCoordinatorMachine`, `usageMachine`, `streamTransportMachine`, `persistenceBatchMachine`, `toolWorkflowMachine`, `extractionChainMachine`, `acquisitionChainMachine`.

Key entity families: [[Artifact]] lifecycle, [[WorkflowStep]] execution, [[LlmModel]] management, [[ApiService]] catalog, GEOMETRIC analysis ([[AnalysisSession]], [[QueryCluster]], [[StrategicReport]], [[UnifiedReport]]).

**Asset domain model** (DDD-188 through DDD-207): [[Asset]] entities are **property of the Project**, unlike Artifacts which are content **produced in the Project**. Asset injection pipeline resolves `AssetFieldMapping` entries at prompt assembly time (#DDD-concepts).

## Integration & Translation Rules

The BCM defines ~35 translation rules governing how concepts cross context boundaries. Key patterns:

- **Generation → Frontend/UI**: BE owns data semantics, FE owns read-model projections (not domain logic). Examples: `Artifact` → `GenerationArtifact`, `GenerationSession` → `SessionSummary`, `LlmModelCatalog` → `LlmModelSelector`.
- **Frontend/UI → Generation**: FE assembles `GenerationRequest` commands; BE owns execution. Step ordering authority is BE (`toolWorkflowStepOrder`).
- **ToolKey** is the cross-context canonical identifier (DDD-029). `ToolWorkflow` (snake_case) is a separate Generation routing concept.
- **Naming conventions**: `ToolKey` uses kebab-case (`funnel-pages`), `ToolWorkflow` uses snake_case (`funnel_pages`). This divergence is a resolved-documented translation rule (DDD-C-005).

## Integration Constraints

24 constraints govern cross-context boundaries, including: `ExtractionContext` completeness at dispatch, extraction field naming normalization, tool input-file requiredness policy, input-source composition policy, context generation umbrella contract.

## Status

Three contexts are **provisional** (Crawling & Extraction, Competitor Analysis, and portions of Generation for GEOMETRIC). Their runtime implementation is pending.

## Contradictions

None.

## Source

- File: `docs/02-design/domain-bounded-context-map.md`
- Version: 3.14
- Last reviewed: 2026-07-20
- Owner: Domain Architecture