---
type: source-summary
tags:
  - wiki/source
  - architecture
  - xstate
  - code-review
  - bullmq
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/07-governance/xstate-as-aggregate-architectural-review.md
date_ingested: 2026-07-28
---

# XState-as-Aggregate Architectural Risk Review

Deep-dive analysis of architectural risks from using XState v5 state machines as Aggregate Roots instead of classic OOP DDD. 6 problems identified, 2 critical for the [[proposal-be-driven-workflow-job-system|BullMQ Proposal]].

## Six Identified Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **RISK-1: Mid-flight serialization impossible** | Critical | XState `getPersistedSnapshot()` saves parent state but child actors restart from zero on restore. BullMQ retry must restart from scratch. |
| **RISK-2: No inter-process Domain Event Bus** | High | Domain events are internal XState transitions only — no mechanism for worker→HTTP server→SSE→FE propagation across processes. |
| **RISK-3: Domain logic distributed across 6+ files** | Medium | Answering "why doesn't generation start?" requires tracing `tool-page.machine.ts`, `tool-page-readiness.ts`, `tool-page-selectors.ts`, `extraction-fields.ts`, `generation-system.guards.ts`, `tool-form-architecture.ts`. |
| **RISK-4: TypeScript at inference limits** | Medium | TypeScript struggles with events crossing `invoke` between nested machines. Explicit casts used but fail at runtime if event types are renamed. |
| **RISK-5: Steep learning curve** | Low | Triple cognitive load: DDD + XState v5 + the mapping between them. |
| **RISK-6: No runtime visual debugging** | Low | `actor.getSnapshot()` produces 200+ lines of nested JSON. No runtime inspector available. |

## BullMQ Mitigations (Implemented)

- **RISK-1**: `job-progress-serializer.ts` — manual step state serialization in Redis with 1h TTL. Dual defense: Redis resume → retry from scratch with idempotency.
- **RISK-2**: `job-event-bridge.ts` — Redis pub/sub publisher (worker side) + subscriber (HTTP server side) for cross-process event forwarding.

## Overall Assessment

The XState-as-Aggregate architecture is **valid and well-executed** for the current single-process context. Benefits (explicit states, testability, illegal transition prevention) outweigh costs. The BullMQ Proposal is the first real stress test — RISK-1 and RISK-2 are go-live gates, not post-launch improvements.

## Source

- File: `docs/07-governance/xstate-as-aggregate-architectural-review.md`
- Version: 1.1
- Last reviewed: 2026-07-22
- Owner: Domain Architecture