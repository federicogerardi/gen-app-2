---
status: approved
version: 1.1
last-reviewed: 2026-05-02
next-review-date: 2026-08-02
owner: Frontend Platform Team
---

# Frontend XState Refactor As-Is Changelog (2026-05-02)

## Scope

Nota di changelog documentale per allineare il sistema as-is nel perimetro del refactoring frontend XState (tools/auth/workspace).

## Summary Outcome

- Piano refactor completato e archiviato con chiusura definitiva.
- Smoke test end-to-end completato fino all'ultimo artifact con esito GO.
- Documentazione as-is aggiornata per riflettere gli invarianti runtime realmente in uso.

## As-Is Deltas Registered

1. Synchronization actor input lato tool page:
- evento `INPUT_SYNCED` formalizzato per evitare context stale dopo variazioni di `projectId` e sessione.

2. Convergenza extraction lifecycle lato frontend:
- evento `EXTRACTION_RECOVERED` formalizzato per chiudere `extracting -> ready` quando esiste artifact extraction persistito.

3. Stato qualità codice frontend:
- cleanup dead code completato nel workspace frontend.
- check strict TypeScript (`noUnusedLocals` / `noUnusedParameters`) verificato a zero errori.

4. Consolidamento actor tree tool page:
- eliminata la duplicazione della sorgente briefing tra hook locale e machine.
- `ToolPageTemplate` usa come sorgente canonica lo snapshot del child actor briefing spawnato da `toolPageMachine`.

5. Coerenza action flow e CTA dopo restore checkpoint:
- completata la gestione policy primaria (`start-generation`, `resume-checkpoint`, `regenerate-current-step`, `open-last-artifact`).
- avvio step orchestrato via comando macchina (`REQUEST_STEP_START`) con dispatch side effect su pending command.
- hardening readiness centralizzato in `toolPageMachine`: snapshot strutturato nel contesto con reason codes (`missing_project`, `missing_extraction_context`, `missing_primary_target_step`).
- recovery checkpoint extraction reso legacy-safe: matcher compatibile con artifact storici privi di `sourceRequest.input.toolKey`.
- UI `ToolGenerationFlowVertical` allineata a reason codes macchina per feedback deterministico del requisito `Pronto per la generazione`.

## Known Issue Status

- **Tool checkpoint recovery readiness (frontend)**
	- Stato: `closed` (2026-05-02)
	- Esito: funzionalità di generazione da checkpoint ripristinata; CTA primaria e colonna destra convergono correttamente a stato pronto nei rientri validi da artifact/history.
	- Verifica: smoke test tools `OK` e suite test frontend aggiornata con casi di regressione su recovery legacy.

## Documentation Updated In This Delta

- [xstate-system-as-is-spec](../02-design/specifications/xstate-system-as-is-spec.md)
- [xstate-actor-contracts-and-topology-spec](../02-design/specifications/xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md)
- [testing-go-no-go-and-risk-spec](../02-design/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md)
- [tools-generation-go-closure-2026-04-25](../07-governance/review/tools-generation-go-closure-2026-04-25.md)
- [index-overview](../index-overview.md)

## Execution Evidence

- `npm --prefix frontend run typecheck` -> pass
- `npx tsc -p frontend/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters` -> pass
- `npm --prefix frontend run test -- src/features/tools/runtime/useToolForm.test.tsx src/features/tools/machines/briefing-upload.machine.test.ts` -> pass
- `npm --prefix frontend run test -- ToolPageTemplate.test.tsx src/features/tools/machines/tool-page.machine.test.ts` -> pass
- `npm --prefix frontend run test -- src/features/tools/ui/ToolGenerationFlowVertical.test.tsx src/features/tools/ui/ToolPageTemplate.test.tsx` -> pass
- smoke test manuale tools pipeline -> GO

## References

- Piano sorgente: [refactor-xstate-frontend-machines-1](../../plan/refactor-xstate-frontend-machines-1.md)
- Snapshot archivio piano: [refactor-xstate-frontend-machines-1-snapshot-2026-05-02](../99-lifecycle/99-archive/planning/refactor-xstate-frontend-machines-1-snapshot-2026-05-02.md)
