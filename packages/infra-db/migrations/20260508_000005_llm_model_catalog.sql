-- Migration: 20260508_000005_llm_model_catalog
-- Creates the llm_models table for the LlmModelCatalog bounded context.
-- DDD-053..DDD-057: LlmModel, LlmModelStatus, LlmModelCatalog, LlmModelId, LlmModelSelector.

CREATE TABLE IF NOT EXISTS llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(128) UNIQUE NOT NULL,
  label VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'enabled',
  sort_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT llm_models_status_check CHECK (status IN ('enabled', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_llm_models_status ON llm_models(status);
