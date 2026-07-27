---
type: index
tags:
  - wiki/index
date_created: 2026-07-27
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM + human co-maintained
---

# Wiki Index

Content catalog for the [[Wiki/overview|LLM Wiki]]. Start here for any query or operation.

## Sources

| File | Title | Date Ingested | Status |
|------|-------|---------------|--------|
| [[Wiki/sources/domain-ubiquitous-language-glossary\|domain-ubiquitous-language-glossary]] | Domain Ubiquitous Language Glossary | 2026-07-27 | active |
| [[Wiki/sources/domain-bounded-context-map\|domain-bounded-context-map]] | Domain Bounded Context Map | 2026-07-27 | active |
| [[Wiki/sources/domain-naming-decision-log\|domain-naming-decision-log]] | Domain Naming Decision Log | 2026-07-27 | active |
| [[Wiki/sources/frontend-ui-ubiquitous-language-spec\|frontend-ui-ubiquitous-language-spec]] | Frontend UI Ubiquitous Language Spec | 2026-07-28 | active |
| [[Wiki/sources/documentation-ddd-ul-governance\|documentation-ddd-ul-governance]] | Documentation DDD UL Governance | 2026-07-28 | active |
| [[Wiki/sources/xstate-as-aggregate-architectural-review\|xstate-as-aggregate-architectural-review]] | XState-as-Aggregate Architectural Review | 2026-07-28 | active |
| [[Wiki/sources/tool-generation-flow-source-of-truth-spec\|tool-generation-flow-source-of-truth-spec]] | Tool Generation Flow Source of Truth | 2026-07-28 | active |
| [[Wiki/sources/proposal-be-driven-workflow-job-system\|proposal-be-driven-workflow-job-system]] | BE-Driven Workflow Job System | 2026-07-28 | implemented |

## Entities

| File | Type | Sources | Last Updated |
|------|------|---------|--------------|
| [[Wiki/entities/generation-system\|GenerationSystem]] | aggregate-root | 3 | 2026-07-27 |
| [[Wiki/entities/artifact\|Artifact]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/workflow-step\|WorkflowStep]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/tool-page\|ToolPage]] | aggregate-root | 2 | 2026-07-27 |
| [[Wiki/entities/llm-model\|LlmModel]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/api-service\|ApiService]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/tool-workflow-job\|ToolWorkflowJob]] | aggregate-root | 2 | 2026-07-28 |
| [[Wiki/entities/readiness-snapshot\|ReadinessSnapshot]] | value-object | 2 | 2026-07-28 |

## Concepts

| File | Confidence | Sources | Last Updated |
|------|------------|---------|--------------|
| [[Wiki/concepts/tool-domain-concept\|Tool (domain concept)]] | high | 3 | 2026-07-27 |
| [[Wiki/concepts/bounded-context\|Bounded Context]] | high | 2 | 2026-07-27 |
| [[Wiki/concepts/ddd-governance\|DDD Governance]] | high | 3 | 2026-07-27 |
| [[Wiki/concepts/xstate-as-aggregate\|XState-as-Aggregate Pattern]] | high | 2 | 2026-07-28 |
| [[Wiki/concepts/ui-governance\|UI Governance]] | high | 2 | 2026-07-28 |
| [[Wiki/concepts/be-driven-workflow-execution\|BE-Driven Workflow Execution]] | high | 2 | 2026-07-28 |

## Synthesis

| File | Query / Topic | Date Created |
|------|---------------|--------------|
| — | — | — |

## Unprocessed Sources

### 01-requirements
- ~~`domain-ubiquitous-language-glossary`~~ ✔ ingested

### 02-design
- ~~`domain-bounded-context-map`~~ ✔ ingested
- ~~`frontend-ui-ubiquitous-language-spec`~~ ✔ ingested
- ~~`tool-generation-flow-source-of-truth-spec`~~ ✔ ingested
- ~~`proposal-be-driven-workflow-job-system`~~ ✔ ingested
- [[csrf-fail-closed-startup-invariant-adr]]
- [[frontend-data-access-layer-adr]]
- [[xstate-explicit-error-states-adr]]
- [[proposal-error-logging-and-ux-feedback]]
- [[proposal-tool-output-personalization]]
- [[serp-api-integration-proposal]]
- [[tool-page-frontend-runtime-spec]]
- [[frontend-tool-pages-architecture-spec]]
- [[geometric-admin-debug-monitoring-proposal]]
- [[llm-model-step-override-proposal]]
- [[promote-to-asset-deterministic-mapping-review]]
- [[prompt-layer-quality-review]]
- [[session-aggregation-implementation-guide]]
- [[tone-removal-brand-voice-delegation-plan]]
- ~12 more specs and proposals

### 03-development
- [[prompt-template-standards]]
- [[llm-model-override-configuration-guide]]

### 04-testing
- [[production-observability-runbook]]
- [[streaming-generator-debug-runbook]]

### 05-plans
- 12 implementation plans

### 07-governance
- ~~`domain-naming-decision-log`~~ ✔ ingested
- ~~`documentation-ddd-ul-governance`~~ ✔ ingested
- ~~`xstate-as-aggregate-architectural-review`~~ ✔ ingested
- [[architecture-weaknesses-code-review]]
- [[ddd-implementation-audit]]
- [[tool-governance-tool-matrix]]
- ~10 more audits, reviews, and proposals

### 99-reference / 99-lifecycle
- Reference guides and archived documents