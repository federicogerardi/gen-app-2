import {
  assign,
  fromPromise,
  setup,
} from 'xstate';
import type { GenerationRequest } from '../contracts/backend-stream';
import type { GenerationRunResponse } from '@gen-app-2/contracts';
import {
  runGeneration,
  normalizeTransportError,
  mapBackendFailureReasonToUserMessage,
} from '../runtime/generation-client';
import type { ToolCheckpoint } from '../ui/tool-checkpoints';

export type FrontendGenerationStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed';

export type FrontendGenerationContext = {
  requestId: string | null;
  artifactId: string | null;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  lastRequest: GenerationRequest | null;
  apiBaseUrl: string;
  checkpoints: ToolCheckpoint[];
};

type FrontendGenerationInput = {
  apiBaseUrl: string;
};

type FrontendGenerationEvent =
  | { type: 'REQUEST_START'; request: GenerationRequest }
  | { type: 'RESET' }
  | { type: 'CHECKPOINT_UPSERTED'; checkpoint: ToolCheckpoint };

export const frontendGenerationMachine = setup({
  types: {
    context: {} as FrontendGenerationContext,
    input: {} as FrontendGenerationInput,
    events: {} as FrontendGenerationEvent,
  },
  actors: {
    runGenerationActor: fromPromise<
      GenerationRunResponse,
      { request: GenerationRequest; apiBaseUrl: string }
    >(async ({ input }) => {
      return runGeneration(input.request, {
        apiBaseUrl: input.apiBaseUrl,
      });
    }),
  },
  actions: {
    cacheRequestStart: assign({
      requestId: ({ event }) => (event.type === 'REQUEST_START' ? event.request.requestId : null),
      lastRequest: ({ event }) => (event.type === 'REQUEST_START' ? event.request : null),
      artifactId: () => null,
      content: () => '',
      errorCode: () => null,
      errorMessage: () => null,
    }),
    cacheSuccessResult: assign({
      artifactId: ({ event }) => (event as unknown as { output: { artifactId: string } }).output?.artifactId ?? null,
      content: ({ event }) => (event as unknown as { output: { content: string } }).output?.content ?? '',
      errorCode: () => null,
      errorMessage: () => null,
    }),
    cacheFailureFromActorError: assign({
      errorCode: () => 'generation_failed',
      errorMessage: ({ event }) => {
        const error = (event as unknown as { error: Error }).error;
        const normalized = normalizeTransportError(error);
        return mapBackendFailureReasonToUserMessage(normalized.message);
      },
    }),
    resetContext: assign(({ context }) => ({
      ...context,
      requestId: null,
      artifactId: null,
      content: '',
      errorCode: null,
      errorMessage: null,
      lastRequest: null,
      checkpoints: [],
    })),
    upsertCheckpoint: assign({
      checkpoints: ({ context, event }) => {
        if (event.type !== 'CHECKPOINT_UPSERTED') return context.checkpoints;
        const { checkpoint } = event;
        const index = context.checkpoints.findIndex((c) => c.artifactId === checkpoint.artifactId);
        if (index === -1) {
          return [checkpoint, ...context.checkpoints];
        }
        const clone = [...context.checkpoints];
        clone[index] = checkpoint;
        return clone;
      },
    }),
  },
}).createMachine({
  id: 'frontendGenerationMachine',
  context: ({ input }) => ({
    requestId: null,
    artifactId: null,
    content: '',
    errorCode: null,
    errorMessage: null,
    lastRequest: null,
    apiBaseUrl: input.apiBaseUrl,
    checkpoints: [],
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        REQUEST_START: {
          target: 'running',
          actions: 'cacheRequestStart',
        },
        RESET: { actions: 'resetContext' },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
      },
    },
    running: {
      invoke: {
        src: 'runGenerationActor',
        input: ({ context }) => {
          if (!context.lastRequest) {
            throw new Error('Missing request payload for generation');
          }
          return { request: context.lastRequest, apiBaseUrl: context.apiBaseUrl };
        },
        onDone: {
          target: 'completed',
          actions: 'cacheSuccessResult',
        },
        onError: {
          target: 'failed',
          actions: 'cacheFailureFromActorError',
        },
      },
      on: {
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
      },
    },
    completed: {
      on: {
        REQUEST_START: {
          target: 'running',
          actions: 'cacheRequestStart',
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
      },
    },
    failed: {
      on: {
        REQUEST_START: {
          target: 'running',
          actions: 'cacheRequestStart',
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
        CHECKPOINT_UPSERTED: { actions: 'upsertCheckpoint' },
      },
    },
  },
});