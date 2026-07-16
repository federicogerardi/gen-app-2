-- Migration: 20260716_000025_asset_versions
-- Purpose: Create asset_versions table with unique constraint
-- DDD: DDD-196 (AssetVersion)

BEGIN;

-- ------------------------------------------------------------
-- asset_versions — immutable version snapshots (DDD-196)
-- Each time an Asset is updated, a new version is created.
-- Past versions are retained for rollback and audit.
-- Consumer AssetReference resolves to current_version at dispatch time.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_versions (
  id bigserial PRIMARY KEY,
  asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL DEFAULT '',
  source_artifact_id text REFERENCES artifacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),

  -- DDD-196: unique constraint — one version number per asset
  CONSTRAINT asset_versions_unique_version
    UNIQUE (asset_id, version_number),

  -- DDD-196: version_number must be positive
  CONSTRAINT asset_versions_version_number_positive CHECK (version_number >= 1)
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS asset_versions_asset_id_idx
  ON asset_versions (asset_id);

CREATE INDEX IF NOT EXISTS asset_versions_asset_version_idx
  ON asset_versions (asset_id, version_number DESC);

CREATE INDEX IF NOT EXISTS asset_versions_created_at_idx
  ON asset_versions (created_at DESC);

COMMIT;
