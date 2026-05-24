# Deterministic Step Contract

## Step Key

- extraction

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Build one extraction output from merged dual-source context for angle-generator.
Sources are:
- BriefingFile
- AngleDetectorFile

Produce an explicit awareness evidence map using only the 5 canonical levels defined in prompt_root.md.

The extraction job is single-run. Do not split into multiple extraction jobs.

## Required input

- Merged textual context assembled from the two sources.

## Mandatory output rules

- Return markdown only, in Italian.
- Keep awareness level labels in English only.
- Do not use code fences.
- Do not output JSON.
- Keep sections in the exact order below.
- If a field is not inferable, write exactly this Italian string: "Non emerso dalle fonti fornite".

## Required output structure

## Persona
- ...

## Desire
- ...

## Awareness
- ...

## Awareness Evidence by Level (canonical order)
- Completely Unaware
  Nature check: the audience does not connect the discomfort to a structural problem and may blame external conditions or unrelated causes
  Message function: reveal hidden problem through contextual storytelling
  Evidence from sources: ...
- Problem Aware
  Nature check: the audience knows the problem exists and feels the cost or discomfort, but does not know there is a specific solution path
  Message function: clarify problem and introduce concrete solution direction
  Evidence from sources: ...
- Solution Aware
  Nature check: the audience is outcome-first and can describe the desired result, but still does not know which solution family is correct; it may mention one or more possible solution categories, but has not locked onto one answer
  Message function: frame the desired result and guide toward the right solution category
  Evidence from sources: ...
- Product Aware
  Nature check: the audience recognizes the product, the brand, or a named comparable competitor, and is still resolving trust or objection gaps
  Message function: resolve objections and prove product-specific credibility
  Evidence from sources: ...
- Most Aware
  Nature check: the audience has already consumed brand-specific content and is pausing on secondary barriers, while direct sales intent is already present
  Message function: activate immediate action with urgency/scarcity/incentive
  Evidence from sources: ...

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

## Awareness Assignment (one level only per top angle)
- Angle: ...
  Assigned awareness level: ...
  Why this level (evidence-based): ...
  Disambiguation note: if the angle only describes the desired result without a chosen solution family, keep it at `Solution Aware`; if it already names the product or a competitor, use `Product Aware`; if it already assumes the brand content has been consumed and the only blockers are secondary, use `Most Aware`.

## Missing / Unclear
- ...

## Guardrails compliance check
- No invented claims: yes/no
- No discriminatory assumptions: yes/no
- Evidence-grounded output: yes/no
