import { assign, setup } from 'xstate';

import type { RouteType } from './generation-routing';

export type GenerationFallbackInput = {
  reason: string | null;
  defaultReason: string;
  routeType: RouteType;
  hasContent: boolean;
  retryCount?: number;
  maxRetries?: number;
};

export type GenerationFallbackOutput = {
  reason: string;
  shouldRetry: boolean;
};

type GenerationFallbackContext = {
  input: GenerationFallbackInput;
  resolvedReason: string;
  shouldRetry: boolean;
};

const RETRYABLE_FAILURE_REASONS = new Set([
  'stream_failure',
  'stream_session_open_failed',
  'timeout',
  'network_error',
]);

const normalizeFailureReason = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveFallbackReason = (input: GenerationFallbackInput): string => {
  const reason = normalizeFailureReason(input.reason);
  if (reason) {
    return reason;
  }

  const defaultReason = normalizeFailureReason(input.defaultReason);
  if (defaultReason) {
    return defaultReason;
  }

  return 'generation_failed';
};

const resolveShouldRetry = (input: GenerationFallbackInput, resolvedReason: string): boolean => {
  if (!RETRYABLE_FAILURE_REASONS.has(resolvedReason)) {
    return false;
  }

  if (input.routeType === 'extraction' || input.hasContent) {
    return false;
  }

  const retryCount = Math.max(0, input.retryCount ?? 0);
  const maxRetries = Math.max(0, input.maxRetries ?? 0);
  return retryCount < maxRetries;
};

export const generationFallbackActor = setup({
  types: {
    context: {} as GenerationFallbackContext,
    input: {} as GenerationFallbackInput,
    output: {} as GenerationFallbackOutput,
  },
  actions: {
    evaluatePolicy: assign({
      resolvedReason: ({ context }) => resolveFallbackReason(context.input),
      shouldRetry: ({ context }) =>
        resolveShouldRetry(context.input, resolveFallbackReason(context.input)),
    }),
  },
}).createMachine({
  id: 'generationFallbackActor',
  initial: 'evaluating',
  output: ({ context }) => ({
    reason: context.resolvedReason,
    shouldRetry: context.shouldRetry,
  }),
  context: ({ input }) => ({
    input,
    resolvedReason: 'generation_failed',
    shouldRetry: false,
  }),
  states: {
    evaluating: {
      entry: 'evaluatePolicy',
      always: 'resolved',
    },
    resolved: {
      type: 'final',
    },
  },
});