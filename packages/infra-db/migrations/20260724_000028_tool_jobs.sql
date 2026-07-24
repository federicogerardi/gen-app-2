-- Migration: 20260724_000028_tool_jobs
-- Purpose: Create tool_jobs table for ToolWorkflowJob persistence (Phase 2)
-- DDD: DDD-226 (ToolWorkflowJob aggregate root), DDD-227 (ToolWorkflowJob lifecycle)
-- DDD-NEW: ToolWorkflowJobStatus (value object), ToolWorkflowJobRepository

BEGIN;

CREATE TABLE IF NOT EXISTS tool_jobs (
  job_id          TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  tool_key        TEXT NOT NULL,
  workflow_type   TEXT NOT NULL,
  session_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total_steps     INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  progress        JSONB DEFAULT '{}',
  result          JSONB,
  model           TEXT,
  cost_usd        NUMERIC(12,6) DEFAULT 0,
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,

  -- total_steps must be non-negative
  CONSTRAINT tool_jobs_total_steps_non_negative CHECK (total_steps >= 0),
  -- completed_steps must be non-negative
  CONSTRAINT tool_jobs_completed_steps_non_negative CHECK (completed_steps >= 0),
  -- completed_steps cannot exceed total_steps
  CONSTRAINT tool_jobs_completed_steps_lte_total CHECK (completed_steps <= total_steps)
);

-- Index for admin list queries: filter by status, user, tool
CREATE INDEX IF NOT EXISTS idx_tool_jobs_user_status
  ON tool_jobs (user_id, status);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_project
  ON tool_jobs (project_id);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_tool_key
  ON tool_jobs (tool_key);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_session
  ON tool_jobs (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tool_jobs_created_at
  ON tool_jobs (created_at DESC);

-- Index for discovery endpoint: find active jobs by project + tool
CREATE INDEX IF NOT EXISTS idx_tool_jobs_active_lookup
  ON tool_jobs (project_id, tool_key, status)
  WHERE status IN ('queued', 'running');

COMMIT;
