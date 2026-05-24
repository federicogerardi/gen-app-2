---
goal: Frontend admin CRUD implementation plan for ApiServiceCatalog and ApiService bindings
version: 1.0
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Frontend Platform
status: Planned
tags: [feature, frontend, admin, crud, ddd, api-service]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines a deterministic frontend implementation for admin CRUD management of ApiServiceCatalog and ApiService binding configuration, aligned with canonical DDD terms (`ApiService`, `ApiServiceAccessMode`, `ApiServiceCatalog`, `ToolInputSource`, `WorkflowStepType`) and existing AdminDashboard DataTableView patterns.

## 1. Requirements & Constraints

- REQ-001: Implement frontend admin read/create/update/delete flows for `ApiServiceCatalog` using backend endpoints already exposed under `/api/admin/api-services`.
- REQ-002: Implement frontend admin read/create/update/delete flows for ApiService bindings under `/api/admin/api-services/:id/bindings` and `/api/admin/api-services/:id/bindings/:bindingId`.
- REQ-003: Keep capability-gated behavior using `adminApiServicesCrud` and `toolsApiServicesResolve` in `apps/frontend/src/app/runtime/backend-capabilities.ts`.
- REQ-004: Reuse canonical DataTableView composition (query hook + toolbar + table + mutation hooks + inline feedback) used by existing admin pages.
- REQ-005: Keep all user-facing admin copy centralized in `apps/frontend/src/app/copy/system.ts`; do not add hardcoded production literals in runtime hooks/components.
- REQ-006: Add deterministic form validation for ApiService profile fields and binding fields through typed form schemas in frontend runtime.
- SEC-001: Frontend must never render or persist secrets; `tokenCiphertext` must not be exposed in FE DTOs or UI state.
- SEC-002: Admin routes and actions must remain role-gated through existing `AdminGuard` integration.
- CON-001: Scope is frontend only (`apps/frontend/**`); backend runtime and DB schema are out of scope for this plan.
- CON-002: No terminology drift is allowed; only canonical terms from glossary/decision log may be used in code, plan text, and tests.
- CON-003: Preserve existing AdminDashboard route architecture and lazy-loaded route registration style in `app-router.tsx`.
- GUD-001: Prefer additive, small-surface changes that follow established admin page architecture (`AdminPageContainer`, DataTableView conventions).
- GUD-002: Keep mutation feedback deterministic through existing helper patterns (`useAdminMutationFeedback` and page-local feedback ownership boundaries).
- PAT-001: Reuse `admin-client.ts` request helper style (`requestJson`, `requestVoid`, `isHttpClientError`, deterministic HTTP error wrappers).
- PAT-002: Reuse existing query-hook shape (`{ data, loading, error, reload }`) used by admin query hooks.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish frontend runtime contracts and client functions for ApiService and ApiService bindings.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add ApiService frontend DTOs and binding DTOs in `apps/frontend/src/features/admin/runtime/admin-client.ts` (or dedicated `admin-api-service-client.ts`) with canonical fields: `id`, `key`, `label`, `baseUrl`, `resourcePath`, `accessMode`, `requestMethod`, `contractProfileVersion`, `tokenConfigured`, mapping-rule collections, and binding metadata (`workflowStepType`, `requiredness`, `bindingStatus`). |  |  |
| TASK-002 | Implement API client functions for ApiService CRUD in `apps/frontend/src/features/admin/runtime/admin-client.ts`: `listAdminApiServices`, `createAdminApiService`, `updateAdminApiService`, `deleteAdminApiService`; each must use `buildApiPaths(capabilities).admin.apiServices` and `apiServiceById(id)` with deterministic HTTP error projection. |  |  |
| TASK-003 | Implement API client functions for bindings CRUD in `apps/frontend/src/features/admin/runtime/admin-client.ts`: `listAdminApiServiceBindings`, `upsertAdminApiServiceBinding`, `deleteAdminApiServiceBinding`; use `/api/admin/api-services/:id/bindings` routes with capability guard fallback error when path is null. |  |  |
| TASK-004 | Add/extend unit tests in `apps/frontend/src/features/admin/runtime/admin-client.test.ts` covering request shape, error wrapping, capability-off behavior, and redacted payload assumptions (no `tokenCiphertext`). |  |  |

Completion Criteria: client layer compiles with strict typing, includes both catalog and bindings operations, and has deterministic unit coverage for success/error/capability-off branches.

### Implementation Phase 2

- GOAL-002: Add frontend query and mutation hooks for ApiServiceCatalog DataTableView and binding editor workflow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Create query hook `apps/frontend/src/features/admin/runtime/useAdminApiServicesQuery.ts` returning `{ data, loading, error, reload }` using existing query utility pattern and centralized fallback copy from `appCopy.ui.fallbackErrors` keys dedicated to ApiService admin pages. |  |  |
| TASK-006 | Create mutation hook `apps/frontend/src/features/admin/runtime/useAdminApiServicesMutations.ts` implementing create/update/delete flows with busy action ownership and deterministic reload strategy after successful mutations. |  |  |
| TASK-007 | Create query hook `apps/frontend/src/features/admin/runtime/useAdminApiServiceBindingsQuery.ts` scoped by selected `apiServiceId`, with deterministic empty/error states and reload semantics. |  |  |
| TASK-008 | Create mutation hook `apps/frontend/src/features/admin/runtime/useAdminApiServiceBindingsMutations.ts` implementing upsert/delete binding actions with deterministic in-flight state and optimistic behavior policy explicitly documented in code comments. |  |  |
| TASK-009 | Add form schemas in `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` and `apps/frontend/src/features/admin/runtime/admin-api-service-binding-form.ts` validating canonical field constraints (methods, requiredness values, workflowStepType values, mapping-rule structure). |  |  |

Completion Criteria: hooks expose stable contracts used by pages, mutation state ownership is deterministic, and schemas enforce canonical field constraints before network dispatch.

### Implementation Phase 3

- GOAL-003: Implement ApiService admin page and table-based CRUD UI following canonical DataTableView pattern.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add page `apps/frontend/src/features/admin/pages/AdminApiServicesPage.tsx` using `AdminPageContainer` and DataTableView composition: toolbar, create/update form panel, table listing, inline row actions. |  |  |
| TASK-011 | Add UI components under `apps/frontend/src/features/admin/ui/` for ApiService page: `AdminApiServicesToolbar.tsx`, `AdminApiServiceCreateForm.tsx`, `AdminApiServicesTable.tsx`, and row-level edit surface aligned to existing admin table components. |  |  |
| TASK-012 | Integrate query + mutation hooks from Phase 2 into `AdminApiServicesPage.tsx` with deterministic rendering gates (`LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage`) and no nested card anti-patterns. |  |  |
| TASK-013 | Add route entry `/admin/api-services` in `apps/frontend/src/app/routing/app-router.tsx` with lazy-loading and admin guard inheritance through existing `AdminLayout`.
 |  |  |
| TASK-014 | Extend admin persistent navigation component (existing file under `apps/frontend/src/features/admin/ui/`) to include canonical menu entry for ApiServiceCatalog page, with centralized copy authority from `appCopy`.
 |  |  |

Completion Criteria: admin page is routable, capability-aware, and fully operable for ApiService CRUD through table + forms with deterministic loading/error/empty states.

### Implementation Phase 4

- GOAL-004: Implement binding-management UI surface and integrate with ApiService page workflows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add binding editor surface under `apps/frontend/src/features/admin/ui/` (for example `AdminApiServiceBindingsPanel.tsx`) showing binding rows by selected ApiService and exposing upsert/delete actions. |  |  |
| TASK-016 | Wire binding panel to `useAdminApiServiceBindingsQuery` and `useAdminApiServiceBindingsMutations` with deterministic selected-service state ownership in `AdminApiServicesPage.tsx`.
 |  |  |
| TASK-017 | Ensure binding form validates canonical values for `workflowStepType` and `requiredness` and blocks dispatch on invalid payload prior to HTTP request.
 |  |  |
| TASK-018 | Add centralized copy entries in `apps/frontend/src/app/copy/system.ts` for ApiService and binding labels/errors, and remove any newly introduced hardcoded runtime literals in page/runtime components.
 |  |  |

Completion Criteria: binding CRUD is available from the admin ApiService surface with deterministic validation, reload behavior, and canonical copy ownership.

### Implementation Phase 5

- GOAL-005: Verify end-to-end frontend behavior, route wiring, accessibility baseline, and capability guards.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Add/extend page tests in `apps/frontend/src/features/admin/pages/AdminApiServicesPage.test.tsx` covering list/create/update/delete flows, loading/error/empty rendering, and mutation feedback behavior. |  |  |
| TASK-020 | Add/extend UI tests for binding panel interactions under `apps/frontend/src/features/admin/ui/` and/or page-level integration tests for upsert/delete binding scenarios.
 |  |  |
| TASK-021 | Extend routing/access tests in `apps/frontend/src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx` and `apps/frontend/src/app/routing/app-router.test.tsx` to assert route visibility and admin-only gating for `/admin/api-services`.
 |  |  |
| TASK-022 | Run deterministic verification commands from repository root: `npm --workspace apps/frontend run typecheck`; `npm --workspace apps/frontend run test`; `npm run test -- apps/frontend/src/features/admin/runtime/admin-client.test.ts`; `npm run test -- apps/frontend/src/features/admin/pages/AdminApiServicesPage.test.tsx`.
 |  |  |
| TASK-023 | Run DDD governance scan for introduced FE naming to confirm only canonical terms are used (`ApiService`, `ApiServiceAccessMode`, `ApiServiceCatalog`, `ToolInputSource`, `WorkflowStepType`) and no synonyms (`connector`, `integration`, `data source`) are introduced in code/comments/tests.
 |  |  |

Completion Criteria: frontend typecheck/tests pass, new route is guard-protected, binding CRUD is covered by automated tests, and naming remains DDD-canonical.

## 3. Alternatives

- ALT-001: Reuse `AdminModelsPage` with polymorphic mode (`models` vs `api-services`). Rejected because it creates mixed-domain UI ownership and reduces clarity of `ApiServiceCatalog`-specific validation/forms.
- ALT-002: Implement only ApiService list/read in frontend and defer mutations. Rejected because requested scope is admin CRUD and would leave incomplete operational capability.
- ALT-003: Implement bindings editor in a separate standalone route without service context. Rejected because binding rows are semantically scoped to one `ApiService` and require selected-service context for safe mutations.

## 4. Dependencies

- DEP-001: Backend admin ApiService endpoints and DTO contracts already implemented in backend runtime (`/api/admin/api-services`, `/api/admin/api-services/:id`, `/api/admin/api-services/:id/bindings`).
- DEP-002: Existing frontend capability flags in `apps/frontend/src/app/runtime/backend-capabilities.ts` and path mapping in `apps/frontend/src/app/runtime/api-paths.ts`.
- DEP-003: Existing admin shell/routing architecture (`AdminGuard`, `AdminPageContainer`, `AdminPersistentNavigation`, `app-router`).
- DEP-004: Existing HTTP utility layer in `apps/frontend/src/app/runtime/http-client.ts`.
- DEP-005: Existing admin feedback/query patterns (`useAdminMutationFeedback`, query hooks under `app/runtime/queries`).
- DEP-006: Canonical DDD references: `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`.

## 5. Files

- FILE-001: `apps/frontend/src/features/admin/runtime/admin-client.ts`
- FILE-002: `apps/frontend/src/features/admin/runtime/admin-client.test.ts`
- FILE-003: `apps/frontend/src/features/admin/runtime/useAdminApiServicesQuery.ts` (new)
- FILE-004: `apps/frontend/src/features/admin/runtime/useAdminApiServicesMutations.ts` (new)
- FILE-005: `apps/frontend/src/features/admin/runtime/useAdminApiServiceBindingsQuery.ts` (new)
- FILE-006: `apps/frontend/src/features/admin/runtime/useAdminApiServiceBindingsMutations.ts` (new)
- FILE-007: `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` (new)
- FILE-008: `apps/frontend/src/features/admin/runtime/admin-api-service-binding-form.ts` (new)
- FILE-009: `apps/frontend/src/features/admin/pages/AdminApiServicesPage.tsx` (new)
- FILE-010: `apps/frontend/src/features/admin/pages/AdminApiServicesPage.test.tsx` (new)
- FILE-011: `apps/frontend/src/features/admin/ui/AdminApiServicesToolbar.tsx` (new)
- FILE-012: `apps/frontend/src/features/admin/ui/AdminApiServiceCreateForm.tsx` (new)
- FILE-013: `apps/frontend/src/features/admin/ui/AdminApiServicesTable.tsx` (new)
- FILE-014: `apps/frontend/src/features/admin/ui/AdminApiServiceBindingsPanel.tsx` (new)
- FILE-015: `apps/frontend/src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx`
- FILE-016: `apps/frontend/src/app/routing/app-router.tsx`
- FILE-017: `apps/frontend/src/app/routing/app-router.test.tsx`
- FILE-018: `apps/frontend/src/features/admin/ui/AdminPersistentNavigation.tsx`
- FILE-019: `apps/frontend/src/app/copy/system.ts`

## 6. Testing

- TEST-001: API client unit tests validate CRUD request methods/paths and deterministic error wrapping for ApiService endpoints.
- TEST-002: API client unit tests validate bindings list/upsert/delete path contracts and capability-off error behavior.
- TEST-003: Form-schema tests validate ApiService field constraints and binding requiredness/workflowStepType constraints.
- TEST-004: Page tests validate DataTableView rendering lifecycle (loading/error/empty/ready) for `AdminApiServicesPage`.
- TEST-005: Page tests validate create/update/delete actions trigger mutation hooks and reload behaviors deterministically.
- TEST-006: Binding panel tests validate selected-service scoped listing and upsert/delete actions.
- TEST-007: Routing/admin-gate tests validate `/admin/api-services` is reachable only through admin-authenticated flow.
- TEST-008: Accessibility smoke checks validate keyboard navigation and visible focus behavior on table actions and form controls.
- TEST-009: Global frontend regression check ensures existing admin pages (`AdminUsersPage`, `AdminModelsPage`, `AdminChangelogPage`, `AdminUserReportsPage`) remain green.

## 7. Risks & Assumptions

- RISK-001: Mapping-rule/profile form complexity can create high cognitive load and validation drift if not modularized by field groups.
- RISK-002: Capability toggles may hide endpoints at runtime and produce ambiguous UX if fallback copy is missing.
- RISK-003: Binding editor state can desynchronize from selected ApiService if reload/selection ownership is not deterministic.
- RISK-004: Introducing large page components may duplicate admin-table patterns unless components are split into atomic UI modules.
- ASSUMPTION-001: Backend endpoints and response shape for ApiService and bindings remain stable for this implementation cycle.
- ASSUMPTION-002: Existing auth session and admin guard behavior are already reliable and require no architectural changes.
- ASSUMPTION-003: Existing admin navigation shell can accept one additional route entry without structural refactor.

## 8. Related Specifications / Further Reading

- `plan/feature-api-service-backend-contract-1.md`
- `apps/frontend/src/app/runtime/api-paths.ts`
- `apps/frontend/src/app/runtime/backend-capabilities.ts`
- `apps/frontend/src/features/admin/runtime/admin-client.ts`
- `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx`
- `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx`
- `apps/frontend/src/features/admin/pages/AdminChangelogPage.tsx`
- `apps/frontend/src/features/admin/pages/AdminUserReportsPage.tsx`
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
