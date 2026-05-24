---
goal: Deterministic Download Capability For Artifact And SessionSummary Detail Views
version: 1.1
date_created: 2026-05-09
last_updated: 2026-05-16
owner: Backend + Frontend Platform
status: archived
last-reviewed: 2026-05-16
next-review-date: 2026-08-16
tags: [feature, backend, frontend, download, sessionsummary, artifacts, archive]
---

# Feature Download Artifact SessionSummary Plan 1

![Status: Archived](https://img.shields.io/badge/status-Archived-blue)

## Archive Note

This plan is completed and archived.

Canonical archive path:
- `docs/99-lifecycle/99-archive/plans/feature-download-artifact-sessionsummary-plan-1.md`

Original working copy path (deprecated):
- `./feature-download-artifact-sessionsummary-1.md`

## Completion Snapshot

Completed scope highlights:

- Backend download capability for Artifact and SessionSummary detail scopes.
- Backend serializers for `md`, `txt`, and `docx` with deterministic output structure.
- Centralized DOCX visual theme configuration via `DOCX_DEFAULT_THEME`.
- `classic` DOCX preset aligned to Artifact Detail markdown preview visual definitions.
- Frontend download UX convergence using reusable format dropdown.
- SessionSummary and Artifact detail download action placement convergence.
- Serializer tests updated and passing after theme-layer separation.

## Traceability

Implementation evidence files:

- `apps/backend/src/lib/runtime/downloads/download-serializers.ts`
- `apps/backend/src/lib/runtime/downloads/docx-theme.ts`
- `apps/backend/src/lib/runtime/downloads/docx-theme-config.ts`
- `apps/backend/src/lib/tests/runtime.download-serializers.test.ts`
- `apps/frontend/src/features/artifacts/ui/DownloadFormatDropdown.tsx`
- `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`
- `apps/frontend/src/features/artifacts/runtime/download-client.ts`
- `.env.example`

## Original Plan Body (Preserved)

# Introduction

![Status: Draft](https://img.shields.io/badge/status-Draft-lightgrey)

This plan implements backend-first download endpoints and frontend integration for detail viewers with deterministic behavior: single Artifact download in `/artifacts/{artifactId}` and aggregated step download in `/sessionsummary/{sessionId}`. Output formats are `md`, `docx`, and `txt`.

## 1. Requirements & Constraints

- **REQ-001**: The Artifact detail route `/artifacts/{artifactId}` must download exactly one `GenerationArtifact` content payload.
- **REQ-002**: The SessionSummary detail route `/sessionsummary/{sessionId}` must download one aggregated file composed from all `SessionArtifactGroup.artifacts` entries.
- **REQ-003**: Supported formats are strictly `md`, `docx`, and `txt`.
- **REQ-004**: Session aggregation order must be deterministic and step-canonical when `toolKey` is recognized; fallback order is `updatedAt` ascending.
- **REQ-005**: Download filenames must be deterministic and include entity scope and identifier.
- **SEC-001**: Download endpoints must enforce authenticated session principal ownership, reusing existing authorization patterns in auth runtime handlers.
- **SEC-002**: Unauthorized access must return deterministic HTTP errors (`401` unauthenticated, `403` forbidden where applicable, `404` resource not found for non-owned/non-existent resources).
- **API-001**: New backend endpoints must be discoverable via frontend API path builder and guarded by explicit capabilities flags.
- **CON-001**: No behavior regression is allowed for existing GET detail endpoints (`/api/artifacts/:id`, `/api/tools/sessions/:id`, `/api/tools/sessions/:id/step/:stepKey`).
- **CON-002**: Existing DDD route namespace separation must remain unchanged: `artifacts` for single artifact, `sessionsummary` for aggregate session.
- **GUD-001**: Reuse existing backend infrastructure patterns (`writeError`, `requireSessionPrincipal`, query adapters, response serialization) in `auth-http.ts`.
- **GUD-002**: Keep format transformation logic centralized in dedicated runtime utility modules, not inline in HTTP handlers.
- **PAT-001**: Backend-first ownership for file generation and `Content-Disposition` response headers.
- **PAT-002**: Frontend viewer composition remains canonical (`ArtifactContentPreview` toolbar extension; no page archetype drift).

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define deterministic backend download contracts and endpoint routing for Artifact and SessionSummary.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `downloads` capability flags to `BackendCapabilities` in `apps/frontend/src/app/runtime/backend-capabilities.ts`: `artifactDownload` and `sessionDownload`, default `false`, env vars `VITE_CAP_ARTIFACT_DOWNLOAD` and `VITE_CAP_SESSION_DOWNLOAD`. Also update `apps/frontend/.env.example` adding `VITE_CAP_ARTIFACT_DOWNLOAD=false` and `VITE_CAP_SESSION_DOWNLOAD=false` with comment, consistent with existing capability block. Also update `defaultBackendCapabilities` and `resolveBackendCapabilities` objects to include the new flags. |  |  |
| TASK-002 | Extend API path builder in `apps/frontend/src/app/runtime/api-paths.ts` with deterministic endpoint constructors: `artifacts.downloadById(id, format)` and `tools.sessions.downloadById(sessionId, format)`. Update both the `ApiPaths` type definition and the `buildApiPaths` implementation. Both functions must return `string | null` conditioned on the corresponding capability flag (`artifactDownload` for artifacts, `sessionsDetail` for sessions). Return `null` when the capability is disabled, consistent with the existing `byId` pattern. |  |  |
| TASK-003 | Add backend route matches in `apps/backend/src/lib/runtime/auth-http.ts` for `GET /api/artifacts/:artifactId/download` and `GET /api/tools/sessions/:sessionId/download`; wire to new handlers in tools/projects handler surfaces. **Ordering constraint**: the new download matchers must be placed BEFORE the existing `toolSessionMatch` block (currently at line ~2135, regex `^\/api\/tools\/sessions\/([^/]+)$`) and BEFORE the `artifactMatch` block (currently at line ~2145, regex `^\/api\/artifacts\/([^/]+)$`) to prevent those more general patterns from capturing the `/download` suffix before the specific matchers execute. |  |  |
| TASK-004 | Add handler interface signatures in `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` and `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` for download methods with typed params `(format, entityId)`. |  |  |
| TASK-005 | Implement query validation in handlers: accept only `format in {md,txt,docx}` from URL search params; reject others with HTTP `400` and error code `bad_request`. |  |  |

### Implementation Phase 2

- GOAL-002: Implement backend file assembly and transport for all three formats with deterministic content and headers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `apps/backend/src/lib/runtime/downloads/download-format.ts` containing canonical type `DownloadFormat = 'md' | 'txt' | 'docx'` and parser `parseDownloadFormat(searchParams)` with strict validation. |  |  |
| TASK-007 | Create `apps/backend/src/lib/runtime/downloads/download-filename.ts` to generate deterministic names: `artifact-{artifactId}.{ext}` and `session-{sessionId}-aggregated.{ext}` with slug-safe normalization. |  |  |
| TASK-008 | Create `apps/backend/src/lib/runtime/downloads/download-serializers.ts` implementing serializer functions: `serializeArtifactDownload`, `serializeSessionDownload`, `toMarkdownDocument`, `toPlainTextDocument`, `toDocxBuffer`. **Pre-requisite**: `mammoth ^1.12.0` already present in `apps/backend/package.json` is a DOCX-to-HTML reader and cannot generate DOCX files. Before implementing `toDocxBuffer`, add the `docx` npm package to `apps/backend/package.json` as an explicit dependency and run `npm --prefix apps/backend install`. Use the `docx` Document/Paragraph/TextRun API for deterministic DOCX generation; do not use `mammoth` for output. |  |  |
| TASK-009 | Implement `handleArtifactDownload` in `apps/backend/src/lib/runtime/auth-http.ts`: fetch artifact via `queries.artifacts.getArtifactByIdForUser`, build file bytes by format, set `Content-Type` and `Content-Disposition: attachment; filename="artifact-{id}.{ext}"`, return `200` binary/body. |  |  |
| TASK-010 | Implement `handleToolsSessionDownload` in `apps/backend/src/lib/runtime/auth-http.ts`: fetch session group via `SessionQueryAdapter.fetchSessionArtifacts`, aggregate step sections in canonical order, serialize by format, return attachment response with deterministic file naming. |  |  |
| TASK-011 | Define markdown/txt aggregation template for session files with explicit section schema: title, session metadata, repeated step blocks (`## Step: {stepKey}` for md; `=== STEP: {stepKey} ===` for txt), preserving raw content verbatim. **Step ordering source**: the canonical step order per `toolKey` is already defined in `apps/frontend/src/features/tools/machines/tool-flow.machine.ts` as the `toolStepOrder` record. Replicate this constant as `apps/backend/src/lib/runtime/downloads/tool-step-order.ts` (do not import from frontend at runtime) to guarantee backend aggregation order is always in sync with the frontend machine definition. Any future addition of a step to `toolStepOrder` must be mirrored in the backend copy. |  |  |

### Implementation Phase 3

- GOAL-003: Integrate frontend viewer download UX and deterministic endpoint invocation for both scopes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Extend copy map in `apps/frontend/src/app/copy/system.ts` with keys: `download`, `downloadAsMarkdown`, `downloadAsTxt`, `downloadAsDocx`, `downloadFailed`. |  |  |
| TASK-013 | Extend `ArtifactContentPreview` in `apps/frontend/src/features/artifacts/ui/ArtifactContentPreview.tsx` with optional `downloadOptions` prop and toolbar dropdown/menu for 3 formats; keep existing Markdown/Raw/Copy behavior unchanged. **Architecture constraint**: `downloadOptions` must expose a synchronous callback `onDownload: (format: DownloadFormat) => void` (fire-and-forget, no Promise). The component must never manage async download state or await any Promise internally; it dispatches the format token to the parent and returns immediately. The `downloading` and `error` states live exclusively in the calling page. |  |  |
| TASK-014 | Add `apps/frontend/src/features/artifacts/runtime/download-client.ts` implementing `downloadArtifactFile(artifactId, format, options)` and `downloadSessionFile(sessionId, format, options)` using API path builder + `fetch` blob + programmatic anchor save. **Return contract**: both functions must return `Promise<{ ok: true } \| { ok: false; errorCode: string; errorMessage: string }>` and must never throw. |  |  |
| TASK-015 | Wire artifact detail page `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` to pass artifact-scoped download options to `ArtifactContentPreview` and invoke artifact endpoint only. |  |  |
| TASK-016 | Wire aggregated download actions in `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` (canonical owner). |  |  |
| TASK-017 | Add visual fallback in UI when capability flag disabled: hide download controls without affecting layout or other toolbar actions. |  |  |

### Implementation Phase 4

- GOAL-004: Validate behavior with deterministic automated tests and acceptance gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Add backend tests in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for artifact download endpoint. |  |  |
| TASK-019 | Extend backend e2e in `apps/backend/src/lib/tests/generation-session.e2e.test.ts` with session download endpoint assertions. |  |  |
| TASK-020 | Add frontend tests in `apps/frontend/src/features/artifacts/ui/ArtifactContentPreview.test.tsx` for download menu rendering and callback invocation by format. |  |  |
| TASK-021 | Add frontend integration tests in artifact/session detail pages for endpoint scope correctness. |  |  |
| TASK-022 | Execute validation commands and record pass/fail output in plan update. |  |  |
| TASK-023 | Extend backend capabilities tests for download flags. |  |  |
| TASK-024 | Extend API paths tests for download routes and capability-off null behavior. |  |  |

## 3. Alternatives

- **ALT-001**: Frontend-only download generation from already loaded content; rejected because DOCX generation and aggregate integrity become client-fragile and less auditable.
- **ALT-002**: Single shared endpoint with polymorphic query (`scope=artifact|session`); rejected due to reduced clarity and weaker route-level ownership semantics.
- **ALT-003**: Add download only for markdown; rejected because requirement mandates `md`, `docx`, and `txt` simultaneously.

## 4. Dependencies

- **DEP-001**: Existing backend runtime routing and auth gate infrastructure in `apps/backend/src/lib/runtime/auth-http.ts`.
- **DEP-002**: Session query aggregation adapter `SessionQueryAdapter` in `apps/backend/src/lib/adapters/session-query.adapter.ts`.
- **DEP-003**: Frontend capability and API path systems in `apps/frontend/src/app/runtime/backend-capabilities.ts` and `apps/frontend/src/app/runtime/api-paths.ts`.
- **DEP-004**: Viewer toolbar shared component `ArtifactContentPreview` in `apps/frontend/src/features/artifacts/ui/ArtifactContentPreview.tsx`.
- **DEP-005**: DOCX serialization library strategy: existing dependency baseline in `apps/backend/package.json` must be verified; if missing writer capability, add deterministic package and lock version.

## 5. Files

- `apps/backend/src/lib/runtime/auth-http.ts`
- `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts`
- `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts`
- `apps/backend/src/lib/runtime/downloads/download-format.ts`
- `apps/backend/src/lib/runtime/downloads/download-filename.ts`
- `apps/backend/src/lib/runtime/downloads/download-serializers.ts`
- `apps/backend/src/lib/tests/runtime.auth-http.test.ts`
- `apps/backend/src/lib/tests/generation-session.e2e.test.ts`
- `apps/frontend/src/app/runtime/backend-capabilities.ts`
- `apps/frontend/src/app/runtime/api-paths.ts`
- `apps/frontend/src/features/artifacts/runtime/download-client.ts`
- `apps/frontend/src/features/artifacts/ui/ArtifactContentPreview.tsx`
- `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`
- `apps/backend/src/lib/runtime/downloads/tool-step-order.ts`
- `apps/frontend/src/app/copy/system.ts`
- `apps/frontend/src/features/artifacts/ui/ArtifactContentPreview.test.tsx`
- `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx`

## 6. Testing

- Backend download endpoint tests (`md`, `txt`, `docx`, invalid format, auth paths).
- Frontend component/page tests for format dispatch and endpoint scope correctness.
- Capability-off rendering checks.
- Download state transition checks.

## 7. Risks & Assumptions

- DOCX writer deterministic behavior and binary test stability.
- Session aggregate payload size and memory footprint.
- Fallback ordering for unknown `toolKey`.
- Route matcher ordering in backend runtime.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
