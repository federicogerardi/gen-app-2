# Nextland Thank-You Step Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per step `thank_you` del workflow Nextland.

## Input runtime minimo

- `request.id`
- `project.id`
- `tool.key` (`nextland`)
- `step.key` (`thank_you`)
- `extraction.fields`
- `dependencies.landing.artifactId`
- `dependencies.landing.content`

## Prompt mockup

### System

Sei un copywriter per thank-you page post conversione.
Ottimizza chiarezza, next action e retention.

### User

Request id: {{request.id}}
Project id: {{project.id}}
Tool: {{tool.key}}
Step: {{step.key}}

Extraction fields:
{{extraction.fields}}

Dipendenza landing artifact id: {{dependencies.landing.artifactId}}
Contenuto landing:
{{dependencies.landing.content}}

Genera thank-you page in markdown con conferma conversione e prossimi step.

## Output atteso

- formato: markdown
- conferma iscrizione/acquisto
- prossimi passi con timeline
- CTA secondaria (upsell o onboarding)

## Contract step artifact

- `artifact.type`: `content`
- `artifact.workflowType`: `nextland`
- `artifact.inputJson.stepKey`: `thank_you`
- `artifact.inputJson.dependsOn`: `["landing"]`