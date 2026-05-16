-- Migration Template: 20260516_000007_feedback_center_persistence_template
-- Purpose: Persistence baseline for ProductChangelog, UserReport, and GitHubIssueLink.
-- Scope: template for PR review; adjust types/defaults/indexes as needed before production rollout.
-- DDD reference: DDD-065 (ProductChangelog, UserReport, UserReportCategory, UserReportStatus, GitHubIssueLink).

BEGIN;

-- ------------------------------------------------------------
-- product_changelogs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_changelogs (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_changelogs_status_valid
    CHECK (status IN ('draft', 'published')),
  CONSTRAINT product_changelogs_publish_consistency
    CHECK (
      (status = 'draft' AND published_at IS NULL)
      OR (status = 'published' AND published_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_product_changelogs_status_published_at
  ON product_changelogs (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_changelogs_created_at
  ON product_changelogs (created_at DESC);

-- ------------------------------------------------------------
-- user_reports
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_reports (
  id text PRIMARY KEY,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  title text NOT NULL,
  description text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  triaged_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  triaged_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_category_valid
    CHECK (category IN ('issue', 'feature-request', 'other')),
  CONSTRAINT user_reports_status_valid
    CHECK (status IN ('submitted', 'triaged', 'github-published', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status_created_at
  ON user_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_reports_category_status_created_at
  ON user_reports (category, status, created_at DESC);

-- ------------------------------------------------------------
-- user_report_github_links
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_report_github_links (
  user_report_id text PRIMARY KEY REFERENCES user_reports(id) ON DELETE CASCADE,
  repository text NOT NULL,
  issue_number integer NOT NULL,
  issue_url text NOT NULL,
  published_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_report_github_links_issue_unique
    UNIQUE (repository, issue_number)
);

-- ------------------------------------------------------------
-- TODO (implementation sprint)
-- ------------------------------------------------------------
-- 1) Confirm ID generation strategy (app-generated text IDs vs DB-generated UUIDs).
-- 2) Add trigger/function for updated_at auto-maintenance if required by repository standard.
-- 3) Wire transactional publish-issue flow in runtime:
--    insert user_report_github_links + update user_reports.status = 'github-published' atomically.

COMMIT;