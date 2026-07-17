-- Migration: 20260717_000025_asset_type_add_brief
-- Purpose: Add 'brief' to the assets_asset_type_valid CHECK constraint
-- DDD: DDD-199 (AssetType extension)

BEGIN;

-- Drop existing constraint and recreate with new value
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_valid;

ALTER TABLE assets ADD CONSTRAINT assets_asset_type_valid CHECK (
  asset_type IN (
    'angle', 'persona', 'brand-voice', 'hook',
    'competitor-analysis', 'creative-brief', 'ad-copy',
    'landing-page', 'article-outline', 'article',
    'script', 'description', 'brief'
  )
);

COMMIT;
