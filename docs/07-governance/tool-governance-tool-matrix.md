---
status: active
version: 1.0
date_created: 2026-05-24
last-reviewed: 2026-05-24
next-review-date: 2026-08-24
owner: Documentation Archivist
title: Tool Governance Matrix
tags: [governance, tools, matrix, routing, ddd]
---

# Tool Governance Matrix

> DDD reference: canonical tool identity and bounded-context terminology are defined in [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md), [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md), and [Domain Naming Decision Log](./domain-naming-decision-log.md).

This document consolidates the current tool-by-tool governance view for the implemented Tool surface. It is aligned with the as-is runtime registry, frontend routing, backend orchestration, and tool input-file policy.

## Tool Matrix

| Tool identity | Status UI | Route Frontend | Step chain | File policy | Endpoint touchpoints |
| --- | --- | --- | --- | --- | --- |
| `funnel-pages` \| workflow: `funnel_pages` \| label: `Hotlead Funnel` | `enabled` | `/tools/funnel-pages` | `optin` -> `quiz` -> `vsl` | Single-file policy: `BriefingFile` always-required | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `nextland` \| workflow: `nextland` \| label: `Nextland` | `disabled` | `/tools/nextland` (declared, not exposed while disabled) | `landing` -> `thank_you` | Single-file policy: `BriefingFile` always-required | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `youtube-lf-script` \| workflow: `youtube_lf_script` \| label: `YouTube LF Script` | `enabled` | `/tools/youtube-lf-script` | `pre-script-analysis` -> `packaging` -> `intro-structure` -> `body-structure` -> `native-cta-embeds` -> `outro-structure` | Single-file policy: `BriefingFile` always-required | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `angle-generator` \| workflow: `angle_generator` \| label: `Angle Generator` | `enabled` | `/tools/angle-generator` | `context-and-angle-matrix` -> `angle-prioritization` -> `creative-activation` | Multi-file policy: `BriefingFile` always-required; `AngleDetectorFile` optional-by-tool-setting | `POST /api/tools/briefs` (dual-source envelope for `briefing` + `angleDetector`), `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |

## Governance Notes

- Tool identity is the cross-context canonical `ToolKey`.
- Frontend status is controlled by `toolFormRegistry.status`; only `enabled` tools are exposed in generated routes and navigation.
- Backend orchestration derives step dependencies from the shared contracts registry and resolves tool step artifact IDs through `/api/tools/orchestrate`.
- Tool input-file requiredness follows `ToolInputFileRequirementPolicy`: one file means always-required; for multi-file tools, only the first file is always required and each subsequent file is explicitly classified.
- `angle-generator` is the only implemented dual-source upload path and must continue using one extraction job over merged `BriefingFile` + `AngleDetectorFile` context.

## Source Evidence

- [packages/contracts/src/tool-workflows.ts](../../packages/contracts/src/tool-workflows.ts)
- [apps/frontend/src/features/tools/runtime/tool-form-architecture.ts](../../apps/frontend/src/features/tools/runtime/tool-form-architecture.ts)
- [apps/frontend/src/app/routing/app-router.tsx](../../apps/frontend/src/app/routing/app-router.tsx)
- [apps/frontend/src/features/tools/runtime/tools-client.ts](../../apps/frontend/src/features/tools/runtime/tools-client.ts)
- [apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts](../../apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts)
- [apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts)
- [apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts)
