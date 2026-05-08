-- Migration: add is_default flag to llm_models
-- Allows dynamic configuration of the default LlmModel via admin panel.
-- DDD-056: LlmModelId default is no longer hardcoded; it is the model with is_default = TRUE.

ALTER TABLE llm_models
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce a single default at the database level (partial unique index: at most one TRUE).
CREATE UNIQUE INDEX IF NOT EXISTS llm_models_is_default_unique
  ON llm_models (is_default)
  WHERE is_default = TRUE;

-- Set the initial default: openrouter/auto (matches the former hardcoded value DDD-056).
-- No-op if the row does not exist yet (handled by the seed).
UPDATE llm_models
  SET is_default = TRUE
  WHERE key = 'openrouter/auto';
