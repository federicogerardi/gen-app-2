# Documentation Index Overview

Data: 2026-04-26
Stato: Active

Indice operativo della documentazione as-is, organizzato per area e stato del documento.

## Specifiche attive

- [Frontend as-is](./specifications/frontend-spec.md)
- [Frontend Design System e UI Kit Guide](./specifications/frontend-design-system-ui-kit-guide.md) - Fonte unica di verita per linee guida visuali, tokens, layout e componenti GUI
- [Frontend Tool Pages Architecture (Unified)](./specifications/frontend-tool-pages-architecture-spec.md) - **NEW**: Architettura unificata per tool pages, eliminazione duplicazione, scaling pattern per nuovi tool
- [GUI scope as-is](./specifications/gui-scope-as-is-spec.md)
- [XState system as-is blueprint index](./specifications/xstate-system-as-is-spec.md)
- [Tool prompts mockup pack](./specifications/tool-prompts/mockups/tool-prompts-mockup-overview-spec.md)
- [Deployment architecture guide](./specifications/deployment-architecture-guide.md) - Strategie deployment, opzioni platform, checklist pre-deployment

Nota frontend attiva:

- La specifica frontend include ora il contratto operativo per la centralizzazione di grafica e copy (`frontend/src/app/ui/primitives.tsx`, `frontend/src/styles.css`, `frontend/src/app/copy/system.ts`).
- La guida [Frontend Design System e UI Kit Guide](./specifications/frontend-design-system-ui-kit-guide.md) e la fonte unica di verita per ogni intervento GUI visuale.
- La nuova specifica [Frontend Tool Pages Architecture](./specifications/frontend-tool-pages-architecture-spec.md) documenta il pattern **unificato** per le pagine dei tool di generazione (FunnelPages, NextLand, futuri tool). Elimina ~95% duplicazione di codice e consente l'aggiunta di nuovi tool in ~30 minuti. Target state post-refactoring.
Pacchetto atomizzato XState:

- [Cartella specifiche atomizzate XState](./specifications/xstate-system-as-is/)

## Review attive

- [Frontend sprint go/no-go checklist](./review/frontend-sprint-go-checklist.md)
- [Frontend sprint regression policy](./review/frontend-sprint-regression-policy.md)
- [Tools generation go closure 2026-04-25](./review/tools-generation-go-closure-2026-04-25.md)

Nota review attiva (regressione chiusa):

- Regressione chaining step tools chiusa: step-by-step frontend ripristinato (step 1 -> step 2 auto-chain) con evidenze in [frontend-sprint-go-checklist.md](./review/frontend-sprint-go-checklist.md) e [tools-generation-go-closure-2026-04-25.md](./review/tools-generation-go-closure-2026-04-25.md).

## Code Review attive

- [Backend auth surface review 2026-04-25](./code-review/2026-04-25-backend-auth-review.md) - Alta priorita di implementazione: autenticare lato backend la generation route e derivare l'identita utente dalla sessione.

## Frontend Resources

- [Streaming Generator Debug Guide](../frontend/DEBUG-STREAMING.md) - Debugging infrastructure per multi-step LLM generation streaming (XState v5, structured logging, MSW handlers, 17 test scenarios)
- [Tool Form Architecture](../frontend/TOOL-FORM-ARCHITECTURE.md) - Centralized, scalable form architecture for multi-step tools (eliminates ~600 LOC duplication, scales to N tools)
- [Frontend Design System e UI Kit Guide](./specifications/frontend-design-system-ui-kit-guide.md) - Fonte canonica per linee guida visuali e UI kit
- [Frontend as-is](./specifications/frontend-spec.md) - Fonte canonica per registry UI, copy system centralizzato e regole di consistenza per interventi futuri
- [Frontend Tool Pages Architecture (Unified)](./specifications/frontend-tool-pages-architecture-spec.md) - Target state post-refactoring: ToolPageTemplate, registry pattern, derivation logic, step-by-step per aggiungere nuovo tool

## Archivio

- [XState system as-is monolith spec](./archive/xstate-system-as-is-monolith-spec.md)
- [XState review closure snapshot 2026-04-24](./archive/xstate-review-closure-2026-04-24.md)
- [Frontend design artifact canvas snapshot 2026-04-26](./archive/frontend-design-artifact-canvas-snapshot-2026-04-26.md)

## Piani correlati (fuori docs)

- [Upgrade XState go gap](../plan/upgrade-xstate-go-gap-1.md)
- [Process XState review PR checklist](../plan/process-xstate-review-pr-checklist-1.md)
- [Feature frontend UX sprints](../plan/feature-frontend-ux-sprints-1.md)

## Note di governance applicate

- I documenti attivi restano in review/specifications; i documenti conclusi o superseded vanno in archive.
- I file markdown usano naming lowercase kebab-case con topic e tipo documento.
- In caso di rename o spostamento, gli indici e i link devono essere aggiornati nello stesso passaggio.
- Per cambiamenti frontend che toccano stile o visual design, la documentazione canonica da aggiornare e `docs/specifications/frontend-design-system-ui-kit-guide.md`.
