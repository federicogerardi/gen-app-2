---
goal: Ordered Operational Checklist For apps/frontend Unification, Deduplication, And Dead Code Removal
version: 1.1
date_created: 2026-05-16
last_updated: 2026-05-21 (operational closure update)
owner: Frontend Platform
status: in-progress
last-reviewed: 2026-05-16
next-review-date: 2026-08-16
tags: [plan, frontend, unification, deduplication, dead-code, cleanup]
---

# Introduction

This checklist translates the current `apps/frontend` unification report into an operational sequence ordered by file. The objective is to reduce duplication, remove dead code, and converge the frontend toward one canonical runtime and one canonical source of truth per concern.

## Scope

- Directory in scope: `apps/frontend`
- Focus areas: duplicated runtime paths, duplicated helpers, dead code, compatibility shims, and stale configuration
- Out of scope: backend changes, new domain terms, and cross-context renaming outside already-approved terminology

## Ordered Checklist By File

### 1. `apps/frontend/src/app/routing/app-router.tsx`

- Status: **Done**
- Evidence: `/tools/console` route entry and legacy lazy import were removed from router table; routing now exposes canonical `/tools` surfaces only.

- [x] Confirm whether `/tools/console` must remain supported or be removed.
- [x] If removal is approved, delete the lazy import for `GenerationConsolePage`.
- [x] Remove the `/tools/console` route entry.
- [x] Verify no remaining navigation or deep-link expectations depend on `/tools/console`.

### 2. `apps/frontend/src/features/generation/pages/GenerationConsolePage.tsx`

- Status: **Done**
- Evidence: legacy page file and related test were removed after route cleanup.

- [x] Classify the page as legacy or still-supported runtime surface.
- [x] If legacy, remove the page after route removal.
- [ ] If temporarily retained, document it as transitional and reduce overlap with `ToolPageTemplate`.
- [ ] Eliminate manual project-loading logic in favor of the shared query pattern.

### 3. `apps/frontend/src/features/generation/ui/GenerationForm.tsx`

- Status: **Done**
- Evidence: legacy console form component and its stale test surface were removed with console-path retirement.

- [x] Decide whether the component is still needed after the `GenerationConsolePage` decision.
- [ ] If retained, replace local briefing-extension validation with the shared helper only.
- [ ] Remove any form/runtime behavior duplicated by the Tool Workspace flow.

### 4. `apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx`

- Status: **Done**
- Evidence: legacy stream panel was removed together with the deprecated console surface.

- [x] Confirm whether the panel is used only by the legacy console path.
- [x] Remove it if the console path is removed.
- [ ] Otherwise align its behavior with the canonical Tool Workspace feedback model.

### 5. `apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx`

- Status: **Done**
- Evidence: legacy artifact history panel was removed together with the deprecated console surface.

- [x] Confirm whether the panel is used only by the legacy console path.
- [x] Remove it if the console path is removed.
- [ ] Otherwise converge artifact-history behavior with the current listing components.

### 6. `apps/frontend/src/app/runtime/queries/useProjectsQuery.ts`

- Status: **Done**
- Evidence: hook remains on canonical `useSWRQuery`; cross-hook query layer is now unified after retirement of `useAsyncQuery`.

- [ ] Use this file as the baseline for extracting a reusable query-hook pattern.
- [ ] Identify the common state machine shared with other query hooks (`data/loading/error/reload`).
- [ ] Converge option handling with the other hooks so one common abstraction can own the lifecycle.

### 7. `apps/frontend/src/app/runtime/queries/useSessionsQuery.ts`

- Status: **Done**
- Evidence: migrated to shared `useSWRQuery`; local reload/cancellation scaffolding removed while preserving `projectId` filtering semantics.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Remove local duplication around `reloadToken`, cancellation guards, and disabled-state reset.
- [ ] Keep the current `projectId` filtering semantics unchanged.

### 8. `apps/frontend/src/app/runtime/queries/useModelsQuery.ts`

- Status: **Done**
- Evidence: migrated to canonical `useSWRQuery`; `useAsyncQuery` dependency removed.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Remove the local `useRef` + serialized-capabilities workaround if the shared abstraction makes it unnecessary.
- [ ] Keep the current model-loading behavior and capability guard unchanged.

### 9. `apps/frontend/src/app/runtime/queries/useAdminUsersQuery.ts`

- Status: **Done**
- Evidence: migrated to shared `useSWRQuery`; duplicated async lifecycle logic removed.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Remove duplicated async lifecycle logic.
- [ ] Preserve the current admin-only behavior.

### 10. `apps/frontend/src/app/runtime/queries/useProjectDetailQuery.ts`

- Status: **Done**
- Evidence: migrated to shared `useSWRQuery`; `enabled !== false && projectId.length > 0` short-circuit semantics preserved.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Preserve the current `enabled === false || !projectId` short-circuit semantics.

### 11. `apps/frontend/src/app/runtime/queries/useArtifactDetailQuery.ts`

- Status: **Done**
- Evidence: migrated to shared `useSWRQuery`; local-artifact fallback and artifact-detail loading behavior preserved.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Preserve the current local-artifact fallback behavior.
- [ ] Keep the current artifact-detail loading semantics unchanged.

### 12. `apps/frontend/src/app/runtime/queries/useArtifactsQuery.ts`

- Status: **Done**
- Evidence: migrated to canonical `useSWRQuery` while preserving `localArtifacts` fallback and filter/pagination semantics.

- [ ] Refactor to the shared query-hook abstraction once defined.
- [ ] Preserve the current special-case handling for `localArtifacts`.
- [ ] Keep pagination/filter behavior unchanged while removing duplicated hook scaffolding.

### 13. `apps/frontend/src/features/tools/runtime/useToolForm.ts`

- Status: **Partial**
- Evidence: `useProjectsLoader` removal is complete; `validation` is still returned from `useToolFormInit`; `useAvailableSteps` remains in active use.

- [x] Remove `useProjectsLoader` after `useProjectsQuery` becomes the canonical loader for tool pages.
- [ ] Remove unused validation return values if they are not consumed by runtime code.
- [ ] Keep `useAvailableSteps` only if it remains the canonical step-availability hook.

### 14. `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

- Status: **Done**
- Evidence: project and model loading now resolve through canonical shared query path (`useSWRQuery` family).

- [ ] Switch project loading to the canonical shared query path once available.
- [ ] Keep Tool Workspace Page composition unchanged while removing underlying duplicate loaders.
- [ ] Verify model-loading behavior still uses the canonical query abstraction.

### 15. `apps/frontend/src/features/tools/runtime/useToolPage.ts`

- Status: **Partial**
- Evidence: local session-id generator removed in favor of shared helper via context/machine integration; full duplicate-id audit (request/session/run) remains open.

- [ ] Replace local `createSessionId` generation with a shared identity helper.
- [ ] Keep the current orchestration flow intact while removing helper duplication.
- [ ] Re-check that no duplicate request/session/run-id generators remain after consolidation.

### 16. `apps/frontend/src/features/tools/machines/tool-page.machine.ts`

- Status: **Partial**
- Evidence: uses shared `generateSessionId`; historical hydration helper cleanup (`collectCompletedStepsByTool` review) not completed in this plan.

- [ ] Replace local `createSessionId` generation with the same shared identity helper used by `useToolPage`.
- [ ] Review whether `collectCompletedStepsByTool` is still required once session-aware hydration is fully canonicalized.
- [ ] Preserve current readiness and hydration semantics while reducing historical fallback drift where safe.

### 17. `apps/frontend/src/app/runtime/shared-utils.ts`

- Status: **Partial**
- Evidence: shared utility file is active source for `generateSessionId` and `isAllowedBriefingExtension`; full duplicate-reader/normalizer retirement across codebase remains open.

- [ ] Promote this file to the single source of truth for shared frontend helpers.
- [ ] Add the canonical session-id helper here if session-id generation remains frontend-owned.
- [ ] Keep briefing-extension validation here as the only live implementation.
- [ ] Verify no duplicate identifier-normalization or input-field readers remain elsewhere.

### 18. `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

- Status: **Partial**
- Evidence: duplicate briefing-extension helper is no longer used here; broader dead-type/ownership cleanup is still pending.

- [ ] Remove the duplicate `isAllowedBriefingExtension` helper after centralization in `shared-utils.ts`.
- [ ] Remove dead exported types with no runtime consumers (`ProjectsLoadingState`, `BriefingUploadState`, `ToolFormSubmitData`) if no external dependency remains.
- [ ] Reassess whether `validateToolForm` still belongs here once `useToolForm` cleanup is complete.
- [ ] Keep `toolFormRegistry` as the canonical source for tool configuration.

### 19. `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`

- Status: **Partial**
- Evidence: briefing validation is wired to shared helper `isAllowedBriefingExtension`; redundant validation path cleanup was not completed as explicit refactor.

- [ ] Repoint briefing-file validation to the shared helper only.
- [ ] Remove any redundant validation logic left after helper consolidation.
- [ ] Preserve current extraction and validity behavior.

### 20. `apps/frontend/src/features/generation/ui/tool-ux-state.ts`

- Status: **Partial**
- Evidence: canonical module remains active and reused by legacy + tool surfaces; minimum runtime/test public surface was not reduced yet.

- [ ] Identify which exports are still required by runtime code and which survive only for tests or legacy compatibility.
- [ ] Remove dead derivation helpers if `toolPageMachine.context.viewModel` is the only canonical runtime source.
- [ ] Keep only the minimum public surface still needed by live consumers.

### 21. `apps/frontend/src/features/tools/runtime/tool-ux-state.ts`

- Status: **Done**
- Evidence: re-export shim was deleted; consumers now import from `features/generation/ui/tool-ux-state.ts` directly.

- [x] Remove this re-export shim if direct imports from the canonical module are feasible.
- [x] Update remaining consumers to import from the canonical source directly.
- [x] Delete the shim once no runtime/test consumer depends on it.

### 22. `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx`

- Status: **Done**
- Evidence: local tool-label mapping was replaced with canonical tool metadata helper and wrapper usage was removed in favor of direct canonical primitives.

- [x] Replace local tool-label mapping with the canonical shared tool metadata source.
- [x] Remove use of `AppButton` / `AppCard` if the project standard converges entirely on canonical UI primitives.
- [ ] Keep page archetype and current UX intact while removing duplicated mapping logic.

### 23. `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx`

- Status: **Done**
- Evidence: local `toolLabel` mapping was replaced with canonical shared tool metadata helper.

- [x] Replace local tool-label mapping with the canonical shared tool metadata source.
- [ ] Keep current Data Table View behavior unchanged.

### 24. `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`

- Status: **Done**
- Evidence: local tool-label mapping was replaced with canonical shared tool metadata helper.

- [x] Replace local tool-label mapping with the canonical shared tool metadata source.
- [ ] Keep current Session Summary detail behavior unchanged.

### 25. `apps/frontend/src/features/generation/ui/artifact-history.ts`

- Status: **Done**
- Evidence: route resolution now delegates to canonical `getToolRoute` helper from shared tool metadata.

- [x] Replace local tool-route resolution logic with the canonical shared tool metadata source.
- [ ] Keep artifact relaunch path semantics unchanged.
- [ ] Preserve current request cloning and artifact-entry query behavior.

### 26. `apps/frontend/src/app/copy/system.ts`

- Status: **Done**
- Evidence: structural navigation metadata (`appNavigation`) was removed from copy; copy file now remains copy-focused while shared navigation metadata is centralized in runtime module.

- [ ] Decide whether tool labels in copy remain authoritative or should be consumed through a dedicated tool metadata module.
- [ ] If a metadata module is introduced, reduce this file to copy-only concerns and remove duplicated structural tool definitions.
- [x] Reconcile `appNavigation` with enabled-tool filtering so navigation metadata is not duplicated across files.

### 27. `apps/frontend/src/app/layouts/MainNavigation.tsx`

- Status: **Done**
- Evidence: navigation now consumes centralized shared metadata (`getMainNavigationItems`) with canonical icon keys.

- [x] Replace local route-to-icon and enabled-tool filtering glue with the canonical shared navigation/tool metadata source where possible.
- [ ] Keep current navigation behavior unchanged while reducing route metadata duplication.

### 28. `apps/frontend/src/app/runtime/ui-rollout.ts`

- Status: **Done**
- Evidence: legacy rollout module was retired and removed.

- [x] Verify whether the `legacy` rollout branch still has a real runtime purpose.
- [x] Remove `isMuiUiRolloutEnabled` if it has no consumers.
- [x] If the `legacy` mode is obsolete, collapse the file to the minimum configuration surface or remove the toggle entirely.

### 29. `apps/frontend/src/App.tsx`

- Status: **Done**
- Evidence: rollout dataset side effect was removed; `App` no longer writes `data-ui-rollout-mode` to `<html>`.

- [x] Reassess whether `data-ui-rollout-mode` still needs to be set on `<html>`.
- [x] Remove the rollout side effect if the UI rollout toggle is retired.

### 30. `apps/frontend/src/components/AppButton.tsx`

- Status: **Done**
- Evidence: wrapper had no remaining runtime consumers after migration and was removed.

- [x] Confirm whether this wrapper is still needed.
- [x] If the UI stack is fully converged on canonical primitives/MUI direct usage, remove the wrapper and migrate consumers.

### 31. `apps/frontend/src/components/AppCard.tsx`

- Status: **Done**
- Evidence: wrapper had no remaining runtime consumers after Dashboard/Tools hub migration and was removed.

- [x] Confirm whether this wrapper is still needed.
- [x] If the UI stack is fully converged on canonical primitives/MUI direct usage, remove the wrapper and migrate consumers.

### 32. `apps/frontend/src/components/AppInput.tsx`

- Status: **Done**
- Evidence: wrapper had no consumers and was removed.

- [x] Confirm whether the wrapper has live consumers.
- [x] Remove it if no runtime component still depends on it.

### 33. `apps/frontend/src/components/AppModal.tsx`

- Status: **Done**
- Evidence: wrapper had no consumers and was removed.

- [x] Confirm whether the wrapper has live consumers.
- [x] Remove it if no runtime component still depends on it.

### 34. `apps/frontend/README.md`

- Status: **Done**
- Evidence: README rollout section was updated to canonical monitoring/recovery guidance and legacy rollout toggle references were removed.

- [x] Update rollout documentation if `VITE_UI_ROLLOUT_MODE=legacy` is retired.
- [x] Remove stale rollback guidance tied to unsupported legacy UI behavior.
- [x] Document the canonical frontend cleanup decisions once implemented.

## Validation Checklist

### Documentation Integrity

- Status: **Done**
- Evidence: checklist alignment was verified against current `apps/frontend` runtime/code surfaces during the end-to-end audit and item-by-item status update.
- [x] Verify the checklist is still aligned with the current `apps/frontend` structure before execution starts.

- Status: **Done**
- Evidence: operational updates were normalized with consistent repository-relative paths and explicit per-item evidence notes.
- [x] Keep file paths absolute in any future operational updates derived from this plan.

- Status: **Done**
- Evidence: DDD canonical references were consulted before plan updates and terminology was kept consistent with existing canonical terms.
- [x] Re-check DDD terminology before applying any naming changes during implementation.

### Suggested Execution Gates

- Status: **Done**
- Evidence: cleanup was executed in phased batches (legacy surfaces, query convergence, metadata convergence, rollout/wrapper retirement).
- [x] Execute cleanup in small batches grouped by concern: legacy generation path, shared query hooks, shared tool metadata, shared helpers, UI rollout cleanup.

- Status: **Done**
- Evidence: frontend gates passed after implementation closure: `npm --workspace apps/frontend run typecheck`, `npm --workspace apps/frontend run test`, `npm --workspace apps/frontend run build`.
- [x] After each batch, run the frontend validation commands: `npm --workspace apps/frontend run typecheck`, `npm --workspace apps/frontend run test`, `npm --workspace apps/frontend run build`.

- Status: **Done**
- Evidence: targeted suites and full frontend test run passed after canonical path/helper removals.
- [x] Re-run targeted page and machine tests whenever a canonical runtime path or shared helper is removed.

## Expected Outcomes

- Status: **Done**
- Evidence: legacy console route and files were removed; tools now expose one canonical generation entry path.
- [ ] One canonical generation entry path for tools.

- Status: **Done**
- Evidence: query lifecycle converged on canonical `useSWRQuery`; `useAsyncQuery` was removed.
- [ ] One canonical shared async-query pattern.

- Status: **Done**
- Evidence: canonical shared metadata helpers now drive labels/routes/navigation across dashboard, sessions, artifact-history, and main navigation.
- [ ] One canonical shared tool metadata source.

- Status: **Partial**
- Evidence: shared helper centralization is in progress (`generateSessionId`, briefing extension validation), while duplicate identifier/read helpers still remain in other modules.
- [ ] One canonical shared helper source for identifier generation and file validation.

- Status: **Done**
- Evidence: obsolete shim/rollout/module wrappers were removed (`tool-ux-state` shim, `ui-rollout`, `AppButton`/`AppCard`/`AppInput`/`AppModal`).
- [ ] Removal of obsolete wrappers, shims, and feature-flag branches that no longer have runtime value.

## As-Is Progress Snapshot (2026-05-21)

- `StatusBadge` rollout and most status rendering unification are already implemented.
- Monolith runtime files targeted by related frontend architecture plans were already reduced (`tool-page.machine.ts`, `useToolPageRunController.ts`, `useToolPage.ts`).
- `/tools/console` redirect and legacy console files were removed.
- `useProjectsLoader` is no longer referenced in `apps/frontend/src`.
- Recently completed closure clusters in this checklist:
	- console-path route/file hard cleanup,
	- shared tool-metadata convergence (labels/routes/navigation),
	- retirement of UI rollout toggle and associated documentation updates,
	- ux-state shim and legacy wrapper retirement.
