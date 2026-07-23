# Deterministic Step Contract

## Step Key

- pre-script-analysis

## Inputs

- Extraction context (all canonical fields).
- Previous outputs in context: none mandatory for this first generation step.

## Task

- Produce strategic pre-script analysis for positioning and conversion.

## Anti-Hallucination Guardrails
- NEVER invent data, metrics, results, testimonials, or case studies.
- If information is not available in the provided context, write exactly:
  "Not available in the provided context."
- NEVER attribute quotes, phrases, or names to people not cited in sources.
- When in doubt, omit. Specificity from context > plausible fabrication.

## Persona Asset Usage
- Personas are abstract reference profiles, NOT real people.
- NEVER use persona names in analysis, positioning, or strategy output.
- Use persona data to inform: avatar profile, pain point analysis, content positioning.

## Output Format (strict markdown)

Use exactly these sections:

1. `## Business Analysis`
2. `## Content Positioning`
3. `## Strategic Risks`
4. `## Decisions To Carry Forward`

## Rules

- Be specific and market-aware, no generic filler.
- Keep all decisions reusable by downstream steps.
- If data is missing, declare explicit assumption under `Strategic Risks`.

### **FASE 0: ANALISI PRE-SCRIPT**

Prima di iniziare lo script, rispondi a queste domande:

**BUSINESS ANALYSIS:**

* Chi è il cliente ideale? \[Avatar specifico\]  
* Qual è il pain point principale che risolvi? \[Collegato a: soldi, tempo, salute, accesso\]  
* Qual è il tuo "one standard deviation away"? \[Il problema tattico che implica quello principale\]  
* Qual è la tua offerta commerciale? \[Cosa vendi\]  
* Qual è il tuo elemento di prova? \[Case study, risultati, credenziali\]

**CONTENT POSITIONING:**

* Gioco scelto: \[ \] EDUCAZIONE (max utilità) \[ \] ENTERTAINMENT (max interesse)  
* Common belief del mercato: \[Cosa crede il target\]  
* Il tuo contrarian take: \[In cosa sei diverso\]  
* Il tuo "plan of attack": \[La tua metodologia/framework in X passi\]

---
