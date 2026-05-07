# Deterministic Step Contract

## Step Key

- extraction

## Obiettivo

- Generare un documento markdown human-readable che estragga il contesto strategico per `youtube-lf-script`.
- L'output deve essere utile ai prompt successivi mantenendo fedelta al briefing sorgente.

## Required Input

- Raw briefing content.

## Vincoli obbligatori

- Restituisci SOLO markdown in italiano.
- Non usare JSON.
- Non usare blocchi di codice.
- Usa ESATTAMENTE le sezioni sotto, nello stesso ordine.
- Ogni sezione deve avere 1-3 bullet point sintetici.
- Ogni bullet deve contenere solo informazioni presenti nel documento.
- Se un dato non emerge chiaramente, scrivi: `Non emerso dal documento.`

## Output richiesto (struttura obbligatoria)

## Knowledge Content
- ...

## Avatar
- ...

## Pain Point
- ...

## Purchase Process Type
- ...

## Offer
- ...

## Proof
- ...

## Tone
- ...

## Target Duration Minutes
- ...

## Proprietary Methodology Disclosure
- ...

## Missing / Unclear
- ...

## Required Fields Checklist
- Checklist campi prioritari (required): knowledge_content, avatar, pain_point, purchase_process_type, offer, proof, tone, target_duration_minutes, proprietary_methodology_disclosure.

## Regole specifiche

- Keep extracted text concise and faithful to the source briefing.
- Per `target_duration_minutes`, riporta un valore numerico o un range solo se chiaramente inferibile; altrimenti usa `Non emerso dal documento.`
- In `Proof`, include only evidence that is explicitly stated in the briefing.
- In `Missing / Unclear`, list only gaps that can block or weaken downstream prompt quality.

# Source Excerpt

- Master document: /home/federico/Scaricati/PROMPT_ GENERATORE DI SCRIPT YOUTUBE LONG-FORM AD ALTA CONVERSIONE.md
- Extraction date: 2026-05-07

## **INPUT RICHIESTO**

Per generare lo script, fornisci:

1. **KNOWLEDGE/CONTENUTO:** Il materiale tecnico da trasformare in video  
2. **AVATAR:** Chi è il tuo cliente ideale (più specifico \= meglio)  
3. **PAIN POINT:** Quale problema principale risolvi  
4. **TIPO DI PROCESSO D'ACQUISTO:** Semplice/veloce o complesso/lungo?  
5. **OFFERTA:** Cosa vendi e a che prezzo (per calibrare la CTA)  
6. **PROOF:** Che credenziali/risultati hai da mostrare  
7. **TONO:** Formale/informale, tecnico/accessibile  
8. **DURATA TARGET:** Quanti minuti circa  
9. **METODOLOGIA PROPRIETARIA:** Se hai un sistema/framework con nome specifico, vuoi svelarlo subito o mantenere curiosità?

