---
status: approved
version: 2.0
last-reviewed: 2026-04-30
next-review-date: 2026-07-27
owner: Documentation Archivist
---

# Documentation Index Overview

Data: 2026-04-30
Stato: active
Versione indice: 2.0

Indice operativo as-is ottimizzato per scansione AI: contenuto deduplicato, sezioni stabili, priorita esplicite.

## Snapshot Operativo

- Scope: post-publish
- Root documentale: docs/
- Archivio storico: [99-lifecycle/99-archive](./99-lifecycle/99-archive/)
- Last review date: 2026-04-30
- Next review date: 2026-07-27

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
| [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md) | approved | 2026-04-28 | 2026-07-27 |
| [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md) | approved | 2026-04-27 | 2026-07-27 |
| [tools-generation-go-closure-2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md) | approved | 2026-04-27 | 2026-07-27 |

## Active Registry

### Design Specifications

- [frontend-spec](./02-design/specifications/frontend-spec.md)
- [frontend-unification-replication-guide](./02-design/specifications/frontend-unification-replication-guide.md)
- [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md)
- [frontend-tool-pages-architecture-spec](./02-design/specifications/frontend-tool-pages-architecture-spec.md)
- [gui-scope-as-is-spec](./02-design/specifications/gui-scope-as-is-spec.md)
- [tool-generation-structural-ux-flow-spec](./02-design/specifications/tool-generation-structural-ux-flow-spec.md)
- [xstate-system-as-is-spec](./02-design/specifications/xstate-system-as-is-spec.md)
- [xstate-system-as-is](./02-design/specifications/xstate-system-as-is/)
- [deployment-architecture-guide](./02-design/specifications/deployment-architecture-guide.md)

### Design ADR

- [frontend-data-access-layer-adr](./02-design/adr/frontend-data-access-layer-adr.md)

### Governance Review

- [tools-generation-go-closure-2026-04-25](./07-governance/review/tools-generation-go-closure-2026-04-25.md)

### Active Plans And Runbooks

- [infrastructure-same-origin-deployment-1](../plan/infrastructure-same-origin-deployment-1.md) - planned
- [repository-publication-cleanup-1](../plan/repository-publication-cleanup-1.md) - planned
- [railway-same-origin-migration-strategy-3-phases](./05-ops/railway-same-origin-migration-strategy-3-phases.md) - planned

### Frontend Supporting Docs

- [debug-streaming](../frontend/DEBUG-STREAMING.md)
- [tool-form-architecture](../frontend/TOOL-FORM-ARCHITECTURE.md)

## Archive Registry

### Direct Archive Snapshots

- [xstate-system-as-is-monolith-spec](./99-lifecycle/99-archive/xstate-system-as-is-monolith-spec.md)
- [xstate-review-closure-2026-04-24](./99-lifecycle/99-archive/xstate-review-closure-2026-04-24.md)
- [frontend-design-artifact-canvas-snapshot-2026-04-26](./99-lifecycle/99-archive/frontend-design-artifact-canvas-snapshot-2026-04-26.md)

### Archive Buckets

- [planning archive](./99-lifecycle/99-archive/planning/)
- [governance-pre-publish archive](./99-lifecycle/99-archive/governance-pre-publish/)
- [tool-prompts archive](./99-lifecycle/99-archive/tool-prompts/)

## Current Delta (2026-04-30)

- Frontend spec aggiornata: tema dark/light, rendering markdown artifact, semantica copy raw/markdown, resume da checkpoint.
- UI kit aggiornato: tema, toolbar artifact, consistenza bottoni.
- Tool pages architecture aggiornata: guardrail resume su step interrotto e request id rigenerato.
- Deployment architecture guide aggiornata: stato Railway as-is, networking pubblico, healthcheck e troubleshooting.
- Aggiunto piano attivo di cleanup pubblicazione repository: [repository-publication-cleanup-1](../plan/repository-publication-cleanup-1.md).

## Governance Rules Applied

- Documenti attivi in aree operative; snapshot conclusi e pre-publish in archive.
- Naming markdown: lowercase kebab-case con topic + doc-type.
- Rename/spostamenti: update link e indici nello stesso change set.
- Frontend visual source of truth: [frontend-design-system-ui-kit-guide](./02-design/specifications/frontend-design-system-ui-kit-guide.md).