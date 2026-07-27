---
type: overview
tags:
  - wiki/overview
date_created: 2026-07-27
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM + human co-maintained
---

# Wiki Overview

High-level synthesis of the entire wiki. This page captures the big picture — patterns, themes, and cross-cutting insights that span multiple sources.

## Current State

**8 sources ingested**, 8 entity pages, 6 concept pages. The wiki now covers the foundational DDD governance, frontend UI governance, generation flow, and the BE-driven workflow job system.

## Domain Architecture Summary

`gen-app-2` is a monorepo application structured around DDD with six bounded contexts. The application is a suite of AI-powered **Tools** — each a named capability that chains LLM-powered workflow steps over structured user input to produce artifacts.

### Architecture Pattern

The architecture follows a **layered actor model**: XState v5 state machines are the aggregate roots ([[xstate-as-aggregate|XState-as-Aggregate pattern]]). The [[GenerationSystem]] is the top-level orchestrator spawning child actors for streaming, persistence, extraction, and multi-step tool execution. The [[ToolPage]] aggregate in Frontend mirrors this pattern for interaction ownership.

### Key Architectural Insights

1. **BE owns domain logic, FE owns interaction**: [[StepHydration]] is classified as a client-side projection, not a domain service (DDD-028). Step ordering authority is BE.

2. **Kebab vs snake_case is intentional**: [[ToolKey]] uses kebab-case, [[ToolWorkflow]] uses snake_case — a resolved-documented translation rule (DDD-C-005).

3. **BE-Driven workflow is now implemented**: The [[ToolWorkflowJob]] system (implemented 2026-07-24) replaces FE-driven HTTP loop with BullMQ-backed queued execution. Mitigated XState serialization and inter-process event bus risks via Redis-based solutions.

4. **UI Governance is formalized**: All frontend screens follow one of two archetypes, 3 CTA patterns, deterministic feedback channels, and a design token system with zero tolerance for hardcoded values.

5. **Documentation follows DDD-first governance**: Every `docs/` file has canonical frontmatter, 26 document `type` values, English-first language policy, and a strict lifecycle (draft → active → archived).

6. **Tone handling deprecated**: [[ToneProfile]] and [[RequestTone]] are deprecated (DDD-216). Tone derives from `'brand-voice'` [[Asset]] entities via [[AssetFieldMapping]].

## Navigation

- [[Wiki/index|Content Catalog]] — all sources, entities, concepts, and unprocessed inventory
- [[Wiki/log|Operations Log]] — full audit trail
- [[Wiki/concepts/bounded-context|Bounded Context]] — context boundaries
- [[Wiki/concepts/tool-domain-concept|Tool concept]] — the organizing principle
- [[Wiki/concepts/xstate-as-aggregate|XState-as-Aggregate]] — architecture pattern risks
- [[Wiki/concepts/ui-governance|UI Governance]] — frontend standards
- [[Wiki/concepts/be-driven-workflow-execution|BE-Driven Workflow]] — BullMQ job system