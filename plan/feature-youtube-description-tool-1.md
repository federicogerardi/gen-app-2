---
goal: Implement the canonical YouTube Description Tool with direct-input context generation and single-step description output
version: 1.2
date_created: 2026-05-26
last_updated: 2026-06-22
owner: Frontend Platform + Backend Runtime
status: Completed
tags: [feature, tool-workspace, backend, frontend, ddd, validation, youtube-description]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines the deterministic implementation of a new Tool with identity TOOL_KEY `youtube-description`, display label `YT Description Generator`, and runtime behavior based on direct user-input payload assembly followed by one generation step for the final YouTube description output.

The tool explicitly does not support file upload. Context generation must be derived only from structured input fields entered in Tool Workspace setup.

## 1. Requirements & Constraints

- **REQ-001**: Introduce canonical Tool identity values: TOOL_KEY `youtube-description`, TOOL_WORKFLOW `youtube_description`, TOOL_DISPLAY_LABEL `YT Description Generator`.
- **REQ-002**: Register the new tool in shared contracts as the only source of truth for FE/BE mapping and step order.
- **REQ-003**: Implement deterministic workflow semantics: context payload creation from direct-input fields only, then single generation step `youtube-description-generation`.
- **REQ-004**: No file upload is allowed for this tool; `ToolInputFileRequirementPolicy` is not used for start gating on this tool.
- **REQ-005**: Enforce one canonical relaunch and route-resolution path for Session Summary and Artifact relaunch surfaces.
- **REQ-006**: Add deterministic label and route resolution so `/sessionsummary` list/detail never exposes raw workflow identifiers.
- **REQ-007**: Integrate the two provided prompt assets into backend prompt governance: one strategy/description prompt and one output-structure/validation prompt.
- **REQ-008**: Preserve existing behavior for all already supported tools.
- **REQ-009**: The generated output must include CTA-first structure, SEO paragraphs, separators, social links, chapter timestamps, hashtags, and pinned-comment suggestion as specified by prompt assets.
- **REQ-010**: If timestamps are missing in user input, generation must fail with explicit validation reason before dispatch.
- **REQ-011**: Prompt application logic must preserve anti-keyword-stuffing constraints and natural-language quality checks defined by prompt assets.
- **REQ-012**: Keep one Start Context Generation Action in Tool Workspace, with context-generation semantics bound to direct-input validation only.
- **REQ-013**: Required input fields for this tool are mandatory and non-optional at dispatch boundary: `videoTitle`, `topic`, `keywords`, `ctaText`, `ctaLink`, `credentialsOrProof`, `chaptersWithTimestamps`, `socialLinks`, `hashtags`.
- **REQ-014**: Context generation prompt must preserve the strategic layer of the master prompt: human-first writing intent, anti-keyword-stuffing guardrails, semantic proximity logic, and deterministic output structure contract.
- **REQ-015**: Artifact generation prompt must preserve the full logical layer of the master prompt: CTA above fold, paragraph strategy, separators, social links, chapters, hashtags, and quality self-check gates.
- **REQ-016**: Runtime gate enforcement is mandatory in execution code paths (not prompt text only): markdown-only output, no JSON payload output, quality-gate blocking, and final artifact language `it-IT`.
- **REQ-017**: Accepted chapter timestamp formats are explicitly constrained to `m:ss`, `mm:ss`, and `h:mm:ss`; all chapter rows must pass strict parsing before generation dispatch.
- **REQ-018**: XState machine coverage is mandatory for this tool rollout: backend and frontend machine transitions, guards, and actor boundaries must be explicitly mapped and updated where required.
- **REQ-019**: Runtime gate failures (non-markdown output, JSON-shaped output, quality-gate failure, invalid context) must map to deterministic machine events and explicit blocked/error state branches with recovery path.
- **REQ-020**: Single-step relaunch/hydration semantics must remain deterministic in machine state progression (`prefilled-regenerate` -> `running` -> `completed` or blocked/error branch) without implicit fallback transitions.
- **SEC-001**: Reuse existing auth and tool availability checks on tools endpoints; unauthorized roles must receive canonical `403` error envelope.
- **DDD-001**: Before runtime implementation, add DDD decision entry for new Tool identity and step naming; no local synonyms.
- **DDD-002**: Update glossary and bounded-context map in the same change set as code registration.
- **CON-001**: No lockfile edits are expected because no new dependencies are required.
- **CON-002**: Keep changes localized to contracts, runtime registries, prompt maps, tool config, routing, and tests.
- **GUD-001**: Reuse existing prompt module pattern under backend `tool-prompts` and existing tool-page factory in frontend.
- **PAT-001**: Use shared contracts (`packages/contracts/src/tool-workflows.ts`) as single mapping authority.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish canonical DDD baseline and deterministic tool identity before any runtime code changes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add new naming decision entry in `docs/07-governance/domain-naming-decision-log.md` for ToolKey `youtube-description`, ToolWorkflow `youtube_description`, display label `YT Description Generator`, and single generation step `youtube-description-generation`. |  |  |
| TASK-002 | Extend `docs/01-requirements/domain-ubiquitous-language-glossary.md` with canonical term coverage for the new tool and direct-input-only context generation rule. |  |  |
| TASK-003 | Update cross-context translation notes in `docs/02-design/domain-bounded-context-map.md` for kebab/snake mapping and no-file-input policy for this tool. |  |  |
| TASK-004 | Update UI governance note in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` to classify the tool as Tool Workspace Page using direct-input matrix gating only. |  |  |

### Implementation Phase 2

- GOAL-002: Register contracts and backend orchestration for new tool identity and one-step workflow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add tool definition to `packages/contracts/src/tool-workflows.ts` with ToolKey `youtube-description`, ToolWorkflow `youtube_description`, and step list `youtube-description-generation` (no dependencies). |  |  |
| TASK-006 | Extend tool availability map in `packages/contracts/src/tool-workflows.ts` with explicit policy for `youtube-description`. |  |  |
| TASK-007 | Update backend workflow registry in `apps/backend/src/lib/runtime/tool-workflow-registry.ts` to include the new tool plan and dependency resolution path. |  |  |
| TASK-008 | Extend normalizers in `apps/backend/src/lib/runtime/workflow-normalizers.ts` with tool/workflow aliases and final-step artifact role mapping for `youtube-description-generation`. |  |  |
| TASK-009 | Update request normalization in `apps/backend/src/lib/runtime/request-contract.ts` to validate direct-input required fields and timestamp presence for this tool before dispatch. |  |  |
| TASK-010 | Update prompt resolver map in `apps/backend/src/lib/runtime/tool-prompts/index.ts` to route new tool step to dedicated prompt files. |  |  |
| TASK-010A | Add backend XState machine alignment in `apps/backend/src/lib/machines/generation-system.machine.ts` and `apps/backend/src/lib/machines/tool-workflow.machine.ts`: explicit event routing and blocked/error transition branches for runtime gate failures on `youtube-description-generation`. |  |  |

### Implementation Phase 3

- GOAL-003: Implement backend prompt pack and context-validation contract for direct-input generation flow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create prompt module folder `apps/backend/src/lib/runtime/tool-prompts/youtube-description/` with `prompt_context_generation.md` capturing the business/strategy prompt asset. |  |  |
| TASK-012 | Create `apps/backend/src/lib/runtime/tool-prompts/youtube-description/prompt_youtube_description_generation.md` capturing the writing/SEO/output-structure prompt asset. |  |  |
| TASK-013 | Add deterministic prompt merge rules in `apps/backend/src/lib/runtime/tool-prompts/index.ts`: context prompt + generation prompt + step metadata for single-step execution. |  |  |
| TASK-014 | Define backend validation contract for required input fields: video title, topic, keywords list, CTA+link, proof/credentials, chapters with timestamps, social links, hashtags. Reject when chapters/timestamps are missing. |  |  |
| TASK-014A | Implement runtime gate enforcement in execution handlers/adapters: reject non-markdown outputs, reject JSON-shaped outputs, block artifact emission when quality gates fail, and enforce final artifact language `it-IT`. |  |  |

## 2b. Prompt Specifications (Deterministic)

This section is normative for prompt implementation. The strategic and logical depth of the master prompt must remain unchanged.

### Prompt A - Context Generation From User Inputs

- **PROMPT-A-001 (Objective)**: Transform raw user inputs into a normalized context payload for one-step YouTube description generation.
- **PROMPT-A-002 (Scope)**: No file parsing is allowed. Input source is only Tool Workspace fields.
- **PROMPT-A-003 (Tone Governance)**: Preserve human-first intent from master prompt: natural, conversational, non-robotic language constraints.
- **PROMPT-A-004 (SEO Governance)**: Preserve semantic proximity and anti-stuffing rules; do not force keyword permutations.
- **PROMPT-A-005 (Validation Strategy)**: Validate completeness and quality readiness before artifact generation.

Required input contract for Prompt A:

- **A-IN-001**: `videoTitle` (string, non-empty) - exact video title.
- **A-IN-002**: `topic` (string, non-empty) - 1-2 sentence topic summary.
- **A-IN-003**: `keywords` (string array, min 1) - target keywords list.
- **A-IN-004**: `ctaText` (string, non-empty) - desired call-to-action text.
- **A-IN-005**: `ctaLink` (string, non-empty URL) - destination URL for CTA.
- **A-IN-006**: `credentialsOrProof` (string, non-empty) - numbers/results/experience evidence.
- **A-IN-007**: `chaptersWithTimestamps` (array, min 1) - chapter rows with valid timestamp format.
- **A-IN-008**: `socialLinks` (object or array, min 1) - social profiles to include.
- **A-IN-009**: `hashtags` (string array, min 1, max 5) - relevant hashtags.

Prompt A deterministic validation rules:

- **A-VAL-001**: Reject if any required field is missing or empty.
- **A-VAL-002**: Reject if `ctaLink` is not a valid URL format.
- **A-VAL-003**: Reject if `chaptersWithTimestamps` is missing or contains invalid timestamps.
- **A-VAL-007**: Strict accepted timestamp formats are only: `m:ss`, `mm:ss`, `h:mm:ss`.
- **A-VAL-008**: Timestamp parser rejects non-numeric segments, missing seconds, and invalid second ranges (`00-59`).
- **A-VAL-004**: Reject if `hashtags.length > 5`.
- **A-VAL-005**: Normalize keywords by semantic deduplication (permutation-equivalent variants are grouped, not duplicated).
- **A-VAL-006**: Build keyword priority buckets: primary (top intent), secondary (supportive), residual (optional usage).

Prompt A output contract:

- **A-OUT-001**: `Normalized Input` section with sanitized field values.
- **A-OUT-002**: `Keyword Plan` section with deterministic placement targets (opening lines, paragraph 1, paragraph 2).
- **A-OUT-003**: `Style Constraints` section including anti-stuffing and human readability constraints.
- **A-OUT-004**: `Structure Plan` section matching the required final description blocks.
- **A-OUT-005**: `Quality Checklist` section prefilled with mandatory checks from master prompt.

### Prompt B - YouTube Description Artifact Generation

- **PROMPT-B-001 (Objective)**: Generate one final artifact: complete YouTube description for business channels.
- **PROMPT-B-002 (Input Source)**: Consume Prompt A output only; no side-input assumptions.
- **PROMPT-B-003 (Language Style)**: First-person, direct, conversational, natural cadence with short/medium sentence alternation.
- **PROMPT-B-004 (SEO Logic)**: Integrate keywords naturally with semantic proximity; avoid stacking and mechanical repetition.
- **PROMPT-B-005 (No-Drift Rule)**: Keep strategy and logic depth equivalent to master prompt; no simplification of structural or quality rules.

Prompt B mandatory artifact structure:

- **B-STR-001**: Lines 1-2 with primary CTA and real link (visible before "Mostra altro").
- **B-STR-002**: Paragraph 1 (hook): value promise + differentiation + primary keyword integration.
- **B-STR-003**: Paragraph 2 (content): concrete topics, examples/proof, secondary keywords.
- **B-STR-004**: Paragraph 3 (audience fit): for whom + expected result after watching.
- **B-STR-005**: Visual separator block.
- **B-STR-006**: Social links block.
- **B-STR-007**: Visual separator block.
- **B-STR-008**: Chapters with timestamps block.
- **B-STR-009**: Visual separator block.
- **B-STR-010**: Hashtags block (max 5).

Prompt B prohibited patterns:

- **B-BAN-001**: Keyword stuffing phrases and synthetic repetition.
- **B-BAN-002**: Consecutive near-duplicate keyword variants.
- **B-BAN-003**: Keyword-label sentence shells without communicative purpose.
- **B-BAN-004**: Paragraph-as-list disguised enumerations.
- **B-BAN-005**: Detached keyword tags outside natural sentence context.

Prompt B deterministic quality gates (must run before returning output):

- **B-QA-001**: Real-person readability test passes.
- **B-QA-002**: Anti-stuffing test passes (no sentence exists only to host a keyword).
- **B-QA-003**: Permutation test passes (no forced order variants).
- **B-QA-004**: Opening-lines test passes (hook + CTA + primary keyword intent).
- **B-QA-005**: Density test passes (primary keyword target range respected).

Prompt B output contract:

- **B-OUT-001**: `YouTube Description` section (single complete markdown/plaintext artifact body as required by UI).
- **B-OUT-002**: `Pinned Comment Suggestion` section (CTA or engagement question).
- **B-OUT-003**: `Quality Report` section with pass/fail for B-QA-001..B-QA-005.
- **B-OUT-004**: `Validation Errors` section (empty when successful).

Prompt A -> Prompt B orchestration contract:

- **AB-FLOW-001**: Prompt B executes only if Prompt A validation passes with no blocking errors.
- **AB-FLOW-002**: Any missing mandatory field in Prompt A returns deterministic validation error and aborts artifact generation.
- **AB-FLOW-003**: Chapters block generation is blocked when timestamps are invalid or absent.
- **AB-FLOW-004**: Hashtag count is hard-capped at 5 in final artifact.
- **AB-FLOW-005**: Final artifact is unique and singular per run (one description artifact output).

## 2c. Runtime Copy-Paste Prompts

Use these prompts as execution-ready runtime assets during implementation and testing. The strategic/logical depth must remain unchanged.
Production alignment note: existing tools use deterministic gates with markdown-only outputs and explicit No JSON rules. The following prompts must follow the same pattern.

### Runtime Prompt A - Context Generation (Direct Input Only)

```text
SYSTEM ROLE
You are a Context Generation engine for the youtube-description tool.

OBJECTIVE
Transform user inputs into a normalized context payload ready for a single YouTube description artifact generation.

SCOPE
- No file parsing.
- No uploads.
- Use only the provided input fields.

MANDATORY INPUT FIELDS
1) videoTitle
2) topic
3) keywords
4) ctaText
5) ctaLink
6) credentialsOrProof
7) chaptersWithTimestamps
8) socialLinks
9) hashtags

INPUT PAYLOAD
videoTitle: {{videoTitle}}
topic: {{topic}}
keywords: {{keywords}}
ctaText: {{ctaText}}
ctaLink: {{ctaLink}}
credentialsOrProof: {{credentialsOrProof}}
chaptersWithTimestamps: {{chaptersWithTimestamps}}
socialLinks: {{socialLinks}}
hashtags: {{hashtags}}

VALIDATION RULES
- Reject if any mandatory field is missing or empty.
- Reject if ctaLink is not a valid URL.
- Reject if chaptersWithTimestamps is missing or contains invalid timestamps.
- Accepted timestamp formats are strictly: m:ss, mm:ss, h:mm:ss.
- Reject timestamps with invalid second ranges (seconds must be 00-59).
- Reject if hashtags has more than 5 items.
- Normalize keywords by grouping semantically equivalent permutation variants.

SEO + STYLE GOVERNANCE
- Keep human-first logic: no mechanical writing.
- Keep anti-keyword-stuffing logic.
- Keep semantic proximity logic.
- Define keyword priority buckets: primary, secondary, residual.
- Output language policy for downstream generation: it-IT (alias accepted in payload/docs: IT_it).

OUTPUT RULES
- Markdown only.
- No JSON.
- No code fences.
- Context-step markdown sections must be written in it-IT (alias accepted in payload/docs: IT_it).

REQUIRED OUTPUT STRUCTURE
## Validation Status
- status: ok | error
- blocking_errors:

## Normalized Input
- video_title:
- topic:
- keywords:
- cta_text:
- cta_link:
- credentials_or_proof:
- chapters_with_timestamps:
- social_links:
- hashtags:

## Keyword Plan
- primary:
- secondary:
- residual:
- placement_targets:
  - opening_lines:
  - paragraph_1:
  - paragraph_2:

## Style Constraints
- human_first: true
- anti_stuffing: true
- semantic_proximity: true
- no_forced_permutations: true

## Structure Plan
- requires_cta_above_fold: true
- requires_three_paragraph_body: true
- requires_separators: true
- requires_social_block: true
- requires_chapters_block: true
- requires_hashtags_block: true
- hashtags_max: 5

## Quality Checklist
- real_person_test
- anti_stuffing_test
- permutation_test
- opening_lines_test
- density_test

## Output Language Policy
- final_description_language: it-IT (alias: IT_it)
- context_step_language: it-IT (alias: IT_it)

ERROR BEHAVIOR
If status is error, return only Validation Status plus blocking_errors and stop.
```

### Runtime Prompt B - YouTube Description Artifact Generation

```text
SYSTEM ROLE
Act as a YouTube SEO copywriter focused on human readability and conversion.

OBJECTIVE
Generate one final artifact: a complete YouTube description for a business channel.

INPUT
Consume ONLY the markdown context produced by Runtime Prompt A.

PRECONDITION
If Prompt A Validation Status is not ok, stop and return only:

## Generation Status
- status: blocked
- reason: invalid_context
- validation_errors:

STRATEGIC RULES (NON NEGOTIABLE)
- The description must read as human-written, not bot-written.
- No keyword stuffing.
- No forced order-variant permutations of the same keyword.
- Primary keywords must appear in the first 2-3 lines and in paragraph 1.
- Keep a natural conversational flow.
- Final description output must be in it-IT (alias accepted in payload/docs: IT_it).

MANDATORY OUTPUT STRUCTURE
1) Primary CTA in the first 2 lines with a real link.
2) Paragraph 1 (hook): audience value + differentiation + primary keywords.
3) Paragraph 2 (content): concrete coverage + proof/credentials + secondary keywords.
4) Paragraph 3 (audience fit): who it is for + post-watch outcome.
5) Visual separator.
6) Social links.
7) Visual separator.
8) Chapters with timestamps.
9) Visual separator.
10) Hashtags (max 5).

PROHIBITED PATTERNS
- Sentences created only to host keywords.
- Near-duplicate repeated keyword variants.
- List-like disguised paragraph bodies.
- Detached keywords with no narrative context.

QUALITY GATES (RUN BEFORE OUTPUT)
- real_person_test
- anti_stuffing_test
- permutation_test
- opening_lines_test
- density_test

OUTPUT RULES
- Markdown only.
- No JSON.
- No code fences.
- youtubeDescription and pinnedCommentSuggestion must be written in it-IT (alias accepted in payload/docs: IT_it).

REQUIRED OUTPUT STRUCTURE
## Generation Status
- status: ok | blocked
- validation_errors:

## YouTube Description
[full final description body]

## Pinned Comment Suggestion
[one CTA or engagement question]

## Quality Report
- real_person_test: pass | fail
- anti_stuffing_test: pass | fail
- permutation_test: pass | fail
- opening_lines_test: pass | fail
- density_test: pass | fail

## Output Language
- it-IT (alias: IT_it)

CONSTRAINTS
- Exactly one description artifact per run.
- Hashtags max 5.
- If any quality gate fails, set status = blocked and populate validation_errors.
- youtubeDescription and pinnedCommentSuggestion must be written in it-IT (alias accepted in payload/docs: IT_it).
```

## 2d. XState Runtime Contract (Deterministic)

This section is normative for machine-level behavior and complements prompt/runtime validation rules.

### State/Event Mapping For Runtime Gates

| Gate Condition | Runtime Event | Expected Transition | Recovery Policy |
|------|-------------|-----------|------|
| Context validation failed before generation dispatch (missing required fields, invalid timestamps) | `CONTEXT_VALIDATION_FAILED` | Tool page flow stays in configuring/blocked branch; generation dispatch is aborted | User corrects form input and re-triggers primary action |
| Generation output is JSON-shaped or non-markdown | `OUTPUT_CONTRACT_REJECTED` | Running state moves to blocked/error branch for current step; artifact publication is aborted | Retry only after regenerated output passes markdown-only/no-json contract |
| Quality gates failed (`real_person_test`, `anti_stuffing_test`, `permutation_test`, `opening_lines_test`, `density_test`) | `QUALITY_GATE_FAILED` | Running state moves to blocked branch; no final artifact emission | Update context/inputs and re-run current step |
| Prompt A status is error (`invalid_context`) | `GENERATION_BLOCKED_INVALID_CONTEXT` | Prompt B execution path is not entered; machine remains in pre-dispatch blocked branch | Fix blocking errors from Prompt A and re-dispatch |
| Output language mismatch vs required `it-IT` policy | `OUTPUT_LANGUAGE_REJECTED` | Step terminal success is denied; machine transitions to blocked/error branch | Re-run with corrected language-compliant output |

### Transition Determinism Rules

- Runtime gate failures must never produce implicit success transitions.
- Single-step tools must still preserve explicit transition branches (`running` -> `completed` or blocked/error).
- Recovery must be event-driven (explicit retry/regenerate event), not context mutation side-effects.
- Any blocked/error branch must preserve deterministic relaunch semantics for artifact/session surfaces.

### Implementation Phase 4

- GOAL-004: Enable frontend Tool Workspace, route mapping, and Session Summary parity for the new tool.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add tool configuration entry in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` including label, route, step metadata, direct-input requirement matrix, and no-file instructions profile. |  |  |
| TASK-016 | Add page wrapper `apps/frontend/src/features/tools/youtube-description/pages/YoutubeDescriptionToolPage.tsx` using `createToolPage` factory from `apps/frontend/src/features/tools/ui/createToolPage.tsx`. |  |  |
| TASK-017 | Register lazy route in `apps/frontend/src/app/routing/app-router.tsx` and include component mapping for the new tool key. |  |  |
| TASK-018 | Extend label/route resolvers in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` (`getToolLabel`, `getToolRoute`, navigation registry). |  |  |
| TASK-019 | Update relaunch path builders in `apps/frontend/src/features/generation/ui/artifact-history.ts` and session summary resolution in `apps/frontend/src/features/sessionsummary/runtime/session-summary-domain.ts` to accept new tool key deterministically. |  |  |
| TASK-019A | Align frontend XState paths in `apps/frontend/src/features/tools/machines/tool-page.machine.ts` and related selectors: explicit blocked/error event handling for runtime-gate failures and deterministic single-step relaunch progression. |  |  |

### Implementation Phase 5

- GOAL-005: Add deterministic tests and execute mandatory validation gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Extend contract tests for tool/workflow normalization and reverse mapping in `packages/contracts/src/tool-workflows.ts` related test files. |  |  |
| TASK-021 | Add backend tests for orchestrate and normalization paths in `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts` and related request/normalizer suites. |  |  |
| TASK-022 | Add frontend tests for tool config, label/route resolution, and no-file-required behavior in `apps/frontend/src/features/tools/runtime/tool-form-architecture.test.ts`. |  |  |
| TASK-023 | Add frontend integration tests for Tool Workspace start gating and dispatch using direct-input-only context in `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx`. |  |  |
| TASK-024 | Add session parity tests in `apps/frontend/src/features/sessionsummary/pages/SessionSummaryListPage.test.tsx` and `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.test.tsx` for label and relaunch route correctness. |  |  |
| TASK-025 | Execute gates: `npm run typecheck --workspaces --if-present`, backend focused tests, frontend focused tests, `npm --workspace apps/frontend run build`, `npm run build`; record pass/fail evidence in plan update. |  |  |
| TASK-026 | Add backend tests for runtime gate enforcement: markdown-only accepted, JSON-shaped output blocked, quality-gate failure blocks artifact emission, final artifact language `it-IT` enforced. |  |  |
| TASK-027 | Add parser tests for timestamp formats (`m:ss`, `mm:ss`, `h:mm:ss`) and invalid cases (missing seconds, malformed tokens, seconds > 59). |  |  |
| TASK-028 | Add frontend integration test asserting dispatch is blocked when chapter timestamps are invalid and unblocked only with accepted formats. |  |  |
| TASK-029 | Add backend machine transition tests for `generation-system.machine.ts` and `tool-workflow.machine.ts` covering `CONTEXT_VALIDATION_FAILED`, `OUTPUT_CONTRACT_REJECTED`, `QUALITY_GATE_FAILED`, `OUTPUT_LANGUAGE_REJECTED`, and valid completion path. |  |  |
| TASK-030 | Add frontend machine transition tests for `tool-page.machine.ts` covering blocked/error runtime-gate events, retry/regenerate recovery path, and deterministic relaunch progression for single-step tool. |  |  |
| TASK-031 | Add regression pair tests validating that existing multi-step tools keep unchanged machine transition behavior after introducing youtube-description gate events. |  |  |

### 5a. XState Acceptance Mini Matrix (New Tasks)

| Task | Input | Expected Transition | Expected Terminal State |
|------|-------------|-----------|------|
| TASK-010A | Runtime event `CONTEXT_VALIDATION_FAILED` raised before step dispatch in backend machine path | pre-dispatch/running -> blocked/error branch, no publish side-effect | blocked/error (non-terminal-success), artifact not emitted |
| TASK-010A | Runtime event `QUALITY_GATE_FAILED` or `OUTPUT_CONTRACT_REJECTED` raised during `youtube-description-generation` | running -> blocked/error branch for current step | blocked/error with deterministic retry/regenerate path |
| TASK-010A | Valid single-step execution with compliant markdown output and language `it-IT` | running -> completed | completed with final artifact role `final` |
| TASK-019A | Frontend receives blocked runtime-gate event while in generation flow | running -> blocked/error UI branch in `tool-page.machine.ts` | blocked/error with actionable recovery CTA |
| TASK-019A | User triggers retry/regenerate after fixing input/context | blocked/error -> running | running, then completed on success |
| TASK-019A | Relaunch entry from artifact/session in single-step tool | prefilled-regenerate -> running -> completed (or blocked/error) | completed (or blocked/error) with no implicit fallback transition |
| TASK-029 | Backend test fixture injects each gate failure event (`CONTEXT_VALIDATION_FAILED`, `OUTPUT_CONTRACT_REJECTED`, `QUALITY_GATE_FAILED`, `OUTPUT_LANGUAGE_REJECTED`) | asserted transition to blocked/error branch per event | deterministic blocked/error terminal snapshot per event |
| TASK-029 | Backend test fixture injects valid generation path | asserted transition to completed | completed snapshot with publish side-effect allowed |
| TASK-030 | Frontend machine test injects blocked/error gate event | asserted `running` -> blocked/error transition | blocked/error snapshot with recovery action enabled |
| TASK-030 | Frontend machine test injects retry/regenerate event after blocked/error | asserted blocked/error -> running transition | running (then completed on success path assertion) |
| TASK-031 | Regression fixture executes existing multi-step tool happy path after new events introduction | baseline transitions unchanged for legacy tools | completed snapshot equivalent to pre-change baseline |
| TASK-031 | Regression fixture executes existing multi-step tool error/recovery path | error/recovery transitions unchanged for legacy tools | terminal snapshot equivalent to pre-change baseline |

## 3. Alternatives

- **ALT-001**: Implement as extraction-based tool with briefing upload. Rejected because requirement explicitly states direct-input-only context generation.
- **ALT-002**: Reuse existing `youtube-lf-script` workflow with additional step flags. Rejected because domain purpose and output contract are different and require independent ToolKey.
- **ALT-003**: Put prompt text inline in frontend. Rejected because backend prompt governance is canonical and already standardized in tool-prompts modules.
- **ALT-004**: Allow missing chapter timestamps and auto-generate placeholders. Rejected because source prompt requires explicit timestamp accuracy and failure when missing.

## 4. Dependencies

- **DEP-001**: Canonical DDD documents under `docs/01-requirements/`, `docs/02-design/`, and `docs/07-governance/` must be updated before code merge.
- **DEP-002**: Shared contracts authority in `packages/contracts/src/tool-workflows.ts` must be updated first to avoid FE/BE drift.
- **DEP-003**: Backend prompt resolver path in `apps/backend/src/lib/runtime/tool-prompts/index.ts` must resolve the new prompt files.
- **DEP-004**: Existing Tool Workspace runtime hooks and selectors in `apps/frontend/src/features/tools/runtime/` must support direct-input matrix policy for no-file tools.

## 5. Files

- **FILE-001**: `docs/07-governance/domain-naming-decision-log.md` - Add canonical naming decision for youtube-description tool.
- **FILE-002**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` - Extend glossary with new tool semantics.
- **FILE-003**: `docs/02-design/domain-bounded-context-map.md` - Add translation and no-file-input constraint.
- **FILE-004**: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` - Add Tool Workspace governance note for direct-input-only tool.
- **FILE-005**: `packages/contracts/src/tool-workflows.ts` - Register ToolKey/ToolWorkflow/step order/availability.
- **FILE-006**: `apps/backend/src/lib/runtime/tool-workflow-registry.ts` - Register backend workflow plan.
- **FILE-007**: `apps/backend/src/lib/runtime/workflow-normalizers.ts` - Normalize and resolve final-step role.
- **FILE-008**: `apps/backend/src/lib/runtime/request-contract.ts` - Validate required direct-input payload fields.
- **FILE-009**: `apps/backend/src/lib/runtime/tool-prompts/index.ts` - Add prompt mapping.
- **FILE-010**: `apps/backend/src/lib/runtime/tool-prompts/youtube-description/prompt_context_generation.md` - Prompt asset A adaptation.
- **FILE-011**: `apps/backend/src/lib/runtime/tool-prompts/youtube-description/prompt_youtube_description_generation.md` - Prompt asset B adaptation.
- **FILE-012**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` - Tool registry, labels, route, requirements.
- **FILE-013**: `apps/frontend/src/features/tools/youtube-description/pages/YoutubeDescriptionToolPage.tsx` - Tool page wrapper.
- **FILE-014**: `apps/frontend/src/app/routing/app-router.tsx` - Lazy route and component registration.
- **FILE-015**: `apps/frontend/src/features/generation/ui/artifact-history.ts` - Relaunch route compatibility.
- **FILE-016**: `apps/frontend/src/features/sessionsummary/runtime/session-summary-domain.ts` - Tool key resolution parity.
- **FILE-017**: `apps/backend/src/lib/machines/generation-system.machine.ts` - Runtime gate event routing and blocked/error transitions.
- **FILE-018**: `apps/backend/src/lib/machines/tool-workflow.machine.ts` - Step-level transition branches for runtime gate outcomes.
- **FILE-019**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` - Deterministic frontend state progression for blocked/error + relaunch.

## 6. Testing

- **TEST-001**: Contract normalization test for `youtube-description` and `youtube_description` mapping.
- **TEST-002**: Backend orchestrate test for single-step dependency result (empty dependencies for first step).
- **TEST-003**: Backend request validation test rejects missing timestamps in chapters input.
- **TEST-004**: Frontend tool registry test confirms route `/tools/youtube-description` and label `YT Description Generator`.
- **TEST-005**: Frontend Tool Workspace test verifies no file upload is required for start eligibility.
- **TEST-006**: Session Summary list/detail tests verify canonical tool label rendering and relaunch URL generation.
- **TEST-007**: Non-regression pair test verifies at least one existing tool path remains unchanged after new tool registration.
- **TEST-008**: Runtime gate enforcement test verifies markdown-only/no-json behavior in generated artifact pipeline.
- **TEST-009**: Runtime gate enforcement test verifies quality-gate failure blocks artifact publication.
- **TEST-010**: Runtime gate enforcement test verifies output language is `it-IT` for context-step and final artifact sections.
- **TEST-011**: Timestamp parser test verifies acceptance for `m:ss`, `mm:ss`, `h:mm:ss` and rejection for malformed timestamps.
- **TEST-012**: Backend XState transition test verifies deterministic blocked/error transitions for runtime gate failure events.
- **TEST-013**: Backend XState transition test verifies single-step success path transitions to completed with no intermediate dependency drift.
- **TEST-014**: Frontend XState transition test verifies blocked/error event handling and explicit retry/regenerate recovery transitions.
- **TEST-015**: Frontend relaunch/hydration transition test verifies `prefilled-regenerate` -> `running` -> `completed` or blocked/error without implicit fallback transitions.

## 7. Risks & Assumptions

- **RISK-001**: Terminology drift if workflow name is introduced without DDD decision first.
- **RISK-002**: FE/BE mismatch if tool mapping is edited outside shared contracts.
- **RISK-003**: Prompt behavior drift if source assets are copied without deterministic normalization rules.
- **RISK-004**: False-positive readiness if no-file tool still depends on legacy upload-based gating selectors.
- **ASSUMPTION-001**: No new npm dependencies are required for implementation.
- **ASSUMPTION-002**: Prompt assets provided in current request are approved as canonical content source for this tool.
- **ASSUMPTION-003**: Tool availability policy for new tool defaults to `enabled-for-all` unless changed by governance decision.

## 8. Related Specifications / Further Reading

[Tool Development Plan Template](../docs/99-reference/templates/tool-development-plan-template.md)
[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Tool Page Frontend Runtime Spec](../docs/02-design/specifications/tool-page-frontend-runtime-spec.md)
