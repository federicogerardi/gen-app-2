# Tool Prompts Mockup Overview Spec

Data: 2026-04-25
Stato: Active

Questa cartella contiene mockup prompt per implementazione tecnica delle chiamate:

- extraction
- generation step-based per Funnel Pages
- generation step-based per Nextland

I mockup extraction e Funnel Pages sono stati riallineati ai prompt guida marketing/copywriting:

- extraction: [../extraction/prompt_generation.md](../extraction/prompt_generation.md)
- optin funnel: [../hl_funnel/prompt_optin_generator.md](../hl_funnel/prompt_optin_generator.md)
- quiz funnel: [../hl_funnel/prompt_quiz_generator.md](../hl_funnel/prompt_quiz_generator.md)
- vsl funnel: [../hl_funnel/prompt_vsl_generator.md](../hl_funnel/prompt_vsl_generator.md)

I mockup sono pensati come base di wiring backend/frontend e test integration.
I prompt finali di produzione possono evolvere, ma questi file fissano:

- shape input minima attesa
- variabili runtime richieste
- formato output atteso
- regole strategiche minime per conversione, coerenza e affidabilita

## File inclusi

- [Extraction generate call mockup](./extraction-generate-call-prompt-mockup-spec.md)
- [Funnel optin step mockup](./funnel-pages-optin-step-prompt-mockup-spec.md)
- [Funnel quiz step mockup](./funnel-pages-quiz-step-prompt-mockup-spec.md)
- [Funnel vsl step mockup](./funnel-pages-vsl-step-prompt-mockup-spec.md)
- [Nextland landing step mockup](./nextland-landing-step-prompt-mockup-spec.md)
- [Nextland thank-you step mockup](./nextland-thank-you-step-prompt-mockup-spec.md)

## Convenzioni mockup

- I placeholder sono in formato doppie graffe, per esempio `{{project.id}}`.
- Il layer runtime deve compilare tutti i placeholder obbligatori prima della chiamata modello.
- Se un placeholder non e disponibile, il runtime deve passare `null` o stringa vuota secondo il contratto del file.
- L output deve essere machine-readable e compatibile con persistenza artifact.
- I mockup Funnel devono restituire markdown puro (niente JSON, niente code fences) dove specificato.
- Il mockup extraction deve restituire JSON valido dove specificato.

## Scope

- Questi file non sostituiscono i prompt storici gia presenti in:
  - `docs/specifications/tool-prompts/extraction/`
  - `docs/specifications/tool-prompts/hl_funnel/`
  - `docs/specifications/tool-prompts/nextland/`
- Questi file rappresentano il pacchetto mockup per avvio implementazione GO.