-- Seed: 20260508_000002_llm_models
-- Initial LlmModel entries for LlmModelCatalog.
-- DDD-056: LlmModelId default is stored in the is_default column, initially 'openrouter/auto'.

INSERT INTO llm_models (key, label, status, sort_order, is_default) VALUES
  ('openrouter/auto', 'OpenRouter Auto', 'enabled', 1, TRUE),
  ('gpt-4.1-mini', 'GPT-4.1 Mini', 'enabled', 2, FALSE),
  ('claude-3.7-sonnet', 'Claude 3.7 Sonnet', 'disabled', 3, FALSE)
ON CONFLICT (key) DO NOTHING;
