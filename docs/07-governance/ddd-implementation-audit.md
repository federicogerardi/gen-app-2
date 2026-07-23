---
status: active
version: 1.1
date_created: 2026-07-22
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
owner: Domain Architecture
type: code-review
tags: [ddd, audit, bounded-context, aggregate, value-object, governance]
---

# DDD Implementation Audit

> Complete audit of the DDD implementation in the `gen-app-2` repository, executed on 2026-07-22.
>
> **Proposal Reference**: this audit was executed in the context of the [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (BullMQ, DDD-226/DDD-227), which introduces the new Aggregate Root `ToolWorkflowJob` and represents the next evolutionary step of the architecture. References to the concepts `ToolWorkflowJob`, `ToolWorkflowJobId`, and BullMQ in the glossary and BCM are **provisional** — this audit verifies their coherence with the current state of implementation.

## 1. EXECUTIVE SUMMARY

The project implements a non-conventional but rigorous DDD approach: **XState v5 state machines serve as Aggregate Roots** and **Value Objects are TypeScript union types with `as const` arrays**. This architecture is valid and consistent, supported by excellent documentation governance (UL Glossary v2.23, Bounded Context Map v3.14, Decision Log v4.15 with 230+ entries).

**Overall Assessment**: ✅ Solid — 2 minor gaps identified, no blockers.

**Canonical Reference Documents**:
- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) (v2.23, 2026-07-20)
- [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md) (v3.14, 2026-07-20)
- [Domain Naming Decision Log](domain-naming-decision-log.md) (v4.15, 2026-07-20)
- [Frontend UI Ubiquitous Language Spec](../02-design/specifications/frontend-ui-ubiquitous-language-spec.md) (v1.8, 2026-07-21)

---

## 2. BOUNDED CONTEXT VERIFICATION

### 2.1 Generation Context — Aggregate Roots: `GenerationSystem`, `ToolWorkflowJob` (provisional)

**Status**: ✅ **Canonical and implemented**; `ToolWorkflowJob` is **provisional** (not yet implemented, awaiting the BullMQ Proposal)

**Actor Tree Architecture**:
```
generationSystemMachine (Aggregate Root, canonico)
├── requestGatewayMachine      → validazione, routing
├── idempotencyCoordinatorMachine → deduplicazione (Redis SET NX EX + PostgreSQL)
├── usageMachine                → quota enforcement pre-generazione
├── toolWorkflowMachine         → orchestratore multi-step
├── extractionChainMachine      → estrazione strutturata LLM
├── streamTransportMachine      → sessione SSE streaming
└── persistenceBatchMachine     → persistenza artefatto
```

**ToolWorkflowJob (provisional, DDD-226/DDD-227)**:
- Defined as **Satellite Aggregate Root** in the BCM
- Relationship: a `ToolWorkflowJob` **produces and owns** a `GenerationSession`
- Cardinality: 1:1 for `WorkflowRunMode = 'new'`, potentially 1:N for `'regenerate'`
- States: `queued` | `running` | `completed` | `failed` | `cancelled`
- Identified by `ToolWorkflowJobId` (Value Object, distinct from `WorkflowSessionIdentifier`)
- **Note for the BullMQ Proposal**: the `ToolWorkflowJob` → `GenerationSession` relationship is correctly documented but not yet implemented. The audit confirms that the necessary infrastructure (BullMQ, Redis, idempotency lock) is already present.

**Code Evidence**:
- `apps/backend/src/lib/machines/generation-system.definition.ts` — macchina XState top-level
- `apps/backend/src/lib/machines/generation-system.execution.states.ts` — `toolGenerationFlow` invoca `invokeToolWorkflow`
- `apps/backend/src/lib/runtime/backend-session.ts` — `runBackendGenerationSession()`
- `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` — persistenza artefatti con `session_id`, `artifact_role`, `run_mode`

### 2.2 Auth Context

**Status**: ✅ **Canonical and implemented**

`AuthSessionPrincipal` is the correct shared read model passed from Auth → Generation and Auth → Usage/Quota. Verified in:
- `apps/backend/src/lib/types/auth.ts:47-50` — definizione `AuthSessionPrincipal`
- `apps/backend/src/lib/adapters/auth.production.ts:140` — `mapAuthSessionPrincipalRow()`
- `apps/backend/src/lib/runtime/auth-http/support.ts:184-202` — `parseAuthUserRole()`, `parseAuthUserStatus()`

### 2.3 Usage/Quota Context

**Status**: ✅ **Canonical and implemented**

Correct separation of Redis (real-time rate limiting) vs PostgreSQL (audit/billing). Implemented commands:
- `ClaimUsage` (DDD-143): gate + credit verification without consumption
- `ConsumeCredits` (DDD-141): credit charge post-SUCCESS
- `RecordArtifactSuccess` (DDD-142): artifact gate increment post-SUCCESS

**Evidence**: `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts`

### 2.4 Frontend/UI Context — Aggregate Root: `ToolPage`

**Status**: ✅ **Canonical and implemented**

The `toolPageMachine` is the frontend aggregate root with well-defined states. Feedback channel mapping (`inline-action`, `page-state`, `global`) correctly implemented.

**Evidence**:
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — macchina XState
- `apps/frontend/src/app/runtime/feedback-channel-map.ts` — `resolveFeedbackChannel()`
- `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx` — global feedback runtime

### 2.5 Crawling & Extraction and Competitor Analysis Contexts

**Status**: ⚠️ **Provisional** — documented in the BCM, partial runtime implementation

Types `WorkflowStepType = 'crawling'` and `'scoring'` defined in `xstate.ts:25` but the runtime actors (`crawlingChainMachine`, `scoringChainMachine`) are in implementation phase.

---

## 3. VALUE OBJECT VERIFICATION

### 3.1 `packages/domain` — Cross-context Primitives

**Status**: ✅ **Excellent**

All shared Value Objects are defined in `packages/domain/src/index.ts` with the pattern `const ARRAY = [...] as const` + `type = (typeof ARRAY)[number]`, complete with type guards and normalizers:

| Value Object | Valori | DDD Ref | File |
|---|---|---|---|
| `ArtifactType` | `'content' \| 'seo' \| 'code' \| 'extraction' \| 'crawl' \| 'analysis'` | DDD-001 | `packages/domain/src/index.ts:25-26` |
| `ArtifactStatus` | `'generating' \| 'completed' \| 'failed'` | DDD-017 | `packages/domain/src/index.ts:33-34` |
| `OutputFormat` | `'plain' \| 'json' \| 'markdown'` | — | `packages/domain/src/index.ts:41-42` |
| `WorkflowRunMode` | `'new' \| 'resume' \| 'regenerate'` | DDD-037 | `packages/domain/src/index.ts:49-50` |
| `ArtifactRole` | `'step' \| 'final'` | DDD-033 | `packages/domain/src/index.ts:61-62` |

**No duplication**: Backend and Frontend import from `@gen-app-2/domain`.

### 3.2 Context-specific Value Objects

**Status**: ✅ **Correct** — All have associated type guards and normalizers.

| VO | File | Valori |
|---|---|---|
| `ArtifactFailureReason` | `artifact.ts:35-58` | 23 cause di fallimento |
| `ToolWorkflow` | `artifact.ts:62-66` | Derivato da `@gen-app-2/contracts` + `'extraction'` |
| `WorkflowStepStatus` | `xstate.ts:24` | `'idle' \| 'running' \| 'done' \| 'error' \| 'skipped'` |
| `WorkflowStepType` | `xstate.ts:25` | `'extraction' \| 'generation' \| 'acquisition' \| 'crawling' \| 'scoring'` |
| `ApiServiceAccessMode` | `api-service.ts:1` | `'public' \| 'token' \| 'query-param'` |
| `AuthUserRole` | `auth.ts:3-4` | `'admin' \| 'member'` |
| `AuthUserStatus` | `auth.ts:6-7` | `'active' \| 'disabled' \| 'pending_password_reset'` |
| `QuotaEventStatus` | `artifact.ts:69-70` | `'success' \| 'error' \| 'rate_limited'` |

---

## 4. CROSS-CONTEXT CONTRACT VERIFICATION

**Status**: ✅ **Excellent** — `packages/contracts` as single source of truth.

| Contract | File | Verification |
|---|---|---|
| `GenerationRequest` | `contracts/src/index.ts` | Discriminated union con varianti `Tool`, `Extraction`, `Generic` |
| `BackendStreamEvent` | `contracts/src/index.ts` | `start \| chunk \| terminal` |
| `ToolWorkflowDefinition` (11 tools) | `contracts/src/tool-workflows.ts` | Complete definitions with steps, creditCost, availability policy |
| `AssetDomainModel` | `contracts/src/asset.ts` | 13 `AssetType`, DTO, field mappings |
| `ExtractionFields` | `contracts/src/extraction-fields.ts` | 39 canonical keys, per-tool maps, legacy alias |
| `ApiServiceDto` | `contracts/src/api-service.ts` | CRUD and resolve contracts |
| Parity guard | `contracts/src/parity.guard.ts` | Compile-time structural alignment FE↔BE |
| `ToolKey` (canonico) | `contracts/src/tool-workflows.ts` | 11 valori kebab-case, cross-context |

---

## 5. TERMINOLOGICAL GOVERNANCE VERIFICATION

### 5.1 Deprecated terms — removal verified

| Deprecated Term | DDD Ref | Status in Code |
|---|---|---|
| `ToneProfile` | DDD-216 | ❌ Completely removed |
| `RequestTone` | DDD-216 | ❌ Completely removed |
| `ToolPageReadinessSnapshot` | DDD-014 | ❌ Renamed to `ReadinessSnapshot` |
| `ToolPageReadinessReasonCode` | DDD-014 | ❌ Renamed to `ReadinessReasonCode` |
| `StreamUsageMetrics` | DDD-016 | ❌ Alias to `LlmUsageMetrics`, removal target 2026-Q3 |
| `PersistedArtifactStatus` | DDD-017 | ❌ Alias to `ArtifactStatus`, removal target 2026-Q3 |
| `ToolExtractionContext` | DDD-012 | ❌ Consolidated into `ExtractionContext` |
| `BriefingContext` | DDD-012 | ❌ Consolidated into `ExtractionContext` |
| `Screenshot` / `SerpScreenshot` | DDD-145 | ❌ Completely removed (0 occurrences in `.ts`/`.tsx`) |

### 5.2 `meta_ads` vs `meta_ads_generator`

**Status**: ✅ **Correct** — DDD-094 correctly implemented.

- `ToolKey = 'meta-ads'` (kebab-case, canonical identity)
- `ToolWorkflow = 'meta_ads_generator'` (snake_case, internal routing)
- `meta_ads` legacy → handled only by normalizers, never used as primary identity

### 5.3 kebab vs snake_case convention

**Status**: ✅ **Respected** — DDD-C-005 explicitly documents the divergence as a translation rule.

---

## 6. IDENTIFIED GAPS

### 🔴 GAP-1: `ToolFormKey` never implemented

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Decision** | DDD-029 (2026-05-04) |
| **Description** | DDD-029 establishes that the FE form registry implementation type must be called `ToolFormKey` (`keyof typeof toolFormRegistry`), distinct from the cross-context `ToolKey`. The type was never created. |
| **Evidence** | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts:129` uses `Record<SupportedTool, ToolFormConfig>` instead of `Record<ToolFormKey, ToolFormConfig>` |
| **Impact** | Low — `SupportedTool` is semantically equivalent. However, the non-implementation explicitly violates DDD-029. |
| **Fix** | Add `export type ToolFormKey = keyof typeof toolFormRegistry;` in `tool-form-architecture.ts` |
| **Verification (2026-07-23)** | Still **MISSING** — confirmed no `ToolFormKey` type in codebase |

### 🟡 GAP-2: Hardcoded Italian string in `ProjectsListPage.tsx`

| Field | Detail |
|---|---|
| **Severity** | Low |
| **Rule** | UI Spec §13.5 — "no hardcoded strings in ARIA/text attributes" |
| **Description** | `apps/frontend/src/features/projects/pages/ProjectsListPage.tsx:43` contains fallback `?? 'Progetto'` |
| **Impact** | Low — the fallback is never reached because `appCopy.ui.labels.project` is always defined |
| **Fix** | Remove the fallback or move it to `appCopy` as an explicit key |
| **Verification (2026-07-23)** | Still **PRESENT** — soft fallback `appCopy.ui.labels.project ?? 'Progetto'` at line 43 |

### Technical Debt Status (2026-07-23)

| Item | DDD Ref | Original Deadline | Verified Status |
|---|---|---|---|
| `StreamUsageMetrics` alias | DDD-016 | Q3 2026 | ✅ **Already removed** — no occurrences in `packages/contracts/` |
| `PersistedArtifactStatus` alias | DDD-017 | Q3 2026 | ✅ **Already removed** — no occurrences in `packages/contracts/` |

---

## 7. ARCHITECTURAL OBSERVATIONS

### 7.1 XState-as-Aggregate Pattern

The project does not use traditional OOP classes (`class Entity`, `class AggregateRoot`). XState v5 state machines serve as aggregate roots. **This is a valid DDD pattern** (Actor Model / hybrid Event Sourcing):

✅ **Strengths**:
- Explicit, typed, and testable state machines for each aggregate
- Typed and traceable XState events
- Clear separation between domain (machines) and infrastructure (adapters)
- `assign()`, `guard()`, and `action()` encapsulate business logic

⚠️ **Areas of attention**:
- Domain logic is distributed across machines, selectors, and normalizers — not concentrated in entity classes
- There is no explicit domain event bus — events are internal XState transitions
- For async contexts (Crawling, BullMQ), an inter-process event mechanism will be necessary

**Deep dive**: see [XState-as-Aggregate Architectural Risk Review](xstate-as-aggregate-architectural-review.md) for detailed analysis of the 6 architectural risks (serialization, event bus, distributed logic, TypeScript inference, onboarding, debugging) and specific recommendations for the BullMQ Proposal.

### 7.2 Repository Pattern

✅ **Excellent** — Typed interfaces in `postgres-redis.interfaces.ts`, Kysely implementations in dedicated files. No ORM, no direct DB access from domain.

```
Interface (dominio)           Implementazione (infrastruttura)
─────────────────────         ───────────────────────────────
PostgresArtifactRepository → postgres.artifact.repository.ts
RedisQuotaRepository       → postgres-redis.usage.repository.ts
RedisIdempotencyRepository → postgres-redis.idempotency.repository.ts
ArtifactQueryRepository    → session-query.adapter.ts
```

### 7.3 Domain Services

The documented Domain Services (`LlmModelCatalog`, `StreamTransport`, `ExtractionChain`, `IdempotencyCoordinator`, `ToolStepOrchestration`, `ApiServiceCatalog`, `StepLlmModelResolver`) are implemented as XState machines or pure functions. Consistent with the chosen functional architecture.

### 7.4 ToolWorkflowPersistenceMetadata

✅ **Correctly embedded** in the artifact input JSON:
- `buildToolWorkflowPersistenceMetadata()` in `generation-routing.ts:98-136`
- Stored under the `toolWorkflow` key in `input_json`
- Denormalized columns (`session_id`, `step_key`, `artifact_role`, `run_mode`) for indexed queries
- Consumed by FE `StepHydration` as read-only

---

## 8. DDD AREA SUMMARY

| DDD Area | Assessment | Notes |
|---|---|---|
| **Ubiquitous Language** | ✅ Excellent | Comprehensive glossary, 230+ decision log, no active terminological drift |
| **Bounded Contexts** | ✅ Solid | 6 contexts defined in BCM; 2 provisional (Crawling, Competitor Analysis) |
| **Aggregate Roots** | ✅ Valid | `GenerationSystem` and `ToolPage` as XState v5 machines; `ToolWorkflowJob` provisional |
| **Entities** | ✅ Adequate | Type-based, not class-based. Consistent with the functional architecture |
| **Value Objects** | ✅ Excellent | `as const` arrays + union types + type guards + normalizer — zero duplication |
| **Domain Events** | ⚠️ Internal | Events only within the XState actor tree, not inter-process |
| **Repository** | ✅ Excellent | Typed interfaces, Kysely query builder, no ORM |
| **Domain Services** | ✅ Consistent | Implemented as XState machines/pure functions |
| **Application Services** | ✅ Present | `GenerationRequestAssembly`, HTTP handlers |
| **Anti-Corruption Layer** | ✅ Present | kebab↔snake_case translation, normalizer, extraction field aliases |
| **Contracts** | ✅ Excellent | `packages/contracts` single source of truth, compile-time parity guard |

---

## 9. RECOMMENDATIONS

### Immediate actions
1. **Implement `ToolFormKey`** (GAP-1): create the type alias in `tool-form-architecture.ts` — 5 minutes
2. **Remove hardcoded `'Progetto'`** (GAP-2): clean up the fallback in `ProjectsListPage.tsx:43` — 2 minutes

### Recommendations for the BullMQ Proposal
3. **Define inter-process events for `ToolWorkflowJob`**: the Proposal introduces async execution via BullMQ — an event mechanism that crosses process boundaries will be necessary (e.g., BullMQ events → Redis pub/sub → SSE to FE)
4. **Document the XState-as-Aggregate pattern in the BCM**: add a section explaining why state machines replace traditional classes
5. **Centralize business rules**: some rules (e.g., `canTransitionArtifactStatus`) live in type files; consider a `domain-rules.ts` module for more complex rules as the system grows

### Identified technical debt
6. **Backward-compat aliases to remove by Q3 2026**: `StreamUsageMetrics` (DDD-016) and `PersistedArtifactStatus` (DDD-017)

---

## 10. REFERENCES

| Document | Relationship |
|---|---|
| [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) | **Active proposal** — introduces `ToolWorkflowJob` (DDD-226/DDD-227), verified as coherent with the current state of implementation |
| [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) | Canonical reference document |
| [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md) | Canonical reference document |
| [Domain Naming Decision Log](domain-naming-decision-log.md) | Canonical reference document |
| [Architecture Weaknesses Code Review](architecture-weaknesses-code-review.md) | Related review — the MEDIUM finding "Generation flow completion remains partially dependent on Frontend/UI liveness signals" is directly addressed by the BullMQ Proposal |
| [Critical Vulnerabilities Progressive Review](critical-vulnerabilities-progressive-review.md) | Related review — Sprints 1-7 completed |