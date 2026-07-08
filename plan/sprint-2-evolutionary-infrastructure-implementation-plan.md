---
status: active
version: 1.0
last-reviewed: 2026-07-08
next-review-date: 2026-07-22
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 2 Implementation Plan - Evolutionary Infrastructure
type: implementation-plan
tags:
  - sprint-planning
  - architectural-vulnerabilities
  - infrastructure-evolution
  - context-organization
  - sprint-4b-enablement
goal: Prepare infrastructure for Sprint 4B context decomposition through route capabilities evolution and generation system enhancement
---

# Sprint 2 Implementation Plan - Evolutionary Infrastructure

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
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