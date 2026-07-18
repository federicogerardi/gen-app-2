# PROMPT TOV GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the uploaded document and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- brand_or_company: Company or brand name
- target_audience: Primary audience the brand communicates with
- tone: Explicit tone references found in the document
- product_or_service: What the brand offers (informs the voice)
- market: Market positioning or industry context

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
