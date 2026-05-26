---
status: approved
version: 2.9
last-reviewed: 2026-05-26
next-review-date: 2026-08-16
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-05-26  
Stato: publication-ready  
Versione indice: 2.9

Indice operativo as-is: stato canonico della documentazione pubblica del repository.

> **⚑ DDD GATE — Leggere prima di qualsiasi analisi o intervento**
>
> Questi tre documenti sono il riferimento primario obbligatorio per ogni sviluppatore, contributore, o revisore — sia su codice che su documentazione:
>
> 1. [Domain Ubiquitous Language Glossary](./01-requirements/domain-ubiquitous-language-glossary.md) — vocabolario canonico su 4 bounded context
> 2. [Domain Bounded Context Map](./02-design/domain-bounded-context-map.md) — responsabilità, confini e regole di traduzione cross-context
> 3. [Domain Naming Decision Log](./07-governance/domain-naming-decision-log.md) — decisioni nomenclatura approvate (DDD-001–DDD-095), termini deprecati e alias backward-compat
>
> Regola invariante: nessun termine nuovo può entrare nel codice o nella documentazione senza una voce `DDD-NNN` nel decision log.

## Snapshot Operativo

- Scope: as-is state — public repository
- Root documentale: docs/
- Last review date: 2026-05-21
- Next review date: 2026-08-07

## Section Map

| Sezione | Entry point | Owner |
| --- | --- | --- |
| 00-overview | [index-overview](./index-overview.md) | Documentation Archivist |
| 01-requirements | [01-requirements](./01-requirements/) | Product + Frontend Platform |
| 02-design | [frontend-spec](./02-design/specifications/frontend-spec.md) | Frontend Platform Team |
| 04-testing | [04-testing](./04-testing/) | QA + Engineering Team |
| 07-governance | [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | Documentation Archivist |
| 99-reference | [99-reference](./99-reference/) | Documentation Archivist |
| 99-lifecycle | [99-lifecycle](./99-lifecycle/) | Documentation Archivist |

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md) | active | 2026-05-11 | 2026-08-03 |
| [domain-bounded-context-map](./02-design/domain-bounded-context-map.md) | active | 2026-05-26 | 2026-08-03 |
| [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | active | 2026-05-26 | 2026-08-03 |
| [frontend-spec](./02-design/specifications/frontend-spec.md) | approved | 2026-04-27 | 2026-07-27 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |

## Active Registry

### DDD Canonical References

- [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
- [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)

### Templates

- [tool-development-plan-template](./99-reference/templates/tool-development-plan-template.md) — canonical template for new Tool generation plans.

**Visual representations**: [tool-generation-flow-generation-context](./02-design/tool-generation-flow-generation-context.md) provides Mermaid diagrams and cross-referenced documentation for the Generation context Tool flow, grounded in all 37 canonical DDD terms (DDD-001 through DDD-037).

### Design Specifications

- [frontend-spec](./02-design/specifications/frontend-spec.md) — **Start here for Frontend architecture (DDD-aligned)**
- [frontend-unification-replication-guide](./02-design/specifications/frontend-unification-replication-guide.md)
- [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md)
- [frontend-ui-ubiquitous-language-spec](./02-design/specifications/frontend-ui-ubiquitous-language-spec.md) — **UI naming/page archetype governance and DDD-081 blocking-vs-advisory semantics**
- [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) — **Tool Workspace architecture and Tool Input File Requirement Policy (DDD-081)**
- [tool-page-frontend-runtime-spec](./02-design/specifications/tool-page-frontend-runtime-spec.md) — **AI-first deterministic reference for Tool Page runtime and DDD-081 CTA gating contracts**
- [admin-changelog-and-user-reporting-spec](./02-design/specifications/admin-changelog-and-user-reporting-spec.md) — **DDD-first implemented specification for ProductChangelog, UserReport, and FeedbackCenterMachine**
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) — **Operational deployment architecture, networking, proxy headers, rollback**
- [gui-scope-as-is-spec](./02-design/specifications/gui-scope-as-is-spec.md)
- [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md) — **Source of truth for ToolPage state (DDD-aligned, including DDD-081 readiness branches)**
- [tool-generation-flow](./02-design/tool-generation-flow.md)
- [tool-generation-flow-generation-context](./02-design/tool-generation-flow-generation-context.md)
- [session-aggregation-implementation-guide](./02-design/session-aggregation-implementation-guide.md)

Validation path manifest (orphan-check canonical set):

- docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
- docs/02-design/specifications/tool-page-frontend-runtime-spec.md
- docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md
- docs/02-design/tool-generation-flow.md
- docs/02-design/tool-generation-flow-generation-context.md
- docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md
- docs/02-design/specifications/frontend-spec.md
- docs/99-reference/templates/tool-development-plan-template.md

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)

### Active Plans And Runbooks

- Nessun piano attivo al momento (sanitized per publication scope as-is).

### Active Runbooks

- [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md)
- [orchestrate-scalability-benchmark-2026-05-21](./04-testing/orchestrate-scalability-benchmark-2026-05-21.md)

### Active Reviews

- [architecture-weaknesses-code-review-2026-05-18](./07-governance/architecture-weaknesses-code-review-2026-05-18.md)
- [architecture-weaknesses-code-review-2026-05-21](./07-governance/architecture-weaknesses-code-review-2026-05-21.md)
- [architecture-weaknesses-code-review-severe-2026-05-21](./07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md)

### Governance Tables

- [tool-governance-tool-matrix](./07-governance/tool-governance-tool-matrix.md)

## Archive Registry

Archive folder is maintained for future reference and historical context. See [99-lifecycle/99-archive](./99-lifecycle/99-archive/).

### Archived Plans

- [feature-llm-model-catalog-plan-1](./99-lifecycle/99-archive/plans/feature-llm-model-catalog-plan-1.md)
- [feature-pagetool-artifact-aggregation-plan-1](./99-lifecycle/99-archive/plans/feature-pagetool-artifact-aggregation-plan-1.md)
- [feature-frontend-feedback-system-unification-plan-1](./99-lifecycle/99-archive/plans/feature-frontend-feedback-system-unification-plan-1.md)
- [feature-download-artifact-sessionsummary-plan-1](./99-lifecycle/99-archive/plans/feature-download-artifact-sessionsummary-plan-1.md)
- [feature-download-artifact-sessionsummary-1](./99-lifecycle/99-archive/plans/feature-download-artifact-sessionsummary-1.md)
- [feature-admin-changelog-user-reporting-1](./99-lifecycle/99-archive/plans/feature-admin-changelog-user-reporting-1.md)
- [feature-extraction-field-naming-runtime-convergence-1](./99-lifecycle/99-archive/plans/feature-extraction-field-naming-runtime-convergence-1.md)
- [feature-tool-page-file-instructions-1](./99-lifecycle/99-archive/plans/feature-tool-page-file-instructions-1.md)
- [feature-youtube-long-form-tool-plan-1](./99-lifecycle/99-archive/plans/feature-youtube-long-form-tool-plan-1.md)
- [github-architecture-plan](./99-lifecycle/99-archive/plans/github-architecture-plan.md)
- [architecture-csrf-fail-open-closure-1](./99-lifecycle/99-archive/plans/architecture-csrf-fail-open-closure-1.md)
- [process-auth-http-finding-closure-ddd-1](./99-lifecycle/99-archive/plans/process-auth-http-finding-closure-ddd-1.md)
- [process-hydration-briefing-coherence-finding-closure-1](./99-lifecycle/99-archive/plans/process-hydration-briefing-coherence-finding-closure-1.md)
- [process-hydration-parser-parity-finding-closure-1](./99-lifecycle/99-archive/plans/process-hydration-parser-parity-finding-closure-1.md)
- [process-orchestration-timeout-risk-closure-1](./99-lifecycle/99-archive/plans/process-orchestration-timeout-risk-closure-1.md)
- [process-quota-claim-conflict-finding-closure-1](./99-lifecycle/99-archive/plans/process-quota-claim-conflict-finding-closure-1.md)
- [process-tool-clone-benchmark-session-1](./99-lifecycle/99-archive/plans/process-tool-clone-benchmark-session-1.md)
- [process-tool-page-finding-closure-1](./99-lifecycle/99-archive/plans/process-tool-page-finding-closure-1.md)
- [process-toolkey-normalization-finding-closure-1](./99-lifecycle/99-archive/plans/process-toolkey-normalization-finding-closure-1.md)
- [refactor-backend-frontend-atomization-plan-1](./99-lifecycle/99-archive/plans/refactor-backend-frontend-atomization-plan-1.md)
- [refactor-backend-frontend-atomization-plan-2](./99-lifecycle/99-archive/plans/refactor-backend-frontend-atomization-plan-2.md)
- [refactor-admin-dashboard-frontend-1](./99-lifecycle/99-archive/plans/refactor-admin-dashboard-frontend-1.md)
- [refactor-auth-http-monolith-1](./99-lifecycle/99-archive/plans/refactor-auth-http-monolith-1.md)
- [refactor-backend-adapter-decomposition-1](./99-lifecycle/99-archive/plans/refactor-backend-adapter-decomposition-1.md)
- [refactor-frontend-listing-upload-cta-2pr-plan-1](./99-lifecycle/99-archive/plans/refactor-frontend-listing-upload-cta-2pr-plan-1.md)
- [refactor-frontend-page-preload-unification-1](./99-lifecycle/99-archive/plans/refactor-frontend-page-preload-unification-1.md)
- [refactor-frontend-sessionsummary-navigation-plan-1](./99-lifecycle/99-archive/plans/refactor-frontend-sessionsummary-navigation-plan-1.md)
- [refactor-frontend-tools-navbar-1](./99-lifecycle/99-archive/plans/refactor-frontend-tools-navbar-1.md)
- [refactor-generation-system-definition-1](./99-lifecycle/99-archive/plans/refactor-generation-system-definition-1.md)
- [refactor-toolpage-extraction-readiness-gate-plan-1](./99-lifecycle/99-archive/plans/refactor-toolpage-extraction-readiness-gate-plan-1.md)
- [upgrade-frontend-ui-unification-plan-1](./99-lifecycle/99-archive/plans/upgrade-frontend-ui-unification-plan-1.md)
- [refactor-architecture-weaknesses-remediation-1](./99-lifecycle/99-archive/plans/refactor-architecture-weaknesses-remediation-1.md)
- [refactor-auth-http-monolith-context-1](./99-lifecycle/99-archive/plans/refactor-auth-http-monolith-context-1.md)

### Archived Resources

- [youtube-lf-script-prompts-index-mapping](./99-lifecycle/99-archive/resources/youtube-lf-script-prompts/index-mapping.md)

---

## Application State

This documentation reflects the **as-is state** of the gen-app-2 application at the time of publication (2026-05-07). There are currently no active plans in scope for public documentation. Historical planning and design iterations are archived in [Archive Registry](#archive-registry).

### Key Invariants

- **DDD-first governance enforced**: all domain terms must be canonical per glossary + decision log
- **npm workspaces monorepo**: `apps/backend`, `apps/frontend`, `packages/contracts`, `packages/infra-db`
- **Railway deployment**: private-network same-origin topology (`frontend/server.mjs` proxy)
- **Shared contract authority**: `packages/contracts/src/index.ts` with compile-time parity guard
- **XState v5 orchestration**: `GenerationSystem` (backend aggregate root), `ToolPage` (frontend aggregate root)

---

## Governance Rules Applied

- **DDD-First Model (2026-05-04)**: All active documentation must reference canonical UL (glossary, BCM, decision log). Technical specifications superseded by UL are archived. See [ddd-first-docs-supersession-audit-2026-05-04](./07-governance/ddd-first-docs-supersession-audit-2026-05-04.md).
- Documenti attivi in aree operative; snapshot conclusi archiviati.
- Naming markdown: lowercase kebab-case con topic + doc-type.
- Rename/spostamenti: update link e indici nello stesso change set.
- Frontend visual source of truth: [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md).
