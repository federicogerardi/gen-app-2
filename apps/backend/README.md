# apps/backend

Backend runtime for Generation, Auth, and Usage/Quota contexts.

Package: `@gen-app-2/backend`

## Runtime Role

The backend is execution authority for:

- `GenerationRequest` lifecycle orchestration (`GenerationSystem`)
- auth and role gates through `AuthSessionPrincipal`
- quota claim through `ClaimUsage`
- SSE emission of `BackendStreamEvent`
- `Artifact` and quota audit persistence

## Main Runtime Entry

- `src/server.ts`

## Core Machines

- `src/lib/machines/generation-system.machine.ts`
- `src/lib/machines/request-gateway.machine.ts`
- `src/lib/machines/idempotency-coordinator.machine.ts`
- `src/lib/machines/usage.machine.ts`
- `src/lib/machines/tool-workflow.machine.ts`
- `src/lib/machines/extraction-chain.machine.ts`
- `src/lib/machines/stream-transport.machine.ts`
- `src/lib/machines/persistence-batch.machine.ts`
- `src/lib/machines/generation/acquisition-chain.machine.ts`

## Common Commands

From repository root:

```bash
npm install --workspaces --include-workspace-root
npm --workspace apps/backend run db:migrate:minimal
npm --workspace apps/backend run start:server
```

Validation:

```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
npm --workspace apps/backend run go
```

Smoke flow requiring env load:

```bash
set -a && . ./.env.local && set +a && npm run test:smoke
```

## Contract Boundary

Contract authority is in `packages/contracts` and includes `GenerationRequest`, `BackendStreamEvent`, `ArtifactType`, and `OutputFormat`.

`packages/contracts/src/parity.guard.ts` enforces FE/BE contract parity at compile time.

## DDD References

1. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`
2. `../../docs/02-design/domain-bounded-context-map.md`
3. `../../docs/07-governance/domain-naming-decision-log.md`
