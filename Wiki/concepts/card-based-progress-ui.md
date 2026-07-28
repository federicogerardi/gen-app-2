---
type: concept
tags:
  - wiki/concept
  - ui
  - progress-ui
  - card-based
  - accessibility
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_count: 1
confidence: high
---

# Card-Based Progress UI

Visual pattern for displaying multi-step workflow progress using card-based layout from the legacy [[ToolGenerationFlowVertical]] design system, adapted for BE-driven job feedback.

## Core Elements

1. **Progress bar** (`workflow-preload-bar`): Animated fill with `is-active`/`is-completed`/`is-idle` variants
2. **Status badge**: Color-coded text using semantic tokens (`--workspace-blue`, `--success-pine`, `--error-fg`)
3. **Step tracker**: Vertical list with colored left-border highlighting and pulsing dot animation
4. **N/N counter**: "Current step: 3 / 7 steps completed"
5. **CurrentActivity**: Human-readable description ("Crawling & scoring…")

## Visual States

| State | Progress Bar | Status Badge | Steps | Action |
|-------|-------------|-------------|-------|--------|
| Queued | indeterminate shimmer | "Queued" (muted) | all idle | [[PreFlightReadiness]] |
| Running | determinate fill | "Running" (blue) | active step highlighted | Cancel |
| Completed | full green | "Completed" (green) | all done | View Results |
| Failed | frozen at % | "Failed" (red) | failed step highlighted | Retry + Cancel |

## Token Compliance

Zero hardcoded colors. All values from [[styles.css]]:
- Status: `--workspace-blue`, `--success-pine`, `--error-fg`, `--text-muted`
- Background: `--interactive-soft`, `--error-bg`
- Borders: `--border-subtle`
- Radius: `--radius-card`, `--radius-button`, `--radius-chip`
- Spacing: `--space-micro`, `--space-1`, `--space-2`

## Accessibility

- `role="status"` + `aria-live="polite"` for CurrentActivity
- `aria-current="step"` on running step
- `role="progressbar"` on progress bar
- `role="alert"` on error banner
- `prefers-reduced-motion` respected on all animations

## Related
- [[Wiki/entities/job-progress-dashboard|JobProgressDashboard]]
- [[Wiki/concepts/unified-feedback-panel|Unified Feedback Panel]]
- [[Wiki/concepts/ui-governance|UI Governance]]
- [[frontend-ui-ubiquitous-language-spec]]