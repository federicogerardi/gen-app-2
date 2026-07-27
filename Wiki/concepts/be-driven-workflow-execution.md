---
type: concept
tags:
  - wiki/concept
  - architecture
  - backend-driven
  - bullmq
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Backend Runtime
source_count: 2
confidence: high
---

# BE-Driven Workflow Execution

The architectural shift from FE-driven step-by-step HTTP loop to BE-driven queued execution via [[ToolWorkflowJob]] and BullMQ. Implemented 2026-07-24.

## Before vs After

| Aspect | FE-Driven (old) | BE-Driven (new) |
|--------|-----------------|-----------------|
| Step orchestration | FE loop: `orchestrate → generate → SSE → next` | BE loop inside BullMQ worker |
| HTTP calls | N+1 per tool (orchestrate + generate per step) | 1 submit + 1 SSE connection |
| FE complexity | 200+ lines `useLayoutEffect` bridge | Passive SSE consumer |
| Tab dependency | Workflow stops on tab close | Worker continues independently |
| Parallel jobs | Impossible | BullMQ concurrency |

## Key Components

- **[[ToolWorkflowJob]]** — Aggregate Root, queued async execution unit
- **[[JobEventBridge]]** — Redis pub/sub for worker→HTTP→SSE event forwarding
- **[[JobProgressSerializer]]** — Manual step state persistence in Redis
- **Step-type routing** — `switch(WorkflowStepType)` dispatches to correct chain actor

## Risks Mitigated

| Risk | Mitigation | Status |
|------|-----------|--------|
| XState serialization (RISK-1) | Retry from scratch + idempotency + manual Redis serializer | Implemented |
| Inter-process events (RISK-2) | Redis pub/sub `job-event-bridge.ts` | Implemented |
| Single-flight guard | Redis lock `SET NX EX` at submit time | Implemented |
| Cancellation | `POST /cancel` → Redis flag checked at step boundaries | Implemented |

## Credit Model

Existing two-level model (artifact gate per step + credit consumption only on final step via `isNotFinalArtifact`) works correctly with BE-driven loop — no modifications needed.

## Sources

- [[proposal-be-driven-workflow-job-system]]
- [[xstate-as-aggregate-architectural-review]]