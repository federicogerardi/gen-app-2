# PROMPT ANGLE GENERATOR - ANGLE PRIORITIZATION

## Step Key

- angle-prioritization

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Evaluate the angle matrix and select the top 3 launch angles with deterministic scoring.

## Input

- Angle matrix produced by context-and-angle-matrix.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Scoring model (required)

Score each angle from 1 to 5 on:
- potential ROI
- differentiation
- ease of communication
- credibility and demonstrability

Total score = sum of the 4 dimensions.

Deterministic tie-break sequence (mandatory):
1. Higher awareness-fit coherence with canonical message function in prompt_root.md.
2. Stronger evidence traceability to extraction/context matrix.
3. Higher ease of communication score.
4. If still tied, pick the angle targeting the lower awareness level (broader market unlock) and state rationale.

## Output rules

- Markdown only.
- Italian only.
- Awareness level labels must remain in English.
- No JSON.
- No ties in final top 3 ranking; resolve ties with explicit rationale.

## Required output structure

## Scored Angles
- Angle: ...
   Awareness level: ...
   Awareness-fit rationale: ...
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
