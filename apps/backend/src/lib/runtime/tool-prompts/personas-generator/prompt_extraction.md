# PROMPT PERSONAS GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the uploaded document and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- demographics: Age, gender, income, education, location, and socio-economic context
- goals: What the persona wants to achieve, desired outcomes, aspirations
- pain_point: Pain points, frustrations, unmet needs, and daily struggles
- behaviors: Buying habits, media consumption, decision patterns, preferred channels
- objections: Common objections and barriers that prevent purchase or conversion

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
