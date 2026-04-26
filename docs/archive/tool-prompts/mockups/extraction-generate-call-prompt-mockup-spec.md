# Extraction Generate Call Prompt Mockup Spec

Data: 2026-04-25
Stato: Active

## Scopo

Mockup prompt per chiamata extraction server-side a partire da brief uploadato dall utente.
Obiettivo: ottenere un output strutturato riusabile dai prompt step Funnel/Nextland senza introdurre invenzioni.

## Input runtime minimo

- `project.id`: id progetto
- `project.name`: nome progetto
- `tool.key`: chiave tool richiesta (`funnel-pages` o `nextland`)
- `briefing.id`: id briefing persistito
- `briefing.fileName`: nome file caricato
- `briefing.text`: testo normalizzato estratto da file
- `schema.requiredFields`: lista campi obbligatori extraction
- `schema.optionalFields`: lista campi opzionali extraction
- `tone`: tono operativo richiesto
- `notes`: note runtime aggiuntive

## Prompt mockup

### System

Sei un assistente di extraction strutturata per funnel marketing.
Devi creare un contesto operativo sintetico e riusabile per prompt di generazione step-based.

Regole obbligatorie:

- estrai solo informazioni presenti nel documento
- non inventare dati
- se un valore non emerge chiaramente usa `null`
- usa solo chiavi flat della field map
- compila sempre tutti i campi richiesti in `fields`
- inserisci in `missingFields` solo chiavi mancanti/non verificabili
- privilegia prima i campi `required=true`
- se il documento e incompleto restituisci comunque JSON valido

### User

Project:
- id: {{project.id}}
- name: {{project.name}}

Tool target: {{tool.key}}
Briefing:
- id: {{briefing.id}}
- file: {{briefing.fileName}}

Testo briefing:
{{briefing.text}}

Campi obbligatori:
{{schema.requiredFields}}

Campi opzionali:
{{schema.optionalFields}}

Tono richiesto:
{{tone}}

Note runtime:
{{notes}}

Restituisci solo JSON valido nel formato richiesto.

## Output atteso

```json
{
  "fields": {
    "avatar": null,
    "primary_pain": null,
    "offer_name": null,
    "offer_price": null,
    "main_promise": null,
    "brand_voice": null,
    "cta_primary": null
  },
  "missingFields": [],
  "contextSections": {
    "businessContext": [],
    "offerDeliveryContext": [],
    "qualificationContext": [],
    "segmentationLeadMagnetContext": [],
    "beliefContext": [],
    "funnelGoalContext": [],
    "proofContext": [],
    "missingUnclear": []
  },
  "requiredFieldsChecklist": [],
  "consistency": {
    "status": "ok",
    "notes": ""
  },
  "summary": ""
}
```

## Note implementative

- Questo output alimenta artifact extraction con `type=extraction`.
- `fields` deve includere tutte le chiavi attese dal registry tool.
- `missingFields` deve contenere solo chiavi con valore null o non verificabile.
- `proofContext` deve contenere solo prove verificabili; in assenza usare stringa esplicita: `Non emerso dal documento`.
- `requiredFieldsChecklist` deve riportare in ordine tutti i campi required e il relativo stato (`present` o `missing`).
- `summary` deve essere sintetico (2-4 frasi), utile per orchestrazione e review UI.