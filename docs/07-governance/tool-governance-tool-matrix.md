---
status: active
version: 1.4
date_created: 2026-05-24
last-reviewed: 2026-07-18
next-review-date: 2026-10-18
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
| `nextland` \| workflow: `nextland` \| label: `Nextland` | `enabled-for-admin-only` (role-gated; `ToolRouteGuard` redirects non-admin to `/tools`) | `/tools/nextland` | `landing` -> `thank_you` | Single-file policy: `BriefingFile` always-required | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `youtube-lf-script` \| workflow: `youtube_lf_script` \| label: `YouTube LF Script` | `enabled` | `/tools/youtube-lf-script` | `pre-script-analysis` -> `packaging` -> `intro-structure` -> `body-structure` -> `native-cta-embeds` -> `outro-structure` | Single-file policy: `BriefingFile` always-required | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `youtube-description` \| workflow: `youtube_description` \| label: `YT Description Generator` | `enabled-for-all` | `/tools/youtube-description` | `youtube-description-generation` | Direct-input-only policy: no file upload required for start eligibility. Required direct fields are presence-gated; `socialLinks` and `hashtags` are optional-by-tool-setting and non-blocking when omitted. | `POST /generation/stream`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `angle-generator` \| workflow: `angle_generator` \| label: `Angle Generator` | `enabled` | `/tools/angle-generator` | `context-and-angle-matrix` -> `angle-prioritization` -> `creative-activation` | Multi-file policy: `BriefingFile` always-required; `AngleDetectorFile` optional-by-tool-setting | `POST /api/tools/briefs` (dual-source envelope for `briefing` + `angleDetector`), `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `meta-ads` \| workflow: `meta_ads_generator` \| label: `MetaAds Generator` | `enabled` | `/tools/meta-ads` | `context-generation` -> `ads-generation` | Multi-file policy: `BriefingFile` always-required; `AngleDetectorFile` optional-by-tool-setting; API acquisition: `campaignObjective` direct-input | `POST /api/tools/briefs` (dual-source envelope for `briefing` + `angleDetector`), `GET /api/tools/api-services` (api-acquisition resolve), `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `blog-article-generator` \| workflow: `blog_article_generator` \| label: `Blog Article Generator` | `enabled-for-all` | `/tools/blog-article-generator` | `blog_seo_structure` -> `blog_research` -> `blog_article` | Direct-input-only policy: `titolo` (title) required; no file upload; LLM model selector hidden (hardcoded overrides per step) | `POST /generation/stream`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `brief-generator` \| workflow: `brief_generator` \| label: `Brief Generator` (DDD-210) | `enabled-for-all` | `/tools/brief-generator` | `brief-generation` | Single-file policy: `BriefingFile` (.txt, .md, .docx) always-required. Primitive tool: upload file → extraction (5 fields) → generation → `brief` asset promotion. | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |
| `tov-generator` \| workflow: `tov_generator` \| label: `TOV Generator` (DDD-212) | `enabled-for-all` | `/tools/tov-generator` | `tov-generation` | Single-file policy: `BriefingFile` (.txt, .md, .docx) always-required. Primitive tool: upload file → extraction (5 fields) → generation → `brand-voice` asset promotion. First producer of `brand-voice` assets (DDD-211). | `POST /api/tools/briefs`, `POST /api/tools/hydrate`, `POST /api/tools/orchestrate`, `GET /api/tools/sessions`, `GET /api/tools/sessions/{sessionId}`, `GET /api/tools/sessions/{sessionId}/step/{stepKey}`, `GET /api/tools/sessions/{sessionId}/download?format=` |

## Governance Notes

- Tool identity is the cross-context canonical `ToolKey`.
- Frontend availability is controlled by `TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY` (from `@gen-app-2/contracts`) and the `canRoleAccessToolKey` helper; `enabled-for-all` tools are accessible to all roles, `enabled-for-admin-only` tools are restricted via `ToolRouteGuard` (redirects non-admin to `/tools`), and `disabled-for-all` tools are not exposed in routes or navigation.
- Backend orchestration derives step dependencies from the shared contracts registry and resolves tool step artifact IDs through `/api/tools/orchestrate`.
- Tool input-file requiredness follows `ToolInputFileRequirementPolicy`: one file means always-required; for multi-file tools, only the first file is always required and each subsequent file is explicitly classified.
- `youtube-description` currently uses a direct-input-only baseline guard: required direct-field presence + markdown-only output contract; strict semantic validations are deferred for initial tool testing.
- `angle-generator` is the only implemented dual-source upload path and must continue using one extraction job over merged `BriefingFile` + `AngleDetectorFile` context.
- `blog-article-generator` uses direct-input-only with `titolo` (title) as required field. LLM model selection is hidden from users — models are hardcoded per step via `StepLlmModelOverrideConfig` (DDD-157): `gpt-4o-mini-search-preview` (SEO structure), `gpt-4o-search-preview` (research), `gpt-5.2` (article). Session summary shows all 3 steps in preview; download includes only final step (`blog_article`).
- `tov-generator` is the first producer of `brand-voice` assets (DDD-211). It follows the same primitive pattern as `brief-generator`: upload file → extraction (5 fields: `brand_or_company`, `target_audience`, `tone`, `product_or_service`, `market`) → generation → `brand-voice` asset promotion. Output is a structured Markdown TOV document in Italian (`it-IT`) with 6 canonical sections. Consumed by 7 downstream tools: `funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `meta-ads`, `youtube-description`, `blog-article-generator`.

## Source Evidence

- [packages/contracts/src/tool-workflows.ts](../../packages/contracts/src/tool-workflows.ts)
- [apps/frontend/src/features/tools/runtime/tool-form-architecture.ts](../../apps/frontend/src/features/tools/runtime/tool-form-architecture.ts)
- [apps/frontend/src/app/routing/app-router.tsx](../../apps/frontend/src/app/routing/app-router.tsx)
- [apps/frontend/src/features/tools/runtime/tools-client.ts](../../apps/frontend/src/features/tools/runtime/tools-client.ts)
- [apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts](../../apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts)
- [apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts)
- [apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts](../../apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts)
