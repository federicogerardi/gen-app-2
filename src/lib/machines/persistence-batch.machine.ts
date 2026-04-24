import { assign, fromPromise, setup } from 'xstate';

import type { GenerationAdapters } from '../adapters/generation.adapters';
import type {
  PersistenceBatchEvent,
  PersistenceBatchInput,
  PersistenceFinalizeFailedEvent,
  PersistenceFinalizeSucceededEvent,
  PersistenceFlushCommittedEvent,
  StreamChunkReceivedEvent,
  StreamTerminatedFailureEvent,
  StreamTerminatedSuccessEvent,
} from '../types/xstate';

type PersistenceBatchMachineContext = {
  input: PersistenceBatchMachineInput;
  flushRetries: number;
  failureReason: string | null;
  lastSequence: number;
};

type PersistenceBatchMachineInput = PersistenceBatchInput & {
  adapters: Pick<GenerationAdapters, 'persistence'>;
};

type PersistenceBatchMachineEvent =
  | StreamChunkReceivedEvent
  | StreamTerminatedSuccessEvent
  | StreamTerminatedFailureEvent
  | { type: 'RETRY_FLUSH' };

const nowIso = (): string => new Date().toISOString();

export const persistenceBatchMachine = setup({
  types: {
    context: {} as PersistenceBatchMachineContext,
    input: {} as PersistenceBatchMachineInput,
    events: {} as PersistenceBatchMachineEvent,
    output: {} as PersistenceBatchEvent,
  },
  actors: {
    flushProgress: fromPromise(
      async ({ input }: { input: { machineInput: PersistenceBatchMachineInput; sequence: number } }) => {
        await input.machineInput.adapters.persistence.flushProgress(
          input.machineInput,
          input.sequence,
        );
        return { ok: true } as const;
      },
    ),
    finalizeSuccess: fromPromise(async ({ input }: { input: PersistenceBatchMachineInput }) => {
      await input.adapters.persistence.finalizeSuccess(input);
      return { ok: true } as const;
    }),
    finalizeFailure: fromPromise(
      async ({ input }: { input: { machineInput: PersistenceBatchMachineInput; reason: string } }) => {
        await input.machineInput.adapters.persistence.finalizeFailure(
          input.machineInput,
          input.reason,
        );
        return { ok: true } as const;
      },
    ),
  },
  guards: {
    shouldFlush: ({ event }) =>
      event.type === 'STREAM_CHUNK_RECEIVED' && event.metadata.sequence % 10 === 0,
    canRetryFlush: ({ context }) => context.flushRetries < 3,
  },
  actions: {
    incrementFlushRetries: assign({
      flushRetries: ({ context }) => context.flushRetries + 1,
    }),
    resetFlushRetries: assign({ flushRetries: 0 }),
    cacheFailureReason: assign({
      failureReason: ({ event }) =>
        event.type === 'STREAM_TERMINATED_FAILURE' ? event.reason : 'persistence_finalize_failed',
    }),
    setFlushFailureReason: assign({ failureReason: 'persistence_flush_failed' }),
    cacheSequence: assign({
      lastSequence: ({ event, context }) =>
        event.type === 'STREAM_CHUNK_RECEIVED' ? event.metadata.sequence : context.lastSequence,
    }),
  },
}).createMachine({
  id: 'persistenceBatchMachine',
  initial: 'idle',
  context: ({ input }) => ({
    input,
    flushRetries: 0,
    failureReason: null,
    lastSequence: 0,
  }),
  states: {
    idle: {
      on: {
        STREAM_CHUNK_RECEIVED: [
          {
            guard: 'shouldFlush',
            target: 'flushing',
            actions: 'cacheSequence',
          },
        ],
        STREAM_TERMINATED_SUCCESS: 'finalizingSuccess',
        STREAM_TERMINATED_FAILURE: {
          target: 'finalizingFailure',
          actions: 'cacheFailureReason',
        },
      },
    },
    flushing: {
      invoke: {
        src: 'flushProgress',
        input: ({ context }) => ({
          machineInput: context.input,
          sequence: context.lastSequence,
        }),
        onDone: {
          target: 'idle',
          actions: 'resetFlushRetries',
        },
        onError: [
          {
            guard: 'canRetryFlush',
            target: 'flushing',
            actions: 'incrementFlushRetries',
            reenter: true,
          },
          {
            target: 'finalizingFailure',
            actions: 'setFlushFailureReason',
          },
        ],
      },
      on: {
        RETRY_FLUSH: {
          target: 'flushing',
          reenter: true,
        },
      },
    },
    finalizingSuccess: {
      invoke: {
        src: 'finalizeSuccess',
        input: ({ context }) => context.input,
        onDone: {
          target: 'finalizedSuccess',
        },
        onError: {
          target: 'finalizingFailure',
          actions: assign({ failureReason: 'persistence_finalize_failed' }),
        },
      },
    },
    finalizingFailure: {
      invoke: {
        src: 'finalizeFailure',
        input: ({ context }) => ({
          machineInput: context.input,
          reason: context.failureReason ?? 'persistence_finalize_failed',
        }),
        onDone: {
          target: 'finalizedFailure',
        },
        onError: {
          target: 'finalizedFailure',
        },
      },
    },
    finalizedSuccess: {
      type: 'final',
      output: ({ context }): PersistenceFinalizeSucceededEvent => ({
        type: 'PERSISTENCE_FINALIZE_SUCCEEDED',
        requestId: context.input.requestId,
        sourceActor: 'persistenceBatchMachine',
        timestamp: nowIso(),
        artifactId: context.input.artifactId,
      }),
    },
    finalizedFailure: {
      type: 'final',
      output: ({ context }): PersistenceFinalizeFailedEvent => ({
        type: 'PERSISTENCE_FINALIZE_FAILED',
        requestId: context.input.requestId,
        sourceActor: 'persistenceBatchMachine',
        timestamp: nowIso(),
        artifactId: context.input.artifactId,
        reason: context.failureReason ?? 'persistence_finalize_failed',
      }),
    },
  },
});

export const createPersistenceFlushCommittedEvent = (
  requestId: string,
  artifactId: string,
): PersistenceFlushCommittedEvent => ({
  type: 'PERSISTENCE_FLUSH_COMMITTED',
  requestId,
  sourceActor: 'persistenceBatchMachine',
  timestamp: nowIso(),
  artifactId,
});
