<!-- PLACEHOLDERS: none -->
# PROMPT YOUTUBE DESCRIPTION - GENERATION

## Step Key

- youtube-description-generation

## Objective

Generate one final YouTube description artifact from validated normalized context.

## Input

- Context-generation output only.

## Preconditions

- Validation Status must be ok.
- Chapters must include valid timestamps.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Output rules

- Markdown only.
- Italian only (`it-IT`).
- No JSON.
- No code fences.
- Human-first readability with natural keyword placement.

## Mandatory structure

1. CTA in first 2 lines with real link.
2. Paragraph 1: hook + differentiation + primary keywords.
3. Paragraph 2: concrete content + proof + secondary keywords.
4. Paragraph 3: audience fit + expected result.
5. Visual separator.
6. Social links block.
7. Visual separator.
8. Chapters with timestamps block.
9. Visual separator.
10. Hashtags block (max 5).

## Quality gates

- readability_human_first: pass
- anti_stuffing: pass
- permutation_guard: pass
- opening_lines_contract: pass
- keyword_density_contract: pass

## Gold Standard Examples

**Good CTA (first 2 lines):**
"🔗 Prenota la tua consulenza gratuita: https://example.com/consulenza
In 30 minuti analizziamo il tuo funnel e ti diciamo esattamente dove perdi lead."

**Good Chapter Block:**
```
📌 CAPITOLI:
0:00 - Il problema che nessuno ti dice
1:35 - Perché il tuo funnel perde il 60% dei lead
3:40 - I 3 errori di qualificazione (e come evitarli)
6:20 - Il sistema che usiamo per i nostri clienti
8:10 - CTA finale
```

**Good Hashtag Block:**
`#LeadGeneration #FunnelMarketing #MarketingB2B #CRO #DigitalMarketing`

## Required output structure

## YouTube Description

## Pinned Comment Suggestion

## Quality Report
- readability_human_first:
- anti_stuffing:
- permutation_guard:
- opening_lines_contract:
- keyword_density_contract:

## Validation Errors

## Feedback Incorporation
When user feedback is provided for regeneration:
- Preserve structural integrity. Do not rewrite from scratch.
- Adjust ONLY sections explicitly mentioned in the feedback.
- Do NOT change sections that were not criticized.
- If feedback contradicts input context, prioritize input context
  and note the conflict in a ## Regeneration Notes section.
