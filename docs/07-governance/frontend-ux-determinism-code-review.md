---
status: active
version: 1.3
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

**Recommendation**: Introduce child states (`idle.error`, `unauthenticated.error`) or orthogonal regions for error. This makes the UI transition to/from error a traceable machine event, not a flag derivation. Requires significant machine restructuring — deferred. See [Detailed Blocker Analysis](#finding-8-a1--explicit-error-states-in-machines--open) for per-machine technical blockers.

### A2. Inline guards duplicating named guards (2 machines) — OPEN

- `tool-flow.machine.ts:197,208` — duplicate `isCurrentStepEvent` + `hasNextStep`
- `generation-lifecycle.machine.ts:97` — duplicate `isCurrentStepDone` + `hasNextStep`

**Recommendation**: Use `and(['isCurrentStepDone', 'hasNextStep'])` to compose existing guards. Eliminates drift risk when logic changes. Low effort, no blocker.

### A3. Dual-write viewModel in `tool-page.machine.ts` actions — OPEN

`updateNonStreamingProgress` (line 124) simultaneously updates raw context fields AND rebuilds the `viewModel`. If a future code path updates one without the other, the viewModel becomes stale.

**Recommendation**: Derive `viewModel` reactively (pure selector on context) instead of dual-writing in actions. Tied to finding A1 — resolving error states would naturally lead to reactive viewModel derivation.

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

### A6. Pull-based cross-machine coupling — OPEN

`briefing-upload.machine.ts:33-53` exports `hasReadyBriefingExtractionContext` which reads directly into the child actor's snapshot. If the child context shape changes, this function breaks silently. A push-based pattern (child sends event to parent on readiness change) would be more robust. Tied to finding A1 — resolving error states in `briefing-upload.machine.ts` would naturally address this coupling.

### A7. Missing `onError` on invoked actor — OPEN

`tool-page.machine.ts:360-372`: the `generationLifecycleMachine` invoke has `onDone` but no `onError`. An unexpected child crash would not be caught. Low effort fix — add `onError` handler that transitions to `configuring` with error message.

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

See [Detailed Blocker Analysis](#finding-5-b1--hardcoded-copy-residuals--partial) for per-area string counts and specific blockers.

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

**PARTIALLY RESOLVED** — `CtaButtons.tsx` applies variant-specific CSS classes: `PrimaryCtaButton` uses `uiPrimitives.button` (primary gradient styling), `SecondaryCtaButton` uses `ui-button-secondary` (outlined variant with subtle border), `SoftCtaButton` uses `ui-button-soft` (text variant, no border). MUI Button remains in use for form integrations (TextField, loading states) where native button lacks equivalent functionality. Full convergence to a single button system deferred — requires design system decision on MUI vs native strategy. See [Detailed Blocker Analysis](#finding-10-c1--button-system-unification--partial) for technical blockers.

**Correction (2026-06-06)** — Initial Fix 10 incorrectly applied `ui-button` class to all CTA variants, causing secondary/soft buttons to inherit primary button styling (gradient background, light text). Fixed by applying variant-specific classes: only `PrimaryCtaButton` gets `ui-button`; secondary/soft buttons get their own styling classes that override visual properties while preserving MUI layout/typography.

### C2. Two visually distinct error CSS classes

~~| Class | Style | Usage |
|---|---|---|
| `.ui-error` (`uiPrimitives.error`) | Full border | ToolPageTemplate, ToolStatusCard, form errors |
| `.ui-fv-error` | Left accent border | `ToolGenerationFlowVertical.tsx:283` |

Same semantic meaning (inline error), different visual rendering. The user sees errors with different styles depending on which page section they are in.~~

**RESOLVED** — `.ui-fv-error` replaced with `uiPrimitives.error` in `ToolGenerationFlowVertical.tsx`. CSS rule removed from `styles.css`. All inline errors now use the same visual style.

### C3. 173+ ad-hoc CSS classes not in `uiPrimitives` — OPEN

Classes like `ui-tool-page-template`, `ui-fv-root`, `ui-admin-kpi-widget-card`, `ui-artifact-page-layout` are defined in CSS but referenced as raw strings in components. Refactoring/renaming is fragile. Low priority — no functional impact, only maintainability concern. Would require systematic audit and addition to `uiPrimitives` constant.

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

### D2. 3 components use ad-hoc `<p>` instead of `LoadingStateMessage` — OPEN

`DashboardPage.tsx:113`, `AdminApiServiceBindingsPanel.tsx:125`, `FeedbackNewsSticky.tsx:153` — missing `role="status"` and `aria-live="polite"` that the canonical primitive provides. No technical blocker — mechanical 3-line fix. See [Detailed Blocker Analysis](#finding-d2--ad-hoc-p-loading-states--open).

---

## E. Listing Patterns — DRY

### E1. 3 admin pages manually replicate `ListingTableSection` gating logic — OPEN

`AdminUsersPage.tsx`, `AdminModelsPage.tsx`, `AdminApiServicesPage.tsx` implement inline loading/error/empty/table gating, duplicating the logic that `ListingTableSection` encapsulates. If the contract changes, 3 files must be updated.

**Deferred** — Migration requires restructuring `AdminUsersTable` (inline editing rows), `LLMTable` (bordered-chip action convergence), and `AdminApiServicesTable` (selection + bindings panel). Each table has custom interaction patterns that do not fit the generic `ListingTableSection` column/cell model without significant refactoring. See [Detailed Blocker Analysis](#finding-12-e1--admin-page-migration-to-listingtablesection--open) for per-table technical blockers.

### E2. `useAdminModelsMutations.ts:88` uses raw `fetch()` for DELETE — OPEN

All other mutations use `requestVoid()` from the typed HTTP client. This is the only exception, bypassing error normalization and type safety. No technical blocker — `admin-client.ts` already has a `deleteAdminModel` function. See [Detailed Blocker Analysis](#finding-e2--raw-fetch-for-delete--open).

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
| 10 | Unify button system (C1) | UI determinism | Medium-High | **partial** — `CtaButtons` variant-specific classes applied; full MUI/native convergence deferred |
| 11 | Wire `feedback-channel-map` to provider (F) | Infrastructure completeness | Medium | **resolved** — types aligned, `publishInfo`/`publishWarning` added |
| 12 | Migrate 3 admin pages to `ListingTableSection` (E1) | DRY | Medium | open — requires table restructuring |
| 13 | Fix ad-hoc `<p>` loading states (D2) | Accessibility | Low | open — mechanical 3-line fix |
| 14 | Replace raw `fetch()` DELETE (E2) | Type safety | Low | open — `deleteAdminModel` exists |

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

---

## Open Findings — Detailed Blocker Analysis

### Finding #5 (B1) — Hardcoded Copy Residuals — PARTIAL

**Remaining scope**: ~80+ hardcoded strings across admin and tool components.

**Blocker breakdown by area**:

| Area | Files | String count | Specific blocker |
|---|---|---|---|
| Admin forms | `AdminModelCreateForm.tsx`, `AdminUserCreateForm.tsx`, `AdminUserEditForm.tsx`, `AdminChangelogPublishForm.tsx` | ~25 | Labels, placeholders, busy-state text (`"Creazione..."`, `"Salvataggio..."`), and form titles. Requires adding ~25 keys to `appCopy.ui.adminModels.*`, `appCopy.ui.adminUsers.*`, `appCopy.ui.adminChangelog.*` |
| Admin tables | `LLMTable.tsx`, `ActivityLogTable.tsx`, `ReportsTable.tsx`, `ChangelogTable.tsx` | ~20 | Hardcoded column headers (`"Key"`, `"Label"`, `"Status"`, `"Azioni"`, etc.). `AdminApiServicesTable` already uses `appCopy` — the other 4 do not |
| Admin dashboard | `AdminDashboardPage.tsx` | ~12 | 4 KPI widgets with title + hint + 4 states (`loading`/`empty`/`error`/`ready`) all hardcoded |
| Admin navigation | `admin-navigation.ts` | 14 | 7 labels + 7 descriptions defined locally instead of in `appCopy.ui.navigation.*` |
| Tool buttons | `ToolActionButtons.tsx` | 8 | `"Riprova"`, `"Salta step"`, `"Annulla"`, `"Artefatto precedente"` + 4 `title` tooltips |
| YouTube Description form | `ToolPageTemplate.tsx:636-821` | 9 | Field labels (`"Video title"`, `"Topic"`, `"Keywords"`, etc.) hardcoded in English |

**Why not blocking**: None of these strings cause UX bugs. All are readable and functional. The cost is purely maintainability — if a label changes, it must be searched in the component instead of `appCopy`.

**Why requires incremental work**: Each area requires (a) defining keys in `appCopy`, (b) replacing strings in components, (c) updating tests that query by text. This is not an atomic change — it must be done per area to contain risk.

---

### Finding #8 (A1) — Explicit Error States in Machines — OPEN

**Remaining scope**: 3 machines use `error: string | null` in context instead of explicit machine states.

**Technical blockers per machine**:

#### `tool-page.machine.ts` — `generationError: string | null`

The context has `generationError` which is read by the `viewModel` builder (`tool-page-view-model.ts`) to derive `canonicalState = 'paused-with-checkpoint'`. The problem:

1. **Dual-write viewModel**: Actions `setGenerationError` and `updateNonStreamingProgress` write both the raw field and the viewModel. If a future action updates `generationError` without rebuilding the viewModel, the two desynchronize.
2. **Required refactoring**: To resolve, would need to (a) eliminate `generationError` from context, (b) model a child state `configuring.with-error` or `generating.with-error`, (c) derive the viewModel from a pure selector that reads machine state instead of a context field. This changes the context shape and the contract with ~15 files that read `toolPageSnapshot.context.generationError`.
3. **High regression risk**: `tool-page.machine.ts` is the frontend aggregate root — 395 lines, 7 machine helpers connected, ~20 tests. Any context shape change requires cascading updates.

#### `briefing-upload.machine.ts` — `error: string | null`

The machine has 5 states (`idle`, `validating`, `uploading`, `extracting`, `ready`) and errors are set as strings in context while the machine returns to `idle`. The problem:

1. **`idle` hides 3 sub-states**: (a) no file selected, (b) file selected with error, (c) file selected without error. These are distinguishable only by checking `context.error !== null` and `context.file !== null`.
2. **Required refactoring**: Would need child states `idle.empty`, `idle.with-file`, `idle.with-error`, or an orthogonal region for error.
3. **Pull-based coupling**: The exported function `hasReadyBriefingExtractionContext` (line 33) reads directly into the child actor's snapshot. If the context shape changes, this function breaks silently.

#### `auth-session.machine.ts` — `error: string | null`

The machine has states `bootstrapping`, `authenticated`, `unauthenticated`, `authenticating`, `loggingOut`, `refreshing`. Login/bootstrap errors are set as strings while the machine is in `unauthenticated`. The problem:

1. **`unauthenticated` hides 2 sub-states**: (a) no attempt made, (b) failed attempt with error. The same state covers both.
2. **Required refactoring**: Would need `unauthenticated.idle` and `unauthenticated.error`, or an orthogonal region.
3. **Low impact**: This machine is relatively isolated (206 lines, no child actors). Would be the simplest candidate for refactoring, but not prioritized because the UX behavior is already deterministic — errors are always displayed when present.

---

### Finding #10 (C1) — Button System Unification — PARTIAL

**Remaining scope**: Full convergence between MUI Button and native Button.

**Technical blockers**:

1. **Two systems coexist by functional necessity**:
   - `primitives.tsx` exports `Button` (native HTML with `ui-button` class) — used for simple CTAs
   - `CtaButtons.tsx` exports `PrimaryCtaButton`/`SecondaryCtaButton`/`SoftCtaButton` (MUI Button with canonical CSS classes) — used where MUI form integration, loading states, icons are needed
   - `UploadFieldButton.tsx`, `LoginForm.tsx`, all admin forms use MUI `Button` directly — because they use `<TextField>`, `disabled` binding, `startIcon`, etc.

2. **Why MUI Button cannot simply be removed**: MUI Button has functionality that native Button lacks: integration with `TextField` (select), `loading` prop, `startIcon`/`endIcon`, theming with `color="inherit"`, `size="small"`. `DashboardPage.tsx:127` uses `<Button color="inherit" size="small" variant="text">` for recent sessions — not replicable with native Button without losing visual consistency with other MUI elements on the same page.

3. **Why native Button cannot simply be removed**: The native Button with `ui-button` is the canonical pattern defined in the UI spec (Section 4b). It's used in `ToolPageTemplate`, `ToolGenerationFlowVertical`, `UserReportSubmissionPage`, and all admin table bordered-chips. Replacing it with MUI Button would add ~15KB more MUI bundle and break the `ui-button` / `ui-button-secondary` / `ui-button-soft` pattern.

4. **Design system decision required**: Full convergence requires a design system-level decision: (a) adopt MUI as the single button system and redefine `ui-button` as an MUI wrapper, or (b) adopt native Button as the single system and reimplement missing MUI functionality. Both options impact 50+ files.

**What was done**: `CtaButtons.tsx` now applies variant-specific CSS classes (`ui-button` for primary, `ui-button-secondary` for outlined, `ui-button-soft` for text). This ensures MUI CTAs have the same appearance as canonical native buttons. The residual gap is only in files that import MUI `Button` directly.

---

### Finding #12 (E1) — Admin Page Migration to `ListingTableSection` — OPEN

**Remaining scope**: `AdminUsersPage`, `AdminModelsPage`, `AdminApiServicesPage` manually replicate loading/error/empty/table gating.

**Technical blockers per table**:

#### `AdminUsersTable` — Inline editing rows

`AdminUsersTable` is not a simple read-only table. Each row (`AdminUserTableRow`) can expand into an inline edit form:

```tsx
<tr>... user data ...</tr>
{isEditing ? <tr><td colSpan={5}><AdminUserEditForm ... /></td></tr> : null}
```

`ListingTableSection` uses a `renderCell(row, columnKey)` model that renders one cell at a time. It does not support expanded rows with `colSpan`. To migrate `AdminUsersTable` would require:
- Extending `ListingTableSection` with a `renderExpandedRow?: (row) => ReactNode` prop
- Or abandoning `ListingTableSection` for this table and accepting the duplication

#### `LLMTable` — Hardcoded column headers

`LLMTable` has hardcoded headers (`"Key"`, `"Label"`, `"Status"`, `"Default"`, `"Azioni"`) instead of using `ListingTableColumn[]`. Migration is simple for the table structure, but requires:
- Defining a `columns` array with the 5 columns
- Implementing `renderCell` with a switch on `columnKey`
- Replacing `AdminModelTableRow` with inline rendering logic

The real blocker is that `AdminModelTableRow` uses `formatMeta`, `StatusBadge`, and 3 bordered-chip actions (`Predefinito`, `Abilita`/`Disabilita`, `Elimina`). Migration doesn't change behavior but requires complete rendering rewrite.

#### `AdminApiServicesTable` — Selection + bindings panel

`AdminApiServicesTable` has two special patterns:
1. **Row selection**: `selectedApiServiceId` highlights the selected row with `uiPrimitives.artifactRowSelected`. `ListingTableSection` does not support row selection.
2. **Bindings panel**: The selected row opens a bindings panel below the table (`AdminApiServiceBindingsPanel`). This selection → external panel coupling is not supported by `ListingTableSection`.

To migrate would require extending `ListingTableSection` with `onRowClick`, `selectedRowKey`, and an `afterTableNode` slot for the bindings panel. These extensions would make `ListingTableSection` more complex than the benefit obtained.

---

### Finding #D2 — Ad-hoc `<p>` Loading States — OPEN

**Remaining scope**: `role="status"` and `aria-live="polite"` missing on 3 loading states.

| File | Line | Hardcoded text |
|---|---|---|
| `DashboardPage.tsx` | 113 | `"Caricamento sessioni..."` |
| `AdminApiServiceBindingsPanel.tsx` | 125 | `appCopy.ui.states.loadingList` |
| `FeedbackNewsSticky.tsx` | 153 | `appCopy.ui.feedbackCenter.loadingChangelog` |

**Blocker**: None technical — this is a mechanical 3-line fix. Was not included in previous fix batches because it was not in the initial priority (D1 intervention only covered `role="alert"`). Candidate for the next batch of quick fixes.

---

### Finding #E2 — Raw `fetch()` for DELETE — OPEN

**Remaining scope**: The only mutation that bypasses the typed HTTP client.

```typescript
// useAdminModelsMutations.ts:88-96
const res = await fetch(joinApiPath(apiBaseUrl, `/api/admin/models/${model.id}`), {
  method: 'DELETE',
  credentials: 'include',
});
if (!res.ok) {
  const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
  throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
}
```

All other mutations use `requestVoid()` from `http-client.ts` which automatically handles `credentials`, error normalization, and typed `HttpClientRequestError`.

**Blocker**: None technical — `admin-client.ts` already has a `deleteAdminModel` function that uses `requestVoid`. The fix is to replace the 12 lines of manual `fetch` with `await deleteAdminModel(model.id, { apiBaseUrl })`. Was not included because it was not in the initial priority. Candidate for the next batch of quick fixes.

---

## Blocker Summary by Resolvability

| # | Finding | Real blocker | Resolvability |
|---|---|---|---|
| 13 (D2) | Ad-hoc `<p>` loading | None — mechanical fix | Immediate |
| 14 (E2) | Raw `fetch()` for DELETE | None — `deleteAdminModel` exists | Immediate |
| 5 (B1) | Hardcoded copy residuals | Volume (~80 strings) + test updates | Incremental, per area |
| 10 (C1) | Two button systems | Design system decision required | Requires ADR |
| 8 (A1) | Machine error states | Context refactoring + viewModel + 15+ files | Requires dedicated sprint |
| 12 (E1) | Admin pages → `ListingTableSection` | Inline editing, row selection, bindings panel | Requires component extension or abandonment |
