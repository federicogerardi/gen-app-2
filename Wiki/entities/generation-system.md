---
type: entity
tags:
  - wiki/entity
  - generation
  - aggregate-root
  - xstate
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Domain Architecture
source_count: 3
entity_type: aggregate-root
---

# GenerationSystem

The [[Generation]] bounded context's aggregate root — an XState v5 actor tree orchestrating the end-to-end lifecycle of a single generation.

## Actor Composition

The `generationSystemMachine` composes 9 child actors:

| Actor | Role |
|-------|------|
| `requestGatewayMachine` | Pre-generation guard sequencing: auth → ownership → modelCheck → usage |
| `idempotencyCoordinatorMachine` | Atomic deduplication slot claim |
| `usageMachine` | Quota claim (delegate of [[UsageQuota]] context) |
| `toolWorkflowMachine` | Multi-step Tool execution, owns [[WorkflowStep]] lifecycle |
| `streamTransportMachine` | SSE streaming session from LLM to backend |
| `persistenceBatchMachine` | Incremental chunk flushing + artifact finalization |
| `extractionChainMachine` | Structured extraction with text fallback |
| `acquisitionChainMachine` | API-backed context retrieval via [[ApiService]] |

## Guard Sequence

Runtime entrypoints execute: `idempotency → ownershipCheck → usage`. Authentication and ownership checks run at route level before guard execution.

## Key Context Fields

- `toolKey` ([[ToolKey]]) — step orchestration identity
- `workflowType` ([[ToolWorkflow]]) — artifact routing
- `contentBuffer` — transient in-memory accumulator

## Satellite Aggregate

[[ToolWorkflowJob]] (provisional, DDD-226) — a BullMQ-backed async execution unit that produces and owns a [[GenerationSession]]. Distinct from `GenerationSystem` which handles synchronous streaming.

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-034, DDD-047, DDD-048, DDD-226)