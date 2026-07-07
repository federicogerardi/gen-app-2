---
goal: Increase cohesion score of Admin Handlers community from 0.05 by consolidating leaked responsibilities and clarifying domain boundaries
version: 1.0
date_created: 2026-07-07
last_updated: 2026-07-07
last-reviewed: 2026-07-07
next-review-date: 2026-07-14
owner: Domain Architecture
status: draft
tags: [refactoring, ddd, cohesion, auth-http, backend]
---

# Refactoring Plan: Admin Handlers Cohesion

## Context

From the [Graph Structural Analysis](../docs/07-governance/graph-structural-analysis-review.md), the `Admin Handlers` community has the lowest cohesion score (0.05) among all detected communities. This plan proposes a DDD-aligned refactoring to increase internal cohesion.

## Current State Analysis

### Community Composition (83 nodes)
- **Directory**: `apps/backend/src/lib/runtime/auth-http/` (30 files)
- **Internal edges**: 356
- **External edges**: 50
- **External/Internal ratio**: 0.14

### File Inventory

| Layer | Files | Purpose |
|-------|-------|---------|
| **Route Builders** | `auth-http-admin-routes.ts`, `auth-http-auth-routes.ts`, `auth-http-projects-routes.ts`, `auth-http-public-routes.ts`, `auth-http-tools-routes.ts` | Map URL patterns to handlers |
| **Domain Handlers** | `admin-handlers.ts`, `admin-user-handlers.ts`, `admin-api-service-handlers.ts`, `admin-api-service-binding-handlers.ts`, `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts` | Admin business logic |
| **Auth Handlers** | `auth-handlers.ts`, `public-handlers.ts` | Auth/session logic |
| **Tool Handlers** | `tools-handlers.ts`, `tools-brief-handlers.ts`, `tools-api-service-handlers.ts`, `tools-hydrate-handlers.ts`, `tools-orchestrate-handlers.ts`, `tools-session-handlers.ts` | Tool-specific HTTP logic |
| **Infrastructure** | `route-table.ts`, `route-dispatch.ts`, `runtime.ts`, `http-utils.ts`, `support.ts`, `zod-support.ts`, `tool-availability-policy.ts`, `tools-orchestrate-config.ts`, `tools-hydration-parser.ts` | Routing, parsing, utilities |
| **Project Handlers** | `projects-handlers.ts` | Project CRUD |

### External Coupling Hotspots

| Node | Internal | External | External Targets |
|------|----------|----------|------------------|
| `node-server.ts` | 29 | 7 | Community 11 (auth-contract), Community 22 (auth-http) |
| `route-table.ts` | 24 | 6 | Community 11, Community 10 (adapters) |
| `route-dispatch.ts` | 8 | 2 | Community 11, Community 146 (request-contract) |

### Root Cause of Low Cohesion

The community groups **5 distinct domain concerns** under one umbrella:

1. **Admin domain** — user management, model management, API services, bindings, feedback center
2. **Auth domain** — login, logout, session, Google OAuth
3. **Projects domain** — project CRUD
4. **Tools domain** — briefs, hydration, orchestrate, API services, sessions
5. **Routing infrastructure** — route table, dispatch, HTTP utils

These domains communicate more with their external counterparts (adapters, contracts, request-contract) than with each other. The community detection algorithm lumped them together because they share the `auth-http/` directory.

## Proposed Refactoring

### Approach: Subdirectory Decomposition (Non-Breaking)

Instead of moving files across directories (high-risk, broad import changes), introduce **logical subdirectories** within `auth-http/` to clarify ownership boundaries:

```
auth-http/
├── admin/
│   ├── admin-handlers.ts
│   ├── admin-user-handlers.ts
│   ├── admin-api-service-handlers.ts
│   ├── admin-api-service-binding-handlers.ts
│   ├── admin-llm-model-handlers.ts
│   ├── admin-feedback-center-handlers.ts
│   └── admin-routes.ts          (renamed from auth-http-admin-routes.ts)
├── auth/
│   ├── auth-handlers.ts
│   ├── public-handlers.ts
│   └── auth-routes.ts           (renamed from auth-http-auth-routes.ts)
├── projects/
│   ├── projects-handlers.ts
│   └── projects-routes.ts       (renamed from auth-http-projects-routes.ts)
├── tools/
│   ├── tools-handlers.ts
│   ├── tools-brief-handlers.ts
│   ├── tools-api-service-handlers.ts
│   ├── tools-hydrate-handlers.ts
│   ├── tools-orchestrate-handlers.ts
│   ├── tools-session-handlers.ts
│   ├── tools-orchestrate-config.ts
│   ├── tools-hydration-parser.ts
│   └── tools-routes.ts          (renamed from auth-http-tools-routes.ts)
├── runtime.ts                   (stays)
├── route-table.ts               (stays — refactored imports)
├── route-dispatch.ts            (stays)
├── http-utils.ts                (stays)
├── support.ts                   (stays)
├── zod-support.ts               (stays)
├── tool-availability-policy.ts  (stays)
└── route-table.test.ts          (stays)
```

### Alternative: Extract Handler Factories

A simpler approach with less file churn: add **explicit barrel files** per domain that re-export only the handlers for that domain, making the boundary visible without moving files.

## Execution Checklist

### Phase 1 — Analysis (this plan)

- [x] Map community composition and external coupling
- [x] Identify domain boundaries within auth-http/
- [x] Draft refactoring proposal

### Phase 2 — Implementation (when approved)

- [ ] Create subdirectories (`admin/`, `auth/`, `projects/`, `tools/`)
- [ ] Move handler files to appropriate subdirectories
- [ ] Update internal imports within `auth-http/`
- [ ] Update external imports in `node-server.ts` and test files
- [ ] Verify `npm run typecheck` passes
- [ ] Verify `npm run test` passes
- [ ] Run `graphify update .` to re-measure cohesion

### Phase 3 — Validation

- [ ] Cohesion score for the refactored communities should increase from 0.05 to ≥0.15
- [ ] No regressions in backend test suite
- [ ] No changes to public API surface

## Risks

| Risk | Mitigation |
|------|-----------|
| Import path changes break external consumers | Use barrel re-exports from `auth-http/index.ts` to maintain backward compatibility |
| Graph community detection may still group domains together | Subdirectories improve code organization regardless of graph metrics |
| Test file imports need updating | Mechanical change — update paths in test files |

## Expected Outcome

- **Cohesion**: 0.05 → ≥0.15 (each subdirectory forms its own community)
- **Coupling**: External coupling ratio remains stable (0.14) — no new dependencies introduced
- **Maintainability**: Clear domain boundaries within auth-http/ improve navigability

## References

- [Graph Structural Analysis](../docs/07-governance/graph-structural-analysis-review.md)
- [Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
- `apps/backend/src/lib/runtime/auth-http/` (30 files)
- `graphify-out/GRAPH_REPORT.md` — Community 1: "Admin Handlers Adminhandlers"
