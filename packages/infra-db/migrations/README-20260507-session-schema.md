# Session Queryable Schema Migration (20260507_000004)

This migration adds query-friendly columns to `artifacts` for deterministic multi-step Tool session grouping.

## Added Columns

- `session_id` (`text`, nullable)
- `step_key` (`text`, nullable)
- `artifact_role` (`text`, nullable, allowed: `step`, `final`)
- `run_mode` (`text`, nullable, allowed: `new`, `resume`, `regenerate`)

## Why

Before this migration, session information was only in `input_json.toolWorkflow`. That required JSON scans and non-deterministic FE heuristics.

These columns provide deterministic filtering/indexing while keeping JSON metadata as orchestration authority.

## Backfill Behavior

Rows are backfilled from `input_json.toolWorkflow` when available:

- `step_key <- input_json.toolWorkflow.stepKey`
- `artifact_role <- input_json.toolWorkflow.artifactRole`
- `run_mode <- input_json.toolWorkflow.runMode`
- `session_id <- input_json.toolWorkflow.sessionId`

Backfill is null-safe and does not overwrite existing non-null column values.

## Indexes

- `artifacts_session_id_idx` on `(session_id)`
- `artifacts_session_id_step_key_idx` on `(session_id, step_key)`
- `artifacts_artifact_role_idx` on `(artifact_role)`

## Compatibility

Columns are nullable in this phase to support zero-downtime rollout and legacy artifacts.

Legacy paths continue to work even when these fields are missing.

## Verification

Run the verification seed script:

- `packages/infra-db/seeds/20260507_verify_session_schema.sql`

It validates column presence, index presence, and a sample JSON-to-column consistency check.
