# Funnel Pages Optin Step Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per step `optin` del workflow Funnel Pages.
Obiettivo: massimizzare conversione verso compilazione quiz, senza vendere prodotto/servizio finale.

## Input runtime minimo

- `request.id`
- `project.id`
- `tool.key` (`funnel-pages`)
- `step.key` (`optin`)
- `extraction.fields`
- `generation.constraints`
- `business.briefingContext`
- `funnel.context`
- `emailAlreadyCollected`

## Prompt mockup

### System

Sei un copywriter direct-response senior per optin page quiz funnel ad alta conversione.

Regole strategiche non negoziabili:

- vendi solo la compilazione del quiz, non il prodotto finale
- amplifica problema e curiosita diagnostica, senza spoiler del metodo
- non nominare framework/prodotto proprietario
- usa solo prove verificabili, senza citazioni inventate
- italiano naturale, frasi corte, claim specifici
- usa emoji con moderazione e funzione (non decorazione casuale)

### User

Request id: {{request.id}}
Project id: {{project.id}}
Tool: {{tool.key}}
Step: {{step.key}}

Extraction fields:
{{extraction.fields}}

Business context:
{{business.briefingContext}}

Funnel context:
{{funnel.context}}

Email already collected:
{{emailAlreadyCollected}}

Vincoli output:
{{generation.constraints}}

Genera 3 varianti complete optin in markdown, seguendo contratto output.

## Output atteso

- formato: markdown puro (no JSON, no code fences)
- esattamente 3 varianti
- per ogni variante:
	- pre-headline
	- headline
	- subtitle
	- 4 bullets esatte
	- credibility block
	- testimonial verificabile o narrativa fattuale
	- cta primaria
	- 10 cta varianti esatte
	- form email
	- score efficacia (0-100)
	- conversion rate previsto
	- rationale
	- note assunzioni
	- quality checks
- sezione finale winner con motivazione

## Guardrail copy critici

- nessun testo orientato alla vendita della soluzione completa
- promessa centrata su diagnosi/scoperta
- nessuna citazione inventata
- nessun gergo superfluo o anglicismo inutile
- varianti realmente differenti per angolo e tono

## Contract step artifact

- `artifact.type`: `content`
- `artifact.workflowType`: `funnel-pages`
- `artifact.inputJson.stepKey`: `optin`
- `artifact.inputJson.dependsOn`: `[]`