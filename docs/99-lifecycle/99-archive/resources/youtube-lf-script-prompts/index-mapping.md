# Youtube LF Script Prompt Mapping Index

## Scope

- This index maps master-document sections to extracted prompt resources in this folder.
- The extracted resources are the source set for execution-time copy into backend runtime prompts.

## Source Master Document

- /home/federico/Scaricati/PROMPT_ GENERATORE DI SCRIPT YOUTUBE LONG-FORM AD ALTA CONVERSIONE.md

## Mapping Table

| Canonical Role | Master Section | Prepared Resource (this folder) | Runtime Target (execution copy) | Upstream Outputs In Context |
| --- | --- | --- | --- |
| Shared system instructions | ## ISTRUZIONI DI SISTEMA | [youtube-lf-script-system-instructions.md](./youtube-lf-script-system-instructions.md) | apps/backend/src/lib/runtime/tool-prompts/_shared/youtube-lf-script-system-instructions.md (or merged in each step file) | N/A |
| Extraction input basis | ## INPUT RICHIESTO | [youtube-lf-script-extraction.md](./youtube-lf-script-extraction.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-extraction.md | N/A |
| Step 1 | ### FASE 0: ANALISI PRE-SCRIPT | [youtube-lf-script-pre-script-analysis.md](./youtube-lf-script-pre-script-analysis.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-pre-script-analysis.md | none |
| Step 2 | ### FASE 1: PACKAGING | [youtube-lf-script-packaging.md](./youtube-lf-script-packaging.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-packaging.md | pre-script-analysis |
| Step 3 | ### FASE 2: STRUTTURA INTRO | [youtube-lf-script-intro-structure.md](./youtube-lf-script-intro-structure.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-intro-structure.md | pre-script-analysis + packaging |
| Step 4 | ### FASE 3: STRUTTURA BODY | [youtube-lf-script-body-structure.md](./youtube-lf-script-body-structure.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-body-structure.md | pre-script-analysis + packaging + intro-structure |
| Step 5 | ### FASE 4: NATIVE CTA EMBEDS | [youtube-lf-script-native-cta-embeds.md](./youtube-lf-script-native-cta-embeds.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-native-cta-embeds.md | pre-script-analysis + packaging + intro-structure + body-structure |
| Step 6 (final artifact) | ### FASE 5: STRUTTURA OUTRO | [youtube-lf-script-outro-structure.md](./youtube-lf-script-outro-structure.md) | apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-outro-structure.md | full chain through native-cta-embeds |
| Output contract reference | ## TEMPLATE OUTPUT FINALE | [youtube-lf-script-output-template.md](./youtube-lf-script-output-template.md) | Referenced by final-step validation and QA checklist | full chain + final step |

## Copy Protocol

1. Use the files in this folder as the authoritative source set for prompt creation.
2. Copy each mapped file to the corresponding runtime target path.
3. Apply tool/runtime adaptations without changing canonical step names.
4. Register runtime files in PROMPT_FILE_BY_KEY.
5. Validate FE/BE coherence against canonical 6-step sequence.
6. At runtime, pass the full prior-output chain to each step prompt as specified in the mapping table.
