---
status: archived
version: 1.0
last-reviewed: 2026-07-08
next-review-date: 2027-01-08
owner: Domain Architecture Team
date_created: 2026-07-08
superseded_by: sprint-2-evolutionary-infrastructure-implementation-plan-ddd-corrected.md
superseded_date: 2026-07-08
title: Sprint 2 Implementation Plan - Evolutionary Infrastructure (SUPERSEDED)
type: implementation-plan
tags:
  - sprint-planning
  - architectural-vulnerabilities
  - infrastructure-evolution
  - superseded
goal: "[SUPERSEDED] Use DDD-corrected version instead"
---

# ⚠️ SUPERSEDED DOCUMENT

**This plan has been superseded by:**
**[Sprint 2 Implementation Plan - DDD-Corrected](./sprint-2-evolutionary-infrastructure-implementation-plan-ddd-corrected.md)**

## Supersession Notice

This document contained **critical DDD violations** that would have prevented successful Sprint 2 execution:

### **Critical Issues Identified**
1. **BCM Ownership Violation**: Incorrectly categorized `GenerationMachineContext` fields as belonging to different domains (Auth, Analytics, etc.) when ALL fields belong to Generation Context per aggregate root role
2. **Domain Boundary Confusion**: Confused route capabilities (Infrastructure Layer concerns) with domain boundaries 
3. **Non-Canonical Terminology**: Introduced multiple terms without required DDD decision log entries
4. **Context Field Misattribution**: Violated BCM by suggesting context fields "belong" to other domains instead of recognizing them as integration points within Generation Context

### **Migration Path**

**For Sprint 2 Implementation**: Use **[Sprint 2 DDD-Corrected Implementation Plan](./sprint-2-evolutionary-infrastructure-implementation-plan-ddd-corrected.md)** which provides:

1. **BCM-Compliant Context Organization**: All `GenerationMachineContext` fields properly attributed to Generation Context with internal organizational concerns
2. **Infrastructure Layer Clarity**: Route capabilities correctly classified as Infrastructure Layer operational concerns, NOT domain boundaries
3. **Canonical Terminology**: All terms aligned with Ubiquitous Language and required DDD decision log entries identified
4. **Aggregate Root Preservation**: `GenerationSystem` role maintained per BCM line 34

## Content Preservation Notice

The technical implementation approach from this document has been **fully preserved and corrected** in the DDD-compliant version:

- **Task Scope**: Same technical objectives with DDD compliance corrections
- **Sequential Approach**: Maintained Phase 1 → Phase 2 validation strategy  
- **Agent AI Readiness**: Enhanced with DDD validation checkpoints
- **Sprint 4B Enablement**: Same critical dependency satisfaction with proper DDD foundation

## Why This Supersession Was Critical

**Domain-Driven Design Compliance**: The original plan violated fundamental DDD principles:
- **BCM Line 34**: `GenerationSystem` is the aggregate root of Generation Context - ALL context fields belong to this context
- **Integration vs Ownership**: Confused integration points (fields that come from other contexts) with domain ownership (all fields owned by Generation Context)
- **Infrastructure vs Domain**: Confused Infrastructure Layer route capabilities with bounded context domain boundaries
- **Canonical Governance**: Introduced new terminology without required DDD decision log governance

**Sprint 4B Risk**: These violations would have:
- Created incorrect domain boundaries for Sprint 4B context decomposition
- Violated Generation Context aggregate root authority
- Introduced architectural anti-patterns instead of resolving them
- Compromised the unified review's progressive remediation strategy

**Status**: This document is archived but preserved for historical reference. All active Sprint 2 work must use the DDD-corrected version.

---

# Original Plan Content (Superseded - Contains DDD Violations)

**⚠️ WARNING**: The content below contains DDD violations. Do not use for implementation.

**Source**: [Unified Architectural Vulnerabilities Review](../../../07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Prerequisites**: Sprint 1 completed (✅ Task 1A, ✅ Task 1C, ❌ Task 1B cancelled)  
**Execution**: Agent AI with sequential validation approach

---

## Sprint Objective

**Primary Goal**: Enable Sprint 4B GenerationSystem Context Decomposition through infrastructure preparation:
1. **Route Capabilities Evolution** - Domain namespacing for context routing  
2. **Generation System Enhancement** - Context builders for cognitive complexity reduction

**Critical Success**: Sprint 4B dependency "Route Capabilities (Sprint 2A) completed" satisfied

---

## Risk Assessment & Strategy

### **Risk Analysis**
- **Task 2A (Route Capabilities)**: **ZERO RISK** - Type-only changes, no runtime usage
- **Task 2B (Generation System)**: **LOW-MEDIUM RISK** - Core pipeline but systematic approach  
- **App Status**: Non-production enables aggressive but safe refactoring
- **Integration Risk**: Mitigated through sequential validation

### **Risk Management**
- **Approach**: Aggressive optimization leveraging non-production status
- **Rollback**: Commit-level reversion (no feature flags needed)
- **Validation**: Progressive checkpoints with comprehensive testing
- **Quality**: Full test suite validation at each phase

---

## Sequential Implementation Plan

### **PHASE 1: Route Capabilities Evolution** (Task 2A - A3 📋)

#### **Current State Validation**
- **File**: `apps/backend/src/lib/runtime/auth-http/route-table.ts:25-43`
- **Current**: 13 flat capability strings (`'auth.login' | 'admin.users' | ...`)
- **Usage**: Type-only export, zero runtime dependencies confirmed
- **Sprint 4B Need**: Domain-aware capability resolution for context routing

#### **Implementation Steps**

**Step 1.1: Domain Analysis & Design**
```typescript
// Target: Domain-structured capabilities for Sprint 4B context routing
export namespace RouteCapabilities {
  export type Auth = 'login' | 'logout' | 'session' | 'google.start';
  export type Admin = 'users' | 'models' | 'api-services' | 'api-service-bindings';
  export type Tools = 'briefs' | 'hydrate' | 'orchestrate' | 'api-services' | 'sessions';
  export type Projects = 'projects';
  export type Artifacts = 'artifacts'; 
  export type Feedback = 'public' | 'admin';
}

export type AuthHttpRouteCapability = 
  | `auth.${RouteCapabilities.Auth}`
  | `admin.${RouteCapabilities.Admin}`
  | `tools.${RouteCapabilities.Tools}`
  | RouteCapabilities.Projects
  | RouteCapabilities.Artifacts
  | `feedback.${RouteCapabilities.Feedback}`;
```

**Step 1.2: Implementation**
- Transform `AuthHttpRouteCapability` to namespace structure
- Maintain backward compatibility with existing string union
- Update `AUTH_HTTP_ROUTE_CAPABILITIES` constant 
- Preserve all 13 current capability strings

**Step 1.3: Validation**
- Verify type-level correctness
- Confirm zero runtime usage remains
- Validate Sprint 4B readiness: domain-aware capability resolution enabled

#### **Phase 1 Success Criteria**
- [ ] Domain-specific capability namespacing operational
- [ ] All 13 existing capabilities preserved  
- [ ] Type system validates correctly
- [ ] Sprint 4B context routing infrastructure prepared

---

### **PHASE 2: Generation System Internal Enhancement** (Task 2B - A2 📋)

#### **Current State Analysis**
- **File**: `apps/backend/src/lib/machines/generation-system.definition.ts`
- **Context**: `GenerationMachineContext` with 25+ fields across domains
- **Consumer Files**: 7+ files directly importing context type
- **Sprint 4B Need**: Reduced cognitive complexity for context decomposition

#### **Context Field Categorization**
Based on technical analysis, fields grouped by domain concern:

**Request Context** (Auth/Identity domain):
- `requestId`, `userId`, `projectId`, `sessionId`

**Workflow Context** (Generation domain core):
- `toolKey`, `workflowType`, `artifactType`, `mode`, `routeType`

**Execution Context** (Runtime domain):
- `model`, `requestInput`, `outputFormat`, `contentBuffer`

**Registry Context** (Configuration domain):
- `registryVersion`, `registrySnapshotRef`

**Metrics Context** (Analytics domain):
- `inputTokens`, `outputTokens`, `costUsd`, `_creditCost`

**Infrastructure Context** (System domain):
- `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder`

#### **Implementation Steps**

**Step 2.1: Context Builder Design**
```typescript
// Domain-specific context builders for Sprint 4B decomposition prep
export const buildRequestContext = (input: GenerationSystemInput) => ({
  requestId: input.requestId,
  userId: input.userId,  
  projectId: input.projectId,
  sessionId: input.sessionId,
});

export const buildWorkflowContext = (input: GenerationSystemInput) => ({
  toolKey: input.toolKey,
  workflowType: input.workflowType,
  artifactType: input.artifactType,
  mode: resolveWorkflowRunMode(input.intent),
  routeType: input.routeType,
});

export const buildExecutionContext = (input: GenerationSystemInput) => ({
  model: input.model,
  requestInput: input.input,
  outputFormat: input.outputFormat || 'markdown',
  contentBuffer: '',
});

export const buildRegistryContext = (input: GenerationSystemInput) => ({
  registryVersion: input.registryVersion,
  registrySnapshotRef: input.registrySnapshotRef,
});

export const buildMetricsContext = (): MetricsContext => ({
  inputTokens: 0,
  outputTokens: 0, 
  costUsd: 0,
  _creditCost: 0,
});

export const buildInfrastructureContext = (adapters: GenerationAdapters) => ({
  adapters,
  runtimeNow: () => new Date(),
  artifactIdFactory: defaultArtifactIdFactory,
  responseBuilder: defaultResponseBuilder,
});
```

**Step 2.2: Context Assembly Update**
- Update `generation-system.definition.ts` context creation
- Replace direct field assignment with builder calls
- Maintain exact same context interface (zero behavioral changes)
- Preserve Aggregate Root role and existing XState setup

**Step 2.3: Consumer File Updates**
Systematic updates to all files importing `GenerationMachineContext`:
- `generation-system.actions.ts` (7 references)
- `generation-system.actors.ts` (14 references)
- `generation-system.guards.ts` (2 references)  
- All `*.states.ts` files (8+ references)
- Test files with mock contexts (6 files)

**Step 2.4: Test Mock Standardization**
- Update all test mocks to use context builders
- Ensure consistent mock patterns across test suite
- Validate all generation system tests pass

#### **Phase 2 Success Criteria**
- [ ] 5 domain-specific context builders implemented
- [ ] All consumer files updated to use builders
- [ ] Full generation system test suite passes
- [ ] Context cognitive complexity reduced (measurable via builder usage)
- [ ] Sprint 4B decomposition infrastructure prepared

---

## Sequential Validation Strategy

### **Phase 1 Complete → Phase 2 Start**
**Blocking Validation**:
- [ ] Route capabilities domain namespacing operational
- [ ] Type system validates without errors  
- [ ] Zero runtime regressions detected
- [ ] Sprint 4B routing infrastructure confirmed ready

### **Phase 2 Complete → Sprint 2 Complete**  
**Final Validation**:
- [ ] Context builders organized by domain concern
- [ ] All consumer code updated and tested
- [ ] Full backend test suite passes: `npm --workspace apps/backend run go`
- [ ] Build performance maintained (< 30s typecheck)

### **Sprint 2 Gate Validation**
**Unified Review Requirements**:
- [ ] **Capability Infrastructure**: Domain-specific namespacing operational ✅
- [ ] **Context Preparation**: Domain-specific context builders organized ✅  
- [ ] **Architecture Readiness**: Infrastructure prepared for core decomposition work ✅
- [ ] **Build Performance**: Typecheck baseline < 30s established ✅

---

## Agent AI Execution Plan

### **Phase 1 Agent Tasks**
1. **Analysis Agent**: Validate current route-table.ts structure and usage
2. **Design Agent**: Create domain namespace structure for Sprint 4B needs
3. **Implementation Agent**: Transform route capabilities with backward compatibility  
4. **Validation Agent**: Verify type correctness and Sprint 4B readiness

### **Phase 2 Agent Tasks**
1. **Context Analysis Agent**: Categorize all 25+ context fields by domain concern
2. **Builder Design Agent**: Create domain-specific context builders  
3. **Implementation Agent**: Update generation-system.definition.ts with builders
4. **Integration Agent**: Systematically update all consumer files
5. **Test Update Agent**: Standardize all mock contexts to use builders
6. **Validation Agent**: Verify functionality and Sprint 4B preparation

### **Quality Assurance Strategy**
- **Progressive Validation**: Each step validated before proceeding
- **Comprehensive Testing**: Full test suite at phase boundaries  
- **Behavioral Preservation**: Zero functional changes, only organizational
- **Sprint 4B Verification**: Explicit validation of dependency satisfaction

---

## Success Metrics & Outcomes

### **Quantifiable Targets**
- **Route Capabilities**: 6 domain namespaces implemented
- **Context Builders**: 5 domain-specific builders implemented  
- **Consumer Updates**: 7+ files systematically updated
- **Test Coverage**: All generation system tests passing
- **Build Performance**: Typecheck time < 30s maintained

### **Sprint 4B Critical Enablement**
- ✅ **Route Capabilities**: Domain-aware routing infrastructure operational
- ✅ **Context Complexity**: Cognitive load reduced for decomposition planning
- ✅ **Foundation Quality**: Clean organizational base for high-risk Sprint 4B work
- ✅ **Dependency Satisfaction**: Critical blocker for Sprint 4B removed

### **Business Value Delivered**
- **Infrastructure Maturity**: Domain-organized capabilities and contexts
- **Sprint 4B Readiness**: Critical dependency satisfied for core architectural work  
- **Maintainability**: Improved cognitive complexity through domain organization
- **Technical Debt Reduction**: Context organization enables future decomposition

---

## Integration & Risk Management

### **Integration Points**
- **Route Capabilities**: Pure type-level changes, zero runtime impact
- **Generation System**: Core pipeline updates with systematic validation
- **Test Suite**: Comprehensive coverage ensures regression prevention
- **Build System**: Performance monitoring ensures no degradation

### **Rollback Strategy**
- **Phase 1**: Simple type reversion (zero runtime impact)  
- **Phase 2**: Commit-level rollback to pre-builder state
- **Emergency**: Full Sprint 2 rollback capability maintained
- **Validation**: Progressive checkpoints enable precise rollback points

### **Quality Gates**
- **Code Review**: Systematic review of all generation system changes
- **Test Validation**: Full backend test suite must pass
- **Performance Check**: Build time monitoring and validation
- **Sprint 4B Readiness**: Explicit validation of dependency satisfaction

---

## Next Steps

### **Immediate Actions**
1. **Sprint 2 Execution**: Begin Phase 1 with route capabilities evolution
2. **Agent Coordination**: Deploy AI agents following sequential validation plan  
3. **Progress Tracking**: Update progress tracker as phases complete
4. **Sprint 4B Planning**: Prepare Sprint 4B plan based on Sprint 2 outcomes

### **Success Validation**  
- **Phase 1 Complete**: Route capabilities domain namespacing operational
- **Phase 2 Complete**: Context builders implemented and tested
- **Sprint 2 Complete**: All gates passed, Sprint 4B dependency satisfied
- **Sprint 4B Ready**: Infrastructure prepared for core context decomposition

**This plan is ready for immediate agent AI execution with systematic validation ensuring Sprint 4B critical dependency satisfaction.**