import type { LlmModelId, ToolKey } from '@gen-app-2/contracts';

import type { EffectiveModelResolution } from '../types/step-llm-model-override';
import { getStepOverride } from './step-llm-model-overrides.config';

/**
 * StepLlmModelResolver — DDD-151
 * Domain Service for determining the effective LLM model for a given tool step.
 *
 * Implements precedence rules:
 * 1. Static Override: If configured for (toolKey, stepKey) and model enabled
 * 2. User Selection: User-selected model if enabled in catalog
 * 3. System Default: openrouter/auto fallback (DDD-046)
 *
 * Operates synchronously using in-memory configuration for optimal performance.
 * Performance target: < 10ms (in-memory lookup).
 */
export interface StepLlmModelResolver {
  resolveEffectiveModel(
    toolKey: ToolKey,
    stepKey: string,
    userSelectedModel: LlmModelId,
  ): EffectiveModelResolution;
}

/**
 * Implementation of StepLlmModelResolver using static configuration
 * and model availability checking.
 */
export class StepLlmModelResolverImpl implements StepLlmModelResolver {
  constructor(
    private readonly checkModelAvailability: (modelKey: string) => boolean,
  ) {}

  resolveEffectiveModel(
    toolKey: ToolKey,
    stepKey: string,
    userSelectedModel: LlmModelId,
  ): EffectiveModelResolution {
    // 1. Check static override
    const override = getStepOverride(toolKey, stepKey);

    if (override) {
      const isOverrideModelEnabled = this.checkModelAvailability(override.overrideModelId);
      if (isOverrideModelEnabled) {
        return {
          effectiveModel: override.overrideModelId,
          source: 'step-override',
          overrideReason: override.reason,
          originalUserModel: userSelectedModel,
          maxTokens: override.maxTokens,
        };
      }
    }

    // 2. Use user selection with validation
    const isUserModelEnabled = this.checkModelAvailability(userSelectedModel);
    return {
      effectiveModel: isUserModelEnabled ? userSelectedModel : 'openrouter/auto',
      source: 'user-selection',
    };
  }
}

/**
 * Creates a StepLlmModelResolver instance with the provided model availability checker.
 * Factory function for dependency injection.
 */
export const createStepLlmModelResolver = (
  checkModelAvailability: (modelKey: string) => boolean,
): StepLlmModelResolver =>
  new StepLlmModelResolverImpl(checkModelAvailability);
