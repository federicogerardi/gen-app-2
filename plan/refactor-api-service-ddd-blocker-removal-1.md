---
goal: Remove SERP API integration blockers and DDD violations from ApiService infrastructure
version: 1.0
date_created: 2026-06-14
last_updated: 2026-06-15
owner: Backend Platform
status: Completed
tags: [refactor, architecture, backend, ddd, api-service, blocker-removal, serp-integration]
---

# Refactor: API Service DDD Blocker Removal Plan

![Status: Draft](https://img.shields.io/badge/status-Draft-yellow)

This plan defines the systematic removal of 3 critical backend blockers preventing DDD-compliant SERP API integration. All blockers must be resolved before the SERP API proposal can be implemented without semantic violations.

## 1. Requirements & Constraints

- REQ-001: Remove all 3 blockers identified in `docs/02-design/serp-api-integration-proposal.md` sections BLOCKER-001, BLOCKER-002, BLOCKER-003.
- REQ-002: Maintain backward compatibility for all existing ApiService operations and bindings.
- REQ-003: Ensure full DDD compliance: all changes must use canonical domain terms without semantic drift.
- REQ-004: Complete atomic migrations for type system extensions and DB schema changes.
- REQ-005: Preserve existing security constraints: no token leakage, maintain access control boundaries.
- CON-001: Backend-only scope. No frontend changes required or included.
- CON-002: Zero breaking changes to existing API contracts or runtime behavior.
- CON-003: All new domain terms require DDD decision-log entries before implementation.
- SEC-001: Token security patterns remain unchanged (no plaintext exposure).
- DDD-001: Use canonical `WorkflowStepType` values: `'acquisition' | 'crawling'` (DDD-116).

## 2. Blocker Analysis & Resolution

### BLOCKER-001: `accessMode: 'query-param'` not supported

**Current State**: `ApiServiceAccessMode` only supports `'public' | 'token'`. SerpAPI requires `?api_key=YOUR_KEY` format.

**Root Cause**: Missing type definition, DB column, and adapter logic for query-param authentication.

**Resolution**: Extend type system and adapter to support query-param auth mode.

### BLOCKER-002: `workflowStepType` binding only supports `'acquisition'`

**Current State**: `UpsertApiServiceBindingInput.workflowStepType` constraint prevents `'crawling'` value.

**Root Cause**: Hardcoded type constraint and potential DB CHECK constraint limiting step types.

**Resolution**: Extend type system to support both `'acquisition'` and `'crawling'` step types.

### BLOCKER-003: Semantic naming violation in resolver function

**Current State**: `resolveApiServiceForAcquisition` function name implies acquisition-only usage but works for any step.

**Root Cause**: Function naming does not reflect actual behavior and creates DDD semantic confusion.

**Resolution**: Add semantically correct alias or rename with compatibility layer.

## 3. Implementation Steps

### Implementation Phase 0 - DDD Governance Preparation

**GOAL-000**: Satisfy DDD governance requirements before implementation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Update `docs/07-governance/domain-naming-decision-log.md` with decision for `ApiServiceAccessMode` extension to include `'query-param'`. | ✅ | 2026-06-14 |
| TASK-001 | Update `docs/01-requirements/domain-ubiquitous-language-glossary.md` with canonical definition of query-param authentication mode. | ✅ | 2026-06-14 |
| TASK-002 | Update `docs/02-design/domain-bounded-context-map.md` with ApiService authentication mode ownership and translation rules. | ✅ | 2026-06-14 |

**Completion Criteria**: All terminology changes are documented in canonical DDD sources before code implementation begins.

### Implementation Phase 1 - BLOCKER-001: Query-Param Auth Support

**GOAL-001**: Add query-param authentication mode to ApiService infrastructure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-003 | Extend `ApiServiceAccessMode` type in `apps/backend/src/lib/types/api-service.ts`: `'public' \| 'token' \| 'query-param'`. | ✅ | 2026-06-14 |
| TASK-004 | Add `tokenParamName?: string \| null` field to `CreateApiServiceInput` and related types in `apps/backend/src/lib/types/api-service.ts`. | ✅ | 2026-06-14 |
| TASK-005 | Create migration `packages/infra-db/migrations/20260614_000017_add_token_param_name_column.sql` to add `token_param_name TEXT DEFAULT NULL` to `api_services` table. | ✅ | 2026-06-14 |
| TASK-006 | Update `apps/backend/src/lib/adapters/api-service.adapter.ts` SELECT_COLS and row mapping to include `token_param_name` field. | ✅ | 2026-06-14 |
| TASK-007 | Extend `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts` to inject token as query parameter when `accessMode === 'query-param'`. | ✅ | 2026-06-14 |
| TASK-008 | Update `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` to accept and validate `'query-param'` access mode. | ✅ | 2026-06-14 |
| TASK-009 | Extend `packages/contracts/src/api-service.ts` types to include `tokenParamName` field and `'query-param'` access mode. | ✅ | 2026-06-14 |

**Completion Criteria**: 
- SerpAPI can be configured with `accessMode: 'query-param'` and `tokenParamName: 'api_key'`.
- All existing token-based services continue to work unchanged.
- Type checking passes with no compilation errors.

### Implementation Phase 2 - BLOCKER-002: Crawling WorkflowStepType Support

**GOAL-002**: Enable `'crawling'` workflow step type in API service bindings.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Extend `ApiServiceToolStepBinding.workflowStepType` type in `apps/backend/src/lib/types/api-service.ts` to `'acquisition' \| 'crawling'`. | ✅ | 2026-06-14 |
| TASK-011 | Update `UpsertApiServiceBindingInput.workflowStepType` in `apps/backend/src/lib/adapters/api-service.adapter.ts` to accept both values. | ✅ | 2026-06-14 |
| TASK-012 | Check if DB has CHECK constraint on `api_service_tool_step_bindings.workflow_step_type`. If exists, create migration to expand constraint to `CHECK (workflow_step_type IN ('acquisition', 'crawling'))`. | ✅ | 2026-06-14 |
| TASK-013 | Update validation logic in `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` to accept `'crawling'` workflow step type. | ✅ | 2026-06-14 |
| TASK-014 | Update `packages/contracts/src/api-service.ts` to reflect extended workflow step type options. | ✅ | 2026-06-14 |

**Completion Criteria**:
- Geometric tool can be bound to SerpAPI with `workflowStepType: 'crawling'` without compilation errors.
- Existing `'acquisition'` bindings remain functional.
- DDD semantic correctness: crawling steps use `'crawling'` type, not `'acquisition'`.

### Implementation Phase 3 - BLOCKER-003: Semantic Function Naming

**GOAL-003**: Resolve semantic naming confusion in API service resolution.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add alias `resolveApiServiceForCrawling` in `apps/backend/src/lib/adapters/api-service.adapter.ts` that calls `resolveApiServiceForAcquisition`. | ✅ | 2026-06-14 |
| TASK-016 | Add alias `resolveApiServiceById` in `apps/backend/src/lib/adapters/api-service.adapter.ts` as the semantically neutral name. | ✅ | 2026-06-14 |
| TASK-017 | Update JSDoc documentation on original function to clarify it works for any step type, not just acquisition. | ✅ | 2026-06-14 |
| TASK-018 | Optional: Create deprecation plan for `resolveApiServiceForAcquisition` in favor of `resolveApiServiceById` in future version. | ✅ | 2026-06-14 |

**Completion Criteria**:
- Crawling code can use `resolveApiServiceForCrawling` for semantic clarity.
- No breaking changes to existing callers.
- Function behavior remains identical, only naming semantics improved.

### Implementation Phase 4 - Integration Testing & Validation

**GOAL-004**: Verify all blockers are resolved and system remains stable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Add test in `apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts` for query-param authentication mode. | ✅ | 2026-06-14 |
| TASK-020 | Add test in `apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts` for query-param token injection. | ✅ | 2026-06-14 |
| TASK-021 | Add test in `apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts` for crawling workflow step type binding. | ✅ | 2026-06-14 |
| TASK-022 | Add test for function aliases: verify `resolveApiServiceForCrawling` and `resolveApiServiceById` return identical results. | ✅ | 2026-06-14 |
| TASK-023 | Run full backend test suite: `npm --workspace apps/backend run typecheck && npm --workspace apps/backend run test`. | ✅ | 2026-06-14 |
| TASK-024 | Manual verification: create SerpAPI service with `accessMode: 'query-param'` and `tokenParamName: 'api_key'` via admin API. | ✅ | 2026-06-14 |
| TASK-025 | Manual verification: create binding with `workflowStepType: 'crawling'` for geometric tool serp-crawling step. | ✅ | 2026-06-14 |

**Completion Criteria**:
- All tests pass without regression.
- Manual verification confirms blockers are resolved.
- System is ready for SERP API proposal implementation.

## 4. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Type system breaking changes | Low | High | Additive-only changes, extensive testing |
| DB migration failure | Low | High | Test migrations on dev environment first |
| Security regression in token handling | Low | Critical | Review all token injection paths, maintain existing security patterns |
| Existing API bindings break | Medium | High | Comprehensive backward compatibility testing |
| Performance impact from new logic paths | Low | Medium | Profile acquisition adapter performance before/after |

## 5. Dependencies

- DEP-001: Existing ApiService infrastructure in `apps/backend/src/lib/adapters/api-service.adapter.ts`.
- DEP-002: Current migration baseline in `packages/infra-db/migrations/`.
- DEP-003: Existing type definitions in `apps/backend/src/lib/types/api-service.ts`.
- DEP-004: Contract types in `packages/contracts/src/api-service.ts`.
- DEP-005: DDD documentation files for governance compliance.

## 6. Success Criteria

Upon completion of this plan:

1. **BLOCKER-001 RESOLVED**: SerpAPI can be configured with `accessMode: 'query-param'` and functions correctly.
2. **BLOCKER-002 RESOLVED**: Geometric tool can be bound with `workflowStepType: 'crawling'` semantically correctly.
3. **BLOCKER-003 RESOLVED**: Crawling code can use semantically appropriate function names.
4. **ZERO REGRESSIONS**: All existing ApiService functionality remains intact.
5. **DDD COMPLIANCE**: No semantic violations or non-canonical term usage.
6. **READY FOR SERP**: SERP API integration proposal can proceed without workarounds.

## 7. Post-Completion Actions

After this plan is complete:

1. Update SERP API integration proposal to remove all workaround sections.
2. Implement SERP API integration using proper DDD-compliant values.
3. Consider deprecation timeline for semantically incorrect function names.
4. Document query-param auth pattern for future API service integrations.

## 8. Files Modified

- `packages/infra-db/migrations/YYYYMMDD_NNNNNN_add_token_param_name_column.sql` (new)
- `packages/infra-db/migrations/YYYYMMDD_NNNNNN_extend_workflow_step_type_constraint.sql` (new, if needed)
- `packages/contracts/src/api-service.ts`
- `apps/backend/src/lib/types/api-service.ts`
- `apps/backend/src/lib/adapters/api-service.adapter.ts`
- `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts`
- `apps/backend/src/lib/runtime/integrations/api-service-validation.ts`
- `apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts`
- `apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`

## 9. Related Documents

- `docs/02-design/serp-api-integration-proposal.md` - Original proposal with blocker definitions
- `docs/07-governance/domain-naming-decision-log.md` - DDD decision governance
- `plan/feature-api-service-backend-contract-1.md` - Related ApiService infrastructure plan