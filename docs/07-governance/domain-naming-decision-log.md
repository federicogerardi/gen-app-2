---
status: active
version: 1.1
last-reviewed: 2026-05-03
owner: Domain Architecture
---

# Domain Naming Decision Log

## Decision Rules
- Every new canonical term must be logged before broad reuse.
- Decisions must include rationale and propagation scope.
- Conflicting synonyms must be resolved here first.

---

## Approved Naming Decisions

| ID | Date | Canonical Term | Decision | Rationale | Scope |
| --- | --- | --- | --- | --- | --- |
| DDD-001 | 2026-05-03 | Artifact | `Artifact` is the canonical term for a persisted generation output. Not `Output`, `Result`, `Generation`, or `Document`. | `artifact` is used consistently in DB schema (`artifacts` table), TypeScript types (`ArtifactType`, `ArtifactStatus`), and frontend contracts. Renaming would require broad migration. | all contexts |
| DDD-002 | 2026-05-03 | GenerationRequest | `GenerationRequest` is the canonical term for the command that initiates generation. Not `GenerationInput`, `GenerationPayload`, or `CreateGenerationDto`. | Consistent with `requestId` as the primary correlation identifier throughout the system. | Generation, Frontend |
| DDD-003 | 2026-05-03 | WorkflowStep | `WorkflowStep` is the canonical backend term for a step in a multi-step generation flow. Not `Task`, `Stage`, or `Phase`. | Backend uses `WorkflowStepDescriptor` and `WorkflowStepState` consistently. | Generation |
| DDD-004 | 2026-05-03 | ToolStep | `ToolStep` is the canonical frontend term for a named step in a specific tool's flow (e.g., `optin`, `vsl`, `landing`). Coexists with `WorkflowStep` as the frontend concrete counterpart. | Frontend tool machines use `ToolStep` as a union type of actual step names; backend `WorkflowStep` is the abstract descriptor. Kept distinct to avoid confusion. See DDD-C-001. | Frontend |
| DDD-005 | 2026-05-03 | ClaimUsage | `ClaimUsage` is the canonical command name for the atomic quota reservation operation. Not `DecrementQuota`, `ConsumeQuota`, or `CheckAndReserve`. | `claimUsage` is used in `UsageAdapter` interface and `usageMachine` actor consistently. | Usage/Quota |
| DDD-006 | 2026-05-03 | ReadinessSnapshot | `ReadinessSnapshot` (not `ReadinessState` or `CanStartFlags`) is the canonical term for the computed start-eligibility object on the tool page. | Used in `ToolPageReadinessSnapshot` type and documented in `tool-generation-flow-source-of-truth-spec.md`. | Frontend |
| DDD-007 | 2026-05-03 | ExtractionContext | `ExtractionContext` is the canonical term for the structured payload extracted from a briefing file and used as generation input. Not `BriefingContext`, `ExtractedData`, or `ParsedBriefing`. | `extractionPayload` field in `BriefingUploadContext` carries this data; `ExtractionContext` is the DDD-level name. | Frontend, Generation |
| DDD-008 | 2026-05-03 | AuthSessionPrincipal | `AuthSessionPrincipal` is the canonical shared read model passed across Auth → other contexts. Not `CurrentUser`, `LoggedInUser`, or `SessionUser`. | Defined explicitly as `AuthSessionPrincipal` in `src/lib/types/auth.ts:46`. | Auth |
| DDD-009 | 2026-05-03 | BackendStreamEvent | `BackendStreamEvent` is the canonical term for SSE events emitted during a generation. Types: `start`, `chunk`, `terminal`. | Defined in `frontend/src/features/generation/contracts/backend-stream.ts`. Consistent with SSE protocol naming. | Generation, Frontend |
| DDD-010 | 2026-05-03 | HydrationResult | `HydrationResult` is the canonical term for the state snapshot produced when loading prior artifact history into a ToolPage. Not `ResumeState`, `CheckpointData`, or `SessionSnapshot`. | `HydrationResult` is the explicit type in `tool-page.machine.ts` and aligns with `StepHydration` service naming. | Frontend |
| DDD-011 | 2026-05-03 | ToolKey | `ToolKey` is the registry implementation type (`keyof typeof toolFormRegistry`) in `tool-form-architecture.ts`. It is the implementation-level counterpart of the canonical `SupportedTool` domain concept. Docs must use `SupportedTool` when referring to the domain concept; `ToolKey` is acceptable in code-level spec sections that describe the registry pattern. | `SupportedTool` in `tool-flow.machine.ts` is the DDD canonical term; `ToolKey` extends it for registry lookups and may include example/provisional entries. Both are valid in their respective scopes. | Frontend |

---

## Open Naming Conflicts

| Conflict ID | Candidate Terms | Impacted Areas | Proposed Resolution | Status |
| --- | --- | --- | --- | --- |
| DDD-C-001 | `ToolWorkflow` (backend `src/lib/types/artifact.ts`) vs `SupportedTool` (frontend `tool-flow.machine.ts`) | Generation ↔ Frontend/UI boundary | Both terms are kept as context-local: `ToolWorkflow` in Generation, `SupportedTool` in Frontend. The bounded context map documents the translation rule. No unification needed — they have different value sets and concerns. | resolved |
| DDD-C-002 | `WorkflowStep` (backend abstract) vs `ToolStep` (frontend concrete) | Generation ↔ Frontend/UI boundary | Kept distinct per DDD-003 and DDD-004. Backend `WorkflowStep` is an abstract descriptor; frontend `ToolStep` is a concrete named value. | resolved |
| DDD-C-003 | `extractionPayload` (field name in code) vs `ExtractionContext` (DDD canonical term) | Frontend codebase | `ExtractionContext` is the canonical DDD term (DDD-007). Field name `extractionPayload` is acceptable as an implementation detail in the code. Docs corrected to use `ExtractionContext` where referring to the domain concept (2026-05-03). | resolved |
