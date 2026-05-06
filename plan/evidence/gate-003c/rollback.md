# Gate 003C Rollback

Scope
- Revert DB move from packages/infra-db/* back to db/*.

Preconditions
- No committed migration changes only present in new path.

Commands
1. mkdir -p db
2. cp -r packages/infra-db/migrations db/
3. cp -r packages/infra-db/seeds db/
4. cp -r packages/infra-db/scripts db/
5. rm -rf packages/infra-db
6. restore backend/root db script paths

ExpectedPostRollbackState
- db/* restored as active migration/seed root.

ValidationCommands
- npm run db:migrate:minimal
- npm run db:seed:minimal
