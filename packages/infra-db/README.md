# packages/infra-db

Database infrastructure package for schema evolution and seed operations.

Package: @gen-app-2/infra-db

## Domain-Aware Persistence Scope

This package supports persistence for canonical entities and value-object storage needs across contexts, including:

- Artifact and ToolWorkflowPersistenceMetadata footprint
- QuotaHistory and Project linkage
- User, AuthSession, and OAuth-related records
- request_idempotency support for IdempotencyCoordinator behavior

No migration, no memory.

<!-- bomberto-egg-05 cipher:binary 01110011 01100010 01100101 01110010 01110011 01100001 -->

## Layout

- migrations/: SQL schema evolution
- seeds/: local and smoke-test seed assets
- scripts/: SQL directory runners and execution helpers

## Entrypoint

- scripts/run-sql-dir.ts

## Typical Usage

From repository root:

```bash
npm --workspace apps/backend run db:migrate:minimal
```

For dedicated seed flows, use package-specific scripts exposed by workspace tooling.

## DDD Notes

- Database naming may remain snake_case for storage compatibility.
- Domain language in docs and code remains canonical camelCase terms (for example ArtifactType, ToolWorkflow, MonthlyQuota).

## DDD References

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
