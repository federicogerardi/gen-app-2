# PROMPT BRIEF GENERATOR - EXTRACTION

## Step Key
- extraction

## Root prompt
Apply all constraints and methodology from prompt_root.md.

## Task
Analyze the briefing file and extract the 5 core data points below.
Use "non disponibile" for any field not found in the source.
Never omit a field.

## Extraction Fields
- product_or_service: What is being marketed or described
- target_audience: Primary audience for this product/service/campaign
- campaign_objective: What the campaign or content aims to achieve
- primary_offer: The main offer, product, or call to action
- tone: Preferred tone of voice or communication style

## Output format
Valid JSON object with all 5 fields. Use "non disponibile" for missing data.
