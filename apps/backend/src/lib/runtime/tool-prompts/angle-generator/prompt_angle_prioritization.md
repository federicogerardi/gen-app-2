# PROMPT ANGLE GENERATOR - ANGLE PRIORITIZATION

## Step Key

- angle-prioritization

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Evaluate the angle matrix and select the top 3 launch angles with deterministic scoring.

## Input

- Angle matrix produced by context-and-angle-matrix.

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
