---
goal: Implement Tool File Compilation Instructions in the Tool Workspace Page
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Frontend Platform Team
status: Completed
tags: [feature, frontend, tool-workspace-page, copy, registry, ui]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan adds a reusable, registry-driven section called "Istruzioni compilazione file" inside the Tool Workspace Page Setup Panel. The goal is to help users understand, per Tool, which files must be uploaded and which fields each document must contain, without hardcoding tool-specific copy in each page component.

## 1. Requirements & Constraints

- **REQ-001**: Add a canonical instruction section labeled "Istruzioni compilazione file" to the Tool Workspace Page Setup Panel for supported tools.
- **REQ-002**: Represent file-compilation guidance as typed metadata per Tool, with canonical support for a section title and required fields list.
- **REQ-003**: Render the instruction section from a generic frontend component so the UI does not duplicate tool-specific copy across page wrappers.
- **REQ-004**: Keep the implementation aligned with canonical UI governance for Tool Workspace Page composition and Setup Panel hierarchy.
- **REQ-005**: Keep the instruction content in Italian while preserving canonical domain terms such as Tool Workspace Page, Setup Panel, BriefingFile, AngleDetectorFile, ExtractionContext, and ToolStep.
- **REQ-006**: Support future tools and future step variants by extending registry data only, not by adding new page-specific rendering logic.
- **UX-001**: Render the instructions as a deterministic inline guidance accordion inside the Tool Workspace Page Setup Panel, directly below the primary upload/form controls and above secondary helper content.
- **UX-002**: Keep the instructions closed by default and expandable on demand; do not use tabs or popovers.
- **UX-003**: Render only the required fields list inside the instruction body.
- **UX-004**: Hide the section when no instruction payload exists.
- **UX-005**: Keep the section lightweight and visually secondary to the main form flow; avoid nested cards.
- **SEC-001**: Render only static guidance derived from trusted frontend configuration; do not accept raw HTML or untrusted markdown for the instruction body.
- **SEC-002**: Do not expose internal parsing or validation implementation details beyond what is necessary for the user to compile the file correctly.
- **CON-001**: Do not add a separate backend endpoint for this feature unless a later phase proves registry-based frontend rendering is insufficient.
- **CON-002**: Do not introduce per-tool bespoke JSX copies in individual tool pages if the same content can be driven by registry metadata.
- **GUD-001**: Reuse the existing Tool Workspace Page composition, copy infrastructure, and tool registry patterns already present in the frontend.
- **GUD-002**: Keep the new section visually consistent with the Setup Panel and avoid nested cards unless a single card is strictly necessary for semantic grouping.
- **PAT-001**: Prefer a typed registry as the single source of truth for tool instructions and derive rendering from that registry.
- **PAT-002**: Keep the instruction model close to the existing tool configuration model so that tool onboarding stays one-step: define data, render guidance, add tests.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define the typed registry model for tool file-compilation instructions and populate the canonical data source.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add a typed instruction model in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`. The model includes `title` and `requiredFields`, keyed by `SupportedTool`. | Yes | 2026-05-21 |
| TASK-002 | Populate the registry with canonical instruction entries for `funnel-pages`, `nextland`, `youtube-lf-script`, and `angle-generator`, aligned with required field guidance and current Tool behavior. | Yes | 2026-05-21 |
| TASK-003 | Add a selector/helper in `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` that returns the active instruction payload for a given `SupportedTool`, with a null-safe fallback when a tool has no registry entry. | Yes | 2026-05-21 |

Exit Gate - Phase 1 (GO/NO-GO):
- **GATE-001**: The instruction model is typed and keyed by `SupportedTool`. ✅
- **GATE-002**: All supported tools have a registry entry or an explicit fallback rule. ✅
- **GATE-003**: Typecheck succeeds without introducing new tool-page or registry type errors. ✅

### Implementation Phase 2

- GOAL-002: Render the reusable instruction section in the Tool Workspace Page and connect it to the existing copy and layout structure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Create a reusable frontend component in `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx` that renders title + required fields in a deterministic instruction section. | Yes | 2026-05-21 |
| TASK-005 | Integrate the reusable component into `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` so the section appears in the Setup Panel for supported tools, directly below the primary upload/form controls and above secondary helper content, using default-closed accordion behavior. | Yes | 2026-05-21 |
| TASK-006 | Update `apps/frontend/src/app/copy/system.ts` only for shared labels or section titles that must remain centrally managed, and update `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` plus `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` to document the new registry-driven instruction section and its canonical placement in the Tool Workspace Page Setup Panel. | Yes | 2026-05-21 |
| TASK-007 | Ensure the new section respects the canonical Tool Workspace Page layout rules from the frontend UI specification, including one consistent setup-panel hierarchy and no duplicated card stacks. | Yes | 2026-05-21 |

Exit Gate - Phase 2 (GO/NO-GO):
- **GATE-004**: The Setup Panel renders the instruction section without changing the canonical two-column Tool Workspace Page composition. ✅
- **GATE-005**: The new section is driven by registry data and not by per-page hardcoded content. ✅
- **GATE-006**: Copy remains localized and deterministic, with no fallback to raw tool-specific inline strings outside the registry. ✅

### Implementation Phase 3

- GOAL-003: Add regression coverage for registry data, section rendering, and tool-specific content correctness.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Add unit tests for the instruction registry helper in `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts`. Verify that each supported tool resolves to the expected instruction payload and that the fallback branch is deterministic. | Yes | 2026-05-21 |
| TASK-009 | Add component tests for `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx` to verify default-closed accordion behavior, required fields rendering, and hidden section when no payload is available. | Yes | 2026-05-21 |
| TASK-010 | Add or extend `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` so each supported tool page renders the new instruction section with the correct tool-specific content and toggle behavior. | Yes | 2026-05-21 |
| TASK-011 | Run the targeted frontend validation commands for the touched slice, including the frontend build and the three targeted test files `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts`, `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx`, and `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`, then record the results in the plan once the implementation lands. | Yes | 2026-05-21 |

Exit Gate - Phase 3 (GO/NO-GO):
- **GATE-007**: Registry tests verify the canonical payload per Tool. ✅
- **GATE-008**: Component tests verify the section structure and visibility rules. ✅
- **GATE-009**: Frontend build and targeted tests pass without introducing new warnings or runtime errors in the Tool Workspace Page slice. ✅

## 3. Alternatives

- **ALT-001**: Hardcode the instruction copy in each Tool page wrapper. Rejected because it duplicates content, increases drift risk, and makes future tool onboarding expensive.
- **ALT-002**: Store the instructions as markdown files per Tool and load them independently. Rejected because the UI would still need a rendering and validation layer, and the content would drift from the typed tool configuration.
- **ALT-003**: Move the instruction content to a backend endpoint. Rejected because the guidance is static configuration and should stay in the frontend registry with the rest of the Tool page metadata.

## 4. Dependencies

- **DEP-001**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` as the canonical registry module that owns Tool configuration data.
- **DEP-002**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` for Tool Workspace Page composition.
- **DEP-003**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` for derived page data and view-model helpers.
- **DEP-004**: `apps/frontend/src/app/copy/system.ts` for shared UI copy keys and labels.
- **DEP-005**: `apps/frontend/src/features/tools/machines/tool-flow.machine.ts` and the canonical ToolStep definitions for tool-specific step guidance.
- **DEP-006**: Canonical DDD and UI governance documents: `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`, and `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`.
- **DEP-007**: `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` for canonical Tool Workspace Page composition and registry-driven UI guidance.

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` - typed tool instruction registry source of truth.
- **FILE-002**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` - selector/helper that resolves the active instruction payload.
- **FILE-003**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx` - reusable section component for rendering file-compilation instructions.
- **FILE-004**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` - Tool Workspace Page integration point in the Setup Panel.
- **FILE-005**: `apps/frontend/src/app/copy/system.ts` - shared section title and any canonical UI copy keys.
- **FILE-006**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` - registry resolution tests.
- **FILE-007**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx` - section rendering tests.
- **FILE-008**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` - page integration tests.
- **FILE-009**: `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` - architecture spec update for the new instruction section.
- **FILE-010**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` - UI vocabulary update for the new instruction section name and its canonical placement in the Tool Workspace Page Setup Panel.

## 6. Testing

- **TEST-001**: Registry resolution test verifies that each supported Tool returns the correct instruction payload.
- **TEST-002**: Angle Generator content test verifies that the guidance explicitly requires both `BriefingFile` and `AngleDetectorFile`.
- **TEST-003**: Youtube LF Script content test verifies that the instruction payload reflects the canonical extraction fields and minimum readiness-related guidance.
- **TEST-004**: ToolPageTemplate integration test verifies that the instruction section renders in the Setup Panel for supported tools and remains absent when no payload is available.
- **TEST-005**: Component test verifies that required files, required fields, optional fields, examples, notes, and step constraints render in the expected order.
- **TEST-006**: Frontend build test verifies the tool page slice compiles after the registry and UI changes.

## 7. Risks & Assumptions

- **RISK-001**: Tool-specific instruction content can drift from the actual extraction logic if the registry is updated without corresponding validation tests.
- **RISK-002**: Adding too much prose to the Setup Panel may reduce scan speed if the section becomes visually heavy or repeats existing helper copy.
- **RISK-003**: A future Tool may require a distinct file-completion shape that needs a registry extension, not just new values, which is why the schema must stay flexible.
- **ASSUMPTION-001**: The current frontend tool registry is the correct single source of truth for Tool-specific configuration and can host additional metadata without a backend change.
- **ASSUMPTION-002**: The existing Tool Workspace Page layout can accommodate one additional guidance section without violating the canonical two-column composition.
- **ASSUMPTION-003**: The required field lists for each Tool are already known from the current extraction and readiness logic and can be copied into typed metadata without inventing new domain terms.

## 8. Related Specifications / Further Reading

[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Specification](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Tool Page Architecture Notes](../docs/02-design/specifications/frontend-tool-pages-architecture-spec.md)