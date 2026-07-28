---
type: source-summary
tags:
  - wiki/source
  - observability
  - logging
  - pino
  - railway
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/04-testing/production-observability-runbook.md
date_ingested: 2026-07-28
source_version: 1.0
---

# Production Observability Runbook

Operational guide for structured logging, error classification, Railway log queries, and debugging workflows across the FE→Proxy→BE stack.

## Logging Architecture

| Layer | Tool | Module |
|-------|------|--------|
| Backend | pino (JSON) | `apps/backend/src/lib/runtime/logger.ts` |
| Frontend | Custom JSON logger | `apps/frontend/src/app/runtime/logger.ts` |
| Proxy | Structured JSON + correlation ID | `apps/frontend/server.mjs` |

Backend uses `logger.child({ requestId, userId, projectId })` for request-scoped logging. Development mode uses pino-pretty.

## Error Taxonomy (DDD-148/DDD-149)

Seven canonical error reason codes: `idempotency_conflict`, `extraction_context_insufficient`, `stream_empty_output`, `terminal_failed`, `timeout`, `connection_lost`, `unknown`.

Translation layer: `mapInlineDispatchError` converts backend reason strings → `[[DispatchErrorReasonCode]]` → localized user message. Backend owns error semantics; frontend owns display translation.

## Railway Log Query Patterns

Pre-built grep patterns for: idempotency conflict investigation (`generation.idempotency_conflict`), ECONNRESET/timeout analysis (`proxy.error`), generation failure correlation (`generation.step_failed`), correlation ID cross-service tracing.

## Debugging Workflows

FE→Proxy→BE correlation tracing via `correlationId` and `requestId`. Three specific workflows documented: idempotency conflict investigation, ECONNRESET timeout analysis, duplicate dispatch error diagnosis.

## Alert Thresholds

- >5 idempotency conflicts/min → investigate auto-chain
- >10 timeouts/hour → check LLM provider health
- Any 5xx proxy errors → immediate investigation

## Contradictions

None.

## Source

- File: `docs/04-testing/production-observability-runbook.md`
- Version: 1.0
- Last reviewed: 2026-07-06
- Owner: Backend Runtime + Frontend Platform