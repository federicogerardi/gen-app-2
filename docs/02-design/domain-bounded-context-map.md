---
status: active
version: 1.1
last-reviewed: 2026-05-03
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

**Key Entities/Value Objects**: `Artifact`, `ArtifactType`, `ArtifactStatus`, `ArtifactFailureReason`, `GenerationRequest`, `RequestId`, `ToolWorkflow`, `OutputFormat`, `ContentBuffer`, `WorkflowRunMode`, `WorkflowStep`, `WorkflowStepStatus`, `RegistryVersion`, `RegistrySnapshotRef`, `LlmUsageMetrics`, `IdempotencyKey`, `IdempotencyDecision`

**Key Events**: `BackendStreamEvent` (start, chunk, terminal)

**Integration note**: `usageMachine` operates as a delegate actor inside `GenerationSystem` but implements the `ClaimUsage` command owned by the Usage/Quota context. `RequestGateway` performs a quota pre-authorization gate only; the actual atomic quota decrement is executed by `usageMachine` after idempotency is resolved.

**Behavioral contract for user-problem resolution**:
- `GenerationSystem` must support both first-time generation (`WorkflowRunMode = new`) and artifact-driven re-entry (`WorkflowRunMode = regenerate` by default after hydration).
- The effective post-hydration primary action remains `start-generation`; runtime intent selection must not fragment the user journey into multiple primary entry concepts.
- In multi-step flows, each completed step contributes deterministic context to downstream steps through dependency-linked artifact references (`stepDependencyArtifactIds`) so each output remains coherent with the requested step.

**Mini Acceptance Criteria (Given/When/Then)**:
- Given a first-time session with valid project and complete `ExtractionContext`, When the user triggers `start-generation`, Then `GenerationSystem` executes with `WorkflowRunMode = new` and emits `BackendStreamEvent` through terminal completion.
- Given an artifact-driven entry with successful `HydrationResult`, When the page becomes ready, Then the effective primary action is `start-generation` and default runtime intent is `regenerate`.
- Given step-1 dispatch preparation, When `GenerationRequest.input` is validated, Then both non-empty `briefingText` and structured `extractionPayload` are required, with deterministic fallback order from artifact content to `sourceRequest.input.extractionPayload`.
- Given a multi-step workflow, When step N completes, Then step N+1 receives deterministic dependency-linked context via `stepDependencyArtifactIds` without dropping prior-step semantics.
- Given artifact history after multi-step execution, When artifacts are rendered and relaunched, Then each `GenerationArtifact` remains step-recognizable and the UX progression stays linear and unambiguous.

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
**Key Domain Services**: `BriefingUpload`, `StepHydration`

---

## Shared Concepts And Translation Rules

| Shared Concept | Source Context | Target Context | Translation Rule |
| --- | --- | --- | --- |
| `Artifact` | Generation | Frontend/UI | Generation produces `ArtifactDetail`; Frontend consumes `GenerationArtifact` (a trimmed read model). Frontend must not write to Artifact — read-only consumer. |
| `Project` | Usage/Quota | Generation | `projectId` is a shared FK. Generation scopes artifacts to a Project; Usage/Quota scopes quota history to a Project. No translation required — same identifier. |
| `AuthSessionPrincipal` | Auth | Generation | Generation receives `userId` + `role` from Auth. Generation trusts the principal and does not re-validate credentials. |
| `AuthSessionPrincipal` | Auth | Frontend/UI | Frontend reads session state to drive routing and feature visibility. Frontend machines receive `userId` as input — they do not own session lifecycle. |
| `UsageDecision` | Usage/Quota | Generation | The `UsageMachine` wraps `UsageDecision` and emits `USAGE_GRANTED` or `USAGE_REJECTED` events into the `GenerationSystem`. |
| `BackendStreamEvent` | Generation | Frontend/UI | Generation emits SSE events (start, chunk, terminal); Frontend `frontendStreamMachine` consumes them and translates to machine events. No shared type — contract defined in `frontend/src/features/generation/contracts/backend-stream.ts`. |
| `ExtractionContext` completeness gate | Frontend/UI | Generation | Before dispatching step 1, Frontend must populate `GenerationRequest.input.briefingText` and `GenerationRequest.input.extractionPayload` deterministically. Payload resolution order: extraction artifact content (raw JSON, fenced JSON, payload envelope) then `sourceRequest.input.extractionPayload` fallback when content is non-JSON (`frontend/src/features/tools/runtime/tools-client.ts:113-329`, `frontend/src/features/tools/ui/ToolPageTemplate.tsx:47-589`, `frontend/src/features/tools/runtime/tools-client.test.ts:134-187`). |
| `WorkflowStep` / `ToolStep` coherence | Generation | Frontend/UI | Frontend-selected `ToolStep` must map to backend `WorkflowStep` execution with deterministic dependency order; each emitted artifact must be step-recognizable in history to preserve linear and understandable UX progression. |
| `ToolWorkflow` | Generation | Frontend/UI | Backend uses `ToolWorkflow` to route to generation logic; Frontend uses `SupportedTool` to drive UI steps. These are parallel representations — see naming conflict DDD-C-001. |
| `ArtifactRelaunch` | Frontend/UI | Generation | Entering a tool from an existing artifact must resolve `HydrationResult` by `ArtifactType`: direct hydration for `extraction`, linked extraction lookup for `content` (via `briefingId`/`extractionArtifactId`). After hydration, Frontend exposes one effective generation-start action (`start-generation`) and applies default runtime intent `regenerate` for artifact-driven relaunch entries. |
