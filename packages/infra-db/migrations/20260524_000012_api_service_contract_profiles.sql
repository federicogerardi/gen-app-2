BEGIN;

ALTER TABLE api_services
  ADD COLUMN IF NOT EXISTS request_method VARCHAR(16) NOT NULL DEFAULT 'GET',
  ADD COLUMN IF NOT EXISTS request_template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_mapping_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS request_headers_template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS response_mapping_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error_mapping_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_profile_version INT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_request_method_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_request_method_check
      CHECK (request_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_request_template_json_type_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_request_template_json_type_check
      CHECK (jsonb_typeof(request_template_json) = 'object');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_request_mapping_rules_json_type_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_request_mapping_rules_json_type_check
      CHECK (jsonb_typeof(request_mapping_rules_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_request_headers_template_json_type_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_request_headers_template_json_type_check
      CHECK (jsonb_typeof(request_headers_template_json) = 'object');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_response_mapping_rules_json_type_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_response_mapping_rules_json_type_check
      CHECK (jsonb_typeof(response_mapping_rules_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_error_mapping_rules_json_type_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_error_mapping_rules_json_type_check
      CHECK (jsonb_typeof(error_mapping_rules_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_contract_profile_version_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_contract_profile_version_check
      CHECK (contract_profile_version >= 1);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS api_service_tool_step_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_service_id UUID NOT NULL REFERENCES api_services(id) ON DELETE CASCADE,
  tool_key VARCHAR(128) NOT NULL,
  step_key VARCHAR(128) NOT NULL,
  workflow_step_type VARCHAR(32) NOT NULL DEFAULT 'acquisition',
  binding_status VARCHAR(32) NOT NULL DEFAULT 'active',
  requiredness VARCHAR(64) NOT NULL DEFAULT 'required-by-tool-setting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_service_tool_step_bindings_unique_service_tool_step UNIQUE (api_service_id, tool_key, step_key),
  CONSTRAINT api_service_tool_step_bindings_workflow_step_type_check CHECK (workflow_step_type IN ('acquisition')),
  CONSTRAINT api_service_tool_step_bindings_status_check CHECK (binding_status IN ('active', 'inactive')),
  CONSTRAINT api_service_tool_step_bindings_requiredness_check CHECK (
    requiredness IN ('always-required', 'required-by-tool-setting', 'optional-by-tool-setting')
  )
);

CREATE INDEX IF NOT EXISTS idx_api_service_tool_step_bindings_tool_key
  ON api_service_tool_step_bindings(tool_key);

CREATE INDEX IF NOT EXISTS idx_api_service_tool_step_bindings_step_key
  ON api_service_tool_step_bindings(step_key);

CREATE INDEX IF NOT EXISTS idx_api_service_tool_step_bindings_status
  ON api_service_tool_step_bindings(binding_status);

COMMIT;
