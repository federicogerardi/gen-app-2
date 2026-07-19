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

export type DispatchErrorReasonCode =
  | 'idempotency_conflict'
  | 'extraction_context_insufficient'
  | 'stream_empty_output'
  | 'terminal_failed'
  | 'timeout'
  | 'connection_lost';

export const mapInlineDispatchError = (reason: string | null | undefined): string | null => {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim();
  if (normalized.length === 0) {
    return null;
  }

  const reasonCode = normalizeToDispatchErrorReasonCode(normalized);
  if (reasonCode === null) {
    return normalized;
  }
  return mapReasonCodeToMessage(reasonCode);
};

const normalizeToDispatchErrorReasonCode = (reason: string): DispatchErrorReasonCode | null => {
  if (reason === 'extraction_context_insufficient' || reason === 'stream_empty_output') {
    return reason;
  }

  if (reason === 'idempotency_conflict') {
    return reason;
  }

  if (reason.startsWith('terminal_failed')) {
    return 'terminal_failed';
  }

  if (reason.includes('ECONNRESET') || reason.includes('AbortError') || reason.includes('TimeoutError')) {
    return 'timeout';
  }

  if (reason.includes('ECONNREFUSED') || reason.includes('socket hang up')) {
    return 'connection_lost';
  }

  return null;
};

const mapReasonCodeToMessage = (code: DispatchErrorReasonCode): string => {
  switch (code) {
    case 'idempotency_conflict':
      return appCopy.ui.toolPage.runtimeErrors.idempotencyConflict;
    case 'extraction_context_insufficient':
    case 'stream_empty_output':
      return appCopy.ui.toolPage.runtimeErrors.briefingContextInsufficient;
    case 'terminal_failed':
      return appCopy.ui.toolPage.runtimeErrors.streamFailed;
    case 'timeout':
      return appCopy.ui.toolPage.runtimeErrors.timeout;
    case 'connection_lost':
      return appCopy.ui.toolPage.runtimeErrors.connectionLost;
  }
};

export const isEmptyPayload = (payload: Record<string, unknown>): boolean =>
  Object.keys(payload).length === 0;
