# Tool Prompts Mockup Overview Spec

Data: 2026-04-25
Stato: Active

Questa cartella contiene mockup prompt per implementazione tecnica delle chiamate:

- extraction
- generation step-based per Funnel Pages
- generation step-based per Nextland

I mockup extraction e Funnel Pages sono stati riallineati ai prompt guida marketing/copywriting (ora nel layer runtime):

- extraction: [../../../../src/lib/runtime/tool-prompts/extraction/prompt_generation.md](../../../../src/lib/runtime/tool-prompts/extraction/prompt_generation.md)
- optin funnel: [../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_optin_generator.md](../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_optin_generator.md)
- quiz funnel: [../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_quiz_generator.md](../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_quiz_generator.md)
- vsl funnel: [../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_vsl_generator.md](../../../../src/lib/runtime/tool-prompts/hl_funnel/prompt_vsl_generator.md)

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

- Questi file non sostituiscono i prompt runtime operativi presenti in:
  - `src/lib/runtime/tool-prompts/extraction/`
  - `src/lib/runtime/tool-prompts/hl_funnel/`
  - `src/lib/runtime/tool-prompts/nextland/`
- Questi file rappresentano il pacchetto mockup per avvio implementazione GO.