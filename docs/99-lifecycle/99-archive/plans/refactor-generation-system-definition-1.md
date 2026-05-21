---
goal: Atomize generation-system.definition.ts into DDD-aligned GenerationSystem machine modules
version: 1.1
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Backend Architecture
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [refactor, architecture, backend, xstate, ddd, generation]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

This plan decomposes `apps/backend/src/lib/machines/generation-system.definition.ts` without changing the public `generationSystemMachine` export boundary exposed by `apps/backend/src/lib/machines/generation-system.machine.ts`. The current definition file is **1089 LOC** and still concentrates machine-private types, invoke-output decoding, runtime defaults, actions, guards, actor adapters, and the full state-node tree in one mutation surface.

The refactor is constrained to the **Generation** bounded context and must reuse the already extracted canonical helpers: `generation-routing.ts`, `generation-persistence.ts`, and `generation-fallback.actor.ts`. The target outcome is a thin root definition file that composes DDD-aligned machine modules while preserving state names, event contracts, and runtime behavior exactly.

Current evidence anchors in `generation-system.definition.ts` as of 2026-05-19:
- machine-private helper/decoder cluster: `:147-244`
- actions cluster: `:261-412`
- guards cluster: `:433-460`
- actor adapter cluster: `:462-540`
- root machine declaration: `:543-1088`
- execution/fallback/persistence cluster: `:905-1069`

---

## 1. Requirements & Constraints

- **REQ-001**: Preserve the public machine export exactly: `apps/backend/src/lib/machines/generation-system.machine.ts` must remain the single public re-export of `generationSystemMachine`.
- **REQ-002**: Preserve the runtime behavior of all existing top-level states: `idle`, `gateway`, `preGenerationGuards`, `routing`, `extractionFlow`, `toolGenerationFlow`, `genericGenerationFlow`, `streaming`, `resolvingFallbackPolicy`, `persistingSuccess`, `persistingFailure`, `finalizeIdempotencySuccess`, `finalizeIdempotencyFailure`, `completed`, `failed`.
- **REQ-003**: Preserve event names and output handling exactly for idempotency, ownership, usage, extraction, tool workflow, stream transport, fallback, and persistence invocations.
- **REQ-004**: The refactor must not change `generationSystemMachine` runtime behavior (state progression, failure mapping, replay/idempotency semantics, persistence finalization) observed by `src/lib/tests/generation-system.runtime.test.ts` and downstream backend integration tests.
- **REQ-005**: The top-level file `apps/backend/src/lib/machines/generation-system.definition.ts` must be reduced to **<= 250 LOC** excluding imports and blank lines.
- **REQ-006**: Every newly created module in `apps/backend/src/lib/machines/` must have a single concern and target **<= 300 LOC**.
- **REQ-007**: No new npm dependency, no lockfile change, and no XState version change are allowed.
- **REQ-008**: LOC constraints in REQ-005 and REQ-006 must be validated with a mandatory normalized LOC command that excludes import statements (including multi-line import blocks) and blank lines.
- **DDD-001**: Reuse the canonical Generation terms already registered in the glossary and decision log: `GenerationSystem`, `RequestGateway`, `IdempotencyCoordinator`, `ClaimUsage`, `StreamTransport`, `PersistenceBatch`, `ToolWorkflowPersistenceMetadata`, `WorkflowRunMode`, `WorkflowStep`, `ToolKey`, `ToolWorkflow`.
- **DDD-002**: Do not introduce new domain synonyms in module names or helper names. New module names must either reuse existing code terms or stay purely technical and implementation-scoped.
- **DDD-003**: `generation-routing.ts`, `generation-persistence.ts`, and `generation-fallback.actor.ts` remain the authoritative modules for route selection, persistence payload building, and fallback policy. Their logic must not be duplicated in newly created files.
- **CON-001**: `generation-system.definition.ts` currently defines a local `RouteType` alias at `:33` while `generation-routing.ts` already exports `RouteType`. The refactor must converge on the existing exported type instead of maintaining duplicate aliases.
- **CON-002**: Keep the current `setup({ types, actions, guards, actors }).createMachine(...)` architecture. Do not rewrite the machine into a different orchestration model.
- **CON-003**: Keep the current public export surface of `apps/backend/src/lib/machines/index.ts` unchanged for this refactor (no removals or renames). Newly created helper modules stay internal unless a consumer is proven necessary.
- **GUD-001**: Prefer seam-first extraction: move code only across already visible concern boundaries rather than redesigning transition semantics during the refactor.
- **GUD-002**: First-class validation must happen after each phase with executable backend checks, not diff inspection.
- **PAT-001**: Extract modules by lifecycle concern in this order: machine-private contracts/helpers -> actions/guards/actors -> state-node clusters -> thin root composition.
- **PAT-002**: Preserve string-key lookup for actions, guards, and actors to avoid semantic drift in the XState configuration.

---

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Remove machine-private contract and helper concentration from `generation-system.definition.ts` by extracting types, invoke-output readers, and runtime default helpers into dedicated adjacent modules.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/backend/src/lib/machines/generation-system.types.ts`. Move the machine-local types currently declared in `generation-system.definition.ts:29-145`: `GenerationSystemInput`, `GenerationMachineContext`, `IdempotencyDoneOutput`, `UsageDoneOutput`, `OwnershipDoneOutput`, `StreamDoneOutput`, `ExtractionDoneOutput`, `ToolDoneOutput`, `CacheRequestMetaParams`, `SetValidationDataParams`, `CacheReplayPayloadParams`, `CacheStreamResultParams`, `CacheExtractionResultParams`, `QueueFallbackDecisionParams`. Replace the local `RouteType` alias with `import type { RouteType } from './generation-routing'`. | Yes | 2026-05-19 |
| TASK-002 | Create `apps/backend/src/lib/machines/generation-system.events.ts`. Move the invoke-output readers and decoder helpers currently declared in `generation-system.definition.ts:147-232`: `getIdempotencyDoneOutput`, `getUsageDoneOutput`, `getOwnershipDoneOutput`, `getStreamDoneOutput`, `getStreamResultParams`, `isEmptyStreamSuccess`, `getExtractionDoneOutput`, `getExtractionResultParams`, `getToolDoneOutput`, `getFallbackDoneOutput`, `isExtractionPayloadSemanticallyValid`, `getInvokeFailureReason`, `getReplayPayloadParams`. Type all exports using the moved types from `generation-system.types.ts`. | Yes | 2026-05-19 |
| TASK-003 | Create `apps/backend/src/lib/machines/generation-system.runtime.ts`. Move the runtime default helpers currently declared in `generation-system.definition.ts:233-251`: `defaultArtifactIdFactory`, `normalizeOutputFormat`, `defaultResponseBuilder`. `normalizeOutputFormat` remains the single formatter normalizer for `RequestReceivedEvent.input.outputFormat` inside this machine. | Yes | 2026-05-19 |
| TASK-004 | Update `apps/backend/src/lib/machines/generation-system.definition.ts` to import the moved types/helpers from Phase 1 and delete the original inline declarations. No state-node movement is allowed in this phase. | Yes | 2026-05-19 |
| TASK-005 | Validation Phase 1: run `npm --workspace apps/backend run typecheck` and `node --import tsx --test apps/backend/src/lib/tests/generation-system.runtime.test.ts`. Both commands must pass before Phase 2 starts. | Yes | 2026-05-19 |

### Implementation Phase 2

- **GOAL-002**: Isolate state mutation, predicate evaluation, and adapter invocation from the root statechart by extracting actions, guards, and actor-source definitions into dedicated modules.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `apps/backend/src/lib/machines/generation-system.actions.ts`. Move the full actions object currently declared in `generation-system.definition.ts:261-412`. Export it as a single `generationSystemActions` object preserving all current action keys: `cacheRequestMeta`, `setUserId`, `setValidationData`, `setFailureReason`, `setAmbiguousRoutingFailure`, `setMissingRegistrySelectorFailure`, `setExtractionFailedFailure`, `setWorkflowFailedFailure`, `setIdempotencyConflictFailure`, `setUsageFailedFailure`, `setOwnershipFailedFailure`, `setStreamFailureFailure`, `setPersistenceFinalizeFailedFailure`, `cacheReplayPayload`, `cacheArtifactId`, `ensureArtifactId`, `cacheSyntheticChunk`, `cacheStreamResult`, `cacheExtractionResult`, `drivePersistenceFinalizeSuccess`, `drivePersistenceFinalizeFailure`, `setFailureFromInvokeOutput`, `queueFallbackDecision`, `applyFallbackDecision`, `setFallbackPolicyFailure`, `cacheToolArtifactFromOutput`, `appendStreamChunk`, `resetVolatileContext`. | Yes | 2026-05-19 |
| TASK-007 | Create `apps/backend/src/lib/machines/generation-system.guards.ts`. Move the full guards object currently declared in `generation-system.definition.ts:433-460`. Export it as `generationSystemGuards` preserving the current guard keys and semantics, including `streamOutputIsEmptySuccess` and `toolOutputIsCompleted`. | Yes | 2026-05-19 |
| TASK-008 | Create `apps/backend/src/lib/machines/generation-system.actors.ts`. Move the actor-source definitions currently declared in `generation-system.definition.ts:462-540`: `invokeIdempotency`, `invokeUsage`, `invokeOwnership`, `invokeStream`, `invokePersistence`, `invokeExtraction`, `invokeToolWorkflow`, `invokeFallbackPolicy`, `markCompletedIdempotency`, `markFailedIdempotency`. The module must continue importing the existing canonical submachines: `idempotencyCoordinatorMachine`, `usageMachine`, `streamTransportMachine`, `persistenceBatchMachine`, `toolWorkflowMachine`, and `generationFallbackActor`. | Yes | 2026-05-19 |
| TASK-009 | Update `apps/backend/src/lib/machines/generation-system.definition.ts` to consume `generationSystemActions`, `generationSystemGuards`, and `generationSystemActors` instead of inline declarations. The `setup({ types, actions, guards, actors })` API shape must remain unchanged. | Yes | 2026-05-19 |
| TASK-010 | Validation Phase 2: run `npm --workspace apps/backend run typecheck` and `npm --workspace apps/backend run test:integration`. Acceptance criterion: `generation-system.runtime.test.ts` and all existing backend integration tests keep passing with no behavior changes. | Yes | 2026-05-19 |

### Implementation Phase 3

- **GOAL-003**: Split the root machine configuration into lifecycle-aligned state-node modules so `generation-system.definition.ts` stops owning the full orchestration tree directly.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create `apps/backend/src/lib/machines/generation-system.request.states.ts`. Move the state-node definitions currently declared in `generation-system.definition.ts:580-798` for `idle`, `gateway`, `preGenerationGuards`, and `routing`. Export them as a typed object fragment that can be spread into the root `states` object. Preserve the exact transition targets, especially the nested `preGenerationGuards.idempotency -> ownershipCheck -> usage` chain. | Yes | 2026-05-19 |
| TASK-012 | Create `apps/backend/src/lib/machines/generation-system.execution.states.ts`. Move the state-node definitions currently declared in `generation-system.definition.ts:799-979` for `extractionFlow`, `toolGenerationFlow`, `genericGenerationFlow`, and `streaming`. Preserve the current workaround branch in `toolGenerationFlow` at `:837-844` where `resolveWorkflowRunMode(context) === 'new'` bypasses `toolWorkflowMachine` and goes directly to `streaming`. | Yes | 2026-05-19 |
| TASK-013 | Create `apps/backend/src/lib/machines/generation-system.persistence.states.ts`. Move the state-node definitions currently declared in `generation-system.definition.ts:980-1088` for `resolvingFallbackPolicy`, `persistingSuccess`, `persistingFailure`, `finalizeIdempotencySuccess`, `finalizeIdempotencyFailure`, `completed`, and `failed`. Preserve the fallback -> persistence -> idempotency settlement order exactly. | Yes | 2026-05-19 |
| TASK-014 | Update `apps/backend/src/lib/machines/generation-system.definition.ts` to compose the imported state fragments into the final `states` object. The only logic remaining in the file after this task should be the root `setup(...)`, root `context(...)`, and assembly of imported fragments. | Yes | 2026-05-19 |
| TASK-015 | Validation Phase 3: run `npm --workspace apps/backend run typecheck` and `node --import tsx --test apps/backend/src/lib/tests/generation-system.runtime.test.ts`. Acceptance criterion: runtime state progression, replay handling, fallback behavior, and persistence finalization remain unchanged. | Yes | 2026-05-19 |

### Implementation Phase 4

- **GOAL-004**: Finalize the thin-definition composition, enforce the internal/public boundary, and validate the decomposition end-to-end.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Reduce `apps/backend/src/lib/machines/generation-system.definition.ts` to a thin composition file. Final target content: imports, `setup({ types, actions, guards, actors })`, root `context`, and `states: { ...requestStates, ...executionStates, ...persistenceStates }`. Target <= 250 LOC excluding imports and blank lines. | Yes | 2026-05-19 |
| TASK-017 | Keep `apps/backend/src/lib/machines/generation-system.machine.ts` unchanged as `export { generationSystemMachine } from './generation-system.definition';`. Do not move helper-module exports into `apps/backend/src/lib/machines/index.ts` unless a direct consumer is introduced and verified. | Yes | 2026-05-19 |
| TASK-018 | Run final validation: `npm --workspace apps/backend run typecheck`, `npm --workspace apps/backend run test:integration`, and `npm --workspace apps/backend run test`. Then run the mandatory normalized LOC gate for REQ-005/REQ-006 with: `awk 'BEGIN{in_import=0;count=0} /^[[:space:]]*import[[:space:]]/{in_import=1} in_import{ if ($0 ~ /;[[:space:]]*$/) in_import=0; next } /^[[:space:]]*$/ {next} {count++} END{print count}' apps/backend/src/lib/machines/generation-system.definition.ts` and the same command for each newly created `generation-system.*.ts` module. Acceptance criterion: all commands pass, `generation-system.definition.ts <= 250`, each new module `<= 300`, and the public machine import path remains unchanged for all current consumers. | Yes | 2026-05-19 |

---

## 3. Alternatives

- **ALT-001**: Keep all logic inside `generation-system.definition.ts` and add section comments only. Rejected because it does not reduce the single-point mutation surface or improve reviewability.
- **ALT-002**: Split only helpers (`actions`, `guards`, `actors`) and leave all state nodes inline. Rejected because the file would still centralize the full orchestration tree and remain too large to close the architecture finding credibly.
- **ALT-003**: Rewrite the machine into several invoked child machines instead of extracting state fragments. Rejected for this plan because it changes runtime topology and raises behavioral risk beyond a structural atomization refactor.
- **ALT-004**: Collapse all helper extractions into a single `generation-system.shared.ts` file. Rejected because it would recreate a smaller monolith instead of isolating concerns.

---

## 4. Dependencies

- **DEP-001**: `apps/backend/src/lib/machines/generation-routing.ts` — authoritative `RouteType`, route selection, `WorkflowRunMode`, and tool workflow metadata helpers.
- **DEP-002**: `apps/backend/src/lib/machines/generation-persistence.ts` — authoritative persistence payload builder used by the `persistingSuccess` and `persistingFailure` states.
- **DEP-003**: `apps/backend/src/lib/machines/generation-fallback.actor.ts` — authoritative fallback policy actor invoked by `resolvingFallbackPolicy`.
- **DEP-004**: `apps/backend/src/lib/tests/generation-system.runtime.test.ts` — primary focused validation suite for machine behavior.
- **DEP-005**: `apps/backend/package.json` — authoritative validation commands: `typecheck`, `test:integration`, and `test`.
- **DEP-006**: `plan/refactor-architecture-weaknesses-remediation-1.md` — previous broad remediation plan already marked the GenerationSystem decomposition theme; this plan narrows it to the remaining monolithic `.definition.ts` surface.

---

## 5. Files

- **FILE-001**: `apps/backend/src/lib/machines/generation-system.definition.ts` — thin composition target; current 1089 LOC.
- **FILE-002**: `apps/backend/src/lib/machines/generation-system.machine.ts` — public wrapper; must remain unchanged.
- **FILE-003**: `apps/backend/src/lib/machines/generation-system.types.ts` — new machine-private contracts/types module.
- **FILE-004**: `apps/backend/src/lib/machines/generation-system.events.ts` — new invoke-output decoder helper module.
- **FILE-005**: `apps/backend/src/lib/machines/generation-system.runtime.ts` — new runtime default/helper module.
- **FILE-006**: `apps/backend/src/lib/machines/generation-system.actions.ts` — new actions module.
- **FILE-007**: `apps/backend/src/lib/machines/generation-system.guards.ts` — new guards module.
- **FILE-008**: `apps/backend/src/lib/machines/generation-system.actors.ts` — new actor-source module.
- **FILE-009**: `apps/backend/src/lib/machines/generation-system.request.states.ts` — new request/gating state fragment module.
- **FILE-010**: `apps/backend/src/lib/machines/generation-system.execution.states.ts` — new execution state fragment module.
- **FILE-011**: `apps/backend/src/lib/machines/generation-system.persistence.states.ts` — new fallback/persistence/idempotency settlement state fragment module.
- **FILE-012**: `apps/backend/src/lib/tests/generation-system.runtime.test.ts` — validation target; no behavioral change expected.

---

## 6. Testing

- **TEST-001**: `npm --workspace apps/backend run typecheck` after each phase. Required to catch XState setup typing regressions and broken imports immediately.
- **TEST-002**: `node --import tsx --test apps/backend/src/lib/tests/generation-system.runtime.test.ts` after Phases 1 and 3. Required focused falsification check for machine behavior.
- **TEST-003**: `npm --workspace apps/backend run test:integration` after Phases 2 and 4. Required to verify downstream runtime behavior remains stable.
- **TEST-004**: `npm --workspace apps/backend run test` at the end of Phase 4. Required full backend regression gate.
- **TEST-005**: Mandatory normalized LOC check after Phase 4 (enforces REQ-008): run `awk 'BEGIN{in_import=0;count=0} /^[[:space:]]*import[[:space:]]/{in_import=1} in_import{ if ($0 ~ /;[[:space:]]*$/) in_import=0; next } /^[[:space:]]*$/ {next} {count++} END{print count}' apps/backend/src/lib/machines/generation-system.definition.ts` and the same command for each newly created module. Acceptance targets are REQ-005 and REQ-006.

---

## 7. Risks & Assumptions

- **RISK-001**: `setup({ types, actions, guards, actors })` inference can become brittle when moved across modules. Mitigation: keep the root `types` declaration in `generation-system.definition.ts` and import typed fragments rather than re-deriving context/event generics per file.
- **RISK-002**: String-key references between state nodes and extracted actions/guards/actors can silently drift during renames. Mitigation: preserve current keys exactly and treat any rename as out of scope.
- **RISK-003**: The workaround in `toolGenerationFlow` for `WorkflowRunMode = 'new'` is behaviorally significant. Mitigation: preserve the exact bypass branch and validate it through `generation-system.runtime.test.ts`.
- **RISK-004**: The fallback/persistence cluster `:905-1069` currently serializes failure policy, persistence finalization, and idempotency settlement in one contiguous flow. Extraction order mistakes could change failure semantics. Mitigation: extract it as one state-fragment module in Phase 3 instead of splitting it further in this iteration.
- **ASSUMPTION-001**: Existing extracted helpers (`generation-routing.ts`, `generation-persistence.ts`, `generation-fallback.actor.ts`) are already behaviorally correct and do not need redesign in this plan.
- **ASSUMPTION-002**: No external consumer imports machine-private helpers directly from `generation-system.definition.ts`; only `generationSystemMachine` is public.
- **ASSUMPTION-003**: `apps/backend/src/lib/tests/generation-system.runtime.test.ts` is sufficient as the cheapest focused validation slice before broader integration runs.

---

## 8. Related Specifications / Further Reading

- [docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md](../docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md)
- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md)
- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
- [plan/refactor-architecture-weaknesses-remediation-1.md](./refactor-architecture-weaknesses-remediation-1.md)
- [plan/process-auth-http-finding-closure-ddd-1.md](./process-auth-http-finding-closure-ddd-1.md)

---

## 9. Execution Closure (2026-05-19)

### Delivery Summary
- `generation-system.definition.ts` has been reduced to a thin composition root (`setup + context + states spread`) and no longer owns helper/actor/action/state internals.
- Machine-private concerns are split into dedicated modules: types, event decoders, runtime helpers, actions, guards, actors, and lifecycle state fragments.
- Public export boundary is unchanged: `generation-system.machine.ts` remains the canonical re-export surface.

### Validation Summary
- `npm --workspace apps/backend run typecheck` ✅
- `node --import tsx --test apps/backend/src/lib/tests/generation-system.runtime.test.ts` ✅ (22 pass / 0 fail)
- `npm --workspace apps/backend run test:integration` ✅ (91 pass / 0 fail)
- `npm --workspace apps/backend run test` ✅ (131 pass / 0 fail)

### Normalized LOC Gate (REQ-008)
- `apps/backend/src/lib/machines/generation-system.definition.ts`: **47** (target <= 250) ✅
- `apps/backend/src/lib/machines/generation-system.types.ts`: **102** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.events.ts`: **68** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.runtime.ts`: **15** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.actions.ts`: **271** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.guards.ts`: **30** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.actors.ts`: **86** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.request.states.ts`: **245** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.execution.states.ts`: **186** (target <= 300) ✅
- `apps/backend/src/lib/machines/generation-system.persistence.states.ts`: **116** (target <= 300) ✅

### Requirement Outcome
- REQ-001..REQ-008: **Satisfied**.
- DDD-001..DDD-003, CON-001..CON-003, PAT-001..PAT-002: **Satisfied**.