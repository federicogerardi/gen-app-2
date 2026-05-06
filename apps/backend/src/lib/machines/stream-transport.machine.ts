import { assign, fromCallback, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';

import type {
  StreamChunkMetadata,
  StreamHeartbeatDueEvent,
  StreamSessionStartedEvent,
  StreamTerminatedFailureEvent,
  StreamTerminatedSuccessEvent,
  StreamTransportEvent,
  StreamTransportInput,
} from '../types/xstate';

type StreamTransportMachineContext = {
  input: StreamTransportMachineInput;
  sequence: number;
  lastChunk: string;
  generatedContent: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  failureReason: string | null;
  sessionId: string | null;
};

type StreamTransportMachineInput = StreamTransportInput & {
  requestInput: Record<string, unknown>;
  adapters: Pick<GenerationAdapters, 'stream' | 'llm'>;
};

type StreamTransportMachineEvent =
  | { type: 'STREAM_READY' }
  | { type: 'STREAM_CHUNK'; chunk: string }
  | { type: 'STREAM_HEARTBEAT'; estimatedInputTokens: number; estimatedOutputTokens: number; costEstimate: number }
  | { type: 'STREAM_COMPLETE'; inputTokens?: number; outputTokens?: number; costUsd?: number }
  | { type: 'STREAM_FAIL'; reason: string }
  | { type: 'STREAM_TIMEOUT' }
  | { type: 'CLIENT_DISCONNECT' };

const nowIso = (): string => new Date().toISOString();

export const streamTransportMachine = setup({
  types: {
    context: {} as StreamTransportMachineContext,
    input: {} as StreamTransportMachineInput,
    events: {} as StreamTransportMachineEvent,
    output: {} as StreamTransportEvent,
  },
  actors: {
    openStreamSession: fromPromise(async ({ input }: { input: StreamTransportMachineInput }) => {
      return input.adapters.stream.openSession(input);
    }),
    streamLlmResponse: fromCallback(
      ({ input, sendBack }: {
        input: StreamTransportMachineInput;
        sendBack: (event: StreamTransportMachineEvent) => void;
      }) => {
      const abortController = new AbortController();

      void (async () => {
        try {
          for await (const event of input.adapters.llm.streamText({
            requestId: input.requestId,
            model: input.model,
            outputFormat: input.outputFormat,
            requestInput: input.requestInput,
            signal: abortController.signal,
          })) {
            if (event.type === 'chunk') {
              sendBack({ type: 'STREAM_CHUNK', chunk: event.chunk });
              continue;
            }

            if (event.type === 'heartbeat') {
              sendBack({
                type: 'STREAM_HEARTBEAT',
                estimatedInputTokens: event.estimatedInputTokens,
                estimatedOutputTokens: event.estimatedOutputTokens,
                costEstimate: event.costEstimate,
              });
              continue;
            }

            sendBack({
              type: 'STREAM_COMPLETE',
              ...(event.usage
                ? {
                    inputTokens: event.usage.inputTokens,
                    outputTokens: event.usage.outputTokens,
                    costUsd: event.usage.costUsd,
                  }
                : {}),
            });
          }
        } catch (error) {
          sendBack({
            type: 'STREAM_FAIL',
            reason: error instanceof Error ? error.message : 'llm_stream_failed',
          });
        }
      })();

      return () => {
        abortController.abort();
      };
      },
    ),
  },
  actions: {
    incrementSequence: assign({
      sequence: ({ context }) => context.sequence + 1,
    }),
    cacheChunk: assign({
      lastChunk: ({ event }) => ('chunk' in event ? event.chunk : ''),
    }),
    appendGeneratedChunk: assign({
      generatedContent: ({ context, event }) =>
        event.type === 'STREAM_CHUNK' ? `${context.generatedContent}${event.chunk}` : context.generatedContent,
      outputTokens: ({ context, event }) =>
        event.type === 'STREAM_CHUNK'
          ? Math.max(context.outputTokens, Math.ceil((context.generatedContent.length + event.chunk.length) / 4))
          : context.outputTokens,
    }),
    cacheUsageMetrics: assign({
      inputTokens: ({ context, event }) =>
        event.type === 'STREAM_HEARTBEAT'
          ? event.estimatedInputTokens
          : event.type === 'STREAM_COMPLETE'
            ? event.inputTokens ?? context.inputTokens
            : context.inputTokens,
      outputTokens: ({ context, event }) =>
        event.type === 'STREAM_HEARTBEAT'
          ? event.estimatedOutputTokens
          : event.type === 'STREAM_COMPLETE'
            ? event.outputTokens ?? context.outputTokens
            : context.outputTokens,
      costUsd: ({ context, event }) =>
        event.type === 'STREAM_HEARTBEAT'
          ? event.costEstimate
          : event.type === 'STREAM_COMPLETE'
            ? event.costUsd ?? context.costUsd
            : context.costUsd,
    }),
    setFailureReason: assign({
      failureReason: ({ event }) => {
        if (event.type === 'STREAM_FAIL') {
          return event.reason;
        }
        if (event.type === 'STREAM_TIMEOUT') {
          return 'stream_timeout';
        }
        if (event.type === 'CLIENT_DISCONNECT') {
          return 'client_disconnect';
        }
        return 'stream_failure';
      },
    }),
    cacheSessionId: assign({
      sessionId: (_, params: { sessionId: string }) => params.sessionId,
    }),
    setSessionOpenFailureReason: assign({
      failureReason: 'stream_session_open_failed',
    }),
    setBootstrapFailureReason: assign({
      failureReason: ({ context }) => context.input.bootstrap?.failureReason ?? 'stream_failure',
    }),
  },
}).createMachine({
  id: 'streamTransportMachine',
  initial: 'initializing',
  output: ({ event }) => (event as { output: StreamTransportEvent }).output,
  context: ({ input }) => ({
    input,
    sequence: 0,
    lastChunk: input.bootstrap?.initialChunk ?? '',
    generatedContent: input.bootstrap?.initialChunk ?? '',
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    failureReason: null,
    sessionId: null,
  }),
  states: {
    initializing: {
      invoke: {
        src: 'openStreamSession',
        input: ({ context }) => context.input as StreamTransportMachineInput,
        onDone: {
          target: 'streamOpen',
          actions: {
            type: 'cacheSessionId',
            params: ({ event }) => ({
              sessionId: (event as unknown as { output: { sessionId: string } }).output.sessionId,
            }),
          },
        },
        onError: {
          target: 'closedFailure',
          actions: 'setSessionOpenFailureReason',
        },
      },
      on: {
        STREAM_READY: 'streamOpen',
        STREAM_FAIL: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
      },
    },
    streamOpen: {
      always: [
        {
          guard: ({ context }) => Boolean(context.input.bootstrap?.failureReason),
          target: 'closedFailure',
          actions: 'setBootstrapFailureReason',
        },
        {
          guard: ({ context }) => context.input.bootstrap?.autoComplete === true,
          target: 'closedSuccess',
        },
        {
          target: 'streamingTokens',
        },
      ],
      on: {
        STREAM_CHUNK: {
          target: 'streamingTokens',
          actions: ['incrementSequence', 'cacheChunk', 'appendGeneratedChunk'],
        },
        STREAM_COMPLETE: {
          target: 'closedSuccess',
          actions: 'cacheUsageMetrics',
        },
        STREAM_FAIL: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
        STREAM_TIMEOUT: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
        CLIENT_DISCONNECT: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
      },
    },
    streamingTokens: {
      invoke: {
        src: 'streamLlmResponse',
        input: ({ context }) => context.input,
      },
      on: {
        STREAM_CHUNK: {
          actions: ['incrementSequence', 'cacheChunk', 'appendGeneratedChunk'],
        },
        STREAM_HEARTBEAT: {
          actions: 'cacheUsageMetrics',
        },
        STREAM_COMPLETE: {
          target: 'closedSuccess',
          actions: 'cacheUsageMetrics',
        },
        STREAM_FAIL: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
        STREAM_TIMEOUT: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
        CLIENT_DISCONNECT: {
          target: 'closedFailure',
          actions: 'setFailureReason',
        },
      },
    },
    closedSuccess: {
      type: 'final',
      output: ({ context }): StreamTerminatedSuccessEvent => ({
        type: 'STREAM_TERMINATED_SUCCESS',
        requestId: context.input.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: (context.input.runtime?.now ?? (() => new Date()))().toISOString(),
        artifactId: context.input.artifactId,
        content: context.generatedContent,
        metrics: {
          inputTokens: context.inputTokens,
          outputTokens: context.outputTokens,
          costUsd: context.costUsd,
        },
      }),
    },
    closedFailure: {
      type: 'final',
      output: ({ context }): StreamTerminatedFailureEvent => ({
        type: 'STREAM_TERMINATED_FAILURE',
        requestId: context.input.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: (context.input.runtime?.now ?? (() => new Date()))().toISOString(),
        artifactId: context.input.artifactId,
        reason: context.failureReason ?? 'stream_failure',
        content: context.generatedContent,
        metrics: {
          inputTokens: context.inputTokens,
          outputTokens: context.outputTokens,
          costUsd: context.costUsd,
        },
      }),
    },
  },
});

export const createStreamSessionStartedEvent = (
  requestId: string,
  artifactId: string,
): StreamSessionStartedEvent => ({
  type: 'STREAM_SESSION_STARTED',
  requestId,
  sourceActor: 'streamTransportMachine',
  timestamp: nowIso(),
  artifactId,
});

export const createStreamHeartbeatDueEvent = (
  requestId: string,
  artifactId: string,
  metadata: StreamChunkMetadata,
): StreamHeartbeatDueEvent => ({
  type: 'STREAM_HEARTBEAT_DUE',
  requestId,
  sourceActor: 'streamTransportMachine',
  timestamp: nowIso(),
  artifactId,
  metadata: {
    estimatedTokens: {
      input: metadata.sequence,
      output: metadata.sequence,
    },
    costEstimate: metadata.sequence,
  },
});
