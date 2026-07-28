---
type: source-summary
tags:
  - wiki/source
  - frontend
  - architecture
  - registry
  - ui-state
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
date_ingested: 2026-07-28
source_version: 2.0
---

# Frontend Tool Pages — Unified Architecture Specification

Specifies the unified and scalable architecture for tool generation pages, replacing ~95% code duplication with a registry-driven generic system.

## Core Pattern: Registry-Driven Architecture

Instead of per-tool page components (~350 LOC each), all tools share a single `[[ToolPageTemplate]]` that derives behavior from a declarative `[[ToolFormRegistry]]`. Adding a new tool requires only a registry entry + wrapper page (~30 min, ~50 LOC).

## Key Components

| Component | Role |
|-----------|------|
| `[[ToolPageTemplate]]` | Main orchestrator (~150 lines), composes all elements |
| `[[ToolFormRegistry]]` | Declarative config map: `Record<SupportedTool, ToolFormConfig>` with steps, dependencies, defaults |
| `[[ToolGenerationFlowVertical]]` | Unified right column: checklist + progress + step statuses |
| `[[ToolActionButtons]]` | Adaptive CTAs driven by `[[PrimaryActionPolicy]]` |

## Canonical UI State Derivation

Eight deterministic states via `deriveCanonicalToolUiState()`:

| State | Description |
|-------|-------------|
| `draft-empty` | No briefing loaded |
| `processing-briefing` | Upload/extraction in progress |
| `draft-ready` | Extraction complete, ready to generate |
| `prefilled-regenerate` | Reloaded prior artifact |
| `paused-with-checkpoint` | Some steps done, can resume |
| `resume-needs-briefing` | Resume requires new briefing |
| `running` | Generation active |
| `completed` | Generation done |

Five `[[PrimaryActionPolicy]]` values: `start-generation`, `resume-checkpoint`, `regenerate-current-step`, `open-last-artifact`, `disabled`.

## Tool Input File Requirement Policy (DDD-081)

Canonical requiredness taxonomy:
- `always-required`: `inputFiles[0]` mandatory invariant
- `required-by-tool-setting`: additional file blocking readiness
- `optional-by-tool-setting`: additional file never blocking readiness

## Extraction Field Matrix

Per-tool [[ExtractionFieldKey]] → [[ExtractionFieldLabel]] mapping. Contract-backed via `packages/contracts/src/extraction-fields.ts` with deterministic rules: `inputFiles[0]` must always be `always-required`.

## Contradictions

None.

## Source

- File: `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md`
- Version: 2.0
- Last reviewed: 2026-05-22
- Owner: Frontend Platform Team