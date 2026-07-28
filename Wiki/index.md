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
| [[Wiki/sources/feature-tool-workflow-job-system-fase-1\|feature-tool-workflow-job-system-fase-1]] | ToolWorkflowJob Fase 1 Implementation Plan | 2026-07-28 | implemented |
| [[Wiki/sources/feature-tool-workflow-job-system-fase-2\|feature-tool-workflow-job-system-fase-2]] | ToolWorkflowJob Fase 2 Implementation Plan | 2026-07-28 | implemented |
| [[Wiki/sources/frontend-tool-pages-architecture-spec\|frontend-tool-pages-architecture-spec]] | Frontend Tool Pages Architecture Spec | 2026-07-28 | approved |
| [[Wiki/sources/xstate-explicit-error-states-adr\|xstate-explicit-error-states-adr]] | ADR-003: Explicit Error States | 2026-07-28 | accepted |
| [[Wiki/sources/ddd-implementation-audit\|ddd-implementation-audit]] | DDD Implementation Audit | 2026-07-28 | active |
| [[Wiki/sources/tool-page-frontend-runtime-spec\|tool-page-frontend-runtime-spec]] | Tool Page Frontend Runtime Spec | 2026-07-28 | active |
| [[Wiki/sources/frontend-data-access-layer-adr\|frontend-data-access-layer-adr]] | ADR-001: Unified Data Access Layer | 2026-07-28 | accepted |
| [[Wiki/sources/csrf-fail-closed-startup-invariant-adr\|csrf-fail-closed-startup-invariant-adr]] | CSRF Fail-Closed Startup Invariant | 2026-07-28 | accepted |
| [[Wiki/sources/production-observability-runbook\|production-observability-runbook]] | Production Observability Runbook | 2026-07-28 | active |
| [[Wiki/sources/proposal-error-logging-and-ux-feedback\|proposal-error-logging-and-ux-feedback]] | Error Logging and UX Feedback | 2026-07-28 | implemented |
| [[Wiki/sources/serp-api-integration-proposal\|serp-api-integration-proposal]] | SERP API Integration (ADRs) | 2026-07-28 | implemented |
| [[Wiki/sources/prompt-template-standards\|prompt-template-standards]] | Prompt Template Standards | 2026-07-28 | approved |
| [[Wiki/sources/streaming-generator-debug-runbook\|streaming-generator-debug-runbook]] | Streaming Generator Debug Runbook | 2026-07-28 | active |
| [[Wiki/sources/llm-model-step-override-proposal\|llm-model-step-override-proposal]] | LLM Model Step Override System | 2026-07-28 | implemented |
| [[Wiki/sources/promote-to-asset-deterministic-mapping-review\|promote-to-asset-deterministic-mapping-review]] | Promote-to-Asset Deterministic Mapping | 2026-07-28 | implemented |
| [[Wiki/sources/architecture-weaknesses-code-review\|architecture-weaknesses-code-review]] | Architecture Weaknesses Code Review | 2026-07-28 | active |
| [[Wiki/sources/tone-removal-brand-voice-delegation-plan\|tone-removal-brand-voice-delegation-plan]] | Tone Removal & Brand Voice Delegation | 2026-07-28 | completed |
| [[Wiki/sources/proposal-tool-output-personalization\|proposal-tool-output-personalization]] | Tool Output Personalization | 2026-07-28 | draft |
| [[Wiki/sources/geometric-admin-debug-monitoring-proposal\|geometric-admin-debug-monitoring-proposal]] | Geometric Admin Debug & Monitoring | 2026-07-28 | draft |
| [[Wiki/sources/prompt-layer-quality-review\|prompt-layer-quality-review]] | Prompt Layer Quality Review | 2026-07-28 | completed |
| [[Wiki/sources/session-aggregation-implementation-guide\|session-aggregation-implementation-guide]] | Session Aggregation Guide | 2026-07-28 | draft |
| [[Wiki/sources/llm-model-override-configuration-guide\|llm-model-override-configuration-guide]] | LLM Model Override Config Guide | 2026-07-28 | active |
| [[Wiki/sources/tool-governance-tool-matrix\|tool-governance-tool-matrix]] | Tool Governance Matrix | 2026-07-28 | active |
| [[Wiki/sources/fix-geometric-duplicate-crawling-plan\|fix-geometric-duplicate-crawling-plan]] | Unify Geometric Routing — Zero Tool-Specific Exceptions | 2026-07-28 | draft |

## Entities

| File | Type | Sources | Last Updated |
|------|------|---------|--------------|
| [[Wiki/entities/generation-system\|GenerationSystem]] | aggregate-root | 3 | 2026-07-27 |
| [[Wiki/entities/artifact\|Artifact]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/workflow-step\|WorkflowStep]] | entity | 3 | 2026-07-27 |
| [[Wiki/entities/tool-page\|ToolPage]] | aggregate-root | 3 | 2026-07-28 |
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
| [[Wiki/concepts/tool-catalog\|Tool Catalog (11 tools)]] | high | 5 | 2026-07-28 |
| [[Wiki/concepts/explicit-error-states-pattern\|Explicit Error States Pattern]] | high | 1 | 2026-07-28 |
| [[Wiki/concepts/registry-driven-architecture\|Registry-Driven Architecture]] | high | 1 | 2026-07-28 |
| [[Wiki/concepts/canonical-ui-state-derivation\|Canonical UI State Derivation]] | high | 1 | 2026-07-28 |
| [[Wiki/concepts/registry-driven-routing\|Registry-Driven Routing]] | high | 2 | 2026-07-28 |
| [[Wiki/concepts/step-type-registry\|STEP_TYPE_BY_TOOL_AND_STEP Registry]] | high | 1 | 2026-07-28 |

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
- ~~`frontend-tool-pages-architecture-spec`~~ ✔ ingested
- ~~`xstate-explicit-error-states-adr`~~ ✔ ingested
- ~~`tool-page-frontend-runtime-spec`~~ ✔ ingested
- ~~`frontend-data-access-layer-adr`~~ ✔ ingested
- ~~`csrf-fail-closed-startup-invariant-adr`~~ ✔ ingested
- ~~`proposal-error-logging-and-ux-feedback`~~ ✔ ingested
- ~~`serp-api-integration-proposal`~~ ✔ ingested
- ~~`llm-model-step-override-proposal`~~ ✔ ingested
- ~~`promote-to-asset-deterministic-mapping-review`~~ ✔ ingested
- ~~`tone-removal-brand-voice-delegation-plan`~~ ✔ ingested
- ~~`proposal-tool-output-personalization`~~ ✔ ingested
- ~~`geometric-admin-debug-monitoring-proposal`~~ ✔ ingested
- ~~`prompt-layer-quality-review`~~ ✔ ingested
- ~~`session-aggregation-implementation-guide`~~ ✔ ingested
- Remaining: ~8 archived specs and proposals in subdirectories

### 03-development
- ~~`prompt-template-standards`~~ ✔ ingested
- ~~`llm-model-override-configuration-guide`~~ ✔ ingested

### 04-testing
- ~~`production-observability-runbook`~~ ✔ ingested
- ~~`streaming-generator-debug-runbook`~~ ✔ ingested

### 05-plans
- ~~`feature-tool-workflow-job-system-fase-1`~~ ✔ ingested
- ~~`feature-tool-workflow-job-system-fase-2`~~ ✔ ingested
- Remaining: ~10 archived implementation plans

### 07-governance
- ~~`domain-naming-decision-log`~~ ✔ ingested
- ~~`documentation-ddd-ul-governance`~~ ✔ ingested
- ~~`xstate-as-aggregate-architectural-review`~~ ✔ ingested
- ~~`ddd-implementation-audit`~~ ✔ ingested
- ~~`architecture-weaknesses-code-review`~~ ✔ ingested
- ~~`tool-governance-tool-matrix`~~ ✔ ingested
- `fix-geometric-duplicate-crawling-plan` — NEW: geometric routing unification plan

### 99-reference / 99-lifecycle
- Remaining: ~8 archived reviews, audits, and proposals
- Remaining: reference guides and archived documents (low priority)