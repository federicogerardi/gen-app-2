---
type: entity
tags:
  - wiki/entity
  - component
  - preflight
  - readiness
  - ui
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_count: 1
entity_type: component
---

# PreFlightReadiness

Readiness checklist component displayed inline in [[Wiki/entities/job-progress-dashboard|JobProgressDashboard]] during the 'queued' state — the moment between "Start Generation" and the backend picking up the job.

## What It Shows

```
┌─ Pre-flight readiness ──────────────────┐
│ Before you start, make sure:             │
│  ●  Workspace  Summer Campaign 2026      │
│  ●  Brief      campaign-brief-v2.docx    │
└──────────────────────────────────────────┘
```

- Green dot + project name, or gray dot + "Select a workspace"
- Green dot + file name, or gray dot + "Upload a briefing document"

## Architecture

- Extracted from [[ToolStatusCard]] logic (which was defined but never wired)
- Uses existing `.ui-fv-card` pattern with `--surface-glass` background
- Copy from `appCopy.ui.toolPage.feedbackPanel`
- `role="status"` for screen reader announcement
- Error slot (`<div className={uiPrimitives.error} hidden>`) for [[ToolFeedbackPanel]] to populate on submit failure

## Props

```
workspaceName: string | null
briefingFileName: string | null
isBriefingReady: boolean
```

## Implementation

- Created in Phase 1 of [[Wiki/sources/tool-page-feedback-panel-redesign-spec|feedback panel redesign]]
- Shown only when `panelStatus === 'queued'` in [[ToolWorkflowJobPanel]]

## Source
- Implementation: `apps/frontend/src/features/tools/ui/PreFlightReadiness.tsx`
- Spec: `docs/02-design/specifications/tool-page-feedback-panel-redesign-spec.md`
- Absorbs: [[ToolStatusCard]] (deleted in Phase 4)