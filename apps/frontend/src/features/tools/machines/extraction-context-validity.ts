import type { SupportedTool } from './tool-flow.machine';

const YOUTUBE_REQUIRED_EXTRACTION_FIELDS = [
  'knowledge_content',
  'avatar',
  'pain_point',
  'offer',
  'proof',
] as const;

type ExtractionContextValidityOptions = {
  allowEmptyPayload?: boolean;
};

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

export const hasActionableExtractionPayload = (
  payload: Record<string, unknown> | null | undefined,
): boolean => {
  if (!payload) {
    return false;
  }

  return Object.keys(payload).length > 0;
};

const hasRequiredYoutubeExtractionFields = (
  payload: Record<string, unknown> | null | undefined,
): boolean => {
  if (!payload) {
    return false;
  }

  return YOUTUBE_REQUIRED_EXTRACTION_FIELDS.every((field) => hasNonEmptyString(payload[field]));
};

export const isExtractionContextValidForTool = (
  toolKey: SupportedTool,
  payload: Record<string, unknown> | null | undefined,
  normalizedText: string | null | undefined,
  options: ExtractionContextValidityOptions = {},
): boolean => {
  const logInvalidContext = (
    message: string,
    details: {
      normalizedTextLength: number;
      extractionPayloadKeys: number;
    },
  ): void => {
    if (!import.meta.env.DEV) {
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
      extractionPayloadKeys: Object.keys(payload ?? {}).length,
    });
    return false;
  }

  if (!options.allowEmptyPayload && !hasActionableExtractionPayload(payload)) {
    logInvalidContext('[isExtractionContextValidForTool] extractionPayload vuoto o mancante', {
      normalizedTextLength: typeof normalizedText === 'string' ? normalizedText.length : 0,
      extractionPayloadKeys: Object.keys(payload ?? {}).length,
    });
    return false;
  }

  if (toolKey === 'youtube-lf-script') {
    const valid = hasRequiredYoutubeExtractionFields(payload);
    if (!valid) {
      logInvalidContext(
        '[isExtractionContextValidForTool] Campi obbligatori mancanti per youtube-lf-script',
        {
          normalizedTextLength: typeof normalizedText === 'string' ? normalizedText.length : 0,
          extractionPayloadKeys: Object.keys(payload ?? {}).length,
        },
      );
    }
    return valid;
  }

  return true;
};
