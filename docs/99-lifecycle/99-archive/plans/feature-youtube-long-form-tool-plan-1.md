---
goal: "Implement Youtube LF Script (youtube-lf-script) tool for gen-app-2 with canonical 6-step workflow, specialized brief extraction, and complete multi-tool registry integration"
version: "1.0"
date_created: "2026-05-07"
last_updated: "2026-05-16"
owner: "dev-team"
status: archived
last-reviewed: 2026-05-16
next-review-date: 2027-05-16
tags: ['feature', 'architecture', 'tool-integration', 'ddd', 'multi-step-generation']
---

# Introduction

![Status: Archived](https://img.shields.io/badge/status-Archived-lightgrey)

This implementation plan provides a deterministic, fully executable roadmap for integrating the Youtube LF Script Generator tool (ToolKey: `youtube-lf-script`) into the gen-app-2 multi-tool generation system. The plan follows the registry-driven architecture established by existing tools (funnel-pages, nextland) and maintains DDD discipline through canonical naming decisions, bounded context mapping, and test-driven validation.

**Scope**: Frontend registry + component lazy loading; Backend workflow orchestration + extraction schema + prompt registry; DDD nomenclature + decision logging; comprehensive test coverage for multi-step generation and resume/regenerate flows.

**Success Criteria**: 
- New tool fully functional with canonical prompt-chat step sequence (step artifacts + final artifact correctly persisted).
- Resume/regenerate flows working across all canonical steps with deterministic hydration.
- All new domain concepts (ToolKey, ToolSteps, ExtractionContext schema) logged in DDD decision registry.
- Test coverage ≥95% for orchestration, generation flow, and artifact persistence.
- Zero hardcoded tool references remaining outside registry pattern.

### Decision Freeze (Confirmed 2026-05-07)

This section is authoritative and supersedes any conflicting legacy references in this document.

- **Tool identity**:
	- ToolKey: `youtube-lf-script`
	- DisplayName: `Youtube LF Script`
	- Backend workflow type: `youtube_lf_script`
- **Canonical ToolStep sequence (prompt-chat faithful)**:
	1. `pre-script-analysis`
	2. `packaging`
	3. `intro-structure`
	4. `body-structure`
	5. `native-cta-embeds`
	6. `outro-structure`
- **ExtractionContext canonical fields (from prompt-chat input section)**:
	- `knowledge_content`
	- `avatar`
	- `pain_point`
	- `purchase_process_type`
	- `offer`
	- `proof`
	- `tone`
	- `target_duration_minutes`
	- `proprietary_methodology_disclosure`
- **Missing-field policy**: extraction output is markdown human-readable and must explicitly mark missing values as `Non emerso dal documento.`; normalization then maps unresolved fields to canonical `null` in `ExtractionContext`.
- **Readiness minimum required fields**:
	- `knowledge_content`
	- `avatar`
	- `pain_point`
	- `offer`
	- `proof`
- **Generation language**: always Italian.
- **Final artifact format**: must follow the format declared in the prompt-chat markdown sequence.
- **Regenerate policy**: downstream steps are kept, marked as `stale`, readable but not finalizable until recomputed.
- **`/api/tools/briefs` contract**: accept `toolKey` in both query and body, precedence `body > query`, return `400` if missing.
- **Default model policy**: frontend remains user-selectable (as funnel-pages); default input value is `openrouter/auto`.

---

## 1. Requirements & Constraints

### Domain & Architecture Requirements
- **REQ-001**: All new domain concepts (ToolKey, ToolSteps, ExtractionContext schema) must be defined in `docs/01-requirements/domain-ubiquitous-language-glossary.md` and logged in `docs/07-governance/domain-naming-decision-log.md` before implementation begins. (DDD-First Workspace Operating Policy)
- **REQ-002**: New tool must follow registry-driven pattern: FE `toolFormRegistry` (SupportedTool union), BE `TOOL_WORKFLOW_REGISTRY` (SupportedToolWorkflow type), lazy component loading, data-driven routing.
- **REQ-003**: Step orchestration must be deterministic: dependency graph stored in registry, resolved via `/api/tools/orchestrate`, persisted in artifact metadata for resume/regenerate.
- **REQ-004**: Brief extraction must be schema-validated (unified endpoint `/api/tools/briefs` with tool-aware schema validation for YouTube long-form payload).
- **REQ-005**: Artifact lifecycle must follow DDD: intermediate artifacts marked `artifactRole: 'step'`, final artifact marked `artifactRole: 'final'`, persisted in PostgreSQL with JSON metadata for hydration.
- **REQ-006**: Multi-step generation must emit per-step `BackendStreamEvent` via SSE for frontend progress UI update.

### Multi-Tool Registry Architecture Requirements
- **REQ-007**: All hardcoded tool references must be eliminated; new tool must be discoverable via registry keys only (SupportedTool union, TOOL_WORKFLOW_REGISTRY, toolFormRegistry, PROMPT_FILE_BY_KEY).
- **REQ-008**: Frontend routing must be data-driven from `toolFormRegistry` keys; lazy component loading must support arbitrary new tool addition without route handler changes.
- **REQ-009**: Backend orchestration must be generic; tool-specific logic isolated to registry entries and persistent metadata (no conditional `if toolKey === 'nextland'` in generation logic).

### Extraction & Briefing Requirements
- **REQ-010**: Brief upload endpoint `/api/tools/briefs` must accept `toolKey` in both query and body, with precedence `body > query`; if missing in both, return `400` with explicit validation error.
- **REQ-011**: Youtube LF Script extraction schema must include these canonical fields: `knowledge_content`, `avatar`, `pain_point`, `purchase_process_type`, `offer`, `proof`, `tone`, `target_duration_minutes`, `proprietary_methodology_disclosure`.
- **REQ-012**: Extraction readiness gate (frontend hydration completeness) for Youtube LF Script requires: `knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`. Missing optional fields are allowed as `null`.

### Step & Dependency Requirements
- **REQ-013**: Youtube LF Script tool must define canonical prompt-chat-faithful steps: `pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure`; step order and dependencies must be stored in registry and deterministically resolved.
- **REQ-014**: Artifact role assignment must be deterministic: if step === last step in plan → `artifactRole: 'final'`, else → `artifactRole: 'step'`. Final artifact role is assigned to `outro-structure` for Youtube LF Script in current canonical sequence.
- **REQ-015**: Intermediate artifacts must be usable as context for dependent steps (e.g., pre-script-analysis output fed to packaging step as `dependencies.pre_script_analysis_artifact_id`).

### Testing & Validation Requirements
- **REQ-016**: All canonical generation steps must have passing unit tests (generation-system.machine.ts, tool-workflow-registry.ts step resolution).
- **REQ-017**: Multi-step orchestration must pass integration tests (runtime.tools-orchestrate.test.ts extended with Youtube LF Script canonical workflow).
- **REQ-018**: Resume/regenerate hydration must pass integration tests (artifact role inference, dependency resolution, session recovery).
- **REQ-019**: Extraction schema validation must pass contract tests (brief payload schema, tool-specific field presence).

### Constraint: Registry-Driven Pattern
- **CON-001**: FE SupportedTool and ToolStep unions cannot be eliminated (TypeScript limitation); must be extended for new tool, creating temporary coupling until TypeScript supports discriminated unions from runtime registries.
- **CON-002**: BE tool-specific persistence logic (`normalizeToolWorkflowInputJson`) must be extended if-guard for each new tool (no polymorphic dispatch available in current adapter); alternative: use discriminated union pattern with tool-specific metadata handler.
- **CON-003**: Prompt files are file-based registry (PROMPT_FILE_BY_KEY); adding tool requires file system additions + code registry update (not fully data-driven).

### Constraint: Multi-Step Generation Determinism
- **CON-004**: Artifact role inference depends on step order (last step = final); if step order changes post-generation, role inference becomes non-deterministic. Mitigation: persist explicit artifactRole in artifact input JSON (already implemented in generation-system.machine.ts via buildToolWorkflowPersistenceMetadata).
- **CON-005**: Dependency graph must be acyclic; step order must be a valid topological sort of dependencies. Constraint enforced in tests; no runtime detection.

### Constraint: Frontend Readiness Gate Determinism
- **CON-006**: Readiness completeness criteria (`hasCompleteHydrationResult`) may vary per tool (e.g., YouTube tool may require extraction fields present, other tools may not). Decision point: centralize logic in tool-page.machine.ts with registry lookup, or per-tool override.

### Guidelines
- **GUD-001**: All new types/functions must be named per canonical DDD terms in glossary (e.g., use `ExtractionContext`, not `BriefingContext` or `ExtractedData`).
- **GUD-002**: All registry entries must include `displayName`, `defaultPrompt`, `defaultModel`, `steps[]`, `stepDependencies`, and `defaults` fields (follow tool-form-architecture.ts pattern).
- **GUD-003**: All tests must follow fixture pattern from runtime.tools-orchestrate.test.ts (artifact stubs with toolKey, toolWorkflow, stepKey, dependencies, artifactRole).
- **GUD-004**: Prompts are prepared in `plan/resources/youtube-lf-script-prompts/` (master-derived source set) and then copied into `apps/backend/src/lib/runtime/tool-prompts/` with naming convention `youtube-lf-script-{step-key}.md`; all prompt files must be registered in PROMPT_FILE_BY_KEY.

### Pattern: Registry-Driven Architecture
- **PAT-001**: FE tool discovery: SupportedTool union → toolFormRegistry lookup → getToolFormConfig(toolKey) → toolStepOrder[toolKey] + stepCardConfigRegistry lookup.
- **PAT-002**: BE tool discovery: SupportedToolWorkflow type → TOOL_WORKFLOW_REGISTRY lookup → buildWorkflowPlan() → resolveStepDependencyIds() + toolWorkflowStepOrder lookup.
- **PAT-003**: BE prompt discovery: toolKey + stepKey → PROMPT_FILE_BY_KEY lookup with normalization → resolveToolPrompt() → LLM instruction file read.
- **PAT-004**: FE routing: toolFormRegistry keys → TOOL_ROUTES data-driven generation → lazy component loading by SupportedTool.

---

## 2. Implementation Steps

### Phase 1: DDD Nomenclature & Decision Logging

**GOAL-001**: Define and canonicalize all new domain concepts (ToolKey, ToolSteps, ExtractionContext schema) in DDD reference set before any code implementation.

**Prerequisite**: Read `docs/01-requirements/domain-ubiquitous-language-glossary.md` and `docs/07-governance/domain-naming-decision-log.md` to understand existing canonical terms and decision pattern.

**Blocking**: All downstream phases depend on DDD decisions; no code changes until DDD decisions are finalized and logged.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | **Read DDD Glossary & Decision Log**: Review existing canonical terms (ToolKey, ToolStep, ExtractionContext, WorkflowStep, ArtifactRole) and decision log format (DDD-NNN entries with rationale, scope, decision date). | | |
| TASK-002 | **Finalize Youtube LF Script ToolKey Name**: Canonical ToolKey identifier is `youtube-lf-script` (kebab-case, URL-safe, distinctive). Create decision entry DDD-NNN in decision log with rationale and approval date. | | |
| TASK-003 | **Define Youtube LF Script ToolStep Names**: Canonical prompt-chat-faithful steps are `pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure` (kebab-case, semantic clarity). Create decision entry DDD-NNN with rationale and approval date. | | |
| TASK-004 | **Design Youtube LF Script ExtractionContext Schema**: Define canonical extraction fields for `youtube-lf-script`: `knowledge_content`, `avatar`, `pain_point`, `purchase_process_type`, `offer`, `proof`, `tone`, `target_duration_minutes`, `proprietary_methodology_disclosure`. Create decision entry DDD-NNN with schema diagram/table, field types, and normalization rules. | | |
| TASK-005 | **Update Glossary: Youtube LF Script Canonical Terms**: Add entries to `docs/01-requirements/domain-ubiquitous-language-glossary.md` for: `youtube-lf-script` ToolKey, canonical ToolStep sequence (`pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure`), Youtube LF Script ExtractionContext fields. | | |
| TASK-006 | **Update Bounded Context Map**: Add Youtube LF Script tool to `docs/02-design/domain-bounded-context-map.md`. Document integration constraints with Generation, Auth, Usage/Quota, Frontend contexts. | | |
| TASK-007 | **Validate DDD Decisions with Team**: Review DDD-NNN entries: `youtube-lf-script` ToolKey, canonical ToolStep sequence (`pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure`), ExtractionContext schema. Acceptance: entries finalized in decision log with team approval. | | |

**Acceptance Criteria for Phase 1**:
- ✅ DDD glossary updated with YouTube tool canonical terms (ToolKey, canonical ToolStep sequence, ExtractionContext).
- ✅ Decision log includes ≥4 DDD-NNN entries (ToolKey decision, ToolStep names, ExtractionContext schema, and any schema trade-off decisions).
- ✅ Bounded context map updated with YouTube tool ownership and integration points.
- ✅ No code changes made; DDD decisions are source of truth for all downstream implementation.

**Estimated Duration**: 2–3 hours (discussion + documentation).

---

### Phase 2: Extraction Schema Design & Backend Endpoint Preparation

**GOAL-002**: Design YouTube brief extraction schema and prepare backend extraction logic to handle tool-specific payloads.

**Prerequisite**: Phase 1 (DDD decisions finalized).

**Dependency**: Requires YouTubeToolKey, ExtractionContext schema, and field nullability rules from Phase 1.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | **Design Youtube LF Script Brief Extraction Prompt**: Create LLM prompt instruction that guides extraction from briefing document into markdown human-readable sections aligned to canonical fields (`knowledge_content`, `avatar`, `pain_point`, `purchase_process_type`, `offer`, `proof`, `tone`, `target_duration_minutes`, `proprietary_methodology_disclosure`) and `Missing / Unclear`. Include field definitions, missing-data marker (`Non emerso dal documento.`), and fallback strategies. | | |
| TASK-009 | **Define Extraction Readiness Gate**: Decide readiness criteria for Youtube LF Script: required fields for `hasCompleteHydrationResult()` are `knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`; all other schema fields are allowed as `null`. Document decision. | | |
| TASK-010 | **Update Brief Upload Endpoint**: Modify `apps/backend/src/lib/runtime/auth-http.ts` POST `/api/tools/briefs` handler to accept toolKey and route extraction request with Youtube LF Script schema validation. Document extraction approach (generic + post-validation or tool-specific variant). | | |
| TASK-011 | **Prepare Extraction Chain for Youtube LF Script Schema**: Review `apps/backend/src/lib/machines/extraction-chain.machine.ts` and `apps/backend/src/lib/machines/generation-system.machine.ts:272–310`. Determine if generic extraction payload supports Youtube LF Script fields or if new schema needed. Document choice. | | |
| TASK-012 | **Create Youtube LF Script Extraction Prompt File**: Use `plan/resources/youtube-lf-script-prompts/youtube-lf-script-extraction.md` as source section (extracted from master) and copy/refine into `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-extraction.md`. Prompt must output markdown human-readable (no JSON), using fixed sections and explicit missing-data marker (`Non emerso dal documento.`). | | |
| TASK-012A | **Implement Extraction Markdown Normalization**: Add deterministic backend normalization layer to parse markdown extraction output and map it into canonical `ExtractionContext` object. Rule: unresolved/missing markdown values (`Non emerso dal documento.`) are normalized to `null`. Document parser behavior and edge cases. | | |

**Acceptance Criteria for Phase 2**:
- ✅ Extraction prompt file created and reviewed (markdown human-readable, no JSON, YouTube-specific field guidance).
- ✅ Brief upload endpoint updated to accept toolKey and route to tool-specific extraction (or generic extraction with post-validation).
- ✅ Extraction readiness gate criteria documented (which YouTube ExtractionContext fields are required for readiness).
- ✅ Deterministic normalization from markdown extraction output to canonical `ExtractionContext` implemented and documented.
- ✅ Decision log updated if extraction schema or normalization policy diverges from generic pattern.

**Estimated Duration**: 3–4 hours (prompt refinement + endpoint update + testing prep).

---

### Phase 3: Backend Registry & Tool Workflow Orchestration

**GOAL-003**: Register YouTube tool in backend registry (tool-workflow-registry.ts, PROMPT_FILE_BY_KEY, persistence logic) and ensure deterministic multi-step orchestration.

**Prerequisite**: Phase 1 (DDD decisions: ToolKey, ToolSteps).

**Dependency**: None (can run in parallel with Phase 2 after DDD decisions).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | **Extend SupportedToolWorkflow Type**: Edit `apps/backend/src/lib/runtime/tool-workflow-registry.ts:10–12` to extend `SupportedToolWorkflow = 'funnel-pages' \| 'nextland' \| 'youtube-lf-script'`. | | |
| TASK-014 | **Extend isSupportedToolWorkflow Guard**: Update `apps/backend/src/lib/runtime/tool-workflow-registry.ts:65–75` type guard to include `'youtube-lf-script'` in `SUPPORTED_TOOL_WORKFLOWS` set. Acceptance: TypeScript compile succeeds. | | |
| TASK-015 | **Add Youtube LF Script Workflow Plan to Registry**: Insert entry into `apps/backend/src/lib/runtime/tool-workflow-registry.ts:48–59` TOOL_WORKFLOW_REGISTRY. Entry: `{ toolKey: 'youtube-lf-script', steps: [{key: 'pre-script-analysis', dependencies: []}, {key: 'packaging', dependencies: ['pre-script-analysis']}, {key: 'intro-structure', dependencies: ['packaging']}, {key: 'body-structure', dependencies: ['intro-structure']}, {key: 'native-cta-embeds', dependencies: ['body-structure']}, {key: 'outro-structure', dependencies: ['native-cta-embeds']}] }`. | | |
| TASK-016 | **Add Youtube LF Script Step Order to toolWorkflowStepOrder**: Edit `apps/backend/src/lib/runtime/tool-workflow-registry.ts:26–36` to add entry: `'youtube-lf-script': ['pre-script-analysis', 'packaging', 'intro-structure', 'body-structure', 'native-cta-embeds', 'outro-structure']`. | | |
| TASK-017 | **Register Youtube LF Script Prompts in PROMPT_FILE_BY_KEY**: Edit `apps/backend/src/lib/runtime/tool-prompts/index.ts:5–12` to add 6 entries: `'youtube-lf-script:pre-script-analysis': '...', 'youtube-lf-script:packaging': '...', 'youtube-lf-script:intro-structure': '...', 'youtube-lf-script:body-structure': '...', 'youtube-lf-script:native-cta-embeds': '...', 'youtube-lf-script:outro-structure': '...'` (point to file paths created in Phase 6). | | |
| TASK-018 | **Create Youtube LF Script Prompt Files**: Copy/adapt the prepared source files from `plan/resources/youtube-lf-script-prompts/` into `apps/backend/src/lib/runtime/tool-prompts/`: `youtube-lf-script-pre-script-analysis.md`, `youtube-lf-script-packaging.md`, `youtube-lf-script-intro-structure.md`, `youtube-lf-script-body-structure.md`, `youtube-lf-script-native-cta-embeds.md`, `youtube-lf-script-outro-structure.md`. Each includes: step objective, input context, expected output structure, LLM instructions. | | |
| TASK-019 | **Extend Artifact Role Persistence Logic**: Edit `apps/backend/src/lib/adapters/postgres-redis.production.ts:129–164` function `normalizeToolWorkflowInputJson()`. Extend if-guard: add `'youtube-lf-script'` to conditional; add final-step detection (`currentStep === 'outro-structure'` → artifactRole: 'final', else artifactRole: 'step'). | | |
| TASK-020 | **Test Backend Registry**: Run `npm run test -- --testNamePattern="tools.*registry"` (or equivalent) to verify registry entries load correctly, isSupportedToolWorkflow guard accepts YouTube tool key, and TOOL_WORKFLOW_REGISTRY resolves to canonical 6-step plan. Acceptance: all registry tests pass. | | |

**Acceptance Criteria for Phase 3**:
- ✅ SupportedToolWorkflow type includes `'youtube-lf-script'` ToolKey; TypeScript compiles without errors.
- ✅ isSupportedToolWorkflow guard accepts `'youtube-lf-script'` ToolKey as valid.
- ✅ TOOL_WORKFLOW_REGISTRY includes `'youtube-lf-script'` tool with canonical 6-step plan and correct dependency graph.
- ✅ toolWorkflowStepOrder includes `'youtube-lf-script'` tool with canonical 6-step order.
- ✅ Prompt file registry (PROMPT_FILE_BY_KEY) includes 6 `youtube-lf-script` tool entries.
- ✅ Artifact role persistence logic extended to detect Youtube LF Script final step (`outro-structure`).
- ✅ Registry tests pass; orchestrate endpoint `/api/tools/orchestrate` resolves Youtube LF Script dependencies correctly (tested in Phase 7).

**Estimated Duration**: 2–3 hours (registry updates + persistence logic + validation).

---

### Phase 4: Frontend Registry, Routing & Lazy Component Setup

**GOAL-004**: Register YouTube tool in frontend registry (toolFormRegistry, toolStepOrder, stepCardConfigRegistry), set up lazy component loading and routing, enable data-driven route generation.

**Prerequisite**: Phase 1 (DDD decisions: ToolKey, ToolSteps).

**Dependency**: Can run in parallel with Phase 3 after DDD decisions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | **Extend SupportedTool Union**: Edit `apps/frontend/src/features/tools/machines/tool-flow.machine.ts:3–4` to extend `type SupportedTool = 'funnel-pages' \| 'nextland' \| 'youtube-lf-script'`. | | |
| TASK-022 | **Extend ToolStep Union**: Edit `apps/frontend/src/features/tools/machines/tool-flow.machine.ts:5` to extend `type ToolStep = 'optin' \| 'quiz' \| 'vsl' \| 'landing' \| 'thank_you' \| 'pre-script-analysis' \| 'packaging' \| 'intro-structure' \| 'body-structure' \| 'native-cta-embeds' \| 'outro-structure'`. | | |
| TASK-023 | **Add Youtube LF Script Step Order**: Edit `apps/frontend/src/features/tools/machines/tool-flow.machine.ts:20–30` to add entry: `'youtube-lf-script': ['pre-script-analysis', 'packaging', 'intro-structure', 'body-structure', 'native-cta-embeds', 'outro-structure']`. | | |
| TASK-024 | **Add Youtube LF Script to toolFormRegistry**: Edit `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts:92+` to insert registry entry. Entry: `{ toolKey: 'youtube-lf-script', displayName: 'Youtube LF Script', defaultPrompt: '...', defaultModel: 'openrouter/auto', steps: ['pre-script-analysis', 'packaging', 'intro-structure', 'body-structure', 'native-cta-embeds', 'outro-structure'], stepDependencies: { 'pre-script-analysis': [], packaging: ['pre-script-analysis'], 'intro-structure': ['packaging'], 'body-structure': ['intro-structure'], 'native-cta-embeds': ['body-structure'], 'outro-structure': ['native-cta-embeds'] }, defaults: {registrySnapshotRef: ...} }`. | | |
| TASK-025 | **Add Youtube LF Script Step Card Metadata**: Edit `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts:176–214` to add 6 step metadata entries (`pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure`) with displayName, description, and expectedOutputFormat aligned to prompt-chat sequence. | | |
| TASK-026 | **Create Youtube LF Script Tool Page Component**: Create file `apps/frontend/src/features/tools/ui/pages/YoutubeLfScriptToolPage.tsx` (minimal wrapper following createToolPage factory pattern). Import `ToolPageTemplate` and pass tool-specific config. Acceptance: TypeScript compiles. | | |
| TASK-027 | **Register Lazy Component in Router**: Edit `apps/frontend/src/app/routing/app-router.tsx:15–27` to add lazy import: `const YoutubeLfScriptToolPage = lazy(() => import('.../YoutubeLfScriptToolPage'))` and add registry entry: `toolPageComponents: { ..., 'youtube-lf-script': YoutubeLfScriptToolPage }`. | | |
| TASK-028 | **Verify Data-Driven Route Generation**: Confirm that `TOOL_ROUTES` at `apps/frontend/src/app/routing/app-router.tsx:34–37` automatically includes `youtube-lf-script` (data-driven from toolFormRegistry keys). Run `npm run build:frontend` to verify TypeScript and route generation succeed. Acceptance: no hardcoded route needed; routes auto-generated. | | |

**Acceptance Criteria for Phase 4**:
- ✅ SupportedTool union includes `'youtube-lf-script'` ToolKey; ToolStep union includes canonical steps (`pre-script-analysis`, `packaging`, `intro-structure`, `body-structure`, `native-cta-embeds`, `outro-structure`).
- ✅ toolStepOrder includes `'youtube-lf-script'` tool with canonical 6-step order.
- ✅ toolFormRegistry includes `'youtube-lf-script'` entry with complete config (displayName: 'Youtube LF Script', defaultPrompt, steps, stepDependencies, defaults).
- ✅ stepCardConfigRegistry includes 6 Youtube LF Script step metadata entries.
- ✅ YoutubeLfScriptToolPage component created and lazy-loaded in router.
- ✅ Data-driven route generation includes `/tools/youtube-lf-script` route.
- ✅ Frontend TypeScript compiles without errors.

**Estimated Duration**: 2–3 hours (registry updates + component creation + routing verification).

---

### Phase 5: Navigation, UI Copy & Hardcoded Tool References Cleanup

**GOAL-005**: Add YouTube tool to navigation/menu, system copy, and remove any remaining hardcoded tool references from UI layers.

**Prerequisite**: Phase 4 (frontend routing complete).

**Dependency**: Can run in parallel with Phase 3/4 but must complete before Phase 6 (integration testing).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | **Add Youtube LF Script to System Copy**: Edit `apps/frontend/src/app/copy/system.ts`. Add entries: (1) navigation label (e.g., `YOUTUBE_LF_SCRIPT_TOOL: 'Youtube LF Script'`), (2) tool description/tagline, (3) tool-specific copy for readiness messages, step descriptions. | | |
| TASK-030 | **Update MainNavigation Component**: Edit `apps/frontend/src/app/layouts/MainNavigation.tsx:32–33` to add Youtube LF Script route mapping: `'/tools/youtube-lf-script': { icon: '📹', label: 'Youtube LF Script' }`. | | |
| TASK-031 | **Search for Hardcoded Tool References**: Run terminal command `rg -n "funnel-pages|nextland|youtube-lf-script" apps/frontend apps/backend --type ts --type tsx` to find all hardcoded tool key references. Document any references outside of registry pattern. | | |
| TASK-032 | **Add YouTube Tool to Feature Flags / Admin Panel (if applicable)**: If project has feature flags or admin panel for tool enablement, add YouTube tool toggle/config entry. | | |
| TASK-033 | **Update README Documentation**: Edit relevant README files (`docs/02-design/frontend-tool-pages-architecture-spec.md`, `docs/02-design/tool-generation-flow.md`) to mention Youtube LF Script in examples and architecture diagrams. Add to list of supported tools. | | |

**Acceptance Criteria for Phase 5**:
- ✅ Navigation includes Youtube LF Script route with icon and label.
- ✅ System copy includes Youtube LF Script-specific labels and messaging.
- ✅ No new hardcoded tool references added; existing hardcoded refs (if found) documented for future generalization.
- ✅ Documentation updated with Youtube LF Script tool.

**Estimated Duration**: 1–2 hours (copy updates + navigation + documentation).

---

### Phase 6: Prompt Refinement & Step Instruction Finalization

**GOAL-006**: Finalize step-specific prompts and ensure each step produces semantically coherent output for downstream step consumption.

**Prerequisite**: Phase 1 (DDD decisions), Phase 3 (backend registry ready).

**Dependency**: Can run in parallel with Phase 4/5, but prompt quality depends on understanding tool semantics and step interdependencies.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-034 | **Refine Youtube LF Script Extraction Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-extraction.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-extraction.md` (created in Phase 2 TASK-012). Finalize markdown section structure, missing-data marker policy, and parser-friendly consistency rules. Include examples. Validate with content strategy expert. | | |
| TASK-035 | **Refine Pre-Script Analysis Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-pre-script-analysis.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-pre-script-analysis.md`. Prompt: (1) pre-analysis objective, (2) reference extraction context (`knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`, `tone`), (3) expected output format (structured analysis). Include examples. | | |
| TASK-036 | **Refine Packaging Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-packaging.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-packaging.md`. Prompt: (1) packaging objective, (2) reference pre-script-analysis output, (3) define title/frame/angle options coherent with extraction context, (4) expected output format. | | |
| TASK-037 | **Refine Intro Structure Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-intro-structure.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-intro-structure.md`. Prompt: (1) intro objective, (2) reference packaging output, (3) define opening structure aligned with target audience and pain points, (4) output format. | | |
| TASK-038 | **Refine Body Structure Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-body-structure.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-body-structure.md`. Prompt: (1) body objective, (2) reference intro-structure output, (3) incorporate offer/proof flow with coherent narrative progression, (4) output format. | | |
| TASK-039 | **Refine Native CTA Embeds Prompt**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-native-cta-embeds.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-native-cta-embeds.md`. Prompt: (1) native CTA embedding objective, (2) reference body-structure output, (3) align CTA embed points with purchase process type and tone, (4) output format. | | |
| TASK-040 | **Refine Outro Structure Prompt + End-to-End Prompt Quality Test**: Start from `plan/resources/youtube-lf-script-prompts/youtube-lf-script-outro-structure.md`, then edit `apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-outro-structure.md` for final-step closing objective and run manual test: upload Youtube LF Script brief with sample ExtractionContext → trigger generation → verify each step output is coherent, uses context, and feeds next step. Acceptance: all 6 steps produce usable output with <5% rejection rate. | | |

**Acceptance Criteria for Phase 6**:
- ✅ All 7 Youtube LF Script prompts (1 extraction + 6 generation steps) finalized and reviewed.
- ✅ Each generation step prompt references previous step output and extraction context fields.
- ✅ Output format is consistent across steps and parseable.
- ✅ Manual end-to-end generation test succeeds; all 6 step outputs are coherent and usable.

**Estimated Duration**: 4–6 hours (prompt iteration + manual testing + refinement).

---

### Phase 7: Test Coverage & Orchestration Validation

**GOAL-007**: Achieve ≥95% test coverage for YouTube tool registration, multi-step orchestration, artifact persistence, resume/regenerate flows, and extraction schema validation.

**Prerequisite**: Phase 3 (backend registry), Phase 4 (frontend registry), Phase 6 (prompts finalized).

**Dependency**: Depends on all prior phases for code to test.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-041 | **Create Orchestrate Endpoint Tests for Youtube LF Script**: Edit `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts:80–320`. Add comprehensive test suite: (1) `/api/tools/orchestrate` resolves all canonical 6-step dependencies correctly, (2) invalid step keys rejected, (3) dependency order enforced, (4) artifact IDs returned for each step. Fixture: create artifact stubs with `toolKey: 'youtube-lf-script'`, `toolWorkflow: 'youtube_lf_script'`, steps: pre-script-analysis/packaging/intro-structure/body-structure/native-cta-embeds/outro-structure. | | |
| TASK-042 | **Create Tool Workflow Registry Tests**: Add unit tests for Youtube LF Script entries in `tool-workflow-registry.ts`. Tests: (1) tool recognized by `isSupportedToolWorkflow('youtube-lf-script')`, (2) `buildWorkflowPlan('youtube-lf-script')` returns canonical 6-step plan, (3) `resolveStepDependencyIds()` resolves pre-script-analysis→packaging→intro-structure→body-structure→native-cta-embeds→outro-structure chain correctly, (4) final step (`outro-structure`) identified. | | |
| TASK-043 | **Create Generation System Machine Tests**: Add tests for `generation-system.machine.ts` Youtube LF Script workflow. Tests: (1) `resolveToolWorkflowPlan()` loads registry entry, (2) `buildToolWorkflowPersistenceMetadata()` persists step context (toolKey: 'youtube-lf-script', stepKey, dependencies), (3) artifact role: non-final steps marked 'step', `outro-structure` marked 'final'. | | |
| TASK-044 | **Create Artifact Persistence & Role Tests**: Add integration tests for artifact persistence (`postgres-redis.production.ts`). Tests: (1) Youtube LF Script artifacts persisted with artifactRole, (2) `normalizeToolWorkflowInputJson()` correctly infers role (pre-script-analysis/packaging/intro-structure/body-structure/native-cta-embeds = 'step', outro-structure = 'final'), (3) hydration reconstructs artifact context from persisted metadata. | | |
| TASK-045 | **Create Resume/Regenerate Hydration Tests**: Add tests for Youtube LF Script resume/regenerate flows. Tests: (1) User can resume generation from step N (dependencies pre-loaded), (2) User can regenerate step N (previous artifacts preserved), (3) WorkflowStepBootstrap reconstructs session state, (4) artifactRole persisted and recovered. | | |
| TASK-046 | **Create Brief Extraction Schema Tests**: Add contract tests for Youtube LF Script brief extraction + normalization. Tests: (1) extraction prompt returns markdown with required sections, (2) normalization maps markdown to canonical `ExtractionContext`, (3) missing marker (`Non emerso dal documento.`) maps to `null`, (4) normalized payload format matches schema. | | |
| TASK-047 | **Create Frontend Tool-Page Machine Tests**: Add tests for `tool-page.machine.ts` with Youtube LF Script. Tests: (1) `toolStepOrder['youtube-lf-script']` resolves canonical 6-step order, (2) readiness gate enforces required extraction fields (`knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`), (3) primary action policy assigns `start-generation`/`regenerate` intent. | | |
| TASK-048 | **Create Frontend Tool-Flow Machine Tests**: Add tests for `tool-flow.machine.ts` with Youtube LF Script. Tests: (1) step transitions follow canonical dependency graph (`pre-script-analysis`→`packaging`→`intro-structure`→`body-structure`→`native-cta-embeds`→`outro-structure`), (2) step completion tracked across all 6 steps, (3) regenerate marks downstream steps as `stale` (readable, non-finalizable) until recomputed, (4) error handling per step. | | |
| TASK-049 | **Create Integration Test: Full Generation Flow**: End-to-end integration test: (1) create Youtube LF Script project, (2) upload brief with ExtractionContext, (3) initiate generation, (4) stream events for all 6 steps, (5) final artifact persisted with correct role, (6) artifact retrievable and hydration works. Can be run as smoke test. | | |
| TASK-050 | **Verify Test Coverage**: Run `npm run test:backend -- --coverage` and `npm run test:frontend -- --coverage`. Verify YouTube tool-specific code paths achieve ≥95% coverage (lines, branches). Document coverage report. | | |

**Acceptance Criteria for Phase 7**:
- ✅ Orchestrate endpoint tests pass for Youtube LF Script (all canonical 6-step dependency chains).
- ✅ Tool workflow registry tests pass (Youtube LF Script recognized, plan resolved, dependencies correct).
- ✅ Generation system tests pass (Youtube LF Script metadata persisted, artifactRole assignment deterministic).
- ✅ Artifact persistence tests pass (Youtube LF Script artifacts correctly stored/recovered).
- ✅ Resume/regenerate tests pass (hydration and session recovery work for Youtube LF Script).
- ✅ Extraction schema tests pass (Youtube LF Script ExtractionContext validates).
- ✅ Frontend machine tests pass (Youtube LF Script state transitions correct).
- ✅ Integration test passes (Youtube LF Script full generation flow works end-to-end).
- ✅ Test coverage ≥95% for Youtube LF Script-specific code.

**Estimated Duration**: 6–8 hours (test writing + debugging + coverage validation).

---

### Phase 8: Integration & Validation

**GOAL-008**: Perform final integration validation, cross-layer consistency checks, and prepare for production deployment.

**Prerequisite**: All prior phases (1–7) complete.

**Dependency**: Blocking phase; must complete all prior phases before integration.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-051 | **FE/BE Contract Validation**: Verify FE SupportedTool/ToolStep unions match BE SupportedToolWorkflow/registry entries. Automated check: `'youtube-lf-script'` in both FE and BE. Acceptance: no discrepancies. | | |
| TASK-052 | **Registry Cross-Reference Validation**: Verify all references consistent across FE and BE: (1) toolFormRegistry keys match SupportedTool union (`'youtube-lf-script'`), (2) toolStepOrder keys match (`'youtube-lf-script'`), (3) BE TOOL_WORKFLOW_REGISTRY keys match SupportedToolWorkflow type, (4) PROMPT_FILE_BY_KEY keys match pattern (`youtube-lf-script:pre-script-analysis`, ..., `youtube-lf-script:outro-structure`). | | |
| TASK-053 | **Artifact Persistence Validation**: Run production-like scenario: (1) generate Youtube LF Script artifact across all 6 steps, (2) retrieve each intermediate + final artifact from database, (3) verify artifactRole, toolKey: 'youtube-lf-script', stepKey, dependencies, metadata. Acceptance: 100% data integrity. | | |
| TASK-054 | **Resume/Regenerate Consistency**: Run scenario: (1) generate Youtube LF Script steps 1–3 (`pre-script-analysis`, `packaging`, `intro-structure`), (2) session interruption, (3) resume from step 3, (4) regenerate step 2, (5) verify downstream steps are marked `stale` (readable, non-finalizable), (6) complete generation after recomputation. Acceptance: no corruption, deterministic recovery. | | |
| TASK-055 | **DDD Consistency Audit**: Verify all code, tests, docs use canonical domain terms per DDD glossary. Automated check: search for deprecated terms or non-canonical aliases. Acceptance: no non-canonical terms in Youtube LF Script code/tests; `'youtube-lf-script'` used consistently. | | |
| TASK-056 | **Load & Performance Testing (Optional but Recommended)**: Run load test: 100 concurrent Youtube LF Script generation requests, measure latency, error rates, persistence throughput. Acceptance: <5% error rate, p99 latency <30s per step. | | |
| TASK-057 | **Documentation Review & Final Validation**: Review all updated docs: glossary, decision log, BCM, specs. Verify Youtube LF Script documented in architecture diagrams, integration examples, troubleshooting guides. Acceptance: documentation complete and up-to-date. | | |
| TASK-058 | **Deployment Readiness**: Verify: (1) all tests pass in CI/CD, (2) code review complete, (3) rollback plan documented (if Youtube LF Script needs emergency disable), (4) monitoring/logging set up for generation pipeline. Acceptance: ready for production merge. | | |

**Acceptance Criteria for Phase 8**:
- ✅ FE/BE contracts consistent (`'youtube-lf-script'` in both FE and BE unions/registry).
- ✅ All cross-registry references validated and consistent.
- ✅ Artifact persistence verified (all 6 Youtube LF Script steps correctly stored).
- ✅ Resume/regenerate flows validated (deterministic state recovery for Youtube LF Script).
- ✅ DDD consistency audit passed (`'youtube-lf-script'` and canonical terms used throughout).
- ✅ Load testing passed (if performed).
- ✅ Documentation complete and reviewed.
- ✅ CI/CD tests all pass; code review complete.
- ✅ Ready for production deployment.

**Estimated Duration**: 2–4 hours (validation + documentation + deployment prep).

---

## 3. Alternatives

### ALT-001: Monolithic Tool Extension vs. Registry-Driven Pattern
- **Considered Approach**: Add YouTube tool logic as hardcoded conditionals (`if toolKey === 'youtube-lf-script'`) throughout codebase, no registry pattern.
- **Rationale for Rejection**: Violates DDD-first policy, creates maintenance burden (each new tool doubles conditionals), no scalability. Increases risk of silent failures (missing one conditional breaks tool). Current registry-driven pattern is superior.

### ALT-002: Generic Extraction Schema vs. Tool-Specialized ExtractionContext
- **Considered Approach**: Keep extraction generic (single untyped summary + loose field bag) without YouTube-specific canonical fields.
- **Rationale for Rejection**: Loses semantic specificity (YouTube content needs `knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`, and related canonical fields; forcing into generic `fields` is lossy). Tool-specific schema improves generation quality and enables better artifact hydration.
- **Chosen Approach**: Tool-specific ExtractionContext schema defined per tool, with unified extraction endpoint and schema validation per toolKey.

### ALT-003: Linear Step Dependencies vs. DAG (Directed Acyclic Graph)
- **Considered Approach**: Allow arbitrary dependency graph (e.g., `body-structure` depends on both `intro-structure` and `packaging` in parallel).
- **Rationale for Rejection**: Adds complexity to orchestration (topological sort, parallel execution coordination). Linear chain is simpler, sufficient for YouTube tool (6 sequential steps). Can be generalized later if needed.
- **Chosen Approach**: Linear step chain (`pre-script-analysis` → `packaging` → `intro-structure` → `body-structure` → `native-cta-embeds` → `outro-structure`).

### ALT-004: Monolithic Artifact vs. Per-Step Intermediate Artifacts
- **Considered Approach**: Only persist final artifact; stream intermediate outputs but don't save them.
- **Rationale for Rejection**: Resume/regenerate flows require replaying from checkpoints; intermediate artifacts are essential. Current approach (intermediate + final) is required.
- **Chosen Approach**: Persist intermediate artifacts (artifactRole: 'step') + final artifact (artifactRole: 'final').

---

## 4. Dependencies

### Code Dependencies
- **DEP-001**: XState v5 + @xstate/react: State machine orchestration for FE/BE workflows (already in project).
- **DEP-002**: TypeScript 5.x: Type unions (SupportedTool, ToolStep, SupportedToolWorkflow) to enforce type safety across tool registry.
- **DEP-003**: PostgreSQL + Redis: Artifact persistence, idempotency, quota enforcement (already in project).
- **DEP-004**: Node.js 20.x LTS: Backend runtime for tool workflow orchestration and prompt loading.

### Architecture Dependencies
- **DEP-005**: FE registry pattern (`toolFormRegistry` in tool-form-architecture.ts) must be extended; depends on SupportedTool union extension.
- **DEP-006**: BE registry pattern (`TOOL_WORKFLOW_REGISTRY` in tool-workflow-registry.ts) must be extended; depends on SupportedToolWorkflow type extension.
- **DEP-007**: BE persistence logic (`normalizeToolWorkflowInputJson` in postgres-redis.production.ts) must be extended; depends on YouTube tool registration and final-step detection logic.
- **DEP-008**: Artifact role inference (generation-system.machine.ts) depends on registry-driven step ordering (already implemented).

### External Dependencies
- **DEP-009**: YouTube content strategy domain knowledge: Required for refining extraction schema and step prompts. Recommend domain expert review during Phase 2 & 6.
- **DEP-010**: LLM API (OpenAI GPT-4o or equivalent): Required for extraction + per-step generation. Assume API access already configured (used by existing tools).

### Documentation Dependencies
- **DEP-011**: DDD glossary and decision log updates (Phase 1) are prerequisites for all downstream work; must be completed before Phase 2+.

---

## 5. Files

| File | Modification Type | Description |
|------|------------------|-------------|
| [docs/01-requirements/domain-ubiquitous-language-glossary.md](docs/01-requirements/domain-ubiquitous-language-glossary.md) | **Append** | Add YouTube ToolKey, canonical prompt-chat ToolStep sequence (6 steps), and YouTube-specific ExtractionContext fields to canonical term definitions. |
| [docs/07-governance/domain-naming-decision-log.md](docs/07-governance/domain-naming-decision-log.md) | **Append** | Add DDD-NNN decision entries: YouTube ToolKey, YouTube ToolStep names, YouTube ExtractionContext schema, schema trade-offs. |
| [docs/02-design/domain-bounded-context-map.md](docs/02-design/domain-bounded-context-map.md) | **Update** | Add YouTube tool to bounded context map; document integration with Generation, Frontend, Auth contexts. |
| [apps/backend/src/lib/runtime/tool-workflow-registry.ts](apps/backend/src/lib/runtime/tool-workflow-registry.ts) | **Modify** | Extend SupportedToolWorkflow type, isSupportedToolWorkflow guard, TOOL_WORKFLOW_REGISTRY, toolWorkflowStepOrder. |
| [apps/backend/src/lib/runtime/tool-prompts/index.ts](apps/backend/src/lib/runtime/tool-prompts/index.ts) | **Modify** | Add 6 YouTube tool entries to PROMPT_FILE_BY_KEY registry. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-system-instructions.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-system-instructions.md) | **Create** | Source excerpt for shared system instructions extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/index-mapping.md](plan/resources/youtube-lf-script-prompts/index-mapping.md) | **Create** | Mapping index: master sections -> prepared resources -> runtime prompt targets for deterministic copy in execution. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-extraction.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-extraction.md) | **Create** | Source excerpt for extraction/input section extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-pre-script-analysis.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-pre-script-analysis.md) | **Create** | Source excerpt for pre-script analysis phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-packaging.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-packaging.md) | **Create** | Source excerpt for packaging phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-intro-structure.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-intro-structure.md) | **Create** | Source excerpt for intro-structure phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-body-structure.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-body-structure.md) | **Create** | Source excerpt for body-structure phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-native-cta-embeds.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-native-cta-embeds.md) | **Create** | Source excerpt for native-cta-embeds phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-outro-structure.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-outro-structure.md) | **Create** | Source excerpt for outro-structure phase extracted from master prompt document. |
| [plan/resources/youtube-lf-script-prompts/youtube-lf-script-output-template.md](plan/resources/youtube-lf-script-prompts/youtube-lf-script-output-template.md) | **Create** | Source excerpt for final output template extracted from master prompt document. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-extraction.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-extraction.md) | **Create** | Extraction prompt guiding briefing → ExtractionContext conversion. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-pre-script-analysis.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-pre-script-analysis.md) | **Create** | Step 1 prompt: Pre-script analysis from extraction context. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-packaging.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-packaging.md) | **Create** | Step 2 prompt: Packaging strategy from pre-script analysis. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-intro-structure.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-intro-structure.md) | **Create** | Step 3 prompt: Intro structure from packaging. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-body-structure.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-body-structure.md) | **Create** | Step 4 prompt: Body structure from intro. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-native-cta-embeds.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-native-cta-embeds.md) | **Create** | Step 5 prompt: Native CTA embeds from body structure. |
| [apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-outro-structure.md](apps/backend/src/lib/runtime/tool-prompts/youtube-lf-script-outro-structure.md) | **Create** | Step 6 prompt: Outro structure (final artifact) from native CTA embeds. |
| [apps/backend/src/lib/adapters/postgres-redis.production.ts](apps/backend/src/lib/adapters/postgres-redis.production.ts) | **Modify** | Extend normalizeToolWorkflowInputJson() if-guard: add YouTube tool key, final-step detection (`outro-structure`). |
| [apps/backend/src/lib/runtime/auth-http.ts](apps/backend/src/lib/runtime/auth-http.ts) | **Modify** | Update POST `/api/tools/briefs` handler to accept toolKey and route extraction per tool (or with post-validation). |
| [apps/frontend/src/features/tools/machines/tool-flow.machine.ts](apps/frontend/src/features/tools/machines/tool-flow.machine.ts) | **Modify** | Extend SupportedTool union, ToolStep union, add YouTube to toolStepOrder. |
| [apps/frontend/src/features/tools/runtime/tool-form-architecture.ts](apps/frontend/src/features/tools/runtime/tool-form-architecture.ts) | **Modify** | Add YouTube tool entry to toolFormRegistry with `defaultModel: 'openrouter/auto'`; add 6 YouTube step entries to stepCardConfigRegistry. |
| [apps/frontend/src/features/tools/ui/pages/YoutubeLfScriptToolPage.tsx](apps/frontend/src/features/tools/ui/pages/YoutubeLfScriptToolPage.tsx) | **Create** | Minimal page wrapper delegating to ToolPageTemplate (factory pattern). |
| [apps/frontend/src/app/routing/app-router.tsx](apps/frontend/src/app/routing/app-router.tsx) | **Modify** | Add lazy import for `YoutubeLfScriptToolPage`, add to toolPageComponents registry. |
| [apps/frontend/src/app/copy/system.ts](apps/frontend/src/app/copy/system.ts) | **Modify** | Add YouTube tool navigation label, description, step copy, readiness messages. |
| [apps/frontend/src/app/layouts/MainNavigation.tsx](apps/frontend/src/app/layouts/MainNavigation.tsx) | **Modify** | Add YouTube tool route + icon to navigation menu. |
| [apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts](apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts) | **Modify** | Add comprehensive test suite for YouTube orchestration: canonical 6-step dependency resolution, artifact stubs, invalid step rejection. |
| [apps/backend/src/lib/tests/tool-workflow-registry.test.ts](apps/backend/src/lib/tests/tool-workflow-registry.test.ts) | **Create or Modify** | Add unit tests for YouTube tool registry entries, buildWorkflowPlan, resolveStepDependencyIds. |
| [apps/backend/src/lib/tests/generation-system-youtube.test.ts](apps/backend/src/lib/tests/generation-system-youtube.test.ts) | **Create** | Add tests for YouTube tool workflow in generation-system.machine.ts: metadata persistence, artifactRole assignment. |
| [apps/backend/src/lib/tests/artifact-persistence-youtube.test.ts](apps/backend/src/lib/tests/artifact-persistence-youtube.test.ts) | **Create** | Add integration tests for YouTube artifact persistence, artifactRole inference, hydration. |
| [apps/frontend/src/features/tools/tests/tool-page.youtube.test.ts](apps/frontend/src/features/tools/tests/tool-page.youtube.test.ts) | **Create** | Add tests for YouTube tool in tool-page.machine.ts (readiness gate, state transitions). |
| [docs/02-design/frontend-tool-pages-architecture-spec.md](docs/02-design/frontend-tool-pages-architecture-spec.md) | **Update** | Add YouTube tool to examples, architecture diagrams, supported tools list. |
| [docs/02-design/tool-generation-flow.md](docs/02-design/tool-generation-flow.md) | **Update** | Add YouTube tool canonical 6-step flow to flow diagrams and examples. |

---

## 6. Testing

### Unit Tests
- **TEST-001**: Tool Workflow Registry: Verify YouTube tool recognized by `isSupportedToolWorkflow()`, registry entries loaded correctly, `buildWorkflowPlan()` returns canonical 6-step plan, `toolWorkflowStepOrder` includes YouTube.
- **TEST-002**: Step Dependency Resolution: Verify `resolveStepDependencyIds()` resolves pre-script-analysis→packaging→intro-structure→body-structure→native-cta-embeds→outro-structure chain correctly; invalid step keys rejected; dependency order enforced.
- **TEST-003**: Artifact Role Assignment: Verify generation-system.machine.ts correctly assigns artifactRole: 'step' for non-final steps and artifactRole: 'final' for `outro-structure`.
- **TEST-004**: Tool-Form Registry: Verify YouTube tool entry complete (displayName, defaultPrompt, `defaultModel: openrouter/auto`, steps, stepDependencies, defaults), toolStepOrder present, stepCardConfigRegistry has 6 entries.

### Integration Tests
- **TEST-005**: Orchestrate Endpoint: `/api/tools/orchestrate` resolves YouTube tool dependencies; returns correct artifact IDs for each step; rejects invalid steps.
- **TEST-006**: Generation Flow: End-to-end generation from extraction → pre-script-analysis → packaging → intro-structure → body-structure → native-cta-embeds → outro-structure; all intermediate + final artifacts persisted with correct artifactRole.
- **TEST-007**: Artifact Persistence: YouTube artifacts correctly stored in PostgreSQL with toolKey, stepKey, dependencies, input JSON metadata; retrievable and hydration works.
- **TEST-008**: Resume/Regenerate: User can resume from any step N (dependencies pre-loaded); regenerate step N (previous artifacts preserved); session state reconstructed correctly.
- **TEST-009**: Brief Extraction: extraction prompt returns markdown human-readable with required sections; normalization yields canonical `ExtractionContext`; required fields present when available; missing marker maps to `null`.
- **TEST-010**: Frontend State Machines: tool-page.machine.ts readiness gate enforces required fields (`knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`); tool-flow.machine.ts transitions across canonical 6-step graph and stale downstream semantics on regenerate.

### Contract Tests
- **TEST-011**: FE/BE Contract: SupportedTool/ToolStep unions match BE registry (YouTube tool key, canonical 6 step keys). No mismatches.
- **TEST-012**: Registry Cross-References: toolFormRegistry keys match SupportedTool; TOOL_WORKFLOW_REGISTRY keys match SupportedToolWorkflow; PROMPT_FILE_BY_KEY keys match {toolKey}:{stepKey}.

### Smoke/Acceptance Tests
- **TEST-013**: Full Generation Smoke Test: Create YouTube project, upload brief, initiate generation, stream events received for all 6 steps, final artifact retrievable, hydration works, resume from checkpoint succeeds.

---

## 7. Risks & Assumptions

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **RISK-001**: Silent failure due to missing registry extension point | High | Critical | Automated registry cross-reference validation (Phase 8 TASK-052); checklist-driven implementation; code review focusing on registry completeness. |
| **RISK-002**: Artifact role inference diverges between FE/BE (artifactRole not persisted correctly) | High | Critical | Extend persistence logic (postgres-redis.production.ts) in Phase 3 TASK-019; test artifact persistence (Phase 7 TASK-044); validate hydration determinism. |
| **RISK-003**: Resume/regenerate session state corruption due to incomplete checkpoint metadata | Medium | High | Persist complete WorkflowStepBootstrap in artifact input JSON (generation-system.machine.ts); test resume/regenerate flows (Phase 7 TASK-045); validate hydration completeness. |
| **RISK-004**: Extraction schema mismatch between frontend expectations and backend reality | Medium | High | Finalize ExtractionContext schema in Phase 1 (DDD decision); validate schema in extraction endpoint tests (Phase 7 TASK-046); document field requirements per tool in decision log. |
| **RISK-005**: Prompt quality insufficient for 6-step coherence (packaging not aligned with pre-analysis, outro not aligned with native CTA embeds, etc.) | Medium | Medium | Iterative prompt refinement (Phase 6); manual end-to-end testing (Phase 6 TASK-040); include context passing in prompts (each step references prior step output). |
| **RISK-006**: TypeScript compilation errors after union extensions | Low | Medium | Extend SupportedTool/ToolStep unions incrementally (Phase 4 TASK-021/022); compile after each extension; catch errors early. |
| **RISK-007**: Performance regression in orchestration endpoint due to registry lookup overhead | Low | Low | No expected performance impact (registry lookup is O(1) hash); if observed, benchmark and optimize. |
| **RISK-008**: DDD naming conflicts (new ToolKey/ToolSteps collide with deprecated aliases) | Low | Medium | Review decision log aliases before finalizing Phase 1 names; validate no collisions with deprecated terms. |

### Assumptions

| Assumption | Validation |
|-----------|-----------|
| **ASSUMPTION-001**: LLM API (OpenAI GPT-4o) is available and configured for tool generation. | Verify API key in .env.local; test prompt loading (Phase 6 manual test). |
| **ASSUMPTION-002**: Frontend and backend are deployed together; registry changes are synchronized across both layers. | Single monorepo; coordinated deployment; CI/CD ensures both compile. |
| **ASSUMPTION-003**: PostgreSQL + Redis are available for artifact persistence and idempotency. | Existing project infrastructure; no new infrastructure required. |
| **ASSUMPTION-004**: YouTube tool requires canonical 6 linear steps (`pre-script-analysis` → `packaging` → `intro-structure` → `body-structure` → `native-cta-embeds` → `outro-structure`); no parallel or branching logic. | Documented in Phase 1 DDD decision; if requirements change, reassess orchestration pattern. |
| **ASSUMPTION-005**: ExtractionContext schema is sufficient for YouTube tool; no new artifact types or metadata required beyond existing structure. | Schema finalized in Phase 1; if insufficient, extend schema in Phase 2. |
| **ASSUMPTION-006**: Existing test fixtures (artifact stubs, generation request structures) support YouTube tool without modification. | Review fixture patterns in runtime.tools-orchestrate.test.ts; extend if needed. |
| **ASSUMPTION-007**: Frontend routing is fully data-driven from toolFormRegistry; no hardcoded YouTube routes required. | Verified in Phase 4 TASK-028; auto-generation confirmed before Phase 8. |

---

## 8. Related Specifications / Further Reading

- [docs/01-requirements/domain-ubiquitous-language-glossary.md](docs/01-requirements/domain-ubiquitous-language-glossary.md) — Canonical DDD terms (ToolKey, ToolStep, ExtractionContext, WorkflowStep, ArtifactRole, etc.).
- [docs/07-governance/domain-naming-decision-log.md](docs/07-governance/domain-naming-decision-log.md) — DDD naming decisions (reference for decision format and existing tool decisions).
- [docs/02-design/domain-bounded-context-map.md](docs/02-design/domain-bounded-context-map.md) — Bounded context responsibilities and cross-context integration constraints.
- [docs/02-design/frontend-tool-pages-architecture-spec.md](docs/02-design/frontend-tool-pages-architecture-spec.md) — Frontend tool page orchestration, form registry, lazy component loading.
- [docs/02-design/tool-generation-flow-generation-context.md](docs/02-design/tool-generation-flow-generation-context.md) — Multi-step generation orchestration, extraction chain, artifact lifecycle.
- [docs/02-design/tool-generation-flow.md](docs/02-design/tool-generation-flow.md) — Visual flow diagrams for existing tools (funnel-pages, nextland).
- [apps/backend/README.md](apps/backend/README.md) — Backend setup, tooling, test commands.
- [apps/frontend/README.md](apps/frontend/README.md) — Frontend setup, build, test commands.
- **.github/instructions/dominio-ddd-first-workspace.instructions.md** — DDD-first workspace operating policy (mandatory pre-work gate for all code changes).
- **.github/instructions/dominio-ubiquitous-language.instructions.md** — Ubiquitous language maintenance instructions (consistency rules, canonical term usage).

---

## Implementation Execution Notes

### Sequencing & Parallelization

**Serial Phases (Dependencies Block):**
1. **Phase 1 (DDD)** → mandatory prerequisite for all downstream phases.
2. **Phase 8 (Integration)** → blocking validation phase; must complete after Phases 2–7.

**Parallel Execution Windows:**
- **Phases 3 & 4** (Backend Registry & Frontend Registry) can run in parallel after Phase 1 completes (independent registry updates).
- **Phase 5** (Navigation/Copy) can run parallel with Phase 3/4 (minor FE updates, no backend dependencies).
- **Phase 6** (Prompts) can run parallel with Phase 3/4 (but requires DDD phase 1 to finalize step names).
- **Phase 7** (Tests) can begin incrementally as Phase 3/4 code is available (doesn't require Phase 6 to complete; manual smoke tests in Phase 6 can validate prompt quality before Phase 7 automation).

**Recommended Execution Order:**
1. Phase 1 (DDD): 2–3 hours
2. Phases 2, 3, 4, 5 (Parallel): 2–3 hours each (8–12 hours total wall time)
3. Phase 6 (Prompts): 4–6 hours
4. Phase 7 (Tests): 6–8 hours
5. Phase 8 (Integration): 2–4 hours

**Total Estimated Duration**: 3–4 weeks (including iteration, review cycles, and prompt refinement).

### Acceptance Gates

- **Gate 1 (End of Phase 1)**: DDD decision log entries approved; team consensus on YouTube ToolKey, ToolStep names, extraction schema.
- **Gate 2 (End of Phase 3)**: Backend registry entries complete, orchestrate endpoint tests pass, artifact persistence validated.
- **Gate 3 (End of Phase 4)**: Frontend registry entries complete, lazy routing verified, TypeScript compiles.
- **Gate 4 (End of Phase 7)**: Test coverage ≥95%, all orchestration/persistence/hydration tests pass.
- **Gate 5 (End of Phase 8)**: Cross-layer contracts validated, DDD consistency audit passed, ready for production merge.

### Rollback Plan

If YouTube tool must be disabled post-deployment:
1. Remove `'youtube-lf-script'` from SupportedTool union and canonical 6 steps from ToolStep union (FE compilation failure will alert).
2. Remove `'youtube-lf-script'` from SupportedToolWorkflow type (BE compilation failure).
3. Remove `/tools/youtube-lf-script` from navigation and menu.
4. Monitor artifact queries (existing Youtube LF Script artifacts remain in DB; set read-only flag to prevent new generations).
5. Rollback merges to prior commit if critical regressions detected.

