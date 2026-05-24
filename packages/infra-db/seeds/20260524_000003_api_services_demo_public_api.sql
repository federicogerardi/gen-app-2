BEGIN;

-- Seed: 20260524_000003_api_services_demo_public_api
-- Demo ApiService backed by a stable public API.
-- No secret is stored because access_mode is public.

INSERT INTO api_services (
  key,
  label,
  base_url,
  resource_path,
  access_mode,
  timeout_ms,
  retry_count,
  request_method,
  request_template_json,
  request_mapping_rules_json,
  request_headers_template_json,
  response_mapping_rules_json,
  error_mapping_rules_json,
  contract_profile_version,
  status
)
VALUES (
  'jsonplaceholder-posts-demo',
  'JSONPlaceholder Posts Demo',
  'https://jsonplaceholder.typicode.com',
  '/posts',
  'public',
  10000,
  1,
  'GET',
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  1,
  'active'
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  base_url = EXCLUDED.base_url,
  resource_path = EXCLUDED.resource_path,
  access_mode = EXCLUDED.access_mode,
  timeout_ms = EXCLUDED.timeout_ms,
  retry_count = EXCLUDED.retry_count,
  request_method = EXCLUDED.request_method,
  request_template_json = EXCLUDED.request_template_json,
  request_mapping_rules_json = EXCLUDED.request_mapping_rules_json,
  request_headers_template_json = EXCLUDED.request_headers_template_json,
  response_mapping_rules_json = EXCLUDED.response_mapping_rules_json,
  error_mapping_rules_json = EXCLUDED.error_mapping_rules_json,
  contract_profile_version = EXCLUDED.contract_profile_version,
  status = EXCLUDED.status,
  updated_at = NOW();

COMMIT;