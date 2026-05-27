# packages/contracts

Cross-context contract authority for Generation <-> Frontend/UI boundaries.

Package: `@gen-app-2/contracts`

## Purpose

This package defines shared transport and policy contracts used by both frontend and backend, including:

- `GenerationRequest`
- `BackendStreamEvent`
- extraction field contracts and requiredness maps
- tool workflow and tool availability policy contracts

## Source Layout

- `src/index.ts`: main public contracts
- `src/parity.guard.ts`: compile-time FE/BE contract parity guard

## Governance Rules

- Do not redefine shared boundary contracts in app-local files.
- Update this package first when a boundary contract changes.
- Keep naming aligned with canonical DDD terms.

## Package Commands

```bash
npm --workspace packages/contracts run typecheck
```

## DDD References

1. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `../../docs/02-design/domain-bounded-context-map.md`
3. `../../docs/07-governance/domain-naming-decision-log.md`
