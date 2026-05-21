---
goal: Move tool links from sidebar to a dedicated Tools hub route (/tools) and keep a single Tools entry in main navigation
version: 1.1
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Frontend Platform Team
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [refactor, frontend, navigation, ui, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic frontend refactor to remove per-tool entries from sidebar navigation and introduce a single Tools hub entry at `/tools`. Tool workspace routes (`/tools/{toolKey}`) remain active and unchanged. The change is constrained to Frontend/UI behavior and must preserve canonical DDD/UI language, route contracts, and tool availability gating.

## 1. Requirements & Constraints

- **REQ-001**: Main sidebar navigation must expose exactly one tools entry (`/tools`) and must not expose direct per-tool links (`/tools/funnel-pages`, `/tools/nextland`, `/tools/youtube-lf-script`, `/tools/angle-generator`).
- **REQ-002**: A new authenticated route `/tools` must render a Tools hub page that links to enabled `SupportedTool` tool workspace routes.
- **REQ-003**: Existing tool workspace routes (`/tools/{toolKey}`) must remain reachable and behaviorally unchanged.
- **REQ-004**: Tools hub listing must respect `ToolAvailabilityStatus` through existing enablement source (`getEnabledToolKeys` / `isToolEnabled`).
- **REQ-004A**: Tools hub scope is limited to canonical `SupportedTool` entries; `/tools/console` is out of hub listing scope and remains independently routable.
- **REQ-004B**: `getEnabledToolNavigationItems()` is the single source of truth for enabled tool navigation metadata; any frontend surface rendering a tool list must consume this helper directly.
- **REQ-005**: Navigation label for the new entry must be canonical and centralized in copy constants (`appCopy.ui.navigation`).
- **REQ-007**: `/tools` hub must include explicit UX disambiguation copy and one dedicated secondary link to `/tools/console` labelled as advanced/manual flow, to avoid user confusion between Tool Workspace and console route.
- **REQ-006**: No changes to Generation, Auth, or Usage/Quota backend contracts are allowed.
- **SEC-001**: The hub route must remain under authenticated shell only; no public route exposure is allowed.
- **DDD-001**: Use canonical terms only (`SupportedTool`, `ToolAvailabilityStatus`, `Tool Workspace Page`, `Data Table View` governance rules where applicable).
- **DDD-002**: Do not introduce new domain terms in code or docs unless first registered in `docs/07-governance/domain-naming-decision-log.md`.
- **UI-001**: The `/tools` hub must be explicitly classified as `Data Table View` archetype (list/index page) per UI governance and must avoid nested cards by default.
- **UI-002**: If implementation diverges from `Data Table View` canonical composition, drift must be documented and convergence actions recorded in the same change.
- **UI-003**: The `/tools/console` entry in hub must be visually and semantically separated from `SupportedTool` table rows (for example helper section or footer action), never rendered as a tool row.
- **CON-001**: Keep existing route paths and query semantics for artifact relaunch and session relaunch links that currently target `/tools/{toolKey}`.
- **CON-002**: Keep existing lazy-loading pattern in `app-router.tsx`.
- **CON-003**: Keep mobile and collapsed navigation behavior in `MainNavigation` unchanged except for the item set.
- **GUD-001**: Apply smallest coherent atomic changes; do not bundle unrelated UI refactors.
- **PAT-001**: Use data-driven tool lists from runtime registry helpers instead of duplicating static tool arrays.
- **PAT-002**: Prohibit local per-page `SupportedTool -> label/path` maps for navigational listings; use only the canonical helper output.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Add canonical Tools hub route and page scaffold without changing existing tool workspace routes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/frontend/src/features/tools/pages/ToolsHubPage.tsx` with authenticated page content and deterministic links to enabled tool routes (`/tools/{toolKey}`), using `getEnabledToolKeys` and canonical labels from `appCopy`; explicitly exclude `/tools/console` from hub items. | ✅ | 2026-05-21 |
| TASK-002 | Add `getEnabledToolNavigationItems()` in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` returning ordered `{ toolKey: SupportedTool; to: string; label: string }[]` for enabled tools only; consume this helper in `ToolsHubPage` and ban alternative local mapping in hub implementation. | ✅ | 2026-05-21 |
| TASK-003 | Add lazy import and route entry for `/tools` in `apps/frontend/src/app/routing/app-router.tsx` under authenticated routes; keep existing `TOOL_ROUTES` spread unchanged. | ✅ | 2026-05-21 |
| TASK-004 | Ensure `/tools` route ordering does not shadow or break `/tools/{toolKey}` static routes and confirm route matching remains deterministic. | ✅ | 2026-05-21 |
| TASK-004A | Add disambiguation copy block in `ToolsHubPage` and a dedicated secondary action link to `/tools/console` using canonical copy keys (`appCopy.ui.navigation.toolsConsole`, `appCopy.ui.labels.toolsConsoleDescription`), outside the tool table rows. | ✅ | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Converge sidebar navigation to a single Tools link.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add canonical copy label `tools` to `appCopy.ui.navigation` in `apps/frontend/src/app/copy/system.ts` if not present. | ✅ | 2026-05-21 |
| TASK-005A | Add canonical copy label `toolsConsole` in `appCopy.ui.navigation` and description copy key for hub disambiguation text in `appCopy.ui.labels`. | ✅ | 2026-05-21 |
| TASK-006 | Update `appNavigation` in `apps/frontend/src/app/copy/system.ts` to remove per-tool sidebar items and add one item `{ to: '/tools', label: appCopy.ui.navigation.tools, end: false }`. | ✅ | 2026-05-21 |
| TASK-007 | Update icon mapping and any tools-path filtering logic in `apps/frontend/src/app/layouts/MainNavigation.tsx` so `/tools` renders correctly while preserving admin/session/artifacts entries and mobile behavior. | ✅ | 2026-05-21 |
| TASK-008 | Remove obsolete per-tool navigation assumptions in `apps/frontend/src/app/layouts/MainNavigation.tsx`, including `/tools/` prefix-based item filtering tied to per-tool sidebar entries. | ✅ | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Align UI governance and page composition for the Tools hub.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Implement `Data Table View` composition in `ToolsHubPage` using shared primitives (`Surface`, `TopBar`, `ListingTableSection`, `uiPrimitives`) with deterministic columns (`Tool`, `Description`, `Action`) and without nested cards. | ✅ | 2026-05-21 |
| TASK-010 | Ensure hub CTA/link patterns follow canonical CTA governance (primary CTA uses `ui-button`; inline navigational links use `inlineLink`; no row-button anti-pattern because page is not tabular). | ✅ | 2026-05-21 |
| TASK-011 | Confirm explicit archetype declaration (`Data Table View`) in implementation notes and keep terminology aligned with `frontend-ui-ubiquitous-language-spec.md` without introducing non-canonical labels. | ✅ | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Update and extend tests for route and navigation behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Extend `apps/frontend/src/app/layouts/MainNavigation.test.tsx` to assert presence of single Tools link and absence of direct per-tool links in sidebar rendering for member users. | ✅ | 2026-05-21 |
| TASK-013 | Extend `apps/frontend/src/app/routing/app-router.test.tsx` to assert `/tools` route resolves successfully under authenticated shell. | ✅ | 2026-05-21 |
| TASK-014 | Add `apps/frontend/src/features/tools/pages/ToolsHubPage.test.tsx` to verify enabled tools are rendered as links and disabled tools are hidden according to runtime availability. | ✅ | 2026-05-21 |
| TASK-015 | Add regression test assertion that direct route navigation to an existing tool path (for example `/tools/funnel-pages`) still loads the expected Tool Workspace Page. | ✅ | 2026-05-21 |
| TASK-015A | Add test assertion that `/tools/console` is not rendered as a hub row/action item and remains reachable only via its explicit route. | ✅ | 2026-05-21 |
| TASK-015B | Add accessibility and responsive assertions for `ToolsHubPage`: keyboard focusable action links and stable rendering on mobile viewport baseline used by existing frontend tests. | ✅ | 2026-05-21 |
| TASK-015C | Add test assertion that `MainNavigation` does not consume tool availability mapping for per-tool entries anymore (single `/tools` link only), while `ToolsHubPage` list is driven by `getEnabledToolNavigationItems()` output. | ✅ | 2026-05-21 |

### Implementation Phase 5

- GOAL-005: Validate build, route integrity, and deterministic completion gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Run `npm --workspace apps/frontend run build` and require success. | ✅ | 2026-05-21 |
| TASK-017 | Run `npm run test --workspace apps/frontend -- src/app/layouts/MainNavigation.test.tsx src/app/routing/app-router.test.tsx src/features/tools/pages/ToolsHubPage.test.tsx` and require success. | ✅ | 2026-05-21 |
| TASK-018 | Run full frontend test suite `npm run test --workspace apps/frontend` and require no regressions. | ✅ | 2026-05-21 |
| TASK-019 | Capture completion evidence in plan update (`last_updated`, completed checkmarks, and execution date columns). | ✅ | 2026-05-21 |

## 3. Alternatives

- **ALT-001**: Keep current sidebar with all per-tool links and add `/tools` anyway. Rejected because it does not satisfy the scope objective (sidebar simplification).
- **ALT-002**: Replace `/tools/{toolKey}` pages with nested route-only rendering under `/tools`. Rejected because it creates high regression risk for existing deep links and relaunch flows.
- **ALT-003**: Redirect `/tools` directly to `/tools/funnel-pages`. Rejected because it does not provide the requested hub entry point and keeps tool discovery implicit.
- **ALT-004**: Build hub as compact card-only discovery page. Rejected because `/tools` is a list/index page and must follow the canonical `Data Table View` archetype under UI governance.

## 4. Dependencies

- **DEP-001**: `apps/frontend/src/app/routing/app-router.tsx` for authenticated route registration.
- **DEP-002**: `apps/frontend/src/app/layouts/MainNavigation.tsx` for sidebar rendering and icon mapping.
- **DEP-003**: `apps/frontend/src/app/copy/system.ts` for canonical navigation labels and `appNavigation` source.
- **DEP-004**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` for tool availability and enabled tool discovery.
- **DEP-005**: Existing tool workspace pages under `apps/frontend/src/features/tools/*/pages/` for unchanged deep-link targets.

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/pages/ToolsHubPage.tsx` (new)
- **FILE-002**: `apps/frontend/src/features/tools/pages/ToolsHubPage.test.tsx` (new)
- **FILE-003**: `apps/frontend/src/app/routing/app-router.tsx`
- **FILE-004**: `apps/frontend/src/app/layouts/MainNavigation.tsx`
- **FILE-005**: `apps/frontend/src/app/layouts/MainNavigation.test.tsx`
- **FILE-006**: `apps/frontend/src/app/copy/system.ts`
- **FILE-007**: `apps/frontend/src/app/routing/app-router.test.tsx`
- **FILE-008**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

## 6. Testing

- **TEST-001**: Sidebar navigation renders one Tools link and no direct per-tool links for member users.
- **TEST-002**: `/tools` route loads the Tools hub inside authenticated shell.
- **TEST-003**: `/tools/{toolKey}` direct navigation still loads each existing Tool Workspace Page.
- **TEST-004**: Disabled tools are not shown in hub listing when availability status is disabled.
- **TEST-004A**: `/tools/console` is excluded from hub listing and remains routable through direct route.
- **TEST-004B**: Hub includes explicit disambiguation copy and dedicated `/tools/console` secondary link outside tool table rows.
- **TEST-005**: Build gate passes with `npm --workspace apps/frontend run build`.
- **TEST-006**: Focused tests pass for navigation and router modules.
- **TEST-007**: Full frontend suite passes without regressions.
- **TEST-008**: `ToolsHubPage` action links are keyboard-focusable and accessible by role/name.
- **TEST-009**: `ToolsHubPage` layout remains usable under mobile viewport baseline without broken action visibility.
- **TEST-010**: Availability mapping source-of-truth check: only `getEnabledToolNavigationItems()` feeds tool-list rendering in hub tests; no local mapping fallback accepted.

## 7. Risks & Assumptions

- **RISK-001**: Existing tests may implicitly expect direct per-tool sidebar links; updates are required to reflect new navigation contract.
- **RISK-002**: Copy key additions (`navigation.tools`) can cause snapshot/test copy mismatches if not propagated consistently.
- **RISK-003**: Hub route introduction may create duplicate perceived entry points with `/tools/console`; mitigated by REQ-007 + TASK-004A + TEST-004B.
- **RISK-004**: If enablement mapping is duplicated across hub and nav, drift can reappear; mitigated by REQ-004B + PAT-002 + TASK-002 + TASK-015C + TEST-010.
- **ASSUMPTION-001**: Existing relaunch flows that build links to `/tools/{toolKey}` remain valid and require no contract change.
- **ASSUMPTION-002**: No backend API changes are required for this scope.
- **ASSUMPTION-003**: Current authenticated shell guards remain sufficient for the new hub route.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `plan/process-tool-page-finding-closure-1.md`
- `plan/refactor-frontend-page-preload-unification-1.md`
