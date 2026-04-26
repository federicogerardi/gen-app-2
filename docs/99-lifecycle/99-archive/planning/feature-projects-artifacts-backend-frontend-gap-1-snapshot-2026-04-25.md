---
status: archived
version: 2.0
last-reviewed: 2026-04-26
next-review-date: null
owner: Backend Platform + Frontend Platform
title: Projects & Artifacts Backend/Frontend Gap Closure (Archived)
date-archived: 2026-04-26
original-path: plan/feature-projects-artifacts-backend-frontend-gap-1.md
---

# Projects & Artifacts Backend/Frontend Gap Closure — Snapshot 2026-04-25

**Archived**: This planning document describes pre-publish feature phases. The projects and artifacts integration is now complete as evidenced by `tools-generation-go-closure-2026-04-25.md`.

**Original Goal**: Chiudere il gap backend/frontend per projects e artifacts con dati persistiti da DB.

**Status at Archive**: Completed. All backend and frontend phases executed successfully.

## Key Outcomes

### Backend (Completed)
- Type contracts and injection established
- Query repositories implemented (Postgres/stub)
- Authenticated HTTP routes `/api/projects*` and `/api/artifacts*` deployed
- Query mappers and tests added
- Smoke repository query tests passing

### Frontend (Completed)
- Capabilities propagated in auth provider
- Projects and artifacts clients aligned to backend payload contract
- Pages updated to consume live backend data
- Vite proxy configured for `/api`
- Frontend tests updated for capability branching

## Verification

- Backend: `npm run backend:go` green
- Frontend: `npm --prefix frontend run test` 81 passed
- Frontend: `npm --prefix frontend run typecheck` zero errors
- E2E: Functional validation of capability-live projects/artifacts list and create

## Canonical Reference

For current projects and artifacts state, see:
- `docs/02-design/specifications/frontend-spec.md` (frontend as-is)
- `docs/07-governance/review/tools-generation-go-closure-2026-04-25.md` (GO evidence)
