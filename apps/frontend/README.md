# apps/frontend

Frontend/UI bounded-context runtime.

Package: `gen-app-2-frontend`

## Runtime Role

The frontend owns interaction and projection for `ToolPage`:

- computes `ReadinessSnapshot`
- orchestrates `ToolStep` progression in UI
- handles upload/extraction lifecycle (`BriefingUpload`)
- consumes `BackendStreamEvent`
- dispatches canonical `GenerationRequest` payloads

Backend orchestration authority remains on backend endpoints and machines.

## Stack

- React 19 + Vite
- XState v5 (`@xstate/react`)
- MUI for UI primitives
- React Hook Form + Zod for form state and validation

## Runtime Surfaces

- `src/`: frontend app code
- `server.mjs`: same-origin proxy server for production-like runtime
- `vite.config.ts`: build tooling

## Local Development

From repository root:

```bash
npm install --workspaces --include-workspace-root
npm --workspace apps/frontend run dev
```

Production-like local runtime:

```bash
npm --workspace apps/frontend run build
BACKEND_INTERNAL_URL=http://localhost:3000 node apps/frontend/server.mjs
```

## Frontend Server Environment

`server.mjs` reads:

- `BACKEND_INTERNAL_URL` (required in production, default `http://localhost:3000`)
- `PORT` (default `3000`)
- `NODE_ENV`

Fail-closed startup is enforced when `NODE_ENV=production` and `BACKEND_INTERNAL_URL` is missing.

## Build-Time Environment (Vite)

Main capability and runtime flags include:

- `VITE_API_BASE_URL`
- `VITE_CAP_*` feature-capability flags
- `VITE_MONITORING_PROVIDER`
- `VITE_MONITORING_ENDPOINT`
- `VITE_FF_TOOLS_API_BINDING_STATUS`
- `VITE_ARTIFACT_DELETE_ENABLED`
- `VITE_DEBUG_HTTP_CLIENT`

All `VITE_*` values are build-time inputs.

## Validation

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
npm --workspace apps/frontend run test:forms
npm --workspace apps/frontend run test:admin-a11y
npm --workspace apps/frontend run audit:a11y
```

## Canonical Docs

1. `../../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
2. `../../docs/02-design/specifications/frontend-spec.md`
3. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`
4. `../../docs/07-governance/domain-naming-decision-log.md`
