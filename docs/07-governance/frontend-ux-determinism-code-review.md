---
status: active
version: 1.2
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

### A1. Error strings instead of explicit error states (3 machines) — OPEN

| Machine | Flag | Location |
|---|---|---|
| `tool-page.machine.ts` | `generationError: string \| null` | `tool-page.types.ts:23` |
| `briefing-upload.machine.ts` | `error: string \| null` | context:30 |
| `auth-session.machine.ts` | `error: string \| null` | context:13 |

Machines with better error handling (`generation-lifecycle`, `frontend-stream`, `feedback-center`) use explicit error states. The others hide sub-states inside `context.error !== null`, making UX behavior non-deterministic from state alone — the same `idle` or `unauthenticated` state covers both "clean" and "error" conditions.

**Recommendation**: Introduce child states (`idle.error`, `unauthenticated.error`) or orthogonal regions for error. This makes the UI transition to/from error a traceable machine event, not a flag derivation. Requires significant machine restructuring — deferred.

### A2. Inline guards duplicating named guards (2 machines)

- `tool-flow.machine.ts:197,208` — duplicate `isCurrentStepEvent` + `hasNextStep`
- `generation-lifecycle.machine.ts:97` — duplicate `isCurrentStepDone` + `hasNextStep`

**Recommendation**: Use `and(['isCurrentStepDone', 'hasNextStep'])` to compose existing guards. Eliminates drift risk when logic changes.

### A3. Dual-write viewModel in `tool-page.machine.ts` actions

`setGenerationError` (line 96) and `updateNonStreamingProgress` (line 135) simultaneously update raw context fields AND rebuild the `viewModel`. If a future code path updates one without the other, the viewModel becomes stale.

**Recommendation**: Derive `viewModel` reactively (pure selector on context) instead of dual-writing in actions.

### A4. Dead code in machines — RESOLVED

~~| File | Line | Element |
|---|---|---|
| `tool-page.machine.ts` | 96 | `setGenerationError` — defined but never used in any transition |
| `frontend-generation.machine.ts` | 38-39 | `GENERATION_SUCCESS`/`GENERATION_FAILURE` — event types declared but never used |
| `frontend-stream.machine.ts` | 153 | `isMonotonicSequence` — guard defined but never referenced |
| `frontend-stream.machine.ts` | 169 | `isTerminalForActiveArtifact` — guard defined but never referenced |~~

**RESOLVED** — All dead code removed from `tool-page.machine.ts`, `frontend-generation.machine.ts`, `frontend-stream.machine.ts`.

### A5. `tool-flow.machine.ts` — unused machine actor — RESOLVED

~~`generation-lifecycle.machine.ts` has replaced `tool-flow.machine.ts`, which remains in the codebase with tests but no runtime consumer.~~

**RESOLVED** — `toolFlowMachine` removed from `tool-page.machine.ts` actors registration and import. The file `tool-flow.machine.ts` is retained because it exports canonical types (`SupportedTool`, `ToolStep`, `ToolStepStatus`, `toolStepOrder`) consumed by 20+ files. Only the unused actor registration was removed.

### A6. Pull-based cross-machine coupling

`briefing-upload.machine.ts:33-53` exports `hasReadyBriefingExtractionContext` which reads directly into the child actor's snapshot. If the child context shape changes, this function breaks silently. A push-based pattern (child sends event to parent on readiness change) would be more robust.

### A7. Missing `onError` on invoked actor

`tool-page.machine.ts:360-372`: the `generationLifecycleMachine` invoke has `onDone` but no `onError`. An unexpected child crash would not be caught.

---

## B. Copy Centralization

### B1. ~100+ hardcoded strings in components — PARTIALLY RESOLVED

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
| Feedback center | `UserReportSubmissionPage.tsx:84` | `"Report submitted successfully."` vs `appCopy.ui.feedback.userReportSubmitted` | **resolved** |
| ToolFormComponents | `ToolFormComponents.tsx:34,101,151` | `"Select a project"`, `"No models available"`, `"waiting for dependencies"` | **resolved** |
| NewProjectPage | `NewProjectPage.tsx:13` | `'Project name is required'` | **resolved** |

### B2. Language inconsistency — RESOLVED

~~| Copy section | Language |
|---|---|
| `appCopy.ui.fallbackErrors.*` | All English |
| `appCopy.ui.feedback.*` | All Italian |
| `appCopy.ui.states.*` | Mixed (`completed`/`pending` in English, loading list in Italian) |
| `appCopy.ui.toolPage.form.*` | Mixed (`projectLabel` Italian, `campaignObjective*` English) |
| Admin form labels | English (`Email`, `Role`, `Status`, `Key`, `Label`) |
| Zod validation messages | Mixed (`LoginForm`: Italian, `NewProjectPage`: English) |~~

**RESOLVED** — All `appCopy` sections aligned to Italian: `fallbackErrors.*`, `states.completed/pending/present/missing`, `meta.*` labels, `toolPage.form.*` labels, `toolPage.flow.ariaRegionLabel/ariaContextFilesLabel`. `ToolFormComponents` and `NewProjectPage` hardcoded strings converged to `appCopy`.

### B3. Duplicate definitions with different labels

~~`UserReportSubmissionPage.tsx:23-27` defines `USER_REPORT_CATEGORY_OPTIONS` with `{ value: 'issue', label: 'Issue' }`, while `appCopy.ui.feedbackCenterOptions.categories` has `{ value: 'issue', label: 'Bug' }`. Same value, different label — **deterministic UX bug**.~~

**RESOLVED** — Local `USER_REPORT_CATEGORY_OPTIONS` removed. Component now uses `appCopy.ui.feedbackCenterOptions.categories` as single source.

---

## C. UI Patterns — Unification

### C1. Two competing button systems — PARTIALLY RESOLVED

~~- `primitives.tsx` exports `Button` (native HTML with `ui-button` class)
- `CtaButtons.tsx` exports 3 MUI CTAs (`PrimaryCtaButton`, `SecondaryCtaButton`, `SoftCtaButton`)
- `UploadFieldButton.tsx`, `LoginForm.tsx`, all admin forms use MUI `Button` directly~~

**PARTIALLY RESOLVED** — `CtaButtons.tsx` applies variant-specific CSS classes: `PrimaryCtaButton` uses `uiPrimitives.button` (primary gradient styling), `SecondaryCtaButton` uses `ui-button-secondary` (outlined variant with subtle border), `SoftCtaButton` uses `ui-button-soft` (text variant, no border). MUI Button remains in use for form integrations (TextField, loading states) where native button lacks equivalent functionality. Full convergence to a single button system deferred — requires design system decision on MUI vs native strategy.

**Correction (2026-06-06)** — Initial Fix 10 incorrectly applied `ui-button` class to all CTA variants, causing secondary/soft buttons to inherit primary button styling (gradient background, light text). Fixed by applying variant-specific classes: only `PrimaryCtaButton` gets `ui-button`; secondary/soft buttons get their own styling classes that override visual properties while preserving MUI layout/typography.

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

### E1. 3 admin pages manually replicate `ListingTableSection` gating logic — OPEN

`AdminUsersPage.tsx`, `AdminModelsPage.tsx`, `AdminApiServicesPage.tsx` implement inline loading/error/empty/table gating, duplicating the logic that `ListingTableSection` encapsulates. If the contract changes, 3 files must be updated.

**Deferred** — Migration requires restructuring `AdminUsersTable` (inline editing rows), `LLMTable` (bordered-chip action convergence), and `AdminApiServicesTable` (selection + bindings panel). Each table has custom interaction patterns that do not fit the generic `ListingTableSection` column/cell model without significant refactoring.

### E2. `useAdminModelsMutations.ts:88` uses raw `fetch()` for DELETE

All other mutations use `requestVoid()` from the typed HTTP client. This is the only exception, bypassing error normalization and type safety.

---

## F. `FeedbackChannel` — Duplicated and disconnected type — RESOLVED

~~`FeedbackMessageProvider.tsx:4` defines `FeedbackChannel = 'global'` (1 value only).
`feedback-channel-map.ts:11` defines `FeedbackChannel = 'inline-action' | 'page-state' | 'global'` (3 values).

These are **two separate type declarations with the same name**. The channel map (`resolveFeedbackChannel`) is never imported by the provider. The map is an aspirational specification, not active routing logic. The provider supports only `publishSuccess`/`publishError` (2 of 4 declared severity levels).~~

**RESOLVED** — `FeedbackMessageProvider` now imports and re-exports `FeedbackChannel` from `feedback-channel-map.ts`, eliminating the duplicate type declaration. Added `publishInfo` and `publishWarning` methods to the provider, completing all 4 severity levels (`success`, `info`, `warning`, `error`). The channel map remains an aspirational routing specification; the provider continues to emit `channel: 'global'` for all messages.

---

## Intervention Priority

| # | Area | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Fix missing `ui-badge-*` CSS (C4) | Broken UX — invisible badges | Low | **resolved** |
| 2 | Fix `artifactsReloadError` not rendered (C5) | Silent error | Low | **resolved** |
| 3 | Fix missing `role="alert"` (D1) | Accessibility | Low | **resolved** |
| 4 | Unify error classes `.ui-error` vs `.ui-fv-error` (C2) | Visual determinism | Low | **resolved** |
| 5 | Converge hardcoded copy to `appCopy` (B1) | UX determinism / maintainability | Medium | **partial** — `UserReportSubmissionPage`, `ToolFormComponents`, `NewProjectPage` converged; admin forms/tables/dashboard/navigation open |
| 6 | Fix report category label bug (B3) | Deterministic UX bug | Low | **resolved** |
| 7 | Align copy language (B2) | UX consistency | Medium | **resolved** — all `appCopy` sections aligned to Italian |
| 8 | Explicit error states in machines (A1) | State determinism | Medium-High | open — requires machine restructuring |
| 9 | Remove machine dead code (A4) + unused actor (A5) | Cleanup | Low | **resolved** |
| 10 | Unify button system (C1) | UI determinism | Medium-High | **partial** — `CtaButtons` now carries `ui-button` class; full MUI/native convergence deferred |
| 11 | Wire `feedback-channel-map` to provider (F) | Infrastructure completeness | Medium | **resolved** — types aligned, `publishInfo`/`publishWarning` added |
| 12 | Migrate 3 admin pages to `ListingTableSection` (E1) | DRY | Medium | open — requires table restructuring |

---

## Resolution Delta (2026-06-06, pass 1)

Interventions 1-6 completed. Files modified:

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

---

## Resolution Delta (2026-06-06, pass 2)

Interventions 7, 9, 10, 11 completed. Findings 8 (A1) and 12 (E1) documented as open with deferral rationale.

| File | Changes |
|---|---|
| `features/tools/machines/tool-page.machine.ts` | Removed unused `toolFlowMachine` import and actor registration; removed dead `setGenerationError` action |
| `features/generation/machines/frontend-generation.machine.ts` | Removed unused `GENERATION_SUCCESS`/`GENERATION_FAILURE` event types |
| `features/generation/machines/frontend-stream.machine.ts` | Removed unused `isMonotonicSequence` and `isTerminalForActiveArtifact` guards |
| `app/providers/FeedbackMessageProvider.tsx` | Aligned `FeedbackChannel` type to import/re-export from `feedback-channel-map.ts`; added `publishInfo` and `publishWarning` methods |
| `app/ui/CtaButtons.tsx` | Added variant-specific CSS classes: `PrimaryCtaButton` uses `uiPrimitives.button`, `SecondaryCtaButton` uses `ui-button-secondary`, `SoftCtaButton` uses `ui-button-soft` |
| `styles.css` | Added `.ui-button-soft` CSS class for text variant buttons |
| `app/copy/system.ts` | Aligned all English sections to Italian: `fallbackErrors.*`, `states.completed/pending/present/missing`, `meta.*` labels, `toolPage.form.*` labels, `toolPage.flow.ariaRegionLabel/ariaContextFilesLabel`, `toolPage.headingMetaSuffix` |
| `features/tools/ui/ToolFormComponents.tsx` | Replaced hardcoded `"Select a project"`, `"No models available"`, `"waiting for dependencies"` with `appCopy` references |
| `features/projects/pages/NewProjectPage.tsx` | Replaced hardcoded `'Project name is required'` with `appCopy` reference |
| `features/tools/ui/ToolGenerationFlowVertical.test.tsx` | Updated aria label query to Italian (`'Flusso di generazione'`) |
| `features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx` | Updated combobox queries to Italian (`/progetto/i`, `/modello/i`, `/tono/i`) |
| `features/tools/ui/ToolPageTemplate.meta-ads-flow.e2e.test.tsx` | Updated combobox query to Italian (`/obiettivo campagna/i`) |
| `features/tools/ui/ToolPageTemplate.meta-ads-objective.test.tsx` | Updated combobox queries to Italian (`/obiettivo campagna/i`) |

Verification: typecheck clean, 400/400 tests pass, build succeeds.

---

## Correction (2026-06-06, post-pass 2)

**Issue**: Fix 10 (pass 2) incorrectly applied `ui-button` CSS class to all 3 CTA button variants (`PrimaryCtaButton`, `SecondaryCtaButton`, `SoftCtaButton`). The `.ui-button` class defines primary button styling (gradient background, light text color, shadow) which overrode MUI's `variant="outlined"` and `variant="text"` styling, making secondary/soft buttons visually identical to primary buttons with poor text visibility.

**Fix**: 
- `PrimaryCtaButton` retains `uiPrimitives.button` (`ui-button` class) for primary gradient styling
- `SecondaryCtaButton` uses `ui-button-secondary` class (transparent background, subtle border, muted text)
- `SoftCtaButton` uses new `ui-button-soft` class (transparent background, no border, muted text)
- Added `.ui-button-soft` CSS class to `styles.css`

**Files modified**:
- `app/ui/CtaButtons.tsx` — variant-specific CSS class application
- `styles.css` — added `.ui-button-soft` and `.ui-button-soft:hover` rules

Verification: typecheck clean, 400/400 tests pass.

### Open findings (deferred)

| # | Finding | Rationale |
|---|---|---|
| 8 (A1) | Explicit error states in 3 machines | Requires restructuring `tool-page.machine.ts`, `briefing-upload.machine.ts`, `auth-session.machine.ts` context and state definitions. High regression risk. |
| 12 (E1) | Migrate 3 admin pages to `ListingTableSection` | `AdminUsersTable` (inline editing), `LLMTable` (action patterns), `AdminApiServicesTable` (selection + bindings panel) have custom interaction models that don't fit generic `ListingTableSection` without significant refactoring. |
| 5 (B1) | Remaining hardcoded strings | Admin forms, admin tables, admin dashboard, admin navigation, YouTube Description form, `ToolActionButtons` — all have hardcoded strings not yet centralized in `appCopy`. Non-blocking, incremental convergence. |
| 10 (C1) | Full button system convergence | MUI Button remains necessary for form integrations (TextField, loading states). Full native/MUI convergence requires design system decision. |
