---
goal: Implement Zod in backend-first HTTP parsing and align FE/BE validation semantics for admin and auth-http surfaces
version: 1.0
date_created: 2026-06-02
last_updated: 2026-06-02
owner: Backend Platform
status: 'In Progress'
tags: [feature, backend, zod, validation, contracts, ddd, frontend]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This plan defines Wave 1 of a deterministic backend-first adoption of Zod for HTTP request parsing and validation in the `auth-http` runtime. Wave 1 is intentionally narrow: add the backend dependency, introduce one reusable parsing boundary, migrate only the documented pilot surface `admin-api-service`, and verify that success-path behavior stays stable while invalid-payload coverage becomes stricter. Adjacent handlers are explicitly out of implementation scope for this wave and are captured only as a deterministic follow-up queue. Frontend Zod usage remains the semantic reference for field rules, but backend schemas stay backend-owned and request-shape-specific.

## 1. Requirements & Constraints

- **REQ-001**: Implement Zod first in backend HTTP request parsing, not in frontend-only utilities.
- **REQ-002**: Use `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` as the first migration slice because it is the documented pilot surface in `docs/02-design/specifications/dependency-unification-proposal.md`.
- **REQ-003**: Replace imperative body parsing and repeated field guards with schema-driven parsing that produces typed output before handler business logic runs.
- **REQ-004**: Preserve canonical domain terms already registered in DDD governance, including `ApiService`, `ApiServiceAccessMode`, `ApiServiceCatalog`, `LlmModel`, `LlmModelCatalog`, `ProductChangelog`, and `UserReport`.
- **REQ-005**: Keep backend request validation semantics aligned with existing frontend Zod forms where the same business fields already exist, especially for the admin ApiService surface.
- **REQ-006**: Do not reuse frontend form schemas directly inside backend runtime. Backend schemas must model backend HTTP payloads, defaults, coercions, and nullable semantics explicitly.
- **REQ-007**: Introduce one reusable backend schema/parsing module pattern that can be applied to multiple auth-http handlers after the pilot.
- **REQ-008**: Preserve current HTTP status semantics and current error envelope shape (`bad_request`, `not_found`, `conflict`, `method_not_allowed`) unless a task explicitly changes them.
- **REQ-009**: Keep `parseJsonBody` available for unchanged handlers during phased rollout, but stop using it as the final validation boundary in migrated handlers.
- **REQ-010**: Keep FE/BE contract authority deterministic: request DTO semantics remain backend-owned at runtime; shared transport shapes belong in `packages/contracts` only when they are truly cross-context.
- **REQ-011**: Validate the migration with existing backend auth-http tests and add targeted tests for invalid payloads and coercion boundaries.
- **REQ-012**: Produce a convergence path for adjacent handlers already using `parseJsonBody<Record<string, unknown>>`, but keep that path as a post-Wave-1 migration queue rather than an implementation obligation in this file.
- **REQ-013**: Preserve existing success-path response payload shape for `admin-api-service` CRUD and resolve-contract flows. No renamed response fields are allowed in Wave 1.
- **REQ-014**: Keep backend route registration unchanged in Wave 1. No new routes or route-table capability edits are allowed.
- **REQ-015**: Keep `packages/contracts` unchanged in Wave 1 unless a concrete compiler or test failure proves a shared type update is mandatory for the pilot.
- **SEC-001**: Do not leak token-bearing values or internal parsing diagnostics in HTTP response payloads.
- **SEC-002**: Keep backend authority over security-sensitive validation such as token header normalization and admin-only payload handling.
- **SEC-003**: Do not make runtime control flow depend on rendered copy strings or frontend-only validation messages.
- **CON-001**: Any dependency-manifest change must follow workspace dependency governance: update lockfiles via npm only and keep root and frontend lockfiles synchronized.
- **CON-002**: The required dependency verification sequence after adding Zod to backend is: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`.
- **CON-003**: `packages/domain` must remain framework-agnostic and must not gain runtime dependencies for this work.
- **CON-004**: No new DDD term is required for `Zod`; do not create glossary or decision-log entries unless the implementation introduces a new domain concept.
- **CON-005**: Keep changes incremental by handler cluster. Do not attempt monorepo-wide validation refactor in one phase.
- **CON-006**: Wave 1 must not modify `admin-feedback-center-handlers.ts`, `public-handlers.ts`, `projects-handlers.ts`, or unrelated auth-http modules.
- **CON-007**: Wave 1 must not change frontend source files. Frontend files are reference inputs only.
- **CON-008**: Wave 1 must not remove existing backend business validators such as `validateApiServiceInput(...)`; schema parsing is additive at the request-boundary layer.
- **GUD-001**: Favor a backend-local schema layer under `apps/backend/src/lib/runtime/auth-http/` or a closely adjacent backend runtime module instead of spreading one-off schemas inside each handler.
- **GUD-002**: Keep schema definitions small and composable: enum fields, JSON object payload fields, array payload fields, nullable string fields, and integer bounds should be factored into reusable helpers when repeated.
- **GUD-003**: Reuse existing backend normalization helpers where they remain authoritative, for example `normalizeTokenHeaderName` in `apps/backend/src/lib/runtime/integrations/api-service-validation.ts`.
- **PAT-001**: Frontend Zod schemas are semantic references only. Use them to align allowed values and field constraints, but do not couple backend runtime to UI form string-shape assumptions.
- **PAT-002**: Preserve backend orchestration and request-boundary ownership described in `AGENTS.md` and the bounded context map: Frontend projects and collects input; backend validates and owns execution semantics.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Add backend Zod dependency and define the reusable backend parsing boundary for auth-http handlers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `zod` to `apps/backend/package.json` dependencies and regenerate workspace lockfiles through npm. Do not hand-edit `package-lock.json` or `apps/frontend/package-lock.json`. | yes | 2026-06-02 |
| TASK-002 | Create exactly one backend schema utility module under `apps/backend/src/lib/runtime/auth-http/` for reusable auth-http parsing helpers. Minimum helpers: non-empty trimmed string, optional trimmed string, integer field parser, enum parser, object JSON field parser, array JSON field parser, and schema-to-error adapter for `writeError(response, 400, 'bad_request', ...)`. Do not create multiple competing helper files in Wave 1. | yes | 2026-06-02 |
| TASK-003 | Keep `apps/backend/src/lib/runtime/auth-http/support.ts` unchanged as the raw JSON reader boundary for legacy handlers, but define the new rule that migrated handlers must pass raw parsed bodies through Zod before business logic. | yes | 2026-06-02 |
| TASK-004 | Add a backend-only parsing result convention for migrated handlers: `parseJsonBody<unknown>` or equivalent raw payload read first, then schema parse second, then handler execution with typed data. Do not keep `Record<string, unknown>` as the typed source of truth in migrated code. | yes | 2026-06-02 |

Completion Criteria:
- CC-001: `apps/backend/package.json` includes `zod` and lockfiles are npm-regenerated.
- CC-002: There is exactly one reusable Wave-1 parsing utility entrypoint for migrated auth-http handlers.
- CC-003: `support.ts` remains a raw-body utility and is not turned into a second validation authority.

### Implementation Phase 2

- GOAL-002: Implement the documented pilot on `admin-api-service` and align backend request semantics with the existing frontend admin ApiService form.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | In `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`, replace local helper usage `parseAccessMode`, `parseStatus`, `parseRequestMethod`, `asRecordOrDefault`, and `asArrayOrDefault` as the primary body-validation path with Zod schemas for create and update payloads. Preserve backend-only normalization rules and final call to `validateApiServiceInput(...)`. | yes | 2026-06-02 |
| TASK-006 | Create dedicated backend schemas for the admin ApiService create payload and partial update payload. These schemas must cover: `key`, `label`, `baseUrl`, `resourcePath`, `accessMode`, `timeoutMs`, `retryCount`, `tokenRef`, `tokenHeaderName`, `status`, `requestMethod`, `requestTemplateJson`, `requestMappingRulesJson`, `requestHeadersTemplateJson`, `responseMappingRulesJson`, `errorMappingRulesJson`, and `contractProfileVersion`. | yes | 2026-06-02 |
| TASK-007 | Reuse semantic constraints from `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` where appropriate: enum values, token-header-name format, timeout bounds, retry-count bounds, positive contract version, and JSON object/array expectations. Backend schemas must adapt these rules to native HTTP payload shapes instead of frontend form string inputs. | yes | 2026-06-02 |
| TASK-008 | Keep `normalizeTokenHeaderName` from `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` as the authority for final token header normalization. Zod should validate the input shape and hand the normalized string to the existing backend helper. | yes | 2026-06-02 |
| TASK-009 | Replace repeated `writeError(... 'field must be ...')` branches in `handleAdminApiServicesCreate` and `handleAdminApiServicesUpdate` with one deterministic schema-parse failure path that maps Zod issues to current backend error-envelope semantics. Preserve business-rule validation errors from `validateApiServiceInput(...)` as a second-stage failure path. The adapter must produce stable `400 bad_request` responses and must not expose raw Zod issue arrays to clients. | yes | 2026-06-02 |

Completion Criteria:
- CC-004: `admin-api-service-handlers.ts` no longer uses `Record<string, unknown>` as the authoritative typed source for create/update payloads.
- CC-005: Success-path behavior for existing admin ApiService tests remains unchanged.
- CC-006: Schema failures return `400 bad_request` with deterministic human-readable messages and no raw Zod diagnostics.
- CC-007: Existing backend normalization and business validation helpers still execute after schema parse where applicable.

### Implementation Phase 3

- GOAL-003: Freeze Wave 1 scope and produce the deterministic Wave 2 migration queue without implementing adjacent handlers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Produce a residual queue of remaining auth-http handlers that still rely on `parseJsonBody<Record<string, unknown>>` or equivalent manual body extraction. Minimum queue candidates to inspect and order: `admin-api-service-binding-handlers.ts`, `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, `public-handlers.ts`, and `projects-handlers.ts`. | yes | 2026-06-02 |
| TASK-011 | Rank the residual queue by these deterministic criteria in order: existing backend test coverage, amount of duplicated parse logic, security sensitivity of payload fields, and FE/BE drift risk. | yes | 2026-06-02 |
| TASK-012 | Document explicit Wave 1 non-goals in the execution notes: no implementation changes to the residual queue files, no shared-schema extraction, no frontend edits, and no route-surface expansion. | yes | 2026-06-02 |

Completion Criteria:
- CC-008: Wave 1 produces a next-handler queue in deterministic priority order.
- CC-009: No adjacent handler file is modified as part of Wave 1 implementation.

### Implementation Phase 4

- GOAL-004: Record FE/BE validation convergence rules for the pilot without changing shared packages or frontend code.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Compare `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` with the new backend admin ApiService Zod schemas and produce one deterministic mapping for each shared field: UI string field -> frontend parse helper -> backend request field -> backend Zod constraint -> backend normalization helper. Record this mapping in plan execution notes or in a narrowly scoped code comment near the backend schema only if needed for future maintainers. | yes | 2026-06-02 |
| TASK-014 | Confirm that Wave 1 does not require edits to `packages/contracts`. If a shared contract difference is discovered, record it as follow-up work instead of widening Wave 1 unless the pilot cannot typecheck without it. | yes | 2026-06-02 |
| TASK-015 | Confirm that enum-value authority remains singular for the pilot fields. Use canonical backend/domain types where already available and record any unavoidable duplication as technical debt for Wave 2. | yes | 2026-06-02 |

Completion Criteria:
- CC-010: Pilot FE/BE field mapping is documented for `admin-api-service` only.
- CC-011: `packages/contracts` and frontend source files remain unchanged in Wave 1 unless a blocking compile issue proves otherwise.

### Implementation Phase 5

- GOAL-005: Validate the backend-first migration with deterministic tests and workspace dependency checks.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Extend `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` with invalid-payload tests for the migrated admin ApiService create/update handlers. Cover exactly these minimum cases: invalid `accessMode`, invalid `status`, invalid `requestMethod`, malformed `requestTemplateJson`, malformed `requestMappingRulesJson`, malformed `requestHeadersTemplateJson`, malformed `responseMappingRulesJson`, malformed `errorMappingRulesJson`, invalid `tokenHeaderName`, `timeoutMs` below minimum, `timeoutMs` above maximum, `retryCount` below minimum, `retryCount` above maximum, and `contractProfileVersion` less than 1. | yes | 2026-06-02 |
| TASK-017 | Preserve and rerun the existing success-path tests in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` that cover create, update, list, and redacted payload behavior. These are regression gates, not optional smoke checks. | yes | 2026-06-02 |
| TASK-018 | Run backend-focused verification commands for Wave 1 in this exact order: first the narrow test file `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`; then backend typecheck via `npm --workspace apps/backend run typecheck` if available, otherwise `npm run typecheck`; then `npm --workspace apps/backend run test` if the targeted file already passes. | yes | 2026-06-02 |
| TASK-019 | Run dependency-determinism commands required by workspace governance after adding backend Zod: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`. | yes | 2026-06-02 |
| TASK-020 | Run a final grep review under `apps/backend/src/lib/runtime/auth-http/` to identify remaining `parseJsonBody<Record<string, unknown>>` call sites and confirm that `admin-api-service-handlers.ts` is no longer among them. Use this output as the source for Phase 3 queue finalization. | yes | 2026-06-02 |

Completion Criteria:
- CC-012: Existing success-path auth-http tests for the pilot remain green.
- CC-013: Each minimum invalid-payload case listed in TASK-016 has an explicit test assertion.
- CC-014: Dependency-governance command sequence completes successfully after the new backend dependency is added.
- CC-015: Final grep confirms pilot migration is complete and residual manual-parse handlers are explicitly queued.

## Wave 1 Execution Checklist

Use this checklist as the operational sequence for Wave 1 execution. Do not start a later item until the current blocking item is complete.

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W1-001 | Add `zod` to `apps/backend/package.json`. | Yes | Diff shows backend dependency added. |
| W1-002 | Regenerate `package-lock.json` and `apps/frontend/package-lock.json` through npm only. | Yes | Lockfiles updated by npm commands, not manual edits. |
| W1-003 | Create exactly one backend helper module `apps/backend/src/lib/runtime/auth-http/zod-support.ts`. | Yes | File exists and no second competing Zod helper module is introduced. |
| W1-004 | Keep `apps/backend/src/lib/runtime/auth-http/support.ts` as raw JSON reader only. | Yes | No new validation authority added to `support.ts`. |
| W1-005 | Migrate only `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` to use Zod parse output as the typed request source for create and update flows. | Yes | Completed 2026-06-02. Handler now parses `unknown` raw bodies through dedicated create/update Zod schemas before business validation. |
| W1-006 | Preserve `validateApiServiceInput(...)` and `normalizeTokenHeaderName(...)` as post-parse business validation and normalization authorities. | Yes | Completed 2026-06-02. Both helpers remain active after schema parse in create/update flows. |
| W1-007 | Do not modify out-of-scope handler files: `admin-api-service-binding-handlers.ts`, `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, `public-handlers.ts`, `projects-handlers.ts`. | Yes | Git diff shows no edits in those files. |
| W1-008 | Add invalid-payload coverage in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` for the full Wave-1 minimum matrix. | Yes | Test file includes explicit assertions for every case in TASK-016. |
| W1-009 | Preserve existing success-path coverage in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` for create, update, list, and redacted payload behavior. | Yes | Existing success-path tests remain present and passing. |
| W1-010 | Produce the FE/BE alignment matrix for `admin-api-service` field constraints only. | No | Completed 2026-06-02. Phase 4 execution notes document the field mapping, contract non-change decision, and enum-authority note. |
| W1-011 | Produce the residual Wave 2 queue ordered by backend test coverage, duplicated parse logic, security sensitivity, and FE/BE drift risk. | No | Completed 2026-06-02. Ordered queue and Wave 1 non-goals recorded in Phase 3 execution notes. |
| W1-012 | Run `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`. | Yes | Completed 2026-06-02. Focused pilot file passed with 22/22 tests green after full invalid-payload matrix completion. |
| W1-013 | Run backend typecheck: `npm --workspace apps/backend run typecheck` if available, otherwise `npm run typecheck`. | Yes | Completed 2026-06-02. Backend typecheck passed after Phase 2 payload-builder fix. |
| W1-014 | Run `npm --workspace apps/backend run test`. | Yes | Completed 2026-06-02. Backend workspace suite passed with 230/230 tests green. |
| W1-015 | Run dependency-governance sequence: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`. | Yes | Completed 2026-06-02. All four commands exit 0 (warnings non-blocking). |
| W1-016 | Run grep gate on `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` to confirm the old manual parsing boundary is gone from active flow. | Yes | Grep output excludes active reliance on `parseJsonBody<Record<string, unknown>>`, `parseAccessMode`, `parseStatus`, `parseRequestMethod`, `asRecordOrDefault`, and `asArrayOrDefault`. |
| W1-017 | Confirm rollback scope is limited to `apps/backend/package.json`, lockfiles, `apps/backend/src/lib/runtime/auth-http/zod-support.ts`, `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`, and `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`. | Yes | Final execution note records rollback boundary explicitly. |

Wave 1 is complete only when all blocking checklist items W1-001 through W1-017 are satisfied, except W1-010 and W1-011 which are required handoff artifacts but are non-blocking for code compilation.

## Wave 2 Checklist Template

Use this template for each follow-up auth-http handler migration after Wave 1 is complete. Replace `<handler-file>`, `<test-file>`, `<schema-name>`, and `<business-validator>` with the concrete handler values. Do not execute a Wave 2 checklist until Wave 1 gates are fully green.

### Wave 2 Preconditions

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-PRE-001 | Confirm Wave 1 is complete and all blocking Wave 1 items are green. | Yes | Wave 1 execution record shows all blocking items passed. |
| W2-PRE-002 | Confirm `<handler-file>` is in the approved residual queue produced by Wave 1. | Yes | Residual queue artifact lists the handler with its priority. |
| W2-PRE-003 | Confirm `<handler-file>` still relies on `parseJsonBody<Record<string, unknown>>` or equivalent manual request-body extraction. | Yes | Grep or code inspection shows the current manual parsing boundary. |
| W2-PRE-004 | Identify the primary test anchor `<test-file>` that already covers or should cover `<handler-file>`. | Yes | Existing test file path is recorded before editing begins. |
| W2-PRE-005 | Confirm no new DDD term is needed for the handler payload or response shape. If a new domain term is required, stop and update DDD governance first. | Yes | Canonical glossary and decision-log review completed. |

### Wave 2 Handler Execution Template

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-001 | Keep changes limited to `<handler-file>`, the shared helper `apps/backend/src/lib/runtime/auth-http/zod-support.ts` if strictly necessary, and the minimum test files required for the handler. | Yes | Final diff touches only allowed files. |
| W2-002 | Define exactly the handler-local Zod schema set required by `<handler-file>`. Use deterministic names such as `<schema-name>CreateSchema`, `<schema-name>UpdateSchema`, or `<schema-name>RequestSchema` based on the handler surface. | Yes | Schema names and responsibilities are explicit in diff. |
| W2-003 | Read raw JSON as `unknown` first and treat Zod parse output as the only typed request-body source in `<handler-file>`. | Yes | Handler no longer uses `Record<string, unknown>` as authoritative typed input. |
| W2-004 | Preserve the existing backend business validator `<business-validator>` if one exists. Use Zod for request-boundary validation, not as a replacement for downstream business rules unless the old validator becomes provably redundant. | Yes | Diff shows request parse and business validation remain separate when applicable. |
| W2-005 | Preserve current HTTP status semantics and current error-envelope keys. | Yes | No response envelope regression in tests or diff. |
| W2-006 | Normalize Zod issues through one deterministic `bad_request` adapter path. Do not expose raw Zod issue arrays or stack traces in client responses. | Yes | Error-path diff and tests confirm normalized output. |
| W2-007 | Do not import frontend runtime code or schema files into backend runtime. | Yes | Imports remain backend-local or shared-domain/shared-contract only where already canonical. |
| W2-008 | Do not widen the migration to adjacent handlers while working on `<handler-file>`. | Yes | No opportunistic edits outside the chosen handler slice. |
| W2-009 | Add invalid-payload tests in `<test-file>` for the full field matrix owned by `<handler-file>`. | Yes | Test file contains explicit negative coverage for each request field category. |
| W2-010 | Preserve and rerun the existing success-path tests for `<handler-file>`. | Yes | Existing success-path assertions remain present and passing. |
| W2-011 | Add or update one FE/BE alignment note only if `<handler-file>` has a frontend semantic counterpart. If there is no frontend counterpart, record `backend-only surface` explicitly. | No | Execution note records either field mapping or backend-only status. |
| W2-012 | Update the residual queue by removing `<handler-file>` and re-ranking the remaining handlers after the migration is complete. | No | Residual queue artifact is updated after validation passes. |

### Wave 2 Validation Template

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-V-001 | Run the narrowest handler-focused test command first. Preferred form: `node --import tsx --test <test-file>`. | Yes | Exit code 0. |
| W2-V-002 | Run backend typecheck: `npm --workspace apps/backend run typecheck` if available, otherwise `npm run typecheck`. | Yes | Exit code 0. |
| W2-V-003 | Run `npm --workspace apps/backend run test`. | Yes | Exit code 0. |
| W2-V-004 | Run the dependency-determinism sequence only if dependency manifests changed in this wave: `npm install --workspaces --include-workspace-root`, `npm ci`, `npm ci --workspaces --include-workspace-root`, `npm --workspace apps/frontend run build`. | Conditional | All commands exit 0 when manifests changed; otherwise record `not required`. |
| W2-V-005 | Run a grep gate on `<handler-file>` to confirm old manual parsing helpers are no longer active in request-boundary flow. | Yes | Grep output proves legacy parsing boundary is gone or inactive. |
| W2-V-006 | Confirm out-of-scope handler files are unchanged in the final diff. | Yes | Diff review shows no unrelated handler edits. |

### Wave 2 Completion Criteria Template

- **W2-CC-001**: `<handler-file>` uses Zod parse output as the authoritative typed request-body source.
- **W2-CC-002**: Existing success-path behavior for `<handler-file>` remains unchanged.
- **W2-CC-003**: Invalid-payload coverage exists for every request-field category owned by `<handler-file>`.
- **W2-CC-004**: Client-visible error responses remain normalized to the existing backend envelope semantics.
- **W2-CC-005**: No unrelated auth-http handler file is modified in the same wave.
- **W2-CC-006**: The residual queue is updated after validation succeeds.

### Wave 2 Handler Instantiation Guide

Use the template with these substitutions for the next queued handlers:

| Handler | `<handler-file>` | `<test-file>` | `<schema-name>` | `<business-validator>` |
|--------|------------------|---------------|-----------------|------------------------|
| ApiService Binding | `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` | `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` or the narrowest binding-focused auth-http test file | `adminApiServiceBinding` | `validateToolStepBindingInput(...)` |
| LlmModel Admin | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | the narrowest LLM-model admin auth-http test file under `apps/backend/src/lib/tests/` | `adminLlmModel` | inline handler business rules or adapter-level model constraints |
| Feedback Center Admin | `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` | the narrowest feedback-center auth-http test file under `apps/backend/src/lib/tests/` | `adminFeedbackCenter` | existing optional-string and state-transition validation path |
| Public Handlers | `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` | the narrowest public-handler auth-http test file under `apps/backend/src/lib/tests/` | `publicHandler` | handler-specific runtime validation path |

## Wave 2 Instance: AdminApiServiceBindingHandlers

This section instantiates the Wave 2 template for `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts`. Execute it only after all blocking Wave 1 gates are green.

### Binding Handler Preconditions

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-BIND-PRE-001 | Confirm all blocking Wave 1 items are complete. | Yes | Wave 1 execution record is green. |
| W2-BIND-PRE-002 | Confirm `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` is the highest-priority remaining handler in the residual queue. | Yes | Residual queue ranks binding handler first. |
| W2-BIND-PRE-003 | Confirm the handler still uses `parseJsonBody<Record<string, unknown>>` and manual extraction of `toolKey`, `stepKey`, `workflowStepType`, `bindingStatus`, `requiredness`, and optional `id`. | Yes | Code inspection or grep proves the current manual boundary is still active. |
| W2-BIND-PRE-004 | Confirm `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` is the primary test anchor for binding list and binding upsert paths. | Yes | Existing tests already cover binding list plus 404 and 409 upsert branches. |
| W2-BIND-PRE-005 | Confirm no new DDD term is required. The canonical terms already in use are `ApiService`, `ToolKey`, `WorkflowStepType`, and binding `requiredness` values already enforced by backend validation. | Yes | DDD review finds no missing domain term. |

### Binding Handler Execution Checklist

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-BIND-001 | Keep code changes limited to `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts`, `apps/backend/src/lib/runtime/auth-http/zod-support.ts` if strictly necessary, and `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`. | Yes | Final diff touches only these files unless a compile blocker proves otherwise. |
| W2-BIND-002 | Define one handler-local upsert schema set for the request body. Minimum schema names: `adminApiServiceBindingUpsertSchema` and, only if needed for reuse clarity, a smaller `adminApiServiceBindingBaseSchema`. | Yes | Schema names are explicit in diff. |
| W2-BIND-003 | Parse the request body as `unknown` first, then use Zod parse output as the only typed body source for `handleAdminApiServiceBindingsUpsert`. | Yes | The handler no longer relies on `Record<string, unknown>` as authoritative typed input. |
| W2-BIND-004 | Keep `validateToolStepBindingInput(...)` as the business-validation stage after schema parsing. Zod owns request shape; `validateToolStepBindingInput(...)` continues to own canonical rule enforcement for `toolKey`, `stepKey`, `workflowStepType`, `bindingStatus`, and `requiredness`. | Yes | Diff shows both stages remain separate. |
| W2-BIND-005 | Preserve existing non-body control flow for list and delete handlers. Only `handleAdminApiServiceBindingsUpsert` is the request-body migration target in this wave. | Yes | List and delete flows remain behaviorally unchanged. |
| W2-BIND-006 | Preserve current HTTP status semantics: `400 bad_request` for invalid payloads, `404 not_found` for missing ApiService or binding, `409 conflict` for DB uniqueness conflicts, `405 method_not_allowed` for unsupported methods. | Yes | Tests confirm no status regression. |
| W2-BIND-007 | Normalize Zod failures through one deterministic `bad_request` adapter path and do not expose raw Zod issue arrays in client responses. | Yes | Invalid-payload tests assert normalized response shape. |
| W2-BIND-008 | Do not import frontend runtime code or create shared DTO extraction for this wave. | Yes | Imports remain backend-local. |
| W2-BIND-009 | Do not widen the change to `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, `public-handlers.ts`, or `projects-handlers.ts`. | Yes | Final diff shows no edits in those files. |
| W2-BIND-010 | Use the current binding payload field set only: optional `id`, required `toolKey`, required `stepKey`, optional `workflowStepType`, optional `bindingStatus`, optional `requiredness`. Do not invent new binding request fields in this wave. | Yes | No request-surface expansion in diff or tests. |

### Binding Handler Test Checklist

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-BIND-T-001 | Preserve the existing test `admin api-service bindings list returns deterministic binding payload`. | Yes | Test remains present and passing. |
| W2-BIND-T-002 | Preserve the existing test `admin api-service bindings upsert returns 404 when api service is missing`. | Yes | Test remains present and passing. |
| W2-BIND-T-003 | Preserve the existing test `admin api-service bindings upsert maps unique DB conflict to 409`. | Yes | Test remains present and passing. |
| W2-BIND-T-004 | Add invalid-payload tests for missing `toolKey` and missing `stepKey`. | Yes | Explicit assertions return `400 bad_request`. |
| W2-BIND-T-005 | Add invalid-payload tests for unsupported `workflowStepType` and verify only `acquisition` is accepted. | Yes | Explicit assertion returns `400 bad_request`. |
| W2-BIND-T-006 | Add invalid-payload tests for unsupported `bindingStatus` values outside `active` and `inactive`. | Yes | Explicit assertion returns `400 bad_request`. |
| W2-BIND-T-007 | Add invalid-payload tests for unsupported `requiredness` values outside `always-required`, `required-by-tool-setting`, and `optional-by-tool-setting`. | Yes | Explicit assertion returns `400 bad_request`. |
| W2-BIND-T-008 | Add one success-path upsert test for a valid binding payload so the migration proves `200` response behavior, returned binding shape, and unchanged serialized fields. | Yes | Test asserts `binding.id`, `apiServiceId`, `toolKey`, `stepKey`, `workflowStepType`, `bindingStatus`, and `requiredness`. |
| W2-BIND-T-009 | Assert that invalid-payload tests do not expose raw Zod issue arrays or stack traces in the response body. | Yes | Response-body assertions confirm normalized error envelope. |

### Binding Handler Validation Gates

| Check | Action | Blocking | Evidence Required |
|------|--------|----------|-------------------|
| W2-BIND-V-001 | Run `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`. | Yes | Exit code 0. |
| W2-BIND-V-002 | Run backend typecheck: `npm --workspace apps/backend run typecheck` if available, otherwise `npm run typecheck`. | Yes | Exit code 0. |
| W2-BIND-V-003 | Run `npm --workspace apps/backend run test`. | Yes | Exit code 0. |
| W2-BIND-V-004 | Run dependency-determinism commands only if dependency manifests changed in this wave. Expected default for this handler wave: `not required`. | Conditional | Either all required commands exit 0, or execution note records `not required`. |
| W2-BIND-V-005 | Run grep gate on `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` to confirm the active request-boundary path no longer uses `parseJsonBody<Record<string, unknown>>` or manual field extraction as the typed source of truth. | Yes | Grep output proves legacy path is gone or inactive in upsert flow. |
| W2-BIND-V-006 | Confirm `validateToolStepBindingInput(...)` still executes after schema parse. | Yes | Diff or targeted assertion proves validator remains active. |
| W2-BIND-V-007 | Confirm no out-of-scope auth-http handler files changed. | Yes | Final diff excludes `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, `public-handlers.ts`, and `projects-handlers.ts`. |

### Binding Handler Completion Criteria

- **W2-BIND-CC-001**: `handleAdminApiServiceBindingsUpsert` uses Zod parse output as the authoritative typed request-body source.
- **W2-BIND-CC-002**: Existing list, 404-upsert, and 409-upsert tests remain green.
- **W2-BIND-CC-003**: Invalid-payload coverage exists for missing required keys and invalid enum-like fields.
- **W2-BIND-CC-004**: A valid upsert success-path test proves unchanged `200` response behavior and binding payload serialization.
- **W2-BIND-CC-005**: Client-visible invalid-payload responses remain normalized to `400 bad_request` without raw Zod diagnostics.
- **W2-BIND-CC-006**: No unrelated auth-http handler file is modified in the same wave.
- **W2-BIND-CC-007**: The residual queue is updated after validation succeeds, removing `admin-api-service-binding-handlers.ts` from the pending set.

## Phase 3 Execution Notes

### Residual Wave 2 Queue

The pilot `admin-api-service-handlers.ts` is removed from the residual set because its create/update request boundary now parses raw `unknown` bodies through backend-owned Zod schemas before business validation. The remaining queue is ordered using the required criteria in this exact precedence: existing backend test coverage, amount of duplicated parse logic, security sensitivity of payload fields, then FE/BE drift risk.

| Priority | Handler | Current Request-Boundary State | Existing Backend Test Coverage | Ranking Rationale |
|------|--------|-------------------------------|-------------------------------|-------------------|
| 1 | `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` | Still uses `parseJsonBody<Record<string, unknown>>` in binding upsert plus manual extraction of `toolKey`, `stepKey`, `workflowStepType`, `bindingStatus`, `requiredness`, and optional `id`. | Strongest focused anchor in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` plus adapter and validation coverage in `runtime.api-service-adapter.test.ts` and `runtime.api-service-validation.test.ts`. | Highest confidence next slice: narrow surface, direct auth-http tests already exist, duplicated parse logic is localized, and FE/BE drift risk is high because binding semantics must stay aligned with tool-step configuration. |
| 2 | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` | Still uses typed `parseJsonBody<CreateProjectRequestBody>` followed by manual field extraction for project create. | Broad auth-http coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts`, including route-level method enforcement and authenticated `/api/projects` flows. | Coverage is stronger than the remaining candidates. Parse duplication is low but the route is security-sensitive because it persists user-scoped project state, and FE/BE drift risk exists around project creation semantics. |
| 3 | `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` | Still uses typed `parseJsonBody<...>` plus manual normalization across changelog create, user-report update, and GitHub-issue publish flows. | Medium auth-http coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` through feedback-center end-to-end scenarios. | More duplicated manual parse logic than `projects-handlers.ts` and higher admin/security sensitivity because it mutates report state and can publish GitHub issues. It ranks after projects because the current test anchor is broader and less handler-focused. |
| 4 | `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` | Still uses typed `parseJsonBody<CreateUserReportRequestBody>` followed by manual extraction for public user-report creation. | Existing auth-http coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for `/api/user-reports` and `/api/changelog` flows. | The body surface is simpler than feedback-center and projects, with lower duplicated parse logic. Security sensitivity is moderate because it accepts user input, but FE/BE drift risk is lower than the admin surfaces above. |
| 5 | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | Still uses `parseJsonBody<Record<string, unknown>>` in create/update with repeated inline guards for `key`, `label`, `status`, `sortOrder`, and `isDefault`. | No direct auth-http test anchor was located during the Phase 3 grep review; follow-up work should establish or identify the narrowest handler test before migration. | Despite duplicated parse logic and admin FE/BE drift risk, this handler is last because the required ordering gives priority to existing backend test coverage. It should not move ahead of better-covered candidates until a focused test anchor exists. |

### Explicit Wave 1 Non-Goals

- No implementation changes were made to the residual queue files `admin-api-service-binding-handlers.ts`, `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, `public-handlers.ts`, or `projects-handlers.ts` during Wave 1.
- No shared-schema extraction into `packages/contracts`, `packages/domain`, or frontend runtime files was performed during Wave 1.
- No frontend source file edits are part of Wave 1; frontend files remain semantic references only.
- No route-surface expansion, route registration changes, or new auth-http endpoints are part of Wave 1.
- No monorepo-wide handler migration was attempted; Wave 1 remains limited to the backend dependency, one shared Zod support module, the `admin-api-service` pilot, and its focused validations.

## Phase 4 Execution Notes

### AdminApiService FE/BE Alignment Matrix

This matrix records the deterministic alignment for the Wave 1 pilot only. The frontend form remains the semantic reference for user-input rules, while the backend keeps runtime ownership of request-body parsing and normalization.

| Shared Field | UI Field Shape | Frontend Parse Helper / Constraint | Backend Request Field | Backend Zod Constraint | Backend Normalization / Business Authority |
|------|----------------|------------------------------------|-----------------------|------------------------|--------------------------------------------|
| `key` | string | `adminApiServiceFormSchema`: `z.string().min(1)` | `key` | `nonEmptyTrimmedString('key')` | `validateApiServiceInput(...)` enforces canonical key regex and length |
| `label` | string | `adminApiServiceFormSchema`: `z.string().min(1)` | `label` | `nonEmptyTrimmedString('label')` | `validateApiServiceInput(...)` enforces final label length bounds |
| `baseUrl` | string | `adminApiServiceFormSchema`: `z.string().min(1)` | `baseUrl` | `nonEmptyTrimmedString('baseUrl')` | `validateApiServiceInput(...)` remains final URL/business validator |
| `resourcePath` | string | `adminApiServiceFormSchema`: `z.string().min(1)` | `resourcePath` | `nonEmptyTrimmedString('resourcePath')` | `validateApiServiceInput(...)` remains final path/business validator |
| `accessMode` | enum string | `z.enum(['public', 'token'])` | `accessMode` | `apiServiceAccessModeSchema` via `enumValue(['public', 'token'], 'accessMode')` | Backend/domain value set remains `ApiServiceAccessMode` |
| `requestMethod` | enum string | `z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])` | `requestMethod` | `apiServiceRequestMethodSchema`; create defaults to `GET` | Backend/domain value set remains `ApiServiceRequestMethod` |
| `status` | enum string | `z.enum(['active', 'inactive'])` | `status` | `apiServiceStatusSchema`; create defaults to `active` | Backend/domain value set remains `ApiServiceStatus` |
| `tokenHeaderName` | optional string | field refine against header regex; empty string allowed in UI | `tokenHeaderName` | `tokenHeaderNameSchema` or `null` | `normalizeTokenHeaderName(...)` is final authority for empty-to-null normalization |
| `timeoutMs` | optional numeric string | `parseTimeoutMs(...)` after schema refine `100..120000` | `timeoutMs` | `boundedInteger('timeoutMs', 100, 120000)` | Backend Zod owns numeric runtime range; `validateApiServiceInput(...)` still checks business coherence |
| `retryCount` | optional numeric string | `parseRetryCount(...)` after schema refine `0..5` | `retryCount` | `boundedInteger('retryCount', 0, 5)` | Backend Zod owns numeric runtime range; `validateApiServiceInput(...)` still checks business coherence |
| `contractProfileVersion` | optional numeric string | `parsePositiveInteger(...)` after schema refine `>= 1` | `contractProfileVersion` | `boundedInteger('contractProfileVersion', 1, Number.MAX_SAFE_INTEGER)`; create defaults to `1` | Backend request schema owns runtime integer/default semantics |
| `requestTemplateJson` | JSON string | `stringJson(...)` + `parseJsonRecord(...)` | `requestTemplateJson` | `objectPayload('requestTemplateJson')`; create defaults to `{}` | Backend keeps runtime object-shape authority |
| `requestMappingRulesJson` | JSON string | `stringJson(...)` + `parseJsonArray(...)` | `requestMappingRulesJson` | `arrayPayload('requestMappingRulesJson')`; create defaults to `[]` | Backend request parse owns array shape; downstream rule semantics remain backend-owned |
| `requestHeadersTemplateJson` | JSON string | `stringJson(...)` + `parseJsonRecord(...)` | `requestHeadersTemplateJson` | `objectPayload('requestHeadersTemplateJson')`; create defaults to `{}` | Backend keeps runtime object-shape authority |
| `responseMappingRulesJson` | JSON string | `stringJson(...)` + `parseJsonArray(...)` | `responseMappingRulesJson` | `arrayPayload('responseMappingRulesJson')`; create defaults to `[]` | Backend request parse owns array shape; downstream rule semantics remain backend-owned |
| `errorMappingRulesJson` | JSON string | `stringJson(...)` + `parseJsonArray(...)` | `errorMappingRulesJson` | `arrayPayload('errorMappingRulesJson')`; create defaults to `[]` | Backend request parse owns array shape; downstream rule semantics remain backend-owned |
| `tokenRef` | backend-only nullable string in current runtime contract | no frontend admin form constraint in the current pilot file | `tokenRef` | `nonEmptyTrimmedString('tokenRef')` or `null` | `validateApiServiceInput(...)` remains the final business validator when provided |

### packages/contracts Non-Change Decision

- Wave 1 does not require edits to `packages/contracts`.
- The backend pilot typechecks and passes targeted tests with backend-local request schemas, so there is no compiler or runtime blocker forcing shared contract changes.
- `packages/contracts/src/api-service.ts` already models shared DTO and command types for transport-level parity, but the new runtime parser implementation is intentionally backend-owned and should not be promoted to shared code in Wave 1.
- Follow-up only: if a later wave needs FE/BE compile-time convergence on admin ApiService transport commands, evaluate reusing `CreateApiServiceCommand` and `UpdateApiServiceCommand` more directly without moving runtime parser logic out of backend.

### Enum-Authority Note And Technical Debt

- The canonical backend/domain value sets for the pilot remain `ApiServiceAccessMode`, `ApiServiceStatus`, and `ApiServiceRequestMethod` in `apps/backend/src/lib/types/api-service.ts`.
- `packages/contracts/src/api-service.ts` mirrors the same value sets for shared transport DTOs, which is acceptable and unchanged in Wave 1.
- The unavoidable duplication still present is in `apps/frontend/src/features/admin/runtime/admin-client.ts`, which locally redeclares the same ApiService literal unions instead of importing them from `@gen-app-2/contracts`.
- The backend request schemas also repeat the literal values inside Zod enum helpers. This is acceptable for Wave 1 because the parser remains backend-owned, but it is technical debt for Wave 2+: consider extracting backend schema literals from one backend-local constant source, and separately decide whether the frontend admin client should import the shared contract unions instead of redeclaring them.

## Phase 5 Execution Notes

### Validation Matrix Completion

- `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` now covers the full minimum invalid-payload matrix for the pilot endpoints, including: invalid `accessMode`, invalid `status`, invalid `requestMethod`, malformed `requestTemplateJson`, malformed `requestMappingRulesJson`, malformed `requestHeadersTemplateJson`, malformed `responseMappingRulesJson`, malformed `errorMappingRulesJson`, invalid `tokenHeaderName`, `timeoutMs` below and above bounds, `retryCount` below and above bounds, and `contractProfileVersion < 1`.
- Targeted pilot file execution passed with `22/22` tests green.

### Command Gates Executed

- Focused pilot test gate passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`.
- Backend typecheck gate passed: `npm --workspace apps/backend run typecheck`.
- Backend workspace test gate passed: `npm --workspace apps/backend run test` (`230/230` tests green).
- Dependency determinism sequence passed in order:
	- `npm install --workspaces --include-workspace-root`
	- `npm ci`
	- `npm ci --workspaces --include-workspace-root`
	- `npm --workspace apps/frontend run build`

### Final Grep Gate

- Final grep on `apps/backend/src/lib/runtime/auth-http/*.ts` confirms no remaining `parseJsonBody<Record<string, unknown>>` usage in `admin-api-service-handlers.ts`.
- Remaining manual parse call sites are currently limited to:
	- `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts`
	- `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts`

## Wave 2 Execution Notes

### Implemented Scope

- Migrated `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` request-boundary parsing for `handleAdminApiServiceBindingsUpsert` from manual `Record<string, unknown>` extraction to backend-local Zod parsing (`unknown` -> schema -> typed body).
- Preserved `validateToolStepBindingInput(...)` as post-parse business validator.
- Preserved list/delete control flow and all existing response-envelope/status semantics.
- Added binding-focused tests in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` for:
	- valid upsert success-path payload shape
	- missing `toolKey`
	- missing `stepKey`
	- invalid `workflowStepType`
	- invalid `bindingStatus`
	- invalid `requiredness`
	- normalized error envelope assertions without raw Zod issue arrays.

### Wave 2 Binding Gates

- W2-BIND-V-001 passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` (`28/28` pass).
- W2-BIND-V-002 passed: `npm --workspace apps/backend run typecheck`.
- W2-BIND-V-003 passed: `npm --workspace apps/backend run test` (`236/236` pass).
- W2-BIND-V-004: dependency-determinism sequence `not required` for this wave because no dependency manifest changed.
- W2-BIND-V-005 passed: grep confirms `admin-api-service-binding-handlers.ts` no longer uses `parseJsonBody<Record<string, unknown>>` or prior manual extraction branches.
- W2-BIND-V-006 passed: `validateToolStepBindingInput(...)` remains in active flow after schema parse.
- W2-BIND-V-007 passed: no out-of-scope auth-http handler files were modified in this wave.

### Residual Queue After Wave 2

`admin-api-service-binding-handlers.ts` is removed from pending queue. Next deterministic order:

| Priority | Pending Handler | Current Request-Boundary State | Existing Backend Test Coverage | Rationale |
|------|------------------|-------------------------------|-------------------------------|-----------|
| 1 | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` | typed `parseJsonBody<CreateProjectRequestBody>` + manual extraction | broad `runtime.auth-http.test.ts` coverage on `/api/projects` | strongest remaining coverage with meaningful FE/BE drift risk |
| 2 | `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` | typed `parseJsonBody<...>` + manual normalization across admin mutations | medium `runtime.auth-http.test.ts` feedback-center coverage | high admin/security sensitivity with broader but less focused tests |
| 3 | `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` | typed `parseJsonBody<CreateUserReportRequestBody>` + manual extraction | existing public flow coverage in `runtime.auth-http.test.ts` | lower parse complexity and lower drift risk than admin surfaces |
| 4 | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | manual `parseJsonBody<Record<string, unknown>>` + repeated inline guards | no direct auth-http test anchor identified | remains last until focused test anchor is established |

## Wave 3 Execution Notes

### Implemented Scope

- Migrated `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` request-boundary parsing for `handleProjectsCreate` from typed manual extraction (`CreateProjectRequestBody`) to backend-local Zod parsing (`unknown` -> schema -> typed body).
- Preserved existing route/method/session/project create behavior and status semantics for `handleProjectsList`, `handleProjectById`, artifact list/detail/download handlers.
- Added/updated focused invalid project-create coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for:
	- missing required `name` field (`400 bad_request`)
	- malformed JSON body (`400 bad_request` with unchanged `Invalid JSON body` message)

### Wave 3 Projects Gates

- W3-PROJ-V-001 passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts` (`34/34` pass).
- W3-PROJ-V-002 passed: `npm --workspace apps/backend run typecheck`.
- W3-PROJ-V-003 passed: `npm --workspace apps/backend run test` (`236/236` pass).
- W3-PROJ-V-004: dependency-determinism sequence `not required` for this wave because no dependency manifest changed.
- W3-PROJ-V-005 passed: grep confirms `projects-handlers.ts` no longer uses `parseJsonBody<Record<string, unknown>>` or legacy manual `name` extraction as typed source of truth.
- W3-PROJ-V-006 passed: create-project semantics remain bounded to `400 bad_request` request-validation failures and existing route-level method enforcement.
- W3-PROJ-V-007 passed: no out-of-scope auth-http handler files were modified in this wave.

### Residual Queue After Wave 3

`projects-handlers.ts` is removed from pending queue. Next deterministic order:

| Priority | Pending Handler | Current Request-Boundary State | Existing Backend Test Coverage | Rationale |
|------|------------------|-------------------------------|-------------------------------|-----------|
| 1 | `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` | typed `parseJsonBody<...>` + manual normalization across admin mutations | medium `runtime.auth-http.test.ts` feedback-center coverage | highest remaining security sensitivity with existing auth-http anchor |
| 2 | `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` | typed `parseJsonBody<CreateUserReportRequestBody>` + manual extraction | existing public flow coverage in `runtime.auth-http.test.ts` | lower parse complexity than admin-feedback but still user-input boundary |
| 3 | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | manual `parseJsonBody<Record<string, unknown>>` + repeated inline guards | no direct auth-http test anchor identified | remains last until focused test anchor is established |

## Wave 4 Execution Notes

### Implemented Scope

- Migrated `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` request-boundary parsing for body-based admin endpoints from typed/manual extraction to backend-local Zod parsing (`unknown` -> schema -> typed body):
	- `handleAdminCreateChangelog`
	- `handleAdminUpdateUserReport`
	- `handleAdminPublishUserReportIssue`
- Preserved business-validation and policy authority after schema parse, including:
	- `normalizeProductChangelogStatus(...)`
	- `normalizeUserReportStatus(...)`
	- `canPublishUserReportIssue(...)`
- Preserved list/archive method/status semantics and existing publish-issue integration control flow.
- Added focused invalid-payload coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for:
	- changelog create with missing `title` (`400 bad_request`)
	- user-report patch with malformed JSON body (`400 bad_request`, message `Invalid JSON body`)

### Wave 4 Feedback-Center Gates

- W4-FEEDBACK-V-001 passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts` (`34/34` pass).
- W4-FEEDBACK-V-002 passed: `npm --workspace apps/backend run typecheck`.
- W4-FEEDBACK-V-003 passed: `npm --workspace apps/backend run test` (`236/236` pass).
- W4-FEEDBACK-V-004: dependency-determinism sequence `not required` for this wave because no dependency manifest changed.
- W4-FEEDBACK-V-005 passed: grep confirms `admin-feedback-center-handlers.ts` no longer uses legacy typed body parse entrypoints (`parseJsonBody<AdminCreateChangelogRequestBody>`, `parseJsonBody<AdminUpdateUserReportRequestBody>`, `parseJsonBody<AdminPublishUserReportIssueRequestBody>`).
- W4-FEEDBACK-V-006 passed: user-report/changelog state-transition semantics remain unchanged after schema parse.
- W4-FEEDBACK-V-007 passed: no out-of-scope auth-http handler files were modified in this wave.

### Residual Queue After Wave 4

`admin-feedback-center-handlers.ts` is removed from pending queue. Next deterministic order:

| Priority | Pending Handler | Current Request-Boundary State | Existing Backend Test Coverage | Rationale |
|------|------------------|-------------------------------|-------------------------------|-----------|
| 1 | `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` | typed `parseJsonBody<CreateUserReportRequestBody>` + manual extraction | existing public flow coverage in `runtime.auth-http.test.ts` | next strongest anchored surface with user-input request boundary |
| 2 | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | manual `parseJsonBody<Record<string, unknown>>` + repeated inline guards | no direct auth-http test anchor identified | remains last until focused test anchor is established |

## Wave 5 Execution Notes

### Implemented Scope

- Migrated `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` request-boundary parsing for `handleCreateUserReport` from typed/manual extraction (`CreateUserReportRequestBody`) to backend-local Zod parsing (`unknown` -> schema -> typed body).
- Preserved post-parse business-validation authority and existing semantics for:
	- `normalizeUserReportCategory(...)`
	- required-field checks for `category`, `title`, and `description`
	- unchanged response envelope/status semantics for create/list handlers.
- Added focused invalid-payload coverage in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` for:
	- report create with missing `title` (`400 bad_request`, message `title is required`)
	- report create with malformed JSON body (`400 bad_request`, message `Invalid JSON body`)

### Wave 5 Public-Handlers Gates

- W5-PUBLIC-V-001 passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts` (`34/34` pass).
- W5-PUBLIC-V-002 passed: `npm --workspace apps/backend run typecheck`.
- W5-PUBLIC-V-003 passed: `npm --workspace apps/backend run test` (`236/236` pass).
- W5-PUBLIC-V-004: dependency-determinism sequence `not required` for this wave because no dependency manifest changed.
- W5-PUBLIC-V-005 passed: grep confirms `public-handlers.ts` no longer uses legacy typed/manual request-body parse entrypoints for `handleCreateUserReport` (`parseJsonBody<CreateUserReportRequestBody>`).
- W5-PUBLIC-V-006 passed: `normalizeUserReportCategory(...)` and existing required-field validation semantics remain unchanged after schema parse.
- W5-PUBLIC-V-007 passed: wave-local diff includes only the intended handler/test/plan files for this wave.

### Residual Queue After Wave 5

`public-handlers.ts` is removed from pending queue. Next deterministic order:

| Priority | Pending Handler | Current Request-Boundary State | Existing Backend Test Coverage | Rationale |
|------|------------------|-------------------------------|-------------------------------|-----------|
| 1 | `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` | manual `parseJsonBody<Record<string, unknown>>` + repeated inline guards | no direct auth-http test anchor identified | final remaining auth-http body-boundary surface; execute after selecting/anchoring focused tests |

## Wave 6 Execution Notes

### Implemented Scope

- Migrated `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` request-boundary parsing for:
	- `handleAdminModelsCreate`
	- `handleAdminModelsUpdate`
  from manual `Record<string, unknown>` extraction to backend-local Zod parsing (`unknown` -> schema -> typed body).
- Preserved existing admin/session/db guard flow and downstream persistence semantics for `createModel(...)` and `updateModel(...)`.
- Added a new focused backend anchor test file `apps/backend/src/lib/tests/runtime.admin-llm-model-auth-http.test.ts` because this surface had no pre-existing narrow runtime test anchor.
- Expanded focused payload coverage to include:
	- valid create payload through the new Zod boundary
	- invalid create `key`
	- invalid create `label`
	- invalid create `status`
	- malformed create JSON body
	- valid update payload through the new Zod boundary
	- invalid update `key`
	- invalid update `label`
	- invalid update `status`
	- invalid update `isDefault`
	- invalid update `sortOrder`
	- malformed update JSON body

### Wave 6 Admin LLM Gates

- W6-LLM-V-001 passed: `node --import tsx --test apps/backend/src/lib/tests/runtime.admin-llm-model-auth-http.test.ts` (`12/12` pass).
- W6-LLM-V-002 passed: `npm --workspace apps/backend run typecheck`.
- W6-LLM-V-003 passed: `npm --workspace apps/backend run test` (`248/248` pass).
- W6-LLM-V-004: dependency-determinism sequence `not required` for this wave because no dependency manifest changed.
- W6-LLM-V-005 passed: grep confirms `admin-llm-model-handlers.ts` no longer uses legacy manual request-body parse entrypoints (`parseJsonBody<Record<string, unknown>>`, `let body: Record<string, unknown>`).
- W6-LLM-V-006 passed: existing `bad_request`, `not_found`, and method-guard envelope semantics remain unchanged after schema parse, with explicit focused assertions for both create and update success/error paths.
- W6-LLM-V-007 passed: wave-local implementation is limited to the intended handler/test/plan files; repository status also contains earlier-wave files already modified in the working tree and left untouched by this wave.

### Residual Queue After Wave 6

Wave 6 removes the final queued auth-http manual request-boundary surface. The residual queue is now empty.


## 3. Alternatives

- **ALT-001**: Reuse frontend Zod schemas directly in backend runtime by importing `apps/frontend/src/features/admin/runtime/*.ts`. Rejected because it creates cross-layer coupling, imports UI string-field assumptions into backend HTTP parsing, and violates backend authority for runtime request validation.
- **ALT-002**: Keep current backend manual parsing and only add more helper functions around `Record<string, unknown>`. Rejected because it preserves the documented duplication problem and does not create a typed schema-driven request boundary.
- **ALT-003**: Introduce Zod everywhere in backend auth-http in one monolithic refactor. Rejected because it increases risk, makes regression isolation harder, and violates the Wave-1-only scope.
- **ALT-004**: Move all validation authority to `packages/contracts` immediately. Rejected because runtime schemas are not the same thing as shared DTO contracts and would create premature coupling across FE, BE, and packages.

## 4. Dependencies

- **DEP-001**: `docs/02-design/specifications/dependency-unification-proposal.md` as the authoritative proposal recommending backend-first Zod adoption.
- **DEP-002**: Existing frontend Zod baseline in `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` as the only frontend semantic reference required by Wave 1.
- **DEP-003**: Existing backend pilot handler `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`.
- **DEP-004**: Existing backend raw parsing support in `apps/backend/src/lib/runtime/auth-http/support.ts`.
- **DEP-005**: Existing backend normalization and business validation helpers in `apps/backend/src/lib/runtime/integrations/api-service-validation.ts`.
- **DEP-006**: Existing backend tests in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` and adjacent auth-http runtime tests.
- **DEP-007**: Workspace dependency and lockfile governance in `AGENTS.md` and `.github/instructions/dominio-ddd-first-workspace.instructions.md`.

## 5. Files

- **FILE-001**: `apps/backend/package.json` - add backend `zod` dependency.
- **FILE-002**: `package-lock.json` - regenerated through npm after dependency change.
- **FILE-003**: `apps/frontend/package-lock.json` - regenerated through npm if workspace graph changes require synchronization.
- **FILE-004**: `apps/backend/src/lib/runtime/auth-http/zod-support.ts` - only new backend Zod helper module allowed in Wave 1.
- **FILE-005**: `apps/backend/src/lib/runtime/auth-http/support.ts` - legacy raw JSON boundary retained as non-validation raw reader.
- **FILE-006**: `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` - only runtime pilot handler changed in Wave 1.
- **FILE-007**: `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` - existing business-rule validation authority reused after schema parse.
- **FILE-008**: `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` - pilot regression and invalid-payload coverage.
- **FILE-009**: `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` - semantic reference for FE/BE constraint alignment.
- **FILE-010**: `docs/02-design/specifications/dependency-unification-proposal.md` - proposal source this plan operationalizes.
- **FILE-011**: `apps/backend/src/lib/runtime/auth-http/admin-api-service-binding-handlers.ts` - Wave 2 queue candidate only, not modified in Wave 1.
- **FILE-012**: `apps/backend/src/lib/runtime/auth-http/admin-llm-model-handlers.ts` - Wave 2 queue candidate only, not modified in Wave 1.
- **FILE-013**: `apps/backend/src/lib/runtime/auth-http/admin-feedback-center-handlers.ts` - Wave 2 queue candidate only, not modified in Wave 1.
- **FILE-014**: `apps/backend/src/lib/runtime/auth-http/public-handlers.ts` - Wave 2 queue candidate only, not modified in Wave 1.

## 6. Testing

- **TEST-001**: Verify backend auth-http create, update, list, and redacted response behavior for ApiService still passes in `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`.
- **TEST-002**: Add invalid-payload tests for admin ApiService create/update covering exactly the Wave-1 minimum matrix from TASK-016: invalid `accessMode`, invalid `status`, invalid `requestMethod`, malformed `requestTemplateJson`, malformed `requestMappingRulesJson`, malformed `requestHeadersTemplateJson`, malformed `responseMappingRulesJson`, malformed `errorMappingRulesJson`, invalid `tokenHeaderName`, `timeoutMs` below minimum, `timeoutMs` above maximum, `retryCount` below minimum, `retryCount` above maximum, and `contractProfileVersion` less than 1.
- **TEST-003**: Assert that invalid-payload tests continue to return `400` and `bad_request` for the pilot endpoints without exposing raw Zod issue arrays or stack traces.
- **TEST-004**: Run the pilot test file first, then backend typecheck, then backend test suite for the touched slice.
- **TEST-005**: Run workspace dependency-determinism commands after the dependency change.
- **TEST-006**: Run a grep-based audit for remaining `parseJsonBody<Record<string, unknown>>` call sites in `apps/backend/src/lib/runtime/auth-http/**` and record the residual queue.
- **TEST-007**: Verify that no Wave-1-out-of-scope files among `admin-api-service-binding-handlers.ts`, `admin-llm-model-handlers.ts`, `admin-feedback-center-handlers.ts`, and `public-handlers.ts` are modified.

## 7. Risks & Assumptions

- **RISK-001**: Zod error formatting may accidentally change user-visible backend error messages if the issue-to-envelope adapter is too generic.
- **RISK-002**: Frontend and backend may appear aligned while still validating different payload shapes because frontend forms submit strings and backend endpoints consume already-parsed JSON values.
- **RISK-003**: Mixed validation styles will temporarily coexist across auth-http because Wave 1 migrates only the pilot cluster; the residual queue must stay explicit to avoid accidental partial rollout.
- **RISK-004**: Dependency changes can desynchronize workspace lockfiles if npm install and npm ci are not run in the required sequence.
- **RISK-005**: Even a narrow pilot can silently change error-text expectations in tests if the Zod issue adapter is not normalized deliberately.
- **ASSUMPTION-001**: `admin-api-service` remains the highest-value pilot because it already has frontend Zod semantics, backend manual parsing duplication, and dedicated auth-http tests.
- **ASSUMPTION-002**: Existing backend business validators such as `validateApiServiceInput(...)` remain valuable after Zod adoption and should not be deleted in the pilot phase.
- **ASSUMPTION-003**: Shared contract promotion is only needed for stable DTOs, not for runtime parser implementation.
- **ASSUMPTION-004**: Wave 2 will be planned separately only after Wave 1 passes all blocking validation gates and the pilot FE/BE alignment matrix is complete.

## 8. Related Specifications / Further Reading

[docs/02-design/specifications/dependency-unification-proposal.md](../docs/02-design/specifications/dependency-unification-proposal.md)
[docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md)
[docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md)
[AGENTS.md](../AGENTS.md)
[plan/feature-api-service-backend-contract-1.md](./feature-api-service-backend-contract-1.md)