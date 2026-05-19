import type { OutputFormat } from '../types/artifact';
import type { RequestReceivedEvent } from '../types/xstate';

export const defaultArtifactIdFactory = (): string =>
  `artifact-${Math.random().toString(36).slice(2, 10)}`;

export const normalizeOutputFormat = (value: unknown): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

export const defaultResponseBuilder = (request: RequestReceivedEvent): string => {
  const prompt = request.input?.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${request.requestId}`;
};