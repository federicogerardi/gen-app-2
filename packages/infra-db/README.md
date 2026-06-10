# packages/infra-db

Database infrastructure package for schema migration and seed execution.

Package: `@gen-app-2/infra-db`

## Scope

This package contains:

- SQL migrations for persistence schema evolution
- SQL and script-based seeds
- shared SQL directory runner utilities

## Layout

- `migrations/`
- `seeds/`
- `scripts/run-sql-dir.ts`

## Package Commands

From repository root:

```bash
npm --workspace packages/infra-db run migrate:minimal
npm --workspace packages/infra-db run seed:minimal
npm --workspace packages/infra-db run seed:redis:minimal
```

Common backend path:

```bash
npm --workspace apps/backend run db:migrate:minimal
```

## Notes

- DB columns may stay snake_case for storage compatibility.
- Domain terminology in code/docs remains canonical DDD terminology.

## DDD References

1. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `../../docs/02-design/domain-bounded-context-map.md`
3. `../../docs/07-governance/domain-naming-decision-log.md`
