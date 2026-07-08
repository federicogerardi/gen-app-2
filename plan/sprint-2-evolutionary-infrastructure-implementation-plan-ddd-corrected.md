---
status: active
version: 1.1-ddd-corrected
last-reviewed: 2026-07-08
next-review-date: 2026-07-22
owner: Domain Architecture Team
date_created: 2026-07-08
title: Sprint 2 Implementation Plan - Evolutionary Infrastructure (DDD-Corrected)
type: implementation-plan
tags:
  - sprint-planning
  - architectural-vulnerabilities
  - infrastructure-evolution
  - context-organization
  - sprint-4b-enablement
  - ddd-compliance
goal: DDD-compliant preparation of infrastructure for Sprint 4B context decomposition through route capabilities evolution and generation system enhancement
---

# Sprint 2 Implementation Plan - Evolutionary Infrastructure (DDD-Corrected)

**Source**: [Unified Architectural Vulnerabilities Review](../docs/07-governance/unified-architectural-vulnerabilities-review.md)  
**Branch**: `feature/unified-architectural-vulnerabilities-resolution`  
**Prerequisites**: Sprint 1 completed (✅ Task 1A, ✅ Task 1C, ❌ Task 1B cancelled)  
**Execution**: Agent AI with sequential validation approach

**⚠️ DDD CORRECTIONS**: This version addresses critical DDD violations identified in v1.0 and ensures 100% compliance with:
- [Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md) - **Generation Context aggregate root role**
- [Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md) - **Canonical terminology only**
- [Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md) - **Required new DDD entries**

---

## Sprint Objective

**Primary Goal**: Enable Sprint 4B GenerationSystem Context Decomposition through DDD-compliant infrastructure preparation:
1. **HTTP Route Capability Organization** - Infrastructure Layer operational namespacing  
2. **Generation System Context Builders** - Internal organization respecting aggregate root role

**Critical Success**: Sprint 4B dependency satisfied while maintaining complete DDD compliance

---

## DDD Compliance Framework

### **Mandatory Decision Log Entries** (BLOCKING)
**Required BEFORE implementation**:
```markdown
| DDD-XXX | 2026-07-08 | HttpRouteCapabilityNamespacing | Infrastructure Layer route capability organization per operational groups | Enables systematic route capability management without affecting domain boundaries | Infrastructure Layer |

| DDD-XXY | 2026-07-08 | GenerationSystemContextBuilders | Generation Context internal organization through domain-specific builders | Reduces cognitive complexity while maintaining Generation aggregate root role and BCM compliance | Generation Context |
```

### **BCM Compliance Requirements**
- ✅ **Generation Context Ownership**: All `GenerationMachineContext` fields belong to Generation Context
- ✅ **Aggregate Root Role**: `GenerationSystem` maintains orchestrator role per BCM line 34
- ✅ **Integration vs Core**: Clear distinction between integration points and domain ownership
- ✅ **Infrastructure Layer**: Route capabilities remain infrastructure concerns, not domain boundaries

---

## Sequential Implementation Plan

### **PHASE 1: HTTP Route Capability Organization** (Task 2A - A3 📋)

#### **DDD-Corrected Scope**
- **File**: `apps/backend/src/lib/runtime/auth-http/route-table.ts:25-43`
- **Current**: 13 flat capability strings (`'auth.login' | 'admin.users' | ...`)
- **DDD Correction**: Infrastructure Layer operational organization (NOT domain boundaries)
- **Sprint 4B Need**: Systematic route management for infrastructure evolution

#### **DDD-Compliant Implementation**

**Step 1.1: Infrastructure Namespace Design**
```typescript
// ✅ DDD-COMPLIANT: Infrastructure Layer operational organization
export namespace HttpRouteCapabilities {
  // Infrastructure operational groups (NOT domain boundaries)
  export type AuthOperations = 'login' | 'logout' | 'session' | 'google.start';
  export type AdminOperations = 'users' | 'models' | 'api-services' | 'api-service-bindings';
  export type ToolsOperations = 'briefs' | 'hydrate' | 'orchestrate' | 'api-services' | 'sessions';
  export type ProjectOperations = 'projects';
  export type ArtifactOperations = 'artifacts'; 
  export type FeedbackOperations = 'public' | 'admin';
}

// Infrastructure Layer capability resolution
export type AuthHttpRouteCapability = 
  | `auth.${HttpRouteCapabilities.AuthOperations}`
  | `admin.${HttpRouteCapabilities.AdminOperations}`
  | `tools.${HttpRouteCapabilities.ToolsOperations}`
  | HttpRouteCapabilities.ProjectOperations
  | HttpRouteCapabilities.ArtifactOperations
  | `feedback.${HttpRouteCapabilities.FeedbackOperations}`;
```

**Step 1.2: Implementation**
- Transform `AuthHttpRouteCapability` to namespace structure
- Maintain Infrastructure Layer classification (NOT domain classification)
- Preserve all 13 current capability strings
- Update `AUTH_HTTP_ROUTE_CAPABILITIES` constant

**Step 1.3: DDD Validation**
- Verify Infrastructure Layer compliance (capabilities ≠ domain boundaries)
- Confirm zero domain logic impact
- Validate Sprint 4B infrastructure readiness

#### **Phase 1 Success Criteria**
- [ ] Infrastructure Layer route capability namespacing operational
- [ ] All 13 existing capabilities preserved with operational grouping
- [ ] Zero domain boundary confusion (capabilities ≠ domains)
- [ ] Sprint 4B infrastructure management prepared

---

### **PHASE 2: Generation System Context Organization** (Task 2B - A2 📋)

#### **DDD-Corrected Scope**
- **File**: `apps/backend/src/lib/machines/generation-system.definition.ts`
- **Context**: `GenerationMachineContext` with 25+ fields (ALL Generation Context owned)
- **BCM Compliance**: All fields belong to Generation Context per aggregate root role
- **Sprint 4B Need**: Internal organization respecting Generation Context boundaries

#### **DDD-Compliant Context Categorization**
**CORRECTED**: All fields belong to Generation Context with different organizational concerns:

**Generation Integration Context** (Generation Context, external integration points):
- `requestId`, `userId`, `projectId`, `sessionId` // Integration with Auth/Projects

**Generation Core Context** (Generation Context, core domain):
- `toolKey`, `workflowType`, `artifactType`, `mode`, `routeType`

**Generation Execution Context** (Generation Context, runtime execution):
- `model`, `requestInput`, `outputFormat`, `contentBuffer`

**Generation Registry Context** (Generation Context, configuration):
- `registryVersion`, `registrySnapshotRef`

**Generation Metrics Context** (Generation Context, analytics):
- `inputTokens`, `outputTokens`, `costUsd`, `_creditCost`

**Generation Infrastructure Context** (Generation Context, system):
- `adapters`, `runtimeNow`, `artifactIdFactory`, `responseBuilder`

#### **DDD-Compliant Implementation**

**Step 2.1: Generation Context Builder Design**
```typescript
// ✅ DDD-COMPLIANT: All builders serve Generation Context aggregate root
export const buildGenerationIntegrationContext = (input: GenerationSystemInput) => ({
  requestId: input.requestId,
  userId: input.userId,  
  projectId: input.projectId,
  sessionId: input.sessionId,
});

export const buildGenerationCoreContext = (input: GenerationSystemInput) => ({
  toolKey: input.toolKey,
  workflowType: input.workflowType,
  artifactType: input.artifactType,
  mode: resolveWorkflowRunMode(input.intent),
  routeType: input.routeType,
});

export const buildGenerationExecutionContext = (input: GenerationSystemInput) => ({
  model: input.model,
  requestInput: input.input,
  outputFormat: input.outputFormat || 'markdown',
  contentBuffer: '',
});

export const buildGenerationRegistryContext = (input: GenerationSystemInput) => ({
  registryVersion: input.registryVersion,
  registrySnapshotRef: input.registrySnapshotRef,
});

export const buildGenerationMetricsContext = (): GenerationMetricsContext => ({
  inputTokens: 0,
  outputTokens: 0, 
  costUsd: 0,
  _creditCost: 0,
});

export const buildGenerationInfrastructureContext = (adapters: GenerationAdapters) => ({
  adapters,
  runtimeNow: () => new Date(),
  artifactIdFactory: defaultArtifactIdFactory,
  responseBuilder: defaultResponseBuilder,
});
```

**Step 2.2: Context Assembly Update**
- Update `generation-system.definition.ts` context creation
- Use builders for internal organization (maintain aggregate root role)
- Preserve exact same Generation Context interface
- Maintain `GenerationSystem` as canonical aggregate root per BCM

**Step 2.3: Consumer File Updates**
Systematic updates respecting Generation Context ownership:
- `generation-system.actions.ts` - use builders for context access
- `generation-system.actors.ts` - maintain Generation Context authority
- `generation-system.guards.ts` - preserve aggregate root decision authority
- All `*.states.ts` files - respect Generation Context boundaries
- Test files - use builders for consistent mock patterns

#### **Phase 2 Success Criteria**
- [ ] 6 Generation Context builders implemented (NOT cross-domain)
- [ ] All builders serve Generation aggregate root role
- [ ] BCM compliance maintained (Generation Context ownership)
- [ ] Cognitive complexity reduced through internal organization
- [ ] Sprint 4B decomposition infrastructure prepared

---

## DDD Validation Strategy

### **BCM Compliance Checkpoints**
- **Generation Context Authority**: All context fields remain Generation owned
- **Aggregate Root Role**: `GenerationSystem` maintains orchestrator role
- **Integration Distinction**: Clear separation of integration points vs domain logic
- **Infrastructure Layer**: Route capabilities remain infrastructure concerns

### **Terminology Validation**
- **Canonical Terms**: All terms aligned with Ubiquitous Language Glossary
- **Decision Log**: Required entries created before implementation
- **No Domain Confusion**: Clear distinction between capabilities and domain boundaries
- **BCM Alignment**: Generation Context terminology throughout

### **Integration Constraint Preservation**
- **Constraint 248**: `ToolStepOrchestration` pattern preserved
- **Generation Authority**: Backend orchestration authority maintained
- **Context Integrity**: No cross-context leakage introduced
- **Infrastructure Separation**: Route capabilities ≠ domain logic

---

## Success Metrics & Sprint 4B Enablement

### **DDD Compliance Metrics**
- **BCM Adherence**: 100% Generation Context ownership maintained
- **Terminology Alignment**: All canonical terms from Ubiquitous Language used
- **Decision Log Compliance**: 2 required DDD entries approved
- **Infrastructure Classification**: Route capabilities properly categorized

### **Sprint 4B Critical Enablement**
- ✅ **Infrastructure Organization**: Systematic route management operational
- ✅ **Context Preparation**: Generation Context builders ready for decomposition
- ✅ **Cognitive Load**: Internal complexity reduced while respecting BCM
- ✅ **Foundation Quality**: DDD-compliant base for Sprint 4B architectural work

### **Technical Success Criteria**
- **HTTP Route Capabilities**: Infrastructure Layer operational namespacing
- **Generation Builders**: 6 context builders organized by internal concern
- **BCM Preservation**: Generation aggregate root role maintained
- **Sprint 4B Ready**: Infrastructure prepared for context decomposition

---

## Agent AI Execution Plan

### **Phase 1 DDD-Compliant Agent Tasks**
1. **Infrastructure Analysis Agent**: Validate route capabilities as Infrastructure Layer
2. **Namespace Design Agent**: Create operational groupings (NOT domain boundaries)
3. **Implementation Agent**: Transform capabilities respecting Infrastructure Layer
4. **DDD Validation Agent**: Verify Infrastructure vs Domain distinction

### **Phase 2 DDD-Compliant Agent Tasks**
1. **Generation Context Analysis Agent**: Categorize fields respecting BCM ownership
2. **Builder Design Agent**: Create Generation Context internal builders
3. **Implementation Agent**: Update generation system respecting aggregate root
4. **Integration Agent**: Update consumers maintaining Generation Context authority
5. **Test Update Agent**: Use builders respecting Generation Context boundaries
6. **BCM Validation Agent**: Verify aggregate root role preservation

### **DDD Quality Assurance**
- **BCM Compliance**: Continuous validation of Generation Context ownership
- **Terminology Validation**: All terms checked against Ubiquitous Language
- **Decision Log**: Required entries approved before implementation
- **Infrastructure Distinction**: Route capabilities remain infrastructure concerns

---

## Risk Management & DDD Governance

### **DDD-Specific Risks**
- **Risk 1**: Context field categorization violates BCM ownership → **Mitigation**: All fields remain Generation Context owned
- **Risk 2**: Route capabilities confused with domain boundaries → **Mitigation**: Clear Infrastructure Layer classification
- **Risk 3**: Aggregate root role compromised → **Mitigation**: Generation System authority preserved

### **Governance Protocol**
- **Domain Architect Review**: Mandatory for BCM compliance validation
- **Decision Log Approval**: Required entries approved before implementation start
- **Terminology Validation**: Daily checking against canonical terms
- **BCM Monitoring**: Continuous validation of Generation Context authority

---

## Integration & Next Steps

### **Sprint 4B Dependency Satisfaction**
- **Route Capabilities**: Infrastructure management enables systematic evolution
- **Context Builders**: Internal organization reduces cognitive load for decomposition
- **BCM Compliance**: Clean Generation Context foundation for Sprint 4B work
- **DDD Foundation**: Compliant base enables safe architectural changes

### **Quality Assurance**
- **DDD Validation**: Complete compliance with BCM, Ubiquitous Language, Decision Log
- **Technical Validation**: Full backend test suite validation
- **Sprint 4B Readiness**: Infrastructure prepared for context decomposition
- **Integration Preservation**: All Integration Constraints respected

**This DDD-corrected plan maintains complete compliance while enabling Sprint 4B critical dependency satisfaction through proper Infrastructure Layer and Generation Context organization.**