-- Migration: Add archived status to product_changelogs
-- DDD-091: Support 3-tier visibility policy (draft/published/archived)

BEGIN;

-- Step 1: Add archive tracking columns
ALTER TABLE product_changelogs
ADD COLUMN archived_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN archived_at timestamptz;

-- Step 2: Replace old constraint with new one that includes 'archived'
ALTER TABLE product_changelogs
DROP CONSTRAINT product_changelogs_status_valid;

ALTER TABLE product_changelogs
ADD CONSTRAINT product_changelogs_status_valid
  CHECK (status IN ('draft', 'published', 'archived'));

-- Step 3: Replace publish consistency constraint to handle archived state
ALTER TABLE product_changelogs
DROP CONSTRAINT product_changelogs_publish_consistency;

ALTER TABLE product_changelogs
ADD CONSTRAINT product_changelogs_state_consistency
  CHECK (
    (status = 'draft' AND published_at IS NULL AND published_by_user_id IS NULL AND archived_at IS NULL AND archived_by_user_id IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL AND published_by_user_id IS NOT NULL AND archived_at IS NULL AND archived_by_user_id IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL)
  );

-- Step 4: Add index for archived status queries (useful for admin listing all + restore)
CREATE INDEX IF NOT EXISTS idx_product_changelogs_status_archived_at
  ON product_changelogs (status, archived_at DESC);

COMMIT;
