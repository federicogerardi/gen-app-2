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

- Define and propagate one canonical Tool identity set: `ToolKey` (kebab-case), `ToolWorkflow` (snake_case), `DisplayLabel`, and canonical `ToolStep` sequence.
- Implement deterministic FE/BE coverage for the new Tool across Tool Workspace runtime, backend orchestration, session listing/detail projections, and relaunch route resolution.
- Execute the mandatory validation gates in Section 4 with explicit pass/fail evidence in Section 5 outputs.

Out of scope:

- New domain term creation without DDD approval.
- Unrelated refactors outside the smallest affected tool surface.
- Features unrelated to Tool runtime or required parity surfaces. Exception: session archive/detail and relaunch parity are always in scope for a new Tool.

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

## 2b. Deterministic Inputs (Mandatory)

Before starting Phase A, define these variables once and reuse them in docs, code, tests, and run logs.

```bash
export TOOL_KEY='<kebab-case-tool-key>'
export TOOL_WORKFLOW='<snake_case_tool_workflow>'
export TOOL_DISPLAY_LABEL='<Tool Display Label>'
```

Input rules:

- `TOOL_KEY` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `TOOL_WORKFLOW` must match `^[a-z0-9]+(?:_[a-z0-9]+)*$`.
- `TOOL_DISPLAY_LABEL` must match approved DDD display naming.
- All three inputs must appear in glossary/decision-log evidence before implementation commits.

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
- Confirm backend session projections map canonical tool identity (`/api/tools/sessions` and `/api/tools/sessions/{sessionId}`) for the new Tool.
- Confirm artifact-role classification and step ordering support include the new Tool final step semantics.

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
- Confirm Session Summary list parity for the new Tool: `/sessionsummary` must render the Tool display label (not raw `ToolKey` or fallback technical value) in the Tool column.
- Confirm Session Summary detail parity for the new Tool: `/sessionsummary/{sessionId}` must resolve the same Tool display label in title and metadata without falling back to generic unavailability copy.
- Confirm relaunch parity for the new Tool from session detail: `Relaunch` CTA must resolve a valid Tool route and remain enabled when stream is idle and artifact detail is available.

Primary evidence anchors:

- `apps/frontend/src/features/tools/runtime/useToolPage.ts`
- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts`
- `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`
- `apps/frontend/src/features/tools/machines/`
- `apps/frontend/src/features/artifacts/ui/SessionsListingSection.tsx`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.tsx`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`
- `apps/frontend/src/features/sessionsummary/runtime/session-summary-domain.ts`
- `apps/frontend/src/features/generation/ui/artifact-history.ts`
- `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`

### Phase D - Validation and Publication Readiness

Objective:

- Prove the change is safe to publish.

Checklist:

- Typecheck passes.
- Focused tests pass.
- Build passes.
- Benchmark or runtime gate passes if the change affects orchestration or load-sensitive behavior.
- DDD conformity is confirmed for all touched names and payloads.
- Session archive/detail parity passes for the new Tool (`/sessionsummary` list label, `/sessionsummary/{sessionId}` title + metadata label, relaunch CTA enabled-state and route resolution).

DDD conformity checklist:

- No non-canonical synonyms in code, tests, or docs.
- No new term appears without glossary or decision-log coverage.
- No payload or flow drift against the canonical runtime spec.

## 4. Execution Checklist

Run from repository root.

Mandatory precondition:

- Export deterministic inputs from Section 2b in the current shell session.

| Step | Command | Purpose | Pass Criteria |
|------|---------|---------|---------------|
| EXEC-000 | `test -n "$TOOL_KEY" && test -n "$TOOL_WORKFLOW" && test -n "$TOOL_DISPLAY_LABEL" && test -f docs/01-requirements/domain-ubiquitous-language-glossary.md && test -f docs/02-design/domain-bounded-context-map.md && test -f docs/07-governance/domain-naming-decision-log.md && test -f docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md && test -f docs/02-design/specifications/tool-page-frontend-runtime-spec.md && rg -n "$TOOL_KEY|$TOOL_WORKFLOW|$TOOL_DISPLAY_LABEL" docs/01-requirements/domain-ubiquitous-language-glossary.md docs/07-governance/domain-naming-decision-log.md` | DDD baseline integrity gate | Exit code 0 and at least one match in each DDD doc set |
| EXEC-001 | `npm run typecheck --workspaces --if-present` | Global static baseline | Exit code 0 |
| EXEC-002 | `npm --workspace apps/backend run test -- src/lib/tests/runtime.workflow-normalizers.test.ts src/lib/tests/runtime.tools-orchestrate.test.ts src/lib/tests/runtime.auth-http.test.ts` | Backend regression net | Exit code 0 and no failing tests |
| EXEC-003 | `npm --workspace apps/backend run bench:orchestrate` | Runtime scalability baseline | Exit code 0 and benchmark summary logged in OUT-001 |
| EXEC-004 | `npm --workspace apps/frontend run test -- src/features/tools/runtime/tool-form-architecture.test.ts src/features/sessionsummary/pages/SessionSummaryListPage.test.tsx src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx src/features/artifacts/ui/SessionsListingSection.test.tsx src/features/generation/ui/SessionArtifactTabs.test.tsx src/features/generation/ui/artifact-history.test.ts` | Frontend parity regression net (Tool Workspace + Session Summary/Relaunch) | Exit code 0 and no failing tests |
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

- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/07-governance/domain-naming-decision-log.md`

Execution policy:

- Keep the change inside the smallest coherent scope.
- Do not start coding tasks outside the approved plan boundary.
- Preserve canonical DDD terms and payload invariants.

### Track A - Contracts and Canonical Identity

- [ ] A-001: Add `TOOL_KEY` and `TOOL_WORKFLOW` to contracts registry (`packages/contracts/src/tool-workflows.ts`) with canonical `ToolStep` order and dependencies.
- [ ] A-002: Add canonical extraction field maps (instruction/readiness) for the new Tool where required by DDD policy.
- [ ] A-003: Add deterministic FE label/route resolution support for `TOOL_KEY` and aliases only where approved in decision log.

Acceptance for Track A:

- [ ] A-AC-001: `resolveToolWorkflowType(TOOL_KEY)` and reverse mapping are stable and type-safe.
- [ ] A-AC-002: `getToolLabel` and `getToolRoute` resolve canonical values for both `TOOL_KEY` and approved aliases.

### Track B - Backend Runtime and Session Projections

- [ ] B-001: Register backend runtime support for `TOOL_KEY` in orchestration/normalization paths (`tool-workflow-registry`, `workflow-normalizers`, handlers).
- [ ] B-002: Add deterministic final-step artifact role mapping for the new Tool.
- [ ] B-003: Validate session list/detail projections return canonical tool identity usable by FE label/route resolvers.

Acceptance for Track B:

- [ ] B-AC-001: `/api/tools/sessions` and `/api/tools/sessions/{sessionId}` carry tool identity that resolves to `TOOL_KEY` deterministically.
- [ ] B-AC-002: Backend rejects unsupported tool identifiers with explicit validation error (no silent fallback).
- [ ] B-AC-003: Existing tools remain behaviorally unchanged under focused backend regression suite.

### Track C - Frontend Tool Workspace and Session Surfaces

- [ ] C-001: Add Tool Workspace registration/configuration for `TOOL_KEY` (page route, form config, steps, guidance).
- [ ] C-002: Ensure generation dispatch and relaunch route assembly resolve to `/tools/$TOOL_KEY` from canonical identity sources.
- [ ] C-003: Ensure FE step ordering/rendering supports the new Tool in session detail tabs and history projections.
- [ ] C-004: Validate Session Summary parity for the target Tool (`/sessionsummary` Tool label, `/sessionsummary/{sessionId}` title + details label, relaunch CTA path resolution).

Acceptance for Track C:

- [ ] C-AC-001: Tool route assembly uses one canonical resolver path (no local divergent mappers).
- [ ] C-AC-002: Session detail relaunch source selection is deterministic (final-step preferred, then valid-step fallback).
- [ ] C-AC-003: Existing supported tools still pass the same list/detail/relaunch UI assertions.
- [ ] C-AC-004: Session summary surfaces never expose raw workflow identifiers as final UI labels for the target Tool.
- [ ] C-AC-005: Relaunch CTA is enabled whenever tool-route resolution succeeds and stream is not active.

### Track D - Test Cases

- [ ] D-001: Add/update unit tests for tool label/route normalization and canonical mappings.
- [ ] D-002: Add/update frontend session detail tests covering title/details parity and relaunch CTA behavior for the new Tool.
- [ ] D-003: Add/update backend normalization/orchestration tests for final-step role and tool identity mapping.
- [ ] D-004: Add/update session summary tests for the target Tool on both list and detail pages.
- [ ] D-005: Add/update relaunch route-resolution test coverage for the target Tool.

Acceptance for Track D:

- [ ] D-AC-001: All new tests pass.
- [ ] D-AC-002: No regressions in existing suites.
- [ ] D-AC-003: Session summary and relaunch coverage includes the target Tool and at least one previously supported Tool (non-regression pair).

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

- RISK-001: Cross-surface drift where Tool Workspace works but Session Summary/Relaunch remains inconsistent.
  - Control: Mandatory Track C parity tasks + EXEC-004 targeted session suites.
- RISK-002: Canonical naming drift (`TOOL_KEY`/`TOOL_WORKFLOW` mismatch across FE/BE/docs).
  - Control: EXEC-000 grep gate + X-001..X-005 DDD impact gate before implementation sign-off.
- RISK-003: Regression on existing tools after adding new tool paths.
  - Control: D-AC-003 non-regression pair requirement and workspace-wide typecheck/build gates.

## 7. References

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/04-testing/orchestrate-scalability-benchmark-2026-05-21.md`
- `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx`
- `apps/frontend/src/features/artifacts/ui/SessionsListingSection.test.tsx`
