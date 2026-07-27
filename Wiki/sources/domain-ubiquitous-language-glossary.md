---
type: source-summary
tags:
  - wiki/source
  - ddd/glossary
  - ddd/ubiquitous-language
  - domain
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: LLM
source_file: docs/01-requirements/domain-ubiquitous-language-glossary.md
date_ingested: 2026-07-27
---

# Domain Ubiquitous Language Glossary

Canonical domain vocabulary for the `gen-app-2` workspace. Source of truth for domain terms used across analysis, development, testing, operations, and user documentation.

## Scope

Covers six bounded contexts: **Generation**, **Auth**, **Usage/Quota**, **Frontend/UI**, **Crawling & Extraction**, **Competitor Analysis**. All six are defined in the [[BCM]] ([[domain-bounded-context-map]]).

## Cross-Context Concepts

Key terms that span multiple bounded contexts:

- [[LlmModelId]] — canonical identifier for LLM endpoints, form `${provider}/${model}`
- [[Tool]] — a system instrument encapsulating a complete user-facing capability with an ordered [[WorkflowStep]] chain
- [[ToolKey]] — cross-context canonical identifier for a Tool (kebab-case, e.g. `funnel-pages`)
- [[ToolInputSource]] — types of Tool input: direct-input, tool-input-file, api-acquisition, project-asset
- [[ToolInputRequirementMatrix]] — requiredness policy spanning all input source families
- [[RequestTone]] — **deprecated** (DDD-216), superseded by Brand Voice asset injection
- [[ToneProfile]] — **deprecated** (DDD-216), superseded by asset-based tone injection
- [[ContextGenerationPhase]] — **provisional** — umbrella process for assembling Tool input context

Several coherence diagnostic concepts are **provisional**: [[ArtifactCoherenceDiagnostic]], [[ArtifactCoherenceScore]], [[ReadinessQualityGate]], [[ArtifactOutcomeStatus]].

## Generation Context Terms

The glossary defines 60+ terms in the Generation context, including:

| Term | Status | Summary |
|------|--------|---------|
| [[Artifact]] | canonical | Persisted output of a generation attempt with lifecycle tracking |
| [[ArtifactType]] | canonical | Category: `content`, `seo`, `code`, `extraction` (provisional: `analysis`, `crawl`) |
| [[ArtifactStatus]] | canonical | Lifecycle: `generating`, `completed`, `failed` |
| [[ArtifactRole]] | canonical | `'step'` (intermediate) or `'final'` (terminal output) |
| [[GenerationRequest]] | canonical | Input command initiating generation, carries `requestId`, `userId`, `toolKey`, etc. |
| [[ToolWorkflow]] | canonical | Snake_case routing identifier (e.g. `funnel_pages`, `extraction`) |
| [[WorkflowRunMode]] | canonical | `new`, `resume`, or `regenerate` |
| [[WorkflowStepType]] | canonical | Execution strategy: `extraction`, `generation`, `acquisition`, `crawling` (**provisional**), `scoring` (**provisional**) |
| [[GenerationSystem]] | canonical | XState aggregate root orchestrating end-to-end generation |
| [[ToolWorkflowJob]] | **provisional** | Async BullMQ-backed execution unit (DDD-226) |
| [[AnalysisSession]] | **provisional** | GEOMETRIC multi-query analysis aggregate (DDD-113) |
| [[ApiService]] | canonical | Admin-managed persisted external API source definition |
| [[ApiServiceAccessMode]] | canonical | `public`, `token`, `query-param` |
| [[LlmModelCatalog]] | canonical | Admin-managed collection of available LLM endpoints |
| [[StepLlmModelOverrideConfig]] | canonical | Static per-step model override configuration |

## Other Contexts

- **Crawling & Extraction** (provisional): [[CrawlingJob]] (aggregate root), [[QueryExtraction]], [[SerpSource]], [[SerpAIOverviewSnippet]]. Screenshots are **deprecated** (DDD-145 — SerpApi-only architecture).
- **Competitor Analysis** (provisional): [[CompetitorRanking]], [[GeoScore]], [[CompetitorTier]] (internal types not shared via contracts).

## Status Distribution

Many concepts introduced for the GEOMETRIC tool remain **provisional** (pending implementation). The glossary uses strict status labeling: `canonical`, `provisional`, `deprecated`.

## Source

- File: `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- Version: 2.23
- Last reviewed: 2026-07-20
- Owner: Domain Architecture