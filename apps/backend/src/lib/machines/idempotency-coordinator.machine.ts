import { assign, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';

import { logger } from '../runtime/logger';
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

type ReplayPayloadParams = {
  artifactId: string;
  content: string;
};

const getIdempotencyResult = (event: unknown): IdempotencyResult =>
  (event as { output: IdempotencyResult }).output;

const getNow = (input: IdempotencyMachineInput): Date =>
  (input.runtime?.now ?? (() => new Date()))();

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
    isReplay: (_,{ status }: { status: IdempotencyResult['status'] }) => status === 'replay',
    isConflict: (_,{ status }: { status: IdempotencyResult['status'] }) => status === 'conflict',
  },
  actions: {
    cacheReplayPayload: assign({
      replayArtifactId: (_, params: ReplayPayloadParams) => params.artifactId,
      replayContent: (_, params: ReplayPayloadParams) => params.content,
    }),
    cacheConflictReason: assign({
      conflictReason: (_, params: { reason: string }) => params.reason,
    }),
    setIdempotencyConflictReason: assign({
      conflictReason: 'idempotency_conflict',
    }),
  },
}).createMachine({
  id: 'idempotencyCoordinatorMachine',
  initial: 'checking',
  output: ({ event }) => (event as { output: IdempotencyCoordinatorEvent }).output,
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
            guard: {
              type: 'isReplay',
              params: ({ event }) => ({ status: getIdempotencyResult(event).status }),
            },
            target: 'replayReady',
            actions: {
              type: 'cacheReplayPayload',
              params: ({ event }) => {
                const output = getIdempotencyResult(event);
                if (output.status !== 'replay') {
                  return {
                    artifactId: '',
                    content: '',
                  };
                }

                return {
                  artifactId: output.artifactId,
                  content: output.content,
                };
              },
            },
          },
          {
            guard: {
              type: 'isConflict',
              params: ({ event }) => ({ status: getIdempotencyResult(event).status }),
            },
            target: 'conflict',
            actions: {
              type: 'cacheConflictReason',
              params: ({ event }) => {
                const output = getIdempotencyResult(event);
                return {
                  reason: output.status === 'conflict' ? output.reason : 'idempotency_conflict',
                };
              },
            },
          },
          {
            target: 'claimed',
          },
        ],
        onError: {
          target: 'conflict',
          actions: 'setIdempotencyConflictReason',
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
          timestamp: getNow(context.input).toISOString(),
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
          timestamp: getNow(context.input).toISOString(),
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
        const requestLogger = logger.child({
          requestId: context.input.requestId,
          userId: context.input.userId,
          projectId: context.input.projectId,
        });
        requestLogger.warn({
          event: 'generation.idempotency_conflict',
          workflowType: context.input.workflowType,
          existingReason: context.conflictReason,
        });
        const event: IdempotencyConflictEvent = {
          type: 'IDEMPOTENCY_CONFLICT',
          requestId: context.input.requestId,
          sourceActor: 'idempotencyCoordinatorMachine',
          timestamp: getNow(context.input).toISOString(),
          reason: context.conflictReason ?? 'idempotency_conflict',
        };
        return event;
      },
    },
  },
});
