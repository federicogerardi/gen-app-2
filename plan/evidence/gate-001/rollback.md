# Phase 1 Gate-001 Rollback Plan
# Date: 2026-05-06

## Scope
Reverse Phase 1 implementation: remove workspace scaffolding, restore original root package.json, delete placeholder directories.

## Preconditions
- No Phase 2+ operations have been executed
- All files to be deleted remain in their created state (no runtimecode has been moved)

## Rollback Commands

### Step 1: Remove workspace directories
```bash
rm -rf apps packages
```

### Step 2: Restore root package.json
```bash
git checkout package.json
```
Or manually restore to original state:
```json
{
  "name": "gen-app-2",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "db:migrate:minimal": "tsx db/scripts/run-sql-dir.ts db/migrations",
    "db:seed:minimal": "tsx db/scripts/run-sql-dir.ts db/seeds",
    "db:seed:redis:minimal": "tsx db/seeds/20260424_000002_minimal_redis_idempotency_example.ts",
    "start": "npm run db:migrate:minimal && npm run start:server",
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test src/lib/tests/*.test.ts",
    "test:smoke": "npm run smoke:idempotency && npm run smoke:conflict && npm run smoke:queries",
    "smoke:idempotency": "tsx src/lib/adapters/postgres-redis.smoke.ts",
    "smoke:conflict": "tsx src/lib/adapters/postgres-redis.conflict.smoke.ts",
    "smoke:queries": "tsx src/lib/adapters/postgres-redis.query.smoke.ts",
    "backend:go": "npm run db:migrate:minimal && npm run db:seed:minimal && npm run typecheck && npm run test",
    "backend:go:smoke": "npm run backend:go && npm run test:smoke",
    "start:server": "tsx src/server.ts",
    "frontend:sprint:gate": "npm --prefix frontend run typecheck && npm --prefix frontend run test && npm --prefix frontend run build && npm run backend:go"
  }
}
```

### Step 3: Clean node_modules lockfile (optional)
```bash
npm install  # to refresh npm install from original package.json
```

### Step 4: Delete evidence directory (optional)
```bash
rm -rf plan/evidence/gate-001
rm plan/migration-path-map-phase3.md
```

## Expected Post-Rollback State
- `apps/` directory removed
- `packages/` directory removed
- `package.json` restored to original state (no workspaces, original scripts)
- `plan/migration-path-map-phase3.md` removed
- Repository ready for clean restart or alternative migration strategy
- No breaking changes to any downstream systems (no runtime code moved)

## Validation Commands (Post-Rollback)
```bash
# Verify workspace directories removed
$ ls -la | grep -E "apps|packages" || echo "Removed"

# Verify original scripts work
$ npm run backend:go --dry-run  # should reference src/ not apps/backend/src

# Verify git status clean
$ git status
```

## Execution Notes
- **Time Required**: < 1 minute
- **Manual Intervention**: None (all commands are automated)
- **Rollback Point**: Can be executed at any time before Phase 2 completion
- **Reversible**: Yes — can re-apply Phase 1 after rollback without data loss
