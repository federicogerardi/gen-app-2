---
goal: Implement Admin Changelog And User Reporting Feature End-To-End
version: 1.0
date_created: 2026-05-16
last_updated: 2026-05-16
owner: Frontend Platform Team + Backend Platform Team
status: Planned
tags: [feature, frontend, backend, admin, changelog, reporting, ddd]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan implements the Admin Changelog and User Reporting feature from terminology-governed specification to runtime delivery, including canonical domain naming, persistence, API contracts, frontend orchestration with XState, and deterministic validation.

## 1. Requirements & Constraints

- **REQ-001**: Implement `ProductChangelog` creation, publication, and listing with lifecycle values restricted to `ProductChangelogStatus = draft | published`.
- **REQ-002**: Implement `UserReport` submission with canonical category values restricted to `UserReportCategory = issue | feature-request | other`.
- **REQ-003**: Implement admin triage workflow for `UserReportStatus` transitions: `submitted -> triaged -> closed`, plus `github-published` on successful issue escalation.
- **REQ-004**: Implement optional GitHub publication only when `UserReportCategory = issue`, enforced by deterministic policy and server-side validation.
- **REQ-005**: Ensure local `UserReport` persistence remains authoritative even when external GitHub publication fails.
- **REQ-006**: Implement role-gated access so only `AuthUserRole = admin` can publish changelog, triage reports, and trigger issue publication.
- **REQ-007**: Implement frontend UI using canonical archetypes only: `Data Table View` for admin listings and `Tool Workspace Page` for report submission.
- **SEC-001**: Require authenticated session principal for all endpoints in scope and enforce role authorization in backend handlers.
- **SEC-002**: Return deterministic HTTP errors for unauthorized/forbidden/invalid actions (`401`, `403`, `400`, `404`) via existing runtime error contract.
- **SEC-003**: Do not expose internal transport/provider errors to end users; map to canonical user-readable copy via `FeedbackChannel`.
- **API-001**: Implement canonical endpoints from spec: `POST /api/user-reports`, `GET /api/admin/user-reports`, `PATCH /api/admin/user-reports/{reportId}`, `POST /api/admin/user-reports/{reportId}/publish-issue`, `POST /api/admin/changelog`, `GET /api/changelog`.
- **DAT-001**: Enforce DB check constraints for `ProductChangelogStatus`, `UserReportCategory`, and `UserReportStatus`.
- **CON-001**: Preserve DDD canonical terminology defined in glossary and naming decision log; no parallel synonyms in code, APIs, or docs.
- **CON-002**: Keep frontend and backend behavior deterministic and directly traceable to `FeedbackCenterMachine` transition contract.
- **GUD-001**: Reuse existing backend runtime patterns in `apps/backend/src/lib/runtime/auth-http.ts` and related handler modules.
- **GUD-002**: Keep policy checks in dedicated runtime functions; avoid inline duplicated guard logic across handlers.
- **GUD-003**: Keep frontend async side effects outside `assign` and maintain XState v5 `reenter: true` on recovery transitions.
- **PAT-001**: Backend-first persistence and policy ownership; frontend consumes explicit contracts.
- **PAT-002**: Domain-first naming propagation order: decision log -> glossary -> BCM -> implementation.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Finalize canonical domain model and persistence contract before runtime implementation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add SQL migration `packages/infra-db/migrations/20260516_0000xx_admin_changelog_user_reporting.sql` creating tables `product_changelogs`, `user_reports`, and `user_report_github_links` with PK/FK relationships and timestamps exactly as defined in [docs/02-design/specifications/admin-changelog-and-user-reporting-spec.md](docs/02-design/specifications/admin-changelog-and-user-reporting-spec.md). |  |  |
| TASK-002 | In the same migration, add deterministic check constraints: `product_changelogs.status in ('draft','published')`, `user_reports.category in ('issue','feature-request','other')`, `user_reports.status in ('submitted','triaged','github-published','closed')`, and unique key on `user_report_github_links(repository, issue_number)`. |  |  |
| TASK-003 | Add indexes in migration: `user_reports(status, created_at desc)`, `user_reports(category, status, created_at desc)`, `product_changelogs(status, published_at desc)`, `product_changelogs(created_at desc)`. |  |  |
| TASK-004 | Update backend data access layer by adding typed query methods in `apps/backend/src/lib/adapters` modules for create/list/update operations of changelog and reports, including transactional publish-issue method that inserts `GitHubIssueLink` and updates `UserReport.status` atomically. |  |  |
| TASK-005 | Add/extend shared contracts in `packages/contracts/src/index.ts` for DTOs: `ProductChangelogDto`, `CreateProductChangelogCommand`, `UserReportDto`, `CreateUserReportCommand`, `UpdateUserReportStatusCommand`, `PublishUserReportIssueCommand`, and compile-time parity guard updates in `packages/contracts/src/parity.guard.ts`. |  |  |

### Implementation Phase 2

- GOAL-002: Implement backend HTTP surface and policy enforcement for changelog/reporting workflows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | In `apps/backend/src/lib/runtime/auth-http.ts`, add route matchers and handlers for all six endpoints in REQ-API, preserving matcher order to prevent broader patterns from capturing admin subpaths. |  |  |
| TASK-007 | Extend `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` with typed handlers: `handleAdminCreateChangelog`, `handleAdminListUserReports`, `handleAdminUpdateUserReport`, `handleAdminPublishUserReportIssue`, reusing `requireSessionPrincipal` and admin-role enforcement. |  |  |
| TASK-008 | Add user-scope handlers in `apps/backend/src/lib/runtime/auth-http` surface for `handleCreateUserReport` and `handleListPublishedChangelog`; enforce member/admin access and output normalization. |  |  |
| TASK-009 | Implement deterministic category normalization function `normalizeUserReportCategory(input: string): 'issue' | 'feature-request' | 'other' | null` in `apps/backend/src/lib/runtime` and call it only at request boundary before persistence. |  |  |
| TASK-010 | Implement issue publication policy function `canPublishIssue(principalRole, reportCategory): boolean` and use it in both backend command guard and response error mapping for rejected requests. |  |  |
| TASK-011 | Implement GitHub integration adapter in `apps/backend/src/lib/runtime/integrations` with method `publishIssueForUserReport(report): Promise<{ repository: string; issueNumber: number; issueUrl: string }>` and transactional rollback behavior on failure. |  |  |

### Implementation Phase 3

- GOAL-003: Implement frontend pages, state orchestration, and deterministic feedback behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Create machine file `apps/frontend/src/features/feedback-center/machines/feedback-center.machine.ts` implementing `feedbackCenterMachine` states/events/guards exactly as section 6 in spec, including explicit `ACK_SUCCESS` and `RESET_TO_IDLE` transitions with `reenter: true`. |  |  |
| TASK-013 | Create API client module `apps/frontend/src/features/feedback-center/runtime/feedback-center-client.ts` with functions `submitUserReport`, `listAdminUserReports`, `updateUserReportStatus`, `publishUserReportIssue`, `createProductChangelog`, `listPublishedProductChangelog`, each returning discriminated success/failure results. |  |  |
| TASK-014 | Create admin changelog listing page `apps/frontend/src/features/admin/pages/AdminChangelogPage.tsx` as canonical `Data Table View` with deterministic `loading`, `empty`, `error` states and publish actions gated by admin role. |  |  |
| TASK-015 | Create admin report inbox page `apps/frontend/src/features/admin/pages/AdminUserReportsPage.tsx` as canonical `Data Table View` with row actions for triage/close and conditional issue publication only for category `issue`. |  |  |
| TASK-016 | Create user submission page `apps/frontend/src/features/feedback-center/pages/UserReportSubmissionPage.tsx` as canonical `Tool Workspace Page` composition with Setup Panel + Workflow Panel and `FeedbackChannel`-mapped messages. |  |  |
| TASK-017 | Update frontend routing in `apps/frontend/src/app/routing/app-router.tsx` and navigation/copy in `apps/frontend/src/app/copy/system.ts` to expose routes and labels for changelog and reporting feature. |  |  |
| TASK-018 | Integrate backend capability flags and path builders in `apps/frontend/src/app/runtime/backend-capabilities.ts` and `apps/frontend/src/app/runtime/api-paths.ts` for feature endpoints with deterministic capability-off behavior. |  |  |

### Implementation Phase 4

- GOAL-004: Validate the feature with deterministic automated tests and governance checks.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Add backend tests in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for endpoint authorization, validation, successful writes, category normalization, and issue publication policy rejection paths. |  |  |
| TASK-020 | Add backend transactional tests in `apps/backend/src/lib/tests` verifying publish-issue atomicity: success writes link + status update, failure rolls back both mutations. |  |  |
| TASK-021 | Add frontend machine tests in `apps/frontend/src/features/feedback-center/machines/feedback-center.machine.test.ts` covering all states in section 6.9 transition table and explicit `ACK_SUCCESS`/`RESET_TO_IDLE` behavior. |  |  |
| TASK-022 | Add frontend page tests for `AdminChangelogPage`, `AdminUserReportsPage`, and `UserReportSubmissionPage` verifying channel-mapped copy rendering and action gating by role/category. |  |  |
| TASK-023 | Run deterministic validation commands: `npm --prefix apps/backend test`, `npm --prefix apps/frontend test`, `npm --prefix apps/frontend typecheck`, `npm --prefix apps/backend typecheck`; record pass/fail in plan update. |  |  |
| TASK-024 | Run DDD governance check by verifying canonical terms appear consistently in updated docs and code: `ProductChangelog`, `ProductChangelogStatus`, `UserReport`, `UserReportCategory`, `UserReportStatus`, `GitHubIssueLink`, `IssuePublicationPolicy`. |  |  |

## 3. Alternatives

- **ALT-001**: Implement changelog and reporting as a single generic feedback entity; rejected because it violates explicit domain distinctions between publication artifacts and report lifecycle.
- **ALT-002**: Execute GitHub publication synchronously before local persistence; rejected because it violates local-source-of-truth and recoverability requirements.
- **ALT-003**: Implement frontend without XState and use local component state only; rejected because deterministic transition governance and QA traceability would degrade.

## 4. Dependencies

- **DEP-001**: Backend runtime routing and auth enforcement in `apps/backend/src/lib/runtime/auth-http.ts` and `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`.
- **DEP-002**: Database migration pipeline in `packages/infra-db/migrations` and migration execution workflow in workspace scripts.
- **DEP-003**: Shared contract package `packages/contracts/src/index.ts` and parity guard `packages/contracts/src/parity.guard.ts`.
- **DEP-004**: Frontend route, capabilities, and API path infrastructure in `apps/frontend/src/app/routing/app-router.tsx`, `apps/frontend/src/app/runtime/backend-capabilities.ts`, and `apps/frontend/src/app/runtime/api-paths.ts`.
- **DEP-005**: Canonical UI governance definitions in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`.
- **DEP-006**: Canonical DDD naming artifacts in `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, and `docs/07-governance/domain-naming-decision-log.md`.

## 5. Files

- **FILE-001**: `packages/infra-db/migrations/20260516_0000xx_admin_changelog_user_reporting.sql` - schema, constraints, indexes for changelog/reporting entities.
- **FILE-002**: `apps/backend/src/lib/runtime/auth-http.ts` - endpoint routing and request dispatch.
- **FILE-003**: `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` - admin handler contracts and implementations.
- **FILE-004**: `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` - add typed interfaces if shared handler surface is required.
- **FILE-005**: `apps/backend/src/lib/runtime/integrations/github-issues.ts` - GitHub issue publication adapter.
- **FILE-006**: `apps/backend/src/lib/adapters/*` - persistence/query methods for changelog and user reports.
- **FILE-007**: `packages/contracts/src/index.ts` - DTO/command contract additions.
- **FILE-008**: `packages/contracts/src/parity.guard.ts` - contract parity assertions.
- **FILE-009**: `apps/frontend/src/features/feedback-center/machines/feedback-center.machine.ts` - XState orchestration machine.
- **FILE-010**: `apps/frontend/src/features/feedback-center/runtime/feedback-center-client.ts` - frontend API client.
- **FILE-011**: `apps/frontend/src/features/admin/pages/AdminChangelogPage.tsx` - admin changelog Data Table View.
- **FILE-012**: `apps/frontend/src/features/admin/pages/AdminUserReportsPage.tsx` - admin reports inbox Data Table View.
- **FILE-013**: `apps/frontend/src/features/feedback-center/pages/UserReportSubmissionPage.tsx` - user submission Tool Workspace Page.
- **FILE-014**: `apps/frontend/src/app/routing/app-router.tsx` - route registration.
- **FILE-015**: `apps/frontend/src/app/runtime/api-paths.ts` - endpoint constructors.
- **FILE-016**: `apps/frontend/src/app/runtime/backend-capabilities.ts` - capability gating flags.
- **FILE-017**: `apps/frontend/src/app/copy/system.ts` - canonical UI copy keys.
- **FILE-018**: `apps/backend/src/lib/tests/runtime.auth-http.test.ts` - backend endpoint policy tests.
- **FILE-019**: `apps/frontend/src/features/feedback-center/machines/feedback-center.machine.test.ts` - machine transition tests.
- **FILE-020**: `apps/frontend/src/features/admin/pages/AdminChangelogPage.test.tsx` - admin changelog page tests.
- **FILE-021**: `apps/frontend/src/features/admin/pages/AdminUserReportsPage.test.tsx` - admin reports page tests.
- **FILE-022**: `apps/frontend/src/features/feedback-center/pages/UserReportSubmissionPage.test.tsx` - user submission page tests.

## 6. Testing

- **TEST-001**: Backend authorization test: member cannot access admin changelog publish or admin report triage/publish endpoints.
- **TEST-002**: Backend validation test: non-canonical category inputs are normalized at boundary and only canonical values are persisted.
- **TEST-003**: Backend policy test: issue publication endpoint rejects non-`issue` category with deterministic error code and message.
- **TEST-004**: Backend transactional test: on GitHub publish failure, no `GitHubIssueLink` row is persisted and `UserReport.status` remains recoverable.
- **TEST-005**: Backend success test: successful issue publication persists link and sets `UserReport.status = github-published` in one transaction.
- **TEST-006**: Frontend machine test: each `ready.*Success` state requires explicit `ACK_SUCCESS` before returning to `ready.idle`.
- **TEST-007**: Frontend machine test: each `ready.*Failure` state returns to `ready.idle` only through `RESET_TO_IDLE` with `reenter: true`.
- **TEST-008**: Frontend UI test: admin pages render deterministic Data Table View state blocks (`loading`, `empty`, `error`) with canonical feedback channels.
- **TEST-009**: Frontend UI test: user submission page renders canonical Tool Workspace composition and inline-action failure copy.
- **TEST-010**: End-to-end test: create report (`issue`) -> triage -> publish issue -> verify visible GitHub link and status transition.

## 7. Risks & Assumptions

- **RISK-001**: GitHub API rate limits or auth failures can increase publish-issue failures; mitigation is strict rollback and explicit retry path.
- **RISK-002**: Route matcher ordering in backend may shadow new endpoints if inserted below generic patterns.
- **RISK-003**: Frontend drift from canonical archetypes may occur if page-specific custom layouts are introduced.
- **RISK-004**: Divergence between docs and code terminology may reintroduce synonyms if naming checks are skipped in PR review.
- **ASSUMPTION-001**: Existing auth session principal middleware and role model are stable and reusable for new endpoints.
- **ASSUMPTION-002**: Database migration pipeline is available and can be applied before backend route rollout.
- **ASSUMPTION-003**: Existing test harnesses in backend/frontend are functional for adding integration tests in listed paths.

## 8. Related Specifications / Further Reading

[Admin Changelog And User Reporting Feature Spec](../docs/02-design/specifications/admin-changelog-and-user-reporting-spec.md)
[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Specification](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)