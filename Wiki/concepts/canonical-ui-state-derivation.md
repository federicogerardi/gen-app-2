---
type: concept
tags:
  - wiki/concept
  - frontend
  - ui-state
  - determinism
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Frontend Platform Team
source_count: 1
confidence: high
---

# Canonical UI State Derivation

Deterministic derivation of tool page UI states from domain data. Maps upload + generation + checkpoint state into exactly one of eight canonical states, then derives `[[PrimaryActionPolicy]]` from that.

## The Eight States

[stateDerivationFunction::`deriveCanonicalToolUiState(input) → CanonicalToolUiState`]

| State | Condition |
|-------|-----------|
| `draft-empty` | No briefing loaded |
| `processing-briefing` | Upload/extraction active |
| `draft-ready` | Extraction complete, idle |
| `prefilled-regenerate` | Prior artifact reloaded |
| `paused-with-checkpoint` | Some steps done, can resume |
| `resume-needs-briefing` | Resume requires new briefing |
| `running` | Generation active |
| `completed` | Generation done |

## Primary Action Policy

[derivedFrom::CanonicalToolUiState]

| Policy | Triggered By |
|--------|-------------|
| `start-generation` | `draft-ready`, `prefilled-regenerate` |
| `resume-checkpoint` | `paused-with-checkpoint` |
| `regenerate-current-step` | Restore flow with source checkout |
| `open-last-artifact` | `completed` |
| `disabled` | `draft-empty`, `processing-briefing`, `running` |

## Secondary Actions

Three flags derived independently: `canRegenerateFromZero`, `canResetSetup`, `canStartNewGeneration`.

## Cancel/Resume Guardrail

When user cancels during `running`: UI preserves interrupted step as `pausedCheckpointStep`; primary policy remains `resume-checkpoint` until completed; run prefix/requestId regenerated before resume.

## Sources

- [[frontend-tool-pages-architecture-spec]]