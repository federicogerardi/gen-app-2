---
goal: Complete Frontend Feedback System Unification
version: 1.1
date_created: 2026-05-16
last_updated: 2026-05-16
owner: Frontend Platform Team
status: 'Completed'
tags: [feature, frontend, architecture, ui-governance, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines the deterministic implementation path to unify all frontend user feedback into the canonical channel model: `inline-action`, `page-state`, and `global`, while preserving DDD terminology and UI governance constraints.

## 1. Requirements & Constraints

- **REQ-001**: Implement one canonical feedback channel model using `FeedbackChannel` (`inline-action`, `page-state`, `global`) across frontend runtime and UI rendering.
- **REQ-002**: Preserve `DispatchError` ownership as `inline-action` in Tool Workspace Page flows.
- **REQ-003**: Preserve `PageStateMessage` ownership for query/list lifecycle in Data Table View and list/detail pages.
- **REQ-004**: Introduce app-level `GlobalFeedbackMessage` runtime path for mutation outcomes without replacing local contextual feedback.
- **REQ-005**: Remove semantic misuse where mutation success text is rendered via `LoadingStateMessage`.
- **REQ-006**: Centralize mutation feedback publishing through one frontend runtime API.
- **SEC-001**: Do not expose backend stack traces or sensitive transport details in global feedback payloads.
- **SEC-002**: Ensure no cross-user/session feedback leakage by scoping in-memory queue to current browser runtime session.
- **ACC-001**: Global feedback viewport must use `aria-live` with deterministic severity mapping (`polite` for success/info, `assertive` for error).
- **CON-001**: Keep existing query state primitives in `apps/frontend/src/app/ui/primitives.tsx` as source of truth for `PageStateMessage`.
- **CON-002**: Keep existing tool dispatch flow in `apps/frontend/src/features/tools/runtime/useToolPage.ts` and do not move `DispatchError` to global channel.
- **CON-003**: Follow canonical UI governance in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` sections 7, 8, and 9.
- **CON-004**: Use existing dependency stack; preferred implementation is MUI `Snackbar` + `Alert` (no additional library required in baseline).
- **CON-005**: Align implementation with MUI v9 snackbar API guidance (`slots`/`slotProps`) and avoid introducing deprecated snackbar props in new code.
- **GUD-001**: Use canonical DDD terms from glossary and naming log (`FeedbackChannel`, `PageStateMessage`, `GlobalFeedbackMessage`, `DispatchError`).
- **GUD-002**: Keep implementation deterministic and testable with isolated provider/hook/component boundaries.
- **PAT-001**: Apply provider + hook + viewport pattern for cross-page feedback.
- **PAT-002**: Apply event-to-channel matrix from UI governance spec before rendering any new feedback event.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish canonical runtime foundation for global feedback channel without changing existing `inline-action` and `page-state` behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx` exporting `FeedbackMessageProvider`, `useFeedbackMessage`, deterministic queue reducer, and public APIs `publishSuccess`, `publishError`, `dismiss`, `dismissAll`; define message type union with `severity`, `channel='global'`, `ttlMs`, `dedupeKey`. | Yes | 2026-05-16 |
| TASK-002 | Create `apps/frontend/src/app/ui/GlobalFeedbackViewport.tsx` rendering queue entries via MUI `Snackbar` + `Alert`; implement deterministic stacking order (newest last), auto-hide per `ttlMs`, `onClose` reason handling (`clickaway` ignored, deterministic dismiss on timeout/manual close), `Escape` behavior for stacked snackbars, and `aria-live` behavior by severity. | Yes | 2026-05-16 |
| TASK-003 | Update `apps/frontend/src/App.tsx` to wrap `RouterProvider` with `FeedbackMessageProvider` while preserving `AuthSessionProvider` and `GenerationWorkspaceProvider` ordering. | Yes | 2026-05-16 |
| TASK-004 | Update `apps/frontend/src/app/layouts/AuthenticatedShell.tsx` to mount `GlobalFeedbackViewport` once at shell level outside route content to guarantee cross-page persistence. | Yes | 2026-05-16 |
| TASK-005 | Add style tokens and classes in `apps/frontend/src/styles.css` for viewport placement, stacking gap, z-index policy, and responsive behavior on desktop/mobile. | Yes | 2026-05-16 |

### Implementation Phase 2

- GOAL-002: Migrate mutation feedback flows to canonical `global` channel and remove local semantic drift.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Refactor `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx`: replace local `feedbackMessage` success handling with `useFeedbackMessage().publishSuccess`, keep `mutationError` mapped to `publishError` when field-local context is unavailable, and remove success rendering via `LoadingStateMessage`. | Yes | 2026-05-16 |
| TASK-007 | Refactor `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx`: route create/update/delete success and mutation failures through `publishSuccess`/`publishError`; keep list loading/error/empty in `PageStateMessage` positions. | Yes | 2026-05-16 |
| TASK-008 | Refactor `apps/frontend/src/features/projects/pages/NewProjectPage.tsx`: on successful project creation, publish global success before navigation; keep form root validation error local (`inline-action`). | Yes | 2026-05-16 |
| TASK-009 | Refactor `apps/frontend/src/features/auth/ui/LoginForm.tsx` and `apps/frontend/src/app/layouts/PublicShell.tsx`: keep credential/form errors local; publish global success only for cross-page session bootstrap confirmation (if enabled by product policy). | Yes | 2026-05-16 |
| TASK-010 | Refactor `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx`: replace raw `<p className={uiPrimitives.error}>` branch for session query error with canonical `ErrorStateMessage` (`page-state`) and prevent unintended global emission for query lifecycle. | Yes | 2026-05-16 |

### Implementation Phase 3

- GOAL-003: Enforce channel boundaries and prevent regressions through reusable utilities and governance checks.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create `apps/frontend/src/app/runtime/feedback-channel-map.ts` exporting deterministic helper `resolveFeedbackChannel(eventType)` aligned to governance matrix in UI spec section 7; include explicit exhaustive mapping for known event types. | Yes | 2026-05-16 |
| TASK-012 | Update `apps/frontend/src/app/ui/ListingTableSection.tsx` documentation/comments to explicitly state `PageStateMessage` ownership and prohibition of global substitution for loading/empty/error. | Yes | 2026-05-16 |
| TASK-013 | Update `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` and `apps/frontend/src/features/tools/runtime/useToolPage.ts` comments/contracts to explicitly preserve `DispatchError` as `inline-action` only and reject global duplication. | Yes | 2026-05-16 |
| TASK-014 | Add copy keys in `apps/frontend/src/app/copy/system.ts` for global success/error messages currently hardcoded in admin/project flows; remove duplicated literal strings in migrated pages. | Yes | 2026-05-16 |
| TASK-015 | Add governance reference block to `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` section 7 usage notes to include implementation contract paths (`FeedbackMessageProvider`, `GlobalFeedbackViewport`, `resolveFeedbackChannel`). | Yes | 2026-05-16 |

### Implementation Phase 4

- GOAL-004: Validate unification with automated tests, deterministic acceptance checks, and rollout safeguards.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Add provider unit tests in `apps/frontend/src/app/providers/FeedbackMessageProvider.test.tsx` for queue insertion, dedupe behavior, dismiss, auto-expire, and severity-to-aria mapping, using Vitest fake timers (`vi.useFakeTimers`, `vi.advanceTimersByTime`, cleanup with `vi.useRealTimers`) for deterministic TTL checks. | Yes | 2026-05-16 |
| TASK-017 | Add viewport rendering tests in `apps/frontend/src/app/ui/GlobalFeedbackViewport.test.tsx` for stack order, close action, `onClose` reason handling (`clickaway` and `escapeKeyDown`), and responsive class behavior. | Yes | 2026-05-16 |
| TASK-018 | Update `apps/frontend/src/features/admin/pages/AdminUsersPage.test.tsx` and add `apps/frontend/src/features/admin/pages/AdminModelsPage.test.tsx` to assert global feedback publication for mutation outcomes and no `LoadingStateMessage` misuse for success copy. | Yes | 2026-05-16 |
| TASK-019 | Add regression tests for tool page in `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` (or nearest existing suite) asserting `DispatchError` remains inline and is not emitted to global viewport. | Yes | 2026-05-16 |
| TASK-020 | Execute validation command sequence: `npm --workspace apps/frontend run typecheck`, `npm --workspace apps/frontend run test`, `npm --workspace apps/frontend run build`; capture outputs in implementation PR notes. | Yes | 2026-05-16 |

## 3. Alternatives

- **ALT-001**: Build fully custom global feedback system with manual focus/a11y handling. Rejected because existing MUI stack already provides stable primitives and lower implementation risk.
- **ALT-002**: Adopt `notistack` immediately. Deferred because baseline unification can be delivered with zero additional dependency; reassess only if queue orchestration requirements exceed provider baseline.
- **ALT-003**: Collapse all feedback into global channel. Rejected because it violates canonical channel ownership (`DispatchError` and `PageStateMessage` must remain local).

## 4. Dependencies

- **DEP-001**: `@mui/material` (existing) for `Snackbar` and `Alert` rendering primitives.
- **DEP-002**: Existing React context/provider architecture in `apps/frontend/src/App.tsx`.
- **DEP-003**: Canonical UI governance source `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` sections 7-9.
- **DEP-004**: DDD canonical references for terminology (`domain-ubiquitous-language-glossary.md`, `domain-bounded-context-map.md`, `domain-naming-decision-log.md`).

## 5. Files

- **FILE-001**: `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx` — new global feedback runtime provider and API.
- **FILE-002**: `apps/frontend/src/app/ui/GlobalFeedbackViewport.tsx` — new shell-level global feedback renderer.
- **FILE-003**: `apps/frontend/src/App.tsx` — provider composition update.
- **FILE-004**: `apps/frontend/src/app/layouts/AuthenticatedShell.tsx` — viewport mount point.
- **FILE-005**: `apps/frontend/src/styles.css` — viewport and feedback visual tokens/classes.
- **FILE-006**: `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx` — migration to global mutation feedback.
- **FILE-007**: `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` — migration to global mutation feedback.
- **FILE-008**: `apps/frontend/src/features/projects/pages/NewProjectPage.tsx` — mutation success channel alignment.
- **FILE-009**: `apps/frontend/src/features/auth/ui/LoginForm.tsx` — channel boundary enforcement.
- **FILE-010**: `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx` — page-state error canonicalization.
- **FILE-011**: `apps/frontend/src/app/ui/ListingTableSection.tsx` — page-state ownership hardening.
- **FILE-012**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — preserve inline `DispatchError` ownership.
- **FILE-013**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` — preserve inline `DispatchError` ownership.
- **FILE-014**: `apps/frontend/src/app/copy/system.ts` — centralized global feedback copy keys.
- **FILE-015**: `apps/frontend/src/app/runtime/feedback-channel-map.ts` — deterministic event-to-channel mapping utility.
- **FILE-016**: `apps/frontend/src/app/providers/FeedbackMessageProvider.test.tsx` — provider behavior tests.
- **FILE-017**: `apps/frontend/src/app/ui/GlobalFeedbackViewport.test.tsx` — viewport behavior tests.
- **FILE-018**: `apps/frontend/src/features/admin/pages/AdminUsersPage.test.tsx` — migration regression tests.
- **FILE-019**: `apps/frontend/src/features/admin/pages/AdminModelsPage.test.tsx` — new migration regression tests.
- **FILE-020**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` — implementation contract references update.

## 6. Testing

- **TEST-001**: Provider queue lifecycle test: publish -> render -> auto-expire -> remove (deterministic fake timers).
- **TEST-002**: Provider dedupe test: same `dedupeKey` within suppression window emits one active message.
- **TEST-003**: Severity accessibility test: success/info maps to `aria-live=polite`, error maps to `aria-live=assertive`.
- **TEST-004**: Viewport interaction test: manual dismiss removes targeted message only.
- **TEST-004b**: Viewport close-reason behavior test: `clickaway` does not dismiss; `escapeKeyDown` follows deterministic single-snackbar close policy.
- **TEST-005**: AdminUsers mutation success test publishes one global success message and no `LoadingStateMessage` success proxy.
- **TEST-006**: AdminModels mutation failure test publishes one global error message and retains table `page-state` rendering for query lifecycle.
- **TEST-007**: Tool page dispatch failure test confirms inline `DispatchError` rendering and zero global publication.
- **TEST-008**: Dashboard session query error test confirms `ErrorStateMessage` rendering in page body and no global feedback message emission.
- **TEST-009**: End-to-end static validation: typecheck, unit test suite, and frontend build all pass.

## 7. Risks & Assumptions

- **RISK-001**: Duplicate feedback emission may occur during migration if page-local state and global publishing coexist temporarily.
- **RISK-002**: Inconsistent message wording may persist until all hardcoded literals are migrated to copy keys.
- **RISK-003**: Global viewport z-index may conflict with existing overlays/modals if not standardized.
- **RISK-004**: Overuse of global channel could regress local context clarity if channel mapping utility is bypassed.
- **ASSUMPTION-001**: Frontend workspace dependency (`@mui/material` v9.x) supports required Snackbar/Alert features without additional dependency.
- **ASSUMPTION-002**: Current test infrastructure (Vitest + Testing Library) is sufficient for provider/viewport behavior verification.
- **ASSUMPTION-003**: Product policy accepts ephemeral global mutation confirmation messages for admin/project actions.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `plan/upgrade-frontend-ui-unification-1.md`

## 8b. Context7 Evidence Applied (2026-05-16)

- **EV-001 (React)**: Provider architecture remains aligned with React context + reducer patterns for deterministic global queue state.
- **EV-002 (MUI)**: Snackbar/Alert implementation should enforce explicit `onClose` reason handling and use v9-compatible API patterns (`slots`/`slotProps`) for forward-safe component wiring.
- **EV-003 (Testing Library + Vitest)**: Auto-expire and dismiss behavior must be tested with fake timers and async-safe assertions (`findBy*`/`waitFor`) to avoid flaky timing tests.

## 9. PR Execution Sequence (Minimum Risk)

This execution sequence is designed to reduce regression risk by introducing runtime infrastructure first, then migrating page behaviors, then locking boundaries and tests.

### PR-001 — Foundation

- **PR Goal**: Introduce the global feedback runtime foundation without changing existing business behavior.
- **Include Tasks**: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005.
- **Explicitly Exclude**: TASK-006..TASK-020.
- **Primary Files**:
	- `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx`
	- `apps/frontend/src/app/ui/GlobalFeedbackViewport.tsx`
	- `apps/frontend/src/App.tsx`
	- `apps/frontend/src/app/layouts/AuthenticatedShell.tsx`
	- `apps/frontend/src/styles.css`
- **Merge Gates**:
	- App boots with no runtime errors and no route regressions.
	- Existing inline/page-state feedback remains unchanged.
	- Global viewport mounts once and stays inert if no messages are published.
- **Rollback Strategy**:
	- Revert provider and viewport wiring in `App.tsx` and `AuthenticatedShell.tsx` only.
	- Keep new files isolated so rollback is a single revert commit.

### PR-002 — Migration

- **PR Goal**: Move mutation outcomes to canonical `global` channel while preserving local `inline-action` and `page-state` ownership.
- **Include Tasks**: TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-014.
- **Explicitly Exclude**: TASK-011, TASK-012, TASK-013, TASK-015, TASK-016..TASK-020.
- **Primary Files**:
	- `apps/frontend/src/features/admin/pages/AdminUsersPage.tsx`
	- `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx`
	- `apps/frontend/src/features/projects/pages/NewProjectPage.tsx`
	- `apps/frontend/src/features/auth/ui/LoginForm.tsx`
	- `apps/frontend/src/app/layouts/PublicShell.tsx`
	- `apps/frontend/src/features/dashboard/pages/DashboardPage.tsx`
	- `apps/frontend/src/app/copy/system.ts`
- **Merge Gates**:
	- No mutation success rendered via `LoadingStateMessage`.
	- Query/list lifecycle remains rendered as `PageStateMessage` in page body.
	- `DispatchError` in Tool Workspace remains inline-only.
- **Rollback Strategy**:
	- Revert page-level migrations while preserving foundation provider/viewport from PR-001.
	- Restore local mutation message states in migrated pages if needed.

### PR-003 — Hardening + Tests

- **PR Goal**: Enforce deterministic channel boundaries and lock behavior with automated tests and governance contract updates.
- **Include Tasks**: TASK-011, TASK-012, TASK-013, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020.
- **Primary Files**:
	- `apps/frontend/src/app/runtime/feedback-channel-map.ts`
	- `apps/frontend/src/app/ui/ListingTableSection.tsx`
	- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
	- `apps/frontend/src/features/tools/runtime/useToolPage.ts`
	- `apps/frontend/src/app/providers/FeedbackMessageProvider.test.tsx`
	- `apps/frontend/src/app/ui/GlobalFeedbackViewport.test.tsx`
	- `apps/frontend/src/features/admin/pages/AdminUsersPage.test.tsx`
	- `apps/frontend/src/features/admin/pages/AdminModelsPage.test.tsx`
	- `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`
	- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- **Merge Gates**:
	- `npm --workspace apps/frontend run typecheck` passes.
	- `npm --workspace apps/frontend run test` passes.
	- `npm --workspace apps/frontend run build` passes.
	- Governance references include runtime contract paths.
- **Rollback Strategy**:
	- Revert enforcement utility and docs together.
	- Keep PR-001 and PR-002 behavior intact if PR-003 fails acceptance.

### Execution Order And Branching

1. Create `feat/feedback-foundation` from `dev` and deliver PR-001.
2. After PR-001 merge, create `feat/feedback-migration` from updated `dev` and deliver PR-002.
3. After PR-002 merge, create `feat/feedback-hardening-tests` from updated `dev` and deliver PR-003.

### Freeze Rules During Execution

- Do not mix unrelated refactors in PR-001/002/003.
- Do not rename canonical terms during implementation unless a new DDD decision is approved first.
- If a task introduces cross-page regressions, stop the phase and rollback only that PR scope.