---
type: source-summary
tags:
  - wiki/source
  - debug
  - streaming
  - runbook
  - xstate
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/04-testing/streaming-generator-debug-runbook.md
date_ingested: 2026-07-28
source_version: 1.2
---

# Streaming Generator Debug Runbook

Debug infrastructure for multi-step LLM generation streaming with XState v5. **Note**: streaming path is dormant as of June 2026; non-streaming is now the default. For active diagnostics, consult [[production-observability-runbook]].

## Debug Infrastructure

| Tool | Module | Purpose |
|------|--------|---------|
| Stream Logger | `stream-logger.ts` | Structured event logging with timing, filtering by level/requestId |
| MSW Handlers | `stream-handlers.ts` | Mock scenarios: success, failure, malformedSequence, timeout, networkError |
| XState Inspector | DevTools | Visual state machine debugging |
| Component Hooks | `useDebug` | Runtime log viewer in development |

## Common Debug Scenarios

Documented patterns for: step not starting (machine stuck in `configuring`), stream hangs (no terminal event), duplicate artifacts (auto-chain race), ECONNRESET (proxy timeout), extraction loop (infinite retry), wrong step output (hydration mismatch).

## Diagnosing Streaming Failures

Decision tree: identify failure type → stream transport errors (SSE parsing), state machine errors (XState transition), generation errors (LLM quality), network errors (CORS/CSRF/proxy).

## Non-Streaming Migration Note

Default path is now `POST /generation/run` (JSON response). Streaming diagnostics are historical. For current diagnostics use `[gen][json-session-*]` log prefix and `postgres-redis.nonstreaming.smoke.ts`.

## Contradictions

None.

## Source

- File: `docs/04-testing/streaming-generator-debug-runbook.md`
- Version: 1.2
- Last reviewed: 2026-07-06
- Owner: Frontend Platform Team