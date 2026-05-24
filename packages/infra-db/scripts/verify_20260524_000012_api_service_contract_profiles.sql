DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'request_method'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.request_method';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'request_template_json'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.request_template_json';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'request_mapping_rules_json'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.request_mapping_rules_json';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'request_headers_template_json'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.request_headers_template_json';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'response_mapping_rules_json'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.response_mapping_rules_json';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'error_mapping_rules_json'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.error_mapping_rules_json';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_services'
      AND column_name = 'contract_profile_version'
  ) THEN
    RAISE EXCEPTION 'missing column: api_services.contract_profile_version';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'api_service_tool_step_bindings'
  ) THEN
    RAISE EXCEPTION 'missing table: api_service_tool_step_bindings';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_service_tool_step_bindings_unique_service_tool_step'
  ) THEN
    RAISE EXCEPTION 'missing unique constraint: api_service_tool_step_bindings_unique_service_tool_step';
  END IF;
END $$;
