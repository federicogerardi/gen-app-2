# apps/frontend

Frontend/UI bounded context runtime.

Package: gen-app-2-frontend

## Domain Role

The frontend owns interaction and presentation authority through ToolPage.

- Computes ReadinessSnapshot and ReadinessReasonCode.
- Manages ToolStep progression for each SupportedTool.
- Drives BriefingUpload and local StepHydration projection.
- Consumes BackendStreamEvent from the backend.

The frontend does not own backend domain execution. It orchestrates user flow and sends canonical GenerationRequest payloads.

UI is a projection, not a parliament.

<!-- bomberto-egg-03 cipher:reverse asrebs -->

## Runtime Surfaces

- src/: React + XState application
- server.mjs: same-origin frontend runtime and proxy layer
- vite.config.ts: build pipeline

## Backend Proxy Contract

server.mjs proxies these paths to BACKEND_INTERNAL_URL:

- /auth/*
- /generation/*
- /api/*
- /admin/users/*

The backend remains private from browser direct access.

## Environment Variables

Variables read by server.mjs only:

| Variable | Required | Local default | Production intent |
| --- | --- | --- | --- |
| BACKEND_INTERNAL_URL | Yes in production | http://localhost:3000 | Railway private-network backend URL |
| PORT | No | 3000 | Provided by platform |
| NODE_ENV | No | development | production |

Fail-fast behavior: when NODE_ENV=production, missing BACKEND_INTERNAL_URL stops startup.

Build-time capability flags (Vite):

- VITE_CAP_PROJECTS
- VITE_CAP_ARTIFACTS
- VITE_CAP_TOOLS_UPLOAD
- VITE_CAP_MODELS
- VITE_CAP_ADMIN_MODELS

Important: VITE_* values are build-time inputs, not runtime toggles.

## Local Development

From repository root:

```bash
npm install
npm --workspace apps/frontend run dev
```

Local production-like server:

```bash
npm --workspace apps/frontend run build
BACKEND_INTERNAL_URL=http://localhost:3000 node apps/frontend/server.mjs
```

## Validation

```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test
```

## DDD References

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
