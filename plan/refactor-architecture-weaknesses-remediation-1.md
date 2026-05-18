---
goal: Remediate all Critical and High architecture weaknesses identified in the 2026-05-18 code review
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Architecture Review
status: 'In progress'
tags: [architecture, refactor, security, chore]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan addresses all Critical and High severity findings from [`docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md`](../docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md). Findings are resolved in priority order: monolith decomposition → fail-open/fallback removal → contracts boundary restoration → debug surface removal → DDD governance closure. Each phase has measurable acceptance gates and can be worked on independently unless inter-phase dependencies are declared.

---

## 1. Requirements & Constraints

- **REQ-001**: All Critical severity findings must be resolved before any High severity items are closed.
- **REQ-002**: Each refactored module must compile with zero TypeScript errors (`tsc --noEmit`).
- **REQ-003**: All existing integration and smoke tests must continue to pass after each phase.
- **REQ-004**: `packages/contracts` must not import from `apps/backend` or `apps/frontend` after Phase 3.
- **REQ-005**: The `checkModelAvailability` guard must return `false` (not `true`) on DB failure after Phase 2.
- **REQ-006**: `/debug/connectivity` endpoint must be removed from `apps/frontend/server.mjs` in Phase 4.
- **SEC-001**: Sensitive flow log statements (auth tokens, OAuth, GitHub issues, OpenRouter keys) must be downgraded to `debug` level or removed entirely; never logged at `info`/`warn` in production.
- **SEC-002**: Model availability guard must fail closed: a DB error must not enable generation for an unavailable model.
- **CON-001**: The public API surface of `auth-http.ts` handler types (declared in `auth-http/admin-handlers.ts`, `auth-handlers.ts`, `projects-handlers.ts`, `tools-handlers.ts`) must not change during decomposition.
- **CON-002**: No new npm dependencies may be introduced to resolve these findings. Use only existing workspace packages and Node.js built-ins.
- **CON-003**: Lockfile must stay in sync: run `npm install --workspaces --include-workspace-root` after any `package.json` change.
- **GUD-001**: Prefer the smallest coherent change per task; do not bundle unrelated behavior in one commit.
- **GUD-002**: Each handler extracted from `auth-http.ts` must be placed in the existing `apps/backend/src/lib/runtime/auth-http/` directory and re-exported through the existing barrel if one exists.
- **GUD-003**: XState machine decomposition must use existing XState v5 actor/spawn patterns already established in the codebase.
- **PAT-001**: Follow DDD-first naming policy — verify canonical terms in `docs/01-requirements/domain-ubiquitous-language-glossary.md` before naming any new module or function.

---

## 2. Implementation Steps

### Implementation Phase 1 — Decompose Backend Monolith `auth-http.ts`

- GOAL-001: Split `apps/backend/src/lib/runtime/auth-http.ts` (3020 LOC) into domain-scoped handler implementation files, keeping the public handler interface unchanged and routing logic as the sole remaining concern of the top-level file.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Audit `apps/backend/src/lib/runtime/auth-http.ts` focusing on the `createAuthHttpRuntime` factory function body (lines `:417–2744`), which contains all handler implementations as inline closures. Identify every handler closure by domain context (Auth, Admin, Projects, Tools, Generation) and produce a mapping: `closure_name → bounded_context → target_file` before moving any code. Lines `:1–416` contain only type declarations and utility helpers shared across handlers; do not move these. | ✅ | 2026-05-18 |
| TASK-002 | Extract all **Auth** handler implementations (login, logout, session, OAuth callback, CSRF, token refresh) from `auth-http.ts` into `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts`. Update the existing `AdminHandlers` / handler type declarations if needed. | ✅ | 2026-05-18 |
| TASK-003 | Extract all **Admin** handler implementations (models CRUD, changelog, user reports, user management) from `auth-http.ts` into `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`. Ensure the `AdminHandlers` type already declared at line `:1` of that file is fully implemented here. | ✅ | 2026-05-18 |
| TASK-004 | Extract all **Projects** handler implementations from `auth-http.ts` into `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts`. The existing type stub at `projects-handlers.ts:34` must be fully implemented. | ✅ | 2026-05-18 |
| TASK-005 | Extract all **Tools/Generation** handler implementations from `auth-http.ts` into `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts`. The existing type stub at `tools-handlers.ts:22` must be fully implemented. | ✅ | 2026-05-18 |
| TASK-006 | Reduce `apps/backend/src/lib/runtime/auth-http.ts` to only: (a) route matching/dispatch logic (lines `:2750–3017`), (b) imports from the new handler files, and (c) the factory function that wires dependencies. Target ≤ 400 LOC. | ✅ | 2026-05-18 |
| TASK-007 | Run `tsc --noEmit` in `apps/backend/` and confirm zero errors. Run all backend tests (`npm test --workspace apps/backend`). | ✅ | 2026-05-18 |

#### TASK-001 Audit Output — `closure_name → bounded_context → target_file`

| Closure name | Bounded context | Target file |
|---|---|---|
| `handleLogin` | Auth | `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` |
| `handleLogout` | Auth | `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` |
| `handleSession` | Auth | `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` |
| `handleGoogleOAuthStart` | Auth | `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` |
| `handleGoogleOAuthCallback` | Auth | `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` |
| `handleProjectsList` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleProjectsCreate` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleProjectById` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleArtifactsList` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleArtifactById` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleArtifactDownload` | Projects | `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` |
| `handleToolsBriefUpload` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsHydrate` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsOrchestrate` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsSessionsList` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsSessionArtifacts` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsSessionStepArtifact` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleToolsSessionDownload` | Generation | `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` |
| `handleModelsList` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminModelsList` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminModelsCreate` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminModelsUpdate` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminModelsDelete` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleCreateUserReport` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleListPublishedChangelog` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminCreateChangelog` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminArchiveChangelog` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminListChangelog` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminListUserReports` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminUpdateUserReport` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminPublishUserReportIssue` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminListUsers` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminCreateUser` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminGetUser` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminUpdateUser` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |
| `handleAdminDeleteUser` | Admin | `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` |

**Completion criteria**: `auth-http.ts` ≤ 400 LOC; `tsc` passes; all tests green.

---

### Implementation Phase 2 — Decompose `generation-system.machine.ts`

- GOAL-002: Decompose `apps/backend/src/lib/machines/generation-system.machine.ts` (1182 LOC) by extracting routing, metadata resolution, fallback, and persistence preparation into dedicated sub-actors or helper modules.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Audit `generation-system.machine.ts` lines `:300–414+` and identify the three responsibility clusters: (a) metadata/routing resolution, (b) fallback/retry logic, (c) persistence preparation. Map each cluster to a proposed extraction target file path under `apps/backend/src/lib/machines/`. | ✅ | 2026-05-18 |
| TASK-009 | Extract metadata/routing resolution logic (lines `:300–412`) into a pure function module at `apps/backend/src/lib/machines/generation-routing.ts`. The function must be deterministic and have no side effects. | ✅ | 2026-05-18 |
| TASK-010 | Extract fallback and retry policy logic (lines `:414+`) into a dedicated XState v5 sub-actor at `apps/backend/src/lib/machines/generation-fallback.actor.ts` using `setup().createMachine()`. Wire it into the parent machine via `invoke` or `spawnChild`. | ✅ | 2026-05-18 |
| TASK-011 | Extract persistence preparation logic into `apps/backend/src/lib/machines/generation-persistence.ts`. This module prepares the artifact payload; it must not perform DB writes directly. | ✅ | 2026-05-18 |
| TASK-012 | Update `generation-system.machine.ts` to delegate to the new sub-actor and helper modules. Target ≤ 400 LOC for the top-level machine file. | ✅ | 2026-05-18 |
| TASK-013 | Run `tsc --noEmit` in `apps/backend/` and confirm zero errors. Run all backend tests. | ✅ | 2026-05-18 |

**Completion criteria**: `generation-system.machine.ts` ≤ 400 LOC; `tsc` passes; all tests green.

---

### Implementation Phase 3 — Decompose Frontend Tool-Page Runtime

- GOAL-003: Reduce coupling in the frontend tool-page runtime by splitting `tool-page.machine.ts` (1168 LOC), `useToolPageRunController.ts` (615 LOC), and `useToolPage.ts` (448 LOC) into smaller, single-responsibility units.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Audit `apps/frontend/src/features/tools/machines/tool-page.machine.ts` and identify state clusters (e.g., briefing upload, generation lifecycle, hydration/resume, error handling). Map each cluster to a proposed sub-machine or helper actor file path. | ✅ | 2026-05-18 |
| TASK-015 | Extract the briefing upload/extraction state cluster from `tool-page.machine.ts` into a dedicated sub-machine at `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`. | ✅ | 2026-05-18 |
| TASK-016 | Extract the generation lifecycle state cluster from `tool-page.machine.ts` into `apps/frontend/src/features/tools/machines/generation-lifecycle.machine.ts`. | ✅ | 2026-05-18 |
| TASK-017 | Extract the hydration/resume state cluster from `tool-page.machine.ts` into `apps/frontend/src/features/tools/machines/hydration.machine.ts`. | ✅ | 2026-05-18 |
| TASK-018 | Reduce `useToolPageRunController.ts` (615 LOC) by moving pure selector/derived-state logic into a dedicated helper module at `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts`. Hook must not exceed 250 LOC after extraction. | ✅ | 2026-05-18 |
| TASK-019 | Reduce `useToolPage.ts` (448 LOC) by moving actor wiring and context derivation into `apps/frontend/src/features/tools/runtime/tool-page-context.ts`. Hook must not exceed 200 LOC after extraction. | ✅ | 2026-05-18 |
| TASK-020 | Run `tsc --noEmit` in `apps/frontend/` and confirm zero errors. Run frontend unit tests (`npm test --workspace apps/frontend`). | ✅ | 2026-05-18 |

#### TASK-014 Audit Output — `cluster → proposed extraction target`

| State/logic cluster | Current anchors in `tool-page.machine.ts` | Proposed extraction target |
|---|---|---|
| Briefing upload/extraction orchestration | `configuring` handlers for `BRIEFING_FILE_SELECTED` / `BRIEFING_RESET`, `spawnBriefingActor`, `sendBriefingSelected`, `sendBriefingReset`, readiness bridge via `deriveHasExtractionContext` | `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` (sub-machine reuse as canonical briefing lifecycle owner) |
| Generation lifecycle orchestration | `generating` state, `REQUEST_STEP_START` gating, `startToolFlow`, `cancelToolFlow`, `forwardStepDone`, `forwardStepFailed`, `forwardRetryStep`, `INTERNAL_CANCELLED` path | `apps/frontend/src/features/tools/machines/generation-lifecycle.machine.ts` |
| Hydration/resume orchestration | `HydrationResult`/`PendingHydration`, `HYDRATE_REQUESTED`, `hydrating` state, `hydrateExtractionContextActor` (local artifact resolution + `/api/tools/hydrate` fallback), `onDone`/`onError` transitions | `apps/frontend/src/features/tools/machines/hydration.machine.ts` |
| Readiness/view-model/error policy | `buildReadinessSnapshot`, `buildToolPageViewModel`, `resolveFlowProgressState`, `setGenerationError`, `hydrationError` projection, policy derivation helpers | `apps/frontend/src/features/tools/machines/tool-page-view-model.ts` (pure helper module) |

**Completion criteria**: Each individual file ≤ 400 LOC; `tsc` passes; all frontend tests green.

---

### Implementation Phase 4 — Fix Fail-Open and Silent Fallback Behaviors

- GOAL-004: Make the system fail closed on model availability DB errors and make frontend silent fallbacks observable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | In `apps/backend/src/server.ts` lines `:105–111`, change the `catch` block of `isModelKeyAvailable` so that on DB error it returns `false` (fail closed) instead of `true`. Update the `console.warn` message to reflect `fallback=deny`. | ✅ | 2026-05-18 |
| TASK-022 | In `apps/backend/src/lib/runtime/node-server.ts` lines `:54–57`, make `checkModelAvailability` a required parameter (not optional). Remove the legacy permissive fallback comment from the JSDoc in `apps/backend/src/lib/types/xstate.ts` or tighten the `RegistryBackedWorkflowType` open union. | ✅ | 2026-05-18 |
| TASK-023 | In `apps/frontend/src/features/tools/runtime/models-client.ts` lines `:58–60`, replace the silent `return []` catch with a thrown error or a structured error value (`{ error: true, models: [] }`). Update callers in `useToolPage.ts:206–208` and `useToolPageRunController.ts:270` to handle the error state explicitly instead of silently degrading. | ✅ | 2026-05-18 |
| TASK-024 | Run `tsc --noEmit` in both `apps/backend/` and `apps/frontend/`. Run all tests. Verify the model-unavailable code path returns HTTP 422/503 (not 200) when the DB is unreachable. | ✅ | 2026-05-18 |

**Completion criteria**: `isModelKeyAvailable` catch returns `false`; `models-client.ts` no longer swallows errors silently; all tests green.

---

### Implementation Phase 5 — Restore `packages/contracts` Package Isolation

- GOAL-005: Eliminate cross-package boundary violations in `packages/contracts/src/parity.guard.ts` so the contracts package depends only on its own types.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Audit all `import(...)` type expressions in `packages/contracts/src/parity.guard.ts`. The cross-boundary violations span the full file — confirmed groups: `:22–23` (ArtifactType), `:45–46` (OutputFormat), `:68–69` (GenerationRequest), `:91–92` (BackendStreamEvent), `:113–115` (ProductChangelogStatus), `:132–134` (UserReportCategory), `:151–153` (UserReportStatus), `:171–172+` (ProductChangelogDto, and any further types). List every import path that crosses into `apps/backend/` or `apps/frontend/` — do not assume the list ends at line `:92`. | | |
| TASK-026 | For each cross-boundary import identified in TASK-025, inline the referenced type literal directly into `packages/contracts/src/index.ts` as a canonical type export. Confirmed types requiring promotion: `ArtifactType`, `OutputFormat`, `GenerationRequest`, `BackendStreamEvent`, `ProductChangelogStatus`, `UserReportCategory`, `UserReportStatus`, `ProductChangelogDto`. Verify the full list from TASK-025 before starting. The canonical contract package becomes the sole source of truth for all these types. | | |
| TASK-027 | Rewrite `parity.guard.ts` to perform structural parity checks only against types exported from `packages/contracts/src/index.ts`. Remove all `import(../../../apps/...)` statements. | | |
| TASK-028 | Consolidate the dual parity-guard strategy: remove `apps/frontend/src/features/generation/contracts/backend-stream.parity.guard.ts` and replace its checks with an import of the canonical parity guard from `packages/contracts`. Update any imports of the removed file. | | |
| TASK-029 | Run `tsc --noEmit` in `packages/contracts/`, `apps/backend/`, and `apps/frontend/`. Confirm zero errors and zero cross-boundary imports from `packages/contracts`. | | |

**Completion criteria**: `packages/contracts/src/parity.guard.ts` contains zero `import(../../../apps/...)` paths; `tsc` passes across all packages; frontend parity guard consolidated to one file.

---

### Implementation Phase 6 — Remove Debug Surfaces and Reduce Production Logs

- GOAL-006: Remove the temporary `/debug/connectivity` endpoint from the frontend server and reduce excessive debug logging in sensitive flows.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-030 | In `apps/frontend/server.mjs`, delete: (a) the comment block at lines `:177–178`, (b) the `handleDebugConnectivity` async function declaration and body at lines `:180–193`, and (c) the route dispatch branch `if (method === 'GET' && path === '/debug/connectivity')` at lines `:218–222`. Also remove the reference to `/debug/connectivity` in the inline comment block at line `:197`. | | |
| TASK-031 | In `apps/backend/src/lib/runtime/auth-http.ts` lines `:1994–2056` (auth flow) and `:2304–2408` (report flow), downgrade all `console.info` and `console.log` statements that log request payloads, tokens, or user data to `console.debug`. Remove any statement logging raw auth tokens or session cookies entirely. | | |
| TASK-032 | In `apps/backend/src/lib/runtime/github-issues.ts` lines `:88–172`, downgrade verbose request/response logging to `console.debug`. Remove any statement that logs GitHub API tokens or full issue body payloads. | | |
| TASK-033 | In `apps/backend/src/lib/runtime/openrouter.adapter.ts` lines `:102–113` and `:163–170`, downgrade verbose request/response logging to `console.debug`. Ensure no API keys or bearer tokens are ever logged. | | |
| TASK-034 | Run a grep audit: `grep -rn "console.info\|console.log" apps/backend/src/lib/runtime/` and confirm no remaining statements log security-sensitive data (tokens, keys, passwords, full request bodies in auth paths). | | |

**Completion criteria**: `/debug/connectivity` route absent from `server.mjs`; zero `console.info`/`console.log` statements logging auth tokens or API keys in the affected files; all tests green.

---

### Implementation Phase 7 — Close Open/Provisional DDD Decisions

- GOAL-007: Resolve the three open/provisional DDD governance entries that impact runtime contracts and routing semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-035 | Read `docs/07-governance/domain-naming-decision-log.md` lines `:61` (`DDD-039` provisional) and `:80` (`DDD-059` provisional). For each: determine the correct canonical term by cross-referencing `docs/01-requirements/domain-ubiquitous-language-glossary.md` and `docs/02-design/domain-bounded-context-map.md`. | ✅ | 2026-05-18 |
| TASK-036 | Update `DDD-039` in the decision log: change status from `provisional` to `approved` and add the rationale and evidence (file path + line) that confirms the canonical term. | | |
| TASK-037 | Update `DDD-059` in the decision log: change status from `provisional` to `approved` or `deprecated` with the same evidence format. | | |
| TASK-038 | Read `docs/07-governance/domain-naming-decision-log.md` line `:102` (`DDD-C-005` open). Determine the decision: either approve a canonical cross-context translation rule or explicitly close it as out-of-scope. Document the decision inline. | | |
| TASK-039 | For any term promoted from provisional → approved in TASK-036/037, verify that all usages in `apps/backend/src/`, `apps/frontend/src/`, and `packages/contracts/src/` use the canonical term. If drift is found, create a follow-up `DDD-NNN` entry and track it as a separate refactor task. | | |

**Completion criteria**: Zero entries with status `open` or `provisional` remain in `domain-naming-decision-log.md` for DDD-039, DDD-059, and DDD-C-005.

---

## 3. Alternatives

- **ALT-001**: Address all findings in a single large refactor branch. Rejected: monolithic changes increase merge conflict risk and make rollback impractical. Phased approach preferred.
- **ALT-002**: Introduce a new DI framework (e.g., `tsyringe`, `inversify`) to manage handler wiring after `auth-http.ts` decomposition. Rejected: violates CON-002 (no new dependencies); existing factory-function pattern is sufficient.
- **ALT-003**: Replace `packages/contracts/parity.guard.ts` entirely with a shared Zod schema. Rejected: introduces a new dependency and requires coordinated migration across backend and frontend; out of scope for this remediation cycle.
- **ALT-004**: Keep `generation-system.machine.ts` as-is and add inline comments to document responsibility clusters. Rejected: does not reduce coupling and leaves testability and maintainability unchanged.
- **ALT-005**: Suppress the `/debug/connectivity` endpoint behind an environment flag instead of removing it. Rejected: a feature flag adds complexity and the endpoint has a known removal obligation documented in the source comment.

---

## 4. Dependencies

- **DEP-001**: Phase 2 (TASK-008–013) is **independent** of Phase 1. `generation-system.machine.ts` is an XState machine under `apps/backend/src/lib/machines/` and does not share implementation scope with the HTTP handler closures in `auth-http.ts`. Phases 1 and 2 can be executed in parallel on separate branches. Similarly, Phases 4 and 5 (fail-open fix and contracts isolation) are self-contained and can be executed in parallel with Phases 1–3.
- **DEP-002**: Phase 5 (TASK-025–029) must be completed before Phase 3 (TASK-014–020) if the frontend parity guard (`backend-stream.parity.guard.ts`) is referenced by any frontend component being refactored.
- **DEP-003**: Phase 7 (TASK-035–039) is independent of all other phases and can proceed in parallel. However, any terminology drift found in TASK-039 that affects files touched in Phases 1–3 must be resolved before those phase tasks are marked complete.

---

## 5. Files

- **FILE-001**: `apps/backend/src/lib/runtime/auth-http.ts` — primary decomposition target (3020 LOC → ≤ 400 LOC)
- **FILE-002**: `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts` — receives extracted Admin handler implementations
- **FILE-003**: `apps/backend/src/lib/runtime/auth-http/auth-handlers.ts` — receives extracted Auth handler implementations
- **FILE-004**: `apps/backend/src/lib/runtime/auth-http/projects-handlers.ts` — receives extracted Projects handler implementations
- **FILE-005**: `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts` — receives extracted Tools/Generation handler implementations
- **FILE-006**: `apps/backend/src/lib/machines/generation-system.machine.ts` — monolith decomposition target (1182 LOC → ≤ 400 LOC)
- **FILE-007**: `apps/backend/src/lib/machines/generation-routing.ts` — new: metadata/routing resolution pure functions
- **FILE-008**: `apps/backend/src/lib/machines/generation-fallback.actor.ts` — new: XState v5 fallback/retry sub-actor
- **FILE-009**: `apps/backend/src/lib/machines/generation-persistence.ts` — new: persistence payload preparation
- **FILE-010**: `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — decomposition target (1168 LOC → ≤ 400 LOC)
- **FILE-011**: `apps/frontend/src/features/tools/machines/briefing-upload.machine.ts` — new: briefing upload sub-machine
- **FILE-012**: `apps/frontend/src/features/tools/machines/generation-lifecycle.machine.ts` — new: generation lifecycle sub-machine
- **FILE-013**: `apps/frontend/src/features/tools/machines/hydration.machine.ts` — new: hydration/resume sub-machine
- **FILE-014**: `apps/frontend/src/features/tools/runtime/useToolPageRunController.ts` — reduction target (615 LOC → ≤ 250 LOC)
- **FILE-015**: `apps/frontend/src/features/tools/runtime/tool-page-selectors.ts` — new: pure selector/derived-state helpers
- **FILE-016**: `apps/frontend/src/features/tools/runtime/useToolPage.ts` — reduction target (448 LOC → ≤ 200 LOC)
- **FILE-017**: `apps/frontend/src/features/tools/runtime/tool-page-context.ts` — new: actor wiring and context derivation
- **FILE-018**: `apps/frontend/src/features/tools/runtime/models-client.ts` — silent `catch` → structured error value
- **FILE-019**: `apps/backend/src/server.ts` — fail-open → fail-closed on `isModelKeyAvailable` catch
- **FILE-020**: `apps/backend/src/lib/runtime/node-server.ts` — make `checkModelAvailability` required
- **FILE-021**: `apps/backend/src/lib/types/xstate.ts` — tighten open union types
- **FILE-022**: `packages/contracts/src/parity.guard.ts` — remove cross-boundary imports
- **FILE-023**: `packages/contracts/src/index.ts` — receive inlined canonical types
- **FILE-024**: `apps/frontend/src/features/generation/contracts/backend-stream.parity.guard.ts` — removed/consolidated
- **FILE-025**: `apps/frontend/server.mjs` — remove `/debug/connectivity` endpoint
- **FILE-026**: `apps/backend/src/lib/runtime/github-issues.ts` — reduce verbose logging
- **FILE-027**: `apps/backend/src/lib/runtime/openrouter.adapter.ts` — reduce verbose logging
- **FILE-028**: `docs/07-governance/domain-naming-decision-log.md` — close DDD-039, DDD-059, DDD-C-005

---

## 6. Testing

- **TEST-001**: After TASK-007 — Run `npm test --workspace apps/backend` and confirm all backend unit/integration tests pass. Confirm `auth-http.ts` LOC ≤ 400 via `wc -l apps/backend/src/lib/runtime/auth-http.ts`.
- **TEST-002**: After TASK-013 — Run `npm test --workspace apps/backend` and confirm `generation-system.machine.ts` LOC ≤ 400.
- **TEST-003**: After TASK-020 — Run `npm test --workspace apps/frontend` and confirm all frontend tests pass. Confirm each of the three target files is ≤ 400 LOC.
- **TEST-004**: After TASK-024 — Simulate a DB error in the `isModelKeyAvailable` function (mock `listEnabledModels` to throw) and assert the function returns `false`. Assert the HTTP generation endpoint returns 503 or 422 under this condition.
- **TEST-005**: After TASK-024 — Simulate a `models-client.ts` fetch failure (mock fetch to throw) and assert `useToolPage` renders an error state, not an empty model list.
- **TEST-006**: After TASK-029 — Run `tsc --noEmit` in `packages/contracts/`. Assert exit code 0. Run `grep -rn "import.*apps/" packages/contracts/src/` and assert zero results.
- **TEST-007**: After TASK-030 — Make a GET request to `/debug/connectivity` on the frontend server and assert HTTP 404. Confirm the handler function is absent from `server.mjs` via grep.
- **TEST-008**: After TASK-034 — Run `grep -rn "console.info\|console.log" apps/backend/src/lib/runtime/auth-http.ts apps/backend/src/lib/runtime/github-issues.ts apps/backend/src/lib/runtime/openrouter.adapter.ts` and manually verify no remaining statements log tokens, keys, or raw auth payloads.
- **TEST-009**: After TASK-039 — Run `npm run build --workspace apps/frontend` and confirm zero build errors. Run `tsc --noEmit` across all packages.

---

## 7. Risks & Assumptions

- **RISK-001**: Extracting handler implementations from `auth-http.ts` into separate files may expose hidden shared state (closures over `pg`, `correlationId`, etc.) that must be explicitly threaded through function parameters. Mitigation: map all captured variables in TASK-001 before any extraction.
- **RISK-002**: The XState v5 sub-actor split for `generation-system.machine.ts` may require context shape changes that affect serialization/persistence of in-flight generation states. Mitigation: freeze context shape during refactor; only split actor topology.
- **RISK-003**: Removing the silent `return []` in `models-client.ts` will propagate errors to callers. If callers are not updated simultaneously (TASK-023), the frontend will break. Mitigation: TASK-021–024 are a single atomic unit; do not partially apply.
- **RISK-004**: Inlining canonical types into `packages/contracts/src/index.ts` (TASK-026) may cause type drift if backend or frontend evolve their local copies independently. Mitigation: parity guard (TASK-027) will catch drift at compile time.
- **RISK-005**: DDD-C-005 (`open`) may require cross-team alignment before it can be closed. Mitigation: if consensus cannot be reached, close with status `deferred` and document the blocker inline.
- **ASSUMPTION-001**: The four handler type files in `auth-http/` (`admin-handlers.ts`, `auth-handlers.ts`, `projects-handlers.ts`, `tools-handlers.ts`) are the intended extraction targets and their type contracts accurately reflect what implementations should export.
- **ASSUMPTION-002**: No external consumers (outside the monorepo) import directly from `packages/contracts/src/parity.guard.ts`; the file is a compile-time-only artifact.
- **ASSUMPTION-003**: The `RegistryBackedWorkflowType` open union in `apps/backend/src/lib/types/xstate.ts:5–7` is a TypeScript escape hatch added for registry-backed tool configuration, not a structural design intent. Tightening it will not break runtime behavior if existing callers are audited.

---

## 8. Related Specifications / Further Reading

- [Architecture Weaknesses Code Review 2026-05-18](../docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md)
- [Domain Naming Decision Log](../docs/07-governance/domain-naming-decision-log.md)
- [Domain Ubiquitous Language Glossary](../docs/01-requirements/domain-ubiquitous-language-glossary.md)
- [Domain Bounded Context Map](../docs/02-design/domain-bounded-context-map.md)
- [Frontend Data Access Layer ADR](../docs/02-design/adr/frontend-data-access-layer-adr.md)
