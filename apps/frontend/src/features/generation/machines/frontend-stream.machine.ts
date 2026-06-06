import {
  assign,
  fromCallback,
  setup,
} from 'xstate';
import type { GenerationRequest } from '../contracts/backend-stream';
import type { ToolCheckpoint } from '../ui/tool-checkpoints';
import {
  normalizeTransportError,
  streamGeneration,
} from '../runtime/generation-client';
import { STREAM_CONFIG } from '../../../app/config/stream-config';
import { UI_CONFIG } from '../../../app/config/ui-config';

export type FrontendStreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'reconnecting';

export type ExtractionContext = {
  projectId: string;
  briefingId: string;
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  normalizedText: string;
  parsedFormat: 'txt' | 'md' | 'docx';
  updatedAt: string;
};

export type FrontendStreamContext = {
  requestId: string | null;
  artifactId: string | null;
  content: string;
  lastSequence: number;
  errorCode: string | null;
  errorMessage: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  hasTerminal: boolean;
  terminalCompletedStep: string | null;
  terminalFailedStep: string | null;
  lastRequest: GenerationRequest | null;
  apiBaseUrl: string;
  checkpoints: ToolCheckpoint[];
  extractionByProject: Record<string, ExtractionContext>;
};

type FrontendStreamInput = {
  apiBaseUrl: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
};

type FrontendStreamEvent =
  | { type: 'REQUEST_START'; request: GenerationRequest }
  | { type: 'SSE_START'; requestId: string; artifactId: string }
  | { type: 'SSE_CHUNK'; artifactId: string; chunk: string; sequence: number }
  | {
    type: 'SSE_TERMINAL';
    artifactId: string | null;
    status: 'completed' | 'failed';
    reason: string | null;
    completedStep?: string | null;
    failedStep?: string | null;
  }
  | { type: 'STREAM_ERROR'; code: string; message: string; retryable: boolean }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'CHECKPOINT_UPSERTED'; checkpoint: ToolCheckpoint }
  | { type: 'EXTRACTION_UPSERTED'; context: ExtractionContext };

const computeReconnectDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  const expDelay = Math.min(maxDelay, baseDelay * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * STREAM_CONFIG.reconnect.jitterMs);
  return expDelay + jitter;
};

export const frontendStreamMachine = setup({
  types: {
    context: {} as FrontendStreamContext,
    input: {} as FrontendStreamInput,
    events: {} as FrontendStreamEvent,
  },
  actors: {
    streamTransport: fromCallback<
      FrontendStreamEvent,
      { request: GenerationRequest; apiBaseUrl: string }
    >(({ input, sendBack }) => {
      const controller = new AbortController();

      void streamGeneration(input.request, {
        apiBaseUrl: input.apiBaseUrl,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.event === 'start') {
            sendBack({
              type: 'SSE_START',
              requestId: event.data.requestId,
              artifactId: event.data.artifactId,
            });
            return;
          }

          if (event.event === 'chunk') {
            sendBack({
              type: 'SSE_CHUNK',
              artifactId: event.data.artifactId,
              chunk: event.data.chunk,
              sequence: event.data.sequence,
            });
            return;
          }

          sendBack({
            type: 'SSE_TERMINAL',
            artifactId: event.data.artifactId,
            status: event.data.status,
            reason: event.data.reason,
            completedStep: event.data.completedStep ?? null,
            failedStep: event.data.failedStep ?? null,
          });
        },
      }).catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        const normalized = normalizeTransportError(error);
        sendBack({
          type: 'STREAM_ERROR',
          code: normalized.code,
          message: normalized.message,
          retryable: normalized.retryable,
        });
      });

      return () => {
        controller.abort();
      };
    }),
  },
  guards: {
    isExpectedStartEvent: ({ context, event }) => {
      return event.type === 'SSE_START' && event.requestId === context.requestId;
    },
    isChunkForActiveArtifact: ({ context, event }) => {
      return event.type === 'SSE_CHUNK'
        && event.sequence > context.lastSequence
        && context.artifactId !== null
        && event.artifactId === context.artifactId;
    },
    isRetryableTransportError: ({ context, event }) => {
      return event.type === 'STREAM_ERROR' && event.retryable && !context.hasTerminal;
    },
    hasRequestToRetry: ({ context }) => context.lastRequest !== null,
    isReconnectExhausted: ({ context }) => {
      return context.reconnectAttempts > context.maxReconnectAttempts;
    },
    isTerminalCompleted: ({ context, event }) => {
      return event.type === 'SSE_TERMINAL'
        && event.status === 'completed'
        && context.artifactId !== null
        && (event.artifactId === null || event.artifactId === context.artifactId);
    },
    isTerminalFailed: ({ context, event }) => {
      return event.type === 'SSE_TERMINAL'
        && event.status === 'failed'
        && context.artifactId !== null
        && (event.artifactId === null || event.artifactId === context.artifactId);
    },
  },
  actions: {
    cacheRequestedStart: assign({
      requestId: ({ event }) => (event.type === 'REQUEST_START' ? event.request.requestId : null),
      lastRequest: ({ event }) => (event.type === 'REQUEST_START' ? event.request : null),
      artifactId: () => null,
      content: () => '',
      lastSequence: () => 0,
      errorCode: () => null,
      errorMessage: () => null,
      hasTerminal: () => false,
      reconnectAttempts: () => 0,
    }),
    cacheStartMeta: assign({
      requestId: ({ event, context }) =>
        event.type === 'SSE_START' ? event.requestId : context.requestId,
      artifactId: ({ event, context }) =>
        event.type === 'SSE_START' ? event.artifactId : context.artifactId,
    }),
    appendChunk: assign({
      content: ({ context, event }) =>
        event.type === 'SSE_CHUNK' ? `${context.content}${event.chunk}` : context.content,
      lastSequence: ({ context, event }) =>
        event.type === 'SSE_CHUNK' ? event.sequence : context.lastSequence,
      artifactId: ({ context, event }) =>
        event.type === 'SSE_CHUNK' ? event.artifactId : context.artifactId,
    }),
    setTerminalSuccess: assign({
      hasTerminal: () => true,
      errorCode: () => null,
      errorMessage: () => null,
      artifactId: ({ context, event }) =>
        event.type === 'SSE_TERMINAL'
          ? (event.artifactId ?? context.artifactId)
          : context.artifactId,
      terminalCompletedStep: ({ event }) =>
        event.type === 'SSE_TERMINAL' ? (event.completedStep ?? null) : null,
      terminalFailedStep: () => null,
    }),
    setTerminalFailure: assign({
      hasTerminal: () => true,
      errorCode: () => 'terminal_failed',
      errorMessage: ({ event }) =>
        event.type === 'SSE_TERMINAL'
          ? (event.reason ?? 'Generation failed')
          : 'Generation failed',
      artifactId: ({ context, event }) =>
        event.type === 'SSE_TERMINAL'
          ? (event.artifactId ?? context.artifactId)
          : context.artifactId,
      terminalCompletedStep: () => null,
      terminalFailedStep: ({ event }) =>
        event.type === 'SSE_TERMINAL' ? (event.failedStep ?? null) : null,
    }),
    setProtocolError: assign({
      hasTerminal: () => false,
      errorCode: () => 'protocol_error',
      errorMessage: () => 'Invalid stream event order or chunk sequence',
    }),
    setTransportError: assign({
      errorCode: ({ event }) => (event.type === 'STREAM_ERROR' ? event.code : null),
      errorMessage: ({ event }) =>
        event.type === 'STREAM_ERROR' ? event.message : 'Transport error',
    }),
    incrementReconnectAttempts: assign({
      reconnectAttempts: ({ context }) => context.reconnectAttempts + 1,
    }),
    setReconnectExhaustedFailure: assign({
      errorCode: () => 'reconnect_exhausted',
      errorMessage: ({ context }) =>
        `Reconnect exhausted after ${context.reconnectAttempts} attempts`,
    }),
    prepareRetry: assign({
      artifactId: () => null,
      content: () => '',
      lastSequence: () => 0,
      hasTerminal: () => false,
      errorCode: () => null,
      errorMessage: () => null,
      reconnectAttempts: () => 0,
      terminalCompletedStep: () => null,
      terminalFailedStep: () => null,
      requestId: ({ context }) => context.lastRequest?.requestId ?? null,
    }),
    upsertCheckpoint: assign({
      checkpoints: ({ context, event }) => {
        if (event.type !== 'CHECKPOINT_UPSERTED') return context.checkpoints;
        const { checkpoint } = event;
        const index = context.checkpoints.findIndex((c) => c.artifactId === checkpoint.artifactId);
        if (index === -1) {
          return [checkpoint, ...context.checkpoints].slice(0, UI_CONFIG.limits.maxStoredCheckpoints);
        }
        const clone = [...context.checkpoints];
        clone[index] = checkpoint;
        return clone;
      },
    }),
    upsertExtraction: assign({
      extractionByProject: ({ context, event }) => {
        if (event.type !== 'EXTRACTION_UPSERTED') return context.extractionByProject;
        const ctx = event.context;
        return { ...context.extractionByProject, [ctx.projectId]: ctx };
      },
    }),
    resetStreamContext: assign(({ context }) => ({
      ...context,
      requestId: null,
      artifactId: null,
      content: '',
      lastSequence: 0,
      errorCode: null,
      errorMessage: null,
      reconnectAttempts: 0,
      hasTerminal: false,
      terminalCompletedStep: null,
      terminalFailedStep: null,
      lastRequest: null,
      checkpoints: [],
      extractionByProject: {},
    })),
  },
  delays: {
    reconnectDelay: ({ context }) => {
      return computeReconnectDelay(
        context.reconnectAttempts,
        context.reconnectBaseDelayMs,
        context.reconnectMaxDelayMs,
      );
    },
  },
}).createMachine({
  id: 'frontendStreamMachine',
  context: ({ input }) => ({
    requestId: null,
    artifactId: null,
    content: '',
    lastSequence: 0,
    errorCode: null,
    errorMessage: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: input.maxReconnectAttempts ?? STREAM_CONFIG.reconnect.maxAttempts,
    reconnectBaseDelayMs: input.reconnectBaseDelayMs ?? STREAM_CONFIG.reconnect.baseDelayMs,
    reconnectMaxDelayMs: input.reconnectMaxDelayMs ?? STREAM_CONFIG.reconnect.maxDelayMs,
    hasTerminal: false,
    terminalCompletedStep: null,
    terminalFailedStep: null,
    lastRequest: null,
    apiBaseUrl: input.apiBaseUrl,
    checkpoints: [],
    extractionByProject: {},
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        REQUEST_START: {
          target: 'active',
          actions: 'cacheRequestedStart',
        },
        RESET: {
          actions: 'resetStreamContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
        EXTRACTION_UPSERTED: { actions: 'upsertExtraction' },
      },
    },
    active: {
      invoke: {
        src: 'streamTransport',
        input: ({ context }) => {
          if (!context.lastRequest) {
            throw new Error('Missing request payload while connecting');
          }

          return {
            request: context.lastRequest,
            apiBaseUrl: context.apiBaseUrl,
          };
        },
      },
      on: {
        SSE_TERMINAL: [
          {
            guard: 'isTerminalCompleted',
            target: '#frontendStreamMachine.completed',
            actions: 'setTerminalSuccess',
          },
          {
            guard: 'isTerminalFailed',
            target: '#frontendStreamMachine.failed',
            actions: 'setTerminalFailure',
          },
          {
            target: '#frontendStreamMachine.failed',
            actions: 'setProtocolError',
          },
        ],
        STREAM_ERROR: [
          {
            guard: 'isRetryableTransportError',
            target: '.reconnecting',
            actions: 'setTransportError',
          },
          {
            target: '#frontendStreamMachine.failed',
            actions: 'setTransportError',
          },
        ],
        CANCEL: {
          target: '#frontendStreamMachine.idle',
          actions: 'resetStreamContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
        EXTRACTION_UPSERTED: { actions: 'upsertExtraction' },
      },
      initial: 'connecting',
      states: {
        connecting: {
          on: {
            SSE_START: [
              {
                guard: 'isExpectedStartEvent',
                target: 'streaming',
                actions: 'cacheStartMeta',
              },
              {
                target: '#frontendStreamMachine.failed',
                actions: 'setProtocolError',
              },
            ],
            SSE_CHUNK: {
              target: '#frontendStreamMachine.failed',
              actions: 'setProtocolError',
            },
          },
        },
        streaming: {
          on: {
            SSE_CHUNK: [
              {
                guard: 'isChunkForActiveArtifact',
                actions: 'appendChunk',
              },
              {
                target: '#frontendStreamMachine.failed',
                actions: 'setProtocolError',
              },
            ],
          },
        },
        reconnecting: {
          entry: 'incrementReconnectAttempts',
          always: {
            guard: 'isReconnectExhausted',
            target: '#frontendStreamMachine.failed',
            actions: 'setReconnectExhaustedFailure',
          },
          after: {
            reconnectDelay: {
              target: 'connecting',
            },
          },
        },
      },
    },
    completed: {
      on: {
        REQUEST_START: {
          target: 'active',
          actions: 'cacheRequestedStart',
        },
        RESET: {
          target: 'idle',
          actions: 'resetStreamContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
        EXTRACTION_UPSERTED: { actions: 'upsertExtraction' },
      },
    },
    failed: {
      on: {
        REQUEST_START: {
          target: 'active',
          actions: 'cacheRequestedStart',
        },
        RESET: {
          target: 'idle',
          actions: 'resetStreamContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
        EXTRACTION_UPSERTED: { actions: 'upsertExtraction' },
        RETRY: {
          guard: 'hasRequestToRetry',
          target: 'active',
          actions: 'prepareRetry',
        },
      },
    },
  },
});
