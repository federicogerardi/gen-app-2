import type { SupportedTool } from './tool-flow.machine';
import {
  ReadinessRequiredExtractionFieldKeysByTool,
  normalizeExtractionFieldKeysForTool,
} from '../runtime/extraction-field-matrix';

type ExtractionContextValidityOptions = {
  allowEmptyPayload?: boolean;
};

const READINESS_LOGGING_OVERRIDE_KEY = '__TOOL_PAGE_READINESS_LOGGING_ENABLED__';

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const shouldLogExtractionContextWarnings = (): boolean => {
  const override = (globalThis as Record<string, unknown>)[READINESS_LOGGING_OVERRIDE_KEY];
  if (typeof override === 'boolean') {
    return override;
  }

  return import.meta.env.DEV;
};

export const hasActionableExtractionPayload = (
  payload: Record<string, unknown> | null | undefined,
): boolean => {
  if (!payload) {
    return false;
  }

  return Object.keys(payload).length > 0;
};

export const hasRequiredExtractionFields = (
  payload: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): boolean => {
  if (!payload) {
    return false;
  }

  return keys.every((field) => hasNonEmptyString(payload[field]));
};

export const isExtractionContextValidForTool = (
  toolKey: SupportedTool,
  payload: Record<string, unknown> | null | undefined,
  normalizedText: string | null | undefined,
  options: ExtractionContextValidityOptions = {},
): boolean => {
  const normalizedPayload = normalizeExtractionFieldKeysForTool(toolKey, payload);

  const logInvalidContext = (
    message: string,
    details: {
      normalizedTextLength: number;
      extractionPayloadKeys: number;
    },
  ): void => {
    if (!shouldLogExtractionContextWarnings()) {
      return;
    }

    console.warn(message, {
      toolKey,
      ...details,
    });
  };

  if (!hasNonEmptyString(normalizedText)) {
    logInvalidContext('[isExtractionContextValidForTool] normalizedText vuoto o mancante', {
      normalizedTextLength: typeof normalizedText === 'string' ? normalizedText.length : 0,
      extractionPayloadKeys: Object.keys(normalizedPayload).length,
    });
    return false;
  }

  if (!options.allowEmptyPayload && !hasActionableExtractionPayload(normalizedPayload)) {
    logInvalidContext('[isExtractionContextValidForTool] extractionPayload vuoto o mancante', {
      normalizedTextLength: typeof normalizedText === 'string' ? normalizedText.length : 0,
      extractionPayloadKeys: Object.keys(normalizedPayload).length,
    });
    return false;
  }

  const requiredFieldKeys = ReadinessRequiredExtractionFieldKeysByTool[toolKey];
  const valid = hasRequiredExtractionFields(normalizedPayload, requiredFieldKeys);
  if (!valid) {
    logInvalidContext(
      `[isExtractionContextValidForTool] Campi obbligatori mancanti per ${toolKey}`,
      {
        normalizedTextLength: typeof normalizedText === 'string' ? normalizedText.length : 0,
        extractionPayloadKeys: Object.keys(normalizedPayload).length,
      },
    );
  }
  return valid;
};
