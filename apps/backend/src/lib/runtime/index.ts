import type { ServerResponse } from 'node:http';
import type { GenerationAdapters } from '../adapters';

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
  const result = await runWithGenerationRetryPolicy(
    async () => runBackendGenerationSession(request, adapters, {
      onStreamEvent: (event) => {
        const payload = serializeSseEvent(event);
        sseFrames.push(payload);
        options.onSseEvent?.(payload, event);
      },
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
): AsyncIterable<string> => {
  return createSseReplayStream(async (pushFrame) => {
    await runWithGenerationRetryPolicy(
      async () => runBackendGenerationSession(request, adapters, {
        onStreamEvent: (event) => {
          pushFrame(serializeSseEvent(event));
        },
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
  options: NodeSsePipeOptions = {},
): Promise<void> => {
  const sseStream = handleGenerationRequestAsSseStream(request, adapters);
  await pipeSseStreamToNodeResponse(response, sseStream, options);
};

export const handleGenerationRequestAsJson = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
): Promise<{ ok: true; data: import('@gen-app-2/contracts').GenerationRunResponse } | { ok: false; error: import('./error-contract').BackendError }> => {
  const result = await runBackendGenerationSessionAsJson(request, adapters);

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

export type { BackendGenerationRequest } from './request-contract';
export type { BackendError } from './error-contract';
export type { BackendStreamEvent } from './stream-contract';
export type { BackendJsonSessionResult } from './backend-session';
export {
  createAuthHttpRuntime,
  type AuthHttpResponseBody,
  type AuthHttpRuntimeOptions,
  type HandleAuthHttpRequestResult,
} from './auth-http';
export {
  createDefaultAuthIdGenerator,
  createGoogleOAuthRuntime,
  createGoogleOAuthRuntimeFromEnv,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  type AuthIdGenerator,
  type AuthRuntimeContracts,
  type GoogleOAuthIdentity,
  type GoogleOAuthRuntime,
  type GoogleOAuthRuntimeOptions,
  type PasswordHashRuntime,
  type SessionCookieRuntime,
  type PasswordHashRuntimeOptions,
  type SessionCookieRuntimeOptions,
} from './auth-contract';
export {
  applySseHeaders,
  pipeSseStreamToNodeResponse,
  type NodeSsePipeOptions,
} from './http-sse';
export {
  createNodeRuntimeRequestHandler,
  createNodeRuntimeServer,
  type AuthHttpRequestHandler,
  type NodeRuntimeServerOptions,
} from './node-server';
export {
  BriefParseError,
  parseBriefInput,
  type ParseBriefInput,
  type ParseBriefOutput,
  type SupportedBriefFormat,
} from './brief-parser';
export {
  resolveToolPrompt,
  type ResolvedToolPrompt,
} from './tool-prompts';
