---
goal: Implement Runtime Convergence for DDD Extraction Field Naming (DDD-079)
version: 1.1
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Frontend Platform Team
status: Completed
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [feature, frontend, backend, ddd, extraction, naming, runtime, convergence]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan implements runtime convergence of extraction-field naming according to DDD-079 by enforcing canonical ExtractionFieldKey payload identifiers and deterministic ExtractionFieldLabel projection in Tool Workspace guidance.

## 1. Requirements & Constraints

- **REQ-001**: Enforce canonical ExtractionFieldKey identifiers in runtime extraction payload handling for all supported tools (`funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`).
- **REQ-002**: Remove mixed required-field lists (localized labels plus raw keys in the same list) in Tool File Instructions runtime rendering.
- **REQ-003**: Implement deterministic key-to-label projection for Tool File Instructions required fields.
- **REQ-004**: Keep backward compatibility for existing payloads during one deprecation cycle by normalizing known legacy aliases to canonical keys.
- **REQ-005**: Keep extraction readiness logic deterministic, tool-aware, and scalable through explicit per-tool readiness key sets that can evolve without machine code rewrites.
- **REQ-006**: Maintain existing Tool Workspace page composition and accordion behavior while updating naming semantics.
- **SEC-001**: Accept only known key aliases in normalization; reject unknown dynamic keys from UI projection maps.
- **SEC-002**: Do not execute or render untrusted rich text in field labels; labels must come from static runtime maps.
- **QAL-001**: Add compile-time guards that guarantee every SupportedTool required field key has a label mapping.
- **CON-001**: Do not change external API endpoint surface for this convergence.
- **CON-002**: Do not introduce database migrations in this scope.
- **GUD-001**: Reuse existing Tool registry and extraction validity architecture instead of adding parallel runtime paths.
- **GUD-002**: Keep DDD artifacts synchronized with runtime semantics in the same implementation cycle.
- **PAT-001**: Use one authoritative runtime map for per-tool required extraction keys and labels.
- **PAT-002**: Keep normalization logic deterministic with explicit key alias tables and no heuristic matching.
- **PAT-003**: Keep `InstructionRequiredExtractionFieldKeysByTool` and `ReadinessRequiredExtractionFieldKeysByTool` as separate canonical maps to avoid semantic coupling between UI guidance and generation gating.
- **PAT-004**: Use one shared canonical extraction-field matrix contract across Frontend and Backend runtime paths to prevent FE/BE drift.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Register canonical extraction field key terms before runtime implementation (DDD-first gate).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Update `docs/07-governance/domain-naming-decision-log.md` and `docs/01-requirements/domain-ubiquitous-language-glossary.md` with: (a) the canonical catalog of non-youtube ExtractionFieldKey terms introduced in runtime (`funnel_goal`, `target_audience`, `primary_cta`, `website_goal`, `brand_or_company`, `offer_or_service`, `required_sections`, `goal`, `product_or_service`, `market`, `creative_constraints`), and (b) readiness governance addendum defining a scalable map-driven policy (`ReadinessRequiredExtractionFieldKeysByTool`) that is extensible without machine code rewrites. | Yes | 2026-05-21 |

Exit Gate - Phase 0 (GO/NO-GO):
- **GATE-000**: Every new ExtractionFieldKey term used in runtime is pre-registered in DDD artifacts.
- **GATE-000B**: DDD governance explicitly records scalable readiness policy (map-driven per-tool keys) and references current baseline sets without hardcoded fixed-count logic in runtime.
- **Outcome**: GO (2026-05-21).

### Implementation Phase 1

- GOAL-001: Introduce canonical runtime primitives for ExtractionFieldKey and label projection.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create shared canonical extraction-field matrix module and FE adapter exports (contracts source + frontend projection) with: `ExtractionFieldKey` union type, `InstructionRequiredExtractionFieldKeysByTool`, `ReadinessRequiredExtractionFieldKeysByTool`, `ExtractionFieldLabelByKey` map (it-IT), and helper `mapExtractionFieldKeyToLabel(key: ExtractionFieldKey): string`. | Yes | 2026-05-21 |
| TASK-002 | Update `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` `ToolFileInstructionsConfig` to use `requiredFieldKeys: readonly ExtractionFieldKey[]` as source of truth and keep `requiredFields` deprecated alias for one cycle with inline migration comment. | Yes | 2026-05-21 |
| TASK-003 | Add deterministic selector adapter in `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` function `selectToolFileInstructions(toolKey)` to return UI-ready labels by projecting `requiredFieldKeys` via `mapExtractionFieldKeyToLabel`. | Yes | 2026-05-21 |
| TASK-004 | Add compile-time assertion helper in `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` ensuring all keys in each tool required-key array exist in `ExtractionFieldLabelByKey` map. | Yes | 2026-05-21 |

Exit Gate - Phase 1 (GO/NO-GO):
- **GATE-001**: A single canonical matrix source exists for key-to-label projection plus distinct per-tool instruction and readiness key sets.
- **GATE-002**: `selectToolFileInstructions` returns labels without mixed raw key strings.
- **GATE-003**: TypeScript compile-time guards fail when key-label mapping is incomplete.
- **Outcome**: GO (2026-05-21).

### Implementation Phase 2

- GOAL-002: Apply canonical key normalization in extraction validation and ingestion runtime paths.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Refactor `apps/frontend/src/features/tools/machines/extraction-context-validity.ts` to replace local hardcoded arrays with `ReadinessRequiredExtractionFieldKeysByTool` and add generic utility `hasRequiredExtractionFields(payload, keys)` for reuse across tools. | Yes | 2026-05-21 |
| TASK-006 | Update `apps/frontend/src/features/tools/runtime/tools-client.ts` extraction validation path (`assertExtractionResultIsValid`) to normalize known legacy aliases to canonical `ExtractionFieldKey` for all supported tools before readiness checks and request assembly writes. | Yes | 2026-05-21 |
| TASK-007 | Extend backend parser normalization in `apps/backend/src/lib/machines/generation/extraction-parsers.ts` by adding tool-aware field-key normalization function `normalizeExtractionFieldKeysForTool(toolKey, payload)` and applying it in `parseExtractionContent` return path for all supported tools. | Yes | 2026-05-21 |
| TASK-008 | Add explicit alias maps for each supported tool in backend parser module (`LegacyExtractionFieldAliasByTool`) sourced from the canonical matrix so no heuristic or fuzzy key mapping is used and FE/BE maps cannot diverge. | Yes | 2026-05-21 |

Exit Gate - Phase 2 (GO/NO-GO):
- **GATE-004**: Frontend readiness checks operate on canonical keys through `ReadinessRequiredExtractionFieldKeysByTool` (scalable policy, no fixed-count hardcode).
- **GATE-005**: Backend parser outputs canonical keys for all supported tools from one shared matrix contract.
- **GATE-006**: Legacy aliases are normalized deterministically through explicit maps with no FE/BE drift.
- **Outcome**: GO (2026-05-21).

### Implementation Phase 3

- GOAL-003: Converge UI output, tests, and governance evidence for autonomous verification.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Update UI guidance rendering tests in `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx` to assert label-only output for each tool and explicit absence of mixed raw key tokens in localized lists. | Yes | 2026-05-21 |
| TASK-010 | Update selector tests in `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` to assert canonical key source and deterministic label projection output per tool. | Yes | 2026-05-21 |
| TASK-011 | Add or extend extraction validity tests in `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` and `apps/frontend/src/features/tools/machines/extraction-context-validity.test.ts` to cover key normalization and readiness after alias conversion. | Yes | 2026-05-21 |
| TASK-012 | Add backend parser tests in `apps/backend/src/lib/tests/generation.extraction-parsers.test.ts` validating canonical key output and alias normalization for each supported tool. | Yes | 2026-05-21 |
| TASK-013 | Run validation commands: `npm --workspace apps/frontend run test -- src/features/tools/runtime/tool-page-selectors.test.ts src/features/tools/ui/ToolFileInstructionsSection.test.tsx src/features/tools/machines/tool-page.machine.test.ts`, `npm --workspace apps/backend run test:unit`, and `npm --workspace apps/frontend run build`; record results in this plan. | Yes | 2026-05-21 |

Exit Gate - Phase 3 (GO/NO-GO):
- **GATE-007**: UI guidance is label-only and deterministic.
- **GATE-008**: Readiness and parser tests pass with canonical key behavior.
- **GATE-009**: Frontend and backend targeted validations pass with zero new failures.
- **Outcome**: GO (2026-05-21).

## 3. Alternatives

- **ALT-001**: Keep current mixed label/key required-field lists and document exceptions per tool. Rejected because drift remains and runtime behavior stays inconsistent.
- **ALT-002**: Convert UI lists to raw keys only. Rejected because UX readability degrades and violates localized guidance intent.
- **ALT-003**: Delay normalization to backend only. Rejected because frontend registry/rendering would continue mixed semantics and fail DDD-079 convergence.

## 4. Dependencies

- **DEP-001**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
- **DEP-002**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`
- **DEP-003**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.tsx`
- **DEP-004**: `apps/frontend/src/features/tools/machines/extraction-context-validity.ts`
- **DEP-005**: `apps/frontend/src/features/tools/runtime/tools-client.ts`
- **DEP-006**: `apps/backend/src/lib/machines/generation/extraction-parsers.ts`
- **DEP-007**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` (ExtractionFieldKey, ExtractionFieldLabel)
- **DEP-008**: `docs/02-design/domain-bounded-context-map.md` (ExtractionFieldKey -> ExtractionFieldLabel translation rule)
- **DEP-009**: `docs/07-governance/domain-naming-decision-log.md` (DDD-079, DDD-C-010)

## 5. Files

- **FILE-001**: `apps/frontend/src/features/tools/runtime/extraction-field-matrix.ts` - new authoritative key and label matrix module.
- **FILE-002**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` - migrate required field source to canonical keys.
- **FILE-003**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` - key-to-label projection in selector output.
- **FILE-004**: `apps/frontend/src/features/tools/machines/extraction-context-validity.ts` - canonical key-based readiness checks.
- **FILE-005**: `apps/frontend/src/features/tools/runtime/tools-client.ts` - alias normalization before validation and dispatch payload usage.
- **FILE-006**: `apps/backend/src/lib/machines/generation/extraction-parsers.ts` - canonical key normalization for parser output.
- **FILE-007**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.test.ts` - selector projection tests.
- **FILE-008**: `apps/frontend/src/features/tools/ui/ToolFileInstructionsSection.test.tsx` - UI label-only rendering tests.
- **FILE-009**: `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts` - readiness behavior tests after normalization.
- **FILE-010**: `apps/frontend/src/features/tools/machines/extraction-context-validity.test.ts` - required-key validation utility tests.
- **FILE-011**: `apps/backend/src/lib/tests/generation.extraction-parsers.test.ts` - parser normalization tests.
- **FILE-012**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` - runtime convergence evidence update after implementation.
- **FILE-013**: `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` - architecture convergence evidence update after implementation.

## 6. Testing

- **TEST-001**: Verify each SupportedTool required-key array projects to non-empty localized labels with zero unmapped keys.
- **TEST-002**: Verify readiness gate evaluation is driven by `ReadinessRequiredExtractionFieldKeysByTool` for each supported tool and remains deterministic after key normalization.
- **TEST-003**: Verify legacy alias payload keys normalize to canonical keys before readiness checks.
- **TEST-004**: Verify Tool File Instructions UI does not render raw snake_case keys when label projection exists.
- **TEST-005**: Verify backend parser returns canonical keys for each supported tool and preserves null normalization rules.
- **TEST-006**: Verify targeted frontend and backend tests plus frontend build pass in one validation cycle.

### Validation Results - 2026-05-21

- `npm --workspace apps/frontend run test -- src/features/tools/runtime/tool-page-selectors.test.ts src/features/tools/ui/ToolFileInstructionsSection.test.tsx src/features/tools/machines/tool-page.machine.test.ts src/features/tools/machines/extraction-context-validity.test.ts src/features/tools/runtime/tools-client.test.ts` -> PASS (65 tests passed).
- `npm --workspace apps/backend run test:unit` -> PASS (36 tests passed).
- `npm --workspace apps/frontend run build` -> PASS.

## 7. Risks & Assumptions

- **RISK-001**: Alias map incompleteness may break readiness for historical payload variants.
- **RISK-002**: Divergent frontend and backend normalization maps may reintroduce drift if matrix ownership is not centralized.
- **RISK-003**: Label projection may regress if new keys are added without compile-time guard updates.
- **ASSUMPTION-001**: Existing extraction payloads can be deterministically mapped to canonical keys with explicit alias tables.
- **ASSUMPTION-002**: No API contract expansion is required for this convergence cycle.
- **ASSUMPTION-003**: SupportedTool set remains `funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator` during implementation; onboarding a new tool only requires matrix updates (no machine logic rewrite).

## 8. Related Specifications / Further Reading

[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Specification](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Frontend Tool Pages Architecture Specification](../docs/02-design/specifications/frontend-tool-pages-architecture-spec.md)