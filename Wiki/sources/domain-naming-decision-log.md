---
type: source-summary
tags:
  - wiki/source
  - ddd/governance
  - ddd/naming
  - decision-log
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: LLM
source_file: docs/07-governance/domain-naming-decision-log.md
date_ingested: 2026-07-27
---

# Domain Naming Decision Log

Append-only governance log for domain naming decisions. Every canonical term must be logged before broad reuse. Decisions include rationale and propagation scope. Currently spans DDD-001 through DDD-227+.

## Decision Rules

- IDs are unique and immutable; revisions update existing rows or reference supersession
- Conflicting synonyms must be resolved here first
- New terms require a `DDD-NNN` entry before use in code, tests, docs, or comments

## Key Decision Families

### Identity & Naming (foundational)
- **DDD-001**: [[Artifact]] canonical (not Output, Result, Document)
- **DDD-029**: [[ToolKey]] promoted to cross-context canonical identifier; FE form registry type renamed `ToolFormKey`
- **DDD-026**: [[Tool]] defined as the cross-context organizing concept
- **DDD-C-005**: Resolved-documented naming convention divergence (kebab vs snake_case)

### Generation Lifecycle
- **DDD-033**: [[ArtifactRole]] — `'step'` and `'final'` classification
- **DDD-034**: [[ToolWorkflowPersistenceMetadata]] — JSON orchestration contract in artifact input
- **DDD-037**: [[WorkflowStepBootstrap]] — resume/regenerate checkpoint
- **DDD-047/048**: [[WorkflowSessionIdentifier]] and [[GenerationSession]] — session grouping
- **DDD-226/227**: [[ToolWorkflowJob]] and [[ToolWorkflowJobId]] — async execution (provisional)

### Step Execution
- **DDD-101**: [[WorkflowStepType]] — `extraction`, `generation`, `acquisition` (canonical); `crawling`, `scoring` (provisional, DDD-116)
- **DDD-035/036**: [[WorkflowStepUnlocked]] and [[WorkflowStepCompleted]] domain events

### LLM Model Management
- **DDD-053/054/055/056**: [[LlmModel]], [[LlmModelStatus]], [[LlmModelCatalog]], [[LlmModelId]]
- **DDD-150/151/152**: [[StepLlmModelOverrideConfig]], [[StepLlmModelResolver]], [[EffectiveModelResolution]]

### API & External Services
- **DDD-102/103/104/130**: [[ApiService]], [[ApiServiceAccessMode]], [[tokenHeaderName]]
- **DDD-087**: [[ApiServiceCatalog]] (provisional)

### GEOMETRIC Tool (provisional)
- **DDD-113/114/115**: [[AnalysisSession]], [[CrawlingJob]], [[CompetitorAnalysisContext]]
- **DDD-118**: [[QueryCluster]], [[BaseQuery]], [[PAAQuery]]
- **DDD-120/121/122/123/124**: [[StrategicReport]], [[UnifiedReport]], [[CrawlArtifact]], [[ScoringArtifact]], type-system boundary rules
- **DDD-145**: [[SerpScreenshot]] — **deprecated** (SerpApi-only architecture)

### Asset Domain Model
- **DDD-188 through DDD-207**: [[Asset]], [[AssetReference]], [[AssetFieldMapping]], brand voice injection

### Frontend Concepts
- **DDD-006/014**: [[ReadinessSnapshot]], [[ReadinessReasonCode]]
- **DDD-063/065**: Feedback channels (`inline-action`, `page-state`, `global`), issue publication policy
- **DDD-219/220/221**: LlmModelSelector repositioning in Knowledge Section

### Deprecations
- **DDD-216**: [[RequestTone]] and [[ToneProfile]] deprecated; tone now derived from `'brand-voice'` Assets
- **DDD-030/094**: `meta_ads` deprecated; reactivated as `meta_ads_generator`
- **DDD-145**: [[SerpScreenshot]] deprecated; SerpApi provides structured data without visual capture

## Source

- File: `docs/07-governance/domain-naming-decision-log.md`
- Version: 4.15
- Last reviewed: 2026-07-20
- Owner: Domain Architecture