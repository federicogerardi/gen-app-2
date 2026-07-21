-- Migration: 20260716_000024_asset_groups
-- Purpose: Create asset_groups and asset_group_members tables
-- DDD: DDD-194 (AssetGroup), DDD-195 (AssetGroupUsage)

BEGIN;

-- ------------------------------------------------------------
-- asset_groups — named collection of Assets within a Project (DDD-194)
-- An AssetGroup is itself a project property, referenceable via
-- AssetReference.assetGroupId.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_groups (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  group_usage text NOT NULL DEFAULT 'individual',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  -- DDD-195: AssetGroupUsage CHECK constraint
  CONSTRAINT asset_groups_usage_valid CHECK (
    group_usage IN ('individual', 'bundled')
  )
);

-- ------------------------------------------------------------
-- asset_group_members — ordered membership junction (DDD-194)
-- position is meaningful: maps to iteration order or contextual slots.
-- An Asset can belong to multiple groups.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_group_members (
  group_id text NOT NULL REFERENCES asset_groups(id) ON DELETE CASCADE,
  asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (group_id, asset_id),

  -- DDD-194: position must be non-negative
  CONSTRAINT asset_group_members_position_non_negative CHECK (position >= 0)
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS asset_groups_project_id_idx
  ON asset_groups (project_id);

CREATE INDEX IF NOT EXISTS asset_groups_project_label_idx
  ON asset_groups (project_id, label);

CREATE INDEX IF NOT EXISTS asset_group_members_asset_id_idx
  ON asset_group_members (asset_id);

CREATE INDEX IF NOT EXISTS asset_group_members_group_position_idx
  ON asset_group_members (group_id, position);

COMMIT;
