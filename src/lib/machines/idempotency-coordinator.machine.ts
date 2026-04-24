import { assign, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';

import type {
  IdempotencyClaimedEvent,
  IdempotencyConflictEvent,
  IdempotencyCoordinatorEvent,
  IdempotencyCoordinatorInput,
  IdempotencyReplayReadyEvent,
} from '../types/xstate';

type IdempotencyMachineContext = {
  input: IdempotencyMachineInput;
  replayArtifactId: string | null;
  replayContent: string;
  conflictReason: string | null;
};

type IdempotencyMachineInput = IdempotencyCoordinatorInput & {
  adapters: Pick<GenerationAdapters, 'idempotency'>;
};

type IdempotencyMachineEvent = { type: 'RETRY' };

type IdempotencyResult =
  | { status: 'claimed' }
  | { status: 'replay'; artifactId: string; content: string }
  | { status: 'conflict'; reason: string };

const nowIso = (): string => new Date().toISOString();

export const idempotencyCoordinatorMachine = setup({
  types: {
    context: {} as IdempotencyMachineContext,
    input: {} as IdempotencyMachineInput,
    events: {} as IdempotencyMachineEvent,
    output: {} as IdempotencyCoordinatorEvent,
  },
  actors: {
    checkIdempotency: fromPromise(async ({ input }: { input: IdempotencyMachineInput }) => {
      const decision = await input.adapters.idempotency.checkAndClaim(input);
      return decision satisfies IdempotencyResult;
    }),
  },
  guards: {
    isReplay: ({ event }) =>
      (event as unknown as { output: IdempotencyResult }).output.status === 'replay',
    isConflict: ({ event }) =>
      (event as unknown as { output: IdempotencyResult }).output.status === 'conflict',
  },
  actions: {
    cacheReplayPayload: assign({
      replayArtifactId: ({ event }) => {
        const output = (event as unknown as { output: IdempotencyResult }).output;
        return output.status === 'replay' ? output.artifactId : null;
      },
      replayContent: ({ event }) => {
        const output = (event as unknown as { output: IdempotencyResult }).output;
        return output.status === 'replay' ? output.content : '';
      },
    }),
    cacheConflictReason: assign({
      conflictReason: ({ event }) => {
        const output = (event as unknown as { output: IdempotencyResult }).output;
        return output.status === 'conflict' ? output.reason : 'idempotency_conflict';
      },
    }),
  },
}).createMachine({
  id: 'idempotencyCoordinatorMachine',
  initial: 'checking',
  context: ({ input }) => ({
    input,
    replayArtifactId: null,
    replayContent: '',
    conflictReason: null,
  }),
  states: {
    checking: {
      invoke: {
        src: 'checkIdempotency',
        input: ({ context }) => context.input as IdempotencyMachineInput,
        onDone: [
          {
            guard: 'isReplay',
            target: 'replayReady',
            actions: 'cacheReplayPayload',
          },
          {
            guard: 'isConflict',
            target: 'conflict',
            actions: 'cacheConflictReason',
          },
          {
            target: 'claimed',
          },
        ],
        onError: {
          target: 'conflict',
          actions: assign({ conflictReason: 'idempotency_conflict' }),
        },
      },
      on: {
        RETRY: {
          target: 'checking',
          reenter: true,
        },
      },
    },
    claimed: {
      type: 'final',
      output: ({ context }) => {
        const event: IdempotencyClaimedEvent = {
          type: 'IDEMPOTENCY_CLAIMED',
          requestId: context.input.requestId,
          sourceActor: 'idempotencyCoordinatorMachine',
          timestamp: nowIso(),
        };
        return event;
      },
    },
    replayReady: {
      type: 'final',
      output: ({ context }) => {
        const event: IdempotencyReplayReadyEvent = {
          type: 'IDEMPOTENCY_REPLAY_READY',
          requestId: context.input.requestId,
          sourceActor: 'idempotencyCoordinatorMachine',
          timestamp: nowIso(),
          artifactId: context.replayArtifactId ?? context.input.idempotencyKey,
          metadata: {
            content: context.replayContent,
          },
        };
        return event;
      },
    },
    conflict: {
      type: 'final',
      output: ({ context }) => {
        const event: IdempotencyConflictEvent = {
          type: 'IDEMPOTENCY_CONFLICT',
          requestId: context.input.requestId,
          sourceActor: 'idempotencyCoordinatorMachine',
          timestamp: nowIso(),
          reason: context.conflictReason ?? 'idempotency_conflict',
        };
        return event;
      },
    },
  },
});
