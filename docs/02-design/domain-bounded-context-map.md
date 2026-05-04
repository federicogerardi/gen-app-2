---
status: active
version: 1.5
last-reviewed: 2026-05-04
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
- `requestGatewayMachine` — auth + validation + usage gate
- `idempotencyCoordinatorMachine` — deduplication
- `usageMachine` — quota claim
- `streamTransportMachine` — SSE stream session
- `persistenceBatchMachine` — artifact persistence
- `toolWorkflowMachine` — multi-step tool orchestration; owns `WorkflowStep` lifecycle (descriptor + runtime state) and emits per-step `BackendStreamEvent`
- `extractionChainMachine` — structured extraction fallback

**Key Entities/Value Objects**: `Artifact`, `ArtifactType`, `ArtifactStatus`, `ArtifactFailureReason`, `GenerationRequest`, `RequestId`, `ToolWorkflow`, `ToolKey`, `WorkflowStepType`, `OutputFormat`, `ContentBuffer`, `WorkflowRunMode`, `WorkflowStep`, `WorkflowStepStatus`, `RegistryVersion`, `RegistrySnapshotRef`, `LlmUsageMetrics`, `IdempotencyKey`, `IdempotencyDecision`

**Organizing concept**: `Tool` (DDD-026) is the top-level domain concept. Each Tool is a named capability that chains `WorkflowStep`s of typed execution strategies (`WorkflowStepType`: `extraction`, `generation`, `acquisition`-provisional) over structured user input to produce `Artifact`s. Generation context is the runtime owner of Tool execution; Frontend context is the interaction owner.

**Key Events**: `BackendStreamEvent` (start, chunk, terminal)

**Integration note**: `usageMachine` operates as a delegate actor inside `GenerationSystem` but implements the `ClaimUsage` command owned by the Usage/Quota context. `RequestGateway` performs a quota pre-authorization gate only; the actual atomic quota decrement is executed by `usageMachine` after idempotency is resolved.

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

**Key Value Objects**: `ToolPageViewModel`, `ReadinessSnapshot`, `ReadinessReasonCode`, `CanonicalToolUiState`, `PrimaryActionPolicy`, `SecondaryActionFlags`, `SupportedTool`, `ToolStep`, `ToolStepStatus`, `BriefingFile`, `ExtractionContext`, `HydrationResult`, `GenerationArtifact`  
**Key Domain Services**: `BriefingUpload`  
**Client-Side Projections**: `StepHydration` (projects BE-owned `WorkflowStep` state into FE context; does not own domain logic — see DDD-028)

**Architecture boundary**: Frontend owns interaction and display only. Step ordering authority is BE (`toolWorkflowStepOrder`, `resolveStepDependencyIds`). Step dependency resolution at dispatch time should route through `/api/tools/orchestrate` (BE endpoint). See DDD-C-007 for the current code-level drift.

**Organizing concept**: `SupportedTool` is the Frontend-context identifier for a `Tool` (DDD-026). Frontend owns the interaction layer of a Tool: input intake, step selection, readiness check, and artifact display.

---

## Shared Concepts And Translation Rules

| Shared Concept | Source Context | Target Context | Translation Rule |
| --- | --- | --- | --- |
| `Artifact` | Generation | Frontend/UI | Generation produces `ArtifactDetail`; Frontend consumes `GenerationArtifact` (a trimmed read model). Frontend must not write to Artifact — read-only consumer. |
| `Project` | Usage/Quota | Generation | `projectId` is a shared FK. Generation scopes artifacts to a Project; Usage/Quota scopes quota history to a Project. No translation required — same identifier. |
| `AuthSessionPrincipal` | Auth | Generation | Generation receives `userId` + `role` from Auth. Generation trusts the principal and does not re-validate credentials. |
| `AuthSessionPrincipal` | Auth | Frontend/UI | Frontend reads session state to drive routing and feature visibility. Frontend machines receive `userId` as input — they do not own session lifecycle. |
| `UsageDecision` | Usage/Quota | Generation | The `UsageMachine` wraps `UsageDecision` and emits `USAGE_GRANTED` or `USAGE_REJECTED` events into the `GenerationSystem`. |
| `BackendStreamEvent` | Generation | Frontend/UI | Generation emits SSE events (start, chunk, terminal). Contract authority is Frontend-owned: type definitions live in `frontend/src/features/generation/contracts/backend-stream.ts` and are enforced against BE shapes by a compile-time parity guard (`backend-stream.parity.guard.ts`). Frontend `frontendStreamMachine` consumes and translates to internal machine events. See DDD-023. |
| `ExtractionContext` completeness gate | Frontend/UI | Generation | Before dispatching step 1, Frontend must populate `GenerationRequest.input.briefingText` and `GenerationRequest.input.extractionPayload` deterministically. Payload resolution order: extraction artifact content (raw JSON, fenced JSON, payload envelope) then `sourceRequest.input.extractionPayload` fallback when content is non-JSON (`frontend/src/features/tools/runtime/tools-client.ts:113-329`, `frontend/src/features/tools/ui/ToolPageTemplate.tsx:47-589`, `frontend/src/features/tools/runtime/tools-client.test.ts:134-187`). |
| `WorkflowStep` / `ToolStep` coherence | Generation | Frontend/UI | Frontend-selected `ToolStep` must map to backend `WorkflowStep` execution with deterministic dependency order; each emitted artifact must be step-recognizable in history to preserve linear and understandable UX progression. |
| `ToolWorkflow` / `ToolKey` | Generation ↔ Frontend/UI | both | Two orthogonal identifiers cross the ACL boundary for the same logical Tool. `SupportedTool` (Frontend, kebab-case) is passed as `toolKey` in `GenerationRequest` — no value transformation. `ToolWorkflow` (Generation, snake_case, DB-compatible) is derived independently for artifact routing. `meta_ads` exists only in `ToolWorkflow` (no FE `SupportedTool` counterpart). Convention divergence: DDD-C-005. Context-local coexistence: DDD-C-001. See DDD-025. |
| `ArtifactRelaunch` | Frontend/UI | Generation | Entering a tool from an existing artifact must resolve `HydrationResult` by `ArtifactType`: direct hydration for `extraction`, linked extraction lookup for `content` (via `briefingId`/`extractionArtifactId`). After hydration, Frontend exposes one effective generation-start action (`start-generation`) and applies default runtime intent `regenerate` for artifact-driven relaunch entries. |
| `Tool` | all | all | Cross-context organizing concept (DDD-026). Frontend expresses Tool identity as `SupportedTool`; Generation routes via `ToolWorkflow` and orchestrates steps via `ToolKey`. No value translation at the boundary — `SupportedTool` and `ToolKey` values are identical (kebab-case). `WorkflowStepType` classifies step execution strategies within a Tool's chain (`extraction`, `generation`, `acquisition`-provisional). |

---

## Integration Constraints

| Constraint | Contexts | Rule | Decision |
| --- | --- | --- | --- |
| `ExtractionContext` completeness at step dispatch | Frontend/UI → Generation | Before dispatching step 1, `GenerationRequest.input` must carry both non-empty `briefingText` and structured `extractionPayload`. Payload resolution order: extraction artifact content (raw JSON, fenced JSON, payload envelope) then `sourceRequest.input.extractionPayload` fallback. Sources: `frontend/src/features/tools/runtime/tools-client.ts:113-329`, `frontend/src/features/tools/ui/ToolPageTemplate.tsx:47-589`, `frontend/src/features/tools/runtime/tools-client.test.ts:134-187`. | DDD-021 |
| `WorkflowStep` / `ToolStep` step-recognizability | Generation → Frontend/UI | Frontend-selected `ToolStep` must map to backend `WorkflowStep` execution with deterministic dependency order. Each emitted `Artifact` must remain step-recognizable in history (e.g., `optin`, `quiz`, `vsl`) to preserve linear UX progression and unambiguous relaunch intent. | DDD-004, DDD-020 |
| `ArtifactRelaunch` default runtime intent | Frontend/UI → Generation | Artifact-driven relaunch entries must default to `WorkflowRunMode = regenerate`. The effective post-hydration primary action is always `start-generation`; no secondary entry concept is permitted. | DDD-020 |
