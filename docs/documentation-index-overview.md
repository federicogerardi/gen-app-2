# Documentation Index Overview

Data: 2026-04-26
Stato: Active

Indice operativo della documentazione as-is, organizzato per area e stato del documento.

## Specifiche attive (02-design/specifications/)

- [Frontend as-is](./02-design/specifications/frontend-spec.md)
- [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) - Fonte unica di verita per linee guida visuali, tokens, layout e componenti GUI
- [Frontend Tool Pages Architecture (Unified)](./02-design/specifications/frontend-tool-pages-architecture-spec.md) - **NEW**: Architettura unificata per tool pages, eliminazione duplicazione, scaling pattern per nuovi tool
- [GUI scope as-is](./02-design/specifications/gui-scope-as-is-spec.md)
- [Tool generation structural UX flow](./02-design/specifications/tool-generation-structural-ux-flow-spec.md)
- [XState system as-is blueprint index](./02-design/specifications/xstate-system-as-is-spec.md)
- [Deployment architecture guide](./02-design/specifications/deployment-architecture-guide.md) - Strategie deployment, opzioni platform, checklist pre-deployment

Nota frontend attiva:

- La specifica frontend include ora il contratto operativo per la centralizzazione di grafica e copy (`frontend/src/app/ui/primitives.tsx`, `frontend/src/styles.css`, `frontend/src/app/copy/system.ts`).
- La guida [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) e la fonte unica di verita per ogni intervento GUI visuale.
- La nuova specifica [Frontend Tool Pages Architecture](./02-design/specifications/frontend-tool-pages-architecture-spec.md) documenta il pattern **unificato** per le pagine dei tool di generazione (FunnelPages, NextLand, futuri tool). Elimina ~95% duplicazione di codice e consente l'aggiunta di nuovi tool in ~30 minuti. Target state post-refactoring.

Pacchetto atomizzato XState:

- [Cartella specifiche atomizzate XState](./02-design/specifications/xstate-system-as-is/)

## Review attive (07-governance/review/)

- [Frontend sprint go/no-go checklist](./07-governance/review/frontend-sprint-go-checklist.md)
- [Frontend sprint regression policy](./07-governance/review/frontend-sprint-regression-policy.md)
- [Tools generation go closure 2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md)

Nota review attiva (regressione chiusa):

- Regressione chaining step tools chiusa: step-by-step frontend ripristinato (step 1 -> step 2 auto-chain) con evidenze in [frontend-sprint-go-checklist.md](./07-governance/review/frontend-sprint-go-checklist.md) e [tools-generation-go-closure-2026-04-25.md](./07-governance/review/tools-generation-go-closure-2026-04-25.md).

## Code Review attive (07-governance/code-review/)

- [Backend auth surface review 2026-04-25](./07-governance/code-review/2026-04-25-backend-auth-review.md) - Alta priorita di implementazione: autenticare lato backend la generation route e derivare l'identita utente dalla sessione.

## Frontend Resources

- [Streaming Generator Debug Guide](../frontend/DEBUG-STREAMING.md) - Debugging infrastructure per multi-step LLM generation streaming (XState v5, structured logging, MSW handlers, 17 test scenarios)
- [Tool Form Architecture](../frontend/TOOL-FORM-ARCHITECTURE.md) - Centralized, scalable form architecture for multi-step tools (eliminates ~600 LOC duplication, scales to N tools)
- [Frontend Design System e UI Kit Guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md) - Fonte canonica per linee guida visuali e UI kit
- [Frontend as-is](./02-design/specifications/frontend-spec.md) - Fonte canonica per registry UI, copy system centralizzato e regole di consistenza per interventi futuri
- [Frontend Tool Pages Architecture (Unified)](./02-design/specifications/frontend-tool-pages-architecture-spec.md) - Target state post-refactoring: ToolPageTemplate, registry pattern, derivation logic, step-by-step per aggiungere nuovo tool

## Archivio (99-lifecycle/99-archive/)

- [XState system as-is monolith spec](./99-lifecycle/99-archive/xstate-system-as-is-monolith-spec.md)
- [XState review closure snapshot 2026-04-24](./99-lifecycle/99-archive/xstate-review-closure-2026-04-24.md)
- [Frontend design artifact canvas snapshot 2026-04-26](./99-lifecycle/99-archive/frontend-design-artifact-canvas-snapshot-2026-04-26.md)

## Piani correlati (fuori docs)

- [Upgrade XState go gap](../plan/upgrade-xstate-go-gap-1.md)
- [Process XState review PR checklist](../plan/process-xstate-review-pr-checklist-1.md)
- [Feature frontend UX sprints](../plan/feature-frontend-ux-sprints-1.md)

## Note di governance applicate

- I documenti attivi restano in review/specifications; i documenti conclusi o superseded vanno in archive.
- I file markdown usano naming lowercase kebab-case con topic e tipo documento.
- In caso di rename o spostamento, gli indici e i link devono essere aggiornati nello stesso passaggio.
- Per cambiamenti frontend che toccano stile o visual design, la documentazione canonica da aggiornare e `docs/specifications/frontend-design-system-ui-kit-guide.md`.
