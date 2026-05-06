import type {
  BackendStreamEvent,
  GenerationRequest,
} from '../contracts/backend-stream';
import {
  createSseFrameParser,
  parseBackendStreamEvent,
  SseProtocolError,
} from '../parser/sse-parser';
import { joinApiPath } from '../../../app/runtime/http-client';

type TransportErrorCode =
  | 'transport_pre_start'
  | 'transport_mid_stream'
  | 'protocol_error'
  | 'terminal_failed';

export class GenerationTransportError extends Error {
  code: TransportErrorCode;
  retryable: boolean;

  constructor(code: TransportErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'GenerationTransportError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type StreamGenerationOptions = {
  apiBaseUrl?: string;
  signal?: AbortSignal;
  onEvent: (event: BackendStreamEvent) => void;
};

export const normalizeTransportError = (error: unknown): GenerationTransportError => {
  if (error instanceof GenerationTransportError) {
    return error;
  }

  if (error instanceof SseProtocolError) {
    return new GenerationTransportError('protocol_error', error.message, false);
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new GenerationTransportError('transport_mid_stream', 'Request aborted', true);
  }

  return new GenerationTransportError(
    'transport_mid_stream',
    error instanceof Error ? error.message : 'Unknown transport error',
    true,
  );
};

export const streamGeneration = async (
  request: GenerationRequest,
  options: StreamGenerationOptions,
): Promise<void> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  };

  if (options.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetch(joinApiPath(apiBaseUrl, '/generation/stream'), requestInit);

  if (!response.ok) {
    throw new GenerationTransportError(
      'transport_pre_start',
      `HTTP ${response.status} while opening stream`,
      response.status >= 500,
    );
  }

  if (!response.body) {
    throw new GenerationTransportError('transport_pre_start', 'Missing response body', true);
  }

  const parser = createSseFrameParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let terminalSeen = false;

  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }

    const text = decoder.decode(next.value, { stream: true });
    const frames = parser.push(text);
    for (const frame of frames) {
      const event = parseBackendStreamEvent(frame);
      options.onEvent(event);
      if (event.event === 'terminal') {
        terminalSeen = true;
        if (event.data.status === 'failed') {
          throw new GenerationTransportError(
            'terminal_failed',
            event.data.reason ?? 'Terminal failed',
            false,
          );
        }
        return;
      }
    }
  }

  parser.flush().forEach((frame) => {
    const event = parseBackendStreamEvent(frame);
    options.onEvent(event);
    if (event.event === 'terminal') {
      terminalSeen = true;
    }
  });

  if (!terminalSeen) {
    throw new GenerationTransportError(
      'transport_mid_stream',
      'Connection closed before terminal event',
      true,
    );
  }
};
