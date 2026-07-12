---
goal: Implement the canonical Geometric Tool (Generative Engine Optimization Analysis) with multi-step crawling, competitor scoring, and LLM strategic reporting
version: 1.7
date_created: 2026-06-12
last_updated: 2026-06-12
owner: Frontend Platform + Backend Runtime
status: Completed
tags: [feature, tool-workspace, backend, frontend, ddd, crawling, scoring, analysis, geometric, bullmq, puppeteer]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines the deterministic implementation of a new Tool with identity TOOL_KEY `geometric`, display label `Geometric`, and runtime behavior based on direct user-input payload assembly followed by a 4-step workflow: SERP crawling → competitor scoring → strategic reporting → unified report.

The tool introduces two new bounded contexts (Crawling & Extraction, Competitor Analysis) and two new `WorkflowStepType` values (`crawling`, `scoring`) designed for reuse by future SEO-domain tools.

The tool explicitly does not support file upload. Context generation is derived only from structured input fields (`baseQuery`, `language`, `country`) entered in Tool Workspace setup.

## 1. Requirements & Constraints

- **REQ-001**: Introduce canonical Tool identity values: TOOL_KEY `geometric`, TOOL_WORKFLOW `geometric_analysis`, TOOL_DISPLAY_LABEL `Geometric`.
- **REQ-002**: Register the new tool in shared contracts as the only source of truth for FE/BE mapping and step order.
- **REQ-003**: Implement deterministic 4-step workflow: `serp-crawling` (`crawling`) → `competitor-scoring` (`scoring`) → `strategic-reporting` (`generation`) → `unified-report` (`generation`, `artifactRole = 'final'`).
- **REQ-004**: No file upload is allowed for this tool; `ToolInputFileRequirementPolicy` is not used for start gating.
- **REQ-005**: Introduce `ArtifactType = 'crawl'` for SERP crawling artifacts, distinct from `ArtifactType = 'extraction'` to preserve `StepHydration` path integrity (DDD-122).
- **REQ-006**: Introduce `ArtifactType = 'analysis'` for scoring and reporting artifacts (DDD-121).
- **REQ-007**: Enforce one canonical relaunch and route-resolution path for Session Summary and Artifact relaunch surfaces.
- **REQ-008**: Add deterministic label and route resolution so `/sessionsummary` list/detail never exposes raw workflow identifiers.
- **REQ-009**: `AnalysisSession` groups artifacts from a multi-query analysis cycle (one `BaseQuery` + up to four `PAAQuery` entries). It is a parallel aggregate root to `GenerationSession` with different grouping semantics (DDD-113).
- **REQ-010**: `GeoScore` and `CompetitorTier` TypeScript types are internal to `CompetitorAnalysisContext` — not exposed via `packages/contracts`. Computed values cross the boundary as serialized JSON inside `ScoringArtifact` content (DDD-119, DDD-124).
- **REQ-011**: LLM reporting steps (`strategic-reporting`, `unified-report`) receive only `SerpAIOverviewSnippet` texts and `CompetitorRanking` JSON (token efficiency rule, DDD-120).
- **REQ-012**: Crawling must execute asynchronously via BullMQ job queue to avoid blocking the server. Each query crawl must respect `country` and `language` parameters.
- **REQ-013**: PAA queries are discovered dynamically during the base query crawl. Discovered PAA queries trigger additional crawl jobs within the same `AnalysisSession` (DDD-127).
- **REQ-014**: `AnalysisSessionIdentifier` is the canonical session identity for Geometric, distinct from `WorkflowSessionIdentifier`. Generated at session creation, stable through dynamic `QueryCluster` expansion (DDD-127).
- **REQ-015**: Resume/regenerate hydration recovers `baseQuery`, `language`, `country` from the `AnalysisSession` record directly — no `/api/tools/hydrate` call needed (DDD-126).
- **REQ-016**: `AnalysisSessionSummary` extends `SessionSummary` with `baseQuery`, `language`, `country` fields for user identification in listing (DDD-128).
- **REQ-017**: Export (`GeometricExport`) is a Frontend-only download operation over the `unified-report` final artifact content — not a `WorkflowStep` (DDD-123).
- **REQ-018**: Required input fields for this tool are mandatory and non-optional at dispatch boundary: `baseQuery`, `language`, `country` (DDD-125).
- **REQ-019**: XState machine coverage is mandatory for this tool rollout: backend and frontend machine transitions, guards, and actor boundaries must be explicitly mapped and updated where required.
- **REQ-020**: Runtime gate failures (crawl timeout, SERP parsing failure, scoring data insufficient, non-markdown LLM output) must map to deterministic machine events and explicit blocked/error state branches with recovery path.
- **SEC-001**: Reuse existing auth and tool availability checks on tools endpoints; unauthorized roles must receive canonical `403` error envelope.
- **SEC-002**: Puppeteer stealth browser must run with `--no-sandbox` in Docker/Railway deployment. Token credentials must never be exposed to Frontend.
- **DDD-001**: Before runtime implementation, add DDD decision entries for new Tool identity, step naming, ArtifactType extensions, and context boundaries; no local synonyms. (DDD-113 through DDD-128 already registered.)
- **DDD-002**: Update glossary and bounded-context map in the same change set as code registration. (Already done in v2.11 / v2.9.)
- **CON-001**: New npm dependencies required: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `bullmq`, `markdown-docx`. Lockfile regeneration required.
- **CON-002**: Keep changes localized to contracts, runtime registries, chain machines, tool config, routing, and tests.
- **GUD-001**: Reuse existing prompt module pattern under backend `tool-prompts` and existing tool-page factory in frontend.
- **GUD-002**: Chain machines (`crawlingChainMachine`, `scoringChainMachine`) follow the `acquisitionChainMachine` pattern: pass-through with typed input/output, immediate final state. Actual async work happens in `fromPromise` actors (`invokeCrawling`, `invokeScoring`) in `generation-system.actors.ts`.
- **GUD-003**: New step types (`crawling`, `scoring`) require merge actions in `toolWorkflowMachine` analogous to `mergeAcquisitionOutput`.
- **PAT-001**: Use shared contracts (`packages/contracts/src/tool-workflows.ts`) as single mapping authority.
- **PAT-002**: Follow `youtube-description` pattern for direct-input-only tool registration in frontend.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Validate DDD baseline and dependency inventory before any code changes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000A | Verify all DDD entries DDD-113 through DDD-128 are registered and consistent across Decision Log (v3.6), Glossary (v2.11), and BCM (v2.9). | Yes | 2026-06-12 |
| TASK-000B | Add new npm dependencies: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `bullmq`, `markdown-docx`. Run `npm install --workspaces --include-workspace-root` then `npm ci` sequence. | Yes | 2026-06-12 |
| TASK-000C | Validate plan-scope invariants against `docs/99-reference/templates/tool-development-plan-template.md`. | Yes | 2026-06-12 |

### Implementation Phase 1

- GOAL-001: Establish canonical contracts and domain type extensions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Extend `ARTIFACT_TYPES` in `packages/domain/src/index.ts` with `'crawl'` and `'analysis'` values. | Yes | 2026-06-12 |
| TASK-002 | Add Geometric tool definition to `packages/contracts/src/tool-workflows.ts` with ToolKey `geometric`, ToolWorkflow `geometric_analysis`, and 4-step sequence: `serp-crawling` (deps: []), `competitor-scoring` (deps: [`serp-crawling`]), `strategic-reporting` (deps: [`serp-crawling`, `competitor-scoring`]), `unified-report` (deps: [`strategic-reporting`, `competitor-scoring`]). **Note**: the `type` field (`crawling`, `scoring`, `generation`) is NOT defined in contracts `ToolWorkflowStepDefinition` — it is mapped at the backend registry level (TASK-009). | Yes | 2026-06-12 |
| TASK-003 | Extend tool availability map in `packages/contracts/src/tool-workflows.ts` with policy for `geometric` (default: `enabled-for-admin-only` for controlled rollout). | Yes | 2026-06-12 |
| TASK-004 | Add normalization aliases in `packages/contracts/src/tool-workflows.ts`: `geometric_analysis` → `geometric`, `geometric-analysis` → `geometric`. | Yes | 2026-06-12 |
| TASK-005 | Add `ExtractionFieldKey` entries `base_query`, `language`, `country` to `packages/contracts/src/extraction-fields.ts`. Also add three empty entries for `geometric` to satisfy `ToolKey`-typed records: `InstructionRequiredExtractionFieldKeysByTool['geometric'] = []`, `ReadinessRequiredExtractionFieldKeysByTool['geometric'] = []` (direct-input readiness is handled by Zod validation, not extraction field matrix), `LegacyExtractionFieldAliasByTool['geometric'] = {}`. | Yes | 2026-06-12 |
| TASK-006 | Update contract tests and parity guards for new ArtifactType values, tool/workflow normalization, and step-order integrity. | Yes | 2026-06-12 |

### Implementation Phase 2

- GOAL-002: Extend backend type system and registry.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Extend `WorkflowStepType` union in `apps/backend/src/lib/types/xstate.ts` with `'crawling'` and `'scoring'`. | Yes | 2026-06-12 |
| TASK-008 | Extend normalizers in `apps/backend/src/lib/runtime/workflow-normalizers.ts` with Geometric aliases and final-step mapping (`unified-report` → `artifactRole = 'final'`). **Also update**: (a) `FINAL_STEP_BY_TOOL` to add `'geometric': 'unified-report'`; (b) `StepMappedToolKey` type to include `'geometric'`; (c) `isStepMappedToolKey` guard to include `value === 'geometric'`. Without (b)+(c), `resolveToolStepArtifactRole` returns `null` for all geometric steps, breaking final artifact role resolution. | Yes | 2026-06-12 |
| TASK-009 | Update backend workflow registry in `apps/backend/src/lib/runtime/tool-workflow-registry.ts` to include Geometric plan and dependency resolution path. **Critical**: map `type` field for geometric `WorkflowStepDescriptor` entries. The current registry construction (riga 57-70) maps `key` + `dependencies` but NOT `type`. For geometric, add: `{ 'serp-crawling': 'crawling', 'competitor-scoring': 'scoring', 'strategic-reporting': 'generation', 'unified-report': 'generation' }`. Without `type` mapping, `toolWorkflowMachine` cannot distinguish crawling/scoring steps from generation steps, and merge actions (`mergeCrawlingOutput`, `mergeScoringOutput`) will not execute. | Yes | 2026-06-12 |
| TASK-010 | Add backend focused tests for tool identity normalization, step-order integrity, and final-step artifact role mapping. | Yes | 2026-06-12 |

### Implementation Phase 3

- GOAL-003: Implement Crawling & Extraction context (types + events + actors + chain machine + Puppeteer adapter + BullMQ queue).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011A | Add `CrawlingDoneOutput` and `CacheCrawlingResultParams` types to `apps/backend/src/lib/machines/generation-system.types.ts`. Pattern: follow `AcquisitionDoneOutput` / `CacheAcquisitionResultParams`. | ✅ | 2026-06-12 |
| TASK-011B | Add `getCrawlingDoneOutput()` and `getCrawlingResultParams()` helper functions to `apps/backend/src/lib/machines/generation-system.events.ts`. Pattern: follow `getAcquisitionDoneOutput` / `getAcquisitionResultParams`. | ✅ | 2026-06-12 |
| TASK-011C | Create `apps/backend/src/lib/machines/generation/crawling-chain.machine.ts` following the `acquisitionChainMachine` pattern: `setup()` with typed `context`, `input`, `output`; initial state `'done'` (immediate final); output discriminator `{ type: 'CRAWLING_COMPLETED', ... }`. Input shape: `{ requestId, stepKey, baseQuery, language, country, sessionId, analysisSessionIdentifier }`. Output shape: `{ type: 'CRAWLING_COMPLETED', requestId, stepKey, crawlArtifacts: CrawlArtifact[], paaQueries: PAAQuery[] }`. **NOT a multi-state machine** — the actual async work happens in the `fromPromise` actor (TASK-012). | ✅ | 2026-06-12 |
| TASK-012 | Add `invokeCrawling` `fromPromise` actor to `apps/backend/src/lib/machines/generation-system.actors.ts`. This actor orchestrates the full crawling flow: (1) calls `crawlSerp(baseQuery, language, country)` via `crawling.adapter.ts` to get base query results + discovered PAA queries; (2) if PAA queries discovered (max 4), calls `crawlSerp(paaQuery, language, country)` for each in parallel via `Promise.all`; (3) merges base + PAA results into a single `CrawlArtifact[]` array; (4) returns `CRAWLING_COMPLETED` output. The BullMQ job queue (`geometric-crawling`) is managed internally by the crawling adapter — the XState machine only sees a Promise. Update `GenerationSystemProvidedActor` union type to include the new actor entry. | ✅ | 2026-06-12 |
| TASK-012A | Create `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` with Puppeteer + stealth plugin. Methods: `crawlSerp(query, language, country)` → `CrawlingResult` (SerpAIOverviewSnippet + SerpSource list + SerpScreenshot path), `discoverPAAQueries(baseQuery, language, country)` → `PAAQuery[]`. | ✅ | 2026-06-12 |
| TASK-012B | Create `apps/backend/src/lib/runtime/integrations/crawling-queue.ts` with BullMQ queue `geometric-crawling`. Worker: concurrency 3 (env-configurable), retry 3 attempts with exponential backoff, progress reporting via `job.updateProgress()`. The queue is consumed by the `invokeCrawling` actor, NOT directly by XState. | ✅ | 2026-06-12 |
| TASK-013 | Update `toolWorkflowMachine` in `apps/backend/src/lib/machines/tool-workflow.machine.ts`: (a) add `mergeCrawlingOutput` action analogous to `mergeAcquisitionOutput` — checks `stepDescriptor?.type === 'crawling'` and merges crawling result into `assembledGenerationInput`; (b) add SERP source parsing helper if needed; (c) ensure `STEP_SUCCESS` actions array includes `mergeCrawlingOutput`. | ✅ | 2026-06-12 |
| TASK-014 | Add `crawlingOutputIsAccepted` guard to `apps/backend/src/lib/machines/generation-system.guards.ts`. Pattern: follow `acquisitionOutputIsAccepted` — checks `getCrawlingDoneOutput(event)?.type === 'CRAWLING_COMPLETED'`. | ✅ | 2026-06-12 |
| TASK-015 | Add `cacheCrawlingResult` action to `apps/backend/src/lib/machines/generation-system.actions.ts`. Pattern: follow `cacheAcquisitionResult` — merges crawling output payload into `requestInput` for downstream step consumption. | ✅ | 2026-06-12 |
| TASK-016 | Extend `context-generation-assembly.ts` with `mergeCrawlingIntoGenerationInput()` function. This merges SerpAIOverviewSnippet texts and SerpSource lists from crawling output into the generation input under a recognizable key: `requestInput.crawling = { sources: SerpSource[], snippets: SerpAIOverviewSnippet[], paaQueries: PAAQuery[] }`. This key structure allows `invokeScoring` (TASK-020) to extract crawling data via `assembledGenerationInput.crawling.sources`. Pattern: follow `mergeAcquisitionIntoGenerationInput`. | ✅ | 2026-06-12 |
| TASK-017 | Add backend tests for crawling chain machine (input/output type formatting), crawling adapter (mock browser, SERP parsing, screenshot capture, PAA click sequence), `invokeCrawling` actor (BullMQ integration, retry behavior), and `mergeCrawlingOutput` action in `toolWorkflowMachine`. | ✅ | 2026-06-12 |

### Implementation Phase 4

- GOAL-004: Implement Competitor Analysis context (types + events + actors + chain machine + scoring engine).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018A | Add `ScoringDoneOutput` and `CacheScoringResultParams` types to `apps/backend/src/lib/machines/generation-system.types.ts`. Pattern: follow `AcquisitionDoneOutput` / `CacheAcquisitionResultParams`. | ✅ | 2026-06-12 |
| TASK-018B | Add `getScoringDoneOutput()` and `getScoringResultParams()` helper functions to `apps/backend/src/lib/machines/generation-system.events.ts`. Pattern: follow `getAcquisitionDoneOutput` / `getAcquisitionResultParams`. | ✅ | 2026-06-12 |
| TASK-019 | Create `apps/backend/src/lib/machines/generation/scoring-chain.machine.ts` following the `acquisitionChainMachine` pattern: `setup()` with typed `context`, `input`, `output`; initial state `'done'` (immediate final); output discriminator `{ type: 'SCORING_COMPLETED', ... }`. Input shape: `{ requestId, stepKey, crawlArtifacts, sessionId }`. Output shape: `{ type: 'SCORING_COMPLETED', requestId, stepKey, ranking: CompetitorRanking }`. **NOT a multi-state machine** — the actual scoring computation happens in the `fromPromise` actor (TASK-020). | ✅ | 2026-06-12 |
| TASK-020 | Add `invokeScoring` `fromPromise` actor to `apps/backend/src/lib/machines/generation-system.actors.ts`. This actor wraps the scoring logic: (1) extracts SerpSource lists from `assembledGenerationInput.crawling.sources` (the key set by `mergeCrawlingIntoGenerationInput` in TASK-016); (2) calls `computeCompetitorRanking(sources)` via scoring engine; (3) returns `SCORING_COMPLETED` output. Update `GenerationSystemProvidedActor` union type to include the new actor entry. | ✅ | 2026-06-12 |
| TASK-021 | Create `apps/backend/src/lib/runtime/analysis/scoring-engine.ts` as pure function: group by domain, classify by SerpSourceType, compute weighted scores (organic +3.0, sitelink +2.0, video +2.0, sponsored +1.5), normalize to 1-10, assign tiers (TIER_1: 8-10, TIER_2: 5-7.9, TIER_3: 1-4.9). | ✅ | 2026-06-12 |
| TASK-022 | Update `toolWorkflowMachine` in `apps/backend/src/lib/machines/tool-workflow.machine.ts`: add `mergeScoringOutput` action analogous to `mergeAcquisitionOutput` — checks `stepDescriptor?.type === 'scoring'` and merges scoring result into `assembledGenerationInput`. Ensure `STEP_SUCCESS` actions array includes `mergeScoringOutput`. | ✅ | 2026-06-12 |
| TASK-023 | Add `scoringOutputIsAccepted` guard to `apps/backend/src/lib/machines/generation-system.guards.ts`. Pattern: follow `acquisitionOutputIsAccepted`. | ✅ | 2026-06-12 |
| TASK-024 | Add `cacheScoringResult` action to `apps/backend/src/lib/machines/generation-system.actions.ts`. Pattern: follow `cacheAcquisitionResult`. | ✅ | 2026-06-12 |
| TASK-025 | Add backend tests for scoring chain machine (input/output type formatting), scoring engine (weights, normalization, tier assignment, edge cases), `invokeScoring` actor, and `mergeScoringOutput` action in `toolWorkflowMachine`. | ✅ | 2026-06-12 |

### Implementation Phase 5

- GOAL-005: Prompt specification and gap analysis — integrate the real-world GEO Analyst prompt and identify missing tool capabilities.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-050 | Update `apps/backend/src/lib/runtime/tool-prompts/geometric/prompt_unified_report.md` with the full GEO Analyst prompt structure: title, query cluster, data analysis, 3 cross-cutting patterns (A/B/C), Tier-Based competitor ranking (Tier 1/2/3), strategic recommendations, and CSV dataset generation for Looker Studio. | ✅ | 2026-06-12 |
| TASK-051 | **Gap Analysis**: Identify missing fields compared to the prompt requirements. (a) `brandName` field: the prompt asks to highlight the client brand in SERP analysis — not present in tool. (b) `sourceType` classification: the prompt asks for organic/sitelink/video/sponsored/UGC breakdown — the crawling adapter only extracts title/url/snippet without type classification. (c) `currentDate`: the prompt requires "Data di Analisi" — not automatically injected. (d) CSV export: the prompt explicitly requires a CSV dataset block for Looker Studio — the tool only supports markdown/docx export. | ✅ | 2026-06-12 |
| TASK-052 | Add optional `brandName` field to Geometric direct input: (a) `ToolFormState` type in `tool-form-architecture.ts`; (b) `useToolForm.ts` default; (c) `ToolPageTemplate.tsx` form type, Zod schema, submit handler, render block; (d) `tool-page-selectors.ts` `buildGeometricDirectInputExtractionInfo` to include `brandName` in payload; (e) `generation-system.actors.ts` `invokeCrawling` to log and forward `brandName`; (f) `tool-workflow.machine.ts` `mergeCrawlingOutput` to preserve `brandName` in `assembledGenerationInput`; (g) `context-generation-assembly.ts` to include `brandName` in both `assembleStrategicReportingInput` and `assembleUnifiedReportInput`. | ✅ | 2026-06-12 |
| TASK-053 | Extend `crawling.adapter.ts` to extract and classify `sourceType` (organic, sitelink, video, sponsored, ugc, news) for each SERP result: (a) add `SourceType` union type; (b) update `CrawlingResult` with `sources[].sourceType`, `sources[].sitelinks`, `sources[].videoMeta`; (c) add `adsCount` and `videoCount` to result; (d) use Puppeteer selectors to detect sponsored blocks, video thumbnails, sitelink blocks, and UGC links (Reddit, Quora, forum). | ✅ | 2026-06-12 |
| TASK-054 | Inject `currentDate` into prompt context via `assembleStrategicReportingInput` and `assembleUnifiedReportInput` using `new Date().toLocaleDateString('it-IT')`. | ✅ | 2026-06-12 |
| TASK-055 | **Deferred**: CSV export / Looker Studio dataset generation — the prompt requires a CSV block but the tool architecture only supports markdown/docx. This requires a new export step or artifact type. Marked as future enhancement (post-MVP). | ⏸️ | 2026-06-12 |

### Implementation Phase 6

- GOAL-006: Enable frontend Tool Workspace, route mapping, and Session Summary parity for Geometric.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Add Geometric tool configuration in `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`: (a) `toolFormRegistry['geometric']` with `inputFiles: []`, `allowNoFiles: true`, `defaults: { baseQuery: '', language: 'it', country: 'google.it' }`; (b) `toolNavigationLabelByKey['geometric']` → `appCopy.ui.navigation.geometric`; (c) `toolNavigationDescriptionByKey['geometric']` → `appCopy.editorial.tools.geometric.description`; (d) `toolRouteByKey['geometric']` → `/tools/geometric`; (e) `stepCardConfigRegistry` entries for 4 steps. | ✅ | 2026-06-12 |
| TASK-027 | Add page wrapper `apps/frontend/src/features/tools/geometric/pages/GeometricToolPage.tsx` using `createToolPage('geometric')` factory. | ✅ | 2026-06-12 |
| TASK-028 | Register lazy route in `apps/frontend/src/app/routing/app-router.tsx` and include component mapping for `geometric` tool key. | ✅ | 2026-06-12 |
| TASK-029 | Update `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`: (a) add `isGeometricTool` flag; (b) add conditional rendering blocks for 3 direct-input fields (`baseQuery` TextField, `language` Select, `country` Select); (c) add Zod `superRefine` validation requiring all 3 fields non-empty. | ✅ | 2026-06-12 |
| TASK-030 | Add `buildGeometricDirectInputExtractionInfo()` in `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` and branch in `selectGenerationExtractionInfo()`: `if (toolKey === 'geometric' && directInputExtractionInfo) return directInputExtractionInfo`. | ✅ | 2026-06-12 |
| TASK-031 | Add copy entries in `apps/frontend/src/app/copy/system.ts`: navigation label, editorial tool description, field labels for `baseQuery`, `language`, `country`. | ✅ | 2026-06-12 |
| TASK-032 | Add frontend tests: tool registry (route/label), Tool Workspace (no file upload, 3 fields rendered, Zod validation), readiness (3 fields required), direct-input extraction info, session list/detail label rendering. | ✅ | 2026-06-12 |

### Implementation Phase 7

- GOAL-007: Wire reporting steps (LLM generation) and context assembly.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-033 | Extend `apps/backend/src/lib/machines/generation/context-generation-assembly.ts` with assembly logic for `strategic-reporting` (input: SerpAIOverviewSnippet + CompetitorRanking JSON) and `unified-report` (input: StrategicReport content + CompetitorRanking JSON). | ✅ | 2026-06-12 |
| TASK-034 | Create prompt module folder `apps/backend/src/lib/runtime/tool-prompts/geometric/` with `prompt_strategic_reporting.md` (Prompt A) and `prompt_unified_report.md` (Prompt B). | ✅ | 2026-06-12 |
| TASK-035 | Update prompt resolver map in `apps/backend/src/lib/runtime/tool-prompts/index.ts` to route Geometric steps to dedicated prompt files. | ✅ | 2026-06-12 |
| TASK-036 | Enforce token efficiency rule: `SerpScreenshot` data is NEVER forwarded to LLM — only text and structured JSON. | ✅ | 2026-06-12 |
| TASK-037 | Add backend tests for context assembly correctness (proper dependency artifact content extraction, no screenshot leakage). | ✅ | 2026-06-12 |

## 2b. Prompt Specifications (Deterministic)

This section is normative for prompt implementation.

### Prompt A - Strategic Reporting (from SERP data + competitor ranking)

- **PROMPT-A-001 (Objective)**: Generate a qualitative strategic analysis from SERP extraction data and competitor ranking.
- **PROMPT-A-002 (Input Source)**: `SerpAIOverviewSnippet` texts from crawling artifacts + `CompetitorRanking` JSON from scoring artifact.
- **PROMPT-A-004 (Language)**: Output in Italian (`it-IT`).

Prompt A mandatory output structure:

- **A-STR-001**: Executive summary of SERP landscape for the base query.
- **A-STR-002**: Competitor visibility analysis (which domains dominate, which are emerging).
- **A-STR-003**: Source type distribution analysis (organic vs sponsored vs video vs social).
- **A-STR-004**: Trend observations (patterns across PAA queries).
- **A-STR-005**: Operational recommendations for the brand (actionable, prioritized).
- **A-STR-006**: Quality self-check (completeness, actionability, specificity).

### Prompt B - Unified Report (strategic analysis + competitor tables)

- **PROMPT-B-001 (Objective)**: Combine the strategic analysis with quantitative competitor ranking into a single unified document.
- **PROMPT-B-002 (Input Source)**: StrategicReport content (Prompt A output) + CompetitorRanking JSON (scoring artifact).
- **PROMPT-B-004 (Language)**: Output in Italian (`it-IT`).

Prompt B mandatory output structure:

- **B-UNI-001**: Title and executive summary.
- **B-UNI-002**: Competitor ranking table (domain, score, tier, queries covered).
- **B-UNI-003**: Strategic analysis sections (from Prompt A, integrated).
- **B-UNI-004**: Source type breakdown with visual markers.
- **B-UNI-005**: Actionable recommendations (prioritized list).
- **B-UNI-006**: Appendix: raw SERP data summary (query list, source counts).

## 2c. XState Runtime Contract (Deterministic)

This section is normative for machine-level behavior.

### Architectural Pattern: Crawling/Scoring Step Execution

Crawling and scoring steps follow the same `acquisition` pattern already established in the codebase:

```
GenerationSystem (toolGenerationFlow)
  └─ invokes invokeToolWorkflow (toolWorkflowMachine)
       └─ toolWorkflowMachine manages step states
            └─ emits STEP_START for serp-crawling step
                 └─ GenerationSystem invokes invokeCrawling (fromPromise actor)
                      └─ invokeCrawling calls Puppeteer adapter + BullMQ queue
                      └─ BullMQ worker executes actual crawl
                      └─ invokeCrawling returns CRAWLING_COMPLETED
                 └─ GenerationSystem sends STEP_SUCCESS to toolWorkflowMachine
                      └─ toolWorkflowMachine runs mergeCrawlingOutput action
                      └─ crawling data merged into assembledGenerationInput
            └─ emits STEP_START for competitor-scoring step
                 └─ GenerationSystem invokes invokeScoring (fromPromise actor)
                      └─ invokeScoring calls scoring engine with crawling data
                      └─ invokeScoring returns SCORING_COMPLETED
                 └─ GenerationSystem sends STEP_SUCCESS to toolWorkflowMachine
                      └─ toolWorkflowMachine runs mergeScoringOutput action
                      └─ scoring data merged into assembledGenerationInput
            └─ emits STEP_START for strategic-reporting step
                 └─ GenerationSystem invokes invokeGeneration (existing actor)
                      └─ LLM receives assembledGenerationInput (crawling + scoring data)
            └─ emits STEP_START for unified-report step
                 └─ GenerationSystem invokes invokeGeneration (existing actor)
                      └─ LLM receives assembledGenerationInput (strategic-report + scoring data)
```

Key rule: **Chain machines are type formatters only.** The actual async work (Puppeteer, BullMQ, scoring engine) happens in `fromPromise` actors. This matches the existing `acquisitionChainMachine` / `invokeApiAcquisition` pattern.

### State/Event Mapping For Runtime Gates

| Gate Condition | Runtime Event | Expected Transition | Recovery Policy |
|---|---|---|---|
| Crawling timeout (SERP not loaded within 30s) | `invokeCrawling` onError | toolWorkflowMachine receives STEP_FAILURE → error state | Retry with backoff (max 3 attempts), then fail step |
| SERP parsing failed (no AI Overview element found) | `invokeCrawling` returns CRAWLING_FAILED | toolWorkflowMachine receives STEP_FAILURE → error state | Retry with adjusted selectors, then fail step |
| Anti-bot detection blocked browser | `invokeCrawling` onError | toolWorkflowMachine receives STEP_FAILURE → error state | Retry with fresh browser instance, then fail step |
| PAA discovery returned 0 queries | Non-blocking condition | Continue with base query data only | No failure — 0 PAA is valid |
| Scoring data insufficient (no SerpSource entries) | `invokeScoring` returns SCORING_FAILED | toolWorkflowMachine receives STEP_FAILURE → error state | Fail step — cannot score without source data |
| LLM output is JSON-shaped or non-markdown | `invokeGeneration` onError | toolWorkflowMachine receives STEP_FAILURE → error state | Retry generation, then fail step |
| Quality gates failed (strategic-reporting) | `invokeGeneration` returns GENERATE_TERMINATED_FAILURE | toolWorkflowMachine receives STEP_FAILURE → error state | Regenerate with refined context |
| Output language mismatch vs `it-IT` | `invokeGeneration` returns GENERATE_TERMINATED_FAILURE | toolWorkflowMachine receives STEP_FAILURE → error state | Regenerate with language constraint |

### Transition Determinism Rules

- Runtime gate failures must never produce implicit success transitions.
- Each step must preserve explicit transition branches (`running` → `completed` or blocked/error).
- Recovery must be event-driven (explicit retry/regenerate event), not context mutation side-effects.
- Any blocked/error branch must preserve deterministic relaunch semantics for artifact/session surfaces.
- PAA discovery is non-blocking: 0 PAA queries does not fail the crawling step.
- Chain machines (`crawlingChainMachine`, `scoringChainMachine`) are **pass-through only** — they format input/output types. They never contain business logic or async operations.

### BullMQ ↔ XState Integration Pattern

```
invokeCrawling (fromPromise actor in generation-system.actors.ts)
  └─ calls crawlSerp(baseQuery, language, country) via crawling.adapter.ts
       └─ crawling.adapter.ts adds job to BullMQ queue 'geometric-crawling'
            └─ BullMQ worker executes Puppeteer crawl
            └─ Worker returns result to crawling.adapter.ts
       └─ crawling.adapter.ts returns CrawlingResult to invokeCrawling
  └─ invokeCrawling returns { type: 'CRAWLING_COMPLETED', ... } to XState
```

The XState machine (`toolWorkflowMachine`) does NOT know about BullMQ. It only sees a `fromPromise` actor that returns a typed output. BullMQ is an implementation detail of the `invokeCrawling` actor, managed internally via the crawling adapter.

## 2d. PAA Discovery Flow (Deterministic)

```
1. crawlSerp(baseQuery) → returns SerpAIOverviewSnippet + SerpSource[] + discoveredPAAQueries[]
2. If discoveredPAAQueries.length > 0:
   a. For each PAA query (max 4):
      - Add crawling job to BullMQ queue with { query: paaQuery, isPaa: true, ... }
      - Wait for all PAA jobs to complete (Promise.all)
   b. Merge all PAA crawl results into crawlArtifacts array
3. Return CRAWLING_COMPLETED with all artifacts (base + PAA)
```

The `analysisSessionIdentifier` (DDD-127) ensures all dynamically discovered PAA crawl jobs are associated with the parent session.

## 3. Alternatives

- **ALT-001**: Implement as extraction-based tool with briefing upload. Rejected because Geometric uses direct-input-only context (base query + language + country).
- **ALT-002**: Reuse existing `extraction` ArtifactType for crawling artifacts. Rejected because it would break `StepHydration` path integrity (DDD-122).
- **ALT-003**: Implement crawling synchronously within XState without BullMQ. Rejected because crawling is async and potentially long-running (10-30s per query); a queue prevents thread blocking and enables retry.
- **ALT-004**: Create separate `AnalysisSession` database table. Rejected because `AnalysisSession` is a `GenerationSession` with `toolKey = 'geometric'`; the existing session infrastructure handles it automatically.
- **ALT-005**: Use Playwright instead of Puppeteer. Rejected because Puppeteer + stealth plugin has more mature anti-bot evasion ecosystem; Playwright stealth is less battle-tested for Google SERP.

## 4. Dependencies

- **DEP-001**: DDD entries DDD-113 through DDD-128 in `docs/07-governance/domain-naming-decision-log.md`.
- **DEP-002**: Glossary v2.11 in `docs/01-requirements/domain-ubiquitous-language-glossary.md`.
- **DEP-003**: BCM v2.9 in `docs/02-design/domain-bounded-context-map.md`.
- **DEP-004**: Shared contract authority in `packages/contracts/src/tool-workflows.ts`.
- **DEP-005**: New npm dependencies: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `bullmq`, `markdown-docx`.
- **DEP-006**: Existing Redis infrastructure for BullMQ queue (already used for idempotency, quota, stream sessions).
- **DEP-007**: Existing `acquisition-chain.machine.ts` pattern as template for crawling/scoring chain machines (pass-through with typed input/output).
- **DEP-008**: Existing `invokeApiAcquisition` `fromPromise` actor pattern as template for `invokeCrawling` and `invokeScoring` actors.
- **DEP-009**: Existing `mergeAcquisitionOutput` action in `toolWorkflowMachine` as template for `mergeCrawlingOutput` and `mergeScoringOutput` actions.
- **DEP-010**: Existing `youtube-description` pattern for direct-input-only frontend registration.

## 5. Files

- **FILE-001**: `packages/domain/src/index.ts` — Extend `ARTIFACT_TYPES` with `'crawl'` and `'analysis'`.
- **FILE-002**: `packages/contracts/src/tool-workflows.ts` — Register Geometric tool definition, availability policy, normalization aliases.
- **FILE-003**: `packages/contracts/src/extraction-fields.ts` — Add `base_query`, `language`, `country` field keys.
- **FILE-004**: `packages/contracts/src/parity.guard.ts` — Auto-verify FE/BE type alignment (no manual changes).
- **FILE-005**: `apps/backend/src/lib/types/xstate.ts` — Extend `WorkflowStepType` with `'crawling'` and `'scoring'`.
- **FILE-006**: `apps/backend/src/lib/runtime/workflow-normalizers.ts` — Geometric aliases and final-step mapping.
- **FILE-007**: `apps/backend/src/lib/runtime/tool-workflow-registry.ts` — Geometric workflow plan registration.
- **FILE-008**: `apps/backend/src/lib/machines/generation-system.types.ts` — Add `CrawlingDoneOutput`, `ScoringDoneOutput`, `CacheCrawlingResultParams`, `CacheScoringResultParams`.
- **FILE-009**: `apps/backend/src/lib/machines/generation-system.events.ts` — Add `getCrawlingDoneOutput()`, `getScoringDoneOutput()`, `getCrawlingResultParams()`, `getScoringResultParams()`.
- **FILE-010**: `apps/backend/src/lib/machines/generation/crawling-chain.machine.ts` — Pass-through chain machine (setup + typed input/output, immediate final state).
- **FILE-011**: `apps/backend/src/lib/machines/generation/scoring-chain.machine.ts` — Pass-through chain machine (setup + typed input/output, immediate final state).
- **FILE-012**: `apps/backend/src/lib/machines/generation-system.actors.ts` — Add `invokeCrawling` and `invokeScoring` `fromPromise` actors. Update `GenerationSystemProvidedActor` union type.
- **FILE-013**: `apps/backend/src/lib/machines/tool-workflow.machine.ts` — Add `mergeCrawlingOutput` and `mergeScoringOutput` actions. Update `STEP_SUCCESS` actions array.
- **FILE-014**: `apps/backend/src/lib/machines/generation-system.guards.ts` — Add `crawlingOutputIsAccepted` and `scoringOutputIsAccepted` guards.
- **FILE-015**: `apps/backend/src/lib/machines/generation-system.actions.ts` — Add `cacheCrawlingResult` and `cacheScoringResult` actions.
- **FILE-016**: `apps/backend/src/lib/machines/generation/context-generation-assembly.ts` — Add `mergeCrawlingIntoGenerationInput()` function.
- **FILE-017**: `apps/backend/src/lib/runtime/integrations/crawling.adapter.ts` — Puppeteer + stealth adapter.
- **FILE-018**: `apps/backend/src/lib/runtime/integrations/crawling-queue.ts` — BullMQ queue + worker.
- **FILE-019**: `apps/backend/src/lib/runtime/analysis/scoring-engine.ts` — Deterministic scoring function.
- **FILE-020**: `apps/backend/src/lib/runtime/tool-prompts/geometric/prompt_strategic_reporting.md` — Prompt A asset.
- **FILE-021**: `apps/backend/src/lib/runtime/tool-prompts/geometric/prompt_unified_report.md` — Prompt B asset.
- **FILE-022**: `apps/backend/src/lib/runtime/tool-prompts/index.ts` — Add Geometric prompt mapping.
- **FILE-023**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts` — Geometric tool config (6 registries).
- **FILE-024**: `apps/frontend/src/features/tools/geometric/pages/GeometricToolPage.tsx` — One-liner via `createToolPage`.
- **FILE-025**: `apps/frontend/src/app/routing/app-router.tsx` — Lazy route + component registration.
- **FILE-026**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — Conditional direct-input fields + Zod validation.
- **FILE-027**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` — `buildGeometricDirectInputExtractionInfo()` + branch in `selectGenerationExtractionInfo()`.
- **FILE-028**: `apps/frontend/src/app/copy/system.ts` — Navigation + editorial copy.

## 6. Testing

- **TEST-001**: Contract normalization test for `geometric` / `geometric_analysis` mapping and reverse mapping.
- **TEST-002**: Contract test for new `ArtifactType` values (`crawl`, `analysis`) propagation from domain to contracts.
- **TEST-003**: Backend orchestrate test for 4-step dependency resolution (correct dependency graph for Geometric steps).
- **TEST-004**: Backend crawling chain machine test: input/output type formatting (pass-through pattern, immediate final state).
- **TEST-005**: Backend `invokeCrawling` actor test: BullMQ job addition, worker processing, retry with backoff, concurrency control, PAA discovery flow.
- **TEST-006**: Backend crawling adapter test: mock browser, SERP parsing, PAA click sequence, anti-bot stealth verification.
- **TEST-007**: Backend scoring chain machine test: input/output type formatting (pass-through pattern, immediate final state).
- **TEST-008**: Backend `invokeScoring` actor test: scoring engine invocation with crawling data, output formatting.
- **TEST-009**: Backend scoring engine test: domain grouping, source classification, weighted scoring, normalization, tier assignment.
- **TEST-010**: Backend context assembly test: proper dependency artifact extraction for strategic-reporting and unified-report steps.
- **TEST-011**: Backend token efficiency test: verify only text and structured data are included in LLM prompt context.
- **TEST-012**: Backend integration test: full Geometric flow (crawling → scoring → strategic-reporting → unified-report) with mock LLM and mock browser.
- **TEST-013**: Frontend tool registry test: route `/tools/geometric`, label `Geometric`, direct-input config.
- **TEST-014**: Frontend Tool Workspace test: no file upload required, 3 direct-input fields rendered, Zod validation.
- **TEST-015**: Frontend readiness test: `baseQuery` + `language` + `country` required for start eligibility.
- **TEST-016**: Frontend direct-input extraction test: `buildGeometricDirectInputExtractionInfo()` produces correct payload.
- **TEST-017**: Session Summary list/detail test: Geometric label rendering, `AnalysisSessionSummary` fields displayed.
- **TEST-018**: Download test: Geometric session download includes all 4 step artifacts in correct order.
- **TEST-019**: Relaunch test: Geometric session resume recovers `baseQuery`, `language`, `country` from session record.
- **TEST-020**: Non-regression test: existing multi-step tools keep unchanged behavior after Geometric registration.
- **TEST-021**: Runtime gate test: crawling timeout → retry → fail, SERP parse failure → retry → fail, scoring data insufficient → fail.
- **TEST-022**: Runtime gate test: LLM non-markdown output → blocked, quality gate failure → blocked, language mismatch → blocked.
- **TEST-023**: XState transition test: Geometric happy path (all 4 steps complete), error path (each step failure + recovery).

## 7. Risks & Assumptions

- **RISK-001**: Puppeteer stealth may be detected by Google anti-bot updates, breaking crawling. Mitigation: monitor detection test sites (`bot.sannysoft.com`), update stealth plugin version, consider fallback to Playwright.
- **RISK-002**: BullMQ job queue may saturate Redis under concurrent Geometric sessions. Mitigation: configurable concurrency limit (default 3), monitor Redis memory usage.
- **RISK-003**: PAA discovery may return inconsistent results (Google personalization, geolocation variance). Mitigation: use consistent browser profile, accept that PAA count may vary (0-4).
- **RISK-004**: LLM reporting may produce non-deterministic output quality. Mitigation: quality gates in prompt, retry on failure, structured output contract.
- **RISK-005**: Terminology drift if new terms are introduced without DDD decision reference. Mitigation: all terms registered in DDD-113 through DDD-128.
- **RISK-006**: FE/BE mismatch if tool mapping is edited outside shared contracts. Mitigation: parity guard enforces structural identity.
- **RISK-007**: New dependencies increase bundle size and CI build time. Mitigation: Puppeteer is backend-only (not in frontend bundle), BullMQ is backend-only.
- **ASSUMPTION-001**: Redis infrastructure is available and configured for BullMQ (already used for idempotency, quota, stream sessions).
- **ASSUMPTION-002**: Docker/Railway deployment supports Puppeteer with `--no-sandbox` flag.
- **ASSUMPTION-003**: Tool availability policy defaults to `enabled-for-admin-only` for controlled rollout, then promoted to `enabled-for-all`.
- **ASSUMPTION-004**: LLM model supports Italian (`it-IT`) output for reporting steps.
- **ASSUMPTION-005**: `AnalysisSession` can be treated as a `GenerationSession` with `toolKey = 'geometric'` — no separate DB table needed.

### Implementation Phase 8

- GOAL-008: Monitoring & Logging — structured server-side observability for all Geometric operations.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-038 | Create `apps/backend/src/lib/runtime/integrations/geometric-logger.ts` with structured logging functions: `logGeometricInfo`, `logGeometricWarn`, `logGeometricError`, `logGeometricDebug`. All functions use prefix `[geometric]`, include `requestId` for cross-step correlation, and sanitize meta (truncate queries to 80 chars, strip `screenshot`/`htmlContent`/`rawBuffer`). | ✅ | 2026-06-12 |
| TASK-039 | Add logging to `invokeCrawling` actor in `generation-system.actors.ts`: log `crawling.start` (with baseQuery/language/country), `crawling.paa.discovered` (count), `crawling.paa.single_failed` (per-query), `crawling.completed` (duration, sourceCount, paaCount), `crawling.failed` (duration, error). | ✅ | 2026-06-12 |
| TASK-040 | Add logging to `invokeScoring` actor in `generation-system.actors.ts`: log `scoring.start` (sourceCount), `scoring.completed` (duration, competitorCount), `scoring.failed` (duration, error), `scoring.failed.no_sources` (when sources array is empty). | ✅ | 2026-06-12 |
| TASK-041 | Add logging to `mergeCrawlingOutput` and `mergeScoringOutput` actions in `tool-workflow.machine.ts`: log `merge.crawling.completed` (sourceCount, paaCount, snippetLength) and `merge.crawling.empty` (when crawlArtifacts empty); log `merge.scoring.completed` (competitorCount) and `merge.scoring.empty` (when ranking missing). | ✅ | 2026-06-12 |
| TASK-042 | Add logging to `assembleStrategicReportingInput` and `assembleUnifiedReportInput` in `context-generation-assembly.ts`: log `assembly.strategic_reporting` (snippetCount, paaCount, competitorCount) and `assembly.unified_report` (competitorCount); log `assembly.select` (stepKey) from `selectGeometricAssembly`. | ✅ | 2026-06-12 |
| TASK-043 | Add backend test for geometric logging: verify that log functions produce correct prefix, include requestId, and sanitize sensitive data (screenshot, raw HTML). | ✅ | 2026-06-12 |

## 8. Related Specifications / Further Reading

[Tool Development Plan Template](../docs/99-reference/templates/tool-development-plan-template.md)
[Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Tool Page Frontend Runtime Spec](../docs/02-design/specifications/tool-page-frontend-runtime-spec.md)
