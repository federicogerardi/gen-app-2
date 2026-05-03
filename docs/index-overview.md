---
status: approved
version: 2.3
last-reviewed: 2026-05-03
next-review-date: 2026-08-03
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-05-02
Stato: active
Versione indice: 2.2

Indice operativo as-is ottimizzato per scansione AI: contenuto deduplicato, sezioni stabili, priorita esplicite.

## Snapshot Operativo

- Scope: post-publish
- Root documentale: docs/
- Archivio storico: [99-lifecycle/99-archive](./99-lifecycle/99-archive/)
- Last review date: 2026-05-03
- Next review date: 2026-08-03

## Section Map

| Sezione | Entry point | Owner |
| --- | --- | --- |
| 00-overview | [index-overview](./index-overview.md) | Documentation Archivist |
| 01-requirements | [01-requirements](./01-requirements/) | Product + Frontend Platform |
| 02-design | [frontend-spec](./02-design/specifications/frontend-spec.md) | Frontend Platform Team |
| 03-development | [03-development](./03-development/) | Engineering Team |
| 04-testing | [04-testing](./04-testing/) | QA + Engineering Team |
| 05-ops | [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) | Platform/DevOps |
| 06-user | [06-user](./06-user/) | Product + UX |
| 07-governance | [tools-generation-go-closure-2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md) | Documentation Archivist |
| 99-lifecycle | [99-archive](./99-lifecycle/99-archive/) | Documentation Archivist |

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [frontend-spec](./02-design/specifications/frontend-spec.md) | approved | 2026-04-27 | 2026-07-27 |
| [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) | approved | 2026-05-01 | 2026-08-01 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |
| [tools-generation-go-closure-2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md) | approved | 2026-04-27 | 2026-07-27 |

## Active Registry

### DDD Canonical References

- [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
- [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)

### Design Specifications

- [frontend-spec](./02-design/specifications/frontend-spec.md)
- [frontend-unification-replication-guide](./02-design/specifications/frontend-unification-replication-guide.md)
- [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md)
- [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md)
- [gui-scope-as-is-spec](./02-design/specifications/gui-scope-as-is-spec.md)
- [tool-generation-structural-ux-flow-spec](./02-design/specifications/tool-generation-structural-ux-flow-spec.md)
- [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
- [xstate-system-as-is-spec](./02-design/specifications/xstate-system-as-is-spec.md)
- [xstate-system-as-is](./02-design/specifications/xstate-system-as-is/)
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md)

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)

### Governance Review

- [tools-generation-go-closure-2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md)

### Active Plans And Runbooks

- [repository-publication-cleanup-1](../plan/repository-publication-cleanup-1.md) - planned

### Development Changelog

- [frontend-xstate-refactor-as-is-changelog-2026-05-02](./03-development/frontend-xstate-refactor-as-is-changelog-2026-05-02.md)

### Frontend Supporting Docs

- [debug-streaming](../frontend/DEBUG-STREAMING.md)
- [tool-form-architecture](../frontend/TOOL-FORM-ARCHITECTURE.md)

## Archive Registry

### Direct Archive Snapshots

- [xstate-system-as-is-monolith-spec](./99-lifecycle/99-archive/xstate-system-as-is-monolith-spec.md)
- [xstate-review-closure-2026-04-24](./99-lifecycle/99-archive/xstate-review-closure-2026-04-24.md)
- [frontend-design-artifact-canvas-snapshot-2026-04-26](./99-lifecycle/99-archive/frontend-design-artifact-canvas-snapshot-2026-04-26.md)
- [infrastructure-same-origin-deployment-1](./99-lifecycle/99-archive/infrastructure-same-origin-deployment-1.md) — superseded da feature-railway-same-origin-unified-1
- [railway-same-origin-migration-strategy-3-phases](./99-lifecycle/99-archive/railway-same-origin-migration-strategy-3-phases.md) — superseded da feature-railway-same-origin-unified-1
- [architecture-railway-private-network-same-origin-1](../plan/architecture-railway-private-network-same-origin-1.md) — completed 2026-05-01; tutti i 4 sprint eseguiti, topologia same-origin privata in produzione
- [feature-railway-same-origin-unified-1](../plan/feature-railway-same-origin-unified-1.md) — deprecated 2026-05-01; superseded da architecture-railway-private-network-same-origin-1
- [refactor-xstate-frontend-machines-1-snapshot-2026-05-02](./99-lifecycle/99-archive/planning/refactor-xstate-frontend-machines-1-snapshot-2026-05-02.md) — archived 2026-05-02; piano completato con smoke test finale GO
- [unification-xstate-first-frontend-1-snapshot-2026-05-02](./99-lifecycle/99-archive/planning/unification-xstate-first-frontend-1-snapshot-2026-05-02.md) — archived 2026-05-02; 5 sprint completati, XState-first unification GO

### Archive Buckets

- [planning archive](./99-lifecycle/99-archive/planning/)
- [governance-pre-publish archive](./99-lifecycle/99-archive/governance-pre-publish/)
- [tool-prompts archive](./99-lifecycle/99-archive/tool-prompts/)

## Current Delta (2026-05-03)

- **✅ Bug risolto — sblocco UI post-generazione**: `toolFlowMachine` non riceveva mai `STEP_DONE`/`STEP_FAILED` dal template → macchina bloccata in `generating` indefinitamente. Fix: `wasStreamActiveRef` + bridge `useEffect` in [ToolPageTemplate.tsx](../frontend/src/features/tools/ui/ToolPageTemplate.tsx); `canCancelGeneration` derivato direttamente da `toolPageSnapshot.matches('generating')`. Smoke test browser confermato GO. Typecheck e 38/38 test verdi.
- **✅ Bug risolto — CTA post-generazione con path contaminato**: `buildArtifactEntryQuery` con `intent='new'` includeva `sourceArtifactId`, `relaunchFromArtifactId`, `tone`, `notes`, `briefingId` → navigazione verso tool page con query sporca. Fix in [artifact-history.ts](../frontend/src/features/generation/ui/artifact-history.ts): path `new` restituisce solo `intent` + `projectId`; path `resume`/`regenerate` mantiene tutti i parametri. Smoke test browser confermato GO.
- **✅ Bug risolto — listing projects/artifacts vuoti dopo navigazione SPA**: `BackendCapabilities` per `projects` e `artifacts` defaultavano a `false` (opt-in) → query hooks non eseguivano fetch. Corretto in [backend-capabilities.ts](../frontend/src/app/runtime/backend-capabilities.ts): `projects` e `artifacts` ora opt-out (abilitati di default quando env var assente). Stabilizzata identity di `capabilities` in [AuthSessionProvider.tsx](../frontend/src/app/providers/AuthSessionProvider.tsx) via `useMemo` per prevenire loop di re-fetch.
- **Test coverage aggiunta**: consumer-level CTA navigation (`ArtifactDetailPage.test.tsx`, `GenerationConsolePage.test.tsx`); router integration SPA flow (2 test in `app-router.test.tsx`); SPA remount refetch (`ProjectsListPage`, `ArtifactsPage`, `AdminUsersPage`). Totale: 10/10 router test verdi, 27/27 test verdi nei file modificati.

## Current Delta (2026-05-02)

- **Piano same-origin completato**: [architecture-railway-private-network-same-origin-1](../plan/architecture-railway-private-network-same-origin-1.md) — tutti i 4 sprint eseguiti; topologia Railway private-network via `frontend/server.mjs` in produzione. Piano archiviato.
- Piano unificato same-origin Railway attivo: [feature-railway-same-origin-unified-1](../plan/feature-railway-same-origin-unified-1.md).
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) aggiornato a rev 2.1 con Variant B, logging proxy, timeout SSE, rollback cross-origin, rischi residui.
- Recovery automatica `runExtraction` in caso di stream drop mid-transport (artefatto già salvato lato server).
- Piano refactor frontend XState archiviato: [refactor-xstate-frontend-machines-1-snapshot-2026-05-02](./99-lifecycle/99-archive/planning/refactor-xstate-frontend-machines-1-snapshot-2026-05-02.md) con chiusura definitiva e verifica E2E GO.
- Blueprint as-is XState aggiornato al delta refactor frontend 2026-05-02: sincronizzazione input actor briefing, recovery extraction persistita e verifica strict no-unused nel frontend.
- **Issue frontend tools chiusa (2026-05-02)**: recovery checkpoint ripristinato e stabilizzato; smoke test tools confermato `OK` con ripresa generazione da checkpoint.
- Hardening readiness `toolPageMachine`: snapshot strutturato nel contesto macchina con `reasonCodes` (`missing_project`, `missing_extraction_context`, `missing_primary_target_step`) e consumo UI deterministico nel blocco `Pronto per la generazione`.
- Recovery extraction legacy-safe: matcher compatibile con artifact storici privi di `sourceRequest.input.toolKey`.
- Unificazione XState-first frontend tools avanzata a Sprint 4 completato: viewModel macchina canonico, template presenter-thin, contract verticale ridotto e gate regressione/typecheck tutti verdi.
- Source of truth machine-friendly aggiornato: [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md) allineato a ownership `toolPageMachine.context.viewModel`.
- **Piano unification XState-first archiviato**: [unification-xstate-first-frontend-1-snapshot-2026-05-02](./99-lifecycle/99-archive/planning/unification-xstate-first-frontend-1-snapshot-2026-05-02.md) — 5 sprint completati, 21 test verdi, typecheck pass, docs allineati. GO/NO-GO: GO.

## Governance Rules Applied

- Documenti attivi in aree operative; snapshot conclusi e pre-publish in archive.
- Naming markdown: lowercase kebab-case con topic + doc-type.
- Rename/spostamenti: update link e indici nello stesso change set.
- Frontend visual source of truth: [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md).