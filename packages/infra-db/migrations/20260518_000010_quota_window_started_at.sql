BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quota_window_started_at timestamptz;

UPDATE users
SET quota_window_started_at = date_trunc('month', COALESCE(created_at, NOW()))
WHERE quota_window_started_at IS NULL;

ALTER TABLE users
  ALTER COLUMN quota_window_started_at SET DEFAULT date_trunc('month', NOW()),
  ALTER COLUMN quota_window_started_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS users_quota_window_started_at_idx
  ON users (quota_window_started_at);

COMMIT;
