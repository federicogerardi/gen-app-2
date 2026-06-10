BEGIN;

ALTER TABLE api_services
  ADD COLUMN IF NOT EXISTS token_header_name VARCHAR(128);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_services_token_header_name_check'
  ) THEN
    ALTER TABLE api_services
      ADD CONSTRAINT api_services_token_header_name_check
      CHECK (
        token_header_name IS NULL
        OR (
          length(trim(token_header_name)) > 0
          AND token_header_name ~ '^[A-Za-z0-9!#$%&''*+.^_`|~-]+$'
        )
      );
  END IF;
END $$;

COMMIT;
