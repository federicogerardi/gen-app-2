---
status: approved
version: 1.0
date_created: 2026-07-23
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Backend Runtime
type: development-guide
tags: [prompt-engineering, prompt-templates, development-standards, tool-generation]
---

# Prompt Template Standards

> **Canonical reference for creating and maintaining LLM prompt templates.**
> Applies to all `.md` files under `apps/backend/src/lib/runtime/tool-prompts/`.
> Enforced by the remediation plan: [prompt-layer-remediation-plan](../05-plans/prompt-layer-remediation-plan.md) (completed 2026-07-23).

---

## 1. Language Policy

| Channel | Language | Rule |
|---|---|---|
| System instructions (prompt text) | **English** | All guardrails, rules, role definitions, checklists |
| Artifact output | **Italian (`it-IT`)** | All user-facing generated content |
| Awareness labels | **English** | "Completely Unaware", "Problem Aware", etc. — invariant across languages |

**Rationale**: Separates "LLM instruction channel" from "user-facing output channel" for cleaner compliance and more predictable model behavior.

---

## 2. Mandatory Prompt Structure

Every prompt must include these sections in order:

```markdown
<!-- PLACEHOLDERS: var1, var2 -->

# PROMPT <TOOL> - <STEP>

## Step Key
- <step-key>

## Role
<1-2 sentences defining the LLM's persona and responsibilities>

## Objective
<What this step produces, with concrete quality targets>

## Input
<What context is available: extraction payload, previous step outputs, user inputs>

## Anti-Hallucination Guardrails
<Standard block — see Section 3>

[## Pipeline Context]          ← multi-step tools only (Section 5)
[## Persona Asset Usage]        ← tools consuming persona assets (Section 6)

## Output rules
<Format constraints: markdown, language, no JSON, no code fences>

## Required output structure
<Exact sections/fields the output must contain, with format guidance>

## Good vs. Bad Examples
<At least 2 pairs of WRONG/CORRECT examples with explanations>

## Internal Checklist
<Step-specific verification items — minimum 5>

[## Feedback Incorporation]     ← feedbackEnabled steps only (Section 7)
```

### Minimum line count targets

| Prompt type | Target lines | Rationale |
|---|---|---|
| Extraction | 70+ | JSON output limits verbosity; role + examples + checklist still required |
| Generation (single-step) | 150+ | Full methodology needed |
| Generation (multi-step, step > 1) | 120+ | Pipeline context + guardrails + checklist |

---

## 3. Anti-Hallucination Guardrails (Standard Block)

Add to **every** generation-step prompt. Extraction prompts use a variant (Section 8).

```
## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.
```

---

## 4. Output Rules (Standard Block)

Add to every prompt. Adjust language-specific rules per tool.

```
## Output rules
- Markdown only.
- Italian only (`it-IT`).
- No JSON. No invented claims.
- No code fences. Output raw markdown — never wrap content in ``` blocks.
- Every section must be present.
```

**Additional rule for final-step prompts with strict output determinism:**

```
- No preamble, greetings, introductions, or phrases like "Ecco il report", "Di seguito".
- No closing remarks, sign-offs, or meta-commentary after the last section.
- Any text outside the mandatory output structure is a violation.
```

---

## 5. Chain Awareness (Multi-Step Tools)

For every step > 1 in a multi-step tool, insert the Pipeline Context block between Anti-Hallucination Guardrails and Output Rules:

```
## Pipeline Context
You are step {N} of {TOTAL} in the <tool-key> workflow.
Previous step output:
{{output_step_<previousStepKey>}}

Your output will feed step {N+1}. Maintain structural alignment.
```

### Runtime resolution

The `assembleChainAwarePrompt` action in `generation-system.actions.ts` resolves `{{output_step_<stepKey>}}` placeholders with actual prior-step content from `stepDependencyArtifactContentsByStep`.

### Registration checklist
- [ ] `{{output_step_<stepKey>}}` placeholder added to prompt template
- [ ] `assembleChainAwarePrompt` is already generic — no code change needed for new tools
- [ ] `stepDependencyArtifactContentsByStep` is populated by `buildRequestReceivedEvent` in `request-contract.ts`

---

## 6. Persona Asset Usage (Standard Block)

Add to every generation-step prompt for tools that consume `persona` assets:

```
## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names (e.g., "Marco", "Giulia") in any output text.
- Use persona data to inform: pain points, messaging tone, objections, triggers.
- Address output to an abstract "tu" belonging to the target profile.
```

**Tools requiring this block**: funnel-pages, angle-generator, nextland, youtube-lf-script, blog-article-generator, tov-generator, personas-generator, meta-ads.

---

## 7. Feedback Incorporation (Standard Block)

Add to every step marked `feedbackEnabled: true` in `TOOL_WORKFLOW_DEFINITIONS`:

```
## Feedback Incorporation
When user feedback is provided for regeneration:
- Preserve structural integrity. Do not rewrite from scratch.
- Adjust ONLY sections explicitly mentioned in the feedback.
- Do NOT change sections that were not criticized.
- If feedback contradicts input context, prioritize input context
  and note the conflict in a ## Regeneration Notes section.
```

**Steps requiring this block**: vsl, creative-activation, ads-generation, thank_you, outro-structure, unified-report, blog_article, youtube-description-generation.

---

## 8. Extraction Prompts (Special Rules)

Extraction prompts produce **JSON output** with fixed field sets. They differ from generation prompts in structure:

### Mandatory sections
- `## Role` — Data Extraction Specialist
- `## Task` — what to extract
- `## Extraction Fields` — table with field name, description, and extraction instructions
- `## Anti-Hallucination Guardrails` — extraction-specific variant
- `## Good vs. Bad Extraction Examples` — 2-3 pairs with explanations
- `## Internal Checklist` — minimum 5 items
- `## Output format` — valid JSON, no markdown, no code fences, "non disponibile" for missing

### Extraction anti-hallucination variant

```
## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, or entities not present in the source document.
- If information is not available in the source, write exactly: "non disponibile".
- NEVER attribute qualities, values, or characteristics that are not stated.
- When in doubt, omit. Precision from source > plausible inference.
```

### Output format for extraction

```
Valid JSON object with all {N} fields. Use "non disponibile" for missing data.
No markdown formatting. No code fences. Pure JSON.
```

---

## 9. Placeholder Documentation

Every prompt file must declare its placeholders in an HTML comment on line 1:

```markdown
<!-- PLACEHOLDERS: variable_name, another_variable -->
```

### Canonical placeholder catalog

| Placeholder | Used by | Populated by |
|---|---|---|
| `{{output_step_<key>}}` | Multi-step tools | `assembleChainAwarePrompt` in `generation-system.actions.ts` |
| `{{titolo}}` | Blog article generator | `assembleChainAwarePrompt` |
| `{{copy_length_format}}` | Meta ads generator | `assembleChainAwarePrompt` |
| `{{requiredFields}}` | Extraction (generic) | `request-contract.ts` → extraction field matrix |
| `{{notes}}` | Extraction (generic) | User-provided notes field |
| `{{serpSnippets}}` | Geometric | `assembleGeometricPrompt` in `generation-system.actions.ts` |
| `{{paaQueries}}` | Geometric | `assembleGeometricPrompt` |
| `{{competitorRanking}}` | Geometric | `assembleGeometricPrompt` |
| `{{currentDate}}` | Geometric | `assembleGeometricPrompt` |
| `{{brandName}}` | Geometric | `assembleGeometricPrompt` |
| `{{baseQuery}}` | Geometric | `assembleGeometricPrompt` |
| `{{queryCount}}` | Geometric | `assembleGeometricPrompt` |

---

## 10. Prompt Registry

New prompts must be registered in `apps/backend/src/lib/runtime/tool-prompts/index.ts`:

```typescript
const PROMPT_FILE_BY_KEY = {
  // ...
  '<tool-key>:<step-key>': 'src/lib/runtime/tool-prompts/<tool-key>/prompt_<step_key>.md',
} as const;
```

For extraction prompts with tool-specific overrides:
```typescript
'<tool-key>:extraction': 'src/lib/runtime/tool-prompts/<tool-key>/prompt_extraction.md',
```

---

## 11. Quality Gate Checklist

Before considering a prompt complete, verify:

### Structure
- [ ] Role defined (1-2 sentences)
- [ ] Objective with concrete quality targets
- [ ] Input section lists all available context
- [ ] Anti-Hallucination Guardrails block present
- [ ] Output rules specify format, language, code fence prohibition
- [ ] Required output structure with all sections/fields
- [ ] At least 2 good vs. bad examples with explanations
- [ ] Internal checklist (minimum 5 items)
- [ ] `<!-- PLACEHOLDERS -->` comment on line 1

### Multi-step tools (additional)
- [ ] Pipeline Context block on every step > 1
- [ ] `{{output_step_<key>}}` placeholders matching actual step keys
- [ ] Step numbering correct (N of TOTAL)

### Persona-consuming tools (additional)
- [ ] Persona Asset Usage block present

### Feedback-enabled steps (additional)
- [ ] Feedback Incorporation block present

### Extraction prompts (additional)
- [ ] Extraction field table with per-field instructions
- [ ] Output format specifies JSON, "non disponibile" fallback, no code fences

### Content quality
- [ ] Examples are specific and contrastive (not trivial differences)
- [ ] Checklist items are verifiable (not "output is good")
- [ ] Guardrails are concrete (not "be careful")
- [ ] Language: system instructions in English, output in Italian
- [ ] No broken references to non-existent files (e.g., `prompt_root.md`)

---

## 12. New Tool Onboarding Checklist

When creating a new tool with prompts:

1. [ ] Define tool in `packages/contracts/src/tool-workflows.ts` (`TOOL_WORKFLOW_DEFINITIONS`)
2. [ ] Create prompt directory: `apps/backend/src/lib/runtime/tool-prompts/<tool-key>/`
3. [ ] Create extraction prompt (if tool has one)
4. [ ] Create generation prompt(s) — one per step
5. [ ] Register all prompts in `tool-prompts/index.ts` (`PROMPT_FILE_BY_KEY`)
6. [ ] Test entry: add to `runtime.tool-prompts.test.ts`
7. [ ] Verify: `npm --workspace apps/backend run test`
