-- Migration: Add archived status to product_changelogs
-- DDD-091: Support 3-tier visibility policy (draft/published/archived)

BEGIN;

-- Step 1: Add archive tracking columns
ALTER TABLE product_changelogs
ADD COLUMN IF NOT EXISTS archived_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Step 2: Replace old constraint with new one that includes 'archived'
ALTER TABLE product_changelogs
DROP CONSTRAINT IF EXISTS product_changelogs_status_valid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_changelogs_status_valid'
      AND conrelid = 'product_changelogs'::regclass
  ) THEN
    ALTER TABLE product_changelogs
    ADD CONSTRAINT product_changelogs_status_valid
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

-- Step 3: Replace publish consistency constraint to handle archived state
ALTER TABLE product_changelogs
DROP CONSTRAINT IF EXISTS product_changelogs_publish_consistency;

ALTER TABLE product_changelogs
DROP CONSTRAINT IF EXISTS product_changelogs_state_consistency;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_changelogs_state_consistency'
      AND conrelid = 'product_changelogs'::regclass
  ) THEN
    ALTER TABLE product_changelogs
    ADD CONSTRAINT product_changelogs_state_consistency
      CHECK (
        (status = 'draft' AND published_at IS NULL AND published_by_user_id IS NULL AND archived_at IS NULL AND archived_by_user_id IS NULL)
        OR (status = 'published' AND published_at IS NOT NULL AND published_by_user_id IS NOT NULL AND archived_at IS NULL AND archived_by_user_id IS NULL)
        OR (status = 'archived' AND archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL)
      );
  END IF;
END $$;

-- Step 4: Add index for archived status queries (useful for admin listing all + restore)
CREATE INDEX IF NOT EXISTS idx_product_changelogs_status_archived_at
  ON product_changelogs (status, archived_at DESC);

COMMIT;
