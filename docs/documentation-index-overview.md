---
status: approved
version: 2.0
last-reviewed: 2026-04-27
next-review-date: 2026-07-27
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-04-27
Stato: Active
Version: 2.0

Indice operativo della documentazione as-is, organizzato per area e stato del documento.

**Status**: Post-publish. Documentazione pre-publish archiviata in `docs/99-lifecycle/99-archive/`. Questa documentazione riflette lo stato operativo attuale (as-is) del progetto.

## Specifiche attive (02-design/specifications/)

- [Frontend as-is](./02-design/specifications/frontend-spec.md)
- [Frontend Unification Replication Guide](./02-design/specifications/frontend-unification-replication-guide.md) - Regole canoniche per riusare il layer HTTP condiviso, registry endpoint, query hooks e parser unificati nei futuri sviluppi frontend
- [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) - Fonte unica di verita per linee guida visuali, tokens, layout e componenti GUI
- [Frontend Tool Pages Architecture (Unified)](./02-design/specifications/frontend-tool-pages-architecture-spec.md) - **NEW**: Architettura unificata per tool pages, eliminazione duplicazione, scaling pattern per nuovi tool
- [GUI scope as-is](./02-design/specifications/gui-scope-as-is-spec.md)
- [Tool generation structural UX flow](./02-design/specifications/tool-generation-structural-ux-flow-spec.md)
- [XState system as-is blueprint index](./02-design/specifications/xstate-system-as-is-spec.md)
- [Deployment architecture guide](./02-design/specifications/deployment-architecture-guide.md) - Strategie deployment, opzioni platform, checklist pre-deployment

## Architecture Decision Records (02-design/adr/)

- [Unified Frontend Data Access Layer](./02-design/adr/frontend-data-access-layer-adr.md) - Decisione architetturale accettata per centralizzare transport HTTP, endpoint registry, query hooks e parser condivisi nel frontend

Nota frontend attiva:

- La specifica frontend include ora il contratto operativo per la centralizzazione di grafica e copy (`frontend/src/app/ui/primitives.tsx`, `frontend/src/styles.css`, `frontend/src/app/copy/system.ts`).
- La guida [Frontend Unification Replication Guide](./02-design/specifications/frontend-unification-replication-guide.md) documenta il pattern canonico per replicare l'unificazione di transport HTTP, endpoint registry, query hooks e parser shared nelle evoluzioni future.
- L'ultimo completamento del refactor ha esteso il perimetro unificato anche a page-state components condivisi (`LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage`), debug HTTP opzionale e test page-level critici su projects/artifacts.
- La guida [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) e la fonte unica di verita per ogni intervento GUI visuale.
- La nuova specifica [Frontend Tool Pages Architecture](./02-design/specifications/frontend-tool-pages-architecture-spec.md) documenta il pattern **unificato** per le pagine dei tool di generazione (FunnelPages, NextLand, futuri tool). Elimina ~95% duplicazione di codice e consente l'aggiunta di nuovi tool in ~30 minuti. Target state post-refactoring.

Pacchetto atomizzato XState:

- [Cartella specifiche atomizzate XState](./02-design/specifications/xstate-system-as-is/)

## Review attive (07-governance/review/)

- [Tools generation go closure 2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md) - Evidenza finale di GO: upload brief, extraction persistita, generation workflow Funnel/Nextland, completion e fallback operativi.

Nota: Sprint checklists e regression policy archiviate in `docs/99-lifecycle/99-archive/governance-pre-publish/` (pre-publish validation phases).

## Frontend Resources

- [Streaming Generator Debug Guide](../frontend/DEBUG-STREAMING.md) - Debugging infrastructure per multi-step LLM generation streaming (XState v5, structured logging, MSW handlers, 17 test scenarios)
- [Tool Form Architecture](../frontend/TOOL-FORM-ARCHITECTURE.md) - Centralized, scalable form architecture for multi-step tools (eliminates ~600 LOC duplication, scales to N tools)
- [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) - Fonte canonica per linee guida visuali e UI kit
- [Frontend as-is](./02-design/specifications/frontend-spec.md) - Fonte canonica per registry UI, copy system centralizzato e regole di consistenza per interventi futuri
- [Frontend Unification Replication Guide](./02-design/specifications/frontend-unification-replication-guide.md) - Playbook operativo per replicare l'approccio unificante nel runtime e nelle pagine data-driven
- [Unified Frontend Data Access Layer](./02-design/adr/frontend-data-access-layer-adr.md) - Decisione architetturale sintetica sul data access layer unificato e sulle sue regole operative
- [Frontend Tool Pages Architecture (Unified)](./02-design/specifications/frontend-tool-pages-architecture-spec.md) - Target state post-refactoring: ToolPageTemplate, registry pattern, derivation logic, step-by-step per aggiungere nuovo tool

## Archivio Storico (99-lifecycle/99-archive/)

### Snapshot Precedenti
- [XState system as-is monolith spec](./99-lifecycle/99-archive/xstate-system-as-is-monolith-spec.md)
- [XState review closure snapshot 2026-04-24](./99-lifecycle/99-archive/xstate-review-closure-2026-04-24.md)
- [Frontend design artifact canvas snapshot 2026-04-26](./99-lifecycle/99-archive/frontend-design-artifact-canvas-snapshot-2026-04-26.md)

### Planning Pre-Publish (planning/)
Tutti i piani di lavoro pre-publish sono archiviati in `docs/99-lifecycle/99-archive/planning/`:
- `architecture-backend-go-1-snapshot-2026-04-24.md` (backend GO implementation)
- `feature-frontend-generation-tools-go-1-snapshot-2026-04-25.md` (frontend tool generation GO)
- `feature-frontend-ux-sprints-1-snapshot-2026-04-24.md` (frontend UX flow completion)
- `upgrade-xstate-go-gap-1-snapshot-2026-04-24.md` (XState v5 upgrade)
- `feature-projects-artifacts-backend-frontend-gap-1-snapshot-2026-04-25.md` (projects/artifacts integration)
- `frontend-development-plan-on-existing-backend-1-snapshot-2026-04-24.md` (frontend development)
- `process-projects-artifacts-ticket-breakdown-1-snapshot-2026-04-25.md` (ticket breakdown)
- `process-xstate-review-pr-checklist-1-snapshot-2026-04-24.md` (XState review process)
- `tool-unification-scalability-1-snapshot-2026-04-25.md` (tool unification)

### Governance Pre-Publish (governance-pre-publish/)
Sprint validation e code review pre-publish archiviati in `docs/99-lifecycle/99-archive/governance-pre-publish/`:
- `frontend-sprint-go-checklist-snapshot-2026-04-24.md` (sprint validation)
- `frontend-sprint-regression-policy-snapshot-2026-04-24.md` (sprint regression policy)
- `backend-auth-surface-review-snapshot-2026-04-25.md` (auth review, issue resolved)

## Note di governance applicate

- I documenti attivi restano in specifications e review; i documenti conclusi o pre-publish vanno in archive.
- I file markdown usano naming lowercase kebab-case con topic e tipo documento.
- In caso di rename o spostamento, gli indici e i link devono essere aggiornati nello stesso passaggio.
- Per cambiamenti frontend che toccano stile o visual design, la documentazione canonica da aggiornare è `docs/specifications/frontend-design-system-ui-kit-guide.md`.
- Tutti i file archiviati mantengono frontmatter con status=archived e data-archived per tracciabilità storica.
- `backend-auth-surface-review-snapshot-2026-04-25.md` (auth review, issue resolve