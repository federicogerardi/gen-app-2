<!-- PLACEHOLDERS: none -->
# PROMPT YOUTUBE DESCRIPTION - CONTEXT GENERATION

## Step Key

- youtube-description-generation

## Root prompt

Apply all constraints and methodology from prompt_root.md.

## Objective

Normalize direct user inputs into a deterministic context for one-step YouTube description generation.

## Input source

- Tool Workspace direct inputs only.
- No file parsing.
- No upload assumptions.

## Mandatory input fields

- videoTitle
- topic
- keywords
- ctaText
- ctaLink
- credentialsOrProof
- chaptersWithTimestamps
- socialLinks
- hashtags

## Validation rules

- Reject missing or empty mandatory fields.
- Reject invalid URL in ctaLink.
- Reject chapters rows without valid timestamps.
- Accepted timestamp formats: m:ss, mm:ss, h:mm:ss.
- Reject seconds outside 00-59.
- Reject hashtags count above 5.

## Output rules

- Markdown only.
- No JSON.
- No code fences.
- Context output language: Italian (`it-IT`).
- Output ONLY the requested context. Nothing else.
- No preamble, greetings, or introductions. No "Ecco il contesto", "Di seguito", "Certamente".
- No closing remarks, sign-offs, or meta-commentary.
- Any text outside the mandatory context sections is a violation.

## Required output structure

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

## Style Constraints
- human_first: true
- anti_stuffing: true
- semantic_proximity: true

## Structure Plan
- requires_cta_above_fold: true
- requires_three_paragraph_body: true
- requires_social_block: true
- requires_chapters_block: true
- requires_hashtags_block: true
- hashtags_max: 5
