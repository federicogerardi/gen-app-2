# Gen App 2

Gen App 2 is a DDD-first monorepo for deterministic tool-driven artifact generation.

The product flow is centered on canonical terms:

- `Tool` as user-facing capability
- `GenerationRequest` as backend command
- `Artifact` as persisted output
- `GenerationSession` and `SessionSummary` as aggregate navigation model

## Bounded Contexts

| Context | Responsibility |
| --- | --- |
| Generation | Orchestration, streaming, persistence, extraction, idempotency |
| Auth | Identity, roles, sessions, OAuth |
| Usage/Quota | Quota claim and usage audit |
| Frontend/UI | Tool Workspace flow, readiness, hydration, interaction |

## Current Tool Surface (as-is)

- `funnel-pages`
- `nextland`
- `youtube-lf-script`
- `angle-generator`
- `meta-ads`
- `youtube-description`

Tool visibility is governed by `ToolAvailabilityStatus` policy from shared contracts.

## Repository Structure

- `apps/backend`: backend runtime (`GenerationSystem` + auth/quota/http layers)
- `apps/frontend`: React + XState frontend runtime and same-origin proxy server
- `packages/contracts`: FE/BE shared contract authority
- `packages/domain`: cross-context domain primitives (DDD-074)
- `packages/infra-db`: SQL migrations, seeds, and DB scripts
- `docs`: canonical domain, architecture, and governance documentation

## Quick Start

From repository root:

```bash
npm install --workspaces --include-workspace-root
npm run dev
```

`npm run dev` loads `.env.local`, starts backend server, and starts frontend Vite dev server.

## Validation Commands

From repository root:

```bash
npm run typecheck
npm run test
npm run build
```

Frontend focused:

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
npm --workspace apps/frontend run build
```

Backend focused:

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
npm --workspace apps/backend run go
```

## Canonical Docs (read first)

1. `docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `docs/02-design/domain-bounded-context-map.md`
3. `docs/07-governance/domain-naming-decision-log.md`
4. `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`

Index entrypoint:

- `docs/index-overview.md`
