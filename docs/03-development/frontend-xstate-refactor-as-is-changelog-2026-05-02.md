---
status: approved
version: 1.0
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
- smoke test manuale tools pipeline -> GO

## References

- Piano sorgente: [refactor-xstate-frontend-machines-1](../../plan/refactor-xstate-frontend-machines-1.md)
- Snapshot archivio piano: [refactor-xstate-frontend-machines-1-snapshot-2026-05-02](../99-lifecycle/99-archive/planning/refactor-xstate-frontend-machines-1-snapshot-2026-05-02.md)
