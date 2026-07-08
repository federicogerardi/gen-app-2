---
status: active
version: 1.2-ddd-balanced
last-reviewed: 2026-07-08
next-review-date: 2026-07-22
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 3 Implementation Plan - Structural Decoupling
type: implementation-plan
tags:
  - sprint-planning
  - structural-decoupling
  - actor-communication
  - adapter-organization
  - ddd-compliance
goal: Systematic structural decoupling via actor communication consolidation and domain-based adapter organization
---

# Sprint 3 Implementation Plan - Structural Decoupling

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Prerequisites**: Sprint 2 completed ✅ (Route Capabilities + Generation Context Builders)  
**Execution**: Sequential phases — Phase 1 (frontend actor decoupling) → Phase 2 (backend adapter organization)

---

## Sprint Objective

Resolve structural coupling through:
1. **Systematic Actor Communication Decoupling** — Extract anonymous inline `sendTo`, introduce typed contracts, consolidate 9 actions to ≤ 5
2. **Domain-Based Adapter Organization** — Replace barrel export with tree-shakable domain modules (Generation, Auth) + Admin organizational grouping

**Sequential rationale**: Frontend changes (Phase 1) complete and validated before backend restructuring (Phase 2) begins. Risk isolation between independent systems.

---

## DDD Requirements

**Decision Log**: Create two entries before implementation begins:

```markdown
| DDD-163 | 2026-07-08 | ActorCommunicationContract | Typed contracts at XState actor boundaries (BriefingActorContract, GenerationLifecycleActorContract) | Eliminates anonymous inline sendTo, enables independent actor testability, respects Frontend/UI downstream consumer role (BCM Line 25) | Frontend/UI |

| DDD-164 | 2026-07-08 | DomainBasedAdapterModules | Infrastructure adapter organization in two bounded-context modules (generation/, auth/) plus one organizational grouping (admin/). ApiService exports belong to generation/ (Generation Context per BCM L53, Glossary L74). ProductChangelog, UserReport, GitHubIssueLink backend adapters are grouped in admin/ — NOT a bounded context; they implement persistence for Frontend/UI context Key Entities (BCM L102, DDD-065, DDD-067). | Enables targeted imports and tree-shaking aligned with bounded context boundaries; admin/ is an explicit organizational grouping, not a domain claim. Replaces monolithic barrel. | Generation, Auth, Frontend/UI (admin persistence) |
```

**Key Constraints**:
- Actor contracts must keep `toolPageMachine` as **orchestrator only** — no domain logic at the communication boundary
- Adapter module names: `generation` and `auth` align with BCM bounded contexts; `admin` is an **organizational grouping only** (not a bounded context) for admin-feature backend persistence (ProductChangelog, UserReport, GitHubIssueLink — Frontend/UI context Key Entities per BCM L102)
- Barrel `index.ts` becomes a **deprecation shim** — no new exports added

---

## PHASE 1: Systematic Actor Communication Decoupling (Task 3A)

**File**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts`  
**Risk**: Medium — core machine, systematic approach mitigates regression  
**DDD**: Actor contracts respect Frontend/UI as downstream consumer (BCM Line 25)

### Current State (verified)

**9 `sendTo` actions** across two child actors:

| # | Action | Lines | Complexity | Target Actor |
|---|--------|-------|------------|--------------|
| 1 | `sendBriefingSelected` | 96–101 | Conditional | `briefingActor` |
| 2 | `sendBriefingExtractionRequested` | 102 | Simple | `briefingActor` |
| 3 | `sendBriefingReset` | 103 | Simple | `briefingActor` |
| 4 | `sendBriefingInputSynced` | 104–114 | Complex (context + event) | `briefingActor` |
| 5 | `sendGenerationLifecycleStepDone` | 115–118 | Conditional | `generationLifecycleActor` |
| 6 | `sendGenerationLifecycleStepFailed` | 119–122 | Conditional | `generationLifecycleActor` |
| 7 | `sendGenerationLifecycleRetryStep` | 123 | Simple | `generationLifecycleActor` |
| 8 | `cancelGenerationLifecycle` | 124 | Simple | `generationLifecycleActor` |
| 9 | **Anonymous inline `sendTo`** | 299–314 | Complex (untestable) | `briefingActor` |

**Primary defect**: Action #9 is anonymous and inline inside `hydrating.onDone`'s actions array — it cannot be referenced by name in tests, making the hydration recovery path untestable in isolation.

### Consolidation Strategy

**Target: 5 named `sendTo` actions** (from 9, via semantic consolidation + anonymous extraction):

| New Action | Replaces | Rationale |
|------------|----------|-----------|
| `forwardBriefingCommand` | #1 + #2 + #3 | Same target, same concern: file/extraction/reset lifecycle signals |
| `syncBriefingContext` | #4 | Kept separate — requires rich context payload (model, projectId, userId, etc.) |
| `recoverBriefingFromHydration` | #9 | Extract anonymous → named; complex EXTRACTION_RECOVERED payload |
| `forwardStepOutcomeToLifecycle` | #5 + #6 | Same target, same concern: step result forwarding |
| `controlGenerationLifecycle` | #7 + #8 | Same target, same concern: lifecycle control signals (RETRY_STEP \| CANCEL) |

### Step 1: Introduce Actor Contracts

Create `apps/frontend/src/features/tools/machines/tool-page-actor-contracts.ts`:

```typescript
// DDD-163: Typed contracts at XState actor boundaries

import type { BriefingUploadEvent } from './briefing-upload.machine';
import type { GenerationLifecycleEvent } from './generation-lifecycle.machine';

/** Events tool-page-machine sends TO briefingActor */
export type BriefingActorInputEvent = Extract<
  BriefingUploadEvent,
  | { type: 'FILE_SELECTED' }
  | { type: 'EXTRACTION_REQUESTED' }
  | { type: 'RESET' }
  | { type: 'INPUT_SYNCED' }
  | { type: 'EXTRACTION_RECOVERED' }
>;

/** Events tool-page-machine sends TO generationLifecycleActor */
export type GenerationLifecycleInputEvent = Extract<
  GenerationLifecycleEvent,
  | { type: 'STEP_DONE' }
  | { type: 'STEP_FAILED' }
  | { type: 'RETRY_STEP' }
  | { type: 'CANCEL' }
>;
```

> ⚠️ If `BriefingUploadEvent` / `GenerationLifecycleEvent` are not currently exported, export them from their respective machine files as part of this step.

### Step 2: Consolidate Actions (systematic replacement)

All 9 `sendTo` actions are replaced by 5 named actions. The table below shows each replacement and its state wiring:

| # | New Action | Replaces | Target Actor | State Wiring (unchanged behavior) |
|---|-----------|----------|--------------|-------------------------------------|
| A | `forwardBriefingCommand` | #1 + #2 + #3 | `briefingActor` | `BRIEFING_FILE_SELECTED`, `BRIEFING_EXTRACTION_REQUESTED`, `BRIEFING_RESET` → `'forwardBriefingCommand'` |
| B | `syncBriefingContext` | #4 | `briefingActor` | `MODEL_CHANGED`, `CAMPAIGN_OBJECTIVE_CHANGED` → `'syncBriefingContext'` |
| C | `recoverBriefingFromHydration` | #9 | `briefingActor` | `hydrating.onDone.actions[]` → `'recoverBriefingFromHydration'` (see Step 3 below for detail) |
| D | `forwardStepOutcomeToLifecycle` | #5 + #6 | `generationLifecycleActor` | `STEP_DONE`, `STEP_FAILED` → `'forwardStepOutcomeToLifecycle'` |
| E | `controlGenerationLifecycle` | #7 + #8 | `generationLifecycleActor` | `RETRY_STEP` → `'controlGenerationLifecycle'`; `RESET` handler replaces `cancelGenerationLifecycle` |

**Implementation pattern** (actions A, D, E — event-type consolidation):

```typescript
// Action A: consolidate briefing file/upload/reset commands
forwardBriefingCommand: sendTo('briefingActor', ({ event }): BriefingActorInputEvent => {
  if (event.type === 'BRIEFING_FILE_SELECTED') {
    return { type: 'FILE_SELECTED', file: event.file, sourceKey: event.sourceKey };
  }
  if (event.type === 'BRIEFING_EXTRACTION_REQUESTED') return { type: 'EXTRACTION_REQUESTED' };
  return { type: 'RESET' }; // BRIEFING_RESET fallthrough
}),

// Action D: consolidate step done/failed forwarding
forwardStepOutcomeToLifecycle: sendTo('generationLifecycleActor',
  ({ event }): GenerationLifecycleInputEvent => {
    if (event.type === 'STEP_DONE')   return event;
    if (event.type === 'STEP_FAILED') return event;
    return { type: 'CANCEL' };
  }),

// Action E: consolidate retry/cancel control signals
controlGenerationLifecycle: sendTo('generationLifecycleActor',
  ({ event }): GenerationLifecycleInputEvent => {
    if (event.type === 'RETRY_STEP') return { type: 'RETRY_STEP' };
    return { type: 'CANCEL' };
  }),
```

**Action B** (rename only — no logic change). Replaces `sendBriefingInputSynced` with the clearer name `syncBriefingContext`; payload mapping unchanged.

### Step 3: Extract Anonymous Hydration sendTo (#9 → `recoverBriefingFromHydration`)

This is the **primary defect** the sprint fixes: the anonymous inline `sendTo` at `hydrating.onDone` (lines 299–314) cannot be referenced by name in tests.

**Before** (anonymous inline in `hydrating.onDone.actions[]`):
```typescript
// Untestable — no name, embedded in hydrating.onDone
sendTo('briefingActor', ({ event }) => {
  const output = readHydrationMachineOutput(event);
  const result = output.status === 'success' ? output.hydration : null;
  if (result === null) return { type: 'RESET' as const };
  return {
    type: 'EXTRACTION_RECOVERED' as const,
    artifactId: result.extractionArtifactId,
    payload: result.extractionPayload,
    briefingId: result.briefingId,
    normalizedText: result.normalizedText,
    parsedFormat: result.parsedFormat,
    ...(result.briefingFileName != null && { fileName: result.briefingFileName }),
  };
}),
```

**After** (named action extracted to `setup({ actions })`, then referenced by string):
```typescript
// Inside setup({ actions: { ... } })
recoverBriefingFromHydration: sendTo('briefingActor', ({ event }): BriefingActorInputEvent => {
  const output = readHydrationMachineOutput(event);
  const result = output.status === 'success' ? output.hydration : null;
  if (result === null) return { type: 'RESET' };
  return {
    type: 'EXTRACTION_RECOVERED',
    artifactId: result.extractionArtifactId,
    payload: result.extractionPayload,
    briefingId: result.briefingId,
    normalizedText: result.normalizedText,
    parsedFormat: result.parsedFormat,
    ...(result.briefingFileName != null && { fileName: result.briefingFileName }),
  };
}),
```

**State wiring update** — replace anonymous inline in `hydrating.onDone.actions[]`:
```typescript
actions: [
  assign(({ context, event }) => { /* existing assign unchanged */ }),
  'recoverBriefingFromHydration',   // ← replaces anonymous sendTo
],
```

### Phase 1 Result

| Before | After | Reduction |
|--------|-------|-----------|
| 9 `sendTo` (1 anonymous) | 5 named `sendTo` | −44% |
| 0 contracts | 2 typed contracts | +type safety |
| Anonymous hydration path | `recoverBriefingFromHydration` (testable) | +testability |

**Gate**: `npm --workspace apps/frontend run test` passes, `npm --workspace apps/frontend run typecheck` clean, all user flows preserved

---

## PHASE 2: Domain-Based Adapter Organization (Task 3B)

**File**: `apps/backend/src/lib/adapters/index.ts` (161 lines, currently a monolithic barrel)  
**Risk**: Low — additive restructuring; barrel preserved as shim during migration  
**DDD**: `generation/` and `auth/` align with BCM bounded contexts; `admin/` is an organizational grouping (NOT a context) — see DDD-164

### Current State (verified)

**Barrel exports 9 source files** under a single entry point:
- 25 files import from `'../adapters'` (barrel)
- 1 file imports from `'../../adapters'` (auth-http runtime)
- Total: **26 barrel consumers** to migrate

**Imports by domain** (from barrel analysis):

| Module | Most-imported symbols | Consumer count | BCM Ownership |
|--------|----------------------|----------------|---------------|
| **generation/** | `GenerationAdapters`, `createInMemoryGenerationAdapters`, `OrchestrateArtifactCache`, `ArtifactQueryRepositoryStub`, postgres-redis repositories, `createApiService` (BCM L53) | 20+ files | Generation Context |
| **auth/** | `AuthRepositoryBundle`, `createAuthStubRepositories`, `createAuthProductionRepositories`, auth repo types | 5+ files | Auth Context |
| **admin/** *(org. grouping)* | `createProductChangelog`, `createUserReport`, `createUserReportGithubLink` | 3+ files | Frontend/UI Key Entities (BCM L102) — backend persistence only |

### Target Directory Structure

```
apps/backend/src/lib/adapters/
├── generation/
│   └── index.ts          ← Generation Context entry point (includes ApiService)
├── auth/
│   └── index.ts          ← Auth Context entry point
├── admin/
│   └── index.ts          ← organizational grouping (NOT a bounded context)
│                            ProductChangelog, UserReport, GitHubIssueLink persistence
├── [existing .ts files]  ← unchanged (implementation files stay flat)
└── index.ts              ← becomes deprecation shim (re-exports from domain modules)
```

> ⚠️ Implementation files (e.g. `generation.adapters.ts`, `auth.production.ts`) remain **flat** in the adapters directory. The new domain `index.ts` files are thin re-export aggregators only — no code moves.

### Step 1: Create `adapters/generation/index.ts`

```typescript
// Generation Context adapter entry point (DDD-164)
// Aggregates all generation-related exports for targeted import

export {
  createInMemoryGenerationAdapters,
  type GenerationAdapters,
  type IdempotencyAdapter,
  type LlmGenerateAdapter,
  type LlmGenerateInput,
  type LlmGenerateResult,
  type LlmStreamAdapter,
  type LlmStreamEvent,
  type LlmStreamInput,
  type LlmUsageMetrics,
  type PersistenceAdapter,
  type StreamAdapter,
  type UsageDecision,
  type IdempotencyDecision,
  type UsageAdapter,
  createSyntheticLlmStreamAdapter,
  createSyntheticLlmGenerateAdapter,
} from '../generation.adapters';

export {
  createOpenRouterLlmStreamAdapter,
  createOpenRouterLlmStreamAdapterFromEnv,
  createOpenRouterLlmGenerateAdapter,
  createOpenRouterLlmGenerateAdapterFromEnv,
} from '../openrouter.adapter';

// ApiService belongs to Generation Context (BCM L53, Glossary L74)
export {
  createApiService,
  deleteApiService,
  getApiServiceById,
  listApiServices,
  resolveApiServiceForAcquisition,
  updateApiService,
  type CreateApiServiceInput,
  type UpdateApiServiceInput,
} from '../api-service.adapter';

export { createPostgresRedisGenerationAdapters } from '../postgres-redis.adapters';

export {
  createPostgresRedisProductionDependencies,
  createPostgresRedisProductionGenerationAdapters,
  PostgresArtifactQueryRepository,
  PostgresRedisIdempotencyRepository,
  PostgresProjectOwnershipRepository,
  PostgresProjectQueryRepository,
  PostgresRedisStreamSessionRepository,
  PostgresRedisUsageRepository,
  PostgresArtifactRepository as PostgresArtifactRepositoryLive,
  type PostgresRedisProductionClients,
  type PostgresRedisProductionOptions,
} from '../postgres-redis.production';

export {
  buildIdempotencyRedisLockKey,
  DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX,
} from '../postgres-redis.shared';

export {
  createPostgresRedisStubDependencies,
  createPostgresRedisStubGenerationAdapters,
  ArtifactQueryRepositoryStub,
  PostgresArtifactRepositoryStub,
  ProjectQueryRepositoryStub,
  ProjectOwnershipRepositoryStub,
  RedisIdempotencyRepositoryStub,
  RedisQuotaRepositoryStub,
  RedisStreamSessionRepositoryStub,
  type StubArtifactQueryRecord,
  type PostgresRedisStubOptions,
} from '../postgres-redis.stub';

export type {
  ArtifactQueryRepository,
  OrchestrateArtifactCache,
  PostgresArtifactRepository,
  PostgresRedisAdapterDependencies,
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from '../postgres-redis.interfaces';

export type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactSummary,
} from '../../types/artifacts';

export type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from '../../types/projects';
```

### Step 2: Create `adapters/auth/index.ts`

Same pattern as Step 1: thin re-export aggregator from the existing flat auth files.

```typescript
// Auth Context adapter entry point (DDD-164)
export { createAuthProductionRepositories, PostgresAuthSessionRepository,
         PostgresAuthUserRepository, PostgresOAuthStateRepository,
         type AuthProductionClients } from '../auth.production';
export { createAuthStubRepositories, AuthSessionRepositoryStub,
         AuthUserRepositoryStub, OAuthStateRepositoryStub,
         type AuthStubOptions } from '../auth.stub';
export type { AuthRepositoryBundle, AuthSessionRepository,
              AuthUserRepository, OAuthStateRepository,
              UserQueryRepositoryBundle, AuthProductionOptions } from '../auth.interfaces';
export type { AuthMethod, AuthSessionPrincipal, AuthSessionRecord,
              AuthUserRole, AuthUserStatus, AuthUserRecord,
              CreateAuthUserInput, UpdateAuthUserInput,
              CreateAuthSessionInput, RevokeAuthSessionsInput,
              CreateOAuthStateTokenInput, LinkOAuthAccountInput,
              OAuthAccountRecord, OAuthProvider, OAuthStateTokenRecord,
              AuthUserListFilters, SetAuthUserPasswordInput } from '../../types/auth';
```

### Step 3: Create `adapters/admin/index.ts`

> ⚠️ **`admin/` is an organizational grouping, NOT a bounded context.**  
> `ProductChangelog`, `UserReport`, `GitHubIssueLink` are Frontend/UI context Key Entities (BCM L102, DDD-065/067).  
> `ApiService` is **NOT here** — it belongs to `adapters/generation/` (Generation Context, BCM L53).

```typescript
// Organizational grouping for admin-feature backend persistence (DDD-164)
// NOT a bounded context — see BCM v3.3. Entities per DDD-065/067.
export { createProductChangelog, publishProductChangelog, archiveProductChangelog,
         listPublishedProductChangelogs, listProductChangelogs } from '../product-changelog.adapter';
export { createUserReport, getUserReportById, listUserReports,
         updateUserReportStatus } from '../user-report.adapter';
export { createUserReportGithubLink,
         publishUserReportIssueTransaction } from '../user-report-github-link.adapter';
```

### Step 4: Convert Barrel to Deprecation Shim

Replace `adapters/index.ts` content with re-exports from domain modules:

```typescript
// ⚠️ DEPRECATED BARREL — use domain-specific imports instead:
//   import { ... } from '../adapters/generation'  ← Generation Context (incl. ApiService)
//   import { ... } from '../adapters/auth'         ← Auth Context
//   import { ... } from '../adapters/admin'        ← organizational grouping (changelog, reports)
// This barrel will be removed after all consumers are migrated.

export * from './generation';
export * from './auth';
export * from './admin';
```

> ⚠️ `export *` may cause name conflicts if any symbol appears in two domain modules. Verify with `npm --workspace apps/backend run typecheck` immediately after this change. Resolve any conflicts by exporting explicitly.

### Step 5: Migrate Consumer Imports

Migrate all 26 barrel consumers to domain-specific import paths. Representative examples:

```typescript
// Generation-only import
//   Before: import { createInMemoryGenerationAdapters } from '../adapters';
//   After:  import { createInMemoryGenerationAdapters } from '../adapters/generation';

// Auth-only import
//   Before: import { createAuthStubRepositories } from '../adapters';
//   After:  import { createAuthStubRepositories } from '../adapters/auth';

// Mixed import — split by domain
//   Before: import { createAuthStubRepositories, createInMemoryGenerationAdapters } from '../adapters';
//   After:
//     import { createInMemoryGenerationAdapters } from '../adapters/generation';
//     import { createAuthStubRepositories }        from '../adapters/auth';
```

**Migration priority** (by volume, easiest first):
1. Files importing only `createInMemoryGenerationAdapters` (10+ files)
2. Files importing only `GenerationAdapters` type (5+ files)
3. Auth test/runtime files (5 files)
4. Mixed-import files (remaining, one-by-one)

### Step 6: Final Barrel Removal (optional, post-validation)

Once all 26 consumers are migrated and `npm --workspace apps/backend run go` passes, the barrel shim can be emptied (or removed). This step is **not required for Sprint 3 completion** — consumer migration is the success criterion, not barrel deletion.

**Gate**: All backend tests pass (335/335), typecheck clean, no remaining imports from bare `'../adapters'`

---

## Validation & Success Criteria

### **Sprint 3 Complete When**:
- [ ] `tool-page-actor-contracts.ts` created with `BriefingActorInputEvent` and `GenerationLifecycleInputEvent`
- [ ] All 9 `sendTo` actions systematically replaced by 5 named actions: `forwardBriefingCommand`, `syncBriefingContext`, `recoverBriefingFromHydration`, `forwardStepOutcomeToLifecycle`, `controlGenerationLifecycle`
- [ ] `hydrating.onDone` actions array uses `'recoverBriefingFromHydration'` (no anonymous `sendTo`)
- [ ] Frontend tests pass: `npm --workspace apps/frontend run test`
- [ ] Domain modules `adapters/generation/index.ts` (incl. ApiService), `adapters/auth/index.ts`, `adapters/admin/index.ts` (organizational grouping) created
- [ ] All 26 barrel consumers migrated to domain-specific import paths
- [ ] `npm --workspace apps/backend run go` passes (full validation: migrate + seed + typecheck + test)

### **DDD Compliance Verified**:
- [ ] `DDD-163` entry created in decision log before Phase 1 implementation
- [ ] `DDD-164` entry created in decision log before Phase 2 implementation
- [ ] Actor contracts respect Frontend/UI downstream consumer role (BCM Line 25)
- [ ] `generation/` and `auth/` modules align with BCM bounded contexts; `admin/` module documented as organizational grouping (NOT a bounded context), with explicit comment referencing BCM L102 and DDD-067

### **Validation Commands**

| Gate | Command | Expected |
|------|---------|----------|
| Phase 1 — frontend tests | `npm --workspace apps/frontend run test` | All tests pass, no behavioral change |
| Phase 1 — sendTo count | `grep -c 'sendTo' apps/frontend/src/features/tools/machines/tool-page.machine.ts` | ≤ 5 |
| Phase 2 — backend full | `npm --workspace apps/backend run go` | typecheck clean, 335/335 tests pass |
| Phase 2 — barrel free | `rg "from '(\.\.\/|\.\.\/\.\.\/)adapters'" apps/backend/src -g '*.ts' -l` | 0 files (shim excluded) |
