---
type: concept
tags:
  - wiki/concept
  - ddd
  - architecture
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Domain Architecture
source_count: 2
confidence: high
---

# Bounded Context

A core DDD pattern partitioning the `gen-app-2` domain into six bounded contexts, each with distinct responsibilities, aggregate roots, and integration rules.

## Six Contexts

[contextCount::6]

| Context | Status | Role |
|---------|--------|------|
| **[[Generation]]** | active | Artifact production, streaming, persistence |
| **[[Auth]]** | active | Identity, sessions, roles, OAuth |
| **[[UsageQuota]]** | active | Credit consumption, quota enforcement |
| **[[FrontendUI]]** | active | Tool interaction, page session, readiness |
| **[[CrawlingExtraction]]** | **provisional** | Web crawling, SERP scraping |
| **[[CompetitorAnalysis]]** | **provisional** | Competitor scoring, tier assignment |

## Dependency Model

Upstream → downstream relationships align with the [[XState]] actor tree:

```
Auth → Generation → Frontend/UI
Auth → Usage/Quota → Generation
Auth → Crawling & Extraction → Generation (via WorkflowStepType='crawling')
Auth → Crawling & Extraction → Competitor Analysis → Generation (via WorkflowStepType='scoring')
```

## Integration Patterns

Contexts communicate through shared read models, commands, and events:
- **Read models**: `AuthSessionPrincipal` (Auth → all), `SessionSummary` (Generation → Frontend)
- **Commands**: `ClaimUsage` (Usage → Generation), `GenerationRequest` (Frontend → Generation)
- **Events**: `BackendStreamEvent` (Generation → Frontend over SSE)

## Translation Rules

The [[BCM]] defines ~35 explicit translation rules governing how concepts cross boundaries. Key pattern: BE owns data semantics, FE owns read-model projections — never domain logic.

## Sources

- [[domain-bounded-context-map]]
- [[domain-ubiquitous-language-glossary]]