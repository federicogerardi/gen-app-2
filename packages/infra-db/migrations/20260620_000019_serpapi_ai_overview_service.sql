-- Migration: SerpApi Google AI Overview API Service configuration
-- Creates ApiService entry for SerpApi Google AI Overview integration
-- Used by Geometric tool for SerpApi-only crawling

-- Extend access_mode constraint to include 'query-param'
ALTER TABLE api_services DROP CONSTRAINT IF EXISTS api_services_access_mode_check;
ALTER TABLE api_services ADD CONSTRAINT api_services_access_mode_check 
  CHECK (access_mode IN ('public', 'token', 'query-param'));

-- Add template/mapping columns to bindings table if they don't exist
ALTER TABLE api_service_tool_step_bindings 
  ADD COLUMN IF NOT EXISTS request_template_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE api_service_tool_step_bindings 
  ADD COLUMN IF NOT EXISTS response_mapping_json JSONB DEFAULT '{}'::jsonb;

-- Insert SerpApi service
INSERT INTO api_services (
  id,
  key,
  label,
  base_url,
  resource_path,
  access_mode,
  status,
  request_headers_template_json,
  created_at,
  updated_at,
  token_param_name,
  token_ref
) VALUES (
  gen_random_uuid(),
  'serpapi-google-ai-overview',
  'SerpApi Google AI Overview',
  'https://serpapi.com/search',
  '/search',
  'query-param',
  'active',
  '{"User-Agent": "geometric-crawler/1.0", "Accept": "application/json"}',
  NOW(),
  NOW(),
  'api_key',
  'serpapi_api_key_env'
);

-- Create tool step binding for geometric tool crawling step
INSERT INTO api_service_tool_step_bindings (
  id,
  api_service_id,
  tool_key,
  step_key,
  workflow_step_type,
  binding_status,
  requiredness,
  request_template_json,
  response_mapping_json,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM api_services WHERE key = 'serpapi-google-ai-overview'),
  'geometric',
  'serp-crawling',
  'crawling',
  'active',
  'required-by-tool-setting',
  '{
    "method": "GET",
    "query": {
      "engine": "google_ai_overview",
      "page_token": "{{page_token}}",
      "output": "json",
      "no_cache": "false"
    }
  }',
  '{
    "aiOverviewSnippet": "ai_overview.text_blocks.[].snippet",
    "references": "ai_overview.references",
    "searchMetadata": "search_metadata"
  }',
  NOW(),
  NOW()
);