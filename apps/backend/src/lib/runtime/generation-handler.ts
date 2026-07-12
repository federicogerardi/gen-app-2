import type { ServerResponse } from 'node:http';
import type { GenerationAdapters } from '../adapters/generation';

import {
  runBackendGenerationSession,
  runBackendGenerationSessionAsJson,
  type BackendSessionResult,
} from './backend-session';
import {
  pipeSseStreamToNodeResponse,
  type NodeSsePipeOptions,
} from './http-sse';
import {
  runWithGenerationRetryPolicy,
} from './generation-session-retry-policy';
import {
  createSseReplayStream,
} from './generation-stream-replay';
import type { BackendGenerationRequest } from './request-contract';
import type { StepLlmModelResolver } from './step-llm-model-resolver';
import { serializeSseEvent } from './stream-contract';

export type HandleGenerationRequestResult = BackendSessionResult & {
  ssePayload: string;
};

export type HandleGenerationRequestOptions = {
  onSseEvent?: (payload: string, event: BackendSessionResult['streamEvents'][number]) => void;
  modelResolver?: StepLlmModelResolver | undefined;
};

export const handleGenerationRequest = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: HandleGenerationRequestOptions = {},
): Promise<HandleGenerationRequestResult> => {
  const sseFrames: string[] = [];
  const result = await runWithGenerationRetryPolicy(
    async () => runBackendGenerationSession(request, adapters, {
      onStreamEvent: (event) => {
        const payload = serializeSseEvent(event);
        sseFrames.push(payload);
        options.onSseEvent?.(payload, event);
      },
      modelResolver: options.modelResolver,
    }),
    {
      maxAttempts: 1,
      onEscalation: (error) => {
        console.error('[gen][session-escalation] request failed without retry', {
          requestId: request.requestId,
          error,
        });
      },
    },
  );

  return {
    ...result,
    ssePayload: sseFrames.join(''),
  };
};

export const handleGenerationRequestAsSseStream = (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: HandleGenerationRequestOptions = {},
): AsyncIterable<string> => {
  return createSseReplayStream(async (pushFrame) => {
    await runWithGenerationRetryPolicy(
      async () => runBackendGenerationSession(request, adapters, {
        onStreamEvent: (event) => {
          pushFrame(serializeSseEvent(event));
        },
        modelResolver: options.modelResolver,
      }),
      {
        maxAttempts: 1,
        onEscalation: (error) => {
          console.error('[gen][session-escalation] stream failed without retry', {
            requestId: request.requestId,
            error,
          });
        },
      },
    );
  });
};

export const handleGenerationRequestAsNodeSse = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: NodeSsePipeOptions & { modelResolver?: StepLlmModelResolver | undefined } = {},
): Promise<void> => {
  const sseStream = handleGenerationRequestAsSseStream(request, adapters, {
    modelResolver: options.modelResolver,
  });
  await pipeSseStreamToNodeResponse(response, sseStream, options);
};

export const handleGenerationRequestAsJson = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: HandleGenerationRequestOptions = {},
): Promise<{ ok: true; data: import('@gen-app-2/contracts').GenerationRunResponse } | { ok: false; error: import('./error-contract').BackendError }> => {
  const result = await runBackendGenerationSessionAsJson(request, adapters, {
    modelResolver: options.modelResolver,
  });

  if (result.status === 'completed') {
    return {
      ok: true,
      data: {
        artifactId: result.artifactId ?? '',
        content: result.content,
        status: 'completed',
      },
    };
  }

  return {
    ok: false,
    error: result.error ?? { code: 'generation_failed', message: result.content || 'generation_failed', retryable: false },
  };
};
