---
status: draft
version: 1.0
last-reviewed: 2026-05-09
owner: Frontend + Backend Platform
---

# Session Aggregation Implementation Guide

## Purpose

This guide documents how GenerationSession-based aggregation works end-to-end in gen-app-2 and how to troubleshoot common rollout issues.

## Architecture Overview

GenerationSession introduces a session-level grouping layer above Artifact records for multi-step ToolWorkflow execution.

- Frontend/UI bounded context creates and propagates `sessionId` from ToolPage runtime.
- Generation bounded context persists `session_id`, `step_key`, `artifact_role`, and `run_mode` per Artifact.
- Backend query layer exposes session endpoints returning SessionArtifactGroup projections.
- Frontend hydration first attempts session-aware reads and keeps a backward-compatible heuristic fallback.

## SessionId Flow: Frontend To Database

### 1) Frontend creates session identity

Session identity is generated once per ToolPage entry and propagated in each GenerationRequest.

Key implementation points:
- `apps/frontend/src/features/tools/runtime/useToolPage.ts`
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts`

### 2) Backend receives and propagates session metadata

Generation orchestration copies request `sessionId` into tool workflow persistence metadata before persistence-batch execution.

Key implementation points:
- `apps/backend/src/lib/machines/generation-system.machine.ts`
- `apps/backend/src/lib/machines/persistence-batch.machine.ts`

### 3) Persistence writes queryable columns

Artifact persistence stores session-aware fields to support deterministic read models.

Key implementation points:
- `apps/backend/src/lib/adapters/postgres-redis.production.ts`
- `packages/infra-db/migrations/20260507_000004_generation_session_queryable_schema.sql`

## Query Patterns

### Session-aware query (preferred)

Use session endpoints for deterministic grouping:
- `GET /api/tools/sessions`
- `GET /api/tools/sessions/{sessionId}`
- `GET /api/tools/sessions/{sessionId}/step/{stepKey}`

DDD-051 alignment: the canonical aggregate-listing contract is `GET /api/tools/sessions` returning `SessionSummary[]` (`sessionId`, `projectId`, `toolKey`, `status`, `artifactCount`, `updatedAt`). During transition, Frontend may derive `SessionSummary` from artifact listing where backend endpoint rollout is pending. Session-listing primacy is treated as a UX implementation policy only, not as a domain invariant.

DDD-052 alignment: route and endpoint ownership must remain separated — session aggregate navigation uses `sessionsummary` frontend namespace and `/api/tools/sessions*` backend contracts; artifact history/detail remains under `artifacts` frontend namespace and `/api/artifacts*` backend contracts.

Implementation points:
- `apps/backend/src/lib/runtime/auth-http.ts`
- `apps/backend/src/lib/adapters/session-query.adapter.ts`

### Heuristic fallback (legacy compatibility)

If session-tagged artifacts are missing during migration windows, frontend hydration can still infer completed steps by project/tool-level history.

Implementation points:
- `apps/frontend/src/features/generation/runtime/step-hydration.ts`

Migration note:
- `collectCompletedStepsByTool()` is deprecated and should only serve legacy rows.
- New code should use `collectCompletedStepsBySession()` with explicit `sessionId`.

## Troubleshooting

### Missing sessionId in generated artifacts

Symptoms:
- Session endpoint returns 404 or empty payload.
- UI can display older heuristic results but no deterministic session grouping.

Checks:
1. Confirm FE request payload includes `sessionId`.
2. Confirm generation system context receives `sessionId`.
3. Confirm DB row has `session_id` populated.

### Session query timeout or slow response

Symptoms:
- Tabs load slowly on Artifact detail pages.

Checks:
1. Validate migration and index creation completed in target environment.
2. Verify query plan uses session-oriented indexes.
3. Verify API fallback behavior remains non-blocking for UI rendering.

### SessionId mismatch between UI and persisted rows

Symptoms:
- Expected artifacts not visible in session tabs.

Checks:
1. Compare route/session identity used by FE and metadata persisted by backend.
2. Ensure no stale URL state reuses an obsolete ToolPage session.
3. Use legacy fallback only as temporary compatibility behavior.

## Verification References

- Backend tests:
  - `apps/backend/src/lib/tests/generation-session.integration.test.ts`
  - `apps/backend/src/lib/tests/generation-session.e2e.test.ts`
  - `apps/backend/src/lib/tests/generation-legacy-compat.test.ts`
- Frontend tests:
  - `apps/frontend/src/features/generation/runtime/step-hydration.test.ts`

## Future Enhancements

- Add session timeline view with per-step event diagnostics.
- Add explicit audit log projection for GenerationSession lifecycle transitions.
- Add session-level performance SLO checks in CI.
