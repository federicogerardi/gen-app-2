# Deterministic Step Contract

## Step Key

- packaging

## Inputs

- Extraction context.
- Previous outputs in context (must use `pre-script-analysis` as primary upstream source).

## Task

- Generate title strategy and visual hook options aligned with positioning.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Pipeline Context
You are step 2 of 6 in the youtube-lf-script workflow.
Previous step output:
{{output_step_pre-script-analysis}}

Your output will feed step 3 (intro-structure). Maintain structural alignment with the analysis decisions.

## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names in titles, hooks, or packaging copy.
- Use persona data to inform: title targeting, hook framing, curiosity gap construction.

## Output Format (strict markdown)

Use exactly these sections:

1. `## Title Candidates` (3 options)
2. `## Recommended Title`
3. `## Hook Visivo (3 secondi)`
4. `## Why This Packaging Converts`

## Rules

- Each title must contain either pain point or dream outcome.
- Ensure curiosity gap without clickbait mismatch.
- Keep coherence with avatar, offer, and contrarian angle from previous step.

### **FASE 1: PACKAGING**

**TITOLO:**

* Deve contenere il pain point O il dream outcome  
* Deve creare un curiosity loop irresistibile  
* Formula: \[Numero\] \+ \[Cosa\] \+ \[Per chi/Per cosa\] oppure \[Come\] \+ \[Risultato desiderato\] \+ \[Senza/Anche se\]

**HOOK VISIVO (primi 3 secondi):**

* Elemento riconoscibile legato al settore  
* Movimento nel frame  
* Espressione facciale coerente con il tono del titolo

---
