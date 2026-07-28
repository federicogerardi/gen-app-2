---
type: source-summary
tags:
  - wiki/source
  - frontend
  - adr
  - data-access
  - architecture
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/adr/frontend-data-access-layer-adr.md
date_ingested: 2026-07-28
source_version: 1.0
---

# ADR-001: Unified Frontend Data Access Layer

Architecture Decision Record establishing a unified data access layer for the frontend, eliminating duplicated fetch logic, hardcoded endpoints, and inconsistent error handling.

## Problem

Four structural duplication areas: local URL composition helpers, hardcoded endpoints in pages, repeated `useEffect + IIFE async` data loading patterns, duplicated query param parsers.

## Decision

Four-layer architecture:

| Layer | Module | Role |
|-------|--------|------|
| Transport | `http-client.ts` | Shared non-streaming HTTP transport |
| Registry | `api-paths.ts` | Single source of endpoint URLs |
| Query hooks | `queries/` | Shared hooks for data-driven pages |
| Feature runtime | `features/*/runtime/` | Payload mapping, fallbacks, contract compatibility |

## Rules

- Pages never call `fetch()` directly for standard list/detail
- Feature clients never redefine local `joinApiPath` helpers
- Endpoints never hardcoded in production pages
- No external libraries (React Query/SWR) — intentionally lightweight

## Monorepo Boundary Addendum (2026-05-06)

Phases strictly ordered (1→2→3A→3B→3C→4) with machine-verifiable gate evidence. Contract authority in `packages/contracts`, DB infra in `packages/infra-db`, frontend data-access owned by Frontend/UI context.

## Contradictions

None.

## Source

- File: `docs/02-design/adr/frontend-data-access-layer-adr.md`
- Version: 1.0
- Last reviewed: 2026-04-27
- Owner: Frontend Platform Team