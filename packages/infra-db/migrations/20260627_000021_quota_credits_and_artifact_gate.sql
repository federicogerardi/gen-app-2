-- Migration: Quota credits and artifact gate
-- Renames monthly_used -> monthly_credits_used (credit-based quota model)
-- Adds invisible artifact gate columns (monthly_artifact_limit, monthly_artifacts_used)
-- Extends quota_history with session_id, cost_type, credit_cost
-- See: plan/refactor-quota-credits-and-artifact-gate-1.md
-- DDD: DDD-137 (CreditQuota), DDD-138 (MonthlyCreditsUsed), DDD-140 (ArtifactGateLimit/ArtifactGateUsed)

BEGIN;

-- ============================================================
-- 1. Users table: rename monthly_used, add artifact gate columns
-- ============================================================

-- Rename monthly_used -> monthly_credits_used
ALTER TABLE users RENAME COLUMN monthly_used TO monthly_credits_used;

-- Add artifact gate columns with safe defaults
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_artifact_limit integer NOT NULL DEFAULT 1000;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_artifacts_used integer NOT NULL DEFAULT 0;

-- Add non-negative constraints for new columns
ALTER TABLE users
  ADD CONSTRAINT users_monthly_artifact_limit_non_negative CHECK (monthly_artifact_limit >= 0);

ALTER TABLE users
  ADD CONSTRAINT users_monthly_artifacts_used_non_negative CHECK (monthly_artifacts_used >= 0);

-- ============================================================
-- 2. Quota history: extend with session_id, cost_type, credit_cost
-- ============================================================

ALTER TABLE quota_history
  ADD COLUMN IF NOT EXISTS session_id text;

ALTER TABLE quota_history
  ADD COLUMN IF NOT EXISTS cost_type text NOT NULL DEFAULT 'artifact';

ALTER TABLE quota_history
  ADD CONSTRAINT quota_history_cost_type_valid CHECK (cost_type IN ('session_summary', 'artifact'));

ALTER TABLE quota_history
  ADD COLUMN IF NOT EXISTS credit_cost integer NOT NULL DEFAULT 1;

ALTER TABLE quota_history
  ADD CONSTRAINT quota_history_credit_cost_positive CHECK (credit_cost >= 0);

-- ============================================================
-- 3. Indexes for new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS quota_history_session_id_idx
  ON quota_history (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quota_history_cost_type_idx
  ON quota_history (cost_type);

COMMIT;
