---
status: active
version: 1.8
last-reviewed: 2026-05-07
next-review-date: 2026-08-03
owner: Domain Architecture
---

# Domain Bounded Context Map

## Context Overview
- This document defines the canonical bounded contexts for the `gen-app-2` workspace.
- Four bounded contexts identified: **Generation**, **Auth**, **Usage/Quota**, **Frontend/UI**.
- Relationships follow an **upstream → downstream** dependency model aligned with the XState actor tree.

---

## Context Boundaries

| Context | Responsibility | Upstream/Downstream |
| --- | --- | --- |
| **Generation** | Orchestrates end-to-end artifact production: request routing, streaming, persistence, extraction, and idempotency. | Upstream of: Usage/Quota (consumes quota before generating), Frontend/UI (pushes stream events). Downstream of: Auth (requires authenticated principal). |
| **Auth** | Manages identity: user registration, session lifecycle, role assignment, OAuth linking, and password credentials. | Upstream of: Generation (provides `userId`, `role`), Usage/Quota (provides `userId` for quota lookup), Frontend/UI (drives auth state in machines). |
| **Usage/Quota** | Tracks and enforces per-user generation limits. Records immutable audit history per generation attempt. | Upstream of: Generation (grants/rejects via `UsageDecision`). Downstream of: Auth (scoped by `userId`). |
| **Frontend/UI** | Manages the tool generation page session, step flow, briefing upload, readiness computation, and artifact history hydration. | Downstream of: Generation (consumes `BackendStreamEvent`), Auth (drives session-aware routing), Usage/Quota (displays quota state). |

---

## Context Boundaries — Detail

### Generation Context
**Aggregate Root**: `GenerationSystem`  
**Key Actors (XState machines)**:
- `generationSystemMachine` — top-level orchestrator
- `requestGatewayMachine` — models the intended guard sequence (auth → ownership → modelCheck → usage) but is currently **orphaned**: exported from `machines/index.ts` but not wired into `generationSystemMachine` or any generation entrypoint (see architecture gap below). Wiring or replacement is tracked in the hardening plan (TASK-002).
- `idempotencyCoordinatorMachine` — deduplication; wired as first step of `preGenerationGuards` inside `generationSystemMachine`
- `usageMachine` — quota claim; wired as second step of `preGenerationGuards`, invoked after idempotency is resolved
- `streamTransportMachine` — SSE stream session
- `persistenceBatchMachine` — artifact persistence
- `toolWorkflowMachine` — multi-step tool orchestration; owns `WorkflowStep` lifecycle (descriptor + runtime state) and emits per-step `BackendStreamEvent`
- `extractionChainMachine` — structured extraction fallback

**Key Entities/Value Objects**: `Artifact`, `ArtifactType`, `ArtifactStatus`, `ArtifactFailureReason`, `GenerationRequest`, `RequestId`, `ToolWorkflow`, `ToolKey`, `WorkflowStepType`, `OutputFormat`, `ContentBuffer`, `WorkflowRunMode`, `WorkflowStep`, `WorkflowStepStatus`, `RegistryVersion`, `RegistrySnapshotRef`, `LlmUsageMetrics`, `IdempotencyKey`, `IdempotencyDecision`, `LlmModel`, `LlmModelStatus`, `LlmModelCatalog`, `LlmModelId`, `OwnershipAdapter` (provisional — target type for TASK-002, not yet in `generation.adapters.ts`)

**Organizing concept**: `Tool` (DDD-026) is the top-level domain concept. Each Tool is a named capability that chains `WorkflowStep`s of typed execution strategies (`WorkflowStepType`: `extraction`, `generation`, `acquisition`-provisional) over structured user input to produce `Artifact`s. Generation context is the runtime owner of Tool execution; Frontend context is the interaction owner.

**Key Events**: `BackendStreamEvent` (start, chunk, terminal)

**Architecture gap (pre TASK-002)**: The `preGenerationGuards` compound state in `generationSystemMachine` currently executes `idempotency → usage` with no ownership check. This violates SEC-001 (no quota mutation before ownership validation). The intended sequence — enforced by `requestGatewayMachine` model but not yet wired — is `idempotency → ownershipCheck → usage`. TASK-002 must add an `ownershipCheck` state to `preGenerationGuards` and introduce `OwnershipAdapter` in `generation.adapters.ts`.

**Integration note**: `usageMachine` operates as a delegate actor inside `GenerationSystem` but implements the `ClaimUsage` command owned by the Usage/Quota context. Per REQ-001, the correct guard sequence at generation entrypoints is Authentication → Ownership → Model Availability → Usage Guards; as of 2026-05-18 the ownership step is absent from `preGenerationGuards` and is pending TASK-002.

---

### Auth Context
**Key Entities**: `User`, `AuthSession`, `OAuthAccount`  
**Key Value Objects**: `AuthUserRole`, `AuthUserStatus`, `AuthMethod`, `OAuthProvider`, `AuthSessionPrincipal`, `OAuthStateToken`

**Integration points**:
- `AuthSessionPrincipal` is the shared read model passed from Auth → Generation and Auth → Usage/Quota.
- Role enforcement (`admin` vs `member`) is checked in Auth; Generation trusts the principal.

---

### Usage/Quota Context
**Key Entities**: `QuotaHistory`, `Project`  
**Key Value Objects**: `MonthlyQuota`, `MonthlyUsed`, `QuotaEventStatus`, `UsageDecision`  
**Key Commands**: `ClaimUsage`

**Integration points**:
- Redis is the primary store for real-time quota enforcement (atomic decrement via `RedisQuotaRepository`).
- PostgreSQL stores `quota_history` for audit and billing.
- `Project` is shared with Generation (artifact scoping) — see Shared Concepts below.

---

### Frontend/UI Context
**Aggregate Root**: `ToolPage`  
**Key Actors (XState machines)**:
- `toolPageMachine` — page-level orchestrator
- `briefingUploadMachine` — upload/extraction lifecycle
- `toolFlowMachine` — step-by-step generation flow
- `frontendStreamMachine` — SSE stream consumer

**Key Entities**: `ProductChangelog`, `UserReport`  
**Key Value Objects**: `ToolPageViewModel`, `ReadinessSnapshot`, `ReadinessReasonCode`, `CanonicalToolUiState`, `PrimaryActionPolicy`, `SecondaryActionFlags`, `ToolAvailabilityStatus`, `SupportedTool`, `ToolStep`, `ToolStepStatus`, `BriefingFile`, `ExtractionContext`, `HydrationResult`, `GenerationArtifact`, `LlmModelSelector`, `FeedbackChannel`, `PageStateMessage`, `GlobalFeedbackMessage`, `ProductChangelogStatus`, `UserReportCategory`, `UserReportStatus`, `GitHubIssueLink`  
**Key Policies**: `IssuePublicationPolicy`  
**Key Domain Services**: `BriefingUpload`  
**Client-Side Projections**: `StepHydration` (projects BE-owned `WorkflowStep` state into FE context; does not own domain logic — see DDD-028)

**Feature orchestration concepts (provisional)**: `FeedbackCenterMachine` (XState application-service boundary for changelog publishing and user reporting workflows; see DDD-065)

**Architecture boundary**: Frontend owns interaction and display only. Step ordering authority is BE (`toolWorkflowStepOrder`, `resolveStepDependencyIds`). Step dependency resolution at dispatch time should route through `/api/tools/orchestrate` (BE endpoint). See DDD-C-007 for the current code-level drift.

**Organizing concept**: `SupportedTool` is the Frontend-layer projection of `ToolKey` (DDD-029, cross-context canonical). Frontend owns the interaction layer of a Tool: input intake, step selection, readiness check, and artifact display. `ToolAvailabilityStatus` governs whether a `SupportedTool` is exposed in navigation, dashboard shortcuts, and generated tool routes without changing identity. `ToolFormKey` (`keyof typeof toolFormRegistry`) is the FE form registry implementation type — not a domain term.

---

## Shared Concepts And Translation Rules

| Shared Concept | Source Context | Target Context | Translation Rule |
| --- | --- | --- | --- |
| `Artifact` | Generation | Frontend/UI | Generation produces `ArtifactDetail`; Frontend consumes `GenerationArtifact` (a trimmed read model). Frontend must not write to Artifact — read-only consumer. Artifact History remains non-aggregated under `/artifacts` (listing) and `/artifacts/{artifactId}` (single generation detail). |
| `Project` | Usage/Quota | Generation | `projectId` is a shared FK. Generation scopes artifacts to a Project; Usage/Quota scopes quota history to a Project. No translation required — same identifier. |
| `AuthSessionPrincipal` | Auth | Generation | Generation receives `userId` + `role` from Auth. Generation trusts the principal and does not re-validate credentials. |
| `AuthSessionPrincipal` | Auth | Frontend/UI | Frontend reads session state to drive routing and feature visibility. Frontend machines receive `userId` as input — they do not own session lifecycle. |
| `AuthSessionPrincipal` (admin gate) | Auth | Frontend/UI | Admin-only actions for changelog publication and report triage/escalation must be guarded by `AuthUserRole = 'admin'`. Member principals can submit reports and read published changelog entries only. See DDD-065. |
| `UsageDecision` | Usage/Quota | Generation | The `UsageMachine` wraps `UsageDecision` and emits `USAGE_GRANTED` or `USAGE_REJECTED` events into the `GenerationSystem`. |
| `BackendStreamEvent` | Generation | Frontend/UI | Generation emits SSE events (start, chunk, terminal). Contract authority is shared: type definitions live in `packages/contracts/src/index.ts` and are enforced against BE shapes by a compile-time parity guard (`packages/contracts/src/parity.guard.ts`). Frontend `frontendStreamMachine` consumes and translates to internal machine events. See DDD-023. |
| `ExtractionContext` completeness gate | Frontend/UI | Generation | Before dispatching step 1, Frontend must populate `GenerationRequest.input.briefingText` and `GenerationRequest.input.extractionPayload` deterministically. Payload resolution order: extraction artifact content (raw JSON, fenced JSON, payload envelope) then `sourceRequest.input.extractionPayload` fallback when content is non-JSON (`apps/frontend/src/features/tools/runtime/useToolPage.ts:358-453`, `apps/frontend/src/features/generation/runtime/step-hydration.ts:54-138`, `apps/frontend/src/features/tools/runtime/tools-client.test.ts:134-187`). |
| `WorkflowStep` / `ToolStep` coherence | Generation | Frontend/UI | Frontend-selected `ToolStep` must map to backend `WorkflowStep` execution with deterministic dependency order; each emitted artifact must be step-recognizable in history to preserve linear and understandable UX progression. |
| `ToolWorkflow` / `ToolKey` | Generation ↔ Frontend/UI | both | `ToolKey` is the cross-context canonical identifier for Tool identity (DDD-029). At the Generation ↔ Frontend/UI boundary: `SupportedTool` (Frontend, kebab-case) is passed as the `toolKey` field in `GenerationRequest` — no value transformation required. Canonical values include `funnel-pages`, `nextland`, `youtube-lf-script` (DDD-040). `ToolWorkflow` (Generation, snake_case, DB-compatible) is derived independently for artifact routing and is not the same concept as `ToolKey`; canonical values include `funnel_pages`, `nextland`, `youtube_lf_script`, and `extraction` route-type (DDD-040). `meta_ads` is deprecated and must be removed from `ToolWorkflow` value sets (DDD-030). Convention divergence between kebab and snake_case: DDD-C-005 (open). See DDD-029, DDD-030, DDD-040. |
| `ExtractionContext` schema (youtube-lf-script) | Generation | Frontend/UI | For `youtube-lf-script`, canonical extraction fields are `knowledge_content`, `avatar`, `pain_point`, `purchase_process_type`, `offer`, `proof`, `tone`, `target_duration_minutes`, `proprietary_methodology_disclosure`. Missing fields are normalized to `null` (no inferred defaults). The extracted `tone` field is briefing-derived business context and is distinct from both the fixed extraction job tone and the user-selected `ToneProfile` of generation steps. See DDD-042. |
| `/api/tools/briefs` toolKey precedence | Generation | Frontend/UI | Endpoint accepts `toolKey` in query and body; precedence is `body > query`; missing value in both paths returns HTTP `400` with explicit validation error. See DDD-044. |
| `ToolStep` sequence (youtube-lf-script) | Frontend/UI | Generation | Canonical prompt-chat-faithful sequence: `pre-script-analysis` → `packaging` → `intro-structure` → `body-structure` → `native-cta-embeds` → `outro-structure`. Final-step artifact role applies to `outro-structure`. See DDD-041. |
| `ToneProfile` | Frontend/UI | Generation | **Provisional** — `ToneProfile` applies only to `WorkflowStepType = 'generation'` requests. Target governance is a Tool Workspace Page selector in the Setup Panel whose selected value is forwarded in `GenerationRequest.input.tone` for generation and regenerate dispatches. The extraction job is explicitly excluded: `WorkflowStepType = 'extraction'` uses the fixed operational tone `analitico` for job consistency. Target governance remains tracked in DDD-039. |
| `ArtifactRelaunch` | Frontend/UI | Generation | Entering a tool from an existing artifact must resolve `HydrationResult` by `ArtifactType`: direct hydration for `extraction`, linked extraction lookup for `content` (via `briefingId`/`extractionArtifactId`). Readiness completeness is text-first per DDD-038: hydration is complete when the recovered context includes `extractionArtifactId`, `briefingId`, and non-empty normalized briefing text. `extractionPayload` is optional passthrough for dispatch (DDD-021), not part of the readiness gate. In relaunch-init (`prefilled-regenerate`), the effective primary action is `regenerate-current-step`; `start-generation` is reserved for `intent='new'` first-time generation. Default runtime intent for artifact-driven relaunch entries remains `regenerate`. See DDD-020 and DDD-038. |
| `GenerationRequestAssembly` | Frontend/UI → Generation | Generation (output) | **Provisional** — Application-Layer process that translates accumulated FE session state (`HydrationResult` + `ExtractionContext` + selected `ToolStep`) into a well-formed `GenerationRequest`. Content step dispatch implemented in `apps/frontend/src/features/tools/runtime/useToolPage.ts:431-453`; extraction request assembly in `apps/frontend/src/features/tools/runtime/tools-client.ts:155-180`. Frontend executes the process; Generation owns the output command. See DDD-032. |
| `ToolWorkflowPersistenceMetadata` | Generation | Frontend/UI | Written by BE at artifact creation time (`buildToolWorkflowPersistenceMetadata` in `generation-system.machine.ts`); stored in the artifact input JSON under the `toolWorkflow` key. Consumed by FE `StepHydration` to reconstruct step context for resume/regenerate flows. Carries `ArtifactRole`, `WorkflowRunMode`, `stepKey`, `WorkflowStepBootstrap` (resume point), dependency artifact IDs. Frontend is read-only consumer — must not write to this object. See DDD-034, DDD-037. |
| `WorkflowStepBootstrap` | Generation | Frontend/UI, Generation (internal) | Shape: `{ stepKey, output, artifactId }`. Injected into `ToolWorkflowMachine` at resume/regenerate dispatch time to specify the resume starting point and prior step completion state. Generated by `ToolWorkflowPersistenceMetadata` hydration (`StepHydration` FE) and injected by BE when constructing `ToolWorkflowInput`. See DDD-037. |
| `Tool` | all | all | Cross-context organizing concept (DDD-026). Frontend expresses Tool identity as `SupportedTool`; Generation routes via `ToolWorkflow`; `ToolKey` is the cross-context canonical identifier expressed in both layers — `SupportedTool` (Frontend) and `toolKey` field in `GenerationRequest` (Generation). No value translation at the boundary — `SupportedTool` and `ToolKey` values are identical (kebab-case). `WorkflowStepType` classifies step execution strategies within a Tool's chain (`extraction`, `generation`, `acquisition`-provisional). |
| `FeedbackChannel` (`inline-action`, `page-state`, `global`) | Frontend/UI | Frontend/UI | Frontend feedback ownership is deterministic by channel: `inline-action` for action-scoped messages (`DispatchError`, field/form failures), `page-state` for query/list lifecycle (`LoadingStateMessage`, `ErrorStateMessage`, `EmptyStateMessage`), `global` for cross-page mutation outcomes (`GlobalFeedbackMessage`, provisional). Channel mapping prevents overlap where one concern is rendered by multiple message systems. See DDD-063. |
| `UserReport` -> `GitHubIssueLink` | Frontend/UI | Frontend/UI | `UserReport` remains the local source of truth even when escalation publishes an external GitHub issue. `GitHubIssueLink` is an attached integration projection (`repository`, `issueNumber`, `issueUrl`) and does not replace local report identity. See DDD-065. |
| `IssuePublicationPolicy` | Frontend/UI | Frontend/UI | `UserReportCategory = issue` and `feature-request` are eligible for GitHub publication. Category `other` remains a local backlog item. See DDD-065. |
| `GenerationSession` -> `SessionSummary` | Generation | Frontend/UI | Canonical aggregate-listing contract: `GET /api/tools/sessions` returns `SessionSummary[]` for session-level archive/navigation (`sessionId`, `projectId`, `toolKey`, `status`, `artifactCount`, `updatedAt`). Canonical Frontend navigation namespace is `sessionsummary`: listing `/sessionsummary`, aggregate-detail `/sessionsummary/{sessionId}`. Project detail contextual navigation must use the same `SessionSummary` projection filtered by `projectId` (not artifact list semantics). During transition, FE may derive `SessionSummary` from artifact listing where backend endpoint rollout is pending. Listing primacy is a UX implementation policy only, not a domain invariant. See DDD-051 and DDD-052. |
| `GenerationSession` -> `SessionArtifactGroup` | Generation | Frontend/UI | Backend owns session aggregation (`GenerationSession`) and exposes deterministic query projections; Frontend consumes `SessionArtifactGroup` as read model via `/api/tools/sessions/{sessionId}` and `/api/tools/sessions/{sessionId}/step/{stepKey}`. Session-level completeness augments display orchestration and does not weaken step-level readiness constraints (`ReadinessSnapshot`, DDD-043). |
| `LlmModelCatalog` -> `LlmModelSelector` | Generation | Frontend/UI | Generation context owns the `LlmModelCatalog` (admin-managed `LlmModel` collection persisted in `llm_models` table). Frontend consumes the catalog read-only via `GET /api/models` (returns `enabled` entries only) and projects it as the `LlmModelSelector` `<select>` control. The selected value is the `LlmModelId`, carried as `GenerationRequest.model`. Admin CRUD (`POST/PUT/DELETE /api/admin/models`) is role-gated (`AuthUserRole = 'admin'`). Default fallback: `openrouter/auto` (DDD-046, DDD-056). See DDD-053, DDD-055, DDD-057. |

---

## Integration Constraints

| Constraint | Contexts | Rule | Decision |
| --- | --- | --- | --- |
| `ExtractionContext` completeness at step dispatch | Frontend/UI → Generation | Before dispatching step 1, `GenerationRequest.input` must carry both non-empty `briefingText` and structured `extractionPayload`. Payload resolution order: extraction artifact content (raw JSON, fenced JSON, payload envelope) then `sourceRequest.input.extractionPayload` fallback. Sources: `apps/frontend/src/features/tools/runtime/useToolPage.ts:358-453`, `apps/frontend/src/features/generation/runtime/step-hydration.ts:54-138`, `apps/frontend/src/features/tools/runtime/tools-client.test.ts:134-187`. | DDD-021 |
| `HydrationResult` completeness before readiness | Frontend/UI | Artifact-driven relaunch must not set `ReadinessSnapshot.hasExtractionContext = true` solely because a `HydrationResult` object exists. The hydrated context is complete only when it recovers `extractionArtifactId`, `briefingId`, and non-empty normalized briefing text from artifact sources. `extractionPayload` is optional passthrough and is not part of the readiness predicate. Local FE hydration and `/api/tools/hydrate` must follow the same semantic contract. | DDD-038 |
| `ReadinessSnapshot` minimum fields (youtube-lf-script) | Frontend/UI | For `youtube-lf-script`, readiness requires non-null extraction values for `knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`. Remaining canonical extraction fields can be `null` without blocking generation start. | DDD-043 |
| `ToneProfile` dispatch handling (provisional) | Frontend/UI → Generation | `GenerationRequest.input.tone` must be interpreted by step type. For `WorkflowStepType = 'generation'`, the value belongs to provisional `ToneProfile` governance and the target source of truth is the user-selected Tool Workspace Page selector. For `WorkflowStepType = 'extraction'`, the execution tone is fixed to `analitico` for job consistency and is not user-configurable. The constrained-value/select-control governance target for generation steps remains tracked as provisional in DDD-039. | DDD-039 |
| `youtube-lf-script` output policy | Frontend/UI → Generation | Generation output language is always Italian. Model remains user-selected in Frontend; default input value is `openrouter/auto`. | DDD-046 |
| Regenerate stale downstream policy | Frontend/UI ↔ Generation | When a non-terminal step is regenerated, downstream artifacts remain stored and readable but must be marked `stale` and cannot be finalized until recomputed in canonical order. | DDD-045 |
| `WorkflowStep` / `ToolStep` step-recognizability | Generation → Frontend/UI | Frontend-selected `ToolStep` must map to backend `WorkflowStep` execution with deterministic dependency order. Each emitted `Artifact` must remain step-recognizable in history (e.g., `optin`, `quiz`, `vsl`) to preserve linear UX progression and unambiguous relaunch intent. | DDD-004, DDD-020 |
| `ArtifactRelaunch` default runtime intent | Frontend/UI → Generation | Artifact-driven relaunch entries must default to `WorkflowRunMode = regenerate`. In relaunch-init (`prefilled-regenerate`), the effective post-hydration primary action is `regenerate-current-step`; `start-generation` is reserved for `intent='new'` first-time generation. No secondary relaunch entry concept is permitted. | DDD-020 |
| `ToolStepOrchestration` target pattern | Generation ↔ Frontend/UI | Step dependency resolution at dispatch time must route through `resolveStepDependencyIds` (BE) via `/api/tools/orchestrate` endpoint. FE `orchestrateToolStep` (`tools-client.ts:339`) is the intended adapter — currently zero runtime callers (DDD-C-007). FE `getStepDependencies` is the current production implementation but is flagged as architecture drift. Resolution: see DDD-031 (provisional term `ToolStepOrchestration`). | DDD-031, DDD-C-007 |
| `WorkflowStepUnlocked` / `WorkflowStepCompleted` (internal progression) | Generation | Generation (internal) | Internal domain events in `toolWorkflowMachine` that represent step state progression: unlock signals dependency satisfaction; completion signals step output ready and unblocks dependents. Do not cross process boundary. Fundamental to multi-step deterministic execution. See DDD-035, DDD-036. | DDD-035, DDD-036 |
| Frontend route namespace separation (`artifacts` vs `sessionsummary`) | Frontend/UI ↔ Generation | Route ownership must be deterministic: non-aggregated artifact history and single generation detail stay under `/artifacts` and `/artifacts/{artifactId}`; session aggregate navigation stays under `/sessionsummary` and `/sessionsummary/{sessionId}`. Backend endpoint contracts remain `/api/artifacts` for artifact history/detail and `/api/tools/sessions` (+ detail endpoints) for session aggregates. Transitional overload `/artifacts/{sessionId}` is deprecated and must not be promoted. | DDD-052 |
| `LlmModelCatalog` admin CRUD role gate | Frontend/UI → Generation | Write operations on `LlmModelCatalog` (`POST/PUT/DELETE /api/admin/models`) require `AuthUserRole = 'admin'`. Read operations (`GET /api/models`) return `enabled` entries only for all authenticated users. Frontend `LlmModelSelector` must fall back to default `LlmModelId` (`openrouter/auto`) when the catalog endpoint is unavailable. | DDD-053, DDD-055, DDD-057 |
| `FeedbackChannel` routing and ownership | Frontend/UI | Frontend must map user feedback deterministically by channel. `DispatchError` remains `inline-action` in Tool Workspace Page setup area; Data Table and page query states remain `page-state` via `PageStateMessage`; `global` channel is reserved for cross-page mutation outcomes (`GlobalFeedbackMessage`, provisional) and must not replace `inline-action` or `page-state` rendering. | DDD-063 |
| `ProductChangelog` publication role gate | Auth → Frontend/UI | `ProductChangelog` create/update/publish actions require admin principal (`AuthUserRole = 'admin'`). Non-admin users can only read published changelog entries. | DDD-065 |
| `UserReportCategory` canonical value set | Frontend/UI | Accepted categories are fixed to `issue`, `feature-request`, `other`. Synonyms such as `bug`, `problem`, `request`, `ticket` must be normalized to canonical categories at the boundary and not persisted as primary values. | DDD-065 |
| `IssuePublicationPolicy` escalation gate | Frontend/UI | GitHub publication is allowed only when `UserReport.category` is `issue` or `feature-request`. External publication failure must not delete local `UserReport`; status remains local and recoverable (`submitted` or `triaged`) until escalation succeeds. | DDD-065 |
