---
goal: Align Artifact checkpoint recovery behavior to updated DDD canonical rules (DDD-020, DDD-C-004)
version: 1.0
date_created: 2026-05-03
last_updated: 2026-05-03
owner: Frontend Platform Team
status: Completed
tags: [scope, ddd, artifact-relaunch, hydration, frontend]
---

# Scope Definition

## 1. Objective

Define and constrain the implementation scope needed to align artifact checkpoint recovery behavior with updated DDD rules:

- `ArtifactRelaunch` is a single domain concept (DDD-020).
- `HydrationResult` resolution is deterministic by source `ArtifactType`.
- One effective relaunch path must bring ToolPage to ready state with project + extraction context preloaded.
- No dual relaunch CTA semantics at domain level (DDD-C-004).

## 2. In Scope

- Align entry behavior from artifact detail/history so one relaunch action is domain-primary.
- Ensure hydration path is deterministic:
  - source artifact `extraction`: direct extraction-context recovery.
  - source artifact `content`: recovery through linked extraction context (`briefingId` and/or `extractionArtifactId`).
- Ensure ToolPage reaches ready semantics (`ReadinessSnapshot.canStartFlow = true`) when project and extraction context are available.
- Align UI copy and CTA policy to a single effective generation-start action after hydration.
- Add/adjust tests for both recovery branches (`extraction` and `content`) and CTA convergence.

## 3. Out Of Scope

- Backend machine architecture changes outside existing frontend hydration/relaunch flow.
- New artifact types or taxonomy changes in `ArtifactType`.
- Large UX redesign beyond CTA simplification/convergence required by DDD.
- Changes to quota, auth, or stream transport contracts.

## 4. Functional Requirements

- FR-001: Artifact relaunch must expose one domain-consistent entry action to ToolPage.
- FR-002: ToolPage hydration must be deterministic by `ArtifactType`.
- FR-003: For `content` artifacts, missing direct extraction payload must trigger linked lookup strategy, not fail-fast when references are resolvable.
- FR-004: After successful hydration, ToolPage must expose one effective primary generation-start CTA (`start-generation`) with ready prerequisites satisfied.
- FR-005: Readiness reason codes must remain canonical (`missing_project`, `missing_extraction_context`, `missing_primary_target_step`) and not introduce synonyms.

## 5. DDD Alignment Constraints

- Use canonical terms only: `ArtifactRelaunch`, `HydrationResult`, `ReadinessSnapshot`, `ExtractionContext`, `GenerationArtifact`.
- Do not introduce parallel terms for relaunch actions.
- Keep implementation-level aliases as technical details only; domain docs and behavior must follow canonical naming.

## 6. Primary Impact Areas

- `frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx`
- `frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx`
- `frontend/src/features/generation/ui/artifact-history.ts`
- `frontend/src/features/tools/ui/ToolPageTemplate.tsx`
- `frontend/src/features/tools/machines/tool-page.machine.ts`
- `frontend/src/app/copy/system.ts`

## 7. Test Scope

- `frontend/src/features/artifacts/pages/ArtifactDetailPage.test.tsx`
- `frontend/src/features/generation/ui/artifact-history.test.ts`
- `frontend/src/features/tools/machines/tool-page.machine.test.ts`
- `frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`

## 8. Acceptance Gates

- AG-001: Relaunch from one artifact uses one domain-primary CTA and one deterministic entry path.
- AG-002: Hydration succeeds for both branches:
  - extraction artifact direct recovery
  - content artifact linked extraction recovery
- AG-003: Ready state reached when project + extraction context are available; no false `missing_extraction_context`.
- AG-004: No regressions in existing resume/regenerate behavior that is still intentionally supported as implementation detail.
- AG-005: Frontend typecheck and relevant test suites pass.

## 9. Risks

- R-001: Existing tests assert dual CTA rendering; they will require intentional update.
- R-002: Current `intent='new'` query path may omit `sourceArtifactId`, risking loss of hydration context during relaunch.
- R-003: Copy-level dual labels (`relaunchPrimary`, `relaunchSecondary`) can reintroduce domain ambiguity if not consolidated.

## 10. Deliverable

- A behavior-aligned implementation where artifact-driven checkpoint recovery is DDD-consistent, deterministic by artifact type, and converges to a single effective generation-start flow in ToolPage.

## 11. Implementation Outcome

- Completed on 2026-05-03.
- Single relaunch CTA convergence implemented in artifact detail and artifact history entry points.
- `intent=new` entry now keeps `sourceArtifactId` to preserve deterministic hydration.
- `toolPageMachine` hydration flow aligned to deterministic branching by `ArtifactType`:
  - `extraction` source artifacts recover directly.
  - `content` source artifacts recover via linked extraction lookup.
- Targeted frontend typecheck and test suites passed.
