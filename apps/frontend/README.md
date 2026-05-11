
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

## UI Architecture & Design System

- Tutti i nuovi componenti e layout sono basati su **MUI (Material UI)** per garantire coerenza visiva e accessibilità.
- Il tema centrale è definito in `apps/frontend/src/theme/theme.ts` e fornito globalmente tramite `ThemeProvider` in `App.tsx`.
- La normalizzazione CSS e la gestione dark/light mode sono gestite tramite `CssBaseline` e la palette del tema MUI.
- Tutti i form sono gestiti tramite **React Hook Form** e validati con **Zod**.

## Runtime Surfaces

- src/: React + XState application
- src/theme/: tema centrale MUI
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

Additional frontend rollout/quality flags (Vite build-time):

| Variable | Default | Purpose |
| --- | --- | --- |
| VITE_UI_ROLLOUT_MODE | mui | Progressive UI rollout mode (`mui` or `legacy`) exposed as `data-ui-rollout-mode` on `<html>` |
| VITE_MONITORING_PROVIDER | none | Frontend monitoring bootstrap provider (`none`, `console`, `sentry`, `logrocket`) |

## Onboarding: Canonical UI Patterns

All new frontend UI code must follow these rules:

1. Use MUI components as default UI primitives (`Button`, `TextField`, `MenuItem`, etc.).
2. Keep Tool Workspace Page behavior state-driven: setup controls are form UI, primary action remains a `GenerationRequest` orchestration action.
3. For CRUD forms, use React Hook Form + Zod validation.
4. For tabular pages, keep row actions aligned with Data Table View governance (no MUI button CTAs inside `<td>`).

Canonical references:

1. `../../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
2. `../../docs/02-design/specifications/frontend-design-system-ui-kit-guide.md`
3. `../../docs/01-requirements/domain-ubiquitous-language-glossary.md`

## Cookbook: Minimal Examples

### 1) MUI unified theme + color scheme toggle

```tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';

export const AppShell = ({ children }: { children: React.ReactNode }) => (
	<ThemeProvider theme={theme} defaultMode="system">
		<CssBaseline />
		{children}
	</ThemeProvider>
);
```

### 2) RHF + Zod form validation

```tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
	email: z.string().email('Email non valida'),
});

type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({
	resolver: zodResolver(schema),
	defaultValues: { email: '' },
});
```

### 3) Data Table row action pattern (canonical)

```tsx
<Link className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)} to={`/artifacts/${artifactId}`}>
	Apri
</Link>
```

## Rollout, Monitoring, Rollback

Progressive rollout:

1. Keep `VITE_UI_ROLLOUT_MODE=mui` as default.
2. For emergency containment, build with `VITE_UI_ROLLOUT_MODE=legacy` and redeploy.
3. Verify `<html data-ui-rollout-mode="...">` in browser runtime.

Monitoring baseline:

1. Set `VITE_MONITORING_PROVIDER=console` in pre-production for rollout smoke checks.
2. Optionally route the provider value to external SDK wiring (`sentry` or `logrocket`) through bootstrap hooks.
3. Frontend runtime sends best-effort telemetry for `window.error` and `unhandledrejection` to `/api/frontend/telemetry`.

Rollback plan:

1. Rebuild with `VITE_UI_ROLLOUT_MODE=legacy`.
2. Redeploy frontend service only.
3. Run CI quality gates (`typecheck`, `test`, `test:forms`, `test:visual`, `audit:a11y`) before promoting again.

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
npm --workspace apps/frontend run test:forms
npm --workspace apps/frontend run test:visual
npm --workspace apps/frontend run audit:a11y
```

## DDD References

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
