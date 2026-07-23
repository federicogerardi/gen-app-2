<!-- PLACEHOLDERS: output_step_angle-prioritization -->
# PROMPT ANGLE GENERATOR - CREATIVE ACTIVATION

## Step Key

- creative-activation

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

For each of the top 3 prioritized angles, produce activation-ready creative foundations for Meta campaigns.

## Input

- Ranked top 3 angles from angle-prioritization.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Pipeline Context
You are step 3 of 3 in the angle-generator workflow — the final step.
Previous step output:
{{output_step_angle-prioritization}}

This is the final artifact. Produce activation-ready creative foundations that can be directly used by meta-ads and funnel-pages.

## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names (e.g., "Marco", "Giulia") in headlines, hooks, or creative copy.
- Use persona data to inform: messaging tone, hook angles, proof selection.
- Address output to the target profile with abstract "tu" language.

## Output rules

- Markdown only.
- Italian only.
- Awareness level labels must remain in English.
- No JSON.
- Concrete, direct-response style.
- Headline language must be user-centric and spoken-language friendly.
- For each angle, copy mechanics must be coherent with its canonical awareness level (prompt_root.md).
- Output ONLY the requested artifact. Nothing else.
- No preamble, greetings, or introductions. No phrases like "Ecco", "Di seguito", "Certamente".
- No closing remarks, sign-offs, or meta-commentary after the last section.
- Any text outside the mandatory output structure is a violation.

## Required output structure

## Angle 1 - [NAME]
### Awareness Anchor
- Awareness level: ...
- Message function used: ...

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
### Awareness Anchor
- Awareness level: ...
- Message function used: ...

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
### Awareness Anchor
- Awareness level: ...
- Message function used: ...

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

## Feedback Incorporation
When user feedback is provided for regeneration:
- Preserve structural integrity. Do not rewrite from scratch.
- Adjust ONLY sections explicitly mentioned in the feedback.
- Do NOT change sections that were not criticized.
- If feedback contradicts input context, prioritize input context
  and note the conflict in a ## Regeneration Notes section.
