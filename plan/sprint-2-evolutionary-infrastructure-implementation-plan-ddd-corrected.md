---
status: active
version: 1.2-ddd-balanced
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

| Builder | Fields | Organizational Concern |
|---------|--------|----------------------|
| `buildGenerationCoreContext` | `toolKey`, `workflowType`, `artifactType`, `mode`, `routeType` | Core domain logic |
| `buildGenerationRuntimeContext` | `requestId`, `userId`, `projectId`, `sessionId`, `model`, `requestInput`, `outputFormat`, `contentBuffer` | Runtime + Auth integration points |
| `buildGenerationInfraContext` | `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder`, `registryVersion`, `registrySnapshotRef`, `inputTokens`, `outputTokens`, `costUsd`, `_creditCost` | Infrastructure + metrics |

**Implementation**:
```typescript
// ✅ Generation Context internal builders — aggregate root authority maintained
export function buildGenerationCoreContext(input: GenerationSystemInput) {
  return {
    toolKey:      input.toolKey,
    workflowType: input.workflowType,
    artifactType: input.artifactType,
    mode:         resolveWorkflowRunMode(input.intent),
    routeType:    input.routeType,
  };
}

export function buildGenerationRuntimeContext(input: GenerationSystemInput) {
  return {
    requestId:     input.requestId,
    userId:        input.userId,
    projectId:     input.projectId,
    sessionId:     input.sessionId,
    model:         input.model,
    requestInput:  input.input,
    outputFormat:  input.outputFormat ?? 'markdown',
    contentBuffer: '',
  };
}

export function buildGenerationInfraContext(
  input: GenerationSystemInput,
  adapters: GenerationAdapters,
) {
  return {
    adapters,
    runtimeNow:         () => new Date(),
    artifactIdFactory:  defaultArtifactIdFactory,
    responseBuilder:    defaultResponseBuilder,
    registryVersion:    input.registryVersion,
    registrySnapshotRef: input.registrySnapshotRef,
    inputTokens:  0,
    outputTokens: 0,
    costUsd:      0,
    _creditCost:  0,
  };
}
```

**Steps**:
1. Add builders to `generation-system.runtime.ts`
2. Update context creation in `generation-system.definition.ts`
3. Update consumer files systematically (`actions`, `actors`, `guards`, `*.states.ts`)
4. Update test mocks to use builders
5. Run `npm --workspace apps/backend run go` — full validation

**Gate**: All generation system tests pass, 3 builders operational, cognitive complexity reduced

---

## Validation & Success Criteria

### **Sprint 2 Complete When**:
- [ ] `HttpRouteCapabilities` namespace operational, all 13 capabilities preserved
- [ ] 3 Generation Context builders implemented and used in context creation
- [ ] All consumer files updated, `npm --workspace apps/backend run go` passes
- [ ] Build typecheck < 30s maintained
- [ ] Sprint 4B critical dependency satisfied

### **DDD Compliance Verified**:
- [ ] `DDD-XXX` entry created in decision log
- [ ] Route capabilities classified as Infrastructure Layer (not domain boundaries)
- [ ] All context field ownership attributed to Generation Context
- [ ] `GenerationSystem` aggregate root authority preserved