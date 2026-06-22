---
goal: Refactor 3 XState machines from string-based context errors to explicit error states for UX determinism
version: 1.0
date_created: 2026-06-23
last_updated: 2026-06-23
last-reviewed: 2026-06-23
next-review-date: 2026-07-23
owner: Frontend Platform Team
status: draft
tags: [plan, refactor, xstate, frontend, error-handling, ux-determinism]
---

# XState Explicit Error States Refactoring Plan

## Introduction

This plan addresses **Finding A1** from the frontend-ux-determinism-code-review: converting 3 XState machines from `error: string | null` context patterns to explicit error states for UX behavior determinism.

**Problem**: Current machines hide sub-states inside context flags (e.g., `idle` + `context.error !== null` = "idle with error"), making UX behavior non-deterministic from state alone.

**Solution**: Introduce explicit error states (`idle.failed`, `unauthenticated.error`) or orthogonal regions, making error transitions traceable machine events rather than context derivations.

---

## 0. Target Architecture and Success Metrics

### **Technical Goals**
- ✅ Zero `error: string | null` fields in context across 3 machines
- ✅ States completely deterministic via `state.matches()` vs `context.error !== null` checks
- ✅ Reactive ViewModel pattern eliminating dual-write anti-patterns
- ✅ Test coverage >90% for error scenarios and recovery paths

### **Developer Experience Metrics**

**Baseline (Current State)**:
- **Debugging complexity**: 3 machines hide error sub-states → requires context inspection + state combination logic
- **New developer onboarding**: Error handling patterns inconsistent across codebase (some explicit, some context-based)
- **Error scenario testing**: Limited coverage due to complex state+context combinations
- **State reasoning**: Non-deterministic → same state (`idle`) can mean "clean" or "with error"

**Target (Post-Refactoring)**:
- **Debugging simplicity**: Error states visible in XState DevTools, single `state.matches()` check
- **Pattern consistency**: All machines follow explicit error state pattern (aligned with `feedback-center`, `frontend-stream`)
- **Test coverage**: >90% for error scenarios with clear state-based assertions
- **State reasoning**: Deterministic → `state.value` alone indicates exact error condition

**Measurable DX Improvements**:
1. **Debugging time reduction**: From multi-step (check state + check context + derive meaning) to single-step (`state.matches()`)
2. **Test clarity**: Error test assertions change from `expect(snapshot.context.error).toBe('message')` to `expect(snapshot.matches('failed'))`
3. **Cognitive load**: New developers can reason about error flows using standard XState patterns
4. **Maintenance velocity**: Error handling changes require only state transitions, not context+viewModel dual updates

---

## 1. Scope and Constraints

### **In Scope**
- **3 Target Machines**: `auth-session.machine.ts`, `briefing-upload.machine.ts`, `tool-page.machine.ts`
- **Pattern Migration**: Context-based error flags → explicit error states
- **ViewModel Refactoring**: Dual-write actions → reactive selectors (tool-page only)
- **Consumer Updates**: All files reading `context.*Error` fields
- **Test Enhancement**: Comprehensive error scenario coverage

### **Out of Scope**  
- **New feature development** during refactoring periods
- **Performance optimizations** unrelated to state management
- **UI/UX changes** beyond error state determinism
- **Other machines** already using explicit error patterns

### **Constraints**
- **Breaking Change Approach**: No backward compatibility, direct migration
- **Incremental Timeline**: 5 sprints, risk-based prioritization
- **Zero Regression Policy**: Existing user flows must remain unchanged
- **DDD Compliance**: All changes must align with canonical domain terms

---

## 2. Sprint-Based Implementation Plan

### **Sprint 1: auth-session.machine.ts (Risk: LOW)**

**Target**: 206-line machine, 2 consumers, isolated dependencies

**Pattern**: Child states under `unauthenticated`
```typescript
// BEFORE:
states: {
  unauthenticated: { /* context.error hides sub-state */ }
}

// AFTER:  
states: {
  unauthenticated: {
    initial: 'idle',
    states: {
      idle: {},
      failed: {
        on: {
          LOGIN: '#authenticating',
          CLEAR_ERROR: 'idle'
        }
      }
    }
  }
}
```

**Sprint 1 Tasks**:
- [x] **S1-001**: Audit current `auth-session.machine.ts` states, context, and transitions
- [x] **S1-002**: Remove `error: string | null` from context type definition
- [x] **S1-003**: Implement child states `unauthenticated.idle` and `unauthenticated.failed`
- [x] **S1-004**: Update login/bootstrap failure transitions to target `unauthenticated.failed`
- [x] **S1-005**: Update `AuthSessionProvider.tsx` to read `state.matches('unauthenticated.failed')`
- [x] **S1-006**: Rewrite `auth-session.machine.test.ts` for explicit error states
- [x] **S1-007**: Add error recovery scenarios (retry login, clear error)
- [x] **S1-008**: Full regression testing for auth flows

**Sprint 1 QA Scenarios**:

| Step | Command | Expected Result |
|------|---------|-----------------|
| After S1-002 | `npm --workspace apps/frontend run typecheck` | Exit 0 — no references to removed `error` context field |
| After S1-003 | `npm --workspace apps/frontend run typecheck` | Exit 0 — `unauthenticated.idle` and `unauthenticated.failed` type-safe |
| After S1-005 | `rg "context\.error" apps/frontend/src/app/machines/auth-session.machine.ts apps/frontend/src/app/providers/AuthSessionProvider.tsx` | Zero matches |
| After S1-006–S1-007 | `npm --workspace apps/frontend run test -- src/app/machines/auth-session.machine.test.ts` | All tests pass; new test names include `unauthenticated.failed` and recovery |
| Sprint completion | `npm --workspace apps/frontend run typecheck && npm --workspace apps/frontend run test` | Exit 0, zero regressions |

**Sprint 1 Success Criteria**:
- ✅ `auth-session.machine.ts` has zero context error fields
- ✅ `AuthSessionProvider` uses explicit state checks only
- ✅ All auth flows (login/logout/refresh) pass regression tests  
- ✅ Error recovery scenarios have >90% test coverage

---

### **Sprint 2: briefing-upload.machine.ts (Risk: MEDIUM)**

**Target**: Child machine of `tool-page`, with parent-child communication

**Pattern**: Orthogonal regions for operation + error state
```typescript
// BEFORE:
idle -> validating -> uploading -> extracting -> ready
    ↑_____________ (error) _______________↑

// AFTER:
type: 'parallel',
states: {
  operation: {
    initial: 'idle', 
    states: { idle, validating, uploading, extracting, ready }
  },
  errorState: {
    initial: 'clean',
    states: { 
      clean: {},
      failed: {
        on: { RETRY: 'clean', RESET: 'clean' }
      }
    }
  }
}
```

**Sprint 2 Tasks**:
- [x] **S2-001**: Analyze parent-child coupling via `hasReadyBriefingExtractionContext`
- [x] **S2-002**: Convert `idle` to compound state with `clean` and `failed` child states
- [x] **S2-003**: Remove `error` string field from context
- [x] **S2-004**: Update operation states (idle→ready) to preserve current flow
- [x] **S2-005**: Implement error recovery via `RETRY` event (= SELECT_FILE in `idle.failed`)
- [x] **S2-006**: Verify `hasReadyBriefingExtractionContext` still matches on `'ready'`
- [x] **S2-007**: Update `tool-page-context.ts` and selectors to derive errors from explicit states
- [x] **S2-008**: Rewrite `briefing-upload.machine.test.ts` (~237 lines) for explicit states
- [x] **S2-009**: Add upload/extraction failure + retry scenarios (16 tests total)
- [x] **S2-010**: Update `useToolPage.test.ts` mocks and consumers for `idle.failed`

**Sprint 2 QA Scenarios**:

| Step | Command | Expected Result |
|------|---------|-----------------|
| After S2-002 | `npm --workspace apps/frontend run typecheck` | Exit 0 — parallel type structure compiles |
| After S2-003 | `rg "error:\s*string" apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` | Zero matches |
| After S2-006 | `npm --workspace apps/frontend run typecheck` | Exit 0 — `hasReadyBriefingExtractionContext` reads `state.matches('operation.ready')` without type errors |
| After S2-008–S2-009 | `npm --workspace apps/frontend run test -- src/features/tools/machines/briefing-upload.machine.test.ts` | All tests pass; test suite covers `errorState.failed` and retry transitions |
| After S2-010 | `npm --workspace apps/frontend run test -- src/features/tools/machines/` | All machine tests pass including parent-child integration |
| Sprint completion | `npm --workspace apps/frontend run typecheck && npm --workspace apps/frontend run test` | Exit 0, zero regressions |

**Sprint 2 Success Criteria**:
- ✅ `briefing-upload.machine.ts` uses orthogonal regions successfully
- ✅ Parent-child communication works with new state structure
- ✅ File upload/extraction errors are explicitly modeled
- ✅ Error recovery (retry/reset) scenarios fully tested

---

### **Sprint 3: tool-page.machine.ts - Reactive ViewModel (Risk: HIGH)**  

**Target**: 395-line aggregate root, 15+ consumers, dual-write elimination

**Pattern**: Pure reactive ViewModel selectors
```typescript
// BEFORE: Dual-write actions
actions: {
  updateNonStreamingProgress: assign({
    // Updates context fields AND rebuilds viewModel 
    currentStepStatus: 'completed',
    viewModel: buildViewModelFromContext(...)
  })
}

// AFTER: Reactive derivation
const toolPageViewModelSelector = (state, context) => {
  // Pure function deriving viewModel from state + context
  return buildViewModelFromState(state, context);
}
```

**Sprint 3 Tasks**:
- [ ] **S3-001**: Audit all `viewModel` dual-write locations in actions
- [ ] **S3-002**: Map `tool-page-view-model.ts` context dependencies 
- [ ] **S3-003**: Identify all 15+ consumer files reading viewModel
- [ ] **S3-004**: Design `buildViewModelFromState(state, context)` pure selector
- [ ] **S3-005**: Implement reactive viewModel without dual-write
- [ ] **S3-006**: Remove viewModel updates from all actions (`updateNonStreamingProgress`, etc.)
- [ ] **S3-007**: Update `tool-page-selectors.ts` to use reactive pattern
- [ ] **S3-008**: Test A/B parity between old/new viewModel builders
- [ ] **S3-009**: Update all consumer files to use reactive selectors
- [ ] **S3-010**: Performance benchmarking for reactive derivation

**Sprint 3 QA Scenarios**:

| Step | Command | Expected Result |
|------|---------|-----------------|
| After S3-005–S3-006 | `rg "viewModel:" apps/frontend/src/features/tools/machines/tool-page.machine.ts` | Zero matches — no assign with `viewModel:` key in actions |
| After S3-006 | `npm --workspace apps/frontend run typecheck` | Exit 0 — reactive selector signature type-safe |
| After S3-009 | `npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts` | All tests pass with reactive viewModel |
| After S3-010 | `npm --workspace apps/frontend run test` | All 437+ frontend tests pass, no regressions |
| Sprint completion | `npm --workspace apps/frontend run typecheck && npm --workspace apps/frontend run test && npm --workspace apps/frontend run build` | Exit 0 on all three |

**Sprint 3 Success Criteria**:
- ✅ Zero dual-write actions in `tool-page.machine.ts`
- ✅ ViewModel derived reactively from state + context only
- ✅ All 15+ consumers work with reactive pattern
- ✅ Performance parity or improvement vs dual-write approach

---

### **Sprint 4: tool-page.machine.ts - Explicit Error States (Risk: HIGH)**

**Target**: Context error fields → child states for generation/hydration errors

**Pattern**: Child states for error conditions
```typescript
// BEFORE:
states: {
  configuring: { /* context.generationError hides sub-state */ }
}

// AFTER:
states: {
  configuring: {
    initial: 'clean',
    states: {
      clean: {},
      hydrationFailed: { 
        on: { RETRY: 'clean', RESET: 'clean' }
      },
      generationFailed: {
        on: { RETRY: 'clean', CONTINUE: '#completed' }
      }
    }
  }
}
```

**Sprint 4 Tasks**:
- [ ] **S4-001**: Remove `generationError` and `hydrationError` from context
- [ ] **S4-002**: Design child states under `configuring` for error conditions
- [ ] **S4-003**: Update hydration failure transitions to `configuring.hydrationFailed`
- [ ] **S4-004**: Update generation failure transitions to `configuring.generationFailed`  
- [ ] **S4-005**: Add `onError` handler to `generationLifecycleMachine` invoke
- [ ] **S4-006**: Update reactive viewModel to derive errors from explicit states
- [ ] **S4-007**: Update all 15+ consumer files reading `context.*Error`
- [ ] **S4-008**: Rewrite `tool-page.machine.test.ts` (~1585 lines) for explicit states
- [ ] **S4-009**: Add comprehensive error recovery scenarios
- [ ] **S4-010**: Full integration testing with child machines

**Sprint 4 QA Scenarios**:

| Step | Command | Expected Result |
|------|---------|-----------------|
| After S4-001 | `rg "generationError\|hydrationError" apps/frontend/src/features/tools/machines/tool-page.machine.ts` | Zero matches in machine file |
| After S4-001 | `npm --workspace apps/frontend run typecheck` | Exit 0 — context type no longer includes error fields |
| After S4-007 | `rg "context\.(generationError\|hydrationError)" apps/frontend/src --type ts` | Zero matches across all files |
| After S4-007 | `npm --workspace apps/frontend run typecheck` | Exit 0 — all 15+ consumers updated |
| After S4-008–S4-009 | `npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts` | All tests pass; test names include `configuring.hydrationFailed`, `configuring.generationFailed`, recovery transitions |
| After S4-010 | `npm --workspace apps/frontend run test -- src/features/tools/machines/` | All machine tests pass including child integration |
| Sprint completion | `npm --workspace apps/frontend run typecheck && npm --workspace apps/frontend run test && npm --workspace apps/frontend run build` | Exit 0 on all three |

**Sprint 4 Success Criteria**:
- ✅ `tool-page.machine.ts` has zero context error fields
- ✅ All error conditions modeled as explicit states
- ✅ 15+ consumer files use state-based error detection
- ✅ Comprehensive test coverage for error/recovery scenarios

---

### **Sprint 5: Integration and Polish**

**Target**: End-to-end validation, documentation, pattern standardization

**Sprint 5 Tasks**:
- [ ] **S5-001**: Cross-machine integration testing (auth + briefing + tool-page)
- [ ] **S5-002**: Complex error scenarios (simultaneous auth/briefing/generation errors)
- [ ] **S5-003**: Performance benchmarking of full refactored architecture
- [ ] **S5-004**: User acceptance testing for critical error flows
- [ ] **S5-005**: Update `frontend-ux-determinism-code-review.md` → Finding A1 RESOLVED
- [ ] **S5-006**: Create ADR for "Explicit Error States Pattern" as standard
- [ ] **S5-007**: Documentation for new error state conventions
- [ ] **S5-008**: Knowledge transfer to team on new patterns
- [ ] **S5-009**: Code review guidelines for future machine error handling
- [ ] **S5-010**: Final regression sweep across all frontend flows

**Sprint 5 QA Scenarios**:

| Step | Command | Expected Result |
|------|---------|-----------------|
| After S5-001–S5-002 | `npm --workspace apps/frontend run test -- src/features/tools/machines/ src/app/machines/` | All machine tests pass |
| After S5-004 | Manual walkthrough: trigger login error → verify UI shows error state; upload failure → verify retry CTA visible; generation failure → verify recovery options | Expected states rendered deterministically without context inspection |
| After S5-005 | `grep "A1" docs/07-governance/frontend-ux-determinism-code-review.md` | Finding A1 status shows RESOLVED |
| Final gate | `rg "error:\s*string\s*\|\s*null" apps/frontend/src/features/tools/machines/ apps/frontend/src/app/machines/` | Zero matches across all 3 target machines |
| Final gate | `npm run typecheck && npm run test && npm run build` | Exit 0 — full repo clean |

**Sprint 5 Success Criteria**:
- ✅ All 3 machines follow consistent explicit error state patterns
- ✅ Zero regressions in user-facing error flows
- ✅ Developer documentation complete for new patterns
- ✅ Performance meets or exceeds baseline benchmarks

---

## 3. Risk Mitigation and Controls

### **Sprint 1-2 Risks (Low-Medium)**
- **Risk**: Auth/briefing flow regressions
- **Control**: Comprehensive regression test suite, rollback plan prepared
- **Mitigation**: Isolated machine changes, limited consumer surface

### **Sprint 3-4 Risks (High)**
- **Risk**: Breaking changes across 15+ consumer files
- **Control**: Phased implementation, feature flags, parallel development branch
- **Risk**: Performance degradation from reactive viewModel  
- **Control**: Continuous benchmarking, performance profiling, optimization gates
- **Risk**: Cascade failure in `tool-page` aggregate root
- **Control**: Incremental testing, state machine visualization, XState DevTools validation

### **Cross-Sprint Risks**
- **Risk**: Pattern inconsistency between machines
- **Control**: ADR documentation, strict code reviews, pattern validation
- **Risk**: Timeline overrun due to complexity
- **Control**: Sprint buffer time, scope adjustment protocols, stakeholder communication

---

## 4. Validation Gates and Acceptance Criteria

### **Technical Validation**
- [ ] **GATE-001**: Zero `error: string | null` in any machine context
- [ ] **GATE-002**: All error conditions accessible via `state.matches()` 
- [ ] **GATE-003**: Reactive viewModel performs within 5% of baseline
- [ ] **GATE-004**: Test coverage >90% for all error scenarios
- [ ] **GATE-005**: Zero regressions in critical user flows

### **Developer Experience Validation**
- [ ] **DX-001**: Error debugging requires single `state.matches()` check
- [ ] **DX-002**: New error scenarios require only state additions, not context logic
- [ ] **DX-003**: XState DevTools clearly show error states without context inspection
- [ ] **DX-004**: Test assertions use state-based checks exclusively
- [ ] **DX-005**: Pattern documentation enables consistent future development

### **Integration Validation**
- [ ] **INT-001**: All 3 machines use consistent explicit error patterns
- [ ] **INT-002**: Parent-child machine communication works with new states
- [ ] **INT-003**: No cross-machine error handling coupling remains
- [ ] **INT-004**: Error recovery flows are deterministic and testable

---

## 5. Implementation Checklist Template

### **Per-Sprint Execution**
```bash
# Pre-sprint validation (run from repo root)
npm run typecheck --workspaces --if-present

# Sprint 1 — auth-session
npm --workspace apps/frontend run test -- src/app/machines/auth-session.machine.test.ts

# Sprint 2 — briefing-upload
npm --workspace apps/frontend run test -- src/features/tools/machines/briefing-upload.machine.test.ts

# Sprint 3–4 — tool-page
npm --workspace apps/frontend run test -- src/features/tools/machines/tool-page.machine.test.ts

# Sprint completion gate (all sprints)
npm run typecheck && npm run test && npm run build
```

### **Success Validation Commands**
```bash
# Validate zero context errors
rg "error:\s*string\s*\|\s*null" apps/frontend/src/features/*/machines/

# Validate explicit state usage
rg "state\.matches\(" apps/frontend/src --type ts -A 2 -B 2

# Validate test coverage
npm --workspace apps/frontend run test:coverage -- src/features/*/machines/
```

---

## 6. References and Dependencies

### **Source Documentation**
- `docs/07-governance/frontend-ux-determinism-code-review.md` (Finding A1)
- `apps/frontend/src/app/machines/auth-session.machine.ts` (Sprint 1 target)
- `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` (Sprint 2 target)
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` (Sprint 3–4 target)
- `apps/frontend/src/features/tools/machines/tool-page-view-model.ts` (Sprint 3–4 ViewModel refactoring)

### **Pattern Examples**  
- `feedback-center.machine.ts` (Explicit error states template)
- `frontend-stream.machine.ts` (Structured error context template)
- `generation-lifecycle.machine.ts` (Good error handling reference)

### **Testing Infrastructure**
- `tool-page.machine.test.ts` (~1585 lines, requires major rewrite)
- `briefing-upload.machine.test.ts` (Parallel state testing)
- `auth-session.machine.test.ts` (Child state testing)

---

## 7. Timeline and Resource Requirements

### **Duration**: 5 sprints (~10-12 weeks)
### **Team**: Frontend Platform Team (primary), with coordination reviews
### **Dependencies**: None (isolated refactoring work)

### **Sprint Allocation**:
- **Sprint 1**: Auth session (1 sprint, low risk)
- **Sprint 2**: Briefing upload (1 sprint, medium risk)  
- **Sprint 3-4**: Tool page (2 sprints, high complexity)
- **Sprint 5**: Integration and polish (1 sprint, validation)

### **Success Commitment**:
This plan delivers **measurably improved developer experience** through:
1. **Simplified debugging**: Single-check error detection vs multi-step inference
2. **Consistent patterns**: All machines follow explicit error state conventions  
3. **Better testability**: >90% coverage for error scenarios with clear assertions
4. **Maintainable architecture**: Reactive viewModels eliminate dual-write bugs

The investment of 5 sprints results in **long-term development velocity gains** and **reduced cognitive load** for all future frontend state management work.