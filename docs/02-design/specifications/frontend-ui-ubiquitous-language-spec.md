---
status: active
version: 1.3
date_created: 2026-05-08
last-reviewed: 2026-05-22
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
| Tool Availability Policy | Role-aware tri-state exposure policy for tools: `enabled-for-all`, `disabled-for-all`, `enabled-for-admin-only`. Applies to discovery (Tools hub, navigation shortcuts) and route access. | Tool discovery and routing surfaces | Binary enabled/disabled flag without role semantics |
| Setup Panel | Left panel in Tool Workspace Page for project/model/briefing/primary action setup. | `ToolPageTemplate` form area | Left column form, input area |
| Workflow Panel | Right panel in Tool Workspace Page for status, payload visibility, and unified process feedback. | `ToolGenerationFlowVertical` (payload + monitoring + feedback sections) | Progress column, steps area |
| Status Card | Summary card exposing run status and actionable context. | Shared tool UI cards | Header card, info block |
| Step Card | Visual representation of a single step state in sequence. | Shared tool UI cards | Task card, stage card |
| Data Table View | Canonical tabular listing pattern for index/list pages. | Artifact History table behavior | Grid, list table, admin table |
| Table Toolbar | Header actions for filtering/sorting/search/reload/export actions. | Artifact list table top action zone | Controls row, actions header |
| Table Empty State | Standard no-data rendering with reason and next action. | Shared empty-state pattern | No results message |
| Table Error State | Standard error rendering with retry affordance. | Shared error-state pattern | Load error block |
| Feedback Channel | Canonical classification for user feedback rendering. Values: `inline-action`, `page-state`, `global`. Selection is deterministic by intent and scope. | `ToolPageTemplate`, `ListingTableSection`, admin mutation pages | Generic notification |
| Page State Message | Canonical page-body feedback primitive family for query/list lifecycle: `LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage`. | `app/ui/primitives.tsx` + `ListingTableSection` | Toast for loading/empty/error |
| Global Feedback Message | **Provisional** ephemeral cross-page mutation feedback message (success/error) rendered in a global viewport without replacing local contextual feedback. | Transition target from local mutation messages | Page-local ad-hoc success string |
| Global Feedback Viewport | **Provisional** app-level container that renders `Global Feedback Message` items. Must not be used for `Dispatch Error` or `Page State Message`. | Shell-level runtime target | Reusing Data Table state area |
| Dispatch Error | Inline error message rendered adjacent to the primary CTA when a run cannot proceed or must be force-closed back to `configuring`. This includes `startGenerationStep` returning `false`, extraction semantic invalidity (`extraction_context_insufficient`), and stream terminal failures that do not expose a recoverable `failedStep`. Cleared on every new primary action attempt. Canonical implementation: `dispatchError` state in `useToolPage`; rendered as `<p className={uiPrimitives.error}>` in `ToolPageTemplate`. UI copy must be user-readable and must not display raw tokens such as `stream_empty_output` or `extraction_context_insufficient`. See DDD-061 and DDD-064. | `ToolPageTemplate` area below primary CTA | Step error, briefing error, terminal stream failure |
| Tool File Instructions Section | Deterministic inline guidance accordion inside the Tool Workspace Page Setup Panel that lists only the required fields for a specific tool. The section is driven by registry metadata, appears only when tool instructions exist, and is closed by default. | Tool Workspace Page setup area, directly below upload/form controls | Popover guidance, tabbed instructions |
| Tool Input File Requirement Policy | Canonical rule for tool input-file requiredness. If a tool has one input file, it is always required. If a tool has multiple files, only the first file is always required; each subsequent file is explicitly classified by tool setting as required or optional. | Tool Workspace setup metadata and file-upload guidance | Implicit multi-file requiredness, all-files-required-by-default |
| Context Generation Phase | Canonical Tool Workspace pre-step phase where FE assembles the context payload from configured sources: direct input fields, text-file extraction, API-backed acquisition, and deterministic merge rules. | Tool Workspace setup and workflow panel pre-step progress | Extraction-only phase naming for mixed-source tools |
| Start Context Generation Action | Canonical primary CTA contract that starts `Context Generation Phase`. Transitional UI copy may still display `Genera contesto`, but runtime semantics include extraction, fetch, and merge based on tool configuration. | Tool Workspace primary CTA in Setup Panel | Separate buttons for extraction and API fetch in the same pre-step flow |
| Tool Input Requirement Matrix | Canonical requiredness matrix across all input source families (`direct-input`, `tool-input-file`, `api-acquisition`) using values `always-required`, `required-by-tool-setting`, `optional-by-tool-setting`. | Tool Workspace readiness and CTA enablement | Source-specific ad-hoc requiredness logic |
| Missing Required Files Message | Blocking process feedback listing policy-required files that must be uploaded to enable primary generation action. | Tool Workspace Workflow Panel, Feedback section (`inline-action`) | Generic upload warning without required list |
| Missing Optional Files Advisory | Non-blocking informational recommendation shown when optional files are missing but required files are complete. | Tool Workspace Workflow Panel, Feedback section (`inline-action`) | Warning/error feedback that blocks CTA |
| Extraction Context Bridge | The invisible synchronization mechanism that writes a ready briefing actor's `ExtractionContext` into `GenerationWorkspace` before generation dispatch. Not rendered in UI; manifests as idempotent workspace state. If absent or broken, the primary CTA triggers a `Dispatch Error` despite readiness being true. See DDD-070. | `useToolPage` effect #2b | — |

Tri-state policy rule:
Tool discovery and tool route access must evaluate the same policy from shared contracts. `enabled-for-admin-only` tools are hidden for `member` users and accessible for `admin` users only.

### 2.1 Extraction Field Key-To-Label Operational Convergence Matrix

This matrix operationalizes DDD-079 in UI guidance.

Rules:

- Contract-facing identifiers must be `ExtractionFieldKey` (English snake_case).
- UI copy may render localized `ExtractionFieldLabel` (it-IT) derived from keys.
- Mixed required-field lists (labels + raw keys in the same list) are transitional drift and must be converged tool by tool.
- `provisional` rows below are documentation-level convergence targets; they are not runtime contract changes.

#### 2.1.1 youtube-lf-script (contract-backed)

| ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status | Evidence |
| --- | --- | --- | --- |
| `knowledge_content` | Knowledge content | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `avatar` | Avatar | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `pain_point` | Pain point | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `purchase_process_type` | Purchase process type | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `offer` | Offerta | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `proof` | Proof | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `target_duration_minutes` | Target duration (minutes) | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `proprietary_methodology_disclosure` | Proprietary methodology disclosure | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |

#### 2.1.2 funnel-pages (contract-backed)

| ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status | Evidence |
| --- | --- | --- | --- |
| `funnel_goal` | Obiettivo del funnel | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `target_audience` | Target | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `offer` | Offerta | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `proof` | Proof | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `primary_cta` | CTA principale | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |

#### 2.1.3 nextland (contract-backed)

| ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status | Evidence |
| --- | --- | --- | --- |
| `website_goal` | Obiettivo del sito | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `brand_or_company` | Brand o azienda | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `target_audience` | Target | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `offer_or_service` | Offerta o servizio | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `required_sections` | Sezioni richieste | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |

#### 2.1.4 angle-generator (contract-backed)

| ExtractionFieldKey | ExtractionFieldLabel (it-IT) | Status | Evidence |
| --- | --- | --- | --- |
| `goal` | Obiettivo | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `product_or_service` | Prodotto o servizio | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `market` | Mercato | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `target_audience` | Target | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `pain_point` | Pain point | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `proof` | Proof | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |
| `creative_constraints` | Vincoli creativi | contract-backed | `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` |

Convergence gate:

- Runtime source of truth is shared and deterministic: `packages/contracts/src/extraction-fields.ts` for canonical keys/aliases/per-tool maps, `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` for key-to-label projection.

## 3. Canonical Page Archetypes

All frontend pages must map to exactly one archetype before implementation.

Global composition rule:

- avoid nested cards by default; use nested cards only when strictly necessary for semantic grouping that cannot be represented with spacing, dividers, or typography
- rationale: nested cards increase cognitive load and visually over-weight layouts, reducing scan speed

### 3.1 Tool Workspace Page (reference archetype)

Reference: Tool page architecture and current runtime behavior.

Composition:

- fixed two-panel structure: Setup Panel + Workflow Panel
- single primary action policy derived from canonical state
- secondary actions rendered only through policy flags
- no extra wrapper containers that dilute panel hierarchy
- component convergence from `ToolGenerationFlow` to `ToolGenerationFlowVertical` is classified as a technical refactor inside the same archetype and must not be treated as a vocabulary or archetype change
- **Dispatch Error slot**: a `<p className={uiPrimitives.error}>` element is rendered adjacent to the primary CTA when `dispatchError` is non-null; it is absent (not empty) when `dispatchError` is null. This slot is part of the canonical Setup Panel composition (see `Dispatch Error` in Section 2). The slot is used both for dispatch-time failures and for terminal stream failures that must be surfaced while the page is forced back to `configuring`.
- **Workflow Panel feedback centralization**: process-feedback messages are centralized in Workflow Panel `inline-action` feedback section. This includes `briefingError`, missing required files, readiness feedback, `artifactsReloadError`, `briefingGuidance`, missing optional files advisory, and extraction-start hint. Setup Panel remains interaction-only for these process messages.
- **Tool File Instructions Section**: a deterministic inline guidance accordion is rendered directly below the upload/form controls when registry metadata exists. The accordion is closed by default; the section title is fixed and the body shows only the required fields list; no optional groups, examples, notes, or tone guidance are rendered in the card body.
- **Tool Input File Requirement Policy**: file-requiredness in setup follows deterministic index semantics. For one-file tools, the single file is required. For multi-file tools, the first file remains always required; each file from second onward is explicitly marked required or optional by tool setting and must be reflected in setup guidance.
- **Manual extraction trigger**: file selection is a cache action only. Extraction must start through explicit setup CTA (`Genera contesto`) after required files are present. This rule is uniform for all tools, including single-file tools.
- **Context generation trigger**: pre-step context assembly starts through one explicit setup CTA. During transition the visible copy can remain `Genera contesto`, but the action contract is `Start Context Generation Action` and can execute extraction, API-backed acquisition, and merge according to tool configuration.
- **Blocking vs advisory semantics**: missing required files must produce blocking feedback and disable primary action; missing optional files must produce informational advisory feedback and must never disable primary action.
- **Unified requiredness semantics**: readiness and CTA enablement must follow one `Tool Input Requirement Matrix` spanning direct fields, file uploads, and API acquisition inputs.
- **Direct-input-only tool rule**: when a tool declares only `direct-input` entries in `Tool Input Requirement Matrix` (for example `youtube-description`), Setup Panel must not require file-upload completion for start eligibility; blocking validation is limited to required direct-input fields and their format constraints.
- **API binding status adapter (as-is)**: `api-acquisition` requiredness is feature-flagged by `VITE_FF_TOOLS_API_BINDING_STATUS`; default runtime keeps the flag OFF so legacy tools are not blocked by unresolved API bindings. When ON, binding connectivity is read from backend resolve endpoints and projected as `connected`/`disconnected` in Workflow Panel and matrix gating.
- **Extraction Context Bridge**: invisible but mandatory. Any change to briefing upload or workspace provider logic must verify that the bridge still fires and the idempotency guard still holds before the primary CTA can be clicked (see DDD-070).
- **Pre-dispatch orchestration contract**: before `generation.start`, Tool Workspace runtime resolves step dependencies through `/api/tools/orchestrate` (`orchestrateToolStep`) and injects returned dependency artifact IDs into the outgoing request. If orchestration fails, generation dispatch is aborted and feedback remains in the inline `Dispatch Error` slot.
- **Channel ownership rule**: Tool Workspace Page feedback follows `Feedback Channel` mapping. `Dispatch Error` remains `inline-action`; query/list lifecycle remains `page-state`; `global` channel is optional and must not duplicate the same message already rendered inline.

Convergence note (2026-05-23): canonical centralization reference for Tool Workspace feedback is `docs/ux/tool-page-sidebar-unified-flow.md` and its implementation plan `plan/refactor-tool-workspace-workflow-panel-unified-1.md`.

### 3.2 Data Table View (reference archetype)

Reference baseline: Artifact History table behavior.

Composition:

- page header (title + contextual subtitle)
- Table Toolbar (filters/actions)
- table body with deterministic columns
- Table Empty State and Table Error State
- pagination or cursor controls in one consistent location
- `Page State Message` primitives are rendered in deterministic in-page positions and are never replaced by `Global Feedback Message`

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

#### 3.2.3 Admin Overview companion layout (`/admin`)

`/admin` is governed as the operational-overview companion of the Admin `Data Table View` pages (`/admin/users`, `/admin/models`, `/admin/api-services`, `/admin/changelog`, `/admin/user-reports`, `/admin/activity`), not as a third standalone archetype.

Canonical composition:

- persistent admin navigation is rendered at layout level and remains visible across all `/admin/*` routes
- overview body is KPI-first and uses compact widget cards designed for scan speed and triage priority
- each KPI widget must support deterministic state rendering: `loading`, `empty`, `error`, `ready`
- `ready` state should expose a compact value + minimal context line, avoiding long explanatory copy
- widget cards are read-oriented overview elements; operational mutations remain in downstream Admin `Data Table View` pages
- channel ownership remains deterministic: widget query lifecycle uses `Page State Message` semantics inside card body; mutation feedback remains owned by page-level channels in target admin pages

Convergence note:

- this companion pattern resolves the `/admin` archetype ambiguity while preserving the two canonical archetypes (`Tool Workspace Page`, `Data Table View`)
- future `/admin` enhancements must extend this companion pattern and must not introduce ad-hoc page archetypes

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

- None currently registered in Admin Overview archetype mapping after companion-pattern convergence.

### 5.2 Resolved drift

| Page | Archetype declared | Drift resolved | Date |
| --- | --- | --- | --- |
| Admin Users (`/admin/users`) | Data Table View | Card-list → table with toolbar, bordered-chip row actions, inline edit row | 2026-05-08 |
| Admin ApiServices (`/admin/api-services`) | Data Table View | Introduced canonical ApiService catalog + binding management surface with toolbar, table row actions, and scoped binding panel | 2026-05-24 |
| Admin Overview (`/admin`) | Data Table View companion | Declared canonical operational-overview companion with persistent admin navigation + KPI widget state cards (`loading`/`empty`/`error`/`ready`) | 2026-05-17 |
| Projects List (`/dashboard/projects`) | Data Table View | Card-list → table with header columns, bordered-chip detail link | 2026-05-08 |
| Admin Models (`/admin/models`) | Data Table View | `<Button>` CTAs in `<td>` → `cx(inlineLink, artifactTableActionLink)` row actions | 2026-05-08 |
| Admin Activity (`/admin/activity`) | Data Table View | Card-list (`<ul>`+`<Surface as="li">`) → read-only table (Project, Artifact, Status, Aggiornato) | 2026-05-08 |
| Artifact Detail (`/artifacts/{artifactId}`) | Data Table View companion | Primary content panel + context sidebar; session-first CTA; lowercase bordered status tag beside step title; legacy session CTA disabled with explicit copy; nested-card drift removed | 2026-05-09 |
| Session Summary Detail (`/sessionsummary/{sessionId}`) | Data Table View companion | Primary content panel + context sidebar; distinct Session Step Tabs for step selection; shared Markdown/Raw/Copy preview pattern aligned with artifact detail | 2026-05-09 |
| Tool Workspace Flow Panel (`/tools/*`) | Tool Workspace Page | Converged duplicated flow components to `ToolGenerationFlowVertical`; no archetype or UL term change | 2026-05-08 |

### 5.3 Required convergence target

- Tool Workspace Page remains the visual and compositional reference for generation-oriented flows.

## 6. Convergence Workflow

Before implementing or refactoring a page:

1. classify page archetype: Tool Workspace Page or Data Table View
2. map planned UI elements to canonical vocabulary from Section 2
3. verify token/component reuse from shared primitives
4. run drift check against this spec and `frontend-design-system-ui-kit-guide.md`
5. update documentation index when adding new governance artifacts

## 7. Feedback Governance Matrix

Use this matrix to map each feedback event to exactly one canonical channel.

| Event Type | Canonical Channel | Canonical Term | Rendering Location | Rule |
| --- | --- | --- | --- | --- |
| Tool process feedback (`briefingError`, missing required files, readiness feedback, `artifactsReloadError`, `briefingGuidance`, optional-files advisory, extraction-start hint) | `inline-action` | Workflow Panel feedback section | Tool Workspace Page Workflow Panel | Centralize in Workflow Panel; avoid duplicate rendering in Setup Panel |
| Tool setup form validation (`project`, `model`, `tone`) | `inline-action` | Field-level validation | Field/form area | Keep input-level validation adjacent to field when needed; do not mirror to global viewport |
| Tool primary-action dispatch failure (including `/api/tools/orchestrate` pre-dispatch failure) | `inline-action` | Dispatch Error | Tool Workspace Page Setup Panel (below primary CTA) | Must remain local and actionable in-place |
| Tool terminal stream failure without recoverable failed step | `inline-action` | Dispatch Error | Tool Workspace Page Setup Panel (below primary CTA) | Keep local recovery context; global duplication is not allowed |
| Extraction completed but semantically invalid | `inline-action` | Dispatch Error | Tool Workspace Page Setup Panel (below primary CTA) | Must show user-readable copy and keep `start-generation` blocked until valid re-upload |
| Query loading state | `page-state` | Page State Message (`LoadingStateMessage`) | Page/table body state slot | Never use global channel for loading |
| Query empty state | `page-state` | Page State Message (`EmptyStateMessage`) | Page/table body state slot | Empty states are structural page content, not notifications |
| Query error state | `page-state` | Page State Message (`ErrorStateMessage`) | Page/table body state slot | Keep retry affordance in-page |
| Mutation success (create/update/delete) with cross-page relevance | `global` | Global Feedback Message (provisional) | Global Feedback Viewport | Use ephemeral global feedback; avoid replacing page-state blocks |
| Mutation failure not tied to a specific input field | `global` | Global Feedback Message (provisional) | Global Feedback Viewport | Keep short actionable text; avoid duplicating the same error inline and global |

Channel precedence for ambiguous cases:

1. if the user can fix the issue in the current control, use `inline-action`
2. if the message represents page data lifecycle, use `page-state`
3. only if the event is mutation outcome with cross-page relevance, use `global`

### 7.1 Implementation Contract References

The following runtime paths are the canonical implementation contract for channel governance:

- `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx` — app-level global feedback runtime API (`publishSuccess`, `publishError`, `dismiss`, `dismissAll`)
- `apps/frontend/src/app/ui/GlobalFeedbackViewport.tsx` — shell-level viewport renderer for `Global Feedback Message`
- `apps/frontend/src/app/runtime/feedback-channel-map.ts` — deterministic event-to-channel resolver (`resolveFeedbackChannel`)

## 8. Feedback Anti-Patterns And Remediation

| Anti-pattern | Why It Is Drift | Canonical Remediation |
| --- | --- | --- |
| Showing Data Table loading/error/empty as global toast | Removes structural context and weakens table readability | Render as `Page State Message` in page body |
| Emitting `Dispatch Error` both inline and global | Duplicates signal and confuses priority | Keep `Dispatch Error` only in `inline-action` slot |
| Using `LoadingStateMessage` for mutation success copy | Semantic mismatch (`loading` vs `success`) | Route to `Global Feedback Message` (provisional) |
| Keeping ad-hoc page-local success variable names as governance terms | Creates terminology drift across docs/PRs | Use canonical UL terms in docs/PRs (`Global Feedback Message`, `Feedback Channel`) |

## 9. Acceptance Gates

A PR touching frontend UI is acceptable only if:

1. archetype is explicitly declared in PR description
2. canonical UI terms are used in code comments/docs where applicable
3. table pages demonstrate alignment with Section 4 rules
4. no new local visual pattern is introduced when a canonical one exists
5. accessibility baseline is preserved (contrast, focus visibility, keyboard navigation)
6. feedback mapping is explicit and channel-consistent (`inline-action` vs `page-state` vs `global`) with no channel overlap for the same event
7. every new feedback event is mapped to a row in Section 7 (or explicitly justified as temporary exception)
8. anti-patterns in Section 8 are not introduced in the touched pages

## 10. Rollout Priority

Priority order for convergence:

1. Any additional admin list pages that behave as table indices
2. Remaining list pages still using ad-hoc table composition
3. Companion-pattern consistency checks across admin overview surfaces (`/admin`)

## 11. Governance Ownership

- Owner: Frontend Platform Team
- Design review support: UX/UI
- Update cadence: monthly or when a new page archetype is introduced
