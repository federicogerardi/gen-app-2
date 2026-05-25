---
goal: Implement the canonical Meta Ads Tool across contracts, backend runtime, frontend workspace, and session parity surfaces
version: 1.1
date_created: 2026-05-25
last_updated: 2026-05-25
owner: Frontend Platform + Backend Runtime
status: Completed
tags: [feature, tool-workspace, backend, frontend, ddd, validation, meta-ads]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan defines the deterministic rollout for the Meta Ads Tool using the canonical identity approved by DDD-094: ToolKey `meta-ads`, ToolWorkflow `meta_ads_generator`, and DisplayLabel `MetaAds Generator`.

The workflow is constrained to a maximum of 2 generation steps and is defined in this revision together with the prompt pack for extraction and generation.

## 1. Requirements & Constraints

- **REQ-001**: Use the canonical identity set from DDD-094 in all touched FE/BE/docs surfaces: ToolKey `meta-ads`, ToolWorkflow `meta_ads_generator`, DisplayLabel `MetaAds Generator`.
- **REQ-002**: Preserve deterministic FE/BE translation rules for ToolKey (kebab-case) and ToolWorkflow (snake_case) without introducing local mappers.
- **REQ-003**: Ensure `/sessionsummary` list/detail and relaunch surfaces resolve the Meta Ads Tool display label and route deterministically.
- **REQ-004**: Use a deterministic max-2-step generation workflow: `context-generation` then `ads-generation`.
- **REQ-005**: Add the tool to contracts and runtime registries without regressing existing tools.
- **REQ-006**: Keep one canonical route-resolution path for relaunch and tool-entry URL generation.
- **REQ-007**: Ensure resume-checkpoint parity behavior is supported once workflow steps are finalized.
- **REQ-008**: The extraction route (`toolKey=extraction`, `workflowType=extraction`, `input.toolKey=meta-ads`) must parse the required briefing file and optional angles file, producing structured markdown normalized to `ExtractionContext` for ToolStep prompt assembly.
- **REQ-009**: The optional angles file must be consumed when present and mapped into explicit angle candidates without blocking generation when absent.
- **REQ-010**: Input fields `tone` and `model` must be propagated deterministically to Step 2 generation requests.
- **REQ-011**: The Meta Ads prompt framework must preserve the master constraints: awareness-state framing, LF8 activation, four length variants, two CTA options, visual and targeting suggestions.
- **REQ-012**: Ads output language must be Italian (`it-IT`) even when system/developer instructions are authored in English.
- **REQ-013**: Context Generation output must be markdown-only (no JSON, no code fences), consistent with existing extraction baseline for other tools.
- **REQ-014**: ToolWorkflow steps must remain generation steps; extraction remains a pre-workflow authority path (artifactType `extraction`) to preserve runtime parity with implemented tools.
- **REQ-015**: Final-step artifact-role resolution for Meta Ads must be explicitly mapped in backend workflow normalizers so XState resume/relaunch paths remain deterministic across session projections.
- **SEC-001**: Preserve existing backend auth enforcement and explicit validation error envelopes for unsupported or malformed tool identifiers.
- **DDD-001**: No synonym may replace canonical terms from glossary/BCM/decision log.
- **DDD-002**: `meta_ads` stays deprecated as a legacy alias and must not be used as primary workflow value.
- **CON-001**: Workflow step count must remain <= 2.
- **CON-002**: Changes must remain localized to tool registry, runtime adapters, and parity surfaces.
- **GUD-001**: Prefer extending existing modules over creating new abstractions.
- **PAT-001**: Reuse shared contracts authority (`packages/contracts/src/tool-workflows.ts`) as the single mapping source.

## 1b. Master Prompt Analysis (Replicated Specification)

- **MPA-001**: The master copy framework is direct-response oriented and requires awareness-state adaptation.
- **MPA-002**: Each generated variant must activate at least 3 LF8 triggers.
- **MPA-003**: Each variant must produce exactly 4 length formats: 40-60, 60-90, 90-120, 120-200 words.
- **MPA-004**: Each format must include headline, body, and 2 CTA options.
- **MPA-005**: Each variant must include visual suggestion and targeting suggestion.
- **MPA-006**: Tone must remain second-person singular and conversion-oriented.

## 1c. Context Generation Mandatory Fields

Input contract fields:

- **CG-IN-001**: briefingFile (required file input).
- **CG-IN-002**: angleFile (optional file input for ad angles).
- **CG-IN-003**: tone (required string input).
- **CG-IN-004**: model (required `LlmModelId` input).

Structured fields extracted from briefing and runtime form:

- **CG-FLD-001**: product_or_service (required).
- **CG-FLD-002**: target_audience (required).
- **CG-FLD-003**: campaign_objective (required).
- **CG-FLD-004**: budget_context (required).
- **CG-FLD-005**: primary_offer (required).
- **CG-FLD-006**: proof_points (required, at least 1 tangible proof).
- **CG-FLD-007**: dominant_pain_points (required, at least 1).
- **CG-FLD-008**: objections (required, at least 1).
- **CG-FLD-009**: awareness_priority (required, ordered list of 3 states).
- **CG-FLD-010**: lf8_priority (required, ordered list of top 3 triggers).
- **CG-FLD-011**: unique_mechanism (required).
- **CG-FLD-012**: angle_candidates (optional list; may be empty when angleFile is absent).

Context Generation output contract (authority for Step 2):

- **CG-OUT-001**: markdown extraction document with deterministic section order.
- **CG-OUT-002**: parser-normalized context object (CG-FLD-001..CG-FLD-012) derived from markdown output.
- **CG-OUT-003**: selectedAwarenessTracks (exactly 3 awareness tracks).
- **CG-OUT-004**: selectedLf8Tracks (exactly 3 LF8 triggers).
- **CG-OUT-005**: generationConstraints (word-count bands, CTA count, output language, tone).

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-001: Establish deterministic DDD and contract baseline for Meta Ads identity before implementation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Verify canonical references include DDD-094 supersession and Meta Ads identity across glossary, BCM, and naming log. | Yes | 2026-05-25 |
| TASK-002 | Validate plan-scope invariants against `docs/99-reference/templates/tool-development-plan-template.md` and lock max-2-step generation workflow naming (`context-generation`, `ads-generation`). | Yes | 2026-05-25 |
| TASK-003 | Confirm deterministic env variables for execution gates: `TOOL_KEY=meta-ads`, `TOOL_WORKFLOW=meta_ads_generator`, `TOOL_DISPLAY_LABEL=MetaAds Generator`. | Yes | 2026-05-25 |
| TASK-003A | Validate master prompt replication constraints (awareness, LF8, 4 length formats, CTA x2, visual + targeting outputs). | Yes | 2026-05-25 |

### Implementation Phase 1

- GOAL-002: Register the new tool identity in contracts and shared FE/BE resolvers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Update `packages/contracts/src/tool-workflows.ts` with Meta Ads canonical identity and workflow mapping (`meta-ads` -> `meta_ads_generator`). | Yes | 2026-05-25 |
| TASK-005 | Register canonical ToolStep sequence with max 2 generation steps: `context-generation`, `ads-generation`, with dependency `ads-generation` -> `context-generation`. | Yes | 2026-05-25 |
| TASK-006 | Update contract tests and guards for key/workflow normalization, step-order integrity, and legacy alias handling (`meta_ads` -> deprecated alias path only). | Partial | 2026-05-25 |

### Implementation Phase 2

- GOAL-003: Enable backend runtime recognition and deterministic request normalization for Meta Ads.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Extend backend runtime registry paths in `apps/backend/src/lib/runtime/tool-workflow-registry.ts`, request normalization in `apps/backend/src/lib/runtime/request-contract.ts`, extraction prompt resolution in `apps/backend/src/lib/runtime/tool-prompts/index.ts`, and final-step artifact-role normalization in `apps/backend/src/lib/runtime/workflow-normalizers.ts` for Meta Ads identity. | Partial | 2026-05-25 |
| TASK-008 | Implement extraction markdown assembly and parser normalization in backend extraction path to validate mandatory fields CG-FLD-001..CG-FLD-011 and optional CG-FLD-012 before ToolStep generation starts. | Yes | 2026-05-25 |
| TASK-009 | Update backend focused tests under `apps/backend/src/lib/tests/` for tool identity normalization, context schema validation, orchestrate/session projection compatibility, and ToolWorkflowMachine step-transition parity (`context-generation` -> `ads-generation`). | Yes | 2026-05-25 |

### Implementation Phase 3

- GOAL-004: Enable frontend Tool Workspace, Session Summary parity, and relaunch route resolution for Meta Ads.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add Meta Ads tool config in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` with canonical label and route `/tools/meta-ads`. | Yes | 2026-05-25 |
| TASK-011 | Add Tool Workspace form inputs for briefing file (required), angles file (optional), tone, and model; map them to Context Generation payload assembly. | Yes | 2026-05-25 |
| TASK-012 | Update FE tool-entry/relaunch resolvers (`apps/frontend/src/features/generation/ui/artifact-history.ts`, Session Summary pages) to resolve Meta Ads route and label deterministically. | Partial | 2026-05-25 |
| TASK-013 | Add frontend parity tests for `/sessionsummary` list/detail labels, relaunch CTA route resolution, and 2-step workflow rendering. | Yes | 2026-05-25 |

### Implementation Phase 4

- GOAL-005: Wire and validate prompt execution for Context Generation and Ads Generation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Add prompt modules/templates for Step 1 Context Generation and Step 2 Ads Generation using the master framework constraints. | Yes | 2026-05-25 |
| TASK-015 | Add integration tests for prompt-output contract completeness (3 variants, 4 lengths per variant, CTA x2, visual and targeting blocks). | Yes | 2026-05-25 |
| TASK-016 | Add/refresh tests for resume-checkpoint and regenerate parity with the finalized 2-step workflow. | Yes | 2026-05-25 |

## 2b. Canonical Meta Ads Workflow (Extraction + Max 2 Generation Steps)

- **WF-000**: Pre-workflow extraction route authority (`toolKey=extraction`, `workflowType=extraction`, `input.toolKey=meta-ads`).
	- Input: briefingFile required, angleFile optional, tone, model.
	- Output: structured markdown extraction document normalized to `ExtractionContext` (`CG-OUT-001..CG-OUT-005`).
	- Blocking rule: extraction fails if any required field CG-FLD-001..CG-FLD-011 is missing.

- **WF-001**: Step 1 - `context-generation` (WorkflowStepType: `generation`).
	- Input: normalized `ExtractionContext` from WF-000 + tone + model.
	- Output: generation-ready context payload for ad synthesis (`CG-OUT-002..CG-OUT-005`).
- **WF-002**: Step 2 - `ads-generation` (WorkflowStepType: `generation`).
	- Input: Step 1 output + tone + model.
	- Output: 3 awareness variants x 4 length versions, each with headline/body/CTA1/CTA2 + visual and targeting suggestions.
	- Dependency rule: Step 2 can start only after Step 1 reaches done state.

## 2c. Prompt Pack (Context Generation + Step Generation)

### Prompt A - Extraction (Pre-workflow)

```text
SYSTEM ROLE
You are the extraction engine for ToolKey meta-ads.

OBJECTIVE
Parse user inputs and produce a deterministic structured markdown extraction document for downstream ToolStep generation.

INPUTS
- briefingFileText: required
- angleFileText: optional
- tone: required
- model: required

MANDATORY EXTRACTION FIELDS
1) product_or_service
2) target_audience
3) campaign_objective
4) budget_context
5) primary_offer
6) proof_points
7) dominant_pain_points
8) objections
9) awareness_priority (exactly 3 states)
10) lf8_priority (exactly 3 triggers)
11) unique_mechanism
12) angle_candidates (optional)

RULES
- If a required field is not inferable, emit the section anyway and write exactly: `Non emerso dalle fonti fornite`.
- If one or more required fields are missing, include them in a dedicated `## Missing / Unclear` section while preserving full markdown output structure.
- awareness_priority must be selected from:
	[Completely Aware, Product Aware, Problem Aware, Unaware]
- lf8_priority must be selected from LF8 canonical list and contain exactly 3 items.
- Keep output language aligned with workspace copy policy.
- Enforce `output_language = it-IT` in generationConstraints.
- Return markdown only.
- Do not output JSON.
- Do not use code fences.
- Keep sections in exact order.

REQUIRED OUTPUT STRUCTURE (MARKDOWN)
## Product or Service
- ...

## Target Audience
- ...

## Campaign Objective
- ...

## Budget Context
- ...

## Primary Offer
- ...

## Proof Points
- ...

## Dominant Pain Points
- ...

## Objections
- ...

## Awareness Priority (Top 3)
- ...

## LF8 Priority (Top 3)
- ...

## Unique Mechanism
- ...

## Angle Candidates
- ...

## Missing / Unclear
- ...

## Generation Constraints
- variants_count: 3
- length_bands: 40-60 | 60-90 | 90-120 | 120-200
- cta_options_per_version: 2
- output_language: it-IT
```

### Prompt B - Ads Generation (Step 2)

```text
SYSTEM ROLE
You are a direct-response Meta Ads copy generator following the approved master framework.

OBJECTIVE
Generate conversion-oriented ad copy from normalizedContext.

INPUT
- normalizedContext (from extraction + Step 1)
- generationConstraints
- tone

MANDATORY OUTPUT CONTRACT
- Create exactly 3 variants: A, B, C.
- For each variant include:
	- awareness_state
	- lf8_triggers_used (exactly 3)
	- primary_psychological_trigger
	- versions: very_short (40-60), short (60-90), medium (90-120), long (120-200)
- For each version include:
	- headline
	- body
	- cta_option_1
	- cta_option_2
- For each variant include:
	- visual_suggestion
	- targeting_suggestion

WRITING RULES
- Use second-person singular voice.
- Use concrete claims and specific language.
- Integrate proof and objection-handling in medium/long versions.
- Keep social-native style while preserving deterministic structure.
- Generate all headlines, body copy, CTA options, visual suggestions, and targeting suggestions in Italian (`it-IT`).

OUTPUT FORMAT
Return structured markdown blocks following this exact pattern:
### VARIANT [A/B/C] - AWARENESS: [state]
...
```

## 3. Alternatives

- **ALT-001**: Reuse legacy `meta_ads` as primary workflow identifier. Rejected because DDD-094 requires `meta_ads_generator` as canonical workflow identity.
- **ALT-002**: Keep ToolStep workflow undefined. Rejected because current scope requires a deterministic max-2-step rollout.
- **ALT-003**: Implement FE-only identity rollout before contracts update. Rejected because it creates FE/BE drift and breaks deterministic mapping authority.

## 4. Dependencies

- **DEP-001**: DDD-094 in `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-002**: Canonical glossary updates in `docs/01-requirements/domain-ubiquitous-language-glossary.md`.
- **DEP-003**: Canonical translation rules in `docs/02-design/domain-bounded-context-map.md`.
- **DEP-004**: Shared contract authority in `packages/contracts/src/tool-workflows.ts`.
- **DEP-005**: Session Summary parity surfaces in frontend pages and artifact-history resolvers.
- **DEP-006**: Master copy framework source document used as prompt authority for generation output structure.

## 5. Files

- **FILE-001**: `plan/feature-tool-meta-ads-1.md` - this implementation plan.
- **FILE-002**: `packages/contracts/src/tool-workflows.ts` - ToolKey/ToolWorkflow and step-order authority.
- **FILE-003**: `apps/backend/src/lib/runtime/request-contract.ts` - request normalization and validation.
- **FILE-004**: `apps/backend/src/lib/runtime/tool-workflow-registry.ts` - orchestration registry integration.
- **FILE-005**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` - FE label/route/config registration.
- **FILE-006**: `apps/frontend/src/features/generation/ui/artifact-history.ts` - relaunch/tool-entry route assembly.
- **FILE-007**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.tsx` - list parity label rendering.
- **FILE-008**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx` - detail parity label + relaunch.
- **FILE-009**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` - resume/regenerate parity on the canonical 2-step workflow.
- **FILE-010**: `apps/backend/src/lib/tests/` and `apps/frontend/src/features/**/**.test.ts*` - focused regression coverage.
- **FILE-011**: `apps/backend/src/lib/runtime/tool-prompts/` - prompt modules for extraction and generation.
- **FILE-012**: `apps/backend/src/lib/machines/generation/extraction-parsers.ts` - extraction markdown parser normalization for Meta Ads.
- **FILE-013**: `apps/backend/src/lib/runtime/workflow-normalizers.ts` - final-step artifact-role mapping used by resume/relaunch/session parity logic.
- **FILE-014**: `apps/backend/src/lib/machines/tool-workflow.machine.ts` and `apps/frontend/src/features/tools/machines/tool-page.machine.ts` - XState transition authority for workflow progression and resume-checkpoint behavior.

## 6. Testing

- **TEST-001**: Contract-level tests for ToolKey/ToolWorkflow mapping and normalization (`meta-ads`, `meta_ads_generator`, deprecated alias handling).
- **TEST-002**: Backend focused tests for extraction normalization and orchestration guard behavior on the canonical extraction + 2-step generation sequence.
- **TEST-003**: Frontend tests for `getToolLabel` and `getToolRoute` deterministic resolution for Meta Ads.
- **TEST-004**: Session Summary list/detail tests to verify Tool display label parity for Meta Ads.
- **TEST-005**: Relaunch route tests ensuring CTA resolves to `/tools/meta-ads` when artifact and stream-state conditions are valid.
- **TEST-006**: Tests for prompt output completeness: 3 variants, 4 lengths each, CTA x2, visual suggestion, targeting suggestion.
- **TEST-009**: Tests for extraction contract compliance: Context Generation output is markdown-only and parser normalization yields all mandatory CG-FLD fields.
- **TEST-008**: Tests for language compliance: all generated copy fields must be Italian (`it-IT`) regardless of prompt instruction language.
- **TEST-007**: Resume-checkpoint parity tests across the finalized 2-step workflow.
- **TEST-010**: XState v5 transition tests for Meta Ads covering: deterministic step progression (`context-generation` -> `ads-generation`), paused-checkpoint resume targeting, and non-regression on existing tools.

## 7. Risks & Assumptions

- **RISK-001**: Context extraction incompleteness may block Step 2 generation.
- **RISK-002**: Alias regression risk if `meta_ads` is accidentally reintroduced as primary workflow key.
- **RISK-003**: Session parity drift if list/detail and relaunch mappings are updated inconsistently.
- **RISK-004**: Output contract drift from master prompt can break deterministic UI rendering.
- **ASSUMPTION-001**: The 2-step workflow is accepted as canonical for the first production increment.
- **ASSUMPTION-002**: Existing routing and session-query infrastructure can support Meta Ads with localized changes.
- **ASSUMPTION-003**: User-provided briefing includes enough signal to extract all required context fields.

## 8. Related Specifications / Further Reading

[DDD Naming Decisions](../docs/07-governance/domain-naming-decision-log.md)
[DDD Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[DDD Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Tool Development Plan Template](../docs/99-reference/templates/tool-development-plan-template.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Tool Workspace Runtime Spec](../docs/02-design/specifications/tool-page-frontend-runtime-spec.md)
