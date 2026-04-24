import { assign, fromPromise, setup } from 'xstate';
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
  failureReason: string | null;
  sessionId: string | null;
};

type StreamTransportMachineInput = StreamTransportInput & {
  adapters: Pick<GenerationAdapters, 'stream'>;
};

type StreamTransportMachineEvent =
  | { type: 'STREAM_READY' }
  | { type: 'STREAM_CHUNK'; chunk: string }
  | { type: 'STREAM_HEARTBEAT'; estimatedInputTokens: number; estimatedOutputTokens: number; costEstimate: number }
  | { type: 'STREAM_COMPLETE' }
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
  },
  actions: {
    incrementSequence: assign({
      sequence: ({ context }) => context.sequence + 1,
    }),
    cacheChunk: assign({
      lastChunk: ({ event }) => ('chunk' in event ? event.chunk : ''),
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
      sessionId: ({ event }) =>
        (event as unknown as { output: { sessionId: string } }).output.sessionId,
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
          actions: 'cacheSessionId',
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
      ],
      on: {
        STREAM_CHUNK: {
          target: 'streamingTokens',
          actions: ['incrementSequence', 'cacheChunk'],
        },
        STREAM_COMPLETE: 'closedSuccess',
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
      on: {
        STREAM_CHUNK: {
          target: 'streamingTokens',
          actions: ['incrementSequence', 'cacheChunk'],
          reenter: true,
        },
        STREAM_HEARTBEAT: {
          target: 'streamingTokens',
          reenter: true,
        },
        STREAM_COMPLETE: 'closedSuccess',
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
