# packages/domain

Cross-context canonical domain primitives package.

Package: `@gen-app-2/domain`

## Current Status

Active and consumed by backend and contracts (DDD-074).

## Scope

This package hosts stable, framework-agnostic domain primitives shared across contexts.

Current canonical exports include core value sets such as:

- `ArtifactType`
- `ArtifactStatus`
- `OutputFormat`
- `WorkflowRunMode`
- `ArtifactRole`

## Rule Of Use

Promote a concept here only when it is truly cross-context and stable.

Do not move symbols to this package only for convenience.

## Package Commands

```bash
npm --workspace packages/domain run typecheck
```

## DDD References

1. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `../../docs/02-design/domain-bounded-context-map.md`
3. `../../docs/07-governance/domain-naming-decision-log.md`
