---
goal: Prepare BE/FE working session for end-to-end Tool implementation benchmark (requirements to publication)
version: 1.1
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Platform Architecture
status: in-progress
tags: [plan, tool-workspace, benchmark, backend, frontend, modularity, scalability, unification]
---

# Introduction

This session plan prepares a deterministic benchmark path for Tool implementation from initial requirements to publication.

Target verification criteria for the current platform state:

- Scalability: orchestration and runtime remain stable under representative load.
- Unification: BE and FE follow one canonical flow and one canonical language.
- Modularity: adding or evolving a Tool requires localized changes with minimal coupling.

## 1. Scope

In scope:

- End-to-end Tool implementation flow: requirement intake, Tool configuration, BE orchestration path, FE Tool Workspace path, publication readiness.
- Existing supported Tool lineup and extension path for new Tool entries.
- Runtime and quality gates for BE/FE before publication.

Out of scope:

- New domain term creation (unless formally approved through DDD decision workflow).
- Non-Tool features unrelated to Tool Workspace and ToolStepOrchestration.

## 2. Session Entry Gate (Mandatory)

Before implementation work:

1. Re-read canonical DDD sources:
   - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
   - `docs/02-design/domain-bounded-context-map.md`
   - `docs/07-governance/domain-naming-decision-log.md`
2. Re-read canonical UI governance source:
   - `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
3. Confirm active benchmark baseline exists:
   - `docs/04-testing/orchestrate-scalability-benchmark-2026-05-21.md`

Pass criteria:

- No ambiguity on canonical terms (`ToolKey`, `SupportedTool`, `ToolWorkflow`, `ToolStepOrchestration`, `ReadinessSnapshot`).
- No pending terminology conflict for touched flow segments.

Additional deterministic DDD gate (2026-05-21 update):

- Canonical identity for new tool is fixed and must be reused exactly:
  - `ToolKey = angle-generator`
  - `ToolWorkflow = angle_generator`
  - `ToolStep` minimal sequence: `context-and-angle-matrix` -> `angle-prioritization` -> `creative-activation`
- Dual-source extraction rule is mandatory for `angle-generator`:
  - `BriefingFile` + `AngleDetectorFile`
  - single extraction LLM job over merged context
  - two independent extraction jobs are non-compliant
- Runtime payload spec authority for pre-implementation is mandatory:
  - `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` (v1.1, section 5.1)

## 3. End-to-End Flow Under Benchmark

### Phase A - Requirements to Tool Definition

Objective:

- Validate that requirement-to-Tool mapping is deterministic and does not introduce naming drift.

Checklist:

- Confirm Tool identity tuple is coherent: `ToolKey` (kebab-case), display label, `ToolWorkflow` (snake_case).
- Confirm canonical ToolStep sequence is explicit and ordered.
- Confirm expected ExtractionContext schema and minimum ReadinessSnapshot gate.
- Confirm `angle-generator` uses dual-source extraction input contract (`BriefingFile` + `AngleDetectorFile`) with single extraction job semantics.

Primary evidence anchors:

- `packages/contracts/src/tool-workflows.ts`
- `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
- `apps/backend/src/lib/runtime/request-contract.ts`
- `docs/07-governance/domain-naming-decision-log.md` (DDD-077, DDD-078)
- `docs/01-requirements/domain-ubiquitous-language-glossary.md` (`AngleDetectorFile`, `ExtractionContext`, `GenerationRequest`)
- `docs/02-design/domain-bounded-context-map.md` (dual-source extraction translation + constraint)
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` (section 5.1)

### Phase B - Backend ToolStepOrchestration Path

Objective:

- Validate scalability and modularity of dependency resolution and orchestrate endpoint behavior.

Checklist:

- Confirm `/api/tools/orchestrate` path uses backend authority (`resolveStepDependencyIds`).
- Confirm bounded completed-artifact scan and timeout config are active.
- Confirm idempotency completion path is guarded and deterministic.

Primary evidence anchors:

- `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-handlers.ts`
- `apps/backend/src/lib/runtime/auth-http/tools-orchestrate-config.ts`
- `apps/backend/src/lib/runtime/tool-workflow-registry.ts`
- `apps/backend/src/lib/adapters/postgres-redis.production.ts`

### Phase C - Frontend Tool Workspace Path

Objective:

- Validate unification and modularity for adding/evolving Tool pages with canonical runtime behavior.

Checklist:

- Confirm Tool Workspace dispatch resolves dependencies via `orchestrateToolStep` before generation request dispatch.
- Confirm ReadinessSnapshot + Dispatch Error behavior remains canonical.
- Confirm Tool configuration is registry-driven and does not require duplicated runtime logic.
- Confirm FE upload/dispatch contract for `angle-generator` follows runtime payload spec section 5.1 (dual-file upload envelope + merged extraction dispatch envelope).
- Confirm XState machine contracts are updated coherently for dual-source readiness and single extraction dispatch invariants.
- Confirm XState v5 constraints in touched machine paths:
  - no side effects inside `assign`
  - explicit `reenter: true` only when state re-entry is required
  - eventless transitions implemented with `always` only when bounded and loop-safe

Primary evidence anchors:

- `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts`
- `apps/frontend/src/features/tools/runtime/useToolPage.ts`
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts`
- `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`
- `apps/frontend/src/features/tools/machines/tool-page.machine.test.ts`
- `apps/frontend/src/features/tools/machines/briefing-upload.machine.test.ts`

### Phase D - Publication Readiness

Objective:

- Verify that BE/FE gates pass in sequence and publication path is stable.

Checklist:

- Typecheck + focused tests + benchmark + build pass.
- No regression in canonical contract behavior.
- No unresolved DDD drift in touched areas.

DDD conformity checklist (blocking):

- No reintroduction of single-source-only extraction semantics for `angle-generator`.
- No non-canonical synonyms for `AngleDetectorFile`, `ToolKey`, `ToolWorkflow`, `ToolStep`.
- FE/BE payload shape matches runtime spec section 5.1 before code merge.

## 4. Execution Checklist (Deterministic Order)

Run from repository root.

| Step | Command | Purpose | Pass Criteria |
|------|---------|---------|---------------|
| EXEC-000 | `rg -n "DDD-077|DDD-078|AngleDetectorFile|angle-generator|angle_generator" docs/01-requirements/domain-ubiquitous-language-glossary.md && rg -n "DDD-077|DDD-078|AngleDetectorFile|angle-generator|angle_generator" docs/02-design/domain-bounded-context-map.md && rg -n "DDD-077|DDD-078|AngleDetectorFile|angle-generator|angle_generator" docs/07-governance/domain-naming-decision-log.md && rg -n "DDD-078|AngleDetectorFile|angle-generator|angle_generator|single extraction" docs/02-design/specifications/tool-page-frontend-runtime-spec.md` | DDD baseline integrity gate for angle-generator | Every command returns exit code 0 |
| EXEC-001 | `npm run typecheck --workspaces --if-present` | Global static baseline | Exit code 0 |
| EXEC-002 | `cd apps/backend && node --import tsx --test src/lib/tests/runtime.tools-orchestrate.test.ts` | BE orchestrate regression net (focused file) | Exit code 0 and no failing tests |
| EXEC-003 | `npm --workspace apps/backend run bench:orchestrate` | BE scalability baseline | Report produced; `timeoutCount = 0`; `errorCount = 0`; `p99 <= 6500 ms` |
| EXEC-004 | `cd apps/frontend && npx vitest run src/features/tools/runtime/useToolPage.test.ts src/features/tools/machines/tool-page.machine.test.ts src/features/tools/machines/briefing-upload.machine.test.ts src/features/tools/machines/tool-page-readiness.test.ts src/features/tools/machines/tool-page-hydration.test.ts` | FE Tool Workspace + XState machine regression net (focused files) | Exit code 0 and no failing tests |
| EXEC-005 | `npm --workspace apps/frontend run build` | FE publication gate | Exit code 0 |
| EXEC-006 | `npm run build` | End-to-end repo build gate | Exit code 0 |

Optional pre-implementation payload dry-run gate (recommended before coding):

- EXEC-007: Document-only payload contract review against section 5.1 examples (`upload` + `dispatch`) with explicit FE/BE checklist sign-off.

Stop condition:

- If any step fails, stop sequence, log failure context, and open a closure task before continuing.

## 5. Session Outputs

Required outputs for this benchmark session:

- OUT-001: Run log summary (commands, pass/fail, key metrics).
- OUT-002: BE scalability delta report vs baseline benchmark document.
- OUT-003: FE unification/modularity notes (what remains duplicated, what is already canonical).
- OUT-004: Go/No-Go publication recommendation.
- OUT-005: DDD-077/DDD-078 compliance report (identity/workflow/steps + dual-source extraction payload conformity).

## 5b. Technical Implementation Checklist (1:1 Runtime Spec Derivation)

Source of truth:

- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` (section 5.1)

Execution policy:

- Do not start coding any task outside this checklist for `angle-generator` extraction flow.
- Preserve DDD-078 invariant in every task: dual-source input, single extraction LLM job.

### Track A - FE Upload Flow (`POST /api/tools/briefs` payload)

- [ ] A-001: Extend FE upload contract type in `apps/frontend/src/features/tools/runtime/tools-client.ts` to support two file envelopes (`briefing`, `angleDetector`) when `toolKey = angle-generator`.
- [ ] A-002: Keep backward compatibility for existing tools (`funnel-pages`, `nextland`, `youtube-lf-script`) by preserving current single-file upload path.
- [ ] A-003: Implement deterministic branch in FE upload serializer:
  - `toolKey != angle-generator` -> current payload unchanged
  - `toolKey == angle-generator` -> send dual-file payload as defined in runtime spec 5.1.2
- [ ] A-004: Enforce FE pre-submit guard for angle-generator: block upload if either `briefing` or `angleDetector` file is missing.
- [ ] A-005: Normalize and include metadata per file (`fileName`, `mimeType`, `contentBase64`) for both envelopes.

Acceptance for Track A:

- [ ] A-AC-001: FE request body shape exactly matches runtime spec 5.1.2 dual-file example.
- [ ] A-AC-002: Existing tools still emit old single-file shape with no regression.

### Track B - BE Parsing and Validation (`/api/tools/briefs`)

- [ ] B-001: Extend request body parser in `apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts` to accept dual-file payload for `toolKey = angle-generator`.
- [ ] B-002: Add deterministic validator matrix:
  - For `angle-generator`: both file envelopes required
  - For other tool keys: legacy single-file payload accepted
- [ ] B-003: Reuse existing parse and size guards on each file independently (empty payload, max bytes, parse failure).
- [ ] B-004: Build normalized response envelope containing both parsed outputs for `angle-generator` (`briefing` + `angleDetector`) and `knowledgeSourcesCount = 2`.
- [ ] B-005: Preserve existing response contract for non-angle-generator tools (no breaking changes).

Acceptance for Track B:

- [ ] B-AC-001: `angle-generator` dual-file upload returns HTTP 201 with both normalized sections.
- [ ] B-AC-002: missing one of two files returns deterministic HTTP 400 validation error.
- [ ] B-AC-003: legacy upload contract remains valid for existing tools.

### Track C - Extraction Assembly Request (single LLM job)

- [ ] C-001: Update FE extraction assembly path (`runExtraction` input composition) to merge normalized texts from both sources for `angle-generator`.
- [ ] C-002: Populate `GenerationRequest.input.briefingText` with merged context for angle-generator.
- [ ] C-003: Populate `GenerationRequest.input.extractionPayload` with `knowledgeSources` metadata envelope (briefing + angle-detector source descriptors).
- [ ] C-004: Keep extraction dispatch as one request (`artifactType = extraction`, `toolKey = extraction`, `workflowType = extraction`) with `input.toolKey = angle-generator`.
- [ ] C-005: Prohibit dual independent extraction invocations in FE orchestration path.

Acceptance for Track C:

- [ ] C-AC-001: one extraction dispatch request per angle-generator run.
- [ ] C-AC-002: merged `briefingText` and `knowledgeSources` payload present in request.
- [ ] C-AC-003: no behavior changes for non-angle-generator extraction flow.

### Track D - Test Cases (blocking)

- [ ] D-001: FE unit tests in `apps/frontend/src/features/tools/runtime/tools-client.test.ts`:
  - dual-file payload serialization for `angle-generator`
  - fallback legacy serialization for existing tools
- [ ] D-002: FE runtime tests in `apps/frontend/src/features/tools/runtime/useToolPage.test.ts`:
  - pre-submit guard when one file is missing
  - single extraction dispatch invariant
- [ ] D-003: BE route tests in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` (or focused tools handler suite):
  - 201 dual-file success response
  - 400 on missing `angleDetector`
  - 400 on missing `briefing`
  - legacy single-file success path unchanged
- [ ] D-004: Contract tests for request assembly ensuring `GenerationRequest.input.extractionPayload.knowledgeSources` is present for `angle-generator` only.
- [ ] D-005: XState machine tests for impacted paths:
  - dual-source readiness guard coverage in `tool-page.machine`
  - upload guard coverage in `briefing-upload.machine`
  - single extraction dispatch invariant under repeated trigger attempts

Acceptance for Track D:

- [ ] D-AC-001: all new tests pass.
- [ ] D-AC-002: no regressions in existing FE/BE suites from EXEC-001..EXEC-006.

## 5d. XState Impact Gate (blocking for touched FE runtime)

This gate applies to every change that touches Tool Workspace machine logic for `angle-generator`.

- [ ] X-001: Event and context contracts are explicit in impacted machines (`tool-page.machine`, `briefing-upload.machine`) for dual-source input (`BriefingFile` + `AngleDetectorFile`).
- [ ] X-002: Readiness guard for `angle-generator` blocks progression if one source is missing; legacy tools keep current single-source behavior.
- [ ] X-003: Transition semantics are deterministic:
  - internal transitions remain default behavior
  - `reenter: true` is used only where required and justified
  - `always` transitions (if present) are bounded and cannot loop indefinitely
- [ ] X-004: Side effects are kept out of `assign`; async and effectful work remains in actions/invoked actor logic.
- [ ] X-005: Actor input lifecycle is deterministic in React integration: if machine input can change after mount, synchronization is event-driven and covered by tests.

Acceptance for XState Impact Gate:

- [ ] X-AC-001: machine-level tests pass for all touched states/events/guards.
- [ ] X-AC-002: no regression in FE runtime tests (`useToolPage.test.ts`) and machine suites listed in EXEC-004.
- [ ] X-AC-003: no XState v4 legacy pattern introduced in touched files (for example runtime wiring via `interpret`).

## 5e. Prompt Root and Runtime Prompt Pack (copy-ready)

Objective:

- Provide a deterministic prompt pack for `angle-generator` with one shared root prompt and one prompt per runtime phase (`extraction` + 3 generation steps).
- Keep alignment with DDD-077 and DDD-078: dual-source extraction input and single extraction job.

Target runtime folder:

- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/`

Target files to create from this section:

- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/prompt_root.md`
- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/prompt_extraction.md`
- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/prompt_context_and_angle_matrix.md`
- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/prompt_angle_prioritization.md`
- `apps/backend/src/lib/runtime/tool-prompts/angle-generator/prompt_creative_activation.md`

Resolver mapping to add in runtime prompt index:

- `angle-generator:context-and-angle-matrix` -> `src/lib/runtime/tool-prompts/angle-generator/prompt_context_and_angle_matrix.md`
- `angle-generator:angle-prioritization` -> `src/lib/runtime/tool-prompts/angle-generator/prompt_angle_prioritization.md`
- `angle-generator:creative-activation` -> `src/lib/runtime/tool-prompts/angle-generator/prompt_creative_activation.md`
- Extraction dispatch for `input.toolKey = angle-generator` must resolve `prompt_extraction.md` (tool-specific extraction override).

### Prompt Content - `prompt_root.md`

```markdown
# SYSTEM PROMPT: ANGLE GENERATOR ROOT

## Role and mission

You are a Senior Performance Marketing Strategist specialized in angle detection for direct response campaigns.
Your mission is to transform product and market inputs into high-conviction, testable advertising angles for Meta campaigns.

## Canonical method

You must apply the following frameworks in every response:

1. PDA Framework (Persona, Desire, Awareness)
2. Source synthesis across:
   - social/community language
   - review signals
   - explicit search questions
   - sales and form objections
3. 4 Decision Parameters:
   - potential ROI
   - differentiation
   - ease of communication
   - credibility and demonstrability

## Operational constraints

- Always ground claims in the provided inputs.
- Never invent data, testimonials, metrics, or market evidence.
- If evidence is missing, state it explicitly under a dedicated missing-information section.
- Keep language concrete and operational.
- Avoid generic strategic filler.

## Responsible AI constraints

- Do not infer or target protected characteristics.
- Do not use stereotypes or discriminatory assumptions.
- Avoid manipulative or exploitative framing.
- Do not output personal data not present in input.

## Style and output baseline

- Output language: Italian.
- Output format: markdown only.
- No JSON unless explicitly requested by the step contract.
- Use short headings, compact bullets, and decision-oriented writing.
```

### Prompt Content - `prompt_extraction.md`

```markdown
# Deterministic Step Contract

## Step Key

- extraction

## Root prompt

Apply all constraints and methodology from `prompt_root.md`.

## Objective

Build one extraction output from merged dual-source context for `angle-generator`.
Sources are:
- `BriefingFile`
- `AngleDetectorFile`

The extraction job is single-run. Do not split into multiple extraction jobs.

## Required input

- Merged textual context assembled from the two sources.

## Mandatory output rules

- Return markdown only, in Italian.
- Do not use code fences.
- Do not output JSON.
- Keep sections in the exact order below.
- If a field is not inferable, write: `Non emerso dalle fonti fornite.`

## Required output structure

## Persona
- ...

## Desire
- ...

## Awareness
- ...

## Pain Points (prioritized)
- ...

## Objections
- ...

## Market Signals
### Social and Community
- ...
### Reviews
- ...
### Search Questions
- ...
### Sales and Form Feedback
- ...

## Angle Candidates (10-15)
- Name: ...
  Strategic rationale: ...

## Candidate Scoring (ROI, Differentiation, Ease, Credibility)
- Angle: ...
  ROI: ...
  Differentiation: ...
  Ease: ...
  Credibility: ...
  Notes: ...

## Top 3 Priority Angles
- Angle: ...
  Why selected: ...

## Missing / Unclear
- ...

## Guardrails compliance check
- No invented claims: yes/no
- No discriminatory assumptions: yes/no
- Evidence-grounded output: yes/no
```

### Prompt Content - `prompt_context_and_angle_matrix.md`

```markdown
# PROMPT ANGLE GENERATOR - CONTEXT AND ANGLE MATRIX

## Step Key

- context-and-angle-matrix

## Root prompt

Apply all constraints and methodology from `prompt_root.md`.

## Objective

Produce a full context map and an actionable angle matrix from extraction context.

## Input

- `ExtractionContext` generated by the extraction step.

## Output rules

- Markdown only.
- Italian only.
- No JSON.
- No generic advice.
- Every angle must map to a concrete persona/desire/awareness profile.

## Required output structure

## Context Map
### Persona clusters
- ...
### Core desires
- ...
### Awareness distribution
- ...
### Priority objections
- ...

## Angle Matrix (10-15)
- Angle name (UPPERCASE): ...
  Persona focus: ...
  Desire focus: ...
  Awareness level: ...
  Trigger problem: ...
  Promise shape: ...
  Proof requirement: ...
  Strategic rationale: ...

## Test Readiness Notes
- Quick win angles:
- Medium effort angles:
- High risk angles:
```

### Prompt Content - `prompt_angle_prioritization.md`

```markdown
# PROMPT ANGLE GENERATOR - ANGLE PRIORITIZATION

## Step Key

- angle-prioritization

## Root prompt

Apply all constraints and methodology from `prompt_root.md`.

## Objective

Evaluate the angle matrix and select the top 3 launch angles with deterministic scoring.

## Input

- Angle matrix produced by `context-and-angle-matrix`.

## Scoring model (required)

Score each angle from 1 to 5 on:
- potential ROI
- differentiation
- ease of communication
- credibility and demonstrability

Total score = sum of the 4 dimensions.

## Output rules

- Markdown only.
- Italian only.
- No JSON.
- No ties in final top 3 ranking; resolve ties with explicit rationale.

## Required output structure

## Scored Angles
- Angle: ...
  ROI: ...
  Differentiation: ...
  Ease: ...
  Credibility: ...
  Total: .../20
  Notes: ...

## Top 3 Angles (Ranked)
1. Angle: ...
   Why now: ...
2. Angle: ...
   Why now: ...
3. Angle: ...
   Why now: ...

## Risk Notes and Mitigations
- ...
```

### Prompt Content - `prompt_creative_activation.md`

```markdown
# PROMPT ANGLE GENERATOR - CREATIVE ACTIVATION

## Step Key

- creative-activation

## Root prompt

Apply all constraints and methodology from `prompt_root.md`.

## Objective

For each of the top 3 prioritized angles, produce activation-ready creative foundations for Meta campaigns.

## Input

- Ranked top 3 angles from `angle-prioritization`.

## Output rules

- Markdown only.
- Italian only.
- No JSON.
- Concrete, direct-response style.
- Headline language must be user-centric and spoken-language friendly.

## Required output structure

## Angle 1 - [NAME]
### 3 Scroll-Stopper Headlines
- ...
- ...
- ...

### Copy Guidelines
- Suggested framework by awareness level (PAS/FAB/AIDA): ...
- Objections to neutralize: ...
- Proof assets required: ...
- CTA direction: ...

## Angle 2 - [NAME]
### 3 Scroll-Stopper Headlines
- ...
- ...
- ...

### Copy Guidelines
- Suggested framework by awareness level (PAS/FAB/AIDA): ...
- Objections to neutralize: ...
- Proof assets required: ...
- CTA direction: ...

## Angle 3 - [NAME]
### 3 Scroll-Stopper Headlines
- ...
- ...
- ...

### Copy Guidelines
- Suggested framework by awareness level (PAS/FAB/AIDA): ...
- Objections to neutralize: ...
- Proof assets required: ...
- CTA direction: ...

## Final launch note
- Which angle to test first and why: ...
```

Execution note:

- Copy these files as-is into the target runtime folder before enabling `angle-generator` prompt resolution in backend runtime.

## 5c. Execution Decision

Execution status: GO

GO criteria satisfied:

- Canonical DDD baseline aligned (DDD-077, DDD-078).
- Runtime payload spec available and referenced as implementation authority (section 5.1).
- Technical checklist decomposed into deterministic FE/BE tasks with blocking acceptance gates.

GO operating rule:

- Execute implementation strictly in A -> B -> C -> D order, then run EXEC-000..EXEC-006 (+ optional EXEC-007) before publication decision.

GO scope clarification:

- GO applies to implementation start authorization only.
- Publication remains conditional on full pass of EXEC-000..EXEC-006 and blocking acceptance criteria in Tracks A-D.

## 6. Risks and Controls

- RISK-001: Hidden coupling between Tool config and runtime behavior.
  - Control: enforce registry-first checks before any code branching.
- RISK-002: Benchmark green locally but unstable in CI/staging.
  - Control: treat local benchmark as comparative baseline only; repeat in fixed-profile environment.
- RISK-003: Terminology drift during fast iteration.
  - Control: block merge if canonical terms are not used consistently in BE/FE/docs touched by the session.

## 7. References

- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `docs/04-testing/orchestrate-scalability-benchmark-2026-05-21.md`
- `plan/process-orchestration-timeout-risk-closure-1.md`
