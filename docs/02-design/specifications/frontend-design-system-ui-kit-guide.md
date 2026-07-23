---
status: active
version: 1.3
date_created: 2026-04-28
last-reviewed: 2026-05-11
next-review-date: 2026-08-11
owner: Frontend Platform Team
type: design-system-guide
tags: [frontend, design-system, ui-kit, visual-language, tokens]
---

# Frontend Design System and UI Kit Guide

> ⓘ **Design Document** — This guide covers visual language, design tokens, layout system, and UI components. It is orthogonal to the DDD domain model (no UL linkage required per governance policy). For domain-facing architecture, see [Frontend Tool Pages Architecture Spec](./frontend-tool-pages-architecture-spec.md).

Date: 2026-04-28  
Status: Active  
Version: 1.3

## 1. Document Role

This document is the source of truth for all graphical and visual decisions of the frontend GUI.

Scope covered:

- visual language and aesthetic direction
- design tokens (colors, typography, spacing, radii, borders, shadows)
- layout system and composition rules
- UI kit (components, variants, states and behavior)
- micro-interactions and visual feedback
- consistency rules for new features or refactoring

Scope not covered:

- runtime/machine/backend logic
- API contracts and persistence

Mandatory complementary governance:

- For UI vocabulary and canonical page archetypes, also use `frontend-ui-ubiquitous-language-spec.md`.
- This guide remains the visual source of truth (tokens, components, look and feel); the UI UL spec governs naming and cross-page composition.

## 2. Visual Vision (Precision-Creative)

The GUI must communicate speed, technical reliability and creative support.

Visual direction:

- Professional Workspace style on a light, neutral base
- light layered surfaces, defined edges and readable hierarchy
- functional and sober chromatic accents for states and CTAs

Reference keywords:

- Reliability
- Clarity
- Operational control
- Focus

## 3. Canonical design tokens

Update note 2026-04-28:

- the token system explicitly supports light + dark theme via override on `:root[data-theme='dark']` in `apps/frontend/src/styles.css`.
- theme switching occurs without global CSS transitions for UX consistency.

Update note 2026-05-11 — MUI Theming Engine (v9):

- the theming system is now unified and managed entirely by MUI v9 via `cssVariables: true` + `colorSchemes: { light, dark }` in `apps/frontend/src/theme/theme.ts`.
- MUI automatically writes CSS custom properties on the `[data-theme="%s"]` selector, aligning with the existing selector in `styles.css`.
- the custom application `ThemeProvider` has been removed; the only active provider is `ThemeProvider` from `@mui/material` with `defaultMode="system"` in `App.tsx`.
- the theme toggle uses `useColorScheme` from `@mui/material` (native MUI v9 hook); it no longer exposes custom `useTheme`.
- user preference is persisted by MUI in `localStorage`; no custom storage logic is required.
- legacy CSS custom properties in `styles.css` remain unchanged: MUI syncs them via the `colorSchemeSelector`.

## 3.1 Colors

Primary palette:

- Workspace Blue: #2563EB (primary actions, active states)
- Canvas Light: #F6F8FB (main backgrounds)
- Surface Steel: #E6EBF2 (cards and secondary surfaces)
- Text Ink: #0F172A (primary text and headings)

Functional palette:

- Success Pine: #15803D (healthy/success states)
- Alert Brick: #B42318 (errors, critical alerts)
- Warning Amber: #B7791F (warnings, drafts, suggestions)

Rules:

- no hardcoded colors in components when a global token already exists
- use semantic naming (primary, surface, success, error, warning)
- maintain minimum AA contrast on text and interactive controls
- avoid glow, aggressive gradients and excessive contrasts not functional to the task

## 3.2 Typography

Target font stack:

- Headings and UI: IBM Plex Sans
- Body: Source Sans 3
- Mono: JetBrains Mono

Reference typographic hierarchy:

- H1: 32px, bold, letter-spacing -0.02em
- Body: 14px, regular, line-height 1.6
- Labels/meta: 12px, uppercase, bold

Rules:

- avoid ad-hoc fonts for single features
- labels and metadata must remain compact and consistent
- technical strings, IDs and prompts must use mono font

## 3.3 Spacing, radius, border, shadow

Base system:

- 8-point grid system
- every spacing/padding/margin is a multiple of 8 or consistent submultiples

Geometric tokens:

- card radius: 12px
- button/input radius: 8px
- border: 1px with low opacity
- shadow: soft, non-invasive shadow

## 4. Canonical layout system

## 4.1 Authenticated page layout

Standard desktop layout:

- column 1: navigation
- column 2: main canvas

Mobile layout:

- vertical stack, collapsible navigation

## 4.2 Tool pages layout

For tool pages the canonical layout is a dual internal column:

- left column: setup form (project, model, registry snapshot, briefing file, CTA)
- right column: status card + step cards

Rules:

- visually autonomous columns
- no redundant parent card wrapping the entire right column
- primary CTA positioned below the upload block in the left column

## 5. UI kit: base components

The UI kit must use shared primitives and centralized class tokens.

Implementation references:

- `apps/frontend/src/app/ui/primitives.tsx` — shared CSS class tokens
- `apps/frontend/src/styles.css` — CSS custom properties and dark mode overrides
- `apps/frontend/src/theme/theme.ts` — MUI theme definition (CSS vars + colorSchemes)
- `apps/frontend/src/app/copy/system.ts` — centralized copy

Core components:

- Shell
- Surface
- Top bar
- Navigation link
- Button (primary/secondary/disabled)
- Input/select/textarea/file input
- Status line/meta line/error
- Status card and tool step card
- Theme toggle icon-only (header utility action) — uses `useColorScheme` from `@mui/material`
- Artifact content toolbar (tabs `Markdown`/`Raw` + copy action)

Composition rules:

- first reuse an existing component/token
- if missing, introduce shared token before local use
- prohibited to introduce non-generalizable local CSS naming

## 5.1 Button contrast standard (light/dark)

This standard is binding for all CTAs (`Button` MUI and `.ui-button`) in light and dark themes.

Canonical tokens:

- primary background (light): `#2563EB` (`Workspace Blue`)
- primary text (light): `#F8FAFC`
- primary background (dark): `#3B82F6`
- primary text (dark): `#EFF6FF`
- outlined/text foreground (light): `#2563EB` or `#0F172A` depending on context
- outlined/text foreground (dark): `#93C5FD` or `#E5EDF8` depending on context
- destructive foreground/border: `#B42318` only for error/critical alert states

Operational rules:

- no global CSS selector on `button` can override MUI components (`.MuiButton-root`)
- MUI buttons must maintain native theme contrast for `contained`, `outlined`, `text` variants
- every CTA must guarantee minimum WCAG AA contrast (4.5:1) between text and background in the active theme
- `variant="text"` is mandatory for non-implemented or non-destructive secondary actions in the sidebar (avoids misleading borders)
- `color="error"` should not be used for standard operational CTAs (retry/cancel/relaunch): it is reserved for error state and critical alerts

Canonical matrix per variant:

| Variante | Tema chiaro | Tema scuro | Uso canonico |
| --- | --- | --- | --- |
| `contained` | sfondo `#2563EB`, testo `#F8FAFC` | sfondo `#3B82F6`, testo `#EFF6FF` | CTA primaria di pagina/sezione |
| `outlined` | bordo+testo primario con contrasto AA su superficie chiara | bordo+testo primario con contrasto AA su superficie scura | CTA secondaria operativa |
| `text` | testo primario/link senza bordo | testo primario/link senza bordo | azione secondaria leggera, fallback non distruttivo |

## 6. Visual states and feedback

Minimum mandatory states:

- idle
- running/streaming
- completed
- failed
- disabled

Feedback patterns:

- sober progress highlight on active panel during streaming
- immediate confirmations on quick actions (copy, start, retry)
- highlighted dropzone during file drag and drop

Artifact content toolbar consistency rule:

- `Markdown`, `Raw` and `Copy content` controls share the same button visual system (`size`, `border`, `radius`, `hover`, `active`, `disabled`).
- avoid absolute floating buttons above content containers when a structured toolbar in layout flow is available.

## 7. Iconography

Standard:

- libraries: Lucide or Phosphor
- style: outline
- stroke: 1.5-2
- default color: inherits text
- hover/active: accent primary (Workspace Blue)

## 8. Accessibility and visual quality gates

Every GUI intervention must verify:

- adequate text/background contrast (WCAG AA)
- visible focus for interactive components
- mobile and desktop readability
- consistency with design system tokens and components

Minimum technical gate:

- npm --prefix frontend run typecheck
- npm --prefix frontend run test

## 9. Governance rules for GUI changes

Before modifying UI:

1. consult this document
2. verify if an equivalent token/component already exists
3. update docs and index if a canonical rule changes

In case of conflict between documents:

- for visual rules this document prevails
- for tool page architectural details frontend-tool-pages-architecture-spec.md prevails
- for runtime contracts/centralized copy it integrates with tool-page-frontend-runtime-spec.md

## 10. Quick checklist for frontend GUI PRs

- uses existing tokens (CSS custom properties from `styles.css` or MUI palette from `theme.ts`)
- does not introduce redundant local classes
- respects canonical 2-column layout
- maintains state/feedback consistency
- does not introduce custom theme provider; uses exclusively `useColorScheme` to read/modify theme
- passes typecheck and test
- updates documentation if modifying canonical rules