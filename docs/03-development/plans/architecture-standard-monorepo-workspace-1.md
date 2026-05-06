---
goal: Standardize repository layout into a deterministic npm workspace monorepo with explicit app/package boundaries
version: 1.0
date_created: 2026-05-06
last_updated: 2026-05-06
owner: Engineering
status: 'Planned'
tags: [architecture, refactor, workspace, monorepo, ddd, ci]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan migrates the current dual-root structure into a standard npm workspace monorepo with deterministic boundaries for backend, frontend, shared contracts, and database infrastructure. The migration preserves DDD canonical terminology and introduces machine-verifiable checkpoints to prevent regressions.

## 1. Requirements & Constraints

- **REQ-001**: Introduce npm workspaces at repository root and use a single package manager lockfile strategy.
- **REQ-002**: Keep runtime behavior unchanged for backend APIs and frontend routes during Phases 1-2.
- **REQ-003**: Preserve canonical domain terms defined in docs/01-requirements/domain-ubiquitous-language-glossary.md.
- **REQ-004**: Extract cross-context FE/BE contracts into a dedicated shared package and consume them from both apps.
- **REQ-005**: Keep database migrations and seeds runnable from deterministic commands after restructuring.
- **SEC-001**: No secrets in committed files; environment values must remain in local or deployment-managed env files.
- **OPS-001**: CI must run workspace-wide typecheck and tests with explicit per-app jobs.
- **CON-001**: Do not change public endpoint paths exposed by src/server.ts or frontend/server.mjs in this migration.
- **CON-002**: Do not rename canonical DDD terms unless first approved in docs/07-governance/domain-naming-decision-log.md.
- **CON-003**: Phase execution is strictly sequential; Phase N+1 cannot start before Gate N is marked passed.
- **GUD-001**: Prefer additive migration with compatibility shims before destructive moves.
- **PAT-001**: Apply app/package split pattern: apps/* for deployables, packages/* for shared libraries.
- **ROL-001**: Each phase must define a deterministic rollback command set and a single rollback commit reference before gate evaluation.
- **OPS-002**: Each gate pass must produce machine-verifiable evidence artifacts under `plan/evidence/` (`commands.log`, `test-summary.log`, `diff-summary.md`).

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish workspace foundation and centralized root orchestration without moving runtime code yet.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update package.json at repository root: add `private: true`, `workspaces: ["apps/*", "packages/*"]`, and root scripts `dev`, `build`, `test`, `typecheck` using npm workspace selectors. |  |  |
| TASK-002 | Create folder skeleton: apps/backend, apps/frontend, packages/contracts, packages/domain, packages/infra-db; add placeholder README.md files in each folder to lock intended boundaries. |  |  |
| TASK-003 | Create apps/backend/package.json with scripts mapped to existing backend commands currently in root package.json (`start:server`, `typecheck`, `test`, migration helpers). |  |  |
| TASK-004 | Prepare deterministic move manifests without moving runtime files: create `plan/migration-path-map-phase3.md` with source->target mappings for `frontend/* -> apps/frontend/*`, `src/* -> apps/backend/src/*`, `db/* -> packages/infra-db/*`. |  |  |
| TASK-005 | Add temporary compatibility scripts in root package.json that proxy old command names to workspace commands; produce Phase 1 gate artifacts (`plan/evidence/gate-001/commands.log`, `test-summary.log`, `diff-summary.md`, `rollback.md`, `rollback-ref.txt`) before gate evaluation. |  |  |

### Implementation Phase 2

- GOAL-002: Extract shared FE/BE contract types into a dedicated package and enforce single-source imports.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create packages/contracts/package.json and tsconfig.json; expose src/index.ts as public entrypoint for shared types. |  |  |
| TASK-007 | Move canonical contract types from `frontend/src/features/generation/contracts/backend-stream.ts` (Phase 1-2 path invariant, pre-move) and `src/lib/runtime/request-contract.ts` + `src/lib/runtime/stream-contract.ts` into `packages/contracts/src` with explicit exports (`GenerationRequest`, `BackendStreamEvent`, related value objects). |  |  |
| TASK-008 | Update backend imports in src/lib/runtime/* and src/server.ts to consume shared contracts from packages/contracts instead of local duplicate definitions. |  |  |
| TASK-009 | Update frontend imports in `frontend/src/features/generation/contracts/*` and dependent runtime files to consume packages/contracts exports (pre-move path; rewrite to `apps/frontend/src/*` happens in Phase 3 after move). |  |  |
| TASK-010 | Add compile-time parity guard in packages/contracts (or backend test) that fails if FE/BE adapters diverge from shared contract shapes; produce Phase 2 gate artifacts (`plan/evidence/gate-002/commands.log`, `test-summary.log`, `diff-summary.md`, `rollback.md`, `rollback-ref.txt`). |  |  |

### Implementation Phase 3

- GOAL-003: Normalize backend and database boundaries into apps/backend and packages/infra-db with deterministic command ownership.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Deterministic runtime move Step A: move `frontend/*` to `apps/frontend/*` in a single atomic commit; update references in README/docs/scripts from `frontend/` to `apps/frontend/`; verify `npm --prefix apps/frontend run typecheck`; produce Sub-Gate A artifacts in `plan/evidence/gate-003a/*` including rollback metadata. |  |  |
| TASK-012 | Deterministic runtime move Step B: move backend source from `src/*` to `apps/backend/src/*`; update tsconfig paths, entrypoint scripts, and imports; verify `npm --workspace apps/backend run typecheck`; produce Sub-Gate B artifacts in `plan/evidence/gate-003b/*` including rollback metadata. |  |  |
| TASK-013 | Deterministic runtime move Step C: move `db/*` into `packages/infra-db/*`; export reusable migration runner commands in `packages/infra-db/package.json`; verify migration dry-run command resolves new paths; produce Sub-Gate C artifacts in `plan/evidence/gate-003c/*` including rollback metadata. |  |  |
| TASK-014 | Update all root/workspace migration and seed scripts to call `packages/infra-db/scripts/run-sql-dir.ts` using workspace-scoped commands after Step C is complete. |  |  |
| TASK-015 | Update Dockerfile, `railway.toml`, and `apps/frontend/railway.toml` references for new runtime paths; add explicit path-resolution smoke checks for backend prompt/template loading under `apps/backend/src/lib/runtime/tool-prompts`; produce consolidated Phase 3 artifacts in `plan/evidence/gate-003/*` including rollback metadata. |  |  |

### Implementation Phase 4

- GOAL-004: Consolidate CI, documentation lifecycle, and plan governance under the standardized structure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Add/adjust CI workflow files under .github/workflows to run `npm run typecheck`, `npm run test`, and per-workspace build/test gates. |  |  |
| TASK-017 | Migrate active plan documents from plan/*.md into docs/03-development/plans/ with index updates in docs/index-overview.md; keep archived snapshots in docs/99-lifecycle/99-archive. |  |  |
| TASK-018 | Add repository map section in README.md describing apps/* and packages/* ownership and command matrix. |  |  |
| TASK-019 | Add architecture decision note in `docs/02-design/adr/frontend-data-access-layer-adr.md` documenting monorepo boundary rationale, deterministic phase sequencing, and rollback strategy. |  |  |
| TASK-020 | Remove temporary compatibility scripts introduced in TASK-005 only after two successful release cycles with no fallback usage; produce Phase 4 gate artifacts in `plan/evidence/gate-004/*` including rollback metadata and release-cycle evidence links. |  |  |

### Phase Exit Gates (Blocking)

- **GATE-001 (after Phase 1)**: `TASK-001..TASK-005` completed, no runtime file moves performed, root and placeholder layout committed, compatibility scripts operational.
- **GATE-002 (after Phase 2)**: `TASK-006..TASK-010` completed, shared contracts consumed by both contexts on pre-move paths, parity guard passing.
- **GATE-003 (after Phase 3)**: `TASK-011..TASK-015` completed in strict order A->B->C, all runtime paths migrated, backend/frontend/typecheck and migration dry-run passing.
- **GATE-004 (after Phase 4)**: `TASK-016..TASK-020` completed, CI green on new paths, docs and ADR updated, compatibility scripts removed only after release-cycle evidence.

### Phase 3 Sub-Gates (Mandatory)

- **GATE-003A (after TASK-011)**: frontend move completed, `apps/frontend` typecheck passing, evidence and rollback metadata written under `plan/evidence/gate-003a/`.
- **GATE-003B (after TASK-012)**: backend move completed, `apps/backend` typecheck passing, evidence and rollback metadata written under `plan/evidence/gate-003b/`.
- **GATE-003C (after TASK-013)**: db move completed, migration dry-run passing on `packages/infra-db`, evidence and rollback metadata written under `plan/evidence/gate-003c/`.

## 3. Alternatives

- **ALT-001**: Keep current root + frontend split and only refine scripts. Rejected because duplication and drift risks remain for contracts and CI.
- **ALT-002**: Use pnpm/turborepo migration first. Rejected for now to minimize tooling change and preserve npm continuity.
- **ALT-003**: Full big-bang move in one commit. Rejected due to high rollback risk and low diagnosability.

## 4. Dependencies

- **DEP-001**: Existing backend runtime entrypoint in src/server.ts and frontend server in frontend/server.mjs must stay behavior-compatible during Phases 1-2.
- **DEP-002**: DDD canonical references in docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, docs/07-governance/domain-naming-decision-log.md.
- **DEP-003**: Railway deployment descriptors at `railway.toml` and `frontend/railway.toml` require synchronized path updates during Phase 3 Step A and finalization to `apps/frontend/railway.toml`.
- **DEP-004**: Docker build context in `Dockerfile` and `frontend/Dockerfile` requires synchronized path updates during Phase 3 Step A and finalization to `apps/frontend/Dockerfile`.
- **DEP-005**: TypeScript project references/tsconfig resolution must be aligned before moving shared types.

## 5. Files

- **FILE-001**: package.json — workspace enablement and orchestration scripts.
- **FILE-002**: package-lock.json — single lockfile normalization for workspaces.
- **FILE-003**: apps/backend/package.json — backend workspace scripts.
- **FILE-004**: apps/backend/src/server.ts — backend runtime entrypoint after move.
- **FILE-005**: apps/frontend/package.json — frontend workspace package after move.
- **FILE-006**: apps/frontend/server.mjs — frontend runtime proxy server after move.
- **FILE-007**: packages/contracts/src/index.ts — shared FE/BE contract exports.
- **FILE-008**: packages/infra-db/scripts/run-sql-dir.ts — database execution utility location.
- **FILE-009**: Dockerfile — backend build/run path updates.
- **FILE-010**: README.md — standardized workspace map and commands.
- **FILE-011**: docs/index-overview.md — docs and plan indexing updates.
- **FILE-012**: .github/workflows/backend-gate.yml — backend workspace CI gate updates.
- **FILE-013**: .github/workflows/main-pr-gate.yml — monorepo workspace orchestration gate updates.
- **FILE-014**: .github/workflows/sync-dev-after-release.yml — post-release compatibility-script cleanup policy checks.

## 6. Testing

- **TEST-001**: Root workspace validation: run `npm install` then `npm run typecheck` from repository root with workspace resolution enabled.
- **TEST-002**: Backend regression suite: run backend workspace `typecheck`, `test`, and startup smoke command (`start:server`) with migrated paths.
- **TEST-003**: Frontend regression suite: run frontend workspace `typecheck`, `test`, `build`, and local server startup.
- **TEST-004**: Contract integrity gate: compile shared contracts and run parity checks confirming FE and BE consume identical exported types.
- **TEST-005**: Database command gate: run migration and seed commands from workspace scripts and verify no path resolution errors.
- **TEST-006**: Deployment dry-run: build Docker images and validate Railway config path references for both backend and frontend services.
- **TEST-007**: Documentation link gate: verify docs/index-overview.md links resolve after moving plan files.
- **TEST-008**: Rollback verification: for each gate, validate `rollback.md` contains deterministic rollback commands and `rollback-ref.txt` contains one rollback commit reference.
- **TEST-009**: Evidence artifact and move-manifest verification: validate required evidence files exist for each gate/sub-gate and include non-empty execution output (`commands.log`, `test-summary.log`, `diff-summary.md`); validate `plan/migration-path-map-phase3.md` exists and covers all declared move mappings.
- **TEST-010**: CI workflow execution verification: validate workflow syntax/path for `.github/workflows/backend-gate.yml`, `.github/workflows/main-pr-gate.yml`, `.github/workflows/sync-dev-after-release.yml`, and execute the workflow-equivalent commands locally for migrated workspace paths.
- **TEST-011**: DDD terminology governance verification (REQ-003): validate all newly introduced or modified domain terms in plan/docs/ADR are present in canonical references (`docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`) and no unapproved synonym is introduced.

### Task -> Gate -> Test Traceability Matrix

| Task | Gate | Test | Verification Rule |
|------|------|------|-------------------|
| TASK-001 | GATE-001 | TEST-001 | Root workspace config exists and `npm run typecheck` resolves workspace selectors. |
| TASK-002 | GATE-001 | TEST-001 | `apps/*` and `packages/*` skeleton detected; no runtime code moved. |
| TASK-003 | GATE-001 | TEST-001 | `apps/backend/package.json` scripts execute in workspace bootstrap context without path errors. |
| TASK-004 | GATE-001 | TEST-009 | `plan/migration-path-map-phase3.md` exists and lists all source->target mappings. |
| TASK-005 | GATE-001 | TEST-008 | Compatibility scripts and Phase 1 rollback metadata are present and valid. |
| TASK-006 | GATE-002 | TEST-004 | `packages/contracts` builds and exports from `src/index.ts`. |
| TASK-007 | GATE-002 | TEST-004 | Shared contract types moved and imported from one package source. |
| TASK-008 | GATE-002 | TEST-002 | Backend compiles/tests against shared contracts with no local contract duplication. |
| TASK-009 | GATE-002 | TEST-003 | Frontend compiles/tests against shared contracts on pre-move paths. |
| TASK-010 | GATE-002 | TEST-008 | Phase 2 rollback metadata exists and parity guard verification is logged. |
| TASK-011 | GATE-003A | TEST-003 | Step A move complete; `apps/frontend` typecheck passes before Step B. |
| TASK-012 | GATE-003B | TEST-002 | Step B move complete; `apps/backend` typecheck passes before Step C. |
| TASK-013 | GATE-003C | TEST-005 | Step C move complete; migration dry-run resolves `packages/infra-db` paths. |
| TASK-014 | GATE-003 | TEST-005 | Root/workspace db scripts call migrated infra-db runner paths. |
| TASK-015 | GATE-003 | TEST-008 | Phase 3 consolidated rollback metadata exists and validates migrated runtime rollback path. |
| TASK-016 | GATE-004 | TEST-010 | CI workflows execute workspace-aware typecheck/test gates on new paths. |
| TASK-017 | GATE-004 | TEST-007 | Plan document relocation completed and docs index links remain valid. |
| TASK-018 | GATE-004 | TEST-007 | README repository map and command matrix match actual workspace layout. |
| TASK-019 | GATE-004 | TEST-011 | ADR note in `docs/02-design/adr/frontend-data-access-layer-adr.md` includes rationale + rollback and uses approved canonical DDD terminology only. |
| TASK-020 | GATE-004 | TEST-009 | Phase 4 evidence artifacts and release-cycle evidence links recorded before compatibility cleanup closure. |

### Rollback Metadata Template (Mandatory)

- `rollback.md` must include: `Scope`, `Preconditions`, `Commands`, `ExpectedPostRollbackState`, `ValidationCommands`.
- `rollback-ref.txt` must include exactly one commit reference in the format `<commit-sha>`.

### Gate Evidence Checklist

- **GATE-001 evidence**: `plan/evidence/gate-001/commands.log`, `plan/evidence/gate-001/test-summary.log`, `plan/evidence/gate-001/diff-summary.md`.
- **GATE-002 evidence**: `plan/evidence/gate-002/commands.log`, `plan/evidence/gate-002/test-summary.log`, `plan/evidence/gate-002/diff-summary.md`.
- **GATE-003 evidence**: `plan/evidence/gate-003/commands.log`, `plan/evidence/gate-003/test-summary.log`, `plan/evidence/gate-003/diff-summary.md`.
- **GATE-004 evidence**: `plan/evidence/gate-004/commands.log`, `plan/evidence/gate-004/test-summary.log`, `plan/evidence/gate-004/diff-summary.md`.
- **GATE-003A evidence**: `plan/evidence/gate-003a/commands.log`, `plan/evidence/gate-003a/test-summary.log`, `plan/evidence/gate-003a/diff-summary.md`, `plan/evidence/gate-003a/rollback.md`, `plan/evidence/gate-003a/rollback-ref.txt`.
- **GATE-003B evidence**: `plan/evidence/gate-003b/commands.log`, `plan/evidence/gate-003b/test-summary.log`, `plan/evidence/gate-003b/diff-summary.md`, `plan/evidence/gate-003b/rollback.md`, `plan/evidence/gate-003b/rollback-ref.txt`.
- **GATE-003C evidence**: `plan/evidence/gate-003c/commands.log`, `plan/evidence/gate-003c/test-summary.log`, `plan/evidence/gate-003c/diff-summary.md`, `plan/evidence/gate-003c/rollback.md`, `plan/evidence/gate-003c/rollback-ref.txt`.
- **All gates rollback evidence**: each `gate-00x` directory must also include `rollback.md` and `rollback-ref.txt`.

## 7. Risks & Assumptions

- **RISK-001**: Path migration may break runtime imports in backend prompt/template loading.
- **RISK-002**: Workspace adoption can surface hidden implicit dependencies previously available due to root installation behavior.
- **RISK-003**: CI runtime may fail if job caches still assume legacy frontend path.
- **RISK-004**: Documentation references to frontend/* and plan/* may become stale if not updated atomically.
- **RISK-005**: Temporary compatibility scripts may persist too long and mask incomplete migration.
- **ASSUMPTION-001**: npm version in CI supports workspaces features required by this plan.
- **ASSUMPTION-002**: Deployment pipeline permits path updates to apps/* and packages/* without infra policy blockers.
- **ASSUMPTION-003**: No immediate requirement to introduce new package manager tooling (pnpm/turbo/nx) during this migration.

## 8. Related Specifications / Further Reading

[docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md)
[docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
[docs/index-overview.md](../docs/index-overview.md)
[README.md](../README.md)
