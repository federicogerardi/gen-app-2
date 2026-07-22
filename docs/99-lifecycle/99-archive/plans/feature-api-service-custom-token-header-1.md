---
goal: Backward-compatible custom token header support for ApiService acquisition (Authorization default, tokenHeaderName override)
version: 1.1
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-05-24
last_updated: 2026-05-24
owner: Backend Platform + Frontend Platform
status: completed
tags: [feature, backend, frontend, contracts, api-service, acquisition, security, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan defines a deterministic BE+FE+contracts+test implementation to support custom token header injection for ApiService token-mode acquisition. The runtime default remains `Authorization: Bearer <token>` and can be overridden by profile field `tokenHeaderName` (example: `X-API-Key`) without breaking existing services.

## Execution Status

- Execution completed on 2026-05-24 across Phases 0-4.
- All listed implementation tasks (TASK-001..TASK-024) are completed.
- Deterministic validation gates passed: backend typecheck/tests, frontend typecheck/targeted tests, workspace typecheck, backend XState runtime gate.

## 1. Requirements & Constraints

- **REQ-001**: Preserve backward compatibility for all existing token-mode ApiServices that currently rely on `Authorization: Bearer`.
- **REQ-002**: Introduce a deterministic override field `tokenHeaderName` in ApiService request contract profile with strict validation.
- **REQ-003**: Keep `tokenRef` and `tokenCiphertext` as the only secret source; do not expose secret values in FE payloads.
- **REQ-004**: Ensure adapter injects token value into header selected by policy: default `Authorization`, override `tokenHeaderName` when valid.
- **REQ-005**: Keep existing `requestHeadersTemplateJson` merge behavior and define deterministic precedence between template headers and token injection.
- **REQ-006**: Surface `tokenHeaderName` in admin FE create/edit flows and persist through backend admin handlers.
- **REQ-007**: Extend shared contracts in `packages/contracts/src/api-service.ts` so BE/FE remain type-aligned.
- **REQ-008**: Add/extend tests for all paths: default header, custom header, invalid header name, missing tokenRef in token mode.
- **XST-001**: Preserve strict XState v5 typing boundaries for acquisition actor invocation and output handling (`generation-system.actors.ts` -> `executeApiAcquisition`).
- **XST-002**: Keep machine-facing actor contracts free from untyped widening (`any`) and avoid legacy v4 patterns.
- **SEC-001**: Never return `tokenCiphertext` from any HTTP response.
- **SEC-002**: Validate `tokenHeaderName` with a strict header-name regex and reject invalid values.
- **SEC-003**: Forbid ambiguous duplicate token placement. Runtime must inject token exactly once.
- **CON-001**: Do not change DDD canonical ownership: outbound token-bearing calls remain backend-owned (`ApiServiceAccessMode = token`).
- **CON-002**: Keep migration and contract changes additive only.
- **CON-003**: Do not change existing endpoint paths or route capability names.
- **GUD-001**: DDD-first gate: if `tokenHeaderName` is not yet canonicalized in DDD docs, register decision-log entry before code propagation.
- **PAT-001**: Reuse existing ApiService validation/redaction pattern in `apps/backend/src/lib/runtime/integrations/api-service-validation.ts`.
- **PAT-002**: Reuse existing profile-driven request envelope path in `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts`.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-001: Canonicalize terminology and unblock implementation under DDD-first policy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add DDD decision-log entry in `docs/07-governance/domain-naming-decision-log.md` defining `tokenHeaderName` as ApiService request-profile field for token-mode header override, with default `Authorization`. | yes | 2026-05-24 |
| TASK-002 | Update `docs/01-requirements/domain-ubiquitous-language-glossary.md` to include `tokenHeaderName` in `ApiService`/request profile terminology (status and scope explicitly declared). | yes | 2026-05-24 |
| TASK-003 | Update `docs/02-design/domain-bounded-context-map.md` integration constraints with deterministic precedence and ownership for token-header override behavior. | yes | 2026-05-24 |

### Implementation Phase 1

- GOAL-002: Extend persistence and shared contracts with additive `tokenHeaderName` support.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Add migration `packages/infra-db/migrations/20260524_000013_api_service_token_header_name.sql` to extend `api_services` with nullable `token_header_name VARCHAR(128)` and CHECK constraint for valid HTTP header-name format. | yes | 2026-05-24 |
| TASK-005 | Extend `packages/contracts/src/api-service.ts` request profile types (`ApiServiceRequestContractProfile`, `ApiServiceDto`, create/update command types) with optional `tokenHeaderName?: string | null`. | yes | 2026-05-24 |
| TASK-006 | Extend backend model mapping in `apps/backend/src/lib/types/api-service.ts` and adapter IO in `apps/backend/src/lib/adapters/api-service.adapter.ts` to persist/read `tokenHeaderName`. | yes | 2026-05-24 |

### Implementation Phase 2

- GOAL-003: Implement backend runtime policy for token injection with safe precedence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Update `apps/backend/src/lib/runtime/integrations/api-service-validation.ts` with `tokenHeaderName` validation rule (header-name regex), plus normalization rule (trim, preserve case). | yes | 2026-05-24 |
| TASK-008 | Update admin handlers in `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts` to parse, validate, and persist `tokenHeaderName` in create/update flows. | yes | 2026-05-24 |
| TASK-009 | Update `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts` in `executeApiAcquisition` to inject token using policy: (a) if `accessMode=token` and `tokenHeaderName` set -> set `headers[tokenHeaderName]=tokenCiphertext`; (b) else set `headers.authorization='Bearer '+tokenCiphertext`. | yes | 2026-05-24 |
| TASK-010 | Define deterministic precedence in adapter: token injection overrides same-name key from `requestHeadersTemplateJson`; all other template headers remain unchanged. | yes | 2026-05-24 |
| TASK-011 | Update `apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts` resolve contract payload to include `tokenHeaderName` in `requestContractProfile` (redacted, no secrets). | yes | 2026-05-24 |

### Implementation Phase 3

- GOAL-004: Extend frontend admin configuration flows to author and edit `tokenHeaderName`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Extend FE admin client types in `apps/frontend/src/features/admin/runtime/admin-client.ts` for `tokenHeaderName` in `ApiService`, `CreateAdminApiServiceInput`, `UpdateAdminApiServiceInput`, and parsing logic. | yes | 2026-05-24 |
| TASK-013 | Extend FE form schema in `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts` to include `tokenHeaderName` field with validation (empty or valid header-name). | yes | 2026-05-24 |
| TASK-014 | Update FE admin page payload mapping in `apps/frontend/src/features/admin/pages/AdminApiServicesPage.tsx` (`toCreateInput`, `toUpdateInput`) to send `tokenHeaderName`. | yes | 2026-05-24 |
| TASK-015 | Update admin create/edit UI in `apps/frontend/src/features/admin/ui/AdminApiServiceCreateForm.tsx` to render `tokenHeaderName` input and helper copy for examples (`Authorization`, `X-API-Key`). | yes | 2026-05-24 |
| TASK-016 | Update copy authority entries in `apps/frontend/src/app/copy/system.ts` for new admin field labels and helper text. | yes | 2026-05-24 |

### Implementation Phase 4

- GOAL-005: Add deterministic automated verification for compatibility and override behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Extend `apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts` with cases: default Bearer injection, custom `X-API-Key` injection, template collision override, invalid `tokenHeaderName` rejection path. | yes | 2026-05-24 |
| TASK-018 | Extend `apps/backend/src/lib/tests/runtime.api-service-validation.test.ts` for `tokenHeaderName` validation matrix (valid, invalid chars, empty/null semantics). | yes | 2026-05-24 |
| TASK-019 | Extend `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts` for admin create/update roundtrip with `tokenHeaderName`. | yes | 2026-05-24 |
| TASK-020 | Extend FE tests in `apps/frontend/src/features/admin/pages/AdminApiServicesPage.test.tsx` and `apps/frontend/src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx` for create/edit payload and field presence. | yes | 2026-05-24 |
| TASK-021 | Run backend checks: `npm --workspace apps/backend run typecheck`, `npm --workspace apps/backend run test`. | yes | 2026-05-24 |
| TASK-022 | Run frontend checks: `npm --workspace apps/frontend run typecheck`, `npm --workspace apps/frontend run test -- src/features/admin/pages/AdminApiServicesPage.test.tsx src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx`. | yes | 2026-05-24 |
| TASK-023 | Run workspace gate: `npm run typecheck`. | yes | 2026-05-24 |
| TASK-024 | Run strict XState compatibility gate on affected runtime path: `npm run test -- apps/backend/src/lib/tests/generation-system.runtime.test.ts` and verify `invokeApiAcquisition` event/output typing remains valid after token-header override changes. | yes | 2026-05-24 |

## 3. Alternatives

- **ALT-001**: Keep hardcoded Bearer-only behavior in adapter and instruct users to pass custom headers manually. Rejected because token-mode secrets would bypass canonical `tokenRef/tokenCiphertext` path and create drift.
- **ALT-002**: Encode token placeholder inside `requestHeadersTemplateJson` (for example `${TOKEN}`) and resolve dynamically. Rejected because it adds template language complexity and weakens deterministic validation.
- **ALT-003**: Add enum `authScheme` (`bearer`, `header`) instead of `tokenHeaderName`. Rejected because it still requires a custom header key and introduces redundant configuration dimensions.

## 4. Dependencies

- **DEP-001**: Existing ApiService schema baseline: `packages/infra-db/migrations/20260524_000011_api_service_catalog.sql` and `packages/infra-db/migrations/20260524_000012_api_service_contract_profiles.sql`.
- **DEP-002**: Shared contracts authority: `packages/contracts/src/api-service.ts`.
- **DEP-003**: Adapter persistence layer: `apps/backend/src/lib/adapters/api-service.adapter.ts`.
- **DEP-004**: Acquisition runtime adapter: `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts`.
- **DEP-005**: Backend admin HTTP handlers: `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`.
- **DEP-006**: FE admin client/form/page stack: `apps/frontend/src/features/admin/runtime/admin-client.ts`, `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts`, `apps/frontend/src/features/admin/pages/AdminApiServicesPage.tsx`, `apps/frontend/src/features/admin/ui/AdminApiServiceCreateForm.tsx`.
- **DEP-007**: DDD reference set updates in `docs/01-requirements/domain-ubiquitous-language-glossary.md`, `docs/02-design/domain-bounded-context-map.md`, `docs/07-governance/domain-naming-decision-log.md`.

## 5. Files

- **FILE-001**: `../../../99-lifecycle/99-archive/plans/feature-api-service-custom-token-header-1.md` (this plan)
- **FILE-002**: `packages/infra-db/migrations/20260524_000013_api_service_token_header_name.sql` (new)
- **FILE-003**: `packages/contracts/src/api-service.ts`
- **FILE-004**: `apps/backend/src/lib/types/api-service.ts`
- **FILE-005**: `apps/backend/src/lib/adapters/api-service.adapter.ts`
- **FILE-006**: `apps/backend/src/lib/runtime/integrations/api-service-validation.ts`
- **FILE-007**: `apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts`
- **FILE-008**: `apps/backend/src/lib/runtime/auth-http/admin-api-service-handlers.ts`
- **FILE-009**: `apps/backend/src/lib/runtime/auth-http/tools-api-service-handlers.ts`
- **FILE-010**: `apps/backend/src/lib/tests/runtime.api-acquisition.adapter.test.ts`
- **FILE-011**: `apps/backend/src/lib/tests/runtime.api-service-validation.test.ts`
- **FILE-012**: `apps/backend/src/lib/tests/runtime.api-service-auth-http.test.ts`
- **FILE-013**: `apps/frontend/src/features/admin/runtime/admin-client.ts`
- **FILE-014**: `apps/frontend/src/features/admin/runtime/admin-api-service-form.ts`
- **FILE-015**: `apps/frontend/src/features/admin/pages/AdminApiServicesPage.tsx`
- **FILE-016**: `apps/frontend/src/features/admin/ui/AdminApiServiceCreateForm.tsx`
- **FILE-017**: `apps/frontend/src/features/admin/pages/AdminApiServicesPage.test.tsx`
- **FILE-018**: `apps/frontend/src/features/admin/pages/AdminRoutesA11ySmoke.test.tsx`
- **FILE-019**: `apps/frontend/src/app/copy/system.ts`
- **FILE-020**: `docs/07-governance/domain-naming-decision-log.md`
- **FILE-021**: `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- **FILE-022**: `docs/02-design/domain-bounded-context-map.md`
- **FILE-023**: `apps/backend/src/lib/machines/generation-system.actors.ts`
- **FILE-024**: `apps/backend/src/lib/tests/generation-system.runtime.test.ts`

## 6. Testing

- **TEST-001**: Adapter default path test: token mode without override emits `Authorization: Bearer <token>`.
- **TEST-002**: Adapter override path test: token mode with `tokenHeaderName='X-API-Key'` emits `X-API-Key: <token>` and no Bearer header.
- **TEST-003**: Header precedence test: if template defines same key, runtime-injected token value wins deterministically.
- **TEST-004**: Validation test: reject invalid `tokenHeaderName` values (spaces, separators, empty after trim).
- **TEST-005**: Admin HTTP test: create/update/read roundtrip includes `tokenHeaderName` in redacted contract profile.
- **TEST-006**: FE form validation test for new field and payload serialization into create/update commands.
- **TEST-007**: Workspace typecheck/test commands listed in TASK-021, TASK-022, TASK-023 complete with zero regressions.
- **TEST-008**: XState strict typing regression test: acquisition actor invocation path compiles and executes with typed output in `generation-system.runtime.test.ts`.

## 7. Risks & Assumptions

- **RISK-001**: Header normalization/case handling may cause duplicate logical headers if not canonicalized in one path.
- **RISK-002**: Existing token-mode services could break if default Bearer branch is altered instead of preserved.
- **RISK-003**: FE/BE contract drift if `tokenHeaderName` is added only on one layer.
- **RISK-004**: Migration ordering issues if new migration is applied before contract-aware code in CI sequence.
- **ASSUMPTION-001**: `tokenCiphertext` currently stores usable token plaintext/cipher payload for outbound header usage as in existing Bearer path.
- **ASSUMPTION-002**: Admin users configuring token-mode services can provide a valid header name when endpoint requires non-Bearer tokens.
- **ASSUMPTION-003**: No runtime consumer depends on absence of `tokenHeaderName` field in response schemas.

## 8. Related Specifications / Further Reading

- docs/07-governance/domain-naming-decision-log.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- ../../../99-lifecycle/99-archive/plans/feature-api-service-backend-contract-1.md
- apps/backend/src/lib/runtime/integrations/api-acquisition.adapter.ts
- apps/backend/src/lib/runtime/integrations/api-service-validation.ts
- packages/contracts/src/api-service.ts
