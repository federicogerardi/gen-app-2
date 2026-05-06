# packages/infra-db

Database infrastructure: migrations, seeds, execution utilities.

**Workspace package name**: `@gen-app-2/infra-db`

## Layout (after Phase 3)
- `migrations/` — SQL migration files (migrated from `/db/migrations`)
- `seeds/` — SQL seed files (migrated from `/db/seeds`)
- `scripts/` — Execution utilities (migrated from `/db/scripts`)
- `package.json` — DB workspace scripts

## Entrypoint
- `scripts/run-sql-dir.ts` — Migration/seed runner

## Phase 3 Status
- Workspace manifest: created Phase 1 skeleton
- Runtime move: scheduled Phase 3 (TASK-013)
