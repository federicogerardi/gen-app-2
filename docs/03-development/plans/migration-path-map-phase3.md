---
title: Phase 3 Migration Path Mapping
version: 1.0
date: 2026-05-06
status: template
owner: Engineering
---

# Phase 3 Migration Path Map

This document defines the deterministic source → target mappings for Phase 3 runtime file moves (TASK-011, TASK-012, TASK-013).

## Phase 3A: Frontend Move (TASK-011)

| Source (Pre-Move) | Target (Post-Move) | Notes |
|---|---|---|
| `frontend/` | `apps/frontend/` | Directory move — entire frontend tree |
| `frontend/package.json` | `apps/frontend/package.json` | Frontend workspace package manifest |
| `frontend/tsconfig.json` | `apps/frontend/tsconfig.json` | Frontend TS config |
| `frontend/vite.config.ts` | `apps/frontend/vite.config.ts` | Frontend build config |
| `frontend/server.mjs` | `apps/frontend/server.mjs` | Frontend dev/prod proxy server |
| `frontend/src/` | `apps/frontend/src/` | Frontend source tree |
| `frontend/Dockerfile` | `apps/frontend/Dockerfile` | Frontend Docker build (if present) |
| `frontend/railway.toml` | `apps/frontend/railway.toml` | Frontend Railway deployment config (if present) |

**Post-Move Path Updates Required**:
- Root `railroad.toml` → reference `apps/frontend/railway.toml` (if moving deployment config)
- Root `Dockerfile` → if building backend, no change (frontend is separate service)
- Any CI workflow references to `frontend/` → update to `apps/frontend/`
- README.md examples and docs → update `cd frontend` to `cd apps/frontend`

---

## Phase 3B: Backend Move (TASK-012)

| Source (Pre-Move) | Target (Post-Move) | Notes |
|---|---|---|
| `src/` | `apps/backend/src/` | Backend source tree |
| `tsconfig.json` | `apps/backend/tsconfig.json` | Backend TS config (if root config is generic) |
| Backend dependencies in `package.json` | `apps/backend/package.json` | Already populated in TASK-003 |

**Post-Move Path Updates Required**:
- Backend import paths may need adjustment if they reference parent directories
- Symlinks or path aliases in `tsconfig.json` for shared packages (contracts, domain)
- CI workflows referencing root `src/` → update to `apps/backend/src/`

---

## Phase 3C: Database Move (TASK-013)

| Source (Pre-Move) | Target (Post-Move) | Notes |
|---|---|---|
| `db/migrations/` | `packages/infra-db/migrations/` | SQL migration files |
| `db/seeds/` | `packages/infra-db/seeds/` | SQL seed files |
| `db/scripts/` | `packages/infra-db/scripts/` | DB execution utilities (run-sql-dir.ts, etc.) |
| `db/README.redis-idempotency.md` | `packages/infra-db/README.redis-idempotency.md` | DB documentation |

**Post-Move Path Updates Required**:
- Root `package.json` db commands → reference `packages/infra-db` scripts
- `apps/backend/package.json` db commands → reference `../packages/infra-db` (relative paths)
- Docker build context if copying DB scripts → update COPY path in Dockerfile
- CI workflows invoking migration/seed commands → update paths

---

## Phase 3 Consolidated: Top-Level Config & Runtime Adjustments (TASK-014, TASK-015)

| File | Changes | Reason |
|---|---|---|
| `Dockerfile` | Update COPY paths for backend source and db scripts | Backend source moved to `apps/backend/src`; db scripts moved to `packages/infra-db/scripts` |
| `railway.toml` (root) | Relocate or remove; update frontend reference | If service config, may move to `apps/frontend/railway.toml`; backend remains at root or move to `apps/backend/railway.toml` |
| `.github/workflows/*.yml` | Update all path references | Path updates for new workspace structure |
| `README.md` | Add repository map and command matrix | Describe apps/* and packages/* ownership |

---

## Validation Checkpoints

**Phase 3A Completion (Frontend Move)**:
- Verify `npm --workspace apps/frontend run typecheck` passes
- Verify `npm --workspace apps/frontend run build` produces `dist/` in `apps/frontend/`
- Check that `frontend/` directory is now empty (all content moved)

**Phase 3B Completion (Backend Move)**:
- Verify `npm --workspace apps/backend run typecheck` passes
- Verify backend imports resolve correctly (path aliases, relative imports)
- Check that `src/` directory is now empty (all content moved)

**Phase 3C Completion (Database Move)**:
- Verify migration dry-run: `npm --workspace apps/backend run db:migrate:minimal --dry-run` (if supported)
- Verify seed execution path resolution
- Check that `db/` directory retains only historical artifacts (migrations, seeds moved; scripts moved)

---

## Rollback Strategy

Each sub-gate (3A, 3B, 3C) will produce a `rollback.md` and `rollback-ref.txt` artifact before progressing to the next step. Rollback commands will reverse the atomic move and restore the pre-move state.

**Example**: If Phase 3A (frontend move) fails validation, rollback command restores `frontend/` from `apps/frontend/` and clears the workspace entry in root `package.json`.

---

## Related Documents

- `plan/architecture-standard-monorepo-workspace-1.md` — Full implementation plan
- `docs/index-overview.md` — Documentation index (will be updated in Phase 4)
