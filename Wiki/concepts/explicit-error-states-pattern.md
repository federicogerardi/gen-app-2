---
type: concept
tags:
  - wiki/concept
  - xstate
  - error-states
  - frontend
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Frontend Platform Team
source_count: 1
confidence: high
---

# Explicit Error States Pattern

XState pattern replacing `error: string | null` context flags with compound states that have `clean` and `failed` child states. Adopted via [[xstate-explicit-error-states-adr|ADR-003]] across all frontend XState machines.

## Pattern Structure

```
// Before (anti-pattern)
context: { error: string | null }  // hidden error, non-deterministic UX

// After (ADR-003)
configuring: {
  initial: 'clean',
  states: {
    clean: {},
    hydrationFailed: { on: { RETRY: '#hydrating' } },
    generationFailed: { on: { RETRY: '#generating' } }
  }
}
```

## Rules

1. [rule::Never introduce `error: string | null` in context — use child states]
2. [rule::Never dual-write ViewModel — derive reactively via pure function]
3. [rule::Always use `state.matches()` for error checks in consumers]
4. [rule::Always test recovery paths — RETRY, RESET, CLEAR_ERROR transitions]

## Reactive ViewModel (Co-pattern)

`buildReactiveViewModel(context, configuringSubstate)` — pure function deriving the ViewModel from state + context. Zero `assign({ viewModel })` in actions. Eliminates the dual-write anti-pattern where actions updated both context fields and the viewModel simultaneously.

## Affected Machines

| Machine | Compound States |
|---------|----------------|
| [[auth-session]] | `unauthenticated.idle` / `unauthenticated.failed` |
| [[briefing-upload]] | `idle.clean` / `idle.failed` |
| [[tool-page]] | `configuring.clean` / `configuring.hydrationFailed` / `configuring.generationFailed` |

## Sources

- [[xstate-explicit-error-states-adr]]