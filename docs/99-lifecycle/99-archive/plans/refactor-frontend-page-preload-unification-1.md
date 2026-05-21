---
goal: Unify frontend page preload behavior with SWR (library-first) — replace ad-hoc/custom query code with shared data-loading primitives
version: 1.0
date_created: 2026-05-17
last_updated: 2026-05-17
owner: frontend
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [refactor, frontend, architecture, chore]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

The frontend currently manages page-level data loading through three coexisting patterns:
**Pattern A** — `useAsyncQuery` wrapper hooks (custom);
**Pattern B** — ad-hoc `useEffect` + `useState` fetch cycles duplicated inside individual page/component files;
**Pattern C** — manual reimplementation of `useAsyncQuery` internals inside feature-local hooks.

This plan adopts a **library-first** approach with **SWR** as the canonical data-loading primitive for frontend page preload. The refactoring replaces Pattern A/B/C with a single SWR-based contract, preserves existing UX behavior where required, and removes custom query lifecycle code where SWR provides equivalent capabilities (`loading`, `error`, `data`, `reload`, cache, request deduplication, stale-while-revalidate).

## 1. Requirements & Constraints

- **REQ-001**: All page-level data fetching must go through SWR (`useSWR`) or typed wrapper hooks built on top of SWR.
- **REQ-002**: A canonical wrapper return type must be exported for all wrapper hooks (`SWRQueryResult<TData>`), preserving the current surface `{ data, loading, error, reload }` for callers.
- **REQ-003**: `PageLoader` (Suspense fallback) must be exported from `apps/frontend/src/app/ui/PageLoader.tsx` and reused in `app-router.tsx`.
- **REQ-004**: `GenerationConsolePage` must replace its ad-hoc `useEffect` fetch of `listProjects` with `useProjectsQuery`.
- **REQ-005**: `useAdminModelsQuery` must be rewritten to delegate to SWR (through shared query wrapper) and accept `BackendCapabilities`.
- **REQ-006**: No existing visible behavior (loading states, error states, reload, cancel-on-unmount) may regress.
- **REQ-007**: All wrapper hooks must retain `enabled?` option; `useAdminModelsQuery` must add it.
- **UX-001**: `LoadingStateMessage` in `primitives.tsx` must add `role="status"` and `aria-live="polite"` to match the accessibility contract already used by `PageLoader`.
- **UX-002**: `LoadingStateMessage` and `EmptyStateMessage` must be visually distinguishable. Minimum requirement: `LoadingStateMessage` includes an activity indicator (CSS-only animated ellipsis is acceptable).
- **UX-003**: All hardcoded loading copy outside `appCopy` must be replaced with `appCopy.ui.states` keys. Affected files: `AdminUsersPage`, `AdminModelsPage`, `ArtifactDetailPage`, `ListingTableSection`.
- **UX-004**: `DashboardPage` must not render KPI values as `0` while `projectsQuery.loading || sessionsQuery.loading` is true. Use a placeholder (`—`) or skeleton until data resolves.
- **CON-001**: Adopt SWR as the only new data-loading dependency in this plan; do not introduce parallel query libraries (no TanStack Query in this plan).
- **CON-002**: Do not change any route path, guard, or lazy-loading boundary in `app-router.tsx`.
- **CON-003**: `useAdminModelsQuery` API surface consumed by `AdminModelsPage` must remain compatible: `{ data, loading, error, reload }`.
- **CON-004**: `AdminModelsPage` currently passes only `auth.apiBaseUrl` (no `capabilities`) to `useAdminModelsQuery` — the migration must add `capabilities` parameter and update the single call site.
- **GUD-001**: Follow DDD-first workspace policy — read canonical references before touching domain-related types.
- **GUD-002**: Prefer the smallest coherent atomic change per task; avoid monolithic replacement blocks.
- **PAT-001**: Centralize query behavior on top of SWR with one shared adapter helper in `apps/frontend/src/app/runtime/queries/`.
- **PAT-002**: Wrapper hooks live in `apps/frontend/src/app/runtime/queries/` (cross-feature) or in `apps/frontend/src/features/<feature>/runtime/` (feature-scoped). `useAdminModelsQuery` moves to `apps/frontend/src/app/runtime/queries/`.

## 2. Implementation Steps

### Implementation Phase 1 — SWR foundation + PageLoader extraction

- GOAL-001: Establish SWR baseline and preserve caller compatibility through a shared wrapper contract.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `swr` to `apps/frontend/package.json` only. `depends_on: []` | ✅ | 2026-05-17 |
| TASK-002 | Create `apps/frontend/src/app/runtime/queries/useSWRQuery.ts` with `SWRQueryResult<TData>` and a single wrapper that maps `mutate` to `reload`. `depends_on: [TASK-001]` | ✅ | 2026-05-17 |
| TASK-003 | Create `apps/frontend/src/app/ui/PageLoader.tsx` and move the current `PageLoader` component from `apps/frontend/src/app/routing/app-router.tsx`. `depends_on: [TASK-001]` | ✅ | 2026-05-17 |
| TASK-004 | Update `apps/frontend/src/app/routing/app-router.tsx` to import `PageLoader` from `../ui/PageLoader` and remove local `PageLoader` declaration. `depends_on: [TASK-003]` | ✅ | 2026-05-17 |
| TASK-005A | Update `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts` to return `SWRQueryResult<ProjectSummary[]>` (signature only). `depends_on: [TASK-002]` | ✅ | 2026-05-17 |
| TASK-005B | Update `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` to return `SWRQueryResult<SessionSummary[]>` (signature only). `depends_on: [TASK-002]` | ✅ | 2026-05-17 |
| TASK-005C | Update `apps/frontend/src/app/runtime/queries/useArtifactDetailQuery.ts` to return `SWRQueryResult<GenerationArtifact \| null>` (signature only). `depends_on: [TASK-002]` | ✅ | 2026-05-17 |
| TASK-005D | Update `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts` to return `SWRQueryResult<ProjectSummary \| null>` (signature only). `depends_on: [TASK-002]` | ✅ | 2026-05-17 |
| TASK-005E | Update `apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts` to return `SWRQueryResult<AdminUser[]>` (signature only). `depends_on: [TASK-002]` | ✅ | 2026-05-17 |

### Implementation Phase 2 — Migrate wrappers to SWR internals

- GOAL-002: Replace custom query lifecycle implementations with SWR-based wrappers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `apps/frontend/src/app/runtime/queries/useAdminModelsQuery.ts` with SWR key `[apiBaseUrl, capabilities, 'admin-models']` and fetcher using `joinApiPath(apiBaseUrl, '/api/admin/models')`. `depends_on: [TASK-002]` | ✅ | 2026-05-17 |
| TASK-007 | Delete `apps/frontend/src/features/admin/runtime/useAdminModelsQuery.ts`. `depends_on: [TASK-006]` | ✅ | 2026-05-17 |
| TASK-008 | Update `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` import and call site to use `useAdminModelsQuery({ apiBaseUrl, capabilities })`. `depends_on: [TASK-006, TASK-007]` | ✅ | 2026-05-17 |
| TASK-009A | Migrate `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts` internals from `useAsyncQuery` to `useSWRQuery`. `depends_on: [TASK-005A]` | ✅ | 2026-05-17 |
| TASK-009B | Migrate `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` internals from `useAsyncQuery` to `useSWRQuery`. `depends_on: [TASK-005B]` | ✅ | 2026-05-17 |
| TASK-009C | Migrate `apps/frontend/src/app/runtime/queries/useArtifactDetailQuery.ts` internals from `useAsyncQuery` to `useSWRQuery`. `depends_on: [TASK-005C]` | ✅ | 2026-05-17 |
| TASK-009D | Migrate `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts` internals from `useAsyncQuery` to `useSWRQuery`. `depends_on: [TASK-005D]` | ✅ | 2026-05-17 |
| TASK-009E | Migrate `apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts` internals from `useAsyncQuery` to `useSWRQuery`. `depends_on: [TASK-005E]` | ✅ | 2026-05-17 |

### Implementation Phase 3 — Migrate `GenerationConsolePage` to `useProjectsQuery`

- GOAL-003: Remove ad-hoc project preload logic from `GenerationConsolePage`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Remove local preload state (`projects`, `projectsLoading`, `projectsError`) from `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx`. `depends_on: [TASK-009A]` | ✅ | 2026-05-17 |
| TASK-011 | Add `useProjectsQuery` import and query initialization in `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx`. `depends_on: [TASK-009A]` | ✅ | 2026-05-17 |
| TASK-012 | Replace all local preload state usages with `projectsQuery` usages in `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx`. `depends_on: [TASK-010, TASK-011]` | ✅ | 2026-05-17 |
| TASK-013 | Remove unused imports in `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx` after migration (`useState` and `listProjects` if unused). `depends_on: [TASK-012]` | ✅ | 2026-05-17 |

### Implementation Phase 4 — UX consistency pass

- GOAL-004: Resolve UX consistency gaps introduced by preload unification.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Add `role="status"` and `aria-live="polite"` to `LoadingStateMessage` in `apps/frontend/src/app/ui/primitives.tsx`. `depends_on: []` | ✅ | 2026-05-17 |
| TASK-015A | Add class `ui-loading-state` to `LoadingStateMessage` in `apps/frontend/src/app/ui/primitives.tsx`. `depends_on: [TASK-014]` | ✅ | 2026-05-17 |
| TASK-015B | Add `.ui-loading-state::after` animated ellipsis styles in `apps/frontend/src/styles.css`. `depends_on: [TASK-015A]` | ✅ | 2026-05-17 |
| TASK-016 | Add missing loading keys (`loadingUsers`, `loadingModels`, `loadingArtifact`, `loadingList`) in `apps/frontend/src/app/copy/system.ts`. `depends_on: []` | ✅ | 2026-05-17 |
| TASK-017A | Replace hardcoded loading text with `appCopy.ui.states.loadingUsers` in `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx`. `depends_on: [TASK-016]` | ✅ | 2026-05-17 |
| TASK-017B | Replace hardcoded loading text with `appCopy.ui.states.loadingModels` in `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx`. `depends_on: [TASK-016]` | ✅ | 2026-05-17 |
| TASK-017C | Replace hardcoded loading text with `appCopy.ui.states.loadingArtifact` in `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`. `depends_on: [TASK-016]` | ✅ | 2026-05-17 |
| TASK-017D | Replace hardcoded loading text with `appCopy.ui.states.loadingList` in `apps/frontend/src/app/ui/ListingTableSection.tsx`. `depends_on: [TASK-016]` | ✅ | 2026-05-17 |
| TASK-018 | Add KPI loading placeholder logic (`—`) in `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx` while queries are loading. `depends_on: [TASK-009A, TASK-009B]` | ✅ | 2026-05-17 |
| TASK-019 | In `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx`, ensure the project selector is `disabled` during preload and shows a loading placeholder option. `depends_on: [TASK-012, TASK-016]` | ✅ | 2026-05-17 |

### Implementation Phase 5 — Validation and determinism gates

- GOAL-005: Validate dependency determinism, type safety, and test stability.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Run `npm install --workspaces --include-workspace-root` from workspace root. `depends_on: [TASK-001]` | ✅ | 2026-05-17 |
| TASK-021 | Run `npm ci` from workspace root. `depends_on: [TASK-020]` | ✅ | 2026-05-17 |
| TASK-022 | Run `npm ci --workspaces --include-workspace-root` from workspace root. `depends_on: [TASK-021]` | ✅ | 2026-05-17 |
| TASK-023 | Run `npm --workspace apps/frontend run build`. `depends_on: [TASK-022]` | ✅ | 2026-05-17 |
| TASK-024 | Run `npx tsc --noEmit` from `apps/frontend/`. `depends_on: [TASK-023]` | ✅ | 2026-05-17 |
| TASK-025 | Run `npm run test --workspace apps/frontend`. `depends_on: [TASK-024]` | ✅ Pass: 315/315 | 2026-05-17 |
| TASK-026 | Run `apps/frontend/src/app/routing/app-router.test.tsx` (or suite including it) and confirm pass. `depends_on: [TASK-025]` | ✅ | 2026-05-17 |

## 3. Alternatives

- **ALT-001**: **TanStack Query (React Query)** as unified data-fetching layer. Not selected for this plan because it requires `QueryClientProvider` and a broader migration scope than SWR.
- **ALT-002**: **SWR** (Vercel) with API shape close to the current surface (`data`, `loading`, `error`, `reload`) and lower migration cost. **Selected for this plan**.
- **ALT-003**: **React 19 `use()` hook + Suspense-data integration** (zero external dependencies). **Critical assessment**: React 19 is already installed (`"react": "^19.2.5"`). `use(promise)` can consume Promises directly in render with Suspense and could reduce RISK-UX-001 by collapsing JS-chunk loading and data loading into a single boundary. **Not a zero-cost alternative**: it requires a Promise cache layer (for example `React.cache()` or a manual Map), Suspense boundary refactoring in `app-router.tsx`, and explicit Error Boundary strategy. Scope: significant architectural refactor. **Deferred**: recommended as a separate medium-term spike.
- **ALT-004**: Keep `useAdminModelsQuery` in `features/admin/runtime/` and only change internals. Rejected because this hook is cross-feature and belongs to `app/runtime/queries/` by workspace convention.
- **ALT-005**: Unify `SessionSummaryDetailPage` Phase A + Phase B mix. Deferred because the page uses a local FSM (`pageState`) with domain-specific error branches (`not-found`), requiring separate analysis.

## 4. Dependencies

- **DEP-001**: `swr` package in `apps/frontend/package.json` — canonical data-loading dependency for this plan.
- **DEP-002**: `apps/frontend/src/features/admin/llm/LLMTable.tsx` — exports `AdminLlmModelRow` type required by the new `useAdminModelsQuery`.
- **DEP-003**: `apps/frontend/src/app/runtime/http-client.ts` — exports `joinApiPath` and `requestJson` used by the migrated `useAdminModelsQuery`.
- **DEP-004**: `apps/frontend/src/app/runtime/backend-capabilities.ts` — exports `BackendCapabilities` type for the hook signature.
- **DEP-005**: `apps/frontend/src/features/projects/runtime/projects-client.ts` — already used by `useProjectsQuery`; no new dependency, but `GenerationConsolePage` removes its direct import of `listProjects`.

## 5. Files

- **FILE-001**: `apps/frontend/package.json` — add `swr` dependency.
- **FILE-001b**: `package-lock.json` and `apps/frontend/package-lock.json` — regenerated by npm commands after dependency change.
- **FILE-002**: `apps/frontend/src/app/ui/PageLoader.tsx` — new file, extract `PageLoader` component from `app-router.tsx`.
- **FILE-003**: `apps/frontend/src/app/routing/app-router.tsx` — remove inline `PageLoader`, add import from `../ui/PageLoader`.
- **FILE-004**: `apps/frontend/src/app/runtime/queries/useSWRQuery.ts` — new shared SWR adapter + canonical `SWRQueryResult<TData>` type.
- **FILE-005**: `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts` — migrate internals to SWR.
- **FILE-006**: `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts` — migrate internals to SWR.
- **FILE-007**: `apps/frontend/src/app/runtime/queries/useArtifactDetailQuery.ts` — migrate internals to SWR.
- **FILE-008**: `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts` — migrate internals to SWR.
- **FILE-009**: `apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts` — migrate internals to SWR.
- **FILE-010**: `apps/frontend/src/app/runtime/queries/useAdminModelsQuery.ts` — new file, SWR-based implementation.
- **FILE-011**: `apps/frontend/src/features/admin/runtime/useAdminModelsQuery.ts` — deleted (replaced by FILE-010).
- **FILE-012**: `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` — update import path + add `capabilities` arg.
- **FILE-013**: `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx` — remove ad-hoc fetch, add SWR-backed `useProjectsQuery`.
- **FILE-014**: `apps/frontend/src/app/ui/primitives.tsx` — add `role="status"` + `aria-live` to `LoadingStateMessage` and add `ui-loading-state` class.
- **FILE-015**: `apps/frontend/src/styles.css` — add `.ui-loading-state` rule with animated `::after` ellipsis.
- **FILE-016**: `apps/frontend/src/app/copy/system.ts` — add `loadingUsers`, `loadingModels`, `loadingArtifact`, `loadingList` under `appCopy.ui.states`.
- **FILE-017**: `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx` — replace loading copy with `appCopy.ui.states.loadingUsers`.
- **FILE-018**: `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` — replace loading copy with `appCopy.ui.states.loadingModels`.
- **FILE-019**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` — replace loading copy with `appCopy.ui.states.loadingArtifact`.
- **FILE-020**: `apps/frontend/src/app/ui/ListingTableSection.tsx` — replace loading copy with `appCopy.ui.states.loadingList`.
- **FILE-021**: `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx` — suppress phantom-zero KPI render while loading.

## 6. Testing

- **TEST-001**: After TASK-004, run `apps/frontend/src/app/routing/app-router.test.tsx` — must pass without modification (PageLoader is now imported, not inlined, but renders identically).
- **TEST-002**: After TASK-008, manually verify `AdminModelsPage` renders loading/error/data states correctly via the dev server or existing component tests.
- **TEST-003**: After TASK-012, verify `GenerationConsolePage` renders project list correctly and handles `auth.session = null` (enabled guard must prevent the fetch).
- **TEST-004**: After dependency change, run deterministic install gates: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`.
- **TEST-005**: After all phases, run `npx tsc --noEmit` from workspace root and full frontend test suite — no regressions in existing test count.
- **TEST-006** (UX/A11y): Verify `LoadingStateMessage` is announced by screen readers on mount. Use browser accessibility tree or axe-core to confirm `role="status"` + `aria-live="polite"` on `ProjectsListPage` and `ArtifactDetailPage`.
- **TEST-007** (UX/Visual): Verify `LoadingStateMessage` and `EmptyStateMessage` are visually distinct across affected pages. Spot-check `ProjectDetailPage` and `ArtifactsListingSection`.
- **TEST-008** (UX/Copy): Verify no hardcoded loading copy remains outside `appCopy` in FILE-014 through FILE-020.
- **TEST-009** (UX/Phantom state): Load `DashboardPage` under throttled network (slow 3G). Confirm KPI values never render `0` during loading and show placeholder `—` until both queries resolve.

## 7. Risks & Assumptions

- **RISK-001**: `useAdminModelsQuery` currently does not accept `BackendCapabilities` — `AdminModelsPage` calls it with only `auth.apiBaseUrl`. Adding `capabilities` changes the call site. If other callers exist, they must be updated in TASK-009A through TASK-009E scope.
- **RISK-002**: `GenerationConsolePage` uses `auth.session` as a guard for the fetch — `useProjectsQuery` uses `capabilities.projects` internally. If `capabilities.projects` can be false when `auth.session` is truthy, the guard behavior changes. Must verify `useProjectsQuery` internal guard before TASK-011.
- **RISK-003**: `PageLoader` is defined in the same file as `createAppRouter` — if any test imports `PageLoader` directly from `app-router.tsx`, the extraction in TASK-003/TASK-004 will break that import. Search for any such usage before executing TASK-003.
- **RISK-UX-001** (Double-flash): The current pattern shows two sequential loading states on navigation: full-screen `PageLoader` for lazy chunk loading, followed by inline `LoadingStateMessage` for data fetch. This plan does not fully remove the double-flash and tracks it as UX debt for a future Suspense+data integration spike.
- **RISK-UX-002** (Dashboard phantom zero): `DashboardPage` currently renders KPI values from query data and may show transient `0` during loading. TASK-018 mitigates this by rendering placeholders.
- **RISK-UX-003** (Identical loading/empty visuals): `LoadingStateMessage` and `EmptyStateMessage` currently look identical. TASK-015 mitigates this.
- **ASSUMPTION-001**: `useAdminModelsMutations` does not import from `useAdminModelsQuery` — the migration in TASK-007 (deletion) is safe after verifying imports in TASK-009A through TASK-009E.
- **ASSUMPTION-002**: `GenerationConsolePage` does not use `listProjects` for any purpose other than the preload fetch being replaced. If it does, the import removal in TASK-012 must be conditional.
- **ASSUMPTION-003**: All wrappers updated in TASK-005 and TASK-009 have no callers that require a return type incompatible with `SWRQueryResult<T>`.
- **ASSUMPTION-UX-001**: CSS-only animated ellipsis in TASK-015 is sufficient for the current design system. Revisit if a design-system spinner token is introduced.
- **RISK-ARCH-001** (Migration regression): SWR migration may introduce semantic regressions if key design is unstable (cache collisions or unintended refetch). **Mitigation**: use deterministic array keys and include required identifiers (`capabilities`, ids).
- **RISK-ARCH-002** (Dual-stack drift): Keeping `useAsyncQuery` and SWR wrappers for too long creates a double standard. **Mitigation**: mark `useAsyncQuery` as deprecated immediately after wrapper migration and remove it in the next cycle.

## 8. Related Specifications / Further Reading

- Preliminary analysis + UX review + library-first evaluation accepted (SWR): conversation context (2026-05-17)
- [apps/frontend/src/app/runtime/queries/useSWRQuery.ts](../apps/frontend/src/app/runtime/queries/useSWRQuery.ts)
- [apps/frontend/src/app/routing/app-router.tsx](../apps/frontend/src/app/routing/app-router.tsx)
- [docs/02-design/specifications/frontend-tool-pages-architecture-spec.md](../docs/02-design/specifications/frontend-tool-pages-architecture-spec.md)
- SWR docs: https://swr.vercel.app/
- TanStack Query docs: https://tanstack.com/query/latest
