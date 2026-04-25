# Documentation Index Overview

Data: 2026-04-25
Stato: Active

Indice operativo della documentazione as-is, organizzato per area e stato del documento.

## Specifiche attive

- [Frontend as-is](./specifications/frontend-spec.md)
- [GUI scope as-is](./specifications/gui-scope-as-is-spec.md)
- [XState system as-is blueprint index](./specifications/xstate-system-as-is-spec.md)
- [Tool prompts mockup pack](./specifications/tool-prompts/mockups/tool-prompts-mockup-overview-spec.md)
- [Deployment architecture guide](./specifications/deployment-architecture-guide.md) - Strategie deployment, opzioni platform, checklist pre-deployment

Nota frontend attiva:

- La specifica frontend include ora il contratto operativo per la centralizzazione di grafica e copy (`frontend/src/app/ui/primitives.tsx`, `frontend/src/styles.css`, `frontend/src/app/copy/system.ts`).

Pacchetto atomizzato XState:

- [Cartella specifiche atomizzate XState](./specifications/xstate-system-as-is/)

## Review attive

- [Frontend sprint go/no-go checklist](./review/frontend-sprint-go-checklist.md)
- [Frontend sprint regression policy](./review/frontend-sprint-regression-policy.md)
- [Tools generation go closure 2026-04-25](./review/tools-generation-go-closure-2026-04-25.md)

## Code Review attive

- [Backend auth surface review 2026-04-25](./code-review/2026-04-25-backend-auth-review.md) - Alta priorita di implementazione: autenticare lato backend la generation route e derivare l'identita utente dalla sessione.

## Frontend Resources

- [Streaming Generator Debug Guide](../frontend/DEBUG-STREAMING.md) - Debugging infrastructure per multi-step LLM generation streaming (XState v5, structured logging, MSW handlers, 17 test scenarios)
- [Tool Form Architecture](../frontend/TOOL-FORM-ARCHITECTURE.md) - Centralized, scalable form architecture for multi-step tools (eliminates ~600 LOC duplication, scales to N tools)
- [Frontend as-is](./specifications/frontend-spec.md) - Fonte canonica per registry UI, copy system centralizzato e regole di consistenza per interventi futuri

## Archivio

- [XState system as-is monolith spec](./archive/xstate-system-as-is-monolith-spec.md)
- [XState review closure snapshot 2026-04-24](./archive/xstate-review-closure-2026-04-24.md)

## Piani correlati (fuori docs)

- [Upgrade XState go gap](../plan/upgrade-xstate-go-gap-1.md)
- [Process XState review PR checklist](../plan/process-xstate-review-pr-checklist-1.md)
- [Feature frontend UX sprints](../plan/feature-frontend-ux-sprints-1.md)

## Note di governance applicate

- I documenti attivi restano in review/specifications; i documenti conclusi o superseded vanno in archive.
- I file markdown usano naming lowercase kebab-case con topic e tipo documento.
- In caso di rename o spostamento, gli indici e i link devono essere aggiornati nello stesso passaggio.
- Per cambiamenti frontend che toccano stile o testo utente, la documentazione canonica da aggiornare e `docs/specifications/frontend-spec.md`.
