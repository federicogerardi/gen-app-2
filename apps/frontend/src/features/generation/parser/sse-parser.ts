import type { BackendStreamEvent } from '../contracts/backend-stream';

export type SseFrame = {
  event: string;
  data: string;
};

export class SseProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SseProtocolError';
  }
}

export const createSseFrameParser = (): {
  push(chunk: string): SseFrame[];
  flush(): SseFrame[];
} => {
  let buffer = '';

  const parseBuffer = (flush: boolean): SseFrame[] => {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const separator = '\n\n';
    const frames: SseFrame[] = [];
    let cursor = 0;

    while (true) {
      const boundary = normalized.indexOf(separator, cursor);
      if (boundary < 0) {
        break;
      }

      const rawFrame = normalized.slice(cursor, boundary);
      cursor = boundary + separator.length;
      if (rawFrame.trim().length === 0) {
        continue;
      }

      const lines = rawFrame.split('\n');
      const eventLine = lines.find((line) => line.startsWith('event:'));
      const dataLines = lines.filter((line) => line.startsWith('data:'));

      if (!eventLine || dataLines.length === 0) {
        throw new SseProtocolError('Invalid SSE frame: missing event or data lines');
      }

      const event = eventLine.slice('event:'.length).trim();
      const data = dataLines
        .map((line) => line.slice('data:'.length).trim())
        .join('\n');

      if (event.length === 0 || data.length === 0) {
        throw new SseProtocolError('Invalid SSE frame: empty event or data');
      }

      frames.push({ event, data });
    }

    buffer = flush ? '' : normalized.slice(cursor);
    return frames;
  };

  return {
    push(chunk: string): SseFrame[] {
      buffer += chunk;
      return parseBuffer(false);
    },
    flush(): SseFrame[] {
      if (buffer.trim().length > 0 && !buffer.endsWith('\n\n')) {
        throw new SseProtocolError('Truncated SSE frame at end of stream');
      }

      return parseBuffer(true);
    },
  };
};

const ensureString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new SseProtocolError(`Invalid field ${field}`);
  }

  return value;
};

const ensureNullableString = (value: unknown, field: string): string | null => {
  if (value === null) {
    return null;
  }

  return ensureString(value, field);
};

export const parseBackendStreamEvent = (frame: SseFrame): BackendStreamEvent => {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(frame.data) as unknown;
  } catch {
    throw new SseProtocolError('Invalid JSON in data field');
  }

  if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
    throw new SseProtocolError('Invalid JSON payload shape');
  }

  const data = parsedData as Record<string, unknown>;

  if (frame.event === 'start') {
    return {
      event: 'start',
      data: {
        requestId: ensureString(data.requestId, 'requestId'),
        artifactId: ensureString(data.artifactId, 'artifactId'),
      },
    };
  }

  if (frame.event === 'chunk') {
    if (typeof data.sequence !== 'number' || !Number.isInteger(data.sequence) || data.sequence < 1) {
      throw new SseProtocolError('Invalid field sequence');
    }

    return {
      event: 'chunk',
      data: {
        artifactId: ensureString(data.artifactId, 'artifactId'),
        chunk: ensureString(data.chunk, 'chunk'),
        sequence: data.sequence,
      },
    };
  }

  if (frame.event === 'terminal') {
    const status = data.status;
    if (status !== 'completed' && status !== 'failed') {
      throw new SseProtocolError('Invalid terminal status');
    }

    return {
      event: 'terminal',
      data: {
        artifactId:
          data.artifactId === null
            ? null
            : ensureString(data.artifactId, 'artifactId'),
        status,
        reason: ensureNullableString(data.reason, 'reason'),
        completedStep: ensureNullableString(data.completedStep ?? null, 'completedStep'),
        failedStep: ensureNullableString(data.failedStep ?? null, 'failedStep'),
      },
    };
  }

  throw new SseProtocolError(`Unsupported event: ${frame.event}`);
};
