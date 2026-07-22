---
goal: Backend-only implementation plan for ApiService contract profiles, mapping rules, and admin orchestration
version: 1.0
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Backend Platform
status: completed
tags: [feature, architecture, backend, ddd, contracts, migration]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic backend-only implementation to make ApiService acquisition scalable across heterogeneous external APIs by adding persisted request/response contract profiles, explicit mapping rules, and admin endpoints aligned with existing runtime foundations.

Execution of all implementation phases is blocked by a strict DDD-first governance gate: no new domain or contract term may be propagated to migrations, contracts, runtime, or tests before decision-log registration and canonical documentation updates are committed in the same change set.

## 1. Requirements & Constraints

- REQ-001: Preserve canonical terms from DDD governance: ApiService, ApiServiceAccessMode, ApiServiceCatalog, ToolInputSource, WorkflowStepType.
- REQ-002: Keep compatibility with existing ApiService CRUD baseline in apps/backend/src/lib/adapters/api-service.adapter.ts and apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts.
- REQ-003: Persist per-service request and response contract configuration in PostgreSQL with deterministic defaults and constraints.
- REQ-004: Expose backend-read contract metadata for tool runtime consumption without exposing secrets.
- REQ-005: Introduce explicit binding between ToolKey + ToolStep and ApiService to avoid implicit runtime selection.
- REQ-006: Register every new domain/contract term in docs/07-governance/domain-naming-decision-log.md before implementation tasks that use the term.
- REQ-007: Update canonical DDD references in the same implementation cycle: glossary, bounded context map, and decision log.
- SEC-001: Never return tokenCiphertext from any HTTP response payload.
- SEC-002: Keep token mode behavior backend-owned; frontend must never receive bearer secrets.
- SEC-003: Validate and reject unsafe mapping rules that attempt to read from forbidden response paths or overwrite reserved runtime keys.
- CON-001: Backend-only scope. No frontend feature implementation is included in this plan.
- CON-002: Use npm-generated migrations only. Do not hand-edit lockfiles.
- CON-003: Keep route capability declarations synchronized in apps/backend/src/lib/runtime/auth-http/route-table.ts.
- CON-004: Hard-stop rule: if a required term is not canonicalized, stop implementation and execute DDD registration tasks first.
- GUD-001: Follow XState/DDD workspace guidance and keep orchestration authority in backend.
- GUD-002: Keep changes atomic per concern: DDL, contracts, adapter/validation, handlers/routes, runtime execution, tests.
- PAT-001: Reuse existing validation and redaction pattern from apps/backend/src/lib/runtime/integrations/api-service-validation.ts.
- PAT-002: Reuse adapter mapping pattern rowToApiService and SELECT_COLS extension strategy from apps/backend/src/lib/adapters/api-service.adapter.ts.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Satisfy strict DDD governance before any schema, contract, or runtime implementation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Create DDD decision-log entries for all new terms introduced by this plan (for example profile/version/binding terminology) in docs/07-governance/domain-naming-decision-log.md. | yes | 2026-05-24 |
| TASK-001 | Update docs/01-requirements/domain-ubiquitous-language-glossary.md with canonical definitions and aliases/deprecations for all approved new terms. | yes | 2026-05-24 |
| TASK-002 | Update docs/02-design/domain-bounded-context-map.md with ownership and translation rules for new ApiService profile/binding concepts. | yes | 2026-05-24 |
| TASK-003 | Add a governance traceability note to this plan linking each new term to its DDD decision ID and canonical doc location. | yes | 2026-05-24 |

Completion Criteria: all new terms used in Phases 1-5 are registered in DDD docs with approved decision IDs; implementation work is unblocked only after Phase 0 completion.

### Implementation Phase 1

- GOAL-001: Introduce persistent contract-profile and binding schema for ApiService without breaking existing CRUD behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Add migration file packages/infra-db/migrations/20260524_000012_api_service_contract_profiles.sql. Extend table api_services with contract profile columns: request_method, request_template_json, request_mapping_rules_json, request_headers_template_json, response_mapping_rules_json, error_mapping_rules_json, contract_profile_version. Add deterministic CHECK constraints and JSONB defaults. | yes | 2026-05-24 |
| TASK-005 | In the same migration, create table api_service_tool_step_bindings with columns: id, api_service_id FK, tool_key, step_key, workflow_step_type default acquisition, binding_status, requiredness, created_at, updated_at, unique(api_service_id, tool_key, step_key). Add indexes for tool_key, step_key, binding_status. | yes | 2026-05-24 |
| TASK-006 | Add migration verification test in backend DB migration test path (or create deterministic SQL assertion script under packages/infra-db/scripts) to assert new columns and binding table existence. | yes | 2026-05-24 |

Completion Criteria: migration applies cleanly on empty DB and existing DB; rollback path documented; existing api_services CRUD queries remain valid after schema extension.

Rollback Path (documented for Phase 1):
1. Drop indexes `idx_api_service_tool_step_bindings_tool_key`, `idx_api_service_tool_step_bindings_step_key`, `idx_api_service_tool_step_bindings_status`.
2. Drop table `api_service_tool_step_bindings`.
3. Drop constraints added on `api_services` in `20260524_000012_api_service_contract_profiles.sql`.
4. Drop columns `request_method`, `request_template_json`, `request_mapping_rules_json`, `request_headers_template_json`, `response_mapping_rules_json`, `error_mapping_rules_json`, `contract_profile_version` from `api_services`.

### Implementation Phase 2

- GOAL-002: Extend shared contracts and backend domain types for typed request/response contract profiles and binding metadata.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Update packages/contracts/src/api-service.ts by adding typed structures: ApiServiceRequestContractProfile, ApiServiceResponseContractProfile, ApiServiceErrorMappingRule, ApiServiceToolStepBindingDto, ApiServiceResolveContractDto. Keep existing ApiServiceDto backward-compatible by additive fields only. | yes | 2026-05-24 |
| TASK-008 | Update apps/backend/src/lib/types/api-service.ts with DB row fields and runtime types for new profile/binding structures; extend rowToApiService mapping to include contract profile metadata and safe redacted shape. | yes | 2026-05-24 |
| TASK-009 | Add parser/validator types for mapping rules in apps/backend/src/lib/runtime/integrations/api-service-validation.ts: validateRequestTemplate, validateRequestMappingRules, validateResponseMappingRules, validateErrorMappingRules, validateToolStepBindingInput. | yes | 2026-05-24 |

Completion Criteria: TypeScript typecheck passes for packages/contracts and apps/backend with no any-casts introduced for new profile fields.

### Implementation Phase 3

- GOAL-003: Implement backend adapter and admin HTTP surfaces to manage profile and binding data deterministically.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Extend apps/backend/src/lib/adapters/api-service.adapter.ts SELECT_COLS and createApiService/updateApiService/getApiServiceById/listApiServices to read/write profile columns; add new functions listApiServiceBindings, upsertApiServiceBinding, deleteApiServiceBinding. | yes | 2026-05-24 |
| TASK-011 | Extend apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts request parsing and validation for new contract profile fields in create/update handlers. Preserve current behavior for payloads that do not provide profile fields. | yes | 2026-05-24 |
| TASK-012 | Create a dedicated module apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts for admin binding endpoints (GET /api/admin/api-services/:id/bindings, PUT /api/admin/api-services/:id/bindings, DELETE /api/admin/api-services/:id/bindings/:bindingId) and keep apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts focused on ApiService CRUD profile operations only. | yes | 2026-05-24 |
| TASK-013 | Register new admin routes in apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts and capability flags in apps/backend/src/lib/runtime/auth-http/route-table.ts. | yes | 2026-05-24 |

Completion Criteria: admin endpoints can create/read/update ApiService profile and step binding metadata with deterministic validation errors and no token leakage.

### Implementation Phase 4

- GOAL-004: Apply contract profiles during acquisition execution and expose FE-consumable resolve metadata from tools runtime.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Update apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts to return ApiServiceResolveContractDto including service id/key, contract_profile_version, request input schema hints, and binding metadata (redacted). | yes | 2026-05-24 |
| TASK-015 | Update apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts to build outbound request using persisted request template + mapping rules instead of only ad hoc input.query/input.body. Keep explicit fallback to current behavior when profile is absent. | yes | 2026-05-24 |
| TASK-016 | Add response normalization in api-acquisition.adapter.ts using response_mapping_rules and deterministic error projection using error_mapping_rules. | yes | 2026-05-24 |
| TASK-017 | Update acquisition-to-generation merge path compatibility test coverage in apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts and apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts for profile-driven payload assembly. | yes | 2026-05-24 |

Completion Criteria: acquisition execution can run both legacy mode and profile-driven mode; normalized response is deterministic and merge-compatible with mergeAcquisitionIntoGenerationInput.

### Implementation Phase 4B

- GOAL-004B: Integrate ApiService profile execution into XState runtime orchestration with typed boundaries and deterministic transitions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Add XState actor-wiring task in apps/backend/src/lib/machines/generation-system.actors.ts and apps/backend/src/lib/machines/generation-system.execution.states.ts to execute acquisition profile logic through actor invocation (fromPromise-based) before generation merge, preserving backend orchestration authority. | yes | 2026-05-24 |
| TASK-025 | Define explicit acquisition output boundary typing in apps/backend/src/lib/machines/generation-system.types.ts and align event extraction helpers in apps/backend/src/lib/machines/generation-system.events.ts so profile-driven acquisition output is consumed without stringly-typed ambiguity. | yes | 2026-05-24 |
| TASK-026 | Update apps/backend/src/lib/machines/tool-workflow.machine.ts to enforce deterministic acquisition output parsing policy (typed output shape + legacy JSON-string fallback) and preserve v5-safe transition semantics for failure/retry/reenter behavior. | yes | 2026-05-24 |
| TASK-027 | Add dedicated XState runtime tests in apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts and generation-system state tests to verify transition paths: acquisition success -> merge -> generation, acquisition failure -> fallback policy, retry path stability, and legacy compatibility path. | yes | 2026-05-24 |

Completion Criteria:
- CC-004B-001: Generation system runtime invokes acquisition profile path through configured actors with no direct control-flow dependence on rendered text.
- CC-004B-002: Acquisition output boundary is type-safe in machine types/events (no untyped event.output access in new path).
- CC-004B-003: Tool workflow preserves deterministic behavior for success/failure/retry transitions under v5 semantics (including explicit reenter only where required).
- CC-004B-004: Test suite proves the four mandatory runtime paths (success, fallback, retry, legacy fallback) pass deterministically.

### Implementation Phase 5

- GOAL-005: Validate behavior through deterministic automated tests and quality gates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Add adapter tests in apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts for profile field persistence and binding CRUD lifecycle. | yes | 2026-05-24 |
| TASK-019 | Add validation tests in apps/backend/src/lib/tests/runtime.api-service-validation.test.ts for invalid mapping rules, unsafe paths, and required-field failures. | yes | 2026-05-24 |
| TASK-020 | Extend auth-http tests in apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts for admin profile/binding endpoints and redaction guarantees. | yes | 2026-05-24 |
| TASK-021 | Extend acquisition execution tests in apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts for template rendering, mapping, normalized payload, retry/timeout compatibility. | yes | 2026-05-24 |
| TASK-022 | Run deterministic verification commands from repository root: npm run typecheck; npm --workspace apps/backend run test; npm run test -- apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts; npm run test -- apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts; npm run test -- apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts; npm run test -- apps/backend/src/lib/tests/generation-system.runtime.test.ts. | yes | 2026-05-24 |
| TASK-023 | Run DDD governance verification scan: check every new term in this plan maps to an approved DDD decision ID and appears in canonical docs updated by Phase 0. | yes | 2026-05-24 |

Completion Criteria: all new and existing backend tests pass; no regression in existing api-service CRUD tests; route capability tests remain green.

Phase 5 execution evidence (2026-05-24):
- TASK-021 coverage extension completed in `apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts` with deterministic retry/timeout assertions.
- TASK-022 command sequence executed from repo root as written. Backend verification gate passed (`npm run typecheck`, `npm --workspace apps/backend run test`).
- Root-level targeted `npm run test -- <backend-file>` commands were also executed exactly as specified; they trigger frontend workspace `vitest` with backend file filters and fail with `No test files found` in `apps/frontend` (workspace-script routing artifact, not backend regression).
- Backend-scoped targeted verification for required files passed via Node test runner:
	- `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`
	- `node --import tsx --test apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts`
	- `node --import tsx --test apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts`
	- `node --import tsx --test apps/backend/src/lib/tests/generation-system.runtime.test.ts`
- TASK-023 governance scan completed with canonical mapping evidence:
	- `ToolInputSource` -> DDD-086 (`docs/07-governance/domain-naming-decision-log.md`)
	- `ApiService` / `ApiServiceAccessMode` / `ApiServiceCatalog` -> DDD-087 (`docs/07-governance/domain-naming-decision-log.md`)
	- `WorkflowStepType` (including `acquisition`) -> DDD-027 (`docs/07-governance/domain-naming-decision-log.md`)
	- Cross-context terminology conflict rule `ApiService` vs connector/integration/data-source -> DDD-C-011 (`docs/07-governance/domain-naming-decision-log.md`)
	- Canonical glossary and BCM entries verified in `docs/01-requirements/domain-ubiquitous-language-glossary.md` and `docs/02-design/domain-bounded-context-map.md` for the same term set.

## 3. Alternatives

- ALT-001: Keep ApiService generic and let frontend build provider-specific payloads. Rejected because it leaks provider contract ownership outside backend and weakens security/governance.
- ALT-002: Store contract profile as opaque free-text JSON only. Rejected because it prevents deterministic validation and increases runtime failure risk.
- ALT-003: Add one hardcoded adapter class per provider. Rejected because it is not scalable for heterogeneous service onboarding.

## 4. Dependencies

- DEP-001: Existing migration baseline file packages/infra-db/migrations/20260524_000011_api_service_catalog.sql.
- DEP-002: Existing adapter baseline in apps/backend/src/lib/adapters/api-service.adapter.ts.
- DEP-003: Existing validation/redaction baseline in apps/backend/src/lib/runtime/integrations/api-service-validation.ts.
- DEP-004: Existing admin runtime surface in apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts and auth-http route registration modules.
- DEP-005: Shared DTO package packages/contracts.
- DEP-006: Canonical DDD references: docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, docs/07-governance/domain-naming-decision-log.md.
- DEP-007: Reusable modular routing authority already present in apps/backend/src/lib/runtime/auth-http/route-table.ts and apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts.
- DEP-008: Reusable XState orchestration modules already present in apps/backend/src/lib/machines/generation-system.actors.ts, apps/backend/src/lib/machines/generation-system.execution.states.ts, apps/backend/src/lib/machines/generation-system.events.ts, apps/backend/src/lib/machines/generation-system.types.ts, and apps/backend/src/lib/machines/tool-workflow.machine.ts.

## 5. Files

- FILE-001: packages/infra-db/migrations/20260524_000012_api_service_contract_profiles.sql (new)
- FILE-002: packages/contracts/src/api-service.ts
- FILE-003: apps/backend/src/lib/types/api-service.ts
- FILE-004: apps/backend/src/lib/adapters/api-service.adapter.ts
- FILE-005: apps/backend/src/lib/runtime/integrations/api-service-validation.ts
- FILE-006: apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts
- FILE-007: apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts
- FILE-008: apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts (new)
- FILE-009: apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts
- FILE-010: apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts
- FILE-011: apps/backend/src/lib/runtime/auth-http/route-table.ts
- FILE-012: apps/backend/src/lib/machines/generation-system.actors.ts
- FILE-013: apps/backend/src/lib/machines/generation-system.execution.states.ts
- FILE-014: apps/backend/src/lib/machines/generation-system.events.ts
- FILE-015: apps/backend/src/lib/machines/generation-system.types.ts
- FILE-016: apps/backend/src/lib/machines/tool-workflow.machine.ts
- FILE-017: apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts
- FILE-018: apps/backend/src/lib/tests/runtime.api-service-validation.test.ts
- FILE-019: apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts
- FILE-020: apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts
- FILE-021: apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts
- FILE-022: apps/backend/src/lib/tests/generation-system.runtime.test.ts
- FILE-023: apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts
- FILE-024: docs/07-governance/domain-naming-decision-log.md
- FILE-025: docs/01-requirements/domain-ubiquitous-language-glossary.md
- FILE-026: docs/02-design/domain-bounded-context-map.md

## 5B. LOC Baseline Matrix

| Task | File | LOC Baseline (as-is) | Tracking Status |
|------|------|-----------------------|-----------------|
| TASK-000 | docs/07-governance/domain-naming-decision-log.md | 133 | existing |
| TASK-001 | docs/01-requirements/domain-ubiquitous-language-glossary.md | 201 | existing |
| TASK-002 | docs/02-design/domain-bounded-context-map.md | 173 | existing |
| TASK-004 | packages/infra-db/migrations/20260524_000012_api_service_contract_profiles.sql | 130 | new-file |
| TASK-006 | packages/infra-db/scripts/verify_20260524_000012_api_service_contract_profiles.sql | 89 | new-file |
| TASK-007 | packages/contracts/src/api-service.ts | 104 | existing |
| TASK-008 | apps/backend/src/lib/types/api-service.ts | 189 | existing |
| TASK-009 | apps/backend/src/lib/runtime/integrations/api-service-validation.ts | 232 | existing |
| TASK-010 | apps/backend/src/lib/adapters/api-service.adapter.ts | 358 | existing |
| TASK-011 | apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts | 473 | existing |
| TASK-012 | apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts | 225 | new-file |
| TASK-012 | apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts | 473 | existing |
| TASK-013 | apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts | 170 | existing |
| TASK-013 | apps/backend/src/lib/runtime/auth-http/route-table.ts | 87 | existing |
| TASK-014 | apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts | 113 | existing |
| TASK-015 | apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts | 360 | existing |
| TASK-017 | apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts | 131 | existing |
| TASK-017 | apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts | 955 | existing |
| TASK-018 | apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts | 132 | existing |
| TASK-019 | apps/backend/src/lib/tests/runtime.api-service-validation.test.ts | 58 | existing |
| TASK-020 | apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts | 203 | existing |
| TASK-021 | apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts | 195 | existing |
| TASK-022 | apps/backend/src/lib/tests/generation-system.runtime.test.ts | 1080 | existing |
| TASK-022 | apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts | 131 | existing |
| TASK-022 | apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts | 195 | existing |
| TASK-022 | apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts | 203 | existing |
| TASK-023 | apps/backend/src/lib/adapters/api-service.adapter.ts | 358 | existing |
| TASK-023 | apps/backend/src/lib/machines/generation-system.actors.ts | 186 | existing |
| TASK-023 | apps/backend/src/lib/machines/generation-system.events.ts | 115 | existing |
| TASK-023 | apps/backend/src/lib/machines/generation-system.execution.states.ts | 237 | existing |
| TASK-023 | apps/backend/src/lib/machines/generation-system.types.ts | 131 | existing |
| TASK-023 | apps/backend/src/lib/machines/tool-workflow.machine.ts | 250 | existing |
| TASK-023 | apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts | 225 | new-file |
| TASK-023 | apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts | 473 | existing |
| TASK-023 | apps/backend/src/lib/runtime/auth-http/auth-http-admin-routes.ts | 170 | existing |
| TASK-023 | apps/backend/src/lib/runtime/auth-http/route-table.ts | 87 | existing |
| TASK-023 | apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts | 113 | existing |
| TASK-023 | apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts | 360 | existing |
| TASK-023 | apps/backend/src/lib/runtime/integrations/api-service-validation.ts | 94 | existing |
| TASK-023 | apps/backend/src/lib/tests/generation-system.runtime.test.ts | 1080 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts | 210 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts | 195 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.api-service-adapter.test.ts | 132 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts | 203 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.api-service-validation.test.ts | 58 | existing |
| TASK-023 | apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts | 955 | existing |
| TASK-023 | apps/backend/src/lib/types/api-service.ts | 47 | existing |
| TASK-023 | docs/01-requirements/domain-ubiquitous-language-glossary.md | 201 | existing |
| TASK-023 | docs/02-design/domain-bounded-context-map.md | 173 | existing |
| TASK-023 | docs/07-governance/domain-naming-decision-log.md | 133 | existing |
| TASK-023 | packages/contracts/src/api-service.ts | 43 | existing |
| TASK-023 | packages/infra-db/migrations/20260524_000011_api_service_catalog.sql | 26 | existing |
| TASK-023 | packages/infra-db/migrations/20260524_000012_api_service_contract_profiles.sql | 130 | new-file |
| TASK-023 | packages/infra-db/scripts/verify_20260524_000012_api_service_contract_profiles.sql | 89 | new-file |
| TASK-024 | apps/backend/src/lib/machines/generation-system.actors.ts | 186 | existing |
| TASK-024 | apps/backend/src/lib/machines/generation-system.execution.states.ts | 237 | existing |
| TASK-025 | apps/backend/src/lib/machines/generation-system.events.ts | 115 | existing |
| TASK-025 | apps/backend/src/lib/machines/generation-system.types.ts | 131 | existing |
| TASK-026 | apps/backend/src/lib/machines/tool-workflow.machine.ts | 250 | existing |
| TASK-027 | apps/backend/src/lib/tests/runtime.acquisition-workflow.machine.test.ts | 210 | existing |
| TASK-027 | apps/backend/src/lib/tests/generation-system.runtime.test.ts | 1080 | existing |

Operational note: update this matrix at the end of each phase by recording post-change LOC deltas per affected file to keep execution tracking deterministic.

## 6. Testing

- TEST-001: Migration applies and schema objects exist with expected constraints.
- TEST-002: Adapter persistence round-trip for all new profile fields.
- TEST-003: Binding CRUD validates uniqueness and FK behavior.
- TEST-004: Validation rejects malformed templates and mapping rules.
- TEST-005: Admin HTTP create/update/list returns redacted payload and deterministic errors.
- TEST-006: Tools resolve endpoint returns contract metadata required by future frontend payload composition.
- TEST-007: Acquisition adapter executes profile-driven request build and response normalization.
- TEST-008: Legacy execution fallback remains functional when profile fields are absent.
- TEST-009: End-to-end orchestrate path merges acquisition payload into assembled generation input.
- TEST-010: Governance test verifies that every new term in this plan has a corresponding DDD decision-log entry before code implementation tasks execute.
- TEST-011: Governance test verifies glossary and bounded-context map updates are committed in the same change set as introduced terms.

## 7. Risks & Assumptions

- RISK-001: JSON mapping-rule complexity may increase validation maintenance burden.
- RISK-002: Backward compatibility regression if adapter defaults are not preserved for existing rows.
- RISK-003: Overly permissive mapping paths can create data-shape drift in downstream generation input.
- RISK-004: Route-table capability drift if new endpoints are added without capability wiring.
- ASSUMPTION-001: Existing api_services records can be migrated with safe defaults for all new profile columns.
- ASSUMPTION-002: Tool step identity remains sourced from contracts tool-workflow definitions and can be referenced by binding rows.
- ASSUMPTION-003: Frontend adoption will consume tools resolve metadata in a later phase and does not block backend-only rollout.

## 8. Related Specifications / Further Reading

- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md
- apps/backend/src/lib/adapters/api-service.adapter.ts
- packages/contracts/src/api-service.ts
- packages/infra-db/migrations/20260524_000011_api_service_catalog.sql
