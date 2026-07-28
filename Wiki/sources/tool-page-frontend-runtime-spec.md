---
type: source-summary
tags:
  - wiki/source
  - frontend
  - runtime
  - xstate
  - ai-first
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/specifications/tool-page-frontend-runtime-spec.md
date_ingested: 2026-07-28
source_version: 1.4
---

# Tool Page Frontend Runtime Specification

AI-first document mapping the complete tool page runtime: state machines, 9 React effects, extraction context resolution chain, generation dispatch, and CTA gating. Every claim traceable to specific file + line range.

## State Machine Architecture

| Machine | Role |
|---------|------|
| `[[toolPageMachine]]` | Page orchestrator: `configuring → hydrating → generating → completed` |
| `[[briefingUploadMachine]]` | Spawned actor: `idle → validating → uploading → extracting → ready` |
| `[[toolFlowMachine]]` | Spawned actor tracking step progression |

## Nine Effects in `useToolPage`

|[effect::1] One-shot project prefill from URL params |
|[effect::2] Resolve source artifact for ArtifactRelaunch |
|[effect::2b] ExtractionContextBridge — critical sync from briefing actor to GenerationWorkspace |
|[effect::3] Hydrate extraction context from source artifact |
|[effect::4] Sync project selection to machine |
|[effect::5] One-shot tone prefill |
|[effect::6] PROGRESS_SYNCED on every artifact list change |
|[effect::7] Dispatch pending step start — the generation launch gate |
|[effect::8] Stream terminal → machine STEP_DONE/STEP_FAILED bridge |
|[effect::9] Auto-chain next step |

## ExtractionContextBridge (Effect #2b)

Critical idempotency-guarded sync. When briefing actor reaches `ready`, upserts extraction context into `[[GenerationWorkspace]]`. **Idempotency guard** prevents infinite render loop: all five fields compared before upsert.

## ExtractionContext Resolution Chain

Four-priority resolution for `startGenerationStep`:
1. Machine hydration result (highest priority)
2. Workspace extraction context (from Bridge)
3. Briefing actor snapshot directly
4. None → dispatch fails

## CTA Gating

`[[ReadinessSnapshot]]` computed on every `PROGRESS_SYNCED` via three sub-flags: `hasProject`, `hasExtractionContext`, `hasPrimaryTargetStep`. `canStartFlow` only when all three true.

DDD-088: `open-last-artifact` CTA bypasses RHF/Zod validation (navigation, not dispatch).

## Asset-Based Extraction Override (DDD-213)

Three scenarios: primitive (file only), evolved (assets only), hybrid (file + assets). When assets provide context without file, extraction step is bypassed and generation starts directly with `assetReferences`.

## Contradictions

None.

## Source

- File: `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- Version: 1.4
- Last reviewed: 2026-07-18
- Owner: Frontend Platform Team