BEGIN;

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS step_key text,
  ADD COLUMN IF NOT EXISTS artifact_role text,
  ADD COLUMN IF NOT EXISTS run_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artifacts_artifact_role_valid'
  ) THEN
    ALTER TABLE artifacts
      ADD CONSTRAINT artifacts_artifact_role_valid
      CHECK (artifact_role IS NULL OR artifact_role IN ('step', 'final'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artifacts_run_mode_valid'
  ) THEN
    ALTER TABLE artifacts
      ADD CONSTRAINT artifacts_run_mode_valid
      CHECK (run_mode IS NULL OR run_mode IN ('new', 'resume', 'regenerate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS artifacts_session_id_idx
  ON artifacts (session_id);

CREATE INDEX IF NOT EXISTS artifacts_session_id_step_key_idx
  ON artifacts (session_id, step_key);

CREATE INDEX IF NOT EXISTS artifacts_artifact_role_idx
  ON artifacts (artifact_role);

UPDATE artifacts
SET
  step_key = COALESCE(step_key, input_json->'toolWorkflow'->>'stepKey'),
  artifact_role = COALESCE(artifact_role, input_json->'toolWorkflow'->>'artifactRole'),
  run_mode = COALESCE(run_mode, input_json->'toolWorkflow'->>'runMode'),
  session_id = COALESCE(session_id, input_json->'toolWorkflow'->>'sessionId')
WHERE input_json IS NOT NULL
  AND input_json->'toolWorkflow' IS NOT NULL;

COMMIT;
