# Gate 003A Rollback

Scope
- Revert frontend move from apps/frontend/* back to frontend/*.

Preconditions
- No dependent Phase 3B/3C changes requiring new frontend path.

Commands
1. mkdir -p frontend
2. cp -r apps/frontend/* frontend/
3. rm -rf apps/frontend
4. restore scripts/path filters referencing apps/frontend

ExpectedPostRollbackState
- frontend/* restored as active frontend root.

ValidationCommands
- npm --prefix frontend run typecheck
- npm --prefix frontend run build
