---
type: source-summary
tags:
  - wiki/source
  - xstate
  - adr
  - error-states
  - frontend
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/adr/xstate-explicit-error-states-adr.md
date_ingested: 2026-07-28
source_version: 1.0
---

# ADR-003: XState Explicit Error States Pattern

Architecture Decision Record adopting compound states with explicit `clean`/`failed` children instead of `error: string | null` context flags.

## Problem

Three XState machines (`[[auth-session]]`, `[[briefing-upload]]`, `[[tool-page]]`) hid error substates inside context flags. The same state value (`idle`, `unauthenticated`) covered both clean and error conditions, making UX non-deterministic when reading `state.value` alone.

The `tool-page` machine also had a dual-write anti-pattern: actions updated both context fields and `viewModel` simultaneously, risking desync.

## Decision

Four rules:

1. **Compound states for errors**: every state that could contain an error becomes a compound state with `clean` and `failed` children (e.g., `configuring.clean`, `configuring.hydrationFailed`, `configuring.generationFailed`)
2. **Single `errorMessage` field**: replaces multiple error fields (`generationError`, `hydrationError`)
3. **Reactive ViewModel**: `buildReactiveViewModel(context, configuringSubstate)` — pure function, zero `assign({ viewModel })` in actions
4. **Guard derivation from context**: guards like `canStartGeneration` derive policy directly from reactive ViewModel

## Affected Machines

| Machine | Error States Added |
|---------|-------------------|
| `auth-session.machine.ts` | `unauthenticated.idle` / `unauthenticated.failed` |
| `briefing-upload.machine.ts` | `idle.clean` / `idle.failed` |
| `tool-page.machine.ts` | `configuring.clean` / `configuring.hydrationFailed` / `configuring.generationFailed` |

## Consequences

**Positive**: deterministic UX via `state.matches()`, visible in XState DevTools, ViewModel immune to desync, consistent pattern across machines, 443 tests pass zero regressions.

**Negative**: significant refactoring (7 files, 15+ consumers), `buildReactiveViewModel` called every render (O(1) cost), `event.output` unavailable in `onDone` guards for invoked actors.

**Excluded from scope**: `generation-lifecycle.machine.ts` retains `error: string | null` (child machine, not refactored).

## Code Review Guidelines

For future XState machine changes: never introduce `error: string | null` in context, never dual-write ViewModel, always use `state.matches()` for error checks, always test recovery paths (RETRY, RESET, CLEAR_ERROR).

## Contradictions

None.

## Source

- File: `docs/02-design/adr/xstate-explicit-error-states-adr.md`
- Version: 1.0
- Last reviewed: 2026-06-26
- Owner: Frontend Platform Team