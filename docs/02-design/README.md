# 02-design — Architecture & Design

Design specifications, ADRs, bounded context map, and proposals for the `gen-app-2` system.

## Canonical Documents

| Document | Type | Status |
|---|---|---|
| [domain-bounded-context-map.md](./domain-bounded-context-map.md) | bounded-context-map | active |

## ADRs

| Document | Type | Status |
|---|---|---|
| [adr/csrf-fail-closed-startup-invariant-adr.md](./adr/csrf-fail-closed-startup-invariant-adr.md) | adr | accepted |
| [adr/frontend-data-access-layer-adr.md](./adr/frontend-data-access-layer-adr.md) | adr | accepted |
| [adr/xstate-explicit-error-states-adr.md](./adr/xstate-explicit-error-states-adr.md) | adr | accepted |

## Specifications

| Document | Type | Status |
|---|---|---|
| [specifications/frontend-ui-ubiquitous-language-spec.md](./specifications/frontend-ui-ubiquitous-language-spec.md) | ui-governance-spec | active |
| [specifications/frontend-tool-pages-architecture-spec.md](./specifications/frontend-tool-pages-architecture-spec.md) | specification | approved |
| [specifications/tool-page-frontend-runtime-spec.md](./specifications/tool-page-frontend-runtime-spec.md) | ai-first-runtime-spec | active |
| [specifications/tool-generation-flow-source-of-truth-spec.md](./specifications/tool-generation-flow-source-of-truth-spec.md) | specification | active |
| [specifications/deployment-architecture-guide.md](./specifications/deployment-architecture-guide.md) | reference | approved |

## Active Proposals

| Document | Type | Status |
|---|---|---|
| [proposal-be-driven-workflow-job-system.md](./proposal-be-driven-workflow-job-system.md) | proposal | draft |
| [proposal-tool-output-personalization.md](./proposal-tool-output-personalization.md) | proposal | draft |
| [geometric-admin-debug-monitoring-proposal.md](./geometric-admin-debug-monitoring-proposal.md) | proposal | draft |

## Governance
Primary entry point for cross-context design decisions. All design docs must reference the canonical [DDD References](../07-governance/domain-naming-decision-log.md).