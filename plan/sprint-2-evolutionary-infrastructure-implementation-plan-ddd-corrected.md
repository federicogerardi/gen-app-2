---
status: active
version: 1.3-executable
last-reviewed: 2026-07-08
next-review-date: 2026-07-22
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 2 Implementation Plan - Evolutionary Infrastructure (DDD-Balanced)
type: implementation-plan
tags:
  - sprint-planning
  - infrastructure-evolution
  - sprint-4b-enablement
  - ddd-compliance
goal: DDD-compliant infrastructure preparation for Sprint 4B context decomposition
---

# Sprint 2 Implementation Plan - Evolutionary Infrastructure (DDD-Balanced)

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Prerequisites**: Sprint 1 completed (✅ Task 1A, ✅ Task 1C, ❌ Task 1B cancelled)  
**Execution**: Agent AI with sequential validation

---

## Sprint Objective

Enable Sprint 4B GenerationSystem Context Decomposition through:
1. **HTTP Route Capability Organization** — Infrastructure Layer operational namespacing
2. **Generation System Context Builders** — Internal organization respecting aggregate root role

**Critical**: Route Capabilities (2A) is a **BLOCKING** prerequisite for Sprint 4B.

---

## DDD Requirements

**Decision Log**: Create single `DDD-XXX` entry before implementation:
```markdown
| DDD-XXX | 2026-07-08 | GenerationSystemContextBuilders | Generation Context internal organization through domain-specific builders | Reduces cognitive complexity while maintaining GenerationSystem aggregate root role | Generation Context |
```

**Key Constraints**:
- All `GenerationMachineContext` fields belong to **Generation Context** (integration points, not domain ownership)
- Route capabilities are **Infrastructure Layer** operational concerns, not domain boundaries
- Builders serve the **GenerationSystem aggregate root** — no cross-context authority

---

## PHASE 1: HTTP Route Capability Organization (Task 2A)

**File**: `apps/backend/src/lib/runtime/auth-http/route-table.ts:25-43`  
**Risk**: Zero — type-only changes, no runtime usage  
**DDD**: Infrastructure Layer operational grouping only

**Implementation**:
```typescript
// Infrastructure Layer operational namespacing (NOT domain boundaries)
export namespace HttpRouteCapabilities {
  export type AuthOperations    = 'login' | 'logout' | 'session' | 'google.start';
  export type AdminOperations   = 'users' | 'models' | 'api-services' | 'api-service-bindings';
  export type ToolsOperations   = 'briefs' | 'hydrate' | 'orchestrate' | 'api-services' | 'sessions';
  export type ProjectOperations = 'projects';
  export type ArtifactOperations = 'artifacts';
  export type FeedbackOperations = 'public' | 'admin';
}

export type AuthHttpRouteCapability =
  | `auth.${HttpRouteCapabilities.AuthOperations}`
  | `admin.${HttpRouteCapabilities.AdminOperations}`
  | `tools.${HttpRouteCapabilities.ToolsOperations}`
  | HttpRouteCapabilities.ProjectOperations
  | HttpRouteCapabilities.ArtifactOperations
  | `feedback.${HttpRouteCapabilities.FeedbackOperations}`;
```

**Steps**:
1. Introduce `HttpRouteCapabilities` namespace above existing type
2. Rewrite `AuthHttpRouteCapability` using template literals
3. Preserve `AUTH_HTTP_ROUTE_CAPABILITIES` constant unchanged
4. Verify typecheck passes — zero runtime changes

**Gate**: All 13 capabilities preserved, typecheck clean, Sprint 4B routing infrastructure ready

---

## PHASE 2: Generation System Context Builders (Task 2B)

**File**: `apps/backend/src/lib/machines/generation-system.definition.ts`  
**Risk**: Low-Medium — core pipeline, systematic approach  
**DDD**: All builders serve Generation Context aggregate root

**Context Categorization** (all fields are Generation Context owned):

> ⚠️ `GenerationSystemInput` is `{ adapters, initialContext?, runtime? }` — it does **not** carry context fields directly.
> Context fields start as hardcoded defaults and are populated by actions on `REQUEST_RECEIVED`.
> Builders encapsulate **default value groups** and **infra wiring**, not input parsing.

| Builder | Fields | Organizational Concern |
|---------|--------|----------------------|
| `buildGenerationCoreDefaults` | `requestId`, `userId`, `projectId`, `sessionId`, `toolKey`, `registryVersion`, `registrySnapshotRef`, `workflowType`, `artifactType`, `mode`, `artifactId`, `contentBuffer`, `failureReason` | Core domain defaults |
| `buildGenerationRuntimeDefaults` | `model`, `requestInput`, `idempotencyKey`, `outputFormat`, `syntheticResponse`, `routeType`, `pendingFallback`, `effectiveModelResolution` | Runtime state defaults |
| `buildGenerationMetricsDefaults` | `inputTokens`, `outputTokens`, `costUsd`, `_creditCost` | Metrics defaults |
| `buildGenerationInfraContext` | `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder` | Infrastructure wiring from `input` |

**Implementation** (in `generation-system.runtime.ts`):
```typescript
// ✅ Builders encapsulate default groups — no input parsing of context fields
export function buildGenerationCoreDefaults() {
  return {
    requestId:          '',
    userId:             null,
    projectId:          null,
    sessionId:          null,
    toolKey:            null,
    registryVersion:    null,
    registrySnapshotRef: null,
    workflowType:       null,
    artifactType:       'content' as const,
    mode:               'stream' as const,
    artifactId:         null,
    contentBuffer:      '',
    failureReason:      null,
  };
}

export function buildGenerationRuntimeDefaults() {
  return {
    model:                   'unknown',
    requestInput:            {} as Record<string, unknown>,
    idempotencyKey:          null,
    outputFormat:            'plain' as const,
    syntheticResponse:       '',
    routeType:               null,
    pendingFallback:         null,
    effectiveModelResolution: null,
  };
}

export function buildGenerationMetricsDefaults() {
  return {
    inputTokens:  0,
    outputTokens: 0,
    costUsd:      0,
    _creditCost:  1,
  };
}

export function buildGenerationInfraContext(
  adapters: GenerationAdapters,
  runtime?: GenerationSystemInput['runtime'],
) {
  return {
    adapters,
    runtimeNow:        runtime?.now             ?? (() => new Date()),
    artifactIdFactory: runtime?.artifactIdFactory ?? defaultArtifactIdFactory,
    responseBuilder:   runtime?.responseBuilder   ?? defaultResponseBuilder,
  };
}
```

**Updated context creation** in `generation-system.definition.ts`:
```typescript
context: ({ input }) => ({
  ...buildGenerationCoreDefaults(),
  ...buildGenerationRuntimeDefaults(),
  ...buildGenerationMetricsDefaults(),
  ...buildGenerationInfraContext(input.adapters, input.runtime),
  ...input.initialContext,
}),
```

**Steps**:
1. Add 4 builders to `generation-system.runtime.ts`
2. Replace inline defaults block in `generation-system.definition.ts` with builder spread calls
3. Consumer files (`actions`, `actors`, `guards`, `*.states.ts`) need **no changes** — they read context fields as before, builders only affect initialization
4. Update test mocks: replace inline context objects with `{ ...buildGenerationCoreDefaults(), ...buildGenerationRuntimeDefaults(), ...buildGenerationMetricsDefaults(), ...buildGenerationInfraContext(mockAdapters) }`
5. Run `npm --workspace apps/backend run go` — full validation

**Gate**: All generation system tests pass, 4 builders operational, context initialization organized by concern, consumer files unchanged

---

## Validation & Success Criteria

### **Sprint 2 Complete When**:
- [ ] `HttpRouteCapabilities` namespace operational, all 13 capabilities preserved
- [ ] 4 Generation Context builders implemented and used in context initialization (`generation-system.runtime.ts`)
- [ ] All consumer files updated, `npm --workspace apps/backend run go` passes
- [ ] Build typecheck < 30s maintained
- [ ] Sprint 4B critical dependency satisfied

### **DDD Compliance Verified**:
- [ ] `DDD-XXX` entry created in decision log
- [ ] Route capabilities classified as Infrastructure Layer (not domain boundaries)
- [ ] All context field ownership attributed to Generation Context
- [ ] `GenerationSystem` aggregate root authority preserved