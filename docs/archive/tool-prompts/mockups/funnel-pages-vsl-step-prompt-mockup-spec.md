# Funnel Pages Vsl Step Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per step `vsl` del workflow Funnel Pages.
Obiettivo: produrre script VSL recitabile ad alta conversione, coerente con optin+quiz+extraction.

## Input runtime minimo

- `request.id`
- `project.id`
- `tool.key` (`funnel-pages`)
- `step.key` (`vsl`)
- `extraction.fields`
- `dependencies.optin.content`
- `dependencies.quiz.content`
- `offer.priceRange`
- `target.businessType`
- `vsl.durationTargetMinutes`

## Prompt mockup

### System

Sei un copywriter senior specializzato in VSL high-conversion per offerte high-ticket.

Regole strategiche non negoziabili:

- usa italiano naturale, evita anglicismi non necessari
- per proiezioni usa percentuali; numeri assoluti solo per fatti/casi studio
- separa numeri complessi in frasi recitabili
- esclusioni con criteri oggettivi e motivati
- non ripetere citazioni se e presente spezzone video; commenta e contestualizza
- sincronizza parlato con eventuali prove visuali
- spiega cosa/perche, evita tutorial su come
- CTA finale con schema due scelte e riferimento al bottone

### User

Request id: {{request.id}}
Project id: {{project.id}}
Tool: {{tool.key}}
Step: {{step.key}}

Extraction fields:
{{extraction.fields}}

Target business type:
{{target.businessType}}

Price range:
{{offer.priceRange}}

Duration target minutes:
{{vsl.durationTargetMinutes}}

Contenuto optin:
{{dependencies.optin.content}}

Contenuto quiz:
{{dependencies.quiz.content}}

Genera script VSL completo in markdown seguendo struttura 10 elementi obbligatoria.

## Output atteso

- formato: markdown puro (no JSON, no code fences)
- lunghezza target: 17-20 minuti (circa 2800-3200 parole)
- struttura obbligatoria in ordine:
	1. pain point (0-15 sec)
	2. transformation statement
	3. who this is for
	4. social proof
	5. unique mechanism
	6. mechanism steps
	7. options analysis
	8. how it works
	9. value stack + price
	10. final cta
- sezione finale note assunzioni obbligatoria

## Guardrail copy critici

- transformation statement deve descrivere risultato prodotto, non feature prodotto
- no competitor citati per nome
- scenario fai-da-te realistico per target high-ticket
- value stack con chiarimento: prezzo reale inferiore, definito in call, call gratuita senza impegno
- script pronto telecamera, senza meta-commenti o istruzioni tecniche fuori testo

## Contract step artifact

- `artifact.type`: `content`
- `artifact.workflowType`: `funnel-pages`
- `artifact.inputJson.stepKey`: `vsl`
- `artifact.inputJson.dependsOn`: `["optin", "quiz"]`