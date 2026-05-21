---
goal: [Short statement of the tool plan objective]
version: 1.0
date_created: [YYYY-MM-DD]
last_updated: [YYYY-MM-DD]
last-reviewed: [YYYY-MM-DD]
next-review-date: [YYYY-MM-DD]
owner: [Team or role]
status: draft
tags: [plan, tool-workspace, backend, frontend, ddd, validation]
---

# Introduction

This template defines a deterministic plan structure for developing or evolving a Tool in the repository.

Target verification criteria for every new Tool plan:

- Scalability: the new Tool can be added without broad architectural changes.
- Unification: BE and FE follow one canonical flow and one canonical language.
- Modularity: behavior changes remain localized to the smallest possible surface.
- Traceability: every new tool characteristic is anchored to a canonical DDD decision or an explicit drift note.

## 0. Phase 0 - Initial DDD Analysis for New Tool Characteristics

Objective:

- Identify the new Tool characteristics before any implementation work.
- Decide whether the new behavior is a canonical extension, a variation of an existing Tool, or a new DDD concept requiring governance.

Checklist:

- Identify the bounded context that owns the change.
- Identify the canonical `ToolKey`, `ToolWorkflow`, and `ToolStep` sequence if the Tool already exists or if the new Tool is being introduced.
- Determine whether the new characteristics affect input shape, output shape, step sequence, runtime prompts, readiness rules, or UI composition.
- Check whether the new concept already exists in the glossary, bounded-context map, or naming decision log.
- If a new term is required, create or update the DDD decision before using the term in implementation files.
- Flag drift candidates: synonyms, local abbreviations, duplicate terms, or mixed naming across FE/BE/docs.
- Define the minimum canonical contract that must remain stable for this Tool.

Required DDD outputs:

- Canonical terms used by the plan.
- Terms that must not be introduced.
- Any new DDD decision needed before code changes.
- The narrowest implementation boundary that can contain the change.

Primary evidence anchors:

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` if the change touches UI
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` if the change touches Tool Workspace runtime

## 1. Scope

In scope:

- [Describe the tool capability, workflow, or runtime change.]
- [List the exact FE/BE/doc surfaces affected.]
- [List the exact validation gates for the change.]

Out of scope:

- New domain term creation without DDD approval.
- Unrelated refactors outside the smallest affected tool surface.
- Non-tool features not needed for this change.

## 2. Session Entry Gate

Before implementation work:

1. Re-read canonical DDD sources:
   - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
   - `docs/02-design/domain-bounded-context-map.md`
   - `docs/07-governance/domain-naming-decision-log.md`
2. Re-read canonical UI governance source if UI is involved:
   - `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
3. Re-read canonical runtime spec if Tool Workspace runtime is involved:
   - `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
4. Confirm the current baseline or benchmark document for the specific flow exists.

Pass criteria:

- No ambiguity on the canonical terms for this change.
- No unresolved terminology conflict.
- No unresolved architecture constraint that would invalidate the plan.

## 3. End-to-End Flow Under Plan

### Phase A - Requirements to Tool Definition

Objective:

- Convert the new requirement into a canonical Tool definition.

Checklist:

- Confirm `ToolKey` and display label.
- Confirm `ToolWorkflow` and `ToolStep` sequence.
- Confirm input/output contracts and any extraction or generation payloads.
- Confirm readiness rules and failure modes.
- Confirm whether the Tool requires new prompts, new UI controls, or new backend validation.

Primary evidence anchors:

- `packages/contracts/src/tool-workflows.ts`
- `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
- `apps/backend/src/lib/runtime/request-contract.ts`
- Relevant DDD decisions and glossary entries

### Phase B - Backend Runtime Path

Objective:

- Validate backend orchestration, request validation, and runtime invariants.

Checklist:

- Confirm backend route or handler authority.
- Confirm payload validation and normalization rules.
- Confirm timeout, idempotency, and error handling behavior.
- Confirm that any new backend path is registered in the canonical runtime registry.

Primary evidence anchors:

- `apps/backend/src/lib/runtime/auth-http/`
- `apps/backend/src/lib/runtime/tool-workflow-registry.ts`
- `apps/backend/src/lib/runtime/tool-prompts/`
- `apps/backend/src/lib/tests/`

### Phase C - Frontend Tool Workspace Path

Objective:

- Validate the Tool Workspace changes needed for the new capability.

Checklist:

- Confirm the page archetype remains canonical.
- Confirm the runtime hook and machine changes are minimal and deterministic.
- Confirm readiness, dispatch, and error behavior.
- Confirm any new upload or input controls are aligned with the runtime spec.
- Confirm the UI uses canonical UI vocabulary and no new local synonyms.

Primary evidence anchors:

- `apps/frontend/src/features/tools/runtime/useToolPage.ts`
- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts`
- `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`
- `apps/frontend/src/features/tools/machines/`

### Phase D - Validation and Publication Readiness

Objective:

- Prove the change is safe to publish.

Checklist:

- Typecheck passes.
- Focused tests pass.
- Build passes.
- Benchmark or runtime gate passes if the change affects orchestration or load-sensitive behavior.
- DDD conformity is confirmed for all touched names and payloads.

DDD conformity checklist:

- No non-canonical synonyms in code, tests, or docs.
- No new term appears without glossary or decision-log coverage.
- No payload or flow drift against the canonical runtime spec.

## 4. Execution Checklist

Run from repository root.

| Step | Command | Purpose | Pass Criteria |
|------|---------|---------|---------------|
| EXEC-000 | `[Add DDD and spec verification commands here]` | DDD baseline integrity gate | Every command returns exit code 0 |
| EXEC-001 | `npm run typecheck --workspaces --if-present` | Global static baseline | Exit code 0 |
| EXEC-002 | `[Add focused backend test command here]` | Backend regression net | Exit code 0 and no failing tests |
| EXEC-003 | `[Add benchmark or load command here if needed]` | Runtime scalability baseline | Required metrics are within target |
| EXEC-004 | `[Add focused frontend test command here]` | Frontend Tool Workspace regression net | Exit code 0 and no failing tests |
| EXEC-005 | `npm --workspace apps/frontend run build` | Frontend publication gate | Exit code 0 |
| EXEC-006 | `npm run build` | End-to-end repo build gate | Exit code 0 |

Stop condition:

- If any step fails, stop the sequence, log the failure context, and open a closure task before continuing.

## 5. Session Outputs

Required outputs for every Tool plan:

- OUT-001: Run log summary (commands, pass/fail, key metrics).
- OUT-002: DDD analysis summary for the new Tool characteristics.
- OUT-003: FE unification/modularity notes.
- OUT-004: BE orchestration and validation notes.
- OUT-005: Go/No-Go recommendation.

## 5b. Implementation Checklist

Source of truth:

- `[Add the canonical runtime spec or architecture spec here]`

Execution policy:

- Keep the change inside the smallest coherent scope.
- Do not start coding tasks outside the approved plan boundary.
- Preserve canonical DDD terms and payload invariants.

### Track A - [Short label]

- [ ] A-001: [Describe the first FE or contract task.]
- [ ] A-002: [Describe the second FE or contract task.]
- [ ] A-003: [Describe the serializer, validator, or mapping task.]

Acceptance for Track A:

- [ ] A-AC-001: [Define the exact expected behavior.]
- [ ] A-AC-002: [Define the backward-compatibility requirement, if any.]

### Track B - [Short label]

- [ ] B-001: [Describe the backend validation or orchestration task.]
- [ ] B-002: [Describe the deterministic guard or normalization rule.]
- [ ] B-003: [Describe the response or persistence shape.]

Acceptance for Track B:

- [ ] B-AC-001: [Define the exact expected response or state.]
- [ ] B-AC-002: [Define the failure-mode expectation.]
- [ ] B-AC-003: [Define the compatibility requirement.]

### Track C - [Short label]

- [ ] C-001: [Describe the FE/BE assembly or dispatch task.]
- [ ] C-002: [Describe the merged payload or orchestration input task.]
- [ ] C-003: [Describe the single-dispatch or single-source-of-truth invariant.]

Acceptance for Track C:

- [ ] C-AC-001: [Define the single-request or single-path invariant.]
- [ ] C-AC-002: [Define the merged payload or canonical output expectation.]
- [ ] C-AC-003: [Define the non-regression requirement for existing tools.]

### Track D - Test Cases

- [ ] D-001: [Describe focused unit tests for the new behavior.]
- [ ] D-002: [Describe integration or runtime tests for the touched path.]
- [ ] D-003: [Describe contract or regression tests for canonical shape.]

Acceptance for Track D:

- [ ] D-AC-001: All new tests pass.
- [ ] D-AC-002: No regressions in existing suites.

## 5d. DDD Impact Gate

This gate applies to every plan that introduces or modifies tool characteristics.

- [ ] X-001: New tool characteristics are mapped to canonical DDD terms before implementation.
- [ ] X-002: Any new term has an approved DDD decision or glossary entry.
- [ ] X-003: No synonym or local naming variant is introduced in code or docs.
- [ ] X-004: The canonical tool flow remains deterministic and bounded.
- [ ] X-005: Any FE/BE cross-context translation is explicit and documented.

Acceptance for DDD Impact Gate:

- [ ] X-AC-001: DDD review complete.
- [ ] X-AC-002: Terms and payloads are consistent across FE/BE/docs.
- [ ] X-AC-003: No unresolved drift remains in the touched area.

## 6. Risks and Controls

- RISK-001: [Describe the main architectural risk.]
  - Control: [Describe the mitigation.]
- RISK-002: [Describe the main DDD or naming risk.]
  - Control: [Describe the mitigation.]
- RISK-003: [Describe the main validation or rollout risk.]
  - Control: [Describe the mitigation.]

## 7. References

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `[Add any plan-specific benchmark, architecture, or test docs here]`
