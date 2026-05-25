BEGIN;

CREATE INDEX IF NOT EXISTS artifacts_orchestrate_recent_completed_idx
  ON artifacts (user_id, project_id, workflow_type, updated_at DESC, id DESC)
  WHERE status = 'completed';

COMMIT;
