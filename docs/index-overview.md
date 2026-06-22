---
status: approved
version: 3.3
last-reviewed: 2026-06-22
next-review-date: 2026-09-22
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-06-20  
Stato: publication-ready  
Versione indice: 3.2

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

## Core-First Navigation (Agent Optimized)

Usa questo set minimo come percorso primario. Tutto il resto e storico o approfondimento.

1. [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
2. [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
3. [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)
4. [frontend-ui-ubiquitous-language-spec](./02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
5. [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md)
6. [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
7. [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md)
8. [tool-governance-tool-matrix](./07-governance/tool-governance-tool-matrix.md)

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

## Geometric Tool Documents

| Documento | Percorso | Tipo | Stato |
| --- | --- | --- | --- |
| [Geometric Crawling Step Reference](./99-reference/geometric-crawling-step-reference.md) | `99-reference/geometric-crawling-step-reference.md` | Reference | active |
| [Geometric Admin Debug & Monitoring Proposal](./02-design/geometric-admin-debug-monitoring-proposal.md) | `02-design/geometric-admin-debug-monitoring-proposal.md` | Proposal | draft |
| [SerpApi Integration Guide](./99-reference/serpapi-integration-guide.md) | `99-reference/serpapi-integration-guide.md` | Integration Guide | active |

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md) | active | 2026-05-11 | 2026-08-03 |
| [domain-bounded-context-map](./02-design/domain-bounded-context-map.md) | active | 2026-05-26 | 2026-08-03 |
| [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | active | 2026-05-26 | 2026-08-03 |
| [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) | approved | 2026-05-27 | 2026-08-16 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |

## Active Registry

### DDD Canonical References

- [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
- [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)

### Templates

- [tool-development-plan-template](./99-reference/templates/tool-development-plan-template.md) — canonical template for new Tool generation plans.

### Geometric Tool References

- [geometric-crawling-step-reference](./99-reference/geometric-crawling-step-reference.md) — **Backend operations reference for Geometric crawling step: XState actors, SerpApi adapter, ApiService resolution, merge actions, and validation guards**
- [geometric-operation-schematic](./99-reference/geometric-operation-schematic.md) — **Visual schematic of Geometric tool 4-step flow: crawling → scoring → strategic reporting → unified report**
- [serpapi-integration-guide](./99-reference/serpapi-integration-guide.md) — **SerpApi Google AI Overview integration: dual-channel crawling (SerpApi-only, no Puppeteer fallback), ApiService configuration, data normalization, and environment setup**

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
- [geometric-admin-debug-monitoring-proposal](./02-design/geometric-admin-debug-monitoring-proposal.md) — **Admin debug, AI Overview validation, error tracking, and monitoring proposal for Geometric tool**

Validation path manifest (orphan-check canonical set):

- docs/02-design/specifications/frontend-tool-pages-architecture-spec.md
- docs/02-design/specifications/tool-page-frontend-runtime-spec.md
- docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md
- docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md
- docs/02-design/specifications/frontend-design-system-ui-kit-guide.md
- docs/99-reference/templates/tool-development-plan-template.md

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)

### Active Plans And Runbooks

- [non-streaming-generation-migration-plan](../plan/migrate-to-nonstreaming-generation.md) — completato: migrazione del percorso di generazione tool da streaming (dormiente) a non-streaming (default); streaming SSE preservato per futuri usi

### Active Runbooks

- [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md) — covers dormant streaming path; non-streaming is now the default for tools
- [non-streaming-generation-migration-plan](../plan/migrate-to-nonstreaming-generation.md) — completed migration plan for coexistence of streaming (dormant) and non-streaming (default) generation paths

### Active Reviews

- [architecture-weaknesses-code-review](./07-governance/architecture-weaknesses-code-review.md)
- [frontend-ux-determinism-code-review](./07-governance/frontend-ux-determinism-code-review.md) — frontend UX unification and determinism review (2026-06-06)

### Open Findings — UX Determinism Review (for future implementation)

> Source: [frontend-ux-determinism-code-review.md](./07-governance/frontend-ux-determinism-code-review.md) — Intervention Priority table, updated 2026-06-22.
> Finding #5 (B1), #13 (D2) e #14 (E2) closed 2026-06-22.

| # | Finding | Area | Effort | Status |
|---|---|------|--------|--------|
| 5 | B1 — Hardcoded copy residuals | Admin forms/tables/dashboard/navigation, Tool buttons, YT form | Incremental, per area | **resolved** — all strings centralized |
| 8 | A1 — Explicit error states in machines | `tool-page`, `briefing-upload`, `auth-session` machines | Sprint dedicato | open — context refactoring + viewModel + 15+ files |
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
