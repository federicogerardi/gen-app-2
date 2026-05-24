# AGENTS

## Purpose
Use this file as the fast start for AI coding agents in this repository.

Priority focus for this workspace:
- React + XState implementation quality
- DDD-first naming governance and Ubiquitous Language consistency
- Deterministic FE/BE contract behavior

## Mandatory Read Order (Before Any Edit)
Always read these canonical references first:
1. [Domain Ubiquitous Language Glossary](docs/01-requirements/domain-ubiquitous-language-glossary.md)
2. [Domain Bounded Context Map](docs/02-design/domain-bounded-context-map.md)
3. [Domain Naming Decision Log](docs/07-governance/domain-naming-decision-log.md)

If touching UI code or UI docs, also read:
4. [Frontend UI Ubiquitous Language Spec](docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)

Do not introduce non-canonical domain terms in code, tests, docs, PR notes, or comments.

## Architecture Snapshot
- Monorepo with npm workspaces: apps + packages.
- Backend aggregate root: GenerationSystem and related XState actors.
- Frontend aggregate root: ToolPage and related XState machines.
- Shared contract authority: packages/contracts.
- Shared domain primitives: packages/domain.

Reference map: [Documentation Index Overview](docs/index-overview.md)

## React + XState Conventions
- Prefer XState v5 patterns already present in repo: setup().createMachine(), typed actors, typed events, fromPromise for async effects.
- Keep machine logic in machines and selectors; keep components mostly declarative.
- Preserve backend authority for orchestration ordering and dependency resolution. Frontend projects and renders state; it does not re-own backend orchestration rules.
- Preserve canonical FE terms (ToolPage, ReadinessSnapshot, ToolStep, ExtractionContext, HydrationResult, DispatchError).
- Keep user-facing production copy centralized. Do not introduce hardcoded UI text in components, hooks, machines, or query helpers when the owning surface already has a copy module.
- Never make control flow depend on rendered copy text; use typed state, explicit reason codes, or booleans and map them to copy separately.
- Favor scalable modular structure: split mixed-responsibility files into focused helpers, selectors, and presentational components when that improves reuse and keeps ownership clear.

Known workspace pitfalls to avoid:
- useMachine(..., { input }) initializes actor input once; if input props change after mount, sync via event or recreate actor.
- In assign(...) with shared params typing, ensure fields share a compatible params shape to avoid TypeScript inference breakage.
- In callback onDone branches with custom event typing, explicit event output narrowing/casting may be required when done event is not represented in local unions.
- In React hooks, declare constants before useEffect if referenced in effect body or dependency array (avoid temporal dead zone runtime errors).

## Build/Test Commands
Run from repository root unless explicitly scoped.

Install:
- npm install --workspaces --include-workspace-root

Primary checks:
- npm run typecheck
- npm run test
- npm run build

Frontend focused:
- npm --workspace apps/frontend run typecheck
- npm --workspace apps/frontend run test
- npm --workspace apps/frontend run build

Backend focused:
- npm --workspace apps/backend run typecheck
- npm --workspace apps/backend run test
- npm --workspace apps/backend run go

Smoke scripts that require env loading locally:
- set -a && . ./.env.local && set +a && npm run test:smoke
- set -a && . ./.env.local && set +a && npm run backend:go

## Dependency And Lockfile Safety
If any package.json changes, regenerate lockfiles via npm only (never hand-edit lockfiles).

Required verification sequence:
1. npm install --workspaces --include-workspace-root
2. npm ci
3. npm ci --workspaces --include-workspace-root
4. npm --workspace apps/frontend run build

## Responsible AI And Accessibility Checks
For user-facing changes:
- Verify keyboard navigation and visible focus.
- Verify screen-reader labels for interactive controls.
- Verify error messages are actionable and not color-only.

For data/AI decision paths:
- Minimize personal data handling to required fields.
- Avoid unexplained decision logic that cannot be audited.
- Test non-English and special-character inputs where relevant.

## Editing Policy For Agents
- Keep patches minimal and scoped.
- Reuse existing docs and patterns; link to canonical docs rather than re-documenting them.
- Do not rename domain concepts without prior DDD decision-log entry.
- When unsure about naming, stop and align with canonical terms before coding.

## Useful Entrypoints
- [Root README](README.md)
- [Frontend README](apps/frontend/README.md)
- [Backend README](apps/backend/README.md)
- [Frontend app root](apps/frontend/src/App.tsx)
- [Backend server entry](apps/backend/src/server.ts)