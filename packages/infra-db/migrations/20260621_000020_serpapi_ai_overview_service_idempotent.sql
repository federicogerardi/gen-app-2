-- Migration: SerpApi Google AI Overview API Service configuration (idempotent)
-- Creates ApiService entry for SerpApi Google AI Overview integration
-- Used by Geometric tool for SerpApi-only crawling
-- Replaces 20260620_000019 which had checksum drift

-- Extend access_mode constraint to include 'query-param' (idempotent)
ALTER TABLE api_services DROP CONSTRAINT IF EXISTS api_services_access_mode_check;
ALTER TABLE api_services ADD CONSTRAINT api_services_access_mode_check 
  CHECK (access_mode IN ('public', 'token', 'query-param'));

-- Add template/mapping columns to bindings table if they don't exist
ALTER TABLE api_service_tool_step_bindings 
  ADD COLUMN IF NOT EXISTS request_template_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE api_service_tool_step_bindings 
  ADD COLUMN IF NOT EXISTS response_mapping_json JSONB DEFAULT '{}'::jsonb;

-- Upsert SerpApi service (idempotent via ON CONFLICT on key)
INSERT INTO api_services (
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
) ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  base_url = EXCLUDED.base_url,
  resource_path = EXCLUDED.resource_path,
  access_mode = EXCLUDED.access_mode,
  status = EXCLUDED.status,
  request_headers_template_json = EXCLUDED.request_headers_template_json,
  updated_at = NOW(),
  token_param_name = EXCLUDED.token_param_name,
  token_ref = EXCLUDED.token_ref;

-- Upsert tool step binding (idempotent via composite unique or manual check)
DO $$
DECLARE
  v_service_id UUID;
BEGIN
  SELECT id INTO v_service_id FROM api_services WHERE key = 'serpapi-google-ai-overview';
  
  IF v_service_id IS NOT NULL THEN
    INSERT INTO api_service_tool_step_bindings (
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
      v_service_id,
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
    ) ON CONFLICT (api_service_id, tool_key, step_key) DO UPDATE SET
      workflow_step_type = EXCLUDED.workflow_step_type,
      binding_status = EXCLUDED.binding_status,
      requiredness = EXCLUDED.requiredness,
      request_template_json = EXCLUDED.request_template_json,
      response_mapping_json = EXCLUDED.response_mapping_json,
      updated_at = NOW();
  END IF;
END $$;
