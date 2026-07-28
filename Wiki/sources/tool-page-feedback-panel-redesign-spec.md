---
type: source-summary
tags:
  - wiki/source
  - ui-design
  - feedback-panel
  - job-system
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/specifications/tool-page-feedback-panel-redesign-spec.md
date_ingested: 2026-07-28
source_version: "1.1"
---

# Tool Page Feedback Panel Redesign Specification

Unified redesign for the right-column [[Wiki/entities/tool-page|ToolPage]] feedback panel, replacing four fragmented components ([[ToolWorkflowJobPanel]], [[ToolWorkflowJobStepTracker]], [[ToolStatusCard]], [[ToolGenerationFlowVertical]]) with a single state-driven `ToolFeedbackPanel` wrapper.

## Core Architecture

```
ToolFeedbackPanel
├── PreFlightReadiness          ← Phase 1: workspace + briefing check
├── JobProgressDashboard        ← Phase 2: progress bar, step tracker, CurrentActivity
│   ├── StatusBadge, StepTracker, ProgressBar, CurrentActivity, ActionBar
├── ErrorBanner                 ← Phase 2: retry + error display
└── ReconnectionNotice          ← stream disconnection feedback
```

## Design Principles

1. **Single source of truth**: One panel owns the right column
2. **State-driven, not feature-flagged**: Adapts to XState machine state
3. **Progressive disclosure**: Show what matters now
4. **Confidence-builder**: Always show the system is working
5. **Accessibility-first**: `aria-live` regions, focus management, keyboard navigation

## Key Design Decisions

### Pre-flight readiness lives inside the panel
[[ToolStatusCard]] was defined but never wired. It now lives as [[PreFlightReadiness]] in the initial state.

### Six states with visual layouts
Initial (readiness + walkthrough), Submitting (queued badge + indeterminate bar), Running (animated step tracker + context-aware activity), Completed (green celebration + View Results), Failed (red banner + saved progress + Retry), Cancelled (return to pre-flight).

### Motion is purposeful
Running step dot pulses at 1.2s, progress bar fills with 500ms ease-out, completed state 800ms fill. `prefers-reduced-motion` respected throughout.

### Governance compliance
- CTA Governance: [[frontend-ui-ubiquitous-language-spec|Pattern A (ui-button)]] for all four buttons
- Feedback Channels: [[frontend-ui-ubiquitous-language-spec|inline-action]] for errors/reconnection, [[frontend-ui-ubiquitous-language-spec|page-state]] for completion/cancel
- Design Tokens: zero new `:root` variables, all values from [[styles.css]] existing tokens

## Implementation Status

All four phases implemented in `feat/tool-workflow-job-system`:
- Phase 1 ✓: [[PreFlightReadiness]] extracted from [[ToolStatusCard]] logic
- Phase 2 ✓: [[ToolWorkflowJobPanel]] enhanced with CurrentActivity, View Results, Retry
- Phase 3 ✓: [[ToolFeedbackPanel]] wrapper created, ternary removed from [[ToolPageTemplate/]]
- Phase 4 ✓: Dead code removed ([[ToolWorkflowJobStepTracker]], [[ToolStatusCard]])

## What Was Deleted
- [[ToolWorkflowJobPanel]] (not deleted; enhanced as canonical job panel)
- [[ToolWorkflowJobStepTracker]] (replaced by inline step list)
- [[ToolStatusCard]] (replaced by [[PreFlightReadiness]])
- [[ToolGenerationFlowVertical]] (preserved for legacy non-job paths)

## Source
- File: `docs/02-design/specifications/tool-page-feedback-panel-redesign-spec.md`
- Version: 1.1
- Last reviewed: 2026-07-28
- Owner: UI Designer
- Status: implemented

## Contradictions
None.