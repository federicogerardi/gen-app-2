---
status: active
version: 1.0
last-reviewed: 2026-07-08
next-review-date: 2026-10-08
owner: Domain Architecture
date_created: 2026-07-08
title: Monolithic Elements Architectural Review
type: code-review
tags:
  - architecture
  - monolith
  - refactoring
  - technical-debt
  - ddd
  - bounded-contexts
goal: Identify remaining monolithic elements preventing true modular architecture and propose decomposition strategy
---

# Monolithic Elements Architectural Review

## Executive Summary

This document identifies **architectural improvement opportunities** within the current approved DDD bounded context design. While the workspace demonstrates strong DDD compliance through its documented Bounded Context Map and Integration Constraints, certain areas show **operational complexity** and **internal organization challenges** that could be enhanced without violating domain boundaries.

The analysis distinguishes between **DDD violations** (requiring immediate correction) and **operational improvements** (enhancing maintainability within approved architecture).

## Current Status: Infrastructure Coupling vs Domain Isolation

The codebase exhibits **selective coupling issues** where Infrastructure Layer concerns are appropriately shared across bounded contexts (per DDD principles), but some areas show **Domain Logic leakage** and **orchestration complexity** that could benefit from refinement while respecting the approved bounded context architecture.

---

## **CRITICAL MONOLITHIC ELEMENTS**

## **ARCHITECTURAL IMPROVEMENT OPPORTUNITIES**

### **1. Infrastructure Layer Complexity Management (Confidence: 90)**

**Location**: `apps/backend/src/lib/adapters/index.ts` (161 lines of exports)

**Current Status**: The adapter layer appropriately centralizes Infrastructure Layer concerns per DDD principles (technical adapters may be shared across bounded contexts). However, the current organization creates **operational complexity** without violating domain boundaries.

**Issue**: While DDD-compliant, the single barrel export creates:
- **Operational coupling**: Changes in any infrastructure concern require understanding all contexts
- **Testing complexity**: Integration tests must mock entire infrastructure stack
- **Development friction**: Developers must navigate 33+ adapters for single-context work

**Architectural Opportunity**: Organize adapters by **operational scope** rather than strict domain isolation:

```
apps/backend/src/lib/adapters/
├── business/           # Business-context adapters (Auth, Generation, Usage, Projects)
├── technical/          # Pure technical adapters (Postgres, Redis drivers)
└── integration/        # Cross-context integration adapters (API services, etc.)
```

**DDD Compliance**: ✅ Maintains Infrastructure Layer sharing while improving operational clarity.

**Impact Assessment**: Medium-High operational benefit, Low DDD risk.

---

### **2. Generation System Orchestration Refinement (Confidence: 85)**

**Location**: `apps/backend/src/lib/machines/generation-system.definition.ts`

**Current Status**: The `GenerationSystem` is correctly defined as the **Aggregate Root** for the Generation bounded context per the approved Bounded Context Map (BCM line 36). The machine appropriately orchestrates cross-context integration as documented in approved Integration Constraints.

**Architectural Opportunity**: While DDD-compliant in its orchestrator role, the machine could benefit from **internal complexity reduction** through enhanced delegation patterns:

```typescript
// Current: Direct context field mixing (acceptable but complex)
context: ({ input }) => ({
  userId: null,           // Auth integration point
  projectId: null,        // Projects integration point  
  artifactId: null,       // Generation core domain
  toolKey: null,          // Tools integration point
  // ...15+ other integration and domain fields
})
```

**Proposed Enhancement**: Extract **domain-specific context builders** while maintaining the approved orchestrator role:

```typescript
// Enhanced: Delegated context assembly with clear domain separation
context: ({ input }) => ({
  ...buildAuthIntegrationContext(input),      // Auth integration fields
  ...buildProjectsIntegrationContext(input),  // Projects integration fields
  ...buildGenerationCoreContext(input),       // Generation domain fields
  ...buildToolsIntegrationContext(input),     // Tools integration fields
})
```

**DDD Compliance**: ✅ Maintains approved Aggregate Root orchestrator role while improving internal organization.

**BCM Alignment**: Respects the canonical definition: "generationSystemMachine — top-level orchestrator" while reducing cognitive complexity.

**Impact Assessment**: Medium operational benefit, Zero DDD risk.

---

### **3. Route Capabilities Evolution Strategy (Confidence: 85)**

**Location**: `apps/backend/src/lib/runtime/auth-http/route-table.ts`, lines 25-43

**Current Status**: The routing system centralizes capabilities across domains in a single enum. While this provides unified capability management, it creates evolutionary friction for independent domain development.

**Issue Assessment**: Not a DDD violation (Infrastructure Layer may centralize routing), but creates **operational friction** for domain evolution:

```typescript
export type AuthHttpRouteCapability =
  | 'auth.login'          // Auth domain
  | 'admin.users'         // Admin/Auth domain
  | 'projects'            // Projects domain
  | 'tools.briefs'        // Tools domain
  | 'feedback.public'     // Feedback domain
```

**Evolutionary Strategy**: Introduce **capability namespacing** while maintaining centralized routing infrastructure:

```typescript
export type AuthHttpRouteCapability = 
  | AuthDomainCapability 
  | ProjectsDomainCapability 
  | ToolsDomainCapability 
  | FeedbackDomainCapability;

// Domain-specific capability enums
export type AuthDomainCapability = 'auth.login' | 'auth.logout' | 'auth.session' | 'auth.google.start';
export type ProjectsDomainCapability = 'projects';
export type ToolsDomainCapability = 'tools.briefs' | 'tools.hydrate' | 'tools.orchestrate';
// etc.
```

**DDD Compliance**: ✅ Maintains Infrastructure Layer centralization while enabling domain-specific capability evolution.

**Benefits**: 
- Domain teams can evolve capabilities independently
- Central routing coordination preserved  
- Type safety maintained across domain boundaries

**Impact Assessment**: Medium organizational benefit, Zero DDD risk.

---

## **SIGNIFICANT MONOLITHIC ELEMENTS**

## **SIGNIFICANT IMPROVEMENT OPPORTUNITIES**

### **4. Frontend Domain Logic Decomposition (Confidence: 90)**

**Location**: `apps/frontend/src/features/tools/runtime/useToolPage.ts`

**DDD Issue**: The `useToolPage` hook (234+ lines) violates the **Single Responsibility Principle** and couples multiple bounded contexts inappropriately:

```typescript
// Anti-pattern: Frontend hook managing business logic across 8+ domains
const useToolPage = ({ toolKey, sourceArtifactId, intent, ... }) => {
  const authState = useAuthState();           // Auth domain
  const generationStream = useGenerationStreamWorkspace(); // Generation domain
  const { data: projects } = useProjectsQuery();           // Projects domain
  // ...continues orchestrating domain logic for 200+ more lines
}
```

**DDD Violation**: Frontend/UI context should be downstream consumer only per BCM (line 25), not orchestrator of domain logic.

**Architectural Improvement**: Decompose into **domain-specific hooks** with clear separation:

```typescript
// Domain-specific hooks respecting bounded context boundaries
const useAuthForTools = () => { /* Auth integration only */ };
const useProjectsForTools = () => { /* Projects integration only */ };  
const useGenerationForTools = () => { /* Generation integration only */ };
const useToolPageOrchestration = () => { /* UI coordination only */ };
```

**DDD Compliance**: ✅ Aligns with BCM definition of Frontend/UI as downstream consumer, not domain orchestrator.

**Impact Assessment**: High architectural benefit, High DDD alignment.

---

### **5. Cross-Context Type Integration Clarity (Confidence: 75)**

**Location**: `apps/backend/src/lib/types/xstate.ts`, lines 52-66

**Current Status**: The `GenerationSystemContext` type contains integration points across domains, which is **appropriate for an Aggregate Root orchestrator** per approved BCM, but could benefit from clearer **integration vs domain** field distinction:

```typescript
export interface GenerationSystemContext {
  requestId: string;        // Generation domain core
  userId: string | null;    // Auth integration point (per Integration Constraint)
  projectId: string | null; // Projects integration point (per Integration Constraint)
  sessionId: string | null; // Generation domain core
  toolKey: RegistryBackedToolKey | null; // Tools integration point (per approved orchestration)
  // ...other fields serving orchestration role
}
```

**Improvement Opportunity**: Add **type-level documentation** to clarify integration vs core domain responsibilities:

```typescript
export interface GenerationSystemContext {
  // === Core Generation Domain ===
  requestId: string;
  sessionId: string | null;
  artifactId: string | null;
  contentBuffer: string;
  
  // === Approved Integration Points (per BCM Integration Constraints) ===
  userId: string | null;    // Auth integration (BCM constraint DDD-XXX)
  projectId: string | null; // Projects integration (BCM constraint DDD-XXX)  
  toolKey: RegistryBackedToolKey | null; // Tools integration (canonical per DDD-029)
  
  // === Technical Infrastructure ===
  adapters: GenerationAdapters;
  // ...
}
```

**DDD Compliance**: ✅ No violation - Aggregate Root may orchestrate approved integrations. Enhancement improves clarity without changing semantics.

---

### **6. Infrastructure Dependency Organization (Confidence: 70)**

**Location**: `apps/backend/src/lib/adapters/postgres-redis.production.ts`, lines 40-99

**Current Status**: The factory appropriately centralizes **Infrastructure Layer** concerns per DDD principles. Infrastructure may be shared across bounded contexts without violating domain isolation.

**Operational Improvement**: While DDD-compliant, the current organization could benefit from **dependency injection clarity**:

```typescript
// Current: All infrastructure bundled together (DDD-compliant but operationally complex)
return {
  pg: clients.pg,                    // Technical infrastructure
  ownership: new PostgresProjectOwnershipRepository(...), // Projects domain adapter
  quota: new PostgresRedisUsageRepository(...),          // Usage domain adapter  
  idempotency: new PostgresRedisIdempotencyRepository(...), // Generation domain adapter
  // ...8 other adapters from different operational concerns
};
```

**Enhancement Strategy**: Organize by **operational responsibility** while maintaining shared infrastructure:

```typescript
// Enhanced: Clear operational groupings within shared infrastructure
return {
  // Core technical infrastructure
  infrastructure: {
    pg: clients.pg,
    redis: clients.redis,
  },
  
  // Business domain adapters (grouped for operational clarity)
  domainAdapters: {
    auth: new PostgresAuthRepository(...),
    projects: new PostgresProjectOwnershipRepository(...),
    usage: new PostgresRedisUsageRepository(...),
    generation: { /* generation-specific adapters */ },
  },
  
  // Cross-cutting concerns
  crossCutting: {
    orchestrateCache: new RedisOrchestrateArtifactCache(...),
  },
};
```

**DDD Compliance**: ✅ Maintains Infrastructure Layer sharing principles while improving operational organization.

**Impact Assessment**: Medium operational benefit, Zero DDD risk.

---

## **PRIORITY RECOMMENDATIONS**

### **Phase 1: Frontend Domain Logic Realignment** 🔥
- **Target**: Decompose `useToolPage` into domain-specific hooks per bounded context boundaries
- **ROI**: High - Aligns Frontend/UI with approved BCM role as downstream consumer
- **DDD Risk**: Zero - Improves conformance to documented bounded context responsibilities
- **Effort**: 3-4 days of hook decomposition + component updates
- **Status**: **Critical for DDD Compliance** - Frontend currently violates its documented downstream role

### **Phase 2: Infrastructure Organization Enhancement** ⚠️
- **Target**: Reorganize adapter layer by operational scope while maintaining Infrastructure Layer sharing
- **ROI**: Medium-High - Improves operational clarity without violating DDD principles  
- **DDD Risk**: Zero - Infrastructure may be shared per DDD principles
- **Effort**: 2-3 days of reorganization + import path updates
- **Status**: **Operational Improvement** - DDD-compliant but operationally beneficial

### **Phase 3: Generation System Internal Refinement** 📋
- **Target**: Extract domain-specific context builders while maintaining approved orchestrator role
- **ROI**: Medium - Reduces cognitive complexity within approved architectural role
- **DDD Risk**: Zero - Maintains canonical Aggregate Root definition  
- **Effort**: 2-3 days of internal refactoring
- **Status**: **Enhancement** - Already DDD-compliant, improvement for maintainability

### **Phase 4: Route Capabilities Namespacing** 📋
- **Target**: Introduce capability namespacing while maintaining centralized routing
- **ROI**: Medium - Enables domain-specific evolution within shared infrastructure
- **DDD Risk**: Zero - Infrastructure Layer may centralize routing per DDD principles
- **Effort**: 1-2 days of type system enhancement
- **Status**: **Evolutionary Strategy** - Prepares for future domain independence

---

## **ACCEPTED ARCHITECTURAL DECISIONS**

**Per Bounded Context Map Validation**:
- **GenerationSystem as Aggregate Root**: ✅ **Approved** - correctly orchestrates approved Integration Constraints
- **Infrastructure Layer Sharing**: ✅ **Approved** - adapters may be shared across bounded contexts per DDD
- **Cross-Context Integration Points**: ✅ **Approved** - 54 documented Integration Constraints validate necessary coupling

**Clarifications**:
- **Not problematic**: `usageMachine` operating as delegate actor (BCM line 66 - approved by design)
- **Not problematic**: Guard sequence `idempotency → ownershipCheck → usage` (BCM line 64 - canonical pattern)
- **Not problematic**: Infrastructure adapters shared across contexts (DDD Infrastructure Layer principle)

## **SUCCESS METRICS**

1. **Frontend Bounded Context Compliance**: Frontend/UI operates as downstream consumer only (per BCM line 25)
2. **Infrastructure Operational Clarity**: Infrastructure organization supports domain team independence 
3. **Orchestration Complexity Management**: Internal complexity reduced while maintaining approved orchestrator roles
4. **Domain Evolution Independence**: Domain-specific changes don't require infrastructure modifications

## **IMPLEMENTATION STRATEGY**

Focus should be on **Phase 1 (Frontend Realignment)** to achieve DDD compliance, followed by **Phase 2 (Infrastructure Organization)** for operational benefits. 

**Key Principle**: Improve architectural clarity and operational independence **within the approved DDD framework** rather than challenging the documented bounded context design.

---

## **REFERENCES**

- [Graph Structural Analysis Review](./graph-structural-analysis-review.md)
- [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md) - **Canonical Architecture Reference**
- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md)
- [Integration Constraints](../02-design/domain-bounded-context-map.md#integration-constraints) - **54 Approved Cross-Context Rules**