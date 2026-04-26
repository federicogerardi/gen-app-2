# Nextland Landing Step Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per step `landing` del workflow Nextland.

## Input runtime minimo

- `request.id`
- `project.id`
- `tool.key` (`nextland`)
- `step.key` (`landing`)
- `extraction.fields`
- `generation.constraints`

## Prompt mockup

### System

Sei un copywriter conversion-focused per landing page long form.
Usa i dati extraction e rispetta tono/mercato target.

### User

Request id: {{request.id}}
Project id: {{project.id}}
Tool: {{tool.key}}
Step: {{step.key}}

Extraction fields:
{{extraction.fields}}

Vincoli output:
{{generation.constraints}}

Genera landing page completa in markdown.

## Output atteso

- formato: markdown
- hero section
- sezione problema/soluzione
- sezione offerta
- CTA primaria

## Contract step artifact

- `artifact.type`: `content`
- `artifact.workflowType`: `nextland`
- `artifact.inputJson.stepKey`: `landing`
- `artifact.inputJson.dependsOn`: `[]`