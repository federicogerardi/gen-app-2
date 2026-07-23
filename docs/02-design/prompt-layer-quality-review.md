---
status: completed
version: 1.1
date_created: 2026-07-23
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Backend Runtime
type: design-review
tags: [prompt-engineering, tool-generation, quality-review, prompt-templates]
---

# Prompt Layer Quality Review

> **Scope**: 34 prompt templates across 12 tools. Architecture and infrastructure are out of scope — effectiveness of prompt templates only.

## Executive Summary

The prompt layer has **34 templates** across 12 tools. Quality is **strongly uneven**: the 3 funnel-pages prompts (optin, quiz, vsl) are excellent and represent the benchmark; most others are **skeletal, without methodology, without examples, and without anti-hallucination guardrails**. The primary gap is not architectural (the prompt resolution and injection pipeline works well) but in **template content**: depth, examples, anti-patterns, and cross-tool consistency.

## Decisions (2026-07-23 session)

| # | Topic | Decision | Rationale |
|---|---|---|---|
| D1 | Broken `prompt_root.md` references (2.1) | **Remove** the "Apply all constraints from prompt_root.md" line from all 6 tools that lack the file. | The reference is a silent no-op today — removing it costs nothing. Each tool has too different a methodology to share a root prompt. A shared root can be reintroduced later as a quality upgrade, not a bug fix. |
| D2 | Prompt language (2.7) | **System instructions always in English, artifact output always in Italian.** | Aligns with the angle-generator model (best-in-class). Separates "LLM instruction channel" from "user-facing output channel" for cleaner compliance. |
| D3 | Remediation order (3) | **Foundation tools first**: brief-generator, tov-generator, personas-generator. Then meta-ads, angle-generator, youtube-lf-script. Then nextland, geometric, blog-article. | Foundation tools produce assets (brief, brand-voice, persona) consumed by all other tools. Upgrading them first cascades quality improvements to the entire tool network. |
| D4 | Benchmark examples (2.3) | **Synthetic gold-standard examples now.** Real user-approved examples later, once artifact scoring (DDD-179) is operational. | Ensures calibration target exists immediately. Gold-standard examples will be replaced by real data when available. |
| D5 | Chain awareness (2.5) | **Dynamic injection** of previous step outputs into subsequent step prompts, via `{{output_step_<stepKey>}}` placeholders resolved at runtime. | Maximizes final output quality: the LLM reads actual prior-step content, not just step names. Uses the existing `assembleBlogArticlePrompt` pattern generalized to all multi-step tools. Effort: medium (extend existing mechanism). Result: high (eliminates cross-step contradictions). |

---

## 1. Per-Tool Quality Assessment

| Tool | Strongest Prompt | Weakest Prompt | Rating |
|---|---|---|---|
| **funnel-pages** | VSL (425 lines, 10 elements, examples, anti-patterns, checklist) | — | ⭐⭐⭐⭐⭐ Excellent |
| **angle-generator** | prompt_root (107 lines, awareness theory, rules) | creative-activation (to verify) | ⭐⭐⭐⭐ Good, but root is isolated |
| **meta-ads** | ads-generation (172 lines, cluster→angle→awareness, copy length) | extraction (80 lines, no examples) | ⭐⭐⭐ Decent |
| **geometric** | unified-report (152 lines, CSV structure, output determinism) | strategic-reporting (**27 lines**, no quality gates) | ⭐⭐ Weak on reporting |
| **youtube-lf-script** | extraction (80 lines, 9 sections) | packaging (45 lines), intro/body | ⭐⭐ Disconnected steps |
| **blog-article** | blog_article (51 lines, good SEO constraints) | blog_seo_structure (19 lines, too generic) | ⭐⭐ Decent but thin |
| **nextland** | landing (81 lines, basic structure) | thank_you (similar) | ⭐ Thin, no methodology |
| **brief-generator** | brief_generation (82 lines) | extraction (22 lines, 5-field JSON) | ⭐ Thin, "infer and expand" vague |
| **tov-generator** | tov_generation (59 lines) | extraction | ⭐ Thin |
| **personas-generator** | personas_generation (87 lines, good output structure) | extraction | ⭐⭐ Decent |
| **youtube-description** | generation (66 lines, quality gates) | context_generation | ⭐⭐ Decent |

---

## 2. Issues Found

### 2.1 🔴 CRITICAL: `prompt_root.md` is a broken reference for 6 tools

```
brief-generator:      "Apply all constraints and methodology from prompt_root.md."
tov-generator:        "Apply all constraints and methodology from prompt_root.md."
personas-generator:   "Apply all constraints and methodology from prompt_root.md."
youtube-description:  "Apply all constraints and methodology from prompt_root.md."
```

**None of these tools have a `prompt_root.md` file.** Only `angle-generator/` has one. The LLM receives an instruction pointing to non-existent context → it silently ignores it. This is a **functional prompt bug**, not architectural.

**Decision D1**: **Remove** the reference line entirely. The reference is a silent no-op today; removing it restores correctness. Each tool has too different a methodology to share a single root prompt. A shared root can be reintroduced later as a quality upgrade, not a bug fix.

**Affected files** (6 prompts):
- `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_extraction.md`
- `apps/backend/src/lib/runtime/tool-prompts/brief-generator/prompt_brief_generation.md`
- `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_extraction.md`
- `apps/backend/src/lib/runtime/tool-prompts/tov-generator/prompt_tov_generation.md`
- `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_extraction.md`
- `apps/backend/src/lib/runtime/tool-prompts/personas-generator/prompt_personas_generation.md`
- `apps/backend/src/lib/runtime/tool-prompts/youtube-description/prompt_youtube_description_generation.md`

### 2.2 🔴 CRITICAL: Depth disparity (10x between funnel-pages and nextland/brief/tov)

| Tool | Prompt lines | Good/bad examples | Checklist | Anti-patterns | Role defined |
|---|---|---|---|---|---|
| funnel-pages (VSL) | 425 | ✅✅✅ | ✅ 17 items | ✅ 6+ | ✅ |
| funnel-pages (optin) | 324 | ✅✅✅ | ✅ 14 items | ✅ 5 | ✅ |
| nextland (landing) | 81 | ❌ | ❌ | ❌ | ✅ |
| brief-generator | 82 | ❌ | ❌ | ❌ | ❌ |
| tov-generator | 59 | ❌ | ❌ | ❌ | ❌ |
| geometric (strategic) | 27 | ❌ | ❌ | ❌ | ❌ |
| youtube-lf-script (packaging) | 45 | ❌ | ❌ | ❌ | ❌ |

"Thin" prompts delegate all quality control to the LLM model, without guidance. Result: inconsistent, generic output.

### 2.3 🟡 HIGH: Missing output benchmark examples

Only funnel-pages provides concrete "gold standard" output examples (headlines, bullets, credibility blocks). No other tool has benchmarks. Without examples, the LLM has no quality target to aim for.

**Example**: the nextland prompt says "Frasi leggibili e dense di informazione" — but what does that mean? A good headline vs. a generic one example is needed.

### 2.4 🟡 HIGH: No anti-hallucination guardrails (except funnel-pages)

Funnel-pages has explicit rules:
- "Non inventare mai citazioni"
- "Usa solo frasi e numeri presenti nelle fonti disponibili"
- "Se non c'è citazione diretta, usa narrativa fattuale basata su dati verificabili"

Most other prompts have **no anti-hallucination instructions**. Result: LLM can invent testimonials, numbers, case studies.

### 2.5 🟡 HIGH: Disconnected multi-step chains (youtube-lf-script, angle-generator)

Each step has an isolated prompt. The LLM does not know:
- Its role in the overall pipeline
- What was already produced in previous steps (and at what quality)
- What is expected from it for downstream steps

**Decision D5**: Use **dynamic injection** of previous step outputs via `{{output_step_<stepKey>}}` placeholders resolved at runtime. The pattern already exists in `assembleBlogArticlePrompt` (`generation-system.actions.ts:420-466`) and will be generalized to all multi-step tools (youtube-lf-script, angle-generator, geometric, funnel-pages, blog-article).

Effort: medium (extend existing `assemble*Prompt` pattern). Result: high (LLM reads actual prior-step content, eliminating cross-step contradictions).

### 2.6 🟡 MEDIUM: Persona asset usage rules missing in 7 tools

Only meta-ads has explicit rules on how to treat persona assets ("NEVER use persona names in output"). But funnel-pages, angle-generator, nextland, youtube-lf-script, blog-article, tov-generator, personas-generator **all consume persona assets** and lack these rules. Risk: LLM writes "Marco, 34 anni, marketing manager..." in landing page copy.

### 2.7 🟡 MEDIUM: Inconsistent language mixing

| Prompt | System language | Output language |
|---|---|---|
| angle-generator root | English | Italian |
| blog-article | English | Italian |
| blog-SEO-structure | English | Italian |
| funnel-pages | Italian | Italian |
| youtube-lf-script | Italian | Italian |
| geometric | English/Italian mixed | Italian |

**Decision D2**: **System instructions always in English, artifact output always in Italian.** This aligns with the angle-generator model (best-in-class). All existing Italian-language prompts (funnel-pages, youtube-lf-script) will be migrated to English system instructions over time — not blocking, but the standard for all new/reviewed prompts.

### 2.8 🟢 LOW: Variable `{{context}}` undocumented

`extraction/prompt_generation.md` uses `{{context}}` but it is unclear how it is populated. Not present in `request-contract.ts` or template-filling actions. Likely a legacy placeholder. If unresolved, the LLM receives the literal text `{{context}}`.

### 2.9 🟢 LOW: Feedback-enabled steps lack feedback instructions

Steps marked `feedbackEnabled: true` (vsl, creative-activation, ads-generation, etc.) have no instructions on how to incorporate user feedback during regeneration.

---

## 3. Recommendations — Prioritized by Decision

### Priority 1 — Bug fixes + Policy (immediate, zero-risk)

| # | Action | Tools affected | Decision |
|---|---|---|---|
| R1.1 | Remove broken `prompt_root.md` references | 6 tools, 7 prompt files | D1 |
| R1.2 | Migrate all Italian-language system instructions to English (new prompts only; existing funnel-pages/YTLF migration is non-blocking) | 0 files — policy applied going forward | D2 |
| R1.3 | Add anti-hallucination guardrails to all tools: standard English block `## Anti-Hallucination Guardrails` with 3 rules (no invented data, no unattributed quotes, explicit "Not available in context" fallback) | 11 tools (funnel-pages already has them) | — |

**R1.3 — Standard anti-hallucination block to inject into every prompt:**

```
## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.
```

### Priority 2 — Foundation tools (first sprint)

Per D3, foundation tools (brief, tov, personas) are upgraded first because their output feeds all other tools.

| # | Action | Target depth | Key elements to add |
|---|---|---|---|
| R2.1 | Upgrade `brief-generator` prompts (extraction + brief_generation) | 150-200 lines each | Role, guardrails, good/bad examples, checklist, output structure with anti-patterns |
| R2.2 | Upgrade `tov-generator` prompts (extraction + tov_generation) | 150-200 lines each | Role, guardrails, channel-specific examples, checklist |
| R2.3 | Upgrade `personas-generator` prompts (extraction + personas_generation) | 150-200 lines each | Role, guardrails, persona archetype examples, persona asset usage rules (R3.2) |

### Priority 3 — Cross-tool mechanisms (second sprint)

| # | Action | Tools affected | Decision |
|---|---|---|---|
| R3.1 | Add `{{output_step_<stepKey>}}` placeholders to all multi-step prompts + generalize `assemble*Prompt` in `generation-system.actions.ts` | youtube-lf-script (5 steps), angle-generator (2 steps), geometric (2 steps), funnel-pages (2 steps), blog-article (2 steps) | D5 |
| R3.2 | Add persona asset usage rules to all tools consuming `persona` assets | funnel-pages, angle-generator, nextland, youtube-lf-script, blog-article, tov-generator, personas-generator | — |
| R3.3 | Add synthetic gold-standard benchmark examples to all tools not yet reviewed | nextland, geometric, youtube-lf-script, blog-article, youtube-description | D4 |

**R3.1 — Dynamic chain awareness block per step:**
```
## Pipeline Context
You are step {N} of {TOTAL} in this workflow.
Previous step output:
{{output_step_<previousStepKey>}}

Your output will feed step {N+1}. Maintain structural alignment.
```

**R3.2 — Standard persona asset usage block:**
```
## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names (e.g., "Marco", "Giulia") in any output text.
- Use persona data to inform: pain points, messaging tone, objections, triggers.
- Address output to an abstract "tu" belonging to the target profile.
```

### Priority 4 — Remaining tools + polish (third sprint)

| # | Action | Tools affected |
|---|---|---|
| R4.1 | Upgrade remaining tool prompts to benchmark level (nextland, geometric strategic-reporting, youtube-lf-script thin steps, blog-article SEO/research, youtube-description) | ~15 prompts |
| R4.2 | Add feedback incorporation instructions to `feedbackEnabled: true` steps | vsl, creative-activation, ads-generation, thank_you, outro-structure, unified-report, blog_article, youtube-description-generation |
| R4.3 | Document all `{{placeholder}}` variables — each template declares expected variables and population mechanism | All 34 templates |

---

## 4. Prompt Benchmark: What Makes funnel-pages VSL Excellent

For reference, here are the elements that make the VSL prompt the best in the system — these should be replicated:

| Element | VSL | Average other tools |
|---|---|---|
| Role definition | ✅ "copywriter senior specializzato in VSL" | ❌ Missing |
| Objective with metrics | ✅ "17-20 minuti, 2.800-3.200 parole" | ❌ "Generate a landing page" |
| Strategic guardrails | ✅ 5 non-negotiable rules | ❌ None |
| Good/bad examples | ✅ 6+ WRONG/CORRECT pairs | ❌ Zero |
| Internal checklist | ✅ 17 items to verify | ❌ None |
| Documented anti-patterns | ✅ "NEVER WRITE: Ciao, sono..." | ❌ None |
| Context adaptation | ✅ 4 price tiers | ❌ None |
| Output instructions | ✅ "Zero meta-phrases, zero JSON, camera-ready" | ❌ "Markdown only" |

---

## 5. Quantitative Summary

| Metric | Value |
|---|---|
| Total prompt templates | 34 |
| Prompts ≥200 lines (excellent) | 3 (optin, quiz, vsl) |
| Prompts 100-200 lines (good) | 4 (ads-generation, unified-report, angle_root, angle_context_matrix) |
| Prompts 50-100 lines (acceptable) | 12 |
| Prompts <50 lines (insufficient) | 15 |
| Tools with prompt_root.md | 1/7 that reference it |
| Tools with good/bad examples | 3/12 |
| Tools with internal checklist | 3/12 |
| Tools with anti-hallucination guardrails | 3/12 |
| Tools with persona asset rules | 1/7 |

**Conclusion**: 44% of prompts (15/34) are under 50 lines and lack fundamental quality elements. The benchmark exists (funnel-pages). The priority is bringing the rest of the catalog to that level.
