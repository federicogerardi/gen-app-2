import type { ServerResponse } from 'node:http';

import { serializeSseEvent } from './stream-contract';

export type NodeSsePipeOptions = {
  closeOnComplete?: boolean;
  emitTerminalOnError?: boolean;
};

const SSE_CONTENT_TYPE = 'text/event-stream; charset=utf-8';
const SSE_CACHE_CONTROL = 'no-cache, no-transform';

export const applySseHeaders = (response: ServerResponse): void => {
  if (response.headersSent) {
    return;
  }

  response.statusCode = response.statusCode || 200;
  response.setHeader('Content-Type', SSE_CONTENT_TYPE);
  response.setHeader('Cache-Control', SSE_CACHE_CONTROL);
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
};

const writeFrame = async (response: ServerResponse, frame: string): Promise<void> => {
  if (response.writableEnded || response.destroyed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    response.write(frame, (error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

export const pipeSseStreamToNodeResponse = async (
  response: ServerResponse,
  sseFrames: AsyncIterable<string>,
  options: NodeSsePipeOptions = {},
): Promise<void> => {
  const { closeOnComplete = true, emitTerminalOnError = true } = options;

  applySseHeaders(response);

  try {
    for await (const frame of sseFrames) {
      if (response.writableEnded || response.destroyed) {
        break;
      }
      await writeFrame(response, frame);
    }
  } catch (error) {
    if (emitTerminalOnError && !response.writableEnded && !response.destroyed) {
      const terminalFrame = serializeSseEvent({
        event: 'terminal',
        data: {
          artifactId: null,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'stream_runtime_error',
        },
      });
      await writeFrame(response, terminalFrame);
    }

    if (closeOnComplete && !response.writableEnded && !response.destroyed) {
      response.end();
    }

    throw error;
  }

  if (closeOnComplete && !response.writableEnded && !response.destroyed) {
    response.end();
  }
};
