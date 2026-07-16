-- Migration: 20260716_000023_asset_core
-- Purpose: Create assets table with proper constraints and indices
-- DDD: DDD-188 (Asset Entity), DDD-190 (AssetSource), DDD-191 (AssetStatus)
-- DDD-199 (AssetType), DDD-189 (AssetReference)

BEGIN;

-- ------------------------------------------------------------
-- assets — persistent project resource (DDD-188)
-- An Asset is property of the Project, unlike Artifact which is
-- content produced in the Project by a generation.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  source text NOT NULL,
  source_artifact_id text REFERENCES artifacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  content text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  current_version integer NOT NULL DEFAULT 1,
  stale_upstream boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  -- DDD-199: AssetType CHECK constraint
  CONSTRAINT assets_asset_type_valid CHECK (
    asset_type IN (
      'angle', 'persona', 'brand-voice', 'hook',
      'competitor-analysis', 'creative-brief', 'ad-copy',
      'landing-page', 'article-outline', 'article',
      'script', 'description'
    )
  ),

  -- DDD-190: AssetSource CHECK constraint
  CONSTRAINT assets_source_valid CHECK (
    source IN ('generated', 'uploaded', 'manual')
  ),

  -- DDD-191: AssetStatus CHECK constraint
  CONSTRAINT assets_status_valid CHECK (
    status IN ('active', 'archived')
  ),

  -- DDD-196: current_version must be positive
  CONSTRAINT assets_current_version_positive CHECK (current_version >= 1),

  -- DDD-190: generated assets must have source_artifact_id
  CONSTRAINT assets_generated_requires_artifact CHECK (
    (source = 'generated' AND source_artifact_id IS NOT NULL)
    OR (source <> 'generated')
  )
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS assets_project_id_idx
  ON assets (project_id);

CREATE INDEX IF NOT EXISTS assets_project_type_idx
  ON assets (project_id, asset_type);

CREATE INDEX IF NOT EXISTS assets_project_status_idx
  ON assets (project_id, status);

CREATE INDEX IF NOT EXISTS assets_source_artifact_id_idx
  ON assets (source_artifact_id)
  WHERE source_artifact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assets_created_at_idx
  ON assets (created_at DESC);

COMMIT;
