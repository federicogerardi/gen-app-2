---
type: concept
tags:
  - wiki/concept
  - ui
  - feedback-panel
  - unification
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_count: 2
confidence: high
---

# Unified Feedback Panel

Pattern of consolidating multiple fragmented UI components into a single state-driven panel that adapts to machine state rather than feature flags.

## Principle

> One component, one pattern, zero exceptions.

The [[Wiki/sources/tool-page-feedback-panel-redesign-spec|feedback panel redesign]] applied this principle to the [[Wiki/entities/tool-page|ToolPage]] Workflow Panel, mirroring the same unification principle used in the [[Wiki/concepts/registry-driven-routing|BE-driven routing refactoring]].

## Before → After

```
Before (4 components, 2 branches, 1 orphan):
  ToolWorkflowJobPanel + ToolWorkflowJobStepTracker (job branch)
  ToolGenerationFlowVertical (legacy branch)
  ToolStatusCard (defined but never wired)

After (1 wrapper, inline components):
  ToolFeedbackPanel
  ├── PreFlightReadiness (absorbed from ToolStatusCard)
  ├── ToolWorkflowJobPanel (enhanced with CurrentActivity, View Results, Retry)
  └── ToolGenerationFlowVertical (preserved for legacy path)
```

## Key Characteristics

- **State-driven**: Adapts to `panelStatus` (queued/running/completed/failed) not to `useJobSystem` flag
- **Progressive disclosure**: Show what matters now; defer what doesn't
- **Card-based**: Reuses `.ui-fv-card` pattern from legacy flow
- **Token-governed**: Zero new CSS variables, all colors from [[styles.css]] `:root`
- **CTA compliance**: All buttons use [[frontend-ui-ubiquitous-language-spec|Pattern A (ui-button)]]

## Related
- [[Wiki/entities/tool-feedback-panel|ToolFeedbackPanel]]
- [[Wiki/entities/job-progress-dashboard|JobProgressDashboard]]
- [[Wiki/concepts/card-based-progress-ui|Card-Based Progress UI]]
- [[Wiki/concepts/registry-driven-routing|Registry-Driven Routing]]
- [[Wiki/concepts/ui-governance|UI Governance]]