---
type: source-summary
tags:
  - wiki/source
  - session
  - aggregation
  - implementation
  - guide
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/session-aggregation-implementation-guide.md
date_ingested: 2026-07-28
source_version: 1.1
---

# Session Aggregation Implementation Guide

Implementation guide documenting how `[[GenerationSession]]`-based aggregation works end-to-end and how to troubleshoot rollout issues.

## SessionId Flow

1. **Frontend** creates session identity via `useToolPage` → propagated in every `GenerationRequest`
2. **Backend** copies `sessionId` into `ToolWorkflowPersistenceMetadata` before persistence
3. **Persistence** writes `session_id`, `step_key`, `artifact_role`, `run_mode` as queryable columns

## Query Patterns

Session endpoints: `GET /api/tools/sessions` (cursor-paginated `SessionSummary[]`), `GET /api/tools/sessions/{sessionId}` (`SessionArtifactGroup`), `GET /api/tools/sessions/{sessionId}/step/{stepKey}`. Frontend uses session-aware reads with backward-compatible heuristic fallback.

## Troubleshooting

Common issues: `sessionId` missing in Artifacts (check `GenerationRequest` propagation), `SessionArtifactGroup` empty (check `ArtifactRole` and `run_mode` denormalization), pagination missing artifacts (check cursor vs offset behavior), FE sees duplicates (check caching + normalization, `Artifact.id` as key).

## Contradictions

None.

## Source

- File: `docs/02-design/session-aggregation-implementation-guide.md`
- Version: 1.1
- Last reviewed: 2026-07-23
- Owner: Frontend + Backend Platform