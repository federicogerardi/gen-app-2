import type { ServerResponse } from 'node:http';
import type { GenerationAdapters } from '../adapters';

import {
  runBackendGenerationSession,
  type BackendSessionResult,
} from './backend-session';
import {
  pipeSseStreamToNodeResponse,
  type NodeSsePipeOptions,
} from './http-sse';
import type { BackendGenerationRequest } from './request-contract';
import { serializeSseEvent } from './stream-contract';

export type HandleGenerationRequestResult = BackendSessionResult & {
  ssePayload: string;
};

export type HandleGenerationRequestOptions = {
  onSseEvent?: (payload: string, event: BackendSessionResult['streamEvents'][number]) => void;
};

export const handleGenerationRequest = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: HandleGenerationRequestOptions = {},
): Promise<HandleGenerationRequestResult> => {
  const sseFrames: string[] = [];
  const result = await runBackendGenerationSession(request, adapters, {
    onStreamEvent: (event) => {
      const payload = serializeSseEvent(event);
      sseFrames.push(payload);
      options.onSseEvent?.(payload, event);
    },
  });

  return {
    ...result,
    ssePayload: sseFrames.join(''),
  };
};

export const handleGenerationRequestAsSseStream = (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
): AsyncIterable<string> => {
  return (async function* () {
    const frameQueue: string[] = [];
    let finished = false;
    let failure: unknown = null;
    let notify: (() => void) | null = null;

    const wakeConsumer = () => {
      notify?.();
      notify = null;
    };

    const sessionPromise = runBackendGenerationSession(request, adapters, {
      onStreamEvent: (event) => {
        frameQueue.push(serializeSseEvent(event));
        wakeConsumer();
      },
    })
      .catch((error: unknown) => {
        failure = error;
      })
      .finally(() => {
        finished = true;
        wakeConsumer();
      });

    while (!finished || frameQueue.length > 0) {
      if (frameQueue.length === 0) {
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
        continue;
      }

      const nextFrame = frameQueue.shift();
      if (typeof nextFrame === 'string') {
        yield nextFrame;
      }
    }

    await sessionPromise;
    if (failure) {
      throw failure;
    }
  })();
};

export const handleGenerationRequestAsNodeSse = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: NodeSsePipeOptions = {},
): Promise<void> => {
  const sseStream = handleGenerationRequestAsSseStream(request, adapters);
  await pipeSseStreamToNodeResponse(response, sseStream, options);
};

export type { BackendGenerationRequest } from './request-contract';
export type { BackendError } from './error-contract';
export type { BackendStreamEvent } from './stream-contract';
export {
  applySseHeaders,
  pipeSseStreamToNodeResponse,
  type NodeSsePipeOptions,
} from './http-sse';
