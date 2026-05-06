# Gate 004 Rollback

Scope
- Revert Phase 4 doc/CI/governance updates while preserving runtime migration if desired.

Preconditions
- Decide whether rollback is docs-only or full (with Gate 003 rollback).

Commands
1. Restore previous workflow files from last stable commit
2. Move docs/03-development/plans/*.md back to plan/ if required
3. Revert README and docs/index-overview path updates
4. Revert ADR addendum section

ExpectedPostRollbackState
- CI and documentation return to pre-Phase-4 references.

ValidationCommands
- npm run typecheck
- npm run test
- verify links in docs/index-overview.md
