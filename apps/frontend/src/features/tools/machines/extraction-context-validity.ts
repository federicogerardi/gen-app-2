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
  if (!hasNonEmptyString(normalizedText)) {
    console.warn('[isExtractionContextValidForTool] normalizedText vuoto o mancante', { toolKey, normalizedText });
    return false;
  }

  if (!options.allowEmptyPayload && !hasActionableExtractionPayload(payload)) {
    console.warn('[isExtractionContextValidForTool] extractionPayload vuoto o mancante', { toolKey, payload });
    return false;
  }

  if (toolKey === 'youtube-lf-script') {
    const valid = hasRequiredYoutubeExtractionFields(payload);
    if (!valid) {
      console.warn('[isExtractionContextValidForTool] Campi obbligatori mancanti per youtube-lf-script', { toolKey, payload });
    }
    return valid;
  }

  return true;
};
