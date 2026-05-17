---
goal: Refactor frontend in 2 safe PRs by extracting ListingTableSection first, then Upload and CTA wrappers
version: 1.0
date_created: 2026-05-11
last_updated: 2026-05-12
owner: Frontend Platform Team
status: archived
last-reviewed: 2026-05-16
next-review-date: 2027-05-16
tags: [refactor, frontend, ui, listing, upload, cta, safety]
---

# Introduction

![Status: Archived](https://img.shields.io/badge/status-Archived-lightgrey)

This plan defines a deterministic two-PR refactor sequence with low regression risk. PR-1 extracts a reusable ListingTableSection pattern from existing Artifact and Session listings. PR-2 standardizes Upload and CTA rendering via wrappers while preserving current domain behavior and route semantics.

## 1. Requirements & Constraints

- **REQ-001**: Execute refactor in exactly two pull requests: PR-1 `ListingTableSection`, PR-2 `Upload/CTA wrappers`.
- **REQ-002**: Preserve runtime behavior of `ArtifactsListingSection` and `SessionsListingSection` (filters, pagination, routes, empty/error states).
- **REQ-003**: Preserve Tool Workspace orchestration behavior in `ToolPageTemplate` and `useToolPage`.
- **REQ-004**: Keep canonical route semantics unchanged: `/artifacts/*` and `/sessionsummary/*`.
- **SEC-001**: Do not introduce navigation actions that bypass current auth-gated routing structure.
- **QLT-001**: Keep visual parity in light/dark themes for listing tables and CTA states.
- **CON-001**: No breaking changes to public component contracts used by pages under `apps/frontend/src/features/**/pages`.
- **CON-002**: No database, backend API, or contract changes are allowed.
- **GUD-001**: Reuse canonical UI terms and archetypes from `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`.
- **GUD-002**: Respect button contrast and variant rules from `docs/02-design/specifications/frontend-design-system-ui-kit-guide.md`.
- **PAT-001**: Apply strangler-fig replacement: introduce shared components first, then migrate call sites incrementally.
- **PAT-002**: Prefer composition via props over inheritance; wrappers must be thin and deterministic.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Deliver PR-1 with a reusable `ListingTableSection` abstraction and migrate existing listings without behavior changes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/frontend/src/app/ui/ListingTableSection.tsx` that renders title, loading/error/empty states, table scaffold, and optional pagination slot; expose deterministic props (`title`, `headingLevel`, `loading`, `error`, `isEmpty`, `emptyMessage`, `columns`, `rows`, `renderCell`, `paginationNode`). | ✅ | 2026-05-11 |
| TASK-002 | In `apps/frontend/src/features/artifacts/ui/ArtifactsListingSection.tsx`, replace duplicated table-state markup with `ListingTableSection`; keep existing data selection logic (`items`, `projectNameById`, filters) unchanged. | ✅ | 2026-05-11 |
| TASK-003 | In `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx`, replace duplicated table-state markup with `ListingTableSection`; keep existing session-specific labels (`statusLabel`, `toolLabel`) unchanged. | ✅ | 2026-05-11 |
| TASK-004 | Keep `apps/frontend/src/app/ui/PaginationBlockControls.tsx` as pagination implementation and pass it via `paginationNode` to the new listing component in both call sites. | ✅ | 2026-05-11 |
| TASK-005 | Add/adjust tests for listing rendering parity in `apps/frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx` and `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.test.tsx` to assert headings, table headers, and detail-link routes remain unchanged. | ✅ | 2026-05-11 |

### Implementation Phase 2

- GOAL-002: Deliver PR-2 with standardized Upload and CTA wrappers and migrate agreed call sites with visual parity.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `apps/frontend/src/app/ui/UploadFieldButton.tsx` wrapper for file upload CTA with deterministic props (`label`, `disabled`, `accept`, `onFileSelected`, `icon`, `fullWidth`, `minHeight`) and internal `<input type="file" hidden>`. | ✅ | 2026-05-11 |
| TASK-007 | Replace upload button block in `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` with `UploadFieldButton` while preserving `handleBriefingFileSelected` and `handleBriefingReset` behavior. | ✅ | 2026-05-11 |
| TASK-008 | Create CTA wrappers in `apps/frontend/src/app/ui/CtaButtons.tsx`: `PrimaryCtaButton`, `SecondaryCtaButton`, `SoftCtaButton`; map wrappers deterministically to MUI variants and approved style tokens. | ✅ | 2026-05-11 |
| TASK-009 | Migrate CTA call sites with highest duplication first: `apps/frontend/src/features/tools/ui/ToolActionButtons.tsx`, `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`, `apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx`. | ✅ | 2026-05-11 |
| TASK-010 | Add/adjust snapshot tests in `apps/frontend/src/features/tools/ui/ToolActionButtons.snapshot.test.tsx` and targeted behavior tests in `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx` to verify labels, disabled states, and routes are unchanged. | ✅ | 2026-05-11 |

### Implementation Phase 3

- GOAL-003: Validate both PRs with deterministic quality gates and document convergence results.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Run `npm --workspace apps/frontend run typecheck` after each PR and store pass/fail result in PR description checklist. | ✅ | 2026-05-11 |
| TASK-012 | Run focused tests for touched areas (`Artifacts`, `SessionsSummary`, `ToolActionButtons`, `ArtifactDetail`) and capture pass/fail matrix per PR. | ✅ | 2026-05-11 |
| TASK-013 | Execute visual sanity check for light/dark states of listing tables, upload button, and CTA wrappers; record screenshots in PR comments. | ✅ | 2026-05-12 |
| TASK-014 | Update plan tracking table in `upgrade-frontend-ui-unification-plan-1.md` by adding completion notes for the two-PR refactor sequence. | ✅ | 2026-05-11 |

## 3. Alternatives

- **ALT-001**: Single large PR with Listing + Upload/CTA combined. Rejected due to higher regression surface and slower review.
- **ALT-002**: Keep local duplication and only patch styles when regressions appear. Rejected because it increases long-term drift and maintenance cost.
- **ALT-003**: Introduce a third-party table abstraction library. Rejected to avoid unnecessary dependencies and migration overhead.

## 4. Dependencies

- **DEP-001**: Existing MUI stack in `apps/frontend` (`@mui/material`, `@emotion/react`, `@emotion/styled`).
- **DEP-002**: Existing shared primitives in `apps/frontend/src/app/ui/primitives.tsx` and `apps/frontend/src/styles.css`.
- **DEP-003**: Existing pagination component `apps/frontend/src/app/ui/PaginationBlockControls.tsx`.
- **DEP-004**: Existing test stack configured in `apps/frontend/package.json`.

## 5. Files

- **FILE-001**: `apps/frontend/src/app/ui/ListingTableSection.tsx` — new shared listing table section component.
- **FILE-002**: `apps/frontend/src/features/artifacts/ui/ArtifactsListingSection.tsx` — migrate to `ListingTableSection`.
- **FILE-003**: `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx` — migrate to `ListingTableSection`.
- **FILE-004**: `apps/frontend/src/app/ui/UploadFieldButton.tsx` — new shared upload button wrapper.
- **FILE-005**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — replace local upload button markup.
- **FILE-006**: `apps/frontend/src/app/ui/CtaButtons.tsx` — new shared CTA wrappers.
- **FILE-007**: `apps/frontend/src/features/tools/ui/ToolActionButtons.tsx` — migrate CTA usage.
- **FILE-008**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx` — migrate CTA usage.
- **FILE-009**: `apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx` — migrate CTA usage.
- **FILE-010**: `apps/frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx` — listing parity assertions.
- **FILE-011**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.test.tsx` — listing parity assertions.
- **FILE-012**: `apps/frontend/src/features/tools/ui/ToolActionButtons.snapshot.test.tsx` — CTA snapshot parity.
- **FILE-013**: `apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx` — CTA behavior parity.

## 6. Testing

- **TEST-001**: Run `npm --workspace apps/frontend run typecheck` after PR-1 and PR-2; expected result: exit code 0.
- **TEST-002**: Run targeted tests for listing pages and detail navigation; expected result: all touched tests pass.
- **TEST-003**: Run snapshot tests for tool CTA buttons; expected result: snapshots updated only where wrapper DOM differs without semantic changes.
- **TEST-004**: Manual route verification: `/artifacts`, `/sessionsummary`, `/artifacts/:id`, `/tools/*`; expected result: labels, actions, and destinations unchanged.
- **TEST-005**: Manual visual verification in light/dark theme for upload and CTA contrast; expected result: conforms to design-system button rules.

## 7. Risks & Assumptions

- **RISK-001**: Over-generalization in `ListingTableSection` may hide page-specific needs and force prop complexity.
- **RISK-002**: CTA wrapper migration can unintentionally alter disabled/hover/focus visual states.
- **RISK-003**: Upload wrapper can break file selection flow if event propagation differs from current inline implementation.
- **ASSUMPTION-001**: Existing listing and CTA tests cover enough behavioral invariants to detect regressions.
- **ASSUMPTION-002**: No pending concurrent refactor modifies the same target files during the two-PR window.

## 8. Related Specifications / Further Reading

- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/frontend-design-system-ui-kit-guide.md`
- `upgrade-frontend-ui-unification-plan-1.md`