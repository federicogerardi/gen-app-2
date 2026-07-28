---
type: source-summary
tags:
  - wiki/source
  - frontend
  - xstate
  - tool-generation
  - specification
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md
date_ingested: 2026-07-28
source_version: "1.3"
---

# Tool Generation Flow Source of Truth (Frontend)

Machine-friendly canonical contract for the frontend tool generation flow. Defines the [[ToolPage]] state machine, data model, event contract, state semantics, and readiness logic.

## Architecture

Three XState actors compose the frontend generation flow:
1. `toolPageMachine` — page orchestrator, readiness, view model
2. `briefingUploadMachine` — upload/extraction lifecycle
3. `toolFlowMachine` — step runtime state

Since June 2026, tools use the **non-streaming** model (`POST /generation/run`, JSON). Streaming path (`/generation/stream`, SSE) is dormant.

## Canonical Data Model

### [[ReadinessSnapshot]]
Three reason codes: `missing_project`, `missing_extraction_context`, `missing_primary_target_step`. `canStartFlow = hasProject AND hasExtractionContext AND hasPrimaryTargetStep`.

### ToolPageViewModel
Single canonical source for UI decisions. Contains `readiness`, `canonicalState`, `primaryActionPolicy`, `secondaryActionFlags`, `stepStatuses`, and `messages`. UI must not duplicate readiness logic.

## State Machine

Three states: `configuring → generating → completed`. Transition `configuring → generating` only with `readiness.canStartFlow = true`.

## [[ContextGenerationPhase]]

Canonical pre-step phase that assembles the effective payload from configured sources (extraction, API acquisition, direct-input merge). The unified CTA is `Start Context Generation Action` — the visible button is `Avvia la generazione`. On completion, FE auto-dispatches step-1 without second click.

## Input Requirement Matrix

Three source families (`direct-input`, `tool-input-file`, `api-acquisition`) with requiredness values: `always-required`, `required-by-tool-setting`, `optional-by-tool-setting`. CTA enabled only when all required entries satisfied.

## Resilience

Supports resume from checkpoint, regenerate from artifact, post-cancel checkpoint creation. Resume uses new `requestId` to avoid idempotency collisions.

## Contradictions

None.

## Source

- File: `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
- Version: 1.3
- Last reviewed: 2026-06-04
- Owner: Frontend Platform Team