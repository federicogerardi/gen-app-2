---
goal: Execution-Ready Refactor Plan for Backend and Frontend Atomization and Deduplication
version: 2.0
date_created: 2026-05-08
last_updated: 2026-05-08
owner: Platform Engineering
status: 'Planned'
tags: [refactor, architecture, backend, frontend, ddd, execution-ready]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This document is the execution-ready version of the atomization refactor. Every task contains exact commands and binary verification criteria to allow deterministic execution by AI agents or humans.

## 1. Requirements & Constraints

- **REQ-001**: Keep endpoint behavior unchanged for all paths currently routed in [apps/backend/src/lib/runtime/auth-http.ts](../apps/backend/src/lib/runtime/auth-http.ts#L1940).
- **REQ-002**: Keep XState behavior unchanged in [apps/backend/src/lib/machines/generation-system.machine.ts](../apps/backend/src/lib/machines/generation-system.machine.ts#L642) and [apps/frontend/src/features/tools/machines/tool-page.machine.ts](../apps/frontend/src/features/tools/machines/tool-page.machine.ts#L631).
- **REQ-003**: Preserve canonical DDD terms and aliases defined in glossary and naming log.
- **SEC-001**: Preserve admin/member auth gates and session checks.
- **SEC-002**: Preserve request-size guards and JSON error output shape.
- **API-001**: Preserve HTTP paths, methods, regex matching order, and payload contracts.
- **CON-001**: No feature additions.
- **CON-002**: No database migration.
- **CON-003**: All checks must pass using existing workspace scripts.
- **GUD-001**: Extract shared helpers before splitting handlers/classes.
- **GUD-002**: Replace duplicated implementations with one shared source.
- **PAT-001**: One module per responsibility group.
- **PAT-002**: Keep production/stub repository structure aligned.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Consolidate duplicated normalizers and HTTP utilities into shared modules.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-001 | Create [apps/backend/src/lib/runtime/http-utils.ts](../apps/backend/src/lib/runtime/http-utils.ts) with `normalizePath` and reusable HTTP helpers. Cmd: `test -f apps/backend/src/lib/runtime/http-utils.ts`. Verify: exit code `0`. |  |  |
| TASK-002 | Replace local `normalizePath` in [apps/backend/src/lib/runtime/auth-http.ts](../apps/backend/src/lib/runtime/auth-http.ts#L136) and [apps/backend/src/lib/runtime/node-server.ts](../apps/backend/src/lib/runtime/node-server.ts#L51) with imports. Cmd: `rg -n "const normalizePath" apps/backend/src/lib/runtime/auth-http.ts apps/backend/src/lib/runtime/node-server.ts`. Verify: zero matches. |  |  |
| TASK-003 | Create [apps/backend/src/lib/runtime/workflow-normalizers.ts](../apps/backend/src/lib/runtime/workflow-normalizers.ts) exporting `normalizeToolWorkflowKey` and `normalizeStepKey` with existing alias behavior. Cmd: `test -f apps/backend/src/lib/runtime/workflow-normalizers.ts`. Verify: exit code `0`. |  |  |
| TASK-004 | Replace duplicate normalizers in [apps/backend/src/lib/machines/generation-system.machine.ts](../apps/backend/src/lib/machines/generation-system.machine.ts#L496) and [apps/backend/src/lib/runtime/tool-prompts/index.ts](../apps/backend/src/lib/runtime/tool-prompts/index.ts#L22) with imports. Cmd: `test "$(rg -n "const normalizeStepKey|const normalizeToolWorkflowKey|const normalizeToolKey" apps/backend/src/lib/machines/generation-system.machine.ts apps/backend/src/lib/runtime/tool-prompts/index.ts | wc -l | tr -d ' ')" = "0"`. Verify: exit code `0`. |  |  |
| TASK-005 | Add unit tests for alias mapping and null/empty branches in backend tests folder. Cmd: `npm --workspace apps/backend run test`. Verify: test command exits with `0`. |  |  |

### Implementation Phase 2

- GOAL-002: Split auth HTTP monolith into deterministic handler modules without route drift.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-006 | Create folder [apps/backend/src/lib/runtime/auth-http](../apps/backend/src/lib/runtime/auth-http) and move generic request/response helpers into `http-utils.ts`. Cmd: `test -f apps/backend/src/lib/runtime/auth-http/http-utils.ts`. Verify: exit code `0`. |  |  |
| TASK-007 | Create `auth-handlers.ts` with login/session/oauth handlers. Cmd: `rg -n "handleLogin|handleLogout|handleSession|handleGoogleOAuthStart|handleGoogleOAuthCallback" apps/backend/src/lib/runtime/auth-http/auth-handlers.ts`. Verify: all 5 symbols found. |  |  |
| TASK-008 | Create `projects-handlers.ts` with projects and artifacts handlers. Cmd: `rg -n "handleProjectsList|handleProjectsCreate|handleProjectById|handleArtifactsList|handleArtifactById" apps/backend/src/lib/runtime/auth-http/projects-handlers.ts`. Verify: all symbols found. |  |  |
| TASK-009 | Create `tools-handlers.ts` with tools endpoints handlers. Cmd: `rg -n "handleToolsBriefUpload|handleToolsHydrate|handleToolsOrchestrate|handleToolsSessionsList|handleToolsSessionArtifacts|handleToolsSessionStepArtifact" apps/backend/src/lib/runtime/auth-http/tools-handlers.ts`. Verify: all symbols found. |  |  |
| TASK-010 | Create `admin-handlers.ts` with admin users/models handlers. Cmd: `rg -n "handleAdminModels|handleAdminListUsers|handleAdminCreateUser|handleAdminGetUser|handleAdminUpdateUser|handleAdminDeleteUser" apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`. Verify: all symbol groups found. |  |  |
| TASK-011 | Refactor [apps/backend/src/lib/runtime/auth-http.ts](../apps/backend/src/lib/runtime/auth-http.ts) to import and dispatch handlers preserving path/method order. Cmd: `npm --workspace apps/backend run typecheck`. Verify: exit code `0`. |  |  |
| TASK-012 | Add route regression tests for representative endpoints and enforce dispatch order for critical route checks in [apps/backend/src/lib/runtime/auth-http.ts](../apps/backend/src/lib/runtime/auth-http.ts). Cmd: `npm --workspace apps/backend run test && awk '/\/auth\/login/{a=NR}/\/api\/tools\/hydrate/{b=NR}/\/api\/tools\/orchestrate/{c=NR}/\/api\/tools\/sessions/{d=NR} END{exit !(a<b && b<c && c<d)}' apps/backend/src/lib/runtime/auth-http.ts`. Verify: exit code `0`. |  |  |

### Implementation Phase 3

- GOAL-003: Extract non-machine logic from generation system machine file.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-013 | Create [apps/backend/src/lib/machines/generation/request-normalizers.ts](../apps/backend/src/lib/machines/generation/request-normalizers.ts) with `toOptionalString`, `toStringArray`, `toStringRecord`, `normalizeValue`. Cmd: `test -f apps/backend/src/lib/machines/generation/request-normalizers.ts`. Verify: exit code `0`. |  |  |
| TASK-014 | Create [apps/backend/src/lib/machines/generation/extraction-parsers.ts](../apps/backend/src/lib/machines/generation/extraction-parsers.ts) with extraction parser helpers. Cmd: `test -f apps/backend/src/lib/machines/generation/extraction-parsers.ts`. Verify: exit code `0`. |  |  |
| TASK-015 | Update [apps/backend/src/lib/machines/generation-system.machine.ts](../apps/backend/src/lib/machines/generation-system.machine.ts) to import extracted helpers and remove local declarations. Cmd: `rg -n "const toOptionalString|const parseYoutubeExtractionMarkdown|const parseExtractionContent|const normalizeValue" apps/backend/src/lib/machines/generation-system.machine.ts`. Verify: zero local declarations. |  |  |
| TASK-016 | Add parser tests for markdown extraction normalization and youtube fields. Cmd: `npm --workspace apps/backend run test`. Verify: exit code `0`. |  |  |

### Implementation Phase 4

- GOAL-004: Split repository mega-files into per-class modules and preserve imports via barrels.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-017 | Split six classes from [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts) into `apps/backend/src/lib/adapters/postgres-redis/*.ts`. Cmd: `ls apps/backend/src/lib/adapters/postgres-redis/*.ts | wc -l`. Verify: count is `>= 7` (6 class files + barrel). |  |  |
| TASK-018 | Add barrel [apps/backend/src/lib/adapters/postgres-redis/index.ts](../apps/backend/src/lib/adapters/postgres-redis/index.ts) with backward-compatible exports. Cmd: `test -f apps/backend/src/lib/adapters/postgres-redis/index.ts`. Verify: exit code `0`. |  |  |
| TASK-019 | Split three classes from [apps/backend/src/lib/adapters/auth.production.ts](../apps/backend/src/lib/adapters/auth.production.ts) into `apps/backend/src/lib/adapters/auth/*.ts`. Cmd: `ls apps/backend/src/lib/adapters/auth/*.ts | wc -l`. Verify: count is `>= 4` (3 class files + barrel). |  |  |
| TASK-020 | Apply same split pattern to stubs and keep old files as shim-only wrappers. Cmd: `test "$(wc -l < apps/backend/src/lib/adapters/postgres-redis.stub.ts | tr -d ' ')" -le "30" && test "$(wc -l < apps/backend/src/lib/adapters/auth.stub.ts | tr -d ' ')" -le "30" && test "$(rg -n "^export class" apps/backend/src/lib/adapters/postgres-redis.stub.ts apps/backend/src/lib/adapters/auth.stub.ts | wc -l | tr -d ' ')" = "0"`. Verify: exit code `0`. |  |  |
| TASK-021 | Update backend imports to use new barrels. Cmd: `rg -n "postgres-redis\.production|auth\.production|postgres-redis\.stub|auth\.stub" apps/backend/src`. Verify: no old direct imports outside compatibility shims. |  |  |

### Implementation Phase 5

- GOAL-005: Remove unused duplicated frontend flow implementation.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-022 | Confirm non-usage of [apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx](../apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx) in production imports. Cmd: `rg -n "ToolGenerationFlow" apps/frontend/src --glob '!**/*.test.tsx'`. Verify: no import usage except file self-reference and vertical component references. |  |  |
| TASK-023 | Remove duplicate file and dead styles linked only to removed component. Cmd: `test ! -f apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx`. Verify: exit code `0`. |  |  |
| TASK-024 | Keep [apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx](../apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx) behavior unchanged and passing tests. Cmd: `npm --workspace apps/frontend run test`. Verify: exit code `0`. |  |  |
| TASK-025 | Add static guard script in root scripts or CI step against duplicate production flow components. Cmd: `rg -n "ToolGenerationFlowVertical|ToolGenerationFlow" apps/frontend/src --glob '!**/*.test.tsx'`. Verify: only vertical component is used in production imports. |  |  |

### Implementation Phase 6

- GOAL-006: Execute deterministic acceptance gates and record machine-verifiable evidence.

| Task | Description | Completed | Date |
| -------- | -------- | -------- | -------- |
| TASK-026 | Run repository typecheck. Cmd: `npm run typecheck`. Verify: exit code `0`. |  |  |
| TASK-027 | Run repository tests. Cmd: `npm test`. Verify: exit code `0`. |  |  |
| TASK-028 | Run backend smoke suite. Cmd: `npm run backend:go:smoke`. Verify: exit code `0`. |  |  |
| TASK-029 | Run frontend CI gate. Cmd: `npm --workspace apps/frontend run frontend:test:ci`. Verify: exit code `0`. |  |  |
| TASK-030 | Verify target outcomes with numeric thresholds and duplicate-elimination checks. Cmd: `AUTH_HTTP_LINES=$(wc -l < apps/backend/src/lib/runtime/auth-http.ts | tr -d ' '); GEN_SYS_LINES=$(wc -l < apps/backend/src/lib/machines/generation-system.machine.ts | tr -d ' '); PR_PROD_LINES=$(wc -l < apps/backend/src/lib/adapters/postgres-redis.production.ts | tr -d ' '); test "$AUTH_HTTP_LINES" -le "900" && test "$GEN_SYS_LINES" -le "1000" && test "$PR_PROD_LINES" -le "250" && test "$(rg -n "const normalizePath" apps/backend/src/lib/runtime | wc -l | tr -d ' ')" = "0" && test "$(rg -n "const normalizeStepKey|const normalizeToolWorkflowKey|const normalizeToolKey" apps/backend/src/lib/runtime apps/backend/src/lib/machines | wc -l | tr -d ' ')" = "0"`. Verify: exit code `0`. |  |  |

## 3. Alternatives

- **ALT-001**: Keep all files monolithic and only add comments. Rejected because it does not reduce conflict surface or improve isolation.
- **ALT-002**: Rewrite server runtime with a new framework. Rejected because it changes behavior scope.
- **ALT-003**: Execute backend and frontend splits in a single atomic commit. Rejected because rollback and debugging become non-deterministic.

## 4. Dependencies

- **DEP-001**: Existing workspace scripts in [package.json](../package.json), [apps/backend/package.json](../apps/backend/package.json), and [apps/frontend/package.json](../apps/frontend/package.json).
- **DEP-002**: Existing TypeScript/XState toolchain; no new package dependency is required.
- **DEP-003**: Canonical DDD references must remain source of naming truth.

## 5. Files

- **FILE-001**: [apps/backend/src/lib/runtime/auth-http.ts](../apps/backend/src/lib/runtime/auth-http.ts) — dispatch composition refactor.
- **FILE-002**: [apps/backend/src/lib/runtime/node-server.ts](../apps/backend/src/lib/runtime/node-server.ts) — shared path normalization import.
- **FILE-003**: [apps/backend/src/lib/runtime/tool-prompts/index.ts](../apps/backend/src/lib/runtime/tool-prompts/index.ts) — shared workflow normalizers import.
- **FILE-004**: [apps/backend/src/lib/runtime/http-utils.ts](../apps/backend/src/lib/runtime/http-utils.ts) — new shared utility module.
- **FILE-005**: [apps/backend/src/lib/runtime/workflow-normalizers.ts](../apps/backend/src/lib/runtime/workflow-normalizers.ts) — new shared normalizer module.
- **FILE-006**: [apps/backend/src/lib/machines/generation-system.machine.ts](../apps/backend/src/lib/machines/generation-system.machine.ts) — machine-only focus.
- **FILE-007**: [apps/backend/src/lib/machines/generation/request-normalizers.ts](../apps/backend/src/lib/machines/generation/request-normalizers.ts) — extracted normalizers.
- **FILE-008**: [apps/backend/src/lib/machines/generation/extraction-parsers.ts](../apps/backend/src/lib/machines/generation/extraction-parsers.ts) — extracted parsers.
- **FILE-009**: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts) and [apps/backend/src/lib/adapters/postgres-redis.stub.ts](../apps/backend/src/lib/adapters/postgres-redis.stub.ts) — split or shim transition.
- **FILE-010**: [apps/backend/src/lib/adapters/auth.production.ts](../apps/backend/src/lib/adapters/auth.production.ts) and [apps/backend/src/lib/adapters/auth.stub.ts](../apps/backend/src/lib/adapters/auth.stub.ts) — split or shim transition.
- **FILE-011**: [apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx](../apps/frontend/src/features/tools/ui/ToolGenerationFlow.tsx) — removal target.
- **FILE-012**: [apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx](../apps/frontend/src/features/tools/ui/ToolGenerationFlowVertical.tsx) — canonical component retained.

## 6. Testing

- **TEST-001**: Backend unit tests for workflow normalizers and alias mappings.
- **TEST-002**: Backend unit tests for extracted youtube markdown parser behavior.
- **TEST-003**: Backend route regression tests for auth/tools/admin endpoints.
- **TEST-004**: Backend smoke tests for idempotency/conflict/query adapters.
- **TEST-005**: Frontend tests for vertical flow rendering and action behavior.
- **TEST-006**: Static duplication checks with `rg` integrated into execution gates.

## 7. Risks & Assumptions

- **RISK-001**: Import cycles introduced by new barrels.
- **RISK-002**: Route matching order drift during handler dispatch extraction.
- **RISK-003**: Frontend style regressions if dead-style cleanup removes shared classes.
- **RISK-004**: Hidden behavior drift if only compile checks are run.
- **ASSUMPTION-001**: Existing test suites are sufficient to detect regressions for touched modules.
- **ASSUMPTION-002**: No external runtime imports internal source paths directly.
- **ASSUMPTION-003**: DDD canonical naming remains stable through this refactor cycle.

## 8. Related Specifications / Further Reading

[DDD Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
[Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
[Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
[Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)
[Baseline Plan v1](./refactor-backend-frontend-atomization-1.md)