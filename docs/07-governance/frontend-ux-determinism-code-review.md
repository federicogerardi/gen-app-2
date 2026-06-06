---
status: active
version: 1.1
date_created: 2026-06-06
last-reviewed: 2026-06-06
next-review-date: 2026-07-06
owner: Frontend Platform Team
type: code-review
---

# Frontend UX Determinism and Unification Code Review

## Scope
- Frontend-only code review focused on unification opportunities and UX behavior determinism.
- Covers: XState machines, copy centralization, UI primitives, error/loading/empty state patterns, accessibility.
- Evidence-based findings with direct file references.

---

## A. XState Machines — Determinism

### A1. Error strings instead of explicit error states (3 machines)

| Machine | Flag | Location |
|---|---|---|
| `tool-page.machine.ts` | `generationError: string \| null` | `tool-page.types.ts:23` |
| `briefing-upload.machine.ts` | `error: string \| null` | context:30 |
| `auth-session.machine.ts` | `error: string \| null` | context:13 |

Machines with better error handling (`generation-lifecycle`, `frontend-stream`, `feedback-center`) use explicit error states. The others hide sub-states inside `context.error !== null`, making UX behavior non-deterministic from state alone — the same `idle` or `unauthenticated` state covers both "clean" and "error" conditions.

**Recommendation**: Introduce child states (`idle.error`, `unauthenticated.error`) or orthogonal regions for error. This makes the UI transition to/from error a traceable machine event, not a flag derivation.

### A2. Inline guards duplicating named guards (2 machines)

- `tool-flow.machine.ts:197,208` — duplicate `isCurrentStepEvent` + `hasNextStep`
- `generation-lifecycle.machine.ts:97` — duplicate `isCurrentStepDone` + `hasNextStep`

**Recommendation**: Use `and(['isCurrentStepDone', 'hasNextStep'])` to compose existing guards. Eliminates drift risk when logic changes.

### A3. Dual-write viewModel in `tool-page.machine.ts` actions

`setGenerationError` (line 96) and `updateNonStreamingProgress` (line 135) simultaneously update raw context fields AND rebuild the `viewModel`. If a future code path updates one without the other, the viewModel becomes stale.

**Recommendation**: Derive `viewModel` reactively (pure selector on context) instead of dual-writing in actions.

### A4. Dead code in machines

| File | Line | Element |
|---|---|---|
| `tool-page.machine.ts` | 96 | `setGenerationError` — defined but never used in any transition |
| `frontend-generation.machine.ts` | 38-39 | `GENERATION_SUCCESS`/`GENERATION_FAILURE` — event types declared but never used |
| `frontend-stream.machine.ts` | 153 | `isMonotonicSequence` — guard defined but never referenced |
| `frontend-stream.machine.ts` | 169 | `isTerminalForActiveArtifact` — guard defined but never referenced |

### A5. `tool-flow.machine.ts` — unused machine

`generation-lifecycle.machine.ts` has replaced `tool-flow.machine.ts`, which remains in the codebase with tests but no runtime consumer.

### A6. Pull-based cross-machine coupling

`briefing-upload.machine.ts:33-53` exports `hasReadyBriefingExtractionContext` which reads directly into the child actor's snapshot. If the child context shape changes, this function breaks silently. A push-based pattern (child sends event to parent on readiness change) would be more robust.

### A7. Missing `onError` on invoked actor

`tool-page.machine.ts:360-372`: the `generationLifecycleMachine` invoke has `onDone` but no `onError`. An unexpected child crash would not be caught.

---

## B. Copy Centralization

### B1. ~100+ hardcoded strings in components

Most significant violations:

| Area | File | Example | Status |
|---|---|---|---|
| Tool action buttons | `ToolActionButtons.tsx:61-95` | `"Riprova"`, `"Annulla"`, `"Salta step"` | open |
| YouTube Description form | `ToolPageTemplate.tsx:636-821` | 9 field labels hardcoded in English | open |
| Admin forms | `AdminModelCreateForm.tsx`, `AdminUserCreateForm.tsx`, etc. | `"Crea modello"`, `"Nuovo utente"`, `"Salva"` | open |
| Admin tables | `ReportsTable.tsx`, `ChangelogTable.tsx`, `LLMTable.tsx`, `ActivityLogTable.tsx` | Column headers hardcoded | open |
| Admin dashboard | `AdminDashboardPage.tsx:28-48` | 4 KPI widgets with hardcoded text | open |
| Admin navigation | `admin-navigation.ts:13-51` | 7 labels + 7 descriptions outside `copy/system.ts` | open |
| Artifact detail | `ArtifactDetailPage.tsx:231` | `"Apri sessione"` duplicates `appCopy.ui.toolPage.openSessionLabel` | open |
| Feedback center | `UserReportSubmissionPage.tsx:84` | `"Report submitted successfully."` vs `appCopy.ui.feedback.userReportSubmitted` | **resolved** — now uses `appCopy.ui.feedback.userReportSubmitted` |

### B2. Language inconsistency

| Copy section | Language |
|---|---|
| `appCopy.ui.fallbackErrors.*` | All English |
| `appCopy.ui.feedback.*` | All Italian |
| `appCopy.ui.states.*` | Mixed (`completed`/`pending` in English, loading list in Italian) |
| `appCopy.ui.toolPage.form.*` | Mixed (`projectLabel` Italian, `campaignObjective*` English) |
| Admin form labels | English (`Email`, `Role`, `Status`, `Key`, `Label`) |
| Zod validation messages | Mixed (`LoginForm`: Italian, `NewProjectPage`: English) |

### B3. Duplicate definitions with different labels

~~`UserReportSubmissionPage.tsx:23-27` defines `USER_REPORT_CATEGORY_OPTIONS` with `{ value: 'issue', label: 'Issue' }`, while `appCopy.ui.feedbackCenterOptions.categories` has `{ value: 'issue', label: 'Bug' }`. Same value, different label — **deterministic UX bug**.~~

**RESOLVED** — Local `USER_REPORT_CATEGORY_OPTIONS` removed. Component now uses `appCopy.ui.feedbackCenterOptions.categories` as single source.

---

## C. UI Patterns — Unification

### C1. Two competing button systems

- `primitives.tsx` exports `Button` (native HTML with `ui-button` class)
- `CtaButtons.tsx` exports 3 MUI CTAs (`PrimaryCtaButton`, `SecondaryCtaButton`, `SoftCtaButton`)
- `UploadFieldButton.tsx`, `LoginForm.tsx`, all admin forms use MUI `Button` directly

**Recommendation**: Converge to a single system. The UI spec (Section 4b) already defines 3 canonical patterns (`ui-button`, `inlineLink`, `bordered-chip`) but implementation is fragmented across two libraries.

### C2. Two visually distinct error CSS classes

~~| Class | Style | Usage |
|---|---|---|
| `.ui-error` (`uiPrimitives.error`) | Full border | ToolPageTemplate, ToolStatusCard, form errors |
| `.ui-fv-error` | Left accent border | `ToolGenerationFlowVertical.tsx:283` |

Same semantic meaning (inline error), different visual rendering. The user sees errors with different styles depending on which page section they are in.~~

**RESOLVED** — `.ui-fv-error` replaced with `uiPrimitives.error` in `ToolGenerationFlowVertical.tsx`. CSS rule removed from `styles.css`. All inline errors now use the same visual style.

### C3. 173+ ad-hoc CSS classes not in `uiPrimitives`

Classes like `ui-tool-page-template`, `ui-fv-root`, `ui-admin-kpi-widget-card`, `ui-artifact-page-layout` are defined in CSS but referenced as raw strings in components. Refactoring/renaming is fragile.

### C4. `ui-badge-*` classes have no CSS definitions

~~`ToolStepCard.tsx:26-32,53,65` uses `ui-badge-idle`, `ui-badge-running`, `ui-badge-done`, `ui-badge-error`, `ui-badge-streaming` — **none of these have definitions in `styles.css`**. Step status badges render with zero visual styling.~~

**RESOLVED** — `ToolStepCard.tsx` refactored to use the existing `StatusBadge` component (`app/ui/StatusBadge.tsx`) which uses `ui-status-badge--*` CSS classes (defined in `styles.css:784-826`). Step status badges now render with proper visual styling.

### C5. `artifactsReloadError` silently dropped

~~`useToolPage.ts:138,202` exposes it, but `ToolPageTemplate.tsx` never renders it. An artifact reload error is invisible to the user.~~

**RESOLVED** — `artifactsReloadError` is now destructured from `useToolPage` and passed to the Workflow Panel `errorMessage` prop in `ToolPageTemplate.tsx`. Artifact reload errors are now visible to the user.

---

## D. Accessibility

### D1. Missing `role="alert"` on 5 error renderings

| File | Line | Content | Status |
|---|---|---|---|
| `ToolPageTemplate.tsx` | 874 | `dispatchError` | **resolved** |
| `ToolStepCard.tsx` | 87 | step generation failed | **resolved** |
| `ToolFormComponents.tsx` | 42, 75, 176 | project/briefing/warning errors | **resolved** |
| `LoginForm.tsx` | 76 | login error | **resolved** |
| `NewProjectPage.tsx` | 77 | form root error | **resolved** |

~~Screen readers will not announce these errors.~~

**RESOLVED** — `role="alert"` added to all 7 error rendering points across the 5 files. Screen readers now announce all inline errors.

### D2. 3 components use ad-hoc `<p>` instead of `LoadingStateMessage`

`DashboardPage.tsx:113`, `AdminApiServiceBindingsPanel.tsx:125`, `FeedbackNewsSticky.tsx:153` — missing `role="status"` and `aria-live="polite"` that the canonical primitive provides.

---

## E. Listing Patterns — DRY

### E1. 3 admin pages manually replicate `ListingTableSection` gating logic

`AdminUsersPage.tsx`, `AdminModelsPage.tsx`, `AdminApiServicesPage.tsx` implement inline loading/error/empty/table gating, duplicating the logic that `ListingTableSection` encapsulates. If the contract changes, 3 files must be updated.

### E2. `useAdminModelsMutations.ts:88` uses raw `fetch()` for DELETE

All other mutations use `requestVoid()` from the typed HTTP client. This is the only exception, bypassing error normalization and type safety.

---

## F. `FeedbackChannel` — Duplicated and disconnected type

`FeedbackMessageProvider.tsx:4` defines `FeedbackChannel = 'global'` (1 value only).
`feedback-channel-map.ts:11` defines `FeedbackChannel = 'inline-action' | 'page-state' | 'global'` (3 values).

These are **two separate type declarations with the same name**. The channel map (`resolveFeedbackChannel`) is never imported by the provider. The map is an aspirational specification, not active routing logic. The provider supports only `publishSuccess`/`publishError` (2 of 4 declared severity levels).

---

## Intervention Priority

| # | Area | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Fix missing `ui-badge-*` CSS (C4) | Broken UX — invisible badges | Low | **resolved** — `ToolStepCard` now uses `StatusBadge` component |
| 2 | Fix `artifactsReloadError` not rendered (C5) | Silent error | Low | **resolved** — error now passed to Workflow Panel |
| 3 | Fix missing `role="alert"` (D1) | Accessibility | Low | **resolved** — added to all 7 error renderings |
| 4 | Unify error classes `.ui-error` vs `.ui-fv-error` (C2) | Visual determinism | Low | **resolved** — `.ui-fv-error` removed, all use `uiPrimitives.error` |
| 5 | Converge hardcoded copy to `appCopy` (B1) | UX determinism / maintainability | Medium | **partial** — `UserReportSubmissionPage` converged; remaining items open |
| 6 | Fix report category label bug (B3) — `'Issue'` vs `'Bug'` | Deterministic UX bug | Low | **resolved** — uses `appCopy.ui.feedbackCenterOptions.categories` |
| 7 | Align copy language (B2) | UX consistency | Medium | open |
| 8 | Explicit error states in machines (A1) | State determinism | Medium-High | open |
| 9 | Remove machine dead code (A4) + unused `tool-flow.machine.ts` (A5) | Cleanup | Low | open |
| 10 | Unify button system (C1) | UI determinism | Medium-High | open |
| 11 | Wire `feedback-channel-map` to provider (F) | Infrastructure completeness | Medium | open |
| 12 | Migrate 3 admin pages to `ListingTableSection` (E1) | DRY | Medium | open |

---

## Resolution Delta (2026-06-06)

Interventions 1-6 completed in a single pass. Files modified:

| File | Changes |
|---|---|
| `features/tools/ui/ToolStepCard.tsx` | Replaced `ui-badge-*` (no CSS) with `StatusBadge` component; added `role="alert"` to step error |
| `features/tools/ui/ToolPageTemplate.tsx` | Destructured `artifactsReloadError`; passed to Workflow Panel `errorMessage`; added `role="alert"` to `dispatchError` |
| `features/tools/ui/ToolGenerationFlowVertical.tsx` | Replaced `"ui-fv-error"` with `uiPrimitives.error` |
| `features/tools/ui/ToolFormComponents.tsx` | Added `role="alert"` to 3 error renderings (project, briefing, warnings) |
| `features/auth/ui/LoginForm.tsx` | Added `role="alert"` to login error |
| `features/projects/pages/NewProjectPage.tsx` | Added `role="alert"` to form root error |
| `features/feedback-center/pages/UserReportSubmissionPage.tsx` | Removed local `USER_REPORT_CATEGORY_OPTIONS`; uses `appCopy.ui.feedbackCenterOptions.categories`; `publishSuccess` uses `appCopy.ui.feedback.userReportSubmitted` |
| `styles.css` | Removed `.ui-fv-error` rule (superseded by `.ui-error`) |
| `features/tools/ui/ToolPageTemplate.test.tsx` | Updated assertion: `dispatchError` now has `role="alert"` |
| `features/feedback-center/pages/UserReportSubmissionPage.test.tsx` | Updated expected copy to `appCopy.ui.feedback.userReportSubmitted` |

Verification: typecheck clean, 400/400 tests pass, build succeeds.
