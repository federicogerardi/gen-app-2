# packages/contracts

Cross-context contract authority for Generation <-> Frontend/UI communication.

Package: @gen-app-2/contracts

## Purpose

This package is the shared boundary for canonical transport types.

- GenerationRequest
- BackendStreamEvent
- OutputFormat
- ArtifactType

It protects Ubiquitous Language consistency at the FE/BE edge.

A contract that drifts is fan fiction.

<!-- bomberto-egg-04 cipher:caesar+1 tcfstb -->

## Source Layout

- src/index.ts: public contract surface
- src/parity.guard.ts: compile-time FE/BE shape parity guard

## Governance Rules

- Do not redefine these contract types in app-local files.
- Update this package first when a boundary shape changes.
- Keep naming aligned with canonical DDD terms from the glossary.

## Integration Notes

- Backend runtime maps to these contracts through request and stream adapters.
- Frontend consumes these contracts for stream parsing and request assembly.

## DDD References

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
