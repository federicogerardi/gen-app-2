---
status: approved
version: 4.1
last-reviewed: 2026-07-22
next-review-date: 2026-10-22
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-07-16  
Stato: publication-ready  
Versione indice: 3.8

Indice operativo as-is: stato canonico della documentazione pubblica del repository.

> **⚑ DDD GATE — Leggere prima di qualsiasi analisi o intervento**
>
> Questi tre documenti sono il riferimento primario obbligatorio per ogni sviluppatore, contributore, o revisore — sia su codice che su documentazione:
>
> 1. [Domain Ubiquitous Language Glossary](./01-requirements/domain-ubiquitous-language-glossary.md) — vocabolario canonico su 4 bounded context
> 2. [Domain Bounded Context Map](./02-design/domain-bounded-context-map.md) — responsabilità, confini e regole di traduzione cross-context
> 3. [Domain Naming Decision Log](./07-governance/domain-naming-decision-log.md) — decisioni nomenclatura approvate (DDD-001–DDD-212), termini deprecati e alias backward-compat. Asset Domain Model: DDD-188–DDD-212.
>
> Regola invariante: nessun termine nuovo può entrare nel codice o nella documentazione senza una voce `DDD-NNN` nel decision log.

## Snapshot Operativo

- Scope: as-is state — public repository
- Root documentale: docs/
- Last review date: 2026-05-21
- Next review date: 2026-08-07

## Core-First Navigation (Agent Optimized)

Usa questo set minimo come percorso primario. Tutto il resto e storico o approfondimento.

1. [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
2. [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
3. [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)
4. [frontend-ui-ubiquitous-language-spec](./02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
5. [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md)
6. [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
7. [critical-vulnerabilities-progressive-review](./07-governance/critical-vulnerabilities-progressive-review.md) — **🔥 URGENT: critical architectural vulnerabilities with progressive execution plan**
8. [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md)
9. [production-observability-runbook](./04-testing/production-observability-runbook.md)
10. [tool-governance-tool-matrix](./07-governance/tool-governance-tool-matrix.md)

## Section Map

| Sezione | Entry point | Owner |
| --- | --- | --- |
| 00-overview | [index-overview](./index-overview.md) | Documentation Archivist |
| 01-requirements | [01-requirements](./01-requirements/) | Product + Frontend Platform |
| 02-design | [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) | Frontend Platform Team |
| 04-testing | [04-testing](./04-testing/) | QA + Engineering Team |
| 07-governance | [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | Documentation Archivist |
| 99-reference | [99-reference](./99-reference/) | Documentation Archivist |
| 99-lifecycle | [99-lifecycle](./99-lifecycle/) | Documentation Archivist |

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [critical-vulnerabilities-progressive-review](./07-governance/critical-vulnerabilities-progressive-review.md) | active | 2026-07-08 | 2026-10-08 |
| [ddd-implementation-audit](./07-governance/ddd-implementation-audit.md) | active | 2026-07-22 | 2026-10-22 |
| [xstate-as-aggregate-architectural-review](./07-governance/xstate-as-aggregate-architectural-review.md) | active | 2026-07-22 | 2026-10-22 |
| [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md) | active | 2026-07-16 | 2026-10-16 |
| [domain-bounded-context-map](./02-design/domain-bounded-context-map.md) | active | 2026-07-16 | 2026-10-16 |
| [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | active | 2026-07-16 | 2026-08-16 |
| [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) | approved | 2026-05-27 | 2026-08-16 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |

## Active Registry

### DDD Canonical References

- [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
- [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)

### Templates

- [tool-development-plan-template](./99-reference/templates/tool-development-plan-template.md) — canonical template for new Tool generation plans.

### Design Specifications

- [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md)
- [frontend-ui-ubiquitous-language-spec](./02-design/specifications/frontend-ui-ubiquitous-language-spec.md) — **UI naming/page archetype governance and DDD-081 blocking-vs-advisory semantics**
- [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) — **Tool Workspace architecture and Tool Input File Requirement Policy (DDD-081)**
- [tool-page-frontend-runtime-spec](./02-design/specifications/tool-page-frontend-runtime-spec.md) — **AI-first deterministic reference for Tool Page runtime and DDD-081 CTA gating contracts**
- [admin-changelog-and-user-reporting-spec](./02-design/specifications/admin-changelog-and-user-reporting-spec.md) — **DDD-first implemented specification for ProductChangelog, UserReport, and FeedbackCenterMachine**
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) — **Operational deployment architecture, networking, proxy headers, rollback**
- [dependency-unification-proposal](./02-design/specifications/dependency-unification-proposal.md) — **Ranked proposal for dependency-slot allocation focused on code unification (Zod + Kysely implemented; Ky pending)**
- [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md) — **Source of truth for ToolPage state (DDD-aligned, including DDD-081 readiness branches)**
- [session-aggregation-implementation-guide](./02-design/session-aggregation-implementation-guide.md)

Validation path manifest (orphan-check canonical set):

- docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
- docs/02-design/specifications/tool-page-frontend-runtime-spec.md
- docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md
- docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md
- docs/02-design/specifications/frontend-design-system-ui-kit-guide.md
- docs/99-reference/templates/tool-development-plan-template.md

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)
- [xstate-explicit-error-states-adr](./02-design/adr/xstate-explicit-error-states-adr.md) — **ADR-003: Explicit Error States Pattern for XState machines (Sprints 1–4)**

### Active Plans And Runbooks

- [plan-bullmq-prerequisites](../plan/plan-bullmq-prerequisites.md) — **📝 DRAFT: BullMQ Prerequisites (RISK-2 event bridge + RISK-1 serialization)**
- [plan-post-bullmq-improvements](../plan/plan-post-bullmq-improvements.md) — **📝 DRAFT: Post-BullMQ Improvements (RISK-5,3,4,6)**
- [sprint-4-core-architecture-resolution-implementation-plan](../plan/sprint-4-core-architecture-resolution-implementation-plan.md) — completato: refactoring frontend reactive spaghetti e decomposizione del contesto `GenerationSystem`
- [sprint-5-context-migration-validation-implementation-plan](../plan/sprint-5-context-migration-validation-implementation-plan.md) — completato: migrazione azioni e livello di validazione del contesto backend
- [sprint-6-error-actors-wiring-implementation-plan](../plan/sprint-6-error-actors-wiring-implementation-plan.md) — completato: integrazione attori per gestione errori route-specific e pulizia codice legacy
- [sprint-7-v7-nonstreaming-v6-progress-implementation-plan](../plan/sprint-7-v7-nonstreaming-v6-progress-implementation-plan.md) — completato: unificazione percorsi streaming e non-streaming (V7) ed eliminazione race condition stato progresso (V6)
- [non-streaming-generation-migration-plan](../plan/migrate-to-nonstreaming-generation.md) — completato: migrazione del percorso di generazione tool da streaming (dormiente) a non-streaming (default); streaming SSE preservato per futuri usi

### Active Runbooks

- [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md) — covers dormant streaming path; non-streaming is now the default for tools
- [non-streaming-generation-migration-plan](../plan/migrate-to-nonstreaming-generation.md) — completed migration plan for coexistence of streaming (dormant) and non-streaming (default) generation paths

### Active Reviews

- **[critical-vulnerabilities-progressive-review](./07-governance/critical-vulnerabilities-progressive-review.md) — ✅ COMPLETED: systematic vulnerabilities in partially decomposed monolith with progressive remediation roadmap (Sprints 1-7)**
- [architecture-weaknesses-code-review](./07-governance/architecture-weaknesses-code-review.md)
- [ddd-implementation-audit](./07-governance/ddd-implementation-audit.md) — **DDD implementation audit (2026-07-22): verifica bounded context, aggregate, value object, governance. Collegata alla Proposal BE-Driven Workflow Job System (BullMQ, DDD-226/DDD-227).**
- [xstate-as-aggregate-architectural-review](./07-governance/xstate-as-aggregate-architectural-review.md) — **XState-as-Aggregate risk review (2026-07-22): 6 rischi architetturali del pattern XState v5 come Aggregate Root. Analisi di impatto per Proposal BullMQ.**
- [frontend-ux-determinism-code-review](./07-governance/frontend-ux-determinism-code-review.md) — frontend UX unification and determinism review (2026-06-06)

### Active Proposals

- [proposal-be-driven-workflow-job-system](./02-design/proposal-be-driven-workflow-job-system.md) — **Proposal: BE-Driven Workflow Job System (BullMQ, DDD-226/DDD-227). Nuovo Aggregate Root `ToolWorkflowJob`. Piani collegati: [BullMQ Prerequisites](../plan/plan-bullmq-prerequisites.md), [Post-BullMQ](../plan/plan-post-bullmq-improvements.md).**
- [proposal-tool-output-personalization](./02-design/proposal-tool-output-personalization.md) — **Proposal: output personalization, multi-variant generation, user taste profile, and feedback loop across all 8 tools**
- [geometric-admin-debug-monitoring-proposal](./02-design/geometric-admin-debug-monitoring-proposal.md) — **Proposal: admin debug & monitoring for Geometric crawling verification, AI Overview validation, error tracking, and admin dashboard metrics**

### Implemented Proposals

- [llm-model-step-override-proposal](./02-design/llm-model-step-override-proposal.md) — **Implemented 2026-07-16: per-step LLM model override system (DDD-150/151/152)**
- [serp-api-integration-proposal](./02-design/serp-api-integration-proposal.md) — **Implemented 2026-07-16: SerpAPI replaces Puppeteer for Geometric crawling**
- [proposal-error-logging-and-ux-feedback](./02-design/proposal-error-logging-and-ux-feedback.md) — **Implemented 2026-07-16: structured logging for idempotency/proxy errors, proxy request correlation, UX feedback for timeout/conflict scenarios**
- [tool-proposal-blog-article-generator](./07-governance/tool-proposal-blog-article-generator.md) — **Implemented 2026-07-16: Blog Article Generator tool (3-step workflow, DDD-155/156/157)**
- **brief-generator** — **Implemented 2026-07-18: Brief Generator tool (DDD-208/209/210). Primitive tool producing `brief` assets from uploaded files. 14 files across contracts, backend, frontend.**
- **tov-generator** — **Implemented 2026-07-18: TOV Generator tool (DDD-211/212). Primitive tool producing `brand-voice` assets from uploaded files. First producer of `brand-voice` assets. 14 files across contracts, backend, frontend.**

### Open Findings — UX Determinism Review (for future implementation)

> Source: [frontend-ux-determinism-code-review.md](./07-governance/frontend-ux-determinism-code-review.md) — Intervention Priority table, updated 2026-06-22.
> Finding #5 (B1), #13 (D2) e #14 (E2) closed 2026-06-22.

| # | Finding | Area | Effort | Status |
|---|---|------|--------|--------|
| 5 | B1 — Hardcoded copy residuals | Admin forms/tables/dashboard/navigation, Tool buttons, YT form | Incremental, per area | **resolved** — all strings centralized |
| 8 | A1 — Explicit error states in machines | `tool-page`, `briefing-upload`, `auth-session` machines | Sprint dedicato | **resolved** — Sprints 1–4, see [ADR-003](./02-design/adr/xstate-explicit-error-states-adr.md) |
| 10 | C1 — Two button systems | MUI vs native button convergence | Requires ADR | **partial** — CTA variant classes applied; full convergence deferred |
| 12 | E1 — Admin pages → `ListingTableSection` | `AdminUsersPage`, `AdminModelsPage`, `AdminApiServicesPage` | Component extension or abandonment | open — inline editing, row selection, bindings panel not supported |

### Governance Tables

- [documentation-ddd-ul-governance](./07-governance/documentation-ddd-ul-governance.md)
- [tool-governance-tool-matrix](./07-governance/tool-governance-tool-matrix.md)

## Archive Registry

Archive lifecycle area currently has no active markdown snapshots indexed.

---

## Application State

This documentation reflects the **as-is state** of the gen-app-2 application at the time of publication (2026-05-07). There are currently no active plans in scope for public documentation. Historical planning and design iterations are archived in [Archive Registry](#archive-registry).

### Key Invariants

- **DDD-first governance enforced**: all domain terms must be canonical per glossary + decision log
- **npm workspaces monorepo**: `apps/backend`, `apps/frontend`, `packages/contracts`, `packages/infra-db`
- **Railway deployment**: private-network same-origin topology (`frontend/server.mjs` proxy)
- **Shared contract authority**: `packages/contracts/src/index.ts` with compile-time parity guard
- **XState v5 orchestration**: `GenerationSystem` (backend aggregate root, dual-mode: `generate` default / `stream` dormant), `ToolPage` (frontend aggregate root)

---

## Governance Rules Applied

- **DDD-First Model (2026-05-04)**: All active documentation must reference canonical UL (glossary, BCM, decision log). Technical specifications superseded by UL are archived according to lifecycle governance.
- Documenti attivi in aree operative; snapshot conclusi archiviati.
- Naming markdown: lowercase kebab-case con topic + doc-type.
- Rename/spostamenti: update link e indici nello stesso change set.
- Frontend visual source of truth: [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md).
