---
status: completed
version: 1.2
date_created: 2026-07-23
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Backend Runtime
type: implementation-plan
tags: [prompt-engineering, tool-generation, remediation, prompt-templates]
implementation_date: 2026-07-23
---

# Prompt Layer Remediation Plan

> **Source**: `docs/02-design/prompt-layer-quality-review.md` v1.1
> **Scope**: 34 prompt templates across 12 tools. Markdown-only changes except Phase 3.1 (~20 lines of TypeScript).
> **Governor**: DDD documentation governance (AGENTS.md). All prompt files live under `apps/backend/src/lib/runtime/tool-prompts/`.

## Decisions (from review session)

| # | Decision | Rationale |
|---|---|---|
| D1 | Remove broken `prompt_root.md` references from 7 files | Silent no-op today; removal fixes the bug. Shared root can be reintroduced later. |
| D2 | System instructions in English, artifact output in Italian | Aligns with angle-generator model. Separate instruction vs. output channel. |
| D3 | Foundation tools first (brief → tov → personas) | Their output feeds all other tools. Upgrade cascades. |
| D4 | Synthetic gold-standard examples now; real examples after DDD-179 | Immediate calibration target. Replace later. |
| D5 | Dynamic chain awareness via `{{output_step_<stepKey>}}` | Maximizes quality: LLM reads prior content. Generalizes existing `assembleBlogArticlePrompt`. |

---

## Phase 1 — Bug Fix & Policy (1 session, zero risk)

### 1.1 Remove broken `prompt_root.md` references (D1)

Delete the line `"Apply all constraints and methodology from prompt_root.md."` from 7 files:

| # | File | Lines to remove |
|---|---|---|
| 1 | `brief-generator/prompt_extraction.md` | 7-8 |
| 2 | `brief-generator/prompt_brief_generation.md` | 7-8 |
| 3 | `tov-generator/prompt_extraction.md` | 7-8 |
| 4 | `tov-generator/prompt_tov_generation.md` | 7-8 |
| 5 | `personas-generator/prompt_extraction.md` | 7-8 |
| 6 | `personas-generator/prompt_personas_generation.md` | 7-8 |
| 7 | `youtube-description/prompt_youtube_description_generation.md` | 7-8 |

**Verification**: `npm --workspace apps/backend run test` — existing prompt resolution tests must pass unchanged.

### 1.2 Add anti-hallucination block to all generation prompts

Add this block to every **generation-step** prompt (not extraction prompts, which have their own rules). Funnel-pages already has equivalent rules — skip it.

```
## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.
```

**Tools to cover**: angle-generator, meta-ads, geometric, youtube-lf-script, blog-article, nextland, brief-generator, tov-generator, personas-generator, youtube-description.

**Estimated files**: ~20 (all generation-step prompts across 10 tools).

### 1.3 Verify/deprecate `{{context}}` placeholder

`extraction/prompt_generation.md:36` contains `{{context}}`. Verify whether it is populated at runtime:
- Search `request-contract.ts` and `generation-system.actions.ts` for `context` replacement logic
- If NOT populated: remove the `## Contesto` / `{{context}}` section from the template
- If populated: document the mechanism

**Verification**: manual code inspection + test run.

---

## Phase 2 — Foundation Tools (2-3 sessions, low risk)

Per D3, upgrade the 3 tools whose output (brief, brand-voice, persona) feeds all other tools. Each tool has 2 prompts (extraction + generation). Target: 150-200 lines each, following the funnel-pages benchmark pattern.

### 2.1 brief-generator — 2 prompts

**`prompt_extraction.md`** (today: 22 lines → target: 120+)

Add:
- Role definition: "Data extraction specialist for marketing briefs"
- Anti-hallucination guardrails (Phase 1 block)
- Good/bad extraction examples for each of the 5 JSON fields
- Checklist: all 5 fields present, no inventions, no empty fields, Italian output
- Keep: JSON output format with 5 required fields

**`prompt_brief_generation.md`** (today: 82 lines → target: 180+)

Add:
- Role: "Senior Creative Strategist specialized in brief writing"
- 2-3 examples of well-written sections vs. generic filler
- Guardrails: no inventions, missing section = "Non specificato nel documento di input"
- Explicit rules for "Infer and expand from context": what is safe to infer (tone from product type, audience from language register), what is not (specific metrics, competitor claims)
- Internal checklist: all 11 sections present, internal consistency, actionable for downstream tools

### 2.2 tov-generator — 2 prompts

**`prompt_extraction.md`** → target: 120+

Same structure as brief-generator extraction. 5 fields: brand_or_company, target_audience, tone, product_or_service, market.

**`prompt_tov_generation.md`** (today: 59 lines → target: 180+)

Add:
- Role: "Brand Strategist and Tone of Voice specialist"
- Examples for each output section (Identità, Valori, Voce, Linguaggio, Adattamento, Esempi)
- Good/bad examples for "Esempio Corretto" and "Esempio Sbagliato"
- Channel-specific adaptation guidance (social, email, landing, ads, long-form)
- Internal checklist

### 2.3 personas-generator — 2 prompts

**`prompt_extraction.md`** → target: 120+

5 fields: demographics, goals, pain_point, behaviors, objections.

**`prompt_personas_generation.md`** (today: 87 lines → target: 180+)

Add:
- Role: "Market Research Analyst and Buyer Persona specialist"
- 2 examples of well-structured personas
- Explicit rule: "NEVER present persona names as examples of real people"
- Persona asset usage rules (will also be added systemically in Phase 3.2, but include here for self-containment)
- Internal checklist
- Already good: output determinism rules (no preamble, no "Ecco il persona")

**Phase 2 verification**: generate output with all 3 tools on a test brief. Compare pre/post quality. All 3 tools must produce output that is immediately usable by downstream tools without manual editing.

---

## Phase 3 — Cross-Tool Mechanisms (3-4 sessions, medium risk)

### 3.1 Dynamic chain awareness (D5)

**Task A — Generalize `assemble*Prompt` in `generation-system.actions.ts`**

Create `assembleChainAwarePrompt` that:
1. Reads `context.requestInput.resolvedPromptTemplate`
2. Iterates `TOOL_STEP_ORDER[toolKey]` to identify steps preceding the current one
3. For each prior step, resolves content from `stepDependencyArtifactContentsByStep`
4. Replaces `{{output_step_<stepKey>}}` placeholders with actual content

Extends the existing `assembleBlogArticlePrompt` pattern (line 420-466).

**Task B — Add `{{output_step_<stepKey>}}` placeholders to 16 prompts**

For each multi-step tool, add `## Pipeline Context` block to every step > 1:

```
## Pipeline Context
You are step {N} of {TOTAL} in this workflow.
Previous step output:
{{output_step_<previousStepKey>}}

Your output will feed step {N+1}. Maintain structural alignment.
```

| Tool | Steps to modify | Count |
|---|---|---|
| youtube-lf-script | packaging, intro-structure, body-structure, native-cta-embeds, outro-structure | 5 |
| angle-generator | angle-prioritization, creative-activation | 2 |
| geometric | competitor-scoring, strategic-reporting, unified-report | 3 |
| funnel-pages | quiz, vsl | 2 |
| blog-article | blog_research, blog_article | 2 |
| meta-ads | ads-generation | 1 |
| nextland | thank_you | 1 |

**Total: 16 prompts modified + ~50 lines of new TypeScript.**

### 3.2 Persona asset usage rules

Add block to all generation-step prompts across 7 tools that consume `persona` assets:

```
## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names (e.g., "Marco", "Giulia") in any output text.
- Use persona data to inform: pain points, messaging tone, objections, triggers.
- Address output to an abstract "tu" belonging to the target profile.
```

**Tools**: funnel-pages (3), angle-generator (3), nextland (2), youtube-lf-script (6), blog-article (3), tov-generator (1), personas-generator (1).

**Estimated files**: ~20 (generation-step prompts only, skip extraction).

### 3.3 Synthetic gold-standard benchmark examples (D4)

Add 2-3 synthetic "gold standard" output examples to the final step of 5 tools:

| Tool | Final step | What to exemplify |
|---|---|---|
| nextland | landing | Good headline, subheadline, proof section |
| geometric | unified-report | Good executive summary, competitor table, recommendation |
| youtube-lf-script | outro-structure | Good recap, CTA finale, pain-solution closure |
| blog-article | blog_article | Good H1, opening paragraph, section flow |
| youtube-description | youtube-description-generation | Good CTA line, chapter block, hashtag selection |

Funnel-pages already has examples. Meta-ads and angle-generator have detailed output structures that serve as implicit benchmarks.

**Phase 3 verification**: end-to-end test on youtube-lf-script (6 steps). Step 6 output must be consistent with step 1 extraction. No contradictions, no repeated content, no drift.

---

## Phase 4 — Polish & Remaining Tools (3-4 sessions, low risk)

### 4.1 Upgrade remaining thin prompts (~15 prompts)

Bring every prompt under 100 lines to 100+ with: role, guardrails, examples, checklist.

| Tool | Prompts | Primary gap |
|---|---|---|
| nextland | landing (81), thank_you | No methodology, no examples |
| geometric | strategic-reporting (27) | No quality gates, no examples |
| youtube-lf-script | packaging (45), intro-structure, body-structure, native-cta-embeds | Very thin, no benchmarks |
| blog-article | blog_seo_structure (19), blog_research | Too generic, no quality targets |
| youtube-description | context_generation | Verify content and depth |

### 4.2 Feedback incorporation instructions

Add to all 8 `feedbackEnabled: true` steps:

```
## Feedback Incorporation
When user feedback is provided for regeneration:
- Preserve structural integrity. Do not rewrite from scratch.
- Adjust ONLY sections explicitly mentioned in the feedback.
- Do NOT change sections that were not criticized.
- If feedback contradicts input context, prioritize input context
  and note the conflict in a ## Regeneration Notes section.
```

**Steps**: vsl, creative-activation, ads-generation, thank_you, outro-structure, unified-report, blog_article, youtube-description-generation.

### 4.3 Document all `{{placeholder}}` variables

Add an HTML comment header to every prompt file documenting which placeholders it uses:

```markdown
<!-- PLACEHOLDERS:
  {{context}}        — briefing text from request input
  {{requiredFields}} — extraction field keys per tool matrix
  {{notes}}          — user-provided notes field
  {{copy_length_format}} — short-form | medium-form | long-form
-->
```

**All 34 templates.**

**Phase 4 verification**: final review of all 34 prompts. Every prompt must have: role, guardrails, examples or detailed structure, checklist (or equivalent). Compare against funnel-pages benchmark checklist.

---

## Summary

| Phase | Prompts touched | New code | Risk | Sessions | Status |
|---|---|---|---|---|---|
| 1. Bug fix + policy | 30 | 0 lines | None | 1 | ✅ Completed 2026-07-23 |
| 2. Foundation tools | 6 | 0 lines | Low | 2-3 | ✅ Completed 2026-07-23 |
| 3. Cross-tool mechanisms | ~55 | ~20 lines | Medium | 3-4 | ✅ Completed 2026-07-23 |
| 4. Polish + remaining | 34 | 0 lines | Low | 3-4 | ✅ Completed 2026-07-23 |
| **Total** | **34 (all)** | **~20 lines** | | | **100% complete** |

### Execution order

1. **Phase 1** — completed: removed broken `prompt_root.md` refs (7 files), removed orphan `{{context}}`, added anti-hallucination block (22 prompts). 0 risk, 439 tests pass.
2. **Phase 2 + Phase 3** — completed: upgraded 6 foundation prompts (role, examples, checklist), generalized `assembleChainAwarePrompt` (removed tool-specific guard, added `didReplace` gate), added `{{output_step_*}}` placeholders (16 prompts), persona asset rules (19 prompts), gold-standard examples (5 tools). 439 tests pass.
3. **Phase 4** — pending: upgrade remaining ~15 thin prompts, add feedback instructions (8 steps), document all `{{placeholder}}` variables.

### Key implementation notes (Phase 3)

- `assembleBlogArticlePrompt` renamed to `assembleChainAwarePrompt` in `generation-system.actions.ts` and `generation-system.execution.states.ts`
- Action now executes for all tools (no tool-specific guard), but only modifies the prompt when placeholders are actually present (`didReplace` gate)
- Custom user prompts (without `resolvedPromptTemplate`) are left untouched
- Added `{{copy_length_format}}` replacement support alongside existing `{{titolo}}` and `{{output_step_*}}`

### Key implementation notes (Phase 4)

- Added role definitions and strategic guardrails to 6 youtube-lf-script prompts
- Upgraded geometric strategic-reporting: role, guardrails, checklist
- Added internal checklist to nextland thank_you generator
- Added `## Feedback Incorporation` block to all 8 `feedbackEnabled: true` steps (vsl, creative-activation, ads-generation, thank_you, outro-structure, unified-report, blog_article, youtube-description-generation)
- Documented `{{placeholder}}` variables in all 34 template files via `<!-- PLACEHOLDERS: ... -->` header comments
- 439 tests pass, 0 fail