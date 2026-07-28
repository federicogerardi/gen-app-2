<!-- llm-wiki-log-header-start -->
# Wiki Operation Log

Every ingest, lint run, and maintenance operation is recorded here automatically. For a better experience, use the **Operation History** panel:
- Cmd+P → "View operation history"
- Or open from Settings → Auto Maintenance → Operation History

---
Append-only record of every wiki modification. Each entry starts with `## [YYYY-MM-DD] operation | Title` so it's grep-parseable.

## [2026-07-28] ingest | Fix Geometric Duplicate Crawling Plan (v2.1) — routing unification + 2 new concepts

Created source summary: [[Wiki/sources/fix-geometric-duplicate-crawling-plan]]. Created concept pages: [[Wiki/concepts/registry-driven-routing|Registry-Driven Routing]], [[Wiki/concepts/step-type-registry|STEP_TYPE_BY_TOOL_AND_STEP Registry]]. Updated [[Wiki/entities/generation-system|GenerationSystem]] entity with routing governance notes.

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] calibrate | Added source_version + Contradictions section to all 10 source summaries; updated AGENTS.md schema

Added `source_version` frontmatter field (version at ingest time, for stale detection) and `## Contradictions` section (defaulting to `None.`) to all 10 source summary pages. Updated AGENTS.md schema with these conventions.

## [2026-07-28] calibrate | Added source_version + Contradictions section to all 10 source summaries; updated AGENTS.md schema

Created source summaries: [[Wiki/sources/proposal-tool-output-personalization]], [[Wiki/sources/geometric-admin-debug-monitoring-proposal]], [[Wiki/sources/prompt-layer-quality-review]], [[Wiki/sources/session-aggregation-implementation-guide]], [[Wiki/sources/llm-model-override-configuration-guide]], [[Wiki/sources/tool-governance-tool-matrix]].

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] ingest | Batch 4 (4 sources): LLM override, Promote-to-Asset, Architecture weaknesses, Tone removal

Created source summaries: [[Wiki/sources/llm-model-step-override-proposal]], [[Wiki/sources/promote-to-asset-deterministic-mapping-review]], [[Wiki/sources/architecture-weaknesses-code-review]], [[Wiki/sources/tone-removal-brand-voice-delegation-plan]].

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] ingest | Batch 3 (4 sources): Error logging proposal, SERP API ADR, Prompt standards, Streaming debug runbook

Created source summaries: [[Wiki/sources/proposal-error-logging-and-ux-feedback]], [[Wiki/sources/serp-api-integration-proposal]], [[Wiki/sources/prompt-template-standards]], [[Wiki/sources/streaming-generator-debug-runbook]].

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] ingest | Batch 2 (4 sources): Runtime spec, ADR-001, CSRF ADR, Observability runbook

Created source summaries: [[Wiki/sources/tool-page-frontend-runtime-spec]], [[Wiki/sources/frontend-data-access-layer-adr]], [[Wiki/sources/csrf-fail-closed-startup-invariant-adr]], [[Wiki/sources/production-observability-runbook]].

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] ingest | 3-source batch: Frontend architecture spec, ADR-003, DDD audit

Created source summaries: [[Wiki/sources/frontend-tool-pages-architecture-spec]], [[Wiki/sources/xstate-explicit-error-states-adr]], [[Wiki/sources/ddd-implementation-audit]].

Created concept pages: [[Wiki/concepts/explicit-error-states-pattern|Explicit Error States Pattern]], [[Wiki/concepts/registry-driven-architecture|Registry-Driven Architecture]], [[Wiki/concepts/canonical-ui-state-derivation|Canonical UI State Derivation]].

Updated entity: [[Wiki/entities/tool-page|ToolPage]] (added frontend-tool-pages-architecture-spec source).

Documented 2 contradictions from audit: GAP-1 (ToolFormKey never implemented per DDD-029) and domain-events gap (inter-process events needed for BullMQ).

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] fix | Corrected tool-catalog Asset produces: meta-ads (ad-copy only, not hook), blog-article-generator (article only, not article-outline)

Added missing `produces` and `consumes` fields to all tools in [[Wiki/concepts/tool-catalog|Tool Catalog]].

## [2026-07-28] ingest | Tool refactoring batch: Fase 1 + Fase 2 plans + Tool Catalog

Created source summaries: [[Wiki/sources/feature-tool-workflow-job-system-fase-1]], [[Wiki/sources/feature-tool-workflow-job-system-fase-2]].

Created concept page: [[Wiki/concepts/tool-catalog|Tool Catalog]] — comprehensive reference of all 11 tools with [[ToolKey]], [[ToolWorkflow]], step sequences, step types, input sources, extraction fields, asset capabilities, and UI rendering rules.

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] ingest | 5-source batch: UI spec, doc governance, XState review, tool flow spec, BE-driven workflow proposal

Created source summaries: [[Wiki/sources/frontend-ui-ubiquitous-language-spec]], [[Wiki/sources/documentation-ddd-ul-governance]], [[Wiki/sources/xstate-as-aggregate-architectural-review]], [[Wiki/sources/tool-generation-flow-source-of-truth-spec]], [[Wiki/sources/proposal-be-driven-workflow-job-system]].

Created entity pages: [[Wiki/entities/tool-workflow-job|ToolWorkflowJob]], [[Wiki/entities/readiness-snapshot|ReadinessSnapshot]].

Created concept pages: [[Wiki/concepts/xstate-as-aggregate|XState-as-Aggregate Pattern]], [[Wiki/concepts/ui-governance|UI Governance]], [[Wiki/concepts/be-driven-workflow-execution|BE-Driven Workflow Execution]].

Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-28] schema | Added Obsidian in Development section to AGENTS.md

Added practical guidance for using Obsidian as a development tool: CLI quick reference, when to use Obsidian vs code tools, development flow integration, property navigation, and graph integration strategy.

## [2026-07-27] ingest | Domain Ubiquitous Language Glossary

Created source summary: [[Wiki/sources/domain-ubiquitous-language-glossary]].
Created entity pages: [[Wiki/entities/generation-system|GenerationSystem]], [[Wiki/entities/artifact|Artifact]], [[Wiki/entities/workflow-step|WorkflowStep]], [[Wiki/entities/llm-model|LlmModel]], [[Wiki/entities/api-service|ApiService]].
Created concept pages: [[Wiki/concepts/tool-domain-concept|Tool]], [[Wiki/concepts/bounded-context|Bounded Context]], [[Wiki/concepts/ddd-governance|DDD Governance]].
Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-27] ingest | Domain Bounded Context Map

Created source summary: [[Wiki/sources/domain-bounded-context-map]].
Updated entity page: [[Wiki/entities/tool-page|ToolPage]].
Updated concept pages: [[Wiki/concepts/bounded-context]], [[Wiki/concepts/ddd-governance]] with BCM content.
Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-27] ingest | Domain Naming Decision Log

Created source summary: [[Wiki/sources/domain-naming-decision-log]].
Updated all entity and concept pages with decision-log references.
Updated [[Wiki/index|index.md]] and [[Wiki/overview|overview.md]].

## [2026-07-27] scaffold | Initial wiki scaffold

Created Wiki/ directory structure: `sources/`, `entities/`, `concepts/`, `synthesis/`.
Created [[Wiki/index|index.md]], [[Wiki/log|log.md]], [[Wiki/overview|overview.md]].
Raw sources identified: ~70 files under `docs/`.
No sources ingested yet — awaiting calibration round.