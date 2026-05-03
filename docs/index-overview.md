---
status: approved
version: 2.4
last-reviewed: 2026-05-03
next-review-date: 2026-08-03
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-05-02
Stato: active
Versione indice: 2.2

Indice operativo as-is ottimizzato per scansione AI: contenuto deduplicato, sezioni stabili, priorita esplicite.

> **⚑ DDD GATE — Leggere prima di qualsiasi analisi o intervento**
>
> Questi tre documenti sono il riferimento primario obbligatorio per ogni agente, sviluppatore o revisore che opera su questo workspace — sia su codice che su documentazione:
>
> 1. [Domain Ubiquitous Language Glossary](./01-requirements/domain-ubiquitous-language-glossary.md) — vocabolario canonico, 39 termini su 4 bounded context
> 2. [Domain Bounded Context Map](./02-design/domain-bounded-context-map.md) — responsabilità, confini e regole di traduzione cross-context
> 3. [Domain Naming Decision Log](./07-governance/domain-naming-decision-log.md) — 19 decisioni nomenclatura approvate, termini deprecati e alias backward-compat
>
> Regola invariante: nessun termine nuovo può entrare nel codice o nella documentazione senza una voce `DDD-NNN` nel decision log.

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
| 07-governance | [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | Documentation Archivist |
| 99-lifecycle | [99-archive](./99-lifecycle/99-archive/) | Documentation Archivist |

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md) | active | 2026-05-03 | 2026-08-03 |
| [domain-bounded-context-map](./02-design/domain-bounded-context-map.md) | active | 2026-05-03 | 2026-08-03 |
| [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | active | 2026-05-03 | 2026-08-03 |
| [frontend-spec](./02-design/specifications/frontend-spec.md) | approved | 2026-04-27 | 2026-07-27 |
| [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) | approved | 2026-05-01 | 2026-08-01 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |
| [tools-generation-go-closure-2026-04-25](./99-lifecycle/99-archive/tools-generation-go-closure-2026-04-25.md) | archived | 2026-04-27 | N/A |

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
- [tool-generation-flow](./02-design/tool-generation-flow.md)
- [tool-generation-flow-vertical](./02-design/tool-generation-flow-vertical.md)
- [xstate-system-as-is-spec](./02-design/specifications/xstate-system-as-is-spec.md)
- [xstate-system-as-is](./02-design/specifications/xstate-system-as-is/)
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md)

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)

### Governance Review

- [tools-generation-go-closure-2026-04-25](./99-lifecycle/99-archive/tools-generation-go-closure-2026-04-25.md) — archived

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

- **✅ Quality Audit — codice e documentazione (2026-05-03)**: 5 interventi di consistenza eseguiti. (1) Canonico `generation/ui/tool-ux-state.ts` esteso con `'regenerate-current-step'` in `PrimaryActionPolicy`, `SecondaryActionFlags`, e `derivePrimaryActionLabel`; legacy `tools/runtime/tool-ux-state.ts` convertito in shim con re-export dai canonici. (2) `toolStepOrder` deduplicato: fonte unica in `tool-flow.machine.ts` (DDD-019), re-export da `tool-generation-engine.ts`. (3) `GenerationRequest` frontend esteso con campi opzionali `briefingId`, `extractionArtifactId`, `stepDependencyArtifactIds`. (4) Alias deprecati `ToolPageReadinessSnapshot` / `ToolPageReadinessReasonCode` rimossi da `tool-page.machine.ts` (fine ciclo DDD-014). (5) File archiviato `FunnelPagesToolPage.refactored.example.tsx` eliminato; `TOOL_GENERATION_FLOW*.md` spostati in `docs/02-design/`. Tutti i 189 test frontend verdi.
- **✅ DDD UL Alignment — Phase 1–4 (refactor-frontend-ddd-ul-alignment-1)**: 11 drift risolti su 4 cluster tematici. Phase 1: `ToolExtractionContext` → `ExtractionContext` (DDD-012); `BriefingContext` deprecato con alias. Phase 2: `ToolStepStatus` unificato con valore `'done'` (DDD-013); tipi inline `'idle'|'running'|'completed'|'error'` rimossi da 5 file. Phase 3: `ToolPageReadinessSnapshot`/`ToolPageReadinessReasonCode` → `ReadinessSnapshot`/`ReadinessReasonCode` con alias backward-compat (DDD-014); ridefinizione locale rimossa da `ToolGenerationFlowVertical.tsx`. Phase 4: decision log aggiornato DDD-012..014; glossario aggiornato con 4 alias deprecati. Typecheck 1 errore pre-esistente, 1 test pre-esistente fallito — nessuna regressione introdotta.
- **✅ DDD Ubiquitous Language — review documentazione attiva (2026-05-03)**: rilevati e corretti 4 drift in 4 spec attive. (1) `tool-generation-flow-source-of-truth-spec`: `ToolStepStatus` usava `'completed'` invece del valore canonico `'done'`; (2) `xstate-system-as-is-spec`: riferimento SSE privo del termine canonico `BackendStreamEvent`; (3) `frontend-tool-pages-architecture-spec`: `ToolKey` non relazionato a `SupportedTool` canonico; (4) `tool-generation-structural-ux-flow-spec`: `extractionContext` corretto in `ExtractionContext`. Decision log aggiornato: DDD-011 approvato, DDD-C-003 risolto.
- **✅ DDD Ubiquitous Language — prima analisi completa**: glossario con 39 termini canonici distribuiti su 4 bounded context (Generation, Auth, Usage/Quota, Frontend/UI); bounded context map con attori XState, responsabilità e regole di traduzione cross-context; 10 naming decision approvate + 3 conflitti risolti nel decision log. Istruzione `.github/instructions/dominio-ubiquitous-language.instructions.md` aggiornata con tabella dei termini critici da non confondere. Tutti e tre i documenti canonici promossi da `draft` ad `active`.
- **✅ Bug risolto — sblocco UI post-generazione**: `toolFlowMachine` non riceveva mai `STEP_DONE`/`STEP_FAILED` dal template → macchina bloccata in `generating` indefinitamente. Fix: `wasStreamActiveRef` + bridge `useEffect` in [ToolPageTemplate.tsx](../frontend/src/features/tools/ui/ToolPageTemplate.tsx); `canCancelGeneration` derivato direttamente da `toolPageSnapshot.matches('generating')`. Smoke test browser confermato GO. Typecheck e 38/38 test verdi.
- **✅ Bug risolto — entry query ArtifactRelaunch resa deterministica**: `buildArtifactEntryQuery` è stato normalizzato per differenziare i casi. Path `new` mantiene solo i riferimenti minimi di hydration (`intent`, `projectId`, `sourceArtifactId` e, quando presenti, `briefingId`/`extractionArtifactId`) senza parametri di rilancio runtime (`tone`, `notes`, `relaunchFromArtifactId`); path `resume`/`regenerate` mantiene il set esteso di parametri operativi. Fix in [artifact-history.ts](../frontend/src/features/generation/ui/artifact-history.ts).
- **✅ Bug risolto — hydration/recovery ArtifactRelaunch (riscrittura radicale)**: recupero extraction contesto reso deterministico tra [tool-page.machine.ts](../frontend/src/features/tools/machines/tool-page.machine.ts) e [ToolPageTemplate.tsx](../frontend/src/features/tools/ui/ToolPageTemplate.tsx). Correzioni principali: canonicalizzazione `briefingId` (`brief_`), override fallback legacy basato su `artifactId`, fetch detail by id quando la list extraction non include `content`, priorità a `briefingId` da route nel dispatch `HYDRATE_REQUESTED`, rimozione fallback UI non deterministici quando esiste `sourceArtifact`. Obiettivo: eliminare divergenze `new/resume/regenerate` nel passaggio `HydrationResult` → `GenerationRequest`.
- **✅ DDD Governance closure — ArtifactRelaunch default intent**: canonical documents now align on one `ArtifactRelaunch` concept, one effective post-hydration primary action (`start-generation`), and default runtime intent `regenerate` for artifact-driven relaunch entries. Decision log conflict `DDD-C-004` moved from `proposed` to `resolved`.
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