-- Migration: geometric screenshot metadata
-- REQ-001 / REQ-002 / REQ-009

BEGIN;

CREATE TABLE IF NOT EXISTS geometric_screenshot_metadata (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  query TEXT NOT NULL,
  is_paa BOOLEAN NOT NULL DEFAULT false,
  stored_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  ai_overview_confidence NUMERIC(3,2),
  selector_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geometric_screenshot_metadata_session_id
  ON geometric_screenshot_metadata (session_id);

CREATE INDEX IF NOT EXISTS idx_geometric_screenshot_metadata_expires_at
  ON geometric_screenshot_metadata (expires_at);

COMMIT;
