---
status: active
version: 1.1
last-reviewed: 2026-05-03
next-review-date: 2026-08-03
owner: Domain Architecture
---

# Domain Ubiquitous Language Glossary

## Scope
- Canonical domain vocabulary for the current workspace (`gen-app-2`).
- Source of truth for domain terms used across analysis, development, testing, operations, and user documentation.
- Bounded contexts covered: **Generation**, **Auth**, **Usage/Quota**, **Frontend/UI**.

---

## Canonical Terms

### Generation Context

| Term | Type | Definition | Source | Status |
| --- | --- | --- | --- | --- |
| Artifact | Entity | The persisted output of a single generation attempt. Carries a lifecycle (generating → completed \| failed), type, cost, and token metrics. | `db/migrations/20260424_000001_generation_adapters_minimal.sql`, `src/lib/types/artifact.ts` | canonical |
| ArtifactType | Value Object | Category of the artifact output, determines output handling, agent selection, and audit classification. Values: `content`, `seo`, `code`, `extraction`. | `src/lib/types/artifact.ts:7-8` | canonical |
| ArtifactStatus | Value Object | Lifecycle state of an artifact. Values: `generating`, `completed`, `failed`. | `src/lib/types/artifact.ts:11-12` | canonical |
| ArtifactFailureReason | Value Object | Audit trail code explaining why an artifact failed. Values: `client_disconnect`, `timeout`, `error`, `stale`. | `src/lib/types/artifact.ts:15-22` | canonical |
| GenerationRequest | Command | The input command that initiates a generation. Carries `requestId`, `userId`, `projectId`, `artifactType`, `model`, `input`, `toolKey`, `workflowType`, `idempotencyKey`, `outputFormat`, optional registry selectors, and optional step-level fields `briefingId`, `extractionArtifactId`, `stepDependencyArtifactIds`. | `frontend/src/features/generation/contracts/backend-stream.ts:4-21` | canonical |
| RequestId | Value Object | Unique identifier for a generation request. Scopes idempotency checks and stream session routing. | `src/lib/types/xstate.ts`, `db/migrations/20260424_000001_generation_adapters_minimal.sql` | canonical |
| ToolWorkflow | Value Object | Identifier that maps a generation request to a specific tool route and determines the artifact type. Values: `meta_ads`, `funnel_pages`, `nextland`, `extraction`. | `src/lib/types/artifact.ts:24-26` | canonical |
| OutputFormat | Value Object | Formatting contract for the streamed response. Values: `plain`, `json`, `markdown`. | `src/lib/types/artifact.ts:31-33` | canonical |
| ContentBuffer | Concept | Transient in-memory accumulator for streamed LLM output chunks before final persistence. | `src/lib/types/xstate.ts` (field `contentBuffer` on `GenerationSystemContext`) | canonical |
| WorkflowRunMode | Value Object | Intent of a generation invocation relative to prior runs. Values: `new`, `resume`, `regenerate`. | `src/lib/types/xstate.ts:22` | canonical |
| WorkflowStep | Entity | A single named step within a multi-step tool generation flow. Carries its own status lifecycle. | `src/lib/types/xstate.ts` (`WorkflowStepDescriptor`, `WorkflowStepState`) | canonical |
| WorkflowStepStatus | Value Object | Status of a single WorkflowStep. Values: `idle`, `running`, `done`, `error`, `skipped`. | `src/lib/types/xstate.ts:23` | canonical |
| RegistryVersion | Value Object | Version identifier for a tool configuration snapshot in the tool registry. | `src/lib/types/xstate.ts` | canonical |
| RegistrySnapshotRef | Value Object | Content-addressable reference to a specific tool registry snapshot. | `src/lib/types/xstate.ts` | canonical |
| LlmUsageMetrics | Value Object | Measured cost and token counters for a completed generation: `inputTokens`, `outputTokens`, `costUsd`. | `src/lib/types/xstate.ts` | canonical |
| GenerationSystem | Aggregate Root | The XState actor tree orchestrating the end-to-end lifecycle of a single generation: gateway → idempotency → usage → stream → persistence. | `src/lib/machines/generation-system.machine.ts` | canonical |
| StreamTransport | Domain Service | Actor managing the SSE streaming session from the LLM to the backend. Emits `chunk`, `heartbeat`, `completed` events. | `src/lib/machines/stream-transport.machine.ts` | canonical |
| PersistenceBatch | Domain Service | Actor responsible for flushing incremental chunks and finalizing the artifact in the database. | `src/lib/machines/persistence-batch.machine.ts` | canonical |
| ExtractionChain | Domain Service | Actor running the extraction workflow: attempts structured extraction from LLM output, falls back to text. | `src/lib/machines/extraction-chain.machine.ts` | canonical |
| IdempotencyCoordinator | Domain Service | Actor that checks and atomically claims an idempotency slot to prevent duplicate artifact generation. | `src/lib/machines/idempotency-coordinator.machine.ts` | canonical |
| IdempotencyKey | Value Object | Client-supplied deduplication token scoped to `(userId, projectId, endpoint)`. | `db/migrations/20260424_000001_generation_adapters_minimal.sql` | canonical |
| IdempotencyDecision | Value Object | Result of an idempotency check. Values: `claimed`, `replay`, `conflict`. | `src/lib/adapters/generation.adapters.ts:37-41` | canonical |
| RequestGateway | Domain Service | Actor performing pre-generation validation: auth, input validation, model availability, project ownership, and usage check. | `src/lib/machines/request-gateway.machine.ts` | canonical |
| BackendStreamEvent | Domain Event | Server-Sent Event emitted during a generation. Types: `start` (artifact created), `chunk` (incremental content), `terminal` (final status). | `frontend/src/features/generation/contracts/backend-stream.ts:20-30` | canonical |

---

### Auth Context

| Term | Type | Definition | Source | Status |
| --- | --- | --- | --- | --- |
| User | Entity | A registered account in the system. Carries identity, role, status, quota, and optional password credentials. | `db/migrations/20260424_000001_generation_adapters_minimal.sql`, `src/lib/types/auth.ts` | canonical |
| AuthUserRole | Value Object | Access control level for a User. Values: `admin`, `member`. | `src/lib/types/auth.ts:3-4` | canonical |
| AuthUserStatus | Value Object | Operational state of a User account. Values: `active`, `disabled`, `pending_password_reset`. | `src/lib/types/auth.ts:7-8` | canonical |
| AuthMethod | Value Object | Authentication mechanism used for a session. Values: `native` (email+password), `google` (OAuth). | `src/lib/types/auth.ts:11-12` | canonical |
| AuthSession | Entity | A live authenticated session binding a User to a session token. Tracks IP, user-agent, expiry, and revocation. | `src/lib/types/auth.ts` (`AuthSessionRecord`) | canonical |
| AuthSessionPrincipal | Value Object | Composite read model combining an AuthSession with the minimal User identity (`id`, `email`, `role`, `status`). | `src/lib/types/auth.ts:46-49` | canonical |
| OAuthProvider | Value Object | External identity provider used for OAuth authentication. Values: `google`. | `src/lib/types/auth.ts:15-16` | canonical |
| OAuthAccount | Entity | The link between a User and an external OAuth identity, storing the provider subject and email at provider. | `src/lib/types/auth.ts` (`OAuthAccountRecord`) | canonical |
| OAuthStateToken | Value Object | Short-lived PKCE/CSRF token generated at the start of an OAuth flow; consumed once upon callback. | `src/lib/types/auth.ts` (`OAuthStateTokenRecord`) | canonical |

---

### Usage / Quota Context

| Term | Type | Definition | Source | Status |
| --- | --- | --- | --- | --- |
| MonthlyQuota | Value Object | The maximum number of generation requests allowed for a User in the current billing period. | `db/migrations/20260424_000001_generation_adapters_minimal.sql` (column `monthly_quota`) | canonical |
| MonthlyUsed | Value Object | The counter of generation requests consumed by a User in the current billing period. | `db/migrations/20260424_000001_generation_adapters_minimal.sql` (column `monthly_used`) | canonical |
| QuotaHistory | Entity | An immutable audit record of a single generation attempt, capturing outcome, token counts, cost, and metadata. | `db/migrations/20260424_000001_generation_adapters_minimal.sql` (table `quota_history`) | canonical |
| QuotaEventStatus | Value Object | Outcome classification for a QuotaHistory entry. Values: `success`, `error`, `rate_limited`. | `src/lib/types/artifact.ts:29-30` | canonical |
| UsageDecision | Value Object | Result of a quota claim attempt: `{ granted: boolean, reason?: string }`. | `src/lib/adapters/generation.adapters.ts:33-36` | canonical |
| ClaimUsage | Command | The atomic operation that checks a User's remaining quota and, if sufficient, decrements it to permit generation. | `src/lib/machines/usage.machine.ts` (`claimUsage` actor) | canonical |
| Project | Entity | A named workspace owned by a User that groups related Artifacts. | `db/migrations/20260424_000001_generation_adapters_minimal.sql` (table `projects`), `src/lib/types/projects.ts` | canonical |

---

### Frontend / UI Context

| Term | Type | Definition | Source | Status |
| --- | --- | --- | --- | --- |
| ToolPage | Aggregate Root | The frontend page that manages the full lifecycle of a tool generation session, from project selection to multi-step generation completion. | `frontend/src/features/tools/machines/tool-page.machine.ts` | canonical |
| ToolPageViewModel | Value Object | The derived read model exposed to React components, combining readiness, canonical UI state, primary action policy, and secondary action flags. | `frontend/src/features/tools/machines/tool-page.machine.ts:57-61` | canonical |
| ReadinessSnapshot | Value Object | A computed snapshot indicating whether a ToolPage can start generation, with typed reason codes for any blocking condition. | `frontend/src/features/tools/machines/tool-page.machine.ts:43-50`, `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` | canonical |
| ReadinessReasonCode | Value Object | A typed code explaining why a ToolPage is not ready to start. Values: `missing_project`, `missing_extraction_context`, `missing_primary_target_step`. | `frontend/src/features/tools/machines/tool-page.machine.ts:37-41` | canonical |
| CanonicalToolUiState | Value Object | The canonical enumeration of UI states for a ToolPage, used to drive conditional rendering without ad-hoc flags. Values: `draft-empty`, `processing-briefing`, `draft-ready`, `prefilled-regenerate`, `paused-with-checkpoint`, `resume-needs-briefing`, `running`, `completed`. | `frontend/src/features/generation/ui/tool-ux-state.ts` | canonical |
| PrimaryActionPolicy | Value Object | Policy object controlling the label, enabled state, and action of the primary CTA on the tool page. Values: `disabled`, `start-generation`, `resume-checkpoint`, `open-last-artifact`, `regenerate-current-step`. | `frontend/src/features/generation/ui/tool-ux-state.ts` | canonical |
| SecondaryActionFlags | Value Object | Boolean flags determining which secondary CTAs are visible on the tool page. Fields: `canRetry`, `canSkipStep`, `canCancelGeneration`, `canOpenPreviousArtifact`. | `frontend/src/features/generation/ui/tool-ux-state.ts` | canonical |
| SupportedTool | Value Object | Identifier for a tool available in the system. Values: `funnel-pages`, `nextland`. | `frontend/src/features/tools/machines/tool-flow.machine.ts:3` | canonical |
| ToolStep | Value Object | A named step within a SupportedTool's generation flow. Values (by tool): `optin`, `quiz`, `vsl` (funnel-pages); `landing`, `thank_you` (nextland). | `frontend/src/features/tools/machines/tool-flow.machine.ts:4` | canonical |
| ToolStepStatus | Value Object | Runtime status of a ToolStep. Values: `idle`, `running`, `done`, `error`. | `frontend/src/features/tools/machines/tool-flow.machine.ts:5` | canonical |
| BriefingUpload | Domain Service | The frontend actor managing the lifecycle of a briefing file: upload, extraction, normalization, and recovery from prior extraction artifacts. | `frontend/src/features/tools/machines/briefing-upload.machine.ts` | canonical |
| BriefingFile | Value Object | The uploaded source file (txt, md, docx) from which extraction context is derived. | `frontend/src/features/tools/machines/briefing-upload.machine.ts` (field `file`) | canonical |
| ExtractionContext | Value Object | The structured payload extracted from a BriefingFile, used as input context for generation steps. | `frontend/src/features/generation/machines/frontend-stream.machine.ts:21` | canonical |
| HydrationResult | Value Object | The complete state snapshot produced when entering a ToolPage from an existing Artifact. Resolution is deterministic by source `ArtifactType`: `extraction` artifacts are hydrated directly, while `content` artifacts hydrate by resolving the referenced extraction context (`briefingId` and/or `extractionArtifactId`). | `frontend/src/features/tools/machines/tool-page.machine.ts:22-30`, `frontend/src/features/tools/machines/tool-page.machine.ts:506-606` | canonical |
| StepHydration | Domain Service | The process of recovering prior WorkflowStep completion state from artifact history to enable resume/regenerate flows. | `frontend/src/features/generation/runtime/step-hydration.ts` | canonical |
| GenerationArtifact | Value Object | The frontend read model of an artifact as displayed in artifact history, carrying step association and content. | `frontend/src/features/generation/ui/artifact-history.ts` | canonical |
| ArtifactRelaunch | Concept | The user action that starts a new generation cycle from an existing Artifact by opening the ToolPage in a hydrated ready state (project and extraction context preloaded), regardless of source `ArtifactType`. Domain UX requires one relaunch concept, one effective primary CTA (`start-generation`), and default runtime intent `regenerate` for artifact-driven relaunch entries. | `frontend/src/features/generation/ui/artifact-history.ts:28-34`, `frontend/src/features/tools/ui/ToolPageTemplate.tsx:225-237`, `frontend/src/features/tools/machines/tool-page.machine.ts:909-946` | canonical |

---

## Aliases And Deprecated Terms

| Alias/Deprecated Term | Canonical Term | Notes |
| --- | --- | --- |
| `workflow_type` (DB column) | ToolWorkflow | Snake-case DB column name; canonical code term is `ToolWorkflow`. |
| `artifact_type` (DB column) | ArtifactType | Snake-case DB column name. |
| `monthly_quota` / `monthly_used` (DB columns) | MonthlyQuota / MonthlyUsed | Mapped to camelCase in TypeScript types. |
| `requestIdempotency` (DB table) | IdempotencyCoordinator / IdempotencyKey | Table represents the persistence layer for idempotency logic. |
| `quota_history` (DB table) | QuotaHistory | DB table name; canonical term is `QuotaHistory`. |
| `ToolExtractionContext` | ExtractionContext | Former name in `frontend-stream.machine.ts`. Deprecated DDD-012; backward-compat alias in `tool-form-architecture.ts`. |
| `BriefingContext` | ExtractionContext | Former definition in `tool-form-architecture.ts`. Deprecated DDD-012; replaced with `export type BriefingContext = ExtractionContext`. |
| `ToolPageReadinessSnapshot` | ReadinessSnapshot | Former name in `tool-page.machine.ts`. Deprecated DDD-014; alias removed in 2026-05-03 quality audit. |
| `ToolPageReadinessReasonCode` | ReadinessReasonCode | Former name in `tool-page.machine.ts`. Deprecated DDD-014; alias removed in 2026-05-03 quality audit. |
| `ToolRegistryVersion` | RegistryVersion | Former name in `src/lib/types/xstate.ts`. Deprecated DDD-015; backward-compat alias `ToolRegistryVersion = RegistryVersion` maintained. |
| `ToolRegistrySnapshotRef` | RegistrySnapshotRef | Former name in `src/lib/types/xstate.ts`. Deprecated DDD-015; backward-compat alias maintained. |
| `StreamUsageMetrics` | LlmUsageMetrics | Former interface in `xstate.ts`. Deprecated DDD-016; backward-compat alias `StreamUsageMetrics = LlmUsageMetrics` maintained. |
| `PersistedArtifactStatus` | ArtifactStatus | Former type in `generation.adapters.ts`. Deprecated DDD-017; backward-compat alias `PersistedArtifactStatus = ArtifactStatus` maintained. |
| `relaunchPrimary` / `relaunchSecondary` (UI copy keys) | ArtifactRelaunch | Deprecated UI copy split for a single domain concept. Canonical UL keeps one `ArtifactRelaunch` concept, one effective generation-start CTA after hydration, and default runtime intent `regenerate` for artifact-driven relaunch entries. |
