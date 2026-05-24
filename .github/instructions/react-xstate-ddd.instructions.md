---
applyTo: "apps/frontend/src/**/*.ts*"
description: "React + XState v5 implementation guardrails for Frontend/UI with DDD and Ubiquitous Language alignment."
---

# React + XState + DDD Guardrails (Frontend/UI)

## Scope
Apply this guidance when editing React and XState code in frontend runtime files.

## Mandatory DDD Alignment
- Before naming new domain-facing symbols, verify canonical terms in:
  - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
  - `docs/02-design/domain-bounded-context-map.md`
  - `docs/07-governance/domain-naming-decision-log.md`
- Do not introduce synonyms for canonical terms.
- If a new term is required, register a DDD decision first.

## XState v5 Rules
- Prefer `setup(...).createMachine(...)` for typed machine definitions.
- Keep side effects inside invoked actors (`fromPromise`, callbacks) and machine actions, not ad-hoc component effects.
- Keep context updates deterministic and concentrated in typed `assign(...)` actions.
- Preserve event and context type safety; avoid broad `any` fallbacks.

## React Integration Rules
- Keep components declarative; avoid re-implementing machine state logic in component conditionals.
- Remember `useMachine(..., { input })` initializes actor input once at actor creation; when upstream props change later, sync with explicit events or recreate actor intentionally.
- Ensure constants used in `useEffect` body or dependency arrays are declared before the effect.
- Prefer smaller focused components, selectors, and helpers over large mixed-responsibility React files when the split improves reuse, testability, and ownership clarity.
- When a component or hook grows to mix orchestration, formatting, conditional copy selection, and presentation, extract the stable responsibilities into dedicated helpers or presentational subcomponents instead of extending the monolith.

## Frontend/UI Governance Rules
- Map UI work to canonical archetypes from `frontend-ui-ubiquitous-language-spec.md`:
  - `Tool Workspace Page`
  - `Data Table View`
- Avoid nested cards unless strictly necessary.
- Keep feedback-channel ownership deterministic (`inline-action`, `page-state`, `global`).
- Do not hardcode user-facing production copy inside React components, XState machines, hooks, query helpers, or runtime utilities when the surface already has a centralized copy module or copy authority.
- Prefer adding or reusing centralized copy entries over duplicating literals across files; keep copy grouped by owning surface so wording changes remain single-source.
- Do not gate behavior on rendered message text. If UI messaging affects control flow, derive the behavior from machine state, typed reason codes, or explicit booleans and map those states to copy separately.

## Runtime Ownership Boundary
- Frontend orchestrates interaction state and rendering.
- Backend remains authority for workflow ordering/dependency resolution and generation orchestration semantics.
- Preserve FE as consumer/projection for backend-owned orchestration contracts.
