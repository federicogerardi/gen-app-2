---
type: entity
tags:
  - wiki/entity
  - component
  - dashboard
  - progress
  - ui
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_count: 1
entity_type: component
---

# JobProgressDashboard (ToolWorkflowJobPanel)

The canonical BE-driven job progress panel. This is the `ToolWorkflowJobPanel` component, enhanced across Phase 1-2 of the [[Wiki/sources/tool-page-feedback-panel-redesign-spec|feedback panel redesign]]. It renders inside [[Wiki/entities/tool-feedback-panel|ToolFeedbackPanel]] when `useJobSystem && pendingJobId`.

## Visual Structure

```
┌─ PreFlightReadiness (queued) ────────────┐  ← Phase 1
├─ Progress bar + status badge ────────────┤
├─ CurrentActivity (Phase 2) ──────────────┤  ← "Crawling & scoring…"
├─ Step counter (N/N) ─────────────────────┤
├─ Step tracker (colored rows) ────────────┤
├─ Error + Retry (failed) ─────────────────┤  ← Phase 2
├─ Reconnecting notice ────────────────────┤
└─ ActionBar ──────────────────────────────┘  ← Phase 2
    Running → Cancel | Completed → View Results | Failed → Retry
```

## State-Driven Rendering

| panelStatus | Shows |
|---|---|
| `queued` | [[Wiki/entities/pre-flight-readiness|PreFlightReadiness]] + indeterminate bar |
| `running` | Progress bar + animated step tracker + Cancel |
| `completed` | Full green bar + all steps done + View Results |
| `failed` | Frozen bar + failed step highlight + Error + Retry |

## Design Tokens

Zero hardcoded colors. All from [[styles.css]] `:root`:
- Status colors: `--workspace-blue`, `--success-pine`, `--error-fg`
- Backgrounds: `--interactive-soft`, `--error-bg`
- Spacing: `--space-micro`, `--space-1`, `--space-2`

## Key Features

- [[Wiki/concepts/card-based-progress-ui|Card-Based Progress UI]]: reuses `.ui-fv-card`, `.workflow-preload-bar`
- [[frontend-ui-ubiquitous-language-spec|CTA Pattern A]]: Cancel, View Results, Retry all use `uiPrimitives.button`
- Step highlighting: blue left border + pulsing dot for active, green for done, red for error
- `role="status"` + `aria-live="polite"` on CurrentActivity
- `aria-current="step"` on running step

## Source
- Implementation: `apps/frontend/src/features/tools/ui/ToolWorkflowJobPanel.tsx`
- Spec: `docs/02-design/specifications/tool-page-feedback-panel-redesign-spec.md`
- Replaces: [[ToolWorkflowJobStepTracker]] (deleted), [[ToolStatusCard]] (deleted)