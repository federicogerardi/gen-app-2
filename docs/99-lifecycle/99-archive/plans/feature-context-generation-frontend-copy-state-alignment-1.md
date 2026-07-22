---
goal: Frontend Tool Page alignment to Context Generation bounded-context semantics (copy + state consumption)
version: 1.0
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Frontend Platform Team
status: completed
tags: [feature, frontend, tool-workspace, context-generation, copy, xstate, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic implementation path to align Frontend Tool Workspace copy and state-consumption projections with the canonical `ContextGenerationPhase` umbrella semantics while preserving current runtime behavior, feature-flag rollout constraints, and backward compatibility for existing tools.

## 1. Requirements & Constraints

- **REQ-001**: Use canonical terms from DDD governance: `ContextGenerationPhase`, `Start Context Generation Action`, and `ToolInputRequirementMatrix`.
- **REQ-002**: Keep one primary pre-step trigger in Tool Workspace; no second top-level CTA for API acquisition.
- **REQ-003**: Centralize all changed user-facing Tool Page copy in `apps/frontend/src/app/copy/system.ts`.
- **REQ-004**: Preserve runtime state keys and machine event names (`processing-briefing`, `BRIEFING_EXTRACTION_REQUESTED`, `EXTRACTION_*`) to avoid behavior regressions.
- **REQ-005**: Maintain transitional CTA visible copy `Avvia estrazione` unless explicitly changed by product decision.
- **REQ-006**: Ensure Workflow Panel phase/status strings reflect umbrella semantics instead of extraction-only wording where applicable.
- **REQ-007**: Keep `api-acquisition` rollout semantics unchanged: default-off via `VITE_FF_TOOLS_API_BINDING_STATUS` and enabled-path connected/disconnected projection.
- **SEC-001**: Do not expose internal transport/error tokens in UI copy (`stream_empty_output`, `extraction_context_insufficient`).
- **CON-001**: No backend contract change is allowed in this plan.
- **CON-002**: No lockfile/dependency changes are allowed in this plan.
- **CON-003**: Scope is limited to FE copy and FE state-consumption text projection for Tool Workspace surfaces.
- **GUD-001**: Apply minimal coherent edits; avoid renaming domain/runtime symbols outside copy authority.
- **PAT-001**: Follow existing copy authority pattern (`appCopy`) and projection pattern used by `ToolPageTemplate` and `ToolGenerationFlowVertical`.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define canonical copy contract for Context Generation umbrella semantics without changing runtime control flow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update Tool Page copy map in `apps/frontend/src/app/copy/system.ts` for phase/status/tooltip wording: `phaseExtractionLabel`, `statusByCanonicalState['processing-briefing']`, `defaultExtractionStepLabel`, `extraction.startActionTooltip`; keep `extraction.startActionLabel = 'Avvia estrazione'` transitional. | ✅ | 2026-05-24 |
| TASK-002 | Add explicit copy keys for umbrella wording if needed (example: `contextGenerationPhaseLabel`, `contextGenerationInProgressLabel`) and wire existing consumers to these keys only through `appCopy`. | ✅ | 2026-05-24 |
| TASK-003 | Validate no hardcoded extraction-only literals remain in Tool Workspace UI components by scanning `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` and `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx`. | ✅ | 2026-05-24 |

### Implementation Phase 2

- GOAL-002: Align Tool Workspace UI projections and tests with updated copy contract while preserving behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Verify/wire phase title and status projections in `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` to updated copy keys (`phaseTitle`, progress aria labels, extraction metric fallbacks). | ✅ | 2026-05-24 |
| TASK-005 | Verify/wire primary CTA override text path in `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` for `canStartExtraction` branch to use updated tooltip and transitional label. | ✅ | 2026-05-24 |
| TASK-006 | Update test expectations in `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx`, `apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx`, and `apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx` to match new copy outputs. | ✅ | 2026-05-24 |

### Implementation Phase 3

- GOAL-003: Execute deterministic validation gates and publish-ready checks for FE copy/state alignment.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Run focused FE tests: `npm --workspace apps/frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx src/features/tools/runtime/tool-page-selectors.test.ts src/features/tools/runtime/tool-api-binding-status-adapter.test.ts`. | ✅ | 2026-05-24 |
| TASK-008 | Run FE static/build gates: `npm --workspace apps/frontend run typecheck` and `npm --workspace apps/frontend run build`. | ✅ | 2026-05-24 |
| TASK-009 | Run DDD copy drift scan: `rg -n "Fase: Estrazione|Estrazione briefing|Avvia l'estrazione del contesto briefing" apps/frontend/src/features/tools apps/frontend/src/app/copy/system.ts` and confirm remaining hits are either transitional-approved or updated. | ✅ | 2026-05-24 |

## 3. Alternatives

- **ALT-001**: Rename runtime state/event symbols from extraction-centric names (`processing-briefing`, `BRIEFING_EXTRACTION_REQUESTED`) to context-generation names now. Not chosen because it exceeds copy/state-consumption scope and increases regression risk.
- **ALT-002**: Introduce a second pre-step CTA for API acquisition. Not chosen because it violates canonical `Start Context Generation Action` single-trigger contract.
- **ALT-003**: Keep all current extraction-centric copy unchanged. Not chosen because it conflicts with current BC governance and mixed-source semantics.

## 4. Dependencies

- **DEP-001**: Canonical vocabulary and governance docs: `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-002**: UI governance: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`.
- **DEP-003**: Runtime source-of-truth docs: `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`, `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`.
- **DEP-004**: Existing adapter/flag semantics in `apps/frontend/src/features/tools/runtime/tool-api-binding-status-adapter.ts`.

## 5. Files

- **FILE-001**: `apps/frontend/src/app/copy/system.ts` — canonical copy authority for Tool Workspace labels/status/tooltip.
- **FILE-002**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` — phase/status projection consumer.
- **FILE-003**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — primary CTA override consumer.
- **FILE-004**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.test.tsx` — phase and status text assertions.
- **FILE-005**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.test.tsx` — CTA label assertions.
- **FILE-006**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.extraction-cta.single-file.test.tsx` — single-file CTA label assertions.
- **FILE-007**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` — integration coverage for Tool Workspace behavior.

## 6. Testing

- **TEST-001**: Verify Tool Workspace renders umbrella-aligned phase text for `processing-briefing` state in `ToolGenerationFlowVertical` tests.
- **TEST-002**: Verify CTA remains clickable and labeled with transitional text `Avvia estrazione` where policy dictates.
- **TEST-003**: Verify tooltip reflects umbrella context-generation wording and not extraction-only wording.
- **TEST-004**: Verify API acquisition payload section copy remains stable (`Acquisizione API`, connected/disconnected labels) and unaffected by umbrella rename.
- **TEST-005**: Verify no regression in matrix gating semantics (`requiredEntriesSatisfied` controls primary action enablement).

## 7. Risks & Assumptions

- **RISK-001**: Copy-only alignment may create mismatch with extraction-centric internal symbol names, causing confusion for future contributors.
- **RISK-002**: Test brittleness due to exact string expectations in Tool UI tests.
- **RISK-003**: Over-broad wording changes may accidentally alter intended transitional CTA contract.
- **ASSUMPTION-001**: Product decision keeps visible CTA string `Avvia estrazione` in current transition cycle.
- **ASSUMPTION-002**: No backend API or contract changes are required for this scope.
- **ASSUMPTION-003**: Feature flag `VITE_FF_TOOLS_API_BINDING_STATUS` remains default-off for production rollout baseline.

## 8. Related Specifications / Further Reading

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md`
- `../../../99-lifecycle/99-archive/plans/feature-context-generation-backend-first-1.md`
- `../../../99-lifecycle/99-archive/plans/refactor-frontend-copy-unification-1.md`
