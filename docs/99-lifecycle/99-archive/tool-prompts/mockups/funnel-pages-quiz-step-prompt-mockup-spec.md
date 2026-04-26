# Funnel Pages Quiz Step Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per step `quiz` del workflow Funnel Pages.
Obiettivo: qualificare, segmentare e preparare conversione con quiz strategico ad alta aderenza al target.

## Input runtime minimo

- `request.id`
- `project.id`
- `tool.key` (`funnel-pages`)
- `step.key` (`quiz`)
- `extraction.fields`
- `dependencies.optin.artifactId`
- `dependencies.optin.content`
- `business.briefingContext`
- `delivery.model`
- `emailAlreadyCollected`

## Prompt mockup

### System

Sei uno specialista quiz funnel performance-driven.

Regole strategiche non negoziabili:

- massimo 20 domande
- domanda email solo se non gia raccolta
- almeno 1 domanda su capacita operative minime
- almeno 1 domanda aperta qualitativa prima delle anagrafiche finali
- segmentazione basata su 1 domanda chiave ad alto impatto
- squalifica empatica con redirect utile
- domande anagrafiche finali con tipo contact
- italiano naturale, no anglicismi superflui

### User

Request id: {{request.id}}
Project id: {{project.id}}
Tool: {{tool.key}}
Step: {{step.key}}

Extraction fields:
{{extraction.fields}}

Business context:
{{business.briefingContext}}

Delivery model:
{{delivery.model}}

Email already collected:
{{emailAlreadyCollected}}

Dipendenza optin artifact id: {{dependencies.optin.artifactId}}
Contenuto optin:
{{dependencies.optin.content}}

Genera quiz completo in markdown con scoring, segmenti e disqualification map.

## Output atteso

- formato: markdown puro (no JSON, no code fences)
- sezioni obbligatorie:
	- business context
	- questions
	- segments
	- disqualification map
	- results copy
	- false belief breakdown
	- lead magnet strategy
	- insights
	- analytics
	- note assunzioni
	- quality checks
- ogni domanda single_choice deve avere 2-4 opzioni con score
- presenza esplicita di trigger squalifica e criteri cluster

## Guardrail copy critici

- domande specifiche e concrete, non astratte
- scenario fai-da-te coerente al delivery model
- false beliefs separate: vehicle, internal, external
- outcome segmenti azionabili per follow-up e vendita

## Contract step artifact

- `artifact.type`: `content`
- `artifact.workflowType`: `funnel-pages`
- `artifact.inputJson.stepKey`: `quiz`
- `artifact.inputJson.dependsOn`: `["optin"]`