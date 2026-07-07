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
