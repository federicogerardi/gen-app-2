---
applyTo: "apps/backend/src/lib/**/*.ts"
description: "Backend XState orchestration guardrails with DDD-first naming and FE/BE contract authority rules."
---

# Backend XState + DDD Guardrails

## Scope
Apply this guidance when editing backend runtime code, especially machine and orchestration paths.

## Mandatory DDD Alignment
- Validate domain-facing names against canonical references before introducing new symbols:
  - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
  - `docs/02-design/domain-bounded-context-map.md`
  - `docs/07-governance/domain-naming-decision-log.md`
- Preserve canonical terms such as `GenerationRequest`, `WorkflowStep`, `ToolWorkflow`, `ToolKey`, `Artifact`, `ClaimUsage`.
- New domain terms require a decision-log entry first.

## XState v5 Rules
- Prefer `setup(...).createMachine(...)` with explicit typed context/events/input.
- Keep side effects in actors/invocations (`fromPromise`, callbacks) and keep transitions deterministic.
- Keep retry/fallback behavior explicit in state transitions and error reason assignment.
- Avoid ad-hoc orchestration logic outside machine boundaries when equivalent machine path exists.

## Contract And Ownership Rules
- Backend is authority for generation orchestration and dependency resolution.
- Preserve shared contract boundary in `packages/contracts` and avoid redefining FE/BE transport types locally.
- Keep request normalization and workflow mapping deterministic; avoid introducing parallel mapping utilities.

## Testing Expectations
- For behavior changes in machine/orchestration code, update or add focused backend tests under `apps/backend/src/lib/tests/`.
- Prefer narrow unit/integration updates over broad fixture rewrites.
