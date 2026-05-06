# Gate 003B Rollback

Scope
- Revert backend move from apps/backend/src/* to src/*.

Preconditions
- No dependent commits requiring apps/backend/src path.

Commands
1. mkdir -p src
2. cp -r apps/backend/src/* src/
3. rm -rf apps/backend/src
4. restore root/backend scripts that reference apps/backend

ExpectedPostRollbackState
- src/* restored as active backend root.

ValidationCommands
- npm run typecheck
- npm run test
