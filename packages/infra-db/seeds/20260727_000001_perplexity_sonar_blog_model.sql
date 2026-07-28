-- Seed: 20260727_000001_perplexity_sonar_blog_model
-- Add perplexity/sonar-pro-search for blog-article-generator step overrides (DDD-157 revision)
INSERT INTO llm_models (key, label, status, sort_order, is_default) VALUES
  ('perplexity/sonar-pro-search', 'Perplexity Sonar Pro Search', 'enabled', 7, FALSE)
ON CONFLICT (key) DO NOTHING;
