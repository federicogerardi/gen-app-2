import { assign, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';

import type {
  UsageActorEvent,
  UsageActorInput,
  UsageGrantedEvent,
  UsageRejectedEvent,
} from '../types/xstate';

type UsageMachineContext = {
  input: UsageMachineInput;
  rejectionReason: string | null;
};

type UsageMachineInput = UsageActorInput & {
  adapters: Pick<GenerationAdapters, 'usage'>;
};

type UsageMachineEvent = { type: 'RETRY' };

type ClaimUsageResult = {
  granted: boolean;
  reason?: string;
};

const getClaimUsageResult = (event: unknown): ClaimUsageResult =>
  (event as { output: ClaimUsageResult }).output;

const getNow = (input: UsageMachineInput): Date =>
  (input.runtime?.now ?? (() => new Date()))();

export const usageMachine = setup({
  types: {
    context: {} as UsageMachineContext,
    input: {} as UsageMachineInput,
    events: {} as UsageMachineEvent,
    output: {} as UsageActorEvent,
  },
  actors: {
    claimUsage: fromPromise(async ({ input }: { input: UsageMachineInput }) => {
      const decision = await input.adapters.usage.claimUsage(input);
      return decision satisfies ClaimUsageResult;
    }),
  },
  guards: {
    isGranted: (_, params: { granted: boolean }) => params.granted,
  },
  actions: {
    setRejectionReason: assign({
      rejectionReason: (_, params: { reason: string }) => params.reason,
    }),
    setUsageFailedRejectionReason: assign({
      rejectionReason: 'usage_failed',
    }),
  },
}).createMachine({
  id: 'usageMachine',
  initial: 'checking',
  output: ({ event }) => (event as { output: UsageActorEvent }).output,
  context: ({ input }) => ({
    input,
    rejectionReason: null,
  }),
  states: {
    checking: {
      invoke: {
        src: 'claimUsage',
        input: ({ context }) => context.input as UsageMachineInput,
        onDone: [
          {
            guard: {
              type: 'isGranted',
              params: ({ event }) => ({ granted: getClaimUsageResult(event).granted }),
            },
            target: 'granted',
          },
          {
            target: 'rejected',
            actions: {
              type: 'setRejectionReason',
              params: ({ event }) => ({
                reason: getClaimUsageResult(event).reason ?? 'usage_failed',
              }),
            },
          },
        ],
        onError: {
          target: 'rejected',
          actions: 'setUsageFailedRejectionReason',
        },
      },
      on: {
        RETRY: {
          target: 'checking',
          reenter: true,
        },
      },
    },
    granted: {
      type: 'final',
      output: ({ context }) => {
        const event: UsageGrantedEvent = {
          type: 'USAGE_GRANTED',
          requestId: context.input.requestId,
          sourceActor: 'usageMachine',
          timestamp: getNow(context.input).toISOString(),
        };
        return event;
      },
    },
    rejected: {
      type: 'final',
      output: ({ context }) => {
        const event: UsageRejectedEvent = {
          type: 'USAGE_REJECTED',
          requestId: context.input.requestId,
          sourceActor: 'usageMachine',
          timestamp: getNow(context.input).toISOString(),
          reason: context.rejectionReason ?? 'usage_failed',
        };
        return event;
      },
    },
  },
});
