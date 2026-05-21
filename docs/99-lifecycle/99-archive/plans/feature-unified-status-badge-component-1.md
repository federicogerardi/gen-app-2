---
goal: Unified StatusBadge component for all lifecycle/state status rendering in the frontend
version: 1.1
date_created: 2026-05-17
last_updated: 2026-05-21 (implementation verified end-to-end)
owner: frontend
status: Completed
tags: [feature, refactor, ui, frontend, design-system]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

The frontend renders entity status values (`ArtifactLifecycleStatus`, `AuthUserStatus`, model
status, changelog status, report status, etc.) as plain unstyled text in multiple table and list
views. There is no shared visual treatment for these semantic states. The goal is to introduce
a single `StatusBadge` component (shared UI layer) that maps any status string to a styled,
colour-coded pill badge, and to replace all plain-text status occurrences with it.

---

## 1. Requirements & Constraints

- **REQ-001**: The component must cover all status values currently rendered as plain text:
  - `ArtifactLifecycleStatus`: `generating | completed | failed`
  - `SessionSummary.status`: `generating | completed | failed`
  - `AuthUserStatus`: `active | disabled | pending_password_reset`
  - `AdminLlmModelRow.status`: `enabled | disabled`
  - `ProductChangelogStatus`: `draft | published`
  - `UserReportStatus`: `submitted | triaged | github-published | closed`
- **REQ-002**: Visual variants must communicate semantic meaning via colour:
  - `success` (green) — `completed`, `active`, `enabled`, `published`, `github-published`
  - `error` (red) — `failed`, `disabled`
  - `warning` (amber) — `pending_password_reset`
  - `info` (blue) — `generating`, `triaged`
  - `neutral` (gray) — `draft`, `submitted`, `closed`
- **REQ-003**: The component must support both light and dark theme via CSS custom properties already defined in `styles.css`.
- **REQ-004**: The component must live in `apps/frontend/src/app/ui/` (shared UI layer, no bounded-context dependency).
- **REQ-005**: Each call site must pass a `status` string; the component handles variant resolution internally via a lookup table.
- **REQ-006**: An optional `label` prop must override the displayed text (for localised strings, e.g. `SessionsListingSection` already maps session statuses to Italian strings).
- **CON-001**: Do NOT rename or refactor the underlying domain types — this is a pure UI-layer change.
- **CON-002**: Do NOT edit files outside `apps/frontend/src/` for this task.
- **CON-003**: The CSS for the badge must use existing CSS custom property tokens (`--badge-success-*`, `--error-*`, `--workspace-blue*`, `--text-muted`, etc.) — no new design tokens unless strictly necessary.
- **GUD-001**: Add the CSS class token to `uiPrimitives` in `primitives.tsx` following the existing pattern.
- **GUD-002**: Keep `StatusBadge` a pure presentational component — no hooks, no context reads.
- **PAT-001**: Follow the polymorphic primitive pattern already used in `primitives.tsx` (e.g. `Surface`, `Stack`).

---

## 2. Implementation Steps

### Implementation Phase 1 — CSS Tokens & Base Badge Style

- GOAL-001: Add the `.ui-status-badge` base class and per-variant modifier classes to `styles.css`, reusing existing CSS custom properties.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add CSS variables for missing semantic badge colours in `:root` (warning amber, info blue, neutral muted) in `styles.css` — mirror the existing `--badge-success-*` pattern | yes | 2026-05-21 |
| TASK-002 | Add the same variables for `[data-theme='dark']` overrides in `styles.css` | yes | 2026-05-21 |
| TASK-003 | Add `.ui-status-badge` base class (pill shape, mono font, uppercase, 11px) with `.ui-status-badge--success`, `--error`, `--warning`, `--info`, `--neutral` modifier classes in `styles.css` | yes | 2026-05-21 |
| TASK-003b | Remove dead CSS in `styles.css:1202-1228`: delete `.ui-artifact-status-tag`, `.ui-artifact-status-tag.is-completed`, `.ui-artifact-status-tag.is-failed`, `.ui-artifact-status-tag.is-generating` — these are superseded by `StatusBadge`. Run after all call-site replacements (Phase 3) are complete | yes | 2026-05-21 |

### Implementation Phase 2 — StatusBadge Component & Primitives

- GOAL-002: Create the `StatusBadge` React component and register its CSS token in `uiPrimitives`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Add `statusBadge: 'ui-status-badge'` entry to `uiPrimitives` object in `apps/frontend/src/app/ui/primitives.tsx` | yes | 2026-05-21 |
| TASK-005 | Create `apps/frontend/src/app/ui/StatusBadge.tsx` with: type `StatusBadgeVariant = 'success' \| 'error' \| 'warning' \| 'info' \| 'neutral'`; a `STATUS_VARIANT_MAP` lookup table covering all status values in REQ-001; props `{ status: string; label?: string; className?: string }`; renders `<span className={cx(uiPrimitives.statusBadge, 'ui-status-badge--' + variant, className)}>{label ?? status}</span>` | yes | 2026-05-21 |

### Implementation Phase 3 — Call-Site Replacement

- GOAL-003: Replace all plain-text status rendering with `<StatusBadge status={...} />`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | `apps/frontend/src/features/artifacts/ui/ArtifactsListingSection.tsx` — replace `artifact.status` plain string (line 177) with `<StatusBadge status={artifact.status} />` | yes | 2026-05-21 |
| TASK-006b | `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx:232` — replace `<span className={`ui-runtime-badge ui-artifact-status-tag is-${artifact.status}`}>{artifact.status}</span>` with `<StatusBadge status={artifact.status} />` and remove the `.ui-runtime-badge ui-artifact-status-tag` className coupling | yes | 2026-05-21 |
| TASK-006c | `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx:198-199` — replace `<span className={`ui-runtime-badge ui-artifact-status-tag is-${group.status}`}>{group.status}</span>` with `<StatusBadge status={group.status} />` and remove the `.ui-runtime-badge ui-artifact-status-tag` className coupling | yes | 2026-05-21 |
| TASK-007 | `apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx` — (a) replace `<span>{artifact.status}</span>` (line 122) in the list row with `<StatusBadge status={artifact.status} />`; (b) line 137 uses `formatMeta(appCopy.ui.labels.status.toLowerCase(), selectedArtifact.status)` which returns a plain `string` — replace the entire `<p>` with `<p className={uiPrimitives.metaLine}><span>{appCopy.ui.labels.status}: </span><StatusBadge status={selectedArtifact.status} /></p>` to avoid passing JSX into a string-returning function | yes | 2026-05-21 |
| TASK-008 | `apps/frontend/src/features/admin/activity/ActivityLogTable.tsx` — replace `<span className={uiPrimitives.metaLine}>{item.status}</span>` (line 26) with `<StatusBadge status={item.status} />` | yes | 2026-05-21 |
| TASK-009 | `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx` — replace `statusLabel(session.status)` plain string (line 125) with `<StatusBadge status={session.status} label={statusLabel(session.status)} />` so the Italian label is shown but the variant is resolved from the raw status | yes | 2026-05-21 |
| TASK-010 | `apps/frontend/src/features/admin/ui/AdminUserTableRow.tsx:43` — `formatMeta('Status', user.status)` returns a plain `string` and cannot wrap JSX. Replace `<td>{formatMeta('Status', user.status)}</td>` with `<td><StatusBadge status={user.status} /></td>` (the column header already reads "Status", so the label prefix is redundant) | yes | 2026-05-21 |
| TASK-011 | `apps/frontend/src/features/admin/llm/LLMTable.tsx` / `AdminModelTableRow.tsx` — replace `{model.status}` (line 23 of `AdminModelTableRow.tsx`) with `<StatusBadge status={model.status} />` | yes | 2026-05-21 |
| TASK-012 | `apps/frontend/src/features/admin/changelog/ChangelogTable.tsx` — replace `row.status` plain string (line 44) with `<StatusBadge status={row.status} />` | yes | 2026-05-21 |
| TASK-013 | `apps/frontend/src/features/admin/reports/ReportsTable.tsx` — replace `row.status` plain string (line 53-55) with `<StatusBadge status={row.status} />` | yes | 2026-05-21 |

### Implementation Phase 4 — Validation

- GOAL-004: Verify the build passes and no TypeScript errors are introduced.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Run `npm --workspace apps/frontend run build` and confirm zero TypeScript/build errors | yes | 2026-05-21 |
| TASK-015 | Run existing frontend tests (`npm --workspace apps/frontend run test`) to confirm no regressions | yes | 2026-05-21 |

### As-Is Evidence Snapshot (2026-05-21)

- `StatusBadge` component exists at `apps/frontend/src/app/ui/StatusBadge.tsx`.
- `uiPrimitives.statusBadge` exists at `apps/frontend/src/app/ui/primitives.tsx`.
- Badge CSS classes exist at `apps/frontend/src/styles.css` (`.ui-status-badge*`).
- Call-site migration is completed, including sessions listing status rendering through `StatusBadge`.

---

## 3. Alternatives

- **ALT-001**: Use MUI `<Chip>` component — rejected because MUI is only used in specific tool-form parts; introducing it in the shared UI layer would increase the MUI coupling surface unnecessarily.
- **ALT-002**: Create one badge component per bounded context (e.g. `ArtifactStatusBadge`, `UserStatusBadge`) — rejected because the visual treatment is identical; a single component with a shared lookup table is the minimal-change approach that also future-proofs new status values.
- **ALT-003**: Encode variant as a prop passed by the call site — rejected because it forces each call site to know the design mapping, violating the "single source of truth" principle for semantic colour assignment.

---

## 4. Dependencies

- **DEP-001**: `apps/frontend/src/app/ui/primitives.tsx` — must be updated before `StatusBadge.tsx` is created (TASK-004 before TASK-005).
- **DEP-002**: `apps/frontend/src/styles.css` — CSS must be added (Phase 1) before the component is used in Phase 3.
- **DEP-003**: No new npm packages required.

---

## 5. Files

- **FILE-001**: `apps/frontend/src/styles.css` — add badge CSS variables and `.ui-status-badge` classes
- **FILE-002**: `apps/frontend/src/app/ui/primitives.tsx` — add `statusBadge` token to `uiPrimitives`
- **FILE-003**: `apps/frontend/src/app/ui/StatusBadge.tsx` — new component (create)
- **FILE-004**: `apps/frontend/src/features/artifacts/ui/ArtifactsListingSection.tsx` — replace status cell
- **FILE-004b**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` — replace status badge span (was using `.ui-artifact-status-tag`)
- **FILE-004c**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` — replace status badge span (was using `.ui-artifact-status-tag`)
- **FILE-005**: `apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx` — replace status spans
- **FILE-006**: `apps/frontend/src/features/admin/activity/ActivityLogTable.tsx` — replace status span
- **FILE-007**: `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx` — replace status cell
- **FILE-008**: `apps/frontend/src/features/admin/ui/AdminUserTableRow.tsx` — replace status cell
- **FILE-009**: `apps/frontend/src/features/admin/ui/AdminModelTableRow.tsx` — replace status cell
- **FILE-010**: `apps/frontend/src/features/admin/changelog/ChangelogTable.tsx` — replace status cell
- **FILE-011**: `apps/frontend/src/features/admin/reports/ReportsTable.tsx` — replace status cell

---

## 6. Testing

- **TEST-001**: `npm --workspace apps/frontend run build` passes with zero errors — verifies TypeScript types and import graph.
- **TEST-002**: Existing unit tests in `apps/frontend/src/` pass unchanged — verifies no regressions in logic.
- **TEST-003**: Manual smoke-test in browser (dev server): all table views show coloured badge pills for each status value, in both light and dark theme.

---

## 7. Risks & Assumptions

- **RISK-001**: Unknown status strings (e.g. future values added to the backend) will fall through to the `neutral` variant — acceptable degradation behaviour, no crash.
- **RISK-002**: The `formatMeta` helper in `ArtifactHistoryPanel.tsx` and `AdminUserTableRow.tsx` returns a plain `string` — it cannot receive JSX as its second argument. These call sites must render the label text and `<StatusBadge>` as separate siblings inside the `<p>` / `<td>`, not by passing JSX to `formatMeta`.
- **RISK-003**: `ArtifactDetailPage.tsx` and `SessionSummaryDetailPage.tsx` used `ui-runtime-badge` alongside `ui-artifact-status-tag` to achieve the badge pill shape. After migration, the `ui-runtime-badge` class must be removed from those `<span>` elements — keeping it would apply unrelated "API live" badge styling. The pill shape is fully handled by the new `.ui-status-badge` class.
- **ASSUMPTION-001**: The existing `.ui-runtime-badge` CSS class (used in the top bar for the API "live" indicator) will not be modified — it is a separate semantic concept from entity lifecycle status.
- **ASSUMPTION-002**: No i18n/localisation framework is in use — labels are hardcoded strings or come from `appCopy`; `StatusBadge` accepts an optional `label` prop to bridge this.

---

## 8. Related Specifications / Further Reading

- `apps/frontend/src/app/ui/primitives.tsx` — existing shared UI primitive pattern
- `apps/frontend/src/styles.css` — CSS design token system (`:root` vars)
- `packages/contracts/src/index.ts` — `ProductChangelogStatus`, `UserReportStatus`
- `apps/frontend/src/features/generation/ui/artifact-history.ts` — `ArtifactLifecycleStatus`
- `apps/frontend/src/features/auth/runtime/auth-client.ts` — `AuthUserStatus`
- `apps/frontend/src/features/admin/llm/LLMTable.tsx` — `AdminLlmModelRow.status`
