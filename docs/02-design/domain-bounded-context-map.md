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
- `toolWorkflowMachine` — multi-step tool orchestration
- `extractionChainMachine` — structured extraction fallback

**Key Entities/Value Objects**: `Artifact`, `ArtifactType`, `ArtifactStatus`, `ArtifactFailureReason`, `GenerationRequest`, `RequestId`, `ToolWorkflow`, `OutputFormat`, `ContentBuffer`, `WorkflowRunMode`, `WorkflowStep`, `WorkflowStepStatus`, `RegistryVersion`, `RegistrySnapshotRef`, `LlmUsageMetrics`, `IdempotencyKey`, `IdempotencyDecision`

**Key Events**: `BackendStreamEvent` (start, chunk, terminal)

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

**Key Value Objects**: `ToolPageViewModel`, `ReadinessSnapshot`, `ReadinessReasonCode`, `CanonicalToolUiState`, `PrimaryActionPolicy`, `SupportedTool`, `ToolStep`, `ToolStepStatus`, `BriefingFile`, `ExtractionContext`, `HydrationResult`, `GenerationArtifact`  
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
| `ToolWorkflow` | Generation | Frontend/UI | Backend uses `ToolWorkflow` to route to generation logic; Frontend uses `SupportedTool` to drive UI steps. These are parallel representations — see naming conflict DDD-C-001. |
