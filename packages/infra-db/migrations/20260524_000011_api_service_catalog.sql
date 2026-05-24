BEGIN;

CREATE TABLE IF NOT EXISTS api_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(128) UNIQUE NOT NULL,
  label VARCHAR(256) NOT NULL,
  base_url TEXT NOT NULL,
  resource_path TEXT NOT NULL,
  access_mode VARCHAR(32) NOT NULL,
  timeout_ms INT NOT NULL DEFAULT 10000,
  retry_count INT NOT NULL DEFAULT 1,
  token_ref VARCHAR(256),
  token_ciphertext TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_services_access_mode_check CHECK (access_mode IN ('public', 'token')),
  CONSTRAINT api_services_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT api_services_timeout_ms_check CHECK (timeout_ms >= 100 AND timeout_ms <= 120000),
  CONSTRAINT api_services_retry_count_check CHECK (retry_count >= 0 AND retry_count <= 5)
);

CREATE INDEX IF NOT EXISTS idx_api_services_status ON api_services(status);
CREATE INDEX IF NOT EXISTS idx_api_services_access_mode ON api_services(access_mode);

COMMIT;
