-- Verify session queryable schema on artifacts

-- 1) Required columns
SELECT
  CASE WHEN COUNT(*) = 4 THEN 'ok' ELSE 'fail' END AS columns_check,
  COUNT(*) AS found_columns
FROM information_schema.columns
WHERE table_name = 'artifacts'
  AND column_name IN ('session_id', 'step_key', 'artifact_role', 'run_mode');

-- 2) Required indexes
SELECT
  CASE WHEN COUNT(*) = 3 THEN 'ok' ELSE 'fail' END AS indexes_check,
  COUNT(*) AS found_indexes
FROM pg_indexes
WHERE tablename = 'artifacts'
  AND indexname IN (
    'artifacts_session_id_idx',
    'artifacts_session_id_step_key_idx',
    'artifacts_artifact_role_idx'
  );

-- 3) Sample consistency check for step_key backfill
WITH sample AS (
  SELECT
    id,
    step_key,
    input_json->'toolWorkflow'->>'stepKey' AS json_step_key
  FROM artifacts
  WHERE input_json ? 'toolWorkflow'
  ORDER BY updated_at DESC
  LIMIT 1
)
SELECT
  id,
  step_key,
  json_step_key,
  CASE
    WHEN json_step_key IS NULL THEN 'n/a'
    WHEN step_key = json_step_key THEN 'ok'
    ELSE 'mismatch'
  END AS step_key_consistency
FROM sample;
