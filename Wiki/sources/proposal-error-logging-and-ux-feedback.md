---
type: source-summary
tags:
  - wiki/source
  - logging
  - ux
  - error-handling
  - observability
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/proposal-error-logging-and-ux-feedback.md
date_ingested: 2026-07-28
source_version: 2.0
---

# Proposal: Error Logging and UX Feedback Improvements

Implemented proposal fixing three observability gaps discovered in production log analysis (2026-06-30).

## Problems Identified

From real geometric run incidents:
1. **Idempotency conflicts** during auto-chain — no requestId in proxy log, impossible to correlate
2. **ECONNRESET** on long-running geometric steps — proxy logs lack request context
3. **Duplicate step dispatch** race condition — no FE/BE log correlation

## Changes Implemented

### Backend Logging
- `idempotency_conflict` now logs structured JSON with `requestId`, `userId`, `projectId`, `toolKey`, `stepKey`
- `generation.step_failed` moved to single-line JSON (parseable by log aggregators)
- Note: `step_failed` structured logging (3.1.2) tracked as low-priority follow-up

### Frontend Proxy (server.mjs)
- Proxy error logs now include `requestId`, `method`, `statusCode`, `durationMs` in structured JSON
- 5xx responses logged as `[error]` instead of `[info]`
- `x-request-id` header propagated on all `generation/run` requests

### UX Feedback
- `[[DispatchError]]` messaging differentiates timeout vs idempotency vs generic errors
- Auto-chain race condition guard: `pendingStepStart` check prevents duplicate dispatch
- ECONNRESET shows retry-capable message with retry button affordance

## Contradictions

None.

## Source

- File: `docs/02-design/proposal-error-logging-and-ux-feedback.md`
- Version: 2.0
- Last reviewed: 2026-07-16
- Owner: Backend Runtime
- Implementation date: 2026-07-16