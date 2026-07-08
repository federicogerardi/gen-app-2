---
status: active  
version: 1.2-ddd-balanced
last-reviewed: 2026-07-08
next-review-date: 2026-07-15
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 1 Implementation Plan - Foundation & Quick Wins (DDD-Balanced)
type: implementation-plan
tags:
  - sprint-planning
  - architectural-vulnerabilities  
  - foundation-work
  - ddd-compliance
  - performance-optimization
goal: Balanced implementation plan maintaining DDD compliance with practical execution focus
---

# Sprint 1 Implementation Plan - Foundation & Quick Wins (DDD-Balanced)

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Sprint Duration**: 8-10 giorni lavorativi (1.5-2 settimane)  
**Team**: Senior Frontend Developer + Backend Tech Lead

**🎯 Balance**: Maintains essential DDD compliance while eliminating governance overhead for foundation work.

---

## Sprint Objective

**Goal**: Establish Frontend/UI as **downstream consumer** per BCM + deliver 3x performance improvement using canonical terminology.

**DDD Essentials**: 
- Frontend consumes domain events only (BCM Line 25)
- Backend owns orchestration authority (Integration Constraint 248)  
- Use canonical `Artifact` terminology (not "dependency")

---

## Tasks

### **TASK 1A: Artifact Resolution Performance** (V3 ⚡)
**What**: Convert sequential to parallel artifact fetching  
**DDD**: Use canonical `Artifact`, `artifactId` terminology  
**Timeline**: 2-3 giorni | **Risk**: Basso  

**Implementation**:
```typescript
// ✅ Canonical terminology + parallel execution
const artifactResolutionPromises = depEntries.map(async ([stepKey, artifactId]) => {
  const artifactDetail = await getArtifactById(artifactId, {...});
  return { stepKey, artifactId, artifactDetail };
});
const resolvedArtifacts = await Promise.allSettled(artifactResolutionPromises);
```

**Success**: < 300ms artifact resolution (from ~1s), all tests pass

### **TASK 1B: Infrastructure Organization** (A1 ⚠️)  
**What**: Organize adapters by operational scope (business/technical/integration)  
**DDD**: Infrastructure Layer sharing per DDD principles - fully compliant  
**Timeline**: 2-3 giorni | **Risk**: Basso | **Parallel with 1A**

**Success**: Operational scope organization, < 45s typecheck, backward compatibility

### **TASK 1C: Frontend Domain Realignment** (A4 🔥 CRITICAL)
**What**: Transform useToolPage from coordinator to downstream consumer  
**DDD**: Frontend consumes events only, no domain coordination  
**Timeline**: 3-4 giorni | **Risk**: Medio | **BLOCKS Sprint 4A**

**Simplified Architecture**:
```typescript
// ✅ DDD-compliant: 4 focused consumer hooks
const useToolPageConsumers = (toolKey: ToolKey) => {
  const streamState = useBackendStreamEvents();  // Generation domain
  const authState = useAuthSession();           // Auth domain  
  const quotaState = useQuotaDisplay();         // Usage domain
  const pageState = useToolPageUI();            // UI domain
  
  return { streamState, authState, quotaState, pageState };
};
```

**Success**: Frontend as pure downstream consumer, hook decomposition complete

---

## Sprint Sequence

**Days 1-2**: Analysis phase (all tasks)  
**Days 3-5**: Implementation (1A + 1B parallel, 1C start)  
**Days 6-8**: Integration & testing (1C completion, cross-task validation)  
**Days 9-10**: Sprint completion & Sprint 2 preparation  

---

## DDD Compliance

### **Required Decision Log Entry**
**Single entry for architectural change**:
```markdown
| DDD-XXX | 2026-07-08 | useToolPageDomainRealignment | Frontend hook decomposition per BCM Line 25 compliance | Transforms monolithic useToolPage into domain-specific consumers respecting bounded context boundaries | Frontend/UI |
```

### **Essential Compliance Points**
- ✅ **BCM Line 25**: Frontend as downstream consumer only  
- ✅ **Integration Constraint 248**: Backend orchestration authority preserved
- ✅ **Canonical Terminology**: `Artifact` entities, not "dependencies"  
- ✅ **Infrastructure Sharing**: Adapters shared across contexts per DDD principles

### **Governance Process**
- **Domain Architect spot-check**: Mid-sprint review for Task 1C  
- **DDD entry approval**: Single entry before Task 1C implementation
- **BCM validation**: Sprint-end compliance verification

---

## Success Gates

**Sprint 1 Complete When**:
- [ ] **Performance**: Artifact resolution < 300ms (3x improvement)
- [ ] **Infrastructure**: Operational organization + build performance < 45s  
- [ ] **DDD Compliance**: Frontend downstream consumer only, canonical terminology used
- [ ] **Sprint 4A Ready**: Clean domain boundaries enable reactive spaghetti resolution
- [ ] **Stability**: All existing functionality preserved, full test suite passes

---

## Risk Management

**Task 1A**: Low risk - isolated performance change, comprehensive testing  
**Task 1B**: Low risk - organizational change with backward compatibility  
**Task 1C**: Medium risk - architectural change with DDD oversight and incremental approach

**Rollback**: Individual task rollback capability, Sprint 4A dependency protection

---

## Implementation Notes

**Team Focus**: Foundation work with proportionate DDD governance  
**Quality Assurance**: Essential compliance checking without bureaucratic overhead  
**Success Criteria**: Measurable improvements + architectural foundation for Sprint 4A

**This balanced plan maintains complete DDD compliance while enabling practical execution of Sprint 1 foundation objectives.**

### **TASK 1A: Artifact Dependency Resolution Optimization** (V3 ⚡)
**DDD Status**: ✅ **COMPLIANT** (with terminology corrections)  
**Effort**: 3-4 giorni  
**Priority**: P2 ⚡ | **Parallel with 1B**

#### **DDD Corrections Applied**

**Terminology Alignment**:
- ❌ "Sequential Dependency Fetching" → ✅ **"Artifact Dependency Resolution Optimization"**
- ❌ "dependency fetching" → ✅ **"artifact resolution"** (canonical per Ubiquitous Language)
- ❌ "dependency content" → ✅ **"artifact content"** (canonical per `Artifact` entity)

**Canonical Domain Concept**: Uses `ToolStepOrchestration` (DDD-031, provisional) for dependency resolution authority.

#### **DDD-Compliant Implementation**

**Revised Technical Pattern**:
```typescript
// ✅ DDD-Compliant: Uses canonical terminology and respects domain boundaries
const artifactResolutionPromises = depEntries
  .filter(([, artifactId]) => {
    // Check local artifact cache (canonical: Artifact entity)
    const localArtifact = generationArtifacts.artifacts.find(a => a.artifactId === artifactId);
    return !(localArtifact && typeof localArtifact.content === 'string' && localArtifact.content.trim().length > 0);
  })
  .map(async ([stepKey, artifactId]) => {
    // Canonical: getArtifactById resolves Artifact entities
    const artifactDetail = await getArtifactById(artifactId, {
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      localArtifacts: generationArtifacts.artifacts,
    });
    return { stepKey, artifactId, artifactDetail };
  });

// Parallel artifact resolution (canonical domain operation)
const resolvedArtifacts = await Promise.allSettled(artifactResolutionPromises);
```

**Integration Constraint Compliance**:
- ✅ **Constraint 248**: Uses backend `orchestrateToolStep` for dependency resolution
- ✅ **BCM Line 25**: Frontend consumes artifact resolution results (downstream only)
- ✅ **Canonical Terms**: `Artifact`, `artifactId`, `GenerationArtifact` per Ubiquitous Language

---

### **TASK 1B: Infrastructure Layer Organization** (A1 ⚠️)
**DDD Status**: ✅ **FULLY COMPLIANT**  
**Effort**: 3-4 giorni  
**Priority**: A1 ⚠️ | **Parallel with 1A**

#### **DDD Compliance Confirmed**

**Infrastructure Layer Sharing**: ✅ **Approved** per DDD principles
> **BCM Note**: "Infrastructure adapters shared across contexts (DDD Infrastructure Layer principle)"

**No Domain Logic**: ✅ Infrastructure organization does not affect domain boundaries or logic

**Canonical Terms**: ✅ Uses existing adapter terminology without introducing new domain concepts

---

### **TASK 1C: Frontend Domain Boundary Realignment** (A4 🔥 CRITICAL)  
**DDD Status**: ❌ **MAJOR VIOLATIONS CORRECTED** → ✅ **DDD-COMPLIANT**  
**Effort**: 5-6 giorni + **2 giorni DDD governance**  
**Priority**: A4 🔥 CRITICAL | **BLOCKS Sprint 4A**

#### **CRITICAL DDD Violations Identified & Corrected**

**Original Violation - BCM Line 25**:
```typescript
// ❌ VIOLATES BCM: Frontend coordinating domain boundaries
const useToolRuntime = (toolKey: ToolKey) => {
  // Tools/Generation boundary coordination ❌ FORBIDDEN
};
```

**DDD-Compliant Solution - Pure Downstream Consumer**:
```typescript
// ✅ BCM COMPLIANT: Frontend as downstream consumer only
const useToolPageStateConsumer = (toolKey: ToolKey) => {
  // UI state management only - consumes domain events
  // NO domain logic, NO boundary coordination
};
```

#### **Required DDD Governance Actions** (BLOCKING)

**MANDATORY Decision Log Entries** (must complete BEFORE implementation):
```markdown
| DDD-XXX | 2026-07-08 | ToolPageStateConsumer | Frontend hook for UI state management per BCM downstream consumer pattern | Replaces monolithic useToolPage, ensures Frontend/UI boundary compliance | Frontend/UI |

| DDD-XXY | 2026-07-08 | BackendStreamEventConsumer | Frontend hook for consuming BackendStreamEvent per BCM Line 25 | Pure downstream consumer of Generation context events | Frontend/UI |

| DDD-XXZ | 2026-07-08 | AuthSessionStateConsumer | Frontend hook for session-aware routing per BCM Line 25 | Downstream consumer of Auth context, no auth logic | Frontend/UI |

| DDD-XXW | 2026-07-08 | QuotaDisplayConsumer | Frontend hook for quota state display per BCM Line 25 | Downstream consumer of Usage/Quota context, display only | Frontend/UI |
```

#### **DDD-Compliant Hook Architecture**

**Revised Domain Separation** (BCM Line 25 compliant):
```typescript
// ✅ DDD-COMPLIANT ARCHITECTURE

// 1. UI State Consumer (Frontend/UI domain only)
interface ToolPageStateConsumer {
  readonly pageState: ToolPageUIState;
  readonly formState: ToolFormState;
  readonly navigationState: NavigationState;
  // NO domain logic - UI concerns only
}

// 2. Backend Stream Event Consumer (consumes Generation context)  
interface BackendStreamEventConsumer {
  readonly streamEvents: BackendStreamEvent[];
  readonly streamState: StreamTransportState;
  readonly artifacts: GenerationArtifact[];
  // Consumes BackendStreamEvent per BCM Line 25 - NO generation logic
}

// 3. Auth Session Consumer (consumes Auth context)
interface AuthSessionStateConsumer {
  readonly sessionPrincipal: AuthSessionPrincipal;
  readonly authCapabilities: AuthCapabilities;
  readonly sessionRouting: SessionAwareRoutingState;
  // Drives session-aware routing per BCM Line 25 - NO auth logic
}

// 4. Quota Display Consumer (consumes Usage/Quota context)
interface QuotaDisplayConsumer {
  readonly quotaState: QuotaDisplayState;
  readonly usageMetrics: UsageDisplayMetrics;
  readonly quotaVisibility: QuotaUIVisibility;
  // Displays quota state per BCM Line 25 - NO usage logic
}

// 5. Composed Hook (pure consumer composition)
const useToolPage = (params) => {
  const pageState = useToolPageStateConsumer(params);
  const streamEvents = useBackendStreamEventConsumer();
  const authSession = useAuthSessionStateConsumer();
  const quotaDisplay = useQuotaDisplayConsumer();
  
  // ONLY composition - NO domain coordination
  return { pageState, streamEvents, authSession, quotaDisplay };
};
```

#### **Integration Constraint Compliance**

**Constraint 248 Compliance**:
> Step dependency resolution at dispatch time routes through `resolveStepDependencyIds` (BE) via `/api/tools/orchestrate` endpoint.

✅ **Solution**: Frontend hooks consume orchestration results, never coordinate boundaries.

**Constraint 232 Compliance**:
> Before dispatching step 1, `GenerationRequest.input` must carry both non-empty `briefingText` and structured `extractionPayload`.

✅ **Solution**: Frontend assembles request per constraint, backend owns validation.

---

## 🔄 **DDD-Compliant Sprint Sequencing**

### **Phase 0: DDD Governance (MANDATORY) - Days 1-2**

**BLOCKING Activities** (cannot proceed without completion):
- [ ] **Domain Architect Review**: Validate revised hook architecture for BCM compliance  
- [ ] **Decision Log Entries**: Create DDD-XXX through DDD-XXW entries (4 entries required)
- [ ] **Terminology Approval**: Confirm all canonical terms used throughout implementation
- [ ] **Integration Constraint Validation**: Verify no boundary coordination in frontend

### **Phase 1: Foundation (Parallel) - Days 3-5**

**Task 1A + 1B Parallel Execution**:
- **Day 3**: Task 1A baseline measurement + Task 1B adapter inventory  
- **Day 4**: Task 1A parallel implementation + Task 1B structure creation
- **Day 5**: Task 1A validation + Task 1B backward compatibility validation

### **Phase 2: Domain Boundary Compliance - Days 6-10** 

**Task 1C Sequential Implementation** (critical path):
- **Day 6-7**: Extract downstream consumer hooks (BCM compliant)  
- **Day 8**: Compose main hook (pure composition, no coordination)
- **Day 9**: Test migration for DDD-compliant architecture  
- **Day 10**: Sprint gates validation + DDD compliance certification

### **Buffer Phase: Risk Mitigation - Days 11-12**

**DDD Compliance Verification**:
- Domain Architect final review
- BCM boundary compliance testing
- Integration constraint validation
- Sprint 4A readiness confirmation

---

## ✅ **DDD-Compliant Success Gates**

### **Gate 0: DDD Governance** ✅ (BLOCKING)
- [ ] **Decision Log Complete**: All 4 DDD entries approved and published
- [ ] **Canonical Terminology**: Zero non-canonical terms in implementation
- [ ] **BCM Architecture Review**: Domain Architect approval of hook design  
- [ ] **Integration Constraints**: Zero frontend domain coordination patterns

### **Gate 1A: Artifact Resolution Performance** ✅
- [ ] **Performance**: Artifact resolution < 300ms (canonical terminology used)
- [ ] **DDD Compliance**: Uses `Artifact`, `artifactId`, `getArtifactById` canonical terms
- [ ] **BCM Compliance**: Frontend consumes resolution results (downstream only)
- [ ] **Test Coverage**: 100% coverage using canonical domain terminology

### **Gate 1B: Infrastructure Foundation** ✅  
- [ ] **Organization**: Business/Technical/Integration scope separation (DDD-compliant)
- [ ] **Compatibility**: ALL existing imports preserved (zero domain impact)
- [ ] **Performance**: Build improvement measurable and validated
- [ ] **Infrastructure Principle**: Shared adapters across contexts per DDD

### **Gate 1C: Frontend Domain Boundary Compliance** ✅ (CRITICAL)
- [ ] **BCM Line 25 Compliance**: Frontend operates as downstream consumer ONLY
- [ ] **No Domain Coordination**: Zero frontend boundary management or domain logic  
- [ ] **Canonical Hook Architecture**: 4 consumer hooks using approved DDD terminology
- [ ] **Integration Constraint 248**: Backend owns all step dependency resolution
- [ ] **Sprint 4A Readiness**: Clean downstream architecture enables reactive cleanup

### **Gate Overall: DDD Sprint Success** ✅
- [ ] **100% BCM Compliance**: Frontend/UI boundaries respected throughout
- [ ] **Canonical Terminology**: All terms aligned with Ubiquitous Language  
- [ ] **Decision Log Updated**: New domain concepts properly governed
- [ ] **No DDD Violations**: Zero domain boundary violations or coordination anti-patterns

---

## ⚠️ **DDD-Specific Risk Management**

### **DDD Compliance Risks**

**Risk 1: Terminology Drift During Implementation**  
- **Mitigation**: Daily terminology validation against Ubiquitous Language
- **Monitoring**: Domain Architect review at each milestone  
- **Rollback**: Immediate correction required for any non-canonical usage

**Risk 2: Boundary Coordination Creep**  
- **Mitigation**: BCM Line 25 compliance checklist at each code review
- **Monitoring**: No frontend domain logic allowed in any hook
- **Rollback**: Architecture violation requires immediate redesign

**Risk 3: Integration Constraint Violations**
- **Mitigation**: Backend orchestration authority never bypassed
- **Monitoring**: Constraint 248 validation in all step-related code  
- **Rollback**: Any frontend coordination must be moved to backend

### **Quality Gates - DDD Focus**

**Code Review Requirements**:
- **Domain Architect**: MANDATORY approval for Task 1C (BCM compliance critical)
- **Terminology Validator**: All canonical terms verified against glossary  
- **Integration Constraint Check**: Zero frontend domain coordination patterns

**DDD Testing Requirements**:
- **BCM Boundary Tests**: Verify frontend as downstream consumer only
- **Canonical Term Tests**: All domain concepts use approved terminology  
- **Integration Constraint Tests**: Backend orchestration authority respected
- **Decision Log Compliance Tests**: New terms properly governed

---

## 📊 **DDD-Enhanced Success Metrics**

### **DDD Compliance Metrics**

| Metric | Target | Validation Method |
|--------|--------|------------------|
| **BCM Boundary Compliance** | 100% | Frontend consumes events only, never coordinates |
| **Canonical Terminology Usage** | 100% | All terms match Ubiquitous Language glossary |
| **Decision Log Entries** | 4 approved | DDD-XXX through DDD-XXW published |
| **Integration Constraint Adherence** | 100% | Backend orchestration authority preserved |
| **Domain Logic in Frontend** | 0 instances | No business logic in consumer hooks |

### **Business Value - DDD Aligned**

**Architectural Compliance Value**:
- ✅ **Frontend/UI Boundary**: Pure downstream consumer per BCM
- ✅ **Domain Terminology**: 100% canonical term alignment  
- ✅ **Integration Rules**: All 54 constraints respected
- ✅ **Decision Governance**: New concepts properly managed

**Foundation Value** (enables DDD-compliant future sprints):
- ✅ **Sprint 4A Readiness**: Clean boundaries enable safe reactive pattern work
- ✅ **Architectural Debt Elimination**: BCM violations resolved  
- ✅ **Domain Governance**: Terminology and boundary management operational

---

## 🚀 **DDD-Compliant Implementation Readiness**

### **Pre-Sprint DDD Validation**

**Domain Architecture Readiness**:
- [ ] **Domain Architect**: Confirmed available for governance activities (2+ days)
- [ ] **BCM Training**: Frontend team trained on downstream consumer patterns
- [ ] **Decision Log Process**: Team understands mandatory terminology approval process
- [ ] **Integration Constraint Knowledge**: No frontend domain coordination understanding

**DDD Documentation Readiness**:
- [ ] **BCM Line 25**: Team understands Frontend/UI downstream role  
- [ ] **Integration Constraint 248**: Backend orchestration authority clear
- [ ] **Canonical Terms**: Ubiquitous Language glossary accessible and current
- [ ] **Decision Process**: DDD entry creation and approval workflow ready

### **Sprint Kick-off Protocol - DDD Enhanced**

**Day 1 Morning (Required)**:
1. **DDD Governance Review**: BCM boundaries and integration constraints
2. **Canonical Terminology Training**: Ubiquitous Language compliance requirements  
3. **Decision Log Workflow**: Process for approving new domain concepts
4. **BCM Compliance Validation**: Frontend downstream consumer role confirmation

**Daily DDD Standup Focus**:
- **Boundary Compliance**: Any domain coordination attempts identified and blocked
- **Terminology Validation**: Non-canonical terms flagged for immediate correction
- **Decision Log Status**: Progress on required DDD entries approval
- **Integration Constraint Adherence**: Backend orchestration authority respected

---

## 📋 **Final DDD Compliance Summary**

### **Critical Violations Resolved**

✅ **BCM Line 25 Compliance**: Frontend redesigned as pure downstream consumer  
✅ **Integration Constraint 248**: Backend orchestration authority preserved  
✅ **Canonical Terminology**: All non-canonical terms replaced with approved vocabulary  
✅ **Decision Log Governance**: 4 new DDD entries required and identified for approval  

### **DDD Risk Mitigation**

✅ **Domain Architect Involvement**: Mandatory governance throughout Sprint 1  
✅ **Terminology Validation**: Daily compliance checking against Ubiquitous Language  
✅ **Boundary Enforcement**: Zero frontend domain coordination permitted  
✅ **Integration Constraint Testing**: Backend authority validation at each milestone  

### **Sprint Success - DDD Lens**

This revised plan ensures **100% DDD compliance** while delivering:
- **Performance Improvement**: 3x artifact resolution optimization using canonical terms
- **Infrastructure Enhancement**: Organization improvement respecting DDD principles  
- **Architectural Foundation**: BCM-compliant frontend enables all future sprint work

**The plan is ready for DDD-compliant execution with Principal/Domain Architect oversight.**