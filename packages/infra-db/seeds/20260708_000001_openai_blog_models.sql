-- Seed: 20260708_000001_openai_blog_models
-- Add OpenAI models for blog-article-generator tool (DDD-157)
-- Referenced models: gpt-4o-mini-search-preview, gpt-4o-search-preview, gpt-5.2

INSERT INTO llm_models (key, label, status, sort_order, is_default) VALUES
  ('openai/gpt-4o-mini-search-preview', 'GPT-4o Mini Search Preview', 'enabled', 4, FALSE),
  ('openai/gpt-4o-search-preview', 'GPT-4o Search Preview', 'enabled', 5, FALSE),
  ('openai/gpt-5.2', 'GPT-5.2', 'enabled', 6, FALSE)
ON CONFLICT (key) DO NOTHING;
