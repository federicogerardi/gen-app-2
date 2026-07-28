import type { ToolKey } from '@gen-app-2/contracts';
import type { LlmModelId } from '@gen-app-2/contracts';

/**
 * StepLlmModelOverrideConfig — DDD-150
 * Static configuration of LLM model override for a specific tool step.
 *
 * When configured, takes precedence over user selection during generation.
 * Validated at startup against canonical registries.
 */
export type StepLlmModelOverrideConfig = {
  toolKey: ToolKey;
  stepKey: string;
  overrideModelId: LlmModelId;
  reason?: string;
  /** Maximum output tokens for this step. Provider default if omitted. */
  maxTokens?: number;
};

/**
 * Creates a deterministic lookup key for the override configuration map.
 * Format: `${toolKey}:${stepKey}`
 */
export const createOverrideKey = (toolKey: ToolKey, stepKey: string): string =>
  `${toolKey}:${stepKey}`;

/**
 * EffectiveModelResolution — DDD-152
 * Result of model resolution with metadata about decision source.
 * Used for transparency indicators and audit requirements.
 */
export type EffectiveModelResolution = {
  effectiveModel: LlmModelId;
  source: 'user-selection' | 'step-override';
  overrideReason?: string | undefined;
  originalUserModel?: LlmModelId | undefined;
  /** Maximum output tokens from step override config. Provider default if undefined. */
  maxTokens?: number | undefined;
};

/**
 * Metadata structure persisted in artifact input JSON for model tracking.
 * Stored under input_json.modelResolution when override is active.
 */
export type ArtifactModelMetadata = {
  effectiveModel: string;
  modelSource: 'user-selection' | 'step-override';
  originalUserModel?: string;
  overrideReason?: string;
};
