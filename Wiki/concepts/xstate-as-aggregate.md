---
type: concept
tags:
  - wiki/concept
  - xstate
  - architecture
  - ddd
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Domain Architecture
source_count: 2
confidence: high
---

# XState-as-Aggregate Pattern

The architectural choice of using XState v5 state machines as DDD Aggregate Roots instead of the classic OOP pattern (`class AggregateRoot`). Valid and well-executed in the current single-process context, but introduces debt for multi-process scenarios.

## Mapping: Classic DDD vs XState

| Classic DDD (OOP) | XState v5 (this project) |
|--------------------|--------------------------|
| State + Behavior in same class | State (context) ⟂ Behavior (machine definition) |
| Implicit transitions in methods | Explicit transitions declared in graph |
| Invariants: private methods | Invariants: declared guards |
| Testing: mock the class | Testing: machine + pure events |
| Serialization: native JSON | Serialization: partial snapshot, child actors lost |

## Six Architectural Risks (from [[xstate-as-aggregate-architectural-review]])

1. **Critical — Mid-flight serialization**: `getPersistedSnapshot()` saves parent state but invoked child actors restart from zero. Mitigated with manual `job-progress-serializer.ts`.
2. **High — No inter-process event bus**: Domain events are internal XState transitions. Mitigated with Redis pub/sub `job-event-bridge.ts`.
3. **Medium — Distributed logic**: Business rule "can generation start?" requires tracing 6 files.
4. **Medium — TypeScript at limits**: Explicit casts needed for cross-invoke events.
5. **Low — Learning curve**: DDD + XState + mapping between them at onboarding.
6. **Low — No runtime visual debugger**: `actor.getSnapshot()` produces 200+ lines of JSON.

## Aggregate Roots Using This Pattern

| Aggregate Root | Context | Machine |
|----------------|---------|---------|
| [[GenerationSystem]] | [[Generation]] | `generationSystemMachine` |
| [[ToolPage]] | [[FrontendUI]] | `toolPageMachine` |
| [[ToolWorkflowJob]] (provisional) | [[Generation]] | BullMQ-backed |

## BullMQ Stress Test

The [[proposal-be-driven-workflow-job-system]] is the first real stress test. RISK-1 and RISK-2 are **go-live gates**, not post-launch. Both have been mitigated with implemented solutions.

## Sources

- [[xstate-as-aggregate-architectural-review]]
- [[domain-bounded-context-map]]