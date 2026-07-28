---
type: entity
tags:
  - wiki/entity
  - component-wrapper
  - feedback-panel
  - ui
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_count: 1
entity_type: component-wrapper
---

# ToolFeedbackPanel

Unified wrapper component that encapsulates the job-system vs legacy-flow branching for the right-column [[Wiki/entities/tool-page|ToolPage]] Workflow Panel. Created as Phase 3 of the [[Wiki/sources/tool-page-feedback-panel-redesign-spec|feedback panel redesign]].

## Architecture

```
ToolFeedbackPanel
├── useJobSystem && pendingJobId ?
│   └── <ToolWorkflowJobPanel>    ← canonical job panel (BE-driven)
└── else:
    └── <ToolGenerationFlowVertical>  ← legacy flow (deprecated)
```

## Props Contract

Accepts all props needed by both sub-panels:
- **Branching**: `useJobSystem`, `pendingJobId`
- **Job system**: stepItems, stepLabels, sessionId, workspace/briefing readiness, callbacks
- **Legacy flow**: canonicalState, generationProgress, primaryActionCta

## Design Decisions

- [[frontend-ui-ubiquitous-language-spec|exactOptionalPropertyTypes]] handled via conditional spread (`{...(x ? { x } : {})}`)
- No feature flag exposed to [[ToolPageTemplate/]] — branching delegated to wrapper
- Type import `ToolGenerationFlowVerticalProps` preserved for CTA type in template

## What It Replaced

The inline ternary in [[ToolPageTemplate/]]:
```tsx
{useJobSystem && pendingJobId ? <ToolWorkflowJobPanel .../> : <ToolGenerationFlowVertical .../>}
```

Now: `<ToolFeedbackPanel .../>`

## Related
- [[Wiki/entities/job-progress-dashboard|JobProgressDashboard (ToolWorkflowJobPanel)]]
- [[Wiki/entities/pre-flight-readiness|PreFlightReadiness]]
- [[Wiki/concepts/unified-feedback-panel|Unified Feedback Panel]]
- [[Wiki/concepts/card-based-progress-ui|Card-Based Progress UI]]
- [[ToolGenerationFlowVertical]] (legacy, preserved for non-job paths)

## Source
- Spec: `docs/02-design/specifications/tool-page-feedback-panel-redesign-spec.md`
- Implementation: `apps/frontend/src/features/tools/ui/ToolFeedbackPanel.tsx`