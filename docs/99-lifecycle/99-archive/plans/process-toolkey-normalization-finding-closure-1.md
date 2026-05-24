---
goal: Close F-01 by converging ToolKey normalization to one contract-level authority used by Frontend and Backend
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Architecture Review
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [process, architecture, frontend, backend, contracts, ddd]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan defines deterministic phases to close finding F-01 (Duplicate ToolKey normalization policy across Frontend and Backend boundaries) by establishing one contract-level normalization authority and removing local divergent normalization logic.

## 1. Requirements & Constraints

- REQ-001: Establish one canonical normalization implementation for ToolKey and workflow alias handling at shared contract boundary level.
- REQ-002: Remove Frontend local ToolKey normalization logic from artifacts client read path and replace it with shared canonical helpers.
- REQ-003: Preserve current API behavior for accepted legacy aliases while eliminating FE/BE divergence in alias mapping.
- REQ-004: Keep existing call sites that depend on backend normalizeToolWorkflowKey API stable unless explicitly migrated in this plan.
- REQ-005: Provide objective closure evidence: code diff showing single authority, updated tests, and passing validation commands.
- SEC-001: Do not expand debug logging or emit raw request payloads while implementing normalization convergence.
- DDD-001: Enforce DDD-029 and DDD-071 by making ToolKey normalization contract-owned and reused cross-context.
- DDD-002: Keep canonical terms unchanged: ToolKey, ToolWorkflow, SupportedTool, GenerationWorkflowType.
- CON-001: Scope limited to contracts, backend workflow normalizer integration, frontend artifacts client integration, and governance closure documentation.
- CON-002: No route-path changes, no persistence schema changes, and no artifact payload shape changes are allowed.
- CON-003: Keep lockfiles untouched because no dependency changes are introduced.
- GUD-001: Prefer additive shared helper extraction before deleting local normalizers.
- GUD-002: Keep each phase independently verifiable with explicit pass criteria.
- PAT-001: Single source of truth pattern for boundary normalization.
- PAT-002: Backward-compat alias support pattern with explicit test matrix.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Introduce contract-level canonical normalization helpers and alias matrix.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update packages/contracts/src/tool-workflows.ts to add one exported canonical ToolKey normalizer function for external or legacy inputs. The function must normalize casing and legacy aliases currently split across FE and BE (funnel_pages, hl_funnel, funnelpages, youtube_lf_script, youtube-long-form, youtube_long_form) and return canonical ToolKey or null. | Yes | 2026-05-21 |
| TASK-002 | Add one exported helper in packages/contracts/src/tool-workflows.ts that resolves GenerationWorkflowType from a raw candidate using the canonical ToolKey normalizer and existing resolveToolWorkflowType function, preserving extraction handling rules. | Yes | 2026-05-21 |
| TASK-003 | Update packages/contracts/src/index.ts exports to expose the new canonical helpers without renaming existing public symbols. | Yes | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Converge backend runtime normalization to contract-owned implementation while preserving backend public API surface.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Refactor apps/backend/src/lib/runtime/workflow-normalizers.ts so normalizeToolWorkflowKey delegates ToolKey alias normalization to the new contracts helper and only keeps backend-specific workflow-level transforms that are not ToolKey identity transforms. | Yes | 2026-05-21 |
| TASK-005 | Keep apps/backend/src/lib/runtime/workflow-normalizers.ts export signatures unchanged (normalizeToolWorkflowKey, normalizeStepKey, resolveToolStepArtifactRole) to avoid breaking downstream imports. | Yes | 2026-05-21 |
| TASK-006 | Verify all backend call sites continue to compile and behave with canonical shared mapping in apps/backend/src/lib/runtime/auth-http/tools-brief-handlers.ts, apps/backend/src/lib/runtime/tool-workflow-registry.ts, apps/backend/src/lib/adapters/session-query.adapter.ts, and apps/backend/src/lib/adapters/postgres-redis.production.ts. | Yes | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Remove frontend local normalization authority and consume shared canonical helpers.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Refactor apps/frontend/src/features/artifacts/runtime/artifacts-client.ts by removing normalizeToolKeyCandidate local alias table and replacing readToolKey normalization chain with contracts helper calls. | Yes | 2026-05-21 |
| TASK-008 | Refactor apps/frontend/src/features/artifacts/runtime/artifacts-client.ts normalizeWorkflowTypeCandidate to delegate workflow resolution to the shared contracts helper and retain only artifact-specific fallback ordering logic. | Yes | 2026-05-21 |
| TASK-009 | Ensure toSourceRequest and toGenerationArtifact in apps/frontend/src/features/artifacts/runtime/artifacts-client.ts preserve returned shapes and nullable semantics while using canonical normalization outputs. | Yes | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Validate closure and update governance evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Extend backend normalization tests in apps/backend/src/lib/tests/runtime.workflow-normalizers.test.ts with a deterministic alias matrix that includes aliases previously FE-only and BE-only, asserting one canonical output set. | Yes | 2026-05-21 |
| TASK-011 | Extend frontend artifacts client tests in apps/frontend/src/features/artifacts/runtime/artifacts-client.test.ts to verify readToolKey and sourceRequest.workflowType resolution for all normalized aliases and extraction edge cases. | Yes | 2026-05-21 |
| TASK-012 | Run validation commands from workspace root: npm --workspace @gen-app-2/contracts run typecheck, npm --workspace @gen-app-2/backend run test -- src/lib/tests/runtime.workflow-normalizers.test.ts, npm --workspace apps/frontend run test -- src/features/artifacts/runtime/artifacts-client.test.ts, npm --workspace @gen-app-2/backend run typecheck, npm --workspace apps/frontend run typecheck. | Yes | 2026-05-21 |
| TASK-013 | Update docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md by adding closure evidence for finding F-01 only after TASK-010 to TASK-012 pass with zero regressions. | Yes | 2026-05-21 |

## 3. Alternatives

- ALT-001: Keep frontend normalizer and only document divergence. Rejected because governance risk remains and drift can reappear silently.
- ALT-002: Move normalization authority to backend only and force frontend pass-through with no local parsing. Rejected because frontend artifact hydration and legacy read paths still require deterministic local normalization for existing data.
- ALT-003: Duplicate backend logic into frontend with strict copy policy. Rejected because duplication is the original finding and creates ongoing synchronization risk.

## 4. Dependencies

- DEP-001: packages/contracts/src/tool-workflows.ts as canonical source target.
- DEP-002: packages/contracts/src/index.ts for shared export surface.
- DEP-003: apps/backend/src/lib/runtime/workflow-normalizers.ts for backend compatibility wrapper.
- DEP-004: apps/backend/src/lib/tests/runtime.workflow-normalizers.test.ts for backend alias matrix verification.
- DEP-005: apps/frontend/src/features/artifacts/runtime/artifacts-client.ts for frontend read-path convergence.
- DEP-006: apps/frontend/src/features/artifacts/runtime/artifacts-client.test.ts for frontend behavior verification.
- DEP-007: docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md for finding closure evidence.

## 5. Files

- FILE-001: packages/contracts/src/tool-workflows.ts
- FILE-002: packages/contracts/src/index.ts
- FILE-003: apps/backend/src/lib/runtime/workflow-normalizers.ts
- FILE-004: apps/backend/src/lib/tests/runtime.workflow-normalizers.test.ts
- FILE-005: apps/frontend/src/features/artifacts/runtime/artifacts-client.ts
- FILE-006: apps/frontend/src/features/artifacts/runtime/artifacts-client.test.ts
- FILE-007: docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md

## 6. Testing

- TEST-001: Contract typecheck with npm --workspace @gen-app-2/contracts run typecheck.
- TEST-002: Backend focused normalization suite with npm --workspace @gen-app-2/backend run test -- src/lib/tests/runtime.workflow-normalizers.test.ts.
- TEST-003: Frontend focused artifacts client suite with npm --workspace apps/frontend run test -- src/features/artifacts/runtime/artifacts-client.test.ts.
- TEST-004: Backend compile validation with npm --workspace @gen-app-2/backend run typecheck.
- TEST-005: Frontend compile validation with npm --workspace apps/frontend run typecheck.
- TEST-006: Optional regression safety gate with npm --workspace @gen-app-2/backend run test:unit and npm --workspace apps/frontend run test when closure branch is prepared for review.

## 7. Risks & Assumptions

- RISK-001: Existing historical artifacts may contain non-canonical workflowType strings not currently covered by known alias set.
- RISK-002: Over-aggressive normalization may map unsupported raw values to valid ToolKey incorrectly if alias table is too permissive.
- RISK-003: Frontend artifact hydration behavior may shift if fallback precedence changes while removing local helper logic.
- ASSUMPTION-001: Current backend and frontend tests are sufficient to detect observable normalization regressions in read and dispatch preparation paths.
- ASSUMPTION-002: No additional canonical term decision is required because this plan converges implementation ownership already defined by DDD-071.
- ASSUMPTION-003: Closure acceptance for finding F-01 requires both code convergence and governance document update, not code-only changes.

## 8. Related Specifications / Further Reading

- docs/07-governance/architecture-weaknesses-code-review-severe-2026-05-21.md
- docs/07-governance/domain-naming-decision-log.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- ./process-tool-page-finding-closure-1.md