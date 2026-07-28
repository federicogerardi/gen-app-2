---
type: source-summary
tags:
  - wiki/source
  - architecture
  - code-review
  - weaknesses
  - technical-debt
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/07-governance/architecture-weaknesses-code-review.md
date_ingested: 2026-07-28
source_version: 2.6
---

# Architecture Weaknesses Code Review

Severity-first architecture review across backend, frontend, contracts, and governance. Evidence-based findings only.

## Open Findings

### MEDIUM

1. **Generation flow completion dependent on FE liveness**: if client disconnects, session completion remains tied to FE-driven progression. Review trace: introduce backend-owned `[[GenerationSession]]` batch continuation job.
2. **Tool Workspace stuck in `running` after interruptions**: error scenarios can leave page in non-recoverable state. Review trace: fail-close recovery policy forcing transition out of `running`.

No open HIGH or LOW findings.

## Closed Since Previous Review

All previously open findings are now CLOSED with evidence anchors:
- Type-safety loss in `useToolPageRunController` — typed `toolPageSend` with `ToolPageEvent` union
- `GenerationRequestInput` too permissive — explicit keys, no index signature
- HTTP method enforcement distributed — centralized 405 dispatch with `Allow` header
- Frontend fallback not paginated — `listArtifactsPaginated` with limit/offset
- Step-artifact endpoint not optimized — dedicated `getArtifactDetailBySessionStep` query
- Session listing fragmentation — grouped by session_id, cursor pagination
- Orchestration scalability — configurable timeout, bounded artifact scan, Redis `[[OrchestrateArtifactCache]]`

## Contradictions

None.

## Source

- File: `docs/07-governance/architecture-weaknesses-code-review.md`
- Version: 2.6
- Last reviewed: 2026-06-04
- Owner: Architecture Review