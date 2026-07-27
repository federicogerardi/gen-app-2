---
type: entity
tags:
  - wiki/entity
  - frontend
  - aggregate-root
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Frontend/UI
source_count: 2
entity_type: aggregate-root
---

# ToolPage

The [[FrontendUI]] bounded context's aggregate root — an XState v5 actor managing the tool generation page session.

## Actor Composition

- `toolPageMachine` — page-level orchestrator
- `briefingUploadMachine` — upload/extraction lifecycle
- `toolFlowMachine` — step-by-step generation flow
- `frontendStreamMachine` — SSE stream consumer

## Key State (ToolPageViewModel)

- **[[ReadinessSnapshot]]** — start-eligibility computed from input completeness and quality
- **[[ReadinessReasonCode]]** — typed reason codes for readiness states
- **PrimaryActionPolicy** / **SecondaryActionFlags** — CTA governance
- `isFormLocked` — gates form mutability during active generation

## Core Operations

- **[[ContextGenerationPhase]]** (provisional) — assembles Tool input context before dispatch
- **[[StepHydration]]** — projects BE-owned `WorkflowStep` state into FE for resume/regenerate
- **[[GenerationRequestAssembly]]** — translates accumulated FE state into `GenerationRequest`

## Architecture Boundary

Frontend owns interaction and display only. Step ordering authority is BE. Step dependency resolution routes through `/api/tools/orchestrate`.

## Sources

- [[domain-bounded-context-map]]
- [[domain-ubiquitous-language-glossary]]