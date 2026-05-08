---
goal: LLM Model Catalog — Admin CRUD + Frontend Model Selector
version: 1.0
date_created: 2026-05-08
last_updated: 2026-05-08
owner: Domain Architecture
status: 'Planned'
tags: feature, architecture, migration, admin
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Introduce a database-managed `LlmModelCatalog` that replaces the current free-text `<input>` for model selection with a constrained `LlmModelSelector` `<select>` populated from `GET /api/models`. Administrators can manage the catalog (enable/disable/create/delete entries) via a dedicated admin CRUD panel. The canonical domain terms are established in DDD-053..DDD-057.

## 1. Requirements & Constraints

- **REQ-001**: The `llm_models` table must persist `LlmModel` entities with fields: `id` (UUID PK), `key` (`LlmModelId`, unique), `label` (display name), `status` (`LlmModelStatus`: `enabled` | `disabled`), `sort_order` (int, nullable), `created_at`, `updated_at`.
- **REQ-002**: `GET /api/models` must return only `enabled` entries ordered by `sort_order ASC, created_at ASC`, accessible to all authenticated users.
- **REQ-003**: Admin CRUD endpoints (`GET/POST/PUT/DELETE /api/admin/models`) must be role-gated to `AuthUserRole = 'admin'`; return `403` for non-admin requests.
- **REQ-004**: `GenerationRequest.model` must carry an `LlmModelId` value (the `key` field of an `LlmModel`); the backend must validate it against the `enabled` catalog entries in the existing `modelCheck` state of `requestGatewayMachine` (already scaffolded with `MODEL_AVAILABLE`/`MODEL_UNAVAILABLE` events and `model_unavailable` failure reason). Unknown or disabled model keys must cause request rejection via the `MODEL_UNAVAILABLE` → `failed` transition.
- **REQ-005**: The Frontend `LlmModelSelector` (`<select>`) must replace the free-text `<input>` in `ToolFormComponents.tsx` and `ToolPageTemplate.tsx`; it must be pre-populated by consuming `GET /api/models`.
- **REQ-006**: Default fallback `LlmModelId` is `openrouter/auto` (DDD-046); applied when the catalog endpoint is unavailable or returns an empty list.
- **REQ-007**: `AdminModelsPage.tsx` must be completed: remove hardcoded fallback models and `backendEndpointPending` banner; wire to `GET /api/admin/models`.
- **SEC-001**: Admin write endpoints (`POST/PUT/DELETE /api/admin/models`) must verify `AuthUserRole = 'admin'` from `AuthSessionPrincipal` before executing any DB operation; return `403` on failure.
- **SEC-002**: `LlmModelId` values must be validated server-side against a length limit (max 128 chars) and a safe character set (`[a-zA-Z0-9/_\-.]`) to prevent injection.
- **CON-001**: `GenerationRequest.model: string` in `packages/contracts/src/index.ts` remains a `string` type for backward compatibility; JSDoc must be updated to document it as `LlmModelId`.
- **CON-002**: Existing `Artifact` records that reference a now-disabled model must remain readable; `disabled` status does not retroactively invalidate artifact history.
- **CON-003**: The `AdminModelsPage.tsx` page and `/admin/models` route already exist; no new routing is required.
- **GUD-001**: All new TypeScript types must use canonical DDD terms: `LlmModel`, `LlmModelStatus`, `LlmModelId`, `LlmModelCatalog` (service layer), `LlmModelSelector` (FE component term).
- **GUD-002**: New DB migration file must follow the naming convention `YYYYMMDD_NNNNNN_<slug>.sql` in `packages/infra-db/migrations/`.
- **PAT-001**: `AdminModelsPage.tsx` must use the existing `Surface`, `uiPrimitives`, and `appCopy` conventions already present in the file.
- **PAT-002**: Backend endpoint handlers must follow the pattern established in `apps/backend/src/lib/runtime/auth-http.ts` (auth middleware → role check → adapter call).

## 2. Implementation Steps

### Implementation Phase 1 — Database Schema

- GOAL-001: Create the `llm_models` table and seed initial model entries.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create migration file `packages/infra-db/migrations/20260508_000005_llm_model_catalog.sql`. Table DDL: `CREATE TABLE llm_models (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key VARCHAR(128) UNIQUE NOT NULL, label VARCHAR(256) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'enabled', sort_order INT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());` Add constraint: `CHECK (status IN ('enabled', 'disabled'))`. Add index: `CREATE INDEX idx_llm_models_status ON llm_models(status)`. | | |
| TASK-002 | Create seed file `packages/infra-db/seeds/20260508_000002_llm_models.sql` (suffix `000002` — `000001` already used by `20260424_000001_minimal_users_projects.sql`) with initial entries: `('openrouter/auto', 'OpenRouter Auto', 'enabled', 1)`, `('gpt-4.1-mini', 'GPT-4.1 Mini', 'enabled', 2)`, `('claude-3.7-sonnet', 'Claude 3.7 Sonnet', 'disabled', 3)`. | | |

### Implementation Phase 2 — Backend Types and Adapter

- GOAL-002: Define `LlmModel` TypeScript types and implement the DB adapter for catalog queries and CRUD operations.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-003 | Create `apps/backend/src/lib/types/llm-model.ts`. Export: `export type LlmModelStatus = 'enabled' \| 'disabled';` `export type LlmModel = { id: string; key: string; label: string; status: LlmModelStatus; sortOrder: number \| null; createdAt: Date; updatedAt: Date; };` `export type LlmModelRow = { id: string; key: string; label: string; status: string; sort_order: number \| null; created_at: Date; updated_at: Date; };` `export const rowToLlmModel = (row: LlmModelRow): LlmModel => ({ id: row.id, key: row.key, label: row.label, status: row.status as LlmModelStatus, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at });` | | |
| TASK-004 | Create `apps/backend/src/lib/adapters/llm-model.adapter.ts`. Implement and export: `listEnabledModels(db: Pool): Promise<LlmModel[]>` — `SELECT * FROM llm_models WHERE status = 'enabled' ORDER BY sort_order ASC NULLS LAST, created_at ASC`; `listAllModels(db: Pool): Promise<LlmModel[]>` — no status filter, same ordering; `createModel(db: Pool, payload: { key: string; label: string; status?: LlmModelStatus; sortOrder?: number }): Promise<LlmModel>`; `updateModel(db: Pool, id: string, payload: Partial<{ key: string; label: string; status: LlmModelStatus; sortOrder: number }>): Promise<LlmModel \| null>`; `deleteModel(db: Pool, id: string): Promise<boolean>`. | | |

### Implementation Phase 3 — Backend Endpoints

- GOAL-003: Wire `LlmModelCatalog` endpoints in `apps/backend/src/lib/runtime/auth-http.ts`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add `GET /api/models` endpoint in `auth-http.ts`. Handler: authenticate request → call `listEnabledModels(db)` → return `200` with `{ models: LlmModel[] }`. No admin role required. | | |
| TASK-006 | Add `GET /api/admin/models` endpoint. Handler: authenticate → verify `principal.role === 'admin'` (else `403`) → call `listAllModels(db)` → return `200` with `{ models: LlmModel[] }`. | | |
| TASK-007 | Add `POST /api/admin/models` endpoint. Handler: authenticate → verify admin role → validate body `{ key: string (max 128 chars, regex /^[a-zA-Z0-9\/_\-.]+$/), label: string (max 256 chars), status?: 'enabled'\|'disabled', sortOrder?: number }` (return `400` on validation failure) → call `createModel(db, payload)` → return `201` with created `LlmModel`. | | |
| TASK-008 | Add `PUT /api/admin/models/:id` endpoint. Handler: authenticate → verify admin role → validate body (same field rules as POST, all fields optional) → call `updateModel(db, id, payload)` → return `200` with updated `LlmModel` or `404` if not found. | | |
| TASK-009 | Add `DELETE /api/admin/models/:id` endpoint. Handler: authenticate → verify admin role → call `deleteModel(db, id)` → return `204` on success or `404` if not found. | | |
| TASK-010 | In `apps/backend/src/lib/runtime/auth-http.ts` (or the actor that drives `requestGatewayMachine`), implement the model availability check that already has scaffolded states in the machine (`modelCheck` state with `MODEL_AVAILABLE` / `MODEL_UNAVAILABLE` transitions, riga 142 in `request-gateway.machine.ts`). The check must: call `listEnabledModels(db)`, look up `request.model` in the returned key set, and emit `MODEL_AVAILABLE` if found or `MODEL_UNAVAILABLE` if not found or disabled. When `MODEL_UNAVAILABLE` fires, the machine sets `failureReason = 'model_unavailable'` (existing action). Do NOT add new states — only implement the dispatch logic that triggers the existing events. | | |

### Implementation Phase 4 — Frontend API Client and Query

- GOAL-004: Add a typed client function and a React query hook for consuming `GET /api/models`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create `apps/frontend/src/features/tools/runtime/models-client.ts`. Export: `export type LlmModelOption = { key: string; label: string; };` `export const listEnabledModels = async (options: { apiBaseUrl: string; capabilities: BackendCapabilities }): Promise<LlmModelOption[]>` — if `options.capabilities.models === false` return `[]` immediately (capability gate, mirrors pattern in `session-client.ts`). Otherwise `GET ${options.apiBaseUrl}/api/models` with credentials, parse `json.models`, map to `{ key, label }`. On fetch error return `[]`. | | |
| TASK-012 | Create `apps/frontend/src/app/runtime/queries/useModelsQuery.ts`. Export `useModelsQuery(options: { apiBaseUrl: string; capabilities: BackendCapabilities; enabled?: boolean })` using the **same custom hook pattern** as `useSessionsQuery.ts` (`useEffect`+`useState`+`useCallback`, NOT React Query). Returns `{ data: LlmModelOption[]; loading: boolean; error: string \| null; reload: () => void }`. Calls `listEnabledModels({ apiBaseUrl, capabilities })`. When `enabled === false`, set `data=[]`, `loading=false`, `error=null` immediately (mirrors `useSessionsQuery` pattern). | | |

### Implementation Phase 5 — Frontend UI Components

- GOAL-005: Replace free-text `<input>` for model with `LlmModelSelector` `<select>` in the tool form; update `AdminModelsPage` to use live data.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | In `apps/frontend/src/features/tools/ui/ToolFormComponents.tsx`, locate the model `<input>` at line ~96. Replace with `<select value={model} onChange={e => onModelChange(e.target.value)} disabled={disabled}>`. Accept a new prop `modelOptions: LlmModelOption[]` and render `modelOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)`. Add a disabled placeholder option when `modelOptions` is empty. | | |
| TASK-014 | In `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`, locate model `<input>` at line ~85. Replace with the updated `ToolFormComponents` model selector. Pass `modelOptions` from `useModelsQuery()` result. Keep `formState.model` default value as `openrouter/auto` (REQ-006). | | |
| TASK-015 | In `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx`: remove `fallbackModels` constant and `useState(fallbackModels)`. Add `useAdminModelsQuery()` (new hook, calls `GET /api/admin/models`). Replace static list with query result. Remove `backendEndpointPending` error banner. Add inline `enabled`/`disabled` toggle button wiring to `PUT /api/admin/models/:id` (optimistic update). Add a "New model" form with `key`, `label`, `status` fields wiring to `POST /api/admin/models`. Add delete button wiring to `DELETE /api/admin/models/:id`. | | |

### Implementation Phase 6 — JSDoc and Contract Update

- GOAL-006: Document `LlmModelId` contract in shared types without breaking backward compatibility.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | In `packages/contracts/src/index.ts`, update TWO locations: (1) JSDoc block comment at line ~57 — change `- model: LLM model identifier` to `- model: LlmModelId — must match the key of an enabled LlmModel in the LlmModelCatalog. Default: 'openrouter/auto'. See DDD-056.`; (2) inline comment above `model: string;` at line 76 — add `// LlmModelId — see DDD-056`. Type remains `string` (CON-001). | | |

## 3. Alternatives

- **ALT-001**: Store model catalog in a config file (e.g., `llm-models.json`) rather than the database. Rejected: config files cannot be updated at runtime without a deployment; the admin CRUD requirement mandates DB persistence.
- **ALT-002**: Validate `GenerationRequest.model` against a hardcoded enum in the backend. Rejected: hardcoded enums require a code deploy to add/remove models; catalog in DB enables zero-deploy updates.
- **ALT-003**: Reuse the `BackendCapabilities` / `ApiPaths` mechanism already in the FE (feature flags) to gate model selector. Rejected: `BackendCapabilities` flags runtime feature availability, not catalog data; mixing the two would conflate concerns.

## 4. Dependencies

- **DEP-001**: `packages/infra-db` migrations runner — required to apply TASK-001 migration before TASK-004..010 can be exercised at runtime.
- **DEP-002**: PostgreSQL `gen_random_uuid()` function (available via `pgcrypto` or PG 13+) — required for TASK-001 `id` default.
- **DEP-003**: Custom async hook pattern (`useEffect` + `useState` + `useCallback`) — the frontend does NOT use `@tanstack/react-query`. TASK-012 must follow the identical pattern used in `useSessionsQuery.ts` (manual `setLoading`/`setData`/`setError` + `reload` token).
- **DEP-004**: `AuthSessionPrincipal.role` — required for admin role gate in TASK-006..009; already resolved by `auth-http.ts` middleware.

## 5. Files

- **FILE-001**: `packages/infra-db/migrations/20260508_000005_llm_model_catalog.sql` — new migration (TASK-001)
- **FILE-002**: `packages/infra-db/seeds/20260508_000002_llm_models.sql` — new seed (TASK-002)
- **FILE-003**: `apps/backend/src/lib/types/llm-model.ts` — new types file (TASK-003)
- **FILE-004**: `apps/backend/src/lib/adapters/llm-model.adapter.ts` — new adapter (TASK-004)
- **FILE-005**: `apps/backend/src/lib/runtime/auth-http.ts` — add 5 endpoint handlers (TASK-005..009); add model validation call (TASK-010)
- **FILE-006**: `apps/frontend/src/features/tools/runtime/models-client.ts` — new client (TASK-011); depends on `BackendCapabilities` import from `apps/frontend/src/app/runtime/backend-capabilities.ts`
- **FILE-007**: `apps/frontend/src/app/runtime/queries/useModelsQuery.ts` — new query hook (TASK-012)
- **FILE-008**: `apps/frontend/src/features/tools/ui/ToolFormComponents.tsx` — replace model `<input>` (TASK-013)
- **FILE-009**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — wire `LlmModelSelector` (TASK-014)
- **FILE-010**: `apps/frontend/src/features/admin/pages/AdminModelsPage.tsx` — complete with live data and admin CRUD (TASK-015)
- **FILE-011**: `packages/contracts/src/index.ts` — JSDoc update (TASK-016)

## 6. Testing

- **TEST-001**: Unit test `llm-model.adapter.ts`: `listEnabledModels` returns only `enabled` rows; `listAllModels` returns all rows; `createModel` inserts and returns correct shape; `updateModel` returns `null` for missing id; `deleteModel` returns `false` for missing id.
- **TEST-002**: Integration test `GET /api/models`: returns `200` with enabled models for authenticated user; returns only `enabled` subset when catalog contains mixed statuses.
- **TEST-003**: Integration test `POST /api/admin/models`: returns `201` for admin; returns `403` for non-admin; returns `400` for invalid `key` (special chars outside allowed set); returns `400` for `key` > 128 chars.
- **TEST-004**: Integration test `PUT /api/admin/models/:id`: returns `200` on valid update; returns `404` for non-existent id; returns `403` for non-admin.
- **TEST-005**: Integration test `DELETE /api/admin/models/:id`: returns `204` on success; returns `404` for missing id; returns `403` for non-admin.
- **TEST-006**: Unit test `requestGatewayMachine` model validation: `GenerationRequest` with a `disabled` or unknown model key causes `MODEL_UNAVAILABLE` event → machine transitions to `failed` with `failureReason = 'model_unavailable'`; request with a valid `enabled` key causes `MODEL_AVAILABLE` event → machine proceeds to `usageCheck` state.
- **TEST-007**: Unit test `models-client.ts` `listEnabledModels`: returns `[]` on network error; correctly maps API response `{ models: [...] }` to `LlmModelOption[]`.
- **TEST-008**: React component test `ToolFormComponents`: model field renders `<select>` with options when `modelOptions` is non-empty; renders disabled placeholder when `modelOptions` is `[]`; calls `onModelChange` with correct key on selection.
- **TEST-009**: React component test `AdminModelsPage`: renders list from query result (not hardcoded fallback); toggle button calls `PUT /api/admin/models/:id` with toggled status; new model form calls `POST /api/admin/models` with form values; delete button calls `DELETE /api/admin/models/:id`.

## 7. Risks & Assumptions

- **RISK-001**: Existing `GenerationRequest` submissions from cached or older frontend versions may send free-form model strings. The backend validation added in TASK-010 will reject them via the existing `MODEL_UNAVAILABLE` → `failed` path in `requestGatewayMachine`. Mitigation: ensure `openrouter/auto` is always present as an `enabled` entry in the catalog (TASK-002 seed). Also: consider a grace period where `VITE_CAP_MODELS=false` keeps the FE sending `openrouter/auto` until the catalog is fully deployed.
- **RISK-002**: `requestGatewayMachine` validation in TASK-010 requires a DB read per request for model validation, adding latency. Mitigation: use a short-lived in-memory cache (TTL 60s) for the enabled model key set within the gateway.
- **RISK-003**: The `AdminModelsPage.tsx` admin CRUD form (TASK-015) is the first admin write form in the frontend. If the admin auth middleware pattern is inconsistent with `auth-http.ts`, role checks may not propagate correctly. Mitigation: use the same `AuthSessionPrincipal.role` extraction pattern already used in all existing admin-gated endpoints.
- **ASSUMPTION-001**: PostgreSQL 13+ is available in all deployment targets (Railway), providing `gen_random_uuid()` natively without requiring `pgcrypto` extension.
- **ASSUMPTION-002**: The existing `packages/infra-db/scripts/run-sql-dir.ts` migration runner can be used to apply the new migration file without modification.
- **ASSUMPTION-003**: The frontend uses a custom async hook pattern (not React Query). `useModelsQuery` must follow the same `useEffect`+`useState` structure as `useSessionsQuery.ts`, accepting `apiBaseUrl` and `capabilities: BackendCapabilities` as options and returning `{ data, loading, error, reload }`.

## 8. Related Specifications / Further Reading

- [docs/01-requirements/domain-ubiquitous-language-glossary.md](../docs/01-requirements/domain-ubiquitous-language-glossary.md) — `LlmModel`, `LlmModelStatus`, `LlmModelCatalog`, `LlmModelId`, `LlmModelSelector` (DDD-053..057)
- [docs/07-governance/domain-naming-decision-log.md](../docs/07-governance/domain-naming-decision-log.md) — DDD-053, DDD-054, DDD-055, DDD-056, DDD-057
- [docs/02-design/domain-bounded-context-map.md](../docs/02-design/domain-bounded-context-map.md) — `LlmModelCatalog → LlmModelSelector` translation rule; admin CRUD role-gate constraint
- [apps/frontend/src/features/admin/pages/AdminModelsPage.tsx](../apps/frontend/src/features/admin/pages/AdminModelsPage.tsx) — existing stub with hardcoded fallback (starting point for TASK-015)
- [packages/contracts/src/index.ts](../packages/contracts/src/index.ts) — `GenerationRequest.model` field (TASK-016)
