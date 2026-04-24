BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text,
  monthly_quota integer NOT NULL DEFAULT 100,
  monthly_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT users_monthly_quota_non_negative CHECK (monthly_quota >= 0),
  CONSTRAINT users_monthly_used_non_negative CHECK (monthly_used >= 0)
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY,
  request_id text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  type text NOT NULL,
  workflow_type text,
  model text NOT NULL DEFAULT 'unknown',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content text NOT NULL DEFAULT '',
  status text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  failure_reason text,
  registry_version text,
  registry_snapshot_ref text,
  streamed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT artifacts_status_valid CHECK (status IN ('generating', 'completed', 'failed')),
  CONSTRAINT artifacts_input_tokens_non_negative CHECK (input_tokens >= 0),
  CONSTRAINT artifacts_output_tokens_non_negative CHECK (output_tokens >= 0),
  CONSTRAINT artifacts_cost_usd_non_negative CHECK (cost_usd >= 0),
  CONSTRAINT artifacts_completed_at_consistent CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed')
  )
);

CREATE TABLE IF NOT EXISTS quota_history (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  request_id text,
  artifact_id text,
  status text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT quota_history_status_valid CHECK (status IN ('success', 'error', 'rate_limited')),
  CONSTRAINT quota_history_request_count_positive CHECK (request_count >= 0),
  CONSTRAINT quota_history_cost_usd_non_negative CHECK (cost_usd >= 0),
  CONSTRAINT quota_history_input_tokens_non_negative CHECK (input_tokens >= 0),
  CONSTRAINT quota_history_output_tokens_non_negative CHECK (output_tokens >= 0)
);

CREATE TABLE IF NOT EXISTS request_idempotency (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  artifact_id text REFERENCES artifacts(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT request_idempotency_status_valid CHECK (status IN ('in_progress', 'completed', 'failed')),
  CONSTRAINT request_idempotency_unique UNIQUE (user_id, project_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS artifacts_user_created_at_idx
  ON artifacts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS artifacts_project_created_at_idx
  ON artifacts (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS artifacts_status_idx
  ON artifacts (status);

CREATE INDEX IF NOT EXISTS artifacts_type_idx
  ON artifacts (type);

CREATE INDEX IF NOT EXISTS quota_history_user_created_at_idx
  ON quota_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS request_idempotency_lookup_idx
  ON request_idempotency (user_id, project_id, endpoint, idempotency_key);

COMMIT;