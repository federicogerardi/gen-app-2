# Gate 003 Rollback

Scope
- Revert full Phase 3 migration (frontend, backend, db path normalization).

Preconditions
- Roll back as one unit if downstream tooling relies on old paths.

Commands
1. Restore frontend path
   - mkdir -p frontend && cp -r apps/frontend/* frontend/
2. Restore backend path
   - mkdir -p src && cp -r apps/backend/src/* src/
3. Restore db path
   - mkdir -p db && cp -r packages/infra-db/migrations db/ && cp -r packages/infra-db/seeds db/ && cp -r packages/infra-db/scripts db/
4. Remove migrated paths
   - rm -rf apps/frontend apps/backend/src packages/infra-db
5. Restore scripts and workflows references to legacy paths

ExpectedPostRollbackState
- Runtime roots restored at frontend/, src/, db/.

ValidationCommands
- npm run typecheck
- npm run test
- npm --prefix frontend run build
