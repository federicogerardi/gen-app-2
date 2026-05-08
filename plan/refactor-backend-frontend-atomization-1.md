---
goal: Refactor Monolithic Backend and Frontend Files Through Deterministic Atomization and Shared Normalizers
version: 1.0
date_created: 2026-05-08
last_updated: 2026-05-08
owner: Platform Engineering
status: Planned
tags: [refactor, architecture, ddd, backend, frontend, deduplication]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines a deterministic refactor to split oversized files, remove duplicated normalization logic, and consolidate unused UI flow implementations without changing runtime behavior or domain terminology.

## 1. Requirements & Constraints

- **REQ-001**: Preserve all existing HTTP routes and status code semantics currently dispatched in `apps/backend/src/lib/runtime/auth-http.ts` (routing block starts at line 1940).
- **REQ-002**: Preserve all existing XState event names, context fields, and transitions in `apps/backend/src/lib/machines/generation-system.machine.ts` and `apps/frontend/src/features/tools/machines/tool-page.machine.ts`.
- **REQ-003**: Preserve all canonical domain terms defined in DDD references (`ToolKey`, `ToolWorkflow`, `ExtractionContext`, `ReadinessSnapshot`, `ToolStep`).
- **REQ-004**: Keep external module public APIs stable by introducing barrel exports when files are split.
- **SEC-001**: Do not weaken authentication/authorization checks in handlers currently using `requireAuthenticatedPrincipal` and `requireAdminPrincipal`.
- **SEC-002**: Keep request body size guard (`MAX_BODY_SIZE_BYTES`) and error serialization behavior unchanged.
- **API-001**: Do not change endpoint paths, query/body precedence rules, or payload contracts.
- **CON-001**: No functional feature additions are allowed in this refactor.
- **CON-002**: No database schema migration is allowed in this refactor.
- **CON-003**: Refactor must compile and pass workspace tests with existing scripts.
- **GUD-001**: Apply extraction-first atomization: move pure helpers first, then handlers/classes, then replace in-file references.
- **GUD-002**: For duplicated functions, create one shared implementation and make all call sites import it.
- **PAT-001**: Use one module per responsibility group: auth handlers, admin handlers, tool handlers, project handlers, shared HTTP utilities.
- **PAT-002**: Keep stubs and production adapters structurally parallel where repository interfaces are the same.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish shared normalization utilities and remove confirmed duplicates before large file splitting.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/backend/src/lib/runtime/http-utils.ts` exporting `normalizePath`, `writeJson`, and request header helpers extracted from `apps/backend/src/lib/runtime/node-server.ts` and `apps/backend/src/lib/runtime/auth-http.ts`. |  |  |
| TASK-002 | Replace local `normalizePath` definitions in `apps/backend/src/lib/runtime/auth-http.ts:136` and `apps/backend/src/lib/runtime/node-server.ts:51` with imports from `http-utils.ts`. |  |  |
| TASK-003 | Create `apps/backend/src/lib/runtime/workflow-normalizers.ts` exporting `normalizeToolWorkflowKey` and `normalizeStepKey` with existing alias behavior (`hl_funnel`, `funnel_pages`, `youtube_lf_script`, `thank-you`). |  |  |
| TASK-004 | Replace duplicated normalizers in `apps/backend/src/lib/machines/generation-system.machine.ts:496` and `apps/backend/src/lib/runtime/tool-prompts/index.ts:22` with imports from `workflow-normalizers.ts`. |  |  |
| TASK-005 | Add unit tests for `workflow-normalizers.ts` covering every alias and null/empty input branch. |  |  |

### Implementation Phase 2

- GOAL-002: Split `auth-http.ts` into deterministic handler modules while preserving route behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `apps/backend/src/lib/runtime/auth-http/http-utils.ts` for request parsing and response writers currently in `apps/backend/src/lib/runtime/auth-http.ts:136-385`. |  |  |
| TASK-007 | Create `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` containing `handleLogin`, `handleLogout`, `handleSession`, `handleGoogleOAuthStart`, `handleGoogleOAuthCallback`. |  |  |
| TASK-008 | Create `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` containing `handleProjectsList`, `handleProjectsCreate`, `handleProjectById`, `handleArtifactsList`, `handleArtifactById`. |  |  |
| TASK-009 | Create `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` containing `handleToolsBriefUpload`, `handleToolsHydrate`, `handleToolsOrchestrate`, `handleToolsSessionsList`, `handleToolsSessionArtifacts`, `handleToolsSessionStepArtifact`. |  |  |
| TASK-010 | Create `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` containing all admin model and admin user handlers (`handleAdminModels*`, `handleAdmin*User*`). |  |  |
| TASK-011 | Replace inline route dispatch in `apps/backend/src/lib/runtime/auth-http.ts:1940-2128` with imported handler map and path matchers; preserve exact path regex and method branching order. |  |  |
| TASK-012 | Add regression tests for selected routes: `/auth/login`, `/api/tools/hydrate`, `/api/admin/models`, `/admin/users/:id`. |  |  |

### Implementation Phase 3

- GOAL-003: Extract non-machine logic from `generation-system.machine.ts` and keep only orchestration concerns.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Create `apps/backend/src/lib/machines/generation/request-normalizers.ts` and move `toOptionalString`, `toStringArray`, `toStringRecord`, `normalizeValue`. |  |  |
| TASK-014 | Create `apps/backend/src/lib/machines/generation/extraction-parsers.ts` and move `normalizeYoutubeExtractionField`, `parseYoutubeExtractionMarkdown`, `parseExtractionContent`, `buildExtractionStructuredPayload`. |  |  |
| TASK-015 | Update `apps/backend/src/lib/machines/generation-system.machine.ts` to import new helpers and remove duplicate local definitions while preserving machine start at line 642 and all event wiring. |  |  |
| TASK-016 | Add parser-focused tests for markdown extraction field mapping and normalization fallback behavior for youtube tool payloads. |  |  |

### Implementation Phase 4

- GOAL-004: Split repository mega-files into one class per module with barrel exports.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Create `apps/backend/src/lib/adapters/postgres-redis/` directory and split six classes from `postgres-redis.production.ts` into separate files preserving constructor contracts and interface implementations. |  |  |
| TASK-018 | Create `apps/backend/src/lib/adapters/postgres-redis/index.ts` exporting factory functions and all class modules with backward-compatible named exports. |  |  |
| TASK-019 | Create `apps/backend/src/lib/adapters/auth/` directory and split `PostgresAuthUserRepository`, `PostgresAuthSessionRepository`, `PostgresOAuthStateRepository` from `auth.production.ts`. |  |  |
| TASK-020 | Apply the same split pattern to `postgres-redis.stub.ts` and `auth.stub.ts` to maintain production/stub structural parity. |  |  |
| TASK-021 | Update all imports in backend runtime and test files to consume new barrel exports; verify no direct old file imports remain using `rg`. |  |  |

### Implementation Phase 5

- GOAL-005: Remove duplicated frontend flow implementation and keep one canonical production component.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Verify no production import of `apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx` beyond self-definition and optional tests. |  |  |
| TASK-023 | Remove `ToolGenerationFlow.tsx` and related dead styles/classes not used by `ToolGenerationFlowVertical`. |  |  |
| TASK-024 | Update/retain `ToolGenerationFlowVertical` tests and `ToolPageTemplate` integration to ensure identical runtime UI behavior. |  |  |
| TASK-025 | Add static guard check in CI script or test to fail on reintroduction of duplicate flow component naming (`ToolGenerationFlow` and `ToolGenerationFlowVertical` both in production imports). |  |  |

### Implementation Phase 6

- GOAL-006: Validate refactor integrity and ship with deterministic acceptance evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Run `npm run typecheck` at repository root and capture success output in PR notes. |  |  |
| TASK-027 | Run `npm test` at repository root and capture pass/fail summary; if baseline failures exist, document unchanged baseline IDs. |  |  |
| TASK-028 | Run backend smoke tests: `npm run backend:go:smoke` and attach output summary. |  |  |
| TASK-029 | Run frontend build gate: `npm --workspace apps/frontend run frontend:test:ci` and attach output summary. |  |  |
| TASK-030 | Execute deterministic checks: (a) `wc -l` on target files below thresholds, (b) `rg` confirms single `normalizePath` and single `normalizeStepKey` implementation source. |  |  |

## 3. Alternatives

- **ALT-001**: Keep monolith files and add section comments only. Rejected because it does not reduce merge conflict surface or improve testability.
- **ALT-002**: Full rewrite of HTTP router to framework-based server. Rejected because it changes runtime architecture and violates CON-001.
- **ALT-003**: Split frontend and backend in one massive PR. Rejected because rollback and root-cause isolation become non-deterministic.

## 4. Dependencies

- **DEP-001**: Existing TypeScript + XState toolchain already present (`typescript`, `xstate`); no new package required.
- **DEP-002**: Existing workspace scripts in root `package.json`, `apps/backend/package.json`, and `apps/frontend/package.json` must remain executable.
- **DEP-003**: DDD canonical references must remain authoritative for naming: glossary, bounded context map, naming decision log.

## 5. Files

- **FILE-001**: `apps/backend/src/lib/runtime/auth-http.ts` — replace monolithic handlers and dispatch with modular imports.
- **FILE-002**: `apps/backend/src/lib/runtime/node-server.ts` — consume shared `normalizePath` utility.
- **FILE-003**: `apps/backend/src/lib/runtime/tool-prompts/index.ts` — consume shared workflow normalizers.
- **FILE-004**: `apps/backend/src/lib/runtime/http-utils.ts` — new shared HTTP utility module.
- **FILE-005**: `apps/backend/src/lib/runtime/workflow-normalizers.ts` — new shared workflow key/step normalizer module.
- **FILE-006**: `apps/backend/src/lib/machines/generation-system.machine.ts` — import extracted normalizers/parsers.
- **FILE-007**: `apps/backend/src/lib/machines/generation/request-normalizers.ts` — new helper module.
- **FILE-008**: `apps/backend/src/lib/machines/generation/extraction-parsers.ts` — new helper module.
- **FILE-009**: `apps/backend/src/lib/adapters/postgres-redis.production.ts` and `apps/backend/src/lib/adapters/postgres-redis.stub.ts` — split into directory modules.
- **FILE-010**: `apps/backend/src/lib/adapters/auth.production.ts` and `apps/backend/src/lib/adapters/auth.stub.ts` — split into directory modules.
- **FILE-011**: `apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx` — remove unused duplicate implementation.
- **FILE-012**: `apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx` and related tests — keep canonical production flow.

## 6. Testing

- **TEST-001**: Unit test `workflow-normalizers.ts` for all alias mappings: `hl_funnel`, `funnel_pages`, `youtube_lf_script`, `thank-you`, `thankyou`, invalid/null.
- **TEST-002**: Unit test extracted parser module for markdown headings and bullet conversion in youtube extraction parsing.
- **TEST-003**: Route regression tests for auth, tools hydrate, admin users, and admin models paths after handler split.
- **TEST-004**: Adapter smoke tests (`smoke:idempotency`, `smoke:conflict`, `smoke:queries`) after production/stub module split.
- **TEST-005**: Frontend integration test to confirm `ToolPageTemplate` renders `ToolGenerationFlowVertical` unchanged and artifact view action still works.
- **TEST-006**: Static checks with `rg` for duplicate normalizer definitions and duplicate flow component production imports.

## 7. Risks & Assumptions

- **RISK-001**: Circular import risk when introducing barrels for adapters and handlers.
- **RISK-002**: Silent behavior drift in routing if path/method matching order changes.
- **RISK-003**: Snapshot or selector regressions in frontend tests after removing duplicate flow component.
- **RISK-004**: False confidence if only typecheck passes and route-level tests are not executed.
- **ASSUMPTION-001**: Existing tests and smoke scripts are representative enough to detect behavioral regressions.
- **ASSUMPTION-002**: No external consumer imports internal source file paths directly outside current workspace.
- **ASSUMPTION-003**: Canonical DDD terms and aliases already documented are stable for this refactor window.

## 8. Related Specifications / Further Reading

[DDD Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)