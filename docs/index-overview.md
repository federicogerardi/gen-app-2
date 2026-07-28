---
status: approved
version: 5.3
date_created: 2026-05-07
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Documentation Archivist
type: reference
tags: [index, documentation, overview]
---

# Documentation Index Overview

Indice operativo as-is: stato canonico della documentazione pubblica del repository.

> Audit qualità documentale completato il 2026-07-23. 4 sprint di allineamento eseguiti:
> - Sprint 1: frontmatter compliance, status normalization, broken links
> - Sprint 2: versioni X.Y, date_created, type, tags, dev→03-development
> - Sprint 3: migrazione plan/→05-plans/, ../docs/ fix, README sezioni
> - Sprint 4: polish finale, tutte le sezioni allineate
>
> Stato finale: 115 documenti, 0 frontmatter issues, 0 broken links in active docs.

> **⚑ DDD GATE — Leggere prima di qualsiasi analisi o intervento**
>
> Questi documenti sono il riferimento primario obbligatorio per ogni sviluppatore, contributore, o revisore:
>
> 1. [Domain Ubiquitous Language Glossary](./01-requirements/domain-ubiquitous-language-glossary.md) — vocabolario canonico su 6 bounded context
> 2. [Domain Bounded Context Map](./02-design/domain-bounded-context-map.md) — responsabilità, confini e regole di traduzione cross-context
> 3. [Domain Naming Decision Log](./07-governance/domain-naming-decision-log.md) — 230+ DDD entry
> 4. [Documentation Governance DDD and UL](./07-governance/documentation-ddd-ul-governance.md) — regole canoniche (v2.0)
>
> Regola invariante: nessun termine nuovo può entrare nel codice o nella documentazione senza una voce `DDD-NNN` nel decision log.

## Snapshot Operativo

- Scope: as-is state — public repository
- Root documentale: docs/ (118 documenti, 8 sezioni)
- Last audit: 2026-07-23
- Next review: 2026-10-23

## Core-First Navigation (Agent Optimized)

Usa questo set minimo come percorso primario. Tutto il resto è storico o approfondimento.

1. [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
2. [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
3. [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)
4. [documentation-ddd-ul-governance](./07-governance/documentation-ddd-ul-governance.md) — **governance documentale canonica (v2.0)**
5. [frontend-ui-ubiquitous-language-spec](./02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
6. [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md)
7. [tool-generation-flow-source-of-truth-spec](./02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
8. [unified-architectural-vulnerabilities-review](./07-governance/unified-architectural-vulnerabilities-review.md) — **architectural vulnerabilities + monolith decomposition (completed)**
9. [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md)
10. [production-observability-runbook](./04-testing/production-observability-runbook.md)
11. [prompt-template-standards](./03-development/prompt-template-standards.md) — **canonical guide for LLM prompt templates**

## Section Map

| Sezione | Entry point | Owner | Note |
| --- | --- | --- | --- |
| 00-overview | [index-overview](./index-overview.md) | Documentation Archivist | |
| 01-requirements | [01-requirements](./01-requirements/) | Product + Frontend Platform | |
| 02-design | [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) | Frontend Platform Team | |
| 03-development | [llm-model-override-configuration-guide](./03-development/llm-model-override-configuration-guide.md) | Backend Runtime | Development guides, configuration how-tos |
| 03-development | [prompt-template-standards](./03-development/prompt-template-standards.md) | Backend Runtime | **Canonical standards for LLM prompt templates — mandatory structure, language policy, quality gates** |
| 04-testing | [04-testing](./04-testing/) | QA + Engineering Team | |
| 07-governance | [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | Documentation Archivist | |
| 99-reference | [99-reference](./99-reference/) | Documentation Archivist | |
| 99-lifecycle | [99-lifecycle](./99-lifecycle/) | Documentation Archivist | |

> **Sezioni assenti intenzionalmente**: `05-` e `06-` non sono allocate — riservate per future espansioni (es. `05-operations/` per runbook deploy, `06-security/` per modelli di sicurezza). `08-`—`98-` non sono in uso; lo schema `NN-nome` usa numeri bassi per il core e `99-` per reference/archivio.

## Critical Documents Status

| Documento | Stato | Last reviewed | Next review |
| --- | --- | --- | --- |
| [critical-vulnerabilities-progressive-review](./07-governance/critical-vulnerabilities-progressive-review.md) | archived | 2026-07-23 | 2027-01-23 |
| [unified-architectural-vulnerabilities-review](./07-governance/unified-architectural-vulnerabilities-review.md) | completed | 2026-07-13 | 2026-10-13 |
| [ddd-implementation-audit](./07-governance/ddd-implementation-audit.md) | active | 2026-07-23 | 2027-01-23 |
| [xstate-as-aggregate-architectural-review](./07-governance/xstate-as-aggregate-architectural-review.md) | active | 2026-07-22 | 2026-10-22 |
| [documentation-ddd-ul-governance](./07-governance/documentation-ddd-ul-governance.md) | active | 2026-07-23 | 2026-10-23 |
| [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md) | active | 2026-07-16 | 2026-10-16 |
| [domain-bounded-context-map](./02-design/domain-bounded-context-map.md) | active | 2026-07-16 | 2026-10-16 |
| [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md) | active | 2026-07-16 | 2026-08-16 |
| [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md) | approved | 2026-05-27 | 2026-08-16 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | accepted | 2026-04-27 | 2026-07-27 |
| [prompt-layer-quality-review](./02-design/prompt-layer-quality-review.md) | completed | 2026-07-23 | 2027-01-23 |
| [prompt-layer-remediation-plan](./05-plans/prompt-layer-remediation-plan.md) | completed | 2026-07-23 | 2027-01-23 |
| [prompt-template-standards](./03-development/prompt-template-standards.md) | approved | 2026-07-23 | 2027-01-23 |

## Active Registry

### DDD Canonical References

- [domain-ubiquitous-language-glossary](./01-requirements/domain-ubiquitous-language-glossary.md)
- [domain-bounded-context-map](./02-design/domain-bounded-context-map.md)
- [domain-naming-decision-log](./07-governance/domain-naming-decision-log.md)

### Templates

- [tool-development-plan-template](./99-reference/templates/tool-development-plan-template.md) — canonical template for new Tool generation plans.
- [prompt-template-standards](./03-development/prompt-template-standards.md) — **canonical standards for LLM prompt templates: mandatory structure, quality gates, onboarding checklist.**

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

- [plan-bullmq-prerequisites](./05-plans/plan-bullmq-prerequisites.md) — **IMPLEMENTED: BullMQ Prerequisites (RISK-2 event bridge + RISK-1 serialization)**
- [plan-post-bullmq-improvements](./05-plans/plan-post-bullmq-improvements.md) — **IMPLEMENTED: Post-BullMQ Improvements (RISK-5 dev guide, RISK-4 Zod, RISK-3 domain modules, RISK-6 inspector)**
- [sprint-4-core-architecture-resolution-implementation-plan](./05-plans/sprint-4-core-architecture-resolution-implementation-plan.md) — **IMPLEMENTED**: refactoring frontend reactive spaghetti (Phase 1) e decomposizione `GenerationSystem` (Phase 2) — code-verified 2026-07-23
- [sprint-5-context-migration-validation-implementation-plan](./99-lifecycle/99-archive/plans/sprint-5-context-migration-validation-implementation-plan.md) — completato: migrazione azioni e validazione contesto backend
- [sprint-6-error-actors-wiring-implementation-plan](./99-lifecycle/99-archive/plans/sprint-6-error-actors-wiring-implementation-plan.md) — completato: integrazione attori gestione errori route-specific
- [sprint-7-v7-nonstreaming-v6-progress-implementation-plan](./99-lifecycle/99-archive/plans/sprint-7-v7-nonstreaming-v6-progress-implementation-plan.md) — completato: unificazione streaming/non-streaming
- [migrate-to-nonstreaming-generation](./99-lifecycle/99-archive/plans/migrate-to-nonstreaming-generation.md) — completato: migrazione a non-streaming default
- [asset-domain-model-implementation-plan](./05-plans/asset-domain-model-implementation-plan.md) — completato: Asset domain model DDD-188→207
- [italian-docs-language-remediation-plan](./05-plans/italian-docs-language-remediation-plan.md) — **ACTIVE: Italian docs language remediation per governance language policy (8/15 translated)**
- [prompt-layer-remediation-plan](./05-plans/prompt-layer-remediation-plan.md) — **IMPLEMENTED 2026-07-23: All 4 phases complete. 34 prompt templates upgraded (anti-hallucination, chain awareness, persona rules, role/guardrails/checklists, feedback instructions, placeholder docs). Source: [prompt-layer-quality-review](./02-design/prompt-layer-quality-review.md).**

### Active Runbooks

- [streaming-generator-debug-runbook](./04-testing/streaming-generator-debug-runbook.md) — dormant streaming path; non-streaming is now the default for tools
- [production-observability-runbook](./04-testing/production-observability-runbook.md) — structured logging with pino, correlation IDs, Railway log queries

### Active Reviews

- [unified-architectural-vulnerabilities-review](./07-governance/unified-architectural-vulnerabilities-review.md) — **COMPLETED: consolidated vulnerabilities + monolith decomposition (Sprints 1-7)**
- [architecture-weaknesses-code-review](./07-governance/architecture-weaknesses-code-review.md)
- [ddd-implementation-audit](./07-governance/ddd-implementation-audit.md) — **DDD implementation audit (2026-07-22)**
- [xstate-as-aggregate-architectural-review](./07-governance/xstate-as-aggregate-architectural-review.md) — **XState-as-Aggregate risk review (2026-07-22)**
- [frontend-ux-determinism-code-review](./07-governance/frontend-ux-determinism-code-review.md) — frontend UX unification review (2026-06-06, verified 2026-07-23)
- [prompt-layer-quality-review](./02-design/prompt-layer-quality-review.md) — **COMPLETED: quality review of 34 prompt templates across 12 tools. Remediation plan fully implemented 2026-07-23. See [prompt-layer-remediation-plan](./05-plans/prompt-layer-remediation-plan.md).**

### Active Plans — Workspace UX Transformation

- [workspace-centric-ux-transformation-implementation-plan](./05-plans/workspace-centric-ux-transformation-implementation-plan.md) — **IMPLEMENTED**: workspace-centric UX (8 phases, all completed 2026-07-17, code-verified 2026-07-23). 2 minor gaps: `ToolReadinessBadge` missing, `calculateToolReadiness` renamed to `buildReadinessSnapshot`.
- [workspace-centric-ux-transformation-ai-executable-plan](./05-plans/workspace-centric-ux-transformation-ai-executable-plan.md) — **IMPLEMENTED**: AI-executable task decomposition (47 tasks, all completed 2026-07-17).
- [workspace-dashboard-ux-restyling-implementation-plan](./05-plans/workspace-dashboard-ux-restyling-implementation-plan.md) — **PARTIALLY IMPLEMENTED**: 15/19 tasks done. `FoundationToolsPanel` component missing (verified 2026-07-23).
- [feature-tool-output-personalization-1](./05-plans/feature-tool-output-personalization-1.md) — **NOT IMPLEMENTED**: 0/23 tasks done (verified 2026-07-23).
- [fix-geometric-duplicate-crawling-plan](./05-plans/fix-geometric-duplicate-crawling-plan.md) — **DRAFT v2.1: Unify Geometric routing — zero tool-specific exceptions. Elimina `routeIsGeometric`/`isNotGeometric` guard, routing step-type-based. Auto-chain preservata. DDD entry crawling→acquisition.**

### Active Proposals

- [proposal-be-driven-workflow-job-system](./02-design/proposal-be-driven-workflow-job-system.md) — **Proposal: BE-Driven Workflow Job System (BullMQ, DDD-226/DDD-227). Nuovo Aggregate Root `ToolWorkflowJob`. Prerequisiti implementati: [BullMQ Prerequisites](05-plans/plan-bullmq-prerequisites.md) ✅, [Post-BullMQ](05-plans/plan-post-bullmq-improvements.md) ✅. Fase 1 implementation plan: [feature-tool-workflow-job-system-fase-1](./05-plans/feature-tool-workflow-job-system-fase-1.md) 📝 — 22 file, 10 giorni, 15 AC. Code status: **0/22 file implementati** (verified 2026-07-24).**
- [proposal-tool-output-personalization](./02-design/proposal-tool-output-personalization.md) — **Proposal: output personalization, multi-variant generation, user taste profile, and feedback loop across all 8 tools. Code status: **0/5 pilastri implementati** (solo `generation_feedback` table + `FeedbackButtons` esistono). Verified 2026-07-23.**
- [geometric-admin-debug-monitoring-proposal](./02-design/geometric-admin-debug-monitoring-proposal.md) — **Proposal: admin debug & monitoring for Geometric crawling verification. Code status: **0/4 item implementati** (verified 2026-07-23).**

### Implemented Proposals

- [dashboard-workspace-centric-restyling-proposal](./02-design/specifications/dashboard-workspace-centric-restyling-proposal.md) — **Implemented 2026-07-23: Dashboard restyling with workspace-centric panels (code-verified)**
- [workspace-hub-restyling-proposal](./02-design/specifications/workspace-hub-restyling-proposal.md) — **Implemented 2026-07-23: Workspace Hub card-variant layout (code-verified)**
- [promote-to-asset-deterministic-mapping-review](./02-design/promote-to-asset-deterministic-mapping-review.md) — **Implemented 2026-07-23: Deterministic toolKey→assetType mapping (code-verified)**

- [llm-model-step-override-proposal](./02-design/llm-model-step-override-proposal.md) — **Implemented 2026-07-16: per-step LLM model override system (DDD-150/151/152)**
- [serp-api-integration-proposal](./02-design/serp-api-integration-proposal.md) — **Implemented 2026-07-16: SerpAPI replaces Puppeteer for Geometric crawling**
- [proposal-error-logging-and-ux-feedback](./02-design/proposal-error-logging-and-ux-feedback.md) — **Implemented 2026-07-16: structured logging for idempotency/proxy errors, proxy request correlation, UX feedback for timeout/conflict scenarios**
- [tool-proposal-blog-article-generator](./07-governance/tool-proposal-blog-article-generator.md) — **Implemented 2026-07-16: Blog Article Generator tool (3-step workflow, DDD-155/156/157)**
- **brief-generator** — **Implemented 2026-07-18: Brief Generator tool (DDD-208/209/210). Primitive tool producing `brief` assets from uploaded files. 14 files across contracts, backend, frontend.**
- **tov-generator** — **Implemented 2026-07-18: TOV Generator tool (DDD-211/212). Primitive tool producing `brand-voice` assets from uploaded files. First producer of `brand-voice` assets. 14 files across contracts, backend, frontend.**

### Open Findings — UX Determinism Review (for future implementation)

> Source: [frontend-ux-determinism-code-review.md](./07-governance/frontend-ux-determinism-code-review.md) — Intervention Priority table, updated 2026-07-23.

| # | Finding | Area | Effort | Status |
|---|---|------|--------|--------|
| 5 | B1 — Hardcoded copy residuals | Admin forms/tables/dashboard/navigation, Tool buttons, YT form | Incremental, per area | **resolved** — all strings centralized |
| 8 | A1 — Explicit error states in machines | `tool-page`, `briefing-upload`, `auth-session` machines | Sprint dedicato | **resolved** — Sprints 1–4, see [ADR-003](./02-design/adr/xstate-explicit-error-states-adr.md) |
| 10 | C1 — Two button systems | MUI vs native button convergence | Requires ADR | **partial** — CTA variant classes applied; full convergence deferred |
| 12 | E1 — Admin pages → `ListingTableSection` | `AdminUsersPage`, `AdminModelsPage`, `AdminApiServicesPage` | Component extension or abandonment | open — `ListingTableSection` exists but admin pages not yet migrated |
| 15 | A2 — Inline guards duplicating named guards | `tool-flow.machine.ts`, `generation-lifecycle.machine.ts` | Low effort | open — 3+3 inline + 3+1 named guards (mixed, verified 2026-07-23) |
| 16 | A6 — Briefing upload coupling | `briefing-upload.machine.ts` | Medium | open — push+pull coexist (verified 2026-07-23) |
| 17 | A7 — Missing `onError` handler | `tool-page.machine.ts` invoke | Low | **resolved** — handler exists at lines 391-396 (verified 2026-07-23) |
| 18 | B1b — `"Apri sessione"` hardcoded | `ArtifactDetailPage.tsx` | Low | **resolved** — string removed (verified 2026-07-23) |

### Governance Tables

- [documentation-ddd-ul-governance](./07-governance/documentation-ddd-ul-governance.md)
- [tool-governance-tool-matrix](./07-governance/tool-governance-tool-matrix.md)

## Archive Registry

Archive lifecycle area currently has no active markdown snapshots indexed.

---

## Application State

This documentation reflects the **as-is state** of the gen-app-2 application (last major refresh: 2026-07-23). Active implementation plans are in [05-plans/](./05-plans/). Historical planning and design iterations are archived in [99-lifecycle/](./99-lifecycle/).

### Key Invariants

- **DDD-first governance enforced**: all domain terms must be canonical per glossary + decision log
- **npm workspaces monorepo**: `apps/backend`, `apps/frontend`, `packages/contracts`, `packages/infra-db`
- **Railway deployment**: private-network same-origin topology (`frontend/server.mjs` proxy)
- **Shared contract authority**: `packages/contracts/src/index.ts` with compile-time parity guard
- **XState v5 orchestration**: `GenerationSystem` (backend aggregate root), `ToolPage` (frontend aggregate root)

---

## Governance Rules Applied

- **DDD-First Model**: All active documentation must reference canonical UL (glossary, BCM, decision log)
- **Documentation Governance v2.0** (2026-07-23): frontmatter integrity, language policy, link integrity, version format, document archetypes, lifecycle rules. See [documentation-ddd-ul-governance](./07-governance/documentation-ddd-ul-governance.md).
- Documenti attivi in aree operative; snapshot conclusi archiviati.
- Naming markdown: lowercase kebab-case con topic + doc-type.
- Rename/spostamenti: update link e indici nello stesso change set.
- Frontend visual source of truth: [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md).
