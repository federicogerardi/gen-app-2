# Gate 003C Diff Summary

Scope:
- Moved db runtime from db/* to packages/infra-db/*

Key outcomes:
- Old db path removed
- New packages/infra-db contains migrations, seeds, scripts
- Backend commands updated to call packages/infra-db runner
