import type { ToolKey } from '@gen-app-2/contracts';
import { isToolKey } from '@gen-app-2/contracts';

import type { BackendGenerationRequest } from './request-contract';

/**
 * Extracts the step key from a generation request payload.
 * Returns null for non-step requests (extraction, etc.).
 *
 * The step key is used to determine if a model override should be applied.
 */
export const extractStepKeyFromRequest = (
  request: BackendGenerationRequest,
): string | null => {
  const input = request.input;
  if (!input || typeof input !== 'object') {
    return null;
  }

  const step = input.step;
  if (typeof step === 'string' && step.trim().length > 0) {
    return step.trim();
  }

  return null;
};

/**
 * Extracts the tool key from a generation request payload.
 * Returns null for non-tool requests (extraction, etc.).
 */
export const extractToolKeyFromRequest = (
  request: BackendGenerationRequest,
): ToolKey | null => {
  const rawToolKey = request.toolKey;
  if (typeof rawToolKey === 'string' && isToolKey(rawToolKey)) {
    return rawToolKey;
  }

  return null;
};

/**
 * Result of extracting tool and step context from a generation request.
 */
export type RequestStepContext = {
  toolKey: ToolKey;
  stepKey: string;
} | null;

/**
 * Extracts both tool key and step key from a generation request.
 * Returns null if either is missing (non-step requests).
 */
export const extractRequestStepContext = (
  request: BackendGenerationRequest,
): RequestStepContext => {
  const toolKey = extractToolKeyFromRequest(request);
  if (!toolKey) {
    return null;
  }

  const stepKey = extractStepKeyFromRequest(request);
  if (!stepKey) {
    return null;
  }

  return { toolKey, stepKey };
};
