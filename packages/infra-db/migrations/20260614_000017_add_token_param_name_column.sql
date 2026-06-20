-- Migration: Add token_param_name column to api_services table
-- Purpose: Support query-param authentication mode for SERP API integration (BLOCKER-001)
-- Date: 2026-06-14

ALTER TABLE api_services 
ADD COLUMN IF NOT EXISTS token_param_name TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN api_services.token_param_name IS 'Query parameter name for token injection when access_mode is query-param (e.g., api_key for SerpAPI)';
