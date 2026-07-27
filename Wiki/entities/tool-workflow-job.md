---
type: entity
tags:
  - wiki/entity
  - generation
  - aggregate-root
  - bullmq
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_count: 2
entity_type: aggregate-root
---

# ToolWorkflowJob

A provisional satellite Aggregate Root in the [[Generation]] context — the asynchronous, BullMQ-backed unit of work orchestrating end-to-end execution of all [[WorkflowStep]]s for a single [[Tool]] invocation.

## Identity

Identified by [[ToolWorkflowJobId]] (DDD-227), an opaque string generated at submit time. Distinct from `WorkflowSessionIdentifier` (`sessionId`, DDD-047): `ToolWorkflowJobId` scopes the async execution unit; `sessionId` scopes the artifact-grouping aggregate.

## Lifecycle

[lifecycle::`queued` | `running` | `completed` | `failed` | `cancelled`]

## Relationship to GenerationSession

A `ToolWorkflowJob` **produces and owns** a [[GenerationSession]]:
- 1:1 for `WorkflowRunMode = 'new'`
- Potentially 1:N for `'regenerate'` (provisional, pending implementation confirmation)

## Architecture (from [[proposal-be-driven-workflow-job-system]])

The proposal (implemented 2026-07-24) replaces FE-driven step-by-step HTTP loop with BE-driven queued execution:

1. FE submits `POST /api/tools/jobs` → receives `jobId`
2. Worker iterates steps in canonical order, routing by [[WorkflowStepType]]
3. Progress streamed to FE via SSE (`GET /api/tools/jobs/:jobId/stream`)
4. Failed jobs retry from scratch with idempotency (no XState serialization — see [[xstate-as-aggregate-architectural-review|RISK-1]])

## Cross-Process Communication

[[JobEventBridge]] (Redis pub/sub) connects BullMQ worker and HTTP server for SSE event forwarding. [[JobProgressSerializer]] handles manual step state persistence in Redis.

## Cancellation

`POST /api/tools/jobs/:id/cancel` sets Redis flag checked at step boundaries only — no mid-invoke interruption.

## Sources

- [[proposal-be-driven-workflow-job-system]]
- [[xstate-as-aggregate-architectural-review]]
- [[domain-naming-decision-log]] (DDD-226, DDD-227)