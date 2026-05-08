---
status: proposed
version: 1.0
date_created: 2026-05-08
last-reviewed: 2026-05-08
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

## 3. Canonical Page Archetypes

All frontend pages must map to exactly one archetype before implementation.

### 3.1 Tool Workspace Page (reference archetype)

Reference: Tool page architecture and current runtime behavior.

Composition:

- fixed two-panel structure: Setup Panel + Workflow Panel
- single primary action policy derived from canonical state
- secondary actions rendered only through policy flags
- no extra wrapper containers that dilute panel hierarchy

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

## 5. Drift Register (Current)

### 5.1 Confirmed drift

- Admin Models diverges from the Data Table View baseline in layout and interaction semantics.

### 5.2 Required convergence target

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
