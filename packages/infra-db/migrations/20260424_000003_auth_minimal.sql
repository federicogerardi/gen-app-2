BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_algo text,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_admin_user_id text REFERENCES users(id) ON DELETE SET NULL;

UPDATE users
SET email = id || '@local.invalid'
WHERE email IS NULL;

ALTER TABLE users
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_valid'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_valid
      CHECK (role IN ('admin', 'member'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_status_valid'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_status_valid
      CHECK (status IN ('active', 'disabled', 'pending_password_reset'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_password_columns_consistent'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_password_columns_consistent
      CHECK (
        (password_hash IS NULL AND password_algo IS NULL)
        OR (password_hash IS NOT NULL AND password_algo IS NOT NULL)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply auth migration: duplicate case-insensitive users.email values detected';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  auth_method text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_auth_method_valid
    CHECK (auth_method IN ('native', 'google'))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique_idx
  ON auth_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_user_lookup_idx
  ON auth_sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS auth_sessions_active_lookup_idx
  ON auth_sessions (user_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email_at_provider text,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT oauth_accounts_provider_valid CHECK (provider IN ('google')),
  CONSTRAINT oauth_accounts_provider_subject_unique UNIQUE (provider, provider_subject),
  CONSTRAINT oauth_accounts_provider_user_unique UNIQUE (provider, user_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_lookup_idx
  ON oauth_accounts (user_id);

CREATE TABLE IF NOT EXISTS oauth_state_tokens (
  state text PRIMARY KEY,
  provider text NOT NULL,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  requested_by_ip inet,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT oauth_state_tokens_provider_valid CHECK (provider IN ('google'))
);

CREATE INDEX IF NOT EXISTS oauth_state_tokens_expiry_idx
  ON oauth_state_tokens (provider, expires_at);

CREATE INDEX IF NOT EXISTS oauth_state_tokens_consumable_idx
  ON oauth_state_tokens (provider, consumed_at, expires_at);

COMMIT;