import { appCopy } from '../../../app/copy/system';
import type { LlmModelId, ToneProfile } from '@gen-app-2/contracts';

const TONE_PROFILE_DEFAULT = 'Professional';
const TONE_PROFILE_ALLOWED = ['Professional', 'Casual', 'Formal', 'Technical'] as const;

export const normalizeModelForPayload = (model: string, fallbackModel: string): LlmModelId => {
  const normalized = model.trim();
  if (normalized.length === 0) {
    return normalizeModelForPayload(fallbackModel, 'openrouter/auto');
  }

  if (normalized.includes('/')) {
    return normalized as LlmModelId;
  }

  if (normalized.includes(':')) {
    const [provider, ...rest] = normalized.split(':');
    if (provider && rest.length > 0) {
      return `${provider}/${rest.join(':')}` as LlmModelId;
    }
  }

  return `openrouter/${normalized}` as LlmModelId;
};

export const normalizeToneProfile = (
  tone: string,
  fallbackTone: ToneProfile = TONE_PROFILE_DEFAULT,
): ToneProfile => {
  const normalized = tone.trim().toLowerCase();
  if (normalized.length === 0) {
    return fallbackTone;
  }

  const match = TONE_PROFILE_ALLOWED.find((candidate) => candidate.toLowerCase() === normalized);
  return match ?? fallbackTone;
};

export const mapInlineDispatchError = (reason: string | null | undefined): string | null => {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === 'extraction_context_insufficient' || normalized === 'stream_empty_output') {
    return appCopy.ui.toolPage.runtimeErrors.briefingContextInsufficient;
  }

  if (normalized.startsWith('terminal_failed')) {
    return appCopy.ui.toolPage.runtimeErrors.streamFailed;
  }

  return normalized;
};

export const isEmptyPayload = (payload: Record<string, unknown>): boolean =>
  Object.keys(payload).length === 0;
