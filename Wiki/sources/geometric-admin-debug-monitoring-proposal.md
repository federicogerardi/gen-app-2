---
type: source-summary
tags:
  - wiki/source
  - geometric
  - admin
  - monitoring
  - proposal
  - draft
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/geometric-admin-debug-monitoring-proposal.md
date_ingested: 2026-07-28
source_version: 1.1
---

# Geometric Admin Debug & Monitoring Proposal

Draft proposal (status: draft, **NOT IMPLEMENTED**) for admin-accessible debugging and monitoring of Geometric tool crawling and AI Overview validation.

## Code Status (2026-07-23): Zero Implementation

Four priority items all missing: structured error tracking for `crawling.failed`, `cacheCrawlingArtifactsForAdmin` action, `aiOverviewConfidence` field, admin verification endpoint.

## Proposed Capabilities

1. **Crawling verification per session**: raw SERP storage, artifact diffing, session audit trail
2. **AI Overview validation**: selector confidence score, content heuristics, length validation, HTML structure check, cross-query consistency
3. **Structured error tracking**: `crawling.failed` with typed reason codes and timestamps

## Implementation Scope

Admin-only access. Backend: `cacheCrawlingArtifactsForAdmin` action in `generation-system.actions.ts`, admin verification endpoint. Frontend: admin verification page with session selector, raw data viewer, AI Overview comparison view.

## Contradictions

None.

## Source

- File: `docs/02-design/geometric-admin-debug-monitoring-proposal.md`
- Version: 1.1
- Last reviewed: 2026-07-23
- Owner: Backend Runtime + Admin Platform
- Status: draft