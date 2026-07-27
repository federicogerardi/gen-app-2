---
type: concept
tags:
  - wiki/concept
  - frontend
  - ui
  - governance
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Frontend Platform Team
source_count: 2
confidence: high
---

# UI Governance

The frontend's naming, layout, and component governance system — one canonical UI vocabulary, one set of page archetypes, one table standard, and deterministic feedback channel mapping.

## Core Principles

1. **One concept, one canonical name, one canonical layout behavior**
2. **All pages map to exactly one archetype** (Tool Workspace Page or Data Table View)
3. **CTA governance is deterministic** — 3 patterns, no custom CSS permitted
4. **Design tokens only** — no hardcoded colors, no `var(--mui-palette-*)`, no raw pixel spacing

## Canonical UI Vocabulary

~30 terms defined, including: [[SetupPanel]], [[WorkflowPanel]], [[DataTableView]], [[FeedbackChannel]], [[DispatchError]], [[ContextGenerationPhase]], [[ExtractionContextBridge]].

## Feedback Channels

[channelMapping::`inline-action` | `page-state` | `global`]

Precedence for ambiguous cases:
1. User can fix in current control → `inline-action`
2. Represents page data lifecycle → `page-state`
3. Mutation outcome with cross-page relevance → `global`

## CTA Patterns

| Pattern | CSS class | Use case |
|---------|-----------|----------|
| A — `ui-button` | `<button className={uiPrimitives.button}>` | Primary page/section action |
| B — `inlineLink` | `<Link className={uiPrimitives.inlineLink}>` | Inline navigational hint |
| C — Bordered-chip | `cx(inlineLink, artifactTableActionLink)` | Table cell action only |

**Prohibited**: `<Button>` inside `<td>`, custom backgrounds on `<Link>`, `border-radius: var(--radius-card)` on buttons.

## Design Tokens

Single source: `styles.css` `:root`. Token families: `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--surface-*`, `--border-*`, `--interactive-*`, `--success-*`, `--error-*`, `--warning-*`.

## Acceptance Gates

A UI PR is acceptable only if: archetype declared, canonical terms used, table standard applied, no new ad-hoc patterns, accessibility preserved, feedback channels mapped, anti-patterns not introduced.

## Sources

- [[frontend-ui-ubiquitous-language-spec]]
- [[documentation-ddd-ul-governance]]