<!-- llm-wiki-log-header-start -->
# Wiki Operation Log

Every ingest, lint run, and maintenance operation is recorded here automatically. For a better experience, use the **Operation History** panel:
- Cmd+P → "View operation history"
- Or open from Settings → Auto Maintenance → Operation History

---
Append-only record of every wiki modification. Each entry starts with `## [YYYY-MM-DD] operation | Title` so it's grep-parseable.

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