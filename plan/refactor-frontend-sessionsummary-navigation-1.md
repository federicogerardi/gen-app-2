---
goal: Frontend Refactor Plan For SessionSummary Artifacts And Projects Navigation Separation
version: 1.1
date_created: 2026-05-07
last_updated: 2026-05-08
verified_date: 2026-05-08
owner: Frontend Platform Team
status: 'Completed'
tags: [refactor, frontend, ddd, routing, navigation, contracts]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic frontend refactor to enforce DDD namespace separation between Artifact history and SessionSummary aggregate navigation. The implementation preserves backward compatibility during transition while making SessionSummary the canonical navigation source for project contextual history.

## 1. Requirements & Constraints

- **REQ-001**: Route namespace separation must be explicit: SessionSummary aggregate routes use `/sessionsummary` and `/sessionsummary/:sessionId`; Artifact routes remain `/artifacts` and `/artifacts/:artifactId`.
- **REQ-002**: Project contextual navigation must consume SessionSummary data and must not use Artifact listing as a proxy for aggregate session navigation.
- **REQ-003**: Session listing client contract must target `GET /api/tools/sessions` as canonical source when backend capability is available.
- **REQ-004**: Transitional fallback from SessionSummary query to Artifact-derived mapping is permitted only behind explicit capability and must be isolated in runtime client.
- **REQ-005**: Existing deep links to legacy `/artifacts/:id` overload must be supported for one compatibility cycle via deterministic redirect strategy.
- **REQ-006**: Legacy session-id detection rule is fixed to `^sess_[A-Za-z0-9_-]+$`; when matched under `/artifacts/:id`, frontend must redirect to `/sessionsummary/:sessionId`.
- **REQ-007**: Validation commands must run with explicit workspace targeting: `npm --workspace apps/frontend run typecheck` and `npm --workspace apps/frontend run test`.
- **SEC-001**: All runtime requests must continue to use authenticated fetch paths already enforced by frontend runtime API client.
- **DDD-001**: Canonical terms must be reused exactly: `Artifact`, `SessionSummary`, `GenerationRequest`, `SupportedTool`, `ToolStep`, `ReadinessSnapshot`.
- **CON-001**: No backend schema change is allowed in this plan; all changes are frontend-only.
- **CON-002**: Existing page-level loading and error boundaries must remain functionally equivalent.
- **GUD-001**: Preserve backward-compatible UI labels where required, but primary navigation labels must reflect SessionSummary aggregate semantics.
- **PAT-001**: Implement namespace split by introducing dedicated routes and adapters rather than polymorphic route IDs.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Implement canonical frontend route namespace split and page-level navigation behavior for SessionSummary vs Artifact detail.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update route declarations in `apps/frontend/src/app/routing/app-router.tsx` to add `/sessionsummary` and `/sessionsummary/:sessionId` while preserving `/artifacts` and `/artifacts/:artifactId`; remove session-overloaded resolution from artifact detail route guard. | ✅ | 2026-05-08 |
| TASK-002 | Create `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.tsx` exporting `SessionSummaryListPage` and `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` exporting `SessionSummaryDetailPage`; extract session aggregate rendering previously hosted in `ArtifactsPage.tsx` into these two components. | ✅ | 2026-05-08 |
| TASK-003 | Update `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx` to link session entries to `/sessionsummary/${sessionId}` and artifact entries to `/artifacts/${artifactId}` only. | ✅ | 2026-05-08 |
| TASK-004 | Refactor `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` to resolve `artifactId` only; add helper `isLegacySessionRouteId(id: string): boolean` with regex `^sess_[A-Za-z0-9_-]+$`; when helper returns true, redirect to `/sessionsummary/${id}` before artifact fetch. | ✅ | 2026-05-08 |
| TASK-005 | Update route tests in `apps/frontend/src/app/routing/app-router.test.tsx` to assert namespace split, legacy redirect behavior, and non-regression for artifact detail rendering. | ✅ | 2026-05-08 |

Completion Criteria (Phase 1):
- `app-router.tsx` contains 4 canonical route entries: `/artifacts`, `/artifacts/:artifactId`, `/sessionsummary`, `/sessionsummary/:sessionId`.
- `ArtifactDetailPage.tsx` no longer performs session-first detail resolution.
- Session aggregate list/detail rendering is served only by `SessionSummaryListPage` and `SessionSummaryDetailPage`.
- Route tests include one passing assertion for legacy `/artifacts/sess_demo` redirect to `/sessionsummary/sess_demo`.

### Implementation Phase 2

- GOAL-002: Align runtime contracts, capabilities, and query hooks with SessionSummary canonical endpoint and fallback policy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Extend `apps/frontend/src/app/runtime/api-paths.ts` with explicit path builder for `/api/tools/sessions` and `/api/tools/sessions/:sessionId` using existing naming conventions. | ✅ | 2026-05-08 |
| TASK-007 | Update `apps/frontend/src/app/runtime/backend-capabilities.ts` to introduce dedicated SessionSummary capability flags (`sessionsList`, `sessionsDetail`) independent from Artifact capabilities. | ✅ | 2026-05-08 |
| TASK-008 | Refactor `apps/frontend/src/features/tools/runtime/session-client.ts` so `listSessions` calls `apiPaths.tools.sessions.list` first, and fallback mapping from Artifact list runs only when `backendCapabilities.sessionsList !== true`; keep fallback in dedicated function `mapArtifactsToSessionSummaryFallback`. | ✅ | 2026-05-08 |
| TASK-009 | Update `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` to use query key prefix `sessionsummary` for aggregates and remove reuse of artifact-history keys in session aggregate queries. | ✅ | 2026-05-08 |
| TASK-010 | Update `apps/frontend/src/features/tools/runtime/useToolPage.ts` policy handling for `open-last-artifact` so destination is semantically correct (`/artifacts/:artifactId` when available; `/artifacts` only as explicit fallback). | ✅ | 2026-05-08 |

Completion Criteria (Phase 2):
- `api-paths.ts` exports sessions list and detail path builders under tools namespace.
- `backend-capabilities.ts` contains explicit `sessionsList` and `sessionsDetail` booleans.
- `session-client.ts` fallback branch is guarded by a single explicit capability condition and isolated in `mapArtifactsToSessionSummaryFallback`.
- `useSessionsQuery.ts` uses session-specific query-key prefix with no artifact-key reuse.

### Implementation Phase 3

- GOAL-003: Align copy, global navigation, and automated tests with DDD terminology and new route semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Update navigation copy keys in `apps/frontend/src/app/copy/system.ts` to make SessionSummary aggregate labels primary and mark Artifact-context aliases as backward-compat where needed. | ✅ | 2026-05-08 |
| TASK-012 | Update `apps/frontend/src/app/layouts/MainNavigation.tsx` to expose canonical SessionSummary archive entry and keep Artifact archive entry as separate non-aggregated history destination. | ✅ | 2026-05-08 |
| TASK-013 | Update project pages `apps/frontend/src/features/projects/pages/ProjectsListPage.tsx` and `apps/frontend/src/features/projects/pages/ProjectDetailPage.tsx` to ensure contextual history actions navigate via SessionSummary routes. | ✅ | 2026-05-08 |
| TASK-014 | Update tests in `apps/frontend/src/features/projects/pages/ProjectDetailPage.test.tsx`, `apps/frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx`, and `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx` to assert new labels, route targets, and fallback semantics. | ✅ | 2026-05-08 |
| TASK-015 | Execute verification commands exactly as `npm --workspace apps/frontend run typecheck` and `npm --workspace apps/frontend run test`; copy pass/fail output and command timestamps into PR checklist. | ✅ | 2026-05-08 |

Completion Criteria (Phase 3):
- Main navigation shows distinct entries for SessionSummary archive and Artifact archive.
- Project contextual history actions route only to `/sessionsummary` namespace.
- All listed tests pass in frontend workspace execution.
- Verification checklist in PR contains both command outputs and execution timestamps.

## 3. Alternatives

- **ALT-001**: Keep a single overloaded `/artifacts/:id` route for both Artifact and SessionSummary entities. Rejected because it preserves semantic ambiguity and conflicts with DDD namespace separation.
- **ALT-002**: Block rollout until backend fully ships SessionSummary endpoints with no fallback. Rejected because it delays frontend alignment and increases drift from approved DDD decisions.
- **ALT-003**: Rename Artifact archive route to `/history` immediately. Rejected because it introduces unnecessary migration scope and breaks established artifact deep links.

## 4. Dependencies

- **DEP-001**: DDD canonical glossary in `docs/01-requirements/domain-ubiquitous-language-glossary.md` for term validation.
- **DEP-002**: Bounded context routing guidance in `docs/02-design/domain-bounded-context-map.md`.
- **DEP-003**: Governance decisions for route and contract split in `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-004**: Frontend behavior specification in `docs/02-design/specifications/frontend-spec.md`.

## 5. Files

- **FILE-001**: `apps/frontend/src/app/routing/app-router.tsx` - introduce canonical SessionSummary routes and compatibility redirects.
- **FILE-002**: `apps/frontend/src/app/routing/app-router.test.tsx` - route namespace and redirect behavior tests.
- **FILE-003**: `apps/frontend/src/features/artifacts/pages/ArtifactsPage.tsx` - remove session-aggregate responsibility from Artifact archive page.
- **FILE-004**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` - strict artifact detail resolution and legacy handling.
- **FILE-005**: `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx` - correct session vs artifact navigation targets.
- **FILE-006**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.tsx` - canonical SessionSummary aggregate list page.
- **FILE-007**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` - canonical SessionSummary aggregate detail page.
- **FILE-008**: `apps/frontend/src/app/runtime/api-paths.ts` - canonical sessions API paths.
- **FILE-009**: `apps/frontend/src/app/runtime/backend-capabilities.ts` - dedicated sessions capabilities.
- **FILE-010**: `apps/frontend/src/features/tools/runtime/session-client.ts` - canonical sessions endpoint with transitional fallback.
- **FILE-011**: `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` - query key and endpoint alignment.
- **FILE-012**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` - CTA policy destination semantics.
- **FILE-013**: `apps/frontend/src/app/copy/system.ts` - navigation/copy terminology alignment.
- **FILE-014**: `apps/frontend/src/app/layouts/MainNavigation.tsx` - global navigation entries.
- **FILE-015**: `apps/frontend/src/features/projects/pages/ProjectsListPage.tsx` - project-level session aggregate navigation source.
- **FILE-016**: `apps/frontend/src/features/projects/pages/ProjectDetailPage.tsx` - contextual history navigation route targets.
- **FILE-017**: `apps/frontend/src/features/projects/pages/ProjectDetailPage.test.tsx` - updated assertions for SessionSummary terminology and routes.
- **FILE-018**: `apps/frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx` - artifact archive scope assertions.
- **FILE-019**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx` - artifact-only detail assertions.

## 6. Testing

- **TEST-001**: Route contract test validates that `/sessionsummary` and `/sessionsummary/:sessionId` render aggregate views and `/artifacts/:artifactId` renders artifact-only detail.
- **TEST-002**: Compatibility test validates legacy `/artifacts/:id` session-like overload redirects deterministically to `/sessionsummary/:sessionId`.
- **TEST-003**: Runtime client unit test validates `listSessions` primary call to `/api/tools/sessions` and fallback branch only when sessions capability is unavailable.
- **TEST-004**: Tool CTA test validates `open-last-artifact` destination resolution prefers `/artifacts/:artifactId`.
- **TEST-005**: Project detail UI test validates contextual history CTA uses SessionSummary routes and labels.
- **TEST-006**: Full frontend type-check and selected test suite execution must pass with zero new warnings in changed files.

## 7. Risks & Assumptions

- **RISK-001**: Legacy deep links may encode session IDs that are not distinguishable from artifact IDs without heuristic parsing.
- **RISK-002**: Backend capability flags may be incomplete in some environments, causing unintended fallback path activation.
- **RISK-003**: Copy key renaming can break i18n lookups if aliases are not preserved for one release cycle.
- **ASSUMPTION-001**: Backend endpoint `GET /api/tools/sessions` is available or can be feature-flagged with explicit fallback behavior.
- **ASSUMPTION-002**: Existing project pages already consume session-like data structures compatible with SessionSummary display requirements.
- **ASSUMPTION-003**: Frontend routing test harness supports redirect assertions for both canonical and legacy paths.

## 8. Related Specifications / Further Reading

- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md
- docs/02-design/specifications/frontend-spec.md
- docs/02-design/tool-generation-flow.md
- plan/feature-pagetool-artifact-aggregation-1.md