---
type: source-summary
tags:
  - wiki/source
  - frontend
  - ui-governance
  - design-system
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md
date_ingested: 2026-07-28
---

# Frontend UI Ubiquitous Language Specification

Defines canonical UI vocabulary, page archetypes, table standards, CTA governance, feedback channels, and design token rules for all frontend screens.

## Canonical UI Vocabulary (~30 terms)

| Term | Summary |
|------|---------|
| **Tool Workspace Page** | Two-column layout (Setup Panel + Workflow Panel) |
| **Setup Panel** | Left panel: Configuration, Resources, Knowledge sections |
| **Workflow Panel** | Right panel: status, payload, feedback |
| **Data Table View** | Canonical listing pattern (based on Artifact History) |
| **Feedback Channel** | `inline-action`, `page-state`, `global` — deterministic by intent |
| **Dispatch Error** | Inline error below primary CTA |
| **Extraction Context Bridge** | Invisible sync between briefing actor and generation workspace |
| **Setup Panel Section** | Compact typographic header + divider, not nested cards |
| **Knowledge Section** | Workspace assets + [[LlmModelSelector]] for asset-capable tools |

## Page Archetypes

**Two canonical archetypes only:**
1. **Tool Workspace Page** — generation flow with 2 panels
2. **Data Table View** — listing/index with toolbar, empty/error states, pagination

Three companion layouts: Artifact Detail, Session Summary Detail, Admin Overview.

## CTA Governance (Section 4b)

Three canonical patterns, no exceptions:
- **Pattern A — `ui-button`**: primary page/section actions (form submit, toolbar, zero-state)
- **Pattern B — `inlineLink`**: inline navigational hints
- **Pattern C — Bordered-chip**: only for `<td>` actions (no `<Button>` inside table cells)

## Feedback Governance Matrix (Section 7)

Maps every feedback event to exactly one channel with precedence: `inline-action` > `page-state` > `global`. No channel overlap allowed.

## Design Token Governance (Section 12)

- All CSS tokens in `styles.css` `:root`
- No `var(--mui-palette-*)` in custom CSS — use app tokens
- No hardcoded colors, spacing, shadows, or border-radius
- Token system: `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--surface-*`, `--border-*`

## Accessibility Contract (Section 13)

Mandatory: WAI-ARIA tab pattern, focus traps for overlays, `aria-live` for dynamic states, no hardcoded locale in ARIA attributes, unique landmark labels.

## Responsive Breakpoints

Three canonical: `980px` (desktop↔tablet), `760px` (tablet↔mobile), `1080px` (wide admin). `768px` deprecated.

## Source

- File: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- Version: 1.8
- Last reviewed: 2026-07-21
- Owner: Frontend Platform Team