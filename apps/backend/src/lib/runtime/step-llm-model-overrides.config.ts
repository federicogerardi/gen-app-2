import type { ToolKey } from '@gen-app-2/contracts';

import type { StepLlmModelOverrideConfig } from '../types/step-llm-model-override';
import { createOverrideKey } from '../types/step-llm-model-override';

/**
 * Static configuration for per-step LLM model overrides.
 *
 * DDD-150: StepLlmModelOverrideConfig (Value Object, Generation context)
 *
 * This map is the single source of truth for step-specific model overrides.
 * Configuration is validated at startup against canonical registries.
 *
 * Precedence rules (DDD-151):
 * 1. Static Override: If configured for (toolKey, stepKey) and model enabled
 * 2. User Selection: User-selected model if enabled in catalog
 * 3. System Default: openrouter/auto fallback (DDD-046)
 *
 * To add an override for a new tool:
 * 1. Add entries to STEP_LLM_MODEL_OVERRIDES below
 * 2. Ensure overrideModelId exists in LlmModelCatalog
 * 3. Ensure toolKey exists in canonical ToolKey registry
 * 4. Submit for code review (governance through code review)
 */
export const STEP_LLM_MODEL_OVERRIDES: Record<string, StepLlmModelOverrideConfig> = {
  // Ready for future tools - initially empty
  // Template for future use:
  // [createOverrideKey('future-tool', 'extraction')]: {
  //   toolKey: 'future-tool',
  //   stepKey: 'extraction',
  //   overrideModelId: 'openrouter/anthropic/claude-3.5-sonnet',
  //   reason: 'Optimized for structured data extraction'
  // }

  // Blog Article Generator - DDD-157: Hardcoded LLM model overrides per step
  [createOverrideKey('blog-article-generator', 'blog_seo_structure')]: {
    toolKey: 'blog-article-generator',
    stepKey: 'blog_seo_structure',
    overrideModelId: 'openai/gpt-4o-search-preview',
    reason: 'Search-enabled for SEO structure generation (gpt-4o-mini variant deprecated by OpenAI)'
  },
  [createOverrideKey('blog-article-generator', 'blog_research')]: {
    toolKey: 'blog-article-generator',
    stepKey: 'blog_research',
    overrideModelId: 'openai/gpt-4o-search-preview',
    reason: 'Advanced search capabilities for comprehensive research'
  },
  [createOverrideKey('blog-article-generator', 'blog_article')]: {
    toolKey: 'blog-article-generator',
    stepKey: 'blog_article',
    overrideModelId: 'openai/gpt-5.2',
    reason: 'Large context, advanced reasoning for article composition'
  },

  // Geometric — full reports with competitor tables and CSV dataset
  [createOverrideKey('geometric', 'strategic-reporting')]: {
    toolKey: 'geometric',
    stepKey: 'strategic-reporting',
    overrideModelId: 'openrouter/auto',
    reason: 'SERP intelligence analysis with competitor ranking context',
    maxTokens: 4096,
  },
  [createOverrideKey('geometric', 'unified-report')]: {
    toolKey: 'geometric',
    stepKey: 'unified-report',
    overrideModelId: 'openrouter/auto',
    reason: 'Full unified report with all competitor tiers, markdown tables, and CSV dataset',
    maxTokens: 8192,
  },
} as const;

/**
 * Type-safe accessor for override configuration.
 * Returns undefined if no override is configured for the given tool/step combination.
 */
export const getStepOverride = (
  toolKey: ToolKey,
  stepKey: string,
): StepLlmModelOverrideConfig | undefined => {
  const key = createOverrideKey(toolKey, stepKey);
  return STEP_LLM_MODEL_OVERRIDES[key];
};

/**
 * Returns all configured override keys for validation and debugging.
 */
export const getAllOverrideKeys = (): string[] =>
  Object.keys(STEP_LLM_MODEL_OVERRIDES);

/**
 * Returns all configured overrides for validation and debugging.
 */
export const getAllOverrides = (): StepLlmModelOverrideConfig[] =>
  Object.values(STEP_LLM_MODEL_OVERRIDES);
