---
type: source-summary
tags:
  - wiki/source
  - proposal
  - architecture
  - bullmq
  - backend
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/proposal-be-driven-workflow-job-system.md
date_ingested: 2026-07-28
---

# Proposal: BE-Driven Workflow Job System

Proposes replacing FE-driven step-by-step tool workflow orchestration with a BE-driven [[ToolWorkflowJob]] system based on BullMQ. Status: **implemented** (2026-07-24).

## Problem

Current architecture has the frontend orchestrating every step via HTTP loop:
```
FE: POST /api/tools/orchestrate → POST /api/generate → await SSE → next step
```
This creates 4 problems: FE dependency (tab closure breaks workflow), N+1 HTTP round-trips, no parallel jobs, 200+ lines of `useLayoutEffect` bridge code.

## Solution

Introduce [[ToolWorkflowJob]] (Aggregate Root, DDD-226) and [[ToolWorkflowJobId]] (Value Object, DDD-227):
1. FE submits single `POST /api/tools/jobs` → receives `jobId`
2. BE queues job on BullMQ (Redis)
3. Worker iterates steps in order, resolves dependencies, executes, persists
4. FE receives progress via SSE on `GET /api/tools/jobs/:jobId/stream`
5. Failed jobs retry from scratch with idempotency (no XState serialization)

**Relationship**: `ToolWorkflowJob` produces and owns a [[GenerationSession]] — 1:1 for `new`, potentially 1:N for `regenerate`.

## Key Design Decisions

- **No XState serialization**: Child actors restart on restore (XState docs). Retry from scratch with idempotency key — acceptable for ≤4 step workflows.
- **Per-step idempotency (CRIT-01)**: Derived key `${idempotencyKey}:${stepKey}` so step 1's lock doesn't block step 2.
- **Step-type routing (CRIT-03)**: `switch(stepDescriptor.type)` routes `generation`/`extraction`/`acquisition` to `runSingleStepGeneration`, `crawling` to `runCrawlingStep`, `scoring` to `runScoringStep`.
- **Cancellation (CRIT-02)**: `POST /api/tools/jobs/:jobId/cancel` sets Redis flag checked at step boundaries only — no mid-invoke interruption.

## Infrastructure

**Already available**: BullMQ v5.78.0, Redis (ioredis), SSE streaming, XState machines, idempotency, rate limiting.

**New files**: `tool-workflow-job-processor.ts`, `worker.ts`, `tool-workflow-job-queue.ts`, `job-event-bridge.ts`, `job-progress-serializer.ts`, FE `useToolPageSubmitController.ts`, `useJobStream.ts`.

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Fase 1 | Worker in-process, all tools supported, feature-flagged | Implemented |
| Fase 2 | Postgres storage, Redis pub/sub, group concurrency, E2E tests | Planned |
| Fase 3 | Native multi-step in XState | Optional |

## Credit Model Compatibility

Confirmed: the existing two-level credit model (artifact gate per step + credit consumption only on final step via `isNotFinalArtifact` guard) works correctly with BE-driven loop — no modifications needed.

## Source

- File: `docs/02-design/proposal-be-driven-workflow-job-system.md`
- Version: 1.14
- Status: implemented (2026-07-24)
- Owner: Backend Runtime