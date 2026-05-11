---
status: active
version: 1.1
date_created: 2026-05-08
last-reviewed: 2026-05-11
next-review-date: 2026-06-08
owner: Frontend Platform Team
type: ui-governance-spec
---

# Frontend UI Ubiquitous Language Specification

> This specification defines a single UI vocabulary and composition contract for all frontend screens. It is the UI equivalent of UL governance: one concept, one canonical name, one canonical layout behavior.

## 1. Purpose

The application now has enough screens and components to create naming and layout drift.

This document establishes:

- canonical names for recurring UI concepts
- canonical page archetypes and layout composition rules
- one canonical table standard based on Artifact History table behavior
- deterministic convergence gates for divergent pages (including Admin Models)

This is a UI governance document. Domain term authority remains in:

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`

## 2. Canonical UI Vocabulary

Use these names in code, docs, PR descriptions, and design reviews.

| Canonical UI Term | Definition | Canonical Source Pattern | Not This |
| --- | --- | --- | --- |
| Tool Workspace Page | The canonical two-column tool execution page built from `ToolPageTemplate` with setup panel and workflow panel. | Tool pages under `apps/frontend/src/features/tools/` | Wizard page, generator page, flow page |
| Setup Panel | Left panel in Tool Workspace Page for project/model/briefing/primary action setup. | `ToolPageTemplate` form area | Left column form, input area |
| Workflow Panel | Right panel in Tool Workspace Page for status and step progression. | `ToolGenerationFlowVertical` + step/status cards | Progress column, steps area |
| Status Card | Summary card exposing run status and actionable context. | Shared tool UI cards | Header card, info block |
| Step Card | Visual representation of a single step state in sequence. | Shared tool UI cards | Task card, stage card |
| Data Table View | Canonical tabular listing pattern for index/list pages. | Artifact History table behavior | Grid, list table, admin table |
| Table Toolbar | Header actions for filtering/sorting/search/reload/export actions. | Artifact list table top action zone | Controls row, actions header |
| Table Empty State | Standard no-data rendering with reason and next action. | Shared empty-state pattern | No results message |
| Table Error State | Standard error rendering with retry affordance. | Shared error-state pattern | Load error block |
| Dispatch Error | Inline error message rendered adjacent to the primary CTA when `startGenerationStep` returns `false`. Distinct from briefing extraction errors (Setup Panel) and stream errors (Workflow Panel). Cleared on every new primary action attempt. Canonical implementation: `dispatchError` state in `useToolPage`; rendered as `<p className={uiPrimitives.error}>` in `ToolPageTemplate`. See DDD-061. | `ToolPageTemplate` area below primary CTA | Step error, stream error, briefing error |
| Extraction Context Bridge | The invisible synchronization mechanism that writes a ready briefing actor's `ExtractionContext` into `GenerationWorkspace` before generation dispatch. Not rendered in UI; manifests as idempotent workspace state. If absent or broken, the primary CTA triggers a `Dispatch Error` despite readiness being true. See DDD-060. | `useToolPage` effect #2b | — |

## 3. Canonical Page Archetypes

All frontend pages must map to exactly one archetype before implementation.

### 3.1 Tool Workspace Page (reference archetype)

Reference: Tool page architecture and current runtime behavior.

Composition:

- fixed two-panel structure: Setup Panel + Workflow Panel
- single primary action policy derived from canonical state
- secondary actions rendered only through policy flags
- no extra wrapper containers that dilute panel hierarchy
- component convergence from `ToolGenerationFlow` to `ToolGenerationFlowVertical` is classified as a technical refactor inside the same archetype and must not be treated as a vocabulary or archetype change
- **Dispatch Error slot**: a `<p className={uiPrimitives.error}>` element is rendered adjacent to the primary CTA when `dispatchError` is non-null; it is absent (not empty) when `dispatchError` is null. This slot is part of the canonical Setup Panel composition (see `Dispatch Error` in Section 2).
- **Extraction Context Bridge**: invisible but mandatory. Any change to briefing upload or workspace provider logic must verify that the bridge still fires and the idempotency guard still holds before the primary CTA can be clicked (see DDD-060).

### 3.2 Data Table View (reference archetype)

Reference baseline: Artifact History table behavior.

Composition:

- page header (title + contextual subtitle)
- Table Toolbar (filters/actions)
- table body with deterministic columns
- Table Empty State and Table Error State
- pagination or cursor controls in one consistent location

Rule:

- if a page is primarily a list/detail index, it must adopt Data Table View composition
- card-only list views are allowed only when data is not tabular

#### 3.2.1 Artifact Detail companion layout (`/artifacts/{artifactId}`)

`/artifacts/{artifactId}` is governed as the detail companion of the Artifact History `Data Table View`, not as a standalone archetype.

Canonical composition:

- asymmetric two-column detail layout: primary `Content Panel` + secondary `Context Sidebar`
- `Content Panel` remains visually dominant and owns the artifact content preview plus the `Markdown` / `Raw` / `Copy content` toolbar
- `Context Sidebar` owns step context, session/navigation actions, and technical metadata
- sidebar heading row must render `Step Title` first and the artifact lifecycle status as a compact bordered status tag adjacent to it
- the status tag must display the persisted lifecycle value in lowercase (`generating`, `completed`, `failed`) and use state color tokens instead of neutral styling
- tool and project context must render on one compact metadata line in the order `Tool Display Name - Project Name`
- the primary sidebar navigation CTA is `Apri sessione` when the artifact exposes `sessionId`; legacy artifacts without `sessionId` must keep the CTA slot visible as a disabled button with explicit copy `Sessione non disponibile.`
- avoid nested cards inside the detail layout; separation must come from panel composition, token spacing, and lightweight dividers rather than stacked boxed surfaces
- desktop spacing between `Content Panel` and `Context Sidebar` must use canonical spacing tokens from the design system, not one-off pixel gaps

#### 3.2.2 Session Summary Detail companion layout (`/sessionsummary/{sessionId}`)

`/sessionsummary/{sessionId}` is governed as the aggregate-detail companion of `Data Table View` listing pages that expose `SessionSummary` rows.

Canonical composition:

- asymmetric two-column detail layout: primary `Content Panel` + secondary `Context Sidebar`
- `Content Panel` owns session step navigation and artifact content preview
- session step navigation must be rendered as `Session Step Tabs` (step selector), visually distinct from content-mode controls
- content-mode controls remain the canonical `Markdown` / `Raw` / `Copy content` set, shared with `/artifacts/{artifactId}` through the same preview pattern
- `Context Sidebar` owns aggregate metadata (`sessionId`, session status) and primary navigation CTA back to session archive
- sidebar heading row must render aggregate title first and the lifecycle status tag adjacent to it
- status tag must display persisted lifecycle values in lowercase (`generating`, `completed`, `failed`) and use state color tokens
- avoid nested cards inside the detail layout; preserve hierarchy through panel composition and token-based spacing

## 4. Canonical Table Standard (Artifact Baseline)

The Artifact table is the standard for table ergonomics and visual rhythm.

Mandatory alignment points for every new or refactored table:

1. Information hierarchy
   - primary cell content first, metadata second
   - status always represented with text + visual token (not color only)
2. Row interaction
   - full-row click target and explicit action affordance must be consistent
   - hover, focus, selected states must be token-driven
3. Column behavior
   - deterministic column order by data priority
   - truncation + tooltip behavior consistent across pages
4. States
   - loading, empty, error, success share same structural positions
5. Responsiveness
   - mobile fallback strategy must be explicitly defined (horizontal scroll or condensed row layout)
6. **Row-level action affordances — Button CTA prohibition**
   - `<Button>` components (styled CTA buttons with primary/secondary visual weight) are **prohibited inside table cells** (`<td>`).
   - **Canonical pattern**: the `/artifacts` listing (`ArtifactsListingSection`) is the reference implementation. Row-level actions must use the **bordered-chip link** pattern: `className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}` on an `<a>`, `<Link>`, or `<button type="button">` element. This produces a compact uppercase chip (11 px, border, transparent background, hover fill) that maintains tabular density.
   - For navigational actions (open detail, view): use React Router `<Link>` with the above classes.
   - For mutation actions (edit, disable, delete, toggle): use `<button type="button">` with the same classes plus `disabled` attribute and `aria-label` when the label alone is insufficient for screen-reader context.
   - `ui-inline-link` alone (with `→` arrow) is appropriate for primary row navigation where the chip acts as a call-to-action. `ui-artifact-table-action-link` compounds onto `ui-inline-link` to reduce padding and suppress the arrow — use it for secondary or destructive actions.
   - Rationale: button CTA weight breaks the visual rhythm of the table scan line, inflates row height, and conflicts with the tabular density expected in a Data Table View. Bordered chips preserve density and visual hierarchy: cell content reads first, action affordance reads second.
   - Inline edit forms that expand below a row (e.g., full-row `<td colSpan>`) are exempt from this rule — they are a form context, not a table cell action affordance.
   - Destructive confirmation must be surfaced as a modal or inline warning, not a differently-styled button inside the row.

## 4b. CTA Governance — Canonical Decision Matrix

Every call-to-action in the frontend must resolve to exactly one of these three canonical patterns. No custom CTA CSS is permitted when a canonical pattern covers the context.

### Decision rule (apply in order)

```
Is the CTA inside a <td>?
  YES → Bordered-chip pattern (Section 4.6)
  NO  → Is the CTA a primary page/section action (hero, toolbar, form submit)?
    YES → ui-button pattern
    NO  → Is the CTA an inline navigational hint inside body text or a card?
      YES → inlineLink pattern
      NO  → Flag as ambiguous — resolve against this matrix before writing code
```

### Pattern A — `ui-button` (primary CTA)

Use when: the action is the primary intent of the current page section (form submit, zero-state call-to-action, toolbar primary action, auth entry point).

Implementation:
- `<button type="submit|button" className={uiPrimitives.button}>` for mutations and submits
- `<Link to="..." className={uiPrimitives.button}>` for navigational primary CTAs (e.g. zero-state "Crea il tuo primo progetto")
- Never introduce custom CSS properties (`background`, `border-radius`, `font-size`, `font-weight`, `letter-spacing`) that override the canonical `ui-button` token. All visual properties are owned by `.ui-button` in `styles.css`.

Prohibited:
- custom `background: var(--link-fg)` or other one-off background on a `<Link>`
- `border-radius: var(--radius-card)` on a button element (must use `var(--radius-button)`)
- `font-weight: 600` or `font-size: 0.9375rem` overrides on a button element

### Pattern B — `inlineLink` (inline navigational affordance)

Use when: the action is a secondary navigational link embedded in body text, a TopBar, a card footer, or a list item.

Implementation:
- `<Link to="..." className={uiPrimitives.inlineLink}>` — renders as `ui-inline-link` with optional `→` arrow
- `<a href="..." className={uiPrimitives.inlineLink}>` for external links

Prohibited:
- using `inlineLink` as a replacement for a primary CTA (use `ui-button`)
- using `inlineLink` inside `<td>` without the `artifactTableActionLink` compound (use Section 4.6)

### Pattern C — Bordered-chip (table row action)

Use when: the action lives inside a `<td>` in any Data Table View.

Implementation: see Section 4.6 — `cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)`

### Zero-state and hero CTA — additional rule

A zero-state screen (empty data condition, onboarding entry) must use **Pattern A (`ui-button`)** for its single primary CTA. The `<Link className={uiPrimitives.button}>` form is canonical for zero-state navigational CTAs. No additional class or inline style is permitted on the element.

### Anti-patterns (reject in review)

| Anti-pattern | Canonical replacement |
| --- | --- |
| `<a>` or `<Link>` with custom `background`, `padding`, `border-radius`, `font-weight` | `className={uiPrimitives.button}` |
| `<Button>` inside `<td>` | `cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)` |
| Any element with `border-radius: var(--radius-card)` that is a button/CTA | Replace with `var(--radius-button)` via `uiPrimitives.button` |
| `inlineLink` alone in a `<td>` | Add `artifactTableActionLink` compound |
| A `<div className={uiPrimitives.actions}>` wrapper inside a `<td>` | Remove wrapper, render bordered-chips side by side in the cell |

---

## 5. Drift Register (Current)

### 5.1 Confirmed drift

- Admin Models diverges from the Data Table View baseline in layout and interaction semantics.

### 5.2 Resolved drift

| Page | Archetype declared | Drift resolved | Date |
| --- | --- | --- | --- |
| Admin Users (`/admin/users`) | Data Table View | Card-list → table with toolbar, bordered-chip row actions, inline edit row | 2026-05-08 |
| Projects List (`/dashboard/projects`) | Data Table View | Card-list → table with header columns, bordered-chip detail link | 2026-05-08 |
| Admin Models (`/admin/models`) | Data Table View | `<Button>` CTAs in `<td>` → `cx(inlineLink, artifactTableActionLink)` row actions | 2026-05-08 |
| Admin Activity (`/admin/activity`) | Data Table View | Card-list (`<ul>`+`<Surface as="li">`) → read-only table (Project, Artifact, Status, Aggiornato) | 2026-05-08 |
| Artifact Detail (`/artifacts/{artifactId}`) | Data Table View companion | Primary content panel + context sidebar; session-first CTA; lowercase bordered status tag beside step title; legacy session CTA disabled with explicit copy; nested-card drift removed | 2026-05-09 |
| Session Summary Detail (`/sessionsummary/{sessionId}`) | Data Table View companion | Primary content panel + context sidebar; distinct Session Step Tabs for step selection; shared Markdown/Raw/Copy preview pattern aligned with artifact detail | 2026-05-09 |
| Tool Workspace Flow Panel (`/tools/*`) | Tool Workspace Page | Converged duplicated flow components to `ToolGenerationFlowVertical`; no archetype or UL term change | 2026-05-08 |

### 5.3 Required convergence target

- Admin Models must adopt Data Table View archetype and table standard from Section 4.
- Tool Workspace Page remains the visual and compositional reference for generation-oriented flows.

## 6. Convergence Workflow

Before implementing or refactoring a page:

1. classify page archetype: Tool Workspace Page or Data Table View
2. map planned UI elements to canonical vocabulary from Section 2
3. verify token/component reuse from shared primitives
4. run drift check against this spec and `frontend-design-system-ui-kit-guide.md`
5. update documentation index when adding new governance artifacts

## 7. Acceptance Gates

A PR touching frontend UI is acceptable only if:

1. archetype is explicitly declared in PR description
2. canonical UI terms are used in code comments/docs where applicable
3. table pages demonstrate alignment with Section 4 rules
4. no new local visual pattern is introduced when a canonical one exists
5. accessibility baseline is preserved (contrast, focus visibility, keyboard navigation)

## 8. Rollout Priority

Priority order for convergence:

1. Admin Models (highest current drift)
2. Any additional admin list pages that behave as table indices
3. Remaining list pages still using ad-hoc table composition

## 9. Governance Ownership

- Owner: Frontend Platform Team
- Design review support: UX/UI
- Update cadence: monthly or when a new page archetype is introduced
