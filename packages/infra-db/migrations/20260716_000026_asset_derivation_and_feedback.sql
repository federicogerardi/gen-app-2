-- Migration: 20260716_000026_asset_derivation_and_feedback
-- Purpose: Create asset_derivation_chains and generation_feedback tables
-- DDD: DDD-197 (AssetDerivationChain), DDD-178 (GenerationFeedback)

BEGIN;

-- ------------------------------------------------------------
-- asset_derivation_chains — genealogical DAG (DDD-197)
-- Tracks: Asset A (upstream) was used as input to produce Asset B (downstream).
-- Chain is populated automatically when GenerationRequest carries
-- AssetReferences and generation completes successfully.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_derivation_chains (
  id bigserial PRIMARY KEY,
  upstream_asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  upstream_version integer NOT NULL,
  downstream_asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),

  -- DDD-197: upstream_version must be positive
  CONSTRAINT derivation_chains_upstream_version_positive CHECK (upstream_version >= 1),

  -- DDD-197: prevent duplicate derivation links
  CONSTRAINT derivation_chains_unique_link
    UNIQUE (upstream_asset_id, downstream_asset_id, tool_key)
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS derivation_chains_upstream_idx
  ON asset_derivation_chains (upstream_asset_id);

CREATE INDEX IF NOT EXISTS derivation_chains_downstream_idx
  ON asset_derivation_chains (downstream_asset_id);

CREATE INDEX IF NOT EXISTS derivation_chains_session_idx
  ON asset_derivation_chains (session_id);

CREATE INDEX IF NOT EXISTS derivation_chains_tool_key_idx
  ON asset_derivation_chains (tool_key);

-- ------------------------------------------------------------
-- generation_feedback — user feedback on generated artifacts (DDD-178)
-- Stores thumbs-up/thumbs-down ratings for quality scoring.
-- Used by AssetQualityScore (DDD-205) for feedbackScore factor.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generation_feedback (
  id bigserial PRIMARY KEY,
  artifact_id text NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT NOW(),

  -- One feedback per user per artifact
  CONSTRAINT generation_feedback_unique_per_user_artifact
    UNIQUE (artifact_id, user_id),

  -- DDD-178: rating CHECK constraint
  CONSTRAINT generation_feedback_rating_valid CHECK (
    rating IN ('positive', 'negative')
  )
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS generation_feedback_artifact_id_idx
  ON generation_feedback (artifact_id);

CREATE INDEX IF NOT EXISTS generation_feedback_user_id_idx
  ON generation_feedback (user_id);

CREATE INDEX IF NOT EXISTS generation_feedback_rating_idx
  ON generation_feedback (rating);

COMMIT;
